#!/usr/bin/env node
'use strict';
// Bounded source acceptance. Never compiles, dispatches, or refreshes a census.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const evidence = path.join(root, 'docs/re-notes/shadow-man-census-independent-accept-20261028');
const prior = path.join(root, 'docs/re-notes/shadow-man-callback-census-correction-20261028');
const pins = require(path.join(evidence, 'input-pins.json'));
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
for (const [file, pin] of Object.entries(pins)) assert.equal(sha(fs.readFileSync(path.join(root, file))), pin, file);
assert.equal(pins['tools/callback-ownership-census.js'], '680a13027e348a3c19cc8f4ec670e3046372372d6d674fb1cd32e8fe216e707e');
assert.equal(pins['tools/callback-ownership-census.json'], '233f4e59f9ee175ce6250db2102ed8aa972456244c7afad47da49c5b88f50643');
const {parseSource} = require('./watx');
const {scanWat, check} = require('./callback-ownership-census');
const census = require('./callback-ownership-census.json');
const original = JSON.parse(fs.readFileSync(path.join(prior, 'original-census.json')));
const groups = {
  'src/05-alu.wat': ['$th_pop_run_ret', '$th_ret', '$th_ret_imm'],
  'src/09b-dispatch.wat': ['$win32_dispatch', '$win32_dispatch_inner'],
  'src/13-exports.wat': ['$run', '$null_transfer_check', '$null_transfer_record'],
};
const id = e => e.file + ':' + e.name;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const render = n => Array.isArray(n) ? '(' + n.slice(1).map(render).join(' ') + ')' : n;
const flat = n => Array.isArray(n) ? [n, ...n.slice(2).flatMap(flat)] : [];
const forms = file => parseSource(fs.readFileSync(path.join(root, file), 'utf8'), file);
const fn = (file, name) => { const n = forms(file).find(n => n[1] === 'func' && n[2] === name); assert(n, name); return n; };
const before = new Map(original.entries.map(e => [id(e), e]));
const expected = Object.entries(groups).flatMap(([file, names]) => names.map(name => file + ':' + name));
const changed = [], added = [], untouched = [];
assert.equal(census.entries.length, 410);
for (const e of census.entries) {
  assert.equal(e.ownership, 'pending');
  const old = before.get(id(e));
  (old ? same(old, e) ? untouched : changed : added).push(id(e));
  before.delete(id(e));
}
assert.equal(before.size, 0);
assert.equal(untouched.length, 402);
assert.equal(changed.length, 6);
assert.deepEqual(added.sort(), ['src/13-exports.wat:$null_transfer_check', 'src/13-exports.wat:$null_transfer_record']);
assert.deepEqual([...changed, ...added].sort(), [...expected].sort());
const results = [], contracts = [];
function rejects(label, actual, lock, reason) {
  const errors = check(actual, lock);
  assert(errors.some(e => reason.test(e)), label + ': ' + errors.join('; '));
  results.push({label, errors});
}
function includes(tree, text) { assert(render(tree).includes(text), tree[2] + ': missing ' + text); }
function ordered(tree, ...texts) {
  const s = render(tree); let pos = -1;
  for (const text of texts) { const next = s.indexOf(text, pos + 1); assert(next > pos, tree[2] + ': order ' + text); pos = next; }
}
for (const [file, names] of Object.entries(groups)) for (const name of names) {
  const tree = fn(file, name), source = render(tree);
  const entry = census.entries.find(e => id(e) === file + ':' + name);
  const actual = scanWat(source, file), lock = {version: 1, entries: [entry]};
  assert.deepEqual(check(actual, lock), []);
  const expectedKind = file.includes('05-alu') ? 'guest-control' : name === '$run' ? 'host-entry' : name.startsWith('$null_transfer_') ? 'context-restore' : 'mixed-dispatch';
  assert.equal(entry.kind, expectedKind);
  assert(entry.reason.includes('pending') && entry.reason.includes('2026-10-28'));
  rejects(name + ': unknown', actual, {version: 1, entries: []}, /unknown producer/);
  const drift = structuredClone(tree); drift.push([0, 'nop']);
  rejects(name + ': body drift', scanWat(render(drift), file), lock, /\(sha256\)/);
  for (const ownership of [undefined, 'proven', 'accepted', 'owned'])
    rejects(name + ': ownership ' + ownership, actual, {version: 1, entries: [{...entry, ownership}]}, /unsupported ownership assertion/);
  rejects(name + ': invalid lifetime kind', actual, {version: 1, entries: [{...entry, kind: 'retained-owner-proven'}]}, /unreviewed producer/);
  rejects(name + ': missing provenance', actual, {version: 1, entries: [{...entry, reason: ''}]}, /unreviewed producer/);
  if (entry.targets.length) {
    const stale = structuredClone(tree);
    flat(stale).find(n => n[1] === 'global.set' && n[2] === '$eip')[3] = [0, 'i32.const', '8675309'];
    const scanned = scanWat(render(stale), file);
    rejects(name + ': stale target after body-only refresh', scanned,
      {version: 1, entries: [{...entry, sha256: scanned[0].sha256}]}, /\(targets\)/);
  }
  if (name.startsWith('$null_transfer_')) {
    assert.equal(entry.writes, 0); assert.equal(entry.ownershipWrites, undefined);
    assert.deepEqual(Array.from(actual[0].boundaryCalls), ['$invocation_current']);
    for (const n of flat(tree)) {
      if (n[1] === 'global.set') assert(n[2].startsWith('$null_transfer_'));
      if (n[1] === 'call') assert.equal(n[2], '$invocation_current');
      assert(!['call_indirect', 'return_call', 'return_call_indirect', 'i32.store', 'i64.store'].includes(n[1]));
    }
    for (let i = 0; i < tree.length; i++) if (Array.isArray(tree[i]) && tree[i][1] === 'if') {
      const removed = structuredClone(tree); removed.splice(i, 1);
      rejects(name + ': removed guard ' + i, scanWat(render(removed), file), lock, /changed producer|stale producer/);
    }
  }
  contracts.push({file, name, kind: entry.kind, sha256: entry.sha256, targets: entry.targets,
    boundaryCalls: entry.boundaryCalls, directCalls: flat(tree).filter(n => ['call', 'return_call'].includes(n[1])).map(n => n[2])});
}
// Source-derived semantic checks, separate from accepting a matching digest.
for (const [name, kind] of [['$th_ret', 2], ['$th_ret_imm', 3], ['$th_pop_run_ret', 4]]) {
  const t = fn('src/05-alu.wat', name);
  ordered(t, '(call $th_ret_guard16)', '(local.set $ret', '(call $null_transfer_record (i32.const ' + kind + ') (local.get $ret)', '(global.set $eip (local.get $ret))', '(call $cs_pop)', '(return_call $branch_end)');
  includes(t, '(local.get $ret) (i32.const 0) (i32.const 0)');
  if (kind === 4) { ordered(t, '(call $stack_run_pop', '(call $th_ret_guard16)'); includes(t, '(global.get $sr_fast)'); includes(t, '(global.get $sr_delta)'); includes(t, '(call $gl32 (local.get $cur))'); }
  else includes(t, '(local.set $ret (call $gl32 (local.get $esp)))');
}
const record = fn('src/13-exports.wat', '$null_transfer_record');
ordered(record, '(if (i32.eqz (global.get $null_transfer_on))', '(global.set $null_transfer_kind (i32.const 0))', '(if (local.get $target)', '(i32.eqz (global.get $null_transfer_thunk_entry))', '(i32.ne (global.get $eip) (local.get $thunk))', '(global.set $null_transfer_pre_eip', '(global.set $null_transfer_token (call $invocation_current))', '(global.set $null_transfer_kind (local.get $kind))');
const checker = fn('src/13-exports.wat', '$null_transfer_check');
for (const field of ['count', 'depth', 'token', 'root', 'post_esp']) includes(checker, '(global.get $null_transfer_' + field + ')');
assert.equal(checker.filter(n => Array.isArray(n) && n[1] === 'if').length, 6);
const current = fn('src/04-cache.wat', '$invocation_current');
assert.deepEqual(flat(current).filter(n => n[1] === 'call').map(n => n[2]), ['$invocation_validate']);
for (const t of [current, fn('src/04-cache.wat', '$invocation_validate')])
  assert(!flat(t).some(n => n[1] === 'global.set' || /store/.test(n[1])));
