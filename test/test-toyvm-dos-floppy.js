'use strict';
const assert = require('assert/strict');
const fs = require('fs'), crypto = require('crypto'), vm = require('vm');
const { Machine } = require('../tools/toyvm/dos');
const { readFat12 } = require('../tools/toyvm/fat12');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// Small standard FAT12 floppy with a subdirectory and distinct disk contents.
function disk(text, child) {
  const b = Buffer.alloc(1474560); b.writeUInt16LE(512, 11); b[13] = 1;
  b.writeUInt16LE(1, 14); b[16] = 2; b.writeUInt16LE(224, 17);
  b.writeUInt16LE(2880, 19); b.writeUInt16LE(9, 22); b[21] = 0xf0;
  b[510] = 0x55; b[511] = 0xaa;
  const fat = b.subarray(512, 5120); fat.set([0xf0, 0xff, 0xff]);
  function end(c) { const at = c + (c >> 1); if (c & 1) { fat[at] |= 0xf0; fat[at + 1] = 0xff; } else { fat[at] = 0xff; fat[at + 1] |= 0x0f; } }
  for (const c of child ? [2, 3, 4, 5] : [2, 3, 4]) end(c);
  fat.copy(b, 5120);
  function entry(at, name, attr, cl, size) {
    b.write(name, at, 'ascii'); b[at + 11] = attr; b.writeUInt16LE(cl, at + 26); b.writeUInt32LE(size, at + 28);
    b.writeUInt16LE(0x1234, at + 22); b.writeUInt16LE(0x4321, at + 24);
  }
  entry(19 * 512, 'SAME    TXT', 0x20, 2, text.length); b.write(text, 33 * 512);
  entry(19 * 512 + 32, 'SUB        ', 0x10, 3, 0);
  entry(34 * 512, 'DEEP    TXT', 0x20, 4, 4); b.write('deep', 35 * 512);
  if (child) { entry(19 * 512 + 64, 'CHILD   COM', 0x20, 5, child.length); child.copy(b, 36 * 512); }
  return b;
}
function call(m, ah, name, args = {}, al = 0) {
  if (name !== undefined) m.mem.set(Buffer.from(name + '\0'), 0x2000);
  const v = { ds: 0x200, dx: 0, ...args };
  assert.equal(m.int21Call(ah, al, { get: k => v[k] || 0, set: (k, n) => v[k] = n, setResultCf: b => v.cf = b }), true);
  return v;
}
function fail(v, code) { assert.equal(v.cf, true); assert.equal(v.ax, code); }
function suite(Klass) {
  const m = new Klass(new Uint8Array(1 << 20)), a = disk('first'), b = disk('second'), before = sha(a);
  for (const d of [0, 1, 3, 254]) {
    call(m, 0x0e, undefined, { dx: d }); assert.equal(call(m, 0x19).ax & 255, 2);
    fail(call(m, 0x47, undefined, { dx: d + 1 }), 15);
    assert.equal(call(m, 0x36, undefined, { dx: d + 1 }).ax, 65535);
  }
  m.changeDisk('A', a); m.changeDisk('B:', b);
  assert.equal(m.readWholeFile('a:/same.txt').toString(), 'first');
  assert.equal(m.readWholeFile('B:/SAME.TXT').toString(), 'second');
  assert.equal(call(m, 0x3b, 'A:/SUB').cf, false); assert.equal(m.currentDrive, 2);
  call(m, 0x0e, undefined, { dx: 0 }); assert.equal(m.currentDirectory, 'sub');
  assert.equal(m.readWholeFile('deep.txt').toString(), 'deep');
  assert.equal(m.readWholeFile('B:SAME.TXT').toString(), 'second');
  assert.equal(m.readWholeFile('/SAME.TXT').toString(), 'first');
  assert.equal(m.absolutePath('deep.txt'), 'A:\\SUB\\DEEP.TXT');
  assert.equal(m.absolutePath('C:/MPS'), 'C:\\MPS');
  assert.equal(call(m, 0x39, 'C:/MPS').cf, false);
  assert.equal(call(m, 0x39, 'C:/MPS/GPRIX').cf, false);
  assert.equal(call(m, 0x3b, 'C:/MPS/GPRIX').cf, false);
  call(m, 0x0e, undefined, { dx: 2 }); assert.equal(m.currentDirectory, 'mps/gprix');
  assert.equal(call(m, 0x3c, 'SAME.TXT').cf, false);
  assert.equal(m.readWholeFile('A:SAME.TXT'), null); // A cwd is SUB.
  for (const ah of [0x3c, 0x41, 0x39]) fail(call(m, ah, 'A:/SAME.TXT'), 5);
  fail(call(m, 0x3d, 'A:/SAME.TXT', {}, 2), 5);
  const handle = call(m, 0x3d, 'A:/SAME.TXT').ax;
  fail(call(m, 0x40, undefined, { bx: handle, cx: 1 }), 5);
  call(m, 0x1a, undefined, { dx: 0x500 });
  assert.equal(call(m, 0x4e, 'A:/*.TXT').cf, false);
  assert.equal(m.mem[0x251e], 83);
  assert.equal(m.mem[0x2516] | m.mem[0x2517] << 8, 0x1234);
  assert.equal(m.mem[0x2518] | m.mem[0x2519] << 8, 0x4321);
  assert.equal(call(m, 0x43, 'A:/SUB').cx, 0x10);
  assert.equal(call(m, 0x43, 'A:/SAME.TXT').cx, 0x20);
  assert.equal(call(m, 0x4e, 'A:/SUB/*.TXT').cf, false);
  assert.equal(Buffer.from(m.mem.subarray(0x251e, 0x2526)).toString(), 'DEEP.TXT');
  assert.equal(call(m, 0x36, undefined, { dx: 1 }).dx, 2847);
  assert.throws(() => m.changeDisk('A', new Uint8Array(512)));
  assert.throws(() => m.changeDisk('C', b));
  assert.equal(m.readWholeFile('A:/SAME.TXT').toString(), 'first');
  m.changeDisk('A', b);
  assert.equal(m.files.get(handle).buf.toString ? Buffer.from(m.files.get(handle).buf).toString() : '', 'first');
  assert.equal(m.readWholeFile('A:/SAME.TXT').toString(), 'second');
  assert.equal(m.currentDirectory, 'mps/gprix');
  const other = Buffer.from(b); other.write('OTHER   TXT', 19 * 512, 'ascii');
  m.changeDisk('A', other);
  assert.equal(m.readWholeFile('A:/SAME.TXT'), null);
  assert.equal(m.readWholeFile('A:/OTHER.TXT').toString(), 'second');
  assert.equal(call(m, 0x4e, 'A:/OTHER.TXT').cf, false);
  fail(call(m, 0x4e, 'A:/SAME.TXT'), 2);
  m.changeDisk('A', b);
  call(m, 0x0e, undefined, { dx: 1 }); // Eject the selected B:.
  m.changeDisk('B', null); fail(call(m, 0x47, undefined, { dx: 2 }), 15);
  fail(call(m, 0x47), 15);
  assert.equal(m.readWholeFile('SAME.TXT'), null);
  call(m, 0x0e, undefined, { dx: 2 });
  assert.equal(m.readWholeFile('B:/SAME.TXT'), null);
  assert.equal(sha(a), before);
  // DOS reuses closed handles. MPSCOPY's CRT rejects handle >=20 even when
  // earlier handles are closed; monotonic allocation makes installation fail.
  const reusable = call(m, 0x3d, 'A:/SAME.TXT').ax;
  call(m, 0x3e, undefined, { bx: reusable });
  for (let i = 0; i < 40; i++) {
    const h = call(m, 0x3d, 'A:/SAME.TXT').ax; assert.equal(h, reusable);
    call(m, 0x3e, undefined, { bx: h });
  }
  a.fill(0); assert.equal(m.readWholeFile('A:/SAME.TXT').toString(), 'second');
}
suite(Machine);
for (const mutate of [
  b => b.fill(0, 510, 512),
  b => b[5120] ^= 1,
  b => { b[515] = 2; b[516] &= 0xf0; b.copy(b, 5120, 512, 5120); }, // cluster 2 points to itself
  b => b.writeUInt32LE(2048, 19 * 512 + 28), // file longer than chain
]) {
  const bad = disk('bad'); mutate(bad); assert.throws(() => readFat12(bad));
}
for (const bundle of ['toyvm-bundle.js', 'toyvm-jit-bundle.js']) {
  const sandbox = { self: {}, atob: s => Buffer.from(s, 'base64').toString('binary'), TextDecoder, TextEncoder, Uint8Array, console };
  vm.createContext(sandbox); vm.runInContext(fs.readFileSync(__dirname + '/../docs/dos-corpus/live/' + bundle, 'utf8'), sandbox);
  suite(sandbox.self.ToyVM.require('tools/toyvm/dos.js').Machine);
}
// Optional original-media checks; ordinary CI needs no proprietary fixture.
if (process.env.WORLD_CIRCUIT_MEDIA) {
  const expected = [
    ['302fc69b10b31fca68b05f0d9b74f9f384f727dac38963308558f78e55d079c8', 'install.exe', 'e4d0e821c511f39218239c33fe1d3cad6a8920dbdbd3335d0e408294f6f73df2'],
    ['b5ebe98c2cea4d54ca6bb4f8ae2fcbb2392dbcf1d81186ce4c6f0a3561c5c6d5', 'f1gp.002'],
    ['a5047fa95d1541bc2c2b365215bad1f25e1bcede8735cd990b028c7490f63f43', 'f1gp.003'],
  ];
  expected.forEach(([hash, name, fileHash], i) => {
    const p = process.env.WORLD_CIRCUIT_MEDIA + '/DISK0' + (i + 1) + '.IMA', bytes = fs.readFileSync(p);
    assert.equal(sha(bytes), hash); const v = readFat12(bytes); assert(v.entries.has(name));
    if (fileHash) assert.equal(sha(v.entries.get(name).data), fileHash);
    console.log(JSON.stringify({ disk: i + 1, files: [...v.entries].map(([name, e]) => ({ name, size: e.size, sha256: sha(e.data) })) }));
    assert.equal(sha(fs.readFileSync(p)), hash);
  });
}
console.log('PASS DOS floppy mount, drive, cwd, search, read-only, atomic disk-change and source immutability (Node and both browser bundles)');

