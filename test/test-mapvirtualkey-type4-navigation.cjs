'use strict';
// Independent literal key-identity joins: Microsoft Scan 1 Make and VK tables.
// https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input#scan-codes
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
// Type 4 returns E0/E1 in the high byte for extended scan codes:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeya
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyw
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyexa
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const {compile} = require(path.join(root, 'tools/watx'));
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
const result = compile([
  '(memory 1) (export "memory" (memory 0))',
  '(region.declare $VK_SCAN_TABLES (size 128) (align 128))',
  '(region.declare $NAV_REGS (size 32) (align 32))',
  '(global $reg_base i32 (region.addr $NAV_REGS 0)) (export "regs" (global $reg_base))',
  form('(func $vk_to_scan '),
  ...names.map(n => form('(func $' + n + ' ')),
  form('(data (region.addr $VK_SCAN_TABLES 0x00)'),
  form('(data (region.addr $VK_SCAN_TABLES 0x20)'),
  ...names.map(n => '(export "' + n + '" (func $' + n + '))'),
].join('\n'), new Map(), {mode: 'production'});
assert.ok(result.success, result.error);
const api = new WebAssembly.Instance(new WebAssembly.Module(result.wasmBinary)).exports;
const regs = new DataView(api.memory.buffer, api.regs.value, 32);
// Literal documented US dedicated navigation keys, not keypad twins.
const navigation = [
  [0x24,0xe047,'Home'], [0x26,0xe048,'Up'], [0x21,0xe049,'PageUp'],
  [0x25,0xe04b,'Left'], [0x27,0xe04d,'Right'], [0x23,0xe04f,'End'],
  [0x28,0xe050,'Down'], [0x22,0xe051,'PageDown'],
  [0x2d,0xe052,'Insert'], [0x2e,0xe053,'Delete'],
];
const failures = [];
let checked = 0;
function check(code, type, expected, label) {
  for (const name of names) {
    for (let i = 0; i < 8; i++) regs.setUint32(i * 4, 0x13570000 + i, true);
    api[name](code, type, 0x04090409, 0, 0, 0);
    const actual = regs.getUint32(0, true);
    if (actual !== expected) failures.push({name,code,type,expected,actual,label});
    assert.equal(regs.getUint32(16, true), 0x13570004 + (name.endsWith('ExA') ? 16 : 12), name + ' stdcall');
    for (const r of [1,2,3,5,6,7]) assert.equal(regs.getUint32(r * 4, true), 0x13570000 + r, name + ' register ' + r);
    checked++;
  }
}
for (const [vk,scan,label] of navigation) check(vk,4,scan,label);
// Retained compatibility controls; no new behavior outside the ten type4 VKs.
for (const [code,type,expected] of [
  [0x41,4,0x1e], [0x30,4,0x0b], [0xbf,4,0x35], [0x70,4,0x3b],
  [0x10,4,0x2a], [0x11,4,0x1d], [0x12,4,0x38],
  [0xa0,4,0x2a], [0xa1,4,0x36], [0xa2,4,0x1d],
  [0xa3,4,0xe01d], [0xa4,4,0x38], [0xa5,4,0xe038],
  [0x41,0,0x1e], [0x25,0,0x4b], [0x26,0,0x48], [0x27,0,0x4d], [0x28,0,0x50],
  [0x24,0,0], [0x03,0,0x46], [0xe048,0,0],
  [0x1e,3,0x41], [0x2a,3,0xa0], [0x36,3,0xa1],
  [0xe01d,3,0xa3], [0xe038,3,0xa5],
]) check(code,type,expected,'retained');
for (const [scan,vk] of [
  [0xe047,0x24], [0xe048,0x26], [0xe049,0x21], [0xe04b,0x25], [0xe04d,0x27],
  [0xe04f,0x23], [0xe050,0x28], [0xe051,0x22], [0xe052,0x2d], [0xe053,0x2e],
]) check(scan,3,vk,'retained published type3 navigation');
for (const vk of [0x03,0x13,0x2a,0x90,0,0xff]) check(vk,4,0,'unsupported other VK');
for (const [vk,scan] of [
  [0x2c,0xe037], [0x5b,0xe05b], [0x5c,0xe05c], [0x5d,0xe05d], [0x6f,0xe035],
]) check(vk,4,scan,'documented special E0 scan');
for (const scan of [0xe01e,0xe11d,0xe11e,0xe053]) check(scan,4,0,'type4 takes VK, not scan');
for (const scan of [0xe037,0xe035,0xe11d,0xe11e]) check(scan,3,0,'unsupported type3 retained');
console.log(JSON.stringify({checked,navigationChecks:30,failures}));
assert.deepEqual(failures, [], 'type4 navigation and retained controls');
console.log('PASS type4 ten navigation VKs: A/W/ExA E0 scans, retained mappings and ABI (' + checked + ' cases)');
