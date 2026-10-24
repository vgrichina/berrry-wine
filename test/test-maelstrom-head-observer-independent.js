'use strict';
// Independent observer review: no native instantiation or guest execution.
const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const o = require('../tools/maelstrom-head-yield-observer.cjs');
const source = fs.readFileSync(process.argv[2], 'utf8');
const output = o.transform(source, { enabled: true, exportsSource: fs.readFileSync(process.argv[3], 'utf8') });
const head = 0x7a3362, code = [0x8b, 0xe8, 0xff, 0xd7, 0x83, 0x38, 4];
const config = { watchAddr: 0, start: 36163, size: 1000, limit: 1,
  traceAddrs: [head], breaks: [], countAddrs: [head, head + 4] };
let checks = 0;
for (const patch of [{ start: 0 }, { limit: 2 }, { traceAddrs: [head, head] },
  { breaks: [head] }, { countAddrs: [head + 4, head] }, { countAddrs: [head] }]) {
  assert.throws(() => o.validateConfig({ ...config, ...patch }), /profile/); checks++;
}
const begin = output.indexOf('  (' + o.validateConfig.toString());
const endText = 'traceAddrs: traceAtAddrs, breaks: breakAddrs, countAddrs });';
const early = output.slice(begin, output.indexOf(endText, begin) + endText.length);
for (const key of ['WATCH_SPEC', 'WATCH_BYTE', 'WATCH_WORD']) {
  let touched = false;
  assert.throws(() => vm.runInNewContext(early + '\ntouchMemory();', {
    WATCH_SPEC: '', WATCH_BYTE: '', WATCH_WORD: '', [key]: 'unresolved,filename:0',
    TRACE_AT_START_BATCH: 36163, TRACE_AT_LIMIT: 1, BATCH_SIZE: 1000,
    traceAtAddrs: [head], breakAddrs: [], countAddrs: [head, head + 4], touchMemory: () => touched = true,
  }), /watchpoint/);
  assert.equal(touched, false); checks++;
}
function fixture() {
  const s = { eip: head, halt: 5, bp: head, edi: 88, eax: 77, ebp: 99, esp: 66,
    yieldReason: 1, yieldFlag: 0, headEntries: 0, interiorEntries: 0,
    cacheStores: 0, cacheClears: 0, cacheInvals: 0, blocks: 0 };
  let mutations = 0, codeReads = 0;
  const e = { set_bp: () => { mutations++; throw Error('observation mutation'); },
    guest_read8: a => { codeReads++; return code[a - head]; },
    get_count: i => s[i ? 'interiorEntries' : 'headEntries'] };
  for (const [name, key] of Object.entries({ get_eip: 'eip', get_last_run_halt: 'halt', get_bp_addr: 'bp',
    get_edi: 'edi', get_eax: 'eax', get_ebp: 'ebp', get_esp: 'esp', get_yield_reason: 'yieldReason',
    get_yield_flag: 'yieldFlag', get_cache_stores: 'cacheStores', get_cache_clears: 'cacheClears',
    get_cache_invals: 'cacheInvals', get_last_run_blocks: 'blocks' })) e[name] = () => s[key];
  const rows = [], obs = o.createObserver(line => rows.push(JSON.parse(line.slice(line.indexOf('{')))), config);
  obs.arm(e, 36163, head);
  return { s, e, rows, obs, mutations: () => mutations, reads: () => codeReads };
}
// Every state component used by the pending-yield inference rejects a changed value.
for (const key of ['eip', 'halt', 'yieldReason', 'ebp', 'esp', 'eax', 'edi', 'cacheStores', 'cacheClears', 'cacheInvals']) {
  const f = fixture(); f.obs.beforeBoundary(f.e, 36163, 1000); f.s.halt = 4;
  f.s[key] = key === 'halt' ? 0 : f.s[key] + 1;
  f.obs.afterBoundary(f.e, 36163, true);
  assert.equal(f.rows.at(-1).observation, 'unclassified', key);
  assert.equal(f.rows.at(-1).movCallExecuted, 'UNKNOWN', key);
  assert.equal(f.mutations(), 0); checks++;
}
for (const key of ['eip', 'bp']) {
  const f = fixture(); f.obs.beforeBoundary(f.e, 36163, 1000); f.s[key]++;
  assert.throws(() => f.obs.afterBoundary(f.e, 36163, true), /mismatch/);
  assert.equal(f.reads(), 0); checks++;
}
// Execute the actual transformed run/skip boundary against mutation-trapping exports.
for (const suspended of [false, true]) {
  const f = fixture(); let runs = 0, suspensions = 0;
  f.s.yieldReason = suspended ? 16 : 1;
  const before = { ...f.s };
  f.e.run = size => { assert.equal(size, 1000); runs++; f.s.halt = 4; };
  const ctx = { instance: { exports: f.e }, maelstromHeadObserver: f.obs, batch: 36163, BATCH_SIZE: 1000,
    mainExecutionSuspended: () => { suspensions++; return suspended; }, renderParkStats: { skippedBatches: 0 } };
  vm.runInNewContext(o.boundarySource(), ctx);
  assert.equal(runs, suspended ? 0 : 1); assert.equal(suspensions, 1);
  assert.equal(ctx.renderParkStats.skippedBatches, suspended ? 1 : 0);
  assert.equal(f.rows.at(-1).observation, suspended ? 'runner-skipped' : 'pending-yield-before-instructions');
  assert.deepEqual(f.s, { ...before, halt: suspended ? 5 : 4 });
  assert.equal(f.mutations(), 0); checks++;
}
const f = fixture();
for (let i = 0; i < 40; i++) { f.obs.beforeBoundary(f.e, 36163 + i, 1000); f.obs.afterBoundary(f.e, 36163 + i, false); }
f.obs.finish(); f.obs.finish();
assert.equal(f.rows.length, 14); assert.equal(f.rows.at(-1).pairs, 6);
assert(Buffer.byteLength(f.rows.map(r => '[MAELSTROM-HEAD] ' + JSON.stringify(r) + '\n').join('')) <= 8192);
assert.equal(f.mutations(), 0); checks++;
assert.equal(output.split(o.boundarySource()).length, 2);
assert.equal(output.split('instance.exports.run(BATCH_SIZE);').length, source.split('instance.exports.run(BATCH_SIZE);').length);
console.log(JSON.stringify({ status: 'pass', checks, qualification: 'independent rejecting controls; no native or gameplay claim' }));
