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
const root = path.resolve(__dirname, '..');
const corePath = process.env.LEGACY_CAPS_CORE || path.join(root, 'src/09ab-handlers-d3dim-core.wat');
const core = fs.readFileSync(corePath, 'utf8');
const directx = fs.readFileSync(path.join(root, 'src/09a8-handlers-directx.wat'), 'utf8');
const rasterSource = fs.readFileSync(path.join(root, 'src/09a8g-gl-raster.wat'), 'utf8');
const openglSource = fs.readFileSync(path.join(root, 'src/09a8b-handlers-opengl.wat'), 'utf8');
const stippleSource = fs.readFileSync(path.join(root, 'src/09a8cc-gl-stipple.wat'), 'utf8');
const helperSource = fs.readFileSync(path.join(root, 'src/10-helpers.wat'), 'utf8');
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
names.push('d3dim_tss_addr', 'd3dim_mip_filters', 'rasterize_triangle_textured', 'viewport_draw_textured_span');
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
  const source = [core, directx, rasterSource, stencilSource, openglSource, stippleSource, helperSource].find(s => s.includes(`(func $${n} `) || s.includes(`(func $${n}\n`));
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
  const declaration = [core, directx, rasterSource, stencilSource, openglSource, stippleSource, helperSource].join('\n')
    .match(new RegExp(`\\(global \\$${n}\\s+(?:\\(mut\\s+)?(i32|f32|f64)`));
  const type = declaration ? declaration[1] : 'i32';
  return `(global $${n} (mut ${type}) (${type}.const ${n === 'reg_base' ? 256 : n === 'rast_color_mask' ? -1 : 0}))`;
}).join('\n');
// WATX consumes top-level forms, rather than a standard-WAT module wrapper.
// Only the unsupported-key/mip diagnostic references this fixture region.
// Keep its real region.addr intact; crash_unimplemented remains a throwing import.
const prefix = `(region.declare-fixed $D3DIM_AUX (base 1024) (size 128) (align 16))
(memory 1) (export "memory" (memory 0))\n${imported.map(n => `(import "fixture" "${n}" (func $${n} ${signatures[n]}))`).join('\n')}\n${globalText}\n`;
const suffix = [...names, ...(argumentStateRepair ? ['d3ddev_init_state'] : [])].map(n => `(export "${n}" (func $${n}))`).join('\n');
const assembled = prefix + forms.join('\n') + suffix;
const mutations = process.argv.includes('--negative-controls');
const receipts = {qualification: 'source excerpts only; fixture imports, no COM/native guest/WebGL/gameplay',
  node: process.version, corePath, coreSHA256: sha(core), directxSHA256: sha(directx), excerpts,
  compiler: ['tools/watx.js', ...['compiler-parser.js', 'compiler-stages.js', 'compiler-codegen.js', 'compiler.js'].map(n => 'tools/watx-src/' + n)]
    .map(file => ({file, sha256: sha(fs.readFileSync(path.join(root, file)))})),
  extractionRecipe: 'balanced form at unique marker; UTF-8 byte offsets start inclusive/end exclusive; concatenate names in test order, then fill_primcaps; fixture imports/globals and exports wrap verbatim forms',
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
    // Ordinary setters: this fixture opens neither an immediate sequence nor
    // state-block recording. Keep those peripheral lifecycle checks explicit.
    d3dim_immediate_forbid: () => {
      assert.equal(new DataView(e.memory.buffer).getUint32(4096 + 4028, true), 0);
      return 0;
    },
    d3dim_sb_record: () => 0,
    gl_2d_border_record: () => 0, // Fixture textures have no GL border records.
    gl_sw_second_pixel: () => {}, // No GL front-and-back secondary target.
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
// The GPU-lowering half (gpuDraw: the deleted JS executor lib/d3dim-gpu.js
// lowering a WAT d3dim_gpu_describe record) is gone with that executor. Stage
// operations through the WAT GPU stream producer are rendered by
// test-legacy-texture-operation-web.js --offline (software and gps).
const tex = 0xa0c08040, diffuse = 0x8060a0e0;
// Independent byte expectations, not copies of the production formulas.
const expected = new Map([[2, tex], [3, diffuse], [4, 0x50485038]]);
function supported(f) {
  for (const c of [2, 3, 4]) for (const a of [2, 3, 4]) {
    const want = ((expected.get(c) & 0xffffff) | (expected.get(a) & 0xff000000)) >>> 0;
    assert.equal(f.e.d3dim_texture_stage_combine(tex, diffuse, c, a) >>> 0, want, `software ${c}/${a}`);
    f.setOps(c, a);
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
  assert.equal(result, 0x0000000f, 'TextureOpCaps must advertise exactly proven DISABLE/SELECTARG1/2/MODULATE');
  assert.equal(f.dv.getUint16(p + 184, true), 1);
  assert.equal(f.dv.getUint16(p + 186, true), 1);
  assert.equal(f.dv.getUint32(p + 176, true), 8);
  assert.equal(f.dv.getUint32(p + 188, true), 8);
  assert.equal(f.dv.getUint32(p + 40, true), 0x030003c3);
  assert.equal(f.dv.getUint32(p + 96, true), 0x030003c3 | 0x0003003c,
    'triangle base filters plus independently covered point/linear mip filters');
  return Buffer.from(f.e.memory.buffer, p, 236).toString('hex');
}
function reject(label, fn) { assert.throws(fn, assert.AssertionError, label); receipts.controls.push(label); }
// Independent per-byte oracle: selectors choose operands before the operation.
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
function argumentCases(f) {
  for (const [type, value] of [[1,4],[2,2],[3,1],[4,2],[5,2],[6,1]])
    assert.equal(f.e.d3dim_tss_load(4096,0,type), value, `real initialized default ${type}`);
  f.setOps(4,2);
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
        const want = argumentResult(c,a,args);f.setOps(c,a);
        assert.equal(f.e.d3dim_texture_stage_combine(tex,diffuse,
          f.e.d3dim_stage_operation(4096,1),f.e.d3dim_stage_operation(4096,4)) >>> 0,want);
        f.softwareOuter(want); count++;
      }
    }
  // Stage zero CURRENT is the incoming diffuse, including as explicit ARG1.
  for (const type of [2,3,5,6]) f.e.d3dim_set_tss(1,0,type,1);
  f.setOps(2,3);
  f.softwareOuter(diffuse);
  f.dv.setUint32(4096+2824,0,true);
  for (const c of [2,3,4]) for (const a of [2,3,4]) {
    f.setOps(c,a);
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
  // Keep diagnostics for all six unadvertised operations. RGB ADD is now
  // implemented (its ALPHAOP still falls back); the other five still modulate.
  for (const op of [5, 6, 7, 8, 9, 10]) {
    const got = f.e.d3dim_texture_stage_combine(tex, diffuse, op, op) >>> 0;
    // Independent semantic red values distinguish the five MODULATE fallbacks
    // and prove the now-implemented saturated RGB ADD without advertising it.
    // Expected red in byte units (fractional values precede quantization).
    const redExpected = new Map([[5, 192 * 96 / 255 * 2], [6, 255],
      [7, 255], [8, 160.5], [9, 255], [10, 96]]).get(op);
    const want = op === 7 ? 0x50ffffff : expected.get(4);
    assert.equal(got, want);
    if (op === 7) assert.equal((got >>> 16) & 255, redExpected);
    else assert.notEqual((got >>> 16) & 255, redExpected);
    f.setOps(op, op);
    f.softwareOuter(want);
    receipts.cases.push({operation: op, observed: got.toString(16), observedRed: got >>> 16 & 255,
      semanticRed: redExpected,
      bothOuterSoftwareRoutes: op === 7 ? 'actual software triangle and span, saturated RGB ADD / MODULATE alpha'
        : 'actual software triangle and span, legacy MODULATE fallback'});
  }
  receipts.descriptorHex = caps(f);
  if (argumentStateRepair) receipts.argumentCases = argumentCases(makeFixture(assembled));
  const acceptedDescriptor = receipts.descriptorHex;
  if (mutations) {
    for (const mask of ['0x0000E', '0x0001F', '0x00007']) {
      const altered = assembled.replace('(i32.const 0x0000F)', `(i32.const ${mask})`);
      assert.notEqual(altered, assembled); reject(`capability mutation ${mask}`, () => caps(makeFixture(altered)));
    }
    const wrongSoftware = assembled.replace('(then (local.set $rgb (i32.and (local.get $tex)',
      '(then (local.set $rgb (i32.and (local.get $diffuse)');
    assert.notEqual(wrongSoftware, assembled);
    reject('software SELECTARG1 operand mutation', () => supported(makeFixture(wrongSoftware)));
    if (argumentStateRepair) {
      // The hardcoded-argument mutations targeted d3dim_gpu_describe's argument
      // stores, which left src with the JS executor's descriptor ABI.
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
  console.log(`PASS legacy texture-operation caps: 9 pairs, 6 unadvertised operations (RGB ADD and 5 fallbacks); ${receipts.argumentCases || 0} argument combinations, real software pixels; ${receipts.controls.length} rejecting controls`);
} catch (e) {
  receipts.status = 'FAIL'; receipts.error = e.message;
  console.error('FAIL legacy texture-operation caps: ' + e.message); process.exitCode = 1;
} finally {
  if (process.env.LEGACY_CAPS_RECEIPT) fs.writeFileSync(process.env.LEGACY_CAPS_RECEIPT, JSON.stringify(receipts, null, 2) + '\n');
}
