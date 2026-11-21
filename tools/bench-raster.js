#!/usr/bin/env node
'use strict';
// tl;dr: price ONE full-screen pixel in the software D3D9 rasterizer, and say
// which part of it the texture sampler is.
//
//   node tools/bench-raster.js [--size=640x480] [--reps=5] [--arms=a,b] [--json]
//
// WHY THIS EXISTS. "The software rasterizer is slow" is not actionable, and the
// whole-app measurements that provoke it cannot be: a Black & White 2 frame is
// ~550 draws of wildly different shapes on a box running several agents, so any
// per-frame number moves with the scene and the load rather than with the code.
// This draws exactly one screen-covering quad and changes exactly one thing
// between arms, so the DIFFERENCE between two arms is attributable.
//
// HOW TO READ IT. Quote the RATIOS, not the absolute ns/px. The ratios are what
// survive a loaded machine; the absolute number is this box today. Arms are run
// INTERLEAVED, one rep of each in rotation with the order rotated every rep, so
// a thermal ramp or another agent's sweep lands on all arms alike instead of on
// whichever one ran first. The reported figure per arm is its MEDIAN rep, not
// its mean: one rep that collided with someone else's build should not move it.
//
// WHAT THE ARMS ISOLATE. Every arm draws the same two triangles with the same
// bounding box; only coverage and sampling differ.
//
//   sliver    two hair-thin diagonal triangles -- SAME full-screen bounding box,
//                                            so the 2x2 tile walk and all its
//                                            per-quad setup run in full, but
//                                            ~0.2% of pixels pass the coverage
//                                            test, so the shader VM and the
//                                            framebuffer write almost never run.
//   flat      ps_1_1 `mov r0,v0`          -- full coverage, no texture at all.
//   flat8     the same plus 7 `add`       -- eight instructions instead of one,
//                                            identical in every other respect,
//                                            so `flat8 - flat` is seven
//                                            interpreter steps and nothing else.
//   point     `texld t0` MAGFILTER=POINT  -- adds one texel fetch per pixel.
//   bilinear  `texld t0` MAGFILTER=LINEAR -- four texel fetches per pixel.
//   trilinear bilinear + a mip chain      -- eight, across two levels.
//
// So `flat - sliver` is the shading and write half, `point - flat` is what one
// texture fetch costs, and `bilinear - point` is what the extra three taps cost.
//
// WHAT IT FOUND (2026-09-14, 640x480, loaded box, so read the ratios). Against
// a ONE-instruction shader the sampler is not the main cost and neither is the
// VM: `sliver` came in at 80-87% of `flat`, so a pixel that is never shaded and
// never written already costs most of a shaded one, and sampling adds a further
// 35-46% on top.
//
// `flat8` then showed that reading is an artefact of the shader being one
// instruction long. Over three runs: setup ~290-320 ns/px, VM entry ~30, and
// **~42 ns/px for each additional shader instruction** -- about 170ns per 2x2
// packet to execute at most four f32x4 ops. Extrapolating at those rates, the
// VM is 19% of a 1-instruction pixel, 55% at eight, and ~74% at twenty. So for
// any shader a real game ships, the interpreter dominates, and the per-pixel
// fixed costs below matter less the longer the shader gets. Always say which
// shader length a share is quoted at.
//
// MEASURED ON A QUIET BOX (2026-09-14, load 3.5, 640x480, three builds rotated,
// median of three rounds, ns/px): the per-quad temp-bank fill (5a66a6f5) was
// -28% sliver / -21% flat / -12% flat8; the ALU fast path + mask gating
// (78cc3c5d, 524978da) took an ALU instruction from 20.6 to 17.3 ns/px. The
// noise floor: an IDENTICAL build run nine times over 90s drifted +12% from
// thermal ramp alone, so never read a <10% difference off two consecutive runs
// of this tool -- interleave, and compare medians. For WHERE the time goes,
// `node --cpu-prof --no-wasm-inlining tools/bench-raster.js --arms=X` then
// tools/func-index.js on the hot indices (regenerate build/combined.wat first
// or the names are off by the functions added since): $d3d_software_step is
// 32-39% of every arm; the sampler family is ~46% of `bilinear`.
//
// That points at the block in src/09ah-d3d-software.wat that runs per 2x2 quad
// BEFORE the coverage test (`block $outside` sits after it), for all four lanes
// whether they are inside the triangle or not:
//   * memory.fill of 8192 bytes of VM register bank -- 2KB per pixel;
//   * a fixed 28-iteration varying loop plus a 4-iteration specular loop, each
//     iteration a $d3d_software_interp (3 vertex loads, 3 multiplies) followed
//     by an f32.div for the perspective correction -- about 36 interpolations
//     and 33 divides per pixel, and the 28 is a constant, not the number of
//     varyings the pixel shader actually reads.
// The sampler shape is real too (src/09ag-d3d-shader-vm.wat samples ONE
// COMPONENT at a time, re-deriving wrap, format branch and byte address for
// each of R,G,B,A and loading one byte each time, with the caller breaking its
// f32x4 packet into scalar lanes around every fetch) -- it is just the smaller
// half.
//
// A NOTE ON WHAT THIS IS NOT. It says nothing about how many pixels a real
// frame shades, so it cannot be turned into an fps prediction. Pair it with a
// draw census (run.js --d3d9-gps=software stats print the executor's) before claiming
// any app-level win from a rasterizer change.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { bootRenderHarness } = require(path.join(__dirname, '..', 'test', 'render-helper'));
const { Device } = require(path.join(__dirname, '..', 'lib', 'd3d9-software-backend'));

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
};
const size = String(flag('size', '640x480')).split('x').map(Number);
const [width, height] = size;
const reps = Number(flag('reps', '5'));
if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
  throw new Error('--size must be WxH');
