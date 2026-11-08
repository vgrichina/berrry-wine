'use strict';
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const assert = require('node:assert/strict');
const composition = require('./q3-native-driver-composition.cjs');
const root = path.resolve(__dirname, '..');
async function main() {
  const result = composition.compose();
  const file = path.join(root, path.dirname(composition.consumerPath), 'bound-input.cjs');
  const run = path.resolve(process.env.Q3_INPUT_TEST_RUN);
  const old = path.join(root, path.dirname(composition.adapterPath), 'physical-completion.jsonl');
  const before = fs.existsSync(old) ? fs.readFileSync(old) : null;
  let source;
  result.hook({_compile(value) { source = value; }}, file);
  assert(source.includes(JSON.stringify(old)), 'control exposes genuine historical adapter destination');
  const loaded = new Module(file, module); loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  composition.compileBoundInput(result, loaded, file, run);
  const events = [];
  const append = fs.appendFileSync;
  fs.appendFileSync = result.append; // Same compression hook selected by install().
  try {
    await loaded.exports.hold({keys:['ArrowUp'], holdMs:50, session:'NODE_ONLY',
      send:async(method, params) => { events.push(params.type); }, sample:async() => ({fixture:'no CDP/game'})});
  } finally { fs.appendFileSync = append; }
  assert.deepEqual(events, ['keyDown','keyUp']);
  const rows = require('node:zlib').gunzipSync(fs.readFileSync(path.join(run, 'physical-completion.jsonl.gz'))).toString().trim().split('\n').map(JSON.parse);
  assert(rows.some(row => row.state === 'ARMED'));
  assert(rows.some(row => row.state === 'ACTUAL_UP_COMPLETED'));
  assert(rows.at(-1).completionPromiseSettledAt >= rows.at(-1).upCompletedAt);
  assert.deepEqual(fs.existsSync(old) ? fs.readFileSync(old) : null, before, 'historical evidence untouched');
  assert.throws(() => composition.compileBoundInput(result, loaded, file, path.dirname(old)), /unique Q3/);
  console.log('PASS genuine composed hold: historical destination control, unique gzip telemetry, actual UP promise settled, historical bytes unchanged, historical destination refused; no browser/game');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
