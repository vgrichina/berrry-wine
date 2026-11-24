#!/usr/bin/env node
// test/watx-compiler-advise.test.js -- WATX function advice:
//   (advise ["NAME"] (match S) (at export|entry) [(allow-hot)] :before|:before-until FORMS...)
//   (func ... (advise ...) (no-advise "NAME") ...)
// Language reference: docs/watx-language-compile-time.md.
//
// Every behaviour case instantiates the module and CALLS it: export advice must
// run on a generated wrapper and leave internal calls alone; entry advice must
// run for every caller (JS, call, call_indirect) with return_call still
// working; :before-until may return early. Both front ends (streaming
// production and whole-tree) must agree, including on (pure) inference, which
// the streaming compiler answers by re-parsing a body it has only a header for,
// and on entry advice, which it splices into a body loaded in pass 2.
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
  return { e, facts, r, exp: Object.fromEntries(facts.exports.map(x => [x.name, x])) };
}
function errorOf(files, options) {
  let r;
  try { r = build(files, options); } catch (e) { return String(e.message || e); }
  return r.success ? null : String(r.error || JSON.stringify(r.errors));
}
function both(msg, fn) { for (const [name, fe] of FRONTENDS) fn(fe, `${msg} [${name}]`); }
const same = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

const LOG = '(global $log (mut i32) (i32.const 0))\n' +
  '(func $note (param $d i32) (global.set $log (i32.add (i32.mul (global.get $log) (i32.const 10)) (local.get $d))))\n' +
  '(func (export "log") (result i32) (global.get $log))\n' +
  '(func (export "reset") (global.set $log (i32.const 0)))\n';

// ── (at export): nesting, first declaration outermost; args/results pass ────
both('two export advices nest in declaration order, args/results pass through', (fe, msg) => {
  const { e, exp } = load({
    'a.wat': LOG + '(func $add (export "add") (param $a i32) (param $b i64) (result i32)\n' +
      '  (call $note (i32.const 3)) (i32.add (local.get $a) (i32.wrap_i64 (local.get $b))))',
    'w.wat': '(advise (match (name "add")) (at export) :before (call $note (i32.const 1)))\n' +
             '(advise (match (prefix "ad")) (at export) :before (call $note (i32.const 2)))',
  }, fe);
  e.reset();
  const sum = e.add(40, 2n);
  ok(sum === 42 && e.log() === 123, `${msg}: result ${sum}, advice order ${e.log()}`);
  ok(JSON.stringify(exp.add.advice) === '[0,1]' && exp.add.implementation === '$add', `${msg}: facts list both, outermost first`);
});

// ── :before-until returns early (export and entry) ──────────────────────────
both(':before-until at export may (return VALUE) and skip the function', (fe, msg) => {
  const { e } = load({
    'a.wat': '(global $deny (mut i32) (i32.const 0))\n' +
      '(func (export "set_deny") (param i32) (global.set $deny (local.get 0)))\n' +
      '(func (export "f") (param $x i32) (result i32) (i32.mul (local.get $x) (i32.const 2)))',
    'w.wat': '(advise (match (name "f")) (at export) :before-until (if (global.get $deny) (then (return (i32.sub (i32.const 0) (local.get 0))))))',
  }, fe);
  const a = e.f(21); e.set_deny(1); const b = e.f(21);
  ok(a === 42 && b === -21, `${msg}: ${a}, ${b}`);
});
both(':before-until at entry skips the body for EVERY caller', (fe, msg) => {
  const { e } = load({
    'a.wat': '(global $deny (mut i32) (i32.const 0))\n' +
      '(func (export "set_deny") (param i32) (global.set $deny (local.get 0)))\n' +
      '(func $dbl (export "dbl") (param $x i32) (result i32)\n' +
      '  (advise (at entry) :before-until (if (global.get $deny) (then (return (i32.const -1)))))\n' +
      '  (i32.mul (local.get $x) (i32.const 2)))\n' +
      '(func (export "via") (param $x i32) (result i32) (call $dbl (local.get $x)))',
  }, fe);
  const a = [e.dbl(4), e.via(4)]; e.set_deny(1); const b = [e.dbl(4), e.via(4)];
  ok(JSON.stringify(a) === '[8,8]' && JSON.stringify(b) === '[-1,-1]', `${msg}: off ${a}, on ${b}`);
});

