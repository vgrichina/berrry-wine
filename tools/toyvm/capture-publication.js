'use strict';

const fs = require('fs');
const path = require('path');
const { randomUUID, createHash } = require('crypto');

// Each stage has a unique name. JSON is the readiness marker: consumers may
// read it only after both files have been completed and atomically published.
function publishCapture(base, state, writeImage) {
  const png = base + '.png', json = base + '.json';
  if (fs.existsSync(png) || fs.existsSync(json)) throw new Error('capture already published: ' + base);
  fs.mkdirSync(path.dirname(base), { recursive: true });
  const suffix = '.' + randomUUID() + '.tmp';
  const imageTemp = png + suffix, jsonTemp = json + suffix;
  try {
    writeImage(imageTemp);
    const bytes = fs.readFileSync(imageTemp);
    const capture = { path: path.basename(png), size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex') };
    const result = { ...state, capture };
    fs.writeFileSync(jsonTemp, JSON.stringify(result, null, 2), { flag: 'wx' });
    fs.renameSync(imageTemp, png);
    fs.renameSync(jsonTemp, json);
    return result;
  } finally {
    for (const file of [imageTemp, jsonTemp]) fs.rmSync(file, { force: true });
  }
}

module.exports = { publishCapture };
