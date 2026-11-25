#!/usr/bin/env node
'use strict';
// TrackMouseEvent (user32) and its comctl32 forwarder _TrackMouseEvent.
//
// Delphi's VCL calls _TrackMouseEvent from every control's CM_MOUSEENTER, so
// a Game Maker 8 runner (Spelunky Classic) died on the first mouse move over
// its window while it was a fail-fast stub. USER keeps one tracking record
// per thread and tells the thread what happened through posted messages:
// WM_MOUSELEAVE once the mouse no longer reaches the tracked window, and
// WM_MOUSEHOVER once it has rested inside the hover rectangle (4x4) for the
// hover time (HOVER_DEFAULT = 400 ms). Each ends its half of the tracking.
//
// Uses only the shipped module and ordinary API thunks; never compiles WAT.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = process.env.WA_TEST_ROOT || path.resolve(__dirname, '..');
const { createHostImports } = require(path.join(root, 'lib/host-imports'));
const regions = require(path.join(root, 'lib/region-map.generated'));
const apis = require(path.join(root, 'src/api_table.json'));

const WM_MOUSELEAVE = 0x2A3, WM_MOUSEHOVER = 0x2A1, WM_NCMOUSELEAVE = 0x2A2, WM_NCMOUSEHOVER = 0x2A0;
const TME_HOVER = 1, TME_LEAVE = 2, TME_NONCLIENT = 0x10, TME_QUERY = 0x40000000, TME_CANCEL = 0x80000000;
const HOVER_DEFAULT = 0xFFFFFFFF;

