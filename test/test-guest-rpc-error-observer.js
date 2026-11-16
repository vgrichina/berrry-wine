#!/usr/bin/env node
'use strict';
// Exercise the actual exported broker with plain shared register storage only.
const assert = require('node:assert/strict');
const RPC = require('../lib/guest-rpc');
const Regions = require('../lib/region-map.generated');
const memory = {buffer: new SharedArrayBuffer(Math.max(
  RPC.RPC_BASE + RPC.RPC_STRIDE * RPC.RPC_MAX_SLOTS,
  Regions.BASE.WRITER_SESSION + 65536))};
const v = RPC.views(memory, 3), pub = RPC.views(memory, 0).pub;
const turn = () => new Promise(resolve => setImmediate(resolve));
const tests = [], test = (name, run) => tests.push({name, run});
const source = new Error('original import failure'), observer = new Error('observer failure');
const sigs = {fail: {}, gdi_surface_fail: {}, gdi_surface_zero: {}, ok: {}};
let notifications = 0;
const notify = Atomics.notify;
Atomics.notify = (words, index, ...args) => {
  if (words.buffer === memory.buffer && words.byteOffset === v.i32.byteOffset && index === RPC.SLOT.STATUS)
    notifications++;
  return notify(words, index, ...args);
};
function request(broker, name = 'fail') {
  notifications = 0;
  Atomics.store(v.i32, RPC.SLOT.STATUS, RPC.STATUS_REQ);
  v.i32[RPC.SLOT.FN] = broker.names.indexOf(name);
  v.i32[RPC.SLOT.ARGC] = 1;
  v.i32[RPC.SLOT.ARGS] = 17;
}
function settled(broker, status = RPC.STATUS_ERR, count = 1) {
  assert.equal(Atomics.load(v.i32, RPC.SLOT.STATUS), status, 'terminal status');
  assert.equal(notifications, 1, 'exactly one notification');
  assert.equal(broker.stats().served, count, 'exactly one completion per accepted call');
}
function capture(fn) {
  try { return {value: fn(), threw: false}; } catch (error) { return {error, threw: true}; }
}
for (const route of ['rpc', 'gl']) {
  const name = route === 'rpc' ? 'fail' : 'gpu_gl_batch';
  const deliver = b => route === 'rpc' ? b.serveRpc(3) : b.serveGlBatch({slot: 3, memoryOffset: 0, bytes: 0});
  for (const mode of ['absent', 'record', 'throw', 'reenter']) test(`${route} synchronous failure / ${mode}`, () => {
    let calls = 0, reports = 0, nested, observed;
    const opts = {countCalls: true};
    let b;
    if (mode !== 'absent') opts.onError = (n, e) => {
      reports++; assert.equal(n, name); assert(e === source, 'exact original error');
      observed = Atomics.load(v.i32, RPC.SLOT.STATUS);
      if (mode === 'reenter' && reports === 1) nested = deliver(b);
      if (mode === 'throw' || mode === 'reenter') throw observer;
    };
    b = RPC.createMainBroker(memory, {[name]: () => { calls++; throw source; }}, sigs, opts);
    request(b); const r = capture(() => deliver(b));
    assert.equal(r.threw, mode === 'throw' || mode === 'reenter');
    if (r.threw) assert(r.error === observer, 'observer failure remains observable');
    settled(b); if (mode !== 'absent') assert.equal(observed, RPC.STATUS_ERR, 'settled before observer');
    assert.equal(calls, 1); assert.equal(reports, mode === 'absent' ? 0 : 1);
    if (mode === 'reenter') assert.equal(nested, false, 'completed slot rejects reentrant delivery');
    assert.equal(deliver(b), false); settled(b);
    assert.equal(b.stats().calls[0].count, 1);
  });
  test(`${route} pending rejection settles before throwing observer and permits reuse`, async () => {
    let reject, reports = 0, calls = 0, nested, observed;
    const unhandled = [], listener = e => unhandled.push(e);
    process.on('unhandledRejection', listener);
    const b = RPC.createMainBroker(memory, {[name]: () => {
      calls++; return calls === 1 ? new Promise((_, r) => { reject = r; }) : 29;
    }}, sigs, {onError(n, e) {
      reports++; assert.equal(n, name); assert(e === source);
      observed = Atomics.load(v.i32, RPC.SLOT.STATUS); nested = deliver(b); throw observer;
    }});
    try {
      request(b); assert.equal(deliver(b), true); assert.equal(deliver(b), false);
      assert.equal(b.stats().served, 0); assert.equal(notifications, 0);
      reject(source); await turn(); await turn();
      settled(b); assert.equal(observed, RPC.STATUS_ERR, 'rejection settled before observer'); assert.equal(reports, 1); assert.equal(nested, false); assert.equal(calls, 1);
      assert.equal(unhandled.length, 1); assert(unhandled[0] === observer, 'promise observer rejection remains observable');
      request(b); assert.equal(deliver(b), true); settled(b, RPC.STATUS_RESP, 2);
      assert.equal(v.i32[RPC.SLOT.RESULT], 29); assert.equal(calls, 2);
    } finally { process.removeListener('unhandledRejection', listener); }
  });
  test(`${route} fulfilled promise stays pending until completion`, async () => {
    let resolve, calls = 0;
    const b = RPC.createMainBroker(memory, {[name]: () => { calls++; return new Promise(r => { resolve = r; }); }}, sigs,
      {onError() { throw new Error('success must not report an error'); }});
    request(b); assert.equal(deliver(b), true); assert.equal(deliver(b), false);
    assert.equal(notifications, 0); resolve(37); await turn();
    settled(b, RPC.STATUS_RESP); assert.equal(v.i32[RPC.SLOT.RESULT], 37); assert.equal(calls, 1);
  });
}
test('single async call counts failure before reentrant throwing observer', () => {
  let b, reports = 0, observed;
  b = RPC.createMainBroker(memory, {fail() { throw source; }, ok() { return 1; }}, sigs,
    {countCalls: true, onError(n, e) {
      assert.equal(n, 'fail'); assert(e === source); reports++;
      observed = b.stats().served; b.serveCall({slot: 3, id: b.names.indexOf('ok')}); throw observer;
    }});
  const r = capture(() => b.serveCall({slot: 3, id: b.names.indexOf('fail')}));
  assert(r.threw && r.error === observer); assert.equal(reports, 1); assert.equal(observed, 1); assert.equal(b.stats().served, 2);
  assert.equal(b.stats().calls.length, 2);
});
for (const multiple of [false, true]) test(`async batch preserves siblings, epoch, counters and ${multiple ? 'multiple' : 'single'} observer failure`, () => {
  const events = [], errors = [], observer2 = new Error('second observer failure');
  const epoch = Atomics.load(pub, RPC.SLOT.DX_SURF_EPOCH);
  let b;
  b = RPC.createMainBroker(memory, {
    fail() { events.push('fail'); throw source; },
    gdi_surface_fail() { events.push('surface-fail'); throw source; },
    gdi_surface_zero() { events.push('zero'); return 0; },
    ok(x) { events.push(x); return 1; },
  }, sigs, {countCalls: true, onError(n, e) {
    assert(e === source); errors.push(n);
    b.serveCall({slot: 4, id: b.names.indexOf('ok'), args: ['nested']});
    throw errors.length === 1 ? observer : observer2;
  }});
  const list = [b.names.indexOf('fail'), [], b.names.indexOf('gdi_surface_zero'), [],
    ...(multiple ? [b.names.indexOf('gdi_surface_fail'), []] : []), b.names.indexOf('ok'), ['last']];
  const r = capture(() => b.serveCalls({slot: 3, list}));
  assert(r.threw, 'observer exceptions must remain visible');
  if (multiple) { assert(r.error instanceof AggregateError); assert(r.error.errors[0] === observer); assert(r.error.errors[1] === observer2); }
  else assert(r.error === observer);
  assert.deepEqual(events, multiple ? ['fail', 'nested', 'zero', 'surface-fail', 'nested', 'last'] : ['fail', 'nested', 'zero', 'last']);
  assert.deepEqual(errors, multiple ? ['fail', 'gdi_surface_fail'] : ['fail']);
  assert.equal(Atomics.load(pub, RPC.SLOT.DX_SURF_EPOCH), epoch + 1, 'only explicit zero invalidates surface memo');
  assert.equal(b.stats().served, list.length / 2 + errors.length);
  assert.equal(b.stats().calls.reduce((n, x) => n + x.count, 0), b.stats().served);
  assert(b.stats().calls.every(x => x.name.endsWith('~async')));
});
test('batch original failures remain reported without observer exceptions', () => {
  const reports = []; let remaining = 0;
  const b = RPC.createMainBroker(memory, {fail() { throw source; }, ok() { remaining++; }}, sigs,
    {onError(n, e) { reports.push([n, e]); }});
  b.serveCalls({slot: 3, list: [b.names.indexOf('fail'), [], b.names.indexOf('ok'), []]});
  assert.equal(reports.length, 1); assert(reports[0][1] === source); assert.equal(remaining, 1); assert.equal(b.stats().served, 2);
});
for (const route of ['rpc', 'gl']) for (const deferred of [false, true])
  test(`${route} ${deferred ? 'rejected promise' : 'sync throw'} observer can submit a new request without old completion overwriting it`, async () => {
    let calls = 0, reject, reports = 0, seen;
    const name = route === 'rpc' ? 'fail' : 'gpu_gl_batch';
    const deliver = b => route === 'rpc' ? b.serveRpc(3) : b.serveGlBatch({slot: 3, memoryOffset: 0});
    const unhandled = [], listener = e => unhandled.push(e);
    const b = RPC.createMainBroker(memory, {[name]() {
      if (++calls > 1) return 55;
      if (deferred) return new Promise((_, r) => { reject = r; });
      throw source;
    }}, sigs, {onError(n, e) {
      reports++; assert(e === source); seen = Atomics.load(v.i32, RPC.SLOT.STATUS);
      Atomics.store(v.i32, RPC.SLOT.STATUS, RPC.STATUS_REQ);
      assert.equal(deliver(b), true); throw observer;
    }});
    process.on('unhandledRejection', listener);
    try {
      request(b); const r = capture(() => deliver(b));
      if (deferred) { reject(source); await turn(); await turn(); assert.equal(unhandled.length, 1); assert(unhandled[0] === observer); }
      else assert(r.threw && r.error === observer);
      assert.equal(seen, RPC.STATUS_ERR); assert.equal(reports, 1); assert.equal(calls, 2);
      assert.equal(Atomics.load(v.i32, RPC.SLOT.STATUS), RPC.STATUS_RESP);
      assert.equal(v.i32[RPC.SLOT.RESULT], 55); assert.equal(notifications, 2); assert.equal(b.stats().served, 2);
    } finally { process.removeListener('unhandledRejection', listener); }
  });
