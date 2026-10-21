#!/usr/bin/env node
'use strict';
// Source-only mutation tests. No wasm compilation, guest execution or model
// token simulation: these establish inventory enforcement, not jump safety.
const assert = require('assert');
const { scanWat, scanSources, check, checkNonlocalAPIs } = require('../tools/callback-ownership-census');
const source = `(func $entry (export "inject") (global.set $eip (local.get $callback)))`;
const sources = [{ file: 'src/fixture.wat', src: source }];
const entries = scanSources(sources);
const baseline = { version: 1, entries: entries.map(e => ({ ...e, kind: 'callback',
  reason: 'Fixture callback; retained-context ownership pending.', ownership: 'pending' })) };
assert.deepStrictEqual(check(entries, baseline), []);
assert(check(scanSources([{ file: 'src/fixture.wat', src: source.replace('$callback', '$other') }]), baseline)
  .some(e => e.includes('changed producer')), 'target replacement with unchanged count fails');
assert(check(scanSources([...sources, { file: 'src/new.wat', src: '(func $new (global.set $eip (i32.const 1)))' }]), baseline)
  .some(e => e.includes('unknown producer')));
assert(check(scanSources([...sources, { file: 'src/new.wat', src: '(func $reset (global.set $invocation_root (i64.const 0)))' }]), baseline)
  .some(e => e.includes('unknown producer')), 'bare private identity reset is inventoried');
assert(check([], baseline).some(e => e.includes('stale producer')));
assert(check(scanSources([...sources, { file: 'src/new.wat', src: '(func $reset (global.set $crt_callback_depth (i32.const 0)))' }]), baseline)
  .some(e => e.includes('unknown producer')), 'bare retained CRT frame reset is inventoried');
assert(check(scanSources([...sources, { file: 'src/new.wat', src: '(func $reset (global.set $bsearch_depth (i32.const 0)))' }]), baseline)
  .some(e => e.includes('unknown producer')), 'bare retained bsearch frame reset is inventoried');
assert(check(scanSources([...sources, { file: 'src/new.wat', src: '(func $reset (global.set $qsort_depth (i32.const 0)))' }]), baseline)
  .some(e => e.includes('unknown producer')), 'bare retained qsort frame reset is inventoried');
assert(check(entries, { version: 1, entries: [baseline.entries[0], baseline.entries[0]] })
  .some(e => e.includes('duplicate inventory')));
assert(check(entries, { version: 1, entries: [{ ...baseline.entries[0], ownership: 'covered' }] })
  .some(e => e.includes('unsupported ownership assertion')), 'a label cannot assert coverage');

// Parser-based coverage includes nested block comments and strings containing
// fake writes; macros and top-level writes cannot evade the scan.
const syntax = `;; (global.set $eip (i32.const 9))
  (; outer (; (global.set $eip (i32.const 9)) ;) ;)
  (data (i32.const 0) "(global.set $eip)")
  (defmacro (enter) (global.set $eip (i32.const 1)))
  (global.set $eip (i32.const 2))`;
assert.strictEqual(scanWat(syntax, 'src/macros.wat').reduce((n, e) => n + e.writes, 0), 2);
assert.throws(() => scanWat('(func $broken', 'src/broken.wat'));

// A wrapper needs an inventory record even when only its callee writes EIP.
const indirect = scanSources([{ file: 'src/wrapper.wat', src: `${source}
  (func $middle (call $entry))
  (func (export "outer") (return_call $middle))` }]);
assert(indirect.some(e => e.exports.includes('outer') && e.writes === 0));
for (const js of [
  'x.inject(cb)', 'x["inject"](cb)', "x['inject'](cb)",
  'const { inject: enter } = x; enter(cb)',
]) {
  assert(scanSources([...sources, { file: 'lib/callback.js', src: js }])
    .some(e => e.file === 'lib/callback.js'), `known export reference: ${js}`);
}
const host = scanSources([...sources, { file: 'lib/callback.js', src: 'x.inject(cb); restore();' }]);
const hostBaseline = { version: 1, entries: host.map(e => ({ ...e, kind: 'host-entry', reason: 'Fixture', ownership: 'pending' })) };
assert(check(scanSources([...sources, { file: 'lib/callback.js', src: 'restore(); x.inject(cb);' }]), hostBaseline)
  .some(e => e.includes('changed producer')), 'same named calls reordered still fails');

assert.deepStrictEqual(checkNonlocalAPIs([{ file: 'src/crt.wat', src: '(func $handle__setjmp3)' }]), []);
assert(checkNonlocalAPIs([{ file: 'src/crt.wat', src: '(func $handle_longjmp)' }]).length);
assert(checkNonlocalAPIs([], [{ name: '_setjmp', alias: '_setjmp3' }]).length,
  'API alias cannot bypass prerequisite review lock');
