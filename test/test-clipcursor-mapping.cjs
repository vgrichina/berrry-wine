#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { bootRenderHarness } = require('./render-helper');
const table = require('../src/api_table.json');

// Independent literal RECTs: four signed 32-bit LONGs, in left/top/right/bottom
// order. Only valid, nondegenerate rectangles are used. No desktop intersection
// or Windows invalid-pointer behavior is inferred by this mapping regression.
// https://learn.microsoft.com/en-us/windows/win32/api/windef/ns-windef-rect
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-clipcursor
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getclipcursor
const rectangles = [
  [-305419896, -16909060, 19088743, 84281096],
  [-12, 34, 456, 378], [-800, -600, -1, -2], [7, 11, 600, 470],
];
const extraWat = String.raw`
  (func (export "clip_mapping_init")
    (global.set $thunk_guest_base (i32.add (global.get $image_base)
      (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
    (call $update_thunk_end))
  (func (export "clip_mapping_module") (param $p i32) (result i32)
    (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "clip_mapping_resolve") (param $m i32) (param $p i32) (result i32)
    (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "clip_mapping_id") (param $p i32) (result i32)
    (call $lookup_api_id (call $g2w (local.get $p))))
  (func (export "clip_mapping_regs") (result i32) (global.get $reg_base))
  (func (export "clip_mapping_call") (param $p i32)
    (call $win32_dispatch
      (i32.shr_u (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
`;

