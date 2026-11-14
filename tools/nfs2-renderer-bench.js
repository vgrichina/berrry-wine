#!/usr/bin/env node
'use strict';

// Original NFS II software demo versus SE Glide demo: editions differ.
// No guest clock/RNG overrides. Run cases serially, with screenshot checkpoints.
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const { startStaticServer, closeServer } = require('../test/static-server');
const { summarizeProfile, printProfiles } = require('./cpu-profile-summary');
const ROOT = path.resolve(__dirname, '..');
const arg = (key, fallback) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
if (process.argv.includes('--help')) {
  console.log(`Usage: node tools/nfs2-renderer-bench.js [options]
  --cases=originalsoftware,seglide[,seglidesoftware]
  --se-fixture=/absolute/path/to/extracted/demo
  --stage=menu|race|measure  --continue-file=/tmp/menu-reviewed
  --seconds=30 --samples=2 --accelerate (default: stationary)
  --trace-api=LoadLibraryA,GetProcAddress (diagnostics only, not timing)
  --capture-frame [--capture-min-blue=N] (up to 30 frames/60 seconds; blue pixels below y=200)
  --glide-lfb-metrics (opt-in WAT LFB reasons, 5 x 7 counter snapshot; diagnostic timing)
  --swiftshader (explicit software WebGL; results are not hardware-GPU performance)
  --cpu-profile [--cpu-profile-top=15] (V8 profile of page + every Worker per sample; diagnostic timing)
  --rpc-census (per-sample counts of brokered host imports per guest thread slot)
  --no-sandbox (isolated Chrome test box only)
  --menu-click=130,310 --menu-wait=35 --race-wait=25 --out=build/nfs2-renderer-bench

Prepare the original public SE 3Dfx demo (no full-game assets required):
  curl -L --fail -o /private/tmp/nfs2sea-demo.zip https://www.classicdosgames.com/files/games/electronicarts/nfs2sea.zip
  unzip -n /private/tmp/nfs2sea-demo.zip -d /private/tmp/nfs2sea-demo
  node tools/nfs2-renderer-bench.js --se-fixture=/private/tmp/nfs2sea-demo --stage=menu
Archive SHA256: 614875b33de12565fa395bc05070c0bb83b5905acf4eb8b39f7bed060d0b4d2e
Without --se-fixture, build/nfs2se-config.json is used for SE cases.
Inspect menu.png and ready.png before reporting a race measurement.
The original and SE demos use different editions/tracks; this is not a renderer-only A/B.`);
  process.exit(0);
}
const cases = arg('cases', 'originalsoftware,seglide').split(',');
const seconds = Number(arg('seconds', '30'));
const samples = Number(arg('samples', '2'));
// Default measurement leaves the car stationary; --accelerate opts into driving.
const accelerate = process.argv.includes('--accelerate');
const captureFrame = process.argv.includes('--capture-frame');
const glideLfbMetrics = process.argv.includes('--glide-lfb-metrics');
const softwareGpu = process.argv.includes('--swiftshader');
// --cpu-profile: V8 sampling profile of the page and every Worker over each
// sample. The renderer process runs ~2 cores flat out in a race, so the
// question is which thread and what in it; raw .cpuprofile files land beside
// result.json. Diagnostic: the profiler's overhead makes these samples slower.
const cpuProfile = process.argv.includes('--cpu-profile');
const cpuProfileTop = Number(arg('cpu-profile-top', '15')) || 15;
// --rpc-census: per-sample histogram of the host imports guest Workers block
// on (broker round trips), read as before/after deltas.
const rpcCensus = process.argv.includes('--rpc-census');
const captureMinBlue = Number(arg('capture-min-blue', '0'));
const stage = arg('stage', 'measure');
assert(['menu', 'race', 'measure'].includes(stage));
const continueFile = arg('continue-file', '');
const traceApiNames = arg('trace-api', '').split(',').filter(Boolean);
const menuClick = arg('menu-click', '130,310').split(',').map(Number);
const raceWait = Number(arg('race-wait', '25'));
const menuWait = Number(arg('menu-wait', '35'));
const output = path.resolve(ROOT, arg('out', 'build/nfs2-renderer-bench'));
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const configurations = {
  originalsoftware: { app: 'nfs2_demo', edition: 'Original May 1997 demo', glide: 'webgl', accelerated: false },
  seglide: { app: 'nfs2se_demo', edition: 'SE 3Dfx demo', glide: 'webgl', accelerated: true },
  seglidesoftware: { app: 'nfs2se_demo', edition: 'SE 3Dfx demo', glide: 'software', accelerated: true },
};
for (const name of cases) assert(configurations[name], `unknown case ${name}`);
fs.mkdirSync(output, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// Exact URL-to-file map: external fixtures need no checkout symlink, and a
// request cannot traverse outside the caller-selected fixture directory.
const fixtureFiles = new Map();
let seConfig = null, seExe = null, seRoot = null;
if (cases.some(name => configurations[name].accelerated)) {
  const requestedRoot = arg('se-fixture', '');
  if (requestedRoot) {
    seRoot = fs.realpathSync(path.resolve(requestedRoot));
    const files = [];
    const walk = directory => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
        const file = path.join(directory, entry.name);
        const rel = path.relative(seRoot, file).split(path.sep).join('/');
        if (rel.split('/')[0].toLowerCase() === '3dfx') continue;
        if (entry.isDirectory()) walk(file);
        else if (entry.isFile()) {
          const url = '/__nfs2se__/' + rel.split('/').map(encodeURIComponent).join('/');
          fixtureFiles.set(url, file);
          files.push({ url, vfsPath: 'c:\\' + rel.replaceAll('/', '\\') });
          if (rel.toLowerCase() === 'nfs2sea.exe') seExe = file;
        }
      }
    };
    walk(seRoot);
    assert(seExe, '--se-fixture must contain NFS2SEA.EXE');
    seConfig = { exe: files.find(item => item.vfsPath.toLowerCase() === 'c:\\nfs2sea.exe').url,
      files, requiredFiles: true, fileConcurrency: 10, startupRegistry: [] };
  } else {
    seConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'build/nfs2se-config.json'), 'utf8'));
    seExe = fs.realpathSync(path.resolve(ROOT, seConfig.exe));
    seRoot = path.dirname(seExe);
  }
  // The original game's decimal driver override selects
  // Glide directly; automatic probing otherwise prefers an unavailable SGL.
  seConfig.environment = { ...seConfig.environment, THRASH_DRIVER: '1' };
}

