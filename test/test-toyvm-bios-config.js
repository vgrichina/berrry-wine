'use strict';
const assert = require('assert/strict');
const fs = require('fs'), vm = require('vm');
const { Machine } = require('../tools/toyvm/dos');
function suite(Klass) {
  const delayed = new Klass(new Uint8Array(0));
  delayed.setMemory(new Uint8Array(1 << 20));
  assert.equal(delayed.mem[0xfe6fa], 0x70, 'CLI/batch installs ROM after VM allocation');
  const m = new Klass(new Uint8Array(1 << 20));
  const v = { ax: 0xc003, bx: 0x4cde, cx: 0, dx: 3, es: 0x108, cf: true };
  assert.equal(m.int15(0xc0, 3, { get: k => v[k] || 0, set: (k, n) => v[k] = n, setResultCf: b => v.cf = b }), true);
  assert.equal(v.cf, false); assert.equal(v.ax, 3); // AH status; AL preserved.
  const at = (v.es << 4) + v.bx;
  assert.ok(at >= 0xf0000 && at + 10 <= 0x100000);
  assert.deepEqual(Array.from(m.mem.subarray(at, at + 10)), [8, 0, 0xfc, 0, 0, 0x70, 0, 0, 0, 0]);
  assert.equal(m.mem[0xffffe], m.mem[at + 2]);
  assert.equal(v.cx, 0); assert.equal(v.dx, 3);
}
suite(Machine);
if (!process.env.BIOS_CONFIG_NODE_ONLY) {
  for (const p of ['docs/dos-corpus/live/toyvm-bundle.js', 'docs/dos-corpus/live/toyvm-jit-bundle.js']) {
    const context = { self: {}, console, TextEncoder, TextDecoder, Uint8Array, atob: s => Buffer.from(s, 'base64').toString('binary') };
    context.globalThis = context; vm.runInNewContext(fs.readFileSync(p, 'utf8'), context);
    suite(context.self.ToyVM.require('tools/toyvm/dos.js').Machine);
  }
}
async function native() {
  // Real INT/IRET: carry must clear in the saved frame and ES:BX must be usable.
  const image = Buffer.from([0xf9,0xb8,3,0xc0,0xcd,0x15,
    0xa3,0,3,0x89,0x1e,2,3,0x8c,0xc0,0xa3,4,3,
    0x9c,0x58,0xa3,6,3,0x26,0x8a,0x47,5,0xa2,8,3,
    0xb8,0,0x4c,0xcd,0x21]);
  const { createMachineRunner } = require('../tools/toyvm/run-dos');
  const r = await createMachineRunner({ image, name: 'CONFIG.COM', budget: 10000 });
  while (!r.session.done && r.session.dispatched < 10000) assert.notEqual(r.step(), 'unimplemented');
  assert.equal(r.machine.exited, true); assert.equal(r.machine.exitCode, 0);
  const at = (r.machine.pspSeg << 4) + 0x300;
  const w = n => r.vm.mem[at + n] | (r.vm.mem[at + n + 1] << 8);
  assert.equal(w(0), 3); assert.equal(w(2), 0xe6f5); assert.equal(w(4), 0xf000);
  assert.equal(w(6) & 1, 0); assert.equal(r.vm.mem[at + 8], 0x70);
}
native().then(() => console.log('PASS BIOS system configuration table, capabilities, status and native IRET')).catch(e => { console.error(e); process.exitCode = 1; });
