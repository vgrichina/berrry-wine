// GPU stream v2 doorbell (docs/gpu-stream-v2.md "Kicks"): how a producer
// hands records to a render Worker that drains the ring on its own, with no
// message per kick. API-neutral: it touches only the GpsRing header words
// (write_pos, read_pos, done_seq, error_code, consumer), so every frontend
// that writes a v2 ring (Glide today; D3D9, D3DIM, GL next) uses it as is.
//
//   consumer  The render Worker stores a nonzero token in GpsRing.consumer
//             while it waits on write_pos with Atomics.waitAsync; 0 means "no
//             doorbell consumer: kick through the host bridge". Bit 30 (BUSY)
//             is set while it is executing records.
//   ASYNC     ring(): Atomics.notify on write_pos. The Worker wakes, drains to
//             the write_pos it then sees and waits again, so kicks coalesce.
//   SYNC      waitDrained(): ring, then Atomics.wait on done_seq until
//             read_pos == write_pos. Only a thread that may block (a guest
//             Worker) calls it; the page never waits.
//
// This file is small on purpose: every guest-thread Worker loads it.
// Node: require('./gpu-stream-doorbell'); browser/workers: GpuStreamDoorbell
// (load gpu-stream.generated.js first).
(function (root, factory) {
  const node = typeof module !== 'undefined' && module.exports;
  const gen = node ? require('./gpu-stream.generated') : root.GpuStreamGenerated;
  if (!gen) throw new Error('gpu-stream-doorbell.js: load gpu-stream.generated.js first');
  const api = factory(gen);
  if (node) module.exports = api;
  if (root) root.GpuStreamDoorbell = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (G) {
  'use strict';
  const fields = G.LAYOUTS.GpsRing.fields;
  const word = name => {
    const f = fields.find(x => x.name === name);
    if (!f || (f.offset & 3)) throw new Error('gpu-stream-doorbell: GpsRing.' + name);
    return f.offset >> 2;
  };
  const W = Object.freeze({ magic: word('magic'), write_pos: word('write_pos'), read_pos: word('read_pos'),
    done_seq: word('done_seq'), error_code: word('error_code'), api: word('api'), consumer: word('consumer') });
  const HEADER_BYTES = G.LAYOUTS.GpsRing.size;
  const MAGIC = G.CONST.MAGIC | 0;
  // A SYNC waiter gives up when the consumer makes no progress for this long:
  // a dead render Worker must fail the guest loudly, not hang it.
  const STALL_MS = 30000;
  // ...unless the consumer has said it is inside a record. One record can
  // legitimately run far past STALL_MS: the WebGL executor's first draw
  // compiles its programs, and on a software GPU shared with a busy page
  // each synchronous GL call waits its turn (minutes, measured with Quake II
  // and Hexen II under SwiftShader). read_pos cannot move until that record
  // returns, so only a much longer silence is taken as a dead Worker.
  const BUSY_STALL_MS = 600000;
  const BUSY = 0x40000000;
  const now = typeof performance !== 'undefined' && performance.now ? () => performance.now() : () => Date.now();

  // Int32Array over the memory, or null when ring is not a header in it
  // (fake memories in unit tests, a detached buffer).
  function view(buffer, ring) {
    ring >>>= 0;
    if (!buffer || (ring & 3) || ring + HEADER_BYTES > buffer.byteLength) return null;
    const i32 = new Int32Array(buffer);
    return Atomics.load(i32, (ring >> 2) + W.magic) === MAGIC ? i32 : null;
  }
  const at = (ring, name) => ((ring >>> 0) >> 2) + W[name];

  // ── producer side ─────────────────────────────────────────────────────
  function armed(i32, ring) { return !!i32 && Atomics.load(i32, at(ring, 'consumer')) !== 0; }
  function ring(i32, ringAddr) { return Atomics.notify(i32, at(ringAddr, 'write_pos')); }
  function idle(i32, ringAddr) {
    return Atomics.load(i32, at(ringAddr, 'read_pos')) === Atomics.load(i32, at(ringAddr, 'write_pos'));
  }
  // SYNC through the doorbell. Returns {drained:true, ms} once every record
  // published before the call executed (or the consumer stored an error,
  // which the WAT producer checks next), {drained:false} when the consumer
  // detached first (the caller falls back to the host bridge).
  function waitDrained(i32, ringAddr, options = {}) {
    const start = now(), stall = options.stallMs || STALL_MS;
    ring(i32, ringAddr);
    let lastRead = Atomics.load(i32, at(ringAddr, 'read_pos')), progressAt = start;
    for (;;) {
      const done = Atomics.load(i32, at(ringAddr, 'done_seq'));
      if (Atomics.load(i32, at(ringAddr, 'error_code')) || idle(i32, ringAddr)) return { drained: true, ms: now() - start };
      if (!armed(i32, ringAddr)) return { drained: false, ms: now() - start };
      Atomics.wait(i32, at(ringAddr, 'done_seq'), done, 50);
      const read = Atomics.load(i32, at(ringAddr, 'read_pos'));
      const limit = Atomics.load(i32, at(ringAddr, 'consumer')) & BUSY ? options.busyStallMs || BUSY_STALL_MS : stall;
      if (read !== lastRead) { lastRead = read; progressAt = now(); }
      else if (now() - progressAt > limit)
        throw new Error(`GPU stream ring 0x${(ringAddr >>> 0).toString(16)}: render Worker made no progress for ${limit} ms`);
    }
  }

  // ── consumer side ─────────────────────────────────────────────────────
  function attach(i32, ringAddr, token) { Atomics.store(i32, at(ringAddr, 'consumer'), ((token | 0) & (BUSY - 1)) || 1); }
  // Mark the attached consumer as executing records (or done). A detached
  // ring (consumer 0) stays detached: a late busy() must not re-arm it.
  function busy(i32, ringAddr, on) {
    const a = at(ringAddr, 'consumer');
    for (;;) {
      const cur = Atomics.load(i32, a);
      const next = on ? cur | BUSY : cur & ~BUSY;
      if (!cur || next === cur || Atomics.compareExchange(i32, a, cur, next) === cur) return;
    }
  }
  function detach(i32, ringAddr) {
    Atomics.store(i32, at(ringAddr, 'consumer'), 0);
    // A SYNC waiter re-checks `consumer` and falls back to the bridge.
    Atomics.notify(i32, at(ringAddr, 'done_seq'));
  }
  // Promise that resolves when write_pos may have moved past `seen`.
  function whenPublished(i32, ringAddr, seen) {
    const r = Atomics.waitAsync(i32, at(ringAddr, 'write_pos'), seen | 0);
    return r.async ? r.value : Promise.resolve(r.value);
  }
  const supported = () => typeof Atomics.waitAsync === 'function';

  return { W, HEADER_BYTES, BUSY, view, armed, ring, idle, waitDrained, attach, busy, detach, whenPublished, supported,
    apiOf: (i32, ringAddr) => Atomics.load(i32, at(ringAddr, 'api')) >>> 0,
    writePos: (i32, ringAddr) => Atomics.load(i32, at(ringAddr, 'write_pos')) };
});
