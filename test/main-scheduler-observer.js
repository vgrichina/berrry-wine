'use strict';

// CLI invocation-owned diagnostics. Values come from the decision itself;
// this observer has no guest exports, clock reader, queue or scheduler access.
function createMainSchedulerObserver({ logs, limit = 256, isOpen = () => true }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 4096)
    throw new Error('invalid main scheduler observation limit');
  let count = 0, sequence = 0, last = null, active = null, workerTid = null;
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
      if (count >= limit || !isOpen()) return null;
      const row = { event: 'decision', id: ++sequence, path, batch,
        yieldReason: null, liveThreads: null, sleepChecks: [], fastForward: false };
      return {
        yield(value) { row.yieldReason = value; return value; },
        live(value) { row.liveThreads = value; return value; },
        sleep(value) { row.sleepChecks.push(value); },
        fastForward() { row.fastForward = true; },
        finish(suspended, reason) {
          row.suspended = suspended; row.reason = reason;
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
      emit({ event: 'main-run', decisionId: active ? active.id : null, path,
        batch: active ? active.batch : null });
      try { return run(); } finally { active = previous; }
    },
    hostInput() {
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
