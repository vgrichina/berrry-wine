'use strict';
const assert = require('assert/strict');
const fs = require('fs'), vm = require('vm');
const { Machine } = require('../tools/toyvm/dos');

function suite(Klass) {
  const m = new Klass(new Uint8Array(1 << 20));
  // DOS's clock starts at midnight on its epoch, then follows VM time.
  // Check month/year rollover, leap day, and Sunday=0 independently.
  for (const [days, year, month, day, weekday] of [
    [0, 1980, 1, 1, 2], [5, 1980, 1, 6, 0], [30, 1980, 1, 31, 4],
    [31, 1980, 2, 1, 5], [59, 1980, 2, 29, 5], [60, 1980, 3, 1, 6],
    [365, 1980, 12, 31, 3], [366, 1981, 1, 1, 4],
    [424, 1981, 2, 28, 6], [425, 1981, 3, 1, 0],
  ]) {
    m.setTicks(Math.ceil(days * 86400000 / 55));
    const v = { ax: 0x2a23, bx: 0x1234, cx: 0xbeef, dx: 0xabcd, flags: 0x203 };
    const r = { ret: { sp: 0xfffe }, get: k => v[k] || 0, set: (k, n) => v[k] = n };
    assert.equal(m.int21(0x2a, 0x23, r), true);
    assert.equal(v.ax, 0x2a00 | weekday); assert.equal(v.cx, year);
    assert.equal(v.dx, (month << 8) | day);
    assert.equal(v.bx, 0x1234); assert.equal(v.flags, 0x203);
  }
  // Last tick before the first midnight must still be January 1.
  m.setTicks(Math.ceil(86400000 / 55) - 1);
  const v = { ax: 0x2aff };
  assert.equal(m.int21(0x2a, 0xff, { ret: { sp: 0xfffe }, get: k => v[k] || 0, set: (k, n) => v[k] = n }), true);
  assert.equal(v.dx, 0x101); assert.equal(v.ax, 0x2a02);
}
suite(Machine);
if (!process.env.DOS_DATE_NODE_ONLY) {
  for (const p of ['docs/dos-corpus/live/toyvm-bundle.js', 'docs/dos-corpus/live/toyvm-jit-bundle.js']) {
    const context = { self: {}, console, TextEncoder, TextDecoder, Uint8Array, atob: s => Buffer.from(s, 'base64').toString('binary') };
    context.globalThis = context; vm.runInNewContext(fs.readFileSync(p, 'utf8'), context);
    suite(context.self.ToyVM.require('tools/toyvm/dos.js').Machine);
  }
}
async function native() {
  // Real guest INT/IRET stores the returned date and preserved carry.
  const image = Buffer.from([0xf9,0xb8,0x23,0x2a,0xcd,0x21,
    0xa3,0,3,0x89,0x0e,2,3,0x89,0x16,4,3,
    0x9c,0x58,0xa3,6,3,0xb8,0,0x4c,0xcd,0x21]);
  const { createMachineRunner } = require('../tools/toyvm/run-dos');
  const r = await createMachineRunner({ image, name: 'DATE.COM', budget: 10000 });
  while (!r.session.done && r.session.dispatched < 10000) assert.notEqual(r.step(), 'unimplemented');
  assert.equal(r.machine.exited, true); assert.equal(r.machine.exitCode, 0);
  const at = (r.machine.pspSeg << 4) + 0x300;
  const w = n => r.vm.mem[at + n] | (r.vm.mem[at + n + 1] << 8);
  assert.equal(w(0), 0x2a02); assert.equal(w(2), 1980); assert.equal(w(4), 0x101);
  assert.equal(w(6) & 1, 1);
}
native().then(() => console.log('PASS DOS date, weekday, leap/month/year rollover and native INT/IRET')).catch(e => { console.error(e); process.exitCode = 1; });
