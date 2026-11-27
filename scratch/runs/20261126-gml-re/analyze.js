#!/usr/bin/env node
// tl;dr: GM8 GML histograms from one gml-dump.js file.
//
//   value probes (counts per node pointer / code object / ESP)  +  node memory
//     -> node-kind histogram (eval + statements), var owner/kind split,
//        operator split, builtin/script call frequency, numeric-only share,
//        hottest code objects and their concentration, nesting depth.
//
//   node analyze.js DUMP.json [--json=OUT] > report.txt
'use strict';
const fs = require('fs');
const [file] = process.argv.slice(2);
const jsonOut = (process.argv.find(a => a.startsWith('--json=')) || '').slice(7);
const D = JSON.parse(fs.readFileSync(file, 'utf8'));
const probe = addr => D.probes.find(p => p.addr === addr && /@edx$|@ecx$|@eax$/.test(p.spec));
const probeSpec = s => D.probes.find(p => p.spec === s);
const N = D.nodes;
const out = {};
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0').padStart(5);
const table = (title, rows, total, top = 40) => {
  console.log(`\n${title} (total ${total})`);
  for (const [k, v] of rows.slice(0, top)) console.log(`  ${pct(v, total)}%  ${String(v).padStart(10)}  ${k}`);
};
const sortMap = m => [...m.entries()].sort((a, b) => b[1] - a[1]);
const bump = (m, k, v) => m.set(k, (m.get(k) || 0) + v);

const OWNER = { '-1': 'self', '-2': 'other', '-3': 'all', '-4': 'noone', '-5': 'global', '-6': 'global-or-self(-6)', '-7': 'local(var)' };
const UNOP = { 203: '!', 210: '+u', 211: '-u', 220: '~' };
const BINOP = { 101: '= (cmp)', 201: '&&', 202: '||', 204: '<', 205: '<=', 206: '==', 207: '!=', 208: '>=', 209: '>',
  210: '+', 211: '-', 212: '*', 213: '/', 214: 'div/mod(214)' };
const KIND = { 5: 'const', 6: 'call', 7: 'var(owner/index expr)', 8: 'var(simple)', 1010: 'unary', 1011: 'binary' };
const STMT = { 6: 'call', 13: 'if', 16: 'while', 17: 'do-until', 18: 'for', 20: 'repeat', 21: 'exit', 22: 'break', 23: 'continue',
  24: 'with', 25: 'return', 26: 'switch', 29: 'empty', 30: 'var/globalvar decl', 101: 'assign', 1000: 'block' };
const fnName = id => id >= 500000 ? `ext#${id - 500000}` : id >= 100000 ? `script#${id - 100000}` : (D.names.fn[id] || `fn#${id}`);
const varName = id => id >= 100000 ? (D.names.uvar[id] || `uvar#${id}`) : (D.names.bvar[id] || `bvar#${id}`);
const ownerName = o => OWNER[o] || (o >= 100000 ? 'instance-id' : 'object');

// --- eval nodes
const ev = probe('0x52786c');
const evCount = new Map(Object.entries(ev.hist).map(([k, v]) => [k, v]));
const evTotal = ev.hits;
const kinds = new Map(), varOwner = new Map(), varKinds = new Map(), ops = new Map(), calls = new Map(), consts = new Map();
const varNames = new Map();
for (const [k, c] of evCount) {
  const n = N[k];
  if (!n) { bump(kinds, 'unread', c); continue; }
  const name = KIND[n.kind] || `kind ${n.kind}`;
  bump(kinds, name, c);
  if (n.kind === 5) bump(consts, n.tag === 1 ? 'string' : 'real', c);
  if (n.kind === 7 || n.kind === 8) {
    const builtin = n.id < 10000;
    bump(varOwner, `${ownerName(n.owner)}${n.kind === 7 ? ' (owner expr / index)' : ''}`, c);
    bump(varKinds, `${builtin ? 'builtin' : 'user'} ${ownerName(n.owner)}`, c);
    bump(varNames, `${varName(n.id)} [${ownerName(n.owner)}]`, c);
  }
  if (n.kind === 1010) bump(ops, `unary ${UNOP[n.id] || n.id}`, c);
  if (n.kind === 1011) bump(ops, `binary ${BINOP[n.id] || n.id}`, c);
  if (n.kind === 6) bump(calls, fnName(n.id), c);
}
table('eval node kinds (0x52786c entries)', sortMap(kinds), evTotal);
table('constants', sortMap(consts), [...consts.values()].reduce((a, b) => a + b, 0));
const varTotal = [...varOwner.values()].reduce((a, b) => a + b, 0);
table('variable reads by owner', sortMap(varOwner), varTotal);
table('variable reads builtin/user x owner', sortMap(varKinds), varTotal);
table('hottest variables read', sortMap(varNames), varTotal, 30);
table('operators', sortMap(ops), [...ops.values()].reduce((a, b) => a + b, 0));

