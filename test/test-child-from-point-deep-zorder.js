#!/usr/bin/env node
'use strict';

// $wnd_child_from_point_deep -- the hit test the renderer routes every mouse
// click through -- must hand the point to the TOPMOST overlapping sibling,
// the way USER's WindowFromPoint does.
//
// It used to take the first child in slot order, which is creation order.
// Civilization II opens its city screen as a child covering the whole main
// window, on top of the map screen's World/Status panels, which were created
// first. Every click on the city screen's Rename/Buy/Change/Exit buttons went
// to the Status panel underneath, and the game answered "You must close the
// City Window before the game can proceed."

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const WS_CHILD = 0x40000000;
const WS_VISIBLE = 0x10000000;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat: `
    (func (export "test_dialog") (param $h i32)
      (call $wnd_table_set (local.get $h) (global.get $WNDPROC_DIALOG)))
    (func (export "test_class") (param $h i32) (param $c i32)
      (call $ctrl_table_set (call $wnd_table_find (local.get $h)) (local.get $c) (i32.const 0)))
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
  ` });

  const V = WS_CHILD | WS_VISIBLE;
  const main = 0x10001, status = 0x10002, statusKid = 0x10003;
  const city = 0x10004, rename = 0x10005;
  e.test_make_window(main, 0, WS_VISIBLE, 0, 0, 640, 480);
  // The map screen's Status panel and something inside it, created first.
  e.test_make_window(status, main, V, 454, 135, 178, 299);
  e.test_make_window(statusKid, status, V, 0, 0, 178, 299);
  // The city window, created later over the whole client, and its button.
  e.test_make_window(city, main, V, 0, 0, 640, 454);
  e.test_make_window(rename, city, V, 583, 413, 57, 24);

  assert(e.wnd_z_get(city) > e.wnd_z_get(status),
    'precondition: the later sibling is above the earlier one');
  assert.strictEqual(e.wnd_child_from_point_deep(main, 600, 420) >>> 0, rename,
    'a click on the city window\'s button reaches the button, not the panel below');
  assert.strictEqual(e.wnd_child_from_point_deep(main, 500, 200) >>> 0, city,
    'a click on bare city window stays on the city window');
  assert.strictEqual(e.wnd_child_from_point_deep(main, 10, 470) >>> 0, 0,
    'a point under no child is no hit');

  const dlg=0x10010, combo=0x10011, group=0x10012;
  e.test_make_window(dlg,0,WS_VISIBLE,0,0,400,300);
  e.test_dialog(dlg);
  e.test_make_window(combo,dlg,V|3,20,30,200,100);
  e.test_class(combo,5);
  e.test_make_window(group,dlg,V|7,10,10,250,150);
  e.test_class(group,1);
  assert.strictEqual(e.wnd_child_from_point_deep(dlg,210,35)>>>0,combo,
    'dialog selector reaches combo through overlapping group box');
  assert.strictEqual(e.wnd_child_from_point_deep(dlg,210,90)>>>0,0,
    'closed combo does not claim its hidden dropdown or surrounding group');

  console.log('PASS  deep child hit test takes the topmost overlapping sibling');

  // A group box is transparent itself, but not its children. VB6's Frame is a
  // BS_GROUPBOX superclass that parents the controls drawn in it: SimCity
  // 2001's tool buttons are children of three such frames, and skipping the
  // frame sent every click on them to the form.
  const form = 0x10020, frame = 0x10021, tool = 0x10022, stray = 0x10023;
  e.test_make_window(form, 0, WS_VISIBLE, 0, 0, 551, 476);
  e.test_make_window(frame, form, V | 7, 8, 337, 73, 89);
  e.test_class(frame, 1);
  e.test_make_window(tool, frame, V, 48, 40, 17, 17);
  e.test_make_window(stray, frame, V, 100, 10, 17, 17); // outside the frame: clipped away
  assert.strictEqual(e.wnd_child_from_point_deep(form, 8 + 48 + 5, 337 + 40 + 5) >>> 0, tool,
    'a click on a control inside a group-box frame reaches the control');
  assert.strictEqual(e.wnd_child_from_point_deep(form, 8 + 4, 337 + 80) >>> 0, 0,
    'a click on the bare frame is still transparent');
  assert.strictEqual(e.wnd_child_from_point_deep(form, 8 + 100 + 5, 337 + 10 + 5) >>> 0, 0,
    'a frame child outside the frame rect takes no click');
  console.log('PASS  group-box frames pass clicks to their own children');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
