#!/usr/bin/env node
'use strict';

// Dialog controls are laid out on the guest Worker. Its renderer shadow has
// independent mode globals: re-deriving parent dimensions there clipped the
// actual ABOUTTET OK buttons. Use two real instances and the shipped NE
// templates, then require actual button pixels inside the parent client.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_load_ne_dialog")
      (param $hwnd i32) (param $ptr i32) (param $len i32) (param $mode i32) (result i32)
    (global.set $is_win16 (local.get $mode))
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_DIALOG))
    (global.set $next_hwnd (i32.add (local.get $hwnd) (i32.const 1)))
    (global.set $dlg_indirect_template_ptr
      (call $win16_dlg_to32 (call $g2w (local.get $ptr)) (local.get $len)))
    (call $dlg_load (local.get $hwnd) (i32.const 0)))
  (func (export "test_find_id") (param $hwnd i32) (param $id i32) (result i32)
    (call $ctrl_find_by_id (local.get $hwnd) (local.get $id)))
  (func (export "test_nc") (param $hwnd i32)
    (drop (call $wnd_set_style (local.get $hwnd)
      (i32.or (call $wnd_get_style (local.get $hwnd)) (i32.const 0x10000000))))
    (call $defwndproc_do_nccalcsize (local.get $hwnd)))
`;

function dialogResource(binary, id) {
  const ne = binary.readUInt32LE(0x3c);
  const start = ne + binary.readUInt16LE(ne + 0x24);
  const shift = binary.readUInt16LE(start);
  let cursor = start + 2;
  while (binary.readUInt16LE(cursor)) {
    const type = binary.readUInt16LE(cursor) & 0x7fff;
    const count = binary.readUInt16LE(cursor + 2);
    cursor += 8;
    for (let i = 0; i < count; i++, cursor += 12) {
      if (type === 5 && (binary.readUInt16LE(cursor + 6) & 0x7fff) === id) {
        const offset = binary.readUInt16LE(cursor) << shift;
        const length = binary.readUInt16LE(cursor + 2) << shift;
        return Buffer.from(binary.subarray(offset, offset + length));
      }
    }
  }
  throw Error(`Missing actual ABOUTTET dialog ${id}`);
}

function withFont(template) {
  // These actual templates have empty menu, class and title, ending at16.
  assert.deepEqual([...template.subarray(13, 16)], [0, 0, 0]);
  const header = Buffer.from(template.subarray(0, 16));
  header.writeUInt32LE((header.readUInt32LE(0) | 0x40) >>> 0);
  const points = Buffer.alloc(2);
  points.writeUInt16LE(10);
  return Buffer.concat([header, points, Buffer.from('MS Sans Serif\0'), template.subarray(16)]);
}

(async () => {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const options = { extraWat, memory, width: 1024, height: 740 };
  const owner = await bootRenderHarness(options);
  const shadow = await bootRenderHarness({ ...options, extraHostOverrides: {
    // Both browser instances query the same host window geometry.
    get_window_rect: (...args) => owner.host.get_window_rect(...args),
  } });
  shadow.exports.set_host_shadow(1);
  const binary = fs.readFileSync(path.join(__dirname, 'binaries/wep16/WEP1/ABOUTTET.DLL'));
  const unpack = value => [value & 0xffff, value >>> 16];
  const client = (e, hwnd) => [e.get_client_rect_l(hwnd), e.get_client_rect_t(hwnd),
    e.get_client_rect_r(hwnd), e.get_client_rect_b(hwnd)];
  let index = 0;
  for (const scenario of [
    { id: 100, mode: 1 }, { id: 101, mode: 1 },
    { id: 100, mode: 0 }, { id: 100, mode: 0, font: true },
    { id: 100, mode: 0, defaultOrigin: true },
  ]) {
    let template = dialogResource(binary, scenario.id);
    if (scenario.font) template = withFont(template);
    if (scenario.defaultOrigin) template.writeUInt16LE(0x8000, 5);
    const e = owner.exports;
    const pointer = e.guest_alloc(template.length);
    template.forEach((value, offset) => e.guest_write8(pointer + offset, value));
    const hwnd = 0x11000 + index++ * 0x100;
    assert(e.test_load_ne_dialog(hwnd, pointer, template.length, scenario.mode));
    const button = e.test_find_id(hwnd, 1);
    const xy = unpack(e.ctrl_get_xy(button));
    const wh = unpack(e.ctrl_get_wh(button));
    owner.renderer.createDialog(hwnd, 0, shadow.instance, memory);
    const win = owner.renderer.windows[hwnd];
    assert.equal(shadow.exports.is_win16(), 0, 'never copy guest mode into shadow');
    assert.deepEqual([win.w, win.h], unpack(e.ctrl_get_wh(hwnd)),
      'renderer parent uses geometry resolved on owner');
    if (scenario.defaultOrigin) assert.equal(win.x, 40, 'CW_USEDEFAULT bootstrap origin retained');
    if (scenario.font) {
      assert.deepEqual(unpack(e.dlg_get_base_units(hwnd)), [8, 16]);
      assert.equal(win.w, 356, 'PE with 8x16 font retains PE nonclient dimensions');
    }
    win.visible = true;
    e.test_nc(hwnd);
    owner.renderer._computeClientRect(win);
    assert.deepEqual(client(e, hwnd), client(shadow.exports, hwnd),
      'owner NCCALCSIZE is shared, not recalculated with shadow mode');
    assert(xy[0] + wh[0] <= win.clientRect.w && xy[1] + wh[1] <= win.clientRect.h,
      'actual bottom IDOK is fully contained in parent client');
    e.send_message(button, 0x000f, 0, 0);
    owner.renderer.repaint();
    const pixels = owner.canvas.getContext('2d').getImageData(
      win.clientRect.x + xy[0], win.clientRect.y + xy[1], wh[0], wh[1]).data;
    let dark = 0, light = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] < 64 && pixels[i + 1] < 64 && pixels[i + 2] < 64) dark++;
      if (pixels[i] > 200 && pixels[i + 1] > 200 && pixels[i + 2] > 200) light++;
    }
    assert(dark > 50 && light > 20, 'real WAT button painting reaches expected client pixels');
    win.visible = false;
  }
  console.log('PASS owner/shadow dialog geometry: actual NE100/101, PE default/font, client paint and default origin');
})().catch(error => { console.error(error); process.exitCode = 1; });
