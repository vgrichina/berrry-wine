'use strict';
const assert = require('assert/strict');
const {randomBytes} = require('crypto');

// Runs in the application's default world. No clone, tee, duplicate fetch,
// replacement Response, fulfillment or read-ahead. Only reads requested by the
// application are observed; returned values and rejection reasons are preserved.
function install({binding, prefix, urls, maxBytes}) {
  const original = globalThis.fetch, notify = globalThis[binding];
  const selected = new Set(urls);
  let sequence = 0;
  const emit = row => notify(JSON.stringify({...row, documentURL: location.href,
    timeOrigin: performance.timeOrigin}));
  function wrapped(...args) {
    const input = args[0], init = args[1];
    const url = new URL(input instanceof Request ? input.url : String(input), location.href).href;
    if (!selected.has(url)) return Reflect.apply(original, this, args);
    const token = prefix + (++sequence), signal = init?.signal || (input instanceof Request ? input.signal : null);
    let failed = false, completed = false, reading = false, bytes = 0;
    const chunks = [];
    const fail = error => {if (!failed) {failed = true; emit({token, phase: 'failed', error: String(error)});}};
    const add = value => {
      bytes += value.byteLength;
      if (bytes > maxBytes) {fail('consumer body exceeds limit'); return;}
      chunks.push(new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice());
    };
    const finish = async kind => {
      if (failed || completed) return;
      try {
        const all = new Uint8Array(bytes); let offset = 0;
        for (const chunk of chunks) {all.set(chunk, offset); offset += chunk.length;}
        const digest = await crypto.subtle.digest('SHA-256', all);
        if (failed || signal?.aborted) {fail('AbortController cancellation'); return;}
        completed = true;
        emit({token, phase: 'completed', completion: true, kind, bytes,
          sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')});
      } catch (error) {fail(error);}
    };
    emit({token, phase: 'begin', url});
    signal?.addEventListener('abort', () => fail('AbortController cancellation'), {once: true});
    if (signal?.aborted) fail('AbortController cancellation');
    // A unique function name in the native fetch initiator stack binds the
    // Network ID to this invocation. The adapter also checks its script/context.
    const invoke = {[token](...values) {return Reflect.apply(original, this, values);}}[token];
    return Reflect.apply(invoke, this, args).then(response => {
      const arrayBuffer = response.arrayBuffer;
      response.arrayBuffer = function(...values) {
        if (reading) fail('ambiguous consumer'); reading = true;
        return Reflect.apply(arrayBuffer, this, values).then(value => {
          add(new Uint8Array(value)); void finish('arrayBuffer'); return value;
        }, error => {fail(error); throw error;});
      };
      if (response.body) {
        const getReader = response.body.getReader;
        response.body.getReader = function(...values) {
          if (reading || values[0]?.mode) fail('ambiguous or unsupported reader'); reading = true;
          const reader = Reflect.apply(getReader, this, values);
          const read = reader.read, cancel = reader.cancel; let eof = false;
          reader.read = function(...readArgs) {
            return Reflect.apply(read, this, readArgs).then(result => {
              if (result.done) {if (!eof) {eof = true; void finish('reader-eof');}}
              else add(result.value);
              return result;
            }, error => {fail(error); throw error;});
          };
          reader.cancel = function(...cancelArgs) {
            if (!eof) fail('reader.cancel before EOF');
            return Reflect.apply(cancel, this, cancelArgs);
          };
          return reader;
        };
      }
      return response;
    }, error => {fail(error); throw error;});
  }
  globalThis.fetch = wrapped;
  globalThis[binding + '_restore'] = () => {
    if (globalThis.fetch === wrapped) globalThis.fetch = original;
    delete globalThis[binding + '_restore'];
  };
}

async function observeConsumers({session, collector, identity, urls, record = () => {}, onFault}) {
  assert(Array.isArray(urls) && urls.length && new Set(urls).size === urls.length);
  urls.forEach(url => assert.equal(new URL(url).href, url));
  const prefix = 'wineConsumer_' + randomBytes(12).toString('hex') + '_';
  const binding = prefix + 'binding', sourceURL = prefix + 'observer.js';
  const contexts = new Map(), scripts = new Map(), pending = new Map(), listeners = [];
  const listen = (name, fn) => {session.on(name, fn); listeners.push([name, fn]);};
  const fail = error => onFault({boundary: 'actual-consumer-adapter', ...identity, error: String(error)});
  listen('Runtime.executionContextCreated', ({context}) => contexts.set(context.id, context));
  listen('Runtime.executionContextDestroyed', event => {
    collector.invalidateConsumers(identity.sessionId, event.executionContextId);
    contexts.delete(event.executionContextId);
  });
  listen('Runtime.executionContextsCleared', () => {
    for (const id of contexts.keys()) collector.invalidateConsumers(identity.sessionId, id);
    contexts.clear();
  });
  listen('Debugger.scriptParsed', event => {
    if (event.url === sourceURL) scripts.set(event.scriptId, event.executionContextId);
  });
  listen('Runtime.bindingCalled', event => {
    if (event.name !== binding) return;
    try {
      const value = JSON.parse(event.payload), context = contexts.get(event.executionContextId);
      assert(context?.auxData?.isDefault && context.uniqueId, 'missing default execution context');
      assert(value.token.startsWith(prefix), 'unexpected consumer token');
      if (value.phase === 'begin') {
        assert(!pending.has(value.token) && urls.includes(value.url), 'ambiguous consumer start');
        pending.set(value.token, {begin: value, context: {...context}, binding: null});
      } else {
        const item = pending.get(value.token);
        assert(item?.binding, 'consumer completion lacks exact Network binding');
        assert.equal(context.uniqueId, item.context.uniqueId, 'execution context replaced');
        assert.equal(value.documentURL, item.begin.documentURL, 'document replaced');
        assert.equal(value.timeOrigin, item.begin.timeOrigin, 'document time origin replaced');
        collector.completeConsumer({...value, ...item.binding, completion: value.phase === 'completed'});
      }
      record({...identity, contextId: context.id, contextUniqueId: context.uniqueId, ...value});
    } catch (error) {fail(error);}
  });
  listen('Network.requestWillBeSent', event => {
    try {
      const frames = []; let stack = event.initiator?.stack;
      while (stack) {frames.push(...stack.callFrames); stack = stack.parent;}
      const matches = frames.filter(frame => frame.functionName.startsWith(prefix));
      if (!matches.length && !urls.includes(event.request.url)) return;
      record({...identity, source: 'consumer-initiator', networkId: event.requestId,
        url: event.request.url, initiator: event.initiator});
      assert.equal(matches.length, 1, 'ambiguous fetch initiator');
      const frame = matches[0], item = pending.get(frame.functionName);
      assert(item && !item.binding, 'missing or reused consumer invocation');
      assert.equal(scripts.get(frame.scriptId), item.context.id, 'initiator script/context mismatch');
      assert.equal(contexts.get(item.context.id)?.uniqueId, item.context.uniqueId);
      assert.equal(event.request.url, item.begin.url);
      assert(event.type === 'Fetch' && event.request.method === 'GET' && !event.redirectResponse,
        'unsupported consumer request');
      item.binding = {...identity, networkId: event.requestId, token: frame.functionName,
        contextId: item.context.id, contextUniqueId: item.context.uniqueId,
        frameId: item.context.auxData.frameId, documentURL: item.begin.documentURL,
        timeOrigin: item.begin.timeOrigin};
      collector.bindConsumer(item.binding);
      record({...item.binding, state: 'bound', scriptId: frame.scriptId, url: event.request.url});
    } catch (error) {fail(error);}
  });
  await session.send('Runtime.enable');
  await session.send('Page.enable');
  await session.send('Debugger.enable');
  await session.send('Runtime.addBinding', {name: binding});
  const expression = '(' + install.toString() + ')(' + JSON.stringify({binding, prefix, urls,
    maxBytes: 64 * 1024 * 1024}) + ')\n//# sourceURL=' + sourceURL;
  const {identifier} = await session.send('Page.addScriptToEvaluateOnNewDocument', {source: expression});
  const result = await session.send('Runtime.evaluate', {expression});
  assert(!result.exceptionDetails, 'consumer observer installation failed');
  return {check() {
    for (const url of urls) assert([...pending.values()].some(item => item.begin.url === url &&
      item.binding), 'required consumer resource uncovered: ' + url);
    for (const item of pending.values()) assert(item.binding, 'consumer lacks exact Network identity');
  }, async close() {
    await session.send('Page.removeScriptToEvaluateOnNewDocument', {identifier}).catch(() => {});
    for (const context of contexts.values()) if (context.auxData?.isDefault)
      await session.send('Runtime.evaluate', {contextId: context.id,
        expression: `globalThis[${JSON.stringify(binding + '_restore')}]?.()`}).catch(() => {});
    for (const [name, fn] of listeners) session.off(name, fn);
    await session.send('Runtime.removeBinding', {name: binding}).catch(() => {});
    await session.send('Debugger.disable').catch(() => {});
  }};
}
module.exports = {observeConsumers};
