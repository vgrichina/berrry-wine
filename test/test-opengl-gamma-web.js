#!/usr/bin/env node
'use strict';
// OpenGL display gamma: SetDeviceGammaRamp tables reach the presented image
// of an OpenGL window (local bridge and a real render Worker frame), and
// nothing else -- not the GL drawable, not its readback, not DirectDraw.
// Usage: node test/test-opengl-gamma-web.js [--metal]

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const PAGE_LIBS = ['region-map.generated', 'gpu-backend', 'gl-command-stream', 'mem-utils', 'gl-compat',
  'gl-render-worker', 'render-worker', 'gl-render-host', 'dib', 'presentation-filter', 'renderer'];
// What a GL render Worker evaluates (cf. test-opengl-webgl-drawables-web.js).
const WORKER_LIBS = ['region-map.generated', 'gpu-backend', 'gl-command-stream', 'mem-utils', 'gl-compat',
  'gl-render-worker'];

async function runGammaTests(workerSource) {
  const same = (a, b, label) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`${label}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  };
  const COLOR = [64, 96, 128, 255];
  const CORRECTED = [191, 127, 64, 255];
  const memory = { buffer: new ArrayBuffer(8192) };
  const dv = new DataView(memory.buffer);
  let generation = 0;
  const exports = { guest_to_wasm: p => p, gamma_ramp_wa: () => 4096, gamma_ramp_gen: () => generation };
  const words = new Uint16Array(memory.buffer, 4096, 768);
  // Distinct per-channel tables: R inverted, G lifted by 31, B halved.
  const ramp = changed => {
    for (let i = 0; i < 256; i++) {
      words[i] = (changed ? 255 - i : i) * 257;
      words[256 + i] = (changed ? Math.min(255, i + 31) : i) * 257;
      words[512 + i] = (changed ? i >> 1 : i) * 257;
    }
    generation++;
  };
  const f32 = x => { const b = new DataView(new ArrayBuffer(4)); b.setFloat32(0, x, true); return b.getUint32(0, true); };
  const newCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const pixel = canvas => Array.from(canvas.getContext('2d').getImageData(2, 2, 1, 1).data);
  const clearColor = COLOR.map(v => f32(v / 255));

  // A real Worker running the production GL endpoint; frames come back as
  // transferred ImageBitmaps exactly as the shared render Worker sends them.
  function startConsumer() {
    const memory = { buffer: new ArrayBuffer(4096) }, v = new DataView(memory.buffer);
    const endpoint = GLRenderWorker.create({ instance: { exports: { guest_to_wasm: p => p } }, memory, backend: 'webgl',
      sendFrame(frame) { self.postMessage({ frame }, frame.bitmap ? [frame.bitmap] : []); } });
    const windows = [{ hwnd: 1, w: 16, h: 16, clientSize: { w: 16, h: 16 }, generation: 1 }];
    self.onmessage = ({ data }) => {
      try {
        const { id, op, args = [], aux = 0 } = data, stackBytes = (args.length + 1) * 4, bytes = 32 + stackBytes;
        new Uint8Array(memory.buffer, 0, bytes).fill(0);
        v.setUint32(0, bytes, true); v.setUint32(4, op, true); v.setUint32(8, aux >>> 0, true); v.setUint32(12, stackBytes, true);
        args.forEach((a, i) => v.setUint32(36 + i * 4, a >>> 0, true));
        const result = endpoint.execute({ windows, memoryOffset: 0, bytes, owner: 1 });
        self.postMessage({ id, value: result.value });
      } catch (e) { self.postMessage({ id: data.id, error: String(e), stack: e.stack }); }
    };
  }

  ramp(false);
  const results = [];
  for (const workerMode of [false, true]) {
    const win = { hwnd: 1, w: 16, h: 16, x: 0, y: 0, visible: true, clientRect: { w: 16, h: 16 },
      wasm: { exports }, wasmMemory: memory };
    const renderer = { windows: { 1: win }, needsRepaint: false, repaint() {}, scheduleRepaint() {},
      mergeGpuLayerIntoBackCanvas() {} };
    let bridge, worker, url, readback;
    if (workerMode) {
      const host = new GLRenderHost.Bridge({ renderer, exports, createCanvas: newCanvas });
      url = URL.createObjectURL(new Blob([workerSource, '\n(' + startConsumer.toString() + ')();'], { type: 'text/javascript' }));
      worker = new Worker(url);
      const pending = new Map(); let next = 1, frame = null;
      const guard = setTimeout(() => { for (const p of pending.values()) p.reject(Error('GL Worker timeout')); }, 30000);
      worker.onerror = e => { for (const p of pending.values()) p.reject(Error(e.message)); pending.clear(); };
      worker.onmessage = ({ data }) => {
        if (data.frame) { frame = data.frame; return; }
        const p = pending.get(data.id); if (!p) return; pending.delete(data.id);
        data.error ? p.reject(Error(data.error + '\n' + data.stack)) : p.resolve(data.value);
      };
      const call = (name, args = [], aux = 0) => new Promise((resolve, reject) => {
        const id = next++; pending.set(id, { resolve, reject });
        worker.postMessage({ id, op: OpenGLCompat.CALL_INDEX[name], args, aux });
      });
      try {
        const ctx = await call('wglCreateContext', [1], 1);
        same(await call('wglMakeCurrent', [1, ctx], 1), 1, 'Worker bind');
        await call('glViewport', [0, 0, 16, 16]);
        await call('glDrawBuffer', [0x408]);
        await call('glClearColor', clearColor);
        await call('glClear', [0x4000]);
        await call('gpuPresent');
        for (let i = 0; !frame && i < 200; i++) await new Promise(resolve => setTimeout(resolve, 10));
        if (!frame) throw Error('Worker presented no frame');
        // Bridge._replay records which window object each frame token was
        // issued for; a frame is presented only onto that same object.
        host.frameOwners.set(frame.frameToken, new Map([[1, win]]));
        host._present(frame);
      } finally { clearTimeout(guard); }
    } else {
      bridge = new OpenGLCompat.OpenGLHostBridge({ getMemory: () => memory.buffer, exports, renderer, createCanvas: newCanvas });
      const call = (name, args = []) => {
        args.forEach((value, i) => dv.setUint32(4 + i * 4, value >>> 0, true));
        return bridge.call(OpenGLCompat.CALL_INDEX[name], 0, 0);
      };
      const ctx = bridge.createContext(1);
      same(bridge.makeCurrent(ctx, 1), 1, 'local bind');
      call('glViewport', [0, 0, 16, 16]);
      call('glDrawBuffer', [0x408]);
      call('glClearColor', clearColor);
      call('glClear', [0x4000]);
      bridge.present();
      readback = () => {
        call('glReadBuffer', [0x404]);
        call('glReadPixels', [2, 2, 1, 1, 0x1908, 0x1401, 512]);
        same(call('glGetError'), 0, 'GL readback error');
        return Array.from(new Uint8Array(memory.buffer, 512, 4));
      };
    }
    try {
      same(win._dxFrameLayer && win._dxFrameLayer.api, 'opengl', 'route identifies GL');
      same(win._gpuFrameLayer, win._dxFrameLayer, 'one layer object');
      const raw = win._dxFrameLayer.canvas;
      same(pixel(raw), COLOR, 'uncorrected presented front');
      const output = newCanvas(16, 16);
      const filter = new presentationFilter.PresentationFilter(output);
      const display = Object.assign(Object.create(Win98Renderer.prototype), renderer, {
        canvas: raw, presentationCanvas: output, presentationFilter: filter, presentationScaleMode: 'nearest',
        _presentationStack: visible => ({ top: visible[0] }), _canPresentDirectly: () => true,
        _syncDirectPresentation(d) { this.direct = d; } });
      ramp(true); display._presentDisplayCanvas();
      same(display.direct, false, 'gamma disables direct canvas bypass');
      same(['canvas-filter', 'webgl'].includes(filter.lastGammaBackend), true,
        `display correction backend ${filter.lastGammaBackend}`);
      same(pixel(output), CORRECTED, 'independent RGB tables');
      same(pixel(raw), COLOR, 'source untouched');
      display._presentDisplayCanvas(); same(pixel(output), CORRECTED, 'no cumulative correction');
      if (readback) same(readback(), COLOR, 'GL readback untouched');
      // Identity removes correction; a different graphics API must never be
      // corrected here because its own presenter already consumes the ramp.
      ramp(false); display._presentDisplayCanvas(); same(display.direct, true, 'identity restores bypass');
      ramp(true);
      win._dxFrameLayer.api = 'directdraw';
      same(display._openGLDisplayGamma(), null, 'no DirectDraw double gamma');
      display._presentDisplayCanvas(); same(display.direct, true, 'DirectDraw keeps direct bypass');
      win._dxFrameLayer.api = 'opengl'; win.visible = false;
      same(display._openGLDisplayGamma(), null, 'hidden context ignored');
      win.visible = true;
      // Every scaler, both the Canvas2D table filter and the WebGL copy, and
      // the cropped exclusive viewport each scaler sees in fullscreen.
      const lut = dibLib.gammaLut(exports, memory.buffer);
      const backends = {};
      const big = newCanvas(64, 48);
      const viewport = { cropX: 0, cropY: 0, cropW: 16, cropH: 16, dstX: 8, dstY: 0, dstW: 48, dstH: 48,
        nativeW: 16, nativeH: 16, multiplier: 3 };
      for (const canvasFilter of [true, false]) {
        const f = new presentationFilter.PresentationFilter(output);
        const g = new presentationFilter.PresentationFilter(big);
        if (!canvasFilter) f._canvasGammaUnsupported = g._canvasGammaUnsupported = true;
        for (const mode of ['nearest', 'browser-hq', 'fsr1', 'scale-auto', 'sharp-bilinear', 'sharp-hq']) {
          same(f.present(raw, mode, {}, { gamma: lut }), true, `present ${mode}`);
          same(pixel(output), CORRECTED, `gamma after ${mode} (${f.lastGammaBackend})`);
          same(pixel(raw), COLOR, `source untouched by ${mode}`);
          same(g.present(raw, mode, {}, { gamma: lut, viewport }), true, `viewport present ${mode}`);
          same(Array.from(big.getContext('2d').getImageData(30, 24, 1, 1).data), CORRECTED,
            `gamma after viewport ${mode} (${g.lastGammaBackend})`);
          backends[`${canvasFilter ? 'filter' : 'webgl'}:${mode}`] =
            `${f.lastBackend}/${f.lastGammaBackend} viewport ${g.lastBackend}/${g.lastGammaBackend}`;
          if (!canvasFilter) {
            same(f.lastGammaBackend, 'webgl', `forced WebGL gamma for ${mode}`);
            same(g.lastGammaBackend, 'webgl', `forced WebGL viewport gamma for ${mode}`);
          }
        }
        // Dedither consumes the source on the GPU and applies the tables there.
        same(f.present(raw, 'nearest', {}, { gamma: lut, dedither: 'jinc2' }), true, 'dedither present');
        same(f.lastGammaBackend, 'webgl', 'dedither applies tables in its pass');
        same(pixel(output), CORRECTED, 'gamma after dedither');
      }
      results.push({ workerMode, pixel: pixel(output), backends });
    } finally {
      if (worker) { worker.terminate(); URL.revokeObjectURL(url); }
      if (bridge) bridge.destroy();
    }
  }
  return results;
}

if (require.main === module) {
  (async () => {
    const args = ['--no-sandbox'];
    if (!process.argv.includes('--metal')) args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
    const browser = await puppeteer.launch({ headless: true, protocolTimeout: 90000, args,
      executablePath: process.env.CHROME || (process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome') });
    try {
      const page = await browser.newPage();
      page.on('pageerror', error => console.error('pageerror:', error.message));
      for (const name of PAGE_LIBS) await page.addScriptTag({ path: path.join(__dirname, `../lib/${name}.js`) });
      const workerSource = WORKER_LIBS.map(name => fs.readFileSync(path.join(__dirname, `../lib/${name}.js`), 'utf8')).join('\n');
      const results = await page.evaluate(runGammaTests, workerSource);
      assert.strictEqual(results.length, 2);
      console.log('PASS OpenGL display gamma main/Worker, RGB ramps, identity, repeat, readback, scalers, viewport, dedither, DirectDraw exclusion',
        JSON.stringify(results));
    } finally { await browser.close(); }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
