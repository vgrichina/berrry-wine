#!/usr/bin/env node
// test/watx-compiler-cfg.test.js -- WATX compile-time configuration:
// (defoption ...), (defconst ...), (option ...), (target ...), (const ...),
// (if-const ...), (cond-const ...). Language reference:
// docs/watx-language-compile-time.md.
//
// Every case COMPILES AND CALLS the module (the pattern of
// test/watx-compiler-macro-body.test.js): a conditional that silently chose
// nothing validates fine, so validation proves nothing. Each case runs through
// both front ends -- the streaming production compiler (pass 1 headers, pass 2
// bodies, with its own routing for functions that hold a conditional) and the
// whole-tree one (streaming:false) -- and they must agree.
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
  return compile(source, vfs, Object.assign({ mode: 'production' }, options));
}
function exportsOf(files, options) {
  const r = build(files, options);
  if (!r.success) throw new Error('compile failed: ' + (r.error || JSON.stringify(r.errors)));
  return new WebAssembly.Instance(new WebAssembly.Module(r.wasmBinary), {}).exports;
}
function errorOf(files, options) {
  let r;
  try { r = build(files, options); } catch (e) { return String(e.message || e); }
  return r.success ? null : String(r.error || JSON.stringify(r.errors));
}
function both(msg, fn) {
  for (const [name, fe] of FRONTENDS) fn(fe, `${msg} [${name}]`);
}

// ── option types, defaults and defines ──────────────────────────────────────
const typed = {
  'opts.wat': [
    '(defoption FLAG bool false "a flag")',
    '(defoption SIZE i32 16 "an i32")',
    '(defoption WIDE i64 0x1_0000_0000 "an i64 past 32 bits")',
    '(defoption MODE (enum fast safe slow) safe "an enum")',
    '(defconst SIZE2 (mul (option SIZE) 2))',
    '(defconst MODE_RANK (if-mode))',
  ].join('\n').replace('(defconst MODE_RANK (if-mode))', ''),
  'use.wat': [
    '(func (export "flag") (result i32)',
    '  (if-const (option FLAG) (then (i32.const 1)) (else (i32.const 0))))',
    '(func (export "size2") (result i32) (i32.const (const SIZE2)))',
    '(defconst WIDE_HI (shr (option WIDE) 32))',
    '(func (export "wide_hi") (result i64) (i64.const (const WIDE_HI)))',
    '(func (export "mode") (result i32)',
    '  (cond-const',
    '    ((eq (option MODE) fast) (i32.const 10))',
    '    ((eq (option MODE) safe) (i32.const 20))',
    '    (else (i32.const 30))))',
  ].join('\n'),
};
both('defaults: bool false, i32 16, i64 2^32, enum safe', (fe, msg) => {
  const e = exportsOf(typed, fe);
  ok(e.flag() === 0 && e.size2() === 32 && e.wide_hi() === 1n && e.mode() === 20, msg);
});
both('defines override every type', (fe, msg) => {
  const e = exportsOf(typed, Object.assign({ define: { FLAG: 'true', SIZE: '0x20', WIDE: '0x5_0000_0000', MODE: 'slow' } }, fe));
  ok(e.flag() === 1 && e.size2() === 64 && e.wide_hi() === 5n && e.mode() === 30, msg);
});
both('a define may also be a JS boolean/number', (fe, msg) => {
  const e = exportsOf(typed, Object.assign({ define: { FLAG: true, SIZE: 3 } }, fe));
  ok(e.flag() === 1 && e.size2() === 6, msg);
});

