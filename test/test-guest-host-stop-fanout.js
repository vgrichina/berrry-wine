'use strict';
// Actual exported Host and WorkerLink; only callbacks and inert transports are
// controlled. No Worker, guest memory, renderer or native code is instantiated.
const assert = require('node:assert/strict');
const {GuestThreadHost, WorkerLink} = require('../lib/guest-thread-host');
const tests = [];
const test = (name, run) => tests.push({name, run});
const outcome = p => Promise.resolve(p).then(value => ({value}), error => ({error}));
const contains = (error, expected) => error === expected || !!error?.errors?.some(e => contains(e, expected));
function fixture() {
  const host = new GuestThreadHost({hostImports: {}, clockIntervalMs: 0, localMainExports: () => ({})});
  const calls = [], nested = [];
  const hook = name => () => { calls.push(name); };
  host.hostImportsForSlot = () => { calls.push('imports'); return {beep_shutdown: hook('audio')}; };
  host.broker = {failPublications: hook('broker')};
  host._localLink._threadSendWaitRetire = hook('local');
  host._localSendWaits.retireLoaders = hook('loaders');
  host._localSendWaits.resumes.set(1, {}); host._localSendFrames.push({});
  host._nestedWaitActive = 1;
  host._clock = setInterval(() => {}, 1000); host._clock.unref();
  const clock = host._clock;
  function link(slot, options = {}) {
    const counts = {cpu: 0, render: 0, stop: 0}, sent = [];
    const link = new WorkerLink({slot, typedTiming: false, loaderRetireTimeout: 8});
    const worker = {postMessage(message) {
      sent.push(message);
      if (message.t === 'retireScopedLoaders') queueMicrotask(() => link._onMessage({
        t: 'retired', seq: message.seq, retired: true, endpointIdentity: link.endpointIdentity,
        dllCallbacksRetired: true, ...options.receipt?.(link)}));
    }, terminate() { counts.cpu++; return options.cpu?.(); }};
    link.worker = worker;
    link._renderLegacyEndpoint = {terminate() { counts.render++; return options.render?.(); }};
    const stop = link.stop;
    link.stop = function() { counts.stop++; return stop.call(this); };
    if (!slot) host.link = link; else host.threadLinks.set(slot, link);
    host.slotTid.set(slot, slot + 100);
    return {link, worker, counts, sent};
  }
  return {host, calls, nested, clock, link};
}
function cleaned(f) {
  assert.equal(f.host._stopped, true); assert.equal(f.host._localLink._stopped, true);
  assert.equal(f.clock._destroyed, true, 'real Node interval was cancelled');
  assert.equal(f.host._nestedWaitActive, 0); assert.equal(f.host._localSendFrames.length, 0);
  assert.equal(f.host._localSendWaits.resumes.size, 0);
}
function stopped(host) {
  let p; assert.doesNotThrow(() => { p = host.stop(); });
  assert(p instanceof Promise); return p;
}

for (const boundary of ['imports', 'audio', 'broker', 'local', 'loaders', 'resumes']) {
  test(`throwing ${boundary} drains siblings, clock and real link retirement`, async () => {
    const f = fixture(), boom = Error(boundary), a = f.link(0), b = f.link(1);
    const fail = () => { f.calls.push(boundary); throw boom; };
    if (boundary === 'imports') f.host.hostImportsForSlot = fail;
    if (boundary === 'audio') f.host.hostImportsForSlot = () => ({beep_shutdown: fail});
    if (boundary === 'broker') f.host.broker.failPublications = fail;
    if (boundary === 'local') f.host._localLink._threadSendWaitRetire = fail;
    if (boundary === 'loaders') f.host._localSendWaits.retireLoaders = fail;
    const clear = f.host._localSendWaits.resumes.clear.bind(f.host._localSendWaits.resumes);
    if (boundary === 'resumes') {
      f.host._localSendWaits.resumes.clear = fail;
    }
    const r = await outcome(stopped(f.host)); assert(contains(r.error, boom));
    if (boundary === 'loaders' || boundary === 'resumes') {
      assert.equal(f.host._localSendFrames.length, 1, 'incomplete cleanup retains frame ownership');
      assert.equal(f.host._localSendWaits.resumes.size, 1, 'incomplete cleanup retains resume graph');
      assert.equal(f.clock._destroyed, true);
      assert.equal((await outcome(f.host.stop())).error, boom, 'failed cleanup is retried');
      if (boundary === 'loaders') f.host._localSendWaits.retireLoaders = () => { f.calls.push('loaders'); };
      else f.host._localSendWaits.resumes.clear = clear;
      await f.host.stop();
      for (const once of ['imports', 'audio', 'broker', 'local'])
        assert.equal(f.calls.filter(call => call === once).length, 1, once + ' remains one-time');
      assert.equal(f.calls.filter(call => call === 'loaders').length, boundary === 'loaders' ? 3 : 1);
    }
    cleaned(f); assert.equal(a.counts.cpu, 1); assert.equal(b.counts.cpu, 1);
    assert.equal(a.counts.render, 1); assert.equal(b.counts.render, 1);
    const calls = f.calls.slice(); await f.host.stop(); assert.deepEqual(f.calls, calls);
    assert.equal(a.counts.stop, 1, 'completed link is removed from retry ownership');
  });
}

