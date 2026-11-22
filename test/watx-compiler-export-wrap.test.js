#!/usr/bin/env node
// test/watx-compiler-export-wrap.test.js -- WATX (export-wrap (match S) (prologue ...)).
// Language reference: docs/watx-language-compile-time.md.
//
// Every case instantiates the module and CALLS it: the generated wrapper must
// run its prologue, may return early, must call the original with the same
// arguments, and must leave internal calls alone. Both front ends (streaming
// production and whole-tree) must agree, including on (pure) inference, which
// the streaming compiler answers by re-parsing a body it has only a header for.
'use strict';
const assert = require('assert');
const path = require('path');
const { compile } = require(path.join(__dirname, '..', 'tools', 'watx.js'));

let checks = 0;
function ok(cond, msg) { checks++; assert.ok(cond, msg); console.log('  PASS  ' + msg); }
const FRONTENDS = [['streaming', {}], ['whole-tree', { streaming: false }]];

function build(files, options = {}) {
  const vfs = new Map(Object.entries(files));
  const source = Object.keys(files).map(f => `(include "${f}")`).join('\n');
  return compile(source, vfs, Object.assign({ mode: 'production', facts: true }, options));
}
function load(files, options) {
  const r = build(files, options);
  if (!r.success) throw new Error('compile failed: ' + (r.error || JSON.stringify(r.errors)));
  const facts = JSON.parse(JSON.stringify(r.facts));
  const imports = { env: { ext: () => 0 } };
  const e = new WebAssembly.Instance(new WebAssembly.Module(r.wasmBinary), imports).exports;
  return { e, facts, exp: Object.fromEntries(facts.exports.map(x => [x.name, x])) };
}
function errorOf(files, options) {
  let r;
  try { r = build(files, options); } catch (e) { return String(e.message || e); }
  return r.success ? null : String(r.error || JSON.stringify(r.errors));
}
function both(msg, fn) { for (const [name, fe] of FRONTENDS) fn(fe, `${msg} [${name}]`); }

const LOG = '(global $log (mut i32) (i32.const 0))\n' +
  '(func $note (param $d i32) (global.set $log (i32.add (i32.mul (global.get $log) (i32.const 10)) (local.get $d))))\n' +
  '(func (export "log") (result i32) (global.get $log))\n' +
  '(func (export "reset") (global.set $log (i32.const 0)))\n';

// ── nesting: first declaration outermost; arguments and results pass through ─
both('two wraps nest in declaration order, args/results pass through', (fe, msg) => {
  const { e, exp } = load({
    'a.wat': LOG + '(func $add (export "add") (param $a i32) (param $b i64) (result i32)\n' +
      '  (call $note (i32.const 3)) (i32.add (local.get $a) (i32.wrap_i64 (local.get $b))))',
    'w.wat': '(export-wrap (match (name "add")) (prologue (call $note (i32.const 1))))\n' +
             '(export-wrap (match (prefix "ad")) (prologue (call $note (i32.const 2))))',
  }, fe);
  e.reset();
  const sum = e.add(40, 2n);
  ok(sum === 42 && e.log() === 123, `${msg}: result ${sum}, prologue order ${e.log()}`);
  ok(JSON.stringify(exp.add.wrappers) === '[0,1]' && exp.add.implementation === '$add', `${msg}: facts list both, outermost first`);
});

// ── early return ─────────────────────────────────────────────────────────────
both('a prologue may return early with its own value', (fe, msg) => {
  const { e } = load({
    'a.wat': '(global $deny (mut i32) (i32.const 0))\n' +
      '(func (export "set_deny") (param i32) (global.set $deny (local.get 0)))\n' +
      '(func (export "f") (param $x i32) (result i32) (i32.mul (local.get $x) (i32.const 2)))',
    'w.wat': '(export-wrap (match (name "f")) (prologue (if (global.get $deny) (then (return (i32.sub (i32.const 0) (local.get 0)))))))',
  }, fe);
  const a = e.f(21); e.set_deny(1); const b = e.f(21);
  ok(a === 42 && b === -21, `${msg}: ${a}, ${b}`);
});

