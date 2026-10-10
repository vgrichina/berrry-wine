#!/usr/bin/env node
'use strict';
// A CreateMenu bar attached with SetMenu is drawn from a snapshot blob, but
// USER reads the live HMENU: CheckMenuItem / EnableMenuItem on one of the
// bar's popups must show the next time that popup opens, with no DrawMenuBar.
// VB1 builds every menu this way, and JigSawed's Options > Fast Move check
// returned success while the drawn menu stayed unchecked.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = `
  (func (export "t_create") (result i32)
    (call $handle_CreateMenu (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "t_popup") (result i32)
    (call $handle_CreatePopupMenu (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "t_append") (param $h i32) (param $flags i32) (param $id i32) (param $text i32) (result i32)
    (call $handle_AppendMenuA (local.get $h) (local.get $flags) (local.get $id) (local.get $text)
      (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "t_attach") (param $hwnd i32) (param $h i32) (result i32)
    (call $menu_set_bar_from_dynamic (local.get $hwnd) (local.get $h)))
  (func (export "t_check") (param $h i32) (param $id i32) (param $flags i32) (result i32)
    (call $handle_CheckMenuItem (local.get $h) (local.get $id) (local.get $flags)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "t_enable") (param $h i32) (param $id i32) (param $flags i32) (result i32)
    (call $handle_EnableMenuItem (local.get $h) (local.get $id) (local.get $flags)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const str = (s) => {
    const g = e.guest_alloc(s.length + 1) >>> 0;
    for (let i = 0; i < s.length; i++) e.guest_write8(g + i, s.charCodeAt(i));
    e.guest_write8(g + s.length, 0);
    return g;
  };
  const hwnd = 0x10001;
  e.test_wnd_table_set(hwnd, 0xffff0002);

  const bar = e.t_create() >>> 0;
  const options = e.t_popup() >>> 0;
  assert(bar && options, 'menus created');
  assert.strictEqual(e.t_append(options, 0, 100, str('&Fast Move')), 1);
  assert.strictEqual(e.t_append(options, 0, 101, str('&Sound')), 1);
  assert.strictEqual(e.t_append(bar, 0x10, options, str('&Options')), 1);
  assert.strictEqual(e.t_attach(hwnd, bar), 1, 'bar attached as the window menu');

  const flags = (pos) => e.menu_child_flags(hwnd, 0, pos);
  assert.strictEqual(flags(0) & 4, 0, 'Fast Move starts unchecked');

  assert.strictEqual(e.t_check(options, 100, 8), 0, 'CheckMenuItem reports the old state');
  assert.strictEqual(flags(0) & 4, 4, 'the drawn Options popup shows Fast Move checked');
  assert.strictEqual(flags(1) & 4, 0, 'only the named item is checked');

  e.t_enable(options, 101, 1);
  assert.strictEqual(flags(1) & 2, 2, 'the drawn Options popup shows Sound greyed');

  assert.strictEqual(e.t_check(options, 100, 0), 8, 'unchecking reports it was checked');
  assert.strictEqual(flags(0) & 4, 0, 'the drawn Options popup shows Fast Move unchecked again');

  console.log('PASS  CheckMenuItem/EnableMenuItem on a popup of an attached CreateMenu bar reach the drawn menu');
})().catch(err => { console.error(err); process.exit(1); });
