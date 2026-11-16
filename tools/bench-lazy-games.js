#!/usr/bin/env node
'use strict';

// Shared-renderer lazy synchronization in real games. Instrumentation is served
// only by this harness; all guest workers contribute counters and frame times.
const fs = require('fs'), path = require('path'), os = require('os');
const assert = require('assert'), crypto = require('crypto');
const puppeteer = require('puppeteer');
const { startStaticServer, closeServer } = require('../test/static-server');
const ROOT = path.resolve(__dirname, '..');
const opt = (n, d) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const app = opt('app', 'mw3'), lazy = process.argv.includes('--lazy-sync');
const shippedDefault = process.argv.includes('--shipped-default');
const noLazySync = process.argv.includes('--no-lazy-sync');
assert(!shippedDefault || !lazy, 'shipped default must not force the WASM option');
assert(!noLazySync || shippedDefault, '--no-lazy-sync requires --shipped-default');
const traceFences = process.argv.includes('--trace-fences');
const seconds = Number(opt('seconds', '20')), samples = Number(opt('samples', '2'));
const output = path.resolve(opt('out', `build/lazy-games/${app}-${shippedDefault ? (noLazySync ? 'optout' : 'default') : (lazy ? 'on' : 'off')}`));
assert(['mw3', 'gta2_demo'].includes(app));
assert(seconds > 0 && samples > 0 && Number.isInteger(samples));
assert(!fs.existsSync(path.join(output, 'result.json')), 'Use a fresh output directory');
fs.mkdirSync(output, { recursive: true });
const pause = ms => new Promise(r => setTimeout(r, ms));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const wasm = fs.readFileSync(path.resolve(opt('wasm', 'build/wine-assembly.wasm')));
const originalWorker = fs.readFileSync(path.join(ROOT, 'lib/guest-worker.js'), 'utf8');
const seam = '      const result = await WebAssembly.instantiate(msg.module, built.imports);';
assert.equal(originalWorker.split(seam).length, 2, 'guest worker instrumentation seam changed');
const workerSource = originalWorker.replace(seam, `
      ${shippedDefault ? '' : `msg.d3dimLazySync = ${lazy};`}
      const lazyBenchTimes = [];
      const lazyBenchFences = {};
      ${traceFences ? `
      const lazyBenchGpu = built.imports.host.gpu_gl_call;
      built.imports.host.gpu_gl_call = (...args) => {
        const result = lazyBenchGpu(...args);
        if (args[0] === 0x20001 || args[0] === 0x20007) {
          const key = JSON.stringify([args, result, new Error().stack]);
          lazyBenchFences[key] = (lazyBenchFences[key] || 0) + 1;
        }
        return result;
      };` : ''}
      const lazyBenchTrace = built.imports.host.dx_trace;
      built.imports.host.dx_trace = (...args) => {
        if (args[0] === ${app === 'mw3' ? 5 : 6}) {
          if (lazyBenchTimes.length >= 120000) throw Error('frame recorder overflow');
          lazyBenchTimes.push(performance.timeOrigin + performance.now());
        }
        return lazyBenchTrace(...args);
      };
      ${seam.trim()}
      const lazyBenchExports = (result.exports ? result : result.instance).exports;
      ${shippedDefault ? '' : `lazyBenchExports.d3dim_lazy_enable(${lazy ? 1 : 0});`}
      globalThis.__lazyGameSnapshot = () => ({
        times: lazyBenchTimes.slice(), tid: lazyBenchExports.get_current_thread_id?.(),
        fenceTrace: lazyBenchFences,
        armed: lazyBenchExports.get_d3dim_lazy_armed(),
        touched: lazyBenchExports.get_d3dim_lazy_touched(),
        untouched: lazyBenchExports.get_d3dim_lazy_untouched(),
        d3d: d3dCommands?.snapshot() || null,
        // WAT producer counters (src/09abg-d3dim-gps.wat d3dim_gps_stat 0..42:
        // readbacks by site 16..31, bytes 34, declines by reason 35..42).
        gps: lazyBenchExports.d3dim_gps_stat
          ? Array.from({ length: 43 }, (_, i) => lazyBenchExports.d3dim_gps_stat(i) >>> 0) : null
      });`);
