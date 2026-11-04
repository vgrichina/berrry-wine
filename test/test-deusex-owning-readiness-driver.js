'use strict';
// Node production Worker/module tests plus explicitly synthetic page transport.
// No game, Chrome, guest slices, Draw, or lifecycle API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Worker, MessageChannel, isMainThread, workerData } = require('node:worker_threads');
const tool = require('../tools/deusex-owning-readiness-driver.cjs');
const cache = require('../tools/deusex-natural-bound-cache-driver.cjs');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'scratch/runs/20261104-deusex-complete-driver-input-preflight/next-driver-fixed.cjs';
const inspector = tool.read(path.join(ROOT, path.dirname(BASE), 'owner-inspect.cjs')).toString();
if (!isMainThread) {
  const Module = require('node:module'), filename = path.join(ROOT, 'lib/guest-worker.js');
  // Browser importScripts publishes this exact production helper globally;
  // Node production loads its API under a module-local name instead.
  globalThis.DeusExDrawObserver = require('../lib/deusex-draw-observer.js');
  const entry = new Module(filename, module); entry.filename = filename; entry.paths = module.paths;
  entry._compile(fs.readFileSync(filename, 'utf8') + `
    require('node:worker_threads').workerData.port.on('message',async request=>{
      try { const value=await eval(request.code); require('node:worker_threads').workerData.port.postMessage({id:request.id,value}); }
      catch(e){require('node:worker_threads').workerData.port.postMessage({id:request.id,error:e.message});}
    });`, filename);
} else (async () => {
  const body = tool.check(BASE);
  const closure = tool.helperClosure();
  assert.equal(closure.helpers.length, 20);
  // Run the retained server's actual request handler without opening a socket.
  // A marked Worker URL serves the same pinned bytes; it cannot select a
  // different source file or alter the deploy-version import parameter.
  const serverPath = path.join(ROOT, 'scratch/runs/20261104-deusex-natural-bound-cache/corrected/server.cjs');
  const workerBytes = fs.readFileSync(path.join(ROOT, 'lib/guest-worker.js'));
  const sha = require('node:crypto').createHash('sha256').update(workerBytes).digest('hex');
  const server = require(serverPath).makeServer(ROOT, { 'lib/guest-worker.js': { sha256: sha } }, () => {});
  let status, served;
  server.emit('request', { url: '/lib/guest-worker.js?v=dev&__deusex_readiness=fixture%3A1' },
    { writeHead(code) { status = code; }, end(bytes) { served = bytes; } });
  assert.equal(status, 200); assert.deepEqual(served, workerBytes);
  const workerSource = workerBytes.toString();
  const versionCode = workerSource.slice(workerSource.indexOf('const SOURCE_VERSION'), workerSource.indexOf('\nif (IS_WEB_WORKER)'));
  const importURL = vm.runInNewContext(versionCode + ';versionedWorkerUrl("guest-rpc.js")',
    { IS_WEB_WORKER: true, URL, self: { location: { href: 'http://127.0.0.1:8123/lib/guest-worker.js?v=dev&__deusex_readiness=fixture%3A1' } } });
  assert.equal(importURL, 'guest-rpc.js?v=dev');
  assert.throws(() => tool.transform(tool.read(BASE).toString() + '\n'), /actual driver SHA/);
  assert(body.indexOf('page.evaluate(installSelection)') < body.indexOf("page.click('button"));
  assert(body.includes('const selectedOwner=await selectOwner(page,bounded)'));
  // Byte-for-byte preservation of the natural observation/capture/finally body.
  const old = cache.transform(tool.read(BASE).toString());
  assert.equal(body.slice(body.indexOf("write('readiness-met.json'")), old.slice(old.indexOf("write('readiness-met.json'")));
  assert(body.includes('start+8*60*1000'));
  assert(body.indexOf("write('raw-surfaces.json'") < body.indexOf('const png=await page.evaluate'));
  const results = [];
  for (const variant of ['wine-assembly.wasm', 'wine-assembly.compat.wasm']) {
    const module = await WebAssembly.compile(fs.readFileSync(path.join(ROOT, 'build', variant)));
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    const live = [];
    class PageWorker {
      constructor(url) {
        this.address = new URL(url, 'http://127.0.0.1:8123/').href;
        this.listeners = {}; this.requests = new Map(); this.seq = 0; this.posts = [];
        const { port1, port2 } = new MessageChannel(); this.port = port1;
        this.node = new Worker(__filename, { workerData: { port: port2 }, transferList: [port2] });
        port1.on('message', m => {
          const p = this.requests.get(m.id); this.requests.delete(m.id);
          if (m.error) p.reject(Error(m.error)); else p.resolve(m.value);
        });
        this.node.on('message', data => this.emit('message', { data }));
        this.node.on('error', error => this.emit('error', error));
        live.push(this);
      }
      url() { return this.address; }
      addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
      emit(name, event) { for (const fn of this.listeners[name] || []) fn(event); }
      postMessage(message, ...args) { this.posts.push(message); this.node.postMessage(message, ...args); return 71; }
      evaluate(fn) { return this.code('(' + fn.toString() + ')()'); }
      code(code) { return new Promise((resolve, reject) => { const id = ++this.seq; this.requests.set(id, { resolve, reject }); this.port.postMessage({ id, code }); }); }
      until(type) { return new Promise(resolve => this.addEventListener('message', e => { if (e.data.t === type) resolve(e.data); })); }
    }
    const context = vm.createContext({ Worker: PageWorker, URL, crypto: { randomUUID: () => 'fixture-session' }, location: { href: 'http://127.0.0.1:8123/index.html' } });
    const evaluate = (fn, arg) => { context.argument = arg; return vm.runInContext('(' + fn.toString() + ')(argument)', context); };
    evaluate(cache.installFirstInit); evaluate(tool.installSelection);
    assert.throws(() => evaluate(tool.installSelection), /already installed/);
    const C = context.Worker;
    const page = { evaluate, workers: () => live };
    let owner;
    const init = (worker, slot, endpointIdentity) => {
      const message = { t: 'init', slot, endpointIdentity, module, memory, sigs: require('../lib/host-import-sigs.generated.json').sigs };
      assert.equal(worker.postMessage(message), 71);
      return message;
    };
    try {
      await assert.rejects(tool.selectOwner(page), /init\/link missing/);
      owner = new C('/lib/guest-worker.js?v=dev');
      const ownerReady = owner.until('ready');
      const message = init(owner, 0, 81);
      const link = context.wine = { guestWorker: { link: { worker: owner, slot: 0, endpointIdentity: 81, module, memory } } };
      // Page delivery held synthetically: production Worker may instantiate at
      // any time; selection must wait for the actual ready message's delivery.
      assert.equal(await tool.selectOwner(page), null);
      await ownerReady;
      assert.equal(context.__deusexCacheInit.owningInits, 1);
      assert.equal(message.cacheObservation.limits.maxBoundaries, 1000000);
      assert.equal(message.cacheObservation.limits.maxRecords, 256);
      assert.equal(message.cacheObservation.limits.maxMs, 10000);
      // Controlled fixture only: boot normally sets the main thread before
      // readiness. No guest run or game is loaded by this test.
      await owner.code('instance.exports.set_current_thread_id(1)');
      const absentForeign = new C('/lib/guest-worker.js?v=dev');
      // Any evaluation of the independently marked foreign target is a test
      // failure, including while its production init is actually in flight.
      absentForeign.evaluate = () => { throw Error('FOREIGN_TARGET_EVALUATED'); };
      assert.notEqual(owner.url(), absentForeign.url());
      assert.equal(new URL(owner.url()).searchParams.get('v'), 'dev');
      assert.equal(await tool.selectOwner(page), owner);
      const read = async () => {
        const selected = await tool.selectOwner(page);
        return selected.code('(()=>{' + inspector + ';return inspect();})()');
      };
      const sample = await read();
      assert.equal(sample.slot, 0); assert.equal(sample.thread, 1); assert.equal(sample.engine, null);
      // Execute the actual transformed boot loop, including its unchanged
      // inspector and readiness call sites. Only page/clock/host observations
      // are synthetic; the inspector executes in the production Worker.
      const loopBody = body.slice(body.indexOf('const bootEnd='), body.indexOf('\n if(!started)'));
      const runLoop = async () => {
        let clock = 0;
        return new (Object.getPrototypeOf(async function() {}).constructor)(
          'page','selectOwner','inspect','bounded','append','guard','launchFailure','write','pause',
          'nativeReadiness','hostProgress','ready','Date','EXPECTED_EXE',
          'let owner=null,started=false;const deadline=125010;' + loopBody + ';return {owner,started,latest};'
        )({ ...page, evaluate: fn => fn.toString().includes('isolated:crossOriginIsolated')
            ? { owning: true, isolated: true, threads: true, log: '' }
            : fn.toString().includes('_exeUrl') ? 'fixture.exe' : evaluate(fn) },
          tool.selectOwner, vm.runInNewContext('(()=>{' + inspector + ';return inspect;})()', { module: { exports: {} } }),
          p => p, () => {}, () => {}, () => false, () => {}, async () => {},
          function nativeReadiness() { return { fixture: true }; },
          function hostProgress() { return { fixture: true }; }, () => false,
          class extends Date { static now() { return clock++ ? 100 : 0; } }, 'fixture.exe');
      };
      const loop = await runLoop();
      assert.equal(loop.owner, owner); assert.equal(loop.started, false);
      assert.equal(loop.latest.engine, null);
      await owner.code('instance.exports.set_current_thread_id(2)');
      await assert.rejects(runLoop(), /selected owning instance slot\/thread mismatch/);
      await owner.code('instance.exports.set_current_thread_id(1)');
      await owner.code("globalThis.fixtureResolve=DeusExDrawObserver.OwningDrawObserver.prototype.resolveModule;DeusExDrawObserver.OwningDrawObserver.prototype.resolveModule=function(){throw Error('EXACT_INSPECTOR_FAULT')};void 0");
      await assert.rejects(runLoop(), /EXACT_INSPECTOR_FAULT/);
      await owner.code('DeusExDrawObserver.OwningDrawObserver.prototype.resolveModule=globalThis.fixtureResolve;void 0');
      // Actually schedule foreign init concurrently with owner selection. The
      // foreign target never runs the inherited inspector, before or after init.
      const foreignReady = absentForeign.until('ready');
      init(absentForeign, 1, 82);
      assert.equal((await read()).thread, 1);
      await foreignReady;
      assert.equal((await read()).thread, 1);
      await absentForeign.code('instance=null');
      assert.equal((await read()).thread, 1);
      let seq = 90;
      link.guestWorker.link._ask = async command => {
        command.seq = ++seq;
        const answer = owner.until('cacheObservationResult');
        owner.postMessage(command);
        return answer;
      };
      const status = await evaluate(cache.cacheCommand, 'status');
      assert.equal(status.response, context.__deusexCacheInit.responses.at(-1));
      const stop = await evaluate(cache.cacheCommand, 'stop');
      assert.equal(stop.response, context.__deusexCacheInit.responses.at(-1));
      assert.equal(stop.response.seq, 92);
      // Missing, ambiguous, stale session/target/module/slot and owner fault
      // negatives. Every rejection is terminal; the test explicitly restores
      // controlled fixture state between independent cases.
      const savedWorkers = page.workers;
      page.workers = () => [absentForeign];
      await assert.rejects(read(), /missing or ambiguous/);
      page.workers = () => [owner, owner];
      await assert.rejects(read(), /missing or ambiguous/);
      page.workers = savedWorkers;
      const replacement = { url: () => owner.url(), evaluate: fn => owner.evaluate(fn) };
      page.workers = () => [replacement, absentForeign];
      await assert.rejects(read(), /stale owning target\/session/);
      page.workers = savedWorkers;
      const ownerLink = link.guestWorker.link;
      ownerLink.module = {};
      await assert.rejects(read(), /stale owning link/); ownerLink.module = module;
      ownerLink.slot = 1;
      await assert.rejects(read(), /stale owning link/); ownerLink.slot = 0;
      ownerLink.endpointIdentity = 82;
      await assert.rejects(read(), /stale owning link/); ownerLink.endpointIdentity = 81;
      const session = context.__deusexReadiness.session;
      context.__deusexReadiness.session = 'stale-session';
      await assert.rejects(read(), /stale owning session/); context.__deusexReadiness.session = session;
      await owner.code('endpointIdentity=82');
      await assert.rejects(read(), /wrong owning endpoint instance/); await owner.code('endpointIdentity=81');
      await owner.code('workerSlot=1');
      await assert.rejects(read(), /wrong owning slot/); await owner.code('workerSlot=0');
      const originalAddress = owner.address; owner.address += '&stale=1';
      await assert.rejects(read(), /missing or ambiguous owning target/); owner.address = originalAddress;
      await owner.code('globalThis.fixtureInstance=instance;instance={exports:{memory:{}}};void 0');
      await assert.rejects(read(), /wrong owning instance memory/);
      await owner.code('instance=globalThis.fixtureInstance;void 0');
      await owner.code('instance=null');
      await assert.rejects(read(), /owning Worker instance absent after ready/);
      owner.emit('message', { data: { t: 'error', message: 'FIRST_OWNER_FAILURE' } });
      owner.emit('error', { message: 'LATER_OWNER_FAILURE' });
      await assert.rejects(read(), /FIRST_OWNER_FAILURE/);
      assert.throws(() => init(owner, 0, 83), /FIRST_OWNER_FAILURE/);
      assert.equal(owner.posts.filter(m => m.t === 'init').length, 1);
      assert.deepEqual(owner.posts.map(m => m.t), ['init', 'cacheObservation', 'cacheObservation']);
      assert.deepEqual(absentForeign.posts.map(m => m.t), ['init']);
      // Actual production init failure before ready, independently of the
      // synthetic fault delivery above. The first error text survives intact.
      const failedContext = vm.createContext({ Worker: PageWorker, URL, crypto: { randomUUID: () => 'failed-session' }, location: { href: 'http://127.0.0.1:8123/' } });
      const failedEvaluate = fn => vm.runInContext('(' + fn.toString() + ')()', failedContext);
      failedEvaluate(tool.installSelection);
      const failed = new failedContext.Worker('/lib/guest-worker.js?v=dev');
      const failure = failed.until('error');
      const invalidModule = {};
      failedContext.wine = { guestWorker: { link: { worker: failed, slot: 0, endpointIdentity: 91, module: invalidModule, memory } } };
      failed.postMessage({ t: 'init', slot: 0, endpointIdentity: 91, module: invalidModule, memory,
        sigs: require('../lib/host-import-sigs.generated.json').sigs });
      const actualFailure = await failure;
      await assert.rejects(tool.selectOwner({ evaluate: failedEvaluate, workers: () => [failed] }),
        error => error.message === actualFailure.message);
      assert.equal(failedContext.__deusexReadiness.owner.ready, null);
      results.push({ variant, sample: { slot: sample.slot, thread: sample.thread, engine: sample.engine },
        commands: owner.posts.map(m => ({ t: m.t, action: m.action, seq: m.seq })),
        status: status.response, stop: stop.response, syntheticPageTransport: true, gameProof: false });
    } finally { await Promise.all(live.map(async w => { w.port.close(); await w.node.terminate(); })); }
  }
  // Synthetic constructor/transport identity fixtures, no production instance.
  class Dummy {
    constructor() { this.posts = []; }
    postMessage(...args) { this.posts.push(args); return 37; }
    addEventListener() {}
  }
  for (const kind of ['duplicate-owner', 'duplicate-endpoint', 'reinit', 'premarked']) {
    const c = vm.createContext({ Worker: Dummy, URL, crypto: { randomUUID: () => kind }, location: { href: 'http://localhost/' } });
    vm.runInContext('(' + tool.installSelection + ')()', c);
    if (kind === 'premarked') {
      assert.throws(() => new c.Worker('/lib/guest-worker.js?__deusex_readiness=old'), /premarked/); continue;
    }
    const first = new c.Worker('/lib/guest-worker.js');
    const init = { t: 'init', slot: 0, endpointIdentity: 1, module: {}, memory: {} }, transfer = [];
    assert.equal(first.postMessage(init, transfer), 37);
    assert.equal(first.posts[0][0], init); assert.equal(first.posts[0][1], transfer);
    if (kind === 'reinit') assert.throws(() => first.postMessage(init), /instance replacement/);
    else {
      const second = new c.Worker('/lib/guest-worker.js');
      assert.throws(() => second.postMessage({ ...init, slot: kind === 'duplicate-owner' ? 0 : 1,
        endpointIdentity: kind === 'duplicate-owner' ? 2 : 1 }), /ambiguous/);
      assert.equal(second.posts.length, 0);
    }
  }
  const out = process.env.DEUSEX_READINESS_TEST_OUTPUT;
  if (out) fs.writeFileSync(out, JSON.stringify({ pass: true, results }, null, 2));
  console.log('PASS exact composition, production Worker both modules, original inspector, initial/foreign startup, owner selection and terminal negatives; queued status/stop identity; unchanged natural tail/bounds/raw-before-PNG. Synthetic page fixture, no game proof.');
})().catch(error => { console.error(error); process.exitCode = 1; });
