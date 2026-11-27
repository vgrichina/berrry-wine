#!/usr/bin/env node
'use strict';

// Markdown matrix from run.js output.
//
//   node tools/wat-microbench/report.js --res=DIR [--md=FILE]
//
// Reads DIR/summary.json and DIR/check.json. For every program, one table:
// rows are variants, columns engines; a cell is median(variant) /
// median(control) on that engine (lower = faster), the control row shows its
// absolute ns per guest op, the `~copy` row is the null band. `n/a` = the
// engine cannot run the module (feature missing / engine bug, see the
// availability table), `WRONG` = it ran and returned a different checksum.
// A ratio is marked `*` when its whole min..max range over repetitions lies
// on one side of 1 by more than that engine's null band for the program.
// Per-variant geomeans over engine classes (opt JIT / baseline / interpreter
// / wasm2c) follow each table.

const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const res = path.resolve(args.res || 'scratch/wat-microbench/results');
const S = JSON.parse(fs.readFileSync(path.join(res, 'summary.json'), 'utf8'));
const C = JSON.parse(fs.readFileSync(path.join(res, 'check.json'), 'utf8'));

const ORDER = ['v8-tf', 'node', 'sm-ion', 'jsc', 'wasmtime', 'wasmer', 'v8-liftoff', 'sm-baseline', 'jsc-bbq', 'wasmer-singlepass', 'jsc-ipint', 'wasm3', 'wasmi', 'wasmtime-pulley', 'v8-drumbrake', 'wasm2c'];
const CLASS = {
  'opt JIT': ['v8-tf', 'node', 'sm-ion', 'jsc', 'wasmtime', 'wasmer'],
  baseline: ['v8-liftoff', 'sm-baseline', 'jsc-bbq', 'wasmer-singlepass'],
  interp: ['jsc-ipint', 'wasm3', 'wasmi', 'wasmtime-pulley', 'v8-drumbrake'],
  wasm2c: ['wasm2c'],
};
const engines = ORDER.filter((e) => C.engines[e] !== undefined);
const short = { 'v8-tf': 'V8 TF', node: 'node', 'sm-ion': 'SM Ion', jsc: 'JSC', wasmtime: 'wt CL', wasmer: 'wasmer CL', 'v8-liftoff': 'Liftoff', 'sm-baseline': 'SM base', 'jsc-bbq': 'JSC BBQ', 'wasmer-singlepass': 'wasmer SP', 'jsc-ipint': 'JSC IPInt', wasm3: 'wasm3', wasmi: 'wasmi', 'wasmtime-pulley': 'Pulley', 'v8-drumbrake': 'DrumBrake', wasm2c: 'wasm2c' };

const rows = S.rows;
const byProg = {};
for (const r of rows) (byProg[`${r.family}.${r.program}`] ||= []).push(r);
const manifestIds = Object.keys(C.results).map((k) => k.split('|')[0]);
const out = [];
const gm = (a) => (a.length ? Math.exp(a.reduce((s, x) => s + Math.log(x), 0) / a.length) : null);

out.push(`Host: ${S.host.cpus} (${S.host.ncpu} vCPU, ${S.host.arch}, ${S.host.platform} ${S.host.release})`, '');
const progs = [...new Set(manifestIds.map((id) => id.split('.').slice(0, 2).join('.')))];
for (const pk of progs) {
  const rs = byProg[pk] || [];
  const variants = [...new Set(manifestIds.filter((id) => id.startsWith(pk + '.')).map((id) => id.slice(pk.length + 1)))];
  const ctlName = variants.find((v) => rs.some((r) => r.variant === v && r.control)) || variants[0];
  out.push(`### ${pk}`, '');
  out.push(`| variant | ${engines.map((e) => short[e] || e).join(' | ')} |`);
  out.push(`|---|${engines.map(() => '---:').join('|')}|`);
  const band = {};
  for (const e of engines) {
    const cp = rs.find((r) => r.engine === e && r.variant.endsWith('~copy'));
    band[e] = cp ? Math.abs(cp.ratio - 1) : null;
  }
  const order = [ctlName, ...variants.filter((v) => v !== ctlName && !v.endsWith('~copy')), ...variants.filter((v) => v.endsWith('~copy'))];
  const classGm = {};
  for (const v of order) {
    const cells = engines.map((e) => {
      const r = rs.find((x) => x.engine === e && x.variant === v);
      const ck = C.results[`${pk}.${v}|${e}`];
      if (!r) return ck && ck.error ? (/WRONG/.test(ck.error) ? 'WRONG' : 'n/a') : '-';
      if (v === ctlName) return `**${r.median.toFixed(2)}ns**`;
      const b = band[e] ?? 0;
      const sig = (r.ratioMax < 1 - b) || (r.ratioMin > 1 + b);
      return `${r.ratio.toFixed(2)}${sig && !v.endsWith('~copy') ? '*' : ''}`;
    });
    out.push(`| ${v}${v === ctlName ? ' (control)' : ''} | ${cells.join(' | ')} |`);
    if (v !== ctlName && !v.endsWith('~copy')) {
      classGm[v] = {};
      for (const [cl, es] of Object.entries(CLASS)) {
        const xs = rs.filter((r) => r.variant === v && es.includes(r.engine)).map((r) => r.ratio);
        classGm[v][cl] = gm(xs);
      }
    }
  }
  out.push('');
  out.push(`| geomean ratio | ${Object.keys(CLASS).join(' | ')} |`, `|---|${Object.keys(CLASS).map(() => '---:').join('|')}|`);
  for (const [v, g] of Object.entries(classGm)) {
    out.push(`| ${v} | ${Object.keys(CLASS).map((cl) => (g[cl] ? g[cl].toFixed(2) : '-')).join(' | ')} |`);
  }
  out.push('');
}

out.push('### engine availability', '', '| engine | version | modules run | n/a | wrong |', '|---|---|---:|---:|---:|');
for (const e of engines) {
  let ok = 0, na = 0, wrong = 0;
  for (const [k, r] of Object.entries(C.results)) {
    if (!k.endsWith('|' + e)) continue;
    if (!r.error) ok++; else if (/WRONG/.test(r.error)) wrong++; else na++;
  }
  out.push(`| ${e} | ${C.engines[e]} | ${ok} | ${na} | ${wrong} |`);
}
out.push('');
const text = out.join('\n');
if (args.md) fs.writeFileSync(path.resolve(args.md), text);
else process.stdout.write(text);
