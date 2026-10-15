#!/usr/bin/env node
'use strict';
// Regression: real Worker/local handlers + real consuming
// ThreadManager resolver, tiny Wasm fixture; no x86 interpreter or game build.
const assert = require('assert');
const path = require('path');
const { fixture, args } = require('../test/test-thread-send-frame-ownership');
const { GuestThreadHost, WorkerLink } = require('../lib/guest-thread-host');
const { ThreadManager } = require('../lib/thread-manager');
const state = link => Promise.all(['esp', 'eax', 'eip', 'yield_reason', 'depth']
  .map(n => link.callExport('get_' + n)));
let failures = 0;
function unchanged(label, before, after) {
  try { assert.deepStrictEqual(after, before); console.log('PASS', label); }
  catch (_) { failures++; console.log('FAIL', label, JSON.stringify({before, after})); }
}
async function probe(kind, link, manager) {
  manager.workerBackend = { link };
  // Pause after the real resolver consumes an auto-reset event, before its
  // actual completeWait request is posted. No result is synthesized.
  const event = manager.createEvent(false, true);
  const outer = await link.dispatchThreadSend(args(1, 1));
  assert(outer.blocked);
  const complete = link.completeWait.bind(link);
  let release, entered;
  const gate = new Promise(r => { release = r; });
  const atCompletion = new Promise(r => { entered = r; });
  link.completeWait = async (...values) => {
    entered(); await gate; return complete(...values);
  };
  const resolving = manager.resolveThreadSendYield(link,
    { ...outer, waitHandle: event, waitTimeout: 0, waitStackBytes: 12 },
    {waitPolls: 0, waitStartedAt: 0}, new Set([link]));
  await atCompletion;
  assert.strictEqual(manager.waitSingle(event, 0), 0x102,
    'real resolver consumed the auto-reset signal before Worker completion');
  console.log('OBSERVED', kind, 'auto-reset event consumed before delayed completion');
  await link.dispatchThreadSend(args(2, 1));
  const before = await state(link);
  release(); assert.strictEqual(await resolving, 'pending');
  unchanged(kind + ' delayed outer wait must preserve nested frame', before, await state(link));
  link.completeWait = complete;
  await link.abortThreadSendDispatch(true, 2);
  assert.strictEqual(await manager.resolveThreadSendYield(link,
    { ...outer, waitHandle: event, waitTimeout: 0, waitStackBytes: 12 },
    {waitPolls: 0, waitStartedAt: 0}, new Set([link])), 'resume');
  assert.strictEqual(await link.callExport('get_eax'), 0);
  await link.resumeThreadSendDispatch(undefined, 1, outer.waitEpoch);
  await link.acknowledgeThreadSendResume(1, outer.waitEpoch);

  // The same callback executes another fixture wait through owned resume/run.
  // The new epoch must reject replay of the previous completion.
  await link.callExport('set_next_wait', 1);
  const previous = await link.dispatchThreadSend(args(3, 1));
  await link.reserveThreadSendWait(previous);
  await link.completeWait(17, 12, previous);
  const next = await link.resumeThreadSendDispatch(undefined, 3, previous.waitEpoch);
  await link.acknowledgeThreadSendResume(3, previous.waitEpoch);
  assert.notStrictEqual(previous.waitEpoch, next.waitEpoch);
  const nextWait = await state(link);
  assert((await link.completeWait(17, 12, previous)).ownershipMismatch);
  unchanged(kind + ' old wait completion must not complete reused frame wait', nextWait, await state(link));
  await link.abortThreadSendDispatch(true, 3);

  const outerMessage = await link.dispatchThreadSend(args(4, 7));
  // A delayed outer message-wait resume reaches a newer message-wait frame.
  await link.dispatchThreadSend(args(5, 7));
  const messageWait = await state(link);
  assert((await link.resumeThreadSendMessageWait(true, outerMessage)).pending);
  unchanged(kind + ' outer message resume must preserve nested wait', messageWait, await state(link));
  await link.abortThreadSendDispatch(true, 5);
  assert((await link.resumeThreadSendMessageWait(true, outerMessage)).resumed);
  const messageDone = await state(link);
  assert((await link.resumeThreadSendMessageWait(true, outerMessage)).duplicate);
  assert.deepStrictEqual(await state(link), messageDone);
  await link.resumeThreadSendDispatch(undefined, 4, outerMessage.waitEpoch);
  await link.acknowledgeThreadSendResume(4, outerMessage.waitEpoch);
}
const deadline = setTimeout(() => {
  console.error('wait ownership probe exceeded five-second infrastructure deadline');
  process.exit(1);
}, 5000);
(async () => {
  const module = await fixture();
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const instance = await WebAssembly.instantiate(module);
  const manager = new ThreadManager(module, memory, instance, null);
  const link = new WorkerLink({ slot: 0, memory, module, sigs: {},
    workerUrl: path.resolve(__dirname, '../lib/guest-worker.js') });
  try { await link.start(); await probe('Worker', link, manager); }
  finally { await link.stop(); }
  const host = new GuestThreadHost({ localMainExports: () => instance.exports });
  await probe('local', host._localLink, manager);
  assert.strictEqual(failures, 0, `${failures} wait ownership regressions remain`);
})().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => clearTimeout(deadline));
