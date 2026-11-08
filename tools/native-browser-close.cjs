'use strict';

// A CDP reply is not a process exit. Keep one close request and one terminal
// observer across all phases, including the wait after SIGKILL. The caller may
// remove the profile / ACK quit only after this returns a drained receipt.
async function closeBrowser({browser, requestClose, record = () => {},
  graceMs = 20000, termMs = 5000, killMs = 5000}) {
  for (const ms of [graceMs, termMs, killMs]) {
    if (!Number.isFinite(ms) || ms <= 0) throw Error('invalid browser close budget');
  }
  const began = Date.now(), cap = graceMs + termMs + killMs;
  let terminal = null, drained = false, wake, closeRequest = 'not-requested';
  const signals = [];
  const changed = () => { if (wake) wake(); };
  const emit = row => record({at: new Date().toISOString(), ...row});
  const onExit = (code, signal) => {
    terminal = {code, signal}; emit({kind: 'exit', ...terminal}); changed();
  };
  const onClose = (code, signal) => {
    if (!terminal) onExit(code, signal);
    drained = true; emit({kind: 'drained', ...terminal}); changed();
  };
  browser.on('exit', onExit);
  browser.on('close', onClose);
  // ChildProcess emits close after exit and stdio closure. A preexisting exit
  // alone cannot establish that inherited pipe writers have drained.
  if (browser.exitCode !== null || browser.signalCode !== null) {
    terminal = {code: browser.exitCode, signal: browser.signalCode};
    if (browser.stdio.every(s => !s || s.destroyed)) drained = true;
  }
  const until = async due => {
    while (!drained && Date.now() < due) {
      await new Promise(resolve => {
        const done = () => { clearTimeout(timer); wake = null; resolve(); };
        const timer = setTimeout(done, Math.max(1, due - Date.now()));
        wake = done;
      });
    }
  };
  try {
    if (!terminal) {
      // Do not await the reply: a disconnected endpoint can leave the CDP
      // promise pending forever. It consumes the same grace budget as exit.
      closeRequest = 'pending';
      Promise.resolve().then(requestClose).then(
        () => { closeRequest = 'ACK'; emit({kind: 'close-ack'}); },
        error => { closeRequest = 'UNKNOWN'; emit({kind: 'close-unknown', error: String(error), noReplay: true}); });
    }
    await until(began + graceMs);
    if (!terminal) {
      const signal = {kind: 'signal', signal: 'SIGTERM', sent: browser.kill('SIGTERM')};
      signals.push(signal); emit(signal);
    }
    await until(began + graceMs + termMs);
    if (!terminal) {
      const signal = {kind: 'signal', signal: 'SIGKILL', sent: browser.kill('SIGKILL')};
      signals.push(signal); emit(signal);
    }
    await until(began + cap);
    const receipt = {terminal, drained, closeRequest, signals, elapsedMs: Date.now() - began, capMs: cap,
      normal: drained && signals.length === 0 && terminal?.code === 0 && terminal?.signal === null};
    emit({kind: 'result', ...receipt});
    if (!drained) {
      const error = Error('browser terminal/drain UNKNOWN at cleanup cap; no replay');
      error.receipt = receipt;
      throw error;
    }
    return receipt;
  } finally {
    browser.off('exit', onExit);
    browser.off('close', onClose);
  }
}

module.exports = {closeBrowser};
