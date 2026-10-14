#!/usr/bin/env node
'use strict';

// Microsoft documents SetCurrentPosition as a secondary-buffer operation.
// A stopped buffer remembers the byte for its next Play; a live buffer moves
// immediately and continues. Exercise the WAT-to-browser voice boundary so a
// constant-success stub cannot satisfy this test.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_dsbuf_create") (param $caps i32) (result i32)
    (local $obj i32) (local $entry i32) (local $state i32)
    (local.set $obj
      (call $dx_create_com_obj (i32.const 5) (global.get $DX_VTBL_DSBUF)))
    (local.set $entry (call $dx_from_this (local.get $obj)))
    (local.set $state (call $dx_surf_state_ptr (local.get $entry)))
    (i32.store offset=4 (local.get $state) (local.get $caps))
    (i32.store offset=12 (local.get $entry) (i32.const 64))
    (store.field DxObject bpp (local.get $entry) (i32.const 1))
    (store.field DxObject pitch (local.get $entry) (i32.const 8))
    (store.field DxObject misc1 (local.get $entry) (global.get $STRING_CONSTANTS))
    (store.field DxObject misc2 (local.get $entry) (i32.const 1000))
    (local.get $obj))

  (func (export "test_ds_create_root") (result i32)
    (call $dx_create_com_obj (i32.const 4) (global.get $DX_VTBL_DSOUND)))

  (func (export "test_dsbuf_data_address") (result i32)
    (global.get $STRING_CONSTANTS))

  (func (export "test_dsbuf_set_position")
      (param $this i32) (param $position i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_IDirectSoundBuffer_SetCurrentPosition
      (local.get $this) (local.get $position)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_dsbuf_get_position")
      (param $this i32) (param $play i32) (param $write i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_IDirectSoundBuffer_GetCurrentPosition
      (local.get $this) (local.get $play) (local.get $write)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_dsbuf_play")
      (param $this i32) (param $flags i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_IDirectSoundBuffer_Play
      (local.get $this) (i32.const 0) (i32.const 0) (local.get $flags)
      (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_dsbuf_stop") (param $this i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_IDirectSoundBuffer_Stop
      (local.get $this) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  // Use the actual host voice manager. A mocked relative cursor hides the
  // difference between a looping ring and a one-shot truncated snapshot.
  const { exports: wat, memory, hostCtx, host } = await bootRenderHarness({ extraWat, fonts: 'none' });
  let clockMs = 1000;
  hostCtx.audioClockMs = () => clockMs;
  const exe = fs.readFileSync(path.join(__dirname, 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(exe, wat.get_staging());
  assert(wat.load_pe(exe.length), 'fixture PE initializes DirectSound vtables');
  wat.init_dx_com_thunks();
  const playOut = wat.guest_alloc(4) >>> 0;
  const writeOut = wat.guest_alloc(4) >>> 0;
  const secondary = wat.test_dsbuf_create(0) >>> 0;
  const primary = wat.test_dsbuf_create(1) >>> 0;
  const root = wat.test_ds_create_root() >>> 0;
  const position = (expected, label) => {
    assert.strictEqual(wat.test_dsbuf_get_position(secondary, playOut, writeOut) >>> 0, 0);
    assert.strictEqual(wat.guest_read32(playOut) >>> 0, expected, label);
    assert.strictEqual(wat.guest_read32(writeOut) >>> 0, (expected + 15) % 64, label + ' write lead');
  };
  position(0, 'initial stopped cursor');
  assert.strictEqual(wat.test_dsbuf_set_position(secondary, 16) >>> 0, 0);
  position(16, 'stopped secondary remembers its requested cursor');
  assert.strictEqual(wat.test_dsbuf_set_position(secondary, 64) >>> 0, 0x80070057);
  assert.strictEqual(wat.test_dsbuf_set_position(primary, 0) >>> 0, 0x88780032);
  assert.strictEqual(wat.test_dsbuf_set_position(root, 0) >>> 0, 0x80070057);

  assert.strictEqual(wat.test_dsbuf_play(secondary, 0) >>> 0, 0);
  position(16, 'one-shot starts at stored offset');
  clockMs += 5;
  position(21, 'one-shot elapsed cursor includes its origin once');
  assert.strictEqual(wat.test_dsbuf_set_position(secondary, 24) >>> 0, 0);
  position(24, 'live one-shot seek');
  clockMs += 6;
  assert.strictEqual(wat.test_dsbuf_stop(secondary) >>> 0, 0);
  clockMs += 40;
  position(30, 'one-shot Stop freezes the live position');

  assert.strictEqual(wat.test_dsbuf_play(secondary, 1) >>> 0, 0);
  position(30, 'loop starts at nonzero offset without doubling it');
  clockMs += 5;
  position(35, 'loop advances in full ring');
  assert.strictEqual(wat.test_dsbuf_set_position(secondary, 48) >>> 0, 0);
  position(48, 'live looping seek preserves nonzero target');
  clockMs += 20;
  position(4, 'loop wraps through the complete ring');
  assert.strictEqual(wat.test_dsbuf_stop(secondary) >>> 0, 0);
  clockMs += 200;
  position(4, 'loop Stop freezes absolute cursor without adding origin');
  assert.strictEqual(wat.test_dsbuf_play(secondary, 1) >>> 0, 0);
  position(4, 'loop resumes at frozen position');
  clockMs += 7;
  position(11, 'resumed loop advances');
  assert.strictEqual(wat.test_dsbuf_set_position(secondary, 0) >>> 0, 0);
  position(0, 'loop rewind');
  clockMs += 65;
  position(1, 'zero-origin loop wraps');
  assert.strictEqual(wat.test_dsbuf_stop(secondary) >>> 0, 0);
  assert.strictEqual(wat.test_dsbuf_set_position(secondary, 48) >>> 0, 0);
  assert.strictEqual(wat.test_dsbuf_play(secondary, 0) >>> 0, 0);
  clockMs += 20;
  position(0, 'one-shot end reaches buffer boundary modulo buffer length');
  for (const id of Object.keys(hostCtx._voices._map)) host.voice_close(Number(id));
  console.log('PASS DirectSound real host/WAT stopped, one-shot and looping cursor boundary');
})().catch(error => { console.error(error); process.exit(1); });
