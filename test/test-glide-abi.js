#!/usr/bin/env node
'use strict';
// Independent Glide 2 ABI/layout and ordered transport checks. The host is
// deliberately a GPU stream v2 record recorder (test/glide-gps-recorder.js),
// so a shared renderer mistake cannot pass.
const assert = require('assert');
const { compileSrcWasm } = require('./compile-src');
const regions = require('../lib/region-map.generated');
const table = require('../src/api_table.json');
const { createGpsRecorder, primitives, ringWord, GS } = require('./glide-gps-recorder');
const KICK = GS.CONST, KIND = GS.KIND, PRIM = GS.PRIM;
const bytes = compileSrcWasm((file, source) => file === '09a8h-glide.wat'
  ? source + '\n(export "glide_test_dispatch" (func $dispatch_api_table))\n'
    + '(export "glide_test_lookup" (func $lookup_api_id))\n'
    + '(export "glide_test_coordinate" (func $glide_coordinate))\n' : source);
const module_ = new WebAssembly.Module(bytes);
const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
const imports = {host: {memory}};
for (const imp of WebAssembly.Module.imports(module_)) {
  if (imp.kind === 'function') (imports[imp.module] ||= {})[imp.name] = () => 0;
}
const rec = createGpsRecorder(memory);
let ticks = 0;
const windowRects = new Map([[1, [15, 25, 815, 625]]]);
const moves = [];
imports.host.foreground_window = () => 1;
imports.host.get_window_rect = (hwnd, ptr) => {
  const dv = new DataView(memory.buffer);
  (windowRects.get(hwnd) || [0, 0, 0, 0]).forEach((v, i) => dv.setInt32(ptr + i * 4, v, true));
};
imports.host.move_window = (hwnd, x, y, w, h) => {
  assert(windowRects.has(hwnd), 'must not move a phantom HWND');
  moves.push([hwnd, x, y, w, h]);
  windowRects.set(hwnd, [x, y, x + w, y + h]);
};
imports.host.get_ticks = () => ticks;
imports.host.math_pow2 = x => 2 ** x;
imports.host.math_pow = Math.pow;
// READBACK destinations are filled with 0x5a by the recorder.
imports.host.gpu_stream_kick = rec.kick;
const a = new WebAssembly.Instance(module_, imports).exports;
const b = new WebAssembly.Instance(module_, imports).exports;
a.init_thread(0, 0x400000, 0, 0, 0, 0, 0);
b.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
a.heap_init(0x420000);
for (const [input, expected] of [
  [-2048, -2048], [-0.5, -0.5], [0, 0], [589.8125, 589.8125],
  [2047.9375, 2047.9375], [784383.9375, 784383.9375],
  [784384, -2048], [786432, 0], [788479.9375, 2047.9375], [788480, 788480],
]) assert.strictEqual(a.glide_test_coordinate(input), expected, 'bounded snap coordinate ' + input);
const view = new DataView(memory.buffer);
const stack = regions.BASE.GUEST_STACK + 0x1000;
const stackGuest = (stack - regions.BASE.GUEST_BASE + 0x400000) >>> 0;
const wa = p => a.guest_to_wasm(p) >>> 0;
// Allocate the second virtual page AFTER an unrelated page so a single raw
// translation cannot accidentally pass a crossing-structure test.
const sparseBase = 0x38000000, sparseNeighbor = sparseBase + 0x10000;
for (const p of [sparseBase, sparseNeighbor, sparseBase + 4096])
  a.test_virtual_map_commit(p, 4096);
assert.notStrictEqual(wa(sparseBase + 4096), wa(sparseBase) + 4096,
  'Glide ABI fixture must cross physically noncontiguous guest pages');
const readGuest = (p, n) => Buffer.from(Array.from({length: n}, (_, i) => a.guest_read8(p + i)));
const fillGuest = (p, n, value) => {
  for (let i = 0; i < n; ++i) a.guest_write8(p + i, value);
};
fillGuest(sparseNeighbor, 4096, 0xa7);
function sparseGuards(p, n) {
  assert.deepStrictEqual(readGuest(p - 4, 4), Buffer.alloc(4, 0xcc), 'leading output guard');
  assert.deepStrictEqual(readGuest(p + n, 4), Buffer.alloc(4, 0xcc), 'trailing output guard');
  assert.deepStrictEqual(readGuest(sparseNeighbor, 4096), Buffer.alloc(4096, 0xa7),
    'unrelated physical backing is unchanged');
  assert.strictEqual(a.guest_span_cursor_bytes(), 0, 'sparse output span is released');
}
function call(name, args = [], instance = a) {
  const api = table.find(x => x.name === name);
  assert(api, name);
  instance.set_esp(stackGuest);
  args.forEach((v, i) => view.setUint32(stack + 4 + i * 4, v >>> 0, true));
  instance.glide_test_dispatch(api.id, ...Array.from({length: 5}, (_, i) => args[i] || 0), 0);
  assert.strictEqual(instance.get_esp() >>> 0, stackGuest + 4 + api.nargs * 4,
    name + ' consumes exactly the decorated stdcall frame');
  return instance.get_eax() >>> 0;
}
// guDrawTriangleWithClip clips to grClipWindow; both backends already scissor
// every draw to that window, so it is grDrawTriangle. Driver resolves it by
// name and calls the pointer it gets back, so a missing export jumped to 0.
for (const name of ['guDrawTriangleWithClip', '_guDrawTriangleWithClip@12'])
  assert.strictEqual(table.find(x => x.name === name).handler, 'grDrawTriangle', name);
