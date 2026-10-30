'use strict';
// Only source-verified pure WASM global readers are called. Never poll the
// scheduler, resolve waits, drain input, or invoke a continuation from here.
function createObserver({enabled, read}) {
  let entered = 0, completed = 0, previous = null;
  const unavailable = reason => ({available: false, reason});
  const value = (obj, key) => {
    if (!obj) return unavailable('binding absent');
    const d = Object.getOwnPropertyDescriptor(obj, key);
    return d && 'value' in d ? d.value : unavailable('missing or accessor property');
  };
  const global = (e, name) => {
    const f = value(e, name);
    if (typeof f !== 'function') return unavailable(name + ' export absent');
    try { return f() >>> 0; } catch (_) { return unavailable(name + ' read failed'); }
  };
  const continuation = e => ({pc: global(e, 'get_eip'),
    threadId: global(e, 'get_current_thread_id'), apiCalls: global(e, 'get_api_calls'),
    yieldFlag: global(e, 'get_yield_flag'), yieldReason: global(e, 'get_yield_reason')});
  return {
    before() { if (enabled) entered++; },
    after() { if (enabled) completed++; },
    sample() {
      if (!enabled) return unavailable('requires --trace-input-poll');
      try {
        const s = read(), main = continuation(s.instance && s.instance.exports);
        const rows = [], manager = s.threadManager;
        // These are actual pinned ThreadManager record fields, not ctx aliases.
        const threads = manager && value(manager, 'threads');
        if (threads instanceof Map) for (const [, t] of threads) {
          if (rows.length === 32) break;
          const i = value(t, 'instance');
          rows.push({tid: value(t, 'tid'), state: value(t, 'state'),
            suspendCount: value(t, 'suspendCount'), continuation: continuation(i && i.exports)});
        }
        const current = {batch: s.tickState.batch, polls: s.guestPollTrace.entries, entered, completed};
        const delta = previous ? Object.fromEntries(Object.keys(current).map(k => [k, current[k] - previous[k]])) : null;
        let evidence = 'baseline';
        if (delta) {
          if (delta.polls > 0) evidence = 'input-poll-progress';
          else if ([1, 7, 8, 10, 16].includes(main.yieldReason)) evidence = 'yield-or-wait-observed';
          else if (delta.completed > 0) evidence = 'main-slices-completed-without-input-poll';
          else if (delta.batch > 0 && main.yieldReason === 0) evidence = 'main-not-dispatched-between-samples';
          else evidence = 'unavailable';
        }
        previous = current;
        return {available: true, scope: 'main run sites; thread records at control boundary',
          ...current, main, delta, evidence, input: s.poll,
          threads: threads instanceof Map ? rows : unavailable('threadManager.threads unavailable'),
          threadRecordsTruncated: threads instanceof Map && threads.size > 32,
          apiName: unavailable('no invocation-owned current API binding'),
          schedulerStarvation: unavailable('dispatch absence alone cannot exclude host parking; no worker slice heartbeat'),
          uninterruptedExecution: unavailable('control HTTP cannot sample a synchronous run in progress'),
          continuation: 'saved PC/yield only; no continuation callbacks invoked', runtimeQualified: false};
      } catch (_) { return unavailable('lexical state read failed'); }
    },
  };
}
module.exports = {createObserver};
