#!/usr/bin/env node
'use strict';
// Execute byte-exact production declarations AND host callback installation.
// Only guest memory/register exports and unrelated option values are stubbed;
// no WAT, wasm, compiler, runner main(), game, or browser is invoked.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { formatCall, formatRet, formatOutParams } = require('../lib/api-format');
const sourcePath = process.env.API_EXIT_RUNNER || path.join(__dirname, 'run.js');
const source = fs.readFileSync(sourcePath, 'utf8');
function span(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a && source.indexOf(start, a + 1) < 0, `unique span ${start}`);
  const bytes = source.slice(a, b);
  return { start: a, end: b, bytes, sha256: hash(bytes) };
}
function hash(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
const spans = [
  span('  let lastApiName = null;', '  let inputEvent = null;'),
  span('  const apiNameCache = new Map();', '  // --- Override exit to also log ---'),
];
const wiring = spans.map(s => s.bytes).join('\n');
const apiTable = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/api_table.json')));
const known = apiTable.find(e => e.name === 'IDirectDrawSurface_GetAttachedSurface');
assert(known && !known.ret, 'causal entry really has no return metadata');
function host({ trace = true, filter = null, espDelta = false, quiet = false, entries = [] } = {}, runner = wiring) {
  const memory = { buffer: new ArrayBuffer(8192) };
  const logs = [], reads = { eax: 0, esp: 0, image: 0, translate: 0 };
  const state = { eax: 0, esp: 512 };
  const h = { log_api_exit() {} };
  const originalExit = h.log_api_exit;
  const sandbox = {};
  // Production flags used in these spans; selectively enabled below.
  for (const flag of runner.matchAll(/\b(?:TRACE_[A-Z_0-9]+|ESP_[A-Z_]+|QUIET_API)\b/g)) sandbox[flag[0]] = false;
  Object.assign(sandbox, { h, memory, logs, TRACE_API: trace, TRACE_API_FILTER: filter,
    TRACE_API_MEM: [], QUIET_API: quiet, ESP_DELTA: espDelta, breakApis: [],
    apiCount: 671, apiCounts: null, apiLogOff: false, criticalTracePending: null,
    traceEspOn: false, traceEipOn: false, STRING_APIS: [],
    apiTable, apiByName: new Map([...apiTable, ...entries].map(e => [e.name, e])),
    hex: v => '0x' + (v >>> 0).toString(16).padStart(8, '0'),
    readStr: () => '', onFailure() {},
    translateGuest: a => { reads.translate++; return a; },
    fmtApiCall: formatCall, fmtApiRet: formatRet, fmtApiOutParams: formatOutParams,
    instance: { exports: {
      get_eax: () => { reads.eax++; return state.eax; },
      get_esp: () => { reads.esp++; return state.esp; },
      get_image_base: () => { reads.image++; return 0; },
    } },
  });
  vm.runInNewContext(runner, sandbox, { filename: sourcePath, timeout: 1000 });
  let next = 32;
  function enter(name, com = false) {
    const ptr = next; next += 128;
    const text = com ? '<ord>' : name;
    new Uint8Array(memory.buffer, ptr, text.length).set(Buffer.from(text));
    if (com) h.log_i32(0xc0de0000 | known.id);
    h.log(ptr, text.length);
  }
  return { h, logs, reads, state, memory, enter, originalExit };
}
function repro(runner = wiring) {
  const f = host({}, runner);
  f.enter(known.name, true);
  f.state.eax = 0x887600ff | 0;
  f.h.log_api_exit(); // exact authoritative callback, before caller overwrite
  f.state.eax = 1;
  console.log(JSON.stringify({ case: 'production-boundary', logs: f.logs, reads: f.reads }));
  assert(f.logs.some(l => l.includes('=> 0x887600ff')), 'actual production API exit must retain raw EAX, not caller EAX1');
  assert(f.logs[0].includes('[API #672] ' + known.name + '('));
  assert.equal(f.reads.eax, 1);
}
console.log(JSON.stringify({ sourcePath, sourceSHA256: hash(source), spans: spans.map(({ bytes, ...s }) => ({ ...s, byteCount: Buffer.byteLength(bytes) })) }));
repro(); // FIRST behavioral checkpoint, including --repro-only against unchanged base
if (process.argv.includes('--repro-only')) process.exit(0);

// Additional cases are added only after the unchanged production reproducer.
