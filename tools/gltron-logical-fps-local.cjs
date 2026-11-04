'use strict';
// Run-specific WebGL diagnostic. External flock covers the entire runtime.
// node tools/gltron-logical-fps-local.cjs --prepare RUN
// After personally viewing the exact offline capture, this entry atomically
// reviews it and starts only if that review succeeds:
// flock -n /tmp/wine-local-runtime.lock node tools/gltron-logical-fps-local.cjs --review-run RUN CAPTURE_NAME
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { BOUNDARY, sha256, audit, probeCompiled, installPageCounter, summarizeCounterWindow, readLiveState } = require('./gltron-logical-fps.cjs');
const ROOT = path.resolve(__dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
// Readers poll from another process. Publish complete JSON with one rename;
// existence must never expose a truncated ACK or capture/ownership record.
function write(file, data) {
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(temp, file);
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const BROWSER_MS = 720000, CLEANUP_MS = 180000, BOOTSTRAP_MS = 60000, COMMAND_MS = 40000;
const HARD_BROWSER_END = Date.parse('2026-11-04T23:50:00Z');
const HARD_CLEANUP_END = Date.parse('2026-11-04T23:53:00Z');
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
  let live = null;
  try { if (e) live = window.__gltronReadLiveState(e, { gamePointer: 0x43d224 }); }
  catch (error) { live = { readError: error.message }; }
  return { at: new Date().toISOString(), atMs: performance.now(), visibility: document.visibilityState,
    running: w?.running, stopped: w?._stopped, guestWorker: !!w?.guestWorker, live,
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

function requireReleases(board, now = Date.now()) {
  const lines = board.split('\n');
  const stronghold = lines.findLast(line => {
    const match = /^(\S+) stronghold-repaired-entry LOCAL HEAVY RELEASE(?:\s|$)/.exec(line);
    const at = match && Date.parse(match[1]);
    return match && Number.isFinite(at) && at >= Date.parse('2026-11-04T21:27:19Z') && at <= now;
  });
  if (!stronghold) throw Error('requires explicit stronghold-repaired-entry release for stronghold-repaired-entry-original-gameplay-nov04');
  // Bind the actual actor's release to its latest preceding ownership record.
  // A task name repeated by someone else is not runtime permission.
  const ownership = lines.slice(0, lines.lastIndexOf(stronghold)).findLast(line =>
    /^\S+ stronghold-repaired-entry OWN(?:\s|$)/.test(line));
  const ownedAt = ownership && Date.parse(ownership.split(' ')[0]);
  if (!Number.isFinite(ownedAt) || ownedAt < Date.parse('2026-11-04T21:27:19Z') ||
      ownedAt > Date.parse(stronghold.split(' ')[0]) ||
      !ownership.split(/\s+/).includes('docs/re-notes/stronghold-repaired-entry-original-gameplay-20261104.md'))
    throw Error('stronghold-repaired-entry exact assignment ownership required before release');
  return { stronghold, ownership };
}

function requireLocalFlock(lockPath = '/tmp/wine-local-runtime.lock') {
  const ancestors = new Set();
  for (let pid = process.pid; pid > 1 && !ancestors.has(pid);) {
    ancestors.add(pid);
    const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    pid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
  }
  const target = fs.statSync(lockPath);
  const dev = BigInt(target.dev);
  const major = ((dev >> 8n) & 0xfffn) | ((dev >> 32n) & 0xfffff000n);
  const minor = (dev & 0xffn) | ((dev >> 12n) & 0xffffff00n);
  for (const row of fs.readFileSync('/proc/locks', 'utf8').trim().split('\n')) {
    const parts = row.trim().split(/\s+/), pid = Number(parts[4]);
    const device = parts[5]?.split(':');
    if (parts[1] !== 'FLOCK' || parts[3] !== 'WRITE' || !ancestors.has(pid) ||
        device?.[2] !== String(target.ino) || BigInt('0x' + device[0]) !== major ||
        BigInt('0x' + device[1]) !== minor) continue;
    for (const fd of fs.readdirSync('/proc/' + pid + '/fd')) {
      try {
        const held = fs.statSync('/proc/' + pid + '/fd/' + fd);
        if (held.dev === target.dev && held.ino === target.ino) return { pid, fd, path: lockPath };
      } catch { /* A closing unrelated descriptor cannot qualify the lock. */ }
    }
  }
  throw Error('required local flock must be held by this process or its ancestor');
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
  const capturedAtEpochMs = Date.now();
  const review = await page.evaluate(name => {
    const w = window.wine, e = w?.instance?.exports;
    const rect = document.querySelector('#screen')?.getBoundingClientRect();
    if (!rect || rect.width < 1 || rect.height < 1 || rect.x < 0 || rect.y < 0 ||
        rect.right > innerWidth || rect.bottom > innerHeight) throw Error('visible complete game canvas required');
    const clip = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    return window.__gltronGameplayReview = { name, clip, capturedAtMs: performance.now(),
      callbacks: e?.guest_read32(0x42b230) >>> 0,
      generation: window.__gltronModuleObservation?.instances.find(r => r.instance === w?.instance)?.generation };
  }, name);
  // Lossless PNG, same complete clip and surface. Ask Chrome to spend less
  // time compressing; do not downsample, re-encode, or move either start clock.
  await page.screenshot({ path: file, clip: review.clip, type: 'png', optimizeForSpeed: true });
  const captureCompletedAtEpochMs = Date.now();
  return { ...review, capturedAtEpochMs, captureCompletedAtEpochMs,
    path: file, sha256: sha256(fs.readFileSync(file)) };
}

function reviewedCapture(out, name, now = Date.now()) {
  if (!/^[a-z0-9-]+$/.test(name)) throw Error('exact named review required');
  const capture = JSON.parse(fs.readFileSync(path.join(out, name + '-capture-start.json')));
  const expected = path.join(out, name + '.png');
  if (capture.name !== name || capture.path !== expected || sha256(fs.readFileSync(expected)) !== capture.sha256)
    throw Error('exact reviewed capture required');
  const ageMs = now - capture.capturedAtEpochMs;
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 5000) throw Error('operator VIEW-to-action exceeds five seconds: ' + ageMs);
  return { capture, reviewedAtEpochMs: now, ageMs };
}

function requireHandoffProbe(run, now = Date.now()) {
  const out = path.join(run, 'offline-relay');
  const proof = JSON.parse(fs.readFileSync(path.join(out, 'review-handoff.json')));
  if (!proof.ok || proof.action !== 'review-only' || !Number.isFinite(proof.review?.reviewedAtEpochMs) ||
      now < proof.review.reviewedAtEpochMs || now - proof.review.reviewedAtEpochMs > 300000)
    throw Error('complete fresh offline VIEW/action rehearsal required before Chrome');
  const review = reviewedCapture(out, proof.review.capture.name, proof.review.reviewedAtEpochMs);
  if (JSON.stringify(review) !== JSON.stringify(proof.review)) throw Error('offline handoff proof changed');
  const shot = successfulCaptureAck(out, review.capture);
  if (JSON.stringify(shot) !== JSON.stringify(proof.shot)) throw Error('offline shot ACK proof changed');
  return proof;
}

// A capture file alone does not prove its producing command succeeded. Bind
// the rehearsal to the actual queue's latest completed shot and exact ACK.
function successfulCaptureAck(out, capture) {
  const numbers = fs.readdirSync(path.join(out, 'commands'))
    .filter(n => /^\d+\.json$/.test(n)).map(n => Number(n.slice(0, -5)));
  if (!numbers.length) throw Error('successful exact shot ACK required');
  const number = Math.max(...numbers);
  const command = JSON.parse(fs.readFileSync(path.join(out, 'commands', number + '.json')));
  const ack = JSON.parse(fs.readFileSync(path.join(out, 'reply-' + number + '.json')));
  if (command.action !== 'shot' || command.name !== capture.name || ack.ok !== true ||
      JSON.stringify(ack.capture) !== JSON.stringify(capture)) throw Error('successful exact shot ACK required');
  return { number, command, ack };
}

// This exact client is also exercised against the actual shot/ACK producer
// offline. Its stdout contains the ACK; the operator relays capture.path to
// view_image in the same tool invocation. No automatic claim of human review.
async function commandAck(out, command, timeoutMs = 55000) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 55000) throw Error('bounded ACK required');
  if (command.action === 'review-only') {
    let proof;
    try {
      const review = reviewedCapture(out, command.review);
      proof = { ok: true, action: command.action, review, shot: successfulCaptureAck(out, review.capture) };
    }
    catch (error) { write(path.join(out, 'review-handoff.json'), { ok: false, action: command.action, error: error.message, atEpochMs: Date.now() }); throw error; }
    write(path.join(out, 'review-handoff.json'), proof); return proof;
  }
  // No guest command is queued when the actual host capture/review handoff is
  // already stale. The browser monotonic five-second guard still decides arm.
  const clientFault = path.join(out, 'client-first-failure.json');
  if (fs.existsSync(clientFault) && command.action !== 'quit') throw Error('prior client first fault; never retry');
  if (command.action === 'measure') {
    try { reviewedCapture(out, command.review); }
    catch (error) {
      // A rejected prequeue review is still the first postlaunch fault. Keep
      // its cause and let the owner close normally, without another command.
      if (!fs.existsSync(clientFault)) write(clientFault, {
        source: 'ACK client prequeue review', action: command.action,
        review: command.review, error: error.stack || String(error), at: new Date().toISOString(), queued: false,
      });
      throw error;
    }
  }
  const commands = path.join(out, 'commands');
  const nums = fs.readdirSync(commands).filter(n => /^\d+\.json$/.test(n)).map(n => Number(n.slice(0, -5)));
  const n = nums.length ? Math.max(...nums) + 1 : 0;
  if (n && !JSON.parse(fs.readFileSync(path.join(out, 'reply-' + (n - 1) + '.json'))).ok) throw Error('prior ACK failed');
  if (fs.existsSync(path.join(out, 'cleanup.json'))) throw Error('runtime closed');
  const file = path.join(commands, n + '.json');
  fs.writeFileSync(file + '.tmp', JSON.stringify(command)); fs.renameSync(file + '.tmp', file);
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const reply = path.join(out, 'reply-' + n + '.json');
    if (fs.existsSync(reply)) {
      const ack = JSON.parse(fs.readFileSync(reply));
      if (!ack.ok) throw Error('command rejected: ' + ack.error);
      if (command.action === 'shot' || command.action === 'measure') {
        const capture = ack.capture, expected = path.join(out, (command.action === 'shot' ? command.name : 'after-measure') + '.png');
        if (!capture || capture.path !== expected || !Number.isFinite(capture.capturedAtMs) ||
            sha256(fs.readFileSync(expected)) !== capture.sha256) throw Error('exact capture ACK required');
      }
      return { number: n, ...ack };
    }
    if (fs.existsSync(path.join(out, 'first-failure.json'))) throw Error('runtime first fault');
    await pause(10);
  }
  throw Error('ACK deadline; never resend');
}

