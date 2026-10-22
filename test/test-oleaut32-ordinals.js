#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');
const realApiTable = require('../src/api_table.json');

const memory = new WebAssembly.Memory({ initial: 1 });
const dllNameWA = 0x100;
new Uint8Array(memory.buffer).set(Buffer.from('OLEAUT32.dll\0', 'ascii'), dllNameWA);

const apiTable = [
  { id: 970, name: 'LoadTypeLib' },
  { id: 3315, name: 'SysAllocStringByteLen' },
  { id: 3316, name: 'SysStringByteLen' },
  { id: 2406, name: 'VariantInit' },
];
const { host } = createHostImports({
  getMemory: () => memory.buffer,
  renderer: null,
  resourceJson: {},
  apiTable,
});

const extraWat = String.raw`
  (func (export "test_system_ordinal") (param $dll i32) (param $ordinal i32) (result i32)
    (call $system_ordinal_api_id (local.get $dll) (local.get $ordinal)))
  (func (export "test_dynamic_call") (param $api i32) (param $a i32) (param $b i32)
                                    (param $sp i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (call $dispatch_api_table (local.get $api) (local.get $a) (local.get $b)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "test_invoke_thunk") (param $thunk i32) (param $sp i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (global.set $eip (local.get $thunk))
    (call $run (i32.const 1)))
  (func (export "test_return_eip") (result i32) (global.get $eip))
`;

