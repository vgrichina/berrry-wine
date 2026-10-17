#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { fixture, args } = require('./test-thread-send-frame-ownership');
const { context } = require('../tools/repro-thread-send-wait-retirement');
const snapshot = link => Promise.all(['esp', 'eax', 'eip', 'yield_reason', 'depth']
  .map(n => link.callExport('get_' + n)));
const resolve = (c, r, state = {}) => c.manager.resolveThreadSendYield(c.link, r, state, new Set([c.link]));
function gate() {
  let release, enter;
  return { waiting: new Promise(r => { enter = r; }), promise: new Promise(r => { release = r; }),
    enter: () => enter(), release: () => release() };
}
async function controls(kind, module) {
  const c = await context(kind, module);
  try {
    const { link } = c;
    const outer = await link.dispatchThreadSend(args(1, 1));
    const saved = await snapshot(link);
    let frame = 1;
    for (const y of [8, 9, 13, 14, 15]) {
      const r = await link.dispatchThreadSend(args(++frame, y));
      const eax = await link.callExport('get_eax');
      await assert.rejects(link.callExport('clear_yield'), /fences export/);
      assert((await link.scopedThreadSendYield({ ...r, waitEpoch: r.waitEpoch + 1 }, true)).ownershipMismatch);
      assert.strictEqual(await resolve(c, r), 'resume');
      assert.strictEqual(await link.callExport('get_eax'), eax + (y === 8 ? 1 : 0));
      assert((await link.scopedThreadSendYield(r, true)).duplicate);
      assert.strictEqual(await link.callExport('get_eax'), eax + (y === 8 ? 1 : 0), 'network pump must run once');
      assert((await link.resumeThreadSendDispatch(undefined, frame)).waitPending);
      assert((await link.resumeThreadSendDispatch(undefined, frame, r.waitEpoch)).done);
      assert.deepStrictEqual(await snapshot(link), saved, 'generic resolution preserves outer wait');
      assert((await link.scopedThreadSendYield(r, true)).ownershipMismatch);
    }
    assert((await link.abortThreadSendDispatch(true, outer.frameToken)).aborted);
  } finally { await c.close(); }
}
async function delayed(kind, module, stale = false) {
  const c = await context(kind, module);
  try {
    const { link, host, manager } = c;
    // Register the Worker as tid 6; the driver state deliberately has no tid.
    if (kind === 'Worker') {
      host.link = null; host.threadLinks.set(3, link);
      manager.threads.set(123, { tid: 6, state: 'active', link });
    }
    const pending = { marker: 'exact read' }, g = gate();
    let fills = 0, requested;
    manager._getVfs = () => ({ getPendingRead(tid) { requested = tid; return pending; },
      async fillPendingRead(read) { assert.strictEqual(read, pending); fills++; g.enter(); await g.promise; } });
    await link.dispatchThreadSend(args(1, 1));
    const outer = await snapshot(link);
    const r = await link.dispatchThreadSend(args(2, 12));
    const state = {};
    const resolving = resolve(c, r, state);
    await g.waiting;
    assert.strictEqual(requested, kind === 'Worker' ? 7 : 1);
    if (stale) assert((await link.abortThreadSendDispatch(true, 2)).aborted);
    const inner = await link.dispatchThreadSend(args(3, stale ? 7 : 12));
    const before = await snapshot(link);
    g.release();
    if (stale) await assert.rejects(resolving, /ownership mismatch/);
    else assert.strictEqual(await resolving, 'pending');
    assert.deepStrictEqual(await snapshot(link), before, 'delayed I/O must not clear nested wait');
    assert((await link.abortThreadSendDispatch(true, inner.frameToken)).aborted);
    if (!stale) {
      assert.strictEqual(await resolve(c, r, state), 'resume');
      assert.strictEqual(fills, 1, 'nested deferral must not repeat asynchronous work');
      assert((await link.resumeThreadSendDispatch(undefined, 2, r.waitEpoch)).done);
    }
    assert.deepStrictEqual(await snapshot(link), outer);
    await link.abortThreadSendDispatch(true, 1);
  } finally { await c.close(); }
}
async function epoch(kind, module) {
  const c = await context(kind, module);
  try {
    const { link } = c;
    await link.callExport('set_next_wait', 13);
    const r = await link.dispatchThreadSend(args(1, 13));
    assert.strictEqual(await resolve(c, r), 'resume');
    const next = await link.resumeThreadSendDispatch(undefined, 1, r.waitEpoch);
    assert(next.waitEpoch > r.waitEpoch);
    const before = await snapshot(link);
    assert((await link.scopedThreadSendYield(r, true)).ownershipMismatch);
    assert.deepStrictEqual(await snapshot(link), before);
    assert.strictEqual(await resolve(c, next), 'resume');
    await link.resumeThreadSendDispatch(undefined, 1, next.waitEpoch);
    await link.callExport('clear_yield'); // ordinary API retained outside callbacks
  } finally { await c.close(); }
}
async function lostCompletion(kind, module) {
  const c = await context(kind, module);
  try {
    const { link } = c;
    const r = await link.dispatchThreadSend(args(1, 8));
    const command = link.scopedThreadSendYield.bind(link);
    let lost = false;
    link.scopedThreadSendYield = async (token, finish) => {
      const result = await command(token, finish);
      if (finish && !lost) { lost = true; throw new Error('lost finish reply'); }
      return result;
    };
    await assert.rejects(resolve(c, r), /lost finish reply/);
    const before = await snapshot(link);
    assert.strictEqual(await resolve(c, r), 'resume');
    assert.deepStrictEqual(await snapshot(link), before, 'lost ack retry cannot pump twice');
    await link.resumeThreadSendDispatch(undefined, 1, r.waitEpoch);
  } finally { await c.close(); }
}
async function fault(kind, module) {
  const c = await context(kind, module);
  try {
    const { link } = c;
    await link.callExport('set_pump_fault', 1);
    const r = await link.dispatchThreadSend(args(1, 8));
    const eax = await link.callExport('get_eax');
    await assert.rejects(resolve(c, r), /unreachable/);
    assert.strictEqual(await link.callExport('get_eax'), eax + 1, 'trap occurs after real pump mutation');
    await assert.rejects(resolve(c, r), /fault requires owner retirement/);
    assert.strictEqual(await link.callExport('get_eax'), eax + 1, 'fault cannot repeat pump');
    assert.strictEqual(await link.callExport('get_yield_reason'), 8);
    assert((await link.abortThreadSendDispatch(true, 1)).waitPending, 'fault must remain owned');
    assert((await link.resumeThreadSendDispatch(undefined, 1, r.waitEpoch)).waitPending);
  } finally { await c.close(); }
}
async function retired(kind, module) {
  const c = await context(kind, module);
  try {
    const g = gate();
    c.manager._getVfs = () => ({ getPendingRead: () => ({}),
      async fillPendingRead() { g.enter(); await g.promise; } });
    const r = await c.link.dispatchThreadSend(args(1, 12));
    const resolving = resolve(c, r);
    await g.waiting;
    await c.host.stop();
    g.release();
    await assert.rejects(resolving, /owner retired during resolution/);
  } finally { await c.close(); }
}
async function driver(kind, module) {
  const c = await context(kind, module);
  try {
    c.host.threadManager = c.manager;
    await c.link.dispatchThreadSend(args(1, 1));
    c.link.nextThreadSendFrameToken = 1;
    const before = await snapshot(c.link);
    await c.host._dispatchThreadSendToLink(c.link, args(0, 9), 0, null, {});
    assert.deepStrictEqual(await snapshot(c.link), before, 'actual driver restores outer wait');
    await c.link.abortThreadSendDispatch(true, 1);
  } finally { await c.close(); }
}
async function render(kind, module) {
  const c = await context(kind, module);
  try {
    const g = gate(); let calls = 0;
    c.manager._onRenderWait = async () => { calls++; g.enter(); await g.promise; };
    const r = await c.link.dispatchThreadSend(args(1, 16)); r.renderToken = -2;
    const state = {};
    assert.strictEqual(await resolve(c, r, state), 'pending');
    await g.waiting;
    await c.link.dispatchThreadSend(args(2, 1));
    const before = await snapshot(c.link);
    g.release(); await new Promise(r => setImmediate(r));
    assert.strictEqual(await resolve(c, r, state), 'pending');
    assert.deepStrictEqual(await snapshot(c.link), before);
    await c.link.abortThreadSendDispatch(true, 2);
    assert.strictEqual(await resolve(c, r, state), 'resume');
    assert.strictEqual(calls, 1);
    await c.link.resumeThreadSendDispatch(undefined, 1, r.waitEpoch);
  } finally { await c.close(); }
}
(async () => {
  const module = await fixture();
  for (const kind of ['Worker', 'local']) {
    await controls(kind, module); await delayed(kind, module); await delayed(kind, module, true);
    await epoch(kind, module); await render(kind, module);
    await lostCompletion(kind, module); await driver(kind, module);
    await fault(kind, module); await retired(kind, module);
    console.log('PASS ' + kind + ' scoped generic callback yields, delayed I/O/render, owner identity, stale epochs and outer waits');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
