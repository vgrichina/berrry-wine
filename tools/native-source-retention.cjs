'use strict';
// Complete CDP envelopes remain mandatory and durable before a source read
// resolves. Use asynchronous file IO so one lane's disk wait cannot prevent
// the driver from receiving the other uncached responses on its CDP socket.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

function createRetainer(directory, {timing = () => {}} = {}) {
  assert(path.isAbsolute(directory), 'absolute source response directory required');
  return async row => {
    assert(Number.isSafeInteger(row.sequence) && row.sequence > 0, 'source response sequence required');
    const start = performance.now();
    const body = JSON.stringify(row), serialized = performance.now();
    const file = await fs.open(path.join(directory, `source-response-${row.sequence}.json`), 'wx');
    const opened = performance.now();
    let written, synced;
    try {
      await file.writeFile(body);
      written = performance.now();
      await file.sync();
      synced = performance.now();
    } finally {
      await file.close();
    }
    timing({sequence: row.sequence, bytes: Buffer.byteLength(body),
      stringifyMs: serialized - start, openMs: opened - serialized,
      writeMs: written - opened, fsyncMs: synced - written,
      closeMs: performance.now() - synced, totalMs: performance.now() - start});
  };
}

function createProofRecorder(directory, {timing = () => {}} = {}) {
  assert(path.isAbsolute(directory), 'absolute source proof directory required');
  let tail = Promise.resolve();
  return row => {
    // Snapshot at admission, then serialize append/fsync operations in order.
    // A failed append poisons the queue rather than admitting later records.
    const start = performance.now(), body = JSON.stringify(row) + '\n';
    const serialized = performance.now();
    tail = tail.then(async () => {
      const queued = performance.now();
      const file = await fs.open(path.join(directory, 'software-responses.jsonl'), 'a');
      const opened = performance.now();
      let written, synced;
      try {
        await file.writeFile(body);
        written = performance.now();
        await file.sync();
        synced = performance.now();
      } finally {
        await file.close();
      }
      timing({bytes: Buffer.byteLength(body), stringifyMs: serialized - start,
        queueMs: queued - serialized, openMs: opened - queued,
        writeMs: written - opened, fsyncMs: synced - written,
        closeMs: performance.now() - synced, totalMs: performance.now() - start});
    });
    return tail;
  };
}

module.exports = {createRetainer, createProofRecorder};
