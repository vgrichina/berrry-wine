#!/usr/bin/env node
'use strict';

// A DirectDraw mode smaller than (or a different shape from) the canvas is
// presented letterboxed: Red Alert 95's 640x400 mode sits 40 px down inside a
// 640x480 canvas. On Windows that mode IS the screen, so a host pointer must
// reach the guest in mode coordinates -- GetCursorPos, WM_MOUSEMOVE/WM_LBUTTON*
// lParams and SM_CYSCREEN all describe 640x400, and the point the player sees
// under the pointer is the point the game hit-tests.
//
// This runs the real WAT DirectDraw handlers (SetCooperativeLevel exclusive,
// SetDisplayMode 640x400, GetCursorPos, GetSystemMetrics) against the real
// renderer, presented lazily the way test/run.js presents it: no repaint has
// run, so the input transform must be derived on demand. Before b6e18c196 the
// headless renderer had no transform until something took a png, every host
// point landed at the same game point, and RA's re-notes route had to click
// 40 px above each button it meant to press.

const assert = require('assert/strict');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
(global $lb_ddraw (mut i32) (i32.const 0))
(func (export "lb_init") (param $hwnd i32)
 (global.set $DX_VTBL_DDRAW (i32.const 0x51000000))
 (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
 (global.set $main_hwnd (local.get $hwnd))
 (global.set $lb_ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW))))
(func (export "lb_coop") (param $hwnd i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
 (call $handle_IDirectDraw_SetCooperativeLevel (global.get $lb_ddraw) (local.get $hwnd)
   (i32.const 0x11) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "lb_mode") (param $w i32) (param $h i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
 (call $handle_IDirectDraw_SetDisplayMode (global.get $lb_ddraw) (local.get $w) (local.get $h)
   (i32.const 8) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "lb_cursor") (param $out i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
 (call $handle_GetCursorPos (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "lb_metric") (param $index i32) (result i32)
 (call $system_metric (local.get $index)))
`;

(async () => {
  const { exports: wat, renderer } = await bootRenderHarness({ extraWat, fonts: 'none' });
  // test/run.js's presentation contract: frames are composited only on demand.
  renderer.lazyPresentation = true;
  const hwnd = 0x10001;
  const out = 0x410000;
  // RA95: CreateWindowExA(WS_POPUP|WS_VISIBLE, 0, 0, 640, 400) before taking
  // the display, on a 640x480 canvas.
  renderer.createWindow(hwnd, 0x90000000 | 0, 0, 0, 640, 400, 'Red Alert', 0);
  wat.lb_init(hwnd);
  assert.equal(wat.lb_coop(hwnd), 0, 'SetCooperativeLevel(EXCLUSIVE|FULLSCREEN)');
  assert.equal(wat.get_dx_exclusive_hwnd() >>> 0, hwnd);

  function cursorAfterMove(x, y) {
    renderer.inputQueue.length = 0;
    renderer.handleMouseMove(x, y);
    assert.equal(wat.lb_cursor(out), 1, 'GetCursorPos succeeds');
    const move = renderer.inputQueue.find(e => e.msg === 0x0200);
    return {
      cursor: [wat.guest_read32(out) | 0, wat.guest_read32(out + 4) | 0],
      lParam: move ? [move.lParam & 0xffff, (move.lParam >>> 16) & 0xffff] : null,
    };
  }

  const cases = [];
  function check(label, host, expected) {
    const actual = cursorAfterMove(host[0], host[1]);
    cases.push({ label, host, expected, actual });
    assert.deepEqual(actual.cursor, expected, label + ': GetCursorPos');
    if (actual.lParam) assert.deepEqual(actual.lParam, expected, label + ': WM_MOUSEMOVE lParam');
  }

  // 640x400 mode: the screen is 640x400 and the picture is 40 px down.
  assert.equal(wat.lb_mode(640, 400), 0, 'SetDisplayMode(640,400,8)');
  assert.equal(wat.lb_metric(0), 640, 'SM_CXSCREEN is the mode');
  assert.equal(wat.lb_metric(1), 400, 'SM_CYSCREEN is the mode');
  const win = renderer.windows[hwnd];
  assert.deepEqual([win.x, win.y, win.w, win.h], [0, 0, 640, 400],
    'SetDisplayMode resizes the cooperative window to the mode');
  // "Start New Game" is drawn at canvas (321,223); the game hit-tests (321,183).
  check('visible button centre', [321, 223], [321, 183]);
  check('picture top-left', [0, 40], [0, 0]);
  check('picture bottom-right', [639, 439], [639, 399]);
  check('top letterbox bar clamps to the first row', [200, 10], [200, 0]);
  check('bottom letterbox bar clamps to the last row', [200, 470], [200, 399]);
  // Mouse buttons carry the same mapped point.
  renderer.inputQueue.length = 0;
  renderer.handleMouseDown(321, 223, 1);
  renderer.handleMouseUp(321, 223, 1);
  const down = renderer.inputQueue.find(e => e.msg === 0x0201);
  assert(down, 'WM_LBUTTONDOWN queued');
  assert.deepEqual([down.lParam & 0xffff, down.lParam >>> 16], [321, 183],
    'WM_LBUTTONDOWN lParam is in mode coordinates');

  // A full-canvas 640x480 mode is the identity: nothing is letterboxed.
  assert.equal(wat.lb_mode(640, 480), 0, 'SetDisplayMode(640,480,8)');
  assert.equal(wat.lb_metric(1), 480);
  check('640x480 identity', [321, 223], [321, 223]);

  // 320x200 is scaled 2x into 640x400 and letterboxed 40 px down as well.
  assert.equal(wat.lb_mode(320, 200), 0, 'SetDisplayMode(320,200,8)');
  assert.equal(wat.lb_metric(0), 320);
  assert.equal(wat.lb_metric(1), 200);
  check('320x200 scaled + letterboxed', [321, 223], [160, 91]);

  console.log(JSON.stringify(cases));
  console.log('PASS  letterboxed DirectDraw modes report pointer input in mode coordinates (640x400, 640x480, 320x200)');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
