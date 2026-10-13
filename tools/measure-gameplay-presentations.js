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
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (key, fallback) => args.find(a => a.startsWith('--' + key + '='))?.slice(key.length + 3) ?? fallback;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));


const GPU_COUNTERS = ['draws', 'drawCalls', 'triangles', 'clears', 'fallbacks', 'errors', 'declinedClears'];
function nonnegative(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new Error('Invalid nonnegative finite counter: ' + label);
}
function validateSample(s) {
  for (const key of ['atMs', 'presentsTotal', 'uploadsTotal', 'blocksTotal']) nonnegative(s[key], key);
  if (s.visibility !== 'visible') throw new Error('Page is hidden');
  if (s.gpu !== null) for (const key of GPU_COUNTERS) nonnegative(s.gpu[key], 'gpu.' + key);
}
function measureWindow(a, b) {
  validateSample(a); validateSample(b);
  const elapsedMs = b.atMs - a.atMs;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) throw new Error('Invalid elapsed wall interval');
  const delta = key => {
    const n = b[key] - a[key];
    if (n < 0) throw new Error('Counter decreased: ' + key);
    return n;
  };
  const presentations = delta('presentsTotal'), uploads = delta('uploadsTotal'), blocks = delta('blocksTotal');
  if ((a.gpu === null) !== (b.gpu === null)) throw new Error('Renderer availability changed');
  if (a.gpuSource !== b.gpuSource) throw new Error("Renderer counter source changed");
  const gpuDelta = a.gpu === null ? null : Object.fromEntries(GPU_COUNTERS.map(key => {
    const n = b.gpu[key] - a.gpu[key];
    if (n < 0) throw new Error('Renderer counter decreased: ' + key);
    return [key, n];
  }));
  const presentationsPerSecond = presentations * 1000 / elapsedMs;
  nonnegative(presentationsPerSecond, 'presentationsPerSecond');
  return { elapsedMs, presentations, presentationsPerSecond, uploads, blocks, gpuDelta };
}

