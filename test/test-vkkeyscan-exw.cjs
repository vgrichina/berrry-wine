#!/usr/bin/env node
'use strict';
// Public WCHAR/HKL/SHORT contract and modifier bits:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-vkkeyscanexw
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-vkkeyscanexa
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-vkkeyscanw
// Independent literal US character/shift columns (not runtime W equality):
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const table = require('../src/api_table.json');
const keys = [
  [0x41,'a','A'], [0x42,'b','B'], [0x43,'c','C'], [0x44,'d','D'],
  [0x45,'e','E'], [0x46,'f','F'], [0x47,'g','G'], [0x48,'h','H'],
  [0x49,'i','I'], [0x4a,'j','J'], [0x4b,'k','K'], [0x4c,'l','L'],
  [0x4d,'m','M'], [0x4e,'n','N'], [0x4f,'o','O'], [0x50,'p','P'],
  [0x51,'q','Q'], [0x52,'r','R'], [0x53,'s','S'], [0x54,'t','T'],
  [0x55,'u','U'], [0x56,'v','V'], [0x57,'w','W'], [0x58,'x','X'],
  [0x59,'y','Y'], [0x5a,'z','Z'],
  [0x30,'0',')'], [0x31,'1','!'], [0x32,'2','@'], [0x33,'3','#'],
  [0x34,'4','$'], [0x35,'5','%'], [0x36,'6','^'], [0x37,'7','&'],
  [0x38,'8','*'], [0x39,'9','('],
  [0xba,';',':'], [0xbb,'=','+'], [0xbc,',','<'], [0xbd,'-','_'],
  [0xbe,'.','>'], [0xbf,'/','?'], [0xc0,'`','~'], [0xdb,'[','{'],
  [0xdc,'\\','|'], [0xdd,']','}'], [0xde,"'",'"'],
];
const oracle = keys.flatMap(([vk, plain, shifted]) =>
  [[plain.charCodeAt(0), vk], [shifted.charCodeAt(0), 0x100 | vk]]);
// Direct keys plus US aVkToWch3/4 control columns; prefer direct keys for
// BS/TAB/CR/ESC. Ctrl+Shift is modifier state 3, Ctrl alone is state 2.
oracle.push([0x20,0x20], [0x08,0x08], [0x09,0x09], [0x0d,0x0d], [0x1b,0x1b],
  [0x00,0x0332], [0x03,0x0003], [0x0a,0x020d], [0x1c,0x02dc],
  [0x1d,0x02dd], [0x1e,0x0336], [0x1f,0x03bd], [0x7f,0x0208]);
