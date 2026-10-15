#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Worker } = require('worker_threads');
const { fixture, args } = require('./test-thread-send-frame-ownership');
const { context } = require('../tools/repro-thread-send-wait-retirement');
const fields = ['esp', 'eax', 'eip', 'yield_reason', 'depth'];
const state = link => Promise.all(fields.map(n => link.callExport('get_' + n)));
const wait = (c, r, handle, timeout = 0) => c.manager.resolveThreadSendYield(c.link,
  { ...r, waitHandle: handle, waitTimeout: timeout, waitStackBytes: 12 },
  { waitPolls: 0, waitStartedAt: 0 }, new Set([c.link]));
function barrier(link, method) {
  const original = link[method].bind(link);
  let release, entered;
  const gate = new Promise(r => { release = r; });
  const at = new Promise(r => { entered = r; });
  link[method] = async (...values) => { entered(); await gate; return original(...values); };
  return { at, release, restore: () => { link[method] = original; } };
}
async function lostReplies(kind, module) {
  const c = await context(kind, module);
  try {
    const { link, manager } = c;
    const event = manager.createEvent(false, true);
    const r = await link.dispatchThreadSend(args(1, 1));
    const reserve = link.reserveThreadSendWait.bind(link);
    link.reserveThreadSendWait = async token => { await reserve(token); throw new Error('lost reserve ack'); };
    assert.strictEqual(await wait(c, r, event), 'pending');
    assert.strictEqual(Atomics.load(manager.syncView, manager._getSyncIdx(event) * 4 + 2), 1);
    assert((await link.abortThreadSendDispatch(true, 1)).waitPending);
    link.reserveThreadSendWait = reserve;
    const complete = link.completeWait.bind(link);
    link.completeWait = async (...values) => { await complete(...values); throw new Error('lost complete ack'); };
    assert.strictEqual(await wait(c, r, event), 'pending');
    const delivered = await state(link);
    manager.setEvent(event); // a second independent signal must survive retry
    link.completeWait = complete;
    assert.strictEqual(await wait(c, r, event), 'resume');
    assert.deepStrictEqual(await state(link), delivered, 'lost ack retry must not pop twice');
    assert.strictEqual(manager.waitSingle(event, 0), 0, 'retry cannot consume second signal');
    assert((await link.completeWait(0, 12, r)).duplicate);
    await assert.rejects(link.completeWait(17, 12, r), /Conflicting/);
    assert.deepStrictEqual(await state(link), delivered);
    await link.resumeThreadSendDispatch(undefined, 1, r.waitEpoch);
    assert.strictEqual(link.threadSendWaitResults.size, 0, 'acknowledged resume retires host receipt');
  } finally { await c.close(); }
}
async function pendingAndFences(kind, module) {
  const c = await context(kind, module);
  try {
    const { manager, host, link } = c;
    const semaphore = manager.createSemaphore(2, 2);
    const r = await link.dispatchThreadSend(args(1, 1));
    const gate = barrier(link, 'completeWait');
    const first = wait(c, r, semaphore);
    await gate.at;
    gate.restore();
    const duplicateResolver = wait(c, r, semaphore);
    const before = await state(link);
    for (const name of ['run', 'clear_yield', 'set_esp', 'resume_message_wait',
      'get_sleep_yielded', 'get_free_list', 'get_edit_text', 'has_pending_message']) {
      await assert.rejects(link.callExport(name, 999), /fences export/);
    }
    assert((await link.completeWait(0, 12)).ownershipMismatch, 'unowned callback completion is rejected');
    assert((await link.resumeThreadSendDispatch(undefined, 1)).waitPending);
    if (kind === 'Worker') {
      assert((await link.slice(1000)).threadSendPending);
      await assert.rejects(link.readExports(['clear_yield']), /fences export/);
      await assert.rejects(link.readExports(['get_sleep_yielded']), /fences export/);
      await assert.rejects(link.completeThreadSend(77), /fences command/);
    } else {
      assert.strictEqual(manager.checkMainYield(), true);
      const sandbox = { console, setTimeout, clearTimeout, URL, URLSearchParams };
      vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../host.js'), 'utf8')
        + '\n;globalThis.WineAssembly = WineAssembly;', sandbox);
      const stats = sandbox.WineAssembly.prototype._runCooperativeSlice.call({ threadManager: manager }, 1000);
      assert.strictEqual(stats.threadSendPending, true);
      assert.strictEqual(stats.blocks, 0);
    }
    assert.deepStrictEqual(await state(link), before);
    await link.dispatchThreadSend(args(2, 1));
    const inner = await state(link);
    gate.release();
    assert.deepStrictEqual(await Promise.all([first, duplicateResolver]), ['pending', 'pending']);
    gate.restore();
    assert.deepStrictEqual(await state(link), inner);
    // Run the real synchronization resolver in another actual Node Worker
    // against the same table. Metadata mirrors the already-created handle;
    // no sync table state or wait result is fabricated.
    const idx = manager._getSyncIdx(semaphore);
    const other = new Worker(`
      const {parentPort, workerData:d} = require('worker_threads');
      const {ThreadManager} = require(d.managerPath);
      (async()=>{
        const instance = await WebAssembly.instantiate(d.module);
        const manager = new ThreadManager(d.module,d.memory,instance,null);
        manager._syncHandleToIdx.set(d.handle,d.idx);
        manager._syncCurrentHandles[d.idx]=d.handle;
        parentPort.postMessage([manager.waitSingle(d.handle,0,8),manager.waitSingle(d.handle,0,8)]);
      })().catch(e=>{throw e;});`, { eval: true, workerData: {
      managerPath: path.resolve(__dirname, '../lib/thread-manager.js'),
      module, memory: manager.memory, handle: semaphore, idx,
    } });
    try {
      const result = await new Promise((resolve, reject) => { other.once('message', resolve); other.once('error', reject); });
      assert.deepStrictEqual(result, [0, 0x102], 'another Worker consumes only remaining semaphore unit');
    } finally { await other.terminate(); }
    assert((await link.abortThreadSendDispatch(true, 2)).aborted);
    assert.strictEqual(await wait(c, r, semaphore), 'resume', 'retained result survives another Worker consuming remaining units');
    assert.strictEqual(await link.callExport('get_eax'), 0);
    await link.resumeThreadSendDispatch(undefined, 1, r.waitEpoch);
    assert.strictEqual(await link.callExport('get_sleep_yielded'), 1, 'denied getter did not clear its global');
    assert.strictEqual(await link.callExport('get_sleep_yielded'), 0, 'ordinary destructive getter still works');
    assert.strictEqual(host._localSendFrames.length, 0);
  } finally { await c.close(); }
}
async function cancellationAndRetirement(kind, module) {
  // An unsatisfied poll cancels its reservation without retiring the wait.
  let c = await context(kind, module);
  try {
    const event = c.manager.createSemaphore(0, 1);
    const r = await c.link.dispatchThreadSend(args(1, 1));
    assert.strictEqual(await wait(c, r, event, 0xFFFFFFFF), 'pending');
    assert((await c.link.abortThreadSendDispatch(true, 1)).aborted);
    c.manager.releaseSemaphore(event, 1, 0);
    assert.strictEqual(c.manager.waitSingle(event, 0), 0);
  } finally { await c.close(); }
  // Termination during the reservation acknowledgement cannot consume.
  c = await context(kind, module);
  const reserve = c.link.reserveThreadSendWait.bind(c.link);
  c.link.reserveThreadSendWait = async token => { const r = await reserve(token); await c.close(); return r; };
  const event = c.manager.createEvent(false, true);
  const r = await c.link.dispatchThreadSend(args(1, 1));
  await assert.rejects(wait(c, r, event), /retired/);
  assert.strictEqual(c.manager.waitSingle(event, 0), 0);
  // Termination after real mutex acquisition retires retained results and
  // abandons the actual receiver's ownership; it does not restore signals.
  c = await context(kind, module);
  const mutex = c.manager.createMutex(false);
  const blocked = await c.link.dispatchThreadSend(args(1, 1));
  const gate = barrier(c.link, 'completeWait');
  const resolving = wait(c, blocked, mutex);
  await gate.at;
  assert.strictEqual(c.manager.waitSingle(mutex, 0, 8), 0x102);
  await c.close();
  assert.strictEqual(c.link.threadSendWaitResults.size, 0);
  assert.strictEqual(c.manager.waitSingle(mutex, 0, 8), 0x80);
  gate.release();
  await assert.rejects(resolving, /retired|could not post/);
}
async function driverAndMessages(kind, module) {
  const c = await context(kind, module);
  try {
    const { host, manager, link } = c;
    const event = manager.createEvent(false, true);
    let injected = false, deferred = 0;
    const resume = link.resumeThreadSendDispatch.bind(link);
    link.resumeThreadSendDispatch = async (value, token, epoch) => {
      const result = await resume(value, token, epoch);
      if (result.waitPending && token === 1) {
        deferred++;
        assert((await link.abortThreadSendDispatch(true, 2)).aborted);
      }
      return result;
    };
    host.threadSendYieldResolver = async (target, r, polling, active) => {
      const action = await manager.resolveThreadSendYield(target,
        { ...r, waitHandle: event, waitTimeout: 0, waitStackBytes: 12 }, polling, active);
      if (action === 'resume' && !injected) {
        injected = true;
        await link.dispatchThreadSend(args(++link.nextThreadSendFrameToken, 1));
      }
      return action;
    };
    assert.strictEqual(await host._dispatchThreadSendToLink(link, args(0, 1), 0, null, {}), 0);
    assert.strictEqual(deferred, 1, 'driver waits for exact frame after delivery-before-resume nesting');
    assert.strictEqual(manager.waitSingle(event, 0), 0x102);
    const r = await link.dispatchThreadSend(args(3, 7));
    const message = link.resumeThreadSendMessageWait.bind(link);
    link.resumeThreadSendMessageWait = async (...values) => { await message(...values); throw new Error('lost message ack'); };
    assert.strictEqual(await manager.resolveThreadSendYield(link, r, {}, new Set([link])), 'pending');
    const delivered = await state(link);
    link.resumeThreadSendMessageWait = message;
    assert.strictEqual(await manager.resolveThreadSendYield(link, r, {}, new Set([link])), 'resume');
    assert.deepStrictEqual(await state(link), delivered);
    await resume(undefined, 3, r.waitEpoch);
    // With no callback frames, the existing ordinary completion API still
    // applies its result/stack cleanup and ordinary export mutation still runs.
    await link.callExport('set_yield_state', 1, 1);
    const ordinary = await state(link);
    await link.completeWait(55, 12);
    assert.strictEqual(await link.callExport('get_esp'), ordinary[0] + 12);
    assert.strictEqual(await link.callExport('get_eax'), 55);
  } finally { await c.close(); }
}
async function resolverFailure(kind, module) {
  for (const consume of [false, true]) {
    const c = await context(kind, module);
    try {
      const event = c.manager.createEvent(false, true);
      const r = await c.link.dispatchThreadSend(args(1, 1));
      const resolve = c.manager.resolveWait.bind(c.manager);
      c.manager.resolveWait = (...values) => {
        if (consume) resolve(...values);
        throw new Error('injected resolver failure');
      };
      await assert.rejects(wait(c, r, event), /injected resolver failure/);
      c.manager.resolveWait = resolve;
      await assert.rejects(wait(c, r, event), /requires owner retirement/);
      assert((await c.link.abortThreadSendDispatch(true, 1)).waitPending);
      assert((await c.link.cancelThreadSendWait(r)).consumed);
      assert.strictEqual(c.manager.waitSingle(event, 0), consume ? 0x102 : 0,
        'failure cannot re-run or roll back an ambiguous consuming resolver');
    } finally { await c.close(); }
  }
}
async function lostResume(kind, module) {
  const c = await context(kind, module);
  try {
    const { link, host, manager } = c;
    await link.callExport('set_next_wait', 1);
    const r = await link.dispatchThreadSend(args(1, 1));
    const event = manager.createEvent(false, true);
    assert.strictEqual(await wait(c, r, event), 'resume');
    const owner = kind === 'Worker' ? link : host;
    const method = kind === 'Worker' ? '_ask' : '_resumeLocalThreadSend';
    const original = owner[method].bind(owner);
    let calls = 0, afterFirst;
    owner[method] = async (...values) => {
      const result = await original(...values);
      if (kind === 'local' || values[0].t === 'resumeThreadSendDispatch') {
        calls++;
        if (calls === 1) afterFirst = await state(link);
        throw new Error('lost resume reply');
      }
      return result;
    };
    await assert.rejects(link.resumeThreadSendDispatch(undefined, 1, r.waitEpoch), /lost resume reply/);
    assert.strictEqual(calls, 2, 'retry uses same epoch, not a new resume');
    assert.deepStrictEqual(await state(link), afterFirst);
    assert((await link.abortThreadSendDispatch(true, 1)).waitPending,
      'unacknowledged resume receipt prevents aborting a newer epoch');
    manager.setEvent(event);
    await assert.rejects(wait(c, r, event), /ownership|owning frame/);
    assert.strictEqual(manager.waitSingle(event, 0), 0, 'old wait cannot consume a later signal');
    owner[method] = original;
    const next = await link.resumeThreadSendDispatch(undefined, 1, r.waitEpoch);
    assert.notStrictEqual(next.waitEpoch, r.waitEpoch);
    assert.deepStrictEqual(await state(link), afterFirst);
    await link.acknowledgeThreadSendResume(1, r.waitEpoch);
    assert((await link.abortThreadSendDispatch(true, 1)).aborted);
  } finally { await c.close(); }
}
const deadline = setTimeout(() => { console.error('reservation test exceeded 15 seconds'); process.exit(1); }, 15000);
(async () => {
  const module = await fixture();
  for (const kind of ['Worker', 'local']) {
    await lostReplies(kind, module);
    await pendingAndFences(kind, module);
    await cancellationAndRetirement(kind, module);
    await driverAndMessages(kind, module);
    await resolverFailure(kind, module);
    await lostResume(kind, module);
    console.log('PASS', kind, 'wait reservations, lost/duplicate acknowledgements, fences, shared resources, cancellation, retirement');
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => clearTimeout(deadline));
