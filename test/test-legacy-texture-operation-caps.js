#!/usr/bin/env node
'use strict';
// Small production excerpts, authentic WATX compiler, one 64KiB fixture memory.
// Allocation/device lookups are explicit doubles; real software spans write a
// fixture surface. This is not a COM/GL test.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { compile } = require('../tools/watx');
const { D3DIMGpu, OPCODES } = require('../lib/d3dim-gpu');
const root = path.resolve(__dirname, '..');
const corePath = process.env.LEGACY_CAPS_CORE || path.join(root, 'src/09ab-handlers-d3dim-core.wat');
const core = fs.readFileSync(corePath, 'utf8');
const directx = fs.readFileSync(path.join(root, 'src/09a8-handlers-directx.wat'), 'utf8');
const rasterSource = fs.readFileSync(path.join(root, 'src/09a8g-gl-raster.wat'), 'utf8');
const stencilSource = fs.readFileSync(path.join(root, 'src/09a8cc-gl-stencil.wat'), 'utf8');
const colorMaskSource = fs.readFileSync(path.join(root, 'src/09a8cd-gl-color-mask.wat'), 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const excerpts = [];

// Preserve byte-exact forms, ignoring parentheses in comments/strings. Fail
// closed if a named production form disappears; never substitute a formula.
function form(source, marker, file) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = source.search(new RegExp(escaped + '(?=\\s)'));
  assert(start >= 0, `missing ${marker}`);
  let depth = 0, quote = false, block = 0;
  for (let i = start; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (!quote && !block && c === ';' && n === ';') { i = source.indexOf('\n', i); assert(i >= 0); continue; }
    if (!quote && c === '(' && n === ';') { block++; i++; continue; }
    if (block) { if (c === ';' && n === ')') { block--; i++; } continue; }
    if (c === '\\' && quote) { i++; continue; }
    if (c === '"') { quote = !quote; continue; }
    if (quote) continue;
    if (c === '(') depth++;
    if (c === ')' && --depth === 0) {
      const text = source.slice(start, i + 1);
      excerpts.push({file, marker, startByte: Buffer.byteLength(source.slice(0, start)),
        endByteExclusive: Buffer.byteLength(source.slice(0, i + 1)),
        startLine: source.slice(0, start).split('\n').length,
        endLine: source.slice(0, i + 1).split('\n').length,
        bytes: Buffer.byteLength(text), sha256: sha(text)});
      return text;
    }
  }
  throw Error(`unclosed ${marker}`);
}
const names = ['d3dim_fill_device_desc7', 'd3dim_div255', 'd3dim_modulate_rgb',
  'd3dim_texture_stage_combine', 'd3dim_bound_texture_entry', 'd3dim_set_tss',
  'd3dim_tss_load', 'd3dim_draw_tl_triangle_maybe_textured',
  'd3dim_draw_tl_triangle_dp_raw', 'd3dim_draw_tl_triangle_textured'];
const argumentStateRepair = core.includes('(func $d3dim_stage_operation ');
names.push('d3dim_tss_addr', 'rasterize_triangle_textured', 'viewport_draw_textured_span');
names.push('d3dim_color_lerp', 'd3dim_texture_sample_prepared', 'd3dim_point_index',
  'd3dim_decode_surface_pixel_fmt', 'd3dim_alpha_pass', 'd3dim_clip_row_out',
  'd3dim_texture_sample_keyed', 'd3dim_decode_surface_pixel', 'd3dim_address_texel',
  'd3dim_texture_fetch_keyed', 'd3dim_texture_fetch_prepared');
