#!/usr/bin/env node
'use strict';
// tl;dr: a mipmapped GL texture on the GPU stream is ONE executor texture
// with its whole chain, and the executor picks the level per pixel.
//
//   node test/test-gl-gps-mip-chain.js
//
// Scene: a 64x64 texture whose seven levels are seven solid colours, on a
// floor quad receding in perspective (w 1 -> 8), drawn through the real GL
// front end with --gl-gps on. Checks, on the software executor and (when
// headless GL is available) on the WebGL one:
//   - one chain texture (gl_gps_stat 72), seven level uploads (73), one
//     BIND for the frame although the two triangles span several levels;
//   - the level grows monotonically up the floor and at least three levels
//     show (software GL without the stream picks one level per triangle:
//     at most two colours, which is what this change replaces);
//   - *_MIPMAP_LINEAR draws with no decline;
//   - glTexSubImage2D of level 2 after a frame re-uploads that level only;
//   - an incomplete chain (level 3 missing) keeps the per-level path
//     (stat 75) and matches software GL exactly;
//   - 3-4 chains of one cache set stay resident across frames (software).
const assert = require('assert');
const path = require('path');
const { bootGlGps, comparePictures } = require('./helpers/gl-gps-context');

const ALL = 0x4500;
const SIZE = 64;
// Level L's colour as 0xRRGGBB (the picture's byte order).
const LEVEL_RGB = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffffff];
const OP_BIND = 13;

function webglFactory() {
  const ROOT = path.join(__dirname, '..');
  const hgl = require(path.join(ROOT, 'lib', 'headless-gl'));
  if (!hgl.available()) return { skip: hgl.unavailableReason() };
  const { createCanvas } = require(path.join(ROOT, 'lib', 'canvas-compat'));
  const { WebGLBackend } = require(path.join(ROOT, 'lib', 'gpu-backend'));
  const { Executor } = require(path.join(ROOT, 'lib', 'gpu-stream-webgl'));
  return {
    make: () => {
      const canvas = createCanvas(SIZE, SIZE);
      return new Executor({ canvas, backend: new WebGLBackend(canvas) });
    },
  };
}

function upload(g, level, rgb) {
  const w = SIZE >> level, n = w * w * 4;
  const px = g.e.guest_alloc(n) >>> 0, v = new Uint8Array(g.memory.buffer, g.wa(px), n);
  for (let i = 0; i < n; i += 4) v.set([rgb >> 16 & 255, rgb >> 8 & 255, rgb & 255, 255], i);
  return { px, w };
}

function floor(g) {
  g.call('glEnable', [0xde1]);
  g.call('glColor4f', [1, 1, 1, 1].map(g.f));
  g.call('glBegin', [7]);
  for (const [s, t, x, y, w] of [[0, 0, -1, -1, 1], [1, 0, 1, -1, 1], [1, 8, 8, 7.6, 8], [0, 8, -8, 7.6, 8]]) {
    g.call('glTexCoord2f', [g.f(s), g.f(t)]);
    g.call('glVertex4f', [g.f(x), g.f(y), g.f(0), g.f(w)]);
  }
  g.call('glEnd');
  g.call('glDisable', [0xde1]);
}

// Texture 1 with levels 0..6 (minus $skip), MIN $min, MAG $mag.
function makeTexture(g, min, mag, skip = -1) {
  g.call('glBindTexture', [0xde1, 1]);
  for (let l = 0; l < LEVEL_RGB.length; l++) {
    if (l === skip) continue;
    const { px, w } = upload(g, l, LEVEL_RGB[l]);
    g.call('glTexImage2D', [0xde1, l, 0x1908, w, w, 0, 0x1908, 0x1401, px]);
  }
  g.call('glTexParameteri', [0xde1, 0x2801, min]);
  g.call('glTexParameteri', [0xde1, 0x2800, mag]);
}

const stat = (g, i) => g.e.gl_gps_stat(i) >>> 0;
// Level index of each row (bottom-up) at the centre column; -1 = not a level colour.
function rowLevels(pic) {
  const out = [];
  for (let y = pic.h - 1; y >= 0; y--) out.push(LEVEL_RGB.indexOf(pic.px[y * pic.w + (pic.w >> 1)]));
  return out;
}