for (const name of ['_grGlideInit@0', '_grSstWinOpen@28', '_grLfbLock@24', '_grTexCombine@28', '_grTexCombineFunction@8', '_guFogGenerateExp@8', '_guDrawTriangleWithClip@12']) {
  const p = wa(0x410000);
  new Uint8Array(memory.buffer, p, name.length + 1).set(Buffer.from(name + '\0'));
  assert.strictEqual(a.glide_test_lookup(p), table.find(x => x.name === name).id);
}
call('_grGlideInit@0');
// SDK legacy enum mapping, including the inversion used for constant one.
for (const [mode, fn, factor, invert] of [
  [0, 0, 0, 0], [1, 1, 0, 0], [2, 3, 8, 0], [3, 4, 8, 0],
  [4, 3, 1, 0], [5, 6, 8, 0], [6, 7, 12, 0], [7, 7, 4, 0],
  [8, 7, 13, 0], [9, 7, 5, 0], [10, 0, 0, 1],
]) {
  call('_grTexCombineFunction@8', [0, mode]);
  assert.deepStrictEqual(Array.from({length: 6}, (_, i) =>
    view.getUint32(regions.BASE.GLIDE_STATE + 256 + 184 + i * 4, true)),
    [fn, factor, fn, factor, invert, invert], 'legacy texture combine mode ' + mode);
}
// grTexDetailControl keeps lodBias/detailScale/detailMax per TMU in the
// extension block at +2448 (16 bytes a TMU); Dethkarz's 3Dfx renderer calls it
// with 0, 4, 6, 1.0 right after its driver dialog.
const f32bits = x => { const b = Buffer.alloc(4); b.writeFloatLE(x); return b.readUInt32LE(); };
call('_grTexDetailControl@16', [0, 4, 6, f32bits(1.0)]);
{
  const ext = wa(view.getUint32(regions.BASE.GLIDE_STATE + 116, true));  // a guest pointer ($glide3_ext)
  assert.deepStrictEqual([view.getInt32(ext + 2448, true), view.getUint32(ext + 2452, true), view.getFloat32(ext + 2456, true)],
    [4, 6, 1], 'TMU0 detail control state');
  // Glide 2 exposes TMU0 only ($glide_tmu); TMU1 is the Glide 3 path.
}
// Cross a noncontiguous guest page and compare all 64 bytes to the SDK's
// normalized exponential equation, with its float intermediate rounding.
const fogPtr = sparseBase + 4072;
for (const density of [0.00001, 0.001, 0.1]) {
  fillGuest(fogPtr - 4, 72, 0xcc);
  const f = Math.fround;
  const bits = Buffer.alloc(4); bits.writeFloatLE(density);
  call('_guFogGenerateExp@8', [fogPtr, bits.readUInt32LE()]);
  const value = i => f(1 - f(Math.exp(-f(f(density) * f(2 ** (3 + (i >> 2)) / (8 - (i & 3)))))));
  const scale = f(1 / value(63));
  const expected = Buffer.from(Array.from({length: 64}, (_, i) =>
    Math.trunc(f(Math.max(0, Math.min(1, f(value(i) * scale))) * 255))));
  assert.deepStrictEqual(readGuest(fogPtr, 64), expected, 'SDK exponential fog table');
  assert.strictEqual(expected[63], 255, 'last fog entry normalized');
  sparseGuards(fogPtr, 64);
}
call('_grSstQueryHardware@4', [0x410ffc]);
assert.strictEqual(view.getUint32(wa(0x410ffc), true), 1, 'one board');
assert.strictEqual(view.getUint32(wa(0x41100c), true), 1, 'one advertised TMU');
// Independent SDK GrHwConfiguration bytes: one Voodoo board, four MiB FBI,
// revision 2, one TMU, no SLI, revision 1 / four MiB TMU, other boards zero.
const hardware = Buffer.alloc(148);
for (const [offset, value] of [[0, 1], [8, 4], [12, 2], [16, 1], [24, 1], [28, 4]])
  hardware.writeUInt32LE(value, offset);
