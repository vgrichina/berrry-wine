#!/usr/bin/env node
'use strict';

// Pure filesystem preparation/verification; never executes a guest or fetches.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const launch = require('../docs/re-notes/outlaws-demo-launch-manifest.json');
const inventory = require('../docs/re-notes/outlaws-demo-inventory.json');
const prepare = process.argv[2] === '--prepare';
const fixture = path.resolve((prepare ? process.argv[4] : process.argv[2]) ||
  path.join(root, 'test/binaries/candidates/outlaws-demo'));
const game = path.join(fixture, 'game', 'OUTDEMO');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function verify(filename, row) {
  assert(fs.lstatSync(filename).isFile(), `not a regular file: ${filename}`);
  const bytes = fs.readFileSync(filename);
  assert.strictEqual(bytes.length, row.size, `size: ${filename}`);
  assert.strictEqual(hash(bytes), row.sha256, `SHA256: ${filename}`);
}
assert.strictEqual(launch.files.length, 30);
assert.strictEqual(inventory.files.length, 31);
assert.strictEqual(new Set(launch.files.map(row => row.guestPath.toLowerCase())).size, 30);
if (prepare) {
  assert(process.argv[3], 'usage: --prepare ORIGINAL_PAYLOAD [FIXTURE]');
  const source = path.resolve(process.argv[3]);
  // Verify all original records before staging the single identical case alias.
  for (const row of inventory.files) verify(path.join(source, row.path), row);
  const disk = fs.statfsSync(path.dirname(source));
  assert(disk.bavail * disk.bsize > 2 * 1024 ** 3 + inventory.expandedBytes,
    'preparation must retain >2 GiB free');
  fs.mkdirSync(game, { recursive: true });
  for (const row of launch.files) {
    const target = path.join(game, row.path);
    if (!fs.existsSync(target)) fs.copyFileSync(path.join(source, row.path), target, fs.constants.COPYFILE_EXCL);
    verify(target, row);
  }
}
assert(fs.lstatSync(game).isDirectory(), 'payload must be a real directory');
assert.deepStrictEqual(fs.readdirSync(game).sort(), launch.files.map(row => row.path).sort());
for (const row of launch.files) verify(path.join(game, row.path), row);
const expected = launch.files.filter(row => row.path !== launch.exe).map(row => ({
  url: 'game/OUTDEMO/' + row.path, vfsPath: row.guestPath, size: row.size,
}));
const filename = path.join(fixture, '.wine-assembly-browser.json');
if (prepare && !fs.existsSync(filename)) {
  fs.writeFileSync(filename, JSON.stringify({ schemaVersion: 1, files: expected }, null, 2) + '\n', { flag: 'wx' });
}
const manifest = JSON.parse(fs.readFileSync(filename));
assert.strictEqual(manifest.schemaVersion, 1);
const sorted = rows => [...rows].sort((a, b) => a.url.localeCompare(b.url));
assert.deepStrictEqual(sorted(manifest.files), sorted(expected), 'all 29 exact companion mappings required');
console.log('Outlaws: 30 unique original files and 29 exact companion mappings verified; executable is supplied by registry');
