'use strict';

// Read-only, synchronous sector source. No device, playback or DOS emulation.
// Disc LBAs here are BIN sector offsets (CUE MSF has no 150-sector bias).
// readRange/readSector on the disc return raw bytes, unchanged including audio.
// dataTrack(n) returns an ISO-compatible {size, readRange, readSector} view.
const fs = require('fs');
const Cd = require('../../lib/cdrom');
const Iso = require('../../lib/iso9660');
const RAW = Cd.SECTOR_BYTES, LOGICAL = Cd.COOKED_SECTOR_BYTES;

function bounds(offset, length, size) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 ||
      !Number.isSafeInteger(offset + length) || offset + length > size) {
    throw new RangeError('cdrom-media: read outside bounds');
  }
}

// The shared parser deliberately ignores some CUE directives and overwrites
// duplicate indexes. Reject those before parsing rather than inventing a TOC.
function strictCue(text) {
  if (typeof text !== 'string') throw Error('cdrom-media: CUE text required');
  let indexes = new Set(), previousTrack = 0, lastIndex = -1;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^REM(?:\s|$)/i.test(line)) continue;
    if (/^FILE\s+(?:"[^"\x00-\x1f]+"|[^\s"\x00-\x1f]+)\s+BINARY$/i.test(line)) continue;
    let m = /^TRACK\s+(\d{1,2})\s+(MODE1\/2352|AUDIO)$/i.exec(line);
    if (m) {
      if (Number(m[1]) !== previousTrack + 1) throw Error('cdrom-media: tracks must start at 01 in file order');
      previousTrack++; indexes = new Set(); lastIndex = -1; continue;
    }
    m = /^INDEX\s+(00|01)\s+(\d+:\d{1,2}:\d{1,2})$/i.exec(line);
    if (m) {
      const index = Number(m[1]), sector = Cd.msfToSector(m[2]);
      if (!Number.isSafeInteger(sector) || indexes.has(index) || index <= lastIndex) {
        throw Error('cdrom-media: duplicate, unordered or unsafe INDEX');
      }
      indexes.add(index); lastIndex = index; continue;
    }
    throw Error(`cdrom-media: unsupported or malformed CUE directive: ${line}`);
  }
  const parsed = Cd.parseCue(text);
  if (parsed.files.length !== 1) throw Error('cdrom-media: only one BINARY FILE is supported');
  return parsed;
}

function createCdromMedia(cueText, source) {
  const parsed = strictCue(cueText), backing = Iso.toProvider(source);
  const size = backing.size;
  if (!Number.isSafeInteger(size) || size <= 0 || size % RAW) throw Error('cdrom-media: short or invalid raw sector size');
  const sectorCount = size / RAW;
  const tracks = parsed.tracks.map((track, i) => {
    const index00 = track.indexes.get(0) ?? null, index01 = track.index1Sector;
    const start = index00 ?? index01;
    if (start < 0 || start > index01 || (i === 0 && start !== 0) ||
        (i && start <= parsed.tracks[i - 1].index1Sector)) throw Error('cdrom-media: invalid index bounds/order');
    const range = Cd.trackFileRange(parsed, track, size);
    return Object.freeze({ number: track.number, type: track.type, isAudio: track.isAudio,
      file: track.file, index00, index01, startSector: start,
      endSector: range.endSector, programSectors: range.sectors,
      pregapSectors: index01 - start, rawOffset: start * RAW,
      rawEndExclusive: range.endSector * RAW });
  });
  Object.freeze(tracks);
  function readRange(offset, length) {
    bounds(offset, length, size);
    const bytes = backing.readRange(offset, length);
    if (!(bytes instanceof Uint8Array) || bytes.length !== length) throw Error('cdrom-media: short or asynchronous raw read');
    return Uint8Array.from(bytes); // never expose a writable alias, including Buffer
  }
  function readSector(lba) {
    bounds(lba, 1, sectorCount);
    return readRange(lba * RAW, RAW);
  }
  function sectorInfo(lba) {
    bounds(lba, 1, sectorCount);
    const track = tracks.find(t => lba >= t.startSector && lba < t.endSector);
    return Object.freeze({ track: track.number, index: lba < track.index01 ? 0 : 1,
      relativeSector: lba - track.index01, type: track.type });
  }
  function dataTrack(number) {
    const track = tracks.find(t => t.number === number);
    if (!track || track.isAudio) throw Error('cdrom-media: MODE1 data track required');
    const logicalSize = track.programSectors * LOGICAL;
    function logicalRange(offset, length) {
      bounds(offset, length, logicalSize);
      const out = new Uint8Array(length);
      for (let written = 0; written < length;) {
        const at = offset + written, within = at % LOGICAL;
        const raw = readSector(track.index01 + Math.floor(at / LOGICAL));
        if (raw[0] !== 0 || raw[11] !== 0 || raw[15] !== 1 || raw.subarray(1, 11).some(b => b !== 255)) {
          throw Error('cdrom-media: invalid MODE1/2352 sync or mode');
        }
        // Same payload window as Cd.mode1Provider; that API is async, whereas
        // ISO/DOS callers require synchronous reads. No EDC/ECC claim is made.
        const take = Math.min(length - written, LOGICAL - within);
        out.set(raw.subarray(16 + within, 16 + within + take), written);
        written += take;
      }
      return out;
    }
    return Object.freeze({ size: logicalSize, sectorCount: track.programSectors,
      readRange: logicalRange, readSector(lba) {
        bounds(lba, 1, track.programSectors); return logicalRange(lba * LOGICAL, LOGICAL);
      } });
  }
  return Object.freeze({ size, sectorCount, sectorBytes: RAW, cueText, tracks,
    file: parsed.files[0].name, readRange, readSector, sectorInfo, dataTrack });
}

// Opens only the explicitly supplied BIN path; the CUE never opens host paths.
// Caller owns close(), which is idempotent. No descriptor survives failed setup.
function openCdromMedia(cueText, binPath) {
  const fd = fs.openSync(binPath, 'r');
  let closed = false;
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw Error('cdrom-media: BIN must be a regular file');
    const disc = createCdromMedia(cueText, { size: stat.size, readRange(offset, length) {
      if (closed) throw Error('cdrom-media: closed');
      const bytes = new Uint8Array(length);
      let done = 0;
      while (done < length) {
        const count = fs.readSync(fd, bytes, done, length - done, offset + done);
        if (!count) throw Error('cdrom-media: short raw file read');
        done += count;
      }
      return bytes;
    } });
    return Object.freeze({ ...disc, close() { if (!closed) { closed = true; fs.closeSync(fd); } } });
  } catch (error) { fs.closeSync(fd); throw error; }
}

module.exports = { createCdromMedia, openCdromMedia };
