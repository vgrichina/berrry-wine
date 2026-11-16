#!/usr/bin/env node
'use strict';

// MW3 cockpit readbacks on the WAT D3DIM producer (src/09abg-d3dim-gps.wat):
// d3dim_gps_stat readbacks by site, bytes and declines per presented frame.
// Eager Lock sync by default (?no-lazy-sync); --lazy-sync measures the shipped
// lazy default. The old --full-readbacks arm patched the deleted JS executor
// (lib/d3dim-gpu.js) and is retired.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const assert = require('assert');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const { startStaticServer, closeServer } = require('../test/static-server');
const gameplayRoute = require('./mw3-gameplay-route');
const ROOT = path.resolve(__dirname, '..');
const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
if (process.argv.includes('--help')) {
  console.log('Usage: node tools/bench-mw3-readbacks.js [--lazy-sync] [--seconds=15] [--samples=1]\n' +
    '  [--warmup-ms=15000] [--out=build/mw3-readbacks-eager] [--wasm=FILE]\n' +
    '  [--swiftshader] [--no-sandbox] [--source-commit=REV]\n' +
    'Headful Chrome (CHROME env), threads and shared WebGL worker required. Creates pilot ACE,\n' +
    'deploys via the existing cockpit route, then measures without image polling.\n' +
    'SwiftShader requires explicit opt-in; quote its byte counts, not hardware-GPU FPS.');
  process.exit(0);
}
if (process.argv.includes('--full-readbacks')) { console.error('--full-readbacks: retired with lib/d3dim-gpu.js (GPU stream v2)'); process.exit(2); }
const lazy = process.argv.includes('--lazy-sync');
const softwareGpu = process.argv.includes('--swiftshader');
const seconds = Number(arg('seconds', '15'));
const samples = Number(arg('samples', '1'));
const warmup = Number(arg('warmup-ms', '15000'));
assert(Number.isFinite(seconds) && seconds > 0);
assert(Number.isInteger(samples) && samples > 0);
assert(Number.isFinite(warmup) && warmup >= 0);
const output = path.resolve(ROOT, arg('out', `build/mw3-readbacks-${lazy ? 'lazy' : 'eager'}`));
assert(!fs.existsSync(path.join(output, 'result.json')), 'Choose a fresh --out directory');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const wasmPath = path.resolve(ROOT, arg('wasm', 'build/wine-assembly.wasm'));
const wasm = fs.readFileSync(wasmPath);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function observe(page) {
  return page.evaluate(async () => {
    const wine = runningApps.find(app => app.name === 'mw3')?.wine;
    const owner = wine?.hostCtx?.sharedD3DIM;
    // WAT producer counters; Threads puts the live instance in the Worker.
    const stat = wine?.guestWorker ? i => wine.guestWorker.callExport('d3dim_gps_stat', i)
      : wine?.instance?.exports.d3dim_gps_stat ? i => wine.instance.exports.d3dim_gps_stat(i) : null;
    let draw = null;
    if (stat) {
      const v = [];
      for (let i = 0; i < 43; i++) v.push((await stat(i)) >>> 0);
      const sites = ['global', 'getDC', 'bltSrc', 'bltDst', 'lock', 'texLoad', 'swDraw', 'release', 'cpuPresent',
        'parkLand', 'prepare', 'texFromRT', 'retarget', 'capture', 'lazy', 'other'];
      const why = ['unused0', 'texture', 'zfunc', 'blendFactor', 'noDepth', 'clearTarget', 'clearBackground', 'unused7'];
      draw = { draws: v[0], fallbacks: v[1], readbacks: v[2], readbackRows: v[3], flips: v[10], primitives: v[15],
        readbackBytes: v[34] };
      sites.forEach((n, i) => { draw['site_' + n] = v[16 + i]; });
      why.forEach((n, i) => { draw['decline_' + n] = v[35 + i]; });
    }
    return {
      at: performance.now(), running: !!wine?.running, hidden: document.hidden,
      isolated: crossOriginIsolated, backend: wine?.threadManager?.backend,
      presents: window.__mw3Presents, d3d: draw || null,
      guest: wine?.guestWorker?.d3dStats || null, glRenderer: owner?.glRenderer || draw?.glRenderer || null,
      endpoints: wine?._renderWorkerManager ? [...wine._renderWorkerManager.ports.values()].map(p => p.options) : [],
      display: { width: wine?.instance?.exports.get_display_mode_w?.(), height: wine?.instance?.exports.get_display_mode_h?.() }
    };
  });
}
function validate(state) {
  assert(state.running && !state.hidden && state.isolated && state.backend === 'worker', 'Visible isolated worker gameplay required');
  assert(state.d3d?.draws > 0, 'Actual WAT-producer GPU draws required (d3dim_gps_stat)');
  if (state.glRenderer && !softwareGpu) assert(!/swiftshader|llvmpipe|software|unknown/i.test(state.glRenderer), 'Software GL requires --swiftshader');
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(), app: 'mw3', route: 'tools/mw3-gameplay-route.js',
    commit: arg('source-commit', null) || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    lazySync: lazy, softwareGpu, headful: true,
    seconds, samples, warmup, wasmPath, wasmSha256: digest(wasm),
    producerSha256: digest(fs.readFileSync(path.join(ROOT, 'src/09abg-d3dim-gps.wat'))),
    fixtureSha256: digest(fs.readFileSync(path.join(ROOT, 'test/binaries/shareware/mw3/ex/Program_Files/mech3demo.exe'))),
    sourceSha256: Object.fromEntries(['lib/d3dim-render-worker.js', 'lib/render-worker.js', 'lib/d3d-render-worker.js',
      'lib/guest-worker.js', 'lib/region-map.generated.js', 'tools/mw3-gameplay-route.js'].map(file =>
      [file, digest(fs.readFileSync(path.join(ROOT, file)))])),
    machine: { platform: os.platform(), arch: os.arch(), cpus: os.cpus().length, model: os.cpus()[0].model },
    loadAtLaunch: os.loadavg(), results: [], errors: [],
    note: 'Stationary cockpit still simulates; independent launches are not identical geometry. No image polling or profiling in measured windows. GPU counters arrive at normal game fences.'
  };
  fs.writeFileSync(path.join(output, 'console.log'), '');
  let browser, page, server;
  try {
    server = await startStaticServer({ root: ROOT, crossOriginIsolated: true,
      rewritePath: pathname => pathname.startsWith('/binaries/') ? '/test' + pathname : pathname,
      allowedRealRoots: [fs.realpathSync(path.join(ROOT, 'test/binaries'))],
      handleRequest(req, res) {
        const url = new URL(req.url, 'http://localhost').pathname;
        const value = url === '/build/wine-assembly.wasm' ? ['application/wasm', wasm] : null;
        if (!value) return false;
        res.writeHead(200, { 'Content-Type': value[0], 'Cache-Control': 'no-store',
          'Cross-Origin-Resource-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' });
        res.end(value[1]); return true;
      }
    });
    browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: false, protocolTimeout: 600000,
      args: ['--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
        ...(process.argv.includes('--no-sandbox') ? ['--no-sandbox'] : []),
        ...(softwareGpu ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])] });
    report.browser = await browser.version();
    report.launchArgs = browser.process().spawnargs;
    const system = await browser.target().createCDPSession();
    report.gpuInfo = (await system.send('SystemInfo.getInfo')).gpu;
    const cpu = async () => (await system.send('SystemInfo.getProcessInfo')).processInfo;
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
    page.on('console', message => {
      const line = message.text();
      fs.appendFileSync(path.join(output, 'console.log'), line + '\n');
      if (/worker thread \d+ trapped|UNIMPLEMENTED API:|host import .* threw|\[launchApp\] failed:|FATAL:/.test(line)) report.errors.push(line);
    });
    page.on('pageerror', error => report.errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${server.address().port}/?debug&threads&d3d-renderer=webgl${lazy ? '' : '&no-lazy-sync'}`, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.bringToFront();
    await page.evaluate(async () => {
      window.__mw3Presents = 0;
      const original = WineAssembly.prototype.getImports;
      WineAssembly.prototype.getImports = function(...args) {
        const imports = original.apply(this, args), trace = imports.host.dx_trace;
        imports.host.dx_trace = function(kind, ...rest) {
          if (kind === 5) window.__mw3Presents++;
          return trace.call(this, kind, ...rest);
        };
        return imports;
      };
      await setThreads(true);
      document.getElementById('app-select').value = 'mw3';
      if (document.getElementById('app-select').value !== 'mw3') throw new Error('MW3 missing from picker');
      await launchApp();
      setRuntimeLogging(false);
    });
    await page.waitForFunction(() => window.__mw3Presents > 120,
      { timeout: 240000, polling: 500 });
    await pause(warmup);
    await gameplayRoute(page, output);
    await pause(5000);
    validate(await observe(page));
    for (let i = 0; i < samples; i++) {
      await page.screenshot({ path: path.join(output, `sample-${i + 1}-before.png`) });
      const loadBefore = os.loadavg(), cpuBefore = await cpu(), before = await observe(page);
      // No image reads, input, CDP sampling or stat polling during this window.
      await pause(seconds * 1000);
      const after = await observe(page), cpuAfter = await cpu(), loadAfter = os.loadavg();
      validate(before); validate(after);
      const frames = after.presents - before.presents, wallSeconds = (after.at - before.at) / 1000;
      assert(frames > 0 && after.d3d.draws > before.d3d.draws, 'Cockpit presents and GPU draws must advance');
      assert.equal(report.errors.length, 0, report.errors.join('\n'));
      const delta = Object.fromEntries(Object.keys(after.d3d).filter(k => typeof after.d3d[k] === 'number' &&
        typeof before.d3d[k] === 'number').map(k => [k, after.d3d[k] - before.d3d[k]]));
      const cpuByType = {};
      for (const p of cpuAfter) {
        const old = cpuBefore.find(q => q.id === p.id);
        if (old) cpuByType[p.type] = (cpuByType[p.type] || 0) + p.cpuTime - old.cpuTime;
      }
      const result = { before, after, delta, frames, counter: 'dx_present', wallSeconds, fps: frames / wallSeconds,
        perFrame: Object.fromEntries(Object.entries(delta).map(([k, v]) => [k, v / frames])),
        cpuByType, cpuMsPerFrame: 1000 * Object.values(cpuByType).reduce((a, b) => a + b, 0) / frames,
        loadBefore, loadAfter };
      report.results.push(result);
      await page.screenshot({ path: path.join(output, `sample-${i + 1}-after.png`) });
      console.log(JSON.stringify({ sample: i + 1, frames, fps: result.fps, perFrame: result.perFrame }));
    }
  } catch (error) {
    report.failure = error.stack || String(error);
    if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    process.exitCode = 1;
    console.error(report.failure);
  } finally {
    report.loadAtEnd = os.loadavg();
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
    if (browser) await browser.close();
    if (server) await closeServer(server);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
