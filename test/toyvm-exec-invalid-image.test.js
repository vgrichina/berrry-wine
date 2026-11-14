'use strict';

// Pure actual EXEC/prototype calls; no Machine construction or guest execution.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Machine } = require('../tools/toyvm/dos');

function image(spots = []) {
  const b = Buffer.alloc(48 + 4);
  b.write('MZ'); b.writeUInt16LE(b.length, 2); b.writeUInt16LE(1, 4);
  b.writeUInt16LE(spots.length, 6); b.writeUInt16LE(3, 8);
  b.writeUInt16LE(0xffff, 12); b.writeUInt16LE(28, 24);
  spots.forEach((s, i) => b.writeUInt16LE(s, 28 + i * 4));
  b.set([0x34, 0x12, 0x90, 0xcb], 48);
  return b;
}
function fixture(img, size = 0x100000) {
  const m = Object.assign(Object.create(Machine.prototype), {
    mem: new Uint8Array(size).fill(0xa5), curPsp: 0x100, imageTop: 0x300,
    allocTop: 0x9f00, memBlocks: new Map(), memFree: [{ seg: 0x300, size: 0x9c00 }],
    execStack: [], transfer: null, filesMissed: [],
    lin: () => 0x800, guestPath: () => 'CHILD.EXE', readWholeFile: () => img,
    absolutePath: () => 'C:\\CHILD.EXE', log: () => {},
    mcbWrite: () => {}, memTrim: () => {},
  });
  m.guestRd = at => m.mem[at];
  m.guestBytes = (at, n) => m.mem.slice(at, at + n);
  m.guestWrite = (at, bytes) => m.mem.set(bytes, at);
  m.mem.fill(0, 0x800, 0x820); // parameter block and empty tail at 0:0
  m.mem[0] = 0; m.mem[0x102c] = 0x60; m.mem[0x102d] = 0;
  m.mem.set([65, 61, 66, 0, 0], 0x600);
  const v = { ax: 0x4b00, bx: 0, ss: 0x100, ds: 0x100, es: 0x100, cf: false };
  const r = { get: k => v[k] || 0, set: (k, n) => { v[k] = n; },
    setResultCf: on => { v.cf = on; }, ret: { cs: 0x100, ip: 42, sp: 0xff00 } };
  return { m, v, r };
}
function state(m) {
  return { mem: m.mem.slice(), curPsp: m.curPsp, imageTop: m.imageTop,
    allocTop: m.allocTop, blocks: [...m.memBlocks], free: structuredClone(m.memFree),
    stack: structuredClone(m.execStack), transfer: m.transfer, codeReloaded: m.codeReloaded };
}
function rejects(img, code = 11, size) {
  for (const al of [0, 1, 3]) {
    const { m, v, r } = fixture(img, size), before = state(m);
    const registers = { ...v };
    assert.equal(m.int21Call(0x4b, al, r), true);
    assert.equal(v.cf, true); assert.equal(v.ax, code);
    assert.deepEqual(v, { ...registers, ax: code, cf: true });
    assert.deepEqual(state(m), before);
  }
}

test('public EXEC rejects malformed MZ/ZM atomically with DOS bad format', () => {
  rejects(Buffer.from('MZ')); rejects(Buffer.from('ZM'));
  for (const mutate of [
    b => b.writeUInt16LE(128, 2), b => b.writeUInt16LE(0, 4),
    b => b.writeUInt16LE(512, 2), b => b.writeUInt16LE(1, 8),
    b => b.writeUInt16LE(16, 8),
    b => { b.writeUInt16LE(1, 6); b.writeUInt16LE(47, 24); },
    b => { b.writeUInt16LE(1, 6); b.writeUInt16LE(3, 28); },
  ]) for (const sig of ['MZ', 'ZM']) { const b = image(); b.write(sig); mutate(b); rejects(b); }
});

