#!/usr/bin/env node
'use strict';

// Session-import saves are keyed by a disc fingerprint, not the file name.
//
// discId (lib/media-import.js discIdFor) hashes the mounted tree's sorted
// PATH\0SIZE listing, so it must be: stable across a rename; different for
// two discs that share a file name; identical for an ISO, its raw 2352-byte
// BIN form, a CUE of that BIN, and a zip of the same files with or without a
// wrapper folder. The second half drives the session-import overlay path the
// browser shell takes (overlayScopeFor -> opfsStore -> VfsOverlay) against an
// in-memory fake of the OPFS directory API: write a save, flush, "reload",
// drop the same bytes under another name, and see the save restored.

const assert = require('assert');
const { VirtualFS } = require('../lib/filesystem');
const mediaImport = require('../lib/media-import');
const zipMount = require('../lib/zip-mount');
const { SECTOR_BYTES } = require('../lib/cdrom');
const { opfsStore } = require('../lib/overlay-store');
const VfsOverlay = require('../lib/vfs-overlay');

const ISO_SECTOR = 2048;

// ---- a tiny ISO 9660 writer (primary tree, optional Joliet tree) ----------

function both16(b, off, v) { b[off] = v & 0xff; b[off + 1] = v >>> 8; b[off + 2] = v >>> 8; b[off + 3] = v & 0xff; }
function both32(b, off, v) {
  new DataView(b.buffer).setUint32(off, v, true);
  b[off + 4] = v >>> 24; b[off + 5] = v >>> 16; b[off + 6] = v >>> 8; b[off + 7] = v;
}
function ascii(b, off, v, width) {
  for (let i = 0; i < (width || v.length); i++) b[off + i] = i < v.length ? v.charCodeAt(i) : 0x20;
}
function ucs2(v) {
  const out = [];
  for (const ch of v) { const c = ch.charCodeAt(0); out.push(c >>> 8, c & 0xff); }
  return out;
}
function record(b, off, lba, size, flags, id) {
  const length = 33 + id.length + ((33 + id.length) & 1);
  b[off] = length;
  both32(b, off + 2, lba);
  both32(b, off + 10, size);
  b[off + 25] = flags;
  both16(b, off + 28, 1);
  b[off + 32] = id.length;
  b.set(id, off + 33);
  return length;
}

// files: [{ path: 'DATA/LEVEL1.DAT', long?: 'Data/Level One.dat', data }]
function makeIso(files, opts = {}) {
  const joliet = !!opts.joliet;
  const tree = (useLong) => {
    const root = { dirs: new Map(), files: [] };
    for (const file of files) {
      const parts = (useLong && file.long ? file.long : file.path).split('/');
      let dir = root;
      for (const part of parts.slice(0, -1)) {
        if (!dir.dirs.has(part)) dir.dirs.set(part, { dirs: new Map(), files: [] });
        dir = dir.dirs.get(part);
      }
      dir.files.push({ name: parts[parts.length - 1], file });
    }
    return root;
  };
  const trees = [tree(false)];
  if (joliet) trees.push(tree(true));
  // Assign one sector per directory, then one run of sectors per file.
  let next = joliet ? 19 : 18;
  const assignDirs = (dir) => { dir.lba = next++; for (const d of dir.dirs.values()) assignDirs(d); };
  trees.forEach(assignDirs);
  for (const file of files) {
    file.lba = next;
    next += Math.max(1, Math.ceil(file.data.length / ISO_SECTOR));
  }
  const sectors = next;
  const b = new Uint8Array(sectors * ISO_SECTOR);

  const writeDescriptor = (sector, type, root, isJoliet) => {
    const off = sector * ISO_SECTOR;
    b[off] = type;
    ascii(b, off + 1, 'CD001');
    b[off + 6] = 1;
    if (isJoliet) b.set([0x25, 0x2f, 0x45], off + 88);
    ascii(b, off + 40, 'DISCID_TEST', 32);
    both32(b, off + 80, sectors);
    both16(b, off + 128, ISO_SECTOR);
    record(b, off + 156, root.lba, ISO_SECTOR, 2, [0]);
    ascii(b, off + 813, '1998010112000000');
  };
  writeDescriptor(16, 1, trees[0], false);
  if (joliet) writeDescriptor(17, 2, trees[1], true);
  const term = (joliet ? 18 : 17) * ISO_SECTOR;
  b[term] = 255; ascii(b, term + 1, 'CD001'); b[term + 6] = 1;

  const writeDir = (dir, parent, isJoliet) => {
    const id = name => isJoliet ? ucs2(name) : Array.from(Buffer.from(name, 'ascii'));
    let off = dir.lba * ISO_SECTOR;
    off += record(b, off, dir.lba, ISO_SECTOR, 2, [0]);
    off += record(b, off, parent.lba, ISO_SECTOR, 2, [1]);
    for (const [name, child] of dir.dirs) off += record(b, off, child.lba, ISO_SECTOR, 2, id(name));
    for (const { name, file } of dir.files) {
      off += record(b, off, file.lba, file.data.length, 0, id(name + ';1'));
    }
    for (const child of dir.dirs.values()) writeDir(child, dir, isJoliet);
  };
  trees.forEach((root, i) => writeDir(root, root, i === 1));
  for (const file of files) b.set(file.data, file.lba * ISO_SECTOR);
  return b;
}

