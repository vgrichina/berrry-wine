#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_make_tick_thunk") (param $name i32) (result i32)
    (local $idx i32) (local $wa i32)
    (local.set $idx (call $thunk_reserve))
    (local.set $wa (i32.add (global.get $THUNK_BASE) (i32.mul (local.get $idx) (i32.const 8))))
    (i32.store (local.get $wa) (i32.sub (call $g2w (local.get $name)) (global.get $GUEST_BASE)))
    (i32.store offset=4 (local.get $wa) (global.get $API_ID_GetTickCount))
    (global.set $num_thunks (i32.add (local.get $idx) (i32.const 1)))
    (call $update_thunk_end)
    (i32.add (global.get $thunk_guest_base) (i32.mul (local.get $idx) (i32.const 8))))

  (func (export "test_clear_showwindow_thunks")
    (global.set $createwnd_move_thunk (i32.const 0))
    (global.set $createwnd_size_thunk (i32.const 0))
    (global.set $createwnd_size_ret_thunk (i32.const 0))
    (global.set $enum_child_thunk (i32.const 0)))
  (func (export "test_get_createwnd_move_thunk") (result i32)
    (global.get $createwnd_move_thunk))
  (func (export "test_get_createwnd_size_thunk") (result i32)
    (global.get $createwnd_size_thunk))
  (func (export "test_get_createwnd_size_ret_thunk") (result i32)
    (global.get $createwnd_size_ret_thunk))
  (func (export "test_get_enum_child_thunk") (result i32)
    (global.get $enum_child_thunk))

  ;; Continuations a guest thread calls through: EnumZBufferFormats (Rayman 2's
  ;; renderer enumerates from its game thread), qsort and LineDDA.
  (func (export "test_get_late_thunks") (param $i i32) (result i32)
    (if (result i32) (i32.eq (local.get $i) (i32.const 0)) (then (global.get $d3d_enum_zbuf_thunk))
      (else (if (result i32) (i32.eq (local.get $i) (i32.const 1)) (then (global.get $qsort_thunk))
        (else (global.get $line_dda_ret_thunk))))))
  (func (export "test_clear_late_thunks")
    (global.set $d3d_enum_zbuf_thunk (i32.const 0))
    (global.set $qsort_thunk (i32.const 0))
    (global.set $line_dda_ret_thunk (i32.const 0)))
