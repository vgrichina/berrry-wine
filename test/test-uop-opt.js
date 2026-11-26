#!/usr/bin/env node
'use strict';

// --uop-opt=MASK (07d $uop_opt, docs/design/uop-optimizer-pipeline.md).
//
// 1. Every arm -- each pass alone with its prerequisites, and all of them --
//    over test-uop-compiler.js's cases under both clocks: every program must
//    match threaded code exactly (registers, memory, flags, the batch stop of
//    every 37-block batch, i.e. clock charging at budget cuts and the flags
//    each cut materialises), and the opt-* cases must move the ledger
//    counter of their pass.
// 2. In one instance with test-only exports: what kills or drops a program
//    that assumed something -- VirtualProtect and $guest_page_clear_range on
//    a folded dword, a guest store to a folded page (never folded again), a
//    LOCK_MODE flip under a plain-RMW LOCK, an fs_base change under an FS:
//    program, and another instance's write to a folded dword -- each falling
//    back to threaded code with the same result.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ARMS = [0, 0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80, 0xC0, 0x140, 0x1FF, 0x240, 0x3FF, 0x640, 0x7FF, 0x840, 0xFFF, 0x1000, 0x1040, 0x4010, 0x7FFF];

const extraWat = String.raw`
  (func (export "test_vprotect")
      (param $address i32) (param $size i32) (param $protect i32) (param $old_out i32) (result i32)
    (call $handle_VirtualProtect
      (local.get $address) (local.get $size) (local.get $protect)
      (local.get $old_out) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_page_clear") (param $address i32) (param $size i32)
    (call $guest_page_clear_range (local.get $address) (local.get $size)))
  ;; what another instance's $invalidate_code_range does on a write: no
  ;; ranges of its own to scan, only the shared fold epoch (07d)
  (func (export "test_fold_hit") (param $address i32) (param $len i32)
    (call $uop_fold_hit (local.get $address) (local.get $len)))
`;

function armsPass() {
  let fails = 0;
  // UOP_OPT_ARMS=0x10,0x4010: those arms alone
  const arms = process.env.UOP_OPT_ARMS ? process.env.UOP_OPT_ARMS.split(',').map(Number) : ARMS;
  for (const m of arms) {
    const mask = '0x' + m.toString(16);
    const r = spawnSync(process.execPath, [path.join(__dirname, 'test-uop-compiler.js')],
      { env: { ...process.env, UOP_OPT: mask }, encoding: 'utf8', timeout: 300000 });
    const lines = (r.stdout || '').split('\n');
    const bad = lines.filter((l) => / FAIL/.test(l));
    const ok = r.status === 0 && lines.includes('PASS');
    console.log(`arm ${mask.padEnd(6)} ${ok ? 'ok' : 'FAIL'}${bad.length ? '\n  ' + bad.slice(0, 6).join('\n  ') : ''}` +
      (ok ? '' : `\n  ${(r.stderr || '').split('\n').slice(0, 4).join('\n  ')}`));
    if (!ok) fails++;
  }
  return fails;
}

// rel8 loops, hand-assembled: `body; dec ecx; jnz l; ret`
function loop(body) {
  const b = [].concat(...body, 0x49);
  const rel = -(b.length + 2);
  return Uint8Array.from([...b, 0x75, rel & 0xFF, 0xC3]);
}
const d32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];

