// Compact synthetic ISO fixtures: no external image tools or committed binary.
const assert = require('assert');
const Iso = require('../lib/iso9660');

const DESC_SECTOR = 2048;

function putBoth16(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = value >>> 8;
  bytes[offset + 2] = value >>> 8;
  bytes[offset + 3] = value & 0xff;
}

function putBoth32(bytes, offset, value) {
  for (let i = 0; i < 4; i++) bytes[offset + i] = (value >>> (8 * i)) & 0xff;
  for (let i = 0; i < 4; i++) bytes[offset + 4 + i] = (value >>> (8 * (3 - i))) & 0xff;
}

function record({ lba, size, nameBytes = [0], flags = 2, extAttr = 0 }) {
  const length = 33 + nameBytes.length + (nameBytes.length % 2 === 0 ? 1 : 0);
  const r = new Uint8Array(length);
  r[0] = length;
  r[1] = extAttr;
  putBoth32(r, 2, lba);
  putBoth32(r, 10, size);
  r[25] = flags;
  putBoth16(r, 28, 1);
  r[32] = nameBytes.length;
  r.set(nameBytes, 33);
  return r;
}

function fixture({ blockSize = 1024, volumeBlocks = 40, rootLba = 35,
                   rootExtAttr = 1, rootSize = 1024, child = true } = {}) {
  const bytes = new Uint8Array(volumeBlocks * blockSize);
  const pvd = bytes.subarray(16 * DESC_SECTOR, 17 * DESC_SECTOR);
  pvd[0] = 1;
  pvd.set([0x43, 0x44, 0x30, 0x30, 0x31], 1);
  pvd[6] = 1;
  putBoth32(pvd, 80, volumeBlocks);
  putBoth16(pvd, 128, blockSize);
  pvd.set(record({ lba: rootLba, size: rootSize, extAttr: rootExtAttr }), 156);
  const terminator = bytes.subarray(17 * DESC_SECTOR, 18 * DESC_SECTOR);
  terminator.set([255, 0x43, 0x44, 0x30, 0x30, 0x31, 1]);

  const rootOffset = (rootLba + rootExtAttr) * blockSize;
  if (rootOffset + rootSize > bytes.length) return bytes;
  const root = bytes.subarray(rootOffset, rootOffset + rootSize);
  root.set(record({ lba: rootLba + rootExtAttr, size: rootSize }));
  if (child) {
    const childRecord = record({
      lba: 37,
      extAttr: 1,
      size: 2,
      nameBytes: Array.from(Buffer.from('FILE.BIN;1')),
      flags: 0,
    });
    root.set(childRecord, 34);
    bytes.set([0xaa, 0xbb], 38 * blockSize);
  }
  return bytes;
}

assert.throws(() => Iso.parseIso(fixture({ rootLba: 39, rootSize: 0xffff, child: false })),
  /root directory extent|declared volume/,
  'root extent beyond the declared volume/image is rejected before walking');

const valid = Iso.parseIso(fixture());
assert.strictEqual(valid.blockSize, 1024, 'nonstandard logical block size remains supported');
assert.strictEqual(valid.files[0].offset, 38 * 1024,
  'extended-attribute block is skipped when deriving file data offset');
assert.deepStrictEqual(Array.from(Iso.readEntry(valid, valid.files[0])), [0xaa, 0xbb]);
const standard = Iso.parseIso(fixture({ blockSize: 2048, rootSize: 2048 }));
assert.deepStrictEqual(Array.from(Iso.readEntry(standard, standard.files[0])), [0xaa, 0xbb]);

const oversizedVolume = fixture();
putBoth32(oversizedVolume, 16 * DESC_SECTOR + 80, 41);
assert.throws(() => Iso.parseIso(oversizedVolume), /declared volume extends past/);

const partialDirectory = fixture({ rootSize: 100 });
const reads = [];
Iso.parseIso({ size: partialDirectory.length, readRange(offset, length) {
  reads.push([offset, length]);
  return partialDirectory.subarray(offset, offset + length);
} });
assert.deepStrictEqual(reads[reads.length - 1], [36 * 1024, 100],
  'a partial final directory block does not read beyond its declared extent');

const crossingRecord = fixture({ rootSize: 40, child: false });
crossingRecord[36 * 1024 + 34] = 34;
assert.throws(() => Iso.parseIso(crossingRecord), /crosses a block or extent boundary/);

const shortReader = {
  size: 40 * 1024,
  readRange(offset, length) {
    const backing = fixture();
    return backing.subarray(offset, Math.max(offset, offset + length - 1));
  },
};
assert.throws(() => Iso.parseIso(shortReader), /short read/,
  'provider short reads are never parsed as complete structures');

const malformedLength = fixture({ child: false });
const malformedRootOffset = 36 * 1024;
malformedLength[malformedRootOffset] = 33;
assert.throws(() => Iso.parseIso(malformedLength), /malformed directory record length/,
  'directory record shorter than its fixed fields is rejected');

const badIdentifier = fixture({ child: false });
const descriptorRootIdLength = 16 * DESC_SECTOR + 156 + 32;
badIdentifier[descriptorRootIdLength] = 2;
assert.throws(() => Iso.parseIso(badIdentifier), /identifier exceeds its record/,
  'identifier length cannot read beyond the declared record');

const crossesBlock = fixture({ child: false });
const crossRootOffset = 36 * 1024;
for (let i = 0; i < 28; i++) {
  crossesBlock.set(record({ lba: 0, size: 0, nameBytes: [65], flags: 4 }),
    crossRootOffset + 34 + i * 34);
}
crossesBlock[crossRootOffset + 34 + 28 * 34] = 40;
assert.throws(() => Iso.parseIso(crossesBlock), /crosses a block or extent boundary/,
  'record bytes cannot run across a logical block boundary');

const outOfBoundsChild = fixture();
const childRecordOffset = 36 * 1024 + 34;
putBoth32(outOfBoundsChild, childRecordOffset + 2, 39);
putBoth32(outOfBoundsChild, childRecordOffset + 10, 2048);
assert.throws(() => Iso.parseIso(outOfBoundsChild), /entry "FILE.BIN" extent/,
  'child extents are validated before they are mounted');

console.log('ISO extent and record boundary cases passed');
