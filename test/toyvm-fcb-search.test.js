'use strict';

// PURE_JS_ONLY_NO_NATIVE: call actual DOS prototype methods over generated
// bytes. No Machine construction, CPU, guest program, VM or WASM module.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Machine } = require('../tools/toyvm/dos');

function machine() {
  const m = Object.create(Machine.prototype);
  Object.assign(m, { mem: new Uint8Array(0x100000), currentDrive: 2, currentDirectory: '', curPsp: 0x50,
    driveDirectories: new Map(), floppyVolumes: new Map(), isoVolumes: new Map(),
    tempFiles: new Map(), virtualDirectories: new Set(), fileRoot: null, dta: 0x4000,
    directorySearches: new Map(), directorySearchIds: new Map(), directorySearchSerial: 0,
    mediaChanges: [], lastError: 77 });
  return m;
}
function registers(ah, dx = 0, ds = 0x200) {
  const v = { ax: ah * 256 + 3, bx: 0x9876, cx: 0x5566, dx, si: 0x1122, di: 0x3344,
    bp: 0xabcd, sp: 0xf000, ds, es: 0x1234, ss: 0x5678, cs: 0x4321, ip: 0x6789, flags: 0xed7 };
  return { v, get: k => v[k], set: (k, n) => { v[k] = n; },
    setResultCf: on => { v.flags = (v.flags & ~1) | +on; },
    setResultZf: on => { v.flags = (v.flags & ~64) | (+on << 6); } };
}
function call(m, ah = 0x11, at = 0x2000, expected = true) {
  const r = registers(ah, at & 15, at >>> 4), before = { ...r.v };
  assert.equal(m.int21Call(ah, 3, r), expected);
  assert.deepEqual(r.v, { ...before, ax: r.v.ax });
  assert.equal(r.v.ax & 0xff00, before.ax & 0xff00);
  return r.v.ax & 255;
}
function fcb(m, { at = 0x2000, drive = 0, name = '???????????', attr } = {}) {
  assert.equal(name.length, 11);
  const b = Buffer.alloc(44, 0);
  const p = attr === undefined ? 0 : 7;
  if (p) { b[0] = 255; b[6] = attr; }
  b[p] = drive; b.write(name, p + 1, 'latin1'); m.mem.set(b, at);
  return at;
}
function overlay(m, name, attributes = 0x20, len = 7) {
  m.tempFiles.set(name.toLowerCase(), { len, attributes, time: 0x1357, date: 0x2468 });
}
function resultName(m, extended = false) {
  return Buffer.from(m.mem.subarray(m.dtaAddr() + (extended ? 8 : 1), m.dtaAddr() + (extended ? 19 : 12))).toString('latin1');
}
function directoryEntry(name, attr, cluster = 0, size = 0) {
  const b = Buffer.alloc(32); b.write(name, 0, 'latin1'); b[11] = attr;
  b.set([0x1b, 0x2c, 0x3d, 0x4e, 0x5f, 0x60, 0x71, 0x82, 0x93, 0xa4], 12);
  b.writeUInt16LE(0x3456, 22); b.writeUInt16LE(0x4567, 24);
  b.writeUInt16LE(cluster, 26); b.writeUInt32LE(size, 28); return b;
}
function fatFixture() {
  const b = Buffer.alloc(8 * 512);
  b.writeUInt16LE(512, 11); b[13] = 1; b.writeUInt16LE(1, 14); b[16] = 1;
  b.writeUInt16LE(16, 17); b.writeUInt16LE(8, 19); b.writeUInt16LE(1, 22);
  b[510] = 0x55; b[511] = 0xaa; b.set([0xf0, 0xff, 0xff, 0xff, 0xff, 0xff], 512);
  const root = [directoryEntry('REALVOL ONE', 8), directoryEntry('REAL    TXT', 0x21, 2, 3),
    directoryEntry('SECRET  SYS', 6), directoryEntry('SUB        ', 0x10, 3)];
  b.set(Buffer.concat(root), 1024); b.write('fat', 1536);
  b.set(directoryEntry('NEST    DAT', 0x20), 2048);
  return { b, root };
}
function isoFixture(label = 'REAL_ISO') {
  const b = Buffer.alloc(24 * 2048);
  const u16 = (a, n) => { b.writeUInt16LE(n, a); b.writeUInt16BE(n, a + 2); };
  const u32 = (a, n) => { b.writeUInt32LE(n, a); b.writeUInt32BE(n, a + 4); };
  const record = (at, name, sector, size, flags = 0) => {
    const id = typeof name === 'number' ? Buffer.from([name]) : Buffer.from(name);
    const n = 33 + id.length + (id.length % 2 ? 0 : 1);
    b[at] = n; u32(at + 2, sector); u32(at + 10, size); b[at + 25] = flags;
    u16(at + 28, 1); b[at + 32] = id.length; b.set(id, at + 33); return n;
  };
  const p = 16 * 2048;
  b.set([1, 67, 68, 48, 48, 49, 1], p); b.write(label, p + 40);
  u32(p + 80, 24); u16(p + 128, 2048); record(p + 156, 0, 20, 2048, 2);
  b.set([255, 67, 68, 48, 48, 49, 1], 17 * 2048);
  let at = 20 * 2048;
  for (const args of [[0, 20, 2048, 2], [1, 20, 2048, 2], ['CD.TXT;1', 22, 3], ['HIDE.SYS;1', 23, 0, 1]])
    at += record(at, ...args);
  b.write('iso', 22 * 2048); return b;
}

