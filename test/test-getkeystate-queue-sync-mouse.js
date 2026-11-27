#!/usr/bin/env node
'use strict';
// GetKeyState reports the key state as of the last input message the thread
// removed from its queue, not the device state now. For the mouse buttons
// that is the MK_* flags of the last hardware mouse message retrieved.
//
// SimCity 2001 (VB6 p-code) is busy redrawing when the user clicks a tool, so
// it retrieves WM_LBUTTONDOWN after the button is already up. VB's control
// procedure then asks GetKeyState(VK_LBUTTON), and only captures the mouse
// (and so only raises Click on the up) when it reads down. Reading the
// device instead made every quick click on a tool button do nothing.
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
    // The device: every button is already released.
    get_key_down_state() { return 0; },
    get_tick_count() { return 1234; },
    get_window_rect(hwnd, ptr) { [10, 20, 210, 120].forEach((n, i) => view.setInt32(ptr + i * 4, n, true)); },
  });
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const e = ctx.exports = instance.exports;
  const image = 0x400000, thunk = 0x7500000, msg = 0x520000, stack = 0x510000, hwnd = 0x10001;
  const names = ['PeekMessageA', 'GetMessageA', 'GetKeyState'];
  e.init_thread(0, image, image, 0x600000, thunk, thunk + names.length * 8, names.length, 0);
  names.forEach((name, i) => view.setUint32(regions.BASE.THUNK_BASE + i * 8 + 4, apis.find(a => a.name === name).id, true));
  e.set_hwnd_base(hwnd + 1); e.wnd_table_set(hwnd, 0x401000); e.wnd_set_style_export(hwnd, 0x10000000);
  const wa = g => g - image + e.get_guest_base();
  // WndProc at 0x401000: xor eax,eax; ret 16 -- whatever USER sends it returns 0.
  [0x31, 0xC0, 0xC2, 0x10, 0x00].forEach((b, i) => view.setUint8(wa(0x401000) + i, b));
  const invoke = (index, args) => {
    [0, ...args].forEach((n, i) => view.setUint32(wa(stack) + i * 4, n, true));
    e.clear_yield(); e.set_esp(stack); e.set_eip(thunk + index * 8); e.run(100);
    assert.strictEqual(e.get_eip(), 0, `${names[index]} returned to sentinel`);
    return e.get_eax() >>> 0;
  };
  const peek = remove => { const ok = invoke(0, [msg, 0, 0, 0, remove]); return ok ? view.getUint32(wa(msg) + 4, true) : 0; };
  const get = () => { invoke(1, [msg, 0, 0, 0]); return view.getUint32(wa(msg) + 4, true); };
  const down = vk => (invoke(2, [vk]) & 0x8000) !== 0;
  const lp = 0x00080008;

  // A quick click, both edges queued before the program looks.
  pending.push([hwnd, 0x201, 0x0001, lp], [hwnd, 0x202, 0x0000, lp]);
  assert.strictEqual(down(1), false, 'nothing retrieved yet');
  assert.strictEqual(peek(0), 0x201, 'peek sees the down');
  assert.strictEqual(down(1), false, 'PM_NOREMOVE does not update the key state');
  assert.strictEqual(peek(1), 0x201, 'PM_REMOVE takes the down');
  assert.strictEqual(down(1), true, 'VK_LBUTTON is down while the down is handled');
  assert.strictEqual(down(2), false, 'VK_RBUTTON stays up');
  assert.strictEqual(get(), 0x202, 'GetMessage takes the up');
  assert.strictEqual(down(1), false, 'VK_LBUTTON is up after its WM_LBUTTONUP');
  console.log('PASS  PeekMessage(PM_REMOVE)/GetMessage drive GetKeyState(VK_LBUTTON)');

  // Right and middle buttons through GetMessage; a move carries the flags.
  pending.push([hwnd, 0x204, 0x0002, lp], [hwnd, 0x200, 0x0012, lp], [hwnd, 0x205, 0x0010, lp], [hwnd, 0x208, 0, lp]);
  assert.strictEqual(get(), 0x204);
  assert.deepStrictEqual([down(1), down(2), down(4)], [false, true, false], 'right down');
  assert.strictEqual(get(), 0x200);
  assert.deepStrictEqual([down(1), down(2), down(4)], [false, true, true], 'move with MK_RBUTTON|MK_MBUTTON');
  assert.strictEqual(get(), 0x205);
  assert.deepStrictEqual([down(2), down(4)], [false, true], 'right up, middle still down');
  assert.strictEqual(get(), 0x208);
  assert.deepStrictEqual([down(2), down(4)], [false, false], 'middle up');
  // Keyboard keys are not mouse buttons: no flags leak into them.
  pending.push([hwnd, 0x201, 0x0001, lp]);
  assert.strictEqual(get(), 0x201);
  assert.deepStrictEqual([down(0x10), down(0x41), down(1)], [false, false, true], 'only the button VK');
  console.log('PASS  right/middle buttons and mouse-move flags; keyboard VKs unaffected');
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
