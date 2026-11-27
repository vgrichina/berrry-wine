// tl;dr: print the 0x4a8a30 (var-list lookup) probe: hits by list, top (list,varid)
'use strict';
const D = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const p = D.probes.find(x => x.addr === '0x4a8a30');
const byList = new Map();
for (const [k, v] of Object.entries(p.hist)) { const l = k.split(',')[0]; byList.set(l, (byList.get(l) || 0) + v); }
console.log('lookups', p.hits, 'distinct lists', byList.size);
for (const [l, v] of [...byList].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(' list', l, v);
const name = id => { id = parseInt(id, 16); return id >= 100000 ? (D.names.uvar[id] || 'uvar#' + id) : 'id' + id; };
for (const [k, v] of Object.entries(p.hist).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(' ', k, name(k.split(',')[1]), v);
