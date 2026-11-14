'use strict';

// Pure host services over inert memory/register bags. Install before imports.
const forbidden = () => { throw new Error('EXEC flags test forbids Worker/WASM/CPU construction'); };
globalThis.Worker = forbidden;
for (const name of ['Module', 'Instance', 'Memory', 'Table', 'Global', 'Tag', 'Exception',
  'compile', 'compileStreaming', 'instantiate', 'instantiateStreaming']) {
  if (name in WebAssembly) WebAssembly[name] = forbidden;
}
require('node:worker_threads').Worker = forbidden;

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Machine } = require('../tools/toyvm/dos');
const { DosSession } = require('../tools/toyvm/dos-loop');
const word = (mem, at, value) => { mem[at & 0xfffff] = value & 255; mem[(at + 1) & 0xfffff] = value >>> 8; };
const read = (mem, at) => mem[at] | mem[at + 1] << 8;

function fixture() {
  const m = Object.assign(Object.create(Machine.prototype), {
    mem: new Uint8Array(1 << 20), curPsp: 0x100, pspSeg: 0x100,
    imageTop: 0x300, allocTop: 0x9f00, memBlocks: new Map(), memFree: [],
    execStack: [], pspRegs: new Map(), transfer: null, filesMissed: [],
    lastExitCode: 0, lastExitType: 0, intCount: new Map(), unhandledFn: new Map(),
    guestPath: () => 'CHILD.EXE', absolutePath: () => 'C:\\CHILD.EXE', log: () => {},
  });
  const image = Buffer.alloc(36);
  image.write('MZ'); image.writeUInt16LE(36, 2); image.writeUInt16LE(1, 4);
  image.writeUInt16LE(2, 8); image.writeUInt16LE(0xffff, 12); image.writeUInt16LE(0x100, 16);
  m.readWholeFile = () => image;
  m.mem.set(Buffer.from('CONTRACT=parent\0\0'), 0x600);
  m.mem.set(Buffer.from('CONTRACT=explicit\0\0'), 0x700);
  word(m.mem, 0x102c, 0x60);
  const values = { ax: 0, bx: 0x400, dx: 0, ds: 0x100, es: 0x100, ss: 0x100,
    sp: 0xee0, cs: 0xf000, gip: 0x121, flags: 2 };
  const registers = { mem: m.mem, get: n => values[n] || 0,
    raw: n => values[n] || 0, set: (n, v) => { values[n] = v; },
    exports: { get_cr0: () => 0 } };
  for (const n of ['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp']) {
    registers.exports['set_' + n] = v => { values[n] = v; };
  }
  const session = { vm: registers, machine: m, ints: 0, hooks: {}, cache: { watch: [] } };
  function interrupt(ax, flags, { cs = 0x110, ip = 0x2ee1, sp = 0xee0, ss = 0x100 } = {}) {
    Object.assign(values, { ax, ss, sp, gip: 0x121, cs: 0xf000,
      // INT clears live IF/TF; a caller's flags belong to its saved frame.
      flags: flags & ~0x300 });
    const at = of => ((ss << 4) + ((sp + of) & 0xffff)) & 0xfffff;
    word(m.mem, at(0), ip); word(m.mem, at(2), cs); word(m.mem, at(4), flags);
    DosSession.prototype.serviceInterrupt.call(session);
    return values;
  }
  function exec(flags = 0xed7, { env = 0x70, tail = '', ...frame } = {}) {
    Object.assign(values, { ds: 0x100, es: 0x100, bx: 0x400 });
    word(m.mem, 0x1400, env); word(m.mem, 0x1402, 0x500); word(m.mem, 0x1404, 0x100);
    m.mem[0x1500] = tail.length; m.mem.set(Buffer.from(tail), 0x1501);
    m.mem[0x1501 + tail.length] = 13;
    return interrupt(0x4b00, flags, frame);
  }
  function exit(flags, code = 23, ah = 0x4c) {
    const child = m.curPsp;
    Object.assign(values, { ds: child, es: child, dx: 0x20 });
    return interrupt(ah * 256 + code, flags, { ss: child, sp: 0x800, cs: child, ip: 0x222 });
  }
  return { m, values, interrupt, exec, exit };
}

