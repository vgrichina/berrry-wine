#!/usr/bin/env node
'use strict';

// Independent COM bytes exercise the real INT/IRET path and the fast path.
// DOS 5+ AX=3306h returns BL=major, BH=minor, DL=revision, DH=flags.
// AH=30h returns AL=major, AH=minor, BX/CX=OEM and serial (zero here).
const assert = require('node:assert/strict');
const { createMachineRunner } = require('./run-dos');

async function check(query, intFast) {
  const code = [];
  const word = n => code.push(n & 255, n >>> 8 & 255);
  const dword = n => { word(n); word(n >>> 16); };
  const seeds = [0xa1a10000 | query, 0xb2b28765, 0xc3c39876, 0xd4d4a987,
    0, 0xe5e5ba98, 0xf6f6cba9, 0x1717dcba];
  // MOV EAX/ECX/EDX/EBX/EBP/ESI/EDI, imm32 (SP belongs to the loader).
  for (const i of [0, 1, 2, 3, 5, 6, 7]) {
    code.push(0x66, 0xb8 + i); dword(seeds[i]);
  }
  code.push(0x68); word(0x0ed6); code.push(0x9d); // distinct defined flags, CF clear
  code.push(0xcd, 0x21);
  // Store all full registers without changing their values or FLAGS.
  for (let i = 0; i < 8; i++) {
    code.push(0x66, 0x89, 0x06 | i << 3); word(0x800 + i * 4);
  }
  // Save DS/ES/SS and FLAGS, then terminate through the actual DOS service.
  for (const [seg, at] of [[3, 0x820], [0, 0x822], [2, 0x824]]) {
    code.push(0x8c, 0x06 | seg << 3); word(at);
  }
  code.push(0x9c, 0x8f, 0x06); word(0x826);
  code.push(0xb8, 0, 0x4c, 0xcd, 0x21);
  const r = await createMachineRunner({ image: Uint8Array.from(code), name: 'VERSION.COM',
    cpu: 486, budget: 3000, sessionOptions: { intFast, slice: 1, pitClock: false,
      irqEvery: 1e9, dispatchesPerTick: 1e9 } });
  const sp = r.vm.raw('sp'), ds = r.vm.get('ds'), es = r.vm.get('es'), ss = r.vm.get('ss');
  for (let i = 0; i < 3000 && !r.session.done; i++) r.step();
  assert.equal(r.machine.exitCode, 0); assert(r.machine.exited);
  const at = (r.machine.pspSeg << 4) + 0x800;
  const bytes = r.vm.mem.slice(at, at + 40), v = new DataView(bytes.buffer);
  const expected = seeds.map(n => n >>> 0); expected[4] = sp;
  if (query === 0x3306) {
    expected[3] = 0xd4d40006; expected[2] = 0xc3c30000;
    assert.deepEqual(Array.from(bytes.slice(12, 14)), [6, 0], 'BL major / BH minor');
    assert.deepEqual(Array.from(bytes.slice(8, 10)), [0, 0], 'DL revision / DH ROM-HMA');
  } else {
    expected[0] = 0xa1a10006; expected[3] = 0xd4d40000; expected[1] = 0xb2b20000;
    assert.deepEqual(Array.from(bytes.slice(0, 2)), [6, 0], 'AL major / AH minor');
  }
  for (let i = 0; i < 8; i++) assert.equal(v.getUint32(i * 4, true), expected[i], `register ${i}`);
  assert.deepEqual([v.getUint16(32, true), v.getUint16(34, true), v.getUint16(36, true)], [ds, es, ss]);
  assert.equal(v.getUint16(38, true), 0x0ed6, 'FLAGS preserved with CF initially clear');
  assert.equal(r.machine.unhandledFn.size, 0);
  console.log(`PASS AX=${query.toString(16)} intFast=${intFast} bytes=${Buffer.from(bytes).toString('hex')}`);
}
(async () => {
  for (const intFast of [false, true]) for (const query of [0x3306, 0x3000, 0x3001]) await check(query, intFast);
  console.log('PASS 6 DOS version byte/register controls');
})().catch(e => { console.error(e); process.exitCode = 1; });
