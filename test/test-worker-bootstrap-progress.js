'use strict';

// Drive the shipped browser loop, scheduler, DLL notification driver and CS
// resolver. Only interpreter exports and Worker transport are deterministic
// fakes: a creator owns a lock needed by its child's real attach continuation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
// Retained-source controls keep the production module filename so its sibling
// imports resolve normally; a missing dependency must never count as rejection.
function threadManager() {
  if (!process.env.WA_THREAD_MANAGER) return require('../lib/thread-manager');
  const Module = require('node:module');
  const filename = require.resolve('../lib/thread-manager');
  const retained = new Module(filename, module);
  retained.filename = filename;
  retained.paths = module.paths;
  retained._compile(fs.readFileSync(process.env.WA_THREAD_MANAGER, 'utf8'), filename);
  return retained.exports;
}
const { ThreadManager } = threadManager();
const loader = require('../lib/dll-loader');
const turn = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), 500);
    })]);
  } finally { clearTimeout(timer); }
}
const workerContext = { URL, performance, setTimeout, clearTimeout, importScripts() {},
  location: { href: 'https://example.invalid/guest-worker.js' }, postMessage() {},
  ThreadSendWaits: require('../lib/thread-send-waits') };
workerContext.self = workerContext;
vm.createContext(workerContext);
vm.runInContext(fs.readFileSync(require.resolve('../lib/guest-worker'), 'utf8'), workerContext);
const waitForLock = vm.runInContext('waitForDllCriticalSection', workerContext);
const hostContext = { console, performance, URLSearchParams, setTimeout, clearTimeout };
vm.runInNewContext(fs.readFileSync(process.env.WA_HOST || require.resolve('../host'), 'utf8') +
  '\n;globalThis.Host = WineAssembly;', hostContext);

function fixture() {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  const main = { exports: { get_sync_table: () => 0, get_num_thunks: () => 1,
    sync_thunk_state() {}, get_bp_addr: () => 0, get_watch_addr: () => 0 } };
  const backend = { specs: [], links: [], dropped: [],
    readExports: async () => ({ get_image_base: 0x400000 }),
    async spawnThread(spec) {
      this.specs.push(spec);
      const link = { slot: this.specs.length, slices: 0,
        async slice() { this.slices++; return { eip: 0x401000, yield: 0, blocks: 1 }; } };
      this.links.push(link);
      return link;
    },
    async dropThread(link) { this.dropped.push(link); link._retirementComplete = true; },
  };
  const tm = new ThreadManager({}, memory, main, () => ({ host: {} }),
    { workerBackend: backend, threadsRequested: true });
  tm._log = () => {};
  return { tm, backend, memory };
}

function attachFixture(memory, tid) {
  const view = new DataView(memory.buffer), parked = deferred();
  const state = { eip: 0x401000, esp: 0xf000, eax: 73, yield_reason: 0, last_run_halt: 0 };
  let runs = 0;
  const ex = { memory, get_image_base: () => 0, guest_to_wasm: n => n,
    get_fs_base: () => 0, get_cs_wait_addr: () => 0x800, get_cs_wait_owner: () => 1,
    get_dll_callback_lock: () => 0x900, get_dll_callback_owner: () => tid + 1,
    clear_yield() { state.yield_reason = 0; },
    set_yield_state(y) { state.yield_reason = y; },
    run() {
      runs++;
      if (runs === 1) {
        assert.equal(view.getUint32(state.esp + 8, true), 2, 'DLL_THREAD_ATTACH');
        state.esp -= 8;
        view.setUint32(state.esp, 0x1234, true);
        view.setUint32(state.esp + 4, 0x800, true);
        state.eip = 0x2222; state.yield_reason = 9; state.last_run_halt = 4;
        parked.resolve();
      } else {
        assert.equal(view.getUint32(0x80c, true), 0, 'creator released before callback retry');
        assert.equal(view.getUint32(state.esp, true), 0x1234, 'parked frame retained');
        state.esp = 0xf000; state.eip = 0; state.eax = 1; state.last_run_halt = 2;
      }
    } };
  for (const name of Object.keys(state)) {
    ex['get_' + name] = () => state[name];
    ex['set_' + name] = value => { state[name] = value; };
  }
  view.setUint32(0x80c, 1, true);
  return { state, parked, runs: () => runs,
    release() { Atomics.store(new Int32Array(memory.buffer, 0x80c, 1), 0, 0); },
    gate: () => Array.from(new Int32Array(memory.buffer, 0x900, 2)),
    notify: () => loader.notifyDllThreadAsync({ exports: ex, memoryBuffer: memory.buffer,
      onBlockingYield: waitForLock }, 2, [{ loadAddr: 0x4000, dllMain: 0x5000 }]) };
}

