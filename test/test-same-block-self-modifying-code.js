#!/usr/bin/env node
'use strict';

// Generated x86 only. No guest application entry executes. --wasm=PATH also
// runs the shipping module, without test-only exports or execution overrides.
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const le32 = n => [n, n >>> 8, n >>> 16, n >>> 24].map(v => v & 255);
const PAGE = 4096;

// Small PE32 container for the production loader/address-space initializer.
// Its sole section contains RET; all test programs are generated below.
function fixturePE() {
  const b = Buffer.alloc(1024), pe = 0x80, opt = pe + 24, sec = opt + 224;
  b.writeUInt16LE(0x5a4d, 0); b.writeUInt32LE(pe, 0x3c);
  b.writeUInt32LE(0x4550, pe); b.writeUInt16LE(0x14c, pe + 4);
  b.writeUInt16LE(1, pe + 6); b.writeUInt16LE(224, pe + 20);
  b.writeUInt16LE(0x102, pe + 22); b.writeUInt16LE(0x10b, opt);
  for (const [off, value] of [[16, 0x1000], [28, 0x400000], [32, PAGE],
    [36, 512], [56, 0x2000], [60, 512], [72, 0x100000], [76, PAGE], [92, 16]])
    b.writeUInt32LE(value, opt + off);
  b.write('.text', sec);
  for (const [off, value] of [[8, PAGE], [12, PAGE], [16, 512], [20, 512], [36, 0xe0000020]])
    b.writeUInt32LE(value, sec + off);
  b[512] = 0xc3;
  return b;
}

async function boot(wasm) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const imports = createHostImports(ctx), exits = [];
  Object.assign(imports.host, { memory, log() {}, log_i32() {},
    exit(code) { exits.push(code >>> 0); },
    crash_unimplemented(code) { throw new Error(`unexpected API ${code}`); } });
  const e = (await WebAssembly.instantiate(wasm, imports)).instance.exports;
  ctx.exports = e;
  const pe = fixturePE();
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length) >= 0, 'generated PE loads');
  e.set_api_log(0);
  assert.strictEqual(e.get_smc_same_block(), 0, 'same-block SMC checkpoints are opt-in (default off)');
  e.set_smc_same_block(1); // opt-in (04-cache $smc_same_block); every case here needs it
  return { e, memory, exits };
}

