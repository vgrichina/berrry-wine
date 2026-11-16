#!/usr/bin/env node
'use strict';
// --d3dim-gpu puts a real D3DIM app on GPU stream v2: Boids draws through
// Device2::DrawIndexedPrimitive, so a nonzero producer draw count with no
// fallback proves the WAT producer, not the WAT rasterizer, drew its frames.
// Without the flag nothing is lowered. Replaces test-d3dim-gpu-web.js, which
// checked the same thing for the deleted lib/d3dim-gpu.js executor in Chrome.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
if (!fs.existsSync(path.join(ROOT, 'test/binaries/dx-sdk/bin/boids.exe'))) {
  console.log('SKIP  boids.exe unavailable');
  process.exit(0);
}
const run = extra => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'test/run.js'), '--app=dx_boids', '--quiet-api',
    '--max-seconds=40', '--max-batches=400', ...extra], { cwd: ROOT, encoding: 'utf8', timeout: 90000 });
  const out = (r.stdout || '') + (r.stderr || '');
  assert.strictEqual(r.status, 0, `run.js ${extra.join(' ')} exited ${r.status}\n${out.slice(-2000)}`);
  assert(!/UNIMPLEMENTED API:|RuntimeError|FATAL:/.test(out), `guest failure\n${out.slice(-2000)}`);
  return out;
};
const on = run(['--headless-gl', '--d3dim-gpu']);
if (/--headless-gl requested but UNAVAILABLE/.test(on)) {
  console.log('SKIP  headless GL unavailable: ' + (on.match(/UNAVAILABLE: (.*)/) || [])[1]);
  process.exit(0);
}
const line = on.split('\n').find(l => l.startsWith('[d3dim-gps] draws='));
assert(line, 'producer stats line');
const stats = Object.fromEntries(line.slice(12).split(' ').map(kv => kv.split('=')).map(([k, v]) => [k, Number(v)]));
assert(stats.draws > 0, `no producer draws: ${line}`);
assert.strictEqual(stats.fallbacks, 0, `software fallbacks: ${line}`);
assert(stats.presents > 0, `no presents: ${line}`);
const off = run([]);
assert(!/\[d3dim-gps\]/.test(off), 'nothing is lowered without --d3dim-gpu');
console.log(`PASS  --d3dim-gpu draws Boids on the GPU stream producer (${stats.draws} draws, ` +
  `${stats.primitives} primitives, ${stats.presents} presents, ${stats.fences} fences); off by default`);
