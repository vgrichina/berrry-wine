'use strict';

const { isMainThread, parentPort, workerData, Worker, threadId } = require('worker_threads');

if (!isMainThread) {
  const RPC = require('../lib/guest-rpc');
  const { readCompletion } = require('../tools/mw3-keyboard-completion');
  const rpc = RPC.createWorkerImports(workerData.memory, workerData.selected,
    message => parentPort.postMessage({ kind: 'rpc', message }), { slot: 1 });
  const e = new WebAssembly.Instance(workerData.module,
    { host: { memory: workerData.memory, ...rpc.imports.host } }).exports;
  const d = new DataView(workerData.memory.buffer);
  const rd = a => d.getUint32(a, true);
  const wr = (a, v) => d.setUint32(a, v, true);
  const expected = workerData.expected;
  const ex = { guest_to_wasm: e.g2w, get_esp: () => rd(e.reg() + 16), get_eax: () => rd(e.reg()) };
  parentPort.on('message', ({ id, command, flags = 0, requested = 128 }) => {
    try {
      if (command === 'acquire') e.acquire(expected.thisPtr);
      else {
        const stack = 0x30000;
        // Actual stdcall layout, including return address; the production
        // handler advances ESP by 24 before the read-only decoder runs.
        [expected.returnAddress, expected.thisPtr, 16, expected.buffer, expected.countPtr, flags]
          .forEach((value, i) => wr(e.g2w(stack) + 4 * i, value));
        wr(e.reg() + 16, stack);
        wr(e.g2w(expected.countPtr), requested);
        e.getData(expected.thisPtr, 16, expected.buffer, expected.countPtr, flags);
        if (command === 'negative') {
          const failures = [];
          for (const [name, value] of Object.entries({
            api: 'IDirectInputDevice_GetDeviceState', thisPtr: expected.thisPtr + 8,
            buffer: expected.buffer + 16, countPtr: expected.countPtr + 4,
            returnAddress: expected.returnAddress + 1, requested: 0, objectsSize: 0,
          })) {
            try { readCompletion(ex, workerData.memory, { ...expected, [name]: value }); }
            catch (_) { failures.push(name); }
          }
          parentPort.postMessage({ id, failures });
          return;
        }
        const completion = readCompletion(ex, workerData.memory, { ...expected, requested });
        parentPort.postMessage({ id, completion, threadId });
        return;
      }
      parentPort.postMessage({ id, hr: rd(e.reg()), threadId });
    } catch (error) { parentPort.postMessage({ id, error: String(error.stack) }); }
  });
  parentPort.postMessage({ kind: 'ready', threadId });
} else {
  // Use the existing production WAT extraction, renderer prototype and host
  // imports. It supplies no alternate keyboard buffering implementation.
  const run = require('./helpers/directinput-independent-accept-oct27');
  run(String.raw`
(async () => {
  const { Worker, threadId } = require('worker_threads');
  const { requireConsumedPulse } = require('../tools/mw3-keyboard-completion');
  const RPC = require('../lib/guest-rpc');
  const sigs = require('../lib/host-import-sigs.generated.json').sigs;
  const selected = Object.fromEntries(WebAssembly.Module.imports(module_)
    .filter(x => x.kind === 'function').map(x => [x.name, sigs[x.name]]));
  e.unacquire(obj);
  const property = 0x23000;
  [20, 16, 0, 0, 128].forEach((value, i) => wr(e.g2w(property) + 4 * i, value));
  e.setBufferSize(obj, property);
  assert.equal(rd(e.reg()), 0);
  const expected = { api: 'IDirectInputDevice_GetDeviceData', thisPtr: obj,
    buffer: buf, countPtr: count, returnAddress: 0x4f76c8, requested: 128,
    objectsBase: e.entry(), objectsSize: 32 };
  const broker = RPC.createMainBroker(memory, imports.host, selected, {});
  const worker = new Worker(${JSON.stringify(__filename)}, {
    execArgv: [], workerData: { module: module_, memory, selected, expected },
  });
  let next = 0, readyResolve, readyReject;
  const pending = new Map();
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  worker.on('error', error => { readyReject(error); for (const p of pending.values()) p.reject(error); });
  worker.on('message', m => {
    if (m.kind === 'ready') return readyResolve(m);
    if (m.kind === 'rpc') { assert.equal(m.message.t, 'rpc'); assert(broker.serveRpc(m.message.slot)); return; }
    const p = pending.get(m.id); if (!p) return;
    pending.delete(m.id); if (m.error) p.reject(Error(m.error)); else p.resolve(m);
  });
  const request = (command, flags = 0, requested = 128) => new Promise((resolve, reject) => {
    const id = ++next; pending.set(id, { resolve, reject }); worker.postMessage({ id, command, flags, requested });
  });
  const deadline = setTimeout(() => {
    const error = Error('bounded Worker deadline'); readyReject(error);
    for (const p of pending.values()) p.reject(error); worker.terminate();
  }, 15000);
  let releaseTimer;
  const timeline = [], completions = [];
  const edge = down => {
    renderer[down ? 'handleKeyDown' : 'handleKeyUp'](53, { code: 'Digit5' });
    timeline.push({ down, at: Date.now(), physical: renderer.peekKeyDownState(53) });
    broker.publish({});
  };
  try {
    const identity = await ready;
    assert.notEqual(identity.threadId, threadId);
    assert.equal((await request('acquire')).hr, 0);
    assert.equal((await request('poll')).completion.count, 0);
    // Arm UP before DOWN. It runs on the main event loop even while the
    // guest OS Worker is parked in a synchronous production RPC call.
    const released = new Promise(resolve => {
      releaseTimer = setTimeout(() => { edge(false); resolve(); }, 60);
    });
    edge(true);
    // Deliberately wait until both edges have arrived before the first poll:
    // immediate GetDeviceState would see only zero here, losing the pulse.
    await released;
    assert.equal(renderer.peekKeyDownState(53), 0);
    assert.deepEqual(renderer.inputQueue.map(x => x.msg), [0x100, 0x101]);
    const peek = (await request('poll', 1)).completion;
    const again = (await request('poll', 1)).completion;
    assert.deepEqual(peek.records, again.records);
    assert.deepEqual(peek.records.map(r => [r.offset, r.data]), [[6, 128], [6, 0]]);
    assert.throws(() => requireConsumedPulse([peek, again]), /consumed press/);
    const negatives = await request('negative', 1);
    assert.equal(negatives.failures.length, 7);
    // Match MW3's normal 128-record read, and its one-record drain variant.
    completions.push((await request('poll', 0, 1)).completion);
    completions.push((await request('poll', 0, 128)).completion);
    assert.deepEqual(completions.map(c => c.count), [1, 1]);
    const pulse = requireConsumedPulse(completions);
    assert.equal(pulse.release.sequence, (pulse.press.sequence + 1) >>> 0);
    assert(pulse.release.timestamp >= pulse.press.timestamp);
    assert.equal((await request('poll')).completion.count, 0);
    assert.throws(() => requireConsumedPulse([completions[0]]), /consumed press/);
    assert.throws(() => requireConsumedPulse([{ ...peek, flags: 0, eax: 1 }]), /consumed press/);
    assert.throws(() => requireConsumedPulse([completions[0],
      { ...completions[1], thisPtr: obj + 8 }]), /consumed press/);
    console.log(JSON.stringify({ group: 'MW3 buffered keyboard production path',
      worker: identity, expected, timeline, peek, completions, pulse,
      rejected: negatives.failures, pass: true,
      limitation: 'synthetic COM object and fragment module; actual OS Worker RPC and production WAT/JS; no original consumption claim' }));
  } finally {
    clearTimeout(releaseTimer); clearTimeout(deadline); await worker.terminate();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
`);
}
