'use strict';

// Node-only control plane. Importing this file never imports an emulator.
// A dedicated disposable owner process is mandatory: a wedged guest cannot
// service a JS timer, so the prearmed child kills that owner at the deadline.
const { fork } = require('child_process');
const { randomUUID, createHash } = require('crypto');
const { readFileSync } = require('fs');

const identity = pid => readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')[19];
const hash = frame => createHash('sha256').update(JSON.stringify([
  frame.width, frame.height, frame.text,
])).update(frame.rgba).digest('hex');

async function armWatchdog(deadline, strictDeadline = false) {
  if (!Number.isSafeInteger(deadline) || deadline <= Date.now() || deadline > Date.now() + 120000) {
    throw new Error('deadline must be absolute, future, and within 120 seconds');
  }
  const nonce = randomUUID();
  const child = fork(__filename, ['--watchdog', String(process.pid), identity(process.pid),
    String(deadline), nonce, ...(strictDeadline ? ['--strict-deadline'] : [])],
  { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], execArgv: [] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('watchdog arm timeout')); }, 2000);
    child.once('error', err => { clearTimeout(timer); reject(err); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('watchdog exited before arm')); });
    child.once('message', m => {
      clearTimeout(timer);
      if (m.nonce !== nonce || m.deadline !== deadline) { child.kill(); reject(new Error('bad watchdog receipt')); }
      else resolve();
    });
  });
  return {
    receipt: Object.freeze({ pid: child.pid, ownerPid: process.pid, deadline, nonce }),
    alive: () => child.connected && child.exitCode === null && child.signalCode === null,
    close: () => new Promise((resolve, reject) => {
      if (!child.connected) return reject(new Error('watchdog lost before release'));
      child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`watchdog exit ${code}/${signal}`)));
      child.send({ stop: nonce });
    }),
  };
}

async function createController(options) {
  // Copy scalar limits and callback before the first await; caller mutations
  // cannot renew the lease, move the action, or substitute a reviewer.
  const { deadline, at, review, dedicatedProcess, maxFrameAgeMs = 30000 } = options;
  if (dedicatedProcess !== true || typeof review !== 'function'
      || !Number.isSafeInteger(at) || at < 0 || !Number.isSafeInteger(maxFrameAgeMs)
      || maxFrameAgeMs < 1 || maxFrameAgeMs > 30000) throw new Error('invalid controlled input contract');
  const guard = await armWatchdog(deadline);
  const targetId = randomUUID();
  let used = false, held = false, target = null, closed = false;
  const check = () => {
    if (closed || Date.now() >= deadline || !guard.alive()) throw new Error('control lease expired or lost');
  };
  const release = () => {
    if (!held) return;
    // Keep held=true on failure: close must not disarm the independent killer.
    target.releaseKeys(); target.releaseMouse(); held = false;
  };
  return Object.freeze({
    at, targetId, watchdog: guard.receipt,
    check,
    release,
    async act(adapter) {
      check();
      if (used) throw new Error('control action already consumed');
      used = true; target = adapter;
      const frame = adapter.capture(), capturedAt = Date.now(), digest = hash(frame), frameId = randomUUID();
      const snapshot = Object.freeze({ targetId, frameId, digest, capturedAt, deadline,
        width: frame.width, height: frame.height, text: frame.text,
        rgba: Buffer.from(frame.rgba) });
      const command = await review(snapshot);
      check();
      if (!command || command.targetId !== targetId || command.frameId !== frameId
          || command.digest !== digest || Date.now() - capturedAt > maxFrameAgeMs
          || hash(adapter.capture()) !== digest || !adapter.ownsTarget()) {
        throw new Error('stale frame, wrong target, or missing review');
      }
      const a = { ...command.action };
      if (a.kind === 'key') {
        const named = /^(Enter|Escape|Backspace|Tab|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown|Insert|Delete|F[1-9]|F10)$/;
        if (typeof a.key !== 'string' || typeof a.code !== 'string'
            || !(named.test(a.key) && a.code === a.key
              || /^[\x20-\x7e]$/.test(a.key) && /^(Key[A-Z]|Digit[0-9]|Space)$/.test(a.code))) {
          throw new Error('invalid ordinary key');
        }
        check(); held = true; adapter.keyDown(a.key, a.code);
      } else if (a.kind === 'mouse') {
        if (![a.x, a.y].every(n => Number.isInteger(n) && n >= 0 && n <= 65535)
            || ![1, 2, 4].includes(a.buttons)) throw new Error('invalid ordinary mouse');
        check(); held = true; adapter.mouseInput(a.x, a.y, a.buttons);
      } else throw new Error('unsupported action');
      return Object.freeze({ targetId, frameId, digest, action: Object.freeze(a), delivered: true });
    },
    async close() {
      if (closed) return;
      release(); closed = true;
      await guard.close();
    },
  });
}

