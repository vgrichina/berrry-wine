'use strict';
// Real WorkerLink methods. Only transport, renderer and callback boundaries are
// controlled; no Worker is started and no guest/native/graphics code is run.
const assert = require('node:assert/strict');
const {WorkerLink} = require('../lib/guest-thread-host');
const tests = [];
const test = (name, run) => tests.push({name, run});
const tick = () => new Promise(resolve => setImmediate(resolve));
function gate() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
const contains = (error, expected) => error === expected || !!error?.errors?.some(e => contains(e, expected));
const result = p => Promise.resolve(p).then(value => ({value}), error => ({error}));
function fixture(options = {}) {
  let cpu = 0, render = 0;
  const sent = [], detached = [];
  const link = new WorkerLink({typedTiming: false, loaderRetireTimeout: 8,
    broker: {detachWriter(...args) { detached.push(args); options.detach?.(...args); }}});
  const worker = {postMessage(message) { sent.push(message); options.post?.(message, link); },
    terminate() { cpu++; return options.cpu?.(); }};
  link.worker = worker;
  link._renderLegacyEndpoint = {terminate() { render++; return options.render?.(); }};
  return {link, worker, sent, detached, cpu: () => cpu, render: () => render};
}
function pending(link, command = 'query') {
  return result(link._ask({t: command}, 150));
}
function reply(link, message, receipt = {}) {
  link._onMessage({t: 'retired', seq: message.seq, retired: true,
    endpointIdentity: link.endpointIdentity, dllCallbacksRetired: true, ...receipt});
}

test('throwing retirement subscriber cannot bypass stop or sibling settlement', async () => {
  const f = fixture(), boom = Error('subscriber');
  const request = pending(f.link); let later = 0;
  f.link.onRetiring(() => { throw boom; });
  f.link.onRetiring(() => { later++; });
  let stop;
  assert.doesNotThrow(() => { stop = f.link.stop(); });
  assert(contains((await result(stop)).error, boom));
  assert.equal(later, 1); assert((await request).error);
  assert.equal(f.link._pending.size, 0); assert.equal(f.cpu(), 1); assert.equal(f.render(), 1);
  assert.equal(f.link._retirementComplete, true, 'callback error does not negate physical exit');
  await f.link.stop(); assert.equal(later, 1); assert.equal(f.cpu(), 1); assert.equal(f.render(), 1);
});

test('controller, abort, listener reentry all see the cached stop promise', async () => {
  const f = fixture(), nested = [], flags = [];
  f.link.drakanController = {stop() { flags.push(f.link._stopping); nested.push(f.link.stop()); }};
  f.link._dllResourceRequests.set(1, {controller: {abort() { nested.push(f.link.stop()); }}});
  f.link.onRetiring(() => { nested.push(f.link.stop()); });
  const stop = f.link.stop();
  assert.equal(nested.length, 3); for (const p of nested) assert.equal(p, stop);
  assert.deepEqual(flags, [true]); await stop;
  assert.equal(f.cpu(), 1); assert.equal(f.render(), 1);
  assert.equal(f.link.stop(), stop); assert.equal(f.link._dllResourceRequests.size, 0);
});

test('all synchronous retirement boundaries drain despite independent throws', async () => {
  const f = fixture(), errors = ['controller', 'observation', 'abort', 'pending', 'listener'].map(s => Error(s));
  let aborted = 0, notified = 0;
  f.link.drakanController = {stop() { throw errors[0]; }};
  f.link.writerObservation = {invalidate() { throw errors[1]; }};
  f.link._dllResourceRequests.set(1, {controller: {abort() { throw errors[2]; }}});
  f.link._dllResourceRequests.set(2, {controller: {abort() { aborted++; }}});
  f.link._pending.set(1, {command: 'query', reject() { throw errors[3]; }});
  f.link.onRetiring(() => { throw errors[4]; });
  f.link.onRetiring(() => { notified++; });
  const stopped = await result(Promise.resolve().then(() => f.link.stop()));
  for (const error of errors) assert(contains(stopped.error, error), error.message);
  assert.equal(aborted, 1); assert.equal(notified, 1);
  assert.equal(f.link._pending.size, 0); assert.equal(f.link._dllResourceRequests.size, 0);
  assert.equal(f.cpu(), 1); assert.equal(f.render(), 1);
});

