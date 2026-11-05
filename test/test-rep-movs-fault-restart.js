#!/usr/bin/env node
'use strict';

// REP MOVS{B,W,D} over an uncommitted page of a sparse VirtualAlloc
// reservation (absent pages only: this is NOT a PAGE_* protection test).
// Windows raises EXCEPTION_ACCESS_VIOLATION at the REP prefix with
// ExceptionInformation = {read 0 / write 1, first absent byte}, ECX/ESI/EDI
// counting only completed elements and the failed element's destination
// untouched; a handler that commits the page and continues finishes the REP
// exactly once. The guest handler below calls the real VirtualAlloc thunk and
// mutates already-copied source, so a re-copy of an earlier element shows.
//
// Two fault models are checked: --fault-mode=3 (asynchronous raise; handler
// resumes from CONTEXT) and --fault-mode=5 (Windows' reserved-page rule, the
// synchronous filter walk Serious Sam's CTStream relies on). Fault mode 0
// raises nothing by policy; only its zero-count and code-write cases run.
//
// No arguments: the whole suite in one compile (both matrices, MOVSW, uop
// entry with COPY deopt, block-executor decline, ContinueSearch to an outer
// frame, zero counts over unmapped pointers, REP MOVS code writes).
// Single cases: --width= --df= --operand= --completed= --cached --straddle
// --handler= --fault-mode= --engine=threaded|uop|block --continue-search;
// --matrix, --zero-count, --code-write select those groups.
// Source compilation appends setup exports only, never fault/REP transforms.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const apiTable = require('../src/api_table.json');

const setupWat = String.raw`
  (func (export "rep_fixture_flags") (param $flags i32)
    (call $load_eflags (local.get $flags)))
  (func (export "rep_fixture_decode") (param $pc i32) (result i32)
    (call $decode_block (local.get $pc)))
  (func (export "rep_fixture_alloc") (param $addr i32) (param $size i32)
      (param $type i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_VirtualAlloc (local.get $addr) (local.get $size)
      (local.get $type) (i32.const 4) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "rep_fixture_free") (param $addr i32) (param $stack i32)
      (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_VirtualFree (local.get $addr) (i32.const 4096)
      (i32.const 0x4000) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "rep_fixture_mapped") (param $addr i32) (result i32)
    (call $guest_addr_mapped (local.get $addr)))
  (func (export "rep_fixture_api_thunk") (param $id i32) (result i32)
    (local $addr i32)
    (local.set $addr (call $com_cont_thunk (i32.const 0)))
    (call $gs32 (i32.add (local.get $addr) (i32.const 4)) (local.get $id))
    (local.get $addr))
`;

const le32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const store8 = (addr, n) => [0xc6, 0x05, ...le32(addr), n & 255];
const saveEax = addr => [0xa3, ...le32(addr)];
const inc = addr => [0xff, 0x05, ...le32(addr)];
const PAGE = 4096;
const N = 7;
const GUARD = 0xa5;
const pattern = (element, byte) => (37 * element + 11 * byte + 19) & 255;

