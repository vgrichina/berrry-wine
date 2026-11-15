'use strict';
// Host-only contract against the actual spawnVfsChild closure. No wasm,
// original image, Worker, native child or media provider is executed here.
// This supplements (and cannot replace) ordinary generated DllMain/NE controls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { saveVfsToHost } = require('../lib/vfs-export');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'test/run.js'), 'utf8');
const start = source.indexOf('  const spawnVfsChild = ');
const end = source.indexOf('\n  h.process_spawn = ', start);
assert(start > 0 && end > start, 'actual ordinary child closure must be found');
let closure = source.slice(start, end);

function observe(mounts, { resident = false, deleted = false } = {}) {
  const temporary = [], calls = [], skipped = [];
  let mediaReads = 0;
  const provider = { _provider: {}, get data() { mediaReads++; throw Error('unrelated lazy media read'); } };
  const vfs = {
    dirs: new Set(['c:', 'c:\\']),
    files: new Map([['c:\\child.exe', { data: Buffer.from('generated-placeholder') }],
      ['c:\\windows\\system\\bootstrap.dat', provider], ['d:\\unrelated.cab', provider]]),
    getCurrentDirectory: () => 'c:\\parent-working-directory',
    _resolvePath: name => path.win32.normalize(name).toLowerCase(),
  };
  if (resident) vfs.files.set('c:\\windows\\system\\bootstrap.dat', { data: Buffer.from('native modified state') });
  if (deleted) vfs.files.delete('c:\\windows\\system\\bootstrap.dat');
  const wrappedFs = Object.create(fs);
  wrappedFs.mkdtempSync = prefix => { const dir = fs.mkdtempSync(prefix); temporary.push(dir); return dir; };
  const fakeRequire = name => {
    if (name === 'child_process') return { fork(file, args, options) {
      const child = new EventEmitter(); child.kill = () => {};
      const mountBytes = args.filter(arg => arg.startsWith('--vfs-mount=')).map(arg => {
        const host = arg.slice('--vfs-mount='.length, arg.lastIndexOf('='));
        return fs.existsSync(host) ? fs.readFileSync(host).toString() : null;
      });
      calls.push({ file, args, options, mountBytes }); return child;
    } };
    if (name === '../lib/storage') return { exportStore: () => ({}) };
    return require(name);
  };
  const sandbox = { fs: wrappedFs, path, require: fakeRequire, __filename: path.join(root, 'test/run.js'),
    console: { log() {} }, process: { on() {} }, ctx: { vfs },
    SPAWN_PROCESSES_FLAG: true, APP_ENTRY: null, ASSET_ENTRY: null, DLL_SEED: [],
    EXE_GUEST_PATH: 'c:\\parent.exe', VFS_MOUNT: mounts,
    appAsset: name => path.isAbsolute(name) ? name : path.join(root, name),
    parseShellLaunchCommand: () => ({ file: 'c:\\child.exe', params: '' }),
    saveVfsToHost: (v, dir) => saveVfsToHost(v, dir, { log: line => skipped.push(line) }),
    childDllSeedPath: () => { throw Error('unexpected DLL seed'); },
    WASM_PATH: '/unused/module.wasm', MAX_SECONDS: 12, PIPE_CHILD_ARGS: [],
    childCodePageArgs: () => [], startupShowArgs: () => [],
    processDesktop: { environment: () => ({}) }, ThreadManager: { namedEventEnvironment: () => ({}) },
    nextChildPid: () => 0x4004, relayChild() {}, pipeChildren: [], livePipeChildren: new Set(),
    pipeChildByPid: new Map(), mergeChildState() {},
  };
  try {
    vm.runInNewContext(closure + '\nspawnVfsChild("child.exe", "c:\\\\different-child-cwd");', sandbox);
    assert.equal(calls.length, 1);
    assert.equal(mediaReads, 0, 'ordinary export must never materialize unrelated media');
    assert(skipped.some(line => line.includes('d:\\unrelated.cab')));
    assert(resident || !fs.existsSync(path.join(temporary[0], 'in', 'windows', 'system', 'bootstrap.dat')),
      'explicit lazy entry remains excluded from writable snapshot');
    if (resident) assert.deepEqual(Array.from(calls[0].mountBytes), ['native modified state'], 'initializer mount uses native writable bytes');
    return calls[0].args;
  } finally {
    for (const dir of temporary) fs.rmSync(dir, { recursive: true, force: true });
  }
}

const relative = 'test/fixtures/resolved-system-input.dat';
const guest = 'C:\\Windows\\System\\bootstrap.dat';
const args = observe([relative + '=' + guest]);
const actual = args.filter(arg => arg.startsWith('--vfs-mount='));

  assert.deepEqual(Array.from(actual), ['--vfs-mount=' + path.join(root, relative) + '=' + guest],
    'child must receive the parent-resolved explicit file, before initializer startup');
  assert.deepEqual(Array.from(observe([]).filter(arg => arg.startsWith('--vfs-mount='))), []);
  const duplicate = observe(['/first.dat=' + guest, '/last.dat=' + guest]);
  assert.deepEqual(Array.from(duplicate.filter(arg => arg.startsWith('--vfs-mount='))),
    ['--vfs-mount=/first.dat=' + guest, '--vfs-mount=/last.dat=' + guest], 'last explicit mount keeps precedence');
  const nested = observe(actual.map(arg => arg.slice('--vfs-mount='.length)));
  assert.deepEqual(Array.from(nested.filter(arg => arg.startsWith('--vfs-mount='))), Array.from(actual),
    'a nested child receives the same resolved explicit file identity');
  observe([relative + '=' + guest], { resident: true });
  assert.deepEqual(Array.from(observe([relative + '=' + guest], { deleted: true })
    .filter(arg => arg.startsWith('--vfs-mount='))), [], 'deleted native input is not resurrected');
  const relativeGuest = observe([relative + '=windows\\system\\bootstrap.dat']);
  assert.equal(relativeGuest.filter(arg => arg.startsWith('--vfs-mount=')).length, 1,
    'relative installed guest names keep the mount C: root, not child cwd');
  console.log('PASS actual ordinary child args' +
    ': resolved paths, precedence, nested arguments, lazy exclusion');
