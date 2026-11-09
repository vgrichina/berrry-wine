'use strict';
// Real production guest-worker.js, complete pinned WASM and real brokered
// GetDeviceData. Synthetic guest only. No browser or game is launched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const { Worker } = require('node:worker_threads');
const { WorkerLink, GuestThreadHost } = require('../lib/guest-thread-host');
const RPC = require('../lib/guest-rpc');
const regions = require('../lib/region-map.generated');
const { Controller, installedPins, verifiedModuleSha256, readControl } = require('../lib/drakan-observer-worker');
const { sha256 } = require('../lib/drakan-passive-actor-observer');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
const ROOT = path.resolve(__dirname, '..');
const bytes = fs.readFileSync(process.env.WINE_ASSEMBLY_WASM || path.join(ROOT, 'build/wine-assembly.wasm'));
const MODULE_SHA = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
const sourcePath = require.resolve('./test-drakan-passive-actor-observer');
const source = fs.readFileSync(sourcePath, 'utf8');
const cutoff = source.indexOf('(async () => {');
assert(cutoff > 0);
// Reuse the established synthetic assembler in memory, without running its
// adapter tests or copying source into evidence. Capture assembler writes
// before guest memory sees them, to derive independent synthetic code pins.
const fixtureModule = new Module(sourcePath, module);
fixtureModule.filename = sourcePath; fixtureModule.paths = module.paths;
fixtureModule._compile(source.slice(0, cutoff).replace(
  'mem.set(b, wa(a)); e.invalidate_code_range(a, b.length);',
  'writes.push([a, Uint8Array.from(b)]); mem.set(b, wa(a)); e.invalidate_code_range(a, b.length);')
  .replace('const put = (a, b)', 'const writes = []; const put = (a, b)')
  .replace('return { e, mem, dv, wa,', 'return { writes, e, mem, dv, wa,') +
  '\nmodule.exports = { fixture, B, OBJ, ACTOR, STACK, END, DEVICE, STAMP };', sourcePath);
const F = fixtureModule.exports;
let checks = 0;
function pass(name) { checks++; console.log('PASS ' + name); }