function options(argv) {
  const o = { width: 4, df: 0, operand: 'destination', cached: false,
    completed: 3, straddle: false, handler: 'plain', matrix: false, faultMode: 3,
    engine: 'threaded', zeroCount: false, continueSearch: false, codeWrite: false,
    all: argv.length === 0 };
  for (const arg of argv) {
    if (arg === '--matrix') o.matrix = true;
    else if (arg === '--zero-count') o.zeroCount = true;
    else if (arg === '--code-write') o.codeWrite = true;
    else if (arg === '--continue-search') o.continueSearch = true;
    else if (arg === '--cached') o.cached = true;
    else if (arg === '--straddle') o.straddle = true;
    else {
      const m = /^--(width|df|operand|completed|handler|fault-mode|engine)=(.+)$/.exec(arg);
      assert(m, `unknown argument ${arg}`);
      const key = m[1] === 'fault-mode' ? 'faultMode' : m[1];
      o[key] = ['operand', 'handler', 'engine'].includes(key) ? m[2] : Number(m[2]);
    }
  }
  assert([1, 2, 4].includes(o.width), 'width must be 1/2/4');
  assert([0, 1].includes(o.df), 'df must be 0/1');
  assert([0, 3].includes(o.completed), 'completed must be 0/3');
  assert(['source', 'destination'].includes(o.operand), 'operand');
  assert(['plain', 'mov-eax', 'scope-like'].includes(o.handler), 'handler');
  assert([0, 3, 5].includes(o.faultMode), 'fault-mode must be 0/3/5');
  assert(!o.straddle || o.width > 1, 'a byte cannot straddle pages');
  assert(['threaded', 'block', 'uop'].includes(o.engine), 'engine');
  assert(!o.matrix || o.engine === 'threaded', 'optimized cases must be explicitly selected');
  assert(o.handler === 'plain' || o.faultMode === 3,
    'mode 5 offers every frame raw; classifier variants are mode-3 only');
  return o;
}

function matrix(o) {
  const out = [];
  for (const width of [1, 2, 4]) for (const df of [0, 1])
    for (const operand of ['source', 'destination']) for (const cached of [false, true])
      for (const completed of [0, 3]) for (const straddle of width === 1 ? [false] : [false, true])
        out.push({ ...o, width, df, operand, cached, completed, straddle });
  return out;
}

// The whole suite (no arguments): both fault models.
function everything(o) {
  const out = [];
  for (const faultMode of [3, 5]) {
    const m = { ...o, faultMode };
    out.push(...matrix(m));
    // Optimized tiers. The micro-op tier is entered at the installed REP head
    // by a real guest jump and must deoptimize its COPY to the precise path.
    for (const width of [1, 4]) for (const df of [0, 1])
      out.push({ ...m, engine: 'uop', cached: true, width, df });
    out.push({ ...m, engine: 'uop', cached: true, operand: 'source', straddle: true, df: 1 });
    // The per-block executor stands down while a fault mode is armed; the
    // case proves that decline at the faulting block and then the semantics.
    out.push({ ...m, engine: 'block' }, { ...m, engine: 'block', cached: true, width: 1, df: 1 });
    // ContinueSearch: the inner frame declines, the outer one repairs; both
    // must see the same record and CONTEXT.
    for (const operand of ['source', 'destination'])
      out.push({ ...m, continueSearch: true, operand }, { ...m, continueSearch: true, operand, width: 2, straddle: true, df: 1 });
  }
  return out;
}

function cases(o) {
  if (o.all) return everything(o);
  if (o.matrix) return matrix(o);
  return [o];
}

async function boot(bytes) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const imports = createHostImports(ctx);
  const state = { misses: 0, exits: [] };
  Object.assign(imports.host, { memory, log: () => {}, log_i32: () => {},
    exit: code => { state.exits.push(code >>> 0); },
    crash_unimplemented: code => { throw new Error(`unimplemented ${code}`); },
    unmapped_trace: () => {
      assert(++state.misses <= 64, 'bounded fixture: repeated uncorrected misses');
    } });
  const e = (await WebAssembly.instantiate(bytes, imports)).instance.exports;
  ctx.exports = e;
  const exe = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  new Uint8Array(memory.buffer).set(exe, e.get_staging());
  e.load_pe(exe.length);
  e.set_api_log(0);
  // Threaded is the default. Explicit optimized cases below require an
  // installed REP descriptor or actual compiled entry + COPY deoptimization.
  e.set_uop(0);
  e.set_block_exec(0);
  return { e, state, memory };
}

