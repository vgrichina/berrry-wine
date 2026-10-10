#!/usr/bin/env node
'use strict';

// First-action coverage for the WEP2 games not already exercised by the Pipe,
// JigSawed, and Visual Basic gameplay suites.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { PNG } = require('pngjs');
const { diffPng } = require('../tools/png-diff');

const ROOT = path.join(__dirname, '..');
const RUN = path.join(ROOT, 'test', 'run.js');

function changedPixels(beforePath, afterPath, rect) {
  const diff = diffPng(beforePath, afterPath, { includeAlpha: true, region: rect });
  assert.strictEqual(diff.sizeMismatch, false, 'gameplay capture dimensions must match');
  return diff.changed;
}

let built = false;
function runGame(app, input, maxBatches) {
  const args = [RUN, `--app=${app}`, '--no-close', '--batch-size=20000',
    `--max-batches=${maxBatches}`, '--quiet-api', '--quiet-blocks',
    '--repaint-every=5', `--input=${input}`];
  if (built) args.splice(2, 0, '--no-build');
  const output = execFileSync(process.execPath, args, {
    cwd: ROOT, encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024,   // measures 2s
  });
  built = true;
  return output;
}

function assertHealthy(output, game) {
  assert.doesNotMatch(output, /\*\*\* CRASH|UNIMPLEMENTED API|RuntimeError|Unreachable code/,
    `${game} must not crash or trap during its first real action`);
}

// The archive's installed WEP2 volume ships a CARDS.DLL with 1407 bytes in
// 0xc284-0xd1c0 shifted by two, which breaks the ace and two of clubs: the ace
// draws with a black block over its index, and the two's header no longer
// parses, so that card -- and its selection highlight -- never draws. Volumes
// 1 and 4 carry the identical build intact; see docs/re-notes/wep16-freecell.md.
function checkWep2Cards() {
  const dir = path.join(ROOT, 'test', 'binaries', 'wep16');
  const wep2 = fs.readFileSync(path.join(dir, 'WEP2', 'CARDS.DLL'));
  const wep1 = fs.readFileSync(path.join(dir, 'WEP1', 'CARDS.DLL'));
  assert(wep2.equals(wep1), 'wep16/WEP2/CARDS.DLL is the corrupt archive copy; ' +
    'stage the identical intact build from wep16/WEP1/CARDS.DLL');
}

function testFreeCell(outDir) {
  checkWep2Cards();
  const before = path.join(outDir, 'freecell-before.png');
  const after = path.join(outDir, 'freecell-after.png');
  const moved = path.join(outDir, 'freecell-moved.png');
  // Game #16813: the 2 of clubs ends cascade 1. Selecting it and clicking the
  // first free cell moves it there, and FreeCell then plays both black aces
  // and the 2 home on its own.
  const output = runGame('wep16_freecell',
    `40:png:${before},60:keydown:113,61:keyup:113,130:png:${after},` +
    '200:mousedown:43:300,205:mouseup:43:300,300:mousedown:40:80,305:mouseup:40:80,' +
    `360:png:${moved},380:stop`, 400);
  assertHealthy(output, 'FreeCell');
  assert.match(output, /SetWindowText\] "FreeCell Game #\d+"/,
    'FreeCell should enter a numbered game');
  assert(changedPixels(before, after, { x: 22, y: 60, w: 616, h: 330 }) > 50000,
    'FreeCell should deal all eight cascades after New Game');
  assert(changedPixels(after, moved, { x: 372, y: 62, w: 142, h: 96 }) > 8000,
    'FreeCell should move a card and play the black aces home');
  // The second foundation shows the 2 of clubs; its index corner is white card
  // with a black "2", never the solid black block a broken bitmap leaves.
  const image = PNG.sync.read(fs.readFileSync(moved));
  let black = 0;
  for (let y = 66; y < 80; y++) for (let x = 446; x < 460; x++) {
    const i = (y * image.width + x) * 4;
    if (!image.data[i] && !image.data[i + 1] && !image.data[i + 2]) black++;
  }
  assert(black < 98, `the foundation card's index corner is ${black}/196 black`);
  console.log('PASS  Win16 FreeCell deals a playable game and moves cards home');
}

function testStones(outDir) {
  const before = path.join(outDir, 'stones-before.png');
  const after = path.join(outDir, 'stones-after.png');
  const output = runGame('wep16_stones',
    `50:png:${before},70:keydown:113,71:keyup:113,` +
    `160:png:${after},180:stop`, 200);
  assertHealthy(output, 'Stones');
  assert(changedPixels(before, after, { x: 155, y: 60, w: 370, h: 330 }) > 5000,
    'Stones should generate a visibly different playing field on New Game');
  console.log('PASS  Win16 Stones generates a playable new field');
}

function testTutsTomb(outDir) {
  const before = path.join(outDir, 'tut-before.png');
  const after = path.join(outDir, 'tut-after.png');
  // The opening pyramid is deterministic and exposes a king at bottom-right.
  const output = runGame('wep16_tutstomb',
    `50:png:${before},70:mousedown:534:360,71:mouseup:534:360,` +
    `160:png:${after},180:stop`, 200);
  assertHealthy(output, "Tut's Tomb");
  assert(changedPixels(before, after, { x: 560, y: 435, w: 65, h: 30 }) > 5,
    "Tut's Tomb should score the exposed-king action");
  console.log("PASS  Win16 Tut's Tomb accepts and scores an exposed-king move");
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'win16-wep2-gameplay-'));
try {
  testFreeCell(outDir);
  testStones(outDir);
  testTutsTomb(outDir);
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
