'use strict';
// Offline synthetic fixture: executes unchanged generated observer functions,
// actual runner applyMain(), and the actual adapter. No guest or game evidence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const spec = require('../tools/maelstrom-native-errno-latch.cjs');
const {createAdapter} = require('../tools/maelstrom-original-errno-adapter.cjs');
const {createRunnerExperiments} = require('./runner-experiments');
const {compile} = require('../tools/watx.js');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const evidence = path.join(root, 'docs/reviews/maelstrom-mode-transition-observer-repair-oct26');
const pins = JSON.parse(fs.readFileSync(path.join(evidence, 'fixture-inputs.json')));
for (const row of pins) assert.equal(sha(read(row.path)), row.sha256, row.path);
assert.equal(sha(read('tools/maelstrom-native-errno-latch.cjs')), '52d044f14d6ee129b2b6f5b81335f7d2c00b70a9f7513b7bd179203936150da8');
assert.equal(sha(read('tools/maelstrom-original-errno-adapter.cjs')), '85d86f19ce431c7c9248ef080e4267451f6027b5d8927dd2ebdf0d955d3dd075');
const selectText = read('tools/maelstrom-select-completion-hook.cjs');
assert.equal(sha(selectText), pins.find(p => p.path === 'tools/maelstrom-select-completion-hook.cjs').sha256);
// storage() is private in the unchanged hook. Expose it only inside this fixture's VM.
const context = {require, module: {exports: {}}, Buffer};
vm.runInNewContext(selectText + '\nmodule.exports.fixtureStorage = storage;', context);
let select = context.module.exports.fixtureStorage();
select = spec.once(select, '(func (export "msc_start")', '(func $msc_begin_for_mne (export "msc_start")');
select = spec.once(select, '(global.set $msc_phase (local.get $phase)))',
  '(global.set $msc_phase (local.get $phase))\n  (if (i32.eq (local.get $phase) (i32.const 3)) (then (call $mne_complete))))');
const a = {successor: spec.SELECT_RETURN + 4, selectRet: spec.SELECT_RETURN, frame: 0x124,
  crtEntryRva: 0xc430, crtTailRva: 0xc435, crtRetRva: 0xc438};
let native = spec.storage(a, 0x522000, true);
// Only mapping bound is reduced for the four-page synthetic memory. All guard,
// start, select, call, return and diagnostic expressions remain unchanged.
native = spec.once(native, '(region.end $DIRECT_WINDOW)', '(i32.const 262144)');
const uop = read('src/07d-uop-engine.wat');
let setter = uop.slice(uop.indexOf('(func (export "set_uop")'), uop.indexOf('  (func (export "get_uop")'));
setter = spec.once(setter, '(global.set $uop_enabled (i32.ne (local.get $on) (i32.const 0)))',
  '(call $mne_uop_switch (i32.ne (local.get $on) (i32.const 0)))\n    (global.set $uop_enabled (i32.ne (local.get $on) (i32.const 0)))');
const globals = [...new Set([...((native + select + setter).matchAll(/global\.(?:get|set) \$([\w]+)/g))].map(m => m[1]))]
  .filter(n => !n.startsWith('mne_') && !n.startsWith('msc_'));
