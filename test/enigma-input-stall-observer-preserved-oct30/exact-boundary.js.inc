  const instance = await WebAssembly.instantiate(wasmModule, imports);
  const tickState = batchClock.state;
  let threadManager = null;
  const guestPollTrace = { enabled: hasFlag('trace-input-poll'), armed: false, entries: 0, emitted: 0 };
  const guestPollState = () => ({ batch: tickState.batch, pending: inputEvent,
    crossThreadDepth: crossThreadMsgs.length, buttonQueueDepth: inputQueue ? inputQueue.length : 0,
    rendererDepth: renderer && renderer.inputQueue ? renderer.inputQueue.length : 0,
    rendererHead: renderer && renderer.inputQueue ? renderer.inputQueue[0] || null : null,
    choice: inputEvent ? 'pending' : crossThreadMsgs.length ? 'cross-thread' : inputQueue && inputQueue.length ? 'button-queue' : renderer ? 'renderer' : 'none' });
  if (guestPollTrace.enabled) {
    const actualCheckInput = h.check_input;
    h.check_input = () => {
      guestPollTrace.entries++;
      const observe = guestPollTrace.armed && guestPollTrace.emitted < 128;
      if (observe) logs.push('[guest-poll] ' + JSON.stringify({ phase: 'entry', entry: guestPollTrace.entries, ...guestPollState() }));
      const result = actualCheckInput();
      if (observe) { guestPollTrace.emitted++; logs.push('[guest-poll] ' + JSON.stringify({ phase: 'return', entry: guestPollTrace.entries, result, event: lastInputEvent, ...guestPollState() })); }
      return result;
    };
  }

  const stallObserver = require('./enigma-stall-observer.js').createObserver({
    enabled: guestPollTrace.enabled,
    read: () => ({ instance, threadManager, tickState, guestPollTrace,
      poll: guestPollState() }),
  });

  const handleControlCommand = (cmdIn) => {
    const cmd = typeof cmdIn === 'string' ? { cmd: cmdIn } : (cmdIn || {});
    if (cmd.action === 'input-stall') return stallObserver.sample();
    throw new Error('test action');
  };
const dispatch = () => {      if (!mainExecutionSuspended()) (stallObserver.before(), instance.exports.run(BATCH_SIZE), stallObserver.after());};
