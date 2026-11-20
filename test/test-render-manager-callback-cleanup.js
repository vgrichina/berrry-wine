'use strict';
// Parent lifecycle only: actual exported Manager and createEndpoint(), no
// renderer implementation, native worker, WASM instance or graphics context.
const assert = require('node:assert/strict');
const {Manager} = require('../lib/render-worker');
const tests = [];
const test = (name, run) => tests.push({name, run});
const tick = () => new Promise(resolve => setImmediate(resolve));
function gate() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return {promise, resolve};
}
function fixture(options = {}) {
  const handlers = new Map(), sent = [];
  let terminations = 0, post;
  const worker = {
    on(type, fn) { handlers.set(type, fn); },
    postMessage(message) { sent.push(message); post?.(message); },
    terminate() { terminations++; return options.terminate?.(); }
  };
  const manager = new Manager({shutdownTimeoutMs: 25, ...options, workerFactory: () => worker});
  const emit = message => handlers.get('message')(message);
  return {manager, sent, emit, event: (type, value) => handlers.get(type)(value),
    count: () => terminations, post: fn => { post = fn; },
    port: () => manager.createEndpoint({api: 'legacy'})};
}
async function settled(promise) {
  let timer;
  try { return await Promise.race([Promise.resolve(promise).then(value => ({value}), error => ({error})),
    new Promise((_, reject) => { timer = setTimeout(() => reject(Error('test settlement deadline')), 150); })]); }
  finally { clearTimeout(timer); }
}
function contains(error, expected) {
  return error === expected || !!error?.errors?.some(item => contains(item, expected));
}
function empty(f) {
  assert.equal(f.manager.pending.size, 0);
  assert.equal(f.manager.closing.size, 0);
  assert.equal(f.manager.ports.size, 0);
  assert.equal(f.manager.queuedBytes, 0);
  assert.equal(f.count(), 1, 'owned physical transport terminated exactly once');
}

test('endpoint throw still closes and caches retirement before reentry', async () => {
  const f = fixture(), p = f.port(), boom = Error('endpoint subscriber');
  const request = p.request({t: 'query'});
  let nested, laterListener = 0;
  p.onerror = () => { nested = p.terminate(); throw boom; };
  p.addEventListener('error', () => { laterListener++; });
  let close;
  assert.doesNotThrow(() => { close = p.terminate(); });
  assert.equal(nested, close);
  assert.equal(p.terminate(), close);
  assert.equal(f.sent.filter(m => m.t === 'render-close').length, 1);
  f.emit({t: 'render-closed', endpointId: p.id});
  assert(contains((await settled(close)).error, boom));
  assert.match((await settled(request)).error.message, /closed/);
  assert.equal(laterListener, 1, 'one subscriber cannot suppress other subscribers');
  f.post(m => { if(m.t === 'render-stop') f.emit({t: 'render-stopped', heapHead: 0}); });
  await settled(f.manager.stop()); empty(f);
});

test('stop finally survives multiple throwing listeners and reentrant stop', async () => {
  const f = fixture(), a = f.port(), b = f.port(), boom = Error('stop subscriber');
  const requests = [a.request({}), b.request({})];
  let nested, noticed = 0;
  a.addEventListener('error', () => { nested = f.manager.stop(); throw boom; });
  b.addEventListener('error', () => { noticed++; });
  f.post(m => { if(m.t === 'render-stop') f.emit({t: 'render-stopped', heapHead: 0}); });
  const stop = f.manager.stop(), result = await settled(stop);
  assert.equal(nested, stop); assert(contains(result.error, boom));
  assert.equal(f.manager.stop(), stop); assert.equal(noticed, 1);
  for(const request of requests) assert((await settled(request)).error);
  empty(f);
});

for(const type of ['error', 'exit']) test(`${type} drains all endpoints despite listener/onError throws`, async () => {
  const source = Error('transport lost'), subscriber = Error('first subscriber'), observer = Error('onError');
  let notified = 0, nested;
  const f = fixture({onError(error) { notified++; assert.match(error.message, /transport lost|exited/); throw observer; }});
  const a = f.port(), b = f.port(), c = f.port();
  const requests = [a.request({}), b.request({})], closing = c.terminate();
  a.addEventListener('error', () => { nested = f.manager.stop(); throw subscriber; });
  let second = 0; b.addEventListener('error', () => { second++; });
  let thrown;
  try { f.event(type, source); } catch(error) { thrown = error; }
  assert(contains(thrown, subscriber)); assert(contains(thrown, observer));
  const stop = f.manager.stop(), result = await settled(stop);
  assert.equal(nested, stop); assert(result.error); assert.equal(notified, 1); assert.equal(second, 1);
  assert(contains(result.error, subscriber)); assert(contains(result.error, observer));
  for(const request of [...requests, closing]) assert((await settled(request)).error);
  empty(f);
});

