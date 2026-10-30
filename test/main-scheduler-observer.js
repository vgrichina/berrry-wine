'use strict';

// CLI invocation-owned diagnostics. Values come from the decision itself;
// this observer has no guest exports, clock reader, queue or scheduler access.
function createMainSchedulerObserver({ logs, limit = 256, isOpen = () => true,
  summaryEvery = 1000, summaryLimit = 128 }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 4096)
    throw new Error('invalid main scheduler observation limit');
  if (!Number.isInteger(summaryEvery) || summaryEvery < 1 ||
      !Number.isInteger(summaryLimit) || summaryLimit < 1 || summaryLimit > 128)
    throw new Error('invalid main scheduler summary limits');
  let count = 0, sequence = 0, last = null, active = null, workerTid = null;
  let summaryCount = 0, summaryBatch = null, lastDecision = null;
  const totals = { decisions: 0, suspended: 0, runnable: 0, runs: 0,
    returned: 0, threw: 0, mainPolls: 0, workerPolls: 0, outsidePolls: 0 };
  const bump = key => { totals[key] = Math.min(0xffffffff, totals[key] + 1); };
  const summarize = batch => {
    if (summaryCount >= summaryLimit || !Number.isSafeInteger(batch) ||
        (summaryBatch !== null && batch - summaryBatch < summaryEvery)) return;
    summaryCount++; summaryBatch = batch;
    // Independent of the detail cap: long runs retain evidence after the
    // first 256 decisions. These are window-local cumulative counts, not
    // guest message counts. No exports, queue reads or clock calls occur.
    logs.push('[main-scheduler-summary] ' + JSON.stringify({ batch,
      totals: { ...totals }, lastDecision,
      saturated: Object.values(totals).some(n => n === 0xffffffff) }));
  };
  const emit = row => {
    if (!isOpen()) return;
    if (count >= limit) {
      if (count === limit) {
        logs.push('[main-scheduler] limit reached; further observations suppressed');
        count++;
      }
      return;
    }
    count++;
    logs.push('[main-scheduler] ' + JSON.stringify(row));
  };
  return {
    begin(path, batch) {
      last = null;
      if (!isOpen()) return null;
      summarize(batch);
      const row = { event: 'decision', id: ++sequence, path, batch,
        yieldReason: null, liveThreads: null, sleepChecks: [], fastForward: false };
      return {
        yield(value) { row.yieldReason = value; return value; },
        live(value) { row.liveThreads = value; return value; },
        sleep(value) { row.sleepChecks.push(value); },
        fastForward() { row.fastForward = true; },
        finish(suspended, reason) {
          row.suspended = suspended; row.reason = reason;
          bump('decisions'); bump(suspended ? 'suspended' : 'runnable');
          lastDecision = { path, batch, suspended, reason, yieldReason: row.yieldReason };
          last = row; emit(row);
          return suspended;
        },
      };
    },
    run(path, run) {
      const previous = active;
      // Only the immediately preceding admission at this actual call site
      // can identify this slice. Probe calls are never a run admission.
      active = last && last.path === path && !last.suspended ? last : null;
      last = null;
      const observed = isOpen();
      const context = active;
      if (observed) bump('runs');
      const pollsBefore = totals.mainPolls;
      emit({ event: 'main-run', decisionId: active ? active.id : null, path,
        batch: active ? active.batch : null });
      let returned = false;
      try { const value = run(); returned = true; return value; }
      finally {
        if (observed) {
          bump(returned ? 'returned' : 'threw');
          emit({ event: 'main-run-finish', decisionId: context ? context.id : null,
            path, batch: context ? context.batch : null, returned,
            mainPolls: totals.mainPolls - pollsBefore });
        }
        active = previous;
      }
    },
    hostInput() {
      if (isOpen()) bump(workerTid !== null ? 'workerPolls' : active ? 'mainPolls' : 'outsidePolls');
      emit({ event: 'host-check-input', decisionId: workerTid === null && active ? active.id : null,
        path: workerTid === null && active ? active.path : null,
        batch: workerTid === null && active ? active.batch : null,
        scope: workerTid !== null ? 'worker' : active ? 'admitted-main-run' : 'outside-observed-main-run',
        workerTid });
    },
    workerInput(tid, checkInput) {
      const previous = workerTid; workerTid = tid;
      try { return checkInput(); } finally { workerTid = previous; }
    },
  };
}

module.exports = { createMainSchedulerObserver };
