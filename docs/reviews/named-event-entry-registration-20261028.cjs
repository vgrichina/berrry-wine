'use strict';
// Blocker diagnostic: exact production Worker RPC entry, with broker dispatch
// withheld. No CLI source extraction, surrogate wait consumer, or guest code.
// This does NOT establish end-to-end CLI acceptance or implement a reservation.
const assert = require('node:assert/strict');
const { Worker } = require('node:worker_threads');
const cp = require('node:child_process');
const { NamedEventAuthority, NamedEventClient } = require('../../lib/named-event-authority');
const RPC = require('../../lib/guest-rpc');
const { ThreadManager } = require('../../lib/thread-manager');

if (process.argv.includes('--authority')) {
  const authority = new NamedEventAuthority();
  process.send(authority.endpoint);
  process.once('message', async () => { await authority.close(); process.disconnect(); });
} else {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

async function main() {
  const authority = cp.fork(__filename, ['--authority'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  const authorityExit = new Promise(resolve => authority.once('exit', resolve));
  let client, contender, worker, tm, handle;
  const closedWorkers = [];
  const deadline = setTimeout(() => { throw Error('diagnostic watchdog'); }, 10000);
  try {
    const endpoint = await new Promise((resolve, reject) => {
      authority.once('message', resolve); authority.once('error', reject);
    });
    process.env.WINE_NAMED_EVENT_ENDPOINT = JSON.stringify(endpoint);
    contender = new NamedEventClient(endpoint);
    const name = `entry-contract-${process.pid}`;
    // Exactly one fixed 512MiB arena, as in the production RPC ABI. Only the
    // RPC control pages are touched. No module is compiled or instantiated.
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    tm = new ThreadManager({}, memory, { exports: {get_sync_table:()=>0} }, ()=>({host:{}}));
    tm._log = ()=>{}; tm.enableNamedEventAuthority();
    handle = tm.createEvent(false, false, name) & 0x7fffffff;
    client = tm._eventClient();
    const event = tm._authorityEvents.get(handle).refs[0];
    const other = contender.open(name);
    const sigs = { wait_single: { params: ['i32', 'i32'], results: ['i32'] } };
    // The real broker establishes the protocol capability. We deliberately
    // never dispatch it: no fabricated CLI adapter substitutes for production.
    RPC.createMainBroker(memory, { wait_single() { throw Error('unexpected dispatch'); } }, sigs);
    worker = new Worker(`
      const { parentPort, workerData:d } = require('node:worker_threads');
      const RPC = require(d.rpc);
      const built = RPC.createWorkerImports(d.memory, d.sigs,
        m => parentPort.postMessage(m), {slot:0, getSyncMsgDepth:()=>0});
      try { built.imports.host.wait_single(d.handle, 50); parentPort.postMessage({unexpectedReturn:true}); }
      catch(error) { parentPort.postMessage({unexpectedError:error.message}); }
    `, { eval: true, workerData: { memory, sigs, handle, rpc: require.resolve('../../lib/guest-rpc') } });
    const message = await new Promise((resolve, reject) => {
      worker.once('message', resolve); worker.once('error', reject);
    });
    assert.equal(message.t, 'rpc');
    assert.equal(message.waitEntry.version, 1);
    assert.equal(message.waitEntry.sequence, 1);
    assert.equal(message.waitEntry.handle, handle);
    assert.equal(message.waitEntry.timeout, 50);
    assert(message.waitEntry.clock && !message.waitEntry.error);
    const words = new Int32Array(memory.buffer, RPC.RPC_BASE, RPC.CTRL_INTS);
    assert.equal(Atomics.load(words, RPC.SLOT.WAIT_SEQUENCE), 1);
    assert.equal(Atomics.load(words, RPC.SLOT.WAIT_RESERVED), 0);
    // Causal ordering uses receipt of the actual production RPC request, not
    // diagnostic timestamps. An independent authenticated socket session can
    // still consume a signal AFTER the import has entered and published it.
    client.set(event);
    const stolen = contender.acquire(other.handle);
    assert.equal(stolen, true, 'baseline counterexample: no reservation at entry');
    client.set(event); client.reset(event);
    assert.equal(contender.acquire(other.handle), false, 'entry also retains no Set/Reset pulse');
    // The same exact entry sample expires without replenishment. Registering
    // it later cannot retract success already returned to the contender.
    await new Promise(resolve => setTimeout(resolve, 90));
    const clock = client.validateWaitClock(message.waitEntry.clock);
    const expired = client.registerWait(event, 50, clock);
    assert.equal(expired.state, 'timed-out'); client.forgetWait(expired.waitId);
    // Positive control: an ACTUALLY registered waiter does reserve a pulse.
    const registered = client.registerWait(event, 1000, client.waitClock());
    assert.equal(registered.state, 'pending');
    client.set(event); client.reset(event);
    assert.equal(contender.acquire(other.handle), false);
    assert.equal(client.waitStatus(registered.waitId).state, 'signaled');
    client.forgetWait(registered.waitId);
    assert.equal(Atomics.load(words, RPC.SLOT.WAIT_RESERVED), 0);
    tm.closeEvent(handle); handle = null; contender.close(other.handle);
    console.log(JSON.stringify({diagnostic:true,entryPublished:true,authorityInSeparateProcess:true,
      consumedByOtherSessionBeforeDispatch:stolen,lostPulse:true,agedEntry:'timed-out',
      registeredPositiveControl:'signaled',workerSequence:message.waitEntry.sequence,
      reservationWord:0,cliExecuted:false,guestExecuted:false}));
    if (process.argv.includes('--require-entry-reservation')) {
      assert.equal(stolen, false, 'ENTRY_RESERVATION_REQUIRED: another session consumed the entry-owned signal');
    }
  } finally {
    clearTimeout(deadline);
    if (worker) { await worker.terminate(); closedWorkers.push('rpc'); }
    if (tm) { if (handle) tm.closeEvent(handle); tm.closeNamedEventAuthority(); }
    for (const c of [client, contender]) if (c) { c.shutdown(); await c.worker.terminate(); closedWorkers.push('client'); }
    if (authority.connected) authority.send('close');
    await authorityExit;
    console.log(JSON.stringify({cleanup:true,closedWorkers,authorityChildExited:true}));
  }
}
