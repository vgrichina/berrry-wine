'use strict';
// Deterministic derivative of the qualified archived loader, never an in-place edit.
const crypto = require('node:crypto');
const INPUT_SHA256 = '8dde0a569d1c8a10b4c12119ac5fde37e4aeb45629290fd1feb24fb6291a6145';
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
function replaceOne(source, before, after) {
  const i = source.indexOf(before);
  if (i < 0 || source.indexOf(before, i + before.length) >= 0) throw Error('loader boundary anchor mismatch');
  return source.slice(0, i) + after + source.slice(i + before.length);
}
const STAGE_API = `
// A stage owns one startup transaction. No callback gate is held across host
// setup/awaits. The original generator retains mapping locals and rollback.
function stageDlls(exports, memory, exeBytes, dlls, log, options = {}) {
  const steps = loadDllsStagesOwned(exports, memory, exeBytes, dlls, log, options, true);
  const gate = requireDllCallbackGate(exports);
  let mapped;
  try { mapped = steps.next(); } finally { gate.release(); }
  if (mapped.done) throw new Error('missing DLL initializer boundary');
  let state = 'mapped';
  return Object.freeze({
    results: mapped.value,
    initialize() {
      if (state !== 'mapped') throw new Error('DLL stage already consumed');
      const gate = requireDllCallbackGate(exports);
      state = 'initializing';
      try {
        const done = steps.next();
        if (!done.done) throw new Error('duplicate DLL initializer boundary');
        state = 'complete';
        return done.value;
      } catch (error) { state = 'failed'; throw error; }
      finally { gate.release(); }
    },
    abort(error = new Error('DLL startup cancelled before initialization')) {
      if (state !== 'mapped') return;
      const gate = requireDllCallbackGate(exports);
      state = 'aborted';
      try { steps.throw(error); }
      catch (rejected) { if (rejected !== error) throw rejected; }
      finally { gate.release(); }
    },
  });
}

// Preserve the ordinary synchronous API for other callers of this derivative.
function loadDllsOwned(exports, memory, exeBytes, dlls, log, options = {}) {
  const steps = loadDllsStagesOwned(exports, memory, exeBytes, dlls, log, options);
  const mapped = steps.next();
  if (mapped.done) throw new Error('missing DLL initializer boundary');
  const done = steps.next();
  if (!done.done) throw new Error('duplicate DLL initializer boundary');
  return done.value;
}
`;
function transformLoader(input) {
  if (!Buffer.isBuffer(input) || sha256(input) !== INPUT_SHA256) throw Error('archived loader SHA-256 mismatch');
  let source = input.toString('utf8');
  source = replaceOne(source,
    'function loadDllsOwned(exports, memory, exeBytes, dlls, log, options = {}) {\n  const results = [];',
    'function* loadDllsStagesOwned(exports, memory, exeBytes, dlls, log, options = {}, staged = false) {\n  let initializersStarted = false;\n  const results = [];');
  source = replaceOne(source, '  for (const r of orderDllInitializers(dlls, results)) {',
    '  yield results; // Mapping/imports/resources complete; no guest has run.\n  initializersStarted = true;\n  for (const r of orderDllInitializers(dlls, results)) {');
  source = replaceOne(source, '        if ((exports.get_yield_reason() >>> 0) !== 2) drainDllUnload({',
    '        // Before arming, roll back metadata only. Guest detach/drain is\n' +
    '        // deferred to process teardown; setup failure must execute no guest.\n' +
    '        if ((!staged || initializersStarted) && (exports.get_yield_reason() >>> 0) !== 2) drainDllUnload({');
  source = replaceOne(source, '  module.exports = { beginScopedDllMain,', '  module.exports = { stageDlls, beginScopedDllMain,');
  source += STAGE_API;
  const output = Buffer.from(source);
  return {output, receipt: {schema:'maelstrom-loader-boundary/v1', inputSHA256:INPUT_SHA256,
    outputSHA256:sha256(output), inputBytes:input.length, outputBytes:output.length,
    qualification:'archived loader-derived mapping and initialization; native execution not tested'}};
}
module.exports = {transformLoader, INPUT_SHA256};
