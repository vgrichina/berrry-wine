#!/usr/bin/env node
'use strict';
// tl;dr: GetCursorPos never reports a point off the screen or outside an
// active ClipCursor rectangle, whatever the host pointer says. Windows keeps
// the cursor on the screen and games index framebuffers with it unchecked:
// on berrry.wine Red Alert (fullscreen 640x400 DirectDraw) got a pointer past
// the picture, drew its selection box with a vertical line of length -3, and
// the pixel loop at 0x5a3033 walked 1.25M rows into the shared arena
// ("invalid shared heap memory access", crash report 2026-11-24).
const assert = require('assert/strict');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
(global $cc_ddraw (mut i32) (i32.const 0))
(func (export "cc_init") (param $hwnd i32)
 (global.set $DX_VTBL_DDRAW (i32.const 0x51000000))
 (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
 (global.set $main_hwnd (local.get $hwnd))
 (global.set $cc_ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW))))
(func (export "cc_coop") (param $hwnd i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
 (call $handle_IDirectDraw_SetCooperativeLevel (global.get $cc_ddraw) (local.get $hwnd)
   (i32.const 0x11) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "cc_mode") (param $w i32) (param $h i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
 (call $handle_IDirectDraw_SetDisplayMode (global.get $cc_ddraw) (local.get $w) (local.get $h)
   (i32.const 8) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "cc_cursor") (param $out i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
 (call $handle_GetCursorPos (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "cc_clip") (param $rect i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
 (call $handle_ClipCursor (local.get $rect) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
`;

(async () => {
  const { exports: wat, renderer } = await bootRenderHarness({ extraWat, fonts: 'none', width: 640, height: 480 });
  renderer.lazyPresentation = true;
  const out = 0x410000, rect = 0x410100;
  let host = [0, 0];
  // The raw host pointer, before any presentation mapping or clamping.
  renderer.getMousePosition = () => (((host[1] & 0xffff) << 16) | (host[0] & 0xffff)) >>> 0;
  renderer.setCursorPos = () => {};
  const cursor = (x, y) => {
    host = [x, y];
    assert.equal(wat.cc_cursor(out), 1, 'GetCursorPos succeeds');
    return [wat.guest_read32(out) | 0, wat.guest_read32(out + 4) | 0];
  };

  // Desktop (640x480 canvas): in range is untouched, outside clamps per axis.
  assert.deepEqual(cursor(321, 183), [321, 183]);
  assert.deepEqual(cursor(-40, 200), [0, 200], 'left of the screen');
  assert.deepEqual(cursor(300, -7), [300, 0], 'above the screen');
  assert.deepEqual(cursor(9000, 9000), [639, 479], 'past the bottom-right corner');

  // Red Alert's case: a 640x400 fullscreen DirectDraw mode.
  const hwnd = 0x10001;
  renderer.createWindow(hwnd, 0x90000000 | 0, 0, 0, 640, 400, 'Red Alert', 0);
  wat.cc_init(hwnd);
  assert.equal(wat.cc_coop(hwnd), 0, 'SetCooperativeLevel(EXCLUSIVE|FULLSCREEN)');
  assert.equal(wat.cc_mode(640, 400), 0, 'SetDisplayMode(640,400,8)');
  assert.deepEqual(cursor(200, 470), [200, 399], 'below the mode clamps to its last row');
  assert.deepEqual(cursor(-3, -3), [0, 0]);
  assert.deepEqual(cursor(639, 399), [639, 399], 'the last pixel is reachable');

  // ClipCursor narrows it further (right/bottom exclusive, as on Windows).
  [100, 50, 300, 250].forEach((v, i) => wat.guest_write32(rect + i * 4, v));
  host = [150, 100];
  assert.equal(wat.cc_clip(rect), 1, 'ClipCursor');
  assert.deepEqual(cursor(10, 10), [100, 50]);
  assert.deepEqual(cursor(600, 390), [299, 249]);
  assert.deepEqual(cursor(150, 100), [150, 100]);
  assert.equal(wat.cc_clip(0), 1, 'ClipCursor(NULL)');
  assert.deepEqual(cursor(600, 390), [600, 390], 'released: back to the screen bounds');

  console.log('PASS  GetCursorPos stays on the screen and inside ClipCursor');
})().catch(error => { console.error(error); process.exit(1); });
