#!/usr/bin/env node
'use strict';

// Two DX5 SDK execute-buffer samples that each failed on one D3DIM edge case.
//
// Twist accumulates its rotation with D3DOP_MATRIXMULTIPLY dest = dest * step.
// A multiply that stored while still reading its operands collapsed that
// matrix a little every frame, so the object shrank to a one-pixel sliver.
//
// Tunnel flies down a textured tube, so every wall triangle next to the camera
// crosses the eye plane. Two faults stacked there: d3dapp threw its textures
// away because an unplaced surface never reported DDSCAPS_VIDEOMEMORY, and the
// execute path clipped the eye-plane crossing in screen space, which turned the
// walls into stretched flat shards.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const RUN = path.join(__dirname, 'run.js');
const BIN = path.join(__dirname, 'binaries', 'dx-sdk', 'bin');
const WASM = path.join(ROOT, 'build', 'wine-assembly.wasm');

if (!fs.existsSync(path.join(BIN, 'tunnel.exe')) || !fs.existsSync(WASM)) {
  console.log('SKIP: DX SDK samples or built WASM are unavailable');
  process.exit(0);
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd3dim-sdk-'));

// The window's 312x274 client sits at (24,62) on the 640x480 desktop.
// Each frame is scored on its own and the best kept: the Tunnel camera flies
// on, so one frame can sit where the hazard stripes are at the edge
// (1,218..14,420 yellow pixels between frames 100 batches apart), and any
// guest timing shift moves that phase.
function capture(app, batches, frames = [batches - 10]) {
  const pngPath = n => path.join(outDir, `${app}-${n}.png`);
  const result = spawnSync('node', [
    RUN, `--app=${app}`, '--no-build', '--no-close', '--quiet-api', '--quiet-blocks',
    `--max-batches=${batches}`, '--max-seconds=90', `--input=${frames.map(n => `${n}:png:${pngPath(n)}`).join(',')}`,
  ], { cwd: ROOT, encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.error) throw result.error;
  assert.strictEqual(result.status, 0, `${app} exited ${result.status}\n${output.slice(-3000)}`);
  const best = { lit: 0, yellow: 0, colors: 0 };
  for (const n of frames) {
    assert.ok(fs.existsSync(pngPath(n)), `${app} produced no frame at ${n}\n${output.slice(-3000)}`);
    const png = PNG.sync.read(fs.readFileSync(pngPath(n)));
    const stats = { lit: 0, yellow: 0, colors: new Set() };
    // Skip the fps line at the top and the mode line at the bottom.
    for (let y = 62 + 16; y < 62 + 274 - 16; y++) {
      for (let x = 24; x < 24 + 312; x++) {
        const i = (y * png.width + x) * 4;
        const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
        if (r + g + b > 30) stats.lit++;
        // The hazard stripes and signs, dimmed by the point light to ~#736d00.
        if (r > 70 && g > 60 && b < 30) stats.yellow++;
        stats.colors.add((r << 16) | (g << 8) | b);
      }
    }
    stats.colors = stats.colors.size;
    for (const key of Object.keys(best)) best[key] = Math.max(best[key], stats[key]);
  }
  return best;
}

const twist = capture('dx_twist', 4000);
console.log(`  dx_twist  ${JSON.stringify(twist)}`);
assert.ok(twist.lit > 8000,
  `Twist's accumulated rotation collapsed: only ${twist.lit} lit pixels at batch 4000`);

const tunnel = capture('dx_tunnel', 3000, [2790, 2890, 2990]);
console.log(`  dx_tunnel ${JSON.stringify(tunnel)}`);
// Measured at this batch: textured and clipped 95 colours / 5393 yellow;
// screen-space-clipped shards 20 / 99; texture dropped 5 / 0.
assert.ok(tunnel.colors > 60,
  `Tunnel walls are flat or untextured: ${tunnel.colors} colours in the client area`);
assert.ok(tunnel.yellow > 1500,
  `Tunnel's hazard markings are missing or smeared: ${tunnel.yellow} yellow pixels`);

fs.rmSync(outDir, { recursive: true, force: true });
console.log('PASS  DX SDK Twist keeps its object and Tunnel draws textured, clipped walls');
