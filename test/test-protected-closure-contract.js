'use strict';

// The store-step export guard is SOURCE now (src/13a-export-guards.wat, a WATX
// export-wrap), not a rewrite tools/ applied before compiling. So the contract
// is three things a reader can check without trusting a build script:
//
//   1. compileClosure() compiles exactly what it is given: a standalone
//      module is never rewritten, whatever its exports are called.
//   2. the canonical closure carries the guard: main.watx includes the guard
//      fragment, and the declaration there is the default-deny policy.
//   3. the guard does what it says when compiled, on a module shaped like the
//      runtime: an armed write refuses before any effect, a pure read and the
//      named exceptions stay callable, disarming restores the write.
//
// Which runtime exports the canonical build actually wraps is in
// build/watx-facts.json (exports[].wrappers); the inventory gate is
// test/watx-compiler-export-wrap.test.js plus the store-step candidates.

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
const decl = guards.slice(guards.indexOf('(export-wrap'));
const squash = s => s.replace(/\s+/g, ' ').trim();
assert.equal(squash(decl), squash(`(export-wrap
    (match (and (all)
                (not (pure))
                (not (name "run" "set_rep_store_step" "guest_read8" "guest_read32"))))
    (prologue
      (if (global.get $rep_store_step)
        (then (unreachable)))))`), 'the guard is default-deny with exactly four named exceptions');
// The fragment the include names is on disk under src/ (no second copy).
assert.equal(fs.readFileSync(path.join(__dirname, '../src/13a-export-guards.wat'), 'utf8'), guards);

// 3. The same declaration, compiled on a runtime-shaped module, behaves.
const text = `
 (global $rep_store_step (mut i32) (i32.const 0))
 (global $value (mut i32) (i32.const 9))
 (func (export "set_rep_store_step") (param i32) (global.set $rep_store_step (local.get 0)))
 (func $write (export "write") (global.set $value (i32.const 19)))
 (func (export "value") (result i32) (global.get $value))
 (func (export "run") (param i32) (global.set $value (local.get 0)))`;
const runtime = { source: '(include "runtime.wat")\n(include "13a-export-guards.wat")',
  vfs: new Map([['runtime.wat', text], ['13a-export-guards.wat', guards]]) };
for (const tailCalls of [true, false]) {
  const compiled = compileClosure(runtime, { tailCalls, facts: true });
  assert(compiled.success, compiled.error);
  const e = new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary)).exports;
  e.set_rep_store_step(1);
  assert.throws(() => e.write(), WebAssembly.RuntimeError);
  assert.equal(e.value(), 9, 'refused before any effect; a pure read is still callable');
  e.run(4); assert.equal(e.value(), 4, 'run is a named exception');
  e.set_rep_store_step(0); e.write(); assert.equal(e.value(), 19);
  const wrapped = JSON.parse(JSON.stringify(compiled.facts.exports))
    .filter(x => x.kind === 'func' && x.wrappers.length).map(x => x.name);
  assert.deepEqual(wrapped, ['write']);
}
console.log('PASS unrewritten standalone compiles, canonical guard declaration, guarded export execution (tail + compat)');