assert(checkNonlocalAPIs([], [{ name: 'longjmp' }]).length);

// MIDI/wave extraction: hash renewal alone must not conceal a changed target,
// wrapper signature, or a claim that a guest-stack frame is a private token.
const audioFile = 'src/audio-fixture.wat';
const audio = `(func $fire_audio_callback_bound
  (global.set $eip (local.get $cb)))
  (func $fire_wave_out_callback_bound (export "fire_wave_out_callback_bound")
    (call $fire_audio_callback_bound))
  (func $fire_midi_out_callback_bound (export "fire_midi_out_callback_bound")
    (call $fire_audio_callback_bound))`;
const audioEntries = scanSources([{file: audioFile, src: audio}]);
const audioCensus = {version: 1, entries: audioEntries.map(e => ({...e,
  kind: 'callback', reason: 'Normal guest-stack continuation; token ownership pending.',
  ownership: 'pending'}))};
assert.strictEqual(audioEntries.length, 3);
assert.deepStrictEqual(check(audioEntries, audioCensus), []);
function refreshedHashes(actual) {
  return {version: 1, entries: audioCensus.entries.map(e => ({...e,
    sha256: actual.find(a => a.name === e.name)?.sha256 || e.sha256}))};
}
const retargeted = scanSources([{file: audioFile, src: audio.replace(
  '(local.get $cb)', '(i32.const 0)')}]);
assert(check(retargeted, refreshedHashes(retargeted)).some(e => e.includes('(targets)')),
  'refreshed digest cannot hide null callback target');
const renamed = scanSources([{file: audioFile, src: audio.replace(
  '"fire_midi_out_callback_bound"', '"unreviewed_midi_entry"')}]);
assert(check(renamed, refreshedHashes(renamed)).some(e => e.includes('(exports)')),
  'refreshed digest cannot hide changed exported entry');
const tokenClaim = refreshedHashes(audioEntries);
tokenClaim.entries[0].ownership = 'covered';
assert(check(audioEntries, tokenClaim).some(e => e.includes('unsupported ownership')),
  'matching digests do not prove retained invocation ownership');
// Even a completely refreshed inventory cannot unlock the independent API
// prerequisite. This is deliberately separate from semantic execution tests:
// census hashes alone cannot establish carry restoration or queue safety.
const nonlocalSources = [{file: audioFile, src: audio +
  '\n(func $handle_longjmp (global.set $eip (i32.const 1)))'}];
const nonlocalEntries = scanSources(nonlocalSources);
assert.deepStrictEqual(check(nonlocalEntries, {version: 1,
  entries: nonlocalEntries.map(e => ({...e, kind: 'callback',
    reason: 'Negative control', ownership: 'pending'}))}), []);
assert(checkNonlocalAPIs(nonlocalSources, [{name: 'longjmp'}]).length >= 2,
  'fully refreshed census still cannot authorize nonlocal handler/API');
// Exercise the real manifest, not only self-consistent fixture inventories.
// An unreviewed lifetime edit must fail even when producer counts stay equal.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '..');
const real = JSON.parse(cp.execFileSync(process.execPath,
  [path.join(root, 'tools/callback-ownership-census.js'), '--dump'], {encoding: 'utf8'}));
const reviewed = require('../tools/callback-ownership-census.json');
assert.deepStrictEqual(check(real.entries, reviewed), [], 'real source must match reviewed manifest');
const hostSource = fs.readFileSync(path.join(root, 'host.js'), 'utf8');
const retirement = 'this._processObject.wine = null;';
assert(hostSource.includes(retirement));
const changedHost = scanSources([{file: 'host.js', src: hostSource.replace(retirement, 'void this;')}]);
assert.equal(changedHost.length, 1);
const changedReal = real.entries.map(e => e.file === 'host.js' ? changedHost[0] : e);
assert.deepStrictEqual(check(changedReal, reviewed),
  ['changed producer host.js:host-file (sha256); review its lifetime'],
  'removing process-host retirement must reject with an exact producer diagnostic');
const workerSource = fs.readFileSync(path.join(root, 'lib/guest-worker.js'), 'utf8');
const guard = '!namedWaitTransport?.consumeNamedWait(msg.namedWaitSequence)';
assert(workerSource.includes(guard));
const changedWorker = scanSources([{file: 'lib/guest-worker.js', src: workerSource.replace(guard, 'false')}]);
assert.equal(changedWorker.length, 1);
assert.deepStrictEqual(check(real.entries.map(e => e.file === 'lib/guest-worker.js' ? changedWorker[0] : e), reviewed),
  ['changed producer lib/guest-worker.js:host-file (sha256); review its lifetime'],
  'removing single-completion ownership must reject');
console.log('callback ownership census mutation tests PASS (fixtures and two real lifetime mutations; source inventory only)');
