'use strict';
// Offline synthetic qualification of the actual host.js compile/start/method
// and production GuestThreadHost/WorkerLink/guest-worker. No original claim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const { webcrypto, createHash } = require('node:crypto');
const { GuestThreadHost } = require('../lib/guest-thread-host');
const { REQUIRED_PINS } = require('../lib/drakan-passive-actor-observer');
const regions = require('../lib/region-map.generated');
const ROOT = path.resolve(__dirname, '..');
const bytes = fs.readFileSync(process.env.WINE_ASSEMBLY_WASM || path.join(ROOT, 'build/wine-assembly.wasm'));
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
const hostSource = fs.readFileSync(path.join(ROOT, 'host.js'), 'utf8');
// Reuse the existing independently assembled synthetic fixture in memory.
const fixturePath = require.resolve('./test-drakan-observer-worker');
const fixtureSource = fs.readFileSync(fixturePath, 'utf8');
const fixtureModule = new Module(fixturePath, module);
fixtureModule.filename = fixturePath; fixtureModule.paths = module.paths;
fixtureModule._compile(fixtureSource.slice(0, fixtureSource.indexOf('\n(async () => {')) +
  '\nmodule.exports = F;', fixturePath);
const F = fixtureModule.exports;
const now = () => performance.timeOrigin + performance.now();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let checks = 0;
const pass = name => { checks++; console.log('PASS ' + name); };
function realm({ optin = true, selected = bytes, source = false, failArtifact = false, shared = false, offset = false } = {}) {
  let moduleFetches = 0, sourceBuilds = 0, sourceBytes;
  const messages = [];
  const context = {
    console: { log() {}, warn: (...args) => messages.push(args.join(' ')) },
    URLSearchParams, ArrayBuffer, Uint8Array, WebAssembly, performance,
    setTimeout, clearTimeout, setInterval, clearInterval, crypto: webcrypto,
    crossOriginIsolated: true, GuestThreadHost,
    location: { search: source ? '?compile-wat' : '' },
    window: { WINE_THREADS: true, WINE_DRAKAN_OBSERVER: optin },
    fetch: async url => {
      if (url.includes('host-import-sigs')) return { ok: true, json: async () => ({ sigs }) };
      assert(url.includes('wine-assembly')); moduleFetches++;
      if (failArtifact) throw Error('synthetic artifact unavailable');
      const b = Uint8Array.from(selected);
      return { ok: true, arrayBuffer: async () => b.buffer };
    },
  };
  context.window.watxLauncher = { compileDetailed: async () => {
    sourceBuilds++;
    const b = shared ? new Uint8Array(new SharedArrayBuffer(selected.length)) :
      offset ? new Uint8Array(selected.length + 8).subarray(4, selected.length + 4) : Uint8Array.from(selected);
    b.set(selected); sourceBytes = b; return { bytes: b, layout: {} };
  }};
  vm.runInNewContext(hostSource + '\nglobalThis.WineAssembly = WineAssembly;', context);
  const Wine = context.WineAssembly;
  Wine.supportsWasmTailCalls = () => true;
  Wine.versionedUrl = file => path.join(ROOT, file);
  Wine._assertSourceBuildLayout = () => {}; // unrelated layout gate has its own tests
  return { context, Wine, messages, get sourceBytes() { return sourceBytes; }, get fetches() { return moduleFetches; }, get builds() { return sourceBuilds; } };
}
async function start(r, fixture) {
  const module = await r.Wine.getWasmModule();
  const w = new r.Wine();
  Object.assign(w, {
    memory: fixture ? fixture.e.memory : new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true }),
    instance: fixture ? { exports: fixture.e } : { exports: {} },
    _wasmModule: module, _mainImports: { host: {} }, renderer: {},
    logToUI: msg => r.messages.push(msg),
  });
  await w._maybeStartGuestWorker(module);
  return w;
}
async function stop(w) {
  if (w?.guestWorker) {
    const link = w.guestWorker.link;
    await w.guestWorker.stop();
    if (link) assert.equal(link._stopped, true, 'production Worker retirement awaited');
  }
}
async function rejectedRelease(w, options = {}) {
  let calls = 0, settled = false;
  const promise = w.observeDrakanActor({ actionStartedAt: now(), maxMs: 100,
    ...options, releaseT: () => { calls++; return delay(15).then(() => { throw Error('synthetic physical rejection'); }); },
  }).then(() => { throw Error('unexpected success'); }, error => { settled = true; return error; });
  await delay(2); assert.equal(settled, false, 'failure waits for physical release');
  const error = await promise;
  assert.equal(calls, 1); assert.match(error.releaseError, /synthetic physical rejection/);
  await error.releasePromise;
  return error;
}
async function prepared(r) {
  const f = await F.fixture();
  const saved = [];
  for (const [a, n] of [[0x47b700, 4], [F.OBJ, 0xb0], [F.ACTOR, 0x100],
    [F.DEVICE, 8], [0x1830000, 192], [F.STACK, 64], [F.B + 0x15e584, 4]])
    saved.push([f.wa(a), f.mem.slice(f.wa(a), f.wa(a) + n)]);
  saved.push([regions.BASE.DX_OBJECTS, f.mem.slice(regions.BASE.DX_OBJECTS, regions.BASE.DX_OBJECTS + 32)]);
  const w = await start(r, f);
  assert(w.guestWorker instanceof GuestThreadHost);
  const gh = w.guestWorker;
  let consumed = 0;
  const fifo = [{ event: 0x154, timestamp: F.STAMP, sequence: 9 }];
  gh.hostImports.di_keyboard_buffer = (_device, op, n) => {
    if (op === 2) return fifo.length;
    if (op === 3) return fifo[n]?.event || 0;
    if (op === 4) return fifo[n]?.timestamp || 0;
    if (op === 5) return fifo[n]?.sequence || 0;
    if (op === 6) { consumed++; fifo.splice(0, n); }
    return 0;
  };
  const exe = fs.readFileSync(path.join(ROOT, 'test/binaries/notepad.exe'));
  f.mem.set(exe, f.e.get_staging()); await gh.callExport('load_pe', exe.length);
  for (const [name, ...args] of [['set_api_log', 0], ['set_process_id', 1000], ['init_dx_com_thunks'], ['seal_thunks']])
    await gh.callExport(name, ...args);
  for (const [at, b] of saved) f.mem.set(b, at);
  const pins = {};
  for (const [name, [start, end]] of Object.entries(REQUIRED_PINS)) {
    const address = ['event4', 'actor', 'state1'].includes(name) ? F.B + start : start;
    const expected = new Uint8Array(end - start);
    for (const [a, b] of f.writes) for (let i = 0; i < b.length; i++)
      if (a + i >= address && a + i < address + expected.length) expected[a + i - address] = b[i];
    pins[name] = { address, bytes: expected };
    f.mem.fill(0, f.wa(address), f.wa(address) + expected.length);
  }
  for (const [a, b] of f.writes) f.mem.set(b, f.wa(a));
  await gh.callExport('set_eip', 0x407a95); await gh.callExport('set_esp', F.STACK);
  return { w, gh, f, options: { base: F.B, object: F.OBJ, actor: F.ACTOR,
    keyboardDevice: regions.BASE.DX_OBJECTS, pins, timestamp: F.STAMP }, get consumed() { return consumed; } };
}
async function armedCase(mode) {
  const r = realm();
  const p = await prepared(r), { w, gh, options } = p;
  let released = 0, releaseAt, physical = false, settled = false;
  let finish;
  const physicalPromise = new Promise((resolve, reject) => { finish = mode === 'reject' ? reject : resolve; });
  const started = now();
  const observation = w.observeDrakanActor({ ...options, actionStartedAt: started, maxMs: mode === 'deadline' ? 70 : 800,
    releaseT: () => { released++; releaseAt = now(); return physicalPromise; },
  });
  const outcome = observation.then(result => ({ result }), error => ({ error })).then(value => { settled = true; return value; });
  try {
    for (let i = 0; i < 100 && !gh.link.drakanController; i++) await delay(1);
    const c = gh.link.drakanController;
    assert(c, 'actual WorkerLink controller created');
    assert.equal(c.deadline, started + (mode === 'deadline' ? 70 : 800));
    if (mode === 'deadline') {
      // No guest slice: independent controller deadline must release anyway.
      while (!released) await delay(1);
      assert(releaseAt - started < 2000);
      assert.equal(c.completed, undefined);
    } else if (mode === 'retire') {
      await gh.stop();
      assert.equal(c.stopped, true);
    } else {
      for (let i = 0; i < 60 && !c.completed && !c.stopped; i++) await gh.slice(1);
      assert.equal(c.completed?.stage, 12, 'native exact-down completed enclosing RET: ' + JSON.stringify({ completed: c.completed, stopped: c.stopped, control: require('../lib/drakan-observer-worker').readControl(c.buffer) }));
      assert.equal(c.completed?.status, 'COMPLETE');
      assert.equal(p.consumed, 1);
      assert.equal(released, 0);
      c.stop('synthetic ordinary caller finished');
    }
    assert.equal(released, 1);
    assert.equal(settled, false, 'host cannot claim success or failure before physical settlement');
    if (mode === 'reject') finish(Error('delayed physical release rejection'));
    else { physical = true; finish(); }
    const value = await outcome;
    if (mode === 'reject') {
      assert.match(value.error.releaseError, /delayed physical release rejection/);
      assert.match(c.releaseError, /delayed physical release rejection/);
    } else if (mode === 'retire') assert.match(value.error.message, /retired|changed/);
    else {
      assert.equal(physical, true); assert.equal(value.result.released, true);
      assert.equal(value.result.result.status, mode === 'deadline' ? 'UNKNOWN' : 'COMPLETE');
    }
    const retry = await rejectedRelease(w, options);
    assert.match(retry.message, /unavailable|already used/);
    assert.equal(p.consumed, mode === 'deadline' || mode === 'retire' ? 0 : 1, 'no rearm or replay');
    pass('actual browser method + GuestThreadHost ' + mode);
  } finally {
    finish(); await outcome; await stop(w);
  }
}
(async () => {
  assert.equal(await require('../lib/drakan-observer-worker').verifiedModuleSha256(bytes),
    createHash('sha256').update(bytes).digest('hex'));
  console.log(JSON.stringify({ moduleSha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length }));
  for (const optin of [false, 'true']) {
    const r = realm({ optin }), w = await start(r);
    try {
      assert.equal(w.guestWorker.drakanModuleBytes, null);
      assert.match((await rejectedRelease(w)).message, /unavailable/);
      assert.equal(r.fetches, 1);
      pass('default opt-out exact boolean ' + String(optin));
    } finally { await stop(w); }
  }
  {
    const r = realm({ optin: false }); await r.Wine.getWasmModule();
    r.context.window.WINE_DRAKAN_OBSERVER = true;
    const w = await start(r);
    assert.equal(w.guestWorker, null);
    assert(r.messages.some(m => m.includes('compile bytes unavailable')));
    assert.equal(r.fetches, 1, 'late opt-in cannot refetch substitute bytes');
    await rejectedRelease(w); pass('cached unretained module rejected without refetch');
  }
  {
    const wrong = Buffer.from(bytes); wrong[wrong.length - 1] ^= 1;
    const r = realm({ selected: wrong }), w = await start(r);
    assert.equal(w.guestWorker, null);
    assert(r.messages.some(m => m.includes('SHA-256 mismatch')));
    assert.equal(r.fetches, 1); assert.equal(r.builds, 0);
    await rejectedRelease(w); pass('actual compiled wrong bytes rejected before Worker construction');
  }
  {
    const r = realm(), w = await start(r);
    const memory = w.memory;
    try {
      w.memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
      assert.match((await rejectedRelease(w)).message, /stale owner/);
      pass('different public memory cannot replace private compiled owner');
    } finally { w.memory = memory; await stop(w); }
  }
  {
    const r = realm(), w = await start(r);
    try {
      w.guestWorker.link.drakanModuleBytes = Uint8Array.from(bytes);
      w.guestWorker.link.drakanModuleBytes[100] ^= 1;
      assert.match((await rejectedRelease(w)).message, /Drakan module identity/);
      assert.equal(w.guestWorker.link.drakanController, null);
      pass('caller-altered bytes cannot forge an owning Controller digest');
    } finally { await stop(w); }
  }
  {
    const r = realm({ source: true, offset: true });
    await r.Wine.getWasmModule();
    r.sourceBytes.fill(0); // Public loader buffer no longer contains compiled bytes.
    const w = await start(r);
    try {
      assert(w.guestWorker);
      assert.deepEqual(Buffer.from(w.guestWorker.drakanModuleBytes), bytes);
      assert.equal(r.builds, 1); assert.equal(r.fetches, 0);
      pass('offset source compile snapshot remains private after loader mutation');
    } finally { await stop(w); }
  }
  for (const fallback of [false, true]) {
    const r = realm({ source: !fallback, failArtifact: fallback }), w = await start(r);
    try {
      assert(w.guestWorker);
      assert.equal(r.builds, 1); assert.equal(r.fetches, fallback ? 1 : 0);
      assert.deepEqual(Buffer.from(w.guestWorker.drakanModuleBytes), bytes);
      // Deliberately forged public module must not gain private provenance.
      w._wasmModule = await WebAssembly.compile(bytes);
      assert.match((await rejectedRelease(w)).message, /stale owner/);
      pass('selected source bytes retained; stale public module rejected ' + fallback);
    } finally { await stop(w); }
  }
  {
    const r = realm({ source: true, shared: true });
    await assert.rejects(r.Wine.getWasmModule(), /must be unshared/);
    pass('shared mutable compile input rejected');
  }
  {
    const r = realm(), a = await start(r), b = await start(r);
    const own = a.guestWorker;
    try {
      a.guestWorker = b.guestWorker;
      assert.match((await rejectedRelease(a)).message, /stale owner/);
      pass('sibling same-module Worker cannot replace owning main Worker');
    } finally { a.guestWorker = own; await stop(a); await stop(b); }
  }
  {
    const r = realm(), w = await start(r);
    try {
      const e = await rejectedRelease(w, { actionStartedAt: now() - 3000 });
      assert.match(e.message, /fresh original action/);
      assert.equal(w.guestWorker.link.drakanController, null);
      pass('expired original deadline rejected before observer setup');
    } finally { await stop(w); }
  }
  for (const options of [{ maxMs: 2001 }, { actionStartedAt: now() + 10000 }]) {
    const r = realm(), w = await start(r);
    try {
      assert.match((await rejectedRelease(w, options)).message, /fresh original action/);
      assert.equal(w.guestWorker.link.drakanController, null);
      pass('invalid cap/future start cannot create a Controller');
    } finally { await stop(w); }
  }
  {
    const r = realm({ optin: false }), w = await start(r);
    try {
      let calls = 0;
      const e = await w.observeDrakanActor({ actionStartedAt: now(), maxMs: 100,
        releaseT: () => { calls++; throw Error('synchronous physical failure'); },
      }).then(() => { throw Error('unexpected success'); }, error => error);
      await e.releasePromise;
      assert.equal(calls, 1); assert.match(e.releaseError, /synchronous physical failure/);
      assert.match(e.message, /unavailable/);
      pass('unarmed setup preserves original refusal and synchronous release failure');
    } finally { await stop(w); }
  }
  {
    const r = realm(), w = await start(r);
    try {
      const e = await rejectedRelease(w, { base: 0, pins: {} });
      assert(e.releaseError);
      assert.equal(w.guestWorker.link.drakanController.stopped, true);
      pass('actual Worker setup failure joins asynchronous failed release');
    } finally { await stop(w); }
  }
  for (const mode of ['success', 'reject', 'deadline', 'retire']) await armedCase(mode);
  console.log(checks + ' PASS; synthetic offline only, no original or physical input claim');
})().catch(error => { console.error(error); process.exitCode = 1; });
