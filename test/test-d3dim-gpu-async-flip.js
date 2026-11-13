#!/usr/bin/env node
'use strict';

// A queued Flip on a WebGL2 target: the back buffer's readback goes into a
// pixel-pack buffer behind a fence sync instead of a synchronous readPixels,
// the flip chain's DIBs swap in draw order, and the pixels land in the DIB
// they were read from only when something fences those bytes. Measured on
// Deus Ex's D3DDrv: the synchronous readback was 28 ms of every present.

const assert = require('assert');
// The negative control changes only the collect-before-reuse call in a private
// in-memory module. It must fail on actual lost first-frame DIB bytes.
function loadExecutor() {
  const filename = require.resolve('../lib/d3dim-gpu');
  if (!process.argv.includes('--negative-control')) return require(filename);
  const fs = require('fs'), Module = require('module');
  const source = fs.readFileSync(filename, 'utf8');
  const anchor = 'if (t.inflight) this._completeInflight(t);';
  assert.equal(source.split(anchor).length, 2, 'exact single reuse boundary');
  const isolated = new Module(filename, module);
  isolated.filename = filename;
  isolated.paths = module.paths;
  isolated._compile(source.replace(anchor, '/* negative control: skip old frame collection */'), filename);
  return isolated.exports;
}
const { D3DIMGpu, OPCODES } = loadExecutor();

function fixture({ asyncFlip = true, version = 2, own = true, bpp = 32 } = {}) {
  const memory = new ArrayBuffer(0x10000), dv = new DataView(memory), u8 = new Uint8Array(memory);
  const front = 0x1000, back = 0x1040, flipDesc = 0x1100, dibA = 0x8000, dibB = 0x9000;
  dv.setUint32(front + 20, dibB, true);   // front entry's DIB
  dv.setUint32(back + 20, dibA, true);    // back entry's DIB: the render target
  dv.setUint32(flipDesc, front, true);
  dv.setUint32(flipDesc + 4, back, true);
  u8.fill(0x11, dibA, dibA + 64);
  u8.fill(0x22, dibB, dibB + 64);

  const events = [];
  let packBound = null, bufferSerial = 0, live = true, destroyed = false;
  let frame = [0x10, 0x20, 0x30, 0xff];
  const context = {}, lifecycle = [];
  const owned = buffer => assert(buffer && buffer.context === context && !buffer.deleted,
    'operation uses live PBO owned by this exact context');
  const PIXEL_PACK_BUFFER = 0x88eb;
  const gl = {
    RGBA: 1, UNSIGNED_BYTE: 2, PIXEL_PACK_BUFFER, STREAM_READ: 3, SYNC_GPU_COMMANDS_COMPLETE: 4,
    createBuffer() { const b = { context, id: ++bufferSerial, data: null }; lifecycle.push(['create', b]); return b; },
    deleteBuffer(b) { owned(b); b.deleted = true; lifecycle.push(['delete', b]); },
    bindBuffer(target, buf) {
      assert.equal(target, PIXEL_PACK_BUFFER);
      if (buf) owned(buf);
      packBound = buf;
    },
    bufferData(target, size) { owned(packBound); packBound.data = new Uint8Array(size); },
    readPixels(x, y, w, h, fmt, type, dst) {
      // The GPU frame: every pixel R=0x10 G=0x20 B=0x30 A=0xff (RGBA bytes).
      const fill = out => { for (let i = 0; i < out.length; i += 4) out.set(frame, i); };
      if (typeof dst === 'number') { events.push('read-async'); owned(packBound); lifecycle.push(['write', packBound]); fill(packBound.data.subarray(dst, dst + w * h * 4)); }
      else { events.push('read-sync'); fill(dst); }
    },
    fenceSync() { events.push('fence-sync'); return { sync: true }; },
    deleteSync() { events.push('delete-sync'); },
    flush() {},
    getBufferSubData(target, offset, dst) {
      assert.equal(target, PIXEL_PACK_BUFFER); owned(packBound);
      assert(offset >= 0 && offset + dst.length <= packBound.data.length);
      events.push('collect'); lifecycle.push(['collect', packBound]);
      dst.set(packBound.data.subarray(offset, offset + dst.length));
    },
  };
  const exports = {
    d3dim_worker_flip(f, b) {
      events.push('swap');
      const t = dv.getUint32(f + 20, true);
      dv.setUint32(f + 20, dv.getUint32(b + 20, true), true);
      dv.setUint32(b + 20, t, true);
    },
    page_watch_write() {},
    d3dim_gpu_surface_live() { return live; },
  };
  const gpu = new D3DIMGpu({ getMemory: () => memory, getExports: () => exports,
    createCanvas: () => null, asyncFlip, onError: () => {} });
  const target = { rt: back, width: 4, height: 4, bpp, pitch: bpp / 2, format: 1,
    dib: dibA, dirty: true, colorDirtyBounds: null, check: false, textureKeys: new Set(),
    device: { gpu: { version, gl, bindImplicitTarget() {} }, destroy() { destroyed = true; } } };
  if (own) gpu.targets.set(back, target);
  return { gpu, dv, u8, events, lifecycle, gl, flipDesc, front, back, dibA, dibB, target,
    get packBound() { return packBound; },
    setFrame(value) { frame = value; }, setLive(value) { live = value; },
    get destroyed() { return destroyed; } };
}

