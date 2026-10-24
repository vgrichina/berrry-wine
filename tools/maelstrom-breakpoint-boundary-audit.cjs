#!/usr/bin/env node
'use strict';
// Offline transformer. Never loads/instantiates a guest or runs the runner.
const fs = require('fs');
const crypto = require('crypto');
const RUNNER_SHA256 = '4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809';
const EXPORTS_SHA256 = '739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86';
const REVISION = 'd8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e';
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const anchors = Object.freeze({
  init: '  for (let batch = 0; batch < MAX_BATCHES && !stopped; batch++) {',
  arm: '    if (traceAtAddr && !breakAddrs.length && batch === TRACE_AT_START_BATCH && instance.exports.set_bp) {',
  set: '      instance.exports.set_bp(traceAtAddr);\n      // Cooperative threads own separate WASM instances.',
  run: '      if (!mainExecutionSuspended()) instance.exports.run(BATCH_SIZE);',
  end: '  traceGateBatch = -1; // back outside the loop: the exit summary is never windowed',
});
function validateAnchors(source) {
  for (const [name, text] of Object.entries(anchors)) {
    if (source.split(text).length !== 2) throw new Error(`audit injection anchor missing/ambiguous: ${name}`);
  }
}

// Serialized into the actual runner, with no added require or argv parsing.
function createAudit(emit, config) {
  const target = 0x7a3366;
  let armed = false, hit = false, finished = false, bytes = 0, records = 0;
  let runs = 0, last = null, first = true;
  const fail = message => { throw new Error(`MAELSTROM_BOUNDARY_AUDIT: ${message}`); };
  function write(row) {
    const line = '[MAELSTROM-BOUNDARY] ' + JSON.stringify(row);
    bytes += Buffer.byteLength(line) + 1;
    if (++records > 4 || bytes > 8192) fail('bounded output exceeded');
    emit(line);
  }
  function guard(e) {
    // Pinned 13-exports.wat: test_arena_get(11) returns dbg_chain_guard.
    // get_dbg_tier_guard is a DIFFERENT guard and must not be substituted.
    return typeof e.test_arena_get === 'function'
      ? { available: true, export: 'test_arena_get', argument: 11, value: e.test_arena_get(11) | 0 }
      : { available: false, export: 'test_arena_get', argument: 11, value: null };
  }
  function counter(e) {
    const slot = config.countAddrs.indexOf(0x7a3362);
    return slot >= 0 && typeof e.get_count === 'function'
      ? { available: true, slot, address: 0x7a3362, value: e.get_count(slot) >>> 0 }
      : { available: false, slot: slot < 0 ? null : slot, address: 0x7a3362, value: null };
  }
  function beforeArm(batch, e, size, addr, breaks) {
    if (batch !== 36163) return;
    if (armed) fail('duplicate arming');
    if (addr !== target || breaks.length || config.traceAddrs.length !== 1 ||
        config.traceAddrs[0] !== target || config.start !== 36163 || config.limit !== 1 ||
        config.memory !== 'eax:4,esp+0x124:12' || size !== 1000) fail('configuration differs from historical recipe');
    for (const key of ['set_bp', 'get_bp_addr', 'get_eip', 'get_last_run_halt', 'get_eax', 'get_esp', 'guest_read8']) {
      if (typeof e[key] !== 'function') fail(`missing required export ${key}`);
    }
  }
  function afterArm(batch, e, size, addr) {
    // This hook follows the EXISTING set_bp invocation, not a synthetic call.
    const readback = e.get_bp_addr() >>> 0;
    write({ kind: 'arm', batch, invocation: { export: 'set_bp', argument: addr }, readback,
      debugGuard: guard(e), batchSize: size });
    if (batch !== 36163 || addr !== target || readback !== target) fail('incorrect breakpoint readback after set_bp');
    armed = true;
  }
  function afterRun(batch, e, size) {
    if (!armed) return;
    if (size !== 1000) fail('batch size changed');
    runs++;
    const raw = e.get_last_run_halt() | 0;
    last = { batch, eip: e.get_eip() >>> 0, haltRaw: raw,
      haltDecoded: raw === 5 ? 'eip-breakpoint' : 'unclassified',
      readback: e.get_bp_addr() >>> 0, debugGuard: guard(e), batchSize: size,
      selectReturnCounter: counter(e) };
    if (last.readback !== target) fail('incorrect breakpoint readback after run');
    if (first) { write({ kind: 'first-return', ...last }); first = false; }
    if (!hit && last.eip === target && raw === 5) {
      const eax = e.get_eax() >>> 0, esp = e.get_esp() >>> 0;
      const read = (address, length) => Array.from({ length }, (_, i) => e.guest_read8((address + i) >>> 0) & 255);
      const snapshot = { eax, esp, eaxBytes: read(eax, 4), stackAddress: (esp + 0x124) >>> 0,
        stackBytes: read((esp + 0x124) >>> 0, 12) };
      write({ kind: 'target', ...last, snapshot });
      hit = true;
    }
  }
  function finish() {
    if (finished) return;
    finished = true;
    write({ kind: 'summary', status: hit ? 'target-observed' : 'unresolved', armed, targetRecords: hit ? 1 : 0,
      mainRunsObserved: runs, lastReturn: last, causeOfHistoricalZeroRecords: 'UNKNOWN',
      qualification: 'diagnostic boundary only; no inferred native errno or networking fix' });
  }
  return { beforeArm, afterArm, afterRun, finish };
}

