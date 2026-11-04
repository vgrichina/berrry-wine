'use strict';

// Offline admission and bounded raw-event storage. No launch, guest writes,
// tracing setters, pacing changes, or conversion of sampled counts into FPS.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { APPS } = require('../lib/apps');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const ORIGINAL_SHA = '85fb5184262490f0b5967c2b12ee27c77da058364e594b0fc86be7b5814e40ec';
const BOUNDARY = Object.freeze({
  callbackTable: 0x42a200, currentCallbacks: 0x42b230,
  idle: 0x40518f, nonzeroDt: 0x4051a9, gameIdle: 0x4040de,
  display: 0x40eef1, game2Pointer: 0x43d284, dtOffset: 0x30,
});

function inspectOriginal(bytes) {
  if (sha256(bytes) !== ORIGINAL_SHA) throw Error('original executable hash mismatch');
  // These VAs equal file offsets + ImageBase only in this pinned original's
  // text and initialized data sections. Never use this as a runtime g2w map.
  const at = (va, hex) => {
    const expected = Buffer.from(hex, 'hex');
    if (!bytes.subarray(va - 0x400000, va - 0x400000 + expected.length).equals(expected)) {
      throw Error('original boundary bytes mismatch at ' + va.toString(16));
    }
  };
  at(0x42a200, 'f1ee40008f514000fe854000c45140005a524000d6624000a452400064524000984b4200');
  at(0x424b98, '67616d6500');
  at(0x40518f, '558bece8e8740000e843e1ffffa184d24300837830007502eb19e830efffffe8245d0000e8f83b0000e887af0000e826b300005dc3');
  at(0x41049a, 'a130b24200ff10832534b2420000eb08a130b24200ff5004');
  at(0x4104ce, '558bec8b4508a330b242005dc3');
  return { sha256: ORIGINAL_SHA, bytes: bytes.length, ...BOUNDARY,
    status: 'static-candidate-only',
    distinction: 'idle entry includes zero-dt polls; nonzero-dt path calls Game_Idle once; physics may substep',
    runtimeOwnershipVerified: false };
}

// A future adapter must establish the live endpoint, generation and active
// callbacks at the event itself. This collector DOES NOT establish that proof.
// Tests supply synthetic events, which must never be published as observations.
function createCapture({ owner, generation, startMs, durationMs = 5000, capacity = 4096 }) {
  if (!owner || !Number.isInteger(generation) || generation < 0 ||
      !Number.isFinite(startMs) || startMs < 0 ||
      !Number.isFinite(durationMs) || durationMs < 5000 || durationMs > 10000 ||
      !Number.isInteger(capacity) || capacity < 2 || capacity > 65536) throw Error('invalid capture bounds');
  const rows = [];
  let failure = null, finished = false;
  function reject(reason) { failure = reason; throw Error(reason); }
  return {
    record(event) {
      if (failure) throw Error('capture stopped: ' + failure);
      if (finished) throw Error('capture finished');
      if (event.owner !== owner || event.threadId !== 0) reject('wrong owner');
      if (event.generation !== generation) reject('stale generation');
      if (event.eip !== BOUNDARY.nonzeroDt || event.currentCallbacks !== BOUNDARY.callbackTable || !Number.isFinite(event.dt) || !(event.dt > 0)) reject('wrong gameplay boundary');
      if (!Number.isFinite(event.atMs) || event.atMs < startMs ||
          (rows.length && event.atMs <= rows[rows.length - 1].atMs)) reject('nonmonotonic timestamp');
      if (event.atMs > startMs + durationMs) reject('capture deadline');
      if (rows.length === capacity) reject('capture capacity');
      rows.push({ atMs: event.atMs, eip: event.eip, threadId: event.threadId,
        generation, currentCallbacks: event.currentCallbacks, dt: event.dt });
    },
    finish(endMs) {
      if (failure) throw Error('capture stopped: ' + failure);
      if (finished) throw Error('capture finished');
      if (!Number.isFinite(endMs) || endMs < startMs + durationMs ||
          endMs > startMs + durationMs + 1000 ||
          (rows.length && endMs < rows[rows.length - 1].atMs)) reject('incomplete or late interval');
      finished = true;
      return { startMs, endMs, durationMs, rows: rows.map(row => ({ ...row })),
        status: rows.length > 1 ? 'raw-events-only' : 'insufficient-events',
        logicalFPS: null, runtimeProof: 'must be supplied by an authentic production adapter' };
    },
  };
}

function audit(root = path.resolve(__dirname, '..')) {
  const app = APPS.gltron;
  const media = app.files.map(file => {
    const relative = 'test/' + file.url;
    const bytes = fs.readFileSync(path.join(root, relative));
    const actual = sha256(bytes);
    if (actual !== file.sha256 || bytes.length !== file.size) throw Error('registered media mismatch: ' + relative);
    return { path: relative, bytes: bytes.length, sha256: actual };
  });
  const original = inspectOriginal(fs.readFileSync(path.join(root, 'test/' + app.exe)));
  const wasmPath = 'build/wine-assembly.wasm';
  const wasm = fs.readFileSync(path.join(root, wasmPath));
  const module = new WebAssembly.Module(wasm); // compile only; no instance or guest
  return {
    original, registration: { exe: app.exe, logicalFrame: app.perf?.logicalFrame || null }, media,
    module: { path: wasmPath, bytes: wasm.length, sha256: sha256(wasm), executed: false,
      logicalExports: WebAssembly.Module.exports(module).filter(e => /logical_frame|trace_eip|dbg_tier/.test(e.name)) },
    blocker: {
      code: 'NO_UNCHANGED_PRODUCTION_CALLBACK_TIMESTAMPS',
      detail: 'Static nonzero-dt boundary found, but no authenticated live callback timestamp adapter established. EIP tracing invokes log_eip only with trace_eip_flag, which sets both debug guards; logical-frame marker exports counts rather than callback wall timestamps.',
      logicalFPS: null, browserLaunches: 0, liveEndpoint: null,
      actualBackend: null, context: null, renderer: null,
    },
  };
}

module.exports = { BOUNDARY, ORIGINAL_SHA, sha256, inspectOriginal, createCapture, audit };
if (require.main === module) {
  if (process.argv.length !== 2) throw Error('usage: node tools/gltron-logical-fps.cjs (offline audit only)');
  process.stdout.write(JSON.stringify(audit(), null, 2) + '\n');
}
