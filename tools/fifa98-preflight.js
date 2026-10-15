#!/usr/bin/env node
'use strict';

// Read-only fixture audit. Never downloads, installs, or launches the demo.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function inspect(root) {
  const manifestPath = path.join(root, '.wine-assembly-browser.json');
  const bytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.schemaVersion, 1);
  const seen = new Set();
  const guest = new Set();
  // The registry loads the executable separately from the payload manifest.
  const entries = [...manifest.files, { url: 'installed/fifa98/FIFARTWC.EXE',
    vfsPath: 'c:\\fifa98\\FIFARTWC.EXE', size: 1436160 }];
  const files = entries.map(entry => {
    assert.match(entry.url, /^installed\/fifa98\//);
    assert(!entry.url.split('/').some(p => p === '..' || p === '.'));
    assert.equal(entry.vfsPath.toLowerCase(), 'c:\\fifa98\\' + entry.url.slice(17).replaceAll('/', '\\').toLowerCase());
    assert(!seen.has(entry.url.toLowerCase()), 'duplicate local path');
    assert(!guest.has(entry.vfsPath.toLowerCase()), 'duplicate guest path');
    seen.add(entry.url.toLowerCase()); guest.add(entry.vfsPath.toLowerCase());
    let current = root;
    for (const part of entry.url.split('/')) {
      current = path.join(current, part);
      assert(!fs.lstatSync(current).isSymbolicLink(), 'symlink in fixture');
    }
    const data = fs.readFileSync(current);
    assert.equal(data.length, entry.size, `size mismatch: ${entry.url}`);
    return { path: entry.url, vfsPath: entry.vfsPath, size: data.length, sha256: sha256(data) };
  }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const actual = [];
  function walk(dir, rel) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      assert(!item.isSymbolicLink(), 'symlink in installed tree');
      const name = `${rel}/${item.name}`;
      if (item.isDirectory()) walk(path.join(dir, item.name), name);
      else { assert(item.isFile()); actual.push(name.toLowerCase()); }
    }
  }
  walk(path.join(root, 'installed/fifa98'), 'installed/fifa98');
  assert.deepEqual(actual.sort(), [...seen].sort(), 'manifest must cover complete tree');
  for (const name of ['FIFARTWC.EXE', 'EACSND.DLL']) {
    const data = fs.readFileSync(path.join(root, 'installed/fifa98', name));
    assert.equal(data.subarray(0, 2).toString(), 'MZ');
    const pe = data.readUInt32LE(0x3c);
    assert.equal(data.readUInt32LE(pe), 0x4550);
    assert.equal(data.readUInt16LE(pe + 4), 0x14c, 'original x86 PE');
    assert.equal(data.readUInt16LE(pe + 24), 0x10b, 'PE32');
  }
  return { schemaVersion: 1, candidateId: 'fifa98-demo', appId: 'fifa98_demo',
    manifestSha256: sha256(bytes), fileCount: files.length,
    totalBytes: files.reduce((sum, entry) => sum + entry.size, 0), files };
}

if (require.main === module) {
  const root = process.argv[2];
  assert(root, 'usage: node tools/fifa98-preflight.js FIXTURE_ROOT [--inventory]');
  assert(process.argv.length <= 4 && (!process.argv[3] || process.argv[3] === '--inventory'));
  const actual = inspect(path.resolve(root));
  if (process.argv[3] === '--inventory') console.log(JSON.stringify(actual, null, 2));
  else {
    const expected = require('../docs/fixtures/fifa98-demo-inventory.json');
    assert.deepEqual(actual, expected, 'original fixture differs from recorded inventory');
    console.log(JSON.stringify({ candidateId: actual.candidateId, fileCount: actual.fileCount,
      totalBytes: actual.totalBytes, manifestSha256: actual.manifestSha256, verified: true }));
  }
}

module.exports = { inspect };
