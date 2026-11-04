'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { BOUNDARY, inspectOriginal, createCapture } = require('../tools/gltron-logical-fps.cjs');
const root = path.resolve(__dirname, '..');
let passed = 0;
function check(name, fn) { fn(); passed++; console.log('PASS ' + name); }
const owner = {};
const event = (atMs, extra = {}) => ({ owner, threadId: 0, generation: 1,
  atMs, eip: BOUNDARY.nonzeroDt, currentCallbacks: BOUNDARY.callbackTable, dt: 16, ...extra });
const capture = extra => createCapture({ owner, generation: 1, startMs: 100, ...extra });
check('synthetic positive keeps exact raw callbacks, does not assert FPS', () => {
  const c = capture();
  [100, 116.25, 4999, 5100].forEach(t => c.record(event(t)));
  const out = c.finish(5100);
  assert.deepEqual(out.rows.map(r => r.atMs), [100, 116.25, 4999, 5100]);
  assert.equal(out.status, 'raw-events-only'); assert.equal(out.logicalFPS, null);
  assert.throws(() => c.record(event(5101)), /finished/);
});
for (const [name, change, message] of [
  ['foreign endpoint', { owner: {} }, /wrong owner/],
  ['foreign thread', { threadId: 1 }, /wrong owner/],
  ['stale generation', { generation: 0 }, /stale/],
  ['idle-entry proxy', { eip: BOUNDARY.idle }, /boundary/],
  ['paused callback', { currentCallbacks: 0x42a860 }, /boundary/],
  ['zero-dt idle poll', { dt: 0 }, /boundary/],
  ['negative dt', { dt: -1 }, /boundary/],
  ['nonfinite dt', { dt: Infinity }, /boundary/],
  ['stale wall timestamp', { atMs: 99 }, /nonmonotonic/],
  ['NaN wall timestamp', { atMs: NaN }, /nonmonotonic/],
  ['deadline overrun', { atMs: 5101 }, /deadline/],
]) check(name + ' rejects and latches first failure', () => {
  const c = capture(); assert.throws(() => c.record(event(100, change)), message);
  assert.throws(() => c.record(event(116)), /capture stopped/);
  assert.throws(() => c.finish(5100), /capture stopped/);
});
for (const t of [100, 99]) check('nonmonotonic second callback ' + t, () => {
  const c = capture(); c.record(event(100));
  assert.throws(() => c.record(event(t)), /nonmonotonic/);
});
check('bounded capacity never drops callbacks silently', () => {
  const c = capture({ capacity: 2 }); c.record(event(100)); c.record(event(101));
  assert.throws(() => c.record(event(102)), /capacity/);
});
check('short and late intervals fail', () => {
  for (const end of [5099, 6101, NaN]) assert.throws(() => capture().finish(end), /interval/);
});
check('empty stream produces no rate', () => {
  const out = capture().finish(5100);
  assert.equal(out.status, 'insufficient-events'); assert.equal(out.logicalFPS, null);
});
check('capture bounds required', () => {
  for (const extra of [{ durationMs: 4999 }, { durationMs: 10001 }, { capacity: 1 },
    { capacity: 65537 }, { owner: null }, { generation: -1 }]) assert.throws(() => capture(extra), /bounds/);
});
check('original identity and static callback structure', () => {
  const bytes = fs.readFileSync(path.join(root, 'test/binaries/gltron-0.70/gltron.exe'));
  assert.equal(inspectOriginal(bytes).runtimeOwnershipVerified, false);
  const wrong = Buffer.from(bytes); wrong[0] ^= 1;
  assert.throws(() => inspectOriginal(wrong), /hash mismatch/);
});
check('actual production host has no GLTron logical metric', () => {
  const context = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(root, 'host.js'), 'utf8'), context);
  const Host = vm.runInContext('WineAssembly', context);
  const app = require('../lib/apps').APPS.gltron;
  assert.equal(Host.prototype._normalizePerfLogicalFrame(app.perf), null);
});
check('audited trace route changes debug guards; marker supplies counts', () => {
  const exports = fs.readFileSync(path.join(root, 'src/13-exports.wat'), 'utf8');
  const recompute = exports.slice(exports.indexOf('(func $dbg_recompute'), exports.indexOf('(func (export "get_dbg_tier_guard")'));
  assert.match(recompute, /global\.set \$dbg_chain_guard \(global\.get \$dbg_any\)/);
  assert.match(recompute.slice(recompute.indexOf('global.set $dbg_tier_guard')), /global\.get \$trace_eip_flag/);
  assert.match(exports, /call \$host_log_eip \(global\.get \$eip\)/);
  const marker = fs.readFileSync(path.join(root, 'src/09a8-handlers-directx.wat'), 'utf8');
  const body = marker.slice(marker.indexOf('(func $th_logical_frame'), marker.indexOf('(func $th_logical_frame') + 3200);
  assert.match(body, /global\.set \$logical_frame_count/);
  assert.doesNotMatch(body, /call \$host_log_eip/);
});
console.log(`${passed} checks passed; synthetic events are not gameplay timing evidence`);
