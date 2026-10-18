#!/usr/bin/env node
'use strict';
// Read-only source/fixture preflight. Does not launch a guest or recover files.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const manifest = require('../docs/re-notes/diablo2-fixtures-20261019.json');
const root = path.resolve(process.argv[2] || manifest.observedRoot);
const failures = [];
for (const file of manifest.files) {
  try {
    const bytes = fs.readFileSync(path.join(root, file.path));
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== file.bytes || hash !== file.sha256)
      failures.push({ path: file.path, reason: 'identity mismatch', bytes: bytes.length, sha256: hash });
  } catch (error) { failures.push({ path: file.path, reason: error.code || error.message }); }
}
console.log(JSON.stringify({ root, candidate: manifest.candidate, app: manifest.app,
  checkedFiles: manifest.files.length, totalBytes: manifest.totalBytes,
  installedBytes: manifest.installedBytes, failures,
  fixtureReady: failures.length === 0, runtimeExecuted: false }, null, 2));
if (failures.length) process.exitCode = 1;
