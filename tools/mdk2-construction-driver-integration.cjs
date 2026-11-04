'use strict';

// Offline integration gate for the retained ORIGINAL driver, not a replacement
// observer harness. Do not launch an unobservable attempt to discover this gap.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const ROOT = path.resolve(__dirname, '..');
const RUNS = path.join(ROOT, 'scratch/runs');
const SOURCE = '1329b1ba6eb00144ff77d4cd92a8513d4fc953ad';
const OBSERVER = 'de6a33f257d93e8814d666bdec62361161569ac4';
const DRIVER = '20261104-mdk2-fresh-pending-scene/browser-driver.cjs';
const MAIN = '20261104-mdk2-post-lua-native-boundary/main-state.cjs';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const CLOSURE = Object.freeze({
  '20261104-mdk2-measured-escape-original/launch.cjs': 'db81fbe5abc6cc065e79739eee730735132b52e91ef6441a390d185ff9bad66e',
  '20261104-mdk2-measured-escape-original/endpoint-preflight.cjs': 'c41b3ae1b56af801540e2464cb26e1d5e4833babfda622992c21624f612999eb',
  '20261104-mdk2-measured-escape-original/next.py': '6fe23ef43aaa7d5441c7a131ace23a75ab06ed406ebb014e9313e8c4375a5035',
  '20261104-mdk2-measured-escape-original/control.py': 'c6e5fb27f430b74ea21d18201da80b3c21411359742c3ac5ffce098ad5643e32',
  [MAIN]: 'a5e74ab20befce8196c654886b8597ed7da1cb5fddd22efada161e02a7822e32',
  '20261104-mdk2-explicit-capture-native-onward/driver-wrapper.cjs': 'b5f85284acebec7339786c655f56929954cd8212e64bce3ff71fcc65f071e787',
  '20261104-mdk2-explicit-capture-native-onward/read-only.cjs': 'b5428b5ef914c34dbad89cd1f3dfcefd79f799cdf8080189ac89a9303fa7ebb0',
  [DRIVER]: '4a888df46221def0396b2b6be5e52ff2423cdb26714de50127f36a807b04086c',
  '20261104-mdk2-fresh-pending-scene/observe-browser.js': '12cedfe958c4fe2acc11dfdaf4a7e06843d4826b1cc0bd0bcf92639a161e7f7a',
  '20261104-mdk2-fresh-pending-scene/native-readiness.cjs': '3d1f97e39e56d95038344e519efb0321e8ed02feb7dcb87e535d8abffe493e71',
  '20261104-mdk2-fresh-pending-scene/native-opening.cjs': '04ecc705c539cb024744002ad9c4af3cf5736b5571644a405aeac414ed4be644',
  '20261104-mdk2-fresh-pending-scene/native-menu.cjs': '1e657ce9e2d29e1dc5577b3e1d5b39e18ccfda21edec18d4267dcac321db3bed',
  '20261104-mdk2-fresh-pending-scene/opening-boundary.cjs': '52f06bacd248e07d7c9d774b51eaf17637fa825a548900f57908f97e624ccacd',
  '20261104-mdk2-fresh-pending-scene/finite-deadline.cjs': '7a6ef003de6014c10bdff9d6485d2ceeee55101cc80068fa31dbf86982580ff7',
  '20261104-mdk2-fresh-pending-scene/inspection-guard.cjs': '3770e1569569257c009fa055ea878df591f2fb35ad84d48d2d3908bf15924dec',
});
function gitFile(commit, file) {
  return cp.execFileSync('git', ['show', `${commit}:${file}`], {cwd: ROOT, maxBuffer: 2000000});
}
function verifyClosure(read = file => fs.readFileSync(path.join(RUNS, file))) {
  const rows = [];
  for (const [file, expected] of Object.entries(CLOSURE)) {
    const bytes = read(file);
    assert.equal(sha(bytes), expected, `retained closure mismatch: ${file}`);
    rows.push({path: file, bytes: bytes.length, sha256: expected});
  }
  const file = 'tools/mdk2-lua-construction-observer.cjs';
  assert.equal(sha(fs.readFileSync(path.join(ROOT, file))), sha(gitFile(OBSERVER, file)), 'published observer changed');
  return rows;
}
function pinnedRuntime() {
  // Decode in memory; no modules/media/source snapshots are written.
  const b = zlib.gunzipSync(fs.readFileSync(path.join(RUNS, '20261104-mdk2-fresh-pending-scene/runtime-pins.json.gz')));
  const inventory = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(RUNS, '20261104-mdk2-fresh-pending-scene/seal.json.gz'))));
  const row = (Array.isArray(inventory) ? inventory : inventory.files).find(x => x.path === 'runtime-pins.json');
  assert(row, 'missing original pins inventory');
  assert.equal(b.length, row.bytes); assert.equal(sha(b), row.sha256);
  assert.equal(sha(b), '4a8bb12508a5f6b402880a3af9532e28ca4bd7fc18fb94bd0ccaf6c9c3ceb4ed');
  const pins = JSON.parse(b);
  assert.equal(pins.commit, SOURCE); assert.equal(pins.files.length, 432);
  const files = {};
  for (const name of ['host.js', 'lib/guest-worker.js', 'lib/guest-rpc.js', 'lib/guest-thread-host.js']) {
    const original = gitFile(SOURCE, name), pin = pins.files.find(x => x.path === name);
    assert(pin, `missing original dependency ${name}`);
    assert.equal(original.length, pin.bytes); assert.equal(sha(original), pin.sha256);
    files[name] = original.toString();
  }
  return {pins, files, pinsSHA256: sha(b)};
}
function compose(run) {
  verifyClosure();
  assert(path.isAbsolute(run), 'absolute fresh run path required');
  // This is the actual main-state -> raw/owner -> original-driver composition.
  // Original command, review, ACK, deadline and first-failure code is retained.
  const source = require(path.join(RUNS, MAIN)).sourceForRun(run);
  assert(source.includes('browserDeadline(release,Date.now())'));
  assert(source.includes("await page.evaluate(n=>WineFrozen.step(n),c.n)"));
  return {file: path.join(RUNS, DRIVER), source};
}
function inspect() {
  const closure = verifyClosure(), {pins, files, pinsSHA256} = pinnedRuntime();
  const driver = fs.readFileSync(path.join(RUNS, DRIVER), 'utf8');
  const preload = fs.readFileSync(path.join(RUNS, '20261104-mdk2-fresh-pending-scene/observe-browser.js'), 'utf8');
  const header = gitFile(SOURCE, 'src/01-header.wat').toString();
  const exports = gitFile(SOURCE, 'src/13-exports.wat').toString();
  assert(header.includes('(global $trace_esp_flag (mut i32) (i32.const 0))'));
  assert.equal(exports.split('(call $host_log_block ').length - 1, 1);
  assert(exports.includes('(if (global.get $trace_esp_flag)'));
  assert.equal(exports.split('(global.set $trace_esp_flag ').length - 1, 1);
  assert(exports.includes('(func (export "set_trace_esp")'));
  const route = [driver, preload, ...Object.values(files)].join('\n');
  assert(!route.includes('set_trace_esp'), 'trace route changed; reassess instead of accepting stale blocker');
  assert(!preload.includes('Mdk2LuaConstructionObserver'), 'observer preload changed; reassess');
  return {
    status: 'blocked-before-allocation', code: 'ORIGINAL_DRIVER_TRACE_DISABLED', source: SOURCE, observer: OBSERVER,
    firstBlocker: 'The retained original route never arms set_trace_esp; the flag defaults to zero and guards the only host.log_block call. A passive pre-instantiation import wrapper receives zero mandatory boundaries.',
    closure, pinsSHA256, moduleReferences: pins.moduleFiles,
    actualDriver: {sha256: CLOSURE[DRIVER], preResumePreloadInjection: true, observerInstalled: false,
      mainWorkerModuleBinding: false, existingTraceArmed: false},
    next: 'Retain a separately authorized bounded trace phase and its owning-instance/module binding before implementing or running the observer composition. Do not allocate or resume the closed attempt to discover missing boundaries.',
  };
}
function assertRunnable() {
  const report = inspect();
  const error = new Error(`${report.code}: ${report.firstBlocker}`);
  error.report = report;
  throw error;
}
function run(runDirectory) {
  // Fail before loading Puppeteer, opening a server, writing a run directory,
  // reading a runtime release or invoking any original main/cleanup path.
  assert(path.isAbsolute(runDirectory), 'absolute fresh run path required');
  assertRunnable();
}
module.exports = {ROOT, RUNS, SOURCE, OBSERVER, CLOSURE, DRIVER, MAIN, sha, gitFile, verifyClosure, pinnedRuntime, compose, inspect, assertRunnable, run};
if (require.main === module) {
  try {
    if (process.argv[2] === '--check' && process.argv.length === 3) {
      console.log(JSON.stringify(inspect(), null, 2)); process.exitCode = 2;
    } else if (process.argv[2] === '--run' && process.argv.length === 4) run(path.resolve(process.argv[3]));
    else throw Error('usage: node tools/mdk2-construction-driver-integration.cjs --check | --run ABSOLUTE_FRESH_RUN');
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
