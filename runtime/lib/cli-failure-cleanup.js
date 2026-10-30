'use strict';

// Register only resources already initialized by the CLI. Unwind in reverse
// order, so trace summaries enter the buffer before that buffer is drained.
// Cleanup failures must neither replace the guest/loader error nor skip the
// remaining cleanup (especially a control pipe which keeps Node alive).
async function withCliFailureCleanup(run) {
  const cleanups = [];
  try {
    return await run(cleanup => cleanups.push(cleanup));
  } catch (error) {
    for (const cleanup of cleanups.reverse()) {
      try { await cleanup(); }
      catch (cleanupError) { console.error('[cli] failure cleanup failed:', cleanupError); }
    }
    throw error;
  }
}

module.exports = { withCliFailureCleanup };