// ── internal calls skip (at export) ─────────────────────────────────────────
both('(at export): internal calls reach the original, not the wrapper', (fe, msg) => {
  const { e } = load({
    'a.wat': LOG + '(func $inner (export "inner") (result i32) (call $note (i32.const 7)) (i32.const 1))\n' +
      '(func (export "outer") (result i32) (call $inner))',
    'w.wat': '(advise (match (name "inner")) (at export) :before (call $note (i32.const 9)))',
  }, fe);
  e.reset(); e.outer(); const viaOuter = e.log();
  e.reset(); e.inner(); const direct = e.log();
  ok(viaOuter === 7 && direct === 97, `${msg}: via outer ${viaOuter}, direct ${direct}`);
});

// ── (at entry): every caller pays, no new function, return_call works ───────
const TABLE = '(type $sig (func (param i32) (result i32)))\n(table $t 2 funcref)\n(elem (i32.const 0) $h0 $h1)\n' +
  '(func $h0 (param $x i32) (result i32) (call $note (i32.const 4)) (i32.add (local.get $x) (i32.const 100)))\n' +
  '(func $h1 (param $x i32) (result i32) (return_call $h0 (i32.add (local.get $x) (i32.const 1))))\n' +
  '(func (export "dispatch") (param $i i32) (param $x i32) (result i32) (call_indirect (type $sig) (local.get $i) (local.get $x)))\n' + // WATX: index first

  '(func (export "direct") (param $x i32) (result i32) (call $h1 (local.get $x)))\n';
both('(at entry) runs for JS, call and call_indirect callers; return_call keeps working', (fe, msg) => {
  const plain = load({ 'a.wat': LOG + TABLE }, fe);
  const { e, facts } = load({
    'a.wat': LOG + TABLE,
    'w.wat': '(advise "trace" (match (in-table $t)) (at entry) (allow-hot) :before (call $note (i32.const 1)))',
  }, fe);
  e.reset(); const viaTable = e.dispatch(1, 5); const logTable = e.log();
  e.reset(); const viaCall = e.direct(5); const logCall = e.log();
  ok(viaTable === 106 && viaCall === 106 && logTable === 114 && logCall === 114,
     `${msg}: table ${viaTable}/${logTable}, call ${viaCall}/${logCall} ($h1 advice, tail call into $h0 advice, $h0 body)`);
  ok(facts.functions.length === plain.facts.functions.length, `${msg}: no function added (${facts.functions.length})`);
  const chains = Object.fromEntries(facts.advice.chains.map(c => [c.function, c.entry.map(l => l.name)]));
  ok(JSON.stringify(chains) === '{"$h0":["trace"],"$h1":["trace"]}', `${msg}: facts chains ${JSON.stringify(chains)}`);
});

// ── (export) is default-deny: it covers exports declared AFTER it ───────────
both('(export) covers an export in a later file, out-of-line and anonymous exports', (fe, msg) => {
  const { e, exp } = load({
    'a.wat': LOG,
    'w.wat': '(advise (match (and (export) (not (name "log" "reset")))) (at export) :before (call $note (i32.const 5)))',
    'late.wat': '(func $named (result i32) (i32.const 11))\n(export "late_out" (func $named))\n' +
                '(func (export "late_anon") (result i32) (i32.const 12))',
  }, fe);
  e.reset(); const a = e.late_out(); const b = e.late_anon();
  ok(a === 11 && b === 12 && e.log() === 55, `${msg}: ${a} ${b} log ${e.log()}`);
  ok(exp.late_out.advice.length === 1 && /^\$__xw_impl_/.test(exp.late_anon.implementation) &&
     exp.log.advice.length === 0, `${msg}: facts`);
});

