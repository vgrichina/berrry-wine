'use strict';
// Deterministic PE fixture. Generating it does not instantiate the emulator.
const assert = require('node:assert/strict');
const BASE = 0x400000;
const API = ['GetModuleHandleA', 'LoadLibraryA', 'GetProcAddress', 'FreeLibrary',
  'SetLastError', 'GetLastError', 'GetModuleFileNameA'];
const iat = name => { assert(API.includes(name)); return BASE + 0x1900 + API.indexOf(name) * 4; };
function makeFixture() {
  const b = Buffer.alloc(0x2200), p = 0x80, o = p + 24, s = o + 0xe0;
  b.writeUInt16LE(0x5a4d, 0); b.writeUInt32LE(p, 0x3c);
  b.writeUInt32LE(0x4550, p); b.writeUInt16LE(0x14c, p + 4);
  b.writeUInt16LE(1, p + 6); b.writeUInt16LE(0xe0, p + 20); b.writeUInt16LE(0x010e, p + 22);
  b.writeUInt16LE(0x10b, o); b.writeUInt32LE(0x2000, o + 16); b.writeUInt32LE(BASE, o + 28);
  b.writeUInt32LE(0x1000, o + 32); b.writeUInt32LE(0x200, o + 36);
  b.writeUInt32LE(0x3000, o + 56); b.writeUInt32LE(0x200, o + 60);
  b.writeUInt16LE(3, o + 68); b.writeUInt32LE(0x100000, o + 72);
  b.writeUInt32LE(0x1000, o + 76); b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(0x2000, s + 8); b.writeUInt32LE(0x1000, s + 12);
  b.writeUInt32LE(0x2000, s + 16); b.writeUInt32LE(0x200, s + 20); b.writeUInt32LE(0xe0000060, s + 36);
  const raw = rva => rva - 0x1000 + 0x200;
  b.writeUInt32LE(0x1800, o + 104); b.writeUInt32LE(40, o + 108);
  b.writeUInt32LE(0x1900, raw(0x1800)); b.writeUInt32LE(0x1880, raw(0x180c));
  b.writeUInt32LE(0x1900, raw(0x1810)); b.write('kernel32.dll\0', raw(0x1880));
  let cursor = 0x1a00;
  for (const name of API) {
    b.writeUInt32LE(cursor, raw(iat(name) - BASE)); b.write(name + '\0', raw(cursor + 2));
    cursor += name.length + 3;
  }
  // EXE-only exported callback; neither entry point nor INT3 may be executed.
  b.writeUInt32LE(0x1100, o + 96); b.writeUInt32LE(0x100, o + 100);
  for (const [offset, value] of [[12, 0x1180], [16, 1], [20, 1], [24, 1],
    [28, 0x1140], [32, 0x1144], [36, 0x1148]]) b.writeUInt32LE(value, raw(0x1100 + offset));
  b.writeUInt32LE(0x2100, raw(0x1140)); b.writeUInt32LE(0x1190, raw(0x1144));
  b.write('fixture.exe\0', raw(0x1180)); b.write('FixtureExeCallback\0', raw(0x1190));
  b[raw(0x2000)] = 0xcc;
  Buffer.from([0xb8, 0x78, 0x56, 0x34, 0x12, 0xc3]).copy(b, raw(0x2100));
  return b;
}
module.exports = { makeFixture, BASE, API, iat };