`;

(async () => {
  let onTick = null;
  let ticks = 1000;
  const { exports: wat, memory, module, host } = await bootRenderHarness({
    extraWat, fonts: 'none', extraHostOverrides: {
      get_ticks: () => { if (onTick) onTick(); return ++ticks; },
    },
  });
  const fixture = fs.readFileSync(path.join(__dirname, 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, wat.get_staging());
  assert(wat.load_pe(fixture.length), 'fixture PE initializes continuation thunks');

  const move = wat.test_get_createwnd_move_thunk() >>> 0;
  const size = wat.test_get_createwnd_size_thunk() >>> 0;
  const sizeRet = wat.test_get_createwnd_size_ret_thunk() >>> 0;
  assert(sizeRet && sizeRet !== size, 'final SIZE has a distinct completion thunk');
  const enumChild = wat.test_get_enum_child_thunk() >>> 0;
  assert(move && size && enumChild && move !== size && size !== enumChild,
    'main instance has distinct window and EnumChildWindows continuation thunks');

  wat.test_clear_showwindow_thunks();
  assert.strictEqual(wat.test_get_createwnd_move_thunk() >>> 0, 0);
  assert.strictEqual(wat.test_get_createwnd_size_thunk() >>> 0, 0);
  assert.strictEqual(wat.test_get_createwnd_size_ret_thunk() >>> 0, 0);
  wat.sync_thunk_state(wat.get_thunk_end(), wat.get_num_thunks());

  assert.strictEqual(wat.test_get_createwnd_move_thunk() >>> 0, move,
    'worker thunk sync restores CACA0024 as the WM_MOVE continuation');
  assert.strictEqual(wat.test_get_createwnd_size_thunk() >>> 0, size,
    'worker thunk sync restores CACA0031 as the WM_SIZE continuation');
  assert.strictEqual(wat.test_get_createwnd_size_ret_thunk() >>> 0, sizeRet,
    'worker thunk sync restores CACA003D as the final WM_SIZE completion');
  assert.strictEqual(wat.test_get_enum_child_thunk() >>> 0, enumChild,
    'worker thunk sync restores CACA002B as the EnumChildWindows continuation');
  const late = [0, 1, 2].map(i => wat.test_get_late_thunks(i) >>> 0);
  assert(late.every(Boolean), 'main instance has the EnumZBufferFormats, qsort and LineDDA continuations');
  wat.test_clear_late_thunks();
  wat.sync_thunk_state(wat.get_thunk_end(), wat.get_num_thunks());
  assert.deepStrictEqual([0, 1, 2].map(i => wat.test_get_late_thunks(i) >>> 0), late,
    'worker thunk sync restores CACA000D (EnumZBufferFormats), CACA002D (qsort) and CACA0012 (LineDDA)');

  // Every continuation the PE loader allocates must be rebuilt on a guest
  // thread, or a callback returns to address 0 there. Read both tables from
  // source so a new thunk cannot be added to one and forgotten in the other.
  {
    const src = name => fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8');
    const loader = new Map();
    for (const m of src('08-pe-loader.wat').matchAll(
      /\(global\.set \$([a-z0-9_]+) \(i32\.add[\s\S]{0,400}?\(i32\.const (0xCACA[0-9A-F]{4})\)\)/g)) {
      loader.set(m[2], m[1]);
    }
    const synced = new Set();
    for (const m of src('13-exports.wat').matchAll(
      /\(i32\.eq \(local\.get \$marker\) \(i32\.const (0xCACA[0-9A-F]{4})\)\)/g)) synced.add(m[1]);
    assert(loader.size >= 30, 'loader thunk allocations parsed (' + loader.size + ')');
    const missing = [...loader].filter(([marker]) => !synced.has(marker)).map(([m, g]) => m + ' ' + g);
    assert.deepStrictEqual(missing, [], 'every loader-allocated thunk is rebuilt by the thread sync');
  }

  // The producer allocates during the consumer's first API call. Its next
  // indirect CALL happens in the SAME run(), with no host thunk-state sync.
  const name = wat.guest_alloc(32);
  [...Buffer.from('\0\0GetTickCount\0')].forEach((v, i) => wat.guest_write8(name + i, v));
  const initialThunk = wat.test_make_tick_thunk(name) >>> 0;
  const consumer = (await WebAssembly.instantiate(module, { host })).exports;
  consumer.init_thread(1, wat.get_image_base(), wat.get_code_start(), wat.get_code_end(),
    wat.get_thunk_base(), wat.get_thunk_end(), wat.get_num_thunks(), 0);
  const oldEnd = consumer.get_thunk_end() >>> 0;
  const slot = wat.guest_alloc(4);
  const stack = wat.guest_alloc(256) + 128;
  const code = wat.guest_alloc(64);
  const bytes = Buffer.alloc(14);
  bytes[0] = 0xb8; bytes.writeUInt32LE(initialThunk, 1); // mov eax, old thunk
  bytes[5] = 0xff; bytes[6] = 0xd0;                   // call eax
  bytes[7] = 0xff; bytes[8] = 0x15; bytes.writeUInt32LE(slot, 9); // call [slot]
  bytes[13] = 0xc3;
  [...bytes].forEach((v, i) => wat.guest_write8(code + i, v));
  wat.guest_write32(stack, 0);
  let newlyPublished = 0;
  onTick = () => {
    onTick = null;
    newlyPublished = wat.test_make_tick_thunk(name) >>> 0;
    assert(newlyPublished >= oldEnd, 'new thunk is beyond consumer cached end');
    wat.guest_write32(slot, newlyPublished);
  };
  consumer.set_eip(code);
  consumer.set_esp(stack);
  consumer.clear_yield();
  consumer.run(100);
  assert(newlyPublished, 'producer published from inside consumer run');
  assert.strictEqual(consumer.get_eax(), 1002, 'both API calls dispatch in the same slice');
  assert.strictEqual(consumer.get_esp() >>> 0, stack + 4, 'stdcall and final RET preserve stack');
  assert.strictEqual(consumer.get_num_thunks(), wat.get_num_thunks(), 'adopts shared count');
  assert.strictEqual(consumer.get_thunk_end(), wat.get_thunk_end(), 'adopts shared bound');
  console.log('PASS worker window continuation sync and same-slice dynamic thunk publication');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
