'use strict';
// Host-only authority bootstrap. Run with the EXACT original recipe's two
// NODE_OPTIONS preloads, SIMS_SOURCE_HEAD and SIMS_PIN_NAME, under its watchdog.
// This does not load an original executable, wasm, media or input controller.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
  const out = path.resolve(process.argv[2]);
  assert(fs.statSync(out).isDirectory());
  const recipe = JSON.parse(fs.readFileSync(path.join(out, 'recipe.json')));
  for (const key of ['NODE_OPTIONS', 'SIMS_SOURCE_HEAD']) {
    assert.equal(process.env[key], recipe.env[key], `${key} differs from original recipe`);
  }
  assert(process.env.SIMS_PIN_NAME);
  const hooks = [...process.env.NODE_OPTIONS.matchAll(/--require=(\S+)/g)].map(m => m[1]);
  assert.equal(hooks.length, 2, 'both source and host mapping hooks required');
  for (const file of hooks) assert(require.cache[require.resolve(file)], `preload absent: ${file}`);
  assert(hooks.every(file => path.isAbsolute(file)), 'absolute preload paths required');
  const observations = path.join(out, 'authority-observations');
  fs.mkdirSync(observations);
  const { ProcessDesktop, readProcessDesktopObservations } = require('../lib/process-desktop');
  const desktop = new ProcessDesktop({ endpoint: null, observeDirectory: observations });
  let records;
  try {
    assert.deepEqual(desktop.snapshot().rows, []);
    records = readProcessDesktopObservations(observations);
    for (const role of ['desktop-authority', 'desktop-client']) {
      const identity = records.find(r => r.phase === 'identity' && r.role === role);
      assert(identity, `${role} never reached module initializer`);
      assert.equal(identity.pid, process.pid);
      assert(identity.threadId > 0);
      assert.equal(identity.nodeOptionsSha256, hash(process.env.NODE_OPTIONS));
      for (const file of hooks) {
        assert(identity.preloads.some(p => p.path === file && p.sha256 === hash(fs.readFileSync(file))),
          `${role} does not prove exact preload ${file}`);
      }
      const maps = path.join(process.env.SIMS_EVIDENCE_DIR || path.dirname(hooks[1]),
        `${process.env.SIMS_MAP_LABEL || 'original'}-host-startup-${process.pid}-thread${identity.threadId}.json`);
      const receipt = JSON.parse(fs.readFileSync(maps));
      assert.equal(receipt.pid, process.pid);
      assert.equal(receipt.threadId, identity.threadId);
      assert(receipt.rows.length > 0, 'empty host maps are not evidence');
      for (const row of receipt.rows) assert.equal(row.sha256, hash(fs.readFileSync(row.path)));
    }
  } finally {
    await desktop.close();
  }
  records = readProcessDesktopObservations(observations);
  const exits = records.filter(r => r.phase === 'worker-exit');
  assert.equal(exits.length, 2, 'both actual Worker exit events required');
  const result = { fixtureOnly: true, originalExecuted: false, pid: process.pid,
    head: process.env.SIMS_SOURCE_HEAD, preloads: hooks.map(file => ({ file, sha256: hash(fs.readFileSync(file)) })),
    identities: records.filter(r => r.phase === 'identity'), exits, authorityReady: true,
    actualSnapshotRoundTrip: true, bothWorkersJoined: true };
  fs.writeFileSync(path.join(out, 'authority-preload-result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ authorityReady: true, bothExactPreloads: true, bothWorkersJoined: true }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