function runCase(machine, o) {
  const { e, memory, exits } = machine;
  const label = Object.entries(o).map(([k, v]) => `${k}=${v}`).join('/');
  const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
  const wa = a => e.guest_to_wasm(a) >>> 0;
  const put = (a, b) => bytes.set(b, wa(a));
  const poke = (a, n) => view.setUint32(wa(a), n >>> 0, true);
  const peek = a => view.getUint32(wa(a), true);
  const alloc = n => { const a = e.guest_alloc(n) >>> 0; assert(a); return a; };
  const area = alloc(2 * PAGE), code = (area + PAGE - 1) & -PAGE;
  const data = alloc(PAGE), stack = alloc(PAGE) + 3000;
  const rep = o.kind === 'movs' || o.kind === 'stos';
  const width = o.width;
  const oldValue = o.shape === 'opcode' ? 0x43 : ['length', 'flags'].includes(o.shape) ? 0x90909090
    : rep || width === 4 ? 0x11111111 : width === 2 ? 0x1111 : 0x11;
  const count = o.wide ? 608 / width : rep && o.shape !== 'opcode' ? 4 / width : 1, total = count * width;
  const back = o.df ? total - width : 0;
  // INC EBX before the writer and INC EDX afterwards expose any block-head
  // rewind or duplicated continuation. EBP is a one-trip uop loop counter.
  const prefix = [0x68, ...le32(0x202 | (o.df ? 0x400 : 0)), 0x9d, 0x43];
  if (o.state) prefix.push(0x89, 0xc1); // mov ecx,eax must survive an SMC exit
  if (o.shape === 'flags') prefix.push(0x31, 0xc9); // xor ecx,ecx: ZF/PF live at exit
  const writer = rep ? [...(width === 2 ? [0x66] : []), 0xf3,
    o.kind === 'movs' ? (width === 1 ? 0xa4 : 0xa5) : (width === 1 ? 0xaa : 0xab)]
    : o.kind === 'rmw' ? [0x83, 0x07, 0x11] // add dword [edi],0x11
      : o.kind === 'sib' ? [0x89, 0x04, 0x0f] // mov [edi+ecx],eax
        : [...(width === 2 ? [0x66] : []), width === 1 ? 0x88 : 0x89, 0x07];
  const uop = o.engine === 'uop';
  if (uop) prefix.push(0xe9, ...le32(0));
  const writerPC = code + prefix.length;
  const loop = uop ? [0x4d, 0x75, (-(writer.length + 3)) & 255] : [];
  const transfer = o.scope === 'other-block' ? [0xe9, ...le32(0)] : [];
  const targetPC = writerPC + writer.length + loop.length + transfer.length + (o.wide ? 600 : 0);
  const immAt = targetPC + (o.shape === 'immediate' ? 1 : 0);
  const target = o.shape === 'opcode' ? [0x43] : ['length', 'flags'].includes(o.shape)
    ? [0x90, 0x90, 0x90, 0x90] : [0xb8, ...le32(oldValue)];
  // A width-sized patch replaces only the low part of the immediate.
  const program = [...prefix, ...writer, ...loop, ...transfer,
    ...(o.wide ? Array(600).fill(0x90) : []), ...target,
    ...(o.wide ? [0x90, 0x90, 0x90] : []), 0x42, 0x9c, 0x8f, 0x05, ...le32(data + 64), 0xc3];
  put(code, program);
  const dst = o.wide ? targetPC - 600 : o.scope === 'non-overlap' ? code + 0x800 : immAt;
  e.set_block_exec(0); e.set_uop(0); e.set_sib_fusion(o.sibFusion);
  e.set_fault_unmapped(o.faultMode);
  const block = o.engine.startsWith('block');
  if (block) {
    e.set_block_exec(1); e.set_block_exec_min_uops(1);
    e.set_block_exec_leaf(o.engine === 'block-general' ? 0 : 1);
  }
  if (uop) {
    e.set_uop(1);
    const program = e.uop_compile(writerPC);
    assert(program, `${label}: genuine one-trip writer loop compiles`);
    e.uop_install(writerPC, program);
  }
  const repeats = o.cached ? 3 : 1;
  for (let n = 0; n < repeats; n++) {
    const byte = 0x22 + n * 0x11;
    const newValue = o.wide && o.kind === 'stos' ? 0x90909090 : o.shape === 'opcode' ? 0x40 : o.shape === 'length' ? 0x9090c031 : o.shape === 'flags' ? 0x9090589c
      : rep || width === 4 ? byte * 0x01010101
      : width === 2 ? byte * 0x0101 : byte;
    const expected = o.shape === 'opcode' ? 0x41 : o.shape === 'length' ? 0 : o.shape === 'flags' ? 0x246
      : o.scope === 'non-overlap' ? oldValue
      : o.kind === 'rmw' ? oldValue + 0x11 : newValue;
    // Host initialization does not invalidate warmed code. Restore exactly
    // the original immediate before each writer, then demand fresh execution.
    put(targetPC, target); poke(stack, 0);
    if (o.wide) put(data, [...Array(600).fill(0x90), 0xb8, ...le32(newValue), 0x90, 0x90, 0x90]);
    else poke(data, newValue);
    poke(o.scope === 'non-overlap' ? dst : data + 32, oldValue);
    e.set_eax(newValue); e.set_ebx(0); e.set_edx(0); e.set_ebp(1);
    e.set_ecx(o.kind === 'sib' ? 0 : rep ? count : 0);
    e.set_esi(data + back); e.set_edi(dst + back); e.set_eip(code); e.set_esp(stack);
    exits.length = 0;
    const before = { hits: e.get_cache_inval_hits(), stores: e.get_cache_stores(),
      uop: e.uop_stats(4), deopts: e.uop_bulk_stats(1) };
    const blockRuns = () => e.get_block_exec_runs() + e.get_block_exec_leaf_runs()
      + e.get_block_exec_leaf_fb_runs();
    let writerObserved = false;
    for (let slice = 0; slice < 32 && (e.get_eip() >>> 0); slice++) {
      const runs = blockRuns();
      e.run(block && !writerObserved ? 1 : o.quantum);
      if (block && !writerObserved && bytes[wa(dst)] !== (oldValue & 255)) {
        writerObserved = true;
        assert(blockRuns() > runs, `${label}: block executor actually ran the writing block`);
      }
    }
    if (block) assert(writerObserved, `${label}: writing block observed`);
    assert.strictEqual(e.get_eip() >>> 0, 0, `${label}: bounded return`);
    assert(e.get_steps() <= 1000, `${label}: executor settles its parked step counter`);
    assert.deepStrictEqual(exits, [], `${label}: no unhandled fault`);
    assert.strictEqual(e.get_eax() >>> 0, expected >>> 0,
      `${label}: execute modified immediate, iteration ${n}`);
    if (o.state) assert.strictEqual(e.get_ecx() >>> 0, newValue >>> 0, `${label}: pre-store register survives exit`);
    assert.strictEqual(e.get_ebx(), 1, `${label}: pre-store instruction exactly once`);
    assert.strictEqual(e.get_edx(), 1, `${label}: post-store instruction exactly once`);
    assert.strictEqual(e.get_esp() >>> 0, stack + 4, `${label}: RET exactly once`);
    assert.strictEqual(peek(data + 64), 0x202 | (o.df ? 0x400 : 0), `${label}: flags after INC EDX`);
    if (rep) {
      assert.strictEqual(e.get_ecx(), 0, `${label}: REP complete`);
      const step = o.df ? -total : total;
      assert.strictEqual(e.get_edi() >>> 0, dst + back + step, `${label}: REP destination progress`);
      assert.strictEqual(e.get_esi() >>> 0, data + back + (o.kind === 'movs' ? step : 0),
        `${label}: REP source progress`);
    }
    if (o.scope === 'non-overlap') {
      assert.strictEqual(e.get_cache_inval_hits(), before.hits, `${label}: no code retired`);
      if (n) assert.strictEqual(e.get_cache_stores(), before.stores, `${label}: cached control stays decoded`);
    }
    if (uop && n === 0) {
      assert(e.uop_stats(4) > before.uop, `${label}: installed uop program actually entered`);
      if (rep && o.scope !== 'non-overlap')
        assert(e.uop_bulk_stats(1) > before.deopts, `${label}: code-page COPY/FILL deoptimized`);
    }
    const expectedBytes = o.scope === 'non-overlap' ? oldValue
      : o.kind === 'rmw' ? oldValue + 0x11 : newValue;
    if (o.shape === 'opcode') assert.strictEqual(bytes[wa(immAt)], expectedBytes, `${label}: actual opcode`);
    else assert.strictEqual(peek(immAt), expectedBytes >>> 0, `${label}: actual guest bytes`);
  }
  console.log(`PASS ${label}`);
}

