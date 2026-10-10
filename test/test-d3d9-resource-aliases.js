'use strict';
const assert = require('assert');
// Generated funcs embed the table id: a WAT string literal per name is interned
// into the shared, fixed-size WATX string pool, and these names overflowed it.
const apiId = name => require('../src/api_table.json').find(entry => entry.name === name).id;
const fs = require('fs');
const path = require('path');
const apis = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');
const families = ['Buffer9', 'VertexDeclaration9', 'StateBlock9', 'Query9'];
const methods = ['AddRef', 'Release', 'GetDevice'];
const source = fs.readFileSync(path.join(__dirname, '../src/09ae-d3d9-resources.wat'), 'utf8');
for (const family of families) for (const method of methods) {
  const name = `IDirect3D${family}_${method}`;
  const api = apis.find(a => a.name === name);
  if (family === 'Query9' && method === 'Release') {
    assert.strictEqual(api.handler, undefined, 'query GPU retirement must stay specialized');
    assert(source.includes(`(func $handle_${name} `));
  } else {
    assert.strictEqual(api.handler, `IDirect3DShader9_${method}`, name);
    assert(!source.includes(`(func $handle_${name} `), `${name}: forwarding body reintroduced`);
  }
}

(async () => {
  const { exports: e } = await bootRenderHarness({ fonts: 'none', extraWat: `
    (func (export "device") (result i32) (local $d i32)
      (local.set $d (call $dx_create_com_obj (i32.const 20) (global.get $DX_VTBL_D3DDEV9)))
      (store.field DxObject misc1 (call $dx_from_this (local.get $d)) (call $d3d9_program_alloc))
      (local.get $d))
    (func (export "device_refs") (param $d i32) (result i32)
      (load.field DxObject refcount (call $dx_from_this (local.get $d))))
    (func (export "create") (param $kind i32) (param $d i32) (param $input i32) (param $out i32) (result i32)
      (if (i32.eq (local.get $kind) (i32.const 0)) (then
        (call $d3d9_buffer_create (local.get $d) (i32.const 32) (i32.const 0)
          (i32.const 0) (i32.const 1) (local.get $out) (i32.const 6))))
      (if (i32.eq (local.get $kind) (i32.const 1)) (then
        (call $d3d9_declaration_create (local.get $d) (local.get $input) (local.get $out))))
      (if (i32.eq (local.get $kind) (i32.const 2)) (then
        (call $d3d9_stateblock_create (local.get $d) (i32.const 1) (local.get $out))))
      (if (i32.eq (local.get $kind) (i32.const 3)) (then
        (call $d3d9_query_create (local.get $d) (i32.const 8) (local.get $out))))
      (i32.load (global.get $reg_base)))
    ${[...families.flatMap(f => methods.map(m => `IDirect3D${f}_${m}`)),
      'IDirect3DDevice9_Release', 'IDirect3DDevice8_DeleteVertexShader'].map(name => `
    (func (export "${name}") (param $obj i32) (param $out i32) (param $stack i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (local.get $stack))
      (call $dispatch_api_table (i32.const ${apiId(name)})
        (local.get $obj) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))`).join('\n')}
  ` });
  e.init_dx_com_thunks();
  const stack = e.guest_alloc(32) >>> 0, out = e.guest_alloc(12) >>> 0;
  const input = e.guest_alloc(16) >>> 0, d = e.device();
  // One FLOAT3 POSITION element followed by D3DDECL_END.
  [0, 2, 255, 17].forEach((v, i) => e.guest_write32(input + i * 4, v));
  const call = (name, obj, p = 0, pop = 8) => {
    e.guest_write32(stack + pop, 0x1234abcd);
    const result = e[name](obj, p, stack) >>> 0;
    assert.strictEqual(e.get_esp() >>> 0, stack + pop, `${name}: stack cleanup`);
    assert.strictEqual(e.guest_read32(stack + pop) >>> 0, 0x1234abcd);
    return result;
  };
  for (const [kind, family] of families.entries()) {
    assert.strictEqual(e.device_refs(d), 1);
    assert.strictEqual(e.create(kind, d, input, out), 0, `${family}: real constructor`);
    const obj = e.guest_read32(out) >>> 0, prefix = `IDirect3D${family}_`;
    assert(obj);
    assert.strictEqual(e.device_refs(d), 2, 'resource owns a device reference');
    assert.strictEqual(call(prefix + 'AddRef', obj), 2);
    assert.strictEqual(e.guest_read32(obj + 4), 2);
    assert.strictEqual(call(prefix + 'Release', obj), 1);
    assert.strictEqual(e.device_refs(d), 2);
    assert.strictEqual(call(prefix + 'GetDevice', obj, 0, 12), 0x8876086c);
    assert.strictEqual(e.device_refs(d), 2, 'failed getter adds no reference');
    e.guest_write32(out + 4, 0xabcdef12);
    assert.strictEqual(call(prefix + 'GetDevice', obj, out, 12), 0);
    assert.strictEqual(e.guest_read32(out), d);
    assert.strictEqual(e.guest_read32(out + 4) >>> 0, 0xabcdef12);
    assert.strictEqual(e.device_refs(d), 3, 'getter transfers one reference');
    assert.strictEqual(call('IDirect3DDevice9_Release', d), 2);
    assert.strictEqual(call(prefix + 'Release', obj), 0);
    assert.strictEqual(e.device_refs(d), 1, 'final resource release balances parent');
  }
  assert.strictEqual(e.create(1, d, input, out), 0);
  const declaration = e.guest_read32(out) >>> 0;
  assert.strictEqual(e.device_refs(d), 2);
  // A raw D3D9 declaration is not a D3D8 vertex shader handle: since the
  // device-owned D3D8 handles (4b2494187) DeleteVertexShader rejects it and
  // leaves the declaration and its device reference alone. Real D3D8 handle
  // lifetime is covered by test-d3d8-vertex-shader.js / test-d3d8-reset-handles.js.
  assert.strictEqual(call('IDirect3DDevice8_DeleteVertexShader', d, declaration, 12), 0x8876086c);
  assert.strictEqual(e.device_refs(d), 2, 'rejected D3D8 delete keeps the declaration');
  assert.strictEqual(call('IDirect3DVertexDeclaration9_Release', declaration), 0);
  assert.strictEqual(e.device_refs(d), 1, 'declaration release balances parent');
  console.log('PASS eleven D3D9 resource aliases and D3D8 handle rejection: name dispatch, counts, parent lifetime, outputs and ESP');
})().catch(error => { console.error(error); process.exitCode = 1; });
