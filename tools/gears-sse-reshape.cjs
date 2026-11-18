'use strict';
// Small self-checking PE inputs, also uploaded through the ordinary browser UI.
const { pe, X86, BASE, u32 } = require('../test/test-dll-lifecycle-real-pe');
const INPUT = 0x430000, OUT = INPUT + 32, FLAGS = OUT + 16;
const words = values => values.flatMap(u32);
const bits = x => { const b = Buffer.alloc(4); b.writeFloatLE(x); return b.readUInt32LE(); };
const double = x => { const b = Buffer.alloc(8); b.writeDoubleLE(x); return [b.readUInt32LE(), b.readUInt32LE(4)]; };
const promote = x => {
  if ((x & 0x7f800000) === 0x7f800000 && (x & 0x7fffff)) {
    const b = 0x7ff8000000000000n | (BigInt(x >>> 31) << 63n) | (BigInt(x & 0x7fffff) << 29n);
    return [Number(b & 0xffffffffn), Number(b >> 32n)];
  }
  const b = Buffer.alloc(4); b.writeUInt32LE(x >>> 0); return double(b.readFloatLE());
};
function image(parts) {
  const b = Buffer.alloc(0x40200); pe([]).copy(b);
  const o = 0x80 + 24, s = o + 0xe0;
  b.writeUInt32LE(0x41000, o + 56); b.writeUInt32LE(0x40000, s + 8); b.writeUInt32LE(0x40000, s + 16);
  for (const [r, bytes] of parts) Buffer.from(bytes).copy(b, r - 0x1000 + 0x200);
  return b;
}
function controlImage() {
  const a = new X86(); let cases = 0;
  const put = (addr, values) => values.forEach((v, i) => a.emit(0xc7, 5, u32(addr + i * 4), u32(v)));
  const load = (reg, addr) => a.emit(0x0f, 0x10, 5 + reg * 8, u32(addr));
  const save = (reg, addr = OUT) => a.emit(0x0f, 0x11, 5 + reg * 8, u32(addr));
  function check(expected) {
    save(0); a.emit(0x9c, 0x8f, 5, u32(FLAGS));
    // MOVs to snapshots do not change flags or the GPRs being checked.
    for (const reg of [0, 1, 2, 3, 5, 6, 7]) a.emit(0x89, 5 + reg * 8, u32(OUT + 32 + reg * 4));
    expected.forEach((v, i) => a.emit(0xa1, u32(OUT + i * 4)).checkEax(v));
    a.emit(0xa1, u32(FLAGS), 0x3b, 5, u32(OUT + 84)).branch([0x0f, 0x85], 'bad-flags');
    for (const reg of [0, 1, 2, 3, 5, 6, 7])
      a.emit(0xa1, u32(OUT + 32 + reg * 4)).checkEax(0x11220000 + reg);
    cases++;
  }
  function seed() {
    for (const reg of [0, 1, 2, 3, 5, 6, 7]) a.emit(0xb8 + reg, u32(0x11220000 + reg));
    a.push(0x8d7).emit(0x9d, 0x9c, 0x8f, 5, u32(OUT + 84));
  }
  const upper = [0x7f812345, 0xdeadbeef, 0x80000000], initial = [bits(7), ...upper];
  // All GPR and XMM register selectors, both transfer directions; memory
  // MOVD is unaligned and touches exactly four bytes.
  for (let r = 0; r < 8; r++) for (const mem of [false, true]) {
    put(INPUT, initial); load(0, INPUT); seed();
    a.emit(0x66, 0x0f, 0x6e, ...(mem ? [5, ...u32(INPUT + 1)] : [0xc0 + r]));
    const shifted = (initial[0] >>> 8) | (upper[0] << 24);
    if (r === 4 && !mem) { // ESP must survive the tested instruction.
      a.emit(0x89, 0x25, u32(OUT + 80)); save(0);
      a.emit(0xa1, u32(OUT), 0x3b, 5, u32(OUT + 80)).branch([0x0f, 0x85], 'bad-esp');
    } else check([mem ? shifted >>> 0 : 0x11220000 + r, 0, 0, 0]);
    put(INPUT, [0x89abcdef, ...upper]); load(r, INPUT); seed();
    a.emit(0x66, 0x0f, 0x7e, 0xc0 + r * 8 + 0); // XMMr -> EAX
    a.checkEax(0x89abcdef); save(r);
    [0x89abcdef, ...upper].forEach((v, i) => a.emit(0xa1, u32(OUT + i * 4)).checkEax(v));
    a.emit(0x66, 0x0f, 0x7e, 5 + r * 8, u32(OUT + 1));
    a.emit(0xa1, u32(OUT + 1)).checkEax(0x89abcdef);
  }
  for (const mem of [false, true]) for (const values of [
    [0, -1, 2147483647, -2147483648], [16777217, 16777219, -16777217, -16777219],
    [33554431, -33554431, 123456789, -123456789],
  ]) {
    put(INPUT, values); load(1, INPUT); seed();
    a.emit(0x0f, 0x5b, ...(mem ? [5, ...u32(INPUT)] : [0xc1]));
    check(values.map(x => bits(Math.fround(x))));
    // Aliased source/destination reads all input lanes before replacing them.
    load(0, INPUT); seed(); a.emit(0x0f, 0x5b, 0xc0); check(values.map(x => bits(Math.fround(x))));
  }
  for (const mem of [false, true]) for (const source of [
    [bits(-0), bits(Infinity), 0x12345678, 0x90abcdef],
    [1, 0x807fffff, 0x12345678, 0x90abcdef],
    [0x7f812345, 0xffc54321, 0x12345678, 0x90abcdef],
    [bits(1.5), bits(-2.25), 0x12345678, 0x90abcdef],
  ]) {
    for (const [prefix, opcode, expect] of [
      [[0xf2], 0x10, [source[0], source[1], ...(mem ? [0, 0] : initial.slice(2))]],
      [[], 0x5a, [...promote(source[0]), ...promote(source[1])]],
      [[0xf3], 0x5a, [...promote(source[0]), ...initial.slice(2)]],
    ]) {
      put(INPUT, source); put(INPUT + 16, initial); load(1, INPUT); load(0, INPUT + 16); seed();
      a.emit(prefix, 0x0f, opcode, ...(mem ? [5, ...u32(INPUT)] : [0xc1])); check(expect);
    }
    load(1, INPUT); load(0, INPUT + 16); seed();
    a.emit(0xf2, 0x0f, 0x11, 0xc8); check([source[0], source[1], ...initial.slice(2)]);
    put(OUT, [0, 0, 0xaabbccdd, 0xeeff0011]);
    a.emit(0xf2, 0x0f, 0x11, 0x0d, u32(OUT));
    [source[0], source[1], 0xaabbccdd, 0xeeff0011].forEach((v, i) => a.emit(0xa1, u32(OUT + i * 4)).checkEax(v));
  }
  // Original reshape arithmetic, including preserving scalar upper lanes.
  for (const mem of [false, true]) for (const [x, y] of [[300, 300], [640, 480], [-640, 480], [0, 300]]) {
    put(INPUT, [bits(y), ...upper]); put(INPUT + 16, [bits(x), ...upper]); load(0, INPUT + 16); load(1, INPUT); seed();
    a.emit(0xf3, 0x0f, 0x5e, ...(mem ? [5, ...u32(INPUT)] : [0xc1])); check([bits(Math.fround(x / y)), ...upper]);
  }
  // Unprefixed MOVD retains MMX identity at the same operand selectors.
  a.emit(0xb8, u32(0x12345678), 0x0f, 0x6e, 0xc0, 0x0f, 0x7e, 0xc2, 0x89, 0xd0).checkEax(0x12345678);
  a.emit(0x0f, 0x77); // EMMS
  // Same-address self-modification forces cache invalidation and distinguishes
  // prefixed XMM MOVD from unprefixed MMX MOVD, including instruction length.
  for (const [encoding, value, expected] of [
    [0x90c06e0f, 0x12345678, null], [0xc06e0f66, 0x87654321, 0x87654321],
    [0x90c06e0f, 0x13572468, 0x87654321],
  ]) {
    a.emit(0xc7, 5, u32(0x425000), u32(encoding), 0xc6, 5, u32(0x425004), 0xc3,
      0xb8, u32(value), 0x89, 0x25, u32(OUT + 80));
    a.emit(0xe8); const next = 0x402000 + a.code.length + 4; a.emit(u32(0x425000 - next));
    a.emit(0x89, 0xe0, 0x3b, 5, u32(OUT + 80)).branch([0x0f, 0x85], 'bad-esp');
    if (expected !== null) {
      save(0); [expected, 0, 0, 0].forEach((v, i) => a.emit(0xa1, u32(OUT + i * 4)).checkEax(v));
    }
  }
  a.emit(0x0f, 0x77);
  a.emit(0xc7, 5, u32(0x4014d0), u32(0x600dcafe)).push(0).api('ExitProcess').emit(0xcc);
  a.label('bad-esp').push(250).api('ExitProcess').emit(0xcc);
  a.label('bad-flags').push(248).api('ExitProcess').emit(0xcc);
  const code = a.finish(); if (code.length > 0x1e000) throw Error('fixture code overlaps threads');
  return { bytes: image([[0x2000, code]]), cases };
}
function negativeImage(code) {
  const a = new X86(); a.emit(0x90, code).push(251).api('ExitProcess').emit(0xcc);
  return image([[0x2000, a.finish()]]);
}
function nestedImage() {
  const a = new X86(), outer = new X86(), inner = new X86();
  const set = [0xff, 0x15, ...u32(0x401948)], call = [0xff, 0x15, ...u32(0x40194c)];
  a.push(0x402200).emit(set).checkEax(0);
  a.emit(0xb8, u32(0x12345678), 0x66, 0x0f, 0x6e, 0xf8);
  a.push(0x401600).emit(call).checkEax(0xffffffff);
  a.emit(0x66, 0x0f, 0x7e, 0xf8).checkEax(0x12345678);
  a.emit(0xc7, 5, u32(0x4014d0), u32(0x600dcafe)).push(0).api('ExitProcess').emit(0xcc);
  // XMM registers are volatile at a call boundary. The guest callback saves
  // its own live value on its own stack, and observes the child's writes
  // before restoring it. Host callback frames must not invent a second bank.
  outer.emit(0x83, 0xec, 16, 0x0f, 0x11, 0x3c, 0x24,
    0xb8, u32(16777219), 0x66, 0x0f, 0x6e, 0xf8, 0x0f, 0x5b, 0xff);
  outer.push(0x402400).emit(set).checkEax(0x402200);
  outer.push(0x401600).emit(call).checkEax(1);
  outer.emit(0x66, 0x0f, 0x7e, 0xf8).checkEax(bits(-2.5));
  outer.emit(0x0f, 0x10, 0x3c, 0x24, 0x83, 0xc4, 16, 0xb8, u32(-1), 0xc2, 4, 0);
  inner.emit(0x66, 0x0f, 0x7e, 0xf8).checkEax(bits(16777220));
  inner.emit(0xb8, u32(bits(-2.5)), 0x66, 0x0f, 0x6e, 0xf8, 0xb8, u32(1), 0xc2, 4, 0);
  const b = image([[0x2000, a.finish()], [0x2200, outer.finish()], [0x2400, inner.finish()],
    [0x1600, words([0x401620, 0x401680])], [0x1620, u32(0xe1234567)]]);
  const raw = r => r - 0x1000 + 0x200;
  for (const [slot, name, location] of [[0x1948, 'SetUnhandledExceptionFilter', 0x17a0],
    [0x194c, 'UnhandledExceptionFilter', 0x17d0]]) {
    b.writeUInt32LE(location, raw(slot)); b.write(name + '\0', raw(location + 2));
  }
  return b;
}
function threadImage() {
  const main = new X86(), worker = new X86(), nested = new X86();
  main.emit(0xb8, u32(0xabcdef01), 0x66, 0x0f, 0x6e, 0xf8);
  for (const value of [111, 222, 333])
    main.push(0).push(0).push(value).push(0x420000).push(0).push(0).api('CreateThread').eaxTo(value === 111 ? 0x100 : value === 222 ? 0x104 : 0x108);
  for (let i = 0; i < 3; i++) {
    main.push(30000).emit(0xff, 0x35, u32(0x401500 + i * 4)).api('WaitForSingleObject').checkEax(0);
    main.push(0x401520).emit(0xff, 0x35, u32(0x401500 + i * 4)).api('GetExitCodeThread').checkEax(1);
    main.emit(0xa1, u32(0x401520)).checkEax(0);
  }
  main.emit(0x66, 0x0f, 0x7e, 0xf8).checkEax(0xabcdef01);
  main.emit(0xc7, 5, u32(0x4014d0), u32(0x600dcafe)).push(0).api('ExitProcess').emit(0xcc);
  worker.emit(0x66, 0x0f, 0x7e, 0xf8).checkEax(0); // fresh thread XMM state
  worker.emit(0x8b, 0x5c, 0x24, 4, 0x66, 0x0f, 0x6e, 0xfb, // xmm7=thread argument
    0xbe, u32(20));
  worker.emit(0xf0, 0xff, 5, u32(0x401540)); // atomic three-thread rendezvous
  worker.label('barrier').push(10).api('Sleep').emit(0xa1, u32(0x401540), 0x83, 0xf8, 3).branch([0x0f, 0x85], 'barrier');
  worker.label('loop').push(10).api('Sleep').emit(0x66, 0x0f, 0x7e, 0xf8, 0x3b, 0xc3).branch([0x0f, 0x85], 'bad');
  worker.emit(0x66, 0x0f, 0x6e, 0xc3, 0x0f, 0x5b, 0xc0, 0xb9, u32(4), 0xe8, u32(0));
  // Fix the relative CALL once worker body is laid out.
  const callAt = worker.code.length - 4;
  worker.emit(0xf3, 0x0f, 0x2c, 0xc0, 0x3b, 0xc3).branch([0x0f, 0x85], 'bad');
  worker.emit(0x4e).branch([0x0f, 0x85], 'loop');
  worker.push(0).api('ExitThread').emit(0xcc);
  worker.label('bad').push(249).api('ExitProcess').emit(0xcc);
  const wc = worker.finish(); wc.writeInt32LE(0x421000 - (0x420000 + callAt + 4), callAt);
  // A real recursive guest context: each depth saves/restores its own XMM0
  // on its stack. XMM7 must remain local to this simultaneously running thread.
  nested.emit(0x52, 0x89, 0xca, 0x83, 0xec, 16, 0x0f, 0x11, 0x04, 0x24, 0x66, 0x0f, 0x6e, 0xc1,
    0x0f, 0x5b, 0xc0, 0x49).branch([0x0f, 0x84], 'restore');
  nested.emit(0xe8); const nc = nested.code.length; nested.emit(u32(-(nc + 4)));
  nested.label('restore').emit(0xf3, 0x0f, 0x2c, 0xc0, 0x3b, 0xc2).branch([0x0f, 0x85], 'bad');
  nested.emit(0x0f, 0x10, 0x04, 0x24, 0x83, 0xc4, 16, 0x5a, 0xc3);
  nested.label('bad').push(247).api('ExitProcess').emit(0xcc);
  return image([[0x2000, main.finish()], [0x20000, wc], [0x21000, nested.finish()]]);
}
module.exports = { controlImage, negativeImage, nestedImage, threadImage, image };
if (require.main === module) {
  const fs = require('node:fs'), out = process.argv[2];
  if (!out) throw Error('usage: node tools/gears-sse-reshape.cjs OUTPUT_DIRECTORY');
  fs.mkdirSync(out, { recursive: true }); const c = controlImage();
  fs.writeFileSync(out + '/control.exe', c.bytes); fs.writeFileSync(out + '/threads.exe', threadImage());
  fs.writeFileSync(out + '/nested.exe', nestedImage());
  console.log(JSON.stringify({ cases: c.cases, bytes: c.bytes.length }));
}
