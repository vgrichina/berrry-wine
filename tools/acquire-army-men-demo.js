#!/usr/bin/env node
'use strict';
// Remote-only, acquisition-only. Never invoke the original EXE.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const crypto = require('crypto'), assert = require('assert/strict');
const URL = 'https://archive.thedatadungeon.com/army_men_1998/distributions/1998-09-14_microsoft_windows_demo/a.zip';
const PIN = 'dd1faca49d6e5adc0a3db58831039274930b468caa713f1c0fb4fe074754908f';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function parseListing(text) {
  const parts = text.replace(/\r\n/g, '\n').split('----------\n');
  assert.equal(parts.length, 2, '7z member delimiter');
  // PE self-extractors can expose a nested ZIP: the final header describes
  // the actual member list (the first header describes only its wrapper).
  const type = [...parts[0].matchAll(/^Type = (.+)$/gm)].at(-1)?.[1];
  assert(['zip', '7z', 'Cab', 'Nsis'].includes(type), `unsupported archive type ${type}`);
  const members = parts[1].trim().split(/\n\s*\n/).map(block => Object.fromEntries(block.split('\n').map(line => {
    const i = line.indexOf(' = '); assert(i > 0, 'listing field'); return [line.slice(0, i), line.slice(i + 3)];
  })));
  assert(members.length > 0 && members.length <= 5000, 'member count');
  const names = new Set(); let size = 0;
  for (const m of members) {
    assert(m.Path && !path.isAbsolute(m.Path) && !/[\\:\r\n]/.test(m.Path), 'relative safe path');
    assert(!m.Path.split('/').some(p => !p || p === '.' || p === '..'), 'path component');
    const key = m.Path.toLowerCase(); assert(!names.has(key), 'duplicate path'); names.add(key);
    assert(!m['Symbolic Link'] && !m['Hard Link'] && !/\bl[rwx-]{9}/.test(m.Attributes || ''), 'no links');
    assert(m.Encrypted !== '+', 'no encrypted members');
    assert(/^\d+$/.test(m.Size) && Number.isSafeInteger(+m.Size), 'member size');
    size += +m.Size;
  }
  assert(size <= 256 * 1024 * 1024, 'expanded size');
  return {type, members, size};
}
function pe(b) {
  if (b.length < 64 || b.toString('ascii', 0, 2) !== 'MZ') return null;
  const p = b.readUInt32LE(60);
  if (p + 56 > b.length || b.toString('binary', p, p + 4) !== 'PE\0\0') return {mz: true};
  return {machine: b.readUInt16LE(p + 4), timestamp: b.readUInt32LE(p + 8), magic: b.readUInt16LE(p + 24), entryRva: b.readUInt32LE(p + 40), imageBase: b.readUInt32LE(p + 52)};
}
function main() {
  const dir = process.argv[2];
  const resume = process.argv[3] === '--extract-existing';
  assert(dir && path.isAbsolute(dir) && (resume || !fs.existsSync(dir)), 'Supply a new absolute remote directory');
  if (!resume) fs.mkdirSync(dir);
  const receipt = {started: new Date().toISOString(), url: URL, expectedSha256: PIN, execution: 'none', licenceInput: 'none'};
  const save = (name, value) => fs.writeFileSync(path.join(dir, name), value);
  const run = (exe, args, timeout) => cp.execFileSync(exe, args, {cwd: dir, encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024});
  try {
    const space = fs.statfsSync(dir); assert(space.bavail * space.bsize >= 512 * 1024 * 1024, '512 MiB free required');
    if (!resume) receipt.finalUrl = run('curl', ['--fail', '--location', '--connect-timeout', '15', '--max-time', '120', '--max-filesize', '20971520', '--proto', '=https', '--proto-redir', '=https', '--dump-header', 'headers.txt', '--output', 'a.zip', '--write-out', '%{url_effective}', URL], 120000);
    const archive = fs.readFileSync(path.join(dir, 'a.zip'));
    receipt.package = {size: archive.length, sha256: sha(archive)};
    assert.equal(archive.length, 18373265); assert.equal(receipt.package.sha256, PIN);
    const deadline = Date.now() + 60000;
    const seven = args => { assert(Date.now() < deadline, '60s extraction deadline'); return run('7z', args, deadline - Date.now()); };
    function inspect(file, prefix) {
      const raw = seven(['l', '-slt', file]); save(prefix + '-listing.txt', raw);
      const listing = parseListing(raw); save(prefix + '-inventory.json', JSON.stringify(listing, null, 2) + '\n');
      save(prefix + '-crc.txt', seven(['t', file])); return listing;
    }
    const outer = inspect('a.zip', 'outer');
    assert.equal(outer.type, 'zip'); assert.equal(outer.members.length, 1);
    assert.equal(outer.members[0].Path, 'a.exe'); assert.equal(+outer.members[0].Size, 18418688);
    if (!resume) {
      fs.mkdirSync(path.join(dir, 'outer'));
      save('outer-extract.txt', seven(['x', '-y', '-oouter', 'a.zip']));
    }
    const exePath = path.join(dir, 'outer/a.exe'); assert(fs.lstatSync(exePath).isFile());
    const exe = fs.readFileSync(exePath); assert.equal(exe.length, 18418688);
    if (resume) assert.equal(sha(exe), '5b0db6d109d49818ce617cd539451c73273f09a98f8089065b10107790777752');
    receipt.selfExtractor = {size: exe.length, sha256: sha(exe), pe: pe(exe)};
    const inner = inspect('outer/a.exe', 'inner');
    receipt.innerFormat = inner.type;
    fs.mkdirSync(path.join(dir, 'payload'));
    save('inner-extract.txt', seven(['x', '-y', '-opayload', 'outer/a.exe']));
    const files = [];
    function walk(rel) {
      for (const name of fs.readdirSync(path.join(dir, 'payload', rel))) {
        const r = path.posix.join(rel, name), full = path.join(dir, 'payload', r), stat = fs.lstatSync(full);
        assert(!stat.isSymbolicLink(), 'no extracted links');
        if (stat.isDirectory()) walk(r);
        else { assert(stat.isFile(), 'regular payload'); const b = fs.readFileSync(full); files.push({path: r, size: b.length, sha256: sha(b), pe: pe(b)}); }
        assert(Date.now() < deadline, '60s extraction deadline');
      }
    }
    walk('');
    assert(files.length <= 5000); assert(files.reduce((n, f) => n + f.size, 0) <= 256 * 1024 * 1024);
    for (const f of files) { const m = inner.members.find(m => m.Path === f.path); assert(m, 'unlisted output'); assert.equal(+m.Size, f.size); }
    for (const m of inner.members) assert(files.some(f => f.path === m.Path) || fs.lstatSync(path.join(dir, 'payload', m.Path)).isDirectory(), 'missing member');
    save('payload-hashes.json', JSON.stringify(files, null, 2) + '\n');
    receipt.terminal = 'extracted; original readme/licence/version and route review pending';
  } catch (error) {
    receipt.terminal = 'stopped'; receipt.error = error.message; process.exitCode = 1;
  } finally {
    receipt.finished = new Date().toISOString();
    save(resume ? 'receipt-extract-existing.json' : 'receipt.json', JSON.stringify(receipt, null, 2) + '\n');
    process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  }
}
if (require.main === module) main();
module.exports = {parseListing, pe};
