'use strict';

const assert = require('assert/strict');
const { compileClosure, watxSourceClosure } = require('../tools/watx-closure');
const { isRuntimeClosure, protectClosure } = require('../tools/protected-writer-entries');

// Actual standalone API users run separately in the focused suite. This small
// module proves the same empty-VFS contract without any production globals.
const standalone = { source: '(func (export "value") (result i32) (i32.const 37))', vfs: new Map() };
assert.equal(isRuntimeClosure(standalone), false);
const plain = compileClosure(standalone);
assert(plain.success, plain.error);
assert.equal(new WebAssembly.Instance(new WebAssembly.Module(plain.wasmBinary)).exports.value(), 37);
const standaloneRun = { source: standalone.source.replace('"value"', '"run"'), vfs: new Map() };
assert.equal(isRuntimeClosure(standaloneRun), false, 'a generic run export does not identify the Wine runtime');
const plainRun = compileClosure(standaloneRun);
assert(plainRun.success, plainRun.error);
assert.equal(new WebAssembly.Instance(new WebAssembly.Module(plainRun.wasmBinary)).exports.run(), 37);

const text = `
 (global $rep_store_step (mut i32) (i32.const 0))
 (global $value (mut i32) (i32.const 9))
 (func (export "set_rep_store_step") (param i32) (global.set $rep_store_step (local.get 0)))
 (func $write (export "write") (global.set $value (i32.const 19)))
 (func (export "value") (result i32) (global.get $value))`;
const runtime = { entry: 'src/main.watx', source: '(include "runtime.wat")', vfs: new Map([['runtime.wat', text]]) };
const compiled = compileClosure(runtime);
assert(compiled.success, compiled.error);
const e = new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary)).exports;
e.set_rep_store_step(1);
assert.throws(() => e.write(), WebAssembly.RuntimeError);
assert.equal(e.value(), 9);
e.set_rep_store_step(0); e.write(); assert.equal(e.value(), 19);

const noGlobal = text.replace(/\(global \$rep_store_step[^\n]+\n/, '');
for (const entry of ['src/main.watx', undefined]) {
  const c = { ...runtime, entry, vfs: new Map([['runtime.wat', noGlobal]]) };
  assert(isRuntimeClosure(c), 'copying/removing entry cannot remove runtime identity');
  assert.throws(() => compileClosure(c, { protect: false }), /requires \$rep_store_step/);
}
assert.throws(() => compileClosure({ ...standalone, entry: 'src/main.watx' }), /include-only root/);
assert.throws(() => compileClosure({ source: text, vfs: new Map() }), /include-only root/);
assert.throws(() => compileClosure({ ...runtime, source: runtime.source + '\n(func (export "unguarded"))' }), /include-only root/);
assert.throws(() => protectClosure({ ...runtime, vfs: new Map([['runtime.wat', text + '\n(include "hidden.wat")'], ['hidden.wat', '(func (export "hidden"))']]) }), /nested protected-entry/);

// Real runtime, with both identity metadata and the arming declaration removed.
// No compiler invocation: failure must precede producing an unguarded module.
const canonical = watxSourceClosure();
delete canonical.entry;
for (const [key, value] of canonical.vfs) canonical.vfs.set(key, value.replace(/\(global \$rep_store_step[^\n]+\n/, ''));
assert(isRuntimeClosure(canonical));
assert.throws(() => compileClosure(canonical), /requires \$rep_store_step/);
console.log('PASS standalone compilation, actual protected export execution and canonical bypass rejection');
