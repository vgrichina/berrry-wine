// Process-owned GPU stream v2 consumer and window presentation
// (docs/gpu-stream-v2.md). API-neutral: a WAT frontend writes byte records
// into a GpsRing in shared wasm memory and calls gpu_stream_kick(ring, mode);
// this bridge only gets those records to an executor and hands PRESENTed
// frames to the compositor. No API state lives in JS. Glide is the first
// user (lib/glide-host.js); D3D9, D3DIM and GL rings take the same bridge.
//
// Routes:
//   - render Worker (the default wherever the page can wait for it: a guest
//     Worker owns the emulator). The Worker drains the same shared ring.
//     The first kick opens the endpoint with a request; from then on the
//     Worker listens on the ring's doorbell (lib/gpu-stream-doorbell.js), so
//     an ASYNC kick is one Atomics.notify, not a message. A guest Worker
//     rings and waits on that doorbell itself (lib/guest-rpc.js) and never
//     reaches this bridge; kicks that do (SYNC/CLOSE from the page broker,
//     or any kick before the doorbell is armed) are requests, and their
//     promise parks the guest in the import broker.
//   - local: the executor runs on this thread and the drain is synchronous.
//     Cooperative mode (the emulator itself on the page) takes it: the page
//     cannot block in a SYNC kick, so a Worker could not answer one in time.
//
// Presentation is the same for every API and route: presentFrame() puts the
// frame in the window's kind:'gpu' frame layer (`_dxFrameLayer`, the slot
// DirectDraw, OpenGL and the D3DIM GPU present use), so the single
// back-canvas rule (docs/js-libraries.md) holds. A Worker frame arrives as a
// transferred ImageBitmap and is drawn GPU to GPU; nothing is read back.
// Pixels return to the CPU only through a READBACK record.
(function(root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  // Executors load on first use: a process that never opens a GPU stream
  // device (or only dumps through the null executor) does not need them.
  const api = factory(
    node ? require('./gpu-stream') : root.GpuStream,
    node ? require('./gpu-stream-doorbell') : root.GpuStreamDoorbell,
    node ? require('./gpu-backend') : root.GpuBackend,
    name => node ? require(name === 'webgl' ? './gpu-stream-webgl' : './gpu-stream-software')
      : root[name === 'webgl' ? 'GpuStreamWebGL' : 'GpuStreamSoftware']);
  if (node) module.exports = api;
  if (root) root.GpuStreamHost = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(GpuStream, Doorbell, GpuBackend, executorModule) {
  'use strict';
  const KICK_ASYNC = GpuStream.CONST.KICK_ASYNC, KICK_CLOSE = GpuStream.CONST.KICK_CLOSE;
  const MAX_FRAME = 4096;

  // ── presentation ──────────────────────────────────────────────────────
  // One window frame layer per device. `frame` carries either `surface` (a
  // local executor's canvas, valid until its next present, shown as is),
  // `bitmap` (a transferred ImageBitmap, drawn into the layer's own canvas
  // and closed) or `pixels` (the software executor's RGBA rows).
  class Presenter {
    constructor(options) {
      this.options = options;
      this.layer = null;
      this.win = null;
      this.canvas = null;     // the layer's own canvas, for bitmap/pixel frames
      this.presents = 0;
      this.stale = 0;         // frames dropped for an older PRESENT stamp
      this.stamp = null;      // newest stamp shown
    }
    _renderer() {
      const r = this.options.renderer;
      return typeof r === 'function' ? r() : r;
    }
    _hwnd(frame) {
      let hwnd = frame.hwnd >>> 0;
      // A null window handle (Glide permits one) means the process's present
      // window. The guest may have created it on a Worker, so use the shared
      // window-table fallback rather than the page's thread-local main HWND.
      if (!hwnd && this.options.getExports) {
        const exports = this.options.getExports();
        if (exports && exports.get_dx_present_hwnd) hwnd = exports.get_dx_present_hwnd() >>> 0;
      }
      return hwnd;
    }
    _ownCanvas(width, height) {
      const canvas = this.canvas || (this.canvas = this.options.createCanvas
        ? this.options.createCanvas(width, height) : document.createElement('canvas'));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      return canvas;
    }
    present(frame) {
      try {
        // A window-relative destination is D2 (windowed Blt / child
        // presents); until then a nonzero one is refused, not ignored.
        if ((frame.dstX | 0) !== 0 || (frame.dstY | 0) !== 0)
          throw new RangeError('GPU stream PRESENT dst offset is not supported yet');
        // The stamp is the CPU-present sequence: a frame older than the one
        // already shown (out-of-order delivery) is dropped.
        if (frame.stamp !== undefined) {
          const stamp = frame.stamp >>> 0;
          if (this.stamp !== null && GpuStream.seqBefore(stamp, this.stamp)) { this.stale++; return; }
          this.stamp = stamp;
        }
        let surface = frame.surface || null;
        if (!surface) {
          const width = frame.width >>> 0, height = frame.height >>> 0;
          if (!width || !height || width > MAX_FRAME || height > MAX_FRAME)
            throw new RangeError('Invalid GPU stream frame dimensions');
          surface = this._ownCanvas(width, height);
          const context = surface.getContext('2d');
          if (frame.bitmap) {
            // A frame replaces the layer, alpha included: never blend it
            // over the previous one.
            context.globalCompositeOperation = 'copy';
            context.drawImage(frame.bitmap, 0, 0);
            context.globalCompositeOperation = 'source-over';
          } else {
            if (!frame.pixels || frame.pixels.byteLength !== width * height * 4)
              throw new RangeError('Invalid GPU stream pixel frame');
            const image = context.createImageData(width, height);
            image.data.set(frame.pixels); context.putImageData(image, 0, 0);
          }
        }
        this._show(this._hwnd(frame), surface, frame);
      } finally { if (frame.bitmap && frame.bitmap.close) frame.bitmap.close(); }
    }
    _show(hwnd, surface, frame) {
      const renderer = this._renderer();
      const win = renderer && renderer.windows && renderer.windows[hwnd];
      if (!this.layer) this.layer = { kind: 'gpu', api: this.options.api || 'gpu-stream', canvas: null, writeSeq: 0 };
      if (this.win && this.win !== win) this.detach();
      this.win = win || null;
      this.layer.canvas = surface;
      this.layer.mergedIntoWindow = false;
      this.layer.writeSeq = renderer && renderer.nextSurfaceWriteSeq
        ? renderer.nextSurfaceWriteSeq() : this.layer.writeSeq + 1;
      if (win) {
        // GPU-only windows still need their ordinary backing surface: the
        // compositor and input viewport derive window geometry from it.
        if (!win._backCanvas && renderer.getWindowCanvas) renderer.getWindowCanvas(hwnd);
        if (win.isChild) win._canonicalOwnSurface = true;
        win._gpuFrameLayer = this.layer;
        win._dxFrameLayer = this.layer;
        if (renderer.scheduleRepaint) renderer.scheduleRepaint();
      }
      this.presents++;
      if (this.options.onPresent) this.options.onPresent(this.layer, frame);
    }
    detach() {
      if (!this.win) return;
      if (this.win._gpuFrameLayer === this.layer) this.win._gpuFrameLayer = null;
      if (this.win._dxFrameLayer === this.layer) this.win._dxFrameLayer = null;
      const renderer = this._renderer();
      if (renderer && renderer.scheduleRepaint) renderer.scheduleRepaint();
      this.win = null;
    }
    reset() { this.detach(); this.layer = null; this.canvas = null; this.stamp = null; }
  }

  // ── consumer bridge ───────────────────────────────────────────────────
  class Bridge {
    // options.api names the render-Worker endpoint ('glide', later 'd3d9'...).
    constructor(options = {}) {
      this.options = options;
      this.api = options.api || 'gpu-stream';
      this.executor = null;     // local route: the executor (maybe a dump tee)
      this.ring = null;         // local route: GpuStream.Ring for ringAddr
      this.ringAddr = 0;
      this.dump = null;
      this.stats = { kicks: 0, records: 0, presents: 0, doorbells: 0 };
      this.endpoint = null;
      this.endpointReady = null;
      this.workerEpoch = 0;
      this.workerClosing = null;
      this.workerAsyncError = null;
      this.workerTail = Promise.resolve();
      this.device = null;       // {worker:true, glRenderer, stats} or {stats}
      this.presenter = new Presenter({ api: this.api, renderer: options.renderer,
        getExports: options.getExports, createCanvas: options.createCanvas,
        onPresent: (layer, frame) => { this.stats.presents++; if (options.onPresent) options.onPresent(layer, frame); } });
    }
    get layer() { return this.presenter.layer; }
    get win() { return this.presenter.win; }
    _buffer() {
      const memory = this.options.getMemory();
      return memory.buffer || memory;
    }
    _canvas() {
      if (this.options.createCanvas) return this.options.createCanvas(1, 1);
      if (typeof document === 'undefined') return null;
      return document.createElement('canvas');
    }
    // Executor for the local route: WebGL unless software is asked for or no
    // WebGL context exists (a GPU-less browser, headless Chrome without
    // SwiftShader); then the software executor, like D3D's fallback.
    _openLocal() {
      const onPresent = frame => this.presenter.present(frame);
      let executor = null;
      if (this.options.createExecutor) {
        // Embedder/test-supplied executor.
        executor = this.options.createExecutor({ onPresent });
        this.device = { stats: {}, glRenderer: null };
      } else if (this.options.backend === 'null') {
        // Validates and counts records, draws nothing (dumps, frontend cost).
        executor = new GpuStream.NullExecutor();
        this.device = { stats: {}, glRenderer: null };
      } else if (this.options.backend !== 'software') {
        const WebGLExec = executorModule('webgl');
        const canvas = this._canvas();
        try {
          if (!canvas) throw new Error('no canvas for the GPU stream WebGL executor');
          const backend = this.options.createBackend ? this.options.createBackend(canvas)
            : new GpuBackend.WebGLBackend(canvas);
          executor = new WebGLExec.Executor({ canvas, backend, onPresent });
          this.device = { stats: {}, glRenderer: backend.gl ? rendererName(backend.gl) : null };
        } catch (error) {
          const fallback = new Error(error.message + ' — falling back to the software executor');
          if (this.options.onError) this.options.onError(fallback);
          else console.warn('[gpu-stream] ' + fallback.message);
          executor = null;
        }
      }
      if (!executor) {
        const SoftwareExec = executorModule('software');
        executor = new SoftwareExec.Executor({
          canvas: this._canvas(),
          getExports: this.options.getExports,
          getMemory: () => this._buffer(),
          onPresent,
        });
        this.device = { stats: {}, glRenderer: null };
      }
      if (this.options.dumpPath || this.options.dumpSink) {
        if (!this.dump) this.dump = new GpuStream.DumpWriter(this.options.dumpPath || this.options.dumpSink);
        executor = GpuStream.tee(executor, this.dump);
        executor.close = () => { const inner = executor.inner; if (inner.close) inner.close(); };
      }
      return executor;
    }
    _ring(addr) {
      if (!this.ring || this.ringAddr !== addr) {
        this.ring = new GpuStream.Ring(() => this._buffer(), addr);
        this.ringAddr = addr;
      }
      return this.ring;
    }
    _useWorker() {
      return !!this.endpointReady || (!this.executor && !!this.options.createRenderEndpoint
        && (!this.options.shouldUseRenderWorker || this.options.shouldUseRenderWorker()));
    }
    // gpu_stream_kick(ringHeaderWA, mode). Returns 1 when every record the
    // producer published is executed (local route) or handed to the Worker
    // (ASYNC), 0 when no executor can exist. Executor errors are stored in
    // the ring (error_seq/error_code) by drain() and rethrown here.
    kick(ring, mode) {
      ring >>>= 0; mode |= 0;
      this.stats.kicks++;
      if (this.workerAsyncError) throw this.workerAsyncError;
      if (this._useWorker()) return this._kickWorker(ring, mode);
      if (!this.executor) this.executor = this._openLocal();
      const r = this._ring(ring);
      const { records } = GpuStream.drain([r], this.executor);
      this.stats.records += records;
      if (mode === KICK_CLOSE) this._closeLocal();
      return 1;
    }
    _closeLocal() {
      const executor = this.executor;
      this.executor = null; this.ring = null; this.ringAddr = 0;
      this.device = null;
      this.presenter.reset();
      if (executor && executor.close) executor.close();
    }
    _openWorker() {
      const epoch = ++this.workerEpoch;
      this.workerAsyncError = null;
      this.workerTail = Promise.resolve();
      this.device = { worker: true, stats: {}, glRenderer: null };
      this.endpointReady = (async () => {
        const endpoint = await this.options.createRenderEndpoint({
          api: this.api, backend: this.options.backend || 'webgl' });
        await endpoint.ready;
        if (epoch !== this.workerEpoch) { await endpoint.terminate(); throw new Error('GPU stream open cancelled'); }
        this.endpoint = endpoint;
        endpoint.addEventListener('message', event => {
          const data = event.data;
          if (!data) return;
          if (data.t === 'frame') {
            try { this._workerFrame(data.frame, epoch); }
            catch (error) { this.workerAsyncError ||= error; }
          } else if (data.t === 'gps-error' && epoch === this.workerEpoch) {
            // A doorbell drain failed. The ring holds error_code, so the
            // producer traps on its next check; keep the text for the trap.
            this.workerAsyncError ||= new Error(data.error);
            if (this.options.onError) this.options.onError(this.workerAsyncError);
          }
        });
        return endpoint;
      })();
      this.endpointReady.catch(error => { this.workerAsyncError ||= error; });
    }
    _workerFrame(frame, epoch) {
      if (epoch !== this.workerEpoch || !this.device) {
        if (frame && frame.bitmap && frame.bitmap.close) frame.bitmap.close();
        return;
      }
      if (frame.stats) this.device.stats = frame.stats;
      this.presenter.present(frame);
    }
    _kickWorker(ring, mode) {
      if (this.workerClosing) throw new Error('GPU stream render Worker is closing');
      if (!this.endpointReady) this._openWorker();
      // Steady state: the Worker listens on this ring's doorbell, so an
      // ASYNC kick is a notify. (SYNC cannot wait here: the page never
      // blocks; it stays a request the broker parks the guest on.)
      if (mode === KICK_ASYNC && this.endpoint) {
        const i32 = Doorbell.view(this._buffer(), ring);
        if (Doorbell.armed(i32, ring)) { Doorbell.ring(i32, ring); this.stats.doorbells++; return 1; }
      }
      const epoch = this.workerEpoch, ready = this.endpointReady;
      const done = this.workerTail.then(() => ready).then(endpoint => {
        if (epoch !== this.workerEpoch) throw new Error('Stale GPU stream worker kick');
        return endpoint.request({ t: 'gps-kick', ring, mode });
      }).then(reply => {
        if (reply.stats && this.device) this.device.stats = reply.stats;
        if (reply.glRenderer !== undefined && this.device) this.device.glRenderer = reply.glRenderer;
        if (this.workerAsyncError) throw this.workerAsyncError;
        return reply.result | 0;
      });
      this.workerTail = done.catch(error => { this.workerAsyncError ||= error; });
      if (mode === KICK_ASYNC) return 1;
      if (mode === KICK_CLOSE) return done.then(result => this._retireWorker().then(() => result));
      return done;
    }
    _retireWorker() {
      const ready = this.endpointReady, epoch = this.workerEpoch;
      this.endpointReady = null; this.endpoint = null; this.device = null;
      this.presenter.reset();
      this.workerClosing = Promise.resolve(ready).then(endpoint => endpoint.terminate(), () => {})
        .finally(() => {
          if (epoch === this.workerEpoch) ++this.workerEpoch;
          this.workerClosing = null;
        });
      return this.workerClosing;
    }
    // Process teardown (not a guest call): drop the executor or the Worker.
    close() {
      if (this.workerClosing) return this.workerClosing;
      if (this.endpointReady) return this.workerTail.then(() => this._retireWorker());
      this._closeLocal();
      if (this.dump) { this.dump.close(); this.dump = null; }
    }
  }
  function rendererName(gl) {
    try {
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    } catch (_) { return null; }
  }
  return { Bridge, Presenter, rendererName };
});
