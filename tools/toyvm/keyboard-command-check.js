#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { Machine } = require('./dos');
const { createMachineRunner } = require('./run-dos');
const isa = require('./isa');
const m = new Machine(new Uint8Array(isa.GUEST_RAM_SIZE));
let mask = isa.LIN_MASK_REAL;
m.setVmExports({ set_linmask: v => mask = v });
const out = (v, p = 0x60) => m.portOut(p, v, 8);
const input = () => m.portIn(0x60, 8);
const ready = () => m.portIn(0x64, 8) & 1;
function receive(bytes) {
  for (const b of bytes) {
    for (let i = 0; i < 10; i++) assert.equal(ready(), 1, 'status polling cannot consume response');
    assert.equal(input(), b);
  }
}
assert.equal(ready(), 0);
out(0xed); assert.equal(m.keyboard.leds, 0); receive([0xfa]);
assert.equal(m.keyboard.pending, 'leds'); assert.equal(ready(), 0);
m.queueKeyboardScan(0x1e); assert.equal(ready(), 0); assert.equal(m.keyboardIrq(), 0);
out(8); receive([0xfe]); assert.equal(m.keyboard.pending, 'leds');
out(5); receive([0xfa]); assert.equal(m.keyboard.leds, 5); assert.equal(m.keyboard.pending, null);
receive([0x1e]);
console.log('PASS ED command and parameter have separate ACKs and state');
out(0xed); receive([0xfa]);
out(0xd1, 0x64); out(3); assert.equal(mask, isa.LIN_MASK_FLAT);
assert.equal(ready(), 0); assert.equal(m.keyboard.pending, 'leds');
out(0xd0, 0x64); receive([3]); assert.equal(ready(), 0);
out(2); receive([0xfa]); assert.equal(m.keyboard.leds, 2);
console.log('PASS controller output-port/A20 and keyboard parameter phases coexist');
out(0xf3); receive([0xfa]); out(0x80); receive([0xfe]);
assert.equal(m.keyboard.pending, 'typematic'); out(0x17); receive([0xfa]);
assert.equal(m.keyboard.typematic, 0x17);
out(0xed); receive([0xfa]); out(0xee); receive([0xee]);
assert.equal(m.keyboard.pending, null);
console.log('PASS typematic parameter retry and command interruption');
out(0xf2); receive([0xfa, 0xab]);
out(0xd0, 0x64); receive([0x83, 3]); out(0xfe); receive([0x83]);
assert.equal(ready(), 0);
console.log('PASS identity FIFO and resend exclude controller data');
m.queueKeyboardScan(0x1e); m.queueKeyboardScan(0x9e);
out(0xf5); receive([0xfa]); assert.equal(ready(), 0); assert.equal(m.keyboard.scanning, false);
assert.equal(m.keyboardIrq(), 0); assert.deepEqual(m.kbQueue, []);
out(0xf4); receive([0xfa]); assert.equal(ready(), 0);
m.queueKeyboardScan(0x1e); m.queueKeyboardScan(0x9e); receive([0x1e, 0x9e]);
out(0xfe); receive([0x9e]);
out(0xff); receive([0xfa, 0xaa]); assert.equal(m.keyboard.leds, 0);
assert.equal(m.keyboard.scanning, true); out(0xf6); receive([0xfa]);
assert.equal(m.keyboard.scanning, true); assert.equal(m.keyboard.typematic, 0x2b);
assert.throws(() => out(0xf0), /Unsupported keyboard command/);
console.log('PASS scanning enable/default/reset and real scan resend');

// Independent guest bytes execute OUT, bounded OBF polling, IN and DOS exit.
// Missing either ACK branches to exit 1; no host callback supplies a result.
(async () => {
  const code = Uint8Array.from([
    0xb0,0xed,0xe6,0x60, 0xe8,0x11,0x00,
    0xb0,0x06,0xe6,0x60, 0xe8,0x0a,0x00,
    0xb8,0x00,0x4c,0xcd,0x21,
    0xb8,0x01,0x4c,0xcd,0x21,
    0xb9,0x00,0x01, 0xe4,0x64,0xa8,0x01,0x75,0x04,
    0xe2,0xf8,0xeb,0xee, 0xe4,0x60,0x3c,0xfa,0x75,0xe8,0xc3
  ]);
  const r = await createMachineRunner({image:code,name:'KBD.COM',cpu:486,budget:10000,
    sessionOptions:{slice:1,irqEvery:1e9,dispatchesPerTick:1e9,pitClock:false}});
  for(let i=0;i<10000&&!r.session.done;i++) r.step();
  assert(r.machine.exited); assert.equal(r.machine.exitCode,0);
  assert.equal(r.machine.keyboard.leds,6); assert.equal(r.machine.keyboard.pending,null);
  assert.equal(r.machine.portIn(0x64,8)&1,0);
  console.log('PASS guest OUT/poll/IN two-phase LED exchange and ordinary DOS exit');
})().catch(e=>{console.error(e);process.exitCode=1;});
