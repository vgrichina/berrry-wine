#!/usr/bin/env node
'use strict';

// --fault-null=raise: hand an unmapped guest access to the guest's own __except,
// instead of absorbing it into the NULL sentinel.
//
// The sentinel is what keeps a program that dereferences NULL running at all --
// reads answer 0, writes go nowhere -- and that is the right default, because a
// great many guests probe addresses they know may be unmapped. The cost is that
// a genuine wild pointer surfaces an arbitrary distance from whatever made it.
// Black & White 2 is the worst case measured: 0x9e17d0 walks a circular edge
// list until it returns to the node it started from, so a NULL `next` makes the
// walk read 0 forever, never reach its start, and allocate per visited node
// until the heap refuses 430MB. On real hardware that is an access violation on
// the first iteration.
//
// So the behaviour is a mode, not a change: mode 0 still absorbs, mode 3 raises
// EXCEPTION_ACCESS_VIOLATION at the faulting instruction. This test pins both,
// and pins the thing that is easy to get wrong in between -- the block that
// faulted must be *abandoned*, not resumed. $next parks $ip in $resume_ip when
// its quantum expires and $run honours $resume_ip ahead of $eip, so without
// $eip_redirected the op after the faulting one sends control back into the
// dead block instead of into the handler.
//
// Run: node test/test-fault-null-raise.js

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { createHostImports } = require(path.join(__dirname, '..', 'lib/host-imports'));
const RegionMap = require('../lib/region-map.generated.js');

// An address no mapping covers: above the PE image, below the DIB window, and
// never handed out by VirtualAlloc in a run that makes no calls.
const UNMAPPED = 0x7ff00000;

