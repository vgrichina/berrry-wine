'use strict';

// Source-only TG77 witness. This checks the current failure, NOT acceptance
// of a fix. No PE execution, compilation, browser, assets or large memory.
const assert = require('node:assert/strict');
const loader = require('../lib/dll-loader');
const { ThreadManager } = require('../lib/thread-manager');

function witness() {
  const memory = { buffer: new SharedArrayBuffer(65536) };
  const state = { eip: 0x2000, esp: 0xf000, eax: 0x1234, yield: 0, flag: 0 };
  const caller = { ...state };
  const entries = [];
  const e = {
    memory, get_image_base: () => 0, guest_to_wasm: address => address,
    get_fs_base: () => 0, get_dll_callback_lock: () => 0x100,
    get_dll_callback_owner: () => 2,
    get_yield_reason: () => state.yield, get_yield_flag: () => state.flag,
    clear_yield() { state.yield = 0; state.flag = 0; },
    set_yield_state(reason, flag) { state.yield = reason; state.flag = flag; },
    get_last_run_halt: () => state.yield === 9 ? 4 : 2,
    run() {
      entries.push(state.eip);
      assert.equal(Atomics.load(new Int32Array(memory.buffer, 0x100, 2), 0), 2);
      if (state.eip === 0x3000) { // first DLL returns normally
        state.eip = 0; state.esp += 16; state.eax = 1;
      } else {
        assert.equal(state.eip, 0x4000);
        state.eip = 0x5000; // second DLL parks at EnterCriticalSection
        state.yield = 9; state.flag = 1;
      }
    },
  };
  for (const name of ['eip', 'esp', 'eax']) {
    e[`get_${name}`] = () => state[name];
    e[`set_${name}`] = value => { state[name] = value; };
  }
  const manager = Object.create(ThreadManager.prototype);
  Object.assign(manager, { memory, _callDllMain: loader.callDllMain,
    _loadedDlls: [{ loadAddr: 0x3000, dllMain: 0x3000 },
      { loadAddr: 0x4000, dllMain: 0x4000 }],
    _quietTM: true, _runningThreadHandle: 0 });
  const thread = { instance: { exports: e } };
  const errors = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.throws(() => manager._notifyThreadAttach(thread, 2), error => {
      errors.push(error);
      return /DllMain did not complete/.test(error.message);
    });
    assert.deepEqual(state, caller, 'current failure discards the parked callback state');
    assert.equal(thread._dllAttachNotified, undefined);
    assert.equal(manager._runningThreadHandle, 0);
    assert.deepEqual([...new Int32Array(memory.buffer, 0x100, 2)], [0, 0],
      'current failure releases the loader callback gate');
  }
  assert.deepEqual(entries, [0x3000, 0x4000, 0x3000, 0x4000],
    'retrying notification repeats already completed DLL callbacks');
  assert.equal(errors[0].outcome.eip, 0x5000);
  assert.equal(errors[0].outcome.esp, caller.esp - 16);
  assert.equal(errors[0].outcome.completed, false);
  return { calls: entries.length, callbackEip: errors[0].outcome.eip,
    restoredEip: state.eip, gateOwner: 0 };
}

if (require.main === module) console.log('KNOWN GAP reproduced (mock exports, not fix acceptance):', witness());
module.exports = { witness };
