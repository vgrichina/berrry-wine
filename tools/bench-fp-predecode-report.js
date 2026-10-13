#!/usr/bin/env node
'use strict';
// Validate the fixed-work factorial before reporting CPU deltas.
const fs = require('fs'), path = require('path'), assert = require('assert');
const { diffPng } = require('./png-diff');
const root = path.resolve(process.argv[2]);
const games = { mh3: 2270, q2: 1400, h3: 5101, h2: 2400 };
const variants = process.argv.includes('--combos') ? ['control', 'p', 'c', 'pc', 'd', 'pd', 'cd', 'pcd'] : ['control', 'p', 'a', 'pa'];
const arms = [...variants, ...variants.slice().reverse().map(v => v + '2')];
const result = {};
for (const [game, batches] of Object.entries(games)) {
  const rows = arms.map(arm => {
    const file = path.join(root, `${game}-${arm}`);
    const log = fs.readFileSync(file + '.log', 'utf8');
    assert(!/RuntimeError|ENOENT|WASM CRASH|FPU_UNIMPL/.test(log), file);
    const stats = log.match(/Stats: (\d+) API calls, (\d+) batches/);
    assert(stats, `missing execution stats: ${file}`);
    assert.equal(Number(stats[2]), batches, `incomplete route: ${file}`);
    const cpu = log.match(/^user\s+([\d.]+)$/m);
    assert(cpu, `missing process user CPU: ${file}`);
    const uop = log.match(/^uop: .+$/m);
    assert(uop, `missing workload counters: ${file}`);
    const pixels = diffPng(path.join(root, `${game}-control.png`), file + '.png');
    assert(!pixels.sizeMismatch && pixels.changed === 0, `frame mismatch: ${file}`);
    return { arm, userSeconds: Number(cpu[1]), apiCalls: Number(stats[1]),
      batches: Number(stats[2]), uop: uop[0], changedPixels: pixels.changed };
  });
  for (const row of rows) {
    assert.equal(row.apiCalls, rows[0].apiCalls, `${game}/${row.arm}: API totals`);
    assert.equal(row.uop, rows[0].uop, `${game}/${row.arm}: workload counters`);
  }
  const summary = {};
  for (const arm of variants) {
    const samples = rows.filter(r => r.arm.replace(/2$/, '') === arm).map(r => r.userSeconds);
    const mean = (samples[0] + samples[1]) / 2;
    summary[arm] = { samples, mean, repeatSpreadPercent: 100 * Math.abs(samples[1] - samples[0]) / mean };
    summary[arm].changePercent = 100 * (mean / summary.control.mean - 1);
  }
  result[game] = { rows, summary };
}
console.log(JSON.stringify(result, null, 2));
