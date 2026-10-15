'use strict';
// No canonical build or x86 interpreter: the production JS lifecycle driver
// runs against an explicit native-ABI simulation, locally and in a real Worker.
const assert = require('node:assert/strict');
const { Worker, isMainThread, parentPort } = require('node:worker_threads');
const boot = require('../lib/process-boot');

function fixture(mode = 'true', unload = 0) {
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 2, shared: true });
  const dv = new DataView(memory.buffer), words = new Int32Array(memory.buffer);
  // Fixture-owned metadata, not production region placements.
  const table = 128, life = 256, gate = 512, name = 600, staging = 1024;
  let owner = 1, count = 0, eip = 4096, esp = 60000, eax = 99, y = 5, halt = 3;
  let runs = 0, takes = 0, maps = 0, completion = [], errorCode = 0, sleepPending = false, elapsed = 0;
  const get = (index, field) => dv.getUint32(life + index * 64 + field, true);
  const put = (index, field, value) => dv.setUint32(life + index * 64 + field, value, true);
  new Uint8Array(memory.buffer, name, 9).set(Buffer.from('test.dll\0'));
  const ex = {
    memory, get_image_base: () => 4096, guest_to_wasm: a => a,
    get_dll_callback_lock: () => gate, get_dll_callback_owner: () => owner,
    get_current_thread_id: () => owner,
    get_dll_lifecycle_table: () => life, get_dll_lifecycle_stride: () => 64,
    get_dll_count: () => count, get_dll_table: () => table,
    get_dll_index: addr => addr === 8192 && count ? 0 : -1,
    get_loadlib_name: () => name,
    get_eip: () => eip, set_eip: v => { eip = v; },
    get_esp: () => esp, set_esp: v => { esp = v; },
    get_eax: () => eax, set_eax: v => { eax = v; }, get_fs_base: () => 0,
    get_yield_reason: () => y, clear_yield: () => { y = 0; },
    set_yield_state: v => { y = v; }, get_last_run_halt: () => halt,
    get_sleep_yielded() { const value = sleepPending; sleepPending = false; return value; },
    get_sleep_timeout: () => 37,
    set_last_error: v => { errorCode = v; },
    get_staging: () => staging, get_staging_size: () => 1024,
    get_next_dll_addr: () => 8192, get_last_loaded_dll_index: () => 0,
    load_dll() {
      maps++; count = 1; dv.setUint32(table, 8192, true);
      put(0, 0, 1); put(0, 4, 17); put(0, 8, 1); put(0, 12, 1); put(0, 24, 8200);
      return 8200;
    },
    complete_dll_initialize(index, generation, status) {
      assert.equal(generation, 17); completion.push(status);
      put(index, 0, status === 1 || status === 3 ? 2 : 4);
      put(index, 48, status === 1 ? 1 : 0);
    },
    take_dll_unload_kind() { takes++; const value = unload; unload = 0; return value; },
    get_dll_unload_module: () => 8192, get_dll_unload_exit_code: () => 73,
    next_dll_unload_token_locked: () => 29,
    finish_dll_unload_locked(index, generation, token) {
      assert.equal(generation, 17); assert.equal(token, 29); put(index, 0, 0); return 1;
    },
    exit_thread_after_dll_unload(code) { assert.equal(code, 73); y = 2; eip = 0; },
    run() {
      runs++;
      if (runs === 1) {
        if (mode === 'sleep') { halt = 3; sleepPending = true; }
        else { halt = 4; y = 1; }
        return;
      }
      eip = 0; esp += 16; eax = mode === 'false' ? 0 : 1; halt = 2;
      if (mode === 'trap') throw new Error('sentinel trap');
      if (mode === 'exit') y = 2;
    },
  };
  return { ex, get, put, words, gate,
    stats: () => ({ runs, takes, maps, completion, errorCode, elapsed }),
    setOwner: v => { owner = v; },
    seed() { ex.load_dll(); put(0, 0, 2); put(0, 12, 0); put(0, 48, 1); },
    start: () => boot.beginScopedLibraryYield({ exports: ex, memoryBuffer: memory.buffer,
      advanceGuestTime: ms => { elapsed += ms; } }),
  };
}
function finish(f, tx) {
  for (let i = 0; i < 20; i++) {
    const step = tx.advance(20);
    if (step.done) return step;
    if (f.ex.get_yield_reason() === 1) f.ex.clear_yield();
  }
  throw new Error('Scoped fixture failed to finish');
}
function checks() {
  {
    const f = fixture(); f.words[f.gate / 4] = 2;
    assert.equal(f.start(), null); assert.equal(f.stats().takes, 0);
    assert.equal(f.ex.get_yield_reason(), 5);
  }
  {
    const f = fixture(); f.seed(); const tx = f.start();
    assert.equal(f.get(0, 12), 1, 'lookup owns provider generation');
    f.setOwner(2); assert.throws(() => tx.cancel(), /owner changed/);
    assert.equal(f.words[f.gate / 4], 1, 'replacement cannot release old gate');
    f.setOwner(1); tx.cancel(); tx.cancel();
    assert.equal(f.get(0, 12), 0); assert.equal(f.words[f.gate / 4], 0);
  }
  for (const mode of ['true', 'false', 'trap', 'exit']) {
    const f = fixture(mode), tx = f.start();
    assert.equal(tx.request.fileName, 'test.dll');
    assert.equal(tx.prepare({ bytes: new Uint8Array(512) }), true);
    assert.equal(tx.prepare({ bytes: new Uint8Array(512) }), false);
    if (mode === 'trap') {
      assert.throws(() => finish(f, tx), /initializer did not return/);
      tx.cancel();
      assert.equal(f.get(0, 12), 1, 'fault leaves mapping quarantine');
    } else {
      const done = finish(f, tx);
      assert.equal(done.mapped[0].result.generation, 17);
      if (mode === 'true') {
        assert.equal(f.get(0, 0), 2); assert.equal(f.get(0, 12), 0);
        assert.equal(done.result.loadAddr, 8192);
        assert.deepEqual(finish(f, tx), finish(f, tx), 'completion receipt is value-stable');
      } else if (mode === 'false') {
        assert.equal(f.get(0, 0), 0); assert.equal(f.stats().errorCode, 1114);
      } else {
        assert.equal(f.ex.get_yield_reason(), 2); assert.equal(f.get(0, 12), 1);
      }
    }
    assert.equal(f.stats().maps, 1); assert.equal(f.stats().takes, 1);
    assert.equal(f.words[f.gate / 4], 0);
  }
  {
    const f = fixture('sleep'), outer = f.start();
    outer.prepare({ bytes: new Uint8Array(512) }); outer.advance(); outer.advance();
    assert.equal(f.stats().elapsed, 37);
    // Same-owner nesting takes a second gate depth while the first callback
    // remains live. Retiring the child cannot release the parent's gate.
    f.ex.set_yield_state(5);
    const inner = f.start(); assert.equal(f.words[f.gate / 4 + 1], 2);
    inner.cancel(); assert.equal(f.words[f.gate / 4 + 1], 1);
    f.ex.clear_yield(); finish(f, outer);
    assert.equal(f.stats().elapsed, 37); assert.equal(f.words[f.gate / 4], 0);
  }
  {
    const f = fixture('sleep'), tx = f.start();
    tx.prepare({ bytes: new Uint8Array(512) }); tx.advance(); tx.advance(); tx.cancel();
    assert.equal(f.stats().elapsed, 37); assert.equal(f.words[f.gate / 4], 0);
  }
  {
    const f = fixture(), tx = f.start(); tx.prepare({ bytes: new Uint8Array(512) });
    tx.advance(); tx.advance(); tx.cancel();
    assert.equal(f.get(0, 12), 1); assert.equal(f.get(0, 8), 0);
    assert.equal(f.words[f.gate / 4], 0); assert.throws(() => tx.advance(), /retired/);
  }
  for (const kind of [1, 2, 3]) {
    const f = fixture('true', kind); f.seed();
    if (kind === 3) f.put(0, 8, 0);
    const tx = f.start(); assert.equal(tx.request.unload, true);
    assert.equal(tx.prepare({ bytes: new Uint8Array(512) }), false);
    const done = finish(f, tx);
    assert.equal(done.retired[0].generation, 17);
    assert.equal(f.stats().takes, 1); assert.equal(f.get(0, 0), 0);
    assert.equal(f.ex.get_yield_reason(), kind === 2 ? 2 : 0);
    assert.equal(f.words[f.gate / 4], 0);
  }
  {
    const f = fixture(); f.seed();
    const host = { dllResources: {}, calls: 0, registerModule() { this.calls++; } };
    const record = { fileName: 'test.dll', bytes: new Uint8Array(512),
      result: { index: 0, generation: 17, loadAddr: 8192 } };
    boot.publishScopedDlls(host, f.ex, f.ex.memory.buffer, { mapped: [record] });
    assert.equal(host.calls, 1); assert.equal(host.dllResources[8192].generation, 17);
    f.put(0, 4, 18); host.dllResources[8192] = { generation: 18 };
    boot.publishScopedDlls(host, f.ex, f.ex.memory.buffer, { mapped: [record], retired: [record.result] });
    assert.equal(host.calls, 1, 'delayed publication cannot register a replacement generation');
    assert.equal(host.dllResources[8192].generation, 18, 'old retirement cannot erase replacement resources');
  }
}
if (isMainThread) {
  checks();
  const worker = new Worker(__filename);
  worker.on('error', error => { throw error; });
  worker.on('exit', code => { assert.equal(code, 0); console.log('Scoped lifecycle local + Worker ABI simulation PASS'); });
} else { checks(); parentPort.close(); }
