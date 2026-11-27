#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const publicCalls = {
  window: ['CreateWindowExA', 12], move: ['MoveWindow', 6], destroy: ['DestroyWindow', 1],
  dd: ['DirectDrawCreate', 3], surface: ['IDirectDraw_CreateSurface', 4],
  clipper: ['IDirectDraw_CreateClipper', 4], coop: ['IDirectDraw_SetCooperativeLevel', 3],
  bind: ['IDirectDrawClipper_SetHWnd', 3], attach: ['IDirectDrawSurface_SetClipper', 2],
  list: ['IDirectDrawClipper_GetClipList', 4], blt: ['IDirectDrawSurface_Blt', 6],
  lock: ['IDirectDrawSurface_Lock', 5], unlock: ['IDirectDrawSurface_Unlock', 2],
};
const extraWat = Object.entries(publicCalls).map(([name, [handler, count]]) => `
  (func (export "motion_${name}") ${Array.from({ length: count }, (_, i) => `(param $a${i} i32)`).join(' ')} (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
    ${Array.from({ length: Math.max(0, count - 5) }, (_, i) => `(call $gs32 (i32.const ${0x300018 + i * 4}) (local.get $a${i + 5}))`).join('\n')}
    (call $handle_${handler} ${Array.from({ length: 6 }, (_, i) => i < Math.min(5, count) ? `(local.get $a${i})` : '(i32.const 0)').join(' ')})
    (i32.load (global.get $reg_base)))`).join('\n') + String.raw`
  (func (export "test_create_clipper") (result i32)
    (call $init_dx_com_thunks)
    (call $dx_create_com_obj (i32.const 10) (global.get $DX_VTBL_DDCLIP)))
  (func (export "test_create_non_clipper") (result i32)
    (call $dx_create_com_obj (i32.const 3) (global.get $DX_VTBL_DDCLIP)))
  (func (export "test_alloc") (param $bytes i32) (result i32)
    (call $heap_alloc (local.get $bytes)))
  (func (export "test_peek32") (param $ptr i32) (result i32)
    (call $gl32 (local.get $ptr)))
  (func (export "test_poke32") (param $ptr i32) (param $value i32)
    (call $gs32 (local.get $ptr) (local.get $value)))
  (func (export "test_get_hwnd") (param $clipper i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_IDirectDrawClipper_GetHWnd
      (local.get $clipper) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_set_hwnd")
      (param $clipper i32) (param $flags i32) (param $hwnd i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_IDirectDrawClipper_SetHWnd
      (local.get $clipper) (local.get $flags) (local.get $hwnd)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const DD_OK = 0;
  const DDERR_INVALIDPARAMS = 0x80070057 | 0;
  const DDERR_INVALIDOBJECT = 0x88760082 | 0;
  const DESKTOP_HWND = 0x10000;
  const h = await bootRenderHarness({ extraWat, fonts: 'none', width: 16, height: 12 });
  const e = h.exports;
  const clipper = e.test_create_clipper() >>> 0;
  const out = e.test_alloc(4) >>> 0;
  assert.notStrictEqual(clipper, 0, 'a DirectDraw clipper object was allocated');

  e.test_poke32(out, 0x7f7f7f7f);
  assert.strictEqual(e.test_get_hwnd(clipper, out), DD_OK,
    'a fresh clipper has a readable window association');
  assert.strictEqual(e.test_peek32(out), 0,
    'a fresh clipper is not silently associated with the process main window');
  assert.strictEqual(e.get_esp() >>> 0, 0x0030000c,
    'GetHWnd pops this and its output argument');

  assert.strictEqual(e.test_set_hwnd(clipper, 0, DESKTOP_HWND), DD_OK,
    'SetHWnd accepts a real window and the required zero flags');
  assert.strictEqual(e.get_esp() >>> 0, 0x00300010,
    'SetHWnd pops this and its two arguments');
  e.test_poke32(out, 0x7f7f7f7f);
  assert.strictEqual(e.test_get_hwnd(clipper, out), DD_OK);
  assert.strictEqual(e.test_peek32(out), DESKTOP_HWND,
    'GetHWnd returns the exact window retained by SetHWnd');

  assert.strictEqual(e.test_set_hwnd(clipper, 1, DESKTOP_HWND), DDERR_INVALIDPARAMS,
    'reserved nonzero SetHWnd flags are rejected');
  assert.strictEqual(e.test_set_hwnd(clipper, 0, 0x7777), DDERR_INVALIDPARAMS,
    'a fabricated window cannot become a clip source');
  assert.strictEqual(e.test_get_hwnd(clipper, out), DD_OK);
  assert.strictEqual(e.test_peek32(out), DESKTOP_HWND,
    'failed SetHWnd calls preserve the prior association');

  assert.strictEqual(e.test_get_hwnd(clipper, 0), DDERR_INVALIDPARAMS,
    'GetHWnd rejects a null output pointer instead of claiming success');

  const nonClipper = e.test_create_non_clipper() >>> 0;
  e.test_poke32(out, 0x55aa55aa);
  assert.strictEqual(
    e.test_set_hwnd(nonClipper, 0, DESKTOP_HWND), DDERR_INVALIDOBJECT,
    'SetHWnd rejects a different DirectDraw object type');
  assert.strictEqual(e.test_get_hwnd(nonClipper, out), DDERR_INVALIDOBJECT,
    'GetHWnd also validates the receiver object');
  assert.strictEqual(e.test_peek32(out) >>> 0, 0x55aa55aa,
    'an invalid receiver does not publish a fabricated HWND');

  // All motion, association, list and pixel operations below go through public
  // handlers. No clipper snapshots or window records are edited by the test.
  const checks = [];
  const check = (name, actual, expected) => {
    try { assert.deepStrictEqual(actual, expected); checks.push({ name, pass: true }); }
    catch { checks.push({ name, pass: false, actual, expected }); }
  };
  const ok = result => assert.strictEqual(result, 0, 'public DirectDraw call succeeds');
  const str = e.test_alloc(16);
  'STATIC\0'.split('').forEach((c, i) => e.guest_write8(str + i, c.charCodeAt(0)));
  const hwnd = e.motion_window(0, str, str, 0x90000000, 2, 3, 4, 3, 0, 0, 0, 0) >>> 0;
  assert(hwnd, 'CreateWindowExA creates a real visible borderless window');
  // The host initially places its first top-level window at the canvas origin.
  assert.strictEqual(e.motion_move(hwnd, 2, 3, 4, 3, 0), 1);
  const ddOut = e.test_alloc(4);
  ok(e.motion_dd(0, ddOut, 0));
  const dd = e.test_peek32(ddOut);
  ok(e.motion_coop(dd, hwnd, 8)); // DDSCL_NORMAL
  e.test_dx_set_process_state(16, 12, 32, 1, hwnd, 0, 0);
  ok(e.motion_clipper(dd, 0, ddOut, 0));
  const movingClipper = e.test_peek32(ddOut);
  ok(e.motion_bind(movingClipper, 0, hwnd));
  const desc = e.test_alloc(128), locked = e.test_alloc(128), size = e.test_alloc(4);
  const region = e.test_alloc(48), fx = e.test_alloc(100);
  const surface = caps => {
    for (let i = 0; i < 128; i += 4) e.test_poke32(desc + i, 0);
    for (const [offset, value] of [[0, 108], [4, 0x1007], [8, 12], [12, 16],
      [72, 32], [76, 0x40], [84, 32], [88, 0xff0000], [92, 0xff00], [96, 0xff], [104, caps]])
      e.test_poke32(desc + offset, value);
    ok(e.motion_surface(dd, desc, ddOut, 0));
    return e.test_peek32(ddOut);
  };
  const dst = surface(0x40), src = surface(0x40), primary = surface(0x200);
  assert.strictEqual(e.motion_move(hwnd, 2, 3, 4, 3, 0), 1);
  ok(e.motion_attach(dst, movingClipper));
  ok(e.motion_attach(primary, movingClipper));
  const pixels = (s, fill) => {
    e.test_poke32(locked, 108);
    ok(e.motion_lock(s, 0, locked, 0, 0));
    const ptr = e.test_peek32(locked + 36), pitch = e.test_peek32(locked + 16);
    const result = [];
    for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) {
      if (fill !== undefined) e.test_poke32(ptr + y * pitch + x * 4, fill);
      result.push(e.test_peek32(ptr + y * pitch + x * 4) >>> 0);
    }
    ok(e.motion_unlock(s, 0));
    return result;
  };
  const expected = rect => Array.from({ length: 192 }, (_, i) => {
    const x = i % 16, y = Math.floor(i / 16);
    return rect && x >= rect[0] && y >= rect[1] && x < rect[2] && y < rect[3]
      ? 0x00332211 : 0x00665544;
  });
  pixels(src, 0x00332211);
  e.test_poke32(fx + 80, 0x00332211);
  const verify = (name, rect) => {
    // Blt must refresh independently of GetClipList. Both copy and COLORFILL
    // must preserve every pixel outside the literal screen-coordinate RECT.
    for (const [target, label] of [[dst, 'offscreen'], [primary, 'primary']]) {
      for (const fill of [false, true]) {
        pixels(target, 0x00665544);
        h.renderer.repaint();
        const before = Array.from(h.canvas.getContext('2d').getImageData(0, 0, 16, 12).data);
        const bltResult = e.motion_blt(target, 0, fill ? 0 : src, 0, fill ? 0x400 : 0, fill ? fx : 0);
        if (rect) ok(bltResult);
        if (target === primary) {
          h.renderer.repaint();
          const after = Array.from(h.canvas.getContext('2d').getImageData(0, 0, 16, 12).data);
          const want = before.slice();
          if (rect) for (let y = rect[1]; y < rect[3]; y++) for (let x = rect[0]; x < rect[2]; x++)
            want.splice((y * 16 + x) * 4, 4, 51, 34, 17, 255);
          check(`${name} primary ${fill ? 'fill' : 'copy'} presentation and outside pixels`, after, want);
        }
        check(`${name} ${label} ${fill ? 'fill' : 'copy'} all pixels`, pixels(target), expected(rect));
      }
    }
    e.test_poke32(size, 48);
    const listResult = e.motion_list(movingClipper, 0, region, size);
    if (!rect && listResult !== 0) return; // A dead-HWND error is also safe.
    ok(listResult);
    const words = Array.from({ length: rect ? 12 : 8 }, (_, i) => e.test_peek32(region + i * 4));
    check(`${name} literal GetClipList`, words,
      rect ? [32, 1, 1, 16, ...rect, ...rect] : [32, 1, 0, 0, 0, 0, 0, 0]);
    check(`${name} list byte count`, e.test_peek32(size), rect ? 48 : 32);
  };
  verify('initial', [2, 3, 6, 6]);
  assert.strictEqual(e.motion_move(hwnd, 7, 1, 4, 3, 0), 1);
  verify('moved', [7, 1, 11, 4]);
  assert.strictEqual(e.motion_move(hwnd, 7, 1, 2, 5, 0), 1);
  verify('resized', [7, 1, 9, 6]);
  assert.strictEqual(e.motion_destroy(hwnd), 1);
  // Do not prescribe a Windows HRESULT/lifetime policy for a dead HWND. The
  // retired window has no live client area and must never permit new writes.
  verify('destroyed', null);
  console.log(JSON.stringify({ checks, passed: checks.filter(c => c.pass).length, total: checks.length }, null, 2));
  assert(checks.every(c => c.pass), 'real HWND clipper motion preserves outside pixels');
  console.log('PASS DirectDraw clipper HWND validation and real window motion');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
