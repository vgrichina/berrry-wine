#!/usr/bin/env node
// Tile a directory of PNG frames into one contact sheet, in filename order.
//
//   node tools/filmstrip.js --dir=/tmp/run1 [--out=strip.png] [--cols=6]
//        [--scale=3] [--open]
//
// WHY THIS EXISTS: `profile-web-frames.js --film=DIR` writes one PNG every few
// seconds so a whole menu transition is on camera, and the question asked of
// those frames is always "which frame did it change on". Opening them one at a
// time answers that slowly and loses the before/after comparison that makes the
// answer obvious. tools/app-contact-sheet.js is the wrong tool for this: it
// picks ONE capture per app id and is built to survey a registry sweep, not a
// time series of one app.
//
// Frames are downscaled by an integer factor (nearest neighbour, so emulator
// pixels stay legible) and laid out left to right, top to bottom. Order is
// filename order, which is why --film names frames f000-, f001-, ...
'use strict';

// `| head -2` is the normal way to read this tool's output; without this the
// closed pipe raises an unhandled EPIPE and the exit looks like a crash.
process.stdout.on('error', e => { if (e.code === 'EPIPE') process.exit(0); });

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const a = argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const DIR = opt('dir', '');
const COLS = Number(opt('cols', 6));
const SCALE = Number(opt('scale', 3));
const OUT = opt('out', DIR ? path.join(DIR, 'filmstrip.png') : '');
const OPEN = argv.includes('--open');

if (!DIR) {
  console.error('usage: node tools/filmstrip.js --dir=DIR [--out=F] [--cols=N] [--scale=N] [--open]');
  process.exit(2);
}

const files = fs.readdirSync(DIR)
  .filter(f => f.toLowerCase().endsWith('.png') && path.join(DIR, f) !== path.resolve(OUT))
  .sort();
if (!files.length) {
  console.error(`no PNG frames in ${DIR}`);
  process.exit(1);
}

const frames = [];
for (const f of files) {
  try { frames.push({ name: f, png: PNG.sync.read(fs.readFileSync(path.join(DIR, f))) }); }
  catch (e) { console.error(`skipping ${f}: ${e.message}`); }
}
if (!frames.length) { console.error('every frame failed to decode'); process.exit(1); }

// One cell fits the largest frame, so a mid-run canvas resize does not shear
// the grid.
const cellW = Math.ceil(Math.max(...frames.map(f => f.png.width)) / SCALE);
const cellH = Math.ceil(Math.max(...frames.map(f => f.png.height)) / SCALE);
const GAP = 3;
const cols = Math.max(1, Math.min(COLS, frames.length));
const rows = Math.ceil(frames.length / cols);
const sheet = new PNG({
  width: cols * cellW + (cols + 1) * GAP,
  height: rows * cellH + (rows + 1) * GAP,
});
sheet.data.fill(0);
for (let i = 0; i < sheet.data.length; i += 4) sheet.data[i + 3] = 255;

frames.forEach((f, i) => {
  const ox = GAP + (i % cols) * (cellW + GAP);
  const oy = GAP + Math.floor(i / cols) * (cellH + GAP);
  const { width: w, height: h, data } = f.png;
  for (let y = 0; y < Math.min(cellH, Math.floor(h / SCALE)); y++) {
    for (let x = 0; x < Math.min(cellW, Math.floor(w / SCALE)); x++) {
      const s = ((y * SCALE) * w + x * SCALE) * 4;
      const d = ((oy + y) * sheet.width + ox + x) * 4;
      sheet.data[d] = data[s];
      sheet.data[d + 1] = data[s + 1];
      sheet.data[d + 2] = data[s + 2];
      sheet.data[d + 3] = 255;
    }
  }
});

fs.writeFileSync(OUT, PNG.sync.write(sheet));
console.log(`${frames.length} frames -> ${OUT}  (${sheet.width}x${sheet.height}, ${cols} cols, 1/${SCALE})`);
frames.forEach((f, i) => { if (i % cols === 0) process.stdout.write(`  row ${i / cols}: `); process.stdout.write(f.name + (i % cols === cols - 1 || i === frames.length - 1 ? '\n' : '  ')); });
if (OPEN) require('child_process').spawnSync('open', ['-a', 'Preview', path.resolve(OUT)]);