// DIB bytes for one 32-bit pixel converted from RGBA (0x10,0x20,0x30): B G R A.
const PIXEL = [0x30, 0x20, 0x10, 0xff];

{
  const f = fixture();
  assert.equal(f.gpu.call(OPCODES.FLIP, f.flipDesc), 1, 'a WebGL2 target queues the flip');
  assert.deepEqual(f.events, ['read-async', 'fence-sync', 'swap'],
    'the readback goes to a pixel-pack buffer, then the chain swaps; no client-memory read');
  assert.equal(f.dv.getUint32(f.front + 20, true), f.dibA, 'the drawn DIB is the front now');
  assert.equal(f.dv.getUint32(f.back + 20, true), f.dibB);
  assert.deepEqual(Array.from(f.u8.subarray(f.dibA, f.dibA + 4)), [0x11, 0x11, 0x11, 0x11],
    'the pixels are not in the DIB until something fences it');
  assert.equal(f.target.dirty, false, 'the in-flight read owns that frame, not a later fence');

  // A fence on unrelated bytes leaves the read in flight and keeps WAT pending.
  assert.equal(f.gpu.call(OPCODES.FENCE, 0xa000, 64), 2);
  assert(!f.events.includes('collect'));

  // Presenting the front (a fence ranged to its DIB) collects it.
  f.gpu.call(OPCODES.FENCE, f.dibA, 64);
  assert.deepEqual(f.events.slice(-2), ['collect', 'delete-sync']);
  for (let i = 0; i < 16; i++) {
    assert.deepEqual(Array.from(f.u8.subarray(f.dibA + i * 4, f.dibA + i * 4 + 4)), PIXEL,
      `pixel ${i} arrived in the DIB it was read from`);
  }
  assert.deepEqual(Array.from(f.u8.subarray(f.dibB, f.dibB + 4)), [0x22, 0x22, 0x22, 0x22],
    'the new back buffer is untouched');
  assert.equal(f.gpu.stats.asyncFlips, 1);
  assert.equal(f.gpu.stats.asyncReads, 1);
  assert.equal(f.gpu.stats.syncs, 1);

  // Nothing is collected twice: a later global fence finds no in-flight read.
  const n = f.events.length;
  f.gpu.call(OPCODES.FENCE, 0, 0);
  assert(!f.events.slice(n).includes('collect'));
}

{
  // A global fence (zero length) collects an in-flight read too.
  const f = fixture();
  f.gpu.call(OPCODES.FLIP, f.flipDesc);
  f.gpu.call(OPCODES.FENCE, 0, 0);
  assert(f.events.includes('collect'));
  assert.deepEqual(Array.from(f.u8.subarray(f.dibA, f.dibA + 4)), PIXEL);
}

// Reuse one PBO across two different frames. The second flip itself must
// materialize the first frame, before the PBO receives the second frame.
{
  const f = fixture();
  f.gpu.call(OPCODES.FLIP, f.flipDesc);
  const pbo = f.target.pbo;
  f.target.dib = f.dv.getUint32(f.back + 20, true);
  f.target.dirty = true;
  f.setFrame([0x40, 0x50, 0x60, 0xff]);
  f.gpu.call(OPCODES.FLIP, f.flipDesc);
  assert.deepEqual(Array.from(f.u8.subarray(f.dibA, f.dibA + 4)), PIXEL,
    'first frame bytes survive PBO reuse before second collection');
  assert.equal(f.target.pbo, pbo, 'actual same-buffer reuse exercised');
  assert.deepEqual(f.lifecycle.filter(x => x[0] !== 'create').map(x => x[0]),
    ['write', 'collect', 'write']);
  f.gpu.call(OPCODES.FENCE, 0, 0);
  assert.deepEqual(Array.from(f.u8.subarray(f.dibB, f.dibB + 4)), [0x60, 0x50, 0x40, 0xff]);
  assert(f.lifecycle.filter(x => ['collect', 'write'].includes(x[0])).every(x => x[1] === pbo));
}

// A bound-buffer mock must reject cross-context objects and read the selected
// buffer rather than the last buffer allocated. Separate contexts also retain
// their respective pixel contents when collection order is reversed.
{
  const a = fixture(), b = fixture();
  a.gpu.call(OPCODES.FLIP, a.flipDesc);
  b.setFrame([7, 8, 9, 255]);
  b.gpu.call(OPCODES.FLIP, b.flipDesc);
  assert.throws(() => a.gl.bindBuffer(a.gl.PIXEL_PACK_BUFFER, b.target.pbo), /exact context/);
  const unused = a.gl.createBuffer();
  a.gl.bindBuffer(a.gl.PIXEL_PACK_BUFFER, unused);
  a.gl.bufferData(a.gl.PIXEL_PACK_BUFFER, 64);
  b.gpu.call(OPCODES.FENCE, 0, 0);
  a.gpu.call(OPCODES.FENCE, 0, 0);
  assert.deepEqual(Array.from(a.u8.subarray(a.dibA, a.dibA + 4)), PIXEL);
  assert.deepEqual(Array.from(b.u8.subarray(b.dibA, b.dibA + 4)), [9, 8, 7, 255]);
  assert.equal(a.lifecycle.find(x => x[0] === 'collect')[1], a.target.pbo);
}

