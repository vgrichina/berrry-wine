#!/usr/bin/env node
'use strict';
// Literal US Scan 1 Make and virtual-key values, independently documented:
// https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeya
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('../tools/watx');
const source = fs.readFileSync(path.join(__dirname, '../src/09a7-handlers-dispatch.wat'), 'utf8');

function form(marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, marker);
  let depth = 0, quoted = false, line = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (line) { if (c === '\n') line = false; continue; }
    if (quoted) { if (c === '\\') i++; else if (c === '"') quoted = false; continue; }
    if (c === ';' && source[i + 1] === ';') { line = true; i++; continue; }
    if (c === '"') { quoted = true; continue; }
    if (c === '(') depth++;
    if (c === ')' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail('unclosed ' + marker);
}

const names = ['vk_to_scan', 'handle_MapVirtualKeyA', 'handle_MapVirtualKeyW', 'handle_MapVirtualKeyExA'];
const compiled = compile([
  '(memory 1) (export "memory" (memory 0))',
  '(region.declare $VK_SCAN_TABLES (size 128) (align 128))',
  '(region.declare $TEST_REGS (size 32) (align 32))',
  '(global $reg_base i32 (region.addr $TEST_REGS 0))',
  '(export "regs" (global $reg_base))',
  ...names.map(name => form('(func $' + name + ' ')),
  form('(data (region.addr $VK_SCAN_TABLES 0x00)'),
  form('(data (region.addr $VK_SCAN_TABLES 0x20)'),
  ...names.slice(1).map(name => '(export "' + name + '" (func $' + name + '))'),
].join('\n'), new Map(), { mode: 'production' });
assert.ok(compiled.success, compiled.error);
const wasm = new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary)).exports;
const regs = new DataView(wasm.memory.buffer, wasm.regs.value, 32);
let checked = 0;
const failures = [];
function expect(code, type, expected, label) {
  for (const name of names.slice(1)) {
    for (let i = 0; i < 8; i++) regs.setUint32(i * 4, 0x12340000 + i, true);
    wasm[name](code, type, 0, 0, 0, 0);
    const actual = regs.getUint32(0, true);
    if (actual !== expected) failures.push({ name, code, type, label, expected, actual });
    assert.equal(regs.getUint32(16, true), 0x12340004 + (name.endsWith('ExA') ? 16 : 12), 'stdcall stack');
    for (const offset of [4, 8, 12, 20, 24, 28])
      assert.equal(regs.getUint32(offset, true), 0x12340000 + offset / 4, 'preserve other registers');
    checked++;
  }
}
// Right Shift is not E0-prefixed. Ctrl/Alt require E0 in the high byte
// to select the right-hand key; stripping it would select the left key.
for (const [scan, key, label] of [
  [0x002a, 0xa0, 'left Shift'], [0x0036, 0xa1, 'right Shift'],
  [0x001d, 0xa2, 'left Ctrl'], [0xe01d, 0xa3, 'right Ctrl'],
  [0x0038, 0xa4, 'left Alt'], [0xe038, 0xa5, 'right Alt'],
]) expect(scan, 3, key, label);

// Keep this change confined to ordinary modifier codes and type 3. Other
// translations are existing compatibility behavior, not a new layout oracle.
for (const [code, type, key] of [
  [0x2a, 1, 0x10], [0x36, 1, 0x10], [0x1d, 1, 0x11], [0x38, 1, 0x12],
  [0x10, 0, 0x2a], [0x11, 0, 0x1d], [0x12, 0, 0x38],
  [0x41, 0, 0x1e], [0x1e, 1, 0x41], [0xbf, 2, 0x2f],
  [0x41, 3, 0], [0, 3, 0], [0x59, 3, 0], [0xff, 3, 0],
  [0x2a, 4, 0], [0xe01d, 0xffffffff, 0],
]) expect(code, type, key, 'retained mapping ' + code.toString(16) + '/' + type);
assert.deepEqual(failures, [], 'literal modifier translation failures: ' + JSON.stringify(failures));
console.log('PASS MapVirtualKey ordinary US modifiers: ' + checked + ' literal cases, A/W/ExA, left/right, E0 prefix, existing mappings and ABI');
