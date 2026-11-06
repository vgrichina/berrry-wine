#!/usr/bin/env node
'use strict';
// Execute the actual WinHelp guest-call block AST with explicit modeled boundaries.
// No wasm build or guest execution. This verifies wrapper ordering, not the
// implementation of run/sync/token primitives or real x86 calling conventions.
// Adapted from the reviewed ICM source harness (066436de); no compiler run.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const parser = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../tools/watx-src/compiler-parser.js'), 'utf8'), parser);
const { parseSource } = parser;
const source = fs.readFileSync(process.argv[2] ||
  path.join(__dirname, '../src/09c9-winhelp-ui.wat'), 'utf8');
const routine = parseSource(source, 'winhelp.wat').find(n => n[1] === 'func' && n[2] === '$help_macro_call_routine');
assert(routine);
// Parsing/heap preparation are outside this bounded ownership test. Extract
// the complete successful-call block, preserving every real guest instruction.
const block = routine.find(n => n[1] === 'if' && n[2][1] === 'local.get' && n[2][2] === '$ok');
assert(block);
let fn = [0, 'func', '$extracted', ...routine.filter(n => Array.isArray(n) && n[1] === 'local'), ...block[3].slice(2)];
class Trap extends Error {}
class Jump { constructor(label) { this.label = label; } }
class Return { constructor(value) { this.value = value; } }
function fixture(depth = 0) {
  const g = {
    $reg_base: 0, $eip: 101,
    $handler_set_eip: 103, $steps: 104, $yield_reason: 105, $yield_flag: 106, $sleep_yielded: 0,
    $sync_msg_ret_thunk: 0x1234,
    $invocation_root: 0x100000001n, $sync_msg_depth: depth,
  };
  const m = new Map(Array.from({ length: 8 }, (_, i) => [i * 4, i === 4 ? 4096 : 200 + i]));
  for (let i = 0; i < 16; i++) m.set(8192 + i * 8, 11 * (i + 1));
  const stack = Array.from({ length: depth + 1 }, (_, i) => 0x100000001n + BigInt(i)), seen = [];
  let next = stack.at(-1) + 1n, leaves = 0, runs = 0, hook, enterFailure = false, frame = 12288;
  const snap = () => ({ g: { ...g }, m: [...m], stack: [...stack], leaves });
  function call(callback = 500, count = 4) {
    const l = {};
    for (const n of fn.slice(3)) if (Array.isArray(n) && n[1] === 'local') l[n[2]] = n[3] === 'i64' ? 0n : 0;
    Object.assign(l, { $entry: callback, $count: count, $args_wa: 8192 });
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
        case 'i32.mul': return Math.imul(v(0), v(1));
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
            // The persistent frame and typed native return are exercised by
            // test-winhelp-callback-suspension-native.js. Here they are an
            // explicit boundary, retaining the original wrapper guard tests.
            case '$help_macro_frame_save':
              frame += 256; m.set(frame + 36, 1); return frame;
            case '$g2w': return args[0];
            case '$sync_depth_enter':
              if (enterFailure || stack.length >= 64) throw new Trap('capacity');
              stack.push(next++); g.$sync_msg_depth++; return;
            case '$invocation_current': return stack.at(-1);
            case '$sync_depth_leave':
              assert(stack.length > 1); stack.pop(); g.$sync_msg_depth--; leaves++; return;
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
    try { return seq(fn.slice(3)); } catch (e) {
      if (e instanceof Return) return e.value;
      throw e;
    }
  }
  const complete = () => { g.$eip = 0; m.set(16, m.get(16) + 20); m.set(0, 77); };
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
for (const count of [0, 1, 16]) {
  const f = fixture(), before = f.snap();
  f.hook(() => {
    const esp = 4096 - (count + 1) * 4;
    assert.equal(f.m.get(16), esp);
    assert.equal(f.m.get(esp), 0x1234);
    for (let i = 0; i < count; i++) assert.equal(f.m.get(esp + 4 + i * 4), 11 * (i + 1));
    assert.equal(f.g.$eip, 500);
    f.complete();
  });
  f.call(500, count); restored(f, before); cases++;
}
{
  const f = fixture(62), before = f.snap();
  f.call(); restored(f, before);
  assert.equal(f.snap().leaves, 1, 'last available child retires once'); cases++;
}
{
  const f = fixture(), before = f.snap();
  f.hook(() => {
    assert.deepEqual(Array.from({ length: 5 }, (_, i) => f.m.get(4076 + i * 4)),
      [0x1234, 11, 22, 33, 44]);
    if (f.runs() === 3) f.complete();
  });
  f.call(); restored(f, before);
  assert.equal(new Set(f.seen).size, 1, 'slices retain identity');
  const first = f.seen[0]; f.hook(f.complete); f.call();
  assert.notEqual(f.seen.at(-1), first, 'siblings get fresh identities'); cases++;
}
{
  const f = fixture(), before = f.snap(); let nested = false;
  f.hook(() => {
    if (!nested) {
      nested = true; const parent = f.stack.at(-1), context = f.snap();
      f.call(600); restored(f, context);
      assert.equal(f.stack.at(-1), parent);
    }
    f.complete();
  });
  f.call(); restored(f, before);
  assert.notEqual(f.seen[0], f.seen[1]); cases++;
}
{
  const f = fixture(), before = f.snap(); let nested = false;
  f.hook(() => {
    if (nested) return; // Inner callback exhausts its 64 rounds.
    nested = true;
    const parent = f.snap();
    f.call(600); restored(f, parent);
    f.complete();
  });
  f.call(); restored(f, before);
  assert.equal(f.runs(), 65); assert.equal(f.snap().leaves, 2); cases++;
}
for (const timeout of [false, true]) {
  for (const fault of ['sibling', 'child', 'owner-high', 'root', 'depth', 'run-trap']) {
    const f = fixture(); let after;
    f.hook(() => {
      if (timeout && f.runs() < 64) return;
      if (!timeout) f.complete();
      if (fault === 'sibling') f.sibling();
      if (fault === 'child') f.child();
      if (fault === 'owner-high') f.stack[f.stack.length - 1] += 0x100000000n;
      if (fault === 'root') f.g.$invocation_root += 0x100000000n;
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
  f.call(); assert.equal(f.runs(), 64);
  restored(f, before); cases++;
}
// A callback may change every saved register/control, even when it times out.
// Clobber them all so deletion of any restore is observably wrong.
for (const finish of ['return', 'last-slice', 'timeout']) {
  const f = fixture(), before = f.snap();
  f.hook(() => {
    for (let i = 0; i < 8; i++) f.m.set(i * 4, 900 + i);
    for (const key of ['$handler_set_eip', '$steps', '$yield_reason', '$yield_flag'])
      f.g[key] = 999;
    // A nonzero reason now intentionally transfers ownership to the host.
    // These cases test bounded synchronous execution and restoration.
    f.g.$yield_reason = 0;
    if (finish === 'return' || (finish === 'last-slice' && f.runs() === 64))
      f.complete();
  });
  f.call();
  restored(f, before);
  assert.equal(f.runs(), finish === 'return' ? 1 : 64);
  assert.equal(f.snap().leaves, 1); cases++;
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
const loop = fn.findIndex(n => Array.isArray(n) && n[1] === 'block' && n[2] === '$call_done');
fn.splice(loop, 0, entry);
assert.throws(suite, assert.AssertionError, 'late acquisition must fail before-write capacity test');
negatives++;
// Each interrupted-context restore must matter, not just appear in source.
for (const saved of ['$old_eip', '$old_esp', '$old_eax', '$old_ecx', '$old_edx',
  '$old_ebx', '$old_esi', '$old_edi', '$old_ebp', '$old_handler_set_eip',
  '$old_steps', '$old_yield_reason', '$old_yield_flag']) {
  fn = clone();
  const i = fn.findIndex(n => Array.isArray(n) &&
    ['global.set', 'i32.store'].includes(n[1]) && JSON.stringify(n).includes(saved));
  assert(i > 0); fn.splice(i, 1);
  assert.throws(suite, assert.AssertionError, 'missing restore must fail: ' + saved);
  negatives++;
}
fn = good;
console.log(`WinHelp source ownership PASS: ${cases} cases, ${negatives} mutation negatives; modeled boundaries, no fullVM qualification`);