test('standard FCB has exact 33-byte directory result, status and register/flag preservation', () => {
  const m = machine(); overlay(m, 'file.txt', 0x21, 0x12345678);
  fcb(m, { name: 'FILE    TXT' }); m.mem.fill(0xa5, m.dta, m.dta + 44);
  const before = m.mem.slice(0x2000, 0x202c);
  assert.equal(call(m), 0); assert.equal(m.mem[m.dta], 3);
  const expected = Buffer.alloc(33); expected[0] = 3; expected.write('FILE    TXT', 1);
  expected[12] = 0x21; expected.writeUInt16LE(0x1357, 23); expected.writeUInt16LE(0x2468, 25);
  expected.writeUInt32LE(0x12345678, 29);
  assert.deepEqual(Buffer.from(m.mem.slice(m.dta, m.dta + 33)), expected);
  assert(m.mem.slice(m.dta + 33, m.dta + 44).every(b => b === 0xa5));
  assert.deepEqual(m.mem.slice(0x2000, 0x200c), before.slice(0, 12));
  assert.deepEqual(m.mem.slice(0x2016, 0x202c), before.slice(22));
  assert.equal(m.lastError, 77);
});

test('extended FCB uses a zeroed prefix, search attr and exact raw FAT entry including cluster/timestamps', () => {
  const m = machine(), { b, root } = fatFixture(); m.changeDisk('A', b);
  fcb(m, { drive: 1, name: 'REAL    TXT', attr: 2 });
  m.mem.fill(0x9b, m.dta, m.dta + 44);
  assert.equal(call(m), 0);
  assert.deepEqual(Buffer.from(m.mem.slice(m.dta, m.dta + 8)), Buffer.from([255, 0, 0, 0, 0, 0, 2, 1]));
  assert.deepEqual(Buffer.from(m.mem.slice(m.dta + 8, m.dta + 40)), root[1]);
  assert(m.mem.slice(m.dta + 40, m.dta + 44).every(b => b === 0x9b));
  b.fill(0); assert.deepEqual(Buffer.from(m.dataVolume(0).entries.get('real.txt').directoryEntry), root[1]);
});

test('FCB first/next walks only matching 8.3 entries with ? padding and field-local *', () => {
  const m = machine(); for (const n of ['a.txt', 'ab.txt', 'abc.bin', 'longfilename.txt']) overlay(m, n);
  fcb(m, { name: 'A*      TXT' });
  assert.equal(call(m), 0); assert.equal(resultName(m), 'A       TXT');
  assert.equal(call(m, 0x12), 0); assert.equal(resultName(m), 'AB      TXT');
  const before = m.mem.slice(m.dta, m.dta + 40);
  assert.equal(call(m, 0x12), 255); assert.deepEqual(m.mem.slice(m.dta, m.dta + 40), before);
  assert.equal(call(m, 0x12), 255);
});

