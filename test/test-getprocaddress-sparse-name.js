#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (global $test_sparse_thunk (mut i32) (i32.const 0))

  (func (export "test_last_error") (result i32) (global.get $last_error))
  (func (export "test_clear_last_error") (global.set $last_error (i32.const 0)))
  (func (export "test_loaded_module_live") (param $live i32)
    (i32.atomic.store (call $dll_lifecycle_row (i32.const 0))
      (select (global.get $DLL_LIFE_LIVE) (global.get $DLL_LIFE_FREE) (local.get $live))))
  (func (export "test_register_loaded_module") (param $base i32)
    ;; DLL_TABLE alone is not a loaded module. Mirror the loader's separate
    ;; lifecycle row: a fresh generation with an explicit root, published LIVE.
    (memory.fill (call $dll_lifecycle_row (i32.const 0)) (i32.const 0) (i32.const 64))
    (i32.store offset=4 (call $dll_lifecycle_row (i32.const 0)) (i32.const 1))
    (i32.store offset=8 (call $dll_lifecycle_row (i32.const 0)) (i32.const 1))
    (i32.store (global.get $DLL_TABLE) (local.get $base))
    (i32.store offset=8 (global.get $DLL_TABLE) (i32.const 0x800))
    (i32.store offset=12 (global.get $DLL_TABLE) (i32.const 2))
    (i32.store offset=16 (global.get $DLL_TABLE) (i32.const 2229))
    (i32.store offset=20 (global.get $DLL_TABLE) (i32.const 0x900))
    (i32.store offset=24 (global.get $DLL_TABLE) (i32.const 0x910))
    (i32.store offset=28 (global.get $DLL_TABLE) (i32.const 0x920))
    (i32.atomic.store (call $dll_lifecycle_row (i32.const 0)) (global.get $DLL_LIFE_LIVE))
    (i32.atomic.store (global.get $DLL_SHARED) (i32.const 1)))

  (func (export "test_get_proc_image") (param $module i32) (param $name i32) (param $stack i32) (result i32)
    ;; A secondary instance has not run load_pe: its per-instance export RVA
    ;; remains zero even though the process-shared image is already mapped.
    (global.set $exe_export_rva (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_GetProcAddress (local.get $module) (local.get $name)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))

  (func (export "test_get_proc_sparse") (param $stack i32) (result i32)
    (local $name i32)
    (local.set $name (call $heap_alloc (i32.const 13)))
    (i32.store (call $g2w (local.get $name)) (i32.const 0x54746547)) ;; "GetT"
    (i32.store offset=4 (call $g2w (local.get $name)) (i32.const 0x436b6369)) ;; "ickC"
    (i32.store offset=8 (call $g2w (local.get $name)) (i32.const 0x746e756f)) ;; "ount"
    (i32.store8 offset=12 (call $g2w (local.get $name)) (i32.const 0))

    ;; Exhaust the direct heap cursor so GetProcAddress's private copy of the
    ;; import name must come from a sparse high guest mapping.
    (global.set $heap_ptr (i32.const 0))
    (global.set $heap_end (i32.const 0))
    (i32.atomic.store (global.get $HEAP_SHARED) (i32.const -1))

    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_GetProcAddress
      (global.get $image_base) (local.get $name) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.set $test_sparse_thunk
      (i32.sub (global.get $num_thunks) (i32.const 1)))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_sparse_name_length") (result i32)
    (local $name_rva i32)
    (local.set $name_rva
      (i32.load (i32.add (global.get $THUNK_BASE)
        (i32.mul (global.get $test_sparse_thunk) (i32.const 8)))))
    (call $strlen
      (i32.add (global.get $GUEST_BASE)
        (i32.add (local.get $name_rva) (i32.const 2)))))

  (func (export "test_dispatch_sparse_thunk") (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (local.get $stack) (i32.const 0x12345678))
    (call $win32_dispatch (global.get $test_sparse_thunk))
    (i32.load offset=16 (global.get $reg_base)))

  (func (export "test_sparse_heap_active") (result i32)
    (global.get $heap_sparse_ptr))
