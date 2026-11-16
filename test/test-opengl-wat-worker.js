#!/usr/bin/env node
'use strict';

// Real worker_threads coverage for the native WAT OpenGL encoder and the
// GuestRPC blocking broker. No WebGL provider is needed: the main thread
// validates and semantically consumes the production command records.

const assert = require('assert');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const RPC = require('../lib/guest-rpc');
const PrimitiveContract = require('./fixtures/gl-primitive-contracts');
const Stream = require('../lib/gl-command-stream');
const RegionMap = require('../lib/region-map.generated');

const STACK = RegionMap.BASE.GUEST_STACK + 0x3000;
const OUTPUT_GUEST = 0x405000;
const IMAGE_BASE = 0x400000;
const OUTPUT_WASM = OUTPUT_GUEST - IMAGE_BASE + RegionMap.BASE.GUEST_BASE;

function produce(memory, instance, built, pooled, complete, primitiveContract = false) {
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

  if (primitiveContract) {
    const cases=[];
    for(const flat of [false,true])for(let mode=0;mode<10;mode++)for(const polygonMode of [null,0x1b01,0x1b00]){
      e.gl_wat_encoder_reset();
      const firstPacket=built.stats.sync-initialStats.sync;
      assert.strictEqual(call(48,[0x1234],0x1234),0xc001);
      assert.strictEqual(call(51,[0x1234,0xc001]),1);
      call(19,[flat?0x1d00:0x1d01]);
      if(polygonMode!==null)call(16,[0x408,polygonMode]);
      const flags=Array.from({length:PrimitiveContract.COUNTS[mode]},(_,i)=>i%2);
      call(21,[mode]);
      for(let i=0;i<flags.length;i++){
        const v=PrimitiveContract.attributes(i,i,mode,true);
        call(25,v.slice(3,7).map(f32));
        call(120,[v[7],v[8],v[15],v[16]].map(f32));
        call(122,[0x84c1,...[v[12],v[13],v[17],v[18]].map(f32)]);
        call(63,v.slice(9,12).map(f32));call(181,[flags[i]]);call(118,[...v.slice(0,3),v[14]].map(f32));
      }
      call(22);call(11);
      cases.push({mode,flat,boundary:polygonMode!==null,polygonMode,flags,firstPacket,
        afterPacket:built.stats.sync-initialStats.sync});
      assert.strictEqual(call(49,[0xc001]),1,'destroy fixture context before mock handle reuse');
    }
    complete({t:'done',primitiveContract:true,cases,stats:Object.fromEntries(Object.entries(built.stats)
      .map(([name,count])=>[name,count-initialStats[name]]))});
    return;
  }

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
  // G1 owns RED_BITS locally. Verify immediate native output, then exercise
  // the real backend output barrier with a complete one-pixel readback.
  const nativeQueryResult = call(103, [0x0D52, OUTPUT_GUEST]);
  const nativeQueryOutput = view.getUint32(outputWa, true);
  view.setUint32(outputWa, 0, true);
  const readStart = Date.now();
  const readResult = call(17, [0,0,1,1,0x1908,0x1401,OUTPUT_GUEST]);
  const readElapsed = Date.now() - readStart;
  const readOutput = view.getUint32(outputWa, true);

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
  complete({ t: 'done', readResult, readOutput, readElapsed, nativeQueryResult, nativeQueryOutput,
    finishResult, finishElapsed, stats: Object.fromEntries(Object.entries(built.stats)
      .map(([name, count]) => [name, count - initialStats[name]])) });
}