test('synchronous stop post failure cannot reenter before cached promise', async () => {
  const source = Error('stop post failed'), boom = Error('post cleanup listener');
  const f = fixture(), p = f.port(); let nested;
  p.addEventListener('error', () => { nested = f.manager.stop(); throw boom; });
  f.post(m => { if(m.t === 'render-stop') throw source; });
  const stop = f.manager.stop(), result = await settled(stop);
  assert.equal(nested, stop); assert(contains(result.error, source)); assert(contains(result.error, boom)); empty(f);
});

test('synchronous close post failure waits for physical termination', async () => {
  const termination = gate(), source = Error('close post failed');
  const f = fixture({terminate: () => termination.promise}), p = f.port();
  f.post(m => { if(m.t === 'render-close') throw source; });
  let done = false;
  const close = p.terminate(); close.then(() => { done = true; }, () => { done = true; });
  await tick(); assert.equal(f.count(), 1); assert.equal(done, false);
  termination.resolve(); assert((await settled(close)).error); empty(f);
});

test('ordinary responses, accounting, repeated close and late events', async () => {
  const f = fixture(), p = f.port();
  f.emit({t: 'render-ready'}); f.emit({t: 'render-event', endpointId: p.id, message: {t: 'ready'}});
  assert.equal(await f.manager.ready, f.manager); assert.equal(await p.ready, p);
  const request = p.request({t: 'query'}), packet = f.sent.at(-1);
  f.emit({t: 'render-event', endpointId: p.id, message: {t: 'render-response', requestId: packet.message.requestId, value: 42}});
  assert.equal(await request, 42);
  f.emit({t: 'render-done', transportId: packet.transportId}); assert.equal(f.manager.queuedBytes, 0);
  const close = p.terminate(); assert.equal(p.terminate(), close);
  f.emit({t: 'render-closed', endpointId: p.id}); assert.deepEqual(await settled(close), {value: undefined});
  f.post(m => { if(m.t === 'render-stop') f.emit({t: 'render-stopped', heapHead: 0}); });
  assert.equal((await settled(f.manager.stop())).value.heapHead, 0); empty(f);
  f.emit({t: 'render-event', endpointId: p.id, message: {t: 'ready'}});
  f.emit({t: 'render-done', transportId: packet.transportId});
  f.emit({t: 'render-closed', endpointId: p.id}); empty(f);
});

for(const mode of ['throw', 'invalid', 'missing', 'hang', 'success']) test(`heap reclaim ${mode} retains ownership semantics`, async () => {
  const boom = Error('reclaim callback'), calls = [];
  const options = mode === 'missing' ? {} : {reclaimHeap(head) {
    calls.push(head);
    if(mode === 'throw') throw boom;
    if(mode === 'invalid') return -1;
    if(mode === 'hang') return new Promise(() => {});
    return 3;
  }};
  const f = fixture(options), p = f.port(), request = p.request({});
  f.post(m => { if(m.t === 'render-stop') f.emit({t: 'render-stopped', heapHead: 128}); });
  const result = await settled(f.manager.stop());
  if(mode === 'success') assert.equal(result.value.heapAdopted, 3);
  else { assert(result.error); if(mode === 'throw') assert(contains(result.error, boom)); }
  assert.deepEqual(calls, mode === 'missing' ? [] : [128]);
  assert((await settled(request)).error); empty(f);
});

test('close in progress is settled by ordinary manager stop', async () => {
  const f = fixture(), p = f.port(), close = p.terminate();
  f.post(m => { if(m.t === 'render-stop') f.emit({t: 'render-stopped', heapHead: 0}); });
  await f.manager.stop(); assert.deepEqual(await settled(close), {value: undefined}); empty(f);
});

test('failure starts physical retirement even without an explicit stop', async () => {
  const held = gate(), source = Error('owned transport error');
  const f = fixture({terminate: () => held.promise}), p = f.port(), close = p.terminate();
  const request = f.port().request({});
  f.event('error', source);
  let closed = false; close.catch(() => { closed = true; });
  await tick(); assert.equal(f.count(), 1); assert.equal(closed, false);
  assert.equal((await settled(request)).error, source);
  held.resolve(); assert(contains((await settled(close)).error, source)); empty(f);
  assert.throws(() => f.port(), /stopped/);
});

