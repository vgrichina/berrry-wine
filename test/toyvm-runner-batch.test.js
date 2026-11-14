'use strict';

// PURE_JS_ONLY_NO_NATIVE: actual parser/resolver/option boundaries on a
// prototype filesystem. No Machine construction, fake VM result or execution.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Machine } = require('../tools/toyvm/dos');
const { parseLauncherBatchLine: parse, resolveLauncherExternal: resolve,
  launcherProgramOptions, restoreLauncherProgramDirectory } = require('../tools/toyvm/run-dos');

function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-batch-pure-'));
  const disk = Object.assign(Object.create(Machine.prototype), {
    fileRoot: root, currentDrive: 2, currentDirectory: 'work',
    driveDirectories: new Map([[0, 'floppy'], [1, 'other'], [2, 'work']]),
    floppyVolumes: new Map(), isoVolumes: new Map(), tempFiles: new Map(),
    virtualDirectories: new Set(), filesMissed: [],
  });
  const put = (name, bytes = Buffer.from([0xcd, 0x20])) => {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), bytes);
  };
  fs.mkdirSync(path.join(root, 'work'));
  try { return fn({ root, disk, put }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('exact seven-byte original INSTALL.BAT grammar resolves unchanged setup bytes', () => fixture(({ root, disk, put }) => {
  const original = Buffer.from('setup\r\n');
  put('work/INSTALL.BAT', original); put('work/SETUP.EXE', Buffer.from('MZtiny'));
  const bytes = disk.readWholeFile('INSTALL.BAT');
  assert.deepEqual(bytes, original);
  const lines = bytes.toString('latin1').split(/\r\n|\n|\r/).map(parse).filter(Boolean);
  assert.deepEqual(lines, [{ command: 'setup', args: '' }]);
  assert.deepEqual(resolve(disk, lines[0].command), { executable: 'work/setup.exe', program: 'C:\\WORK\\SETUP.EXE' });
  assert.equal(fs.readFileSync(path.join(root, 'work/SETUP.EXE')).toString(), 'MZtiny');
  assert.deepEqual(disk.readWholeFile('INSTALL.BAT'), original);
}));

test('COM before EXE, directory before extension, no bare-file fallback, default C root PATH', () => fixture(({ disk, put }) => {
  put('work/tool', Buffer.from('bare')); put('work/tool.EXE'); put('tool.COM');
  assert.equal(resolve(disk, 'tool').executable, 'work/tool.exe');
  put('work/tool.COM'); assert.equal(resolve(disk, 'tool').executable, 'work/tool.com');
  assert.equal(resolve(disk, 'tool.EXE').executable, 'work/tool.exe');
  put('rootonly.EXE'); assert.equal(resolve(disk, 'rootonly').executable, 'rootonly.exe');
  put('work/bare'); assert.throws(() => resolve(disk, 'bare'), /not found/);
}));

test('ordered PATH, explicit relative/root/drive paths suppress PATH, BAT shadows later paths', () => fixture(({ disk, put }) => {
  put('first/go.EXE'); put('second/go.COM'); put('work/local/go.EXE');
  const env = ['PATH=C:\\FIRST;C:\\SECOND'];
  assert.equal(resolve(disk, 'go', env).executable, 'first/go.exe');
  assert.equal(resolve(disk, 'local\\go', env).executable, 'work/local/go.exe');
  assert.equal(resolve(disk, 'C:\\second\\go', env).executable, 'second/go.com');
  assert.throws(() => resolve(disk, 'missing\\go', env), /not found/);
  assert.throws(() => resolve(disk, '\\go', env), /not found/);
  put('work/go.BAT'); assert.throws(() => resolve(disk, 'go', env), /chaining/);
  put('work/go.EXE'); assert.equal(resolve(disk, 'go', env).executable, 'work/go.exe');
  assert.throws(() => resolve(disk, 'go.BAT', env), /extension/);
  assert.throws(() => resolve(disk, 'go', ['PATH=%PATH%']), /PATH/);
}));

test('relative PATH and empty PATH preserve cwd; directories and symlinks cannot become programs', () => fixture(({ disk, put, root }) => {
  put('work/bin/go.COM'); put('go.EXE');
  assert.equal(resolve(disk, 'go', ['PATH=bin']).executable, 'work/bin/go.com');
  assert.throws(() => resolve(disk, 'go', ['PATH=']), /not found/);
  fs.mkdirSync(path.join(root, 'work/go.COM'));
  fs.symlinkSync(path.join(root, 'go.EXE'), path.join(root, 'work/go.EXE'));
  assert.throws(() => resolve(disk, 'go', ['PATH=']), /not found/);
}));

test('live overlay resolution and mounted A/B/D PATHs retain namespace and working drive', () => fixture(({ disk, put }) => {
  put('work/next.EXE');
  disk.tempFiles.set('work/next.com', { data: Buffer.from([0xc3]), len: 1 });
  assert.equal(resolve(disk, 'next').executable, 'work/next.com');
  for (const drive of [0, 1, 3]) {
    const dir = drive === 0 ? 'floppy' : drive === 1 ? 'other' : '';
    const key = (dir ? dir + '/' : '') + 'cdtool.exe';
    const volume = { entries: new Map([[key, { data: Buffer.from('MZ') }]]), directories: new Set(['', dir]) };
    (drive < 2 ? disk.floppyVolumes : disk.isoVolumes).set(drive, volume);
    const letter = String.fromCharCode(65 + drive);
    const resolved = resolve(disk, 'cdtool', [`PATH=${letter}:`]);
    assert.equal(resolved.executable, `${letter.toLowerCase()}:/${key}`);
    assert.equal(disk.currentDrive, 2); assert.equal(disk.currentDirectory, 'work');
  }
}));

test('actual child option boundary preserves one deadline and isolates drive-directory snapshots', () => fixture(({ disk, put, root }) => {
  put('work/go.EXE');
  disk.virtualDirectories.add('created');
  const deadline = 123456789n, env = ['PATH=C:\\'], controlledInput = { mode: 'persistent' };
  const options = launcherProgramOptions({ fileRoot: root, batchStopAt: deadline, env, controlledInput }, disk, resolve(disk, 'go'));
  assert.equal(options.batchStopAt, deadline); assert.equal(options.env, env);
  assert.equal(options.controlledInput, controlledInput); assert.equal(options.tempFiles, disk.tempFiles);
  const child = {};
  restoreLauncherProgramDirectory(child, options);
  assert.equal(child.currentDrive, 2); assert.equal(child.currentDirectory, 'work');
  assert.deepEqual(child.driveDirectories, disk.driveDirectories);
  assert.deepEqual(child.virtualDirectories, disk.virtualDirectories);
  child.virtualDirectories.add('child-only');
  child.driveDirectories.set(0, 'changed');
  const later = {}; restoreLauncherProgramDirectory(later, options);
  assert.equal(later.driveDirectories.get(0), 'floppy');
  assert.equal(later.virtualDirectories.has('child-only'), false);
  assert.equal(disk.driveDirectories.get(0), 'floppy');
}));

test('bounded parser keeps CALL/CD and arguments; unsupported shell constructs fail explicitly', () => {
  assert.deepEqual(parse('@setup /quiet'), { command: 'setup', args: '/quiet' });
  assert.deepEqual(parse('cd ..'), { command: 'cd', args: '..' });
  assert.deepEqual(parse('call next.bat'), { command: 'call', args: 'next.bat' });
  assert.deepEqual(parse('D:\\setup'), { command: 'D:\\setup', args: '' });
  for (const line of ['', 'REM comment', '@echo off']) assert.equal(parse(line), null);
  for (const line of ['setup >out', 'setup |other', 'setup & other', '%setup%', 'if exist x setup',
    'goto next', ':next', 'D:', 'set PATH=C:\\', 'setup "arg"', 'setup *', 'setup\targ',
    'setup!x', 'echo hello', 'setup ^x']) assert.throws(() => parse(line), /unsupported/);
});