async function workerCase(mode = '', mutate = () => {}, useLink = false, lifecycle = {}) {
  const f = await F.fixture(mode), memory = f.e.memory;
  assert(memory instanceof WebAssembly.Memory);
  const saved = [];
  // Guest objects and native keyboard descriptor are fixture setup only.
  for (const [a, n] of [[0x47b700, 4], [F.OBJ, 0xb0], [F.ACTOR, 0x100],
    [F.DEVICE, 8], [0x1830000, 192], [F.STACK, 64], [F.B + 0x15e584, 4]])
    saved.push([f.wa(a), f.mem.slice(f.wa(a), f.wa(a) + n)]);
  saved.push([regions.BASE.DX_OBJECTS, f.mem.slice(regions.BASE.DX_OBJECTS, regions.BASE.DX_OBJECTS + 32)]);
  const pins = {};
  for (const [name, [start, end]] of Object.entries(require('../lib/drakan-passive-actor-observer').REQUIRED_PINS)) {
    const address = ['event4','actor','state1'].includes(name) ? F.B + start : start;
    const expected = new Uint8Array(end - start);
    for (const [a, b] of f.writes) for (let i = 0; i < b.length; i++)
      if (a + i >= address && a + i < address + expected.length) expected[a + i - address] = b[i];
    pins[name] = { address, bytes: expected };
  }
  const events = [], pending = new Map(); let seq = 0, controller, released = 0, consumedCalls = 0;
  const fifo = [{ event: 0x154, timestamp: F.STAMP, sequence: 9 }];
  if (mode === 'same-drain') fifo.push({ event: 0x54, timestamp: F.STAMP + 1, sequence: 10 });
  const host = new Proxy({}, { get: (_, name) => (...args) => {
    if (name !== 'di_keyboard_buffer') return 0;
    const [, op, n] = args;
    if (mode === 'buffer-throw') throw Error('fixture buffer failure');
    if (op === 2) return fifo.length;
    if (op === 3) return fifo[n]?.event || 0;
    if (op === 4) return fifo[n]?.timestamp || 0;
    if (op === 5) return fifo[n]?.sequence || 0;
    if (op === 6) { consumedCalls++; fifo.splice(0, n); return 0; }
    if (op === 7) return mode === 'overflow' ? 1 : 0;
    return 0;
  }});
  const broker = RPC.createMainBroker(memory, host, sigs);
  const productionHost = useLink === 'host' ? new GuestThreadHost({ memory, sigs, hostImports: host,
    drakanModuleBytes: bytes, workerUrl: path.join(ROOT, 'lib/guest-worker.js'), clockIntervalMs: 0 }) : null;
  const hostReady = productionHost?.start();
  const link = productionHost ? productionHost.link : useLink ? new WorkerLink({ memory, sigs, broker, slot: 0,
    drakanModuleBytes: bytes, workerUrl: path.join(ROOT, 'lib/guest-worker.js') }) : null;
  const linkReady = hostReady || link?.start();
  const worker = link ? link.worker : new Worker(path.join(ROOT, 'lib/guest-worker.js'));
  const request = link ? message => link._ask(message, 4000) : message => new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(Error('test request timeout')); }, 4000);
    pending.set(id, { resolve, reject, timer }); worker.postMessage({ ...message, seq: id });
  });
  const ready = new Promise((resolve, reject) => {
    worker.on('error', reject);
    worker.on('message', m => {
      if (['rpc','call','calls','clockAdvance'].includes(m.t)) {
        if (link) return;
        if (m.t === 'rpc') return broker.serveRpc(m.slot);
        if (m.t === 'call') return broker.serveCall(m);
        if (m.t === 'calls') return broker.serveCalls(m);
        return broker.serveClockAdvance(m.slot, m.tickMs);
      }
      events.push(m); controller?.accept(m);
      if (m.t === 'error' && m.stage === 'init') reject(Error(m.message));
      if (m.t === 'ready') resolve(m);
      const p = pending.get(m.seq);
      if (p) { clearTimeout(p.timer); pending.delete(m.seq); m.t === 'error' ? p.reject(Error(m.message)) : p.resolve(m); }
    });
  });
  try {
    const initBytes = Buffer.from(bytes);
    if (mode === 'wrong-module') initBytes[100] ^= 1;
    if (!link) worker.postMessage({ t: 'init', endpointIdentity: 2105, slot: 0, memory, sigs,
      // A supplied unrelated Module must neither replace verified bytes nor rescue wrong ones.
      module: new WebAssembly.Module(Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0)),
      drakanModuleBytes: initBytes });
    await (linkReady || ready);
    const invoke = (name, ...args) => request({ t: 'callExport', name, args });
    const exe = fs.readFileSync(path.join(ROOT, 'test/binaries/notepad.exe'));
    f.mem.set(exe, f.e.get_staging()); await invoke('load_pe', exe.length);
    await invoke('set_api_log', 0); await invoke('set_process_id', 1000);
    await invoke('init_dx_com_thunks'); await invoke('seal_thunks');
    for (const [at, b] of saved) f.mem.set(b, at);
    for (const pin of Object.values(pins)) f.mem.fill(0, f.wa(pin.address), f.wa(pin.address) + pin.bytes.length);
    for (const [a, b] of f.writes) f.mem.set(b, f.wa(a));
    await invoke('set_eip', 0x407a95); await invoke('set_esp', F.STACK);
    const pid = Atomics.load(new Int32Array(memory.buffer), regions.BASE.SHARED_PROCESS_ID >>> 2) >>> 0;
    const epoch = Number(Atomics.load(new BigUint64Array(memory.buffer), (regions.BASE.CALLBACK_OWNERSHIP + 8) >>> 3));
    const endpoint = link ? link.endpointIdentity : 2105;
    const owner = { worker: String(endpoint), endpoint, slot: 0, process: pid, epoch, moduleSha256: MODULE_SHA };
    if (!link) controller = new Controller({ owner, timestamp: F.STAMP, maxMs: 1700, worker, releaseT: () => { released++; } });
    const options = { base: F.B, object: F.OBJ, actor: F.ACTOR, keyboardDevice: regions.BASE.DX_OBJECTS, pins };
    await mutate({ controller, options, owner, f, request, link });
    let start;
    try {
      lifecycle.actionStartedAt = performance.timeOrigin + performance.now() - (lifecycle.age || 0);
      start = link ? await (lifecycle.observe || (productionHost || link).observeDrakanActor).call(productionHost || link, { ...options, timestamp: F.STAMP,
        actionStartedAt: lifecycle.actionStartedAt,
        maxMs: lifecycle.maxMs || 1700,
        releaseT: () => { released++; return lifecycle.release?.(); } })
        : await controller.observe(request, options);
    } catch (error) {
      controller = link?.drakanController || controller;
      if (!lifecycle.setupError) throw error;
      await lifecycle.setupError({ error, controller, link, request });
      assert.equal(released, 1);
      assert.equal(consumedCalls, 0);
      assert.equal(events.filter(m => m.t === 'drakanObserverComplete').length, 0);
      return;
    }
    if (link) controller = start.controller;
    let result = start.result;
    if (lifecycle.afterStart) {
      await lifecycle.afterStart({ controller, link, request, productionHost });
      assert.equal(consumedCalls, 0, 'release tests issue no guest action or replay');
      assert.equal(events.filter(m => m.t === 'drakanObserverComplete').length, 0);
      return;
    }
    if (mode === 'deadline') {
      // Keep ordinary WASM busy without calls/imports. Controller release must
      // happen independently, before that same production slice returns.
      let returned = false, releasedWhileBusy = false, releaseAt;
      const busyStarted = controller.clock();
      const release = controller.releaseT;
      controller.releaseT = () => { releasedWhileBusy = !returned; releaseAt = controller.clock(); release(); };
      const busy = request({ t: 'slice', steps: 10000000 }).then(r => { returned = true; return r; });
      await busy;
      result = (await request({ t: 'drakanObserver', action: 'status' })).result;
      assert.equal(releasedWhileBusy, true); assert.equal(released, 1);
      assert(releaseAt - busyStarted <= 2000);
      console.log(JSON.stringify({ independentReleaseMs: releaseAt - busyStarted, ordinarySliceStillBusy: true }));
      assert.equal(result.status, 'UNKNOWN');
    }
    for (let i = 0; i < 60 && result.status === 'PENDING'; i++) {
      if (productionHost) await productionHost.slice(1);
      else await request({ t: 'slice', steps: 1 });
      result = (await request({ t: 'drakanObserver', action: 'status' })).result;
      if (i === 59 && result.status === 'PENDING') controller.stop('test end without completion');
    }
    const completions = events.filter(m => m.t === 'drakanObserverComplete');
    if (!mode) {
      assert.equal(result.status, 'COMPLETE', JSON.stringify({result, events: events.filter(m => /drakan|error/.test(m.t))})); assert.equal(result.stage, 12);
      assert.equal(completions.length, 1); assert(controller.completed); assert.equal(released, 0);
      assert.equal(consumedCalls, 1); assert(result.consume.drainEsp);
      await request({ t: 'slice', steps: 1 });
      assert.equal(events.filter(m => m.t === 'drakanObserverComplete').length, 1);
    } else assert.equal(completions.length, 0, mode);
    assert(events.filter(m => m.t === 'drakanObserverUnknown').length <= 1, 'UNKNOWN notification at most once');
    return { result, events, get released() { return released; } };
  } finally {
    controller?.stop('fixture cleanup');
    if (controller) assert.equal(released, 1, 'every exit releases exactly once');
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(Error('fixture closed')); }
    if (productionHost) await productionHost.stop(); else if (link) await link.stop(); else await worker.terminate();
  }
}

