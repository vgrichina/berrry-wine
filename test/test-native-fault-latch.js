'use strict';
const assert = require('assert/strict');
const { createNativeFaultLatch } = require('../lib/native-fault-latch');

(async () => {
  const first = new WebAssembly.RuntimeError('unreachable');
  let inputCalls = 0, persisted;
  const latch = createNativeFaultLatch({ meta: () => { throw Error('capture failed'); },
    threads: () => [], read: () => { throw Error('read failed'); },
    releaseInput: () => { if (++inputCalls === 1) throw Error('cleanup failed'); return {}; },
    persist: (_, evidence) => { persisted = evidence; } });
  assert.equal(latch.capture(first, {}, {}, 'ordinary'), false);
  const identity = latch.status().identity;
  for (const key of ['pid', 'process', 'generation']) {
    assert.throws(() => latch.arm({ identity: { ...identity, [key]: 'stale' } }), /epoch/);
  }
  latch.arm({ identity });
  assert(latch.capture(first, {}, { tid: 2 }, 'cooperative-thread'));
  const saved = latch.status(), token = saved.fault.token, cmd = { identity, token };
  assert(saved.fault.secondary.some(x => x.phase === 'registers'));
  assert(saved.fault.secondary.some(x => x.phase === 'meta'));
  assert(latch.capture(Error('second native failure'), {}, {}, 'later'));
  assert.equal(latch.error(), first);
  assert.deepEqual(latch.status(), saved);
  const copy = latch.status(); copy.fault.error.message = 'changed';
  assert.equal(latch.status().fault.error.message, 'unreachable');
  for (const bad of [{ ...cmd, token: 'stale' }, { ...cmd, identity: { ...identity, pid: 0 } }]) {
    assert.throws(() => latch.inspect(bad), /epoch/);
    assert.throws(() => latch.terminate(bad), /epoch/);
  }
  assert.throws(() => latch.inspect({ ...cmd, spans: [{ address: 0x10000, length: 4 }] }), /read failed/);
  assert.throws(() => latch.terminate(cmd), /cleanup failed/);
  assert.equal(latch.status().terminated, false);
  assert.equal(latch.error(), first);
  latch.terminate(cmd);
  await latch.wait();
  assert.equal(persisted.fault.error.stack, first.stack);
  assert.equal(persisted.fault.owner.tid, 2);
  assert.equal(typeof persisted.fault.owner.instance, 'string');
  assert.deepEqual(persisted.fault.secondary.map(x => x.phase), ['registers', 'meta', 'stack', 'inspection', 'termination']);
  assert.deepEqual(latch.terminate(cmd), { terminated: true, duplicate: true });
  assert.equal(inputCalls, 2);
  // Production capture uses the faulting exports, with a real short readable
  // prefix. Diagnostics must not read a single byte past the first invalid one.
  for (const valid of [0, 8, 128]) {
    const calls = [], e = {};
    for (const n of ['eip','esp','eax','ebx','ecx','edx','esi','edi','ebp','current_thread_id','last_run_halt'])
      e['get_' + n] = () => n === 'esp' ? 0x7efffff8 : n === 'current_thread_id' ? 2 : 0;
    const l = createNativeFaultLatch({ meta: () => ({}), threads: () => [],
      read: (actual, address, length) => {
        assert.equal(actual, e); assert.equal(length, 1); calls.push(address);
        if (address >= 0x7efffff8 + valid) throw Error('unmapped boundary');
        return Buffer.from([address & 255]);
      }, releaseInput: () => ({}), persist: () => {} });
    l.arm({ identity: l.status().identity });
    l.capture(first, e, { schedulerSlot: 1, handle: 0xe1000, main: false }, 'cooperative-thread');
    const f = l.status().fault;
    assert.equal(f.owner.schedulerSlot, 1); assert.equal(f.owner.nativeThreadId, 2);
    assert.equal(f.owner.tid, 2); assert.equal(f.owner.handle, 0xe1000);
    assert.equal(typeof f.owner.instance, 'string');
    assert.equal(f.stack.requestedLength, 128); assert.equal(f.stack.capturedLength, valid);
    assert.equal(f.stack.hex.length, valid * 2); assert.equal(f.stack.complete, valid === 128);
    assert.equal(calls.length, Math.min(valid + 1, 128));
    assert.equal(f.secondary.length, valid === 128 ? 0 : 1);
    l.capture(Error('later'), {}, {}, 'later'); assert.deepEqual(l.status().fault, f);
    assert.equal(l.error(), first);
  }
  console.log('PASS native fault latch retains first error across capture, cleanup and inspection errors');
})().catch(e => { console.error(e); process.exitCode = 1; });
