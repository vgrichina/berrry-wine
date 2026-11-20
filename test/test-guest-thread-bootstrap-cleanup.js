'use strict';
// Actual Host/WorkerLink methods, with an inert worker_threads transport only.
// No Worker, CPU, renderer, guest, memory or native engine is instantiated.
const assert = require('node:assert/strict');
const threads = require('node:worker_threads');
const originalWorker = threads.Worker;
let active;
class Transport {
  constructor() { this.f = active; this.handlers = new Map(); this.sent = []; this.exits = 0; active.transports.push(this); }
  on(name, fn) { this.handlers.set(name, fn); }
  emit(message) { this.handlers.get('message')(message); }
  postMessage(message) {
    this.sent.push(message);
    const f = this.f, link = [...f.host._startingLinks][0] || f.link;
    if (message.t === 'init') {
      f.link = link; link._loaderRetireTimeout = 8;
      link._renderLegacyEndpoint = {terminate() { f.renderExits++; return f.render?.(); }};
      if (f.phase === 'ready') queueMicrotask(() => {
        link._readyPromise.reject(f.source); link._readyPromise = null;
      });
      else queueMicrotask(() => this.emit({t: 'ready', exports: 0, imports: 0}));
    }
    if (message.t === 'initGuestThread') {
      if (f.holdInit) { f.initMessage = message; return; }
      queueMicrotask(() => this.emit({t: 'threadReady', seq: message.seq, ...f.registers}));
    }
    if (message.t === 'retireScopedLoaders') {
      if (f.receipt === 'timeout') return;
      queueMicrotask(() => this.emit({t: 'retired', seq: message.seq,
        retired: f.receipt !== 'missing',
        endpointIdentity: message.endpointIdentity + (f.receipt === 'identity' ? 1 : 0),
        dllCallbacksRetired: f.receipt !== 'dll'}));
    }
  }
  terminate() { this.exits++; return this.f.cpu?.(); }
}
threads.Worker = Transport;
const {GuestThreadHost, WorkerLink} = require('../lib/guest-thread-host');
const tests = [], test = (name, run) => tests.push({name, run});
const turn = () => new Promise(resolve => setImmediate(resolve));
const result = p => Promise.resolve(p).then(value => ({ok: true, value}), error => ({ok: false, error}));
const contains = (e, wanted) => e === wanted || !!e?.errors?.some(x => contains(x, wanted));
function fixture(options = {}) {
  const f = {transports: [], renderExits: 0, logs: [], phase: 'log',
    registers: {eip: 4096, esp: 8192, stackBase: 4096, stackMapped: 4096,
      stackTop: 8192, inheritedWasmSetters: ['eax']}, ...options};
  f.host = new GuestThreadHost({clockIntervalMs: 0, log(message) {
    f.logs.push(message);
    if (f.phase === 'log' && message.includes('guest thread tid=')) throw f.source;
    f.log?.(message);
  }});
  f.host.broker = {watchWriter() {
    if (f.phase === 'watch') { f.link = [...f.host._startingLinks][0]; throw f.source; }
  }, detachWriter() {}, failPublications() {}};
  active = f;
  f.spawn = () => result(f.host.spawnThread({tid: 7}));
  return f;
}
function annotated(r, source, link) {
  assert.equal(r.ok, false);
  assert(r.error?.workerLink === link, 'failed spawn exposes its actual link');
  if (r.error !== source) assert.equal(r.error.cause, source, 'wrapper retains exact rejection value');
}
function retired(f) {
  assert(f.link instanceof WorkerLink); assert.equal(f.link._retirementComplete, true);
  assert.equal(f.transports[0].exits, 1); assert.equal(f.renderExits, f.phase === 'watch' ? 0 : 1);
  assert.equal(f.host.threadLinks.size, 0); assert.equal(f.host._startingLinks.size, 0);
  assert.equal(f.host.slotTid.size, 0); assert(!f.host._retirementLinks?.has(f.link));
}
// A failing baseline must leave no test-owned timers or inert owners behind.
async function using(options, run) {
  const f = fixture(options);
  try { await run(f); }
  finally {
    f.receipt = 'valid'; f.cpu = null; f.render = null; f.log = null;
    f.host.log = () => {}; if (f.link) f.link.log = () => {};
    // A reentrant logger may already have started a failing stop attempt.
    // Join it before a genuine retry through the repaired inert boundary.
    await result(f.host.stop());
    await f.host.stop();
    await turn();
  }
}
for (const phase of ['watch', 'ready', 'log']) {
  for (const [name, source] of [['null', null], ['undefined', undefined], ['string', 'bootstrap'],
    ['number', 0], ['boolean', false], ['symbol', Symbol('bootstrap')], ['bigint', 1n],
    ['frozen Error', Object.freeze(Error('frozen'))], ['sealed object', Object.seal({why: 1})],
    ['mutable Error', Error('mutable')], ['mutable object', {why: 2}]]) {
    test(`${phase}: ${name} failure always retires actual link`, () => using({phase, source}, async f => {
      const r = await f.spawn(); annotated(r, source, f.link); retired(f);
      if (name.startsWith('mutable')) assert.equal(r.error, source);
    }));
  }
}

