'use strict';

const assert = require('node:assert/strict');

// One attempt per edge. Persist only after both acknowledgement outcomes: a
// synchronous evidence writer must not stand between the timer and native UP.
async function pulse({down, up, deadline, holdMs = 100, ackMs = 1200,
  save = () => {}, receipt = {}}) {
  const start = Date.now();
  assert(Number.isFinite(deadline) && deadline > start);
  assert(Number.isInteger(holdMs) && holdMs >= 0 && holdMs <= 2000);
  assert(Number.isInteger(ackMs) && ackMs > 0 && ackMs <= 5000);
  const releaseAt = Math.min(start + holdMs, deadline);
  Object.assign(receipt, {start, releaseAt, armedBeforeDown: true});
  const bounded = (op, phase) => new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true; clearTimeout(timer); resolve(value);
    };
    const timer = setTimeout(() => finish({phase, unknown: true, error: 'ACK deadline'}), ackMs);
    try {
      Promise.resolve(op()).then(() => finish({phase, ack: true, at: Date.now()}),
        e => finish({phase, unknown: true, error: String(e)}));
    } catch (e) { finish({phase, unknown: true, error: String(e)}); }
  });
  const released = new Promise(resolve => setTimeout(() => {
    receipt.upAttemptedAt = Date.now();
    bounded(up, 'up').then(v => { receipt.up = v; resolve(v); });
  }, Math.max(0, releaseAt - Date.now())));
  receipt.downAttemptedAt = Date.now();
  receipt.down = await bounded(down, 'down');
  await released;
  let persistenceError;
  try { await save(receipt); } catch (e) { persistenceError = e; }
  if (persistenceError || !receipt.down.ack || !receipt.up.ack)
    throw Object.assign(Error('UNKNOWN input; closed; no replay'), {receipt, cause: persistenceError});
  return receipt;
}

module.exports = {pulse};
