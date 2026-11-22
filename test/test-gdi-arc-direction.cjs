#!/usr/bin/env node
'use strict';
// Public GDI32 attribute contracts and independent literal values:
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getarcdirection
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-setarcdirection
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-createcompatibledc
// https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-emf/9886c62f-1788-4118-894a-76d5a8733685
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const table = require('../src/api_table.json');
const extraWat = String.raw`
  (func (export "arc_init")
    (global.set $thunk_guest_base (i32.add (global.get $image_base)
      (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
    (call $update_thunk_end))
  (func (export "arc_regs") (result i32) (global.get $reg_base))
  (func (export "arc_id") (param $name i32) (result i32)
    (call $lookup_api_id (call $g2w (local.get $name))))
  (func (export "arc_module") (param $name i32) (result i32)
    (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "arc_resolve") (param $module i32) (param $name i32) (result i32)
    (call $handle_GetProcAddress (local.get $module) (local.get $name)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "arc_invoke") (param $thunk i32) (result i32)
    (global.set $eip (i32.const 0x456789ab))
    (call $win32_dispatch (i32.div_u
      (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8)))
    (i32.load (global.get $reg_base)))`;
(async () => {
  // Successful compile and boot precede public absence/presence assertions.
  // No direct reference to the new handler appears in the harness.
  const { exports: e, memory, canvas } = await bootRenderHarness({ extraWat, fonts: 'none', width: 16, height: 16 });
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
  e.heap_init(0x800000);
  e.arc_init();
  const view = new DataView(memory.buffer), regs = e.arc_regs() >>> 0;
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => e.guest_read8(p + i)));
  const fill = (p, n, v) => { for (let i = 0; i < n; i++) e.guest_write8(p + i, v); };
  const alloc = n => e.guest_alloc(n) >>> 0;
  const stackArea = alloc(128), stack = stackArea + 32, unrelated = alloc(128);
  fill(unrelated, 128, 0x6b);
  const str = s => { const p = alloc(s.length + 1); [...Buffer.from(s + '\0')].forEach((v, i) => e.guest_write8(p + i, v)); return p; };
  view.setUint32(regs + 16, stack, true);
  const gdi32 = e.arc_module(str('gdi32.dll')) >>> 0;
  assert.ok(gdi32, 'public GDI32 module');
  const entries = new Map();
  for (const name of ['CreateCompatibleDC', 'DeleteDC', 'SetArcDirection', 'GetArcDirection']) {
    const p = str(name), id = e.arc_id(p) >>> 0;
    view.setUint32(regs + 16, stack, true);
    const thunk = e.arc_resolve(gdi32, p) >>> 0;
    entries.set(name, { id, thunk });
    if (thunk) assert.equal(view.getUint32(wa(thunk) + 4, true), id, name + ' thunk ID');
  }
  console.log(JSON.stringify({ publicLookup: Object.fromEntries(entries) }));
  let calls = 0;
  function invoke(name, args, expected) {
    const { id, thunk } = entries.get(name), row = table.find(a => a.name === name);
    assert.ok(thunk, name + ' public resolution'); assert.ok(row, name + ' registration');
    assert.equal(id, row.id); assert.equal(row.nargs, args.length); assert.equal(row.convention, 'stdcall');
    fill(stackArea, 128, 0xa5);
    view.setUint32(wa(stack), 0x12345678, true);
    args.forEach((v, i) => view.setUint32(wa(stack) + 4 + i * 4, v, true));
    const savedStack = read(stackArea, 128), savedUnrelated = read(unrelated, 128);
    for (let i = 0; i < 8; i++) view.setUint32(regs + i * 4, 0x41320000 + i, true);
    view.setUint32(regs + 16, stack, true);
    const result = e.arc_invoke(thunk) >>> 0;
    if (expected === undefined) assert.ok(result, name + ' succeeds');
    else assert.equal(result, expected, name + ' result');
    assert.equal(view.getUint32(regs, true), result, name + ' EAX');
    assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' stdcall ESP');
    for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(view.getUint32(regs + i * 4, true), 0x41320000 + i, name + ' register ' + i);
    assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' dispatcher EIP canary');
    assert.deepEqual(read(stackArea, 128), savedStack, name + ' full stack bounds');
    assert.deepEqual(read(unrelated, 128), savedUnrelated, name + ' unrelated memory bounds');
    calls++;
    return result;
  }
  const first = invoke('CreateCompatibleDC', [0]);
  // Existing documented setter controls must pass before absence is assessed.
  invoke('SetArcDirection', [first, 2], 1);
  invoke('SetArcDirection', [first, 2], 2);
  invoke('SetArcDirection', [first, 1], 2);
  invoke('SetArcDirection', [first, 1], 1);
  console.log('PASS existing public setter controls: default1/set2 previous1/repeat previous2/set1 previous2/repeat previous1');
  assert.notEqual(entries.get('GetArcDirection').id, 0xffff, 'public GetArcDirection hash lookup is missing');
  assert.ok(entries.get('GetArcDirection').thunk, 'public GetArcDirection resolution is missing');
  const pixels = () => Buffer.from(canvas.getContext('2d').getImageData(0, 0, 16, 16).data);
  const initialPixels = pixels();
  invoke('GetArcDirection', [first], 1);
  invoke('SetArcDirection', [first, 2], 1);
  for (let i = 0; i < 3; i++) invoke('GetArcDirection', [first], 2);
  const second = invoke('CreateCompatibleDC', [0]);
  assert.notEqual(second, first, 'distinct valid DCs');
  for (let i = 0; i < 3; i++) {
    invoke('GetArcDirection', [second], 1);
    invoke('GetArcDirection', [first], 2);
  }
  invoke('SetArcDirection', [second, 2], 1);
  invoke('SetArcDirection', [first, 1], 2);
  for (let i = 0; i < 3; i++) {
    invoke('GetArcDirection', [first], 1);
    invoke('GetArcDirection', [second], 2);
  }
  invoke('SetArcDirection', [second, 1], 2);
  invoke('GetArcDirection', [second], 1);
  invoke('GetArcDirection', [first], 1);
  assert.deepEqual(pixels(), initialPixels, 'direction attribute operations do not draw');
  invoke('DeleteDC', [first], 1);
  invoke('DeleteDC', [second], 1);
  console.log('PASS public GetArcDirection: ' + calls + ' calls; literal default1/clockwise2, previous setter return, repeated reads, separate DC isolation, unchanged canvas, ABI/register/ESP/stack/EIP/bounds');
})().catch(error => { console.error(error); process.exitCode = 1; });