test('falsy thrown import and observer values retain failure semantics', () => {
  let reports = 0;
  const b = RPC.createMainBroker(memory, {fail() { throw undefined; }}, sigs,
    {onError(n, e) { reports++; assert.equal(e, undefined); throw null; }});
  request(b); const r = capture(() => b.serveRpc(3));
  assert(r.threw); assert.equal(r.error, null); settled(b); assert.equal(reports, 1);
  const a = capture(() => b.serveCalls({slot: 3, list: [b.names.indexOf('fail'), [], b.names.indexOf('fail'), []]}));
  assert(a.threw && a.error instanceof AggregateError); assert.deepEqual(a.error.errors, [null, null]);
  assert.equal(b.stats().served, 3); assert.equal(reports, 3);
});
(async () => {
  let failed = 0;
  try {
    for (const {name, run} of tests) {
      try { await run(); console.log(`PASS ${name}`); }
      catch (e) { failed++; console.log(`FAIL ${name}: ${e === observer ? 'observer failure escaped before settlement' : e?.message || String(e)}`); }
    }
  } finally { Atomics.notify = notify; }
  console.log(`${tests.length - failed}/${tests.length} passed; plain exported broker; NO_NATIVE_RESULT`);
  process.exitCode = failed ? 1 : 0;
})();
