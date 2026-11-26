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
const ARMS = [0, 0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80, 0xC0, 0x140, 0x1FF, 0x240, 0x3FF, 0x640, 0x7FF];

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
  for (const m of ARMS) {
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
  e.set_uop_opt(0);
  e.set_uop(0);
  return n;
}

async function main() {
  require(path.join(ROOT, 'tools', 'bench-loops.js')).ensureBuilt();
  const fails = armsPass();
  console.log('invalidation (one instance, test exports):');
  const n = await invalidation();
  if (fails) { console.log(`FAIL: ${fails} arm(s)`); process.exit(1); }
  console.log(`PASS (${ARMS.length} arms x 2 clocks, ${n} invalidation checks)`);
}

main().catch((err) => { console.error(err.stack || String(err)); process.exit(1); });
