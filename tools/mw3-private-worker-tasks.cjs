'use strict';
// Private CDP fixture bookkeeping. Background protocol failures must reach the
// awaiting owner, so its finally block can close and wait for Chrome.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

function createWorkerTasks({send, include}) {
  assert.equal(typeof send, 'function');
  assert.equal(typeof include, 'function', 'explicit fixture ownership required');
  const workers = new Map(), pending = new Set();
  let firstFailure = null, wake;
  const failed = new Promise(resolve => { wake = resolve; });
  function check() { if (firstFailure) throw firstFailure; }
  function track(task) {
    check();
    // Install rejection handling before invoking even a synchronously throwing
    // transport. Tracked promises always settle; failure remains sticky.
    const promise = Promise.resolve().then(() => { check(); return task(); })
      .catch(error => { if (!firstFailure) { firstFailure = error; wake(error); } })
      .finally(() => pending.delete(promise));
    pending.add(promise);
  }
  function handle(event) {
    check();
    if (event.method === 'Target.attachedToTarget') {
      const {sessionId, targetInfo} = event.params;
      if (targetInfo.type !== 'worker' || !include(targetInfo)) return;
      assert(!workers.has(sessionId), 'duplicate private Worker session');
      const worker = {sessionId, targetId:targetInfo.targetId,
        url:targetInfo.url, scripts:[], closed:false};
      workers.set(sessionId, worker);
      track(() => send('Debugger.enable', {}, sessionId));
    } else if (event.method === 'Target.detachedFromTarget') {
      const worker = workers.get(event.params.sessionId);
      if (worker) worker.closed = true;
    } else if (event.method === 'Debugger.scriptParsed') {
      const worker = workers.get(event.sessionId), script = event.params;
      if (!worker || (script.scriptLanguage !== 'WebAssembly' &&
          !script.url?.startsWith('wasm://'))) return;
      track(async () => {
        const result = await send('Debugger.getScriptSource',
          {scriptId:script.scriptId}, event.sessionId);
        assert(typeof result.bytecode === 'string' && result.bytecode.length,
          'actual private Worker module bytes required');
        worker.scripts.push({scriptId:script.scriptId,
          sha256:crypto.createHash('sha256').update(Buffer.from(result.bytecode, 'base64')).digest('hex')});
      });
    }
  }
  async function drain() {
    while (pending.size) await Promise.all([...pending]);
    check();
  }
  async function run(body) {
    check();
    return Promise.race([
      Promise.resolve().then(() => { check(); return body(); }),
      failed.then(error => { throw error; }),
    ]);
  }
  // WebSocket event listeners must not throw out of the owner's async scope.
  function observe(event) {
    if (firstFailure) return;
    try { handle(event); }
    catch (error) { if (!firstFailure) { firstFailure = error; wake(error); } }
  }
  return {workers, handle, observe, drain, run, check};
}
module.exports = {createWorkerTasks};
