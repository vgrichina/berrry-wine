#!/usr/bin/env node
'use strict';
// Execute the actual DriverProc wrapper AST with explicit modeled boundaries.
// No wasm build or guest execution. This verifies wrapper ordering, not the
// implementation of run/sync/token primitives or real x86 calling conventions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseSource } = require('../tools/watx');
const source = fs.readFileSync(process.argv[2] ||
  path.join(__dirname, '../src/09a7g-video-icm.wat'), 'utf8');
const fn = parseSource(source, 'icm.wat').find(n => n[1] === 'func' && n[2] === '$icm_drv_call');
assert(fn);
class Trap extends Error {}
class Jump { constructor(label) { this.label = label; } }
class Return { constructor(value) { this.value = value; } }
function fixture() {
  const g = {
    $reg_base: 0, $eip: 101, $current_thunk_eip: 102,
    $handler_set_eip: 103, $steps: 104, $yield_reason: 105, $yield_flag: 106,
    $sync_msg_ret_thunk: 0x1234, $ICERR_UNSUPPORTED: -1,
    $invocation_root: 1n, $sync_msg_depth: 0,
  };
  const m = new Map(Array.from({ length: 8 }, (_, i) => [i * 4, i === 4 ? 4096 : 200 + i]));
  const stack = [1n], seen = [];
  let next = 2n, leaves = 0, runs = 0, hook, enterFailure = false;
  const snap = () => ({ g: { ...g }, m: [...m], stack: [...stack], leaves });
  function call(proc = 500) {
    const l = { $proc: proc, $id: 11, $hdrv: 22, $msg: 33, $p1: 44, $p2: 55 };
    for (const n of fn.slice(3)) if (Array.isArray(n) && n[1] === 'local') l[n[2]] = n[3] === 'i64' ? 0n : 0;
    function seq(nodes) { let r; for (const n of nodes) r = ev(n); return r; }
    function ev(n) {
      const op = n[1], a = n.slice(2);
      const v = i => ev(a[i]);
      switch (op) {
        case 'local': case 'param': case 'result': return;
        case 'local.get': return l[a[0]];
        case 'global.get': return g[a[0]];
        case 'local.set': return void (l[a[0]] = v(1));
        case 'global.set': return void (g[a[0]] = v(1));
        case 'i32.const': return Number(a[0]);
        case 'i32.add': return (v(0) + v(1)) | 0;
        case 'i32.sub': return (v(0) - v(1)) | 0;
        case 'i32.eqz': return Number(v(0) === 0);
        case 'i32.ne': case 'i64.ne': return Number(v(0) !== v(1));
        case 'i32.ge_u': return Number((v(0) >>> 0) >= (v(1) >>> 0));
        case 'i32.load': case 'i32.store': {
          const offset = typeof a[0] === 'string' ? Number(a.shift().split('=')[1]) : 0;
          const addr = ev(a[0]) + offset;
          if (op === 'i32.load') return m.get(addr) || 0;
          m.set(addr, ev(a[1])); return;
        }
        case 'select': { const x = v(0), y = v(1); return v(2) ? x : y; }
        case 'if': return v(0) ? seq(a[1].slice(2)) : undefined;
        case 'unreachable': throw new Trap('ownership trap');
        case 'return': throw new Return(v(0));
        case 'br': throw new Jump(a[0]);
        case 'br_if': if (v(1)) throw new Jump(a[0]); return;
        case 'block':
          try { return seq(a.slice(1)); } catch (e) {
            if (!(e instanceof Jump && e.label === a[0])) throw e;
            return;
          }
        case 'loop':
          for (let guard = 0; guard < 100; guard++) {
            try { return seq(a.slice(1)); } catch (e) {
              if (!(e instanceof Jump && e.label === a[0])) throw e;
            }
          }
          throw new Error('unexpected unbounded source loop');
        case 'call': {
          const args = a.slice(1).map(ev);
          switch (a[0]) {
            case '$sync_depth_enter':
              if (enterFailure) throw new Trap('capacity');
              stack.push(next++); g.$sync_msg_depth++; return;
            case '$invocation_current': return stack.at(-1);
            case '$sync_depth_leave':
              assert(stack.length > 1); stack.pop(); g.$sync_msg_depth--; leaves++; return;
            case '$gs32': m.set(args[0], args[1]); return;
            case '$host_log_i32': return;
            case '$run':
              runs++; seen.push(stack.at(-1)); return hook();
            default: throw new Error(`unmodeled call ${a[0]}`);
          }
        }
        default: throw new Error(`unmodeled AST ${op}`);
      }
    }
    try { return seq(fn.slice(3)); } catch (e) {
      if (e instanceof Return) return e.value;
      throw e;
    }
  }
  const complete = () => { g.$eip = 0; m.set(16, m.get(16) + 24); m.set(0, 77); };
  hook = complete;
  return { g, m, stack, seen, snap, call, complete,
    hook: f => { hook = f; }, failEnter: () => { enterFailure = true; },
    sibling: () => { stack.pop(); stack.push(next++); },
    child: () => stack.push(next++), runs: () => runs };
}
function restored(f, before) {
  assert.deepEqual(f.g, before.g);
  for (const [k, v] of before.m) assert.equal(f.m.get(k), v);
  assert.deepEqual(f.stack, before.stack);
}
let cases = 0;
{
  const f = fixture(), before = f.snap();
  assert.equal(f.call(0), -1); assert.deepEqual(f.snap(), before); cases++;
}
{
  const f = fixture(), before = f.snap(); f.failEnter();
  assert.throws(() => f.call(), Trap);
  assert.deepEqual(f.snap(), before, 'ownership failure must precede every guest write'); cases++;
}
{
  const f = fixture(), before = f.snap();
  f.hook(() => {
    assert.deepEqual(Array.from({ length: 6 }, (_, i) => f.m.get(4072 + i * 4)),
      [0x1234, 11, 22, 33, 44, 55]);
    if (f.runs() === 3) f.complete();
  });
  assert.equal(f.call(), 77); restored(f, before);
  assert.equal(new Set(f.seen).size, 1, 'slices retain identity');
  const first = f.seen[0]; f.hook(f.complete); f.call();
  assert.notEqual(f.seen.at(-1), first, 'siblings get fresh identities'); cases++;
}
{
  const f = fixture(), before = f.snap(); let nested = false;
  f.hook(() => {
    if (!nested) {
      nested = true; const parent = f.stack.at(-1), context = f.snap();
      assert.equal(f.call(600), 77); restored(f, context);
      assert.equal(f.stack.at(-1), parent);
    }
    f.complete();
  });
  assert.equal(f.call(), 77); restored(f, before);
  assert.notEqual(f.seen[0], f.seen[1]); cases++;
}
for (const timeout of [false, true]) {
  for (const fault of ['sibling', 'child', 'root', 'depth', 'run-trap']) {
    const f = fixture(); let after;
    f.hook(() => {
      if (timeout && f.runs() < 64) return;
      if (!timeout) f.complete();
      if (fault === 'sibling') f.sibling();
      if (fault === 'child') f.child();
      if (fault === 'root') f.g.$invocation_root++;
      if (fault === 'depth') f.g.$sync_msg_depth++;
      after = f.snap();
      if (fault === 'run-trap') throw new Trap('callback abort');
    });
    assert.throws(() => f.call(), Trap, `${fault}, timeout=${timeout}`);
    assert.deepEqual(f.snap(), after, 'reject before pop or interrupted-context restoration');
    cases++;
  }
}
{
  const f = fixture(), before = f.snap(); f.hook(() => {});
  assert.equal(f.call(), -1); assert.equal(f.runs(), 64);
  restored(f, before); cases++;
}
console.log(`ICM source ownership PASS: ${cases} cases; modeled boundaries, no guest/runtime qualification`);
