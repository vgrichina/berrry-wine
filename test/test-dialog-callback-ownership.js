#!/usr/bin/env node
'use strict';
// Execute the actual synchronous x86 wndproc branch AST. The routing prefix
// and native edit fallback are outside this harness. Core invocation, run and
// host boundaries are modeled: this is source conformance, NOT fullVM proof.
// Evaluator adapted from RichEdit 3c01665c (itself based on ICM 066436de).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseSource } = require('../tools/watx');
const source = fs.readFileSync(process.argv[2] ||
  path.join(__dirname, '../src/09c3a-dialog-runtime.wat'), 'utf8');
const whole = parseSource(source, 'dialog.wat').find(n => n[1] === 'func' && n[2] === '$wnd_send_message_inner');
assert(whole);
const start = whole.findIndex(n => n[1] === 'local.set' && n[2] === '$old_eip');
const end = whole.findIndex(n => n[1] === 'global.set' && n[2] === '$yield_flag' && n[3][2] === '$old_yield_flag');
assert(start > 0 && end > start, 'extract entire synchronous branch through restoration');
let fn = ['func', ...whole.filter(n => Array.isArray(n) && n[1] === 'local'),
  ...whole.slice(start, end + 1), [0, 'local.get', '$result']];
class Trap extends Error {}
class Jump { constructor(label) { this.label = label; } }
class Return { constructor(value) { this.value = value; } }
function fixture(depth = 0) {
  const g = {
    $reg_base: 0, $eip: 101,
    $handler_set_eip: 103, $steps: 104, $yield_reason: 105, $yield_flag: 106,
    $sync_msg_ret_thunk: 0x1234, $sleep_yielded: 7, $wnd_send_completed: 1,
    $invocation_root: 0x100000001n, $sync_msg_depth: depth,
  };
  const m = new Map(Array.from({ length: 8 }, (_, i) => [i * 4, i === 4 ? 4096 : 200 + i]));
  const stack = Array.from({ length: depth + 1 }, (_, i) => 0x100000001n + BigInt(i)), seen = [];
  let next = stack.at(-1) + 1n, leaves = 0, runs = 0, hook, enterFailure = false;
  let service = () => 0, services = 0;
  const snap = () => ({ g: { ...g }, m: [...m], stack: [...stack], leaves });
  function call(wp = 500) {
    const l = { $wp: wp, $hwnd: 11, $msg: 22, $wParam: 33, $lParam: 44 };
    for (const n of fn.slice(1)) if (Array.isArray(n) && n[1] === 'local') l[n[2]] = n[3] === 'i64' ? 0n : 0;
    l.$wp = wp; // Set by the routing prefix, outside the extracted branch.
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
        case 'i32.eq': return Number(v(0) === v(1));
        case 'i32.and': return v(0) & v(1);
        case 'i32.or': return v(0) | v(1);
        case 'i32.ne': case 'i64.ne': return Number(v(0) !== v(1));
        case 'i32.ge_u': return Number((v(0) >>> 0) >= (v(1) >>> 0));
        case 'i32.load': case 'i32.store': {
          const offset = typeof a[0] === 'string' ? Number(a.shift().split('=')[1]) : 0;
          const addr = ev(a[0]) + offset;
          if (op === 'i32.load') return m.get(addr) || 0;
          m.set(addr, ev(a[1])); return;
        }
        case 'select': { const x = v(0), y = v(1); return v(2) ? x : y; }
        case 'if': return v(0) ? seq(a[1].slice(2)) : a[2] ? seq(a[2].slice(2)) : undefined;
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
          for (let guard = 0; guard < 5000; guard++) {
            try { return seq(a.slice(1)); } catch (e) {
              if (!(e instanceof Jump && e.label === a[0])) throw e;
            }
          }
          throw new Error('unexpected unbounded source loop');
        case 'call': {
          const args = a.slice(1).map(ev);
          switch (a[0]) {
            case '$sync_depth_enter':
              if (enterFailure || stack.length >= 64) throw new Trap('capacity');
              stack.push(next++); g.$sync_msg_depth++; return;
            case '$invocation_current': return stack.at(-1);
            case '$sync_depth_leave':
              assert(stack.length > 1); stack.pop(); g.$sync_msg_depth--; leaves++; return;
            case '$host_log_i32': return;
            case '$host_service_load_library': services++; return service();
            case '$gs32': m.set(args[0], args[1]); return;
            case '$run':
              assert.deepEqual(Array.from(args), [1000000], 'preserve bounded slice budget');
              runs++; seen.push(stack.at(-1)); return hook();
            default: throw new Error(`unmodeled call ${a[0]}`);
          }
        }
        default: throw new Error(`unmodeled AST ${op}`);
      }
    }
    try { return seq(fn.slice(1)); } catch (e) {
      if (e instanceof Return) return e.value;
      throw e;
    }
  }
  const complete = () => { g.$eip = 0; m.set(16, m.get(16) + 20); m.set(0, 77); };
  hook = complete;
  return { g, m, stack, seen, snap, call, complete,
    hook: f => { hook = f; }, service: f => { service = f; }, services: () => services, failEnter: () => { enterFailure = true; },
    sibling: () => { stack.pop(); stack.push(next++); },
    child: () => stack.push(next++), runs: () => runs };
}
function restored(f, before, completed = 1) {
  assert.deepEqual(f.g, { ...before.g, $wnd_send_completed: completed });
  for (const [k, v] of before.m) assert.equal(f.m.get(k), v);
  assert.deepEqual(f.stack, before.stack);
}
function suite() {
let cases = 0;
{
  const f = fixture(63), before = f.snap();
  assert.throws(() => f.call(), Trap);
  assert.deepEqual(f.snap(), before, 'ownership failure must precede every guest write'); cases++;
}
{
  const f = fixture(), before = f.snap(); f.failEnter();
  assert.throws(() => f.call(), Trap);
  assert.deepEqual(f.snap(), before, 'entry validation failure must precede guest writes'); cases++;
}
{
  const f = fixture(62), before = f.snap();
  assert.equal(f.call(), 77); restored(f, before);
  assert.equal(f.snap().leaves, 1, 'last available child retires once'); cases++;
}
{
  const f = fixture(), before = f.snap();
  f.hook(() => {
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => f.m.get(4076 + i * 4)),
      [0x1234, 11, 22, 33, 44]);
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
{
  const f = fixture(), before = f.snap(); let nested = false;
  f.hook(() => {
    if (nested) return; // Inner callback exhausts its 64 rounds.
    nested = true;
    const parent = f.snap();
    assert.equal(f.call(600), parent.m[0][1]); restored(f, parent, 0);
    f.complete();
  });
  assert.equal(f.call(), 77); restored(f, before);
  assert.equal(f.runs(), 65); assert.equal(f.snap().leaves, 2); cases++;
}
for (const exit of ['return', 'timeout', 'sleep-timeout', 'load-serviced', 'load-failed']) {
  for (const fault of ['sibling', 'child', 'owner-high', 'root', 'depth', 'run-trap']) {
    const f = fixture(); let after;
    f.service(() => exit === 'load-serviced' ? 1 : 0);
    f.hook(() => {
      if (exit === 'sleep-timeout') f.g.$sleep_yielded = 1;
      if (exit.startsWith('load-')) f.g.$yield_reason = 5;
      if ((exit === 'timeout' || exit === 'load-failed') && f.runs() < 64) return;
      if (exit === 'sleep-timeout' && f.runs() < 4096) return;
      if (exit === 'load-serviced' && f.runs() < 2) return;
      if (exit === 'return' || exit === 'load-serviced') f.complete();
      if (fault === 'sibling') f.sibling();
      if (fault === 'child') f.child();
      if (fault === 'owner-high') f.stack[f.stack.length - 1] += 0x100000000n;
      if (fault === 'root') f.g.$invocation_root += 0x100000000n;
      if (fault === 'depth') f.g.$sync_msg_depth++;
      after = f.snap();
      if (fault === 'run-trap') throw new Trap('callback abort');
      // Sleep accounting consumes this flag before the common exit checks.
      if (exit === 'sleep-timeout') after.g.$sleep_yielded = 0;
    });
    assert.throws(() => f.call(), Trap, `${fault}, exit=${exit}`);
    assert.deepEqual(f.snap(), after, 'reject before pop or interrupted-context restoration');
    cases++;
  }
}
{
  const f = fixture(), before = f.snap(); f.hook(() => {});
  assert.equal(f.call(), before.m[0][1]); assert.equal(f.runs(), 64);
  restored(f, before, 0); cases++;
}
for (const exit of ['sleep-return', 'sleep-timeout', 'load-serviced', 'load-failed']) {
  const f = fixture(), before = f.snap();
  const limit = exit === 'sleep-timeout' ? 4096 : exit === 'load-failed' ? 64 : 3;
  const completed = Number(exit === 'sleep-return' || exit === 'load-serviced');
  f.service(() => exit === 'load-serviced' ? 1 : 0);
  f.hook(() => {
    if (exit.startsWith('sleep')) f.g.$sleep_yielded = 1;
    else f.g.$yield_reason = 5;
    if (completed && f.runs() === limit) f.complete();
  });
  assert.equal(f.call(), completed ? 77 : before.m[0][1]);
  assert.equal(f.runs(), limit);
  restored(f, before, completed);
  assert.equal(f.snap().leaves, 1);
  assert.equal(new Set(f.seen).size, 1);
  cases++;
}
{
  // A successful service may itself synchronously nest; the outer child stays
  // retained across the continue back-edge, and is checked at final exit.
  const f = fixture(), before = f.snap(); let serviced = false;
  f.hook(() => {
    if (serviced) f.complete();
    else f.g.$yield_reason = 5;
  });
  f.service(() => {
    serviced = true; const parent = f.snap();
    assert.equal(f.call(600), 77); restored(f, parent);
    return 1;
  });
  assert.equal(f.call(), 77); restored(f, before);
  assert.equal(f.services(), 1); assert.equal(f.snap().leaves, 2); cases++;
}
{
  const f = fixture(); let after;
  f.hook(() => { f.g.$yield_reason = 5; });
  f.service(() => { after = f.snap(); throw new Trap('load service abort'); });
  assert.throws(() => f.call(), Trap);
  assert.deepEqual(f.snap(), after, 'host abort cannot retire or restore'); cases++;
}
{
  const f = fixture(); let after;
  f.hook(() => {
    f.complete(); f.m.set(16, f.m.get(16) - 4); after = f.snap();
  });
  assert.throws(() => f.call(), Trap);
  assert.deepEqual(f.snap(), after, 'malformed stdcall cannot retire or restore'); cases++;
}
return cases;
}
const cases = suite();
// Run the same behavioral assertions against broken ASTs. Each mutation must
// be killed by an assertion, not merely by an unsupported evaluator operation.
const good = fn;
const clone = () => JSON.parse(JSON.stringify(good));
let negatives = 0;
for (const field of ['$expected_child', '$expected_root', '$expected_depth']) {
  fn = clone();
  const i = fn.findIndex(n => Array.isArray(n) && n[1] === 'if' &&
    JSON.stringify(n).includes(field));
  assert(i > 0); fn.splice(i, 1);
  assert.throws(suite, assert.AssertionError, 'missing retained guard must fail: ' + field);
  negatives++;
}
fn = clone();
const enter = fn.findIndex(n => Array.isArray(n) && n[1] === 'call' && n[2] === '$sync_depth_enter');
const [entry] = fn.splice(enter, 1);
const loop = fn.findIndex(n => Array.isArray(n) && n[1] === 'block');
fn.splice(loop, 0, entry);
assert.throws(suite, assert.AssertionError, 'late acquisition must fail before-write capacity test');
negatives++;
fn = clone();
const espGuard = fn.findIndex(n => Array.isArray(n) && n[1] === 'if' &&
  JSON.stringify(n).includes('$old_esp'));
assert(espGuard > 0); fn.splice(espGuard, 1);
assert.throws(suite, assert.AssertionError, 'missing completed ESP guard must fail');
negatives++;
fn = good;
console.log(`Dialog source ownership PASS: ${cases} cases, ${negatives} mutation negatives; modeled boundaries, no fullVM qualification`);
