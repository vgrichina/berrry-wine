'use strict';
const assert = require('assert');
const { D3DIMGpu, OPCODES } = require('../lib/d3dim-gpu');
const { bootRenderHarness } = require('./render-helper');

async function main() {
  const memory = new ArrayBuffer(65536), bytes = new Uint8Array(memory);
  const reads = [], writes = [];
  const gpu = new D3DIMGpu({ getMemory: () => memory,
    getExports: () => ({ page_watch_write: (a, n) => writes.push([a, n]) }),
    createCanvas: () => { throw Error('unexpected allocation'); } });
  function target(id, dib) {
    const t = { rt: id, dib, width: 2, height: 1, pitch: 4, bpp: 16,
      format: 1, dirty: true, device: { gpu: { bindImplicitTarget() {}, gl: {
        RGBA: 1, UNSIGNED_BYTE: 2,
        readPixels(x, y, w, h, f, ty, out) {
          reads.push(id); out.set([255, 0, 0, 255, 0, 255, 0, 255]);
        },
      } } } };
    gpu.targets.set(id, t); return t;
  }
  const a = target(1, 4096), b = target(2, 8192);
  assert.strictEqual(gpu.call(OPCODES.FENCE, 16384, 4), 2);
  assert.deepStrictEqual(reads, [], 'unrelated surface leaves GPU targets alone');
  assert(a.dirty && b.dirty);
  assert.strictEqual(gpu.call(OPCODES.FENCE, 4098, 1), 2);
  assert.deepStrictEqual(reads, [1], 'partial backing alias synchronizes its target');
  assert(!a.dirty && b.dirty, 'other target remains pending');
  assert.deepStrictEqual(Array.from(bytes.slice(4096, 4100)), [0, 248, 224, 7]);
  assert.deepStrictEqual(writes, [[4096, 4]], 'readback marks changed backing bytes');
  gpu.call(OPCODES.FENCE, 8188, 4);
  assert(b.dirty, 'touching but nonoverlapping range is not an alias');
  assert.strictEqual(gpu.call(OPCODES.FENCE, 0, 0), 1);
  assert.deepStrictEqual(reads, [1, 2], 'global barrier still flushes remaining target');
  gpu.call(OPCODES.FENCE, 0, 0);
  assert.strictEqual(reads.length, 2, 'clean targets need no readback');

  const calls = [];
  let reply = 2;
  let executor;
  let sharedPublish = true;
  const harness = await bootRenderHarness({ fonts: 'none',
    extraHostOverrides: { gpu_gl_call: (...args) => {
      if (args[0] === 0x20007) return sharedPublish ? 1 : 0;
      calls.push(args); return executor ? executor.call(...args) : reply;
    } },
    extraWat: `
      (func (export "test_lazy_float") (param $wa i32) (param $pipeline i32) (result i32)
        (if (local.get $pipeline) (then
          (return (i32.reinterpret_f32 (f32.demote_f64
            (call $x87_pipeline_load (call $w2g (local.get $wa)) (i32.const 0)))))))
        (call $fpu_exec_mem (i32.const 1) (i32.const 0) (call $w2g (local.get $wa)))
        (i32.reinterpret_f32 (f32.demote_f64 (call $fpu_pop))))
      (func (export "test_lazy_wide") (param $wa i32) (param $pipeline i32) (result i64)
        (if (local.get $pipeline) (then
          (return (i64.reinterpret_f64 (call $x87_pipeline_load (call $w2g (local.get $wa)) (i32.const 1))))))
        (call $fpu_exec_mem (i32.const 5) (i32.const 0) (call $w2g (local.get $wa)))
        (i64.reinterpret_f64 (call $fpu_pop)))
      (func (export "test_lazy_replace") (param $this i32) (param $dib i32) (param $pitch i32) (param $size i32)
        (local $ga i32) (local $wa i32)
        (local.set $ga (call $heap_alloc (i32.const 108)))
        (local.set $wa (call $g2w (local.get $ga)))
        (memory.fill (local.get $wa) (i32.const 0) (i32.const 108))
        (i32.store (local.get $wa) (local.get $size))
        (i32.store offset=4 (local.get $wa) (i32.const 0x808))
        (i32.store offset=16 (local.get $wa) (local.get $pitch))
        (i32.store offset=36 (local.get $wa) (call $w2g (local.get $dib)))
        (call $handle_IDirectDrawSurface3_SetSurfaceDesc (local.get $this) (local.get $ga)
          (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
      (func (export "test_lazy_surface") (param $this i32) (result i32)
        (local $entry i32) (local $dib i32)
        (local.set $entry (call $dx_from_this (local.get $this)))
        (local.set $dib (i32.add (global.get $DIB_BACKING_BASE) (i32.const 4096)))
        (store.field DxObject misc1 (local.get $entry) (local.get $dib))
        (store.field DxObject flags (local.get $entry) (i32.const 0))
        (local.get $dib))
      (func (export "test_lazy_arm") (param $this i32) (param $on i32)
        (global.set $d3dim_lazy_on (local.get $on))
        (global.set $d3dim_gpu_on (i32.const 1))
        (global.set $d3dim_worker_pending (i32.const 1))
        (call $d3dim_lock_fence (call $dx_from_this (local.get $this))))
      (func (export "test_lazy_offset") (param $this i32) (param $offset i32)
        (store.field DxObject misc1 (call $dx_from_this (local.get $this))
          (i32.add (i32.add (global.get $DIB_BACKING_BASE) (i32.const 4096)) (local.get $offset))))
      (func (export "test_lazy_unlock") (param $this i32) (result i32)
        (call $d3dim_lazy_unlock (call $dx_from_this (local.get $this))))
      (func (export "test_lazy_scope") (param $this i32) (param $gpu i32) (result i32)
        (global.set $d3dim_gpu_on (local.get $gpu))
        (global.set $d3dim_worker_pending (i32.const 1))
        (call $d3dim_surface_fence (call $dx_from_this (local.get $this)))
        (global.get $d3dim_worker_pending))
      (func (export "test_lazy_access") (param $wa i32) (param $kind i32) (result i32)
        (local $ga i32)
        (local.set $ga (call $w2g (local.get $wa)))
        (if (i32.eq (local.get $kind) (i32.const 1)) (then
          (call $gs16 (local.get $ga) (i32.const 0x1234)) (return (i32.const 0))))
        (if (i32.eq (local.get $kind) (i32.const 2)) (then
          (return (i32.load16_u (call $g2w_affine_span (local.get $ga) (i32.const 4))))))
        (call $gl16 (local.get $ga)))
      (func (export "test_lazy_epoch") (result i32) (i32.atomic.load (global.get $UOP_WIN_EPOCH)))
      (func (export "test_surface_fence") (param $gpu i32) (param $pending i32) (result i32)
        (global.set $d3dim_gpu_on (local.get $gpu))
        (global.set $d3dim_worker_pending (local.get $pending))
        (store.field DxObject misc1 (global.get $DX_OBJECTS) (i32.const 4096))
        (store.field DxObject pitch (global.get $DX_OBJECTS) (i32.const 1280))
        (store.field DxObject height (global.get $DX_OBJECTS) (i32.const 480))
        (call $d3dim_surface_fence (global.get $DX_OBJECTS))
        (global.get $d3dim_worker_pending))
      (func (export "test_global_fence") (result i32)
        (call $d3dim_worker_fence) (global.get $d3dim_worker_pending))
      (func (export "test_fence_surface") (result i32)
        (local $this i32) (local $entry i32)
        (local.set $this (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF3)))
        (local.set $entry (call $dx_from_this (local.get $this)))
        (store.field DxObject width (local.get $entry) (i32.const 2))
        (store.field DxObject height (local.get $entry) (i32.const 1))
        (store.field DxObject bpp (local.get $entry) (i32.const 16))
        (store.field DxObject pitch (local.get $entry) (i32.const 4))
        (store.field DxObject misc1 (local.get $entry) (call $g2w (call $heap_alloc (i32.const 4))))
        (call $dx_surf_fmt_set (local.get $entry) (i32.const 1))
        (local.get $this))
      (func (export "test_fence_dib") (param $this i32) (result i32)
        (load.field DxObject misc1 (call $dx_from_this (local.get $this))))
      (func (export "test_fence_pitch") (param $this i32) (result i32)
        (load.field DxObject pitch (call $dx_from_this (local.get $this))))
      (func (export "test_fence_load") (param $dst i32) (param $src i32)
        (global.set $d3dim_gpu_on (i32.const 1))
        (global.set $d3dim_worker_pending (i32.const 1))
        (call $d3dim_texture_load (local.get $dst) (local.get $src)))
      (func (export "test_fence_release") (param $this i32) (param $gpu i32) (param $refs i32) (result i32)
        (global.set $d3dim_gpu_on (local.get $gpu))
        (global.set $d3dim_worker_pending (i32.const 1))
        (store.field DxObject refcount (call $dx_from_this (local.get $this)) (local.get $refs))
        (call $d3dim_texture_view_release (local.get $this))
        (i32.load (global.get $reg_base)))
    ` });
  const { exports: ex, memory: wasmMemory } = harness;
  // A zero vtable with uninitialized native tables accidentally compares equal
  // to Surface4/7. Initialize COM and explicitly select Surface3 (108-byte ABI).
  const pe = require('fs').readFileSync(require('path').join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(wasmMemory.buffer).set(pe, ex.get_staging());
  assert(ex.load_pe(pe.length));
  ex.init_dx_com_thunks();
  const other = (await WebAssembly.instantiate(harness.module, { host: harness.host, gdi: harness.gdi })).exports;
  assert.strictEqual(ex.test_surface_fence(1, 1), 1, 'scoped fence preserves global pending state');
  assert.deepStrictEqual(calls.pop(), [OPCODES.FENCE, 4096, 614400]);
  assert.strictEqual(ex.test_global_fence(), 0);
  assert.deepStrictEqual(calls.pop(), [OPCODES.FENCE, 0, 0]);
  assert.strictEqual(ex.test_surface_fence(0, 1), 0, 'software Worker keeps global fence');
  assert.deepStrictEqual(calls.pop(), [OPCODES.FENCE, 0, 0]);
  assert.strictEqual(ex.test_surface_fence(1, 0), 0);
  assert.deepStrictEqual(calls, [], 'no outstanding GPU work means no host call');
  reply = 1;
  assert.strictEqual(ex.test_surface_fence(1, 1), 0, 'all targets clean clears pending');
  calls.pop();
  assert.strictEqual(ex.test_global_fence(), 0);
  assert.deepStrictEqual(calls, [], 'no redundant global barrier after full synchronization');
  const src = ex.test_fence_surface(), dst = ex.test_fence_surface();
  const srcDib = ex.test_fence_dib(src), dstDib = ex.test_fence_dib(dst);
  executor = new D3DIMGpu({ getMemory: () => wasmMemory.buffer,
    getExports: () => ({}), createCanvas: () => null });
  executor.targets.set(1, { ...a, dib: srcDib, dirty: true });
  executor.targets.set(2, { ...b, dib: dstDib, dirty: true,
    device: { gpu: { bindImplicitTarget() {}, gl: {
      RGBA: 1, UNSIGNED_BYTE: 2,
      readPixels(x, y, w, h, f, ty, out) { out.set([0, 0, 255, 255, 0, 0, 255, 255]); },
    } } } });
  ex.test_fence_load(dst, src);
  assert.deepStrictEqual(calls, [[OPCODES.FENCE, srcDib, 4], [OPCODES.FENCE, dstDib, 4]],
    'Texture::Load synchronizes both source and destination backing');
  assert.deepStrictEqual(Array.from(new Uint8Array(wasmMemory.buffer, dstDib, 4)), [0, 248, 224, 7],
    'texture copy consumes fresh GPU pixels rather than stale CPU source');
  executor = null; calls.length = 0;
  assert.strictEqual(ex.test_fence_release(src, 1, 2), 1);
  assert.deepStrictEqual(calls, [], 'nonfinal WebGL texture view release needs no readback');
  assert.strictEqual(ex.test_fence_release(src, 0, 2), 1);
  assert.deepStrictEqual(calls.splice(0), [[OPCODES.FENCE, 0, 0]], 'software release still drains queued work');
  assert.strictEqual(ex.test_fence_release(src, 1, 1), 0);
  assert.deepStrictEqual(calls, [[OPCODES.FENCE, 0, 0]], 'final release retains global lifetime barrier');
  calls.length = 0;
  const lazy = ex.test_fence_surface(), lazyDib = ex.test_lazy_surface(lazy);
  const pixels = new Uint8Array(wasmMemory.buffer, lazyDib, 4);
  executor = new D3DIMGpu({ getMemory: () => wasmMemory.buffer,
    getExports: () => ({}), createCanvas: () => null });
  const lazyTarget = { ...a, dib: lazyDib, dirty: true };
  executor.targets.set(3, lazyTarget);
  const epoch = ex.test_lazy_epoch();
  ex.test_lazy_arm(lazy, 1);
  assert.notStrictEqual(ex.test_lazy_epoch(), epoch, 'arm invalidates cached native read windows');
  assert.deepStrictEqual(calls, [], 'Lock defers readback');
  assert.equal(ex.test_lazy_unlock(lazy), 1, 'untouched Unlock drops only the access barrier');
  assert(lazyTarget.dirty, 'GPU contents remain authoritative');
  assert.deepStrictEqual(calls, [], 'untouched lock cycle has no readback');
  // Two GPU targets: a scoped readback may return 2 even though this surface
  // is fully synchronized. Do not issue the identical producer barrier twice.
  const unrelatedTarget = { ...b, dib: lazyDib + 4096, dirty: true };
  executor.targets.set(4, unrelatedTarget);
  ex.test_lazy_arm(lazy, 1);
  assert.equal(ex.test_lazy_scope(lazy, 1), 1, 'other target keeps pending state');
  assert.equal(calls.length, 1, 'shared scoped readback is not repeated by producer');
  assert(!lazyTarget.dirty && unrelatedTarget.dirty, 'only requested surface synchronized');
  calls.length = 0; lazyTarget.dirty = true;
  ex.test_lazy_arm(lazy, 1);
  assert.equal(other.test_lazy_scope(lazy, 1), 1);
  assert.equal(calls.length, 1, 'foreign producer also avoids the duplicate scoped barrier');
  calls.length = 0; lazyTarget.dirty = true;
  ex.test_lazy_arm(lazy, 1);
  assert.equal(ex.test_lazy_scope(lazy, 0), 0, 'software path still completes its global barrier');
  assert(!lazyTarget.dirty && !unrelatedTarget.dirty);
  assert(calls.some(call => call[1] === 0 && call[2] === 0), 'software fallback synchronizes all targets');
  executor.targets.delete(4);
  calls.length = 0; lazyTarget.dirty = true;
  ex.test_lazy_arm(lazy, 1);
  ex.test_lazy_access(lazyDib + 4096, 0);
  assert.deepStrictEqual(calls, [], 'unrelated DIB read does not synchronize');
  assert.equal(ex.test_lazy_access(lazyDib, 0), 0xf800, 'first read sees fresh GPU pixels');
  assert.equal(calls.length, 1);
  ex.test_lazy_access(lazyDib + 2, 0);
  assert.equal(calls.length, 1, 'subsequent accesses need no barrier');
  assert.equal(ex.test_lazy_unlock(lazy), 0);
  calls.length = 0; lazyTarget.dirty = true; pixels.fill(0);
  ex.test_lazy_arm(lazy, 1);
  ex.test_lazy_access(lazyDib, 1);
  assert.deepStrictEqual(Array.from(pixels), [0x34, 0x12, 0xe0, 7],
    'partial write happens AFTER readback and preserves untouched GPU pixels');
  assert.equal(calls.length, 1);
  calls.length = 0; lazyTarget.dirty = true; pixels.fill(0);
  ex.test_lazy_arm(lazy, 1);
  assert.equal(ex.test_lazy_access(lazyDib, 2), 0xf800, 'native span proof synchronizes too');
  assert.equal(calls.length, 1);
  calls.length = 0; lazyTarget.dirty = true;
  ex.test_lazy_arm(lazy, 0);
  assert.equal(calls.length, 1, 'option off preserves eager Lock');
  calls.length = 0; lazyTarget.dirty = true;
  ex.test_lazy_arm(lazy, 1);
  ex.test_global_fence();
  assert.equal(calls.length, 1, 'global barrier flushes deferred target');
  assert.equal(ex.test_lazy_unlock(lazy), 0, 'global barrier disarms stale range');
  for (const pipeline of [0, 1]) {
    calls.length = 0; lazyTarget.dirty = true;
    new Uint8Array(wasmMemory.buffer, lazyDib - 2, 6).fill(0);
    ex.test_lazy_arm(lazy, 1);
    assert.equal(ex.test_lazy_float(lazyDib - 2, pipeline) >>> 0, 0xf8000000,
      'baseline and folded float32 reads synchronize across the surface start');
    assert.equal(calls.length, 1);
    calls.length = 0; lazyTarget.dirty = true;
    new Uint8Array(wasmMemory.buffer, lazyDib - 4, 8).fill(0);
    ex.test_lazy_arm(lazy, 1);
    assert.equal(ex.test_lazy_wide(lazyDib - 4, pipeline), 0x07e0f80000000000n,
      'baseline and folded wide reads synchronize before crossing an aligned surface start');
    assert.equal(calls.length, 1);
  }
  for (const kind of [0, 1, 2]) {
    calls.length = 0; lazyTarget.dirty = true; pixels.fill(0);
    ex.test_lazy_arm(lazy, 1);
    const value = other.test_lazy_access(lazyDib, kind);
    if (kind !== 1) assert.equal(value, 0xf800, 'foreign instance sees fresh pixels');
    assert.equal(ex.test_lazy_unlock(lazy), 0, 'foreign touch is visible to locking thread');
    ex.test_global_fence();
    assert.equal(new Uint16Array(pixels.buffer, pixels.byteOffset, 2)[0], kind === 1 ? 0x1234 : 0xf800,
      'later owner fence preserves foreign writes');
  }
  calls.length = 0; lazyTarget.dirty = true; pixels.fill(0);
  ex.test_lazy_arm(lazy, 1); ex.test_lazy_unlock(lazy);
  for (const size of [0, 124]) {
    ex.test_lazy_replace(lazy, lazyDib + 4096, 8, size);
    assert.equal(ex.get_eax() >>> 0, 0x80070057, 'invalid Surface3 descriptor size is rejected');
    assert.deepStrictEqual(calls, [], 'invalid descriptor does not consume pending work');
    assert.equal(ex.test_fence_dib(lazy), lazyDib);
    assert.equal(ex.test_fence_pitch(lazy), 4);
    assert(lazyTarget.dirty);
    assert.deepStrictEqual(Array.from(pixels), [0, 0, 0, 0]);
  }
  const replacement = new Uint8Array(wasmMemory.buffer, lazyDib + 4096, 8);
  replacement.set([0x1f, 0, 0xff, 0xff, 0xa5, 0xa5, 0xa5, 0xa5]);
  ex.test_lazy_replace(lazy, lazyDib + 4096, 8, 108);
  assert.equal(ex.get_eax() >>> 0, 0, 'valid Surface3 descriptor succeeds');
  assert.deepStrictEqual(calls, [[OPCODES.FENCE, lazyDib, 4]],
    'replacement fences the original backing and pitch before changing either');
  assert.deepStrictEqual(Array.from(pixels), [0, 248, 224, 7], 'detached backing contains completed GPU pixels');
  assert.equal(ex.test_fence_dib(lazy), lazyDib + 4096);
  assert.equal(ex.test_fence_pitch(lazy), 8);
  assert.deepStrictEqual(Array.from(replacement), [0x1f, 0, 0xff, 0xff, 0xa5, 0xa5, 0xa5, 0xa5],
    'replacement preserves caller pixels and padded pitch');
  pixels.fill(0x34); ex.test_global_fence();
  assert.deepStrictEqual(Array.from(pixels), [0x34, 0x34, 0x34, 0x34],
    'later fence cannot overwrite the detached allocation after reuse');
  ex.test_lazy_replace(lazy, lazyDib, 4, 108);
  assert.equal(ex.get_eax() >>> 0, 0);
  calls.length = 0; lazyTarget.dirty = true; lazyTarget.dib = lazyDib + 1;
  ex.test_lazy_offset(lazy, 1);
  ex.test_lazy_arm(lazy, 1);
  assert.equal(calls.length, 1, 'unaligned backing remains eager for boundary-straddling scalar accesses');
  ex.test_lazy_offset(lazy, 0); lazyTarget.dib = lazyDib;
  sharedPublish = false; calls.length = 0; lazyTarget.dirty = true;
  const armedBefore = ex.get_d3dim_lazy_armed();
  ex.test_lazy_arm(lazy, 1);
  assert.equal(ex.get_d3dim_lazy_armed(), armedBefore, 'private transport cannot arm a shared range');
  assert.equal(calls.length, 1, 'private transport keeps eager synchronization');
  sharedPublish = true;
  await crossWorkerAccess(harness, executor, lazy, lazyDib, lazyTarget);
  console.log('PASS surface fences: aliases, pixels, dirty state, global/software ordering');
}

async function crossWorkerAccess(harness, gpu, surface, dib, target) {
  const { Worker } = require('worker_threads');
  const workerSource = `
    const {parentPort,workerData}=require('worker_threads');
    const control=new Int32Array(workerData.control),imports={};
    for(const i of WebAssembly.Module.imports(workerData.module)) {
      const ns=imports[i.module]||(imports[i.module]={});
      ns[i.name]=i.kind==='memory'?workerData.memory:i.name==='gpu_gl_call'?(op,wa,len)=>{
        if(op!==0x20001)throw Error('unexpected worker GPU opcode');
        Atomics.store(control,0,0);parentPort.postMessage({t:'fence',wa,len});
        while(!Atomics.load(control,0))Atomics.wait(control,0,0,1000);
        return Atomics.load(control,1);
      }:()=>0;
    }
    WebAssembly.instantiate(workerData.module,imports).then(instance=>{
      parentPort.on('message',m=>{
        parentPort.postMessage({t:'started'});
        try {parentPort.postMessage({t:'done',value:instance.exports.test_lazy_access(m.dib,m.kind)});}
        catch(e){parentPort.postMessage({t:'done',error:String(e)});}
      });
      parentPort.postMessage({t:'ready'});
    });`;
  const workers=[];
  let hold, held;
  try {
    for(let i=0;i<2;i++) {
      const control=new Int32Array(new SharedArrayBuffer(8));
      const w=new Worker(workerSource,{eval:true,workerData:{module:harness.module,memory:harness.memory,control:control.buffer}});
      const peer={w,control};workers.push(peer);
      await new Promise((resolve,reject)=>{
        w.on('error',reject);
        w.on('message',m=>{
          if(m.t==='ready')resolve();
          if(m.t==='started')peer.started?.();
          if(m.t==='done')m.error?peer.reject(Error(m.error)):peer.done(m.value);
          if(m.t==='fence') {
            const complete=()=>{
              Atomics.store(control,1,gpu.fence(m.wa,m.len));
              Atomics.store(control,0,1);Atomics.notify(control,0);
            };
            if(hold){held=complete;hold();hold=null;}else complete();
          }
        });
      });
    }
    const access=(peer,kind)=>new Promise((resolve,reject)=>{
      peer.done=resolve;peer.reject=reject;peer.w.postMessage({dib,kind});
    });
    const ex=harness.exports,pixels=new Uint16Array(harness.memory.buffer,dib,2);
    target.dirty=true;pixels.fill(0);ex.test_lazy_arm(surface,1);
    const waiting=new Promise(resolve=>{hold=resolve;});
    const first=access(workers[0],0);await waiting;
    const started=new Promise(resolve=>{workers[1].started=resolve;});
    let completed=false;
    const second=access(workers[1],0).then(value=>{completed=true;return value;});
    await started;
    await new Promise(resolve=>setTimeout(resolve,30));
    assert(!completed,'second thread cannot read while first readback is parked');
    held();
    assert.deepStrictEqual(await Promise.all([first,second]),[0xf800,0xf800]);
    assert.equal(ex.test_lazy_unlock(surface),0,'foreign touches update owner Unlock');
    target.dirty=true;pixels.fill(0);ex.test_lazy_arm(surface,1);
    await access(workers[1],1);
    assert.equal(ex.test_lazy_unlock(surface),0);
    ex.test_global_fence();
    assert.deepStrictEqual([...pixels],[0x1234,0x07e0],'write-only foreign access preserves GPU pixels and survives owner fence');
  } finally {
    await Promise.all(workers.map(({w})=>w.terminate()));
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
