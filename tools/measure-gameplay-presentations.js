#!/usr/bin/env node
'use strict';

// Attach AFTER the ordinary menu route and visual gameplay review.
// Launch the page with ?debug&perf&perf-stream so host.js records the exact
// compiled module identity. This tool never launches, drives or patches a guest.
// Example: node tools/measure-gameplay-presentations.js --cdp=http://localhost:9222 \
//   --url=http://localhost:8080/index.html?debug\&perf\&perf-stream \
//   --scene="Diablo II Rogue Encampment after ground-click control" --out=/tmp/d2-rate
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (key, fallback) => args.find(a => a.startsWith('--' + key + '='))?.slice(key.length + 3) ?? fallback;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const cdp = opt('cdp', 'http://localhost:9222');
  const url = opt('url');
  const scene = opt('scene');
  const out = opt('out');
  const seconds = Number(opt('seconds', '10'));
  const windows = Number(opt('windows', '3'));
  if (!url || !scene || !out) throw new Error('--url, --scene and --out are required');
  if (!(seconds >= 1 && seconds <= 60) || !Number.isInteger(windows) || windows < 1 || windows > 10)
    throw new Error('seconds must be 1..60 and windows 1..10');
  fs.mkdirSync(out, { recursive: true });
  for (const file of ['before.png', 'after.png', 'presentation-samples.json']) {
    if (fs.existsSync(path.join(out, file))) throw new Error('Refusing to overwrite evidence: ' + file);
  }
  const proofFiles = ['host.js', 'lib/perf-hud.js', 'lib/d3dim-gpu.js',
    'lib/apps.js', 'tools/measure-gameplay-presentations.js'];
  const source = { commit: git('rev-parse', 'HEAD'), status: git('status', '--porcelain'),
    trackedDiffSha256: sha256(execFileSync('git', ['diff', 'HEAD', '--binary'], { cwd: ROOT })),
    files: Object.fromEntries(proofFiles.map(file => [file, sha256(fs.readFileSync(path.join(ROOT, file)))])),
    scope: 'Local checkout identity; loaded browser script hashes recorded separately.' };
  const browser = await puppeteer.connect({ browserURL: cdp });
  let page, armed = false, perfWasEnabled = false;
  const report = { schema: 1, scene, url, startedAt: new Date().toISOString(), source,
    clock: 'normal browser wall clock; no CLI batch clock', logicalFps: null, displayFps: null,
    metric: 'guest presentation events per real wall second', samples: [], windows: [],
    limitations: ['Presentation events are not verified logical frames or physical displays.',
      'Scene label is supplied by the operator; before/after screenshots require review.',
      'Renderer counters may be unavailable with a remote renderer; null is not zero.'] };
  let failure;
  try {
    const matches = (await browser.pages()).filter(p => p.url() === url);
    if (matches.length !== 1) throw new Error('Need exactly one open page matching --url');
    page = matches[0];
    // Debugger supplies the source actually parsed by this page, not a refetch
    // that could silently read a newer worktree version.
    const client = await page.createCDPSession();
    const scripts = [];
    client.on('Debugger.scriptParsed', event => { if (event.url.startsWith(new URL(url).origin + '/')) scripts.push(event); });
    await client.send('Debugger.enable');
    report.loadedScripts = [];
    for (const script of scripts) {
      const { scriptSource } = await client.send('Debugger.getScriptSource', { scriptId: script.scriptId });
      report.loadedScripts.push({ url: script.url, sha256: sha256(scriptSource) });
    }
    await client.detach();
    report.environment = await page.evaluate(() => {
      if (!window.wine || !window.WinePerf) throw new Error('No running Wine instance/telemetry');
      if (!window.WINE_WASM_IDENTITY?.sha256) throw new Error('Launch with ?perf-stream for compiled-module identity');
      if (window.WinePerf.paceLog) throw new Error('An existing pacing capture owns the page');
      if (document.visibilityState !== 'visible') throw new Error('Gameplay page must be visible');
      return { wasm: window.WINE_WASM_IDENTITY, userAgent: navigator.userAgent,
        viewport: [innerWidth, innerHeight], perfEnabled: window.WinePerf.enabled };
    });
    perfWasEnabled = report.environment.perfEnabled;
    await page.screenshot({ path: path.join(out, 'before.png') });
    await page.evaluate(() => { window.WinePerf.start({ draw: false }); window.WinePerf.recordPacing(true); });
    armed = true;
    const sample = () => page.evaluate(() => {
      const p = window.WinePerf;
      const snap = p.snapshot();
      return { atMs: performance.now(), visibility: document.visibilityState,
        presentsTotal: snap.presentsTotal, uploadsTotal: snap.uploadsTotal,
        blocksTotal: snap.blocksTotal, logicalMetric: snap.logicalFps,
        gpu: window.wine.d3dimGpu?.snapshot?.() ?? null };
    });
    report.samples.push(await sample());
    for (let i = 0; i < windows; i++) {
      await sleep(seconds * 1000);
      const b = await sample(), a = report.samples.at(-1);
      report.samples.push(b);
      const elapsedMs = b.atMs - a.atMs;
      if (!(elapsedMs > 0) || b.presentsTotal < a.presentsTotal) throw new Error('Telemetry reset or invalid clock');
      const gpuDelta = a.gpu && b.gpu ? Object.fromEntries(
        ['draws', 'drawCalls', 'triangles', 'clears', 'fallbacks', 'errors', 'declinedClears']
          .map(k => [k, typeof a.gpu[k] === 'number' && typeof b.gpu[k] === 'number' ? b.gpu[k] - a.gpu[k] : null])) : null;
      report.windows.push({ elapsedMs, presentations: b.presentsTotal - a.presentsTotal,
        presentationsPerSecond: (b.presentsTotal - a.presentsTotal) * 1000 / elapsedMs,
        uploads: b.uploadsTotal - a.uploadsTotal, gpuDelta,
        visibleAtEndpoints: a.visibility === 'visible' && b.visibility === 'visible' });
    }
    report.rawPacing = await page.evaluate(() => structuredClone(window.WinePerf.paceLog));
    await page.screenshot({ path: path.join(out, 'after.png') });
    if (!report.windows.every(w => w.visibleAtEndpoints)) throw new Error('Page became hidden');
    if (!report.windows.some(w => w.presentations > 0)) throw new Error('No presentation progress');
    report.outcome = 'sampled-needs-scene-and-counter-review';
  } catch (error) {
    failure = error;
    report.outcome = 'failed';
    report.error = error.stack || String(error);
  } finally {
    if (armed) await page.evaluate(wasEnabled => {
      window.WinePerf.recordPacing(false);
      if (!wasEnabled) window.WinePerf.stop();
    }, perfWasEnabled).catch(() => {});
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'presentation-samples.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.disconnect();
  }
  if (failure) throw failure;
  console.log(JSON.stringify({ out, windows: report.windows, logicalFps: null, displayFps: null }));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