const init = {image_base: 0x400000, GUEST_BASE: 0x10000};
const wat = `(memory 4)\n(export "memory" (memory 0))\n` + globals.map(n => `(global $${n} (mut i32) (i32.const ${init[n] || 0}))`).join('\n') +
  '\n(func $uop_flush)\n(func $bx_hot_gate_refresh)\n' + select + native + setter + `
(func (export "get_uop") (result i32) (global.get $uop_enabled))
(func (export "fixture_enter")
  (i32.store offset=16 (global.get $reg_base) (i32.const 0x401000))
  (call $msc_arm (i32.const ${a.selectRet}) (i32.const 0x401000) (i32.const 0) (i32.const 0) (i32.const 0))
  (drop (call $msc_enter)))
(func (export "fixture_park")
  (global.set $yield_reason (i32.const 8))
  (call $msc_end (global.get $msc_token) (i32.const 2)))
(func (export "fixture_complete")
  (global.set $yield_reason (i32.const 0))
  (i32.store offset=16 (global.get $reg_base) (i32.const 0x401018))
  (i32.store (global.get $reg_base) (i32.const -1))
  (call $msc_end (global.get $msc_token) (i32.const 3)))
(func (export "fixture_call")
  (global.set $eip (if (result i32) (global.get $uop_enabled)
    (then (i32.const ${a.successor - 2})) (else (i32.const ${a.selectRet}))))
  (i32.store offset=20 (global.get $reg_base) (i32.const -1))
  (call $mne_call (i32.const ${a.successor}) (i32.const 0x52e430) (i32.const 7)))
(func (export "fixture_return")
  (global.set $eip (i32.const ${a.successor}))
  (i32.store offset=0 (global.get $reg_base) (i32.const 0x402000))
  (i32.store offset=28 (global.get $reg_base) (i32.const 0x52e430))
  (i32.store (i32.const 0x12000) (i32.const 4))
  (i32.store (i32.const 0x1113c) (i32.const 0x401234))
  (i32.store (i32.const 0x11140) (i32.const 0x401500))
  (i32.store (i32.const 0x11144) (i32.const 0))
  (call $mne_return (if (result i32) (global.get $uop_enabled)
    (then (i32.const 0x52e438)) (else (i32.const 0x52e435)))))
`;
assert(Buffer.byteLength(wat) < 131072);
const compiled = compile(wat, new Map(), {mode: 'production'});
assert(compiled.wasmBinary, compiled.errors?.join('\n'));
assert(compiled.wasmBinary.length < 30000);
const moduleBytes = Buffer.from(compiled.wasmBinary);
const mod = new WebAssembly.Module(moduleBytes);
const results = [];
function test(name, fn) { fn(); results.push({name, pass: true}); }
function fresh() { return new WebAssembly.Instance(mod); }
function initialize(instance, flags = []) {
  createRunnerExperiments({hasFlag: n => flags.includes(n), getArg: (n, fallback = null) => fallback,
    env: {}, log: () => {}, appPolicy: () => null}).applyMain(instance, {copySuperops: false, ctx: {}});
}
function adapter(instance, persist = () => {}) { return createAdapter(instance, {persist, readLive: () => ({synthetic: true})}); }
function finish(e) { e.fixture_enter(); e.fixture_complete(); e.fixture_call(); e.fixture_return(); }
test('authentic early-start ordering reproduces reason15 before select entry', () => {
  const i = fresh(), rows = [], ad = adapter(i, row => rows.push(row)); ad.start(); initialize(i);
  const e = i.exports;
  assert.equal(e.get_uop(), 1); assert.equal(e.mne_status(), 5); assert.equal(e.mne_rejectReason(), 15);
  for (const k of ['phase','token','entries','completions']) assert.equal(e['msc_' + k](), 0);
  assert.throws(() => ad.observe(0), /status rejection/);
  const expected = JSON.parse(fs.readFileSync(path.join(evidence, 'observation.json')));
  const got = rows.at(-1);
  assert.deepEqual(got.historicalNativeLatch, expected.native);
  assert.deepEqual(got.historicalSelectLatch, expected.select);
  assert.deepEqual(got.historicalNativeRejection, expected.rejection);
});
test('source-supported prerequisite: initialize, then arm preserves mode1 invocation', () => {
  const i = fresh(); initialize(i); const ad = adapter(i); ad.start(); finish(i.exports);
  const row = ad.observe(0); assert.equal(row.kind, 'captured');
  assert.equal(row.historicalNativeLatch.event, 3); assert.equal(i.exports.get_uop(), 1);
});
test('mode0 initialization then arm remains supported', () => {
  const i = fresh(); initialize(i, ['no-uop']); const ad = adapter(i); ad.start(); finish(i.exports);
  assert.equal(ad.observe(0).kind, 'captured'); assert.equal(i.exports.get_uop(), 0);
});
for (const mode of [0, 1]) for (const phase of ['awaiting','select','parked','completed','native']) {
  test(`mode${mode} change rejects while ${phase}`, () => {
    const i = fresh(), e = i.exports; e.set_uop(mode); const ad = adapter(i); ad.start();
    if (phase !== 'awaiting') e.fixture_enter();
    if (phase === 'parked') e.fixture_park();
    if (phase === 'completed' || phase === 'native') e.fixture_complete();
    if (phase === 'native') e.fixture_call();
    const event = e.mne_event(); e.set_uop(1 - mode);
    assert.equal(e.mne_status(), 5); assert.equal(e.mne_event(), event); assert.equal(e.mne_rejectReason(), 15);
    assert.throws(() => ad.observe(0), /status rejection/);
    e.set_uop(mode); e.mne_start(); assert.equal(e.mne_status(), 5); assert.equal(e.mne_rejectReason(), 15);
  });
  test(`mode${mode} same-mode request accepted while ${phase}`, () => {
    const i = fresh(), e = i.exports; e.set_uop(mode); e.mne_start();
    if (phase !== 'awaiting') e.fixture_enter();
    if (phase === 'parked') e.fixture_park();
    if (phase === 'completed' || phase === 'native') e.fixture_complete();
    if (phase === 'native') e.fixture_call();
    const status = e.mne_status(), event = e.mne_event(); e.set_uop(mode ? 99 : 0);
    assert.equal(e.mne_status(), status); assert.equal(e.mne_event(), event); assert.equal(e.mne_rejectReason(), 0);
  });
}
test('no reset/rearm after capture; changing terminal mode preserves immutable capture', () => {
  const i = fresh(), e = i.exports; initialize(i); const ad = adapter(i); ad.start(); finish(e);
  const before = Object.fromEntries(spec.FIELDS.map(k => [k, e['mne_' + k]() ]));
  e.set_uop(0); e.mne_start();
  assert.deepEqual(Object.fromEntries(spec.FIELDS.map(k => [k, e['mne_' + k]() ])), before);
  assert.equal(e.mne_rejectReason(), 0); assert.throws(() => ad.start(), /one invocation only/);
  assert.throws(() => adapter(i), /duplicate native latch owner/); assert.equal(typeof e.mne_reset, 'undefined');
});
test('rejected start cannot rearm; fresh instance is prerequisite', () => {
  const i = fresh(), e = i.exports; const ad = adapter(i); ad.start(); initialize(i);
  e.mne_start(); assert.equal(e.mne_status(), 5); assert.throws(() => ad.start(), /one invocation only/);
  assert.throws(() => adapter(i), /duplicate native latch owner/);
  const j = fresh(); initialize(j); adapter(j).start(); assert.equal(j.exports.mne_status(), 1);
});
for (const terminal of ['capture','reject']) for (const throws of [false, true]) {
  test(`${terminal} closes before ${throws ? 'throwing' : 'reentrant'} persist callback`, () => {
    const i = fresh(); let reads = 0, calls = 0, ad;
    const facade = {exports: Object.fromEntries(Object.entries(i.exports).map(([k, v]) => [k,
      typeof v === 'function' && /^(mne_|msc_)/.test(k) ? (...args) => { reads++; return v(...args); } : v]))};
    ad = adapter(facade, row => {
      if (row.kind !== 'captured' && row.kind !== 'rejected') return;
      calls++; const before = reads; assert.equal(ad.observe(99), null); assert.equal(reads, before);
      if (throws) throw Error('persist sentinel');
    });
    if (terminal === 'capture') initialize(i);
    ad.start(); if (terminal === 'capture') finish(i.exports); else initialize(i);
    if (throws) assert.throws(() => ad.observe(0), /persist sentinel/);
    else if (terminal === 'reject') assert.throws(() => ad.observe(0), /status rejection/);
    else assert.equal(ad.observe(0).kind, 'captured');
    const before = reads; assert.equal(ad.observe(1), null); assert.equal(reads, before); assert.equal(calls, 1);
  });
}
console.log(JSON.stringify({schema: 'maelstrom-mode-transition-offline/v1', outcome: 'GUARD_CORRECT_RUNNER_ARM_ORDER_PREREQUISITE',
  tests: results, count: results.length, sourceUnchanged: true, moduleSHA256: sha(moduleBytes), moduleBytes: moduleBytes.length,
  watSHA256: sha(wat), watBytes: Buffer.byteLength(wat), memoryBytes: 262144,
  processRSS: process.memoryUsage().rss, processPeakRSS: process.resourceUsage().maxRSS * 1024,
  syntheticOnly: true, originalGameAcceptance: false, requestedModeInAuthenticCapture: null, rejectingPCInAuthenticCapture: null}));
