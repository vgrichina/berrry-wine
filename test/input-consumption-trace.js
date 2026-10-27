'use strict';

// CLI-only observations. Never call guestClock.ticks(): tracing must not spend
// a guest clock probe. IDs identify observations, not inferred MSG provenance.
function createInputConsumptionTrace({ enabled, logs, snapshot, limit = 1000,
  counterLimit = 0xffffffff }) {
  if (!Number.isInteger(counterLimit) || counterLimit < 1 || counterLimit > 0xffffffff)
    throw new Error('invalid input consumption counter limit');
  let count = 0;
  let dequeueId = 0;
  let lastDequeueId = null;
  let enqueueId = 0;
  let lastGuestTick = 'unavailable';
  const enqueued = new WeakMap();
  const counters = { scheduled: 0, enqueued: 0, dequeued: 0, routed: 0, dispatched: 0 };
  const bump = name => { counters[name] = Math.min(counterLimit, counters[name] + 1); };
  const last = { dequeue: null, route: null, dispatch: null };
  const message = evt => Object.fromEntries(['hwnd', 'msg', 'wParam', 'lParam'].map(
    key => [key, Number.isFinite(evt[key]) ? evt[key] >>> 0 : 'unknown']));
  const emit = (prefix, detail) => {
    if (!enabled) return;
    if (count >= limit) {
      if (count === limit) {
        logs.push('[input-timing] trace limit reached; further observations suppressed');
        count++;
      }
      return;
    }
    count++;
    const s = snapshot();
    logs.push(`${prefix} ${detail} batch=${s.batch} guestMs=${s.guestMs}`
      + ` clock=${s.clock} lastGuestTick=${s.lastGuestTick}`);
  };
  const hex = n => `0x${(n >>> 0).toString(16)}`;
  return {
    // Observe returns at the outermost clock reader, after startup mapping.
    // Never reconstruct a past return with today's mapping or spend a probe.
    get lastGuestTick() { return lastGuestTick; },
    observeTicks: ticks => enabled ? function (...args) {
      const value = Reflect.apply(ticks, this, args);
      lastGuestTick = value;
      return value;
    } : ticks,
    schedule: ev => {
      if (enabled) bump('scheduled');
      emit('[input-schedule]',
        `scheduledBatch=${ev.batch} action=${ev.action || 'raw'} correlation=unavailable`);
    },
    enqueue: (evt, ev) => {
      if (enabled) {
        bump('enqueued');
        const id = enqueueId < counterLimit ? ++enqueueId : 'unavailable';
        enqueued.set(evt, { id, batch: ev.batch });
        emit('[input-enqueue]', `enqueueId=${id} scheduledBatch=${ev.batch}`);
      }
      return evt;
    },
    dequeue: (evt, source) => {
      if (!enabled) return;
      bump('dequeued');
      lastDequeueId = dequeueId < counterLimit ? ++dequeueId : 'unavailable';
      const origin = enqueued.get(evt);
      last.dequeue = { id: lastDequeueId, source: String(source).slice(0, 64),
        enqueueId: origin ? origin.id : 'unavailable', ...message(evt) };
      emit('[input-dequeue]', `dequeueId=${lastDequeueId} source=${source}`
        + (origin ? ` enqueueId=${origin.id} scheduledBatch=${origin.batch}` : ' enqueueId=unavailable')
        + ` hwnd=${hex(evt.hwnd)} msg=${hex(evt.msg)} wParam=${hex(evt.wParam)} lParam=${hex(evt.lParam)}`);
    },
    route: (focusHwnd, hwnd) => {
      if (enabled && lastDequeueId !== null) {
        bump('routed');
        last.route = { dequeueId: lastDequeueId, focusHwnd: focusHwnd >>> 0, hwnd: hwnd >>> 0 };
      }
      if (lastDequeueId !== null) emit('[input-dequeue-route]',
        `dequeueId=${lastDequeueId} focusHwnd=${hex(focusHwnd)} hwnd=${hex(hwnd)}`);
    },
    dispatch: (api, hwnd, msg, wp, lp) => {
      if (enabled) {
        bump('dispatched');
        last.dispatch = { api: String(api).slice(0, 64),
          ...message({hwnd, msg, wParam: wp, lParam: lp}), correlation: 'unavailable' };
      }
      emit('[dispatch-input]',
        `${api} hwnd=${hex(hwnd)} msg=${hex(msg)} wParam=${hex(wp)} lParam=${hex(lp)}`
        + ' correlation=unavailable');
    },
    // No ticks/publish, queue poll, scheduler methods, atomics or clear-on-read
    // exports here. Validation precedes even the lazy read of parked host state.
    frozenState: (request, boundary, read) => {
      if (!enabled) throw new Error('input-state needs --trace-input-dispatch');
      if (!request || request.action !== 'input-state' ||
          typeof request.id !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(request.id) ||
          Object.keys(request).some(k => k !== 'id' && k !== 'action'))
        throw new Error('input-state needs only action and a printable id (1..128 bytes)');
      if (boundary.frozen !== true || boundary.credits !== 0)
        throw new Error('input-state needs frozen mode with zero credits');
      return { requestId: request.id, batch: boundary.batch, frozen: true, credits: 0,
        counters: {...counters}, counterLimit, saturated: Object.values(counters).some(n => n === counterLimit),
        last: JSON.parse(JSON.stringify(last)), ...readInputState(read()) };
    },
  };
}