if (!Number.isInteger(reps) || reps < 1 || reps > 51) throw new Error('--reps must be 1..51');

// ps_1_1. Without a texture the shader just moves the diffuse input; with one
// it declares the stage, samples it and moves that. Identical instruction count
// either side of the sample, so the arms differ by the fetch and nothing else.
const PS_FLAT = new Uint32Array([0xffff0101, 1, 0x800f0000, 0x90e40000, 0xffff]);
// Eight arithmetic instructions instead of one, same pixel count, same
// coverage, no texture. `flat8 - flat` is seven extra interpreter steps per
// packet and nothing else, which is how the per-INSTRUCTION cost of the shader
// VM gets separated from the per-PACKET cost of entering it. ps_1_1 allows
// exactly 8 arithmetic instructions, so this is the longest legal ps_1_1 arm.
const PS_FLAT8 = new Uint32Array([0xffff0101,
  1, 0x800f0000, 0x90e40000,                 // mov r0, v0
  ...Array.from({ length: 7 }, () => [2, 0x800f0000, 0x80e40000, 0x90e40000]).flat(),
  0xffff]);                                  // add r0, r0, v0   (x7)
const PS_TEX = new Uint32Array([0xffff0101,
  0x42, 0xb00f0000,            // tex t0   (t is register type 3)
  1, 0x800f0000, 0xb0e40000,   // mov r0, t0
  0xffff]);

// One screen-covering triangle pair in POSITIONT (already in screen pixels, so
// no matrices are involved and the arms cannot differ by transform work).
// `sliver` instead emits two hair-thin triangles along the diagonal: the same
// full-screen bounding box, so the 2x2 tile walk and every per-quad setup cost
// is identical, but almost no pixel passes the coverage test, so neither the
// shader VM nor the framebuffer write runs. `covered - sliver` is therefore the
// shading half and `sliver` alone is the setup floor the walk pays regardless.
function quad(sliver) {
  // POSITIONT float4 at 0, diffuse D3DCOLOR at 16, TEXCOORD0 float2 at 20.
  const stride = 28, vertices = new Uint8Array(6 * stride), v = new DataView(vertices.buffer);
  // Two triangles covering the target, with a texture coordinate that sweeps
  // the whole image so the sampler walks it rather than resampling one line.
  const points = sliver
    ? [[0, 0], [width, height], [1, 0], [0, 0], [width, height], [0, 1]]
    : [[0, 0], [width, 0], [0, height], [width, 0], [width, height], [0, height]];
  points.forEach(([x, y], j) => {
    const at = j * stride;
    [x, y, 0.5, 1].forEach((c, k) => v.setFloat32(at + k * 4, c, true));
    vertices.set([255, 255, 255, 255], at + 16);
    v.setFloat32(at + 20, x / width, true);
    v.setFloat32(at + 24, y / height, true);
  });
  return { stride, vertices };
}

function texture(levels, filter) {
  const build = n => {
    const pixels = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) {
      pixels[i * 4] = i & 255; pixels[i * 4 + 1] = (i >> 3) & 255;
      pixels[i * 4 + 2] = (i >> 6) & 255; pixels[i * 4 + 3] = 255;
    }
    return { width: n, height: n, pixels };
  };
  const chain = [];
  for (let n = 256; n >= 1 && chain.length < levels; n >>= 1) chain.push(build(n));
  return { ...chain[0], levels: chain, originalWidth: 256, originalHeight: 256, baseLOD: 0,
    sampler: { addressU: 1, addressV: 1, borderColor: 0, mag: filter, min: filter,
      mip: levels > 1 ? 2 : 0, lodBias: 0, maxMipLevel: 0 } };
}

const ARMS = {
  sliver: () => ({ pixelShader: PS_FLAT, textures: [], sliver: true }),
  flat: () => ({ pixelShader: PS_FLAT, textures: [] }),
  flat8: () => ({ pixelShader: PS_FLAT8, textures: [] }),
  point: () => ({ pixelShader: PS_TEX, textures: [texture(1, 1)] }),
  bilinear: () => ({ pixelShader: PS_TEX, textures: [texture(1, 2)] }),
  trilinear: () => ({ pixelShader: PS_TEX, textures: [texture(9, 2)] }),
};