for (const p of [sparseBase + 4094, sparseBase + 4072]) {
  fillGuest(p - 4, 156, 0xcc);
  assert.strictEqual(call('_grSstQueryHardware@4', [p]), 1);
  assert.deepStrictEqual(readGuest(p, 148), hardware, 'complete sparse hardware configuration');
  sparseGuards(p, 148);
}
const dxState = regions.BASE.DX_PROCESS_STATE;
const savedDisplay = Buffer.alloc(32);
[800, 600, 32, 1, 0, 0, 0, 0].forEach((v, i) => savedDisplay.writeUInt32LE(v, i * 4));
new Uint8Array(memory.buffer, dxState, 32).set(savedDisplay);
// Open on a different thread from the HWND owner. An inline callback would
// write this sentinel; the owner must instead receive an ordered message pair.
const wndproc = 0x414800, callbackSentinel = 0x414900, queuedMessage = 0x414920;
const callback = Buffer.from([0xc7, 0x05, 0, 0, 0, 0, 1, 0, 0, 0, 0xc2, 16, 0]);
callback.writeUInt32LE(callbackSentinel, 2); // mov dword [sentinel], 1; ret 16
new Uint8Array(memory.buffer, wa(wndproc), callback.length).set(callback);
a.guest_write32(callbackSentinel, 0);
b.test_wnd_table_set(1, wndproc);
assert.notStrictEqual(a.get_current_thread_id(), b.get_current_thread_id());
assert.strictEqual(call('_grSstWinOpen@28', [0, 7, 0, 0, 0, 2, 1]), 1);
assert.strictEqual(a.guest_read32(callbackSentinel), 0, 'open does not execute the owner wndproc inline');
assert.strictEqual(a.post_queue_depth(), 0, 'opening thread does not receive another thread\'s layout messages');
assert.strictEqual(a.test_shared_post_read(queuedMessage, 1), 0);
assert.strictEqual(b.post_queue_depth(), 2, 'owner receives exactly WM_MOVE and WM_SIZE');
for (const expected of [[1, 3, 0, 0], [1, 5, 0, (480 << 16) | 640]]) {
  assert.deepStrictEqual(Array.from({length: 4}, (_, i) => b.post_queue_peek(0, i)), expected);
  assert.strictEqual(b.test_shared_post_read(queuedMessage, 1), 1, 'owner can dequeue the message');
  assert.deepStrictEqual(Array.from({length: 4}, (_, i) => b.guest_read32(queuedMessage + 4 * i)), expected);
}
assert.strictEqual(b.post_queue_depth(), 0);
b.test_wnd_table_set(1, 0);
assert.strictEqual(b.get_display_fullscreen(), 1, 'fullscreen state is process-shared');
assert.strictEqual(b.get_dx_exclusive_hwnd(), 1, 'zero HWND resolves foreground owner');
assert.deepStrictEqual(moves.at(-1), [1, 0, 0, 640, 480]);
assert.strictEqual(view.getUint32(dxState, true), 640);
assert.strictEqual(view.getUint32(dxState + 4, true), 480);
assert.strictEqual(view.getUint32(dxState + 8, true), 16);
// The open is one SYNC kick whose records create the 640x480 render targets
// (one per colour buffer) and depth buffer before anything else runs.
const openRts = k => k.records.filter(r => r.name === 'CREATE' && r.fields.kind === KIND.RT);
assert.deepStrictEqual(rec.kicks.map(k => k.mode), [KICK.KICK_SYNC], 'open is one synchronous kick');
assert.deepStrictEqual(openRts(rec.kicks[0]).map(r => [r.fields.width, r.fields.height]), [[640, 480], [640, 480]],
  'open creates both 640x480 colour buffers');
assert(rec.kicks[0].records.some(r => r.name === 'CREATE' && r.fields.kind === KIND.DS
  && r.fields.width === 640 && r.fields.height === 480), 'open creates the 640x480 depth buffer');
assert.strictEqual(rec.ringAddr, view.getUint32(regions.BASE.GLIDE_STATE + 16, true), 'the kick names the device ring');
const ring = name => ringWord(memory, rec.ringAddr, name);
let m = rec.mark();
const vertices = 0x413fe0;
for (let i = 0; i < 45; ++i) view.setFloat32(wa(vertices + i * 4), i + 0.25, true);
call('_grColorCombine@20', [1, 0, 0, 0, 0]);
call('_grDrawTriangle@12', [vertices, vertices + 60, vertices + 120]);
call('_grColorCombine@20', [3, 1, 0, 1, 0], b);
call('_grDrawTriangle@12', [vertices, vertices + 60, vertices + 120], b);
call('_grDrawLine@8', [vertices, vertices + 60]);
call('_grDrawPoint@4', [vertices]);
// Draws stay in the ring until a barrier. The only kicks before the swap are
// the ASYNC producer handoffs when the other instance (another thread) starts
// writing (a -> b at b's triangle, b -> a at a's line): each publishes the
// previous owner's complete records and does not wait for them.
const preSwap = rec.kicksSince(m);
assert.deepStrictEqual(preSwap.map(k => k.mode), [KICK.KICK_ASYNC, KICK.KICK_ASYNC],
  'only the two thread handoffs kick before the barrier, without waiting');
