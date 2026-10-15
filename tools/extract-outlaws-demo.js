#!/usr/bin/env node
'use strict';
// JavaScript validation/inventory around the existing 7z ZIP reader; no guest execution.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const crypto = require('crypto'), assert = require('assert/strict');
assert.equal(process.argv.length, 4, 'Usage: extract-outlaws-demo.js PACKAGE NEW_DIRECTORY');
const packagePath = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const packageSha256 = sha(fs.readFileSync(packagePath));
assert.equal(packageSha256, '501f37aa475b6c27c87ce04e30b5207f91b81603cb376aaa9ffde1647a40e7b3');
assert(!fs.existsSync(out), 'output must be new');
assert(!fs.existsSync(out + '-inventory.json'), 'inventory must be new');
const deadline = Date.now() + 60000;
function seven(args) {
  assert(Date.now() < deadline, '60 second extraction deadline');
  return cp.execFileSync('7z', args, {timeout: deadline - Date.now(), encoding: 'utf8', maxBuffer: 4*1024*1024});
}
const listing = seven(['l', '-slt', packagePath]);
assert(listing.includes('Type = zip\n'), 'expected ZIP');
const body = listing.split('----------\n');
assert.equal(body.length, 2, 'member-list delimiter');
const members = body[1].trim().split(/\n\s*\n/).map(block => Object.fromEntries(block.split('\n').map(line => {
  const i = line.indexOf(' = '); assert(i > 0); return [line.slice(0, i), line.slice(i+3)];
})));
const names = new Set();
let expandedBytes = 0;
for (const m of members) {
  const name = m.Path;
  assert(name && !path.isAbsolute(name) && !/[\\:\r\n]/.test(name));
  assert(!name.split('/').some(p => !p || p === '.' || p === '..'));
  assert(!names.has(name), 'duplicate exact name'); names.add(name);
  assert.equal(m.Folder, '-'); assert.equal(m.Encrypted, '-');
  assert(!m['Symbolic Link'] && !m['Hard Link']);
  assert(/(?:^| )-[rwx-]{9}$/.test(m.Attributes), 'regular member required');
  assert(/^\d+$/.test(m.Size) && Number.isSafeInteger(+m.Size));
  assert(/^[0-9A-F]{8}$/.test(m.CRC));
  expandedBytes += +m.Size;
}
assert.equal(members.length, 31);
assert(expandedBytes <= 256*1024*1024);
seven(['t', packagePath]); // Validate archive CRCs before writing anything.
fs.mkdirSync(out);
seven(['x', '-y', '-ssc', '-o' + out, packagePath]);
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; ++i) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
const hex = n => '0x' + n.toString(16);
const files = members.map(m => {
  const target = path.join(out, m.Path);
  assert(fs.lstatSync(target).isFile(), 'extracted regular file required');
  const b = fs.readFileSync(target);
  assert.equal(b.length, +m.Size);
  const crc = crc32(b); assert.equal(crc, m.CRC.toLowerCase());
  const r = {path: m.Path, size: b.length, sha256: sha(b), crc32: crc};
  if (b.length >= 64 && b.toString('ascii', 0, 2) === 'MZ') {
    const off = b.readUInt32LE(60);
    if (off+56 <= b.length && b.subarray(off, off+4).equals(Buffer.from('PE\0\0'))) {
      r.pe = {machine: hex(b.readUInt16LE(off+4)), sections: b.readUInt16LE(off+6), timestamp: b.readUInt32LE(off+8), characteristics: hex(b.readUInt16LE(off+22)), magic: hex(b.readUInt16LE(off+24)), entryRva: hex(b.readUInt32LE(off+40)), imageBase: hex(b.readUInt32LE(off+52))};
    } else r.nonPeMzSignature = b.subarray(off, off+2).toString('hex');
  }
  assert(Date.now() < deadline, '60 second extraction deadline');
  return r;
});
assert.deepEqual(fs.readdirSync(out).sort(), [...names].sort(), 'complete flat payload');
const result = {packageSha256, fileCount: files.length, expandedBytes, files};
fs.writeFileSync(out + '-inventory.json', JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
