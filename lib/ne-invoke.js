'use strict';

// Internal register-called NE entry driver. Callers must pass exports belonging
// to their exact live guest thread (the ThreadManager invocation facade when
// applicable). This does not publish a module or implement a guest API.
async function invokeNeEntry(e, entry, options = {}) {
  if (options.serviceYield !== undefined)
    throw new TypeError('Asynchronous NE yield service requires an owned settlement protocol');
  const maxBlocks = options.maxBlocks ?? 100000;
  const sliceBlocks = options.sliceBlocks ?? 256;
  if (!Number.isSafeInteger(maxBlocks) || maxBlocks < 1 || maxBlocks > 10000000 ||
      !Number.isSafeInteger(sliceBlocks) || sliceBlocks < 1 || sliceBlocks > maxBlocks)
    throw new RangeError('Invalid NE invocation block budget');
  const checkCancelled = () => {
    if (options.signal?.aborted) throw options.signal.reason ?? new Error('NE invocation cancelled');
  };
  checkCancelled();
  const token = e.win16_bridge_frame_begin();
  if (!token) throw new Error('Cannot acquire NE invocation context');
  let failure;
  try {
    if (!e.win16_bridge_invoke_begin(token, entry.target, entry.ds, entry.instance, entry.heap))
      throw new Error('Invalid NE entry or execution lease busy');
    for (let remaining = maxBlocks; remaining > 0;) {
      checkCancelled();
      const blocks = Math.min(sliceBlocks, remaining);
      e.run(blocks); remaining -= blocks;
      const result = e.win16_bridge_invoke_result(token);
      if (result >= 0n) return Number(result);
      const reason = e.get_yield_reason();
      if (reason) {
        throw new Error('Unsupported NE invocation yield ' + reason);
      }
      // Deliberately no await: the ordinary scheduler cannot borrow this
      // thread while its caller state is suspended. Only an already-aborted
      // signal or abort raised by a synchronous host callback is observable.
    }
    throw new Error('NE invocation block budget exhausted');
  } catch (error) {
    failure = error; throw error;
  } finally {
    // End also cancels a running frame. The token prevents unwinding somebody
    // else's nested invocation or a recycled thread/frame by accident.
    try {
      if (!e.win16_bridge_frame_end(token)) throw new Error('NE invocation context teardown rejected');
    } catch (cleanupError) {
      if (failure) throw new AggregateError([failure, cleanupError], 'NE invocation and teardown failed');
      throw cleanupError;
    }
  }
}

module.exports = { invokeNeEntry };
