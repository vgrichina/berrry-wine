'use strict';

// Passive page-side lifetime witness. No guest calls, pixel reads, timer,
// repaint, input, or freshness changes are introduced by the wrappers.
function observePublication(wine, { capacity = 1024, regions = null } = {}) {
  if (!Number.isInteger(capacity) || capacity < 16 || capacity > 4096)
    throw Error('publication witness capacity');
  const renderer = wine.renderer, presenter = wine.hostCtx?.d3dimBridge?.presenter;
  if (!renderer || !presenter) throw Error('publication witness owner unavailable');
  const ids = new WeakMap(), rows = [], errors = [], restores = [];
  let serial = 0, count = 0, closed = false;
  const id = value => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return null;
    if (!ids.has(value)) ids.set(value, ++serial);
    return ids.get(value);
  };
  const native = hwnd => {
    if (!regions) return null;
    const buffer = wine.memory.buffer, view = new DataView(buffer), words = new Int32Array(buffer);
    const u = a => view.getUint32(a, true), atomic = a => Atomics.load(words, a / 4) >>> 0;
    const pb = u(regions.D3DIM_GPS.base + 8);
    const cpuSeq = atomic(regions.D3DIM_LAZY_SHARED.base + 24);
    if (!pb) return { pb, cpuSeq, owner: null };
    for (let i = 0; i < 32; i++) {
      const a = pb + 23360 + i * 32;
      if (u(a) !== hwnd) continue;
      const seq = atomic(a + 16), entry = u(a + 4), dib = u(a + 8), rt = u(a + 12), creator = u(a + 20);
      const slot = (entry - regions.DX_OBJECTS.base) / 32;
      if (!Number.isInteger(slot) || slot < 0 || slot >= regions.DX_OBJECTS.size / 32)
        return { pb, cpuSeq, invalidEntry: entry };
      const currentType = u(entry), currentDib = u(entry + 20),
        currentCreator = u(regions.DX_SURF_CREATOR.base + slot * 4);
      return { pb, cpuSeq, owner: { seq, entry, dib, rt, creator, currentType, currentDib, currentCreator,
        coherent: seq !== 0 && seq === atomic(a + 16),
        allocationMatches: currentType === 2 && currentDib === dib && currentCreator === creator } };
    }
    return { pb, cpuSeq, owner: null };
  };
  const snapshot = () => {
    const p = presenter, r = renderer, win = p.win, layer = p.layer;
    const bridge = wine.hostCtx?.d3dimBridge;
    const record = r._currentDisplayRecord, display = record?.display;
    return {
      owner: id(wine.instance), process: wine.processId, renderer: id(r),
      liveRenderer: wine.renderer === r, livePresenter: bridge?.presenter === p,
      running: wine.running, stopped: !!wine._stopped,
      endpoint: id(bridge?.endpoint), endpointClosed: !!bridge?.endpoint?.closed,
      closing: !!bridge?.workerClosing, failed: !!bridge?.workerAsyncError,
      window: id(win), hwnd: win?.hwnd, visible: win?.visible,
      registeredWindow: !!win && r.windows[win.hwnd] === win,
      windowInstance: id(win?.wasm), windowProcess: win?.processId,
      layer: id(layer), layerCanvas: id(layer?.canvas),
      selectedLayer: !!win && win._dxFrameLayer === layer,
      boundWindow: id(layer?.d3dimWindow), boundInstance: id(layer?.d3dimInstance),
      rt: layer?.d3dimRT, seq: layer?.d3dimPresentSeq, stamp: p.stamp,
      presents: p.presents, publication: r._immutablePublicationSequence || 0,
      workerDepth: r._workerGuestSliceDepth, gdiDepth: r._workerGdiPaintDepth,
      scheduled: !!r._repaintScheduled, deferred: !!r._workerRepaintDeferred,
      pending: !!r._repaintPending, source: id(display?.source),
      exclusiveSource: id(r._exclusivePresentationSource), logical: id(r.canvas),
      output: id(display?.output), presentation: id(r.presentationCanvas),
      mainCommands: wine.guestWorker?.link?._pending
        ? [...wine.guestWorker.link._pending.values()].map(v => v.command) : [],
      joins: [...(r._d3dimPublicationJoins || [])].map(j => ({
        live: !!j.live, writers: Atomics.load(j.epoch.words, 0),
        poisoned: Atomics.load(j.epoch.words, 2),
      })),
      native: native(win?.hwnd),
    };
  };
  const take = (event, extra) => {
    if (closed) return;
    try {
      const row = { event, wall: Date.now(), mono: performance.timeOrigin + performance.now(),
        ...snapshot(), ...(typeof extra === 'function' ? extra() : extra) };
      count++;
      if (rows.length === capacity) rows.shift();
      rows.push(row);
    } catch (e) { if (errors.length < 8) errors.push(String(e)); }
  };
  function wrap(object, name, details) {
    const original = object[name], own = Object.getOwnPropertyDescriptor(object, name);
    if (typeof original !== 'function') return;
    const wrapped = function(...args) {
      const before = name === 'present' ? this.presents : null;
      let returned = false;
      take(name + ':enter', details ? () => details(args) : undefined);
      let result;
      try { result = Reflect.apply(original, this, args); returned = true; return result; }
      finally { take(name + ':exit', { returned,
        stale: name === 'stale' && returned ? result : undefined,
        returnedLayer: name === '_overlayFrameLayer' ? id(result) : undefined,
        accepted: name === 'present' ? returned && this.presents > before : undefined });
        if (name === 'present') {
          try { watchStale(); } catch (e) { if (errors.length < 8) errors.push(String(e)); }
        } }
    };
    object[name] = wrapped;
    restores.push(() => {
      // Do not overwrite a later observer/owner's replacement.
      if (object[name] !== wrapped) return;
      if (own) Object.defineProperty(object, name, own); else delete object[name];
    });
  }
  let staleRecord = null;
  function restoreStale() {
    const s = staleRecord; staleRecord = null;
    if (!s || s.layer.stale !== s.wrapped) return;
    if (s.own) Object.defineProperty(s.layer, 'stale', s.own); else delete s.layer.stale;
  }
  function watchStale() {
    const layer = presenter.layer, stale = layer?.stale;
    if (staleRecord?.layer === layer && staleRecord.wrapped === stale) return;
    restoreStale();
    if (typeof stale !== 'function') return;
    const own = Object.getOwnPropertyDescriptor(layer, 'stale');
    const wrapped = function(...args) {
      take('stale:enter');
      let returned = false, result;
      try { result = Reflect.apply(stale, this, args); returned = true; return result; }
      finally { take('stale:exit', { returned, stale: returned ? result : undefined }); }
    };
    layer.stale = wrapped; staleRecord = { layer, wrapped, own };
  }
  for (const name of ['beginWorkerGuestSlice', 'endWorkerGuestSlice',
    'beginWorkerGdiPaint', 'endWorkerGdiPaint', '_overlayFrameLayer', 'repaint']) wrap(renderer, name);
  wrap(wine, '_presentNow');
  wrap(presenter, 'present', args => {
    const f = args[0];
    return { completedFrame: f ? { hwnd: f.hwnd, rt: f.rt, seq: f.presentSeq,
      stamp: f.stamp, width: f.width, height: f.height, bitmap: !!f.bitmap,
      pixels: !!f.pixels, surface: !!f.surface } : null };
  });
  watchStale();
  take('installed');
  return Object.freeze({
    sample: () => take('sample'),
    report: () => ({ capacity, count, overwritten: Math.max(0, count - capacity),
      rows: rows.slice(), errors: errors.slice(), extraGuestPolls: 0, guestWrites: 0,
      pixelReads: 0, publicationCalls: 0, closed }),
    close: () => { if (closed) return; take('closed'); closed = true;
      restoreStale();
      for (const restore of restores.reverse()) restore(); },
  });
}

// A classification is deliberately a conjunction of observations, never a
// claim that pending work caused particular pixels or is safe to publish.
function classify(report) {
  const completed = report.rows.filter(r => r.event === 'present:exit' && r.accepted);
  const held = completed.filter(r => r.workerDepth > 0 && r.scheduled && r.deferred);
  const published = report.rows.filter((r, i, a) => i > 0 && r.publication > a[i - 1].publication);
  return { completedFrames: completed.length, completedWhileHeld: held.length,
    publications: published.length,
    longestRetainedHoldMs: held.reduce((max, r) => {
      const end = report.rows.find(v => v.mono >= r.mono && v.publication > r.publication);
      return Math.max(max, (end || report.rows.at(-1)).mono - r.mono);
    }, 0),
    causalPixelConclusion: false, safeMidSlicePublicationProved: false };
}
module.exports = { observePublication, classify };