test('all hooks reenter cached promise with admission already fenced', async () => {
  const f = fixture(), a = f.link(0), admissions = [];
  const reenter = () => {
    assert.equal(f.host._stopped, true); assert.equal(f.host._localLink._stopped, true);
    f.nested.push(f.host.stop());
    admissions.push(outcome(f.host.start()), outcome(f.host.spawnThread({tid: 42})));
  };
  f.host.hostImportsForSlot = () => { reenter(); return {beep_shutdown: reenter}; };
  f.host.broker.failPublications = reenter;
  f.host._localLink._threadSendWaitRetire = reenter;
  f.host._localSendWaits.retireLoaders = reenter;
  const stop = stopped(f.host); assert.equal(f.nested.length, 5);
  for (const p of f.nested) assert.equal(p, stop);
  for (const p of admissions) assert.match((await p).error.message, /stopped/);
  await stop; cleaned(f); assert.equal(a.counts.cpu, 1); assert.equal(f.host.stop(), stop);
});

test('normal shutdown deduplicates main, starting, live and previously retained links', async () => {
  const f = fixture(), a = f.link(0), b = f.link(1), c = f.link(2);
  f.host._startingLinks.add(b.link); f.host._startingLinks.add(c.link);
  f.host._retirementLinks = new Set([a.link, c.link]);
  const p = stopped(f.host); assert.equal(f.host.stop(), p); await p; cleaned(f);
  assert.deepEqual(f.calls, ['imports', 'audio', 'broker', 'local', 'loaders']);
  for (const l of [a, b, c]) assert.deepEqual(l.counts, {cpu: 1, render: 1, stop: 1});
  assert.equal(f.host._retirementLinks, null); assert.equal(f.host.link, null);
  assert.equal(f.host.threadLinks.size, 0); assert.equal(f.host._startingLinks.size, 0);
  assert.equal(f.host.slotTid.size, 0);
});

test('combined callback, CPU and renderer failures stay observable through explicit retry', async () => {
  const f = fixture(), errors = ['audio', 'broker', 'local', 'cpu', 'render'].map(s => Error(s));
  let fail = true;
  f.host.hostImportsForSlot = () => ({beep_shutdown() { throw errors[0]; }});
  f.host.broker.failPublications = () => { throw errors[1]; };
  f.host._localLink._threadSendWaitRetire = () => { throw errors[2]; };
  const a = f.link(0, {cpu() { if (fail) return Promise.reject(errors[3]); }});
  const b = f.link(1, {render() { if (fail) return Promise.reject(errors[4]); }});
  const good = f.link(2);
  const first = stopped(f.host), r = await outcome(first);
  for (const error of errors) assert(contains(r.error, error), error.message);
  cleaned(f); assert.notEqual(a.link._retirementComplete, true); assert.notEqual(b.link._retirementComplete, true);
  assert.deepEqual(new Set(f.host._retirementLinks), new Set([a.link, b.link]));
  const second = stopped(f.host); assert.notEqual(second, first);
  const retry = await outcome(second); assert(contains(retry.error, errors[3])); assert(contains(retry.error, errors[4]));
  fail = false; await f.host.stop(); assert.equal(f.host._retirementLinks, null);
  assert.equal(good.counts.stop, 1); assert.equal(a.counts.render, 1); assert.equal(b.counts.cpu, 1);
  assert.equal(a.counts.cpu, 3); assert.equal(b.counts.render, 3);
});

