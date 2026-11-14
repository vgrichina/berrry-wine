// Process-owned Glide consumer and window presentation (GPU stream v2,
// docs/gpu-stream-v2.md). WAT writes every Glide call as byte records into a
// GpsRing in shared wasm memory and calls gpu_stream_kick(ring, mode); this
// bridge only drains that ring into an executor (WebGL, else software) and
// hands presented frames to the compositor. No Glide state lives in JS.
//
// Two routes: local (the executor runs here, the drain is synchronous) and
// the process render Worker (the Worker drains the same shared ring; ASYNC
// kicks are posted and not awaited, SYNC/CLOSE kicks resolve after the
// Worker executed every published record, which the import broker parks
// the guest for). The Worker processes messages in order, so a SYNC kick
// completes every earlier ASYNC one.
(function(root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  // Executors load on first use: a process that never opens Glide (or only
  // dumps through the null executor) does not need them.
  const api = factory(
    node ? require('./gpu-stream') : root.GpuStream,
    node ? require('./gpu-backend') : root.GpuBackend,
    name => node ? require(name === 'webgl' ? './gpu-stream-webgl' : './gpu-stream-software')
      : root[name === 'webgl' ? 'GpuStreamWebGL' : 'GpuStreamSoftware']);
  if (node) module.exports = api;
  if (root) root.GlideHost = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(GpuStream, GpuBackend, executorModule) {
  'use strict';
  const KICK_ASYNC = GpuStream.CONST.KICK_ASYNC, KICK_CLOSE = GpuStream.CONST.KICK_CLOSE;

  class Bridge {
    constructor(options = {}) {
      this.options = options;
      this.executor = null;     // local route: the executor (maybe a dump tee)
      this.ring = null;         // local route: GpuStream.Ring for ringAddr
      this.ringAddr = 0;
      this.layer = null;
      this.win = null;
      this.dump = null;
      this.stats = { kicks: 0, records: 0, presents: 0 };
      this.endpoint = null;
      this.endpointReady = null;
      this.workerEpoch = 0;
      this.workerClosing = null;
      this.workerAsyncError = null;
      this.workerTail = Promise.resolve();
      this.device = null;       // {worker:true, glRenderer, stats} or {stats}
    }
    _renderer() {
      return typeof this.options.renderer === 'function' ? this.options.renderer() : this.options.renderer;
    }
    _buffer() {
      const memory = this.options.getMemory();
      return memory.buffer || memory;
    }
    _present(frame) {
      const renderer = this._renderer();
      let hwnd = frame.hwnd >>> 0;
      // Glide permits a null window handle. The guest may have created its
      // fullscreen window on a Worker, so use the shared-window-table fallback
      // rather than the page instance's thread-local main HWND.
      if (!hwnd && this.options.getExports) {
        const exports = this.options.getExports();
        if (exports && exports.get_dx_present_hwnd) hwnd = exports.get_dx_present_hwnd() >>> 0;
      }
      const win = renderer && renderer.windows && renderer.windows[hwnd];
      if (!this.layer) this.layer = { kind: 'gpu', canvas: null, backend: null, writeSeq: 0 };
      if (this.win && this.win !== win) this._detach();
      this.win = win || null;
      this.layer.canvas = frame.surface;
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
      this.stats.presents++;
      if (this.options.onPresent) this.options.onPresent(this.layer, frame);
    }
    _detach() {
      if (!this.win) return;
      if (this.win._gpuFrameLayer === this.layer) this.win._gpuFrameLayer = null;
      if (this.win._dxFrameLayer === this.layer) this.win._dxFrameLayer = null;
      const renderer = this._renderer();
      if (renderer && renderer.scheduleRepaint) renderer.scheduleRepaint();
      this.win = null;
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
      const onPresent = frame => this._present(frame);
      let executor = null;
      if (this.options.createExecutor) {
        // Embedder/test-supplied executor (the old bridge's Device option).
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
          if (!canvas) throw new Error('no canvas for the Glide WebGL executor');
          const backend = this.options.createBackend ? this.options.createBackend(canvas)
            : new GpuBackend.WebGLBackend(canvas);
          executor = new WebGLExec.Executor({ canvas, backend, onPresent });
          this.device = { stats: {}, glRenderer: backend.gl ? rendererName(backend.gl) : null };
        } catch (error) {
          const fallback = new Error(error.message + ' — falling back to the software executor');
          if (this.options.onError) this.options.onError(fallback);
          else console.warn('[Glide] ' + fallback.message);
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
    // gpu_stream_kick(ringHeaderWA, mode). Returns 1 when every record the
    // producer published is executed (local route) or handed to the Worker
    // (ASYNC), 0 when no executor can exist. Executor errors are stored in
    // the ring (error_seq/error_code) by drain() and rethrown here.
    kick(ring, mode) {
      ring >>>= 0; mode |= 0;
      this.stats.kicks++;
      if (this.workerAsyncError) throw this.workerAsyncError;
      if (this.endpointReady || (!this.executor && this.options.createRenderEndpoint
          && (!this.options.shouldUseRenderWorker || this.options.shouldUseRenderWorker())))
        return this._kickWorker(ring, mode);
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
      this._detach(); this.layer = null;
      if (executor && executor.close) executor.close();
    }
    _openWorker() {
      const epoch = ++this.workerEpoch;
      this.workerAsyncError = null;
      this.workerTail = Promise.resolve();
      this.device = { worker: true, stats: {}, glRenderer: null };
      this.endpointReady = (async () => {
        const endpoint = await this.options.createRenderEndpoint({
          api: 'glide', backend: this.options.backend || 'webgl' });
        await endpoint.ready;
        if (epoch !== this.workerEpoch) { await endpoint.terminate(); throw new Error('Glide open cancelled'); }
        this.endpoint = endpoint;
        endpoint.addEventListener('message', event => {
          if (event.data && event.data.t === 'frame') {
            try { this._workerFrame(event.data.frame, epoch); }
            catch (error) { this.workerAsyncError ||= error; }
          }
        });
        return endpoint;
      })();
      this.endpointReady.catch(error => { this.workerAsyncError ||= error; });
    }
    _workerFrame(frame, epoch) {
      try {
        if (epoch !== this.workerEpoch || !this.device) return;
        const width = frame.width >>> 0, height = frame.height >>> 0;
        if (!width || !height || width > 4096 || height > 4096)
          throw new RangeError('Invalid Glide worker frame dimensions');
        const canvas = this.workerCanvas || (this.workerCanvas = this.options.createCanvas
          ? this.options.createCanvas(width, height) : document.createElement('canvas'));
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        const context = canvas.getContext('2d');
        if (frame.bitmap) context.drawImage(frame.bitmap, 0, 0);
        else {
          if (!frame.pixels || frame.pixels.byteLength !== width * height * 4)
            throw new RangeError('Invalid Glide worker pixel snapshot');
          const image = context.createImageData(width, height);
          image.data.set(frame.pixels); context.putImageData(image, 0, 0);
        }
        if (frame.stats) this.device.stats = frame.stats;
        this._present({ ...frame, surface: canvas });
      } finally { if (frame.bitmap && frame.bitmap.close) frame.bitmap.close(); }
    }
    _kickWorker(ring, mode) {
      if (this.workerClosing) throw new Error('Glide render Worker is closing');
      if (!this.endpointReady) this._openWorker();
      const epoch = this.workerEpoch, ready = this.endpointReady;
      const done = this.workerTail.then(() => ready).then(endpoint => {
        if (epoch !== this.workerEpoch) throw new Error('Stale Glide worker kick');
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
      this._detach(); this.layer = null; this.workerCanvas = null;
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
  return { Bridge, rendererName };
});
