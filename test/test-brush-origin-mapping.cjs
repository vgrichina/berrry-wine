#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

// lppt receives the previous POINT and may be NULL. Each POINT member is LONG.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-setbrushorgex
// https://learn.microsoft.com/en-us/windows/win32/api/windef/ns-windef-point
// Full signed values below preserve the existing implementation's state model;
// they do not assert a Windows brush-size normalization rule.
const extraWat = String.raw`
 (func (export "brush_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "brush_regs") (result i32) (global.get $reg_base))
 (func (export "brush_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "brush_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "brush_call") (param $p i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "brush_window") (result i32)
  (local $h i32)
  (local.set $h (global.get $next_hwnd))
  (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
  (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE))
  (local.get $h))
`;

async function main() {
 const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', width: 32, height: 32 });
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.brush_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), view = new DataView(memory.buffer), regs = e.brush_regs() >>> 0;
 const wa = p => e.guest_to_wasm(p) >>> 0, alloc = n => e.guest_alloc(n) >>> 0;
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => e.guest_read8(p + i)));
 const put = (p, b) => b.forEach((v, i) => e.guest_write8(p + i, v));
 const text = s => { const p = alloc(s.length + 1); put(p, Buffer.from(s + '\0')); return p; };
 const stackArea = alloc(256), stack = stackArea + 64, direct = alloc(128), unrelated = alloc(128), queryOut = alloc(16);
 const thunks = new Map();
 for (const [dll, names] of [['GDI32.DLL', ['CreateCompatibleDC', 'CreateDCA', 'DeleteDC',
  'SetBrushOrgEx', 'GetBrushOrgEx', 'SaveDC', 'RestoreDC', 'CreateBitmap', 'CreatePatternBrush',
  'CreateCompatibleBitmap', 'SelectObject', 'PatBlt', 'GetBitmapBits', 'DeleteObject']], ['USER32.DLL', ['GetDC', 'ReleaseDC']]]) {
  view.setUint32(regs + 16, stack, true); const module = e.brush_module(text(dll)) >>> 0; assert.ok(module);
  for (const name of names) {
   view.setUint32(regs + 16, stack, true); const thunk = e.brush_resolve(module, text(name)) >>> 0;
   assert.ok(thunk, name + ' public resolver'); const row = apiTable.find(r => r.name === name);
   assert.equal(row.convention, 'stdcall'); assert.equal(view.getUint32(wa(thunk) + 4, true), row.id);
   thunks.set(name, { thunk, nargs: row.nargs });
  }
 }
 let calls = 0, setters = 0, controls = 0, rendered = 0; const failures = [], observations = [], captures = [];
 function compare(actual, expected, label, kind = 'control') {
  if (Buffer.isBuffer(actual)) {
   if (actual.equals(expected)) { controls++; return; }
   let first = 0; while (first < actual.length && actual[first] === expected[first]) first++;
   failures.push({ label, kind, first, bytes: actual.length, actual: actual.subarray(first, first + 16).toString('hex'), expected: expected.subarray(first, first + 16).toString('hex') });
  } else if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, kind, actual, expected });
  else controls++;
 }
 function invoke(name, args) {
  const entry = thunks.get(name); assert.equal(args.length, entry.nargs, name + ' arity');
  mem.fill(0x5a, wa(stackArea), wa(stackArea) + 256);
  e.guest_write32(stack, 0x12345678); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const before = read(stackArea, 256), other = read(unrelated, 128);
  const seed = [0xa0123456, 0x11223344, 0x22334455, 0x33445566, stack, 0x44556677, 0x55667788, 0x66778899];
  seed.forEach((v, i) => view.setUint32(regs + i * 4, v, true)); e.brush_call(entry.thunk); calls++;
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
  assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(view.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(stackArea, 256), before, name + ' complete stack frame');
  assert.deepEqual(read(unrelated, 128), other, name + ' unrelated bytes');
  return e.get_eax();
 }
 const ok = (name, args, expected) => { const r = invoke(name, args); if (expected === undefined) assert.ok(r, name); else assert.equal(r, expected, name); return r >>> 0; };
 const a = ok('CreateCompatibleDC', [0]), b = ok('CreateCompatibleDC', [0]);
 const screen = ok('GetDC', [0]), display = ok('CreateDCA', [text('DISPLAY'), 0, 0, 0]);
 const legacy = (e.brush_window() >>> 0) + 0x40000;
 assert.equal(new Set([a, b, screen, display, legacy]).size, 5);
 const base = 0x30000000, decoy = 0x28000000, adjacent = 0x31000000, decoyAfter = 0x29000000;
 for (const p of [base, decoy, base + 4096, decoyAfter]) assert.equal(e.test_virtual_map_commit(p, 4096) >>> 0, p);
 assert.equal(e.test_virtual_map_commit(adjacent, 8192) >>> 0, adjacent);
 assert.equal(wa(decoy), wa(base) + 4096); assert.notEqual(wa(base + 4096), wa(base) + 4096);
 assert.equal(wa(decoyAfter), wa(base + 4096) + 4096);
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 const nullPhysical = wa(0);
 const spans = [[wa(direct), 128], [wa(base), 4096], [wa(decoy), 4096], [wa(base + 4096), 4096], [wa(decoyAfter), 4096], [wa(adjacent), 8192], [nullPhysical, 32]];
 const snapshot = () => spans.map(([p, n]) => Buffer.from(mem.subarray(p, p + n)));
 const values = [
  { xy: [0, 0], hex: '0000000000000000' },
  { xy: [-17, 123], hex: 'efffffff7b000000' },
  { xy: [456, -29], hex: 'c8010000e3ffffff' },
  { xy: [-2147483648, 2147483647], hex: '00000080ffffff7f' },
  { xy: [2147483647, -2147483648], hex: 'ffffff7f00000080' },
 ];
 const current = new Map([a, b, screen, display, legacy].map(dc => [dc, values[0]]));
 function get(dc, value, label) {
  mem.fill(0x7d, wa(queryOut), wa(queryOut) + 16);
  ok('GetBrushOrgEx', [dc, queryOut + 4], 1);
  compare(read(queryOut, 16), Buffer.from('7d7d7d7d' + value.hex + '7d7d7d7d', 'hex'), label);
 }
 function set(dc, value, p, label, mapping = false) {
  spans.forEach(([s, n], i) => mem.fill(0x91 + i, s, s + n));
  const expected = snapshot(), old = current.get(dc), literal = Buffer.from(old.hex, 'hex');
  if (p) for (let i = 0; i < 8; i++) {
   const physical = wa(p + i), j = spans.findIndex(([s, n]) => physical >= s && physical < s + n);
   assert.ok(j >= 0); expected[j][physical - spans[j][0]] = literal[i];
  }
  const flags = () => [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(), e.get_flag_res(), e.get_flag_sign_shift(), e.get_current_thread_id(), e.get_yield_reason()];
  const beforeFlags = flags(); ok('SetBrushOrgEx', [dc, ...value.xy, p], 1); setters++;
  assert.deepEqual(flags(), beforeFlags, label + ' flags/thread/yield');
  const kind = mapping ? 'mapping' : 'control';
  if (p) compare(read(p, 8), literal, label + ' previous POINT', kind);
  const actual = snapshot(); actual.forEach((v, i) => compare(v, expected[i], label + ' entire backing ' + i, kind));
  if (mapping) observations.push({ label, pointer: p, previous: old.xy, expected: old.hex, actual: read(p, 8).toString('hex'), decoyChanged: !actual[2].equals(expected[2]) });
  current.set(dc, value); get(dc, value, label + ' current state');
 }
 for (const dc of [a, b, screen, display, legacy]) {
  // First call also covers supported lazy DC adoption without changing policy.
  set(dc, values[1], direct + 17, 'default/unaligned ' + dc);
  for (let repeat = 0; repeat < 2; repeat++) {
   set(dc, values[2 + repeat], 0, 'NULL ' + dc + '/' + repeat);
   set(dc, values[4 - repeat], direct + 16 + repeat, 'contiguous ' + dc + '/' + repeat);
   for (let cut = 1; cut <= 7; cut++) {
    set(dc, values[1 + cut % 4], adjacent + 4096 - cut, 'adjacent ' + dc + '/' + repeat + '/' + cut);
    set(dc, values[1 + (cut + 1) % 4], base + 4096 - cut, 'nonadjacent ' + dc + '/' + repeat + '/' + cut, true);
   }
  }
 }
 for (const dc of [a, b, screen, display, legacy]) get(dc, current.get(dc), 'independent final ' + dc);
 // Real public pattern bitmap -> brush -> selected bitmap -> PatBlt -> readback.
 // Two rows/four columns have distinct BGR colors, making either phase visible.
 const pixels = alloc(32), bitmapOut = alloc(16 * 12 * 4);
 const pattern = Buffer.from('112233004455660077889900aabbcc00ddee1100224466007799bb00ccee4400', 'hex');
 put(pixels, pattern);
 const patternBitmap = ok('CreateBitmap', [4, 2, 1, 32, pixels]);
 const brush = ok('CreatePatternBrush', [patternBitmap]), targets = [];
 for (const dc of [a, b]) {
  const bitmap = ok('CreateCompatibleBitmap', [0, 16, 12]);
  const oldBitmap = ok('SelectObject', [dc, bitmap]), oldBrush = ok('SelectObject', [dc, brush]);
  targets.push({ dc, bitmap, oldBitmap, oldBrush });
 }
 function render(t, origin, label) {
  ok('PatBlt', [t.dc, 0, 0, 16, 12, 0x00f00021], 1);
  ok('GetBitmapBits', [t.bitmap, 16 * 12 * 4, bitmapOut], 16 * 12 * 4);
  const expected = Buffer.alloc(16 * 12 * 4);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) {
   const sx = ((x - origin[0]) % 4 + 4) % 4, sy = ((y - origin[1]) % 2 + 2) % 2;
   pattern.copy(expected, (y * 16 + x) * 4, (sy * 4 + sx) * 4, (sy * 4 + sx + 1) * 4);
  }
  const actual = read(bitmapOut, expected.length); compare(actual, expected, label + ' whole rendered bitmap'); rendered++;
  captures.push({ label, width: 16, height: 12, bgrx: actual.toString('hex') });
 }
 set(a, values[1], base + 4093, 'render initial A', true);
 set(b, values[2], base + 4091, 'render initial B', true);
 render(targets[0], values[1].xy, 'signed A'); render(targets[1], values[2].xy, 'independent B');
 ok('SaveDC', [a], 1);
 set(a, values[2], base + 4095, 'saved replacement', true); render(targets[0], values[2].xy, 'replacement A');
 render(targets[1], values[2].xy, 'B while A saved');
 ok('RestoreDC', [a, -1], 1); current.set(a, values[1]);
 get(a, values[1], 'restored A'); render(targets[0], values[1].xy, 'restored A');
 set(a, values[3], base + 4094, 'previous after restore', true); render(targets[0], values[3].xy, 'full LONG A');
 render(targets[1], values[2].xy, 'B after A restore');
 for (const t of targets) {
  ok('SelectObject', [t.dc, t.oldBrush]); ok('SelectObject', [t.dc, t.oldBitmap]); ok('DeleteObject', [t.bitmap], 1);
 }
 ok('DeleteObject', [brush], 1); ok('DeleteObject', [patternBitmap], 1);
 ok('ReleaseDC', [0, screen], 1); for (const dc of [a, b, display]) ok('DeleteDC', [dc], 1);
 const controlFailures = failures.filter(f => f.kind === 'control');
 console.log(JSON.stringify({ calls, setters, controls, rendered, failureCount: failures.length, controlFailures: controlFailures.length,
  failures, observations, captures, allSevenBoundaries: true, fullBackingCanaries: true, literalPreviousPOINT: true, ABI: true }));
 assert.equal(controlFailures.length, 0, 'contiguous, adjacent, NULL, state, independent DC and rendered controls');
 assert.equal(failures.length, 0, 'previous POINT and entire backing pages including decoys');
 console.log('PASS public SetBrushOrgEx mapping, previous signed POINT, independent DCs, SaveDC/RestoreDC, pattern PatBlt and ABI');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
