#!/usr/bin/env node
'use strict';

// Filesystem only: no download, build or guest execution.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const originalMode = process.argv[2] === '--original';
const prepare = process.argv[2] === '--prepare';
const source = originalMode || prepare ? path.resolve(process.argv[3] || '.') : null;
const fixture = path.resolve((prepare ? process.argv[4] : originalMode ? undefined : process.argv[2]) ||
  path.join(root, 'test/binaries/candidates/ltris-128'));
const crt = path.resolve((prepare ? process.argv[5] : process.argv[3 + Number(originalMode)]) ||
  path.join(root, 'test/binaries/dlls/msvcrt.dll'));
function inventory(dir, prefix = '') {
  assert(fs.lstatSync(dir).isDirectory(), `not a real directory: ${dir}`);
  return fs.readdirSync(dir).flatMap(name => {
    const filename = path.join(dir, name);
    const relative = prefix + name;
    const stat = fs.lstatSync(filename);
    assert(!stat.isSymbolicLink(), `symlink: ${relative}`);
    if (stat.isDirectory()) return inventory(filename, relative + '/');
    assert(stat.isFile(), `not a regular file: ${relative}`);
    return [{ path: relative, bytes: stat.size, sha256: hash(fs.readFileSync(filename)) }];
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function verifyRows(rows, count, bytes, digest) {
  assert.strictEqual(rows.length, count, 'file count');
  assert.strictEqual(rows.reduce((sum, row) => sum + row.bytes, 0), bytes, 'total bytes');
  assert.strictEqual(hash(JSON.stringify(rows)), digest, 'original inventory changed');
}
assert(fs.lstatSync(crt).isFile(), 'CRT must be a regular file');
assert.strictEqual(hash(fs.readFileSync(crt)),
  '887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1', 'authentic corpus MSVCRT required');
const client = source ? source : path.join(fixture, 'game/LTRIS');
const rows = inventory(client);
verifyRows(rows, 40, 7361674,
  '3478f9e208874423e61983d0a90df02d1cde36ca85ea2ef9628c79fe68181149');
const expected = rows.filter(row => row.path !== 'ltris.exe').map(row => ({
  url: 'game/LTRIS/' + row.path,
  vfsPath: 'C:\\LTRIS\\' + row.path.replace(/\//g, '\\'),
  size: row.bytes,
}));
if (originalMode) {
  console.log('LTris: 40 original files and authentic CRT verified; no fixture copied or mapping manifest inspected');
  process.exit(0);
}
if (prepare) {
  assert(!fs.existsSync(fixture), 'prepare requires a fresh destination');
  let ancestor = path.dirname(fixture);
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const disk = fs.statfsSync(ancestor);
  assert(disk.bavail * disk.bsize > 2 * 1024 ** 3 + 64 * 1024 ** 2 + 7361674,
    'preparation must retain >2 GiB plus 64 MiB margin');
  fs.mkdirSync(fixture, { recursive: true });
  const target = path.join(fixture, 'game/LTRIS');
  fs.mkdirSync(path.dirname(target));
  fs.cpSync(client, target, { recursive: true, errorOnExist: true, force: false });
  verifyRows(inventory(target), 40, 7361674,
    '3478f9e208874423e61983d0a90df02d1cde36ca85ea2ef9628c79fe68181149');
  fs.writeFileSync(path.join(fixture, '.wine-assembly-browser.json'),
    JSON.stringify({ schemaVersion: 1, files: expected }, null, 2) + '\n', { flag: 'wx' });
}
const manifest = JSON.parse(fs.readFileSync(path.join(fixture, '.wine-assembly-browser.json')));
assert.strictEqual(manifest.schemaVersion, 1);
const sorted = files => [...files].sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
assert.deepStrictEqual(sorted(manifest.files), sorted(expected), 'all 39 exact companion mappings required');
console.log('LTris: 40 original client files, authentic CRT and 39 exact companion mappings verified');