// ── export section order is preserved ───────────────────────────────────────
// (Compared with the same front end's no-advice order: the streaming front end
// places out-of-line exports differently from the whole-tree one, a
// pre-existing difference this feature must not add to or change.)
both('advised exports keep their export-section order', (fe, msg) => {
  const a = '(func (export "one") (export "uno") (result i32) (i32.const 1))\n' +
            '(func (export "two") (result i32) (i32.const 2))\n(func $three (result i32) (i32.const 3))\n(export "three" (func $three))';
  const plain = load({ 'a.wat': a }, fe);
  const { e, facts } = load({ 'a.wat': a, 'w.wat': '(advise (match (name "uno" "three")) (at export) :before (nop))' }, fe);
  const firstMoved = load({ 'a.wat': a, 'w.wat': '(advise (match (name "one")) (at export) :before (nop))' }, fe);
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
    'w.wat': '(advise (match (not (pure))) (at export) :before (nop))',
  }, fe);
  const wrongPure = Object.keys(PURE).filter(n => exp[n].advice.length || exp[n].pure !== true);
  const wrongImpure = Object.keys(IMPURE).concat(['imported']).filter(n => exp[n].advice.length !== 1 || exp[n].pure !== false);
  ok(!wrongPure.length && !wrongImpure.length, `${msg}: misclassified ${JSON.stringify(wrongPure.concat(wrongImpure))}`);
});
both('(pure) sees through macros (judged on the expanded body)', (fe, msg) => {
  const { exp } = load({
    'a.wat': '(global $g (mut i32) (i32.const 0))\n(defmacro (peek) (global.get $g))\n(defmacro (poke) (global.set $g (i32.const 1)))\n' +
      '(func (export "peek") (result i32) (peek))\n(func (export "poke") (poke))',
    'w.wat': '(advise (match (pure)) (at export) :before (nop))',
  }, fe);
  ok(exp.peek.advice.length === 1 && exp.poke.advice.length === 0, msg);
});
both('a pure function with impure entry advice is not pure to an export selector', (fe, msg) => {
  const { exp } = load({
    'a.wat': LOG + '(global $g (mut i32) (i32.const 0))\n' +
      '(func (export "peek") (result i32) (advise (at entry) :before (call $note (i32.const 1))) (global.get $g))\n' +
      '(func (export "peek2") (result i32) (global.get $g))',
    'w.wat': '(advise (match (pure)) (at export) :before (nop))',
  }, fe);
  ok(exp.peek.pure === false && exp.peek.advice.length === 0 && exp.peek2.advice.length === 1, msg);
});

// ── selectors ───────────────────────────────────────────────────────────────
both('or / and / not / prefix combine (export names at export)', (fe, msg) => {
  const { exp } = load({
    'a.wat': ['get_a', 'get_b', 'set_a', 'run'].map(n => `(func (export "${n}"))`).join('\n'),
    'w.wat': '(advise (match (or (name "run") (and (prefix "get_" "set_") (not (name "get_b"))))) (at export) :before (nop))',
  }, fe);
  const advised = Object.values(exp).filter(x => x.kind === 'func' && x.advice.length).map(x => x.name).sort();
  ok(JSON.stringify(advised) === '["get_a","run","set_a"]', `${msg}: ${advised}`);
});
both('(export), (effects) and (name) at entry select FUNCTIONS by their own name', (fe, msg) => {
  const { facts } = load({
    'a.wat': LOG + '(func $priv (result i32) (i32.const 1))\n' +
      '(func $pub (export "public_name") (result i32) (i32.const 2))\n' +
      '(func $eff (effects) (result i32) (i32.const 3))\n' +
      '(func $named_x (result i32) (i32.const 4))',
    'w.wat': '(advise "e" (match (and (export) (prefix "pu"))) (at entry) :before (nop))\n' +
             '(advise "f" (match (effects)) (at entry) :before (nop))\n' +
             '(advise "n" (match (name "named_x")) (at entry) :before (nop))',
  }, fe);
  const chains = Object.fromEntries(facts.advice.chains.map(c => [c.function, c.entry.map(l => l.name).join(',')]));
  ok(JSON.stringify(chains) === '{"$pub":"e","$eff":"f","$named_x":"n"}', `${msg}: ${JSON.stringify(chains)}`);
});

