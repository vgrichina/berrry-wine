'use strict';
// Authored PE exercising the actual imported CRT and cdecl callback path.
const { pe, X86, BASE, u32 } = require('../test/test-dll-lifecycle-real-pe');
const names = ['_initterm_e', '_initterm', 'atexit', '_cexit', 'exit'];
const address = r => BASE + r;
const call = n => [0xff, 0x15, ...u32(address(0x1900 + n * 4))];
const invoke = (n, start, end) => [0x68, ...u32(address(end)), 0x68, ...u32(address(start)), ...call(n), 0x83, 0xc4, 8];
const save = r => [0xa3, ...u32(address(r))];
const inc = r => [0xff, 5, ...u32(address(r))];
const ret = n => [0xb8, ...u32(n), 0xc3];
function controlImage() {
  const a = new X86();
  // Distinct callee-saved registers and saved ESP checked after all nested calls.
  a.emit(0xbb, u32(0x11223344), 0xbe, u32(0x22334455), 0xbf, u32(0x33445566), 0xbd, u32(0x44556677));
  a.emit(0x89, 0x25, u32(address(0x14c0)));
  a.emit(invoke(0, 0x1400, 0x1400)).checkEax(0); // empty
  a.emit(invoke(0, 0x1400, 0x1408)).checkEax(0); // all NULL
  a.emit(invoke(0, 0x1410, 0x1424)).checkEax(0); // NULL/success/nested/success/NULL
  a.emit(invoke(0, 0x1430, 0x1440)).checkEax(0x80000027); // first failure stops
  a.emit(invoke(1, 0x1450, 0x1458)); // void _initterm ignores nonzero and continues
  a.push(address(0x2a00)).emit(call(2), 0x83, 0xc4, 4).checkEax(0);
  a.emit(call(3)); // _cexit invokes registered callback
  for (const [r, value] of [[0x1480, 4], [0x1484, 1], [0x1488, 0], [0x148c, 1], [0x1490, 1], [0x1494, 0], [0x1498, 1], [0x149c, 2]]) {
    a.emit(0xa1, u32(address(r))).checkEax(value);
  }
  for (const [op, value] of [[0xd8, 0x11223344], [0xf0, 0x22334455], [0xf8, 0x33445566], [0xe8, 0x44556677]]) a.emit(0x89, op).checkEax(value);
  a.emit(0x89, 0xe0, 0x3b, 5, u32(address(0x14c0))).branch([0x0f, 0x85], 'failure-250');
  a.emit(0xc7, 5, u32(address(0x14d0)), u32(0x600dcafe)).push(0).emit(call(4), 0xcc);
  a.label('failure-250').push(250).emit(call(4), 0xcc);
  // X86's failure builder uses kernel ExitProcess's index; emit CRT exit here.
  for (const [label, id] of a.failures) a.label(label).push(id).emit(call(4), 0xcc);
  a.failures = [];
  const b = pe([[0x2000, a.finish()],
    [0x2800, [...inc(0x1480), ...ret(0)]],
    [0x2840, [...inc(0x1484), ...invoke(0, 0x1460, 0x1468), ...save(0x1494), ...invoke(0, 0x1470, 0x1474), ...save(0x1490), ...ret(0)]],
    [0x2900, [...inc(0x1488), ...ret(0)]],
    [0x2940, [...inc(0x148c), ...ret(0x80000027)]],
    [0x2980, [...inc(0x149c), ...ret(1)]],
    [0x29c0, [...ret(0x1234)]],
    [0x2a00, [...inc(0x1498), ...invoke(0, 0x1400, 0x1400), 0xc3]],
    [0x1400, Array(8).fill(0)],
    [0x1410, [0, address(0x2800), address(0x2840), address(0x2800), 0].flatMap(u32)],
    [0x1430, [address(0x2800), 0, address(0x2940), address(0x2900)].flatMap(u32)],
    [0x1450, [address(0x29c0), address(0x2980)].flatMap(u32)],
    [0x1460, [0, address(0x2800)].flatMap(u32)],
    [0x1470, [address(0x2980)].flatMap(u32)]]);
  const raw = r => r - 0x1000 + 0x200;
  b.fill(0, raw(0x1880), raw(0x1880) + 16); b.write('MSVCR110.dll\0', raw(0x1880));
  b.fill(0, raw(0x1900), raw(0x1980)); let cursor = 0x1a00;
  for (const [i, name] of names.entries()) { b.writeUInt32LE(cursor, raw(0x1900 + i * 4)); b.write(name + '\0', raw(cursor + 2)); cursor += name.length + 3; }
  return b;
}
module.exports = { controlImage };
