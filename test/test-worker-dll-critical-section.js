'use strict';
// The owning callback must retain its stdcall frame across a real asynchronous
// lock release. This exercises the shipped loader and Worker's wait resolver;
// interpreter exports make the exact park/retry interleaving deterministic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const loader = require(process.env.WA_DLL_LOADER || '../lib/dll-loader');
const context = { URL, performance, setTimeout, clearTimeout, importScripts() {},
  location: { href: 'https://example.invalid/guest-worker.js' }, postMessage() {},
  ThreadSendWaits: require('../lib/thread-send-waits') };
context.self = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(process.env.WA_GUEST_WORKER || require.resolve('../lib/guest-worker'), 'utf8'), context);
const wait = vm.runInContext('waitForDllCriticalSection', context);
function fixture() {
  const memory = { buffer: new SharedArrayBuffer(65536) }, d = new DataView(memory.buffer);
  const state = { eip: 0x100, esp: 0xf000, eax: 73, yield_reason: 0, last_run_halt: 0 };
  let runs = 0, clears = 0;
  const ex = { memory, get_image_base: () => 0, guest_to_wasm: n => n,
    get_fs_base: () => 0, get_cs_wait_addr: () => 0x800,
    get_cs_wait_owner: () => 1,
    clear_yield() { clears++; state.yield_reason = 0; },
    set_yield_state(y) { state.yield_reason = y; },
    run() {
      runs++;
      if (runs === 1) {
        assert.equal(d.getUint32(state.esp + 8, true), 2, 'real reason-2 stdcall frame');
        state.esp -= 8; d.setUint32(state.esp, 0x1234, true); d.setUint32(state.esp + 4, 0x800, true);
        state.eip = 0x2222; state.yield_reason = 9; state.last_run_halt = 4;
      } else {
        assert.equal(d.getUint32(state.esp, true), 0x1234, 'parked return address survives');
        assert.equal(d.getUint32(state.esp + 4, true), 0x800, 'parked lock argument survives');
        assert.equal(d.getUint32(0x80c, true), 0, 'creator released before retry');
        assert.equal(state.yield_reason, 0, 'retry clears only the resolved wait');
        state.esp = 0xf000; state.eip = 0; state.eax = 1; state.last_run_halt = 2;
      }
    } };
  for (const n of ['eip', 'esp', 'eax', 'yield_reason', 'last_run_halt']) {
    ex['get_' + n] = () => state[n]; ex['set_' + n] = value => { state[n] = value; };
  }
  d.setUint32(0x80c, 1, true);
  return { ex, d, state, runs: () => runs, clears: () => clears };
}
(async () => {
  const f = fixture(); let released = false, observed = false;
  context.fixture = { exports: f.ex };
  vm.runInContext('instance=fixture;memory=fixture.exports.memory', context);
  assert.equal(vm.runInContext('workerDllOptions().onBlockingYield', context), wait, 'owning Worker wires its resolver');
  const outcome = loader.notifyDllThreadAsync({ exports: f.ex, memoryBuffer: f.ex.memory.buffer,
    onBlockingYield: async ex => {
      observed = true;
      const pending = wait(ex);
      await new Promise(resolve => setTimeout(resolve, 8));
      assert.equal(f.runs(), 1, 'held lock neither spins nor reruns guest code');
      assert.equal(f.state.eip, 0x2222, 'live callback is not restored during await');
      assert.equal(f.clears(), 1, 'held owner keeps its yield after initial callback setup');
      released = true; Atomics.store(new Int32Array(f.ex.memory.buffer, 0x80c, 1), 0, 0);
      return pending;
    },
  }, 2, [{ loadAddr: 0x4000, dllMain: 0x5000 }]);
  await outcome;
  assert(observed && released); assert.equal(f.runs(), 2); assert.equal(f.clears(), 2);
  assert.equal(f.state.eip, 0x100, 'caller restored after completed callback');
  assert.equal(f.state.esp, 0xf000); assert.equal(f.state.eax, 73);
  for (const mutate of [s => { s.yield_reason = 1; }, s => { s.last_run_halt = 3; }]) {
    const other = fixture(); other.state.yield_reason = 9; other.state.last_run_halt = 4; mutate(other.state);
    assert.equal(await wait(other.ex), false, 'unsupported waits retain fail-closed behavior');
    assert.equal(other.clears(), 0);
  }
  const stale = fixture(); stale.state.yield_reason = 9; stale.state.last_run_halt = 4; stale.d.setUint32(stale.state.esp + 4, 0x900, true);
  assert.equal(await wait(stale.ex), false, 'unrelated yield-9 frame cannot use stale lock fields');
  assert.equal(stale.clears(), 0);
  const retired = fixture(); retired.state.yield_reason = 9; retired.state.last_run_halt = 4;
  retired.d.setUint32(retired.state.esp + 4, 0x800, true);
  const pending = wait(retired.ex);
  retired.state.eip = 0x9999;
  assert.equal(await pending, false, 'changed callback frame cannot clear its successor wait');
  assert.equal(retired.clears(), 0);
  const sync = fixture();
  assert.throws(() => loader.callDllMain(sync.ex, 0x4000, 0x5000, null, { reason: 2, requireCompletion: true }), /did not complete/);
  console.log('PASS async Worker DLL attach retains CS wait frame, awaits owner release, retries, and rejects unrelated waits');
})().catch(error => { console.error(error); process.exit(1); });
