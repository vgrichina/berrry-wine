#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPE } = require('../lib/pe');
const { bootRenderHarness } = require('./render-helper');
const { parseNativeTls, fixture } = require('./test-tls-native-fixture');

(async () => {
  const reference = parseNativeTls(fs.readFileSync(fixture, 'utf8'));
  const main = await bootRenderHarness({ fonts: 'none' });
  const peer = await bootRenderHarness({ fonts: 'none', memory: main.memory });
  const a = main.exports, b = peer.exports;
  a.init_thread(1, 0x400000, 0, 0, 0, 0, 0, 0);
  b.init_thread(2, 0x400000, 0, 0, 0, 0, 0, 0);
  const observed = new Map();
  let compared = 0;
  const call = (e, name, args = []) => {
    e.test_call_SetLastError(4660);
    e.set_esp(0x07408000);
    const result = e[`test_call_${name}`](...args) >>> 0;
    assert.strictEqual(e.get_esp() >>> 0, 0x07408000, `${name}: test wrapper restores ESP`);
    return { result, error: e.test_call_GetLastError() >>> 0 };
  };
  const row = (label, e, name, ...args) => {
    const actual = call(e, name, args);
    assert.deepStrictEqual(actual, reference.rows.get(label), label);
    observed.set(label, actual); compared++;
    return actual.result;
  };
  for (const expected of reference.allocations) {
    assert.deepStrictEqual(call(a, 'TlsAlloc'), expected, `allocation ${expected.result}`);
    compared++;
  }
  row('exhausted', a, 'TlsAlloc');
  const index = reference.rows.get('chosen').result;
  row('initial-main', a, 'TlsGetValue', index);
  row('set-main-status', a, 'TlsSetValue', index, 0x11223344);
  assert.strictEqual(call(b, 'TlsSetValue', [index, 0x55667788]).result, 1);
  row('set-main', a, 'TlsGetValue', index);
  row('set-worker', b, 'TlsGetValue', index);
  const mainVector = a.get_tls_slots() >>> 0, peerVector = b.get_tls_slots() >>> 0;
  assert.notStrictEqual(mainVector, peerVector);
  row('free', a, 'TlsFree', index);
  assert.strictEqual(a.guest_read32(mainVector + index * 4), 0, 'raw main TLS vector cleared');
  assert.strictEqual(b.guest_read32(peerVector + index * 4), 0, 'raw worker TLS vector cleared');
  // Spawn snapshots carry a high-water mark, not ownership of freed holes.
  b.set_tls_next_index(80);
  a.set_tls_next_index(20);
  row('freed-main', a, 'TlsGetValue', index);
  row('freed-worker', b, 'TlsGetValue', index);
  row('free-again', a, 'TlsFree', index);
  row('reuse-main', a, 'TlsAlloc');
  row('reused-main', a, 'TlsGetValue', index);
  row('reused-worker', b, 'TlsGetValue', index);
  assert.strictEqual(call(a, 'TlsSetValue', [index, 0x99aabbcc]).result, 1);
  row('free-for-worker', a, 'TlsFree', index);
  row('reuse-by-worker', b, 'TlsAlloc');
  row('worker-reused-main', a, 'TlsGetValue', index);
  row('worker-reused-worker', b, 'TlsGetValue', index);
  row('set-index-64', a, 'TlsSetValue', 64, 0xabcdef01);
  row('get-index-64', a, 'TlsGetValue', 64);
  row('set-index-79', a, 'TlsSetValue', 79, 0x12345678);
  row('get-index-79', a, 'TlsGetValue', 79);
  row('set-index-80', a, 'TlsSetValue', 80, 0x12345678);
  row('get-index-80', a, 'TlsGetValue', 80);
  row('get-index-81', a, 'TlsGetValue', 81);
  row('invalid-get-max', a, 'TlsGetValue', 0xffffffff);
  row('free-index-64', a, 'TlsFree', 64);
  row('freed-index-64', a, 'TlsGetValue', 64);
  row('free-index-80', a, 'TlsFree', 80);
  row('invalid-free-max', a, 'TlsFree', 0xffffffff);
  assert.strictEqual(observed.size, reference.rows.size - 3, 'all API observations replayed (not version/capacity/chosen metadata)');

  // A later-created thread must join clearing too, without changing allocated
  // indices or inheriting values from either existing thread.
  const late = (await bootRenderHarness({ fonts: 'none', memory: main.memory })).exports;
  late.init_thread(3, 0x400000, 0, 0, 0, 0, 0, 0);
  assert.strictEqual(call(late, 'TlsGetValue', [79]).result, 0);
  assert.strictEqual(call(late, 'TlsSetValue', [79, 0x12345678]).result, 1);
  assert.strictEqual(call(b, 'TlsFree', [79]).result, 1);
  assert.strictEqual(late.guest_read32((late.get_tls_slots() >>> 0) + 79 * 4), 0);
  assert.strictEqual(call(a, 'TlsGetValue', [79]).result, 0);

  // Synthetic static TLS directory in a real PE: preserve the loader contract
  // that FS:[0x2c][assigned index] points at template bytes plus zero fill.
  const loader = await bootRenderHarness({ fonts: 'none' });
  const e = loader.exports;
  const image = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  const pe = readPE(image);
  const section = pe.sections.find(section => section.name === '.rsrc' && section.rawSize >= 128);
  assert(section, 'fixture needs a resource-section tail');
  const rva = section.rva + section.rawSize - 128;
  const offset = pe.va2off(pe.imageBase + rva);
  image.fill(0, offset, offset + 128);
  image.writeUInt32LE(rva, pe.peOff + 24 + 96 + 9 * 8);
  image.writeUInt32LE(24, pe.peOff + 24 + 96 + 9 * 8 + 4);
  image.writeUInt32LE(pe.imageBase + rva + 32, offset);
  image.writeUInt32LE(pe.imageBase + rva + 36, offset + 4);
  image.writeUInt32LE(pe.imageBase + rva + 48, offset + 8);
  image.writeUInt32LE(8, offset + 16);
  image.writeUInt32LE(0x12345678, offset + 32);
  new Uint8Array(loader.memory.buffer).set(image, e.get_staging());
  assert(e.load_pe(image.length));
  const staticIndex = e.guest_read32(pe.imageBase + rva + 48) >>> 0;
  const staticVector = e.guest_read32((e.get_fs_base() >>> 0) + 0x2c) >>> 0;
  assert.strictEqual(staticVector, e.get_tls_slots() >>> 0);
  const template = e.guest_read32(staticVector + staticIndex * 4) >>> 0;
  assert(template);
  assert.strictEqual(e.guest_read32(template) >>> 0, 0x12345678);
  assert.strictEqual(e.guest_read32(template + 4), 0);
  assert.strictEqual(e.guest_read32(template + 8), 0);
  const dynamic = call(e, 'TlsAlloc').result;
  assert.notStrictEqual(dynamic, staticIndex, 'dynamic allocation cannot take the static PE reservation');
  assert.strictEqual(call(e, 'TlsFree', [dynamic]).result, 1);
  assert.strictEqual(call(e, 'TlsAlloc').result, dynamic);
  assert.strictEqual(e.guest_read32(staticVector + staticIndex * 4) >>> 0, template);
  // A DLL's static TLS gets its own slot too. The loader used to record only
  // that a .tls directory existed, so AddressOfIndex stayed 0 and the DLL read
  // slot 0 -- another module's TlsAlloc data -- as its block (Serious Sam's
  // Engine.dll found MSVCRT's per-thread data where its stream list belongs).
  const dllImage = fs.readFileSync(path.join(__dirname, 'binaries/dlls/shfolder.dll'));
  const dll = readPE(dllImage);
  const tail = dll.sections.filter(s => s.rawSize >= 256).at(-1);
  assert(tail, 'DLL fixture needs a section with room for a TLS directory');
  const dllRva = tail.rva + tail.rawSize - 128, dllOff = dll.va2off(dll.imageBase + dllRva);
  // Rebase the image header itself, so it loads where its absolute TLS VAs
  // point: the synthetic directory has no relocation entries of its own.
  const base = 0x01000000; // inside the direct window, so the loader keeps it
  dllImage.writeUInt32LE(base, dll.peOff + 24 + 28);
  dllImage.fill(0, dllOff, dllOff + 128);
  dllImage.writeUInt32LE(dllRva, dll.peOff + 24 + 96 + 9 * 8);
  dllImage.writeUInt32LE(24, dll.peOff + 24 + 96 + 9 * 8 + 4);
  dllImage.writeUInt32LE(base + dllRva + 32, dllOff);       // StartAddressOfRawData
  dllImage.writeUInt32LE(base + dllRva + 36, dllOff + 4);   // EndAddressOfRawData
  dllImage.writeUInt32LE(base + dllRva + 48, dllOff + 8);   // AddressOfIndex
  dllImage.writeUInt32LE(8, dllOff + 16);                            // SizeOfZeroFill
  dllImage.writeUInt32LE(0xCAFEBABE, dllOff + 32);
  new Uint8Array(loader.memory.buffer).set(dllImage, e.get_staging());
  assert(e.load_dll(dllImage.length, base), 'DLL loads');
  const dllIndex = e.guest_read32(base + dllRva + 48) >>> 0;
  assert.notStrictEqual(dllIndex, staticIndex, 'the DLL gets its own static TLS slot, not the EXE\'s');
  const dllBlock = e.guest_read32(staticVector + dllIndex * 4) >>> 0;
  assert(dllBlock, 'FS:[0x2c][DLL index] points at the DLL\'s TLS block');
  assert.strictEqual(e.guest_read32(dllBlock) >>> 0, 0xCAFEBABE, 'DLL template copied');
  assert.strictEqual(e.guest_read32(dllBlock + 4), 0, 'DLL zero fill');
  assert.strictEqual(e.guest_read32(dllBlock + 8), 0, 'DLL zero fill');
  assert.strictEqual(e.guest_read32(staticVector + staticIndex * 4) >>> 0, template, 'EXE block untouched');
  console.log(`PASS ${compared} native TLS API observations, raw cross-thread clearing, stale spawn metadata and late-thread registration`);
  console.log('PASS static PE TLS template, zero fill and reservation survive dynamic index reuse');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