// None of these WCHARs occurs in any US character column. Many have an
// ASCII low byte which WOULD translate after an incorrect CHAR truncation.
const untranslated = [0x0141,0x0161,0x0130,0x013f,0x0108,0x0109,0x010d,0x011b,0x0120,0x20ac,0xffff];
oracle.push(...untranslated.map(ch => [ch, 0xffff]));
const extraWat = String.raw`
  (func (export "vks_init")
    (global.set $thunk_guest_base (i32.add (global.get $image_base)
      (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
    (call $update_thunk_end))
  (func (export "vks_regs") (result i32) (global.get $reg_base))
  (func (export "vks_id") (param $name i32) (result i32)
    (call $lookup_api_id (call $g2w (local.get $name))))
  (func (export "vks_module") (param $name i32) (result i32)
    (call $handle_LoadLibraryA (local.get $name) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "vks_resolve") (param $module i32) (param $name i32) (result i32)
    (call $handle_GetProcAddress (local.get $module) (local.get $name)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "vks_invoke") (param $thunk i32) (result i32)
    (call $win32_dispatch (i32.div_u
      (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8)))
    (i32.load (global.get $reg_base)))`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
  e.heap_init(0x800000);
  e.vks_init();
  const view = new DataView(memory.buffer), regs = e.vks_regs() >>> 0;
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const stackArea = e.guest_alloc(128) >>> 0;
  let stack = stackArea + 32;
  const stackBytes = new Uint8Array(memory.buffer, wa(stackArea), 128);
  const sentinel = e.guest_alloc(64) >>> 0;
  const sentinels = new Uint8Array(memory.buffer, wa(sentinel), 64);
  const str = s => {
    const p = e.guest_alloc(s.length + 1) >>> 0;
    new Uint8Array(memory.buffer, wa(p), s.length + 1).set(Buffer.from(s + '\0'));
    return p;
  };
  view.setUint32(regs + 16, stack, true);
  const user32 = e.vks_module(str('user32.dll')) >>> 0;
  assert.ok(user32, 'public USER32 module');

  const names = ['VkKeyScanW','VkKeyScanA','VkKeyScanExA','VkKeyScanExW'];
  const entries = new Map();
  for (const name of ['GetKeyboardLayout', ...names]) {
    const p = str(name), id = e.vks_id(p) >>> 0;
    view.setUint32(regs + 16, stack, true);
    const thunk = e.vks_resolve(user32, p) >>> 0;
    entries.set(name, {id, thunk});
    if (thunk) assert.equal(view.getUint32(wa(thunk) + 4, true), id, name + ' thunk ID');
  }
  console.log(JSON.stringify({publicLookup: Object.fromEntries(entries)}));
  let calls = 0;
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
    const beforeEip = e.get_eip();
    const actual = e.vks_invoke(thunk) >>> 0;
    if (expected !== null) assert.equal(actual & 0xffff, expected, name + ': ' + label);
    assert.equal(view.getUint32(regs, true), actual, name + ' EAX');
    assert.equal(view.getUint32(regs + 16, true), stack + 4 + args.length * 4, name + ' stdcall ESP');
    for (const i of [1, 2, 3, 5, 6, 7])
      assert.equal(view.getUint32(regs + i * 4, true), 0x41320000 + i, name + ' register ' + i);
    assert.deepEqual(Buffer.from(stackBytes), savedStack, name + ' stack arguments and surrounding canaries');
    assert.deepEqual(Buffer.from(sentinels), savedSentinels, name + ' unrelated memory');
    assert.equal(e.get_eip(), beforeEip, name + ' direct dispatch preserves EIP');
    ++calls;
    return actual;
  }

  const hkl = invoke('GetKeyboardLayout', [0], null, 'supported layout');
  assert.equal(hkl, 0x04090409, 'supported US layout');
  function check(which, ch, expected) {
    const args = which >= 2 ? [ch, hkl] : [ch];
    invoke(names[which], args, expected, 'documented WCHAR/CHAR 0x' + (ch >>> 0).toString(16));
  }
  // Actual compiled parent resolves USER32 and calls W/A/ExA before asserting
  // ExW exists. Missing ExW is proved by public lookup, never a compile error.
  for (const [ch, expected] of oracle) check(0, ch, expected);
  for (const which of [1,2]) {
    for (const [ch, expected] of oracle.filter(([ch]) => ch < 0x100)) check(which, ch, expected);
    check(which, 0x0161, 0x41); // Existing CHAR masking differs from WCHAR.
  }
  console.log(JSON.stringify({priorCalls: calls, missingExW: entries.get('VkKeyScanExW')}));
  assert.notEqual(entries.get('VkKeyScanExW').id, 0xffff, 'public VkKeyScanExW lookup must resolve');
  assert.ok(entries.get('VkKeyScanExW').thunk, 'public VkKeyScanExW resolver');
  for (let repeat = 0; repeat < 2; repeat++) {
    stack = stackArea + 32 + repeat * 4;
    for (const [ch, expected] of oracle) check(3, ch, expected);
    for (const pair of [[0x00010061,0x41], [0xabcd0041,0x141], [0xffff0161,0xffff]]) check(3, ...pair);
  }
  console.log('PASS VkKeyScanExW public USER32 lookup/resolver/thunk dispatch: independent literal US oracle, full WCHAR, stdcall/register/EIP/stack/memory canaries (' + calls + ' calls)');
})().catch(error => { console.error(error); process.exitCode = 1; });
