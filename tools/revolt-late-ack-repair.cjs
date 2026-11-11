'use strict';

// Keep the completed run immutable. This entry runs its exact controller with
// only the repeated immutable CDP module transfers removed from live sampling.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const selected = 'scratch/runs/20261110-revolt-tunnel-exit-checkpoint-0030';
const pins = Object.freeze({
  'browser.cjs': '84298c72de986032532f7feed1db7650159ff8b1fb2f3636c05ee1596340aadd',
  'bound-input.cjs': 'd5fd440a8816688718b716ffbe0cc6da269e492098cafc7688da06bf2fd70c14',
});
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function replace(source, before, after) {
  assert.equal(source.split(before).length, 2, 'unique repair anchor');
  return source.replace(before, after);
}
function checked(source, name) {
  assert.equal(sha(source), pins[name], 'unrecognized Re-Volt ' + name);
  return source;
}

// Stringified into the selected chain's lexical scope (assert, sha, send,
// workers). Script bytes are immutable within one actual debugger session.
// Never reuse a proof across a Worker record, session, target, or script set.
function proofCache() {
  const proofs = new WeakMap();
  const owners = new Map();
  function inventory(w) {
    assert(!w.closed && workers.get(w.sessionId) === w, 'module owner retired');
    if(owners.has(w.sessionId))assert.equal(owners.get(w.sessionId),w,'module session replaced');
    else owners.set(w.sessionId,w);
    assert(w.scripts.length && w.scripts.every(s => s.bytecodeAvailable && s.sha256 && !s.error &&
      Number.isSafeInteger(s.bytes) && s.bytes > 0),
      'complete recovered module inventory required');
    // Chrome can report a previously recovered script again. Each notification
    // must finish recovering before deduplication.
    // Script IDs are scoped to this exact live owner, never to the module hash.
    const scripts = new Map();
    for (const s of w.scripts) {
      const record = JSON.stringify([s.scriptId, s.sha256, s.bytes, s.url, s.cdpHash]);
      if (scripts.has(s.scriptId))
        assert.equal(record, scripts.get(s.scriptId), 'conflicting duplicate module script ID');
      else scripts.set(s.scriptId, record);
    }
    return JSON.stringify([w.sessionId, w.targetId, [...scripts.values()]]);
  }
  async function moduleHash(w, scripts) {
    const signature = inventory(w), previous = proofs.get(w);
    if (previous) {
      assert.equal(signature, previous.signature, 'module inventory changed');
      return previous.digest;
    }
    const source = await send('Debugger.getScriptSource', {scriptId:scripts[0].scriptId}, w.sessionId);
    assert(source.bytecode, 'live module bytecode required');
    const bytes = Buffer.from(source.bytecode, 'base64');
    const digest = sha(bytes);
    assert.equal(digest, scripts[0].sha256, 'live module bytes changed');
    assert.equal(bytes.length, scripts[0].bytes,
      'live module byte length changed');
    assert.equal(inventory(w), signature, 'module inventory changed during retrieval');
    proofs.set(w, {signature, digest});
    return digest;
  }
  function verify(w) {
    assert.equal(inventory(w), proofs.get(w)?.signature, 'module inventory changed during observation');
  }
  return {moduleHash, verify};
}

function boundSource(source) {
  checked(source, 'bound-input.cjs');
  source = replace(source, '  let latest = null, busy = false, closed = false, binding = null;',
    '  let latest = null, busy = false, closed = false, binding = null;\n' +
    '  const proof = (' + proofCache.toString() + ')();');
  source = replace(source,
    "    const source = await send('Debugger.getScriptSource', {scriptId:scripts[0].scriptId}, w.sessionId);\n    assert(source.bytecode, 'live module bytecode required');\n    const moduleSha256 = sha(Buffer.from(source.bytecode, 'base64'));",
    '    const moduleSha256 = await proof.moduleHash(w, scripts);');
  source = replace(source,
    "      const bytes=await send('Debugger.getScriptSource',{scriptId:modules[0].scriptId},r.sessionId);\n      assert(bytes.bytecode,'actual renderer module bytes required');\n      rendererModuleSha256=sha(Buffer.from(bytes.bytecode,'base64'));",
    '      rendererModuleSha256=await proof.moduleHash(r,modules);');
  // Also revalidate the live Worker instances after asynchronous observations.
  source = replace(source, "    assert(!w.closed, 'Worker detached during identity read');",
    `    proof.verify(w);
    assert.deepEqual(await evaluate(WORKER_READ,w.sessionId),live,'guest instance changed during observation');
    if(a.renderEndpoint!=='none') {
      const r=[...workers.values()].find(r=>r.targetId===rendererTarget&&!r.closed);
      assert(r,'renderer retired during observation');proof.verify(r);
      assert((await evaluate(RENDER_READ,r.sessionId)).some(e=>e.id===a.renderEndpoint&&e.epoch===rendererEpoch&&!e.failed&&!e.control?.error),'renderer changed during observation');
      proof.verify(r);
    }
    proof.verify(w);`);
  return source;
}
function compile(file, source) {
  const m = new Module(file, module); m.filename=file;
  m.paths=Module._nodeModulePaths(path.dirname(file)); m._compile(source,file);
  return m.exports;
}
function loadBound(file) {
  file=path.resolve(file);
  return compile(file,boundSource(fs.readFileSync(file,'utf8')));
}
function browserSource(source) {
  checked(source,'browser.cjs');
  return replace(source, "bound=require('./bound-input.cjs')",
    "bound=require('../../../tools/revolt-late-ack-repair.cjs').loadBound(require.resolve('./bound-input.cjs'))");
}
module.exports={selected,pins,boundSource,browserSource,loadBound};
if(require.main===module) {
  assert.equal(process.argv[2],'--run','usage: --run SELECTED/browser.cjs');
  const file=path.resolve(process.argv[3]);
  compile(file,browserSource(fs.readFileSync(file,'utf8')));
}
