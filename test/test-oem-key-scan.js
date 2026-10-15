#!/usr/bin/env node
'use strict';

// Execute production WAT functions/data in a one-page WATX fixture, not a JS
// implementation of the mapping and not a full emulator build.
// Contracts:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-oemkeyscan
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// https://github.com/wine-mirror/wine/blob/master/dlls/user32/tests/input.c (test_OemKeyScan)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('../tools/watx');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

// Balanced form extraction understands strings and WAT line comments.
function form(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'missing production form: ' + marker);
  let depth = 0, string = false, comment = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (comment) { if (c === '\n') comment = false; continue; }
    if (string) {
      if (c === '\\') i++;
      else if (c === '"') string = false;
      continue;
    }
    if (c === ';' && source[i + 1] === ';') { comment = true; i++; continue; }
    if (c === '"') { string = true; continue; }
    if (c === '(') depth++;
    if (c === ')' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail('unclosed form: ' + marker);
}

const base = read('src/09a0-handlers-base.wat');
const dispatch = read('src/09a7-handlers-dispatch.wat');
const funcs = ['vk_to_scan', 'oem_key_scan', 'handle_OemKeyScan', 'handle_MapVirtualKeyA'];
const body = [
  form(base, '(func $vk_key_scan '),
  ...funcs.map(name => form(dispatch, '(func $' + name + ' ')),
  form(dispatch, '(data (region.addr $VK_SCAN_TABLES 0x00)'),
  form(dispatch, '(data (region.addr $VK_SCAN_TABLES 0x20)'),
].join('\n');

function instantiate(source = body) {
  const result = compile(
    '(memory 1)\n(export "memory" (memory 0))\n' +
    '(region.declare $VK_SCAN_TABLES (size 128) (align 128))\n' +
    '(region.declare $TEST_REGS (size 32) (align 32))\n' +
    '(global $reg_base i32 (region.addr $TEST_REGS 0))\n' +
    '(export "reg_base" (global $reg_base))\n' +
    source + '\n' +
    '(export "oem" (func $oem_key_scan))\n' +
    '(export "handle" (func $handle_OemKeyScan))\n' +
    '(export "map" (func $handle_MapVirtualKeyA))\n' +
    '(export "vk" (func $vk_key_scan))', new Map(), { mode: 'production' });
  assert.ok(result.success, result.error);
  return new WebAssembly.Instance(new WebAssembly.Module(result.wasmBinary)).exports;
}

function checkRegistration(table = JSON.parse(read('src/api_table.json'))) {
  const api = table.find(entry => entry.name === 'OemKeyScan');
  assert.ok(api, 'OemKeyScan registered');
  assert.equal(api.id, table.indexOf(api));
  assert.equal(api.nargs, 1);
  assert.equal(api.convention, 'stdcall');
  assert.match(read('src/09b2-dispatch-table.generated.wat'), /\(call \$handle_OemKeyScan /);
  const row = read('src/01b-api-hashes.generated.wat').split('\n')
    .find(line => line.endsWith(': OemKeyScan'));
  assert.ok(row, 'OemKeyScan hash row');
  const bytes = Buffer.from([...row.matchAll(/\\([0-9a-f]{2})/g)].map(m => parseInt(m[1], 16)));
  assert.equal(bytes.readUInt32LE(0), api.hash);
  assert.equal(bytes.readUInt32LE(4), api.id);
}
checkRegistration();
assert.throws(() => checkRegistration(JSON.parse(read('src/api_table.json'))
  .filter(entry => entry.name !== 'OemKeyScan')), /OemKeyScan registered/);

const wasm = instantiate();
const regs = new DataView(wasm.memory.buffer, wasm.reg_base.value, 32);
function expect(ch, value) {
  assert.equal(wasm.oem(ch) >>> 0, value >>> 0, 'OEM character ' + ch.toString(16));
  regs.setUint32(0, 0xdeadbeef, true);
  regs.setUint32(16, 0x12345678, true);
  regs.setUint32(4, 0xa5a5a5a5, true);
  wasm.handle(ch, 0, 0, 0, 0, 0);
  assert.equal(regs.getUint32(0, true), value >>> 0, 'EAX');
  assert.equal(regs.getUint32(16, true), 0x12345680, 'stdcall ret + one argument');
  assert.equal(regs.getUint32(4, true), 0xa5a5a5a5, 'other register preserved');
}
// Physical US rows give independent expected scan codes for every printable
// ASCII key, including both modifier states.
for (const [plain, shifted, first] of [
  ['1234567890-=', '!@#$%^&*()_+', 2],
  ['qwertyuiop[]', 'QWERTYUIOP{}', 0x10],
  ["asdfghjkl;'", 'ASDFGHJKL:"', 0x1e],
  ['zxcvbnm,./', 'ZXCVBNM<>?', 0x2c],
  ['`', '~', 0x29],
  ['\\', '|', 0x2b],
]) {
  for (let i = 0; i < plain.length; i++) {
    expect(plain.charCodeAt(i), first + i);
    expect(shifted.charCodeAt(i), 0x10000 | (first + i));
  }
}
for (const [ch, result] of [
  [0, 0x30003], [3, 0x46], [8, 0x0e], [9, 0x0f], [10, 0x2001c],
  [13, 0x1c], [27, 1], [28, 0x2002b], [29, 0x2001b],
  [30, 0x30007], [31, 0x3000c], [32, 0x39], [127, 0x2000e],
]) expect(ch, result);
// The current reverse layout has no mapping for these control characters.
for (const ch of [1, 2, 4, 5, 6, 7, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26])
  expect(ch, -1);
// CP437 accented letters, box drawing, Greek, NBSP: no US single keystroke.
for (let ch = 128; ch < 256; ch++) expect(ch, -1);
for (const ch of [0x100, 0x141, 0x17f, 0x180, 0xff41, 0xffff, 0x10041, -1])
  expect(ch, wasm.oem(ch & 255));

// MapVirtualKey still delegates type 0 to the same mapping; its ABI differs.
for (const [key, type, expected] of [[0x41, 0, 0x1e], [8, 0, 0x0e],
  [0x70, 0, 0x3b], [0x7b, 0, 0x58], [0xff, 0, 0],
  [0x1e, 1, 0x41], [0xbf, 2, 0x2f], [0x41, 3, 0]]) {
  regs.setUint32(16, 100, true);
  wasm.map(key, type, 0, 0, 0, 0);
  assert.equal(regs.getUint32(0, true), expected);
  assert.equal(regs.getUint32(16, true), 112);
}

// Negative controls execute mutated WAT, proving the probes catch wrong
// modifier packing and silent success on an unmappable OEM character.
const wrongShift = instantiate(body.replace(
  '(i32.const 0xFF00)) (i32.const 8)', '(i32.const 0xFF00)) (i32.const 0)'));
assert.throws(() => assert.equal(wrongShift.oem(65), 0x1001e), assert.AssertionError);
const wrongFailure = instantiate(body.replace(
  '(then (return (i32.const -1))))', '(then (return (i32.const 0))))'));
assert.throws(() => assert.equal(wrongFailure.oem(0x82), -1), assert.AssertionError);
console.log('PASS OemKeyScan: production WAT, printable ASCII, controls, 128 OEM failures, WORD aliases, ABI, registration, negative controls');
