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
  path.join(root, 'test/binaries/candidates/lbreakout2-251'));
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
if (source) {
  verifyRows(inventory(source), 230, 5606025,
    'cee01dc33e02393639a64f145d7029d00108d3a89de799968139e46c27a25691');
}
const client = source ? path.join(source, 'lbreakout2/client') : path.join(fixture, 'game/LBREAKOUT');
const rows = inventory(client);
verifyRows(rows, 220, 4948104,
  'e4caab94fecbcc34c648e31081b1d30a952127b9dc6d40ceeae7a6da926068f9');
const expected = rows.filter(row => row.path !== 'lbreakout2.exe').map(row => ({
  url: 'game/LBREAKOUT/' + row.path,
  vfsPath: 'C:\\LBREAKOUT\\' + row.path.replace(/\//g, '\\'),
  size: row.bytes,
}));
if (originalMode) {
  console.log('LBreakout2: 230 originals, 220 client files and authentic CRT verified; no fixture copied or mapping manifest inspected');
  process.exit(0);
}
if (prepare) {
  assert(!fs.existsSync(fixture), 'prepare requires a fresh destination');
  const disk = fs.statfsSync(source);
  assert(disk.bavail * disk.bsize > 2 * 1024 ** 3 + 64 * 1024 ** 2 + 4948104,
    'preparation must retain >2 GiB plus 64 MiB margin');
  fs.mkdirSync(fixture, { recursive: true });
  const target = path.join(fixture, 'game/LBREAKOUT');
  fs.mkdirSync(path.dirname(target));
  fs.cpSync(client, target, { recursive: true, errorOnExist: true, force: false });
  verifyRows(inventory(target), 220, 4948104,
    'e4caab94fecbcc34c648e31081b1d30a952127b9dc6d40ceeae7a6da926068f9');
  fs.writeFileSync(path.join(fixture, '.wine-assembly-browser.json'),
    JSON.stringify({ schemaVersion: 1, files: expected }, null, 2) + '\n', { flag: 'wx' });
}
const manifest = JSON.parse(fs.readFileSync(path.join(fixture, '.wine-assembly-browser.json')));
assert.strictEqual(manifest.schemaVersion, 1);
const sorted = files => [...files].sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
assert.deepStrictEqual(sorted(manifest.files), sorted(expected), 'all 219 exact companion mappings required');
console.log('LBreakout2: 220 original client files, authentic CRT and 219 exact companion mappings verified');
