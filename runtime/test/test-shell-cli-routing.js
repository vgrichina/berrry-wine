#!/usr/bin/env node
'use strict';

// Execute the CLI's installed shell callback and its real VFS transport without
// booting a guest. Only the OS fork boundary is substituted; snapshot export,
// command parsing, child records, merge ordering and cleanup are production code.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const { parseShellLaunchCommand, resolveShellLaunchPath } = require('../host');
const { saveVfsToHost, mergeVfsTreeBack } = require('../lib/vfs-export');

const sourcePath = process.env.CLI_SOURCE || path.join(__dirname, 'run.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const body = source.slice(source.indexOf('  let capturedLaunch = null;'),
  source.indexOf('  h.process_spawn = (cmdWa'));
assert(body.includes('const spawnVfsChild ='), 'extract actual CLI shell and transport together');
const merge = source.slice(source.indexOf('function mergeChildState('),
  source.indexOf('\nconst {\n  decodeMfcCString'));
const imports = fs.readFileSync(path.join(__dirname, '../lib/host-imports.js'), 'utf8');
const baseShell = imports.slice(imports.indexOf('    shell_execute: ('),
  imports.indexOf('    notify_icon: ('));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-cli-test-'));

function fixture({ spawn = true, appSpawn = false, capture = false, fail = false, exportFail = false } = {}) {
  const exe = 'c:\\program files\\fixture\\child._mp';
  const cwd = 'c:\\work';
  const vfs = {
    files: new Map([[exe, { data: Buffer.from('offline fixture, never executed') }]]),
    dirs: new Set(['c:', cwd]),
    getCurrentDirectory: () => cwd,
    _resolvePath: p => path.win32.resolve(cwd, p).toLowerCase(),
  };
  let fileHandle;
  vfs.createFile = p => (fileHandle = p, 1);
  vfs.writeFile = (h, data) => vfs.files.set(fileHandle, { data });
  vfs.closeHandle = () => {};
  vfs.deleteFile = p => vfs.files.delete(p);
  const forks = [], hooks = [], logs = [], strings = new Map();
  let next = 1, baseCalls = 0;
  const put = text => text ? (strings.set(next, text), next++) : 0;
  const storage = { exportStore: () => ({}), clearStore() {}, importStore: () => 0 };
  const h = {};
  const context = {
    h, ctx: { vfs }, logs, readStr: p => strings.get(p),
    CAPTURE_LAUNCH: capture, SPAWN_PROCESSES_FLAG: spawn,
    APP_ENTRY: appSpawn ? { spawnProcesses: true } : null,
    EXE_GUEST_PATH: 'c:\\parent.exe', ASSET_ENTRY: null, DLL_SEED: [],
    PIPE_CHILD_ARGS: [], WASM_PATH: 'unused.wasm', MAX_SECONDS: 1,
    threadSnapshotSystemIncomplete: false,
    path, fs, parseShellLaunchCommand, resolveShellLaunchPath,
    saveVfsToHost: (...args) => {
      const rows = saveVfsToHost(...args);
      if (exportFail) throw new Error('injected snapshot write failure');
      return rows;
    },
    mergeVfsTreeBack,
    startupShowArgs: n => [`--startup-show=${n}`],
    ThreadManager: { namedEventEnvironment: () => ({}) },
    appAsset: p => p, __filename: sourcePath,
    console: { log: s => logs.push(s) },
    process: { on: (event, fn) => hooks.push([event, fn]) },
    require(name) {
      if (name === 'os') return { tmpdir: () => root };
      if (name === '../lib/storage') return storage;
      assert.strictEqual(name, 'child_process');
      return { fork(file, args, options) {
        if (fail) throw new Error('injected fork resource failure');
        const child = new EventEmitter();
        child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
        child.kills = 0; child.kill = () => ++child.kills;
        forks.push({ child, file, args, options });
        return child;
      } };
    },
  };
  vm.createContext(context);
  vm.runInContext(`this.baseShell = ({${baseShell}}).shell_execute;`, context);
  h.shell_execute = (...args) => (++baseCalls, context.baseShell(...args));
  vm.runInContext(merge + '\n' + body + '\nthis.capture = () => capturedLaunch;', context);
  return { exe, cwd, vfs, forks, hooks, context,
    baseCalls: () => baseCalls,
    launch(file, params = '', dir = '', show = 5, op = 'WinExec') {
      return h.shell_execute(0, put(op), put(file), put(params), put(dir), show);
    },
  };
}
const arg = (f, key) => f.args.find(a => a.startsWith(`--${key}=`)).slice(key.length + 3);
const tempDirs = () => fs.readdirSync(root);
function finish(f) {
  const fork = f.forks[0];
  const input = arg(fork, 'vfs-tree'), output = arg(fork, 'save-vfs');
  assert(fs.existsSync(input), 'authentic exporter created child snapshot');
  assert.strictEqual(fs.readFileSync(arg(fork, 'exe'), 'utf8'), 'offline fixture, never executed');
  assert(f.context.ctx.hasLiveChildren(), 'accepted child stays live');
  fs.cpSync(input, output, { recursive: true });
  fs.writeFileSync(path.join(output, 'new.txt'), 'child output');
  fork.child.emit('message', { t: 'child-exit', code: 17 });
  assert.strictEqual(f.context.h.process_ctl(0, 0x4004, 0), 259,
    'exit code remains STILL_ACTIVE until state is merged');
  fork.child.emit('exit', 0);
  assert.strictEqual(f.context.h.process_ctl(0, 0x4004, 0), 17);
  assert.strictEqual(Buffer.from(f.vfs.files.get('c:\\new.txt').data).toString(), 'child output');
  assert(!f.context.ctx.hasLiveChildren());
  assert(!fs.existsSync(path.dirname(input)), 'snapshot cleaned on child exit');
  const exitHook = f.hooks.find(([event]) => event === 'exit');
  assert(exitHook, 'parent exit owns child cleanup');
  exitHook[1]();
  assert.strictEqual(fork.child.kills, 1);
}
try {
  if (process.argv.includes('--baseline')) {
    const f = fixture();
    assert.strictEqual(f.launch(`"${f.exe}"`), 33);
    assert.strictEqual(f.forks.length, 0);
    console.log('PASS baseline: actual CLI shell callback returns 33 with ZERO transport forks');
  } else {
    for (const op of ['WinExec', 'open']) {
      const f = fixture();
      const result = op === 'WinExec'
        ? f.launch(`"${f.exe}" /flag "two words"`, '', 'c:\\requested', 0, op)
        : f.launch(f.exe, '/flag "two words"', 'c:\\requested', 0, op);
      assert.strictEqual(result, 33, 'shell status, not transport PID');
      assert.strictEqual(f.forks.length, 1, 'shell callback must reach authentic transport exactly once');
      assert.strictEqual(f.baseCalls(), 1);
      const fork = f.forks[0];
      assert.strictEqual(arg(fork, 'exe-guest-path'), f.exe);
      assert.strictEqual(arg(fork, 'args'), '/flag "two words"');
      assert.strictEqual(arg(fork, 'cwd'), 'c:\\requested');
      assert(fork.args.includes('--startup-show=0'));
      finish(f);
    }
    const missing = fixture();
    assert.strictEqual(missing.launch('c:\\absent.exe'), 2);
    assert.strictEqual(missing.launch(missing.exe), 2,
      'WinExec unquoted spaces delimit argv[0], unlike ShellExecute lpFile');
    assert.strictEqual(missing.launch('"unterminated'), 2);
    assert.strictEqual(missing.forks.length, 0);
    const failed = fixture({ fail: true });
    assert.strictEqual(failed.launch(`"${failed.exe}"`), 0, 'fork failure cannot return shell success');
    assert.deepStrictEqual(tempDirs(), [], 'synchronous fork failure cleans exported snapshot');
    const exportFailed = fixture({ exportFail: true });
    assert.strictEqual(exportFailed.launch(`"${exportFailed.exe}"`), 0);
    assert.strictEqual(exportFailed.forks.length, 0);
    assert.deepStrictEqual(tempDirs(), [], 'snapshot failure cleans partial export');
    const disabled = fixture({ spawn: false });
    assert.strictEqual(disabled.launch(`"${disabled.exe}"`), 33);
    assert.strictEqual(disabled.forks.length, 0, 'no-spawn compatibility');
    const captured = fixture({ capture: true });
    assert.strictEqual(captured.launch(`"${captured.exe}"`), 33);
    assert.strictEqual(captured.context.capture().guestExe, captured.exe);
    assert.strictEqual(captured.forks.length, 0, 'capture overrides enabled spawning');
    const app = fixture({ spawn: false, appSpawn: true });
    assert.strictEqual(app.launch(`"${app.exe}"`), 33);
    assert.strictEqual(arg(app.forks[0], 'cwd'), app.cwd);
    finish(app);
    const verb = fixture();
    assert.strictEqual(verb.launch(verb.exe, '', '', 1, 'print'), 33);
    assert.strictEqual(verb.forks.length, 0, 'other shell verbs keep base behavior');
    assert.deepStrictEqual(tempDirs(), []);
    console.log('PASS CLI shell routing: WinExec/ShellExecute, exact transport count, args/cwd/show, missing/fork failure, capture/no-spawn, merge/lifetime/cleanup');
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