for (const badReceipt of ['missing', 'identity', 'dll']) {
  test(`${badReceipt} scoped receipt retains genuine Worker owner until validated retry`, async () => {
    const f = fixture(); let valid = false;
    const a = f.link(0, {receipt(link) { return valid ? {} : badReceipt === 'missing'
      ? {retired: false} : badReceipt === 'identity' ? {endpointIdentity: link.endpointIdentity + 1}
      : {dllCallbacksRetired: false}; }}), b = f.link(1);
    a.link._scopedLoaderUsed = true; a.link._dllLifecycleUsed = true;
    const p = stopped(f.host), r = await outcome(p); assert(r.error);
    assert.equal(a.link.worker, a.worker);
    assert.equal(a.link._loaderRetirementReceipt, undefined);
    assert.deepEqual(a.counts, {cpu: 0, render: 0, stop: 1});
    assert.equal(b.counts.cpu, 1); assert.deepEqual([...f.host._retirementLinks], [a.link]);
    const failed = await outcome(f.host.stop()); assert(failed.error); assert.equal(a.counts.cpu, 0);
    valid = true; await f.host.stop(); assert.equal(a.counts.cpu, 1); assert.equal(a.counts.render, 1);
    assert.equal(a.link._retirementComplete, true); assert.equal(f.host._retirementLinks, null);
    assert.equal(b.counts.stop, 1); assert.equal(a.sent.length, 3);
  });
}

test('synchronous link.stop failure does not skip genuine siblings and stays owned', async () => {
  const f = fixture(), a = f.link(0), b = f.link(1), boom = Error('stop boundary');
  const original = a.link.stop; a.link.stop = () => { throw boom; };
  assert.equal((await outcome(stopped(f.host))).error, boom);
  assert.equal(b.counts.cpu, 1); assert.deepEqual([...f.host._retirementLinks], [a.link]);
  a.link.stop = original; await f.host.stop(); assert.equal(a.counts.cpu, 1); assert.equal(b.counts.stop, 1);
});

test('host waits for every physical result even when another link has already failed', async () => {
  const f = fixture(), boom = Error('CPU exit');
  let release;
  const physical = new Promise(resolve => { release = resolve; });
  const a = f.link(0, {cpu() { return Promise.reject(boom); }});
  const b = f.link(1, {render() { return physical; }});
  let settled = false;
  const result = outcome(stopped(f.host)).then(r => { settled = true; return r; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false); assert.equal(b.link._retirementComplete, undefined);
  assert.equal(b.counts.render, 1); release();
  assert(contains((await result).error, boom));
  assert.equal(b.link._retirementComplete, true);
  assert.deepEqual([...f.host._retirementLinks], [a.link]);
  a.link.worker.terminate = () => {}; await f.host.stop();
});

test('throwing and reentrant logger cannot orphan rejection or replay shutdown hooks', async () => {
  const f = fixture(), source = Error('audio'), logging = Error('logging'); f.link(0);
  f.host.hostImportsForSlot = () => ({beep_shutdown() { throw source; }});
  let nested, logs = 0;
  f.host.log = () => { logs++; nested = f.host.stop(); throw logging; };
  const stop = stopped(f.host), r = await outcome(stop);
  assert.equal(nested, stop); assert.equal(logs, 1); assert(contains(r.error, source)); assert(contains(r.error, logging));
  await f.host.stop(); cleaned(f); assert.equal(logs, 1);
});

(async () => {
  let failures = 0;
  for (const {name, run} of tests) {
    let timer;
    try {
      await Promise.race([run(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('case deadline')), 800);
      })]);
      console.log(`PASS ${name}`);
    } catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); }
    finally { clearTimeout(timer); }
  }
  console.log(`${tests.length - failures}/${tests.length} PASS`); process.exitCode = failures ? 1 : 0;
})();
