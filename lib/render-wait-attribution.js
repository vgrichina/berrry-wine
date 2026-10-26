'use strict';

// Observations only. The bridge readiness timestamp includes queueing, worker
// rasterization and presentation fences; it is not a measurement of raster CPU.
// No token history is retained. Only the current wait and eight slow samples
// survive, and no guest strings, errors or callbacks enter the diagnostic.
const OPERATIONS = new Set(['DRAW', 'CLEAR', 'PRESENT', 'READBACK', 'RESOURCE_UPDATE', 'FENCE']);
const BUCKETS = [0, 1, 5, 20, 100, 1000];
function createRenderWaitAttribution() {
  const stats = {
    requests: 0, pending: 0, completed: 0, rejected: 0, deadline: 0,
    stopped: 0, superseded: 0, lateSettlements: 0, unknownRequests: 0,
    parkWaits: 0, parkMs: 0, bridgePendingMs: 0, readyToResumeMs: 0,
    unknownMs: 0, bucketUpperMs: [...BUCKETS, null], latencyBuckets: Array(7).fill(0),
    slowest: [], dropped: 0, droppedMs: 0,
  };
  let active = null;
  function finish(item, state) {
    if (!item || item.finished) return;
    item.finished = true;
    stats.pending--; stats[state]++;
    let bucket = BUCKETS.findIndex(limit => item.parkMs <= limit);
    stats.latencyBuckets[bucket < 0 ? BUCKETS.length : bucket]++;
    const sample = { operation: item.operation, state, parkMs: item.parkMs,
      bridgePendingMs: item.bridgeMs, readyToResumeMs: item.schedulerMs, unknownMs: item.unknownMs };
    stats.slowest.push(sample);
    stats.slowest.sort((a, b) => b.parkMs - a.parkMs);
    if (stats.slowest.length > 8) {
      const dropped = stats.slowest.pop(); stats.dropped++; stats.droppedMs += dropped.parkMs;
    }
    item.record = null;
    if (active === item) active = null;
  }
  return {
    stats,
    begin(wait, record) {
      finish(active, 'superseded');
      const operation = OPERATIONS.has(record?.renderWaitOperation) ? record.renderWaitOperation : 'unknown';
      const item = wait.attribution = { record, operation, finished: false, settled: false,
        rejected: false, started: null, parkMs: 0, bridgeMs: 0, schedulerMs: 0, unknownMs: 0 };
      active = item; stats.requests++; stats.pending++;
      if (operation === 'unknown') stats.unknownRequests++;
    },
    reject(wait) { if (wait.attribution) wait.attribution.rejected = true; },
    settle(wait) {
      const item = wait.attribution;
      if (!item) return;
      if (item.finished) { stats.lateSettlements++; return; }
      item.settled = true;
      item.rejected ||= !!item.record?.error;
      if (item.started === null) finish(item, item.rejected ? 'rejected' : 'completed');
    },
    parkStart(wait, started) {
      const item = wait.attribution;
      if (item && !item.finished && item.started === null) { item.started = started; stats.parkWaits++; }
    },
    parkEnd(wait, ended, state) {
      const item = wait.attribution;
      if (!item || item.finished || item.started === null) return;
      const elapsed = Math.max(0, ended - item.started);
      const ready = item.record?.renderWaitReadyAt;
      let bridgeMs = 0, schedulerMs = 0, unknownMs = 0;
      if (Number.isFinite(ready)) {
        bridgeMs = Math.max(0, Math.min(elapsed, ready - item.started));
        schedulerMs = elapsed - bridgeMs;
      } else if (item.record && !item.record.done) bridgeMs = elapsed;
      else unknownMs = elapsed;
      item.parkMs += elapsed; item.bridgeMs += bridgeMs;
      item.schedulerMs += schedulerMs; item.unknownMs += unknownMs;
      stats.parkMs += elapsed; stats.bridgePendingMs += bridgeMs;
      stats.readyToResumeMs += schedulerMs; stats.unknownMs += unknownMs;
      item.started = null;
      if (item.settled) finish(item, item.rejected ? 'rejected' : 'completed');
      else if (state === 'deadline' || state === 'stopped') finish(item, state);
    },
    close(state = 'stopped') {
      // No invented elapsed time on exit: parkEnd owns actual awaited intervals.
      if (active) finish(active, active.settled ? (active.rejected ? 'rejected' : 'completed') : state);
    },
    summary() {
      return `render attribution: ${stats.completed} completed, ${stats.rejected} rejected, `
        + `${stats.pending} pending, ${stats.deadline} deadline, ${stats.stopped} stopped, `
        + `${stats.superseded} superseded; park ${stats.parkMs}ms = bridge-pending ${stats.bridgePendingMs}ms `
        + `+ ready-to-resume ${stats.readyToResumeMs}ms + unknown ${stats.unknownMs}ms; `
        + `unknown requests ${stats.unknownRequests}, slow samples dropped ${stats.dropped}; `
        + `slowest ${stats.slowest.map(x => `${x.operation}:${x.state}:${x.parkMs}ms`).join(',')}`;
    },
  };
}
module.exports = { createRenderWaitAttribution };
