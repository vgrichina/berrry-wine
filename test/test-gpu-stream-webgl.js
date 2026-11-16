'use strict';
// tl;dr: pixel tests for lib/gpu-stream-webgl.js (the GPU stream v2 WebGL
// executor) on headless GL (desktop GLSL). The scenario itself lives in
// test/gpu-stream-webgl-scenario.js, which test/test-glide-web.js also runs in
// real Chrome for ESSL1 and ESSL3.
//
//   node test/test-gpu-stream-webgl.js
//
// Cases: clear (scissor rect + colormask), flat, textured, truncated mip,
// two texture slots, cull, W/Z depth, fog (table, Z under W, vertex alpha),
// alpha test, READBACK A8B8G8R8, LFB band upload, PRESENT through a gamma LUT
// (exact entries, partial update, RT untouched), sticky state, fail fast;
// then the D1 contract (runD1): caps, compact D3DCOLOR layout, integer pixel
// centres, indexed and direct strips, VIEWPORT, PRESENT stamp/dst, one- and
// two-sided stencil on D24S8, z bias, blend ops, RT bound as a texture,
// mirror/border addressing, perspective vs linear varyings, and refusals.
// Skips (exit 0) with a message when headless GL is unavailable.

const path = require('path');
const ROOT = path.join(__dirname, '..');
const hgl = require(path.join(ROOT, 'lib', 'headless-gl'));
if (!hgl.available()) {
  console.log(`SKIP test-gpu-stream-webgl: ${hgl.unavailableReason()}`);
  process.exit(0);
}
const GS = require(path.join(ROOT, 'lib', 'gpu-stream'));
const { makeProducer } = require('./gpu-stream-fixture');
const { createCanvas } = require(path.join(ROOT, 'lib', 'canvas-compat'));
const { WebGLBackend } = require(path.join(ROOT, 'lib', 'gpu-backend'));
const { Executor } = require(path.join(ROOT, 'lib', 'gpu-stream-webgl'));
const scenario = require('./gpu-stream-webgl-scenario');

const canvas = createCanvas(640, 480);
const backend = new WebGLBackend(canvas);
const r = scenario.run({ GS, makeProducer, Executor, canvas, backend, buffer: new SharedArrayBuffer(1 << 22) });
for (const f of r.failures) console.log(`FAIL ${f}`);
const s = r.stats;
console.log(`stats: ${JSON.stringify({ draws: s.draws, presents: s.presents, readbacks: s.readbacks, programs: s.programs, backend: s.backend })}`);
// Slice 9.4a features (logic ops, partial colour masks, CUBE, occlusion,
// projected texcoords, vertex fog), the same checks the software executor runs.
const r94 = scenario.run94a({ GS, makeProducer, Executor, canvas, backend, buffer: new SharedArrayBuffer(1 << 22) });
for (const f of r94.failures) console.log(`FAIL 9.4a ${f}`);
const s94 = r94.stats || {};
console.log(`9.4a stats: ${JSON.stringify({ logicDraws: s94.logicDraws, logicCopies: s94.logicCopies, occlusionQueries: s94.occlusionQueries, occlusionPasses: s94.occlusionPasses })}`);
const failed = r.failures.length + r94.failures.length, total = r.checks + r94.checks;
console.log(`${failed ? 'FAIL' : 'PASS'} test-gpu-stream-webgl: ${total - failed}/${total} checks`);
process.exit(failed ? 1 : 0);