function runScalarFusion(machine, kind, engine) {
  const { e, memory } = machine, bytes = new Uint8Array(memory.buffer);
  const view = new DataView(memory.buffer), wa = a => e.guest_to_wasm(a) >>> 0;
  const area = e.guest_alloc(8192) >>> 0, code = (area + 4095) & -4096;
  const data = e.guest_alloc(4096) >>> 0, stack = (e.guest_alloc(4096) >>> 0) + 3000;
  const put = (p, b) => bytes.set(b, wa(p));
  const peek = p => view.getUint32(wa(p), true);
  const finish = [0xba, ...le32(0x22222222), 0xc3];
  let program, eax = 0x90909090, edi = 0, esp = stack, handler;
  if (kind === 'span') {
    program = [0, 4, 8, 12].flatMap(d => [0x89, 0x87, ...le32(0x90900000 + d)]);
    program.push(...finish); edi = (code + 6 - 0x90900000) >>> 0; handler = 448;
  } else if (kind === 'unary') {
    // INC changes the following CMP's immediate; the new CMP must see
    // equality, while the stale immediate incorrectly selects the failure.
    program = [0xff, 0x07, 0x81, 0x3f, ...le32(0x11111111), 0x75, 6,
      ...finish, 0xba, ...le32(0x11111111), 0xc3];
    edi = code + 4; handler = 409;
  } else if (kind === 'absolute') {
    // The first store changes the second store's destination operand.
    program = [0xa3, ...le32(code + 6), 0xa3, ...le32(data), ...finish];
    eax = data + 32; handler = 405;
  } else if (kind === 'push') {
    program = [0x50, 0x68, ...le32(0x90909090), 0xbc, ...le32(stack), ...finish];
    esp = code + 5; handler = 472;
  } else {
    assert.strictEqual(kind, 'push-call');
    program = [0x50, 0xe8, ...le32(32 - 6)];
    program.push(...Array(32 - program.length).fill(0x90), 0xbc, ...le32(stack),
      0xba, ...le32(0x11111111), 0xc3);
    program.push(...Array(48 - program.length).fill(0x90), 0xbc, ...le32(stack), ...finish);
    eax = 48 - 6; esp = code + 6; handler = 474;
  }
  put(code, program); view.setUint32(wa(stack), 0, true);
  view.setUint32(wa(data), 0x12345678, true);
  e.set_block_exec(engine === 'threaded' ? 0 : 1); e.set_block_exec_min_uops(1);
  e.set_block_exec_leaf(engine === 'block-general' ? 0 : 1); e.set_uop(0);
  e.set_fault_unmapped(0); e.set_store_span_fusion(1); e.set_stack_fusion(1);
  e.reset_handler_hist(); e.set_handler_hist_enabled(1);
  e.set_eax(eax); e.set_edi(edi); e.set_eip(code); e.set_esp(esp); e.set_edx(0);
  for (let i = 0; i < 32 && e.get_eip(); i++) e.run(1);
  const label = `scalar-fusion/${kind}/${engine}`;
  const hist = new Uint32Array(memory.buffer, e.get_handler_hist_base(), e.get_handler_hist_slots());
  assert.strictEqual(e.get_eip(), 0, `${label}: bounded return`);
  assert.strictEqual(e.get_edx() >>> 0, 0x22222222, `${label}: new instruction semantics`);
  assert.strictEqual(e.get_esp() >>> 0, stack + 4, `${label}: final stack`);
  assert(e.get_steps() <= 1000, `${label}: settled step counter`);
  if (kind === 'absolute') {
    assert.strictEqual(peek(data), 0x12345678, `${label}: stale destination untouched`);
    assert.strictEqual(peek(data + 32), data + 32, `${label}: new destination used`);
    assert.strictEqual(hist[handler], 0, `${label}: static code destination declines fusion`);
  } else {
    assert(hist[handler] > 0, `${label}: actual writing fusion entered`);
    if (kind === 'span') assert.deepStrictEqual([...bytes.slice(wa(code + 12), wa(code + 14))],
      [0x89, 0x87], `${label}: overwritten second store never executes`);
    if (kind === 'push') assert.strictEqual(bytes[wa(code)], 0x50, `${label}: overwritten second PUSH never executes`);
  }
  e.set_handler_hist_enabled(0);
  console.log(`PASS ${label}`);
}

