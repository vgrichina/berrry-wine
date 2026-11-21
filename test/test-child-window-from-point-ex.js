#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const CWP_SKIPINVISIBLE = 0x01;
const CWP_SKIPDISABLED = 0x02;
const CWP_SKIPTRANSPARENT = 0x04;
const WS_CHILD = 0x40000000;
const WS_VISIBLE = 0x10000000;
const WS_DISABLED = 1 << 27;
const WS_EX_TRANSPARENT = 0x20;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat: `
    (func (export "test_set_last_error") (param $value i32)
      (global.set $last_error (local.get $value)))
    (func (export "test_make_window")
        (param $hwnd i32) (param $parent i32) (param $style i32)
        (param $x i32) (param $y i32) (param $w i32) (param $h i32)
      (local $slot i32)
      (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_CTRL_NATIVE))
      (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
      (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
      (local.set $slot (call $wnd_table_find (local.get $hwnd)))
      (call $ctrl_geom_set (local.get $slot)
        (local.get $x) (local.get $y) (local.get $w) (local.get $h))
      (call $client_rect_set (local.get $hwnd)
        (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)))
    (func (export "test_set_exstyle") (param $hwnd i32) (param $style i32)
      (call $ctrl_set_ex_style (local.get $hwnd) (local.get $style)))
    (func (export "test_child_from_point")
        (param $parent i32) (param $x i32) (param $y i32) (result i32)
      (call $handle_ChildWindowFromPoint
        (local.get $parent) (local.get $x) (local.get $y)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "test_child_from_point_ex")
        (param $parent i32) (param $x i32) (param $y i32) (param $flags i32)
        (result i32)
      (call $handle_ChildWindowFromPointEx
        (local.get $parent) (local.get $x) (local.get $y) (local.get $flags)
        (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
  ` });

  const parent = 0x10001;
  const normal = 0x10002;
  const hidden = 0x10003;
  const disabled = 0x10004;
  const transparent = 0x10005;
  const grandchild = 0x10006;
  e.test_make_window(parent, 0, WS_VISIBLE, 0, 0, 200, 160);
  e.test_make_window(normal, parent, WS_CHILD | WS_VISIBLE, 20, 20, 80, 60);
  e.test_make_window(hidden, parent, WS_CHILD, 20, 20, 80, 60);
  e.test_make_window(disabled, parent,
    WS_CHILD | WS_VISIBLE | WS_DISABLED, 20, 20, 80, 60);
  e.test_make_window(transparent, parent, WS_CHILD | WS_VISIBLE, 20, 20, 80, 60);
  e.test_set_exstyle(transparent, WS_EX_TRANSPARENT);
  e.test_make_window(grandchild, transparent, WS_CHILD | WS_VISIBLE, 0, 0, 80, 60);

  e.set_esp(0x700300);
  e.test_set_last_error(0x4567);
  assert.strictEqual(e.test_child_from_point_ex(parent, 30, 30, 0), transparent,
    'CWP_ALL returns the topmost immediate child, not its grandchild');
  assert.strictEqual(e.get_esp(), 0x700314,
    'ChildWindowFromPointEx pops hwnd, POINT.x/y, and flags');
  assert.strictEqual(e.test_get_last_error(), 0x4567, 'query preserves last error');
  assert.strictEqual(
    e.test_child_from_point_ex(parent, 30, 30, CWP_SKIPTRANSPARENT), disabled,
    'CWP_SKIPTRANSPARENT reveals the next child in Z order');
  assert.strictEqual(
    e.test_child_from_point_ex(parent, 30, 30,
      CWP_SKIPTRANSPARENT | CWP_SKIPDISABLED), hidden,
    'CWP_SKIPDISABLED leaves an invisible child eligible');
  assert.strictEqual(
    e.test_child_from_point_ex(parent, 30, 30,
      CWP_SKIPTRANSPARENT | CWP_SKIPDISABLED | CWP_SKIPINVISIBLE), normal,
    'all skip flags reveal the eligible visible child');

  assert.strictEqual(e.test_child_from_point(parent, 30, 30), transparent,
    'ChildWindowFromPoint uses the same immediate-child CWP_ALL behavior');
  assert.strictEqual(e.get_esp(), 0x700360,
    'ChildWindowFromPoint pops hwnd and the two-dword POINT');
  assert.strictEqual(e.test_child_from_point_ex(parent, 150, 120, 0), parent,
    'an inside point with no matching child returns the parent');
  assert.strictEqual(e.test_child_from_point_ex(parent, 250, 30, 0), 0,
    'a point outside the parent client area returns NULL');
  assert.strictEqual(e.test_child_from_point_ex(0x77777, 1, 1, 0), 0,
    'an invalid parent handle returns NULL');

  console.log('ChildWindowFromPointEx tests passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
