'use strict';
// Run one existing host mutation in this process so the supervising Node heap,
// physical-memory, CPU and capture controls also cover the rejecting control.
const assert = require('assert/strict');
const mutation = process.argv[2];
assert(['stop-no-notes', 'wrong-handle'].includes(mutation));
process.env.MIDI_MUTATION = mutation;
require('../test-midi-stream-lifecycle.js');