test('transport failure fans out original identity despite callback throws and reentry', async () => {
  const f = fixture(), source = Error('transport'), subscriber = Error('subscriber'), broker = Error('broker');
  const requests = [pending(f.link), pending(f.link, 'retireScopedLoaders')];
  const ready = gate(); f.link._readyPromise = {reject: ready.reject};
  const readiness = result(ready.promise); let nested, later = 0;
  f.link.broker.failPublications = () => { throw broker; };
  f.link.onRetiring(() => { nested = f.link.stop(); throw subscriber; });
  f.link.onRetiring(() => { later++; });
  let thrown; try { f.link._transportFailed(source); } catch (error) { thrown = error; }
  assert(contains(thrown, subscriber)); assert(contains(thrown, broker)); assert(contains(thrown, source));
  for (const request of [...requests, readiness]) assert.equal((await request).error, source);
  assert.equal(f.link._pending.size, 0); assert.equal(f.link._readyPromise, null); assert.equal(later, 1);
  assert.equal((await result(f.link._ask({t: 'query'}))).error, source);
  assert(contains((await result(nested)).error, subscriber));
  assert.equal(f.cpu(), 1); assert.equal(f.render(), 1);
});

test('transport failure without callback faults preserves source for every request', async () => {
  const f = fixture(), source = Error('transport');
  const requests = [pending(f.link), pending(f.link, 'retireScopedLoaders')];
  f.link._transportFailed(source);
  for (const p of requests) assert.equal((await p).error, source);
  assert.equal(f.cpu(), 0, 'failure is not a retirement acknowledgement');
  await f.link.stop(); assert.equal(f.cpu(), 1);
});

for (const mode of ['missing', 'mismatch', 'notification', 'timeout', 'transport'])
test(`${mode} retirement evidence retains owner despite listener fault, then retries`, async () => {
  let valid = false;
  const f = fixture({post(message, link) {
    if (message.t !== 'retireScopedLoaders') return;
    if (!valid && mode === 'timeout') return;
    const receipt = valid ? {} : mode === 'missing' ? {retired: false} :
      mode === 'mismatch' ? {endpointIdentity: link.endpointIdentity + 1} :
      mode === 'notification' ? {dllCallbacksRetired: false} : {};
    reply(link, message, receipt);
  }});
  f.link._scopedLoaderUsed = true; f.link._notificationUsed = true;
  const boom = Error('listener'); f.link.onRetiring(() => { throw boom; });
  const source = Error('dead transport');
  if (mode === 'transport') f.link._transportFailure = source;
  const failed = await result(Promise.resolve().then(() => f.link.stop()));
  assert(contains(failed.error, boom));
  if (mode === 'transport') assert(contains(failed.error, source));
  const attempts = f.sent.filter(m => m.t === 'retireScopedLoaders');
  assert.equal(attempts.length, mode === 'transport' ? 0 : mode === 'timeout' ? 2 : 1,
    'subscriber failures cannot bypass the legitimate retirement protocol');
  if (mode !== 'transport') {
    const expected = mode === 'timeout' ? /did not answer/ : mode === 'notification' ? /not acknowledged/ : /identity mismatch/;
    const matches = error => expected.test(error?.message || '') || error?.errors?.some(matches);
    assert(matches(failed.error), 'retain protocol failure alongside subscriber identity');
  }
  assert.equal(f.link.worker, f.worker); assert.equal(f.cpu(), 0); assert.equal(f.render(), 0);
  assert(!f.link._loaderRetirementReceipt); assert(!f.link._retirementComplete);
  assert.equal(f.link._stopPromise, null); assert.equal(f.link._pending.size, 0);
  valid = true; f.link._transportFailure = null; // controlled repaired transport boundary
  await f.link.stop();
  assert.equal(f.cpu(), 1); assert.equal(f.render(), 1); assert(f.link._retirementComplete);
});

