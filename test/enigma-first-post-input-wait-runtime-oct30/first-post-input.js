'use strict';
// Invocation observers call the original import exactly once and read exports.
function create({memory, isApi, clock, inputState, limit = 24}) {
  const lanes = new Map();
  let up = null, seq = 0;
  const state = get => {
    const e = get();
    if (!e) return {unavailable: 'instance not registered'};
    const read = name => typeof e[name] === 'function' ? e[name]() >>> 0 : null;
    const esp = read('get_esp');
    return {...clock(), tid: read('get_current_thread_id'), pc: read('get_eip'), esp,
      continuation: esp === null ? null : e.guest_read32(esp) >>> 0,
      yieldFlag: read('get_yield_flag'), yieldReason: read('get_yield_reason'),
      waitHandle: read('get_wait_handle'), apiCalls: read('get_api_calls')};
  };
  const bind = (host, get, lane) => {
    if (lanes.has(lane)) throw Error('duplicate observer binding');
    const l = {first: [], firstWait: null, calls: 0, pending: []}; lanes.set(lane, l);
    const log = host.log, exit = host.log_api_exit, wait = host.wait_single;
    host.log = (ptr, len) => {
      const name = Buffer.from(memory.buffer, ptr, Math.min(len, 256)).toString().split('\0')[0];
      if (isApi(name)) {
        const s = state(get), e = get();
        const row = {phase: 'entry', id: ++seq, lane, name, ...s,
          args: e ? Array.from({length: 4}, (_, i) => e.guest_read32(s.esp + 4 + i * 4) >>> 0) : []};
        const retained = !!up && l.calls++ < limit;
        l.pending.push({row, retained});
        if (retained) l.first.push(row);
      }
      return log(ptr, len);
    };
    host.log_api_exit = (...args) => {
      const p = l.pending.pop();
      if (p && p.retained) l.first.push({phase: 'post-handler', id: p.row.id,
        lane, name: p.row.name, ...state(get), eax: get().get_eax() >>> 0,
        qualification: 'handler boundary, not completed asynchronous wait'});
      return exit(...args);
    };
    if (typeof wait === 'function') host.wait_single = (...args) => {
      const row = up && !l.firstWait ? {lane, handle: args[0] >>> 0, timeout: args[1] >>> 0,
        invocation: l.pending.length ? l.pending[l.pending.length - 1].row : null,
        entry: state(get)} : null;
      if (row) l.firstWait = row;
      const value = wait(...args);
      if (row) { row.result = value; row.postImport = state(get); }
      return value;
    };
    return {state: () => state(get)};
  };
  const bindInput = (host, get) => {
    const input = host.check_input;
    host.check_input = (...args) => {
      const value = input(...args);
      if ((value >>> 0) === 0x260100 && !up) {
        up = {packed: value >>> 0, state: state(get), nativeDequeue: inputState(),
          owners: [...lanes].map(([lane,l]) => ({lane, invocation: l.pending.length ? l.pending[l.pending.length-1].row : null}))};
        for (const l of lanes.values()) { l.first = []; l.calls = 0; }
      }
      return value;
    };
  };
  return {bind, bindInput, snapshot: () => ({up, lanes: Object.fromEntries([...lanes].map(([k,l]) =>
    [k,{first:l.first, firstWait:l.firstWait, calls:l.calls, frozen:l.calls>=limit}]))})};
}
module.exports = {create};
