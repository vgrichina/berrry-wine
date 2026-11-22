#!/usr/bin/env node
'use strict';

// The CLI shared-heap authority names a process by "pid:birth" and rejects
// anything else (EINVAL). The birth token used to come only from
// /proc/self/stat, so on macOS the first Win98 shared-heap call -- reached from
// a DLL thread detach in Crimsonland -- threw ENOENT and killed the run.
// Check the key on whatever host runs this: authority-valid, stable, the same
// from a Worker thread of this process, and different in a child process.

const assert = require('assert');
const { Worker } = require('worker_threads');
const { execFileSync } = require('child_process');
const path = require('path');
const MODULE = path.join(__dirname, '..', 'lib', 'thread-manager.js');

if (process.argv[2] === '--print') {
  process.stdout.write(require(MODULE).cliProcessBirthKey());
  process.exit(0);
}

(async () => {
  const { cliProcessBirthKey } = require(MODULE);
  const key = cliProcessBirthKey();
  assert.match(key, /^[0-9]+:[0-9]+$/, `authority-valid process key (${key})`);
  assert.strictEqual(key.split(':')[0], String(process.pid), 'key starts with this pid');
  assert.strictEqual(cliProcessBirthKey(), key, 'stable across calls');
  const fromWorker = await new Promise((resolve, reject) => {
    const w = new Worker(`const { parentPort } = require('worker_threads');
      parentPort.postMessage(require(${JSON.stringify(MODULE)}).cliProcessBirthKey());`, { eval: true });
    w.once('message', resolve); w.once('error', reject);
  });
  assert.strictEqual(fromWorker, key, 'a Worker thread of this process gets the same key');
  const child = execFileSync(process.execPath, [__filename, '--print'], { encoding: 'utf8' });
  assert.match(child, /^[0-9]+:[0-9]+$/);
  assert.notStrictEqual(child, key, 'a child process gets its own key');
  console.log(`PASS cli process birth key (${process.platform}): valid, stable, Worker-shared, child-distinct`);
})().catch(err => { console.error(err); process.exit(1); });
