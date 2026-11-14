'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Cd = require('../lib/cdrom');
const { createCdromMedia: create, openCdromMedia: open } = require('../tools/toyvm/cdrom-media');
const cue = 'FILE "tiny.bin" BINARY\nTRACK 01 MODE1/2352\nINDEX 01 00:00:00\n' +
  'TRACK 02 AUDIO\nINDEX 00 00:00:03\nINDEX 01 00:00:04\nTRACK 03 AUDIO\nINDEX 01 00:00:06\n';
function fixture() {
  const bytes = Buffer.alloc(8 * 2352);
  for (let s = 0; s < 8; s++) {
    for (let i = 0; i < 2352; i++) bytes[s * 2352 + i] = (s * 31 + i * 7) & 255;
    if (s < 3) {
      const start = s * 2352;
      bytes.fill(255, start + 1, start + 11);
      bytes[start] = bytes[start + 11] = 0;
      bytes[start + 15] = 1;
    }
  }
  return bytes;
}

test('logical payloads match actual bytes and canonical async MODE1 reader', async () => {
  const bytes = fixture(), disc = create(cue, bytes), data = disc.dataTrack(1);
  const expected = Buffer.concat([0, 1, 2].map(s => bytes.subarray(s * 2352 + 16, s * 2352 + 2064)));
  assert.equal(data.size, 3 * 2048);
  assert.deepEqual(Buffer.from(data.readRange(0, data.size)), expected);
  for (const [offset, length] of [[2040, 30], [1, 4097], [data.size, 0], [0, 1]]) {
    assert.deepEqual(Buffer.from(data.readRange(offset, length)), expected.subarray(offset, offset + length));
    const canonical = Cd.mode1Provider({ size: bytes.length, readRange: (o, n) => bytes.subarray(o, o + n) }, { sectors: 3 });
    assert.deepEqual(data.readRange(offset, length), await canonical.readRange(offset, length));
  }
  assert.deepEqual(data.readSector(2), Uint8Array.from(expected.subarray(4096)));
});

test('raw ranges cross data/pregap/audio tracks without byte swaps or dropped bytes', () => {
  const bytes = fixture(), disc = create(cue, bytes);
  assert.deepEqual(disc.readRange(0, disc.size), Uint8Array.from(bytes));
  for (const at of [3 * 2352 - 13, 4 * 2352 - 5, 6 * 2352 - 17]) {
    assert.deepEqual(disc.readRange(at, 33), Uint8Array.from(bytes.subarray(at, at + 33)));
  }
  assert.deepEqual(disc.readSector(4), Uint8Array.from(bytes.subarray(4 * 2352, 5 * 2352)));
  assert.deepEqual(disc.sectorInfo(3), { track: 2, index: 0, relativeSector: -1, type: 'AUDIO' });
  assert.deepEqual(disc.sectorInfo(4), { track: 2, index: 1, relativeSector: 0, type: 'AUDIO' });
  assert.equal(disc.tracks[0].index00, null);
  assert.equal(disc.tracks[1].index00, 3);
  assert.equal(disc.tracks[1].pregapSectors, 1);
  assert.equal(disc.tracks[0].endSector, 3);
  assert.equal(disc.tracks[1].endSector, 6);
  assert.throws(() => disc.dataTrack(2), /data track/);
});

test('first-track stored INDEX00 is kept and data starts at INDEX01', () => {
  const bytes = fixture(), text = 'FILE "x" BINARY\nTRACK 01 MODE1/2352\nINDEX 00 00:00:00\nINDEX 01 00:00:01';
  const disc = create(text, bytes);
  assert.equal(disc.sectorInfo(0).index, 0);
  assert.deepEqual(disc.dataTrack(1).readSector(0), Uint8Array.from(bytes.subarray(2352 + 16, 2352 + 2064)));
});

test('exact original contract TOC requires no original media or large fixture', () => {
  const times = ['00:00:00', '09:52:17', '15:34:49', '22:26:56', '28:59:12', '35:39:20', '42:15:13', '49:12:64', '54:27:49'];
  const starts = [0, 104468784, 164872848, 237566112, 306787824, 377366640, 447204576, 520883328, 576414048];
  const text = 'FILE "CDWORMS.bin" BINARY\r\n' + times.map((t, i) =>
    `  TRACK 0${i + 1} ${i ? 'AUDIO' : 'MODE1/2352'}\r\n    INDEX 01 ${t}\r\n`).join('');
  const disc = create(text, { size: 578432064, readRange() { throw Error('metadata only: no media'); } });
  assert.equal(disc.sectorCount, 245932);
  assert.equal(disc.tracks.filter(t => t.isAudio).length, 8);
  assert.deepEqual(disc.tracks.map(t => t.rawOffset), starts);
  assert.deepEqual(disc.tracks.map(t => t.rawEndExclusive), starts.slice(1).concat(578432064));
  assert.equal(disc.dataTrack(1).size, 44417 * 2048);
  assert.equal(disc.sectorInfo(44417).track, 2);
});