// MS-DOS v4.0 CTRLC.ASM reset_return (restore_world then IRET with F202h),
// and FreeDOS kernel/task.c return_user (FLAGS=0200h). Neither promises parent
// arithmetic status preservation. Bit 1 is fixed on ToyVM's 386; legacy 8086
// reserved high bits F000h are not an EXEC output for the 386 register bag.
// https://github.com/microsoft/MS-DOS/blob/main/v4.0/src/DOS/CTRLC.ASM
// https://github.com/FDOS/kernel/blob/master/kernel/task.c
const SUCCESS_FLAGS = 0x202;

for (const ah of [0x4c, 0x31, 0x00]) {
  for (const childCf of [0, 1]) {
    test(`successful EXEC AH=${ah.toString(16)} child CF=${childCf} owns return flags and separate status`, () => {
      for (const parentFlags of [0x202, 0xed7, 0x1d7, 2]) {
        for (const code of [0, 1, 255]) {
          const { m, values, exec, exit, interrupt } = fixture();
          exec(parentFlags);
          assert.equal(m.execStack.length, 1);
          const child = m.curPsp, env = read(m.mem, (child << 4) + 0x2c);
          exit(0xfd6 | childCf, code, ah);
          assert.equal(values.flags, SUCCESS_FLAGS, 'parent success must not inherit child FLAGS');
          assert.equal(values.flags & 1, 0, 'wrapper JB must reach AH4D');
          assert.equal(values.ax, 0, 'successful EXEC result is separate from child exit');
          assert.equal(values.gip, 0x2ee1); assert.equal(values.cs, 0x110);
          assert.equal(values.ss, 0x100); assert.equal(values.sp, 0xee6);
          assert.equal(values.ds, 0x100); assert.equal(values.es, 0x100);
          assert.equal(m.curPsp, 0x100); assert.equal(m.execStack.length, 0);
          assert.equal(m.memBlocks.has(env), ah === 0x31);
          assert.equal(m.mcbOwner(env), child);
          interrupt(0x4d00, values.flags);
          assert.equal(values.ax, (ah === 0x31 ? 0x300 : 0) | (ah === 0 ? 0 : code));
          assert.equal(values.flags, SUCCESS_FLAGS);
        }
      }
    });
  }
}

test('nested ordinary/resident returns each resume their immediate parent', () => {
  for (const innerAh of [0x4c, 0x31]) for (const cf of [0, 1]) {
    const { m, values, exec, exit, interrupt } = fixture();
    exec(0xed7);
    const child = m.curPsp, childImageTop = m.imageTop;
    exec(0x1d7, { ss: child, sp: 0x900, cs: child + 0x10, ip: 0x3456 });
    const grand = m.curPsp, grandEnv = read(m.mem, (grand << 4) + 0x2c);
    assert.equal(m.execStack.length, 2);
    exit(0xdd6 | cf, 9, innerAh);
    assert.equal(m.curPsp, child); assert.equal(m.execStack.length, 1);
    assert.equal(values.cs, child + 0x10); assert.equal(values.gip, 0x3456);
    assert.equal(values.ss, child); assert.equal(values.sp, 0x906);
    assert.equal(values.flags, SUCCESS_FLAGS); assert.equal(values.ax, 0);
    interrupt(0x4d00, values.flags, { ss: child, sp: 0x900 });
    assert.equal(values.ax, (innerAh === 0x31 ? 0x300 : 0) | 9);
    exit(0xed6 | (cf ^ 1), 33);
    assert.equal(m.curPsp, 0x100); assert.equal(m.execStack.length, 0);
    assert.equal(values.gip, 0x2ee1); assert.equal(values.flags, SUCCESS_FLAGS);
    assert.equal(m.memBlocks.has(grandEnv), innerAh === 0x31);
    if (innerAh === 0x31) assert.equal(m.mcbOwner(grandEnv), grand);
    else assert.equal(m.imageTop, 0x300);
    assert(childImageTop > 0x300);
    interrupt(0x4d00, values.flags); assert.equal(values.ax, 33);
  }
});

