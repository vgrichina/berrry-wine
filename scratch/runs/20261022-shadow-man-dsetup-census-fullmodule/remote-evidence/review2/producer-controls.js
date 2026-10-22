'use strict';
// Execute from the complete retained source checkout, using its unmodified gate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const {scanSources, check, checkNonlocalAPIs} = require(path.join(root, 'tools/callback-ownership-census'));
const census = require(path.join(root, 'tools/callback-ownership-census.json'));
const output = [];
for (const [file, mutations] of [
  ['lib/process-boot.js', [
    ['allow installed-file overwrite', '(!existing.staticModule || file === \'OPENGL32.DLL\')', '(false)'],
    ['drop callback gate release', 'try { return serviceLoadLibraryYieldSyncOwned(opts); } finally { gate.release(); }', 'try { return serviceLoadLibraryYieldSyncOwned(opts); } finally { /* omitted release */ }'],
  ]],
  ['lib/storage.js', [
    ['omit retained callback validation', 'exports.com_callback_check(token);', '/* omitted token check */'],
    ['omit private context retirement', 'exports.com_callback_leave(token);', '/* omitted token retirement */'],
    ['omit reset reseeding', '  _initDefaultRegistry();\n  return n;', '  /* omitted reseeding */\n  return n;'],
  ]],
]) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const entries = census.entries.filter(e => e.file === file);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].kind, 'host-entry');
  assert.equal(entries[0].ownership, 'pending');
  const lock = {version: 1, entries};
  const scan = text => scanSources([{file, src: text}]);
  assert.deepEqual(check(scan(src), lock), []);
  for (const [name, from, to] of mutations) {
    assert.equal(src.split(from).length, 2, name + ': unique real production anchor');
    const errors = check(scan(src.replace(from, to)), lock);
    assert.deepEqual(errors, [`changed producer ${file}:host-file (sha256); review its lifetime`]);
    output.push({file, mutation: name, rejected: true});
  }
  const relabeled = structuredClone(lock);
  relabeled.entries[0].ownership = 'covered';
  assert(check(scan(src), relabeled).some(e => e.includes('unsupported ownership assertion')));
  assert(check(scan(src), {version: 1, entries: []}).some(e => e.includes('unknown producer')));
  assert(check([], lock).some(e => e.includes('stale producer')));
  output.push({file, relabelRejected: true, deletionRejected: true, missingSourceRejected: true});
}
assert(checkNonlocalAPIs([], [{name:'longjmp'}]).length);
assert(checkNonlocalAPIs([{file:'src/control.wat',src:'(func $handle__setjmp)'}], []).length);
console.log(JSON.stringify({sourceScopeOnly: true, controls: output, nonlocalLocksRejected: 2, controlsOnDisk: 'never mutated'}, null, 2));
