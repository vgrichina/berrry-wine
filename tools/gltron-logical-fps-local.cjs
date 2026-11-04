'use strict';
// Run-specific local diagnostic. External flock serializes the entire pair.
// node tools/gltron-logical-fps-local.cjs --prepare RUN
// flock -n /tmp/wine-local-runtime.lock node tools/gltron-logical-fps-local.cjs --run RUN
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { BOUNDARY, sha256, audit, probeCompiled, installPageCounter, summarizeCounterWindow } = require('./gltron-logical-fps.cjs');
const ROOT = path.resolve(__dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const HARD_BROWSER_END = Date.parse('2026-11-04T21:15:00Z');
const HARD_CLEANUP_END = Date.parse('2026-11-04T21:18:00Z');
const requiredShellPaths = () => ['manifest.webmanifest',
  ...require('../lib/font-substitutions').BUNDLED_BITMAP_FONTS.map(file => 'fonts/' + file),
  ...require('../lib/process-boot').SYSTEM_DATA_FILES.map(file => file.url),
  'test/' + require('../lib/dll-registry').DLL_PATHS['msvcrt.dll']];

function validateShellPins(pins) {
  for (const file of requiredShellPaths()) {
    const b = fs.readFileSync(path.join(ROOT, file));
    if (!pins.some(p => p.path === file && p.bytes === b.length && p.sha256 === sha256(b)))
      throw Error('required shell pin missing or stale: ' + file);
  }
}

function prepare(run) {
  fs.mkdirSync(run, { recursive: true });
  const offline = audit(ROOT);
  write(path.join(run, 'offline-audit.json'), offline);
  const files = new Set(git('ls-files', '-z', '--', 'src', 'lib', 'host.js', 'index.html',
    'style.css', 'build', 'fonts', 'manifest.webmanifest', 'test/static-server.js').split('\0').filter(Boolean));
  for (const file of ['build/wine-assembly.wasm', 'build/wine-assembly.compat.wasm']) files.add(file);
  for (const file of requiredShellPaths()) files.add(file);
  for (const file of ['tools/gltron-logical-fps.cjs', 'tools/gltron-logical-fps-local.cjs', 'test/test-gltron-logical-fps.js']) files.add(file);
  for (const file of offline.media) files.add(file.path);
  // These existing files are fetched by the normal shell / DLL loader.
  for (const file of git('ls-files', '-z', '--', '*.js', '*.css', '*.json', '*.png', '*.svg', '*.ico', '*.woff2', '*.dll').split('\0').filter(Boolean)) files.add(file);
  if (fs.existsSync(path.join(ROOT, 'lib/wininit-boot.js'))) files.add('lib/wininit-boot.js');
  const pins = [...files].filter(p => fs.existsSync(path.join(ROOT, p)) && fs.statSync(path.join(ROOT, p)).isFile())
    .map(p => { const b = fs.readFileSync(path.join(ROOT, p)); return { path: p, bytes: b.length, sha256: sha256(b) }; });
  validateShellPins(pins);
  const relevant = ['host.js', 'index.html', 'lib', 'src', 'test/static-server.js',
    'tools/gltron-logical-fps.cjs', 'tools/gltron-logical-fps-local.cjs', 'test/test-gltron-logical-fps.js'];
  fs.writeFileSync(path.join(run, 'relevant-source.patch'), execFileSync('git', ['diff', 'HEAD', '--binary', '--', ...relevant], { cwd: ROOT }));
  const untracked = git('ls-files', '--others', '--exclude-standard', '-z', '--', ...relevant).split('\0').filter(Boolean);
  for (const file of untracked) {
    let patch;
    try { patch = execFileSync('git', ['diff', '--no-index', '--binary', '/dev/null', file], { cwd: ROOT }); }
    catch (error) { if (error.status !== 1) throw error; patch = error.stdout; }
    fs.writeFileSync(path.join(run, 'new-' + file.replaceAll('/', '_') + '.patch'), patch);
  }
  const record = { commit: git('rev-parse', 'HEAD'), at: new Date().toISOString(), branch: git('branch', '--show-current'),
    pins, untracked, patchSha256: sha256(fs.readFileSync(path.join(run, 'relevant-source.patch'))) };
  if (record.branch !== 'main') throw Error('main required');
  write(path.join(run, 'runtime-pins.json'), record);
  return record;
}

// Observe module/instance generations before launch. Retain references and
// hashes, not repeated module copies. No per-draw instrumentation is installed.
function preload() {
  const obs = window.__gltronModuleObservation = { instances: [], modules: [], inputs: [], contexts: [] };
  const hash = async b => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)), x => x.toString(16).padStart(2, '0')).join('');
  const seen = new WeakMap(), compile = WebAssembly.compile, instantiate = WebAssembly.instantiate;
  WebAssembly.compile = async function(bytes, ...args) {
    const module = await compile.call(this, bytes, ...args), sha256 = await hash(bytes);
    seen.set(module, sha256); obs.modules.push({ sha256, bytes: bytes.byteLength }); return module;
  };
  WebAssembly.instantiate = async function(module, ...args) {
    const sha256 = module instanceof WebAssembly.Module ? seen.get(module) : await hash(module);
    const result = await instantiate.call(this, module, ...args), instance = result.instance || result;
    obs.instances.push({ instance, sha256, generation: obs.instances.length + 1 }); return result;
  };
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const ctx = get.call(this, type, ...args);
    if (ctx && /^webgl2?$|^experimental-webgl$/.test(type) && !obs.contexts.some(r => r.ctx === ctx)) {
      const ext = ctx.getExtension('WEBGL_debug_renderer_info');
      obs.contexts.push({ ctx, type, version: ctx.getParameter(ctx.VERSION), renderer: ctx.getParameter(ctx.RENDERER),
        vendor: ctx.getParameter(ctx.VENDOR), unmaskedRenderer: ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null });
    }
    return ctx;
  };
  for (const type of ['keydown', 'keyup']) addEventListener(type, e => obs.inputs.push({
    type, key: e.key, target: e.target?.id, trusted: e.isTrusted, atMs: performance.now() }), true);
}