if (argumentStateRepair) names.push('d3dim_stage_operation', 'd3dim_tss_init');
const forms = names.map(n => form(core, `(func $${n}`, 'src/09ab-handlers-d3dim-core.wat'));
forms.push(form(rasterSource, '(func $gl_sw_sample_prepared', 'src/09a8g-gl-raster.wat'));
forms.push(form(colorMaskSource, '(func $gl_color_merge', 'src/09a8cd-gl-color-mask.wat'));
if (argumentStateRepair) forms.push(form(directx, '(func $d3ddev_init_state', 'src/09a8-handlers-directx.wat'));
forms.push(form(directx, '(func $fill_primcaps', 'src/09a8-handlers-directx.wat'));
forms.push(form(core, '(func (export "d3dim_gpu_describe")', 'src/09ab-handlers-d3dim-core.wat'));
const selected = new Set([...names, 'fill_primcaps']);
selected.add('gl_sw_sample_prepared');
selected.add('gl_color_merge');
if (argumentStateRepair) selected.add('d3ddev_init_state');
const strip = s => s.replace(/;;[^\n]*/g, '');
const calls = new Set([...strip(forms.join('\n')).matchAll(/\(call \$([\w]+)/g)].map(m => m[1]));
const builtins = {
  g2w: '(param i32) (result i32)', gl32: '(param i32) (result i32)',
  gs32: '(param i32 i32)', zero_memory: '(param i32 i32)',
  host_dx_trace: '(param i32 i32 i32 i32 i32)',
  // Signature: exact-main src/09a8g-gl-raster.wat:2106-2109. Fog is off;
  // invoking this unrelated fixture dependency throws below.
  rast_fog_plane: '(param i32 i32 f32 i32 i32 f32 i32 i32 f32 i32)',
};
const imported = [...calls].filter(n => !selected.has(n));
const signatures = {};
for (const n of imported) {
  if (builtins[n]) { signatures[n] = builtins[n]; continue; }
  const source = [core, directx, rasterSource, stencilSource].find(s => s.includes(`(func $${n} `) || s.includes(`(func $${n}\n`));
  assert(source, `missing import signature ${n}`);
  const f = form(source, `(func $${n}`, 'import-signature-only');
  const header = strip(f).slice(`(func $${n}`.length).match(/^\s*((?:\((?:param|result)\s+[^)]*\)\s*)*)/)[1];
  signatures[n] = header.replace(/\$[\w]+/g, '');
}
const globals = new Set([...strip(forms.join('\n')).matchAll(/\(global\.(?:get|set) \$([\w]+)/g)].map(m => m[1]));
const globalText = [...globals].map(n => {
  if (['D3DIM_OFF_TEX_STAGE', 'D3DIM_OFF_TSS_STATE', 'D3DIM_OFF_TSS_EXT', 'd3dim_dbg_tex_last'].includes(n))
    return form(core, `(global $${n}`, 'src/09ab-handlers-d3dim-core.wat');
  // Non-allocated fixture globals: white texel absent, viewport clipping off,
  // reg_base fixture address. These do not implement texture operations.
  const declaration = [core, directx, rasterSource, stencilSource].join('\n')
    .match(new RegExp(`\\(global \\$${n}\\s+(?:\\(mut\\s+)?(i32|f32|f64)`));
  const type = declaration ? declaration[1] : 'i32';
  return `(global $${n} (mut ${type}) (${type}.const ${n === 'reg_base' ? 256 : n === 'rast_color_mask' ? -1 : 0}))`;
}).join('\n');
// WATX consumes top-level forms, rather than a standard-WAT module wrapper.
const prefix = `(memory 1) (export "memory" (memory 0))\n${imported.map(n => `(import "fixture" "${n}" (func $${n} ${signatures[n]}))`).join('\n')}\n${globalText}\n`;
const suffix = [...names, ...(argumentStateRepair ? ['d3ddev_init_state'] : [])].map(n => `(export "${n}" (func $${n}))`).join('\n');
const assembled = prefix + forms.join('\n') + suffix;
const mutations = process.argv.includes('--negative-controls');
const receipts = {qualification: 'source excerpts and legacy GPU lowering only; fixture imports, no COM/native guest/WebGL/gameplay',
  node: process.version, corePath, coreSHA256: sha(core), directxSHA256: sha(directx), excerpts,
  compiler: ['tools/watx.js', ...['compiler-parser.js', 'compiler-stages.js', 'compiler-codegen.js', 'compiler.js'].map(n => 'tools/watx-src/' + n)]
    .map(file => ({file, sha256: sha(fs.readFileSync(path.join(root, file)))})),
  extractionRecipe: 'balanced form at unique marker; UTF-8 byte offsets start inclusive/end exclusive; concatenate names in test order, then fill_primcaps and gpu_describe; fixture imports/globals and exports wrap verbatim forms',
  assembledBytes: Buffer.byteLength(assembled), assembledSHA256: sha(assembled), cases: [], controls: [], modules: []};
if (process.argv.includes('--manifest-only')) {
  assert(process.env.LEGACY_CAPS_RECEIPT);
  fs.writeFileSync(process.env.LEGACY_CAPS_RECEIPT, JSON.stringify(receipts, null, 2) + '\n');
  console.log('production excerpt/compiler identities recorded; no compilation');
  process.exit(0);
}

function makeFixture(source) {
  let e, op = 4, alpha = 4, untextured = 0;
  const overrides = {
    g2w: a => a, gl32: a => new DataView(e.memory.buffer).getUint32(a, true),
    gs32: (a, v) => new DataView(e.memory.buffer).setUint32(a, v, true),
    zero_memory: (a, n) => new Uint8Array(e.memory.buffer, a, n).fill(0),
    d3ddev_state: () => 4096,
    d3dim_texture_entry_from_slot: slot => { assert(slot === 0 || slot === 1); return slot ? 8192 : 0; },
    d3ddev_rt_entry: () => 24576, d3dim_gpu_buffer: () => 16384,
    dx_surf_fmt_get: entry => entry === 8192 ? 5 : 1, dx_surf_pal_get: () => 0, dx_surf_pal_alpha: () => 0,
    d3dim_wrap_flags: () => 0, d3dim_vertex_fog_on: () => 0,
    d3dim_clip_compute: () => 0, d3dim_cull_tri: () => 0,
    d3dim_coord_i: x => Math.trunc(x), host_dx_trace: () => {},
    d3dim_exec_extent_draw: () => {},
    d3dim_draw_tl_triangle: () => { untextured++; },
  };
  const fixture = Object.fromEntries(imported.map(n => [n, overrides[n] || (() => { throw Error(`unexpected fixture import ${n}`); })]));
  const result = compile(source, new Map(), {mode: 'production'});
  assert(result.success, result.error);
  const binary = result.wasmBinary;
  assert(binary instanceof Uint8Array, 'compiler must return genuine Wasm bytes');
  receipts.modules.push({sourceBytes: Buffer.byteLength(source), sourceSHA256: sha(source),
    wasmBytes: binary.byteLength, wasmSHA256: sha(binary)});
  const module = new WebAssembly.Module(binary);
  e = new WebAssembly.Instance(module, {fixture}).exports;
  assert.equal(e.memory.buffer.byteLength, 65536, 'only one fixture page');
  const dv = new DataView(e.memory.buffer);
  if (argumentStateRepair) e.d3ddev_init_state(4096);
  else for (const [type, val] of [[2, 2], [3, 1], [5, 2], [6, 1]]) e.d3dim_set_tss(1, 0, type, val);
  dv.setUint32(4096 + 2824, 1, true);
  for (const a of [8192, 24576]) {
    [2, 2, 32, 8].forEach((v, i) => dv.setUint16(a + 12 + i * 2, v, true));
    dv.setUint32(a + 20, 32768, true);
  }
  dv.setUint32(8192 + 20, 36864, true);
  for (let i = 0; i < 4; i++) dv.setUint32(36864 + i * 4, 0xa0c08040, true);
  for (let i = 0; i < 3; i++) {
    const a = 20480 + i * 32;
    dv.setFloat32(a, i === 1 ? 2 : 0, true); dv.setFloat32(a + 4, i === 2 ? 2 : 0, true);
    dv.setFloat32(a + 8, 0.5, true); dv.setFloat32(a + 12, 1, true);
    dv.setUint32(a + 16, 0x8060a0e0, true);
  }
  function setOps(c, a) {
    op = c; alpha = a;
    e.d3dim_set_tss(1, 0, 1, c); e.d3dim_set_tss(1, 0, 4, a);
  }
  return {e, dv, setOps, softwareUnbound() {
    for (const n of ['d3dim_draw_tl_triangle_maybe_textured', 'd3dim_draw_tl_triangle_dp_raw']) {
      untextured = 0; e[n](1, 24576, 0, 20480, 20512, 20544);
      assert.equal(untextured, 1, `${n} unbound routes to diffuse triangle`);
    }
  }, softwareOuter(want) {
    for (const n of ['d3dim_draw_tl_triangle_maybe_textured', 'd3dim_draw_tl_triangle_dp_raw']) {
      new Uint8Array(e.memory.buffer, 32768, 16).fill(0);
      e[n](1, 24576, 0, 20480, 20512, 20544);
      if (want !== undefined) assert.equal(dv.getUint32(32768, true) >>> 0, want >>> 0,
        `${n} actual software pixel ${op}/${alpha}: got ${dv.getUint32(32768, true).toString(16)}, want ${(want >>> 0).toString(16)}`);
    }
  }};
}
function gpuDraw(f, c, a, gpuSource, bound = true, declined = false) {
  f.setOps(c, a);
  let GPU = D3DIMGpu;
  if (gpuSource) {
    // Run the entire mutated module with its real relative backend import.
    const Module = require('module'), m = new Module(path.join(root, 'lib/d3dim-gpu.js'), module);
    m.filename = path.join(root, 'lib/d3dim-gpu.js'); m.paths = module.paths;
    m._compile(gpuSource, m.filename); GPU = m.exports.D3DIMGpu;
  }
  const gpu = new GPU({getMemory: () => f.e.memory.buffer,
    getExports: () => ({...f.e, guest_to_wasm: a => a}), createCanvas: () => null, batchDraws: false});
  const t = {rt: 24576, width: 2, height: 2, dib: 32768, bpp: 32, pitch: 8, format: 1,
    check: false, textureKeys: new Set()};
  let draw;
  gpu._target = () => t; gpu._prepare = () => {};
  gpu._texture = () => ({width: 1, height: 1, data: new Uint8Array([192, 128, 64, 160])});
  gpu._submit = (target, d) => { draw = d; return true; };
  [1, 4, 3, 20480, 3].forEach((v, i) => f.dv.setUint32(28672 + i * 4, v, true));
  assert.equal(gpu.call(OPCODES.DRAW, 28672), declined ? 0 : 1, 'real GPU lowering disposition');
  if (declined) { assert.equal(draw,undefined); return; }
  assert(draw); assert.equal(draw.textures.length, bound ? 1 : 0);
  return draw.fixedFunction.stages[0];
}
const tex = 0xa0c08040, diffuse = 0x8060a0e0;
// Independent byte expectations, not copies of the production formulas.
const expected = new Map([[2, tex], [3, diffuse], [4, 0x50485038]]);
function supported(f, gpuSource) {
  for (const c of [2, 3, 4]) for (const a of [2, 3, 4]) {
    const want = ((expected.get(c) & 0xffffff) | (expected.get(a) & 0xff000000)) >>> 0;
    assert.equal(f.e.d3dim_texture_stage_combine(tex, diffuse, c, a) >>> 0, want, `software ${c}/${a}`);
    const stage = gpuDraw(f, c, a, gpuSource);
    assert.deepEqual([stage.colorOp, stage.alphaOp, stage.colorArg1, stage.colorArg2, stage.alphaArg1, stage.alphaArg2],
      [c, a, 2, 0, 2, 0], `GPU ${c}/${a} retains operation and TEXTURE/DIFFUSE operands`);
    f.softwareOuter(want);
  }
}
function caps(f) {
  const p = 512;
  new Uint8Array(f.e.memory.buffer, p - 4, 244).fill(0xa5);
  f.e.d3dim_fill_device_desc7(p);
  assert.equal(f.dv.getUint32(p - 4, true), 0xa5a5a5a5);
  assert.equal(f.dv.getUint32(p + 236, true), 0xa5a5a5a5);
  const result = f.dv.getUint32(p + 180, true);
  receipts.descriptorHex = Buffer.from(f.e.memory.buffer, p, 236).toString('hex');
  assert.equal(result, 0x0000000e, 'TextureOpCaps must advertise exactly proven SELECTARG1/2/MODULATE');
  assert.equal(f.dv.getUint16(p + 184, true), 1);
  assert.equal(f.dv.getUint16(p + 186, true), 1);
  assert.equal(f.dv.getUint32(p + 176, true), 8);
  assert.equal(f.dv.getUint32(p + 188, true), 8);
  assert.equal(f.dv.getUint32(p + 40, true), 0x030003c3);
  assert.equal(f.dv.getUint32(p + 96, true), 0x030003c3);
  return Buffer.from(f.e.memory.buffer, p, 236).toString('hex');
}
function reject(label, fn) { assert.throws(fn, assert.AssertionError, label); receipts.controls.push(label); }
// Independent per-byte oracle: selectors choose operands before the operation.
// It also evaluates the actual lowered GPU stage, rather than asserting only
// that a descriptor happened to contain the supplied integer.
function argumentResult(c, a, args) {
  let result = 0;
  for (let byte = 0; byte < 4; byte++) {
    const shift = byte * 8, op = byte === 3 ? a : c, base = byte === 3 ? 2 : 0;
    const operand = selector => (selector === 2 ? tex : diffuse) >>> shift & 255;
    const x = operand(args[base]), y = operand(args[base + 1]);
    result += (op === 2 ? x : op === 3 ? y : Math.floor(x * y / 255)) * 2 ** shift;
  }
  return result >>> 0;
}
function argumentCases(f, gpuSource) {
  for (const [type, value] of [[1,4],[2,2],[3,1],[4,2],[5,2],[6,1]])
    assert.equal(f.e.d3dim_tss_load(4096,0,type), value, `real initialized default ${type}`);
  const initial = gpuDraw(f,4,2,gpuSource);
  assert.deepEqual([initial.colorArg1,initial.colorArg2,initial.alphaArg1,initial.alphaArg2],[2,0,2,0]);
  f.softwareOuter(argumentResult(4,2,[2,0,2,0]));
  let count = 0;
  for (const c1 of [0,2]) for (const c2 of [0,2])
    for (const a1 of [0,2]) for (const a2 of [0,2]) {
      const args = [c1,c2,a1,a2];
      [2,3,5,6].forEach((type,i) => {
        f.e.d3dim_set_tss(1,0,type,args[i]);
        assert.equal(f.e.d3dim_tss_load(4096,0,type),args[i]);
      });
      for (const c of [2,3,4]) for (const a of [2,3,4]) {
        const want = argumentResult(c,a,args), stage = gpuDraw(f,c,a,gpuSource);
        const lowered = [stage.colorArg1,stage.colorArg2,stage.alphaArg1,stage.alphaArg2];
        assert.deepEqual(lowered,args,`four independent descriptor/lowering arguments ${args}`);
        assert.equal(argumentResult(stage.colorOp,stage.alphaOp,lowered),want);
        assert.equal(f.e.d3dim_texture_stage_combine(tex,diffuse,
          f.e.d3dim_stage_operation(4096,1),f.e.d3dim_stage_operation(4096,4)) >>> 0,want);
        f.softwareOuter(want); count++;
      }
    }
  // Stage zero CURRENT is the incoming diffuse, including as explicit ARG1.
  for (const type of [2,3,5,6]) f.e.d3dim_set_tss(1,0,type,1);
  const current = gpuDraw(f,2,3,gpuSource);
  assert.deepEqual([current.colorArg1,current.colorArg2,current.alphaArg1,current.alphaArg2],[0,0,0,0]);
  f.softwareOuter(diffuse);
  for (const type of [2,3,5,6]) {
    for (const unsupported of [3,4,5,6,0x10,0x20,0x12,0x22]) {
      f.e.d3dim_set_tss(1,0,type,unsupported);
      gpuDraw(f,4,4,gpuSource,true,true);
    }
    f.e.d3dim_set_tss(1,0,type,1);
  }
  f.dv.setUint32(4096+2824,0,true);
  for (const c of [2,3,4]) for (const a of [2,3,4]) {
    const stage = gpuDraw(f,c,a,gpuSource,false);
    assert.equal(argumentResult(stage.colorOp,stage.alphaOp,
      [stage.colorArg1,stage.colorArg2,stage.alphaArg1,stage.alphaArg2]),diffuse);
    f.softwareUnbound();
  }
  return count;
}
try {
  const f = makeFixture(assembled);
  // Run behavior before capability assertion so baseline retains distinguishing evidence.
  supported(f);
  for (const [t, d, mod] of [[diffuse, tex, 0x50485038], [tex, 0xffffffff, tex],
    [0, diffuse, 0]]) {
    for (const [op, want] of [[2, t], [3, d], [4, mod]])
      assert.equal(f.e.d3dim_texture_stage_combine(t, d, op, op) >>> 0, want >>> 0);
  }
  // DISABLE now has its contract regression in test-legacy-texture-disable.js.
  // Keep the remaining unsupported-operation diagnostics and controls intact.
  for (const op of [5, 6, 7, 8, 9, 10]) {
    const got = f.e.d3dim_texture_stage_combine(tex, diffuse, op, op) >>> 0;
    // Official semantics distinguish each from the observed MODULATE fallback.
    // Expected red in byte units (fractional values precede quantization).
    const redExpected = new Map([[5, 192 * 96 / 255 * 2], [6, 255],
      [7, 255], [8, 160.5], [9, 255], [10, 96]]).get(op);
    assert.equal(got, expected.get(4)); assert.notEqual((got >>> 16) & 255, redExpected);
    const stage = gpuDraw(f, op, op); assert.equal(stage.colorOp, 4); assert.equal(stage.alphaOp, 4);
    f.softwareOuter(expected.get(4));
    receipts.cases.push({operation: op, observed: got.toString(16), observedRed: got >>> 16 & 255,
      semanticRed: redExpected, gpuColorOp: stage.colorOp, gpuAlphaOp: stage.alphaOp,
      bothOuterSoftwareRoutes: 'actual software triangle and span, legacy MODULATE fallback'});
  }
  receipts.descriptorHex = caps(f);
  if (argumentStateRepair) receipts.argumentCases = argumentCases(makeFixture(assembled));
  const acceptedDescriptor = receipts.descriptorHex;
  if (mutations) {
    for (const mask of ['0x0000F', '0x0001E', '0x00006']) {
      const altered = assembled.replace('(i32.const 0x0000E)', `(i32.const ${mask})`);
      assert.notEqual(altered, assembled); reject(`capability mutation ${mask}`, () => caps(makeFixture(altered)));
    }
    const wrongSoftware = assembled.replace('(then (local.set $rgb (i32.and (local.get $tex)',
      '(then (local.set $rgb (i32.and (local.get $diffuse)');
    assert.notEqual(wrongSoftware, assembled);
    reject('software SELECTARG1 operand mutation', () => supported(makeFixture(wrongSoftware)));
    const gpuSource = fs.readFileSync(path.join(root, 'lib/d3dim-gpu.js'), 'utf8');
    const wrongGpu = gpuSource.replace('v === 2 || v === 3 ? v : 4', 'v === 2 || v === 3 ? 4 : 4');
    assert.notEqual(wrongGpu, gpuSource);
    reject('GPU SELECTARG lowering mutation', () => supported(f, wrongGpu));
    if (argumentStateRepair) {
      for (const [label, replacement] of [
        ['hardcoded GPU arguments','[2,0,2,0]'],
        ['swapped RGB arguments','[d.colorArg2,d.colorArg1,d.alphaArg1,d.alphaArg2].map(arg)'],
        ['swapped alpha arguments','[d.colorArg1,d.colorArg2,d.alphaArg2,d.alphaArg1].map(arg)'],
        ['crossed RGB/alpha arguments','[d.alphaArg1,d.alphaArg2,d.colorArg1,d.colorArg2].map(arg)']]) {
        const changed = gpuSource.replace('[d.colorArg1, d.colorArg2, d.alphaArg1, d.alphaArg2].map(arg)',replacement);
        assert.notEqual(changed,gpuSource); reject(label,() => argumentCases(makeFixture(assembled),changed));
      }
      for (const [offset,type] of [[164,2],[168,3],[172,5],[176,6]]) {
        const original = `(i32.store offset=${offset} (local.get $out) (call $d3dim_tss_load (local.get $state) (i32.const 0) (i32.const ${type})))`;
        const changed = assembled.replace(original,`(i32.store offset=${offset} (local.get $out) (i32.const ${type===2||type===5?2:0}))`);
        assert.notEqual(changed,assembled); reject(`hardcoded WAT argument ${type}`,() => argumentCases(makeFixture(changed)));
      }
      const raw = assembled.replaceAll('(call $d3dim_stage_operation (local.get $state)',
        '(call $d3dim_tss_load (local.get $state) (i32.const 0)');
      assert.notEqual(raw,assembled); reject('software drops argument words',() => argumentCases(makeFixture(raw)));
      const crossed = assembled.replace('(call $d3dim_stage_operation (local.get $state) (i32.const 4))',
        '(call $d3dim_stage_operation (local.get $state) (i32.const 1))');
      assert.notEqual(crossed,assembled); reject('software crosses alpha/color words',() => argumentCases(makeFixture(crossed)));
    }
  }
  receipts.descriptorHex = acceptedDescriptor;
  receipts.status = 'PASS';
  console.log(`PASS legacy texture-operation caps: 9 pairs, 6 remaining unsupported operations; ${receipts.argumentCases || 0} argument combinations, real software pixels and GPU lowering; ${receipts.controls.length} rejecting controls`);
} catch (e) {
  receipts.status = 'FAIL'; receipts.error = e.message;
  console.error('FAIL legacy texture-operation caps: ' + e.message); process.exitCode = 1;
} finally {
  if (process.env.LEGACY_CAPS_RECEIPT) fs.writeFileSync(process.env.LEGACY_CAPS_RECEIPT, JSON.stringify(receipts, null, 2) + '\n');
}
