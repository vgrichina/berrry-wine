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
      this.slot = opts.slot | 0;
      this.memory = opts.memory;
      this.module = opts.module;
      this.sigs = opts.sigs;
      this.broker = opts.broker;
      this.workerUrl = opts.workerUrl || 'lib/guest-worker.js';
      this.log = opts.log || (() => {});
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
          if (this._readyPromise) this._readyPromise.reject(e instanceof Error ? e : new Error(String(e)));
        });
      } else {
        this.worker = new Worker(this.workerUrl);
        this.worker.onmessage = e => this._onMessage(e.data || {});
        this.worker.onerror = e => {
          this.log(`[guest-worker ${this.slot}] worker error: ${e.message || e}`);
          if (this._readyPromise) this._readyPromise.reject(new Error(e.message || 'worker failed'));
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
        t: 'init', module: this.module, memory: this.memory, sigs: this.sigs, slot: this.slot,
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

    stop() {
      if (this._stopPromise) return this._stopPromise;
      this._stopped = true;
      const readiness = this._readyPromise;
      this._readyPromise = null;
      if (readiness) readiness.reject(new Error(`worker ${this.slot} stopped`));
      this.waveRegistrations.clear();
      this._waveOffer = null;
      const termination = this.worker && this.worker.terminate();
      this.worker = null;
      if (!this._renderLegacyRetirement) {
        this._renderLegacyRetirement = this._renderLegacyChain.catch(() => {}).then(() =>
          this._renderLegacyEndpoint?.terminate());
        this._renderLegacyRetirement.catch(error =>
          this.log(`[render ${this.slot}] endpoint retirement failed: ${error.message || error}`));
      }
      for (const [, p] of this._pending) p.reject(new Error(`worker ${this.slot} stopped`));
      this._pending.clear();
      // Browser terminate() is synchronous; Node returns a promise for the
      // worker's exit. Both must finish before the shared memory is released.
      this._stopPromise = Promise.all([termination, this._renderLegacyRetirement]);
      this._stopPromise.catch(error =>
        this.log(`[guest-worker ${this.slot}] shutdown failed: ${error.message || error}`));
      return this._stopPromise;
    }

    _onMessage(msg) {
      if (this._stopped) return;
      switch (msg.t) {
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
            this.broker.serveRpc(msg.slot === undefined ? this.slot : msg.slot);
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
    async slice(steps, sync, localSleep) {
      const r = await this._ask(localSleep ? { t: 'slice', steps, sync, localSleep }
        : { t: 'slice', steps, sync }, 60000);
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
    completeWait(result, waitStackBytes) {
      return this._ask({ t: 'completeWait', result, waitStackBytes });
    }

    completeThreadSend(result) {
      return this._ask({ t: 'completeThreadSend', result });
    }

    dispatchThreadSend(args) {
      return this._ask(Object.assign({ t: 'dispatchThreadSend' }, args), 60000);
    }

    resumeThreadSendDispatch(nestedResult) {
      const msg = { t: 'resumeThreadSendDispatch' };
      if (nestedResult !== undefined) msg.nestedResult = nestedResult;
      return this._ask(msg, 60000);
    }

    resumeThreadSendMessageWait(hostInput) {
      return this._ask({ t: 'resumeThreadSendMessageWait', hostInput: !!hostInput }, 60000);
    }

    abortThreadSendDispatch(restore = true) {
      return this._ask({ t: 'abortThreadSendDispatch', restore }, 60000);
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
      this._localSendFrames = [];
      this._nestedWaitActive = 0;
      this._nestedWaitPump = null;
      this._localLink = this.localMainExports ? {
        completeThreadSend: async result => {
          const ex = this.localMainExports();
          ex.complete_thread_send(result | 0);
        },
        dispatchThreadSend: async args => this._dispatchLocalThreadSend(args),
        resumeThreadSendDispatch: async value => this._resumeLocalThreadSend(value),
        resumeThreadSendMessageWait: async hostInput => this._resumeLocalThreadSendMessageWait(hostInput),
        completeWait: async (result, bytes) => this._completeLocalThreadSendWait(result, bytes),
        callExport: async (name, ...args) => {
          const ex = this.localMainExports();
          if (!ex || typeof ex[name] !== 'function') throw new Error(`guest instance has no export ${name}`);
          return ex[name](...args);
        },
        abortThreadSendDispatch: async restore => this._abortLocalThreadSend(restore),
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
        try { ex.run(1000000); } catch (err) { trapped = String(err && err.message || err); }
        const y = ex.get_yield_reason ? ex.get_yield_reason() | 0 : 0;
        if (trapped) return { trapped, yield: y };
        if (y === 10) return {
          nested: true, yield: y,
          targetTid: ex.get_send_target_tid() | 0,
          hwnd: ex.get_send_hwnd() | 0, msg: ex.get_send_msg() | 0,
          wparam: ex.get_send_wparam() | 0, lparam: ex.get_send_lparam() | 0,
          postKind: ex.get_send_post_kind ? ex.get_send_post_kind() | 0 : 0,
        };
        if (y) return {
          blocked: true, yield: y,
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
      const ex = this.localMainExports();
      const frame = this._snapshotLocalSend(ex);
      if (ex.set_d3d_render_token) ex.set_d3d_render_token(0);
      const send = {
        hwnd: args.hwnd | 0, msg: args.msg | 0,
        wparam: args.wparam | 0, lparam: args.lparam | 0,
        postKind: args.postKind | 0,
      };
      this._localSendFrames.push({ snapshot: frame, send });
      if (send.postKind === 1 && (!send.wparam || !send.lparam)) {
        return { done: true, result: this._finishLocalThreadSend(ex, 0) };
      }
      if (!(ex.thread_send_begin(args.hwnd | 0, args.msg | 0,
        args.wparam | 0, args.lparam | 0) | 0)) {
        return { done: true, result: this._finishLocalThreadSend(ex, ex.get_eax() | 0) };
      }
      return this._driveLocalThreadSend();
    }

    async _resumeLocalThreadSend(nestedResult) {
      const ex = this.localMainExports();
      if (nestedResult !== undefined) ex.complete_thread_send(nestedResult | 0);
      else if ((ex.get_yield_reason() | 0) === 9) ex.clear_yield();
      return this._driveLocalThreadSend();
    }

    async _completeLocalThreadSendWait(result, waitStackBytes) {
      const ex = this.localMainExports();
      const retAddr = ex.guest_read32(ex.get_esp()) >>> 0;
      ex.clear_yield();
      ex.set_eax(result | 0);
      ex.set_esp(ex.get_esp() + (waitStackBytes | 0));
      ex.set_eip(retAddr);
      return { eip: retAddr };
    }

    async _resumeLocalThreadSendMessageWait(hostInput) {
      const ex = this.localMainExports();
      if ((ex.get_yield_reason() | 0) !== 7) return { resumed: false };
      const hasLocal = ex.has_pending_message ? (ex.has_pending_message() | 0) : 0;
      if (!hasLocal && !hostInput) return { resumed: false };
      const retAddr = ex.guest_read32(ex.get_esp()) >>> 0;
      const resumed = !!(ex.resume_message_wait && (ex.resume_message_wait() | 0));
      if (resumed) ex.set_eip(retAddr);
      return { resumed };
    }

    async _abortLocalThreadSend(restore = true) {
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
        await link.callExport('clear_yield');
        return 'resume';
      }
      if (r.yield === 6) return 'resume';
      return 'abort';
    }

    async _abortThreadSendLink(link, restore) {
      if (!link || !link.abortThreadSendDispatch) return;
      try { await link.abortThreadSendDispatch(restore); } catch (_) {}
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

    async _dispatchThreadSendToLink(link, args, depth, activeLinks) {
      if (!link || depth > 64) return 0;
      link.threadSendDepth = (link.threadSendDepth || 0) + 1;
      try {
        return await this._driveThreadSendToLink(link, args, depth, activeLinks);
      } finally {
        link.threadSendDepth--;
      }
    }

    async _driveThreadSendToLink(link, args, depth, activeLinks) {
      if (!link || depth > 64) return 0;
      activeLinks = activeLinks || new Set();
      activeLinks.add(link);
      const yieldState = { waitPolls: 0, waitStartedAt: 0 };
      let r;
      try { r = await link.dispatchThreadSend(args); }
      catch (_) {
        // The command may have reached the Worker before its reply channel
        // failed. Best-effort cleanup keeps a surviving instance from retaining
        // the nested interpreter frame indefinitely.
        await this._abortThreadSendLink(link, false);
        return 0;
      }
      for (let polls = 0; polls < 10000; polls++) {
        if (r && r.done) return r.result | 0;
        if (r && r.nested) {
          const nestedTarget = this.linkForWin32Tid(r.targetTid | 0);
          const nestedResult = await this._dispatchThreadSendToLink(nestedTarget, {
            hwnd: r.hwnd | 0, msg: r.msg | 0,
            wparam: r.wparam | 0, lparam: r.lparam | 0,
            postKind: r.postKind | 0,
          }, depth + 1, activeLinks);
          try { r = await link.resumeThreadSendDispatch(nestedResult); }
          catch (_) {
            await this._abortThreadSendLink(link, false);
            return 0;
          }
          continue;
        }
        if (r && (r.trapped || r.yield === 2)) {
          await this._abortThreadSendLink(link, false);
          return 0;
        }
        if (r && r.blocked && r.yield !== 0) {
          let action = 'abort';
          try { action = await this._resolveThreadSendBlockedYield(link, r, yieldState, activeLinks); }
          catch (_) { action = 'abort'; }
          if (action === 'pending') {
            await new Promise(resolve => setTimeout(resolve, 0));
            continue;
          }
          if (action !== 'resume') {
            await this._abortThreadSendLink(link, true);
            return 0;
          }
        }
        // A target WndProc can block on a critical section. Give the holder's
        // already-running slice and the host event loop a turn, then re-enter.
        await new Promise(resolve => setTimeout(resolve, 0));
        try { r = await link.resumeThreadSendDispatch(); }
        catch (_) {
          await this._abortThreadSendLink(link, false);
          return 0;
        }
      }
      await this._abortThreadSendLink(link, true);
      return 0;
    }

    async resolveThreadSend(senderLink, request) {
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
        onRpc: s => { this.audioRpcSlot=s; if (this.onRpcSlot) this.onRpcSlot(s); },
        onRpcEnd: s => { this.audioRpcSlot=null; if (this.onRpcSlotEnd) this.onRpcSlotEnd(s); },
        onNestedWait: active => this._setNestedWaitActive(active),
      });
      return this.link.start();
    }

    stop() {
      if (this._stopPromise) return this._stopPromise;
      this._stopped = true;
      this._nestedWaitActive = 0;
      if (this._clock) clearInterval(this._clock);
      const links = new Set([...this.threadLinks.values(), ...this._startingLinks]);
      this.threadLinks.clear();
      this._startingLinks.clear();
      this.slotTid.clear();
      if (this.link) links.add(this.link);
      this.link = null;
      const retirements = [...links].map(link => {
        try { return Promise.resolve(link.stop()); }
        catch (error) { return Promise.reject(error); }
      });
      this._stopPromise = Promise.allSettled(retirements).then(results => {
        const failed = results.find(result => result.status === 'rejected');
        if (failed) throw failed.reason;
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
        onRpc: s => { this.audioRpcSlot=s; if (this.onRpcSlot) this.onRpcSlot(s); },
        onRpcEnd: s => { this.audioRpcSlot=null; if (this.onRpcSlotEnd) this.onRpcSlotEnd(s); },
      });
      this._startingLinks.add(link);
      try {
        await link.start();
        if (this._stopped) throw new Error('guest thread host stopped');
        const r = await link.initGuestThread(spec);
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
        this._startingLinks.delete(link);
        this.slotTid.delete(slot);
        await link.stop().catch(() => {});
        throw error;
      }
    }

    dropThread(link) {
      if (!link) return;
      this.threadLinks.delete(link.slot);
      this.slotTid.delete(link.slot);
      link.stop();
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
