#!/usr/bin/env node
'use strict';

// Optional proprietary local fixture. Exercise the original renderer through
// the shipping browser launch path, retaining screenshots for visual review.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const puppeteer = require('puppeteer');
const { startStaticServer, closeServer } = require('./static-server');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const renderer = process.env.GLIDE_RENDERER || 'webgl';
assert(['webgl', 'software'].includes(renderer), 'GLIDE_RENDERER must be webgl or software');
const fixture = path.join(ROOT, 'test/binaries/candidates/need-for-speed-3-demo/game/voodooa.dll');
if (!fs.existsSync(CHROME) || !fs.existsSync(fixture)) {
  console.log('SKIP Chrome or NFS III local demo missing');
  process.exit(0);
}
const output = path.join(ROOT, 'build/nfs3-glide', renderer);
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'live.log'), '');

(async () => {
  const corpus = path.resolve(path.dirname(fs.realpathSync(fixture)), '../../..');
  const server = await startStaticServer({ root: ROOT, crossOriginIsolated: true,
    allowedRealRoots: [corpus, path.join(ROOT, 'fonts')].filter(p => fs.existsSync(p)) });
  let browser, page;
  let reportFailure;
  const failure = new Promise((_, reject) => { reportFailure = reject; });
  failure.catch(() => {});
  const logs = [], errors = [];
  try {
    browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
      args: ['--no-first-run', '--no-default-browser-check'] });
    page = await browser.newPage();
    page.on('console', message => {
      const line = message.text();
      logs.push(line);
      fs.appendFileSync(path.join(output, 'live.log'), line + '\n');
      if (/host import gpu_stream_kick threw|UNIMPLEMENTED API:|\[launchApp\] failed:|worker thread \d+ trapped/.test(line))
        reportFailure(new Error(line));
      if (/Glide|UNIMPLEMENTED|RuntimeError|FATAL|voodooa\.dll loaded/i.test(line)) console.log(line);
    });
    page.on('pageerror', error => { errors.push(String(error)); console.error(String(error)); });
    // Local app selection requires candidates; debug retains failure diagnostics.
    await page.goto(`http://127.0.0.1:${server.address().port}/?candidates&debug&threads&d3d-renderer=${renderer}&glide-renderer=${renderer}`,
      { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(async () => {
      await setThreads(true);
      // Executor stats for the local route (the executor may be wrapped in a
      // dump tee); the Worker route only reports kicks/records.
      window.__glideStats = () => {
        const bridge = runningApps.find(app => app.name === 'nfs3_demo')?.wine?.hostCtx?.glideBridge;
        if (!bridge) return null;
        const executor = bridge.executor && (bridge.executor.inner || bridge.executor);
        return executor && executor.stats ? executor.stats() : bridge.device?.stats || null;
      };
      // Bounded GPU stream v2 DRAW_UP samples, each with the sticky RASTER /
      // BIND / CONSTS / TARGETS state it ran under, its first 300 vertices
      // and (WebGL executor) the bound textures' level 0, make a real-game
      // rendering defect reproducible without guessing from a black screenshot.
      window.__glideSamples = [];
      const OP = GpuStream.OP, sampled = new Set(), sticky = new WeakMap();
      const base64 = data => {
        let result = '';
        for (let i = 0; i < data.length; i += 8192)
          result += String.fromCharCode(...data.subarray(i, i + 8192));
        return btoa(result);
      };
      // Level 0 of a WebGL executor texture, read through a scratch FBO.
      const webglTexture = (executor, id) => {
        const r = executor.res && executor.res.get(id);
        if (!r || !r.tex || r.w * r.h > 256 * 256) return null;
        const gl = executor.gl, fbo = gl.createFramebuffer(), rgba = new Uint8Array(r.w * r.h * 4);
        try {
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.tex, 0);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
          gl.readPixels(0, 0, r.w, r.h, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        } finally {
          gl.bindFramebuffer(gl.FRAMEBUFFER, executor.boundFbo || null);
          gl.deleteFramebuffer(fbo);
        }
        return { id, width: r.w, height: r.h, levels: r.levels, fmt: r.fmt, rgba: base64(rgba) };
      };
      const wrap = (Exec, kind) => {
        if (!Exec) return;
        const execute = Exec.prototype.execute;
        Exec.prototype.execute = function(rec) {
          let st = sticky.get(this);
          if (!st) sticky.set(this, st = { raster: null, bind: [], consts: null, targets: null, triangles: 0 });
          if (sampled.size >= 12) return execute.call(this, rec);
          if (rec.op === OP.RASTER) st.raster = { ...rec.fields };
          else if (rec.op === OP.BIND) st.bind = GpuStream.decodeBind(rec).map(e => ({ ...e }));
          else if (rec.op === OP.CONSTS) st.consts = Array.from(GpuStream.decodeConsts(rec));
          else if (rec.op === OP.TARGETS) st.targets = { ...rec.fields };
          else if (rec.op === OP.DRAW_UP) {
            const f = rec.fields;
            const stage = st.triangles > 100000 ? 'race' : 'startup';
            if (f.prim === 4) st.triangles += f.count / 3;
            const key = stage + ':' + f.ps + ':' + JSON.stringify(st.raster) + JSON.stringify(st.bind);
            // At most 6 startup samples, so race state always gets the rest.
            const startup = window.__glideSamples.filter(s => s.stage === 'startup').length;
            if (!sampled.has(key) && (stage === 'race' || startup < 6)) {
              sampled.add(key);
              window.__glideSamples.push({ stage, executor: kind, seq: rec.seq, draw: { ...f },
                raster: st.raster, bind: st.bind, consts: st.consts, targets: st.targets,
                vertices: base64(rec.arena(f.voff, Math.min(f.count, 300) * f.stride).slice()),
                textures: kind === 'webgl' ? st.bind.map(e => webglTexture(this, e.texture)) : null });
            }
          }
          return execute.call(this, rec);
        };
      };
      wrap(window.GpuStreamWebGL && GpuStreamWebGL.Executor, 'webgl');
      wrap(window.GpuStreamSoftware && GpuStreamSoftware.Executor, 'software');
      // Override this page's launch configuration, never the shared fixture.
      const app = window.wineApps.APPS.nfs3_demo;
      const keyPath = 'HKLM\\Software\\Electronic Arts\\Need For Speed III Demo';
      app.startupRegistry = [
        ...(app.startupRegistry || []).filter(entry => entry.keyPath.toLowerCase() !== keyPath.toLowerCase()),
        { keyPath, valueName: 'Thrash Driver', type: 1, data: 'voodoo' },
        { keyPath, valueName: 'D3D Device', type: 4, data: 0 },
      ];
      document.getElementById('app-select').value = 'nfs3_demo';
      await launchApp();
      if (!runningApps.some(app => app.name === 'nfs3_demo')) throw new Error('NFS III launch failed');
    });
    const observe = () => page.evaluate(async () => {
      const wine = runningApps.find(app => app.name === 'nfs3_demo')?.wine;
      const drawable = wine?.hostCtx?.glideBridge?.layer?.canvas;
      const context = drawable?.getContext('2d');
      const pixels = context?.getImageData(0, 0, drawable.width, drawable.height).data;
      const compositor = wine?.hostCtx?.glideBridge?._renderer();
      const shown = compositor?.ctx?.getImageData(0, 0,
        compositor.canvas.width, compositor.canvas.height).data;
      const colored = data => {
        let count = 0;
        if (data) for (let i = 0; i < data.length; i += 4)
          if (Math.max(data[i], data[i + 1], data[i + 2]) -
              Math.min(data[i], data[i + 1], data[i + 2]) > 20) count++;
        return count;
      };
      let transparentPixels = 0;
      if (pixels) for (let i = 3; i < pixels.length; i += 4)
        if (pixels[i] !== 255) transparentPixels++;
      const hash = pixels ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', pixels)))
        .map(byte => byte.toString(16).padStart(2, '0')).join('') : null;
      return { isolated: crossOriginIsolated, running: wine?.running,
        selectedBackend: wine?.hostCtx?.glideBridge?.options.backend,
        glRenderer: wine?.hostCtx?.glideBridge?.device?.glRenderer || null,
        // Worker dllMapped notifications register generation-checked mappings;
        // successful loads need not print the historical LoadLibrary message.
        loadedModules: (wine?.moduleMap || []).filter(item => item.base > 0)
          .map(item => ({ name: String(item.name).replace(/\\/g, '/').split('/').pop().toLowerCase(),
            base: item.base, generation: item.generation })),
        drawableHash: hash,
        drawableColoredPixels: colored(pixels), displayedColoredPixels: colored(shown),
        transparentPixels,
        attached: !!wine?.hostCtx?.glideBridge?.win,
        worker: wine?.threadManager?.backend,
        glide: window.__glideStats(),
        bridge: wine?.hostCtx?.glideBridge?.stats };
    });
    // Loading art is not race geometry. Require sustained draws and swaps.
    await Promise.race([failure, page.waitForFunction(() => {
      const stats = window.__glideStats();
      return stats?.triangles > 100000 && stats?.presents > 20;
    }, { timeout: 180000, polling: 500 })]);
    const before = await observe();
    await page.screenshot({ path: path.join(output, 'race-before.png') });
    assert(before.drawableColoredPixels > 10000, 'race drawable must contain visible colored geometry');
    assert.strictEqual(before.transparentPixels, 0, 'RGB565 presentation must be opaque');
    assert(before.displayedColoredPixels > 10000, 'the page compositor must display the game');
    const center = await page.evaluate(() => {
      const wine = runningApps.find(app => app.name === 'nfs3_demo').wine;
      const rect = wine.hostCtx.glideBridge._renderer().canvas.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    await page.mouse.click(center.x, center.y);
    await page.keyboard.down('ArrowUp');
    await Promise.race([failure, page.waitForFunction(previous => {
      const stats = window.__glideStats();
      return stats?.triangles > previous.triangles + 30000 &&
        stats?.presents > previous.presents + 60 && Date.now() - previous.inputStarted > 12000;
    }, { timeout: 180000, polling: 500 }, { ...before.glide, inputStarted: Date.now() })]);
    await page.keyboard.up('ArrowUp');
    const after = await observe();
    await page.screenshot({ path: path.join(output, 'race-after.png') });
    fs.writeFileSync(path.join(output, 'stats.json'), JSON.stringify({ renderer,
      fixtureSha256: crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'),
      browser: await browser.version(), before, after }, null, 2));
    assert(after.isolated && after.running, 'isolated game must remain running');
    assert(after.attached, 'presented Glide surface must be attached to its game window');
    assert.strictEqual(after.worker, 'worker');
    // Executor errors throw out of gpu_stream_kick (caught by the console
    // regex above); here the executor must still be the one that drew.
    assert(after.glide && after.glide.draws > before.glide.draws, 'Glide executor must keep drawing');
    assert.strictEqual(after.transparentPixels, 0, 'RGB565 presentation must stay opaque');
    assert(before.drawableHash && after.drawableHash && before.drawableHash !== after.drawableHash,
      'the Glide drawable itself must advance, independently of desktop clock/cursor changes');
    for (const state of [before, after]) {
      assert.strictEqual(state.selectedBackend, renderer, 'shared GPU selector must select the requested backend');
      assert.strictEqual(!!state.glRenderer, renderer === 'webgl', 'actual renderer must match requested backend');
      assert(state.loadedModules.some(item => item.name === 'voodooa.dll'),
        'original Glide renderer must remain mapped throughout the race');
      assert(!state.loadedModules.some(item => /^(?:softtria|d3da)\.dll$/.test(item.name)),
        'unexpected game renderer mapped');
    }
    assert.deepStrictEqual(errors, []);
    assert(!logs.some(line => /UNIMPLEMENTED API:|RuntimeError|FATAL:|DllMain did not return|eip-zero/i.test(line)), 'guest failure');
    console.log(`PASS NFS III Glide ${renderer} sustained race geometry and swaps; screenshots require visual HUD/input review`);
  } finally {
    if (page && !page.isClosed()) {
      const samples = await page.evaluate(() => window.__glideSamples || []).catch(() => []);
      fs.writeFileSync(path.join(output, 'draw-samples.json'), JSON.stringify(samples));
      const drawable = await page.evaluate(() => {
        const wine = typeof runningApps !== 'undefined'
          ? runningApps.find(app => app.name === 'nfs3_demo')?.wine : null;
        return wine?.hostCtx?.glideBridge?.layer?.canvas?.toDataURL('image/png').split(',')[1];
      }).catch(() => null);
      if (drawable) fs.writeFileSync(path.join(output, 'drawable-last.png'), Buffer.from(drawable, 'base64'));
      const last = await page.evaluate(() => {
        const wine = typeof runningApps !== 'undefined'
          ? runningApps.find(app => app.name === 'nfs3_demo')?.wine : null;
        const bridge = wine?.hostCtx?.glideBridge;
        const renderer = bridge?._renderer();
        return { running: wine?.running, bridge: bridge?.stats, executor: window.__glideStats?.(),
          attachedHwnd: bridge?.win?.hwnd,
          windows: renderer && Object.values(renderer.windows).map(win => ({hwnd:win.hwnd,
            visible:win.visible,isChild:win.isChild,x:win.x,y:win.y,w:win.w,h:win.h,
            layer:!!win._dxFrameLayer,sameLayer:win._dxFrameLayer===bridge.layer,
            back:!!win._backCanvas, parent:win.parent, owner:win.owner})),
          lastSample: (window.__glideSamples || []).at(-1)?.seq ?? null };
      }).catch(error => ({ error: String(error) }));
      fs.writeFileSync(path.join(output, 'last-stats.json'), JSON.stringify(last, null, 2));
    }
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'last.png') }).catch(() => {});
    fs.writeFileSync(path.join(output, 'console.log'), logs.join('\n'));
    fs.writeFileSync(path.join(output, 'errors.json'), JSON.stringify(errors, null, 2));
    if (browser) await browser.close();
    await closeServer(server);
  }
})().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
