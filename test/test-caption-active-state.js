#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');
const FRAME_SOURCE = fs.readFileSync(
  path.join(ROOT, 'src', '09c4-defwndproc.wat'), 'utf8');

const TOP_A = 0x10001;
const TOP_B = 0x10002;
const CHILD = 0x10003;
const WS_VISIBLE = 0x10000000;
const WS_CHILD = 0x40000000;
const WS_CAPTION = 0x00c00000;
const WS_THICKFRAME = 0x00040000;
const TOP_STYLE = WS_VISIBLE | WS_CAPTION | WS_THICKFRAME;
const CHILD_STYLE = TOP_STYLE | WS_CHILD;
const STACK = 0x074ff000;

const extraWat = String.raw`
  (func (export "test_install_caption_window")
      (param $hwnd i32) (param $style i32) (param $parent i32)
      (param $x i32) (param $y i32) (param $w i32) (param $h i32)
    (local $slot i32)
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then (call $ctrl_geom_set (local.get $slot)
        (local.get $x) (local.get $y) (local.get $w) (local.get $h)))))

  (func (export "test_paint_caption") (param $hwnd i32)
    (call $defwndproc_do_ncpaint (local.get $hwnd)))

  (func (export "test_set_flash_state") (param $hwnd i32) (param $state i32)
    (local $slot i32)
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (i32.store8
          (i32.add (global.get $FLASH_TABLE) (local.get $slot))
          (local.get $state)))))

  (func (export "test_caption_pixel")
      (param $hwnd i32) (param $x i32) (param $y i32) (result i32)
    (local $hdc i32) (local $color i32)
    (local.set $hdc (call $host_alloc_window_dc (local.get $hwnd) (i32.const 1)))
    (if (i32.eqz (local.get $hdc)) (then (return (i32.const -1))))
    (local.set $color
      (call $gdi_hdc_get_pixel (local.get $hdc) (local.get $x) (local.get $y)))
    (drop (call $host_release_dc (local.get $hdc)))
    (local.get $color))

  (func (export "test_defwindowproc_a")
      (param $hwnd i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_DefWindowProcA
      (local.get $hwnd) (i32.const 0x0085) (i32.const 1) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_defwindowproc_w")
      (param $hwnd i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_DefWindowProcW
      (local.get $hwnd) (i32.const 0x0085) (i32.const 1) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
`;

function rgbAtCaption(e, hwnd, x) {
  return e.test_caption_pixel(hwnd, x, 4) >>> 0;
}

function unpack(value) {
  return {
    eax: Number(value & 0xffffffffn) >>> 0,
    esp: Number(value >> 32n) >>> 0,
  };
}

