'use strict';

// The store-step export guard is SOURCE now (src/13a-export-guards.wat, a WATX
// `advise ... (at export)`), not a rewrite tools/ applied before compiling. So
// the contract is three things a reader can check without trusting a build
// script:
//
//   1. compileClosure() compiles exactly what it is given: a standalone
//      module is never rewritten, whatever its exports are called.
//   2. the canonical closure carries the guard: main.watx includes the guard
//      fragment, the declaration there is the default-deny policy, and the
//      only opt-outs are four `(no-advise "store-step")` clauses, each on the
//      function it exempts.
//   3. the guard does what it says when compiled, on a module shaped like the
//      runtime: an armed write refuses before any effect, a pure read and the
//      opted-out functions stay callable, disarming restores the write.
//
// Which runtime exports the canonical build actually guards is in
// build/watx-facts.json (exports[].advice, advice.chains); the language
// behaviour is test/watx-compiler-advise.test.js.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { compileClosure, watxSourceClosure } = require('../tools/watx-closure');

// 1. Nothing is rewritten.
const standalone = { source: '(func (export "value") (result i32) (i32.const 37))', vfs: new Map() };
const plain = compileClosure(standalone);
assert(plain.success, plain.error);
assert.equal(new WebAssembly.Instance(new WebAssembly.Module(plain.wasmBinary)).exports.value(), 37);
const standaloneRun = { source: standalone.source.replace('"value"', '"run"'), vfs: new Map() };
const plainRun = compileClosure(standaloneRun);
assert(plainRun.success, plainRun.error);
assert.equal(new WebAssembly.Instance(new WebAssembly.Module(plainRun.wasmBinary)).exports.run(), 37);

// 2. The canonical closure includes the guard, with the documented policy.
const canonical = watxSourceClosure();
assert.match(canonical.source, /^\(include "13a-export-guards\.wat"\)$/m, 'main.watx includes the export guards');
const guards = canonical.vfs.get('13a-export-guards.wat');
const decl = guards.slice(guards.indexOf('(advise'));
const squash = s => s.replace(/\s+/g, ' ').trim();
assert.equal(squash(decl), squash(`(advise "store-step"
    (match (and (export) (not (pure))))
    (at export)
    :before
      (if (global.get $rep_store_step)
        (then (unreachable))))`), 'the guard is default-deny, named so functions can opt out');
// The fragment the include names is on disk under src/ (no second copy).
assert.equal(fs.readFileSync(path.join(__dirname, '../src/13a-export-guards.wat'), 'utf8'), guards);
// Exactly four opt-outs, each inside the function it exempts.
const optOuts = [];
for (const file of fs.readdirSync(path.join(__dirname, '../src')).filter(n => /\.watx?$/.test(n))) {
  const lines = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!/^\s*\(no-advise "store-step"\)/.test(line)) return;
    let j = i;
    while (j >= 0 && !/^\s*\(func\b/.test(lines[j])) j--;
    const m = j >= 0 && lines[j].match(/\(func (\$\S+)|\(export "([^"]+)"\)/);
    optOuts.push(`${file}:${m ? m[1] || m[2] : '?'}`);
  });
}
assert.deepEqual(optOuts.sort(), ['07-decoder.wat:set_rep_store_step', '13-exports.wat:guest_read32',
  '13-exports.wat:guest_read8', '13-exports.wat:$run'].sort(), 'exactly four functions opt out of store-step');

// 3. The same declaration, compiled on a runtime-shaped module, behaves.
const text = `
 (global $rep_store_step (mut i32) (i32.const 0))
 (global $value (mut i32) (i32.const 9))
 (func $set_rep_store_step (export "set_rep_store_step") (param i32) (no-advise "store-step")
   (global.set $rep_store_step (local.get 0)))
 (func $write (export "write") (global.set $value (i32.const 19)))
 (func (export "value") (result i32) (global.get $value))
 (func $run (export "run") (param i32) (no-advise "store-step") (global.set $value (local.get 0)))`;
const runtime = { source: '(include "runtime.wat")\n(include "13a-export-guards.wat")',
  vfs: new Map([['runtime.wat', text], ['13a-export-guards.wat', guards]]) };
for (const tailCalls of [true, false]) {
  const compiled = compileClosure(runtime, { tailCalls, facts: true });
  assert(compiled.success, compiled.error);
  const e = new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary)).exports;
  e.set_rep_store_step(1);
  assert.throws(() => e.write(), WebAssembly.RuntimeError);
  assert.equal(e.value(), 9, 'refused before any effect; a pure read is still callable');
  e.run(4); assert.equal(e.value(), 4, 'run opted out');
  e.set_rep_store_step(0); e.write(); assert.equal(e.value(), 19);
  const facts = JSON.parse(JSON.stringify(compiled.facts));
  const guarded = facts.exports.filter(x => x.kind === 'func' && x.advice.length).map(x => x.name);
  assert.deepEqual(guarded, ['write']);
  assert.deepEqual(facts.advice.chains.map(c => [c.function, Object.keys(c.exports)]), [['$write', ['write']]]);
}
console.log('PASS unrewritten standalone compiles, canonical guard declaration and opt-outs, guarded export execution (tail + compat)');