async function shotCommand(page, out, name) {
  const capture = await captureForReview(page, out, name);
  write(path.join(out, name + '-capture-start.json'), capture);
  write(path.join(out, name + '.json'), await page.evaluate(pageState));
  return capture;
}

// Read-only ray distances from the original trail segments; native A/S is the
// sole gameplay mutation. Exclude the player's unfinished current segment.
function steeringSample(boundary) {
  const e = window.wine.instance.exports, live = window.__gltronReadLiveState(e, boundary);
  const view = new DataView(e.memory.buffer);
  const read = (va, float = false) => {
    const at = e.guest_to_wasm(va) >>> 0;
    if (at < 256 || at + 4 > view.byteLength) throw Error('untranslated steering address');
    return float ? view.getFloat32(at, true) : view.getUint32(at, true);
  };
  const callbacks = read(boundary.currentCallbacks);
  if (!live.live || callbacks !== boundary.callbackTable) return { live, callbacks };
  if (live.direction > 3 || live.trailOffset >= 1000) throw Error('invalid steering data');
  const current = live.trails + 16 * live.trailOffset;
  const position = [read(current, true) + read(current + 8, true), read(current + 4, true) + read(current + 12, true)];
  const size = read(read(boundary.game2Pointer) + 20);
  if (size < 1 || size > 10000 || position.some(n => !Number.isFinite(n))) throw Error('invalid arena');
  const segments = [[0, 0, size, 0], [size, 0, 0, size], [size, size, -size, 0], [0, size, 0, -size]];
  for (let p = 0; p < live.count; p++) {
    const data = read(live.players + p * 12 + 4), trails = read(data + 32), count = read(data + 36);
    if (count >= 1000) throw Error('bounded trails exceeded');
    if (read(data + 20, true) < 3.5) continue;
    for (let j = 0; j <= count; j++) {
      if (p === 0 && j === count) break;
      const va = trails + 16 * j;
      const segment = [0, 4, 8, 12].map(off => read(va + off, true));
      if (segment.some(n => !Number.isFinite(n))) throw Error('invalid trail');
      segments.push(segment);
    }
  }
  return { atMs: performance.now(), live, callbacks, position, segments };
}

