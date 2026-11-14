'use strict';

// Pure JavaScript wrapper loading only: no Machine, WASM compilation or guest.
const assert = require('node:assert/strict');
const { buildBundle } = require('../tools/toyvm/bundle-browser');

for (const entry of ['tools/toyvm/live.js', 'tools/toyvm/region-prepare.js']) {
  const built = buildBundle([entry, 'lib/compile-wat.js']);
  assert.ok(built.modules.includes('tools/toyvm/cdrom-media.js'));
  const sandbox = {};
  new Function('self', 'atob', built.js)(sandbox,
    text => Buffer.from(text, 'base64').toString('binary'));
  const { createCdromMedia } = sandbox.ToyVM.require('tools/toyvm/cdrom-media.js');
  const sector = new Uint8Array(2352);
  sector.fill(0x5a);
  const disc = createCdromMedia('FILE "audio.bin" BINARY\nTRACK 01 AUDIO\nINDEX 01 00:00:00\n', sector);
  assert.deepEqual(Array.from(disc.readSector(0)), Array.from(sector));
  console.log('PASS JS wrapper/CD byte-provider load: ' + entry);
}
