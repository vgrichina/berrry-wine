'use strict';

// Prepare an existing whole capture for image review. This never asks the
// runtime to repaint, changes its clocks, or grants an input review.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { PNG } = require('pngjs');
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function prepare(bytes, expectedSHA256) {
  if (!Buffer.isBuffer(bytes) || !bytes.subarray(0, 8).equals(signature))
    throw Error('whole PNG required');
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (expectedSHA256 !== undefined && sha256 !== expectedSHA256)
    throw Error('capture SHA256 changed');
  // Decode with CRC checking before handing bytes to an image consumer. MIME
  // comes from this verified format, never the generic file tool's data URL.
  const png = PNG.sync.read(bytes, { checkCRC: true });
  const colors = new Map();
  for (let i = 0; i < png.data.length; i += 4) {
    const rgba = png.data.readUInt32BE(i);
    colors.set(rgba, (colors.get(rgba) || 0) + 1);
  }
  const histogram = [...colors].sort((a, b) => b[1] - a[1]);
  return {
    receipt: {
      contract: 'ut-dialog-whole-png-v1', sha256, bytes: bytes.length,
      width: png.width, height: png.height, distinctColors: colors.size,
      dominantPixels: histogram[0][1],
      otherPixels: png.width * png.height - histogram[0][1],
      colors: histogram.slice(0, 16).map(([rgba, pixels]) => ({
        rgba: rgba.toString(16).padStart(8, '0'), pixels,
      })),
      // Pixel census is evidence for review, not automatic scene acceptance.
      personallyReviewed: false,
    },
    image: { type: 'image', mimeType: 'image/png', data: bytes.toString('base64') },
  };
}

if (require.main === module) {
  try {
    const [file, expectedSHA256] = process.argv.slice(2);
    if (!file) throw Error('usage: node tools/ut-goty-dialog-display.cjs WHOLE.png [SHA256]');
    process.stdout.write(JSON.stringify(prepare(fs.readFileSync(file), expectedSHA256)) + '\n');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { prepare };