// Diagnostics run inside the actual guest Worker, never the host's shadow
// register instance. This response override is enabled only for --trace-api.
function installWorkerApiTrace(host, names, getInstance, memory) {
  const canonical = name => name.replace(/^_/, '').replace(/@[0-9]+$/, '');
  const selected = new Set(names.map(canonical));
  const log = host.log, exit = host.log_api_exit;
  const globals = ex => Object.fromEntries(
    [0x4d4fc8, 0x5553f8, 0x4d4978, 0x4d4930, 0x555a14, 0x560a04]
      .map(address => ['0x' + address.toString(16), ex.guest_read32(address) >>> 0]));
  let current = null;
  const guestString = (ex, ptr) => {
    if (!ptr || ptr < 65536) return null;
    let text = '';
    for (let i = 0; i < 384; i++) {
      const byte = ex.guest_read8((ptr + i) >>> 0);
      if (!byte) break;
      text += String.fromCharCode(byte);
    }
    return text;
  };
  host.log = (ptr, len) => {
    current = null;
    try {
      const bytes = new Uint8Array(memory.buffer, ptr >>> 0, Math.min(len >>> 0, 128));
      let name = '';
      for (const byte of bytes) { if (!byte) break; name += String.fromCharCode(byte); }
      if (selected.has(canonical(name))) {
        const ex = getInstance()?.exports;
        if (ex) {
          const esp = ex.get_esp() >>> 0;
          const args = Array.from({length: 8}, (_, i) => ex.guest_read32((esp + 4 + i * 4) >>> 0) >>> 0);
          const data = { name, esp, ret: ex.guest_read32(esp) >>> 0, args, globals: globals(ex) };
          const base = canonical(name);
          if (base === 'GetProcAddress') data.procName = guestString(ex, args[1]);
          if (/^(LoadLibraryA|LoadLibraryExA|CreateFileA)$/.test(base)) data.path = guestString(ex, args[0]);
          if (base === 'MessageBoxA') data.text = guestString(ex, args[1]);
          current = data;
          console.log('[nfs2-worker-api-enter] ' + JSON.stringify(data));
        }
      }
    } catch (error) { console.log('[nfs2-worker-trace-error] ' + String(error)); }
    return log(ptr, len);
  };
  host.log_api_exit = (...args) => {
    if (current) {
      try {
        const ex = getInstance().exports;
        console.log('[nfs2-worker-api-exit] ' + JSON.stringify({name:current.name,
          eax:ex.get_eax() >>> 0, esp:ex.get_esp() >>> 0, globals:globals(ex)}));
      } catch (_) { /* diagnostics must not trap guest */ }
      current = null;
    }
    return exit(...args);
  };
}
let tracedWorker = null;
if (traceApiNames.length) {
  const source = fs.readFileSync(path.join(ROOT, 'lib/guest-worker.js'), 'utf8');
  const anchor = '      const result = await WebAssembly.instantiate(msg.module, built.imports);';
  assert.equal(source.split(anchor).length, 2, 'worker trace injection anchor must be unique');
  tracedWorker = source.replace(anchor,
    '(' + installWorkerApiTrace.toString() + ')(built.imports.host,' + JSON.stringify(traceApiNames)
    + ',()=>instance,memory);\n' + anchor);
}

