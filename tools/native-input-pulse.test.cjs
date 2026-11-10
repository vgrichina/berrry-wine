'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {pulse} = require('./native-input-pulse.cjs');
const wait = ms => new Promise(r => setTimeout(r, ms));
test('blocking evidence writer starts after UP acknowledgement', async () => {
  const edges = []; let saved = 0;
  const r = await pulse({deadline: Date.now() + 2000, holdMs: 100,
    down: async () => edges.push('down'), up: async () => edges.push('up'),
    save: r => { assert(r.up.ack); saved++; const until = Date.now() + 160; while (Date.now() < until) {} ; },
  });
  assert.deepEqual(edges, ['down', 'up']); assert.equal(saved, 1);
  assert(r.upAttemptedAt - r.releaseAt < 40);
});
test('late or unknown DOWN and failed persistence still attempt UP once', async () => {
  for (const mode of ['late', 'unknown', 'throw', 'save']) {
    let ups = 0;
    const receipt = {};
    const work = pulse({deadline: Date.now() + 2000, holdMs: 50, ackMs: 120, receipt,
      down: () => mode === 'unknown' ? new Promise(() => {}) : mode === 'throw' ? Promise.reject(Error('down')) : wait(80),
      up: async () => { ups++; }, save: () => { if (mode === 'save') throw Error('disk'); },
    });
    if (mode === 'late') await work; else await assert.rejects(work, /UNKNOWN/);
    assert.equal(ups, 1); assert(receipt.upAttemptedAt - receipt.start < 90);
  }
});
test('earlier absolute deadline preserves the release bound', async () => {
  const r = await pulse({deadline: Date.now() + 30, holdMs: 100, down: async () => {}, up: async () => {}});
  assert(r.upAttemptedAt - r.start < 60);
});
