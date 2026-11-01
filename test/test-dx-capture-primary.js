'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the CLI's actual chooser without launching an application.
const source = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
const start = source.indexOf('  const dxSurfaceContentScore =');
const end = source.indexOf('  const writeRgbaPng =', start);
assert(start >= 0 && end > start);
const choose = vm.runInNewContext(source.slice(start, end) + '\nchooseDxPresentationSurface;');

const size = 640 * 480 * 2;
const memory = Buffer.alloc(1 + size * 3);
const primary = { slot: 4, flags: 1, w: 640, h: 480, bpp: 16, pitch: 1280, dib: 1 };
const depth = { ...primary, slot: 6, flags: 4, dib: 1 + size };
const back = { ...primary, slot: 5, flags: 2, dib: 1 + size * 2 };
for (let i = 0; i < size / 2; i++) {
  memory.writeUInt16LE(0x0841, primary.dib + i * 2);
  memory.writeUInt16LE(i & 0xffff, depth.dib + i * 2);
  memory.writeUInt16LE(0x4208, back.dib + i * 2);
}
assert.equal(choose([depth, primary, back], memory), primary,
  'a populated primary must outrank a same-sized, more colorful offscreen depth/texture surface');
assert.equal(choose([primary, depth], memory), primary);
assert.equal(choose([depth], memory), depth, 'retain offscreen fallback without a primary');
memory.fill(0, primary.dib, primary.dib + size);
assert.equal(choose([primary, depth, back], memory), back,
  'retain the flipping-chain fallback when the primary is empty');
assert.equal(choose([primary, depth], memory), depth,
  'retain matching offscreen fallback when no primary/back buffer has content');
assert.equal(choose([primary], memory), null);
console.log('PASS CLI primary capture: populated primary, offscreen and blank-primary/back fallbacks');