// --- statements
const st = probe('0x5288ac');
const stKinds = new Map(), assignTargets = new Map(), stCalls = new Map();
for (const [k, c] of Object.entries(st.hist)) {
  const n = N[k];
  if (!n) { bump(stKinds, 'unread', c); continue; }
  bump(stKinds, STMT[n.kind] || `kind ${n.kind}`, c);
  if (n.kind === 101 && n.children.length) {
    const lv = N[n.children[0]];
    if (lv) bump(assignTargets, `${lv.id < 10000 ? 'builtin' : 'user'} ${ownerName(lv.owner)}${lv.kind === 7 ? ' (expr/index)' : ''} op${n.id}`, c);
  }
  if (n.kind === 6) bump(stCalls, fnName(n.id), c);
}
table('statement kinds (0x5288ac entries)', sortMap(stKinds), st.hits);
table('assignment targets', sortMap(assignTargets), [...assignTargets.values()].reduce((a, b) => a + b, 0));

// --- calls (expression + statement)
const allCalls = new Map(calls);
for (const [k, v] of stCalls) bump(allCalls, k, v);
const callTotal = [...allCalls.values()].reduce((a, b) => a + b, 0);
table('function calls by name (expr + statement)', sortMap(allCalls), callTotal, 50);
const callClass = new Map();
for (const [k, v] of allCalls) bump(callClass, k.startsWith('script#') ? 'script' : k.startsWith('ext#') ? 'extension' : 'builtin', v);
table('function call classes', sortMap(callClass), callTotal);

// --- numeric-only subtrees (static): const real, var reads with numeric
// index/owner subtrees, unary/binary arithmetic+comparison. A call or a
// string constant anywhere makes the subtree non-numeric.
const memo = new Map();
const numeric = key => {
  if (memo.has(key)) return memo.get(key);
  memo.set(key, false);
  const n = N[key];
  let ok = !!n;
  if (ok) {
    if (n.kind === 5) ok = n.tag === 0;
    else if (n.kind === 8) ok = true;
    else if (n.kind === 7 || n.kind === 1010 || n.kind === 1011) ok = n.children.every(numeric);
    else ok = false;
  }
  memo.set(key, ok);
  return ok;
};
// Roots = eval nodes that no other counted eval node lists as a child.
const childOf = new Set();
for (const k of evCount.keys()) { const n = N[k]; if (n && n.kind !== 6) for (const c of n.children) childOf.add(c); }
// call args are evaluated by the call, also children
for (const k of evCount.keys()) { const n = N[k]; if (n && n.kind === 6) for (const c of n.children) childOf.add(c); }
let rootEvals = 0, rootNumeric = 0, allNumeric = 0, rootNumericNodes = 0;
const rootShape = new Map();
for (const [k, c] of evCount) {
  if (numeric(k)) allNumeric += c;
  if (childOf.has(k)) continue;
  rootEvals += c;
  if (numeric(k)) { rootNumeric += c; }
  const n = N[k];
  bump(rootShape, n ? `${KIND[n.kind] || n.kind}${numeric(k) ? ' numeric' : ''}` : 'unread', c);
}
// evals inside numeric roots (subtree sizes weighted by root count)
const subSize = key => { const n = N[key]; if (!n) return 0; return 1 + n.children.reduce((a, c) => a + subSize(c), 0); };
for (const [k, c] of evCount) if (!childOf.has(k) && numeric(k)) rootNumericNodes += c * subSize(k);
console.log(`\nnumeric-only (static): ${pct(allNumeric, evTotal)}% of all eval entries are numeric-only subtrees;`);
console.log(`  expression roots: ${rootEvals} evals, numeric-only roots ${pct(rootNumeric, rootEvals)}%;`);
console.log(`  eval entries inside numeric-only roots (root count x subtree size) ${rootNumericNodes} = ${pct(rootNumericNodes, evTotal)}% of all eval entries`);
table('expression root shapes', sortMap(rootShape), rootEvals);

