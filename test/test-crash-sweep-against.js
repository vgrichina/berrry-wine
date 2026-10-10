#!/usr/bin/env node
'use strict';

// crash-sweep.js --compare --against=CONTROL.jsonl compares two BUILDS (same
// app, same mode) instead of coop vs threads. Fed two hand-written result
// files, it must report a candidate crash, a lost picture and lost sound, stay
// quiet about an app that matches, skip runs the control does not have, and
// exit 1 under --gate only when something differs. The plain mode compare keeps
// working on the same file.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SWEEP = path.join(__dirname, '..', 'tools', 'crash-sweep.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crash-sweep-against-'));
const write = (name, rows) => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  return file;
};
const run = r => ({ secs: 15, frame: 'content', audio: 'sound', batches: 1000, ...r });

const control = write('control.jsonl', [
  run({ id: 'same', mode: 'coop', sig: 'ok' }),
  run({ id: 'crashes', mode: 'coop', sig: 'ok' }),
  run({ id: 'blanks', mode: 'threads', sig: 'ok' }),
  run({ id: 'mutes', mode: 'coop', sig: 'ok' }),
]);
const candidate = write('candidate.jsonl', [
  run({ id: 'same', mode: 'coop', sig: 'ok' }),
  run({ id: 'crashes', mode: 'coop', sig: 'trap: unreachable' }),
  run({ id: 'blanks', mode: 'threads', sig: 'ok', frame: 'blank' }),
  run({ id: 'mutes', mode: 'coop', sig: 'ok', audio: 'silent' }),
  run({ id: 'new_only', mode: 'coop', sig: 'trap: x' }),
]);

const sweep = (...args) => spawnSync(process.execPath, [SWEEP, ...args], { encoding: 'utf8' });

try {
  const out = sweep('--compare', `--jsonl=${candidate}`, `--against=${control}`);
  assert.strictEqual(out.status, 0, out.stderr);
  const text = out.stdout;
  assert.match(text, /crashes \[coop\]\n\s+crash: control ok \/ candidate trap: unreachable/);
  assert.match(text, /blanks \[threads\]\n\s+frame: control content b=1000 \/ candidate blank b=1000/);
  assert.match(text, /mutes \[coop\]\n\s+audio: control sound \/ candidate silent/);
  assert(!/\bsame\b/.test(text.split('\n\n')[0]), 'a matching app is not listed');
  assert(!/new_only/.test(text), 'a run the control lacks is not compared');
  assert.match(text, /3 of 4 app\/mode runs differ from the control/);
  // The crash ranks first.
  assert(text.indexOf('crashes [coop]') < text.indexOf('blanks [threads]'), 'crash before picture');

  const md = sweep('--compare', '--md', `--jsonl=${candidate}`, `--against=${control}`);
  assert.match(md.stdout, /\| app \| divergence \| control \| candidate \|/);

  assert.strictEqual(sweep('--compare', '--gate', `--jsonl=${candidate}`, `--against=${control}`).status, 1,
    '--gate fails when a build differs');
  assert.strictEqual(sweep('--compare', '--gate', `--jsonl=${control}`, `--against=${control}`).status, 0,
    '--gate passes for identical builds');

  // The coop-vs-threads compare is unchanged.
  const modes = write('modes.jsonl', [
    run({ id: 'a', mode: 'coop', sig: 'ok' }),
    run({ id: 'a', mode: 'threads', sig: 'trap: y' }),
  ]);
  const plain = sweep('--compare', `--jsonl=${modes}`);
  assert.match(plain.stdout, /crash: coop ok \/ threads trap: y/);
  assert.match(plain.stdout, /1 of 1 apps run in both modes disagree/);
  console.log('PASS  crash-sweep --compare --against: build-vs-build differences ranked, matches and unpaired runs skipped, --gate, mode compare intact');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
