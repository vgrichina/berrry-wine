#!/usr/bin/env node
'use strict';
// USER picks a mouse message's window when the thread reads it: the capture
// window if one is set then, else the window under the point. The host routes
// when the event arrives, so a press made while the program is still busy
// with its previous click is addressed to that click's capture window, though
// the program releases capture on the queued WM_LBUTTONUP before it ever
// reads the press.
//
// SimCity 2001 (VB6) holds capture on its map for a whole slow placement. A
// tool click made right after one became a second click on the map, and the
// tool was never selected. GetMessage now resolves such a message again.
//
// Uses only the shipped module and ordinary API thunks; never compiles WAT.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = process.env.WA_TEST_ROOT || path.resolve(__dirname, '..');
const { createHostImports } = require(path.join(root, 'lib/host-imports'));
const regions = require(path.join(root, 'lib/region-map.generated'));
const apis = require(path.join(root, 'src/api_table.json'));

(async () => {
  const wasm = fs.readFileSync(process.env.WA_TEST_WASM || path.join(root, 'build/wine-assembly.wasm'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const view = new DataView(memory.buffer);
  const ctx = { getMemory: () => memory.buffer, resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} } };
  const imports = createHostImports(ctx);
  const pending = [];
  let last = null;
  Object.assign(imports.host, {
    memory, log() {}, log_i32() {},
    check_input() { last = pending.shift(); return last ? (last[2] << 16) | last[1] : 0; },
    check_input_hwnd() { return last[0]; },
    check_input_lparam() { return last[3]; },
    get_key_down_state() { return 0; },
    get_tick_count() { return 1234; },
    // The top-level frame is at (10,20) and 200x100 on screen.
    get_window_rect(hwnd, ptr) { [10, 20, 210, 120].forEach((n, i) => view.setInt32(ptr + i * 4, n, true)); },
  });
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const e = ctx.exports = instance.exports;
  const image = 0x400000, thunk = 0x7500000, msg = 0x520000, stack = 0x510000;
  const names = ['GetMessageA', 'SetCapture', 'ReleaseCapture'];
  e.init_thread(0, image, image, 0x600000, thunk, thunk + names.length * 8, names.length, 0);
  names.forEach((name, i) => view.setUint32(regions.BASE.THUNK_BASE + i * 8 + 4, apis.find(a => a.name === name).id, true));
  const wa = g => g - image + e.get_guest_base();
  // WndProc at 0x401000: xor eax,eax; ret 16 -- whatever USER sends it returns 0.
  [0x31, 0xC0, 0xC2, 0x10, 0x00].forEach((b, i) => view.setUint8(wa(0x401000) + i, b));
  const top = 0x10001, map = 0x10002, tool = 0x10003;
  e.set_hwnd_base(tool + 1);
  for (const h of [top, map, tool]) e.wnd_table_set(h, 0x401000);
  e.wnd_set_style_export(top, 0x10000000);
  e.test_gdi_client_rect_set(top, 0, 0, 200, 100);
  // Two side-by-side children: the map on the left, a tool button on the right.
  for (const [h, x] of [[map, 0], [tool, 100]]) {
    e.test_wnd_set_parent(h, top);
    e.wnd_set_style_export(h, 0x50000000);
    e.ctrl_set_geom(h, x, 0, 100, 100);
    e.test_gdi_client_rect_set(h, 0, 0, 100, 100);
  }
  const invoke = (index, args) => {
    [0, ...args].forEach((n, i) => view.setUint32(wa(stack) + i * 4, n, true));
    e.clear_yield(); e.set_esp(stack); e.set_eip(thunk + index * 8); e.run(100);
    assert.strictEqual(e.get_eip(), 0, `${names[index]} returned to sentinel`);
    return e.get_eax() >>> 0;
  };
  const get = () => {
    invoke(0, [msg, 0, 0, 0]);
    const [hwnd, m, , lp] = [0, 4, 8, 12].map(o => view.getUint32(wa(msg) + o, true));
    return { hwnd, msg: m, x: (lp << 16) >> 16, y: lp >> 16 };
  };
  const lp = (x, y) => ((y & 0xFFFF) << 16) | (x & 0xFFFF);

  // A window that never held capture keeps whatever the host addressed to
  // it, even a point outside it: only capture can be stale.
  pending.push([map, 0x201, 1, lp(150, 50)]);
  assert.deepStrictEqual(get(), { hwnd: map, msg: 0x201, x: 150, y: 50 }, 'no capture history: unchanged');

  // The map's click held capture when the host addressed a press on the tool
  // to it; the map released capture before the press is read.
  invoke(1, [map]); invoke(2, []);
  pending.push([map, 0x201, 1, lp(150, 50)]);
  assert.deepStrictEqual(get(), { hwnd: tool, msg: 0x201, x: 50, y: 50 },
    'a press read after capture ended goes to the window under the point');
  console.log('PASS  a press routed by an ended capture reaches the window under it');

  // Capture still held when read: USER delivers to the capture window.
  invoke(1, [map]);
  pending.push([map, 0x201, 1, lp(150, 50)]);
  assert.deepStrictEqual(get(), { hwnd: map, msg: 0x201, x: 150, y: 50 },
    'a held capture keeps the press, outside its window or not');
  // Capture moved to the tool before this release was read.
  invoke(1, [tool]);
  pending.push([map, 0x202, 0, lp(150, 50)]);
  assert.deepStrictEqual(get(), { hwnd: tool, msg: 0x202, x: 50, y: 50 },
    'the release goes to the window that holds capture when it is read');
  invoke(2, []);
  // An ordinary hit-tested message inside its window is never touched.
  pending.push([map, 0x201, 1, lp(20, 30)]);
  assert.deepStrictEqual(get(), { hwnd: map, msg: 0x201, x: 20, y: 30 }, 'inside its window: unchanged');
  console.log('PASS  capture held at read time wins; in-window messages are unchanged');
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
