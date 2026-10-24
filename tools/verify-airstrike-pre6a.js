#!/usr/bin/env node
'use strict';

// Filesystem only: no acquisition, guest execution or replacement DLLs.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pins = require('../test/candidate-corpus/airstrike-pre6a-files.json').files;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sorted = rows => [...rows].sort((a, b) => a.url.localeCompare(b.url));

function regular(root, relative) {
  let current = root;
  assert(fs.lstatSync(current).isDirectory(), `not a directory: ${current}`);
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    assert(!fs.lstatSync(current).isSymbolicLink(), `symlink: ${current}`);
  }
  assert(fs.lstatSync(current).isFile(), `not a regular file: ${current}`);
  return current;
}
function check(file, pin) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.length, pin.bytes, `size: ${pin.path}`);
  assert.equal(hash(bytes), pin.sha256, `identity: ${pin.path}`);
}
function mappings() {
  return sorted(pins.filter(p => p.path !== 'airstrike-pre6a.exe').map(p => ({
    url: 'game/' + p.path,
    vfsPath: 'c:\\' + p.path.replace(/\//g, '\\'),
    size: p.bytes,
  })));
}
function verify(fixture) {
  const game = path.join(fixture, 'game');
  const names = [];
  function walk(dir, prefix = '') {
    assert(!fs.lstatSync(dir).isSymbolicLink(), `symlink: ${dir}`);
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name), relative = prefix + name;
      const stat = fs.lstatSync(file);
      assert(!stat.isSymbolicLink(), `symlink: ${relative}`);
      if (stat.isDirectory()) walk(file, relative + '/');
      else { assert(stat.isFile()); names.push(relative); }
    }
  }
  walk(game);
  assert.deepEqual(names.sort(), pins.map(p => p.path).sort(), 'exact game closure');
  for (const pin of pins) check(regular(game, pin.path), pin);
  const manifest = JSON.parse(fs.readFileSync(path.join(fixture, '.wine-assembly-browser.json')));
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(sorted(manifest.files), mappings(), 'exact companion mappings');
  return { files: pins.length, bytes: pins.reduce((n, p) => n + p.bytes, 0), companions: manifest.files.length };
}
function prepare(original, zlib, crt, fixture) {
  const sources = pins.map(pin => {
    const file = pin.source === 'original' ? regular(original, pin.path) :
      regular(path.dirname(pin.source === 'zlib' ? zlib : crt), path.basename(pin.source === 'zlib' ? zlib : crt));
    check(file, pin);
    return file;
  });
  assert(!fs.existsSync(fixture), 'prepare requires a fresh destination');
  const disk = fs.statfsSync(path.dirname(fixture));
  const size = pins.reduce((n, p) => n + p.bytes, 0);
  assert(disk.bavail * disk.bsize - size >= 2982150144, 'preparation host-free floor');
  fs.mkdirSync(fixture); // Exclusive ownership begins only after successful mkdir.
  try {
    for (let i = 0; i < pins.length; i++) {
      const target = path.join(fixture, 'game', pins[i].path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(sources[i], target, fs.constants.COPYFILE_EXCL);
    }
    fs.writeFileSync(path.join(fixture, '.wine-assembly-browser.json'),
      JSON.stringify({ schemaVersion: 1, files: mappings() }, null, 2) + '\n', { flag: 'wx' });
    return verify(fixture);
  } catch (error) {
    fs.rmSync(fixture, { recursive: true, force: true });
    throw error;
  }
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--prepare' && args.length === 5) {
    console.log(JSON.stringify(prepare(...args.slice(1).map(p => path.resolve(p)))));
  } else if (args.length === 1 && args[0] !== '--prepare') {
    console.log(JSON.stringify(verify(path.resolve(args[0]))));
  } else {
    console.error('usage: node tools/verify-airstrike-pre6a.js --prepare ORIGINAL ZLIB CRT FRESH_DEST\n       node tools/verify-airstrike-pre6a.js FIXTURE');
    process.exitCode = 2;
  }
}
module.exports = { prepare, verify };
