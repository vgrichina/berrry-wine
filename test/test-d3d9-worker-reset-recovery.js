#!/usr/bin/env node
'use strict';
// Production Bridge Reset, failure retirement and recreation with real native pixels.
// No guest instructions, browser, synthetic executor or private error clearing.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Worker } = require('worker_threads');
const root = path.resolve(__dirname, '..');
if (!process.argv[2]) {
  // Separate sequential processes bound full-module memory and ensure each
  // shipped module is exercised through both supported software topologies.
  const { spawnSync } = require('child_process');
  for (const name of ['wine-assembly.wasm', 'wine-assembly.compat.wasm']) {
    for (const mode of ['shared', 'legacy']) {
      const result = spawnSync(process.execPath, [__filename, path.join(root, 'build', name), mode],
        { encoding:'utf8', timeout:120000 });
      process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
      if (result.error) console.error(result.error);
      if (result.status !== 0) process.exit(result.status || 1);
    }
  }
  process.exit(0);
}
const { Bridge } = require(path.join(root, 'lib/d3d9-host'));
const Stream = require(path.join(root, 'lib/d3d-command-stream'));
const { Manager } = require(path.join(root, 'lib/render-worker'));
const { Device } = require(path.join(root, 'lib/d3d9-software-backend'));
const sigs = require(path.join(root, 'lib/host-import-sigs.generated.json')).sigs;
const OP = Stream.OPCODES;
const modulePath = process.argv[2] || path.join(root, 'build/wine-assembly.wasm');
const topology = process.argv[3] || 'shared';
assert(['shared', 'legacy'].includes(topology));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const tick = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  const bytes = fs.readFileSync(modulePath), module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({ initial:8192, maximum:8192, shared:true });
  const host = { memory };
  for (const [name, sig] of Object.entries(sigs)) host[name] = sig.results?.length ? () => 0 : () => {};
  const e = (await WebAssembly.instantiate(module, { host })).exports;
  e.d3dim_worker_init(0x400000);
  e.set_eip(0x456789); e.set_esp(0x302004);
  const allocations = [];
  const alloc = n => { const g = e.guest_alloc(n) >>> 0; assert(g); allocations.push(g); return g; };
  const wa = p => e.guest_to_wasm(p) >>> 0;
  const view = new DataView(memory.buffer);
  const put = (p, n) => view.setUint32(p, n, true);
  const sentinel = alloc(4096);
  new Uint8Array(memory.buffer, wa(sentinel), 4096).fill(0xa7);
  const parentTarget = alloc(256);
  new Uint8Array(memory.buffer, wa(parentTarget), 256).fill(0x39);
  const parentDevice = new Device({ getExports:() => e, getMemory:() => memory.buffer, width:8, height:8 });
  parentDevice.clear([.2,.4,.6,1], 3);
  const parentPixels = parentDevice.readPixels().slice();
  const invariant = () => {
    assert.strictEqual(e.get_eip() >>> 0, 0x456789);
    assert.strictEqual(e.get_esp() >>> 0, 0x302004);
    assert(new Uint8Array(memory.buffer, wa(sentinel), 4096).every(x => x === 0xa7));
    assert(new Uint8Array(memory.buffer, wa(parentTarget), 256).every(x => x === 0x39));
    assert.deepStrictEqual(parentDevice.readPixels(), parentPixels, 'worker lifecycle preserves parent native target');
  };
  function shader(tokens) {
    const source = alloc(tokens.length * 4);
    new Uint32Array(memory.buffer, wa(source), tokens.length).set(tokens);
    const ir = e.d3d_shader_ir_compile(wa(source), tokens.length) >>> 0;
    assert(ir, 'native shader validator accepts fixture');
    const length = view.getUint32(ir + 24, true);
    const resource = alloc(24 + tokens.length * 4 + length), at = wa(resource);
    new Uint8Array(memory.buffer, at, 24 + tokens.length * 4 + length).fill(0);
    put(at + 16, tokens.length * 4);
    new Uint32Array(memory.buffer, at + 24, tokens.length).set(tokens);
    new Uint8Array(memory.buffer, at + 24 + tokens.length * 4, length)
      .set(new Uint8Array(memory.buffer, ir, length));
    e.d3d_shader_ir_free(ir);
    return resource;
  }
  const vs = shader([0xfffe0101, 1, 0xc00f0000, 0x90e40000, 1, 0xd00f0000, 0x90e40005, 0xffff]);
  const ps = shader([0xffff0101, 1, 0x800f0000, 0x90e40000, 0xffff]);
  const program = alloc(26000), state = alloc(2048), vertices = alloc(60), descriptor = alloc(64);
  new Uint8Array(memory.buffer, wa(program), 26000).fill(0);
  new Uint8Array(memory.buffer, wa(state), 2048).fill(0);
  put(wa(program), vs); put(wa(program) + 4, ps); put(wa(program) + 12, 0x4042);
  put(wa(program) + 21784, 0x80000000); put(wa(program) + 25600, 21);
  put(wa(state) + 256 + 22 * 4, 1); put(wa(state) + 256 + 168 * 4, 15);
  put(wa(state) + 256 + 8 * 4, 3); put(wa(state) + 256 + 16 * 4, 1);
  put(wa(state) + 256 + 23 * 4, 4);
  const workers = [], consumers = [], managers = [], bridges = [], events = [];
  let maxLive = 0;
  function spawn() {
    assert(workers.every(w => w.threadId === -1), 'one physical worker at a time');
    const w = new Worker(path.join(root, 'lib/d3d-render-worker.js'));
    workers.push(w); maxLive = Math.max(maxLive, workers.filter(w => w.threadId !== -1).length);
    return w;
  }
  let manager;
  function makeBridge() {
    const options = { backend:'software', enableProgrammable:true, maxDeferredCommands:0, softwareQuadBudget:1,
      getExports:() => e, getMemory:() => memory.buffer, guestToWasm:wa };
    if (topology === 'shared') {
      options.createRenderWorker = async endpointOptions => {
        const port = manager.createEndpoint(endpointOptions);
        await port.ready;
        const consumer = new Stream.WorkerConsumer(port);
        consumers.push(consumer); return consumer;
      };
    } else options.createSoftwareWorker = () => {
      const w = spawn();
      const consumer = new Stream.WorkerConsumer(w, { module, memory, sigs, imageBase:0x400000,
        sourceVersion:'reset-recovery', reclaimHeap(head) {
          assert.strictEqual(w.threadId, -1, 'legacy adopts only after actual exit');
          return e.d3d_render_adopt_free_list(head);
        } });
      consumers.push(consumer); return consumer;
    };
    const bridge = new Bridge(options); bridges.push(bridge); return bridge;
  }
  async function settle(bridge, result) {
    if (result <= -2) { await bridge.wait(result); return bridge.call(0x30007, 0, result); }
    return result;
  }
  async function call(bridge, opcode, id, { width=8, height=8, color=0xff214365, fail=false, reverse=false } = {}) {
    const at = wa(descriptor);
    new Uint8Array(memory.buffer, at, 64).fill(0);
    [id, program, wa(parentTarget), width, height, 1].forEach((n, i) => put(at + i * 4, n));
    put(at + 40, state);
    if (opcode === 0x30003) { put(at + 44, 1); put(at + 48, color); }
    if (opcode === 0x30001) {
      put(at + 24, 4); put(at + 28, 1); put(at + 32, vertices); put(at + 36, 20);
      const points = fail ? [[0,0,5e-40,1e-39],[0,0,.5,1],[0,0,1,2]] :
        reverse ? [[1,-1,.5,1],[-1,-1,.5,1],[1,1,.5,1]] : [[-1,1,.5,1],[1,1,.5,1],[-1,-1,.5,1]];
      points.forEach((p, i) => {
        p.forEach((n, j) => view.setFloat32(wa(vertices) + i * 20 + j * 4, n, true));
        put(wa(vertices) + i * 20 + 16, color);
      });
    }
    if (opcode === 0x30009) { put(at + 12, 0); put(at + 32, width); put(at + 36, height); put(at + 40, 21); }
    const value = await settle(bridge, bridge.call(opcode, at, id));
    events.push({ opcode:opcode.toString(16), id, value, error:value === -1 ? String(bridge.lastError) : null });
    return value;
  }
  const queueEmpty = entry => {
    assert.strictEqual(entry.queue.inflight, 0); assert.strictEqual(entry.queue.bytes, 0);
  };
  async function witness(bridge, id, { width=8, height=8, reverse=false, color=0xffc17935 } = {}) {
    assert.strictEqual(await call(bridge, 0x30003, id, { width, height }), 1, String(bridge.lastError));
    assert.strictEqual(await call(bridge, 0x30001, id, { width, height, reverse, color }), 1, String(bridge.lastError));
    const entry = bridge.devices.get(id);
    const read = await bridge._submit(entry, OP.READBACK, {});
    assert.deepStrictEqual([read.width, read.height, read.pitch], [width, height, width * 4]);
    const pixel = (x,y) => [...read.pixels.slice((y * width + x)*4, (y * width + x)*4+4)];
    const drawn = [color & 255, color >>> 8 & 255, color >>> 16 & 255, color >>> 24];
    assert.deepStrictEqual(pixel(1,1), reverse ? [0x65,0x43,0x21,255] : drawn, 'independent top-left pixel oracle');
    assert.deepStrictEqual(pixel(width-2,height-2), reverse ? drawn : [0x65,0x43,0x21,255], 'independent bottom-right pixel oracle');
    queueEmpty(entry); invariant();
    events.push({ witness:id, generation:entry.queue.generation, width, height, reverse,
      topLeft:pixel(1,1), bottomRight:pixel(width-2,height-2), sha256:digest(read.pixels) });
    return read.pixels.slice();
  }
  try {
    if (topology === 'shared') {
      manager = new Manager({ module, memory, sigs, imageBase:0x400000, workerFactory:spawn,
        reclaimHeap:head => e.d3d_render_adopt_free_list(head) });
      managers.push(manager); await manager.ready;
    }
    let bridge = makeBridge();
    await witness(bridge, 7); await witness(bridge, 8, { reverse:true, color:0xff3b91d7 });
    const first = bridge.devices.get(7), peer = bridge.devices.get(8), oldGeneration = first.queue.generation;
    assert.strictEqual(await call(bridge, 0x30009, 7, { width:12, height:10 }), 1);
    assert.strictEqual(first.queue.generation, oldGeneration, 'healthy host Reset preserves generation');
    await witness(bridge, 7, { width:12, height:10, reverse:true, color:0xffd52f83 });
    assert.strictEqual(await call(bridge, 0x30001, 7, { width:12, height:10, fail:true }), -1);
    assert.match(String(bridge.lastError), /native raster execution failed/);
    const failure = first.queue.error;
    assert(failure); queueEmpty(first);
    // Model an already-published later command without erasing producer errors.
    // Failure release below retires this endpoint; this queue is never reused.
    const failedConsumer = topology === 'shared' ? first.workerConsumer : bridge.workerConsumer;
    const later = failedConsumer.execute({ version:Stream.VERSION, deviceId:7,
      generation:oldGeneration, sequence:first.queue.submitted + 1, opcode:OP.FENCE,
      payload:null, resources:[], byteLength:64 });
    await later.consumed;
    await assert.rejects(later.completion, /earlier render command failed/);
    events.push({ laterCommandRejected:true, generation:oldGeneration, sequence:first.queue.submitted + 1 });
    const before = first.queue.submitted;
    assert.strictEqual(await call(bridge, 0x30009, 7), -1, 'failed Reset remains strict');
    assert.strictEqual(first.queue.error, failure, 'Reset does not erase stream error');
    assert.strictEqual(first.queue.submitted, before, 'failed Reset cannot silently execute');
    const peerPixels = await witness(bridge, 8, { reverse:true, color:0xff3b91d7 });
    assert(workers.at(-1).threadId !== -1, 'refused draw leaves actual worker alive');
    assert.strictEqual(await call(bridge, 0x30004, 7), 1, String(bridge.lastError));
    assert(!bridge.devices.has(7)); assert(first.dead); queueEmpty(first);
    events.push({ failedQueueRetired:first.queue.snapshot() });
    if (topology === 'shared') {
      assert(!peer.lost); assert(!peer.workerConsumer.stopped);
      assert(first.workerConsumer.stopped); assert(first.workerConsumer.worker.closed);
      assert(workers[0].threadId !== -1, 'endpoint retirement preserves physical worker');
      assert.deepStrictEqual(await witness(bridge, 8, { reverse:true, color:0xff3b91d7 }), peerPixels);
      await witness(bridge, 7, { reverse:true, color:0xff8d27b9 });
      const recovered = bridge.devices.get(7);
      assert.strictEqual(recovered.queue.generation, oldGeneration + 1, 'host recreation advances generation');
      assert.notStrictEqual(recovered.workerConsumer.worker.id, first.workerConsumer.worker.id);
      assert.throws(() => first.workerConsumer.execute({}), /stopped/);
      assert.throws(() => recovered.queue.submit(OP.FENCE, null, { generation:oldGeneration }), /stale/);
      // Exercise the actual owning receiver too. A malformed old descriptor is
      // endpoint-fatal by contract; do this after recovering/reading pixels.
      const stale = recovered.workerConsumer.execute({ version:Stream.VERSION, deviceId:7,
        generation:oldGeneration, sequence:1, opcode:OP.FENCE, payload:null, resources:[], byteLength:64 });
      stale.consumed.catch(() => {});
      await assert.rejects(stale.completion, /stale or unordered/);
      events.push({ owningReceiverRejectedOldGeneration:oldGeneration, currentGeneration:recovered.queue.generation,
        endpointId:recovered.workerConsumer.worker.id });
      await recovered.workerConsumer.cancel();
      assert(workers[0].threadId !== -1);
      await witness(bridge, 8, { reverse:false, color:0xff79a531 });
      // The host discovers the closed endpoint on its next ordinary command.
      assert.strictEqual(await call(bridge, 0x30003, 7), -1);
      assert.strictEqual(await call(bridge, 0x30004, 7), 1);
      assert.strictEqual(await call(bridge, 0x30004, 8), 1);
      assert.strictEqual(manager.ports.size, 0, 'host release retires every device endpoint');
      await bridge.close();
      const shutdown = await manager.stop();
      assert(shutdown.heapAdopted > 0); assert.strictEqual(manager.pending.size, 0); assert.strictEqual(manager.queuedBytes, 0);
      events.push({ shutdown });
    } else {
      assert(peer.lost); assert(bridge.workerDead, 'legacy failure release explicitly loses all devices');
      assert.strictEqual(workers[0].threadId, -1);
      queueEmpty(peer);
      const shutdown = consumers[0].shutdownInfo;
      assert.strictEqual(shutdown.devicesReleased, 2); assert.strictEqual(shutdown.allocatedBytes, 0);
      assert(shutdown.heapAdopted > 0); events.push({ shutdown });
      assert.strictEqual(await call(bridge, 0x30003, 8), -1);
      assert.strictEqual(await call(bridge, 0x30003, 7), -1, 'same lost bridge cannot recover');
      assert.throws(() => consumers[0].execute({}), /stopped/);
      await bridge.close();
      bridge = makeBridge();
      await witness(bridge, 7, { reverse:true, color:0xff8d27b9 });
      assert.strictEqual(bridge.devices.get(7).queue.generation, 1, 'new bridge starts a new worker namespace');
      assert.strictEqual(await call(bridge, 0x30004, 7), 1);
      await bridge.close();
      assert.strictEqual(consumers.at(-1).shutdownInfo.allocatedBytes, 0);
      assert(consumers.at(-1).shutdownInfo.heapAdopted > 0);
    }
    invariant(); assert.strictEqual(maxLive, 1);
    assert(consumers.every(c => c.pending.size === 0), 'all command transport leases retired');
  } finally {
    for (const bridge of bridges) await bridge.close();
    for (const manager of managers) await manager.stop();
    for (const worker of workers) { if (worker.threadId !== -1) await worker.terminate(); }
    parentDevice.destroy();
    for (const g of allocations.reverse()) e.guest_free(g);
  }
  assert(workers.every(w => w.threadId === -1));
  console.log(JSON.stringify({ result:'PASS', topology, modulePath, moduleSha256:digest(bytes),
    maxLive, workers:workers.length, events }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
