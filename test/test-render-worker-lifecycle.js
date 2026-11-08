'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { WorkerLink, GuestThreadHost } = require('../lib/guest-thread-host');
const { SharedPacketPool, SubmissionQueue } = require('../lib/render-worker');

function testSharedPacketPool() {
  const pool = new SharedPacketPool(), buffer = new SharedArrayBuffer(256);
  const starts = [0, 32, 64];
  pool.register('gl', buffer, starts, 32);
  starts[0] = 128; // caller cannot change the registered layout
  assert.strictEqual(pool.register('gl', buffer, [64, 0, 32], 32), pool);
  assert.throws(() => pool.register('gl', buffer, [128], 32), /retire/);
  assert.throws(() => pool.register('d3d', buffer, [16], 32), /another owner/);
  pool.register('d3d', buffer, [96], 32); // touching boundaries do not overlap
  for (const offsets of [[0, 16], [0, 0]])
    assert.throws(() => new SharedPacketPool().register(1, buffer, offsets, 32), /overlapping/);
  for (const offsets of [[-1], [225], [0.5], [NaN], [Number.MAX_SAFE_INTEGER], []])
    assert.throws(() => new SharedPacketPool().register(1, buffer, offsets, 32));
  for (const capacity of [0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER])
    assert.throws(() => new SharedPacketPool().register(1, buffer, [0], capacity));
  assert.throws(() => pool.register(2, new ArrayBuffer(256), [0], 32), /shared/);
  assert.throws(() => pool.claim('missing', 0, 1), /unregistered/);
  for (const [offset, bytes] of [[1, 1], [128, 1], [0, 33], [0, -1], [0, 0.5], [0, NaN]])
    assert.throws(() => pool.claim('gl', offset, bytes), /invalid/);
  const leases = [0, 32, 64].map(offset => pool.claim('gl', offset, 32));
  for (const offset of [0, 32, 64]) assert.throws(() => pool.claim('gl', offset, 1), /busy/);
  assert.throws(() => pool.unregister('gl'), /active/);
  assert(Object.isFrozen(leases[0]));
  assert.strictEqual(leases[0].buffer, buffer, 'lease does not copy shared storage');
  new Uint8Array(buffer)[3] = 91;
  assert.equal(new Uint8Array(leases[0].buffer, leases[0].byteOffset, leases[0].bytes)[3], 91);
  assert.throws(() => pool.release({ ...leases[0] }), /invalid/);
  assert.throws(() => new SharedPacketPool().release(leases[0]), /invalid/);
  pool.release(leases[0]);
  const next = pool.claim('gl', 0, 8);
  assert.throws(() => pool.release(leases[0]), /stale/);
  assert.throws(() => pool.claim('gl', 0, 1), /busy/, 'old release cannot free a newer lease');
  pool.release(next);
  pool.release(leases[1]); pool.release(leases[2]);
  pool.unregister('gl');
  pool.register('gl', buffer, [128], 32);
  assert.throws(() => pool.release(leases[0]), /stale/);
  assert.throws(() => pool.claim('gl', 0, 1), /invalid/);
  const empty = pool.claim('gl', 128, 0);
  pool.release(empty); pool.unregister('gl');
  pool.unregister('d3d');
  assert.throws(() => pool.unregister('d3d'), /unregistered/);
  // Distinct shared allocations may use the same byte offsets.
  pool.register(1, buffer, [0], 32);
  pool.register(2, new SharedArrayBuffer(256), [0], 32);
  // Failed overlap registration is atomic; its unused span was not retained.
  assert.throws(() => pool.register(3, buffer, [0, 192], 32), /another owner/);
  pool.register(3, buffer, [192], 32);
}
testSharedPacketPool();
function testObservationQueueCapacity() {
  const { Manager } = require('../lib/render-worker');
  const messages = [];
  const manager = new Manager({maxQueuedCommands: 1, workerFactory: () => ({
    on() {}, postMessage(message) { messages.push(message); }, terminate() {}
  })});
  const endpoint = manager.createEndpoint({api: 'legacy'});
  const arm = {t: 'legacy-producer-observation', action: 'arm', options: {
    ownerGeneration: 'capacity-regression', maxRecords: 4096,
    writerEpochBuffer: new SharedArrayBuffer(16),
    surfaceVersionBuffer: new SharedArrayBuffer(4096 * 65536)
  }};
  endpoint.postMessage(arm);
  assert(manager.queuedBytes > 0 && manager.queuedBytes < 1024,
    'bounded shared observation state charges handles, not 256MiB payload');
  const posted = messages.at(-1);
  assert.strictEqual(posted.message, arm, 'accounting never substitutes the actual state buffers');
  assert.throws(() => endpoint.postMessage(arm), /capacity/, 'command credits still bound control messages');
  manager._receive({t: 'render-done', transportId: posted.transportId});
  assert.equal(manager.queuedBytes, 0);
  assert.throws(() => endpoint.postMessage({...arm, options: {...arm.options, maxRecords: 4095}}), /capacity/,
    'mismatched journal receives no control-state exemption');
  assert.throws(() => endpoint.postMessage({...arm, payload: arm.options.surfaceVersionBuffer}), /capacity/,
    'an extra shared payload remains charged even if it aliases control state');
  assert.throws(() => endpoint.postMessage({t: 'batch', bytes: arm.options.surfaceVersionBuffer}), /capacity/,
    'ordinary shared command packets keep their byte cap');
  assert.throws(() => endpoint.postMessage({t: 'batch', bytes: new Uint8Array(arm.options.surfaceVersionBuffer)}), /capacity/);
  assert.throws(() => endpoint.postMessage({...arm, options: {...arm.options,
    surfaceVersionBuffer: new ArrayBuffer(33 * 1024 * 1024)}}), /capacity/,
    'copied storage cannot claim a shared-state exemption');
  assert.equal(manager.pending.size, 0, 'refused packets consume no queue credit');
}
testObservationQueueCapacity();