assert.deepStrictEqual(preSwap.map(k => primitives(k.records).map(p => p.op)), [[5], [5]],
  'each handoff publishes exactly the previous owner\'s triangle');
assert.strictEqual(ring('handoffs'), 2, 'both handoffs are counted');
assert(!preSwap.some(k => k.records.some(r => r.name === 'PRESENT')), 'nothing is presented before the swap');
new Uint8Array(memory.buffer, wa(vertices), 180).fill(0);
call('_grBufferSwap@4', [1]);
{
  const kicks = rec.kicksSince(m), records = rec.recordsSince(m);
  assert.strictEqual(kicks.at(-1).mode, KICK.KICK_ASYNC, 'the swap submits without waiting');
  assert(!kicks.some(k => k.mode !== KICK.KICK_ASYNC), 'nothing waits for the batch');
  assert.strictEqual(ring('read_pos'), ring('write_pos'), 'the swap publishes every record');
  const prims = primitives(records);
  assert.deepStrictEqual(prims.map(p => p.prim), [PRIM.TRIANGLELIST, PRIM.TRIANGLELIST, PRIM.LINELIST, PRIM.POINTLIST],
    'triangle, triangle, line, point in call order');
  assert.strictEqual(prims[0].verts[0][0], 0.25, 'vertex copied before mutation');
  assert.notStrictEqual(prims[0].ps, prims[1].ps, 'first draw keeps its own combine (immutable state)');
  assert.strictEqual(prims[2].ps, prims[1].ps, 'second WASM instance shares state/stream: the line uses b\'s combine');
  assert.strictEqual(prims[3].ps, prims[1].ps, 'and so does the point');
  assert.deepStrictEqual(prims[2].verts.map(v => v[0]), [0.25, 15.25], 'line topology is preserved');
  assert.deepStrictEqual(prims[3].verts.map(v => v[0]), [0.25], 'point topology is preserved');
  const lastDraw = records.map(r => r.name).lastIndexOf('DRAW_UP');
  const present = records.findIndex(r => r.name === 'PRESENT');
  assert(present > lastDraw, 'the swap presents after every draw');
}
// The original 3dfx splash feeds this prebiased coordinate encoding directly
// to Glide. Decode its entire signed domain, not only positive screen values.
view.setUint32(wa(vertices), 0x494024dd, true); // NFS III observed: bias + 589.8125
view.setFloat32(wa(vertices + 4), 786432 - 0.5, true);
m = rec.mark();
call('_grDrawLine@8', [vertices, vertices]);
call('_grBufferSwap@4', [0]);
const snapped = primitives(rec.recordsSince(m)).at(-1);
assert.strictEqual(snapped.op, 11);
assert.strictEqual(snapped.verts[0][0], 589.8125);
assert.strictEqual(snapped.verts[0][1], -0.5, 'y snaps to -0.5 (origin upper-left, no flip)');
assert.strictEqual(view.getUint32(wa(vertices), true), 0x494024dd, 'guest vertices remain untouched');
assert.strictEqual(call('_grTexCalcMemRequired@16', [8, 0, 3, 10]), 174768,
  '256-square RGB565 mip chain aligns to eight bytes');
const info = 0x416ffc;
view.setUint32(wa(info), 20, true);
assert.strictEqual(call('_grLfbLock@24', [1, 1, 0, 0, 0, info]), 1);
assert.strictEqual(view.getUint32(wa(info + 8), true), 1280);
const lfb = view.getUint32(wa(info + 4), true);
assert.strictEqual(view.getUint16(wa(lfb), true), 0x5a5a, 'ordered host readback is guest-visible');
{
  // The lock read the back buffer through a READBACK that the sync kick
  // completed before the guest could see the LFB.
  const kicks = rec.kicksSince(m);
  const rb = kicks.findIndex(k => k.records.some(r => r.name === 'READBACK'));
  assert(rb >= 0, 'the read lock issues a READBACK');
  assert.strictEqual(kicks[rb].mode, KICK.KICK_SYNC, 'the READBACK is drained by a synchronous kick');
  const read = kicks[rb].records.find(r => r.name === 'READBACK').fields;
  assert.deepStrictEqual([read.x, read.y, read.w, read.h, read.fmt], [0, 0, 640, 480, GS.FMT.RGB565],
    'the whole back buffer is read as RGB565');
}
view.setUint16(wa(lfb), 0xf800, true);
m = rec.mark();
assert.strictEqual(call('_grLfbUnlock@8', [1, 1]), 1);
call('_grSstIdle@0');
{
  const ups = rec.recordsSince(m).filter(r => r.name === 'UPLOAD');
  assert(ups.length >= 1, 'the write unlock uploads the LFB');
  assert.strictEqual(ups[0].fields.x, 0); assert.strictEqual(ups[0].fields.y, 0);
  assert.strictEqual(ups[0].data.readUInt32LE(0), 0xff0000ff, 'the RGB565 write reaches the target as red');
  assert.strictEqual(rec.textures.get(ups[0].fields.id).kind, KIND.RT, 'into a render target');
}
assert.strictEqual(call('_grLfbUnlock@8', [1, 1]), 0, 'unmatched unlock is rejected');
// Retail glide2x does not check info->size (GR_CHECK_F is debug-only), and
// Die by the Sword's rl3dfx.dll locks with whatever its stack held there.
view.setUint32(wa(info), 0x7661772e, true);
assert.strictEqual(call('_grLfbLock@24', [1, 1, 0, 0, 0, info]), 1,
  'a lock with an uninitialised info->size succeeds');