test('nonconfigurable metadata cannot hide the actual failed owner', () => {
  const source = Error('existing metadata');
  Object.defineProperty(source, 'workerLink', {value: 'foreign'});
  return using({source}, async f => { annotated(await f.spawn(), source, f.link); retired(f); });
});

test('annotation bypasses throwing and reentrant setters after cleanup', () => {
  const source = Error('setter'); let calls = 0;
  Object.defineProperty(source, 'workerLink', {configurable: true, set() { calls++; throw Error('setter invoked'); }});
  return using({source}, async f => {
    const r = await f.spawn(); annotated(r, source, f.link); retired(f);
    assert.equal(r.error, source); assert.equal(calls, 0);
  });
});

test('rejected annotation trap is contained after genuine cleanup', () => {
  const source = new Proxy(Error('proxy'), {defineProperty() { throw Error('annotation trap'); }});
  return using({source}, async f => { annotated(await f.spawn(), source, f.link); retired(f); });
});

test('rejection objects are never coerced to produce bootstrap diagnostics', () => {
  const source = Object.freeze({[Symbol.toPrimitive]() { throw Error('coercion'); }});
  return using({source}, async f => { annotated(await f.spawn(), source, f.link); retired(f); });
});

test('unannotatable retirementError field wraps original while retaining both owners', () => {
  const source = Error('bootstrap'), cpu = Error('CPU');
  Object.defineProperty(source, 'retirementError', {value: 'foreign'});
  return using({source, cpu: () => Promise.reject(cpu)}, async f => {
    const r = await f.spawn(); annotated(r, source, f.link);
    assert.notEqual(r.error, source); assert(contains(r.error.retirementError, cpu));
    assert(f.host._retirementLinks.has(f.link)); f.cpu = null; await f.host.dropThread(f.link);
  });
});

for (const receipt of ['missing', 'identity', 'dll', 'timeout']) {
  test(`${receipt} receipt retains ownership and exposes retirement failure, then actual retry succeeds`, () =>
    using({source: null, receipt}, async f => {
      const r = await f.spawn(); annotated(r, null, f.link); assert(r.error.retirementError);
      assert.equal(f.link.worker, f.transports[0]); assert(!f.link._loaderRetirementReceipt);
      assert(!f.link._retirementComplete); assert.equal(f.transports[0].exits, 0); assert.equal(f.renderExits, 0);
      assert.equal(f.host.threadLinks.get(f.link.slot), f.link);
      assert(f.host._retirementLinks.has(f.link)); assert.equal(f.host.slotTid.get(f.link.slot), 7);
      const retry = await result(f.host.dropThread(f.link)); assert.equal(retry.ok, false);
      assert.equal(f.transports[0].exits, 0);
      f.receipt = 'valid'; await f.host.dropThread(f.link); retired(f);
      assert.equal(f.link._loaderRetirementReceipt.endpointIdentity, f.link.endpointIdentity);
      assert.equal(f.link._pending.size, 0);
      const requests = f.transports[0].sent.filter(m => m.t === 'retireScopedLoaders');
      assert.equal(requests.length, receipt === 'timeout' ? 5 : 3);
      assert(requests.every(m => m.endpointIdentity === f.link.endpointIdentity));
      assert.equal(new Set(requests.map(m => m.seq)).size, requests.length);
    }));
}

for (const source of [Error('mutable'), Object.freeze(Error('frozen')), null]) {
  test(`physical CPU/render faults remain visible with ${source === null ? 'null' : source.message} bootstrap reason`, () => {
    const cpu = Error('CPU boundary'), render = Error('render boundary');
    return using({source, cpu: () => Promise.reject(cpu), render: () => Promise.reject(render)}, async f => {
      const r = await f.spawn(); annotated(r, source, f.link);
      assert(contains(r.error.retirementError, cpu)); assert(contains(r.error.retirementError, render));
      if (source && !Object.isFrozen(source)) assert.equal(r.error, source);
      assert(f.host._retirementLinks.has(f.link)); assert(!f.link._retirementComplete);
      f.cpu = null; f.render = null; await f.host.dropThread(f.link);
      assert.equal(f.link._retirementComplete, true); assert.equal(f.transports[0].exits, 2); assert.equal(f.renderExits, 2);
    });
  });
}