// Installed only in the benchmark page, before the original guest launches.
// GPU stream v2: wraps GpuStreamWebGL.Executor.prototype.execute(rec). Every
// executor keeps a "prelude" of the records that define its live resources
// (CREATE/SHADER/LAYOUT/SAMPLER and texture UPLOADs, minus RELEASEd ids and
// uploads a later full-level upload replaced) plus the last sticky TARGETS/
// RASTER/BIND/CONSTS. An armed capture starts at a PRESENT and ends at the
// next one; the frame is written as a self-contained GPSD dump (prelude,
// sticky state, frame records) that `node tools/gpu-stream.js replay
// capture-frame.gpsd --executor=webgl --png=OUT.png` reproduces.
function installFrameCapture() {
  const GS = GpuStream, OP = GS.OP, KIND = GS.KIND;
  const encode = bytes => {
    let text = '';
    for (let i = 0; i < bytes.length; i += 8192)
      text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(text);
  };
  // One record in GPSD dump framing (record bytes + its arena inputs).
  let chunk = null;
  const dump = new GS.DumpWriter(bytes => { chunk = bytes; });
  const dumpHeader = chunk;
  const recordBytes = rec => { dump.writeRecord(rec); return chunk.slice(); };
  const range = () => ({ finite: 0, nonfinite: 0, min: null, max: null });
  const add = (r, n) => {
    if (!Number.isFinite(n)) { r.nonfinite++; return; }
    r.finite++;
    r.min = r.min === null ? n : Math.min(r.min, n);
    r.max = r.max === null ? n : Math.max(r.max, n);
  };
  const PRELUDE_LIMIT = 64 * 1024 * 1024;
  const perExecutor = new WeakMap();
  const track = executor => {
    let t = perExecutor.get(executor);
    if (!t) perExecutor.set(executor, t = { defs: new Map(), uploads: new Map(), sticky: {}, kinds: new Map(), bytes: 0 });
    return t;
  };
  const dropUploads = (t, key) => {
    for (const u of t.uploads.get(key) || []) t.bytes -= u.bytes.length;
    t.uploads.delete(key);
  };
  let active = null, owner = null;
  window.__nfs2CaptureArm = false;
  window.__nfs2CapturedFrame = null;
  const original = GpuStreamWebGL.Executor.prototype.execute;
  GpuStreamWebGL.Executor.prototype.execute = function(rec) {
    const t = track(this), f = rec.fields;
    try {
      switch (rec.op) {
        case OP.CREATE: case OP.SHADER: case OP.LAYOUT: case OP.SAMPLER: {
          const bytes = recordBytes(rec);
          (t.defs.get(f.id) || t.defs.set(f.id, []).get(f.id)).push({ seq: rec.seq, bytes });
          if (rec.op === OP.CREATE) t.kinds.set(f.id, { kind: f.kind, width: f.width, height: f.height });
          t.bytes += bytes.length;
          break;
        }
        case OP.UPLOAD: {
          const k = t.kinds.get(f.id);
          if (!k || k.kind !== KIND.TEX2D) break; // RT (LFB) contents are not carried across frames
          const key = f.id + ':' + f.level;
          const lw = Math.max(1, k.width >> f.level), lh = Math.max(1, k.height >> f.level);
          if (f.x === 0 && f.y === 0 && f.w === lw && f.h === lh) dropUploads(t, key);
          const bytes = recordBytes(rec);
          (t.uploads.get(key) || t.uploads.set(key, []).get(key)).push({ seq: rec.seq, bytes });
          t.bytes += bytes.length;
          break;
        }
        case OP.RELEASE:
          for (const d of t.defs.get(f.id) || []) t.bytes -= d.bytes.length;
          t.defs.delete(f.id); t.kinds.delete(f.id);
          for (const key of [...t.uploads.keys()]) if (key.startsWith(f.id + ':')) dropUploads(t, key);
          break;
        case OP.TARGETS: case OP.RASTER: case OP.BIND: case OP.CONSTS:
          t.sticky[rec.op] = { seq: rec.seq, bytes: recordBytes(rec), fields: { ...f },
            bind: rec.op === OP.BIND ? GS.decodeBind(rec).map(e => ({ ...e })) : undefined };
          break;
      }
      if (t.bytes > PRELUDE_LIMIT) throw new Error('frame capture prelude exceeded 64 MiB');
      if (active && owner === this && rec.op !== OP.PRESENT) {
        const bytes = recordBytes(rec);
        active.byteLength += bytes.length;
        if (active.byteLength > 32 * 1024 * 1024 || active.records.length >= 100000)
          throw new Error('frame capture exceeded 32 MiB/100000-record bound');
        active.records.push(bytes);
        active.counts[rec.name] = (active.counts[rec.name] || 0) + 1;
        if (rec.op === OP.DRAW_UP) {
          const raster = t.sticky[OP.RASTER]?.fields || null, bind = t.sticky[OP.BIND]?.bind || [];
          const key = JSON.stringify([f.ps, raster, bind]);
          let item = active.drawStates.find(item => item.key === key);
          if (!item) active.drawStates.push(item = { key, ps: f.ps, raster, bind, draws: 0, vertices: 0, z: range(), oow: range() });
          const modeKey = (raster?.depth_mode ?? '?') + ':' + (raster?.fog_mode ?? '?');
          const mode = active.vertexSummary[modeKey] ||= { depthMode: raster?.depth_mode, fogMode: raster?.fog_mode, z: range(), oow: range() };
          item.draws++;
          const v = rec.arena(f.voff, f.count * f.stride), dv = new DataView(v.buffer, v.byteOffset, v.byteLength);
          for (let o = 0; o + 64 <= v.length; o += f.stride) {
            const z = dv.getFloat32(o + 8, true), oow = dv.getFloat32(o + 40, true); // POSITIONT.z, TEXCOORD0.z
            item.vertices++;
            add(item.z, z); add(item.oow, oow); add(mode.z, z); add(mode.oow, oow);
          }
        }
      }
    } catch (error) {
      window.__nfs2CaptureError = String(error);
      active = null; window.__nfs2CaptureArm = false;
    }
    const result = original.call(this, rec);
    if (rec.op !== OP.PRESENT) return result;
    if (active && owner === this) {
      active.records.push(recordBytes(rec));
      active.endPresent = this.stats().presents;
      active.completedAt = performance.now();
      const parts = [dumpHeader, ...active.prelude, ...active.records];
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let o = 0;
      for (const p of parts) { out.set(p, o); o += p.length; }
      active.gpsd = encode(out);
      active.gpsdBytes = out.length;
      active.preludeRecords = active.prelude.length;
      active.frameRecords = active.records.length;
      delete active.prelude; delete active.records;
      try {
        const surface = this.backend.getPresentationSurface();
        const w = f.w, h = f.h;
        active.width = w; active.height = h;
        active.drawablePng = surface.toDataURL('image/png');
        const context = surface.getContext('2d');
        if (context) {
          const y = Math.min(200, h), pixels = context.getImageData(0, y, w, h - y).data;
          let blue = 0;
          for (let p = 0; p < pixels.length; p += 4)
            if (Math.abs(pixels[p] - 74) <= 12 && Math.abs(pixels[p+1] - 164) <= 12 && Math.abs(pixels[p+2] - 207) <= 12) blue++;
          active.clearBluePixels = blue;
          active.bluePixelSelection = { rgb: [74, 164, 207], tolerance: 12, minY: y };
        }
      } catch (error) { active.drawableError = String(error); }
      for (const item of active.drawStates) delete item.key;
      window.__nfs2CapturedFrame = active;
      active = null;
      window.__nfs2CaptureArm = false;
    } else if (window.__nfs2CaptureArm && !active) {
      owner = this;
      // Prelude in original order: definitions, texture contents, sticky state.
      const prelude = [...[...t.defs.values()].flat(), ...[...t.uploads.values()].flat(),
        ...Object.values(t.sticky)].sort((a, b) => a.seq - b.seq).map(r => r.bytes);
      active = { schemaVersion: 2, format: 'gpsd', startPresent: this.stats().presents, startedAt: performance.now(),
        prelude, records: [], byteLength: 0, counts: {}, drawStates: [], vertexSummary: {},
        note: 'GPSD dump: live resource definitions, texture uploads and sticky state, then one frame of records ending with its PRESENT. Prior render-target (color/LFB) and depth contents are not serialized.' };
    }
    return result;
  };
}

