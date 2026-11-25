#!/usr/bin/env node
'use strict';

// CreateWindowEx links a new WS_CHILD at the BOTTOM of its siblings; only a
// top-level window is created at the top (Wine: insert_after = WS_CHILD ?
// HWND_BOTTOM : HWND_TOP). Creation order is therefore front-to-back order,
// which is also why it is tab order.
//
// SimCity 2001 (VB6) creates its map PictureBox and then a same-sized
// AutoRedraw mask PictureBox at the same position, both WS_CLIPSIBLINGS. With
// the later window ranked on top, the map's own window DC clipped to an empty
// region, every BitBlt of the composed city to it drew nothing, and the mask
// box's white backing was all the player saw (docs/re-notes/simcity-2001-vb.md).

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_parent") (result i32)
    (local $h i32)
    (local.set $h (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
    (call $wnd_table_set (local.get $h) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $h) (i32.const 0x10000000)))
    (local.get $h))

  (func (export "test_create_child")
      (param $class i32) (param $style i32) (param $parent i32) (param $stack i32)
      (param $x i32) (param $y i32) (param $cx i32) (param $cy i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x00ABCDEF))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $y))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $cx))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (local.get $cy))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (local.get $parent))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40)) (i32.const 0x65))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 44)) (global.get $image_base))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 48)) (i32.const 0))
    (call $handle_CreateWindowExA
      (i32.const 0) (local.get $class) (i32.const 0)
      (local.get $style) (local.get $x) (i32.const 0)))

  (func (export "test_get_dc") (param $hwnd i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_GetDC (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_clip_box") (param $hdc i32) (param $rect_g i32) (result i32)
    (call $gdi_dc_clip_get_box (local.get $hdc) (call $g2w (local.get $rect_g))))

  (func (export "test_above") (param $hwnd i32) (param $sib i32) (result i32)
    (call $wnd_z_is_above_sibling (local.get $hwnd) (local.get $sib)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const parent = e.test_parent();
  e.ctrl_set_geom(parent, 0, 0, 400, 400);
  e.test_gdi_client_rect_set(parent, 0, 0, 400, 400);
  const cls = name => {
    const p = e.guest_alloc(16) >>> 0;
    Buffer.from(name + '\0', 'latin1').forEach((b, i) => e.guest_write8(p + i, b));
    return p;
  };
  const stack = () => (e.guest_alloc(0x400) >>> 0) + 0x300;
  const PANE = 0x56000000;  // CHILD|VISIBLE|CLIPSIBLINGS|CLIPCHILDREN, as VB's PictureBox
  const create = (x, y, cx, cy) => {
    e.test_create_child(cls('STATIC'), PANE, parent, stack(), x, y, cx, cy);
    const h = e.get_eax() >>> 0;
    assert.ok(h, 'CreateWindowExA returned a window');
    return h;
  };

  const map = create(8, 8, 381, 329);
  const mask = create(8, 8, 381, 329);
  const later = create(100, 100, 50, 50);
  // test_above(h, s): s is a visible sibling above h.
  assert.strictEqual(e.test_above(mask, map), 1, 'the first child is above the second');
  assert.strictEqual(e.test_above(map, mask), 0, 'the second child is not above the first');
  assert.strictEqual(e.test_above(later, mask), 1, 'a third child goes under both');
  assert.strictEqual(e.test_above(later, map), 1, 'a third child goes under both');
  console.log('PASS  CreateWindowEx links each new WS_CHILD at the bottom of its siblings');

  const rect = e.guest_alloc(16) >>> 0;
  const box = hdc => {
    const kind = e.test_clip_box(hdc, rect);
    const v = [0, 4, 8, 12].map(o => e.guest_read32(rect + o) | 0);
    return { kind, v };
  };
  const mapDc = e.test_get_dc(map, stack()) >>> 0;
  assert.ok(mapDc, 'GetDC(map)');
  const m = box(mapDc);
  assert.notStrictEqual(m.kind, 1, 'the topmost of two coincident CLIPSIBLINGS panes keeps a visible region');
  assert.deepStrictEqual(m.v, [0, 0, 381, 329], 'its GetDC clip is its whole client area');
  const maskDc = e.test_get_dc(mask, stack()) >>> 0;
  assert.strictEqual(box(maskDc).kind, 1, 'the pane underneath it is fully clipped');
  console.log('PASS  GetDC on the first-created pane draws; the later coincident pane is clipped away');
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
