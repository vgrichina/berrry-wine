'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const GS = require('../lib/gpu-stream');
const { makeProducer, packLayout } = require('./gpu-stream-fixture');
const { bootRenderHarness } = require('./render-helper');
const { Executor } = require('../lib/gpu-stream-software');
const { NodeRenderOwner } = require('../lib/gpu-stream-node-owner');
const { createGuestMainOwner } = require('../lib/guest-main-owner');
const { CliExecutionOwner } = require('../lib/cli-execution-owner');
const { irShader } = require('./gpu-stream-webgl-scenario');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function fixture() {
  const p = makeProducer({ ringBytes: 65536, arenaBytes: 65536, memBytes: 1 << 20 });
  const emit = (...args) => p.emit(...args);
  emit('CREATE', { id: 1, kind: GS.KIND.RT, fmt: GS.FMT.A8B8G8R8, levels: 1, width: 512, height: 512 });
  emit('CREATE', { id: 2, kind: GS.KIND.DS, fmt: GS.FMT.D16, levels: 1, width: 512, height: 512 });
  emit('TARGETS', { color: 1, depth: 2 });
  const elems = [[9, 0, 0], [10, 0, 16], [5, 0, 32], [5, 1, 48]].map(([usage, index, offset]) =>
    packLayout('GpsLayoutElem', { slot: 0, type: 3, usage, index, offset }));
  emit('LAYOUT', { id: 3, count: 4, stride: 64 }, Buffer.concat(elems));
  const ps = irShader([[1, 0x800f0000, 0x90e40000]]);
  emit('SHADER', { id: 4, stage: 1, ir_bytes: ps.length }, ps);
  emit('RASTER', { zfunc: 8, cull: 1, blend: 1, src_rgb: 2, dst_rgb: 1,
    src_alpha: 2, dst_alpha: 1, blend_op: 1, blend_op_alpha: 1, linear: 1,
    alpha_func: 8, colormask: 15, fill: 3, scissor_right: 512, scissor_bottom: 512 });
  function draws(count) {
    for (let i = 0; i < count; i++) {
      const verts = new Float32Array([[0, 0], [512, 0], [0, 512]].flatMap(([x, y]) =>
        [x - .5, y - .5, .5, 1, i === count - 1 ? 0 : 1, i === count - 1 ? 1 : 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1]));
      const pos = p.arenaAlloc(verts.byteLength);
      p.arenaView(pos, verts.byteLength).set(new Uint8Array(verts.buffer));
      emit('DRAW_UP', { prim: 4, ps: 4, layout: 3, voff: pos, stride: 64, count: 3, vcount: 3 });
    }
  }
  return { p, emit, draws };
}

