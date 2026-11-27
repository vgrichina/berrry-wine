#!/usr/bin/env node
'use strict';
// MSVC CRT memcpy/memmove as native WAT (src/10-helpers-msvc-routines.wat,
// threaded handler 396; set_known_routines(mask), off by default).
//
// Each registry body (tools/known-routines.json: VC6 memcpy from GTA2, VC7.1
// memcpy from Black & White 2, VC4 memmove from Heroes II) is relocated to a
// VA of its own in two instances, one with the entry off and one on. Then:
//   * the call grid (tools/kr-clock.js: sizes 0..40 and every class above,
//     every dst/src alignment, apart both ways, overlapping both ways by 1..33,
//     equal, across page boundaries, every caller EDX for the memmove) agrees
//     on EIP, flags, all eight GPRs, the working buffer and the stack below
//     ESP -- under the branch clock with the blocks too, and under the default
//     clock -- and every call ran natively;
//   * every batch budget from 1 to the call's block count stops on the same
//     instruction with the same state (a short budget declines up front);
//   * the declines: DF set, an unmapped source, a destination over the stack
//     words or over the body, a wrapped end, the mask bit clear -- each runs
//     the guest body, exactly, with the fallback counted;
//   * a body patched before its first decode never matches; a guest store
//     into the middle of a folded body (outside the one-instruction cover)
//     makes the next call run the patched guest code;
//   * the same bytes at a second VA match (the absolute fields are checked
//     against the entry, not against the reference image);
//   * the generated signature and clock blocks are current
//     (kr-sig.js wat --check, kr-clock.js --check).
// Needs the three reference images (skips the entries whose image is absent).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const bench = require(path.join(ROOT, 'tools', 'bench-loops.js'));
const K = require(path.join(ROOT, 'tools', 'kr-clock.js'));

let fails = 0;
const fail = (m) => { fails++; console.log('FAIL ' + m); };
const NATIVE = 0, FALLBACK = 1, SMC_DROPS = 2;

async function pairFor(b, branchClock) {
  const off = await K.instance({ mask: 0, branchClock });
  const on = await K.instance({ mask: 1 << b.id, branchClock });
  return { off, on, eo: K.place(off, b), en: K.place(on, b) };
}
const stat = (inst, k) => inst.e.known_routine_stat(k);

function runCase(P, b, c, want, tag, seed, keys) {
  K.fill(P.off, seed); K.fill(P.on, seed);
  const n0 = stat(P.on, 10 + b.id), f0 = stat(P.on, 20 + b.id);
  const a = K.call(P.off, P.eo, c), r = K.call(P.on, P.en, c);
  const dn = stat(P.on, 10 + b.id) - n0, df = stat(P.on, 20 + b.id) - f0;
  const d = K.compare(a, r, keys);
  if (!a.ok) d.push('did not return');
  if (want === 'n' && (dn !== 1 || df)) d.push(`want native, got native=${dn} fallback=${df}`);
  if (want === 'f' && (df < 1 || dn)) d.push(`want fallback, got native=${dn} fallback=${df}`);
  return d;
}

async function gridUnder(b, branchClock) {
  const tag = `${b.name}/${b.variant} ${branchClock ? 'branch clock' : 'default clock'}`;
  const P = await pairFor(b, branchClock);
  const keys = branchClock ? undefined : ['ok', 'eip', 'flags', ...K.REGS, 'mem', 'stack'];
  const cases = K.grid(P.off, b);
  let bad = 0, first = '';
  cases.forEach((c, i) => {
    const d = runCase(P, b, c, 'n', tag, i, keys);
    if (d.length) { bad++; if (!first) first = `${c.rel} n=${c.n} d&3=${c.d & 3} s&3=${c.s & 3}: ${d.join(', ')}`; }
  });
  if (stat(P.off, NATIVE) + stat(P.off, FALLBACK)) fail(`[${tag}] the entry fired with its mask bit clear`);
  if (bad) fail(`[${tag}] grid: ${bad} of ${cases.length} differ; first ${first}`);
  else console.log(`[${tag}] grid`.padEnd(52) + ` ok (${cases.length} calls)`);
  return P;
}

// Every budget 1..blocks+1 for a quick grid: same EIP, blocks, flags, regs, memory.
function everyBudget(P, b) {
  const tag = `${b.name}/${b.variant}`;
  let cuts = 0, bad = 0, first = '';
  K.grid(P.off, b, { quick: true }).forEach((c, i) => {
    if (i % 5) return;
    K.fill(P.off, i);
    const full = K.call(P.off, P.eo, c).blocks;
    for (let n = 1; n <= full + 1; n++) {
      K.fill(P.off, i); K.fill(P.on, i);
      const a = K.call(P.off, P.eo, c, n), r = K.call(P.on, P.en, c, n);
      const d = K.compare(a, r);
      cuts++;
      if (d.length) { bad++; if (!first) first = `${c.rel} n=${c.n} budget ${n}: ${d.join(', ')}`; }
    }
  });
  if (bad) fail(`[${tag}] every budget: ${bad} of ${cuts} differ; first ${first}`);
  else console.log(`[${tag}] every budget`.padEnd(52) + ` ok (${cuts} batches)`);
}

