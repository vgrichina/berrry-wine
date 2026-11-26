#!/usr/bin/env node
'use strict';
// A Unicode guest proc that chains a message to one of our native control
// procs with CallWindowProcW hands it UTF-16: CREATESTRUCTW at WM_CREATE,
// UTF-16 strings for WM_SETTEXT / CB_ADDSTRING, a UTF-16 buffer for
// WM_GETTEXT. The native procs are ANSI, so CallWindowProcW converts around
// the call. Delphi's VCL does this for every control (it creates TButton,
// TNewStaticText... as superclasses of the stock classes), and without the
// conversion Inno Setup 5.3.11u's "Select Setup Language" dialog painted
// "S", "O", "C". DefWindowProcW's caption messages go through the same
// conversion, and SendMessageW no longer hands a subclassing Unicode proc a
// narrowed copy that is freed before that proc runs.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "t_create_w") (param $class i32) (param $title i32) (param $style i32) (result i32)
    (local $saved i32) (local $hwnd i32) (local $sp i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (local.set $sp (call $heap_alloc (i32.const 64)))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (call $gs32 (i32.add (local.get $sp) (i32.const 24)) (i32.const 0))
    (call $gs32 (i32.add (local.get $sp) (i32.const 28)) (i32.const 120))
    (call $gs32 (i32.add (local.get $sp) (i32.const 32)) (i32.const 24))
    (call $gs32 (i32.add (local.get $sp) (i32.const 36)) (i32.const 0))
    (call $gs32 (i32.add (local.get $sp) (i32.const 40)) (i32.const 100))
    (call $gs32 (i32.add (local.get $sp) (i32.const 44)) (i32.const 0))
    (call $gs32 (i32.add (local.get $sp) (i32.const 48)) (i32.const 0))
    (call $handle_CreateWindowExW (i32.const 0) (local.get $class) (local.get $title)
      (local.get $style) (i32.const 0) (i32.const 0))
    (local.set $hwnd (i32.load offset=0 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (local.get $hwnd))

  (global $t_esp_delta (mut i32) (i32.const 0))
  (func (export "t_esp_delta") (result i32) (global.get $t_esp_delta))
  (func (export "t_cwpw") (param $proc i32) (param $hwnd i32) (param $msg i32)
      (param $wp i32) (param $lp i32) (result i32)
    (local $saved i32) (local $frame i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (local.set $frame (call $heap_alloc (i32.const 64)))
    (call $gs32 (local.get $frame) (i32.const 0x00401000))
    (call $gs32 (i32.add (local.get $frame) (i32.const 4)) (local.get $proc))
    (call $gs32 (i32.add (local.get $frame) (i32.const 8)) (local.get $hwnd))
    (call $gs32 (i32.add (local.get $frame) (i32.const 12)) (local.get $msg))
    (call $gs32 (i32.add (local.get $frame) (i32.const 16)) (local.get $wp))
    (call $gs32 (i32.add (local.get $frame) (i32.const 20)) (local.get $lp))
    (i32.store offset=16 (global.get $reg_base) (local.get $frame))
    (call $handle_CallWindowProcW (local.get $proc) (local.get $hwnd) (local.get $msg)
      (local.get $wp) (local.get $lp) (i32.const 0))
    (global.set $t_esp_delta (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $frame)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "t_defw") (param $hwnd i32) (param $msg i32) (param $wp i32) (param $lp i32) (result i32)
    (local $saved i32) (local $frame i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (local.set $frame (call $heap_alloc (i32.const 64)))
    (i32.store offset=16 (global.get $reg_base) (local.get $frame))
    (call $handle_DefWindowProcW (local.get $hwnd) (local.get $msg) (local.get $wp)
      (local.get $lp) (i32.const 0) (i32.const 0))
    (global.set $t_esp_delta (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $frame)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "t_set_proc") (param $hwnd i32) (param $proc i32)
    (call $wnd_table_set (local.get $hwnd) (local.get $proc)))
  (func (export "t_narrow") (param $hwnd i32) (param $msg i32) (param $lp i32) (result i32)
    (call $msg_narrow_text_lparam (local.get $hwnd) (local.get $msg) (local.get $lp)))
  (func (export "t_ctrl_native") (result i32) (global.get $WNDPROC_CTRL_NATIVE))
  ;; Turn a created window into a plain (non-control) one for DefWindowProcW.
  (func (export "t_declassify") (param $hwnd i32)
    (call $ctrl_table_set (call $wnd_table_find (local.get $hwnd)) (i32.const 0) (i32.const 0)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const alloc = n => e.guest_alloc(n) >>> 0;
  const writeW = (g, s) => {
    for (let i = 0; i < s.length; i++) {
      e.guest_write8(g + 2 * i, s.charCodeAt(i) & 0xff);
      e.guest_write8(g + 2 * i + 1, s.charCodeAt(i) >>> 8);
    }
    e.guest_write8(g + 2 * s.length, 0); e.guest_write8(g + 2 * s.length + 1, 0);
  };
  const strW = s => { const g = alloc(2 * s.length + 2); writeW(g, s); return g; };
  const readW = g => {
    let s = '';
    for (let i = 0; i < 512; i++) {
      const c = e.guest_read8(g + 2 * i) | (e.guest_read8(g + 2 * i + 1) << 8);
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return s;
  };
  const native = e.t_ctrl_native() >>> 0;

  // A Unicode BUTTON, as a VCL TButton is after its first chained message.
  const button = e.t_create_w(strW('BUTTON'), strW('Cancel'), 0x50010000) >>> 0;
  assert.ok(button, 'CreateWindowExW makes a BUTTON');
  const buf = alloc(256);
  const getText = hwnd => {
    writeW(buf, 'xxxxxxxxxxxxxxxx');
    const n = e.t_cwpw(native, hwnd, 0x000D, 64, buf) | 0;
    assert.strictEqual(e.t_esp_delta(), 24, 'CallWindowProcW pops its 24-byte frame');
    return [n, readW(buf)];
  };
  assert.deepStrictEqual(getText(button), [6, 'Cancel'],
    'WM_GETTEXT through CallWindowProcW fills a UTF-16 buffer');

  // WM_SETTEXT carries UTF-16 from a Unicode proc.
  assert.strictEqual(e.t_cwpw(native, button, 0x000C, 0, strW('Select')) | 0, 1);
  assert.deepStrictEqual(getText(button), [6, 'Select'],
    'WM_SETTEXT through CallWindowProcW stores the whole UTF-16 caption, not its first character');

  // WM_CREATE carries CREATESTRUCTW: the caption must come out whole.
  const cs = alloc(48);
  for (let i = 0; i < 48; i++) e.guest_write8(cs + i, 0);
  const csName = strW('OK');
  e.guest_write32(cs + 36, csName);
  e.guest_write32(cs + 32, 0x50010001);
  e.t_cwpw(native, button, 0x0001, 0, cs);
  assert.deepStrictEqual(getText(button), [2, 'OK'],
    'WM_CREATE with CREATESTRUCTW sets the full caption');
  assert.strictEqual(e.guest_read32(cs + 36) >>> 0, csName, "the caller's CREATESTRUCTW is untouched");

  // COMBOBOX: CB_ADDSTRING in, CB_GETLBTEXT out.
  const combo = e.t_create_w(strW('COMBOBOX'), strW(''), 0x50210003) >>> 0;
  assert.ok(combo, 'CreateWindowExW makes a COMBOBOX');
  assert.strictEqual(e.t_cwpw(native, combo, 0x0143, 0, strW('English')) | 0, 0, 'CB_ADDSTRING index 0');
  assert.strictEqual(e.t_cwpw(native, combo, 0x0143, 0, strW('Deutsch')) | 0, 1, 'CB_ADDSTRING index 1');
  assert.strictEqual(e.t_cwpw(native, combo, 0x0149, 1, 0) | 0, 7, 'CB_GETLBTEXTLEN');
  assert.strictEqual(e.t_cwpw(native, combo, 0x0148, 1, buf) | 0, 7, 'CB_GETLBTEXT count');
  assert.strictEqual(readW(buf), 'Deutsch', 'CB_GETLBTEXT widens into the caller buffer');

  // DefWindowProcW owns a plain window's caption in both directions.
  const plain = e.t_create_w(strW('STATIC'), strW('x'), 0x50000000) >>> 0;
  assert.ok(plain);
  e.t_declassify(plain);
  assert.strictEqual(e.t_defw(plain, 0x000C, 0, strW('Inno Setup')) | 0, 1, 'DefWindowProcW WM_SETTEXT');
  assert.strictEqual(e.t_esp_delta(), 20, 'DefWindowProcW pops 20 bytes');
  assert.strictEqual(e.t_defw(plain, 0x000E, 0, 0) | 0, 10, 'DefWindowProcW WM_GETTEXTLENGTH');
  writeW(buf, '');
  assert.strictEqual(e.t_defw(plain, 0x000D, 64, buf) | 0, 10, 'DefWindowProcW WM_GETTEXT count');
  assert.strictEqual(readW(buf), 'Inno Setup', 'DefWindowProcW WM_GETTEXT returns UTF-16');

  // SendMessageW: a native control narrows; a Unicode-subclassed one keeps
  // UTF-16 for the guest proc, which narrows later through CallWindowProcW.
  const text = strW('Hello');
  assert.notStrictEqual(e.t_narrow(combo, 0x0143, text) >>> 0, 0, 'unsubclassed native control: narrowed');
  e.t_set_proc(combo, 0x00401234);
  assert.strictEqual(e.t_narrow(combo, 0x0143, text) >>> 0, 0,
    'Unicode guest subclass: UTF-16 reaches the guest proc intact');

  console.log('PASS  CallWindowProcW/DefWindowProcW convert W payloads for native procs');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