function chooseSteering(sample) {
  if (!sample.live.live || sample.callbacks !== BOUNDARY.callbackTable) throw Error('live player lost during ordinary steering');
  const dirs = [[0, -1], [-1, 0], [0, 1], [1, 0]], [x, y] = sample.position;
  const distances = [0, 3, 1].map(turn => {
    const [dx, dy] = dirs[(sample.live.direction + turn) % 4];
    let nearest = 10000;
    for (const [sx, sy, wx, wy] of sample.segments) {
      const det = dx * wy - dy * wx;
      if (!det) continue;
      const t = ((sx - x) * wy - (sy - y) * wx) / det;
      const u = ((sx - x) * dy - (sy - y) * dx) / det;
      if (t > 0.01 && u >= 0 && u <= 1) nearest = Math.min(nearest, t);
    }
    return nearest;
  });
  return { distances, key: distances[0] < 90 ? (distances[1] >= distances[2] ? 'a' : 's') : null };
}

function steeringDecision(sample, pendingTurn) {
  const decision = chooseSteering(sample);
  // Wait for the original player to acknowledge a turn, rather than imposing
  // a wall-clock cooldown that can outlast the next narrow corridor. Both
  // original fields must advance; a yield between their guest writes is not ACK.
  if (pendingTurn && (sample.live.direction === pendingTurn.direction ||
      sample.live.trailOffset === pendingTurn.trailOffset))
    return { ...decision, key: null, awaitingTurn: true };
  return decision;
}

