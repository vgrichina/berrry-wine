'use strict';
// Production Worker command queue, DLL loader/LoadLibrary transaction, broker
// and scheduler retirement, over a deterministic interpreter-export fixture.
// Actual Node Workers own the fixture; no browser, game or full VM is started.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const RPC = require('../lib/guest-rpc');
const SIGS = { fixture_rpc: { params: ['i32'], results: ['i32'] } };
const GATE = 0x1800, LIFE = 0x2000, STACK = 0x80000;
const DIAG = { runs: 64, child: 65, rpcReturned: 66, mapped: 67 };
const liveWorkers = new Set();
function image() {
  const bytes = new Uint8Array(1024), d = new DataView(bytes.buffer);
  d.setUint32(0x3c, 64, true); d.setUint32(64, 0x4550, true);
  return bytes;
}
function fixtureWorker() {
  const memory = { buffer: workerData.buffer }, d = new DataView(memory.buffer);
  const words = new Int32Array(memory.buffer);
  const loader = require('../lib/dll-loader');
  const boot = require('../lib/process-boot');
  const built = RPC.createWorkerImports(memory, SIGS, msg => parentPort.postMessage(msg), { slot: 6 });
  const state = { eip: 0, esp: 0, eax: 73, yield_reason: 0, yield_flag: 0, last_run_halt: 0 };
  let count = 1, heap = 0x90000, rootStarted = false, childStarted = false;
  const row = (i, field, value) => value === undefined ? d.getUint32(LIFE + i * 64 + field, true)
    : d.setUint32(LIFE + i * 64 + field, value, true);
  const ex = {
    memory, get_image_base: () => 0x1000, guest_to_wasm: n => n,
    get_fs_base: () => 0, get_dll_callback_lock: () => GATE, get_dll_callback_owner: () => 6,
    get_dll_lifecycle_table: () => LIFE, get_dll_lifecycle_stride: () => 64,
    get_dll_table: () => 0x1000, get_dll_count: () => count,
    has_shared_dll_registry: () => 1, get_dll_index: addr => (addr - 0x20000) / 0x10000,
    get_current_thread_id: () => 6, dll_thread_notifications_enabled: () => 1,
    init_thread() {}, guest_stack_alloc: () => STACK,
    guest_alloc: size => { const p = heap; heap += size; return p; },
    ensure_tls_slots() { if (workerData.mode === 'tls-failure') return 0; return 0x91000; },
    guest_write32: (p, value) => d.setUint32(p, value >>> 0, true),
    guest_read32: p => d.getUint32(p, true),
    clear_yield() { state.yield_reason = 0; },
    set_yield_state(y, f) { state.yield_reason = y; state.yield_flag = f; },
    get_cs_wait_addr: () => 0x800, get_cs_wait_owner: () => 1,
    get_loadlib_name: () => 0x600,
    get_staging: () => 0x10000, get_staging_size: () => 4096,
    get_next_dll_addr: () => 0x30000,
    load_dll(size, base) {
      assert.equal(count++, 1); words[DIAG.mapped]++;
      row(1, 0, 1); row(1, 4, 102); row(1, 8, 1); row(1, 12, 1);
      row(1, 24, base + 4096); row(1, 28, 2);
      d.setUint32(0x1020, base, true); d.setUint32(0x1024, 65536, true);
      new Uint8Array(memory.buffer, base, size).set(new Uint8Array(memory.buffer, 0x10000, size));
      return base + 4096;
    },
    complete_dll_initialize(i, generation, outcome) {
      assert.equal(row(i, 4), generation);
      row(i, 0, outcome === 1 ? 2 : 4); row(i, 48, outcome === 1 ? 1 : 0); return 1;
    },
    run() {
      words[DIAG.runs]++;
      if (state.eip === 0x21000 && !rootStarted) {
        rootStarted = true;
        // LoadLibrary's sentinel continuation remains on the DllMain stack.
        state.esp -= 4; d.setUint32(state.esp, 0x21100, true);
        state.eip = 0; state.yield_reason = 5; state.last_run_halt = 3; return;
      }
      if (state.eip === 0x31000 && !childStarted) {
        childStarted = true; words[DIAG.child]++;
        assert.equal(d.getUint32(state.esp + 8, true), 1, 'nested real PROCESS_ATTACH frame');
        if (workerData.mode === 'fault') throw new Error('injected nested initializer fault');
        if (workerData.mode === 'thread-exit') { state.eip = 0; state.yield_reason = 2; return; }
        if (workerData.mode === 'rpc') {
          assert.equal(built.imports.host.fixture_rpc(40), 41);
          words[DIAG.rpcReturned]++;
        }
        if (workerData.mode === 'lookup') {
          state.esp -= 4; d.setUint32(state.esp, 0x31100, true);
          state.eip = 0; state.yield_reason = 5; state.last_run_halt = 3; return;
        }
        state.esp -= 8; d.setUint32(state.esp, 0x31100, true); d.setUint32(state.esp + 4, 0x800, true);
        state.eip = 0x31200; state.yield_reason = 9; state.last_run_halt = 4; return;
      }
      if (state.eip === 0x31200) {
        assert.equal(d.getUint32(0x80c, true), 0, 'callback only retries after actual CS release');
        state.esp += 8;
      }
      // Successful stdcall return consumes the actual callback frame.
      state.esp += 16; state.eip = 0; state.eax = 1; state.last_run_halt = 2;
    },
  };
  for (const field of Object.keys(state)) {
    ex['get_' + field] = () => state[field]; ex['set_' + field] = v => { state[field] = v; };
  }
  d.setUint32(0x1000, 0x20000, true); d.setUint32(0x1004, 65536, true);
  row(0, 0, 2); row(0, 4, 101); row(0, 8, 1); row(0, 24, 0x21000); row(0, 28, 1); row(0, 48, 1);
  new Uint8Array(memory.buffer, 0x600, 10).set(Buffer.from('child.dll\0'));
  d.setUint32(0x80c, 1, true);
  if (workerData.mode === 'gate-wait') { words[GATE / 4] = 7; words[GATE / 4 + 1] = 1; }
  const context = { URL, performance, setTimeout, clearTimeout, importScripts() {},
    location: { href: 'https://fixture.invalid/lib/guest-worker.js' },
    postMessage: msg => parentPort.postMessage(msg),
    ThreadSendWaits: require('../lib/thread-send-waits'),
    memUtils: require('../lib/mem-utils'), workerImports: require('../lib/worker-imports'),
    DllLoader: loader, processBoot: boot, fixture: { exports: ex },
    fixtureMemory: memory, fixtureIdentity: workerData.endpointIdentity,
  };
  context.self = context; vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../lib/guest-worker'), 'utf8'), context);
  vm.runInContext(`instance=fixture; memory=fixtureMemory; endpointIdentity=fixtureIdentity;
    dllCallbackOwner=DllLoader.bindDllCallbackOwner(instance.exports, endpointIdentity,
      {onBlockingYield:waitForDllCriticalSection});`, context);
  parentPort.on('message', msg => {
    if (msg.t === 'fixtureInspect') {
      parentPort.postMessage({ t: 'fixtureInspection', state, endpointIdentity: workerData.endpointIdentity,
        pins: [row(0, 12), row(1, 12)],
        gates: vm.runInContext('dllCallbackOwner.gates.size', context),
        generators: vm.runInContext('dllCallbackOwner.generators.size', context) });
      return;
    }
    vm.runInContext('receiveMessage', context)(msg);
  });
  parentPort.postMessage({ t: 'fixtureReady' });
}

