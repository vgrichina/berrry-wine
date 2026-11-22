#!/usr/bin/env node
// The per-slot chain index over COM_WRAPPERS_AUX must answer every lookup
// exactly as the linear scan it replaced.
//
// $dx_aux_find and $dx_aux_refs_of_slot used to scan the whole aux pool, and
// once Diablo II's Direct3D renderer fills it (one IDirect3DTexture2 view per
// texture surface, 16384 entries) that was ~15% of the browser town's main
// guest thread. Past $DX_AUX_INDEX_AT entries the pool is indexed by owner
// slot (chains in a 128KB DIB-arena block); this test drives the real
// allocator -- appends, the full-pool recycle path, a pool restart -- and
// compares every indexed answer with a JS scan of the pool itself.

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "t_aux_base") (result i32) (global.get $COM_WRAPPERS_AUX))
  (func (export "t_aux_refs_base") (result i32) (global.get $COM_AUX_REFS))
  (func (export "t_aux_max") (result i32) (global.get $COM_WRAPPERS_AUX_MAX))
  (func (export "t_aux_n") (result i32) (i32.load (global.get $COM_AUX_NEXT_SHARED)))
  (func (export "t_aux_restart") (i32.store (global.get $COM_AUX_NEXT_SHARED) (i32.const 0)))
  (func (export "t_aux_index") (result i32) (i32.atomic.load (global.get $COM_AUX_INDEX)))
  (func (export "t_index_at") (result i32) (global.get $DX_AUX_INDEX_AT))
  (func (export "t_set_type") (param $slot i32) (param $type i32)
    (i32.store (i32.add (global.get $DX_OBJECTS) (i32.shl (local.get $slot) (i32.const 5)))
      (local.get $type)))
  (func (export "t_get") (param $slot i32) (param $vtbl i32) (result i32)
    (local $r i32)
    (call $lock_acquire (global.get $LOCK_DX))
    (local.set $r (call $dx_get_wrapper_for_vtbl_locked (local.get $slot) (local.get $vtbl)))
    (call $lock_release (global.get $LOCK_DX))
    (local.get $r))
  (func (export "t_find") (param $slot i32) (param $vtbl i32) (result i32)
    (call $dx_aux_find (local.get $slot) (local.get $vtbl)))
  (func (export "t_refs") (param $slot i32) (result i32)
    (call $dx_aux_refs_of_slot (local.get $slot) (i32.const 0)))
`;

(async () => {
  const { exports: w, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const u32 = () => new Uint32Array(memory.buffer);
  const AUX = w.t_aux_base() >>> 0, REFS = w.t_aux_refs_base() >>> 0;
  const MAX = w.t_aux_max() >>> 0, AT = w.t_index_at() >>> 0;
  const SLOTS = 600; // few slots, so chains run long
  let seed = 12345;
  const rnd = n => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };
  const vtblOf = k => 0x60000000 + k * 0x40;

  const scanFind = (slot, vtbl) => {
    const m = u32(), n = w.t_aux_n() >>> 0;
    for (let i = 0; i < n; i++) if (m[(AUX >> 2) + 2 * i] === vtbl && m[(AUX >> 2) + 2 * i + 1] === slot) return i;
    return -1;
  };
  const scanRefs = slot => {
    const m = u32(), n = w.t_aux_n() >>> 0; let s = 0;
    for (let i = 0; i < n; i++) if (m[(AUX >> 2) + 2 * i + 1] === slot) s = (s + m[(REFS >> 2) + i]) | 0;
    return s;
  };
  const checkAll = label => {
    for (let q = 0; q < 400; q++) {
      const slot = rnd(SLOTS), vtbl = vtblOf(rnd(48));
      assert.strictEqual(w.t_find(slot, vtbl), scanFind(slot, vtbl), `${label}: find(${slot}, ${vtbl.toString(16)})`);
    }
    for (let slot = 0; slot < SLOTS; slot += 7)
      assert.strictEqual(w.t_refs(slot), scanRefs(slot), `${label}: refs_of_slot(${slot})`);
  };
  const seedRefs = () => {
    const m = u32(), n = w.t_aux_n() >>> 0;
    for (let i = 0; i < n; i++) m[(REFS >> 2) + i] = rnd(4);
  };

  for (let s = 0; s < SLOTS; s++) w.t_set_type(s, 2);
  w.t_aux_restart();

  // Small pool: linear scan, no index.
  for (let k = 0; k < AT - 1; k++) w.t_get(rnd(SLOTS), vtblOf(rnd(48)));
  assert.strictEqual(w.t_aux_index(), 0, 'no index below the threshold');
  seedRefs(); checkAll('unindexed');

  // Cross the threshold, then fill the pool.
  for (let tries = 0; (w.t_aux_n() >>> 0) < MAX; tries++) {
    assert(tries < 50 * MAX, 'pool fills');
    w.t_get(rnd(SLOTS), vtblOf(rnd(48)));
  }
  assert.notStrictEqual(w.t_aux_index(), 0, 'index built past the threshold');
  seedRefs(); checkAll('full pool');

  // Full pool: retire a third of the slots and let new views recycle them.
  for (let s = 0; s < SLOTS; s += 3) w.t_set_type(s, 0);
  for (let k = 0; k < 4000; k++) {
    let slot; do slot = rnd(SLOTS); while (slot % 3 === 0);
    const vtbl = vtblOf(48 + rnd(16));
    const r = w.t_get(slot, vtbl);
    assert(r !== 0, 'recycled a retired wrapper');
  }
  assert.strictEqual(w.t_aux_n() >>> 0, MAX, 'recycling does not grow the pool');
  seedRefs(); checkAll('after recycling');
  for (let q = 0; q < 300; q++) {
    let slot; do slot = rnd(SLOTS); while (slot % 3 === 0);
    const vtbl = vtblOf(48 + rnd(16));
    assert.strictEqual(w.t_find(slot, vtbl), scanFind(slot, vtbl), `recycled find(${slot})`);
  }

  // A restarted pool must not keep links into its old entries.
  w.t_aux_restart();
  for (let s = 0; s < SLOTS; s++) w.t_set_type(s, 2);
  for (let k = 0; k < 50; k++) w.t_get(rnd(SLOTS), vtblOf(rnd(48)));
  seedRefs(); checkAll('restarted pool');

  console.log(`com aux chain index ok: ${MAX} entries, threshold ${AT}, find/refs match the scan through fill, recycle and restart`);
})().catch(e => { console.error(e); process.exit(1); });