async function invalidation() {
  const { compileSrcWasm } = require('./compile-src');
  const wasm = compileSrcWasm((filename, source) =>
    filename === '13-exports.wat' ? `${source}\n${extraWat}\n` : source);
  const tmp = path.join(os.tmpdir(), `uop-opt-test-${process.pid}.wasm`);
  fs.writeFileSync(tmp, wasm);
  let bench;
  try {
    process.env.STACK_BENCH_WASM = tmp;
    bench = require(path.join(ROOT, 'tools', 'bench-loops.js'));
    var inst = await bench.newInstance(tmp);
  } finally { fs.unlinkSync(tmp); }
  const { e, mem, g2w, imageBase } = inst;
  const a = bench.layout(imageBase, 0x20000);
  const dv = () => new DataView(e.memory.buffer);
  let slot = 0;
  const fresh = (bytes) => { const at = a.code + 0x1000 * slot++; mem.set(bytes, g2w(at)); return at; };
  const fill = () => { for (let k = 0; k < 0x20000; k += 4) dv().setUint32(g2w(a.buf + k), (k * 0x9E3779B1) >>> 0, true); };
  const out = () => require('crypto').createHash('sha256').update(new Uint8Array(e.memory.buffer, g2w(a.buf), 0x20000)).digest('hex');
  const regs = (r) => { for (const [k, v] of Object.entries(r)) e['set_' + k](v >>> 0); };
  const run = (at, r) => { regs(r); assert(bench.runToCompletion(e, at, a.stackTop), 'loop returned'); return out() + ':' + e.get_eax(); };
  // the assumption block after the window slots, when nwin's top bit says
  // there is one (07d $uop_stamp_at); +0 the stamp, +4 the fs_base
  const stampAt = (pc) => {
    const n = dv().getUint32(pc + 8, true);
    return (n & 0x80000000) ? dv().getUint32(pc + 12, true) + (n & 0xFFFF) * 16 : 0;
  };
  const stamp = (pc) => { const b = stampAt(pc); return b ? dv().getUint32(b, true) : 0; };
  const st = (k) => e.uop_opt_stat(k) >>> 0;
  const R = { ecx: 64, esi: a.buf, edi: a.buf + 0x10000, eax: 0 };
  let n = 0;
  const ok = (msg) => { n++; console.log(`  ok  ${msg}`); };

  e.set_uop(1);
  e.set_uop_opt(0x1FF);
  const P3 = imageBase + 0x3000, P4 = imageBase + 0x4000, DATA = imageBase + 0x5000;
  const foldLoop = (addr) => loop([[0x8B, 0x05, ...d32(addr)], [0x01, 0x07], [0x83, 0xC7, 0x04]]);
  const compiled = (bytes) => { const at = fresh(bytes); const pc = e.uop_compile(at) >>> 0; assert(pc, 'compiled'); e.uop_install(at, pc); return { at, pc }; };

  // a writable section's dword is never folded
  { const f0 = st(10); const { pc } = compiled(foldLoop(DATA)); assert.strictEqual(stamp(pc) & 4, 0); assert.strictEqual(st(10), f0); ok('.data (IMAGE_SCN_MEM_WRITE) dword not folded'); }

  // VirtualProtect: elsewhere leaves the program, over the folded dword kills it
  {
    const { pc } = compiled(foldLoop(P3));
    assert.strictEqual(stamp(pc) & 4, 4, 'folded program carries stamp 4');
    const k0 = e.uop_stats(3);
    e.test_vprotect(DATA, 0x1000, 0x04, a.buf);
    assert.notStrictEqual(dv().getUint32(pc, true), 0, 'unrelated VirtualProtect left the program');
    assert.strictEqual(e.uop_stats(3), k0);
    const rv = e.test_vprotect(P3, 4, 0x04, a.buf);
    assert.notStrictEqual(rv, 0, 'VirtualProtect on .text succeeds');
    assert.strictEqual(dv().getUint32(pc, true), 0, 'VirtualProtect over a folded dword kills the program');
    assert.strictEqual(e.uop_stats(3), k0 + 1);
    ok('VirtualProtect kills only the program that folded the range');
  }

  // $guest_page_clear_range likewise
  {
    const { pc } = compiled(foldLoop(P4));
    assert.strictEqual(stamp(pc) & 4, 4);
    e.test_page_clear(DATA, 0x1000);
    assert.notStrictEqual(dv().getUint32(pc, true), 0);
    e.test_page_clear(P4, 0x1000);
    assert.strictEqual(dv().getUint32(pc, true), 0, 'page release over a folded dword kills the program');
    ok('$guest_page_clear_range kills the program that folded the range');
  }

  // a guest store to a folded page: the program dies, the value is seen,
  // and the page is not folded again ($uop_fold_written)
  {
    const P = imageBase + 0x1800;   // page 0x401000, its own dword
    dv().setUint32(g2w(P), 7, true);
    const { at, pc } = compiled(foldLoop(P));
    assert.strictEqual(stamp(pc) & 4, 4);
    const poke = fresh(Uint8Array.from([0xA3, ...d32(P), 0xC3]));   // mov [P], eax ; ret
    regs({ eax: 11 }); assert(bench.runToCompletion(e, poke, a.stackTop));
    assert.strictEqual(dv().getUint32(pc, true), 0, 'the store killed the folded program');
    fill(); const got = run(at, R);
    e.set_uop(0); fill(); const want = run(fresh(foldLoop(P)), R); e.set_uop(1);
    assert.strictEqual(got, want, 'the loop sees the stored value');
    const again = e.uop_compile(fresh(foldLoop(P))) >>> 0;
    assert(again && (stamp(again) & 4) === 0, 'a written page is not folded again');
    ok('a guest store kills the fold and its page stays unfolded');
  }

  // LOCK_MODE flips after a plain-RMW LOCK program compiled: stamp 1 drops it
  {
    const lockLoop = loop([[0x8B, 0x07], [0xF0, 0x01, 0x06], [0x83, 0xC6, 0x04], [0x83, 0xC7, 0x04]]);
    fill(); e.set_uop(0); const want = run(fresh(lockLoop), R); e.set_uop(1);
    const { at, pc } = compiled(lockLoop);
    assert.strictEqual(stamp(pc) & 1, 1);
    const s0 = st(0);
    e.set_lock_atomic_mode(1);
    fill(); const got = run(at, R);
    e.set_lock_atomic_mode(0);
    assert.strictEqual(got, want);
    assert(st(0) > s0, 'the entry saw the stamp fail');
    ok('LOCK_MODE flip drops the plain-RMW program; same result');
  }

  // fs_base changes after an FS: program compiled: stamp 2 drops it
  {
    const fs0 = e.get_fs_base() >>> 0;
    const fsLoop = loop([[0x64, 0x8B, 0x06], [0x89, 0x07], [0x83, 0xC6, 0x04], [0x83, 0xC7, 0x04]]);
    // the reference first: set_uop flushes every program
    e.set_fs_base(0x40);
    e.set_uop(0); fill(); const want = run(fresh(fsLoop), R); e.set_uop(1);
    e.set_fs_base(0);
    const { at, pc } = compiled(fsLoop);
    assert.strictEqual(stamp(pc) & 2, 2);
    assert.strictEqual(dv().getUint32(stampAt(pc) + 4, true), 0, 'the program records the fs_base it was compiled under');
    e.set_fs_base(0x40);
    const s0 = st(0);
    fill(); const got = run(at, R);
    e.set_fs_base(fs0);
    assert.strictEqual(got, want);
    assert(st(0) > s0);
    ok('fs_base change drops the FS: program; same result');
  }

  // another instance writes a folded dword: it has none of this instance's
  // ranges, so only the shared fold epoch can reach the program
  {
    const P = imageBase + 0x2800, Q = imageBase + 0x6800;
    // the reference first: set_uop flushes every program
    dv().setUint32(g2w(P), 9, true);
    e.set_uop(0); fill(); const want = run(fresh(foldLoop(P)), R); e.set_uop(1);
    dv().setUint32(g2w(P), 3, true);
    const { at, pc } = compiled(foldLoop(P));
    assert.strictEqual(stamp(pc) & 4, 4);
    const other = compiled(foldLoop(imageBase + 0x7800));
    e.test_fold_hit(Q, 4);   // a page no fold read: nothing drops
    let s0 = st(0);
    fill(); run(other.at, R);
    assert.strictEqual(st(0), s0, 'a write to an unfolded page drops nothing');
    dv().setUint32(g2w(P), 9, true);
    e.test_fold_hit(P, 4);
    s0 = st(0);
    fill(); const got = run(at, R);
    assert.strictEqual(got, want, 'the loop sees the other instance\'s value');
    assert(st(0) > s0, 'the epoch dropped the folded program');
    const again = e.uop_compile(fresh(foldLoop(imageBase + 0x8800))) >>> 0;
    assert(again && (stamp(again) & 4) === 4, 'F2 still folds other pages with two instances');
    ok('another instance\'s write drops folded programs through the shared epoch');
  }
  // S1: a loop loading through EBX, which it never writes. Entered with
  // EBX at one read-only record it profiles, compiles a variant knowing
  // EBX (the byte compare decided, the loads folded) and enters it while
  // EBX holds that value; any other EBX runs the generic program.
  {
    e.set_uop_opt(0x3FF);
    const P = imageBase + 0x7A00, Q = imageBase + 0x8A00;
    dv().setUint32(g2w(P), 0x11, true); dv().setUint32(g2w(P + 4), 7, true);
    dv().setUint32(g2w(Q), 0x22, true); dv().setUint32(g2w(Q + 4), 3, true);
    const body = loop([[0x8B, 0x03], [0x31, 0xD2], [0x8A, 0x53, 0x04], [0x80, 0xFA, 0x07], [0x75, 0x02],
      [0x01, 0x07], [0x83, 0xC7, 0x04]]);
    const RP = { ecx: 4, ebx: P, edi: a.buf, eax: 0, edx: 0 }, RQ = { ...RP, ebx: Q };
    e.set_uop(0);
    fill(); const wantP = run(fresh(body), RP);
    fill(); const wantQ = run(fresh(body), RQ);
    e.set_uop(1);
    const v0 = st(11), h0 = st(13), j0 = st(8);
    const { at } = compiled(body);
    for (let i = 0; i < 70; i++) { fill(); assert.strictEqual(run(at, RP), wantP, `entry ${i} with EBX = P`); }
    assert(st(11) > v0, 'a dominant read-only EBX compiled a variant');
    assert(st(8) > j0, "the variant's byte compare was decided (C1)");
    const h1 = st(13);
    assert(h1 > h0, 'later entries ran the variant');
    fill(); assert.strictEqual(run(at, RQ), wantQ, 'another EBX falls back to the generic program');
    assert.strictEqual(st(13), h1, 'the guard kept the variant out');
    fill(); assert.strictEqual(run(at, RP), wantP);
    assert.strictEqual(st(13), h1 + 1, 'and EBX = P enters it again');
    ok('S1 variant: compiled from the profile, entered only under its guard');
    // the byte compare again, EDX's upper bytes unknown: F1 knows the low
    // byte alone (mask bit 8+r) and C1 still decides the jne
    const body8 = loop([[0x8B, 0x03], [0x8A, 0x53, 0x04], [0x80, 0xFA, 0x07], [0x75, 0x02],
      [0x01, 0x07], [0x83, 0xC7, 0x04]]);
    const RP8 = { ...RP, edx: 0x12345600 }, RQ8 = { ...RQ, edx: 0x12345600 };
    e.set_uop(0);
    fill(); const wantP8 = run(fresh(body8), RP8);
    fill(); const wantQ8 = run(fresh(body8), RQ8);
    e.set_uop(1);
    const v8 = st(11), j8 = st(8);
    const c8 = compiled(body8);
    for (let i = 0; i < 70; i++) { fill(); assert.strictEqual(run(c8.at, RP8), wantP8, `byte entry ${i}`); }
    assert(st(11) > v8, 'a variant for the byte loop');
    assert(st(8) > j8, 'a compare on a register only whose low byte is known was decided');
    fill(); assert.strictEqual(run(c8.at, RQ8), wantQ8, 'its guard falls back too');
    ok('S1 + F1 low byte: a byte compare decided with the upper bytes unknown');
  }
  // C2: a loop walking read-only 8-byte records through EDI (EDI += 8), so
  // the variant's seed does not survive the back edge. The iteration copies
  // keep it: copy i knows EDI = P + 8i, folds its record and decides its
  // compare; the steady copy knows nothing. Every trip count around the
  // bound must match threaded code, and no program peels more than the bound.
  {
    e.set_uop_opt(0x7FF);
    const P = imageBase + 0x9C00;
    const recs = [[7, 5], [3, 9], [7, 1], [7, 4], [2, 8], [7, 6], [5, 2], [7, 3], [1, 1], [7, 7]];
    recs.forEach(([k, v], i) => { dv().setUint32(g2w(P + 8 * i), k, true); dv().setUint32(g2w(P + 8 * i + 4), v, true); });
    // mov eax,[edi]; cmp eax,7; jne +2; add [esi],eax; add eax,[edi+4];
    // add [esi+4],eax; add edi,8; (dec ecx; jnz)
    const body = loop([[0x8B, 0x07], [0x83, 0xF8, 0x07], [0x75, 0x02], [0x01, 0x06], [0x03, 0x47, 0x04],
      [0x01, 0x46, 0x04], [0x83, 0xC7, 0x08]]);
    const regsFor = (n) => ({ ecx: n, edi: P, esi: a.buf, eax: 0 });
    const TRIPS = [1, 2, 3, 4, 5, 6, 7, 9];
    e.set_uop(0);
    const want = {};
    for (const n of TRIPS) { fill(); want[n] = run(fresh(body), regsFor(n)); }
    e.set_uop(1);
    const bounded = (max, label) => {
      e.set_uop_c2(max, 0);
      const c0 = st(14), p0 = st(15), j0 = st(8);
      const { at } = compiled(body);
      for (let i = 0; i < 70; i++) { fill(); assert.strictEqual(run(at, regsFor(3)), want[3], `${label}: warm entry ${i}`); }
      for (const n of TRIPS) for (let r = 0; r < 3; r++) { fill(); assert.strictEqual(run(at, regsFor(n)), want[n], `${label}: ${n} trips`); }
      const copies = st(14) - c0, progs = st(15) - p0;
      if (max === 0) assert.strictEqual(copies, 0, `${label}: no copies`);
      else {
        assert(progs > 0 && copies > 0, `${label}: the variant has iteration copies`);
        assert(copies <= progs * max, `${label}: at most ${max} copies per program (${copies} over ${progs})`);
        assert(st(8) > j0, `${label}: the copies decided their compares`);
      }
      return { copies, progs };
    };
    const b4 = bounded(4, 'bound 4');
    const b1 = bounded(1, 'bound 1');
    assert.strictEqual(b1.copies, b1.progs, 'bound 1: exactly one peeled iteration per program');
    bounded(0, 'bound 0');
    e.set_uop_c2(4, 0);
    ok(`C2 iteration copies: trips ${TRIPS.join('/')} exact at bounds 4, 1, 0 (bound 4: ${b4.copies} copies over ${b4.progs} programs)`);
  }
  // R2: one helper called from two sites with EDX = 16 and EDX = 4. Shared,
  // F1 meets them and the helper's `cmp edx,8 / ja` stays; with a context
  // per call site each clone knows its EDX, C1 decides both, and each
  // clone's RET has its one return address.
  {
    //  L: mov edx,16; call H; mov edx,4; call H; add edi,4; dec ecx; jnz L; ret
    //  H: cmp edx,8; ja +3; add [esi],edx; ret; add [esi+4],edx; ret
    const body = Uint8Array.from([0xBA, 16, 0, 0, 0, 0xE8, ...d32(17), 0xBA, 4, 0, 0, 0, 0xE8, ...d32(7),
      0x83, 0xC7, 0x04, 0x49, 0x75, 0xE6, 0xC3,
      0x83, 0xFA, 0x08, 0x77, 0x03, 0x01, 0x16, 0xC3, 0x01, 0x56, 0x04, 0xC3]);
    e.set_uop(0);
    fill(); const want = run(fresh(body), R);
    e.set_uop(1);
    const arm = (mask) => {
      e.set_uop_opt(mask);
      const c0 = st(16), p0 = st(17), j0 = st(8);
      const { at } = compiled(body);
      fill(); assert.strictEqual(run(at, R), want, `mask 0x${mask.toString(16)}: same result as threaded code`);
      return { ctx: st(16) - c0, progs: st(17) - p0, jcc: st(8) - j0 };
    };
    const off = arm(0x140), on = arm(0x940);
    assert.strictEqual(off.ctx, 0, 'no contexts without 0x800');
    assert.strictEqual(off.jcc, 0, "shared, the helper's compare is not decided");
    assert(on.progs >= 1 && on.ctx >= 2, `a context per call site (${on.ctx})`);
    assert(on.jcc >= 2, `each clone decided its compare (${on.jcc})`);
    const all = arm(0x7FFF);
    assert(all.ctx >= 2);
    ok(`R2 call-site contexts: ${on.ctx} contexts, ${on.jcc} compares decided, exact against threaded code`);
  }
  // R2 shapes: each a loop calling shared helpers from two sites, run
  // against threaded code at several trip counts. A tiny assembler: bytes,
  // {L}, {call}, {jmp}, {jcc, cc} (rel32).
  {
    const asm = (items) => {
      const out = [], labs = {}, fix = [];
      for (const it of items) {
        if (typeof it === 'number') out.push(it);
        else if (Array.isArray(it)) out.push(...it);
        else if (it.L) labs[it.L] = out.length;
        else {
          if (it.call) out.push(0xE8); else if (it.jmp) out.push(0xE9); else out.push(0x0F, 0x80 | it.cc);
          fix.push([out.length, it.call || it.jmp || it.to]); out.push(0, 0, 0, 0);
        }
      }
      for (const [at, l] of fix) {
        if (labs[l] === undefined) throw new Error(`label ${l}`);
        const r = (labs[l] - (at + 4)) | 0;
        out.splice(at, 4, ...d32(r >>> 0));
      }
      return Uint8Array.from(out);
    };
    const tail = [0x83, 0xC6, 0x04, 0x49, { cc: 5, to: 'L' }, 0xC3];
    const SHAPES = {
      // caller's flags consumed in the callee
      'flags-in': [{ L: 'L' }, [0x8B, 0x06], [0x83, 0xE0, 0x03], [0x83, 0xF8, 0x01], { call: 'H' },
        [0x8B, 0x46, 0x04], [0x83, 0xF8, 0x02], { call: 'H' }, ...tail,
        { L: 'H' }, { cc: 4, to: 'Hz' }, [0x83, 0x07, 0x01], 0xC3, { L: 'Hz' }, [0x83, 0x47, 0x04, 0x03], 0xC3],
      // callee's flags consumed by the caller after the RET
      'flags-out': [{ L: 'L' }, { call: 'H' }, [0x85, 0xC0], { cc: 4, to: 'S1' }, [0x01, 0x07], { L: 'S1' },
        [0x83, 0xC6, 0x01], { call: 'H' }, [0x85, 0xC0], { cc: 4, to: 'S2' }, [0x01, 0x47, 0x08], { L: 'S2' }, ...tail,
        { L: 'H' }, 0x56, [0x8B, 0xF1], [0xF6, 0x46, 0x01, 0x21], { cc: 4, to: 'Ha' }, [0xB8, 1, 0, 0, 0], 0x5E, 0xC3,
        { L: 'Ha' }, [0x8B, 0x46, 0x08], 0x5E, 0xC3],
      // a callee's ADD's carry read after the RET
      'carry-out': [{ L: 'L' }, [0x8B, 0x16], { call: 'H' }, { cc: 2, to: 'C1' }, [0x83, 0x07, 0x05], { L: 'C1' },
        [0x8B, 0x56, 0x04], { call: 'H' }, { cc: 3, to: 'C2' }, [0x83, 0x47, 0x04, 0x07], { L: 'C2' }, ...tail,
        { L: 'H' }, [0x01, 0x57, 0x0C], 0xC3],
      'co-one': [{ L: 'L' }, [0x8B, 0x16], { call: 'H' }, { cc: 2, to: 'C1' }, [0x83, 0x07, 0x05], { L: 'C1' },
        [0x8B, 0x56, 0x04], { call: 'H' }, ...tail,
        { L: 'H' }, [0x01, 0x57, 0x0C], 0xC3],
      'co-sub': [{ L: 'L' }, [0x8B, 0x16], { call: 'H' }, { cc: 2, to: 'C1' }, [0x83, 0x07, 0x05], { L: 'C1' },
        [0x8B, 0x56, 0x04], { call: 'H' }, [0x83, 0xC6, 0x04], [0x83, 0xE9, 0x01], { cc: 5, to: 'L' }, 0xC3,
        { L: 'H' }, [0x01, 0x57, 0x0C], 0xC3],
      'co-two': [{ L: 'L' }, [0x8B, 0x16], { call: 'H' },
        [0x8B, 0x56, 0x04], { call: 'H' }, { cc: 2, to: 'C1' }, [0x83, 0x07, 0x05], { L: 'C1' }, ...tail,
        { L: 'H' }, [0x01, 0x57, 0x0C], 0xC3],
      'co-reg': [{ L: 'L' }, [0x8B, 0x16], { call: 'H' }, { cc: 2, to: 'C1' }, [0x83, 0x07, 0x05], { L: 'C1' },
        [0x8B, 0x56, 0x04], { call: 'H' }, { cc: 3, to: 'C2' }, [0x83, 0x47, 0x04, 0x07], { L: 'C2' }, ...tail,
        { L: 'H' }, [0x01, 0xD0], 0xC3],
      'co-noexit': [{ L: 'L' }, [0x8B, 0x16], { call: 'H' }, { cc: 2, to: 'C1' }, [0x83, 0x07, 0x05], { L: 'C1' },
        [0x8B, 0x56, 0x04], { call: 'H' }, { cc: 3, to: 'C2' }, [0x83, 0x47, 0x04, 0x07], { L: 'C2' },
        [0x83, 0xC6, 0x04], 0x49, { cc: 5, to: 'L' }, 0xF8, 0xC3,
        { L: 'H' }, [0x01, 0x57, 0x0C], 0xC3],
      'co-zf': [{ L: 'L' }, [0x8B, 0x16], { call: 'H' }, { cc: 4, to: 'C1' }, [0x83, 0x07, 0x05], { L: 'C1' },
        [0x8B, 0x56, 0x04], { call: 'H' }, { cc: 5, to: 'C2' }, [0x83, 0x47, 0x04, 0x07], { L: 'C2' }, ...tail,
        { L: 'H' }, [0x01, 0x57, 0x0C], 0xC3],
      // RET imm16 and an argument read through ESP
      'ret-imm': [{ L: 'L' }, [0x6A, 0x05], { call: 'H' }, [0x6A, 0x07], { call: 'H' }, ...tail,
        { L: 'H' }, [0x8B, 0x44, 0x24, 0x04], [0x01, 0x07], [0xC2, 0x04, 0x00]],
      // nested: H1 (two sites) calls H2, which saves EBX
      'nested': [{ L: 'L' }, [0xBA, 3, 0, 0, 0], { call: 'H1' }, [0xBA, 9, 0, 0, 0], { call: 'H1' }, ...tail,
        { L: 'H1' }, [0x01, 0x17], { call: 'H2' }, [0x83, 0xFA, 0x05], { cc: 7, to: 'H1b' }, [0x83, 0x47, 0x10, 0x01], { L: 'H1b' }, 0xC3,
        { L: 'H2' }, 0x53, [0x8B, 0x1E], [0x01, 0x5F, 0x14], [0x01, 0xD3], [0x89, 0x5F, 0x18], 0x5B, 0xC3],
      // a loop inside the callee
      'inner-loop': [{ L: 'L' }, [0xBA, 3, 0, 0, 0], { call: 'H' }, [0xBA, 5, 0, 0, 0], { call: 'H' }, ...tail,
        { L: 'H' }, { L: 'Hl' }, [0x01, 0x17], [0x83, 0xC7, 0x04], 0x4A, { cc: 5, to: 'Hl' }, 0xC3],
      // a callee that moves its return address past two bytes
      'ret-moved': [{ L: 'L' }, { call: 'H' }, [0xEB, 0x00], [0x83, 0x07, 0x01], { call: 'H' }, [0xEB, 0x00], ...tail,
        { L: 'H' }, [0x83, 0x04, 0x24, 0x02], [0x83, 0x47, 0x04, 0x01], 0xC3],
      // a helper also reached by a jump from a third, single-site one
      'jmp-in': [{ L: 'L' }, { call: 'H' }, { call: 'H' }, [0xF6, 0x06, 0x01], { cc: 4, to: 'T' }, { call: 'G' }, { L: 'T' },
        ...tail,
        { L: 'G' }, 0x53, [0x8B, 0x5E, 0x04], [0x01, 0x5F, 0x08], 0x5B, { jmp: 'H' },
        { L: 'H' }, [0x83, 0x07, 0x01], 0xC3],
      // a tail jump from one helper into another, which also has its own site
      'tail-jmp': [{ L: 'L' }, { call: 'H1' }, { call: 'H2' }, { call: 'H1' }, ...tail,
        { L: 'H1' }, [0x83, 0x47, 0x08, 0x02], { jmp: 'H2' },
        { L: 'H2' }, [0x8B, 0x06], [0x01, 0x47, 0x0C], 0xC3],
      // 16-bit flags (StarCraft 0x4c4281 neg ax) across the call
      'flags16': [{ L: 'L' }, [0x66, 0x8B, 0x06], [0x66, 0xF7, 0xD8], { call: 'H' },
        [0x66, 0x8B, 0x46, 0x02], [0x66, 0x83, 0xE8, 0x10], { call: 'H' }, ...tail,
        { L: 'H' }, { cc: 8, to: 'Hs' }, [0x66, 0x01, 0x07], 0xC3, { L: 'Hs' }, [0x66, 0x29, 0x47, 0x02], 0xC3],
    };
    const TRIPS = [1, 2, 3, 7, 40];
    const MASKS = process.env.UOP_R2_MASKS ? process.env.UOP_R2_MASKS.split(',').map(Number) : [0x800, 0x802, 0x840, 0x940, 0xFFF];
    const ONLY = process.env.UOP_R2_SHAPE;
    for (const [name, items] of Object.entries(SHAPES)) {
      if (ONLY && name !== ONLY) continue;
      const body = asm(items);
      let ctx = 0;
      for (const ecx of TRIPS) {
        const RR = { eax: 0x11, ebx: 0x22, ecx, edx: 0x33, ebp: 0x44, esi: a.buf, edi: a.buf + 0x10000 };
        e.set_uop(0); fill(); const want = run(fresh(body), RR);
        const wantBuf = Uint8Array.from(new Uint8Array(e.memory.buffer, g2w(a.buf), 0x20000));
        e.set_uop(1);
        for (const mask of MASKS) {
          e.set_uop_opt(mask);
          const c0 = st(16);
          const { at } = compiled(body);
          ctx += st(16) - c0;
          fill(); const got = run(at, RR);
          if (got !== want) {
            const gb = new Uint8Array(e.memory.buffer, g2w(a.buf), 0x20000);
            const dw = (b, k) => (b[k] | b[k + 1] << 8 | b[k + 2] << 16 | b[k + 3] << 24) >>> 0;
            for (let k = 0; k < 0x20000; k += 4) if (dw(gb, k) !== dw(wantBuf, k)) console.log(`  diff buf+0x${k.toString(16)}: got 0x${dw(gb, k).toString(16)} want 0x${dw(wantBuf, k).toString(16)}`);
            console.log(`  eax got ${got.split(':')[1]} want ${want.split(':')[1]}`);
          }
          assert.strictEqual(got, want, `${name} trips ${ecx} mask 0x${mask.toString(16)}`);
        }
      }
      ok(`R2 shape ${name}: exact at trips ${TRIPS.join('/')}, masks ${MASKS.map((m) => '0x' + m.toString(16)).join('/')} (${ctx} contexts)`);
    }
  }
  // 0x4000: fcomp m32 / fnstsw ax / sahf / jcc, every flag pair SAHF can
  // supply, over random floats (NaNs included: C3=C2=C0=1), against threaded
  // code; SAHF inline and the Jcc off AH
  {
    let fused = 0;
    for (let cc = 2; cc <= 11; cc++) {
      const body = Uint8Array.from([0xD9, 0x06, 0xD8, 0x5E, 0x04, 0xDF, 0xE0, 0x9E, 0x0F, 0x80 | cc, ...d32(3),
        0x83, 0x07, 0x01, 0x83, 0xC6, 0x04, 0x83, 0xC7, 0x04, 0x49, 0x75, 0xE6 - 0x100 + 0x100 - 0x0, 0xC3]);
      // rel8 of the jnz: back to offset 0 from the end of the jnz (offset 24)
      body[23] = (0x100 - 24) & 0xFF;
      const RR = { eax: 0, ebx: 0, ecx: 300, edx: 0, ebp: 0, esi: a.buf, edi: a.buf + 0x10000 };
      e.set_uop(0); fill(); const want = run(fresh(body), RR);
      e.set_uop(1);
      for (const mask of [0x10, 0x4010, 0x7FFF]) {
        e.set_uop_opt(mask);
        const f0 = st(18);
        const { at } = compiled(body);
        if (mask & 0x4000) { assert(st(18) > f0, `cc ${cc}: the Jcc read AH`); fused += st(18) - f0; }
        fill(); assert.strictEqual(run(at, RR), want, `fnstsw/sahf/j${cc} mask 0x${mask.toString(16)}`);
      }
    }
    ok(`0x4000 fnstsw/sahf/jcc: cc 2-11 exact over 300 random float compares (${fused} Jcc read off AH)`);
  }
  // 0x1000 M1: repeated loads within a block become register MOVs; a store
  // to the same bytes, through another base (aliased here: EDI == ESI + 4 in
  // the second run), or a write to the base or holder must make the next
  // load read memory again. Loop: dec ebp / jnz back to 0.
  {
    const lp = (insns) => {
      const b = insns.flat();
      const len = b.length + 3;
      return Uint8Array.from([...b, 0x4D, 0x75, (0x100 - len) & 0xFF, 0xC3]);
    };
    const bodies = {
      // hit, disjoint same-base store keeps it, overlapping store kills it
      'same-base': lp([[0x8B, 0x06], [0x01, 0xC3], [0x8B, 0x0E], [0x01, 0xCB], [0x89, 0x56, 0x04], [0x8B, 0x16], [0x01, 0xD3],
                       [0x89, 0x1E], [0x8B, 0x06], [0x01, 0xC3], [0x83, 0xC6, 0x08]]),
      // a store through EDI kills every entry (EDI may alias ESI)
      'other-base': lp([[0x8B, 0x06], [0x89, 0x1F], [0x8B, 0x0E], [0x01, 0xCB], [0x01, 0x47, 0x04], [0x8B, 0x16], [0x01, 0xD3],
                        [0x89, 0x5F, 0x08], [0x83, 0xC6, 0x04], [0x83, 0xC7, 0x04]]),
      // the holder or the base written in between
      'holder-base': lp([[0x8B, 0x46, 0x08], [0x40], [0x8B, 0x4E, 0x08], [0x01, 0xCB], [0x8B, 0x46, 0x08], [0x83, 0xC6, 0x04],
                         [0x8B, 0x56, 0x04], [0x01, 0xD3], [0x01, 0xC3], [0x89, 0x5E, 0x0C]]),
      // widths and extensions are separate keys; cmp [m] reads through a hit
      'widths': lp([[0x0F, 0xB6, 0x06], [0x8B, 0x0E], [0x0F, 0xB6, 0x16], [0x0F, 0xBE, 0x3E], [0x01, 0xC3], [0x01, 0xCB], [0x01, 0xD3],
                    [0x01, 0xFB], [0x39, 0x0E], [0x0F, 0x94, 0xC0], [0x01, 0xC3], [0x89, 0x5E, 0x10], [0x83, 0xC6, 0x03], [0x8B, 0xFE]]),
      // xchg and a lock'd add kill the table
      'xchg-lock': lp([[0x8B, 0x06], [0x87, 0x1E], [0x8B, 0x0E], [0x01, 0xCB], [0x8B, 0x06], [0xF0, 0x01, 0x06], [0x8B, 0x16],
                       [0x01, 0xD3], [0x83, 0xC6, 0x04]]),
    };
    let hits = 0;
    for (const [name, body] of Object.entries(bodies)) {
      for (const alias of [0x10000, 4]) {
        const RR = { eax: 0, ebx: 0, ecx: 0, edx: 0, ebp: 200, esi: a.buf, edi: a.buf + alias };
        e.set_uop(0); fill(); const want = run(fresh(body), RR);
        e.set_uop(1);
        for (const mask of [0x1000, 0x1040, 0x7FFF]) {
          e.set_uop_opt(mask);
          const m0 = st(19);
          const at = fresh(body);
          const pc = e.uop_compile(at) >>> 0;
          // xchg / lock compile only with V1 (0x008)
          if (!pc) { assert(name === 'xchg-lock' && !(mask & 8), `M1 ${name} compiles at 0x${mask.toString(16)}`); continue; }
          e.uop_install(at, pc);
          hits += st(19) - m0;
          fill(); assert.strictEqual(run(at, RR), want, `M1 ${name} alias ${alias} mask 0x${mask.toString(16)}`);
        }
      }
    }
    assert(hits > 0, 'M1 replaced loads');
    ok(`0x1000 M1: 5 shapes x 2 aliasings exact (${hits} loads replaced)`);
  }
  // 0x800 dynamic RET (07d RETX/EXITR, branch clock, as R1): a function head
  // compiled on its own as a trace, called 24 times from threaded code. Its
  // RET names no call in the program, so it pops and leaves to the caller's
  // return address; the caller stores the flags (pushfd) after each return.
  // `ret` and `ret 4` (the caller pushes one argument).
  {
    e.set_branch_clock(1);
    let dyn = 0;
    for (const imm of [0, 4]) {
      const F = [0x8B, 0x06, 0x03, 0x46, 0x04, 0x89, 0x07, 0x31, 0xDB, 0x01, 0xC3, 0x43, 0x89, 0x5F, 0x04,
                 0x8D, 0x0C, 0x18, 0x89, 0x4F, 0x08, 0x29, 0xC1, 0x83, 0xC6, 0x04, 0x39, 0xD9,
                 ...(imm ? [0xC2, imm, 0] : [0xC3])];
      // caller at +0x100: 24 x { [push esi;] call F; pushfd; pop edx; mov [edi+12],edx; add edi,16 }; ret
      const call = [];
      for (let k = 0; k < 24; k++) {
        const pre = imm ? [0x56] : [];
        const site = 0x100 + call.length + pre.length;
        const rel = (0 - (site + 5)) >>> 0;
        call.push(...pre, 0xE8, ...d32(rel), 0x9C, 0x5A, 0x89, 0x57, 0x0C, 0x83, 0xC7, 0x10);
      }
      const code = new Uint8Array(0x100 + call.length + 1);
      code.set(F, 0); code.set(call, 0x100); code[code.length - 1] = 0xC3;
      const RR = { eax: 0, ebx: 0, ecx: 0, edx: 0, ebp: 0, esi: a.buf, edi: a.buf + 0x10000 };
      e.set_uop(0); fill(); const at0 = fresh(code); const want = run(at0 + 0x100, RR) + ':' + e.get_esp();
      e.set_uop(1);
      for (const mask of [0x2, 0x802, 0xFFF, 0x7FFF]) {
        e.set_uop_opt(mask);
        const d0 = st(20);
        const at = fresh(code);
        const pc = e.uop_compile(at) >>> 0;
        assert(pc, `F (ret ${imm}) compiles at 0x${mask.toString(16)}`);
        e.uop_install(at, pc);
        if (mask & 0x800) { assert(st(20) > d0, `ret ${imm}: RETX at 0x${mask.toString(16)}`); dyn += st(20) - d0; }
        fill(); assert.strictEqual(run(at + 0x100, RR) + ':' + e.get_esp(), want, `RETX ret ${imm} mask 0x${mask.toString(16)}`);
      }
    }
    e.set_branch_clock(0);
    ok(`0x800 dynamic RET: ret / ret 4 from a compiled callee, 24 returns each, exact with the flags (${dyn} RETX sites)`);
  }
  e.set_uop_opt(0);
  e.set_uop(0);
  return n;
}

async function main() {
  require(path.join(ROOT, 'tools', 'bench-loops.js')).ensureBuilt();
  // UOP_OPT_SKIP_ARMS=1: the one-instance checks alone (a quick loop while debugging)
  const fails = process.env.UOP_OPT_SKIP_ARMS ? 0 : armsPass();
  console.log('invalidation (one instance, test exports):');
  const n = await invalidation();
  if (fails) { console.log(`FAIL: ${fails} arm(s)`); process.exit(1); }
  console.log(`PASS (${ARMS.length} arms x 2 clocks, ${n} invalidation checks)`);
}

main().catch((err) => { console.error(err.stack || String(err)); process.exit(1); });
