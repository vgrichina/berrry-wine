#!/usr/bin/env node
'use strict';
// What a DOS executable needs before it can run, read from its bytes alone:
// .COM vs MZ, the real-mode image size, an appended overlay, a new-header
// signature (LE/LX = 32-bit DOS-extended, NE/PE = Windows/OS2), and the DOS
// extender or packer whose stub is bound in (CauseWay, DOS/4G(W), PMODE/W,
// DOS32/A, Phar Lap, WDOSX, DJGPP go32/CWSDPMI, EMX; PKLITE, LZEXE, DIET).
// Static only: nothing is executed, so a signature is evidence of what the
// program will ASK for, not of whether any emulator provides it.
//   node tools/dos-exe-scan.js <file> [<file> ...] [--json]
//   require('./dos-exe-scan').scanDosExe(buffer, name)

const fs = require('fs');

const EXTENDERS = [
  ['causeway', /CauseWay/],
  ['dos4gw', /DOS\/4GW?\b/],
  ['pmodew', /PMODE\/W/],
  ['dos32a', /DOS\/32A/],
  ['pharlap', /Phar Lap/],
  ['wdosx', /WDOSX/],
  ['djgpp', /go32-v2|CWSDPMI|DJGPP/],
  ['emx', /\bemx\b|EMX:/],
];
const PACKERS = [['pklite', /PKLITE/], ['lzexe', /LZ09|LZ91/], ['diet', /dlz|DIET/]];

function scanDosExe(buf, name = '') {
  const out = { name, bytes: buf.length, kind: 'unknown', realModeImageBytes: null, overlayBytes: 0, newHeader: null, extender: null, extenderMentions: [], packers: [], notes: [] };
  const isMz = buf.length >= 0x1c && ((buf[0] === 0x4d && buf[1] === 0x5a) || (buf[0] === 0x5a && buf[1] === 0x4d));
  if (!isMz) {
    if (/\.com$/i.test(name) && buf.length <= 0xff00) { out.kind = 'com'; out.notes.push('flat real-mode .COM'); }
    else out.notes.push('no MZ signature');
  } else {
    out.kind = 'mz';
    const lastPage = buf.readUInt16LE(2), pages = buf.readUInt16LE(4), relocOff = buf.readUInt16LE(0x18);
    const image = pages ? (pages - 1) * 512 + (lastPage || 512) : 0;
    out.realModeImageBytes = Math.min(image, buf.length);
    out.overlayBytes = Math.max(0, buf.length - image);
    // A new-header pointer is only meaningful when the relocation table starts
    // at or past 0x40 (the classic heuristic), and the target must be in-file.
    if (buf.length >= 0x40 && relocOff >= 0x40) {
      const lfanew = buf.readUInt32LE(0x3c);
      if (lfanew >= 0x40 && lfanew + 2 <= buf.length) {
        const sig = buf.toString('latin1', lfanew, lfanew + 2);
        if (['LE', 'LX', 'NE', 'PE'].includes(sig)) out.newHeader = { signature: sig, offset: lfanew };
      }
    }
    // Bound extenders often append their LE image after the stub instead of
    // pointing e_lfanew at it: look for an LE/LX header right at the overlay.
    if (!out.newHeader && out.overlayBytes >= 2) {
      const sig = buf.toString('latin1', image, image + 2);
      if (sig === 'LE' || sig === 'LX') out.newHeader = { signature: sig, offset: image, atOverlay: true };
    }
  }
  const text = buf.toString('latin1');
  // The BOUND extender is the one whose signature sits inside the real-mode
  // stub (earliest wins); names found only later are text inside the program
  // or the extender's own compatibility messages (CauseWay mentions DOS/4G,
  // the DOS/4GW stub mentions Phar Lap) and are listed as mentions only.
  const stubEnd = out.realModeImageBytes ?? Math.min(buf.length, 0x10000);
  let best = null;
  for (const [id, re] of EXTENDERS) {
    const m = new RegExp(re.source, 'g').exec(text);
    if (!m) continue;
    if (m.index < stubEnd && (!best || m.index < best.at)) best = { id, at: m.index };
    else out.extenderMentions.push(id);
  }
  if (best) out.extender = { id: best.id, binding: 'bound', stubOffset: best.at };
  else if (out.newHeader?.signature === 'LE' || out.newHeader?.signature === 'LX') {
    // An LE/LX program whose stub names no extender loads one from disk
    // (Watcom's stub runs DOS4GW.EXE found on PATH or beside the program).
    out.extender = { id: out.extenderMentions.includes('dos4gw') ? 'dos4gw' : 'unknown', binding: 'external' };
  }
  out.extenderMentions = out.extenderMentions.filter((id) => id !== out.extender?.id);
  for (const [id, re] of PACKERS) if (re.test(text.slice(0, 0x400))) out.packers.push(id);
  out.mode = out.kind === 'com' ? 'real'
    : out.extender || out.newHeader?.signature === 'LE' || out.newHeader?.signature === 'LX' ? 'protected (DOS extender)'
      : out.newHeader?.signature === 'PE' || out.newHeader?.signature === 'NE' ? 'not a DOS program (' + out.newHeader.signature + ')'
        : out.kind === 'mz' ? 'real' : 'unknown';
  if (out.kind === 'mz' && out.overlayBytes > 0 && !out.extender && !out.newHeader) out.notes.push(`${out.overlayBytes} bytes past the MZ image (overlay data or an unrecognized extender)`);
  return out;
}

module.exports = { scanDosExe, EXTENDERS, PACKERS };

if (require.main === module) {
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const json = process.argv.includes('--json');
  if (!files.length) { console.error('usage: node tools/dos-exe-scan.js <file> [...] [--json]'); process.exit(2); }
  const rows = files.map((f) => scanDosExe(fs.readFileSync(f), f));
  if (json) console.log(JSON.stringify(rows, null, 1));
  else for (const r of rows) {
    console.log(`${r.name}  ${r.bytes} B  ${r.kind}  mode=${r.mode}`
      + (r.realModeImageBytes !== null ? `  image=${r.realModeImageBytes}` : '') + (r.overlayBytes ? `  overlay=${r.overlayBytes}` : '')
      + (r.newHeader ? `  ${r.newHeader.signature}@0x${r.newHeader.offset.toString(16)}` : '')
      + (r.extender ? `  extender=${r.extender.id}(${r.extender.binding})` : '') + (r.extenderMentions.length ? `  mentions=${r.extenderMentions.join(',')}` : '') + (r.packers.length ? `  packer=${r.packers.join(',')}` : '')
      + (r.notes.length ? `  (${r.notes.join('; ')})` : ''));
  }
}