// A writing ALU/Jcc fusion has an instruction boundary inside its handler.
// Rewrite the branch itself, rather than only an instruction after the pair.
function runFusedBranch(machine, { kind, near = false, engine = 'threaded', faultMode = 0 }) {
  const { e, memory } = machine, bytes = new Uint8Array(memory.buffer);
  const view = new DataView(memory.buffer), wa = a => e.guest_to_wasm(a) >>> 0;
  const area = e.guest_alloc(8192) >>> 0, code = (area + 4095) & -4096;
  const stack = (e.guest_alloc(4096) >>> 0) + 3000;
  const branchPC = code + 6;
  const branch = near ? [0x0f, 0x85, ...le32(6)] : [0x75, 6];
  const writer = kind === 'dec' ? [0xfe, 0x0d, ...le32(branchPC)]
    : [0x81, 0x07, ...le32(near ? -0x100 : (0x90909090 - 0x90900a75) >>> 0)];
  // Short ADD replaces the branch and two padding bytes with NOPs. Near
  // ADD and DEC change JNZ to JZ while their result leaves ZF clear.
  const actualBranch = near ? branch : [0x75, kind === 'dec' ? 6 : 10];
  const padding = kind !== 'dec' && !near ? [0x90, 0x90, 0x90, 0x90] : [];
  bytes.set([...writer, ...actualBranch, ...padding, 0xb8, ...le32(0x22222222), 0xc3,
    0xb8, ...le32(0x11111111), 0xc3], wa(code));
  view.setUint32(wa(stack), 0, true);
  e.set_block_exec(engine === 'threaded' ? 0 : 1); e.set_block_exec_min_uops(1);
  e.set_block_exec_leaf(engine === 'block-general' ? 0 : 1); e.set_uop(0);
  e.set_fault_unmapped(faultMode); e.reset_handler_hist(); e.set_handler_hist_enabled(1);
  e.set_edi(branchPC); e.set_eax(0); e.set_eip(code); e.set_esp(stack);
  for (let i = 0; i < 32 && e.get_eip(); i++) e.run(1);
  const label = `fused-branch/${kind}/near=${near}/${engine}/fault=${faultMode}`;
  const hist = new Uint32Array(memory.buffer, e.get_handler_hist_base(), e.get_handler_hist_slots());
  assert(hist[kind === 'dec' ? 393 : 407] > 0, `${label}: actual writing/branch fusion entered`);
  assert.strictEqual(e.get_eip(), 0, `${label}: bounded return`);
  assert.strictEqual(e.get_eax() >>> 0, 0x22222222, `${label}: rewritten branch executes new bytes`);
  assert.strictEqual(e.get_esp() >>> 0, stack + 4, `${label}: RET once`);
  e.set_handler_hist_enabled(0);
  console.log(`PASS ${label}`);
}

