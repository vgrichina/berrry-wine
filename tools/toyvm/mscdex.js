'use strict';

// Bounded MSCDEX multiplex subset, not a resident CD-ROM device driver.
// Protocol: Microsoft's MS-DOS CD-ROM Extensions 2.10 Function Requests
// Specification (archived verbatim at the URL below), functions 00/05/08/0B/0D.
// https://gist.github.com/abrasive/7a615e6dde0c1da962f9930cc63ee43d
// No version claim, fake device headers, driver dispatch, or audio state.
const { createCdromMedia } = require('./cdrom-media');
const SECTOR = 2048;
const legacyDiscs = new WeakMap();

function discFor(media) {
  if (media.cdromMedia) return media.cdromMedia;
  if (media.format !== 'mode1/2352') return null;
  if (!legacyDiscs.has(media)) legacyDiscs.set(media, createCdromMedia(media.cueText, media.source));
  return legacyDiscs.get(media);
}

function dataView(volume) {
  const media = volume.media, disc = discFor(media);
  if (!disc) {
    if (media.format !== 'iso') throw Error('unsupported MSCDEX medium');
    return { source: media.source, start: 0, end: media.source.size / SECTOR };
  }
  const tracks = disc.tracks.filter(t => !t.isAudio);
  if (tracks.length !== 1) throw Error('ambiguous MSCDEX data track');
  const track = tracks[0];
  // The sector reader exposes BIN-relative addresses, not a synthesized TOC.
  // Only qualify HSG absolute reads when track 1 INDEX 01 is at BIN sector 0.
  // Nonzero/multisession origins need a separately established disc mapping.
  return { source: disc.dataTrack(track.number), start: track.index01,
    end: track.endSector, absolute: track.number === 1 && track.index01 === 0 };
}

function destination(m, r, length) {
  const ex = m.vmExports;
  // MSCDEX is a real-mode interface. A protected-mode selector needs an
  // extender thunk; do not pass it through Machine.lin's offset truncation.
  if (ex && (ex.get_cr0() & 1) && !(ex.get_vm86 && ex.get_vm86())) return null;
  const off = r.get('bx') & 0xffff;
  if (off + length > 0x10000) return null; // bounded subset: no segment crossing
  const at = ((r.get('es') & 0xffff) * 16) + off;
  if (at + length > 0x100000) return null; // no A20 alias/wrap ambiguity
  if (!(ex && ex.get_cr0() < 0) && at + length > m.mem.length) return null;
  return at;
}

function int2fMscdex(m, al, r) {
  const word = name => r.get(name) & 0xffff;
  const drives = [...(m.isoVolumes?.keys() || [])].sort((a, b) => a - b);
  if (al === 0x00) {
    r.set('bx', drives.length);
    if (drives.length) r.set('cx', drives[0]);
    return true; // AX and flags are not result fields for this call
  }
  // With no mounted volumes, retain the uninstalled multiplex chain behavior.
  if (!drives.length) return false;
  if (al === 0x0b) {
    r.set('bx', 0xadad); r.set('ax', drives.includes(word('cx')) ? 1 : 0);
    return true; // CF is not specified as a result
  }
  if (al === 0x0d) {
    const at = destination(m, r, drives.length);
    // No error return is defined for this call. Refuse invalid buffers through
    // the existing observable unhandled-interrupt path, without invented flags.
    if (at === null) return false;
    m.guestWrite(at, Uint8Array.from(drives));
    return true;
  }
  if (al !== 0x05 && al !== 0x08) return false;
  const fail = code => {
    r.set('ax', (word('ax') & 0xff00) | code); // spec defines AL, not AH
    r.setResultCf(true); return true;
  };
  const volume = m.isoVolumes.get(word('cx'));
  if (!volume) return fail(15);
  const count = al === 0x05 ? 1 : word('dx');
  const at = destination(m, r, count * SECTOR);
  // The reference only defines invalid-drive/not-ready for these reads.
  // Zero count and unsafe transfer sizes are refused as not ready.
  if (!count || at === null) return fail(21);
  let bytes;
  try {
    const view = dataView(volume);
    const lba = al === 0x05 ? 16 + word('dx') : word('si') * 0x10000 + word('di');
    if (al === 0x08 && view.absolute === false) return fail(21);
    const relative = al === 0x05 ? lba : lba - view.start;
    if (relative < 0 || relative + count > view.end - view.start) return fail(21);
    bytes = view.source.readRange(relative * SECTOR, count * SECTOR);
    if (!(bytes instanceof Uint8Array) || bytes.length !== count * SECTOR) return fail(21);
    // Copy before any guest write, including when a provider returns Buffer.
    bytes = Uint8Array.from(bytes);
    if (al === 0x05 && (String.fromCharCode(...bytes.subarray(1, 6)) !== 'CD001' || bytes[6] !== 1)) return fail(21);
  } catch (_) { return fail(21); } // source bounds/header/short/closed failures
  // Keep page faults outside the media-error catch. guestWrite preflights all
  // translations before writing; a CPU fault must follow the existing VM path.
  m.guestWrite(at, bytes);
  if (al === 0x05) r.set('ax', bytes[0] === 1 ? 1 : bytes[0] === 255 ? 255 : 0);
  r.setResultCf(false);
  return true;
}

module.exports = { int2fMscdex };