async function main() {
  const ROOT = path.join(__dirname, '..');
  const WASM_PATH = process.env.WINE_ASSEMBLY_WASM || path.join(ROOT, 'build', 'wine-assembly.wasm');
  const wasmBytes = fs.readFileSync(WASM_PATH);
  const exeBytes = fs.readFileSync(path.join(__dirname, 'binaries', 'notepad.exe'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const h = createHostImports(ctx).host;
  h.memory = memory;
  h.exit = () => {};
  h.log = () => {};
  h.log_i32 = () => {};
  h.crash_unimplemented = () => {};
  // Count the faults the miss path reports, so "mode 3 raised" cannot be
  // confused with "mode 3 never saw the access".
  let faults = 0;
  h.unmapped_trace = () => { faults++; };

  const { instance } = await WebAssembly.instantiate(wasmBytes, { host: h });
  ctx.exports = instance.exports;
  const e = instance.exports;
  const dv = new DataView(e.memory.buffer);
  const mem = new Uint8Array(e.memory.buffer);
  mem.set(exeBytes, e.get_staging());
  e.load_pe(exeBytes.length);

  const imageBase = e.get_image_base();
  const g2w = a => RegionMap.g2w(a, imageBase);
  const le32 = v => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  const put = (addr, bytes) => mem.set(bytes, g2w(addr));
  const poke = (addr, v) => dv.setUint32(g2w(addr), v >>> 0, true);
  const peek = addr => dv.getUint32(g2w(addr), true) >>> 0;

  const SCRATCH = imageBase + 0x2000;   // marker, SEH record, scopetable
  const CODE = imageBase + 0x3000;      // the faulting block
  const FILTER = imageBase + 0x3100;    // __except filter stub
  const BODY = imageBase + 0x3200;      // __except body
  const HANDLER = imageBase + 0x3300;   // the frame's registered handler
  const MARKER = SCRATCH;
  const SEH_REC = SCRATCH + 0x40;
  const SCOPETABLE = SCRATCH + 0x80;
  const STACK_TOP = imageBase + 0xd00000;

  // The faulting block: read an unmapped address, then a store that proves
  // whether execution carried on past the fault.
  //   A1 <abs32>            mov eax, [UNMAPPED]
  //   C7 05 <marker> 07..   mov dword [MARKER], 7
  //   C3                    ret
  put(CODE, [
    0xa1, ...le32(UNMAPPED),
    0xc7, 0x05, ...le32(MARKER), ...le32(7),
    0xc3,
  ]);

  // A filter $raise_exception recognises as the trivial "return
  // EXCEPTION_EXECUTE_HANDLER" stub: mov eax,1 / ret.
  put(FILTER, [0xb8, ...le32(1), 0xc3]);

  // The __except body. It lands with ESP = seh_rec, whose first dword is the
  // end-of-chain marker and is no kind of return address, so the body puts the
  // stack back before returning to the harness's 0 sentinel.
  //   C7 05 <marker> 01..   mov dword [MARKER], 1
  //   BC <stackTop>         mov esp, STACK_TOP
  //   C3                    ret
  put(BODY, [
    0xc7, 0x05, ...le32(MARKER), ...le32(1),
    0xbc, ...le32(STACK_TOP),
    0xc3,
  ]);

  // Any first byte but 0xB8, which would mark it a C++ __ehhandler stub and
  // make the walk skip it for a hardware exception.
  put(HANDLER, [0x55, 0xc3]);

  function arm() {
    // __except_handler3 frame: EBP = seh_rec + 0x10, scopetable at EBP-8,
    // trylevel at EBP-4.
    poke(SEH_REC + 0x00, 0xffffffff);   // next: end of chain
    poke(SEH_REC + 0x04, HANDLER);
    poke(SEH_REC + 0x08, SCOPETABLE);   // EBP-8
    poke(SEH_REC + 0x0c, 0);            // EBP-4: trylevel 0
    poke(SCOPETABLE + 0x00, 0xffffffff); // enclosingLevel
    poke(SCOPETABLE + 0x04, FILTER);
    poke(SCOPETABLE + 0x08, BODY);
    e.set_fs_base(SEH_REC + 0x100);     // FS:[0] holds the chain head
    poke(SEH_REC + 0x100, SEH_REC);
    poke(MARKER, 0);
    e.set_eax(0xcafef00d);
    e.set_esp(STACK_TOP);
    poke(STACK_TOP, 0);                 // return to EIP 0 = clean halt
    e.set_eip(CODE);
  }

  // --- mode 0: the shipping behaviour, unchanged -------------------------
  e.set_fault_unmapped(0);
  arm();
  e.run(100000);
  assert.strictEqual(peek(MARKER), 7,
    'with the sentinel armed the faulting block must run to completion');
  assert.strictEqual(e.get_eax() >>> 0, 0,
    'the sentinel answers an unmapped read with 0');

  // --- mode 3: raise, and let the guest handle it ------------------------
  faults = 0;
  e.set_fault_unmapped(3);
  arm();
  e.run(100000);
  assert.ok(faults > 0, 'mode 3 must still report the fault it raised on');
  assert.strictEqual(peek(MARKER), 1,
    `the guest's own __except body must run (marker=${peek(MARKER)}; `
    + '7 means the faulting block carried on, 0 means nothing handled it)');

  // --- mode 3 stays opt-in ------------------------------------------------
  e.set_fault_unmapped(0);
  arm();
  e.run(100000);
  assert.strictEqual(peek(MARKER), 7,
    'turning the mode back off must restore the sentinel, not leave the raise armed');

  console.log('PASS --fault-null=raise delivers EXCEPTION_ACCESS_VIOLATION to the guest '
    + 'and abandons the faulting block; mode 0 still absorbs it');
}

// Exercise the decoded memory shift as well as its continuation boundary.
// The fixture above is a mapped MSVC scope table with a positive filter, not
// a raw handler returning a guessed disposition. Inspect its selected EIP
// before running the body, so eventual process exit cannot masquerade as SEH.
async function memoryShifts() {
  const { watxSourceClosure, compileClosure } = require('../tools/watx-closure');
  const closure = watxSourceClosure();
  const extra = `
    (func (export "sf_alloc") (param $a i32) (result i32)
      (local $sp i32)
      (local.set $sp (i32.load offset=16 (global.get $reg_base)))
      (call $handle_VirtualAlloc (local.get $a) (i32.const 4096)
        (i32.const 0x3000) (i32.const 4) (i32.const 0) (i32.const 0))
      (i32.store offset=16 (global.get $reg_base) (local.get $sp))
      (i32.load (global.get $reg_base)))
    (func (export "sf_state") (param $n i32) (result i32)
      (if (i32.eqz (local.get $n)) (then (return (global.get $resume_ip))))
      (if (i32.eq (local.get $n) (i32.const 1)) (then (return (global.get $eip_redirected))))
      (global.get $steps))
    (func (export "sf_shift") (param $thread i32) (param $info i32)
      (i32.store (local.get $thread) (i32.const 0))
      (i32.store offset=4 (local.get $thread) (local.get $info))
      (global.set $ip (local.get $thread))
      (global.set $resume_ip (i32.const 0))
      (global.set $eip_redirected (i32.const 0))
      (global.set $steps (i32.const 0))
      (call $th_shift_m32_ro (i32.const 0)))
  `;
  const exports = closure.vfs.get('13-exports.wat') + extra;
  for (const key of ['13-exports.wat', 'src/13-exports.wat', './13-exports.wat'])
    closure.vfs.set(key, exports);
  const compiled = compileClosure(closure, { tailCalls: true });
  assert(compiled.success, compiled.error || compiled.message);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer };
  const h = createHostImports(ctx).host;
  let faults = [], exits = [];
  Object.assign(h, { memory, log() {}, log_i32() {},
    exit(code) { exits.push(code >>> 0); },
    unmapped_trace(addr, ip) { faults.push([addr >>> 0, ip >>> 0]); } });
  const { instance } = await WebAssembly.instantiate(compiled.wasmBinary, { host: h });
  const e = ctx.exports = instance.exports;
  const bytes = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const pe = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  bytes.set(pe, e.get_staging()); assert(e.load_pe(pe.length));
  const wa = a => e.guest_to_wasm(a) >>> 0;
  // Re-arm through guest stores so each changed opcode retires old decoding.
  const put = (a, data) => data.forEach((v, i) => e.guest_write8(a + i, v));
  const poke = (a, v) => dv.setUint32(wa(a), v >>> 0, true);
  const peek = a => dv.getUint32(wa(a), true);
  const le = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255];
  const base = e.get_image_base(), code = base + 0x3000, filter = base + 0x3100;
  const body = base + 0x3200, handler = base + 0x3300;
  const marker = base + 0x2000, frame = marker + 64, scope = marker + 128, fsSlot = marker + 256;
  const sp = base + 0xd00000, thread = wa(e.guest_alloc(16));
  const lazyNames = ['flag_op', 'flag_a', 'flag_b', 'flag_res', 'flag_sign_shift'];
  const lazy = () => lazyNames.map(n => e['get_' + n]() >>> 0);
  const seed = () => { e.test_shift(32, 4, 0x81234567, 0, 1, 0x80000001); return lazy(); };
  const u32 = new Uint32Array(memory.buffer), u64 = new BigUint64Array(memory.buffer);
  const generation = a => {
    const p = wa(a), table = Atomics.load(u32, (e.page_watch_root() >>> 2) + (p >>> 22));
    return Atomics.load(u64, (table + ((p >>> 12) & 1023) * 16 + 8) >>> 3);
  };
  put(filter, [0xb8, ...le(1), 0xc3]);
  put(handler, [0x55, 0xc3]);
  put(body, [0xc7, 5, ...le(marker), ...le(1), 0xbc, ...le(sp), 0xc3]);
  function arm(address, type, count, cl, raw = false, handled = true) {
    e.set_fault_unmapped(0); e.set_yield_state(0, 0);
    // C1 /type [eax],imm8 or D3 /type [eax],CL, followed by a forbidden store.
    const shift = count === 255 ? [0xd3, (type << 3), 0x90] : [0xc1, (type << 3), count];
    put(code, [0xb8, ...le(address), ...shift, 0xc7, 5, ...le(marker), ...le(7), 0xc3]);
    poke(frame, -1); poke(frame + 4, handler); poke(frame + 8, raw ? 0 : scope);
    poke(frame + 12, raw ? -1 : 0);
    poke(scope, -1); poke(scope + 4, filter); poke(scope + 8, body);
    poke(fsSlot, handled ? frame : -1); e.set_fs_base(fsSlot);
    poke(marker, 0); poke(sp, 0); e.set_esp(sp); e.set_ebp(0x12345678);
    e.set_eax(address); e.set_ecx(cl); e.set_eip(code);
    e.set_edx(0x12345671); e.set_ebx(0x12345672);
    e.set_esi(0x12345673); e.set_edi(0x12345674);
    faults = []; exits = [];
    return seed();
  }
  let faultCases = 0;
  // End-only misses and start-page misses must each abandon the entire read,
  // including the accessor's byte-gather fallback and the shift's store half.
  const sparse = 0x30000000;
  assert.strictEqual(e.sf_alloc(sparse) >>> 0, sparse);
  assert(e.sf_alloc(0x28000000)); // interleave physical backing
  assert.strictEqual(e.sf_alloc(sparse + 4096) >>> 0, sparse + 4096);
  assert.notStrictEqual(wa(sparse) + 4096, wa(sparse + 4096));
  assert(e.page_watch_acquire(wa(sparse + 8191), 1));
  for (const address of [UNMAPPED, UNMAPPED + 4093, UNMAPPED + 4094, UNMAPPED + 4095,
    sparse + 8189, sparse + 8190, sparse + 8191]) {
    for (const type of [0, 1, 2, 3, 4, 5, 6, 7]) {
      for (const [count, cl] of [[0, 19], [32, 19], [1, 19], [255, 32], [255, 1]]) {
        const before = arm(address, type, count, cl);
        // A mapped prefix must never be modified after the read faults.
        if (address < UNMAPPED) bytes[wa(address)] = 0x81;
        const watched = generation(sparse + 8191), hits = e.get_cache_inval_hits();
        e.set_fault_unmapped(3); e.run(1);
        assert.strictEqual(faults.length, 1, 'one fault per abandoned instruction');
        assert.strictEqual(faults[0][1], code, 'fault remains attributed to the original block');
        assert.strictEqual(e.get_eip() >>> 0, body, 'positive MSVC filter selects body');
        assert.strictEqual(e.get_esp() >>> 0, frame);
        assert.strictEqual(e.get_ebp() >>> 0, frame + 16);
        assert.strictEqual(peek(fsSlot), 0xffffffff, 'frame unwound exactly once');
        assert.strictEqual(peek(frame + 12), 0xffffffff, 'scope left exactly once');
        assert.strictEqual(e.sf_state(0), 0, 'no abandoned block parked for resume');
        assert.strictEqual(e.sf_state(2), 0);
        assert.deepStrictEqual(lazy(), before, 'fault precedes arithmetic, even for nonzero counts');
        assert.strictEqual(e.get_eax() >>> 0, address);
        assert.strictEqual(e.get_ecx() >>> 0, cl);
        assert.deepStrictEqual([e.get_edx(), e.get_ebx(), e.get_esi(), e.get_edi()],
          [0x12345671, 0x12345672, 0x12345673, 0x12345674]);
        assert.strictEqual(peek(marker), 0, 'neither following store nor handler body ran yet');
        assert.deepStrictEqual(exits, []);
        assert.strictEqual(generation(sparse + 8191), watched, 'faulting read issues no write notification');
        assert.strictEqual(e.get_cache_inval_hits(), hits, 'faulting read retires no code');
        if (address < UNMAPPED) assert.strictEqual(bytes[wa(address)], 0x81);
        e.run(100); assert.strictEqual(peek(marker), 1);
        assert.strictEqual(faults.length, 1); assert.strictEqual(e.get_eip(), 0);
        assert.strictEqual(e.get_yield_reason(), 0);
        assert.deepStrictEqual(lazy(), before);
        faultCases++;
      }
    }
  }
  e.page_watch_release(wa(sparse + 8191), 1);
  for (const address of [UNMAPPED, UNMAPPED + 4093]) for (const count of [0, 1]) {
    arm(address, 5, count, 0);
    e.test_shift(32, 5, 0, count, 1, 0x80000001);
    const want = lazy(), flags = e.test_shift_flags(); seed();
    e.run(100);
    assert.strictEqual(peek(marker), 7, 'mode 0 still completes through the sentinel');
    assert.deepStrictEqual(lazy(), want); assert.strictEqual(e.test_shift_flags(), flags);
    assert.deepStrictEqual(faults, []); assert.deepStrictEqual(exits, []);
  }
  // A real raw frame handler can instead change CONTEXT.Eip and return
  // ExceptionContinueExecution (0). Resume at the following instruction with
  // the original CONTEXT registers/flags, without replaying the failed shift.
  put(handler, [0xc7, 5, ...le(marker), ...le(1),
    0x8b, 0x4c, 0x24, 0x0c, 0xc7, 0x81, ...le(0xb8), ...le(code + 8),
    0x31, 0xc0, 0xc3]);
  for (const count of [0, 1]) {
    arm(UNMAPPED, 5, count, 0, true);
    const flags = e.test_shift_flags();
    e.set_fault_unmapped(3); e.run(1);
    assert.strictEqual(e.get_eip() >>> 0, handler);
    assert.strictEqual(faults.length, 1);
    e.run(100); assert.strictEqual(peek(marker), 7);
    assert.strictEqual(e.get_eax() >>> 0, UNMAPPED);
    assert.strictEqual(e.test_shift_flags(), flags);
    assert.strictEqual(faults.length, 1); assert.deepStrictEqual(exits, []);
  }
  // Successful stores retain exact page-watch notifications and code-cache
  // retirement, including identity writes. Compare with the existing scalar
  // store path; compare arithmetic and all lazy fields with do_shift32.
  let mappedCases = 0;
  const watchDeltas = new Set();
  for (const address of [base + 0x2800, sparse + 17, sparse + 4092,
    sparse + 4093, sparse + 4094, sparse + 4095]) {
    const pages = [...new Set([address & -4096, (address + 3) & -4096])];
    pages.forEach(a => assert(e.page_watch_acquire(wa(a), 1)));
    for (let type = 0; type < 8; type++) for (const [count, cl] of
      [[0, 19], [32, 19], [64, 19], [1, 19], [31, 19], [255, 32], [255, 1]]) {
      e.set_fault_unmapped(0);
      const before = seed(), flags = e.test_shift_flags();
      const want = e.test_shift(32, type, 0x89abcdef, count === 255 ? cl : count, 1, 0x80000001) >>> 0;
      const wantLazy = lazy(), wantFlags = e.test_shift_flags();
      e.guest_write32(address, 0x89abcdef);
      const start = pages.map(generation);
      e.guest_write32(address, want);
      const deltas = pages.map((a, i) => generation(a) - start[i]);
      watchDeltas.add(deltas.join(','));
      e.guest_write32(address, 0x89abcdef); seed();
      e.set_eax(address); e.set_ecx(cl); e.set_eip(code);
      const initial = pages.map(generation);
      e.sf_shift(thread, (type << 8) | count);
      assert.strictEqual(e.guest_read32(address) >>> 0, want);
      assert.deepStrictEqual(lazy(), wantLazy); assert.strictEqual(e.test_shift_flags(), wantFlags);
      assert.deepStrictEqual(pages.map((a, i) => generation(a) - initial[i]), deltas);
      assert(deltas.every(n => n > 0n));
      assert.strictEqual(e.sf_state(0), thread + 8);
      assert.strictEqual(e.sf_state(1), 0); assert.strictEqual(e.sf_state(2), 0);
      if (((count === 255 ? cl : count) & 31) === 0) {
        assert.deepStrictEqual(lazy(), before); assert.strictEqual(e.test_shift_flags(), flags);
      }
      mappedCases++;
    }
    pages.forEach(a => e.page_watch_release(wa(a), 1));
  }
  for (const target of [base + 0x5000, sparse + 4096]) for (const count of [0, 32, 1, 255]) {
    e.set_fault_unmapped(0); put(target, [0x90, 0x90, 0x90, 0xc3]);
    poke(sp, 0); e.set_esp(sp); e.set_eip(target); e.run(100);
    const hits = e.get_cache_inval_hits();
    e.set_eax(target); e.set_ecx(32); e.sf_shift(thread, (5 << 8) | count);
    assert.strictEqual(e.get_cache_inval_hits() - hits, 1, 'retire one actually decoded block');
  }
  // No SEH frame: one read fault terminates, with no synthetic write fault or
  // flag update and no executable continuation left behind.
  for (const address of [UNMAPPED, UNMAPPED + 4093, sparse + 8191]) {
    const before = arm(address, 4, 1, 0, false, false);
    e.set_fault_unmapped(3); e.run(100);
    assert.strictEqual(faults.length, 1); assert.strictEqual(exits.length, 1);
    assert.strictEqual(e.get_eip(), 0); assert.strictEqual(e.get_yield_reason(), 2);
    assert.strictEqual(e.sf_state(0), 0); assert.deepStrictEqual(lazy(), before);
    assert.strictEqual(peek(marker), 0);
  }
  console.log(`PASS decoded shifts: ${faultCases} single-fault MSVC handler entries, raw CONTEXT continuation, `
    + `${mappedCases} direct/sparse/crosspage arithmetic/flags/exact watch deltas (${[...watchDeltas]}), `
    + 'eight exact direct/sparse code retirements, single-fault termination');
}

main().then(memoryShifts).catch(err => { console.error(err); process.exit(1); });
