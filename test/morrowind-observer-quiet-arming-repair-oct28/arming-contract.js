'use strict';
// Exact runner slices in a synthetic fixture; no full runner, WAT or guest runs.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const crypto = require('crypto');
const { createRequire } = require('module');
const root = path.resolve(__dirname, '../..');
const runner = fs.readFileSync(path.join(root, 'test/run.js'), 'utf8');
const probePath = path.join(root, 'tools/probes/morrowind-name-observer-contracts.js');
const probe = fs.readFileSync(probePath, 'utf8');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
assert.equal(hash(probe), '09a9a3254dc35a050f8d5e28f7d00d90295cb53e6e311477d03e0407ef0358e6');
assert.equal(hash(fs.readFileSync(process.argv[2])), 'f48300e194c6917cd98d235d259ebc3ab5d7c2071e9b41d798b996a8ce4d0676');
const start = runner.indexOf('  apiLogOff = QUIET_API &&');
const end = runner.indexOf('\n  h.log = ', start);
assert(start > 0 && end > start);
const predicate = runner.slice(start, end);
const reset = 'if (apiLogOff && instance.exports.set_api_log) instance.exports.set_api_log(0);';
const resetAt = runner.indexOf(reset, runner.indexOf('  experiments.applyMain(instance,'));
const attachAt = runner.indexOf('// MORROWIND_NAME_ATTACH_BEGIN');
const attachEnd = runner.indexOf('// MORROWIND_NAME_ATTACH_END');
assert(start < attachAt && attachAt < attachEnd);
assert(attachEnd < runner.indexOf('callDllMain(ex,') && attachEnd < resetAt);

// Reuse only the pinned predecessor scaffold. Expose context and insert a
// pre-attachment callback so predicate -> attach -> late reset matches source.
const prefix = probe.slice(0, probe.indexOf('// First behavioral group:'));
const expose = 'observer: context.morrowindNameObserver }';
const insertion = "    const begin = runner.indexOf('// MORROWIND_NAME_' + marker + '_BEGIN');";
assert(prefix.includes(expose) && prefix.includes(insertion));
const transformed = prefix.replace(expose, 'context, observer: context.morrowindNameObserver }')
  .replace(insertion, "    if (marker === 'ATTACH') beforeAttach(context);\n" + insertion);
let beforeAttach;
const scaffold = { require: createRequire(probePath), __dirname: path.dirname(probePath),
  process: { argv: ['node', probePath, process.argv[2]] }, Buffer, console,
  beforeAttach: c => beforeAttach(c) };
vm.runInNewContext(transformed + '\nglobalThis.makeFixture = fixture;', scaffold,
  { timeout: 5000 });
const outcomes = [];
function run({ quiet, enabled, consumers = {}, mutated = false, resetBeforeAttach = false }) {
  const sequence = [];
  beforeAttach = c => {
    Object.assign(c, { QUIET_API: quiet, TRACE_API_PAUSED: false, TRACE_API_COUNTS: false,
      ESP_AUDIT: false, apiLogOff: false }, consumers);
    const originalSet = c.instance.exports.set_api_log;
    c.instance.exports.set_api_log = n => { sequence.push(n); originalSet(n); };
    const source = mutated ? predicate.replace("    !hasFlag('observe-morrowind-name') &&\n", '') : predicate;
    if (mutated) assert.notEqual(source, predicate);
    vm.runInNewContext(source, c, { timeout: 1000 });
    if (resetBeforeAttach) vm.runInNewContext(reset, c, { timeout: 1000 });
  };
  const f = scaffold.makeFixture(undefined, { enabled });
  const atAttach = f.e.apiLog;
  if (!resetBeforeAttach) vm.runInNewContext(runner.slice(resetAt, resetAt + reset.length),
    f.context, { timeout: 1000 });
  const records = f.records.filter(x => x.kind === 'installed').length;
  assert.equal(records, enabled ? 1 : 0);
  if (!enabled) {
    assert.equal(f.observer, null);
    assert.equal(f.records.length, 0);
    assert.equal(f.e.range, undefined);
    assert.equal(atAttach, resetBeforeAttach ? 0 : undefined);
    if (quiet && Object.keys(consumers).length === 0) {
      // Even a manually invoked exact production API hook stays silent.
      f.apiEnter();
      assert.equal(f.records.length, 0);
      assert.equal(f.context.logs.length, 0);
    }
  }
  const result = { quiet, enabled, consumers, mutated, resetBeforeAttach,
    apiLogOff: f.context.apiLogOff, atAttach: atAttach ?? null,
    finalApiLog: f.e.apiLog ?? null, sequence, installedRecords: records };
  outcomes.push(result);
  return result;
}
for (const quiet of [true, false]) for (const enabled of [true, false]) {
  const r = run({ quiet, enabled });
  assert.equal(r.apiLogOff, quiet && !enabled);
  assert.equal(r.finalApiLog, enabled ? 1 : quiet ? 0 : null);
  assert.deepEqual(r.sequence, enabled ? [1] : quiet ? [0] : []);
}
const independent = [
  { TRACE_API: true }, { TRACE_API_COUNTS: true }, { TRACE_CRITICAL: true },
  { TRACE_INPUT_DISPATCH: true }, { ESP_DELTA: true }, { ESP_AUDIT: true },
  { breakApis: ['Example'] }, { TRACE_API_MEM: ['Example'] },
];
for (const consumers of independent) for (const enabled of [false, true]) {
  const r = run({ quiet: true, enabled, consumers });
  assert.equal(r.apiLogOff, false);
  assert.equal(r.finalApiLog, enabled ? 1 : null);
}
for (const enabled of [false, true]) for (const memory of [[], ['Example']]) {
  const r = run({ quiet: true, enabled,
    consumers: { TRACE_API: true, TRACE_API_PAUSED: true, TRACE_API_MEM: memory } });
  assert.equal(r.apiLogOff, !enabled);
  assert.equal(r.finalApiLog, enabled ? 1 : 0);
}
// Removing just the repair must fail the retained-arming assertion. The old
// ordering masks it, so explicitly show why testing attach after reset is weak.
const rejected = run({ quiet: true, enabled: true, mutated: true });
assert.deepEqual(rejected.sequence, [1, 0]);
assert.throws(() => assert.equal(rejected.finalApiLog, 1), assert.AssertionError);
const reversed = run({ quiet: true, enabled: true, mutated: true, resetBeforeAttach: true });
assert.deepEqual(reversed.sequence, [0, 1]);
assert.equal(reversed.finalApiLog, 1);
console.log(JSON.stringify({ verdict: 'PASS_SOURCE_ARMING_ONLY', runnerSHA256: hash(runner),
  predicateSHA256: hash(predicate), fixtureSHA256: hash(prefix), transformedSHA256: hash(transformed),
  transformations: 'Expose fixture context; pre-attach callback executes exact predicate before exact attach, then exact late reset. Mutation removes only observer predicate; reversed ordering is a negative test-design control.',
  cases: outcomes.length, outcomes,
  fullRunnerExecuted: false, wasmExecuted: false, guestExecuted: false }, null, 2));
