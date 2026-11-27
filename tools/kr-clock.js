#!/usr/bin/env node
'use strict';
// tl;dr: derive the branch-clock charge of every path of every known CRT
// routine (src/10-helpers-msvc-routines.wat) from the interpreter itself, and
// write it into the file's `kr-clock generated` block. Never by hand.
//
//   node tools/kr-clock.js            measure, rewrite the block (then rebuild)
//   node tools/kr-clock.js --check    measure, exit 1 if the built table differs
//
// How. Each entry's reference body (tools/known-routines.json) is relocated to
// a fresh VA in two instances of build/wine-assembly.wasm under the branch
// clock, one with the entry off and one with it on. A grid of calls (every
// size class, every dst/src alignment, apart and overlapping both ways, at a
// page boundary, and for memmove-msvc4 every caller EDX&3) runs in both. The
// on instance names the path it took (kr_last_path) and what it charged
// (kr_charge); its blocks minus that charge is what the fold costs with no
// charge at all, so the charge a path needs is the off instance's blocks minus
// that. Every call of a path must need the same number -- a path whose calls
// disagree is not one straight-line route and the tool fails -- and a path no
// call reached gets -1, which the handler declines. Works from any table,
// including all zeros (the bootstrap).
//
// The harness (instances, relocation, the call grid, a call) is exported for
// test/test-known-routines.js.

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const bench = require(path.join(ROOT, 'tools', 'bench-loops.js'));
const { readPE } = require(path.join(ROOT, 'lib/pe'));
const WAT = path.join(ROOT, 'src/10-helpers-msvc-routines.wat');
const REGISTRY = path.join(ROOT, 'tools/known-routines.json');
const BEGIN = ';; BEGIN kr-clock generated\n', END = '  ;; END kr-clock generated';
const REGS = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];

// ---- bodies ---------------------------------------------------------------
// The registry entry's body bytes relocated to `va`: every absolute in-body
// field (found by .reloc when the image has one, else by value) rewritten to
// va + its offset from the entry.
function bodies() {
  const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  return reg.entries.map((e) => {
    const file = path.join(ROOT, e.ref.path);
    if (!fs.existsSync(file)) return { ...e, missing: true };
    const pe = readPE(file);
    const va0 = parseInt(e.ref.va, 16) >>> 0, len = parseInt(e.len, 16);
    const bytes = Buffer.alloc(len);
    for (let i = 0; i < len; i++) bytes[i] = pe.buf[pe.va2off(va0 + i)];
    const fix = [];
    for (let i = 0; i + 4 <= len; i++) {
      const v = bytes.readUInt32LE(i);
      if (v >= va0 && v < va0 + len) { fix.push([i, v - va0]); i += 3; }
    }
    if (fix.length !== e.fixups) throw new Error(`${e.name}/${e.variant}: ${fix.length} fixups, registry says ${e.fixups}`);
    const at = (va) => { const b = Buffer.from(bytes); for (const [o, r] of fix) b.writeUInt32LE((va + r) >>> 0, o); return b; };
    return { ...e, len, bytes, fix, at };
  });
}