test('onError reentry and late errors cannot duplicate ownership cleanup', async () => {
  const source = Error('initial error'), observer = Error('observer failure');
  let calls = 0, nestedStop, nestedClose;
  const f = fixture({onError() {
    calls++; nestedStop = f.manager.stop(); nestedClose = p.terminate(); throw observer;
  }}), p = f.port();
  assert.throws(() => f.event('error', source), error => error === observer);
  const stop = f.manager.stop(); assert.equal(nestedStop, stop);
  assert(contains((await settled(stop)).error, source));
  assert(contains((await settled(nestedClose)).error, observer));
  f.event('error', Error('late error')); f.event('exit', 1);
  assert.equal(calls, 1); empty(f);
});

test('observation request and all ready promises reject on failure', async () => {
  const source = Error('observation transport lost'), f = fixture(), p = f.port();
  const request = p.producerObservation('snapshot');
  f.event('error', source);
  for(const promise of [request, p.ready, f.manager.ready]) assert.equal((await settled(promise)).error, source);
  assert(contains((await settled(f.manager.stop())).error, source)); empty(f);
});

test('synchronous request post failure preserves error and returns queue credit', async () => {
  const source = Error('request post failed'), f = fixture(), p = f.port();
  f.post(m => { if(m.t === 'render-message') throw source; });
  assert.equal((await settled(p.request({}))).error, source);
  assert.equal(p.requests.size, 0); assert.equal(f.manager.pending.size, 0); assert.equal(f.manager.queuedBytes, 0);
  f.post(m => { if(m.t === 'render-stop') f.emit({t: 'render-stopped', heapHead: 0}); });
  await f.manager.stop(); empty(f);
});

test('synchronous failure callback followed by post throw cannot double return credits', async () => {
  const source = Error('post and error event'), f = fixture(), p = f.port();
  f.post(m => { if(m.t === 'render-message') { f.event('error', source); throw source; } });
  assert.equal((await settled(p.request({}))).error, source);
  assert(contains((await settled(f.manager.stop())).error, source)); empty(f);
});

test('shutdown timeout rejects pending closes and ignores late heap acknowledgement', async () => {
  let reclaimed = 0;
  const f = fixture({reclaimHeap() { reclaimed++; return 1; }}), p = f.port(), close = p.terminate();
  const result = await settled(f.manager.stop()); assert.match(result.error.message, /timed out/);
  assert((await settled(close)).error); empty(f);
  f.emit({t: 'render-stopped', heapHead: 128});
  assert.equal(reclaimed, 0); assert.notEqual(f.manager._retired, true); empty(f);
});

test('reclaim reentry returns the stable stop promise without a self await', async () => {
  let nested;
  const f = fixture({reclaimHeap() { nested = f.manager.stop(); return nested; }});
  f.post(m => { if(m.t === 'render-stop') f.emit({t: 'render-stopped', heapHead: 128}); });
  const stop = f.manager.stop(), result = await settled(stop);
  assert.equal(nested, stop); assert.match(result.error.message, /own shutdown/); empty(f);
});

test('late reclaim completion cannot turn a timed out handoff into adoption', async () => {
  const held = gate(), response = {t: 'render-stopped', heapHead: 128};
  const f = fixture({reclaimHeap: () => held.promise});
  f.post(m => { if(m.t === 'render-stop') f.emit(response); });
  const stop = f.manager.stop(); assert.match((await settled(stop)).error.message, /timed out/); empty(f);
  held.resolve(4); await tick(); assert.equal(response.heapAdopted, undefined);
  assert.match((await settled(stop)).error.message, /timed out/); empty(f);
});

test('reclaim, subscriber and physical termination errors are all observable', async () => {
  const reclaim = Error('reclaim failed'), subscriber = Error('final subscriber'), termination = Error('physical termination failed');
  const f = fixture({reclaimHeap() { throw reclaim; }, terminate() { return Promise.reject(termination); }}), p = f.port();
  const close = p.terminate();
  f.port().onerror = () => { throw subscriber; };
  f.post(m => { if(m.t === 'render-stop') f.emit({t: 'render-stopped', heapHead: 128}); });
  const result = await settled(f.manager.stop());
  for(const error of [reclaim, subscriber, termination]) assert(contains(result.error, error));
  assert(contains((await settled(close)).error, termination)); empty(f);
});

