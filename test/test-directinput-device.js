#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

const extraWat = `
  (func (export "test_call_IDirectInputDevice_EnumObjects") (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_IDirectInputDevice_EnumObjects
      (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_di_root_create") (param $version i32) (result i32)
    (local $obj i32)
    (global.set $DX_VTBL_DINPUT (i32.const 0x51000000))
    (local.set $obj (call $dx_create_com_obj (i32.const 6) (global.get $DX_VTBL_DINPUT)))
    (i32.store offset=8 (call $dx_from_this (local.get $obj)) (local.get $version))
    (local.get $obj))
  (func (export "test_di_mouse_create") (result i32)
    (local $obj i32)
    (global.set $DX_VTBL_DIDEV2 (i32.const 0x52000000))
    (local.set $obj (call $dx_create_com_obj (i32.const 7) (global.get $DX_VTBL_DIDEV2)))
    (i32.store offset=8 (call $dx_from_this (local.get $obj)) (i32.const 2))
    (i32.store offset=16 (call $dx_from_this (local.get $obj)) (i32.const 0x0700))
    (local.get $obj))
  (func (export "test_di_keyboard_create") (result i32)
    (local $obj i32)
    (global.set $DX_VTBL_DIDEV2 (i32.const 0x52000000))
    (local.set $obj (call $dx_create_com_obj (i32.const 7) (global.get $DX_VTBL_DIDEV2)))
    (i32.store offset=8 (call $dx_from_this (local.get $obj)) (i32.const 1))
    (i32.store offset=16 (call $dx_from_this (local.get $obj)) (i32.const 0x0700))
    (local.get $obj))
  (func (export "test_di_enum_devices")
        (param $root i32) (param $stack i32) (param $filter i32)
        (param $flags i32) (param $callback i32) (param $ref i32) (result i32)
    (global.set $font_enum_ret_thunk (i32.const 0x0BAD0011))
    (call $gs32 (local.get $stack) (i32.const 0x12345678))
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_IDirectInput_EnumDevices
      (local.get $root) (local.get $filter) (local.get $callback)
      (local.get $ref) (local.get $flags) (i32.const 0))
    (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_di_enum_objects")
        (param $obj i32) (param $stack i32) (param $filter i32)
        (param $callback i32) (param $ref i32) (result i32)
    (global.set $font_enum_ret_thunk (i32.const 0x0BAD0011))
    (call $gs32 (local.get $stack) (i32.const 0x12345678))
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_IDirectInputDevice_EnumObjects
      (local.get $obj) (local.get $callback) (local.get $ref)
      (local.get $filter) (i32.const 0) (i32.const 0))
    (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_di_enum_continue") (param $callback_result i32) (result i32)
    ;; Simulate stdcall RET 8 from callback: return address + two arguments.
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 12)))
    (i32.store offset=0 (global.get $reg_base) (local.get $callback_result))
    (call $di_enum_continue)
    (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_di_get_eip") (result i32) (global.get $eip))
  (func (export "test_di_get_info") (param $obj i32) (param $info i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074fe000))
    (call $handle_IDirectInputDevice_GetDeviceInfo
      (local.get $obj) (local.get $info) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_di_get_caps") (param $obj i32) (param $caps i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074fe000))
    (call $handle_IDirectInputDevice_GetCapabilities
      (local.get $obj) (local.get $caps) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_di_get_object_info")
        (param $obj i32) (param $info i32) (param $which i32) (param $how i32)
        (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074fe000))
    (call $handle_IDirectInputDevice_GetObjectInfo
      (local.get $obj) (local.get $info) (local.get $which)
      (local.get $how) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_di_mouse_seed_delta") (param $dx i32) (param $dy i32)
    (i32.atomic.store offset=0 (global.get $DI_MOUSE_INPUT_STATE) (local.get $dx))
    (i32.atomic.store offset=4 (global.get $DI_MOUSE_INPUT_STATE) (local.get $dy)))
  (func (export "test_di_mouse_seed_overflow") (param $dx i32) (param $dy i32)
    (i32.atomic.store offset=272 (global.get $DI_MOUSE_INPUT_STATE) (local.get $dx))
    (i32.atomic.store offset=276 (global.get $DI_MOUSE_INPUT_STATE) (local.get $dy)))
  (func (export "test_di_mouse_queue_event") (param $event i32)
    (local $tail i32)
    (local.set $tail (i32.atomic.load offset=12 (global.get $DI_MOUSE_INPUT_STATE)))
    (i32.atomic.store
      (i32.add (global.get $DI_MOUSE_INPUT_STATE)
        (i32.add (i32.const 16)
          (i32.shl (i32.and (local.get $tail) (i32.const 63)) (i32.const 2))))
      (local.get $event))
    (i32.atomic.store offset=12 (global.get $DI_MOUSE_INPUT_STATE)
      (i32.add (local.get $tail) (i32.const 1))))
  (func (export "test_di_mouse_peek_delta") (param $axis i32) (result i32)
    (if (result i32) (local.get $axis)
      (then (call $di_mouse_delta_peek_y))
      (else (call $di_mouse_delta_peek_x))))
  (func (export "test_di_mouse_get_data")
        (param $obj i32) (param $buffer i32) (param $count i32) (param $flags i32)
        (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirectInputDevice_GetDeviceData
      (local.get $obj) (i32.const 16) (local.get $buffer) (local.get $count)
      (local.get $flags) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_di_mouse_get_state")
        (param $obj i32) (param $buffer i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirectInputDevice_GetDeviceState
      (local.get $obj) (i32.const 16) (local.get $buffer)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_di_set_data_format")
        (param $obj i32) (param $format i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirectInputDevice_SetDataFormat
      (local.get $obj) (local.get $format) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_di_set_cooperative_level")
        (param $obj i32) (param $hwnd i32) (param $flags i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirectInputDevice_SetCooperativeLevel
      (local.get $obj) (local.get $hwnd) (local.get $flags)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_di_acquire") (param $obj i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirectInputDevice_Acquire
      (local.get $obj) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_di_unacquire") (param $obj i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirectInputDevice_Unacquire
      (local.get $obj) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_di_poll") (param $obj i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirectInputDevice2_Poll
      (local.get $obj) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_di_set_buffer_size")
        (param $obj i32) (param $property_id i32) (param $property i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirectInputDevice_SetProperty
      (local.get $obj) (local.get $property_id) (local.get $property)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_di_get_property")
        (param $obj i32) (param $property_id i32) (param $property i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirectInputDevice_GetProperty
      (local.get $obj) (local.get $property_id) (local.get $property)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_di_get_state_sized")
        (param $obj i32) (param $cb i32) (param $buffer i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_IDirectInputDevice_GetDeviceState
      (local.get $obj) (local.get $cb) (local.get $buffer)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_di_buffer_size") (param $obj i32) (result i32)
    (i32.load offset=12 (call $dx_from_this (local.get $obj))))
`;

