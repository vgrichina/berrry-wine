#!/usr/bin/env node
'use strict';
// Lifecycle regression. Actual host driver, Worker/local
// endpoints and ThreadManager sync/retirement code; only the tiny Wasm fixture's
// absent wait-handle export is supplied by the resolver adapter.
const assert = require('assert');
const path = require('path');
const { fixture, args } = require('../test/test-thread-send-frame-ownership');
const { GuestThreadHost, WorkerLink } = require('../lib/guest-thread-host');
const { ThreadManager } = require('../lib/thread-manager');
let failures = 0;
function expect(label, actual, expected) {
  try { assert.deepStrictEqual(actual, expected); console.log('PASS', label); }
  catch (_) { failures++; console.log('FAIL', label, JSON.stringify({ actual, expected })); }
}
const registers = link => Promise.all(['esp', 'eax', 'eip', 'yield_reason', 'depth']
  .map(name => link.callExport('get_' + name)));
async function context(kind, module) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const instance = await WebAssembly.instantiate(module);
  const manager = new ThreadManager(module, memory, instance, null);
  const host = new GuestThreadHost(kind === 'local'
    ? { localMainExports: () => instance.exports } : {});
  const link = kind === 'local' ? host._localLink : new WorkerLink({
    slot: 3, memory, module, sigs: {},
    workerUrl: path.resolve(__dirname, '../lib/guest-worker.js'),
  });
  if (kind === 'Worker') { await link.start(); host.link = link; }
  manager.workerBackend = host;
  return { manager, host, link, close: () => host.stop() };
}
async function identity(module) {
  const c = await context('Worker', module);
  const { manager, host, link } = c;
  host.link = null;
  host.threadLinks.set(3, link);
  const handle = 0xE0003;
  const thread = { tid: 3, state: 'active', link, startAddr: 42, param: 0 };
  manager.threads.set(handle, thread);
  host.slotTid.set(3, 4);
  const mutex = manager.createMutex(false);
  let actualState;
  host.threadSendYieldResolver = (target, r, state, active) => {
    actualState = { ...state };
    return manager.resolveThreadSendYield(target,
      { ...r, waitHandle: mutex, waitTimeout: 0, waitStackBytes: 12 }, state, active);
  };
  try {
    await host._dispatchThreadSendToLink(link, args(0, 1), 0, null, {});
    const idx = manager._getSyncIdx(mutex);
    console.log('OBSERVED actual driver wait state', JSON.stringify(actualState));
    expect('Worker callback mutex owner is receiving Win32 TID',
      Atomics.load(manager.syncView, idx * 4 + 2), 4);
    expect('receiving thread can release callback-acquired mutex', manager.releaseMutex(mutex, 4), 1);
    // Keep acquisition live regardless of the preceding expected failure.
    if (Atomics.load(manager.syncView, idx * 4 + 2) === 0) manager.waitSingle(mutex, 0, 4);
    manager.terminateThread(handle, 77);
    assert.strictEqual(thread.state, 'exited');
    expect('real retirement abandons callback mutex for another thread', manager.waitSingle(mutex, 0, 5), 0x80);
  } finally { await c.close(); }
}
async function cancellation(kind, module) {
  const c = await context(kind, module);
  const { manager, link } = c;
  try {
    const event = manager.createEvent(false, true);
    const outer = await link.dispatchThreadSend(args(1, 1));
    const complete = link.completeWait.bind(link);
    let release, entered;
    const gate = new Promise(resolve => { release = resolve; });
    const consumed = new Promise(resolve => { entered = resolve; });
    link.completeWait = async (...values) => { entered(); await gate; return complete(...values); };
    const resolving = manager.resolveThreadSendYield(link,
      { ...outer, waitHandle: event, waitTimeout: 0, waitStackBytes: 12 },
      { waitPolls: 0, waitStartedAt: 0 }, new Set([link]));
    await consumed;
    assert.strictEqual(manager.waitSingle(event, 0), 0x102, 'real auto-reset consumption');
    const aborted = await link.abortThreadSendDispatch(true, 1);
    assert.strictEqual(aborted.aborted, false);
    assert(aborted.waitPending, 'consumed completion must prevent live-frame abort');
    assert((await link.cancelThreadSendWait(outer)).consumed);
    const owned = await registers(link);
    release();
    assert.strictEqual(await resolving, 'resume');
    expect(kind + ' denied abort delivers consumed result to owning callback', await registers(link),
      [owned[0] + 12, 0, 4096, 0, owned[4]]);
    await link.resumeThreadSendDispatch(undefined, 1, outer.waitEpoch);
  } finally { await c.close(); }
}
async function retired(kind, module) {
  const c = await context(kind, module);
  const { manager, link } = c;
  const event = manager.createEvent(false, true);
  const outer = await link.dispatchThreadSend(args(1, 1));
  await c.close();
  let outcome;
  try {
    outcome = await manager.resolveThreadSendYield(link,
      { ...outer, waitHandle: event, waitTimeout: 0, waitStackBytes: 12 },
      { waitPolls: 0, waitStartedAt: 0 }, new Set([link]));
  } catch (error) { outcome = 'rejected: ' + error.message; }
  console.log('OBSERVED', kind, 'already-retired resolver outcome', outcome);
  expect(kind + ' already-retired link cannot consume a new signal', manager.waitSingle(event, 0), 0);
  if (kind === 'local') expect('local stopped host does not report resumed callback', outcome === 'resume', false);
}
async function prerequisites() {
  failures = 0;
  const module = await fixture();
  await identity(module);
  for (const kind of ['Worker', 'local']) await retired(kind, module);
  assert.strictEqual(failures, 0, `${failures} wait identity/retirement prerequisites failed`);
}
async function main() {
  const module = await fixture();
  await identity(module);
  for (const kind of ['Worker', 'local']) {
    await cancellation(kind, module);
    await retired(kind, module);
  }
  assert.strictEqual(failures, 0, `${failures} callback wait lifecycle regressions remain`);
}
module.exports = { prerequisites, context };
if (require.main === module) {
  const deadline = setTimeout(() => {
    console.error('retirement probe exceeded ten-second infrastructure deadline');
    process.exit(1);
  }, 10000);
  main().catch(error => { console.error(error.message); process.exitCode = 1; })
    .finally(() => clearTimeout(deadline));
}