for(const heapHead of [undefined, -1, 1.5, 0x100000000]) test(`invalid heap handoff ${heapHead} cannot certify retirement`, async () => {
  let calls = 0;
  const f = fixture({reclaimHeap() { calls++; return 1; }});
  f.post(m => { if(m.t === 'render-stop') f.emit({t: 'render-stopped', heapHead}); });
  assert.match((await settled(f.manager.stop())).error.message, /invalid.*handoff/);
  assert.equal(calls, 0); assert.notEqual(f.manager._retired, true); empty(f);
});

test('unsolicited retirement and duplicate acknowledgement do not adopt heaps', async () => {
  const heads = [], f = fixture({reclaimHeap(head) { heads.push(head); return 2; }});
  f.emit({t: 'render-stopped', heapHead: 999}); assert.notEqual(f.manager._retired, true);
  f.post(m => { if(m.t === 'render-stop') {
    f.emit({t: 'render-stopped', heapHead: 128}); f.emit({t: 'render-stopped', heapHead: 256});
  } });
  assert.equal((await settled(f.manager.stop())).value.heapAdopted, 2);
  assert.deepEqual(heads, [128]); empty(f);
});

test('endpoint error is observable and cannot create fresh orphan requests', async () => {
  const f = fixture(), p = f.port(), request = p.request({}), seen = [];
  p.addEventListener('error', error => seen.push(error.message));
  f.emit({t: 'render-event', endpointId: p.id, message: {t: 'error', error: 'endpoint failed'}});
  assert.match((await settled(request)).error.message, /endpoint failed/);
  assert.deepEqual(seen, ['endpoint failed']); assert(p.closed);
  assert.match((await settled(p.request({}))).error.message, /closed/);
  const close = p.terminate(); f.emit({t: 'render-closed', endpointId: p.id}); await close;
  f.post(m => { if(m.t === 'render-stop') f.emit({t: 'render-stopped', heapHead: 0}); });
  await f.manager.stop(); empty(f);
});

test('init post failure plus synchronous worker error terminates exactly once', async () => {
  const handlers = new Map(), source = Error('init post failure'); let terminated = 0;
  assert.throws(() => new Manager({workerFactory: () => ({
    on(type, fn) { handlers.set(type, fn); },
    postMessage() { handlers.get('error')(source); throw source; },
    terminate() { terminated++; }
  })}), error => error === source);
  await tick(); assert.equal(terminated, 1);
});

test('open post failure preserves its error and leaves no unreachable port', async () => {
  const source = Error('open post failed'), f = fixture();
  f.post(m => { if(m.t === 'render-open') throw source; });
  assert.throws(() => f.port(), error => error === source); assert.equal(f.manager.ports.size, 0);
  f.post(m => { if(m.t === 'render-stop') f.emit({t: 'render-stopped', heapHead: 0}); });
  await f.manager.stop(); empty(f);
});

test('transport termination throw is preserved alongside stop send failure', async () => {
  const send = Error('send failure'), termination = Error('termination threw');
  const f = fixture({terminate() { throw termination; }});
  f.post(m => { if(m.t === 'render-stop') throw send; });
  const result = await settled(f.manager.stop());
  assert(contains(result.error, send)); assert(contains(result.error, termination)); empty(f);
});

test('response errors and successful observation replies keep their ordinary meaning', async () => {
  const f = fixture(), p = f.port();
  const bad = p.request({}), first = f.sent.at(-1);
  f.emit({t: 'render-event', endpointId: p.id, message: {t: 'render-response', requestId: first.message.requestId, error: 'query rejected'}});
  assert.match((await settled(bad)).error.message, /query rejected/);
  const observed = p.producerObservation('snapshot'), second = f.sent.at(-1), receipt = {serial: 17};
  f.emit({t: 'render-event', endpointId: p.id, message: {t: 'legacy-producer-observation', requestId: second.message.requestId, receipt}});
  assert.equal(await observed, receipt); assert.equal(p.requests.size, 0);
  for(const packet of [first, second]) f.emit({t: 'render-done', transportId: packet.transportId});
  f.post(m => { if(m.t === 'render-stop') f.emit({t: 'render-stopped', heapHead: 0}); });
  await f.manager.stop(); empty(f);
});

(async () => {
  let failures = 0;
  for(const {name, run} of tests) {
    try { await run(); console.log('PASS ' + name); }
    catch(error) { failures++; console.error('FAIL ' + name + '\n' + error.stack); }
  }
  console.log(`${tests.length - failures}/${tests.length} PASS`);
  process.exitCode = failures ? 1 : 0;
})();
