'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');

// The final name is the commit point. link (unlike rename) cannot replace an
// existing command ID. Pending files live on the same filesystem as the final.
function publishJSON(file, value) {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== 'string') throw new TypeError('JSON value required');
  const bytes = Buffer.from(serialized + '\n');
  const directory = path.dirname(file);
  const pending = path.join(directory, '.' + path.basename(file) + '.' + randomUUID() + '.pending');
  let fd;
  try {
    fd = fs.openSync(pending, 'wx', 0o600);
    for (let offset = 0; offset < bytes.length;) {
      const written = fs.writeSync(fd, bytes, offset, bytes.length - offset);
      if (written <= 0) throw Error('JSON channel write made no progress');
      offset += written;
    }
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    fs.linkSync(pending, file);
  } finally {
    try { if (fd !== undefined) fs.closeSync(fd); }
    finally { if (fs.existsSync(pending)) fs.unlinkSync(pending); }
  }
  const dir = fs.openSync(directory, 'r');
  try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
}

// Only the exact complete name is read. Missing is pending; malformed complete
// JSON is terminal, including on subsequent calls. Never retry a failed ID.
function createReader(directory, prefix = 'command') {
  let failure;
  return {
    get closed() { return !!failure; },
    read(id) {
      if (failure) throw failure;
      try {
        if (!Number.isSafeInteger(id) || id < 0) throw Error('invalid command ID');
        let bytes;
        try { bytes = fs.readFileSync(path.join(directory, prefix + '-' + id + '.json')); }
        catch (e) { if (e.code === 'ENOENT') return null; throw e; }
        const value = JSON.parse(bytes);
        if (!value || value.id !== id) throw Error('JSON channel ID mismatch');
        return value;
      } catch (e) { failure = e; throw e; }
    }
  };
}
module.exports = {publishJSON, createReader};
