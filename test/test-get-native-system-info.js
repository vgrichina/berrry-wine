#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');

// Reproduce DSETUP32's dynamic kernel32 lookup and call the actual dispatcher.
// The emulator runs a native 32-bit x86 OS model, without a WOW64 layer.
const extraWat = String.raw`
  (func (export "gnsi_resolve") (param $library i32) (param $name i32) (result i32)
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
  (func (export "gnsi_dispatch") (param $thunk i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $win32_dispatch (i32.div_u
      (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 8)))
    (i32.load offset=16 (global.get $reg_base)))
  (func (export "gnsi_set_error") (param $value i32)
    (global.set $last_error (local.get $value)))
  (func (export "gnsi_error") (result i32) (global.get $last_error))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none',
    tailCalls: !process.argv.includes('--compat') });
  const fixture = makeFixture();
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'initialize real PE loader and thunk arena');
  e.set_winver(0x0a280105); // XP, matching the original setup session.
  const base = e.guest_alloc(512) >>> 0, stack = base + 384;
  const toWasm = g => (g - e.get_image_base() + e.get_guest_base()) >>> 0;
  const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
  const put = (g, s) => bytes.set(Buffer.from(s + '\0', 'ascii'), toWasm(g));
  put(base, 'kernel32.dll');
  put(base + 32, 'GetNativeSystemInfo');
  put(base + 64, 'GetSystemInfo');
  put(base + 96, 'DefinitelyMissingSystemInfo');
  assert.equal(e.gnsi_resolve(base, base + 96), 0, 'unknown export stays absent');
  // KERNEL32 has an explicit mapped PE export image. Lookup must find its
  // in-image E9 entry, whose target is the real native dispatch thunk.
  const resolve = name => {
    const entry = e.gnsi_resolve(base, name) >>> 0;
    assert.notEqual(entry, 0, 'dynamic lookup must resolve a real KERNEL32 PE export');
    assert.equal(view.getUint8(toWasm(entry)), 0xe9, 'mapped export JMP entry');
    const thunk = (entry + 5 + view.getInt32(toWasm(entry + 1), true)) >>> 0;
    assert(thunk >= e.get_thunk_base() && thunk < e.get_thunk_end(), 'export targets production dispatch');
    return thunk;
  };
  const native = resolve(base + 32), system = resolve(base + 64);
  const call = (thunk, out, poison) => {
    bytes.fill(poison, toWasm(out - 4), toWasm(out + 40));
    view.setUint32(toWasm(stack), 0x12345678, true);
    view.setUint32(toWasm(stack + 4), out, true);
    view.setUint32(toWasm(stack + 8), 0xfeedbeef, true);
    e.gnsi_set_error(0x1234);
    assert.equal(e.gnsi_dispatch(thunk, stack) >>> 0, stack + 8,
      'one-argument stdcall consumes exactly return address and pointer');
    assert.equal(view.getUint32(toWasm(stack + 8), true), 0xfeedbeef, 'caller frame intact');
    assert.equal(e.gnsi_error(), 0x1234, 'query leaves last error alone');
    assert(bytes.subarray(toWasm(out - 4), toWasm(out)).every(b => b === poison));
    assert(bytes.subarray(toWasm(out + 36), toWasm(out + 40)).every(b => b === poison),
      '36-byte x86 structure cannot overrun the destination');
    return [...new Uint32Array(memory.buffer, toWasm(out), 9)];
  };
  // Independent ABI/model oracle, including reserved fields. Architecture is
  // INTEL(0), never the host's AMD64/ARM64 or the installer's queried IA64(6).
  const expected = [0, 4096, 0x10000, 0x7ffeffff, 1, 1, 586, 0x10000, 6];
  const nativeOut = base + 132, systemOut = base + 196;
  assert.deepEqual(call(native, nativeOut, 0xa5), expected, 'native x86 SYSTEM_INFO fields');
  assert.deepEqual(call(system, systemOut, 0x5a), expected, 'existing GetSystemInfo remains consistent');
  assert.deepEqual(call(native, systemOut, 0xcc), expected, 'query fills a different poisoned buffer');
  // Also execute the mapped x86 JMP and normal guest return path, rather
  // than relying solely on the directly invoked dispatcher above.
  const entry = e.gnsi_resolve(base, base + 32) >>> 0;
  bytes.fill(0xdd, toWasm(nativeOut - 4), toWasm(nativeOut + 40));
  e.set_esp(stack);
  e.call_func(entry, nativeOut, 0, 0, 0);
  const before = e.get_esp() >>> 0;
  view.setUint32(toWasm(before + 8), 0xfeedbeef, true);
  for (let i = 0; i < 20 && e.get_eip(); i++) e.run(100);
  assert.equal(e.get_eip(), 0, 'mapped x86 export returns through the ordinary guest call');
  assert.equal(e.get_esp() >>> 0, before + 8, 'x86 entry preserves stdcall cleanup');
  assert.equal(view.getUint32(toWasm(before + 8), true), 0xfeedbeef);
  assert.deepEqual([...new Uint32Array(memory.buffer, toWasm(nativeOut), 9)], expected);
  assert(bytes.subarray(toWasm(nativeOut - 4), toWasm(nativeOut)).every(b => b === 0xdd));
  assert(bytes.subarray(toWasm(nativeOut + 36), toWasm(nativeOut + 40)).every(b => b === 0xdd));
  console.log('PASS GetNativeSystemInfo dynamic kernel32 lookup, production dispatch, native x86 SYSTEM_INFO, bounded writes, repeated queries and stdcall');
})().catch(error => { console.error(error); process.exitCode = 1; });
