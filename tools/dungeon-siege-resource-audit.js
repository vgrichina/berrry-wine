'use strict';
// Static original-file check only; never executes guest code or WASM.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = process.argv[2] || '/tmp/wa-recovery-20261014';
const dir = path.join(root, 'test/binaries/win98-games-a-d/DungeonSiege demo-D3D/extracted');
const { readPE } = require(path.join(root, 'lib/pe'));
const exe = readPE(path.join(dir, 'DungeonSiegeDemo.exe'));
assert.equal(crypto.createHash('sha256').update(exe.buf).digest('hex'),
  '8df1ba314073f8e9e7b48c7ed0fd3a976b1dafb722bffcb41f613a4c60a421ab');
const bytes = fs.readFileSync(path.join(dir, 'Demo.ds'));
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(sha256, 'fdb7396ac9823e70d104147b145e2725640a9795bb3b2f5d2f5de55c12bd6505');
assert.equal(bytes.subarray(0, 8).toString(), 'DSigTank');
const offset = bytes.readUInt32LE(0x0c), length = bytes.readUInt32LE(0x14);
const expected = bytes.readUInt32LE(0x50);
assert.equal(offset + length, bytes.length);
// Original routine0041317f starts with ~seed and uses its original table006f6468.
const table = exe.va2off(0x006f6468);
assert(table >= 0 && table + 1024 <= exe.buf.length);
let crc = 0xffffffff;
for (let i = offset; i < offset + length; i++) {
  crc = (exe.buf.readUInt32LE(table + 4 * ((crc ^ bytes[i]) & 255)) ^ (crc >>> 8)) >>> 0;
}
crc = (~crc) >>> 0;
assert.equal(crc, expected, 'Original directory-region CRC must match its header');
console.log(JSON.stringify({ sourceOnly: true, guestExecuted: false, fileBytes: bytes.length, sha256,
  offset, length, end: offset + length, expectedCrc: expected.toString(16), computedCrc: crc.toString(16),
  originalCrcRoutine: '0x0041317f', originalTable: '0x006f6468',
  compareSite: '0x00628d6a', error23Call: '0x00628d70', callerReturn: '0x00628d76',
  limit: 'Validates original region only; captured guest buffer and computed guest CRC are not available.' }, null, 2));
