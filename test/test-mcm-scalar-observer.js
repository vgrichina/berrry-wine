'use strict';
const assert = require('node:assert/strict');
const { createScalarObserver } = require('../tools/mcm-scalar-observer.cjs');

// The previous live-record logger throws after show_window has run.
const live = { generation: 1n }; live.cycle = live;
assert.throws(() => JSON.stringify(live), TypeError);
const sab = new SharedArrayBuffer(16), thrown = { sentinel: true };
assert.throws(() => JSON.stringify({ cycle: live.cycle }), TypeError);
assert.throws(() => JSON.stringify(Object.defineProperty({}, 'getter', {
  enumerable: true, get() { throw thrown; }
})), e => e === thrown);
// Node and browser TextDecoder differ on shared views. The observer must
// keep the buffer opaque regardless, without invoking serialization hooks.
Object.defineProperty(sab, 'toJSON', { value() { throw thrown; } });
assert.throws(() => JSON.stringify({ sab }), e => e === thrown);
let oldCalls = 0;
const oldResult = {};
function oldShowWindow() {
  ++oldCalls;
  const result = oldResult;
  JSON.stringify({ result, live });
  return result;
}
assert.throws(oldShowWindow, TypeError,
  'the old logger throws into the caller after the real API has executed');
assert.equal(oldCalls, 1);
const repaired = createScalarObserver(() => {});
assert.equal(repaired.wrap(() => oldResult, () => ({ live }))(), oldResult);
for (const failure of ['bigint', 'cycle', 'sab', 'getter', 'projection', 'write']) {
  for (const throws of [false, true]) {
    let calls = 0;
    const receiver = {}, args = [live, sab], result = {};
    const rows = [];
    const observer = createScalarObserver(s => {
      if (failure === 'write') throw thrown;
      rows.push(JSON.parse(s));
    });
    const fn = observer.wrap(function (...actual) {
      ++calls; assert.equal(this, receiver); assert.deepEqual(actual, args);
      if (throws) throw thrown;
      return result;
    }, () => {
      if (failure === 'projection') throw thrown;
      if (failure === 'getter') return Object.defineProperty({}, 'bad', {
        enumerable: true, get() { throw thrown; }
      });
      return { value: failure === 'bigint' ? 123n : failure === 'cycle' ? live : sab };
    });
    if (throws) assert.throws(() => fn.apply(receiver, args), e => e === thrown);
    else assert.equal(fn.apply(receiver, args), result);
    assert.equal(calls, 1);
    assert.equal(observer.disabled(), ['getter', 'projection', 'write'].includes(failure));
    // A latched logger stays disabled while subsequent real calls still run.
    const before = rows.length;
    if (throws) assert.throws(() => fn.apply(receiver, args), e => e === thrown);
    else assert.equal(fn.apply(receiver, args), result);
    assert.equal(calls, 2);
    if (observer.disabled()) assert.equal(rows.length, before);
  }
}
const target = {}, observer = createScalarObserver(() => {});
assert.equal(observer.install(target, 'callback', () => ({})), false);
let calls = 0;
target.callback = function (v) { ++calls; assert.equal(this, target); return v; };
assert.equal(observer.install(target, 'callback', () => ({ installed: true })), true);
assert.equal(target.callback(47n), 47n);
assert.equal(calls, 1);
for (const value of [undefined, null, false, 0, 1n, Symbol('throw')]) {
  let invoked = 0;
  const safe = createScalarObserver(() => { throw thrown; });
  const fn = safe.wrap(() => { ++invoked; throw value; }, () => ({ x: 1 }));
  try { fn(); assert.fail('must throw'); } catch (actual) { assert.equal(actual, value); }
  assert.equal(invoked, 1);
}
const bounded = createScalarObserver(() => {}, 2);
for (let i = 0; i < 10; ++i) bounded.observe(() => ({ i }));
assert.equal(bounded.count(), 2);
(async () => {
  const asyncFailure = createScalarObserver(() => Promise.reject(thrown));
  asyncFailure.observe(() => ({ x: 1 }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(asyncFailure.disabled(), true);
  console.log('MCM scalar observer containment PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
