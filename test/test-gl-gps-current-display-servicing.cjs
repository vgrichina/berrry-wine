'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), vm = require('node:vm');
const { Win98Renderer } = require('../lib/renderer');
const { createCanvas } = require('../lib/raster-canvas');
const { Bridge } = require('../lib/gpu-stream-host');
const { verifyNativeProducer } = require('../tools/gltron-current-native-capture.cjs');

function fixture() {
  const r = new Win98Renderer(createCanvas(8, 8));
  const context = { URLSearchParams, console, setTimeout, clearTimeout,
    performance: { now: () => 0 }, requestAnimationFrame() {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../host.js'), 'utf8') +
    '\n;globalThis.Host = WineAssembly;', context);
  const canvas = createCanvas(8, 8), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#17395b'; ctx.fillRect(0, 0, 8, 8);
  const instance = { exports: {} };
  const win = r.windows[123] = { hwnd: 123, x: 0, y: 0, w: 8, h: 8,
    z: 1, visible: true, isChild: false, style: 0x80000000,
    processId: 1000, wasm: instance, _backCanvas: canvas };
  const h = Object.assign(Object.create(context.Host.prototype), {
    renderer: r, instance, processId: 1000, running: true,
    _presentDxIfDirty() { throw Error('must not upload'); },
    _queuePresentFrame() {},
  });
  r.repaint();
  return { r, h, win };
}
const arm = ({ r, h }) => {
  r.beginWorkerGuestSlice();
  return h.requestCurrentDisplayCapture({ hwnd: 123 });
};

test('clean completed slice services already displayed literal pixels without a new publication', () => {
  const f = fixture(), { r, h } = f;
  const record = r._currentDisplayRecord, seq = r._immutablePublicationSequence;
  const t = arm(f);
  assert.equal(t.status, 'pending');
  h._presentAtBoundary(); assert.equal(t.status, 'pending', 'active writer');
  r.endWorkerGuestSlice();
  assert.equal(t.status, 'pending', 'renderer release does not bypass host live queues');
  h._presentAtBoundary();
  assert.equal(t.status, 'complete', t.error);
  const got = t.read(), literal = Uint8ClampedArray.from(Array.from({ length: 64 }, () => [23, 57, 91, 255]).flat());
  assert.deepEqual(got.sourceRGBA, literal);
  assert.deepEqual(got.outputRGBA, literal);
  assert.equal(got.metadata.publication, seq);
  assert.equal(got.metadata.displayedAt, record.displayedAt);
  assert.equal(got.metadata.content, 'already-displayed');
  assert.equal(r._currentDisplayRecord, record);
  assert.equal(r._repaintScheduled, false);
  assert.equal(r._immutablePublicationSequence, seq);
  got.outputRGBA.fill(0);
  h._presentAtBoundary();
  assert.deepEqual(t.read().outputRGBA, literal, 'late boundaries cannot mutate completed bytes');
});

test('live host queues, shared dirty and renderer writers prevent retained-display servicing', () => {
  for (const kind of ['dirty', 'lock', 'due', 'shared', 'paint', 'render', 'scheduled', 'deferred']) {
    const f = fixture(), { r, h } = f, t = arm(f);
    r.endWorkerGuestSlice();
    if (kind === 'dirty') h._dxDirty = true;
    if (kind === 'lock') h._dxLockDeferred = true;
    if (kind === 'due') { h._presentFrameDue = true; h._presentNow = () => 0; }
    if (kind === 'shared') h.guestWorker = { broker: { dxState: () => ({ dirty: 7 }) } };
    if (kind === 'paint') r.beginWorkerGdiPaint(123);
    const words = new Int32Array(new SharedArrayBuffer(16));
    if (kind === 'render') { words[0] = 1; r._d3dimPublicationJoins = [{ live: true, epoch: { words } }]; }
    if (kind === 'scheduled') r._repaintScheduled = true;
    if (kind === 'deferred') r._workerRepaintDeferred = true;
    h._presentAtBoundary(); assert.equal(t.status, 'pending', kind);
    t.cancel(); h._dxDirty = h._dxLockDeferred = h._presentFrameDue = false;
    h.guestWorker = null; r._workerGdiPaintDepth = 0; words[0] = 0;
    r._repaintScheduled = r._workerRepaintDeferred = false;
    h._presentAtBoundary(); assert.equal(t.status, 'cancelled', kind);
  }
});

test('initial queued damage requires ordinary publication even after queues clear', () => {
  const f = fixture(), { r, h } = f;
  h._dxDirty = true;
  const t = arm(f); r.endWorkerGuestSlice(); h._dxDirty = false;
  h._presentAtBoundary(); assert.equal(t.status, 'pending');
  r.repaint(); assert.equal(t.status, 'complete', t.error);
  assert.equal(t.read().metadata.content, 'ordinary-publication-after-request');
});

test('retirement, identity substitution, unreceipted display and read faults never produce stale success', () => {
  for (const kind of ['stop', 'not-running', 'replace', 'process', 'instance', 'display', 'read', 'cancel']) {
    const f = fixture(), { r, h, win } = f, t = arm(f);
    r.endWorkerGuestSlice();
    if (kind === 'stop') h._stopped = true;
    if (kind === 'not-running') h.running = false;
    if (kind === 'replace') r.windows[123] = { ...win };
    if (kind === 'process') win.processId++;
    if (kind === 'instance') win.wasm = {};
    if (kind === 'display') r._presentDisplayCanvas();
    if (kind === 'read') r.ctx.getImageData = () => { throw Error('readback lost'); };
    if (kind === 'cancel') t.cancel();
    h._presentAtBoundary();
    assert.equal(t.status, ['stop', 'not-running'].includes(kind) ? 'pending' : kind === 'cancel' ? 'cancelled' : 'failed', kind);
    assert.equal(t.read(), null, kind);
    if (t.status === 'pending') t.cancel();
    r.repaint(); assert.notEqual(t.status, 'complete', 'late publication: ' + kind);
  }
});

test('explicit producer failure settles only its owner, invalidates late capture and preserves completed bytes', () => {
  const f = fixture(), { r, h, win } = f;
  const complete = h.requestCurrentDisplayCapture({ hwnd: 123 }), retained = complete.read();
  const t = arm(f), owner = { instance: h.instance, processId: h.processId, window: win };
  assert.equal(r.failCurrentDisplayCapture({ ...owner, instance: {} }, Error('foreign')), false);
  assert.equal(r.failCurrentDisplayCapture({ ...owner, processId: 9 }, Error('foreign')), false);
  assert.equal(r.failCurrentDisplayCapture({ ...owner, window: { ...win } }, Error('foreign')), false);
  assert.equal(t.status, 'pending');
  assert.equal(r.failCurrentDisplayCapture(owner, Error('actual producer loss')), true);
  assert.equal(t.status, 'failed'); assert.match(t.error, /actual producer loss/);
  r.endWorkerGuestSlice(); h._presentAtBoundary();
  assert.equal(t.status, 'failed'); assert.equal(t.read(), null);
  const late = h.requestCurrentDisplayCapture({ hwnd: 123 });
  assert.equal(late.status, 'failed'); assert.match(late.error, /no complete unheld publication/);
  assert.deepEqual(complete.read(), retained, 'completed evidence retains original bytes and timestamps');
});

test('real GPS bridge current error and close fail pending capture; stale epoch callbacks only close their bitmap', async () => {
  for (const kind of ['error', 'close']) {
    const f = fixture(), { r, h, win } = f;
    let listener, terminations = 0, bitmapClosed = 0;
    const endpoint = { ready: Promise.resolve(), addEventListener(type, fn) { listener = fn; },
      async terminate() { terminations++; this.closed = true; } };
    const b = new Bridge({ renderer: r, createRenderEndpoint: async () => endpoint });
    b._openWorker(); await b.endpointReady;
    b.presenter.win = win;
    const t = arm(f), oldEpoch = b.workerEpoch;
    b._workerFrame({ bitmap: { close() { bitmapClosed++; } } }, oldEpoch - 1);
    assert.equal(bitmapClosed, 1); assert.equal(t.status, 'pending');
    if (kind === 'error') listener({ data: { t: 'gps-error', error: 'native context lost' } });
    else await b.close();
    assert.equal(t.status, 'failed'); assert.match(t.error, /native context lost|producer closing/);
    b._workerFrame({ bitmap: { close() { bitmapClosed++; } } }, oldEpoch);
    assert.equal(bitmapClosed, 2);
    r.endWorkerGuestSlice(); h._presentAtBoundary(); assert.equal(t.status, 'failed');
    if (kind === 'error') await b.close();
    assert.equal(terminations, 1);
  }
});

test('late rejected GPU open cannot fault a replacement generation or its pending capture', async () => {
  const f = fixture(), { r, h, win } = f;
  let rejectOld, count = 0;
  const old = new Promise((resolve, reject) => { rejectOld = reject; });
  const endpoint = { ready: Promise.resolve(), addEventListener() {}, async terminate() {} };
  const b = new Bridge({ renderer: r, createRenderEndpoint: () => ++count === 1 ? old : Promise.resolve(endpoint) });
  b._openWorker(); const oldReady = b.endpointReady;
  b._openWorker(); await b.endpointReady; b.presenter.win = win;
  const t = arm(f);
  rejectOld(Error('retired open failed')); await assert.rejects(oldReady, /retired open failed/);
  await Promise.resolve(); assert.equal(b.workerAsyncError, null); assert.equal(t.status, 'pending');
  r.endWorkerGuestSlice(); h._presentAtBoundary(); assert.equal(t.status, 'complete');
  await b.close(); assert.equal(t.status, 'complete');
});

test('passive page inspection with no producer cannot certify a retired native binding', () => {
  const pinned = { renderEndpoint: 1, renderEndpointObject: 'port-1', renderApi: 'gl-gps',
    renderBridgeObject: 'bridge-1', renderGeneration: 1 };
  verifyNativeProducer(pinned, { ...pinned });
  assert.throws(() => verifyNativeProducer(pinned, { ...pinned, renderEndpoint: 'none' }), /identity changed/);
  assert.throws(() => verifyNativeProducer(pinned, { ...pinned, renderGeneration: 2 }), /identity changed/);
});
