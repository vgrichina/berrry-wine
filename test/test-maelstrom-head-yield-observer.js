'use strict';
const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const o = require('../tools/maelstrom-head-yield-observer.cjs');
const config = { watchAddr: 0, start: 36163, size: 1000, limit: 1,
  traceAddrs: [0x7a3362], breaks: [], countAddrs: [0x7a3362, 0x7a3366] };
const input = fs.readFileSync(process.argv[2], 'utf8'), exportsSource = fs.readFileSync(process.argv[3], 'utf8');
assert.equal(o.transform(input), input);
assert.equal(o.transform(input, { enabled: false }), input);
const output = o.transform(input, { enabled: true, exportsSource });
new vm.Script(output);
new vm.Script(fs.readFileSync(require('path').join(__dirname, 'maelstrom-head-yield-native.cjs'), 'utf8'));
for (const anchor of Object.values(o.anchors)) {
  assert.throws(() => o.transform(input.replace(anchor, ''), { enabled: true, exportsSource }), /anchor/);
  assert.throws(() => o.transform(input + '\n' + anchor, { enabled: true, exportsSource }), /anchor/);
}
assert.throws(() => o.transform(input + '\n', { enabled: true, exportsSource }), /runner pin/);
for (const ex of [undefined, exportsSource + '\n']) assert.throws(() => o.transform(input, { enabled: true, exportsSource: ex }), /exports pin/);
o.validateConfig(config);
assert.throws(() => o.validateConfig({ ...config, watchAddr: 1 }), /watchpoint/);
assert.throws(() => o.validateConfig({ ...config, size: 999 }), /profile/);
// Execute the actual early injected validation followed by a memory/run sentinel.
const validationStart = output.indexOf('  (' + o.validateConfig.toString());
const validationEnd = output.indexOf('traceAddrs: traceAtAddrs, breaks: breakAddrs, countAddrs });', validationStart);
assert(validationEnd > validationStart);
const validation = output.slice(validationStart, validationEnd + 'traceAddrs: traceAtAddrs, breaks: breakAddrs, countAddrs });'.length);
let touched = 0;
assert.throws(() => vm.runInNewContext(validation + '\ntouch();', {
  WATCH_SPEC: 'deferred-module:0', WATCH_BYTE: '', WATCH_WORD: '', TRACE_AT_START_BATCH: 36163, BATCH_SIZE: 1000, TRACE_AT_LIMIT: 1,
  traceAtAddrs: config.traceAddrs, breakAddrs: [], countAddrs: config.countAddrs, touch: () => touched++ }), /watchpoint/);
assert.equal(touched, 0);
const head = 0x7a3362, code = [0x8b, 0xe8, 0xff, 0xd7, 0x83, 0x38, 4];
let halt = 5, eip = head, bp = head, count = 0, reason = 1, ebp = 99, reads = 0;
const e = { set_bp: () => {}, get_bp_addr: () => bp, get_last_run_halt: () => halt,
  get_eip: () => eip, get_edi: () => 88, get_eax: () => 77, get_ebp: () => ebp, get_esp: () => 66,
  get_yield_reason: () => reason, get_yield_flag: () => 0, get_count: i => i ? 0 : count,
  get_cache_stores: () => 0, get_cache_clears: () => 0, get_cache_invals: () => 0,
  get_last_run_blocks: () => 0, guest_read8: addr => { reads++; return code[addr - head]; } };
const rows = [], observer = o.createObserver(s => rows.push(JSON.parse(s.slice(s.indexOf('{')))), config);
for (const name of Object.keys(e)) {
  const missing = { ...e }; delete missing[name];
  assert.throws(() => observer.validateExports(missing), /missing export/);
}
observer.validateExports(e); observer.arm(e, 36163, head);
for (const change of [() => halt = 4, () => eip = head + 4, () => bp = head + 4]) {
  halt = 5; eip = bp = head; const prior = reads; change();
  assert.throws(() => observer.headHalt(e), /halt\/EIP\/readback/); assert.equal(reads, prior);
}
halt = 5; eip = bp = head; code[0] = 0;
assert.throws(() => observer.headHalt(e), /instruction readback/); code[0] = 0x8b;
observer.headHalt(e);
observer.beforeBoundary(e, 36163, 1000); halt = 4; count = 972;
observer.afterBoundary(e, 36163, true);
assert.equal(rows.at(-1).observation, 'pending-yield-before-instructions');
assert.equal(rows.at(-1).movCallExecuted, false);
// Mutations of the oracle: counts and halt 5 do not prove an executed call.
observer.beforeBoundary(e, 36164, 1000); halt = 5;
observer.afterBoundary(e, 36164, true);
assert.equal(rows.at(-1).movCallExecuted, 'UNKNOWN');
observer.beforeBoundary(e, 36165, 1000); halt = 4; reason = 0; ebp = 77;
observer.afterBoundary(e, 36165, true);
assert.equal(rows.at(-1).movCallExecuted, 'UNKNOWN');
observer.beforeBoundary(e, 36166, 1000); observer.afterBoundary(e, 36166, false);
assert.equal(rows.at(-1).observation, 'runner-skipped');
for (let i = 0; i < 20; i++) {
  observer.beforeBoundary(e, 36167 + i, 1000); observer.afterBoundary(e, 36167 + i, false);
}
observer.finish(); observer.finish();
assert(rows.length <= 16); assert(Buffer.byteLength(rows.map(JSON.stringify).join('\n')) <= 8192);
assert.equal(output.split('instance.exports.run(BATCH_SIZE);').length, input.split('instance.exports.run(BATCH_SIZE);').length);
for (const forbidden of ['clear_counts(', 'set_yield_state(', 'guest_write', 'Date.now(', 'set_eip('])
  assert(!o.createObserver.toString().includes(forbidden));
console.log(JSON.stringify({ status: 'pass', qualification: 'cheap controls only', records: rows.length,
  controls: ['disabled identity', 'pins', 'missing/duplicate anchors', 'watch conflict before sentinel',
    'missing exports', 'halt/EIP/bp/code readback', 'counter/halt execution mutants', 'skip', 'bounded records', 'no extra run/writes'] }));