function directControl(wasm, pooled, primitiveContract = false) {
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
    return Stream.replay(Stream.memoryBatch(memory, at, bytes), (opcode,_mode,capture) => {
      if (opcode === 48) return 0xC001;
      if (opcode === 51 || opcode === 49) return 1;
      if (opcode === 17) {
        const target=new DataView(capture.buffer).getUint32(capture.stackOffset+28,true);
        assert.notEqual(target,OUTPUT_GUEST,'G2 backend writes native staging, not caller storage');
        new DataView(memory.buffer).setUint32(target-IMAGE_BASE+RegionMap.BASE.GUEST_BASE,0x04030201,true);
        return 0x2468;
      }
      return 0x1357;
    });
  };
  let result;
  produce(memory, new WebAssembly.Instance(module_, imports), built, pooled, value => { result = value; }, primitiveContract);
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
  produce(memory, instance, built, workerData.pooled, message => parentPort.postMessage(message), workerData.primitiveContract);
} else {
  const { compileSrcWasm } = require('./compile-src');
  const sigs = require('../lib/host-import-sigs.generated.json').sigs;

  async function main() {
    const wasm = compileSrcWasm(),workerWaits=[];
    for (const primitiveContract of [false, true]) for (const pooled of [false, true]) {
    const control = directControl(wasm, pooled, primitiveContract);
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
          if (opcode === 17) {
            const stack = new DataView(capture.buffer, capture.stackOffset, capture.stackBytes);
            assert.deepStrictEqual(Array.from({length:6},(_,i)=>stack.getUint32(4+i*4,true)),
              [0,0,1,1,0x1908,0x1401]);
            // Publish the actual readback output before serveGlBatch wakes Atomics.wait.
            const target=stack.getUint32(28,true);
            assert.notEqual(target,OUTPUT_GUEST,'G2 backend writes native staging, not caller storage');
            new DataView(memory.buffer).setUint32(target-IMAGE_BASE+RegionMap.BASE.GUEST_BASE,0x04030201,true);
          }
          if (opcode === 48) return 0xC001;
          if (opcode === 51 || opcode === 49) return 1;
          return opcode === 17 ? 0x2468 : 0x1357;
        });
        batches.push({ ...batch, snapshot, opcodes, packed });
        return result;
      },
    }, sigs, { onError: (_name, error) => { throw error; } });

    const worker = new Worker(__filename, { stdout:true, stderr:true, workerData: {
      wasm, memory, pooled, primitiveContract,
      sigsPath: path.join(__dirname, '..', 'lib', 'host-import-sigs.generated.json'),
    } });
    const observedThreadId=worker.threadId;
    let workerStdout='',workerStderr='';
    worker.stdout.on('data',v=>workerStdout+=v);worker.stderr.on('data',v=>workerStderr+=v);
    const workerExit=new Promise(resolve=>worker.once('exit',resolve));
    const workerEOF=Promise.all([new Promise(resolve=>worker.stdout.once('end',resolve)),new Promise(resolve=>worker.stderr.once('end',resolve))]);
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
      if (primitiveContract) {
        assert.deepStrictEqual(result.cases, control.result.cases);
        assert.strictEqual(result.cases.length, 60);
        for (const c of result.cases) {
          assert.strictEqual(c.afterPacket - c.firstPacket, c.boundary ? 4 : 3,
            'exact create/bind/polygon-state publication/complete draw+finish');
          const packets = batches.slice(c.firstPacket, c.afterPacket).map(b => b.snapshot);
          const drawOps=c.boundary&&c.mode>=4
            ? PrimitiveContract.TOPOLOGY[c.mode].map(()=>65545) : [65536];
          assert.deepStrictEqual(PrimitiveContract.decode(packets).map(rs=>rs.map(r=>r.opcode)),
            [[48],[51],...(c.boundary?[[16]]:[]),[...drawOps,11]],
            'every complete lifecycle, polygon state and draw/finish packet retained');
          PrimitiveContract.assertGeometry(packets, c.mode, c.flat, c.boundary, c.flags, true);
          PrimitiveContract.assertGeometry(control.packets.slice(c.firstPacket,c.afterPacket), c.mode, c.flat, c.boundary, c.flags, true);
        }
        assert.strictEqual(batches.length, 280, 'all create/bind/polygon-state/finish/delete packets retained');
        for (const c of result.cases) {
          const cleanup=PrimitiveContract.decode([batches[c.afterPacket].snapshot]).flat();
          assert.deepStrictEqual(cleanup.map(r=>r.opcode),[49],'separate complete lifecycle cleanup packet');
        }
        assert.strictEqual(Atomics.load(rpcView, RPC.SLOT.STATUS), RPC.STATUS_IDLE);
        assert.deepStrictEqual(bootstraps, ['process','thread']);
        assert.strictEqual(result.stats.sync, 280);
        assert.strictEqual(result.stats.local, 280);
        console.log(`PASS real delayed Worker/main full primitive literal and byte parity ${pooled ? 'triple-pool' : 'single-buffer'}`);
        continue;
      }
      assert.deepStrictEqual([result.readResult, result.readOutput, result.finishResult],
        [control.result.readResult, control.result.readOutput, control.result.finishResult]);
      assert.strictEqual(result.nativeQueryResult,0,'G1 query completes natively');
      assert.strictEqual(result.nativeQueryOutput,8,'literal native RED_BITS output before readback');
      assert.strictEqual(result.readResult, 0x2468);
      assert.strictEqual(result.readOutput, 0x04030201,
        'all four readback bytes are visible on the first worker instruction after wake');
      assert.strictEqual(result.finishResult, 0x1357);
      assert(result.readElapsed >= 15 && result.finishElapsed >= 15,
        'both barriers remained blocked until delayed main-thread replay');
      assert.deepStrictEqual(batches.map(batch => batch.opcodes),
        pooled ? [[48], [51], [Stream.PACKED_DRAW_OPCODE], [17], [10, 11], [10, 11], [10, 11]]
          : [[48], [51], [Stream.PACKED_DRAW_OPCODE], [17], [10, 11]],
        'geometry, readback, reuse, and finish preserve global order');
      const geometry = batches[2];
      assert.strictEqual(geometry.packed.mode, 0x0004);
      // Literal API-to-attribute oracle, independent of the encoder and host
      // frontend: xyz, rgba, unit0 st, normal, unit1 st, w, unit0 rq, unit1 rq.
      assert.deepStrictEqual(geometry.packed.vertices,
        [[1,2,3], [4,5,6], [7,8,9]].flatMap(position =>
          [...position, 0.25,0.5,0.75,1, 0,0, 0,0,1, 0,0, 1, 0,1, 0,1]));
      const reused = batches[pooled ? 5 : 4];
      assert.strictEqual(reused.memoryOffset, geometry.memoryOffset,
        'stream range is reused only after the first response wakes the worker');
      const reusedBytes = Math.min(geometry.bytes, reused.bytes);
      assert.notStrictEqual(Buffer.compare(geometry.snapshot.subarray(0, reusedBytes),
        Buffer.from(new Uint8Array(memory.buffer, geometry.memoryOffset, reusedBytes))), 0,
      'second submission overwrites the released range without changing its snapshot');
      assert.strictEqual(Atomics.load(rpcView, RPC.SLOT.STATUS), RPC.STATUS_IDLE);
      assert.deepStrictEqual(bootstraps, ['process', 'thread']);
      assert.strictEqual(result.stats.sync, pooled ? 7 : 5);
      assert.strictEqual(result.stats.local, pooled ? 7 : 5,
        'only native flush imports cross out of WAT after bootstrap');
      console.log(`PASS real Worker WAT GL ${pooled ? 'triple-pool' : 'single-buffer'} offset transport, Atomics barriers, ordering, and reuse`);
    } finally {
      await worker.terminate();const code=await workerExit;await workerEOF;
      assert(worker.stdout.readableEnded&&worker.stderr.readableEnded,'actual Worker output streams reached EOF');
      process.stdout.write(workerStdout);process.stderr.write(workerStderr);
      const receipt={kind:'worker-thread',threadId:observedThreadId,exit:code,actualWait:true,stdoutEOF:worker.stdout.readableEnded,stderrEOF:worker.stderr.readableEnded,fixtureHostStop:true,pooled,primitiveContract};
      workerWaits.push(receipt);console.log('GL_PRIMITIVE_WORKER_WAIT '+JSON.stringify(receipt));
      if(process.env.GL_PRIMITIVE_WORKER_WAIT_EVIDENCE)require('node:fs').writeFileSync(process.env.GL_PRIMITIVE_WORKER_WAIT_EVIDENCE,JSON.stringify({waits:workerWaits}));
    }
    }
  }

  main().catch(error => { console.error(error); process.exit(1); });
}
