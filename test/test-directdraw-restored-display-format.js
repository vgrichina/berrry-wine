#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const { bootRenderHarness } = require('./render-helper');
const extraWat = String.raw`
(global $format_test_ddraw (mut i32) (i32.const 0))
(func (export "format_test_init")
 (global.set $DX_VTBL_DDRAW (i32.const 0x51000000))
 (global.set $DX_VTBL_DDSURF2 (i32.const 0x52000000))
 (global.set $format_test_ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW))))
(func (export "format_test_mode") (param $bpp i32) (result i32)
 (call $wnd_table_set (i32.const 0x10001) (global.get $WNDPROC_BUILTIN))
 (call $dx_coop_hwnd_set (i32.const 0x10001))
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDraw_SetDisplayMode (global.get $format_test_ddraw) (i32.const 800) (i32.const 600) (local.get $bpp) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "format_test_restore")
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDraw_RestoreDisplayMode (global.get $format_test_ddraw) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "format_test_caps") (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_GetDeviceCaps (i32.const 0) (i32.const 12) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "format_test_display") (param $out i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDraw_GetDisplayMode (global.get $format_test_ddraw) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "format_test_create") (param $desc i32) (param $out i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDraw_CreateSurface (global.get $format_test_ddraw) (local.get $desc) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "format_test_desc") (param $surface i32) (param $out i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDrawSurface_GetSurfaceDesc (local.get $surface) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "format_test_unlock") (param $surface i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDrawSurface_Unlock (local.get $surface) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "format_test_lock") (param $surface i32) (param $out i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDrawSurface_Lock (local.get $surface) (i32.const 0) (local.get $out) (i32.const 1) (i32.const 0) (i32.const 0)))
`;
(async () => {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const opts = { memory, extraWat, fonts: 'none', extraHostOverrides: {
    get_screen_size: () => 1024 | (740 << 16), move_window: () => {},
    get_window_rect: (hwnd, ptr) => [0, 0, 800, 600].forEach((v, i) => new DataView(memory.buffer).setInt32(ptr + i * 4, v, true)),
  } };
  const a = (await bootRenderHarness(opts)).exports;
  const b = (await bootRenderHarness(opts)).exports;
  a.format_test_init(); b.format_test_init();
  const desc = 0x410000, out = 0x410100, query = 0x410200;
  const format = ex => ({ bpp: ex.guest_read32(query + 84), pitch: ex.guest_read32(query + 16),
    masks: [88, 92, 96].map(n => ex.guest_read32(query + n)) });
  const expectedMasks = depth => depth === 16 ? [0xf800, 0x7e0, 0x1f] : depth === 32 ? [0xff0000, 0xff00, 0xff] : [0, 0, 0];
  function create(ex, primary, explicit = 0) {
    for (let n = 0; n < 108; n += 4) ex.guest_write32(desc + n, 0);
    ex.guest_write32(desc, 108); ex.guest_write32(desc + 4, (primary ? 1 : 7) | (explicit ? 0x1000 : 0));
    ex.guest_write32(desc + 8, 3); ex.guest_write32(desc + 12, 641);
    ex.guest_write32(desc + 104, primary ? 0x200 : 0x840);
    if (explicit) {
      ex.guest_write32(desc + 72, 32); ex.guest_write32(desc + 76, explicit === 8 ? 0x60 : 0x40);
      ex.guest_write32(desc + 84, explicit);
      expectedMasks(explicit).forEach((v, i) => ex.guest_write32(desc + 88 + i * 4, v));
    }
    assert.equal(ex.format_test_create(desc, out), 0);
    return ex.guest_read32(out);
  }
  const failures = [], rows = [];
  function check(label, actual, expected) {
    rows.push({ label, actual, expected });
    if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(label);
  }
  for (const desktop of [32, 8]) for (const selected of [8, 16, 32]) {
    a.set_desktop_color_depth(desktop);
    assert.equal(a.format_test_mode(selected), 0);
    const allocated = create(a, false);
    check(`desktop${desktop}/selected${selected}/activeGDI`, b.format_test_caps(), selected);
    a.format_test_restore();
    assert.equal(b.get_display_mode_active(), 0);
    assert.equal(b.test_dx_get_process_state(2), selected, 'retain last request for mode-change suppression');
    const label = `desktop${desktop}/restored${selected}`;
    check(label + '/GDI', b.format_test_caps(), desktop);
    b.guest_write32(query, 108); b.format_test_display(query);
    const display = format(b);
    check(label + '/GetDisplayMode', display, { bpp: desktop, pitch: 800 * desktop / 8, masks: expectedMasks(desktop) });
    for (const primary of [false, true]) {
      const surface = create(b, primary);
      b.guest_write32(query, 108); b.format_test_lock(surface, query);
      const actual = format(b), width = b.guest_read32(query + 12);
      check(label + (primary ? '/primaryLock' : '/offscreenLock'), actual,
        { bpp: desktop, pitch: (width * desktop / 8 + 3) & ~3, masks: expectedMasks(desktop) });
      b.format_test_unlock(surface);
    }
    a.guest_write32(query, 108); a.format_test_desc(allocated, query);
    check(label + '/existingSurface', format(a).bpp, selected);
    const explicit = create(b, false, 16);
    b.guest_write32(query, 108); b.format_test_desc(explicit, query);
    check(label + '/explicitRGB565', format(b), { bpp: 16, pitch: 1284, masks: expectedMasks(16) });
    a.set_post_queue_count(0); assert.equal(a.format_test_mode(selected), 0);
    check(label + '/sameModeNotifications', a.get_post_queue_count(), 0);
  }
  console.log(JSON.stringify({ cases: rows, failures }, null, 2));
  assert.deepEqual(failures, [], 'current DirectDraw format must agree with restored GDI desktop; preserve allocated surfaces and last request');
  console.log('PASS restored desktop format: 6 transitions, GDI/GetDisplayMode/primary/offscreen Lock, literal descriptors, explicit/existing surfaces, two instances, repeat-mode notifications');
})().catch(error => { console.error(error); process.exitCode = 1; });
