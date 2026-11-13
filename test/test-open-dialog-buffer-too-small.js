#!/usr/bin/env node
'use strict';

// A browser Worker owns the parked GetOpenFileName/GetSaveFileName call while
// the renderer shadow dispatches the WAT-native Open/Save button. Pin both the
// documented small-buffer result and the A/W spelling across that boundary.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated.js');

const extraWat = String.raw`
  (global $test_open_ofn (mut i32) (i32.const 0))
  (global $test_open_buf (mut i32) (i32.const 0))
  (global $test_open_dlg (mut i32) (i32.const 0))

  (func (export "test_open_begin") (param $wide i32) (param $max i32) (result i32)
    (global.set $test_open_ofn (call $heap_alloc (i32.const 76)))
    (global.set $test_open_buf (call $heap_alloc (i32.const 64)))
    (call $zero_memory (call $g2w (global.get $test_open_ofn)) (i32.const 76))
    (memory.fill (call $g2w (global.get $test_open_buf)) (i32.const 0xA5) (i32.const 64))
    (call $gs32 (global.get $test_open_ofn) (i32.const 76))
    (call $gs32 (i32.add (global.get $test_open_ofn) (i32.const 28))
      (global.get $test_open_buf))
    (call $gs32 (i32.add (global.get $test_open_ofn) (i32.const 32)) (local.get $max))
    (global.set $common_dialog_error (i32.const 0))
    (global.set $opendlg_wide (local.get $wide))
    (global.set $test_open_dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $create_open_dialog (global.get $test_open_dlg) (i32.const 0)
      (i32.const 0) (global.get $test_open_ofn))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00120000))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x00401000))
    (call $modal_begin (global.get $test_open_dlg) (i32.const 8))
    (global.get $test_open_dlg))

  (func (export "test_open_accept") (param $dlg i32) (param $text i32)
    (local $edit i32)
    (local.set $edit (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x442)))
    (drop (call $wnd_send_message (local.get $edit) (i32.const 0x000C)
      (i32.const 0) (local.get $text)))
    (drop (call $wnd_send_message (local.get $dlg) (i32.const 0x0111)
      (i32.const 1) (i32.const 0))))

  (func (export "test_open_pump") (result i32)
    (call $modal_pump_step (global.get $modal_loop_thunk)))
  (func (export "test_open_result") (result i32) (global.get $modal_result))
  (func (export "test_open_error") (result i32) (global.get $common_dialog_error))
  (func (export "test_open_buf") (result i32) (global.get $test_open_buf))
  (func (export "test_open_file_offset") (result i32)
    (i32.load16_u (call $g2w (i32.add (global.get $test_open_ofn) (i32.const 56)))))
  (func (export "test_open_extension_offset") (result i32)
    (i32.load16_u (call $g2w (i32.add (global.get $test_open_ofn) (i32.const 58)))))

  (func (export "test_save_public") (param $ofn i32) (param $wide i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00120000))
    (call $gs32 (i32.const 0x00120000) (i32.const 0x00401000))
    (if (local.get $wide)
      (then (call $handle_GetSaveFileNameW (local.get $ofn) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
      (else (call $handle_GetSaveFileNameA (local.get $ofn) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (global.get $modal_dlg_hwnd))
  (func (export "test_filename_edit") (param $dlg i32) (result i32)
    (call $ctrl_find_by_id (local.get $dlg) (i32.const 0x442)))
`;

function writeAscii(exports, memory, text) {
  const ptr = exports.guest_alloc(text.length + 1) >>> 0;
  const wa = RegionMap.g2w(ptr, exports.get_image_base());
  const bytes = new Uint8Array(memory.buffer);
  for (let i = 0; i < text.length; i++) bytes[wa + i] = text.charCodeAt(i);
  bytes[wa + text.length] = 0;
  return ptr;
}

async function makePair() {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const worker = await bootRenderHarness({ extraWat, memory, fonts: 'none' });
  const shadow = await bootRenderHarness({ extraWat, memory, fonts: 'none' });
  return { memory, guest: worker.exports, ui: shadow.exports };
}

