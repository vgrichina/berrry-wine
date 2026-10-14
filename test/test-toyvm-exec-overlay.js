'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { Machine } = require('../tools/toyvm/dos');
const word = (b, at, value) => { b[at] = value & 255; b[at + 1] = value >>> 8; };
function mz(body, spots = [], signature = 'MZ') {
  const header = 32 + Math.ceil(spots.length * 4 / 16) * 16, total = header + body.length;
  const b = Buffer.alloc(total); b.write(signature); word(b, 2, total % 512); word(b, 4, Math.ceil(total / 512));
  word(b, 6, spots.length); word(b, 8, header / 16); word(b, 24, 28);
  spots.forEach((spot, i) => { word(b, 28 + i * 4, spot & 15); word(b, 30 + i * 4, spot >>> 4); });
  b.set(body, header); return b;
}
function setup(image) {
  const m = new Machine(new Uint8Array(1 << 20));
  m.installEnvironment('PARENT.EXE'); m.allocTop = m.imageTop = 0x500; m.installArena();
  if (image) m.tempFiles.set(m.fileKey('OVL.EXE'), { data: image, len: image.length });
  m.mem.set(Buffer.from('OVL.EXE\0'), 0x1200);
  word(m.mem, 0x1300, 0x300); word(m.mem, 0x1302, 0x1234);
  return m;
}
function call(m) {
  const regs = { ax: 0x4b03, ds: 0x100, dx: 0x200, es: 0x100, bx: 0x300, ss: 0x100 };
  m.int21Call(0x4b, 3, { get: k => regs[k] || 0, set: (k, v) => regs[k] = v, setResultCf: v => regs.cf = v });
  return regs;
}
function state(m) { return { psp: m.curPsp, allocTop: m.allocTop, imageTop: m.imageTop,
  blocks: [...m.memBlocks], free: m.memFree.map(x => ({ ...x })), stack: m.execStack.slice(), transfer: m.transfer,
  pspBytes: m.mem.slice(0x1000, 0x1100), environment: m.mem.slice(0x600, 0xbf0) }; }