// ── internal calls keep their targets ───────────────────────────────────────
both('internal calls reach the original, not the wrapper', (fe, msg) => {
  const { e } = load({
    'a.wat': LOG + '(func $inner (export "inner") (result i32) (call $note (i32.const 7)) (i32.const 1))\n' +
      '(func (export "outer") (result i32) (call $inner))',
    'w.wat': '(export-wrap (match (name "inner")) (prologue (call $note (i32.const 9))))',
  }, fe);
  e.reset(); e.outer(); const viaOuter = e.log();
  e.reset(); e.inner(); const direct = e.log();
  ok(viaOuter === 7 && direct === 97, `${msg}: via outer ${viaOuter}, direct ${direct}`);
});

// ── (all) is default-deny: it covers exports declared AFTER it ──────────────
both('(all) covers an export in a later file, out-of-line and anonymous exports', (fe, msg) => {
  const { e, exp } = load({
    'a.wat': LOG,
    'w.wat': '(export-wrap (match (and (all) (not (name "log" "reset")))) (prologue (call $note (i32.const 5))))',
    'late.wat': '(func $named (result i32) (i32.const 11))\n(export "late_out" (func $named))\n' +
                '(func (export "late_anon") (result i32) (i32.const 12))',
  }, fe);
  e.reset(); const a = e.late_out(); const b = e.late_anon();
  ok(a === 11 && b === 12 && e.log() === 55, `${msg}: ${a} ${b} log ${e.log()}`);
  ok(exp.late_out.wrappers.length === 1 && /^\$__xw_impl_/.test(exp.late_anon.implementation) &&
     exp.log.wrappers.length === 0, `${msg}: facts`);
});

// ── export section order is preserved ───────────────────────────────────────
// (Compared with the same front end's no-wrap order: the streaming front end
// places out-of-line exports differently from the whole-tree one, a
// pre-existing difference this feature must not add to or change.)
both('wrapped exports keep their export-section order', (fe, msg) => {
  const a = '(func (export "one") (export "uno") (result i32) (i32.const 1))\n' +
            '(func (export "two") (result i32) (i32.const 2))\n(func $three (result i32) (i32.const 3))\n(export "three" (func $three))';
  const plain = load({ 'a.wat': a }, fe);
  const { e, facts } = load({ 'a.wat': a, 'w.wat': '(export-wrap (match (name "uno" "three")) (prologue (nop)))' }, fe);
  const firstMoved = load({ 'a.wat': a, 'w.wat': '(export-wrap (match (name "one")) (prologue (nop)))' }, fe);
  const names = facts.exports.map(x => x.name), base = plain.facts.exports.map(x => x.name);
  ok(JSON.stringify(Object.keys(e)) === JSON.stringify(names) && JSON.stringify(names) === JSON.stringify(base) &&
     JSON.stringify(firstMoved.facts.exports.map(x => x.name)) === JSON.stringify(base) &&
     e.uno() === 1 && e.three() === 3 && firstMoved.e.one() === 1, `${msg}: ${names}`);
});