// ---- instances --------------------------------------------------------------
async function instance({ mask, branchClock = true }) {
  const inst = await bench.newInstance();
  const { e } = inst;
  const ib = inst.imageBase >>> 0;
  inst.L = { code: ib + 0x200000, stack: ib + 0xF00000, buf: ib + 0x1000000, bufBytes: 0x8000 };
  e.set_uop(0);
  e.set_known_routines(mask);
  if (e.get_known_routines() !== mask) throw new Error('set_known_routines did not take');
  e.set_branch_clock(branchClock ? 1 : 0);
  return inst;
}
const codeAt = (inst, id) => inst.L.code + id * 0x1000;
function place(inst, body, va = codeAt(inst, body.id)) {
  inst.mem.set(body.at(va), inst.g2w(va));
  return va;
}
// The working buffer: a byte pattern no copy can reproduce by accident.
function fill(inst, seed) {
  const { mem, g2w, L } = inst;
  const w = g2w(L.buf);
  for (let i = 0; i < L.bufBytes; i++) mem[w + i] = (i * 7 + seed * 13 + (i >>> 8)) & 0xFF;
}
// One call: args on a stack whose return address is 0; runs until EIP is 0.
// `budget` = one e.run() of that many blocks instead (a budget cut).
function call(inst, entry, c, budget) {
  const { e, g2w, L } = inst;
  const dv = new DataView(e.memory.buffer);
  const sp = L.stack - 0x40;
  for (let i = 0; i < 0x80; i += 4) dv.setUint32(g2w(sp - 0x40 + i), 0x5A5A0000 + i, true);
  dv.setUint32(g2w(sp), 0, true);
  dv.setUint32(g2w(sp + 4), c.d >>> 0, true);
  dv.setUint32(g2w(sp + 8), c.s >>> 0, true);
  dv.setUint32(g2w(sp + 12), c.n >>> 0, true);
  const regs = { eax: 0x11111111, ecx: 0x22222222, edx: (c.edx === undefined ? 0x33333333 : c.edx), ebx: 0x44444444,
    ebp: 0x55555550, esi: 0x66666666, edi: 0x77777777 };
  for (const r of Object.keys(regs)) e['set_' + r](regs[r] >>> 0);
  e.set_esp(sp);
  e.set_eip(entry);
  let blocks = 0, ok = false;
  if (budget !== undefined) { e.run(budget); blocks = e.get_last_run_blocks(); ok = e.get_eip() === 0; }
  else for (let i = 0; i < 64 && !ok; i++) { e.run(0x7FFFFFFF); blocks += e.get_last_run_blocks(); ok = e.get_eip() === 0; }
  const out = { ok, blocks, eip: e.get_eip() >>> 0, flags: e.uop_flags() >>> 0 };
  for (const r of REGS) out[r] = e['get_' + r]() >>> 0;
  out.mem = Buffer.from(inst.mem.subarray(g2w(L.buf), g2w(L.buf) + L.bufBytes)).toString('base64');
  out.stack = Buffer.from(inst.mem.subarray(g2w(sp - 0x40), g2w(sp + 0x40))).toString('hex');
  return out;
}
function compare(a, b, keys = ['ok', 'eip', 'flags', 'blocks', ...REGS, 'mem', 'stack']) {
  const diffs = [];
  for (const k of keys) if (a[k] !== b[k]) diffs.push(k === 'mem' || k === 'stack' ? `${k} differs` : `${k} ${(a[k] >>> 0).toString(16)} vs ${(b[k] >>> 0).toString(16)}`);
  return diffs;
}

// ---- the call grid ----------------------------------------------------------
const SIZES = [...Array(41).keys(), 47, 48, 49, 50, 51, 63, 64, 65, 66, 67, 100, 127, 128, 129, 130, 131, 255, 256, 1000, 4097];
function grid(inst, body, { quick = false } = {}) {
  const B = inst.L.buf, out = [];
  const sizes = quick ? SIZES.filter((n, i) => n < 20 || i % 3 === 0) : SIZES;
  const deltas = quick ? [1, 3, 4, 9] : [1, 2, 3, 4, 5, 7, 8, 13, 33];
  let k = 0;
  for (const n of sizes) for (let da = 0; da < 4; da++) for (let sa = 0; sa < 4; sa++) {
    const edx = body.impl === 'vc4-memmove' ? (0x1000 + k++) : undefined;
    out.push({ n, d: B + 0x100 + da, s: B + 0x3000 + sa, edx, rel: 'dst<src' });
    out.push({ n, d: B + 0x3000 + da, s: B + 0x100 + sa, edx, rel: 'dst>src' });
    // a page boundary under both spans
    out.push({ n, d: B + 0x5FFD + da, s: B + 0x1FFE + sa, edx, rel: 'page' });
    if (da === sa) out.push({ n, d: B + 0x2000 + da, s: B + 0x2000 + da, edx, rel: 'same' });
    if (da === 0) for (const dl of deltas) {
      out.push({ n, d: B + 0x2000 + sa, s: B + 0x2000 + sa + dl, edx, rel: `overlap dst=src-${dl}` });
      out.push({ n, d: B + 0x2000 + sa + dl, s: B + 0x2000 + sa, edx, rel: `overlap dst=src+${dl}` });
    }
  }
  return out;
}

