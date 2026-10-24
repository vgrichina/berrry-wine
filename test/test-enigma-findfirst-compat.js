'use strict';
// Unit: retained source only. Never executes the historical runner or a guest.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const adapter = require('../tools/enigma-findfirst-compat.cjs');
const evidence = path.join(__dirname, '../docs/re-notes/enigma-historical-findfirst-compat-20261024-evidence');
const historical = zlib.gunzipSync(fs.readFileSync(path.join(evidence, 'historical-filesystem.js.gz'))).toString();
const runner = zlib.gunzipSync(fs.readFileSync(path.join(evidence, 'historical-run.js.gz'))).toString();
const accepted = fs.readFileSync(path.join(__dirname, '../lib/filesystem.js'), 'utf8');
adapter.check(runner, 'runner');
const adapted = adapter.transform(historical, accepted);
assert.equal(adapted, accepted, 'complete actual source, with only accepted matcher replacement');
for (const [name, source] of [['missing', historical.replace('    const matchPat', '    const missingPat')], ['duplicate', historical + historical], ['wrong', historical + '\n']]) {
  assert.throws(() => adapter.transform(source, accepted), /identity/, name);
}
assert.throws(() => adapter.transform(historical, accepted + '\n'), /accepted identity/);
const start = "    const matchPat = pat === '*.*' ? '*' : pat;\n";
const end = '\n    const collect = (searchDir) => {';
for (const anchor of [start, end]) {
  assert.throws(() => adapter.matcherSpan(historical.replace(anchor, '')), /anchor/);
  assert.throws(() => adapter.matcherSpan(historical + anchor), /anchor/);
}
assert.throws(() => adapter.matcherSpan(end + start), /anchor order/);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'enigma-findfirst-test-'));
const receipts = [];
function child(name, args, extraEnv = {}, expected = 0, reason) {
  const memAvailable = Number(/^MemAvailable:\s+(\d+)/m.exec(fs.readFileSync('/proc/meminfo', 'utf8'))[1]) * 1024;
  assert(memAvailable >= 805306368, 'fresh memory admission');
  const env = { ...process.env };
  delete env.ENIGMA_RUNNER_ROOT; delete env.ENIGMA_FINDFIRST_RUNNER_ROOT;
  const p = spawnSync(process.execPath, ['--max-old-space-size=256', ...args], {
    env: { ...env, ...extraEnv }, encoding: 'utf8', timeout: 60000, maxBuffer: 65536,
  });
  receipts.push({ name, command: [process.execPath, '--max-old-space-size=256', ...args], env: extraEnv, memAvailable, status: p.status, stdout: p.stdout, stderr: p.stderr });
  assert.ifError(p.error);
  if (expected === 0) assert.equal(p.status, 0, name + ': ' + p.stderr);
  else { assert.notEqual(p.status, 0, name); assert.match(p.stderr, reason, name); }
  return p;
}
try {
  fs.mkdirSync(path.join(root, 'lib')); fs.mkdirSync(path.join(root, 'test'));
  for (const name of ['mem-utils.js', 'region-map.generated.js', 'byte-provider.js']) {
    fs.writeFileSync(path.join(root, 'lib', name), zlib.gunzipSync(fs.readFileSync(path.join(evidence, name + '.gz'))));
  }
  const fsPath = path.join(root, 'lib/filesystem.js');
  const runPath = path.join(root, 'test/run.js');
  fs.writeFileSync(fsPath, historical); fs.writeFileSync(runPath, runner);
  const oracle = path.join(__dirname, 'test-vfs-findfirst-literals.js');
  const preload = path.join(__dirname, '../tools/enigma-findfirst-compat.cjs');
  const quiet = path.join(__dirname, '../tools/enigma-quiet-filesystem.cjs');
  const env = { ENIGMA_FINDFIRST_RUNNER_ROOT: root };
  child('baseline literal rejection', [oracle, fsPath], {}, 1, /SyntaxError.*regular expression/);
  child('disabled passthrough', ['-r', preload, '-e', ''], {}, 1, /must be absolute/);
  // Ordinary import without environment never installs the diagnostic.
  child('disabled ordinary import', ['-e', `const M=require('module'),a=M.prototype._compile;require(${JSON.stringify(preload)});require('assert/strict').equal(M.prototype._compile,a);`]);
  child('adapted actual historical VFS literal regression', ['-r', preload, oracle, fsPath], env);
  child('supported composition actual VFS', ['-r', preload, '-r', quiet, oracle, fsPath], { ...env, ENIGMA_RUNNER_ROOT: root });
  const reject = child('reverse composition rejected before entry', ['-r', quiet, '-r', preload, '-e', 'console.log("ENTRY_SENTINEL")'], { ...env, ENIGMA_RUNNER_ROOT: root }, 1, /preload order/);
  assert(!reject.stdout.includes('ENTRY_SENTINEL'));
  // Capture transformed runner source at the compiler boundary, without executing it.
  const quietHash = adapter.sha256(fs.readFileSync(quiet));
  assert.equal(quietHash, 'cc9bb22fb39058b581883f836724f7a62eaf8dfbe2d2e42f3cd765f3abd8741e');
  const compiled = [];
  const original = Module.prototype._compile;
  const oldFF = process.env.ENIGMA_FINDFIRST_RUNNER_ROOT, oldQuiet = process.env.ENIGMA_RUNNER_ROOT;
  try {
    Module.prototype._compile = function(source, file) { compiled.push({ source, file }); };
    adapter.install(root);
    // Already imported quiet module is excluded by install's order gate; load only after install.
    const quietModule = new Module(quiet, module);
    original.call(quietModule, fs.readFileSync(quiet, 'utf8'), quiet);
    quietModule.exports.install(root);
    new Module(runPath)._compile(runner, runPath);
    new Module(fsPath)._compile(historical, fsPath);
    assert.equal(compiled[0].source, quietModule.exports.transform(runner));
    assert.equal(compiled[1].source, adapted);
  } finally {
    Module.prototype._compile = original;
    if (oldFF === undefined) delete process.env.ENIGMA_FINDFIRST_RUNNER_ROOT; else process.env.ENIGMA_FINDFIRST_RUNNER_ROOT = oldFF;
    if (oldQuiet === undefined) delete process.env.ENIGMA_RUNNER_ROOT; else process.env.ENIGMA_RUNNER_ROOT = oldQuiet;
  }
  const actual = new Module(fsPath, module);
  actual.filename = fsPath;
  actual.paths = Module._nodeModulePaths(path.dirname(fsPath));
  actual._compile(adapted, fsPath);
  const vfs = new actual.exports.VirtualFS();
  vfs.cwd = 'c:\\game';
  vfs.setLazyFile('c:\\game\\+index_user.txt', { size: 123, load() { throw Error('data read'); } });
  const first = vfs.findFirstFile('+index_user.txt');
  assert.equal(first.entry.size, 123); assert.equal(first.entry.attrs, 0x20);
  assert(first.entry.creationTime); assert.equal(vfs.findClose(first.handle), true);
  const span = adapter.matcherSpan(adapted);
  const mutation = adapted.slice(0, span.from) + span.text.replace(" + '$', 'i');", " + '', 'i');") + adapted.slice(span.to);
  assert.notEqual(mutation, adapted);
  fs.writeFileSync(path.join(root, 'lib/mutated.js'), mutation);
  child('real adapted source end-anchor mutation rejected by unchanged oracle', [oracle, path.join(root, 'lib/mutated.js')], {}, 1, /AssertionError/);
  fs.writeFileSync(runPath, runner + '\n');
  child('wrong runner identity rejected before entry', ['-r', preload, '-e', 'console.log("ENTRY_SENTINEL")'], env, 1, /runner identity/);
  fs.writeFileSync(runPath, runner); fs.writeFileSync(fsPath, historical + '\n');
  child('wrong filesystem identity rejected before entry', ['-r', preload, '-e', 'console.log("ENTRY_SENTINEL")'], env, 1, /historical identity/);
  assert.equal(require('../tools/test-tiers.js').classifyTest('test-enigma-findfirst-compat.js'), 'unit');
  console.log(JSON.stringify({ pass: true, sourceHashes: { historical: adapter.sha256(historical), adapted: adapter.sha256(adapted), runner: adapter.sha256(runner), quiet: quietHash }, checks: receipts }, null, 2));
} finally { fs.rmSync(root, { recursive: true, force: true }); }
