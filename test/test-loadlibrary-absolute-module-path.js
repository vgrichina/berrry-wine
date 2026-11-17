#!/usr/bin/env node
'use strict';

// Windows records the FULL path a module was found at, whatever spelling the
// caller passed to LoadLibrary, and GetModuleFileName answers with that path.
// Hitman: Codename 47 (Demo2) loads "System.dll" by its bare name and System.dll
// cuts its own directory out of GetModuleFileName with strrchr(path, '\\'). We
// recorded the bare spelling, so there was no backslash: the engine then asked
// for "System.dll\HitmanDlc.dlc", CreateFile failed with error 3, and
// EngineData called through a NULL vtable at the intro (the main Worker then
// reported "Program exited" right after the sound thread started).

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');
const processBoot = require('../lib/process-boot');
const dllLoader = require('../lib/dll-loader');

const ROOT = path.join(__dirname, '..');

async function main() {
  const wasm = compileSrcWasm();
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  imports.host.memory = memory;
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const e = instance.exports;
  const exe = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(exe, e.get_staging());
  assert(e.load_pe(exe.length), 'fixture PE initializes guest address mapping');

  processBoot.setExeName(e, memory.buffer, 'Games\\Hitman\\Hitman.Exe');
  processBoot.setExeDrive(e, 'D:\\Games\\Hitman\\Hitman.Exe');

  const abs = name => processBoot.absoluteModulePath(e, name);
  assert.strictEqual(abs('System.dll'), 'D:\\Games\\Hitman\\System.dll',
    'a bare name resolves in the EXE directory');
  assert.strictEqual(abs('plugins/vis.dll'), 'D:\\Games\\Hitman\\plugins\\vis.dll',
    'a relative subpath resolves under the EXE directory, with backslashes');
  assert.strictEqual(abs('.\\a.dll'), 'D:\\Games\\Hitman\\a.dll', '"." segments drop');
  assert.strictEqual(abs('..\\Common\\b.dll'), 'D:\\Games\\Common\\b.dll', '".." segments climb');
  assert.strictEqual(abs('..\\..\\..\\c.dll'), 'D:\\c.dll', '".." never climbs above the drive root');
  assert.strictEqual(abs('\\Root\\d.dll'), 'D:\\Root\\d.dll', 'a rooted path takes the EXE drive');
  assert.strictEqual(abs('C:\\WINDOWS\\SYSTEM\\x.dll'), 'C:\\WINDOWS\\SYSTEM\\x.dll',
    'an absolute path is kept as given');
  assert.strictEqual(abs('\\\\server\\share\\y.dll'), '\\\\server\\share\\y.dll', 'UNC is kept');

  // The recorded path is what GetModuleFileNameA(hModule) reports.
  const dll = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'dlls', 'shfolder.dll'));
  const mapped = dllLoader.loadDll(e, memory.buffer, new Uint8Array(dll), abs('System.dll'));
  const buf = e.guest_alloc(260) >>> 0;
  const n = e.test_call_GetModuleFileNameA(mapped.loadAddr, buf, 260) >>> 0;
  let reported = '';
  for (let i = 0; i < n; i++) reported += String.fromCharCode(e.guest_read8(buf + i));
  assert.strictEqual(reported, 'D:\\Games\\Hitman\\System.dll',
    'GetModuleFileNameA names the full path, so strrchr(path, \'\\\\\') finds the module directory');

  console.log('test-loadlibrary-absolute-module-path: PASS');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