// The optional byte-copy fold must retain checkpoints inside the original
// loop, including when its first store changes the very next cursor bump.
function runCopyFold(machine, codeDestination) {
  const { e, memory } = machine, bytes = new Uint8Array(memory.buffer);
  const view = new DataView(memory.buffer), wa = a => e.guest_to_wasm(a) >>> 0;
  const area = e.guest_alloc(8192) >>> 0, code = (area + 4095) & -4096;
  const data = e.guest_alloc(4096) >>> 0, stack = (e.guest_alloc(4096) >>> 0) + 3000;
  bytes.set([0x8a, 0x06, 0x88, 0x07, 0x46, 0x47, 0x49, 0x75, 0xf7, 0xc3], wa(code));
  bytes.fill(0x43, wa(data), wa(data) + 16); // INC EBX replaces INC ESI
  view.setUint32(wa(stack), 0, true);
  e.set_block_exec(0); e.set_uop(0); e.set_fault_unmapped(0);
  e.set_loop_copy_emit(1); e.set_loop_generic_copy_emit(1);
  e.reset_handler_hist(); e.set_handler_hist_enabled(1);
  e.set_eip(code); e.set_esp(stack); e.set_esi(data);
  e.set_edi(codeDestination ? code + 4 : data + 32);
  e.set_ecx(codeDestination ? 1 : 5); e.set_ebx(0);
  const matches = e.get_loop_matched_blocks();
  for (let i = 0; i < 32 && e.get_eip(); i++) e.run(1000);
  const hist = new Uint32Array(memory.buffer, e.get_handler_hist_base(), e.get_handler_hist_slots());
  assert.strictEqual(e.get_eip(), 0, 'copy fold bounded return');
  assert(e.get_loop_matched_blocks() > matches, 'byte-copy fold genuinely installed');
  assert(hist[419] > 0, 'guarded copy handler genuinely entered');
  assert.strictEqual(e.get_ecx(), 0, 'copy count complete');
  assert.strictEqual(e.get_ebx(), codeDestination ? 1 : 0, 'modified next cursor instruction executes');
  assert.strictEqual(e.get_esi() >>> 0, data + (codeDestination ? 0 : 5), 'copy source progress');
  assert.strictEqual(e.get_edi() >>> 0, codeDestination ? code + 5 : data + 37, 'copy destination progress');
  assert.strictEqual(hist[29], codeDestination ? 1 : 0, 'only code destination uses original store stream');
  if (!codeDestination) assert.deepStrictEqual([...bytes.slice(wa(data + 32), wa(data + 37))], Array(5).fill(0x43));
  e.set_handler_hist_enabled(0); e.set_loop_copy_emit(0); e.set_loop_generic_copy_emit(0);
  console.log(`PASS guarded-copy-fold/codeDestination=${codeDestination}`);
}

