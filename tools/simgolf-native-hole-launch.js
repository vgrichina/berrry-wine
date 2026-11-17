#!/usr/bin/env node
'use strict';
// SimGolf's owning canceller; current kernel custody and lossless command EOF.
//
// RUN/lifecycle.json supplies the immutable browserDeadline. The external box
// delegate must already be armed. This launcher neither allocates nor stops boxes.
// Arguments after RUN are a literal executable vector, never shell source.
//
// Usage: node tools/simgolf-native-hole-launch.js RUN EXECUTABLE [ARGS...]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// SHA-256 of the pinned collector source. The pin moved with the collector's
// JS port (tools/native_kernel_custody.js); set it to that file's reviewed
// hash. An unset pin refuses, exactly like drift.
const COLLECTOR = 'native_kernel_custody.js';
const COLLECTOR_SHA = null;

async function launch(run, command) {
  run = path.resolve(run);
  assert(command.length, 'literal command required');
  const source = path.join(__dirname, COLLECTOR);
  const bytes = fs.readFileSync(source);
  assert(COLLECTOR_SHA && crypto.createHash('sha256').update(bytes).digest('hex') === COLLECTOR_SHA, 'collector drift');
  for (const name of ['kernel-armed.json', 'kernel-drain.json', 'custody.ndjson.gz', 'kernel-command.log.gz'])
    assert(!fs.existsSync(path.join(run, name)), 'custody evidence already exists');
  const life = JSON.parse(fs.readFileSync(path.join(run, 'lifecycle.json')));
  // Execute exactly the hashed bytes, never a second read of the path.
  const Module = require('node:module');
  const kernel = new Module(source, module);
  kernel.filename = source; kernel.paths = Module._nodeModulePaths(path.dirname(source));
  kernel._compile(bytes.toString('utf8'), source);
  await kernel.exports.supervise(run, command, {deadline: life.browserDeadline / 1000,
    cleanup_deadline: life.browserDeadline / 1000 + 30,
    journal_compression: 'gzip', command_compression: 'gzip'});
}

if (require.main === module)
  launch(process.argv[2], process.argv.slice(3)).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = {launch, COLLECTOR, COLLECTOR_SHA};
