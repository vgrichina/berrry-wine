#!/usr/bin/env node
'use strict';
// SimGolf's owning canceller under the L2 run supervisor (tools/native-supervise.cjs).
//
// RUN/lifecycle.json supplies the immutable browserDeadline (epoch ms). The
// external box delegate must already be armed. This launcher neither allocates
// nor stops boxes. Arguments after RUN are a literal executable vector, never
// shell source. The whole command tree dies at the deadline (TERM, then KILL),
// and RUN/receipt.json records the direct child's exit.
//
// Usage: node tools/simgolf-native-hole-launch.js RUN EXECUTABLE [ARGS...]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {supervise, availableLevel, exitStatus} = require('./native-supervise.cjs');

async function launch(run, command) {
  run = path.resolve(run);
  assert(command.length, 'literal command required');
  assert(!fs.existsSync(path.join(run, 'receipt.json')), 'supervisor receipt already exists');
  const life = JSON.parse(fs.readFileSync(path.join(run, 'lifecycle.json')));
  // The consumer cancels by SIGTERMing its verified parent (owningCanceller),
  // so it must stay a direct child of this process: no PID namespace (where
  // its parent would read as 0); parent-death KILL is kept where available.
  const level = availableLevel() === 'pgid' ? 'pgid' : 'pdeathsig';
  return supervise(run, command, {deadline: life.browserDeadline / 1000,
    cleanup_deadline: life.browserDeadline / 1000 + 30, grace: 5, level});
}
// A cancelled or expired run fails with 1; otherwise the command's own status.
function status(receipt) {
  return receipt.terminated && receipt.terminated !== 'sweep after exit' ? 1 : exitStatus(receipt);
}

if (require.main === module)
  launch(process.argv[2], process.argv.slice(3)).then(receipt => { process.exitCode = status(receipt); },
    error => { console.error(error); process.exitCode = 1; });
module.exports = {launch, status};
