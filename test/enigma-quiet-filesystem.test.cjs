'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const adapter = require('../tools/enigma-quiet-filesystem.cjs');
const current = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
const filesystem = fs.readFileSync(path.join(__dirname, '../lib/filesystem.js'), 'utf8');
adapter.check(filesystem, 'lib/filesystem.js');

// Execute the real filesystem module in its supported browser export mode.
// A small host ArrayBuffer suffices: no WASM, guest, providers or build.
function readMany(debug, trace, count) {
  const lines = [];
  const context = { module: { exports: {} }, RegionMap: { BASE: { VIRTUAL_BACKING_BASE: 0x08000000 } }, window: {
    memUtils: {},
  }, console: { log: line => lines.push(line) } };
  vm.runInNewContext(filesystem, context, { filename: 'lib/filesystem.js' });
  const { VirtualFS, createFilesystemImports } = context.module.exports;
  const vfs = new VirtualFS();
  const handle = vfs.createFile('C:\\gfx32\\fl-concrete.png', 0xc0000000, 2);
  assert(handle);
  assert(vfs.writeFile(handle, new Uint8Array([3, 5, 8]), 3));
  const memory = new ArrayBuffer(4096);
  const imports = createFilesystemImports({ vfs, getMemory: () => memory,
    _debugReadFile: debug, trace: new Set(trace ? ['fs'] : []) });
  for (let i = 0; i < count; i++) {
    vfs.setFilePointer(handle, 0, 0);
    assert.equal(imports.fs_read_file_result(handle, 128, 3, 64), 0);
    assert.equal(new DataView(memory).getUint32(64, true), 3);
    assert.deepEqual([...new Uint8Array(memory, 128, 3)], [3, 5, 8]);
  }
  assert.equal(imports.fs_read_file_result(0, 128, 3, 64), 6);
  return lines;
}
function runnerDebug(source, quiet) {
  const values = [...source.matchAll(/_debugReadFile: ([^,\n]+),/g)].map(match =>
    vm.runInNewContext(match[1], { TRACE_API: true, QUIET_FS: quiet }));
  assert.equal(values.length, 2, 'main and process-scoped contexts');
  assert.equal(values[0], values[1]);
  return values[0];
}
assert(current.includes("const QUIET_FS = hasFlag('quiet-fs');"));
assert.equal(runnerDebug(current, false), true);
assert.equal(runnerDebug(current, true), false);
const noisy = readMany(runnerDebug(current, false), false, 2000);
const quiet = readMany(runnerDebug(current, true), false, 2000);
const explicit = readMany(runnerDebug(current, true), true, 2);
assert(Buffer.byteLength(noisy.join('\n')) > 131072, 'reproduce guard-exhausting category');
assert.equal(quiet.length, 0);
assert.equal(explicit.length, 2);
assert(explicit.every(line => line.startsWith('[FS] ReadFile(')));
assert.throws(() => adapter.transform(current), /source identity/, 'current main is not historical runner');
assert.throws(() => adapter.check(filesystem + ' ', 'lib/filesystem.js'), /source identity/);

let historical = 'not supplied';
if (process.env.ENIGMA_CANONICAL_RUNNER) {
  const root = path.resolve(process.env.ENIGMA_CANONICAL_RUNNER);
  const original = fs.readFileSync(path.join(root, 'test/run.js'), 'utf8');
  const adapted = adapter.transform(original);
  assert.equal(runnerDebug(adapted, false), false);
  assert.equal(readMany(runnerDebug(adapted, false), false, 2000).length, 0);
  assert.equal(readMany(runnerDebug(adapted, false), true, 2).length, 2);
  assert(adapted.includes('if(diagnosticRecords++ >= 16) return;'));
  assert(adapted.includes('if (diagnosticRecords < 16 && TRACE_API'));
  const apiStart = adapted.indexOf('  let diagnosticRecords=0;');
  const apiEnd = adapted.indexOf('  let inputEvent = null;', apiStart);
  assert(apiStart >= 0 && apiEnd > apiStart);
  const apiContext = { logs: [], TRACE_API_DEDUP: false };
  vm.runInNewContext(adapted.slice(apiStart, apiEnd) +
    '\nfor(let i=0;i<40;i++) pushApi("API " + i);', apiContext);
  assert.equal(apiContext.logs.length, 16, 'original API cap retained');
  assert.throws(() => adapter.transform(original + ' '), /source identity/);
  const child = spawnSync(process.execPath, ['--max-old-space-size=256',
    '--require=' + path.join(__dirname, '../tools/enigma-quiet-filesystem.cjs'), '-e',
    'console.log("fatal API SDL_getenv"); console.error("UNIMPLEMENTED"); throw Error("OUTPUT GUARD 131072")'],
  { env: { ...process.env, ENIGMA_RUNNER_ROOT: root }, encoding: 'utf8', timeout: 5000, maxBuffer: 8192 });
  assert.equal(child.status, 1);
  assert(child.stdout.includes('fatal API SDL_getenv'));
  assert(child.stderr.includes('UNIMPLEMENTED'));
  assert(child.stderr.includes('OUTPUT GUARD 131072'));
  const missingEnv = { ...process.env }; delete missingEnv.ENIGMA_RUNNER_ROOT;
  const missing = spawnSync(process.execPath, ['--max-old-space-size=256',
    '--require=' + path.join(__dirname, '../tools/enigma-quiet-filesystem.cjs'), '-e', 'process.exit(0)'],
  { env: missingEnv, encoding: 'utf8', timeout: 5000, maxBuffer: 8192 });
  assert.equal(missing.status, 1);
  assert(missing.stderr.includes('ENIGMA_RUNNER_ROOT'));
  const compile = Module.prototype._compile;
  const log = console.log, error = console.error;
  try {
    adapter.install(root);
    assert.equal(console.log, log);
    assert.equal(console.error, error);
    assert.throws(() => new Module(path.join(root, 'test/run.js'))._compile(original + ' ',
      path.join(root, 'test/run.js')), /source identity/);
    assert.throws(() => new Module(path.join(root, 'lib/filesystem.js'))._compile(filesystem + ' ',
      path.join(root, 'lib/filesystem.js')), /source identity/);
    // Actual installed hook forwards unrelated API/fatal/guard code unchanged.
    for (const message of ['fatal API SDL_getenv', 'UNIMPLEMENTED', 'OUTPUT GUARD 131072']) {
      assert.throws(() => new Module('/tmp/enigma-fatal-control.cjs')._compile(
        `throw new Error(${JSON.stringify(message)})`, '/tmp/enigma-fatal-control.cjs'),
      e => e.message === message);
    }
  } finally { Module.prototype._compile = compile; }
  historical = 'pinned source accepted; wrong runner/filesystem and current main rejected; installed hook preserves fatal exceptions';
}
console.log(JSON.stringify({ pass: true, noisyReads: 2000, noisyBytes: Buffer.byteLength(noisy.join('\n')),
  quietReads: 2000, quietBytes: 0, explicitTraceRecords: explicit.length, historical,
  scope: 'real filesystem imports with 4KiB host memory; no guest or WASM' }));