assert.strictEqual(view.getUint32(wa(info + 4), true), lfb, 'and still reports the LFB');
assert.strictEqual(call('_grLfbUnlock@8', [1, 1]), 1);
const sparseInfo = sparseBase + 4094;
fillGuest(sparseInfo - 4, 28, 0xcc);
a.guest_write32(sparseInfo, 20);
assert.strictEqual(call('_grLfbLock@24', [0, 1, 0, 1, 0, sparseInfo]), 1);
const expectedInfo = Buffer.alloc(20);
[20, lfb, 1280, 0, 1].forEach((value, i) => expectedInfo.writeUInt32LE(value, i * 4));
assert.deepStrictEqual(readGuest(sparseInfo, 20), expectedInfo,
  'LFB size and pointer fields crossing sparse pages retain the complete SDK layout');
sparseGuards(sparseInfo, 20);
assert.strictEqual(call('_grLfbUnlock@8', [0, 1]), 1);
const pixel = 0x419ffc;
view.setUint16(wa(pixel), 0x07e0, true);
m = rec.mark();
assert.strictEqual(call('_grLfbWriteRegion@32', [1, 3, 2, 0, 1, 1, 2, pixel]), 1);
call('_grSstIdle@0');
{
  // WriteRegion publishes the staged LFB; pixel (3, 2) lands at its row offset.
  const up = rec.recordsSince(m).find(r => r.name === 'UPLOAD' && r.fields.y === 0);
  assert(up, 'WriteRegion uploads the LFB');
  assert.strictEqual(up.data.readUInt32LE(2 * up.fields.pitch + 3 * 4), 0xff00ff00,
    'the RGB565 green pixel lands at (3, 2)');
}
assert.strictEqual(call('_grLfbReadRegion@28', [1, 3, 2, 1, 1, 2, pixel]), 1);
assert.strictEqual(view.getUint16(wa(pixel), true), 0x5a5a);
assert.strictEqual(call('_grSstVRetraceOn@0'), 0);
ticks = 16;
assert.strictEqual(call('_grSstVRetraceOn@0'), 1, 'virtual retrace advances with clock');
assert.strictEqual(call('_grSstStatus@0') & 64, 0, 'status retrace bit is active low');
assert.strictEqual(call('_grSstControl@4', [3]), 1, 'GR_CONTROL_RESIZE succeeds');
assert.strictEqual(call('_grSstControl@4', [4]), 1,
  'GR_CONTROL_MOVE succeeds (Driver closes its window when it fails)');
assert.strictEqual(call('_grSstControl@4', [99]), 0, 'unknown control code fails');
assert.strictEqual(call('_grSstControl@4', [2]), 1);
m = rec.mark();
call('_grBufferSwap@4', [0]);
assert(!rec.recordsSince(m).some(r => r.name === 'PRESENT'), 'a deactivated board presents nothing');
assert.strictEqual(view.getUint32(regions.BASE.GLIDE_STATE + 256 + 244, true), 0, 'deactivation is board state');
const beforePendingClose = rec.mark();
call('_grBufferClear@12', [0x112233, 255, 65535]);
call('_grDrawPoint@4', [vertices]);
assert.strictEqual(rec.kicksSince(beforePendingClose).length, 0, 'commands remain pending before close');
call('_grSstWinClose@0', [], b);
assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer, dxState, 32)), savedDisplay,
  'close from another instance restores prior display exactly');
