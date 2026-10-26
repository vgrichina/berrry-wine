'use strict';
const assert = require('node:assert/strict');
const {FIELDS, DIAGNOSTIC_FIELDS} = require('../tools/maelstrom-native-errno-latch.cjs');
const {createAdapter} = require('../tools/maelstrom-original-errno-adapter.cjs');
const SELECT = ['started','phase','token','entries','parks','completions','fault','capped','active','thread','regs','pre','post','ret','result'];
let cases = 0;
function fixture(legacy) {
  const native = Object.fromEntries(FIELDS.map(k => [k, 0]));
  const effects = [], rows = [];
  let reads = 0, live = () => {}, persist = () => {};
  const exports = {mne_start() { native.status = 1; }};
  for (const k of FIELDS) exports['mne_'+k] = () => { reads++; return native[k]; };
  if (!legacy) for (const k of DIAGNOSTIC_FIELDS) exports['mne_'+k] = () => { reads++; return 0; };
  for (const k of SELECT) exports['msc_'+k] = () => { reads++; return 0; };
  const adapter = createAdapter({exports}, {
    readLive() { effects.push('live'); live(); return {eax: 123}; },
    persist(row) { effects.push('persist'); rows.push(row); persist(row); }
  });
  adapter.start(); effects.length = 0; rows.length = 0;
  return {native, effects, rows, adapter, reads: () => reads,
    hooks(l, p) { live = l || (() => {}); persist = p || (() => {}); }};
}
function closed(f) {
  const before = [f.reads(), f.effects.length];
  // Poison exports after the terminal snapshot, so resampling would also throw.
  f.native.status = NaN;
  assert.equal(f.adapter.observe(999), null);
  assert.deepEqual([f.reads(), f.effects.length], before);
  assert.throws(() => f.adapter.start(), /one invocation only/);
}
for (const legacy of [false, true]) {
  for (const [status, event] of [[4,3], [5,0], [5,1], [5,2]]) {
    for (const callback of ['live', 'persist']) {
      // Include non-Error throws: the adapter must preserve thrown identity/value.
      for (const sentinel of [Error('terminal callback'), {sentinel: true}, undefined]) {
        const f = fixture(legacy);
        Object.assign(f.native, {status, event, errno: -1});
        const hook = () => {
          // A nested observation must return before reading any export/callback.
          const count = f.reads();
          assert.equal(f.adapter.observe(2), null);
          assert.equal(f.reads(), count);
          f.native.errno = 42;
          throw sentinel;
        };
        f.hooks(callback === 'live' ? hook : null, callback === 'persist' ? hook : null);
        let caught = false;
        try { f.adapter.observe(1); } catch (e) { caught = true; assert.equal(e, sentinel); }
        assert.equal(caught, true);
        assert.deepEqual(f.effects, callback === 'live' ? ['live'] : ['live', 'persist']);
        if (callback === 'persist') {
          assert.equal(f.rows[0].historicalNativeLatch.errno, 0xffffffff);
          assert.equal(f.rows[0].historicalNativeLatch.status, status);
        }
        closed(f); cases++;
      }
      // Successful callbacks are also sealed during reentrant calls.
      const f = fixture(legacy);
      Object.assign(f.native, {status, event});
      const hook = () => { const count = f.reads(); assert.equal(f.adapter.observe(3), null); assert.equal(f.reads(), count); };
      f.hooks(callback === 'live' ? hook : null, callback === 'persist' ? hook : null);
      if (status === 5) assert.throws(() => f.adapter.observe(1), /native latch status rejection/);
      else assert.equal(f.adapter.observe(1).kind, 'captured');
      assert.deepEqual(f.effects, ['live', 'persist']); closed(f); cases++;
    }
  }
  for (const callback of ['live', 'persist']) {
    const f = fixture(legacy), sentinel = Error('pending callback');
    Object.assign(f.native, {status: 2, event: 1});
    const hook = () => { throw sentinel; };
    f.hooks(callback === 'live' ? hook : null, callback === 'persist' ? hook : null);
    assert.throws(() => f.adapter.observe(1), e => e === sentinel);
    f.hooks();
    const effects = f.effects.length;
    assert.equal(f.adapter.observe(2), null); // Preserve existing deduplication after a throw.
    assert.equal(f.effects.length, effects);
    Object.assign(f.native, {status: 3, event: 2});
    assert.equal(f.adapter.observe(3).kind, 'pending');
    Object.assign(f.native, {status: 4, event: 3});
    assert.equal(f.adapter.observe(4).kind, 'captured'); closed(f); cases++;
  }
}
console.log('terminal callback closure PASS: '+cases+' cases (throw identity, reentrancy, snapshots, pending behavior)');
