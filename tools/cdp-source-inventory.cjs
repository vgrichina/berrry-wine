'use strict';
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
// V8's inspector fallback hashes UTF-16; GetSha256Hash can supply UTF-8.
// Neither convention is trusted until checked against actual returned source.
const inspectorHash = source => digest(Buffer.from(source, 'utf16le'));

// One instance per CDP connection. Only verified, known evaluator source can be
// reused. Module/production JS and every WASM script still require actual bytes.
function createInventory({send, terminal = () => false, now = () => performance.now(),
  maxEntries = 64, maxBytes = 262144, ttlMs = 60000} = {}) {
  assert.equal(typeof send, 'function');
  assert(Number.isInteger(maxEntries) && maxEntries > 0);
  assert(Number.isInteger(maxBytes) && maxBytes > 0);
  assert(Number.isFinite(ttlMs) && ttlMs > 0);
  const sessions = new Map();
  let closed = false;
  function live() { assert(!closed && !terminal(), 'UNKNOWN source inventory closed; never replay'); }
  function attach(sessionId, targetId) {
    live(); assert(typeof sessionId === 'string' && sessionId && typeof targetId === 'string' && targetId);
    sessions.set(sessionId, {sessionId, targetId, contexts: new Map(), known: new Map(), cache: new Map()});
  }
  function detach(sessionId) { sessions.delete(sessionId); }
  function contextCreated(sessionId, context) {
    const s = sessions.get(sessionId); if (!s) return;
    // New generation even if a peer recycles a numeric or unique ID.
    s.contexts.set(context.id, {uniqueId: typeof context.uniqueId === 'string' && context.uniqueId ? context.uniqueId : null});
    s.cache.clear(); s.known.clear();
  }
  function contextsCleared(sessionId, id) {
    const s = sessions.get(sessionId); if (!s) return;
    if (id === undefined) s.contexts.clear(); else s.contexts.delete(id);
    s.cache.clear(); s.known.clear();
  }
  function trim(kind) {
    const entries = [];
    for (const s of sessions.values()) for (const [key, value] of s[kind]) {
      if (now() - value.at >= ttlMs) s[kind].delete(key);
      else entries.push({map: s[kind], key, value});
    }
    entries.sort((a, b) => a.value.at - b.value.at);
    let bytes = entries.reduce((n, e) => n + e.value.bytes, 0), count = entries.length;
    for (const e of entries) {
      if (count <= maxEntries && bytes <= maxBytes) break;
      e.map.delete(e.key); bytes -= e.value.bytes; count--;
    }
  }
  function noteEvaluation(sessionId, source) {
    live(); const s = sessions.get(sessionId); if (!s) return;
    assert.equal(typeof source, 'string');
    const bytes = Buffer.byteLength(source, 'utf16le');
    if (bytes > maxBytes) return;
    const hash = digest(Buffer.from(source, 'utf8'));
    s.known.delete(hash); s.known.set(hash, {source, bytes, at: now(),
      sourceHash: hash, fallbackHash: inspectorHash(source)}); trim('known');
  }
  async function inspect(sessionId, p) {
    live(); const s = sessions.get(sessionId); assert(s, 'unknown source session');
    assert.equal(typeof p.scriptId, 'string');
    const context = s.contexts.get(p.executionContextId);
    trim('known'); trim('cache');
    const hashOK = typeof p.hash === 'string' && /^[a-f0-9]{64}$/i.test(p.hash);
    const hash = hashOK ? p.hash.toLowerCase() : null;
    const known = hash && [...s.known.values()].find(v => v.sourceHash === hash || v.fallbackHash === hash);
    const eligible = !!(Number.isInteger(p.executionContextId) && context?.uniqueId && known && p.scriptLanguage === 'JavaScript' &&
      p.url === '' && !p.isModule && !p.isLiveEdit && p.length === known.source.length &&
      p.startLine === 0 && p.startColumn === 0);
    const key = JSON.stringify([p.executionContextId, context?.uniqueId, hash]);
    const row = {sessionId, targetId: s.targetId, scriptId: p.scriptId,
      executionContextId: p.executionContextId ?? null, contextUniqueId: context?.uniqueId ?? null,
      url: p.url ?? null, scriptLanguage: p.scriptLanguage ?? null, contentHash: p.hash ?? null,
      length: p.length ?? null, isModule: p.isModule ?? null, isLiveEdit: p.isLiveEdit ?? null};
    const cached = eligible && s.cache.get(key);
    if (cached && cached.context === context && cached.source === known.source) {
      return {...row, ...cached.identity, sourceVerification: 'verified-controller-source-reuse',
        reusedFrom: {...cached.origin}, metadataHashValidated: true,
        metadataHashEncoding: cached.metadataHashEncoding,
        actualBytesFetched: false, moduleByteProof: false};
    }
    const response = await send('Debugger.getScriptSource', {scriptId: p.scriptId}, sessionId);
    live(); assert(sessions.get(sessionId) === s, 'UNKNOWN source target/session replaced');
    assert(s.contexts.get(p.executionContextId) === context, 'UNKNOWN source context replaced');
    assert(response && typeof response.scriptSource === 'string', 'missing actual script source');
    const bytecode = Object.hasOwn(response, 'bytecode');
    let bytes;
    if (bytecode) {
      assert.equal(typeof response.bytecode, 'string');
      bytes = Buffer.from(response.bytecode, 'base64');
      assert(bytes.length && bytes.toString('base64') === response.bytecode, 'malformed actual WASM bytecode');
    } else {
      assert(p.scriptLanguage !== 'WebAssembly', 'missing actual WASM bytecode');
      bytes = Buffer.from(response.scriptSource, 'utf8');
    }
    const identity = {sha256: digest(bytes), size: bytes.length, bytecodeAvailable: bytecode};
    const metadataHashEncoding = !bytecode && hashOK ? hash === identity.sha256 ? 'utf8' :
      inspectorHash(response.scriptSource) === hash ? 'utf16le' : null : null;
    const metadataHashValidated = metadataHashEncoding !== null;
    if (eligible && !bytecode && metadataHashValidated && response.scriptSource === known.source) {
      s.cache.set(key, {source: response.scriptSource, identity, context, metadataHashEncoding,
        origin: {sessionId, targetId: s.targetId, scriptId: p.scriptId,
          executionContextId: p.executionContextId, contextUniqueId: context.uniqueId},
        at: now(), bytes: Buffer.byteLength(response.scriptSource, 'utf16le')});
      trim('cache');
    }
    return {...row, ...identity, metadataHashValidated, metadataHashEncoding, actualBytesFetched: true,
      sourceVerification: 'actual-source-fetch', moduleByteProof: bytecode};
  }
  function close() { closed = true; sessions.clear(); }
  return {attach, detach, contextCreated, contextsCleared, noteEvaluation, inspect, close};
}
module.exports = {createInventory, inspectorHash, digest};