// --- value tags of results (dynamic)
for (const p of D.probes) if (/@\[edi\]$/.test(p.spec)) table(`result tags at ${p.addr} (0 real, 1 string)`, Object.entries(p.hist), p.hits);

// --- code objects: exec count and statement+eval work in their own tree
const codes = probe('0x528b3c');
if (codes) {
  const work = new Map();
  const stCount = new Map(Object.entries(st.hist));
  const subtreeWork = (key, seen) => {
    if (seen.has(key)) return 0;
    seen.add(key);
    const n = N[key]; if (!n) return 0;
    let w = (evCount.get(key) || 0) + (stCount.get(key) || 0);
    for (const c of n.children) w += subtreeWork(c, seen);
    return w;
  };
  // The root executed is a stack copy of code+0x10, so its own count is under
  // a stack key; its children are the shared static nodes.
  for (const [k, c] of Object.entries(codes.hist)) {
    const info = D.codes[k];
    const rootN = info && N[info.root];
    let w = 0;
    if (rootN) { const seen = new Set(); for (const ch of rootN.children) w += subtreeWork(ch, seen); }
    work.set(k, { execs: c, work: w, root: rootN ? (STMT[rootN.kind] || KIND[rootN.kind] || rootN.kind) : '?' });
  }
  const totalWork = [...work.values()].reduce((a, b) => a + b.work, 0);
  const rows = [...work.entries()].sort((a, b) => b[1].work - a[1].work);
  console.log(`\ncode objects executed (0x528b3c): ${codes.hits} executions, ${rows.length} distinct; work = eval+statement entries in own tree (total ${totalWork})`);
  let acc = 0;
  rows.forEach(([k, v], i) => {
    acc += v.work;
    if (i < 25) console.log(`  ${pct(v.work, totalWork)}% cum ${pct(acc, totalWork)}%  execs ${String(v.execs).padStart(8)}  code 0x${k} root ${v.root}`);
  });
  const cum = n => pct(rows.slice(0, n).reduce((a, r) => a + r[1].work, 0), totalWork);
  console.log(`  concentration: top1 ${cum(1)}%  top5 ${cum(5)}%  top10 ${cum(10)}%  top20 ${cum(20)}%  top50 ${cum(50)}%`);
  out.codes = rows.slice(0, 50).map(([k, v]) => ({ code: k, ...v }));
}

// --- nesting depth from ESP at code execution
for (const p of D.probes) {
  if (!/@esp/.test(p.spec)) continue;
  const rows = Object.entries(p.hist).map(([k, v]) => [parseInt(k, 16), v]).sort((a, b) => b[0] - a[0]);
  const top = rows.length ? rows[0][0] : 0;
  console.log(`\nstack position at ${p.spec} (bucket units below the shallowest seen)`);
  for (const [k, v] of rows.slice(0, 30)) console.log(`  ${String(top - k).padStart(6)}  ${pct(v, p.hits)}%  ${v}`);
}

out.kinds = Object.fromEntries(kinds); out.stKinds = Object.fromEntries(stKinds); out.calls = Object.fromEntries(sortMap(allCalls));
out.ops = Object.fromEntries(ops); out.varOwner = Object.fromEntries(varOwner);
out.numeric = { evTotal, allNumeric, rootEvals, rootNumeric, rootNumericNodes };
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out, null, 1));
