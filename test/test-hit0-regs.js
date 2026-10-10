#!/usr/bin/env node
// get_hit0_reg(0..7): the GPRs at count slot 0's latest hit, which is how a
// host with no --trace-at (the browser page) reads registers at a block
// entry. Slot 0 armed on a jump target; the snapshot must hold what the
// registers were on entry to that block, not after it.

const assert = require('assert');
const bench = require('../tools/bench-loops');

(async () => {
  bench.ensureBuilt();
  const inst = await bench.newInstance();
  const { e, mem, g2w } = inst;
  const a = bench.layout(inst.imageBase, 0x20000);
  const at = a.code;
  // mov eax,0x11111111 / mov ecx,0x22222222 / mov esi,0x33333333 / jmp L
  // L: xor eax,eax / mov esi,eax / ret
  const code = [0xB8, 0x11, 0x11, 0x11, 0x11, 0xB9, 0x22, 0x22, 0x22, 0x22,
    0xBE, 0x33, 0x33, 0x33, 0x33, 0xEB, 0x00, 0x31, 0xC0, 0x89, 0xC6, 0xC3];
  const L = 17;
  mem.set(code, g2w(at));
  e.set_esp(a.stackTop);
  new DataView(e.memory.buffer).setUint32(g2w(a.stackTop), 0, true);
  e.set_eip(at);
  e.set_count(0, at + L);
  for (let k = 0; k < 100 && (e.get_eip() >>> 0) !== 0; k++) e.run(1000);
  assert.strictEqual(e.get_count(0), 1, 'slot 0 was not hit once');
  assert.strictEqual(e.get_hit0_reg(0) >>> 0, 0x11111111, 'EAX at the hit');
  assert.strictEqual(e.get_hit0_reg(1) >>> 0, 0x22222222, 'ECX at the hit');
  assert.strictEqual(e.get_hit0_reg(6) >>> 0, 0x33333333, 'ESI at the hit');
  assert.strictEqual(e.get_hit0_reg(4) >>> 0, a.stackTop >>> 0, 'ESP at the hit');
  assert.strictEqual(e.get_hit0_reg(8) >>> 0, 0, 'an out-of-range index reads 0');
  assert.strictEqual(e.get_esi() >>> 0, 0, 'the block itself still ran');
  e.clear_counts();
  console.log('PASS  get_hit0_reg snapshots EAX..EDI at slot 0\'s block entry');
})().catch((err) => { console.error(err); process.exit(1); });
