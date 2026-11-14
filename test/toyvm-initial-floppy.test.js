'use strict';

// Generated media only. This test runs native ToyVM/Wasm when explicitly
// invoked; node --check does not execute it. No proprietary fixture required.
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { runDos, runDosWithPre } = require('../tools/toyvm/run-dos');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

function program(mz, parent, childName = 'CHILD.COM') {
  const code = [], refs = [], labels = {}, reloc = [];
  const base = mz ? 0 : 0x100;
  const e = (...b) => code.push(...b);
  const word = n => e(n & 255, n >> 8 & 255);
  const addr = (op, name, plus = 0) => { e(op); refs.push([code.length, name, plus]); word(0); };
  // A failed DOS call exits with a distinct nonzero code. JNC skips exit.
  const ok = n => e(0x73, 5, 0xb8, n, 0x4c, 0xcd, 0x21);
  const close = () => { e(0xb4, 0x3e, 0xcd, 0x21); ok(91); };
  const read = () => {
    addr(0xba, 'source'); e(0xb8, 0, 0x3d, 0xcd, 0x21); ok(92);
    e(0x89, 0xc3); addr(0xba, 'record', 65);
    e(0xb9, 4, 0, 0xb4, 0x3f, 0xcd, 0x21); ok(93); close();
  };
  const write = (name, buffer, length, plus = 0) => {
    addr(0xba, name); e(0x31, 0xc9, 0xb4, 0x3c, 0xcd, 0x21); ok(94);
    e(0x89, 0xc3); addr(0xba, buffer, plus);
    e(0xb9); word(length); e(0xb4, 0x40, 0xcd, 0x21); ok(95); close();
  };
  // Both formats enter through their normal loader register conventions.
  e(0x8c, 0xd8, 0x0e, 0x1f); // mov ax,ds (PSP); push cs; pop ds
  addr(0xa3, 'record', 76);
  if (mz) {
    e(0xb8); reloc.push(code.length); word(0); // relocated immediate -> loadSeg
    addr(0xa3, 'record', 74);
  }
  if (parent) {
    e(0xbc, 0xf0, 0x0f, 0xbb, 0x10, 1, 0xb4, 0x4a, 0xcd, 0x21); ok(90);
    e(0x0e, 0x07); // ES=CS for EXEC parameter block, after shrinking PSP block
    e(0xb4, 0x19, 0xcd, 0x21); addr(0xa2, 'record');
    e(0x31, 0xd2); addr(0xbe, 'record', 1); e(0xb4, 0x47, 0xcd, 0x21); ok(96);
  }
  read();
  if (parent) {
    // Genuine read-only A: rejects create and writable open of a companion.
    addr(0xba, 'source'); e(0x31, 0xc9, 0xb4, 0x3c, 0xcd, 0x21);
    e(0x72, 5, 0xb8, 97, 0x4c, 0xcd, 0x21); addr(0xa3, 'record', 70);
    addr(0xba, 'source'); e(0xb8, 2, 0x3d, 0xcd, 0x21);
    e(0x72, 5, 0xb8, 98, 0x4c, 0xcd, 0x21); addr(0xa3, 'record', 72);
    addr(0xba, 'child'); addr(0xbb, 'pb'); e(0xb8, 0, 0x4b, 0xcd, 0x21); ok(99);
    e(0xb4, 0x4d, 0xcd, 0x21); addr(0xa2, 'record', 69);
    write('target', 'record', 80);
    e(0xb8, 0, 0x4c, 0xcd, 0x21);
  } else {
    write('target', 'record', 4, 65);
    e(0xb8, 7, 0x4c, 0xcd, 0x21);
  }
  const strings = { source: 'SAME.TXT\0', target: parent ? 'C:/RESULT.DAT\0' : 'C:/CHILD.DAT\0',
    child: childName + '\0', pb: Buffer.alloc(14), record: Buffer.alloc(80) };
  for (const [name, bytes] of Object.entries(strings)) {
    labels[name] = base + code.length; e(...Buffer.from(bytes));
  }
  for (const [at, name, plus] of refs) {
    const n = labels[name] + plus; code[at] = n & 255; code[at + 1] = n >> 8;
  }
  const body = Buffer.from(code);
  if (!mz) return body;
  const header = Buffer.alloc(32), size = 32 + body.length;
  header.write('MZ'); header.writeUInt16LE(size % 512, 2);
  header.writeUInt16LE(Math.ceil(size / 512), 4); header.writeUInt16LE(reloc.length, 6);
  header.writeUInt16LE(2, 8); header.writeUInt16LE(0x100, 10);
  header.writeUInt16LE(0xffff, 12); header.writeUInt16LE(0xff0, 16);
  header.writeUInt16LE(28, 24); header.writeUInt16LE(reloc[0], 28);
  return Buffer.concat([header, body]);
}