async function observe(page) {
  return page.evaluate(metricsEnabled => {
    const wine = runningApps.find(app => app.name === window.__nfs2App)?.wine;
    const ex = wine?.instance?.exports;
    // GPU stream v2: local route = the bridge's executor (maybe a dump tee);
    // Worker route = the counters the render Worker replies with.
    const bridge = wine?.hostCtx?.glideBridge;
    const executor = bridge?.executor && (bridge.executor.inner || bridge.executor);
    const glideStats = executor?.stats ? executor.stats() : bridge?.device?.stats || null;
    const glide = { stats: glideStats, glRenderer: bridge?.device?.glRenderer || null };
    const gl = executor?.gl;
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const draw = wine?.guestWorker?.d3dStats;
    const renderer = wine?.renderer;
    const wins = Object.values(renderer?.windows || {}).filter(w => w.visible && !w.isChild);
    const win = wins[wins.length - 1];
    const surface = win?._dxFrameLayer?.canvas || win?._backCanvas;
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
      flips: window.__nfsBenchFlips, primaryPresents: window.__nfsBenchPrimaryPresents,
      swaps: glideStats?.presents ?? bridge?.stats?.presents,
      glide: glideStats, d3d: draw, glideLfb,
      glideEndpoint: bridge?.endpoint?.options || null,
      glideRoute: bridge ? { route: bridge.endpoint ? 'worker' : bridge.executor ? 'local' : 'closed',
        backend: bridge.options?.backend || null,
        executor: executor ? (window.GpuStreamWebGL && executor instanceof GpuStreamWebGL.Executor ? 'webgl'
          : window.GpuStreamSoftware && executor instanceof GpuStreamSoftware.Executor ? 'software' : 'other') : null } : null,
      glRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : glide?.glRenderer || null,
      surface: surface ? { width: surface.width, height: surface.height } : null,
      display: ex ? { width: ex.get_display_mode_w?.(), height: ex.get_display_mode_h?.() } : null,
      seGlobals: window.__nfs2App === 'nfs2se_demo' && ex ? Object.fromEntries(
        [0x4d4fc8, 0x5553f8, 0x4d4978, 0x4d4930, 0x555a14, 0x560a04]
          .map(address => ['0x' + address.toString(16), ex.guest_read32(address) >>> 0])) : null,
      perf: window.WinePerf?.snapshot(),
      // {"slot:name": count}; empty unless the page was loaded with ?rpc-census.
      rpcCalls: Object.fromEntries((wine?.guestWorker?.broker?.stats?.().calls || [])
        .map(c => [c.slot + ':' + c.name, c.count])),
      // Page-scheduled guest-thread slices: each one is a postMessage round
      // trip between the page and that thread's Worker.
      threadSlices: location.search.includes('rpc-census') ? Object.fromEntries([...(wine?.threadManager?.threads?.values?.() || [])]
        .filter(t => t.link).map(t => ['T' + t.tid + '@' + (t.link.slot ?? '?'), {
          slices: t.workerSlices | 0, ms: t.workerSliceMs || 0,
          ends: { ...(t.link.sliceStats?.ends || {}) }, eip: (t.lastEip >>> 0).toString(16) }])) : null,
    };
  }, glideLfbMetrics);
}