// ── define errors ────────────────────────────────────────────────────────────
const defineErrors = [
  [{ NOPE: '1' }, /NOPE/, 'unknown define is an error'],
  [{ FLAG: 'maybe' }, /FLAG/, 'bool define must be true/false'],
  [{ SIZE: 'abc' }, /SIZE/, 'i32 define must be an integer'],
  [{ SIZE: '0x1_0000_0000' }, /SIZE/, 'i32 define out of range'],
  [{ MODE: 'turbo' }, /MODE|turbo/, 'enum define must be a member'],
  [{ SIZE2: '4' }, /SIZE2/, 'a defconst cannot be defined'],
];
for (const [define, re, msg] of defineErrors) {
  both(msg, (fe, m) => {
    const err = errorOf(typed, Object.assign({ define }, fe));
    ok(err !== null && re.test(err), `${m}: ${err && err.split('\n')[0]}`);
  });
}

// ── declaration errors ──────────────────────────────────────────────────────
const declErrors = [
  [{ 'a.wat': '(defoption X i32 5000000000 "too big")' }, /X/, 'default out of type range'],
  [{ 'a.wat': '(defoption X bool 1 "not a bool")' }, /X/, 'default of the wrong type'],
  [{ 'a.wat': '(defoption X (enum a b) c "not a member")' }, /X|c/, 'enum default not a member'],
  [{ 'a.wat': '(defoption X i32 1 "d")\n(defoption X i32 2 "d")' }, /X/, 'a name is declared once'],
  [{ 'a.wat': '(defconst C (add 1 true))' }, /C|add|bool/, 'operators type-check their operands'],
  [{ 'a.wat': '(func (export "f") (result i32) (if-const (target warp-drive) (then (i32.const 1)) (else (i32.const 0))))' },
    /warp-drive/, 'unknown target is an error'],
];
for (const [files, re, msg] of declErrors) {
  both(msg, (fe, m) => {
    const err = errorOf(files, fe);
    ok(err !== null && re.test(err), `${m}: ${err && err.split('\n')[0]}`);
  });
}

// ── ordering: conditions see only what is declared EARLIER ──────────────────
both('reading an option before its defoption is an error (across files)', (fe, msg) => {
  const err = errorOf({
    'early.wat': '(func (export "f") (result i32) (if-const (option LATE) (then (i32.const 1)) (else (i32.const 0))))',
    'late.wat': '(defoption LATE bool true "declared after its reader")',
  }, fe);
  ok(err !== null && /LATE/.test(err), `${msg}: ${err && err.split('\n')[0]}`);
});
both('a const used before its defconst is an error (same file)', (fe, msg) => {
  const err = errorOf({ 'a.wat': '(global $g i32 (i32.const (const K)))\n(defconst K 3)' }, fe);
  ok(err !== null && /K/.test(err), `${msg}: ${err && err.split('\n')[0]}`);
});
both('the same reads succeed once declared first', (fe, msg) => {
  const e = exportsOf({
    'late.wat': '(defoption LATE bool true "declared first")\n(defconst K 3)',
    'early.wat': '(func (export "f") (result i32) (if-const (option LATE) (then (i32.const (const K))) (else (i32.const 0))))',
  }, fe);
  ok(e.f() === 3, msg);
});

// ── the unchosen branch is parsed but never expanded or type-checked ─────────
both('unchosen branch: unknown function, bad types, undefined macro, unknown type', (fe, msg) => {
  const e = exportsOf({
    'a.wat': [
      '(defoption ON bool false "off")',
      '(func (export "f") (result i32)',
      '  (if-const (option ON)',
      '    (then (call $no_such_function) (i32.add (f64.const 1.5)) (no-such-macro)',
      '          (call_indirect (type $no_such_type) (i32.const 0)))',
      '    (else (i32.const 7))))',
      '(if-const (option ON)',
      '  (then (func $ghost (result i32) (call $missing)) (global $ghost_g i32 (f32.const 1))))',
    ].join('\n'),
  }, fe);
  ok(e.f() === 7, msg);
});
both('chosen branch IS checked', (fe, msg) => {
  const err = errorOf({
    'a.wat': '(defoption ON bool true "on")\n(func (export "f") (result i32) (if-const (option ON) (then (call $no_such_function)) (else (i32.const 7))))',
  }, fe);
  ok(err !== null && /no_such_function/.test(err), `${msg}: ${err && err.split('\n')[0]}`);
});
both('unchosen branch must still parse', (fe, msg) => {
  const err = errorOf({ 'a.wat': '(func (export "f") (result i32) (if-const (target simd) (then (i32.const 1 ) (else (i32.const 0)))' }, fe);
  ok(err !== null, `${msg}: ${err && err.split('\n')[0]}`);
});

