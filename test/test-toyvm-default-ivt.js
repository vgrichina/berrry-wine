'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { Machine, STUB_SEG, STUB_OFF, DEFAULT_IRET_OFF } = require('../tools/toyvm/dos');
const word = (m, a) => m[a] | m[a + 1] << 8;
const vector = (m, n) => ({ off: word(m.mem, n * 4), seg: word(m.mem, n * 4 + 2) });
const machine = () => new Machine(new Uint8Array(1 << 20));
let groups = 0; function test(name, fn) { fn(); groups++; console.log('PASS ' + name); }
test('unsupported software vectors share an executable IRET entry', () => {
  const m = machine(), a = vector(m, 0xbd), b = vector(m, 0xbe);
  assert.deepEqual(a, b, 'BIOS default vectors must share their handler');
  assert.equal(a.seg, STUB_SEG); assert.equal(a.off, DEFAULT_IRET_OFF);
  assert.equal(m.mem[(a.seg << 4) + a.off], 0xcf);
});
test('supported BIOS/DOS and hardware vectors keep dedicated service entries', () => {
  const m = machine();
  for (const n of [0, 4, 6, 8, 9, 0xf, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x1a, 0x1c, 0x20, 0x21, 0x25, 0x26, 0x2d, 0x2f, 0x31, 0x33, 0x40, 0x5c, 0x67, 0x70, 0x77])
    assert.deepEqual(vector(m, n), { off: STUB_OFF + n, seg: STUB_SEG });
});
test('DOS get/set vector roundtrip preserves saved shared target', () => {
  const m = machine(), before = vector(m, 0xbd), regs = { ds: 0x100, dx: 0x456 };
  const r = { get: k => regs[k] || 0, set: (k, v) => regs[k] = v, setResultCf: v => regs.cf = v };
  assert.equal(m.hookedVector(0xbd), false);
  m.int21Call(0x25, 0xbd, r); assert.equal(m.hookedVector(0xbd), true);
  m.int21Call(0x35, 0xbd, r); assert.equal(regs.es, 0x100); assert.equal(regs.bx, 0x456);
  regs.ds = before.seg; regs.dx = before.off; m.int21Call(0x25, 0xbd, r);
  assert.equal(m.hookedVector(0xbd), false); assert.deepEqual(vector(m, 0xbd), before);
});
test('direct guest IVT edit and same-ROM-segment hook remain detectable', () => {
  const m = machine(), at = 0xbd * 4; m.mem[at] ^= 1;
  assert.equal(m.hookedVector(0xbd), true);
  assert.equal(m.hookedVector(0xbe), false);
});
console.log(JSON.stringify({ groups, status: 'PASS' }));
if (process.argv.includes('--native')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-ivt-')), bytes = [], labels = {}, fixups = [];
  const emit = (...b) => bytes.push(...b);
  const address = (name, add = 0) => { const at = bytes.length; emit(0, 0); fixups.push({ at, name, add }); };
  let stage = 0;
  const branch = () => { emit(0x74, 5, 0xb8, ++stage, 0x4c, 0xcd, 0x21); };
  const interrupt = ax => emit(0xb8, ax & 255, ax >>> 8, 0xcd, 0x21);
  // Actual IRET preserves flags, stack, and ordinary general registers.
  emit(0xbb, 0x34, 0x12, 0x89, 0x26); address('savedSp');
  // Establish valid 386 FLAGS: startup image carries reserved bit 15, which IRET clears.
  emit(0x68, 0x02, 0x02, 0x9d);
  emit(0xf9, 0x9c, 0x5d, 0xcd, 0xbd, 0x9c, 0x58, 0x89, 0xc7, 0x39, 0xe8); branch();
  emit(0x81, 0xfb, 0x34, 0x12); branch(); emit(0x3b, 0x26); address('savedSp'); branch();
  // Defined but unimplemented disk service must reach the host diagnostic.
  emit(0xb8, 0, 0xff, 0xcd, 0x13);
  // Save the BIOS pointer, install a guest hook, chain to it, and restore it.
  interrupt(0x35bd); emit(0x89, 0x1e); address('old'); emit(0x8c, 0xc0, 0xa3); address('old', 2);
  emit(0xba); address('hook'); interrupt(0x25bd); emit(0xcd, 0xbd, 0x80, 0x3e); address('count'); emit(1); branch();
  emit(0x1e, 0x8b, 0x16); address('old'); emit(0xa1); address('old', 2); emit(0x8e, 0xd8); interrupt(0x25bd); emit(0x1f);
  emit(0xcd, 0xbd, 0x80, 0x3e); address('count'); emit(1); branch(); interrupt(0x4c00);
  labels.fail = 0x100 + bytes.length; interrupt(0x4c01);
  labels.hook = 0x100 + bytes.length; emit(0xfe, 0x06); address('count'); emit(0xff, 0x2e); address('old');
  for (const [name, n] of [['old', 4], ['count', 1], ['savedSp', 2]]) { labels[name] = bytes.length + 0x100; emit(...Array(n).fill(0)); }
  for (const f of fixups) { const value = labels[f.name] + (f.add || 0) - (f.relative ? f.at + 0x102 : 0); bytes[f.at] = value & 255; bytes[f.at + 1] = value >>> 8 & 255; }
  const exe = path.join(dir, 'IVT.COM'); fs.writeFileSync(exe, Buffer.from(bytes));
  (async () => { try {
    const { runDos } = require('../tools/toyvm/run-dos');
    for (const variant of ['tailcall', 'switch', 'calls', 'repl_tailcall']) {
      const r = await runDos({ exe, variant, budget: 2000000, seconds: 5 });
      assert.equal(r.machine.exited, true, variant); assert.equal(r.machine.exitCode, 0, variant + ' check=' + r.machine.exitCode + ' regs=' + JSON.stringify(Object.fromEntries(['ax','bx','bp','di','sp','flags'].map(k=>[k,r.vm.get(k)]))));
      assert.equal(r.machine.intCount.get(0x13), 1, 'defined BIOS service reaches host');
      assert.equal(r.machine.unhandled.get(0x13), 1, 'missing BIOS service stays diagnostic');
      assert.equal(r.machine.unhandledFn.get('13:ff'), 1, 'missing BIOS function stays diagnostic');
      assert.equal(r.machine.intCount.has(0xbd), false, 'unused vector runs real guest IRET');
      console.log('PASS native shared IRET flags/stack and guest hook chaining ' + variant);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); } })().catch(e => { console.error(e); process.exitCode = 1; });
}
