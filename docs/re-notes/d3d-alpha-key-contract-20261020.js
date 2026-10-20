'use strict';
// Focused source-extracted helpers, not a renderer or a policy implementation.
// See sibling report for primary oracles and deliberately unknown interactions.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const {compile} = require(path.join(root, 'tools/watx.js'));
const core = fs.readFileSync(path.join(root, 'src/09ab-handlers-d3dim-core.wat'), 'utf8');
const shader = fs.readFileSync(path.join(root, 'lib/d3d9-fixed.js'), 'utf8');
function form(marker) {
  const start = core.indexOf(marker);
  assert(start >= 0, marker);
  let depth = 0;
  // These extracted forms have no parentheses inside strings/block comments.
  // Skip line comments so future explanatory parentheses do not affect parsing.
  let comment = false;
  for (let i = start; i < core.length; i++) {
    if (core[i] === '\n') comment = false;
    if (comment) continue;
    if (core.slice(i, i + 2) === ';;') { comment = true; continue; }
    if (core[i] === '(') depth++;
    if (core[i] === ')' && --depth === 0) return core.slice(start, i + 1);
  }
  throw Error('unbalanced extraction');
}
const fetch = form('(func $d3dim_texture_fetch_prepared');
const membership = form('(i32.eq (local.get $key)\n            (i32.load8_u');
const wat = `
(memory 1)
(export "memory" (memory 0))
(func $d3dim_decode_surface_pixel_fmt (param i32 i32 i32) (result i32) (unreachable))
${fetch}
(export "fetch" (func $d3dim_texture_fetch_prepared))
(func (export "member") (param $key i32) (param $tdib i32)
 (param $y i32) (param $tpitch i32) (param $x i32) (result i32)
 ${membership})`;
const compiled = compile(wat, new Map(), {mode: 'production'});
assert(compiled.wasmBinary, 'helper compilation failed');
const wasm = Buffer.from(compiled.wasmBinary);
const e = new WebAssembly.Instance(new WebAssembly.Module(wasm)).exports;
const bytes = new Uint8Array(e.memory.buffer);
const palette = 2048, dib = 1024, rows = [];
// Two equal-RGB entries deliberately differ only in raw index.
// All alpha values include the boundary implicated by the GPU predicate.
for (const alpha of [0, 1, 64, 127, 128, 255]) {
  bytes.set([7, 8], dib);
  bytes.set([31, 79, 173, alpha], palette + 7 * 4);
  bytes.set([31, 79, 173, alpha], palette + 8 * 4);
  const before = Buffer.from(bytes);
  for (const mode of [0, 1]) {
    for (const x of [0, 1]) {
      const color = e.fetch(8, 2, dib, 0, palette, mode, x, 0) >>> 0;
      assert.equal(color, (((mode ? alpha : 255) << 24) | 0x1f4fad) >>> 0);
      const member = !!e.member(7, dib, 0, 2, x);
      assert.equal(member, x === 0);
      rows.push({alpha, paletteAlpha: !!mode, index: 7 + x, color, member});
    }
  }
  assert.deepEqual(Buffer.from(bytes), before, 'helpers must not write memory');
}
// Execute the actual source predicate, translating only GLSL field access to
// the supplied JS object. This is characterization, never a keyed-draw oracle.
const match = shader.match(/pbody\.push\('if \((sample0\.a < [\d.]+)\) discard;'\)/);
assert(match, 'current source predicate must be explicitly reviewable');
const discard = new Function('sample0', `return ${match[1]};`);
const characterized = [0, 1, 64, 127, 128, 255].map(alpha => ({
  index: 8, key: 7, alpha, rawMember: false,
  currentGPUKeyDiscard: discard({a: alpha / 255}),
  normativeFinalDraw: null
}));
assert.deepEqual(characterized.map(x => x.currentGPUKeyDiscard),
  [true, true, true, true, false, false]);
// Demonstrate sensitivity to the two mistakes this fixture separates.
assert(rows.some(x => x.paletteAlpha && x.alpha !== 255 && (x.color >>> 24) !== 255));
assert(rows.some(x => !x.member && (x.color & 0xffffff) === 0x1f4fad));
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const result = {
  scope: '24 real WAT fetch/membership pairs; shader predicate only, no GPU/framebuffer',
  normativePairs: rows.length, rows, characterized,
  memoryUnchanged: true,
  hashes: {core: sha(core), shader: sha(shader), extractedWat: sha(wat), wasm: sha(wasm)},
  excluded: 'Combined alpha/key precedence, filtering, API attachment, blend/depth execution'
};
if (process.argv[2]) {
  fs.mkdirSync(process.argv[2], {recursive: true});
  fs.writeFileSync(path.join(process.argv[2], 'helpers.wat'), wat);
  fs.writeFileSync(path.join(process.argv[2], 'helpers.wasm'), wasm);
  fs.writeFileSync(path.join(process.argv[2], 'tests.json'), JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify(result, null, 2));