(async () => {
  // lpstrFile is input as well as output. A caller's proposed save name must
  // appear in the native edit, survive Cancel unchanged, and be accepted by
  // Save without having to retype it. Exercise the public A/W handlers and
  // the same shared controls used by renderer-side interaction.
  for (const wide of [0, 1]) {
    const { memory, guest, ui } = await makePair();
    const ofn = guest.guest_alloc(76) >>> 0;
    const buf = guest.guest_alloc(128) >>> 0;
    const out = guest.guest_alloc(128) >>> 0;
    for (let i = 0; i < 76; i++) guest.guest_write8(ofn + i, 0);
    for (let i = 0; i < 128; i++) guest.guest_write8(buf + i, 0);
    guest.guest_write32(ofn, 76);
    guest.guest_write32(ofn + 28, buf);
    guest.guest_write32(ofn + 32, 64);
    const initial = Buffer.from('history.pgn\0', wide ? 'utf16le' : 'latin1');
    initial.forEach((b, i) => guest.guest_write8(buf + i, b));
    const snapshot = () => Buffer.from(Array.from({ length: 128 }, (_, i) => guest.guest_read8(buf + i)));
    const before = snapshot();
    let dlg = guest.test_save_public(ofn, wide) >>> 0;
    const edit = ui.test_filename_edit(dlg) >>> 0;
    assert(edit, 'public Save As creates its filename edit');
    ui.send_message(edit, 0x000D, 128, out);
    const displayed = Buffer.from(Array.from({ length: 128 }, (_, i) => ui.guest_read8(out + i)))
      .toString('latin1').replace(/\0.*$/, '');
    assert.strictEqual(displayed, 'history.pgn',
      `Save As ${wide ? 'W' : 'A'} displays the caller-supplied filename`);
    assert.deepStrictEqual(snapshot(), before, 'opening does not alter the caller buffer');
    ui.send_message(edit, 0x00B1, 0, -1); // EM_SETSEL: replace the proposed name
    ui.send_message(edit, 0x0102, 'x'.charCodeAt(0), 1); // native EDIT WM_CHAR
    assert.strictEqual(ui.send_message(edit, 0x000E, 0, 0), 1,
      'native filename editing replaces the selected proposed name');
    assert.deepStrictEqual(snapshot(), before, 'editing uses a private copy until Save');
    ui.dialog_handle_key(dlg, 27, 0);
    assert.strictEqual(guest.test_open_pump(), 0, 'Cancel resumes the owning modal');
    assert.strictEqual(guest.test_open_result(), 0);
    assert.strictEqual(guest.test_open_error(), 0, 'Cancel is not an extended error');
    assert.deepStrictEqual(snapshot(), before, 'Cancel preserves the caller buffer');

    dlg = guest.test_save_public(ofn, wide) >>> 0;
    ui.dialog_handle_key(dlg, 13, 0);
    assert.strictEqual(guest.test_open_pump(), 0, 'Save resumes the owning modal');
    assert.strictEqual(guest.test_open_result(), 1);
    const saved = snapshot().toString(wide ? 'utf16le' : 'latin1').replace(/\0.*$/, '');
    assert.strictEqual(saved, 'C:\\history.pgn', 'Save accepts the proposed filename');
  }

  for (const wide of [0, 1]) {
    const { memory, guest, ui } = await makePair();
    const dlg = guest.test_open_begin(wide, 4) >>> 0;
    const text = writeAscii(guest, memory, 'abcdef');
    ui.test_open_accept(dlg, text);

    assert.strictEqual(guest.test_open_error(), 0,
      'renderer shadow cannot mutate the owning Worker private error state');
    assert.strictEqual(guest.test_open_pump(), 0,
      'owning Worker consumes the rejected selection and closes the modal');
    assert.strictEqual(guest.test_open_result(), 0,
      'a too-small lpstrFile buffer returns FALSE');
    assert.strictEqual(guest.test_open_error() >>> 0, 0x3003,
      'CommDlgExtendedError reports FNERR_BUFFERTOOSMALL');

    const bufWa = RegionMap.g2w(guest.test_open_buf() >>> 0, guest.get_image_base());
    const view = new DataView(memory.buffer);
    assert.strictEqual(view.getUint16(bufWa, true), 10,
      'the first two lpstrFile bytes contain the required character count');
    assert.strictEqual(view.getUint8(bufWa + 2), 0xA5,
      'failure does not copy a truncated filename after the required-size word');
  }

  // A successful W call clicked in the ANSI-default renderer shadow must still
  // write UTF-16, proving that the dialog-owned A/W tag crossed instances.
  {
    const { memory, guest, ui } = await makePair();
    const dlg = guest.test_open_begin(1, 16) >>> 0;
    const text = writeAscii(guest, memory, 'ABC');
    ui.test_open_accept(dlg, text);
    assert.strictEqual(guest.test_open_pump(), 0);
    assert.strictEqual(guest.test_open_result(), 1);
    assert.strictEqual(guest.test_open_error(), 0);
    const bufWa = RegionMap.g2w(guest.test_open_buf() >>> 0, guest.get_image_base());
    assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer, bufWa, 14)),
      [0x43, 0, 0x3A, 0, 0x5C, 0, 0x41, 0, 0x42, 0, 0x43, 0, 0, 0],
      'renderer-shadow acceptance preserves the full GetOpenFileNameW UTF-16 path');
    assert.strictEqual(guest.test_open_file_offset(), 3,
      'nFileOffset points past the root directory');
    assert.strictEqual(guest.test_open_extension_offset(), 0,
      'nFileExtension is zero when the selected leaf has no extension');
  }

  // ANSI success returns the full path and publishes both documented offsets.
  {
    const { memory, guest, ui } = await makePair();
    const dlg = guest.test_open_begin(0, 32) >>> 0;
    const text = writeAscii(guest, memory, 'report.txt');
    ui.test_open_accept(dlg, text);
    assert.strictEqual(guest.test_open_pump(), 0);
    assert.strictEqual(guest.test_open_result(), 1);
    const bufWa = RegionMap.g2w(guest.test_open_buf() >>> 0, guest.get_image_base());
    const bytes = new Uint8Array(memory.buffer, bufWa, 14);
    assert.strictEqual(Buffer.from(bytes).toString('latin1').replace(/\0.*$/, ''),
      'C:\\report.txt', 'GetOpenFileNameA returns drive, path, leaf, and extension');
    assert.strictEqual(guest.test_open_file_offset(), 3);
    assert.strictEqual(guest.test_open_extension_offset(), 10);
  }

  console.log('PASS  Open/Save proposed names, cancellation, and atomic overflow cross the Worker modal bridge');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