test('synchronous throwing/reentrant retirement logger has no orphan rejection', () => {
  const source = Error('bootstrap'), cpu = Error('CPU boundary'), logging = Error('logger');
  let reentrant, calls = 0;
  return using({source, cpu: () => Promise.reject(cpu)}, async f => {
    f.host.log = message => {
      if (message.includes('guest thread tid=')) throw source;
      if (message.includes('retirement retained')) { calls++; reentrant = result(f.host.stop()); throw logging; }
    };
    const r = await f.spawn(); annotated(r, source, f.link);
    assert.equal(r.error, source); assert(contains(r.error.retirementError, cpu));
    assert(contains(r.error.retirementError, logging)); assert.equal(calls, 1);
    assert.equal((await reentrant).ok, false);
    f.cpu = null; f.host.log = () => {}; await f.host.stop();
    assert.equal(f.link._retirementComplete, true);
  });
});

test('stop during pending bootstrap joins genuine link retirement and fences admission', () =>
  using({phase: 'none', holdInit: true}, async f => {
    const spawn = f.spawn(); await turn(); assert(f.initMessage);
    const stop = f.host.stop(); assert.equal(f.host.stop(), stop);
    const r = await spawn; await stop; assert.equal(r.ok, false);
    assert.equal(r.error.workerLink, f.link); retired(f);
    assert.equal((await result(f.host.spawnThread({tid: 8}))).ok, false);
  }));

test('stop after bootstrap reply preserves stack allocation identity', () =>
  using({phase: 'none', holdInit: true}, async f => {
    const spawn = f.spawn(); await turn();
    f.transports[0].emit({t: 'threadReady', seq: f.initMessage.seq, ...f.registers});
    const stop = f.host.stop(); const r = await spawn; await stop;
    annotated(r, r.error, f.link); assert.equal(f.link.stackMapped, f.registers.stackMapped); retired(f);
  }));

test('stop during bootstrap cannot bypass a mismatched retirement receipt', () =>
  using({phase: 'none', holdInit: true, receipt: 'identity'}, async f => {
    const spawn = f.spawn(); await turn();
    const stop = result(f.host.stop()); const r = await spawn;
    annotated(r, r.error, f.link); assert(r.error.retirementError);
    assert.equal((await stop).ok, false); assert.equal(f.transports[0].exits, 0);
    assert(f.host._retirementLinks.has(f.link)); assert.equal(f.link.worker, f.transports[0]);
    f.receipt = 'valid'; await f.host.stop(); retired(f);
  }));

test('a failed spawn can be followed by a genuinely successful new spawn', () =>
  using({source: Object.freeze(Error('first bootstrap'))}, async f => {
    const first = await f.spawn(); annotated(first, f.source, f.link); retired(f);
    const previous = f.link; f.phase = 'none'; const next = await f.spawn();
    assert.equal(next.ok, true); assert(next.value instanceof WorkerLink);
    assert.notEqual(next.value, previous); assert.notEqual(next.value.slot, previous.slot);
    assert.equal(f.host.threadLinks.get(next.value.slot), next.value);
    assert.equal(f.host._startingLinks.size, 0); await f.host.dropThread(next.value);
    assert.equal(f.transports[0].exits, 1); assert.equal(f.transports[1].exits, 1);
    assert.equal(f.renderExits, 2); assert.equal(f.host.slotTid.size, 0);
  }));

test('successful spawn keeps register metadata and subsequent genuine drop succeeds once', () =>
  using({phase: 'none'}, async f => {
    const r = await f.spawn(); assert.equal(r.ok, true); assert.equal(r.value, f.link);
    assert.equal(f.host.threadLinks.get(f.link.slot), f.link); assert.equal(f.link.startEip, 4096);
    assert.equal(f.link.startEsp, 8192); assert.deepEqual(f.link.inheritedWasmSetters, ['eax']);
    assert.equal(f.transports[0].exits, 0); await f.host.dropThread(f.link); retired(f);
    await f.host.dropThread(f.link); assert.equal(f.transports[0].exits, 1);
  }));

(async () => {
  let failures = 0; const unhandled = [];
  const onUnhandled = e => unhandled.push(e); process.on('unhandledRejection', onUnhandled);
  try {
    for (const {name, run} of tests) {
      let timer;
      try {
        await Promise.race([run(), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('case deadline')), 800); })]);
        await turn(); assert.equal(unhandled.length, 0, 'no unhandled logger rejection');
        console.log(`PASS ${name}`);
      } catch (error) { failures++; console.error(`FAIL ${name}\n${error.stack}`); unhandled.length = 0; }
      finally { clearTimeout(timer); }
    }
  } finally { threads.Worker = originalWorker; process.off('unhandledRejection', onUnhandled); }
  console.log(`${tests.length - failures}/${tests.length} PASS`); process.exitCode = failures ? 1 : 0;
})();
