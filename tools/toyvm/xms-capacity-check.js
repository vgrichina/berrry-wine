#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { Machine } = require('./dos');
const isa = require('./isa');

// Independent hardware bounds: 16MB RAM, with the first MB and 64KB HMA
// unavailable to EMB handles. Exercise the public XMS/BIOS calls, not xmsAlloc.
const capacity = (16 * 1024 * 1024 - 0x110000) / 1024;
const m = new Machine(new Uint8Array(isa.GUEST_RAM_SIZE));
const regs = { ax: 0, bx: 0, cx: 0, dx: 0 };
const r = { get: k => regs[k] || 0, set: (k, v) => { regs[k] = v; },
  setResultCf: v => { regs.cf = v; } };
function query(expected) {
  m.xms(8, r); assert.equal(regs.ax, expected); assert.equal(regs.dx, expected);
  m.int15(0x88, 0, r); assert.equal(regs.ax, expected); assert.equal(regs.cf, false);
}
function allocate(kb) {
  regs.dx = kb; m.xms(9, r); assert.equal(regs.ax, 1);
  const handle = regs.dx; m.xms(0x0c, r); assert.equal(regs.ax, 1);
  return { handle, base: regs.dx * 65536 + regs.bx };
}
query(capacity);
const a = allocate(9000); assert.equal(a.base, 0x110000);
query(capacity - 9000);
const b = allocate(capacity - 9000);
assert.equal(b.base + (capacity - 9000) * 1024, 16 * 1024 * 1024);
m.mem[a.base] = 0x5a; m.mem[b.base - 1] = 0x6b; m.mem[0xffffff] = 0xa5;
query(0);
const held = JSON.stringify([...m.xmsBlocks]);
regs.dx = 1; m.xms(9, r); assert.equal(regs.ax, 0); assert.equal(regs.bx & 255, 0xa0);
assert.equal(JSON.stringify([...m.xmsBlocks]), held);
assert.equal(m.mem[a.base], 0x5a); assert.equal(m.mem[b.base - 1], 0x6b);
assert.equal(m.mem[0xffffff], 0xa5);
console.log('PASS full backed capacity, allocation above 8MB, exact upper bound and exhaustion');
for (const {handle} of [b, a]) {
  regs.dx = handle; m.xms(0x0d, r); assert.equal(regs.ax, 1);
  regs.dx = handle; m.xms(0x0a, r); assert.equal(regs.ax, 1);
}
query(capacity);
const full = allocate(capacity); assert.equal(full.base, 0x110000); query(0);
console.log('PASS unlock/free restores capacity and entire contiguous pool can be reacquired');

async function guestCheck() {
  const { createMachineRunner } = require('./run-dos');
  // INT 2Fh returns the actual XMS far entry. The COM allocates 9000KB,
  // records AX/handle, and exits through DOS; no host-side register repair.
  const code = Uint8Array.from([
    0xb8, 0x10, 0x43, 0xcd, 0x2f, // mov ax,4310h; int 2fh
    0x89, 0x1e, 0x00, 0x08,       // mov [800h],bx
    0x8c, 0x06, 0x02, 0x08,       // mov [802h],es
    0xba, 0x28, 0x23, 0xb4, 0x09, // mov dx,9000; mov ah,9
    0xff, 0x1e, 0x00, 0x08,       // call far [800h]
    0xa3, 0x04, 0x08,             // mov [804h],ax
    0x89, 0x16, 0x06, 0x08,       // mov [806h],dx
    0xb8, 0x00, 0x4c, 0xcd, 0x21,
  ]);
  const run = await createMachineRunner({ image: code, name: 'XMSPOOL.COM', cpu: 486,
    budget: 3000, sessionOptions: { slice: 1, intFast: false, pitClock: false } });
  for (let i = 0; i < 3000 && !run.session.done; i++) run.step();
  assert(run.machine.exited); assert.equal(run.machine.exitCode, 0);
  const v = new DataView(run.vm.mem.buffer);
  const at = (run.machine.pspSeg << 4) + 0x804;
  assert.equal(v.getUint16(at, true), 1, 'guest allocation succeeds above old ceiling');
  const block = run.machine.xmsBlocks.get(v.getUint16(at + 2, true));
  assert.equal(block.kb, 9000); assert.equal(block.base, 0x110000);
  console.log('PASS original COM bytes call XMS far entry, allocate 9000KB and exit normally');
}
guestCheck().catch(e => { console.error(e); process.exitCode = 1; });