function rawMode1(iso) {
  const raw = new Uint8Array((iso.length / ISO_SECTOR) * SECTOR_BYTES);
  const bcd = v => ((Math.floor(v / 10) << 4) | (v % 10));
  for (let s = 0; s < iso.length / ISO_SECTOR; s++) {
    const off = s * SECTOR_BYTES;
    raw.fill(0xff, off + 1, off + 11);
    const frame = s + 150;
    raw[off + 12] = bcd(Math.floor(frame / (60 * 75)));
    raw[off + 13] = bcd(Math.floor(frame / 75) % 60);
    raw[off + 14] = bcd(frame % 75);
    raw[off + 15] = 1;
    raw.set(iso.subarray(s * ISO_SECTOR, (s + 1) * ISO_SECTOR), off + 16);
  }
  return raw;
}

// ---- a store-only zip writer ----------------------------------------------

function makeZip(members) {
  const u16 = v => { const x = Buffer.alloc(2); x.writeUInt16LE(v & 0xffff); return x; };
  const u32 = v => { const x = Buffer.alloc(4); x.writeUInt32LE(v >>> 0); return x; };
  const locals = [], centrals = [];
  let offset = 0;
  for (const m of members) {
    const name = Buffer.from(m.name, 'utf8');
    const data = Buffer.from(m.data || []);
    const crc = zipMount.crc32(new Uint8Array(data));
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
    centrals.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0),
      u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(m.dir ? 0x10 : 0), u32(offset), name]));
    locals.push(local);
    offset += local.length;
  }
  const cd = Buffer.concat(centrals);
  return new Uint8Array(Buffer.concat([...locals, cd, Buffer.concat([u32(0x06054b50), u16(0),
    u16(0), u16(members.length), u16(members.length), u32(cd.length), u32(offset), u16(0)])]));
}

// ---- a fake OPFS directory + Web Locks ------------------------------------

function notFound(name) {
  const e = new Error(`${name} not found`); e.name = 'NotFoundError'; return e;
}
function fakeDir() {
  const dirs = new Map(), files = new Map();
  return {
    kind: 'directory',
    async getDirectoryHandle(name, opts) {
      if (!dirs.has(name)) { if (!(opts && opts.create)) throw notFound(name); dirs.set(name, fakeDir()); }
      return dirs.get(name);
    },
    async getFileHandle(name, opts) {
      if (!files.has(name)) { if (!(opts && opts.create)) throw notFound(name); files.set(name, new Uint8Array(0)); }
      return {
        async getFile() {
          const data = files.get(name);
          return { size: data.length, async arrayBuffer() { return data.slice().buffer; } };
        },
        async createWritable() {
          const parts = [];
          return {
            async write(bytes) { parts.push(new Uint8Array(bytes.buffer ? bytes : new Uint8Array(bytes))); },
            async close() { files.set(name, new Uint8Array(Buffer.concat(parts.map(p => Buffer.from(p))))); },
            async abort() {},
          };
        },
      };
    },
    async removeEntry(name) {
      if (!dirs.delete(name) && !files.delete(name)) throw notFound(name);
    },
    async *keys() { yield* [...files.keys(), ...dirs.keys()]; },
  };
}
const locks = { request(_name, _opts, fn) { return Promise.resolve().then(fn); } };