async function exercise() {
  let screenSize = 640 | (480 << 16);
  const { exports: e, memory } = await bootRenderHarness({
    extraWat, fonts: 'none', width: 640, height: 480,
    extraHostOverrides: { get_screen_size: () => screenSize },
  });
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
  e.heap_init(0x800000);
  e.clip_mapping_init();
  e.set_api_log(0);
  const view = new DataView(memory.buffer), mem = new Uint8Array(memory.buffer);
  const wa = p => e.guest_to_wasm(p) >>> 0, regs = e.clip_mapping_regs() >>> 0;
  const stackArea = e.guest_alloc(256) >>> 0, stack = stackArea + 64;
  const direct = e.guest_alloc(128) >>> 0, state = e.guest_alloc(256) >>> 0;
  const directBytes = (p, n) => mem.subarray(wa(p), wa(p) + n);
  const text = s => {
    const p = e.guest_alloc(s.length + 1) >>> 0;
    directBytes(p, s.length + 1).set(Buffer.from(s + '\0'));
    return p;
  };
  view.setUint32(regs + 16, stack, true);
  const user32 = e.clip_mapping_module(text('USER32.DLL')) >>> 0;
  assert.ok(user32, 'public USER32 module');
  const entries = new Map();
  for (const name of ['ClipCursor', 'GetClipCursor']) {
    const p = text(name), row = table.find(r => r.name === name);
    assert.ok(row, name + ' API registration');
    assert.equal(e.clip_mapping_id(p), row.id, name + ' public hash lookup');
    assert.equal(row.nargs, 1, name + ' BOOL/RECT ABI');
    view.setUint32(regs + 16, stack, true);
    const thunk = e.clip_mapping_resolve(user32, p) >>> 0;
    assert.ok(thunk, name + ' public resolver');
    assert.equal(view.getUint32(wa(thunk) + 4, true), row.id, name + ' thunk ID');
    entries.set(name, thunk);
  }

  // An intervening allocation makes adjacent guest pages separately backed.
  // The decoy catches accesses that continue from the first translated base.
  const base = 0x30000000, decoy = 0x28000000;
  for (const p of [base, decoy, base + 4096])
    assert.equal(e.test_virtual_map_commit(p, 4096) >>> 0, p);
  const backing = [wa(base), wa(decoy), wa(base + 4096)];
  assert.notEqual(backing[2], backing[0] + 4096, 'split guest pages have separate backing');
  assert.equal(backing[1], backing[0] + 4096, 'decoy covers erroneous affine continuation');
  const spans = [[wa(direct), 128], ...backing.map(p => [p, 4096])];
  function seed() {
    for (const [p, n] of spans) mem.fill(0xA5, p, p + n);
    directBytes(state, 256).fill(0x6B);
  }
  const snapshot = () => spans.map(([p, n]) => Buffer.from(mem.subarray(p, p + n)));
  const read = p => Buffer.from(Array.from({ length: 16 }, (_, i) => mem[wa(p + i)]));
  const encode = rect => { const b = Buffer.alloc(16); rect.forEach((v, i) => b.writeInt32LE(v, i * 4)); return b; };
  const put = (p, bytes) => bytes.forEach((b, i) => { mem[wa(p + i)] = b; });
  const currentClip = () => [e.clip_cursor_active(), e.clip_cursor_left(),
    e.clip_cursor_top(), e.clip_cursor_right(), e.clip_cursor_bottom()];
  const unchangedState = () => [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(),
    e.get_flag_res(), e.get_flag_sign_shift(), e.get_capture_hwnd(),
    e.get_cursor(), e.get_cursor_display_count(), e.get_current_thread_id(),
    e.get_yield_reason(), e.get_yield_flag(), e.get_quit_flag()];
  const failures = [];
  let calls = 0, controlChecks = 0, splitChecks = 0;
  function equal(actual, expected, label, mapping) {
    const describe = b => b.length > 16
      ? { bytes: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') }
      : b.toString('hex');
    if (Buffer.isBuffer(actual)) actual = describe(actual);
    if (Buffer.isBuffer(expected)) expected = describe(expected);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, mapping, actual, expected });
    if (mapping === 'split') splitChecks++; else controlChecks++;
  }
  function invoke(name, pointer, label, mapping) {
    directBytes(stackArea, 256).fill(0xCC);
    for (let i = 0; i < 8; i++) view.setUint32(regs + i * 4, 0x41320000 + i, true);
    view.setUint32(regs + 16, stack, true);
    view.setUint32(wa(stack), 0x12345678, true);
    view.setUint32(wa(stack) + 4, pointer, true);
    const savedStack = Buffer.from(directBytes(stackArea, 256));
    const savedState = Buffer.from(directBytes(state, 256));
    const savedEip = e.get_eip(), savedLastError = e.test_get_last_error();
    const savedHandlerEip = e.get_handler_set_eip();
    const savedOtherState = unchangedState();
    e.clip_mapping_call(entries.get(name));
    equal(view.getUint32(regs, true), pointer || name === 'ClipCursor' ? 1 : 0,
      label + ' BOOL', mapping);
    assert.equal(view.getUint32(regs + 16, true), stack + 8, label + ' stdcall ESP');
    for (const i of [1, 2, 3, 5, 6, 7])
      assert.equal(view.getUint32(regs + i * 4, true), 0x41320000 + i, label + ' register ' + i);
    assert.equal(e.get_eip(), savedEip, label + ' EIP');
    assert.equal(e.get_handler_set_eip(), savedHandlerEip, label + ' handler EIP');
    assert.equal(e.test_get_last_error(), savedLastError, label + ' last error');
    assert.deepEqual(unchangedState(), savedOtherState, label + ' flags/capture/cursor/thread/yield state');
    assert.deepEqual(Buffer.from(directBytes(stackArea, 256)), savedStack, label + ' stack');
    assert.deepEqual(Buffer.from(directBytes(state, 256)), savedState, label + ' unrelated state');
    calls++;
  }
  function query(pointer, want, label, mapping) {
    const before = snapshot(), expected = before.map(b => Buffer.from(b));
    if (pointer) for (let i = 0; i < 16; i++) {
      const p = wa(pointer + i), index = spans.findIndex(([start, n]) => p >= start && p < start + n);
      assert.ok(index >= 0, 'query target belongs to a guarded span');
      expected[index][p - spans[index][0]] = want[i];
    }
    const clip = currentClip();
    invoke('GetClipCursor', pointer, label, mapping);
    if (pointer) equal(read(pointer), want, label + ' all 16 coordinate bytes', mapping);
    snapshot().forEach((b, i) => equal(b, expected[i], label + ' whole backing/canary ' + i, mapping));
    assert.deepEqual(currentClip(), clip, label + ' query preserves confinement state');
  }
  seed();
  const defaultRect = encode([0, 0, 640, 480]);
  query(direct + 32, defaultRect, 'initial current default', 'contiguous');
  query(0, null, 'null query compatibility', 'contiguous');
  for (const rect of rectangles) for (const split of [0, ...Array.from({ length: 15 }, (_, i) => i + 1)]) {
    const pointer = split ? base + 4096 - split : direct + 16;
    const mapping = split ? 'split' : 'contiguous', label = rect.join(',') + ' split=' + split;
    const literal = encode(rect);
    // Clip input access and Get output access are isolated with a contiguous
    // counterpart, so neither defect can hide the other in a round trip.
    seed(); put(pointer, literal);
    const input = snapshot();
    invoke('ClipCursor', pointer, 'input ' + label, mapping);
    equal(currentClip(), [1, ...rect], 'input state ' + label, mapping);
    snapshot().forEach((b, i) => assert.deepEqual(b, input[i], 'ClipCursor input/canary ' + i));
    query(direct + 64, literal, 'input proof ' + label, mapping);

    seed(); put(direct + 16, literal);
    invoke('ClipCursor', direct + 16, 'output setup ' + label, 'contiguous');
    assert.deepEqual(currentClip(), [1, ...rect], 'contiguous input is an independent control');
    query(pointer, literal, 'output ' + label, mapping);
    const old = currentClip(), resetMemory = snapshot();
    invoke('ClipCursor', 0, 'null reset ' + label, 'contiguous');
    assert.deepEqual(currentClip(), [0, ...old.slice(1)], 'reset preserves stored coordinates');
    snapshot().forEach((b, i) => assert.deepEqual(b, resetMemory[i], 'reset does not write buffers'));
    query(pointer, defaultRect, 'default after reset ' + label, mapping);
  }
  screenSize = 1024 | (768 << 16);
  for (const split of [0, ...Array.from({ length: 15 }, (_, i) => i + 1)]) {
    seed();
    query(split ? base + 4096 - split : direct + 32, encode([0, 0, 1024, 768]),
      'current screen default split=' + split, split ? 'split' : 'contiguous');
  }
  const result = { calls, controlChecks, splitChecks, backing, failures };
  console.log(JSON.stringify(result));
  return result;
}
if (require.main === module) exercise().then(result => {
  assert.equal(result.failures.length, 0, 'literal public ClipCursor/GetClipCursor mapping, compatibility and canaries');
  console.log('PASS ' + result.calls + ' public cursor confinement calls; all byte splits, signed coordinates, ABI and page canaries');
}).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { exercise, rectangles, extraWat };
