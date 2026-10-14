'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { Machine } = require('../tools/toyvm/dos'), isa = require('../tools/toyvm/isa');
function setup() {
  const m = new Machine(new Uint8Array(isa.GUEST_RAM_SIZE));
  let mask = isa.LIN_MASK_REAL;
  m.setVmExports({ set_linmask: v => mask = v });
  return { m, mask: () => mask };
}
const writeOutput = (m, value) => { m.portOut(0x64, 0xd1, 8); m.portOut(0x60, value, 8); };
const readOutput = m => { m.portOut(0x64, 0xd0, 8); return m.portIn(0x60, 8); };
let groups = 0; function test(name, f) { f(); groups++; console.log('PASS ' + name); }
test('8042 idle/status response reflects actual buffer state', () => {
  const { m } = setup(); m.kbQueue.length = 0;
  assert.equal(m.portIn(0x64, 8) & 3, 0, '8042 idle has neither IBF nor OBF');
  m.portOut(0x64, 0xd0, 8);
  assert.equal(m.portIn(0x64, 8) & 0xb, 9);
  assert.equal(m.portIn(0x60, 8), 1);
  assert.equal(m.portIn(0x64, 8) & 3, 0);
});
test('D1 consumes one data byte and D0 reads complete output latch', () => {
  const { m, mask } = setup(); m.portOut(0x64, 0xd1, 8);
  assert.equal(mask(), isa.LIN_MASK_REAL);
  assert.equal(m.portIn(0x64, 8) & 2, 0);
  m.portOut(0x60, 0xdf, 8); assert.equal(mask(), isa.LIN_MASK_FLAT);
  assert.equal(m.portIn(0x64, 8) & 8, 0);
  m.portOut(0x60, 0xdd, 8); // no pending controller data: must not change its latch
  assert.equal(readOutput(m), 0xdf);
  writeOutput(m, 0xdd); assert.equal(readOutput(m), 0xdd);
  assert.equal(mask(), isa.LIN_MASK_FLAT & ~(1 << 20));
});
test('controller reply preserves queued keyboard bytes and IRQ latch', () => {
  const { m } = setup(); m.kbQueue = [0x1e, 0x9e]; m.kbScan = 0x30; m.kbFresh = true;
  assert.equal(readOutput(m), 1); assert.deepEqual(m.kbQueue, [0x1e, 0x9e]); assert(m.kbFresh);
  assert.equal(m.portIn(0x60, 8), 0x30); assert.equal(m.portIn(0x64, 8) & 1, 1);
  assert.equal(m.portIn(0x60, 8), 0x1e); assert.equal(m.portIn(0x60, 8), 0x9e);
  assert.equal(m.portIn(0x64, 8) & 1, 0);
});
test('A20 gates only bit 20 through repeated toggles', () => {
  const { m, mask } = setup();
  for (let i = 0; i < 2; i++) {
    writeOutput(m, 1);
    assert.equal(0x100500 & mask(), 0x500);
    assert.equal(0x300500 & mask(), 0x200500);
    assert.equal(0xe00500 & mask(), 0xe00500);
    writeOutput(m, 3); assert.equal(0x300500 & mask(), 0x300500);
  }
});
test('existing XMS allocation/lock enables bus and keeps controller latch coherent', () => {
  const { m, mask } = setup(), regs = { dx: 1 };
  const r = { get: k => regs[k] || 0, set: (k, v) => regs[k] = v };
  writeOutput(m, 0xdd); m.xms(9, r); assert.equal(regs.ax, 1); const handle = regs.dx;
  assert.equal(mask(), isa.LIN_MASK_FLAT); assert.equal(readOutput(m), 0xdf);
  writeOutput(m, 0xdd); regs.dx = handle; m.xms(0x0c, r);
  assert.equal(regs.ax, 1); assert.equal(mask(), isa.LIN_MASK_FLAT); assert.equal(readOutput(m), 0xdf);
});
test('FF pulse-none command leaves output, A20 and keyboard data unchanged', () => {
  const { m, mask } = setup(); writeOutput(m, 0xdf); m.kbQueue = [0x1e];
  m.portOut(0x64, 0xff, 8);
  assert.equal(mask(), isa.LIN_MASK_FLAT); assert.equal(readOutput(m), 0xdf);
  assert.deepEqual(m.kbQueue, [0x1e]);
});
test('unknown controller commands and reset requests fail explicitly', () => {
  const { m, mask } = setup(); const before = mask();
  assert.throws(() => m.portOut(0x64, 0xaa, 8), /Unsupported 8042 controller command/);
  m.portOut(0x64, 0xd1, 8);
  assert.throws(() => m.portOut(0x60, 0, 8), /Unsupported 8042 CPU reset/);
  assert.equal(mask(), before); assert.equal(m.kbc.output, 1);
});
console.log(JSON.stringify({ groups, status: 'PASS' }));
if (process.argv.includes('--native')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-8042-')), b = [];
  const emit = (...v) => b.push(...v), dword = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255];
  let stage = 0;
  const check = () => emit(0x74, 5, 0xb8, ++stage, 0x4c, 0xcd, 0x21);
  const gate = value => emit(0xb0, 0xd1, 0xe6, 0x64, 0xb0, value, 0xe6, 0x60);
  const cmp = (address, value) => { emit(0x67, 0x80, 0x3d, ...dword(address), value); check(); };
  emit(0x31, 0xc0, 0x8e, 0xd8); // DS=0
  gate(3);
  for (const [a, v] of [[0x500, 0x11], [0x100500, 0x22], [0x200500, 0x33], [0x300500, 0x44]])
    emit(0x67, 0xc6, 0x05, ...dword(a), v);
  emit(0xb8, 0xff, 0xff, 0x8e, 0xc0); // ES=FFFF; ES:0510 crosses 1MB
  gate(1);
  emit(0x26, 0xa0, 0x10, 0x05, 0x3c, 0x11); check();
  cmp(0x300500, 0x33); cmp(0x200500, 0x33);
  gate(3);
  emit(0x26, 0xa0, 0x10, 0x05, 0x3c, 0x22); check(); cmp(0x300500, 0x44);
  emit(0xb8, 0, 0x4c, 0xcd, 0x21);
  const exe = path.join(dir, 'A20.COM'); fs.writeFileSync(exe, Buffer.from(b));
  (async () => { try {
    const { runDos } = require('../tools/toyvm/run-dos');
    for (const variant of ['tailcall', 'switch', 'calls', 'repl_tailcall']) {
      const r = await runDos({ exe, variant, budget: 2000000, seconds: 5 });
      assert.equal(r.machine.exited, true, variant); assert.equal(r.machine.exitCode, 0, variant);
      assert.equal(r.vm.mem[0x100500], 0x22); assert.equal(r.vm.mem[0x300500], 0x44);
      console.log('PASS native 8042 A20 alias and upper address preservation ' + variant);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); } })().catch(e => { console.error(e); process.exitCode = 1; });
}
