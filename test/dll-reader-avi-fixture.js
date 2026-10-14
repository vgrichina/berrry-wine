'use strict';
// ---- a 8x4 RLE8 clip, three frames at 10 fps ----
// Palette: 0 blue (the transparent key), 1 red, 2 green.
// Frame 0 (key): all red, top-left pixel blue.
// Frame 1 (delta): top-left 2x2 green.
// Frame 2 (delta): bottom-right pixel blue.
const W = 8, H = 4;
const FRAMES = [
  // bottom-up rows; each ends with EOL, the frame with EOB
  [8, 1, 0, 0, 8, 1, 0, 0, 8, 1, 0, 0, 1, 0, 7, 1, 0, 1],
  [0, 0, 0, 0, 2, 2, 0, 0, 2, 2, 0, 1],
  [7, 1, 1, 0, 0, 1],
];

function fourcc(s) { return Buffer.from(s, 'latin1'); }
function u32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; }
function u16(v) { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; }
function chunk(id, body) {
  const pad = body.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0);
  return Buffer.concat([fourcc(id), u32(body.length), body, pad]);
}
function list(type, parts) {
  const body = Buffer.concat([fourcc(type), ...parts]);
  return Buffer.concat([fourcc('LIST'), u32(body.length), body]);
}

function buildAvi() {
  const avih = Buffer.concat([
    u32(100000), u32(0), u32(0), u32(0x10), u32(FRAMES.length), u32(0), u32(1),
    u32(256), u32(W), u32(H), u32(0), u32(0), u32(0), u32(0)]);
  const strh = Buffer.concat([
    fourcc('vids'), fourcc('RLE '), u32(0), u16(0), u16(0), u32(0),
    u32(1), u32(10), u32(0), u32(FRAMES.length), u32(256), u32(0xFFFFFFFF), u32(0),
    u16(0), u16(0), u16(W), u16(H)]);
  const palette = Buffer.alloc(256 * 4);
  palette.set([255, 0, 0, 0], 0);   // BGRX blue
  palette.set([0, 0, 255, 0], 4);   // red
  palette.set([0, 255, 0, 0], 8);   // green
  const strf = Buffer.concat([
    u32(40), u32(W), u32(H), u16(1), u16(8), u32(1 /* BI_RLE8 */), u32(0),
    u32(0), u32(0), u32(256), u32(0), palette]);
  const hdrl = list('hdrl', [chunk('avih', avih),
    list('strl', [chunk('strh', strh), chunk('strf', strf)])]);
  const frameChunks = FRAMES.map(f => chunk('00dc', Buffer.from(f)));
  const movi = list('movi', frameChunks);
  // idx1 offsets are relative to the 'movi' fourcc.
  let off = 4;
  const idx = frameChunks.map((c, i) => {
    const e = Buffer.concat([fourcc('00dc'), u32(i === 0 ? 0x10 : 0), u32(off), u32(FRAMES[i].length)]);
    off += c.length;
    return e;
  });
  const body = Buffer.concat([fourcc('AVI '), hdrl, movi, chunk('idx1', Buffer.concat(idx))]);
  return Buffer.concat([fourcc('RIFF'), u32(body.length), body]);
}

module.exports = { buildAvi };
