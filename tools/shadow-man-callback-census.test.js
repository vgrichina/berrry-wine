#!/usr/bin/env node
'use strict';
// Exact production AST/scanner controls only: no compilation or execution.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {parseSource} = require('./watx');
const {scanWat, check} = require('./callback-ownership-census');
const census = require('./callback-ownership-census.json');
const groups = {
  'src/05-alu.wat': ['$th_ret', '$th_ret_imm', '$th_pop_run_ret'],
  'src/09b-dispatch.wat': ['$win32_dispatch', '$win32_dispatch_inner'],
  'src/13-exports.wat': ['$null_transfer_record', '$null_transfer_check', '$run'],
};
const render = node => Array.isArray(node) ? `(${node.slice(1).map(render).join(' ')})` : node;
function walk(node, visit) {
  if (!Array.isArray(node)) return;
  visit(node);
  for (const child of node.slice(2)) walk(child, visit);
}
let producers = 0, negatives = 0, targetControls = 0, guardControls = 0;
for (const [file, names] of Object.entries(groups)) {
  const forms = parseSource(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), file);
  for (const name of names) {
    const fn = forms.find(n => n[1] === 'func' && n[2] === name);
    assert(fn, name);
    const scan = tree => scanWat(render(tree), file);
    const entry = census.entries.find(e => e.file === file && e.name === name);
    assert(entry && entry.reason.includes('2026-10-28') && entry.reason.includes('pending'));
    const lock = {version: 1, entries: [entry]};
    const original = scan(fn);
    assert.deepStrictEqual(check(original, lock), []);
    producers++;
    assert(check(original, {version: 1, entries: []}).some(e => e.includes('unknown producer')));
    negatives++;
    for (const ownership of [undefined, 'covered', 'proven']) {
      assert(check(original, {version: 1, entries: [{...entry, ownership}]}).some(e => e.includes('unsupported ownership assertion')));
      negatives++;
    }
    const body = structuredClone(fn);
    body.push([0, 'nop']);
    const changed = scan(body);
    assert.strictEqual(JSON.stringify(changed[0].targets), JSON.stringify(entry.targets));
    assert.strictEqual(JSON.stringify(changed[0].boundaryCalls), JSON.stringify(entry.boundaryCalls));
    assert(check(changed, lock).some(e => e.includes('(sha256)')), `${name}: body identity`);
    negatives++;
    if (entry.targets.length) {
      const tree = structuredClone(fn);
      let done = false;
      walk(tree, n => {
        if (!done && n[1] === 'global.set' && n[2] === '$eip') {
          n[3] = [0, 'i32.const', '1234567']; done = true;
        }
      });
      assert(done);
      const actual = scan(tree);
      const hashOnly = {version: 1, entries: [{...entry, sha256: actual[0].sha256}]};
      assert(check(actual, hashOnly).some(e => e.includes('(targets)')), `${name}: hash refresh cannot hide changed EIP target`);
      negatives++; targetControls++;
    }
    if (['$null_transfer_record', '$null_transfer_check'].includes(name)) {
      // Removing invalidation/route guards must still reject despite unchanged
      // EIP-write count. The current-token guard also pins its boundary call.
      for (let i = 0; i < fn.length; i++) {
        if (!Array.isArray(fn[i]) || fn[i][1] !== 'if') continue;
        const tree = structuredClone(fn); tree.splice(i, 1);
        assert(check(scan(tree), lock).some(e => /changed producer|stale producer/.test(e)), `${name}: omitted guard ${i}`);
        negatives++; guardControls++;
      }
      const actual = scan(fn);
      const wrongBoundary = {version: 1, entries: [{...entry, boundaryCalls: []}]};
      assert(check(actual, wrongBoundary).some(e => e.includes('(boundaryCalls)')));
      negatives++;
      walk(fn, n => {
        if (n[1] === 'global.set') assert(String(n[2]).startsWith('$null_transfer_'));
        if (n[1] === 'call') assert.strictEqual(n[2], '$invocation_current');
      });
      assert.strictEqual(entry.writes, 0);
      assert.strictEqual(entry.ownershipWrites, undefined);
    }
  }
}
assert.strictEqual(producers, 8);
assert.strictEqual(targetControls, 6);
assert.strictEqual(guardControls, 10);
console.log(JSON.stringify({verdict: 'PASS_SOURCE_INVENTORY_ONLY', producers, negatives,
  targetControls, guardControls, ownership: 'pending', runtime: 'UNQUALIFIED', writer: 'UNPROVEN'}));
