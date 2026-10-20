#!/usr/bin/env node
'use strict';
// Real Node fork + unmodified CLI event import closures + real ThreadManager.
// No guest PE/build: only memory layout/getter and guest string inputs are fixtures.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const root = path.resolve(__dirname, '../..');
const { ThreadManager } = require(path.join(root, 'lib/thread-manager'));
const { readSyncObjectName } = require(path.join(root, 'lib/mem-utils'));
const source = fs.readFileSync(path.join(root, 'test/run.js'), 'utf8');
const start = source.indexOf('  const win32ThreadId = () => threadManager.currentWin32ThreadId();');
const end = source.indexOf('  // Check if a DLL file exists', start);
assert(start >= 0 && end > start, 'complete production import block found');
function provider() {
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 2, shared: true });
  const manager = new ThreadManager({}, memory, { exports: { get_sync_table: () => 0 } }, () => ({}));
  const h = {}, ctx = { exports: { get_sync_msg_depth: () => 0 } };
  new Function('h', 'threadManager', 'memory', 'readSyncObjectName', 'ctx',
    source.slice(start, end))(h, manager, memory, readSyncObjectName, ctx);
  function name(s) {
    const p = 65536;
    new Uint8Array(memory.buffer).set(Buffer.from(s + '\0'), p);
    return p;
  }
  return { h, manager, memory, name, ctx };
}
function local() {
  const p = provider(), h = p.h;
  for (const manual of [0, 1]) {
    const name = p.name('local-' + manual);
    const a = h.create_event(manual, 0, name, 0);
    const b = h.open_event(name, 0);
    assert(a && b);
    const existing = h.create_event(!manual, 1, name, 0) >>> 0;
    assert.strictEqual(existing, (a | 0x80000000) >>> 0);
    assert.strictEqual(h.wait_single(a, 0), 258, 'existing create preserves initial state');
    assert.strictEqual(h.close_event(a), 1);
    assert.strictEqual(h.set_event(b), 1);
    assert.strictEqual(h.wait_single(b, 0), 0);
    assert.strictEqual(h.wait_single(b, 0), manual ? 0 : 258, 'original reset mode preserved');
    assert.strictEqual(h.reset_event(b), 1);
    assert.strictEqual(h.wait_single(b, 0), 258);
    assert.strictEqual(h.close_event(b), 1);
    assert.strictEqual(h.open_event(name, 0), a, 'third reference still owns object');
    assert.strictEqual(h.close_event(a), 1);
    assert.strictEqual(h.close_event(a), 1);
    assert.strictEqual(h.open_event(name, 0), 0, 'last reference removes name');
    assert.strictEqual(h.set_event(a), 0, 'stale event signal rejected');
    const replacement = h.create_event(manual, 0, name, 0);
    assert.notStrictEqual(replacement, a);
    assert.strictEqual(h.close_event(replacement), 1);
  }
  const a = h.create_event(1, 0, p.name('isolation-A'), 0);
  const b = h.create_event(1, 0, p.name('isolation-B'), 0);
  h.set_event(a);
  assert.strictEqual(h.wait_single(b, 0), 258);
  h.close_event(a); h.close_event(b);
  console.log('PASS local production import lifecycle, reset modes, references, generations, isolation');
}
async function boundary(observe) {
  const p = provider();
  const a = p.h.create_event(0, 0, p.name('parent-event'), 0);
  assert(a);
  const child = fork(__filename, ['--child'], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(Error('child timeout')); }, 5000);
    let reply;
    child.on('message', msg => { reply = msg; });
    child.on('error', reject);
    child.on('exit', code => {
      clearTimeout(timer);
      if (code !== 0 || !reply) reject(Error('child exited without result: ' + code));
      else resolve(reply);
    });
    child.send({ name: 'parent-event' });
  });
  result.parentWait = p.h.wait_single(a, 0);
  result.parentClose = p.h.close_event(a);
  console.log(JSON.stringify(result));
  if (observe) {
    assert.deepStrictEqual(result, { opened: 0, set: 0, localCreated: a,
      localSet: 1, localWait: 0, localClose: 1, parentWait: 258, parentClose: 1 });
  } else {
    assert.notStrictEqual(result.opened, 0, 'CLI child must open parent named event');
    assert.strictEqual(result.set, 1);
    assert.strictEqual(result.parentWait, 0, 'child signal must satisfy parent wait');
  }
}
function snapshotControl() {
  // A plausible but incorrect signal-mirroring transport. Both real providers
  // consume the same one logical auto-reset signal: acceptance must reject it.
  const p = provider(), q = provider();
  const a = p.h.create_event(0, 1, p.name('one-token'), 0);
  const b = q.h.create_event(0, 1, q.name('one-token'), 0);
  const results = [p.h.wait_single(a, 0), q.h.wait_single(b, 0)];
  console.log(JSON.stringify({ mirroredAutoResetResults: results }));
  assert.strictEqual(results.filter(x => x === 0).length, 1,
    'one auto-reset signal must satisfy exactly one process');
}
function nestedGap() {
  const p = provider();
  p.ctx.exports.get_sync_msg_depth = () => 1;
  const event = p.h.create_event(0, 0, p.name('nested'), 0);
  const result = p.h.wait_single(event, -1) >>> 0;
  console.log(JSON.stringify({ nestedInfiniteEventWait: result }));
  assert.strictEqual(result, 0xffffffff,
    'current nested cooperative event wait fails before an IPC callback could signal');
  assert.strictEqual(p.h.set_event(event), 1);
  assert.strictEqual(p.h.wait_single(event, -1), 0,
    'already-signaled event works in the same production nested path');
  p.h.close_event(event);
}
if (process.argv.includes('--child')) {
  process.once('message', msg => {
    const p = provider(), ptr = p.name(msg.name);
    const opened = p.h.open_event(ptr, 0);
    const set = p.h.set_event(opened);
    const localCreated = p.h.create_event(0, 0, ptr, 0);
    const localSet = p.h.set_event(localCreated);
    const localWait = p.h.wait_single(localCreated, 0);
    const localClose = p.h.close_event(localCreated);
    process.send({ opened, set, localCreated, localSet, localWait, localClose }, () => process.disconnect());
  });
} else {
  Promise.resolve().then(() => {
    if (process.argv.includes('--local')) return local();
    if (process.argv.includes('--nested-gap')) return nestedGap();
    if (process.argv.includes('--snapshot-control')) return snapshotControl();
    return boundary(process.argv.includes('--observe-gap'));
  }).catch(err => { console.error(err); process.exitCode = 1; });
}