(async () => {
  const h = await bootRenderHarness({ fonts: 'none' });
  const summary = {};
  for (const route of ['local', 'owner']) {
    const { p, emit, draws } = fixture(), frames = [];
    const ex = route === 'local' ? new Executor({ getExports: () => h.exports,
      getMemory: () => h.memory.buffer, onPresent: f => frames.push(f) }) : null;
    const executionOwner = route === 'owner' ? new CliExecutionOwner(h.module, { buffer: p.buffer }) : null;
    const sharedFrames = [];
    const owner = executionOwner ? executionOwner.create({ ring: p.header, onFrame: f => frames.push(f) }) : null;
    if (owner) {
      assert.equal(executionOwner.create({ ring: p.header, onFrame: f => sharedFrames.push(f) }), owner,
        'cooperative bridges must share exactly one consumer for their producer ring');
      assert.equal(executionOwner.owners.size, 1);
    }
    try {
      const sync = () => owner ? owner.kick(p.header, 1) : GS.drain([p.ring()], ex);
      sync();
      draws(64);
      emit('PRESENT', { rt: 1, w: 512, h: 512, surface: 1 });
      const start = performance.now();
      let applied;
      const input = new Promise(resolve => setImmediate(() => { applied = performance.now() - start; resolve(); }));
      if (owner) { owner.kick(p.header, 0); await owner.flush(); }
      else GS.drain([p.ring()], ex);
      await input;
      assert.equal(frames.length, 1);
      if (owner) assert.equal(hash(sharedFrames[0].pixels), hash(frames[0].pixels));
      assert.deepEqual(Array.from(frames[0].pixels.subarray((20 * 512 + 20) * 4, (20 * 512 + 20) * 4 + 4)), [0, 255, 0, 255]);
      const dst = p.arenaAlloc(16);
      emit('READBACK', { rt: 1, fmt: GS.FMT.A8B8G8R8, x: 20, y: 20, w: 1, h: 1, pitch: 4, dst, slot: 0 });
      const fence = emit('FENCE', { kind: 0, slot: 1 });
      sync();
      assert.deepEqual(Array.from(p.arenaView(dst, 4)), [0, 255, 0, 255]);
      assert.equal(p.slot(1), fence);
      assert.equal(p.load('read_pos'), p.load('write_pos'));
      summary[route] = { appliedMs: applied, within800ms: applied < 800,
        frame: hash(frames[0].pixels), done: p.load('done_seq'), arena: p.load('arena_tail') };
      // A nested synchronous guest callback still returns its real i32; the
      // asynchronous post-export service retains the scheduler turn afterward.
      if (owner) {
        let callback = false;
        const main = createGuestMainOwner({ localExports: { run() {
          callback = (() => { emit('MARK', { frame: 99, tag: 0 }); return owner.kick(p.header, 0); })() === 1;
          return 37;
        } } });
        assert.equal(await main.run(1), 37);
        await owner.flush();
        assert(callback);
        const execution = new CliExecutionOwner(h.module, h.memory);
        draws(1);
        owner.kick(p.header, 0);
        execution.parkThread(4, owner);
        assert.equal(execution.isParked(2), false, 'independent sibling remains runnable');
        // Complete while still in a synchronous callback pump: Promise
        // settlement has had no event turn, but the native owner has retired.
        owner._wait(1, owner.next);
        assert.equal(execution.isParked(4), false, 'synchronous callback observes atomic completion');
        owner.kick(p.header, 2);
        assert.throws(() => owner.kick(p.header, 1), /closed/);
      }
    } finally { if (owner) await owner.close(); else ex.close(); }
  }
  assert.equal(summary.owner.frame, summary.local.frame);
  assert.equal(summary.owner.done, summary.local.done);
  assert.equal(summary.owner.arena, summary.local.arena);
  assert.equal(summary.local.within800ms, false, 'old native render load must reproduce the unchanged 800ms failure');
  assert.equal(summary.owner.within800ms, true, 'render owner must allow the event turn within 800ms');
  const bad = fixture();
  const owner = new NodeRenderOwner({ module: h.module, memory: bad.p.buffer, onFrame() {} });
  try {
    bad.emit('TARGETS', { color: 999 });
    assert.throws(() => owner.kick(bad.p.header, 1), /999/);
    assert.notEqual(bad.p.load('error_code'), 0);
    assert.throws(() => owner.kick(bad.p.header, 0), /999/);
  } finally { await owner.close(); }
  const stopped = fixture();
  const stoppingOwner = new NodeRenderOwner({ module: h.module, memory: stopped.p.buffer, onFrame() {
    assert.fail('cancelled frame must not publish');
  } });
  try {
    stoppingOwner.kick(stopped.p.header, 1);
    stopped.draws(64);
    stopped.emit('PRESENT', { rt: 1, w: 512, h: 512, surface: 1 });
    stoppingOwner.kick(stopped.p.header, 0);
    const waiting = assert.rejects(stoppingOwner.flush(), /closed|failed/);
    await stoppingOwner.close();
    await waiting;
    assert.notEqual(stopped.p.load('read_pos'), stopped.p.load('write_pos'));
    assert.equal(stopped.p.load('error_code'), GS.ERR.EXECUTOR);
  } finally { await stoppingOwner.close(); }
  // The opt-in boundary must publish every successful guest draw, rather
  // than waiting for frame-sized ring backpressure. It remains opt-in.
  const g = await require('./helpers/d3dim-gps-device').bootGpsDevice();
  const rt = g.surface(8, 8, { caps: 0x2840 }), dev = g.device(rt);
  const verts = g.e.guest_alloc(256);
  g.e.gd_rs(dev, 7, 0); g.e.gd_rs(dev, 22, 1);
  g.vertices(verts, [[-1,-1],[20,-1],[-1,20]].map(([x,y]) => [x,y,.5,1,0xff00ff00,0,0,0]));
  g.e.gd_draw(dev, 4, verts, 3);
  const before = g.kicks.n;
  g.e.d3dim_gps_draw_kicks_enable(1);
  g.e.gd_draw(dev, 4, verts, 3);
  assert.equal(g.kicks.n, before + 1, 'one successful guest draw publishes one asynchronous boundary');
  g.e.d3dim_gps_draw_kicks_enable(0);
  const off = g.kicks.n;
  g.e.gd_draw(dev, 4, verts, 3);
  assert.equal(g.kicks.n, off, 'default frame batching remains available');
  g.fence();
  assert.equal(g.stats().draws, 3, 'all guest draws preserved');
  console.log(JSON.stringify(summary));
  console.log('PASS native render oldfail/newpass, ordered pixels, arena retirement, SYNC, fence, readback, nested callback, close and scoped error');
})().catch(error => { console.error(error); process.exitCode = 1; });
