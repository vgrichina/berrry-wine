#!/usr/bin/env node
'use strict';

// tl;dr: which threaded handlers write (or read) an 8/16-bit register, and
// how much of a run's dispatch stream they are.
//
//   node tools/narrow-reg-census.js [--sites] [--depth=N] [--top=N] [--json] [hist.log ...]
//
// STATIC half (no build needed): walks the src/main.watx include list as one
// module, finds every function that writes a partial register, and classifies
// each site:
//   set8   call $set_reg8              (AL..BH, operand-indexed)
//   set16  call $set_reg16             (AX..DI, operand-indexed)
//   inl8   i32.store8  ... $reg_base   (an inlined byte write, e.g. AL / AH)
//   inl16  i32.store16 ... $reg_base   (an inlined word write, e.g. AX / DX)
//   mrg8   (set-reg8 ..) / (set-al ..) / (set-ah ..)   the load-merge-store
//   mrg16  (set-reg16 ..) / (set-ax|cx|dx ..)          macros of 03-registers
// (set8/set16 count the CALL form; after the merge change most sites are
// mrg8/mrg16, so the same handlers are found before and after it.)
// and the read side the same way (get8 / get16 / ld8 / ld16). A handler is
// marked through the call graph up to --depth calls away (default 2), so a
// handler whose narrow write sits in a helper it calls is still counted; the
// depth printed is how far away the nearest write is.
//
// DYNAMIC half: each argument is a test/run.js log carrying a handler
// histogram (`--handler-hist-thread=0 --handler-hist-top=600`), i.e. lines
// `  H<id> <name> <hits> (<pct>%)`. For every log it prints the share of the
// window's dispatches that went to a handler that MAY write a partial
// register (a handler like $th_alu_r_m8 writes only when mod==3, so this is
// an upper bound on writes, and an exact count of dispatches), split by kind,
// and the top such handlers. Blocks run inside uop programs do not dispatch
// handlers; the log's `uop` share line, when present, is echoed so the
// threaded share can be read against it.

const fs = require('fs');
const path = require('path');
const { WAT_FILES } = require('../lib/wat-manifest');

const args = process.argv.slice(2);
const opt = (name, d) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : d;
};
const DEPTH = +opt('depth', '2');
const TOP = +opt('top', '25');
const asJson = args.includes('--json');
const showSites = args.includes('--sites');
const logs = args.filter(a => !a.startsWith('--'));

let src = '(module\n';
const parts = [];
for (const file of WAT_FILES) {
  parts.push([src.length, file]);
  src += fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
}
src += ')\n';

// Top-level forms by paren depth, skipping strings and comments
// (the same walk as tools/wat-dead-funcs.js).
function topForms(text) {
  const forms = [];
  let depth = 0, start = -1, i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '"') { i++; while (i < n && text[i] !== '"') i += text[i] === '\\' ? 2 : 1; i++; continue; }
    if (c === ';' && text[i + 1] === ';') { while (i < n && text[i] !== '\n') i++; continue; }
    if (c === '(' && text[i + 1] === ';') {
      let d = 1; i += 2;
      while (i < n && d) {
        if (text[i] === '(' && text[i + 1] === ';') { d++; i += 2; }
        else if (text[i] === ';' && text[i + 1] === ')') { d--; i += 2; }
        else i++;
      }
      continue;
    }
    if (c === '(') { if (depth === 1) start = i; depth++; }
    else if (c === ')') { depth--; if (depth === 1 && start >= 0) { forms.push([start, i + 1]); start = -1; } }
    i++;
  }
  return forms;
}
const strip = t => t.replace(/;;[^\n]*/g, '').replace(/"(?:[^"\\]|\\.)*"/g, '""');
const partAt = off => { let best = parts[0][1]; for (const [o, f] of parts) { if (o <= off) best = f; else break; } return best; };

