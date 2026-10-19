'use strict';
const fs = require('node:fs'), vm = require('node:vm'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const source = fs.readFileSync(require.resolve('./dungeon-siege-observer-plan'), 'utf8');
const root = '/candidate', ref = 'a'.repeat(40), data = Buffer.from('pinned source');
const blob = crypto.createHash('sha1').update('blob ' + data.length + '\0').update(data).digest('hex');
const files = new Map([
  [root + '/src/example.wat', data],
  [root + '/test/binaries/notepad.exe', fs.readFileSync('/tmp/wa-recovery-20261014/test/binaries/notepad.exe')],
  [root + '/test/binaries/dlls/msvcrt.dll', fs.readFileSync('/tmp/wa-recovery-20261014/test/binaries/dlls/msvcrt.dll')],
  [root + '/build/wine-assembly.wasm', Buffer.from('primary')],
  [root + '/build/wine-assembly.compat.wasm', Buffer.from('compat')],
  [root + '/node_modules/pngjs/package.json', Buffer.from('{"version":"test"}')],
  ['/tmp/wa-recovery-20261014/node_modules/pngjs/package.json', Buffer.from('{"version":"test"}')],
]);
const moduleMock = { exports: {} };
const req = name => name === 'node:fs' ? { readFileSync: p => { assert(files.has(p), 'Missing ' + p); return files.get(p); }, readdirSync: () => [{ name: 'package.json', isDirectory: () => false, isFile: () => true }] }
  : name === 'node:child_process' ? { execFileSync: (_, args) => args.includes('ls-tree') ? blob + ' src/example.wat\n' : ref + '\n' } : require(name);
const context = vm.createContext({ require: req, module: moduleMock, __dirname: root + '/tools', Buffer });
vm.runInContext(source, context);
const { prepare, verifyPlan, verifyQualification, sha } = moduleMock.exports;
const clone = x => vm.runInContext('JSON.parse', context)(JSON.stringify(x));
const plan = prepare(ref, root); verifyPlan(plan);
const omitted = clone(plan); omitted.files = omitted.files.slice(1); assert.throws(() => verifyPlan(omitted), /omitted/);
const relaxed = clone(plan); relaxed.limits.hardFloorBytes = 0; assert.throws(() => verifyPlan(relaxed));
files.set(root + '/src/example.wat', Buffer.from('changed')); assert.throws(() => verifyPlan(plan), /example/); files.set(root + '/src/example.wat', data);
const names = ['normal-build', 'observer-msvc-tail', 'observer-msvc-compat', 'reserved-sync-tail', 'reserved-sync-compat', 'reserved-page-cross-tail', 'reserved-page-cross-compat'];
const receipt = clone({ version: 1, plan, results: names.map(name => ({ name, code: 0, signal: null, reason: null, groupAbsent: true, changed: null, minFree: 3 * 1024 ** 3 })),
  modules: ['build/wine-assembly.wasm', 'build/wine-assembly.compat.wasm'].map(path => ({ path, sha256: sha(files.get(root + '/' + path)) })) });
verifyQualification(receipt, root);
for (const field of ['code', 'reason', 'groupAbsent', 'changed', 'minFree']) {
  const bad = clone(receipt); bad.results[2][field] = { code: 1, reason: 'guard', groupAbsent: false, changed: 'file', minFree: 1 }[field];
  assert.throws(() => verifyQualification(bad, root), /seven bounded/);
}
const incomplete = clone(receipt); incomplete.results.pop(); assert.throws(() => verifyQualification(incomplete, root));
const moduleMismatch = clone(receipt); moduleMismatch.modules[0].sha256 = '0'.repeat(64); assert.throws(() => verifyQualification(moduleMismatch, root), /wasm/);
assert.throws(() => verifyQualification(receipt, '/other'));
console.log('PASS observer source plan and qualification: exact tree, no omitted pins, fixed limits, immutable native fixtures, both module hashes and all seven clean terminal jobs required.');
