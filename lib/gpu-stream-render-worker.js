// One GPU stream v2 endpoint inside the process-owned render Worker
// (docs/gpu-stream-v2.md). API-neutral: it drains whichever WAT-written
// GpsRing it is kicked with into a WebGL executor (software when WebGL is
// unavailable) and presents PRESENT records as ImageBitmaps. Glide is the
// first API on it; D3D9, D3DIM and GL rings take the same endpoint.
//
// Two ways records reach it:
//   - a {t:'gps-kick', ring, mode} request (open, CLOSE, and any producer
//     that cannot use the doorbell); the reply comes after the drain;
//   - the doorbell (lib/gpu-stream-doorbell.js): after the first kick the
//     endpoint marks the ring's `consumer` word and waits on write_pos with
//     Atomics.waitAsync. A producer's ASYNC kick is then one Atomics.notify
//     and its SYNC kick an Atomics.wait on done_seq, with no message at all.
// Doorbell drains are scheduled through options.schedule, the Worker's one
// message chain, so they never interleave with another endpoint's work.
// It creates no Worker and never runs a compositor or guest callback.
(function(root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const api = factory(node ? require('./gpu-backend') : root.GpuBackend,
    node ? require('./gpu-stream') : root.GpuStream,
    node ? require('./gpu-stream-doorbell') : root.GpuStreamDoorbell,
    node ? require('./gpu-stream-webgl') : root.GpuStreamWebGL,
    node ? require('./gpu-stream-software') : root.GpuStreamSoftware);
  if (node) module.exports = api;
  else root.GpuStreamRenderWorker = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(Gpu, GpuStream, Doorbell, WebGLExec, SoftwareExec) {
  'use strict';
  function create(options) {
    let executor = null, backend = null, ring = null, ringAddr = 0, closed = false, glRenderer = null;
    let armedRing = 0, armedGeneration = null, i32 = null;
    const api = (options.options && options.options.api) || 'gpu-stream';
    const stats = { kicks: 0, records: 0, doorbellDrains: 0 };
    const sendFrame = frame => options.sendFrame(frame,
      frame.bitmap ? [frame.bitmap] : [frame.pixels.buffer]);
    const buffer = () => options.memory.buffer;
    const words = () => (i32 && i32.buffer === buffer()) ? i32 : (i32 = new Int32Array(buffer()));
    // The executor's own counters (draws, triangles, presents, readbacks)
    // plus this endpoint's kick/record counts, as the page route reports.
    const snapshot = () => ({ ...(executor && executor.stats ? executor.stats() : {}), ...stats,
      doorbell: armedRing !== 0 });
    function open() {
      const software = () => new SoftwareExec.Executor({ getExports: () => options.instance.exports,
        getMemory: buffer, presentPixels: frame => sendFrame({ kind: 'gps', api, pixels: frame.pixels,
          hwnd: frame.hwnd, width: frame.width, height: frame.height, dstX: frame.dstX, dstY: frame.dstY,
          stamp: frame.stamp, rt: frame.rt, presentSeq: frame.presentSeq, stats: snapshot() }) });
      if (options.backend === 'software') return software();
      if (options.backend !== 'webgl') throw new Error('Unknown GPU stream renderer: ' + options.backend);
      try {
        if (typeof OffscreenCanvas === 'undefined') throw new Error('OffscreenCanvas is unavailable in render Worker');
        const canvas = new OffscreenCanvas(1, 1);
        backend = new Gpu.WebGLBackend(canvas);
        const gl = backend.gl, debug = gl.getExtension('WEBGL_debug_renderer_info');
        glRenderer = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
        return new WebGLExec.Executor({ canvas, backend, onPresent(frame) {
          // GPU-to-GPU presentation: no getImageData/readPixels round trip.
          const bitmap = frame.surface.transferToImageBitmap();
          try { sendFrame({ kind: 'gps', api, bitmap, hwnd: frame.hwnd, width: frame.width,
            height: frame.height, dstX: frame.dstX, dstY: frame.dstY, stamp: frame.stamp,
            rt: frame.rt, presentSeq: frame.presentSeq,
            stats: snapshot() }); }
          catch (error) { bitmap.close(); throw error; }
        } });
      } catch (error) {
        // No WebGL here: execute in software rather than failing the
        // guest's open (same fallback as lib/gpu-stream-host.js).
        console.warn('[gpu-stream] ' + error.message + ' — using the software executor');
        if (backend) backend.destroy();
        backend = null; glRenderer = null;
        return software();
      }
    }
    function disarm() {
      if (!armedRing) return;
      const addr = armedRing;
      armedRing = 0;
      armedGeneration = null;
      try {
        Doorbell.detach(words(), addr);
        Doorbell.ring(words(), addr); // release our own pending waitAsync
      } catch (_) { /* memory gone with the process */ }
    }
    function destroy() {
      disarm();
      const old = executor, gpu = backend;
      executor = null; backend = null; ring = null; ringAddr = 0;
      try { if (old && old.close) old.close(); }
      finally { if (gpu) gpu.destroy(); }
    }
    function drainOnce(addr) {
      if (!executor) executor = open();
      if (!ring || ringAddr !== addr) { ring = new GpuStream.Ring(buffer, addr); ringAddr = addr; }
      try {
        stats.records += GpuStream.drain([ring], executor).records;
      } catch (error) {
        // drain stored error_seq/error_code in the ring; the producer stops.
        destroy();
        throw error;
      }
    }
    // Doorbell: wait for write_pos to move, drain, wait again.
    function listen(addr, generation) {
      if (closed || armedRing !== addr || armedGeneration !== generation) return;
      const seen = Doorbell.writePos(words(), addr);
      const wake = () => options.schedule(() => {
        if (closed || armedRing !== addr || armedGeneration !== generation || !executor) return;
        stats.doorbellDrains++;
        // A SYNC waiter allows a busy consumer far longer than an idle one
        // (gpu-stream-doorbell.js BUSY_STALL_MS): one record may compile.
        Doorbell.busy(words(), addr, true);
        try { drainOnce(addr); }
        catch (error) {
          if (options.send) options.send({ t: 'gps-error', ring: addr, error: String(error && error.stack || error) });
          return;
        } finally { Doorbell.busy(words(), addr, false); }
        listen(addr, generation);
      });
      if (seen !== Atomics.load(words(), ((addr >>> 0) >> 2) + Doorbell.W.read_pos)) { wake(); return; }
      Doorbell.whenPublished(words(), addr, seen).then(wake);
    }
    function arm(addr) {
      if (armedRing === addr || !options.schedule || !Doorbell.supported()) return;
      disarm();
      armedRing = addr;
      // The same address can be reopened before a retired waitAsync callback
      // runs. Address equality alone must not adopt that old subscription.
      armedGeneration = {};
      Doorbell.attach(words(), addr, options.endpointId);
      listen(addr, armedGeneration);
    }
    function execute(message) {
      if (closed) throw new Error('GPU stream render endpoint is closed');
      if (!message || message.t !== 'gps-kick') throw new Error('Unknown GPU stream render message');
      const addr = message.ring >>> 0, mode = message.mode | 0;
      stats.kicks++;
      drainOnce(addr);
      if (mode === GpuStream.CONST.KICK_CLOSE) destroy();
      else arm(addr);
      return { result: 1, glRenderer, stats: snapshot() };
    }
    // Passive owner inspection. Return the actual live objects, never the
    // requested backend: WebGL creation may have fallen back to software.
    // No drain, fence, export call or GL synchronization is performed here.
    function identity() {
      return { api, closed, executor, backend, context: backend?.gl || null,
        executorRole: executor instanceof WebGLExec.Executor ? 'webgl' :
          executor instanceof SoftwareExec.Executor ? 'software' : null,
        contextLost: backend?.gl ? backend.gl.isContextLost() : null,
        glRenderer, ring: ringAddr, armed: armedRing !== 0,
        error: ring ? ring.word('error_code') : null, stats: snapshot() };
    }
    return { execute, identity, destroy() { closed = true; destroy(); } };
  }
  return { create };
});
