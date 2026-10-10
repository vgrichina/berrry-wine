#!/usr/bin/env node
'use strict';

// A Win16 game step named as { seg, off } (lib/apps.js perf.logicalFrame).
//
// NE code runs at a linear address that is wherever our loader put the
// segment, so lib/apps.js cannot name a Win16 step by linear address without
// pinning the arena layout. It names an NE segment of the task and an offset
// instead, and run.js / host.js resolve it through win16_seg_base once the
// task is loaded. The decoder plants the step marker in 16-bit code as in
// 32-bit code. JezzBall's step is its timer frame function, 1:0x3046.
//
// Checks: the marked address is segment 1's base + 0x3046 (from the
// --trace-win16 segment map), the GAME counter counts, and it equals the
// independent --count hit counter at the same address.

const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const { APPS } = require(path.join(ROOT, 'lib', 'apps.js'));

const metric = APPS.wep16_jezzball.perf.logicalFrame;
assert.deepStrictEqual(metric.address, { seg: 1, off: 0x3046 },
  'JezzBall names its step as an NE segment and offset');

const args = [path.join(ROOT, 'test', 'run.js'), '--app=wep16_jezzball',
  '--no-close', '--max-batches=500', '--quiet-api', '--quiet-blocks',
  '--trace-win16', '--trace-from=100000', '--present-frames=100'];
if (process.argv.includes('--no-build')) args.push('--no-build');
// The --count address is only known after the first run's segment map, and
// the arena is deterministic, so read the map from a short run first.
const map = execFileSync(process.execPath, [...args.slice(0, 2), '--no-close',
  '--max-batches=5', '--quiet-api', '--quiet-blocks', '--trace-win16', '--trace-from=100000', '--no-build'],
  { cwd: ROOT, encoding: 'utf8', timeout: 60000, maxBuffer: 16 << 20 });
const seg1 = /\[win16\] task seg 1 base=0x([0-9a-f]+)/.exec(map);
assert(seg1, 'run.js --trace-win16 prints the task segment map');
const step = (parseInt(seg1[1], 16) + 0x3046) >>> 0;

const out = execFileSync(process.execPath, [...args, `--count=0x${step.toString(16)}`],
  { cwd: ROOT, encoding: 'utf8', timeout: 90000, maxBuffer: 16 << 20 });
assert.doesNotMatch(out, /\*\*\* CRASH|UNIMPLEMENTED API|RuntimeError/);
const marked = /\[present\] GAME step 0x([0-9a-f]+) marked/.exec(out);
assert(marked, 'the { seg, off } step was resolved and marked');
assert.strictEqual(parseInt(marked[1], 16), step, 'marked at seg 1 base + 0x3046');

const counted = /\[present-frames\] GAME counter: (\d+) frames/.exec(out);
assert(counted && Number(counted[1]) > 50, `the marker counts 16-bit steps (${counted && counted[1]})`);
const hits = new RegExp(`0x0*${step.toString(16)} = (\\d+)`).exec(out);
assert(hits, 'the --count hit counter reports the step address');
// --present-frames counts from batch 100; the hit counter from batch 0.
assert(Number(counted[1]) <= Number(hits[1]) && Number(hits[1]) - Number(counted[1]) < 150,
  `GAME steps (${counted[1]}) track the hit counter (${hits[1]})`);

console.log(`PASS  Win16 JezzBall step { seg: 1, off: 0x3046 } -> 0x${step.toString(16)}, `
  + `${counted[1]} GAME steps, ${hits[1]} hits`);
