'use strict';
// Synthetic CDP transport lifecycle tests. HTTP bodies are real; no browser or
// guest execution is claimed. Never treat this transport as runtime evidence.
const assert = require('assert/strict');
const {EventEmitter} = require('events');
const fs = require('fs');
const path = require('path');
const {createHash} = require('crypto');
const {createCollector} = require('../tools/browser-response-body-collector.cjs');
const {startStaticServer, closeServer} = require('./static-server.js');
const DISCONNECT = Symbol('CDPSession.Disconnected');
const digest = b => createHash('sha256').update(b).digest('hex');
const tick = () => new Promise(resolve => setImmediate(resolve));
class Session extends EventEmitter {
  constructor(id) { super(); this.id = id; this.calls = []; this.bodies = new Map(); }
  async send(method, params) {
    this.calls.push({method, params});
    if (method === 'Fetch.getResponseBody') {
      const body = this.bodies.get(params.requestId);
      if (body instanceof Error) throw body;
      if (typeof body === 'function') return body();
      assert(body, 'body only available in this paused session');
      return {body: body.toString('base64'), base64Encoded: true};
    }
    if (method === 'Fetch.continueResponse') {
      assert(this.bodies.has(params.requestId), 'continue original request');
      this.bodies.delete(params.requestId);
    }
    return {};
  }
  pause(id, body, options = {}) {
    this.bodies.set(id, body);
    this.emit('Fetch.requestPaused', {requestId: id, networkId: 'network-' + id,
      request: {url: this.origin + '/index.html', method: 'GET', ...options.request},
      responseStatusCode: 200, ...options});
  }
}
async function main() {
  const server = await startStaticServer({root: path.resolve(__dirname, '..'), port: 0});
  const origin = 'http://127.0.0.1:' + server.address().port;
  const http = await fetch(origin + '/index.html');
  const body = Buffer.from(await http.arrayBuffer());
  assert.equal(http.status, 200);
  assert.deepEqual(body, fs.readFileSync(path.join(__dirname, '../index.html')));
  let passed = 0;
  async function run(name, execute, options = {}) {
    const rows = [], faults = [], received = [];
    const collector = createCollector({origin, disconnectedEvent: DISCONNECT,
      timeoutMs: 30, ...options, record: row => rows.push(row), onFault: row => faults.push(row),
      onResponse: async response => received.push({identity: response.bodyIdentity,
        body: response.status() === 200 ? await response.buffer() : null}), ...options});
    const s = new Session(name); s.origin = origin;
    try { await collector.attach(s, {sessionId: name, targetId: 'target-' + name});
      await execute({collector, s, rows, faults, received}); passed++;
    } finally { collector.close(); await collector.settle(); }
  }
  try {
    await run('capture-before-continue', async ({collector, s, received, rows}) => {
      s.pause('a', body); await collector.drain();
      assert.deepEqual(received[0].body, body);
      assert.equal(rows.find(r => r.state === 'captured').sha256, digest(body));
      assert(s.calls.findIndex(c => c.method === 'Fetch.getResponseBody') <
        s.calls.findIndex(c => c.method === 'Fetch.continueResponse'));
      assert(collector.snapshot().complete);
    });
    await run('same-url-out-of-order', async ({collector, s, received}) => {
      let release; s.pause('a', () => new Promise(resolve => {release = resolve;}));
      s.pause('b', Buffer.from('different bytes')); await tick();
      assert(!s.calls.some(c => c.method === 'Fetch.continueResponse' && c.params.requestId === 'a'));
      release({body: body.toString('base64'), base64Encoded: true}); await collector.drain();
      assert.deepEqual(received.map(r => r.identity.requestId), ['b', 'a']);
      assert.deepEqual(received[1].body, body);
    });
    await run('same-id-different-session', async ({collector, s, received}) => {
      const other = new Session('other'); other.origin = origin;
      await collector.attach(other, {sessionId: 'other', targetId: 'target-other'});
      s.pause('same', body); other.pause('same', Buffer.from('worker bytes'));
      await collector.drain(); assert.equal(received.length, 2);
      assert.equal(new Set(received.map(r => r.identity.sessionId)).size, 2);
      assert.notDeepEqual(received[0].body, received[1].body);
    });
    for (const [name, value] of [
      ['body-rejected', new Error('No data found for resource with given identifier')],
      ['body-timeout', () => new Promise(() => {})],
      ['malformed-body', () => ({body: 'not_base64', base64Encoded: true})],
      ['invalid-body-type', () => ({body: 123, base64Encoded: false})],
    ]) await run(name, async ({collector, s, faults, received}) => {
      s.pause('a', value); await assert.rejects(collector.drain());
      assert.equal(faults.length, 1); assert.equal(received.length, 0);
      assert(!collector.snapshot().complete);
      assert(!s.calls.some(c => c.method === 'Fetch.continueResponse'));
    });
    await run('detach-during-body', async ({collector, s, faults}) => {
      let release; s.pause('a', () => new Promise(resolve => {release = resolve;}));
      s.emit(DISCONNECT); await assert.rejects(collector.drain());
      assert.equal(faults.length, 1);
      release({body: body.toString('base64'), base64Encoded: true}); await tick();
      assert(!collector.snapshot().complete);
      assert(!s.calls.some(c => c.method === 'Fetch.continueResponse'));
    });
    await run('cancel-during-body', async ({collector, s, faults, received}) => {
      let release; s.pause('a', () => new Promise(resolve => {release = resolve;}));
      collector.close('owner close'); await collector.settle();
      release({body: body.toString('base64'), base64Encoded: true}); await tick();
      assert.equal(faults.length, 0); assert.equal(received.length, 0);
      assert.equal(collector.snapshot().responses[0].state, 'cancelled');
      assert(!collector.snapshot().complete);
      assert.equal(s.listenerCount('Fetch.requestPaused'), 0);
    });
    for (const [name, options] of [
      ['post', {request: {url: origin + '/index.html', method: 'POST'}}],
      ['redirect', {responseStatusCode: 302}],
      ['redirected-request', {redirectedRequestId: 'prior'}],
      ['response-error', {responseErrorReason: 'Failed'}],
      ['request-stage', {responseStatusCode: undefined}],
      ['wrong-origin', {request: {url: 'http://other.invalid/index.html', method: 'GET'}}],
    ]) await run(name, async ({collector, s, received, faults}) => {
      s.pause('a', body, options); await assert.rejects(collector.drain());
      assert.equal(faults.length, 1); assert.equal(received.length, 0);
      assert(!s.calls.some(c => c.method === 'Fetch.getResponseBody'));
    });
    await run('optional-404-has-no-body', async ({collector, s, received}) => {
      s.pause('a', body, {responseStatusCode: 404}); await collector.drain();
      assert.equal(received[0].body, null);
      assert(!s.calls.some(c => c.method === 'Fetch.getResponseBody'));
    });
    await run('continuation-error', async ({collector, s, faults}) => {
      const send = s.send.bind(s); s.send = (method, params) => method === 'Fetch.continueResponse'
        ? Promise.reject(Error('continuation rejected')) : send(method, params);
      s.pause('a', body); await assert.rejects(collector.drain());
      assert.equal(faults.length, 1); assert(!collector.snapshot().complete);
    });
    await run('detach-after-capture', async ({collector, s, faults}) => {
      s.pause('a', body); await collector.drain(); s.emit(DISCONNECT);
      assert.equal(faults.length, 0); assert(collector.snapshot().complete);
      assert(collector.snapshot().sessions[0].detached);
    });
    await run('duplicate-fetch-id', async ({collector, s, faults}) => {
      s.pause('a', body); await collector.drain(); s.pause('a', body);
      await assert.rejects(collector.drain()); assert.equal(faults.length, 1);
    });
    await run('network-failure-metadata', async ({collector, s, rows}) => {
      s.emit('Network.loadingFailed', {requestId: 'n', errorText: 'aborted', canceled: true});
      assert(rows.some(r => r.source === 'Network.loadingFailed' && r.networkId === 'n' && r.canceled));
      collector.close(); assert.equal(s.listenerCount('Network.loadingFailed'), 0);
    });
    await run('HTTP200-without-body-receipt', async ({collector, s, faults}) => {
      s.emit('Network.responseReceived', {requestId: 'missing', response: {url: origin + '/index.html', status: 200}});
      await assert.rejects(collector.drain());
      assert.equal(faults[0].state, 'missing-browser-body-receipt');
      assert.equal(collector.snapshot().missing[0].networkId, 'missing');
      assert(!collector.snapshot().complete);
    });
    await run('oversized-body', async ({collector, s, received}) => {
      s.pause('a', body); await assert.rejects(collector.drain()); assert.equal(received.length, 0);
    }, {maxBodyBytes: 1});
    await run('continuation-timeout', async ({collector, s}) => {
      const send = s.send.bind(s); s.send = (method, params) => method === 'Fetch.continueResponse'
        ? new Promise(() => {}) : send(method, params);
      s.pause('a', body); await assert.rejects(collector.drain()); assert(!collector.snapshot().complete);
    });
    await run('unicode-text-body', async ({collector, s, received}) => {
      s.pause('a', () => ({body: 'text with Ω', base64Encoded: false}));
      await collector.drain(); assert.deepEqual(received[0].body, Buffer.from('text with Ω'));
    });
    await run('HTTP200-matched-to-own-session', async ({collector, s}) => {
      s.emit('Network.responseReceived', {requestId: 'network-a', response: {url: origin + '/index.html', status: 200}});
      s.pause('a', body); await collector.drain(); assert(collector.snapshot().complete);
    });
    await run('HTTP200-cannot-borrow-other-session', async ({collector, s}) => {
      const other = new Session('other'); other.origin = origin;
      await collector.attach(other, {sessionId: 'other', targetId: 'target-other'});
      s.emit('Network.responseReceived', {requestId: 'network-a', response: {url: origin + '/index.html', status: 200}});
      other.pause('a', body); await assert.rejects(collector.drain());
      assert(!collector.snapshot().complete);
    });
    await run('transfer-failure-before-response', async ({collector, s, faults}) => {
      s.emit('Network.requestWillBeSent', {requestId: 'n', request: {url: origin + '/index.html', method: 'GET'}});
      s.emit('Network.loadingFailed', {requestId: 'n', errorText: 'aborted', canceled: true});
      await assert.rejects(collector.drain());
      assert.equal(faults[0].state, 'network-loading-failed'); assert(!collector.snapshot().complete);
    });
    // Chromium's classic-script 404 rejection is also called ERR_ABORTED. Only
    // an explicitly accepted absence with the entire owning response chain may
    // settle that notification; a URL or the error string alone proves nothing.
    const absence = response => ({optionalAbsence: response.bodyIdentity, policy: 'fixture-optional-absence'});
    async function script404({collector, s}, mode = 'positive') {
      const url = origin + '/build-info.js';
      const request = {requestId: 'network-a', type: 'Script', request: {url, method: 'GET'}};
      if (mode === 'network-post') request.request.method = 'POST';
      if (mode === 'request-url') request.request.url += '?different';
      if (mode === 'network-redirect') request.redirectResponse = {url: origin + '/earlier', status: 302};
      if (mode === 'request-type') request.type = 'Fetch';
      if (mode !== 'missing-request') s.emit('Network.requestWillBeSent', request);
      if (mode === 'reused-network-id') s.emit('Network.requestWillBeSent', request);
      const send = s.send.bind(s);
      const failed = {requestId: 'network-a', type: 'Script', errorText: 'net::ERR_ABORTED', canceled: true};
      if (mode === 'not-canceled') failed.canceled = false;
      if (mode === 'other-error') failed.errorText = 'net::ERR_CONNECTION_RESET';
      if (mode === 'failure-type') failed.type = 'Fetch';
      if (mode === 'missing-failure-type') delete failed.type;
      if (mode === 'blocked') failed.blockedReason = 'other';
      if (mode === 'cors-error') failed.corsErrorStatus = {corsError: 'InvalidResponse'};
      if (mode === 'continuation-rejected') s.send = (method, params) => method === 'Fetch.continueResponse'
        ? Promise.reject(Error('continuation rejected')) : send(method, params);
      if (mode === 'continuation-timeout') s.send = (method, params) => method === 'Fetch.continueResponse'
        ? new Promise(() => {}) : send(method, params);
      if (mode === 'before-continuation') s.send = (method, params) => {
        if (method === 'Fetch.continueResponse') s.emit('Network.loadingFailed', failed);
        return send(method, params);
      };
      if (mode === 'detach-continuation') s.send = (method, params) => {
        if (method === 'Fetch.continueResponse') s.emit(DISCONNECT);
        return send(method, params);
      };
      s.pause('a', body, {request: {url, method: mode === 'fetch-post' ? 'POST' : 'GET'},
        responseStatusCode: mode === 'required-200' ? 200 : 404,
        resourceType: mode === 'missing-fetch-type' ? undefined : mode === 'fetch-type' ? 'XHR' : 'Script',
        ...(mode === 'fetch-redirect' ? {redirectedRequestId: 'earlier'} : {})});
      await collector.settle();
      if (mode === 'duplicate-fetch-error') {
        s.pause('a', body, {request: {url, method: 'GET'}, responseStatusCode: undefined,
          resourceType: 'Script', responseErrorReason: 'Failed'});
        await collector.settle();
      }
      if (mode !== 'missing-response') s.emit('Network.responseReceived', {
        requestId: mode === 'wrong-network-id' ? 'other' : 'network-a',
        type: mode === 'response-type' ? 'Fetch' : 'Script',
        response: {url: mode === 'response-url' ? url + '?other' : url,
          status: mode === 'response-status' || mode === 'required-200' ? 200 : 404}});
      if (mode === 'duplicate-response') s.emit('Network.responseReceived', {
        requestId: 'network-a', type: 'Script', response: {url, status: 404}});
      if (mode === 'already-finished') s.emit('Network.loadingFinished', {requestId: 'network-a'});
      if (mode === 'detach-after-continue') s.emit(DISCONNECT);
      s.emit('Network.loadingFailed', failed);
    }
    await run('accepted-script404-status-rejection', async ctx => {
      await script404(ctx); await ctx.collector.drain();
      assert(ctx.collector.snapshot().complete);
      assert(ctx.rows.some(r => r.state === 'optional-absence-script-rejection'));
      assert(!ctx.s.calls.some(c => c.method === 'Fetch.getResponseBody'));
    }, {onResponse: absence});
    for (const mode of ['missing-ack', 'wrong-identity', 'missing-policy', 'missing-request',
      'missing-response', 'network-post', 'fetch-post', 'network-redirect', 'fetch-redirect',
      'reused-network-id', 'request-url', 'response-url', 'wrong-network-id', 'response-status',
      'request-type', 'fetch-type', 'response-type', 'failure-type', 'not-canceled', 'other-error',
      'required-200', 'continuation-rejected', 'before-continuation', 'detach-continuation', 'duplicate-fetch-error',
      'missing-fetch-type', 'missing-failure-type', 'blocked', 'cors-error', 'continuation-timeout',
      'duplicate-response', 'already-finished', 'detach-after-continue', 'async-ack']) {
      await run('script404-negative-' + mode, async ctx => {
        await script404(ctx, mode); await assert.rejects(ctx.collector.drain());
        assert.equal(ctx.faults.length, 1); assert(!ctx.collector.snapshot().complete);
        const first = JSON.stringify(ctx.faults[0]);
        assert(Object.isFrozen(ctx.faults[0]));
        ctx.s.emit('Network.loadingFailed', {requestId: 'network-a', errorText: 'later failure', canceled: true});
        assert.equal(JSON.stringify(ctx.collector.snapshot().firstFault), first);
      }, {onResponse: response => mode === 'async-ack' ? Promise.resolve(absence(response)) : mode === 'missing-ack' ? undefined : {
        optionalAbsence: mode === 'wrong-identity' ? {...response.bodyIdentity} : response.bodyIdentity,
        policy: mode === 'missing-policy' ? '' : 'fixture-optional-absence'}});
    }
    const protocolError = (message, code) => Object.assign(Error(message),
      {name: 'ProtocolError', originalMessage: message, ...(code === undefined ? {} : {code})});
    async function worker(ctx, options = {}) {
      const w = new Session('worker'); w.origin = origin;
      const send = w.send.bind(w);
      w.send = async (method, params) => {
        if (method === 'Fetch.enable') {
          w.calls.push({method, params});
          throw options.fetchError || protocolError("'Fetch.enable' wasn't found");
        }
        if (method === 'Network.getResponseBody') {
          w.calls.push({method, params});
          if (params.requestId === '__wine_body_capability_probe__')
            throw options.capabilityError || protocolError('No resource with given identifier found');
          const bytes = w.bodies.get(params.requestId);
          if (bytes instanceof Error) throw bytes;
          if (typeof bytes === 'function') return bytes();
          assert(Buffer.isBuffer(bytes), 'body must belong to this Worker request');
          return {body: bytes.toString('base64'), base64Encoded: true};
        }
        assert(!['Fetch.getResponseBody', 'Fetch.continueResponse'].includes(method), 'no Worker Fetch body channel');
        return send(method, params);
      };
      await ctx.collector.attach(w, {sessionId: 'worker', targetId: 'worker-target',
        type: 'worker', waitingForDebugger: true, url: origin + '/worker.js',
        parentSessionId: ctx.s.id, ...options.identity});
      w.request = (id, extra = {}) => w.emit('Network.requestWillBeSent', {requestId: id,
        type: 'Fetch', request: {url: origin + '/index.html', method: 'GET'}, ...extra});
      w.response = (id, extra = {}) => w.emit('Network.responseReceived', {requestId: id,
        type: 'Fetch', response: {url: origin + '/index.html', status: 200}, ...extra});
      return w;
    }
    await run('Worker-Network-terminal-before-body', async ctx => {
      const w = await worker(ctx); w.bodies.set('n', body); w.request('n'); w.response('n');
      assert(!ctx.collector.snapshot().complete);
      let settled = false; const draining = ctx.collector.drain().then(() => {settled = true;});
      await tick(); assert(!settled);
      assert(!w.calls.some(c => c.method === 'Network.getResponseBody' && c.params.requestId === 'n'));
      w.emit('Network.loadingFinished', {requestId: 'n'}); await draining;
      assert(ctx.collector.snapshot().complete); assert.deepEqual(ctx.received[0].body, body);
      assert.equal(ctx.received[0].identity.sessionId, 'worker');
      assert.equal(ctx.collector.snapshot().responses[0].state, 'collected');
    });
    for (const mode of ['missing-body', 'timeout', 'transfer-timeout', 'detach', 'wrong-session',
      'post', 'redirect', 'response-url', 'response-type', 'orphan', 'loading-failed', 'duplicate-response'])
      await run('Worker-Network-' + mode, async ctx => {
        const w = await worker(ctx);
        w.bodies.set('n', mode === 'missing-body' ? protocolError('No data found for resource with given identifier') :
          mode === 'timeout' ? () => new Promise(() => {}) : body);
        if (mode === 'wrong-session') {ctx.s.bodies.set('n', body); w.bodies.delete('n');}
        if (mode !== 'orphan') w.request('n', mode === 'post' ? {request: {url: origin + '/index.html', method: 'POST'}} : {});
        if (mode === 'redirect') w.request('n', {redirectResponse: {status: 302}});
        w.response('n', mode === 'response-url' ? {response: {url: origin + '/other', status: 200}} :
          mode === 'response-type' ? {type: 'Script'} : {});
        if (mode === 'duplicate-response') w.response('n');
        if (mode === 'detach') w.emit(DISCONNECT);
        if (mode === 'loading-failed') w.emit('Network.loadingFailed', {requestId: 'n', errorText: 'net::ERR_CONTENT_LENGTH_MISMATCH'});
        if (mode !== 'transfer-timeout') w.emit('Network.loadingFinished', {requestId: 'n'});
        await assert.rejects(ctx.collector.drain()); assert(!ctx.collector.snapshot().complete);
        assert.equal(ctx.received.length, 0); assert.equal(ctx.faults.length, 1);
        const first = JSON.stringify(ctx.faults[0]); w.emit(DISCONNECT);
        assert.equal(JSON.stringify(ctx.collector.snapshot().firstFault), first);
      });
    await run('Worker-Network-optional-script404', async ctx => {
      const w = await worker(ctx);
      w.request('n', {type: 'Script'}); w.response('n', {type: 'Script', response: {url: origin + '/index.html', status: 404}});
      w.emit('Network.loadingFailed', {requestId: 'n', type: 'Script', errorText: 'net::ERR_ABORTED', canceled: true});
      await ctx.collector.drain(); assert(ctx.collector.snapshot().complete);
      assert(!w.calls.some(c => c.method === 'Network.getResponseBody' && c.params.requestId === 'n'));
    }, {onResponse: absence});
    for (const mode of ['positive', 'missing-parent', 'wrong-parent', 'redirect-parent', 'post-parent',
      'unverified-parent', 'wrong-target', 'wrong-type', 'wrong-body']) await run('Worker-startup-' + mode, async ctx => {
      const url = origin + '/worker.js';
      if (mode !== 'missing-parent') ctx.s.emit('Network.requestWillBeSent', {requestId: 'worker-target', type: 'Script',
        request: {url, method: mode === 'post-parent' ? 'POST' : 'GET'},
        ...(mode === 'redirect-parent' ? {redirectResponse: {status: 302}} : {})});
      if (mode !== 'unverified-parent') {ctx.s.pause('parent', body, {networkId: 'worker-target', request: {url, method: 'GET'}}); await ctx.collector.drain();}
      const w = await worker(ctx, {identity: {parentSessionId: mode === 'wrong-parent' ? 'unknown' : ctx.s.id}});
      const id = mode === 'wrong-target' ? 'other' : 'worker-target';
      w.bodies.set(id, mode === 'wrong-body' ? Buffer.from('other script') : body);
      w.response(id, {type: mode === 'wrong-type' ? 'Fetch' : 'Script', response: {url, status: 200}});
      w.emit('Network.loadingFinished', {requestId: id});
      if (mode === 'positive') {await ctx.collector.drain(); assert(ctx.collector.snapshot().complete);
        assert.equal(ctx.received.at(-1).identity.sessionId, 'worker');
        assert.equal(ctx.received.at(-1).identity.startupBinding.sessionId, ctx.s.id);
        assert(Object.isFrozen(ctx.received.at(-1).identity.startupBinding));
      } else {await assert.rejects(ctx.collector.drain()); assert(!ctx.collector.snapshot().complete);}
    });
    for (const mode of ['unknown-fetch-error', 'fetch-denied', 'body-method-unavailable', 'body-probe-timeout', 'not-paused', 'page'])
      await run('Worker-capability-' + mode, async ctx => {
        const options = mode === 'unknown-fetch-error' ? {fetchError: Error("'Fetch.enable' wasn't found")} :
          mode === 'fetch-denied' ? {fetchError: protocolError('permission denied', -32000)} :
          mode === 'body-method-unavailable' ? {capabilityError: protocolError("'Network.getResponseBody' wasn't found", -32601)} :
          mode === 'body-probe-timeout' ? {capabilityError: Error('body-capability timeout')} :
          {identity: mode === 'page' ? {type: 'page'} : {waitingForDebugger: false}};
        await assert.rejects(worker(ctx, options)); assert(!ctx.collector.snapshot().complete);
        assert.equal(ctx.faults.length, 1);
      });
    // Audio worklets emit their own ordinary Script request/response/finish
    // chain. They may use the same exact capability check, but may never use
    // the dedicated Worker's special parent-bound startup identity.
    for (const mode of ['positive', 'missing-body', 'detach', 'cancel', 'orphan',
      'denied', 'not-paused', 'same-url']) await run('Worklet-Network-' + mode, async ctx => {
      const options = {identity: {type: 'worklet', ...(mode === 'not-paused' ? {waitingForDebugger: false} : {})},
        ...(mode === 'denied' ? {fetchError: protocolError('permission denied', -32000)} : {})};
      if (mode === 'denied' || mode === 'not-paused') {
        await assert.rejects(worker(ctx, options)); assert.equal(ctx.faults.length, 1); return;
      }
      const w = await worker(ctx, options);
      w.bodies.set('n', mode === 'missing-body' ? protocolError('No resource with given identifier found') :
        ['detach', 'cancel'].includes(mode) ? () => new Promise(() => {}) : body);
      if (mode !== 'orphan') w.request('n', {type: 'Script'});
      w.response('n', {type: 'Script'});
      w.emit('Network.loadingFinished', {requestId: 'n'});
      if (mode === 'same-url') {
        w.bodies.set('other', Buffer.from('distinct worklet response'));
        w.request('other', {type: 'Script'}); w.response('other', {type: 'Script'});
        w.emit('Network.loadingFinished', {requestId: 'other'});
      }
      await tick();
      if (mode === 'detach') w.emit(DISCONNECT);
      if (mode === 'cancel') ctx.collector.close('worklet cancellation');
      if (mode === 'positive' || mode === 'same-url') {
        await ctx.collector.drain(); assert(ctx.collector.snapshot().complete);
        assert(ctx.received.every(r => r.identity.type === 'worklet' && r.identity.startupBinding === null));
        assert.equal(ctx.received.length, mode === 'same-url' ? 2 : 1);
        if (mode === 'same-url') assert.notDeepEqual(ctx.received[0].body, ctx.received[1].body);
      } else {
        await assert.rejects(ctx.collector.drain()); assert(!ctx.collector.snapshot().complete);
        if (mode !== 'cancel') assert.equal(ctx.faults.length, 1);
        if (mode === 'missing-body') for (const key of ['url', 'method', 'status', 'requestId', 'targetId', 'sessionId'])
          assert.notEqual(ctx.faults[0][key], undefined, 'failed worklet body retains ' + key);
      }
    });
    console.log('PASS ' + passed + ' synthetic CDP lifecycle cases; real local FS/HTTP bytes; ZERO Chrome');
  } finally { server.closeIdleConnections?.(); await closeServer(server); }
}
module.exports = {Session, DISCONNECT};
if (require.main === module) {
  let complete = false;
  process.once('beforeExit', () => {if (!complete) {console.error('FAIL collector suite incomplete'); process.exitCode = 1;}});
  main().then(() => {complete = true;}, error => {complete = true; console.error(error); process.exitCode = 1;});
}
