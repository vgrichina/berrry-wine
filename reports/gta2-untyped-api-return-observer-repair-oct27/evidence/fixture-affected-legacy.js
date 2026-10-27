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
  return { codeUnitStart: a, codeUnitEnd: b, byteStart: Buffer.byteLength(source.slice(0, a)),
    byteEnd: Buffer.byteLength(source.slice(0, b)), bytes, sha256: hash(bytes) };
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
function host({ trace = true, filter = null, espDelta = false, quiet = false, paused = false, entries = [] } = {}, runner = wiring) {
  const memory = { buffer: new ArrayBuffer(8192) };
  const logs = [], reads = { eax: 0, esp: 0, image: 0, translate: 0 };
  const state = { eax: 0, esp: 512 };
  const h = { log_api_exit() {} };
  const originalExit = h.log_api_exit;
  const sandbox = {};
  // Production flags used in these spans; selectively enabled below.
  for (const flag of runner.matchAll(/\b(?:TRACE_[A-Z_0-9]+|ESP_[A-Z_]+|QUIET_API)\b/g)) sandbox[flag[0]] = false;
  Object.assign(sandbox, { h, memory, logs, TRACE_API: trace, TRACE_API_FILTER: filter,
    TRACE_API_MEM: [], TRACE_API_PAUSED: paused, QUIET_API: quiet, ESP_DELTA: espDelta, breakApis: [],
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
  return { h, logs, reads, state, memory, enter, originalExit, apiLogOff: sandbox.apiLogOff };
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
const fromGroup = Number((process.argv.find(a => a.startsWith('--from-group=')) || '=0').split('=')[1]);
if (!fromGroup) repro(); // FIRST behavioral checkpoint, including --repro-only against unchanged base
if (process.argv.includes('--repro-only')) process.exit(0);

// Additional cases are added only after the unchanged production reproducer.
let checks = 0;
let group = 0;
function check(name, fn) {
  if (++group < fromGroup) return;
  fn(); checks++; console.log('PASS ' + name);
}
const returns = f => f.logs.filter(l => /^\s*=>/.test(l));
function untypedCase(name, value, diagnostic, runner = wiring) {
  const f = host({}, runner);
  f.enter(name);
  const before = Buffer.from(f.memory.buffer);
  if (diagnostic !== undefined) {
    f.h.log_i32(diagnostic);
    assert.equal(returns(f).length, 0, 'log_i32 must not masquerade as final EAX');
    assert(f.logs.includes('[i32] 0x0000007b'), 'meaningful integer diagnostic remains visible');
  }
  f.state.eax = value;
  f.h.log_api_exit();
  assert.equal(returns(f).length, 1);
  assert(returns(f)[0].includes('=> 0x' + (value >>> 0).toString(16).padStart(8, '0')));
  assert(returns(f)[0].includes(name), 'raw return names the actual selected API');
  assert.equal(f.reads.eax, 1);
  assert.deepEqual(Buffer.from(f.memory.buffer), before, 'observer must not mutate guest memory');
  assert.equal(f.state.eax, value, 'observer must not mutate guest registers');
  f.state.eax = 1; // caller overwrites EAX only AFTER authoritative callback
  f.h.log_api_exit();
  f.h.log_i32(456);
  assert.equal(returns(f).length, 1, 'no duplicate/stale exit');
  assert.equal(f.reads.eax, 1, 'stale exit does no extra register read');
  assert.equal(f.logs.at(-1), '[i32] 0x000001c8');
  return f;
}
check('known/unknown entry: raw zero, positive, unsigned/signed HRESULT, all bits set; interleaved integer', () => {
  for (const name of [known.name, 'UnknownUntypedApi']) {
    for (const value of [0, 42, 0x887600ff, 0x887600ff | 0, 0xffffffff, -1]) {
      untypedCase(name, value);
      untypedCase(name, value, 123);
    }
  }
});
function typedCase(runner = wiring, ret = 'BOOL') {
  const entry = { name: 'ObserverTypedFixture', args: [{ name: 'answer', type: 'LPDWORD', out: true }], ret };
  if (!ret) delete entry.ret;
  const f = host({ entries: [entry] }, runner);
  const dv = new DataView(f.memory.buffer);
  dv.setUint32(516, 1024, true);
  dv.setUint32(1024, 0x1234, true);
  f.enter(entry.name);
  f.h.log_i32(123);
  assert.equal(returns(f).length, 0);
  f.state.esp = 600; // stack churn must not destroy entry's out-param pointer
  dv.setUint32(604, 2048, true);
  dv.setUint32(1024, 0x5678, true);
  const before = Buffer.from(f.memory.buffer);
  f.state.eax = 1;
  f.h.log_api_exit();
  assert.equal(returns(f).length, 1);
  if (ret) {
    assert.equal(returns(f)[0], '  => TRUE');
    assert(!f.logs.some(l => l.includes('[i32]')), 'preserve typed suppression of legacy integer');
  } else assert(returns(f)[0].includes('raw EAX; ' + entry.name));
  assert.equal(f.logs.filter(l => l.includes('out: answer=')).length, 1);
  assert(f.logs.some(l => /out: answer=&0x00005678/.test(l)), 'out param uses updated data at original pointer');
  assert.deepEqual(Buffer.from(f.memory.buffer), before);
  f.h.log_api_exit();
  assert.equal(returns(f).length, 1);
  assert.equal(f.logs.filter(l => l.includes('out: answer=')).length, 1);
}
check('typed return/outparam once, entry pointer survives stack churn', () => typedCase());
check('untyped entry still decodes declared outparams once', () => typedCase(wiring, null));
check('sequential calls retain their own production header/name identity', () => {
  const f = host();
  for (const [name, eax] of [[known.name, -1], ['UnknownUntypedApi', 0]]) {
    f.enter(name); f.state.eax = eax; f.h.log_api_exit();
  }
  assert(f.logs[0].startsWith('[API #672] ' + known.name));
  assert(f.logs[2].startsWith('[API #673] UnknownUntypedApi'));
  assert(returns(f)[0].includes(known.name));
  assert(returns(f)[1].includes('UnknownUntypedApi'));
});
check('filtered call with ESP audit cannot inherit typed/untyped return metadata', () => {
  for (const espDelta of [false, true]) {
    const f = host({ filter: new Set([known.name]), espDelta });
    f.enter(known.name); f.state.eax = 42; f.h.log_api_exit();
    f.enter('NotSelected'); f.state.eax = -1; f.h.log_i32(123); f.h.log_api_exit();
    assert.equal(returns(f).length, 1);
    assert.equal(f.reads.eax, 1);
    assert(!returns(f).some(l => l.includes('NotSelected')));
  }
});
check('new filtered entry supersedes unfinished correlation truthfully', () => {
  const f = host({ filter: new Set([known.name]), espDelta: true });
  f.enter(known.name); f.enter('NotSelected'); f.state.eax = -1; f.h.log_api_exit();
  assert.equal(returns(f).length, 0);
  assert.equal(f.reads.eax, 0);
});
check('exit without entry has no stale call or register access', () => {
  const f = host(); f.h.log_api_exit(); assert.equal(f.logs.length, 0); assert.equal(f.reads.eax, 0);
});
check('disabled/default logging preserves callback, legacy API/integer output and zero guest reads', () => {
  for (const quiet of [false, true]) {
    const f = host({ trace: false, quiet });
    assert.equal(f.h.log_api_exit, f.originalExit, 'no exit instrumentation installed when disabled');
    f.enter(known.name); f.h.log_i32(123); f.h.log_api_exit();
    assert.deepEqual(f.logs, quiet ? ['[i32] 0x0000007b'] : ['[API] ' + known.name, '[i32] 0x0000007b']);
    assert.deepEqual(f.reads, { eax: 0, esp: 0, image: 0, translate: 0 });
  }
});
check('COM marker resolves method identity before raw exit, integer outside call stays diagnostic', () => {
  const f = host(); f.h.log_i32(123); f.enter(known.name, true); f.state.eax = -1; f.h.log_api_exit();
  assert.equal(f.logs[0], '[i32] 0x0000007b');
  assert(f.logs[1].includes('[API #672] ' + known.name));
  assert.equal(returns(f).length, 1); assert(returns(f)[0].includes(known.name));
});
function reject(name, from, to, oracle) {
  assert.equal(wiring.split(from).length, 2, 'mutation anchor unique');
  const mutation = wiring.replace(from, to);
  assert.throws(() => oracle(mutation), assert.AssertionError, 'control must be rejected: ' + name);
  console.log('REJECTED CONTROL ' + name + ' sha256=' + hash(mutation));
}
check('meaningful production-boundary omission/mutation controls', () => {
  reject('omit raw fallback', '`=> ${hex(eax)} (raw EAX; ${lastApiName})`', "''", repro);
  reject('stale/non-EAX register substituted', 'const eax = instance.exports.get_eax();', 'const eax = instance.exports.get_esp();', repro);
  reject('integer clears correlation before exit', "logs.push('[i32] ' + hex(val));\n      }", "logs.push('[i32] ' + hex(val)); lastApiName = null;\n      }", r => untypedCase(known.name, -1, 123, r));
  reject('unknown entry omitted', 'if (TRACE_API && lastApiTraced) {\n        const dv', 'if (TRACE_API && lastApiTraced && lastApiEntry) {\n        const dv', r => untypedCase('UnknownUntypedApi', -1, undefined, r));
  reject('typed return duplicated', 'if (typedRet) logs.push(`  ${typedRet.trim()}`);', 'if (typedRet) { logs.push(`  ${typedRet.trim()}`); logs.push(`  ${typedRet.trim()}`); }', typedCase);
  reject('wrong call identity', '`=> ${hex(eax)} (raw EAX; ${lastApiName})`', '`=> ${hex(eax)} (raw EAX; WrongApi)`', r => untypedCase(known.name, -1, undefined, r));
});
check('affected legacy integer protocols, ESP-only and quiet/paused production gating', () => {
  const f = host();
  f.enter(known.name);
  // Multiword diagnostics retain payload interpretation and API correlation.
  for (const value of [0xcade5000, 0x1234, 1, 0x100, 2, 3, 4]) f.h.log_i32(value);
  assert.equal(returns(f).length, 0);
  assert(f.logs.some(l => l.startsWith('[sync] ABANDONED wndproc hwnd=0x00000002')));
  f.state.eax = -1; f.h.log_api_exit();
  assert.equal(returns(f).length, 1);
  assert(returns(f)[0].includes(known.name));
  const esp = host({ trace: false, espDelta: true });
  esp.enter(known.name); esp.state.esp += 16;
  esp.h.log_i32(123); esp.h.log_api_exit();
  assert(esp.logs.some(l => l.includes('delta=+16')));
  assert(esp.logs.includes('[i32] 0x0000007b'));
  assert.equal(esp.reads.eax, 0);
  assert.equal(returns(esp).length, 0);
  assert.equal(host({ trace: false, quiet: true }).apiLogOff, true);
  assert.equal(host({ trace: true, quiet: true, paused: true }).apiLogOff, true);
  assert.equal(host({ trace: true, quiet: true, paused: false }).apiLogOff, false);
});
console.log(`PASS ${checks} focused production callback groups; source-only, guest exports stubbed`);
