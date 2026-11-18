'use strict';
// Run-scoped admission, shared by the outer watchdog and the actual browser
// driver. All observations and wire issues take the same non-stealable mutex.
// This orders sampled boundaries; it makes no guarantee about global writers.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createGate, connection} = require('./revolt-display-admission.cjs');
const FLOOR = 1500000000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function identity(pid = process.pid) {
  const fields = fs.readFileSync('/proc/' + pid + '/stat', 'utf8').split(') ').at(-1).split(' ');
  if (['Z', 'X'].includes(fields[0])) throw Error('owner retired');
  return {pid, token: fields[19]};
}
function initialize(directory, deadline) {
  if (!(deadline > Date.now())) throw Error('finite future deadline required');
  fs.mkdirSync(directory);
  const config = {generation: crypto.randomUUID(), owner: identity(), deadline, floor: FLOOR};
  fs.writeFileSync(path.join(directory, 'owner.json'), JSON.stringify(config), {flag: 'wx'});
  return config;
}
function boundary(directory, expected, {readFree = () => {
  const st = fs.statfsSync('/home');
  return Number(st.bavail) * Number(st.bsize);
}, lockMs = 1000, injected = false, parents = []} = {}) {
  const mutex = path.join(directory, 'mutex'), closed = path.join(directory, 'closed.json');
  let localFailure;
  const error = reason => Error('UNKNOWN ' + reason + '; permanently closed; no replay');
  async function locked(body) {
    const end = Date.now() + lockMs;
    for (;;) {
      try { fs.mkdirSync(mutex); break; }
      catch (e) {
        if (e.code !== 'EEXIST') { localFailure ??= error(e); throw localFailure; }
        // Never steal a lock or reopen a scope after an owner crash. Every
        // participant has a finite local wait; no request can pass this lock.
        if (Date.now() >= end) { localFailure ??= error('shared mutex unavailable'); throw localFailure; }
        await sleep(2);
      }
    }
    try { return body(); } finally { fs.rmdirSync(mutex); }
  }
  function closeInside(reason, observation = null) {
    if (!fs.existsSync(closed)) {
      const record = {at: Date.now(), reason: String(reason), observation,
        generation: expected.generation, laterOrdinaryRequestsAllowed: 0};
      // Publish complete JSON atomically, under the common observation lock.
      const tmp = path.join(directory, 'closure-' + process.pid + '.tmp');
      fs.writeFileSync(tmp, JSON.stringify(record)); fs.renameSync(tmp, closed);
    }
    localFailure ??= error(JSON.parse(fs.readFileSync(closed)).reason);
    return localFailure;
  }
  function checkInside(observe) {
    if (fs.existsSync(closed)) throw closeInside('already closed');
    if (localFailure) throw closeInside(localFailure.message);
    try {
      const current = JSON.parse(fs.readFileSync(path.join(directory, 'owner.json')));
      if (JSON.stringify(current) !== JSON.stringify(expected)) throw Error('stale scope owner');
      if (identity(expected.owner.pid).token !== expected.owner.token) throw Error('owner replaced');
      for (const parent of parents) {
        if (identity(parent.pid).token !== parent.token) throw Error('parent replaced');
      }
      if (Date.now() >= expected.deadline) throw Error('finite deadline');
      if (observe) {
        const free = readFree();
        if (!Number.isSafeInteger(free) || free < 0) throw Error('invalid statfs observation');
        if (free <= FLOOR) throw closeInside('LOW disk', {free, injected});
        return {at: Date.now(), free};
      }
    } catch (e) { throw closeInside(e.message); }
  }
  return {
    // send must synchronously issue the wire request, without awaiting anything
    // between this check and ws.send. Its returned promise is settled outside
    // the lock so an in-flight query cannot delay the disk watchdog.
    async issue(send) {
      const box = await locked(() => { checkInside(true); return {pending: send()}; });
      return box.pending;
    },
    observe: () => locked(() => checkInside(true)),
    check: () => locked(() => checkInside(false)),
    close: reason => locked(() => closeInside(reason)),
  };
}
function guardedConnection(url, scope, {onClose = () => {}, pollMs = 10, ...options} = {}) {
  let timer, stopped = false;
  const gate = createGate(record => {
    // Local errors synchronously close this actual child's gate. Publish to
    // other participants before any host signal/teardown is propagated.
    void scope.close(record.reason).catch(() => {});
    onClose(record);
  });
  const c = connection(url, gate, options), send = c.send.bind(c), stop = c.stop.bind(c);
  const probe = async () => {
    try { await scope.check(); } catch (e) { gate.seal(e.message); }
    if (!stopped && !gate.closed) timer = setTimeout(probe, pollMs);
  };
  void probe();
  c.send = (method, params, sessionId) => scope.issue(() => {
    gate.check(); return send(method, params, sessionId);
  }).catch(e => { gate.seal(e.message); throw e; });
  c.stop = () => { stopped = true; clearTimeout(timer); stop(); };
  c.seal = async reason => { await scope.close(reason); gate.seal(reason); };
  return c;
}
// Close the shared boundary before forwarding cancellation to a descendant.
// The caller still owns finite process cleanup and actual close/EOF waits.
function lifecycle(scope, emitter, forward = () => {}, events = ['SIGTERM','SIGINT','SIGHUP','disconnect','error']) {
  const listeners = events.map(event => {
    const fn = detail => { void scope.close(event + ' ' + (detail || '')).then(() => forward(event, detail)).catch(e => forward('closure-error', e)); };
    emitter.on(event, fn); return [event, fn];
  });
  return () => { for (const [event, fn] of listeners) emitter.removeListener(event, fn); };
}
module.exports = {FLOOR, identity, initialize, boundary, guardedConnection, lifecycle};
