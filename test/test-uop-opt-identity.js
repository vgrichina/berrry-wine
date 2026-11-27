#!/usr/bin/env node
'use strict';

// --uop-opt=0 is the tier as it was: the same programs, byte for byte.
//
// Runs test-uop-compiler.js's cases (both clocks) with UOP_DIGEST=1, which
// hashes the program arena's code area -- every program those cases
// compiled, in compile order -- and compares it, and every case's result
// line, between:
//   * this build with set_uop_opt never called, and with set_uop_opt(0);
//   * this build at mask 0 and a CONTROL build without the passes, when
//     UOP_OPT_CONTROL_WASM names one (a build of the commit uop-opt was cut
//     from). The ledger counters (opt*=N) exist only in this build and are
//     dropped from the result lines before comparing.
// Without UOP_OPT_CONTROL_WASM the control comparison is reported SKIP.

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function digestRun(env) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'test-uop-compiler.js')],
    { env: { ...process.env, UOP_DIGEST: '1', ...env }, encoding: 'utf8', timeout: 300000 });
  const lines = (r.stdout || '').split('\n');
  const dig = (lines.find((l) => l.startsWith('arena-digest ')) || '').slice(13);
  const cases = lines.filter((l) => / (hot|pre|fold vs unfolded): /.test(l) || l.startsWith('--'))
    .map((l) => l.replace(/ opt[A-Za-z]+=\d+/g, ''));
  return { ok: r.status === 0 && lines.includes('PASS'), dig, cases, err: r.stderr };
}

function compare(name, x, y) {
  const bad = [];
  if (!x.ok || !y.ok) bad.push(`suite failed (${x.ok}, ${y.ok})${(x.err || y.err || '').split('\n').slice(0, 3).join(' ')}`);
  if (!x.dig || x.dig !== y.dig) bad.push(`arena digest ${x.dig.slice(0, 16)} vs ${y.dig.slice(0, 16)}`);
  if (x.cases.length !== y.cases.length) bad.push(`${x.cases.length} vs ${y.cases.length} case lines`);
  const k = x.cases.findIndex((l, i) => l !== y.cases[i]);
  if (k >= 0) bad.push(`first differing case line:\n    ${x.cases[k]}\n    ${y.cases[k]}`);
  console.log(`${name}: ${bad.length ? 'FAIL ' + bad.join('; ') : `ok (arena ${x.dig.slice(0, 16)}, ${x.cases.length} lines)`}`);
  return bad.length;
}

function main() {
  require(path.join(ROOT, 'tools', 'bench-loops.js')).ensureBuilt();
  let fails = 0;
  const unset = digestRun({ UOP_OPT: '' });
  const zero = digestRun({ UOP_OPT: '0' });
  fails += compare('mask unset vs set_uop_opt(0)', unset, zero);
  const control = process.env.UOP_OPT_CONTROL_WASM;
  if (control && fs.existsSync(control)) {
    const ctl = digestRun({ UOP_OPT: '', STACK_BENCH_WASM: path.resolve(control) });
    fails += compare(`control ${path.basename(control)} vs mask 0`, ctl, zero);
  } else {
    console.log('control vs mask 0: SKIP (set UOP_OPT_CONTROL_WASM to a build without --uop-opt)');
  }
  if (fails) { console.log(`FAIL: ${fails}`); process.exit(1); }
  console.log('PASS');
}

main();
