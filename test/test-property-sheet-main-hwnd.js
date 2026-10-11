#!/usr/bin/env node
'use strict';

// A property sheet opened over an app's own visible window must not take over
// $main_hwnd. That global is also where a DirectDraw primary is presented
// (get_dx_present_hwnd), so War Wind's Multiplayer Wizard -- PropertySheetA over
// its exclusive 640x480 display -- used to receive the whole game frame as a
// layer over its client area, burying every label and button. A sheet that is
// the app's only UI (Jazz2's demo installer) still becomes main.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_ps_make_window") (param $style i32) (result i32)
    (local $hwnd i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (i32.const 0x00401000))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
    (local.get $hwnd))
  (func (export "test_ps_set_main") (param $hwnd i32)
    (global.set $main_hwnd (local.get $hwnd)))
  (func (export "test_ps_main") (result i32)
    (global.get $main_hwnd))
  (func (export "test_ps_set_owner") (param $hwnd i32) (param $owner i32)
    (call $wnd_set_owner (local.get $hwnd) (local.get $owner)))
  (func (export "test_ps_raise") (param $hwnd i32)
    (call $wnd_z_raise (local.get $hwnd)))
  (func (export "test_ps_set_coop") (param $hwnd i32)
    (call $dx_coop_hwnd_set (local.get $hwnd)))
  (func (export "test_ps_create") (param $header i32) (result i32)
    (call $create_property_sheet (local.get $header) (i32.const 0)))
  (func (export "test_ps_teardown") (param $dlg i32)
    (call $wnd_destroy_tree (local.get $dlg))
    (call $host_destroy_window (local.get $dlg))
    (global.set $propsheet_frame_hwnd (i32.const 0))
    (call $propsheet_page_hwnds_release)
    (call $propsheet_release_pages))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const bytes = new Uint8Array(memory.buffer);
  const fixture = fs.readFileSync(path.join(__dirname, 'binaries', 'calc.exe'));
  bytes.set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE loads');

  const dlgProc = e.guest_alloc(16) >>> 0;
  bytes.set([
    0xB8, 0x01, 0x00, 0x00, 0x00,       // mov eax,1
    0xC2, 0x10, 0x00,                   // ret 16
  ], e.guest_to_wasm(dlgProc) >>> 0);

  const makeHeader = owner => {
    const page = e.guest_alloc(40) >>> 0;
    for (let off = 0; off < 40; off += 4) e.guest_write32(page + off, 0);
    e.guest_write32(page, 40);
    e.guest_write32(page + 8, 0x00400000);
    e.guest_write32(page + 12, 101);
    e.guest_write32(page + 24, dlgProc);
    const header = e.guest_alloc(40) >>> 0;
    for (let off = 0; off < 40; off += 4) e.guest_write32(header + off, 0);
    e.guest_write32(header, 40);
    e.guest_write32(header + 4, 0x8);          // PSH_PROPSHEETPAGE
    e.guest_write32(header + 8, owner);
    e.guest_write32(header + 24, 1);
    e.guest_write32(header + 32, page);
    return header;
  };

  // 1. A game window is visible and main: the sheet must leave it main.
  const game = e.test_ps_make_window(0x10000000 | 0x80000000) >>> 0;  // WS_VISIBLE|WS_POPUP
  e.test_ps_set_main(game);
  assert.strictEqual(e.get_dx_present_hwnd() >>> 0, game,
    'precondition: the primary presents to the game window');
  const sheet = e.test_ps_create(makeHeader(game)) >>> 0;
  assert(sheet && sheet !== game, 'the sheet frame is created');
  assert.strictEqual(e.test_ps_main() >>> 0, game,
    'a sheet over a visible main window does not take $main_hwnd');
  assert.strictEqual(e.get_dx_present_hwnd() >>> 0, game,
    'the DirectDraw primary keeps presenting to the game, not onto the wizard');
  e.test_ps_teardown(sheet);

  // 2. No main window at all (an installer whose whole UI is the wizard).
  e.test_ps_set_main(0);
  const lone = e.test_ps_create(makeHeader(0)) >>> 0;
  assert(lone, 'a stand-alone sheet is created');
  assert.strictEqual(e.test_ps_main() >>> 0, lone,
    'a sheet with no main window to keep becomes the main window');
  e.test_ps_teardown(lone);

  // 3. The main window exists but is hidden: the sheet is the visible UI.
  const hidden = e.test_ps_make_window(0x80000000) >>> 0;
  e.test_ps_set_main(hidden);
  const over = e.test_ps_create(makeHeader(hidden)) >>> 0;
  assert(over, 'a sheet over a hidden main window is created');
  assert.strictEqual(e.test_ps_main() >>> 0, over,
    'a hidden main window is replaced by the sheet');
  e.test_ps_teardown(over);

  // 4. An instance with no $main_hwnd of its own (the page's shadow of a Worker
  //    guest) falls back to the window table. A modal dialog OWNED by the app
  //    window sits above it in z-order; the frame must still go to the app
  //    window, not into the dialog (the D3D viewer's Open dialog in threads
  //    mode, D3DIM-VIEWER-THREADS-DIALOG-OCCLUDED-20261011).
  e.test_ps_set_main(0);
  e.test_ps_set_coop(0);
  const appWin = e.test_ps_make_window(0x10000000 | 0x00C00000) >>> 0;  // WS_VISIBLE|WS_CAPTION
  const dialog = e.test_ps_make_window(0x10000000 | 0x80000000) >>> 0;  // WS_VISIBLE|WS_POPUP
  e.test_ps_set_owner(dialog, appWin);
  e.test_ps_raise(appWin);
  e.test_ps_raise(dialog);
  assert.strictEqual(e.get_dx_present_hwnd() >>> 0, appWin,
    'no $main_hwnd: an owned dialog above the app window is not the present target');
  // 5. ...and the DirectDraw cooperative window, process-shared, wins outright.
  const other = e.test_ps_make_window(0x10000000 | 0x80000000) >>> 0;
  e.test_ps_raise(other);
  e.test_ps_set_coop(appWin);
  assert.strictEqual(e.get_dx_present_hwnd() >>> 0, appWin,
    'no $main_hwnd: the cooperative-level window is the present target');
  e.test_ps_set_coop(0);

  console.log('PASS  property sheet takes $main_hwnd only when no visible main window exists');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