(async () => {
  assert.strictEqual(
    apiTable.find(api => api.name === 'IDirectInputDevice_EnumObjects').nargs,
    4,
    'EnumObjects metadata includes this + callback + ref + flags'
  );
  const { exports: wat, renderer } = await bootRenderHarness({ extraWat });
  const stack = 0x074ff000;

  assert.strictEqual(
    wat.test_call_IDirectInputDevice_EnumObjects(stack) >>> 0,
    stack + 20,
    'IDirectInputDevice::EnumObjects must pop this + 3 parameters + return address'
  );
  assert.strictEqual(wat.get_eax() >>> 0, 0x80070057,
    'EnumObjects rejects a null callback instead of silently succeeding');

  const mouse = wat.test_di_mouse_create() >>> 0;
  const keyboard = wat.test_di_keyboard_create() >>> 0;
  const root = wat.test_di_root_create(0x0700) >>> 0;
  const count = 0x00410100;
  const data = 0x00410200;
  const mouseFormat = 0x00411000;
  const mouseObjects = 0x00412000;
  const keyboardFormat = 0x00411100;
  const keyboardObjects = 0x00414000;

  const writeFormat = (format, objects, kind) => {
    const keyboardDevice = kind === 'keyboard';
    const mouse2 = kind === 'mouse2';
    const objectCount = keyboardDevice ? 256 : (mouse2 ? 11 : 7);
    const dataSize = keyboardDevice ? 256 : (mouse2 ? 20 : 16);
    wat.guest_write32(format, 24);       // DIDATAFORMAT.dwSize
    wat.guest_write32(format + 4, 16);   // dwObjSize
    wat.guest_write32(format + 8, 2);    // DIDF_RELAXIS
    wat.guest_write32(format + 12, dataSize);
    wat.guest_write32(format + 16, objectCount);
    wat.guest_write32(format + 20, objects);
    for (let i = 0; i < objectCount; i++) {
      const offset = keyboardDevice ? i : (i < 3 ? i * 4 : i + 9);
      const type = keyboardDevice
        ? ((0x8000000c | (i << 8)) >>> 0)
        : (i < 3 ? 0x00ffff03 : 0x00ffff0c);
      wat.guest_write32(objects + i * 16, 0); // pguid: identity is not retained
      wat.guest_write32(objects + i * 16 + 4, offset);
      wat.guest_write32(objects + i * 16 + 8, type);
      wat.guest_write32(objects + i * 16 + 12, 0);
    }
  };

  // DirectInput requires a data format before acquisition; the cooperative
  // level defaults to DISCL_NONEXCLUSIVE|DISCL_BACKGROUND (as in Wine).
  // Acquisition is a Boolean state rather than a reference count.
  assert.strictEqual(wat.test_di_acquire(mouse) >>> 0, 0x80070057,
    'Acquire rejects a device without a data format');
  assert.strictEqual(wat.test_di_poll(mouse) >>> 0, 0x8007000c,
    'Poll rejects an unacquired device');
  assert.strictEqual(wat.test_di_set_data_format(mouse, 0) >>> 0, 0x80070057,
    'SetDataFormat rejects a null descriptor');
  writeFormat(mouseFormat, mouseObjects, 'mouse');
  wat.guest_write32(mouseObjects + 4, 2);
  assert.strictEqual(wat.test_di_set_data_format(mouse, mouseFormat) >>> 0, 0x80070057,
    'SetDataFormat rejects an axis that is not DWORD-aligned');
  wat.guest_write32(mouseObjects + 4, 0);
  assert.strictEqual(wat.test_di_set_data_format(mouse, mouseFormat) >>> 0, 0,
    'SetDataFormat accepts the standard DIMOUSESTATE layout');
  assert.strictEqual(wat.test_di_acquire(mouse) >>> 0, 0,
    'Acquire uses the default background nonexclusive level when none was set '
    + '(Midtown Madness never sets one on its keyboard)');
  assert.strictEqual(wat.test_di_unacquire(mouse) >>> 0, 0);
  assert.strictEqual(wat.test_di_set_cooperative_level(mouse, 0xdead, 6) >>> 0,
    0x80070006, 'SetCooperativeLevel rejects an invalid top-level HWND');
  assert.strictEqual(wat.test_di_set_cooperative_level(mouse, 0x10000, 0) >>> 0,
    0x80070057, 'cooperative flags require one choice from each pair');
  assert.strictEqual(wat.test_di_set_cooperative_level(mouse, 0, 6) >>> 0,
    0x80070006, 'a NULL HWND is refused for foreground access');
  assert.strictEqual(wat.test_di_acquire(mouse) >>> 0, 0,
    'a refused SetCooperativeLevel leaves the default level in place');
  assert.strictEqual(wat.test_di_unacquire(mouse) >>> 0, 0);
  // NULL with exactly DISCL_NONEXCLUSIVE|DISCL_BACKGROUND binds the desktop
  // (Populous: The Beginning's input threads; Wine does the same).
  assert.strictEqual(wat.test_di_set_cooperative_level(mouse, 0, 0x0A) >>> 0, 0,
    'background nonexclusive access accepts a NULL HWND');
  assert.strictEqual(wat.test_di_set_cooperative_level(mouse, 0x10000, 6) >>> 0, 0,
    'foreground nonexclusive access is accepted for the desktop window');
  assert.strictEqual(wat.test_di_acquire(mouse) >>> 0, 0);
  assert.strictEqual(wat.test_di_acquire(mouse) >>> 0, 1,
    'repeated Acquire returns S_FALSE without adding an acquisition reference');
  assert.strictEqual(wat.test_di_poll(mouse) >>> 0, 1,
    'the acquired system mouse returns DI_NOEFFECT because it needs no polling');
  assert.strictEqual(wat.test_di_set_data_format(mouse, mouseFormat) >>> 0, 0x800700aa,
    'the data format cannot change while the device is acquired');
  assert.strictEqual(wat.test_di_unacquire(mouse) >>> 0, 0);
  assert.strictEqual(wat.test_di_unacquire(mouse) >>> 0, 1,
    'one Unacquire releases the device despite two Acquire calls');
  wat.guest_write32(data, 0xfeedface);
  assert.strictEqual(wat.test_di_mouse_get_state(mouse, data) >>> 0, 0x8007000c);
  assert.strictEqual(wat.guest_read32(data) >>> 0, 0xfeedface,
    'unacquired GetDeviceState leaves the output buffer untouched');
  wat.guest_write32(count, 7);
  assert.strictEqual(wat.test_di_mouse_get_data(mouse, data, count, 0) >>> 0, 0x8007000c);
  assert.strictEqual(wat.guest_read32(count), 7,
    'unacquired GetDeviceData leaves the caller count untouched');
  writeFormat(mouseFormat, mouseObjects, 'mouse2');
  assert.strictEqual(wat.test_di_set_data_format(mouse, mouseFormat) >>> 0, 0,
    'SetDataFormat accepts the standard 20-byte DIMOUSESTATE2 layout');
  writeFormat(mouseFormat, mouseObjects, 'mouse');
  assert.strictEqual(wat.test_di_set_data_format(mouse, mouseFormat) >>> 0, 0,
    'an unacquired device can return to the standard DIMOUSESTATE layout');
  assert.strictEqual(wat.test_di_acquire(mouse) >>> 0, 0);

  writeFormat(keyboardFormat, keyboardObjects, 'keyboard');
  assert.strictEqual(wat.test_di_set_data_format(keyboard, keyboardFormat) >>> 0, 0,
    'SetDataFormat accepts the standard 256-byte keyboard layout');
  assert.strictEqual(wat.test_di_set_cooperative_level(keyboard, 0x10000, 6) >>> 0, 0);
  assert.strictEqual(wat.test_di_acquire(keyboard) >>> 0, 0);

  // Win98-era DirectInput enumerates the system mouse and keyboard through
  // the guest callback. The callback owns only the descriptor lifetime and
  // controls whether the walk continues.
  const callback = 0x00420000;
  const ref = 0xfeed1234;
  let callbackStack = wat.test_di_enum_devices(root, stack, 0, 1, callback, ref) >>> 0;
  assert.strictEqual(wat.test_di_get_eip() >>> 0, callback);
  assert.strictEqual(wat.guest_read32(callbackStack) >>> 0, 0x0bad0011,
    'EnumDevices returns through the generic callback continuation');
  assert.strictEqual(wat.guest_read32(callbackStack + 8) >>> 0, ref);
  let descriptor = wat.guest_read32(callbackStack + 4) >>> 0;
  assert.deepStrictEqual([
    wat.guest_read32(descriptor),
    wat.guest_read32(descriptor + 4) >>> 0,
    wat.guest_read32(descriptor + 8) >>> 0,
    wat.guest_read32(descriptor + 36) >>> 0,
  ], [580, 0x6f1d2b60, 0x11cfd5a0, 0x0202],
  'first descriptor is the traditional system mouse');
  assert.strictEqual(String.fromCharCode(...Array.from({ length: 5 }, (_, i) =>
    wat.guest_read8(descriptor + 40 + i))), 'Mouse');

  callbackStack = wat.test_di_enum_continue(1) >>> 0;
  descriptor = wat.guest_read32(callbackStack + 4) >>> 0;
  assert.deepStrictEqual([
    wat.guest_read32(descriptor + 4) >>> 0,
    wat.guest_read32(descriptor + 36) >>> 0,
  ], [0x6f1d2b61, 0x0403], 'DIENUM_CONTINUE advances to the system keyboard');
  assert.strictEqual(wat.test_di_enum_continue(1) >>> 0, stack + 24,
    'continuing past the final device restores the caller stack');
  assert.strictEqual(wat.test_di_get_eip() >>> 0, 0x12345678);

  callbackStack = wat.test_di_enum_devices(root, stack, 3, 1, callback, ref) >>> 0;
  descriptor = wat.guest_read32(callbackStack + 4) >>> 0;
  assert.strictEqual(wat.guest_read32(descriptor + 36) >>> 0, 0x0403,
    'legacy DIDEVTYPE_KEYBOARD filtering skips the mouse');
  assert.strictEqual(wat.test_di_enum_continue(0) >>> 0, stack + 24,
    'DIENUM_STOP restores the original caller immediately');
  assert.strictEqual(wat.test_di_enum_devices(root, stack, 0, 0x100, callback, ref) >>> 0,
    stack + 24, 'force-feedback filtering produces an honest empty enumeration');

  callbackStack = wat.test_di_enum_objects(mouse, stack, 0, callback, ref) >>> 0;
  descriptor = wat.guest_read32(callbackStack + 4) >>> 0;
  assert.deepStrictEqual([
    wat.guest_read32(descriptor),
    wat.guest_read32(descriptor + 4) >>> 0,
    wat.guest_read32(descriptor + 20),
    wat.guest_read32(descriptor + 24),
  ], [316, 0xa36d02e0, 0, 1], 'mouse enumeration begins with relative X axis');
  wat.test_di_enum_continue(1);
  descriptor = wat.guest_read32(wat.test_di_enum_continue(1) + 4) >>> 0;
  assert.deepStrictEqual([
    wat.guest_read32(descriptor + 4) >>> 0,
    wat.guest_read32(descriptor + 20),
  ], [0xa36d02e2, 8], 'mouse axis order is X, Y, wheel');

  callbackStack = wat.test_di_enum_objects(mouse, stack, 0x0c, callback, ref) >>> 0;
  descriptor = wat.guest_read32(callbackStack + 4) >>> 0;
  assert.deepStrictEqual([
    wat.guest_read32(descriptor + 4) >>> 0,
    wat.guest_read32(descriptor + 20),
    wat.guest_read32(descriptor + 24),
  ], [0xa36d02f0, 12, 0x304], 'button filtering starts at DIMOUSESTATE button 0');
  wat.test_di_enum_continue(0);

  callbackStack = wat.test_di_enum_objects(keyboard, stack, 0, callback, ref) >>> 0;
  descriptor = wat.guest_read32(callbackStack + 4) >>> 0;
  assert.deepStrictEqual([
    wat.guest_read32(descriptor + 4) >>> 0,
    wat.guest_read32(descriptor + 8) >>> 0,
    wat.guest_read32(descriptor + 20),
    wat.guest_read32(descriptor + 24),
  ], [0x55728220, 0x11cfd33c, 1, 0x104],
  'keyboard enumeration starts with DIK_ESCAPE');
  wat.test_di_enum_continue(0);

  const info = 0x00410400;
  const caps = 0x00410700;
  wat.guest_write32(info, 580);
  assert.strictEqual(wat.test_di_get_info(mouse, info) >>> 0, 0);
  assert.deepStrictEqual([
    wat.guest_read32(info), wat.guest_read32(info + 4) >>> 0,
    wat.guest_read32(info + 36) >>> 0,
  ], [580, 0x6f1d2b60, 0x0202], 'GetDeviceInfo returns the same system-mouse identity');
  // Both DX3 and DX5 structures must identify the enumerated system devices
  // as attached. Hype tests this flag before ever polling the keyboard.
  for (const size of [24, 44]) {
    for (const [device, type, axes, buttons] of [
      [mouse, 0x0202, 3, 3], [keyboard, 0x0403, 0, 256],
    ]) {
      for (let offset = 0; offset < size + 4; offset += 4)
        wat.guest_write32(caps + offset, 0xfeedface);
      wat.guest_write32(caps, size);
      assert.strictEqual(wat.test_di_get_caps(device, caps) >>> 0, 0);
      assert.deepStrictEqual(Array.from({length:6}, (_, i) => wat.guest_read32(caps+i*4) >>> 0),
        [size, 1, type, axes, buttons, 0], 'attached device, correct buttons field, no POV hats');
      for (let offset = 24; offset < size; offset += 4)
        assert.strictEqual(wat.guest_read32(caps + offset), 0, 'no force-feedback capability');
      assert.strictEqual(wat.guest_read32(caps + size) >>> 0, 0xfeedface,
        'capabilities preserve bytes beyond caller structure');
    }
  }

  // Microsoft defines GetObjectInfo as a lookup over the current data-format
  // offset, the dwType returned by EnumObjects, or packed HID usage. These
  // descriptors must therefore be byte-for-byte compatible with enumeration.
  const objectInfo = 0x00410900;
  wat.guest_write32(objectInfo, 316);
  wat.guest_write32(objectInfo + 316, 0xfeedface);
  assert.strictEqual(wat.test_di_get_object_info(mouse, objectInfo, 8, 1) >>> 0, 0,
    'DIPH_BYOFFSET finds the mouse wheel');
  assert.deepStrictEqual([
    wat.guest_read32(objectInfo), wat.guest_read32(objectInfo + 4) >>> 0,
    wat.guest_read32(objectInfo + 20), wat.guest_read32(objectInfo + 24),
  ], [316, 0xa36d02e2, 8, 0x201],
  'GetObjectInfo reuses the enumerated Z-axis descriptor');
  assert.strictEqual(wat.guest_read32(objectInfo + 316) >>> 0, 0xfeedface,
    'full object descriptor does not overwrite the following byte range');

  wat.guest_write32(objectInfo, 316);
  assert.strictEqual(wat.test_di_get_object_info(mouse, objectInfo, 0x404, 2) >>> 0, 0,
    'DIPH_BYID accepts a dwType returned by EnumObjects');
  assert.deepStrictEqual([
    wat.guest_read32(objectInfo + 4) >>> 0,
    wat.guest_read32(objectInfo + 20), wat.guest_read32(objectInfo + 24),
  ], [0xa36d02f0, 13, 0x404], 'button 1 keeps its GUID, offset, and object ID');

  wat.guest_write32(objectInfo, 316);
  assert.strictEqual(wat.test_di_get_object_info(keyboard, objectInfo, 1, 1) >>> 0, 0,
    'keyboard offsets use the standard DIK scan-code data format');
  assert.deepStrictEqual([
    wat.guest_read32(objectInfo + 4) >>> 0,
    wat.guest_read32(objectInfo + 20), wat.guest_read32(objectInfo + 24),
  ], [0x55728220, 1, 0x104], 'DIK_ESCAPE matches the enumerated key descriptor');

  wat.guest_write32(objectInfo, 292);
  wat.guest_write32(objectInfo + 292, 0xcafebabe);
  assert.strictEqual(wat.test_di_get_object_info(mouse, objectInfo, 1, 2) >>> 0, 0,
    'DirectX 3 DIDEVICEOBJECTINSTANCE_DX3 is accepted');
  assert.deepStrictEqual([
    wat.guest_read32(objectInfo), wat.guest_read32(objectInfo + 20),
    wat.guest_read32(objectInfo + 24), wat.guest_read32(objectInfo + 292) >>> 0,
  ], [292, 0, 1, 0xcafebabe], 'DX3 output is caller-sized and bounded');

  assert.strictEqual(wat.test_di_get_object_info(mouse, 0, 0, 1) >>> 0, 0x80004003,
    'null descriptor returns E_POINTER');
  wat.guest_write32(objectInfo, 123);
  assert.strictEqual(wat.test_di_get_object_info(mouse, objectInfo, 0, 1) >>> 0, 0x80070057,
    'invalid descriptor size returns DIERR_INVALIDPARAM');
  wat.guest_write32(objectInfo, 316);
  assert.strictEqual(wat.test_di_get_object_info(mouse, objectInfo, 0, 0) >>> 0, 0x80070057,
    'DIPH_DEVICE is invalid for object lookup');
  assert.strictEqual(wat.test_di_get_object_info(mouse, objectInfo, 99, 1) >>> 0, 0x80070002,
    'an unknown data-format offset returns DIERR_OBJECTNOTFOUND');
  assert.strictEqual(wat.test_di_get_object_info(mouse, objectInfo, 0x00010002, 3) >>> 0,
    0x80070002, 'legacy system devices have no DIPH_BYUSAGE object');

  // Both transitions happened before DirectInput polled. A live-state-only
  // implementation sees released -> released and permanently loses the click.
  wat.test_di_mouse_queue_event(1);
  wat.test_di_mouse_queue_event(2);
  wat.guest_write32(count, 4);
  wat.test_di_mouse_get_data(mouse, 0, count, 1);
  assert.strictEqual(wat.guest_read32(count), 2,
    'count-only peek retains both edges of a completed browser click');
  wat.guest_write32(count, 1);
  wat.test_di_mouse_get_data(mouse, data, count, 0);
  assert.deepStrictEqual([wat.guest_read32(count), wat.guest_read32(data), wat.guest_read32(data + 4)],
    [1, 12, 0x80], 'first one-record poll receives the queued left-button press');
  wat.guest_write32(count, 1);
  wat.test_di_mouse_get_data(mouse, data, count, 0);
  assert.deepStrictEqual([wat.guest_read32(count), wat.guest_read32(data), wat.guest_read32(data + 4)],
    [1, 12, 0], 'second one-record poll receives the queued left-button release');

  // The browser stamps a button edge with the wall-clock millisecond it was
  // queued at (type in the high nibble, time in the low 28 bits). Two presses
  // 1.5 s apart that drain in ONE poll are stamped 1.5 s apart, at the ticks
  // of the clicks, not both with the poll's tick. A bare code stays unstamped.
  const stampedAt = ms => ((1 << 28) | (ms & 0x0FFFFFFF)) | 0;
  const queuedAt = Date.now();
  wat.test_di_mouse_queue_event(stampedAt(queuedAt - 3000));
  wat.test_di_mouse_queue_event(((2 << 28) | ((queuedAt - 2900) & 0x0FFFFFFF)) | 0);
  wat.test_di_mouse_queue_event(stampedAt(queuedAt - 1500));
  wat.test_di_mouse_queue_event(2);
  wat.guest_write32(count, 4);
  assert.strictEqual(wat.test_di_mouse_get_data(mouse, data, count, 0) >>> 0, 0);
  assert.strictEqual(wat.guest_read32(count), 4);
  const stamps = [0, 16, 32, 48].map(offset => wat.guest_read32(data + offset + 8) | 0);
  const drainedAt = Date.now() & 0x7FFFFFFF;
  assert.deepStrictEqual([0, 16, 32, 48].map(offset => [wat.guest_read32(data + offset), wat.guest_read32(data + offset + 4)]),
    [[12, 0x80], [12, 0], [12, 0x80], [12, 0]], 'stamped edges decode like bare ones');
  const near = (actual, expected, why) =>
    assert(Math.abs(actual - expected) < 400, `${why}: ${actual} vs ${expected}`);
  near(stamps[0], (queuedAt - 3000) & 0x7FFFFFFF, 'first press is stamped when it was queued');
  near(stamps[1], (queuedAt - 2900) & 0x7FFFFFFF, 'release likewise');
  near(stamps[2], (queuedAt - 1500) & 0x7FFFFFFF, 'second press likewise');
  near(stamps[2] - stamps[0], 1500, 'the gap between the presses is the real gap');
  near(stamps[3], drainedAt, 'an unstamped edge keeps the poll tick');

  // A fast diagonal move followed immediately by a click must preserve the
  // event order. Delivering button edges before Y hit-tests at the old row.
  wat.test_di_mouse_queue_event((5 << 28) | 7);
  wat.test_di_mouse_queue_event((6 << 28) | 0x0ffffffd);
  wat.test_di_mouse_queue_event(1);
  wat.test_di_mouse_queue_event(2);
  wat.guest_write32(count, 4);
  assert.strictEqual(wat.test_di_mouse_get_data(mouse, data, count, 1) >>> 0, 0);
  assert.strictEqual(wat.guest_read32(count), 4, 'DIGDD_PEEK reports ordered motion and click records');
  assert.deepStrictEqual([
    wat.guest_read32(data), wat.guest_read32(data + 4) | 0,
    wat.guest_read32(data + 16), wat.guest_read32(data + 20) | 0,
    wat.guest_read32(data + 32), wat.guest_read32(data + 36) | 0,
    wat.guest_read32(data + 48), wat.guest_read32(data + 52) | 0,
  ], [0, 7, 4, -3, 12, 0x80, 12, 0],
  'buffered mouse records preserve X, Y, press, release order');

  wat.guest_write32(count, 1);
  assert.strictEqual(wat.test_di_mouse_get_data(mouse, data, count, 0) >>> 0, 0);
  assert.deepStrictEqual([wat.guest_read32(data), wat.guest_read32(data + 4) | 0], [0, 7]);
  wat.guest_write32(count, 1);
  wat.test_di_mouse_get_data(mouse, data, count, 0);
  assert.deepStrictEqual([wat.guest_read32(data), wat.guest_read32(data + 4) | 0], [4, -3]);
  wat.guest_write32(count, 1);
  wat.test_di_mouse_get_data(mouse, data, count, 0);
  assert.deepStrictEqual([wat.guest_read32(data), wat.guest_read32(data + 4) | 0], [12, 0x80]);
  wat.guest_write32(count, 1);
  wat.test_di_mouse_get_data(mouse, data, count, 0);
  assert.deepStrictEqual([wat.guest_read32(data), wat.guest_read32(data + 4) | 0], [12, 0]);

  // Motion coalesced after a saturated browser ring remains visible after
  // ordinary queued records drain, in X-before-Y order.
  wat.test_di_mouse_seed_overflow(37, -21);
  wat.guest_write32(count, 4);
  wat.test_di_mouse_get_data(mouse, 0, count, 1);
  assert.strictEqual(wat.guest_read32(count), 2,
    'count-only peek includes coalesced overflow axes');
  wat.guest_write32(count, 2);
  wat.test_di_mouse_get_data(mouse, data, count, 0);
  assert.deepStrictEqual([
    wat.guest_read32(data), wat.guest_read32(data + 4) | 0,
    wat.guest_read32(data + 16), wat.guest_read32(data + 20) | 0,
  ], [0, 37, 4, -21], 'DirectInput drains coalesced overflow after the ring');

  wat.test_di_mouse_seed_delta(11, -9);
  assert.strictEqual(wat.test_di_mouse_get_state(mouse, data) >>> 0, 0);
  assert.deepStrictEqual([wat.guest_read32(data) | 0, wat.guest_read32(data + 4) | 0], [11, -9],
    'GetDeviceState consumes its physical relative-motion accumulator');

  // MCM allocates exactly DIPROP_BUFFERSIZE records on its stack. Mouse
  // events accumulated while its startup MessageBox was open used to make a
  // count-only peek report the whole browser FIFO; the following read then
  // overwrote MCM's saved return address with a DIDEVICEOBJECTDATA.dwOfs.
  const property = 0x00410300;
  wat.guest_write32(property, 20);      // DIPROPDWORD.dwSize
  wat.guest_write32(property + 4, 16);  // DIPROPHEADER.dwHeaderSize
  wat.guest_write32(property + 8, 0);   // whole device
  wat.guest_write32(property + 12, 0);  // DIPH_DEVICE
  wat.guest_write32(property + 16, 2);  // dwData = buffer capacity
  assert.strictEqual(wat.test_di_set_buffer_size(mouse, 1, property) >>> 0, 0,
    'SetProperty accepts a well-formed DIPROP_BUFFERSIZE device property');
  assert.strictEqual(wat.test_di_buffer_size(mouse), 2,
    'DIPROP_BUFFERSIZE is retained on the DirectInput device');
  wat.guest_write32(property + 16, 0xfeedface);
  assert.strictEqual(wat.test_di_get_property(mouse, 1, property) >>> 0, 0,
    'GetProperty returns DIPROP_BUFFERSIZE');
  assert.strictEqual(wat.guest_read32(property + 16), 2,
    'GetProperty round-trips the configured queue capacity');
  assert.strictEqual(wat.test_di_set_buffer_size(mouse, 2, property) >>> 0, 0x80070057,
    'DIPROP_AXISMODE rejects the buffer value 2 as invalid');
  wat.guest_write32(property + 16, 0); // DIPROPAXISMODE_ABS (UT2003, Midtown Madness)
  assert.strictEqual(wat.test_di_set_buffer_size(mouse, 2, property) >>> 0, 0,
    'SetProperty accepts absolute DIPROP_AXISMODE for the whole device');
  wat.guest_write32(property + 16, 0xfeedface);
  assert.strictEqual(wat.test_di_get_property(mouse, 2, property) >>> 0, 0,
    'GetProperty accepts DIPROP_AXISMODE');
  assert.strictEqual(wat.guest_read32(property + 16), 0,
    'GetProperty round-trips absolute axis mode');
  // An absolute mouse reports the accumulated position, not the last delta.
  const absBefore = [];
  wat.test_di_mouse_seed_delta(0, 0);
  assert.strictEqual(wat.test_di_mouse_get_state(mouse, data) >>> 0, 0);
  absBefore.push(wat.guest_read32(data) | 0, wat.guest_read32(data + 4) | 0);
  wat.test_di_mouse_seed_delta(5, -3);
  assert.strictEqual(wat.test_di_mouse_get_state(mouse, data) >>> 0, 0);
  wat.test_di_mouse_seed_delta(2, 1);
  assert.strictEqual(wat.test_di_mouse_get_state(mouse, data) >>> 0, 0);
  assert.deepStrictEqual([wat.guest_read32(data) | 0, wat.guest_read32(data + 4) | 0],
    [absBefore[0] + 7, absBefore[1] - 2],
    'absolute axis mode accumulates the deltas into a position');
  wat.guest_write32(property + 16, 1); // DIPROPAXISMODE_REL
  assert.strictEqual(wat.test_di_set_buffer_size(mouse, 2, property) >>> 0, 0,
    'SetProperty accepts relative DIPROP_AXISMODE');
  wat.guest_write32(property + 16, 0xfeedface);
  assert.strictEqual(wat.test_di_get_property(mouse, 2, property) >>> 0, 0);
  assert.strictEqual(wat.guest_read32(property + 16), 1,
    'GetProperty round-trips relative axis mode');
  wat.test_di_mouse_seed_delta(4, 4);
  assert.strictEqual(wat.test_di_mouse_get_state(mouse, data) >>> 0, 0);
  assert.deepStrictEqual([wat.guest_read32(data) | 0, wat.guest_read32(data + 4) | 0], [4, 4],
    'relative axis mode reports the delta since the last read');
  assert.strictEqual(wat.test_di_get_property(mouse, 3, property) >>> 0, 0x80004001,
    'an unmodeled DirectInput property fails honestly with DIERR_UNSUPPORTED');
  wat.guest_write32(property + 12, 1); // DIPH_BYOFFSET is invalid for buffer size
  assert.strictEqual(wat.test_di_get_property(mouse, 1, property) >>> 0, 0x80070057,
    'DIPROP_BUFFERSIZE requires DIPH_DEVICE');
  wat.guest_write32(property + 12, 0);
  wat.guest_write32(property + 4, 12);
  assert.strictEqual(wat.test_di_set_buffer_size(mouse, 1, property) >>> 0, 0x80070057,
    'SetProperty rejects a malformed DIPROPHEADER');
  wat.guest_write32(property + 4, 16);
  wat.test_di_mouse_queue_event((5 << 28) | 1);
  wat.test_di_mouse_queue_event((6 << 28) | 2);
  wat.test_di_mouse_queue_event((5 << 28) | 3);
  wat.test_di_mouse_queue_event((6 << 28) | 4);
  wat.guest_write32(count, 0xffffffff);
  wat.test_di_mouse_get_data(mouse, 0, count, 1);
  assert.strictEqual(wat.guest_read32(count), 2,
    'count-only peek is capped to the configured DirectInput buffer size');
  wat.guest_write32(data + 32, 0xfeedface);
  wat.guest_write32(count, 0xffffffff);
  wat.test_di_mouse_get_data(mouse, data, count, 0);
  assert.strictEqual(wat.guest_read32(count), 2,
    'buffered read cannot deliver more records than DIPROP_BUFFERSIZE');
  assert.strictEqual(wat.guest_read32(data + 32) >>> 0, 0xfeedface,
    'buffered read leaves memory after the configured record array intact');

  // Immediate device reads must ignore stale Win32 mouse-message snapshots.
  for (const [live, message, expected] of [[1, 0, 0x80], [0, 1, 0], [3, 0, 0x8080]]) {
    renderer._mouseButtonsMask = live;
    renderer._activeInputEvent = {type:'mouse', hwnd:0x77777, mouseButtons:message};
    assert.strictEqual(wat.test_di_mouse_get_state(mouse, data) >>> 0, 0);
    assert.strictEqual(wat.guest_read32(data + 12) & 0xffff, expected,
      'DirectInput returns current physical buttons, not an unrelated queued message');
    assert.strictEqual(renderer.getMouseButtons(), message,
      'message snapshot remains unchanged for message consumers');
  }
  renderer._mouseButtonsMask = 0;
  renderer._activeInputEvent = null;

  // Application-defined data formats, in LithTech's (Blood 2) shape: first a
  // format with no objects, then one naming only the bound keys by the dwType
  // EnumObjects reported, at dwOfs = 4*i. The game reads dwOfs/4 back as an
  // index into its own binding table; before this, SetDataFormat refused
  // both, the game released the device, and no key ever reached the player.
  const lith = wat.test_di_keyboard_create() >>> 0;
  const lithFormat = 0x00415000;
  const lithObjects = 0x00415100;
  const guidKey = 0x00415200;
  [0x55728220, 0x11cfd33c, 0x4544c7bf, 0x00005453]
    .forEach((word, i) => wat.guest_write32(guidKey + 4 * i, word));
  const setLithFormat = objects => {
    wat.guest_write32(lithFormat, 24);
    wat.guest_write32(lithFormat + 4, 16);
    wat.guest_write32(lithFormat + 8, 2);
    wat.guest_write32(lithFormat + 12, objects.length * 4);
    wat.guest_write32(lithFormat + 16, objects.length);
    wat.guest_write32(lithFormat + 20, lithObjects);
    objects.forEach(([guid, type], i) => {
      wat.guest_write32(lithObjects + i * 16, guid);
      wat.guest_write32(lithObjects + i * 16 + 4, i * 4);
      wat.guest_write32(lithObjects + i * 16 + 8, type >>> 0);
      wat.guest_write32(lithObjects + i * 16 + 12, 0);
    });
    return wat.test_di_set_data_format(lith, lithFormat) >>> 0;
  };
  const DIK_UP = 0xc8, DIK_LCONTROL = 0x1d;
  assert.strictEqual(setLithFormat([]), 0, 'a format with no objects is accepted');
  assert.strictEqual(setLithFormat([[guidKey, 0x04 | (DIK_UP << 8)], [0, 0x0c | (DIK_LCONTROL << 8)]]), 0,
    'a format naming keys by GUID_Key and DIDFT instance is accepted');
  assert.strictEqual(setLithFormat([[0, 0x0c | (0x54 << 8)]]), 0x80070057,
    'a required object the keyboard does not have refuses the format');
  assert.strictEqual(setLithFormat([[0, (0x8000000c | (0x54 << 8)) >>> 0], [guidKey, 0x04 | (DIK_UP << 8)]]), 0,
    'a DIDFT_OPTIONAL object the keyboard lacks is skipped');
  assert.strictEqual(setLithFormat([[guidKey, 0x04 | (DIK_UP << 8)], [0, 0x0c | (DIK_LCONTROL << 8)]]), 0);
  assert.strictEqual(setLithFormat([[0, 0x01 | (DIK_UP << 8)]]), 0x80070057,
    'an axis type never matches a key');
  assert.strictEqual(wat.test_di_set_cooperative_level(lith, 0x10000, 6) >>> 0, 0);
  assert.strictEqual(wat.test_di_acquire(lith) >>> 0, 0,
    'the refused format left the previous custom format in force');

  renderer.pokeAsyncKeyState(0x26, true); // VK_UP
  renderer.pokeAsyncKeyState(0x41, true); // 'A' -- not in the format
  wat.guest_write32(count, 8);
  assert.strictEqual(wat.test_di_mouse_get_data(lith, data, count, 0) >>> 0, 0);
  assert.deepStrictEqual([wat.guest_read32(count), wat.guest_read32(data), wat.guest_read32(data + 4)],
    [1, 0, 0x80], 'Up is reported at its format offset 0 and A, outside the format, not at all');
  renderer.pokeAsyncKeyState(0x11, true); // VK_CONTROL (DIK_LCONTROL)
  wat.guest_write32(count, 8);
  wat.test_di_mouse_get_data(lith, data, count, 0);
  assert.deepStrictEqual([wat.guest_read32(count), wat.guest_read32(data), wat.guest_read32(data + 4)],
    [1, 4, 0x80], 'the second format object is reported at dwOfs 4');
  wat.guest_write32(data, 0xffffffff);
  wat.guest_write32(data + 4, 0xffffffff);
  assert.strictEqual(wat.test_di_get_state_sized(lith, 8, data) >>> 0, 0);
  assert.deepStrictEqual([wat.guest_read32(data) >>> 0, wat.guest_read32(data + 4) >>> 0], [0x80, 0x80],
    'GetDeviceState lays the held keys out at their format offsets');
  renderer.pokeAsyncKeyState(0x26, false);
  renderer.pokeAsyncKeyState(0x41, false);
  renderer.pokeAsyncKeyState(0x11, false);
  wat.guest_write32(count, 8);
  wat.test_di_mouse_get_data(lith, data, count, 0);
  assert.deepStrictEqual([wat.guest_read32(count), wat.guest_read32(data), wat.guest_read32(data + 4),
    wat.guest_read32(data + 16), wat.guest_read32(data + 20)],
  [2, 4, 0, 0, 0], 'releases come back at the same offsets, again without A');

  console.log('PASS  DirectInput enumerates Win98 devices/objects and preserves browser input');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