async function declines(b) {
  const tag = `${b.name}/${b.variant}`;
  const P = await pairFor(b, true);
  const B = P.off.L.buf;
  const sp = P.off.L.stack - 0x40;
  const list = [
    ['unmapped source', { n: 64, d: B + 0x100, s: 0x7FFF0000 }],
    ['unmapped destination', { n: 64, d: 0x7FFF0000, s: B + 0x100 }],
    ['dst over the argument words', { n: 8, d: sp + 8, s: B + 0x100 }],
    ['dst over the pushed words', { n: 8, d: sp - 12, s: B + 0x100 }],
    ['wrapped source end', { n: 0x100, d: B + 0x100, s: 0xFFFFFFC0 }],
  ];
  // dst over the body itself (a copy that rewrites the routine mid-run)
  list.push(['dst over the body', { n: 16, d: P.eo + 0x40, s: B + 0x100, dOn: P.en + 0x40 }]);
  list.forEach(([label, c], i) => {
    K.fill(P.off, i); K.fill(P.on, i);
    const f0 = stat(P.on, 20 + b.id), n0 = stat(P.on, 10 + b.id);
    const a = K.call(P.off, P.eo, c), r = K.call(P.on, P.en, c.dOn ? { ...c, d: c.dOn } : c);
    const dn = stat(P.on, 10 + b.id) - n0, df = stat(P.on, 20 + b.id) - f0;
    // the body copies (dOn/d) differ by placement; compare everything else
    const d = c.dOn ? K.compare(a, r, ['ok', 'blocks', 'flags', 'eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi', 'mem'])
      .filter((x) => !x.startsWith('eax')) : K.compare(a, r);
    if (df !== 1 || dn) d.push(`want one fallback, got native=${dn} fallback=${df}`);
    if (d.length) fail(`[${tag}] decline ${label}: ${d.join(', ')}`);
    else console.log(`[${tag}] decline ${label}`.padEnd(52) + ' ok');
  });
  // DF=1 on entry: `std; push n; push s; push d; call body; add esp,12; cld; ret`
  // (a fresh pair: the case above really overwrote the body)
  {
    const P = await pairFor(b, true);
    const stub = P.off.L.code + 0x8000;
    const le = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, v >>> 24];
    for (const [inst, entry] of [[P.off, P.eo], [P.on, P.en]]) {
      // `mov eax, entry; call eax` -- an indirect call, so the body's entry
      // starts a block of its own
      inst.mem.set([0xFD, 0x68, ...le(40), 0x68, ...le(B + 0x100), 0x68, ...le(B + 0x300),
        0xB8, ...le(entry), 0xFF, 0xD0, 0x83, 0xC4, 0x0C, 0xFC, 0xC3], inst.g2w(stub));
    }
    K.fill(P.off, 99); K.fill(P.on, 99);
    const f0 = stat(P.on, 20 + b.id), n0 = stat(P.on, 10 + b.id);
    const a = callStub(P.off, stub), r = callStub(P.on, stub);
    const d = K.compare(a, r);
    if (!a.ok) d.push('did not return');
    const df = stat(P.on, 20 + b.id) - f0, dn = stat(P.on, 10 + b.id) - n0;
    if (df !== 1 || dn) d.push(`want one fallback, got native=${dn} fallback=${df}`);
    if (d.length) fail(`[${tag}] decline DF=1: ${d.join(', ')}`); else console.log(`[${tag}] decline DF=1`.padEnd(52) + ' ok');
  }
}
// Run the DF stub from a stack whose return address is 0.
function callStub(inst, stub) {
  const { e, g2w, L } = inst;
  const dv = new DataView(e.memory.buffer);
  const sp = L.stack - 0x40;
  for (let i = 0; i < 0x80; i += 4) dv.setUint32(g2w(sp - 0x40 + i), 0x5A5A0000 + i, true);
  dv.setUint32(g2w(sp), 0, true);
  for (const r of ['eax', 'ecx', 'edx', 'ebx', 'ebp', 'esi', 'edi']) e['set_' + r](0x10101010);
  e.set_esp(sp);
  e.set_eip(stub);
  let blocks = 0, ok = false;
  for (let i = 0; i < 64 && !ok; i++) { e.run(0x7FFFFFFF); blocks += e.get_last_run_blocks(); ok = e.get_eip() === 0; }
  const out = { ok, blocks, eip: e.get_eip() >>> 0, flags: e.uop_flags() >>> 0 };
  for (const r of K.REGS) out[r] = e['get_' + r]() >>> 0;
  out.mem = Buffer.from(inst.mem.subarray(g2w(L.buf), g2w(L.buf) + L.bufBytes)).toString('base64');
  out.stack = Buffer.from(inst.mem.subarray(g2w(sp - 0x40), g2w(sp + 0x40))).toString('hex');
  return out;
}

