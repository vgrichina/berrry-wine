#!/usr/bin/env node
'use strict';

// The WATX pass-1 facts, checked against what the module actually contains:
//
//   1. compile(..., { facts: true }) — the WATX pass-1 facts. Opt-in, read-only:
//      the binary with facts on is the binary with facts off, and the facts say
//      what the module actually contains (declarations as lowered, the export
//      surface with resolved targets and signatures, function/global index
//      spaces, data segments, regions as allocated).
//   2. export-wrap and compile-time facts — every function export with the
//      wrappers applied to it, its implementation and inferred purity; every
//      option, constant and target, and per file what its forms read.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const watx = require('../tools/watx.js');
const { compileClosure } = require('../tools/watx-closure.js');

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); checks++; };

// ── 1. facts ────────────────────────────────────────────────────────────────
const moduleSource = `
(memory 4 4)
(region.declare-fixed $TABLE (base 0x1000) (size 0x100) (owner "fixture:$t"))
(enum Kind (A 1) (B 2))
(layout Pair (field lo i32) (field hi u16) (field pad u8 2))
(layout-union Obj (tag kind Kind)
  (prefix (field handle i32) (field kind i32))
  (variant ObjA (tag-value A) (field a i32))
  (variant ObjB (tag-value B) (field b0 i32) (field b1 i32)))
(global $counter (mut i32) (i32.const 7))
(global $TABLE_BASE i32 (region.addr $TABLE 16))
(data (i32.const 0x2000) "hello")
(func $add (export "add") (param $x i32) (param $y i32) (result i32)
  (i32.add (local.get $x) (local.get $y)))
(func $bump (export "bump") (global.set $counter (i32.add (global.get $counter) (i32.const 1))))
(export "counter" (global $counter))
(export "memory" (memory 0))`;
const opts = { mode: 'production', standardWat: true, runtimeBuiltins: false, tailCalls: true };
const plain = watx.compile(moduleSource, new Map(), opts);
const withFacts = watx.compile(moduleSource, new Map(), { ...opts, facts: true });
ok(plain.success, plain.error);
ok(withFacts.success, withFacts.error);
eq(Buffer.from(withFacts.wasmBinary), Buffer.from(plain.wasmBinary), 'facts must not change the binary');
ok(plain.facts === undefined, 'facts are opt-in');
// Plain data all the way down: nothing a JSON round trip would drop or change.
(function plainData(v, where) {
  const tag = Object.prototype.toString.call(v);
  if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return;
  ok(tag === '[object Array]' || tag === '[object Object]', `facts value at ${where} is ${tag}`);
  for (const [k, x] of Object.entries(v)) plainData(x, `${where}.${k}`);
})(withFacts.facts, 'facts');
// The compiler runs in its own vm realm; compare as data.
const f = JSON.parse(JSON.stringify(withFacts.facts));
const decl = (type, name) => f.declarations.find(d => d.type === type && d.name === name);
eq(decl('layout-lowered', 'Pair').fields.map(x => [x.name, x.offset, x.size]), [['lo', 0, 4], ['hi', 4, 2], ['pad', 6, 2]]);
eq(decl('layout-lowered', 'Pair').totalSize, 8);
eq(decl('enum-lowered', 'Kind').members, { A: 1, B: 2 });
const u = decl('union-lowered', 'Obj');
eq(u.variants.map(v => [v.name, v.tagValues]), [['ObjA', [1]], ['ObjB', [2]]]);
eq(u.tagField.offset, 4);
eq(decl('layout-lowered', 'ObjB').fields.find(x => x.name === 'b1').offset, 12);
const exp = Object.fromEntries(f.exports.map(e => [e.name, e]));
eq([exp.add.kind, exp.add.target, exp.add.params, exp.add.results], ['func', '$add', ['i32', 'i32'], ['i32']]);
eq([exp.bump.target, exp.bump.params, exp.bump.results], ['$bump', [], []]);
eq([exp.counter.kind, exp.counter.target], ['global', '$counter']);
eq(exp.memory.kind, 'memory');
// Export order is the export section's order.
const instance = new WebAssembly.Instance(new WebAssembly.Module(withFacts.wasmBinary));
eq(f.exports.map(e => e.name), Object.keys(instance.exports));
eq(f.functions.map(x => [x.name, x.index, x.paramNames]), [['$add', 0, ['$x', '$y']], ['$bump', 1, []]]);
const g = Object.fromEntries(f.globals.map(x => [x.name, x]));
eq(g.$counter.init, { kind: 'const', value: 7 });
eq(g.$TABLE_BASE.init, { kind: 'region', op: 'region.addr', region: '$TABLE', value: 0x1010 });
eq(instance.exports.counter.value, 7);
ok(f.data.some(d => d.offset === 0x2000 && d.size === 5), 'explicit data segment recorded');
eq(f.regions.regions.find(r => r.name === '$TABLE').base, 0x1000);
eq(f.memory.min, 4);

