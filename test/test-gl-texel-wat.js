'use strict';
// GPU stream v2 slice G2: the WAT GL texel conversion (the pure section of
// src/09a8t-gl-texture.wat, compiled on its own) is bit-exact with the JS
// converters it replaced in lib/gl-compat.js: canonical texture cells (f32
// RGBA, RGBA8, f64 colour index) through pixel transfer, pixel maps and the
// base internal format; glReadPixels' transfer; and the per-type pack value.
// The fixture was generated from the old JS before it was deleted
// (scratch/runs/20261115-gps-g2/gen-texel-fixture.js against 0ef043248).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { compile } = require('../tools/watx');

const fixture = require(path.join(__dirname, 'fixtures/gl-texel-js.json'));
const source = fs.readFileSync(path.join(__dirname, '../src/09a8t-gl-texture.wat'), 'utf8');
const pure = source.slice(source.indexOf(';; ---------------- @pure-begin'), source.indexOf(';; ---------------- @pure-end'));
assert(pure.length > 1000, '09a8t pure section markers present');
const r = compile(`(memory 2 2)\n(export "memory" (memory 0))\n${pure}
(export "gl_g2_texel" (func $gl_g2_texel))\n(export "gl_g2_pack_value" (func $gl_g2_pack_value))`, new Map(),
  { mode: 'production', standardWat: true, runtimeBuiltins: false, strictDeclarations: true });
if (!r.success) throw new Error(`09a8t pure compile failed: ${JSON.stringify(r.errors || r).slice(0, 2000)}`);
const e = new WebAssembly.Instance(new WebAssembly.Module(r.wasmBinary), {}).exports;
const mem = () => new DataView(e.memory.buffer);
const T = 0x100, MAPS = 0x200, IN = 0x10000;

function loadState(name) {
  const s = fixture.states[name], dv = mem();
  new Uint8Array(e.memory.buffer, T, 64).fill(0);
  dv.setInt32(T, s.t[0] ? 1 : 0, true); dv.setInt32(T + 4, s.t[1] ? 1 : 0, true);
  dv.setInt32(T + 8, s.t[2], true); dv.setInt32(T + 12, s.t[3], true);
  [[4, 16], [5, 20], [8, 32], [9, 36], [10, 40], [11, 44], [12, 48], [13, 52], [14, 56], [15, 60]]
    .forEach(([i, at]) => dv.setFloat32(T + at, s.t[i], true));
  s.maps.forEach((m, i) => {
    dv.setInt32(MAPS + i * 4, m.length, true);
    m.forEach((v, j) => dv.setFloat64(MAPS + 40 + i * 2048 + j * 8, v, true));
  });
}
const toRgba = (argb) => [(argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255, argb >>> 24];
const inputs = Object.fromEntries(fixture.inputs.map((i) => [i.kind, { n: i.n, bytes: Buffer.from(i.bytes, 'hex') }]));

let texels = 0, mismatches = 0;
for (const c of fixture.cases) {
  loadState(c.state);
  const { n, bytes } = inputs[c.kind];
  new Uint8Array(e.memory.buffer, IN, bytes.length).set(bytes);
  const step = c.kind === 1 ? 4 : 16, want = Buffer.from(c.rgba, 'hex');
  for (let i = 0; i < n; i++) {
    const got = toRgba(e.gl_g2_texel(IN + i * step, c.kind, c.internal, T, MAPS));
    const exp = Array.from(want.subarray(i * 4, i * 4 + 4));
    texels++;
    if (got.join() !== exp.join()) {
      if (++mismatches <= 10) console.log(`MISMATCH ${c.state} kind ${c.kind} internal 0x${c.internal.toString(16)} texel ${i}: wat ${got} js ${exp}`);
    }
  }
}
for (const c of fixture.reads) {
  loadState(c.state);
  const input = Buffer.from(c.input, 'hex'), want = Buffer.from(c.rgba, 'hex');
  new Uint8Array(e.memory.buffer, IN, input.length).set(input);
  for (let i = 0; i < input.length / 4; i++) {
    const got = toRgba(e.gl_g2_texel(IN + i * 4, 1, 4, T, MAPS)), exp = Array.from(want.subarray(i * 4, i * 4 + 4));
    texels++;
    if (got.join() !== exp.join() && ++mismatches <= 10) console.log(`MISMATCH read ${c.state} texel ${i}: wat ${got} js ${exp}`);
  }
}
let packs = 0;
for (const p of fixture.pack) {
  const want = Buffer.from(p.out, 'hex');
  for (let v = 0; v < 256; v++) {
    const bits = e.gl_g2_pack_value(v, p.type) >>> 0;
    let exp = 0;
    for (let b = p.bytes - 1; b >= 0; b--) exp = exp * 256 + want[v * p.bytes + b];
    const got = p.bytes === 4 ? bits : bits & ((1 << (8 * p.bytes)) - 1);
    packs++;
    if (got !== exp && ++mismatches <= 10) console.log(`MISMATCH pack type 0x${p.type.toString(16)} value ${v}: wat ${got} js ${exp}`);
  }
}
assert.strictEqual(mismatches, 0, `${mismatches} texels differ from the JS converters`);
assert(fixture.cases.length >= 200 && texels > 20000, `fixture covers the matrix (${texels} texels)`);
console.log(`PASS test-gl-texel-wat: ${texels} texels over ${fixture.cases.length} cases + ${fixture.reads.length} readback states, ${packs} pack values bit-exact with the old JS`);
