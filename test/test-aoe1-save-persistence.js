#!/usr/bin/env node
'use strict';

// Age of Empires Trial (aoe1) saves a game from F10 -> Save as
// savegame\<name>.gam beside Empires.exe, which the registry mounts at C:\.
// Its Load Game screen lists FindFirstFile("savegame\*.gam") relative to that
// working directory (measured 2026-11-15, scratch/runs/20261115-aoe-saves).
// The player list and campaign progress are game0.nfo in the same directory,
// read at startup and written on Exit. The browser keeps only an app's
// persistFiles across a reload, and aoe1 had none: a saved game was gone
// after the page reloaded.
//
// This runs the real VirtualFS and the real persistence layer (the same
// IndexedDB storage wrapper the page uses, over an in-memory object store)
// through a save, a reload and the game's own Load Game lookup. With
// AOE1_SAVE=<path to a .gam> / AOE1_NFO=<path to game0.nfo> it uses those
// bytes, i.e. files written by the game in the emulator; otherwise stand-ins.

const assert = require('assert');
const fs = require('fs');
const { APPS } = require('../lib/apps');
const { VirtualFS } = require('../lib/filesystem');
const VfsPersistence = require('../lib/vfs-persistence');

class MemoryIdb {
  constructor() { this.rows = new Map(); }
  async getAll() { return Array.from(this.rows.entries()); }
  async put(key, value) { this.rows.set(key, value); }
  async delete(key) { this.rows.delete(key); }
}

// An early Homelands save written by the game in the emulator is 139,057
// bytes; saves grow with the map explored and units alive.
const MEASURED_SAVE_BYTES = 139057;

function saveBytes() {
  const path = process.env.AOE1_SAVE;
  if (path) return { bytes: new Uint8Array(fs.readFileSync(path)), real: true };
  const bytes = Uint8Array.from({ length: MEASURED_SAVE_BYTES }, (_, i) => (i * 131 + 7) & 0xFF);
  return { bytes, real: false };
}

async function launch(idb, app) {
  const storage = await VfsPersistence.createIndexedDbStorage({ adapter: idb });
  const vfs = new VirtualFS();
  assert(vfs.setCurrentDirectory('C:\\'), 'Empires.exe runs from C:\\');
  const persistence = VfsPersistence.attach(vfs, {
    appId: 'aoe1', patterns: app.persistFiles, storage,
    maxFileBytes: app.persistMaxBytes,
  });
  return { vfs, persistence, storage };
}

// The game's own call shapes: CreateFile("savegame\NAME.gam", GENERIC_WRITE,
// CREATE_ALWAYS) relative to the working directory, then WriteFile.
function gameWrite(vfs, relPath, bytes) {
  const h = vfs.createFile(relPath, 0x40000000, 2);
  assert(h && h !== 0xFFFFFFFF, `create ${relPath}`);
  vfs.writeFile(h, bytes, bytes.length);
  if (typeof vfs.closeHandle === 'function') vfs.closeHandle(h);
}

async function settle(session) {
  await Promise.resolve();
  session.persistence.flush();
  await session.storage.settled();
}

async function run() {
  const app = APPS.aoe1;
  assert(app, 'aoe1 is registered');
  assert.deepStrictEqual(app.persistFiles, ['c:\\savegame\\*.gam', 'c:\\game*.nfo']);
  assert.strictEqual(app.persistStore, 'indexeddb');
  const { bytes, real } = saveBytes();
  const profile = process.env.AOE1_NFO
    ? new Uint8Array(fs.readFileSync(process.env.AOE1_NFO))
    : Uint8Array.from([1, 0, 0, 0, 0x41, 0x4f, 0x45, 0, 0, 0, 0, 0]);
  assert(app.persistMaxBytes >= bytes.length * 16, 'the per-file cap leaves room for a late-game save');

  const idb = new MemoryIdb();
  const first = await launch(idb, app);
  gameWrite(first.vfs, 'savegame\\MYSAVE.gam', bytes);
  // On Exit the game writes its player list and campaign progress to
  // game0.nfo (same working directory), and rewrites the shipped scenario
  // index, which stays the shipped file.
  gameWrite(first.vfs, 'game0.nfo', profile);
  gameWrite(first.vfs, 'scenario\\scenario.inf', bytes.subarray(0, 0x185));
  // What else the game writes during a session stays out of storage: AI
  // scratch in the temp dir and its own debug logs.
  gameWrite(first.vfs, 'C:\\WINDOWS\\TEMP\\temp1.tmp', bytes.subarray(0, 4096));
  gameWrite(first.vfs, 'c:\\aoedoppl.txt', bytes.subarray(0, 49));
  gameWrite(first.vfs, 'c:\\aoewvlog.txt', bytes.subarray(0, 0x2fa));
  await settle(first);
  assert.strictEqual(idb.rows.size, 2, 'only the saved game and the player file persist');

  // A reload: a fresh page, a fresh VFS, the same database.
  const second = await launch(idb, app);
  assert.strictEqual(second.persistence.restored, 2);
  const nfo = second.vfs.files.get('c:\\game0.nfo');
  assert(nfo && Buffer.from(nfo.data).equals(Buffer.from(profile)), 'game0.nfo restored byte for byte');
  assert(second.vfs.createFile('game0.nfo', 0x80000000, 3) !== 0xFFFFFFFF,
    'the startup CreateFile("game0.nfo") finds the player list');
  const restored = second.vfs.files.get('c:\\savegame\\mysave.gam');
  assert(restored, 'the save is back under c:\\savegame');
  assert.strictEqual(restored.data.length, bytes.length);
  assert(Buffer.from(restored.data).equals(Buffer.from(bytes)), 'restored byte for byte');

  // Load Game's own lookup, relative to the working directory.
  const find = second.vfs.findFirstFile('savegame\\*.gam');
  assert(find && find.entry, 'FindFirstFile(savegame\\*.gam) finds the restored save');
  assert.strictEqual(find.entry.name, 'MYSAVE.gam', 'the list shows the name as typed');
  const h = second.vfs.createFile('savegame\\MYSAVE.gam', 0x80000000, 3);
  assert(h && h !== 0xFFFFFFFF, 'Load Game can open the restored save');

  // Overwriting the save in the game replaces the stored copy, and the
  // dialog's Delete removes it.
  const changed = bytes.slice(); changed[0] ^= 0xFF;
  gameWrite(second.vfs, 'savegame\\MYSAVE.gam', changed);
  await settle(second);
  const third = await launch(idb, app);
  assert.strictEqual(third.vfs.files.get('c:\\savegame\\mysave.gam').data[0], changed[0]);
  assert(third.vfs.deleteFile('savegame\\MYSAVE.gam'));
  await settle(third);
  assert.strictEqual(idb.rows.size, 1, 'a deleted save leaves IndexedDB; the player file stays');

  console.log(`PASS  aoe1 saved games and player file persist across a browser reload ` +
    `(${real ? 'real game save' : 'stand-in'} ${bytes.length} bytes, ` +
    `${process.env.AOE1_NFO ? 'real' : 'stand-in'} game0.nfo ${profile.length} bytes)`);
}

run().catch(error => { console.error(error.stack || error); process.exit(1); });
