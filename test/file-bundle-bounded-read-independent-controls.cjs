'use strict';

// Deliberately damaged ephemeral source copies validate the independent oracle.
// Production source remains read only. Each child runs only its targeted group.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const sourcePath = process.env.FILE_BUNDLE_INDEPENDENT_SOURCE || path.join(__dirname, '../lib/file-bundle.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const suite = path.join(__dirname, 'file-bundle-bounded-read-independent.test.cjs');
const mutations = [
  ['metadata-guard-removed', 'if (stat.size > budget) return null;', '', 'huge metadata'],
  ['cumulative-budget-ignored', 'readBounded(file, MAX_BYTES - bytes)', 'readBounded(file, MAX_BYTES)', 'remaining budget'],
  ['fixed-chunk-ceiling-removed', 'Math.min(64 * 1024, budget - length)', 'budget - length', 'one-byte short reads'],
  ['short-read-fill-loop-removed', 'while (filled < chunk.length)', 'if (filled < chunk.length)', 'one-byte short reads'],
  ['overflow-result-ignored', 'return bytesRead ? null : Buffer.concat(chunks, length);', 'return Buffer.concat(chunks, length);', 'remaining budget'],
];

for (const [name, before, after, pattern] of mutations) {
  test(`oracle rejects ${name}`, () => {
    assert.equal(source.split(before).length, 2, 'mutation anchor must be unique');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-control-'));
    try {
      const file = path.join(dir, 'mutant.js');
      fs.writeFileSync(file, source.replace(before, after));
      // A nested --test process must start as its own runner, not inherit
      // Node's internal child test-runner context (which suppresses discovery).
      const env = { ...process.env, FILE_BUNDLE_INDEPENDENT_SOURCE: file };
      delete env.NODE_TEST_CONTEXT;
      const run = spawnSync(process.execPath, ['--max-old-space-size=192', '--test',
        `--test-name-pattern=${pattern}`, suite], {
        env,
        timeout: 15000, maxBuffer: 128 * 1024, encoding: 'utf8',
      });
      assert.ifError(run.error);
      assert.equal(run.signal, null);
      assert.equal(run.status, 1, 'deliberate resource-bound regression must fail assertions');
      assert.match(run.stdout + run.stderr, /AssertionError|ERR_ASSERTION/, 'failure must be behavioral');
      assert.match(run.stdout + run.stderr, /fail 1/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}