function runCase(machine, o) {
  const { e, state, memory } = machine;
  const label = `w${o.width}/df${o.df}/${o.operand}/k${o.completed}/`
    + `${o.cached ? 'cached' : 'cold'}/${o.straddle ? 'straddle' : 'aligned'}/${o.handler}/mode${o.faultMode}/${o.engine}`;
  console.log(`CASE ${label}`);
  const bytes = new Uint8Array(memory.buffer);
  const view = new DataView(memory.buffer);
  const wa = addr => e.guest_to_wasm(addr) >>> 0;
  const put = (addr, data) => bytes.set(data, wa(addr));
  const poke = (addr, v) => view.setUint32(wa(addr), v >>> 0, true);
  const peek = addr => view.getUint32(wa(addr), true);
  const read8 = addr => bytes[wa(addr)];
  const write8 = (addr, v) => { bytes[wa(addr)] = v; };
  const alloc = size => { const a = e.guest_alloc(size) >>> 0; assert(a, 'fixture heap'); return a; };
  // Code, report and stack are on independent pages: report initialization
  // must not invalidate the warmed decoded instruction page.
  const codeArea = alloc(8192), code = (codeArea + PAGE - 1) & -PAGE;
  const handlerArea = alloc(8192), handler = (handlerArea + PAGE - 1) & -PAGE;
  const data = alloc(8192), report = (data + PAGE - 1) & -PAGE;
  const stack = alloc(8192) + 7000;
  const seh = report + 0x600, fsSlot = report + 0x640;
  const before = report, after = report + 4, calls = report + 8;
  const allocResult = report + 12, finalFlags = report + 16;
  const saved = report + 0x40, savedBytes = report + 0x100;
  const expectedFlags = 0x202 | (o.df ? 0x400 : 0);
  const reserve = () => {
    const a = e.rep_fixture_alloc(0, 4 * PAGE, 0x2000, stack) >>> 0;
    assert(a && !(a & (PAGE - 1)), 'sparse reservation');
    assert.strictEqual(e.rep_fixture_alloc(a, 4 * PAGE, 0x1000, stack) >>> 0, a, 'commit fixture');
    return a;
  };
  const srcBase = reserve(), dstBase = reserve();
  const boundary = (o.operand === 'source' ? srcBase : dstBase) + PAGE;
  const hole = o.df ? boundary - PAGE : boundary;
  const step = o.df ? -o.width : o.width;
  const failed = o.df ? boundary - (o.straddle ? 1 : o.width)
    : boundary - (o.straddle ? o.width - 1 : 0);
  const start = failed - o.completed * step;
  const src = o.operand === 'source' ? start : srcBase + 2 * PAGE + 64;
  const dst = o.operand === 'destination' ? start : dstBase + 2 * PAGE + 64;
  const inHole = addr => addr >= hole && addr < hole + PAGE;
  const firstAbsent = Math.max(failed, hole);
  const destCells = [];
  const sourceCells = [];
  for (let i = 0; i < N; i++) for (let b = 0; b < o.width; b++) {
    sourceCells.push({ addr: src + i * step + b, value: pattern(i, b) });
    destCells.push({ addr: dst + i * step + b, value: pattern(i, b), element: i });
  }
  const lo = Math.min(dst, dst + (N - 1) * step);
  const hi = Math.max(dst, dst + (N - 1) * step) + o.width;
  const guardCells = [];
  for (let i = 1; i <= 8; i++) guardCells.push(lo - i, hi + i - 1);
  const snapshot = [
    ...destCells.map(c => ({ addr: c.addr, value: c.element < o.completed ? c.value : GUARD })),
    ...guardCells.map(addr => ({ addr, value: GUARD })),
  ].filter(c => !inHole(c.addr));

  const prefix = [0x68, ...le32(expectedFlags), 0x9d]; // push flags; popfd
  const rep = o.width === 1 ? [0xf3, 0xa4]
    : o.width === 2 ? [0x66, 0xf3, 0xa5] : [0xf3, 0xa5];
  // A tier installed at REP must be entered through a guest transfer. Mere
  // fallthrough from this earlier prologue could run the first REP threaded,
  // then enter the tier only on SEH retry after the page was already repaired.
  const prologue = [...inc(before), ...prefix,
    ...(o.engine === 'uop' ? [0xe9, ...le32(0)] : [])];
  const repPC = code + prologue.length;
  // Uop uses a genuine one-trip loop (EBP=1); its DEC sets the final flags.
  const loopTail = o.engine === 'uop' ? [0x4d, 0x75, (-(rep.length + 3)) & 255] : [];
  const tail = [0x9c, 0x58, ...saveEax(finalFlags), ...inc(after), 0xc3];
  put(code, [...prologue, ...rep, ...loopTail, ...tail]);

  // Actual cdecl guest handler. Save the exception/context and mapped
  // destination bytes BEFORE VirtualAlloc or any repair. No REP helper or
  // host callback fabricates these observations.
  const recordFields = [0, 12, 16, 20, 24];
  const contextFields = [0x9c, 0xa0, 0xac, 0xb8, 0xc0, 0xa4, 0xa8, 0xb4];
  const h = o.handler === 'mov-eax' ? [0xb8, ...le32(0)] : [0x90];
  h.push(...inc(calls), 0x8b, 0x5c, 0x24, 4, 0x8b, 0x6c, 0x24, 12);
  let slot = saved;
  for (const offset of recordFields) {
    h.push(0x8b, 0x83, ...le32(offset), ...saveEax(slot)); slot += 4;
  }
  for (const offset of contextFields) {
    h.push(0x8b, 0x85, ...le32(offset), ...saveEax(slot)); slot += 4;
  }
  const firstSaved = report + 0x700;
  if (o.continueSearch) {
    const search = [0x90, ...inc(calls), 0x8b, 0x5c, 0x24, 4, 0x8b, 0x6c, 0x24, 12];
    let firstSlot = firstSaved;
    for (const offset of recordFields) {
      search.push(0x8b, 0x83, ...le32(offset), ...saveEax(firstSlot)); firstSlot += 4;
    }
    for (const offset of contextFields) {
      search.push(0x8b, 0x85, ...le32(offset), ...saveEax(firstSlot)); firstSlot += 4;
    }
    search.push(0xb8, ...le32(1), 0xc3); // ContinueSearch; no repair or CONTEXT edit
    put(handler + 0x800, search);
  }
  h.push(0xa1, ...le32(before), ...saveEax(slot), 0xa1, ...le32(after), ...saveEax(slot + 4));
  snapshot.forEach((c, i) => h.push(0x0f, 0xb6, 0x05, ...le32(c.addr), ...saveEax(savedBytes + 4 * i)));
  const api = apiTable.find(a => a.name === 'VirtualAlloc');
  assert(api && api.nargs === 4, 'VirtualAlloc API metadata');
  const thunk = e.rep_fixture_api_thunk(api.id) >>> 0;
  h.push(0x68, ...le32(4), 0x68, ...le32(0x1000), 0x68, ...le32(PAGE),
    0x68, ...le32(hole), 0xb8, ...le32(thunk), 0xff, 0xd0, ...saveEax(allocResult));
  // Decommit erased the hole. Re-create only the needed source bytes or
  // destination sentinel bytes before returning to the unchanged CONTEXT.
  for (const c of sourceCells) if (inHole(c.addr)) h.push(...store8(c.addr, c.value));
  for (const c of destCells) if (inHole(c.addr)) h.push(...store8(c.addr, GUARD));
  for (const addr of guardCells) if (inHole(addr)) h.push(...store8(addr, GUARD));
  if (o.completed) h.push(...store8(src, pattern(0, 0) ^ 0xff));
  h.push(0x31, 0xc0, 0xc3); // ExceptionContinueExecution; real raw continuation
  assert(h.length < PAGE, 'guest handler fits isolated code page');
  put(handler, h);
  poke(seh, o.continueSearch ? seh + 0x20 : 0xffffffff);
  poke(seh + 4, o.continueSearch ? handler + 0x800 : handler);
  if (o.continueSearch) {
    poke(seh + 0x20, 0xffffffff); poke(seh + 0x24, handler);
    poke(seh + 0x28, 0); poke(seh + 0x2c, 0);
  }
  poke(seh + 8, o.handler === 'scope-like' ? report + 0x680 : 0);
  poke(seh + 12, o.handler === 'scope-like' ? 0xffffffff : 0);
  poke(fsSlot, seh); e.set_fs_base(fsSlot);
  const initialize = () => {
    for (const c of sourceCells) write8(c.addr, c.value);
    for (const c of destCells) write8(c.addr, GUARD);
    for (const addr of guardCells) write8(addr, GUARD);
    bytes.fill(0, wa(report), wa(report) + 0x500);
    state.misses = 0; state.exits.length = 0;
  };
  const arm = () => {
    poke(stack, 0); e.set_esp(stack); e.set_eip(code);
    e.set_esi(src); e.set_edi(dst); e.set_ecx(N);
    e.set_ebx(0x11223344); e.set_edx(0x55667788); e.set_ebp(o.engine === 'uop' ? 1 : 0x12345678);
    e.rep_fixture_flags(expectedFlags);
  };
  const execute = () => {
    for (let batch = 0; batch < 16; batch++) {
      e.run(1000);
      if (!(e.get_eip() >>> 0) || state.exits.length) return;
    }
    assert.fail(`${label}: did not finish within 16 bounded run slices`);
  };
  e.set_fault_unmapped(o.faultMode);
  initialize();
  let descriptorHandler = null;
  e.set_uop(0); e.set_block_exec(0);
  if (o.engine === 'block') {
    // H458/H463/H464 run TU_REP_STR through the bulk `_do` bodies, which
    // have no fault continuation; they must decline while a mode is armed.
    e.set_block_exec(1); e.set_block_exec_min_uops(1);
    const stream = e.rep_fixture_decode(code) >>> 0;
    descriptorHandler = view.getUint32(stream, true);
    assert(![458, 463, 464].includes(descriptorHandler),
      `${label}: block executor must decline the faulting block under fault mode ${o.faultMode}`);
  } else if (o.engine === 'uop') {
    e.set_uop(1);
    const program = e.uop_compile(repPC);
    assert(program, 'fixture REP loop must compile');
    e.uop_install(repPC, program);
  }
  if (o.cached) {
    arm(); execute();
    assert.strictEqual(e.get_eip() >>> 0, 0, 'warm mapped return');
    assert.strictEqual(peek(calls), 0, 'warm mapped copy does not fault');
    assert.strictEqual(e.get_ecx() >>> 0, 0, 'warm mapped ECX');
    for (const c of destCells) assert.strictEqual(read8(c.addr), c.value, 'warm mapped copy');
    initialize();
  }
  assert.strictEqual(e.rep_fixture_free(hole, stack) >>> 0, 1, 'decommit one page');
  assert.strictEqual(e.rep_fixture_mapped(hole), 0, 'absent-page precondition');
  assert.strictEqual(e.rep_fixture_mapped(o.df ? boundary : boundary - 1), 1, 'neighbor remains mapped');
  const countersBefore = { block: e.get_block_exec_runs(), leaf: e.get_block_exec_leaf_runs(),
    leafFb: e.get_block_exec_leaf_fb_runs(), uop: e.uop_stats(4), deopt: e.uop_bulk_stats(1) };
  arm(); execute();
  const pathEvidence = { descriptorHandler,
    blockRuns: e.get_block_exec_runs() - countersBefore.block,
    leafRuns: e.get_block_exec_leaf_runs() - countersBefore.leaf,
    leafFbRuns: e.get_block_exec_leaf_fb_runs() - countersBefore.leafFb,
    uopEnters: e.uop_stats(4) - countersBefore.uop,
    bulkDeopts: e.uop_bulk_stats(1) - countersBefore.deopt };
  const verbose = !o.all;

  // Diagnostic evidence only; expectations below are unchanged. The report
  // is overwritten on every handler entry, so never call it the first fault.
  const observedNames = ['code', 'exceptionAddress', 'numberParameters', 'accessKind', 'faultAddress',
    'edi', 'esi', 'ecx', 'eip', 'eflags', 'ebx', 'edx', 'ebp', 'beforeMarker', 'afterMarker'];
  if (verbose) console.log('OBSERVED ' + JSON.stringify({
    case: label, calls: peek(calls), exits: state.exits, pathEvidence,
    continueSearch: o.continueSearch,
    savedContextMeaning: 'last handler observation; earlier entries overwritten',
    lastHandlerObservation: Object.fromEntries(observedNames.map((name, i) => [name, peek(saved + 4 * i)])),
    lastHandlerDestinationBytes: snapshot.map((c, i) => ({ address: c.addr,
      observed: peek(savedBytes + 4 * i), expectedAtFirstFault: c.value })),
    markers: { before: peek(before), after: peek(after) },
    finalRegisters: Object.fromEntries(['eax', 'ebx', 'ecx', 'edx', 'esi', 'edi', 'ebp', 'esp', 'eip']
      .map(reg => [reg, e[`get_${reg}`]() >>> 0])),
    flagsSavedImmediatelyAfterREP: peek(finalFlags),
    repairResult: peek(allocResult), hole, holeMapped: e.rep_fixture_mapped(hole),
    expected: { repPC, faultAddress: firstAbsent, accessKind: o.operand === 'destination' ? 1 : 0,
      esi: src + o.completed * step, edi: dst + o.completed * step, ecx: N - o.completed,
      eflags: expectedFlags },
  }));
  assert.strictEqual(peek(calls), o.continueSearch ? 2 : 1,
    `${label}: actual guest raw handler called once per offered frame`);
  assert.deepStrictEqual(state.exits, [], `${label}: no unhandled exit`);
  const expected = [0xc0000005, repPC, 2, o.operand === 'destination' ? 1 : 0,
    firstAbsent, dst + o.completed * step, src + o.completed * step,
    N - o.completed, repPC, expectedFlags, 0x11223344, 0x55667788,
    o.engine === 'uop' ? 1 : 0x12345678, 1, 0];
  const names = ['code', 'ExceptionAddress', 'NumberParameters', 'access kind', 'first absent byte',
    'context EDI', 'context ESI', 'context ECX', 'context EIP', 'context flags',
    'context EBX', 'context EDX', 'context EBP', 'pre-REP marker at fault', 'post-REP marker at fault'];
  expected.forEach((v, i) => assert.strictEqual(peek(saved + 4 * i), v >>> 0, `${label}: ${names[i]}`));
  if (o.continueSearch) expected.slice(0, 13).forEach((v, i) =>
    assert.strictEqual(peek(firstSaved + 4 * i), v >>> 0, `${label}: first frame ${names[i]}`));
  snapshot.forEach((c, i) => assert.strictEqual(peek(savedBytes + 4 * i), c.value,
    `${label}: destination byte 0x${c.addr.toString(16)} before repair (failed element/guards/progress)`));
  assert.strictEqual(peek(allocResult), hole, `${label}: guest VirtualAlloc repaired hole`);
  assert.strictEqual(e.get_eip() >>> 0, 0, `${label}: return`);
  assert.strictEqual(peek(before), 1, `${label}: no block-head rewind`);
  assert.strictEqual(peek(after), 1, `${label}: post-REP instruction exactly once`);
  assert.strictEqual(peek(finalFlags), o.engine === 'uop' ? expectedFlags | 0x44 : expectedFlags,
    `${label}: REP flags/DF (uop loop subsequently DEC's EBP to zero)`);
  for (const [reg, value] of [['esi', src + N * step], ['edi', dst + N * step], ['ecx', 0],
    ['ebx', 0x11223344], ['edx', 0x55667788], ['ebp', o.engine === 'uop' ? 0 : 0x12345678]]) {
    assert.strictEqual(e[`get_${reg}`]() >>> 0, value >>> 0, `${label}: final ${reg}`);
  }
  for (const c of destCells) assert.strictEqual(read8(c.addr), c.value,
    `${label}: final destination (completed elements must not be recopied)`);
  for (const addr of guardCells) assert.strictEqual(read8(addr), GUARD, `${label}: final guard`);
  assert.strictEqual(pathEvidence.blockRuns + pathEvidence.leafRuns + pathEvidence.leafFbRuns, 0,
    `${label}: no block executor ran with a fault mode armed`);
  if (o.engine === 'uop') {
    assert(pathEvidence.uopEnters > 0, `${label}: compiled REP program actually entered`);
    assert(pathEvidence.bulkDeopts > 0, `${label}: absent-page COPY actually deoptimized`);
  }
  console.log(`PASS ${label}`);
}