const turn = () => new Promise(resolve => setImmediate(resolve));
async function releaseCase(outcome, trigger, useLink) {
  const sentinel = Error('physical release ' + outcome);
  let resolve, reject, calls = 0, physicalSettled = false, releaseAt;
  const original = new Promise((yes, no) => { resolve = yes; reject = no; });
  // The throwing case has no asynchronous operation to settle.
  if (outcome === 'throw') resolve();
  const release = () => {
    calls++;
    releaseAt = performance.timeOrigin + performance.now();
    if (outcome === 'throw') throw sentinel;
    if (outcome === 'reject-early') setTimeout(() => { physicalSettled = true; reject(sentinel); }, 5);
    return original;
  };
  const verify = async (controller, promise) => {
    assert.equal(typeof promise?.then, 'function', 'every release exposes a completion Promise across realms');
    if (controller) {
      assert.equal(controller.stop('duplicate stop'), promise);
      assert.equal(controller.stop('duplicate stop again'), promise);
      assert.equal(controller.completed, undefined);
      const control = readControl(controller.buffer);
      assert.equal(control.downActive, false);
      assert.equal(control.unknown, true, 'cleared action is UNKNOWN, not a released-input receipt');
      const first = controller.releaseT();
      assert.equal(controller.releaseT(), first, 'wrapper reuses cached result');
      if (outcome !== 'throw') assert.equal(first, original, 'original Promise preserved');
    }
    let settled = false;
    promise.then(() => { settled = true; });
    await turn();
    if (outcome === 'reject-early') {
      assert.equal(settled, true, 'setup joins release that already rejected during dependency loading');
      assert.equal(physicalSettled, true);
    } else if (outcome !== 'throw') {
      assert.equal(settled, false, 'release completion must wait for physical callback');
      assert.equal(physicalSettled, false);
      physicalSettled = true;
      if (outcome === 'reject') reject(sentinel); else resolve('physical up acknowledged');
    }
    await promise;
    await turn();
    assert.equal(calls, 1);
  };
  const lifecycle = { release, maxMs: trigger === 'deadline' ? 300 : 1700, age: trigger === 'deadline' ? 100 : 0 };
  if (trigger === 'loading-deadline') {
    // Execute the unchanged browser WorkerLink method on the actual live Node
    // WorkerLink. Only dependency loading is delayed; no Worker is simulated.
    const self = { GuestRpc: RPC, processBoot: require('../lib/process-boot'),
      ThreadSendWaits: require('../lib/thread-send-waits'), RegionMap: regions,
      DrakanObserverWorker: require('../lib/drakan-observer-worker') };
    const context = vm.createContext({ self, performance, URL, setTimeout, clearTimeout,
      document: { baseURI: require('node:url').pathToFileURL(ROOT + '/').href } });
    const script = new vm.Script(fs.readFileSync(require.resolve('../lib/guest-thread-host'), 'utf8'), {
      filename: require.resolve('../lib/guest-thread-host'),
      importModuleDynamically: async url => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return import(url);
      },
    });
    script.runInContext(context);
    lifecycle.observe = self.GuestWorkerLink.prototype.observeDrakanActor;
    lifecycle.maxMs = 60; lifecycle.age = 20;
  }
  if (['setup', 'expired', 'unavailable', 'constructor', 'loading-deadline'].includes(trigger)) {
    if (trigger === 'expired') lifecycle.age = 3000;
    if (trigger === 'constructor') lifecycle.maxMs = 2001;
    lifecycle.setupError = async ({ error, controller }) => {
      assert.match(error.message, /actual keyboard device|fresh original action|unavailable|configuration|released.*during setup/);
      if (trigger === 'loading-deadline') {
        assert(!controller, 'setup expiry never rearms down in a new Controller');
        const initiationMs = releaseAt - lifecycle.actionStartedAt;
        assert(initiationMs < 300 && initiationMs >= 20, 'original setup deadline independently initiates release');
        console.log(JSON.stringify({ setupReleaseInitiationMs: initiationMs, controllerCreated: false, outcome }));
      }
      await verify(controller, error.releasePromise);
      assert.equal(error.releaseError, outcome === 'success' ? null : String(sentinel));
      if (controller) assert.equal(controller.releaseError || null, error.releaseError);
    };
  } else lifecycle.afterStart = async ({ controller, link, request }) => {
    assert.equal(controller.deadline, lifecycle.actionStartedAt + lifecycle.maxMs);
    if (trigger === 'deadline') {
      const started = controller.deadline - 300;
      assert(controller.clock() - started >= 100, 'original action start retained');
      while (!controller.stopped && controller.clock() < started + 1000)
        await new Promise(resolve => setTimeout(resolve, 5));
      assert(controller.stopped, 'independent deadline initiates release');
      assert(controller.clock() - started < 1000, 'deadline not restarted at setup');
    } else if (trigger === 'retirement') link._beginRetiring();
    else controller.stop('explicit stop');
    await verify(controller, controller.releasePromise);
    assert.equal(controller.releaseError || null, outcome === 'success' ? null : String(sentinel));
    if (trigger !== 'retirement') {
      await assert.rejects(request({ t: 'drakanObserver', action: 'start' }), /already used/);
      assert.equal(readControl(controller.buffer).downActive, false, 'duplicate start cannot rearm down');
      assert.equal(calls, 1, 'rearm refusal cannot replay release');
    }
  };
  await workerCase('release-lifecycle', ({ options, link }) => {
    if (trigger === 'setup') options.keyboardDevice += 32;
    if (trigger === 'unavailable') link.drakanModuleBytes = null;
  }, useLink, lifecycle);
  pass(`actual ${useLink === 'host' ? 'GuestThreadHost' : 'WorkerLink'} ${trigger} ${outcome}: physical settlement, error, exact once and duplicate stops`);
}