if (require.main === module && process.argv[2] === '--watchdog') {
  const [, , , pidText, birth, expiry, nonce] = process.argv;
  const pid = Number(pidText), deadline = Number(expiry);
  const killOwner = () => {
    try { if (identity(pid) === birth) process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
    process.exit(0);
  };
  // No renew command. Disconnect is fail closed; only a nonce-bound release
  // after balanced inputs can disarm this watchdog.
  const timer = setTimeout(killOwner, Math.max(0, deadline - Date.now()));
  process.on('disconnect', killOwner);
  process.on('message', m => {
    if (m.stop === nonce) {
      // Persistent owners cannot race an overdue timer with a late disarm.
      if (process.argv[7] === '--strict-deadline' && Date.now() >= deadline) return killOwner();
      clearTimeout(timer); process.exit(0);
    }
  });
  process.send({ nonce, deadline });
}

// Persistent mode is deliberately separate from the original one-action API.
// The adapter is trusted host code, never supplied by the reviewer. progress()
// counts completed public step calls (including interrupt service); it must
// advance after release before a consequence can be observed. An unchanged
// image is a valid observation, but a cached image/step is not.
async function createPersistentController(options) {
  const { deadline, at, review, observe, dedicatedProcess, maxActions,
    maxReviews = maxActions * 4, maxFrameAgeMs = 30000 } = options;
  if (dedicatedProcess !== true || typeof review !== 'function' || typeof observe !== 'function'
      || !Number.isSafeInteger(at) || at < 0 || !Number.isSafeInteger(maxActions)
      || maxActions < 1 || maxActions > 100 || !Number.isSafeInteger(maxReviews)
      || maxReviews < maxActions || maxReviews > 1000 || !Number.isSafeInteger(maxFrameAgeMs)
      || maxFrameAgeMs < 1 || maxFrameAgeMs > 30000) throw new Error('invalid persistent control contract');
  const guard = await armWatchdog(deadline, true);
  let phase = 'READY', target = null, held = false, closePromise, pending = 0;
  let programId, targetId, releaseProgress, downProgress, failure = null;
  const actions = [], tombstones = new Set();
  const fail = err => { failure ||= String(err.message || err); phase = 'UNKNOWN'; return err; };
  const check = () => {
    if (phase === 'CLOSED' || phase === 'UNKNOWN' || Date.now() >= deadline || !guard.alive()) {
      throw fail(new Error('terminal UNKNOWN: control lease expired, closed or lost'));
    }
  };
  const progress = () => {
    const n = target.progress();
    if (!Number.isSafeInteger(n) || n < 0) throw new Error('invalid execution progress');
    return n;
  };
  const capture = () => {
    const id = target.programIdentity();
    if (typeof id !== 'string' || !id) throw new Error('missing program identity');
    if (id !== programId) { programId = id; targetId = randomUUID(); }
    const frame = target.capture();
    if (!Number.isSafeInteger(frame.width) || frame.width < 1
        || !Number.isSafeInteger(frame.height) || frame.height < 1
        || !ArrayBuffer.isView(frame.rgba) || frame.rgba.byteLength !== frame.width * frame.height * 4) {
      throw new Error('invalid actual frame');
    }
    return Object.freeze({ targetId, programId, frameId: randomUUID(), digest: hash(frame),
      capturedAt: Date.now(), deadline, progress: progress(), width: frame.width,
      height: frame.height, text: frame.text, rgba: Buffer.from(frame.rgba) });
  };
  const matches = (s, c) => c && c.targetId === s.targetId && c.programId === s.programId
    && c.frameId === s.frameId && c.digest === s.digest;
  const release = () => {
    if (!held) return;
    // Both release paths are attempted even if one throws. Never clear held
    // or disarm on partial release, and never replay a failed release.
    let error;
    try { target.releaseKeys(); } catch (err) { error = err; }
    try { target.releaseMouse(); } catch (err) { error ||= err; }
    if (error) throw fail(error);
    held = false;
  };
  let releaseAttempted = false;
  const releaseOnce = () => {
    if (!held) return;
    if (releaseAttempted) throw fail(new Error('terminal UNKNOWN: release previously failed'));
    releaseAttempted = true;
    release();
  };
  const controller = {
    persistent: true, at, watchdog: guard.receipt, check,
    get ready() { return phase === 'READY'; },
    get awaitingExecution() { return phase === 'HELD' || phase === 'RELEASED'; },
    get done() { return ['STOPPED', 'COMPLETE', 'UNKNOWN', 'CLOSED'].includes(phase); },
    get result() { return Object.freeze({ status: phase, failure, deadline,
      actions: Object.freeze(actions.slice()), reviewsConsumed: tombstones.size, held }); },
    async act(adapter) {
      try {
        check();
        if (phase !== 'READY') throw new Error('review requires post-release consequence observation');
        if (target && target !== adapter) throw new Error('session adapter ownership changed');
        if (tombstones.size >= maxReviews) { phase = 'STOPPED'; return null; }
        target = adapter;
        if (!target.ownsTarget()) throw new Error('target ownership lost');
        phase = 'REVIEWING';
        const s = capture();
        // Tombstone before calling any external code, including throws/stalls.
        tombstones.add(s.frameId);
        let command;
        pending++;
        try { command = await review(s); } finally { pending--; }
        check();
        if (phase !== 'REVIEWING' || !matches(s, command)
            || Date.now() - s.capturedAt > maxFrameAgeMs || !target.ownsTarget()
            || target.programIdentity() !== s.programId || progress() !== s.progress
            || hash(target.capture()) !== s.digest) throw new Error('stale frame, program, target or missing review');
        if (command.stop === true && command.action === undefined) { phase = 'STOPPED'; return null; }
        // A fresh reviewed request to let one ordinary step run without input.
        // The runner must return with a newly captured review, never a queue of
        // commands or coordinates. maxReviews also bounds these no-input turns.
        if (command.wait === true && command.action === undefined && command.stop !== true) {
          phase = 'READY'; return null;
        }
        const a = { ...command.action };
        if (a.kind === 'key') {
          const named = /^(Enter|Escape|Backspace|Tab|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown|Insert|Delete|F[1-9]|F10)$/;
          if (typeof a.key !== 'string' || typeof a.code !== 'string'
              || !(named.test(a.key) && a.code === a.key
                || /^[\x20-\x7e]$/.test(a.key) && /^(Key[A-Z]|Digit[0-9]|Space)$/.test(a.code))) {
            throw new Error('invalid ordinary key');
          }
        } else if (a.kind === 'mouse') {
          if (![a.x, a.y].every(n => Number.isInteger(n) && n >= 0 && n <= 65535)
              || ![1, 2, 4].includes(a.buttons)) throw new Error('invalid ordinary mouse');
        } else throw new Error('unsupported action');
        check();
        downProgress = progress(); releaseAttempted = false; held = true; phase = 'HELD';
        // Release ownership is armed before the hardware call can partially fail.
        if (a.kind === 'key') target.keyDown(a.key, a.code);
        else target.mouseInput(a.x, a.y, a.buttons);
        const receipt = Object.freeze({ targetId: s.targetId, programId: s.programId,
          frameId: s.frameId, digest: s.digest, action: Object.freeze(a), delivered: true });
        actions.push(receipt);
        return receipt;
      } catch (err) { throw fail(err); }
    },
    async afterStep(adapter) {
      try {
        check();
        if (adapter !== target || !['HELD', 'RELEASED'].includes(phase)) {
          throw new Error('unexpected execution handback');
        }
        const n = progress();
        if (phase === 'HELD') {
          if (n <= downProgress) throw new Error('no execution after input');
          releaseOnce(); releaseProgress = n; phase = 'RELEASED';
          return;
        }
        if (n <= releaseProgress) throw new Error('no post-release execution');
        phase = 'OBSERVING';
        const s = capture();
        let ack;
        pending++;
        try { ack = await observe(s, actions.at(-1)); } finally { pending--; }
        check();
        if (phase !== 'OBSERVING' || !matches(s, ack)
            || Date.now() - s.capturedAt > maxFrameAgeMs
            || !target.ownsTarget() || target.programIdentity() !== s.programId || progress() !== s.progress
            || hash(target.capture()) !== s.digest) throw new Error('unobserved or stale consequence');
        phase = actions.length === maxActions ? 'COMPLETE' : 'READY';
      } catch (err) { throw fail(err); }
    },
    // finish is also used for budget/guest exit: pending consequences cannot
    // silently turn into successful sessions. close always releases in finally.
    finish() {
      if (!['READY', 'STOPPED', 'COMPLETE', 'UNKNOWN', 'CLOSED'].includes(phase)) {
        fail(new Error('terminal UNKNOWN: session ended before consequence observation'));
      } else if (phase === 'READY') phase = 'STOPPED';
    },
    close() {
      if (closePromise) return closePromise;
      closePromise = (async () => {
        controller.finish();
        releaseOnce();
        if (pending) throw fail(new Error('terminal UNKNOWN: pending review/observation; watchdog retained'));
        await guard.close();
        // Keep the terminal result available after cleanup.
      })();
      return closePromise;
    },
  };
  return Object.freeze(controller);
}

module.exports = { createController, createPersistentController };
