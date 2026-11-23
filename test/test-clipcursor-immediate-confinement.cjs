#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Microsoft defines screen-coordinate confinement and SetCursorPos clamping:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-clipcursor
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setcursorpos
// Independent implementation evidence for the immediate step: ReactOS
// win32ss/user/ntuser/cursoricon.c, UserClipCursor calls UserSetCursorPos on
// the CURRENT point; UserSetCursorPos excludes right/bottom. No Wine oracle.
// Only valid nonempty rectangles; desktop intersection semantics are outside
// this regression. Negative coordinates exercise the existing signed contract.
const extraWat = String.raw`
  (func (export "confinement_init")
    (global.set $thunk_guest_base (i32.add (global.get $image_base)
      (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
    (call $update_thunk_end))
  (func (export "confinement_module") (param $p i32) (result i32)
    (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "confinement_resolve") (param $m i32) (param $p i32) (result i32)
    (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "confinement_regs") (result i32) (global.get $reg_base))
  (func (export "confinement_call") (param $p i32)
    (call $win32_dispatch
      (i32.shr_u (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
`;

async function exercise() {
  const { exports: e, memory, renderer } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
  e.heap_init(0x800000); e.confinement_init(); e.set_api_log(0);
  const view = new DataView(memory.buffer), mem = new Uint8Array(memory.buffer);
  const wa = p => e.guest_to_wasm(p) >>> 0, regs = e.confinement_regs() >>> 0;
  const storage = e.guest_alloc(256) >>> 0, stackArea = e.guest_alloc(256) >>> 0;
  const rect = storage + 32, point = storage + 96, stack = stackArea + 64;
  const bytes = (p, n) => mem.subarray(wa(p), wa(p) + n);
  function text(s) {
    const p = e.guest_alloc(s.length + 1) >>> 0;
    bytes(p, s.length + 1).set(Buffer.from(s + '\0')); return p;
  }
  view.setUint32(regs + 16, stack, true);
  const user32 = e.confinement_module(text('USER32.DLL')) >>> 0;
  assert.ok(user32, 'public USER32 module');
  const entries = {};
  for (const name of ['ClipCursor', 'SetCursorPos', 'GetCursorPos']) {
    view.setUint32(regs + 16, stack, true);
    entries[name] = e.confinement_resolve(user32, text(name)) >>> 0;
    assert.ok(entries[name], name + ' public resolver');
  }
  const failures = []; let calls = 0, cases = 0;
  const same = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, actual, expected });
  };
  function invoke(name, args) {
    bytes(stackArea, 256).fill(0xCC);
    for (let i = 0; i < 8; i++) view.setUint32(regs + i * 4, 0x41320000 + i, true);
    view.setUint32(regs + 16, stack, true);
    view.setUint32(wa(stack), 0x12345678, true);
    args.forEach((v, i) => view.setInt32(wa(stack) + 4 + i * 4, v, true));
    const savedStack = Buffer.from(bytes(stackArea, 256));
    const saved = [e.get_eip(), e.get_handler_set_eip(), e.test_get_last_error(),
      e.get_flag_op(), e.get_flag_a(), e.get_flag_b(), e.get_flag_res(), e.get_flag_sign_shift(),
      e.get_capture_hwnd(), e.get_cursor(), e.get_cursor_display_count()];
    e.confinement_call(entries[name]);
    assert.equal(view.getUint32(regs, true), 1, name + ' BOOL');
    assert.equal(view.getUint32(regs + 16, true), stack + (args.length + 1) * 4, name + ' stdcall');
    for (const i of [1, 2, 3, 5, 6, 7])
      assert.equal(view.getUint32(regs + i * 4, true), 0x41320000 + i, name + ' register ' + i);
    assert.deepEqual(Buffer.from(bytes(stackArea, 256)), savedStack, name + ' stack guards');
    assert.deepEqual([e.get_eip(), e.get_handler_set_eip(), e.test_get_last_error(),
      e.get_flag_op(), e.get_flag_a(), e.get_flag_b(), e.get_flag_res(), e.get_flag_sign_shift(),
      e.get_capture_hwnd(), e.get_cursor(), e.get_cursor_display_count()], saved,
    name + ' preserves flags, error, instruction and capture/cursor state');
    calls++;
  }
  function query(expected, label) {
    const before = Buffer.from(bytes(storage, 256));
    invoke('GetCursorPos', [point]);
    const actual = [view.getInt32(wa(point), true), view.getInt32(wa(point) + 4, true)];
    same(actual, expected, label);
    const after = Buffer.from(bytes(storage, 256));
    // POINT is the only permitted output, irrespective of the position read.
    after.copy(before, 96, 96, 104);
    assert.deepEqual(after, before, label + ' POINT guards and immutable RECT');
  }
  for (const bounds of [[100, 80, 200, 140], [-200, -140, -100, -80], [-20, -15, 30, 25]]) {
    const [l, t, r, b] = bounds, mx = (l + r) >> 1, my = (t + b) >> 1;
    // Interior, every included edge/corner, every outside edge/corner, and the
    // exact excluded right/bottom boundary. All expected points are literal.
    const samples = [
      [[mx, my], [mx, my]], [[l, my], [l, my]], [[r - 1, my], [r - 1, my]],
      [[mx, t], [mx, t]], [[mx, b - 1], [mx, b - 1]],
      [[l, t], [l, t]], [[r - 1, t], [r - 1, t]],
      [[l, b - 1], [l, b - 1]], [[r - 1, b - 1], [r - 1, b - 1]],
      [[l - 7, my], [l, my]], [[r + 7, my], [r - 1, my]],
      [[mx, t - 7], [mx, t]], [[mx, b + 7], [mx, b - 1]],
      [[l - 7, t - 7], [l, t]], [[r + 7, t - 7], [r - 1, t]],
      [[l - 7, b + 7], [l, b - 1]], [[r + 7, b + 7], [r - 1, b - 1]],
      [[r, my], [r - 1, my]], [[mx, b], [mx, b - 1]],
    ];
    for (const [start, expected] of samples) {
      bytes(storage, 256).fill(0xA5);
      bounds.forEach((v, i) => view.setInt32(wa(rect) + i * 4, v, true));
      invoke('ClipCursor', [0]); invoke('SetCursorPos', start);
      query(start, 'unclipped setup ' + start);
      const before = Buffer.from(bytes(storage, 256));
      invoke('ClipCursor', [rect]);
      assert.deepEqual(Buffer.from(bytes(storage, 256)), before, 'ClipCursor does not write RECT or guards');
      // No mouse input, SetCursorPos or renderer update between these APIs.
      query(expected, 'immediate ' + bounds + ' from ' + start);
      invoke('ClipCursor', [0]); query(expected, 'NULL release preserves current point');
      invoke('SetCursorPos', start); query(start, 'later unclipped SetCursorPos');
      invoke('SetCursorPos', [300, 220]);
      renderer.queueMouseInput(1, -3, 4, 0, 0);
      query([297, 224], 'later unclipped relative motion outside the old rectangle');
      cases++;
    }
  }
  console.log(JSON.stringify({ cases, calls, failures }));
  assert.equal(failures.length, 0, 'ClipCursor immediately confines the existing point without another input');
  console.log('PASS immediate confinement: ' + cases + ' public API cases, signed edges/corners, release, motion, ABI and guards');
}
if (require.main === module) exercise().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { exercise, extraWat };
