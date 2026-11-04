'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
const {EvidenceBoundary, verify, sha256} = require('./stronghold-stable-recovery-combat-20261104.cjs');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stronghold-boundary-'));
  try {
    const source = path.join(root, 'active'); fs.mkdirSync(source);
    const q = new EvidenceBoundary(source, path.join(root, 'sealed'));
    const expected = [];
    // Reproduce the old manifest/download race without weakening verification.
    await q.append('commands.jsonl', 'first\n');
    const oldHash = sha256(fs.readFileSync(path.join(source, 'commands.jsonl')));
    await q.append('commands.jsonl', 'later\n');
    assert.notEqual(sha256(fs.readFileSync(path.join(source, 'commands.jsonl'))), oldHash);
    let release, entered;
    const draining = new Promise(r => {entered = r;});
    const wait = new Promise(r => {release = r;});
    const snapshot = q.snapshot('live', async () => {entered(); await wait;});
    await draining;
    const appended = q.append('commands.jsonl', 'concurrent-after-boundary\n');
    let closed = false;
    const close = q.close(async () => {closed = true; fs.appendFileSync(path.join(source, 'commands.jsonl'), 'close\n');});
    assert.equal(closed, false);
    assert.equal(fs.readFileSync(path.join(source, 'commands.jsonl'), 'utf8'), 'first\nlater\n');
    release();
    const live = await snapshot;
    await Promise.all([appended, close]);
    assert.equal(closed, true);
    assert.equal(fs.readFileSync(path.join(live.directory, 'commands.jsonl'), 'utf8'), 'first\nlater\n');
    assert(verify(live.directory, live.manifest));
    await assert.rejects(q.append('commands.jsonl', 'forbidden'), /closed/);
    const final = await q.snapshot('final');
    assert.equal(final.manifest.closed, true);
    assert(verify(final.directory, final.manifest));
    assert.equal(fs.readFileSync(path.join(final.directory, 'commands.jsonl'), 'utf8'), 'first\nlater\nconcurrent-after-boundary\nclose\n');
    await assert.rejects(q.snapshot('live'), /reused/);
    // Many queued appends/snapshots: reconstruct each exact full stream prefix.
    const other = path.join(root, 'stress'); fs.mkdirSync(other);
    const stress = new EvidenceBoundary(other, path.join(root, 'stress-sealed'));
    const jobs = [];
    for (let i = 0; i < 100; i++) {
      expected.push(JSON.stringify({i, payload: 'x'.repeat(i)}) + '\n');
      jobs.push(stress.append('commands.jsonl', expected.at(-1)));
      if (i % 10 === 0) {
        const prefix = expected.join('');
        jobs.push(stress.snapshot('chunk-' + i).then(s => {
          assert(verify(s.directory, s.manifest));
          assert.equal(sha256(fs.readFileSync(path.join(s.directory, 'commands.jsonl'))), sha256(prefix));
        }));
      }
    }
    await Promise.all(jobs); await stress.close();
    const end = await stress.snapshot('closed');
    assert(verify(end.directory, end.manifest));
    assert.equal(sha256(fs.readFileSync(path.join(end.directory, 'commands.jsonl'))), sha256(expected.join('')));
    fs.chmodSync(path.join(end.directory, 'commands.jsonl'), 0o644);
    fs.appendFileSync(path.join(end.directory, 'commands.jsonl'), 'corrupt');
    assert.throws(() => verify(end.directory, end.manifest), /mismatch/);
    console.log(JSON.stringify({pass: true, oldRaceReproduced: true, queuedAppendDuringDrain: true, concurrentClose: true, immutableLiveDownloadAfterAppend: true, fullSHAReconstruction: 11, corruptionRejected: true}));
  } finally {fs.rmSync(root, {recursive: true, force: true});}
})().catch(e => {console.error(e); process.exitCode = 1;});
