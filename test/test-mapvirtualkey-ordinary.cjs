'use strict';
// Independent literal oracle: Microsoft's Scan 1 Make key names joined by key
// identity to Microsoft's Virtual-Key Codes. Never generated from WAT tables.
// https://learn.microsoft.com/en-us/windows/win32/inputdev/about-keyboard-input#scan-codes
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
// Type 3 translates scan codes to VKs, distinguishing left/right keys:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeya
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyexa
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { compile } = require(path.join(root, 'tools/watx'));
const source = fs.readFileSync(path.join(root, 'src/09a7-handlers-dispatch.wat'), 'utf8');
function extract(marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, marker);
  let balance = 0, string = false, comment = false;
  for (let pos = start; pos < source.length; pos++) {
    const c = source[pos];
    if (comment) { if (c === '\n') comment = false; continue; }
    if (string) { if (c === '\\') pos++; else if (c === '"') string = false; continue; }
    if (c === ';' && source[pos + 1] === ';') { comment = true; pos++; continue; }
    if (c === '"') { string = true; continue; }
    if (c === '(') balance++;
    if (c === ')' && --balance === 0) return source.slice(start, pos + 1);
  }
  assert.fail('unbalanced ' + marker);
}
const entrypoints = ['handle_MapVirtualKeyA', 'handle_MapVirtualKeyW', 'handle_MapVirtualKeyExA'];
const fixture = [
  '(memory 1) (export "memory" (memory 0))',
  '(region.declare $VK_SCAN_TABLES (size 128) (align 128))',
  '(region.declare $ORDINARY_REGS (size 32) (align 32))',
  '(global $reg_base i32 (region.addr $ORDINARY_REGS 0))',
  '(export "regs" (global $reg_base))',
  extract('(func $vk_to_scan '),
  ...entrypoints.map(n => extract('(func $' + n + ' ')),
  extract('(data (region.addr $VK_SCAN_TABLES 0x00)'),
  extract('(data (region.addr $VK_SCAN_TABLES 0x20)'),
  ...entrypoints.map(n => '(export "' + n + '" (func $' + n + '))'),
].join('\n');
const binary = compile(fixture, new Map(), {mode: 'production'});
assert.ok(binary.success, binary.error);
const api = new WebAssembly.Instance(new WebAssembly.Module(binary.wasmBinary)).exports;
const regs = new DataView(api.memory.buffer, api.regs.value, 32);
const ordinary = [
  [0x1e,0x41,'A'], [0x30,0x42,'B'], [0x2e,0x43,'C'], [0x20,0x44,'D'],
  [0x12,0x45,'E'], [0x21,0x46,'F'], [0x22,0x47,'G'], [0x23,0x48,'H'],
  [0x17,0x49,'I'], [0x24,0x4a,'J'], [0x25,0x4b,'K'], [0x26,0x4c,'L'],
  [0x32,0x4d,'M'], [0x31,0x4e,'N'], [0x18,0x4f,'O'], [0x19,0x50,'P'],
  [0x10,0x51,'Q'], [0x13,0x52,'R'], [0x1f,0x53,'S'], [0x14,0x54,'T'],
  [0x16,0x55,'U'], [0x2f,0x56,'V'], [0x11,0x57,'W'], [0x2d,0x58,'X'],
  [0x15,0x59,'Y'], [0x2c,0x5a,'Z'],
  [0x02,0x31,'1'], [0x03,0x32,'2'], [0x04,0x33,'3'], [0x05,0x34,'4'],
  [0x06,0x35,'5'], [0x07,0x36,'6'], [0x08,0x37,'7'], [0x09,0x38,'8'],
  [0x0a,0x39,'9'], [0x0b,0x30,'0'],
  [0x3b,0x70,'F1'], [0x3c,0x71,'F2'], [0x3d,0x72,'F3'], [0x3e,0x73,'F4'],
  [0x3f,0x74,'F5'], [0x40,0x75,'F6'], [0x41,0x76,'F7'], [0x42,0x77,'F8'],
  [0x43,0x78,'F9'], [0x44,0x79,'F10'], [0x57,0x7a,'F11'], [0x58,0x7b,'F12'],
  [0x01,0x1b,'Escape'], [0x0e,0x08,'Backspace'], [0x0f,0x09,'Tab'],
  [0x1c,0x0d,'Enter'], [0x39,0x20,'Space'], [0x3a,0x14,'Caps Lock'],
  [0x45,0x90,'Num Lock'], [0x46,0x91,'Scroll Lock'],
  [0x0c,0xbd,'-'], [0x0d,0xbb,'='], [0x1a,0xdb,'['], [0x1b,0xdd,']'],
  [0x27,0xba,';'], [0x28,0xde,"'"], [0x29,0xc0,'`'], [0x2b,0xdc,'\\'],
  [0x33,0xbc,','], [0x34,0xbe,'.'], [0x35,0xbf,'/'],
  [0x37,0x6a,'keypad *'], [0x4a,0x6d,'keypad -'], [0x4e,0x6b,'keypad +'],
];
const failures = [];
let checks = 0;
function check(scan, type, expected, label) {
  for (const entry of entrypoints) {
    for (let r = 0; r < 8; r++) regs.setUint32(r * 4, 0x54320000 + r, true);
    api[entry](scan, type, 0x04090409, 0, 0, 0);
    const actual = regs.getUint32(0, true);
    if (actual !== expected) failures.push({entry, scan, type, label, expected, actual});
    assert.equal(regs.getUint32(16, true), 0x54320004 + (entry.endsWith('ExA') ? 16 : 12), entry + ' stack');
    for (const r of [1,2,3,5,6,7]) assert.equal(regs.getUint32(r * 4, true), 0x54320000 + r, entry + ' register ' + r);
    checks++;
  }
}
for (const [scan, vk, label] of ordinary) {
  check(scan, 3, vk, label);
  check(scan, 1, vk, label + ' existing type1');
}
for (const [scan, vk, label] of [
  [0x2a,0xa0,'LShift'], [0x36,0xa1,'RShift'], [0x1d,0xa2,'LCtrl'],
  [0xe01d,0xa3,'RCtrl'], [0x38,0xa4,'LAlt'], [0xe038,0xa5,'RAlt'],
]) check(scan, 3, vk, label);
// Scope guards, preserving existing behavior; these are not new layout claims.
for (const scan of [0,0x54,0x55,0x59,0xff,0xe01e,0xe041,0xe11e,0xe11d])
  check(scan, 3, 0, 'outside ordinary table / unsupported prefix');
// Independent Microsoft US sample: ausVK[0x56] = T56, KBD_TYPE 4 selects
// OEM_102 in kbd.h; Virtual-Key Codes assigns VK_OEM_102 = 0xE2.
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.h
// https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/kbd.h
check(0x56, 1, 0xE2, 'documented US OEM102 reverse');
check(0x56, 3, 0xE2, 'documented US OEM102 reverse with sides');
// Microsoft Scan 1 Make Keyboard UpArrow = E048; Virtual-Key Codes VK_UP = 26.
check(0xe048, 3, 0x26, 'documented E0 Up arrow');
console.log(JSON.stringify({checks, ordinaryKeys: ordinary.length, failures}));
assert.equal(failures.length, 0, 'ordinary scan/VK failures');