// Dead-target discard does not collect or reuse its pending buffer. The
// actual executor drops the target and declines a further flip of that entry.
{
  const f = fixture();
  f.gpu.call(OPCODES.FLIP, f.flipDesc);
  f.setLive(false);
  f.gpu.call(OPCODES.FENCE, 0, 0);
  assert.equal(f.target.inflight, null);
  assert.equal(f.destroyed, true);
  assert.equal(f.gpu.targets.has(f.back), false);
  assert.deepEqual(f.events, ['read-async', 'fence-sync', 'swap', 'delete-sync']);
  assert.deepEqual(Array.from(f.u8.subarray(f.dibA, f.dibA + 4)), [0x11, 0x11, 0x11, 0x11]);
  assert.equal(f.gpu.call(OPCODES.FLIP, f.flipDesc), 0);
  assert.equal(f.lifecycle.filter(x => x[0] === 'write').length, 1);
}

// Collection and writeback can throw after a Flip has already been accepted.
// Retain the exact frame/PBO until both finish: a retry must never report a
// clean fence over stale bytes, and a later Flip must not overwrite that PBO.
// Controlled exceptions exercise the actual executor, not a replacement fence.
for (const bpp of [16, 32]) for (const stage of ['collect', 'writeback']) {
  const f = fixture({ bpp });
  f.gpu.call(OPCODES.FLIP, f.flipDesc);
  const pending = f.target.inflight, pbo = f.target.pbo;
  const failure = new Error(`${stage} exception`);
  const owner = stage === 'collect' ? f.gl : f.gpu.getExports();
  const method = stage === 'collect' ? 'getBufferSubData' : 'page_watch_write';
  const original = owner[method];
  owner[method] = () => { throw failure; };
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.throws(() => f.gpu.call(OPCODES.FENCE, f.dibA, 64), e => e === failure);
    assert.equal(f.target.inflight, pending, 'failed collection retains the accepted frame');
    assert.equal(f.packBound, null, 'exception restores client-memory readback binding');
    assert.equal(f.events.filter(e => e === 'delete-sync').length, 0);
    assert.equal(f.gpu.stats.syncs, 0, 'failed writeback is not a completed synchronization');
  }
  if (stage === 'collect') assert.deepEqual([...f.u8.slice(f.dibA, f.dibA + 4)], [17,17,17,17]);
  // Prepare the next back buffer exactly as a subsequent draw does. Its Flip
  // must also refuse while collection fails, without overwriting frame one.
  f.target.dib = f.dibB; f.target.dirty = true;
  f.setFrame([0x40, 0x50, 0x60, 0xff]);
  assert.throws(() => f.gpu.call(OPCODES.FLIP, f.flipDesc), e => e === failure);
  assert.equal(f.lifecycle.filter(e => e[0] === 'write').length, 1);
  assert.equal(f.events.filter(e => e === 'swap').length, 1);
  owner[method] = original;
  assert.equal(f.gpu.call(OPCODES.FLIP, f.flipDesc), 1);
  const first = bpp === 16 ? [0x06, 0x11] : PIXEL;
  const second = bpp === 16 ? [0x8c, 0x42] : [0x60, 0x50, 0x40, 0xff];
  for (let i = 0; i < 16; i++)
    assert.deepEqual([...f.u8.slice(f.dibA + i * first.length, f.dibA + (i + 1) * first.length)], first);
  assert.equal(f.target.pbo, pbo, 'retry reuses the original PBO only after writing its frame');
  assert.equal(f.gpu.call(OPCODES.FENCE, 0, 0), 1);
  for (let i = 0; i < 16; i++)
    assert.deepEqual([...f.u8.slice(f.dibB + i * second.length, f.dibB + (i + 1) * second.length)], second);
  assert.equal(f.target.inflight, null);
  assert.equal(f.events.filter(e => e === 'delete-sync').length, 2);
  assert.equal(f.gpu.stats.syncs, 2);
}

// Everything else keeps the synchronous Flip: WAT fences and swaps itself.
assert.equal(fixture({ asyncFlip: false }).gpu.call(OPCODES.FLIP, 0x1100), 0, 'not opted in');
assert.equal(fixture({ version: 1 }).gpu.call(OPCODES.FLIP, 0x1100), 0, 'WebGL1 has no pixel-pack buffer');
assert.equal(fixture({ own: false }).gpu.call(OPCODES.FLIP, 0x1100), 0, 'a back buffer this executor does not own');

console.log('PASS  D3DIM WebGL2 Flip queues its readback and collects it at the next fence of those bytes');
