#!/usr/bin/env node
'use strict';
// Original-byte acquisition only; never executes a Windows program.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const crypto = require('crypto'), assert = require('assert/strict');
const [evidenceRoot, destination] = process.argv.slice(2);
assert(evidenceRoot && destination && path.isAbsolute(destination) && !fs.existsSync(destination), 'new absolute destination required');
const old = path.join(evidenceRoot, 'scratch/runs/20261015-army-men-original-acquisition');
// Optional explicit source manifest supports independent public-source recovery
// on another host without transporting any ignored original binary.
const manifest = JSON.parse(fs.readFileSync(process.argv[4] || path.join(old, 'payload-hashes.json')));
assert.equal(manifest.length, 187);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const free = () => { const s = fs.statfsSync(path.dirname(destination)); return s.bavail * s.bsize; };
const reserve = 2 ** 31 + 128 * 2 ** 20;
const cost = 18373265 + 18418688 + manifest.reduce((n, f) => n + Math.ceil(f.size / 4096) * 4096, 0) + 8 * 2 ** 20;
const initialFree = free();
assert(initialFree - cost > reserve, 'disk admission including archive/extraction/evidence costs');
fs.mkdirSync(destination);
const receipt = {started: new Date().toISOString(), initialFree, cost, reserve, execution: 'none', acceptedInGuest: false};
const save = (name, value) => fs.writeFileSync(path.join(destination, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const run = (command, args) => { assert(free() > reserve, 'fresh disk reserve'); return cp.execFileSync(command, args, {cwd: destination, timeout: 60000, maxBuffer: 4 * 2 ** 20, encoding: 'utf8'}); };
const check = (file, size, hash) => { const bytes = fs.readFileSync(file); assert.equal(bytes.length, size, file); assert.equal(sha(bytes), hash, file); };
try {
  receipt.url = 'https://archive.thedatadungeon.com/army_men_1998/distributions/1998-09-14_microsoft_windows_demo/a.zip';
  receipt.finalUrl = run('curl', ['--fail', '--location', '--connect-timeout', '15', '--max-time', '55', '--max-filesize', '18373265', '--proto', '=https', '--proto-redir', '=https', '--dump-header', 'headers.txt', '--output', 'a.zip', '--write-out', '%{url_effective}', receipt.url]);
  check(path.join(destination, 'a.zip'), 18373265, 'dd1faca49d6e5adc0a3db58831039274930b468caa713f1c0fb4fe074754908f');
  save('outer-crc.txt', run('7z', ['t', '-tzip', 'a.zip']));
  save('outer-extract.txt', run('7z', ['x', '-tzip', '-oouter', 'a.zip']));
  check(path.join(destination, 'outer/a.exe'), 18418688, '5b0db6d109d49818ce617cd539451c73273f09a98f8089065b10107790777752');
  // Explicit embedded ZIP matches the original successful recovery recipe.
  save('inner-listing.txt', run('7z', ['l', '-slt', '-tzip', 'outer/a.exe']));
  save('inner-crc.txt', run('7z', ['t', '-tzip', 'outer/a.exe']));
  save('inner-extract.txt', run('7z', ['x', '-tzip', '-opayload', 'outer/a.exe']));
  const actual = [];
  function walk(dir, rel = '') { for (const name of fs.readdirSync(dir)) { const p = path.join(dir, name), r = path.posix.join(rel, name), s = fs.lstatSync(p); assert(!s.isSymbolicLink()); if (s.isDirectory()) walk(p, r); else { assert(s.isFile()); actual.push(r); } } }
  walk(path.join(destination, 'payload'));
  assert.deepEqual(actual.sort(), manifest.map(f => f.path).sort());
  for (const f of manifest) check(path.join(destination, 'payload', f.path), f.size, f.sha256);
  save('payload-hashes.json', manifest);
  receipt.files = manifest.length;
  receipt.payloadBytes = manifest.reduce((n, f) => n + f.size, 0);
  receipt.status = 'verified originals; normal bootstrap still required';
} catch (e) { receipt.status = 'stopped'; receipt.error = e.message; process.exitCode = 1; }
receipt.finalFree = free();
receipt.finished = new Date().toISOString();
save('recovery.json', receipt);
console.log(JSON.stringify(receipt, null, 2));