// Execute small real DOS programs through the production runner, including a
// child EXEC from the mounted FAT volume. No original game is executed here.
function program(body, strings) {
  const code = [], refs = [], labels = {};
  const emit = (...bytes) => code.push(...bytes);
  const addr = (op, name) => { emit(op, 0, 0); refs.push([code.length - 2, name]); };
  body(emit, addr);
  for (const [name, value] of Object.entries(strings)) {
    labels[name] = 0x100 + code.length; emit(...(typeof value === 'string' ? Buffer.from(value + '\0') : value));
  }
  for (const [at, name] of refs) { code[at] = labels[name] & 255; code[at + 1] = labels[name] >> 8; }
  return Buffer.from(code);
}
async function production() {
  const child = program((e, a) => {
    a(0xba, 'dir'); e(0xb4, 0x39, 0xcd, 0x21);
    a(0xba, 'subdir'); e(0xb4, 0x39, 0xcd, 0x21);
    a(0xba, 'source'); e(0xb8, 0, 0x3d, 0xcd, 0x21, 0x89, 0xc3);
    a(0xba, 'buffer'); e(0xb9, 5, 0, 0xb4, 0x3f, 0xcd, 0x21);
    a(0xba, 'target'); e(0x31, 0xc9, 0xb4, 0x3c, 0xcd, 0x21, 0x89, 0xc3);
    a(0xba, 'buffer'); e(0xb9, 5, 0, 0xb4, 0x40, 0xcd, 0x21, 0xb4, 0x3e, 0xcd, 0x21);
    e(0xb8, 7, 0x4c, 0xcd, 0x21);
  }, { source: 'A:SAME.TXT', target: 'C:/MPS/GPRIX/CHILD.TXT', buffer: Array(8).fill(0), dir: 'C:/MPS', subdir: 'C:/MPS/GPRIX' });
  const parent = program((e, a) => {
    e(0xbb, 0, 1, 0xb4, 0x4a, 0xcd, 0x21); // shrink parent for EXEC
    e(0x31, 0xd2, 0xb4, 0x0e, 0xcd, 0x21); // select A
    a(0xba, 'child'); a(0xbb, 'pb'); e(0xb8, 0, 0x4b, 0xcd, 0x21);
    e(0xb4, 0x4d, 0xcd, 0x21, 0xa2, 0, 3); // retain exit status at DS:0300
    e(0xb4, 0x19, 0xcd, 0x21, 0xa2, 1, 3);
    e(0xb8, 0, 0x4c, 0xcd, 0x21);
  }, { child: 'A:/CHILD.COM', pb: Array(14).fill(0) });
  const { createMachineRunner } = require('../tools/toyvm/run-dos');
  const image = disk('first', child), before = sha(image);
  const runner = await createMachineRunner({ image: parent, name: 'PARENT.COM',
    floppies: [['A', image]], budget: 100000 });
  while (!runner.session.done && runner.session.dispatched < 100000) {
    const why = runner.step(); assert.notEqual(why, 'unimplemented');
  }
  assert.equal(runner.machine.exited, true);
  assert.equal(runner.machine.readWholeFile('C:/MPS/GPRIX/CHILD.TXT').toString(), 'first');
  assert.equal(runner.vm.mem[(runner.machine.pspSeg << 4) + 0x300], 7);
  assert.equal(runner.vm.mem[(runner.machine.pspSeg << 4) + 0x301], 0);
  const saved = runner.capture();
  runner.changeDisk('A', disk('second'));
  assert.equal(runner.machine.readWholeFile('A:/SAME.TXT').toString(), 'second');
  runner.restore(saved);
  assert.equal(runner.machine.readWholeFile('A:/SAME.TXT').toString(), 'first');
  assert.equal(runner.machine.readWholeFile('C:/MPS/GPRIX/CHILD.TXT').toString(), 'first');
  assert.equal(sha(image), before);
  console.log('PASS production native DOS drive selection, FAT file open/read, child EXEC inheritance, C: output and runner disk change');
}
production().catch(e => { console.error(e); process.exitCode = 1; });
