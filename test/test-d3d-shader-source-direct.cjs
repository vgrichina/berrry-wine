'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none', extraWat: `
    (func (export "source_pair") (param $regs i32) (param $src i32) (param $component i32) (param $out i32)
      (v128.store (local.get $out)
        (call $d3d_shader_vm_source (local.get $regs) (local.get $src) (local.get $component)))
      (v128.store offset=16 (local.get $out)
        (call $d3d_shader_vm_source_row (local.get $regs) (local.get $src) (local.get $component) (i32.const 0))))
  ` });
  const alloc = n => e.guest_to_wasm(e.guest_alloc(n)) >>> 0;
  const regs = alloc(75000), src = alloc(16), out = alloc(32);
  const u = new Uint32Array(memory.buffer), f = new Float32Array(memory.buffer);
  // Include both zero signs, extreme/subnormal values, infinities and signed
  // quiet/signaling NaN payloads. Read results as words, never through JS f32.
  const words = [0, 0x80000000, 1, 0x80000001, 0x007fffff, 0x807fffff,
    0x00800000, 0x80800000, 0x7f7fffff, 0xff7fffff, 0x7f800000, 0xff800000,
    0x7fc00123, 0xffc00456, 0x7f800123, 0xff800456, 0x3f800000, 0xbf000000];
  for (let i = 0; i < 75000 / 4; i++) u[regs / 4 + i] = words[i % words.length];
  let checks = 0;
  function pair(slot, swizzle, flags, component) {
    u.set([slot, swizzle, flags, 0], src / 4);
    e.source_pair(regs, src, component, out);
    for (let lane = 0; lane < 4; lane++) {
      assert.equal(u[out / 4 + lane], u[out / 4 + 4 + lane],
        `slot=${slot} swizzle=${swizzle} flags=${flags} component=${component} lane=${lane}`);
      if (flags === 0) assert.equal(u[out / 4 + lane],
        u[(regs + slot * 64 + ((swizzle >>> (component * 2)) & 3) * 16) / 4 + lane]);
      checks++;
    }
  }
  // All legacy banks and extended VS constants; exhaust every byte swizzle.
  for (let slot = 0; slot < 1152; slot++) for (let swizzle = 0; swizzle < 256; swizzle++)
    for (let component = 0; component < 4; component++) pair(slot, swizzle, 0, component);
  for (const flags of [1, 2, 3, 4, 5, 6, 7, 8, 512, 513, 514, 515, 516, 517, 518, 519, 520])
    for (const slot of [0, 127, 128, 255, 256, 383, 384, 511])
      for (let swizzle = 0; swizzle < 256; swizzle++)
        for (let component = 0; component < 4; component++) pair(slot, swizzle, flags, component);
  // Relative gather bounds, noninteger/nonfinite addresses, all selectors,
  // both constant limits, modifiers, and extended-constant remapping.
  for (const address of [-Infinity, -257, -1, -0, 0, 0.5, 1, 95, 96, 127, 128, 255, 256, Infinity, NaN]) {
    for (let c = 0; c < 4; c++) for (let lane = 0; lane < 4; lane++)
      f[(regs + 24576) / 4 + c * 4 + lane] = address + lane;
    u[(regs + 74060) / 4] = Number.isFinite(address) ? address : 0x80000000;
    for (const slot of [256, 257, 351, 383, 384, 511])
      for (const limit of [0, 512]) for (let selector = 0; selector < 8; selector++)
        for (let mod = 0; mod <= 8; mod++) for (let component = 0; component < 4; component++)
          pair(slot, 0xe4, 256 | limit | (selector << 10) | mod, component);
  }
  console.log(`PASS shader source direct/row raw-bit equivalence: ${checks} lanes`);
})().catch(error => { console.error(error); process.exitCode = 1; });
