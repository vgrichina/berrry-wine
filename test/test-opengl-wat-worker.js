#!/usr/bin/env node
'use strict';

// Real worker_threads coverage for the native WAT OpenGL encoder and the
// GuestRPC blocking broker. No WebGL provider is needed: the main thread
// validates and semantically consumes the production command records.

const assert = require('assert');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const RPC = require('../lib/guest-rpc');
const Stream = require('../lib/gl-command-stream');
const RegionMap = require('../lib/region-map.generated');

const STACK = RegionMap.BASE.GUEST_STACK + 0x3000;
const OUTPUT_GUEST = 0x405000;
const IMAGE_BASE = 0x400000;
const OUTPUT_WASM = OUTPUT_GUEST - IMAGE_BASE + RegionMap.BASE.GUEST_BASE;

function produce(memory, instance, built, pooled, complete) {
  const e = instance.exports;
  assert.strictEqual(e.gl_wat_encoder_set_enabled, undefined,
    'production worker exposes only the native encoder');
  assert.strictEqual(e.gl_wat_encoder_enabled, undefined,
    'production worker has no runtime JS fallback selector');
  e.init_thread(1, IMAGE_BASE, 0, 0, 0, 0, 0);
  e.heap_init(0x420000);
  if (pooled) assert.strictEqual(e.gl_wat_stream_pool_enable(1), 1);
  const initialStats = { ...built.stats };
  const view = new DataView(memory.buffer);
  const call = (opcode, args = [], aux = 0) => {
    new Uint8Array(memory.buffer, STACK, 96).fill(0);
    view.setUint32(STACK, 0xDEC0ADDE, true);
    args.forEach((arg, index) => {
      const at = STACK + 4 + index * 4;
      if (arg && arg.f32 !== undefined) view.setFloat32(at, arg.f32, true);
      else view.setUint32(at, (arg && arg.u32 !== undefined ? arg.u32 : arg) >>> 0, true);
    });
    return e.gl_wat_encoder_call(opcode, STACK, aux) | 0;
  };
  const f32 = value => ({ f32: value });

  // A WGL lifecycle initializes per-context render/polygon defaults.
  // Drawing before any context is bound cannot establish a packed ABI oracle.
  assert.strictEqual(call(48, [0x1234], 0x1234), 0xC001);
  assert.strictEqual(call(51, [0x1234, 0xC001]), 1);
  call(21, [0x0004]);
  call(25, [f32(0.25), f32(0.5), f32(0.75), f32(1)]);
  call(30, [f32(1), f32(2), f32(3)]);
  call(30, [f32(4), f32(5), f32(6)]);
  call(30, [f32(7), f32(8), f32(9)]);
  call(22);
  const outputWa = e.guest_to_wasm(OUTPUT_GUEST) >>> 0;
  view.setUint32(outputWa, 0, true);
  // RED_BITS reaches the drawable owner. MAX_TEXTURE_UNITS is authoritative
  // native state once a context is bound and would bypass this RPC barrier.
  const queryStart = Date.now();
  const queryResult = call(103, [0x0D52, OUTPUT_GUEST]);
  const queryElapsed = Date.now() - queryStart;
  const queryOutput = view.getUint32(outputWa, true);

  // The response releases ownership of the shared stream range. Reuse it for
  // a second ordered barrier submission and prove the worker can park again.
  call(10, [0x0BE2]);
  const finishStart = Date.now();
  const finishResult = call(11);
  const finishElapsed = Date.now() - finishStart;
  if (pooled) {
    // Two more barriers wrap the three-buffer writer back to its first slot.
    for (let i = 0; i < 2; i++) { call(10, [0x0B71 + i]); call(11); }
  }
  complete({ t: 'done', queryResult, queryOutput, queryElapsed,
    finishResult, finishElapsed, stats: Object.fromEntries(Object.entries(built.stats)
      .map(([name, count]) => [name, count - initialStats[name]])) });
}

function directControl(wasm, pooled) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const module_ = new WebAssembly.Module(wasm), imports = {}, packets = [];
  const built = { stats: { sync: 0, async: 0, local: 0 } };
  for (const item of WebAssembly.Module.imports(module_)) {
    if (item.kind === 'memory') (imports[item.module] ||= {})[item.name] = memory;
    else if (item.kind === 'function') (imports[item.module] ||= {})[item.name] = () => 0;
  }
  imports.host.gpu_gl_call = (op, at, bytes) => {
    assert.strictEqual(op, Stream.WAT_STREAM_FLUSH_OPCODE);
    built.stats.sync++; built.stats.local++;
    packets.push(Buffer.from(new Uint8Array(memory.buffer, at, bytes)));
    return Stream.replay(Stream.memoryBatch(memory, at, bytes), opcode => {
      if (opcode === 48) return 0xC001;
      if (opcode === 51) return 1;
      if (opcode === 103) {
        new DataView(memory.buffer).setUint32(OUTPUT_WASM, 4, true);
        return 0x2468;
      }
      return 0x1357;
    });
  };
  let result;
  produce(memory, new WebAssembly.Instance(module_, imports), built, pooled, value => { result = value; });
  assert(result);
  return { packets, result };
}

