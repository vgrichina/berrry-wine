'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { PNG } = require('pngjs');
const { prepare } = require('../tools/ut-goty-dialog-display.cjs');

const png = new PNG({ width: 12, height: 8 });
for (let i = 0; i < png.data.length; i += 4)
  png.data.set(i < 32 ? [192, 192, 192, 255] : [0, 128, 128, 255], i);
const bytes = PNG.sync.write(png);
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
const original = Buffer.from(bytes);
const result = prepare(bytes, sha);
assert.equal(result.image.mimeType, 'image/png', 'generic octet-stream cannot be used for image review');
assert.deepEqual(Buffer.from(result.image.data, 'base64'), original, 'whole original encoded bytes preserved');
assert.deepEqual(PNG.sync.read(Buffer.from(result.image.data, 'base64')).data, png.data);
assert.deepEqual(bytes, original, 'preparation must not alter source');
assert.equal(result.receipt.otherPixels, 8);
assert.equal(result.receipt.width, 12);
assert.equal(result.receipt.height, 8);
assert.equal(result.receipt.personallyReviewed, false);
assert.throws(() => prepare(bytes, '0'.repeat(64)), /SHA256 changed/);
assert.throws(() => prepare(Buffer.from('not an image')), /whole PNG/);
assert.throws(() => prepare(bytes.subarray(0, 40)));
const corrupt = Buffer.from(bytes);
corrupt[45] ^= 1;
assert.throws(() => prepare(corrupt), /CRC|inflate|unrecognised|chunk|data/i);
console.log('UT whole PNG format, identity, pixel census and corruption controls PASS');