// ── const immediates ────────────────────────────────────────────────────────
both('(const N) as an i32 and an i64 immediate, with hex/underscore/negative values', (fe, msg) => {
  const e = exportsOf({
    'a.wat': [
      '(defconst A 0xFF_FF)',
      '(defconst NEG (sub 0 5))',
      '(defconst BIG (shl 1 40))',
      '(defconst MASK (and-bits (or-bits 0xF0 0x0F) 0x3C))',
      '(func (export "a") (result i32) (i32.const (const A)))',
      '(func (export "neg") (result i32) (i32.const (const NEG)))',
      '(func (export "big") (result i64) (i64.const (const BIG)))',
      '(func (export "mask") (result i32) (i32.const (const MASK)))',
      '(global $ga i32 (i32.const (const A)))',
      '(func (export "g") (result i32) (global.get $ga))',
    ].join('\n'),
  }, fe);
  ok(e.a() === 0xFFFF && e.neg() === -5 && e.big() === 1n << 40n && e.mask() === 0x3C && e.g() === 0xFFFF, msg);
});
both('a const too wide for i32.const is an error', (fe, msg) => {
  const err = errorOf({ 'a.wat': '(defconst BIG (shl 1 40))\n(func (export "f") (result i32) (i32.const (const BIG)))' }, fe);
  ok(err !== null && /BIG/.test(err), `${msg}: ${err && err.split('\n')[0]}`);
});
both('comparison and logic operators', (fe, msg) => {
  const e = exportsOf({
    'a.wat': [
      '(defconst T (and (lt 1 2) (le 2 2) (gt 3 2) (ge 3 3) (ne 1 2) (not (eq 1 2)) (or false true)))',
      '(defconst ARITH (add (mul 3 4) (sub 10 (shr 16 2))))',
      '(func (export "t") (result i32) (if-const (const T) (then (i32.const 1)) (else (i32.const 0))))',
      '(func (export "arith") (result i32) (i32.const (const ARITH)))',
    ].join('\n'),
  }, fe);
  ok(e.t() === 1 && e.arith() === 18, msg);
});

// ── targets ─────────────────────────────────────────────────────────────────
for (const tailCalls of [true, false]) {
  both(`(target tail-calls) follows the tailCalls option (${tailCalls})`, (fe, msg) => {
    const e = exportsOf({
      'a.wat': '(func (export "tc") (result i32) (if-const (target tail-calls) (then (i32.const 1)) (else (i32.const 2))))\n' +
        '(func (export "prod") (result i32) (if-const (target production) (then (i32.const 1)) (else (i32.const 2))))',
    }, Object.assign({ tailCalls }, fe));
    ok(e.tc() === (tailCalls ? 1 : 2) && e.prod() === 1, msg);
  });
}