fs.writeFileSync(path.join(output, 'guest-worker.js'), workerSource);
const report = { app, lazy: shippedDefault ? !noLazySync : lazy, shippedDefault, traceFences, seconds, samples, started: new Date().toISOString(),
  wasmSha256: hash(wasm), workerSha256: hash(originalWorker), servedWorkerSha256: hash(workerSource),
  sourceSha256: Object.fromEntries(['src/09abg-d3dim-gps.wat', 'lib/d3d-command-stream.js',
    'lib/d3d-render-worker.js', 'lib/d3dim-render-worker.js', 'lib/region-map.generated.js',
    'host.js', 'index.html', 'lib/guest-thread-host.js', 'lib/thread-manager.js',
    'tools/mw3-gameplay-route.js'].map(f => [f, hash(fs.readFileSync(path.join(ROOT, f)))])),
  cpu: os.cpus()[0].model, loadAtLaunch: os.loadavg(), results: [], errors: [],
  note: 'Independent launches simulate different geometry. All guest producers are recorded. No polling, screenshots or profiler in measured windows. Timings are guest presents/flips, not browser rAF.' };
let browser, page, server;
const workers = new Map();
async function capture() {
  for (const worker of page.workers()) if (!workers.has(worker)) workers.set(worker, workers.size);
  const guest = [];
  for (const [worker, id] of workers) {
    try {
      const data = await worker.evaluate(() => globalThis.__lazyGameSnapshot?.() || null);
      if (data) guest.push({ id, ...data });
    } catch (error) {
      // Never silently lose a producer that exited during a measurement.
      if (worker.__wasMeasured) throw Error(`Measured worker ${id} exited: ${error}`);
    }
  }
  const state = await page.evaluate(app => {
    const wine = runningApps.find(a => a.name === app)?.wine;
    return { at: performance.timeOrigin + performance.now(), running: !!wine?.running,
      hidden: document.hidden, isolated: crossOriginIsolated, backend: wine?.threadManager?.backend,
      spawned: wine?.threadManager?._spawnedCount,
      threads: [...(wine?.threadManager?.threads?.values() || [])].map(t => ({ tid: t.tid, state: t.state })),
      endpoints: [...(wine?._renderWorkerManager?.ports?.values() || [])].map(p => p.options),
      events: window.__lazyThreadEvents || [] };
  }, app);
  return { ...state, guest };
}
function validate(s) {
  assert(s.running && s.isolated && !s.hidden && s.backend === 'worker', 'Visible worker gameplay required');
  assert(s.endpoints.some(p => p.api === 'legacy' && p.backend === 'webgl'), 'Shared WebGL endpoint required');
  const active = s.guest.filter(g => g.d3d?.draws > 0);
  assert(active.length, 'No GPU draws');
  for (const g of active) {
    assert.equal(g.d3d.errors || 0, 0, 'GPU errors');
    assert(g.d3d.glRenderer && !/swiftshader|llvmpipe|software|unknown/i.test(g.d3d.glRenderer), 'Hardware GPU required');
  }
}
function totals(s) {
  const sum = {};
  for (const g of s.guest) for (const [k, v] of Object.entries({ ...g.d3d,
    lazyArmed: g.armed, lazyTouched: g.touched, lazyUntouched: g.untouched }))
    if (typeof v === 'number') sum[k] = (sum[k] || 0) + v;
  return sum;
}
(async () => {
  const watchdog = setTimeout(() => { console.error('Game benchmark deadline'); browser?.process()?.kill('SIGTERM'); }, 540000);
  try {
    server = await startStaticServer({ root: ROOT, crossOriginIsolated: true,
      rewritePath: p => p.startsWith('/binaries/') ? '/test' + p : p,
      allowedRealRoots: [fs.realpathSync(path.join(ROOT, 'test/binaries'))],
      handleRequest(req, res) {
        const url = new URL(req.url, 'http://localhost').pathname;
        const value = url === '/lib/guest-worker.js' ? ['application/javascript', workerSource]
          : url === '/build/wine-assembly.wasm' ? ['application/wasm', wasm] : null;
        if (!value) return false;
        res.writeHead(200, { 'Content-Type': value[0], 'Cache-Control': 'no-store',
          'Cross-Origin-Resource-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' });
        res.end(value[1]); return true;
      } });
    browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome',
      headless: false, protocolTimeout: 240000, args: ['--no-first-run', '--no-default-browser-check',
        '--autoplay-policy=no-user-gesture-required'] });
    report.browser = await browser.version();
    const system = await browser.target().createCDPSession();
    report.gpuInfo = (await system.send('SystemInfo.getInfo')).gpu;
    const cpu = async () => (await system.send('SystemInfo.getProcessInfo')).processInfo;
    page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
    page.on('console', m => {
      const line = m.text(); fs.appendFileSync(path.join(output, 'console.log'), line + '\n');
      if (/worker thread \d+ trapped|UNIMPLEMENTED API:|host import .* threw|\[launchApp\] failed:|FATAL:/.test(line)) report.errors.push(line);
    });
    page.on('pageerror', e => report.errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${server.address().port}/?debug&threads&d3d-renderer=webgl${noLazySync ? '&no-lazy-sync' : ''}`, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.bringToFront();
    await page.evaluate(async app => {
      window.__lazyThreadEvents = [];
      const original = ThreadManager.prototype._emitThreadEvent;
      ThreadManager.prototype._emitThreadEvent = function(type, data) {
        window.__lazyThreadEvents.push({ type, at: performance.timeOrigin + performance.now(), tid: data?.tid });
        return original.call(this, type, data);
      };
      await setThreads(true);
      document.getElementById('app-select').value = app;
      if (document.getElementById('app-select').value !== app) throw Error('App missing: ' + app);
      await launchApp(); setRuntimeLogging(false);
    }, app);
    console.log('Launched', app, report.lazy ? 'lazy ON' : 'lazy OFF', shippedDefault ? '(shipped setting)' : '(forced)');
    await pause(app === 'mw3' ? 30000 : 15000);
    await page.screenshot({ path: path.join(output, 'menu.png') });
    if (app === 'mw3') await require('./mw3-gameplay-route')(page, output);
    else {
      await page.keyboard.down('Enter'); await pause(500); await page.keyboard.up('Enter');
      await pause(20000);
    }
    await pause(Number(opt('warmup-ms', '5000')));
    report.routed = await capture(); validate(report.routed);
    for (let i = 0; i < samples; i++) {
      await page.screenshot({ path: path.join(output, `sample-${i}-before.png`) });
      const cpuBefore = await cpu(), before = await capture(), loadBefore = os.loadavg();
      validate(before);
      for (const worker of workers.keys()) worker.__wasMeasured = before.guest.some(g => g.id === workers.get(worker));
      await pause(seconds * 1000);
      const after = await capture(), cpuAfter = await cpu(), loadAfter = os.loadavg();
      validate(after); assert.equal(report.errors.length, 0, report.errors.join('\n'));
      const threadTransitions = after.events.filter(e => ['create','spawn','exit'].includes(e.type) &&
        e.at >= before.at && e.at <= after.at);
      assert(!threadTransitions.length, 'Thread lifetime changed within timing window; counters may be incomplete');
      const frameProducers = after.guest.map(g => ({ id: g.id,
        frames: g.times.filter(t => t >= before.at && t <= after.at).length })).filter(g => g.frames);
      assert.equal(frameProducers.length, 1, 'Multiple active presentation streams require surface-specific timing');
      const times = after.guest.flatMap(g => g.times.filter(t => t >= before.at && t <= after.at)).sort((a,b) => a-b);
      const intervals = times.slice(1).map((t,j) => t-times[j]).sort((a,b) => a-b);
      assert(times.length > 10, 'No advancing gameplay frames');
      const a = totals(before), b = totals(after);
      const delta = Object.fromEntries(Object.keys(b).map(k => [k,b[k]-(a[k] || 0)]));
      assert(delta.triangles > 0, 'No advancing geometry');
      const cpuByType = {};
      for (const p of cpuAfter) {
        const old = cpuBefore.find(q => q.id === p.id);
        if (old) cpuByType[p.type] = (cpuByType[p.type] || 0) + p.cpuTime-old.cpuTime;
      }
      const duration = (after.at-before.at)/1000;
      const result = { before, after, frames: times.length, seconds: duration, fps: times.length/duration,
        p50: intervals[Math.floor(intervals.length*.5)], p95: intervals[Math.floor(intervals.length*.95)],
        p99: intervals[Math.floor(intervals.length*.99)], max: intervals.at(-1),
        delta, frameProducers, threadTransitions,
        perFrame: Object.fromEntries(Object.entries(delta).map(([k,v]) => [k,v/times.length])),
        cpuByType, loadBefore, loadAfter };
      report.results.push(result);
      await page.screenshot({ path: path.join(output, `sample-${i}-after.png`) });
      console.log(JSON.stringify({ sample:i, fps:result.fps, p95:result.p95, perFrame:result.perFrame }));
    }
  } catch (e) {
    report.failure = e.stack || String(e); process.exitCode = 1; console.error(report.failure);
    if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  } finally {
    clearTimeout(watchdog); report.loadAtEnd = os.loadavg();
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');
    if(browser)await browser.close(); if(server)await closeServer(server);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