test('strict CUE rejects malformed/ambiguous/unsupported layouts', () => {
  const base = 'FILE "x" BINARY\nTRACK 01 MODE1/2352\nINDEX 01 00:00:00';
  const cases = ['', base + '\nGARBAGE', base + '\nINDEX 01 00:00:01', base + '\nINDEX 00 00:00:00',
    base + '\nPREGAP 00:02:00', base + '\nPOSTGAP 00:02:00', base + '\nINDEX 02 00:00:01',
    base.replace('BINARY', 'WAVE'), base.replace('MODE1/2352', 'MODE2/2352'), base.replace('MODE1/2352', 'MODE1/2048'),
    base.replace('TRACK 01', 'TRACK 02'), base.replace('00:00:00', '00:60:00'), base.replace('00:00:00', '00:00:75'),
    base.replace('00:00:00', '999999999999999:00:00'), base.replace('"x"', '"../x"'),
    base + '\nFILE "y" BINARY\nTRACK 02 AUDIO\nINDEX 01 00:00:00',
    base + '\nTRACK 02 AUDIO\nINDEX 00 00:00:03\nINDEX 01 00:00:02',
    base + '\nTRACK 02 AUDIO\nINDEX 01 00:00:00', base + '\nTRACK 02 AUDIO',
    base.replace('00:00:00', '00:00:01'), base + '\nTRACK 02 AUDIO\nINDEX 01 00:00:08'];
  for (const text of cases) assert.throws(() => create(text, fixture()), undefined, text);
});

test('integer/range/short-read errors fail explicitly', () => {
  const disc = create(cue, fixture()), data = disc.dataTrack(1);
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, '1']) {
    assert.throws(() => disc.readSector(value));
    assert.throws(() => disc.sectorInfo(value));
    assert.throws(() => data.readSector(value));
    assert.throws(() => disc.readRange(value, 1));
    assert.throws(() => data.readRange(0, value));
  }
  assert.throws(() => disc.readSector(8));
  assert.throws(() => data.readSector(3));
  assert.throws(() => data.readRange(data.size - 1, 2));
  assert.throws(() => disc.readRange(disc.size, 1));
  assert.equal(disc.readRange(disc.size, 0).length, 0);
  for (const size of [0, 2351, 2353, NaN, Infinity]) assert.throws(() => create(cue, { size, readRange() {} }));
  for (const result of [new Uint8Array(1), Promise.resolve(new Uint8Array(2352)), []]) {
    const bad = create(cue, { size: 8 * 2352, readRange: () => result });
    assert.throws(() => bad.readSector(0), /short or asynchronous/);
    assert.throws(() => bad.dataTrack(1).readSector(0), /short or asynchronous/);
  }
});

test('raw reads preserve malformed headers while logical reads reject them', () => {
  for (const offset of [0, 1, 11, 15]) {
    const bytes = fixture(); bytes[2352 + offset] ^= 3;
    const disc = create(cue, bytes);
    assert.deepEqual(disc.readSector(1), Uint8Array.from(bytes.subarray(2352, 4704)));
    assert.throws(() => disc.dataTrack(1).readRange(2040, 20), /sync or mode/);
  }
});

test('read-only file provider detects truncation, closes and never aliases backing bytes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdrom-media-'));
  const file = path.join(dir, 'tiny.bin'), bytes = fixture();
  try {
    fs.writeFileSync(file, bytes);
    const disc = open(cue, file);
    try {
      disc.readSector(0).fill(0); disc.dataTrack(1).readSector(0).fill(0);
      assert.deepEqual(fs.readFileSync(file), bytes);
      assert.equal(disc.writeSector, undefined);
      assert(Object.isFrozen(disc)); assert(Object.isFrozen(disc.tracks[1]));
      fs.truncateSync(file, 2352);
      assert.throws(() => disc.readSector(1), /short/);
    } finally { disc.close(); disc.close(); }
    assert.throws(() => disc.readSector(0), /closed/);
    assert.throws(() => open('BAD CUE', file), /CUE/);
    const memory = create(cue, bytes);
    memory.readSector(0).fill(0); memory.dataTrack(1).readSector(0).fill(0);
    assert.deepEqual(bytes, fixture());
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
