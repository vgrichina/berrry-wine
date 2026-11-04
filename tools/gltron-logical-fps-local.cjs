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
const BROWSER_MS = 360000, CLEANUP_MS = 180000, BOOTSTRAP_MS = 60000, COMMAND_MS = 60000;
const HARD_BROWSER_END = Date.parse('2026-11-04T23:30:00Z');
const HARD_CLEANUP_END = Date.parse('2026-11-04T23:33:00Z');
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

async function bootInputs() {
  const { APPS } = require('../lib/apps');
  const app = APPS.gltron, registry = require('../lib/dll-registry');
  const scripts = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .split('const WINE_RUNTIME_SCRIPTS = Object.freeze([')[1].split(']);')[0];
  const paths = new Set(['index.html', ...requiredShellPaths(),
    ...[...scripts.matchAll(/"([^"\n]+\.js)"/g)].map(m => m[1]),
    'build/wine-assembly.wasm', 'build/wine-assembly.compat.wasm']);
  // Conservative production superset also seals lazy workers/worklets, shaders,
  // source-compile fallback includes and assets reached after app startup.
  for (const file of git('ls-files', '-z', '--', 'lib', 'src', 'fonts', 'icons', 'tools/watx-src').split('\0').filter(Boolean)) paths.add(file);
  const byName = new Map(app.files.map(f => [path.basename(f.url).toLowerCase(), f.url]));
  const missing = [];
  const graph = await require('../lib/process-boot').resolveDllGraph({
    exeBytes: fs.readFileSync(path.join(ROOT, 'test/' + app.exe)), seeds: app.dlls,
    detectRequiredDlls: require('../lib/dll-loader').detectRequiredDlls,
    loadSpec: async spec => {
      const name = path.basename(spec), url = spec.includes('/') ? spec : registry.DLL_PATHS[name.toLowerCase()] || byName.get(name.toLowerCase());
      if (!url) { missing.push(spec); return null; }
      const file = url.startsWith('test/') ? url : 'test/' + url;
      if (!fs.existsSync(path.join(ROOT, file))) { missing.push(file); return null; }
      const bytes = fs.readFileSync(path.join(ROOT, file)); paths.add(file);
      return { name, bytes, path: file };
    },
    onMissing: name => { missing.push(name); },
  });
  if (missing.length) throw Error('missing production DLLs: ' + missing.join(', '));
  for (const f of app.files) paths.add('test/' + f.url);
  return { paths: [...paths], dlls: graph.map(({ name, path }) => ({ name, path })) };
}
function validateRequiredPins(pins, paths) {
  for (const file of paths) {
    const b = fs.readFileSync(path.join(ROOT, file));
    if (!pins.some(p => p.path === file && p.bytes === b.length && p.sha256 === sha256(b)))
      throw Error('required production pin missing or stale: ' + file);
  }
}
function validateHistory(pins, rows) {
  for (const row of rows) if (!pins.some(p => p.path === row.path && p.bytes === row.bytes && p.sha256 === row.sha256))
    throw Error('prior HTTP pin missing or stale: ' + row.path);
  return { requests: rows.length, distinctPaths: new Set(rows.map(r => r.path)).size, pass: true };
}
async function validateHttpPaths(pins, urls) {
  const { resolveStaticPath } = require('../test/static-server');
  for (const url of urls) {
    const resolved = await resolveStaticPath(ROOT, url, {
      rewritePath: p => p.startsWith('/binaries/') ? '/test' + p : p });
    if (resolved.status !== 200) throw Error('offline HTTP route failed: ' + url + ' status ' + resolved.status);
    const file = path.relative(ROOT, resolved.file), bytes = fs.readFileSync(resolved.file);
    if (!pins.some(p => p.path === file && p.bytes === bytes.length && p.sha256 === sha256(bytes)))
      throw Error('offline HTTP route pin mismatch: ' + url);
  }
  return { routes: urls.length, pass: true, serverStarted: false, browserStarted: false };
}
async function prepare(run) {
  fs.mkdirSync(run, { recursive: true });
  const offline = audit(ROOT);
  const boot = await bootInputs();
  write(path.join(run, 'production-boot-inputs.json'), boot);
  write(path.join(run, 'offline-audit.json'), offline);
  const files = new Set(git('ls-files', '-z', '--', 'src', 'lib', 'host.js', 'index.html',
    'style.css', 'build', 'fonts', 'manifest.webmanifest', 'test/static-server.js').split('\0').filter(Boolean));
  for (const file of ['build/wine-assembly.wasm', 'build/wine-assembly.compat.wasm']) files.add(file);
  for (const file of boot.paths) files.add(file);
  for (const file of ['tools/gltron-logical-fps.cjs', 'tools/gltron-logical-fps-local.cjs', 'test/test-gltron-logical-fps.js']) files.add(file);
  for (const file of offline.media) files.add(file.path);
  // Root shell assets only; unrelated agents' tools and evidence are not boot
  // dependencies. Production directories and the actual DLL graph are above.
  for (const file of git('ls-files', '-z', '--', '*.js', '*.css', '*.json', '*.ico').split('\0').filter(p => p && !p.includes('/'))) files.add(file);
  if (fs.existsSync(path.join(ROOT, 'lib/wininit-boot.js'))) files.add('lib/wininit-boot.js');
  const pins = [...files].filter(p => fs.existsSync(path.join(ROOT, p)) && fs.statSync(path.join(ROOT, p)).isFile())
    .map(p => { const b = fs.readFileSync(path.join(ROOT, p)); return { path: p, bytes: b.length, sha256: sha256(b) }; });
  validateShellPins(pins);
  validateRequiredPins(pins, boot.paths);
  const prior = path.join(ROOT, 'scratch/runs/20261104-gltron-production-frame-counter');
  const history = ['software', 'webgl'].flatMap(arm => fs.readFileSync(path.join(prior, arm, 'served.jsonl'), 'utf8').trim().split('\n').map(JSON.parse));
  write(path.join(run, 'prior-http-check.json'), validateHistory(pins, history));
  write(path.join(run, 'offline-http-check.json'), await validateHttpPaths(pins, [...boot.paths.map(p => '/' + (p.startsWith('test/binaries/') ? p.slice(5) : p)), ...history.map(r => r.url)]));
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
  const mdk = board.split('\n').findLast(line => /mdk2-continuous-(?:construction-)?onward LOCAL HEAVY RELEASE/.test(line));
  if (!mdk) throw Error('requires explicit mdk2-continuous-construction-onward release');
  return { mdk };
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

function processIdentity(pid) {
  const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
  return { pid, startTicks: stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19],
    cmdline: fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0').filter(Boolean) };
}
async function within(operation, timeoutMs, label) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error(label + ' deadline')), timeoutMs);
  })]); } finally { clearTimeout(timer); }
}

