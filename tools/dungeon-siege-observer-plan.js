'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const git = (root, args) => cp.execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const limits = Object.freeze({ admissionBytes: 2986344448, hardFloorBytes: 2214592512, evidenceBytes: 32 * 1024 ** 2, buildGrowthBytes: 128 * 1024 ** 2, logBytes: 4 * 1024 ** 2, pollMs: 250, jobMs: 180000 });
const selected = f => /^(src|lib|tools|data)\//.test(f.path) || /^test\/.*\.js$/.test(f.path) || ['fonts/Terminal.fon', 'test/run-all.sh', 'host.js', 'package.json', 'package-lock.json', 'CLAUDE.md', 'index.html', 'docs/dos-corpus/live/toyvm-bundle.js', 'docs/dos-corpus/live/toyvm-jit-bundle.js'].includes(f.path);
function dependencyFiles(root, dir = 'node_modules/pngjs') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = dir + '/' + entry.name;
    if (entry.isDirectory()) files.push(...dependencyFiles(root, relative));
    else { assert(entry.isFile(), 'Only ordinary dependency files are accepted'); files.push({ path: relative, sha256: sha(fs.readFileSync(path.join(root, relative))) }); }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
function verifyPlan(plan) {
  assert.equal(plan.version, 1); assert.deepEqual(plan.limits, limits);
  assert(/^[0-9a-f]{40}$/.test(plan.source)); assert(path.isAbsolute(plan.root));
  assert.equal(git(plan.root, ['rev-parse', plan.source]), plan.source);
  const source = git(plan.root, ['ls-tree', '-r', '--format=%(objectname) %(path)', plan.source]).split('\n')
    .map(line => ({ blob: line.slice(0, 40), path: line.slice(41) }))
    .filter(selected);
  assert.deepEqual(plan.files, source, 'Plan must pin the complete selected source tree, no omitted files');
  for (const f of source) {
    const bytes = fs.readFileSync(path.join(plan.root, f.path));
    assert.equal(crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex'), f.blob, f.path);
  }
  for (const f of plan.fixtures) assert.equal(sha(fs.readFileSync(path.join(plan.root, f.path))), f.sha256, f.path);
  assert.deepEqual(plan.fixtures.map(f => f.path), ['test/binaries/notepad.exe', 'test/binaries/dlls/msvcrt.dll']);
  assert.equal(plan.fixtures[0].sha256, 'e7b01ab85a35ba6f577067d13efa522dc3d605de7712340e4acaf7065f866340');
  assert.equal(plan.fixtures[1].sha256, '887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1');
  assert(plan.dependencies.length > 0); assert.deepEqual(dependencyFiles(plan.root), plan.dependencies, 'Exact pngjs dependency closure required');
}
function prepare(source, root) {
  const repository = path.join(__dirname, '..');
  source = git(repository, ['rev-parse', source]);
  const files = git(repository, ['ls-tree', '-r', '--format=%(objectname) %(path)', source]).split('\n')
    .map(line => ({ blob: line.slice(0, 40), path: line.slice(41) }))
    .filter(selected);
  return { version: 1, root: path.resolve(root), source, limits, files,
    dependencyProvenance: '/tmp/wa-recovery-20261014/node_modules/pngjs (existing held local runtime package)',
    dependencies: dependencyFiles('/tmp/wa-recovery-20261014'), fixtures: [
    { path: 'test/binaries/notepad.exe', sha256: 'e7b01ab85a35ba6f577067d13efa522dc3d605de7712340e4acaf7065f866340' },
    { path: 'test/binaries/dlls/msvcrt.dll', sha256: '887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1' },
  ] };
}
function verifyQualification(receipt, root) {
  assert.equal(receipt.version, 1); assert.equal(receipt.plan.root, root); verifyPlan(receipt.plan);
  assert.deepEqual(receipt.results.map(r => r.name), ['normal-build', 'observer-msvc-tail', 'observer-msvc-compat', 'reserved-sync-tail', 'reserved-sync-compat', 'reserved-page-cross-tail', 'reserved-page-cross-compat']);
  for (const r of receipt.results) assert(r.code === 0 && !r.signal && !r.reason && r.groupAbsent === true && r.changed === null && r.minFree > limits.hardFloorBytes, 'All seven bounded jobs must have passed');
  assert.deepEqual(receipt.modules.map(m => m.path), ['build/wine-assembly.wasm', 'build/wine-assembly.compat.wasm']);
  for (const m of receipt.modules) assert.equal(sha(fs.readFileSync(path.join(root, m.path))), m.sha256, m.path);
  return receipt;
}
if (require.main === module) {
  assert.equal(process.argv.length, 5, 'SOURCE_REF ROOT PLAN_FILE (source preparation only)');
  fs.writeFileSync(process.argv[4], JSON.stringify(prepare(process.argv[2], process.argv[3]), null, 2) + '\n', { flag: 'wx' });
}
module.exports = { verifyPlan, verifyQualification, prepare, limits, sha };
