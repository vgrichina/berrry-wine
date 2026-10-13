#!/usr/bin/env node
'use strict';

// Optional local demo fixture: verify the shipping app selects d3da.dll,
// survives its Watcom initializer, and renders race geometry in a Worker.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { startStaticServer, closeServer } = require('./static-server');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!fs.existsSync(CHROME) || !fs.existsSync(path.join(ROOT,
  'test/binaries/candidates/need-for-speed-3-demo/.wine-assembly-browser.json'))) {
  console.log('SKIP Chrome or NFS III local demo missing');
  process.exit(0);
}

(async () => {
  const server = await startStaticServer({ root: ROOT, crossOriginIsolated: true });
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
      args: ['--no-first-run', '--no-default-browser-check'] });
    const page = await browser.newPage();
    const logs = [], errors = [];
    page.on('console', message => logs.push(message.text()));
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${server.address().port}/?threads`,
      { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(async () => {
      await setThreads(true);
      document.getElementById('app-select').value = 'nfs3_demo';
      await launchApp();
    });
    // The loading picture uses fewer than 1,000 triangles. This threshold
    // requires sustained 3D race geometry, not merely a working splash screen.
    await page.waitForFunction(() => {
      const wine = runningApps.find(app => app.name === 'nfs3_demo')?.wine;
      return wine?.guestWorker?.d3dStats?.triangles > 100000;
    }, { timeout: 120000, polling: 500 });
    const observe = () => page.evaluate(() => {
      const wine = runningApps.find(app => app.name === 'nfs3_demo').wine;
      return { isolated: crossOriginIsolated, running: wine.running,
        backend: wine.threadManager.backend, d3d: wine.guestWorker.d3dStats };
    });
    const before = await observe();
    await page.waitForFunction(count => {
      const wine = runningApps.find(app => app.name === 'nfs3_demo')?.wine;
      return wine?.guestWorker?.d3dStats?.triangles > count + 100000;
    }, { timeout: 60000, polling: 500 }, before.d3d.triangles);
    const after = await observe();
    assert(after.isolated && after.running);
    assert.strictEqual(after.backend, 'worker');
    assert.strictEqual(after.d3d.errors, 0);
    assert(logs.some(line => /LoadLibrary.*d3da\.dll loaded/i.test(line)),
      'the original Direct3D renderer must actually load');
    assert(!logs.some(line => /LoadLibrary.*(?:softtria|voodoo\w*)\.dll loaded/i.test(line)),
      'no game software or Glide renderer');
    assert.deepStrictEqual(errors, []);
    assert(!logs.some(line => /UNIMPLEMENTED API:|RuntimeError|FATAL:|DllMain did not return/i.test(line)));
    const output = path.join(ROOT, 'build/nfs3-d3d');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'race.png') });
    fs.writeFileSync(path.join(output, 'stats.json'), JSON.stringify({ before, after }, null, 2));
    console.log('PASS NFS III Direct3D race rendering with worker threads', JSON.stringify(after.d3d));
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