test('valid images with insufficient arena or backing memory return DOS out of memory atomically', () => {
  for (const al of [0, 1]) {
    for (const small of [false, true]) {
      const { m, v, r } = fixture(image(), small ? 0x3100 : undefined);
      if (!small) m.imageTop = 0x9eff;
      const before = state(m);
      assert.equal(m.int21Call(0x4b, al, r), true);
      assert.equal(v.ax, 8); assert.equal(v.cf, true); assert.deepEqual(state(m), before);
    }
  }
});

test('guest faults and unexpected host bugs propagate without DOS format translation', () => {
  for (const method of ['guestRd', 'readWholeFile', 'absolutePath']) {
    const { m, r } = fixture(image()), fault = new Error(method);
    m[method] = () => { throw fault; };
    assert.throws(() => m.int21Call(0x4b, 0, r), e => e === fault);
  }
  const b = image(), fault = new RangeError('unexpected parser bug');
  b.readUInt16LE = () => { throw fault; };
  const { m, r } = fixture(b);
  assert.throws(() => m.int21Call(0x4b, 0, r), e => e === fault);
});

test('COM segment, MZ BSS and held arena blocks are included in memory preflight', () => {
  for (const al of [0, 1]) for (const kind of ['COM', 'BSS', 'held']) {
    const b = kind === 'COM' ? Buffer.from([0xc3]) : image();
    if (kind === 'BSS') b.writeUInt16LE(0xffff, 10);
    const { m, v, r } = fixture(b, kind === 'COM' ? 0x5000 : undefined);
    if (kind === 'held') m.memBlocks.set(0x301, 0x9bff);
    const before = state(m);
    assert.equal(m.int21Call(0x4b, al, r), true);
    assert.equal(v.ax, 8); assert.equal(v.cf, true); assert.deepEqual(state(m), before);
  }
});

test('valid MZ/ZM duplicate fixups and COM keep AL00/01 process and environment behavior', () => {
  for (const al of [0, 1]) for (const signature of ['MZ', 'ZM', 'COM']) {
    const b = signature === 'COM' ? Buffer.from([0xc3]) : image([0, 0]);
    if (signature !== 'COM') b.write(signature);
    const { m, v, r } = fixture(b);
    assert.equal(m.int21Call(0x4b, al, r), true); assert.equal(v.cf, false);
    const psp = al === 0 ? m.curPsp : [...m.memBlocks.keys()].find(s => s !== 0x301);
    assert.equal(m.mem[psp * 16], 0xcd);
    assert.equal(m.mem[psp * 16 + 0x16], 0);
    assert.deepEqual([...m.mem.slice(0x3010, 0x3015)], [65, 61, 66, 0, 0]);
    assert.equal(m.execStack.length, al === 0 ? 1 : 0);
    assert.equal(m.curPsp, al === 0 ? psp : 0x100);
    if (signature !== 'COM') {
      const at = (psp + 0x10) * 16;
      assert.equal(m.mem[at] | m.mem[at + 1] << 8, (0x1234 + 2 * (psp + 0x10)) & 0xffff);
    }
  }
});

test('overlay retains independent bias and never creates a process', () => {
  const { m, v, r } = fixture(image([0, 0]));
  m.mem.set([0, 2, 7, 0], 0x800);
  assert.equal(m.int21Call(0x4b, 3, r), true); assert.equal(v.cf, false);
  assert.equal(m.mem[0x2000] | m.mem[0x2001] << 8, 0x1234 + 14);
  assert.equal(m.curPsp, 0x100); assert.deepEqual(m.execStack, []);
  assert.equal(m.memBlocks.size, 0);
});

test('INT21 error bookkeeping sees the returned format/memory code', () => {
  for (const al of [0, 1]) for (const code of [8, 11]) {
    const { m, r, v } = fixture(code === 11 ? Buffer.from('MZ') : image());
    // The INT prologue's stack save is outside the EXEC handler under test.
    m.pspSaveStack = () => {};
    if (code === 8) m.imageTop = 0x9eff;
    const before = state(m);
    assert.equal(m.int21(0x4b, al, r), true);
    assert.equal(v.ax, code); assert.equal(v.cf, true); assert.equal(m.lastError, code);
    assert.deepEqual(state(m), before);
  }
});