async function balancedKey(page, key, held, wait = pause, holdMs = 25) {
  await page.keyboard.down(key); held.add(key);
  try { await wait(holdMs); } finally { await page.keyboard.up(key); held.delete(key); }
}

async function runPair(run) {
  // Validate the inherited external lock even for a gate-only invocation.
  // Missing release/proof tests must never fall through into an unflocked run.
  const localFlock = requireLocalFlock();
  const handoff = requireHandoffProbe(run);
  const releases = requireReleases(fs.readFileSync(path.join(ROOT, 'messageboard.txt'), 'utf8'));
  const pins = JSON.parse(fs.readFileSync(path.join(run, 'runtime-pins.json')));
  validateShellPins(pins.pins);
  validateRequiredPins(pins.pins, (await bootInputs()).paths);
  for (const pin of pins.pins) if (sha256(fs.readFileSync(path.join(ROOT, pin.path))) !== pin.sha256) throw Error('pin changed: ' + pin.path);
  if (Date.now() + BROWSER_MS + CLEANUP_MS > HARD_CLEANUP_END || Date.now() + BROWSER_MS > HARD_BROWSER_END) throw Error('full reserve unavailable');
  write(path.join(run, 'resource-releases.json'), { ...releases, handoff, localFlock });
  for (const module of ['build/wine-assembly.wasm', 'build/wine-assembly.compat.wasm']) {
    write(path.join(run, 'preflight-' + path.basename(module) + '.json'), await probeCompiled(module));
  }
  let browserMs = 0, stopped = false;
  const puppeteer = require('puppeteer');
  for (const backend of ['webgl']) {
    if (stopped) break;
    if (Date.now() + BROWSER_MS > HARD_BROWSER_END || Date.now() + BROWSER_MS + CLEANUP_MS > HARD_CLEANUP_END) throw Error('full per-backend reserve unavailable');
    const out = path.join(run, backend);
    if (fs.existsSync(out)) throw Error('single launch arm already exists');
    fs.mkdirSync(out); fs.mkdirSync(path.join(out, 'commands'));
    const save = (name, value) => write(path.join(out, name + '.json'), value);
    const log = (name, value) => fs.appendFileSync(path.join(out, name + '.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n');
    let browser, page, server, chromeStarted, timer, closed = false, failure = null, number = 0, closingPromise, launchPromise;
    let driving = false, drivePromise;
    const held = new Set();
    function close(reason) {
      if (closingPromise) return closingPromise;
      closed = true; driving = false; clearTimeout(timer);
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
        if (drivePromise) await within(() => drivePromise, remaining(), 'ordinary input completion');
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
      const remainingMs = Math.min(BROWSER_MS, HARD_BROWSER_END - chromeStarted);
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
      timer = setTimeout(() => { stopped = true; close('backend browser deadline').catch(error => log('cleanup-error', { error: String(error) })); }, remainingMs - (Date.now() - chromeStarted));
      page = await browser.newPage();
      page.setDefaultTimeout(60000); await page.setViewport({ width: 1200, height: 900 });
      await page.setCacheEnabled(false); await page.evaluateOnNewDocument(preload);
      await page.evaluateOnNewDocument('window.__gltronReadLiveState = ' + readLiveState.toString());
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
        const clientFault = path.join(out, 'client-first-failure.json');
        if (fs.existsSync(clientFault)) {
          const first = JSON.parse(fs.readFileSync(clientFault));
          failure = first.error; break;
        }
        if (Date.now() - commandAt > COMMAND_MS) throw Error('40 second command deadline');
        const file = path.join(out, 'commands', number + '.json');
        if (!fs.existsSync(file)) { await pause(10); continue; }
        commandAt = Date.now();
        const i = number++, c = JSON.parse(fs.readFileSync(file));
        log('commands', { i, ...c });
        try {
          let capture = null;
          await within(async () => {
          if (c.action === 'shot') {
            capture = await shotCommand(page, out, c.name);
          } else if (c.action === 'key' || c.action === 'drive') {
            if (!['Enter', 'Escape', 'a', 's', 'ArrowLeft', 'ArrowRight'].includes(c.key) || !c.review || !fs.existsSync(path.join(out, c.review + '.png'))) throw Error('reviewed original route required');
            if (c.action === 'drive' && (driving || c.key !== 'Enter')) throw Error('single reviewed unpause drive required');
            await page.focus('#screen');
            await balancedKey(page, c.key, held, pause, 100);
            if (c.action === 'drive') {
              await page.waitForFunction(boundary => {
                const e = window.wine.instance.exports;
                return e.guest_read32(boundary.currentCallbacks) === boundary.callbackTable && window.__gltronReadLiveState(e, boundary).live;
              }, { timeout: 3000 }, BOUNDARY);
              driving = true;
              drivePromise = (async () => {
                let pendingTurn = null;
                while (driving && !closed && !failure) {
                  const sample = await page.evaluate(steeringSample, BOUNDARY);
                  // Preserve exact first loss before choosing or sending input.
                  log('steering', { sample });
                  const decision = steeringDecision(sample, pendingTurn);
                  if (decision.key) {
                    log('steering-input', { ...decision, direction: sample.live.direction, trailOffset: sample.live.trailOffset });
                    pendingTurn = { direction: sample.live.direction, trailOffset: sample.live.trailOffset };
                    await balancedKey(page, decision.key, held);
                  }
                  await pause(100);
                }
              })().catch(async error => {
                failure ||= error.stack || String(error);
                save('first-failure', { error: failure, source: 'ordinary steering' });
                try {
                  save('steering-rejected-owner', await page.evaluate(pageState));
                  await page.screenshot({ path: path.join(out, 'steering-rejected.png') });
                } catch (captureError) { save('steering-rejected-capture-error', { error: String(captureError) }); }
              });
            }
          } else if (c.action === 'measure') {
            if (!driving) throw Error('ordinary gameplay maintenance required');
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
            capture = await shotCommand(page, out, 'after-measure');
            if (raw.invalid) throw Error(raw.invalid);
            const result = summarizeCounterWindow(raw.rows); save('measurement', result);
            console.log('INTERVAL_PENDING_PERSONAL_AFTER_REVIEW ' + backend + ' ' + JSON.stringify(result));
          } else if (c.action === 'next' || c.action === 'quit') {
            if (c.action === 'quit') stopped = true;
            await close('operator normal closure');
          } else throw Error('unsupported action');
          }, ['next', 'quit'].includes(c.action) ? CLEANUP_MS : COMMAND_MS, 'bounded command');
          save('reply-' + i, { ok: true, at: new Date().toISOString(), capture });
        } catch (error) {
          failure ||= error.stack || String(error); save('reply-' + i, { ok: false, error: failure });
          try {
            save('command-rejected-owner', await within(() => page.evaluate(pageState), 5000, 'firstfault owner'));
            await within(() => page.screenshot({ path: path.join(out, 'command-rejected.png') }), 5000, 'firstfault capture');
          } catch (captureError) { save('command-rejected-capture-error', { error: String(captureError) }); }
        }
      }
      if (failure) { stopped = true; save('first-failure', { error: failure }); }
    } catch (error) { stopped = true; save('first-failure', { error: failure || error.stack || String(error),
      interruptedOperation: error.stack || String(error) }); }
    finally { await close(failure || 'arm complete'); }
  }
  write(path.join(run, 'runtime-summary.json'), { browserMs, stopped, finishedAt: new Date().toISOString(), boxId: null, boxState: null, boxExpiry: null });
}

