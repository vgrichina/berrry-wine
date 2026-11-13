'use strict';

// Deliberately CLI/cooperative only. Install before imports/exports escape.
const {WriterEpoch, observeInstance, observeHostWrite} = require('./render-worker');
const {performance} = require('node:perf_hooks');
const {AsyncLocalStorage} = require('node:async_hooks');

function validateObservationArgs(args) {
  const allowed = new Set(['cli-native-observation', 'no-renderer', 'no-threads',
    'frozen', 'control', 'control-stdin', 'control-host', 'app', 'exe', 'wasm',
    'no-build', 'no-close', 'quiet-api', 'max-seconds', 'max-batches', 'batch-size']);
  for (const arg of args) {
    if (!arg.startsWith('--') || !allowed.has(arg.slice(2).split('=')[0]))
      throw Error('CLI observation unsupported option: ' + arg);
  }
  if (!args.includes('--no-renderer') || !args.includes('--frozen') ||
      !args.some(a => a === '--control-stdin' || /^--control(?:=|$)/.test(a)))
    throw Error('CLI observation requires --no-renderer --frozen and a control channel');
}

class CliObservationLease {
  constructor({memory, module, paused, threads, timeoutMs = 2000}) {
    this.memory = memory; this.module = module;
    this.paused = paused; this.getThreads = threads; this.timeoutMs = timeoutMs;
    this.epoch = new WriterEpoch(); this.instances = new Map();
    this.state = 'open'; this.pending = new Set(); this.parked = false;
    this.importDepth = 0; this.generation = 0;
    this.admission = new AsyncLocalStorage();
  }
  instantiate(module, imports) {
    if (module !== this.module || !(module instanceof WebAssembly.Module) || imports.host.memory !== this.memory)
      throw Error('actual compiled module and imported memory required');
    if (this.state !== 'open') throw Error('bootstrap admission closed');
    const native = new WebAssembly.Instance(module, imports);
    const observed = observeInstance(native, () => this.epoch);
    const exports = {};
    for (const [name, value] of Object.entries(observed.exports)) exports[name] =
      typeof value === 'function' ? (...args) => {
        this.checkAdmission();
        return value(...args);
      } : value;
    const facade = Object.freeze({exports:Object.freeze(exports), nativeInstance:native});
    this.instances.set(facade, {native, exports: native.exports, module: this.module,
      memory: this.memory, facadeExports:facade.exports, buffer: this.memory.buffer, generation: ++this.generation});
    return facade;
  }
  wrapImports(imports) {
    for (const [name, value] of Object.entries(imports.host)) {
      if (typeof value !== 'function') continue;
      imports.host[name] = (...args) => {
        // No host callback may run inside the owned step, even a logger. A
        // refused instruction is UNKNOWN and its guest progress is retained.
        if (this.state === 'owned') throw Error('owned step reached host import: ' + name);
        this.checkAdmission();
        if (/^(process_spawn|wave|midi|mci|dsound|audio_|voice_|play_sound|message_beep|beep_start|net_|socket|gpu_|gl_|glide_|d3d)/i.test(name))
          throw Error('CLI observation unsupported host service: ' + name);
        this.importDepth++;
        try { return this.track(() => observeHostWrite(this.epoch, value, undefined, args)); }
        finally { this.importDepth--; }
      };
    }
    return imports;
  }
  checkAdmission() {
    if (this.state === 'owned' || (this.state === 'draining' &&
        !this.admission.getStore()?.active)) throw Error('foreign admission closed');
  }
  track(fn) {
    const token = {active:true};
    return this.admission.run(token, () => {
      let result;
      try { result = fn(); } catch (error) { token.active=false; throw error; }
      if (!result || typeof result.then !== 'function') { token.active=false; return result; }
      const pending = Promise.resolve(result);
      this.pending.add(pending);
      pending.then(() => { token.active=false; this.pending.delete(pending); },
        () => { token.active=false; this.pending.delete(pending); });
      return result;
    });
  }
  command(fn) {
    if (this.state !== 'open') throw Error('observation command admission closed');
    return this.track(fn);
  }
  hostWrite(fn) {
    this.checkAdmission();
    return this.track(() => observeHostWrite(this.epoch, fn, undefined, []));
  }
  enterBatch() {
    if (this.state !== 'open') throw Error('batch admission closed');
    const token = {active:true};
    this.batchAdmission = token;
    this.admission.enterWith(token);
  }
  finishBatch() {
    if (this.batchAdmission) this.batchAdmission.active=false;
    this.batchAdmission=null;
    this.admission.enterWith(undefined);
  }
  bindThreads(tm) {
    if (this.boundThreads) throw Error('CLI scheduler already bound');
    this.boundThreads = tm;
    // These are the actual CLI cooperative scheduler/host-write entries. Keep
    // the manager's own boundary and epoch machinery, including finally release.
    for (const name of ['runSlice', 'runWorkerSlices', 'spawnPending', 'createThread',
      'drainCooperativeWakes', '_fillIoRead', '_zeroGuestRange', 'snapshotThreads']) {
      const method = tm[name];
      if (typeof method !== 'function') continue;
      tm[name] = (...args) => { this.checkAdmission(); return method.apply(tm,args); };
    }
  }
  census(main, tm) {
    if (!tm || this.boundThreads !== tm || tm.workerBackend || tm.workerFreeRun) throw Error('cooperative scheduler required');
    const list = [[main, null, 0], ...[...tm.threads].map(([handle,t]) => [t.instance, t, handle])];
    return list.map(([instance, thread, handle]) => {
      const pin = this.instances.get(instance);
      if (!pin || pin.module !== this.module || pin.memory !== this.memory ||
          pin.buffer !== this.memory.buffer || pin.native.exports !== pin.exports ||
          instance.exports !== pin.facadeExports)
        throw Error('unregistered/replaced cooperative instance');
      return {instance, thread, handle, tid:thread?.tid, state:thread?.state, pin};
    });
  }
  async run(main, fn) {
    if (this.state !== 'open' || !this.paused() || this.importDepth)
      throw Error('observation requires a paused non-reentrant owner');
    const tm = this.getThreads(), pins = this.census(main, tm);
    const module = tm.module, memory = tm.memory, mainInstance = tm.mainInstance;
    this.state = 'draining';
    let release = null, attached = false;
    const validate = () => {
      const now = this.census(main, tm);
      if (!this.paused() || this.getThreads() !== tm || tm.module !== module ||
          module !== this.module || tm.memory !== memory || memory !== this.memory ||
          tm.mainInstance !== mainInstance || mainInstance !== main || now.length !== pins.length ||
          now.some((p,i) => p.instance !== pins[i].instance || p.thread !== pins[i].thread ||
            p.state !== pins[i].state || p.handle !== pins[i].handle ||
            p.tid !== pins[i].tid || p.pin !== pins[i].pin))
        throw Error('observation participant retired/replaced');
    };
    try {
      release = tm.holdWriterObservationBoundary();
      const deadline = performance.now() + this.timeoutMs;
      for (;;) {
        validate();
        if (this.parked && !this.pending.size && !this.epoch.live.size &&
            !tm._spawningWorkers && !tm._backgroundSpawnFlight && !tm._pendingThreads.length &&
            !tm.hasIoFillInFlight() && ![...tm.threads.values()].some(t =>
              t.inFlight || t.freeRunPending || t.importRetryPreparing)) break;
        if (performance.now() >= deadline) throw Error('CLI observation drain timed out');
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      this.epoch = new WriterEpoch();
      tm.setWriterObservation(this.epoch); attached = true;
      validate();
      this.state = 'owned';
      const invocation = {};
      this.owner = invocation;
      // This callback is repository-owned synchronous code, never user eval.
      const owner = observeInstance(pins[0].pin.native, () => this.epoch).exports;
      const checked = {};
      for (const [name, value] of Object.entries(owner)) checked[name] = typeof value === 'function'
        ? (...args) => {
          if (this.state !== 'owned' || this.owner !== invocation) throw Error('expired observation invocation');
          validate(); return value(...args);
        } : value;
      const result = fn(Object.freeze(checked), () => {
        validate(); return this.state === 'owned' && this.owner === invocation && !!this.epoch.snapshot();
      });
      if (result && typeof result.then === 'function') throw Error('owned observation must be synchronous');
      validate();
      return result;
    } finally {
      // Restore admission even if attachment, a pin check or guest execution fails.
      try { if (attached) tm.setWriterObservation(null); }
      finally { this.owner = null; this.state = 'open'; if (release) release(); }
    }
  }
}
module.exports = {CliObservationLease, validateObservationArgs};