function transform(source, { enabled = false, exportsSource } = {}) {
  validateAnchors(source);
  if (sha(source) !== RUNNER_SHA256) throw new Error('audit runner source hash mismatch');
  if (!enabled) return source; // byte-for-byte default path, no audit reads/calls/output
  if (!exportsSource || sha(exportsSource) !== EXPORTS_SHA256) throw new Error('audit export semantics source hash mismatch');
  const init = `  const maelstromBoundaryAudit = (${createAudit.toString()})(\n` +
    `    line => process.stderr.write(line + '\\n'), { countAddrs, traceAddrs: traceAtAddrs,\n` +
    `      start: TRACE_AT_START_BATCH, limit: TRACE_AT_LIMIT, memory: getArg('trace-at-mem', '') });\n`;
  source = source.replace(anchors.init, init + anchors.init);
  source = source.replace(anchors.arm,
    '    maelstromBoundaryAudit.beforeArm(batch, instance.exports, BATCH_SIZE, traceAtAddr, breakAddrs);\n' + anchors.arm);
  source = source.replace(anchors.set,
    '      instance.exports.set_bp(traceAtAddr);\n' +
    '      maelstromBoundaryAudit.afterArm(batch, instance.exports, BATCH_SIZE, traceAtAddr);\n' +
    '      // Cooperative threads own separate WASM instances.');
  source = source.replace(anchors.run,
    '      if (!mainExecutionSuspended()) {\n' +
    '        instance.exports.run(BATCH_SIZE);\n' +
    '        maelstromBoundaryAudit.afterRun(batch, instance.exports, BATCH_SIZE);\n' +
    '      }');
  source = source.replace(anchors.end, '  maelstromBoundaryAudit.finish();\n' + anchors.end);
  return source;
}

if (require.main === module) {
  const [mode, input, exportsInput, output] = process.argv.slice(2);
  if (!['--enable', '--disabled'].includes(mode) || !input || !exportsInput || !output || process.argv.length !== 6) {
    console.error('usage: node tools/maelstrom-breakpoint-boundary-audit.cjs --enable|--disabled RUN_JS EXPORTS_WAT NEW_ADJACENT_RUN_JS');
    process.exitCode = 2;
  } else {
    const path = require('path');
    if (path.dirname(path.resolve(input)) !== path.dirname(path.resolve(output))) throw new Error('output must be adjacent to input to preserve runner relative paths');
    const result = transform(fs.readFileSync(input, 'utf8'), { enabled: mode === '--enable', exportsSource: fs.readFileSync(exportsInput, 'utf8') });
    fs.writeFileSync(output, result, { flag: 'wx' });
    console.log(JSON.stringify({ runnerSHA256: RUNNER_SHA256, runnerRevision: REVISION, exportsSHA256: EXPORTS_SHA256,
      outputSHA256: sha(result), outputBytes: Buffer.byteLength(result), enabled: mode === '--enable', executesGuest: false }));
  }
}
module.exports = { transform, validateAnchors, anchors, RUNNER_SHA256, EXPORTS_SHA256, REVISION };
