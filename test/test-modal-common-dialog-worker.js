#!/usr/bin/env node
'use strict';

// Browser Worker mode has two WebAssembly instances over one process memory:
// the guest Worker owns the parked MessageBox call, while the main-thread
// renderer shadow hit-tests and dispatches its WAT-built button. Private WASM
// globals cannot carry modal completion between those instances.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_seed_completion") (param $seed i32)
    (global.set $modal_result (local.get $seed))
    (global.set $modal_ret_addr (i32.add (i32.const 0x401000) (local.get $seed)))
    (global.set $modal_saved_esp (i32.add (i32.const 0x120000) (local.get $seed)))
    (global.set $modal_esp_adjust (i32.add (i32.const 20) (local.get $seed)))
    (global.set $modal_restore_pending (i32.eqz (local.get $seed)))
    (global.set $modal_saved_ebx (i32.add (i32.const 11) (local.get $seed)))
    (global.set $modal_saved_esi (i32.add (i32.const 22) (local.get $seed)))
    (global.set $modal_saved_edi (i32.add (i32.const 33) (local.get $seed)))
    (global.set $modal_saved_ebp (i32.add (i32.const 44) (local.get $seed))))
  (func (export "test_restore_pending") (result i32) (global.get $modal_restore_pending))
  (func (export "test_complete_api")
    (i32.store (global.get $THUNK_BASE) (i32.const 0xCACA0006))
    (call $win32_dispatch (i32.const 0)))
  (func (export "test_modal_begin") (param $hwnd i32) (param $stack i32) (param $ret i32)
    ;; Each parked API owns a live window generation and a real guest frame.
    ;; Reusing this numeric HWND after destruction must acquire a new lease.
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (i32.store offset=12 (global.get $reg_base) (i32.const 11))
    (i32.store offset=24 (global.get $reg_base) (i32.const 22))
    (i32.store offset=28 (global.get $reg_base) (i32.const 33))
    (i32.store offset=20 (global.get $reg_base) (i32.const 44))
    (call $gs32 (local.get $stack) (local.get $ret))
    (call $modal_begin (local.get $hwnd) (i32.const 20)))

  (func (export "test_modal_done") (param $result i32)
    (call $modal_done (local.get $result)))

  (func (export "test_modal_pump") (result i32)
    (call $modal_pump_step (global.get $modal_loop_thunk)))

  (func (export "test_modal_result") (result i32)
    (global.get $modal_result))
`;

(async () => {
  const memory = new WebAssembly.Memory({
    initial: 8192, maximum: 8192, shared: true,
  });
  let onDestroy = () => {};
  const worker = await bootRenderHarness({ extraWat, memory,
    extraHostOverrides: { destroy_window: hwnd => onDestroy(hwnd) } });
  const shadow = await bootRenderHarness({ extraWat, memory });
  const guest = worker.exports;
  const ui = shadow.exports;
  const pe = fs.readFileSync(path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe, guest.get_staging());
  assert(guest.load_pe(pe.length), 'loader initializes real guest continuation thunks');
  const stack = guest.guest_alloc(4096) + 2048;
  const ret = guest.guest_alloc(16);
  const begin = () => { guest.clear_yield(); guest.test_modal_begin(hwnd, stack, ret); };
  const returned = result => {
    assert.strictEqual(guest.get_eax(), result);
    assert.strictEqual(guest.get_eip(), ret);
    assert.strictEqual(guest.get_esp(), stack + 20);
    assert.deepStrictEqual([guest.get_ebx(), guest.get_esi(), guest.get_edi(), guest.get_ebp()],
      [11, 22, 33, 44], 'outer nonvolatile registers survive nested completion');
    assert.strictEqual(guest.test_restore_pending(), 0);
  };
  const hwnd = 0x10002;

  begin();
  assert.strictEqual(guest.modal_dialog_hwnd() >>> 0, hwnd,
    'guest Worker publishes its common-modal hwnd');
  assert.strictEqual(ui.modal_dialog_hwnd() >>> 0, hwnd,
    'renderer shadow observes the Worker modal through shared memory');

  assert.strictEqual(guest.test_modal_pump(), 1, 'open modal remains in its pump');
  assert.strictEqual(guest.get_yield_reason(), 15, 'idle native modal uses queue sleep');
  guest.clear_yield();

  ui.test_modal_done(1);
  assert.strictEqual(ui.modal_dialog_hwnd() >>> 0, hwnd,
    'shadow only signals completion; the owning Worker performs teardown');
  assert.strictEqual(guest.test_modal_pump(), 1,
    'owning Worker consumes completion and splices its retained API frame');
  returned(1);
  assert.strictEqual(guest.test_modal_result(), 1,
    'MessageBox returns the button result in the owning instance');
  assert.strictEqual(guest.modal_dialog_hwnd(), 0,
    'Worker teardown clears the shared modal hwnd for the renderer');

  begin();
  ui.modal_cancel_if_hwnd(hwnd);
  assert.strictEqual(guest.test_modal_pump(), 1,
    'renderer-side cancellation also splices the owning Worker frame');
  returned(0);
  assert.strictEqual(guest.test_modal_result(), 0,
    'renderer-side cancellation preserves the cancel result');

  // A reentrant teardown can finish another dialog on the same instance.
  // Inject its continuation writes, then exercise the actual CACA0006 return.
  for (const fromShadow of [false, true]) {
    begin();
    let reentries = 0;
    onDestroy = target => {
      assert.strictEqual(target >>> 0, hwnd);
      reentries++;
      guest.test_seed_completion(256);
    };
    (fromShadow ? ui : guest).test_modal_done(42);
    if (!fromShadow) assert.strictEqual(guest.test_restore_pending(), 1,
      'local completion keeps the frame until the owning pump resumes it');
    guest.test_complete_api();
    assert.strictEqual(reentries, 1);
    assert.strictEqual(guest.test_modal_result(), 42, 'outer completion owns the result');
    returned(42);
  }
  console.log('PASS  common modal Worker completion and reentrant API frame ownership');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
