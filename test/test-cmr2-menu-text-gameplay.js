#!/usr/bin/env node

'use strict';

// Colin McRae Rally 2.0 demo at a 32-bit display: its front-end text and the
// language screen's dotted flag are DXT5 textures decompressed on Blt into the
// texture format the game picked at the display depth. With only XRGB8888
// offered at 32 bits every glyph came out opaque, a solid block per character
// (software and WebGL alike); EnumTextureFormats now offers ARGB8888 as well.
// The language label "english" must be text, not a filled rectangle.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { PNG } = require('pngjs');
const regions = require('../lib/region-map.generated.js');

const ROOT = path.join(__dirname, '..');
const { APPS } = require('../lib/apps.js');
const EXE = path.join(ROOT, APPS.cmr2_demo.exe);
const OUT = path.join(ROOT, 'build', 'test-cmr2-menu-text');
const LOG = path.join(ROOT, 'build', 'test-cmr2-menu-text.log');

if (!fs.existsSync(EXE)) {
  console.log('SKIP  CMR2 demo payload is absent (see docs/re-notes/cmr2-demo.md, Install)');
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });

// DirectDraw's process state: +0/+4/+8 display width/height/bpp. The game's
// image base is 0x400000, so its guest address is base - GUEST_BASE + 0x400000.
const modeGuest = regions.BASE.DX_PROCESS_STATE - regions.GUEST_BASE + 0x400000;
const shot = path.join(OUT, 'language.png');
// docs/re-notes/cmr2-demo.md route: slow the clock before the language
// Enter so the menus do not time out into the attract demo.
const args = [
  'test/run.js', '--app=cmr2_demo', '--no-build', '--quiet-api', '--no-close',
  '--max-batches=33001', '--max-seconds=120', '--watch=0x80b94c', '--watch-log',
  `--input=29000:tick-ms:5,30000:di-keydown:13,30003:di-keyup:13,` +
    `33000:dump-mem:0x${modeGuest.toString(16)}:16,33000:png:${shot}`,
];
const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const output = (result.stdout || '') + (result.stderr || '');
fs.writeFileSync(LOG, output);
if (result.error) throw result.error;
assert.strictEqual(result.status, 0, `run.js exited ${result.status}; read ${LOG}`);

const dump = output.match(/Hexdump 0x[0-9a-f]+ \(16 bytes\):\n\s+0x[0-9a-f]+\s+((?:[0-9a-f]{2} ){12})/);
assert(dump, `mode state dump missing; read ${LOG}`);
const bytes = dump[1].trim().split(' ').map(x => parseInt(x, 16));
const u32 = o => bytes[o] | bytes[o + 1] << 8 | bytes[o + 2] << 16 | bytes[o + 3] << 24;
assert.deepStrictEqual([u32(0), u32(4), u32(8)], [640, 480, 32],
  'the game selected 640x480x32 (the 32-bit texture path this test guards)');

assert(fs.existsSync(shot), `language.png was not captured; read ${LOG}`);
const png = PNG.sync.read(fs.readFileSync(shot));
// The "english" label (x 100-200, y 388-420) over the flat 0x9ab4a8 backdrop:
// text leaves about half the box background, an opaque glyph block ~3%.
const near = (v, c) => Math.abs(v - c) < 12;
let background = 0, total = 0;
for (let y = 388; y < 420; y++) for (let x = 100; x < 200; x++) {
  const i = (y * png.width + x) * 4;
  total++;
  if (near(png.data[i], 0x9a) && near(png.data[i + 1], 0xb4) && near(png.data[i + 2], 0xa8)) background++;
}
const share = background / total;
assert(share > 0.3, `"english" label is ${(share * 100).toFixed(1)}% background: glyphs drew as solid blocks (${shot})`);

console.log(`PASS  CMR2 at 640x480x32 draws its menu text with alpha (${(share * 100).toFixed(1)}% background in the label)`);
