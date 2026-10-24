'use strict';
// Offline, explicitly selected transform of one historical runner. No guest launch.
const fs = require('fs'), crypto = require('crypto');
const RUNNER = '4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809';
const EXPORTS = '739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86';
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const anchors = {
  parse: "const countAddrs = COUNT_SPEC ? COUNT_SPEC.split(',').map(s => parseInt(s, 16)) : [];",
  watch: '  let watchActive = false;',
  init: '  for (let batch = 0; batch < MAX_BATCHES && !stopped; batch++) {',
  arm: '    if (traceAtAddr && !breakAddrs.length && batch === TRACE_AT_START_BATCH && instance.exports.set_bp) {',
  set: '      instance.exports.set_bp(traceAtAddr);\n      // Cooperative threads own separate WASM instances.',
  run: '      if (!mainExecutionSuspended()) instance.exports.run(BATCH_SIZE);\n      else if (instance.exports.get_yield_reason() === 16) renderParkStats.skippedBatches++;',
  end: '  traceGateBatch = -1; // back outside the loop: the exit summary is never windowed',
};
function validateConfig(c) {
  if (c.watchAddr) throw Error('head observer: watchpoint conflict');
  if (c.start !== 36163 || c.size !== 1000 || c.limit !== 1 ||
      c.traceAddrs.length !== 1 || c.traceAddrs[0] !== 0x7a3362 || c.breaks.length ||
      c.countAddrs.length !== 2 || c.countAddrs[0] !== 0x7a3362 || c.countAddrs[1] !== 0x7a3366)
    throw Error('head observer: explicit profile mismatch');
}
// Serialized into the runner. Getters only: never run, rearm, clear or write.
function createObserver(emit, config) {
  let armed = false, pairs = 0, bytes = 0, records = 0, finished = false, before = null;
  const head = 0x7a3362;
  const fail = s => { throw Error('head observer: ' + s); };
  const required = ['set_bp', 'get_bp_addr', 'get_last_run_halt', 'get_eip', 'get_edi',
    'get_eax', 'get_ebp', 'get_esp', 'get_yield_reason', 'get_yield_flag', 'get_count',
    'get_cache_stores', 'get_cache_clears', 'get_cache_invals', 'get_last_run_blocks', 'guest_read8'];
  function validateExports(e) {
    for (const name of required) if (typeof e[name] !== 'function') fail('missing export ' + name);
  }
  function write(row) {
    const line = '[MAELSTROM-HEAD] ' + JSON.stringify(row);
    const n = Buffer.byteLength(line) + 1;
    if (records + 1 > 16 || bytes + n > 8192) fail('output bound');
    records++; bytes += n; emit(line);
  }
  function state(e) {
    return { eip: e.get_eip() >>> 0, halt: e.get_last_run_halt(), bp: e.get_bp_addr() >>> 0,
      edi: e.get_edi() >>> 0, eax: e.get_eax() >>> 0, ebp: e.get_ebp() >>> 0, esp: e.get_esp() >>> 0,
      yieldReason: e.get_yield_reason(), yieldFlag: e.get_yield_flag(),
      headEntries: e.get_count(0) >>> 0, interiorEntries: e.get_count(1) >>> 0,
      cacheStores: e.get_cache_stores(), cacheClears: e.get_cache_clears(),
      cacheInvals: e.get_cache_invals(), blocks: e.get_last_run_blocks() };
  }
  function headHalt(e) {
    // Halt or counter alone NEVER proves either execution or an EIP breakpoint.
    if (e.get_last_run_halt() !== 5 || (e.get_eip() >>> 0) !== head ||
        (e.get_bp_addr() >>> 0) !== head) fail('head halt/EIP/readback mismatch');
    const expected = [0x8b, 0xe8, 0xff, 0xd7, 0x83, 0x38, 4];
    if (expected.some((v, i) => e.guest_read8(head + i) !== v)) fail('original instruction readback mismatch');
    return state(e);
  }
  function arm(e, batch, addr) {
    validateExports(e);
    if (batch !== config.start || addr !== head || e.get_bp_addr() !== head || armed) fail('arming mismatch');
    armed = true; write({ kind: 'arm', batch, state: state(e), execution: 'UNKNOWN' });
  }
  function beforeBoundary(e, batch, size) {
    if (!armed || pairs >= 6) return;
    if (size !== 1000 || e.get_bp_addr() !== head) fail('boundary profile mismatch');
    before = state(e); write({ kind: 'before-existing-boundary', batch, state: before });
  }
  function afterBoundary(e, batch, ran) {
    if (!armed || pairs >= 6) return;
    if (!before || e.get_bp_addr() !== head) fail('boundary pairing/readback mismatch');
    const after = state(e);
    const genuineHeadHalt = ran && after.halt === 5;
    if (genuineHeadHalt) headHalt(e);
    // Pinned run checks reason=1 before decode/execute, after entry counting.
    // Remain conservative for all other reasons and all non-head transitions.
    const pending = ran && before.eip === head && before.yieldReason === 1 &&
      after.halt === 4 && after.eip === head && after.yieldReason === 1 &&
      after.ebp === before.ebp && after.esp === before.esp && after.eax === before.eax &&
      after.edi === before.edi && after.cacheStores === before.cacheStores &&
      after.cacheClears === before.cacheClears && after.cacheInvals === before.cacheInvals;
    write({ kind: 'after-existing-boundary', batch, ran, state: after,
      observation: !ran ? 'runner-skipped' : genuineHeadHalt ? 'head-breakpoint-before-instructions' :
        pending ? 'pending-yield-before-instructions' : 'unclassified',
      movCallExecuted: pending ? false : 'UNKNOWN',
      headInstructionsAtBreakpointExecuted: genuineHeadHalt ? false : 'UNKNOWN',
      historicalZeroCause: 'UNKNOWN' });
    pairs++; before = null;
  }
  function finish() {
    if (finished) return; finished = true;
    write({ kind: 'summary', armed, pairs, historicalZeroCause: 'UNKNOWN',
      qualification: 'bounded observer; entry counts do not establish MOV/CALL execution' });
  }
  return { validateExports, arm, beforeBoundary, afterBoundary, headHalt, finish };
}
function transform(source, { enabled = false, exportsSource } = {}) {
  if (!enabled) return source;
  for (const [name, anchor] of Object.entries(anchors))
    if (source.split(anchor).length !== 2) throw Error('head observer anchor: ' + name);
  if (sha(source) !== RUNNER) throw Error('head observer runner pin');
  if (!exportsSource || sha(exportsSource) !== EXPORTS) throw Error('head observer exports pin');
  const config = `{ watchAddr, start: TRACE_AT_START_BATCH, size: BATCH_SIZE, limit: TRACE_AT_LIMIT,
    traceAddrs: traceAtAddrs, breaks: breakAddrs, countAddrs }`;
  // Reject raw watch configuration at argument parsing, before guest memory
  // exists; includes deferred and JS-only watches, regardless of resolved addr.
  const earlyConfig = config.replace('watchAddr,', 'watchAddr: WATCH_SPEC || WATCH_BYTE || WATCH_WORD,');
  source = source.replace(anchors.parse, anchors.parse + `\n  (${validateConfig.toString()})(${earlyConfig});\n`);
  source = source.replace(anchors.init, `  const maelstromHeadObserver = (${createObserver.toString()})(
    line => process.stderr.write(line + '\\n'), ${config});
  maelstromHeadObserver.validateExports(instance.exports);
` + anchors.init);
  source = source.replace(anchors.set, `      instance.exports.set_bp(traceAtAddr);
      maelstromHeadObserver.arm(instance.exports, batch, traceAtAddr);
      // Cooperative threads own separate WASM instances.`);
  source = source.replace(anchors.run, boundarySource());
  return source.replace(anchors.end, '  maelstromHeadObserver.finish();\n' + anchors.end);
}
function boundarySource() {
  return `      maelstromHeadObserver.beforeBoundary(instance.exports, batch, BATCH_SIZE);
      if (!mainExecutionSuspended()) {
        instance.exports.run(BATCH_SIZE);
        maelstromHeadObserver.afterBoundary(instance.exports, batch, true);
      } else {
        if (instance.exports.get_yield_reason() === 16) renderParkStats.skippedBatches++;
        maelstromHeadObserver.afterBoundary(instance.exports, batch, false);
      }`;
}
module.exports = { transform, createObserver, validateConfig, anchors, boundarySource, RUNNER, EXPORTS };
if (require.main === module) {
  const [mode, input, exportsPath, output] = process.argv.slice(2);
  if (!['--enable', '--disabled'].includes(mode) || !output || process.argv.length !== 6)
    throw Error('usage: --enable|--disabled RUN_JS EXPORTS_WAT NEW_ADJACENT_RUN_JS');
  fs.writeFileSync(output, transform(fs.readFileSync(input, 'utf8'), {
    enabled: mode === '--enable', exportsSource: fs.readFileSync(exportsPath, 'utf8') }), { flag: 'wx' });
}