const FIXED = { lighting: false, specular: false, fog: false, textureFactor: 0xffffffff,
  stages: [{ colorOp: 2, colorArg1: 0, colorArg2: 1, alphaOp: 2, alphaArg1: 0, alphaArg2: 1,
    constant: 0xffffffff, texCoordIndex: 0, transformFlags: 0 }, { colorOp: 1 }] };

(async () => {
  const selected = String(flag('arms', Object.keys(ARMS).join(','))).split(',');
  for (const name of selected) if (!ARMS[name]) throw new Error(`unknown arm ${name}`);

  // An explicit module permits interleaved old/new runs without changing the
  // shared checkout. Keep its identity beside the raw measurements.
  const modulePath = flag('module', null);
  const bytes = modulePath ? fs.readFileSync(modulePath) : null;
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none',
    prebuiltModule: bytes ? await WebAssembly.compile(bytes) : null });
  const device = new Device({ width, height, getExports: () => e, getMemory: () => memory.buffer });
  const covered = quad(false), slivered = quad(true);
  const stride = covered.stride;
  const attributes = [{ register: 0, usage: 9, usageIndex: 0, type: 3, offset: 0 },
    { register: 1, usage: 10, usageIndex: 0, type: 4, offset: 16 },
    { register: 2, usage: 5, usageIndex: 0, type: 1, offset: 20 }];

  const draw = name => {
    const { sliver, ...arm } = ARMS[name]();
    return { primitive: 4, primitiveCount: 2, stride, attributes,
      vertices: (sliver ? slivered : covered).vertices,
      vertexShader: null, fixedFunction: FIXED, state: { cull: 1, zenable: false }, ...arm };
  };

  // One untimed pass per arm: the first draw of a shape compiles its shader and
  // warms every tier, and timing a compile as if it were fill rate is the
  // classic way to get this measurement wrong.
  for (const name of selected) { device.clear([0, 0, 0, 1], 1); device.draw(draw(name)); device.present(); }

  const samples = Object.fromEntries(selected.map(name => [name, []]));
  const cpuSamples = Object.fromEntries(selected.map(name => [name, []]));
  const outputs = {};
  const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  for (let rep = 0; rep < reps; rep++) {
    // Rotate the order every rep so no arm is permanently first or last.
    const order = selected.map((_, i) => selected[(i + rep) % selected.length]);
    for (const name of order) {
      const command = draw(name);
      device.clear([0, 0, 0, 1], 1);
      const started = process.hrtime.bigint();
      const cpuStarted = process.cpuUsage();
      device.draw(command);
      device.present();
      const cpu = process.cpuUsage(cpuStarted);
      cpuSamples[name].push((cpu.user + cpu.system) / 1000);
      samples[name].push(Number(process.hrtime.bigint() - started) / 1e6);
      outputs[name] = { pixels: digest(device.readPixels()),
        depth: digest(new Uint8Array(memory.buffer, device.depth.wa, device.depth.bytes)),
        samples: String(device.lastDrawSamples) };
    }
  }
  device.destroy();

  const median = list => [...list].sort((a, b) => a - b)[list.length >> 1];
  const pixels = width * height;
  const rows = selected.map(name => {
    const ms = median(samples[name]);
    return { arm: name, ms: +ms.toFixed(2), nsPerPixel: +(ms * 1e6 / pixels).toFixed(1),
      spread: +(Math.max(...samples[name]) / Math.min(...samples[name])).toFixed(2) };
  });
  const flat = rows.find(r => r.arm === 'flat');

  if (args.includes('--json')) { console.log(JSON.stringify({ width, height, reps, rows,
    moduleSHA256: bytes ? digest(bytes) : null, engine: process.versions,
    samples, cpuSamples, outputs }, null, 2)); return; }
  console.log(`software rasterizer, one covering quad at ${width}x${height} (${pixels} px), ` +
    `median of ${reps} interleaved reps`);
  console.log('  arm         median    ns/px    vs flat   rep spread');
  for (const row of rows) {
    const share = flat && row.arm !== 'flat'
      ? `${(100 * (row.ms - flat.ms) / row.ms).toFixed(0)}%`.padStart(8) : '       -';
    console.log(`  ${row.arm.padEnd(10)} ${String(row.ms).padStart(7)}ms ${String(row.nsPerPixel).padStart(7)}` +
      `   ${share}         x${row.spread}`);
  }
  console.log('  "vs flat" is this arm\'s cost above the untextured covering quad, as a share of ' +
    'itself:\n  positive for the sampling arms, negative for sliver, which is the setup floor.');
  console.log('  Quote the ratios. A rep spread far above 1.1 means the box was busy; ' +
    'the absolute ns/px is this machine today, the shares are the finding.');
})().catch(error => { console.error(error); process.exit(1); });
