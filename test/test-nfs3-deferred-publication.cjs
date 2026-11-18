'use strict';
const assert = require('node:assert/strict');
const { observePublication, classify } = require('../tools/nfs3-deferred-publication.cjs');
function fixture() {
  const layer = { canvas: {}, d3dimRT: 3, d3dimPresentSeq: 10 };
  const win = { hwnd: 10, visible: true, wasm: {}, processId: 1000, _dxFrameLayer: layer };
  Object.assign(layer, { d3dimWindow: win, d3dimInstance: win.wasm });
  const renderer = { windows: { 10: win }, canvas: {}, presentationCanvas: {},
    _workerGuestSliceDepth: 0, _workerGdiPaintDepth: 0,
    beginWorkerGuestSlice() { this._workerGuestSliceDepth++; },
    endWorkerGuestSlice() { this._workerGuestSliceDepth--; },
    repaint() { if (this._workerGuestSliceDepth) { this._repaintScheduled = true;
      this._workerRepaintDeferred = true; return false; }
      this._immutablePublicationSequence = (this._immutablePublicationSequence || 0) + 1;
      return true; },
  };
  const presenter = { layer, win, presents: 0, present(frame) {
    if (frame.fail) throw frame.fail;
    this.presents++; renderer._repaintScheduled = true; renderer._workerRepaintDeferred = true;
    return frame;
  } };
  const wine = { renderer, instance: win.wasm, processId: 1000, running: true,
    hostCtx: { d3dimBridge: { presenter, endpoint: {} } },
    guestWorker: { link: { _pending: new Map([[1, { command: 'slice' }]]) } } };
  return { wine, renderer, presenter, win, layer };
}
const f = fixture(), original = f.presenter.present, o = observePublication(f.wine, { capacity: 64 });
f.renderer.beginWorkerGuestSlice();
const frame = { hwnd: 10, rt: 3, presentSeq: 10, pixels: new Uint8Array(4) };
assert.equal(f.presenter.present(frame), frame, 'same synchronous return and frame');
assert.equal(f.renderer.repaint(), false, 'observer never bypasses held publication');
let c = classify(o.report());
assert.equal(c.completedWhileHeld, 1); assert.equal(c.publications, 0);
assert.equal(c.safeMidSlicePublicationProved, false);
f.renderer.endWorkerGuestSlice(); f.renderer.repaint();
c = classify(o.report()); assert.equal(c.publications, 1);
for (const [name, mutate, check] of [
  ['retirement', f => { f.wine._stopped = true; }, r => r.stopped],
  ['reused HWND', f => { f.renderer.windows[10] = { ...f.win }; }, r => !r.registeredWindow],
  ['foreign window', f => { f.presenter.win = { ...f.win, hwnd: 11 }; }, r => !r.registeredWindow],
  ['foreign instance', f => { f.win.wasm = {}; }, r => r.owner !== r.windowInstance],
  ['hidden', f => { f.win.visible = false; }, r => !r.visible],
  ['CPU replacement', f => { f.win._dxFrameLayer = {}; }, r => !r.selectedLayer],
  ['GDI lifetime', f => { f.renderer._workerGdiPaintDepth = 2; }, r => r.gdiDepth === 2],
  ['closed epoch', f => { f.wine.hostCtx.d3dimBridge.endpoint.closed = true; }, r => r.endpointClosed],
  ['poisoned writer', f => { const words = new Int32Array(new SharedArrayBuffer(16));
    words[0] = 1; words[2] = 1; f.renderer._d3dimPublicationJoins = [{ live: true, epoch: { words } }]; },
    r => r.joins[0].writers === 1 && r.joins[0].poisoned === 1],
]) {
  const f = fixture(), w = observePublication(f.wine); mutate(f); w.sample();
  assert(check(w.report().rows.at(-1)), name); w.close();
}
const failure = Error('producer failed');
assert.throws(() => f.presenter.present({ fail: failure }), e => e === failure);
// Diagnostic failure cannot suppress a producer call or change its return.
Object.defineProperty(f.win, 'visible', { get() { throw Error('diagnostic failure'); } });
assert.equal(f.presenter.present(frame), frame); assert(o.report().errors.length > 0);
delete f.win.visible;
for (let i = 0; i < 100; i++) o.sample();
assert.equal(o.report().rows.length, 64); assert(o.report().overwritten > 0);
o.close(); assert.equal(f.presenter.present, original);
const n = o.report().count; f.presenter.present(frame); o.sample(); assert.equal(o.report().count, n);
const g = fixture(), other = observePublication(g.wine), replacement = () => 17;
g.presenter.present = replacement; other.close(); assert.equal(g.presenter.present, replacement);
{
  const f = fixture(); let nativeCalls = 0;
  f.layer.stale = function() { nativeCalls++; assert.equal(this, f.layer); return false; };
  const w = observePublication(f.wine, { capacity: 16 });
  assert.equal(f.layer.stale(), false); assert.equal(nativeCalls, 1);
  const latest = () => true;
  for (let i = 0; i < 100; i++) { f.layer.stale = latest; f.presenter.present(frame);
    assert.equal(f.layer.stale(), true); }
  assert.equal(w.report().rows.length, 16); w.close(); assert.equal(f.layer.stale, latest);
}
assert.equal(o.report().extraGuestPolls, 0); assert.equal(o.report().pixelReads, 0);
// Native state is read directly; no native export is called. The process
// region addresses are supplied by the tested module's map.
{
  const f = fixture(), buffer = new SharedArrayBuffer(30000), words = new Uint32Array(buffer);
  const regions = { D3DIM_GPS: { base: 0 }, D3DIM_LAZY_SHARED: { base: 32 },
    DX_OBJECTS: { base: 64, size: 32 }, DX_SURF_CREATOR: { base: 96 } };
  f.wine.memory = { buffer };
  words[2] = 128; words[(128 + 23360) / 4] = 10;
  const a = (128 + 23360) / 4;
  words[a + 1] = 64; words[a + 2] = 600; words[a + 3] = 3;
  words[a + 4] = 42; words[a + 5] = 9;
  words[64 / 4] = 2; words[(64 + 20) / 4] = 600; words[96 / 4] = 9;
  words[(32 + 24) / 4] = 7;
  const w = observePublication(f.wine, { regions });
  let n = w.report().rows.at(-1).native;
  assert.equal(n.cpuSeq, 7); assert.equal(n.owner.seq, 42);
  assert(n.owner.coherent && n.owner.allocationMatches);
  words[(64 + 20) / 4] = 601; w.sample();
  assert.equal(w.report().rows.at(-1).native.owner.allocationMatches, false);
  words[a + 4] = 0; w.sample(); assert.equal(w.report().rows.at(-1).native.owner.coherent, false);
  words[a + 1] = 63; w.sample(); assert.equal(w.report().rows.at(-1).native.invalidEntry, 63);
  assert.equal(w.report().errors.length, 0); w.close();
}
console.log('PASS bounded passive completion/slice/publication trace, identity and lifetime negatives, return/throw/restore preservation');
// Actual controller failure: an expired screenshot produced a negative
// prepareCapture budget and closed an otherwise valid, zero-input scope.
{
  const { reviewedInputAdmission } = require('../tools/nfs3-deferred-publication.cjs');
  const shot = 1794982884266, dispatch = 1794982902002;
  assert(Math.min(3000, 15000 - (dispatch - shot) - 50) < 0);
  const expired = reviewedInputAdmission(shot, dispatch);
  assert.equal(expired.state, 'NOT_SENT'); assert.equal(expired.screenshotAt, shot);
  assert.equal(expired.admitted, false);
  assert.equal(reviewedInputAdmission(shot, shot - 1).state, 'NOT_SENT');
  assert.equal(reviewedInputAdmission(shot, shot + 8500).state, 'NOT_SENT');
  const fresh = reviewedInputAdmission(shot, shot + 2000);
  assert(fresh.admitted && fresh.remainingMs > fresh.operationReserveMs);
  assert(fresh.preparationBudgetMs > 0 && fresh.preparationBudgetMs <= 3000);
  assert.equal(fresh.reviewLifetimeMs, 15000);
  assert(Object.isFrozen(fresh));
  assert.throws(() => reviewedInputAdmission(NaN, dispatch));
}
console.log('PASS expired/future/insufficient-reserve review is known NOT_SENT, fresh admission preserves original screenshot timestamp and finite native budget');
