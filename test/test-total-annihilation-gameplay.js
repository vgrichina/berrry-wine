#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PNG } = require('pngjs');
const { diffPng } = require('../tools/png-diff');
const { startControlSession } = require('./control-session');

const ROOT = path.join(__dirname, '..');
const INSTALLED = path.join(__dirname, 'binaries', 'candidates',
  'total-annihilation-demo', 'installed-fixed', 'cavedog', 'totala', 'demo');
const EXE = path.join(INSTALLED, 'tademo.exe');
const HPI = path.join(INSTALLED, 'tademo.hpi');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readPng(filename) {
  return PNG.sync.read(fs.readFileSync(filename));
}

function countPixels(png, x0, y0, x1, y1, predicate) {
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * png.width + x) * 4;
      if (predicate(png.data[i], png.data[i + 1], png.data[i + 2])) count++;
    }
  }
  return count;
}

function changedPixels(a, b, region) {
  const result = diffPng(a, b, { includeAlpha: false, region });
  assert(!result.sizeMismatch, 'Total Annihilation gameplay frames have different dimensions');
  return result.changed;
}

async function main() {
  if (!fs.existsSync(EXE) || !fs.existsSync(HPI)) {
    console.log('SKIP Total Annihilation installer-produced payload is not present');
    return;
  }

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-ta-gameplay-'));
  const battlePath = path.join(temp, 'battlefield.png');
  const selectedPath = path.join(temp, 'selected.png');
  const orderedPath = path.join(temp, 'ordered.png');
  const arrivedPath = process.env.TA_SCREENSHOT || path.join(temp, 'arrived.png');
  const session = startControlSession([
    'test/run.js', '--app=total_annihilation_demo', '--screen=640x480',
    // TA paces its simulation off the guest clock and a frame costs more than
    // a 1000-block batch: at 1000 blocks / 200 ms the battlefield renders but
    // nothing moves and the economy never ticks. These are the candidate
    // route's settings (docs/re-notes/total-annihilation.md).
    '--batch-size=20000', '--tick-ms-per-batch=16', '--control-stdin', '--frozen',
    '--max-seconds=120', '--quiet-api', '--quiet-blocks', '--no-close', '--no-build',
    '--repaint-every=20',
  ], { cwd: ROOT, idPrefix: 'ta' });
  const { send } = session;

  try {
    await send({ action: 'ping' });
    await send({ action: 'step', n: 1600 });
    await send('click:184:402'); // Single
    await send({ action: 'step', n: 300 });
    await send('click:500:145'); // New Campaign
    await send({ action: 'step', n: 500 });
    await send('click:532:430'); // Arm, Medium, Start
    await send({ action: 'step', n: 1000 });
    await send('click:545:448'); // Mission briefing Start
    await send({ action: 'step', n: 1200 });
    await send(`png:${battlePath}`);
    // Ordinary control: left-click the Stumpy tank to select it, then
    // left-click open ground to order a move there (TA's default interface).
    const press = async (x, y) => {
      await send(`mousemove:${x}:${y}`);
      await send({ action: 'step', n: 5 });
      await send(`mousedown:${x}:${y}`);
      await send({ action: 'step', n: 3 });
      await send(`mouseup:${x}:${y}`);
    };
    await press(212, 228);
    await send({ action: 'step', n: 20 });
    await send(`png:${selectedPath}`);
    await press(430, 390);
    await send({ action: 'step', n: 40 });
    await send(`png:${orderedPath}`);
    await send({ action: 'step', n: 750 });
    await send(`png:${arrivedPath}`);

    const a = readPng(battlePath);
    const b = readPng(arrivedPath);
    assert(a.width === 640 && a.height === 480 && b.width === 640 && b.height === 480,
      'Total Annihilation battlefield frames must be 640x480');
    const terrain = countPixels(b, 112, 28, 640, 450,
      (r, g, blue) => g > 28 && g > r * 1.15 && g > blue * 1.2);
    const minimap = countPixels(b, 0, 0, 112, 128,
      (r, g, blue) => g > 35 && g > r * 1.1 && g > blue * 1.1);
    const resourceText = countPixels(b, 112, 0, 640, 28,
      (r, g, blue) => r > 120 && g > 90 && blue < 80);
    // Selecting opens the orders panel down the left side.
    const panel = changedPixels(battlePath, selectedPath, { x: 0, y: 128, w: 128, h: 352 });
    // The tank leaves its start and ends up at the ordered point.
    const left = changedPixels(battlePath, arrivedPath, { x: 190, y: 205, w: 50, h: 45 });
    const reached = changedPixels(orderedPath, arrivedPath, { x: 405, y: 365, w: 50, h: 50 });
    assert(terrain > 90000, `battlefield terrain is missing (${terrain} green pixels)`);
    assert(minimap > 100, `battlefield minimap is missing (${minimap} green pixels)`);
    assert(resourceText > 100, `resource HUD is missing (${resourceText} yellow pixels)`);
    assert(panel > 2000, `selecting a unit did not open the orders panel (${panel} changed pixels)`);
    assert(left > 300, `ordered tank did not leave its start (${left} changed pixels)`);
    assert(reached > 300, `ordered tank did not reach the target (${reached} changed pixels)`);
    assert(!/UNIMPLEMENTED API:|\*\*\* CRASH|RuntimeError|LinkError/i.test(session.output()),
      `Total Annihilation hit a compatibility failure\n${session.output().slice(-6000)}`);

    const code = await session.quit();
    assert(code === 0,
      `Total Annihilation CLI exited ${code}\n${session.output().slice(-6000)}`);
    console.log(`PASS Total Annihilation gameplay: terrain=${terrain}, minimap=${minimap}, panel=${panel}, left=${left}, reached=${reached}`);
    console.log(`PASS Total Annihilation screenshot: ${arrivedPath}`);
  } catch (error) {
    await session.quit({ ignoreReplyError: true });
    throw error;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(`FAIL Total Annihilation gameplay: ${error.stack || error.message}`);
  process.exit(1);
});