for (const kind of ['cpu', 'render', 'both'])
test(`${kind} termination failure waits for both owners and permits retry`, async () => {
  const cpu = gate(), render = gate(), a = Error('cpu exit'), b = Error('renderer exit');
  let retry = false;
  const f = fixture({cpu: () => retry ? undefined : cpu.promise,
    render: () => retry ? undefined : render.promise});
  let done = false; const stop = result(f.link.stop()).then(r => { done = true; return r; });
  await tick(); assert.equal(f.cpu(), 1); assert.equal(f.render(), 1);
  if (kind === 'render') cpu.resolve(); else cpu.reject(a);
  await tick(); assert.equal(done, false); assert(!f.link._retirementComplete);
  if (kind === 'cpu') render.resolve(); else render.reject(b);
  const failure = (await stop).error;
  if (kind !== 'render') assert(contains(failure, a));
  if (kind !== 'cpu') assert(contains(failure, b));
  assert(!f.link._retirementComplete); assert.equal(f.link._stopPromise, null);
  assert.equal(f.detached.filter(args => args[2] === true).length, 0,
    'neither failed physical owner may certify shared writer quiescence');
  retry = true; await f.link.stop(); assert(f.link._retirementComplete);
  assert.equal(f.cpu(), kind === 'render' ? 1 : 2);
  assert.equal(f.render(), kind === 'cpu' ? 1 : 2);
  assert.equal(f.detached.filter(args => args[2] === true).length, 1);
});

test('throwing observation invalidation cannot orphan real pending promises', async () => {
  const f = fixture(), boom = Error('invalidate'), source = Error('transport');
  // _ask captures its observer at admission. Arm throwing invalidation only
  // after issuing the real requests, without inventing pending settlement.
  const observer = new (require('../lib/render-worker').WriterEpoch)();
  f.link.writerObservation = observer;
  const requests = [pending(f.link), pending(f.link)];
  const invalidate = observer.invalidate;
  observer.invalidate = () => { throw boom; };
  let thrown;
  try { f.link._transportFailed(source); } catch (error) { thrown = error; }
  finally { observer.invalidate = invalidate; }
  assert(contains(thrown, boom));
  for (const request of requests) assert.equal((await request).error, source);
  assert.equal(f.link._pending.size, 0);
  assert(contains((await result(f.link.stop())).error, boom));
  assert.equal(f.cpu(), 1); assert.equal(f.render(), 1);
});

test('transport broker reentry and repeated faults keep first error and single fanout', async () => {
  const f = fixture(), first = Error('first transport'), late = Error('late transport');
  let broker = 0, listener = 0;
  const request = pending(f.link);
  f.link.broker.failPublications = () => { broker++; f.link._transportFailed(late); };
  f.link.onRetiring(() => { listener++; });
  f.link._transportFailed(first); f.link._transportFailed(late);
  assert.equal((await request).error, first); assert.equal(f.link._transportFailure, first);
  await f.link.stop(); f.link._transportFailed(late);
  assert.equal(broker, 1); assert.equal(listener, 1); assert.equal(f.cpu(), 1);
});

test('throwing retirement logger reenters cached stop and preserves both errors', async () => {
  const f = fixture(), boom = Error('subscriber'), logging = Error('logging');
  let nested;
  f.link.onRetiring(() => { throw boom; });
  f.link.log = () => { nested = f.link.stop(); throw logging; };
  const stopping = f.link.stop(), failure = (await result(stopping)).error;
  assert.equal(nested, stopping); assert(contains(failure, boom)); assert(contains(failure, logging));
  await f.link.stop(); assert.equal(f.cpu(), 1); assert.equal(f.render(), 1);
});

