'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict'), Module = require('module'), path = require('path');
const realLoader = require('../lib/dll-loader'), dir = path.resolve(__dirname, '..');
const hostSource = fs.readFileSync(dir + '/lib/guest-thread-host.js', 'utf8'), workerSource = fs.readFileSync(dir + '/lib/guest-worker.js', 'utf8');
const hostModule = new Module(path.resolve('lib/guest-thread-host.js'));
hostModule.filename = path.resolve('lib/guest-thread-host.js');
hostModule.paths = module.paths;
hostModule._compile(hostSource, hostModule.filename);
const { WorkerLink } = hostModule.exports;
const shared = {
  buffer: new SharedArrayBuffer(0x20000)
}, shadow = {
  esp: 0, run(){
    throw Error('Page shadow must never execute');
  }
};
let shadowCalls = 0;
const tick = () => new Promise(r => setImmediate(r));
function owner(id, resolve, options = {}) {
  const base = 0x400000, initialEsp = base + 0x8000 + id*0x2000, nameWA = 0x1000 + id*0x100, regs = {
    eip: base + 0x123, esp: initialEsp, eax: 0xaaaa, ecx: 0xbbbb, edx: 0xcccc
  };
  let keep = options.keepRegs ? 1: 0, yieldReason = 5, halt = 4;
  const events = [], timers = new Set(), timerCallbacks = new Map(), outbound = [];
  let context, link, dead = false;
  const name = n => {
    new Uint8Array(shared.buffer).fill(0, nameWA, nameWA + 260);
    new Uint8Array(shared.buffer).set(Buffer.from(n + '\0'), nameWA);
  };
  const ex = {
    memory: shared, get_image_base: () => base, guest_to_wasm: p => p-base + 256, get_fs_base: () => 0, get_loadlib_name: () => nameWA, take_loadlib_keep_regs: () => {
      const k = keep;
      keep = 0;
      return k;
    }, get_yield_reason: () => yieldReason, get_last_run_halt: () => halt, clear_yield: () => {
      yieldReason = 0;
    }, get_sleep_yielded: () => 0, get_current_thread_id: () => id, mutateRender: () => events.push('render-event'), mutate: () => {
      events.push('unrelated-export');
      return 91;
    }, set_focus: () => events.push('unrelated-slice'), run(){
      assert.equal(this, ex);
      events.push('run:' + regs.eip.toString(16));
      if(regs.eip === base + 0x1000){
        regs.ecx = 11;
        regs.edx = 12;
        name(options.longName ? 'x'.repeat(260): 'middle.dll');
        regs.esp -= 8;
        regs.eip = base + 0x1001;
        yieldReason = 5;
        halt = 4;
        return;
      }
      if(regs.eip === base + 0x2000){
        if(options.throwNested)throw Error('nested initializer original fault');
        name(options.cycle ? 'middle.dll': 'leaf.dll');
        regs.esp -= 8;
        regs.eip = base + 0x2001;
        yieldReason = 5;
        halt = 4;
        return;
      }
      if([base + 0x1001, base + 0x2001].includes(regs.eip)){
        events.push('continued:' + regs.eip.toString(16) + ':' + regs.eax);
        regs.esp += 8;
      }
      regs.eip = 0;
      regs.esp += 16;
      regs.eax = 1;
      halt = 2;
      yieldReason = 0;
      return 37;
    }
  };
  for(const k of Object.keys(regs)){
    ex['get_' + k] = () => regs[k];
    ex['set_' + k] = v => {
      regs[k] = v>>>0;
    };
  }
  const loader = {
    ...realLoader,
    callDllMainAsync: options.before
      ? async (ex, base, entry, log, opts) => realLoader.callDllMain(ex, base, entry, log,
        { advanceGuestTime: opts.advanceGuestTime })
      : realLoader.callDllMainAsync,
    loadDll(owner, mem, bytes) {
      assert.equal(owner, ex);
      assert.equal(mem, shared.buffer);
      const n = bytes[0];
      events.push('load:' + n);
      return {
        loadAddr: base + n*0x10000, dllMain: base + n*0x1000
      };
    }, patchDllImports(owner){
      assert.equal(owner, ex);
      events.push('patch');
    }, resumeAfterLoadLibraryYield(owner){
      assert.equal(owner, ex);
      events.push('resume:' + regs.eax);
      return realLoader.resumeAfterLoadLibraryYield(owner, shared.buffer);
    }
  };
  const sandbox = {
    console, URL, Uint8Array, DataView, ArrayBuffer, SharedArrayBuffer, Atomics, Map, Set, Date, Promise, Error, performance, importScripts(){
    }, setTimeout(fn, ms){
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
      timerCallbacks.set(t, fn);
      return t;
    }, clearTimeout(t){
      timers.delete(t);
      timerCallbacks.delete(t);
      clearTimeout(t);
    }, queueMicrotask
  };
  sandbox.self = sandbox;
  sandbox.location = {
    href: 'http://local/lib/guest-worker.js?v=test'
  };
  sandbox.DllLoader = loader;
  sandbox.postMessage = msg => {
    outbound.push(msg);
    if ([].concat(options.outboundThrows || []).includes(msg.t)) throw Error('worker outbound ' + msg.t + ' failed');
    if(!dead)queueMicrotask(() => link._onMessage(msg));
  };
  context = vm.createContext(sandbox);
  vm.runInContext(workerSource + '\nself.testSet=(ex,mem)=>{instance={exports:ex};memory=mem;advanceGuestTime=()=>{};sharedRenderPort={onmessage:()=>ex.mutateRender()};};self.testDispatch=handleMessage;self.testState=()=>({pending:typeof dynamicLoadReplies==="undefined"?0:dynamicLoadReplies.size,queued:typeof dynamicLoadDeferred==="undefined"?0:dynamicLoadDeferred.length,active:typeof dynamicLoadTransaction==="undefined"?false:!!dynamicLoadTransaction});', context);
  sandbox.testSet(ex, shared);
  link = new WorkerLink({
    slot: id, memory: null, resolveDllBytes: resolve, log: () => {
    }
  });
  const transport = {
    postMessage(msg){
      if(options.replyThrows && msg.t === 'dynamicDllBytes')throw Error('reply transport failure');
      if(options.cancelThrows && msg.t === 'cancelDynamicLoad')throw Error('cancel transport failure');
      if(options.dropCancel && msg.t === 'cancelDeferredRequest')return;
      if(dead)throw Error('Worker stopped');
      queueMicrotask(() => sandbox.testDispatch(msg));
    }, terminate(){
      dead = true;
      for(const t of timers)clearTimeout(t);
      timers.clear();
    }
  };
  link.worker = transport;
  return {
    link, ex, events, regs, initialEsp, outbound,
    expireByteRequest() {
      assert.equal(timers.size, 1);
      const timer = [...timers][0];
      const callback = timerCallbacks.get(timer);
      sandbox.clearTimeout(timer);
      callback();
    }, state: sandbox.testState, dispatch: sandbox.testDispatch, load: (n = 1, timeout = 2000) => link._ask({
      t: 'loadLibrary', bytes: new Uint8Array([n]), fileName: 'outer.dll'
    }, timeout), stop: () => link.stop(), transport
  };
}
(async() => {
  // Negative control substitutes the original synchronous initializer contract using the real
  // loader. It resolves outer request without ever resuming the nested call.
  const old = owner(0, () => {
    throw Error('old branch unexpectedly resolved nested bytes');
  }, {
    before: true
  });
  await old.load();
  assert(!old.events.some(e => e.startsWith('continued:401001')));
  old.stop();
  for(const keepRegs of [false, true]){
    const before = owner(0, () => null, {
      before: true, keepRegs
    }), after = owner(0, () => null, {
      keepRegs
    });
    const a = await before.load(3), b = await after.load(3);
    assert.equal(a.loadAddr, b.loadAddr);
    assert.deepEqual(before.regs, after.regs);
    before.stop();
    after.stop();
  }
  const invalidName = owner(0, () => {
    throw Error('long name must not reach resolver');
  }, {
    longName: true
  });
  const invalid = await invalidName.load();
  assert(invalid.loaderErrors.some(e => e.includes('bounded terminator')));
  invalidName.stop();
  let release;
  const bytesReady = new Promise(r => release = r), requested = [];
  const a = owner(1, async name => {
    requested.push(name);
    if(name === 'middle.dll')await bytesReady;
    return {
      fileName: name, dllBytes: new Uint8Array([name === 'middle.dll' ? 2: 3])
    };
  }, {
    keepRegs: true
  });
  const outer = a.load();
  await tick();
  await tick();
  assert.deepEqual(requested, ['middle.dll']);
  await a.dispatch({
    t: 'dynamicDllBytes', transactionId: 9999, requestId: 1, bytes: new Uint8Array([3])
  });
  assert.equal(a.state().pending, 1);
  await a.dispatch({
    t: 'renderLegacyEvent', message: {
      t: 'frame'
    }
  });
  assert(a.events.includes('render-event'));
  const parkedEsp = a.regs.esp, queued = a.link.callExport('mutate');
  await tick();
  assert(!a.events.includes('unrelated-export'));
  assert.equal(a.regs.esp, parkedEsp);
  assert(a.state().active);
  assert.equal(a.state().queued, 1);
  // Independent second owner over same memory completes while first is parked.
  const b = owner(2, async name => ({
    fileName: name, dllBytes: null
  }));
  const rb = await b.load();
  assert.equal(rb.loadAddr, 0x410000);
  assert(b.events.some(e => e === 'continued:401001:0'));
  assert.equal(a.regs.esp, parkedEsp);
  b.stop();
  release();
  const result = await outer;
  assert.equal(await queued, 91);
  assert.deepEqual(requested, ['middle.dll', 'leaf.dll']);
  assert.equal(result.nestedLoaded.length, 2);
  assert.equal(a.regs.eax, 0xaaaa);
  assert.equal(a.regs.ecx, 0xbbbb);
  assert.equal(a.regs.edx, 0xcccc);
  assert.equal(a.regs.esp, a.initialEsp);
  assert(a.events.indexOf('unrelated-export')>a.events.indexOf('continued:401001:4325376'));
  assert.deepEqual(JSON.parse(JSON.stringify(a.state())), {
    pending: 0, queued: 0, active: false
  });
  a.stop();
  for(const kind of ['missing', 'rejected', 'throw']){
    const x = owner(3, async name => {
      if(kind === 'rejected')throw Error('resolver rejected');
      return {
        fileName: name, dllBytes: kind === 'missing' ? null: new Uint8Array([2])
      };
    }, {
      throwNested: kind === 'throw'
    });
    const r = await x.load();
    assert.equal(r.loadAddr, 0x410000);
    assert.equal(x.regs.esp, x.initialEsp);
    if(kind === 'rejected')assert(r.loaderErrors.some(e => e.includes('resolver rejected')));
    if(kind === 'throw')assert(r.loaderLogs.some(e => e.includes('nested initializer original fault')));
    x.stop();
  }
  let stopResolve;
  const stopping = owner(4, () => new Promise(r => stopResolve = r)), stopped = stopping.load();
  await tick();
  await tick();
  const pending = stopping.link.callExport('mutate');
  await tick();
  stopping.stop();
  await assert.rejects(stopped, /stopped/);
  await assert.rejects(pending, /stopped/);
  stopResolve({
    fileName: 'middle.dll', dllBytes: new Uint8Array([2])
  });
  await tick();
  assert.equal(stopping.link._dynamicDllRequests.size, 0);
  assert(!stopping.events.includes('unrelated-export'));
  let releasePressure;
  const pressure = owner(5, () => new Promise(r => releasePressure = r)), pressureLoad = pressure.load();
  await tick();
  await tick();
  const queue = [];
  for(let i = 0;
  i<257;
  i++)queue.push(pressure.link.callExport('mutate').then(v => ({
    v
  }), e => ({
    error: e.message
  })));
  await tick();
  assert.equal(pressure.state().queued, 256);
  assert(!pressure.events.includes('unrelated-export'));
  releasePressure({
    fileName: 'middle.dll', dllBytes: null
  });
  await pressureLoad;
  const q = await Promise.all(queue);
  assert.equal(q.filter(x => x.v === 91).length, 256);
  assert(q[256].error.includes('limit256'));
  pressure.stop();
  const cycle = owner(6, async name => ({
    fileName: name, dllBytes: new Uint8Array([2])
  }), {
    cycle: true
  });
  const cr = await cycle.load();
  assert(cr.loaderErrors.some(x => x.includes('limit64') || x.includes('depth64')));
  assert.equal(cycle.state().pending, 0);
  assert(cr.nestedLoaded.length <= 64);
  cycle.stop();
  // The original per-request deadline survives queuing; delivery cancellation
  // and independent expiry-on-drain both prevent a timed-out mutation.
  for (const dropCancel of [false, true]) {
    let releaseExpiry;
    const expiring = owner(7, () => new Promise(r => releaseExpiry = r), {
      dropCancel
    });
    const load = expiring.load();
    await tick();
    await tick();
    const mutation = expiring.link._ask({
      t: 'callExport', name: 'mutate', args: []
    }, 5);
    await assert.rejects(mutation, /did not answer callExport in 5ms/);
    await tick();
    if(!dropCancel)assert.equal(expiring.state().queued, 0);
    releaseExpiry({
      fileName: 'middle.dll', dllBytes: null
    });
    await load;
    await tick();
    assert(!expiring.events.includes('unrelated-export'));
    assert.equal(expiring.link._dynamicDllRequests.size, 0);
    assert.equal(expiring.link._dynamicDllTransactions.size, 0);
    expiring.stop();
  }
  // A byte resolver that never settles cannot retain page transaction entries
  // after outer timeout; cancellation unwinds rather than running guest again.
  const hung = owner(7, () => new Promise(() => {
  }));
  await assert.rejects(hung.load(1, 10), /did not answer loadLibrary in 10ms/);
  await tick();
  await tick();
  assert.equal(hung.link._dynamicDllRequests.size, 0);
  assert.equal(hung.link._dynamicDllTransactions.size, 0);
  assert.equal(hung.state().pending, 0);
  assert.equal(hung.state().active, false);
  assert.equal(hung.regs.esp, hung.initialEsp);
  assert(!hung.events.some(e => e.startsWith('continued:')));
  hung.stop();
  // A failing reply explicitly rejects the matching outer ask. If cancellation
  // cannot be delivered either, stop rejects every ask and terminates the owner.
  for(const cancelThrows of [false, true]) {
    const failure = owner(7, async name => ({
      fileName: name, dllBytes: new Uint8Array([2])
    }), {
      replyThrows: true, cancelThrows
    });
    await assert.rejects(failure.load(), /reply transport failure/);
    await tick();
    await tick();
    assert.equal(failure.link._dynamicDllRequests.size, 0);
    assert.equal(failure.link._dynamicDllTransactions.size, 0);
    if(cancelThrows)assert.equal(failure.link.worker, null);
    else {
      assert.equal(failure.state().active, false);
      assert(!failure.events.some(e => e.startsWith('continued:')));
    }
    failure.stop();
  }
  // Exercise the actual Worker timeout callback, including outbound failure.
  const timeoutFailure = owner(7, () => new Promise(() => {}), {
    outboundThrows: 'cancelDynamicDllRequest'
  });
  const timeoutLoad = timeoutFailure.load();
  await tick();
  await tick();
  assert.doesNotThrow(() => timeoutFailure.expireByteRequest());
  const timeoutResult = await timeoutLoad;
  assert(timeoutResult.loaderErrors.includes('worker outbound cancelDynamicDllRequest failed'));
  assert.equal(timeoutFailure.state().pending, 0);
  assert.equal(timeoutFailure.state().active, false);
  assert.equal(timeoutFailure.link._dynamicDllRequests.size, 0);
  assert.equal(timeoutFailure.link._dynamicDllTransactions.size, 0);
  timeoutFailure.stop();

  // An end-send failure must still drain the parked export. The outer reply
  // independently retires page metadata even when the end message is lost.
  let releaseEnd;
  const endFailure = owner(7, () => new Promise(r => releaseEnd = r), {
    outboundThrows: 'dynamicDllEnd'
  });
  const endLoad = endFailure.load();
  await tick();
  await tick();
  const deferred = endFailure.link._ask({ t: 'callExport', name: 'mutate', args: [] });
  await tick();
  assert.equal(endFailure.state().queued, 1);
  releaseEnd({ fileName: 'middle.dll', dllBytes: null });
  await endLoad;
  assert.equal((await deferred).value, 91);
  await tick();
  assert.equal(endFailure.state().queued, 0);
  assert.equal(endFailure.state().active, false);
  assert.equal(endFailure.link._dynamicDllRequests.size, 0);
  assert.equal(endFailure.link._dynamicDllTransactions.size, 0);
  assert(endFailure.outbound.some(m => m.t === 'error' && m.message === 'worker outbound dynamicDllEnd failed'));
  endFailure.stop();
  // If the outer result send and end send both fail, retain the first error.
  const firstFailure = owner(7, async () => null, {
    outboundThrows: ['libLoaded', 'dynamicDllEnd']
  });
  await assert.rejects(firstFailure.load(), /worker outbound libLoaded failed/);
  assert(firstFailure.outbound.some(m => m.t === 'error' && m.message === 'worker outbound libLoaded failed'));
  assert.equal(firstFailure.link._dynamicDllRequests.size, 0);
  assert.equal(firstFailure.link._dynamicDllTransactions.size, 0);
  firstFailure.stop();
  assert.equal(shadow.esp, 0);
  assert.equal(shadowCalls, 0);
  console.log('PASS actual Worker + WorkerLink source, real async dllMainSteps: two shared-memory owners, parked-frame nested success, keepRegs, queued export ordering, missing/rejected bytes, nested throw warning, stop/stale response cleanup, exact queued expiry, never-settling resolver cancellation, reply/cancel transport failure; page shadow never executed');
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});

