#!/usr/bin/env node
'use strict';
// Independent literal US keypad oracle, joined by physical key identity:
// Scan 1 Make (Keypad 0..9, Star, Plus, Dash, Period):
// https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input#scan-codes
// VK_NUMPAD0..9, VK_MULTIPLY, VK_ADD, VK_SUBTRACT, VK_DECIMAL:
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
// Type 0 translates VK to scan; type 4 includes E0/E1 for extended scans.
// These fourteen keypad scans are nonextended. No reverse-table inversion.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeya
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyw
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyexa
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { compile } = require(path.join(root, 'tools/watx'));
const source = fs.readFileSync(path.join(root, 'src/09a7-handlers-dispatch.wat'), 'utf8');
function form(marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, marker);
  let depth = 0, quoted = false, comment = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (comment) { if (c === '\n') comment = false; continue; }
    if (quoted) { if (c === '\\') i++; else if (c === '"') quoted = false; continue; }
    if (c === ';' && source[i + 1] === ';') { comment = true; i++; continue; }
    if (c === '"') { quoted = true; continue; }
    if (c === '(') depth++;
    if (c === ')' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail('unclosed ' + marker);
}
const names = ['handle_MapVirtualKeyA', 'handle_MapVirtualKeyW', 'handle_MapVirtualKeyExA'];
const input = [
  '(memory 1) (export "memory" (memory 0))',
  '(region.declare $VK_SCAN_TABLES (size 128) (align 128))',
  '(region.declare $KEYPAD_REGS (size 32) (align 32))',
  '(global $reg_base i32 (region.addr $KEYPAD_REGS 0)) (export "regs" (global $reg_base))',
  form('(func $vk_to_scan '),
  ...names.map(n => form('(func $' + n + ' ')),
  form('(data (region.addr $VK_SCAN_TABLES 0x00)'),
  form('(data (region.addr $VK_SCAN_TABLES 0x20)'),
  ...names.map(n => '(export "' + n + '" (func $' + n + '))'),
].join('\n');
const compiled = compile(input, new Map(), { mode: 'production' });
assert.ok(compiled.success, compiled.error);
const api = new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary)).exports;
const memory = new Uint8Array(api.memory.buffer);
const regs = new DataView(api.memory.buffer, api.regs.value, 32);
const keypad = [
  [0x60,0x52,'NUMPAD0'], [0x61,0x4f,'NUMPAD1'], [0x62,0x50,'NUMPAD2'],
  [0x63,0x51,'NUMPAD3'], [0x64,0x4b,'NUMPAD4'], [0x65,0x4c,'NUMPAD5'],
  [0x66,0x4d,'NUMPAD6'], [0x67,0x47,'NUMPAD7'], [0x68,0x48,'NUMPAD8'],
  [0x69,0x49,'NUMPAD9'], [0x6a,0x37,'MULTIPLY'], [0x6b,0x4e,'ADD'],
  [0x6d,0x4a,'SUBTRACT'], [0x6e,0x53,'DECIMAL'],
];
let checked = 0;
const failures = [];
function check(code, type, expected, label) {
  for (const name of names) {
    for (let r = 0; r < 8; r++) regs.setUint32(r * 4, 0x34560000 + r, true);
    const before = memory.slice();
    api[name](code, type, 0x04090409, 0, 0, 0);
    const actual = regs.getUint32(0, true);
    if (actual !== expected) failures.push({ name, code, type, expected, actual, label });
    assert.equal(regs.getUint32(16, true), 0x34560004 + (name.endsWith('ExA') ? 16 : 12), name + ' stack');
    for (const r of [1,2,3,5,6,7]) assert.equal(regs.getUint32(r * 4, true), 0x34560000 + r, name + ' register ' + r);
    // Only EAX and ESP may change anywhere in the fixture memory.
    before.set(memory.subarray(api.regs.value, api.regs.value + 4), api.regs.value);
    before.set(memory.subarray(api.regs.value + 16, api.regs.value + 20), api.regs.value + 16);
    assert.deepEqual(memory, before, name + ' memory outside EAX/ESP');
    checked++;
  }
}
for (const [vk,scan,label] of keypad)
  for (const type of [0,4]) check(vk,type,scan,label);
// Published compatibility controls, not new oracle claims about other keys.
for (const c of [
  [0x41,0,0x1e,'A'], [0x30,0,0x0b,'top row 0'], [0xbf,0,0x35,'OEM slash'],
  [0x41,4,0x1e,'A type4'], [0x30,4,0x0b,'top row 0 type4'], [0xbf,4,0x35,'OEM slash type4'],
  [0x10,0,0x2a,'Shift'], [0x11,0,0x1d,'Ctrl'], [0x12,0,0x38,'Alt'],
  [0xa0,4,0x2a,'LShift'], [0xa1,4,0x36,'RShift'], [0xa2,4,0x1d,'LCtrl'],
  [0xa3,4,0xe01d,'RCtrl'], [0xa4,4,0x38,'LAlt'], [0xa5,4,0xe038,'RAlt'],
  [0x25,0,0x4b,'Left type0'], [0x26,0,0x48,'Up type0'],
  [0x24,4,0xe047,'Home'], [0x26,4,0xe048,'Up'], [0x21,4,0xe049,'PageUp'],
  [0x25,4,0xe04b,'Left'], [0x27,4,0xe04d,'Right'], [0x23,4,0xe04f,'End'],
  [0x28,4,0xe050,'Down'], [0x22,4,0xe051,'PageDown'], [0x2d,4,0xe052,'Insert'], [0x2e,4,0xe053,'Delete'],
  [0x2c,4,0xe037,'Snapshot'], [0x5b,4,0xe05b,'LWin'], [0x5c,4,0xe05c,'RWin'], [0x5d,4,0xe05d,'Apps'],
  [0x2a,1,0x10,'type1 Shift'], [0x1e,1,0x41,'type1 A'],
  [0x1e,3,0x41,'type3 A'], [0x37,3,0x6a,'published type3 multiply'],
  [0x47,3,0x67,'published type3 nonextended Home scan'],
  [0x4b,3,0x25,'published type3 nonextended Left scan'],
  [0xe037,3,0x2c,'published type3 Snapshot'], [0xe05b,3,0x5b,'published type3 LWin'],
  [0xe05c,3,0x5c,'published type3 RWin'], [0xe05d,3,0x5d,'published type3 Apps'],
  [0,0,0,'retained zero'], [0xff,4,0,'retained unsupported VK'],
]) check(...c);
console.log(JSON.stringify({ checked, keypadChecks: 84, failures }));
assert.deepEqual(failures, [], 'keypad type0/type4 and published compatibility');
console.log('PASS fourteen nonextended US keypad keys: actual A/W/ExA type0/type4, published controls, ABI and memory (' + checked + ' cases)');