test('renderer chain rejection still attempts endpoint retirement', async () => {
  const f = fixture();
  f.link._renderLegacyChain = Promise.reject(Error('earlier render command'));
  await f.link.stop(); assert.equal(f.cpu(), 1); assert.equal(f.render(), 1);
  assert(f.link._retirementComplete);
});

test('lost first receipt retries same identity through actual request correlation', async () => {
  let attempts = 0;
  const f = fixture({post(m, link) {
    if (m.t === 'retireScopedLoaders' && ++attempts === 2) reply(link, m);
  }});
  f.link._scopedLoaderUsed = true;
  await f.link.stop(); assert.equal(attempts, 2);
  const messages = f.sent.filter(m => m.t === 'retireScopedLoaders');
  assert(messages.every(m => m.endpointIdentity === f.link.endpointIdentity));
  assert.notEqual(messages[0].seq, messages[1].seq); assert.equal(f.link._pending.size, 0);
  assert.equal(f.cpu(), 1); assert.equal(f.render(), 1);
});

test('late old physical exit cannot clear replacement worker reference', async () => {
  const exit = gate(), f = fixture({cpu: () => exit.promise});
  const stopping = f.link.stop(); await tick();
  const replacement = {}; f.link.worker = replacement;
  exit.resolve(); await stopping; assert.equal(f.link.worker, replacement);
  assert.equal(f.detached.filter(args => args[2] === true)[0][1], f.worker);
});

test('renderer retry retains old CPU identity when a replacement is present', async () => {
  let fail = true;
  const f = fixture({render() { if (fail) throw Error('renderer exit'); }});
  assert((await result(f.link.stop())).error);
  const replacement = {terminate() { throw Error('replacement must survive'); }};
  f.link.worker = replacement; fail = false;
  await f.link.stop(); assert.equal(f.link.worker, replacement); assert.equal(f.cpu(), 1);
  assert(f.detached.every(args => args[1] === f.worker), 'broker never sees wildcard/replacement owner');
});

test('physical retry reuses validated loader receipt without inventing another acknowledgement', async () => {
  let fail = true;
  const f = fixture({cpu() { if (fail) throw Error('CPU exit'); },
    post(m, link) { if (m.t === 'retireScopedLoaders') reply(link, m); }});
  f.link._scopedLoaderUsed = true;
  assert((await result(f.link.stop())).error);
  const receipt = f.link._loaderRetirementReceipt;
  fail = false; await f.link.stop();
  assert.equal(f.link._loaderRetirementReceipt, receipt);
  assert.equal(f.sent.filter(m => m.t === 'retireScopedLoaders').length, 1);
  assert.equal(f.cpu(), 2); assert.equal(f.render(), 1);
});

test('actual start readiness rejection settles even when its observer throws', async () => {
  const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
  const {EventEmitter} = require('node:events'), {createRequire} = require('node:module');
  let terminations = 0;
  class Transport extends EventEmitter {
    postMessage() {}
    terminate() { terminations++; }
  }
  const file = path.resolve(__dirname, '../lib/guest-thread-host.js'), realRequire = createRequire(file);
  const context = {console, process, Error, module: {exports: {}}, setTimeout, clearTimeout,
    require: name => name === 'worker_threads' ? {Worker: Transport} : realRequire(name)};
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, {filename: file});
  const observer = new (require('../lib/render-worker').WriterEpoch)();
  const link = new context.module.exports.WorkerLink({typedTiming: false, writerObservation: observer});
  const readiness = result(link.start()), source = Error('transport'), boom = Error('ready observer');
  const invalidate = observer.invalidate;
  observer.invalidate = () => { throw boom; };
  let thrown; try { link._transportFailed(source); } catch (error) { thrown = error; }
  const retainedReadiness = link._readyPromise;
  // Clear a broken baseline's real readiness timer before reporting failure.
  if (retainedReadiness) {
    observer.invalidate = invalidate; retainedReadiness.reject(source);
  }
  assert(contains(thrown, boom)); assert.equal(retainedReadiness, null);
  assert.equal((await readiness).error, source);
  assert(contains((await result(link.stop())).error, boom)); assert.equal(terminations, 1);
});

