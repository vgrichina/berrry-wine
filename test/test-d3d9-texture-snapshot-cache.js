#!/usr/bin/env node
'use strict';
// Uploads decode through the standalone build of the WAT decoder (slice 9.1).
require('./helpers/wat-texture-decoder').installStandalone();
// A bound texture is decoded once, not once per draw.
//
// Every D3D9 DRAW carries its bound textures as decoded RGBA, and the bridge
// used to rebuild them from guest bytes on every single draw: a fresh
// Uint8Array(w*h*4) and a per-texel conversion loop for each mip level, each
// time. Measured live on Black & White 2's tutorial land over 56.1s of wall
// clock, 679 draws cost 16.49s inside the bridge, of which the command queue's
// own publication -- copyPayload, which copies the whole snapshot again -- was
// 0.78s. The remaining 15.7s, 28% of ALL wall clock, was this decode, run
// again and again over land textures nothing had touched since level load.
//
// WHAT MAKES REUSE SAFE, and it was already there. Guest code can only reach
// these texels through LockRect, the draw path refuses a level that is still
// locked, and UnlockRect bumps the mip record's dirty sequence at +28 (so does
// AddDirtyRect). So an unchanged sequence on a drawable level means no guest
// write has landed since the snapshot. That invariant needed no new code -- it
// needed a test. Full source-byte comparison now additionally guards against
// wrapped allocation or dirty counters.
//
// The address of a mip record is the cache key, and a released texture's
// address can be handed to a new one whose sequence starts over. A different
// device incarnation or texture-allocation generation always decodes anew.
// A full source-byte comparison also rejects counter ABA between draws.
const assert = require('assert');
const { Bridge } = require('../lib/d3d9-host');
const jsOnly = process.argv.includes('--js-only');
const bootRenderHarness = jsOnly ? null : require('./render-helper').bootRenderHarness;

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

// A device descriptor plus one R5G6B5 texture bound to stage 0. R5G6B5 is one
// of the per-texel conversion formats (and the one B&W2's land is largest in),
// so this exercises the loop the cache exists to skip rather than a memcpy.
function fixture(options = {}, texelWidth = 16, texelHeight = 16) {
  const memory = new ArrayBuffer(1 << 20), v = new DataView(memory), commands = [], gates = [];
  const desc = 64, program = 1024, vertices = 30000, texture = 40000, texels = 44000;
  const set = (p, n) => v.setUint32(p, n, true);
  [7, program, 32000, 2, 2, 1, 4, 1, vertices, 16].forEach((n, i) => set(desc + i * 4, n));
  set(program + 12, 0x42); v.setFloat32(program + 1696, 1, true);
  set(program + 21784, 0x80000000);
  new Uint8Array(memory, vertices, 48).fill(0x31);

  // Texture record: +12 kind, +24/+28 declared size, +32 levels, +36 format,
  // +48 LOD, +56 colour alias (none). One 32-byte mip record at +64.
  const bytes = texelWidth * texelHeight * 2;
  set(texture + 12, 3); set(texture + 24, texelWidth); set(texture + 28, texelHeight);
  set(texture + 32, 1); set(texture + 36, 23); set(texture + 48, 0); set(texture + 56, 0);
  const mip = texture + 64;
  set(mip, texelWidth); set(mip + 4, texelHeight); set(mip + 8, texelWidth * 2);
  set(mip + 12, bytes); set(mip + 16, texels); set(mip + 20, 0); set(mip + 28, 1);
  set(program + 1700, texture);                 // stage 0 texture slot
  v.setFloat32(program + 1808 + 32, 0, true);   // stage 0 sampler LOD bias

  const initialized = deferred();
  const consumer = { ready: initialized.promise,
    execute(command) { commands.push(command); const gate = deferred(); gates.push(gate); return { completion: gate.promise, value: gate.promise }; },
    async cancel() { for (const gate of gates) gate.reject(new Error('cancelled')); } };
  const bridge = new Bridge({ backend: 'software', createSoftwareWorker: () => consumer,
    getMemory: () => memory, guestToWasm: p => p, maxDeferredCommands: 32, ...options });
  // The queue runs one command at a time, so a draw only reaches the consumer
  // once the previous one has completed. Retire whatever is outstanding.
  const flush = async () => { for (let i = 0; i < 4; i++) { while (gates.length) gates.shift().resolve(1); await tick(); } };
  return { bridge, memory, v, set, commands, gates, initialized, desc, program, mip, texels, bytes, flush };
}

const { OPCODES } = require('../lib/d3d-command-stream');
const draws = f => f.commands.filter(command => command.opcode === OPCODES.DRAW);
const drawnLevel = command => command.payload.textures[0].levels[0];
const drawnPixels = command => drawnLevel(command).pixels;

