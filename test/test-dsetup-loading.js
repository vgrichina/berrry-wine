#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const boot = require('../lib/process-boot');
const loader = require('../lib/dll-loader');
const registry = require('../lib/dll-registry');
const { readPE } = require('../lib/pe');
const { buildVersionPe, buildVersionBlob } = require('../tools/pe-version');
const { compileBindingFixture } = require('./dsetup-binding-fixture');

// Normal CI uses tiny source fixtures. The task's offline replay can also use
// sealed originals, supplied explicitly; no original binary is stored in Git.
function images() {
  const arg = process.argv.find(x => x.startsWith('--native-dir='));
  if (arg) {
    const dir = arg.slice('--native-dir='.length);
    const receipt = JSON.parse(fs.readFileSync(path.join(dir, 'receipt.json')));
    for (const row of receipt.originalInstalledFiles) {
      const bytes = fs.readFileSync(path.join(dir, row.name));
      assert.strictEqual(bytes.length, row.size);
      assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'), row.sha256);
    }
    return {exe: fs.readFileSync(path.join(dir, 'd3dconfigutility.exe')),
      dll: fs.readFileSync(path.join(dir, 'dsetup.dll')), native: true};
  }
  const make = base => {
    const b = buildVersionPe(buildVersionBlob([]));
    b.writeUInt32LE(base, 0x98 + 28);
    b.fill(0, 0x98 + 96, 0x98 + 96 + 24);
    b.fill(0, 0x200);
    return b;
  };
  const exe = make(0x400000), dll = make(0x600000);
  const set = (b, rva, value) => b.writeUInt32LE(value >>> 0, rva - 0x1000 + 0x200);
  exe.writeUInt32LE(0x1000, 0x98 + 104);
  set(exe, 0x1000, 0x1040); set(exe, 0x100c, 0x1060); set(exe, 0x1010, 0x1050);
  set(exe, 0x1040, 0x8000000b); set(exe, 0x1050, 0x07500000);
  exe.write('DSETUP.DLL\0', 0x260, 'latin1');
  dll.writeUInt32LE(0x1000, 0x98 + 96);
  set(dll, 0x100c, 0x1060); set(dll, 0x1010, 1); set(dll, 0x1014, 11);
  set(dll, 0x101c, 0x1080); set(dll, 0x10a8, 0x1100);
  dll.write('DSETUP.DLL\0', 0x260, 'latin1');
  return {exe, dll, native: false};
}

async function main() {
  const {exe, dll, native} = images();
  const requests = [], missing = [];
  const plan = async (present, wrongName = false) => boot.resolveDllGraph({exeBytes: exe,
    detectRequiredDlls: loader.detectRequiredDlls,
    loadSpec(name) {
      requests.push(name.toLowerCase());
      return present && name.toLowerCase() === (wrongName ? 'dsetup32.dll' : 'dsetup.dll')
        ? {name: 'dsetup.dll', bytes: dll} : null;
    }, onMissing: name => missing.push(name.toLowerCase())});
  assert(registry.isLoadableDll('DSETUP.DLL'));
  assert.strictEqual(registry.dllPath('dsetup.dll'), null, 'only installed app/VFS bytes');
  assert(!loader.isWindowsSystemDll('dsetup.dll'), 'preserve native PE route');
  const selected = await plan(true);
  assert(requests.includes('dsetup.dll'));
  assert(selected.some(x => x.name === 'dsetup.dll' && x.bytes === dll));
  assert(!(await plan(false)).some(x => x.name === 'dsetup.dll'));
  assert(missing.includes('dsetup.dll'));
  assert(!(await plan(true, true)).some(x => x.name === 'dsetup.dll'));

  const memory = new WebAssembly.Memory({initial: 8192, maximum: 8192, shared: true});
  const {instance} = await WebAssembly.instantiate(compileBindingFixture(), {host: {memory}});
  const e = instance.exports, bytes = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const wa = g => g - e.get_image_base() + e.get_guest_base();
  function map(image) {
    const pe = readPE(image);
    for (const s of pe.sections) bytes.set(image.subarray(s.rawOff, s.rawOff + s.rawSize), wa(pe.imageBase + s.rva));
    return pe;
  }
  const ep = map(exe), dp = map(dll);
  const exp = dll.readUInt32LE(dp.peOff + 120);
  e.prepare(dp.imageBase, exp);
  const importRva = exe.readUInt32LE(ep.peOff + 128);
  let desc = wa(ep.imageBase + importRva), slot = 0;
  while (dv.getUint32(desc + 12, true)) {
    const np = wa(ep.imageBase + dv.getUint32(desc + 12, true));
    let end = np; while (bytes[end]) end++;
    if (Buffer.from(bytes.subarray(np, end)).toString('latin1').toLowerCase() === 'dsetup.dll')
      slot = ep.imageBase + dv.getUint32(desc + 16, true);
    desc += 20;
  }
  assert(slot);
  const expected = dp.imageBase + (native ? 0x18b0 : 0x1100);
  assert.strictEqual(e.ordinal(11) >>> 0, expected >>> 0);
  assert.strictEqual(e.ordinal(0), 0); assert.strictEqual(e.ordinal(65535), 0);
  const before = dv.getUint32(wa(slot), true);
  loader.patchExeImports(e, memory.buffer, exe, selected);
  assert.strictEqual(dv.getUint32(wa(slot), true), expected >>> 0, 'actual JS -> WAT ordinal binding');
  if (native) assert.strictEqual(slot, 0x409024);
  // Missing EAT entry must not bind to a fabricated handler/address.
  const eat = dp.imageBase + dll.readUInt32LE(dp.va2off(dp.imageBase + exp + 28));
  dv.setUint32(wa(eat + 10 * 4), 0, true);
  dv.setUint32(wa(slot), before, true);
  loader.patchExeImports(e, memory.buffer, exe, selected);
  assert.strictEqual(dv.getUint32(wa(slot), true), before, 'absent export leaves normal unresolved slot');
  console.log(`PASS ${native ? 'authentic sealed' : 'synthetic'} DSETUP graph, missing/wrong-name controls, JS/WAT IAT binding, absent export control; no x86 executed`);
}
main().catch(e => {console.error(e); process.exitCode = 1;});
