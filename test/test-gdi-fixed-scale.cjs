#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

// Fixed modes ignore scale requests with nonzero denominators; old SIZE is optional.
// Fixed-mode zero-denominator precedence, physical scales and unequal MM_ISOTROPIC adjustment are outside this regression.
// https://learn.microsoft.com/en-us/windows/win32/gdi/mapping-modes-and-translations
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-scalewindowextex
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-scaleviewportextex
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getwindowextex
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-setviewportextex
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-setwindowextex
// https://learn.microsoft.com/en-us/windows/win32/api/windef/ns-windef-size
const extraWat = String.raw`
 (func (export "scale_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "scale_regs") (result i32) (global.get $reg_base))
 (func (export "scale_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "scale_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "scale_call") (param $p i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "scale_table") (result i32) (global.get $GDI_DC_STATE_TABLE))
 (func (export "scale_table_bytes") (result i32)
  (i32.mul (global.get $GDI_DC_STATE_COUNT) (global.get $GDI_DC_STATE_STRIDE)))

`;

async function main() {
 const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', width: 16, height: 16 });
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.scale_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), view = new DataView(memory.buffer), regs = e.scale_regs() >>> 0;
 const wa = p => e.guest_to_wasm(p) >>> 0, alloc = n => e.guest_alloc(n) >>> 0;
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => e.guest_read8(p + i)));
 const put = (p, b) => b.forEach((v, i) => e.guest_write8(p + i, v));
 const text = s => { const p = alloc(s.length + 1); put(p, Buffer.from(s + '\0')); return p; };
 const stackArea = alloc(256), stack = stackArea + 64, direct = alloc(128), unrelated = alloc(128);
 const thunks = new Map();
 for (const [dll, names] of [['GDI32.DLL', ['CreateCompatibleDC', 'DeleteDC', 'SetMapMode', 'GetMapMode',
  'SetWindowExtEx', 'SetViewportExtEx', 'ScaleWindowExtEx', 'ScaleViewportExtEx', 'GetWindowExtEx', 'GetViewportExtEx', 'SaveDC', 'RestoreDC', 'LPtoDP', 'DPtoLP', 'CreateDIBSection', 'SelectObject', 'DeleteObject', 'SetPixel']]]) {
  view.setUint32(regs + 16, stack, true); const module = e.scale_module(text(dll)) >>> 0; assert.ok(module);
  for (const name of names) {
   view.setUint32(regs + 16, stack, true); const thunk = e.scale_resolve(module, text(name)) >>> 0;
   assert.ok(thunk, name + ' public resolver'); const row = apiTable.find(r => r.name === name);
   assert.equal(row.convention, 'stdcall'); assert.equal(view.getUint32(wa(thunk) + 4, true), row.id);
   thunks.set(name, { thunk, nargs: row.nargs });
  }
 }
 let calls = 0; const failures = [], renderProof = [];
 let controls = 0;
 const control = (actual, expected, label) => { assert.deepEqual(actual, expected, label); controls++; };
 function compare(actual, expected, label, kind) {
  if (Buffer.isBuffer(actual)) { actual = actual.toString('hex'); expected = expected.toString('hex'); }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
   if (typeof actual === 'string' && actual.length > 256) { const a = require('node:crypto').createHash('sha256').update(actual).digest('hex'), b = require('node:crypto').createHash('sha256').update(expected).digest('hex'); actual = { hexSHA256: a, hexChars: actual.length }; expected = { hexSHA256: b, hexChars: expected.length }; }
   failures.push({ label, kind, actual, expected });
  }
 }
 function invoke(name, args) {
  const entry = thunks.get(name); assert.equal(args.length, entry.nargs, name + ' arity');
  mem.fill(0x5a, wa(stackArea), wa(stackArea) + 256);
  e.guest_write32(stack, 0x12345678); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const before = read(stackArea, 256), other = read(unrelated, 128);
  const seed = [0xa0123456, 0x11223344, 0x22334455, 0x33445566, stack, 0x44556677, 0x55667788, 0x66778899];
  seed.forEach((v, i) => view.setUint32(regs + i * 4, v, true)); e.scale_call(entry.thunk); calls++;
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
  assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(view.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(stackArea, 256), before, name + ' complete stack frame');
  assert.deepEqual(read(unrelated, 128), other, name + ' unrelated bytes');
  return e.get_eax();
 }
 const ok = (name, args, expected) => { const result = invoke(name, args); if (expected === undefined) assert.ok(result, name); else assert.equal(result, expected, name); return result >>> 0; };
 const dc = ok('CreateCompatibleDC', [0]), independent = ok('CreateCompatibleDC', [0]);
 control(dc === independent, false, 'independent DC handles');
 const bmi = alloc(40), bitsOut = alloc(4);
 put(bmi, Buffer.alloc(40));
 e.guest_write32(bmi, 40); e.guest_write32(bmi + 4, 64); e.guest_write32(bmi + 8, -64);
 e.guest_write16(bmi + 12, 1); e.guest_write16(bmi + 14, 32);
 const bitmap = ok('CreateDIBSection', [dc, bmi, 0, bitsOut, 0, 0]);
 const stockBitmap = ok('SelectObject', [dc, bitmap]);
 const bits = e.guest_read32(bitsOut) >>> 0, physicalBits = wa(bits), pixelBytes = 64 * 64 * 4;
 assert.ok(bits); control(wa(bits + pixelBytes - 1), physicalBits + pixelBytes - 1, 'contiguous authored DIB');
 const base = 0x30000000, decoy = 0x28000000, adjacent = 0x31000000;
 for (const p of [base, decoy, base + 4096]) control(e.test_virtual_map_commit(p, 4096) >>> 0, p, 'map sparse output page');
 control(e.test_virtual_map_commit(adjacent, 8192) >>> 0, adjacent, 'map adjacent output pages');
 control(wa(decoy), wa(base) + 4096, 'decoy occupies physical neighbor');
 control(wa(base + 4096) === wa(base) + 4096, false, 'guest neighbor is physically nonadjacent');
 control(wa(adjacent + 4096), wa(adjacent) + 4096, 'adjacent control');
 const nullPhysical = wa(0);
 const spans = [[wa(direct), 128], [wa(base), 4096], [wa(decoy), 4096], [wa(base + 4096), 4096], [wa(adjacent), 8192], [nullPhysical, 32]];
 const snapshot = () => spans.map(([p, n]) => Buffer.from(mem.subarray(p, p + n)));
 const cpu = () => [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(), e.get_flag_res(), e.get_flag_sign_shift(), e.get_current_thread_id(), e.get_yield_reason(), e.heap_stat(0), e.heap_stat(1)];
 const pair = p => [e.guest_read32(p), e.guest_read32(p + 4)];
 const sizeBuffer = xy => { const b = Buffer.alloc(8); xy.forEach((v, i) => b.writeInt32LE(v, i * 4)); return b; };
 function extent(name, target) { ok(name, [target, direct + 80], 1); return pair(direct + 80); }
 const extents = target => [extent('GetWindowExtEx', target), extent('GetViewportExtEx', target)];
 function mapped(target, xy, name = 'LPtoDP') {
  put(direct + 96, sizeBuffer(xy)); ok(name, [target, direct + 96, 1], 1); return pair(direct + 96);
 }
 // Entire output backing, including nonadjacent pages, neighboring decoys,
 // optional NULL's sentinel and every byte outside SIZE, is an oracle.
 function setter(name, target, xy, p, previous, label, expectedResult = 1, kind = 'control') {
  spans.forEach(([s, n], i) => mem.fill(0x91 + i, s, s + n));
  const expected = snapshot();
  if (p) for (const [i, value] of sizeBuffer(previous).entries()) {
   const physical = wa(p + i), span = spans.findIndex(([s, n]) => physical >= s && physical < s + n);
   assert.ok(span >= 0); expected[span][physical - spans[span][0]] = value;
  }
  const beforeCPU = cpu();
  const result = invoke(name, [target, ...xy, p]);
  if (kind === 'fixed') compare(result, expectedResult, label + ' BOOL', kind);
  else control(result, expectedResult, label + ' BOOL');
  if (p) control(read(p, 8), sizeBuffer(previous), label + ' old SIZE');
  snapshot().forEach((b, i) => control(b, expected[i], label + ' full backing ' + i));
  control(cpu(), beforeCPU, label + ' CPU/flags/thread/yield/allocator');
 }
 function pixel(target, logical, device, label, kind) {
  mem.fill(0x6d, physicalBits, physicalBits + pixelBytes);
  const expected = Buffer.alloc(pixelBytes, 0x6d), offset = (device[1] * 64 + device[0]) * 4;
  assert.ok(offset >= 0 && offset + 4 <= pixelBytes, label + ' pixel in bounds');
  // COLORREF 0x00332211 is BGR bytes 33 22 11 in a top-down 32-bit BI_RGB DIB.
  expected[offset] = 0x33; expected[offset + 1] = 0x22; expected[offset + 2] = 0x11; expected[offset + 3] = 0;
  control(invoke('SetPixel', [target, ...logical, 0x00332211]), 0x00332211, label + ' SetPixel color');
  const actual = Buffer.from(mem.subarray(physicalBits, physicalBits + pixelBytes));
  if (kind === 'fixed') compare(actual, expected, label + ' rendered-coordinate/full pixel canaries', kind);
  else control(actual, expected, label + ' rendered-coordinate/full pixel canaries');
  const changed = [];
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (!actual.subarray((y * 64 + x) * 4, (y * 64 + x + 1) * 4).equals(Buffer.alloc(4, 0x6d))) changed.push([x, y]);
  renderProof.push({ label, logical, expectedDevice: device, changed, fullPixelCanaries: actual.equals(expected) });
  if (process.env.GDI_SCALE_CAPTURE_DIR && /^mode 1 .* output 0$/.test(label)) {
   const fs = require('node:fs'), path = require('node:path');
   const canvas = require('../lib/canvas-compat').createCanvas(64, 64), ctx = canvas.getContext('2d'), image = ctx.createImageData(64, 64);
   for (let i = 0; i < actual.length; i += 4) {
    image.data[i] = actual[i + 2]; image.data[i + 1] = actual[i + 1]; image.data[i + 2] = actual[i]; image.data[i + 3] = 255;
   }
   ctx.putImageData(image, 0, 0);
   fs.writeFileSync(path.join(process.env.GDI_SCALE_CAPTURE_DIR, label.includes('ScaleWindow') ? 'window-request.png' : 'viewport-request.png'), canvas.toBuffer('image/png'));
  }
 }
 const scales = ['ScaleWindowExtEx', 'ScaleViewportExtEx'];
 const locations = [direct + 17, 0, ...Array.from({ length: 7 }, (_, i) => base + 4095 - i), ...Array.from({ length: 7 }, (_, i) => adjacent + 4095 - i)];
 // Physical fixed-mode DPI is outside this regression: preserve each public
 // pre-request state. MM_TEXT has an independent literal pixel identity oracle.
 for (const mode of [1, 2, 3, 4, 5, 6]) for (const [which, name] of scales.entries()) {
  ok('SetMapMode', [dc, 1]); ok('SetMapMode', [dc, mode], 1);
  const baseline = extents(dc), coordinate = mapped(dc, [12, 10]);
  if (mode === 1) control(coordinate, [12, 10], 'MM_TEXT literal pixel identity');
  pixel(dc, [12, 10], coordinate, 'mode ' + mode + ' baseline ' + name, 'control');
  const table = Buffer.from(mem.subarray(e.scale_table(), e.scale_table() + e.scale_table_bytes()));
  for (const [index, output] of locations.entries()) {
   ok('SetMapMode', [dc, 1]); ok('SetMapMode', [dc, mode], 1);
   const ratio = which === 0 ? [2, 1, 5, 1] : [3, 1, 2, 1];
   const label = 'mode ' + mode + ' ' + name + ' output ' + index;
   setter(name, dc, ratio, output, baseline[which], label);
   compare(extents(dc), baseline, label + ' extents ignored', 'fixed');
   compare(mapped(dc, [12, 10]), coordinate, label + ' LPtoDP ignored', 'fixed');
   compare(Buffer.from(mem.subarray(e.scale_table(), e.scale_table() + e.scale_table_bytes())), table, label + ' full DC state', 'fixed');
   if (index === 0 || index === 1 || index === 8) pixel(dc, [12, 10], coordinate, label, 'fixed');
  }
  // Signed numerators and denominators, including orientation flips. No fixed
  // zero-denominator result or last-error precedence is asserted.
  for (const ratio of [[-4, -2, 15, 3], [-3, 1, 2, -1], [6, -2, -8, 4], [0, 1, 9, 1], [7, 2, 0, -4], [0, -3, 0, 5]]) {
   ok('SetMapMode', [dc, 1]); ok('SetMapMode', [dc, mode], 1);
   setter(name, dc, ratio, base + 4093, baseline[which], 'signed fixed ' + mode + ' ' + name + ' ' + ratio, 1, 'fixed');
   compare(extents(dc), baseline, 'signed fixed extents ' + mode + ' ' + name + ' ' + ratio, 'fixed');
   compare(mapped(dc, [12, 10]), coordinate, 'signed fixed LPtoDP ' + mode + ' ' + name + ' ' + ratio, 'fixed');
  }
 }
 control(extents(independent), [[1, 1], [1, 1]], 'independent DC remains unchanged');
 // These literal expected results exercise signed i64 products beyond i32,
 // rational division, independent even denominators and equal isotropic axes.
 for (const [mode, which, window, viewport, ratio, result, logical, device] of [
  [8, 0, [30000, -50000], [60000, -100000], [100000, 75000, -90000, -150000], [40000, -30000], [8, 3], [12, 10]],
  [8, 1, [-20000, 30000], [30000, -50000], [-100000, 75000, 90000, 60000], [-40000, -75000], [6, -4], [12, 10]],
  [8, 0, [5, -5], [-14, 14], [-3, 2, -3, 2], [-7, 7], [6, 5], [12, 10]],
  [7, 0, [2, 2], [6, 6], [6, 2, 12, 4], [6, 6], [12, 15], [12, 15]],
  [7, 1, [2, 2], [6, 6], [-6, -2, -12, -4], [18, 18], [2, 3], [18, 27]],
 ]) {
  ok('SetMapMode', [dc, 1]); ok('SetMapMode', [dc, mode], 1);
  ok('SetWindowExtEx', [dc, ...window, 0], 1); ok('SetViewportExtEx', [dc, ...viewport, 0], 1);
  const old = [window, viewport][which], expected = [window, viewport]; expected[which] = result;
  setter(scales[which], dc, ratio, base + 4095, old, 'variable rational ' + mode + '/' + which);
  control(extents(dc), expected, 'literal rational extents');
  control(mapped(dc, logical), device, 'literal rational LPtoDP');
  control(mapped(dc, device, 'DPtoLP'), logical, 'literal rational DPtoLP');
  pixel(dc, logical, device, 'variable rational ' + mode + '/' + which, 'control');
 }
 // Preserve the existing variable-mode refusal of independently zero divisors
 // and zero results (including the WordPad 1*96/300 truncation). No partial update.
 for (const mode of [7, 8]) for (const [which, name] of scales.entries()) {
  for (const ratio of [[3, 0, 5, 2], [3, 2, 5, 0], [0, 1, 3, 1], [3, 1, 0, 1], [96, 300, 96, 300]]) {
   ok('SetMapMode', [dc, 1]); ok('SetMapMode', [dc, mode], 1);
   const before = extents(dc);
   setter(name, dc, ratio, adjacent + 4093, before[which], 'variable refused ' + mode + '/' + which + ' ' + ratio, 0);
   control(extents(dc), before, 'refused ratio leaves both axes unchanged');
  }
 }
 ok('SetMapMode', [independent, 8], 1);
 ok('SetWindowExtEx', [independent, -17, 123, 0], 1);
 ok('SetViewportExtEx', [independent, 39, -70123, 0], 1);
 const independentState = [[-17, 123], [39, -70123]];
 for (const [which, name] of scales.entries()) for (const output of locations) {
  setter(name, independent, [-2, -2, 4, 4], output, independentState[which], 'signed old SIZE ' + name + ' ' + output);
  control(extents(independent), independentState, 'signed identity ratio');
 }
 for (const name of scales) {
  ok('SetMapMode', [dc, 1]); ok('SaveDC', [dc], 1);
  ok('SetMapMode', [dc, 8], 1); ok('SetWindowExtEx', [dc, -17, 123, 0], 1);
  ok('SetViewportExtEx', [dc, 39, -70123, 0], 1);
  ok('RestoreDC', [dc, -1], 1); control(ok('GetMapMode', [dc], 1), 1, 'restored fixed mapping');
  const before = extents(dc), which = scales.indexOf(name);
  setter(name, dc, [6, 2, 8, 4], base + 4091, before[which], 'restored fixed ' + name);
  compare(extents(dc), before, 'restored fixed request ignored ' + name, 'fixed');
 }
 ok('SetMapMode', [dc, 1]); ok('SetMapMode', [dc, 8], 1);
 ok('SetWindowExtEx', [dc, -17, 123, 0], 1); ok('SetViewportExtEx', [dc, 39, -70123, 0], 1);
 ok('SaveDC', [dc], 1); ok('SetMapMode', [dc, 1], 8); ok('RestoreDC', [dc, -1], 1);
 control(ok('GetMapMode', [dc], 8), 8, 'restored variable mapping');
 setter(scales[0], dc, [2, 1, -3, 1], base + 4092, [-17, 123], 'restored signed scale');
 control(extents(dc), [[-34, -369], [39, -70123]], 'restored signed result');
 control(extents(independent), independentState, 'independent state after SaveDC/RestoreDC');
 ok('SelectObject', [dc, stockBitmap], bitmap); ok('DeleteObject', [bitmap], 1);
 ok('DeleteDC', [dc], 1); ok('DeleteDC', [independent], 1);
 console.log(JSON.stringify({ calls, controls, failureCount: failures.length, failures: failures.slice(0, 12), renderProof, fixedModes: [1, 2, 3, 4, 5, 6], allSevenBoundaries: true, fullBackingCanaries: true, ABI: true }));
 assert.equal(failures.length, 0, 'fixed-mode scales preserve public coordinates and rendered pixels');
 console.log('PASS fixed-mode scales: public GDI coordinates/pixels, signed rational modes, independent denominators, truncated-zero refusal, old SIZE, NULL, split canaries, independent DCs, SaveDC/RestoreDC and ABI');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
