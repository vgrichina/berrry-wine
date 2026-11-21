#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const STACK = 0x00300000;
const WS_CHILD = 0x40000000;
const CHILD = 0x10020;
const PARENT_A = 0x10021;
const PARENT_B = 0x10022;

const extraWat = String.raw`
  (func (export "test_add_window")
      (param $hwnd i32) (param $parent i32) (param $style i32)
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_DIALOG))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style))))

  (func (export "test_set_parent")
      (param $child i32) (param $parent i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_SetParent
      (local.get $child) (local.get $parent) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
`;

function addRendererWindow(renderer, hwnd, parentHwnd) {
  renderer.windows[hwnd] = {
    hwnd,
    parentHwnd,
    isChild: !!parentHwnd,
    style: WS_CHILD,
    visible: false,
    x: 0, y: 0, w: 100, h: 100,
    clientRect: { x: 0, y: 0, w: 100, h: 100 },
  };
}

function low32(value) {
  return Number(value & 0xffffffffn) >>> 0;
}

(async () => {
  const { exports: e, renderer } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.test_add_window(CHILD, PARENT_A, WS_CHILD);
  e.test_add_window(PARENT_A, 0, WS_CHILD);
  e.test_add_window(PARENT_B, 0, WS_CHILD);
  addRendererWindow(renderer, CHILD, PARENT_A);
  addRendererWindow(renderer, PARENT_A, 0);
  addRendererWindow(renderer, PARENT_B, 0);

  e.test_set_last_error(0x1234);
  let result = e.test_set_parent(CHILD, PARENT_B);
  assert.strictEqual(low32(result), PARENT_A, 'success returns the previous parent');
  assert.strictEqual(Number(result >> 32n) >>> 0, STACK + 12,
    'SetParent pops two stdcall arguments and its return address');
  assert.strictEqual(e.wnd_get_parent(CHILD) >>> 0, PARENT_B,
    'USER state records the new parent');
  assert.strictEqual(renderer.windows[CHILD].parentHwnd >>> 0, PARENT_B,
    'renderer state records the same new parent');
  assert.strictEqual(e.test_get_last_error() >>> 0, 0x1234,
    'success does not invent a last-error value');
  assert.strictEqual(e.wnd_get_style_export(CHILD) >>> 0, WS_CHILD,
    'SetParent preserves WS_CHILD/WS_POPUP compatibility styles');

  e.test_set_last_error(0);
  result = e.test_set_parent(0x7ffffffe, PARENT_A);
  assert.strictEqual(low32(result), 0, 'an invalid child HWND fails');
  assert.strictEqual(e.test_get_last_error() >>> 0, 1400,
    'an invalid child reports ERROR_INVALID_WINDOW_HANDLE');
  assert.strictEqual(renderer.windows[CHILD].parentHwnd >>> 0, PARENT_B,
    'a rejected child cannot alter renderer state');

  e.test_set_last_error(0);
  result = e.test_set_parent(CHILD, 0x7ffffffd);
  assert.strictEqual(low32(result), 0, 'an invalid new-parent HWND fails');
  assert.strictEqual(e.test_get_last_error() >>> 0, 1400,
    'an invalid parent reports ERROR_INVALID_WINDOW_HANDLE');
  assert.strictEqual(e.wnd_get_parent(CHILD) >>> 0, PARENT_B,
    'a rejected parent cannot alter USER state');
  assert.strictEqual(renderer.windows[CHILD].parentHwnd >>> 0, PARENT_B,
    'a rejected parent cannot alter renderer state');

  e.test_set_last_error(0);
  result = e.test_set_parent(PARENT_B, CHILD);
  assert.strictEqual(low32(result), 0, 'an ancestry cycle fails');
  assert.strictEqual(e.test_get_last_error() >>> 0, 87,
    'an ancestry cycle reports ERROR_INVALID_PARAMETER');
  assert.strictEqual(e.wnd_get_parent(PARENT_B) >>> 0, 0,
    'a rejected cycle leaves the parent chain intact');

  result = e.test_set_parent(CHILD, 0x10000);
  assert.strictEqual(low32(result), PARENT_B,
    'the fixed desktop handle still returns the previous parent');
  assert.strictEqual(e.wnd_get_parent(CHILD) >>> 0, 0,
    'the fixed desktop handle selects the internal root');
  assert.strictEqual(renderer.windows[CHILD].parentHwnd >>> 0, 0,
    'desktop normalization is shared with renderer state');

  result = e.test_set_parent(CHILD, PARENT_A);
  assert.strictEqual(low32(result), 0,
    'a root child has a NULL previous parent on successful reparenting');
  result = e.test_set_parent(CHILD, 0);
  assert.strictEqual(low32(result), PARENT_A, 'NULL selects the desktop/root');
  assert.strictEqual(e.wnd_get_parent(CHILD) >>> 0, 0);
  assert.strictEqual(renderer.windows[CHILD].parentHwnd >>> 0, 0);

  console.log('PASS  SetParent validates handles/cycles and keeps USER/renderer state aligned');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
