'use strict';
// Source-only branch probe. The full production handler, descriptor discriminator
// and object layout in exact-handler.wat are unmodified extracted forms.
// Fixtures replace surrounding memory/object helpers; this is not a guest run,
// full creation/lifetime test, independent acceptance, or Windows behavior oracle.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const compilerPath = process.env.WATX_COMPILER || '/home/user/wine-assembly/tools/watx.js';
const { compile } = require(compilerPath);
const exact = fs.readFileSync(path.join(__dirname, 'exact-handler.wat'), 'utf8');
const source = `
(memory 1)
(export "memory" (memory 0))
(global $reg_base i32 (i32.const 64))
(global $DX_VTBL_DDRAW4 i32 (i32.const 0x0087b4ec))
(global $DX_VTBL_DDRAW7 i32 (i32.const 0x00aaaa00))
(global $DX_VTBL_DDSURF4 i32 (i32.const 0x006fd7fc))
(global $DX_VTBL_DDSURF7 i32 (i32.const 0x00bbbb00))
(global $lookups (mut i32) (i32.const 0))
(global $refs (mut i32) (i32.const 0))
(func $gl32 (param $p i32) (result i32) (i32.load (local.get $p)))
(func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
(func $ddraw_surface_entry_checked (param $p i32) (result i32)
  (if (result i32) (i32.eq (local.get $p) (i32.const 256)) (then (i32.const 512))
    (else (select (i32.const 544) (i32.const 0) (i32.eq (local.get $p) (i32.const 264))))))
(func $dx_flip_tail_front (param $e i32) (result i32)
  (global.set $lookups (i32.add (global.get $lookups) (i32.const 1))) (i32.const 0))
(func $dx_surf_meta_ptr (param $e i32) (result i32)
  (global.set $lookups (i32.add (global.get $lookups) (i32.const 1))) (i32.const 600))
(func $dx_surface_explicit_child (param $e i32) (param $r i32) (result i32)
  (global.set $lookups (i32.add (global.get $lookups) (i32.const 1))) (i32.const 0))
(func $dx_surface_view (param $p i32) (param $v i32) (result i32) (local.get $p))
(func $dx_aux_refs (param $p i32) (result i32) (i32.const 1))
(func $dx_aux_ref_add (param $p i32) (param $n i32) (result i32) (i32.const 1))
(func $dx_from_this (param $p i32) (result i32) (i32.const 512))
(func $dx_com_addref (param $p i32) (result i32)
  (global.set $refs (i32.add (global.get $refs) (i32.const 1))) (i32.const 2))
${exact}
(func (export "run") (param $this i32) (param $q i32) (param $out i32)
  (global.set $lookups (i32.const 0)) (global.set $refs (i32.const 0))
  (call $handle_IDirectDrawSurface_GetAttachedSurface
    (local.get $this) (local.get $q) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "lookups") (result i32) (global.get $lookups))
(func (export "refs") (result i32) (global.get $refs))
(func (export "size") (param $p i32) (result i32) (call $dx_native_desc_size (local.get $p)))
`;
const result = compile(source, new Map(), { mode: 'production' });
assert(WebAssembly.validate(result.wasmBinary));
const e = new WebAssembly.Instance(new WebAssembly.Module(result.wasmBinary), {}).exports;
const d = new DataView(e.memory.buffer);
const set = (p, v) => d.setUint32(p, v >>> 0, true);
const get = p => d.getUint32(p, true);
const rows = [];
function run(name, caps, { legacy = false, attached = true, thisPtr = 256, query = 320, out = 352 } = {}) {
  new Uint8Array(e.memory.buffer).fill(0);
  set(256, legacy ? 0x006fb9cc : 0x006fd7fc);
  set(520, attached ? 264 : 0); // fixture's distinct implicit child
  set(600, 0x601c);             // source-derived child caps for observed creation
  caps.forEach((x, i) => set(320 + 4 * i, x));
  set(352, 0xdeadbeef); set(80, 0x1000);
  e.run(thisPtr, query, out);
  const row = { name, hr: get(64), output: get(352), esp: get(80), lookups: e.lookups(), refs: e.refs() };
  assert.strictEqual(row.esp, 0x1010, name + ': stdcall cleanup');
  rows.push(row); return row;
}
const observed = [4, 0x00010001, 0x0095e130, 0x088f0000];
let r = run('observed16-Surface4', observed);
assert.strictEqual(e.size(256), 124);
assert.strictEqual(r.hr, 0x887600ff); assert.strictEqual(r.output, 0);
assert.strictEqual(r.lookups, 0); assert.strictEqual(r.refs, 0);
for (let i = 1; i <= 3; i++) {
  const caps = [4, 0, 0, 0]; caps[i] = observed[i];
  r = run('nonzero-tail-word-' + i, caps);
  assert.strictEqual(r.hr, 0x887600ff); assert.strictEqual(r.lookups, 0);
}
r = run('zero-tail-Surface4', [4, 0, 0, 0]);
assert.strictEqual(r.hr, 0); assert.strictEqual(r.output, 264); assert.strictEqual(r.refs, 1);
assert(r.lookups > 0);
r = run('observed16-legacy-control', observed, { legacy: true });
assert.strictEqual(e.size(256), 108); assert.strictEqual(r.hr, 0); assert.strictEqual(r.refs, 1);
r = run('zero-tail-no-attachment-control', [4, 0, 0, 0], { attached: false });
assert.strictEqual(r.hr, 0x887600ff); assert(r.lookups > 0); assert.strictEqual(r.refs, 0);
r = run('invalid-object-control', observed, { thisPtr: 0 });
assert.strictEqual(r.hr, 0x88760082); assert.strictEqual(r.lookups, 0);
r = run('null-caps-control', observed, { query: 0 });
assert.strictEqual(r.hr, 0x80070057); assert.strictEqual(r.lookups, 0);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
console.log(JSON.stringify({ status: 'PASS_SOURCE_BRANCH_PROBE', limitations: 'Extracted exact production handler; fixture helpers. No game, creation/lifetime acceptance or reference Windows behavior.', exactFormsSHA256: sha(exact), compilerPath, compilerSHA256: sha(fs.readFileSync(compilerPath)), rows }, null, 2));