`;

(async () => {
  const diagnostics = [];
  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none',
    extraHostOverrides: { log_i32: value => diagnostics.push(value >>> 0) } });
  const stack = 0x074ff000;

  // Minimal mapped PE export directory, no DLL_TABLE entry. The name and
  // ordinal are Hype's actual callback; the target is synthetic and never run.
  const image = wat.get_image_base() >>> 0;
  const put = (rva, value) => wat.guest_write32(image + rva, value);
  const string = (rva, text) => {
    for (let i = 0; i <= text.length; i++) wat.guest_write8(image + rva + i, text.charCodeAt(i) || 0);
  };
  put(0, 0x5a4d); put(0x3c, 0x80); put(0x80, 0x4550);
  put(0x80 + 120, 0x800);
  put(0x80 + 124, 0x400);
  put(0x800 + 16, 2229); // ordinal base
  put(0x800 + 20, 2); // address table includes one absent export
  put(0x800 + 24, 1);
  put(0x800 + 28, 0x900); put(0x800 + 32, 0x910); put(0x800 + 36, 0x920);
  put(0x900, 0x2000); put(0x904, 0); put(0x910, 0x10000);
  wat.guest_write16(image + 0x920, 0);
  // Harness image_base is zero: keep name pointers above MAKEINTRESOURCE's
  // 16-bit ordinal range, just as a real loaded Win32 image does.
  string(0x10000, '_SND_fn_vDisplayError@8');
  string(0x10100, 'AbsentGuestCallback');
  const lookup = name => {
    const result = wat.test_get_proc_image(image, name, stack) >>> 0;
    assert.strictEqual(wat.get_esp() >>> 0, stack + 12, 'GetProcAddress stdcall cleanup');
    return result;
  };
  assert.strictEqual(lookup(image + 0x10000), image + 0x2000, 'main EXE callback resolves by name');
  assert.strictEqual(lookup(2229), image + 0x2000, 'main EXE callback resolves by ordinal');
  assert.strictEqual(lookup(2230), 0, 'absent address-table entry returns NULL');
  assert.strictEqual(lookup(2228), 0, 'ordinal below base returns NULL');
  assert.strictEqual(lookup(2231), 0, 'ordinal beyond table returns NULL');
  assert.strictEqual(lookup(image + 0x10100), 0, 'unknown callback returns NULL');
  // The image base also stands in for a bare DLL name nothing on disk
  // provides. COM self-registration belongs to a real server image, so the
  // API-by-name fallback must not hand out a registration entry point
  // (Explorer registers ACTXPRXY.DLL this way at startup).
  string(0x10200, 'DllRegisterServer');
  string(0x10300, 'DllUnregisterServer');
  for (const at of [0x10200, 0x10300]) {
    wat.test_clear_last_error();
    assert.strictEqual(lookup(image + at), 0, 'COM self-registration is not an API-by-name export');
    assert.strictEqual(wat.test_last_error() >>> 0, 127, 'ERROR_PROC_NOT_FOUND');
  }

  string(0x850, 'KERNEL32.GetTickCount');
  put(0x900, 0x850);
  for (const name of [image + 0x10000, 2229]) {
    assert.throws(() => lookup(name), WebAssembly.RuntimeError,
      'forwarded EXE export must fail explicitly rather than return string bytes as code');
    assert.deepStrictEqual(diagnostics.slice(-2), [0x46574452, image + 0x850],
      'forwarder failure reports FWDR and the forwarder address');
  }
  put(0x900, 0x2000);
  assert.strictEqual(lookup(image + 0x10000), image + 0x2000, 'ordinary export still resolves after forwarder fixture');

  // A mapped DLL missing a name must not inherit a same-named global API.
  // SmartHeap probes C4dll-R for optional CRT exports before patching them.
  const dll = image + 0x200000;
  const dllPut = (rva, value) => wat.guest_write32(dll + rva, value);
  dllPut(0x800 + 24, 1);
  dllPut(0x900, 0x2000); dllPut(0x904, 0x2010); dllPut(0x910, 0x10000);
  wat.guest_write16(dll + 0x920, 0);
  for (let i = 0; i < 13; i++) wat.guest_write8(dll + 0x10000 + i, 'PresentEntry\0'.charCodeAt(i));
  wat.test_register_loaded_module(dll);
  const dllLookup = name => {
    const result = wat.test_get_proc_image(dll, name, stack) >>> 0;
    assert.strictEqual(wat.get_esp() >>> 0, stack + 12, 'loaded DLL lookup pops both arguments');
    return result;
  };
  assert.strictEqual(dllLookup(dll + 0x10000), dll + 0x2000, 'real named export resolves');
  assert.strictEqual(dllLookup(2229), dll + 0x2000, 'real ordinal export resolves');
  // A retained export-table row after release is not a live loaded module.
  // This also rejects a resolver that ignores lifecycle state to make the
  // malformed, pre-lifecycle version of this fixture pass.
  wat.test_loaded_module_live(0);
  for (const name of [dll + 0x10000, 2229]) {
    const count = wat.get_num_thunks();
    assert.strictEqual(dllLookup(name), 0, 'FREE DLL row cannot resolve an export');
    assert.strictEqual(wat.test_last_error(), 6, 'FREE DLL row is ERROR_INVALID_HANDLE');
    assert.strictEqual(wat.get_num_thunks(), count, 'FREE DLL row creates no fallback thunk');
  }
  wat.test_loaded_module_live(1);
  assert.strictEqual(dllLookup(dll + 0x10000), dll + 0x2000, 'LIVE named export resolves again');
  assert.strictEqual(dllLookup(2229), dll + 0x2000, 'LIVE ordinal export resolves again');
  for (const name of ['malloc', 'calloc', 'free', 'GetTickCount', 'DefinitelyAbsentExport']) {
    string(0x10400, name);
    wat.test_clear_last_error();
    const count = wat.get_num_thunks();
    assert.strictEqual(dllLookup(image + 0x10400), 0, `loaded DLL missing ${name} returns NULL`);
    assert.strictEqual(wat.test_last_error(), 127, 'ERROR_PROC_NOT_FOUND');
    assert.strictEqual(wat.get_num_thunks(), count, 'missing export does not allocate a fake thunk');
  }
  // The same name resolves when it actually belongs to this module.
  dllPut(0x800 + 24, 2); dllPut(0x914, 0x10100);
  wat.guest_write16(dll + 0x922, 1);
  [...Buffer.from('malloc\0')].forEach((v, i) => wat.guest_write8(dll + 0x10100 + i, v));
  assert.strictEqual(dllLookup(dll + 0x10100), dll + 0x2010, 'authentic malloc export remains callable');

  assert.notStrictEqual(wat.test_get_proc_sparse(stack) >>> 0, 0,
    'GetProcAddress(GetTickCount) returns a dynamic thunk');
  assert.notStrictEqual(wat.test_sparse_heap_active() >>> 0, 0,
    'GetProcAddress copied the import name into the sparse heap');
  assert.strictEqual(wat.test_sparse_name_length() >>> 0, 12,
    'dynamic thunk reconstructs its sparse import name in WASM backing memory');
  assert.strictEqual(wat.test_dispatch_sparse_thunk(stack) >>> 0, stack + 4,
    'dispatch reads the sparse import name and calls the API without trapping');

  console.log('PASS  GetProcAddress resolves main-image exports and dispatches sparse dynamic names');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
