// Main-thread driver for guests running in Workers.
//
// Owns the workers' lifecycle, boots the PE inside the first one, services their
// host-import RPC (lib/guest-rpc.js), and drives slices. Kept out of host.js so
// the existing single-threaded path is untouched: this is an alternative driver,
// not a rewrite of the working one.
//
// SHAPE
//   slot 0            the guest's MAIN thread — boots the PE, owns the message
//                     pump, and is the one host.js's yield handling talks to
//   slot 1..N         one per guest CreateThread, spawned by ThreadManager's
//                     worker backend, each with its own instance over the same
//                     shared memory and its own RPC control block
//
// All of them execute at the same time. The main thread never runs guest code
// here; it serves host imports, composites, and hands out slices.

(function (root) {
  'use strict';

  const RPC = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./guest-rpc.js') : root.GuestRpc;
  const ProcessBoot = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./process-boot.js') : root.processBoot;
  const ThreadSendWaits = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./thread-send-waits.js') : root.ThreadSendWaits;
  let endpointSequence = 0;

  // Under Node the workers are worker_threads, not Workers: same postMessage and
  // same structured clone (a shared WebAssembly.Memory and a compiled Module both
  // travel), but events arrive through .on('message') and the payload is the
  // message itself rather than an event wrapper. Everything else is identical, so
  // the difference is confined to start().
  const NODE_WT = (typeof require === 'function' && typeof process !== 'undefined'
    && process.versions && process.versions.node) ? require('worker_threads') : null;

  // `forwardGlLogs` was named when this channel carried only early OpenGL
  // diagnostics. It now carries the guest's complete API/trace hook triplet.
  // Keep the old spelling as an input alias for cached browser callers.
  const forwardGuestLogsFrom = opts => opts.forwardGuestLogs === undefined
    ? !!opts.forwardGlLogs : !!opts.forwardGuestLogs;

  // One Worker, one guest thread, one RPC slot. Everything that has to happen on
  // the thread that owns the instance goes through here as a message, because
  // that is the rule phase 1 established the hard way: anything that sets EIP or
  // ESP, or calls run(), is guest work and belongs to the instance's own thread.
  class WorkerLink {
    constructor(opts) {
      if (!Number.isSafeInteger(++endpointSequence)) throw new Error('Worker endpoint identity exhausted');
      this.endpointIdentity = endpointSequence;
      this._loaderRetireTimeout = opts.loaderRetireTimeout || 5000;
      this.slot = opts.slot | 0;
      this.memory = opts.memory;
      this.module = opts.module;
      this.sigs = opts.sigs;
      this.broker = opts.broker;
      this.workerUrl = opts.workerUrl || 'lib/guest-worker.js';
      this.log = opts.log || (() => {});
      this.findDll = opts.findDll || null;
      this.onDllMapped = opts.onDllMapped || null;
      this.onDllRetired = opts.onDllRetired || null;
      this.onRpc = opts.onRpc || null;
      this.onNestedWait = opts.onNestedWait || null;
      this.onAdvanceGuestTime = opts.onAdvanceGuestTime || null;
      this.forwardGuestLogs = forwardGuestLogsFrom(opts);
      this.dxTraceLocal = !!opts.dxTraceLocal;
      this.d3dRenderWorker = !!opts.d3dRenderWorker;
      this.sharedRenderWorker = !!opts.sharedRenderWorker;
      this.createRenderEndpoint = opts.createRenderEndpoint;
      this._renderLegacyChain = Promise.resolve();
      this._renderLegacyEndpoint = null;
      this._renderLegacyControl = null;
      // Build the D3DIM WebGL executor inside this Worker. Only the guest's
      // main thread (slot 0) is given it — a spawned guest thread does not
      // draw, and a second GL context per thread would cost a device each.
      this.d3dimGpu = !!opts.d3dimGpu;
      this.d3dimLazySync = opts.d3dimLazySync !== false;
      // {apiName: nargs}, for --esp-audit. Present means the worker measures
      // every handler's stdcall epilogue against it; absent means no cost.
      this.espExpect = opts.espExpect || null;
      this.onRpcEnd = opts.onRpcEnd || null;
      this.worker = null;
      this._stopPromise = null;
      this._stopped = false;
      this._retiringListeners = new Set();
      this._seq = 0;
      this._pending = new Map();
      this.waveRegistrations = new Map();
      this._waveToken = 0;
      this._waveOffer = null;
      this.sliceStats = { slices: 0, guestMs: 0, rpcSync: 0, rpcAsync: 0, rpcLocal: 0, ends: {} };
    }

    start() {
      if (this._stopped) return Promise.reject(new Error(`worker ${this.slot} stopped`));
      if (NODE_WT) {
        this.worker = new NODE_WT.Worker(this.workerUrl);
        this.worker.on('message', m => this._onMessage(m || {}));
        this.worker.on('error', e => {
          this.log(`[guest-worker ${this.slot}] worker error: ${(e && e.message) || e}`);
          this._transportFailed(e instanceof Error ? e : new Error(String(e)));
        });
        this.worker.on('exit', code => {
          if (!this._stopped) this._transportFailed(new Error(`worker ${this.slot} exited (${code})`));
        });
      } else {
        this.worker = new Worker(this.workerUrl);
        this.worker.onmessage = e => this._onMessage(e.data || {});
        this.worker.onerror = e => {
          this.log(`[guest-worker ${this.slot}] worker error: ${e.message || e}`);
          this._transportFailed(new Error(e.message || 'worker failed'));
        };
      }
      const ready = new Promise((resolve, reject) => {
        // Cleared once the answer arrives: under Node a live timer keeps the
        // process alive, so a run that finished in 200ms would sit for 20s.
        const t = setTimeout(() => reject(new Error(`worker ${this.slot} did not become ready in 20s`)), 20000);
        this._readyPromise = {
          resolve: v => { clearTimeout(t); resolve(v); },
          reject: e => { clearTimeout(t); reject(e); },
        };
      });
      this.worker.postMessage({
        t: 'init', endpointIdentity: this.endpointIdentity,
        module: this.module, memory: this.memory, sigs: this.sigs, slot: this.slot,
        espExpect: this.espExpect, forwardGuestLogs: this.forwardGuestLogs,
        forwardGlLogs: this.forwardGuestLogs, // cached guest-worker compatibility
        dxTraceLocal: this.dxTraceLocal,
        d3dRenderWorker: this.d3dRenderWorker,
        sharedRenderWorker: this.sharedRenderWorker,
        d3dimGpu: this.d3dimGpu,
        d3dimLazySync: this.d3dimLazySync,
      });
      return ready;
    }

    onRetiring(listener) {
      if (this._stopping || this._stopped) { listener(); return () => {}; }
      this._retiringListeners.add(listener);
      return () => this._retiringListeners.delete(listener);
    }

    _beginRetiring() {
      this._stopping = true;
      for (const listener of this._retiringListeners) listener();
      this._retiringListeners.clear();
    }

    _transportFailed(error) {
      // A dead transport cannot admit work. Keep loader pins, scheduler
      // inventory and active frames owned until their existing cleanup paths
      // run; a crash is not a scoped-loader retirement acknowledgement.
      this._transportFailure = error;
      this._beginRetiring();
      if (this._readyPromise) this._readyPromise.reject(error);
      for (const [, pending] of this._pending) pending.reject(error);
      this._pending.clear();
    }

    stop() {
      if (this._stopPromise) return this._stopPromise;
      this._beginRetiring();
      this._stopPromise = (async () => {
        if (this._scopedLoaderUsed && this.worker && !this._loaderRetirementReceipt) {
          let receipt, failure;
          // Lost replies retry the same endpoint retirement identity. A
          // timeout never falls through to killing an owner with retained pins.
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              receipt = await this._ask({ t: 'retireScopedLoaders', endpointIdentity: this.endpointIdentity }, this._loaderRetireTimeout);
              failure = null; break;
            } catch (error) { failure = error; }
          }
          if (failure) throw failure;
          if (!receipt?.retired || receipt.endpointIdentity !== this.endpointIdentity)
            throw new Error('Scoped loader retirement identity mismatch');
          this._loaderRetirementReceipt = receipt;
        }
        return this._terminateAfterLoaderRetirement();
      })();
      this._stopPromise.catch(error => {
        this._loaderRetirementFault = error;
        this._stopPromise = null; // an explicit later stop retries the same identity
        this.log(`[guest-worker ${this.slot}] loader retirement failed; owner retained: ${error.message || error}`);
      });
      return this._stopPromise;
    }

    async _terminateAfterLoaderRetirement() {
      this._stopped = true;
      if (this._threadSendWaitRetire) this._threadSendWaitRetire();
      const readiness = this._readyPromise;
      this._readyPromise = null;
      if (readiness) readiness.reject(new Error(`worker ${this.slot} stopped`));
      this.waveRegistrations.clear();
      this._waveOffer = null;
      const worker = this.worker;
      const termination = Promise.resolve().then(() => worker && worker.terminate()).then(() => {
        if (this.worker === worker) this.worker = null;
      });
      if (!this._renderLegacyRetirement) {
        this._renderLegacyRetirement = this._renderLegacyChain.catch(() => {}).then(() =>
          this._renderLegacyEndpoint?.terminate());
        this._renderLegacyRetirement.catch(error => {
          this._renderLegacyRetirement = null;
          this.log(`[render ${this.slot}] endpoint retirement failed: ${error.message || error}`);
        });
      }
      for (const [, p] of this._pending) p.reject(new Error(`worker ${this.slot} stopped`));
      this._pending.clear();
      // Browser terminate() is synchronous; Node returns a promise for the
      // worker's exit. Both must finish before the shared memory is released.
      const results = await Promise.allSettled([termination, this._renderLegacyRetirement]);
      const failed = results.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
      this._retirementComplete = true;
    }

    _onMessage(msg) {
      if (this._stopped) return;
      switch (msg.t) {
        case 'dllLookup': {
          Promise.resolve().then(() => {
            if (!this.findDll) throw new Error('Worker DLL resolver is unavailable');
            return this.findDll(msg.fileName, msg.fullName);
          }).then(bytes => {
            if (!this._stopped && this.worker) this.worker.postMessage({
              t: 'dllLookupResult', lookup: msg.lookup, bytes: bytes || null,
            });
          }, error => {
            if (!this._stopped && this.worker) this.worker.postMessage({
              t: 'dllLookupResult', lookup: msg.lookup, error: String(error && error.message || error),
            });
          });
          break;
        }
        case 'dllMapped':
          if (this.onDllMapped) this.onDllMapped(msg.record);
          break;
        case 'dllRetired':
          if (this.onDllRetired) this.onDllRetired(msg.record);
          break;
        case 'renderLegacy':
          this._forwardRenderLegacy(msg.message);
          break;
        case 'ready':
          this.log(`[guest-worker ${this.slot}] instantiated: ${msg.exports} exports, ${msg.imports} brokered imports`);
          if (this._readyPromise) this._readyPromise.resolve(msg);
          break;
        case 'rpc':
          // A blocking host call. The worker is parked in Atomics.wait until
          // this returns, so it must not be deferred. The slot names which
          // control block to read — with N threads there are N of them.
          //
          // The hooks tell the scheduler WHICH guest thread is inside the host
          // right now, which is the only way an import like ExitThread can know
          // who called it: it takes no handle, and in this mode the caller is not
          // on this thread at all. Serving is synchronous, so the answer cannot
          // go stale mid-call.
          if (this.onRpc) this.onRpc(this.slot);
          try {
            this.broker.serveRpc(msg.slot === undefined ? this.slot : msg.slot, msg.waitEntry);
          } finally {
            if (this.onRpcEnd) this.onRpcEnd(this.slot);
          }
          break;
        case 'glBatch':
          if (this.onRpc) this.onRpc(this.slot);
          try {
            this.broker.serveGlBatch(msg);
          } finally {
            if (this.onRpcEnd) this.onRpcEnd(this.slot);
          }
          break;
        case 'call':
          this.broker.serveCall(msg);
          break;
        case 'calls':
          this.broker.serveCalls(msg);
          break;
        case 'advanceGuestTime': {
          // The Worker is synchronously parked on its RPC control slot. Update
          // the host's authoritative clock first, then publish that exact value
          // and wake it so DllMain's next GetTickCount observes the Sleep.
          const delta = Math.floor(Math.min(
            0x7FFFFFFF, Math.max(0, Number(msg.ms) || 0)));
          let tick;
          if (this.onAdvanceGuestTime) {
            try { tick = this.onAdvanceGuestTime(delta); }
            catch (error) {
              this.log(`[guest-worker ${this.slot}] clock advance failed: ${error.message || error}`);
            }
          }
          if (!Number.isFinite(tick)) {
            const pub = RPC.views(this.memory, 0).pub;
            tick = (Atomics.load(pub, RPC.SLOT.TICK) + delta) & 0x7FFFFFFF;
          }
          this.broker.serveClockAdvance(
            msg.slot === undefined ? this.slot : msg.slot, tick);
          break;
        }
        case 'waveRegistered': {
          const r = msg.registration;
          if (r && Number.isSafeInteger(r.generation) && r.generation > 0)
            this.waveRegistrations.set(r.handle >>> 0, Object.freeze({...r}));
          break;
        }
        case 'waveRetired': {
          const r = msg.registration, live = r && this.waveRegistrations.get(r.handle >>> 0);
          if (live && live.generation === r.generation) this.waveRegistrations.delete(r.handle >>> 0);
          break;
        }
        case 'nestedWaitBegin':
        case 'nestedWaitEnd':
          if (this.onNestedWait) this.onNestedWait(msg.t === 'nestedWaitBegin', msg);
          break;
        case 'error':
          this.log(`[guest-worker ${this.slot}] ${msg.stage}: ${msg.message}`);
          if (msg.seq !== undefined) {
            const pending = this._pending.get(msg.seq);
            this._pending.delete(msg.seq);
            if (pending) pending.reject(new Error(msg.message));
            break;
          }
          for (const [, p] of this._pending) p.reject(new Error(msg.message));
          this._pending.clear();
          break;
        default: {
          // Every other reply is an answer to an _ask, matched by seq. Listing
          // the message names here as well was pure duplication — a new message
          // type meant editing two places and getting "unexpected message" if
          // you forgot.
          const p = msg.seq !== undefined ? this._pending.get(msg.seq) : null;
          if (p) { this._pending.delete(msg.seq); p.resolve(msg); }
          else this.log(`[guest-worker ${this.slot}] unexpected message ${msg.t}`);
        }
      }
    }

    _forwardRenderLegacy(message) {
      if (!this.worker) return;
      if (message?.t === 'init' && message.control)
        this._renderLegacyControl = new Int32Array(message.control);
      const fail = error => {
        // The guest may be parked inside Encoder._waitFor and cannot service
        // a message event. Publish its existing shared error flag as well.
        if (this._renderLegacyControl) {
          const stream = NODE_WT ? require('./d3d-command-stream') : root.D3DCommandStream;
          Atomics.store(this._renderLegacyControl, stream.CTRL.ERROR, 1);
          Atomics.notify(this._renderLegacyControl, stream.CTRL.READY);
          Atomics.notify(this._renderLegacyControl, stream.CTRL.COMPLETED);
        }
        this.log(`[render ${this.slot}] ${error.message || error}`);
        this.worker?.postMessage({ t: 'renderLegacyEvent',
          message: { t: 'error', error: error.message || String(error) } });
      };
      this._renderLegacyChain = this._renderLegacyChain.then(async () => {
        if (!this._renderLegacyEndpoint) {
          if (!this.createRenderEndpoint) throw new Error('Shared render endpoint factory unavailable');
          const endpoint = await this.createRenderEndpoint({ api: 'legacy',
            backend: this.d3dimGpu ? 'webgl' : 'software' });
          this._renderLegacyEndpoint = endpoint;
          endpoint.addEventListener('message', event => {
            this.worker?.postMessage({ t: 'renderLegacyEvent', message: event.data });
          });
          endpoint.addEventListener('error', fail);
          await endpoint.ready;
        }
        // Completion belongs to the shared Encoder control block. Only port
        // initialization is awaited here, never a draw or batch fence.
        this._renderLegacyEndpoint.postMessage(message);
      });
      this._renderLegacyChain.catch(fail);
    }

    _ask(msg, timeoutMs) {
      if (this._transportFailure) return Promise.reject(this._transportFailure);
      if (this._stopping && msg.t !== 'retireScopedLoaders') return Promise.reject(new Error('Callback owner retired'));
      const seq = ++this._seq;
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          if (this._pending.delete(seq)) reject(new Error(`worker ${this.slot} did not answer ${msg.t} in ${timeoutMs || 30000}ms`));
        }, timeoutMs || 30000);
        this._pending.set(seq, {
          resolve: v => { clearTimeout(t); resolve(v); },
          reject: e => { clearTimeout(t); reject(e); },
        });
        try {
          this.worker.postMessage(Object.assign({ seq }, msg));
          // A slice is only ever posted to an idle Worker; anything else may
          // find it parked in a local message wait (see guest-worker.js).
          if (msg.t !== 'slice' && this.memory && RPC.bumpMail) RPC.bumpMail(this.memory, this.slot);
        } catch (error) {
          // postMessage throws synchronously when even one nested field cannot
          // be structured-cloned. Do not leave the request (and its long DLL
          // loader timer) pending after the browser has already rejected it.
          const pending = this._pending.get(seq);
          this._pending.delete(seq);
          const detail = error && error.message ? error.message : String(error);
          pending.reject(new Error(`worker ${this.slot} could not post ${msg.t}: ${detail}`));
        }
      });
    }

    // Call one export on this worker's instance. Async by necessity: the main
    // thread cannot block on a worker (Atomics.wait is forbidden here), which is
    // why every main-side use of a guest export has to be restructured rather
    // than proxied. There are only a handful, and they are enumerated.
    async callExport(name, ...args) {
      const r = await this._ask({ t: 'callExport', name, args });
      if (r.missing) throw new Error(`guest instance has no export ${name}`);
      return r.value;
    }

    // One logical offer per exact WorkerLink. Retrying ambiguity keeps its token.
    // The scheduler still owns all run()/slice execution after acceptance.
    async offerWaveCallback(registration, waveHdr, timeoutMs = 1000, cancelled = false) {
      if (!this.worker) return {status:'retired'};
      const pending=this._waveOffer;
      const live=pending ? pending.registration : this.waveRegistrations.get(registration.handle >>> 0);
      if (!live || live.generation!==registration.generation ||
          live.callback!==registration.callback || live.instance!==registration.instance)
        return {status:'retired'};
      const signature=[live.handle,live.generation,live.callback,live.instance,waveHdr>>>0].join(':');
      if (this._waveOffer && this._waveOffer.signature!==signature) return {status:'busy'};
      if (!this._waveOffer) this._waveOffer={token:++this._waveToken,signature,worker:this.worker,registration:live};
      const offer=this._waveOffer;
      if (offer.pending) return {status:'busy'};
      offer.pending=true;
      try {
        const result=await this._ask({t:'waveCallback',token:offer.token,registration:live,waveHdr:waveHdr>>>0,cancelled:cancelled===true},timeoutMs);
        if (this.worker!==offer.worker) return {status:'retired'};
        if (['accepted','busy','retired','invalid','expired','stale-token','token-conflict'].includes(result.status)) this._waveOffer=null;
        return result;
      } catch(error) {
        // The owner may already have entered the callback. Same token only.
        return {status:this.worker===offer.worker?'ambiguous':'retired',error:String(error.message||error),token:offer.token};
      } finally {offer.pending=false;}
    }

    async readExports(names) {
      const r = await this._ask({ t: 'readExports', names });
      return r.values;
    }

    // Run one slice and report where the guest ended up.
    // `sync` carries process-wide state that lives in per-instance globals (the
    // thunk cursor, the DLL count). It rides along with the slice so keeping N
    // instances agreeing costs no extra round trips.
    async slice(steps, sync, localSleep, retryYield9 = false) {
      const message = localSleep ? { t: 'slice', steps, sync, localSleep }
        : { t: 'slice', steps, sync };
      if (retryYield9) message.retryYield9 = true;
      const r = await this._ask(message, 60000);
      this.sliceStats.slices++;
      this.sliceStats.guestMs += r.ms || 0;
      // Why each slice ended (0 = budget or plain return, else $yield_reason;
      // 's' = a Sleep yield). Many near-empty slices a second is the cost to
      // look for in this mode — each is a full rendezvous — and this says
      // which wait is making them.
      const why = r.sleepYielded ? 's' : String(r.yield | 0);
      this.sliceStats.ends[why] = (this.sliceStats.ends[why] || 0) + 1;
      if (r.rpc) {
        this.sliceStats.rpcSync = r.rpc.sync;
        this.sliceStats.rpcAsync = r.rpc.async;
        this.sliceStats.rpcLocal = r.rpc.local;
      }
      if (r.d3d) this.d3dStats = r.d3d;
      return r;
    }

    // Set this instance up as guest thread `tid`: identity, PE metadata, stack,
    // TIB and entry point. Every value is computed on the main thread (the heap
    // and the shared cursors live in the shared memory both sides see) and every
    // export call happens over there, where the instance is.
    initGuestThread(spec) {
      return this._ask(Object.assign({ t: 'initGuestThread' }, spec));
    }

    // Satisfy a wait this instance is parked on: set EAX, drop the stdcall
    // frame, and resume at the return address. The return-address heuristic
    // needs both the exports and linear memory, so it runs worker-side.
    completeWait(result, waitStackBytes, waitToken, namedWaitSequence) {
      return this._ask({ t: 'completeWait', result, waitStackBytes, waitToken, namedWaitSequence });
    }
    reserveThreadSendWait(waitToken) { return this._ask({ t: 'reserveThreadSendWait', waitToken }); }
    cancelThreadSendWait(waitToken) {
      const record = this.threadSendWaitResults?.get(waitToken.frameToken + ':' + waitToken.waitEpoch);
      if (record && ['consumed', 'delivered', 'faulted'].includes(record.phase)) {
        return Promise.resolve({ cancelled: false, consumed: true });
      }
      return this._ask({ t: 'cancelThreadSendWait', waitToken });
    }

    scopedThreadSendYield(token, finish = false) {
      return this._ask({ t: 'scopedThreadSendYield', token, finish });
    }
    scopedThreadSendLoader(token, request) {
      this._scopedLoaderUsed = true;
      return this._ask({ t: 'scopedThreadSendLoader', endpointIdentity: this.endpointIdentity, token, request }, 120000);
    }

    completeThreadSend(result) {
      return this._ask({ t: 'completeThreadSend', result });
    }
    beginProcessSendWait() { return this._ask({ t: 'beginProcessSendWait' }); }
    async completeProcessSendWait(waitToken, result) {
      const message = { t: 'completeProcessSendWait', waitToken, result };
      try { return await this._ask(message); }
      catch (error) {
        if (this._stopped) throw error;
        return this._ask(message);
      }
    }

    dispatchThreadSend(args) {
      return this._ask(Object.assign({ t: 'dispatchThreadSend' }, args), 60000);
    }

    async resumeThreadSendDispatch(nestedResult, frameToken, waitEpoch, lastError) {
      const msg = { t: 'resumeThreadSendDispatch', frameToken, waitEpoch, lastError };
      if (nestedResult !== undefined) msg.nestedResult = nestedResult;
      let result;
      try { result = await this._ask(msg, 60000); }
      catch (error) {
        if (waitEpoch === undefined || this._stopped) throw error;
        result = await this._ask(msg, 60000); // same resume identity after ambiguous reply
      }
      if (!result.ownershipMismatch && !result.waitPending && this.threadSendWaitResults) {
        for (const [key, record] of this.threadSendWaitResults) {
          if (record.token.frameToken === frameToken && record.phase === 'delivered') this.threadSendWaitResults.delete(key);
        }
      }
      return result;
    }
    acknowledgeThreadSendResume(frameToken, waitEpoch) {
      return this._ask({ t: 'acknowledgeThreadSendResume', frameToken, waitEpoch });
    }

    resumeThreadSendMessageWait(hostInput, waitToken) {
      return this._ask({ t: 'resumeThreadSendMessageWait', hostInput: !!hostInput, waitToken }, 60000);
    }

    abortThreadSendDispatch(restore = true, frameToken) {
      return this._ask({ t: 'abortThreadSendDispatch', restore, frameToken }, 60000);
    }

    syncThunks(thunkEnd, numThunks) {
      return this._ask({ t: 'syncThunks', thunkEnd, numThunks });
    }
  }

  class GuestThreadHost {
    constructor(opts) {
      this.memory = opts.memory;
      this.module = opts.module;
      this.sigs = opts.sigs;
      this.hostImports = opts.hostImports;      // the real table, from createHostImports
      this.workerUrl = opts.workerUrl || 'lib/guest-worker.js';
      this.log = opts.log || (() => {});
      this.findDll = opts.findDll || null;
      this.onDllMapped = opts.onDllMapped || null;
      this.onDllRetired = opts.onDllRetired || null;
      this.tickMs = opts.tickMs || (() => Date.now());
      this.advanceGuestTime = opts.advanceGuestTime || null;
      this.threadSendYieldResolver = opts.threadSendYieldResolver || null;
      this.threadManager = null;
      // A function slot => import table, when each thread wants its own (the CLI
      // tags every log line with the thread's tid). Falls back to the one shared
      // table, which is what the browser has.
      this.hostImportsForSlot = opts.hostImportsForSlot || null;
      // CLI mode: the guest's MAIN thread stays in-process and only CreateThread
      // threads get Workers. Slot 0 has no worker then, so PE metadata is read
      // from the local instance instead — a getter, because run.js does not have
      // the instance yet when this is constructed.
      //
      // This is NOT the browser's shape and is not pretending to be: there the
      // main thread is a Worker too. What it does buy is real coverage of the
      // shared-memory locks, the per-thread RPC blocks and the worker scheduler
      // from a headless test, plus one thing the browser cannot check — that no
      // WAT lock is ever held across a host import, since here the main thread
      // both runs guest code and serves the workers' RPC.
      this.localMainExports = opts.localMainExports || null;
      // 0 disables the clock interval: the CLI's guest clock is derived from the
      // batch counter, not from the wall clock, so it publishes by hand.
      this.clockIntervalMs = opts.clockIntervalMs === undefined ? 4 : opts.clockIntervalMs;
      // Count brokered calls per thread, for --rpc-census. See the broker.
      this.countCalls = !!opts.countCalls;
      this.espExpect = opts.espExpect || null;
      this.forwardGuestLogs = forwardGuestLogsFrom(opts);
      this.dxTraceLocal = !!opts.dxTraceLocal;
      this.d3dRenderWorker = !!opts.d3dRenderWorker;
      this.sharedRenderWorker = !!opts.sharedRenderWorker;
      this.createRenderEndpoint = opts.createRenderEndpoint;
      this.d3dimGpu = !!opts.d3dimGpu;
      this.d3dimLazySync = opts.d3dimLazySync !== false;
      this.broker = null;
      this.link = null;                         // slot 0 — the guest's main thread
      this.threadLinks = new Map();             // slot → WorkerLink, one per guest thread
      this._startingLinks = new Set();
      this._stopped = false;
      this._stopPromise = null;
      this.slotTid = new Map();                 // slot → guest tid, for per-slot tables
      this._nextSlot = 1;
      // These counters/stacks and _localLink share this host's lifetime. Never
      // recreate just the link or reset its token counter with frames alive.
      this._localSendFrames = [];
      this._localSendWaits = new ThreadSendWaits(this._localSendFrames);
      this._nestedWaitActive = 0;
      this._nestedWaitPump = null;
      this._localLink = this.localMainExports ? {
        beginProcessSendWait: async () => this._localSendWaits.beginRootSend(this.localMainExports()),
        completeProcessSendWait: async (token, result) => this._localSendWaits.completeRootSend(token, result, this.localMainExports()),
        completeThreadSend: async result => {
          if (this._stopped) throw new Error('Local callback owner retired');
          if (this._localSendWaits.fenced()) throw new Error('Callback wait reservation fences completeThreadSend');
          const ex = this.localMainExports();
          ex.complete_thread_send(result | 0);
        },
        dispatchThreadSend: async args => this._dispatchLocalThreadSend(args),
        resumeThreadSendDispatch: async (value, token, epoch, lastError) => {
          try { return await this._resumeLocalThreadSend(value, token, epoch, lastError); }
          catch (error) {
            if (epoch === undefined || this._stopped) throw error;
            return this._resumeLocalThreadSend(value, token, epoch, lastError);
          }
        },
        acknowledgeThreadSendResume: async (token, epoch) => this._localSendWaits.acknowledgeResume(token, epoch),
        resumeThreadSendMessageWait: async (hostInput, token) => this._resumeLocalThreadSendMessageWait(hostInput, token),
        completeWait: async (result, bytes, token) => this._completeLocalThreadSendWait(result, bytes, token),
        reserveThreadSendWait: async token => this._localSendWaits.reserve(token),
        cancelThreadSendWait: async token => {
          const record = this._localLink.threadSendWaitResults?.get(token.frameToken + ':' + token.waitEpoch);
          if (record && ['consumed', 'delivered', 'faulted'].includes(record.phase)) return { cancelled: false, consumed: true };
          return this._localSendWaits.cancel(token);
        },
        scopedThreadSendYield: async (token, finish = false) => {
          if (this._stopped) throw new Error('Local callback owner retired');
          return this._localSendWaits.scopedYield(token, this.localMainExports(), finish);
        },
        scopedThreadSendLoader: async (token, request) => {
          if (this._stopped) throw new Error('Local callback owner retired');
          const ex = this.localMainExports();
          return this._localSendWaits.loader(token, ex, ex.memory.buffer, ProcessBoot, request, this.advanceGuestTime);
        },
        callExport: async (name, ...args) => {
          if (this._stopped) throw new Error('Local callback owner retired');
          this._localSendWaits.checkExport(name);
          const ex = this.localMainExports();
          if (!ex || typeof ex[name] !== 'function') throw new Error(`guest instance has no export ${name}`);
          return ex[name](...args);
        },
        abortThreadSendDispatch: async (restore, token) => this._abortLocalThreadSend(restore, token),
      } : null;
    }

    linkForWin32Tid(tid) {
      tid |= 0;
      if (tid === 1) return this.link || this._localLink;
      const guestTid = tid - 1;
      for (const [slot, link] of this.threadLinks) {
        if ((this.slotTid.get(slot) | 0) === guestTid) return link;
      }
      return null;
    }

    _snapshotLocalSend(ex) {
      const g = name => ex[name] ? ex[name]() | 0 : 0;
      return {
        eip: g('get_eip'), esp: g('get_esp'), ebp: g('get_ebp'), eax: g('get_eax'),
        ebx: g('get_ebx'), ecx: g('get_ecx'), edx: g('get_edx'),
        esi: g('get_esi'), edi: g('get_edi'),
        handlerSetEip: g('get_handler_set_eip'), steps: g('get_steps'),
        yieldReason: g('get_yield_reason'), yieldFlag: g('get_yield_flag'),
        renderToken: g('get_d3d_render_token'),
      };
    }

    _restoreLocalSend(ex, s) {
      ex.set_esp(s.esp); ex.set_ebp(s.ebp); ex.set_eax(s.eax);
      ex.set_ebx(s.ebx); ex.set_ecx(s.ecx); ex.set_edx(s.edx);
      ex.set_esi(s.esi); ex.set_edi(s.edi);
      ex.set_handler_set_eip(s.handlerSetEip); ex.set_steps(s.steps);
      ex.set_yield_state(s.yieldReason, s.yieldFlag); ex.set_eip(s.eip);
      if (ex.set_d3d_render_token) ex.set_d3d_render_token(s.renderToken || 0);
    }

    _finishLocalThreadSend(ex, result) {
      const entry = this._localSendFrames.pop();
      if (entry && ex.thread_send_post) {
        const s = entry.send;
        result = ex.thread_send_post(
          s.hwnd, s.msg, s.wparam, s.lparam, s.postKind, result | 0) | 0;
      }
      if (entry) this._restoreLocalSend(ex, entry.snapshot);
      return result | 0;
    }

    _driveLocalThreadSend() {
      const ex = this.localMainExports();
      for (let round = 0; round < 64; round++) {
        let trapped = null;
        try {
          if (!this._localSendWaits.driveLoader(ex)) ex.run(1000000);
        } catch (err) { trapped = String(err && err.message || err); }
        const publication = this._localSendWaits.loaderPublication();
        if (!trapped && publication) return publication;
        const y = ex.get_yield_reason ? ex.get_yield_reason() | 0 : 0;
        if (trapped) return { trapped, yield: y };
        if (y === 10) return {
          ...this._localSendWaits.observe(y),
          nested: true, yield: y,
          targetTid: ex.get_send_target_tid() | 0,
          hwnd: ex.get_send_hwnd() | 0, msg: ex.get_send_msg() | 0,
          wparam: ex.get_send_wparam() | 0, lparam: ex.get_send_lparam() | 0,
          postKind: ex.get_send_post_kind ? ex.get_send_post_kind() | 0 : 0,
        };
        if (y) return {
          ...this._localSendWaits.observe(y), blocked: true, yield: y,
          renderToken: ex.get_d3d_render_token ? ex.get_d3d_render_token() | 0 : 0,
          waitHandle: ex.get_wait_handle ? ex.get_wait_handle() >>> 0 : 0,
          waitHandlesPtr: ex.get_wait_handles_ptr ? ex.get_wait_handles_ptr() >>> 0 : 0,
          waitAll: ex.get_wait_all ? !!ex.get_wait_all() : false,
          waitTimeout: ex.get_wait_timeout ? ex.get_wait_timeout() >>> 0 : 0xFFFFFFFF,
          waitStackBytes: ex.get_wait_stack_bytes ? ex.get_wait_stack_bytes() | 0 : 12,
        };
        if (!(ex.get_eip() >>> 0)) {
          const result = ex.thread_send_end() | 0;
          return { done: true, result: this._finishLocalThreadSend(ex, result) };
        }
      }
      return { blocked: true, yield: 0, budget: true };
    }

    async _dispatchLocalThreadSend(args) {
      if (this._stopped) return { unavailable: true };
      const ex = this.localMainExports();
      if (args.requireMessagePoint) {
        const y = ex.get_yield_reason() | 0;
        if (y === 10 && !this._localSendFrames.length && !this._localSendWaits.rootSend)
          return { deferred: true };
        if (y === 2 || !ex.get_eip()) return { unavailable: true };
        if (((this._localSendFrames.length || this._localSendWaits.rootSend) && !this._localSendWaits.admission(args.admission, y)) ||
            ![7, 10, 15, 17].includes(y)) return { deferred: true };
      }
      if (!Number.isSafeInteger(args.frameToken) || args.frameToken <= (this._lastLocalSendFrameToken || 0)) {
        return { ownershipMismatch: true };
      }
      this._lastLocalSendFrameToken = args.frameToken;
      const frame = this._snapshotLocalSend(ex);
      if (ex.set_d3d_render_token) ex.set_d3d_render_token(0);
      const send = {
        hwnd: args.hwnd | 0, msg: args.msg | 0,
        wparam: args.wparam | 0, lparam: args.lparam | 0,
        postKind: args.postKind | 0,
      };
      this._localSendFrames.push({ snapshot: frame, send, frameToken: args.frameToken });
      if (send.postKind === 1 && (!send.wparam || !send.lparam)) {
        return { done: true, result: this._finishLocalThreadSend(ex, 0) };
      }
      if (!(ex.thread_send_begin(args.hwnd | 0, args.msg | 0,
        args.wparam | 0, args.lparam | 0) | 0)) {
        return { done: true, result: this._finishLocalThreadSend(ex, ex.get_eax() | 0) };
      }
      return this._driveLocalThreadSend();
    }

    _ownsLocalSendFrame(frameToken) {
      const top = this._localSendFrames[this._localSendFrames.length - 1];
      return !!top && top.frameToken === frameToken;
    }

    async _resumeLocalThreadSend(nestedResult, frameToken, waitEpoch, lastError) {
      if (this._stopped) throw new Error('Local callback owner retired');
      const receipt = this._localSendWaits.resumeReceipt(frameToken, waitEpoch);
      if (receipt) return receipt;
      if (!this._ownsLocalSendFrame(frameToken)) return {
        ownershipMismatch: true,
        waitPending: this._localSendFrames.some(f => f.frameToken === frameToken && (f.wait || f.sendWait || f.scope)),
      };
      if (!this._localSendWaits.beforeResume(frameToken, waitEpoch)) return { waitPending: true };
      for (const [key, record] of this._localLink.threadSendWaitResults || []) {
        if (record.token.frameToken === frameToken && record.phase === 'delivered') this._localLink.threadSendWaitResults.delete(key);
      }
      const ex = this.localMainExports();
      if (lastError !== undefined) ex.set_last_error(lastError | 0);
      if (nestedResult !== undefined) ex.complete_thread_send(nestedResult | 0);
      else if ((ex.get_yield_reason() | 0) === 9) ex.clear_yield();
      const result = this._driveLocalThreadSend();
      this._localSendWaits.saveResume(frameToken, waitEpoch, result);
      return result;
    }

    async _completeLocalThreadSendWait(result, waitStackBytes, token) {
      if (this._stopped) throw new Error('Local callback wait owner retired');
      if (this._localSendFrames.length) {
        return this._localSendWaits.complete(token, [result, waitStackBytes], kind => {
          if (kind !== 1) throw new Error('Wrong callback wait kind');
          return this._applyLocalThreadSendWait(result, waitStackBytes);
        }, 1);
      }
      if (token) return { ownershipMismatch: true };
      return this._applyLocalThreadSendWait(result, waitStackBytes);
    }
    _applyLocalThreadSendWait(result, waitStackBytes) {
      const ex = this.localMainExports();
      const retAddr = ex.guest_read32(ex.get_esp()) >>> 0;
      ex.clear_yield();
      ex.set_eax(result | 0);
      ex.set_esp(ex.get_esp() + (waitStackBytes | 0));
      ex.set_eip(retAddr);
      return { eip: retAddr };
    }

    async _resumeLocalThreadSendMessageWait(hostInput, token) {
      if (this._stopped) throw new Error('Local callback wait owner retired');
      if (this._localSendFrames.length) {
        const reserved = this._localSendWaits.reserve(token, 7);
        if (!reserved.reserved) return reserved;
        return this._localSendWaits.complete(token, ['message'], kind => {
          if (kind !== 7) throw new Error('Wrong callback wait kind');
          return this._applyLocalThreadSendMessageWait(hostInput);
        }, 7);
      }
      if (token) return { ownershipMismatch: true };
      return this._applyLocalThreadSendMessageWait(hostInput);
    }
    _applyLocalThreadSendMessageWait(hostInput) {
      const ex = this.localMainExports();
      if ((ex.get_yield_reason() | 0) !== 7) return { resumed: false };
      const hasLocal = ex.has_pending_message ? (ex.has_pending_message() | 0) : 0;
      if (!hasLocal && !hostInput) return { resumed: false };
      const retAddr = ex.guest_read32(ex.get_esp()) >>> 0;
      const resumed = !!(ex.resume_message_wait && (ex.resume_message_wait() | 0));
      if (resumed) ex.set_eip(retAddr);
      return { resumed };
    }

    async _abortLocalThreadSend(restore = true, frameToken) {
      if (!this._ownsLocalSendFrame(frameToken)) return { aborted: false, ownershipMismatch: true };
      if (!this._localSendWaits.canAbort(frameToken)) return { aborted: false, waitPending: true };
      const ex = this.localMainExports();
      const entry = this._localSendFrames.pop();
      if (!entry) return { aborted: false };
      ex.thread_send_end();
      if (restore !== false) this._restoreLocalSend(ex, entry.snapshot);
      return { aborted: true };
    }

    async _resolveThreadSendBlockedYield(link, r, state, activeLinks) {
      const resolver = this.threadSendYieldResolver
        || (this.threadManager && this.threadManager.resolveThreadSendYield
          ? this.threadManager.resolveThreadSendYield.bind(this.threadManager) : null);
      if (resolver) return resolver(link, r, state, activeLinks);
      if (r.yield === 9) {
        const result = await link.scopedThreadSendYield(r, true);
        if (result.ownershipMismatch) throw new Error('Callback yield ownership mismatch');
        return result.completed ? 'resume' : 'pending';
      }
      if (r.yield === 6) return 'resume';
      return 'abort';
    }

    async _abortThreadSendLink(link, restore, frameToken) {
      if (!link || !link.abortThreadSendDispatch) return;
      let result;
      try { result = await link.abortThreadSendDispatch(restore, frameToken); } catch (_) { return; }
      if (result && result.waitPending) throw new Error('Cannot abort a reserved callback wait; result remains owned');
    }

    // Windows delivers a cross-thread SendMessage only while the receiving
    // thread is inside a message call (GetMessage, PeekMessage, SendMessage,
    // a wait that pumps). Dispatching into the main thread at whatever point
    // its last slice stopped re-entered its window procedure mid-code: WinBoard
    // draws the board from that procedure, and a reply delivered in the middle
    // of its own redraw left e2 drawn and the old highlights up while its
    // last-drawn bookkeeping moved on. The cooperative scheduler already has
    // the rule (ThreadManager._sendTargetAtMessagePoint / incoming_send_pending);
    // ThreadManager applies it to Worker senders through these three calls,
    // without ever waiting on main (the scheduler that runs main is the one
    // that would be waiting).
    _mainLink() { return this.link || this._localLink; }

    async mainAtMessagePoint() {
      const link = this._mainLink();
      if (!link) return true;
      let y = 0;
      try { y = (await link.callExport('get_yield_reason')) | 0; } catch (_) { return true; }
      return y === 7 || y === 10 || y === 15 || y === 17;
    }

    async armMainIncomingSend() {
      const link = this._mainLink();
      if (link) { try { await link.callExport('set_incoming_send_pending', 1); } catch (_) {} }
    }

    // Main stopped at yield 17 for sends that have now been delivered: its
    // message call runs again.
    async releaseMainMessagePoint() {
      const link = this._mainLink();
      if (!link) return;
      try {
        if (((await link.callExport('get_yield_reason')) | 0) === 17) {
          await link.callExport('set_incoming_send_pending', 0);
          await link.callExport('clear_yield');
        }
      } catch (_) {}
    }

    async _dispatchThreadSendToLink(link, args, depth, activeLinks, processContext) {
      if (!link || depth > 64) {
        if (processContext) throw new Error('Process send target missing or nesting limit exceeded');
        return 0;
      }
      // Allocate before posting: a lost dispatch reply must never authorize
      // cleanup of some newer frame. Tokens belong to this link, not a PID/TID.
      const frameToken = (link.nextThreadSendFrameToken || 0) + 1;
      if (!Number.isSafeInteger(frameToken)) throw new Error('Thread send frame token exhausted');
      link.nextThreadSendFrameToken = frameToken;
      args = { ...args, frameToken };
      const frames = link.sendDrivers || (link.sendDrivers = []);
      let unwound;
      const driver = { frameToken, done: new Promise(resolve => { unwound = resolve; }) };
      frames.push(driver);
      link.threadSendDepth = (link.threadSendDepth || 0) + 1;
      try {
        return await this._driveThreadSendToLink(link, args, depth, activeLinks, processContext);
      } catch (error) {
        await this._waitForSendDriver(link, frameToken);
        // A nested foreign failure must unwind this receiver frame too.
        if (processContext) await this._abortThreadSendLink(link, false, args.frameToken);
        throw error;
      } finally {
        await this._waitForSendDriver(link, frameToken);
        frames.pop();
        unwound();
        link.threadSendDepth--;
      }
    }

    async _waitForSendDriver(link, frameToken) {
      while (link.sendDrivers?.length && link.sendDrivers.at(-1).frameToken !== frameToken)
        await link.sendDrivers.at(-1).done;
    }

    async _driveThreadSendToLink(link, args, depth, activeLinks, processContext) {
      if (!link || depth > 64) return 0;
      activeLinks = activeLinks || new Set();
      activeLinks.add(link);
      const yieldState = { waitPolls: 0, waitStartedAt: 0 };
      const failed = error => {
        if (processContext) throw error instanceof Error ? error : new Error(String(error));
        return 0;
      };
      try {
      let r;
      try { r = await link.dispatchThreadSend(args); }
      catch (error) {
        // The command may have reached the Worker before its reply channel
        // failed. Best-effort cleanup keeps a surviving instance from retaining
        // the nested interpreter frame indefinitely.
        if (!processContext) await this._abortThreadSendLink(link, false, args.frameToken);
        return failed(error);
      }
      for (let polls = 0; polls < 10000; polls++) {
        if (r && r.ownershipMismatch) throw new Error('Thread send frame ownership mismatch');
        if (r && (r.deferred || r.unavailable)) return r;
        if (r && r.done) return r.result | 0;
        if (r && r.nested) {
          const nestedTarget = this.linkForWin32Tid(r.targetTid | 0);
          const nestedArgs = {
            hwnd: r.hwnd | 0, msg: r.msg | 0,
            wparam: r.wparam | 0, lparam: r.lparam | 0,
            postKind: r.postKind | 0,
          };
          let nestedResult;
          const leaveWait = processContext && this.processSendWait?.(processContext, link, r);
          try {
            if ((r.targetTid | 0) < 0 || (processContext && this.processLocalSend)) {
              nestedResult = await this._resolveProcessSend(link,
                {...nestedArgs,targetTid:r.targetTid|0},processContext,r);
            } else {
              nestedResult = await this._dispatchThreadSendToLink(nestedTarget,
                nestedArgs, depth + 1, activeLinks, processContext);
            }
          } finally {
            if (leaveWait) await leaveWait();
            await this._waitForSendDriver(link, args.frameToken);
          }
          try {
            const epoch = r.waitEpoch;
            r = await link.resumeThreadSendDispatch(nestedResult?.result ?? nestedResult, args.frameToken, epoch,
              nestedResult?.lastError);
            if (r.waitPending || r.ownershipMismatch) throw new Error('Send wait ownership lost');
            await link.acknowledgeThreadSendResume(args.frameToken, epoch).catch(() => {});
          }
          catch (error) {
            if (!processContext) await this._abortThreadSendLink(link, false, args.frameToken);
            return failed(error);
          }
          continue;
        }
        if (r && (r.trapped || r.yield === 2)) {
          if (!processContext) await this._abortThreadSendLink(link, false, args.frameToken);
          return failed(new Error(r.trapped || 'Process send receiver exited'));
        }
        if (r && r.blocked && r.yield !== 0) {
          let action = 'abort';
          const leaveWait = processContext && [7, 15].includes(r.yield) &&
            this.processSendWait?.(processContext, link, r);
          try { action = await this._resolveThreadSendBlockedYield(link, r, yieldState, activeLinks); }
          catch (error) {
            if (processContext) throw error;
            action = 'abort';
          } finally {
            if (leaveWait) await leaveWait();
            await this._waitForSendDriver(link, args.frameToken);
          }
          if (action === 'pending') {
            await new Promise(resolve => setTimeout(resolve, 0));
            continue;
          }
          if (action !== 'resume') {
            if (!processContext) await this._abortThreadSendLink(link, true, args.frameToken);
            return failed(new Error('Process send callback cannot resume'));
          }
        }
        // A target WndProc can block on a critical section. Give the holder's
        // already-running slice and the host event loop a turn, then re-enter.
        await new Promise(resolve => setTimeout(resolve, 0));
        try {
          const resumed = await link.resumeThreadSendDispatch(undefined, args.frameToken, r && r.waitEpoch);
          if (resumed.waitPending && r && r.waitEpoch !== undefined) continue;
          if (r && r.waitEpoch !== undefined && !resumed.ownershipMismatch) {
            // A lost housekeeping ack leaves the endpoint receipt available;
            // it cannot invalidate the already-received continuation result.
            await link.acknowledgeThreadSendResume(args.frameToken, r.waitEpoch).catch(() => {});
          }
          r = resumed;
        }
        catch (error) {
          if (!processContext) await this._abortThreadSendLink(link, false, args.frameToken);
          return failed(error);
        }
      }
      if (!processContext) await this._abortThreadSendLink(link, true, args.frameToken);
      return failed(new Error('Process send callback exceeded drive limit'));
      } finally {
        yieldState.callbackLoaders?.clear();
        yieldState.callbackYield = null;
      }
    }

    async resolveThreadSend(senderLink, request) {
      if ((request.targetTid | 0) < 0 || this.processLocalSend) {
        while (senderLink.sendDrivers?.length) await senderLink.sendDrivers.at(-1).done;
        let token = await senderLink.beginProcessSendWait();
        while (token.pending && senderLink.sendDrivers?.length) {
          while (senderLink.sendDrivers?.length) await senderLink.sendDrivers.at(-1).done;
          token = await senderLink.beginProcessSendWait();
        }
        if (token.pending || token.ownershipMismatch) throw new Error('Process send root ownership lost');
        const leaveWait = await this.processRootSendWait?.(senderLink, token);
        let result;
        try { result = await this._resolveProcessSend(senderLink,request,undefined,token); }
        finally {
          if (leaveWait) await leaveWait();
          while (senderLink.sendDrivers?.length) await senderLink.sendDrivers.at(-1).done;
        }
        const completed = await senderLink.completeProcessSendWait(token, result);
        if (!completed.completed) throw new Error('Process send root completion ownership lost');
        await senderLink.acknowledgeThreadSendResume(0, token.waitEpoch).catch(() => {});
        return result?.result ?? result;
      }
      const target = this.linkForWin32Tid(request.targetTid | 0);
      const activeLinks = new Set();
      if (senderLink) activeLinks.add(senderLink);
      const result = await this._dispatchThreadSendToLink(target, {
        hwnd: request.hwnd | 0, msg: request.msg | 0,
        wparam: request.wparam | 0, lparam: request.lparam | 0,
        postKind: request.postKind | 0,
      }, 0, activeLinks);
      if (senderLink) {
        try { await senderLink.completeThreadSend(result); } catch (_) {}
      }
      return result | 0;
    }

    async _resolveProcessSend(senderLink, request, context, waitToken) {
      senderLink.processSendPending = (senderLink.processSendPending || 0) + 1;
      const manager = this.threadManager;
      try {
        const resolver = (request.targetTid | 0) < 0 ? this.processSendResolver : this.processLocalSend;
        if (!resolver) throw Object.assign(new Error('unsupported process send'),{code:50});
        const pending = resolver(request, context, senderLink);
        let done = false, pumping = null;
        const completion = Promise.resolve(pending).finally(() => { done = true; });
        // A synchronous send may be awaited by the host's only scheduler
        // turn. Keep unrelated guest threads progressing to message points;
        // do not drive this sender or another pending send a second time.
        while (!done && manager) {
          if (!pumping) {
            pumping = manager._pumpWorkersForThreadSend(new Set([senderLink]), () => !done);
            pumping.finally(() => { pumping = null; }).catch(error => {
              // A sibling's send may outlive this caller. Preserve a later
              // scheduler failure instead of discarding a detached rejection.
              if (done && !manager._processSendPumpError) manager._processSendPumpError = error;
            });
          }
          await Promise.race([completion, pumping, new Promise(resolve => setTimeout(resolve, 0))]);
          if (!done) await new Promise(resolve => setTimeout(resolve, 0));
        }
        // Stop offering new work once the result arrives and drain ordinary
        // slice commands already posted. Do not await a sibling's entire send
        // continuation: that send may require this caller to resume first.
        if (manager) {
          await Promise.all([...manager.threads.values()]
            .filter(thread => thread.link !== senderLink && thread.slicePromise)
            .map(thread => thread.slicePromise));
          if (manager._processSendPumpError) {
            const error = manager._processSendPumpError;
            manager._processSendPumpError = null;
            throw error;
          }
        }
        return await completion;
      } catch (error) {
        // Zero is a valid LRESULT, so unexpected transport/guest failures must
        // reach the run loop rather than impersonate a successful callback.
        if (error.code !== 50 && error.code !== 'receiver-gone') throw error;
        if (waitToken) return { result: 0, lastError: error.code === 50 ? 50 : 1400 };
        await senderLink.callExport('set_last_error', error.code === 50 ? 50 : 1400);
        return 0;
      } finally {
        senderLink.processSendPending--;
      }
    }

    // Kept for the callers that only know about slot 0.
    get worker() { return this.link ? this.link.worker : null; }
    get sliceStats() { return this.link ? this.link.sliceStats : null; }
    // D3DIM render-Worker encoder counters, refreshed with every guest slice.
    get d3dStats() { return this.link ? this.link.d3dStats || null : null; }

    _setNestedWaitActive(active) {
      this._nestedWaitActive = active ? 1 : 0;
      if (!active || this._nestedWaitPump || !this.threadManager) return;
      const pump = async () => {
        try {
          while (this._nestedWaitActive && this.threadManager) {
            const ran = await this.threadManager.runWorkerSlices(100000);
            // A thread may still be finishing the slice issued alongside the
            // blocked main Worker, or sleeping briefly in Storm's idle pump.
            // Yield to its reply/timer and try again without spinning the page.
            if (!ran) await new Promise(resolve => setTimeout(resolve, 1));
          }
        } catch (err) {
          this.log(`[guest-worker] nested wait pump failed: ${err.message}`);
        } finally {
          this._nestedWaitPump = null;
          // An end+new-begin pair can arrive while the old loop unwinds.
          if (this._nestedWaitActive) this._setNestedWaitActive(true);
        }
      };
      this._nestedWaitPump = pump();
    }

    async start() {
      if (this._stopped) throw new Error('guest thread host stopped');
      // Per-slot tables are resolved lazily by the broker, on the slot's first
      // request — which is always after spawnThread recorded its tid, so the
      // table can be built for the right thread.
      const table = this.hostImportsForSlot
        ? (slot => this.hostImportsForSlot(slot | 0, this.slotTid.get(slot | 0) || 0))
        : this.hostImports;
      this.broker = RPC.createMainBroker(
        this.memory, table, this.sigs, {
          // The stack is the only pointer to the bug: the worker that made
          // the call sees just the import name (guest-rpc.js STATUS_ERR).
          onError: (name, err) => this.log(
            `[guest-worker] host import ${name} threw: ${(err && err.stack) || err}`),
          // Off unless asked for: it is a Map write per brokered call.
          countCalls: !!this.countCalls,
        });

      // Publish the clock before anything runs: the guest reads it locally, and
      // a zero would make GetTickCount jump on the first real publish.
      this.broker.publish({ tickMs: this.tickMs() });
      // Keep it moving even while the guest is mid-slice. 4ms is well inside
      // Win98's own 10-55ms GetTickCount resolution, so the guest sees a clock
      // no coarser than the one it was written for.
      if (this.clockIntervalMs > 0) {
        this._clock = setInterval(() => this.broker.publish({ tickMs: this.tickMs() }), this.clockIntervalMs);
        if (this._clock && this._clock.unref) this._clock.unref();
      }

      if (this.localMainExports) return null;   // no slot-0 worker in CLI mode

      this.link = new WorkerLink({
        slot: 0, memory: this.memory, module: this.module, sigs: this.sigs,
        broker: this.broker, workerUrl: this.workerUrl, log: this.log,
        espExpect: this.espExpect, forwardGuestLogs: this.forwardGuestLogs,
        dxTraceLocal: this.dxTraceLocal,
        d3dRenderWorker: this.d3dRenderWorker,
        sharedRenderWorker: this.sharedRenderWorker,
        createRenderEndpoint: this.createRenderEndpoint,
        d3dimGpu: this.d3dimGpu,
        d3dimLazySync: this.d3dimLazySync,
        onAdvanceGuestTime: this.advanceGuestTime,
        findDll: this.findDll, onDllMapped: this.onDllMapped, onDllRetired: this.onDllRetired,
        onRpc: s => { this.audioRpcSlot=s; if (this.onRpcSlot) this.onRpcSlot(s); },
        onRpcEnd: s => { this.audioRpcSlot=null; if (this.onRpcSlotEnd) this.onRpcSlotEnd(s); },
        onNestedWait: active => this._setNestedWaitActive(active),
      });
      return this.link.start();
    }

    stop() {
      if (this._stopPromise) return this._stopPromise;
      // Fence output before asynchronous Worker retirement; a delayed broker
      // start cannot publish a tone while teardown awaits loader/worker exit.
      const audioImports = this.hostImportsForSlot
        ? this.hostImportsForSlot(0, this.slotTid.get(0) || 0) : this.hostImports;
      if (audioImports && audioImports.beep_shutdown) audioImports.beep_shutdown();
      this._stopped = true;
      if (this._localLink) {
        this._localLink._stopped = true;
        if (this._localLink._threadSendWaitRetire) this._localLink._threadSendWaitRetire();
        this._localSendWaits.retireLoaders();
        this._localSendFrames.length = 0;
        this._localSendWaits.resumes.clear();
      }
      this._nestedWaitActive = 0;
      if (this._clock) clearInterval(this._clock);
      const links = this._retirementLinks || new Set();
      for (const link of [...this.threadLinks.values(), ...this._startingLinks]) links.add(link);
      this.threadLinks.clear();
      this._startingLinks.clear();
      this.slotTid.clear();
      if (this.link) links.add(this.link);
      this._retirementLinks = links;
      this.link = null;
      const retirements = [...links].map(link => {
        try { return Promise.resolve(link.stop()); }
        catch (error) { return Promise.reject(error); }
      });
      this._stopPromise = Promise.allSettled(retirements).then(results => {
        const failed = results.find(result => result.status === 'rejected');
        if (failed) { this._stopPromise = null; throw failed.reason; }
        this._retirementLinks = null;
      });
      this._stopPromise.catch(error =>
        this.log(`[guest-worker] shutdown failed: ${error && error.message || error}`));
      return this._stopPromise;
    }

    // --- guest threads (phase 2) ---------------------------------------------

    // Spawn a Worker for one guest thread and hand it its identity. Returns the
    // link, which ThreadManager's worker backend stores in the thread record in
    // place of the in-process instance the cooperative backend keeps there.
    async spawnThread(spec) {
      if (this._stopped) throw new Error('guest thread host stopped');
      const slot = this._nextSlot++;
      if (slot >= RPC.RPC_MAX_SLOTS) throw new Error('out of RPC slots for guest threads');
      this.slotTid.set(slot, spec.tid | 0);
      const link = new WorkerLink({
        slot, memory: this.memory, module: this.module, sigs: this.sigs,
        sharedRenderWorker: this.sharedRenderWorker, d3dimGpu: this.d3dimGpu,
        d3dimLazySync: this.d3dimLazySync,
        createRenderEndpoint: this.createRenderEndpoint,
        broker: this.broker, workerUrl: this.workerUrl, log: this.log,
        espExpect: this.espExpect, forwardGuestLogs: this.forwardGuestLogs,
        dxTraceLocal: this.dxTraceLocal,
        onAdvanceGuestTime: this.advanceGuestTime,
        findDll: this.findDll, onDllMapped: this.onDllMapped, onDllRetired: this.onDllRetired,
        onRpc: s => { this.audioRpcSlot=s; if (this.onRpcSlot) this.onRpcSlot(s); },
        onRpcEnd: s => { this.audioRpcSlot=null; if (this.onRpcSlotEnd) this.onRpcSlotEnd(s); },
      });
      this._startingLinks.add(link);
      try {
        await link.start();
        if (this._stopped) throw new Error('guest thread host stopped');
        const r = await link.initGuestThread(spec);
        // Preserve allocation ownership even if shutdown wins bootstrap.
        link.stackMapped = r.stackMapped >>> 0;
        if (this._stopped) throw new Error('guest thread host stopped');
        // A toolbar change may have happened while this thread was starting.
        while (link.d3dimLazySync !== this.d3dimLazySync) {
          link.d3dimLazySync = this.d3dimLazySync;
          await link.callExport('d3dim_lazy_enable',
            this.sharedRenderWorker && this.d3dimGpu && this.d3dimLazySync ? 1 : 0);
          if (this._stopped) throw new Error('guest thread host stopped');
        }
        // Retain the initial registers and stack range for scheduler events
        // and overlap diagnostics after the worker has finished booting.
        link.startEip = r.eip >>> 0;
        link.startEsp = r.esp >>> 0;
        link.stackBase = r.stackBase >>> 0;
        link.stackMapped = r.stackMapped >>> 0;
        link.stackTop = r.stackTop >>> 0;
        link.inheritedWasmSetters = Array.isArray(r.inheritedWasmSetters)
          ? r.inheritedWasmSetters.slice() : [];
        this._startingLinks.delete(link);
        if (this._stopped) throw new Error('guest thread host stopped');
        this.threadLinks.set(slot, link);
        // Shared-heap stack allocation must never overlap another thread.
        for (const [otherSlot, other] of this.threadLinks) {
          if (otherSlot === slot || !other.stackTop) continue;
          if (link.stackBase < other.stackTop && other.stackBase < link.stackTop) {
            this.log(`[guest-worker] STACK OVERLAP: slot ${slot} `
              + `0x${link.stackBase.toString(16)}-0x${link.stackTop.toString(16)} overlaps slot `
              + `${otherSlot} 0x${other.stackBase.toString(16)}-0x${other.stackTop.toString(16)}`);
          }
        }
        this.log(`[guest-worker ${slot}] guest thread tid=${spec.tid} EIP=0x${(r.eip >>> 0).toString(16)} `
          + `ESP=0x${(r.esp >>> 0).toString(16)} `
          + `stack=0x${link.stackBase.toString(16)}-0x${link.stackTop.toString(16)}`);
        this.log(`[guest-worker ${slot}] inherited WASM globals: ${link.inheritedWasmSetters.join(',') || '(none)'}`);
        return link;
      } catch (error) {
        // A failed bootstrap can still own a Worker and its allocated stack.
        // Give the scheduler that identity even if cleanup itself fails.
        error.workerLink = link;
        try { await this.dropThread(link); }
        catch (retirementError) { error.retirementError = retirementError; }
        throw error;
      }
    }

    dropThread(link) {
      if (!link) return Promise.resolve();
      const links = this._retirementLinks || (this._retirementLinks = new Set());
      links.add(link);
      let stopping;
      try { stopping = Promise.resolve(link.stop()); }
      catch (error) { stopping = Promise.reject(error); }
      const retirement = stopping.then(() => {
        links.delete(link);
        const wasStarting = this._startingLinks.delete(link);
        // An old completion must never erase a newer owner of this slot.
        if (this.threadLinks.get(link.slot) === link) {
          this.threadLinks.delete(link.slot);
          this.slotTid.delete(link.slot);
        } else if (wasStarting && !this.threadLinks.has(link.slot)
            && ![...this._startingLinks].some(other => other.slot === link.slot)) {
          this.slotTid.delete(link.slot);
        }
      });
      // Scheduler exits are synchronous. Keep failures observable to callers
      // and retain the owner for explicit shutdown/retry without an unhandled rejection.
      retirement.catch(error => this.log(`[guest-worker ${link.slot}] retirement retained: ${error.message || error}`));
      return retirement;
    }

    // --- slot 0 delegation ----------------------------------------------------

    callExport(name, ...args) { return this.link.callExport(name, ...args); }

    async setLazySync(on) {
      this.d3dimLazySync = !!on;
      const enabled = this.sharedRenderWorker && this.d3dimGpu && this.d3dimLazySync ? 1 : 0;
      await Promise.all([this.link, ...this.threadLinks.values()].filter(Boolean).map(link => {
        link.d3dimLazySync = this.d3dimLazySync;
        return link.callExport('d3dim_lazy_enable', enabled);
      }));
    }

    // ThreadManager reads the PE's metadata through here, because in the browser
    // the only instance that has ever seen the image is slot 0's. When the main
    // thread is local it is the same read, without the round trip.
    async readExports(names) {
      if (this.localMainExports) {
        const ex = this.localMainExports();
        const out = {};
        for (const name of names || []) {
          out[name] = typeof ex[name] === 'function' ? (ex[name]() >>> 0) : null;
        }
        return out;
      }
      return this.link.readExports(names);
    }

    slice(steps, sync) { return this.link.slice(steps, sync); }

    // Boot a PE inside the worker. Mirrors host.js's own sequence; the bytes go
    // into shared memory from here, and only the export calls are marshalled.
    async loadPe(exeBytes, exeName, processId, opts = {}) {
      if (processId !== undefined) {
        try { await this.callExport('set_process_id', processId | 0); } catch (_) {}
      }
      const staging = await this.callExport('get_staging');
      const cap = await this.callExport('get_staging_size');
      if (exeName) {
        const bytes = new TextEncoder().encode(exeName);
        new Uint8Array(this.memory.buffer).set(bytes, staging);
        try { await this.callExport('set_exe_name', staging, bytes.length); } catch (_) {}
      }
      if (opts && opts.exeDrive) {
        try { await this.callExport('set_exe_drive', opts.exeDrive | 0); } catch (_) {}
      }
      if (opts && opts.extraArgs) {
        const bytes = new TextEncoder().encode(opts.extraArgs);
        new Uint8Array(this.memory.buffer).set(bytes, staging);
        try { await this.callExport('set_extra_cmdline', staging, bytes.length); } catch (_) {}
      }
      // Shared-memory writes are host-owned, but every placement value comes
      // from the owning Worker. Oversized imports/resources must be mapped
      // before load_pe, just as in the cooperative boot path.
      const guestBase = await this.callExport('get_guest_base');
      const staged = ProcessBoot.stagePe({
        get_staging: () => staging,
        get_staging_size: () => cap,
        get_guest_base: () => guestBase,
      }, this.memory.buffer, exeBytes);
      const entry = await this.callExport('load_pe', staged);
      try { await this.callExport('init_dx_com_thunks'); } catch (_) {}
      return entry >>> 0;
    }

    // Load DLLs inside the worker. The bytes are copied over rather than left
    // in shared memory because the loader wants plain arrays, and a few MB once
    // per launch is not worth a second protocol.
    async loadDlls(configs, exeBytes, opts) {
      // This is a Worker protocol boundary, not a pass-through JS call. Host
      // loader options also contain callbacks (resource registration and guest
      // clock advancement), which WebKit correctly refuses to structured-clone.
      // Marshal only the data the worker-side loader can consume. Doing this
      // here keeps stale/mixed host.js versions from making every Win16 launch
      // fail before the otherwise empty PE-DLL phase.
      const workerConfigs = (configs || []).map(config => {
        const copy = { name: config.name, bytes: config.bytes };
        if (config.path !== undefined) copy.path = config.path;
        return copy;
      });
      const workerOpts = {};
      if (opts && typeof opts.exeName === 'string') workerOpts.exeName = opts.exeName;
      if (opts && typeof opts.extraArgs === 'string') workerOpts.extraArgs = opts.extraArgs;
      if (opts && typeof opts.maxBlocks === 'number') workerOpts.maxBlocks = opts.maxBlocks;
      const r = await this.link._ask({
        t: 'loadDlls', configs: workerConfigs, exeBytes, opts: workerOpts,
      }, 120000);
      return r.results || [];
    }

    // NE modules continue the task's selector arena and patch its far-import
    // thunks, so they must be loaded by the same instance that loaded the NE
    // executable. In browser guest-main mode that instance lives here, not in
    // host.js's idle ownership-token instance.
    async loadWin16Dlls(exeBytes, files, extraNames) {
      const r = await this.link._ask({
        t: 'loadWin16Dlls', exeBytes, files, extraNames,
      }, 120000);
      return r;
    }

    // deps: [{ fileName, bytes }] -- the DLL's static imports, dependencies
    // before dependents, mapped first (host.js _handleLoadLibraryThreaded).
    async serviceDllYield(link) {
      return (link || this.link)._ask({ t: 'serviceDllYield' }, 120000);
    }

    async loadLibrary(bytes, fileName, link, deps = []) {
      return (link || this.link)._ask({ t: 'loadLibrary', bytes, fileName, deps }, 120000);
    }

    // Load a COM server DLL for a guest parked on yield reason 3. exeBytes is
    // passed so the worker can re-patch the EXE's import table, which is what
    // makes a late-loaded DLL's exports reachable from the already-loaded image.
    async comLoadDll(bytes, fileName, exeBytes, link) {
      return (link || this.link)._ask({ t: 'comLoadDll', bytes, fileName, exeBytes }, 120000);
    }
  }

  const api = { GuestThreadHost, WorkerLink };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.GuestThreadHost = GuestThreadHost; root.GuestWorkerLink = WorkerLink; }
})(typeof self !== 'undefined' ? self : this);