// ---- measure --------------------------------------------------------------
async function measure() {
  const all = bodies().filter((b) => !b.missing);
  const mask = all.reduce((m, b) => m | (1 << b.id), 0);
  const off = await instance({ mask: 0 }), on = await instance({ mask });
  const need = new Map();   // id -> Map(path -> Set(charge))
  const cur = new Map();
  let calls = 0;
  for (const b of all) {
    const eo = place(off, b), en = place(on, b);
    const m = new Map();
    need.set(b.id, m);
    for (const c of grid(off, b)) {
      fill(off, calls); fill(on, calls);
      const n0 = on.e.known_routine_stat(10 + b.id);
      const a = call(off, eo, c), r = call(on, en, c);
      calls++;
      if (on.e.known_routine_stat(10 + b.id) - n0 !== 1) throw new Error(`${b.name}/${b.variant} ${JSON.stringify(c)}: not native in the on instance`);
      const p = on.e.kr_last_path();
      const charge = on.e.kr_charge(b.id, p);
      const d = compare(a, r, ['ok', 'eip', 'flags', ...REGS, 'mem', 'stack']);
      if (d.length) throw new Error(`${b.name}/${b.variant} path ${p} ${JSON.stringify(c)}: state differs (${d.join(', ')})`);
      const v = a.blocks - (r.blocks - charge);
      if (!m.has(p)) m.set(p, new Map());
      m.get(p).set(v, (m.get(p).get(v) || 0) + 1);
      cur.set(`${b.id}:${p}`, charge);
    }
  }
  return { all, need, cur, calls };
}

function table(need) {
  const rows = [];
  for (const [id, m] of need) for (const [p, vs] of m) {
    if (vs.size !== 1) throw new Error(`id ${id} path ${p}: calls need different charges ${JSON.stringify([...vs])}`);
    rows.push({ id, p, v: [...vs.keys()][0], calls: [...vs.values()][0] });
  }
  return rows.sort((a, b) => a.id - b.id || a.p - b.p);
}

function generate(rows) {
  const vals = [...new Set(rows.map((r) => r.v))].sort((a, b) => a - b);
  const maxK = Math.max(...rows.map((r) => r.id * 64 + r.p));
  const lbl = new Array(maxK + 1).fill('$none');
  for (const r of rows) lbl[r.id * 64 + r.p] = `$c${r.v}`;
  const L = [];
  L.push('  ;; GENERATED by `node tools/kr-clock.js` from the interpreter\'s block counts -- do not edit.');
  L.push('  ;; Blocks (executed branches) a path runs before the body\'s RET, per (id, path); -1 for a');
  L.push('  ;; path no measured call took (the handler declines it).');
  for (const r of rows) L.push(`  ;;   id ${r.id} path ${String(r.p).padStart(2)}: ${r.v}  (${r.calls} calls)`);
  L.push('  (func $kr_charge (param $id i32) (param $p i32) (result i32)');
  L.push('    (if (i32.ge_u (local.get $p) (i32.const 64)) (then (return (i32.const -1))))');
  L.push('    (block $none');
  for (let i = vals.length - 1; i >= 0; i--) L.push(`    ${' '.repeat(vals.length - 1 - i)}(block $c${vals[i]}`);
  L.push(`      (br_table ${lbl.join(' ')} $none`);
  L.push('        (i32.add (i32.shl (local.get $id) (i32.const 6)) (local.get $p))))');
  for (let i = 0; i < vals.length; i++) {
    L.push(`    ${' '.repeat(vals.length - 1 - i)}(return (i32.const ${vals[i]})))`);
  }
  L.push('    (i32.const -1))');
  return L.join('\n') + '\n';
}

async function main() {
  bench.ensureBuilt();
  const { all, need, cur, calls } = await measure();
  const rows = table(need);
  console.log(`kr-clock: ${calls} calls over ${all.length} entries, ${rows.length} paths`);
  if (process.argv.includes('--check')) {
    const bad = rows.filter((r) => cur.get(`${r.id}:${r.p}`) !== r.v);
    if (bad.length) {
      console.error(`kr-clock: built charges stale for ${bad.length} path(s): ` +
        bad.slice(0, 6).map((r) => `id ${r.id} path ${r.p} built ${cur.get(`${r.id}:${r.p}`)} needs ${r.v}`).join('; ') +
        ' -- run node tools/kr-clock.js and rebuild');
      process.exit(1);
    }
    console.log('kr-clock: built charges match the interpreter');
    return;
  }
  const src = fs.readFileSync(WAT, 'utf8');
  const a = src.indexOf(BEGIN), b = src.indexOf(END);
  if (a < 0 || b < 0) throw new Error('kr-clock markers missing in ' + WAT);
  fs.writeFileSync(WAT, src.slice(0, a + BEGIN.length) + generate(rows) + src.slice(b));
  console.log('kr-clock: wrote the charge table; rebuild');
}

if (require.main === module) main().catch((err) => { console.error(err.stack || err); process.exit(1); });
module.exports = { bodies, instance, place, codeAt, fill, call, compare, grid, measure, table, REGS };