assert.deepStrictEqual(moves.at(-1), [1, 15, 25, 800, 600]);
const closedMoveCount = moves.length;
call('_grSstWinClose@0');
assert.strictEqual(moves.length, closedMoveCount, 'repeated close does not resize again');
{
  const kicks = rec.kicksSince(beforePendingClose);
  assert.strictEqual(kicks.at(-1).mode, KICK.KICK_CLOSE, 'close ends with a CLOSE kick');
  assert.strictEqual(kicks.filter(k => k.mode === KICK.KICK_CLOSE).length, 1, 'repeated close kicks nothing');
  const retired = rec.recordsSince(beforePendingClose).filter(r => r.name === 'CLEAR' || r.name === 'DRAW_UP');
  assert.deepStrictEqual(retired.map(r => r.name), ['CLEAR', 'DRAW_UP'], 'pending batch is consumed before close; queued clear remains ordered');
  assert.strictEqual(retired[0].fields.rgba >>> 0, 0xff332211, 'queued clear color is preserved (ARGB 0x112233)');
  assert.strictEqual(retired[1].fields.prim, PRIM.POINTLIST, 'queued point follows the clear');
}
assert.strictEqual(a.guest_span_cursor_bytes(), 0, 'temporary guest spans are released');
call('_grGlideShutdown@0');
assert.strictEqual(view.getUint32(regions.BASE.GLIDE_STATE + 16, true), 0, 'shutdown releases stream');
assert.strictEqual(view.getUint32(regions.BASE.GLIDE_STATE + 40, true), 0, 'shutdown releases LFB');
call('_grGlideInit@0');
rec.noExecutor = true;   // gpu_stream_kick: no executor can exist
assert.strictEqual(a.post_queue_depth() + b.post_queue_depth(), 0);
assert.strictEqual(call('_grSstWinOpen@28', [1, 7, 0, 0, 0, 2, 1]), 0);
assert.strictEqual(a.post_queue_depth() + b.post_queue_depth(), 0, 'failed host open posts no layout messages');
assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer, dxState, 32)), savedDisplay,
  'failed open leaves display state untouched');
assert.strictEqual(moves.length, closedMoveCount);
rec.noExecutor = false;
call('_grSstWinOpen@28', [1, 7, 0, 0, 0, 2, 1]);
call('_grGlideShutdown@0', [], b);
assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer, dxState, 32)), savedDisplay,
  'shutdown with live context restores display');
assert.deepStrictEqual(moves.at(-1), [1, 15, 25, 800, 600]);
windowRects.clear();
const missingMoveCount = moves.length;
m = rec.mark();
call('_grSstWinOpen@28', [0, 7, 0, 0, 0, 2, 1]);
assert.strictEqual(a.get_dx_exclusive_hwnd(), 0, 'headless context does not claim a missing HWND');
assert.strictEqual(moves.length, missingMoveCount);
// The executor learns the colour buffer count as the render targets it creates.
assert.strictEqual(rec.kicksSince(m).at(-1).mode, KICK.KICK_SYNC);
assert.strictEqual(openRts({records: rec.recordsSince(m)}).length, 2, 'double buffering creates two colour buffers');
// grDrawPolygonVertexList: a convex polygon is a fan from vlist[0], stepping
// the SDK's 60-byte GrVertex (Myth TFL's terrain path; it abandons Glide
// entirely when this export is missing). Each vertex's x names it.
const poly = 0x4150f0;
for (let v = 0; v < 5; ++v) for (let f = 0; f < 15; ++f)
  view.setFloat32(wa(poly + v * 60 + f * 4), f === 0 ? 100 + v : 0.5, true);
const beforePoly = rec.mark();
call('_grDrawPolygonVertexList@8', [5, poly]);
call('_grDrawPolygonVertexList@8', [2, poly]);   // fewer than three vertices draws nothing
call('_grBufferSwap@4', [1]);
const fans = primitives(rec.recordsSince(beforePoly)).filter(p => p.op === 5).map(p => p.verts.map(v => v[0]));
assert.deepStrictEqual(fans, [[100, 101, 102], [100, 102, 103], [100, 103, 104]],
  'five vertices draw exactly three fan triangles; a two-vertex list draws none');
// Myth opens single-buffered with two aux buffers, which the release Glide 2.4
// driver accepts on a 4 MiB board; triple buffering has no surface and fails.
call('_grSstWinClose@0');
m = rec.mark();
assert.strictEqual(call('_grSstWinOpen@28', [0, 7, 0, 0, 0, 1, 2]), 1, 'single-buffered open accepted');
assert.strictEqual(openRts({records: rec.recordsSince(m)}).length, 1, 'backend is told there is one color buffer');
call('_grSstWinClose@0');
// Triple buffering has no surface: FXFALSE with nothing opened, as a board
// short of frame-buffer memory answers. Deus Ex's GlideDrv then retries with 2.
const beforeTriple = rec.mark();
assert.strictEqual(call('_grSstWinOpen@28', [0, 7, 0, 0, 0, 3, 0]), 0,
  'triple buffering is refused, not silently double-buffered');
assert.strictEqual(rec.kicksSince(beforeTriple).length, 0, 'a refused open reaches no backend');
assert.strictEqual(rec.recordsSince(beforeTriple).length, 0, 'and creates nothing');
assert.strictEqual(call('_grSstWinOpen@28', [0, 7, 0, 0, 0, 2, 1]), 1, 'the double-buffered retry opens');
// gu.c presets: guColorCombineFunction -> grColorCombine state (+0..+16),
// guAlphaSource -> grAlphaCombine state (+20..+36).
const glideState = (from, n) => Array.from({length: n}, (_, i) =>
  view.getUint32(regions.BASE.GLIDE_STATE + 256 + from + i * 4, true));
