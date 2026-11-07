'use strict';

// Immutable queue records: the final name becomes visible only after close.
// link (rather than rename) preserves exclusive creation under competing writers.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function publishJSON(file, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  const temporary = path.join(path.dirname(file), '.' + path.basename(file) + '.' +
    process.pid + '.' + crypto.randomBytes(12).toString('hex') + '.tmp');
  let created = false;
  try {
    const fd = fs.openSync(temporary, 'wx', 0o600);
    created = true;
    try {
      fs.writeFileSync(fd, bytes);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.linkSync(temporary, file);
  } finally {
    if (created) fs.unlinkSync(temporary);
  }
}

function readJSON(file) {
  const bytes = fs.readFileSync(file);
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    // Capture precisely this read, never a later reread. Do not retry admission.
    const failure = {
      at: new Date().toISOString(), file, error: String(error),
      length: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      base64: bytes.toString('base64')
    };
    try { publishJSON(file + '.read-failure.json', failure); }
    catch (e) { error.evidenceError = String(e); }
    throw error;
  }
}

module.exports = { publishJSON, readJSON };
