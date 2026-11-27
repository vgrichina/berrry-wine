#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_mixer_open") (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_mixerOpen
      (local.get $out) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_mixer_open_device") (param $out i32) (param $device i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_mixerOpen
      (local.get $out) (local.get $device) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_mixer_close") (param $handle i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_mixerClose
      (local.get $handle) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_mixer_get_dev_caps_a") (param $device i32) (param $out i32) (param $cb i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_mixerGetDevCapsA
      (local.get $device) (local.get $out) (local.get $cb)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_mixer_get_dev_caps_w") (param $device i32) (param $out i32) (param $cb i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_mixerGetDevCapsW
      (local.get $device) (local.get $out) (local.get $cb)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_mixer_get_line_info_a") (param $object i32) (param $line i32) (param $flags i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_mixerGetLineInfoA
      (local.get $object) (local.get $line) (local.get $flags)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_mixer_get_line_info_w") (param $object i32) (param $line i32) (param $flags i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_mixerGetLineInfoW
      (local.get $object) (local.get $line) (local.get $flags)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_mixer_get_line_controls_a") (param $object i32) (param $controls i32) (param $flags i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_mixerGetLineControlsA
      (local.get $object) (local.get $controls) (local.get $flags)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_mixer_get_line_controls_w") (param $object i32) (param $controls i32) (param $flags i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_mixerGetLineControlsW
      (local.get $object) (local.get $controls) (local.get $flags)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_mixer_message") (param $device i32) (param $message i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_mixerMessage
      (local.get $device) (local.get $message) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_mixer_get_control_details_a") (param $hmx i32) (param $pmxcd i32) (param $flags i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_mixerGetControlDetailsA
      (local.get $hmx) (local.get $pmxcd) (local.get $flags)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_mixer_get_control_details_w") (param $hmx i32) (param $pmxcd i32) (param $flags i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_mixerGetControlDetailsW
      (local.get $hmx) (local.get $pmxcd) (local.get $flags)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_mixer_set_control_details") (param $hmx i32) (param $pmxcd i32) (param $flags i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_mixerSetControlDetails
      (local.get $hmx) (local.get $pmxcd) (local.get $flags)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const calls = [];
  const { exports: e, memory } = await bootRenderHarness({
    extraWat,
    extraHostOverrides: {
      audio_mixer_get_volume: bus => {
        calls.push(['volume', bus]);
        return 0xBEEF1234 | 0;
      },
      audio_mixer_get_mute: bus => {
        calls.push(['mute', bus]);
        return 1;
      },
      audio_mixer_get_peak: bus => {
        calls.push(['peak', bus]);
        return 0x4321;
      },
      audio_mixer_set_volume: (bus, volume) => {
        calls.push(['set-volume', bus, volume >>> 0]);
      },
      audio_mixer_set_mute: (bus, mute) => {
        calls.push(['set-mute', bus, mute]);
      },
      midi_num_devs: () => 1,
    },
  });
  const imageBase = e.get_image_base() >>> 0;
  const pmxcdGuest = imageBase + 0x2600;
  const valuesGuest = imageBase + 0x2700;
  const pmxcd = e.guest_to_wasm(pmxcdGuest) >>> 0;
  const values = e.guest_to_wasm(valuesGuest) >>> 0;
  const dv = new DataView(memory.buffer);

  assert.strictEqual(e.test_mixer_open(0), 11,
    'mixerOpen rejects its required output pointer');
  const handleOutGuest = imageBase + 0x2500;
  const handleOut = e.guest_to_wasm(handleOutGuest) >>> 0;
  assert.strictEqual(e.test_mixer_open(handleOutGuest), 0,
    'first mixerOpen succeeds');
  const firstHandle = dv.getUint32(handleOut, true);
  assert.strictEqual(firstHandle, 0x00090001,
    'first mixer handle preserves the established value');
  assert.strictEqual(e.test_mixer_open(handleOutGuest), 0,
    'a second independent mixerOpen succeeds');
  const secondHandle = dv.getUint32(handleOut, true);
  assert.notStrictEqual(secondHandle, firstHandle,
    'separate opens receive distinct handles');
  assert.strictEqual(e.test_mixer_close(firstHandle), 0,
    'mixerClose retires a live handle');
  assert.strictEqual(e.test_mixer_close(firstHandle), 5,
    'a closed handle is no longer valid');
  assert.strictEqual(e.test_mixer_close(0x12345678), 5,
    'mixerClose rejects an arbitrary handle');

  dv.setUint32(handleOut, 0xA5A5A5A5, true);
  assert.strictEqual(e.test_mixer_open_device(handleOutGuest, 1), 2,
    'mixerOpen rejects an out-of-range device id');
  assert.strictEqual(dv.getUint32(handleOut, true), 0xA5A5A5A5,
    'a rejected open does not publish a handle');

  const capsGuest = imageBase + 0x2800;
  const caps = e.guest_to_wasm(capsGuest) >>> 0;
  assert.strictEqual(e.test_mixer_get_dev_caps_a(0, 0, 0), 0,
    'zero-length mixerGetDevCaps permits a null destination');
  assert.strictEqual(e.test_mixer_get_dev_caps_a(0, 0, 1), 11,
    'nonempty mixerGetDevCaps requires a destination');
  assert.strictEqual(e.test_mixer_get_dev_caps_a(1, capsGuest, 48), 2,
    'mixerGetDevCaps rejects an out-of-range device id');
  assert.strictEqual(e.test_mixer_get_dev_caps_a(firstHandle, capsGuest, 48), 5,
    'mixerGetDevCaps rejects a closed handle');
  for (let i = 0; i < 96; i++) dv.setUint8(caps + i, 0xA5);
  assert.strictEqual(e.test_mixer_get_dev_caps_a(secondHandle, capsGuest, 12), 0,
    'mixerGetDevCaps accepts a live mixer handle');
  assert.deepStrictEqual(Array.from(new Uint8Array(memory.buffer, caps, 12)),
    [1, 0, 1, 0, 0, 4, 0, 0, 0x57, 0x69, 0x6E, 0x65],
    'ANSI capability copy honors the requested prefix length');
  assert.strictEqual(dv.getUint8(caps + 12), 0xA5,
    'bounded capability copy does not overwrite the next byte');
  assert.strictEqual(e.test_mixer_get_dev_caps_w(0, capsGuest, 80), 0,
    'Unicode capability query accepts device id zero');
  assert.strictEqual(dv.getUint16(caps + 8, true), 0x57,
    'Unicode capability name is written as UTF-16');
  assert.strictEqual(dv.getUint32(caps + 76, true), 1,
    'Unicode capabilities report one destination');

  const lineGuest = imageBase + 0x2900;
  const line = e.guest_to_wasm(lineGuest) >>> 0;
  for (let i = 0; i < 280; i += 4) dv.setUint32(line + i, 0, true);
  dv.setUint32(line, 168, true);
  assert.strictEqual(e.test_mixer_get_line_info_a(0, lineGuest, 0), 0,
    'destination line query succeeds for mixer device zero');
  assert.strictEqual(dv.getUint32(line + 12, true), 0,
    'destination query returns the speaker line id');
  dv.setUint32(line, 168, true);
  dv.setUint32(line + 24, 0x1008, true);
  assert.strictEqual(e.test_mixer_get_line_info_a(secondHandle, lineGuest, 0x80000003), 0,
    'component query accepts a live HMIXER object');
  assert.strictEqual(dv.getUint32(line + 12, true), 1,
    'wave-output component query returns the Wave source');
  dv.setUint32(line, 167, true);
  assert.strictEqual(e.test_mixer_get_line_info_a(0, lineGuest, 0), 11,
    'line query validates MIXERLINEA.cbStruct');
  dv.setUint32(line, 168, true);
  assert.strictEqual(e.test_mixer_get_line_info_a(0, lineGuest, 0x10), 10,
    'line query rejects unknown flags');
  dv.setUint32(line + 24, 0x1008, true);
  assert.strictEqual(e.test_mixer_get_line_info_a(0, lineGuest, 0x10000003), 0,
    'wave-output device zero resolves through its controlling mixer');
  assert.strictEqual(dv.getUint32(line + 12, true), 1,
    'wave-output device query resolves the Wave source');
  dv.setUint32(line, 168, true);
  dv.setUint32(line + 24, 0x1008, true);
  assert.strictEqual(e.test_mixer_get_line_info_a(1, lineGuest, 0x10000003), 2,
    'out-of-range wave-output device id is rejected');
  assert.strictEqual(e.test_mixer_get_line_info_a(0x12345678, lineGuest, 0x90000003), 5,
    'invalid HWAVEOUT is rejected');
  assert.strictEqual(e.test_mixer_get_line_info_a(0, lineGuest, 0x50000003), 6,
    'an AUX object reports no backing mixer driver');
  dv.setUint32(line + 24, 0x1004, true);
  assert.strictEqual(e.test_mixer_get_line_info_a(0, lineGuest, 0x30000003), 0,
    'the browser MIDI-output device resolves through its controlling mixer');
  assert.strictEqual(dv.getUint32(line + 12, true), 2,
    'MIDI-output device query resolves the MIDI source');
  for (let i = 0; i < 280; i += 4) dv.setUint32(line + i, 0, true);
  dv.setUint32(line, 280, true);
  dv.setUint32(line + 200, 3, true); // MIXERLINE_TARGETTYPE_MIDIOUT
  assert.strictEqual(e.test_mixer_get_line_info_w(secondHandle, lineGuest, 4), 0,
    'Unicode TARGETTYPE query accepts a live handle without the optional flag');
  assert.strictEqual(dv.getUint32(line + 12, true), 2,
    'MIDI target query returns the MIDI source line');

  const lineControlsGuest = imageBase + 0x2B00;
  const lineControls = e.guest_to_wasm(lineControlsGuest) >>> 0;
  const controlsGuest = imageBase + 0x2C00;
  const controls = e.guest_to_wasm(controlsGuest) >>> 0;
  for (let i = 0; i < 24; i += 4) dv.setUint32(lineControls + i, 0, true);
  dv.setUint32(lineControls, 24, true);
  dv.setUint32(lineControls + 4, 0, true);
  dv.setUint32(lineControls + 12, 3, true);
  dv.setUint32(lineControls + 16, 148, true);
  dv.setUint32(lineControls + 20, controlsGuest, true);
  assert.strictEqual(e.test_mixer_get_line_controls_a(secondHandle, lineControlsGuest, 0), 0,
    'ALL control query accepts the documented three-record buffer');
  assert.deepStrictEqual([
    dv.getUint32(controls + 4, true),
    dv.getUint32(controls + 148 + 4, true),
    dv.getUint32(controls + 296 + 4, true),
  ], [0x1000, 0x2000, 0x3000],
  'ALL control query returns volume, mute, and peak-meter controls');
  dv.setUint32(lineControls + 12, 2, true);
  assert.strictEqual(e.test_mixer_get_line_controls_a(secondHandle, lineControlsGuest, 0), 11,
    'ALL control query rejects an undersized record count');
  dv.setUint32(lineControls + 4, 2, true);
  dv.setUint32(lineControls + 8, 0x50030001, true);
  dv.setUint32(lineControls + 12, 1, true);
  dv.setUint32(lineControls + 16, 228, true);
  assert.strictEqual(e.test_mixer_get_line_controls_w(secondHandle, lineControlsGuest, 2), 0,
    'Unicode ONEBYTYPE query validates its distinct MIXERCONTROLW size');
  assert.strictEqual(dv.getUint32(controls + 4, true), 0x1002,
    'Unicode ONEBYTYPE query resolves the requested line and control type');
  dv.setUint32(lineControls + 16, 148, true);
  assert.strictEqual(e.test_mixer_get_line_controls_w(secondHandle, lineControlsGuest, 2), 11,
    'Unicode control query rejects the ANSI record size');

  // MIXERLINECONTROLS.dwLineID is an output for ONEBYID, even though its
  // input value is ignored. SndVol32 uses it to select the strip to refresh.
  // https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/ns-mmeapi-mixerlinecontrolsa
  for (const [getControls, size] of [
    [e.test_mixer_get_line_controls_a, 148],
    [e.test_mixer_get_line_controls_w, 228],
  ]) {
    for (const id of [0x1000, 0x1001, 0x1002, 0x2000, 0x2001, 0x2002, 0x3000, 0x3001, 0x3002]) {
      dv.setUint32(lineControls + 4, 0xDEADBEEF, true);
      dv.setUint32(lineControls + 8, id, true);
      dv.setUint32(lineControls + 16, size, true);
      assert.strictEqual(getControls(secondHandle, lineControlsGuest, 1), 0,
        `ONEBYID accepts control ${id.toString(16)} with an ignored input line`);
      assert.strictEqual(dv.getUint32(lineControls + 4, true), id & 0xFFF,
        'ONEBYID publishes the owning line for volume, mute, and peak refreshes');
      assert.strictEqual(dv.getUint32(controls + 4, true), id,
        'ONEBYID returns the requested control, independently of the input line');
    }
    dv.setUint32(lineControls + 4, 0xDEADBEEF, true);
    dv.setUint32(lineControls + 8, 0x3003, true);
    assert.strictEqual(getControls(secondHandle, lineControlsGuest, 1), 1025);
    assert.strictEqual(dv.getUint32(lineControls + 4, true), 0xDEADBEEF,
      'a rejected ONEBYID query does not publish a line');
  }

  assert.strictEqual(e.test_mixer_message(0, 0x3FFF), 11,
    'mixerMessage rejects messages below MXDM_USER');
  assert.strictEqual(e.test_mixer_message(0, 0x4000), 8,
    'the virtual mixer reports private driver messages unsupported');
  assert.strictEqual(e.test_mixer_message(secondHandle, 0x4000), 8,
    'mixerMessage does not misinterpret an HMIXER as device id zero');
  assert.strictEqual(e.test_mixer_message(0x12345678, 0x4000), 5,
    'mixerMessage rejects an arbitrary object');

  function prepare(controlId, channels) {
    for (let i = 0; i < 24; i += 4) dv.setUint32(pmxcd + i, 0, true);
    dv.setUint32(pmxcd, 24, true);             // cbStruct
    dv.setUint32(pmxcd + 4, controlId, true); // dwControlID
    dv.setUint32(pmxcd + 8, channels, true);  // cChannels
    dv.setUint32(pmxcd + 16, 4, true);        // cbDetails
    dv.setUint32(pmxcd + 20, valuesGuest, true);
    dv.setUint32(values, 0xAAAAAAAA, true);
    dv.setUint32(values + 4, 0xBBBBBBBB, true);
  }

  prepare(0x1001, 2);
  assert.strictEqual(e.test_mixer_get_control_details_a(secondHandle, pmxcdGuest, 0x80000000), 0,
    'ANSI VALUE query succeeds');
  assert.strictEqual(e.get_esp() >>> 0, 0x00300010,
    'ANSI entry point pops three stdcall arguments');
  assert.deepStrictEqual(calls.shift(), ['volume', 1],
    'volume control id selects the Wave mixer bus');
  assert.strictEqual(dv.getUint32(values, true), 0x1234,
    'first unsigned detail contains the left channel');
  assert.strictEqual(dv.getUint32(values + 4, true), 0xBEEF,
    'second unsigned detail contains the right channel');

  prepare(0x1001, 2);
  assert.strictEqual(e.test_mixer_get_control_details_w(secondHandle, pmxcdGuest, 0), 0,
    'Unicode VALUE query succeeds');
  assert.strictEqual(e.get_esp() >>> 0, 0x00300010,
    'Unicode entry point pops three stdcall arguments');
  assert.deepStrictEqual(calls.shift(), ['volume', 1],
    'Unicode VALUE query shares the encoding-independent implementation');
  assert.deepStrictEqual(
    [dv.getUint32(values, true), dv.getUint32(values + 4, true)],
    [0x1234, 0xBEEF],
    'ANSI and Unicode entry points emit identical numeric details');

  prepare(0x2002, 1);
  assert.strictEqual(e.test_mixer_get_control_details_w(secondHandle, pmxcdGuest, 0), 0,
    'mute VALUE query succeeds');
  assert.deepStrictEqual(calls.shift(), ['mute', 2],
    'mute control id selects the MIDI mixer bus');
  assert.strictEqual(dv.getUint32(values, true), 1,
    'Boolean detail contains the current mute state');
  assert.strictEqual(dv.getUint32(values + 4, true), 0xBBBBBBBB,
    'a mono query does not overwrite a second detail');

  prepare(0x3000, 2);
  assert.strictEqual(e.test_mixer_get_control_details_a(secondHandle, pmxcdGuest, 0), 0,
    'peak-meter VALUE query succeeds');
  assert.deepStrictEqual(calls.shift(), ['peak', 0],
    'peak control id selects the master mixer bus');
  assert.deepStrictEqual(
    [dv.getUint32(values, true), dv.getUint32(values + 4, true)],
    [0x4321, 0x4321],
    'peak-meter detail is replicated across the reported channels');

  prepare(0x1001, 2);
  dv.setUint32(values, 0x1111, true);
  dv.setUint32(values + 4, 0x2222, true);
  assert.strictEqual(e.test_mixer_set_control_details(secondHandle, pmxcdGuest, 0), 0,
    'volume VALUE update succeeds for a live mixer');
  assert.deepStrictEqual(calls.shift(), ['set-volume', 1, 0x22221111],
    'volume update forwards both channels to the selected browser mixer bus');
  prepare(0x2002, 1);
  dv.setUint32(values, 1, true);
  assert.strictEqual(e.test_mixer_set_control_details(secondHandle, pmxcdGuest, 0), 0,
    'mute VALUE update succeeds');
  assert.deepStrictEqual(calls.shift(), ['set-mute', 2, 1],
    'mute update forwards the Boolean state to the selected bus');
  prepare(0x3000, 1);
  assert.strictEqual(e.test_mixer_set_control_details(secondHandle, pmxcdGuest, 0), 8,
    'read-only peak meters reject updates');
  assert.strictEqual(e.test_mixer_set_control_details(secondHandle, pmxcdGuest, 1), 8,
    'unsupported CUSTOM control updates fail explicitly');
  assert.strictEqual(e.test_mixer_get_control_details_a(secondHandle, pmxcdGuest, 1), 8,
    'unsupported LISTTEXT query fails instead of returning numeric values');
  assert.strictEqual(e.test_mixer_get_control_details_a(secondHandle, pmxcdGuest, 0x10), 10,
    'unknown detail flags report MMSYSERR_INVALFLAG');
  assert.strictEqual(e.test_mixer_close(secondHandle), 0,
    'closing one handle does not retire another open handle prematurely');
  assert.strictEqual(e.test_mixer_get_control_details_a(secondHandle, pmxcdGuest, 0), 5,
    'control queries reject a closed mixer handle');
  assert.strictEqual(e.test_mixer_set_control_details(secondHandle, pmxcdGuest, 0), 5,
    'control updates reject a closed mixer handle');
  const handles = [];
  for (let i = 0; i < 32; i++) {
    assert.strictEqual(e.test_mixer_open(handleOutGuest), 0,
      `bounded mixer handle slot ${i} opens`);
    handles.push(dv.getUint32(handleOut, true));
  }
  assert.strictEqual(new Set(handles).size, 32,
    'all live mixer opens have distinct handles');
  const lastPublishedHandle = dv.getUint32(handleOut, true);
  assert.strictEqual(e.test_mixer_open(handleOutGuest), 7,
    'the bounded mixer table reports MMSYSERR_NOMEM when full');
  assert.strictEqual(dv.getUint32(handleOut, true), lastPublishedHandle,
    'a failed allocation does not replace the caller output');
  for (const handle of handles) {
    assert.strictEqual(e.test_mixer_close(handle), 0,
      'each allocated mixer handle closes exactly once');
  }
  assert.deepStrictEqual(calls, [], 'each query performs exactly one host read');

  console.log('PASS  mixer APIs enforce device, handle, flag, size, and control contracts');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
