#!/usr/bin/env node
// tl;dr: reads the passive --count-census logs fold-bench took (register value
// at helper entry, keyed with the return address) and prints, per helper and
// register, how concentrated the argument values are: total calls, distinct
// values, share of the top-1 / top-2 / top-3 values, and how many call sites
// (return addresses) each top value arrives from. This is the input a value
// specialiser would key on. Counting only; no emulator run.
//
// usage: node arg-profile.js census-ecx.log census-edx.log
'use strict';
const fs = require('fs');

const names = {
  0x0040674c: '_CopyRecord', 0x00405988: '_LStrAsg', 0x004030a8: 'System.Move',
  0x004064e8: '_FinalizeRecord', 0x00406534: '_FinalizeArray',
  0x00406448: '_InitializeRecord', 0x00405934: '_LStrClr',
};

const rows = new Map(); // key "va reg" -> Map(value -> {n, sites:Set})
for (const file of process.argv.slice(2)) {
  const text = fs.readFileSync(file, 'utf8');
  const re = /slot \d+ 0x([0-9a-f]+) (\w+)=0x([0-9a-f]+) ret=0x([0-9a-f]+) n=(\d+)/g;
  let m;
  while ((m = re.exec(text))) {
    const va = parseInt(m[1], 16), reg = m[2], val = parseInt(m[3], 16);
    const ret = parseInt(m[4], 16), n = Number(m[5]);
    const key = `${va} ${reg}`;
    if (!rows.has(key)) rows.set(key, new Map());
    const vals = rows.get(key);
    if (!vals.has(val)) vals.set(val, { n: 0, sites: new Set() });
    const v = vals.get(val);
    v.n += n; v.sites.add(ret);
  }
}

const hex = (x) => '0x' + x.toString(16).padStart(8, '0');
console.log('helper              reg   calls     distinct  top1%   top2%   top3%   top values (share, call sites)');
for (const [key, vals] of rows) {
  const [va, reg] = key.split(' ');
  const list = [...vals.entries()].sort((a, b) => b[1].n - a[1].n);
  const total = list.reduce((s, [, v]) => s + v.n, 0);
  const cum = (k) => (100 * list.slice(0, k).reduce((s, [, v]) => s + v.n, 0) / total).toFixed(1);
  const tops = list.slice(0, 3).map(([val, v]) => `${hex(val)} ${(100 * v.n / total).toFixed(1)}% (${v.sites.size})`).join(', ');
  console.log(`${(names[va] || hex(+va)).padEnd(19)} ${reg.padEnd(5)} ${String(total).padEnd(9)} ${String(list.length).padEnd(9)} ${cum(1).padStart(5)}  ${cum(2).padStart(5)}  ${cum(3).padStart(5)}   ${tops}`);
}
