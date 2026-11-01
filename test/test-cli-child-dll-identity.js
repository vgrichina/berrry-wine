'use strict';

// Exercise the CLI's actual mapping against a real exported VFS, without
// starting a guest. Two identically named DLLs must retain distinct paths.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { VirtualFS } = require('../lib/filesystem');
const { saveVfsToHost } = require('../lib/vfs-export');
const { guestPathInTree } = require('../lib/vfs-host-files');
const source = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
const helper = name => {
  const match = source.match(new RegExp('const ' + name + ' = [\\s\\S]*?\\n};'));
  assert(match, name);
  return match[0];
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-dll-identity-'));
try {
  const tree = path.join(tmp, 'parent');
  const seed = path.join(tree, 'System', 'Plugins', 'Core.dll');
  const exe = path.join(tree, 'System', 'Rune.exe');
  fs.mkdirSync(path.dirname(seed), { recursive: true });
  fs.writeFileSync(seed, 'nested original');
  fs.writeFileSync(exe, 'ordinary executable');
  const vfs = new VirtualFS();
  for (const [guest, bytes] of [
    ['c:\\System\\Plugins\\Core.dll', 'nested original'],
    ['c:\\Other\\Core.dll', 'wrong DLL'],
    ['c:\\System\\Rune.exe', 'ordinary executable'],
  ]) {
    vfs.ensureParentDirs(guest);
    vfs.files.set(vfs._resolvePath(guest), { data: Buffer.from(bytes), attrs: 0x20 });
  }
  const exported = path.join(tmp, 'child');
  const written = saveVfsToHost(vfs, exported);
  function context(exePath, trees, guestExe) {
    const ctx = { path, fs, guestPathInTree, VFS_TREES: trees,
      EXE_PATH: exePath, EXE_GUEST_PATH: guestExe, appAsset: p => p };
    vm.createContext(ctx);
    vm.runInContext(['capturedGuestPath', 'besideExeGuestPath', 'childDllSeedPath']
      .map(helper).join('\n') + '\nthis.mapSeed = childDllSeedPath; this.identity = capturedGuestPath;', ctx);
    return ctx;
  }
  const parent = context(exe, [tree], 'C:\\System\\Rune.exe');
  const mapped = parent.mapSeed(seed, written);
  assert.strictEqual(fs.readFileSync(mapped, 'utf8'), 'nested original');
  assert.strictEqual(mapped, written.find(r => r.guestPath === 'c:\\system\\plugins\\core.dll').outputPath);
  const childExe = written.find(r => r.guestPath === 'c:\\system\\rune.exe').outputPath;
  const child = context(childExe, [exported], 'c:\\system\\rune.exe');
  assert.strictEqual(child.identity(mapped).toLowerCase(), 'c:\\system\\plugins\\core.dll');
  assert.strictEqual(child.identity(childExe).toLowerCase(), 'c:\\system\\rune.exe');
  assert.strictEqual(parent.mapSeed(seed, written.filter(r => r.outputPath !== mapped)), seed,
    'missing exact export must retain original seed, not use Other/Core.dll');
  assert.strictEqual(parent.mapSeed(seed, [{ guestPath: 'c:\\system\\plugins\\core.dll', outputPath: mapped, collision: true }]), seed);
  const beside = path.join(tree, 'System', 'Core.dll');
  const besideParent = context(exe, [], 'C:\\System\\Rune.exe');
  assert.strictEqual(besideParent.mapSeed(beside, [{ guestPath: 'c:\\system\\core.dll', outputPath: mapped }]), mapped,
    'ordinary app-local seed uses the parent identity beside its EXE');
  const unrelated = path.join(tmp, 'external', 'Core.dll');
  assert.strictEqual(besideParent.mapSeed(unrelated, written), unrelated,
    'unknown guest identity retains original host seed');
  assert.match(source, /\.map\(p => childDllSeedPath\(p, written\)\)/,
    'spawn transport must use the tested mapper');
  console.log('PASS exact nested DLL guest identity, duplicate basename, original seed fallback and ordinary EXE path');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
