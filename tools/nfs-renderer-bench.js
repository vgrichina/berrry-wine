#!/usr/bin/env node
'use strict';

// Local original-demo comparison. The benchmark server overrides only the
// NFS III RNG-seeding GetTickCount call; optional diagnostic flags also wrap
// served renderer scripts. Shipped code and guest files stay intact.
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const { readPE } = require('../lib/pe');
const { startStaticServer, closeServer } = require('../test/static-server');
const { summarizeProfile, printProfiles } = require('./cpu-profile-summary');
const ROOT = path.resolve(__dirname, '..');
if (process.argv.includes('--help')) {
  console.log('Diagnostics: --profile saves page/worker CPU profiles and prints each thread\'s top self time; --rpc-census prints brokered host-import round trips per frame; --readback-census records D3D fence callers and readPixels timing. Do not treat diagnostic timings as the uninstrumented baseline.');
  console.log('Glide diagnostics: --glide-lfb-metrics enables the opt-in WAT LFB reason counters (5 reasons x 7 fields), recorded in every snapshot.');
  console.log('A/B controls: --no-d3d-batching and --no-fixed-cache disable those optimizations in served scripts only; reports record the switches and source hashes.');
  console.log('Readback A/B: --full-readbacks disables bounded D3DIM readback rectangles in the served script only; bounded readbacks remain the default.');
  console.log('Emulation diagnostics: --guest-profile saves guest-main handler/block histograms and startup-to-window uop census logs. Adds overhead; histogram counts are dispatches, not CPU time.');
  console.log('Remote A/B: --wasm=FILE selects an artifact; --source-commit=REV records archive provenance; --swiftshader explicitly permits software WebGL; --no-sandbox is for an isolated Chrome test box.');
  console.log('Usage: node tools/nfs-renderer-bench.js [--cases=glide,d3d,software,glide-software] [--seconds=30] [--samples=2] [--seed=12345] [--out=build/nfs-renderer-bench]\nRequires the original nfs3_demo fixture and a current build. Runs headful Chrome serially. Saves screenshots, hardware-renderer evidence, frame counters, CPU time, and machine load. Seed instrumentation is specific to this demo.');
  process.exit(0);
}
const arg = (key, fallback) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const cases = arg('cases', 'glide,d3d,software,glide-software').split(',');
const seconds = Number(arg('seconds', '30'));
const samples = Number(arg('samples', '2'));
const seed = Number(arg('seed', '12345')) >>> 0;
const profileEnabled = process.argv.includes('--profile');
// --rpc-census: per-sample counts of the host imports each guest Worker
// blocks on (broker round trips), printed per frame.
const rpcCensus = process.argv.includes('--rpc-census');
const readbackCensus = process.argv.includes('--readback-census');
const glideLfbMetrics = process.argv.includes('--glide-lfb-metrics');
const noD3DBatching = process.argv.includes('--no-d3d-batching');
const noFixedCache = process.argv.includes('--no-fixed-cache');
const fullReadbacks = process.argv.includes('--full-readbacks');
const guestProfile = process.argv.includes('--guest-profile');
const softwareGpu = process.argv.includes('--swiftshader');
const wasmFile = path.resolve(ROOT,arg('wasm','build/wine-assembly.wasm'));
assert(Number.isFinite(seconds) && seconds > 0, 'seconds must be positive');
assert(Number.isInteger(samples) && samples >= 0, 'samples must be a nonnegative integer');
const output = path.resolve(ROOT, arg('out', 'build/nfs-renderer-bench'));
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const configurations = {
  glide: { driver: 'voodoo', dll: 'voodooa.dll', glide: 'webgl', gpu: false },
  d3d: { driver: 'd3d', dll: 'd3da.dll', glide: 'webgl', gpu: true },
  software: { driver: 'softtri', dll: 'softtria.dll', glide: 'webgl', gpu: false },
  'glide-software': { driver: 'voodoo', dll: 'voodooa.dll', glide: 'software', gpu: false },
};
for (const name of cases) assert(configurations[name], `unknown case ${name}`);
fs.mkdirSync(output, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fixtureSha256 = hash(path.join(ROOT, 'test/binaries/candidates/need-for-speed-3-demo/game/nfs3demo.exe'));
function completeModuleMap(mods, log) {
  const dir=path.join(ROOT,'test/binaries/candidates/need-for-speed-3-demo/game');
  const files=fs.readdirSync(dir);
  for (const match of log.matchAll(/\[LoadLibrary\] (\S+\.dll) loaded at 0x([0-9a-f]+)/gi)) {
    const file=files.find(f=>f.toLowerCase()===match[1].toLowerCase());
    if (file) mods[match[1].toLowerCase()]=[parseInt(match[2],16),readPE(path.join(dir,file)).imageBase];
  }
  return mods;
}
assert.equal(fixtureSha256, '0defab3eeb22ee4b6e0007a4d5b26a99d868008ba77e2b9bd3ef770e924548ad',
  'seed instrumentation requires the inspected original NFS III demo');

// The Watcom wrapper pushes three registers before CALL GetTickCount.
// Matching both returns confines the override to the one srand seed read.
const workerFile = path.join(ROOT, 'lib/guest-worker.js');
const needle = '      const result = await WebAssembly.instantiate(msg.module, built.imports);';
const originalWorker = fs.readFileSync(workerFile, 'utf8');
const d3dCensus = `
if (globalThis.D3DIMGpu) {
  const prototype = globalThis.D3DIMGpu.D3DIMGpu.prototype, draw = prototype._draw;
  prototype._draw = function(wa) {
    const before = this.stats.fallbacks, result = draw.call(this, wa);
    if (this.stats.fallbacks !== before) {
      const key = JSON.stringify({primitive:this._u32(wa+4),vertexType:this._u32(wa+8),count:this._u32(wa+16)});
      const census = this.stats.fallbackKinds || (this.stats.fallbackKinds = {});
      census[key] = (census[key] || 0) + 1;
    }
    return result;
  };
}
`;
const readbackProbe = `
if (globalThis.D3DIMGpu) {
  const prototype = globalThis.D3DIMGpu.D3DIMGpu.prototype, fence = prototype.fence;
  prototype.fence = function(...args) {
    const ex = this.getExports(), sp = ex.get_esp() >>> 0;
    const key = JSON.stringify({eip:ex.get_eip() >>> 0, ret:ex.guest_read32(sp) >>> 0});
    const census = this.stats.readbackCallers || (this.stats.readbackCallers = {});
    const row = census[key] || (census[key] = {calls:0, syncs:0, syncMs:0, readPixelsMs:0,
      stack:new Error().stack, guestStack:Array.from({length:12}, (_,i)=>ex.guest_read32(sp+i*4)>>>0)});
    const before = {syncs:this.stats.syncs, syncMs:this.stats.syncMs, readPixelsMs:this.stats.readPixelsMs || 0};
    const result = fence.apply(this,args);
    row.calls++;
    row.syncs += this.stats.syncs - before.syncs;
    row.syncMs += this.stats.syncMs - before.syncMs;
    row.readPixelsMs += (this.stats.readPixelsMs || 0) - before.readPixelsMs;
    return result;
  };
}
`;
const rendererProbe = `
if (typeof OffscreenCanvas === 'function') {
  const getContext = OffscreenCanvas.prototype.getContext;
  OffscreenCanvas.prototype.getContext = function(...args) {
    const gl = getContext.apply(this, args);
    if (gl && /webgl/.test(args[0])) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      console.log('[nfs-bench-gpu] ' + (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'));
    }
    return gl;
  };
}
`;
assert.equal(originalWorker.split(needle).length, 2, 'worker injection anchor must be unique');
const seededWorker = originalWorker.replace(needle, `
      ${guestProfile ? `
      globalThis.__nfsProfileSlot = msg.slot || 0;
      globalThis.__nfsUopRecords = [];
      if (globalThis.__nfsProfileSlot === 0) {
        const originalLog = built.imports.host.log_i32;
        let remaining = 0;
        built.imports.host.log_i32 = value => {
          const v = value >>> 0;
          if (!remaining && (v >>> 16) === 0xc5e5 && (v & 65535) >= 1 && (v & 65535) <= 9) remaining = 5;
          if (remaining) {
            if (globalThis.__nfsUopRecords.length < 1000000) globalThis.__nfsUopRecords.push(v);
            else globalThis.__nfsUopTruncated = true;
            remaining--; return;
          }
          return originalLog(value);
        };
      }` : ''}
      if ((msg.slot || 0) === 0) {
        const originalTicks = built.imports.host.get_ticks;
        let armed = true, matched = false;
        built.imports.host.get_ticks = () => {
          if (armed && instance) {
            const ex = instance.exports, sp = ex.get_esp() >>> 0;
            if ((ex.guest_read32(sp) >>> 0) === 0x4b3c7c &&
                (ex.guest_read32(sp + 16) >>> 0) === 0x472107) {
              if (!matched) console.log('[nfs-bench] seeded srand=${seed} slot=' + msg.slot);
              matched = true;
              return ${seed};
            }
            if (matched) armed = false;
          }
          return originalTicks();
        };
      }
${needle}
      ${guestProfile ? 'if ((msg.slot || 0) === 0) (result.exports || result.instance.exports).set_uop_census(1);' : ''}`);

async function observe(page) {
  return page.evaluate(metricsEnabled => {
    const wine = runningApps.find(app => app.name === 'nfs3_demo')?.wine;
    const ex = wine?.instance?.exports;
    const glide = wine?.hostCtx?.glideBridge?.device;
    const gl = glide?.backend?.gl;
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const draw = wine?.hostCtx?.sharedD3DIM?.stats || wine?.guestWorker?.d3dStats;
    const renderer = wine?.renderer;
    const wins = Object.values(renderer?.windows || {}).filter(w => w.visible && !w.isChild);
    const win = wins[wins.length - 1];
    const surface = win?._dxFrameLayer?.canvas || win?._backCanvas;
    const read = addr => ex?.guest_read32 ? ex.guest_read32(addr) >>> 0 : null;
    let glideLfb = null;
    if (metricsEnabled) {
      if (!ex?.glide_lfb_metrics_enable || !ex?.glide_lfb_metrics_get)
        throw new Error('--glide-lfb-metrics requires a build with the WAT metric exports');
      if (!window.__nfsGlideLfbMetricsEnabled) {
        ex.glide_lfb_metrics_enable(1); window.__nfsGlideLfbMetricsEnabled = true;
      }
      glideLfb = {
        reasons: ['readLock', 'writeLock', 'readRegion', 'glide2WriteRegion', 'glide3WriteRegion'],
        fields: ['attempts', 'requestedPixels', 'stagedPixels', 'fullSizeRequests', 'lastWidth', 'lastHeight', 'lastGuestReturn'],
        rows: Array.from({ length: 5 }, (_, reason) => Array.from({ length: 7 }, (_, field) => ex.glide_lfb_metrics_get(reason, field)))
      };
    }
    return { at: performance.now(), running: !!wine?.running,
      backend: wine?.threadManager?.backend, hidden: document.hidden,
      flips: window.__nfsBenchFlips, presents: window.__nfsBenchPresents, swaps: glide?.stats.swaps,
      glide: glide?.stats, d3d: draw, glideLfb,
      glideEndpoint: wine?.hostCtx?.glideBridge?.endpoint?.options || null,
      glRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : glide?.glRenderer || draw?.glRenderer || wine?.hostCtx?.sharedD3DIM?.glRenderer || null,
      renderWorker: wine?._renderWorkerManager ? {
        endpoints: [...wine._renderWorkerManager.ports.values()].map(port => port.options),
        queuedBytes: wine._renderWorkerManager.queuedBytes,
      } : null,
      scene: { mode: read(0x6fb3b8), ai: read(0x6fb4f0),
        weather: read(0x6fb4cc), night: read(0x6fb4c8) },
      surface: surface ? { width: surface.width, height: surface.height } : null,
      display: ex ? { width: ex.get_display_mode_w?.(), height: ex.get_display_mode_h?.() } : null,
      perf: window.WinePerf?.snapshot(),
      // {"slot:name": count}; empty unless the page was loaded with ?rpc-census.
      rpcCalls: Object.fromEntries((wine?.guestWorker?.broker?.stats?.().calls || [])
        .map(c => [c.slot + ':' + c.name, c.count])),
    };
  }, glideLfbMetrics);
}

function assertGlideBackend(state, expected) {
  assert(state.glideEndpoint?.api === 'glide' && state.glideEndpoint.backend === expected,
    `requested Glide ${expected}, actual endpoint ${JSON.stringify(state.glideEndpoint)}`);
}

async function runCase(server, name) {
  const config = configurations[name];
  const dir = path.join(output, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'console.log'), '');
  let browser, page;
  const errors = [], dlls = new Set();
  const report = { name, config, glideLfbMetrics, samples: [], loadAtLaunch: os.loadavg() };
  try {
    browser = await puppeteer.launch({ executablePath: chrome, headless: false,
      protocolTimeout: 600000, args: ['--no-first-run', '--no-default-browser-check',
        '--window-size=900,700', '--autoplay-policy=no-user-gesture-required',
        ...(process.argv.includes('--no-sandbox') ? ['--no-sandbox'] : []),
        ...(softwareGpu ? ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] : [])] });
    report.browser = await browser.version();
    report.launchArgs = browser.process().spawnargs;
    const system = await browser.target().createCDPSession();
    report.gpuInfo = (await system.send('SystemInfo.getInfo')).gpu;
    const cpu = async () => (await system.send('SystemInfo.getProcessInfo')).processInfo;
    page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });
    page.on('console', message => {
      const line = message.text();
      fs.appendFileSync(path.join(dir, 'console.log'), line + '\n');
      if (/LoadLibrary.*(?:voodoo\w*|d3da|softtria)\.dll loaded/.test(line)) { dlls.add(line); console.log(name, line); }
      if (/\[nfs-bench\]/.test(line)) { report.seedHook = true; console.log(name, line); }
      if (/\[nfs-bench-gpu\]/.test(line)) report.activeGpuRenderer = line;
      if (/worker thread \d+ trapped|UNIMPLEMENTED API:|host import .* threw|\[launchApp\] failed:|FATAL:/.test(line)) errors.push(line);
    });
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${server.address().port}/?threads&perf${rpcCensus ? '&rpc-census' : ''}&d3d-renderer=${config.driver === 'softtri' ? 'software' : config.glide}`,
      { waitUntil: 'networkidle2', timeout: 90000 });
    await page.bringToFront();
    await page.evaluate(async config => {
      window.__nfsBenchFlips = 0;
      window.__nfsBenchPresents = 0;
      const getImports = WineAssembly.prototype.getImports;
      WineAssembly.prototype.getImports = function(...args) {
        const result = getImports.apply(this, args), trace = result.host.dx_trace;
        result.host.dx_trace = function(kind, ...rest) {
          if (kind === 6) window.__nfsBenchFlips++;
          if (kind === 5) window.__nfsBenchPresents++;
          return trace.call(this, kind, ...rest);
        };
        return result;
      };
      await setThreads(true);
      const app = window.wineApps.APPS.nfs3_demo;
      const keyPath = 'HKLM\\Software\\Electronic Arts\\Need For Speed III Demo';
      app.startupRegistry = [{ keyPath, valueName: 'Thrash Driver', type: 1, data: config.driver },
        { keyPath, valueName: 'D3D Device', type: 4, data: 0 }];
      document.getElementById('app-select').value = 'nfs3_demo';
      await launchApp();
      window.__nfsBenchLaunched = performance.now();
    }, config);
    let lastProgress = 0;
    const launchStart = Date.now();
    while (true) {
      const state = await observe(page);
      if (errors.length) throw new Error(errors[0]);
      const triangles = config.driver === 'voodoo' ? state.glide?.triangles : state.d3d?.triangles;
      const ready = config.driver === 'softtri'
        ? state.presents > 100 && Date.now() - launchStart > 40000
        : triangles > 100000;
      if (ready) break;
      if (Date.now() - lastProgress > 20000) {
        console.log(name, 'loading', JSON.stringify({flips:state.flips,swaps:state.swaps,triangles,scene:state.scene}));
        lastProgress = Date.now();
      }
      assert(Date.now() - launchStart < 600000, 'race readiness timed out');
      await sleep(1000);
    }
    report.ready = await observe(page);
    if (config.driver === 'voodoo') assertGlideBackend(report.ready, config.glide);
    assert(report.seedHook, 'deterministic seed hook must execute');
    if (seed === 12345) assert.deepStrictEqual(report.ready.scene, {mode:3, ai:0, weather:1, night:0});
    assert([...dlls].some(line => line.includes(config.dll)), 'requested original renderer must load');
    if (config.driver === 'softtri') {
      const base = Number([...dlls].find(line => line.includes(config.dll)).match(/loaded at (0x[0-9a-f]+)/i)[1]);
      report.softwareRaster = await page.evaluate(base => {
        const ex = runningApps.find(app => app.name === 'nfs3_demo').wine.instance.exports;
        const r = off => ex.guest_read32(base + off) >>> 0;
        return {modeWidth:r(0x400c4), modeHeight:r(0x400c8),
          rasterWidth:r(0x3e0f4), rasterHeight:r(0x3e0f8),
          backWidth:r(0x3e10c), backHeight:r(0x3e110), bytePitch:r(0x3e0ec)};
      }, base);
    }
    assert.equal(report.ready.backend, 'worker');
    if (config.gpu || (config.driver === 'voodoo' && config.glide === 'webgl')) {
      const gpu = report.ready.glRenderer || report.activeGpuRenderer;
      // The context's own WEBGL_debug_renderer_info string is not evidence on
      // its own: on a GPU-less Linux boat (no /dev/dri, GLX llvmpipe) Chrome
      // 151 reported "ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 ...)" in
      // the page and in workers while CDP SystemInfo named SwiftShader, with
      // or without the SwiftShader flags. Both readings must agree.
      const cdpGpu = [report.gpuInfo?.auxAttributes?.glRenderer,
        ...(report.gpuInfo?.devices || []).map(d => d.deviceString)].filter(Boolean).join(' | ');
      report.rendererIdentity = { context: gpu || null, cdp: cdpGpu || null };
      const soft = /swiftshader|llvmpipe|software|unknown/i;
      assert(gpu && cdpGpu, 'renderer identity requires both the context string and CDP SystemInfo');
      if (softwareGpu) assert(soft.test(cdpGpu), `--swiftshader run, but CDP reports ${cdpGpu}`);
      else assert(!soft.test(gpu) && !soft.test(cdpGpu),
        `hardware WebGL renderer required unless --swiftshader is explicit (context ${gpu}, CDP ${cdpGpu})`);
    }
    await page.screenshot({ path: path.join(dir, 'ready.png') });
    console.log(name, 'race ready', JSON.stringify(report.ready.scene), 'warming 10s');
    await sleep(10000);
    let profileWorker;
    if (guestProfile) {
      for (const worker of page.workers()) {
        if (await worker.evaluate(() => globalThis.__nfsGuestProfile?.('identify'))) { profileWorker=worker; break; }
      }
      assert(profileWorker, 'guest-main profiling worker required');
    }
    for (let i = 0; i < samples; i++) {
      await page.bringToFront();
      await page.screenshot({ path: path.join(dir, `sample-${i + 1}-before.png`) });
      const profilers = [];
      if (profileEnabled) {
        const targets = [{label:'page', client:await page.target().createCDPSession()},
          ...page.workers().map((worker, index) => ({label:'worker-' + index, client:worker.client, url:worker.url()}))];
        for (const target of targets) {
          if (!target.client) continue;
          await target.client.send('Profiler.enable');
          await target.client.send('Profiler.setSamplingInterval', {interval:1000});
          await target.client.send('Profiler.start');
          profilers.push(target);
        }
      }
      const loadBefore = os.loadavg(), cpuBefore = await cpu(), before = await observe(page);
      const guestBefore = guestProfile ? await profileWorker.evaluate(() => globalThis.__nfsGuestProfile('arm')) : null;
      await sleep(seconds * 1000);
      if (guestProfile) {
        const hist=await profileWorker.evaluate(() => globalThis.__nfsGuestProfile('read'));
        assert(hist.ops > 0 && hist.blockHits > 0, 'guest-main histogram must contain executed work');
        const mods=await page.evaluate(() => {
          const bases=runningApps.find(app=>app.name==='nfs3_demo').wine.moduleBases||{};
          return Object.fromEntries(Object.entries(bases).map(([k,v])=>[k,[v.base||v.loadAddr||0,v.origBase||0]]));
        });
        assert(!hist.censusTruncated, 'uop census buffer overflow');
        fs.writeFileSync(path.join(dir,`sample-${i+1}-uop.log`),hist.census.map(v=>'[i32] 0x'+v.toString(16)).join('\n')+'\n');
        delete hist.census;
        completeModuleMap(mods,fs.readFileSync(path.join(dir,'console.log'),'utf8'));
        fs.writeFileSync(path.join(dir,`sample-${i+1}-hist.json`),JSON.stringify({...hist,mods,guestBefore},null,2));
      }
      const after = await observe(page), cpuAfter = await cpu(), loadAfter = os.loadavg();
      if (config.driver === 'voodoo') {
        assertGlideBackend(before, config.glide); assertGlideBackend(after, config.glide);
      }
      const profileThreads = [];
      for (const target of profilers) {
        const { profile } = await target.client.send('Profiler.stop');
        fs.writeFileSync(path.join(dir, 'sample-' + (i+1) + '-' + target.label + '.cpuprofile'), JSON.stringify(profile));
        const url = target.url ? ' ' + target.url.replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '') : '';
        profileThreads.push({ label: target.label + url, ...summarizeProfile(profile, 15) });
      }
      if (profileThreads.length) printProfiles(profileThreads, seconds);
      assert(before.running && after.running && !before.hidden && !after.hidden, 'visible live game required');
      assert.deepStrictEqual(after.scene, before.scene, 'scene configuration must remain fixed');
      if (errors.length) throw new Error(errors[0]);
      assert.equal(after.glide?.errors || after.d3d?.errors || 0, 0);
      const frames = config.driver === 'voodoo' ? after.swaps - before.swaps
        : config.driver === 'softtri' ? after.presents - before.presents : after.flips - before.flips;
      const wallSeconds = (after.at - before.at) / 1000;
      const cpuByType = {};
      for (const p of cpuAfter) {
        const old = cpuBefore.find(q => q.id === p.id);
        if (old) cpuByType[p.type] = (cpuByType[p.type] || 0) + p.cpuTime - old.cpuTime;
      }
      const cpuSeconds = Object.values(cpuByType).reduce((a,b) => a+b,0);
      assert(frames > 0, 'no guest frame swaps in sample');
      const result = { frames, wallSeconds, fps: frames / wallSeconds,
        counter: config.driver === 'voodoo' ? 'grBufferSwap' : config.driver === 'softtri' ? 'dx_present' : 'IDirectDrawSurface::Flip',
        cpuSeconds, cpuMsPerFrame: 1000 * cpuSeconds / frames, cpuByType,
        loadBefore, loadAfter, contended: Math.max(loadBefore[0], loadAfter[0]) > 4,
        before, after };
      if (rpcCensus) {
        result.rpcPerFrame = Object.entries(after.rpcCalls || {})
          .map(([k, n]) => [k, (n - (before.rpcCalls?.[k] || 0)) / frames])
          .filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
        console.log(name, `sample${i+1} rpc round trips per frame (slot:import):`);
        for (const [k, n] of result.rpcPerFrame.slice(0, 20)) console.log(`    ${n.toFixed(1).padStart(8)}  ${k}`);
      }
      report.samples.push(result);
      console.log(name, `sample${i+1}`, JSON.stringify({fps:result.fps,cpuMsPerFrame:result.cpuMsPerFrame,frames,wallSeconds,loadBefore,loadAfter}));
      await page.screenshot({ path: path.join(dir, `sample-${i + 1}-after.png`) });
      fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(report, null, 2));
    }
  } catch (error) {
    report.failure = String(error.stack || error);
    console.error(name, report.failure);
  } finally {
    report.errors = errors;
    report.loadedRenderers = [...dlls];
    if (page && !page.isClosed()) {
      report.last = await observe(page).catch(() => null);
      await page.screenshot({path:path.join(dir,'last.png')}).catch(() => {});
    }
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(report, null, 2));
    if (browser) await browser.close();
  }
  return report;
}

(async () => {
  const fixtureRoot = fs.realpathSync(path.join(ROOT, 'test/binaries/candidates'));
  const server = await startStaticServer({ root: ROOT, crossOriginIsolated: true,
    allowedRealRoots: [fixtureRoot, fs.realpathSync(path.join(ROOT, 'fonts'))],
    handleRequest(req, res) {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname === '/build/wine-assembly.wasm') {
        res.writeHead(200, {'Content-Type':'application/wasm','Cache-Control':'no-store'});
        res.end(fs.readFileSync(wasmFile)); return true;
      }
      if (noFixedCache && pathname === '/lib/d3d9-backend.js') {
        const source = fs.readFileSync(path.join(ROOT,'lib/d3d9-backend.js'),'utf8');
        const anchor = 'this.fixedPlans.compile(draw, vp, guestPS)';
        assert.equal(source.split(anchor).length, 2);
        res.writeHead(200, {'Content-Type':'application/javascript','Cache-Control':'no-store'});
        res.end(source.replace(anchor, 'Fixed.compile(draw, vp, guestPS)'));
        return true;
      }
      if ((profileEnabled || readbackCensus || noD3DBatching || fullReadbacks) && pathname === '/lib/d3dim-gpu.js') {
        res.writeHead(200, {'Content-Type':'application/javascript','Cache-Control':'no-store',
          'Cross-Origin-Resource-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});
        let source = fs.readFileSync(path.join(ROOT,'lib/d3dim-gpu.js'),'utf8');
        if (noD3DBatching) {
          const anchor = 'this.batchDraws = options.batchDraws !== false;';
          assert.equal(source.split(anchor).length, 2);
          source = source.replace(anchor, 'this.batchDraws = false;');
        }
        if (fullReadbacks) {
          const anchor = 'this.boundedReadback = options.boundedReadback !== false;';
          assert.equal(source.split(anchor).length, 2, 'bounded readback constructor anchor must be unique');
          source = source.replace(anchor, 'this.boundedReadback = false;');
        }
        if (readbackCensus) {
          const read = 'gl.readPixels(left, height - bottom, readWidth, readHeight, gl.RGBA, gl.UNSIGNED_BYTE, read);';
          assert.equal(source.split(read).length, 2, 'readPixels timing anchor must be unique');
          source = source.replace(read, 'const readStart = now(); ' + read +
            ' this.stats.readPixelsMs = (this.stats.readPixelsMs || 0) + now() - readStart;');
        }
        res.end(source + ((profileEnabled || readbackCensus) ? d3dCensus : '') + (readbackCensus ? readbackProbe : ''));
        return true;
      }
      if (pathname !== '/lib/guest-worker.js') return false;
      res.writeHead(200, {'Content-Type':'application/javascript','Cache-Control':'no-store',
        'Cross-Origin-Resource-Policy':'same-origin',
        'Cross-Origin-Embedder-Policy':'require-corp'});
      res.end(seededWorker + rendererProbe + (guestProfile ? fs.readFileSync(path.join(ROOT,'tools/page-probes/nfs-guest-profile.js'),'utf8') : '')); return true;
    } });
  const meta = { startedAt: new Date().toISOString(), commit: arg('source-commit',null) || execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),
    wasmSha256: hash(wasmFile), wasmFile, softwareGpu, headful:true, seed, seconds, samples, profileEnabled, readbackCensus,
    machine: { platform:os.platform(), arch:os.arch(), cpus:os.cpus().length, model:os.cpus()[0].model },
    fixtureSha256, noD3DBatching, noFixedCache, fullReadbacks, boundedReadbacks: !fullReadbacks, guestProfile,
    sourceSha256: Object.fromEntries(['lib/d3dim-gpu.js','lib/d3d9-backend.js','lib/d3d9-fixed.js',
      'lib/guest-worker.js','tools/page-probes/nfs-guest-profile.js'].map(file => [file,hash(path.join(ROOT,file))])),
    results: [] };
  try {
    for (const name of cases) {
      meta.results.push(await runCase(server,name));
      fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(meta,null,2));
    }
  } finally { await closeServer(server); }
  if (meta.results.some(r => r.failure)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
