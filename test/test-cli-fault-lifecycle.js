'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { releaseFaultInput } = require('../lib/cli-fault-input');
const { createNativeFaultLatch, persistNativeFault } = require('../lib/native-fault-latch');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wine-fault-input-'));
  try {
    // Both real CLI initial states: no --buttons and a populated button queue.
    for (const inputQueue of [null, [1, 2]]) {
      const buffer = { events: ['key'], head: 1, length: 1, overflow: true };
      const devices = new Map([[1, buffer]]);
      const renderer = { inputQueue: ['key'], _physicalKeys: { 65: true },
        _asyncKeys: { 65: true }, _asyncPressedKeys: { 65: true },
        _modifierOwners: { 16: new Set([160]) }, _mouseButtonsMask: 1,
        _activeInputEvent: { msg: 256 }, _diKeyboardClients: new Set([new WeakRef(devices)]),
        handleKeyUp() { throw Error('guest input dispatch forbidden'); } };
      const state = { renderer, inputQueue, inputEvent: { msg: 256 },
        scheduledInput: ['keydown'], crossThreadMsgs: ['key'] };
      const original = new WebAssembly.RuntimeError('unreachable');
      const latch = createNativeFaultLatch({ meta: () => ({ credits: 4 }), threads: () => [],
        read: () => Buffer.alloc(128), releaseInput: () => releaseFaultInput(state), persist: persistNativeFault });
      const identity = latch.status().identity;
      latch.arm({ identity });
      latch.capture(original, { get_esp: () => 0x10000 }, { tid: 1 }, 'ordinary');
      const token = latch.status().fault.token, cmd = { identity, token };
      let advanced = false;
      const pending = latch.wait().then(() => { advanced = true; });
      assert.throws(() => latch.terminate({ ...cmd, path: path.join(dir, 'absent', 'fault.json') }), /ENOENT/);
      await Promise.resolve();
      assert.equal(advanced, false);
      assert.equal(latch.error(), original);
      assert.equal(state.inputEvent, null);
      assert.deepEqual(renderer._physicalKeys, Object.create(null));
      assert.deepEqual(renderer._asyncPressedKeys, Object.create(null));
      assert.equal(renderer._modifierPhysicalMap, renderer._physicalKeys);
      assert.equal(renderer._mouseButtonsMask, 0);
      assert.equal(buffer.length, 0);
      assert.equal(buffer.events[0], undefined);
      assert.equal(buffer.overflow, false);
      assert.equal(state.inputQueue, inputQueue);
      const filename = path.join(dir, inputQueue ? 'buttons.json' : 'null.json');
      assert.equal(latch.terminate({ ...cmd, path: filename }).terminated, true);
      await pending;
      const evidence = JSON.parse(fs.readFileSync(filename));
      assert.equal(evidence.fault.error.message, 'unreachable');
      assert.equal(evidence.fault.meta.credits, 4);
      assert(evidence.fault.secondary.some(x => x.phase === 'termination'));
      assert.deepEqual(evidence.input, { keyboardDown: [], asyncDown: [], mouseButtons: 0, pendingInput: 0 });
      const sealed = fs.readFileSync(filename, 'utf8');
      assert.deepEqual(latch.terminate({ ...cmd, path: filename }), { terminated: true, duplicate: true });
      assert.equal(fs.readFileSync(filename, 'utf8'), sealed);
      assert.throws(() => latch.terminate({ ...cmd, identity: { ...identity, generation: 2 } }), /epoch/);
    }
    assert.deepEqual(releaseFaultInput({ renderer: null, inputQueue: null, inputEvent: null,
      scheduledInput: [], crossThreadMsgs: [] }),
    { keyboardDown: [], asyncDown: [], mouseButtons: 0, pendingInput: 0 });
    console.log('PASS production CLI fault cleanup: nullable queues, key release, persistence failure/retry, duplicate termination');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
