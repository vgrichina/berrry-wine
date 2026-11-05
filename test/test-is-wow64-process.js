#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');

// Resolve the same explicit KERNEL32 image used by DSETUP32, then enter its
// mapped x86 JMP and the production dispatcher. No direct test-only API path.
const extraWat = String.raw`
  (func (export "wow_resolve") (param $library i32) (param $name i32) (result i32)
    (local $esp i32) (local $module i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_LoadLibraryA (local.get $library) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (local.set $module (i32.load (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (call $handle_GetProcAddress (local.get $module) (local.get $name)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.load (global.get $reg_base)))
  (func (export "wow_set_error") (param $v i32) (global.set $last_error (local.get $v)))
  (func (export "wow_error") (result i32) (global.get $last_error))
  (func (export "wow_open_current") (result i32)
    (local $esp i32) (local $handle i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_OpenProcess (i32.const 0x400) (i32.const 0) (call $current_process_id)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (local.set $handle (i32.load (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (local.get $handle))
`;

(async () => {
  // The existing host process authority owns E4 child / E6 alias lifetimes
  // and access masks. A successful numeric-looking handle alone is insufficient.
  const handles = new Map([[0x00e40042, 0x1fffff], [0x00e60043, 0x400],
    [0x00e60044, 0x1000], [0x00e60045, 1]]);
  const accessCalls = [];
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none',
    tailCalls: !process.argv.includes('--compat'), extraHostOverrides: {
      process_ctl(op, handle, mask) {
        accessCalls.push([op, handle >>> 0, mask]);
        assert.equal(op, 6, 'query existing process access authority');
        const access = handles.get(handle >>> 0);
        return access === undefined ? -6 : (access & mask) === mask ? 1 : -5;
      },
    } });
  const fixture = makeFixture();
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length));
  e.set_winver(0x0a280105); // Actual setup profile: XP SP2.
  e.set_process_id(0x321);
  const base = e.guest_alloc(4096) >>> 0, stack = base + 3500;
  const toWasm = g => (g - e.get_image_base() + e.get_guest_base()) >>> 0;
  const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
  const put = (g, s) => bytes.set(Buffer.from(s + '\0', 'ascii'), toWasm(g));
  put(base, 'kernel32.dll');
  put(base + 32, 'IsWow64Process');
  put(base + 64, 'GetNativeSystemInfo');
  put(base + 96, 'DefinitelyMissingWow64Process');
  assert.equal(e.wow_resolve(base, base + 96), 0, 'unknown exports remain absent');
  const resolve = name => {
    const entry = e.wow_resolve(base, name) >>> 0;
    assert.notEqual(entry, 0, 'dynamic KERNEL32 export must resolve');
    assert.equal(view.getUint8(toWasm(entry)), 0xe9, 'mapped export is an x86 JMP');
    const thunk = (entry + 5 + view.getInt32(toWasm(entry + 1), true)) >>> 0;
    assert(thunk >= e.get_thunk_base() && thunk < e.get_thunk_end());
    return entry;
  };
  const entry = resolve(base + 32), native = resolve(base + 64);
  const invoke = (target, handle, output, argc = 2) => {
    e.set_esp(stack);
    e.wow_set_error(0x1234);
    e.call_func(target, handle, output, 0, 0);
    const before = e.get_esp() >>> 0;
    view.setUint32(toWasm(before + 4 + argc * 4), 0xfeedbeef, true);
    for (let i = 0; i < 20 && e.get_eip(); i++) e.run(100);
    assert.equal(e.get_eip(), 0, 'ordinary guest call must return');
    assert.equal(e.get_esp() >>> 0, before + 4 + argc * 4, 'exact stdcall cleanup');
    assert.equal(view.getUint32(toWasm(before + 4 + argc * 4), true), 0xfeedbeef);
    return e.get_eax() >>> 0;
  };
  // Confirm the installed guest OS model, independently of the JS host CPU.
  invoke(native, base + 256, 0, 1);
  assert.equal(view.getUint16(toWasm(base + 256), true), 0, 'native OS is x86');
  const output = base + 513; // Unaligned PBOOL is valid on x86.
  const check = (handle, expected, error) => {
    bytes.fill(0xa5, toWasm(output - 4), toWasm(output + 8));
    const result = invoke(entry, handle, output);
    assert.equal(result, expected);
    assert.equal(e.wow_error(), error);
    assert.equal(view.getUint32(toWasm(output), true), expected ? 0 : 0xa5a5a5a5,
      'success writes FALSE; failure does not publish a false result');
    assert(bytes.subarray(toWasm(output - 4), toWasm(output)).every(b => b === 0xa5));
    assert(bytes.subarray(toWasm(output + 4), toWasm(output + 8)).every(b => b === 0xa5),
      'PBOOL is exactly four bytes');
  };
  check(-1, 1, 0x1234);
  assert.equal(accessCalls.length, 0, 'contextual current handle needs no child lookup');
  const current = e.wow_open_current() >>> 0;
  assert.notEqual(current, 0);
  check(current, 1, 0x1234);
  check(-1, 1, 0x1234); // Repeated poisoned destination must be filled again.
  for (const invalid of [0, 1, -2, 0x000e2322, 0xdeadbeef, 0x00e40099]) check(invalid, 0, 6);
  check(0x00e40042, 1, 0x1234);
  check(0x00e60043, 1, 0x1234);
  check(0x00e60044, 0, 5); // XP needs QUERY_INFORMATION, not LIMITED_INFORMATION.
  check(0x00e60045, 0, 5);
  assert(accessCalls.every(([op, , mask]) => op === 6 && mask === 0x400));
  handles.delete(0x00e60043);
  check(0x00e60043, 0, 6, 'closed process alias must fail');
  for (const badPointer of [0, 0xfffffffe]) {
    assert.equal(invoke(entry, -1, badPointer), 0, 'unwritable PBOOL must fail');
    assert.equal(e.wow_error(), 998, 'ERROR_NOACCESS');
  }
  assert.equal(e.wow_resolve(base, base + 96), 0);
  console.log('PASS IsWow64Process dynamic export, mapped x86 call, native FALSE output, exact BOOL/ABI, process authority/access/lifetime and bad pointers');
})().catch(error => { console.error(error); process.exitCode = 1; });
