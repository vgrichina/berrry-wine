#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture, BASE } = require('../tools/kernel32-native-fixture');

// Microsoft MapDialogRect specifies MulDiv for each coordinate. MulDiv uses
// a signed 64-bit product, nearest integer, ties away from zero, -1 on overflow.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapdialogrect
// https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-muldiv
// Only setup/inspection exports: calls execute x86 CALL [USER32 IAT] and RET.
const extraWat = String.raw`
 (func (export "round_regs") (result i32) (global.get $reg_base))
 (func (export "round_error") (result i32) (global.get $last_error))
 (func (export "round_seed_error") (global.set $last_error (i32.const 1234567)))
 (func (export "round_win16") (param i32) (global.set $is_win16 (local.get 0)))
 (func (export "round_configure") (param $h i32) (param $units i32)
  (call $wnd_table_set (local.get $h) (global.get $WNDPROC_DIALOG))
  (call $dialog_font_set (call $wnd_table_find (local.get $h)) (i32.const 0) (local.get $units)))
 (func (export "round_template") (param $h i32) (param $p i32) (result i32)
  (call $wnd_table_set (local.get $h) (global.get $WNDPROC_DIALOG))
  (global.set $dlg_indirect_template_ptr (local.get $p))
  (call $dlg_load (local.get $h) (i32.const 0)))
 (func (export "round_font") (param i32) (result i32) (call $dialog_font_get (local.get 0)))
`;

// Independent oracle uses quotient/remainder, not the implementation's bias.
function nearest(n, scale, denominator) {
  const product = BigInt(n) * BigInt(scale), d = BigInt(denominator);
  let q = product / d, r = product % d;
  if (r < 0n) r = -r;
  if (2n * r >= d) q += product < 0n ? -1n : 1n;
  return q < -2147483648n || q > 2147483647n ? -1 : Number(q);
}

