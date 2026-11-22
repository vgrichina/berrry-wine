#!/usr/bin/env node
'use strict';
// Independent literal Microsoft US Scan 1 Make / VK identities and type 4 contract:
// https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input#scan-codes
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeya
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyw
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyexa
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { compile } = require(path.join(root, 'tools/watx'));
const source = fs.readFileSync(path.join(root, 'src/09a7-handlers-dispatch.wat'), 'utf8');
function extract(marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, marker);
  let depth = 0, line = false, string = false;
  for (let i = start; i < source.length; ++i) {
    const c = source[i];
    if (line) { if (c === '\n') line = false; continue; }
    if (string) { if (c === '\\') ++i; else if (c === '"') string = false; continue; }
    if (c === ';' && source[i + 1] === ';') { line = true; ++i; continue; }
    if (c === '"') { string = true; continue; }
    if (c === '(') ++depth;
    if (c === ')' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail('unclosed ' + marker);
}
const names = ['handle_MapVirtualKeyA', 'handle_MapVirtualKeyW', 'handle_MapVirtualKeyExA'];
const result = compile([
  '(memory 1) (export "memory" (memory 0))',
  '(region.declare $VK_SCAN_TABLES (size 128) (align 128))',
  '(region.declare $SPECIAL_TEST_REGS (size 32) (align 32))',
  '(global $reg_base i32 (region.addr $SPECIAL_TEST_REGS 0))',
  '(export "regs" (global $reg_base))',
  extract('(func $vk_to_scan '),
  ...names.map(n => extract('(func $' + n + ' ')),
  extract('(data (region.addr $VK_SCAN_TABLES 0x00)'),
  extract('(data (region.addr $VK_SCAN_TABLES 0x20)'),
  ...names.map(n => '(export "' + n + '" (func $' + n + '))'),
].join('\n'), new Map(), { mode: 'production' });
assert.ok(result.success, result.error);
const api = new WebAssembly.Instance(new WebAssembly.Module(result.wasmBinary)).exports;
const bytes = new Uint8Array(api.memory.buffer);
const regs = new DataView(api.memory.buffer, api.regs.value, 32);
const special = [
  [0x2c, 0xe037, 'Snapshot'],
  [0x5b, 0xe05b, 'Left Windows'],
  [0x5c, 0xe05c, 'Right Windows'],
  [0x5d, 0xe05d, 'Applications'],
  [0x6f, 0xe035, 'Keypad Divide'],
];
const cases = special.map(([vk, scan, label]) => [vk, 4, scan, label]);
// Retained compatibility controls are not claims of additional Windows support.
for (const [vk, scan] of [
  [0x41,0x1e], [0x30,0x0b], [0xbf,0x35], [0x70,0x3b], [0x7b,0x58],
  [0x10,0x2a], [0x11,0x1d], [0x12,0x38],
  [0xa0,0x2a], [0xa1,0x36], [0xa2,0x1d], [0xa3,0xe01d], [0xa4,0x38], [0xa5,0xe038],
]) cases.push([vk,4,scan,'retained ordinary/modifier']);
for (const vk of [0x03,0x13,0x2a,0x90,0,0xff]) cases.push([vk,4,0,'retained unsupported E0/E1/VK']);
for (const [vk,scan] of special) {
  cases.push([vk,0,0,'retained type 0 special']);
  cases.push([scan,3,vk,'documented type 3 special']);
}
for (const [vk,scan] of [[0x24,0xe047],[0x26,0xe048],[0x21,0xe049],[0x25,0xe04b],[0x27,0xe04d],[0x23,0xe04f],[0x28,0xe050],[0x22,0xe051],[0x2d,0xe052],[0x2e,0xe053]]) cases.push([vk,4,scan,'retained navigation']);
for (const scan of [0xe11d,0xe11e,0xe01e]) cases.push([scan,3,0,'retained unsupported E0/E1']);
for (const c of [
  [0x25,0,0x4b], [0x03,0,0x46], [0x41,0,0x1e],
  [0x2a,3,0xa0], [0x36,3,0xa1], [0x1d,3,0xa2], [0xe01d,3,0xa3],
  [0x38,3,0xa4], [0xe038,3,0xa5], [0x35,3,0xbf], [0x37,3,0x6a],
]) cases.push([...c,'retained type 0/3']);
let checked = 0;
const failures = [];
for (const [code,type,expected,label] of cases) for (const name of names) {
  for (let i = 0; i < 8; ++i) regs.setUint32(i * 4, 0x13570000 + i, true);
  const before = bytes.slice();
  api[name](code,type,0,0,0,0);
  const actual = regs.getUint32(0,true);
  if (actual !== expected) failures.push({name,code,type,expected,actual,label});
  assert.equal(regs.getUint32(16,true),0x13570004 + (name.endsWith('ExA') ? 16 : 12),'stdcall cleanup');
  for (const offset of [4,8,12,20,24,28])
    assert.equal(regs.getUint32(offset,true),0x13570000 + offset / 4,'register preservation');
  before.set(bytes.subarray(api.regs.value,api.regs.value + 4),api.regs.value);
  before.set(bytes.subarray(api.regs.value + 16,api.regs.value + 20),api.regs.value + 16);
  assert.deepEqual(bytes,before,'only EAX/ESP may change');
  ++checked;
}
console.log(JSON.stringify({checked,failures}));
assert.deepEqual(failures,[],'type 4 special VK literal mappings');
console.log('PASS MapVirtualKey type 4 special US keys: ' + checked + ' A/W/ExA cases, retained mappings and ABI');