// ── named advice, no-advise, inline chain order ─────────────────────────────
both('chain: outside advice in declaration order, minus no-advise, own advice innermost', (fe, msg) => {
  const { e, facts, exp } = load({
    'a.wat': LOG +
      '(func $f (export "f") (result i32)\n' +
      '  (advise (at export) :before (call $note (i32.const 3)))\n' +
      '  (advise (at entry) :before (call $note (i32.const 6)))\n' +
      '  (i32.const 0))\n' +
      '(func (export "g") (result i32) (no-advise "one") (advise (at export) :before (call $note (i32.const 3))) (i32.const 0))',
    'w.wat': '(advise "one" (match (name "f" "g")) (at export) :before (call $note (i32.const 1)))\n' +
             '(advise "two" (match (name "f" "g")) (at export) :before (call $note (i32.const 2)))\n' +
             '(advise "ent" (match (name "f")) (at entry) :before (call $note (i32.const 5)))',
  }, fe);
  e.reset(); e.f(); const f = e.log();
  e.reset(); e.g(); const g = e.log();
  ok(f === 12356 && g === 23, `${msg}: f ran ${f}, g ran ${g}`);
  const fc = facts.advice.chains.find(c => c.function === null || c.exports.f);
  const links = fc.exports.f.map(l => `${l.name || 'inline'}@${l.file}:${l.line}`);
  ok(JSON.stringify(links) === '["one@w.wat:1","two@w.wat:2","inline@a.wat:6"]' &&
     JSON.stringify(fc.entry.map(l => l.name || 'inline')) === '["ent","inline"]', `${msg}: facts chain ${links} / entry`);
  ok(exp.g.advice.length === 2, `${msg}: g opted out of "one"`);
});
both('no-advise may name advice this build switched off; a name found nowhere fails', (fe, msg) => {
  const files = {
    'a.wat': '(defoption TRACE bool false "trace")\n(func (export "f") (result i32) (no-advise "trace") (i32.const 1))',
    'w.wat': '(if-const (option TRACE) (then (advise "trace" (match (export)) (at export) :before (nop))))',
  };
  const off = load(files, fe);
  const on = load(files, Object.assign({ define: { TRACE: 'true' } }, fe));
  ok(off.e.f() === 1 && !off.facts.advice && on.exp.f.advice.length === 0, `${msg}: off and on build, f opted out`);
  const err = errorOf({ 'a.wat': '(func (export "f") (no-advise "trcae"))', 'w.wat': '(advise "trace" (match (export)) (at export) :before (nop))' }, fe);
  ok(err !== null && /trcae/.test(err) && /any configuration/.test(err), `${msg}: typo: ${err && err.split('\n')[0]}`);
});

// ── conditional advice: dropped when empty, facts record dependencies ───────
both('advice empty after if-const is dropped: same bytes as no advice; facts say why', (fe, msg) => {
  const base = { 'a.wat': '(defoption GUARD bool false "guard")\n(defoption EXTRA bool false "x")\n' + LOG +
    '(func (export "f") (result i32) (i32.const 1))' };
  const plain = build(base, Object.assign({ facts: false }, fe));
  const withAdvice = Object.assign({}, base, {
    'w.wat': '(advise "g" (match (name "f")) (at export) :before (if-const (option GUARD) (then (call $note (i32.const 1)))))\n' +
             '(if-const (option EXTRA) (then) (else (advise "e" (match (name "f")) (at entry) :before (if-const (option GUARD) (then (nop))))))',
  });
  const r = build(withAdvice, Object.assign({ facts: true }, fe));
  ok(plain.success && r.success && same(plain.wasmBinary, r.wasmBinary), `${msg}: byte-identical`);
  const d = r.facts.advice.declarations;
  ok(d.every(x => x.dropped) && JSON.stringify(d[0].dependsOn) === '["option GUARD"]' &&
     JSON.stringify(d[1].dependsOn) === '["option EXTRA","option GUARD"]' && r.facts.advice.chains.length === 0,
     `${msg}: dropped, dependsOn ${JSON.stringify(d.map(x => x.dependsOn))}`);
  const on = load(withAdvice, Object.assign({ define: { GUARD: 'true' } }, fe));
  on.e.reset(); on.e.f();
  ok(on.e.log() === 1 && on.exp.f.advice.length === 1, `${msg}: GUARD=true wraps`);
});

// ── (allow-hot) ─────────────────────────────────────────────────────────────
both('entry advice on a table function, or on more than the limit, needs (allow-hot)', (fe, msg) => {
  const hot = errorOf({ 'a.wat': LOG + TABLE, 'w.wat': '(advise "trace" (match (name "h0")) (at entry) :before (nop))' }, fe);
  ok(hot !== null && /\$h0/.test(hot) && /allow-hot/.test(hot), `${msg}: table: ${hot && hot.split('\n')[0]}`);
  const inline = errorOf({ 'a.wat': LOG + TABLE.replace('(func $h0 (param $x i32) (result i32)', '(func $h0 (param $x i32) (result i32) (advise (at entry) :before (nop))') }, fe);
  ok(inline !== null && /allow-hot/.test(inline), `${msg}: inline on a table function too`);
  const many = Array.from({ length: 40 }, (_, i) => `(func $m${i} (result i32) (i32.const ${i}))`).join('\n');
  const wide = errorOf({ 'a.wat': many, 'w.wat': '(advise (match (prefix "m")) (at entry) :before (nop))' }, fe);
  ok(wide !== null && /40 functions/.test(wide) && /allow-hot/.test(wide), `${msg}: wide: ${wide && wide.split('\n')[0]}`);
  const allowed = build({ 'a.wat': many, 'w.wat': '(advise (match (prefix "m")) (at entry) (allow-hot) :before (nop))' }, fe);
  ok(allowed.success && allowed.facts.advice.declarations[0].matched === 40, `${msg}: (allow-hot) admits it`);
});

