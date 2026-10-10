#!/usr/bin/env node
'use strict';

// Moving or resizing a visible child uncovers part of its old rectangle, and
// USER invalidates (and erases) that area of the parent so the parent and any
// sibling beneath repaint it. Children paint into the parent's surface here,
// so without it the old pixels stay on screen: Tetravex's dragged tile left a
// copy of itself in the supply slot it came from. SWP_NOREDRAW, MoveWindow's
// bRepaint = FALSE and a move that changes nothing invalidate nothing.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const WS_VISIBLE = 0x10000000;
const SWP_NOZORDER = 0x0004, SWP_NOREDRAW = 0x0008, SWP_NOACTIVATE = 0x0010;

const extraWat = String.raw`
  (func (export "test_call_SetWindowPos")
    (param $hwnd i32) (param $x i32) (param $y i32)
    (param $w i32) (param $h i32) (param $flags i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $saved_esp) (i32.const 24)) (local.get $h))
    (call $gs32 (i32.add (local.get $saved_esp) (i32.const 28)) (local.get $flags))
    (call $handle_SetWindowPos
      (local.get $hwnd) (i32.const 0) (local.get $x) (local.get $y)
      (local.get $w) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_call_MoveWindow")
    (param $hwnd i32) (param $x i32) (param $y i32)
    (param $w i32) (param $h i32) (param $repaint i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $gs32 (i32.add (local.get $saved_esp) (i32.const 24)) (local.get $repaint))
    (call $handle_MoveWindow
      (local.get $hwnd) (local.get $x) (local.get $y)
      (local.get $w) (local.get $h) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_reparent") (param $hwnd i32) (param $parent i32)
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent)))
  (func (export "test_get_parent") (param $hwnd i32) (result i32)
    (call $wnd_get_parent (local.get $hwnd)))
  (func (export "test_clear") (param $parent i32)
    (call $paint_clear_subtree (local.get $parent))
    (call $update_clear_hwnd (local.get $parent))
    (call $nc_flags_clear (local.get $parent) (i32.const 3))
    (global.set $paint_pending (i32.const 0)))
  ;; Bit 2: an erase is due with the next BeginPaint (WM_ERASEBKGND).
  (func (export "test_erase_pending") (param $hwnd i32) (result i32)
    (i32.ne (i32.and (call $nc_flags_test (local.get $hwnd)) (i32.const 2)) (i32.const 0)))
  (func (export "test_paint_pending") (param $hwnd i32) (result i32)
    (call $paint_flag_test_hwnd (local.get $hwnd)))
  (func (export "test_g2w") (param $ga i32) (result i32) (call $g2w (local.get $ga)))
  (func (export "test_update_rect") (param $hwnd i32) (param $rect i32) (result i32)
    (call $update_get_rect (local.get $hwnd) (call $g2w (local.get $rect))))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat });
  const rect = e.guest_alloc(16) >>> 0;
  const readRect = () => {
    const has = e.test_update_rect(parent, rect);
    const dv = new DataView(memory.buffer);
    const wa = e.test_g2w(rect) >>> 0;
    return { has, l: dv.getInt32(wa, true), t: dv.getInt32(wa + 4, true), r: dv.getInt32(wa + 8, true), b: dv.getInt32(wa + 12, true) };
  };
  // Sibling B first (lower in z), then A on top of it, both at (0,0,40,20).
  const below = e.test_create_edit(0, 0, 40, 20, 0x50000000, 0) >>> 0;
  const parent = e.test_get_parent(below) >>> 0;
  const moving = e.test_create_edit(0, 0, 40, 20, 0x50000000, 0) >>> 0;
  e.test_reparent(moving, parent);
  assert.strictEqual(e.test_get_parent(moving) >>> 0, parent, 'both children share the parent');
  e.wnd_set_style_export(parent, (e.wnd_get_style_export(parent) | WS_VISIBLE) >>> 0);

  const covers = (r, l, t, rr, b) => r.has && r.l <= l && r.t <= t && r.r >= rr && r.b >= b;

  // SetWindowPos moves A away: the parent's update region covers the old rect
  // and the sibling under it is due a repaint.
  e.test_clear(parent);
  assert.strictEqual(e.test_call_SetWindowPos(moving, 200, 0, 40, 20, SWP_NOZORDER | SWP_NOACTIVATE), 1);
  let r = readRect();
  assert(covers(r, 0, 0, 40, 20), `parent update rect covers the vacated (0,0,40,20): ${JSON.stringify(r)}`);
  assert(e.test_paint_pending(below), 'the sibling beneath the vacated rect is repainted');
  assert(e.test_erase_pending(parent), 'the parent erases its background under the vacated rect');

  // SWP_NOREDRAW: nothing is invalidated.
  e.test_clear(parent);
  assert.strictEqual(e.test_call_SetWindowPos(moving, 300, 0, 40, 20, SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOREDRAW), 1);
  assert(!readRect().has, 'SWP_NOREDRAW leaves the parent valid');
  assert(!e.test_paint_pending(below), 'SWP_NOREDRAW repaints no sibling');
  assert(!e.test_erase_pending(parent), 'SWP_NOREDRAW requests no erase');

  // A SetWindowPos that changes nothing exposes nothing.
  e.test_clear(parent);
  assert.strictEqual(e.test_call_SetWindowPos(moving, 300, 0, 40, 20, SWP_NOZORDER | SWP_NOACTIVATE), 1);
  assert(!readRect().has, 'an unchanged rect invalidates nothing');
  assert(!e.test_erase_pending(parent), 'an unchanged rect requests no erase');

  // MoveWindow back over B with bRepaint TRUE, then away: exposes (300,0,340,20)'s
  // successor -- here the rect it left at (0,0).
  assert.strictEqual(e.test_call_MoveWindow(moving, 0, 0, 40, 20, 1), 1);
  e.test_clear(parent);
  assert.strictEqual(e.test_call_MoveWindow(moving, 120, 0, 40, 20, 1), 1);
  r = readRect();
  assert(covers(r, 0, 0, 40, 20), `MoveWindow exposes the vacated rect: ${JSON.stringify(r)}`);
  assert(e.test_paint_pending(below), 'MoveWindow repaints the sibling beneath');
  assert(e.test_erase_pending(parent), 'MoveWindow erases the vacated background');

  // MoveWindow with bRepaint FALSE behaves as SWP_NOREDRAW.
  e.test_clear(parent);
  assert.strictEqual(e.test_call_MoveWindow(moving, 160, 0, 40, 20, 0), 1);
  assert(!e.test_paint_pending(below), 'bRepaint FALSE repaints no sibling');
  assert(!e.test_erase_pending(parent), 'bRepaint FALSE requests no erase');

  console.log('PASS  moving a visible child invalidates and erases its vacated rect in the parent (SetWindowPos, MoveWindow); NOREDRAW/no-change do not');
})().catch(err => { console.error(err && err.stack || err); process.exit(1); });
