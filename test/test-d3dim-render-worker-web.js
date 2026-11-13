#!/usr/bin/env node
'use strict';

// In browser Threads mode the guest-main Worker hands every D3DIM draw to the
// one process-owned render Worker, for both software and WebGL. The obsolete
// ?no-d3d-worker query cannot bypass this route. Boids uses indexed draws; a nonzero
// queue count proves the indexed path reaches the render Worker in a real page.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { startStaticServer, closeServer } = require('./static-server');
const { compileSrcWasm } = require('./compile-src');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!fs.existsSync(CHROME) ||
    !fs.existsSync(path.join(ROOT, 'test', 'binaries', 'dx-sdk', 'bin', 'boids.exe'))) {
  console.log('SKIP  Chrome or boids.exe unavailable');
  process.exit(0);
}

async function runBoids(browser, base, query) {
  const page = await browser.newPage();
  const problems = [], logs = [];
  await page.evaluateOnNewDocument(() => {
    window.__renderWorkerStarts = 0;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url, options) {
        super(url, options);
        if (String(url).includes('d3d-render-worker.js')) window.__renderWorkerStarts++;
      }
    };
  });
  page.on('pageerror', error => problems.push(String(error)));
  page.on('console', message => {
    const text = message.text();
    logs.push(text);if(logs.length>80)logs.shift();
    if (/UNIMPLEMENTED API:|RuntimeError|D3D render Worker|FATAL:|trapped/i.test(text)) problems.push(text);
  });
  await page.goto(`${base}?debug&no-log${query}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.wineShell && window.wineApps?.APPS.dx_boids, { timeout: 30000 });
  assert(await page.evaluate(() => crossOriginIsolated), 'server must be cross-origin isolated');
  await page.evaluate(async () => {
    window.WINE_THREADS=true;
    await wineShell.launchApp('dx_boids');
    if (!wineShell.runningApps.some(app => app?.name === 'dx_boids')) throw new Error('Boids did not launch: '+document.body.innerText.slice(-6000));
  });
  // Stats ride back with every guest slice; wait until the flock has drawn.
  const observe = () => page.evaluate(() => {
    const app = wineShell.runningApps.find(item => item && item.name === 'dx_boids');
    const worker = app && app.wine && app.wine.guestWorker;
    return { apps: wineShell.runningApps.filter(Boolean).map(item => item.name),
      running: !!(app && app.wine && app.wine.running), worker: !!worker,
      slices: worker && worker.sliceStats ? worker.sliceStats.slices : 0,
      d3d: worker ? worker.d3dStats || null : null,
      flag: window.WINE_D3D_RENDER_WORKER, hostFlag: worker ? worker.d3dRenderWorker : null };
  });
  try {
    await page.waitForFunction(() => {
      const app = wineShell.runningApps.find(item => item && item.name === 'dx_boids');
      const worker = app && app.wine && app.wine.guestWorker;
      if (!worker || !worker.sliceStats || worker.sliceStats.slices < 50) return false;
      return !!(worker.d3dStats && worker.d3dStats.queued > 200);
    }, { timeout: 120000, polling: 250 });
  } catch (error) {
    // Which Worker scopes exist, and whether the guest-main one built its encoder.
    const scopes = await Promise.all(page.workers().map(async worker => {
      let probe = null;
      try {
        probe = await worker.evaluate(() => ({
          stream: typeof D3DCommandStream,
          encoder: typeof d3dCommands === 'undefined' ? 'no-binding' : !!d3dCommands,
        }));
      } catch (probeError) { probe = String(probeError.message || probeError); }
      return { url: worker.url().replace(/^.*\/lib\//, ''), probe };
    }));
    throw new Error(`${error.message}\nstate ${JSON.stringify(await observe())}\n` +
      `workers ${JSON.stringify(scopes)}\nproblems ${JSON.stringify(problems)}\nlogs ${logs.join('\n')}`);
  }
  const stats = await page.evaluate(() => {
    const wine = wineShell.runningApps.find(item => item && item.name === 'dx_boids').wine;
    const worker = wine.guestWorker;
    window.__boidsWine = wine;
    return { threads: window.WINE_THREADS, renderWorker: window.WINE_D3D_RENDER_WORKER,
      d3d: worker.d3dStats || null, starts: window.__renderWorkerStarts,
      manager: !!wine._renderWorkerManager,
      publication: new RenderWorker.PublicationQueue(worker.renderPublication).snapshot(),
      endpoints: [...(wine._renderWorkerManager?.ports.values() || [])].map(p => p.options) };
  });
  stats.physicalWorkers = page.workers().filter(w => w.url().includes('d3d-render-worker.js')).length;
  await page.evaluate(() => window.__boidsWine.stop());
  await page.waitForFunction(() => window.__boidsWine._renderWorkerRetired, { timeout: 30000 });
  await page.close();
  return { stats, problems };
}

(async () => {
  const wasm = compileSrcWasm();
  const server = await startStaticServer({ root: ROOT, cacheControl: 'no-cache', crossOriginIsolated: true,
    allowedRealRoots: ['test/binaries', 'test/binaries/dx-sdk', 'test/binaries/dlls', 'fonts']
      .map(dir => path.join(ROOT, dir)).filter(dir => fs.existsSync(dir)),
    rewritePath: pathname => pathname.startsWith('/binaries/') ? '/test' + pathname : pathname,
    handleRequest(request, response) {
      if (!request.url.startsWith('/build/wine-assembly.wasm')) return false;
      response.writeHead(200, { 'Content-Type': 'application/wasm', 'Content-Length': wasm.length });
      response.end(wasm);
      return true;
    } });
  const args = ['--no-first-run', '--no-default-browser-check'];
  if (process.argv.includes('--no-sandbox')) args.push('--no-sandbox');
  if (process.argv.includes('--swiftshader')) args.push('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args });
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  try {
    for (const [name, query, backend] of [
      ['software', '&d3d-renderer=software', 'software'],
      ['legacy opt-out ignored', '&d3d-renderer=software&no-d3d-worker', 'software'],
      ['WebGL', '&d3d-renderer=webgl', 'webgl'],
    ]) {
      const { stats, problems } = await runBoids(browser, base, query);
      assert.deepStrictEqual(problems, [], name + ': no page errors');
      assert.strictEqual(stats.threads, true);
      assert.strictEqual(stats.renderWorker, true, 'shared rendering is mandatory in Threads mode');
      assert.strictEqual(stats.starts, 1, name + ': exactly one physical render Worker constructed');
      assert.strictEqual(stats.physicalWorkers, 1, name + ': exactly one live physical render Worker');
      assert.strictEqual(stats.manager, true, 'process manager owns rendering');
      assert(stats.endpoints.some(p => p.api === 'legacy' && p.backend === backend),
        `${name}: expected ${backend} endpoint; actual ${JSON.stringify(stats)}`);
      assert(stats.d3d?.ready, JSON.stringify(stats));
      assert.strictEqual(stats.d3d.fallbacks, 0, 'no guest-local rendering fallback');
      assert(stats.d3d.fences > 0, 'presents fence the shared renderer');
      assert(stats.publication.packets>0,'D3D descriptors use the common publication queue');
      if (backend === 'webgl') assert(stats.d3d.glRenderer, 'actual worker GL renderer reported');
      console.log(`PASS ${name}: one shared Worker, ${stats.d3d.queued} draws, ${stats.d3d.fences} fences; retired cleanly`);
    }
  } finally {
    await browser.close();
    await closeServer(server);
  }
})().catch(error => { console.error(error); process.exit(1); });
