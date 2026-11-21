'use strict';
const assert = require('assert/strict');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none', extraWat: `
    (func (export "quad_varyings") (param $vm i32) (param $vertices i32) (param $weights i32) (param $mask i32)
      (call $d3d_software_quad_varyings (local.get $vm) (local.get $vertices)
        (i32.add (local.get $vertices) (i32.const 160)) (i32.add (local.get $vertices) (i32.const 320))
        (local.get $mask) (v128.load (local.get $weights)) (v128.load offset=16 (local.get $weights))
        (v128.load offset=32 (local.get $weights)) (v128.load offset=48 (local.get $weights))
        (v128.load offset=64 (local.get $weights))))
    (func (export "scalar_varying") (param $vertices i32) (param $weights i32) (param $offset i32) (param $lane i32) (result i32)
      (local.set $weights (i32.add (local.get $weights) (i32.shl (local.get $lane) (i32.const 2))))
      (i32.reinterpret_f32 (call $d3d_software_perspective
        (call $d3d_software_interp (local.get $vertices) (i32.add (local.get $vertices) (i32.const 160))
          (i32.add (local.get $vertices) (i32.const 320)) (local.get $offset)
          (f32.load (local.get $weights)) (f32.load offset=16 (local.get $weights)) (f32.load offset=32 (local.get $weights)))
        (f32.load offset=48 (local.get $weights)) (f32.load offset=64 (local.get $weights)))))
  ` });
  const alloc = n => e.guest_to_wasm(e.guest_alloc(n)) >>> 0;
  const vm = alloc(25000), vertices = alloc(480), weights = alloc(80);
  const u32 = new Uint32Array(memory.buffer), f32 = new Float32Array(memory.buffer);
  const bits = new Uint32Array(1);
  const values = [0, -0, 1, -1, 0.3, 1e-40, -1e-40, 3.4028234663852886e38, Infinity, -Infinity, NaN];
  let checks = 0;
  for (let trial = 0; trial < 33; trial++) {
    for (let vertex = 0; vertex < 3; vertex++)
      for (let j = 0; j < 32; j++) {
        const offset = j < 28 ? 16 + 4 * j : 144 + 4 * (j - 28);
        f32[(vertices + vertex * 160 + offset) / 4] = values[(trial + vertex * 3 + j) % values.length];
        if (Number.isNaN(f32[(vertices + vertex * 160 + offset) / 4]))
          u32[(vertices + vertex * 160 + offset) / 4] = vertex & 1 ? 0xffc00456 : 0x7f800123;
      }
    for (let lane = 0; lane < 4; lane++) {
      f32[weights / 4 + lane] = [0.25, -0.25, 0, 1][lane];
      f32[weights / 4 + 4 + lane] = [0.5, 0.75, -0, -1][lane];
      f32[weights / 4 + 8 + lane] = [0.25, 0.5, 1, 1][lane];
      const iw = values[(trial + lane) % values.length];
      f32[weights / 4 + 12 + lane] = iw;
      f32[weights / 4 + 16 + lane] = 1 / f32[weights / 4 + 12 + lane];
    }
    for (const mask of [-1, 0, 0x55555555, 0x80000001]) {
      e.quad_varyings(vm, vertices, weights, mask);
      for (let j = 0; j < 32; j++) {
        const bank = j < 4 ? 8224 + 16 * j : j < 28 ? 24608 + 16 * (j - 4) : 8288 + 16 * (j - 28);
        const offset = j < 28 ? 16 + 4 * j : 144 + 4 * (j - 28);
        for (let lane = 0; lane < 4; lane++) {
          bits[0] = (mask >>> j) & 1 ? e.scalar_varying(vertices, weights, offset, lane) : 0;
          const actual = u32[(vm + bank) / 4 + lane];
          assert.equal(actual, bits[0], `trial ${trial}, mask ${mask}, varying ${j}, lane ${lane}`);
          checks++;
        }
      }
    }
  }
  console.log(`PASS quad varying scalar equivalence: ${checks} lanes, signed zeros, subnormals, infinities, NaNs, mixed fallback, masks`);
})().catch(error => { console.error(error); process.exitCode = 1; });