test('attributes exclude hidden/system/directories by default and include requested combinations', () => {
  const m = machine();
  for (const [n, a] of [['normal', 0x20], ['read', 1], ['hidden', 2], ['system', 4], ['both', 6]]) overlay(m, n, a);
  m.virtualDirectories.add('folder');
  for (const [attr, expected] of [[undefined, ['NORMAL', 'READ']], [2, ['NORMAL', 'READ', 'HIDDEN']],
    [4, ['NORMAL', 'READ', 'SYSTEM']], [6, ['NORMAL', 'READ', 'HIDDEN', 'SYSTEM', 'BOTH']],
    [0x16, ['NORMAL', 'READ', 'HIDDEN', 'SYSTEM', 'BOTH', 'FOLDER']], [0x21, ['NORMAL', 'READ']]]) {
    fcb(m, { attr }); const got = [];
    for (let ah = 0x11; call(m, ah) === 0; ah = 0x12) got.push(resultName(m, attr !== undefined).trim());
    assert.deepEqual(got, expected);
  }
});

test('known FAT label is 11 contiguous bytes; volume-only forces root, C label is unknown', () => {
  const m = machine(), { b, root } = fatFixture(); m.changeDisk('B', b); m.driveDirectories.set(1, 'sub');
  fcb(m, { drive: 2, name: 'REALVOL ONE', attr: 8 });
  assert.equal(call(m), 0); assert.equal(resultName(m, true), 'REALVOL ONE');
  assert.deepEqual(Buffer.from(m.mem.slice(m.dta + 8, m.dta + 40)), root[0]);
  assert.equal(call(m, 0x12), 255);
  fcb(m, { drive: 3, attr: 8 }); assert.equal(call(m), 255);
  fcb(m, { drive: 2, name: 'NOTLABEL???', attr: 8 }); assert.equal(call(m), 255);
});

test('mixed label/hidden query includes label and normal files in root', () => {
  const m = machine(); m.changeDisk('A', fatFixture().b);
  fcb(m, { drive: 1, attr: 0x0a }); const got = [];
  for (let ah = 0x11; call(m, ah) === 0; ah = 0x12) got.push(resultName(m, true));
  assert.deepEqual(got, ['REALVOL ONE', 'REAL    TXT']);
});

test('actual C filesystem and writable overlay merge without invented aliases or symlink traversal', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-fcb-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'DISK.TXT'), 'host'); fs.writeFileSync(path.join(root, 'longfilename.txt'), 'bad');
  fs.symlinkSync(path.join(root, 'DISK.TXT'), path.join(root, 'LINK.TXT'));
  const m = machine(); m.fileRoot = root; overlay(m, 'disk.txt', 0x20, 12); overlay(m, 'save.dat');
  fcb(m); const got = [];
  for (let ah = 0x11; call(m, ah) === 0; ah = 0x12) got.push(resultName(m));
  assert.deepEqual(got, ['DISK    TXT', 'SAVE    DAT']);
  assert.equal(new DataView(m.mem.buffer).getUint32(m.dta + 29, true), 7);
  m.tempFiles.delete('disk.txt'); fcb(m, { name: 'DISK    TXT' }); assert.equal(call(m), 0);
  assert.equal(new DataView(m.mem.buffer).getUint32(m.dta + 29, true), 4);
});

test('per-drive cwd, default-drive binding and FAT subdirectories survive drive/cwd changes', () => {
  const m = machine(); m.changeDisk('A', fatFixture().b); m.currentDrive = 0; m.currentDirectory = 'sub';
  fcb(m); assert.equal(call(m), 0); assert.equal(resultName(m), 'NEST    DAT'); assert.equal(m.mem[m.dta], 1);
  m.currentDrive = 2; m.currentDirectory = ''; overlay(m, 'different.dat');
  assert.equal(call(m, 0x12), 255);
  fcb(m, { drive: 1 }); assert.equal(call(m), 0); assert.equal(resultName(m), 'REAL    TXT');
});

test('ISO D: and Z: searches use parsed primary names/attrs/labels without loading file contents', () => {
  const m = machine(); m.mountIso(isoFixture(), { drive: 'D', format: 'iso' });
  m.mountIso(isoFixture('LAST_DISC'), { drive: 'Z', format: 'iso' });
  for (const drive of [4, 26]) {
    fcb(m, { drive }); assert.equal(call(m), 0); assert.equal(resultName(m), 'CD      TXT');
    assert.equal(m.mem[m.dta], drive); assert.equal(m.mem[m.dta + 12], 0x21);
    assert.equal(new DataView(m.mem.buffer).getUint32(m.dta + 29, true), 3);
    assert.equal(call(m, 0x12), 255);
    fcb(m, { drive, attr: 2, name: 'HIDE    SYS' }); assert.equal(call(m), 0);
    assert.equal(m.mem[m.dta + 19], 0x23);
    fcb(m, { drive, attr: 8 }); assert.equal(call(m), 0);
    assert.equal(resultName(m, true), (drive === 4 ? 'REAL_ISO' : 'LAST_DISC').padEnd(11));
  }
});