function pageState() {
  const w = window.wine, e = w?.instance?.exports, obs = window.__gltronModuleObservation;
  const bridge = window.__gltronBridge, local = bridge?.local;
  const read = va => e ? e.guest_read32(va) >>> 0 : null;
  return { at: new Date().toISOString(), atMs: performance.now(), visibility: document.visibilityState,
    running: w?.running, stopped: w?._stopped, guestWorker: !!w?.guestWorker,
    backend: w?.threadManager?.backend, frozen: window.WineFrozen?.status(),
    modules: obs?.modules, instances: obs?.instances.map(r => ({ sha256: r.sha256, generation: r.generation,
      owningMain: r.instance === w?.instance, threadId: r.instance.exports.get_current_thread_id?.() })),
    inputs: obs?.inputs, contexts: obs?.contexts.map(({ ctx, ...r }) => r),
    renderer: { bridge: bridge?.constructor.name, local: local?.constructor.name, workerEndpoint: !!bridge?.endpoint,
      matchesOwner: bridge?.options?.exports?.() === e, backend: local?._webglBackend?.constructor.name,
      contexts: local ? [...local.contexts].map(([id, c]) => ({ id, hwnd: c.hwnd, software: c.software,
        frontend: c.frontend?.constructor.name, backend: c.frontend?.backend?.constructor.name })) : [] },
    software: e ? Object.fromEntries(['enabled', 'triangles', 'lines', 'presents'].map(k => [k, e['gl_sw_' + k]?.()])) : null,
    threadId: e?.get_current_thread_id(), callbacks: read(0x42b230), game2: read(0x43d284),
    marker: e?.get_logical_frame_addr(), count: e?.get_logical_frame_count() >>> 0,
    chain: e?.get_block_chain(), uop: e?.get_uop(), tierGuard: e?.get_dbg_tier_guard(),
    log: document.querySelector('#log')?.textContent?.slice(-5000) };
}

function requireReleases(board) {
  const mdk = board.split('\n').findLast(line => line.includes('mdk2-poll-repair LOCAL HEAVY RELEASE'));
  const stronghold = board.split('\n').findLast(line => line.includes('stronghold-current-hover LOCAL HEAVY RELEASE'));
  if (!mdk || !stronghold) throw Error('requires explicit MDKpollhistory AND stronghold-current-hover releases');
  return { mdk, stronghold };
}

// Chrome-only direct protocol request; observe the owned child, without the
// Puppeteer fallback that can signal a process group after a protocol error.
async function normalClose(browser, record, timeoutMs = 60000) {
  const child = browser.process();
  if (!child || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 180000) throw Error('owned Chrome and finite cleanup bound required');
  let timer, listener;
  const exit = new Promise((resolve, reject) => {
    listener = (code, signal) => resolve({ pid: child.pid, code, signal });
    if (child.exitCode !== null || child.signalCode !== null) listener(child.exitCode, child.signalCode);
    else child.once('exit', listener);
    timer = setTimeout(() => reject(Error('normal Chrome exit deadline; closure unproved')), timeoutMs);
  });
  try {
    record({ event: 'normal-close-request', pid: child.pid });
    const request = (async () => { const session = await browser.target().createCDPSession(); await session.send('Browser.close'); })();
    request.catch(error => record({ event: 'close-protocol-result', error: String(error) }));
    const result = await exit; record({ event: 'actual-owned-exit', ...result });
    if (result.code !== 0 || result.signal !== null) throw Error('abnormal Chrome exit');
    return result;
  } finally { clearTimeout(timer); child.removeListener('exit', listener); browser.disconnect(); }
}