async function scene(opts, body) {
  const g = await bootGlGps({ size: SIZE, ...opts });
  g.clear([0, 0, 0, 1], ALL);
  const out = await body(g);
  return { g, out, pic: g.front(), stats: g.stats() };
}

async function nearestChain(label, makeExecutor) {
  const sw = await scene({ gps: 0 }, g => { makeTexture(g, 0x2700, 0x2600); floor(g); g.swap(); });
  const gp = await scene({ gps: 1, makeExecutor }, g => {
    makeTexture(g, 0x2700, 0x2600); floor(g); g.swap();
    return { binds: g.kicks.records[OP_BIND] || 0 };
  });
  const s = gp.stats;
  assert.strictEqual(s.declines, 0, `${label}: no declines ${JSON.stringify(s.reasons)}`);
  assert.strictEqual(s.gpuFrames, 1, `${label}: one GPU frame ${JSON.stringify(s)}`);
  assert.strictEqual(stat(gp.g, 72), 1, `${label}: one chain texture`);
  assert.strictEqual(stat(gp.g, 73), 7, `${label}: seven level uploads`);
  assert.strictEqual(gp.out.binds, 1, `${label}: one BIND for both triangles, got ${gp.out.binds}`);
  const rows = rowLevels(gp.pic).filter(l => l >= 0);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i] >= rows[i - 1], `${label}: level grows up the floor: ${rows.join(',')}`);
  const seen = new Set(rows);
  assert.ok(seen.size >= 3, `${label}: at least three levels per pixel, saw ${[...seen].join(',')}`);
  const swSeen = new Set(sw.pic.px.filter(c => LEVEL_RGB.includes(c)));
  assert.ok(swSeen.size <= 2, `software GL picks one level per triangle: ${[...swSeen].map(c => c.toString(16))}`);
  console.log(`PASS ${label} NEAREST_MIPMAP_NEAREST: 1 chain, 7 level uploads, 1 BIND; levels up the floor ${[...seen].join(',')} (software GL per triangle: ${swSeen.size} level(s))`);
  return gp.pic;
}

async function linearChain(label, makeExecutor) {
  const gp = await scene({ gps: 1, makeExecutor }, g => { makeTexture(g, 0x2703, 0x2601); floor(g); g.swap(); });
  assert.strictEqual(gp.stats.declines, 0, `${label}: LINEAR_MIPMAP_LINEAR no declines ${JSON.stringify(gp.stats.reasons)}`);
  assert.strictEqual(stat(gp.g, 72), 1, `${label}: LINEAR_MIPMAP_LINEAR one chain`);
  // Trilinear blends neighbouring level colours: off-palette pixels appear.
  const blended = gp.pic.px.filter(c => c !== 0 && !LEVEL_RGB.includes(c)).length;
  assert.ok(blended > 0, `${label}: LINEAR_MIPMAP_LINEAR blends levels`);
  console.log(`PASS ${label} LINEAR_MIPMAP_LINEAR: 1 chain, 0 declines, ${blended} blended pixels`);
}

async function subImage(label, makeExecutor) {
  const gp = await scene({ gps: 1, makeExecutor }, g => {
    makeTexture(g, 0x2700, 0x2600); floor(g); g.swap();
    const before = { uploads: stat(g, 73), level2: rowLevels(g.front()).includes(2) };
    const { px } = upload(g, 2, 0x808080);
    g.call('glBindTexture', [0xde1, 1]);
    g.call('glTexSubImage2D', [0xde1, 2, 0, 0, SIZE >> 2, SIZE >> 2, 0x1908, 0x1401, px]);
    g.clear([0, 0, 0, 1], ALL); floor(g); g.swap();
    return before;
  });
  assert.ok(gp.out.level2, `${label}: level 2 visible before the update`);
  assert.strictEqual(stat(gp.g, 73) - gp.out.uploads, 1, `${label}: only level 2 re-uploaded`);
  assert.strictEqual(stat(gp.g, 72), 1, `${label}: same chain texture`);
  assert.ok(gp.pic.px.includes(0x808080), `${label}: level 2's new texels drawn`);
  assert.strictEqual(gp.stats.declines, 0, `${label}: no declines`);
  console.log(`PASS ${label} glTexSubImage2D level 2: one level re-uploaded, new texels drawn`);
}

