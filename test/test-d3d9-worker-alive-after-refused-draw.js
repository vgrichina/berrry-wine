#!/usr/bin/env node
// The REAL render worker thread survives a draw the rasterizer refuses.
//
// test-d3d9-worker-survives-draw-failure.js pins the receiver's behaviour in
// isolation, but the bug being fixed did not live in the receiver -- it lived
// in what the receiver's throw reached. lib/d3d-render-worker.js wraps its
// whole message handler in one try/catch whose catch calls shutdownNeutral();
// the thread's event loop then has nothing left to keep it alive and the
// process exits. So the property worth pinning end to end is that the worker
// THREAD is still running afterwards, and still serving other devices.
//
// The failing draw here is a real refusal from the native rasterizer, not a
// stubbed throw: a clip-space triangle with one vertex at a positive but tiny
// w. The clipper's post-plane compaction keeps every vertex whose w > 0, and
// $d3d_software_project then computes 1/w and refuses the draw when that
// overflows FLT_MAX -- which happens for every w below about 3e-39. That is a
// genuine -1 out of $d3d_software_step, the same shape of failure Black &
// White 2's land pass hit at command 8917 and which took the worker with it.
'use strict';
const assert = require('assert');
const path = require('path');
const { Worker } = require('worker_threads');
const { bootRenderHarness } = require('./render-helper');
const Stream = require('../lib/d3d-command-stream');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;

// A clip-space triangle whose first vertex has w = 1e-39. Inside every frustum
// plane (|x|,|y| <= w and 0 <= z <= w), so clipping keeps all three.
const failingDraw = () => {
  const stride = 20, vertices = new Uint8Array(3 * stride);
  const view = new DataView(vertices.buffer);
  [1e-39, 1, 2].forEach((w, j) => {
    const at = j * stride;
    [0, 0, w * 0.5, w].forEach((c, k) => view.setFloat32(at + k * 4, c, true));
    vertices.set([255, 255, 255, 255], at + 16);
  });
  return draw(vertices, stride);
};

// The same triangle with an ordinary w -- the control, and what the second
// device draws to show it was never affected.
const goodDraw = () => {
  const stride = 20, vertices = new Uint8Array(3 * stride);
  const view = new DataView(vertices.buffer);
  [[-0.5, -0.5], [0.5, -0.5], [0, 0.5]].forEach(([x, y], j) => {
    const at = j * stride;
    [x, y, 0.5, 1].forEach((c, k) => view.setFloat32(at + k * 4, c, true));
    vertices.set([255, 255, 255, 255], at + 16);
  });
  return draw(vertices, stride);
};

const draw = (vertices, stride) => ({
  primitive: 4, primitiveCount: 1, stride, vertices, textures: [],
  attributes: [{ register: 0, usage: 0, usageIndex: 0, type: 3, offset: 0 },
    { register: 1, usage: 10, usageIndex: 0, type: 4, offset: 16 }],
  vertexShader: new Uint32Array([0xfffe0101,
    1, 0xc00f0000, 0x90e40000, 1, 0xd00f0000, 0x90e40001, 0xffff]),
  pixelShader: new Uint32Array([0xffff0101, 1, 0x800f0000, 0x90e40000, 0xffff]),
  state: { cull: 1, zenable: false },
});

const settled = promise => promise.then(() => null, error => error);

(async () => {
  const { exports: e, memory, module } = await bootRenderHarness({ fonts: 'none' });
  // The neutral worker validates the image base it is initialized with, so the
  // harness needs a loaded PE before one can be started. Any image will do --
  // nothing here executes guest code.
  const pe = require('fs').readFileSync(path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert.ok(e.load_pe(pe.length), 'the harness needs a loaded image for the worker');
  const worker = new Worker(path.join(__dirname, '../lib/d3d-render-worker.js'));
  let consumer;
  try {
    consumer = new Stream.WorkerConsumer(worker, { module, memory, sigs,
      imageBase: e.get_image_base() >>> 0, sourceVersion: 'worker-alive-test',
      reclaimHeap(head) { return e.d3d_render_adopt_free_list(head); } });

    // The worker reports 'ready' only after it has instantiated the module and
    // built its neutral receiver; submitting before that is NOT_READY.
    await consumer.ready;

    const queueFor = deviceId => new Stream.CommandQueue({ deviceId, generation: 1,
      capacityBytes: 1 << 22, consumer });
    const device = (queue, id) => queue.submit(Stream.OPCODES.RESOURCE_CREATE,
      { kind: 'device', width: 64, height: 64, quadBudget: 1 });

    // Two devices on ONE worker: the escalation's real cost was that a failure
    // on either took both down, because the thread itself went away.
    const first = queueFor(1), second = queueFor(2);
    await settled(waitFor(first, device(first, 1)));
    await settled(waitFor(second, device(second, 2)));

    // The refusal. It must be reported, and it must be the rasterizer's own.
    const refused = await settled(waitFor(first, first.submit(Stream.OPCODES.DRAW, failingDraw())));
    assert.ok(refused, 'the tiny-w draw must be refused by the native rasterizer');
    assert.match(String(refused.message || refused), /native raster execution failed|render/,
      `unexpected refusal: ${refused && refused.message}`);

    // THE ASSERTION. Under the old behaviour the next command threw out of
    // receive(), the worker called shutdownNeutral() and the thread exited.
    // Give it a moment to die if it is going to.
    // Model a follow-on command already in transport when failure is learned.
    // Healthy host Reset does not advance generation or clear this error;
    // production retirement/recreation is covered by worker-reset-recovery.
    const following = consumer.execute({ version: Stream.VERSION, deviceId: 1,
      generation: first.generation, sequence: first.submitted + 1,
      opcode: Stream.OPCODES.DRAW, payload: goodDraw(), resources: [], byteLength: 64 });
    following.consumed.catch(() => {});
    const after = await settled(following.completion);
    assert.ok(after, "a poisoned device's later draw is still reported failed");
    assert.match(String(after.message || after), /earlier render command failed/,
      `expected the poisoned-stream answer, got: ${after && after.message}`);

    await new Promise(resolve => setTimeout(resolve, 250));
    assert.notStrictEqual(worker.threadId, -1,
      'the render worker thread must still be running after a refused draw');

    // And the strongest form: the OTHER device on the same worker still
    // renders. This is what the shutdown used to destroy along with the rest.
    const other = await settled(waitFor(second, second.submit(Stream.OPCODES.DRAW, goodDraw())));
    assert.strictEqual(other, null,
      `a second device on the same worker must be unaffected: ${other && other.message}`);
    assert.strictEqual(second.error, null, 'the unaffected device keeps a clean queue');
    assert.notStrictEqual(worker.threadId, -1, 'and the worker is still alive at the end');
  } finally {
    await worker.terminate();
  }

  console.log('PASS test-d3d9-worker-alive-after-refused-draw');
})().catch(error => { console.error(error); process.exit(1); });

// A receipt is not a promise; the queue reports completion by retiring the
// entry, so wait for the sequence to leave flight and then read its status.
function waitFor(queue, receipt) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 15000;
    const poll = () => {
      if (receipt.status === 'completed') return resolve(receipt.value);
      if (receipt.status === 'failed' || receipt.status === 'cancelled')
        return reject(queue.error || new Error(`render command ${receipt.status}`));
      if (Date.now() > deadline) return reject(new Error('render command timed out'));
      setTimeout(poll, 5);
    };
    poll();
  });
}
