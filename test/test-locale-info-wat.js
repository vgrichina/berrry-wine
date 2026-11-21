#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

const extraWat = String.raw`
  (func (export "test_locale_info")
        (param $type i32) (param $out i32) (param $count i32)
        (param $wide i32) (result i32)
    (call $locale_info
      (local.get $type) (local.get $out) (local.get $count) (local.get $wide)))
  (func (export "test_set_locale_info")
        (param $locale i32) (param $type i32) (param $data i32)
        (param $esp0 i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp0))
    (call $handle_SetLocaleInfoA
      (local.get $locale) (local.get $type) (local.get $data)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_get_esp") (result i32)
    (i32.load offset=16 (global.get $reg_base)))
  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
`;

function writeAnsi(e, address, value) {
  const bytes = Buffer.from(`${value}\0`, 'latin1');
  for (let i = 0; i < bytes.length; i++) e.guest_write8(address + i, bytes[i]);
}

function readAnsi(e, address, count) {
  return Buffer.from(Array.from({ length: count }, (_, i) =>
    e.guest_read8(address + i))).toString('latin1');
}

function readWide(e, address, count) {
  return String.fromCharCode(...Array.from({ length: count }, (_, i) =>
    e.guest_read8(address + i * 2) | (e.guest_read8(address + i * 2 + 1) << 8)));
}

