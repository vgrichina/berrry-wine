// Bounded read-only sparse backing census. Use as --before-load SOURCE and
// relay 'backing-census'. Reads the loaded page's RegionMap, never copied bases.
// First four OOM console messages trigger synchronous snapshots; up to eight
// periodic snapshots cover startup. No guest writes, locks, free-list flushes,
// allocator calls, or API return overrides. Worker writes can race this probe:
// equal repeated metadata reads are only a consistency check, not a lock.
(function (root) {
  'use strict';
  function census(buffer, layout, exports = {}) {
    const regions = layout.REGIONS;
    const names = ['VIRTUAL_MAP_STATE', 'VIRTUAL_MAP_TABLE',
      'VIRTUAL_RESERVE_TABLE', 'VIRTUAL_HOLE_TABLE', 'HEAP_ARENAS'];
    function copy() {
      return Object.fromEntries(names.map(name => {
        const r = regions[name];
        if (!r || r.size > 262144 || r.base + r.size > buffer.byteLength)
          throw new Error('invalid census region: ' + name);
        return [name, new Uint32Array(new Uint8Array(buffer, r.base, r.size).slice().buffer)];
      }));
    }
    const raw = copy(), again = copy();
    const stable = names.every(n => raw[n].every((v, i) => v === again[n][i]));
    const state = Array.from(raw.VIRTUAL_MAP_STATE);
    const issues = [];
    function records(name, count, stride, skip = 0) {
      const words = raw[name], capacity = (words.length - skip) / stride;
      if (count > capacity) issues.push(name + ' count exceeds capacity');
      return { count, capacity, rows: Array.from({ length: Math.min(count, capacity) },
        (_, i) => Array.from(words.slice(skip + i * stride, skip + (i + 1) * stride))) };
    }
    const maps = records('VIRTUAL_MAP_TABLE', state[0], 4);
    const reservations = records('VIRTUAL_RESERVE_TABLE', state[4], 2);
    const holes = records('VIRTUAL_HOLE_TABLE', state[3], 2);
    const arenas = records('HEAP_ARENAS', raw.HEAP_ARENAS[0], 4, 4);
    const windows = [regions.VIRTUAL_BACKING_BASE];
    if (buffer.byteLength > regions.THREAD_RPC.end)
      windows.push({ base: regions.THREAD_RPC.end, end: buffer.byteLength });
    const pools = windows.map(window => {
      const occupied = maps.rows.map(r => [r[2], r[2] + r[1]])
        .filter(r => r[0] < window.end && r[1] > window.base)
        .sort((a, b) => a[0] - b[0]);
      let cursor = window.base, overlapBytes = 0;
      const gaps = [];
      for (const [lo, hi] of occupied) {
        if (lo < window.base || hi > window.end) issues.push('map crosses backing window');
        const start = Math.max(lo, window.base), end = Math.min(hi, window.end);
        if (start > cursor) gaps.push([cursor, start - cursor]);
        else overlapBytes += Math.max(0, Math.min(cursor, end) - start);
        cursor = Math.max(cursor, end);
      }
      if (cursor < window.end) gaps.push([cursor, window.end - cursor]);
      return { base: window.base, end: window.end, capacity: window.end - window.base,
        freeBytes: gaps.reduce((n, r) => n + r[1], 0),
        largestGap: gaps.reduce((n, r) => Math.max(n, r[1]), 0),
        // Upper bound only: split allocation uses ordered recursive halves,
        // map slots and publication checks, not arbitrary page packing.
        free64KGranules: gaps.reduce((n, r) => n + Math.floor(r[1] / 65536), 0),
        overlapBytes, gaps };
    });
    for (const r of maps.rows) {
      if (!r[1] || !windows.some(w => r[2] >= w.base && r[2] + r[1] <= w.end))
        issues.push('invalid or out-of-window map');
    }
    const getters = {};
    for (const name of ['get_virtual_alloc_top', 'get_heap_ptr', 'get_heap_end',
      'get_heap_sparse_ptr', 'get_heap_sparse_end'])
      getters[name] = typeof exports[name] === 'function' ? exports[name]() >>> 0 : null;
    return { layoutHash: layout.LAYOUT_HASH, wasmBytes: buffer.byteLength,
      repeatedMetadataEqual: stable, atomicSnapshot: false, issues,
      state, stateFields: ['mapCount', 'primaryCursor', 'sharedReserveTop',
        'holeCount', 'reservationCount', 'stickyFloor', 'extensionCursor', 'reserved'],
      maps, reservations, holes, arenas, pools, getters,
      arenaFields: ['base', 'reservedEnd', 'allocatedEnd', 'liveChargedBytes'],
      mapFields: ['guest', 'bytes', 'backing', 'protectionAndFlags'] };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = census;
    return;
  }
  const snapshots = [], realLog = console.log.bind(console);
  let oomCount = 0, ticks = 0;
  function capture(trigger) {
    try {
      const apps = runningApps;
      const w = apps[0] && apps[0].wine;
      if (!w || !w.instance || !root.RegionMap) return;
      const mem = w.memory || w.instance.exports.memory;
      if (!mem) return;
      const snapshot = { trigger, t: performance.now(), appCount: apps.length,
        ...census(mem.buffer, root.RegionMap, w.instance.exports) };
      snapshots.push(snapshot);
      realLog('backing-census ' + JSON.stringify(snapshot));
    } catch (error) { realLog('backing-census-error ' + String(error)); }
  }
  console.log = function (...args) {
    if (typeof args[0] === 'string' && args[0].startsWith('[heap] OOM') && oomCount++ < 4)
      capture(args[0]);
    return realLog(...args);
  };
  const timer = setInterval(() => {
    capture('periodic');
    if (++ticks === 8) clearInterval(timer);
  }, 20000);
  root.__backingCensus = snapshots;
  root.__backingCensusStop = () => { clearInterval(timer); };
})(typeof globalThis !== 'undefined' ? globalThis : this);
