#!/usr/bin/env node
'use strict';
// Native WAT/COM ABI coverage. Compiles the canonical source via the existing
// harness; run only in the root-owned serialized runtime lane.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const apis = require('../src/api_table.json');
const extraWat = String.raw`
  (func (export "ds_call") (param $id i32) (param $a i32) (param $b i32)
      (param $c i32) (param $d i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b)
      (local.get $c) (local.get $d) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "notify_refs") (param $this i32) (result i32)
    (load.field DxObject refcount (call $dx_from_this (local.get $this))))
  (func (export "notify_voice") (param $this i32) (result i32)
    (load.field DxObject misc0 (call $dx_from_this (local.get $this))))
  (func (export "notify_registry_restore")
    (global.set $DX_VTBL_DSNOTIFY (i32.const 0))
    (call $dx_sync_thread_vtables))
  (func (export "notify_vtable") (result i32) (global.get $DX_VTBL_DSNOTIFY))
  (func (export "notify_pool_set") (param $count i32) (result i32)
    (local $old i32)
    (local.set $old (i32.load (global.get $COM_AUX_NEXT_SHARED)))
    (i32.store (global.get $COM_AUX_NEXT_SHARED) (local.get $count))
    (local.get $old))
`;
(async () => {
  let now = 0;
  const signals = [];
  const { exports: e, hostCtx: ctx } = await bootRenderHarness({
    fonts: 'none', extraWat,
    extraHostOverrides: { set_event: h => { signals.push(h >>> 0); return 1; } },
  });
  ctx.audioClockMs = () => now;
  e.init_dx_com_thunks();
  const stack = e.guest_alloc(64), out = e.guest_alloc(32);
  const desc = e.guest_alloc(20), fmt = e.guest_alloc(20), array = e.guest_alloc(32);
  const call = (name, args, pop) => {
    e.guest_write32(stack + pop, 0xdeadbeef);
    const r = e.ds_call(apis.find(a => a.name === name).id,
      ...Array.from({ length: 4 }, (_, i) => args[i] || 0), stack) >>> 0;
    assert.strictEqual(e.get_esp() >>> 0, stack + pop, name + ' stdcall cleanup');
    assert.strictEqual(e.guest_read32(stack + pop) >>> 0, 0xdeadbeef);
    return r;
  };
  const guid = words => {
    const p = e.guest_alloc(16);
    words.forEach((v, i) => e.guest_write32(p + 4 * i, v));
    return p;
  };
  const notifyIID = guid([0xb0210783, 0x11d089cd, 0xa00008af, 0x16cd25c9]);
  const unknownIID = guid([0, 0, 0xc0, 0x46000000]);
  const bufferIID = guid([0x279afa85, 0x11ce4981, 0x200021a5, 0x60e50baf]);
  const forgedIID = guid([0xb0210783, 0, 0, 0]);
  const qi = (obj, iid, target = out, face = 'IDirectSoundBuffer') =>
    call(face + '_QueryInterface', [obj, iid, target], 16);
  assert.strictEqual(call('DirectSoundCreate', [0, out, 0], 16), 0);
  const root = e.guest_read32(out);
  [0x00010001, 1000, 1000, 0x00080001, 0].forEach((v, i) => e.guest_write32(fmt + i * 4, v));
  const create = caps => {
    [20, caps, caps & 1 ? 0 : 100, 0, caps & 1 ? 0 : fmt]
      .forEach((v, i) => e.guest_write32(desc + i * 4, v));
    assert.strictEqual(call('IDirectSound_CreateSoundBuffer', [root, desc, out, 0], 20), 0);
    return e.guest_read32(out);
  };
  const buffer = create(0x120), plain = create(0), primary = create(1);
  for (const obj of [plain, primary]) {
    assert.strictEqual(qi(obj, notifyIID), 0x80004002);
    assert.strictEqual(e.guest_read32(out), 0);
    assert.strictEqual(e.notify_refs(obj), 1);
  }
  assert.strictEqual(qi(buffer, forgedIID), 0x80004002);
  assert.strictEqual(qi(buffer, notifyIID, 0), 0x80004003);
  assert.strictEqual(qi(buffer, notifyIID), 0);
  const face = e.guest_read32(out), originalVtable = e.guest_read32(buffer);
  assert.notStrictEqual(face, buffer);
  assert.strictEqual(e.notify_refs(buffer), 2);
  assert.strictEqual(qi(face, notifyIID, out, 'IDirectSoundNotify'), 0);
  assert.strictEqual(e.guest_read32(out), face, 'stable Notify identity');
  assert.strictEqual(call('IDirectSoundNotify_Release', [face], 8), 2);
  assert.strictEqual(qi(face, unknownIID, out, 'IDirectSoundNotify'), 0);
  assert.strictEqual(e.guest_read32(out), buffer, 'controlling IUnknown');
  assert.strictEqual(call('IDirectSoundBuffer_Release', [buffer], 8), 2);
  assert.strictEqual(qi(face, bufferIID, out, 'IDirectSoundNotify'), 0);
  assert.strictEqual(e.guest_read32(out), buffer);
  assert.strictEqual(call('IDirectSoundBuffer_Release', [buffer], 8), 2);
  assert.strictEqual(call('IDirectSoundNotify_AddRef', [face], 8), 3);
  assert.strictEqual(call('IDirectSoundNotify_Release', [face], 8), 2);
  const table = e.notify_vtable(); e.notify_registry_restore();
  assert.strictEqual(e.notify_vtable(), table, 'worker registry restores Notify vtable');
  assert.strictEqual(e.guest_read32(buffer), originalVtable, 'primary vtable unchanged');
  const limited = create(0x100), limitedVtable = e.guest_read32(limited);
  const poolCount = e.notify_pool_set(8192);
  assert.strictEqual(qi(limited, notifyIID), 0x8007000e, 'auxiliary exhaustion is a real error');
  assert.strictEqual(e.guest_read32(out), 0);
  assert.strictEqual(e.notify_refs(limited), 1);
  assert.strictEqual(e.guest_read32(limited), limitedVtable, 'exhaustion cannot rewrite primary vtable');
  assert.strictEqual(qi(face, notifyIID, out, 'IDirectSoundNotify'), 0, 'existing face still available at exhaustion');
  assert.strictEqual(e.guest_read32(out), face);
  assert.strictEqual(call('IDirectSoundNotify_Release', [face], 8), 2);
  e.notify_pool_set(poolCount);
  const set = (n, p = array) => call('IDirectSoundNotify_SetNotificationPositions', [face, n, p], 16);
  [25, 101, 0xffffffff, 102].forEach((v, i) => e.guest_write32(array + i * 4, v));
  assert.strictEqual(set(2), 0);
  const realSet = ctx._voices.notifySet;
  ctx._voices.notifySet = () => 0x8007000e;
  assert.strictEqual(set(1), 0x8007000e, 'host copy allocation failure propagates');
  ctx._voices.notifySet = realSet;
  e.guest_write32(array + 4, 999); // host must own its copy
  for (const [n, p] of [[1, 0], [100001, array], [1, 0xfffffff8]])
    assert.strictEqual(set(n, p), 0x80070057);
  e.guest_write32(array, 100); assert.strictEqual(set(1), 0x80070057);
  e.guest_write32(array, 25); e.guest_write32(array + 4, 0);
  assert.strictEqual(set(1), 0x80070057);
  assert.strictEqual(call('IDirectSoundBuffer_Play', [buffer, 0, 0, 1], 20), 0);
  assert.strictEqual(set(0, 0), 0x88780032, 'replacement requires stopped playback');
  now = 325; ctx.pumpAudioCompletions();
  assert.deepStrictEqual(signals, [101], 'multiple complete laps survive failed replacement and caller mutation');
  assert.strictEqual(call('IDirectSoundBuffer_Stop', [buffer], 8), 0);
  assert.deepStrictEqual(signals, [101, 102]);
  assert.strictEqual(set(0, 0), 0, 'clear is supported');
  // Gather an unaligned entry across noncontiguous sparse pages.
  const base = 0x30000000;
  for (const p of [base, base + 0x8000, base + 4096])
    assert.strictEqual(e.test_virtual_map_commit(p, 4096) >>> 0, p);
  const sparse = base + 4094;
  e.guest_write32(sparse, 40); e.guest_write32(sparse + 4, 103);
  assert.strictEqual(set(1, sparse), 0);
  assert.strictEqual(call('IDirectSoundBuffer_SetCurrentPosition', [buffer, 0], 12), 0);
  assert.strictEqual(call('IDirectSoundBuffer_Play', [buffer, 0, 0, 0], 20), 0);
  now += 100; ctx.pumpAudioCompletions();
  assert.strictEqual(signals.at(-1), 103);
  // Natural end permits replacement without requiring a prior GetStatus.
  assert.strictEqual(set(0, 0), 0);
  const voice = e.notify_voice(buffer);
  assert.strictEqual(call('IDirectSoundNotify_Release', [face], 8), 1);
  assert(ctx._voices._map[voice], 'buffer keeps the shared voice alive');
  assert.strictEqual(call('IDirectSoundBuffer_Release', [buffer], 8), 0);
  assert.strictEqual(ctx._voices._map[voice], undefined);
  for (const obj of [plain, primary, limited]) assert.strictEqual(call('IDirectSoundBuffer_Release', [obj], 8), 0);
  ctx.stopAudio();
  console.log('PASS native DirectSoundNotify identity, ownership, sparse arrays, failures, playback and ABI');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
