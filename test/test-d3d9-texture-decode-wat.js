#!/usr/bin/env node
'use strict';
// GPU stream v2 slice 9.1: the WAT texture decoder (src/09ae1-d3d9-texture-
// decode.wat) is bit-exact with the JS decoders it replaced. The fixture was
// generated from lib/d3d9-texture.js and the inline captureDraw conversions at
// 82193049e, before they were deleted (scratch/runs/20261115-gps-9.1/
// gen-fixture.js slices the old code out of the file verbatim).
const assert = require('assert');
const path = require('path');
const { decode } = require('./helpers/wat-texture-decoder');
const fixture = require(path.join(__dirname, 'fixtures/d3d9-texture-decode-js.json'));

const DXT1 = 0x31545844, DXT2 = 0x32545844, DXT3 = 0x33545844, DXT4 = 0x34545844, DXT5 = 0x35545844;
let checked = 0;
const formats = new Set();
for (const c of fixture.cases) {
  const src = Buffer.from(c.src, 'base64'), want = Buffer.from(c.rgba, 'base64');
  const got = Buffer.from(decode(new Uint8Array(src), c.width, c.height, c.format));
  assert.ok(got.equals(want), `format ${c.format} ${c.width}x${c.height} differs from the old JS decoder`);
  // Banded decode (the shipped path copies 64 KB bands) is the same picture.
  const dxt = c.format === DXT1 || c.format === DXT3 || c.format === DXT5;
  const step = dxt ? 4 : 3, parts = [];
  for (let y = 0; y < c.height; y += step) parts.push(Buffer.from(decode(new Uint8Array(src), c.width, c.height, c.format, { y0: y, rows: step })));
  assert.ok(Buffer.concat(parts).equals(want), `format ${c.format} ${c.width}x${c.height} banded decode differs`);
  formats.add(c.format); checked++;
}
assert.strictEqual(formats.size, 15, 'fixture covers every format the JS path decoded');

// Hand cases kept from the former test-d3d9-textures.js DXT unit asserts.
const dxt1 = new Uint8Array([0, 248, 224, 7, 0xe4, 0xe4, 0xe4, 0xe4]);
assert.deepStrictEqual(Array.from(decode(dxt1, 4, 4, DXT1).slice(0, 16)), [255,0,0,255, 0,255,0,255, 170,85,0,255, 85,170,0,255]);
assert.ok(decode(new Uint8Array([0,0,255,255,255,255,255,255]), 1, 1, DXT1).every(v => v === 0), 'DXT1 3-colour index 3 is transparent black');
const dxt3 = new Uint8Array(16);
for (let j = 0; j < 8; j++) dxt3[j] = (2 * j) | ((2 * j + 1) << 4);
dxt3.set(dxt1, 8);
const dxt3rgba = decode(dxt3, 4, 4, DXT3);
assert.deepStrictEqual(Array.from({ length: 16 }, (_, i) => dxt3rgba[i * 4 + 3]), Array.from({ length: 16 }, (_, i) => (i << 4) | i));
const reversed = new Uint8Array(16); reversed.fill(255, 0, 8); reversed.set([0,0,255,255,255,255,255,255], 8);
assert.deepStrictEqual(Array.from(decode(reversed, 1, 1, DXT3)), [170,170,170,255], 'DXT3 always interpolates four colours');
const edge = new Uint8Array(16); edge.set(dxt1); edge.set([0,0,255,255,255,255,255,255], 8);
const e53 = decode(edge, 5, 3, DXT1);
assert.strictEqual(e53.length, 60);
for (let y = 0; y < 3; y++) assert.deepStrictEqual(Array.from(e53.slice((y * 5 + 4) * 4, (y * 5 + 5) * 4)), [0,0,0,0]);

// Formats the JS path never decoded: DXT2/DXT4 are DXT3/DXT5's premultiplied
// spellings (a sampler returns the stored colour), A8 is alpha over black.
for (const c of fixture.cases.filter(c => c.format === DXT3 || c.format === DXT5)) {
  const src = new Uint8Array(Buffer.from(c.src, 'base64'));
  assert.ok(Buffer.from(decode(src, c.width, c.height, c.format === DXT3 ? DXT2 : DXT4)).equals(Buffer.from(c.rgba, 'base64')));
}
assert.deepStrictEqual(Array.from(decode(new Uint8Array([0, 0x80, 0xff]), 3, 1, 28)), [0,0,0,0, 0,0,0,0x80, 0,0,0,0xff]);
assert.throws(() => decode(new Uint8Array(4), 1, 1, 41), /refused format 41/, 'P8 is not decoded without a palette');
console.log(`PASS test-d3d9-texture-decode-wat: ${checked} fixture levels bit-exact (${formats.size} formats), DXT2/DXT4/A8`);
