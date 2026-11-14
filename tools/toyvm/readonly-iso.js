'use strict';

// Data-volume adapter only: no MSCDEX device, CDDA or installer emulation.
// Sources are bytes or synchronous ISO byte providers (including an fd-backed
// readRange supplied by a caller). No image-sized copy or host extraction.
const Iso = require('../../lib/iso9660');
const Cd = require('../../lib/cdrom');

function checkedProvider(source) {
  const provider = Iso.toProvider(source);
  if (!Number.isSafeInteger(provider.size) || provider.size <= 0) throw Error('invalid ISO provider size');
  return {
    size: provider.size,
    readRange(offset, length) {
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 ||
          !Number.isSafeInteger(offset + length) || offset + length > provider.size) throw Error('ISO read outside image');
      const bytes = provider.readRange(offset, length);
      if (!(bytes instanceof Uint8Array) || bytes.length !== length) throw Error('short or asynchronous ISO provider read');
      return bytes;
    },
  };
}

function dataSource(source, opts) {
  const provider = checkedProvider(source);
  if (opts.format === 'iso') {
    if (opts.cue !== undefined || opts.file !== undefined) throw Error('plain ISO does not accept CUE track options');
    if (provider.size % 2048) throw Error('plain ISO size must be a multiple of 2048');
    // Preserve provider identity for the runner/MSCDEX handoff; byte sources
    // still need the validated provider interface for downstream sector reads.
    return { provider, media: { format: 'iso',
      source: typeof source.readRange === 'function' ? source : provider, cdromMedia: opts.cdromMedia } };
  }
  if (opts.format !== 'mode1/2352') throw Error('explicit format required: iso or mode1/2352');
  if (typeof opts.cue !== 'string' || !opts.cue || typeof opts.file !== 'string') {
    throw Error('raw MODE1/2352 requires the original CUE and its data FILE name');
  }
  const cue = Cd.parseCue(opts.cue), tracks = cue.tracks.filter(t => !t.isAudio);
  if (tracks.length !== 1 || tracks[0].type !== 'MODE1/2352' || tracks[0].file !== opts.file ||
      cue.files[tracks[0].fileIndex].type !== 'BINARY') throw Error('CUE must identify one MODE1/2352 data track in the supplied FILE');
  const track = tracks[0], range = Cd.trackFileRange(cue, track, provider.size);
  // lib/cdrom.mode1Provider is asynchronous; DOS file services are synchronous.
  // Reuse its CUE parser/range calculation, adapting only payload reads here.
  const cooked = {
    size: range.sectors * 2048,
    readRange(offset, length) {
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 ||
          offset + length > this.size) throw Error('MODE1 read outside data track');
      const out = new Uint8Array(length);
      for (let written = 0; written < length;) {
        const at = offset + written, sector = Math.floor(at / 2048), within = at % 2048;
        const stored = provider.readRange(range.byteOffset + sector * 2352, 2352);
        if (stored[0] !== 0 || stored[11] !== 0 || stored[15] !== 1 ||
            stored.subarray(1, 11).some(b => b !== 255)) throw Error('invalid raw MODE1/2352 sector header');
        const take = Math.min(length - written, 2048 - within);
        out.set(stored.subarray(16 + within, 16 + within + take), written);
        written += take;
      }
      return out;
    },
  };
  // Retain original backing data, CUE text and all audio-track descriptors.
  // Other CUE FILEs remain references, never silently dropped or opened here.
  return { provider: cooked, media: { format: opts.format, source: provider, cueText: opts.cue, cue, track, range } };
}

function readReadonlyIso(source, opts = {}) {
  const { provider, media } = dataSource(source, opts);
  let parsedEnd = 0;
  const iso = Iso.parseIso({ size: provider.size, readRange(offset, length) {
    parsedEnd = Math.max(parsedEnd, offset + length);
    return provider.readRange(offset, length);
  } }, { prefer: 'primary' });
  const bytes = iso.volumeSpaceSize * iso.blockSize;
  if (!Number.isSafeInteger(bytes) || !bytes || bytes > provider.size || parsedEnd > bytes ||
      iso.blockSize < 512 || iso.blockSize > 32768 || (iso.blockSize & (iso.blockSize - 1))) {
    throw Error('invalid or truncated ISO volume bounds');
  }
  const entries = new Map(), directories = new Set(['']), directoryMetadata = new Map();
  for (const entry of iso.files) {
    const parts = entry.path.split('\\');
    // DOS has no long-name service here. Refuse names that cannot be exposed
    // losslessly by FindFirst rather than invent aliases or truncate collisions.
    for (const name of parts) {
      if (!/^[\x21-\x7e]+$/.test(name) || /["*+,/:;<=>?\[\\\]|]/.test(name) ||
          !/^[^.]{1,8}(?:\.[^.]{1,3})?$/.test(name)) throw Error(`ISO name is not DOS 8.3: ${entry.path}`);
      if (/^(?:EMMXXXX0|NUL|CON|AUX|PRN|CLOCK\$)$/i.test(name)) throw Error(`ISO name collides with DOS device: ${entry.path}`);
    }
    const key = parts.join('/').toLowerCase();
    if (entries.has(key) || directories.has(key)) throw Error(`DOS ISO name collision: ${key}`);
    if (!Number.isSafeInteger(entry.offset + entry.length) || entry.offset < 0 || entry.offset + entry.length > bytes) {
      throw Error(`ISO entry outside volume bounds: ${entry.path}`);
    }
    // The shared parser does not expose per-record timestamps. Zero denotes
    // unavailable metadata; do not fabricate a file date from the volume date.
    const metadata = { attributes: 1 | (entry.hidden ? 2 : 0) | (entry.isDirectory ? 0x10 : 0x20), time: 0, date: 0 };
    if (entry.isDirectory) {
      directories.add(key); directoryMetadata.set(key, metadata);
    } else {
      // A Node Buffer's slice aliases its backing bytes, unlike Uint8Array's.
      // Copy explicitly even when the shared parser returns a Buffer slice.
      entries.set(key, { ...metadata, size: entry.length, read: () => Uint8Array.from(Iso.readEntry(iso, entry)) });
    }
  }
  // No guessed directories when the parser stopped a repeated/cyclic extent.
  for (const key of [...directories, ...entries.keys()]) {
    if (key.includes('/') && !directories.has(key.slice(0, key.lastIndexOf('/')))) throw Error('missing ISO parent directory');
  }
  let spc = 1;
  while (Math.ceil(iso.volumeSpaceSize / spc) > 0xffff) spc *= 2;
  if (spc > 0x8000) throw Error('ISO volume too large for DOS free-space fields');
  return { kind: 'iso9660', label: iso.volumeLabel, entries, directories, directoryMetadata,
    bps: iso.blockSize, spc, clusters: Math.ceil(iso.volumeSpaceSize / spc), freeClusters: 0, media };
}

module.exports = { readReadonlyIso };