for (const [fnc, expected] of [
  [0, [0, 0, 1, 2, 0]], [1, [1, 0, 1, 2, 0]], [2, [1, 0, 0, 2, 0]], [4, [3, 8, 1, 1, 0]],
  [5, [3, 1, 1, 1, 0]], [6, [3, 1, 0, 1, 0]], [8, [5, 1, 0, 1, 0]], [9, [3, 3, 1, 1, 0]],
  [10, [4, 3, 0, 1, 0]], [11, [4, 8, 0, 1, 0]], [12, [6, 8, 0, 1, 0]], [13, [7, 4, 1, 0, 0]],
  [14, [4, 3, 0, 1, 0]], [15, [5, 1, 0, 1, 0]], [16, [0, 0, 1, 2, 1]],
]) {
  call('_guColorCombineFunction@4', [fnc]);
  assert.deepStrictEqual(glideState(0, 5), expected, 'guColorCombineFunction ' + fnc);
}
assert.throws(() => call('_guColorCombineFunction@4', [3]), WebAssembly.RuntimeError,
  'ITRGB_DELTA0 needs flat iterated colour, which is not modelled');
for (const [mode, expected] of [
  [0, [1, 0, 1, 2, 0]], [1, [1, 0, 0, 2, 0]], [2, [3, 8, 1, 1, 0]], [3, [3, 1, 0, 1, 0]],
]) {
  call('_guAlphaSource@4', [mode]);
  assert.deepStrictEqual(glideState(20, 5), expected, 'guAlphaSource ' + mode);
}
call('_guTexCombineFunction@8', [0, 6]);
assert.deepStrictEqual(glideState(184, 6), [7, 12, 7, 12, 0, 0],
  'guTexCombineFunction is grTexCombineFunction (digutex.c)');
