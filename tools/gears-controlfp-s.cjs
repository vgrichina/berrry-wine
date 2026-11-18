'use strict';
const { pe, X86, BASE, u32 } = require('../test/test-dll-lifecycle-real-pe');
const names = ['_controlfp_s', '_controlfp', 'exit', '_errno'];
const addr = r => BASE + r;
const api = n => [0xff, 0x15, ...u32(addr(0x1900 + n * 4))];
const invoke = (out, value, mask) => [0x68, ...u32(mask), 0x68, ...u32(value), 0x68, ...u32(out), ...api(0), 0x83, 0xc4, 12];
function controlImage({ invalid = false } = {}) {
  const a = new X86();
  a.emit(0xbb, u32(0x11223344), 0xbe, u32(0x22334455), 0xbf, u32(0x33445566), 0xbd, u32(0x44556677),
    0xb9, u32(0x55667788), 0xba, u32(0x66778899), 0x89, 0x25, u32(addr(0x14c0)));
  a.emit(0xd9, 0x2d, u32(addr(0x1400))); // FLDCW 027f
  if (invalid) {
    a.emit(invoke(addr(0x1410), 0x80000000, 0x80000000));
    a.push(252).emit(api(2), 0xcc); // default invalid parameter must not return
  } else {
    a.emit(api(3), 0xc7, 0, u32(123)); // successful calls preserve errno
    a.emit(invoke(0, 0x10000, 0x30000)).checkEax(0); // exact affected call
    a.emit(invoke(addr(0x1410), 0, 0)).checkEax(0).emit(0xa1, u32(addr(0x1410))).checkEax(0x9001f);
    a.emit(invoke(addr(0x1410), 0x20000, 0x30000)).checkEax(0).emit(0xa1, u32(addr(0x1410))).checkEax(0xa001f);
    a.emit(0xd9, 0x3d, u32(addr(0x1404)), 0x0f, 0xb7, 5, u32(addr(0x1404))).checkEax(0x007f);
    a.emit(invoke(addr(0x1410), 0x100, 0x300)).checkEax(0).emit(0xa1, u32(addr(0x1410))).checkEax(0xa011f);
    a.emit(0xdd, 5, u32(addr(0x1420)), 0xdb, 0x1d, u32(addr(0x1440)), 0xa1, u32(addr(0x1440))).checkEax(0xfffffffe);
    a.emit(invoke(0, 0x300, 0x300)).checkEax(0);
    a.emit(0xdd, 5, u32(addr(0x1420)), 0xdb, 0x1d, u32(addr(0x1440)), 0xa1, u32(addr(0x1440))).checkEax(0xffffffff);
    a.emit(invoke(addr(0x1410), 0, 0x80000)).checkEax(0).emit(0xa1, u32(addr(0x1410))).checkEax(0xa031f);
    a.emit(invoke(addr(0x1410), 0x01000000, 0x03000000)).checkEax(0).emit(0xa1, u32(addr(0x1410))).checkEax(0xa031f);
    a.emit(invoke(addr(0x1410), 0xffffffff, 0)).checkEax(0).emit(0xa1, u32(addr(0x1410))).checkEax(0xa031f);
    a.emit(invoke(addr(0x1410), 0, 8)).checkEax(0).emit(0xa1, u32(addr(0x1410))).checkEax(0xa0317);
    // The old _controlfp entry sees the same live state and changes it back.
    a.push(0x7031f).push(0x1001f).emit(api(1), 0x83, 0xc4, 8).checkEax(0x9001f);
    a.emit(invoke(addr(0x1410), 0, 0)).checkEax(0).emit(0xa1, u32(addr(0x1410))).checkEax(0x9001f);
    for (const [op, v] of [[0xd8, 0x11223344], [0xf0, 0x22334455], [0xf8, 0x33445566],
      [0xe8, 0x44556677], [0xc8, 0x55667788], [0xd0, 0x66778899]]) a.emit(0x89, op).checkEax(v);
    a.emit(api(3), 0x8b, 0).checkEax(123);
    a.emit(0x89, 0xe0, 0x3b, 5, u32(addr(0x14c0))).branch([0x0f, 0x85], 'bad');
    a.emit(0xc7, 5, u32(addr(0x14d0)), u32(0x600dcafe)).push(0).emit(api(2), 0xcc);
  }
  a.label('bad').push(250).emit(api(2), 0xcc);
  for (const [label, id] of a.failures) a.label(label).push(id).emit(api(2), 0xcc);
  a.failures = [];
  const double = Buffer.alloc(8); double.writeDoubleLE(-1.25);
  const b = pe([[0x2000, a.finish()], [0x1400, [0x7f, 2]], [0x1420, double]]);
  const raw = r => r - 0x1000 + 0x200;
  b.fill(0, raw(0x1880), raw(0x18a0)); b.write('MSVCR110.dll\0', raw(0x1880));
  b.fill(0, raw(0x1900), raw(0x1d00)); let cursor = 0x1a00;
  for (const [i, name] of names.entries()) { b.writeUInt32LE(cursor, raw(0x1900 + i * 4)); b.write(name + '\0', raw(cursor + 2)); cursor += name.length + 3; }
  return b;
}
module.exports = { controlImage };
