#!/usr/bin/env node
'use strict';
// Build gate: tracked tests must not read scratch/ evidence.
//
//   tracked test file (test/**, tools/**.test.*, tools/test-*, *_test.py)
//        |
//        +-- names scratch/runs/<YYYYMMDD>-... outside a comment?  -> FAIL
//
// scratch/ is per-machine and gets pruned (the boat's 2026-11-14 disk cleanup
// deleted evidence 37 tests depended on). A test that needs a retained run
// belongs in that run's scratch folder, not in Git. Tools that WRITE runs are
// fine; this only looks at tests. ALLOW is for a test whose scratch read is an
// optional local baseline it passes without.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const ALLOW = new Set([
  'test/test-opengl-accumulation.js',          // optional --baseline A/B source
  'test/test-opengl-double-matrix-transforms.js', // optional --baseline A/B source
]);
const isTest = f => /^test\//.test(f) || /^tools\/(.*\/)?(test-[^/]+|[^/]+[._-]test\.[a-z]+|[^/]+_test\.py)$/.test(f);
const RUN = /scratch\/runs\/20\d{6}-/;
const COMMENT = /^\s*(\/\/|#|\*|\/\*)/;

const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  { cwd: root, maxBuffer: 256 << 20 }).toString('utf8').split('\0').filter(Boolean);
const bad = [];
for (const f of files) {
  if (!isTest(f) || ALLOW.has(f) || !/\.(js|cjs|mjs|py|sh)$/.test(f)) continue;
  let text;
  try { text = fs.readFileSync(path.join(root, f), 'utf8'); } catch { continue; }
  if (!RUN.test(text)) continue;
  const line = text.split('\n').findIndex(l => RUN.test(l) && !COMMENT.test(l));
  if (line >= 0) bad.push(`${f}:${line + 1}`);
}
if (bad.length) {
  console.error('test-scratch-deps: tracked tests read scratch/runs evidence (per-machine, pruned).');
  console.error('Keep such a test in its run folder under scratch/, or make it self-contained:');
  for (const b of bad) console.error('  ' + b);
  process.exit(1);
}
console.log('test-scratch-deps: ok (no tracked test reads scratch/runs)');
