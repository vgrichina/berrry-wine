#!/usr/bin/env node
'use strict';
// Small Wasm fixture only; real Worker/local, real consuming resolver, actual
// host driver (which intentionally has no tid in its per-frame polling state).
const assert = require('assert');
const { prerequisites, context } = require('../tools/repro-thread-send-wait-retirement');
const { fixture, args } = require('./test-thread-send-frame-ownership');
const deadline = setTimeout(() => {
  console.error('wait identity checks exceeded ten-second infrastructure deadline');
  process.exit(1);
}, 10000);
(async () => {
  await prerequisites();
  const c = await context('Worker', await fixture());
  const { manager, host, link } = c;
  try {
    host.link = null;
    host.threadLinks.set(3, link);
    const event = manager.createEvent(false, true);
    const outer = await link.dispatchThreadSend(args(1, 1));
    const r = { ...outer, waitHandle: event, waitTimeout: 0, waitStackBytes: 12 };
    const poll = () => manager.resolveThreadSendYield(link, r,
      { tid: 99, waitPolls: 0, waitStartedAt: 0 }, new Set([link]));
    await assert.rejects(poll(), /live registered thread/);
    assert.strictEqual(manager.waitSingle(event, 0), 0, 'unregistered link cannot consume');
    manager.setEvent(event);
    const thread = { tid: 3, state: 'exited', link };
    manager.threads.set(0xE0003, thread);
    await assert.rejects(poll(), /live registered thread/);
    assert.strictEqual(manager.waitSingle(event, 0), 0, 'retired record cannot consume');
    manager.setEvent(event);
    thread.state = 'active';
    thread.link = {}; // same numeric tid/slot, different link lifetime
    await assert.rejects(poll(), /live registered thread/);
    assert.strictEqual(manager.waitSingle(event, 0), 0, 'replacement link cannot authorize stale link');
    thread.link = link;
    const mutex = manager.createMutex(false);
    await manager.resolveThreadSendYield(link, { ...r, waitHandle: mutex },
      { tid: 99, waitPolls: 0, waitStartedAt: 0 }, new Set([link]));
    assert.strictEqual(manager.releaseMutex(mutex, 4), 1, 'registry identity overrides supplied polling tid');
    await link.resumeThreadSendDispatch(undefined, 1, r.waitEpoch);
    // Ordinary noncallback APIs retain their existing explicit-owner contract.
    assert.strictEqual(manager.waitSingle(mutex, 0, 8), 0);
    assert.strictEqual(manager.releaseMutex(mutex, 8), 1);
  } finally { await c.close(); }
  console.log('PASS callback wait identity, pre-consumption retirement and ordinary sync controls');
})().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => clearTimeout(deadline));
