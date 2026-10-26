'use strict';
// Offline staging only. Never launches a runner or changes its immutable input.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const tool = path.resolve(__dirname, '../../../tools/thps2-exit-entry-observer.cjs');
const { transformRunner } = require(tool);
const [input, stage] = process.argv.slice(2);
if (!input || !stage || process.argv.length !== 4 || !path.isAbsolute(input) || !path.isAbsolute(stage))
  throw Error('usage: node wire-runner.cjs ABSOLUTE_IMMUTABLE_RUNNER ABSOLUTE_NEW_STAGE');
if (fs.statSync(input).size > 1048576) throw Error('runner-input-cap');
const result = transformRunner(fs.readFileSync(input, 'utf8'));
const observer = fs.readFileSync(tool);
if (observer.length > 65536) throw Error('observer-source-cap');
fs.mkdirSync(stage); // must be a new stage; never edit an existing runner tree
for (const sub of ['test', 'tools']) fs.mkdirSync(path.join(stage, sub));
fs.writeFileSync(path.join(stage, 'test/run.js'), result.source, { flag: 'wx' });
fs.writeFileSync(path.join(stage, 'tools/thps2-exit-entry-observer.cjs'), observer, { flag: 'wx' });
const receipt = { ...result.receipt,
  observerSHA256: crypto.createHash('sha256').update(observer).digest('hex'),
  stagedFiles: ['test/run.js', 'tools/thps2-exit-entry-observer.cjs'],
  guestExecution: false, completeRunnerClosure: false };
fs.writeFileSync(path.join(stage, 'exit-entry-wiring.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt));