async function runPair(run, webglOnly = false) {
  const releases = requireReleases(fs.readFileSync(path.join(ROOT, 'messageboard.txt'), 'utf8'));
  const pins = JSON.parse(fs.readFileSync(path.join(run, webglOnly ? 'webgl-preflight/runtime-pins.json' : 'runtime-pins.json')));
  validateShellPins(pins.pins);
  for (const pin of pins.pins) if (sha256(fs.readFileSync(path.join(ROOT, pin.path))) !== pin.sha256) throw Error('pin changed: ' + pin.path);
  if (Date.now() + 360000 > HARD_CLEANUP_END || Date.now() + 180000 > HARD_BROWSER_END) throw Error('full reserve unavailable');
  write(path.join(run, 'resource-releases.json'), releases);
  for (const module of ['build/wine-assembly.wasm', 'build/wine-assembly.compat.wasm']) {
    write(path.join(run, (webglOnly ? 'webgl-' : '') + 'preflight-' + path.basename(module) + '.json'), await probeCompiled(module));
  }
  let browserMs = 0, stopped = false;
  if (webglOnly) {
    const prior = JSON.parse(fs.readFileSync(path.join(run, 'software/cleanup.json')));
    if (prior.exitCode !== 0 || prior.signal !== null || !Number.isFinite(prior.cumulativeBrowserMs)) throw Error('prior normal closure and cumulative time required');
    browserMs = prior.cumulativeBrowserMs;
  }
  const puppeteer = require('puppeteer');
  for (const backend of webglOnly ? ['webgl'] : ['software', 'webgl']) {
    if (stopped) break;
    const out = path.join(run, backend);
    if (fs.existsSync(out)) throw Error('single launch arm already exists');
    fs.mkdirSync(out); fs.mkdirSync(path.join(out, 'commands'));
    const save = (name, value) => write(path.join(out, name + '.json'), value);
    const log = (name, value) => fs.appendFileSync(path.join(out, name + '.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n');
    let browser, page, server, chromeStarted, timer, closed = false, failure = null, number = 0, closingPromise;
    const held = new Set();
    function close(reason) {
      if (closingPromise) return closingPromise;
      closed = true; clearTimeout(timer);
      closingPromise = (async () => {
      for (const key of held) await page?.keyboard.up(key).catch(() => {});
      const child = browser?.process();
      const port = server?.address();
      try { if (browser) await normalClose(browser, row => log('lifecycle', row)); }
      finally {
        if (chromeStarted) browserMs += Date.now() - chromeStarted;
        if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      save('cleanup', { reason, chromePid: child?.pid, exitCode: child?.exitCode, signal: child?.signalCode,
        cumulativeBrowserMs: browserMs, nodePid: process.pid, port, boxId: null, boxState: null, boxExpiry: null });
      }
      })();
      return closingPromise;
    }
    try {
      server = await require('../test/static-server.js').startStaticServer({ root: ROOT, port: 0, crossOriginIsolated: true,
        rewritePath: p => p.startsWith('/binaries/') ? '/test' + p : p,
        headers: (req, resolved) => {
          const relative = path.relative(ROOT, resolved.file), b = fs.readFileSync(resolved.file), actual = sha256(b);
          const pin = pins.pins.find(p => p.path === relative);
          log('served', { url: req.url, path: relative, sha256: actual, bytes: b.length, match: pin?.sha256 === actual });
          if (!pin || pin.sha256 !== actual) { failure ||= 'unsealed HTTP file ' + relative; throw Error(failure); }
          return {};
        } });
      chromeStarted = Date.now();
      const remainingMs = Math.min(180000 - browserMs, HARD_BROWSER_END - chromeStarted);
      if (remainingMs < 30000) throw Error('insufficient remaining browser budget');
      browser = await puppeteer.launch({ headless: false, executablePath: '/usr/bin/google-chrome',
        userDataDir: path.join(out, 'chrome-profile'), protocolTimeout: 15000, timeout: 20000,
        args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--disable-background-networking'] });
      const child = browser.process();
      child.on('exit', (code, signal) => log('lifecycle', { event: 'chrome-exit', pid: child.pid, code, signal }));
      browser.on('disconnected', () => log('lifecycle', { event: 'browser-disconnected' }));
      save('launch', { backend, chromePid: child.pid, nodePid: process.pid, chromeStarted,
        browserVersion: await browser.version(), argv: child.spawnargs, remainingMs, pinsCommit: pins.commit,
        browserEnd: new Date(Math.min(chromeStarted + remainingMs, HARD_BROWSER_END)).toISOString(),
        cleanupEnd: new Date(Math.min(chromeStarted + remainingMs + 180000, HARD_CLEANUP_END)).toISOString() });
      timer = setTimeout(() => { stopped = true; close('cumulative browser deadline').catch(error => log('cleanup-error', { error: String(error) })); }, remainingMs - (Date.now() - chromeStarted));
      page = await browser.newPage(); await page.setViewport({ width: 1200, height: 900 });
      await page.setCacheEnabled(false); await page.evaluateOnNewDocument(preload);
      page.on('console', m => log('console', { type: m.type(), text: m.text().slice(0, 12000) }));
      page.on('pageerror', error => { failure ||= String(error); log('pageerror', { error: String(error) }); });
      const url = 'http://127.0.0.1:' + server.address().port + '/index.html?debug&candidates&gl-renderer=' + backend;
      save('url', { url }); await page.goto(url, { waitUntil: 'load', timeout: 20000 });
      await page.waitForFunction(() => typeof launchApp === 'function' && apps.gltron, { timeout: 10000 });
      await page.evaluate(() => {
        window.WINE_THREADS = false;
        const proto = GLRenderHost.Bridge.prototype, replay = proto.replay;
        proto.replay = function(...args) { window.__gltronBridge = this; proto.replay = replay; return replay.apply(this, args); };
        const select = document.querySelector('#app-select');
        if (![...select.options].some(o => o.value === 'gltron')) select.add(new Option('GLTron', 'gltron'));
      });
      await page.select('#app-select', 'gltron');
      await page.click('button[onclick="launchApp()"]');
      await page.waitForFunction(() => window.wine?.running, { timeout: 30000 });
      save('ready', await page.evaluate(pageState));
      console.log('READY ' + backend + ' ' + out);
      while (!closed && !failure) {
        const file = path.join(out, 'commands', number + '.json');
        if (!fs.existsSync(file)) { await pause(100); continue; }
        const i = number++, c = JSON.parse(fs.readFileSync(file));
        log('commands', { i, ...c });
        try {
          if (c.action === 'shot') {
            if (!/^[a-z0-9-]+$/.test(c.name) || fs.existsSync(path.join(out, c.name + '.png'))) throw Error('fresh capture required');
            await page.screenshot({ path: path.join(out, c.name + '.png') }); save(c.name, await page.evaluate(pageState));
          } else if (c.action === 'key') {
            if (!['Enter', 'Escape', 'a', 's'].includes(c.key) || !c.review || !fs.existsSync(path.join(out, c.review + '.png'))) throw Error('reviewed original route required');
            await page.keyboard.down(c.key); held.add(c.key); await pause(100);
            await page.keyboard.up(c.key); held.delete(c.key);
          } else if (c.action === 'measure') {
            if (!c.review || !fs.existsSync(path.join(out, c.review + '.png'))) throw Error('gameplay review required');
            const token = backend + '-' + Date.now();
            const armed = await page.evaluate(installPageCounter, BOUNDARY, token); save('armed', armed);
            await pause(5500);
            const raw = await page.evaluate(() => window.__gltronCounter.finish()); save('raw-counter-window', raw);
            if (raw.invalid) throw Error(raw.invalid);
            const result = summarizeCounterWindow(raw.rows); save('measurement', result);
            await page.screenshot({ path: path.join(out, 'after-measure.png') }); save('after-measure', await page.evaluate(pageState));
            console.log('MEASURED ' + backend + ' ' + JSON.stringify(result));
          } else if (c.action === 'next' || c.action === 'quit') {
            if (c.action === 'quit') stopped = true;
            await close('operator normal closure');
          } else throw Error('unsupported action');
          save('reply-' + i, { ok: true, at: new Date().toISOString() });
        } catch (error) {
          failure ||= error.stack || String(error); save('reply-' + i, { ok: false, error: failure });
        }
      }
      if (failure) { stopped = true; save('first-failure', { error: failure }); }
    } catch (error) { stopped = true; save('first-failure', { error: failure || error.stack || String(error),
      interruptedOperation: error.stack || String(error) }); }
    finally { await close(failure || 'arm complete'); }
  }
  write(path.join(run, webglOnly ? 'runtime-summary-webgl.json' : 'runtime-summary.json'), { browserMs, stopped, finishedAt: new Date().toISOString(), boxId: null, boxState: null, boxExpiry: null });
}

module.exports = { prepare, preload, pageState, requireReleases, normalClose, requiredShellPaths, validateShellPins };
if (require.main === module) {
  const [action, run] = process.argv.slice(2);
  if (!run || !['--prepare', '--run', '--run-webgl'].includes(action)) throw Error('usage: --prepare|--run|--run-webgl RUN');
  Promise.resolve(action === '--prepare' ? prepare(path.resolve(run)) : runPair(path.resolve(run), action === '--run-webgl'))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
