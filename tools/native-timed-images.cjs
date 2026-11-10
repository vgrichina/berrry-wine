'use strict';
const assert = require('node:assert/strict');

// The caller authenticates the target before arming. No owner/witness RPC may
// precede a scheduled screenshot: a busy guest can defer those RPCs past UP.
// Images remain provisional until done() validates the owner and witness.
exports.arm = ({capture, validate, guard, save, delays = [120, 1000],
  deadline, now = Date.now}) => {
  const armedAt = now();
  assert(delays.length && delays.every(d => Number.isInteger(d) && d >= 0));
  assert(armedAt + Math.max(...delays) < deadline);
  let failure, finished;
  const fail = e => { failure ??= e; guard.fail(e); };
  const tasks = delays.map((delay, index) => new Promise(resolve => {
    setTimeout(async () => {
      try {
        guard.check();
        const requestedAt = now();
        assert(requestedAt < deadline, 'image request deadline');
        const image = await capture(index);
        const completedAt = now();
        assert(completedAt < deadline, 'image completion deadline');
        resolve({index, delay, requestedAt, completedAt, image});
      } catch (e) { fail(e); resolve(null); }
    }, delay);
  }));
  // Attach handlers immediately, including when the caller is still awaiting UP.
  const captured = Promise.all(tasks);
  return {armedAt, done() {
    return finished ??= (async () => {
      const records = await captured;
      if (failure) throw failure;
      try {
        guard.check();
        const binding = await validate();
        guard.check();
        save({armedAt, records, binding});
        return records;
      } catch (e) { fail(e); throw failure; }
    })();
  }};
};