// Either the render-Worker endpoint, or the page-local executor, must be the
// requested backend (a WebGL request that fell back to software fails).
function assertGlideBackend(state, expected) {
  if (state.glideEndpoint) {
    assert(state.glideEndpoint.api === 'glide' && state.glideEndpoint.backend === expected,
      `requested Glide ${expected}, actual endpoint ${JSON.stringify(state.glideEndpoint)}`);
    return;
  }
  const route = state.glideRoute;
  assert(route?.route === 'local' && route.backend === expected
    && (expected === 'webgl') === (route.executor === 'webgl'),
    `requested Glide ${expected}, actual route ${JSON.stringify(route)}`);
}

// The page session sees only the page thread; with ?threads the guest's main
// thread and every guest thread are Workers, each profiled on its own session.
async function startCpuProfiles(page) {
  const targets = [];
  const start = async (label, session) => {
    try {
      await session.send('Profiler.enable');
      await session.send('Profiler.setSamplingInterval', { interval: 200 });
      await session.send('Profiler.start');
      targets.push({ label, session });
    } catch (e) { console.log(`cpu-profile: could not start on ${label}: ${e.message}`); }
  };
  await start('page', await page.target().createCDPSession());
  for (const w of page.workers()) {
    if (w.client) await start(`worker ${w.url().replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '')}`, w.client);
  }
  return targets;
}

async function stopCpuProfiles(targets, prefix, seconds) {
  const threads = [];
  for (const [n, t] of targets.entries()) {
    let profile;
    try { ({ profile } = await t.session.send('Profiler.stop')); }
    catch (e) { console.log(`cpu-profile: ${t.label} ended before the sample did (${e.message})`); continue; }
    fs.writeFileSync(`${prefix}-${n}-${t.label.replace(/[^\w.-]+/g, '_')}.cpuprofile`, JSON.stringify(profile));
    threads.push({ label: t.label, ...summarizeProfile(profile, cpuProfileTop) });
  }
  printProfiles(threads, seconds);
  return threads;
}

