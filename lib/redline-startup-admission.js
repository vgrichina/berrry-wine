'use strict';

// Explicit, one-shot host admission. No guest export, input or scheduler call.
// Loaded by the offline-qualified Redline caller on a page with no selected app.
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.defineProperty(root, 'RedlineStartupAdmission', {value: api});
})(globalThis, function() {
  const SELECTED = Object.freeze({
    sha256: 'a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295',
    bytes: 2185596,
  });
  function install({WineAssembly, scope = globalThis, deadline}) {
    const now = () => Date.now();
    const check = (v, message) => { if (!v) throw Error('Redline startup: ' + message); };
    check(!scope.WINE_REDLINE_STARTUP && !WineAssembly._wasmModulePromise, 'arm before compilation');
    check(!scope.WINE_QUAKE2_LOAD_OBSERVATION && !scope.WINE_DRAKAN_OBSERVER, 'conflicting module provider');
    check(Number.isFinite(deadline) && deadline > now() && deadline - now() <= 20000, 'deadline <= 20000ms');
    const nativeCompile = WebAssembly.compile.bind(WebAssembly);
    let record, owner, resolvePark, rejectPark, timer, compileStarted = false;
    let phase = 'armed', failure = null, cleanup = null;
    const alive = () => {
      check(!failure, failure); check(now() < deadline, 'deadline expired');
      check(!scope.WINE_QUAKE2_LOAD_OBSERVATION && !scope.WINE_DRAKAN_OBSERVER, 'module provider changed');
    };
    const reject = reason => {
      if (!failure) failure = String(reason);
      phase = 'refused';
      clearTimeout(timer);
      rejectPark?.(Error(failure));
    };
    function sameOwner() {
      check(owner, 'no parked owner');
      const w = owner.wine, g = w.guestWorker, l = g?.link;
      check(!w._stopped && w.instance === owner.instance && w.memory === owner.memory &&
        w._wasmModule === record.module && g === owner.worker && l === owner.link &&
        g.module === record.module && l.module === record.module && l.worker === owner.nativeWorker &&
        l.endpointIdentity === owner.endpoint && l.slot === 0 && !g._stopped && !l._stopping,
        'selected compile owner changed');
    }
    const api = Object.freeze({
      async compile(bytes) {
        try {
          alive(); check(!compileStarted, 'compile reused'); compileStarted = true;
          const buffer = ArrayBuffer.isView(bytes) ? bytes.buffer : bytes;
          check(buffer instanceof ArrayBuffer, 'unshared compile bytes required');
          // Snapshot the view, including its offset, before hashing or awaiting.
          const copy = new Uint8Array(ArrayBuffer.isView(bytes)
            ? new Uint8Array(buffer, bytes.byteOffset, bytes.byteLength) : buffer).slice();
          const digest = await scope.crypto.subtle.digest('SHA-256', copy);
          const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
          alive(); check(hash === SELECTED.sha256 && copy.byteLength === SELECTED.bytes, 'selected module mismatch');
          const module = await nativeCompile(copy);
          alive(); record = {module, sha256: hash, bytes: copy.byteLength}; phase = 'compiled';
          return module;
        } catch (e) { reject(e.message); throw e; }
      },
      async park(wine) {
        try {
          alive(); check(phase === 'compiled' && record && !owner, 'one compiled owner required');
          const worker = wine.guestWorker, link = worker?.link;
          check(link?.worker && link.endpointIdentity && scope.WINE_THREADS === true &&
            scope.crossOriginIsolated === true, 'isolated owning Worker required');
          owner = {wine, worker, link, nativeWorker: link.worker, endpoint: link.endpointIdentity,
            instance: wine.instance, memory: wine.memory, token: scope.crypto.randomUUID()};
          sameOwner(); phase = 'parked';
          // init cannot return to loadExe/loadDlls/run until this resolves.
          await new Promise((resolve, rejectPromise) => {
            resolvePark = resolve; rejectPark = rejectPromise;
            timer = setTimeout(() => reject('Redline startup: deadline expired'), deadline - now());
          });
          alive(); sameOwner(); check(phase === 'released', 'release required');
        } catch (e) { reject(e.message); throw e; }
      },
      status() {
        if (phase === 'parked' || phase === 'released') {
          try { alive(); sameOwner(); } catch (e) { reject(e.message); }
        }
        return {phase, failure, cleanup, selected: SELECTED, ...(owner ? {
          token: owner.token, endpoint: owner.endpoint, slot: 0,
        } : {})};
      },
      release(proof) {
        try {
          alive(); sameOwner(); check(phase === 'parked', 'one parked release required');
          check(proof.token === owner.token && proof.endpoint === owner.endpoint && proof.slot === 0 &&
            proof.sha256 === record.sha256 && proof.bytes === record.bytes &&
            typeof proof.workerTarget === 'string' && proof.workerTarget.length > 0 &&
            typeof proof.workerInstance === 'string' && proof.workerInstance.length > 0,
            'live Worker proof mismatch');
          phase = 'released'; clearTimeout(timer); resolvePark();
          return {phase, ...proof};
        } catch (e) { reject(e.message); throw e; }
      },
      abort(reason) { reject('Redline startup: ' + reason); },
      retired(result) {
        cleanup = result && !result.ok ? {joined:false,error:String(result.error)} : {joined:true};
      },
    });
    Object.defineProperty(scope, 'WINE_REDLINE_STARTUP', {value: api});
    return api;
  }
  return Object.freeze({install, SELECTED});
});
