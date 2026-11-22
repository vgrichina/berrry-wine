#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

// POINT is two signed LONGs. Getters require an output; the setters permit NULL.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getviewportorgex
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getwindoworgex
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-setviewportorgex
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-setwindoworgex
// https://learn.microsoft.com/en-us/windows/win32/api/windef/ns-windef-point
const extraWat = String.raw`
 (func (export "origin_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "origin_regs") (result i32) (global.get $reg_base))
 (func (export "origin_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "origin_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "origin_call") (param $p i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "origin_table") (result i32) (global.get $GDI_DC_STATE_TABLE))
 (func (export "origin_table_bytes") (result i32)
  (i32.mul (global.get $GDI_DC_STATE_COUNT) (global.get $GDI_DC_STATE_STRIDE)))
 (func (export "origin_marks") (result i32) (global.get $GDI_TABLE_MARKS))
 (func (export "origin_next_dc") (result i32) (global.get $gdi_next_dc_handle))
 (func (export "origin_window") (result i32)
  (local $h i32)
  (local.set $h (global.get $next_hwnd))
  (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
  (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE))
  (local.get $h))
`;

async function main() {
 const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', width: 16, height: 16 });
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.origin_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), view = new DataView(memory.buffer), regs = e.origin_regs() >>> 0;
 const wa = p => e.guest_to_wasm(p) >>> 0, alloc = n => e.guest_alloc(n) >>> 0;
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => e.guest_read8(p + i)));
 const put = (p, b) => b.forEach((v, i) => e.guest_write8(p + i, v));
 const text = s => { const p = alloc(s.length + 1); put(p, Buffer.from(s + '\0')); return p; };
 const stackArea = alloc(256), stack = stackArea + 64, direct = alloc(128), unrelated = alloc(128);
 const thunks = new Map();
 for (const [dll, names] of [['GDI32.DLL', ['CreateCompatibleDC', 'CreateDCA', 'DeleteDC',
  'SetWindowOrgEx', 'SetViewportOrgEx', 'GetWindowOrgEx', 'GetViewportOrgEx', 'SaveDC', 'RestoreDC']], ['USER32.DLL', ['GetDC', 'ReleaseDC']]]) {
  view.setUint32(regs + 16, stack, true); const module = e.origin_module(text(dll)) >>> 0; assert.ok(module);
  for (const name of names) {
   view.setUint32(regs + 16, stack, true); const thunk = e.origin_resolve(module, text(name)) >>> 0;
   assert.ok(thunk, name + ' public resolver'); const row = apiTable.find(r => r.name === name);
   assert.equal(row.convention, 'stdcall'); assert.equal(view.getUint32(wa(thunk) + 4, true), row.id);
   thunks.set(name, { thunk, nargs: row.nargs });
  }
 }
 let calls = 0, queries = 0; const failures = [], invalidObservations = [];
 function compare(actual, expected, label, kind) {
  if (Buffer.isBuffer(actual)) { actual = actual.toString('hex'); expected = expected.toString('hex'); }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, kind, actual, expected });
 }
 function invoke(name, args) {
  const entry = thunks.get(name); assert.equal(args.length, entry.nargs, name + ' arity');
  mem.fill(0x5a, wa(stackArea), wa(stackArea) + 256);
  e.guest_write32(stack, 0x12345678); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const before = read(stackArea, 256), other = read(unrelated, 128);
  const seed = [0xa0123456, 0x11223344, 0x22334455, 0x33445566, stack, 0x44556677, 0x55667788, 0x66778899];
  seed.forEach((v, i) => view.setUint32(regs + i * 4, v, true)); e.origin_call(entry.thunk); calls++;
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
  assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(view.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(stackArea, 256), before, name + ' complete stack frame');
  assert.deepEqual(read(unrelated, 128), other, name + ' unrelated bytes');
  return e.get_eax();
 }
 const ok = (name, args, expected) => { const result = invoke(name, args); if (expected === undefined) assert.ok(result, name); else assert.equal(result, expected, name); return result >>> 0; };
 const memoryA = ok('CreateCompatibleDC', [0]), memoryB = ok('CreateCompatibleDC', [0]);
 const screen = ok('GetDC', [0]), independent = ok('CreateDCA', [text('DISPLAY'), 0, 0, 0]);
 assert.equal(new Set([memoryA, memoryB, screen, independent]).size, 4, 'independent live DC handles');
 const deleted = ok('CreateCompatibleDC', [0]); ok('DeleteDC', [deleted], 1);
 const base = 0x30000000, decoy = 0x28000000, adjacent = 0x31000000;
 for (const p of [base, decoy, base + 4096]) assert.equal(e.test_virtual_map_commit(p, 4096) >>> 0, p);
 assert.equal(e.test_virtual_map_commit(adjacent, 8192) >>> 0, adjacent);
 assert.equal(wa(decoy), wa(base) + 4096); assert.notEqual(wa(base + 4096), wa(base) + 4096);
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 // Cache NULL's physical sentinel before testing; translating a miss again
 // deliberately clears its first DWORD and would corrupt the observation.
 const nullPhysical = wa(0);
 const spans = [[wa(direct), 128], [wa(base), 4096], [wa(decoy), 4096], [wa(base + 4096), 4096], [wa(adjacent), 8192], [nullPhysical, 32]];
 const snapshot = () => spans.map(([p, n]) => Buffer.from(mem.subarray(p, p + n)));
 const state = () => [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(), e.get_flag_res(), e.get_flag_sign_shift(), e.get_current_thread_id(), e.get_yield_reason(), e.heap_stat(0), e.heap_stat(1), e.origin_next_dc(), ...mem.subarray(e.origin_marks(), e.origin_marks() + 16)];
 function query(name, dc, p, hex, label, kind = 'valid') {
  spans.forEach(([s, n], i) => mem.fill(0x95 + i, s, s + n));
  const expected = snapshot(), literal = hex && Buffer.from(hex, 'hex');
  if (literal) for (let i = 0; i < 8; i++) { const physical = wa(p + i), j = spans.findIndex(([s, n]) => physical >= s && physical < s + n); assert.ok(j >= 0); expected[j][physical - spans[j][0]] = literal[i]; }
  const beforeState = state(), table = Buffer.from(mem.subarray(e.origin_table(), e.origin_table() + e.origin_table_bytes()));
  const result = invoke(name, [dc, p]); queries++;
  compare(result, literal ? 1 : 0, label + ' BOOL', kind);
  if (kind === 'invalid') invalidObservations.push({ name, dc: dc >>> 0, output: p >>> 0, result, bytes: p ? read(p, 8).toString('hex') : null });
  if (literal) compare(read(p, 8), literal, label + ' literal POINT', kind);
  snapshot().forEach((b, i) => compare(b, expected[i], label + ' full backing ' + i, kind));
  assert.deepEqual(state(), beforeState, label + ' flags/thread/yield/allocator');
  assert.deepEqual(Buffer.from(mem.subarray(e.origin_table(), e.origin_table() + e.origin_table_bytes())), table, label + ' complete DC state unchanged');
 }
 const getters = ['GetWindowOrgEx', 'GetViewportOrgEx'];
 const defaultHex = '0000000000000000';
 // Required outputs and known invalid inputs are independent of output mapping.
 for (const name of getters) {
  for (const dc of [memoryA, memoryB, screen, independent]) {
   query(name, dc, direct + 16, defaultHex, name + ' default ' + dc);
   query(name, dc, 0, null, name + ' NULL output ' + dc, 'invalid');
  }
  for (const dc of [0, 0x7fffffff, 0xffffffff, deleted]) for (const p of [direct + 17, base + 4093, 0])
   query(name, dc, p, null, name + ' invalid/deleted DC ' + dc + ' output ' + p, 'invalid');
 }
 const pairs = [[memoryA, [-17, 123], [39, -70123], 'efffffff7b000000', '2700000015eefeff'],
  [memoryB, [456, -29], [-31007, 84], 'c8010000e3ffffff', 'e186ffff54000000']];
 for (const [dc, window, viewport] of pairs) {
  ok('SetWindowOrgEx', [dc, ...window, 0], 1); ok('SetViewportOrgEx', [dc, ...viewport, 0], 1);
 }
 for (let repeat = 0; repeat < 2; repeat++) for (const [dc, , , window, viewport] of pairs) for (const [name, hex] of [[getters[0], window], [getters[1], viewport]]) {
  query(name, dc, direct + 16 + repeat, hex, name + ' direct ' + dc + '/' + repeat);
  for (let cut = 1; cut <= 7; cut++) {
   query(name, dc, adjacent + 4096 - cut, hex, name + ' adjacent boundary ' + cut + '/' + dc + '/' + repeat);
   query(name, dc, base + 4096 - cut, hex, name + ' nonadjacent boundary ' + cut + '/' + dc + '/' + repeat);
  }
 }
 ok('SaveDC', [memoryA], 1);
 ok('SetWindowOrgEx', [memoryA, 456, -29, 0], 1); ok('SetViewportOrgEx', [memoryA, -31007, 84, 0], 1);
 query(getters[0], memoryA, base + 4095, pairs[1][3], 'saved window replacement');
 query(getters[1], memoryA, base + 4093, pairs[1][4], 'saved viewport replacement');
 ok('RestoreDC', [memoryA, -1], 1);
 for (const [dc, , , window, viewport] of pairs) {
  query(getters[0], dc, base + 4091, window, 'restored/independent window ' + dc);
  query(getters[1], dc, base + 4094, viewport, 'restored/independent viewport ' + dc);
 }
 for (const dc of [screen, independent]) for (const name of getters)
  query(name, dc, direct + 17, defaultHex, name + ' independent default after SaveDC/RestoreDC ' + dc);
 ok('SaveDC', [memoryB], 1);
 ok('SetWindowOrgEx', [memoryB, -2147483648, 2147483647, 0], 1);
 ok('SetViewportOrgEx', [memoryB, -2147483648, 2147483647, 0], 1);
 for (const name of getters) for (let cut = 1; cut <= 7; cut++)
  query(name, memoryB, base + 4096 - cut, '00000080ffffff7f', name + ' full signed LONG range boundary ' + cut);
 ok('RestoreDC', [memoryB, -1], 1);
 query(getters[0], memoryB, direct + 16, pairs[1][3], 'second DC restored window');
 query(getters[1], memoryB, direct + 16, pairs[1][4], 'second DC restored viewport');
 // Public display/screen DCs also retain independent signed origins.
 for (const [dc, window, viewport] of [[screen, pairs[0][3], pairs[0][4]], [independent, pairs[1][3], pairs[1][4]]]) {
  ok('SaveDC', [dc], 1);
  const values = dc === screen ? pairs[0] : pairs[1];
  ok('SetWindowOrgEx', [dc, ...values[1], 0], 1); ok('SetViewportOrgEx', [dc, ...values[2], 0], 1);
  for (let cut = 1; cut <= 7; cut++) {
   query(getters[0], dc, base + 4096 - cut, window, 'public screen/display signed window ' + dc + '/' + cut);
   query(getters[1], dc, base + 4096 - cut, viewport, 'public screen/display signed viewport ' + dc + '/' + cut);
  }
  ok('RestoreDC', [dc, -1], 1);
  for (const name of getters) query(name, dc, direct + 17, defaultHex, name + ' screen/display default restored ' + dc);
 }
 // A supported lazy window DC is valid even before its first state lookup.
 // This is an existing handle-model compatibility control, not a Windows
 // promise about arbitrary unmaterialized nonzero handle values.
 for (const firstGetter of getters) {
 const hwnd = e.origin_window() >>> 0, legacy = hwnd + 0x40000;
 query(firstGetter, legacy, 0, null, firstGetter + ' lazy DC NULL output before adoption', 'invalid');
 spans.forEach(([s, n], i) => mem.fill(0x95 + i, s, s + n));
 const legacyExpected = snapshot();
 Buffer.from(defaultHex, 'hex').copy(legacyExpected[0], 16);
 ok(firstGetter, [legacy, direct + 16], 1); // First lookup adopts a live legacy DC.
 snapshot().forEach((b, i) => assert.deepEqual(b, legacyExpected[i], 'first legacy getter full backing ' + i));
 for (const name of getters) query(name, legacy, direct + 16, defaultHex, name + ' supported legacy DC');
 ok('SetWindowOrgEx', [legacy, -17, 123, 0], 1); ok('SetViewportOrgEx', [legacy, 39, -70123, 0], 1);
 query(getters[0], legacy, base + 4095, pairs[0][3], 'lazy DC signed window ' + firstGetter);
 query(getters[1], legacy, base + 4093, pairs[0][4], 'lazy DC signed viewport ' + firstGetter);
 }
 ok('ReleaseDC', [0, screen], 1);
 for (const dc of [memoryA, memoryB, independent]) ok('DeleteDC', [dc], 1);
 const validFailures = failures.filter(f => f.kind === 'valid'), invalidFailures = failures.filter(f => f.kind === 'invalid');
 console.log(JSON.stringify({ calls, queries, failureCount: failures.length, validFailures: validFailures.length, invalidFailures: invalidFailures.length, invalidObservations, failures: failures.slice(0, 14), validFailureDetails: validFailures, allSevenBoundaries: true, literal8Bytes: true, fullBackingCanaries: true, ABI: true }));
 assert.equal(validFailures.length, 0, 'valid DC controls and signed origins');
 assert.equal(invalidFailures.length, 0, 'invalid/null/deleted DC and NULL output fail without output writes');
 console.log('PASS public GDI origin validation, independent DCs, signed origins, SaveDC/RestoreDC, all seven byte boundaries and ABI');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