// ── (pure) inference ────────────────────────────────────────────────────────
const PURE = {
  p_global: '(result i32) (global.get $g)',
  p_load: '(param $p i32) (result i32) (i32.add (i32.load offset=4 (local.get $p)) (i32.load8_u (local.get $p)))',
  p_arith: '(param $a i32) (param $b i32) (result i32) (select (i32.shl (local.get $a) (i32.const 2)) (i32.const 0) (i32.lt_u (local.get $a) (local.get $b)))',
  p_i64: '(param $a i32) (result i64) (i64.mul (i64.extend_i32_u (local.get $a)) (i64.const 3))',
  p_float: '(param $a f64) (result f64) (f64.sqrt (f64.add (local.get $a) (f64.const 1)))',
  p_local: '(result i32) (local $t i32) (local.get $t)',
};
const IMPURE = {
  i_gset: '(global.set $g (i32.const 1))',
  i_store: '(param $p i32) (i32.store (local.get $p) (i32.const 1))',
  i_call: '(result i32) (call $helper)',
  i_lset: '(result i32) (local $t i32) (local.set $t (i32.const 1)) (local.get $t)',
  i_if: '(param $a i32) (result i32) (if (result i32) (local.get $a) (then (i32.const 1)) (else (i32.const 2)))',
  i_effects: '(result i32) (effects) (global.get $g)',
  i_empty: '',
  i_memsize: '(result i32) (memory.size)',
  i_atomic: '(param $p i32) (result i32) (i32.atomic.load (local.get $p))',
  i_unreach: '(unreachable)',
};
both('(pure) is inferred: reads, constants and arithmetic only', (fe, msg) => {
  const src = ['(memory 1 1 shared)', '(global $g (mut i32) (i32.const 4))', '(func $helper (result i32) (i32.const 0))',
    '(import "env" "ext" (func $ext (result i32)))', '(export "imported" (func $ext))'];
  for (const [n, body] of Object.entries(Object.assign({}, PURE, IMPURE))) src.push(`(func (export "${n}") ${body})`);
  const { exp } = load({
    'a.wat': src.join('\n'),
    'w.wat': '(export-wrap (match (not (pure))) (prologue (nop)))',
  }, fe);
  const wrongPure = Object.keys(PURE).filter(n => exp[n].wrappers.length || exp[n].pure !== true);
  const wrongImpure = Object.keys(IMPURE).concat(['imported']).filter(n => exp[n].wrappers.length !== 1 || exp[n].pure !== false);
  ok(!wrongPure.length && !wrongImpure.length, `${msg}: misclassified ${JSON.stringify(wrongPure.concat(wrongImpure))}`);
});
both('(pure) sees through macros (judged on the expanded body)', (fe, msg) => {
  const { exp } = load({
    'a.wat': '(global $g (mut i32) (i32.const 0))\n(defmacro (peek) (global.get $g))\n(defmacro (poke) (global.set $g (i32.const 1)))\n' +
      '(func (export "peek") (result i32) (peek))\n(func (export "poke") (poke))',
    'w.wat': '(export-wrap (match (pure)) (prologue (nop)))',
  }, fe);
  ok(exp.peek.wrappers.length === 1 && exp.poke.wrappers.length === 0, msg);
});

// ── selectors ───────────────────────────────────────────────────────────────
both('or / and / not / prefix combine', (fe, msg) => {
  const { exp } = load({
    'a.wat': ['get_a', 'get_b', 'set_a', 'run'].map(n => `(func (export "${n}"))`).join('\n'),
    'w.wat': '(export-wrap (match (or (name "run") (and (prefix "get_" "set_") (not (name "get_b"))))) (prologue (nop)))',
  }, fe);
  const wrapped = Object.values(exp).filter(x => x.kind === 'func' && x.wrappers.length).map(x => x.name).sort();
  ok(JSON.stringify(wrapped) === '["get_a","run","set_a"]', `${msg}: ${wrapped}`);
});

// ── errors ──────────────────────────────────────────────────────────────────
for (const [wrap, re, what] of [
  ['(export-wrap (match (everything)) (prologue (nop)))', /everything/, 'unknown selector'],
  ['(export-wrap (match (name)) (prologue (nop)))', /name/, '(name) needs strings'],
  ['(export-wrap (match (all)))', /export-wrap/, 'missing prologue'],
  ['(export-wrap (match (all)) (prologue (call $nowhere)))', /nowhere/, 'the prologue is type-checked like any body'],
]) {
  both(`error: ${what}`, (fe, msg) => {
    const err = errorOf({ 'a.wat': '(func (export "f"))', 'w.wat': wrap }, fe);
    ok(err !== null && re.test(err), `${msg}: ${err && err.split('\n')[0]}`);
  });
}

// ── no declaration, no change ───────────────────────────────────────────────
both('a module with no export-wrap compiles to the same bytes as before', (fe, msg) => {
  const files = { 'a.wat': LOG + '(func (export "f") (result i32) (i32.const 1))' };
  const a = build(files, Object.assign({ facts: false }, fe));
  const gated = Object.assign({}, files, { 'w.wat': '(if-const (target simd) (then (export-wrap (match (all)) (prologue (unreachable)))))' });
  const b = build(gated, Object.assign({ facts: false, targets: { simd: false } }, fe));
  ok(a.success && b.success && Buffer.compare(Buffer.from(a.wasmBinary), Buffer.from(b.wasmBinary)) === 0, msg);
  // simd is not derived from any compile option, so a build must state it.
  const err = errorOf(gated, fe);
  ok(err !== null && /simd/.test(err), `${msg}: an unstated target is an error: ${err && err.split('\n')[0]}`);
});

console.log(`watx-compiler-export-wrap: ${checks} checks passed`);