async function creatorProgress() {
  const { tm, backend, memory } = fixture();
  const handle = tm.createThread(0x4fac80, 0x77, 0, 4);
  const attach = attachFixture(memory, 1), spawn = backend.spawnThread.bind(backend);
  backend.spawnThread = async spec => { await attach.notify(); return spawn(spec); };
  const flight = tm.spawnPending();
  await attach.parked.promise;
  assert.deepEqual(attach.gate(), [2, 2], 'both real callback gate scopes stay owned');
  assert.equal(tm.waitSingle(handle, 0), 0x102, 'pending handle is unsignaled');
  const wine = Object.create(hostContext.Host.prototype), mainRan = deferred(), errors = [];
  Object.assign(wine, { threadManager: tm, memory, instance: tm.mainInstance,
    _frozenRegister() {}, _installVisibilityPause() {}, _installInputWake() {},
    _maybePauseForHidden: () => false, _beginGuestTickBatch() {},
    _pumpWaveCallbacksAtBoundary: async () => {},
    logToUI: message => errors.push(message), stop() { this.running = false; },
    guestWorker: { link: { threadSendDepth: 0 },
      async slice() { attach.release(); wine.running = false; mainRan.resolve();
        return { eip: 0xaf3139, yield: 0, blocks: 1, ms: 1 }; } },
  });
  wine._runThreaded(5000);
  try {
    await bounded(mainRan.promise, 'creator could not run while DLL attach waited');
    await bounded(flight, 'attach did not complete after creator release');
    await turn();
    assert.deepEqual(errors, []);
    assert.equal(attach.runs(), 2);
    assert.deepEqual(attach.gate(), [0, 0], 'normal completion releases both owned gates');
    assert.equal(attach.state.eip, 0x401000, 'saved user entry restored after attach');
    assert.equal(attach.state.esp, 0xf000);
    await tm.runWorkerSlices(5000);
    assert.equal(backend.links[0].slices, 0, 'CREATE_SUSPENDED user entry stays suspended');
    assert.equal(tm.resumeThread(handle), 1);
    await tm.runWorkerSlices(5000);
    assert.equal(backend.links[0].slices, 1, 'only ResumeThread admits user entry');
  } finally { attach.release(); await flight; }
}

async function existingThreadProgress() {
  const { tm, backend, memory } = fixture();
  tm.createThread(0x401000, 0, 0, 0);
  await tm.spawnPending();
  const attach = attachFixture(memory, 2), spawn = backend.spawnThread.bind(backend);
  backend.spawnThread = async spec => { await attach.notify(); return spawn(spec); };
  tm.createThread(0x402000, 0, 0, 4);
  const flight = tm.spawnPending();
  await attach.parked.promise;
  backend.links[0].slice = async () => { attach.release(); return { eip: 0x401000, yield: 0 }; };
  try {
    assert.equal(await bounded(tm.runWorkerSlices(5000),
      'existing thread could not run during bootstrap'), 1);
    await bounded(flight, 'existing-thread release did not finish attach');
  } finally { attach.release(); await flight; }
}

