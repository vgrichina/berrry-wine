'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { GuestThreadHost, WorkerLink } = require('../lib/guest-thread-host');

const sandbox = {
  console,
  URLSearchParams,
  setTimeout: () => 1,
  clearTimeout() {},
  setInterval: () => 1,
  clearInterval() {},
  window: { WINE_THREADS: true },
  location: { search: '' },
  crossOriginIsolated: true,
  fetch: async () => ({ ok: true, json: async () => ({ sigs: {} }) }),
  GuestThreadHost,
};

vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8') +
    '\nglobalThis.WineAssembly = WineAssembly;',
  sandbox,
);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function wineHost() {
  const wine = Object.create(sandbox.WineAssembly.prototype);
  Object.assign(wine, {
    running: true,
    renderer: null,
    hostCtx: { retireWaveCallbacks() {} },
    _mainImports: { host: {} },
    instance: { exports: { set_lock_atomic_mode() {} } },
    memory: { live: true },
    guestWorker: null,
    threadManager: null,
    _hostImports: { memory: { live: true } },
    logToUI: () => {},
    _deleteOwnSurfacePresentations: () => {},
  });
  return wine;
}

async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), 2000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  // Worker backend is stopped once through ThreadManager ownership. Host refs
  // stay live until asynchronous retirement succeeds, then memory is released.
  {
    const gate = deferred();
    let stops = 0;
    const backend = {
      stop() {
        stops++;
        return gate.promise;
      },
    };
    const tm = { workerBackend: backend };
    const wine = wineHost();
    wine.guestWorker = backend;
    wine.threadManager = tm;

    wine.stop({ repaint: false });
    wine.stop({ repaint: false });
    assert.strictEqual(stops, 1);
    assert.strictEqual(wine.guestWorker, backend);
    assert.strictEqual(wine.threadManager, tm);

    wine._releaseGuestMemory();
    assert(wine.memory, 'deferred release retains memory');
    gate.resolve();
    await bounded(wine._guestRuntimeStopPromise, 'worker retirement');
    await Promise.resolve();
    assert.strictEqual(wine.memory, null);
    assert.strictEqual(wine.guestWorker, null);
    assert.strictEqual(wine.threadManager, null);
  }

  // A rejected worker retirement is visible and must retain memory and owner refs.
  {
    const gate = deferred();
    const logs = [];
    const backend = { stop: () => gate.promise };
    const wine = wineHost();
    wine.guestWorker = backend;
    wine.threadManager = { workerBackend: backend };
    wine.logToUI = message => logs.push(message);

    wine.stop({ repaint: false });
    wine._releaseGuestMemory();
    gate.reject(new Error('endpoint failed'));
    await bounded(wine._guestRuntimeStopPromise, 'rejected retirement');
    await Promise.resolve();
    assert(wine.memory);
    assert.strictEqual(wine.guestWorker, backend);
    assert(wine._guestRuntimeRetirementError);
    assert(logs.some(message => /retirement failed/.test(message)));
  }

  // With no guest Worker owner, the existing memory release remains synchronous.
  {
    const wine = wineHost();
    wine._releaseGuestMemory();
    assert.strictEqual(wine.memory, null);
    assert.strictEqual(wine.threadManager, null);
  }

  // Delayed worker readiness after stop cannot publish the worker onto the host.
  {
    const gate = deferred();
    const entered = deferred();
    let stops = 0;

    class Delayed {
      constructor() {
        this.d3dimLazySync = true;
        this.stopped = false;
      }

      start() {
        entered.resolve();
        return gate.promise;
      }

      stop() {
        if (!this.stopped) {
          this.stopped = true;
          stops++;
        }
        return Promise.resolve();
      }
    }

    sandbox.GuestThreadHost = Delayed;
    const wine = wineHost();
    const starting = wine._maybeStartGuestWorker({});
    await bounded(entered.promise, 'worker start entry');
    wine.stop({ repaint: false });
    gate.resolve();
    await bounded(starting, 'startup cancellation');
    assert.strictEqual(wine._stopped, true);
    assert.strictEqual(wine.guestWorker, null);
    assert.strictEqual(stops, 1);
  }

  // Stop while the signature fetch is pending; after the old host releases its
  // instance, startup must not dereference it or construct a late Worker.
  {
    const gate = deferred();
    let made = 0;

    class Never {
      constructor() {
        made++;
      }
    }

    sandbox.GuestThreadHost = Never;
    sandbox.fetch = () => gate.promise;
    const wine = wineHost();
    const starting = wine._maybeStartGuestWorker({});
    wine.stop({ repaint: false });
    wine.instance = null;
    gate.resolve({ ok: true, json: async () => ({ sigs: {} }) });
    await bounded(starting, 'fetch cancellation');
    assert.strictEqual(made, 0);
  }

  // A failed worker boot is retired; the fallback path tolerates instance release.
  {
    let stops = 0;

    class Failed {
      constructor() {
        this.d3dimLazySync = true;
      }

      async start() {
        throw Error('boot failed');
      }

      stop() {
        stops++;
        return Promise.resolve();
      }
    }

    sandbox.GuestThreadHost = Failed;
    const wine = wineHost();
    await bounded(wine._maybeStartGuestWorker({}), 'failed worker startup');
    assert.strictEqual(stops, 1);
    assert.strictEqual(wine.guestWorker, null);
  }

  // WorkerLink.stop rejects pending readiness, and GuestThreadHost tracks links
  // before await so a stop during child startup retires that child too.
  {
    const link = new WorkerLink({
      workerUrl: path.join(__dirname, 'fixtures', 'worker-never-ready.js'),
    });
    const ready = link.start();
    let exited = false;
    link.worker.once('exit', () => {
      exited = true;
    });
    const startAt = Date.now();
    const stopped = link.stop();

    await assert.rejects(ready, /stopped/);
    await bounded(stopped, 'WorkerLink stop');
    assert(exited, 'Node worker exit completes before retirement resolves');
    assert(Date.now() - startAt < 1500, 'stop clears the readiness timeout promptly');
  }

  {
    const link = Object.create(WorkerLink.prototype);
    const gate = deferred();
    let terminated = 0;
    Object.assign(link, {
      slot: 2,
      _stopped: false,
      _stopPromise: null,
      worker: {
        terminate() {
          terminated++;
        },
      },
      waveRegistrations: new Map(),
      _pending: new Map(),
      _renderLegacyChain: Promise.resolve(),
      _readyPromise: { reject: error => gate.reject(error) },
    });

    const stopped = link.stop();
    await bounded(gate.promise.catch(() => {}), 'ready rejection');
    await stopped;
    assert.strictEqual(terminated, 1);
  }

  {
    const starting = deferred();
    const entered = deferred();
    let linkStops = 0;
    const gh = Object.create(GuestThreadHost.prototype);
    Object.assign(gh, {
      _nextSlot: 1,
      _stopped: false,
      _startingLinks: new Set(),
      threadLinks: new Map(),
      slotTid: new Map(),
      memory: {},
      module: {},
      sigs: {},
      sharedRenderWorker: false,
      d3dimGpu: false,
      d3dimLazySync: true,
      broker: {},
      workerUrl: 'worker',
      log: () => {},
      forwardGuestLogs: false,
      dxTraceLocal: false,
      onRpcSlot: null,
      onRpcSlotEnd: null,
      advanceGuestTime: null,
    });
    const originalStart = WorkerLink.prototype.start;
    const originalInit = WorkerLink.prototype.initGuestThread;
    const originalStop = WorkerLink.prototype.stop;
    const stoppedLinks = new WeakSet();

    WorkerLink.prototype.start = function () {
      entered.resolve();
      return starting.promise;
    };
    WorkerLink.prototype.stop = function () {
      if (!stoppedLinks.has(this)) {
        stoppedLinks.add(this);
        linkStops++;
      }
      return Promise.resolve();
    };
    WorkerLink.prototype.initGuestThread = async () => ({});

    try {
      const spawning = gh.spawnThread({ tid: 1 }).catch(() => {});
      await bounded(entered.promise, 'child start entry');
      assert.strictEqual(gh._startingLinks.size, 1);
      await gh.stop();
      starting.resolve();
      await bounded(spawning, 'child cancellation');
      assert.strictEqual(linkStops, 1);
      assert.strictEqual(gh.threadLinks.size, 0);
    } finally {
      WorkerLink.prototype.start = originalStart;
      WorkerLink.prototype.stop = originalStop;
      WorkerLink.prototype.initGuestThread = originalInit;
    }
  }

  {
    const gate = deferred();
    let logged = 0;
    const gh = Object.create(GuestThreadHost.prototype);
    Object.assign(gh, {
      _stopPromise: null,
      _stopped: false,
      _nestedWaitActive: 1,
      _clock: null,
      threadManager: null,
      onRpcSlot: null,
      onRpcSlotEnd: null,
      threadLinks: new Map([
        [1, { stop: () => Promise.reject(new Error('first failure')) }],
      ]),
      _startingLinks: new Set([{ stop: () => gate.promise }]),
      slotTid: new Map(),
      link: null,
      log: () => {
        logged++;
      },
    });

    const stop = gh.stop();
    let settled = false;
    stop.catch(() => {
      settled = true;
    });
    await Promise.resolve();
    assert.strictEqual(settled, false, 'shutdown waits for every link');
    gate.resolve();
    await assert.rejects(stop, /first failure/);
    assert(logged > 0, 'fire-and-forget shutdown failure is logged');
  }

  // Failed startup still owns its endpoint until cleanup completes. A second
  // stop during that drain must retain the instance rather than skip the owner.
  {
    const draining = deferred();
    const entered = deferred();

    class FailedWithEndpoint {
      async start() {
        throw new Error('boot failed');
      }

      stop() {
        entered.resolve();
        return draining.promise;
      }
    }

    sandbox.GuestThreadHost = FailedWithEndpoint;
    const wine = wineHost();
    const starting = wine._maybeStartGuestWorker({});
    await bounded(entered.promise, 'failed boot cleanup');
    assert(wine._guestWorkerStarting, 'failed startup retains its owner during cleanup');
    wine.stop({ repaint: false });
    wine._releaseGuestMemory();
    assert(wine.memory);
    draining.resolve();
    await bounded(starting, 'failed boot cleanup completion');
    await wine._guestRuntimeReleaseWait;
    assert.strictEqual(wine.memory, null);
  }

  // An unresponsive endpoint reports a bounded failure and retains the owner.
  {
    const oldSetTimeout = sandbox.setTimeout;
    const oldClearTimeout = sandbox.clearTimeout;
    sandbox.setTimeout = setTimeout;
    sandbox.clearTimeout = clearTimeout;

    try {
      const wine = wineHost();
      wine._stopped = true;
      wine._guestRuntimeRetirementTimeoutMs = 10;
      wine.guestWorker = { stop: () => new Promise(() => {}) };
      wine._releaseGuestMemory();
      await bounded(wine._guestRuntimeReleaseWait, 'retirement deadline');
      assert.match(wine._guestRuntimeRetirementError.message, /timed out/);
      assert(wine.memory, 'timeout must not free potentially live memory');

      class FailedWithStuckEndpoint {
        async start() { throw new Error('boot failed'); }
        stop() { return new Promise(() => {}); }
      }
      sandbox.GuestThreadHost = FailedWithStuckEndpoint;
      const failed = wineHost();
      failed._guestRuntimeRetirementTimeoutMs = 10;
      await assert.rejects(bounded(failed._maybeStartGuestWorker({}), 'failed boot deadline'),
        /Guest worker retirement timed out/);
      assert(failed._guestWorkerStarting, 'failed boot retains its unretired owner');
      assert(failed.memory, 'failed boot cleanup timeout cannot free live memory');
    } finally {
      sandbox.setTimeout = oldSetTimeout;
      sandbox.clearTimeout = oldClearTimeout;
    }
  }

  console.log('PASS guest worker shutdown ownership, deferred release and startup cancellation');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