// ── 2. export-wrap and compile-time facts ──────────────────────────────────
// The export surface with wrappers applied (outermost first), the function
// that finally runs, the inferred purity, and the options/targets/consts with
// the per-file reads a cache must key on. The behaviour itself is
// test/watx-compiler-export-wrap.test.js and test/watx-compiler-cfg.test.js.
const runtimeFiles = {
  'state.wat': [
    '(global $rep_store_step (mut i32) (i32.const 0))',
    '(global $v (mut i32) (i32.const 1))',
    '(defoption GUARD bool true "wrap writers")',
    '(defconst LIMIT (add 2 3))',
  ].join('\n'),
  'api.wat': [
    '(func (export "set_rep_store_step") (param i32) (global.set $rep_store_step (local.get 0)))',
    '(func $read (export "read") (result i32) (global.get $v))',
    '(func $write (param $x i32) (global.set $v (local.get $x)))',
    '(export "write" (func $write))',
    '(func (export "anon") (param $p i32) (param i64) (result i32) (call $helper) (local.get 0))',
    '(func $helper)',
    '(func (export "limit") (result i32) (i32.const (const LIMIT)))',
  ].join('\n'),
  'guards.wat': [
    '(if-const (option GUARD) (then',
    '  (export-wrap (match (and (all) (not (pure)) (not (name "set_rep_store_step"))))',
    '    (prologue (if (global.get $rep_store_step) (then (unreachable)))))))',
  ].join('\n'),
};
const runtime = { source: Object.keys(runtimeFiles).map(n => `(include "${n}")`).join('\n'), vfs: new Map() };
for (const [n, text] of Object.entries(runtimeFiles)) runtime.vfs.set(n, text);
const wrappedBuild = compileClosure(runtime, { tailCalls: true, facts: true });
ok(wrappedBuild.success, wrappedBuild.error);
const wf = JSON.parse(JSON.stringify(wrappedBuild.facts));
const wexp = Object.fromEntries(wf.exports.filter(e => e.kind === 'func').map(e => [e.name, e]));
eq(wexp.read.wrappers, [], 'pure export: no wrapper');
eq(wexp.read.pure, true);
eq(wexp.limit.pure, true, 'a const immediate is still a constant');
eq(wexp.set_rep_store_step.wrappers, [], 'excluded by name');
eq(wexp.write.wrappers, [0]);
eq(wexp.write.implementation, '$write', 'the out-of-line export now names a wrapper that calls $write');
eq(wexp.anon.wrappers, [0]);
ok(/^\$__xw_impl_/.test(wexp.anon.implementation), 'an anonymous export is named for its wrapper');
eq([wexp.anon.params, wexp.anon.results], [['i32', 'i64'], ['i32']], 'wrapper keeps the signature');
eq(wf.exportWraps.length, 1);
eq([wf.exportWraps[0].file, wf.exportWraps[0].line], ['guards.wat', 2]);
const ct = wf.compileTime;
eq(ct.options.map(o => [o.name, o.type, o.value, o.source]), [['GUARD', 'bool', true, 'default']]);
eq(ct.constants.map(c => [c.name, c.value]), [['LIMIT', 5]]);
eq(ct.targets['tail-calls'], true);
eq(ct.reads['guards.wat'], ['option GUARD']);
const we = new WebAssembly.Instance(new WebAssembly.Module(wrappedBuild.wasmBinary)).exports;
we.set_rep_store_step(1);
assert.throws(() => we.write(5), WebAssembly.RuntimeError); checks++;
eq(we.read(), 1);
we.set_rep_store_step(0); we.write(5); eq(we.read(), 5);
// The same closure with the option off: no wrapper, and the facts say why.
const unwrapped = watx.compile(runtime.source, runtime.vfs, { tailCalls: true, facts: true, define: { GUARD: 'false' } });
ok(unwrapped.success, unwrapped.error);
const uf = JSON.parse(JSON.stringify(unwrapped.facts));
ok(!uf.exportWraps, 'no export-wrap chosen');
eq(uf.compileTime.options[0].source, 'define');
eq(uf.compileTime.options[0].value, false);

console.log(`watx-compiler-facts: ${checks} checks passed`);