// REP MOVS whose destination is decoded code: the bytes it writes are the
// imm32 of `mov eax, imm32` at the head of the block the REP jumps to. Each
// later run copies a different value over that now cached block, so a stale
// decode or a missed invalidation shows as the previous value. (A write into
// the REST OF THE WRITER'S OWN block is a separate, general store question:
// retiring the running block does not move the thread pointer off it.)
function runCodeWrite(machine, faultMode, engine, width) {
  const { e, state, memory } = machine;
  const label = `code-write w${width}/mode${faultMode}/${engine}`;
  const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
  const wa = addr => e.guest_to_wasm(addr) >>> 0;
  const peek = addr => view.getUint32(wa(addr), true);
  const codeArea = e.guest_alloc(8192) >>> 0, code = (codeArea + PAGE - 1) & -PAGE;
  const data = e.guest_alloc(256) >>> 0, stack = (e.guest_alloc(4096) >>> 0) + 3000;
  const src = data, result = data + 64;
  const rep = width === 1 ? [0xf3, 0xa4] : width === 2 ? [0x66, 0xf3, 0xa5] : [0xf3, 0xa5];
  // mov ecx,4/w; [jmp +0 (uop entry)] rep movs; [dec ebp; jnz rep (uop: a
  // one-trip loop, EBP=1)] jmp +0; next block: mov eax,0x11111111;
  // mov [result],eax; ret
  const uop = engine === 'uop';
  const repPC = code + 5 + (uop ? 5 : 0);
  const loopTail = uop ? [0x4d, 0x75, (-(rep.length + 3)) & 255] : [];
  const immAt = repPC + rep.length + loopTail.length + 5 + 1;
  const prog = [0xb9, ...le32(4 / width), ...(uop ? [0xe9, ...le32(0)] : []), ...rep, ...loopTail,
    0xe9, ...le32(0), 0xb8, ...le32(0x11111111), ...saveEax(result), 0xc3];
  bytes.set(prog, wa(code));
  e.set_fault_unmapped(faultMode);
  e.set_uop(0); e.set_block_exec(0);
  if (engine === 'block') { e.set_block_exec(1); e.set_block_exec_min_uops(1); }
  if (engine === 'uop') {
    e.set_uop(1);
    const program = e.uop_compile(repPC);
    assert(program, `${label}: REP head compiles`);
    e.uop_install(repPC, program);
  }
  const before = { block: e.get_block_exec_runs() + e.get_block_exec_leaf_runs() + e.get_block_exec_leaf_fb_runs(),
    uop: e.uop_stats(4), deopt: e.uop_bulk_stats(1) };
  for (const value of [0x22222222, 0x33333333, 0x44444444]) {
    view.setUint32(wa(src), value, true);
    view.setUint32(wa(stack), 0, true);
    e.set_ebp(1);
    e.rep_fixture_flags(0x202); e.set_esi(src); e.set_edi(immAt);
    e.set_eip(code); e.set_esp(stack); state.exits.length = 0;
    for (let i = 0; i < 16 && (e.get_eip() >>> 0); i++) e.run(1000);
    assert.strictEqual(e.get_eip() >>> 0, 0, `${label}: return`);
    assert.deepStrictEqual(state.exits, [], `${label}: no fault`);
    assert.strictEqual(peek(immAt), value >>> 0, `${label}: code bytes written`);
    assert.strictEqual(peek(result) >>> 0, value >>> 0, `${label}: executed the bytes REP MOVS wrote`);
  }
  const blockRuns = e.get_block_exec_runs() + e.get_block_exec_leaf_runs() + e.get_block_exec_leaf_fb_runs() - before.block;
  if (engine === 'block') assert(blockRuns > 0, `${label}: a block executor ran the REP`);
  if (uop) {
    assert(e.uop_stats(4) - before.uop > 0, `${label}: compiled REP program entered`);
    assert(e.uop_bulk_stats(1) - before.deopt > 0, `${label}: COPY onto a code page deoptimized`);
  }
  e.set_uop(0); e.set_block_exec(0);
  console.log(`PASS ${label}`);
}

