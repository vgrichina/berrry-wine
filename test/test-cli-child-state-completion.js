#!/usr/bin/env node
'use strict';

// Exercise the real CLI handback and export branch on synthetic VirtualFS
// state. No guest, browser, build, or external binary is started here.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const { createHash } = require('crypto');
const { VirtualFS } = require('../lib/filesystem');
const storage = require('../lib/storage');
const transport = require('../lib/vfs-export');
const { parseShellLaunchCommand } = require('../host');
const source = fs.readFileSync(process.env.CLI_SOURCE || path.join(__dirname, 'run.js'), 'utf8');
const mergeSource = source.match(/function mergeChildState\([^]*?\n}/)[0];
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-child-completion-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const put = (vfs, name, text) => {
  vfs.ensureParentDirs(name);
  vfs.files.set(vfs._resolvePath(name), { data: Buffer.from(text), attrs: 0x20 });
};
const state = vfs => [...vfs.files].map(([key, value]) => [key, Buffer.from(value.data).toString('hex')]).sort();
let serial = 0, passed = 0;
function fixture(count = 3) {
  const dir = path.join(root, String(++serial));
  fs.mkdirSync(dir);
  const vfs = new VirtualFS();
  for (let n = 0; n < count; n++) put(vfs, `c:\\system\\file${n}.ini`, `parent-${n}`);
  storage.clearStore();
  storage.importStore({ 'ini:completion:parent': 'keep until valid handback' });
  const before = new Map(transport.saveVfsToHost(vfs, path.join(dir, 'in')).map(row => [row.guestPath, row.outputPath]));
  const out = path.join(dir, 'out'), reg = path.join(dir, 'reg.json'), completion = path.join(dir, 'complete.json');
  const token = `specific-child-${serial}`;
  const context = { fs, ...transport, console: { log() {} } };
  vm.createContext(context);
  vm.runInContext(mergeSource, context);
  const child = new VirtualFS();
  for (const [key, value] of vfs.files) put(child, key, value.data);
  const childStore = { exportStore: () => ({ 'ini:completion:child': 'completed', 'reg:completion': '17' }) };
  return { vfs, child, before, dir, out, reg, completion, token, childStore,
    complete() { transport.saveCompletedChildState(child, childStore, out, reg, completion, token); },
    merge() { return context.mergeChildState(vfs, storage, before, out, reg, completion, token); },
  };
}
function unchanged(f, action, expectThrow = false) {
  const files = state(f.vfs), registry = storage.exportStore();
  let result;
  if (expectThrow) assert.throws(action, /ENOENT/);
  else result = action();
  assert.strictEqual(f.vfs.files.size, files.length, 'failed snapshot must preserve the parent file count');
  assert.deepStrictEqual(state(f.vfs), files, 'failed snapshot must preserve every parent file');
  assert.deepStrictEqual(storage.exportStore(), registry, 'failed snapshot must preserve registry/INI state');
  if (!expectThrow) assert.strictEqual(result.merged, false, 'incomplete snapshot must be rejected');
}
function check(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
try {
  check('203-file crash/kill absent-output regression uses actual CLI handback', () => {
    const f = fixture(203);
    unchanged(f, () => f.merge());
    assert.strictEqual(f.vfs.files.size, 203);
  });
  check('missing/partial root or registry without completion never deletes files', () => {
    for (const partial of ['empty-root', 'one-file', 'registry-only', 'partial-registry']) {
      const f = fixture();
      if (partial !== 'registry-only') fs.mkdirSync(f.out);
      if (partial === 'one-file') fs.writeFileSync(path.join(f.out, 'added'), 'partial');
      if (partial === 'registry-only') fs.writeFileSync(f.reg, JSON.stringify(f.childStore.exportStore()));
      if (partial === 'partial-registry') fs.writeFileSync(f.reg, '{"ini:broken":');
      unchanged(f, () => f.merge());
    }
  });
  check('complete unchanged/add/update/delete snapshot and coherent registry replacement', () => {
    const f = fixture();
    put(f.child, 'c:\\system\\file1.ini', 'changed');
    put(f.child, 'c:\\new\\added.ini', 'added');
    f.child.deleteFile('c:\\system\\file2.ini');
    f.complete();
    const result = f.merge();
    assert(result.merged);
    assert.strictEqual(result.written, 2);
    assert.strictEqual(result.deleted, 1);
    assert.deepStrictEqual(state(f.vfs), state(f.child));
    assert(!Object.hasOwn(storage.exportStore(), 'ini:completion:parent'));
    assert.strictEqual(storage.exportStore()['ini:completion:child'], 'completed');
  });
  check('complete unchanged tree does not rewrite files', () => {
    const f = fixture(); f.complete();
    const result = f.merge();
    assert(result.merged);
    assert.strictEqual(result.written, 0);
    assert.strictEqual(result.deleted, 0);
  });
  check('completed empty tree and empty registry are legitimate replacements', () => {
    const f = fixture();
    f.child.files.clear();
    f.childStore.exportStore = () => ({});
    f.complete();
    assert(fs.statSync(f.out).isDirectory());
    assert.strictEqual(f.merge().deleted, 3);
    assert.strictEqual(f.vfs.files.size, 0);
    assert(!Object.hasOwn(storage.exportStore(), 'ini:completion:parent'));
  });
  check('malformed/stale/wrong-version completion never applies', () => {
    for (const mutate of [() => '{', record => JSON.stringify({ ...record, token: 'another child' }),
      record => JSON.stringify({ ...record, version: 2 }), () => 'null',
      record => JSON.stringify({ ...record, treeHash: null })]) {
      const f = fixture(); f.complete();
      fs.writeFileSync(f.completion, mutate(JSON.parse(fs.readFileSync(f.completion))));
      unchanged(f, () => f.merge());
    }
  });
  check('changed/deleted/extra output, removed root and partial registry fail before apply', () => {
    const mutations = [
      f => fs.writeFileSync(path.join(f.out, 'system', 'file1.ini'), 'truncated'),
      f => fs.rmSync(path.join(f.out, 'system', 'file2.ini')),
      f => fs.writeFileSync(path.join(f.out, 'extra'), 'unexpected'),
      f => fs.rmSync(f.out, { recursive: true }),
      f => fs.writeFileSync(f.reg, '{'),
      f => fs.writeFileSync(f.reg, JSON.stringify({ 'ini:other': 'wrong snapshot' })),
      f => fs.rmSync(f.reg),
    ];
    for (const mutate of mutations) { const f = fixture(); f.complete(); mutate(f); unchanged(f, () => f.merge()); }
  });
  check('registry shape is checked even when its digest matches', () => {
    for (const value of [[], null, { 'ini:bad': {} }, { other: 'not a storage key' }]) {
      const f = fixture(); f.complete();
      const bytes = JSON.stringify(value), record = JSON.parse(fs.readFileSync(f.completion));
      fs.writeFileSync(f.reg, bytes);
      fs.writeFileSync(f.completion, JSON.stringify({ ...record, registryHash: hash(bytes) }));
      unchanged(f, () => f.merge());
    }
  });
  check('failed export never publishes completion, including failed retry', () => {
    const f = fixture();
    Object.defineProperty(f.child.files.get('c:\\system\\file1.ini'), 'data', { get() { throw Error('injected export failure'); } });
    assert.throws(() => f.complete(), /injected export failure/);
    assert(fs.existsSync(path.join(f.out, 'system', 'file0.ini')), 'failure occurred after a partial export');
    assert(!fs.existsSync(f.completion));
    unchanged(f, () => f.merge());
    const retry = fixture(); retry.complete();
    assert.throws(() => retry.complete(), /EEXIST/);
    assert(!fs.existsSync(retry.completion), 'old completion invalidated before failed retry');
    unchanged(retry, () => retry.merge());
  });
  check('registry write failure and interrupted completion publication never authorize handback', () => {
    for (const failAt of ['registry', 'completion']) {
      const f = fixture(), write = fs.writeFileSync, rename = fs.renameSync;
      try {
        fs.writeFileSync = function(file, ...args) {
          assert(!fs.existsSync(f.completion), 'completion must stay absent throughout both exports');
          if (failAt === 'registry' && file === f.reg) throw Error('injected registry write failure');
          return write.call(this, file, ...args);
        };
        fs.renameSync = function(from, to) {
          if (failAt === 'completion' && to === f.completion) throw Error('injected interruption before publication');
          return rename.call(this, from, to);
        };
        assert.throws(() => f.complete(), /injected/);
      } finally { fs.writeFileSync = write; fs.renameSync = rename; }
      assert(!fs.existsSync(f.completion));
      unchanged(f, () => f.merge());
    }
  });
  check('symlinks and unsafe/ambiguous paths never apply', () => {
    for (const mutate of [
      f => fs.symlinkSync(f.reg, path.join(f.out, 'link')),
      f => { fs.rmSync(f.reg); fs.symlinkSync(f.completion, f.reg); },
      f => { fs.rmSync(f.out, { recursive: true }); fs.symlinkSync(path.join(f.dir, 'in'), f.out); },
      f => fs.writeFileSync(path.join(f.out, 'bad\\escape'), 'bad'),
      f => fs.writeFileSync(path.join(f.out, 'bad:drive'), 'bad'),
      f => fs.writeFileSync(path.join(f.out, 'system', 'FILE0.INI'), 'ambiguous'),
    ]) { const f = fixture(); f.complete(); mutate(f); unchanged(f, () => f.merge()); }
    const f = fixture();
    put(f.child, 'c:\\safe.ini', 'safe');
    f.child.files.set('c:\\..\\escaped', { data: Buffer.from('bad') });
    assert.throws(() => f.complete(), /unsafe child export path/);
    assert(!fs.existsSync(path.join(f.dir, 'escaped')));
  });
  check('read errors after earlier changed files are staged never partially apply', () => {
    const f = fixture();
    put(f.child, 'c:\\system\\file0.ini', 'would change');
    f.complete();
    const read = fs.readFileSync;
    try {
      fs.readFileSync = function(file, ...args) {
        if (file === path.join(f.out, 'system', 'file2.ini')) throw Error('injected later read failure');
        return read.call(this, file, ...args);
      };
      unchanged(f, () => f.merge());
    } finally { fs.readFileSync = read; }
    fs.rmSync(f.before.get('c:\\system\\file2.ini'));
    unchanged(f, () => f.merge(), true);
  });
  check('actual child export branch finishes both exports before publishing', () => {
    const f = fixture();
    put(f.child, 'c:\\app.exe', 'ordinary child executable must survive');
    const start = source.lastIndexOf('  if (CHILD_STATE_COMPLETION) {');
    const end = source.indexOf('  } else if (SAVE_VFS', start);
    assert(start > source.indexOf('if (REG_EXPORT && !CHILD_STATE_COMPLETION)'));
    const context = { CHILD_STATE_COMPLETION: f.completion, CHILD_STATE_TOKEN: f.token,
      SPAWNED_CHILD: true, SAVE_VFS: f.out, REG_EXPORT: f.reg, ctx: { vfs: f.child },
      saveCompletedChildState: transport.saveCompletedChildState,
      require: name => { assert.strictEqual(name, '../lib/storage'); return f.childStore; } };
    vm.runInNewContext(source.slice(start, end) + '\n}', context);
    assert(f.merge().merged);
    assert.deepStrictEqual(state(f.vfs), state(f.child));
  });
  check('actual spawn exit callback requires its own completion; valid guest nonzero survives', () => {
    for (const complete of [false, true]) {
      const vfs = new VirtualFS(); put(vfs, 'c:\\app.exe', 'synthetic only');
      storage.clearStore(); storage.importStore({ 'ini:completion:parent': 'initial' });
      let launched;
      const recs = new Map();
      const context = { fs, path, console: { log() {} }, ...transport,
        ctx: { vfs }, SPAWN_PROCESSES_FLAG: true, APP_ENTRY: null, ASSET_ENTRY: null,
        EXE_GUEST_PATH: 'c:\\app.exe', DLL_SEED: [], PIPE_CHILD_ARGS: [], WASM_PATH: 'never-loaded', MAX_SECONDS: 1,
        parseShellLaunchCommand, appAsset: value => value, childCodePageArgs: () => [], startupShowArgs: () => [],
        ThreadManager: { namedEventEnvironment: () => ({}) }, nextChildPid: () => 0x4004,
        relayChild() {}, pipeChildren: [], livePipeChildren: new Set(), pipeChildByPid: recs,
        process: { on() {} }, __filename: 'never-executed',
        require(name) {
          if (name === 'os') return { tmpdir: () => root };
          if (name === '../lib/storage') return storage;
          if (name === 'crypto') return require('crypto');
          assert.strictEqual(name, 'child_process');
          return { fork(file, args) { const child = new EventEmitter(); launched = { child, args }; return child; } };
        },
      };
      vm.createContext(context);
      const start = source.indexOf('  const spawnVfsChild =');
      const end = source.indexOf('  h.process_spawn =', start);
      vm.runInContext(mergeSource + '\n' + source.slice(start, end) + '\nthis.spawn = spawnVfsChild;', context);
      const priorFiles = state(vfs), priorRegistry = storage.exportStore();
      assert.strictEqual(context.spawn('c:\\app.exe', 'c:\\'), 0x4004);
      const arg = key => launched.args.find(value => value.startsWith(`--${key}=`)).slice(key.length + 3);
      assert.match(arg('child-state-token'), /^[a-f0-9]{64}$/);
      if (complete) {
        const childVfs = new VirtualFS(); put(childVfs, 'c:\\app.exe', 'changed'); put(childVfs, 'c:\\new.ini', 'added');
        transport.saveCompletedChildState(childVfs, { exportStore: () => ({ 'ini:child:exit': '17' }) },
          arg('save-vfs'), arg('reg-export'), arg('child-state-completion'), arg('child-state-token'));
      }
      launched.child.emit('message', { t: 'child-exit', code: 17 });
      assert.strictEqual(recs.get(0x4004).exitCode, 259, 'IPC does not release parent wait before handback');
      launched.child.emit('exit', 0);
      assert.strictEqual(recs.get(0x4004).exitCode, 17);
      assert(recs.get(0x4004).exited);
      assert(!fs.existsSync(path.dirname(arg('save-vfs'))), 'transport cleans its own snapshot');
      if (complete) {
        assert.strictEqual(Buffer.from(vfs.files.get('c:\\app.exe').data).toString(), 'changed');
        assert.strictEqual(storage.exportStore()['ini:child:exit'], '17');
      } else {
        assert.deepStrictEqual(state(vfs), priorFiles, 'host exit zero alone is not completion');
        assert.deepStrictEqual(storage.exportStore(), priorRegistry);
      }
    }
  });
  console.log(`PASS ${passed} child-state completion regressions`);
} finally {
  storage.clearStore();
  fs.rmSync(root, { recursive: true, force: true });
}
