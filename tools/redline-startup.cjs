'use strict';
// The real caller uses a neutral document, then this one-shot admission.
// Page navigation with app=redline_demo is deliberately no longer a launch API.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {SELECTED} = require('../lib/redline-startup-admission.js');
const sha = b => createHash('sha256').update(b).digest('hex');
const WORKER_READ = `(() => {
  if (typeof endpointIdentity==='undefined' || typeof workerSlot==='undefined' ||
      typeof instance==='undefined' || !instance) return null;
  if (!globalThis.__redlineStartupInstance) Object.defineProperty(globalThis,
    '__redlineStartupInstance', {value:{instance, token:crypto.randomUUID()}});
  const s=globalThis.__redlineStartupInstance;
  if(s.instance!==instance) throw Error('Redline startup instance replaced');
  return {endpoint:endpointIdentity,slot:workerSlot,instance:s.token};
})()`;

async function launch({evaluate, send, workers, pageSession, source, selected, deadline,
  wait = ms => new Promise(r => setTimeout(r, ms)), now = Date.now, save = () => {}}) {
  let armed = false;
  const cap = Math.min(deadline, now() + 18500); // leave time inside the CDP 20s ceiling
  try {
    assert.equal(selected?.sha256, SELECTED.sha256, 'current selected CPU required; historical proofs do not admit it');
    assert.equal(selected?.bytes, SELECTED.bytes, 'current selected CPU length required');
    assert(cap > now(), 'startup deadline');
    await evaluate(`(() => { if(typeof runningApps==='undefined' || runningApps.length!==0)
      throw Error('Redline startup requires a neutral document');
      if(typeof WineAssembly==='undefined'||typeof shell==='undefined') throw Error('launcher not ready');
      ${source}
      RedlineStartupAdmission.install({WineAssembly,deadline:${cap}});
      return WINE_REDLINE_STARTUP.status(); })()`);
    armed = true;
    // Authenticate the private host compile before invoking the original caller.
    await evaluate(`WineAssembly.getWasmModule().then(() => WINE_REDLINE_STARTUP.status())`);
    await evaluate(`(() => {
      if(WINE_REDLINE_STARTUP.status().phase!=='compiled') throw Error('compile admission absent');
      globalThis.__redlineLaunch = {settled:false,error:null};
      Promise.resolve(shell.launchApp('redline_demo')).then(
        () => {__redlineLaunch.settled=true},
        e => {__redlineLaunch.error=String(e);__redlineLaunch.settled=true});
      return true;
    })()`);
    let status;
    while (now() < cap) {
      status = await evaluate('WINE_REDLINE_STARTUP.status()');
      if (status.phase === 'parked') break;
      assert(!status.failure, status.failure);
      assert(!await evaluate('__redlineLaunch.settled'), 'launch settled without barrier');
      await wait(20);
    }
    assert.equal(status?.phase, 'parked', 'preCPU/preDLLmain barrier not reached');
    const matches = [];
    for (const w of workers.values()) {
      if (w.closed || !w.url.includes('guest-worker')) continue;
      const live = await evaluate(WORKER_READ, w.sessionId);
      if (live?.endpoint === status.endpoint && live.slot === 0) matches.push({w, live});
    }
    assert.equal(matches.length, 1, 'unique live compile owner required');
    const {w, live} = matches[0];
    const scripts = [...new Map(w.scripts.map(s => [s.scriptId, s])).values()];
    assert.equal(scripts.length, 1, 'unique actual Worker module required');
    const r = await send('Debugger.getScriptSource', {scriptId: scripts[0].scriptId}, w.sessionId);
    assert(r.bytecode, 'live bytecode required');
    const bytes = Buffer.from(r.bytecode, 'base64');
    assert.equal(sha(bytes), SELECTED.sha256, 'live selected module SHA-256');
    assert.equal(bytes.length, SELECTED.bytes, 'live selected module length');
    assert.deepEqual(await evaluate(WORKER_READ, w.sessionId), live, 'Worker changed during authentication');
    assert(!w.closed && now() < cap, 'owner detached or deadline expired');
    assert.deepEqual(await evaluate('WINE_REDLINE_STARTUP.status()'), status, 'parked owner changed');
    const proof = {...status, sha256: sha(bytes), bytes: bytes.length,
      workerTarget: w.targetId, workerInstance: live.instance};
    const receipt = await evaluate(`WINE_REDLINE_STARTUP.release(${JSON.stringify(proof)})`);
    save('startup-admission.json', {receipt, nativeQualified:false, originalNavigation:false});
    return receipt;
  } catch (error) {
    if (armed) {
      try {
        // Await the host's parked init rejection AND its owned retirement before
        // the outer controller closes the browser. Never launch/release again.
        const refusal = await evaluate(`(async () => {
          WINE_REDLINE_STARTUP.abort('caller refusal');
          while(globalThis.__redlineLaunch && !__redlineLaunch.settled)
            await new Promise(r=>setTimeout(r,10));
          return WINE_REDLINE_STARTUP.status();
        })()`);
        error.startupRefusal = refusal;
      } catch (cleanupError) { error.cleanupError = cleanupError; }
    }
    save('startup-refusal.json', {error:String(error),refusal:error.startupRefusal ?? null,
      cleanupError:error.cleanupError ? String(error.cleanupError) : null, noReplay:true});
    throw error;
  }
}
module.exports = {launch, WORKER_READ};
