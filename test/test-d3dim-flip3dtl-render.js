#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const RUN = path.join(__dirname, 'run.js');
const EXE = path.join(__dirname, 'binaries', 'dx-sdk', 'bin', 'flip3dtl.exe');
const WASM = path.join(ROOT, 'build', 'wine-assembly.wasm');

if (!fs.existsSync(EXE) || !fs.existsSync(WASM)) {
  console.log('SKIP: Flip3DTL binary or built WASM is unavailable');
  process.exit(0);
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd3dim-flip3dtl-'));
const pngPath = path.join(outDir, 'frame.png');
const result = spawnSync('node', [
  RUN,
  `--exe=${EXE}`,
  '--no-build',
  '--no-close',
  '--quiet-api',
  '--quiet-blocks',
  '--max-batches=50',
  '--batch-size=1000',
  `--png=${pngPath}`,
  '--input=45:stop',
], {
  cwd: ROOT,
  encoding: 'utf8',
  timeout: 30000,
  maxBuffer: 16 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const output = `${result.stdout || ''}${result.stderr || ''}`;
if (result.error) throw result.error;
assert.strictEqual(result.status, 0, `Flip3DTL exited ${result.status}\n${output.slice(-4000)}`);
assert.ok(fs.existsSync(pngPath), `Flip3DTL produced no frame\n${output.slice(-4000)}`);

const png = PNG.sync.read(fs.readFileSync(pngPath));
let centerPixels = 0;
for (let y = 70; y < Math.min(410, png.height); y++) {
  for (let x = 140; x < Math.min(500, png.width); x++) {
    const off = (y * png.width + x) * 4;
    if (png.data[off] || png.data[off + 1] || png.data[off + 2]) centerPixels++;
  }
}

// The captions TextOut'd through GetDC at y=0 and y=432 every frame.
let captionPixels = 0;
for (const [y0, y1] of [[0, 16], [432, 448]]) {
  for (let y = y0; y < Math.min(y1, png.height); y++) {
    for (let x = 0; x < png.width; x++) {
      const off = (y * png.width + x) * 4;
      if (png.data[off] || png.data[off + 1] || png.data[off + 2]) captionPixels++;
    }
  }
}

fs.rmSync(outDir, { recursive: true, force: true });
assert.ok(centerPixels > 1000,
  `Flip3DTL HUD advanced but animated cube was absent (${centerPixels} center pixels)`);
assert.ok(captionPixels > 100,
  `Flip3DTL's GetDC captions did not reach the GPU frame (${captionPixels} caption pixels)`);

// Per frame Flip3DTL colour-fills its back buffer, draws the cube, then
// GetDC/TextOut/ReleaseDC and Flips. Neither the fill nor the text reads a
// GPU-owned pixel, so no frame may be read back: the fill is a GPU CLEAR,
// the DC stays deferred and only the text rects are uploaded, and the Flip
// stays a GPU Flip (src/09abg-d3dim-gps.wat $d3dim_gps_getdc_defer).
const stat = (line, name) => {
  const m = new RegExp(`(?:^| )${name}=(\\d+)`).exec(line || '');
  assert.ok(m, `missing ${name} in d3dim-gps stats\n${output.slice(-4000)}`);
  return Number(m[1]);
};
const lines = output.split('\n');
const main = lines.find(s => s.startsWith('[d3dim-gps] draws='));
const sites = lines.find(s => s.startsWith('[d3dim-gps] readback sites'));
const flips = stat(main, 'flips');
const uploads = stat(main, 'uploads');
assert.ok(flips >= 3, `Flip3DTL Flips took the CPU path (flips=${flips})\n${main}`);
assert.strictEqual(stat(sites, 'getDC'), 0, `GetDC read the GPU frame back\n${sites}`);
assert.strictEqual(stat(sites, 'bltDst'), 0, `the colour fill read the GPU frame back\n${sites}`);
assert.strictEqual(stat(main, 'readbacks'), stat(sites, 'capture'),
  `a readback other than the harness capture\n${main}\n${sites}`);
assert.ok(stat(sites, 'getDCDeferred') >= flips, `GetDC was not deferred\n${sites}`);
assert.ok(uploads <= 2 * flips + 4, `more than the two caption uploads per frame (${uploads} for ${flips} flips)`);
console.log(`PASS  Flip3DTL rasterizes its animated cube (${centerPixels} center pixels, `
  + `${captionPixels} caption pixels); ${flips} GPU flips, 0 frame readbacks, ${uploads} uploads`);