const run = fn('src/13-exports.wat', '$run');
ordered(run, '(global.set $null_transfer_kind (i32.const 0))', '(global.set $null_transfer_thunk_entry (i32.const 0))', '(call $anim_service)');
ordered(run, '(call $null_transfer_check)', '(call $null_diag_event (i32.const 5)', '(global.set $null_transfer_kind (i32.const 0))');
ordered(run, '(global.set $null_transfer_thunk_entry (global.get $null_transfer_on))', '(call $win32_dispatch', '(global.set $null_transfer_thunk_entry (i32.const 0))');
const inner = fn('src/09b-dispatch.wat', '$win32_dispatch_inner');
ordered(inner, '(i32.const 0xCACA0005)', '(global.set $handler_set_eip (i32.const 1))', '(call $null_transfer_record (i32.const 1) (i32.const 0)', '(global.set $eip (i32.const 0))');
const outer = fn('src/09b-dispatch.wat', '$win32_dispatch');
ordered(outer, '(call $win32_dispatch_inner', '(call $rsrc_release_api_pins)', '(global.set $null_transfer_kind (i32.const 0))', '(call $dll_unload_yield');
console.log(JSON.stringify({verdict: 'PASS_BOUNDED_SOURCE_INVENTORY', changed, added, untouched: untouched.length,
  unchangedEntriesSHA256: sha(JSON.stringify(census.entries.filter(e => untouched.includes(id(e))))),
  inputPins: Object.keys(pins).length, contracts, rejectingControls: results.length, results,
  ownership: 'PENDING', writer: 'UNPROVEN', historical61e1ea2d: 'REJECTED', runtime: 'UNQUALIFIED'}, null, 2));