// ── module level, function body, macro body ─────────────────────────────────
both('module-level if-const chooses globals and functions', (fe, msg) => {
  const files = {
    'a.wat': [
      '(defoption V (enum one two) one "which")',
      '(if-const (eq (option V) one)',
      '  (then (global $g i32 (i32.const 1)) (func $pick (result i32) (global.get $g)))',
      '  (else (global $g i32 (i32.const 2)) (func $pick (result i32) (i32.add (global.get $g) (i32.const 40)))))',
      '(func (export "f") (result i32) (call $pick))',
    ].join('\n'),
  };
  const a = exportsOf(files, fe), b = exportsOf(files, Object.assign({ define: { V: 'two' } }, fe));
  ok(a.f() === 1 && b.f() === 42, msg);
});
both('if-const inside a macro body, expanded inside function bodies', (fe, msg) => {
  const files = {
    'a.wat': [
      '(defoption FAST bool false "pick the fast path")',
      '(type $thunk (func (result i32)))',
      '(table 2 funcref)',
      '(func $one (result i32) (i32.const 1))',
      '(func $two (result i32) (i32.const 2))',
      '(elem (i32.const 0) $one $two)',
      // The routed case: indirect-call types live in both arms, and only the
      // chosen arm may register one.
      '(defmacro (step $i)',
      '  (if-const (option FAST)',
      '    (then (i32.add (call_indirect (type $thunk) (local.get $i)) (i32.const 100)))',
      '    (else (call_indirect (type $thunk_absent) (local.get $i)))))',
      '(defmacro (pick $i) (if-const (option FAST) (then (step $i)) (else (call_indirect (type $thunk) (local.get $i)))))',
      '(func (export "f") (param $i i32) (result i32) (pick $i))',
      '(func (export "g") (param $i i32) (result i32) (if (local.get $i) (then (return (pick $i)))) (i32.const -1))',
    ].join('\n'),
  };
  const a = exportsOf(files, fe), b = exportsOf(files, Object.assign({ define: { FAST: 'true' } }, fe));
  ok(a.f(0) === 1 && a.f(1) === 2 && a.g(1) === 2 && b.f(0) === 101 && b.g(1) === 102 && b.g(0) === -1, msg);
});
both('a header clause may come from a conditional', (fe, msg) => {
  const files = {
    'a.wat': [
      '(defoption EXPORTED bool true "export it")',
      '(func $f (if-const (option EXPORTED) (then (export "f"))) (result i32) (i32.const 5))',
      '(func (export "keep") (result i32) (call $f))',
    ].join('\n'),
  };
  const a = exportsOf(files, fe), b = exportsOf(files, Object.assign({ define: { EXPORTED: 'false' } }, fe));
  ok(a.f() === 5 && b.f === undefined && b.keep() === 5, msg);
});
both('cond-const with no matching clause and no else expands to nothing', (fe, msg) => {
  const e = exportsOf({
    'a.wat': '(global $g (mut i32) (i32.const 3))\n(func (export "f") (result i32) (cond-const ((eq 1 2) (global.set $g (i32.const 9)))) (global.get $g))',
  }, fe);
  ok(e.f() === 3, msg);
});

// ── the facts record what was read ──────────────────────────────────────────
both('facts: options, constants, targets and per-file reads', (fe, msg) => {
  const r = build(typed, Object.assign({ facts: true, define: { MODE: 'fast' } }, fe));
  const f = JSON.parse(JSON.stringify(r.facts.compileTime));
  const opt = Object.fromEntries(f.options.map(o => [o.name, o]));
  ok(r.success, msg + ': compiles');
  assert.deepStrictEqual([opt.MODE.value, opt.MODE.source, opt.MODE.members], ['fast', 'define', ['fast', 'safe', 'slow']]);
  assert.deepStrictEqual([opt.SIZE.value, opt.SIZE.source, opt.FLAG.value], [16, 'default', false]);
  assert.strictEqual(opt.WIDE.value, '4294967296', 'i64 values are decimal strings');
  assert.strictEqual(f.constants.find(c => c.name === 'SIZE2').value, 32);
  // use.wat reads (const SIZE2), which reads SIZE: reads are transitive
  // through constants, because that file's output depends on SIZE.
  assert.deepStrictEqual(f.reads, { 'opts.wat': ['option SIZE'], 'use.wat': ['option FLAG', 'option MODE', 'option SIZE', 'option WIDE'] });
  ok(true, msg + ': values, sources, constants and per-file reads');
});

console.log(`watx-compiler-cfg: ${checks} checks passed`);
