// Process-owned Glide transport and window presentation. Guest workers call
// this through the import broker, which parks the guest while an asynchronous
// render request completes. Packets are owned snapshots before that wait.
(function(root, factory) {
  const api = factory(
    typeof module !== 'undefined' && module.exports ? require('./gpu-backend') : root.GpuBackend,
    typeof module !== 'undefined' && module.exports ? require('./glide-backend') : root.GlideBackend,
    typeof module !== 'undefined' && module.exports ? require('./glide-software') : root.GlideSoftware);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GlideHost = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(GpuBackend, GlideBackend, GlideSoftware) {
  'use strict';
  class Bridge {
    constructor(options = {}) {
      this.options = options;
      this.device = null;
      this.backend = null;
      this.layer = null;
      this.win = null;
      this.stats = { batches: 0, bytes: 0, presents: 0 };
      this.endpoint = null;
      this.endpointReady = null;
      this.workerChain = Promise.resolve();
      this.workerEpoch = 0;
      this.workerClosing = null;
      this.workerFrameError = null;
      this.workerAsyncError = null;
      this.workerPendingSwap = null;
    }
    _renderer() {
      return typeof this.options.renderer === 'function' ? this.options.renderer() : this.options.renderer;
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
      if (!this.layer) this.layer = { kind: 'gpu', canvas: null, backend: this.backend, writeSeq: 0 };
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
      if (this.options.onPresent) this.options.onPresent(this.layer);
    }
    _detach() {
      if (!this.win) return;
      if (this.win._gpuFrameLayer === this.layer) this.win._gpuFrameLayer = null;
      if (this.win._dxFrameLayer === this.layer) this.win._dxFrameLayer = null;
      const renderer = this._renderer();
      if (renderer && renderer.scheduleRepaint) renderer.scheduleRepaint();
      this.win = null;
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
    _workerSubmit(op, bytes) {
      const epoch = this.workerEpoch, ready = this.endpointReady;
      const result = this.workerChain.then(() => ready).then(endpoint => {
        if (epoch !== this.workerEpoch) throw new Error('Stale Glide worker command');
        return endpoint.request({ t: 'glide-command', op, bytes });
      }).then(reply => {
        if (epoch !== this.workerEpoch) throw new Error('Stale Glide worker completion');
        if (this.workerFrameError) throw this.workerFrameError;
        if (reply.frame) this._workerFrame(reply.frame, epoch);
        if (reply.stats && this.device) this.device.stats = reply.stats;
        if (op === 1 && this.device) this.device.glRenderer = reply.glRenderer ?? null;
        return reply;
      });
      // Preserve submission order even for commands enqueued before open is
      // acknowledged. A rejected command poisons this context until close.
      this.workerChain = result;
      result.catch(() => {});
      return result;
    }
    _openWorker(bytes) {
      const epoch = ++this.workerEpoch;
      this.workerChain = Promise.resolve();
      this.workerFrameError = null;
      this.workerAsyncError = null;
      this.workerPendingSwap = null;
      this.device = { worker: true, stats: {} };
      // Start the process manager synchronously so immediate process teardown
      // sees its retirement fence even before this first request is posted.
      this.endpointReady = (async () => {
        const endpoint = await this.options.createRenderEndpoint({
          api: 'glide', backend: this.options.backend || 'webgl' });
        await endpoint.ready;
        if (epoch !== this.workerEpoch) { await endpoint.terminate(); throw new Error('Glide open cancelled'); }
        this.endpoint = endpoint;
        endpoint.addEventListener('message', event => {
          if (event.data && event.data.t === 'frame') {
            try { this._workerFrame(event.data.frame, epoch); }
            catch (error) { this.workerFrameError = error; }
          }
        });
        return endpoint;
      })();
      return this._workerSubmit(1, bytes).then(reply => {
        if (reply.result !== 1) return this.close().then(() => 0);
        return 1;
      }, async error => { await this.close(); throw error; });
    }
    _open(bytes) {
      if (bytes.byteLength < 20) throw new RangeError('Glide open packet is truncated');
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const width = view.getUint32(4, true), height = view.getUint32(8, true);
      if (!width || !height || width > 4096 || height > 4096) return 0;
      if (this.device || this.workerClosing) throw new Error('Glide context is already open or closing');
      if (this.options.createRenderEndpoint && (!this.options.shouldUseRenderWorker
          || this.options.shouldUseRenderWorker())) return this._openWorker(bytes);
      const makeCanvas = this.options.createCanvas || ((w, h) => {
        if (typeof document === 'undefined') return null;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        return canvas;
      });
      const canvas = makeCanvas(width, height);
      if (!canvas) return 0;
      canvas.width = width; canvas.height = height;
      if (this.options.backend !== 'software') {
        try {
          this.backend = this.options.createBackend ? this.options.createBackend(canvas)
            : new GpuBackend.WebGLBackend(canvas);
        } catch (error) {
          // No WebGL (a GPU-less browser, a lost context, headless Chrome
          // without SwiftShader): fall back to the software rasterizer, the
          // way D3D does in d3dim-gpu.js. Returning 0 here failed the
          // guest's grSstWinOpen and NFS III crashed straight after.
          if (this.options.onError) this.options.onError(error);
          if (!GlideSoftware) return 0;
          if (this.options.onError) this.options.onError(new Error('using the software backend'));
          return this._openSoftware(canvas, bytes);
        }
        try {
          const Device = this.options.Device || GlideBackend.Device;
          this.device = new Device({ backend: this.backend, onPresent: frame => this._present(frame) });
          const result = this.device.submit(1, bytes);
          if (!result) this.close();
          return result | 0;
        } catch (error) {
          this.close();
          throw error;
        }
      }
      return this._openSoftware(canvas, bytes);
    }
    _openSoftware(canvas, bytes) {
      if (!GlideSoftware) throw new Error('Glide software backend is unavailable');
      this.backend = null;
      this.device = new GlideSoftware.Device({
        canvas,
        getExports: this.options.getExports,
        getMemory: () => {
          const memory = this.options.getMemory();
          return memory.buffer || memory;
        },
        onPresent: frame => this._present(frame),
      });
      try {
        const result = this.device.submit(1, bytes);
        if (!result) this.close();
        return result | 0;
      } catch (error) {
        this.close();
        throw error;
      }
    }
    submit(opcode, pointer, length) {
      const memory = this.options.getMemory();
      const buffer = memory.buffer || memory;
      pointer >>>= 0; length >>>= 0;
      if (pointer > buffer.byteLength || length > buffer.byteLength - pointer)
        throw new RangeError('Glide command packet is outside WASM memory');
      const bytes = new Uint8Array(buffer, pointer, length).slice();
      this.stats.bytes += length;
      if (opcode === 1) return this._open(bytes);
      if (!this.device) throw new Error('Glide command without an open context');
      if (opcode === 0) this.stats.batches++;
      if (opcode === 2) {
        const closed = this.close();
        return closed && typeof closed.then === 'function' ? closed.then(() => 1) : 1;
      }
      if (this.device.worker && this.workerAsyncError) throw this.workerAsyncError;
      // Draw batches, LFB writes and buffer swaps answer only "ok", and their
      // bytes are already copied, so the guest need not park while the render
      // Worker draws them: answering 1 at once lets the guest emulate the next
      // frame while this one rasterizes. A failure poisons the context and is
      // raised on the next call. A swap still waits for the PREVIOUS swap, so
      // the renderer is never more than one frame behind the guest.
      if (this.device.worker && (opcode === 0 || opcode === 4 || opcode === 10)) {
        const done = this._workerSubmit(opcode, bytes);
        done.catch(error => { if (!this.workerAsyncError) this.workerAsyncError = error; });
        if (opcode !== 4) return 1;
        const previous = this.workerPendingSwap;
        this.workerPendingSwap = done;
        return previous ? previous.then(() => 1) : 1;
      }
      if (this.device.worker) return this._workerSubmit(opcode, bytes).then(reply => {
        if (opcode === 9 && reply.result) {
          if (!(reply.bytes instanceof Uint8Array) || reply.bytes.length !== length)
            throw new RangeError('Invalid Glide worker readback');
          // Memory may have grown while the render Worker owned this request.
          const current = this.options.getMemory(), storage = current.buffer || current;
          if (pointer > storage.byteLength || length > storage.byteLength - pointer)
            throw new RangeError('Glide readback destination is outside WASM memory');
          new Uint8Array(storage, pointer, length).set(reply.bytes);
        }
        return reply.result | 0;
      });
      const result = this.device.submit(opcode, bytes) | 0;
      // Readback is a synchronous barrier. Publish only after the backend
      // completed every earlier draw; borrowed guest storage is still valid.
      if (opcode === 9 && result) new Uint8Array(buffer, pointer, length).set(bytes);
      return result;
    }
    close() {
      if (this.workerClosing) return this.workerClosing;
      if (this.endpointReady) {
        const ready = this.endpointReady, pending = this.workerChain, epoch = this.workerEpoch;
        let firstError;
        this.endpointReady = null;
        this.device = null; this.endpoint = null;
        this._detach(); this.layer = null; this.workerCanvas = null;
        this.workerClosing = Promise.resolve(pending).catch(error => { firstError = error; })
          .then(() => ready).then(async endpoint => {
          try { await endpoint.request({ t: 'glide-command', op: 2, bytes: new Uint8Array() }); }
          catch (error) { if (!firstError) firstError = error; }
          finally { await endpoint.terminate(); }
          if (firstError) throw firstError;
        }).finally(() => {
          if (epoch === this.workerEpoch) ++this.workerEpoch;
          this.workerClosing = null;
        });
        return this.workerClosing;
      }
      const device = this.device, backend = this.backend;
      this.device = null;
      this.backend = null;
      this._detach();
      this.layer = null;
      try { if (device) device.submit(2, new Uint8Array()); }
      finally { if (backend && typeof backend.destroy === 'function') backend.destroy(); }
    }
  }
  return { Bridge };
});
