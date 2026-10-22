'use strict';

// ONE choice of guest clock, for every thread in the process.
//
// A headless run has two consumers of "what time does the guest think it is":
// the thread that owns the batch loop, whose host import table answers
// GetTickCount/timeGetTime directly, and the worker-hosted guest threads, which
// read a value the batch loop PUBLISHES into their control block (they cannot
// call back into this thread for it). Those were two separate expressions at
// two call sites in test/run.js, and nothing held them together:
//
//   main thread   --real-ticks ? wall clock : batchClock.getTicks()
//   worker publish                            batchClock.batchTicks()
//
// so `--real-ticks --threads` put the main thread on the wall clock and every
// worker-hosted thread on the batch counter. Two threads of one guest then
// disagree about how much time has passed, and everything either decides by
// elapsed time -- a timeout, a frame pace, a watchdog -- is decided against a
// clock the other does not share. That is the same class of bug as 01b81f21,
// where spawned threads kept Date.now() while the main thread moved to the
// batch clock; this is the half of it that the publish path kept.
//
// The two entry points are deliberately different and both are needed:
//
//   ticks()      what a guest CALL gets. In batch mode this steps within a
//                batch, so successive GetTickCount probes inside one batch can
//                be told apart, and it is monotonic by construction.
//   publish()    what the host hands to worker threads. Same clock, but it
//                must not consume a per-call step -- publishing is the host
//                talking about the clock, not the guest reading it, and a
//                publish that burned call steps would let the host's own
//                bookkeeping advance the guest's clock.
//
// In batch mode publish() is therefore the batch's base time and ticks() is at
// or above it, never below: worker threads can lag the main thread by up to one
// batch step, but they can never lead it and can never move backwards.
function createGuestClockSource({
  batchClock,
  realTicks = false,
  timeScale = 1,
  clockOrigin = 0,
  now = Date.now,
  // Optional raw -> guest elapsed-time map (lib/startup-clock.js). Applied to
  // the wall reading only: in batch mode the caller wraps the batch clock
  // itself, so every consumer of that clock sees the same dilated time.
  mapElapsed = null,
} = {}) {
  if (!batchClock && !realTicks) {
    throw new Error('createGuestClockSource: batch mode needs a batchClock');
  }
  const wall = mapElapsed
    ? () => ((Math.floor(mapElapsed((now() - clockOrigin) * timeScale)) | 0) & 0x7FFFFFFF)
    : () => ((((now() - clockOrigin) * timeScale) | 0) & 0x7FFFFFFF);
  if (realTicks) {
    // The wall clock has no per-call step to spend, so both entry points are
    // the same reading. Worker threads and the main thread agree exactly.
    return { realTicks: true, ticks: wall, publish: wall };
  }
  return {
    realTicks: false,
    ticks: () => batchClock.getTicks(),
    publish: () => batchClock.batchTicks(),
  };
}

module.exports = { createGuestClockSource };
