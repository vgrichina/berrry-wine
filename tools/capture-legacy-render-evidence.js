// Browser expression for web-input-probe --steps=evalfile:PATH.
// Read only: never call a guest export, flush a renderer or advance a slice.
// Capture separately at before/idle/after landmarks. Counters are cumulative,
// not FPS, and a requested backend is not proof of its use.
(() => {
  const wine = globalThis.wine;
  if (!wine) return { available: false, reason: 'No active WineAssembly instance' };
  const worker = wine.guestWorker;
  const slice = worker ? wine._workerLastSlice : null;
  const copy = value => value == null ? null : JSON.parse(JSON.stringify(value));
  return {
    available: true,
    capturedAt: new Date().toISOString(),
    processId: wine.processId ?? null,
    stopped: wine._stopped === true,
    execution: worker ? 'guest-worker' : 'cooperative',
    requestedWorkerBackend: worker ? (worker.d3dimGpu ? 'webgl' : 'software') : null,
    mainGuestSlice: slice ? {
      seq: slice.seq ?? null,
      blocks: slice.blocks ?? null,
      trapped: slice.trapped ?? null,
      d3d: copy(slice.d3d),
    } : null,
    childThreads: [...(wine.threadManager?.threads?.values() || [])].map(thread => ({
      tid: thread.tid ?? null, state: thread.state ?? null,
      ownership: 'Listed only; no child render snapshot is sampled',
    })),
    // This object is on the page. It is NOT the owning guest/render Worker.
    pageD3dim: wine.d3dimGpu?.snapshot ? copy(wine.d3dimGpu.snapshot()) : null,
    limitations: [
      'Main guest only; child-thread render ownership is not attested.',
      'Last completed slice may predate capture; require advancing seq and counters between landmarks.',
      'Replay commands include non-draw work; they alone do not prove software rasterization.',
      'WebGL requires owning-renderer draw progress and fallback/error review.',
      'No module, fixture, gameplay, FPS or device qualification is implied.',
    ],
  };
})()
