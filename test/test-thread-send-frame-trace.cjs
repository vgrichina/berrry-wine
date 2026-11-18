'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { GuestThreadHost, WorkerLink } = require('../lib/guest-thread-host');
const { fixture, args } = require('./test-thread-send-frame-ownership');

async function exercise(host, link) {
  const receipts = [];
  host.threadSendFrameTrace = r => receipts.push(r);
  host.processSendResolver = async () => 17;
  assert.equal(await host._dispatchThreadSendToLink(link, args(0), 0, null, {}), 17);
  const r = receipts.pop();
  assert.equal(r.frameToken, link.nextThreadSendFrameToken);
  assert.equal(r.counts.nested, 1);
  assert.equal(r.counts.nestedComplete, 1);
  assert.equal(r.yields[10], 1);
  assert.equal(r.first.at(-1).outcome, 'returned');
  host.threadSendFrameTrace = () => { throw Error('observer failure'); };
  assert.equal(await host._dispatchThreadSendToLink(link, args(0), 0, null, {}), 17);
  host.threadSendFrameTrace = r => receipts.push(r);
  const error = Error('real nested failure');
  host.processSendResolver = async () => { throw error; };
  await assert.rejects(host._dispatchThreadSendToLink(link, args(0), 0, null, {}), e => e === error);
  assert.equal(receipts.pop().first.at(-1).error, error.message);
  assert.equal(await link.callExport('get_depth'), 0);
  host.threadSendFrameTrace = undefined;
  host.processSendResolver = async () => 0;
  const n = host._sendTraceCount;
  assert.equal(await host._dispatchThreadSendToLink(link, args(0), 0, null, {}), 0);
  assert.equal(host._sendTraceCount, n, 'unarmed path retains nothing');
  // Use the actual Worker/local nested callback, past the ordinary allowance.
  host.threadSendFrameTraceFailureReserve = true;
  host._sendTraceCount = 255;
  host.threadSendFrameTrace = r => receipts.push(r);
  receipts.length = 0;
  assert.equal(await host._dispatchThreadSendToLink(link, args(0), 0, null, {}), 0);
  assert.equal(receipts.length, 0, 'late success cannot consume failure reserve');
  host.processSendResolver = async () => { throw error; };
  await assert.rejects(host._dispatchThreadSendToLink(link, args(0), 0, null, {}), e => e === error);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].failureReserved, true);
  assert.equal(receipts[0].sequence, 256);
  assert.equal(receipts[0].first.at(-1).error, error.message);
  assert.equal(host._beginThreadSendFrameTrace(link, {}, 0, {}), null, 'cap stays 256');
}

(async () => {
  const module = await fixture();
  const link = new WorkerLink({ slot: 0, memory: new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true }),
    module, sigs: {}, workerUrl: path.resolve(__dirname, '../lib/guest-worker.js') });
  try { await link.start(); await exercise(new GuestThreadHost({}), link); }
  finally { await link.stop(); }
  const local = await WebAssembly.instantiate(module);
  const host = new GuestThreadHost({ localMainExports: () => local.exports });
  await exercise(host, host._localLink);

  // Isolate scheduler branch observation with deterministic transport replies.
  const h = new GuestThreadHost({}), records = [];
  h.threadSendFrameTrace = r => records.push(r);
  const fake = { slot: 3, endpointIdentity: 99, dispatchThreadSend: async () => ({ blocked: true, yield: 7, waitEpoch: 4 }),
    resumeThreadSendDispatch: async () => ({ done: true, result: 23 }), acknowledgeThreadSendResume: async () => {} };
  let calls = 0;
  h.threadSendYieldResolver = async () => ++calls < 24 ? 'pending' : 'resume';
  const request = { sender: { pid: 1 }, receiver: { pid: 2 }, settled: false,
    lane: { link: fake, readyEpoch: 8 }, message: { msg: 42 } };
  assert.equal(await h._dispatchThreadSendToLink(fake, { msg: 42 }, 0, null, { request }), 23);
  const r = records.pop();
  assert.equal(r.counts.blockedPending, 23);
  assert.equal(r.counts.blockedResume, 1);
  assert.equal(r.first.length, 8); assert.equal(r.last.length, 8);
  assert.equal(r.request.receiverEndpoint, 99);
  assert.equal(r.request.readyEpoch, 8);
  assert.equal(r.last.at(-2).result, 23);
  fake.dispatchThreadSend = async () => ({ ownershipMismatch: true });
  await assert.rejects(h._dispatchThreadSendToLink(fake, {}, 0, null, { request }), /ownership mismatch/);
  assert.equal(records.pop().request.id, r.request.id, 'same owning request stays identifiable');
  h._sendTraceCount = 256;
  assert.equal(h._beginThreadSendFrameTrace(fake, {}, 0, {}), null);
  console.log('PASS frame trace: real Worker/local nested completion and failure, unarmed/throwing sink, blocked progress, bounded retention, stale owner');
})().catch(e => { console.error(e); process.exitCode = 1; });