if (!isMainThread) {
  const sigs = require(workerData.sigsPath).sigs;
  const memory = workerData.memory;
  let instance;
  const built = RPC.createWorkerImports(memory, sigs,
    message => parentPort.postMessage(message), { slot: 0, getExports: () => instance?.exports });
  const module_ = new WebAssembly.Module(workerData.wasm);
  instance = new WebAssembly.Instance(module_, built.imports);
  produce(memory, instance, built, workerData.pooled, message => parentPort.postMessage(message));
} else {
  const { compileSrcWasm } = require('./compile-src');
  const sigs = require('../lib/host-import-sigs.generated.json').sigs;

  async function main() {
    const wasm = compileSrcWasm();
    for (const pooled of [false, true]) {
    const control = directControl(wasm, pooled);
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    const rpcView = RPC.views(memory, 0).i32;
    const batches = [];
    const bootstraps = [];
    let epoch;
    const broker = RPC.createMainBroker(memory, {
      // init_thread establishes process-owned audio identity even when this
      // focused GL harness has no audio device. Accept exactly that bootstrap.
      beep_process_begin(lo, hi) { assert(lo || hi); epoch = [lo, hi]; bootstraps.push('process'); return 1; },
      beep_thread_begin(tid, lo, hi, epochLo, epochHi) {
        assert.strictEqual(tid, 2); assert(lo || hi);
        assert.deepStrictEqual([epochLo, epochHi], epoch);
        bootstraps.push('thread'); return 1;
      },
      gpu_gl_batch(batch, owner) {
        assert.strictEqual(owner, 0);
        assert.deepStrictEqual(Object.keys(batch).sort(),
          pooled ? ['bytes', 'memoryOffset', 'pool', 'softwareFront'] : ['bytes', 'memoryOffset', 'softwareFront'],
          'native worker hands off shared stream and software presentation descriptors');
        if (pooled) {
          assert.strictEqual(batch.pool.version, 1);
          assert.strictEqual(batch.pool.capacity, Stream.DEFAULT_BYTES);
          assert.strictEqual(new Set(batch.pool.offsets).size, 3);
          assert(batch.pool.offsets.every(base => base > 0 && base + batch.pool.capacity <= memory.buffer.byteLength));
          assert.strictEqual(batch.memoryOffset, batch.pool.offsets[batches.length % 3]);
          if (batches.length) assert.deepStrictEqual(batch.pool, batches[0].pool);
          if (batches.length === 2) for (const earlier of batches) assert.deepStrictEqual(
            Buffer.from(new Uint8Array(memory.buffer, earlier.memoryOffset, earlier.bytes)), earlier.snapshot,
            'first two published ranges survive third-buffer encoding');
        }
        assert.strictEqual(batch.softwareFront, 0,
          'a GL stream without a software drawable has no software front surface');
        const snapshot = Buffer.from(new Uint8Array(
          memory.buffer, batch.memoryOffset, batch.bytes));
        const opcodes = [];
        let packed = null;
        const result = Stream.replay(Stream.memoryBatch(
          memory, batch.memoryOffset, batch.bytes), (opcode, mode, capture) => {
          opcodes.push(opcode);
          if (opcode === Stream.PACKED_DRAW_OPCODE) {
            packed = { mode, vertices: Array.from(new Float32Array(
              capture.buffer, capture.pointerOffset, capture.pointerLength / 4)) };
          }
          if (opcode === 103) {
            const stack = new DataView(capture.buffer, capture.stackOffset, capture.stackBytes);
            assert.strictEqual(stack.getUint32(4, true), 0x0D52);
            assert.strictEqual(stack.getUint32(8, true), OUTPUT_GUEST);
            // Publish the query output before serveGlBatch wakes Atomics.wait.
            new DataView(memory.buffer).setUint32(OUTPUT_WASM, 4, true);
          }
          if (opcode === 48) return 0xC001;
          if (opcode === 51) return 1;
          return opcode === 103 ? 0x2468 : 0x1357;
        });
        batches.push({ ...batch, snapshot, opcodes, packed });
        return result;
      },
    }, sigs, { onError: (_name, error) => { throw error; } });

    const worker = new Worker(__filename, { workerData: {
      wasm, memory, pooled,
      sigsPath: path.join(__dirname, '..', 'lib', 'host-import-sigs.generated.json'),
    } });
    const done = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WAT GL worker deadline')), 30000);
      worker.on('error', error => { clearTimeout(timer); reject(error); });
      worker.on('message', message => {
        if (message.t === 'glBatch') {
          assert.strictEqual(Object.prototype.hasOwnProperty.call(message, 'batch'), false,
            'native stream never structured-clones a command buffer');
          assert.strictEqual(Atomics.load(rpcView, RPC.SLOT.STATUS), RPC.STATUS_REQ,
            'worker is parked with its request published');
          // A real delay distinguishes Atomics.wait from an accidental
          // synchronous in-process callback.
          setTimeout(() => broker.serveGlBatch(message), 25);
        } else if (message.t === 'rpc') {
          const name = Object.keys(sigs).sort()[rpcView[RPC.SLOT.FN]];
          assert(['beep_process_begin', 'beep_thread_begin'].includes(name), `unexpected bootstrap RPC ${name}`);
          assert.strictEqual(batches.length, 0, 'bootstrap precedes GL work');
          broker.serveRpc(message.slot);
        } else if (message.t === 'done') {
          clearTimeout(timer); resolve(message);
        } else {
          clearTimeout(timer); reject(new Error(`unexpected worker message ${JSON.stringify(message)}`));
        }
      });
    });

    try {
      const result = await done;
      assert.deepStrictEqual(batches.map(batch => batch.snapshot), control.packets,
        'real Worker and direct main-thread native WAT emit identical complete packets');
      assert.deepStrictEqual([result.queryResult, result.queryOutput, result.finishResult],
        [control.result.queryResult, control.result.queryOutput, control.result.finishResult]);
      assert.strictEqual(result.queryResult, 0x2468);
      assert.strictEqual(result.queryOutput, 4,
        'query output is visible on the first worker instruction after wake');
      assert.strictEqual(result.finishResult, 0x1357);
      assert(result.queryElapsed >= 15 && result.finishElapsed >= 15,
        'both barriers remained blocked until delayed main-thread replay');
      assert.deepStrictEqual(batches.map(batch => batch.opcodes),
        pooled ? [[48], [51], [Stream.PACKED_DRAW_OPCODE, 103], [10, 11], [10, 11], [10, 11]]
          : [[48], [51], [Stream.PACKED_DRAW_OPCODE, 103], [10, 11]],
        'geometry, query, reuse, and finish preserve global order');
      const geometry = batches[2];
      assert.strictEqual(geometry.packed.mode, 0x0004);
      // Literal API-to-attribute oracle, independent of the encoder and host
      // frontend: xyz, rgba, unit0 st, normal, unit1 st, w, unit0 rq, unit1 rq.
      assert.deepStrictEqual(geometry.packed.vertices,
        [[1,2,3], [4,5,6], [7,8,9]].flatMap(position =>
          [...position, 0.25,0.5,0.75,1, 0,0, 0,0,1, 0,0, 1, 0,1, 0,1]));
      const reused = batches[pooled ? 5 : 3];
      assert.strictEqual(reused.memoryOffset, geometry.memoryOffset,
        'stream range is reused only after the first response wakes the worker');
      const reusedBytes = Math.min(geometry.bytes, reused.bytes);
      assert.notStrictEqual(Buffer.compare(geometry.snapshot.subarray(0, reusedBytes),
        Buffer.from(new Uint8Array(memory.buffer, geometry.memoryOffset, reusedBytes))), 0,
      'second submission overwrites the released range without changing its snapshot');
      assert.strictEqual(Atomics.load(rpcView, RPC.SLOT.STATUS), RPC.STATUS_IDLE);
      assert.deepStrictEqual(bootstraps, ['process', 'thread']);
      assert.strictEqual(result.stats.sync, pooled ? 6 : 4);
      assert.strictEqual(result.stats.local, pooled ? 6 : 4,
        'only native flush imports cross out of WAT after bootstrap');
      console.log(`PASS real Worker WAT GL ${pooled ? 'triple-pool' : 'single-buffer'} offset transport, Atomics barriers, ordering, and reuse`);
    } finally {
      await worker.terminate();
    }
    }
  }

  main().catch(error => { console.error(error); process.exit(1); });
}
