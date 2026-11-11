'use strict';

// Exercise the real build CLI/filesystem in a disposable repository. A tiny
// valid module replaces the expensive compiler; output routing is not mocked.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-build-outputs-'));
const wasm = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
try {
  fs.mkdirSync(path.join(root, 'tools'));
  fs.mkdirSync(path.join(root, 'build'));
  fs.copyFileSync(path.join(__dirname, '../tools/build-compile-wat.js'), path.join(root, 'tools/build-compile-wat.js'));
  fs.writeFileSync(path.join(root, 'tools/watx-closure.js'), `
    exports.watxSourceClosure = () => ({ entry: 'fixture' });
    exports.compileClosure = () => ({ success: true,
      wasmBinary: Buffer.from([0,97,115,109,1,0,0,0]) });
  `);
  fs.writeFileSync(path.join(root, 'tools/region-layout-hash.js'),
    'exports.appendSection = bytes => bytes; exports.layoutHash = () => "fixture";');
  fs.mkdirSync(path.join(root, 'lib'));
  fs.writeFileSync(path.join(root, 'lib/dispatch-trampoline.js'), 'exports.applyToVfs = vfs => vfs;');
  const shared = ['wine-assembly.wasm', 'wine-assembly.compat.wasm', 'wine-assembly.named.wasm'];
  shared.forEach(name => fs.writeFileSync(path.join(root, 'build', name), `shared:${name}`));
  function run(args, ok = true) {
    const result = spawnSync(process.execPath, [path.join(root, 'tools/build-compile-wat.js'), ...args], {
      encoding: 'utf8', timeout: 10000,
      env: {
        ...process.env,
        WINE_WAT_COMPILER: 'watx',
        WINE_WAT_NAMES: '',
        WINE_REGION_SHAKE: '',
        WINE_WAT_FRONTEND_REUSE: '0',
      },
    });
    if (ok) assert.strictEqual(result.status, 0, result.stdout + result.stderr);
    else assert.notStrictEqual(result.status, 0);
    return result;
  }
  function unchanged() {
    shared.forEach(name => assert.strictEqual(fs.readFileSync(path.join(root, 'build', name), 'utf8'), `shared:${name}`));
  }
  function emitted(name) { assert.deepStrictEqual(fs.readFileSync(path.join(root, name)), wasm); }
  run(['--out=scratch/probe.wasm', '--names']);
  ['scratch/probe.wasm', 'scratch/probe.compat.wasm', 'scratch/probe.named.wasm'].forEach(emitted);
  unchanged();
  run(['--out=scratch/probe.wasm']);
  assert(!fs.existsSync(path.join(root, 'scratch/probe.named.wasm')));
  unchanged();
  run([`--out=${path.join(root, 'absolute', 'probe')}`, '--names']);
  ['absolute/probe', 'absolute/probe.compat.wasm', 'absolute/probe.named.wasm'].forEach(emitted);
  unchanged();
  run(['--out=scratch/custom.wasm', '--compat-out=other/compat.wasm', '--named-out=names/nested/debug.wasm', '--names']);
  ['scratch/custom.wasm', 'other/compat.wasm', 'names/nested/debug.wasm'].forEach(emitted);
  unchanged();
  for (const flag of ['--compat-out=scratch/probe.wasm', '--named-out=scratch/probe.wasm']) {
    const result = run(['--out=scratch/probe.wasm', flag], false);
    assert.match(result.stderr, /must be distinct/);
  }
  unchanged();
  fs.mkdirSync(path.join(root, 'retained'));
  fs.mkdirSync(path.join(root, 'linked'));
  const linked = ['module.wasm', 'module.compat.wasm', 'module.named.wasm'];
  for (const name of linked) {
    const output = path.join(root, 'linked', name);
    fs.writeFileSync(output, `retained:${name}`, { mode: 0o600 });
    fs.linkSync(output, path.join(root, 'retained', name));
  }
  run(['--out=linked/module.wasm', '--names']);
  for (const name of linked) {
    emitted(`linked/${name}`);
    const retained = path.join(root, 'retained', name);
    const output = path.join(root, 'linked', name);
    assert.strictEqual(fs.readFileSync(retained, 'utf8'), `retained:${name}`,
      'publishing an artifact preserves its hard-linked retained copy');
    assert.notStrictEqual(fs.statSync(output).ino, fs.statSync(retained).ino);
    assert.strictEqual(fs.statSync(output).mode & 0o777, 0o600);
  }
  assert(!fs.readdirSync(path.join(root, 'linked')).some(name => name.startsWith('.wine-build-')));
  unchanged();
  fs.mkdirSync(path.join(root, 'failed', 'module.wasm'), { recursive: true });
  run(['--out=failed/module.wasm'], false);
  assert(fs.statSync(path.join(root, 'failed', 'module.wasm')).isDirectory());
  assert.deepStrictEqual(fs.readdirSync(path.join(root, 'failed')), ['module.wasm'],
    'failed publication removes its temporary directory');
  run(['--names']);
  shared.forEach(name => emitted(`build/${name}`));
  run([]);
  assert(!fs.existsSync(path.join(root, 'build/wine-assembly.named.wasm')));
  console.log('PASS build output isolation: scratch, absolute, overrides, cleanup, collisions, canonical defaults');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
