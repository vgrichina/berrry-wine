#!/usr/bin/env node
'use strict';
// The original InstallShield stub wraps each file in a separate ZIP archive.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: extract-jedi-knight-demo.js jedidemo.exe NEW_OUTPUT');
const b = fs.readFileSync(input);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (hash(b) !== '8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e') throw new Error('Unknown original package');
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const files = [], names = new Set();
let p = 0;
while ((p = b.indexOf(Buffer.from([80, 75, 3, 4]), p)) >= 0) {
  const flags = b.readUInt16LE(p + 6), method = b.readUInt16LE(p + 8);
  const size = b.readUInt32LE(p + 18), expectedSize = b.readUInt32LE(p + 22);
  const n = b.readUInt16LE(p + 26), extra = b.readUInt16LE(p + 28);
  const name = b.subarray(p + 30, p + 30 + n).toString('utf8');
  const start = p + 30 + n + extra, end = start + size;
  if (flags !== 2 || method !== 8 || end > b.length || !/^[\w .-]+$/.test(name) || name === '.' || name === '..' || names.has(name.toLowerCase())) throw new Error('Invalid record: ' + name);
  const bytes = zlib.inflateRawSync(b.subarray(start, end), { maxOutputLength: 64 * 1024 * 1024 });
  if (bytes.length !== expectedSize || crc32(bytes) !== b.readUInt32LE(p + 14)) throw new Error('ZIP integrity failure: ' + name);
  names.add(name.toLowerCase());
  files.push({ name, bytes, sha256: hash(bytes), offset: p });
  p = end;
}
if (files.length !== 39) throw new Error('Expected all 39 original records');
fs.mkdirSync(output); // Refuse existing output; never overwrite a fixture.
for (const f of files) fs.writeFileSync(path.join(output, f.name), f.bytes, { flag: 'wx' });
const inventory = files.map(({ name, bytes, sha256, offset }) => ({ name, size: bytes.length, sha256, offset }));
fs.writeFileSync(output + '.inventory.json', JSON.stringify({ sourceSha256: hash(b), files: inventory }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ files: files.length, bytes: files.reduce((n, f) => n + f.bytes.length, 0), output }));
