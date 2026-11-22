#!/usr/bin/env node
'use strict';
// Public A/W contracts, including map types, HKL, UINT result and zero on no
// translation: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyexa
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyexw
// Independent literal US Scan 1 Make/key identities joined to Virtual-Key Codes:
// https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input#scan-codes
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const table = require('../src/api_table.json');
const extraWat = String.raw`
  (func (export "map_exw_init")
    (global.set $thunk_guest_base (i32.add (global.get $image_base)
      (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
    (call $update_thunk_end))
  (func (export "map_exw_regs") (result i32) (global.get $reg_base))
  (func (export "map_exw_id") (param $name i32) (result i32)
    (call $lookup_api_id (call $g2w (local.get $name))))
  (func (export "map_exw_module") (param $name i32) (result i32)
    (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "map_exw_resolve") (param $module i32) (param $name i32) (result i32)
    (call $handle_GetProcAddress (local.get $module) (local.get $name)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "map_exw_invoke") (param $thunk i32) (result i32)
    (call $win32_dispatch (i32.div_u
      (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8)))
    (i32.load (global.get $reg_base)))`;

(async () => {
  // No direct reference to handle_MapVirtualKeyExW: a missing registration
  // must fail through actual public lookup/resolution after a successful boot.
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
  e.heap_init(0x800000);
  e.map_exw_init();
  const view = new DataView(memory.buffer), regs = e.map_exw_regs() >>> 0;
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const stackArea = e.guest_alloc(128) >>> 0, stack = stackArea + 32;
  const stackBytes = new Uint8Array(memory.buffer, wa(stackArea), 128);
  const sentinel = e.guest_alloc(64) >>> 0;
  const sentinels = new Uint8Array(memory.buffer, wa(sentinel), 64);
  const str = s => {
    const p = e.guest_alloc(s.length + 1) >>> 0;
    new Uint8Array(memory.buffer, wa(p), s.length + 1).set(Buffer.from(s + '\0'));
    return p;
  };
  view.setUint32(regs + 16, stack, true);
  const user32 = e.map_exw_module(str('user32.dll')) >>> 0;
  assert.ok(user32, 'public USER32 module');
  const entries = new Map();
  for (const name of ['GetKeyboardLayout', 'MapVirtualKeyExA', 'MapVirtualKeyW', 'MapVirtualKeyExW']) {
    const p = str(name), id = e.map_exw_id(p) >>> 0;
    view.setUint32(regs + 16, stack, true);
    const thunk = e.map_exw_resolve(user32, p) >>> 0;
    entries.set(name, { id, thunk });
    if (thunk) assert.equal(view.getUint32(wa(thunk) + 4, true), id, name + ' thunk API ID');
  }
  console.log(JSON.stringify({ publicLookup: Object.fromEntries(entries) }));
  function invoke(name, args, expected, label) {
    const { id, thunk } = entries.get(name);
    assert.ok(thunk, name + ' public resolution');
    const row = table.find(a => a.name === name);
    assert.ok(row, name + ' API registration');
    assert.equal(id, row.id, name + ' generated hash');
    assert.equal(row.nargs, args.length, name + ' argument count');
    assert.equal(row.convention, 'stdcall', name + ' convention');
    stackBytes.fill(0xa5);
    sentinels.fill(0x6b);
    view.setUint32(wa(stack), 0x12345678, true);
    args.forEach((v, i) => view.setUint32(wa(stack) + 4 + i * 4, v, true));
    const savedStack = Buffer.from(stackBytes), savedSentinels = Buffer.from(sentinels);
    for (let i = 0; i < 8; i++) view.setUint32(regs + i * 4, 0x41320000 + i, true);
    view.setUint32(regs + 16, stack, true);
    const actual = e.map_exw_invoke(thunk) >>> 0;
    if (expected !== null) assert.equal(actual, expected, name + ': ' + label);
    assert.equal(view.getUint32(regs, true), actual, name + ' EAX');
    assert.equal(view.getUint32(regs + 16, true), stack + 4 + args.length * 4, name + ' stdcall ESP');
    for (const i of [1, 2, 3, 5, 6, 7])
      assert.equal(view.getUint32(regs + i * 4, true), 0x41320000 + i, name + ' register ' + i);
    assert.deepEqual(Buffer.from(stackBytes), savedStack, name + ' stack arguments and surrounding canaries');
    assert.deepEqual(Buffer.from(sentinels), savedSentinels, name + ' unrelated memory');
    return actual;
  }
  const hkl = invoke('GetKeyboardLayout', [0], 0x04090409, 'supported current US layout');
  invoke('MapVirtualKeyExA', [0x41, 0, hkl], 0x1e, 'independent A scan control');
  invoke('MapVirtualKeyW', [0x41, 2], 0x41, 'documented uppercase character control');
  assert.notEqual(entries.get('MapVirtualKeyExW').id, 0xffff, 'public ExW hash lookup is missing');
  assert.ok(entries.get('MapVirtualKeyExW').thunk, 'public ExW resolution is missing');
  const cases = [];
  const add = (code, type, expected, label) => cases.push([code, type, expected, label]);
  for (const [vk, scan, label] of [[0x41, 0x1e, 'A'], [0x5a, 0x2c, 'Z'], [0x31, 0x02, '1'], [0x20, 0x39, 'Space']]) {
    add(vk, 0, scan, label); add(vk, 4, scan, label);
    add(scan, 1, vk, label); add(scan, 3, vk, label);
    add(vk, 2, vk, label + ' unshifted character');
  }
  for (const [generic, scan, label] of [[0x10, 0x2a, 'Shift'], [0x11, 0x1d, 'Ctrl'], [0x12, 0x38, 'Alt']]) {
    add(generic, 0, scan, label + ' left default');
    add(generic, 4, scan, label + ' left default');
    add(scan, 1, generic, label + ' nondirectional');
  }
  add(0x36, 1, 0x10, 'right Shift nondirectional');
  for (const [vk, scan, label] of [
    [0xa0, 0x2a, 'left Shift'], [0xa1, 0x36, 'right Shift'],
    [0xa2, 0x1d, 'left Ctrl'], [0xa3, 0xe01d, 'right Ctrl'],
    [0xa4, 0x38, 'left Alt'], [0xa5, 0xe038, 'right Alt'],
  ]) { add(vk, 4, scan, label); add(scan, 3, vk, label); }
  for (const [vk, scan, label] of [
    [0x24, 0xe047, 'Home'], [0x26, 0xe048, 'Up'], [0x21, 0xe049, 'PageUp'],
    [0x25, 0xe04b, 'Left'], [0x27, 0xe04d, 'Right'], [0x23, 0xe04f, 'End'],
    [0x28, 0xe050, 'Down'], [0x22, 0xe051, 'PageDown'],
    [0x2d, 0xe052, 'Insert'], [0x2e, 0xe053, 'Delete'],
    [0x2c, 0xe037, 'Snapshot'], [0x5b, 0xe05b, 'left Windows'],
    [0x5c, 0xe05c, 'right Windows'], [0x5d, 0xe05d, 'Applications'],
    [0x6f, 0xe035, 'keypad Divide'],
  ]) { add(vk, 4, scan, label); add(scan, 3, vk, label); }
  for (const [vk, scan, label] of [
    [0x60, 0x52, 'keypad 0'], [0x61, 0x4f, 'keypad 1'],
    [0x62, 0x50, 'keypad 2'], [0x63, 0x51, 'keypad 3'],
    [0x64, 0x4b, 'keypad 4'], [0x65, 0x4c, 'keypad 5'],
    [0x66, 0x4d, 'keypad 6'], [0x67, 0x47, 'keypad 7'],
    [0x68, 0x48, 'keypad 8'], [0x69, 0x49, 'keypad 9'],
    [0x6a, 0x37, 'keypad Multiply'], [0x6b, 0x4e, 'keypad Add'],
    [0x6d, 0x4a, 'keypad Subtract'], [0x6e, 0x53, 'keypad Decimal'],
  ]) { add(vk, 0, scan, label); add(vk, 4, scan, label); }
  // Code zero is not a key in the documented US Scan 1 / VK identities.
  for (const type of [0, 1, 2, 3, 4]) add(0, type, 0, 'unmappable zero');
  // Current supported US layout only; no claims about other locale handles.
  for (const [code, type, expected, label] of cases) {
    invoke('MapVirtualKeyExW', [code, type, hkl], expected, label);
    invoke('MapVirtualKeyExA', [code, type, hkl], expected, label);
    invoke('MapVirtualKeyW', [code, type], expected, label);
  }
  console.log('PASS public MapVirtualKeyExW: ' + cases.length + ' independent literal cases x ExW/ExA/W; lookup, resolver, dispatch, ABI and memory sentinels');
})().catch(error => { console.error(error); process.exitCode = 1; });
