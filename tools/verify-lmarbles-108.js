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
  path.join(root, 'test/binaries/candidates/lmarbles-108'));
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
const client = source ? source : path.join(fixture, 'game/LMARBLES');
const rows = inventory(client);
verifyRows(rows, 86, 3800414,
  'aa2cbae11ba5b5a57010643b886552b3ee955e441f76976a3a7593018816d93b');
const expected = rows.filter(row => row.path !== 'lmarbles.exe').map(row => ({
  url: 'game/LMARBLES/' + row.path,
  vfsPath: 'C:\\LMARBLES\\' + row.path.replace(/\//g, '\\'),
  size: row.bytes,
}));
if (originalMode) {
  console.log('LMarbles: 86 original files and authentic CRT verified; no fixture copied or mapping manifest inspected');
  process.exit(0);
}
if (prepare) {
  assert(!fs.existsSync(fixture), 'prepare requires a fresh destination');
  let ancestor = path.dirname(fixture);
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const disk = fs.statfsSync(ancestor);
  assert(disk.bavail * disk.bsize > 2 * 1024 ** 3 + 64 * 1024 ** 2 + 3800414,
    'preparation must retain >2 GiB plus 64 MiB margin');
  fs.mkdirSync(fixture, { recursive: true });
  const target = path.join(fixture, 'game/LMARBLES');
  fs.mkdirSync(path.dirname(target));
  fs.cpSync(client, target, { recursive: true, errorOnExist: true, force: false });
  verifyRows(inventory(target), 86, 3800414,
    'aa2cbae11ba5b5a57010643b886552b3ee955e441f76976a3a7593018816d93b');
  fs.writeFileSync(path.join(fixture, '.wine-assembly-browser.json'),
    JSON.stringify({ schemaVersion: 1, files: expected }, null, 2) + '\n', { flag: 'wx' });
}
const manifest = JSON.parse(fs.readFileSync(path.join(fixture, '.wine-assembly-browser.json')));
assert.strictEqual(manifest.schemaVersion, 1);
const sorted = files => [...files].sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
assert.deepStrictEqual(sorted(manifest.files), sorted(expected), 'all 85 exact companion mappings required');
console.log('LMarbles: 86 original client files, authentic CRT and 85 exact companion mappings verified');
