#!/usr/bin/env node
'use strict';

// List or extract entries of an id Software PACK archive (Quake, Quake II,
// Hexen II, Half-Life's .pak, and the other Quake-engine games).
//
//   node tools/quake-pak.js FILE.pak                 # list: offset size name
//   node tools/quake-pak.js FILE.pak NAME            # print NAME to stdout
//   node tools/quake-pak.js FILE.pak NAME --out=PATH # write NAME to PATH
//
// Format: "PACK", int32 dirOffset, int32 dirLength; the directory is
// dirLength/64 entries of { char name[56]; int32 offset; int32 size }.
// Names compare case-insensitively, as the engines' own lookups do.

const fs = require('fs');

function readPak(file) {
  const fd = fs.openSync(file, 'r');
  const header = Buffer.alloc(12);
  fs.readSync(fd, header, 0, 12, 0);
  if (header.toString('latin1', 0, 4) !== 'PACK') throw new Error(`${file}: not a PACK archive`);
  const dirOffset = header.readInt32LE(4), dirLength = header.readInt32LE(8);
  if (dirLength % 64) throw new Error(`${file}: directory length ${dirLength} is not a multiple of 64`);
  const dir = Buffer.alloc(dirLength);
  fs.readSync(fd, dir, 0, dirLength, dirOffset);
  const entries = [];
  for (let i = 0; i < dirLength; i += 64) {
    const raw = dir.toString('latin1', i, i + 56);
    entries.push({ name: raw.slice(0, raw.indexOf('\0') < 0 ? 56 : raw.indexOf('\0')),
      offset: dir.readInt32LE(i + 56), size: dir.readInt32LE(i + 60) });
  }
  const read = entry => {
    const out = Buffer.alloc(entry.size);
    fs.readSync(fd, out, 0, entry.size, entry.offset);
    return out;
  };
  return { entries, read, close: () => fs.closeSync(fd) };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const outArg = args.find(a => a.startsWith('--out='));
  const [file, name] = args.filter(a => !a.startsWith('--'));
  if (!file) {
    console.error('usage: node tools/quake-pak.js FILE.pak [NAME] [--out=PATH]');
    process.exit(2);
  }
  const pak = readPak(file);
  try {
    if (!name) {
      for (const e of pak.entries) console.log(`${String(e.offset).padStart(10)} ${String(e.size).padStart(9)} ${e.name}`);
    } else {
      const entry = pak.entries.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (!entry) { console.error(`${name}: not in ${file}`); process.exit(1); }
      const data = pak.read(entry);
      if (outArg) fs.writeFileSync(outArg.slice('--out='.length), data);
      else process.stdout.write(data);
    }
  } finally { pak.close(); }
}

module.exports = { readPak };