function disk(parent, child, parentName, childName) {
  const b = Buffer.alloc(1474560), fat = b.subarray(512, 5120);
  b.writeUInt16LE(512, 11); b[13] = 1; b.writeUInt16LE(1, 14); b[16] = 2;
  b.writeUInt16LE(224, 17); b.writeUInt16LE(2880, 19); b[21] = 0xf0;
  b.writeUInt16LE(9, 22); b[510] = 0x55; b[511] = 0xaa;
  fat.set([0xf0, 0xff, 0xff]);
  const link = (c, n) => {
    const at = c + (c >> 1);
    if (c & 1) { fat[at] = (fat[at] & 15) | (n << 4 & 255); fat[at + 1] = n >> 4; }
    else { fat[at] = n & 255; fat[at + 1] = (fat[at + 1] & 240) | n >> 8; }
  };
  const entry = (at, name, attr, c, size) => {
    const [stem, ext = ''] = name.split('.');
    b.write(stem.padEnd(8) + ext.padEnd(3), at, 'ascii'); b[at + 11] = attr;
    b.writeUInt16LE(c, at + 26); b.writeUInt32LE(size, at + 28);
  };
  let next = 2;
  const directory = next++; link(directory, 0xfff);
  entry(19 * 512, 'SUB', 16, directory, 0);
  const sub = (33 + directory - 2) * 512;
  // Distinct C/root/SUB contents detect accidental basename or host fallback.
  const files = [[19 * 512 + 32, 'SAME.TXT', Buffer.from('ROOT')],
    [19 * 512 + 64, parentName, parent], [19 * 512 + 96, childName, child],
    [sub, parentName, parent], [sub + 32, childName, child],
    [sub + 64, 'SAME.TXT', Buffer.from('FAT!')], [sub + 96, 'EMPTY.COM', Buffer.alloc(0)]];
  for (const [at, name, bytes] of files) {
    const count = Math.ceil(bytes.length / 512), first = count ? next : 0;
    for (let i = 0; i < count; i++) {
      const c = next++; link(c, i + 1 === count ? 0xfff : c + 1);
      bytes.copy(b, (33 + c - 2) * 512, i * 512, (i + 1) * 512);
    }
    entry(at, name, 32, first, bytes.length);
  }
  fat.copy(b, 5120); return b;
}