function productionHost() {
  const filename = require.resolve('../lib/guest-thread-host');
  if (!process.env.WA_RETIREMENT_OLD_HOST) return require(filename);
  // Retained bytes compile at the production filename, preserving real sibling
  // imports. A missing module or syntax failure is not an old-source rejection.
  const mod = new Module(filename, module); mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(fs.readFileSync(process.env.WA_RETIREMENT_OLD_HOST, 'utf8'), filename);
  return mod.exports;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, label) {
  const deadline = Date.now() + 2500;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('fixture did not reach ' + label);
    await delay(1);
  }
}
async function main() {
  console.log('retirement-test-process ' + process.pid);
  const { WorkerLink, GuestThreadHost } = productionHost();
  const { ThreadManager } = require('../lib/thread-manager');
  async function context(mode, opts = {}) {
    const memory = { buffer: new SharedArrayBuffer(512 * 1024 * 1024) };
    const words = new Int32Array(memory.buffer), d = new DataView(memory.buffer);
    const link = new WorkerLink({ slot: 6, memory, loaderRetireTimeout: 40 });
    let lookups = 0, releaseLookup, heldRpc, rpcCalls = 0;
    const messages = [];
    link.broker = RPC.createMainBroker(memory, { fixture_rpc: value => { rpcCalls++; return value + 1; } }, SIGS);
    link.findDll = async () => {
      lookups++;
      if (mode === 'lookup' && lookups === 2)
        return new Promise(resolve => { releaseLookup = resolve; });
      return image();
    };
    const worker = new Worker(__filename, { workerData: { buffer: memory.buffer, mode, endpointIdentity: link.endpointIdentity } });
    liveWorkers.add(worker); worker.once('exit', () => liveWorkers.delete(worker));
    if (process.env.WA_RETIREMENT_OLD_HOST) {
      // Old host bytes predate the lookup identity field. Adapt only that
      // transport envelope so the control reaches the same real nested attach;
      // stop(), its admission flag and its missing handshake remain original.
      const post = worker.postMessage.bind(worker);
      worker.postMessage = msg => post(msg.t === 'dllLookupResult'
        ? { ...msg, endpointIdentity: link.endpointIdentity } : msg);
    }
    link.worker = worker;
    const exited = new Promise(resolve => { worker.once('exit', resolve); });
    worker.on('error', error => { link._transportFailed(error); });
    let discardReceipt = !!opts.discardReceipt;
    worker.on('message', msg => {
      messages.push(msg);
      if (msg.t === 'rpc' && mode === 'rpc') heldRpc = msg;
      else if (msg.t === 'scopedLoadersRetired' && discardReceipt) {}
      else if (!msg.t.startsWith('fixture')) link._onMessage(msg);
    });
    await until(() => messages.some(m => m.t === 'fixtureReady'), 'own Worker ready');
    const spec = { tid: 5, stackSize: 0x4000, imageBase: 0x1000, startAddr: 0x12345 };
    const start = () => link.initGuestThread(spec);
    const gate = () => [d.getInt32(GATE, true), d.getInt32(GATE + 4, true)];
    const pins = () => [d.getUint32(LIFE + 12, true), d.getUint32(LIFE + 64 + 12, true)];
    const inspect = async () => {
      const before = messages.length; worker.postMessage({ t: 'fixtureInspect' });
      await until(() => messages.slice(before).some(m => m.t === 'fixtureInspection'), 'owning continuation inspection');
      return messages.slice(before).find(m => m.t === 'fixtureInspection');
    };
    const close = async () => {
      // Only this fixture's Worker and held lookup/RPC are cleaned up. Force
      // termination here is test disposal after assertions, never production.
      if (heldRpc && Atomics.load(RPC.views(memory, 6).i32, RPC.SLOT.STATUS) === RPC.STATUS_REQ)
        link._onMessage(heldRpc);
      releaseLookup?.(image()); Atomics.store(words, 0x80c / 4, 0);
      discardReceipt = false;
      try { await link.stop(); } finally {
        if (liveWorkers.has(worker)) await worker.terminate();
        await exited;
      }
    };
    return { link, worker, words, memory, messages, start, gate, pins, inspect, close,
      get lookups() { return lookups; }, get heldRpc() { return heldRpc; },
      get rpcCalls() { return rpcCalls; }, allowReceipt() { discardReceipt = false; },
      releaseLookup() { releaseLookup?.(image()); }, exited };
  }

  // This first case is also the retained old-host control. Observe an actual
  // orphaned shared gate/pin after termination, not merely a missing API/ACK.
  async function cancellation(mode) {
    const c = await context(mode);
    try {
      const boot = c.start().then(value => ({ value }), error => ({ error }));
      await until(() => mode === 'lookup' ? c.lookups === 2 : c.words[DIAG.child] === 1,
        'nested attach parked');
      const before = await c.inspect();
      console.log('parked-owner-evidence ' + JSON.stringify({ mode, gate: c.gate(), pins: c.pins(), before, messages: c.messages.filter(m => m.t === 'error') }));
      const depth = mode === 'lookup' ? 5 : 4;
      assert.deepEqual(c.gate(), [6, depth], 'exact nested callback gate ownership');
      assert.deepEqual(c.pins(), [mode === 'lookup' ? 3 : 2, 1], 'exact notification/lookup and mapping pins');
      assert.equal(before.generators, 2, 'outer and nested generators are live');
      assert.equal(before.gates, depth, 'every real nested gate belongs to the endpoint registry');
      if (mode === 'lookup') {
        c.worker.postMessage({ t: 'dllLookupResult', lookup: 2,
          endpointIdentity: c.link.endpointIdentity + 1, bytes: image() });
        const stale = await c.inspect();
        assert.equal(stale.generators, 2, 'stale endpoint lookup cannot complete its successor');
        assert.equal(stale.state.esp, before.state.esp); assert.equal(c.words[DIAG.runs], 2);
      }
      const pending = c.link.readExports(['get_eip']).then(value => ({ value }), error => ({ error }));
      const stopping = c.link.stop();
      await stopping;
      await c.exited;
      const result = await boot;
      assert(result.error, 'cancelled init rejects');
      assert((await pending).error, 'pending ordinary command settles on retirement');
      const observed = { mode, gate: c.gate(), pins: c.pins(),
        receipt: c.link._loaderRetirementReceipt || null };
      console.log('cancelled-owner-evidence ' + JSON.stringify(observed));
      assert.deepEqual(c.gate(), [0, 0], 'terminated Worker must not leave an orphaned nested DLL gate');
      assert.equal(c.pins()[0], 0, 'acknowledged notification and lookup pins are released exactly once');
      assert.equal(c.pins()[1], 1, 'unfinished nested PROCESS_ATTACH retains its mapping quarantine');
      const lifecycle = new DataView(c.memory.buffer);
      assert.equal(lifecycle.getUint32(LIFE + 64, true), 4, 'incomplete initializer is FAILED');
      assert.equal(lifecycle.getUint32(LIFE + 64 + 4, true), 102, 'quarantine retains its exact image generation');
      const receipt = c.link._loaderRetirementReceipt;
      assert(receipt.dllCallbacksRetired && receipt.retired);
      assert.equal(receipt.callbackGenerators, 2); assert.equal(receipt.callbackUnwinds, 2);
      assert.equal(c.link._pending.size, 0); assert.equal(c.link.worker, null);
      await c.link.stop(); assert.equal(c.pins()[1], 1, 'repeat stop cannot release mapping quarantine');
      await assert.rejects(c.link.readExports(['get_eip']), /retired/);
      assert.equal(c.words[DIAG.runs], 2, 'no callback or caller executes after cancellation');
    } finally { await c.close(); }
  }
  await cancellation('cs');
  if (process.env.WA_RETIREMENT_OLD_HOST) return;
  await cancellation('lookup');

  {
    const c = await context('gate-wait');
    try {
      const boot = c.start().catch(error => error);
      await until(() => c.link.stackMapped === STACK, 'allocation before waiting for another gate owner');
      await c.link.stop(); assert(await boot instanceof Error);
      assert.deepEqual(c.gate(), [7, 1], 'cancellation never resets another endpoint gate');
      assert.deepEqual(c.pins(), [0, 0]); assert.equal(c.words[DIAG.runs], 0);
      assert.equal(c.link._loaderRetirementReceipt.callbackUnwinds, 0);
    } finally { await c.close(); }
  }

  for (const mode of ['tls-failure', 'fault']) {
    const c = await context(mode);
    try {
      await assert.rejects(c.start(), mode === 'tls-failure' ? /TLS vector/ : /did not complete/);
      assert.equal(c.link.stackMapped, STACK, 'failed init retains the early stack allocation lease');
      if (mode === 'fault') assert.equal(c.pins()[0], 1, 'failed notification pin remains owned before retirement');
      await c.link.stop();
      assert.deepEqual(c.gate(), [0, 0]); assert.equal(c.pins()[0], 0);
      if (mode === 'fault') assert.equal(c.pins()[1], 1, 'faulted mapped initializer remains quarantined');
      console.log('PASS failed bootstrap ' + mode);
    } finally { await c.close(); }
  }

  {
    const c = await context('thread-exit');
    try {
      const ready = await c.start();
      assert.equal(ready.eip, 0, 'ExitThread cannot restore or enter the start routine');
      assert.equal(c.pins()[0], 1, 'exited notification pin retains its endpoint owner');
      await c.link.stop();
      assert.deepEqual(c.gate(), [0, 0]); assert.deepEqual(c.pins(), [0, 1]);
      assert.equal(c.link._loaderRetirementReceipt.callbackUnwinds, 2);
    } finally { await c.close(); }
  }

  {
    const c = await context('lookup');
    try {
      const boot = c.start().catch(error => error);
      await until(() => c.lookups === 2, 'live pinned generation');
      const d = new DataView(c.memory.buffer), pins = c.pins();
      d.setUint32(LIFE + 4, 999, true);
      await assert.rejects(c.link.stop(), /generation pin/); await boot;
      assert(c.link.worker, 'generation cleanup failure cannot terminate its owner');
      assert.equal(c.link._loaderRetirementReceipt, undefined);
      assert.deepEqual(c.pins(), pins, 'a stale generation cannot release its successor pins');
      assert.equal(c.link._retirementComplete, undefined);
      console.log('PASS stale DLL generation retains unacknowledged ownership');
    } finally { await assert.rejects(c.close(), /generation pin/); }
  }

  // Real synchronous RPC remains serviceable after the host fences commands.
  // Otherwise Atomics.wait prevents the Worker from receiving cancellation.
  {
    const c = await context('rpc');
    try {
      const boot = c.start().catch(error => error);
      await until(() => c.heldRpc, 'inflight synchronous RPC');
      const stopping = c.link.stop();
      assert.equal(c.rpcCalls, 0); assert.equal(c.link._retirementComplete, undefined);
      c.link._onMessage(c.heldRpc);
      await stopping; await boot;
      assert.equal(c.rpcCalls, 1); assert.equal(c.words[DIAG.rpcReturned], 1);
      assert.equal(Atomics.load(RPC.views(c.memory, 6).i32, RPC.SLOT.STATUS), RPC.STATUS_IDLE);
      assert.deepEqual(c.gate(), [0, 0]); assert.equal(c.pins()[0], 0);
      console.log('PASS inflight real RPC');
    } finally { await c.close(); }
  }

  // Timeout is the actual WorkerLink timer. The request's timed-out reply,
  // stale endpoint control, lost ACK and termination gap are all distinct.
  {
    const c = await context('lookup', { discardReceipt: true });
    const host = new GuestThreadHost({}); host._startingLinks.add(c.link); host.slotTid.set(6, 5);
    const manager = new ThreadManager(null, c.memory, { exports: { get_sync_table: () => RPC.SYNC_TABLE } }, null, { workerBackend: host });
    manager._maxWorkerThreads = 1;
    let frees = 0, busyLease = true, releaseExit;
    manager.mainInstance = { exports: { guest_map_free: p => {
      assert.equal(p, STACK); frees++; return busyLease ? 0 : 1;
    } } };
    const originalAsk = c.link._ask.bind(c.link);
    c.link._ask = (msg, timeout) => originalAsk(msg, msg.t === 'initGuestThread' ? 80 : timeout);
    try {
      const boot = c.start().catch(error => error);
      await until(() => c.lookups === 2, 'nested lookup before bootstrap timeout');
      const before = c.gate(); const pins = c.pins();
      await assert.rejects(originalAsk({ t: 'retireScopedLoaders', endpointIdentity: c.link.endpointIdentity + 1 }), /identity mismatch/);
      assert.deepEqual(c.gate(), before); assert.deepEqual(c.pins(), pins);
      const error = await boot; assert.match(error.message, /did not answer initGuestThread/);
      manager.threads.set(100, { tid: 1, state: 'exited', link: c.link, stackAlloc: c.link.stackMapped });
      await assert.rejects(host.dropThread(c.link), /did not answer retireScopedLoaders/);
      assert(host._retirementLinks.has(c.link)); assert(c.link.worker);
      assert.equal(c.link._retirementComplete, undefined);
      assert.deepEqual(c.gate(), [0, 0], 'lost reply is not an unresponsive endpoint');
      assert.equal(manager._allocWorkerSlot(), 0); assert.equal(frees, 0);
      c.allowReceipt();
      const terminate = c.worker.terminate.bind(c.worker);
      let exitStarted;
      const atExit = new Promise(resolve => { exitStarted = resolve; });
      c.worker.terminate = async () => { await new Promise(resolve => { releaseExit = resolve; exitStarted(); }); return terminate(); };
      const retirement = host.dropThread(c.link);
      await atExit;
      assert(c.link._loaderRetirementReceipt.dllCallbacksRetired);
      assert.equal(manager._allocWorkerSlot(), 0, 'ACK alone cannot release a stack/slot');
      assert.equal(frees, 0);
      releaseExit(); await retirement;
      assert.equal(manager._allocWorkerSlot(), 0, 'native stack lease still blocks reuse after Worker exit');
      assert.equal(frees, 1); busyLease = false;
      assert.equal(manager._allocWorkerSlot(), 1); assert.equal(frees, 2);
      assert.equal(manager.threads.size, 0); manager._allocWorkerSlot(); assert.equal(frees, 2);
      // The resolver may reply after the endpoint is already gone. It cannot
      // publish bytes, rerun the guest, or complete a newer endpoint's request.
      c.releaseLookup(); await delay(5);
      assert.equal(c.words[DIAG.runs], 2); assert.equal(c.link._pending.size, 0);
      console.log('PASS timeout, stale control, lost receipt, exit gap and stack lease');
    } finally { releaseExit?.(); c.allowReceipt(); await c.close(); await host.stop(); }
  }

  // Truly unresponsive command: the Worker cannot receive retirement control
  // while its real synchronous host RPC is waiting for a response.
  // No receipt, termination, gate release, pin release or stack reuse is legal.
  {
    const c = await context('rpc');
    try {
      const boot = c.start().catch(error => error);
      await until(() => c.heldRpc, 'Worker blocked in real synchronous RPC');
      const gate = c.gate(), pins = c.pins();
      await assert.rejects(c.link.stop(), /did not answer retireScopedLoaders/);
      assert.deepEqual(c.gate(), gate); assert.deepEqual(c.pins(), pins);
      assert(c.link.worker); assert.equal(c.link._loaderRetirementReceipt, undefined);
      assert.equal(c.link._retirementComplete, undefined);
      assert(await boot instanceof Error);
      c.link._onMessage(c.heldRpc); await c.link.stop();
      assert.deepEqual(c.gate(), [0, 0]); assert.equal(c.pins()[0], 0);
      console.log('PASS unresponsive real RPC quarantine');
    } finally { await c.close(); }
  }

  {
    const c = await context('cs');
    try {
      const boot = c.start();
      await until(() => c.words[DIAG.child] === 1, 'ordinary nested attach');
      Atomics.store(c.words, 0x80c / 4, 0);
      const ready = await boot;
      assert.equal(ready.eip, 0x12345); assert.equal(ready.esp, STACK + 0x4000 - 8);
      const restored = await c.link.readExports(['get_eax']);
      assert.equal(restored.get_eax, 73, 'ordinary attach restores the caller register');
      assert.deepEqual(c.gate(), [0, 0]); assert.deepEqual(c.pins(), [0, 0]);
      await c.link.stop(); assert.equal(c.link._loaderRetirementReceipt.callbackUnwinds, 2);
    } finally { await c.close(); }
  }
  assert.equal(liveWorkers.size, 0, 'every owned fixture Worker has actually exited');
  console.log('PASS failed init/timeout/nested cancellation, exact unwind, real inflight RPC, stale identity/late reply, unresponsive quarantine, stack lease and ordinary attach; owned Workers remaining=0');
}
if (!isMainThread) fixtureWorker();
else {
  const watchdog = setTimeout(() => { console.error('FAIL retirement test did not settle'); process.exit(1); }, 15000);
  main().catch(error => { console.error(error); process.exitCode = 1; })
    .finally(async () => { for (const worker of liveWorkers) await worker.terminate(); clearTimeout(watchdog); });
}
