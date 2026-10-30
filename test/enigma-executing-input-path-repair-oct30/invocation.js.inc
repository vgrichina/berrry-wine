  // Read-only invocation trace, installed before guest initializers.
  const executingTrace = { seq: 0, first: [], tail: [], counts: {}, pending: null, workerEntered: 0, workerReturned: 0 };
  const invocationState = () => {
    const e = instance.exports;
    return {batch: tickState.batch, tid: e.get_current_thread_id(), pc: e.get_eip() >>> 0,
      esp: e.get_esp() >>> 0, yieldFlag: e.get_yield_flag(), yieldReason: e.get_yield_reason(),
      waitHandle: e.get_wait_handle() >>> 0, polls: guestPollTrace.entries};
  };
  const rememberInvocation = row => {
    if (executingTrace.first.length < 48) executingTrace.first.push(row);
    executingTrace.tail.push(row); if (executingTrace.tail.length > 64) executingTrace.tail.shift();
  };
  const originalInvocationLog = h.log;
  h.log = (ptr, len) => {
    const name = Buffer.from(memory.buffer, ptr, Math.min(len, 256)).toString().split('\0')[0];
    if (apiByName.has(name)) {
      const state = invocationState(), e = instance.exports;
      const row = {phase: 'entry', id: ++executingTrace.seq, name, ...state,
        args: Array.from({length: 4}, (_, i) => e.guest_read32((state.esp + 4 + i * 4) >>> 0) >>> 0)};
      const key = state.tid + ':' + name; executingTrace.counts[key] = (executingTrace.counts[key] || 0) + 1;
      executingTrace.pending = row; rememberInvocation(row);
    }
    return originalInvocationLog(ptr, len);
  };
  const originalInvocationExit = h.log_api_exit;
  h.log_api_exit = (...args) => {
    const p = executingTrace.pending;
    if (p) {
      rememberInvocation({phase: 'post-handler', id: p.id, name: p.name, ...invocationState(), eax: instance.exports.get_eax() >>> 0,
        qualification: 'handler boundary; yield does not imply successful Win32 return'});
      executingTrace.pending = null;
    }
    return originalInvocationExit(...args);
  };
  const originalExecutingInput = h.check_input;
  h.check_input = () => {
    const result = originalExecutingInput();
    if ((result >>> 0) === 0x260100 && !executingTrace.afterUp) {
      executingTrace.afterUp = invocationState(); executingTrace.first = []; executingTrace.tail = []; executingTrace.counts = {};
    }
    return result;
  };
