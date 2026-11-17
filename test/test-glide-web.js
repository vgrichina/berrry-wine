#!/usr/bin/env node
'use strict';
// tl;dr: real-Chrome check of the GPU stream v2 Glide path.
//   1. Runs test/gpu-stream-webgl-scenario.js (the same record scenario as
//      test/test-gpu-stream-webgl.js, which uses desktop GLSL under headless GL)
//      on WebGL1 (ESSL1) and WebGL2 (ESSL3) contexts.
//   2. Drives lib/gpu-stream-host.js Bridge.kick() (api 'glide') over a real ring into the actual
//      Win98Renderer desktop compositor: top-level window, close, GPU child.
//
//   node test/test-glide-web.js [--no-sandbox] [--swiftshader]
//
// Glide semantics (TMU combine, chroma key, gamma ramp building, clip
// coordinates) are compiled by the WAT frontend into shader IR and records;
// here only their WebGL execution is checked.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const LIB = path.join(__dirname, '../lib');
const LIB_SCRIPTS = ['surface.js', 'renderer.js', 'gpu-backend.js', 'gpu-stream.generated.js', 'gpu-stream.js',
  'd3d-shader-ir.js', 'd3d9-shader.js', 'gpu-stream-webgl.js', 'gpu-stream-doorbell.js', 'gpu-stream-host.js'];
// test/gpu-stream-fixture.js is a CommonJS module; give it the page's GpuStream.
const FIXTURE = `(function(){var module={exports:{}};var require=function(){return globalThis.GpuStream;};\n${
  fs.readFileSync(path.join(__dirname, 'gpu-stream-fixture.js'), 'utf8')}\nglobalThis.GpsFixture=module.exports;})();`;

(async () => {
  const args = ['--no-first-run', '--no-default-browser-check'];
  if (process.argv.includes('--no-sandbox')) args.push('--no-sandbox');
  if (process.argv.includes('--swiftshader')) args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args
  });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    for (const file of LIB_SCRIPTS) await page.addScriptTag({ path: path.join(LIB, file) });
    await page.addScriptTag({ content: FIXTURE });
    await page.addScriptTag({ path: path.join(__dirname, 'gpu-stream-webgl-scenario.js') });
    assert.deepStrictEqual(pageErrors, [], 'page scripts load');

    const results = await page.evaluate(() => {
      const out = [];
      for (const version of [1, 2]) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        let backend;
        try { backend = new GpuBackend.WebGLBackend(canvas, { apiVersion: version }); }
        catch (e) { out.push({ version, error: `no WebGL${version}: ${e.message}` }); continue; }
        const gl = backend.gl;
        const r = GpuStreamWebGLScenario.run({
          GS: GpuStream, makeProducer: GpsFixture.makeProducer, Executor: GpuStreamWebGL.Executor,
          canvas, backend, buffer: new ArrayBuffer(1 << 22),
          readSurface: (surface, x, y) => surface.getContext('2d').getImageData(x, y, 1, 1).data,
        });
        out.push({ version, glVersion: backend.version, shading: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
          checks: r.checks, failures: r.failures, glError: gl.getError() });
        backend.destroy();
      }
      return out;
    });
    let failed = false;
    for (const r of results) {
      if (r.error) { console.log(`FAIL WebGL${r.version}: ${r.error}`); failed = true; continue; }
      for (const f of r.failures) console.log(`FAIL WebGL${r.version}: ${f}`);
      console.log(`WebGL${r.version} (backend v${r.glVersion}, ${r.shading}): ${r.checks - r.failures.length}/${r.checks} checks`);
      if (r.failures.length || r.glError !== 0 || r.glVersion !== r.version) failed = true;
      if (r.glError !== 0) console.log(`FAIL WebGL${r.version}: GL error 0x${r.glError.toString(16)} left after the scenario`);
    }
    assert(!failed, 'WebGL1/WebGL2 executor scenario');

    const composed = await page.evaluate(async () => {
      const screen = document.createElement('canvas'); screen.width = screen.height = 96;
      const renderer = new Win98Renderer(screen);
      renderer.createWindow(1, 0x90000000, 8, 8, 32, 32, 'Glide only', 0);
      const withoutBacking = !renderer.windows[1]._backCanvas;
      const memory = new ArrayBuffer(1 << 16);
      const bridge = new GpuStreamHost.Bridge({ api: 'glide', getMemory: () => memory, renderer: () => renderer,
        getExports: () => ({ get_dx_present_hwnd: () => 1 }) });
      const C = GpuStream.CONST;
      const p = GpsFixture.makeProducer({ buffer: memory, ringBytes: 4096, arenaBytes: 4096 });
      // One frame: RT (new executor each open), clear, present to hwnd.
      const frame = (size, rgba, hwnd) => {
        p.emit('CREATE', { id: 1, kind: C.KIND_RT, fmt: C.FMT_A8B8G8R8, levels: 1, width: size, height: size });
        p.emit('TARGETS', { color: 1, depth: 0 });
        p.emit('CLEAR', { mask: C.CLEAR_COLOR, colormask: 15, rgba, z: 1, left: 0, top: 0, right: size, bottom: size });
        p.emit('PRESENT', { rt: 1, gamma: 0, x: 0, y: 0, w: size, h: size, surface: hwnd });
        return bridge.kick(p.header, C.KICK_SYNC);
      };
      // Exercise the host's real publication request. Calling repaint here
      // would hide a bridge that attaches a valid layer but never schedules
      // it for display.
      const scheduledFrame = async () => {
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve));
      };
      try {
        await scheduledFrame();
        const kicked = frame(32, 0xff0000ff, 0); // red; null hwnd -> process-owned
        await scheduledFrame();
        const top = Array.from(screen.getContext('2d').getImageData(12, 12, 1, 1).data);
        const backing = !!renderer.windows[1]._backCanvas;
        const attached = bridge.win?.hwnd;
        bridge.close(); await scheduledFrame();
        const closed = Array.from(screen.getContext('2d').getImageData(12, 12, 1, 1).data);
        // A GPU child has its own surface despite its ordinary Win32 parent.
        renderer.createWindow(2, 0x50000000, 4, 4, 16, 16, 'child', 0);
        frame(16, 0xff00ff00, 2);
        await scheduledFrame();
        const child = Array.from(screen.getContext('2d').getImageData(16, 16, 1, 1).data);
        return { kicked, withoutBacking, backing, attached, top, closed, child,
          childOwn: renderer.windows[2]._canonicalOwnSurface, records: bridge.stats.records };
      } finally { bridge.close(); }
    });
    assert.strictEqual(composed.kicked, 1, 'local kick drains the ring');
    assert(composed.withoutBacking && composed.backing, 'Glide must allocate backing for GPU-only window');
    assert.strictEqual(composed.attached, 1, 'null Glide HWND resolves through process-owned HWND');
    assert.deepStrictEqual(composed.top, [255, 0, 0, 255], 'actual desktop compositor displays Glide');
    assert.deepStrictEqual(composed.closed, [192, 192, 192, 255], 'closed Glide layer disappears');
    assert(composed.childOwn, 'Glide child owns its GPU surface');
    assert.deepStrictEqual(composed.child, [0, 255, 0, 255], 'actual desktop compositor displays GPU child');
    assert.deepStrictEqual(pageErrors, [], 'no page errors');
    console.log('Glide GPU stream WebGL1/WebGL2 executor scenario and real window compositor PASS');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