test('unrepresentable ISO label is an explicit unsupported boundary; ordinary files still search', () => {
  const m = machine(); m.mountIso(isoFixture('LONG_ISO_VOLUME_LABEL'), { format: 'iso' });
  fcb(m, { drive: 4, attr: 8 }); const before = m.mem.slice(); call(m, 0x11, 0x2000, false);
  assert.deepEqual(m.mem, before);
  fcb(m, { drive: 4 }); assert.equal(call(m), 0);
});

test('two input FCBs, copied FCB cursors and DTA relocation remain independent', () => {
  const m = machine(); for (const n of ['a.txt', 'b.txt', 'c.bin']) overlay(m, n);
  fcb(m, { name: '????????TXT' }); assert.equal(call(m), 0);
  m.mem.copyWithin(0x2400, 0x2000, 0x202c);
  fcb(m, { at: 0x2200, name: '????????BIN', attr: 2 }); assert.equal(call(m, 0x11, 0x2200), 0);
  m.mem.fill(0xcc, m.dta, m.dta + 50);
  const r = registers(0x1a, 0x123, 0x500); assert.equal(m.int21Call(0x1a, 0, r), true);
  assert.equal(m.dtaAddr(), 0x5123);
  assert.equal(call(m, 0x12), 0); assert.equal(resultName(m), 'B       TXT');
  assert.equal(call(m, 0x12, 0x2400), 0); assert.equal(resultName(m), 'B       TXT');
  assert.equal(call(m, 0x12, 0x2200), 255); assert.equal(call(m, 0x12), 255);
});

test('ordinary AH4E/4F DTA search interleaves with AH11/12 without shared continuation', () => {
  const m = machine(); for (const n of ['a.txt', 'b.txt', 'x.bin', 'y.bin']) overlay(m, n);
  fcb(m, { name: '????????TXT' }); assert.equal(call(m), 0);
  m.mem.set(Buffer.from('*.BIN\0'), 0x3000);
  const r = registers(0x4e, 0, 0x300); r.v.cx = 0;
  assert.equal(m.int21Call(0x4e, 0, r), true); assert.equal(r.v.flags & 1, 0);
  const saved = m.mem.slice(m.dta, m.dta + 43);
  assert.equal(Buffer.from(saved.slice(30)).toString().split('\0')[0], 'X.BIN');
  assert.equal(call(m, 0x12), 0); assert.equal(resultName(m), 'B       TXT');
  m.mem.set(saved, 0x6000); m.dta = 0x6000;
  assert.equal(m.int21Call(0x4f, 0, r), true); assert.equal(r.v.flags & 1, 0);
  assert.equal(Buffer.from(m.mem.slice(m.dta + 30, m.dta + 43)).toString().split('\0')[0], 'Y.BIN');
  assert.equal(call(m, 0x12), 255);
});

test('missing next, invalid/unmounted drives, changed media and changed search fail without DTA writes', () => {
  const m = machine(); fcb(m); m.mem.fill(0x99, m.dta, m.dta + 40);
  assert.equal(call(m, 0x12), 255);
  for (const drive of [1, 2, 5, 27, 254]) { fcb(m, { drive }); assert.equal(call(m), 255); }
  m.changeDisk('A', fatFixture().b); fcb(m, { drive: 1 }); assert.equal(call(m), 0);
  m.changeDisk('A', fatFixture().b); const before = m.mem.slice(m.dta, m.dta + 40);
  assert.equal(call(m, 0x12), 255); assert.deepEqual(m.mem.slice(m.dta, m.dta + 40), before);
  overlay(m, 'a.txt'); fcb(m); assert.equal(call(m), 0); m.mem[0x2001] = 66;
  assert.equal(call(m, 0x12), 255);
});

