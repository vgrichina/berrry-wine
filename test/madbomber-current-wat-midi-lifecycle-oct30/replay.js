#!/usr/bin/env node
'use strict';
// Invoke the unchanged pinned oracle. These controls do not repair its closure.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const mode = process.argv[2] || 'baseline';
assert(['baseline', 'stop-no-notes', 'wrong-handle'].includes(mode));
assert.equal(process.cwd(), root, 'run only from the owned repository');
assert(!process.env.MIDI_BASELINE_HOST && !process.env.MIDI_TEST_ROOT,
  'historical or alternate roots are outside this qualification');
const pins = require('./source-pins.json');
for (const [file, pin] of Object.entries(pins)) {
  const data = fs.readFileSync(path.join(root, file));
  assert.equal(data.length, pin.bytes, file + ' bytes');
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'), pin.sha256, file + ' SHA256');
}
if (mode === 'baseline') delete process.env.MIDI_MUTATION;
else process.env.MIDI_MUTATION = mode;
require('../test-midi-stream-lifecycle.js');