function runCodeWrites(machine) {
  for (const width of [1, 2, 4]) for (const faultMode of [0, 3, 5]) runCodeWrite(machine, faultMode, 'threaded', width);
  for (const width of [1, 4]) runCodeWrite(machine, 0, 'block', width);
  for (const faultMode of [0, 3, 5]) runCodeWrite(machine, faultMode, 'uop', 4);
}

function runZeroCount(machine, faultMode) {
  const { e, state, memory } = machine;
  const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
  const code = e.guest_alloc(512) >>> 0, stack = (e.guest_alloc(4096) >>> 0) + 3000;
  const unmapped = e.rep_fixture_alloc(0, 2 * PAGE, 0x2000, stack) >>> 0;
  assert(unmapped && !e.rep_fixture_mapped(unmapped), 'reserved absent pointers');
  e.set_fault_unmapped(faultMode);
  for (const width of [1, 2, 4]) for (const df of [0, 1]) {
    const at = code + (width * 2 + df) * 32;
    const flags = 0x202 | (df ? 0x400 : 0);
    const rep = width === 1 ? [0xf3, 0xa4] : width === 2 ? [0x66, 0xf3, 0xa5] : [0xf3, 0xa5];
    bytes.set([...rep, 0x9c, 0x58, 0xc3], e.guest_to_wasm(at) >>> 0);
    view.setUint32(e.guest_to_wasm(stack) >>> 0, 0, true);
    e.rep_fixture_flags(flags); e.set_esi(unmapped); e.set_edi(unmapped + PAGE);
    e.set_ecx(0); e.set_eip(at); e.set_esp(stack); state.misses = 0; state.exits.length = 0;
    e.run(1000);
    assert.strictEqual(e.get_eip() >>> 0, 0, 'zero-count return');
    assert.strictEqual(e.get_ecx() >>> 0, 0, 'zero count');
    assert.strictEqual(e.get_esi() >>> 0, unmapped, 'zero-count ESI');
    assert.strictEqual(e.get_edi() >>> 0, unmapped + PAGE, 'zero-count EDI');
    assert.strictEqual(e.get_eax() >>> 0, flags, 'zero-count flags');
    assert.strictEqual(state.misses, 0, 'zero-count must not access either absent pointer');
    assert.deepStrictEqual(state.exits, [], 'zero-count must not raise an unhandled fault');
    console.log(`PASS zero-count width${width}/df${df}/mode${faultMode}`);
  }
}

async function main() {
  const o = options(process.argv.slice(2));
  const selected = cases(o);
  console.log(`REP absent-page restart: ${selected.length} cases${o.all ? ' + zero-count + code-write' : ''}; source compile with setup exports`);
  const wasm = compileSrcWasm((file, text) => file === '13-exports.wat' ? `${text}\n${setupWat}\n` : text);
  console.log(`fixture module sha256=${crypto.createHash('sha256').update(wasm).digest('hex')}`);
  const machine = await boot(wasm);
  if (o.zeroCount) { runZeroCount(machine, o.faultMode); return; }
  if (o.codeWrite) { runCodeWrites(machine); return; }
  if (o.all) for (const mode of [0, 3, 5]) runZeroCount(machine, mode);
  for (const c of selected) runCase(machine, c); // Stop at the first meaningful failure.
  if (o.all) runCodeWrites(machine);
  console.log(`PASS REP absent-page restart ${selected.length} cases`);
}

if (require.main === module) main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
