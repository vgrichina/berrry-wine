'use strict';
// Independent exact-source contract; DOES NOT execute the whole runner or wasm.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert/strict');
const { createRequire } = require('module');
const donor = process.argv[2];
const exe = process.argv[3];
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const runner = fs.readFileSync(path.join(donor, 'test/run.js'), 'utf8');
const observer = fs.readFileSync(path.join(donor, 'lib/morrowind-name-observer.js'));
assert.equal(hash(runner), 'dbf2493b75f5584e3c46810d5379a07394c12c27cef80753dcdc329a24872de6');
assert.equal(hash(observer), 'a2bbe6d15de3fc46d65f6e72e365e82cd223b5db5486dc3cdbc585aad9d75799');
assert.equal(hash(fs.readFileSync(exe)), 'f48300e194c6917cd98d235d259ebc3ab5d7c2071e9b41d798b996a8ce4d0676');
const probePath = path.join(donor, 'tools/probes/morrowind-name-observer-contracts.js');
const probe = fs.readFileSync(probePath, 'utf8');
assert.equal(hash(probe), '09a9a3254dc35a050f8d5e28f7d00d90295cb53e6e311477d03e0407ef0358e6');
// Reuse only predecessor's fixture scaffold, NOT its already-passing groups.
// One scaffold-only transformation exposes its VM context for additional exact
// production initialization statements. Production slices remain unchanged.
const prefix = probe.slice(0, probe.indexOf('// First behavioral group:'));
assert(prefix.includes('observer: context.morrowindNameObserver }'));
const exposed = prefix.replace('observer: context.morrowwindNameObserver }', 'UNREACHABLE')
  .replace('observer: context.morrowindNameObserver }', 'context, observer: context.morrowindNameObserver }');
assert.notEqual(prefix, exposed);
const scaffold = { require: createRequire(probePath), __dirname: path.dirname(probePath),
  process: { argv: ['node', probePath, exe] }, Buffer, console };
vm.runInNewContext(exposed + '\nglobalThis.makeFixture = fixture;', scaffold,
  { filename: probePath + ':fixture-only', timeout: 5000 });
const predicateStart = runner.indexOf('  apiLogOff = QUIET_API &&');
const predicateEnd = runner.indexOf('\n  h.log = ', predicateStart);
assert(predicateStart > 0 && predicateEnd > predicateStart);
const predicate = runner.slice(predicateStart, predicateEnd);
const reset = 'if (apiLogOff && instance.exports.set_api_log) instance.exports.set_api_log(0);';
const lateReset = runner.indexOf(reset, runner.indexOf('  experiments.applyMain(instance,'));
const attachEnd = runner.indexOf('// MORROWIND_NAME_ATTACH_END');
const initRoute = runner.indexOf('callDllMain(ex,');
assert(lateReset > attachEnd && initRoute > attachEnd);
const outcomes = [];
function run(quiet, enabled, mutation = false) {
  const f = scaffold.makeFixture(undefined, { enabled });
  const c = f.context;
  Object.assign(c, { QUIET_API: quiet, TRACE_API_PAUSED: false, TRACE_API_COUNTS: false,
    ESP_AUDIT: false, apiLogOff: false });
  // Exact production predicate and later startup statement, in original order.
  vm.runInNewContext(mutation
    ? predicate.replace('QUIET_API &&', "QUIET_API && !hasFlag('observe-morrowind-name') &&")
    : predicate, c, { timeout: 1000 });
  const armedAtAttach = f.e.apiLog;
  vm.runInNewContext(runner.slice(lateReset, lateReset + reset.length), c, { timeout: 1000 });
  const result = { quiet, enabled, mutation, apiLogOff: c.apiLogOff,
    armedAtAttach: armedAtAttach === undefined ? null : armedAtAttach,
    finalApiLog: f.e.apiLog === undefined ? null : f.e.apiLog,
    installedRecords: f.records.filter(x => x.kind === 'installed').length,
    fullRunnerExecuted: false, wasmExecuted: false };
  outcomes.push(result);
  return result;
}
const disabled = run(true, false);
assert.equal(disabled.armedAtAttach, null);
assert.equal(disabled.installedRecords, 0);
const normal = run(false, true);
assert.equal(normal.finalApiLog, 1);
const counterexample = run(true, true);
assert.equal(counterexample.armedAtAttach, 1);
assert.equal(counterexample.apiLogOff, true);
assert.equal(counterexample.finalApiLog, 0);
const mutation = run(true, true, true);
assert.equal(mutation.finalApiLog, 1);
assert.equal(mutation.apiLogOff, false);
const dispatch = fs.readFileSync(path.join(donor, 'src/09b-dispatch.wat'), 'utf8');
assert(dispatch.includes('(if (global.get $api_log_on)\n          (then\n            (call $host_log_i32'));
assert(dispatch.includes('(if (global.get $api_log_on) (then (call $host_log_api_exit)))'));
const line = pos => runner.slice(0, pos).split('\n').length;
console.log(JSON.stringify({ verdict: 'REJECTED', finding: 'Quiet API startup disables enabled observer COM entry/completion imports',
  outcomes, production: { runnerSHA256: hash(runner), observerSHA256: hash(observer),
    predicateSHA256: hash(predicate), resetSHA256: hash(reset),
    predicateLine: line(predicateStart), attachEndLine: line(attachEnd),
    initializerRouteLine: line(initRoute), lateResetLine: line(lateReset),
    fixtureScaffoldSHA256: hash(prefix), transformedScaffoldSHA256: hash(exposed),
    transformation: 'fixture prefix only; expose context in returned scaffold; isolate exact production predicate and post-attach reset by literal boundaries' },
  assertions: 'disabled default, enabled nonquiet control, enabled quiet rejection, predicate-only mutation control, actual WAT logger guards',
  limitation: 'No full production runner, module, initializers, WAT or original guest execution. WAT dispatch suppression is source-backed, not an executed guest observation.' }, null, 2));