function readInputState(s) {
  const unknown = 'unknown';
  const scalar = v => typeof v === 'number' && Number.isFinite(v) ? v
    : typeof v === 'boolean' ? v : typeof v === 'string' ? v.slice(0, 64) : unknown;
  const event = v => v && typeof v === 'object'
    ? Object.fromEntries(['action', 'batch', 'hwnd', 'msg', 'wParam', 'lParam'].map(k => [k, scalar(v[k])]))
    : { commandId: scalar(v) };
  const queue = q => Array.isArray(q)
    ? { count: Math.min(0xffffffff, q.length), truncated: q.length > 16, head: q.slice(0, 16).map(event) }
    : { count: unknown, head: [], truncated: false };
  const getter = (e, name) => {
    try { return e && typeof e[name] === 'function' ? scalar(e[name]()) : unknown; }
    catch (_) { return unknown; }
  };
  const thread = (t, e, sleepUntil) => ({
    state: scalar(t && t.state), suspendCount: scalar(t && t.suspendCount),
    eip: getter(e, 'get_eip'), yieldReason: getter(e, 'get_yield_reason'),
    waitHandle: getter(e, 'get_wait_handle'), waitTimeout: getter(e, 'get_wait_timeout'),
    sleepUntil: scalar(sleepUntil), sleepActive: unknown,
  });
  const tm = s.threadManager, threads = [];
  if (tm && tm.threads instanceof Map) {
    for (const [handle, t] of tm.threads) {
      if (threads.length === 16) break;
      // Worker instances are concurrently owned: never read their memory or
      // call into them. Last reports are not a coherent frozen observation.
      threads.push({ handle: scalar(handle), tid: scalar(t.tid),
        ...thread(t, t.instance && !t.link ? t.instance.exports : null, t.sleepUntil) });
    }
  }
  const keys = {};
  for (const vk of [16, 17, 18, 32]) {
    keys[vk] = Object.fromEntries(['_physicalKeys', '_asyncKeys', '_asyncPressedKeys'].map(k =>
      [k, s.renderer && s.renderer[k] ? !!s.renderer[k][vk] : unknown]));
  }
  return {
    queues: { scheduled: queue(s.scheduledInput), pending: queue(s.inputEvent ? [s.inputEvent] : []),
      crossThread: queue(s.crossThreadMsgs), buttons: queue(s.inputQueue),
      renderer: queue(s.renderer && s.renderer.inputQueue), guestPostQueue: unknown },
    keys,
    threads: { backend: scalar(tm && tm.backend),
      main: thread(tm && tm._mainThreadState, s.exports, tm && tm._mainSleepUntil),
      count: tm && tm.threads instanceof Map ? Math.min(0xffffffff, tm.threads.size) : unknown,
      truncated: !!(tm && tm.threads instanceof Map && tm.threads.size > 16), head: threads },
    sdlConsumption: unknown,
  };
}

module.exports = { createInputConsumptionTrace };