const options = { budget: 100000, seconds: 10, slice: 10000, log: () => {}, sound: 'none' };
function completed(r) {
  assert.equal(r.machine.exited, true); assert.equal(r.machine.exitCode, 0);
  assert.equal(r.ranOutOfTime, false); assert.equal(r.machine.execStack.length, 0);
}
function result(r, mz, cwd = 'SUB', companion = 'FAT!') {
  completed(r);
  const bytes = r.machine.readWholeFile('C:/RESULT.DAT'); assert.equal(bytes.length, 80);
  assert.equal(bytes[0], 0); assert.equal(bytes.subarray(1, 1 + cwd.length + 1).toString(), cwd + '\0');
  assert.equal(bytes.subarray(65, 69).toString(), companion); assert.equal(bytes[69], 7);
  assert.equal(bytes.readUInt16LE(70), 5); assert.equal(bytes.readUInt16LE(72), 5);
  assert.equal(bytes.readUInt16LE(76), r.machine.pspSeg);
  assert.equal(bytes.readUInt16LE(74), mz ? r.machine.loadSeg : 0);
  assert.equal(r.machine.readWholeFile('C:/CHILD.DAT').toString(), companion);
  assert.equal(r.machine.currentDrive, 0); assert.equal(r.machine.currentDirectory, cwd.toLowerCase());
  assert.equal(r.machine.readWholeFile('A:/SUB/SAME.TXT').toString(), 'FAT!');
  assert([...r.machine.tempFiles.keys()].every(k => !/^[ab]:/i.test(k)));
  const psp = r.machine.pspSeg << 4, mem = r.vm.mem;
  assert.deepEqual([...mem.subarray(psp, psp + 2)], [0xcd, 0x20]);
  assert.equal(mem[psp + 0x80], 6); // leading space + /TEST
  assert.equal(Buffer.from(mem.subarray(psp + 0x81, psp + 0x87)).toString(), ' /TEST');
  const envSeg = mem[psp + 0x2c] | mem[psp + 0x2d] << 8;
  assert(Buffer.from(mem.subarray(envSeg << 4, (envSeg << 4) + 256)).includes(Buffer.from(r.exe + '\0')));
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'toyvm-initial-floppy-'));
  try {
    fs.writeFileSync(path.join(root, 'SAME.TXT'), 'HOST');
    for (const mz of [false, true]) {
      // Misleading extensions ensure the canonical signature-based loader wins.
      const name = mz ? 'PARENT.COM' : 'PARENT.EXE', child = mz ? 'CHILD.COM' : 'CHILD.EXE';
      const media = disk(program(mz, true, child), program(!mz, false), name, child);
      const hash = sha(media), imagePath = path.join(root, 'DISK.IMG'); fs.writeFileSync(imagePath, media);
      const r = await runDos({ ...options, initialFloppy: mz ? imagePath : media,
        program: 'a:' + name, currentDirectory: 'SUB', guestArgs: '/TEST' });
      result(r, mz); assert.equal(r.exe, 'A:\\SUB\\' + name);
      assert.equal(r.machine.fileRoot, null); assert.equal(r.machine.readWholeFile('C:/SAME.TXT'), null);
      assert.equal(sha(media), hash); assert.equal(sha(fs.readFileSync(imagePath)), hash);
      const atRoot = await runDos({ ...options, initialFloppy: media, program: 'A:/' + name, guestArgs: '/TEST' });
      result(atRoot, mz, '', 'ROOT'); assert.equal(atRoot.exe, 'A:\\' + name);
      // A second machine gets an isolated C: overlay, even on the same media.
      const again = await runDos({ ...options, initialFloppy: media, program: name,
        currentDirectory: 'SUB', fileRoot: root, guestArgs: '/TEST' });
      result(again, mz); assert.notEqual(again.machine.tempFiles, r.machine.tempFiles);
      assert.equal(again.machine.readWholeFile('C:/SAME.TXT').toString(), 'HOST');
      assert.equal(fs.existsSync(path.join(root, 'RESULT.DAT')), false);
      assert.equal(fs.readFileSync(path.join(root, 'SAME.TXT'), 'utf8'), 'HOST');
      assert.equal(sha(fs.readFileSync(imagePath)), hash);
      for (const selection of ['A:/MISSING.COM', 'C:/SAME.TXT', 'B:/PARENT.COM',
        'A:/SUB', 'A:/SUB/', 'A:/SUB/EMPTY.COM', 'A:/*.COM']) {
        await assert.rejects(runDos({ ...options, initialFloppy: media, program: selection }),
          /initial floppy program|DOS floppy program/);
      }
      await assert.rejects(runDos({ ...options, initialFloppy: media }), /requires program/);
      await assert.rejects(runDos({ ...options, program: name }), /requires program|requires initialFloppy/);
      await assert.rejects(runDos({ ...options, initialFloppy: media, program: name, exe: imagePath }), /no exe\/pre/);
      await assert.rejects(runDos({ ...options, initialFloppy: media, program: name, currentDirectory: 'MISSING' }), /working directory/);
      await assert.rejects(runDos({ ...options, initialFloppy: Buffer.alloc(512), program: name }), /FAT12/);
      await assert.rejects(runDos({ ...options, initialFloppy: media, program: 'A:/GO.BAT' }), /not a batch/);
      await assert.rejects(runDosWithPre({ ...options, initialFloppy: media, program: name, pre: 'SETUP.COM' }), /cannot be used with pre/);
      // CLI success, plus missing selection fails instead of entering FAT bytes.
      const cli = args => spawnSync(process.execPath, [path.join(__dirname, '../tools/toyvm/run-dos.js'), ...args],
        { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
      const good = cli([`--initial-floppy=${imagePath}`, `--program=A:/SUB/${name}`,
        '--current-directory=SUB', '--dispatches=100k', '--seconds=10']);
      assert.equal(good.error, undefined); assert.equal(good.status, 0, good.stderr);
      assert.match(good.stdout, /exited=true code=0/);
      const bad = cli([`--initial-floppy=${imagePath}`, '--dispatches=100k']);
      assert.equal(bad.error, undefined); assert.equal(bad.status, 1); assert.match(bad.stderr, /requires program/);
      assert.equal(sha(fs.readFileSync(imagePath)), hash);
    }
    // Existing host COM default still starts on C: with its ordinary PSP route.
    const host = path.join(root, 'HOST.COM'); fs.writeFileSync(host, Buffer.from([0xb8, 0, 0x4c, 0xcd, 0x21]));
    const old = await runDos({ ...options, exe: host }); completed(old);
    assert.equal(old.machine.currentDrive, 2); assert.equal(old.machine.currentDirectory, '');
    assert.equal(old.machine.fileRoot, root); assert.equal(old.exe, host);
    console.log('PASS initial FAT12 A: COM/MZ canonical startup, cwd/companions, EXEC return, isolated C:, immutable media and invalid selections');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