// Return the exact capture in the command ACK. Operator tool calls must relay
// this path to VIEW in the same invocation, then submit the reviewed action.
// This removes an avoidable model/tool handoff; it does not promise a human
// review will fit the unchanged five-second arming deadline.
async function captureForReview(page, out, name) {
  const file = path.join(out, name + '.png');
  if (!/^[a-z0-9-]+$/.test(name) || fs.existsSync(file)) throw Error('fresh capture required');
  const review = await page.evaluate(name => {
    const w = window.wine, e = w?.instance?.exports;
    return window.__gltronGameplayReview = { name, capturedAtMs: performance.now(),
      callbacks: e?.guest_read32(0x42b230) >>> 0,
      generation: window.__gltronModuleObservation?.instances.find(r => r.instance === w?.instance)?.generation };
  }, name);
  await page.screenshot({ path: file });
  return { ...review, path: file, sha256: sha256(fs.readFileSync(file)) };
}

async function runPair(run) {
  const releases = requireReleases(fs.readFileSync(path.join(ROOT, 'messageboard.txt'), 'utf8'));
  const pins = JSON.parse(fs.readFileSync(path.join(run, 'runtime-pins.json')));
  validateShellPins(pins.pins);
  validateRequiredPins(pins.pins, (await bootInputs()).paths);
  for (const pin of pins.pins) if (sha256(fs.readFileSync(path.join(ROOT, pin.path))) !== pin.sha256) throw Error('pin changed: ' + pin.path);
  if (Date.now() + BROWSER_MS + CLEANUP_MS > HARD_CLEANUP_END || Date.now() + BROWSER_MS > HARD_BROWSER_END) throw Error('full reserve unavailable');
  write(path.join(run, 'resource-releases.json'), releases);
  for (const module of ['build/wine-assembly.wasm', 'build/wine-assembly.compat.wasm']) {
    write(path.join(run, 'preflight-' + path.basename(module) + '.json'), await probeCompiled(module));
  }
  let browserMs = 0, stopped = false;
  const puppeteer = require('puppeteer');
  for (const backend of ['software', 'webgl']) {
    if (stopped) break;
    const out = path.join(run, backend);
    if (fs.existsSync(out)) throw Error('single launch arm already exists');
    fs.mkdirSync(out); fs.mkdirSync(path.join(out, 'commands'));
    const save = (name, value) => write(path.join(out, name + '.json'), value);
    const log = (name, value) => fs.appendFileSync(path.join(out, name + '.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n');
    let browser, page, server, chromeStarted, timer, closed = false, failure = null, number = 0, closingPromise, launchPromise;
    const held = new Set();
    function close(reason) {
      if (closingPromise) return closingPromise;
      closed = true; clearTimeout(timer);
      closingPromise = (async () => {
      const port = server?.address();
      const cleanupDeadline = Math.min(Date.now() + CLEANUP_MS, HARD_CLEANUP_END);
      const remaining = () => {
        const ms = cleanupDeadline - Date.now();
        if (ms < 1) throw Error('absolute cleanup deadline');
        return ms;
      };
      let cleanupError = null;
      try {
        for (const key of held) await within(() => page.keyboard.up(key), remaining(), 'key release');
        if (!browser && launchPromise) await within(() => launchPromise, remaining(), 'pending launch cleanup');
        if (browser) await normalClose(browser, row => log('lifecycle', row), remaining());
      }
      catch (error) { cleanupError = String(error); throw error; }
      finally {
        if (chromeStarted) browserMs += Date.now() - chromeStarted;
        try {
          if (server) {
            server.closeAllConnections();
            await within(() => new Promise(resolve => server.close(resolve)), remaining(), 'server closure');
          }
        } catch (error) { cleanupError ||= String(error); }
      const child = browser?.process();
      save('cleanup', { reason, chromePid: child?.pid, exitCode: child?.exitCode, signal: child?.signalCode,
        cleanupDeadline, cleanupError, cumulativeBrowserMs: browserMs, nodePid: process.pid,
        serverListening: !!server?.listening, port, boxId: null, boxState: null, boxExpiry: null });
      }
      if (cleanupError) throw Error(cleanupError);
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
      const remainingMs = Math.min(BROWSER_MS - browserMs, HARD_BROWSER_END - chromeStarted);
      if (remainingMs < 30000) throw Error('insufficient remaining browser budget');
      await within(async () => {
      launchPromise = puppeteer.launch({ headless: false, executablePath: '/usr/bin/google-chrome',
        userDataDir: path.join(out, 'chrome-profile'), protocolTimeout: 60000, timeout: 60000,
        args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--disable-background-networking'] }).then(value => { browser = value; return value; });
      await launchPromise;
      if (closed) throw Error('bootstrap closed');
      const child = browser.process();
      child.on('exit', (code, signal) => log('lifecycle', { event: 'chrome-exit', pid: child.pid, code, signal }));
      browser.on('disconnected', () => log('lifecycle', { event: 'browser-disconnected' }));
      save('launch', { backend, chromePid: child.pid, chromeIdentity: processIdentity(child.pid), nodeIdentity: processIdentity(process.pid), nodePid: process.pid, chromeStarted,
        browserVersion: await browser.version(), argv: child.spawnargs, remainingMs, pinsCommit: pins.commit,
        browserEnd: new Date(Math.min(chromeStarted + remainingMs, HARD_BROWSER_END)).toISOString(),
        cleanupEnd: new Date(Math.min(chromeStarted + remainingMs + 180000, HARD_CLEANUP_END)).toISOString() });
      timer = setTimeout(() => { stopped = true; close('cumulative browser deadline').catch(error => log('cleanup-error', { error: String(error) })); }, remainingMs - (Date.now() - chromeStarted));
      page = await browser.newPage();
      page.setDefaultTimeout(60000); await page.setViewport({ width: 1200, height: 900 });
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
      }, BOOTSTRAP_MS, '60 second bootstrap');
      console.log('READY ' + backend + ' ' + out);
      let commandAt = Date.now();
      while (!closed && !failure) {
        if (Date.now() - commandAt > COMMAND_MS) throw Error('60 second command deadline');
        const file = path.join(out, 'commands', number + '.json');
        if (!fs.existsSync(file)) { await pause(100); continue; }
        commandAt = Date.now();
        const i = number++, c = JSON.parse(fs.readFileSync(file));
        log('commands', { i, ...c });
        try {
          let capture = null;
          await within(async () => {
          if (c.action === 'shot') {
            capture = await captureForReview(page, out, c.name);
            save(c.name + '-capture-start', capture);
            save(c.name, await page.evaluate(pageState));
          } else if (c.action === 'key') {
            if (!['Enter', 'Escape', 'a', 's', 'ArrowLeft', 'ArrowRight'].includes(c.key) || !c.review || !fs.existsSync(path.join(out, c.review + '.png'))) throw Error('reviewed original route required');
            await page.focus('#screen');
            await page.keyboard.down(c.key); held.add(c.key); await pause(100);
            await page.keyboard.up(c.key); held.delete(c.key);
          } else if (c.action === 'measure') {
            if (!c.review || !fs.existsSync(path.join(out, c.review + '.png'))) throw Error('gameplay review required');
            const token = backend + '-' + Date.now();
            let armed;
            try { armed = await page.evaluate(installPageCounter, BOUNDARY, token, c.review); }
            catch (error) {
              try {
                save('counter-rejection', await within(() => page.evaluate(() => ({
                  rejection: window.__gltronCounterRejection || null,
                  atMs: performance.now(),
                })), 5000, 'rejected counter evidence'));
                save('rejected-owner-context', await within(() => page.evaluate(pageState), 5000, 'rejected owner evidence'));
                await within(() => page.screenshot({ path: path.join(out, 'counter-rejected.png') }), 5000, 'rejection capture');
              } catch (captureError) { save('counter-rejection-capture-error', { error: String(captureError) }); }
              throw error;
            }
            save('armed', armed);
            await pause(5500);
            const raw = await page.evaluate(() => window.__gltronCounter.finish()); save('raw-counter-window', raw);
            await page.screenshot({ path: path.join(out, 'after-measure.png') }); save('after-measure', await page.evaluate(pageState));
            if (raw.invalid) throw Error(raw.invalid);
            const result = summarizeCounterWindow(raw.rows); save('measurement', result);
            console.log('MEASURED ' + backend + ' ' + JSON.stringify(result));
          } else if (c.action === 'next' || c.action === 'quit') {
            if (c.action === 'quit') stopped = true;
            await close('operator normal closure');
          } else throw Error('unsupported action');
          }, ['next', 'quit'].includes(c.action) ? CLEANUP_MS : COMMAND_MS, 'bounded command');
          save('reply-' + i, { ok: true, at: new Date().toISOString(), capture });
        } catch (error) {
          failure ||= error.stack || String(error); save('reply-' + i, { ok: false, error: failure });
        }
      }
      if (failure) { stopped = true; save('first-failure', { error: failure }); }
    } catch (error) { stopped = true; save('first-failure', { error: failure || error.stack || String(error),
      interruptedOperation: error.stack || String(error) }); }
    finally { await close(failure || 'arm complete'); }
  }
  write(path.join(run, 'runtime-summary.json'), { browserMs, stopped, finishedAt: new Date().toISOString(), boxId: null, boxState: null, boxExpiry: null });
}

module.exports = { prepare, preload, pageState, captureForReview, requireReleases, normalClose, requiredShellPaths, validateShellPins, bootInputs, validateRequiredPins, validateHistory, validateHttpPaths, within };
if (require.main === module) {
  const [action, run] = process.argv.slice(2);
  if (!run || !['--prepare', '--run'].includes(action)) throw Error('usage: --prepare|--run RUN');
  Promise.resolve(action === '--prepare' ? prepare(path.resolve(run)) : runPair(path.resolve(run)))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