(async () => {
  const wasm = fs.readFileSync(process.env.WA_TEST_WASM || path.join(root, 'build/wine-assembly.wasm'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const view = new DataView(memory.buffer);
  const ctx = { getMemory: () => memory.buffer, resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} } };
  const imports = createHostImports(ctx);
  let mouse = { x: 0, y: 0 };
  let now = 1000;
  Object.assign(imports.host, {
    memory, log() {}, log_i32() {},
    check_input() { return 0; },
    check_input_hwnd() { return 0; },
    check_input_lparam() { return 0; },
    get_key_down_state() { return 0; },
    get_tick_count() { return now; },
    get_ticks() { return now; },
    get_mouse_position() { return ((mouse.y & 0xFFFF) << 16) | (mouse.x & 0xFFFF); },
    // The top-level frame is at (10,20) and 200x100 on screen.
    get_window_rect(hwnd, ptr) { [10, 20, 210, 120].forEach((n, i) => view.setInt32(ptr + i * 4, n, true)); },
  });
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const e = ctx.exports = instance.exports;
  const image = 0x400000, thunk = 0x7500000, msg = 0x520000, stack = 0x510000, tmeStruct = 0x530000;
  const names = ['GetMessageA', 'PeekMessageA', 'TrackMouseEvent', '_TrackMouseEvent',
    'GetLastError', 'SetCapture', 'ReleaseCapture', 'DestroyWindow'];
  e.init_thread(0, image, image, 0x600000, thunk, thunk + names.length * 8, names.length, 0);
  names.forEach((name, i) => {
    const api = apis.find(a => a.name === name);
    assert.ok(api, `${name} is in api_table.json`);
    view.setUint32(regions.BASE.THUNK_BASE + i * 8 + 4, api.id, true);
  });
  const wa = g => g - image + e.get_guest_base();
  // WndProc at 0x401000: xor eax,eax; ret 16 -- whatever USER sends it returns 0.
  [0x31, 0xC0, 0xC2, 0x10, 0x00].forEach((b, i) => view.setUint8(wa(0x401000) + i, b));
  const top = 0x10001, map = 0x10002, tool = 0x10003;
  e.set_hwnd_base(tool + 1);
  for (const h of [top, map, tool]) e.wnd_table_set(h, 0x401000);
  e.wnd_set_style_export(top, 0x10000000);
  // A frame: the client area starts 4 px in and 24 px down (caption), so the
  // client is (14,44)-(206,116) on screen and the rest is non-client.
  e.test_gdi_client_rect_set(top, 4, 24, 196, 96);
  // Two side-by-side children 100x50 at the client's top: map, then tool.
  for (const [h, x] of [[map, 0], [tool, 100]]) {
    e.test_wnd_set_parent(h, top);
    e.wnd_set_style_export(h, 0x50000000);
    e.ctrl_set_geom(h, x, 0, x === 0 ? 100 : 92, 50);
    e.test_gdi_client_rect_set(h, 0, 0, x === 0 ? 100 : 92, 50);
  }
  const ON_MAP = { x: 44, y: 64 };        // map client (30,20)
  const ON_TOOL = { x: 164, y: 64 };      // tool client (50,20)
  const ON_TOP_CLIENT = { x: 64, y: 104 }; // top client (50,60), below both children
  const ON_TOP_FRAME = { x: 12, y: 22 };  // top's non-client area

  const invoke = (name, args) => {
    const index = names.indexOf(name);
    [0, ...args].forEach((n, i) => view.setUint32(wa(stack) + i * 4, n >>> 0, true));
    e.clear_yield(); e.set_esp(stack); e.set_eip(thunk + index * 8); e.run(100);
    assert.strictEqual(e.get_eip(), 0, `${name} returned to sentinel`);
    // ESP cleanup is this test's business for the two tracking entry points
    // (and the queue reads around them); DestroyWindow hands focus back
    // through a guest continuation this bare harness does not model.
    if (name !== 'DestroyWindow')
      assert.strictEqual(e.get_esp() >>> 0, stack + 4 + args.length * 4, `${name} pops its return address and ${args.length} args`);
    return e.get_eax() >>> 0;
  };
  const track = (flags, hwnd, hover = HOVER_DEFAULT, api = 'TrackMouseEvent', cb = 16) => {
    [cb, flags, hwnd, hover].forEach((n, i) => view.setUint32(wa(tmeStruct) + i * 4, n >>> 0, true));
    return invoke(api, [tmeStruct]);
  };
  const query = () => {
    assert.strictEqual(track(TME_QUERY, 0, 0), 1, 'TME_QUERY succeeds');
    const [cb, flags, hwnd, hover] = [0, 4, 8, 12].map(o => view.getUint32(wa(tmeStruct) + o, true));
    assert.strictEqual(cb, 16, 'TME_QUERY leaves cbSize');
    return { flags, hwnd, hover };
  };
  // Every message PeekMessage(PM_REMOVE) has for this thread right now.
  const drain = () => {
    const out = [];
    for (let i = 0; i < 16 && invoke('PeekMessageA', [msg, 0, 0, 0, 1]); i++) {
      const [hwnd, m, wp, lp] = [0, 4, 8, 12].map(o => view.getUint32(wa(msg) + o, true));
      out.push({ hwnd, msg: m, wp, lp });
    }
    return out;
  };
  const only = (list, what) => list.filter(m => m.msg >= 0x2A0 && m.msg <= 0x2A3);
  const lp = (x, y) => (((y & 0xFFFF) << 16) | (x & 0xFFFF)) >>> 0;

  drain();

  // 1. Already outside: TME_LEAVE posts WM_MOUSELEAVE at once and tracks
  // nothing. Through the comctl32 forwarder.
  mouse = ON_TOOL;
  assert.strictEqual(track(TME_LEAVE, map, 0, '_TrackMouseEvent'), 1, '_TrackMouseEvent succeeds');
  assert.deepStrictEqual(query(), { flags: 0, hwnd: 0, hover: 0 }, 'nothing tracked for a window the mouse is not in');
  assert.deepStrictEqual(only(drain()), [{ hwnd: map, msg: WM_MOUSELEAVE, wp: 0, lp: 0 }],
    'immediate WM_MOUSELEAVE for a window the cursor is already outside');
  console.log('PASS  cursor already outside: immediate WM_MOUSELEAVE (via comctl32 _TrackMouseEvent)');

  // 2. Leave on moving out, exactly once.
  mouse = ON_MAP;
  assert.strictEqual(track(TME_LEAVE, map, 0), 1);
  assert.deepStrictEqual(query(), { flags: TME_LEAVE, hwnd: map, hover: 0 }, 'TME_QUERY reports the tracking');
  assert.deepStrictEqual(only(drain()), [], 'no leave while the mouse stays in the window');
  mouse = ON_TOOL;
  assert.deepStrictEqual(only(drain()), [{ hwnd: map, msg: WM_MOUSELEAVE, wp: 0, lp: 0 }], 'WM_MOUSELEAVE on moving out');
  assert.deepStrictEqual(only(drain()), [], 'WM_MOUSELEAVE is posted once');
  assert.deepStrictEqual(query(), { flags: 0, hwnd: 0, hover: 0 }, 'tracking ends with the leave');
  // Onto a child of the tracked window is leaving it, too.
  mouse = ON_TOP_CLIENT;
  assert.strictEqual(track(TME_LEAVE, top, 0), 1);
  assert.deepStrictEqual(query().flags, TME_LEAVE);
  mouse = ON_MAP;
  assert.deepStrictEqual(only(drain()), [{ hwnd: top, msg: WM_MOUSELEAVE, wp: 0, lp: 0 }], 'moving onto a child leaves the parent');
  console.log('PASS  WM_MOUSELEAVE once on moving out (and onto a child); tracking then ends');

  // 3. Hover after HOVER_DEFAULT (400 ms) of rest; leave tracking continues.
  mouse = ON_MAP; now = 1000;
  assert.strictEqual(track(TME_HOVER | TME_LEAVE, map, HOVER_DEFAULT), 1);
  assert.deepStrictEqual(query(), { flags: TME_HOVER | TME_LEAVE, hwnd: map, hover: 400 }, 'HOVER_DEFAULT is 400 ms');
  now = 1399;
  assert.deepStrictEqual(only(drain()), [], 'no hover before the hover time');
  now = 1400;
  assert.deepStrictEqual(only(drain()), [{ hwnd: map, msg: WM_MOUSEHOVER, wp: 0, lp: lp(30, 20) }],
    'WM_MOUSEHOVER with key state and client coordinates');
  now = 2000;
  assert.deepStrictEqual(only(drain()), [], 'hover is posted once');
  assert.deepStrictEqual(query(), { flags: TME_LEAVE, hwnd: map, hover: 0 }, 'hover ends, leave tracking stays');
  mouse = ON_TOOL;
  assert.deepStrictEqual(only(drain()), [{ hwnd: map, msg: WM_MOUSELEAVE, wp: 0, lp: 0 }]);
  console.log('PASS  WM_MOUSEHOVER after 400 ms at rest; leave tracking continues');

  // 4. Moving outside the 4x4 hover rectangle restarts the wait there; moves
  // inside it do not.
  mouse = { x: 44, y: 64 }; now = 3000;
  assert.strictEqual(track(TME_HOVER, map, 100), 1);
  mouse = { x: 47, y: 64 }; now = 3050;            // 3 px: outside the 4x4 rectangle
  assert.deepStrictEqual(only(drain()), [], 'moved out of the hover rectangle');
  mouse = { x: 48, y: 65 }; now = 3060;            // 1 px from the new anchor: inside
  assert.deepStrictEqual(only(drain()), []);
  now = 3120;                                       // 120 ms after the first anchor, 70 after the second
  assert.deepStrictEqual(only(drain()), [], 'no hover: the cursor left the rectangle, the wait restarted');
  now = 3150;
  assert.deepStrictEqual(only(drain()), [{ hwnd: map, msg: WM_MOUSEHOVER, wp: 0, lp: lp(34, 21) }],
    'hover 100 ms after the cursor came to rest');
  assert.deepStrictEqual(query(), { flags: 0, hwnd: 0, hover: 0 }, 'hover-only tracking ends with the hover');
  // Hover tracking alone ends silently when the mouse leaves.
  mouse = ON_MAP; now = 4000;
  assert.strictEqual(track(TME_HOVER, map, 100), 1);
  mouse = ON_TOOL; now = 4200;
  assert.deepStrictEqual(only(drain()), [], 'no hover and no leave after leaving with TME_HOVER only');
  assert.deepStrictEqual(query().flags, 0);
  console.log('PASS  no hover once the cursor moves outside the hover rectangle; the wait restarts');

  // 5. TME_CANCEL drops the named halves; a cancel for another window does not.
  mouse = ON_MAP; now = 5000;
  assert.strictEqual(track(TME_HOVER | TME_LEAVE, map, 100), 1);
  assert.strictEqual(track(TME_CANCEL | TME_LEAVE, tool, 0), 1);
  assert.strictEqual(query().flags, TME_HOVER | TME_LEAVE, 'cancel for another window leaves this one');
  assert.strictEqual(track(TME_CANCEL | TME_HOVER, map, 0), 1);
  assert.deepStrictEqual(query(), { flags: TME_LEAVE, hwnd: map, hover: 0 }, 'cancel hover keeps leave');
  now = 6000;
  assert.deepStrictEqual(only(drain()), [], 'cancelled hover never fires');
  assert.strictEqual(track(TME_CANCEL | TME_LEAVE, map, 0), 1);
  assert.deepStrictEqual(query(), { flags: 0, hwnd: 0, hover: 0 }, 'cancel leave ends the tracking');
  mouse = ON_TOOL;
  assert.deepStrictEqual(only(drain()), [], 'cancelled leave never fires');
  console.log('PASS  TME_CANCEL and TME_QUERY');

  // 6. cbSize is validated: FALSE + ERROR_INVALID_PARAMETER; so is the window.
  assert.strictEqual(track(TME_LEAVE, map, 0, 'TrackMouseEvent', 12), 0, 'bad cbSize fails');
  assert.strictEqual(invoke('GetLastError', []), 87, 'ERROR_INVALID_PARAMETER');
  assert.strictEqual(track(TME_QUERY, 0, 0, '_TrackMouseEvent', 0), 0, 'bad cbSize fails for TME_QUERY too');
  assert.strictEqual(invoke('GetLastError', []), 87);
  assert.strictEqual(track(TME_LEAVE, 0x1FFFF, 0), 0, 'a non-window fails');
  assert.strictEqual(invoke('GetLastError', []), 1400, 'ERROR_INVALID_WINDOW_HANDLE');
  console.log('PASS  cbSize validated (ERROR_INVALID_PARAMETER); invalid window rejected');

  // 7. Capture: the capture window keeps receiving the mouse outside itself,
  // so it is not left until capture goes elsewhere.
  mouse = ON_MAP;
  invoke('SetCapture', [map]);
  mouse = ON_TOOL;
  assert.strictEqual(track(TME_LEAVE, map, 0), 1);
  assert.deepStrictEqual(only(drain()), [], 'the capture window still has the mouse');
  assert.strictEqual(query().flags, TME_LEAVE);
  invoke('ReleaseCapture', []);
  assert.deepStrictEqual(only(drain()), [{ hwnd: map, msg: WM_MOUSELEAVE, wp: 0, lp: 0 }],
    'WM_MOUSELEAVE once capture ends with the cursor elsewhere');
  console.log('PASS  capture defers the leave until it is released');

  // 8. Non-client tracking: WM_NCMOUSEHOVER (hit-test code, screen point)
  // and WM_NCMOUSELEAVE once the cursor enters the client area.
  mouse = ON_TOP_FRAME; now = 7000;
  assert.strictEqual(track(TME_NONCLIENT | TME_HOVER | TME_LEAVE, top, 50), 1);
  assert.deepStrictEqual(query(), { flags: TME_NONCLIENT | TME_HOVER | TME_LEAVE, hwnd: top, hover: 50 });
  now = 7050;
  const nch = only(drain());
  assert.strictEqual(nch.length, 1);
  assert.strictEqual(nch[0].msg, WM_NCMOUSEHOVER);
  assert.strictEqual(nch[0].hwnd, top);
  assert.strictEqual(nch[0].lp, lp(ON_TOP_FRAME.x, ON_TOP_FRAME.y), 'WM_NCMOUSEHOVER lParam is the screen point');
  assert.ok(nch[0].wp !== 1, 'WM_NCMOUSEHOVER wParam is a non-client hit-test code');
  mouse = ON_TOP_CLIENT;
  assert.deepStrictEqual(only(drain()), [{ hwnd: top, msg: WM_NCMOUSELEAVE, wp: 0, lp: 0 }],
    'WM_NCMOUSELEAVE on entering the client area');
  // Client tracking from inside the non-client area leaves at once.
  mouse = ON_TOP_FRAME;
  assert.strictEqual(track(TME_LEAVE, top, 0), 1);
  assert.deepStrictEqual(only(drain()), [{ hwnd: top, msg: WM_MOUSELEAVE, wp: 0, lp: 0 }]);
  console.log('PASS  TME_NONCLIENT: WM_NCMOUSEHOVER and WM_NCMOUSELEAVE');

  // 9. Hidden: the window no longer gets the mouse, so it is left.
  mouse = ON_TOOL;
  assert.strictEqual(track(TME_LEAVE, tool, 0), 1);
  // ShowWindow(SW_HIDE) sends WM_SHOWWINDOW through a guest continuation
  // this bare harness does not run; its result is the cleared WS_VISIBLE.
  e.wnd_set_style_export(tool, 0x40000000);
  const hidden = only(drain());
  assert.deepStrictEqual(hidden, [{ hwnd: tool, msg: WM_MOUSELEAVE, wp: 0, lp: 0 }], 'WM_MOUSELEAVE when hidden');
  assert.strictEqual(query().flags, 0);
  console.log('PASS  hiding the tracked window posts WM_MOUSELEAVE');

  // 10. Destroyed: tracking ends with the window, and nothing addressed to
  // the dead HWND is ever retrieved (USER discards a destroyed window's
  // queued messages).
  mouse = ON_MAP;
  assert.strictEqual(track(TME_HOVER | TME_LEAVE, map, 10), 1);
  assert.strictEqual(query().hwnd, map);
  invoke('DestroyWindow', [map]);
  assert.deepStrictEqual(query(), { flags: 0, hwnd: 0, hover: 0 }, 'tracking ends when the window is destroyed');
  now = 9000; mouse = ON_TOOL;
  assert.deepStrictEqual(drain().filter(m => m.hwnd === map), [], 'no message for the destroyed window');
  console.log('PASS  destroying the tracked window ends tracking');
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