test('EXEC errors set CF and AX without a return transfer or child status replacement', () => {
  for (const error of [1, 2, 8, 10, 11]) for (const flags of [2, 0xed7]) {
    const { m, values, exec, interrupt } = fixture();
    m.lastExitCode = 71; m.lastExitType = 3;
    if (error === 2) m.readWholeFile = () => null;
    if (error === 8) m.imageTop = m.allocTop = 0x9eff;
    if (error === 10) m.mem.fill(65, 0x50000, 0x58000);
    if (error === 11) m.readWholeFile = () => Buffer.from('MZ');
    if (error === 1) interrupt(0x4b04, flags);
    else exec(flags, { env: error === 10 ? 0x5000 : 0x70 });
    assert.equal(values.ax, error); assert.equal(values.flags, flags | 1);
    // Some EXEC failures record lastError before writing AX; their public
    // AX/CF result is the contract exercised by the launcher here.
    assert.equal(m.curPsp, 0x100);
    assert.equal(m.transfer, null); assert.equal(m.execStack.length, 0);
    assert.equal(m.lastExitCode, 71); assert.equal(m.lastExitType, 3);
  }
});

test('ordinary service IRET and child entry retain their own flag behavior', () => {
  const { m, values, interrupt, exec } = fixture();
  interrupt(0x3000, 0xed7); assert.equal(values.flags, 0xed7);
  exec(0xed7); assert.equal(values.flags, 0xed6);
  assert.notEqual(m.curPsp, 0x100);
});

test('parent SP wraps past IRET frame without carrying child CF into continuation 2EE1', () => {
  for (const cf of [0, 1]) {
    const { values, exec, exit } = fixture();
    exec(0xed7, { sp: 0xfffc });
    exit(0x202 | cf);
    assert.equal(values.sp, 2); assert.equal(values.gip, 0x2ee1);
    assert.equal(values.ax, 0); assert.equal(values.flags, SUCCESS_FLAGS);
  }
});

test('failed nested EXEC returns its own error then leaves ancestor success continuation intact', () => {
  const { m, values, exec, exit } = fixture();
  exec(0xed7);
  const child = m.curPsp, image = m.readWholeFile;
  m.readWholeFile = () => null;
  exec(0x1d6, { ss: child, sp: 0x900, cs: child, ip: 0x777 });
  assert.equal(values.ax, 2); assert.equal(values.flags, 0x1d7);
  assert.equal(values.gip, 0x777); assert.equal(m.curPsp, child);
  assert.equal(m.execStack.length, 1);
  m.readWholeFile = image;
  exit(0xed7, 12);
  assert.equal(values.ax, 0); assert.equal(values.flags, SUCCESS_FLAGS);
  assert.equal(values.gip, 0x2ee1); assert.equal(m.curPsp, 0x100);
});

test('explicit/inherited environments and exact launcher tails survive the return repair', () => {
  for (const env of [0, 0x70]) for (const tail of ['', 'fmv\\logo1.avi', 'fmv\\logo2.avi']) {
    const { m, exec, exit } = fixture(), before = m.mem.slice(0x600, 0x800);
    exec(0xed7, { env, tail });
    const child = m.curPsp, base = child << 4, childEnv = read(m.mem, base + 0x2c);
    assert.notEqual(childEnv, env || 0x60); assert.equal(m.mcbOwner(childEnv), child);
    const expected = Buffer.from(`CONTRACT=${env ? 'explicit' : 'parent'}\0\0\x01\0C:\\CHILD.EXE\0`);
    assert.deepEqual(m.mem.slice(childEnv << 4, (childEnv << 4) + expected.length), new Uint8Array(expected));
    assert.equal(read(m.mem, base + 0x16), 0x100);
    assert.equal(m.mem[base + 0x80], tail.length);
    assert.equal(Buffer.from(m.mem.slice(base + 0x81, base + 0x81 + tail.length)).toString(), tail);
    assert.equal(m.mem[base + 0x81 + tail.length], 13);
    exit(0xed7);
    assert.deepEqual(m.mem.slice(0x600, 0x800), before);
    assert.equal(m.imageTop, 0x300); assert.equal(m.allocTop, 0x9f00);
  }
});