(async () => {
  const unhandled = [];
  const onUnhandled = e => unhandled.push(String(e));
  process.on('unhandledRejection', onUnhandled);
  if (process.env.WINE_DRAKAN_RELEASE_REPRO === '1') {
    for (const outcome of ['success', 'reject']) {
      let settle, physical = false;
      const original = new Promise((yes, no) => { settle = outcome === 'success' ? yes : no; });
      await workerCase('release-reproduction', () => {}, 'host', {
        release: () => original,
        afterStart: async ({ controller }) => {
          const p = controller.stop('reproduce dropped async release');
          let settled = false; p.then(() => { settled = true; });
          await turn();
          console.log(JSON.stringify({ reproduction: outcome, releasePromiseSettledBeforePhysical: settled && !physical }));
          physical = true; settle(outcome === 'success' ? 'physical up' : Error('delayed physical release rejection'));
          await turn(); await turn();
          console.log(JSON.stringify({ releaseError: controller.releaseError || null, unhandled: [...unhandled] }));
        },
      });
    }
    process.off('unhandledRejection', onUnhandled);
    return;
  }
  assert.equal(await verifiedModuleSha256(bytes), MODULE_SHA);
  const browser = { self: {}, crypto: require('node:crypto').webcrypto, Uint8Array };
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/drakan-passive-actor-observer'), 'utf8'), browser);
  assert.equal(await browser.self.DrakanActorObserver.sha256(bytes), MODULE_SHA);
  browser.self.RegionMap = regions;
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/drakan-observer-worker'), 'utf8'), browser);
  assert.equal(await browser.self.DrakanObserverWorker.verifiedModuleSha256(bytes), MODULE_SHA);
  const wrongBrowserBytes = Uint8Array.from(bytes); wrongBrowserBytes[100] ^= 1;
  await assert.rejects(browser.self.DrakanObserverWorker.verifiedModuleSha256(wrongBrowserBytes), /Drakan module identity/);
  pass('browser-safe adapter and Worker admission agree on exact bytes; altered bytes refused without Chrome');
  const media = path.join(ROOT, 'test/binaries/win98-games-a-d/DrakanOrderOfTheFlameDemoD3D-installed/drakan demo');
  const exe = fs.readFileSync(path.join(media, 'drakan.exe')), rfl = fs.readFileSync(path.join(media, 'dragon.rfl'));
  const pins = await installedPins(exe, rfl, F.B);
  assert.equal(pins.actor.address, F.B + 0x4c310); assert.equal(pins.state1.bytes.length, 0x4e6f5 - 0x4da10);
  const bad = Buffer.from(rfl); bad[200] ^= 1;
  await assert.rejects(installedPins(exe, bad, F.B), /media identity/);
  pass('independent installed PE/RFL hashes and relocated pins; changed media refused');
  await workerCase(); pass('production Worker ordinary slices, real GetDeviceData, exact active state1 and enclosing returns before release; notification once');
  await workerCase('', () => {}, true); pass('actual WorkerLink start/controller/import/run/retirement integration');
  await workerCase('', () => {}, 'host'); pass('actual GuestThreadHost opt-in, controller, ordinary slice and stop integration');
  await assert.rejects(workerCase('wrong-module'), /Drakan module identity/);
  pass('actual production Worker rejects wrong module before instantiation');
  await workerCase('installed-pins', ({ options }) => { options.exe = exe; options.rfl = rfl; });
  pass('controller derives authenticated installed pins; synthetic live code cannot pass original pins');
  for (const mode of ['same-drain','overflow','no-consume','skip-drain','skip-sim','early-actor','wrong-event','wrong-actor','release-in-state','wrong-timestamp','forged-return','buffer-throw']) {
    await workerCase(mode); pass('production Worker refuses ' + mode);
  }
  for (const [name, mutate] of [
    ['wrong module owner', ({ controller }) => { controller.owner = { ...controller.owner, moduleSha256:
      MODULE_SHA === '4b45bda53a90b665896cf3b85d9a157b7c3703563c88b6666e4ee2e4b346bcc3'
        ? 'a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295'
        : '4b45bda53a90b665896cf3b85d9a157b7c3703563c88b6666e4ee2e4b346bcc3' }; }],
    ['wrong owner', ({ controller }) => { controller.owner = { ...controller.owner, process: 2000 }; }],
    ['wrong pins', ({ options }) => { options.pins.actor.bytes[0] ^= 1; }],
    ['wrong device', ({ options }) => { options.keyboardDevice += 32; }],
    ['stale controller', ({ controller }) => { clearInterval(controller.heartbeat); controller.d[4] -= 100; }],
    ['future controller', ({ controller }) => { clearInterval(controller.heartbeat); controller.d[4] += 5000; }],
    ['expired deadline', ({ controller }) => { clearInterval(controller.heartbeat); controller.d[5] = controller.clock() - 1; }],
    ['wrong epoch', ({ controller }) => { controller.owner = { ...controller.owner, epoch: controller.owner.epoch + 1 }; }],
    ['wrong drain pins', ({ options }) => { options.pins.drain.bytes[0] ^= 1; }],
    ['release', ({ controller }) => controller.stop('early release')],
    ['UNKNOWN', ({ controller }) => { controller.w[3] = 1; }],
  ]) {
    try { const r = await workerCase(name, mutate); assert.notEqual(r.result.status, 'COMPLETE'); }
    catch (e) { if (!/actual .*owner|actual keyboard device|controller deadline/.test(e.message)) throw e; }
    pass('production Worker ' + name + ' releases input');
  }
  await workerCase('deadline', ({ controller, f, options }) => {
    controller.deadline = controller.clock() + 30; controller.publish(true, false);
    f.mem.set([0xeb, 0xfe], f.wa(0x407a95)); options.pins.frame.bytes.set([0xeb, 0xfe]);
  }); pass('independent <=2000ms release during a busy ordinary production Worker slice');
  let release = 0;
  const c = new Controller({ owner: {}, timestamp: 1, maxMs: 30, releaseT: () => release++ });
  const first = readControl(c.buffer).observedAt;
  await new Promise(resolve => setTimeout(resolve, 15));
  assert(readControl(c.buffer).observedAt > first);
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(release, 1); assert.equal(readControl(c.buffer).downActive, false);
  c.stop(); assert.equal(release, 1); pass('independent fresh controller samples and idle deadline release exactly once');
  let failedRelease = 0;
  const c2 = new Controller({ owner: {}, timestamp: 1, releaseT: () => failedRelease++ });
  await assert.rejects(c2.observe(async () => { throw Error('transport failure'); }, {}), /transport failure/);
  assert.equal(failedRelease, 1); c2.stop(); assert.equal(failedRelease, 1);
  pass('controller transport failure releases exactly once');
  const link = new WorkerLink({ slot: 0 });
  await assert.rejects(link.observeDrakanActor({ actionStartedAt: 0, releaseT: () => failedRelease++ }), /fresh original action/);
  assert.equal(failedRelease, 2); pass('parent setup/late action failure releases once without a Worker');
  for (const trigger of ['stop', 'deadline', 'retirement', 'setup', 'expired', 'unavailable', 'constructor'])
    for (const outcome of ['success', 'reject', 'throw'])
      await releaseCase(outcome, trigger, outcome === 'reject' ? 'host' : true);
  if (process.env.WINE_DRAKAN_BROWSER_SETUP === '1')
    for (const outcome of ['success', 'reject', 'throw', 'reject-early']) await releaseCase(outcome, 'loading-deadline', true);
  await turn(); await turn();
  assert.deepEqual(unhandled, [], 'no asynchronous release rejection escapes the actual host path');
  process.off('unhandledRejection', onUnhandled);
  pass('no unhandled release rejection across all actual WorkerLink/GuestThreadHost lifecycle cases');
  console.log(JSON.stringify({ checks, moduleSha256: MODULE_SHA, productionWorker: true, syntheticGuest: true, original: false }));
})().catch(e => { console.error(e); process.exitCode = 1; });
