'use strict';

const assert = require('assert');
const { readPE } = require('../lib/pe');

function makePe({ fileLength, rawOff = 0x200, rawSize = 0x20, virtualSize = 0x40 }) {
  const bytes = new Uint8Array(fileLength);
  const dv = new DataView(bytes.buffer);
  dv.setUint16(0, 0x5A4D, true);
  dv.setUint32(0x3C, 0x80, true);
  dv.setUint32(0x80, 0x00004550, true);
  dv.setUint16(0x86, 1, true);
  dv.setUint16(0x94, 0xE0, true);
  dv.setUint32(0x80 + 24 + 28, 0x00400000, true);
  const section = 0x80 + 24 + 0xE0;
  dv.setUint32(section + 8, virtualSize, true);
  dv.setUint32(section + 12, 0x1000, true);
  dv.setUint32(section + 16, rawSize, true);
  dv.setUint32(section + 20, rawOff, true);
  return bytes;
}

// All claimed raw bytes present: byte at exact final file position remains valid.
{
  const pe = readPE(makePe({ fileLength: 0x220, rawOff: 0x200, rawSize: 0x20, virtualSize: 0x40 }));
  assert.strictEqual(pe.va2off(0x40101F), 0x21F);
  assert.strictEqual(pe.va2offInfo(0x40101F).hasRaw, true);
  assert.strictEqual(pe.off2va(0x21F), 0x40101F);
  assert.strictEqual(pe.off2va(0x220), -1, 'offset exactly at EOF has no VA');
}

// A claimed raw range cut short at EOF maps only the bytes actually present.
{
  const pe = readPE(makePe({ fileLength: 0x210, rawOff: 0x200, rawSize: 0x100, virtualSize: 0x120 }));
  assert.strictEqual(pe.va2off(0x40100F), 0x20F);
  assert.strictEqual(pe.va2offInfo(0x40100F).hasRaw, true);
  assert.strictEqual(pe.va2off(0x401010), -1, 'first missing raw byte has no file offset');
  assert.strictEqual(pe.va2offInfo(0x401010).hasRaw, false);
  assert.strictEqual(pe.off2va(0x20F), 0x40100F);
  assert.strictEqual(pe.off2va(0x210), -1, 'reverse lookup must stop at EOF');
  assert.strictEqual(pe.off2va(0x250), -1, 'reverse lookup must reject missing claimed tail');
}

// Virtual section bytes after SizeOfRawData remain real addresses, but not file bytes.
{
  const pe = readPE(makePe({ fileLength: 0x240, rawOff: 0x200, rawSize: 0x20, virtualSize: 0x40 }));
  assert.ok(pe.sectionForVa(0x40103F));
  assert.strictEqual(pe.va2offInfo(0x401020).hasRaw, false);
  assert.strictEqual(pe.va2off(0x401020), -1);
  assert.strictEqual(pe.va2off(0x40103F), -1);
}

// Header truncation is already rejected by DataView bounds checks; keep that
// behavior while changing only raw section byte availability semantics.
{
  const badOffset = new Uint8Array(0x40);
  new DataView(badOffset.buffer).setUint16(0, 0x5A4D, true);
  new DataView(badOffset.buffer).setUint32(0x3C, 0xFFFFFFF0, true);
  assert.throws(() => readPE(badOffset), RangeError, 'truncated PE header offset is rejected');

  const truncatedSections = makePe({ fileLength: 0x220, rawOff: 0x200, rawSize: 0x20, virtualSize: 0x40 }).subarray(0, 0x19B);
  assert.throws(() => readPE(truncatedSections), RangeError, 'truncated section table is rejected');
}

// The input view's boundary is authoritative even with a larger backing buffer.
{
  const bytes = makePe({ fileLength: 0x300, rawSize: 0x100 });
  const pe = readPE(bytes.subarray(0, 0x210));
  assert.strictEqual(pe.va2off(0x401010), -1);
  assert.strictEqual(pe.off2va(0x210), -1);
  const absent = readPE(makePe({ fileLength: 0x200, rawOff: 0x300 }));
  assert.strictEqual(absent.va2offInfo(0x401000).hasRaw, false);
  assert.strictEqual(absent.off2va(0x300), -1);
}

console.log('PASS PE raw mapping: file bounds, truncated sections, BSS and input views');
