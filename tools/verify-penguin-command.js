#!/usr/bin/env node
'use strict';

// Local filesystem preparation only. Never downloads, runs or patches a game.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { files: pins } = require('../test/candidate-corpus/penguin-command-files.json');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sorted = rows => [...rows].sort((a, b) => a.url.localeCompare(b.url));

function regular(root, relative) {
  let current = root;
  assert(fs.lstatSync(current).isDirectory(), 'source root must be a directory');
  assert(!fs.lstatSync(current).isSymbolicLink(), 'symlink root');
  for (const part of relative.split('/')) {
    assert(part && part !== '.' && part !== '..', 'invalid relative path');
    current = path.join(current, part);
    assert(!fs.lstatSync(current).isSymbolicLink(), `symlink: ${relative}`);
  }
  assert(fs.lstatSync(current).isFile(), `not a regular file: ${relative}`);
  return current;
}
function check(file, pin) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.length, pin.bytes, `size: ${pin.path}`);
  assert.equal(hash(bytes), pin.sha256, `identity: ${pin.path}`);
}
function mappings() {
  return sorted(pins.filter(p => p.path !== 'penguin-command.exe').map(p => ({
    url: 'game/' + p.path, vfsPath: 'c:\\' + p.path.replace(/\//g, '\\'), size: p.bytes,
  })));
}
function verify(fixture) {
  const game = path.join(fixture, 'game'), names = [];
  function walk(dir, prefix = '') {
    assert(!fs.lstatSync(dir).isSymbolicLink(), 'symlink directory');
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
  const manifest = JSON.parse(fs.readFileSync(regular(fixture, '.wine-assembly-browser.json')));
  assert.deepEqual(manifest, { schemaVersion: 1, files: mappings() }, 'exact companion mappings');
  return { files: pins.length, bytes: pins.reduce((n, p) => n + p.bytes, 0), companions: manifest.files.length };
}
function prepare(original, crt, fixture) {
  // Complete source validation precedes even mkdir. A rejected source cannot
  // leave a partially prepared route or change an existing fixture.
  const sources = pins.map(pin => {
    const file = pin.source === 'original' ? regular(original, pin.path) :
      regular(path.dirname(crt), path.basename(crt));
    check(file, pin);
    return file;
  });
  assert(!fs.existsSync(fixture), 'prepare requires a fresh destination');
  const disk = fs.statfsSync(path.dirname(fixture));
  const size = pins.reduce((n, p) => n + p.bytes, 0);
  assert(disk.bavail * disk.bsize - size >= 2982150144, 'preparation host-free floor');
  fs.mkdirSync(fixture);
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
  const args = process.argv.slice(2).map(p => p === '--prepare' ? p : path.resolve(p));
  if (args[0] === '--prepare' && args.length === 4) console.log(JSON.stringify(prepare(...args.slice(1))));
  else if (args.length === 1 && args[0] !== '--prepare') console.log(JSON.stringify(verify(args[0])));
  else {
    console.error('usage: node tools/verify-penguin-command.js --prepare ORIGINAL CRT FRESH_DEST\n       node tools/verify-penguin-command.js FIXTURE');
    process.exitCode = 2;
  }
}
module.exports = { prepare, verify, mappings };