async function incomplete(label, makeExecutor) {
  const body = g => { makeTexture(g, 0x2700, 0x2600, 3); floor(g); g.swap(); };
  const sw = await scene({ gps: 0 }, body);
  const gp = await scene({ gps: 1, makeExecutor }, body);
  assert.ok(stat(gp.g, 75) >= 1, `${label}: incomplete chain counted`);
  assert.strictEqual(stat(gp.g, 72), 0, `${label}: no chain texture`);
  assert.strictEqual(gp.stats.declines, 0, `${label}: no declines`);
  const cmp = comparePictures(sw.pic, gp.pic, 1);
  assert.ok(cmp.ok, `${label}: per-level path matches software GL ${JSON.stringify(cmp)}`);
  console.log(`PASS ${label} incomplete chain: per-level path, matches software GL (worst ${cmp.worst})`);
}

// Several chains of one cache set stay resident: 200 small mipmapped
// textures are drawn once to find which share a set, then the largest group
// (3 or 4 -- the ways in a set) is drawn every frame for three frames with no
// new chain and no level upload (a 2-way set rebuilt them every frame).
async function sharedSet(label, makeExecutor) {
  const N = 200, S = 16, LEVELS = 5;
  const gp = await scene({ gps: 1, makeExecutor }, g => {
    const draw = name => {
      g.call('glBindTexture', [0xde1, name]);
      floor(g);
    };
    const sets = new Map();
    for (let t = 0; t < N; t++) {
      g.call('glBindTexture', [0xde1, 2 + t]);
      for (let l = 0; l < LEVELS; l++) {
        const w = S >> l, n = w * w * 4;
        const px = g.e.guest_alloc(n) >>> 0;
        new Uint8Array(g.memory.buffer, g.wa(px), n).fill(t & 255);
        g.call('glTexImage2D', [0xde1, l, 0x1908, w, w, 0, 0x1908, 0x1401, px]);
      }
      g.call('glTexParameteri', [0xde1, 0x2801, 0x2700]);
      g.call('glTexParameteri', [0xde1, 0x2800, 0x2600]);
      draw(2 + t);
      const set = g.e.probe_chain_set();
      if (!sets.has(set)) sets.set(set, []);
      sets.get(set).push(2 + t);
    }
    g.swap();
    const group = [...sets.values()].sort((a, b) => b.length - a.length)[0].slice(0, 4);
    const frame = () => { g.clear([0, 0, 0, 1], ALL); for (const t of group) draw(t); g.swap(); };
    frame();
    const after1 = { chains: stat(g, 72), uploads: stat(g, 73) };
    frame(); frame();
    return { group, after1, chains: stat(g, 72), uploads: stat(g, 73) };
  });
  const { group, after1, chains, uploads } = gp.out;
  assert.ok(group.length >= 3, `${label}: 3+ of ${N} textures share a set, largest group ${group.length}`);
  assert.strictEqual(gp.stats.declines, 0, `${label}: no declines ${JSON.stringify(gp.stats.reasons)}`);
  assert.strictEqual(chains - after1.chains, 0, `${label}: ${group.length} chains of one set stay resident (new chains ${chains - after1.chains})`);
  assert.strictEqual(uploads - after1.uploads, 0, `${label}: no level re-uploaded (${uploads - after1.uploads})`);
  console.log(`PASS ${label} ${group.length} chains in one set: resident across frames, 0 new chains, 0 re-uploads`);
}

(async () => {
  await sharedSet('software', null);
  const soft = await nearestChain('software', null);
  await linearChain('software', null);
  await subImage('software', null);
  await incomplete('software', null);
  const web = webglFactory();
  if (web.skip) { console.log(`SKIP webgl executor: ${web.skip}`); return; }
  const webPic = await nearestChain('webgl', web.make);
  await linearChain('webgl', web.make);
  await subImage('webgl', web.make);
  await incomplete('webgl', web.make);
  // The two executors' per-pixel LOD: the same level nearly everywhere
  // (they may disagree on the rows where log2(rho) crosses a rounding edge).
  const cmp = comparePictures(soft, webPic, 0);
  assert.ok(cmp.differ <= soft.px.length * 0.1, `software vs webgl level choice: ${JSON.stringify(cmp)}`);
  console.log(`PASS software vs webgl: ${cmp.differ}/${soft.px.length} pixels differ`);
})().catch(e => { console.error(e); process.exit(1); });