async function main() {
  const args = process.argv.slice(2);
  const wasmArg = args.find(a => a.startsWith('--wasm='));
  assert(args.every(a => a === '--smoke' || /^--(wasm|kind|engine|fusion)=/.test(a)), 'arguments');
  const wasm = wasmArg ? fs.readFileSync(wasmArg.slice(7)) : compileSrcWasm();
  console.log(`module bytes=${wasm.length} sha256=${crypto.createHash('sha256').update(wasm).digest('hex')}`);
  const machine = await boot(wasm);
  const base = { kind: 'mov', width: 4, df: 0, shape: 'immediate', scope: 'same-block', engine: 'threaded',
    cached: true, faultMode: 0, sibFusion: 1, quantum: 1000 };
  for (const key of ['kind', 'engine']) {
    const a = args.find(a => a.startsWith(`--${key}=`));
    if (a) base[key] = a.slice(key.length + 3);
  }
  const fusion = args.find(a => a.startsWith('--fusion='));
  if (fusion) return runScalarFusion(machine, fusion.slice(9), base.engine);
  runCase(machine, base);
  if (args.includes('--smoke')) return;
  for (const kind of ['mov', 'movs', 'stos']) for (const width of [1, 2, 4])
    for (const scope of ['same-block', 'other-block', 'non-overlap'])
      for (const faultMode of [0, 3, 5]) for (const quantum of [1, 1000])
        runCase(machine, { ...base, kind, width, scope, faultMode, quantum });
  for (const kind of ['movs', 'stos']) for (const width of [1, 2, 4])
    runCase(machine, { ...base, kind, width, df: 1 });
  // A 608-byte COPY/FILL forces whole-page invalidation in both directions.
  for (const kind of ['movs', 'stos']) for (const width of [1, 2, 4]) for (const df of [0, 1])
    runCase(machine, { ...base, kind, width, df, wide: true });
  for (const kind of ['rmw', 'sib']) for (const sibFusion of [0, 1])
    runCase(machine, { ...base, kind, sibFusion });
  for (const shape of ['opcode', 'length']) for (const kind of ['mov', 'movs', 'stos'])
    runCase(machine, { ...base, shape, kind, width: shape === 'opcode' ? 1 : 4 });
  for (const engine of ['threaded', 'block', 'block-general']) {
    runCase(machine, { ...base, engine, state: true });
    runCase(machine, { ...base, engine, shape: 'flags' });
  }
  for (const engine of ['block', 'block-general', 'uop']) for (const kind of ['mov', 'movs', 'stos'])
    for (const scope of ['same-block', 'other-block', 'non-overlap'])
      runCase(machine, { ...base, kind, engine, scope });
  for (const engine of ['threaded', 'block', 'block-general'])
    for (const kind of ['span', 'unary', 'absolute', 'push', 'push-call']) runScalarFusion(machine, kind, engine);
  for (const engine of ['threaded', 'block', 'block-general']) for (const faultMode of [0, 3, 5]) {
    runFusedBranch(machine, { kind: 'add', engine, faultMode });
    runFusedBranch(machine, { kind: 'add', near: true, engine, faultMode });
    runFusedBranch(machine, { kind: 'dec', engine, faultMode });
  }
  runCopyFold(machine, false);
  runCopyFold(machine, true);
  console.log('PASS same-block self-modifying code matrix');
}

if (require.main === module) main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