async function runCase(server, name) {
  const config = configurations[name];
  const dir = path.join(output, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'console.log'), '');
  let browser, page;
  const errors = [], dlls = new Set();
  const report = { name, config, softwareGpu, samples: [], loadAtLaunch: os.loadavg() };
  try {
    browser = await puppeteer.launch({ executablePath: chrome, headless: false,
      protocolTimeout: 600000, args: ['--no-first-run', '--no-default-browser-check',
        '--window-size=900,700', '--autoplay-policy=no-user-gesture-required',
        ...(process.argv.includes('--no-sandbox') ? ['--no-sandbox'] : []),
        ...(softwareGpu ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])] });
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
      if (/\[nfs-bench-gpu\]/.test(line)) report.activeGpuRenderer = line;
      if (/worker thread \d+ trapped|UNIMPLEMENTED API:|host import .* threw|\[launchApp\] failed:|FATAL:/.test(line)) errors.push(line);
    });
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${server.address().port}/?threads&perf${rpcCensus ? '&rpc-census' : ''}&d3d-renderer=${config.accelerated ? config.glide : 'software'}`,
      { waitUntil: 'networkidle2', timeout: 90000 });
    await page.bringToFront();
    if (captureFrame) {
      assert(config.accelerated && config.glide === 'webgl', '--capture-frame requires seglide WebGL');
      await page.evaluate(installFrameCapture);
    }
    await page.evaluate(async config => {
      if (config.traceApiNames.length) window.__waTraceApiNames = new Set(config.traceApiNames);
      window.__nfsBenchFlips = 0;
      window.__nfsBenchPrimaryPresents = 0;
      const getImports = WineAssembly.prototype.getImports;
      WineAssembly.prototype.getImports = function(...args) {
        const result = getImports.apply(this, args), trace = result.host.dx_trace;
        result.host.dx_trace = function(kind, ...rest) {
          if (kind === 6) window.__nfsBenchFlips++;
          if (kind === 5) window.__nfsBenchPrimaryPresents++;
          return trace.call(this, kind, ...rest);
        };
        return result;
      };
      await setThreads(true);
      if (config.app === 'nfs2se_demo') {
        window.wineApps.APPS.nfs2se_demo = config.runtimeApp;
        const option = document.createElement('option');
        option.value = config.app; option.textContent = 'NFS II SE 3Dfx demo';
        document.getElementById('app-select').appendChild(option);
      }
      window.__nfs2App = config.app;
      document.getElementById('app-select').value = config.app;
      await launchApp();
      window.__nfsBenchLaunched = performance.now();
    }, { ...config, runtimeApp: seConfig, traceApiNames });
    const waitFrames = async (minimum, timeout = 600000) => {
      const started = Date.now();
      let lastCheckpoint = 0;
      while (true) {
        const state = await observe(page);
        if (errors.length) throw new Error(errors[0]);
        if (Date.now() - lastCheckpoint >= 15000) {
          await page.screenshot({ path: path.join(dir, 'loading.png') });
          fs.writeFileSync(path.join(dir, 'progress.json'), JSON.stringify(state, null, 2));
          console.log(name, 'loading', JSON.stringify({ flips: state.flips, primaryPresents: state.primaryPresents, swaps: state.swaps }));
          lastCheckpoint = Date.now();
        }
        if (!state.running && Date.now() - started > 15000)
          throw new Error('guest stopped before frame readiness; inspect loading.png and console.log');
        const count = config.accelerated ? state.swaps || 0 : Math.max(state.flips || 0, state.primaryPresents || 0);
        if (count >= minimum) return state;
        assert(Date.now() - started < timeout, 'guest frame readiness timed out');
        await sleep(1000);
      }
    };
    await waitFrames(config.accelerated ? 20 : 3);
    if (!config.accelerated) await sleep(menuWait * 1000);
    report.menu = await observe(page);
    report.glideLfbMetrics = glideLfbMetrics;
    if (config.accelerated) assertGlideBackend(report.menu, config.glide);
    await page.screenshot({ path: path.join(dir, 'menu.png') });
    console.log(name, 'checkpoint', path.join(dir, 'menu.png'));
    if (stage === 'menu') { report.checkpoint = 'menu'; return report; }
    if (continueFile) {
      console.log('Inspect menu.png, then create', continueFile);
      const start = Date.now();
      while (!fs.existsSync(continueFile)) {
        assert(Date.now() - start < 600000, 'menu approval file timed out');
        if (errors.length) throw new Error(errors[0]);
        await sleep(1000);
      }
    }
    if (!config.accelerated) {
      assert(menuClick.length === 2 && menuClick.every(Number.isFinite));
      // Verified original demo menu RACE item; coordinates are guest-local.
      for (const which of ['move', 'down', 'up']) {
        await page.evaluate(({ x, y, which }) => {
          const renderer = sharedRenderer, t = renderer._exclusiveTransform;
          const cx = t?.srcW ? Math.round((t.dstX || 0) + (x - (t.srcX || 0)) * t.dstW / t.srcW) : x;
          const cy = t?.srcH ? Math.round((t.dstY || 0) + (y - (t.srcY || 0)) * t.dstH / t.srcH) : y;
          if (which === 'move') renderer.handleMouseMove(cx, cy);
          else if (which === 'down') renderer.handleMouseDown(cx, cy, 1);
          else renderer.handleMouseUp(cx, cy, 1);
        }, { x: menuClick[0], y: menuClick[1], which });
        await sleep(300);
      }
      await sleep(5000);
      await page.keyboard.press('Enter');
    }
    await sleep(raceWait * 1000);
    report.ready = await observe(page);
    assert.equal(report.ready.backend, 'worker');
    assert(report.ready.running && !report.ready.hidden, 'visible live guest required');
    if (config.accelerated) {
      assertGlideBackend(report.ready, config.glide);
      assert.equal(report.ready.seGlobals['0x4d4fc8'], 1, 'original game must select Glide');
      assert(report.ready.glide?.triangles > 0, 'race geometry required');
      if (config.glide === 'webgl') assert(report.ready.glRenderer &&
        (softwareGpu || !/swiftshader|llvmpipe|software|unknown/i.test(report.ready.glRenderer)),
        'hardware WebGL required unless --swiftshader is explicit');
    }
    await page.screenshot({ path: path.join(dir, 'ready.png') });
    console.log(name, 'race checkpoint', path.join(dir, 'ready.png'));
    if (captureFrame) {
      const started = Date.now();
      let frame = null, tried = 0;
      const maximum = captureMinBlue > 0 ? 30 : 1;
      while (tried < maximum && Date.now() - started < 60000) {
        await page.evaluate(() => { window.__nfs2CapturedFrame = null; window.__nfs2CaptureArm = true; });
        let complete = false;
        while (Date.now() - started < 60000) {
          const status = await page.evaluate(() => ({done:!!window.__nfs2CapturedFrame, error:window.__nfs2CaptureError}));
          if (status.error) throw new Error(status.error);
          if (status.done) { complete = true; break; }
          if (errors.length) throw new Error(errors[0]);
          await sleep(100);
        }
        if (!complete) break;
        const candidate = await page.evaluate(() => window.__nfs2CapturedFrame);
        tried++;
        if (!frame || (candidate.clearBluePixels || 0) > (frame.clearBluePixels || 0)) frame = candidate;
        console.log(name, 'capture candidate', tried, 'blue pixels', candidate.clearBluePixels);
        if ((frame.clearBluePixels || 0) >= captureMinBlue) break;
      }
      await page.evaluate(() => { window.__nfs2CaptureArm = false; });
      assert(frame, 'single-frame capture timed out after 60 seconds');
      frame.selection = {tried, minimumBluePixels:captureMinBlue,
        satisfied:(frame.clearBluePixels || 0) >= captureMinBlue, boundedSeconds:60, maximumFrames:maximum};
      if (frame.drawablePng) {
        fs.writeFileSync(path.join(dir, 'capture-drawable.png'), Buffer.from(frame.drawablePng.split(',')[1], 'base64'));
        delete frame.drawablePng;
      }
      if (frame.gpsd) {
        // Replay: node tools/gpu-stream.js replay capture-frame.gpsd --executor=webgl --png=OUT.png
        fs.writeFileSync(path.join(dir, 'capture-frame.gpsd'), Buffer.from(frame.gpsd, 'base64'));
        delete frame.gpsd;
      }
      fs.writeFileSync(path.join(dir, 'capture-frame.json'), JSON.stringify(frame));
      await page.screenshot({path:path.join(dir, 'capture-page.png')});
      report.capture = {path:'capture-frame.json', commands:frame.commands.length,
        byteLength:frame.byteLength, vertexSummary:frame.vertexSummary, clearBluePixels:frame.clearBluePixels, selection:frame.selection};
      console.log(name, 'frame capture', JSON.stringify(report.capture));
      assert(frame.selection.satisfied, 'blue threshold not reached within 30 frames/60 seconds; highest-blue frame retained');
    }
    if (stage === 'race') { report.checkpoint = 'race'; return report; }
    // Visual review of ready.png is required when reporting a race benchmark:
    // counters alone cannot distinguish a rendered menu from active gameplay.
    report.raceVisualReviewRequired = true;
    if (accelerate) await page.keyboard.down('ArrowUp');
    await sleep(10000);
    for (let i = 0; i < samples; i++) {
      await page.bringToFront();
      await page.screenshot({ path: path.join(dir, `sample-${i + 1}-before.png`) });
      const profiling = cpuProfile ? await startCpuProfiles(page) : null;
      const loadBefore = os.loadavg(), cpuBefore = await cpu(), before = await observe(page);
      await sleep(seconds * 1000);
      const after = await observe(page), cpuAfter = await cpu(), loadAfter = os.loadavg();
      if (profiling) {
        const profileSummary = await stopCpuProfiles(profiling, path.join(dir, `sample-${i + 1}-cpu`), seconds);
        report.cpuProfiles = report.cpuProfiles || [];
        report.cpuProfiles.push(profileSummary);
      }
      if (config.accelerated) {
        assertGlideBackend(before, config.glide); assertGlideBackend(after, config.glide);
      }
      assert(before.running && after.running && !before.hidden && !after.hidden, 'visible live game required');
      if (errors.length) throw new Error(errors[0]);
      assert.equal(after.glide?.errors || after.d3d?.errors || 0, 0);
      const flipDelta = after.flips - before.flips;
      const primaryDelta = after.primaryPresents - before.primaryPresents;
      const counterLabel = config.accelerated ? 'Glide buffer swaps'
        : flipDelta > 0 ? 'DirectDraw Flip (dx_trace kind 6)'
        : 'DirectDraw primary presents (dx_trace kind 5)';
      const frames = config.accelerated ? after.swaps - before.swaps
        : flipDelta > 0 ? flipDelta : primaryDelta;
      const wallSeconds = (after.at - before.at) / 1000;
      const cpuByType = {};
      for (const p of cpuAfter) {
        const old = cpuBefore.find(q => q.id === p.id);
        if (old) cpuByType[p.type] = (cpuByType[p.type] || 0) + p.cpuTime - old.cpuTime;
      }
      const cpuSeconds = Object.values(cpuByType).reduce((a,b) => a+b,0);
      assert(frames > 0, 'no guest frame swaps in sample');
      const result = { frames, counterLabel, flipDelta, primaryDelta, wallSeconds, fps: frames / wallSeconds,
        cpuSeconds, cpuMsPerFrame: 1000 * cpuSeconds / frames, cpuByType,
        loadBefore, loadAfter, contended: Math.max(loadBefore[0], loadAfter[0]) > 4,
        before, after };
      if (rpcCensus) {
        result.rpcPerFrame = Object.entries(after.rpcCalls || {})
          .map(([k, n]) => [k, (n - (before.rpcCalls?.[k] || 0)) / frames])
          .filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
        console.log(name, `sample${i+1} rpc round trips per frame (slot:import):`);
        for (const [k, n] of result.rpcPerFrame.slice(0, 20)) console.log(`    ${n.toFixed(1).padStart(8)}  ${k}`);
        console.log(name, `sample${i+1} page-scheduled thread slices per frame (guest ms per slice, slice end reasons):`);
        for (const [k, t] of Object.entries(after.threadSlices || {})) {
          const b = before.threadSlices?.[k] || { slices: 0, ms: 0, ends: {} };
          const n = t.slices - b.slices;
          const ends = Object.entries(t.ends).map(([why, c]) => [why, c - (b.ends[why] || 0)])
            .filter(([, c]) => c > 0).map(([why, c]) => `${why}:${(c / frames).toFixed(1)}`).join(' ');
          console.log(`    ${(n / frames).toFixed(1).padStart(8)}  ${k}  ${n ? ((t.ms - b.ms) / n).toFixed(2) : '-'}ms  eip=${t.eip}  ${ends}`);
        }
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
    allowedRealRoots: [fixtureRoot, seRoot, fs.realpathSync(path.join(ROOT, 'fonts'))].filter(Boolean),
    handleRequest(req, res) {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (tracedWorker && pathname === '/lib/guest-worker.js') {
        res.writeHead(200, {'Content-Type':'application/javascript', 'Cache-Control':'no-store',
          'Cross-Origin-Resource-Policy':'same-origin', 'Cross-Origin-Embedder-Policy':'require-corp'});
        res.end(tracedWorker);
        return true;
      }
      const file = fixtureFiles.get(pathname);
      if (!file) return false;
      res.writeHead(200, { 'Content-Type': 'application/octet-stream',
        'Content-Length': fs.statSync(file).size, 'Cross-Origin-Resource-Policy': 'same-origin' });
      fs.createReadStream(file).pipe(res);
      return true;
    } });
  const meta = { startedAt: new Date().toISOString(), commit: execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),
    wasmSha256: hash(path.join(ROOT,'build/wine-assembly.wasm')), headful:true, stage, seconds, samples, accelerate, traceApiNames, captureFrame, captureMinBlue,
    comparisonCaveat: "Original software versus SE Glide uses different editions and supplied tracks (TR03 versus TR04); this is not a renderer-only or same-scene A/B.",
    machine: { platform:os.platform(), arch:os.arch(), cpus:os.cpus().length, model:os.cpus()[0].model },
    fixtureSha256: { original: cases.includes('originalsoftware')
      ? hash(path.join(ROOT,'test/binaries/candidates/need-for-speed-2-demo/game/nfsw.exe')) : null,
      se: seExe ? hash(seExe) : null },
    results: [] };
  try {
    for (const name of cases) {
      meta.results.push(await runCase(server,name));
      fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(meta,null,2));
    }
  } finally { await closeServer(server); }
  if (meta.results.some(r => r.failure)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