(async () => {
  // Pin the exact Win98 palette endpoints passed to the horizontal gradient;
  // the live checks below prove which branch each window actually selects.
  assert.match(FRAME_SOURCE,
    /\(i32\.const 0x800000\)[\s\S]*?\(i32\.const 0xD08410\)/,
    'active caption uses COLOR_ACTIVECAPTION gradient endpoints');
  assert.match(FRAME_SOURCE,
    /\(i32\.const 0x808080\)[\s\S]*?\(i32\.const 0xC0C0C0\)/,
    'inactive caption uses COLOR_INACTIVECAPTION gradient endpoints');

  let foreground = TOP_A;
  let gpuReadbacks = 0;
  const h = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    width: 360,
    height: 180,
    extraHostOverrides: {
      foreground_window: () => foreground >>> 0,
      invalidate_frame() {},
      gpu_gl_call(opcode, hwnd) {
        assert.strictEqual(opcode, 0x10002, 'only a window readback is expected');
        gpuReadbacks++;
        h.exports.gl_window_set_gpu_owned(hwnd, 0);
        return 1;
      },
    },
  });
  const e = h.exports;

  const install = (hwnd, style, parent, x, y) => {
    h.renderer.createWindow(hwnd, style, x, y, 120, 80, '', 0,
      h.instance, h.memory);
    e.test_install_caption_window(hwnd, style, parent, x, y, 120, 80);
  };
  install(TOP_A, TOP_STYLE, 0, 8, 8);
  install(TOP_B, TOP_STYLE, 0, 150, 8);
  install(CHILD, CHILD_STYLE, TOP_A, 12, 30);

  e.test_paint_caption(TOP_A);
  e.test_paint_caption(TOP_B);
  assert.strictEqual(rgbAtCaption(e, TOP_A, 4), 0x800000,
    'foreground top-level paints the exact active-caption start color');
  assert.strictEqual(rgbAtCaption(e, TOP_A, 115), 0xd08410,
    'foreground top-level paints the exact active-caption end color');
  assert.strictEqual(rgbAtCaption(e, TOP_B, 4), 0x808080,
    'background top-level paints the exact inactive-caption start color');
  assert.strictEqual(rgbAtCaption(e, TOP_B, 115), 0xc0c0c0,
    'background top-level paints the exact inactive-caption end color');

  foreground = TOP_B;
  e.test_paint_caption(TOP_A);
  e.test_paint_caption(TOP_B);
  assert.strictEqual(rgbAtCaption(e, TOP_A, 4), 0x808080,
    'foreground swap deactivates the former top-level');
  assert.strictEqual(rgbAtCaption(e, TOP_B, 4), 0x800000,
    'foreground swap activates the new top-level');

  foreground = 0;
  e.test_paint_caption(TOP_A);
  e.test_paint_caption(TOP_B);
  assert.strictEqual(rgbAtCaption(e, TOP_A, 4), 0x808080,
    'NULL foreground leaves the first top-level inactive');
  assert.strictEqual(rgbAtCaption(e, TOP_B, 4), 0x808080,
    'NULL foreground leaves the second top-level inactive');

  e.test_set_flash_state(TOP_A, 1);
  e.test_paint_caption(TOP_A);
  assert.strictEqual(rgbAtCaption(e, TOP_A, 4), 0x800000,
    'FlashWindow inverts the derived inactive state');
  e.test_set_flash_state(TOP_A, 0);
  e.test_paint_caption(TOP_A);
  assert.strictEqual(rgbAtCaption(e, TOP_A, 4), 0x808080,
    'clearing FlashWindow restores the derived inactive state');

  e.test_paint_caption(CHILD);
  assert.strictEqual(rgbAtCaption(e, CHILD, 4), 0x800000,
    'child/MDI captions preserve their existing active rendering');

  foreground = TOP_A;
  let result = unpack(e.test_defwindowproc_a(TOP_A, STACK));
  assert.deepStrictEqual(result, { eax: 0, esp: STACK + 20 },
    'DefWindowProcA WM_NCPAINT uses the shared painter and preserves stdcall');
  assert.strictEqual(rgbAtCaption(e, TOP_A, 4), 0x800000,
    'ANSI default procedure selects the foreground active caption');
  foreground = TOP_B;
  result = unpack(e.test_defwindowproc_w(TOP_A, STACK));
  assert.deepStrictEqual(result, { eax: 0, esp: STACK + 20 },
    'DefWindowProcW WM_NCPAINT uses the shared painter and preserves stdcall');
  assert.strictEqual(rgbAtCaption(e, TOP_A, 4), 0x808080,
    'Unicode default procedure selects the same background inactive caption');

  const popup = 0x10004;
  install(popup, 0x90000000, 0, 0, 0);
  e.test_gdi_client_rect_set(popup, 0, 0, 120, 80);
  // Establish canonical storage, then leave the most recent frame GPU-owned.
  e.test_caption_pixel(popup, 0, 0);
  assert.strictEqual(e.gl_window_set_gpu_owned(popup, 1), 1);
  e.test_paint_caption(popup);
  e.defwndproc_ncpaint(popup, 120, 80, 0, 0, 0, 0);
  assert.strictEqual(gpuReadbacks, 0,
    'fully clipped NC paint leaves the GPU frame untouched through both entry points');
  e.test_gdi_client_rect_set(popup, 1, 0, 120, 80);
  e.test_paint_caption(popup);
  assert.strictEqual(gpuReadbacks, 1,
    'even a one-pixel nonclient band still resolves pixels before painting');

  console.log('PASS  caption state and empty-NC GPU readback avoidance');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