// grTexDownloadMipMapLevel[Partial]: one level of a 256..1 8-bit 1x1-aspect
// mipmap at 0x1000; level 2 (64x64) sits after the 256x256 and 128x128 levels.
const levelData = 0x416000;
for (let i = 0; i < 4096; ++i) a.guest_write8(levelData + i, i & 0xff);
const beforeLevels = rec.mark();
call('_grTexDownloadMipMapLevel@32', [0, 0x1000, 2, 0, 3, 0, 3, levelData]);
call('_grTexDownloadMipMapLevelPartial@40', [0, 0x1000, 2, 0, 3, 0, 3, levelData, 3, 5]);
call('_grTexDownloadMipMapLevel@32', [0, 0x1000, 1, 0, 3, 0, 1, levelData]); // odd level, even mask: skipped
assert.strictEqual(rec.kicksSince(beforeLevels).length, 0, 'downloads stay in TMU RAM');
{
  // Downloads only fill TMU RAM; the stream sees the chain when a draw samples
  // it. Sample the 256..64 RGB332 chain at 0x1000 with a texture-only combine.
  const texInfo = 0x417f00;
  [2, 0, 3, 0, 0].forEach((v, i) => a.guest_write32(texInfo + i * 4, v)); // small 64, large 256, 1x1, RGB332
  call('_guColorCombineFunction@4', [4]);   // other = texture
  call('_grTexCombineFunction@8', [0, 1]);  // TMU0 local texture
  call('_grTexSource@16', [0, 0x1000, 3, texInfo]);
  call('_grDrawPoint@4', [poly]);
  call('_grBufferSwap@4', [1]);
  const records = rec.recordsSince(beforeLevels);
  const draw = primitives(records).at(-1);
  const bound = draw.state.bind.find(e => e.slot === 0);
  assert(bound, 'the textured point binds TMU0');
  const tex = rec.textures.get(bound.texture);
  assert.deepStrictEqual([tex.width, tex.height, tex.levels], [256, 256, 3], 'the chain is 256..64');
  const ups = records.filter(r => r.name === 'UPLOAD' && r.fields.id === bound.texture);
  assert.deepStrictEqual(ups.map(r => [r.fields.level, r.fields.w, r.fields.h]), [[0, 256, 256], [1, 128, 128], [2, 64, 64]]);
  const rgb332 = x => {
    const e = v => Math.floor((v * 510 + 7) / 14);
    return (e((x >> 5) & 7) | e((x >> 2) & 7) << 8 | ((x & 3) * 85) << 16 | 0xff << 24) >>> 0;
  };
  const level2 = Array.from({length: 4096}, (_, i) => rgb332(i >= 3 * 64 && i < 6 * 64 ? i - 3 * 64 : i & 0xff));
  assert.deepStrictEqual(Array.from(tex.data[2]), level2,
    'whole level at its packed offset; rows 3..5 at their row offset');
  assert(tex.data[1].every(t => t === 0xff000000), 'a level outside the mask is skipped (unwritten TMU RAM)');
}
call('_grGlideShutdown@0');
call('_grGlideInit@0');
assert.strictEqual(call('_grSstWinOpen@28', [0, 7, 0, 0, 0, 2, 1]), 1);
call('_grBufferClear@12', [0, 255, 65535]);
{
  // Glide 2's grTexDownloadTablePartial(tmu, type, data, start, end) replaces
  // only entries start..end of the shared palette, like the Glide 3 form.
  // Recording a palette needs an open window, hence here; the extension block
  // is re-allocated after the shutdown above, so it is read after the calls.
  const tableA = 0x420000, tableB = 0x421000;
  for (let i = 0; i < 1024; ++i) { a.guest_write8(tableA + i, (i * 7) & 255); a.guest_write8(tableB + i, (i * 13 + 5) & 255); }
  call('_grTexDownloadTable@12', [0, 2, tableA]);
  call('_grTexDownloadTablePartial@20', [0, 2, tableB, 10, 12]);
  const ext = wa(view.getUint32(regions.BASE.GLIDE_STATE + 116, true));  // a guest pointer ($glide3_ext)
  const pal = Buffer.from(new Uint8Array(memory.buffer, ext + 128, 1024));
  assert.deepStrictEqual(pal.subarray(40, 52), readGuest(tableB + 40, 12), 'entries 10..12 come from the partial download');
  assert.deepStrictEqual(pal.subarray(0, 40), readGuest(tableA, 40), 'entries below start keep the full table');
  assert.deepStrictEqual(pal.subarray(52), readGuest(tableA + 52, 1024 - 52), 'entries above end keep the full table');
}
{
  // grSstPerfStats: pixelsIn/pixelsOut are the rasterised area of the Glide 2
  // triangles drawn since grSstResetPerfStats; the backend reports no fragment
  // test results, so the three fail counters are 0. Two triangles tiling a 4x4
  // square must count its 16 pixel centres exactly once (6 + 10).
  const tri = 0x416000, stats = 0x416400;
  const vertex = (i, x, y) => { for (let f = 0; f < 15; ++f) view.setFloat32(wa(tri + i * 60 + f * 4), f === 0 ? x : f === 1 ? y : 0.5, true); };
  const perf = () => { call('_grSstPerfStats@4', [stats]); return Array.from({length: 5}, (_, i) => a.guest_read32(stats + i * 4) >>> 0); };
  call('_grClipWindow@16', [0, 0, 640, 480]);
  call('_grSstResetPerfStats@0');
  assert.deepStrictEqual(perf(), [0, 0, 0, 0, 0], 'reset clears every counter');
  vertex(0, 0, 0); vertex(1, 4, 0); vertex(2, 0, 4);
  call('_grDrawTriangle@12', [tri, tri + 60, tri + 120]);
  assert.deepStrictEqual(perf(), [6, 0, 0, 0, 6], 'lower-left half of the square covers 6 pixel centres');
  vertex(3, 4, 4);
  call('_grDrawTriangle@12', [tri + 60, tri + 180, tri + 120]);
  assert.deepStrictEqual(perf(), [16, 0, 0, 0, 16], 'the shared diagonal is counted once: 4x4 = 16');
  call('_grClipWindow@16', [0, 0, 2, 2]);
  call('_grSstResetPerfStats@0');
  call('_grDrawTriangle@12', [tri, tri + 60, tri + 120]);
  assert.deepStrictEqual(perf(), [4, 0, 0, 0, 4], 'the clip window bounds the count (2x2, all inside x+y<4)');
  call('_grClipWindow@16', [0, 0, 640, 480]);
  // grAADrawTriangle: the triangle, then one native line per flagged edge.
  const beforeAA = rec.mark();
  call('_grAADrawTriangle@24', [tri, tri + 60, tri + 120, 1, 1, 1]);
  call('_grAADrawTriangle@24', [tri, tri + 60, tri + 120, 0, 1, 0]);
  call('_grAADrawLine@8', [tri, tri + 60]);
  call('_grBufferSwap@4', [1]);
  // The swap also carries the three perf-test triangles above; the AA calls are its tail.
  const ops = primitives(rec.recordsSince(beforeAA)).map(p => p.op);
  assert.deepStrictEqual(ops.filter(op => op === 5 || op === 11).slice(-7), [5, 11, 11, 11, 5, 11, 11],
    'each AA triangle draws itself, then a line for each flagged edge; grAADrawLine is one line');
}
// The swap above submitted the pending batch; give the rejected swap below one.
call('_grBufferClear@12', [0, 255, 65535]);
rec.failDrain = true;
assert.throws(() => call('_grBufferSwap@4', [0]), WebAssembly.RuntimeError,
  'a failed host batch traps even when worker RPC converted a host error to zero');
assert.notStrictEqual(ring('error_code'), 0, 'the executor failure is recorded in the ring');
console.log('PASS Glide 2 decorated ABI, shared state, immutable draws, sparse output spans, LFB ordering and pending-close retirement');