async function matching(b) {
  const tag = `${b.name}/${b.variant}`;
  // mask bit clear in the on instance's sibling entries: only its own id folds
  {
    const inst = await K.instance({ mask: 0xE & ~(1 << b.id) });
    const va = K.place(inst, b);
    K.fill(inst, 1);
    const r = K.call(inst, va, { n: 64, d: inst.L.buf + 0x100, s: inst.L.buf + 0x3000 });
    if (!r.ok || stat(inst, NATIVE) + stat(inst, FALLBACK)) fail(`[${tag}] matched with its own mask bit clear`);
    else console.log(`[${tag}] own mask bit clear: guest body`.padEnd(52) + ' ok');
  }
  // patched before the first decode (one byte in the middle): never matches
  for (const o of [0x30, b.len - 2]) {
    const inst = await K.instance({ mask: 1 << b.id });
    const va = K.place(inst, b);
    inst.mem[inst.g2w(va + o)] ^= 0x01;
    K.fill(inst, 2);
    K.call(inst, va, { n: 3, d: inst.L.buf + 0x101, s: inst.L.buf + 0x3000 });
    if (stat(inst, NATIVE) + stat(inst, FALLBACK)) fail(`[${tag}] patched at +0x${o.toString(16)} still matched`);
    else console.log(`[${tag}] patched at +0x${o.toString(16)}: never matches`.padEnd(52) + ' ok');
  }
  // a second VA, other page offset: the same bytes, relocated, still match
  {
    const P = await pairFor(b, true);
    const va2o = K.place(P.off, b, P.off.L.code + 0x9123), va2n = K.place(P.on, b, P.on.L.code + 0x9123);
    K.fill(P.off, 3); K.fill(P.on, 3);
    const c = { n: 77, d: P.off.L.buf + 0x102, s: P.off.L.buf + 0x3001 };
    const a = K.call(P.off, va2o, c), r = K.call(P.on, va2n, c);
    const d = K.compare(a, r);
    if (stat(P.on, 10 + b.id) !== 1) d.push('not native at the second VA');
    if (d.length) fail(`[${tag}] second VA: ${d.join(', ')}`); else console.log(`[${tag}] second VA (+0x9123)`.padEnd(52) + ' ok');
  }
  // Self-modifying code after the fold ran: a guest store (`xor byte
  // [edx],1; ret`) into the body, outside the first-instruction cover, then
  // the next call must run the patched guest body in both.
  {
    const P = await pairFor(b, true);
    const poke = P.off.L.code + 0xA000;
    for (const inst of [P.off, P.on]) inst.mem.set([0x80, 0x32, 0x01, 0xC3], inst.g2w(poke));
    const c = { n: 50, d: P.off.L.buf + 0x101, s: P.off.L.buf + 0x3002 };
    K.fill(P.off, 4); K.fill(P.on, 4);
    K.call(P.off, P.eo, c); K.call(P.on, P.en, c);
    if (stat(P.on, 10 + b.id) !== 1) fail(`[${tag}] SMC warm-up not native`);
    // the body's very last byte region: a trail move's displacement
    const target = b.len - 6;
    const d0 = stat(P.on, SMC_DROPS);
    for (const [inst, entry] of [[P.off, P.eo], [P.on, P.en]]) {
      const { e, g2w, L } = inst;
      new DataView(e.memory.buffer).setUint32(g2w(L.stack - 0x40), 0, true);
      e.set_edx(entry + target); e.set_esp(L.stack - 0x40); e.set_eip(poke);
      for (let i = 0; i < 8 && e.get_eip() !== 0; i++) e.run(0x7FFFFFFF);
    }
    const drops = stat(P.on, SMC_DROPS) - d0;
    const n0 = stat(P.on, 10 + b.id);
    K.fill(P.off, 5); K.fill(P.on, 5);
    const a = K.call(P.off, P.eo, c), r = K.call(P.on, P.en, c);
    const d = K.compare(a, r);
    if (drops < 1) d.push('the store into the body dropped nothing');
    if (stat(P.on, 10 + b.id) !== n0) d.push('the patched body still ran natively');
    if (d.length) fail(`[${tag}] SMC into the body: ${d.join(', ')}`);
    else console.log(`[${tag}] SMC into the body (+0x${target.toString(16)})`.padEnd(52) + ` ok (drops=${drops})`);
  }
}

async function main() {
  bench.ensureBuilt();
  for (const [tool, args] of [['kr-sig.js', ['wat', '--check']], ['kr-clock.js', ['--check']]]) {
    try { console.log(execFileSync('node', [path.join(ROOT, 'tools', tool), ...args], { encoding: 'utf8' }).trim().split('\n').pop()); }
    catch (err) { fail(`${tool} ${args.join(' ')}: ${(err.stderr || err.stdout || err.message).toString().trim()}`); }
  }
  const all = K.bodies();
  for (const b of all) {
    if (b.missing) { console.log(`SKIP ${b.name}/${b.variant}: ${b.ref.path} absent`); continue; }
    const P = await gridUnder(b, true);
    everyBudget(P, b);
    await gridUnder(b, false);
    await declines(b);
    await matching(b);
  }
  if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
  console.log('\nall known-routine checks passed');
}
main().catch((err) => { console.error(err.stack || err); process.exit(1); });
