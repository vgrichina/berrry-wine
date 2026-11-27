#!/usr/bin/env node
// tl;dr: set-B probes (helper@[esp]) -> per helper, callers by return address,
// labelled with the GML function ranges of blocks.js.   node callers.js PROBES.json
'use strict';
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, 'blocks.js'), 'utf8');
const FN = [...src.matchAll(/\[(0x[0-9a-f]+), (0x[0-9a-f]+), '([^']+)'\]/g)].map(m => [parseInt(m[1], 16), parseInt(m[2], 16), m[3]]);
const label = a => (FN.find(([s, e]) => a >= s && a < e) || [0, 0, ''])[2];
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const p of D.probes) {
  console.log(`\n${p.spec}  hits ${p.hits}`);
  for (const [k, v] of Object.entries(p.hist).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    const a = parseInt(k, 16);
    console.log(`  ${(100 * v / p.hits).toFixed(1).padStart(5)}%  ${String(v).padStart(9)}  ret 0x${k}  ${label(a)}`);
  }
}