test('malformed FCBs, protected buffers, segment crossing, overlap and A20 wrap are explicitly unsupported', () => {
  for (const mutate of [
    m => { m.mem[0x2001] = 0; }, m => { m.mem[0x2001] = 47; },
    m => { fcb(m, { attr: 0x80 }); }, m => { m.dta = 0x2008; },
    m => { m.dta = 0xffff0; }, m => { m.mem = m.mem.slice(0, 0x4005); },
    m => { m.vmExports = { get_cr0: () => 1, get_vm86: () => 0 }; },
    m => { m.fcbDta = { at: m.dta, offset: 0xfff0 }; },
  ]) {
    const m = machine(); overlay(m, 'a.txt'); fcb(m); mutate(m); const before = m.mem.slice();
    call(m, 0x11, 0x2000, false); assert.deepEqual(m.mem, before); assert.equal(m.fcbSearches, undefined);
  }
  const m = machine(), r = registers(0x11, 0xfff0, 0); m.mem.set(Buffer.from([3, ...Buffer.from('???????????')]), 0xfff0);
  assert.equal(m.int21Call(0x11, 3, r), false); assert.equal(r.v.ax, 0x1103);
});

test('real guest read faults propagate, and page-write preflight covers both destinations atomically', () => {
  const m = machine(); overlay(m, 'a.txt'); fcb(m);
  const fault = Error('real guest page fault'), writes = [], probes = [];
  m.vmExports = { get_cr0: () => -2147483647, get_vm86: () => 1, get_cs: () => 3,
    pg_read: (at) => m.mem[at], pg_probe: at => { probes.push(at); if (at === m.dta + 32) throw fault; return at; },
    pg_phys_write: (at, b) => { writes.push(at); m.mem[at] = b; } };
  const before = m.mem.slice(), r = registers(0x11), regs = { ...r.v };
  assert.throws(() => m.int21Call(0x11, 3, r), e => e === fault);
  assert(probes.includes(0x200c)); assert(probes.includes(m.dta + 32)); assert.equal(writes.length, 0);
  assert.deepEqual(m.mem, before); assert.deepEqual(r.v, regs); assert.equal(m.fcbSearches, undefined);
  m.vmExports.pg_probe = at => at;
  assert.equal(call(m), 0); assert.equal(writes.length, 43);
  m.vmExports.pg_read = () => { throw fault; };
  assert.throws(() => m.int21Call(0x12, 3, r), e => e === fault);
});

test('failed FindNext DTA write does not advance cursor or lose a matching result', () => {
  const m = machine(); overlay(m, 'a.txt'); overlay(m, 'b.txt'); fcb(m); assert.equal(call(m), 0);
  const fault = Error('write-protect page'), before = m.mem.slice();
  m.vmExports = { get_cr0: () => -2147483647, get_vm86: () => 1, get_cs: () => 3,
    pg_read: at => m.mem[at], pg_probe: at => { if (at === m.dta) throw fault; return at; },
    pg_phys_write: (at, b) => { m.mem[at] = b; } };
  assert.throws(() => call(m, 0x12), e => e === fault); assert.deepEqual(m.mem, before);
  m.vmExports.pg_probe = at => at;
  assert.equal(call(m, 0x12), 0); assert.equal(resultName(m), 'B       TXT');
});

test('public int21 wrapper preserves CF and last-error for AL-only FCB failures', () => {
  const m = machine(); m.pspSaveStack = () => {}; fcb(m);
  const r = registers(0x11), before = { ...r.v };
  assert.equal(m.int21(0x11, 3, r), true);
  assert.deepEqual(r.v, { ...before, ax: 0x11ff }); assert.equal(m.lastError, 77);
});

test('DTA address zero is valid and not confused with the default PSP DTA', () => {
  const m = machine(); overlay(m, 'a.txt'); fcb(m);
  const r = registers(0x1a, 0, 0); assert.equal(m.int21Call(0x1a, 0, r), true);
  assert.equal(m.dtaAddr(), 0); assert.equal(call(m), 0); assert.equal(m.mem[0], 3);
});

