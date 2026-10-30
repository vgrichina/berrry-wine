// One Glide endpoint inside the process-owned render Worker. This module
// creates no Worker and never runs a compositor or guest callback.
(function(root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const api = factory(node ? require('./gpu-backend') : root.GpuBackend,
    node ? require('./glide-backend') : root.GlideBackend,
    node ? require('./glide-software') : root.GlideSoftware);
  if (node) module.exports = api;
  else root.GlideRenderWorker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(Gpu, Glide, Software) {
  'use strict';
  function create(options) {
    let device = null, backend = null, closed = false;
    let glRenderer = null;
    const sendFrame = frame => options.sendFrame(frame,
      frame.bitmap ? [frame.bitmap] : [frame.pixels.buffer]);
    function destroy() {
      const old = device, gpu = backend;
      device = null; backend = null; closed = true;
      try { if (old) old.submit(2, new Uint8Array()); }
      finally { if (gpu) gpu.destroy(); }
    }
    function execute(message) {
      if (closed) throw new Error('Glide render endpoint is closed');
      if (message.t !== 'glide-command') throw new Error('Unknown Glide render message');
      const op = message.op | 0, bytes = message.bytes;
      if (!(bytes instanceof Uint8Array)) throw new TypeError('Glide packet must be an owned byte array');
      if (op === 1) {
        if (device) throw new Error('Glide context is already open');
        // 20 bytes (hwnd, w, h, color format, origin), or 24 with word 5 =
        // nColBuffers (1 or 2), which grSstWinOpen has sent since Myth TFL's
        // single-buffered open; the backends read it the same way.
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (bytes.byteLength !== 20 && !(bytes.byteLength === 24 && [1, 2].includes(view.getUint32(20, true))))
          throw new RangeError('Invalid Glide open packet');
        const width = view.getUint32(4, true), height = view.getUint32(8, true);
        if (!width || !height || width > 4096 || height > 4096) return { result: 0 };
        const openSoftware = () => new Software.Device({ getExports: () => options.instance.exports,
          getMemory: () => options.memory.buffer, presentPixels: sendFrame });
        if (options.backend === 'software') {
          device = openSoftware();
        } else if (options.backend === 'webgl') {
          try {
            if (typeof OffscreenCanvas === 'undefined') throw new Error('OffscreenCanvas is unavailable in render Worker');
            backend = new Gpu.WebGLBackend(new OffscreenCanvas(width, height));
          } catch (error) {
            // No WebGL here: rasterize in software rather than failing the
            // guest's grSstWinOpen (same fallback as lib/glide-host.js).
            console.warn('[Glide] ' + error.message + ' — using the software backend');
            backend = null;
            device = openSoftware();
          }
        }
        if (!device && options.backend === 'webgl') {
          device = new Glide.Device({ backend, onPresent(frame) {
            // GPU-to-GPU presentation: no getImageData/readPixels round trip.
            const bitmap = frame.surface.transferToImageBitmap();
            try { sendFrame({ bitmap, hwnd: frame.hwnd, width: frame.width,
              height: frame.height, stats: { ...frame.stats } }); }
            catch (error) { bitmap.close(); throw error; }
          } });
        } else if (!device) throw new Error('Unknown Glide renderer: ' + options.backend);
      }
      if (!device) throw new Error('Glide command without an open context');
      if (op === 2) { destroy(); return { result: 1 }; }
      try {
        const result = device.submit(op, bytes) | 0;
        if (op === 1 && result && backend) {
          const gl = backend.gl, debug = gl.getExtension('WEBGL_debug_renderer_info');
          glRenderer = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
        }
        return { result, ...(op === 1 ? { glRenderer } : {}),
          ...(op === 9 && result ? { bytes } : {}), stats: { ...device.stats } };
      } catch (error) {
        // Keep the error visible to the host. Endpoint teardown owns release.
        if (op === 1) destroy();
        throw error;
      }
    }
    return { execute, destroy };
  }
  return { create };
});
