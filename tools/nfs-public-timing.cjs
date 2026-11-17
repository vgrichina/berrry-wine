'use strict';

// Opt-in public host observation. No payloads, guest reads, timers or yields.
// All samples stay in a bounded ring until normal process exit.
function createObserver({capacity = 2048, wall = Date.now,
  mono = () => performance.now()} = {}) {
  const rows = new Array(capacity), totals = Object.create(null);
  let count = 0;
  function mark(phase, fields = {}) {
    rows[count++ % capacity] = {phase, at: wall(), mono: mono(), ...fields};
  }
  function wrap(object, name, phase, identify = () => ({}), minimum = 0) {
    const original = object[name];
    object[name] = function(...args) {
      const begin = mono(), at = wall(), fields = identify(args);
      try { return Reflect.apply(original, this, args); }
      finally {
        const ms = mono() - begin;
        const total = totals[phase] ||= {calls: 0, ms: 0, maxMs: 0};
        total.calls++; total.ms += ms; total.maxMs = Math.max(total.maxMs, ms);
        if (ms >= minimum) mark(phase, {begin, startedAt: at, ms, ...fields});
      }
    };
  }
  return {mark, wrap, report() {
    const kept = Math.min(count, capacity), start = Math.max(0, count - capacity);
    return {capacity, totalSamples: count, dropped: count - kept,
      rows: Array.from({length: kept}, (_, i) => rows[(start + i) % capacity]), totals};
  }};
}

function install(observer, {http, hostModule, guardModule}) {
  const emit = http.Server.prototype.emit;
  http.Server.prototype.emit = function(event, ...args) {
    if (event === 'request') observer.mark('http-entry');
    return Reflect.apply(emit, this, [event, ...args]);
  };
  const createHost = hostModule.createHostImports;
  hostModule.createHostImports = function(...args) {
    const result = Reflect.apply(createHost, this, args), host = result.host || result;
    if (host.gpu_stream_kick) observer.wrap(host, 'gpu_stream_kick', 'sync-render', undefined, 1);
    return result;
  };
  const createGuard = guardModule.createGuardedInput;
  guardModule.createGuardedInput = function(...args) {
    const guard = Reflect.apply(createGuard, this, args);
    const identity = a => ({nonce: a[0]?.nonce});
    observer.wrap(guard, 'prepare', 'guard-prepare', identity);
    observer.wrap(guard, 'consume', 'guard-application', identity);
    // Observe physical UP after the existing independent release. No native
    // calls or queue modifications; key state belongs to the public renderer.
    const release = guard.release;
    guard.release = function(...a) {
      const result = Reflect.apply(release, this, a), r = args[0].snapshot().refs.renderer;
      if (r?.peekKeyDownState) observer.mark('physical-up', {
        escape: r.peekKeyDownState(27), up: r.peekKeyDownState(38),
        left: r.peekKeyDownState(37), right: r.peekKeyDownState(39),
        queueLength: r.inputQueue.length});
      return result;
    };
    return guard;
  };
}

module.exports = {createObserver, install};
if (process.env.NFS_PUBLIC_TIMING && require('node:worker_threads').isMainThread) {
  const observer = createObserver();
  install(observer, {http: require('node:http'), hostModule: require('../lib/host-imports'),
    guardModule: require('../lib/cli-guarded-input')});
  process.once('exit', () => require('node:fs').writeFileSync(process.env.NFS_PUBLIC_TIMING,
    JSON.stringify({passive: true, extraNativeCalls: 0, ...observer.report()}, null, 2)));
}