// ---- fixtures ---------------------------------------------------------------

const enc = s => new Uint8Array(Buffer.from(s, 'latin1'));
const EXE = enc('MZ\x90\x00 tiny game');
function filesA() {
  return [
    { path: 'GAME.EXE', data: EXE },
    { path: 'DATA/LEVEL1.DAT', data: enc('level one') },
    { path: 'README', data: enc('extensionless name') },
    { path: 'EMPTY.TXT', data: new Uint8Array(0) },
  ];
}
function filesB() { // same names, one size differs
  return filesA().map(f => f.path === 'DATA/LEVEL1.DAT' ? { ...f, data: enc('level one!') } : f);
}
function filesSameSizeOtherBytes() {
  return filesA().map(f => f.path === 'DATA/LEVEL1.DAT' ? { ...f, data: enc('LEVEL ONE') } : f);
}

async function analyzeBytes(bytes, name) {
  return mediaImport.analyze(bytes, { name });
}

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.log(`FAIL ${name}\n  ${error && error.stack || error}`); }
}

async function main() {
  const isoA = makeIso(filesA());
  const isoB = makeIso(filesB());
  const ID = /^disc:v1:[0-9a-f]{64}$/;
  const a = await analyzeBytes(isoA, 'disc1.iso');

  await test('ISO discId has the versioned shape and survives a rename', async () => {
    assert.strictEqual(a.kind, 'iso');
    assert.match(a.discId, ID);
    const renamed = await analyzeBytes(isoA, 'My Game (Disc 1).iso');
    assert.notStrictEqual(renamed.id, a.id, 'the icon id is still name-derived');
    assert.strictEqual(renamed.discId, a.discId);
  });

  await test('two discs with the same file name get different ids', async () => {
    const b = await analyzeBytes(isoB, 'disc1.iso');
    assert.strictEqual(b.id, a.id, 'same name -> same icon id (pre-existing)');
    assert.match(b.discId, ID);
    assert.notStrictEqual(b.discId, a.discId, 'one file size differs -> different disc');
  });

  await test('raw Mode 1 BIN and a CUE of it match the cooked ISO', async () => {
    const raw = rawMode1(isoA);
    const bin = await analyzeBytes(raw, 'whatever.bin');
    assert.strictEqual(bin.flavor, 'mode1/2352');
    assert.strictEqual(bin.discId, a.discId);
    const cueText = 'FILE "track01.bin" BINARY\n  TRACK 01 MODE1/2352\n    INDEX 01 00:00:00\n';
    const cue = await mediaImport.analyzeCueBundle([
      { name: 'game.cue', size: cueText.length, source: enc(cueText) },
      { name: 'track01.bin', size: raw.length, source: raw },
    ]);
    assert.strictEqual(cue.discId, a.discId);
  });

  await test('a zip of the same files matches, with or without a wrapper folder', async () => {
    const members = filesA().map(f => ({ name: f.path.toLowerCase(), data: f.data }));
    const flat = await analyzeBytes(makeZip(members), 'game.zip');
    assert.strictEqual(flat.kind, 'zip');
    assert.strictEqual(flat.discId, a.discId);
    const wrapped = await analyzeBytes(makeZip([{ name: 'My Game/', dir: true },
      ...members.map(m => ({ ...m, name: 'My Game/' + m.name }))]), 'mygame-v1.zip');
    assert.strictEqual(wrapped.discId, a.discId);
    const otherSize = await analyzeBytes(makeZip(filesB().map(f => ({ name: f.path, data: f.data }))), 'game.zip');
    assert.notStrictEqual(otherSize.discId, a.discId);
  });

  await test('Joliet long names match a zip of the long names; 8.3-only ISOs do not', async () => {
    const longFiles = filesA().concat([
      { path: 'SAVEGA~1.TXT', long: 'Saved Games Readme.txt', data: enc('long') },
    ]).map(f => ({ ...f, long: f.long || f.path }));
    const jol = await analyzeBytes(makeIso(longFiles, { joliet: true }), 'long.iso');
    const zip = await analyzeBytes(makeZip(longFiles.map(f => ({ name: f.long, data: f.data }))), 'long.zip');
    assert.strictEqual(jol.discId, zip.discId);
    // A primary-only ISO exposes the 8.3 alias, so it is honestly a different
    // tree from the long-name zip: no match is claimed.
    const primary = await analyzeBytes(makeIso(longFiles.map(f => ({ ...f, long: undefined }))), 'short.iso');
    assert.notStrictEqual(primary.discId, zip.discId);
  });

  await test('documented trade-off: same names and sizes, different bytes -> same id', async () => {
    const same = await analyzeBytes(makeIso(filesSameSizeOtherBytes()), 'patched.iso');
    assert.strictEqual(same.discId, a.discId);
  });

  await test('listing normalization: case, separators, ;1, trailing dot, wrapper, dirs', async () => {
    const lines = mediaImport.discListing([
      { path: 'Top\\Sub\\File.Txt;1', size: 3 },
      { path: 'top/README.', size: 0 },
      { path: 'TOP/SUB', size: 0, isDirectory: true },
    ]);
    assert.deepStrictEqual(lines, ['README\u00000\n', 'SUB/FILE.TXT\u00003\n']);
  });

  await test('overlayScopeFor: kept keeps its media scope, session uses the disc', async () => {
    const entry = mediaImport.makeAppEntry(a, { badge: 'session' });
    assert.strictEqual(entry.discId, a.discId);
    assert.deepStrictEqual(mediaImport.overlayScopeFor(entry), { kind: 'disc', scope: a.discId });
    assert.deepStrictEqual(mediaImport.overlayScopeFor({ ...entry, badge: 'kept', mediaId: 'lib-7' }),
      { kind: 'kept', scope: 'lib-7' });
    assert.strictEqual(mediaImport.overlayScopeFor({ ...entry, discId: null }), null);
  });

  await test('session disc journal: save, reload, re-drop renamed, save restored', async () => {
    const root = fakeDir();
    const SAVE = 'C:\\GAMES\\SAVE0.SAV';

    async function boot(bytes, name) {
      const plan = await analyzeBytes(bytes, name);
      const entry = mediaImport.makeAppEntry(plan, { badge: 'session' });
      const target = mediaImport.overlayScopeFor(entry);
      assert.strictEqual(target.kind, 'disc');
      const store = opfsStore(target.scope, { root, locks });
      await store.list();
      const vfs = new VirtualFS();
      for (const mount of entry.mounts) await mount(vfs);
      const overlay = VfsOverlay.attach(vfs, { store });
      const hydrated = await overlay.hydrate();
      return { vfs, overlay, hydrated, store };
    }

    const first = await boot(isoA, 'disc1.iso');
    assert.strictEqual(first.hydrated.files, 0);
    first.vfs.createDirectory('C:\\GAMES');
    const handle = first.vfs.createFile(SAVE, 0x40000000, 2);
    assert.ok(handle);
    const data = enc('slot 0: level 3, 42 lives');
    assert.ok(first.vfs.writeFile(handle, data, data.length).ok);
    first.vfs.closeHandle(handle);
    const report = await first.overlay.flush();
    assert.strictEqual(report.failed, 0, JSON.stringify(report.errors));

    // Reload: fresh VFS, fresh store instance over the same OPFS root, the
    // same disc bytes dropped under a different file name.
    const second = await boot(isoA, 'renamed-after-reload.iso');
    assert.ok(second.hydrated.files >= 1, JSON.stringify(second.hydrated));
    const restored = await second.vfs.materialize(SAVE);
    assert.strictEqual(Buffer.from(restored).toString('latin1'), 'slot 0: level 3, 42 lives');

    // The zip of the same files is the same disc and sees the same save.
    const viaZip = await boot(makeZip(filesA().map(f => ({ name: 'Wrap/' + f.path, data: f.data }))), 'x.zip');
    assert.ok(viaZip.vfs.files.has(viaZip.vfs._normPath(SAVE)), 'zip of same tree restores the save');

    // A different disc with the same file name starts clean.
    const other = await boot(isoB, 'disc1.iso');
    assert.strictEqual(other.hydrated.files, 0);
    assert.ok(!other.vfs.files.has(other.vfs._normPath(SAVE)));
  });

  // A bare EXE has no tree: its identity is its bytes (media-import.js exeIdFor).
  const peBytes = (salt) => {
    const b = new Uint8Array(1024);
    b.set(enc('MZ'), 0);
    b[0x3c] = 0x80;                      // e_lfanew
    b.set(enc('PE\0\0'), 0x80);
    b[0x84] = 0x4c; b[0x85] = 0x01;      // i386
    b.set(enc(`payload ${salt}`), 0x200);
    return b;
  };

  await test('bare EXE: exe:v1 id from its bytes; rename keeps it, other bytes change it', async () => {
    const p1 = await analyzeBytes(peBytes('a'), 'GAME.EXE');
    assert.strictEqual(p1.kind, 'exe', `sniffed ${p1.kind}`);
    assert.match(p1.discId, /^exe:v1:[0-9a-f]{64}$/);
    const renamed = await analyzeBytes(peBytes('a'), 'game-copy.exe');
    assert.strictEqual(renamed.discId, p1.discId, 'a rename keeps the journal');
    const patched = await analyzeBytes(peBytes('b'), 'GAME.EXE');
    assert.notStrictEqual(patched.discId, p1.discId, 'same name and size, other bytes: new journal');
    const entry = mediaImport.makeAppEntry(p1, { badge: 'session' });
    assert.deepStrictEqual(mediaImport.overlayScopeFor(entry), { kind: 'disc', scope: p1.discId });
  });

  await test('bare EXE: sidecars join by name and size', async () => {
    const plain = await mediaImport.analyze(peBytes('a'), { name: 'SETUP.EXE' });
    const withData = await mediaImport.analyze(peBytes('a'),
      { name: 'SETUP.EXE', sidecars: [new File([enc('cab bytes')], 'DATA1.CAB')] });
    assert.notStrictEqual(withData.discId, plain.discId);
    const again = await mediaImport.analyze(peBytes('a'),
      { name: 'SETUP.EXE', sidecars: [new File([enc('cab BYTES')], 'data1.cab')] });
    assert.strictEqual(again.discId, withData.discId, 'sidecar case and bytes do not matter, size does');
  });

  await test('bare EXE: huge programs hash head, tail and size', async () => {
    const big = new Uint8Array(65 * 1024 * 1024 + 3);
    const id1 = await mediaImport.exeIdFor(big, []);
    big[40 * 1024 * 1024] = 1; // middle: not hashed
    assert.strictEqual(await mediaImport.exeIdFor(big, []), id1);
    big[big.length - 1] = 1;   // tail: hashed
    assert.notStrictEqual(await mediaImport.exeIdFor(big, []), id1);
    assert.notStrictEqual(await mediaImport.exeIdFor(big.subarray(0, big.length - 1), []), id1, 'size is hashed');
  });

  await test('bare EXE journal: save survives a reload, mount reuses then rereads the bytes', async () => {
    const root = fakeDir();
    const SAVE = 'C:\\HISCORE.DAT';
    async function boot(name) {
      const plan = await analyzeBytes(peBytes('a'), name);
      const entry = mediaImport.makeAppEntry(plan, { badge: 'session' });
      const store = opfsStore(mediaImport.overlayScopeFor(entry).scope, { root, locks });
      await store.list();
      const vfs = new VirtualFS();
      for (const mount of entry.mounts) await mount(vfs);
      const exe = await vfs.materialize('C:\\' + name.toUpperCase());
      assert.deepStrictEqual(Array.from(exe.subarray(0, 2)), [0x4d, 0x5a]);
      const overlay = VfsOverlay.attach(vfs, { store });
      return { vfs, overlay, hydrated: await overlay.hydrate(), entry };
    }
    const first = await boot('GAME.EXE');
    const handle = first.vfs.createFile(SAVE, 0x40000000, 2);
    const data = enc('top score 9000');
    assert.ok(first.vfs.writeFile(handle, data, data.length).ok);
    first.vfs.closeHandle(handle);
    assert.strictEqual((await first.overlay.flush()).failed, 0);
    // A relaunch of the same entry mounts again from the provider.
    const vfs2 = new VirtualFS();
    for (const mount of first.entry.mounts) await mount(vfs2);
    assert.ok(vfs2.files.has(vfs2._normPath('C:\\GAME.EXE')));
    const second = await boot('GAME.EXE');
    assert.ok(second.hydrated.files >= 1, JSON.stringify(second.hydrated));
    assert.strictEqual(Buffer.from(await second.vfs.materialize(SAVE)).toString('latin1'), 'top score 9000');
  });

  if (failures) {
    console.log(`${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('all disc-id tests passed');
}

main().catch(error => { console.error(error); process.exit(1); });
