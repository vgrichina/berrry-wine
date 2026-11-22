#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

// Fixed modes ignore extent requests. SIZE is two signed LONGs; old-size output is optional.
// Fixed-mode physical scales and unequal MM_ISOTROPIC adjustment are outside this regression.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getviewportextex
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getwindowextex
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-setviewportextex
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-setwindowextex
// https://learn.microsoft.com/en-us/windows/win32/api/windef/ns-windef-size
const extraWat = String.raw`
 (func (export "extent_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "extent_regs") (result i32) (global.get $reg_base))
 (func (export "extent_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "extent_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "extent_call") (param $p i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "extent_table") (result i32) (global.get $GDI_DC_STATE_TABLE))
 (func (export "extent_table_bytes") (result i32)
  (i32.mul (global.get $GDI_DC_STATE_COUNT) (global.get $GDI_DC_STATE_STRIDE)))

`;

async function main() {
 const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', width: 16, height: 16 });
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.extent_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), view = new DataView(memory.buffer), regs = e.extent_regs() >>> 0;
 const wa = p => e.guest_to_wasm(p) >>> 0, alloc = n => e.guest_alloc(n) >>> 0;
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => e.guest_read8(p + i)));
 const put = (p, b) => b.forEach((v, i) => e.guest_write8(p + i, v));
 const text = s => { const p = alloc(s.length + 1); put(p, Buffer.from(s + '\0')); return p; };
 const stackArea = alloc(256), stack = stackArea + 64, direct = alloc(128), unrelated = alloc(128);
 const thunks = new Map();
 for (const [dll, names] of [['GDI32.DLL', ['CreateCompatibleDC', 'DeleteDC', 'SetMapMode', 'GetMapMode',
  'SetWindowExtEx', 'SetViewportExtEx', 'GetWindowExtEx', 'GetViewportExtEx', 'SaveDC', 'RestoreDC', 'LPtoDP', 'DPtoLP', 'CreateDIBSection', 'SelectObject', 'DeleteObject', 'SetPixel']]]) {
  view.setUint32(regs + 16, stack, true); const module = e.extent_module(text(dll)) >>> 0; assert.ok(module);
  for (const name of names) {
   view.setUint32(regs + 16, stack, true); const thunk = e.extent_resolve(module, text(name)) >>> 0;
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
  seed.forEach((v, i) => view.setUint32(regs + i * 4, v, true)); e.extent_call(entry.thunk); calls++;
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
 function setter(name, target, xy, p, previous, label, expectedResult = 1) {
  spans.forEach(([s, n], i) => mem.fill(0x91 + i, s, s + n));
  const expected = snapshot();
  if (p) for (const [i, value] of sizeBuffer(previous).entries()) {
   const physical = wa(p + i), span = spans.findIndex(([s, n]) => physical >= s && physical < s + n);
   assert.ok(span >= 0); expected[span][physical - spans[span][0]] = value;
  }
  const beforeCPU = cpu();
  control(invoke(name, [target, ...xy, p]), expectedResult, label + ' BOOL');
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
  if (process.env.GDI_FIXED_CAPTURE_DIR && /^mode 1 .* output 0$/.test(label)) {
   const fs = require('node:fs'), path = require('node:path');
   const canvas = require('../lib/canvas-compat').createCanvas(64, 64), ctx = canvas.getContext('2d'), image = ctx.createImageData(64, 64);
   for (let i = 0; i < actual.length; i += 4) {
    image.data[i] = actual[i + 2]; image.data[i + 1] = actual[i + 1]; image.data[i + 2] = actual[i]; image.data[i + 3] = 255;
   }
   ctx.putImageData(image, 0, 0);
   fs.writeFileSync(path.join(process.env.GDI_FIXED_CAPTURE_DIR, label.includes('SetWindow') ? 'window-request.png' : 'viewport-request.png'), canvas.toBuffer('image/png'));
  }
 }
 const setters = ['SetWindowExtEx', 'SetViewportExtEx'];
 const locations = [direct + 17, 0, ...Array.from({ length: 7 }, (_, i) => base + 4095 - i), ...Array.from({ length: 7 }, (_, i) => adjacent + 4095 - i)];
 // Every fixed-mode case begins with a public MM_TEXT reset. For physical
 // fixed modes compare against their public pre-request state and coordinate;
 // do not assert a device DPI or implement missing unit physics here.
 for (const mode of [1, 2, 3, 4, 5, 6]) for (const [which, name] of setters.entries()) {
  ok('SetMapMode', [dc, 1]); ok('SetMapMode', [dc, mode], 1);
  const baseline = extents(dc), coordinate = mapped(dc, [12, 10]);
  if (mode === 1) control(coordinate, [12, 10], 'MM_TEXT independent pixel oracle');
  pixel(dc, [12, 10], coordinate, 'mode ' + mode + ' baseline ' + name, 'control');
  const table = Buffer.from(mem.subarray(e.extent_table(), e.extent_table() + e.extent_table_bytes()));
  for (const [index, output] of locations.entries()) {
   // Reset per case so wrong parent updates cannot poison old-SIZE controls.
   ok('SetMapMode', [dc, 1]); ok('SetMapMode', [dc, mode], 1);
   const request = which === 0 ? [2, 5] : [3, 2], label = 'mode ' + mode + ' ' + name + ' output ' + index;
   setter(name, dc, request, output, baseline[which], label);
   compare(extents(dc), baseline, label + ' extents ignored', 'fixed');
   compare(mapped(dc, [12, 10]), coordinate, label + ' LPtoDP ignored', 'fixed');
   compare(Buffer.from(mem.subarray(e.extent_table(), e.extent_table() + e.extent_table_bytes())), table, label + ' complete DC state', 'fixed');
   if (index === 0 || index === 1 || index === 8) pixel(dc, [12, 10], coordinate, label, 'fixed');
  }
  // Zero and negative ignored requests are meaningful even though a zero
  // extent is rejected in variable modes. No last-error value is asserted.
  for (const xy of [[0, 9], [7, 0], [0, 0], [-17, -29], [-2147483648, 2147483647]]) {
   ok('SetMapMode', [dc, 1]); ok('SetMapMode', [dc, mode], 1);
   // Accumulate fixed-mode BOOL failures as expected parent discrepancies.
   const p = direct + 17; spans.forEach(([s, n], i) => mem.fill(0x91 + i, s, s + n));
   const expected = snapshot(); sizeBuffer(baseline[which]).copy(expected[0], 17);
   compare(invoke(name, [dc, ...xy, p]), 1, 'mode ' + mode + ' ignored request BOOL ' + xy, 'fixed');
   snapshot().forEach((b, i) => control(b, expected[i], 'ignored request old-size/backing ' + i));
   compare(extents(dc), baseline, 'mode ' + mode + ' ignored request extents ' + xy, 'fixed');
   compare(mapped(dc, [12, 10]), coordinate, 'mode ' + mode + ' ignored request coordinate ' + xy, 'fixed');
  }
 }
 ok('SetMapMode', [dc, 1]);
 control(extents(independent), [[1, 1], [1, 1]], 'second DC unchanged by fixed requests');
 // Public variable-mode controls use exact integer scales and signed round
 // trips; equal-axis isotropic scales are already supported without adjustment.
 for (const [mode, window, viewport, logical, device] of [
  [8, [2, 5], [6, 10], [4, 5], [12, 10]],
  [8, [-2, 5], [6, -10], [-4, -5], [12, 10]],
  [7, [2, 2], [6, 6], [4, 5], [12, 15]],
 ]) {
  ok('SetMapMode', [dc, 1]); ok('SetMapMode', [dc, mode], 1);
  setter(setters[0], dc, window, base + 4095, [1, 1], 'variable window ' + mode);
  setter(setters[1], dc, viewport, adjacent + 4093, [1, 1], 'variable viewport ' + mode);
  control(extents(dc), [window, viewport], 'variable extents ' + mode);
  control(mapped(dc, logical), device, 'variable LPtoDP ' + mode);
  control(mapped(dc, device, 'DPtoLP'), logical, 'signed variable DPtoLP ' + mode);
  pixel(dc, logical, device, 'variable mode ' + mode + ' ' + window, 'control');
  for (const name of setters) {
   const which = setters.indexOf(name), old = which ? viewport : window;
   for (const xy of [[0, 3], [4, 0]]) setter(name, dc, xy, direct + 17, old, 'variable zero rejected ' + mode, 0);
   control(extents(dc), [window, viewport], 'rejected variable extents unchanged');
  }
 }
 ok('SetMapMode', [independent, 8], 1);
 setter(setters[0], independent, [-17, 123], 0, [1, 1], 'independent signed window');
 setter(setters[1], independent, [39, -70123], 0, [1, 1], 'independent signed viewport');
 const independentState = extents(independent);
 for (const [which, name] of setters.entries()) for (const output of locations) {
  setter(name, independent, independentState[which], output, independentState[which], 'signed variable old SIZE at ' + output);
  control(extents(independent), independentState, 'signed repeated request preserves both extents');
 }
 ok('SetMapMode', [dc, 1]); ok('SaveDC', [dc], 1);
 ok('SetMapMode', [dc, 8], 1); ok(setters[0], [dc, -2147483648, 2147483647, 0], 1); ok(setters[1], [dc, 2147483647, -2147483648, 0], 1);
 control(extents(dc), [[-2147483648, 2147483647], [2147483647, -2147483648]], 'full LONG variable setter/getter');
 ok('RestoreDC', [dc, -1], 1); control(ok('GetMapMode', [dc], 1), 1, 'restored fixed map mode');
 const saved = extents(dc);
 setter(setters[0], dc, [6, 7], base + 4093, saved[0], 'restored fixed window');
 compare(extents(dc), saved, 'restored fixed request ignored', 'fixed');
 control(extents(independent), independentState, 'independent signed state after SaveDC/RestoreDC');
 ok('SetMapMode', [dc, 1]); ok('SetMapMode', [dc, 8], 1);
 ok(setters[0], [dc, -17, 123, 0], 1); ok(setters[1], [dc, 39, -70123, 0], 1); ok('SaveDC', [dc], 1);
 ok('SetMapMode', [dc, 1], 8); ok('RestoreDC', [dc, -1], 1);
 control(ok('GetMapMode', [dc], 8), 8, 'restored variable map mode');
 control(extents(dc), independentState, 'restored signed variable state');
 setter(setters[0], dc, [456, -29], base + 4091, [-17, 123], 'old signed window after restore');
 setter(setters[1], dc, [-31007, 84], adjacent + 4094, [39, -70123], 'old signed viewport after restore');
 control(extents(dc), [[456, -29], [-31007, 84]], 'signed replacement getters');
 ok('SelectObject', [dc, stockBitmap], bitmap); ok('DeleteObject', [bitmap], 1);
 ok('DeleteDC', [dc], 1); ok('DeleteDC', [independent], 1);
 console.log(JSON.stringify({ calls, controls, failureCount: failures.length, failures: failures.slice(0, 12), renderProof, fixedModes: [1, 2, 3, 4, 5, 6], allSevenBoundaries: true, fullBackingCanaries: true, ABI: true }));
 assert.equal(failures.length, 0, 'fixed-mode extents, coordinates and rendered pixels ignore requests');
 console.log('PASS fixed-mode extent setters: public GDI coordinates/pixels, signed variable controls, old SIZE, NULL, split canaries, independent DCs, SaveDC/RestoreDC and ABI');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
