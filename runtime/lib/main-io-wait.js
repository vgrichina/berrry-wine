'use strict';

// The main guest thread parked on a lazy ReadFile (io_wait, yield 12), in the
// page's cooperative scheduler (host.js): a parked read blocks ONLY its own
// guest thread.
//
// A provider-backed file (a lazily mounted manifest entry, a zip/iso member, a
// dropped File) asked for a chunk that is not resident. ReadFile parked with
// its stdcall frame restored and EIP on the thunk, so once the chunk is filled
// clearing the yield re-enters the same call and it takes the cache hit. The
// hosts used to `await` that fill inside the step, which stopped the whole
// cooperative scheduler for the length of a network fetch: no worker-thread
// slices, no timers, no audio refill -- Heroes III's sound thread stopped
// feeding DirectSound and the ring audibly looped. With this the fill runs in
// the background; the host asks poll() each turn and runs everything else while
// it answers true. The page's step loop is paced by the wall clock, so a park
// costs real time, as it does on Windows.
//
// test/run.js deliberately keeps awaiting the fill: its guest clock is the
// batch count (200 ms of guest time per batch by default), and a loop that
// kept spinning batches past a parked main thread advanced guest time by
// seconds per 5 ms fetch -- measured on Heroes III at --lazy-ranges=50, 1200
// batches went by before one fill landed. The CLI's DirectSound ring is not
// wall-clock either, so it never had the audible loop to fix.
//
//   const io = createMainIoWait({ fill: (vfs, pending) => ..., onDone, onError });
//   if (io.poll(instance.exports, vfs)) { /* main parked: run the others */ }
(function () {
  function createMainIoWait(options = {}) {
    const fill = options.fill || ((vfs, pending) => vfs.fillPendingRead(pending));
    let wait = null;
    return {
      // True while the main guest thread must stay off the CPU. Starts the
      // fill on the first call that sees yield 12, and on the first call after
      // it settles clears the yield and answers false.
      poll(exports, vfs) {
        if (exports.get_yield_reason() !== 12) {
          if (wait && wait.done) wait = null;
          return false;
        }
        if (!wait) {
          const pending = vfs && vfs.getPendingRead ? vfs.getPendingRead(1) : null;
          const current = { done: false, path: pending ? pending.path : '' };
          wait = current;
          current.promise = Promise.resolve()
            .then(() => (pending ? fill(vfs, pending) : undefined))
            .catch(error => { if (options.onError) options.onError(error, current.path); })
            .then(() => { current.done = true; if (options.onDone) options.onDone(); });
        }
        if (!wait.done) return true;
        wait = null;
        exports.clear_yield();
        return false;
      },
      // A fill is in flight (the host should give its event loop a turn).
      get inFlight() { return !!(wait && !wait.done); },
    };
  }

  const api = { createMainIoWait };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.mainIoWait = api;
})();