(async () => {
  // ---- The JS half: one decode, reused across draws --------------------
  {
    const f = fixture();
    new Uint8Array(f.memory, f.texels, f.bytes).fill(0x5a);
    f.initialized.resolve(); await tick();

    assert.strictEqual(f.bridge.call(0x30001, f.desc, 0), 1, 'the first draw is issued');
    await f.flush();
    assert.strictEqual(f.bridge._textureSnapshots.size, 1, 'the decoded level is kept');
    const first = f.bridge._textureSnapshots.get(f.mip).pixels;
    assert.strictEqual(first.byteLength, 16 * 16 * 4, 'kept as decoded RGBA');
    assert.strictEqual(f.bridge._textureSnapshotBytes, first.byteLength, 'only the decoded RGBA is charged (no source copy)');

    f.bridge.call(0x30001, f.desc, 0); await f.flush();
    assert.strictEqual(f.bridge._textureSnapshots.get(f.mip).pixels, first,
      'an unchanged texture is not decoded a second time');
    assert.strictEqual(draws(f).length, 2, 'both draws were still published');
    // The executor keeps the level under its key, so the second draw names
    // it and carries no pixels at all (test-d3d9-texture-residency.js).
    assert.strictEqual(drawnLevel(draws(f)[1]).key, drawnLevel(draws(f)[0]).key, 'and both name the same level');
    assert.strictEqual(drawnPixels(draws(f)[1]), undefined, 'the second draw carries the key alone');
    // 0x5a5a as R5G6B5: r=11 -> (11<<3)|(11>>>2) = 90, g=18 -> 73, b=26 -> 214.
    assert.deepStrictEqual(Array.from(drawnPixels(draws(f)[0]).slice(0, 4)), [90, 73, 214, 255],
      'the conversion itself is unchanged by caching it');
    // The queue owns a private copy of every payload, so the reused array is
    // never the one a consumer holds -- reuse must not turn into aliasing.
    assert.notStrictEqual(drawnPixels(draws(f)[0]), first, 'the published payload is still a copy');

    // A bumped sequence is the guest saying the texels may have changed.
    new Uint8Array(f.memory, f.texels, f.bytes).fill(0x1f);
    f.set(f.mip + 28, 2);
    f.bridge.call(0x30001, f.desc, 0); await f.flush();
    const second = f.bridge._textureSnapshots.get(f.mip).pixels;
    assert.notStrictEqual(second, first, 'a bumped dirty sequence forces a fresh decode');
    assert.notStrictEqual(drawnLevel(draws(f)[2]).key, drawnLevel(draws(f)[0]).key, 'under a new key');
    // 0x1f1f: r=3 -> 24, g=56 -> 227, b=31 -> 255.
    assert.deepStrictEqual(Array.from(drawnPixels(draws(f)[2]).slice(0, 4)), [24, 227, 255, 255],
      'and the new picture is what is drawn');
    assert.strictEqual(f.bridge._textureSnapshotBytes, second.byteLength,
      'the replaced snapshot is not charged twice');
    await f.bridge.close();
  }

  // ---- The budget: a cache that cannot grow without bound ---------------
  {
    // Room for exactly one 16x16 RGBA, so the second texture must evict
    // the first rather than keeping both.
    const f = fixture({ maxTextureSnapshotBytes: 16 * 16 * 4 });
    new Uint8Array(f.memory, f.texels, f.bytes).fill(0x5a);
    f.initialized.resolve(); await tick();
    f.bridge.call(0x30001, f.desc, 0); await f.flush();
    assert.strictEqual(f.bridge._textureSnapshots.size, 1);

    const other = 50000, otherTexels = 54000;
    f.v.setUint32(other + 12, 3, true); f.v.setUint32(other + 24, 16, true);
    f.v.setUint32(other + 28, 16, true); f.v.setUint32(other + 32, 1, true);
    f.v.setUint32(other + 36, 23, true);
    f.set(other + 64, 16); f.set(other + 64 + 4, 16); f.set(other + 64 + 8, 32);
    f.set(other + 64 + 12, f.bytes); f.set(other + 64 + 16, otherTexels); f.set(other + 64 + 28, 1);
    new Uint8Array(f.memory, otherTexels, f.bytes).fill(0x1f);
    f.set(f.program + 1700, other);
    f.bridge.call(0x30001, f.desc, 0); await f.flush();
    assert.strictEqual(f.bridge._textureSnapshots.size, 1, 'the budget evicts rather than grows');
    assert.ok(f.bridge._textureSnapshots.has(other + 64), 'and keeps the one just used');
    assert.strictEqual(f.bridge._textureSnapshotBytes, 16 * 16 * 4, 'the charge follows the eviction');

    // A level too big for the whole budget is drawn but never kept: keeping it
    // would evict everything and then be evicted itself on the next draw.
    const big = fixture({ maxTextureSnapshotBytes: 512 }, 16, 16);
    new Uint8Array(big.memory, big.texels, big.bytes).fill(0x5a);
    big.initialized.resolve(); await tick();
    big.bridge.call(0x30001, big.desc, 0); await big.flush();
    assert.strictEqual(big.bridge._textureSnapshots.size, 0, 'an oversized level is not kept');
    assert.strictEqual(big.bridge._textureSnapshotBytes, 0);
    assert.deepStrictEqual(Array.from(drawnPixels(draws(big)[0]).slice(0, 4)), [90, 73, 214, 255],
      'and is still drawn correctly');
    await f.bridge.close(); await big.bridge.close();
  }

  // ---- The WAT half: unlock is what bumps the sequence ------------------
  if (!jsOnly) {
    const { exports: e } = await bootRenderHarness({ fonts: 'none', extraWat: `
      (func (export "new_device") (result i32)
        (local $device i32)
        (local.set $device (call $dx_create_com_obj (i32.const 20) (global.get $DX_VTBL_D3DDEV9)))
        (store.field DxObject misc1 (call $dx_from_this (local.get $device)) (call $d3d9_program_alloc))
        (local.get $device))
      (func (export "texture") (param $d i32) (param $w i32) (param $h i32) (param $out i32) (result i32)
        (call $d3d9_texture_create (local.get $d) (local.get $w) (local.get $h) (i32.const 1)
          (i32.const 0) (i32.const 21) (i32.const 1) (local.get $out)) (i32.load offset=0 (global.get $reg_base)))
      (func (export "lock") (param $t i32) (param $level i32) (param $out i32) (result i32)
        (call $d3d9_texture_lock (local.get $t) (local.get $level) (local.get $out) (i32.const 0) (i32.const 0))
        (i32.load offset=0 (global.get $reg_base)))
      (func (export "unlock") (param $t i32) (param $level i32) (result i32)
        (call $handle_IDirect3DTexture9_UnlockRect (local.get $t) (local.get $level) (i32.const 0)
          (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
      (func (export "dirty_seq") (param $t i32) (param $level i32) (result i32)
        (i32.load offset=28 (call $d3d9_texture_mip (local.get $t) (local.get $level))))
    ` });
    e.init_dx_com_thunks();
    const d = e.new_device(), out = 0x00409000, locked = out + 128;
    assert.strictEqual(e.texture(d, 8, 8, out), 0);
    const t = e.guest_read32(out) >>> 0;

    // The lock itself does NOT bump it, and does not need to: the draw path
    // refuses a locked level outright ('cannot draw from locked texture'), so
    // no snapshot can be taken while the guest holds a writable pointer. The
    // unlock is where a written level becomes drawable again, and it is the
    // bump that matters. Pinned here because the cache silently depends on it.
    const before = e.dirty_seq(t, 0) >>> 0;
    assert.strictEqual(e.lock(t, 0, locked), 0, 'the level locks');
    assert.strictEqual(e.dirty_seq(t, 0) >>> 0, before,
      'a lock alone does not bump -- the level is undrawable while it is held');
    assert.strictEqual(e.unlock(t, 0), 0);
    const after = e.dirty_seq(t, 0) >>> 0;
    assert.ok(after !== before && after !== 0,
      'releasing a written level stamps a fresh nonzero dirty serial');

    // A refused call must not invalidate anything: a cache that threw away a
    // good snapshot for one would pay the decode again for nothing.
    const armed = e.dirty_seq(t, 0) >>> 0;
    assert.strictEqual(e.unlock(t, 0) >>> 0, 0x8876086c, 'unlocking twice fails');
    assert.strictEqual(e.dirty_seq(t, 0) >>> 0, armed, 'and bumps nothing');
    assert.strictEqual(e.lock(t, 4, locked) >>> 0, 0x8876086c, 'an out-of-range level fails');
    assert.strictEqual(e.dirty_seq(t, 0) >>> 0, armed, 'and bumps nothing either');
  }

  // ---- The dirty serial is the whole identity (slice 9.1) -------------
  {
    // Every guest write path ends in $d3d9_texture_touch, which stamps the
    // level with a process-unique serial; the host never reads the source to
    // decide, so an unstamped change is (by contract) not a change, and a
    // stamped one always decodes again even if no other metadata moved.
    const f = fixture({}, 256, 256);
    new Uint8Array(f.memory, f.texels, f.bytes).fill(0x5a);
    f.initialized.resolve(); await tick();
    f.bridge.call(0x30001, f.desc, 0); await f.flush();
    const kept = f.bridge._textureSnapshots.get(f.mip).pixels;
    new Uint8Array(f.memory, f.texels + 1000, 64).fill(0x1f);
    f.bridge.call(0x30001, f.desc, 0); await f.flush();
    assert.strictEqual(f.bridge._textureSnapshots.get(f.mip).pixels, kept,
      'a clean level is neither re-read nor re-decoded');
    f.set(f.mip + 28, 0x5eed0001);
    f.bridge.call(0x30001, f.desc, 0); await f.flush();
    const fresh = f.bridge._textureSnapshots.get(f.mip).pixels;
    assert.notStrictEqual(fresh, kept, 'a new serial forces a fresh decode');
    assert.deepStrictEqual(Array.from(fresh.slice(2000, 2004)), [24, 227, 255, 255],
      'and the decode sees the bytes written before the stamp');
    await f.bridge.close();
  }

  console.log('PASS test-d3d9-texture-snapshot-cache' + (jsOnly ? ' JS-only; WAT omitted' : ''));
})().catch(error => { console.error(error); process.exit(1); });
