'use strict';
// Real imported calls: no replacement guest instructions or API mocks.
const { pe, X86, BASE, u32 } = require('../test/test-dll-lifecycle-real-pe');
const names = ['EncodePointer', 'DecodePointer', 'ExitProcess', 'CreateThread',
  'WaitForSingleObject', 'GetExitCodeThread', 'ExitThread', 'SetLastError', 'GetLastError'];
const addr = r => BASE + r;
const api = n => [0xff, 0x15, ...u32(addr(0x1900 + n * 4))];
const save = r => [0xa3, ...u32(addr(r))];
const load = r => [0xa1, ...u32(addr(r))];
const vectors = [0, 1, 0x7fffffff, 0x80000000, 0x80000001, 0xffffffff, 0x402c80, 0x55555555, 0xaaaaaaaa];
function controlImage({ threads = false } = {}) {
  const a = new X86();
  a.emit(0xbb, u32(0x11223344), 0xbe, u32(0x22334455), 0xbf, u32(0x33445566), 0xbd, u32(0x44556677),
    0xb9, u32(0x55667788), 0xba, u32(0x66778899), 0x89, 0x25, u32(addr(0x14c0)));
  a.push(0x80000057).emit(api(7));
  for (const [i, v] of vectors.entries()) {
    const r = 0x1420 + i * 4;
    a.push(v).emit(api(0), save(r), 0x50, api(1)).checkEax(v);
    a.push(v).emit(api(0), 0x3b, 5, u32(addr(r))).branch([0x0f, 0x85], 'bad');
    // Also exercise encode(decode(bits)) for arbitrary encoded DWORDs.
    a.push(v).emit(api(1), 0x50, api(0)).checkEax(v);
  }
  a.emit(load(0x1420), 0x85, 0xc0).branch([0x0f, 0x84], 'bad'); // encoded NULL is opaque
  for (const [op, v] of [[0xd8, 0x11223344], [0xf0, 0x22334455], [0xf8, 0x33445566],
    [0xe8, 0x44556677], [0xc8, 0x55667788], [0xd0, 0x66778899]]) a.emit(0x89, op).checkEax(v);
  a.emit(api(8)).checkEax(0x80000057);
  // CRT consumer calls a decoded function pointer in a genuine cdecl initializer.
  a.push(addr(0x1404)).push(addr(0x1400)).emit(0xff, 0x15, u32(addr(0x1980)), 0x83, 0xc4, 8).checkEax(0);
  a.emit(load(0x14d4)).checkEax(1);
  if (threads) {
    // Both guest threads decode a main-thread value and encode the same value.
    for (let i = 0; i < 2; i++) a.push(0).push(0).push(i).push(addr(0x2a00)).push(0).push(0)
      .emit(api(3), save(0x14b0 + i * 4));
    for (let i = 0; i < 2; i++) {
      a.push(10000).emit(0xff, 0x35, u32(addr(0x14b0 + i * 4)), api(4)).checkEax(0);
      a.push(addr(0x14b8)).emit(0xff, 0x35, u32(addr(0x14b0 + i * 4)), api(5)).checkEax(1);
      a.emit(load(0x14b8)).checkEax(0);
    }
  }
  a.emit(0x89, 0xe0, 0x3b, 5, u32(addr(0x14c0))).branch([0x0f, 0x85], 'bad');
  a.emit(0xc7, 5, u32(addr(0x14d0)), u32(0x600dcafe)).push(0).emit(api(2), 0xcc);
  a.label('bad').push(250).emit(api(2), 0xcc);
  for (const [label, id] of a.failures) a.label(label).push(id).emit(api(2), 0xcc);
  a.failures = [];
  const t = new X86();
  t.emit(load(0x1434), 0x50, api(1)).checkEax(0xffffffff);
  t.push(0xffffffff).emit(api(0), 0x3b, 5, u32(addr(0x1434))).branch([0x0f, 0x85], 'thread-bad');
  t.push(0).emit(api(6), 0xcc);
  t.label('thread-bad').push(251).emit(api(6), 0xcc);
  for (const [label, id] of t.failures) t.label(label).push(id).emit(api(6), 0xcc);
  t.failures = [];
  const b = pe([[0x2000, a.finish()], [0x2a00, t.finish()],
    [0x1400, u32(addr(0x2c00))],
    [0x2c00, [0x68, ...u32(addr(0x2c80)), ...api(0), 0x50, ...api(1), 0xff, 0xd0, 0x31, 0xc0, 0xc3]],
    [0x2c80, [0xff, 5, ...u32(addr(0x14d4)), 0xc3]],
    // Independently callable imported API probes for cross-instance assertions.
    [0x2d00, [...load(0x14e0), 0x50, ...api(0), ...save(0x14e4), 0xc3]],
    [0x2d40, [...load(0x14e0), 0x50, ...api(1), ...save(0x14e4), 0xc3]]]);
  const raw = r => r - 0x1000 + 0x200;
  b.fill(0, raw(0x1900), raw(0x1d00)); let cursor = 0x1a00;
  for (const [i, name] of names.entries()) {
    b.writeUInt32LE(cursor, raw(0x1900 + i * 4)); b.write(name + '\0', raw(cursor + 2)); cursor += name.length + 3;
  }
  // Second import descriptor: CRT _initterm_e, with independent IAT.
  b.writeUInt32LE(0x1980, raw(0x1814)); b.writeUInt32LE(0x18a0, raw(0x1820));
  b.writeUInt32LE(0x1980, raw(0x1824)); b.write('MSVCR110.dll\0', raw(0x18a0));
  b.writeUInt32LE(cursor, raw(0x1980)); b.write('_initterm_e\0', raw(cursor + 2));
  b.writeUInt32LE(60, 0x80 + 24 + 108);
  return b;
}
module.exports = { controlImage, vectors };