let groups = 0;
function test(name, fn) { fn(); groups++; console.log('PASS ' + name); }
test('MZ overlay relocates with independent bias and preserves process/arena', () => {
  const body = Buffer.from([0x34, 0x12, 0xfa, 0xff, 0x90, 0xcb]), m = setup(mz(body, [0, 2]));
  m.mem[0x2fff] = 0x71; m.mem[0x3006] = 0x72; const before = state(m), r = call(m);
  assert.equal(r.cf, false, 'EXEC AL03 must load an overlay');
  assert.deepEqual([...m.mem.slice(0x3000, 0x3006)], [0x68, 0x24, 0x2e, 0x12, 0x90, 0xcb]);
  assert.equal(m.mem[0x2fff], 0x71); assert.equal(m.mem[0x3006], 0x72);
  assert.deepEqual(state(m), before); assert.equal(m.codeReloaded, true);
  assert.equal(r.es, 0x100); assert.equal(r.bx, 0x300);
});
test('ZM and declared MZ length exclude appended payload', () => {
  const b = mz(Buffer.from([0x90, 0xcb]), [], 'ZM'), m = setup(Buffer.concat([b, Buffer.from('APPENDED')]));
  m.mem.fill(0x7f, 0x3000, 0x3010); assert.equal(call(m).cf, false);
  assert.deepEqual([...m.mem.slice(0x3000, 0x3004)], [0x90, 0xcb, 0x7f, 0x7f]);
});
test('flat overlay starts at segment offset zero without PSP or relocation', () => {
  const m = setup(Buffer.from([0xb8, 0x34, 0x12, 0xcb])), before = state(m);
  assert.equal(call(m).cf, false); assert.deepEqual([...m.mem.slice(0x3000, 0x3004)], [0xb8, 0x34, 0x12, 0xcb]);
  assert.deepEqual(state(m), before);
});
test('flat overlay read is bounded to DOS overlay transfer size', () => {
  const m = setup(Buffer.alloc(0x10010, 0xa5)); m.mem[0x3000 + 0xfffe] = 0x7f;
  assert.equal(call(m).cf, false); assert.equal(m.mem[0x3000 + 0xfffd], 0xa5); assert.equal(m.mem[0x3000 + 0xfffe], 0x7f);
});
function rejected(image, error, modify = () => {}) {
  const m = setup(image); modify(m); const memory = m.mem.slice(), before = state(m), r = call(m);
  assert.equal(r.cf, true); assert.equal(r.ax, error); assert.deepEqual(m.mem, memory);
  assert.deepEqual(state(m), before); assert.equal(m.codeReloaded, false);
}
test('missing and empty overlay files fail without writes', () => { rejected(null, 2); rejected(Buffer.alloc(0), 11); });
test('truncated MZ header/body fail without writes', () => {
  rejected(Buffer.from('MZ'), 11);
  const b = mz(Buffer.from([0x90, 0xcb])); rejected(b.subarray(0, b.length - 1), 11);
});
test('out-of-header relocation table and out-of-image target fail atomically', () => {
  const b = mz(Buffer.from([0x90, 0xcb]), [0]); word(b, 24, 0xffff); rejected(b, 11);
  rejected(mz(Buffer.from([0x90, 0xcb]), [2]), 11);
});
test('out-of-memory destination rejects rather than wraps or resizes memory', () => {
  rejected(mz(Buffer.alloc(64)), 8, m => word(m.mem, 0x1300, 0xffff));
});
console.log(JSON.stringify({ groups, status: 'PASS' }));
if (process.argv.includes('--native')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-overlay-')), bytes = [], labels = {}, fixups = [];
  const emit = (...values) => bytes.push(...values);
  const address = name => { const at = bytes.length; emit(0, 0); fixups.push({ at, name }); };
  const branch = op => { emit(0x0f, op); const at = bytes.length; emit(0, 0); fixups.push({ at, name: 'fail', relative: true }); };
  for (const [name, value] of [['first', 0x1234], ['second', 0x5678]]) {
    emit(0xba); address(name); emit(0xbb); address('params'); emit(0xb8, 3, 0x4b, 0xcd, 0x21); branch(0x82);
    emit(0x9a, 0, 0, 0, 3, 0x3d, value & 255, value >>> 8); branch(0x85);
  }
  emit(0xb8, 0, 0x4c, 0xcd, 0x21); labels.fail = bytes.length + 0x100; emit(0xb8, 1, 0x4c, 0xcd, 0x21);
  for (const [name, b] of [['first', Buffer.from('FIRST.EXE\0')], ['second', Buffer.from('SECOND.EXE\0')], ['params', Buffer.from([0, 3, 0x44, 0x44])]]) {
    labels[name] = bytes.length + 0x100; emit(...b);
  }
  for (const f of fixups) { const value = labels[f.name] - (f.relative ? f.at + 0x102 : 0); bytes[f.at] = value & 255; bytes[f.at + 1] = value >>> 8 & 255; }
  const exe = path.join(dir, 'OVERLAY.COM'); fs.writeFileSync(exe, Buffer.from(bytes));
  fs.writeFileSync(path.join(dir, 'FIRST.EXE'), mz(Buffer.from([0xb8, 0x34, 0x12, 0xcb])));
  fs.writeFileSync(path.join(dir, 'SECOND.EXE'), mz(Buffer.from([0xb8, 0x78, 0x56, 0xcb])));
  (async () => { try {
    const { runDos } = require('../tools/toyvm/run-dos');
    for (const variant of ['tailcall', 'switch', 'calls', 'repl_tailcall']) {
      const r = await runDos({ exe, variant, budget: 2000000, seconds: 5 });
      assert.equal(r.machine.exited, true, variant); assert.equal(r.machine.exitCode, 0, variant);
      assert.equal(r.machine.execStack.length, 0); assert.equal(r.machine.curPsp, r.machine.pspSeg);
      console.log('PASS native overlay reload at same far-call address ' + variant);
    }

    const { UopLive } = require('../tools/toyvm/uop-live');
    const release = UopLive.prototype.release; let overlayReleases = 0;
    UopLive.prototype.release = function(head) {
      if (this.session.machine.codeReloaded) overlayReleases++;
      return release.call(this, head);
    };
    try {
      // A real arithmetic loop makes an overlay head hot before replacement.
      for (const [name, value] of [['FIRST.EXE', 0x1234], ['SECOND.EXE', 0x5678]])
        fs.writeFileSync(path.join(dir, name), mz(Buffer.from([0xb9, 0xff, 0x0f, 0x42, 0x49, 0x75, 0xfc, 0xb8, value & 255, value >>> 8, 0xcb])));
      const r = await runDos({ exe, variant: 'tailcall', budget: 2000000, seconds: 5, slice: 64,
        uop: { profileFor: 128, every: 128, top: 4, minShare: 0.03, judgeAfter: 100000 } });
      assert.equal(r.machine.exited, true); assert.equal(r.machine.exitCode, 0);
      assert(overlayReleases > 0, 'overlay must release installed live-uop heads');
      console.log('PASS live-uop overlay reload with ' + overlayReleases + ' released heads');
    } finally { UopLive.prototype.release = release; }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); } })().catch(e => { console.error(e); process.exitCode = 1; });
}
