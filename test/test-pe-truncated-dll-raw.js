'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated.js');
const { loadDll } = require('../lib/dll-loader');

function makePe() {
  const b = Buffer.alloc(0x600);
  const pe = 0x80, opt = pe + 24, sh = opt + 0xe0;
  b.writeUInt16LE(0x5a4d, 0); b.writeUInt32LE(pe, 0x3c); b.writeUInt32LE(0x4550, pe);
  b.writeUInt16LE(0x14c, pe + 4); b.writeUInt16LE(1, pe + 6); b.writeUInt16LE(0xe0, pe + 20);
  b.writeUInt16LE(0x2102, pe + 22); b.writeUInt16LE(0x10b, opt);
  b.writeUInt32LE(0x1000, opt + 16); b.writeUInt32LE(0x1000, opt + 20);
  b.writeUInt32LE(0x400000, opt + 28); b.writeUInt32LE(0x1000, opt + 32);
  b.writeUInt32LE(0x200, opt + 36); b.writeUInt32LE(0x3000, opt + 56);
  b.writeUInt32LE(0x200, opt + 60); b.writeUInt32LE(16, opt + 92);
  b.write('.text', sh, 'ascii'); b.writeUInt32LE(0x400, sh + 8); b.writeUInt32LE(0x1000, sh + 12);
  b.writeUInt32LE(0x400, sh + 16); b.writeUInt32LE(0x200, sh + 20);
  b.writeUInt32LE(0xe0000060, sh + 36); b.fill(0x5c, 0x200);
  return b;
}

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
  const staging = e.get_staging() >>> 0;
  const valid = makePe();
  new Uint8Array(memory.buffer).set(valid, staging);
  assert.strictEqual(e.load_pe(valid.length) >>> 0, 0x401000, 'fixture initializes the process image base');
  const before = e.get_dll_count() >>> 0;
  assert.strictEqual(e.load_dll(valid.length, 0x500000) >>> 0, 0x501000,
    'a complete raw section whose end equals the file length loads');
  assert.strictEqual(e.get_dll_count() >>> 0, before + 1);

  let nextBase = 0x600000;
  const rejectBeforeWrite = (bytes, label) => {
    const target = RegionMap.GUEST_BASE + (nextBase - 0x400000) + 0x1000;
    new Uint8Array(memory.buffer, target, 0x400).fill(0xa5);
    new Uint8Array(memory.buffer).set(bytes, staging);
    const count = e.get_dll_count() >>> 0;
    assert.strictEqual(e.load_dll(bytes.length, nextBase) >>> 0, 0, label + ': loader result');
    assert.strictEqual(e.get_dll_count() >>> 0, count, label + ': no DLL row published');
    assert.ok(new Uint8Array(memory.buffer, target, 0x400).every(x => x === 0xa5),
      label + ': preflight rejection leaves the target image untouched');
    nextBase += 0x10000;
  };

  rejectBeforeWrite(valid.subarray(0, valid.length - 1),
    'section raw range ending one byte beyond EOF');
  const shortHeader = Buffer.alloc(0x50);
  shortHeader.writeUInt16LE(0x5a4d, 0); shortHeader.writeUInt32LE(0x80, 0x3c);
  rejectBeforeWrite(shortHeader, 'short DOS/header prefix with stale PE bytes in staging');
  const farHeader = Buffer.from(valid); farHeader.writeUInt32LE(0xfffffff0, 0x3c);
  rejectBeforeWrite(farHeader, 'e_lfanew outside supplied file');
  rejectBeforeWrite(valid.subarray(0, 0x180), 'truncated section table');
  const badRawOffset = Buffer.from(valid); badRawOffset.writeUInt32LE(0xfffffff0, 0x178 + 20);
  rejectBeforeWrite(badRawOffset, 'raw offset outside supplied file');
  const badImageSection = Buffer.from(valid); badImageSection.writeUInt32LE(0x3000, 0x178 + 12);
  rejectBeforeWrite(badImageSection, 'section virtual range outside SizeOfImage');
  const badHeaders = Buffer.from(valid); badHeaders.writeUInt32LE(0x3001, 0x80 + 24 + 60);
  rejectBeforeWrite(badHeaders, 'SizeOfHeaders outside SizeOfImage');
  const wrongMachine = Buffer.from(valid); wrongMachine.writeUInt16LE(0x8664, 0x84);
  rejectBeforeWrite(wrongMachine, 'non-x86 machine type');
  const wrongMagic = Buffer.from(valid); wrongMagic.writeUInt16LE(0x20b, 0x98);
  rejectBeforeWrite(wrongMagic, 'PE32+ optional header');

  const rejectedCount = e.get_dll_count() >>> 0;
  let pathWritten = false;
  assert.throws(() => loadDll({ ...e, set_dll_path: () => { pathWritten = true; } },
    memory.buffer, valid.subarray(0, valid.length - 1), 'bad.dll'), /loader rejected image/);
  assert.strictEqual(e.get_dll_count() >>> 0, rejectedCount);
  assert.strictEqual(pathWritten, false, 'rejection cannot overwrite the previous DLL path');

  const noEntry = Buffer.from(valid);
  noEntry.writeUInt32LE(0, 0x80 + 24 + 16);
  const noEntryCount = e.get_dll_count() >>> 0;
  assert.strictEqual(loadDll(e, memory.buffer, noEntry).dllMain, 0,
    'a valid DLL without an entry point succeeds through the JS wrapper');
  assert.strictEqual(e.get_dll_count() >>> 0, noEntryCount + 1);

  // Watcom-style BSS: VirtualSize=0, SizeOfRawData is the extent, and a null
  // PointerToRawData means the section has no file bytes and must be zeroed.
  const bss = Buffer.from(valid);
  bss.writeUInt32LE(0, 0x178 + 8);
  bss.writeUInt32LE(0x2000, 0x178 + 12);
  bss.writeUInt32LE(0x1000, 0x178 + 16);
  bss.writeUInt32LE(0, 0x178 + 20);
  new Uint8Array(memory.buffer).set(bss, staging);
  const bssBase = 0x700000;
  const bssTarget = RegionMap.GUEST_BASE + (bssBase - 0x400000) + 0x2000;
  new Uint8Array(memory.buffer, bssTarget, 0x1000).fill(0xa5);
  const bssCount = e.get_dll_count() >>> 0;
  e.load_dll(bss.length, bssBase);
  assert.strictEqual(e.get_dll_count() >>> 0, bssCount + 1, 'zero-raw BSS image loads');
  assert.ok(new Uint8Array(memory.buffer, bssTarget, 0x1000).every(x => x === 0),
    'zero-raw Watcom BSS maps as zero-filled memory');
  console.log('PASS PE DLL preflight: truncated bounds rejected before writes; exact-end and zero-raw BSS accepted');
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