(async () => {
  const wasm = compileSrcWasm((file, source) =>
    file === '13-exports.wat' ? `${source}\n${extraWat}\n` : source);
  const guestMemory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => guestMemory.buffer, renderer: null,
    resourceJson: {}, apiTable: realApiTable };
  const imports = createHostImports(ctx);
  Object.assign(imports.host, { memory: guestMemory,
    create_thread: () => 0, exit_thread: () => 0, terminate_thread: () => 0,
    create_event: () => 0, set_event: () => 0, reset_event: () => 0,
    wait_single: () => 0, wait_multiple: () => 0, com_create_instance: () => 0x80004002 });
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const wat = instance.exports;
  ctx.exports = wat;
  const exe = fs.readFileSync(path.join(__dirname, 'binaries', 'calc.exe'));
  new Uint8Array(guestMemory.buffer).set(exe, wat.get_staging());
  assert(wat.load_pe(exe.length), 'fixture PE initializes the real loader and thunk table');
  const image = wat.get_image_base() >>> 0;
  const stack = 0x074ff000;
  const id = name => realApiTable.find(e => e.name === name).id;
  const str = text => {
    const p = wat.guest_alloc(text.length + 1) >>> 0;
    Buffer.from(text + '\0', 'ascii').forEach((b, i) => wat.guest_write8(p + i, b));
    return p;
  };
  const call = (name, a, b = 0, pop = 8) => {
    const value = wat.test_dynamic_call(id(name), a, b, stack) >>> 0;
    assert.strictEqual(wat.get_esp() >>> 0, stack + pop, `${name} stdcall cleanup`);
    return value;
  };
  const load = text => call('LoadLibraryA', str(text));
  const lookup = (module, ordinal) => call('GetProcAddress', module, ordinal, 12);
  const oleaut = load('OLEAUT32.dll');
  const dynamic = lookup(oleaut, 8);
  console.log(JSON.stringify({ image, oleaut, ordinal: 8, dynamic,
    moduleSha256: require('crypto').createHash('sha256').update(wasm).digest('hex') }));
  // Explicit diagnostic mode proves the original dynamic failure on the exact
  // baseline source. Normal regression execution always requires the repair.
  if (process.argv.includes('--expect-baseline')) {
    assert.strictEqual(oleaut, image, 'baseline aliases OLEAUT32 to the EXE');
    assert.strictEqual(dynamic, 0, 'baseline actual dynamic ordinal lookup fails');
    assert.strictEqual(host.resolve_ordinal(dllNameWA, 8), -1);
    console.log('PASS baseline dynamic LoadLibraryA + GetProcAddress reproduces NULL');
    return;
  }
  assert.notStrictEqual(oleaut, image, 'OLEAUT32 retains module identity instead of EXE alias');
  assert.notStrictEqual(dynamic, 0, 'dynamic ordinal 8 returns an executable API thunk');
  assert.strictEqual(host.resolve_ordinal(dllNameWA, 8), id('VariantInit'));
  assert.strictEqual(host.resolve_ordinal(dllNameWA, 149), 3316,
    'host OLEAUT32 ordinal 149 resolves SysStringByteLen');
  assert.strictEqual(host.resolve_ordinal(dllNameWA, 150), 3315,
    'host OLEAUT32 ordinal 150 resolves SysAllocStringByteLen');
  assert.notStrictEqual(host.resolve_ordinal(dllNameWA, 150), 970,
    'host OLEAUT32 ordinal 150 must not masquerade as LoadTypeLib');
  assert.strictEqual(host.resolve_ordinal(dllNameWA, 151), -1,
    'unknown neighboring host OLEAUT32 ordinals remain fail-fast diagnostics');

  const dllNameGA = str('OLEAUT32.dll');
  Buffer.from('OLEAUT32.dll\0', 'ascii').forEach((value, i) =>
    wat.guest_write8(dllNameGA + i, value));
  assert.strictEqual(wat.test_system_ordinal(dllNameGA, 149), 3316,
    'guest DLL resolver maps ordinal 149 to SysStringByteLen');
  assert.strictEqual(wat.test_system_ordinal(dllNameGA, 150), 3315,
    'guest DLL resolver maps ordinal 150 to SysAllocStringByteLen');
  assert.strictEqual(wat.test_system_ordinal(dllNameGA, 151), -1,
    'guest DLL resolver leaves unknown neighboring ordinals to the host fallback');
  assert.strictEqual(wat.test_system_ordinal(dllNameGA, 8), id('VariantInit'),
    'existing static ordinal import still resolves VariantInit');

  for (const spelling of ['oleaut32', 'OlEaUt32.DlL', 'C:\\WINDOWS\\SYSTEM\\OLEAUT32.dll']) {
    assert.strictEqual(load(spelling), oleaut, 'equivalent module names retain the same identity');
    assert.strictEqual(call('GetModuleHandleA', str(spelling)), oleaut);
  }
  for (const ordinal of [0, 151, 65535]) {
    assert.strictEqual(lookup(oleaut, ordinal), 0, `unsupported OLEAUT32 ordinal ${ordinal} stays NULL`);
  }
  for (const module of [image, load('KERNEL32.dll'), load('unprovided.dll'), load('OLE32.dll'), 0x12345678]) {
    assert.strictEqual(lookup(module, 8), 0, 'unrelated handles and image aliases must not become OLEAUT32');
  }
  const comctl = load('COMCTL32.dll');
  assert.notStrictEqual(lookup(comctl, 8), dynamic,
    'the same ordinal in another static DLL must not inherit the OLEAUT32 thunk');
  assert.strictEqual(wat.guest_read32(dynamic + 4), id('VariantInit'));

  // Invoke the pointer returned by GetProcAddress through the actual thunk
  // dispatcher, with the real guest argument/return frame. A VariantClear
  // misroute would try to release this deliberately invalid VT_UNKNOWN pointer.
  const variant = wat.guest_alloc(24) >>> 0;
  for (let i = 0; i < 24; i++) wat.guest_write8(variant + i, 0xa5);
  wat.guest_write16(variant + 4, 13); // VT_UNKNOWN, deliberately uninitialized
  wat.guest_write32(variant + 12, 0xdeadbeef);
  wat.guest_write32(stack, 0x00402000);
  wat.guest_write32(stack + 4, variant + 4);
  wat.guest_write32(stack + 8, 0x13579bdf);
  wat.test_invoke_thunk(dynamic, stack);
  assert.strictEqual(wat.get_esp() >>> 0, stack + 8, 'VariantInit pops return + one argument');
  assert.strictEqual(wat.test_return_eip() >>> 0, 0x00402000, 'thunk returns to the guest continuation');
  assert.deepStrictEqual(Array.from({ length: 16 }, (_, i) => wat.guest_read8(variant + 4 + i)),
    Array(16).fill(0), 'actual VariantInit marks garbage VT_EMPTY and clears the union');
  for (const offset of [0, 1, 2, 3, 20, 21, 22, 23]) {
    assert.strictEqual(wat.guest_read8(variant + offset), 0xa5, 'VariantInit preserves adjacent storage');
  }
  assert.strictEqual(wat.guest_read32(stack + 8) >>> 0, 0x13579bdf, 'caller stack remains intact');

  console.log('PASS OLEAUT32 dynamic identity, ordinal thunk/VariantInit ABI, static/BSTR ordinals and negative controls');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