// A narrow store whose address expression starts at $reg_base: either
// `(i32.store8 offset=N (global.get $reg_base) ...` or
// `(i32.store16 (i32.add (global.get $reg_base) ...`.
const RB = String.raw`\(\s*(?:global\.get\s+\$reg_base|i32\.add\s+\(\s*global\.get\s+\$reg_base)`;
const KINDS = {
  set8: /\(\s*call\s+\$set_reg8\b/g,
  set16: /\(\s*call\s+\$set_reg16\b/g,
  inl8: new RegExp(String.raw`\(\s*i32\.store8(?:\s+offset=\d+)?\s*` + RB, 'g'),
  inl16: new RegExp(String.raw`\(\s*i32\.store16(?:\s+offset=\d+)?\s*` + RB, 'g'),
  mrg8: /\(\s*set-(?:reg8|al|ah)\s/g,
  mrg16: /\(\s*set-(?:reg16|ax|cx|dx)\s/g,
  get8: /\(\s*call\s+\$get_reg8\b/g,
  get16: /\(\s*call\s+\$get_reg16\b/g,
  ld8: new RegExp(String.raw`\(\s*i32\.load8_[su](?:\s+offset=\d+)?\s*` + RB, 'g'),
  ld16: new RegExp(String.raw`\(\s*i32\.load16_[su](?:\s+offset=\d+)?\s*` + RB, 'g'),
};
const WRITE = ['set8', 'set16', 'inl8', 'inl16', 'mrg8', 'mrg16'];
const READ = ['get8', 'get16', 'ld8', 'ld16'];
// The primitives themselves are the definition, not a site.
const PRIMS = new Set(['$set_reg8', '$set_reg16', '$get_reg8', '$get_reg16', '$reg8_addr']);

const funcs = new Map();
for (const [s, e] of topForms(src)) {
  const text = strip(src.slice(s, e));
  const head = /^\(\s*func\s+(\$[^\s()]+)/.exec(text);
  if (!head) continue;
  const body = text.slice(head[0].length);
  const k = {};
  if (!PRIMS.has(head[1])) for (const [name, re] of Object.entries(KINDS)) k[name] = (body.match(re) || []).length;
  const calls = new Set([...body.matchAll(/\(\s*(?:return_)?call\s+(\$[^\s()]+)/g)].map(m => m[1]));
  calls.delete(head[1]);
  funcs.set(head[1], { part: partAt(s), k, calls });
}
const has = (f, list) => list.some(x => f.k[x]);

// Nearest narrow write (or read) through `call` edges, up to DEPTH calls away.
function nearest(name, list) {
  const seen = new Map([[name, 0]]);
  let frontier = [name];
  const kinds = {};
  let best = null;
  for (let d = 0; d <= DEPTH && frontier.length; d++) {
    const next = [];
    for (const n of frontier) {
      const f = funcs.get(n);
      // The uop tier (07d/07e) has its own MERGE8L/8H/16L ops; entering a
      // program is not a threaded narrow write.
      if (!f || (d > 0 && /^07[de]-/.test(f.part))) continue;
      if (has(f, list)) { if (best === null) best = d; for (const x of list) if (f.k[x]) kinds[x] = (kinds[x] || 0) + f.k[x]; }
      for (const c of f.calls) if (!seen.has(c) && funcs.has(c)) { seen.set(c, d + 1); next.push(c); }
    }
    if (best !== null) break;
    frontier = next;
  }
  return best === null ? null : { depth: best, kinds };
}

// Handler index -> function name, from the elem list (as tools/hist-blocks.js).
const names = [];
for (const line of fs.readFileSync(path.join(__dirname, '..', 'src', '02-thread-table.wat'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*(\$[^\s()]+).*;;\s*(\d+)/);
  if (m) names[+m[2]] = m[1];
}
const handlers = names.map((fn, id) => {
  if (!fn) return null;
  return { id, fn, w: nearest(fn, WRITE), r: nearest(fn, READ) };
});

const fmtK = k => Object.entries(k || {}).map(([a, b]) => `${a}:${b}`).join(',');
const staticRows = handlers.filter(h => h && h.w);
const report = { depth: DEPTH, staticWriters: staticRows.length, sites: {}, logs: [] };
for (const x of [...WRITE, ...READ]) report.sites[x] = [...funcs.values()].reduce((a, f) => a + (f.k[x] || 0), 0);

if (!asJson) {
  console.log(`static: ${staticRows.length} handlers reach a partial-register write within ${DEPTH} calls `
    + `(${staticRows.filter(h => h.w.depth === 0).length} write it themselves)`);
  console.log(`sites: ${[...WRITE, ...READ].map(x => `${x}=${report.sites[x]}`).join(' ')}`);
  if (showSites) {
    for (const [n, f] of funcs) if (has(f, WRITE) || has(f, READ)) console.log(`  ${n}\tsrc/${f.part}\t${fmtK(f.k)}`);
  }
}

for (const file of logs) {
  const text = fs.readFileSync(file, 'utf8');
  const hits = new Map();
  let total = 0;
  // `  H<id> <name, may contain spaces> <hits> (<pct>%)`; pair rows are `H<a>->H<b>`.
  for (const m of text.matchAll(/^ {2}H(\d+) .*? (\d+) \([\d.]+%\)$/gm)) hits.set(+m[1], (hits.get(+m[1]) || 0) + +m[2]);
  const tm = text.match(/^\[handler-hist\] T\d+ batches=(\S+) total=(\d+)/m);
  total = tm ? +tm[2] : [...hits.values()].reduce((a, b) => a + b, 0);
  const printed = [...hits.values()].reduce((a, b) => a + b, 0);
  const byKind = Object.fromEntries(WRITE.map(x => [x, 0]));
  let w0 = 0, wAny = 0, rAny = 0;
  const rows = [];
  for (const [id, n] of hits) {
    const h = handlers[id];
    if (!h) continue;
    if (h.r) rAny += n;
    if (!h.w) continue;
    wAny += n;
    if (h.w.depth === 0) w0 += n;
    for (const x of Object.keys(h.w.kinds)) byKind[x] += n;
    rows.push({ id, fn: h.fn, hits: n, depth: h.w.depth, kinds: h.w.kinds });
  }
  rows.sort((a, b) => b.hits - a.hits);
  // The window's uop-tier block count, from the --hist-json the log names.
  let uop = null;
  const jm = text.match(/wrote histogram JSON to (\S+)/);
  if (jm && fs.existsSync(jm[1])) {
    const j = JSON.parse(fs.readFileSync(jm[1], 'utf8'));
    if (j.uop) {
      const share = (100 * j.uop.blocks / (j.uop.blocks + j.blockHits)).toFixed(1);
      uop = `uop tier ran ${j.uop.blocks} blocks vs ${j.blockHits} threaded block entries: ${share}% of blocks never dispatch a handler`;
    }
  }
  const pct = v => (total ? (100 * v / total).toFixed(2) : '0.00') + '%';
  const rec = { file, window: tm ? tm[1] : null, total, printed, writeAny: wAny, writeSelf: w0, readAny: rAny, byKind, top: rows.slice(0, TOP), uop };
  report.logs.push(rec);
  if (asJson) continue;
  console.log(`\n${file}: window ${rec.window} dispatches ${total}${printed < total ? ` (rows printed cover ${pct(printed)}; raise --handler-hist-top)` : ''}`);
  console.log(`  may write a partial reg: ${pct(wAny)} (writes it in the handler itself: ${pct(w0)}); reaches a partial read: ${pct(rAny)}`);
  console.log(`  by kind (a handler counts under every kind it reaches): ${WRITE.map(x => `${x} ${pct(byKind[x])}`).join('  ')}`);
  if (uop) console.log(`  ${uop.trim()}`);
  for (const r of rows.slice(0, TOP)) console.log(`    H${r.id} ${r.fn} ${r.hits} (${pct(r.hits)}) d=${r.depth} ${fmtK(r.kinds)}`);
}
if (asJson) process.stdout.write(JSON.stringify(report, null, 1) + '\n');
