#!/usr/bin/env node
'use strict';
// Microsoft public A/W buffer, terminator and BOOL contracts:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getkeyboardlayoutnamea
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getkeyboardlayoutnamew
// US KLID 00000409 (independent literal oracle below):
// https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-language-pack-default-values
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const table = require('../src/api_table.json');
const extraWat = String.raw`
  (func (export "klnw_init")
    (global.set $thunk_guest_base (i32.add (global.get $image_base)
      (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
    (call $update_thunk_end))
  (func (export "klnw_regs") (result i32) (global.get $reg_base))
  (func (export "klnw_map") (param i32) (result i32)
    (call $virtual_map_commit (local.get 0) (i32.const 4096)))
  (func (export "klnw_id") (param $name i32) (result i32)
    (call $lookup_api_id (call $g2w (local.get $name))))
  (func (export "klnw_module") (param $name i32) (result i32)
    (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "klnw_resolve") (param $module i32) (param $name i32) (result i32)
    (call $handle_GetProcAddress (local.get $module) (local.get $name)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "klnw_invoke") (param $thunk i32) (result i32)
    (global.set $eip (i32.const 0x456789ab))
    (call $win32_dispatch (i32.div_u
      (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8)))
    (i32.load (global.get $reg_base)))`;
// Nine UTF-16 code units, including the terminating zero; not derived from A.
const wide = [0x30, 0, 0x30, 0, 0x30, 0, 0x30, 0, 0x30, 0, 0x34, 0, 0x30, 0, 0x39, 0, 0, 0];
const ansi = [0x30, 0x30, 0x30, 0x30, 0x30, 0x34, 0x30, 0x39, 0];
(async () => {
  // No reference to the W handler: absent registration is observable only
  // through the public resolver after successful compilation and boot.
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
  e.heap_init(0x800000);
  e.klnw_init();
  const view = new DataView(memory.buffer), regs = e.klnw_regs() >>> 0;
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => e.guest_read8(p + i)));
  const fill = (p, n, value) => { for (let i = 0; i < n; i++) e.guest_write8(p + i, value); };
  const alloc = n => e.guest_alloc(n) >>> 0;
  const stackArea = alloc(128), stack = stackArea + 32, unrelated = alloc(128);
  fill(unrelated, 128, 0x6b);
  const str = s => { const p = alloc(s.length + 1); [...Buffer.from(s + '\0')].forEach((v, i) => e.guest_write8(p + i, v)); return p; };
  view.setUint32(regs + 16, stack, true);
  const user32 = e.klnw_module(str('user32.dll')) >>> 0;
  assert.ok(user32, 'public USER32 module');
  const entries = new Map();
  for (const name of ['GetModuleHandleA', 'GetKeyboardLayout', 'GetKeyboardLayoutNameA', 'GetKeyboardLayoutList', 'GetKeyboardLayoutNameW']) {
    const p = str(name), id = e.klnw_id(p) >>> 0;
    view.setUint32(regs + 16, stack, true);
    const thunk = e.klnw_resolve(user32, p) >>> 0;
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
    assert.equal(e.klnw_invoke(thunk) >>> 0, expected, name + ' result');
    assert.equal(view.getUint32(regs, true), expected, name + ' EAX');
    assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' stdcall ESP');
    for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(view.getUint32(regs + i * 4, true), 0x41320000 + i, name + ' register ' + i);
    assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' dispatcher preserves EIP canary');
    assert.deepEqual(read(stackArea, 128), savedStack, name + ' full stack canaries');
    assert.deepEqual(read(unrelated, 128), savedUnrelated, name + ' unrelated memory');
    calls++;
  }
  invoke('GetModuleHandleA', [str('user32.dll')], user32);
  invoke('GetKeyboardLayout', [0], 0x04090409);
  function output(name, args, p, bytes) {
    const start = p - 32, expected = Buffer.alloc(96, 0xcc);
    fill(start, 96, 0xcc); Buffer.from(bytes).copy(expected, 32);
    invoke(name, args, 1);
    assert.deepEqual(read(start, 96), expected, name + ' full output and surrounding canaries');
  }
  const a = alloc(160) + 32, b = alloc(160) + 33, list = alloc(160) + 32;
  output('GetKeyboardLayoutNameA', [a], a, ansi);
  invoke('GetKeyboardLayoutList', [0, 0], 1);
  output('GetKeyboardLayoutList', [1, list], list, [9, 4, 9, 4]);
  output('GetKeyboardLayoutList', [2, list], list, [9, 4, 9, 4]);
  // NULL is the existing emulator compatibility policy, not a Windows
  // invalid-pointer contract. No other invalid-pointer behaviour is asserted.
  invoke('GetKeyboardLayoutNameA', [0], 0);
  assert.notEqual(entries.get('GetKeyboardLayoutNameW').id, 0xffff, 'public W hash lookup is missing');
  assert.ok(entries.get('GetKeyboardLayoutNameW').thunk, 'public W resolution is missing');
  for (let repeat = 0; repeat < 3; repeat++) {
    output('GetKeyboardLayoutNameW', [a], a, wide);
    const savedA = read(a - 32, 96);
    output('GetKeyboardLayoutNameW', [b], b, wide);
    assert.deepEqual(read(a - 32, 96), savedA, 'previous output buffer retained');
    output('GetKeyboardLayoutNameA', [b], b, ansi);
    assert.deepEqual(read(a - 32, 96), savedA, 'A control leaves previous W buffer intact');
  }
  const page = 0x30000000, otherPage = 0x28000000;
  for (const p of [page, otherPage, page + 4096]) assert.equal(e.klnw_map(p) >>> 0, p);
  assert.notEqual(wa(page + 4096), wa(page) + 4096, 'noncontiguous sparse backing');
  fill(otherPage, 4096, 0x7d);
  for (let split = 1; split <= 18; split++) {
    const p = page + 4096 - split;
    output('GetKeyboardLayoutNameW', [p], p, wide);
    output('GetKeyboardLayoutNameW', [p], p, wide);
  }
  invoke('GetKeyboardLayoutNameW', [0], 0);
  assert.deepEqual(read(otherPage, 4096), Buffer.alloc(4096, 0x7d), 'unrelated sparse page');
  output('GetKeyboardLayoutNameA', [a], a, ansi);
  output('GetKeyboardLayoutList', [1, list], list, [9, 4, 9, 4]);
  console.log('PASS public GetKeyboardLayoutNameW: ' + calls + ' calls; literal nine UTF16 units, terminator, repeated buffers, 18 sparse splits, A/List controls, ABI/stack/register/EIP/full-buffer canaries');
})().catch(error => { console.error(error); process.exitCode = 1; });
