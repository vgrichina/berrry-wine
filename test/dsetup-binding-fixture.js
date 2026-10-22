'use strict';

// Ordinal-only fixture: real JS import patch dispatcher -> verbatim WAT
// patch_caller_iat -> verbatim resolve_ordinal. Never execute mapped x86.
// Untested named/CRT/thunk paths trap so an accidental detour cannot pass.
const fs = require('fs');
const { sourceFunction } = require('./wat-source-function');
const { compile } = require('../tools/watx');

function compileBindingFixture() {
  const source = fs.readFileSync(require.resolve('../src/08b-dll-loader.wat'), 'utf8');
  const helper = fs.readFileSync(require.resolve('../src/10-helpers.wat'), 'utf8');
  const functions = ['patch_caller_iat', 'resolve_ordinal', 'resolve_ordinal_locked', 'parse_exports']
    .map(n => sourceFunction(source, n));
  functions.push(...['dll_name_match', 'tolower'].map(n => sourceFunction(helper, n)));
  const trap = (name, count, result = true) => `(func $${name} ${'(param i32) '.repeat(count)}
    ${result ? '(result i32)' : ''} (unreachable))`;
  const wat = `
    (import "host" "memory" (memory 16 8192 shared))
    (global $DLL_SHARED i32 (i32.const 0x1000))
    (global $DLL_TABLE i32 (i32.const 0x1100))
    (global $DLL_LIFE_FREE i32 (i32.const 0))
    (global $DLL_LOAD_LOCK i32 (i32.const 0x1200))
    (global $THUNK_BASE i32 (i32.const 0))
    (global $GUEST_BASE i32 (i32.const 0x12000))
    (global $image_base i32 (i32.const 0x400000))
    (global $num_thunks (mut i32) (i32.const 0))
    (func $g2w (param $p i32) (result i32)
      (i32.add (i32.sub (local.get $p) (global.get $image_base)) (global.get $GUEST_BASE)))
    (func $gl8 (param $p i32) (result i32) (i32.load8_u (call $g2w (local.get $p))))
    (func $dll_lifecycle_row (param i32) (result i32) (i32.const 0x1300))
    (func $dll_load_lock_begin) (func $lock_release (param i32))
    ${trap('iat_slot_name_rva', 2)} ${trap('native_override_export_api_id', 1)}
    ${trap('crt_dll_is_msvcr', 1)} ${trap('crt_native_override_defers', 1)}
    ${trap('resolve_name_export', 2)} ${trap('crt_override_api_id', 1)}
    ${trap('thunk_reserve', 0)} ${trap('crt_override_record', 2)} ${trap('update_thunk_end', 0, false)}
    ${functions.join('\n')}
    (func (export "prepare") (param $base i32) (param $exp i32)
      (i32.store (global.get $DLL_SHARED) (i32.const 1))
      (i32.store (i32.const 0x1300) (i32.const 2))
      (i32.store (global.get $DLL_TABLE) (local.get $base))
      (call $parse_exports (global.get $DLL_TABLE) (local.get $base) (local.get $exp)))
    (func (export "get_image_base") (result i32) (global.get $image_base))
    (func (export "get_guest_base") (result i32) (global.get $GUEST_BASE))
    (func (export "get_dll_count") (result i32) (i32.load (global.get $DLL_SHARED)))
    (func (export "get_dll_table") (result i32) (global.get $DLL_TABLE))
    (func (export "ordinal") (param $n i32) (result i32) (call $resolve_ordinal (i32.const 0) (local.get $n)))
  `;
  const r = compile(wat, new Map(), {mode: 'production', standardWat: true,
    runtimeBuiltins: false, strictDeclarations: true});
  if (!r.success) throw new Error(JSON.stringify(r));
  return r.wasmBinary;
}
module.exports = { compileBindingFixture };
