#!/usr/bin/env node
'use strict';
// Literal US VK/Scan 1 Make pairs, independent of the runtime lookup tables:
// https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input#scan-codes
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeya
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('../tools/watx');
const source = fs.readFileSync(path.join(__dirname, '../src/09a7-handlers-dispatch.wat'), 'utf8');
function form(marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, 'missing ' + marker);
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
const handlers = ['handle_MapVirtualKeyA', 'handle_MapVirtualKeyW', 'handle_MapVirtualKeyExA'];
const compiled = compile([
  '(memory 1) (export "memory" (memory 0))',
  '(region.declare $VK_SCAN_TABLES (size 128) (align 128))',
  '(region.declare $TEST_REGS (size 32) (align 32))',
  '(global $reg_base i32 (region.addr $TEST_REGS 0))',
  '(export "regs" (global $reg_base))',
  form('(func $vk_to_scan '),
  ...handlers.map(name => form('(func $' + name + ' ')),
  form('(data (region.addr $VK_SCAN_TABLES 0x00)'),
  form('(data (region.addr $VK_SCAN_TABLES 0x20)'),
  ...handlers.map(name => '(export "' + name + '" (func $' + name + '))'),
].join('\n'), new Map(), { mode: 'production' });
assert.ok(compiled.success, compiled.error);
const wasm = new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary)).exports;
const regs = new DataView(wasm.memory.buffer, wasm.regs.value, 32);
// [virtual key, scan code]; no expected value is read from production data.
const ordinary = [
  [0x41,0x1e], [0x42,0x30], [0x43,0x2e], [0x44,0x20], [0x45,0x12],
  [0x46,0x21], [0x47,0x22], [0x48,0x23], [0x49,0x17], [0x4a,0x24],
  [0x4b,0x25], [0x4c,0x26], [0x4d,0x32], [0x4e,0x31], [0x4f,0x18],
  [0x50,0x19], [0x51,0x10], [0x52,0x13], [0x53,0x1f], [0x54,0x14],
  [0x55,0x16], [0x56,0x2f], [0x57,0x11], [0x58,0x2d], [0x59,0x15], [0x5a,0x2c],
  [0x30,0x0b], [0x31,0x02], [0x32,0x03], [0x33,0x04], [0x34,0x05],
  [0x35,0x06], [0x36,0x07], [0x37,0x08], [0x38,0x09], [0x39,0x0a],
  [0xba,0x27], [0xbb,0x0d], [0xbc,0x33], [0xbd,0x0c], [0xbe,0x34],
  [0xbf,0x35], [0xc0,0x29], [0xdb,0x1a], [0xdc,0x2b], [0xdd,0x1b], [0xde,0x28],
  [0x70,0x3b], [0x71,0x3c], [0x72,0x3d], [0x73,0x3e], [0x74,0x3f],
  [0x75,0x40], [0x76,0x41], [0x77,0x42], [0x78,0x43], [0x79,0x44],
  [0x7a,0x57], [0x7b,0x58],
  [0x08,0x0e], [0x09,0x0f], [0x0d,0x1c], [0x1b,0x01], [0x20,0x39],
];
const modifiers = [
  [0x10,0x002a], [0x11,0x001d], [0x12,0x0038], // generic chooses left
  [0xa0,0x002a], [0xa1,0x0036], // right Shift has no E0 prefix
  [0xa2,0x001d], [0xa3,0xe01d], [0xa4,0x0038], [0xa5,0xe038],
];
let checked = 0;
const failures = [];
function expect(code, type, expected) {
  for (const name of handlers) {
    for (let i = 0; i < 8; i++) regs.setUint32(i * 4, 0x12340000 + i, true);
    wasm[name](code, type, 0, 0, 0, 0);
    const actual = regs.getUint32(0, true);
    if (actual !== expected) failures.push({ name, code, type, expected, actual });
    assert.equal(regs.getUint32(16, true), 0x12340004 + (name.endsWith('ExA') ? 16 : 12), 'stdcall cleanup');
    for (const offset of [4,8,12,20,24,28])
      assert.equal(regs.getUint32(offset, true), 0x12340000 + offset / 4, 'preserve other registers');
    checked++;
  }
}
for (const [vk, scan] of [...ordinary, ...modifiers]) expect(vk, 4, scan);
// Nonmodifier E0/E1 translations are outside this implementation. In type 4,
// 0x2A means VK_PRINT, not the left Shift scan code, and remains unsupported.
for (const vk of [0x03,0x13,0x21,0x22,0x23,0x24,0x25,0x26,0x27,0x28,
  0x2a,0x2c,0x2d,0x2e,0x5b,0x5c,0x5d,0x6f,0x90,0,0xff]) expect(vk, 4, 0);
// Existing map types keep their established behavior.
for (const [code,type,expected] of [
  [0x41,0,0x1e], [0x25,0,0x4b], [0x03,0,0x46],
  [0x2a,1,0x10], [0x1e,1,0x41], [0xbf,2,0x2f],
  [0x2a,3,0xa0], [0x36,3,0xa1], [0xe01d,3,0xa3], [0xe038,3,0xa5],
]) expect(code,type,expected);
console.log(JSON.stringify({checked, failures}));
assert.deepEqual(failures, [], 'literal type 4 / retained mapping failures');
console.log('PASS MapVirtualKey type 4: literal US keys, generic/side modifiers, E0 results, A/W/ExA and ABI (' + checked + ' cases)');
