#!/usr/bin/env node
'use strict';
// Interpret the COMPLETE production wrapper AST, including its real walk,
// budgets, frame writes and restoration. Only run, token/spill primitives,
// guest memory translation, flags packing and synchronous IO are modeled.
// No compiler, WebAssembly module, native code or guest executable is run.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const parser = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname,
  '../tools/watx-src/compiler-parser.js'), 'utf8'), parser);
const source = fs.readFileSync(process.argv[2] || path.join(__dirname, '../src/11-seh.wat'), 'utf8');
let fn = parser.parseSource(source, 'seh.wat').find(n => n[1] === 'func' && n[2] === '$seh_fault_sync');
assert(fn);
class Trap extends Error {}
class Jump { constructor(label) { this.label = label; } }
class Return { constructor(value) { this.value = value; } }
const savedGlobals = ['$eip', '$handler_set_eip', '$steps', '$yield_reason', '$yield_flag',
  '$ip', '$resume_ip', '$eip_redirected', '$cur_page_base', '$cur_page_index', '$cur_page_chunk',
  '$cur_page_desc', '$cur_page_chunk_cap', '$cur_page_desc_cap'];
function fixture({ depth = 0, handlers = [0], dispatch = [], spill = false } = {}) {
  const g = Object.fromEntries(savedGlobals.map((k, i) => [k, 101 + i]));
  Object.assign(g, { $reg_base: 0, $fs_base: 8192, $sync_msg_ret_thunk: 0x1234,
    $fault_sync_active: 0, $fault_sync_epoch: 8, $fault_raising: 0, $rep_fault_write: 0,
    $invocation_root: 0x100000001n, $invocation_depth: depth, $sync_msg_depth: depth,
    $current_thread_id: 1, $invocation_tid: 1, $invocation_epoch: 9n,
    $guest_can_block: 1, $spill_active: Number(spill), $spill_base: 100, $spill_end: 200,
    $spill_pins: 0, $spill_desk_forced: 0 });
  const m = new Map(Array.from({ length: 8 }, (_, i) => [i * 4, i === 4 ? 16384 : 200 + i]));
  m.set(8192, handlers.length ? 9000 : -1);
  handlers.forEach((_, i) => { m.set(9000 + i * 16, i + 1 < handlers.length ? 9016 + i * 16 : -1);
    m.set(9004 + i * 16, 10000 + i * 16); });
  const stack = Array.from({ length: depth + 1 }, (_, i) => 0x100000001n + BigInt(i));
  let liveRoot = g.$invocation_root, liveEpoch = g.$invocation_epoch;
  let flags = 0x200a97, next = stack.at(-1) + 1n, leaves = 0, runs = 0, fills = 0;
  let failEnter = false, runHook, ioHook = () => 1;
  const seen = [], entryIPs = [], trace = [];
  const snap = () => ({g: {...g}, m: [...m], stack: [...stack], flags, leaves, fills});
  function validate() {
    if (!g.$invocation_root || g.$invocation_root !== liveRoot || g.$invocation_epoch !== liveEpoch ||
        g.$current_thread_id !== g.$invocation_tid) throw new Trap('stale thread/epoch/root');
  }
  function call() {
    const l = {$ga: 0x55001234};
    for (const n of fn.slice(3)) if (Array.isArray(n) && n[1] === 'local') l[n[2]] = n[3] === 'i64' ? 0n : 0;
    function seq(nodes) { let r; for (const n of nodes) r = ev(n); return r; }
    function ev(n) {
      const op = n[1], a = n.slice(2), v = i => ev(a[i]);
      switch (op) {
        case 'local': case 'param': case 'result': return;
        case 'local.get': assert(a[0] in l, a[0]); return l[a[0]];
        case 'global.get': assert(a[0] in g, a[0]); return g[a[0]];
        case 'local.set': return void (l[a[0]] = v(1));
        case 'global.set': trace.push(['set', a[0]]); return void (g[a[0]] = v(1));
        case 'i32.const': return Number(a[0]) | 0;
        case 'i32.wrap_i64': return Number(BigInt.asIntN(32, v(0))); // mutation control
        case 'i32.add': return (v(0) + v(1)) | 0;
        case 'i32.sub': return (v(0) - v(1)) | 0;
        case 'i32.and': return v(0) & v(1);
        case 'i32.or': return v(0) | v(1);
        case 'i32.eqz': return Number(v(0) === 0);
        case 'i32.eq': case 'i64.eq': return Number(v(0) === v(1));
        case 'i32.ne': case 'i64.ne': return Number(v(0) !== v(1));
        case 'i32.ge_u': return Number((v(0) >>> 0) >= (v(1) >>> 0));
        case 'i32.lt_u': return Number((v(0) >>> 0) < (v(1) >>> 0));
        case 'i32.load': case 'i32.store': {
          const offset = typeof a[0] === 'string' ? Number(a.shift().split('=')[1]) : 0;
          const addr = ev(a[0]) + offset;
          if (op === 'i32.load') return m.get(addr) || 0;
          trace.push(['store', addr]); m.set(addr, ev(a[1])); return;
        }
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
          trace.push(['call', a[0]]);
          switch (a[0]) {
            // This model has no deferred CPU pipeline to settle.
            case '$pending_gap': return;
            case '$invocation_ensure': validate(); return;
            case '$sync_depth_enter':
              validate();
              if (failEnter || g.$invocation_depth >= 63) throw new Trap('capacity/sequence');
              entryIPs.push(g.$ip);
              stack.push(next++); g.$invocation_depth++;
              if (g.$spill_active && g.$ip >= g.$spill_base && g.$ip < g.$spill_end)
                g.$spill_pins |= 1 << Math.min(g.$sync_msg_depth, 31);
              g.$sync_msg_depth++; return;
            case '$invocation_current': validate(); return stack[g.$invocation_depth];
            case '$sync_depth_leave':
              validate(); assert(g.$invocation_depth > 0);
              stack.pop(); g.$invocation_depth--; g.$sync_msg_depth--; leaves++;
              if (g.$sync_msg_depth < 31) g.$spill_pins &= ~(1 << g.$sync_msg_depth);
              if (!g.$sync_msg_depth && g.$spill_active) g.$spill_desk_forced = 1;
              return;
            case '$gs32': m.set(args[0], args[1]); return;
            case '$gl32': return m.get(args[0]) || 0;
            case '$g2w': return args[0];
            case '$zero_memory':
              for (let i = 0; i < args[1]; i += 4) m.set(args[0] + i, 0); return;
            case '$build_eflags': return flags;
            case '$load_eflags': flags = args[0]; return;
            case '$seh_is_dispatch_node': return Number(dispatch.includes((args[0] - 9000) / 16));
            case '$host_io_fill_sync': fills++; assert.equal(args[0], g.$current_thread_id); return ioHook();
            case '$run':
              assert.deepEqual(Array.from(args), [1000000], 'unchanged bounded slice budget');
              runs++; seen.push(stack.at(-1)); return runHook(l);
            default: throw new Error(`unmodeled call ${a[0]}`);
          }
        }
        default: throw new Error(`unmodeled AST ${op}`);
      }
    }
    try { return seq(fn.slice(3)); } catch (e) { if (e instanceof Return) return e.value; throw e; }
  }
  function complete(result = 0) { g.$eip = 0; m.set(0, result); }
  function clobber() {
    for (const k of savedGlobals) g[k] = 777;
    for (let i = 0; i < 8; i++) m.set(i * 4, 800 + i);
    flags = 0x246;
  }
  runHook = l => complete(handlers[(l.$frame - 9000) / 16]);
  return {g, m, stack, seen, entryIPs, trace, snap, call, complete, clobber,
    hook: f => {runHook = f;}, io: f => {ioHook = f;}, fail: () => {failEnter = true;},
    runs: () => runs, flags: () => flags,
    fault(kind) {
      if (kind === 'sibling') {stack.pop(); stack.push(next++);}
      if (kind === 'child') {stack.push(next++); g.$invocation_depth++; g.$sync_msg_depth++;}
      if (kind === 'child-same-token') {stack.push(stack.at(-1)); g.$invocation_depth++;}
      if (kind === 'owner-high') stack[stack.length - 1] += 0x100000000n;
      if (kind === 'root') {g.$invocation_root += 1n; liveRoot = g.$invocation_root;}
      if (kind === 'root-high') {g.$invocation_root += 0x100000000n; liveRoot = g.$invocation_root;}
      if (kind === 'stale-root') liveRoot++;
      if (kind === 'thread') g.$current_thread_id++;
      if (kind === 'epoch') liveEpoch++;
      if (kind === 'depth') g.$sync_msg_depth++;
    }};
}
function restored(f, before, visits = true) {
  const expected = {...before.g};
  if (visits) expected.$fault_sync_epoch++;
  if (visits && expected.$spill_active && !expected.$sync_msg_depth) expected.$spill_desk_forced = 1;
  assert.deepEqual(f.g, expected, 'exact saved CPU controls/page state and fault guards');
  for (let i = 0; i < 8; i++) assert.equal(f.m.get(i * 4), before.m.find(([k]) => k === i * 4)[1]);
  assert.equal(f.flags(), before.flags, 'exact saved EFLAGS value (packing modeled)');
  assert.deepEqual(f.stack, before.stack);
}
function rejectCase(kind, when = 'return') {
  const f = fixture(); let after;
  f.hook(() => {
    f.clobber();
    if (when === 'timeout' && f.runs() < 64) return;
    if (when === 'return') f.complete();
    if (when.startsWith('io')) {f.g.$yield_reason = 12; return;}
    f.fault(kind); after = f.snap();
    if (kind === 'run-trap') throw new Trap('run abort');
  });
  if (when.startsWith('io')) f.io(() => {f.fault(kind); after = f.snap(); if (kind === 'run-trap') throw new Trap('IO abort'); return when === 'io-failed' ? 0 : 1;});
  assert.throws(() => f.call(), Trap, `${kind}/${when} must reject`);
  assert(after, 'reached intended boundary');
  assert.equal(f.runs(), when === 'timeout' ? 64 : 1, 'never re-enter a rejected owner');
  assert.deepEqual(f.snap(), after, `${kind}/${when}: no retirement/restoration or IO retry mutation`);
}
function suite() {
  let cases = 0;
  for (const skip of ['recursive', 'null']) {
    const f = fixture(); if (skip === 'recursive') f.g.$fault_sync_active = 1; else f.g.$sync_msg_ret_thunk = 0;
    const b = f.snap(); assert.equal(f.call(), 0); assert.deepEqual(f.snap(), b); cases++;
  }
  for (const entry of ['capacity', 'sequence', 'stale-root', 'thread', 'epoch']) {
    const f = fixture({depth: entry === 'capacity' ? 63 : 0});
    if (entry === 'sequence') f.fail(); else if (entry !== 'capacity') f.fault(entry);
    const b = f.snap(); assert.throws(() => f.call(), Trap); assert.deepEqual(f.snap(), b,
      'acquisition failure precedes ALL wrapper writes, flag changes and restoration'); cases++;
  }
  for (const handlers of [[0], [1], [2], [], [1, 1, 0], [1, 1, 1]]) {
    const f = fixture({handlers}), b = f.snap();
    assert.equal(f.call(), Number(handlers.includes(0))); restored(f, b);
    assert.equal(f.runs(), handlers.includes(0) ? handlers.indexOf(0) + 1 : handlers.length);
    assert.equal(f.snap().leaves, 1); cases++;
  }
  {
    const f = fixture({handlers:[0, 0], dispatch:[0]}), b = f.snap();
    assert.equal(f.call(), 1); restored(f,b); assert.equal(f.runs(),1); cases++;
  }
  {
    const f = fixture({handlers: Array(66).fill(1)}), b = f.snap();
    assert.equal(f.call(), 0); restored(f,b); assert.equal(f.runs(),64); cases++;
  }
  {
    const f = fixture(), b = f.snap();
    f.hook(l => {
      const sp = f.m.get(16), rec = f.m.get(sp+4), ctx = f.m.get(sp+12);
      assert.deepEqual([f.m.get(sp),f.m.get(sp+8),f.m.get(sp+16)], [0x1234,9000,0]);
      assert.equal(f.m.get(rec),0xC0000005|0); assert.equal(f.m.get(rec+12),b.g.$eip);
      assert.equal(f.m.get(rec+16),2); assert.equal(f.m.get(rec+24),0x55001234);
      assert.equal(f.m.get(ctx),0x10007); assert.equal(f.m.get(ctx+0xc0),b.flags);
      assert.equal(f.m.get(ctx+0xc4),16384); assert.equal(f.g.$eip,10000);
      assert.equal(l.$ctx,ctx); f.complete();
    });
    assert.equal(f.call(),1); restored(f,b); cases++;
  }
  for (const depth of [0, 4, 62]) {
    const f = fixture({depth}), b = f.snap(); f.hook(() => {f.clobber(); f.complete();});
    assert.equal(f.call(), 1); restored(f, b); cases++;
  }
  for (const finish of ['slice', 'last', 'timeout']) {
    const f = fixture(), b = f.snap(); f.hook(() => {
      f.clobber();
      if ((finish === 'slice' && f.runs() === 3) || (finish === 'last' && f.runs() === 64)) f.complete();
    });
    assert.equal(f.call(), Number(finish !== 'timeout')); restored(f, b);
    assert.equal(f.runs(), finish === 'slice' ? 3 : 64); assert.equal(new Set(f.seen).size, 1); cases++;
  }
  // IO success does not consume ordinary rounds; failed/unavailable fills do.
  for (const mode of ['fills', 'failure', 'nonblocking', 'fill-cap']) {
    const f = fixture(), b = f.snap(); if (mode === 'nonblocking') f.g.$guest_can_block = 0;
    const before = f.snap();
    f.hook(() => {f.clobber(); f.g.$yield_reason = 12;
      if (mode === 'fills' && f.runs() === 4) f.complete();});
    if (mode === 'failure') f.io(() => 0);
    assert.equal(f.call(), Number(mode === 'fills')); restored(f, before);
    assert.equal(f.runs(), mode === 'fills' ? 4 : mode === 'fill-cap' ? 4160 : 64);
    assert.equal(f.snap().fills, mode === 'fills' ? 3 : mode === 'nonblocking' ? 0 : mode === 'fill-cap' ? 4096 : 64);
    assert.equal(new Set(f.seen).size,1); assert.equal(b.leaves, 0); cases++;
  }
  {
    const f = fixture({handlers: [1,0], spill: true}), b = f.snap();
    f.hook(l => {assert.equal(f.g.$spill_pins, 1); f.g.$ip = 150; f.complete((l.$frame - 9000) / 16 === 0 ? 1 : 0);});
    assert.equal(f.call(),1); restored(f,b); assert.deepEqual(f.entryIPs,[b.g.$ip], 'pin interrupted stream once'); cases++;
  }
  {
    const f = fixture(), b = f.snap();
    f.hook(() => {const child = f.snap(); assert.equal(f.call(),0); assert.deepEqual(f.snap(), child); f.complete();});
    assert.equal(f.call(),1); restored(f,b); cases++;
  }
  {
    const f = fixture(), b = f.snap();
    f.hook(() => {const parent = f.stack.at(-1); f.stack.push(99n); f.g.$invocation_depth++;
      f.g.$sync_msg_depth++; f.stack.pop(); f.g.$invocation_depth--; f.g.$sync_msg_depth--;
      assert.equal(f.stack.at(-1), parent); f.complete();});
    assert.equal(f.call(),1); restored(f,b); cases++;
  }
  for (const when of ['return', 'slice', 'timeout', 'io', 'io-failed'])
    for (const kind of ['sibling', 'child', 'child-same-token', 'owner-high', 'root', 'root-high',
      'stale-root', 'thread', 'epoch', 'depth', 'run-trap']) {rejectCase(kind,when); cases++;}
  return cases;
}
if (process.argv.includes('--supported-paths')) {
  let count = 0;
  for (const handlers of [[0], [1], [2], [], [1,1,0], [1,1,1]]) {
    const f = fixture({handlers}), b = f.snap();
    assert.equal(f.call(),Number(handlers.includes(0))); restored(f,b); count++;
  }
  for (const mode of ['slices','io','timeout']) {
    const f = fixture(), b = f.snap();
    f.hook(() => {f.clobber();
      if (mode === 'io') f.g.$yield_reason = 12;
      if (mode !== 'timeout' && f.runs() === 3) f.complete();});
    assert.equal(f.call(),Number(mode !== 'timeout')); restored(f,b);
    assert.equal(f.runs(),mode === 'timeout' ? 64 : 3); count++;
  }
  console.log(`Supported fault behavior PASS: ${count} paths (same source AST oracle)`);
  process.exit(0);
}
if (process.argv.includes('--retained-oracle')) {
  rejectCase('sibling');
  console.log('retained sibling ownership oracle PASS');
  process.exit(0);
}
const cases = suite();
const good = fn, clone = () => JSON.parse(JSON.stringify(good));
function remove(nodes, pred) {
  let count = 0;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]; if (!Array.isArray(n)) continue;
    if (pred(n)) {nodes.splice(i,1); count++;} else count += remove(n,pred);
  }
  return count;
}
let negatives = 0;
function killed(label) {assert.throws(suite, assert.AssertionError, label); negatives++;}
for (const field of ['$expected_child', '$expected_root', '$expected_depth', '$expected_inv_depth']) {
  fn = clone();
  assert(remove(fn, n => n[1] === 'if' && JSON.stringify(n[2]).includes(field)));
  killed('missing retained check '+field);
}
for (const late of [false, true]) {
  fn = clone(); const i = fn.findIndex(n => n[1] === 'call' && n[2] === '$sync_depth_enter'); assert(i > 0);
  const [entry] = fn.splice(i,1);
  if (late) fn.splice(fn.findIndex(n => n[1] === 'block'),0,entry);
  killed(late ? 'late acquisition' : 'missing acquisition');
}
// An early restoration before a run-result guard must be observable on rejection.
fn = clone();
const restore = fn.find(n => n[1] === 'global.set' && n[2] === '$eip' && n[3][1] === 'local.get');
assert(restore);
function insertAfterRun(nodes) {
  for (let i=0;i<nodes.length;i++) if (Array.isArray(nodes[i])) {
    if (nodes[i][1] === 'call' && nodes[i][2] === '$run') {nodes.splice(i+1,0,JSON.parse(JSON.stringify(restore))); return true;}
    if (insertAfterRun(nodes[i])) return true;
  }
  return false;
}
assert(insertAfterRun(fn)); killed('restoration before validation');
// Removing only the immediate run or IO guard must fail even if the final
// retirement guard would eventually trap: no foreign-owner re-entry is allowed.
for (const boundary of ['run', 'io']) for (const field of
    ['$expected_child', '$expected_root', '$expected_depth', '$expected_inv_depth']) {
  fn = clone();
  function find(n, pred) {
    if (!Array.isArray(n)) return;
    if (pred(n)) return n;
    for (const child of n) {const r = find(child,pred); if (r) return r;}
  }
  const container = boundary === 'run'
    ? find(fn, n => n[1] === 'loop' && n[2] === '$run_more')
    : find(fn, n => n[1] === 'then' && n.some(x => Array.isArray(x) &&
        x[1] === 'local.set' && x[2] === '$io_ready'));
  assert(container);
  const i = container.findIndex(n => Array.isArray(n) && n[1] === 'if' && JSON.stringify(n[2]).includes(field));
  assert(i > 0); container.splice(i,1); killed('missing immediate '+boundary+' guard '+field);
}
// A truncated token comparison must reject the high-bit-only identity cases.
for (const field of ['$expected_child', '$expected_root']) {
  fn = clone();
  function truncate(n) {
    if (!Array.isArray(n)) return;
    if (n[1] === 'i64.ne' && JSON.stringify(n).includes(field)) {
      n[1] = 'i32.ne'; n[2] = [0, 'i32.wrap_i64', n[2]]; n[3] = [0, 'i32.wrap_i64', n[3]];
      return;
    }
    n.forEach(truncate);
  }
  truncate(fn); killed('truncated identity '+field);
}
// Deleting each saved CPU/page/flags restore must fail a successful clobber case.
for (const index of good.map((n,i) => Array.isArray(n) &&
    (['global.set','i32.store'].includes(n[1]) || (n[1] === 'call' && n[2] === '$load_eflags')) &&
    /\$(old_|pg_)/.test(JSON.stringify(n)) ? i : -1).filter(i => i >= 0)) {
  fn = clone(); fn.splice(index,1); killed('missing saved state restoration');
}
fn = good;
console.log(`SEH fault source ownership PASS: ${cases} behavioral cases; ${negatives} rejecting mutations; modeled boundaries, no fullVM/gameplay qualification`);
