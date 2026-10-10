#!/usr/bin/env node
// SimCity 2000 Win95 Demo: load the demo city, prove an ordinary control
// changes the live map, and count the game's animation ticks.
//
// Settings: 20000-block batches at 16 ms of guest time each. At run.js's
// default 200 ms per batch the game is starved (about 0.1 palette ticks per
// guest-second) and its demo notices interrupt before anything can be done.
//
// Control response: the toolbar's rotate-left button (110,262) turns the whole
// view. Two captures 90 batches apart with no input are the null band (the
// map is static between them); the rotate must change far more than that.
//
// Animation counter: SC2K has no frame loop. Its animation clock is palette
// cycling -- AnimatePalette from one site (return 0x4489ac), the 0xab range
// every tick and the 0xe0 range on a slower cadence. Counted over a fixed
// window it is deterministic, and it is reported per guest-second.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { diffPng } = require('../tools/png-diff');

const ROOT = path.resolve(__dirname, '..');
const EXE_DIR = path.join(ROOT, 'test/binaries/candidates/simcity-2000-demo/installed');
if (!fs.existsSync(EXE_DIR)) {
  console.log('SKIP  SimCity 2000 demo install is not present');
  process.exit(0);
}

const OUT = process.env.SIMCITY2000_CAPTURE_DIR || path.join(ROOT, 'build', 'simcity2000-gameplay');
fs.mkdirSync(OUT, { recursive: true });
const shot = name => path.join(OUT, `${name}.png`);
const MS_PER_BATCH = 16;
const TICK_FROM = 2100, TICK_TO = 3100;   // 1000 batches = 16 guest-seconds
const MAP = { x: 180, y: 70, w: 440, h: 360 };   // right of the floating toolbar

const input = [
  '25:dlg-cmd:1',                                   // "Video Warning" / first-run box
  '700:mousedown:315:148', '720:mouseup:315:148',   // launcher: Load Demo City
  `1900:png:${shot('city-a')}`, `1990:png:${shot('city-b')}`,
  '2000:mousedown:110:262', '2003:mouseup:110:262', // toolbar: rotate left
  `2100:png:${shot('rotated')}`,
].join(',');

// run.js ends with process.exit, which drops whatever is still queued on a
// PIPE -- the DEMOCITY title and most of the trace were lost that way and the
// result looked like a nondeterministic route. A file descriptor is written
// synchronously, so the log is complete.
const logPath = path.join(OUT, 'run.log');
const logFd = fs.openSync(logPath, 'w');
const run = spawnSync(process.execPath, [
  path.join(ROOT, 'test/run.js'), '--no-build', '--app=simcity2000_demo',
  '--batch-size=20000', `--tick-ms-per-batch=${MS_PER_BATCH}`,
  `--max-batches=${TICK_TO + 10}`, '--max-seconds=240', '--stuck-after=0',
  '--no-close', '--quiet-blocks',
  `--trace-from=${TICK_FROM}`, `--trace-to=${TICK_TO}`, '--trace-api=AnimatePalette',
  `--input=${input}`,
], { cwd: ROOT, stdio: ['ignore', logFd, logFd], timeout: 300000 });
fs.closeSync(logFd);
assert.strictEqual(run.status, 0, `run.js failed (status ${run.status}); see ${logPath}`);
const log = fs.readFileSync(logPath, 'utf8');

assert(/\[SetWindowText\] "[^"]*<DEMOCITY>/.test(log), 'the demo city never loaded (no DEMOCITY title)');
console.log('PASS  Load Demo City reaches the live city');

const region = { region: MAP };
const nullBand = diffPng(shot('city-a'), shot('city-b'), region);
const rotated = diffPng(shot('city-b'), shot('rotated'), region);
const share = d => d.share;
assert(share(nullBand) < 0.01, `the map changed with no input: ${(share(nullBand) * 100).toFixed(2)}%`);
assert(share(rotated) > 0.2, `rotate-left barely changed the map: ${(share(rotated) * 100).toFixed(2)}%`);
console.log(`PASS  rotate-left turns the view: ${(share(rotated) * 100).toFixed(1)}% of the map changed ` +
  `(null band ${(share(nullBand) * 100).toFixed(2)}%)`);

const calls = [...log.matchAll(/AnimatePalette\((0x[0-9a-f]+), (0x[0-9a-f]+), (0x[0-9a-f]+)[^\n]*ret=(0x[0-9a-f]+)/g)];
const sites = new Set(calls.map(m => m[4]));
const ticks = calls.filter(m => parseInt(m[2], 16) === 0xab).length;
const slow = calls.filter(m => parseInt(m[2], 16) === 0xe0).length;
const guestSeconds = (TICK_TO - TICK_FROM) * MS_PER_BATCH / 1000;
assert(ticks > 0, 'no palette animation ticks in the window');
assert.deepStrictEqual([...sites], ['0x004489ac'], `palette animation from unexpected sites: ${[...sites]}`);
console.log(`PASS  animation clock: ${ticks} palette ticks in ${guestSeconds} guest-s ` +
  `(${(ticks / guestSeconds).toFixed(2)}/guest-s; slow range ${slow}), one call site`);
console.log(`PASS  SimCity 2000 screenshots: ${OUT}`);