module.exports = { writeJson: write, prepare, preload, pageState, captureForReview, shotCommand, commandAck, reviewedCapture, requireHandoffProbe, requireLocalFlock, steeringSample, chooseSteering, steeringDecision, balancedKey, requireReleases, normalClose, requiredShellPaths, validateShellPins, bootInputs, validateRequiredPins, validateHistory, validateHttpPaths, within };
if (require.main === module) {
  const [action, run] = process.argv.slice(2);
  if (action === '--review-run') {
    Promise.resolve().then(async () => {
      await commandAck(path.join(path.resolve(run), 'offline-relay'), { action: 'review-only', review: process.argv[4] });
      return runPair(path.resolve(run));
    }).catch(error => { console.error(error); process.exitCode = 1; });
  } else if (action === '--command') {
    commandAck(path.resolve(run, process.argv[4]), JSON.parse(process.argv[5]))
      .then(ack => console.log(JSON.stringify(ack))).catch(error => { console.error(error); process.exitCode = 1; });
  } else {
  if (!run || !['--prepare', '--run'].includes(action)) throw Error('usage: --prepare|--run RUN or --command RUN BACKEND JSON');
  Promise.resolve(action === '--prepare' ? prepare(path.resolve(run)) : runPair(path.resolve(run)))
    .catch(error => { console.error(error); process.exitCode = 1; });
  }
}
