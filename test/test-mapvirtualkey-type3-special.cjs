#!/usr/bin/env node
'use strict';
// Independent literal US Scan 1 Make identities and virtual keys:
// https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
// Type 3 accepts the E0 prefix in uCode's high byte (public A/W/ExA docs):
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeya
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const { compile } = require(path.join(root, 'tools/watx'));
const source = fs.readFileSync(path.join(root, 'src/09a7-handlers-dispatch.wat'), 'utf8');
function extract(marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, marker);
  let depth = 0, string = false, comment = false;
  for (let i = start; i < source.length; ++i) {
    const c = source[i];
    if (comment) { if (c === '\n') comment = false; continue; }
    if (string) { if (c === '\\') ++i; else if (c === '"') string = false; continue; }
    if (c === ';' && source[i + 1] === ';') { comment = true; ++i; continue; }
    if (c === '"') { string = true; continue; }
    if (c === '(') ++depth;
    if (c === ')' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail('Unclosed ' + marker);
}
const apis = ['handle_MapVirtualKeyA', 'handle_MapVirtualKeyW', 'handle_MapVirtualKeyExA'];
const wat = [
  '(memory 1) (export "memory" (memory 0))',
  '(region.declare $VK_SCAN_TABLES (size 128) (align 128))',
  '(region.declare $TEST_REGS (size 32) (align 32))',
  '(global $reg_base i32 (region.addr $TEST_REGS 0)) (export "regs" (global $reg_base))',
  ...['vk_to_scan', ...apis].map(n => extract('(func $' + n + ' ')),
  extract('(data (region.addr $VK_SCAN_TABLES 0x00)'),
  extract('(data (region.addr $VK_SCAN_TABLES 0x20)'),
  ...apis.map(n => '(export "' + n + '" (func $' + n + '))'),
].join('\n');
const compiled = compile(wat, new Map(), { mode: 'production' });
assert.ok(compiled.success, compiled.error);
const wasm = new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary)).exports;
const regs = new DataView(wasm.memory.buffer, wasm.regs.value, 32);
const failures = [];
let checked = 0;
for (const [scan, expected, label] of [
  [0xe037, 0x2c, 'Snapshot'], [0xe05b, 0x5b, 'LeftWindows'],
  [0xe05c, 0x5c, 'RightWindows'], [0xe05d, 0x5d, 'Applications'],
  [0xe035, 0x6f, 'KeypadDivide'],
]) for (const api of apis) {
  for (let r = 0; r < 8; ++r) regs.setUint32(r * 4, 0x41410000 + r, true);
  wasm[api](scan, 3, 0, 0, 0, 0);
  const actual = regs.getUint32(0, true);
  if (actual !== expected) failures.push({api, scan, expected, actual, label});
  assert.equal(regs.getUint32(16, true), 0x41410004 + (api.endsWith('ExA') ? 16 : 12), api + ' stack');
  for (const r of [1, 2, 3, 5, 6, 7]) assert.equal(regs.getUint32(r * 4, true), 0x41410000 + r, api + ' register ' + r);
  ++checked;
}
console.log(JSON.stringify({checked, failures}));
assert.deepEqual(failures, [], 'Full-prefix type 3 special scan translations');
console.log('PASS MapVirtualKey type3 five special E0 scans: 15 public A/W/ExA cases and ABI');
