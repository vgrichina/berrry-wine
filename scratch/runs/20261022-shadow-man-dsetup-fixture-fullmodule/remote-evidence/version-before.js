'use strict';

// Standalone VERSION source fixture, not the full emulator or an x86 guest.
// Execute the real resource parser, query walker and A/W handlers. Substitute
// only flat guest memory, allocator and host wiring; use the real VFS imports.
const fs = require('fs');
const path = require('path');
const { sourceFunction } = require('./wat-source-function');
const { compile } = require('../tools/watx');
const { createFilesystemImports } = require('../lib/filesystem');
const root = path.resolve(__dirname, '..');

function createHostImports(ctx) {
  const host = createFilesystemImports(ctx);
  return { host };
}

function compileSrcWasm(_transform, { source: override, extraWat = '' } = {}) {
  const source = override || fs.readFileSync(path.join(root, 'src/09a1-comctl-handlers.wat'), 'utf8');
  const helper = fs.readFileSync(path.join(root, 'src/10-helpers.wat'), 'utf8');
  const names = [
    'version_read_exact', 'version_rsrc_child', 'version_ne_resource',
    'file_version_resource', 'file_version_info_size_named', 'file_version_info_named',
    'version_is_ne', 'version_value_offset', 'version_value_bytes',
    'version_find_node', 'version_ne_text_path', 'version_query',
    'handle_GetFileVersionInfoSizeA', 'handle_GetFileVersionInfoA',
    'handle_GetFileVersionInfoSizeW', 'handle_GetFileVersionInfoW',
    'handle_VerQueryValueA', 'handle_VerQueryValueW',
  ];
  const functions = names.map(n => sourceFunction(source, n));
  // Encoding helpers are also taken from production, with their dependencies.
  functions.push(sourceFunction(helper, 'tolower'));
  functions.push(sourceFunction(fs.readFileSync(path.join(root, 'src/10c-truetype.wat'), 'utf8'), 'tt_cp1252_to_unicode'));
  const wrappers = [
    ['GetFileVersionInfoSizeA', 2], ['GetFileVersionInfoSizeW', 2],
    ['GetFileVersionInfoA', 4], ['GetFileVersionInfoW', 4],
    ['VerQueryValueA', 4], ['VerQueryValueW', 4],
  ].map(([name, count]) => `(func (export "test_call_${name}")
    ${Array.from({length: count}, (_, i) => `(param $p${i} i32)`).join(' ')} (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00b00000))
    (call $handle_${name} ${Array.from({length: 6}, (_, i) => i < count ? `(local.get $p${i})` : '(i32.const 0)').join(' ')})
    (i32.load (global.get $reg_base)))`).join('\n');
  const wat = `
    (import "host" "memory" (memory 16 8192 shared))
    (import "host" "fs_create_file" (func $host_fs_create_file (param i32 i32 i32 i32 i32) (result i32)))
    (import "host" "fs_read_file" (func $host_fs_read_file (param i32 i32 i32 i32) (result i32)))
    (import "host" "fs_close_handle" (func $host_fs_close_handle (param i32) (result i32)))
    (import "host" "fs_set_file_pointer" (func $host_fs_set_file_pointer (param i32 i32 i32) (result i32)))
    (import "host" "fs_get_file_size" (func $host_fs_get_file_size (param i32) (result i32)))
    (global $reg_base i32 (i32.const 0x1000))
    (global $heap (mut i32) (i32.const 0x00500000))
    (global $version_query_scratch (mut i32) (i32.const 0))
    ${extraWat}
    (func (export "get_image_base") (result i32) (i32.const 0x00400000))
    (func (export "get_guest_base") (result i32) (i32.const 0x00012000))
    (func (export "get_esp") (result i32) (i32.load offset=16 (global.get $reg_base)))
    (func $g2w (param $p i32) (result i32) (i32.add (i32.sub (local.get $p) (i32.const 0x00400000)) (i32.const 0x00012000)))
    (func $gl8 (param $p i32) (result i32) (i32.load8_u (call $g2w (local.get $p))))
    (func $gl16 (param $p i32) (result i32) (i32.load16_u (call $g2w (local.get $p))))
    (func $gl32 (param $p i32) (result i32) (i32.load (call $g2w (local.get $p))))
    (func $gs8 (param $p i32) (param $v i32) (i32.store8 (call $g2w (local.get $p)) (local.get $v)))
    (func $gs16 (param $p i32) (param $v i32) (i32.store16 (call $g2w (local.get $p)) (local.get $v)))
    (func $gs32 (param $p i32) (param $v i32) (i32.store (call $g2w (local.get $p)) (local.get $v)))
    (func $fmt_get (param $p i32) (param $wide i32) (result i32)
      (if (result i32) (local.get $wide) (then (call $gl16 (local.get $p))) (else (call $gl8 (local.get $p)))))
    (func $heap_alloc (export "guest_alloc") (param $size i32) (result i32) (local $p i32)
      (local.set $p (global.get $heap))
      (global.set $heap (i32.and (i32.add (i32.add (global.get $heap) (local.get $size)) (i32.const 7)) (i32.const -8)))
      (local.get $p))
    (func $heap_free (param i32))
    ${functions.join('\n')}
    ${wrappers}
    (func (export "query_wide") (param $b i32) (param $p i32) (param $o i32) (param $n i32) (result i32)
      (call $version_query (local.get $b) (local.get $p) (local.get $o) (local.get $n) (i32.const 1)))
  `;
  const result = compile(wat, new Map(), {mode: 'production', standardWat: true,
    runtimeBuiltins: false, strictDeclarations: true});
  if (!result.success) throw new Error(JSON.stringify(result));
  return result.wasmBinary;
}

module.exports = { createHostImports, compileSrcWasm };
