// Where does the time go between a key and the frame that shows it?
//
// Arms a page-side timeline, in performance.now() milliseconds:
//   key    DOM keydown/keyup (capture phase), stamped with event.timeStamp --
//          the moment the browser created the event, before any page work.
//   deq    the guest's message poll took the WM_KEYDOWN/WM_KEYUP
//          (renderer.takeInput; in Threads mode the Worker's check_input
//          broker call lands here too, so both modes stamp the same seam).
//   frame  a guest present reached the page (WinePerf.guestFrame, called
//          from the GPU stream presenter after the frame is on its layer),
//          with a 128x96 luma thumbnail of that layer so a reader can find the
//          first frame whose pixels changed because of the key.
//   paint  renderer.repaint(): the composite that puts the layer on #screen.
//
// Everything is in page time, so one clock covers both modes. A Worker
// guest's own present happens before `frame`; that transit is part of the
// measured gap, not hidden from it.
//
// Pass as an evalfile: step of tools/web-input-probe.js after launch; read
// back with read-key-latency.js and summarize with tools/key-latency-report.js.
(function () {
  if (window.__keyLatency) return 'already armed';
  const wine = window.wine, r = wine && wine.renderer, perf = window.WinePerf;
  if (!r || typeof r.takeInput !== 'function') return 'no renderer.takeInput';
  if (!perf || typeof perf.guestFrame !== 'function') return 'no WinePerf (load with ?debug&perf)';
  const log = { startedAt: performance.now(), keys: [], deq: [], frames: [], paints: [], dropped: 0 };
  window.__keyLatency = log;
  const MAX_FRAMES = 6000, W = 128, H = 96;
  const onKey = e => {
    if (log.keys.length < 2000) log.keys.push({ t: e.timeStamp, at: performance.now(), type: e.type, code: e.code, repeat: e.repeat });
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);

  // enq: the renderer queued the key message (the DOM handler ran).
  log.enq = [];
  for (const [name, msg] of [['handleKeyDown', 0x100], ['handleKeyUp', 0x101]]) {
    const fn = r[name];
    if (typeof fn !== 'function') continue;
    r[name] = function (vk, ...rest) {
      if (log.enq.length < 4000) log.enq.push({ t: performance.now(), msg, vk: vk >>> 0 });
      return fn.call(this, vk, ...rest);
    };
  }
  // polls: every guest message poll that reached the renderer, taken or not
  // (in Threads mode only the ones the Worker's local fast path forwarded).
  log.polls = [];
  const take = r.takeInput;
  r.takeInput = function (...args) {
    const evt = take.apply(this, args);
    const t = performance.now();
    if (log.polls.length < 40000) log.polls.push(t);
    if (evt && (evt.msg === 0x100 || evt.msg === 0x101) && log.deq.length < 4000) {
      log.deq.push({ t, msg: evt.msg, vk: evt.wParam >>> 0 });
    }
    return evt;
  };

  let thumb = null, tctx = null;
  const layerCanvas = () => {
    for (const w of Object.values(r.windows || {})) {
      const l = w && (w._gpuFrameLayer || w._dxFrameLayer);
      if (l && l.canvas) return l.canvas;
    }
    return null;
  };
  const guestFrame = perf.guestFrame;
  perf.guestFrame = function (...args) {
    const t = performance.now();
    const res = guestFrame.apply(this, args);
    if (log.frames.length >= MAX_FRAMES) { log.dropped++; return res; }
    let luma = null;
    try {
      const src = layerCanvas();
      if (src && src.width > 0) {
        if (!thumb) {
          thumb = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(W, H) : document.createElement('canvas');
          thumb.width = W; thumb.height = H;
          tctx = thumb.getContext('2d', { willReadFrequently: true });
        }
        tctx.drawImage(src, 0, 0, W, H);
        const d = tctx.getImageData(0, 0, W, H).data;
        const out = new Uint8Array(W * H);
        for (let i = 0; i < W * H; i++) out[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
        let s = '';
        for (let i = 0; i < out.length; i++) s += String.fromCharCode(out[i]);
        luma = btoa(s);
      }
    } catch (e) { luma = null; log.thumbError = String(e && e.message || e); }
    log.frames.push({ t, cost: performance.now() - t, luma });
    return res;
  };

  const repaint = r.repaint;
  r.repaint = function (...args) {
    const t = performance.now();
    const res = repaint.apply(this, args);
    if (log.paints.length < 12000) log.paints.push(t);
    return res;
  };
  return 'armed: thumbs ' + W + 'x' + H + ', threads=' + !!wine.guestWorker;
})()