// ── errors ──────────────────────────────────────────────────────────────────
for (const [adv, re, what] of [
  ['(advise (match (export)) (at export) :after (nop))', /:after is not in v1.*\(at export\).*return_call/, ':after is future'],
  ['(advise (match (export)) (at entry) :around (nop))', /:around is not in v1.*\(at export\) only/, ':around is future'],
  ['(advise (match (export)) (at export) :override (nop))', /not planned/, ':override is not planned'],
  ['(advise (match (export)) (at export) :sometimes (nop))', /unknown qualifier/, 'unknown qualifier'],
  ['(advise (match (export)) (at export) :before (nop) :before-until (nop))', /one qualifier/, 'one qualifier per advise'],
  ['(advise (match (export)) (at export) :before (return))', /:before-until/, ':before cannot return'],
  ['(advise (match (export)) :before (nop))', /\(at export\) or \(at entry\)/, '(at) is required'],
  ['(advise (at export) :before (nop))', /needs \(match SELECTOR\)/, 'module level needs (match)'],
  ['(advise (match (export)) (at export) (allow-hot) :before (nop))', /allow-hot/, '(allow-hot) only at entry'],
  ['(advise "x" (match (export)) (at export) :before (nop))\n(advise "x" (match (export)) (at export) :before (nop))', /already declared/, 'duplicate names'],
  ['(advise (match (everything)) (at export) :before (nop))', /everything/, 'unknown selector'],
  ['(advise (match (option TRACE)) (at export) :before (nop))', /never tests the build/, 'selectors never test options'],
  ['(advise (match (name)) (at export) :before (nop))', /name/, '(name) needs strings'],
  ['(advise (match (in-table $t)) (at export) :before (nop))', /declares no table/, '(in-table) needs a table'],
  ['(advise (match (export)) (at export) :before (call $nowhere))', /nowhere/, 'advice forms are type-checked like any body'],
  ['(no-advise "x")', /function clause/, 'no-advise at module level'],
]) {
  both(`error: ${what}`, (fe, msg) => {
    const err = errorOf({ 'a.wat': '(func (export "f"))', 'w.wat': adv }, fe);
    ok(err !== null && re.test(err), `${msg}: ${err && err.split('\n')[0]}`);
  });
}
both('error: (match) on a function clause; (at export) on a function with no export', (fe, msg) => {
  const m = errorOf({ 'a.wat': '(func $f (advise (match (all)) (at entry) :before (nop)))' }, fe);
  ok(m !== null && /no \(match/.test(m), `${msg}: ${m && m.split('\n')[0]}`);
  const x = errorOf({ 'a.wat': '(func $f (advise (at export) :before (nop)))' }, fe);
  ok(x !== null && /has no export/.test(x), `${msg}: ${x && x.split('\n')[0]}`);
});

// ── no declaration, no change ───────────────────────────────────────────────
both('a module with no advice compiles to the same bytes as before', (fe, msg) => {
  const files = { 'a.wat': LOG + '(func (export "f") (result i32) (i32.const 1))' };
  const a = build(files, Object.assign({ facts: false }, fe));
  const gated = Object.assign({}, files, { 'w.wat': '(if-const (target simd) (then (advise (match (export)) (at export) :before (unreachable))))' });
  const b = build(gated, Object.assign({ facts: false, targets: { simd: false } }, fe));
  ok(a.success && b.success && same(a.wasmBinary, b.wasmBinary), msg);
  // simd is not derived from any compile option, so a build must state it.
  const err = errorOf(gated, fe);
  ok(err !== null && /simd/.test(err), `${msg}: an unstated target is an error: ${err && err.split('\n')[0]}`);
});

console.log(`watx-compiler-advise: ${checks} checks passed`);
