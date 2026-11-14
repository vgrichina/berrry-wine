// One GPU-stream (Glide) endpoint inside the process-owned render Worker. It
// drains the WAT-written ring in the shared wasm memory; it creates no Worker
// and never runs a compositor or guest callback (docs/gpu-stream-v2.md).
(function(root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const api = factory(node ? require('./gpu-backend') : root.GpuBackend,
    node ? require('./gpu-stream') : root.GpuStream,
    node ? require('./gpu-stream-webgl') : root.GpuStreamWebGL,
    node ? require('./gpu-stream-software') : root.GpuStreamSoftware);
  if (node) module.exports = api;
  else root.GlideRenderWorker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(Gpu, GpuStream, WebGLExec, SoftwareExec) {
  'use strict';
  function create(options) {
    let executor = null, backend = null, ring = null, ringAddr = 0, closed = false, glRenderer = null;
    let stats = { kicks: 0, records: 0 };
    const sendFrame = frame => options.sendFrame(frame,
      frame.bitmap ? [frame.bitmap] : [frame.pixels.buffer]);
    const buffer = () => options.memory.buffer;
    // The executor's own counters (draws, triangles, presents, readbacks)
    // plus this endpoint's kick/record counts, as the page route reports.
    const snapshot = () => ({ ...(executor && executor.stats ? executor.stats() : {}), ...stats });
    function open() {
      const software = () => new SoftwareExec.Executor({ getExports: () => options.instance.exports,
        getMemory: buffer, presentPixels: frame => sendFrame({ pixels: frame.pixels, hwnd: frame.hwnd,
          width: frame.width, height: frame.height, stats: snapshot() }) });
      if (options.backend === 'software') return software();
      if (options.backend !== 'webgl') throw new Error('Unknown Glide renderer: ' + options.backend);
      try {
        if (typeof OffscreenCanvas === 'undefined') throw new Error('OffscreenCanvas is unavailable in render Worker');
        const canvas = new OffscreenCanvas(1, 1);
        backend = new Gpu.WebGLBackend(canvas);
        const gl = backend.gl, debug = gl.getExtension('WEBGL_debug_renderer_info');
        glRenderer = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
        return new WebGLExec.Executor({ canvas, backend, onPresent(frame) {
          // GPU-to-GPU presentation: no getImageData/readPixels round trip.
          const bitmap = frame.surface.transferToImageBitmap();
          try { sendFrame({ bitmap, hwnd: frame.hwnd, width: frame.width,
            height: frame.height, stats: snapshot() }); }
          catch (error) { bitmap.close(); throw error; }
        } });
      } catch (error) {
        // No WebGL here: execute in software rather than failing the
        // guest's grSstWinOpen (same fallback as lib/glide-host.js).
        console.warn('[Glide] ' + error.message + ' — using the software executor');
        if (backend) backend.destroy();
        backend = null; glRenderer = null;
        return software();
      }
    }
    function destroy() {
      const old = executor, gpu = backend;
      executor = null; backend = null; ring = null; ringAddr = 0;
      try { if (old && old.close) old.close(); }
      finally { if (gpu) gpu.destroy(); }
    }
    function execute(message) {
      if (closed) throw new Error('Glide render endpoint is closed');
      if (!message || message.t !== 'gps-kick') throw new Error('Unknown Glide render message');
      const addr = message.ring >>> 0, mode = message.mode | 0;
      if (!executor) executor = open();
      if (!ring || ringAddr !== addr) { ring = new GpuStream.Ring(buffer, addr); ringAddr = addr; }
      stats.kicks++;
      try {
        stats.records += GpuStream.drain([ring], executor).records;
      } catch (error) {
        // drain stored error_seq/error_code in the ring; the producer stops.
        destroy();
        throw error;
      }
      if (mode === GpuStream.CONST.KICK_CLOSE) destroy();
      return { result: 1, glRenderer, stats: snapshot() };
    }
    return { execute, destroy() { closed = true; destroy(); } };
  }
  return { create };
});
