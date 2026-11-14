'use strict';
// Pure DOS host contracts; never construct a Machine or execute guest code.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Machine } = require('../tools/toyvm/dos');
function fixture(pos = 0, temporary = true) {
  const data = Uint8Array.from({ length: 16 }, (_, i) => i + 1);
  const rec = { data, len: data.length, temporary };
  const file = { rec, buf: data, pos, access: 2 };
  const machine = Object.assign(Object.create(Machine.prototype), {
    mem: new Uint8Array(1024), files: new Map([[5, file]]), bytesRead: 0,
    lin: (r, seg, off) => off,
    guestWrite(at, bytes) { this.mem.set(bytes, at); },
  });
  function invoke(ah, count, at = 128) {
    const values = { bx: 5, cx: count, dx: at };
    const r = { get: n => values[n] || 0, set: (n, v) => { values[n] = v; },
      setResultCf: v => { values.cf = v; } };
    machine.int21Call(ah, 0, r);
    return values;
  }
  return { machine, rec, file, invoke };
}
test('DOS AH40 CX0 truncates an existing file at zero', () => {
  const { rec, file, invoke } = fixture();
  assert.deepEqual(invoke(0x40, 0), { bx: 5, cx: 0, dx: 128, ax: 0, cf: false });
  assert.equal(rec.len, 0); assert.equal(file.buf.length, 0); assert.equal(file.pos, 0);
});
test('DOS AH40 CX0 truncates at the current pointer and preserves prefix', () => {
  const { rec, file, invoke } = fixture(7, false);
  invoke(0x40, 0); assert.equal(rec.len, 7); assert.equal(file.pos, 7);
  assert.deepEqual([...file.buf], [1, 2, 3, 4, 5, 6, 7]);
});
test('DOS AH40 CX0 extends to a pointer beyond the old EOF', () => {
  const { rec, file, invoke } = fixture(40);
  invoke(0x40, 0); assert.equal(rec.len, 40); assert.equal(file.pos, 40);
  assert.equal(file.buf.length, 40); assert.deepEqual([...file.buf.slice(0, 16)], [...Array(16)].map((_, i) => i + 1));
});
test('zero write updates shared temporary handles and later reads see EOF', () => {
  const { machine, rec, file, invoke } = fixture(5);
  const other = { rec, pos: 0, buf: rec.data, access: 2 }; machine.files.set(6, other);
  invoke(0x40, 0); assert.equal(other.buf.length, 5);
  file.pos = 0; assert.equal(invoke(0x3f, 16).ax, 5);
  assert.deepEqual([...machine.mem.slice(128, 133)], [1, 2, 3, 4, 5]);
});
test('zero write to a readonly file fails without mutation', () => {
  const { rec, file, invoke } = fixture(4); file.readOnly = true;
  const r = invoke(0x40, 0); assert.equal(r.cf, true); assert.equal(r.ax, 5);
  assert.equal(rec.len, 16); assert.equal(file.pos, 4);
});
test('nonzero overwrite retains the untouched file suffix', () => {
  const { machine, rec, file, invoke } = fixture(4);
  machine.mem.set([91, 92], 128); assert.equal(invoke(0x40, 2).ax, 2);
  assert.equal(rec.len, 16); assert.equal(file.pos, 6);
  assert.deepEqual([...file.buf], [1, 2, 3, 4, 91, 92, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
});