async function singleflightAndFailure() {
  const { tm, backend } = fixture(), hold = deferred(), started = deferred();
  const spawn = backend.spawnThread.bind(backend), calls = [];
  backend.readExports = () => {
    // Synchronous reentry before the first metadata await cannot start a pass.
    tm.startPendingWorkers();
    return Promise.resolve({ get_image_base: 0x400000 });
  };
  backend.spawnThread = async spec => {
    calls.push(spec.tid);
    if (calls.length === 1) { started.resolve(); await hold.promise; }
    return spawn(spec);
  };
  const h = tm.createThread(0x401000, 0, 0, 4);
  tm.startPendingWorkers();
  await started.promise;
  const flight = tm.spawnPending();
  const duplicate = tm.duplicateCurrentThread(2);
  tm.createThread(0x402000, 0, 0, 4);
  for (let i = 0; i < 10; i++) {
    tm.startPendingWorkers();
    assert.equal(tm.spawnPending(), flight, 'all joins share one pass');
    assert.equal(await tm.runWorkerSlices(1000), 0);
  }
  assert.deepEqual(calls, [1], 'pending list is not walked again during await');
  assert.equal(tm.terminateThread(duplicate, 91), 1);
  assert.equal(tm.waitSingle(h, 0), 0x102, 'termination cannot signal before bootstrap unwinds');
  hold.resolve(); await flight;
  assert.deepEqual(calls, [1, 2], 'pass picks up later pending threads exactly once');
  assert.equal(tm.getExitCodeThread(h), 91);
  assert.equal(tm.getExitCodeThread(duplicate), 91, 'alias retargets to terminal record');
  assert.equal(backend.links[0].slices, 0, 'terminated bootstrap never enters user code');
  assert.deepEqual(backend.dropped, [backend.links[0]], 'completed bootstrap retired by its real link');
  assert.equal(tm._pendingThreads.length, 0);

  const failed = fixture(), dead = { slot: 8, stackMapped: 0x8800 };
  let attempts = 0;
  const okay = failed.backend.spawnThread.bind(failed.backend);
  failed.backend.spawnThread = async spec => {
    if (++attempts === 1) throw Object.assign(new Error('bootstrap failed'), { workerLink: dead });
    return okay(spec);
  };
  const bad = failed.tm.createThread(0x401000, 0, 0, 0);
  const good = failed.tm.createThread(0x402000, 0, 0, 4);
  failed.tm.startPendingWorkers(); await failed.tm.spawnPending();
  assert.equal(failed.tm.threads.get(bad).link, dead, 'failed link retains stack/retirement identity');
  assert.equal(failed.tm.threads.get(bad).stackAlloc, 0x8800);
  assert.equal(failed.tm.getExitCodeThread(bad), 1);
  assert.equal(failed.tm.threads.get(good).state, 'active', 'failure does not discard next pending');

  const metadata = fixture(), error = new Error('metadata transport failed');
  metadata.backend.readExports = async () => { throw error; };
  metadata.tm.createThread(0x401000, 0, 0, 0);
  metadata.tm.startPendingWorkers();
  await assert.rejects(metadata.tm.spawnPending(), value => value === error);
  await turn();
  assert.throws(() => metadata.tm.startPendingWorkers(), value => value === error,
    'background pass failure reaches the next scheduler boundary');
}

(async () => {
  const selected = process.env.WA_BOOTSTRAP_CASE;
  if (!selected || selected === 'creator') await creatorProgress();
  if (!selected || selected === 'existing') await existingThreadProgress();
  if (!selected || selected === 'ownership') await singleflightAndFailure();
  assert(!selected || ['creator', 'existing', 'ownership'].includes(selected));
  console.log('PASS bootstrap creator/existing-thread lock progress, suspended entry, singleflight/reentry, termination and failure ownership');
})().catch(error => { console.error(error); process.exitCode = 1; });
