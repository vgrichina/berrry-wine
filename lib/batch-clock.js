'use strict';

// Deterministic guest clock used by the headless batch runner. Calls within a
// batch may advance the clock, but resetting the per-batch call counter must
// never make the next GetTickCount/timeGetTime call go backwards. A small
// reversal makes unsigned Win32 timer arithmetic look almost 25 days overdue.
function createBatchClock(tickMsPerBatch, tickCallStepMs = 1) {
  let batchStep = Math.max(0, Number(tickMsPerBatch) || 0);
  const callStep = Math.max(1, Number(tickCallStepMs) || 1);
  // `pausedMs` is guest time the harness has decided elapsed OUTSIDE the batch
  // schedule -- currently only `--dx-lock-pause-ms`, which charges a primary
  // surface Lock/Flip the display's frame interval so a run can be measured
  // with presentation back-pressure. It shifts the whole clock (base AND the
  // per-batch ceiling below) by the same amount, so it can never make the
  // clock go backwards and can never break the ceiling invariant. It is 0
  // unless a flag set it, and then it costs one add per call.
  const state = { batch: 0, callsInBatch: 0, lastTick: 0, pausedMs: 0 };
  let epochBatch = 0;
  let epochMs = 0;

  const batchTicks = () => ((epochMs + (state.batch - epochBatch) * batchStep
    + state.pausedMs) | 0) & 0x7FFFFFFF;

  const setTickMsPerBatch = value => {
    const next = Math.max(0, Number(value) || 0);
    // Rebase at the current batch before changing the slope. This preserves
    // the clock exactly at the transition instead of making a late switch
    // from (say) 200ms to 40ms jump backwards by batch * 160ms.
    epochMs = (Math.max(batchTicks(), state.lastTick) - state.pausedMs) | 0;
    epochBatch = state.batch;
    batchStep = next;
    return batchStep;
  };

  const getTicks = () => {
    const base = batchTicks();
    let candidate = ((base + (state.callsInBatch++ * callStep)) | 0) & 0x7FFFFFFF;
    // Calls may distinguish successive probes inside a batch, but they cannot
    // manufacture more time than the batch itself represents. Without this
    // ceiling, a tight PeekMessage/GetTickCount loop can keep a periodic timer
    // permanently due and never return to the application event queue.
    if (batchStep > 0) {
      const nextBase = ((((state.batch + 1) * batchStep + state.pausedMs) | 0) & 0x7FFFFFFF);
      if (nextBase > base && candidate >= nextBase) candidate = nextBase - 1;
    }
    if (candidate < state.lastTick && (state.lastTick - candidate) < 0x40000000) {
      return state.lastTick;
    }
    state.lastTick = candidate;
    return candidate;
  };

  return {
    state,
    batchTicks,
    getTicks,
    getTickMsPerBatch: () => batchStep,
    setTickMsPerBatch,
  };
}

// Aggregate virtual CPU, independent of host concurrency and slice budgets.
// One block costs 1000/blocksPerSecond ms. This is an abstract service model,
// not an x86 frequency estimate (blocks contain varying instruction counts).
// Shared integer totals retain fractional milliseconds across every partition.
function createServiceClock(blocksPerSecond = 5000, shared = null) {
  if (!Number.isSafeInteger(blocksPerSecond) || blocksPerSecond <= 0)
    throw new Error('CPU blocks per second must be a positive safe integer');
  const buffer = shared || new SharedArrayBuffer(16);
  const totals = new BigInt64Array(buffer);
  const readers = [];
  const sync = () => {
    for (const reader of readers) {
      const next = reader.read() >>> 0;
      const delta = (next - reader.last) >>> 0;
      reader.last = next;
      if (delta) Atomics.add(totals, 0, BigInt(delta));
    }
  };
  const state = { batch: 0, callsInBatch: 0, lastTick: 0 };
  Object.defineProperty(state, 'pausedMs', {
    enumerable: true,
    get: () => Number(Atomics.load(totals, 1)),
    set: value => { Atomics.store(totals, 1, BigInt(Math.floor(value))); },
  });
  const batchTicks = () => {
    sync();
    return Number((Atomics.load(totals, 0) * 1000n / BigInt(blocksPerSecond)
      + Atomics.load(totals, 1)) & 0x7fffffffn);
  };
  const getTicks = () => (state.lastTick = batchTicks());
  const wrapInstance = instance => {
    const native = instance.exports;
    if (!native.get_blocks_now) throw new Error('CPU service requires get_blocks_now');
    const reader = { read: native.get_blocks_now, last: native.get_blocks_now() >>> 0, runEndMs: batchTicks() };
    readers.push(reader);
    // Export facades also cover nested loader/callback execution, not merely
    // ordinary scheduler runs. Never replace the native counter reader.
    const exports = {};
    for (const [name, value] of Object.entries(native)) exports[name] =
      typeof value === 'function' && name !== 'get_blocks_now' ? (...args) => {
        const before = native.get_blocks_now() >>> 0;
        try { return value(...args); } finally {
          sync();
          if ((native.get_blocks_now() >>> 0) !== before) reader.runEndMs = batchTicks();
        }
      } : value;
    // Persist execution-boundary time across later diagnostics and sibling work.
    exports.get_service_run_end_ms = () => reader.runEndMs;
    return { exports };
  };
  const wrapImports = host => {
    for (const [name, fn] of Object.entries(host)) {
      if (typeof fn !== 'function') continue;
      host[name] = (...args) => { sync(); return fn(...args); };
    }
  };
  return { state, batchTicks, getTicks, sync, wrapInstance, wrapImports,
    retiredBlocks: () => { sync(); return Atomics.load(totals, 0); },
    service: { blocksPerSecond, buffer },
    getTickMsPerBatch: () => 0,
    setTickMsPerBatch: () => { throw new Error('Select --clock=batch to change batch tick size'); },
    advanceIdle: ms => { if (ms > 0) Atomics.add(totals, 1, BigInt(Math.ceil(ms))); },
  };
}

module.exports = { createBatchClock, createServiceClock };
