#!/usr/bin/env node
'use strict';

// The ?debug toolbar's D3D select picks the renderer for BOTH Direct3D
// generations for the next launch: the page default and ?d3d9-renderer seed
// it, and the bridge a new instance creates must carry whatever it says at
// launch time.
//
// WebGL is the default for every supported version. Software is the only
// alternate UI mode; legacy URL spellings must not split the two backends.

const assert = require('assert');
const path = require('path');
const puppeteer = require('puppeteer');
const { startStaticServer, closeServer } = require('./static-server');
const { compileSrcWasm } = require('./compile-src');

const root = path.join(__dirname, '..');

(async () => {
  const wasm = compileSrcWasm((file, source) => file === '13-exports.wat'
    ? source + '\n(func (export "test_lazy_enabled") (result i32) (global.get $d3dim_lazy_on))\n' : source);
  const server = await startStaticServer({ root, cacheControl: 'no-cache', crossOriginIsolated: true,
    allowedRealRoots: ['test/binaries', 'fonts'].map(dir => path.join(root, dir)),
    rewritePath: pathname => pathname.startsWith('/binaries/') ? '/test' + pathname : pathname,
    handleRequest(request, response) {
      if (!request.url.startsWith('/build/wine-assembly.wasm')) return false;
      response.writeHead(200, { 'Content-Type': 'application/wasm', 'Content-Length': wasm.length });
      response.end(wasm);
      return true;
    } });
  const browser = await puppeteer.launch({ headless: true,
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-first-run', '--no-default-browser-check'] });
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const open = async query => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(base + query, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('typeof launchApp === "function"');
    return { page, errors };
  };
  const selected = page => page.evaluate(() => ({
    select: document.getElementById('d3d-renderer-select').value,
    renderer: window.WineD3D.renderer,
  }));
  const bothHalves = page => page.evaluate(() => ({
    select: document.getElementById('d3d-renderer-select').value,
    renderer: window.WineD3D.renderer,
    d3dim: window.WINE_D3DIM_GPU === true,
    options: Array.from(document.getElementById('d3d-renderer-select').options).map(o => o.value),
  }));
  try {
    const plain = await open('?debug');
    assert.strictEqual(await plain.page.$eval('#d3d-renderer-select', s => s.parentElement.childNodes[0].textContent.trim()), 'GPU:');
    assert.deepStrictEqual(await selected(plain.page), { select: 'webgl', renderer: 'webgl' },
      'the toolbar defaults to the WebGL backend');
    assert.deepStrictEqual(await bothHalves(plain.page), {
      select: 'webgl', renderer: 'webgl', d3dim: true,
      options: ['webgl', 'software'],
    }, 'WebGL defaults on for both generations with only two options');

    await plain.page.evaluate(() => setD3DRenderer('software'));
    assert.deepStrictEqual(await bothHalves(plain.page), {
      select: 'software', renderer: 'software', d3dim: false,
      options: ['webgl', 'software'],
    });
    await plain.page.evaluate(() => setD3DRenderer('webgl'));
    assert.strictEqual((await bothHalves(plain.page)).d3dim, true,
      'WebGL enables legacy Direct3D too');

    await plain.page.evaluate(async () => {
      setD3DRenderer('software');
      document.getElementById('app-select').value = 'calc';
      await launchApp();
    });
    await plain.page.waitForFunction(() => typeof runningApps !== 'undefined' &&
      runningApps[0] && runningApps[0].wine.running && runningApps[0].wine.hostCtx, { timeout: 120000 });
    // D3D8/9 run only on GPU stream v2 since d3d9-retire S4: the select names
    // the executor (ctx.d3d9GpsBackend), not an old JS bridge backend.
    const d3d9Gps = await plain.page.evaluate(() => {
      const ctx = runningApps[0].wine.hostCtx;
      if (ctx.glideBackend !== 'software') throw new Error('Glide ignored shared GPU choice');
      if (ctx.glideBridge && ctx.glideBridge.options.backend !== 'software') throw new Error('Glide bridge ignored shared GPU choice');
      return ctx.d3d9GpsBackend;
    });
    assert.strictEqual(d3d9Gps, 'software',
      'Software selects the D3D9 GPU stream software executor');
    assert.strictEqual(await plain.page.evaluate(() => runningApps[0].wine.guestWorker.callExport('test_lazy_enabled')), 0,
      'software worker remains eager');
    await plain.page.evaluate(() => setLazySync(true));
    assert.strictEqual(await plain.page.evaluate(() => runningApps[0].wine.guestWorker.callExport('test_lazy_enabled')), 0,
      'live toggle cannot enable lazy synchronization for software');
    assert.deepStrictEqual(plain.errors, [], 'no page errors');
    await plain.page.close();

    const seeded = await open('?debug&d3d9-renderer=software');
    assert.deepStrictEqual(await selected(seeded.page), { select: 'software', renderer: 'software' },
      '?d3d9-renderer seeds the select');
    await seeded.page.close();

    for (const disabled of [false, true]) {
      const lazyPage = await open('?debug' + (disabled ? '&no-lazy-sync' : ''));
      assert.strictEqual(await lazyPage.page.$eval('#lazy-sync-toggle', e => e.checked), !disabled);
      await lazyPage.page.evaluate(async () => {
        await setThreads(true);
        document.getElementById('app-select').value = 'calc';
        await launchApp();
      });
      const enabled = () => lazyPage.page.evaluate(() => runningApps[0].wine.guestWorker.callExport('test_lazy_enabled'));
      assert.strictEqual(await enabled(), disabled ? 0 : 1, 'shared WebGL honors default and URL opt-out');
      await lazyPage.page.evaluate(() => setLazySync(false));
      assert.strictEqual(await enabled(), 0, 'live opt-out reaches guest instance');
      await lazyPage.page.evaluate(() => setLazySync(true));
      assert.strictEqual(await enabled(), 1, 'live re-enable reaches guest instance');
      assert.deepStrictEqual(lazyPage.errors, []);
      await lazyPage.page.close();
    }

    for (const [query, expected] of [
      ['?debug&d3dim-gpu', 'webgl'],
      ['?debug&d3dim-gpu=0', 'software'],
      ['?debug&d3d9-renderer=software&d3dim-gpu', 'software'],
      ['?debug&d3d-renderer=software', 'software'],
      ['?debug&d3d-renderer=webgl&d3d9-renderer=software', 'webgl'],
    ]) {
      const seeded = await open(query);
      assert.deepStrictEqual(await bothHalves(seeded.page), {
        select: expected, renderer: expected, d3dim: expected === 'webgl',
        options: ['webgl', 'software'],
      }, query + ' selects one consistent mode');
      assert.deepStrictEqual(seeded.errors, []);
      await seeded.page.close();
    }

    console.log('PASS  one D3D select steers both Direct3D generations for the next launch');
  } finally {
    await browser.close();
    await closeServer(server);
  }
})().catch(error => { console.error(error); process.exit(1); });
