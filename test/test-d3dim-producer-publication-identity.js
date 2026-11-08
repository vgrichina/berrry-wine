#!/usr/bin/env node
'use strict';

// Production association qualification, with real WAT DIB swaps and real
// canonical decode/composition. The transport and fence releases are controlled;
// this is not a browser/game/GPU throughput test or a replacement Join model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { Worker } = require('node:worker_threads');
const { compileSrcWasm } = require('./compile-src');
const { BASE } = require('../lib/region-map.generated');
const { createHostImports } = require('../lib/host-imports');
const { Win98Renderer } = require('../lib/renderer');
const { createCanvas } = require('../lib/raster-canvas');
const { Manager, WriterEpoch, SurfaceVersionJournal, SurfacePublicationJoin, observeInstance } = require('../lib/render-worker');
const { WorkerLink, GuestThreadHost } = require('../lib/guest-thread-host');
const { ThreadManager } = require('../lib/thread-manager');
const { Encoder } = require('../lib/d3d-command-stream');
const RPC = require('../lib/guest-rpc');

async function main() {
  require('./helpers/surface-journal-browser').checkSurfaceJournal(require('../lib/render-worker'));
  const hostSource = fs.readFileSync(require.resolve('../host'), 'utf8');
  const wrapper = hostSource.slice(hostSource.indexOf("    for (const [name, fn] of Object.entries(h))"),
    hostSource.indexOf("    return { host: h, gdi: base.gdi", hostSource.indexOf("    for (const [name, fn] of Object.entries(h))")));
  const enc = new TextEncoder(), string = value => [value.length, ...enc.encode(value)];
  const section = (id, data) => [id, data.length, ...data];
  const importModule = new WebAssembly.Module(Uint8Array.from([0,97,115,109,1,0,0,0,
    ...section(1,[1,0x60,0,1,0x7f]),
    ...section(2,[1,...string('host'),...string('probe'),0,0]),
    ...section(7,[1,...string('probe'),0,0])]));
  for (const armed of [false, true]) {
    let calls = 0, receiver, throwNext = false;
    const failure = Error('same import exception');
    const originalPromise = Promise.resolve(37);
    const expected = {}, h = { probe: function() { 'use strict'; calls++; receiver = this;
      if (throwNext) throw failure; return 37; }, asyncResult: () => originalPromise };
    const self = { _d3dimWriterObservation: armed ? new WriterEpoch() : null };
    vm.runInNewContext("'use strict';\n" + wrapper, { h, self, RenderWorker: require('../lib/render-worker') });
    const wasm = new WebAssembly.Instance(importModule, { host: h });
    assert.equal(wasm.exports.probe(), 37); assert.equal(receiver, undefined); assert.equal(calls, 1);
    assert.equal(h.probe(), 37); assert.equal(receiver, h); assert.equal(calls, 2);
    assert.equal(h.probe.call(expected), 37); assert.equal(receiver, expected); assert.equal(calls, 3);
    const result = h.asyncResult();
    if (!armed) assert.equal(result, originalPromise, 'unarmed import preserves exact promise return');
    assert.equal(await result, 37);
    throwNext = true;
    assert.throws(() => wasm.exports.probe(), error => error === failure);
    assert.equal(calls, 4); assert.equal(self._d3dimHostWritesInFlight, 0);
    if (armed) assert.equal(self._d3dimWriterObservation.snapshot(), null);
  }
  const orderEpoch = new WriterEpoch();
  let invalidateCalls = 0;
  const invalidate = orderEpoch.invalidateVersions.bind(orderEpoch);
  orderEpoch.invalidateVersions = () => {
    assert.equal(orderEpoch.snapshot(), null, 'host version changes only inside writer exclusion');
    invalidateCalls++; invalidate();
  };
  require('../lib/render-worker').observeHostWrite(orderEpoch, () => 19, undefined, []);
  assert.equal(invalidateCalls, 1);
  const binary = compileSrcWasm();
  const module = new WebAssembly.Module(binary);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 32768, shared: true });
  const imports = { host: { memory } };
  for (const entry of WebAssembly.Module.imports(module)) {
    if (entry.kind === 'function') imports[entry.module][entry.name] = () => 0;
  }
  const native = new WebAssembly.Instance(module, imports);
  const sent = [], callbacks = [];
  const c = { performance, console, WebAssembly, ArrayBuffer, Uint8Array, DataView, Map, Set, Atomics, Promise,
    require: name => {
      if (name === './render-worker') return require('../lib/render-worker');
      if (name === './region-map.generated') return require('../lib/region-map.generated');
      assert.equal(name, 'worker_threads');
      return { parentPort: { on() {}, postMessage(message) { sent.push(structuredClone(message)); } } };
    } };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(require.resolve('../lib/d3d-render-worker'), 'utf8') + `
    globalThis.install=(native,mem)=>{
      instance=native; memory=mem; sharedMode=true; initializedImage=0x400000;
      stateGuest=1; verticesGuest=2; descriptorGuest=3;
    };
    globalThis.dispatch=sharedMessage;
    globalThis.entry=id=>endpoints.get(id);
  `, c);
  c.install(native, memory);
  const dispatch = (endpointId, message) => c.dispatch({ t: 'render-message', endpointId, message });
  const open = async id => {
    await c.dispatch({ t: 'render-open', endpointId: id, options: { api: 'legacy', backend: 'software' } });
    const buffer = new SharedArrayBuffer(64), control = new SharedArrayBuffer(64);
    const view = new DataView(buffer);
    for (let ordinal = 0; ordinal < 2; ordinal++) {
      const offset = ordinal * 32;
      view.setUint32(offset, 32, true);
      view.setUint32(offset + 4, front, true);
      view.setUint32(offset + 8, back, true);
      view.setUint32(offset + 28, 1, true);
    }
    await dispatch(id, { t: 'init', control, buffers: [buffer] });
    return { buffer, control: new Int32Array(control), view };
  };
  const arm = (id, maxRecords = 16) => dispatch(id, { t: 'legacy-producer-observation', action: 'arm',
    options: { ownerGeneration: 'identity-test-process-1', maxRecords } });
  const read = async id => {
    await dispatch(id, { t: 'legacy-producer-observation', action: 'read' });
    return sent.at(-1).message.receipt;
  };
  const front = BASE.DX_OBJECTS + 32 * 7, back = front + 32;
  const dibA = BASE.DIB_BACKING_BASE, dibB = dibA + 64;
  const dv = new DataView(memory.buffer), bytes = new Uint8Array(memory.buffer);
  const seed = (entry, dib) => {
    dv.setUint32(entry, 2, true);
    for (const [offset, value] of [[12, 2], [14, 2], [16, 32], [18, 8]]) dv.setUint16(entry + offset, value, true);
    dv.setUint32(entry + 20, dib, true);
  };
  seed(front, dibA); seed(back, dibB);
  const paint = (dib, red) => { for (let i = 0; i < 4; i++) bytes.set([0, 0, red, 0], dib + i * 4); };
  paint(dibA, 17); paint(dibB, 34);
  const storage = await open(1);
  const batch = (seq, commands = 1) => ({ t: 'batch', index: 0, bytes: commands * 32, commands, seq, imageBase: 0x400000 });
  // Unarmed execution performs the real swap and emits no observation.
  await dispatch(1, batch(1));
  assert.equal(dv.getUint32(front + 20, true), dibB);
  assert.equal(sent.filter(x => x.message?.t === 'legacy-producer-completed').length, 0);
  await arm(1);
  let release;
  c.entry(1).adapter = { fenceFlip: () => new Promise(resolve => { release = resolve; }) };
  const pending = dispatch(1, batch(2, 2));
  assert.equal(c.entry(1).producerObservation.records.length, 0, 'held first fence emits no completion');
  assert.equal(Atomics.load(storage.control, 1), 1, 'held batch cannot acknowledge completion');
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.entry(1).producerObservation.records.length, 1, 'only first released fence completed');
  const first = structuredClone(c.entry(1).producerObservation.records[0]);
  assert.equal(dv.getUint32(front + 20, true), dibA, 'actual WAT export swapped first completed producer');
  release(); await pending;
  const receipt = await read(1);
  assert.deepEqual(receipt.records.map(x => [x.batch, x.ordinal]), [[2, 0], [2, 1]]);
  assert.equal(receipt.records[0].front, receipt.records[1].front);
  assert.equal(receipt.qualified, false);
  assert.equal(receipt.records[0].consumedSurfaceVersion, null);
  assert.equal(receipt.records[0].completed.domain, receipt.records[1].completed.domain);

  // Callback delivery uses the actual Manager/Endpoint receive implementation.
  // A later delivery window cannot change completion time or producer identity.
  const fakeWorker = { on() {}, postMessage() {}, terminate() {} };
  const manager = new Manager({ workerFactory: () => fakeWorker });
  const port = manager.createEndpoint({ api: 'legacy' });
  port.addEventListener('message', event => callbacks.push(event.data));
  const deliver = record => manager._receive({ t: 'render-event', endpointId: port.id,
    message: { t: 'legacy-producer-completed', record } });
  const windowBoundary = performance.now();
  await new Promise(resolve => setTimeout(resolve, 15));
  deliver(first);
  assert(callbacks[0].callbackReceipt.atMs > windowBoundary);
  assert.deepEqual(callbacks[0].record.completed, first.completed);
  assert.equal(callbacks[0].callbackReceipt.domain, 'page.performance');
  assert.equal(callbacks[0].record.completed.domain.startsWith('render-worker.performance:'), true);
  deliver(first);
  assert.deepEqual(callbacks[1].record, first, 'duplicate delivery keeps original identity; no presentation row is manufactured');

  // Duplicate source completion must retain first source timestamp. Rendering
  // is intentionally not deduplicated by a passive observer.
  c.entry(1).adapter = null;
  await dispatch(1, batch(3));
  const sourceTime = (await read(1)).records.at(-1).completed.atMs;
  await dispatch(1, batch(3));
  const duplicate = await read(1);
  assert.equal(duplicate.duplicates, 1);
  assert.equal(duplicate.records.length, 3);
  assert.equal(duplicate.records.at(-1).completed.atMs, sourceTime);
  await dispatch(1, batch(2));
  assert.equal((await read(1)).reason, 'stale-or-conflicting-completion');

  // Real canonical surface: an upload's version and named pointer do NOT
  // identify the bytes that the production lazy rebind subsequently consumes.
  const renderer = new Win98Renderer(createCanvas(2, 2));
  renderer.scheduleRepaint = () => {};
  renderer.createWindow(0x77, 0x90000000, 0, 0, 2, 2, '', 0);
  const context = { getMemory: () => memory.buffer, exports: {}, renderer };
  const { host, gdi } = createHostImports(context);
  const sid = 0x200007;
  seed(front, dibA); seed(back, dibB); paint(dibA, 17); paint(dibB, 34);
  assert.equal(host.gdi_surface_create(sid, 2, 2, 32, dibA, 8, 1, 0, 0), 1);
  let presentation = gdi.surfacePresentations.get(sid);
  assert.equal(host.gdi_surface_attach(sid, 0x77), 1);
  host.gdi_surface_upload(sid, 0, 0, 2, 2);
  const uploadedVersion = presentation.version;
  const transfers = [], publications = [];
  renderer.observePresentationTransfer = (src, dst, geometry) => transfers.push({ src, dst, geometry });
  renderer.observePresentationPublication = (display, sequence) => publications.push({ sequence,
    red: display.output.getContext('2d').getImageData(0, 0, 1, 1).data[0] });
  // Use the complete actual repaint path, including scene selection,
  // canonical flush, composition and display publication.
  await arm(1);
  await dispatch(1, batch(4));
  renderer.repaint();
  assert.equal(presentation.version, uploadedVersion, 'front-rebind changed consumed bytes without a new upload version');
  assert.equal(presentation.bitsWa, dibB);
  assert.equal(publications.at(-1).red, 34, 'production composition consumed the later front, not uploaded producer A');
  const rebound = { uploadedVersion, afterVersion: presentation.version, uploadedDib: dibA,
    consumedDib: presentation.bitsWa, red: publications.at(-1).red };
  renderer.repaint();
  assert.equal(publications.length, 2, 'repeated publication is still not a new producer');
  await dispatch(1, batch(5, 2));
  const beforeCoalescedPublication = publications.length;
  renderer.repaint();
  assert.equal(publications.length - beforeCoalescedPublication, 1);
  const coalesced = await read(1);
  assert.equal(coalesced.records.length, 3, 'three actual completed swaps reached only two distinct publication opportunities');
  assert.deepEqual(coalesced.records.slice(1).map(x => [x.batch, x.ordinal]), [[5, 0], [5, 1]]);
  assert.equal(presentation.version, uploadedVersion);
  // In-place overwrite retains BOTH the object DIB pointer and upload version.
  // Marking dirty is an existing canonical operation, not a new upload/version.
  paint(dibB, 51); presentation.surface.markDirty(0, 0, 2, 2);
  renderer.repaint();
  assert.equal(presentation.version, uploadedVersion);
  assert.equal(presentation.bitsWa, dibB);
  assert.equal(publications.at(-1).red, 51);
  // ABA: same bytes and pointer can reappear after a different surface version.
  paint(dibB, 34); presentation.surface.markDirty(0, 0, 2, 2);
  renderer.repaint();
  assert.equal(publications.at(-1).red, 34);
  assert.equal(presentation.version, uploadedVersion);

  // Two real completed producers with equal pixels must remain distinguishable.
  await dispatch(1, { t: 'legacy-producer-observation', action: 'stop' });
  await arm(1);
  paint(dibA, 34); paint(dibB, 34);
  await dispatch(1, batch(6, 2));
  const identical = await read(1);
  assert.deepEqual(identical.records.map(x => [x.batch, x.ordinal]), [[6, 0], [6, 1]]);
  assert.equal(identical.records.every(x => !x.qualified), true);
  // The unsupported synchronous route is explicitly rejected by observation;
  // its existing renderer operation still runs with its original result.
  c.entry(1).adapter = { execute: () => 1, destroy() {} };
  await dispatch(1, { t: 'legacy-call', opcode: 0x20003, wa: 0, seq: 7 });
  assert.equal((await read(1)).reason, 'unsupported-synchronous-legacy-call');
  assert.equal(Atomics.load(storage.control, 11), 1);
  const oldGeneration = identical.owner.generation;
  await c.dispatch({ t: 'render-close', endpointId: 1 });
  await open(1); await arm(1, 1); await dispatch(1, batch(1));
  const replacement = await read(1);
  assert.notEqual(replacement.owner.generation, oldGeneration);
  assert.equal(replacement.records.length, 1);
  assert.equal(replacement.reason, 'record-limit');

  // Exercise the actual WAT owed-present branches, actual Encoder snapshot,
  // shared endpoint replay and RPC upload with the explicit request installed.
  // Test exports expose existing functions; they do not implement a Join.
  const bridgeBinary = compileSrcWasm((file, source) => {
    if (file === '03-registers.wat') {
      const store = '(i32.store (local.get $wa) (local.get $v))\n        (call $page_watch_write_one (local.get $wa))';
      assert(source.includes(store));
      // Pause the real gs32 same-page branch at its actual post-store,
      // pre-notification boundary. No production store ordering is changed.
      return source.replace(store, `(i32.store (local.get $wa) (local.get $v))
        (if (global.get $identity_pause_wa) (then
          (i32.atomic.store offset=4 (global.get $identity_pause_wa) (i32.const 1))
          (drop (memory.atomic.notify (i32.add (global.get $identity_pause_wa) (i32.const 4)) (i32.const 1)))
          (drop (memory.atomic.wait32 (global.get $identity_pause_wa) (i32.const 0) (i64.const 10000000000)))))
        (call $host_log_i32 (i32.const 0x57525031))
        (call $page_watch_write_one (local.get $wa))`);
    }
    return file === '13-exports.wat' ? source + `
    (global $identity_pause_wa (mut i32) (i32.const 0))
    (func (export "identity_palette") (param $wa i32)
      (call $dx_exclusive_set (i32.const 1))
      (call $dx_primary_pal_set (local.get $wa)))
    (func (export "identity_retire") (param $wa i32) (call $dx_free (local.get $wa)))
    (func (export "identity_pause_at") (param $wa i32) (global.set $identity_pause_wa (local.get $wa)))
    (func (export "identity_queue") (param $f i32) (param $b i32) (param $d i32) (result i32)
      (global.set $d3dim_flip_desc (local.get $d))
      (global.set $d3dim_worker_pending (i32.const 1))
      (call $d3dim_worker_try_flip (local.get $f) (local.get $b)))
    (func (export "identity_owed") (call $d3dim_worker_fence))
    (func (export "identity_gpu_owed") (call $d3dim_gpu_present_owed))
    (func (export "identity_setup")
      (call $dx_coop_hwnd_set (i32.const 0x77))
      (call $dx_exclusive_set (i32.const 1)))
    (func (export "identity_overflow") (global.set $d3dim_flip_serial (i32.const -1)))
  ` : source;
  });
  const bridgeModule = new WebAssembly.Module(bridgeBinary), bridgeImports = { host: { memory } };
  for (const entry of WebAssembly.Module.imports(bridgeModule)) {
    if (entry.kind === 'function') bridgeImports[entry.module][entry.name] = () => 0;
  }
  let encoder;
  const transport = [], rpcMessages = [], presentNotices = [];
  const sigs = {
    dx_trace: { params: ['i32', 'i32', 'i32', 'i32', 'i32'], results: [] },
    gdi_surface_upload: { params: ['i32', 'i32', 'i32', 'i32', 'i32'], results: ['i32'] },
  };
  const broker = RPC.createMainBroker(memory, {
    dx_trace: (...args) => presentNotices.push(structuredClone(args)),
    gdi_surface_upload: host.gdi_surface_upload,
  }, sigs);
  const rpc = RPC.createWorkerImports(memory, sigs,
    message => rpcMessages.push(structuredClone(message)), { slot: 3, dxTraceLocal: true });
  const rpcHost = rpc.imports.host;
  bridgeImports.host.gpu_gl_call = (...args) => encoder.call(...args);
  bridgeImports.host.dx_trace = rpcHost.dx_trace;
  bridgeImports.host.gdi_surface_upload = rpcHost.gdi_surface_upload;
  bridgeImports.host.gdi_surface_create = host.gdi_surface_create;
  bridgeImports.host.gdi_surface_attach = host.gdi_surface_attach;
  let reentrantObserver = null;
  bridgeImports.host.log_i32 = marker => reentrantObserver?.(marker) || 0;
  const bridge = new WebAssembly.Instance(bridgeModule, bridgeImports).exports;
  bridge.identity_setup();
  c.entry(1).adapter = null;
  const portTransport = { postMessage(message) {
    if (message.t === 'init') {
      // This boundary is synchronous up to READY in the production dispatcher.
      dispatch(1, message);
    } else transport.push(structuredClone(message));
  } };
  encoder = new Encoder({ memory, guestToWasm: p => p, getImageBase: () => 0x400000,
    workerFactory: () => portTransport });
  assert(encoder.ready());
  await dispatch(1, { t: 'legacy-producer-observation', action: 'stop' });
  native.exports.heap_init(0x3000000);
  const owedEpoch = new WriterEpoch();
  const owedJournal = new SurfaceVersionJournal(new SharedArrayBuffer(16 * 65536));
  await dispatch(1, { t: 'legacy-producer-observation', action: 'arm', options: {
    ownerGeneration: 'actual-owed-process', maxRecords: 16,
    writerEpochBuffer: owedEpoch.buffer, surfaceVersionBuffer: owedJournal.buffer } });
  const owedJoin = new SurfacePublicationJoin({ epoch: owedEpoch, journal: owedJournal, memory,
    ownerScope: 'actual-owed-process', workerSlot: 3, endpointId: 1, renderer });
  context.d3dimPublicationJoin = owedJoin;
  const coveredBridge = observeInstance({ exports: bridge }, () => owedEpoch).exports;
  // The helper exposes an internal routine called by production run(). It is
  // not a standalone production export; bracket that same internal entry here.
  coveredBridge.identity_owed = (...args) => require('../lib/render-worker').observeCall(
    owedEpoch, bridge.identity_owed, undefined, args);
  const descriptor = dibB + 64;
  seed(front, dibA); seed(back, dibB);
  assert.equal(coveredBridge.identity_queue(front, back, descriptor), 1);
  const requestSerial = dv.getUint32(descriptor + 8, true);
  assert.equal(requestSerial, 1);
  const queued = transport.shift();
  const capturedHeader = new DataView(encoder.buffers[queued.index].buffer);
  assert.equal(capturedHeader.getUint32(12, true), descriptor);
  assert.equal(capturedHeader.getUint32(16, true), requestSerial);
  // Scratch can be overwritten before fence/completion/present. Both paths
  // must retain the captured serial rather than rereading that scratch.
  dv.setUint32(descriptor + 8, 999, true);
  await dispatch(1, queued);
  const carriedCompletion = (await read(1)).records.at(-1);
  assert.deepEqual(carriedCompletion.request, { descriptor, serial: requestSerial });
  coveredBridge.identity_owed(); rpc.flushAsync();
  assert(rpcMessages.length);
  // Reuse both WAT scratch and local pending context before page delivery.
  rpcHost.dx_trace(31, 7, descriptor, 888, 1);
  for (const message of rpcMessages.splice(0)) broker.serveCalls(message);
  assert.deepEqual(presentation.owedPresentRequest,
    { workerSlot: 3, slot: 7, front, descriptor, serial: requestSerial });
  assert.equal(presentNotices.find(args => args[0] === 5)[5].serial, requestSerial);
  renderer.repaint();
  assert.equal(owedJoin.rows.length, 1, JSON.stringify({ journal: owedJournal.records(), request: presentation.owedPresentRequest }));
  assert.equal(owedJoin.rows[0].request.serial, requestSerial);
  assert.equal(owedJoin.rows[0].callbackReceipt, null);
  const actualOwedPublication = structuredClone(owedJoin.rows[0]);
  owedJoin.retire(); context.d3dimPublicationJoin = null;
  await dispatch(1, { t: 'legacy-producer-observation', action: 'stop' });
  await arm(1);
  assert.equal(presentNotices.some(args => args[0] === 31), false, 'brackets stay local, no extra RPC scheduling');
  rpcHost.dx_trace(31, 7, 0, 0, 0);
  // Repeat through the ranged GPU owed-present branch. No extra wait is added.
  assert.equal(bridge.identity_queue(front, back, descriptor), 1);
  await dispatch(1, transport.shift());
  bridge.identity_gpu_owed(); rpc.flushAsync();
  for (const message of rpcMessages.splice(0)) broker.serveCalls(message);
  assert.equal(presentation.owedPresentRequest.serial, 2);
  const uploadedRequest = structuredClone(presentation.owedPresentRequest);
  renderer.repaint();
  assert.equal(presentation.canvas._waConsumedProducerVersion, undefined,
    'request handoff cannot manufacture a stable consumed-version witness');
  // Outside the owed operation, explicitly carry absence. A later upload
  // cannot inherit the previous request at page callback arrival.
  rpcHost.gdi_surface_upload(sid, 0, 0, 2, 2); rpc.flushAsync();
  for (const message of rpcMessages.splice(0)) broker.serveCalls(message);
  assert.equal(presentation.owedPresentRequest, null);
  bridge.identity_overflow();
  assert.equal(bridge.identity_queue(front, back, descriptor), 1);
  await dispatch(1, transport.shift());
  assert.equal((await read(1)).records.at(-1).request, null, 'serial overflow fails closed without changing Flip');
  bridge.identity_owed(); rpc.flushAsync();
  for (const message of rpcMessages.splice(0)) broker.serveCalls(message);
  assert.equal(presentation.owedPresentRequest, null);
  assert.equal(bridge.identity_queue(front, back, descriptor), 1);
  await dispatch(1, transport.shift());
  assert.equal((await read(1)).records.at(-1).request, null, 'exhaustion never reuses serial one');
  bridge.identity_owed(); rpc.flushAsync();
  for (const message of rpcMessages.splice(0)) broker.serveCalls(message);
  // Full tracing disables dxTraceLocal in production. Its generic async path
  // must carry the same explicit snapshot, with no cross-thread context leak.
  const unfiltered = RPC.createWorkerImports(memory, sigs,
    message => rpcMessages.push(structuredClone(message)), { slot: 4, dxTraceLocal: false });
  unfiltered.imports.host.dx_trace(31, 7, descriptor, 77, 1);
  unfiltered.imports.host.dx_trace(5, 7, 32, dibB, 0);
  unfiltered.imports.host.gdi_surface_upload(sid, 0, 0, 2, 2);
  unfiltered.imports.host.dx_trace(31, 7, 0, 0, 0);
  unfiltered.flushAsync();
  host.dx_trace(31, 7, descriptor, 444, 1);
  for (const message of rpcMessages.splice(0)) broker.serveCalls(message);
  assert.equal(presentation.owedPresentRequest.serial, 77);
  assert.equal(presentation.owedPresentRequest.workerSlot, 4);
  rpcHost.gdi_surface_upload(sid, 0, 0, 2, 2); rpc.flushAsync();
  for (const message of rpcMessages.splice(0)) broker.serveCalls(message);
  assert.equal(presentation.owedPresentRequest, null, 'explicit absence beats another thread/direct host context');
  host.dx_trace(31, 7, 0, 0, 0);
  const owedRequest = { carriedCompletion, uploadedRequest, qualified: false,
    scope: 'unarmed completion/request controls; no consumed-version claim from this block' };

  // Actual separate-thread WAT store: a post-write page generation can be
  // unchanged across the complete canonical read while bytes already differ.
  // This is why no publication Join may be installed using those counters.
  bridge.heap_init(0x2000000);
  assert.equal(bridge.page_watch_acquire(dibB, 16), 1);
  const words = new Uint32Array(memory.buffer), versions = new BigUint64Array(memory.buffer);
  const root = bridge.page_watch_root() >>> 0;
  const watchTable = Atomics.load(words, (root >>> 2) + (dibB >>> 22));
  const versionIndex = (watchTable + ((dibB >>> 12) & 1023) * 16 + 8) >>> 3;
  seed(front, dibB); paint(dibB, 34);
  host.gdi_surface_create(sid, 2, 2, 32, dibB, 8, 1, 0, 0);
  host.gdi_surface_upload(sid, 0, 0, 2, 2);
  renderer.repaint();
  const beforeWrite = Atomics.load(versions, versionIndex);
  const pause = new SharedArrayBuffer(8), pauseWords = new Int32Array(pause);
  let completeSlice;
  const sliceReply = new Promise(resolve => { completeSlice = resolve; });
  const raceWorker = new Worker(`
    const { parentPort, workerData } = require('node:worker_threads');
    const host = { memory: workerData.memory };
    for (const entry of WebAssembly.Module.imports(workerData.module))
      if (entry.kind === 'function') host[entry.name] = () => 0;
    host.log_i32 = marker => {
      if (marker !== 0x57525031) return;
      parentPort.postMessage('stored-before-notification');
      if (Atomics.wait(new Int32Array(workerData.pause), 0, 0, 10000) === 'timed-out')
        throw Error('store-pause deadline expired');
    };
    const ex = new WebAssembly.Instance(workerData.module, { host }).exports;
    if (Atomics.wait(new Int32Array(workerData.pause), 1, 0, 10000) === 'timed-out')
      throw Error('slice-start deadline expired');
    ex.guest_write32(workerData.guest, 0x00330000);
    parentPort.postMessage('notified');
  `, { eval: true, workerData: { module: bridgeModule, memory, pause,
    guest: 0x50000000 + dibB - BASE.DIB_BACKING_BASE } });
  const writerEpoch = new WriterEpoch();
  const tm = new ThreadManager(null, memory, { exports: bridge }, () => ({ host: {} }),
    { workerBackend: { dropThread() {} } });
  tm._log = () => {};
  tm.workerFreeRun = true;
  const writingThread = { tid: 3, state: 'active', suspendCount: 0, _firstRunEmitted: true,
    link: { slice() {
      Atomics.store(pauseWords, 1, 1); Atomics.notify(pauseWords, 1);
      return sliceReply;
    } } };
  tm.threads.set(0xe1001, writingThread);
  tm.setWriterObservation(writerEpoch);
  const beforeSlice = writerEpoch.snapshot();
  raceWorker.on('message', message => {
    if (message === 'notified') {
      writingThread.suspendCount = 1; // Fixture stops after its single real store.
      completeSlice({ yield: 7, blocks: 1 });
    }
  });
  const nextWorkerMessage = () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(Error('store-pause message deadline')); }, 15000);
    const cleanup = () => { clearTimeout(timer); raceWorker.off('message', onMessage); raceWorker.off('error', onError); };
    const onMessage = message => { cleanup(); resolve(message); };
    const onError = error => { cleanup(); reject(error); };
    raceWorker.once('message', onMessage); raceWorker.once('error', onError);
  });
  let postWriteRace;
  try {
    assert.equal(await tm.runWorkerSlices(1000), 1);
    assert(writingThread.inFlight, 'actual free-run scheduler returns with a live writing slice');
    assert.equal(renderer._workerPublicationHeld(), false,
      'free-run slice has outlived the host rendezvous guard');
    assert.equal(writerEpoch.snapshot(), null, 'installed thread-manager observer excludes the live writer');
    assert.throws(() => tm.setWriterObservation(null), /idle/);
    assert.equal(await nextWorkerMessage(), 'stored-before-notification');
    assert.equal(Atomics.load(versions, versionIndex), beforeWrite);
    presentation.surface.markDirty(0, 0, 2, 2);
    renderer.repaint();
    assert.equal(publications.at(-1).red, 51, 'actual canonical read sees changed bytes');
    assert.equal(Atomics.load(versions, versionIndex), beforeWrite,
      'generation unchanged across complete canonical read/publication despite concurrent stored bytes');
    postWriteRace = { source: 'real gs32 in separate Node Worker; test-only pause after production store before production page-watch notification',
      before: String(beforeWrite), duringRead: String(Atomics.load(versions, versionIndex)), red: publications.at(-1).red,
      workerPublicationHeld: renderer._workerPublicationHeld(), writerEpochDuringRead: writerEpoch.snapshot(),
      productionThreadManagerFreeRun: true, qualified: false };
    const notified = nextWorkerMessage();
    Atomics.store(pauseWords, 0, 1); Atomics.notify(pauseWords, 0);
    assert.equal(await notified, 'notified');
    assert(Atomics.load(versions, versionIndex) > beforeWrite);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(writingThread.inFlight, false);
    assert(writerEpoch.snapshot());
    assert.equal(writerEpoch.unchanged(beforeSlice), false, 'whole writer transition invalidates the old exclusion stamp');
    postWriteRace.after = String(Atomics.load(versions, versionIndex));
    postWriteRace.writerEpochAfter = writerEpoch.snapshot();
    tm.setWriterObservation(null);
    assert.equal(writerEpoch.snapshot(), null, 'retired observation cannot authorize a later reader');
  } finally {
    writingThread.suspendCount = 1;
    Atomics.store(pauseWords, 1, 1); Atomics.notify(pauseWords, 1);
    Atomics.store(pauseWords, 0, 1); Atomics.notify(pauseWords, 0);
    completeSlice({ yield: 7, blocks: 1 });
    await raceWorker.terminate();
    bridge.page_watch_release(dibB, 16);
  }

  // Epoch ABA, overlapping writers, duplicate release and overflow all fail
  // closed. None of these exclusion stamps is promoted to a surface version.
  const overlap = new WriterEpoch(), clean = overlap.snapshot();
  assert.equal(new WriterEpoch().unchanged(clean), false, 'equal counters from a replacement owner are not the same witness');
  assert.equal(overlap.unchanged({ epoch: clean.epoch }), false, 'a copied counter is not an issued witness');
  const writerA = overlap.begin(), writerB = overlap.begin();
  overlap.end(writerA); assert.equal(overlap.snapshot(), null);
  overlap.end(writerB); assert.equal(overlap.unchanged(clean), false);
  overlap.end(writerB); assert.equal(overlap.snapshot(), null);
  const exhaustedEpoch = new WriterEpoch();
  Atomics.store(exhaustedEpoch.words, 1, -1);
  const overflowTicket = exhaustedEpoch.begin(); exhaustedEpoch.end(overflowTicket);
  assert.equal(exhaustedEpoch.snapshot(), null);

  // The same installed epoch brackets the actual shared renderer before its
  // held fence/swap, and covers writes from foreign endpoints too.
  const sourceEpoch = new WriterEpoch();
  await dispatch(1, { t: 'legacy-producer-observation', action: 'stop' });
  let releaseBeforeArm;
  c.entry(1).adapter = { fenceFlip: () => new Promise(resolve => { releaseBeforeArm = resolve; }), destroy() {} };
  const alreadyDispatched = dispatch(1, batch(19));
  await dispatch(1, { t: 'legacy-producer-observation', action: 'arm', options: {
    ownerGeneration: 'mid-flight-rejected', writerEpochBuffer: sourceEpoch.buffer } });
  assert.match(sent.at(-1).message.error, /idle dispatch boundary/,
    'an observer cannot retroactively witness an already-dispatched swap');
  assert.equal(c.entry(1).producerObservation.active, false);
  releaseBeforeArm(); await alreadyDispatched;
  await dispatch(1, { t: 'legacy-producer-observation', action: 'arm', options: {
    ownerGeneration: 'writer-epoch-test', maxRecords: 16, writerEpochBuffer: sourceEpoch.buffer } });
  const beforeReplay = sourceEpoch.snapshot();
  let releaseReplay;
  c.entry(1).adapter = { fenceFlip: () => new Promise(resolve => { releaseReplay = resolve; }), destroy() {} };
  const nextSource = batch(20);
  const heldReplay = dispatch(1, nextSource);
  assert.equal(sourceEpoch.snapshot(), null, 'writer invalidation precedes held fence and visible swap');
  releaseReplay(); await heldReplay;
  assert(sourceEpoch.snapshot());
  assert.equal(sourceEpoch.unchanged(beforeReplay), false);
  const beforeForeign = sourceEpoch.snapshot();
  await open(2); await dispatch(2, batch(1));
  assert.equal(sourceEpoch.unchanged(beforeForeign), false, 'unobserved peer endpoint shares the writer epoch');
  await c.dispatch({ t: 'render-close', endpointId: 2 });
  await dispatch(1, { t: 'legacy-producer-observation', action: 'stop' });
  assert.equal(sourceEpoch.snapshot(), null, 'source observation retirement poisons its old read stamps');
  c.entry(1).adapter = null;

  // The new path seals an immutable source proof inside the production replay
  // exclusion, then witnesses the actual lazy canonical decode and real blit.
  // No callback is delivered until AFTER the positive display publication.
  seed(front, dibA); seed(back, dibB); paint(dibA, 17); paint(dibB, 34);
  const sandbox = { console, URLSearchParams, setTimeout, clearTimeout, window: {},
    SharedArrayBuffer, RenderWorker: require('../lib/render-worker') };
  vm.runInNewContext(hostSource + '\n;globalThis.WineAssembly=WineAssembly;', sandbox);
  const wine = Object.create(sandbox.WineAssembly.prototype);
  const guestHost = new GuestThreadHost({ memory });
  const owningLink = new WorkerLink({ slot: 3, memory });
  owningLink._renderLegacyEndpoint = { id: 1, closed: false, addEventListener() {},
    async producerObservation(action, options) {
      await dispatch(1, { t: 'legacy-producer-observation', action, options });
      const response = sent.at(-1).message;
      if (response.error) throw new Error(response.error);
      return response.receipt;
    } };
  guestHost.link = owningLink;
  const localEpoch = () => wine._d3dimWriterObservation;
  const observedMain = observeInstance(native, localEpoch);
  let cooperativeCreations = 0;
  const localThreads = new ThreadManager(module, memory, observedMain, () => imports,
    { instantiateCooperative(mod, imp) {
      cooperativeCreations++;
      assert.equal(wine._d3dimWriterObservation.snapshot(), null,
        'cooperative instance creation and setup exclude canonical readers');
      return new WebAssembly.Instance(mod, imp);
    } });
  Object.assign(wine, { instance: observedMain, memory, guestWorker: guestHost,
    renderer, threadManager: localThreads, processId: 7123 });
  const join = await wine.armD3dimPublicationObservation({ maxRecords: 32 });
  const joinEpoch = join.epoch, journal = join.journal;
  assert.equal(owningLink.writerObservation, joinEpoch);
  assert.equal(localThreads.writerObservation, joinEpoch);
  context.d3dimPublicationJoin = join;
  localThreads._pendingThreads.push({ tid: 2, handle: 0xe1222, startAddr: 0x400000, param: 0,
    stackSize: 0x10000, creationFlags: 4, suspendCount: 1 });
  localThreads.spawnPending();
  assert.equal(cooperativeCreations, 1);
  assert(localThreads.threads.get(0xe1222).instance.nativeInstance);
  assert(joinEpoch.snapshot());
  let joinBatch = 100, requestId = 1000;
  const produce = async () => {
    const serial = ++requestId;
    const view = c.entry(1).buffers[0].view;
    for (const [offset, value] of [[0, 32], [4, front], [8, back], [12, descriptor],
        [16, serial], [20, 0x44585031], [28, 1]]) view.setUint32(offset, value, true);
    await dispatch(1, batch(++joinBatch));
    const bpp = dv.getUint16(front + 16, true), pitch = dv.getUint16(front + 18, true);
    const palette = bpp <= 8 ? native.exports.get_dx_display_palette_wa() : 0;
    host.gdi_surface_create(sid, 2, 2, bpp, dv.getUint32(front + 20, true), pitch, 1, palette, palette ? 256 : 0);
    presentation = gdi.surfacePresentations.get(sid);
    host.gdi_surface_attach(sid, 0x77);
    host.gdi_surface_upload(sid, 0, 0, 2, 2, { slot: 7, workerSlot: 3, descriptor, serial });
    return journal.records().at(-1);
  };
  const stableSource = await produce();
  assert(!stableSource.versionRejected, JSON.stringify(stableSource));
  assert.equal(journal.unchanged(memory, stableSource), true);
  renderer.repaint();
  assert.equal(join.rows.length, 1, JSON.stringify({ versions: journal.records(), canvas: !!presentation.canvas._waD3dimVersion }));
  assert.equal(join.rows[0].consumedSurfaceVersion, stableSource.sourceVersion);
  assert.equal(join.rows[0].callbackReceipt, null, 'publication authority does not wait for callback arrival');
  assert.equal(join.rows[0].completed.domain.startsWith('render-worker.performance:'), true);
  assert.equal(join.rows[0].pagePublication.domain, 'page.performance');
  assert.equal(publications.at(-1).red, 34);
  renderer.repaint(); assert.equal(join.rows.length, 1, 'cached republish deduplicates actual producer');
  const completion = sent.filter(m => m.message?.record?.request?.serial === stableSource.request.serial).at(-1).message;
  join.receipt({ ...completion, callbackReceipt: { domain: 'page.performance', timeOrigin: performance.timeOrigin, atMs: performance.now() } });
  assert(join.rows[0].callbackReceipt.atMs >= join.rows[0].pagePublication.atMs);

  // Completed-but-overwritten and ABA versions have no canonical read proof.
  const overwrittenSource = await produce();
  native.exports.guest_write32(0x50000000 + overwrittenSource.layout.dib - BASE.DIB_BACKING_BASE, 0x00330000);
  presentation.surface.markDirty(0, 0, 2, 2); renderer.repaint();
  assert.equal(join.rows.length, 1);
  assert.equal(publications.at(-1).red, 51, 'failclosed observation preserves changed ordinary rendering');
  native.exports.guest_write32(0x50000000 + overwrittenSource.layout.dib - BASE.DIB_BACKING_BASE, 0x00110000);
  presentation.surface.markDirty(0, 0, 2, 2); renderer.repaint();
  assert.equal(join.rows.length, 1, 'same pointer and restored bytes cannot restore source version');
  await produce(); const finalCoalesced = await produce(); renderer.repaint();
  assert.equal(join.rows.length, 2);
  assert.equal(join.rows.at(-1).sourceVersion, finalCoalesced.sourceVersion);
  assert(join.ledger.some(row => row.disposition === 'coalesced-before-publication'));

  // The actual display-filter handoff, after complete production composition.
  let releaseJoinFence;
  c.entry(1).adapter = { fenceFlip: () => new Promise(resolve => { releaseJoinFence = resolve; }) };
  const heldProduce = produce();
  assert.equal(joinEpoch.snapshot(), null);
  renderer.repaint(); assert.equal(join.rows.length, 2);
  releaseJoinFence(); const heldSource = await heldProduce;
  c.entry(1).adapter = null;
  renderer.repaint(); assert.equal(join.rows.length, 3, JSON.stringify(heldSource));
  port.addEventListener('message', event => join.receipt(event.data));
  deliver(heldSource);
  const firstReceipt = join.rows.at(-1).callbackReceipt;
  assert(firstReceipt);
  deliver(heldSource); assert.deepEqual(join.rows.at(-1).callbackReceipt, firstReceipt);
  deliver(first); assert.equal(join.rows.length, 3, 'stale owner callback never becomes a new publication');
  renderer.createWindow(0x78, 0x90000000, 1, 1, 1, 1, '', 0);
  await produce(); renderer.repaint(); assert.equal(join.rows.length, 3);
  assert(!join.ledger.some(row => row.disposition === 'uncovered-scene-publication'),
    'unsupported scene refuses publication without consuming immutable pending sources');
  renderer.showWindow(0x78, 0);
  const { PresentationFilter } = require('../lib/presentation-filter');
  renderer.presentationCanvas = createCanvas(4, 4);
  renderer.presentationFilter = new PresentationFilter(renderer.presentationCanvas, { createCanvas });
  renderer.presentationScaleMode = 'sharp-bilinear';
  await produce(); renderer.repaint();
  assert.equal(join.rows.length, 4);
  assert.equal(join.rows.at(-1).transfers.at(-1).operation.kind, 'display-filter');
  assert.equal(renderer.presentationCanvas.getContext('2d').getImageData(0, 0, 1, 1).data[0], publications.at(-1).red);
  renderer.presentationCanvas = null; renderer.presentationFilter = null;
  renderer.presentationScaleMode = 'nearest';

  // Indexed canonical conversion proves every palette byte as well as DIB
  // bytes. Equal pixels and restoration of a palette pointer cannot repair ABA.
  const palette = dibA + 8192, replacementPalette = palette + 1024;
  bytes.fill(0, palette, palette + 2048);
  bytes.set([81, 2, 3, 0], palette + 4); bytes.set([81, 2, 3, 0], replacementPalette + 4);
  const watchedBridge = observeInstance({ exports: bridge }, () => joinEpoch).exports;
  watchedBridge.identity_palette(palette);
  for (const entry of [front, back]) { dv.setUint16(entry + 16, 8, true); dv.setUint16(entry + 18, 2, true); }
  bytes.fill(1, dibA, dibA + 4); bytes.fill(1, dibB, dibB + 4);
  const paletteSource = await produce(); renderer.repaint();
  assert.equal(join.rows.length, 5, JSON.stringify(paletteSource));
  assert.equal(publications.at(-1).red, 81);
  await produce();
  watchedBridge.guest_write32(0x50000000 + palette + 4 - BASE.DIB_BACKING_BASE, 0x00030263);
  presentation.surface.markDirty(0, 0, 2, 2); renderer.repaint();
  assert.equal(publications.at(-1).red, 99); assert.equal(join.rows.length, 5);
  watchedBridge.guest_write32(0x50000000 + palette + 4 - BASE.DIB_BACKING_BASE, 0x00030251);
  presentation.surface.markDirty(0, 0, 2, 2); renderer.repaint(); assert.equal(join.rows.length, 5);
  await produce(); watchedBridge.identity_palette(replacementPalette);
  host.gdi_surface_create(sid, 2, 2, 8, dv.getUint32(front + 20, true), 2, 1, replacementPalette, 256);
  presentation.surface.markDirty(0, 0, 2, 2); renderer.repaint(); assert.equal(join.rows.length, 5);
  watchedBridge.identity_palette(palette);
  presentation.surface.markDirty(0, 0, 2, 2); renderer.repaint(); assert.equal(join.rows.length, 5);
  const retiringSource = await produce(); watchedBridge.identity_retire(front);
  renderer.repaint(); assert.equal(join.rows.length, 5, 'native surface retirement invalidates before reuse');
  assert.equal(journal.unchanged(memory, retiringSource), false);
  seed(front, dibA); seed(back, dibB); paint(dibA, 17); paint(dibB, 34);

  // Main/cooperative-style callback entry may reenter the compositor through
  // an import before its WAT store has notified the page watch.
  const reentrantSource = await produce();
  let reentrantCalls = 0;
  reentrantObserver = marker => {
    if (marker !== 0x57525031) return;
    reentrantCalls++;
    assert.equal(joinEpoch.snapshot(), null);
    assert(journal.unchanged(memory, reentrantSource));
    presentation.surface.markDirty(0, 0, 2, 2); renderer.repaint();
    assert.equal(publications.at(-1).red, 90);
    assert.equal(join.rows.length, 5);
  };
  try {
    watchedBridge.guest_write32(0x50000000 + reentrantSource.layout.dib - BASE.DIB_BACKING_BASE, 0x005a0000);
  } finally { reentrantObserver = null; }
  assert.equal(reentrantCalls, 1);
  assert.equal(journal.unchanged(memory, reentrantSource), false);

  // A real production WorkerLink/guest-worker callExport runs the native gs32
  // path, paused after its store and before notification. Readers must reject
  // the live standalone writer, even with an unchanged page-watch generation.
  const actualLink = new WorkerLink({ slot: 8, memory, module: bridgeModule,
    sigs: require('../lib/host-import-sigs.generated.json').sigs,
    workerUrl: require.resolve('../lib/guest-worker') });
  await actualLink.start(); actualLink.setWriterObservation(joinEpoch);
  try {
    const controlWa = dibA + 4096;
    const control = new Int32Array(memory.buffer, controlWa, 2);
    control.fill(0);
    await actualLink.callExport('identity_pause_at', controlWa);
    const source = await produce(), before = structuredClone(source.pages);
    const writing = actualLink.callExport('guest_write32',
      0x50000000 + source.layout.dib - BASE.DIB_BACKING_BASE, 0x00440000);
    const deadline = Date.now() + 5000;
    while (!Atomics.load(control, 1) && Date.now() < deadline) await new Promise(r => setTimeout(r, 1));
    assert.equal(Atomics.load(control, 1), 1, 'real Worker reached pre-notification WAT pause');
    assert.equal(joinEpoch.snapshot(), null);
    assert.deepEqual(source.pages, before);
    assert(journal.unchanged(memory, source));
    presentation.surface.markDirty(0, 0, 2, 2); renderer.repaint();
    assert.equal(publications.at(-1).red, 68);
    assert.equal(join.rows.length, 5, 'actual live standalone writer cannot qualify publication');
    Atomics.store(control, 0, 1); Atomics.notify(control, 0);
    await writing;
    assert.equal(journal.unchanged(memory, source), false);
    await actualLink.callExport('identity_pause_at', 0);
  } finally {
    const control = new Int32Array(memory.buffer, dibA + 4096, 2);
    Atomics.store(control, 0, 1); Atomics.notify(control, 0);
    await actualLink.stop();
  }
  // Worker retirement invalidates the shared observation. Use a separate
  // epoch for request/timeout behavior; it cannot revive the retired Join.
  const requestEpoch = new WriterEpoch();
  // Standalone commands use the production _ask path, outside ThreadManager.
  const standalone = new WorkerLink({ slot: 9, memory });
  const messages = [];
  standalone.worker = { postMessage: m => messages.push(m) };
  standalone.setWriterObservation(requestEpoch);
  const beforeStandalone = requestEpoch.snapshot();
  const standaloneWrite = standalone.callExport('guest_write32', 0x50000000, 123);
  assert.equal(requestEpoch.snapshot(), null);
  assert.throws(() => standalone.setWriterObservation(null), /idle/);
  standalone._onMessage({ t: 'exportResult', seq: messages.at(-1).seq, value: 0 });
  await standaloneWrite;
  assert.equal(requestEpoch.unchanged(beforeStandalone), false);
  assert(requestEpoch.snapshot());
  for (const command of ['scopedThreadSendLoader', 'waveCallback', 'dispatchThreadSend']) {
    const pending = standalone._ask({ t: command });
    assert.equal(requestEpoch.snapshot(), null, `${command} excludes readers`);
    standalone._onMessage({ t: 'reply', seq: messages.at(-1).seq }); await pending;
    assert(requestEpoch.snapshot());
  }
  // Ambiguous completion poisons the observer even if a reply arrives later.
  await assert.rejects(standalone._ask({ t: 'callExport', name: 'guest_write32' }, 5), /did not answer/);
  assert.equal(requestEpoch.snapshot(), null);
  standalone._onMessage({ t: 'exportResult', seq: messages.at(-1).seq, value: 0 });
  renderer.repaint(); assert.equal(join.rows.length, 5);
  join.retire(); context.d3dimPublicationJoin = null;
  await dispatch(1, { t: 'legacy-producer-observation', action: 'stop' });
  const publicationJoin = { rows: join.rows, ledger: join.ledger, qualifiedScope: 'stable Node canonical production decode/blit/display, controlled transport; no game/GPU/FPS claim' };

  let overhead = null;
  if (process.env.D3DIM_IDENTITY_BENCH) {
    // Matched real WAT swap + actual lazy canonical conversion + complete
    // production repaint, with the completion tap off/on. No gameplay or GPU
    // inference: this is a Node software fixture and controlled transport.
    const width = 640, height = 480, stride = width * 4;
    const benchDibA = dibA, benchDibB = dibA + stride * height;
    for (const [entry, dib] of [[front, benchDibA], [back, benchDibB]]) {
      seed(entry, dib);
      dv.setUint16(entry + 12, width, true); dv.setUint16(entry + 14, height, true);
      dv.setUint16(entry + 18, stride, true);
      for (let i = 0; i < width * height; i++) bytes.set([4, 8, 16, 0], dib + i * 4);
    }
    const benchRenderer = new Win98Renderer(createCanvas(width, height));
    benchRenderer.scheduleRepaint = () => {};
    benchRenderer.createWindow(0x88, 0x90000000, 0, 0, width, height, '', 0);
    const benchHost = createHostImports({ getMemory: () => memory.buffer, exports: {}, renderer: benchRenderer }).host;
    benchHost.gdi_surface_create(sid, width, height, 32, benchDibA, stride, 1, 0, 0);
    benchHost.gdi_surface_attach(sid, 0x88);
    let seq = 1;
    const frame = async observe => {
      await dispatch(1, batch(++seq));
      if (observe) deliver(sent.at(-1).message.record);
      benchHost.gdi_surface_upload(sid, 0, 0, width, height);
      benchRenderer.repaint();
    };
    for (let i = 0; i < 10; i++) await frame(false);
    const trials = [];
    for (let group = 0; group < 7; group++) for (const mode of ['control', 'observer', 'observer', 'control']) {
      if (mode === 'observer') await arm(1, 64);
      else await dispatch(1, { t: 'legacy-producer-observation', action: 'stop' });
      const start = performance.now();
      for (let i = 0; i < 40; i++) await frame(mode === 'observer');
      trials.push({ group, mode, frames: 40, elapsedMs: performance.now() - start });
    }
    overhead = { scope: 'completion-tap telemetry seam in actual 640x480 production canonical composition; Node software fixture, mock transport, native WAT swaps; no gameplay slowdown or GPU/browser/full observer claim', trials };
  }
  const count = callbacks.length;
  port.closed = true; deliver(first);
  assert.equal(callbacks.length, count, 'closed endpoint cannot receive delayed old-owner callback');
  assert(transfers.length >= 5);

  const report = { qualified: true, scope: 'installed production Join in Node: actual WAT owed/Encoder/RPC, canonical RGBA, scene blit and display; controlled transport/fences; no game/GPU/FPS qualification',
    node: process.version, compiledModuleSha256: createHash('sha256').update(binary).digest('hex'),
    sourceRecords: receipt.records, delayedCallback: callbacks[0], duplicate, identical,
    replacement, rebound, coalesced, publications, owedRequest, actualOwedPublication, postWriteRace, publicationJoin, overhead,
    testBridgeModuleSha256: createHash('sha256').update(bridgeBinary).digest('hex'),
    limitations: ['uncovered multiwindow/child/layer/overlay scenes fail closed', 'default import-wrapper cost unqualified', 'live FPS/full27/parity/audio remain open'],
    simulationFps: null, presentationRate: null };
  if (process.env.D3DIM_IDENTITY_REPORT) fs.writeFileSync(process.env.D3DIM_IDENTITY_REPORT, JSON.stringify(report, null, 2) + '\n');
  console.log('PASS installed scoped production consumed-version/display Join: actual owed WAT/Encoder/RPC positive, lazy canonical and filter publication, real standalone pre-notification writer exclusion, cooperative/main coverage, palette/lifetime/ABA/coalescing/fence/callback/retirement/timeout negatives; no game/GPU/FPS claim');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
