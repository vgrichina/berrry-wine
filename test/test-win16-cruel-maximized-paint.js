#!/usr/bin/env node
'use strict';

// Win16 Cruel creates its window at 480x321 and then shows it maximized.
// ShowWindow invalidated the client as it was *before* the maximize was
// recalculated, so the update region stayed 472x275 and every paint was
// clipped to it: five of the twelve piles, a card cut in half at x=476 and no
// second row. Require the sixth column of both pile rows -- entirely outside
// the old client -- to show card faces, not the green baize.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'test', 'binaries', 'wep16', 'WEP1', 'CRUEL.EXE');
const OPTIONAL_WASM = process.env.WINE_ASSEMBLY_WASM || '';

if (!fs.existsSync(EXE)) {
  console.log('SKIP  Win16 Cruel is not installed');
  process.exit(0);
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'win16-cruel-'));
try {
  const shot = path.join(outDir, 'cruel.png');
  const args = [path.join(ROOT, 'test', 'run.js'), '--app=wep16_cruel',
    '--max-batches=201', '--stuck-after=0', '--quiet-api', '--quiet-blocks',
    '--no-close', `--input=200:png:${shot}`];
  if (OPTIONAL_WASM) args.push('--no-build', `--wasm=${OPTIONAL_WASM}`);
  const output = execFileSync(process.execPath, args, {
    cwd: ROOT, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024,
  });
  assert.doesNotMatch(output, /\*\*\* CRASH|UNIMPLEMENTED API|RuntimeError/);

  const png = PNG.sync.read(fs.readFileSync(shot));
  assert.strictEqual(png.width, 640);
  assert.strictEqual(png.height, 480);
  function countWhite(left, top, right, bottom) {
    let n = 0;
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const p = (y * png.width + x) * 4;
        if (png.data[p] === 255 && png.data[p + 1] === 255 && png.data[p + 2] === 255) n++;
      }
    }
    return n;
  }
  // Sixth pile of the first and second rows (screen x 514-584).
  const row1 = countWhite(516, 192, 582, 284);
  const row2 = countWhite(516, 330, 582, 422);
  assert(row1 > 1500 && row2 > 1500,
    `both pile rows must reach the sixth column (${row1}, ${row2} white px)`);
  console.log(`PASS  Win16 Cruel paints its full maximized layout (${row1}, ${row2} white px in column 6)`);
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