async function run({ expectParent = false } = {}) {
  // Literal ties independently pin the oracle for every field and sign.
  for (const [input, units, expected] of [
    [[1, 4, -1, -4], [6, 13], [2, 7, -2, -7]],
    [[-3, -12, 3, 12], [6, 13], [-5, -20, 5, 20]],
    [[2, 4, -2, -4], [9, 17], [5, 9, -5, -9]],
  ]) assert.deepEqual(input.map((n, i) => nearest(n, units[i % 2], i % 2 ? 8 : 4)), expected);

  const h = await bootRenderHarness({ extraWat, width: 64, height: 64 });
  const e = h.exports, pe = makeFixture(), raw = r => r - 0x1000 + 0x200;
  // Add a real second import descriptor; leave the existing KERNEL32 intact.
  pe.writeUInt32LE(60, 0x80 + 24 + 108);
  for (const [r, v] of [[0x1814, 0x1940], [0x1820, 0x18b0], [0x1824, 0x1940], [0x1940, 0x1c00]])
    pe.writeUInt32LE(v, raw(r));
  pe.write('USER32.dll\0', raw(0x18b0));
  pe.write('MapDialogRect\0', raw(0x1c02));
  new Uint8Array(h.memory.buffer).set(pe, e.get_staging());
  assert.ok(e.load_pe(pe.length)); e.set_api_log(0);
  const slot = BASE + 0x1940, thunk = e.guest_read32(slot) >>> 0;
  assert.ok(thunk && thunk !== 0x1c00, 'loader resolved USER32 IAT');
  assert.equal(e.guest_read32(thunk + 4), require('../src/api_table.json').find(r => r.name === 'MapDialogRect').id);
  const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
  const put = (p, b) => b.forEach((v, i) => e.guest_write8(p + i, v));
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const mem = new Uint8Array(h.memory.buffer), dv = new DataView(h.memory.buffer);
  const buffer = alloc(48), rect = buffer + 16, receipt = alloc(4), stackBuffer = alloc(256), stack = stackBuffer + 128;
  const regs = e.round_regs() >>> 0;
  const template = Buffer.alloc(80);
  template.writeUInt32LE(0x40, 0); // DS_SETFONT, 10pt bundled MS Sans Serif = 8x16.
  template.writeUInt16LE(30, 14); template.writeUInt16LE(20, 16);
  template.writeUInt16LE(10, 24); template.write('MS Sans Serif\0', 26, 'utf16le');
  const tp = alloc(template.length); put(tp, template);
  e.round_configure(0x20001, 0); e.round_configure(0x20002, 0x00110009);
  assert.equal(e.round_template(0x20003, tp), 0);
  assert.ok(e.round_font(0x20003), 'real template created its font');
  const contexts = [
    ['default', 0x20001, 6, 13, 0], ['configured font', 0x20002, 9, 17, 0],
    ['DS_SETFONT', 0x20003, 8, 16, 0], ['fallback', 0xdeadbeef, 6, 13, 0],
    ['Win16 default', 0, 8, 16, 1],
  ];
  const vectors = [
    [1, 4, -1, -4], [-3, -12, 3, 12], [2, 4, -2, -4], [-2, -4, 2, 4],
    [0, 0, 0, 0], [4, 8, -4, -8], [1, 1, -1, -1], [3, 3, -3, -3],
    [2147483647, -2147483648, 715827883, -123456789],
    [-1431655765, -1321528399, 1431655764, 1321528398],
  ];
  // Cover fractions either side of a tie and both signs without reading the
  // production base-unit result or using MulDiv itself as the oracle.
  for (let n = -33; n <= 33; n++) vectors.push([n, n, -n, -n]);
  const mismatches = []; let calls = 0;
  for (const [name, hwnd, x, y, win16] of contexts) {
    e.round_win16(win16);
    for (const input of [...vectors, null]) {
      const code = Buffer.alloc(25);
      code[0] = 0x68; code.writeUInt32LE(input ? rect : 0, 1);
      code[5] = 0x68; code.writeUInt32LE(hwnd >>> 0, 6);
      code.set([0xff, 0x15], 10); code.writeUInt32LE(slot, 12);
      code.set([0x89, 0x25], 16); code.writeUInt32LE(receipt, 18); code[22] = 0xc3;
      const entry = alloc(code.length); put(entry, code);
      mem.fill(0xa7, wa(buffer), wa(buffer) + 48);
      if (input) input.forEach((v, i) => e.guest_write32(rect + i * 4, v));
      const expected = Buffer.from(mem.subarray(wa(buffer), wa(buffer) + 48));
      if (input) input.forEach((n, i) => expected.writeInt32LE(nearest(n, i % 2 ? y : x, i % 2 ? 8 : 4), 16 + i * 4));
      mem.fill(0x6d, wa(stackBuffer), wa(stackBuffer) + 256); e.guest_write32(stack, 0);
      const seed = [0x81234567, 0x12345678, 0x23456789, 0x3456789a, stack, 0x456789ab, 0x56789abc, 0x6789abcd];
      seed.forEach((v, i) => dv.setUint32(regs + i * 4, v, true));
      e.test_shift(32, 4, -1985229329, 0, 1, -1);
      const flags = ['op', 'a', 'b', 'res', 'sign_shift'].map(f => e['get_flag_' + f]());
      const condition = e.test_shift_flags();
      e.round_seed_error(); e.clear_yield(); e.set_eip(entry);
      for (let i = 0; i < 16 && e.get_eip(); i++) e.run(32);
      calls++;
      assert.equal(e.get_eip(), 0, 'x86 RET returned');
      assert.equal(e.get_esp() >>> 0, stack + 4, 'wrapper RET');
      assert.equal(e.guest_read32(receipt) >>> 0, stack, 'public stdcall removed both arguments');
      assert.equal(e.get_eax(), input ? 1 : 0, 'BOOL/null preserved');
      for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(dv.getUint32(regs + i * 4, true), seed[i], 'GPR ' + i);
      assert.deepEqual(['op', 'a', 'b', 'res', 'sign_shift'].map(f => e['get_flag_' + f]()), flags, 'lazy flags');
      assert.equal(e.test_shift_flags(), condition, 'condition flags');
      assert.equal(e.round_error(), 1234567, 'last error preserved');
      assert.ok(mem.subarray(wa(stackBuffer), wa(stack) - 12).every(b => b === 0x6d), 'lower stack guard');
      assert.ok(mem.subarray(wa(stack) + 4, wa(stackBuffer) + 256).every(b => b === 0x6d), 'upper stack guard');
      const actual = Buffer.from(mem.subarray(wa(buffer), wa(buffer) + 48));
      assert.deepEqual(actual.subarray(0, 16), expected.subarray(0, 16), 'RECT prefix');
      assert.deepEqual(actual.subarray(32), expected.subarray(32), 'RECT suffix');
      if (!actual.equals(expected)) mismatches.push({ name, input, actual: [0, 1, 2, 3].map(i => actual.readInt32LE(16 + i * 4)), expected: [0, 1, 2, 3].map(i => expected.readInt32LE(16 + i * 4)) });
    }
  }
  e.round_win16(0); h.hostCtx.stopAudio();
  console.log(JSON.stringify({ calls, mismatches: mismatches.length, examples: mismatches.slice(0, 8) }));
  if (expectParent) {
    assert.ok(mismatches.some(m => m.name === 'default' && m.input?.join() === '1,4,-1,-4' && m.actual.join() === '1,6,-1,-6'), 'fresh public parent demonstrates signed half truncation');
    assert.ok(mismatches.some(m => m.name === 'configured font'), 'font half cases distinguish parent');
  } else assert.deepEqual(mismatches, [], 'documented signed nearest rounding for all four coordinates');
}
if (require.main === module) run({ expectParent: process.argv.includes('--expect-parent') }).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { extraWat, run };
