#!/usr/bin/env node
'use strict';

// Pure filesystem verification: never loads or executes a guest module.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const fixture = path.resolve(process.argv[2] || path.join(root, 'test/binaries/candidates/supertux-013'));
const crt = path.resolve(process.argv[3] || path.join(root, 'test/binaries/dlls/msvcrt.dll'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const game = path.join(fixture, 'game');
const rows = [];
function walk(dir, prefix = '') {
  assert(fs.lstatSync(dir).isDirectory(), `not a real directory: ${dir}`);
  for (const name of fs.readdirSync(dir)) {
    const filename = path.join(dir, name);
    const relative = prefix + name;
    const stat = fs.lstatSync(filename);
    assert(!stat.isSymbolicLink(), `symlink: ${relative}`);
    if (stat.isDirectory()) walk(filename, relative + '/');
    else {
      assert(stat.isFile(), `not a regular file: ${relative}`);
      rows.push({ path: relative, bytes: stat.size, sha256: hash(fs.readFileSync(filename)) });
    }
  }
}
walk(game);
rows.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
assert.strictEqual(rows.length, 787);
assert.strictEqual(rows.reduce((sum, row) => sum + row.bytes, 0), 16107101);
// SHA256 of compact JSON [{path,bytes,sha256},...] sorted by codepoint path.
// Derived from the independently retained original extraction inventory.
assert.strictEqual(hash(JSON.stringify(rows)),
  'daf35a7fdb3e2c172d0b38ad04c7921cdd5c92066e3dc912d3899d7fd83c4fc2',
  'original payload inventory changed');
assert(fs.lstatSync(crt).isFile(), 'CRT must be a regular file');
assert.strictEqual(hash(fs.readFileSync(crt)),
  '887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1',
  'authentic corpus MSVCRT required');
const manifest = JSON.parse(fs.readFileSync(path.join(fixture, '.wine-assembly-browser.json')));
assert.strictEqual(manifest.schemaVersion, 1);
const files = [...manifest.files].sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
assert.deepStrictEqual(files, rows.filter(row => row.path !== 'supertux.exe').map(row => ({
  url: 'game/' + row.path,
  vfsPath: 'c:\\' + row.path.replace(/\//g, '\\'),
  size: row.bytes,
})), 'manifest must mount all 786 companion files at their original relative paths');
console.log('SuperTux 0.1.3: all 787 originals, authentic CRT, and 786 manifest mappings verified');
