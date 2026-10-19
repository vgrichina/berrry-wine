#!/usr/bin/env node
'use strict';
// Complete static inventory of candidate com(...) expressions. The independent
// ABI contract is reviewed against interface headers, not api_table nargs.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const { methodAt, methodArity } = require('../test/surface47-abi-contract');
const file = 'test/test-directdraw-surface47-abi-candidate.js';
const source = fs.readFileSync(path.join(root, file), 'utf8');
const table = require('../src/api_table.json');
const watFiles = fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.wat'));
function body(symbol) {
  for (const file of watFiles) {
    const text = fs.readFileSync(path.join(root, 'src', file), 'utf8');
    const start = text.indexOf(`(func $${symbol} `);
    if (start >= 0) {
      const next = text.indexOf('(func ', start + 6);
      return { file, text: text.slice(start, next < 0 ? undefined : next) };
    }
  }
  throw Error(`missing production function ${symbol}`);
}
function cleanup(name, pop) {
  const row = table.find(api => api.name === name);
  assert(row, name);
  let symbol = `handle_${row.handler || row.name}`;
  if (name === 'IDirectDraw_SetDisplayMode') symbol = 'dx_set_display_mode_pop';
  const fn = body(symbol);
  const epilogue = new RegExp('i32\\.store offset=16 \\(global\\.get \\$reg_base\\)\\s*\\(i32\\.add \\(i32\\.load offset=16 \\(global\\.get \\$reg_base\\)\\) \\(i32\\.const '+pop+'\\)');
  assert(epilogue.test(fn.text), `${name}: reviewed ${pop}-byte cleanup in ${symbol}`);
  return `${fn.file}:$${symbol}`;
}
const rows = [];
for (const match of source.matchAll(/\bcom\(/g)) {
  let depth = 1, end = match.index + 4, start = end, args = [];
  for (; end < source.length && depth; end++) {
    const ch = source[end];
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if ((ch === ',' && depth === 1) || depth === 0) {
      args.push(source.slice(start, end).trim()); start = end + 1;
    }
  }
  assert.strictEqual(depth, 0, 'balanced call');
  const [object, slotText] = args;
  const slot = slotText === 'initializeSlot' ? 23 : Number(slotText);
  assert(Number.isInteger(slot), slotText);
  let family = 'surface', version = undefined;
  if (['dd', 'dd4', 'dd1'].includes(object)) {
    family = 'ddraw'; version = { dd: 7, dd4: 4, dd1: 1 }[object];
  } else if (object === 'texture') family = 'texture';
  else if (object === 'obj' && match.index > source.indexOf('function displayMode(')
      && match.index < source.indexOf('function attached(')) family = 'ddraw';
  const contract = methodAt(family, slot, version);
  assert.strictEqual(args.length - 1, contract.nargs, `${object}:${slot} at ${match.index}`);
  assert.strictEqual(methodArity(contract.name, version), contract.nargs);
  const surfaceVersions = { made4: 'Surface4', madeLegacy: 'Surface2',
    upgraded: 'Surface7', plain: 'Surface7', surface4: 'Surface4', legacy: 'Surface1/2/3',
    mip: 'Surface7', mip1: 'Surface7', mip2: 'Surface7', front: 'Surface7', back: 'Surface7',
    ignored: 'Surface7', owner: 'Surface7', retained: 'Surface4' };
  const identity = family === 'ddraw' ? (version ? 'DirectDraw'+version : 'DirectDraw1/4/7')
    : family === 'texture' ? 'Texture2' : surfaceVersions[object]
      || (object.startsWith('read(') ? 'Surface7 (QI/callback owned reference)'
        : slot === 12 ? 'Surface7' : [0, 25, 32].includes(slot) ? 'Surface4/7'
          : 'Surface1/2/3/4/7');
  rows.push({ line: source.slice(0, match.index).split('\n').length, object,
    family: identity, slot, ...contract,
    cleanup: cleanup(contract.name, contract.pop) });
}
assert(rows.length > 60, 'complete inventory, including repeated releases');
// Explicitly cover the shared handler's two ABI forms even though this
// candidate only invokes SetDisplayMode on the factory-acquired DD7 object.
for (const version of [1, 2, 4, 7]) {
  const contract = methodAt('ddraw', 21, version);
  assert.strictEqual(contract.nargs, version === 1 ? 4 : 6);
  cleanup(contract.name, contract.pop);
}
if (process.argv.includes('--matrix')) {
  console.log('Surface47 candidate COM call-site matrix (source-only)');
  console.log('Source: '+file+'; count includes this; pop includes return address.');
  console.log('Header authorities: Wine include/ddraw.h, d3d.h and unknwn.idl.');
  console.log('line | receiver | interface | slot | method | args | pop | production cleanup');
  for (const r of rows) console.log([r.line,r.object,r.family,r.slot,r.name,r.nargs,r.pop,r.cleanup].join(' | '));
}
console.log(`PASS ${rows.length} COM call sites: independent prototype counts and production cleanup; SetDisplayMode versions1/2/4/7 verified`);
