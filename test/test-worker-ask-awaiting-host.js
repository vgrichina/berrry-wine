#!/usr/bin/env node
'use strict';
// A guest Worker parked on a host import the page accepted but has not yet
// answered cannot be declared unresponsive by the WorkerLink command timer.
//
// Browser Threads, Quake II / Hexen II: the guest's first GL batch carries
// wglCreateContext, the page forwards it to the render Worker, and on a
// software GPU that Worker's WebGL context plus the fixed-function program
// take minutes. The guest sits in Atomics.wait for that answer, so the slice
// it is running cannot finish -- and the 60s slice timer then retired a
// healthy Worker, turning a slow first frame into a permanent hang
// ("worker 0 did not answer slice in 60000ms").
//
// On the default software+gps renderer the same Worker instead blocks in a
// GPU stream doorbell SYNC wait on the render Worker, which the page cannot
// see at all; it publishes that wait in its control block (RENDER_WAIT).
//
// This drives the real broker and the real WorkerLink._ask timer: the slot is
// parked on an asynchronous gpu_gl_batch (then on a doorbell wait), a
// short-timeout slice must survive several timer periods, and once the wait
// is over, a Worker that still says nothing is reported exactly as before.
const assert = require('node:assert/strict');
const RPC = require('../lib/guest-rpc');
const { WorkerLink } = require('../lib/guest-thread-host');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const memory = { buffer: new SharedArrayBuffer(512 * 1024 * 1024) };
  let finishBatch = null, batches = 0;
  const hostImports = {
    gpu_gl_batch: () => { batches++; return new Promise(resolve => { finishBatch = resolve; }); },
  };
  const broker = RPC.createMainBroker(memory, hostImports, { gpu_gl_batch: [['i32', 'i32'], 'i32'] });
  const link = new WorkerLink({ slot: 0, memory, broker });
  const posted = [];
  link.worker = { postMessage: msg => posted.push(msg), terminate() {} };

  // The guest Worker's side of a GL batch: request published, Worker parked.
  const v = RPC.views(memory, 0);
  Atomics.store(v.i32, RPC.SLOT.STATUS, RPC.STATUS_REQ);
  assert.equal(broker.awaitingHost(0), false, 'nothing accepted yet');
  assert.equal(broker.serveGlBatch({ slot: 0, memoryOffset: 64, bytes: 40 }), true);
  assert.equal(batches, 1);
  assert.equal(broker.awaitingHost(0), true, 'the page owes slot 0 its batch answer');
  assert.equal(broker.awaitingHost(1), false, 'only the parked slot');

  const PERIOD = 40;
  let settled = null;
  const slice = link._ask({ t: 'slice', steps: 1 }, PERIOD).then(
    value => { settled = { value }; }, error => { settled = { error }; });
  assert.equal(posted.length, 1);
  assert.equal(posted[0].t, 'slice');

  // Several full timer periods while the page still owes the answer.
  await delay(PERIOD * 6);
  assert.equal(settled, null, 'a Worker parked on the page is not an unresponsive Worker');
  assert.equal(link._pending.size, 1);

  // The render side finishes; the broker answers and wakes the Worker.
  finishBatch(1);
  await delay(0);
  assert.equal(Atomics.load(v.i32, RPC.SLOT.STATUS), RPC.STATUS_RESP);
  assert.equal(broker.awaitingHost(0), false);

  // Nothing is owed any more. A Worker that still does not answer is late,
  // and the original diagnosis stands.
  await delay(PERIOD * 3);
  await slice;
  assert(settled && settled.error, 'silent Worker is still reported once the page has answered');
  assert.match(settled.error.message, new RegExp(`worker 0 did not answer slice in ${PERIOD}ms`));
  assert.equal(link._pending.size, 0);
  console.log('PASS slice timer waits out a host-owed RPC, then still reports a silent Worker');

  // A doorbell SYNC wait goes from the guest Worker straight to the render
  // Worker; the page never sees a request. The Worker publishes the ring it
  // is parked on in its own control block (lib/guest-rpc.js does this around
  // Doorbell.waitDrained), and the timer treats it the same way.
  Atomics.store(v.i32, RPC.SLOT.STATUS, RPC.STATUS_IDLE);
  Atomics.store(v.i32, RPC.SLOT.RENDER_WAIT, 256); // any nonzero ring
  assert.equal(broker.awaitingHost(0), true, 'a doorbell SYNC wait is a render wait');
  settled = null;
  const doorbellSlice = link._ask({ t: 'slice', steps: 1 }, PERIOD).then(
    value => { settled = { value }; }, error => { settled = { error }; });
  await delay(PERIOD * 6);
  assert.equal(settled, null, 'a Worker in a doorbell SYNC wait is not an unresponsive Worker');
  Atomics.store(v.i32, RPC.SLOT.RENDER_WAIT, 0);
  await delay(PERIOD * 3);
  await doorbellSlice;
  assert(settled && settled.error && /did not answer slice/.test(settled.error.message),
    'once the doorbell wait ends, a silent Worker is reported again');
  console.log('PASS slice timer waits out a doorbell SYNC wait on the render Worker');

  // A Worker that answers in time is untouched by any of this.
  const quick = link._ask({ t: 'slice', steps: 1 }, PERIOD);
  const seq = posted[posted.length - 1].seq;
  link._pending.get(seq).resolve({ ms: 1 });
  assert.deepEqual(await quick, { ms: 1 });
  console.log('PASS prompt reply unaffected');
}

main().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
