#!/usr/bin/env node
'use strict';

// Gameplay coverage for the two VB1 Entertainment Pack games. Both cases use
// real menu and renderer input paths and require a visible board transition;
// a launch-only window check would miss the IsChild trap and Rodent overflow.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { PNG } = require('pngjs');
const { diffPng } = require('../tools/png-diff');

const ROOT = path.join(__dirname, '..');
const RUN = path.join(ROOT, 'test', 'run.js');
const OPTIONAL_WASM = process.env.WINE_ASSEMBLY_WASM || '';

function changedPixels(beforePath, afterPath, rect) {
  const diff = diffPng(beforePath, afterPath, { includeAlpha: true, region: rect });
  assert.strictEqual(diff.sizeMismatch, false, 'gameplay capture dimensions must match');
  return diff.changed;
}

function colorBounds(file, rect, predicate) {
  const png = PNG.sync.read(fs.readFileSync(file));
  let count = 0;
  let minX = png.width;
  let maxX = -1;
  let minY = png.height;
  let maxY = -1;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const i = (y * png.width + x) * 4;
      if (!predicate(png.data[i], png.data[i + 1], png.data[i + 2])) continue;
      count++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return {
    count,
    width: maxX >= minX ? maxX - minX + 1 : 0,
    height: maxY >= minY ? maxY - minY + 1 : 0,
  };
}

function runGame(args) {
  if (OPTIONAL_WASM) args.splice(1, 0, '--no-build', `--wasm=${OPTIONAL_WASM}`);
  return execFileSync(process.execPath, [RUN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60000,   // measures 5s
    maxBuffer: 16 * 1024 * 1024,
  });
}

function assertHealthy(output, game) {
  assert.doesNotMatch(output, /\*\*\* CRASH|UNIMPLEMENTED API|RuntimeError|Overflow/,
    `${game} must not crash, trap, or show VB Overflow`);
}

function testRodent(outDir) {
  const before = path.join(outDir, 'rodent-before.png');
  const after = path.join(outDir, 'rodent-after.png');
  // Wall-clock ticks keep the score at its real-play pace. Holding Right over
  // a timer tick moves the mouse instead of merely delivering a key message.
  const output = runGame([
    '--app=wep16_rodent', '--no-close', '--real-ticks', '--batch-size=2000',
    '--max-batches=1400', '--quiet-api', '--quiet-blocks', '--repaint-every=20',
    `--input=200:mousedown:300:55,201:mouseup:300:55,` +
      `500:mousedown:202:72,501:mouseup:202:72,` +
      `520:mousedown:240:93,521:mouseup:240:93,` +
      `1050:png:${before},1100:keydown:39,1101:sleep-ms:1200,` +
      `1200:keyup:39,1250:png:${after},1270:mousedown:447:52,` +
      `1271:mouseup:447:52,1390:stop`,
  ]);
  assertHealthy(output, 'Rodent');
  const titleWrites = [...output.matchAll(/\[SetWindowText\] "([^"]*)"/g)]
    .map(match => match[1]);
  assert.match(titleWrites.at(-1) || '', /^Rodent's Revenge \[\d+\]$/,
    'Rodent DefWindowProc must retain the caption written by SetWindowText');
  assert.match(output, /keydown vk=39/, 'Rodent Right key must reach the renderer');
  assert.doesNotMatch(output, /Sub or Function not defined/,
    'Rodent close must resolve KERNEL.WritePrivateProfileString instead of VB error 35');
  assert(changedPixels(before, after, { x: 180, y: 116, w: 276, h: 276 }) > 40,
    'Rodent board should visibly advance after holding Right');
  const clock = colorBounds(after, { x: 302, y: 84, w: 34, h: 34 },
    (r, g, b) => r < 80 && g < 80 && b < 80);
  assert(clock.count > 60 && clock.width > 16 && clock.height > 16,
    `Rodent stopwatch must remain visible after gameplay starts ` +
    `(dark bounds=${clock.width}x${clock.height}, pixels=${clock.count})`);
  console.log('PASS  Win16 Rodent starts a new game and responds to Right');
}

function testRattler(outDir) {
  const initial = path.join(outDir, 'rattler-initial.png');
  const before = path.join(outDir, 'rattler-before.png');
  const after = path.join(outDir, 'rattler-after.png');
  const controlBefore = path.join(outDir, 'rattler-control-before.png');
  const controlAfter = path.join(outDir, 'rattler-control-after.png');
  // The snakes move on their own timer, so "the board changed" proves nothing
  // about input. Run the same route twice, steering only once, and require the
  // two runs to agree before the key and disagree after it. The player is the
  // yellow snake (heading up at batch 800); it steers on WM_KEYDOWN arrows --
  // an ASCII keypad WM_CHAR reaches the field control but does not turn it.
  const route = (shotBefore, shotAfter, steer) => runGame([
    '--app=wep16_rattler', '--no-close', '--batch-size=2000', '--max-batches=1100',
    '--quiet-api', '--quiet-blocks', '--repaint-every=20',
    `--input=150:png:${initial},200:mousedown:300:55,201:mouseup:300:55,` +
      `500:mousedown:210:72,501:mouseup:210:72,` +
      `520:mousedown:230:94,521:mouseup:230:94,` +
      `750:png:${shotBefore},${steer ? '800:keydown:37,802:keyup:37,' : ''}` +
      `850:png:${shotAfter},1050:stop`,
  ]);
  const output = route(before, after, true);
  assertHealthy(output, 'Rattler');
  assertHealthy(route(controlBefore, controlAfter, false), 'Rattler control');
  const initialScore = colorBounds(initial, { x: 378, y: 88, w: 68, h: 28 },
    (r, g, b) => r < 48 && g < 48 && b < 48);
  assert(initialScore.width >= 50 && initialScore.height >= 12 && initialScore.count > 100,
    `Rattler should use its large six-digit score font ` +
    `(dark=${initialScore.width}x${initialScore.height}, pixels=${initialScore.count})`);
  assert.match(output, /keydown vk=37/, 'Rattler LEFT must be delivered');
  const score = colorBounds(before, { x: 360, y: 84, w: 90, h: 38 },
    (r, g, b) => r > 235 && g > 235 && b > 235);
  assert(score.width > 45 && score.count > 50,
    `Rattler score field must fit all six digits (white bounds=${score.width}, pixels=${score.count})`);
  const board = { x: 188, y: 129, w: 256, h: 260 };
  assert.strictEqual(changedPixels(before, controlBefore, board), 0,
    'Rattler steered and control runs must be identical before the key');
  assert(changedPixels(after, controlAfter, board) > 100,
    'Rattler LEFT must change the board relative to the no-input run');
  console.log('PASS  Win16 Rattler starts a new game and steers on LEFT (A/B vs no input)');
}

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert.match(index, /<option value="wep16_rodent">Rodent's Revenge<\/option>/,
  'Rodent must be selectable beside the other original WEP2 games');

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'win16-vb-gameplay-'));
try {
  const only = process.argv[2] || '';
  if (!only || only === 'rodent') testRodent(outDir);
  if (!only || only === 'rattler') testRattler(outDir);
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
