#!/usr/bin/env node
'use strict';

// Real original Glide 3 consumer: menu-only is an explicit diagnostic mode.
// Default acceptance requires character creation, the world and normal input.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const puppeteer = require('puppeteer');
const { startStaticServer, closeServer } = require('./static-server');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const renderer = process.env.GLIDE_RENDERER || 'webgl';
const goal = process.env.DIABLO2_GLIDE_STAGE || 'gameplay';
const timeout = Number(process.env.DIABLO2_GLIDE_STAGE_TIMEOUT_MS || 240000);
assert(['webgl', 'software'].includes(renderer), 'GLIDE_RENDERER must be webgl or software');
assert(['menu', 'gameplay'].includes(goal), 'DIABLO2_GLIDE_STAGE must be menu or gameplay');
assert(Number.isFinite(timeout) && timeout > 0, 'stage timeout must be positive');
const fixture = path.join(ROOT, 'test/binaries/candidates/diablo-2-demo-installer/installed-extracted/d2glide.dll');
const output = path.resolve(process.env.DIABLO2_GLIDE_OUT || path.join(ROOT, 'build/diablo2-glide', renderer));
if (!fs.existsSync(CHROME) || !fs.existsSync(fixture)) {
  console.log('SKIP Chrome or original Diablo II demo fixture missing');
  process.exit(0);
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function changed(a, b, worldOnly = false) {
  if (!a || !b || a.length !== b.length) return 0;
  let count = 0;
  for (let i = 0; i < (worldOnly ? 640 * 360 * 4 : a.length); i += 4)
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 45) count++;
  return count;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'live.log'), '');
  const server = await startStaticServer({ root: ROOT, crossOriginIsolated: true,
    rewritePath: pathname => pathname.startsWith('/binaries/') ? '/test' + pathname : pathname,
    allowedRealRoots: ['test/binaries', 'fonts'].map(dir => path.join(ROOT, dir)).filter(dir => fs.existsSync(dir)) });
  const logs = [], errors = [], stages = [];
  let browser, page, stage = 'launch', last = null, failure = null, passed = false;
  const report = { renderer, goal, fixtureSha256: crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex') };
  try {
    const args = ['--no-first-run', '--no-default-browser-check'];
    if (process.argv.includes('--no-sandbox')) args.push('--no-sandbox');
    if (process.argv.includes('--swiftshader')) args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
    browser = await puppeteer.launch({ executablePath: CHROME, headless: !process.argv.includes('--headful'), args, protocolTimeout: timeout });
    report.browser = await browser.version();
    page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 800, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => localStorage.setItem('wine-assembly.threads', '1'));
    page.on('console', message => {
      const line = message.text(); logs.push(line);
      fs.appendFileSync(path.join(output, 'live.log'), line + '\n');
      if (/UNIMPLEMENTED API:|RuntimeError|LinkError|FATAL:|\[launchApp\] failed|(?:worker thread|Thread) \d+ (?:trapped|crashed)|host import gpu_stream_kick threw/i.test(line)) {
        errors.push(line); failure ||= new Error(line);
      }
      if (/d2glide|UNIMPLEMENTED|Glide|FATAL/i.test(line)) console.log(line);
    });
    page.on('pageerror', error => { errors.push(String(error)); failure ||= error; });
    await page.goto(`http://127.0.0.1:${server.address().port}/?debug&threads&d3d-renderer=${renderer}`,
      { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof launchApp === 'function' && window.wineApps?.APPS?.diablo2_demo);
    await page.evaluate(async () => {
      await setThreads(true);
      const registry = window.wineApps.APPS;
      const id = 'diablo2_glide_demo';
      const original = registry[id] || registry.diablo2_demo;
      const keys = ['HKCU', 'HKLM'].map(hive => hive + '\\Software\\Blizzard Entertainment\\Diablo II\\VideoConfig');
      const startupRegistry = (original.startupRegistry || []).filter(entry =>
        !(keys.some(key => key.toLowerCase() === entry.keyPath.toLowerCase()) && entry.valueName.toLowerCase() === 'render'));
      for (const keyPath of keys) startupRegistry.push({ keyPath, valueName: 'Render', type: 4, data: 3 });
      registry[id] = { ...original, startupRegistry };
      if (typeof apps !== 'undefined') apps[id] = registry[id];
      window.__d2GlideApp = id;
      const select = document.getElementById('app-select');
      if (![...select.options].some(option => option.value === id)) select.add(new Option('Diablo II Glide acceptance', id));
      select.value = id;
      await launchApp();
      if (!runningApps.some(app => app.name === id)) throw new Error('Diablo II Glide launch failed');
    });
    await page.evaluate(() => {
      window.__d2GlideObserve = (withPixels = false) => {
        const wine = runningApps.find(app => app.name === window.__d2GlideApp)?.wine;
        const bridge = wine?.hostCtx?.glideBridge;
        const e = wine?.instance?.exports || wine?.exports || wine?.hostCtx?.exports;
        const canvas = bridge?.layer?.canvas;
        const state = { running: !!wine?.running, isolated: crossOriginIsolated,
          worker: wine?.threadManager?.backend, apiVersion: e?.glide_api_version?.(),
          nativeWorker: !!bridge?.device?.worker, attached: !!bridge?.win,
          glide: bridge?.device?.stats || {}, bridge: bridge?.stats || {},
          endpoint: bridge?.endpoint?.options || null, width: canvas?.width, height: canvas?.height,
          writeSeq: bridge?.layer?.writeSeq || 0 };
        if (!canvas?.width || !canvas?.height) return state;
        // Normalize only the feature checks/input recipe. Captures retain the
        // actual framebuffer dimensions and the report records mode changes.
        const sample = document.createElement('canvas'); sample.width = 640; sample.height = 480;
        const ctx = sample.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(canvas, 0, 0, 640, 480);
        const pixels = ctx.getImageData(0, 0, 640, 480).data;
        const box = (x0, y0, x1, y1, predicate) => {
          let n = 0;
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const i = (y * 640 + x) * 4;
            if (predicate(pixels[i], pixels[i + 1], pixels[i + 2])) n++;
          }
          return n;
        };
        const plate = (r, g, b) => Math.min(r, g, b) > 90 && Math.max(r, g, b) - Math.min(r, g, b) < 45;
        const colors = new Set();
        for (let i = 0; i < pixels.length; i += 4) colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
        state.metrics = {
          colors: colors.size,
          singlePlayer: box(200, 145, 440, 185, plate), exitButton: box(200, 425, 440, 465, plate),
          okButton: box(495, 425, 615, 460, (r, g, b) => Math.min(r, g, b) > 40 && Math.max(r, g, b) - Math.min(r, g, b) < 45),
          terrain: box(0, 0, 640, 380, (r, g, b) => g > 30 && g > r * 1.08 && g > b * 1.2),
          lifeOrb: box(0, 360, 125, 480, (r, g, b) => r > 70 && r > g * 1.5 && r > b * 1.5),
          manaOrb: box(515, 360, 640, 480, (r, g, b) => b > 70 && b > r * 1.35 && b > g * 1.35)
        };
        if (withPixels) state.pixels = Array.from(pixels);
        return state;
      };
    });
    const observe = withPixels => page.evaluate(flag => window.__d2GlideObserve(flag), withPixels);
    const capture = async name => {
      const data = await page.evaluate(() => runningApps.find(app => app.name === window.__d2GlideApp)
        ?.wine?.hostCtx?.glideBridge?.layer?.canvas?.toDataURL('image/png').split(',')[1]);
      if (data) fs.writeFileSync(path.join(output, name + '-drawable.png'), Buffer.from(data, 'base64'));
      await page.screenshot({ path: path.join(output, name + '.png') });
    };
    const wait = async (name, accept, { pixels = false, intro = false } = {}) => {
      stage = name; const started = Date.now(); let escapes = 0, lastEscape = 0;
      while (Date.now() - started < timeout) {
        if (failure) throw failure;
        last = await observe(pixels);
        if (accept(last)) {
          const { pixels: ignored, ...summary } = last;
          stages.push({ stage, elapsedMs: Date.now() - started, ...summary });
          await capture(name); return last;
        }
        if (intro && escapes < 12 && Date.now() - lastEscape > 4000) {
          await page.keyboard.press('Escape'); escapes++; lastEscape = Date.now();
        }
        await pause(1000);
      }
      throw new Error(`Timed out at ${stage}: ${JSON.stringify({ ...last, pixels: undefined })}`);
    };
    const click = async (x, y, clickCount = 1) => {
      const point = await page.evaluate(({ x, y }) => {
        const bridge = runningApps.find(app => app.name === window.__d2GlideApp).wine.hostCtx.glideBridge;
        const r = bridge._renderer(), win = bridge.win, cr = win.clientRect || win;
        const native = { x: cr.x + x / 640 * cr.w, y: cr.y + y / 480 * cr.h };
        const mapped = r._unmapExclusiveInputPoint(native.x, native.y);
        const rect = r.canvas.getBoundingClientRect();
        return { x: rect.left + mapped.x / r.canvas.width * rect.width,
          y: rect.top + mapped.y / r.canvas.height * rect.height };
      }, { x, y });
      await page.mouse.click(point.x, point.y, { clickCount, delay: 120 });
    };
    const menu = await wait('01-menu', state => state.metrics?.singlePlayer > 1000 && state.metrics?.exitButton > 1000,
      { pixels: true, intro: true });
    assert(logs.some(line => /LoadLibrary.*d2glide\.dll loaded/i.test(line)), 'original d2glide.dll must load at runtime');
    assert(!logs.some(line => /LoadLibrary.*(?:d2direct3d|d2gdi)\.dll loaded/i.test(line)), 'unexpected game renderer');
    assert(menu.isolated && menu.worker === 'worker' && menu.nativeWorker && menu.attached, 'threaded shared Glide renderer must be active');
    assert.strictEqual(menu.apiVersion, 3, 'guest must enter the Glide 3 ABI');
    assert(menu.endpoint?.api === 'glide' && menu.endpoint?.backend === renderer, 'wrong shared render endpoint');
    assert(menu.glide.draws > 0 && menu.glide.presents > 0, 'menu requires actual native Glide draws and presents');
    if (goal === 'gameplay') {
      await click(320, 164);
      const heroes = await wait('02-heroes', state => state.metrics?.exitButton < 500 && changed(menu.pixels, state.pixels) > 40000, { pixels: true });
      await click(315, 210, 2);
      const named = await wait('03-name', state => state.metrics?.okButton > 400 && changed(heroes.pixels, state.pixels) > 2000, { pixels: true });
      await click(320, 422);
      // Diablo II names accept letters; do not use numeric timestamp suffixes.
      const suffix = Array.from(crypto.randomBytes(3), byte => String.fromCharCode(65 + byte % 26)).join('');
      await page.keyboard.type('GLIDE' + suffix, { delay: 100 });
      await wait('04-typed', state => changed(named.pixels, state.pixels) > 100, { pixels: true });
      await click(553, 442);
      const worldReady = state => state.metrics?.terrain > 20000 && state.metrics?.lifeOrb > 2500 &&
        state.metrics?.manaOrb > 2000 && state.metrics?.colors > 100;
      const before = await wait('05-world', worldReady, { pixels: true });
      await click(160, 150);
      const after = await wait('06-moved', state => worldReady(state) && state.writeSeq > before.writeSeq &&
        state.glide.presents >= before.glide.presents + 10 && changed(before.pixels, state.pixels, true) > 640 * 360 * 0.03,
      { pixels: true });
      report.worldChangedPixels = changed(before.pixels, after.pixels, true);
      assert(after.running && after.glide.errors === 0, 'game must remain running without Glide errors');
      const seconds = Number(process.env.DIABLO2_GLIDE_PROFILE_SECONDS || 0);
      if (seconds > 0) {
        // No canvas read or screenshot during this interval: only native counters.
        const snapshot = () => page.evaluate(() => {
          const wine = runningApps.find(app => app.name === window.__d2GlideApp).wine;
          const e = wine.instance?.exports || wine.exports || wine.hostCtx.exports;
          e.glide_lfb_metrics_enable(1);
          return { time: performance.now(), stats: { ...wine.hostCtx.glideBridge.device.stats },
            lfb: Array.from({length:5}, (_,reason) => Array.from({length:7}, (_,field) =>
              e.glide_lfb_metrics_get(reason,field))) };
        });
        const start = await snapshot();
        await click(480, 190);
        await pause(seconds * 1000);
        const end = await snapshot();
        report.profile = { seconds: (end.time - start.time) / 1000, start, end,
          delta: Object.fromEntries(Object.keys(end.stats).map(key => [key, end.stats[key] - (start.stats[key] || 0)])),
          lfbDelta: end.lfb.map((row,r) => row.slice(0,4).map((v,c) => v - start.lfb[r][c])) };
      }
    }
    if (failure) throw failure;
    assert.deepStrictEqual(errors, []);
    passed = true;
    console.log(`PASS Diablo II original Glide 3 ${renderer} ${goal}${goal === 'menu' ? ' diagnostic only; gameplay not accepted' : ' with normal-input movement'}`);
  } catch (error) {
    report.error = error.stack || String(error); throw error;
  } finally {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(output, 'last.png') }).catch(() => {});
      const drawable = await page.evaluate(() => typeof runningApps !== 'undefined'
        ? runningApps.find(app => app.name === window.__d2GlideApp)?.wine?.hostCtx?.glideBridge?.layer?.canvas
          ?.toDataURL('image/png').split(',')[1] : null).catch(() => null);
      if (drawable) fs.writeFileSync(path.join(output, 'last-drawable.png'), Buffer.from(drawable, 'base64'));
      last = await page.evaluate(() => window.__d2GlideObserve?.()).catch(error => ({ error: String(error) }));
    }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ ...report, passed, stage, stages,
      last: last && { ...last, pixels: undefined }, errors }, null, 2));
    fs.writeFileSync(path.join(output, 'console.log'), logs.join('\n'));
    if (browser) await browser.close();
    await closeServer(server);
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