test('original wrapper buffer spacing and AL03 input work for volume miss then hidden retry', () => {
  const m = machine(); m.changeDisk('A', fatFixture().b);
  m.currentDrive = 0; m.currentDirectory = '';
  fcb(m, { at: 0x6486, name: 'SECRET  SYS', attr: 8 });
  const r = registers(0x1a, 0x645a, 0); assert.equal(m.int21Call(0x1a, 3, r), true);
  r.v.ax = 0x1103; r.v.dx = 0x6486;
  assert.equal(m.int21Call(0x11, 3, r), true); assert.equal(r.v.ax, 0x11ff);
  m.mem[0x648c] = 2;
  r.v.ax = 0x1103; assert.equal(m.int21Call(0x11, 3, r), true); assert.equal(r.v.ax, 0x11ff);
  // Generated hidden-only file, as opposed to SECRET's hidden+system attrs.
  const { b } = fatFixture(); b[1024 + 2 * 32 + 11] = 2; m.changeDisk('A', b);
  r.v.ax = 0x1103; assert.equal(m.int21Call(0x11, 3, r), true); assert.equal(r.v.ax, 0x1100);
  assert.equal(m.mem[0x645a], 255); assert.equal(m.mem[0x6460], 2);
  assert.equal(m.mem[0x646d], 2); // extended FCB result's real directory attribute
  r.v.ax = 0x1203; assert.equal(m.int21Call(0x12, 3, r), true); assert.equal(r.v.ax, 0x12ff);
});

test('continuation binds directory and drive even when both default drive and cwd change', () => {
  const m = machine(); overlay(m, 'save/a.txt'); overlay(m, 'save/b.txt'); overlay(m, 'other.txt');
  m.currentDirectory = 'save'; m.virtualDirectories.add('save'); fcb(m);
  assert.equal(call(m), 0); assert.equal(resultName(m), 'A       TXT');
  m.changeDisk('A', fatFixture().b); m.currentDrive = 0; m.currentDirectory = '';
  assert.equal(call(m, 0x12), 0); assert.equal(resultName(m), 'B       TXT'); assert.equal(m.mem[m.dta], 3);
  m.mem[0x2000] = 1; assert.equal(call(m, 0x12), 255);
});

test('FCB directory searches preserve raw FAT subdirectory entry bytes', () => {
  const m = machine(), { b, root } = fatFixture(); m.changeDisk('A', b);
  fcb(m, { drive: 1, name: 'SUB        ', attr: 0x10 }); assert.equal(call(m), 0);
  assert.deepEqual(Buffer.from(m.mem.slice(m.dta + 8, m.dta + 40)), root[3]);
});

test('namespace exceptions propagate rather than producing invented empty/success results', () => {
  const m = machine(); fcb(m); const fault = Error('namespace failure'); m.dirEntries = () => { throw fault; };
  const r = registers(0x11), before = m.mem.slice(), regs = { ...r.v };
  assert.throws(() => m.int21Call(0x11, 3, r), e => e === fault);
  assert.deepEqual(m.mem, before); assert.deepEqual(r.v, regs); assert.equal(m.fcbSearches, undefined);
});

test('FAT first/next follows on-disk directory order even when files and subdirectories interleave', () => {
  const m = machine(), { b, root } = fatFixture();
  b.set(Buffer.concat([root[0], root[3], root[1], root[2]]), 1024); m.changeDisk('A', b);
  fcb(m, { drive: 1, attr: 0x16 }); const got = [];
  for (let ah = 0x11; call(m, ah) === 0; ah = 0x12) got.push(resultName(m, true));
  assert.deepEqual(got, ['SUB        ', 'REAL    TXT', 'SECRET  SYS']);
});

test('repeated first queries share immutable metadata but never reset copied continuation', () => {
  const m = machine(); overlay(m, 'a.txt'); overlay(m, 'b.txt'); fcb(m); assert.equal(call(m), 0);
  m.mem.copyWithin(0x2400, 0x2000, 0x202c);
  for (let i = 0; i < 50; i++) { fcb(m); assert.equal(call(m), 0); }
  assert.equal(m.fcbSearches.size, 1);
  assert.equal(call(m, 0x12, 0x2400), 0); assert.equal(resultName(m), 'B       TXT');
  assert.equal(call(m, 0x12), 0); assert.equal(resultName(m), 'B       TXT');
});

test('A20-wrapped DTA set through the actual AH1A handler is explicitly refused', () => {
  const m = machine(); overlay(m, 'a.txt'); fcb(m);
  const r = registers(0x1a, 0x20, 0xffff);
  assert.equal(m.int21Call(0x1a, 3, r), true); assert.equal(m.dtaAddr(), 0x10);
  const before = m.mem.slice(); call(m, 0x11, 0x2000, false); assert.deepEqual(m.mem, before);
});