// Runs in the page. Keep references, not just count values: a new runtime can
// overtake the old counters before the next endpoint. Visibility events retain
// hidden -> visible transitions that two endpoint observations would miss.
function armBrowserCapture(token, expectedWasm) {
  const key = '__winePresentationCapture';
  if (window[key]) throw new Error('Presentation capture already attached');
  const wine = window.wine, perf = window.WinePerf, identity = window.WINE_WASM_IDENTITY;
  if (JSON.stringify(identity) !== expectedWasm) throw new Error('Wasm identity changed before capture');
  if (!wine || !perf || perf.paceLog) throw new Error('Runtime/telemetry changed before capture');
  const instance = wine.instance, worker = wine.guestWorker;
  const wasEnabled = perf.enabled;
  perf.start({ draw: false }); perf.recordPacing(true);
  const paceLog = perf.paceLog;
  const state = { token, invalid: null, visibility: [], wasEnabled };
  const invalidate = reason => { state.invalid ||= reason; };
  state.check = () => {
    if (window.wine !== wine || wine.instance !== instance || wine.guestWorker !== worker)
      invalidate('Wine instance changed');
    if (window.WinePerf !== perf || !perf.enabled || perf.paceLog !== paceLog)
      invalidate('Telemetry identity changed');
    if (window.WINE_WASM_IDENTITY !== identity || JSON.stringify(window.WINE_WASM_IDENTITY) !== expectedWasm)
      invalidate('Wasm identity changed');
    if (document.visibilityState !== 'visible') invalidate('Page became hidden');
    return state.invalid;
  };
  const visible = () => {
    state.visibility.push({ atMs: performance.now(), state: document.visibilityState });
    state.check();
  };
  document.addEventListener('visibilitychange', visible);
  const timer = setInterval(state.check, 50);
  state.cleanup = () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', visible);
    // Never stop a replacement runtime or somebody else's new capture.
    if (window.WinePerf === perf && perf.paceLog === paceLog) {
      perf.recordPacing(false);
      if (!wasEnabled) perf.stop();
    }
    delete window[key];
  };
  window[key] = state;
  state.check();
  return { token, invalid: state.invalid };
}

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
  const browser = await require('puppeteer').connect({ browserURL: cdp, defaultViewport: null });
  let page, armed = false;
  const token = crypto.randomUUID();
  const navigations = [];
  const onNavigation = frame => { if (frame === page.mainFrame()) navigations.push(frame.url()); };
  const report = { schema: 1, scene, url, startedAt: new Date().toISOString(), source,
    clock: 'normal browser wall clock; no CLI batch clock', logicalFps: null, displayFps: null,
    metric: 'guest presentation events per real wall second', samples: [], windows: [],
    limitations: ['Presentation events are not verified logical frames or physical displays.',
      'Scene label is supplied by the operator; before/after screenshots require review.',
      'Worker GPU counters are the last asynchronously relayed census, not an atomic snapshot at sample time; null is unavailable, not zero.'] };
  let failure;
  try {
    const matches = (await browser.pages()).filter(p => p.url() === url);
    if (matches.length !== 1) throw new Error('Need exactly one open page matching --url');
    page = matches[0];
    page.on('framenavigated', onNavigation);
    report.navigations = navigations;
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
    await page.screenshot({ path: path.join(out, 'before.png') });
    await page.evaluate(armBrowserCapture, token, JSON.stringify(report.environment.wasm));
    armed = true;
    const sample = () => page.evaluate(owner => {
      const state = window.__winePresentationCapture;
      if (!state || state.token !== owner) throw new Error('Capture lost after reload/runtime change');
      if (state.check()) throw new Error(state.invalid);
      const p = window.WinePerf;
      const snap = p.snapshot();
      return { atMs: performance.now(), visibility: document.visibilityState,
        presentsTotal: snap.presentsTotal, uploadsTotal: snap.uploadsTotal,
        blocksTotal: snap.blocksTotal, logicalMetric: snap.logicalFps,
        gpu: window.wine.guestWorker ? window.wine.guestWorker.d3dStats ?? null : window.wine.d3dimGpu?.snapshot?.() ?? null,
        gpuSource: window.wine.guestWorker ? "guestWorker.d3dStats (asynchronously merged backend census)" : "d3dimGpu.snapshot (local backend)",
        visibilityEvents: [...state.visibility] };
    }, token);
    report.samples.push(await sample());
    validateSample(report.samples[0]);
    if (navigations.length) throw new Error('Page navigated during capture setup');
    for (let i = 0; i < windows; i++) {
      await sleep(seconds * 1000);
      const b = await sample(), a = report.samples.at(-1);
      report.samples.push(b);
      if (navigations.length) throw new Error('Page navigated during capture');
      report.windows.push(measureWindow(a, b));
    }
    report.rawPacing = await page.evaluate(() => structuredClone(window.WinePerf.paceLog));
    await page.screenshot({ path: path.join(out, 'after.png') });
    report.finalGuard = await page.evaluate(owner => {
      const state = window.__winePresentationCapture;
      if (!state || state.token !== owner) throw new Error('Capture lost');
      return { invalid: state.check(), visibility: state.visibility };
    }, token);
    if (navigations.length || report.finalGuard.invalid) throw new Error(report.finalGuard.invalid || 'Page navigated during capture');
    if (!report.windows.some(w => w.presentations > 0)) throw new Error('No presentation progress');
    report.outcome = 'sampled-needs-scene-and-counter-review';
  } catch (error) {
    failure = error;
    report.outcome = 'failed';
    report.error = error.stack || String(error);
  } finally {
    if (armed) {
      report.cleanupGuard = await page.evaluate(owner => {
        const state = window.__winePresentationCapture;
        if (!state || state.token !== owner) return { invalid: 'Capture lost' };
        const guard = { invalid: state.check(), visibility: [...state.visibility] };
        state.cleanup();
        return guard;
      }, token).catch(error => ({ invalid: String(error) }));
      if (report.cleanupGuard.invalid || navigations.length) {
        failure ||= new Error(report.cleanupGuard.invalid || 'Page navigated during capture');
        report.outcome = 'failed';
        report.error ||= failure.stack;
      }
    }
    page?.off('framenavigated', onNavigation);
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'presentation-samples.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.disconnect();
  }
  if (failure) throw failure;
  console.log(JSON.stringify({ out, windows: report.windows, logicalFps: null, displayFps: null }));
}
module.exports = { validateSample, measureWindow, armBrowserCapture };
if (require.main === module) main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
