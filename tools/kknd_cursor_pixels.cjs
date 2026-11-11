'use strict';

// KKnD 640x480 native software cursor. Only the opaque white/black arrow
// pixels are invariant; transparent pixels must retain the current terrain.
// Radii 9, 10 and 12 were measured on retained stages 55, 59 and 63.
const { PNG } = require('pngjs');
const crypto = require('node:crypto');
const fs = require('node:fs');
const ARROW = ['#W#...', 'WWW#.#', '#WWW#W', '.#WWWW', '..#WWW', '.#WWWW'];

function check(frame, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw Error('invalid cursor position');
  const png = PNG.sync.read(frame, { checkCRC: true });
  if (png.width !== 640 || png.height !== 480) throw Error('unsupported full-frame geometry');
  if (x < 13 || x >= 640 - 13 || y < 13 || y >= 480 - 13) throw Error('clipped cursor');
  const matches = [];
  for (const radius of [9, 10, 12]) {
    let match = true;
    for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) {
      const symbol = ARROW[row][col];
      if (symbol === '.') continue;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const dx = -radius + col, dy = -radius + row;
        const px = x + (sx === -1 ? dx : -dx - 1);
        const py = y + (sy === -1 ? dy : -dy - 1);
        const offset = (py * png.width + px) * 4;
        const channel = symbol === 'W' ? 255 : 0;
        if (png.data[offset] !== channel || png.data[offset + 1] !== channel ||
            png.data[offset + 2] !== channel || png.data[offset + 3] !== 255) match = false;
      }
    }
    if (match) matches.push(radius);
  }
  if (matches.length !== 1) throw Error('refuse: exact white-ground cursor pixels absent or ambiguous');
  return { kind: 'white-ground', radius: matches[0], x, y,
    frameSha256: crypto.createHash('sha256').update(frame).digest('hex') };
}

module.exports = { check };
if (require.main === module) {
  try { process.stdout.write(JSON.stringify(check(fs.readFileSync(0), Number(process.argv[2]), Number(process.argv[3])))); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
