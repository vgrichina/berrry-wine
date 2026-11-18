'use strict';
const { pe, X86, BASE, u32 } = require('../test/test-dll-lifecycle-real-pe');
const names = ['SetUnhandledExceptionFilter', 'UnhandledExceptionFilter', 'ExitProcess',
  'CreateThread', 'WaitForSingleObject', 'GetExitCodeThread', 'ExitThread',
  'CreateEventA', 'SetEvent', 'GetCurrentThreadId', 'RaiseException', 'GetLastError', 'SetLastError'];
const addr = r => BASE + r;
const api = n => [0xff, 0x15, ...u32(addr(0x1900 + n * 4))];
const load = r => [0xa1, ...u32(addr(r))];
const save = r => [0xa3, ...u32(addr(r))];
function finish(a) {
  for (const [label, id] of a.failures) a.label(label).push(id).emit(api(2), 0xcc);
  a.failures = []; return a.finish();
}
function image(parts) {
  const b = pe(parts), raw = r => r - 0x1000 + 0x200;
  b.fill(0, raw(0x1900), raw(0x1d00)); let cursor = 0x1a00;
  for (const [i, name] of names.entries()) {
    b.writeUInt32LE(cursor, raw(0x1900 + i * 4)); b.write(name + '\0', raw(cursor + 2)); cursor += name.length + 3;
  }
  b.writeUInt32LE(0x1980, raw(0x1814)); b.writeUInt32LE(0x18a0, raw(0x1820));
  b.writeUInt32LE(0x1980, raw(0x1824)); b.write('MSVCR110.dll\0', raw(0x18a0));
  b.writeUInt32LE(cursor, raw(0x1980)); b.write('__crtSetUnhandledExceptionFilter\0', raw(cursor + 2));
  b.writeUInt32LE(60, 0x80 + 24 + 108); return b;
}
const crt = [0xff, 0x15, ...u32(addr(0x1980)), 0x83, 0xc4, 4];
function controlImage({ threads = false, crtWrapper = true } = {}) {
  const a = new X86();
  a.emit(0x89, 0x25, u32(addr(0x14c0)));
  if (threads) {
    for (let i = 0; i < 2; i++) a.push(0).push(0).push(1).push(0).emit(api(7), save(0x14a0 + i * 4));
    a.push(0).push(0).push(0).push(addr(0x2a00)).push(0).push(0).emit(api(3), save(0x14b0));
    a.push(10000).emit(0xff, 0x35, u32(addr(0x14a0)), api(4)).checkEax(0);
  }
  a.push(addr(0x2600)).emit(crtWrapper ? crt : api(0)).checkEax(0);
  if (threads) {
    a.emit(0xff, 0x35, u32(addr(0x14a4)), api(8));
    a.push(10000).emit(0xff, 0x35, u32(addr(0x14b0)), api(4)).checkEax(0);
    a.push(addr(0x14b8)).emit(0xff, 0x35, u32(addr(0x14b0)), api(5)).checkEax(1);
    a.emit(load(0x14b8)).checkEax(0);
  }
  // The existing thread replaced the process slot with B. Main observes it.
  a.push(addr(0x2600)).emit(api(0)).checkEax(threads ? addr(0x2800) : addr(0x2600));
  if (threads) {
    // A future thread sees the current registration too.
    a.push(0).push(0).push(1).push(addr(0x2a00)).push(0).push(0).emit(api(3), save(0x14b0));
    a.push(10000).emit(0xff, 0x35, u32(addr(0x14b0)), api(4)).checkEax(0);
    a.push(addr(0x14b8)).emit(0xff, 0x35, u32(addr(0x14b0)), api(5)).checkEax(1);
    a.emit(load(0x14b8)).checkEax(0);
    a.push(addr(0x2600)).emit(api(0)).checkEax(addr(0x2800));
  }
  a.emit(api(9), save(0x1410));
  // A nests a public UnhandledExceptionFilter call through B, then returns -1.
  // Both callbacks intentionally clobber GPRs; each adapter owns restoration.
  a.emit(0xbb, u32(0x11223344), 0xbe, u32(0x22334455), 0xbf, u32(0x33445566),
    0xbd, u32(0x44556677), 0xb9, u32(0x55667788), 0xba, u32(0x66778899));
  a.emit(0xf9, 0x9c, 0x8f, 5, u32(addr(0x14c4)));
  a.push(addr(0x1500)).emit(api(1), save(0x14c8), 0x9c, 0x58, 0x3b, 5, u32(addr(0x14c4)))
    .branch([0x0f, 0x85], 'bad');
  a.emit(load(0x14c8)).checkEax(0xffffffff);
  for (const [op, v] of [[0xd8, 0x11223344], [0xf0, 0x22334455], [0xf8, 0x33445566],
    [0xe8, 0x44556677], [0xc8, 0x55667788], [0xd0, 0x66778899]]) a.emit(0x89, op).checkEax(v);
  a.push(addr(0x2800)).emit(api(0)).checkEax(addr(0x2600));
  a.push(addr(0x1500)).emit(api(1)).checkEax(1);
  a.push(addr(0x2840)).emit(api(0)).checkEax(addr(0x2800));
  a.push(addr(0x1500)).emit(api(1)).checkEax(1); // SEARCH follows default handling
  a.push(0).emit(crtWrapper ? crt : api(0)).checkEax(addr(0x2840));
  a.push(addr(0x1500)).emit(api(1)).checkEax(1);
  a.emit(0x89, 0xe0, 0x3b, 5, u32(addr(0x14c0))).branch([0x0f, 0x85], 'bad');
  a.emit(0xc7, 5, u32(addr(0x14d0)), u32(0x600dcafe)).push(0).emit(api(2), 0xcc);
  a.label('bad').push(250).emit(api(2), 0xcc);
  const f = new X86();
  f.emit(0x8b, 0x44, 0x24, 4).checkEax(addr(0x1500));
  f.emit(0x8b, 0, 0x8b, 0).checkEax(0xe1234567);
  f.emit(0x8b, 0x44, 0x24, 4, 0x8b, 0x40, 4, 0x8b, 0x80, u32(0xb8)).checkEax(0x12345678);
  f.emit(api(9), 0x3b, 5, u32(addr(0x1410))).branch([0x0f, 0x85], 'wrong-thread');
  f.push(addr(0x2800)).emit(api(0)).checkEax(addr(0x2600));
  f.push(addr(0x1500)).emit(api(1)).checkEax(1);
  f.push(addr(0x2600)).emit(api(0)).checkEax(addr(0x2800));
  f.emit(0xff, 5, u32(addr(0x1414)), 0xbb, u32(0xbadbad), 0xb9, u32(0xbadbad), 0xba, u32(0xbadbad),
    0xbe, u32(0xbadbad), 0xbf, u32(0xbadbad), 0xbd, u32(0xbadbad), 0xb8, u32(0xffffffff), 0xc2, 4, 0);
  f.label('wrong-thread').push(249).emit(api(2), 0xcc);
  const t = new X86();
  t.emit(0x83, 0x7c, 0x24, 4, 0).branch([0x0f, 0x85], 'ready');
  t.emit(0xff, 0x35, u32(addr(0x14a0)), api(8));
  t.push(10000).emit(0xff, 0x35, u32(addr(0x14a4)), api(4)).checkEax(0);
  t.label('ready').emit(api(9), save(0x1410)).push(addr(0x1500)).emit(api(1)).checkEax(0xffffffff);
  t.push(addr(0x2800)).emit(api(0)).checkEax(addr(0x2600));
  t.push(0).emit(api(6), 0xcc);
  return image([[0x2000, finish(a)], [0x2600, finish(f)], [0x2800, [0xb8, 1, 0, 0, 0, 0xc2, 4, 0]],
    [0x2840, [0x31, 0xc0, 0xc2, 4, 0]], [0x2a00, finish(t)],
    [0x1500, [...u32(addr(0x1520)), ...u32(addr(0x1580))]], [0x1520, u32(0xe1234567)],
    [0x1638, u32(0x12345678)]]);
}
function faultImage({ hardware = false, disposition = -1, flags = 0, unsupported = false, threads = false } = {}) {
  const a = new X86(), f = new X86(), resume = new X86();
  if (!threads) a.push(addr(0x2600)).emit(api(0));
  a.emit(api(9), save(0x1444));
  a.emit(0xbb, u32(0x11223344));
  if (unsupported) a.emit(0xff, 0x15, u32(addr(0x1984)));
  else if (hardware) a.emit(0xb8, 42, 0, 0, 0, 0x31, 0xd2, 0x31, 0xc9, 0xf7, 0xf1);
  else a.push(addr(0x1450)).push(2).push(flags).push(0xe1234567).emit(api(10));
  a.push(248).emit(api(2), 0xcc); // must resume at context-edited target
  f.emit(api(9), 0x3b, 5, u32(addr(0x1444))).branch([0x0f, 0x85], 'wrong-thread');
  f.emit(0x8b, 0x44, 0x24, 4, 0x8b, 0).emit(0x8b, 0).checkEax(hardware ? 0xc0000094 : 0xe1234567);
  if (!hardware) {
    f.emit(0x8b, 0x44, 0x24, 4, 0x8b, 0, 0x8b, 0x40, 4).checkEax(flags);
    for (const [off, value] of [[16, 2], [20, 0xabcdef01], [24, 0x12345678]])
      f.emit(0x8b, 0x44, 0x24, 4, 0x8b, 0, 0x8b, 0x40, off).checkEax(value);
  } else {
    for (const off of [4, 8, 16])
      f.emit(0x8b, 0x44, 0x24, 4, 0x8b, 0, 0x8b, 0x40, off).checkEax(0);
    f.emit(0x8b, 0x44, 0x24, 4, 0x8b, 0x48, 4, 0x8b, 0, 0x8b, 0x40, 12,
      0x3b, 0x81, u32(0xb8)).branch([0x0f, 0x85], 'wrong-context');
    f.emit(0x8b, 0x81, u32(0xb0)).checkEax(42);
  }
  f.emit(0x8b, 0x44, 0x24, 4, 0x8b, 0x40, 4, 0x8b, 0).checkEax(0x10007);
  f.emit(0x8b, 0x44, 0x24, 4, 0x8b, 0x40, 4, 0x8b, 0x80, u32(0xa4)).checkEax(0x11223344);
  f.emit(0x8b, 0x44, 0x24, 4, 0x8b, 0x40, 4, 0xc7, 0x80, u32(0xb8), u32(addr(0x2e00)),
    0xc7, 0x80, u32(0xb0), u32(77), 0xb8, u32(disposition), 0xc2, 4, 0);
  f.label('wrong-thread').push(247).emit(api(2), 0xcc);
  f.label('wrong-context').push(246).emit(api(2), 0xcc);
  resume.checkEax(77).emit(0x89, 0xd8).checkEax(0x11223344);
  resume.emit(0xc7, 5, u32(addr(0x14d0)), u32(0x600dcafe)).push(0).emit(api(2), 0xcc);
  const b = image([[0x2000, finish(a)], [0x2600, finish(f)], [0x2e00, finish(resume)],
    [0x1450, [...u32(0xabcdef01), ...u32(0x12345678)]]]);
  if (threads) {
    const main = new X86(), threadResume = new X86();
    main.push(addr(0x2600)).emit(api(0)).checkEax(0);
    main.push(0).push(0).push(0).push(addr(0x2b00)).push(0).push(0).emit(api(3), save(0x14b0));
    main.push(10000).emit(0xff, 0x35, u32(addr(0x14b0)), api(4)).checkEax(0);
    main.push(addr(0x14b8)).emit(0xff, 0x35, u32(addr(0x14b0)), api(5)).checkEax(1);
    main.emit(load(0x14b8)).checkEax(0).emit(load(0x14d0)).checkEax(0x600dcafe).push(0).emit(api(2), 0xcc);
    threadResume.checkEax(77).emit(0x89, 0xd8).checkEax(0x11223344);
    threadResume.emit(0xc7, 5, u32(addr(0x14d0)), u32(0x600dcafe)).push(0).emit(api(6), 0xcc);
    const raw = r => r - 0x1000 + 0x200;
    const threadCode = Buffer.from(b.subarray(raw(0x2000), raw(0x2200)));
    b.fill(0, raw(0x2000), raw(0x2500)); Buffer.from(finish(main)).copy(b, raw(0x2000));
    threadCode.copy(b, raw(0x2b00)); Buffer.from(finish(threadResume)).copy(b, raw(0x2e00));
  }
  if (unsupported) {
    const raw = r => r - 0x1000 + 0x200;
    b.writeUInt32LE(0x1c80, raw(0x1984)); b.write('_set_invalid_parameter_handler\0', raw(0x1c82));
  }
  return b;
}
module.exports = { controlImage, faultImage };