const sandbox = { console, URLSearchParams, setTimeout, clearTimeout };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8') +
  '\n;globalThis.WineAssembly = WineAssembly;', sandbox);
const deferred = () => {
  let resolve; const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};

(async () => {
  // One contract for atomic producers and asynchronous page brokers. No
  // snapshot may run while credits are exhausted, even for a smaller packet
  // behind an exclusive oversized packet.
  const queue = new SubmissionQueue(3), first = deferred(), exclusive = deferred(), last = deferred();
  const snapshots = [];
  const packet = (name, done) => () => { snapshots.push(name); return {value: 1, done}; };
  assert.equal(queue.admit(packet('gl', first.promise), 2), 1);
  const large = queue.admit(packet('glide-large', exclusive.promise), 3);
  const small = queue.admit(packet('software', last.promise));
  assert.deepEqual(snapshots, ['gl']);
  const closing = queue.close(); let closed = false; closing.then(() => { closed = true; });
  await assert.rejects(queue.admit(packet('late', Promise.resolve())), /closed/);
  first.resolve(); assert.equal(await large, 1);
  assert.deepEqual(snapshots, ['gl', 'glide-large']); assert(!closed);
  exclusive.resolve(); assert.equal(await small, 1);
  assert.deepEqual(snapshots, ['gl', 'glide-large', 'software']); assert(!closed);
  last.resolve(); await closing; assert.equal(queue.used, 0);

  const atomic = new SubmissionQueue(1), ticket = atomic.reserve();
  assert.throws(() => atomic.reserve(), /full/);
  atomic.complete(ticket); const next = atomic.reserve();
  assert.throws(() => atomic.complete(ticket), /stale/);
  assert.equal(atomic.used, 1); atomic.complete(next);
  assert.throws(() => atomic.admit(() => { throw new Error('snapshot failed'); }), /snapshot failed/);
  assert.equal(atomic.used, 0, 'validation before publication returns credit');

  const failed = new SubmissionQueue(1), error = new Error('consumer failed');
  let reject;
  const execution = new Promise((_, no) => { reject = no; });
  assert.equal(failed.admit(packet('failed', execution)), 1);
  const waiting = failed.admit(() => { throw new Error('must not snapshot'); });
  reject(error); await assert.rejects(waiting, /consumer failed/);
  assert.equal(failed.used, 1, 'failure does not prove reader retirement');
  await assert.rejects(failed.close(), /consumer failed/);
  await assert.rejects(failed.admit(() => {}), /closed|consumer failed/);

  const bounded = new SubmissionQueue(1, 1), held = deferred();
  bounded.admit(packet('held', held.promise));
  const blocked = bounded.admit(packet('blocked', Promise.resolve()));
  await assert.rejects(bounded.admit(() => {}), /waiter limit/);
  held.resolve(); await blocked; await bounded.close();

  const ordered = new SubmissionQueue(2), fenceGate = deferred(), eventsInOrder = [];
  const before = ordered.ordered(() => ordered.execute(() => { eventsInOrder.push('draw'); }));
  const fence = ordered.ordered(() => ordered.execute(async () => {
    eventsInOrder.push('readback'); await fenceGate.promise; eventsInOrder.push('copied');
  }));
  const after = ordered.ordered(() => ordered.execute(() => { eventsInOrder.push('next'); }));
  await before; await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(eventsInOrder, ['draw', 'readback']);
  fenceGate.resolve(); await fence; await after;
  assert.deepEqual(eventsInOrder, ['draw', 'readback', 'copied', 'next']);

  const opening = new SubmissionQueue(1), openGate = deferred();
  const open = opening.execute(async () => { await openGate.promise; throw new Error('open failed'); });
  const closeDuringOpen = opening.close();
  openGate.resolve();
  await assert.rejects(open, /open failed/);
  await assert.rejects(closeDuringOpen, /open failed/, 'close also observes operations without packet tickets');

  const original = Object.fromEntries(['start', 'initGuestThread', 'callExport'].map(k => [k, WorkerLink.prototype[k]]));
  const initializing = deferred(), initGate = deferred(), settings = [];
  try {
    WorkerLink.prototype.start = async function () { this.enabled = this.d3dimLazySync; };
    WorkerLink.prototype.initGuestThread = async function () {
      if (this.slot === 1) { initializing.resolve(); await initGate.promise; }
      return {};
    };
    WorkerLink.prototype.callExport = async function (name, value) {
      assert.equal(name, 'd3dim_lazy_enable'); this.enabled = !!value; settings.push([this.slot, value]);
    };
    const host = new GuestThreadHost({ sharedRenderWorker: true, d3dimGpu: true });
    assert.equal(host.d3dimLazySync, true);
    const spawning = host.spawnThread({ tid: 1 });
    await initializing.promise;
    await host.setLazySync(false);
    initGate.resolve();
    const first = await spawning;
    assert.equal(first.enabled, false, 'opt-out during spawn is applied before the thread can run');
    const second = await host.spawnThread({ tid: 2 });
    assert.equal(second.enabled, false, 'future threads inherit opt-out');
    await host.setLazySync(true);
    assert(first.enabled && second.enabled, 'live switch reaches every existing guest thread');
    host.d3dimGpu = false;
    await host.setLazySync(true);
    assert(!first.enabled && !second.enabled, 'software remains eager');
    host.d3dimGpu = true; host.sharedRenderWorker = false;
    await host.setLazySync(true);
    assert(!first.enabled && !second.enabled, 'private executors remain eager');
  } finally { Object.assign(WorkerLink.prototype, original); }
  const portReady = deferred(), events = [];
  const endpoint = { ready: Promise.resolve(), addEventListener() {},
    postMessage(message) { events.push(message.t); },
    terminate() { events.push('close'); return Promise.resolve(); } };
  const link = new WorkerLink({ createRenderEndpoint: () => portReady.promise });
  link.worker = { postMessage() {}, terminate() { events.push('guest-stop'); } };
  link._forwardRenderLegacy({ t: 'init', control: new SharedArrayBuffer(64) });
  await Promise.resolve(); // Endpoint creation is in flight when the producer exits.
  link._forwardRenderLegacy({ t: 'batch' });
  const retired = link.stop();
  assert.strictEqual(link.stop(), retired, 'endpoint retirement is idempotent');
  portReady.resolve(endpoint);
  await retired;
  assert.deepStrictEqual(events, ['guest-stop', 'init', 'batch', 'close'],
    'already accepted batches must be posted before retiring only this endpoint');

  const logs = [], marker = {}, wine = Object.create(sandbox.WineAssembly.prototype);
  let stopped = 0;
  wine.memory = marker;
  wine._renderWorkerPreparationTimeoutMs = 10;
  wine.hostCtx = { closeGlide: () => new Promise(() => {}) };
  wine.logToUI = text => logs.push(text);
  wine._renderWorkerManager = { async stop() {
    stopped++;
    throw new Error('render worker shutdown timed out; heap not reclaimed');
  } };
  wine._renderWorkerManagerReady = Promise.resolve(wine._renderWorkerManager);
  wine._releaseGuestMemory();
  await wine._renderWorkerRetirement;
  assert.strictEqual(stopped, 1, 'unresponsive endpoint cannot prevent manager shutdown');
  assert.strictEqual(wine.memory, marker, 'failed retirement must retain live allocator memory');
  assert.notStrictEqual(wine._renderWorkerRetired, true);
  assert(logs.some(text => /endpoint drain timed out/.test(text)));
  assert.match(wine._renderWorkerRetirementError.message, /heap not reclaimed/);
  console.log('PASS producer endpoint drain and bounded process retirement');
})().catch(error => { console.error(error); process.exitCode = 1; });