test('actual Manager endpoint rejection cannot certify WorkerLink quiescence', async () => {
  const {Manager} = require('../lib/render-worker');
  const handlers = new Map(), boom = Error('endpoint subscriber');
  const transport = {on(t, fn) { handlers.set(t, fn); }, terminate() {}, postMessage(m) {
    if (m.t === 'render-close') handlers.get('message')({t: 'render-closed', endpointId: m.endpointId});
    if (m.t === 'render-stop') handlers.get('message')({t: 'render-stopped', heapHead: 0});
  }};
  const manager = new Manager({workerFactory: () => transport, shutdownTimeoutMs: 20});
  const endpoint = manager.createEndpoint({api: 'legacy'}), f = fixture();
  endpoint.addEventListener('error', () => { throw boom; });
  f.link._renderLegacyEndpoint = endpoint;
  assert(contains((await result(f.link.stop())).error, boom));
  assert.equal(f.cpu(), 1); assert(!f.link._retirementComplete);
  assert.equal(f.detached.filter(args => args[2] === true).length, 0);
  // Endpoint intentionally caches this rejection. WorkerLink cannot infer a
  // physical retirement receipt from its closed flag or suppress the error.
  assert(contains((await result(f.link.stop())).error, boom));
  assert(!f.link._retirementComplete); assert.equal(f.cpu(), 1);
  await manager.stop();
});

test('broker and wait cleanup throws cannot suppress either physical termination', async () => {
  const a = Error('detach'), b = Error('wait cleanup');
  const f = fixture({detach(slot, worker, terminated) { if (!terminated) throw a; }});
  f.link._threadSendWaitRetire = () => { throw b; };
  const failure = (await result(Promise.resolve().then(() => f.link.stop()))).error;
  assert(contains(failure, a)); assert(contains(failure, b));
  assert.equal(f.cpu(), 1); assert.equal(f.render(), 1);
});

test('normal receipt is correlated, physical exit gates completion, late ingress ignored', async () => {
  const cpu = gate(), render = gate();
  const f = fixture({cpu: () => cpu.promise, render: () => render.promise,
    post: (m, link) => { if (m.t === 'retireScopedLoaders') reply(link, m); }});
  f.link._dllLifecycleUsed = true;
  const request = pending(f.link); let notified = 0;
  f.link.onRetiring(() => { notified++; });
  const stop = f.link.stop(); assert.equal(f.link.stop(), stop);
  await tick(); assert.equal(f.sent.filter(m => m.t === 'retireScopedLoaders').length, 1);
  assert.equal(f.link._loaderRetirementReceipt.endpointIdentity, f.link.endpointIdentity);
  assert((await request).error); cpu.resolve(); await tick(); assert(!f.link._retirementComplete);
  render.resolve(); await stop; assert(f.link._retirementComplete);
  f.link.onRetiring(() => { notified++; }); assert.equal(notified, 2);
  f.link._onMessage({t: 'dllMapped', record: {}});
  assert.equal(f.link.stop(), stop); assert.equal(f.cpu(), 1); assert.equal(f.render(), 1);
});

(async () => {
  let failures = 0;
  for (const {name, run} of tests) {
    let timer;
    try {
      await Promise.race([Promise.resolve().then(run), new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('case settlement deadline')), 500);
      })]);
      console.log(`PASS ${name}`);
    }
    catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); }
    finally { clearTimeout(timer); }
  }
  console.log(`${tests.length - failures}/${tests.length} passed`);
  if (failures) process.exitCode = 1;
})();