async function main() {
  const root = path.join(__dirname, '..');
  const srcDir = path.join(root, 'src');
  // Plain append: src fragments are self-balanced now, so there is no trailing
  // `)` to splice into — the old regex matched nothing and dropped extraWat.
  const bytes = compileSrcWasm((filename, source) =>
    filename === '13-exports.wat' ? `${source}\n${extraWat}\n` : source);

  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const context = { exports: null, getMemory: () => memory.buffer };
  const imports = createHostImports(context);
  imports.host.memory = memory;
  imports.host.exit = () => {};
  imports.host.log = () => {};
  imports.host.log_i32 = () => {};
  imports.host.crash_unimplemented = () => {};
  imports.host.wait_multiple = () => 0;
  imports.host.terminate_thread = () => 0;
  imports.host.shell_execute = () => 33;
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  const e = instance.exports;
  context.exports = e;

  const output = e.guest_alloc(64) >>> 0;
  assert.strictEqual(e.test_locale_info(0x1002, 0, 0, 0), 14,
    'LOCALE_SENGCOUNTRY size query includes the terminator');
  assert.strictEqual(e.test_locale_info(0x1002, output, 14, 0), 14);
  assert.strictEqual(Buffer.from(Array.from({ length: 14 }, (_, i) =>
    e.guest_read8(output + i))).toString('ascii'), 'United States\0');

  for (let i = 0; i < 32; i++) e.guest_write8(output + i, 0xcc);
  assert.strictEqual(e.test_locale_info(0x1002, output, 13, 0), 0,
    'undersized country buffer fails without truncating');
  assert.strictEqual(e.test_get_last_error(), 122);
  assert.strictEqual(e.guest_read8(output), 0xcc);

  assert.strictEqual(e.test_locale_info(0x1002, output, 14, 1), 14);
  assert.strictEqual(String.fromCharCode(...Array.from({ length: 13 }, (_, i) =>
    e.guest_read8(output + i * 2) | (e.guest_read8(output + i * 2 + 1) << 8))),
  'United States');
  assert.strictEqual(e.guest_read8(output + 26), 0);
  assert.strictEqual(e.guest_read8(output + 27), 0);

  assert.strictEqual(e.test_locale_info(0x0e, output, 2, 0), 2);
  assert.strictEqual(e.guest_read8(output), '.'.charCodeAt(0),
    'existing decimal-separator behavior remains intact');

  const input = e.guest_alloc(16) >>> 0;
  const esp0 = 0x700000;
  writeAnsi(e, input, '::');
  e.test_set_last_error(0x1234);
  assert.strictEqual(e.test_set_locale_info(0x0409, 0x0e, input, esp0), 1,
    'SetLocaleInfoA accepts a bounded decimal separator');
  assert.strictEqual(e.test_get_esp(), esp0 + 16,
    'SetLocaleInfoA performs one three-argument stdcall cleanup');
  assert.strictEqual(e.test_get_last_error(), 0x1234,
    'successful SetLocaleInfoA leaves last error untouched');

  assert.strictEqual(e.test_locale_info(0x0e, 0, 0, 0), 3,
    'the ANSI size query observes the user override including NUL');
  assert.strictEqual(e.test_locale_info(0x0e, output, 3, 0), 3);
  assert.strictEqual(readAnsi(e, output, 3), '::\0');

  for (let i = 0; i < 16; i++) e.guest_write8(output + i, 0xcc);
  assert.strictEqual(e.test_locale_info(0x0e, output, 3, 1), 3,
    'GetLocaleInfoW widens the same persisted ANSI override');
  assert.strictEqual(readWide(e, output, 3), '::\0');
  assert.strictEqual(e.guest_read8(output + 6), 0xcc,
    'wide retrieval does not write beyond cchData WCHARs');

  assert.strictEqual(e.test_locale_info(0x8000000e, output, 2, 0), 2,
    'LOCALE_NOUSEROVERRIDE bypasses the changed user value');
  assert.strictEqual(readAnsi(e, output, 2), '.\0');

  e.test_set_last_error(0);
  assert.strictEqual(e.test_locale_info(0x0e, output, 2, 0), 0,
    'an undersized override buffer fails without truncation');
  assert.strictEqual(e.test_get_last_error(), 122);
  e.test_set_last_error(0);
  assert.strictEqual(e.test_locale_info(0x0e, 0, 3, 0), 0,
    'a NULL output with nonzero cchData fails');
  assert.strictEqual(e.test_get_last_error(), 122);
  e.test_set_last_error(0);
  assert.strictEqual(e.test_locale_info(0x0e, output, -1, 0), 0,
    'negative cchData is not treated as an enormous unsigned buffer');
  assert.strictEqual(e.test_get_last_error(), 87);

  writeAnsi(e, input, '_');
  assert.strictEqual(e.test_set_locale_info(0x0400, 0x4000000f, input, esp0), 1,
    'LOCALE_USE_CP_ACP is the one combining flag SetLocaleInfoA accepts');
  assert.strictEqual(e.test_locale_info(0x4000000f, output, 2, 0), 2);
  assert.strictEqual(readAnsi(e, output, 2), '_\0');

  writeAnsi(e, input, 'abcd');
  e.test_set_last_error(0);
  assert.strictEqual(e.test_set_locale_info(0x0409, 0x0e, input, esp0), 0,
    'four data characters exceed the documented four-character NUL-inclusive bound');
  assert.strictEqual(e.test_get_last_error(), 87);
  assert.strictEqual(e.test_locale_info(0x0e, output, 3, 0), 3);
  assert.strictEqual(readAnsi(e, output, 3), '::\0',
    'a rejected update preserves the previous override');

  for (const [locale, type, data, expectedError, reason] of [
    [0x0407, 0x0e, input, 87, 'an unadvertised locale'],
    [0x0409, 0x1002, input, 87, 'a Get-only LCType'],
    [0x0409, 0x8000000e, input, 1004, 'LOCALE_NOUSEROVERRIDE on a setter'],
    [0x0409, 0x0e, 0, 87, 'a NULL input string'],
  ]) {
    e.test_set_last_error(0);
    assert.strictEqual(e.test_set_locale_info(locale, type, data, esp0), 0,
      `SetLocaleInfoA rejects ${reason}`);
    assert.strictEqual(e.test_get_last_error(), expectedError, reason);
    assert.strictEqual(e.test_get_esp(), esp0 + 16, `${reason}: stdcall cleanup`);
  }

  e.test_set_last_error(0);
  assert.strictEqual(e.test_locale_info(0x2000000e, output, 4, 0), 0,
    'LOCALE_RETURN_NUMBER is invalid for separator strings');
  assert.strictEqual(e.test_get_last_error(), 1004);

  console.log('PASS  Get/SetLocaleInfoA/W retains bounded Win98 user overrides');
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
