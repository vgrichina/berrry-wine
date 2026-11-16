'use strict';

// Actual owning WASM adapters -> actual filesystem/VFS -> real GPU readback:
// the WAT GPU stream producer (src/09abg-d3dim-gps.wat) drained into the
// real software executor (lib/gpu-stream-software.js). GPU pixels are a
// producer clear; readbacks are the producer's own count.
// Optional --adapter-source supplies an immutable pre-fix adapter for the
// negative control; the normal test always compiles the production closure.
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { createFilesystemImports, VirtualFS } = require('../lib/filesystem');
const GS = require('../lib/gpu-stream');
const { Executor: SoftwareExecutor } = require('../lib/gpu-stream-software');

const extraWat = `
(func (export "file_surface") (result i32)
  (local $this i32) (local $entry i32)
  (local.set $this (call $dx_create_com_obj (i32.const 2) (i32.const 0)))
  (local.set $entry (call $dx_from_this (local.get $this)))
  (store.field DxObject width (local.get $entry) (i32.const 8))
  (store.field DxObject height (local.get $entry) (i32.const 1))
  (store.field DxObject bpp (local.get $entry) (i32.const 16))
  (store.field DxObject pitch (local.get $entry) (i32.const 16))
  (store.field DxObject flags (local.get $entry) (i32.const 0))
  (store.field DxObject misc1 (local.get $entry)
    (i32.add (global.get $DIB_BACKING_BASE) (i32.const 4096)))
  (call $dx_surf_fmt_set (local.get $entry) (i32.const 1))
  (local.get $this))
(func (export "file_dib") (result i32)
  (i32.add (global.get $DIB_BACKING_BASE) (i32.const 4096)))
(func (export "file_ga") (result i32)
  (i32.add (global.get $DIB_GUEST_BASE) (i32.const 4096)))
(func (export "file_arm") (param $this i32)
  (global.set $d3dim_gpu_on (i32.const 1))
  (global.set $d3dim_lazy_on (i32.const 1))
  (global.set $d3dim_worker_pending (i32.const 1))
  (call $d3dim_lock_fence (call $dx_from_this (local.get $this))))
(func (export "file_flush") (call $d3dim_worker_fence))
;; A GPU colour clear of columns [x, x+w) through the producer's own 0x20004
;; lowering (as test-d3dim-surface-fence.js; flag 4 stands in for a draw).
(func (export "file_paint") (param $this i32) (param $color i32) (param $x i32) (param $w i32) (result i32)
  (local $entry i32) (local $pb i32) (local $t i32) (local $ga i32) (local $d i32) (local $r i32)
  (global.set $d3dim_gpu_on (i32.const 1))
  (local.set $entry (call $dx_from_this (local.get $this)))
  (call $lock_acquire (global.get $D3DIM_GPS))
  (local.set $pb (call $d3g_pb))
  (local.set $t (call $d3g_target (local.get $pb) (local.get $entry)
    (load.field DxObject misc1 (local.get $entry)) (load.field DxObject width (local.get $entry))
    (load.field DxObject height (local.get $entry)) (load.field DxObject bpp (local.get $entry))
    (load.field DxObject pitch (local.get $entry)) (call $dx_surf_fmt_get (local.get $entry))))
  (if (local.get $t) (then
    (i32.store offset=32 (local.get $t) (i32.or (i32.load offset=32 (local.get $t)) (i32.const 4)))))
  (call $lock_release (global.get $D3DIM_GPS))
  (local.set $ga (call $heap_alloc (i32.const 64)))
  (local.set $d (call $g2w (local.get $ga)))
  (memory.fill (local.get $d) (i32.const 0) (i32.const 64))
  (i32.store offset=0 (local.get $d) (local.get $entry))
  (i32.store offset=4 (local.get $d) (i32.const 1))
  (i32.store offset=8 (local.get $d) (local.get $color))
  (i32.store offset=16 (local.get $d) (local.get $x))
  (i32.store offset=24 (local.get $d) (local.get $w))
  (i32.store offset=28 (local.get $d) (load.field DxObject height (local.get $entry)))
  (local.set $r (call $d3dim_gpu_call (i32.const 0x20004) (local.get $d) (i32.const 0)))
  (call $heap_free (local.get $ga))
  (local.get $r))
(func (export "file_range") (param $a i32) (param $n i32)
  (call $d3dim_host_write_fence (local.get $a) (local.get $n)))
(func (export "file_read") (param $kind i32) (param $thread i32)
  (param $h i32) (param $buf i32) (param $n i32) (param $out i32)
  (param $off i32) (result i32)
  (global.set $current_thread_id (local.get $thread))
  (if (i32.eq (local.get $kind) (i32.const 1)) (then
    (return (call $host_fs_read_file (local.get $h) (local.get $buf)
      (local.get $n) (local.get $out)))))
  (if (i32.eq (local.get $kind) (i32.const 2)) (then
    (return (call $host_fs_read_file_at (local.get $h) (local.get $buf)
      (local.get $n) (local.get $out) (local.get $off) (i32.const 0)))))
  (call $host_fs_read_file_result (local.get $h) (local.get $buf)
    (local.get $n) (local.get $out)))
`;

async function main() {
  const override = process.argv.find(arg => arg.startsWith('--adapter-source='));
  const adapter = override ? fs.readFileSync(override.slice('--adapter-source='.length), 'utf8') : null;
  const binary = compileSrcWasm((name, source) => {
    if (name === '13-exports.wat') return source + '\n' + extraWat;
    if (name === '09a0b-handlers-base-late.wat' && adapter) return adapter;
    return source;
  });
  console.log('test-module-sha256=' + crypto.createHash('sha256').update(binary).digest('hex'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, resourceJson: {}, onExit() {} };
  const imports = createHostImports(ctx);
  imports.host.memory = memory;
  const vfs = new VirtualFS();
  const pageCtx = { getMemory: () => memory.buffer, vfs };
  const files = createFilesystemImports(pageCtx);
  const forwarding = [];
  for (const name of ['fs_read_file', 'fs_read_file_at', 'fs_read_file_result']) {
    imports.host[name] = (...args) => {
      forwarding.push([name, args.at(-1)]);
      return files[name](...args);
    };
  }
  let ex, gps = null, ring = null, ringAddr = 0, kicks = 0, shadowKicks = 0;
  const hostCalls = [];
  imports.host.gpu_gl_call = (...args) => { hostCalls.push(args[0]); return 0; };
  imports.host.gpu_stream_kick = (r, mode) => {
    r >>>= 0; kicks++;
    if (!gps) gps = new SoftwareExecutor({ getExports: () => ex, getMemory: () => memory.buffer });
    if (!ring || ringAddr !== r) { ring = new GS.Ring(() => memory.buffer, r); ringAddr = r; }
    GS.drain([ring], gps);
    if ((mode | 0) === GS.CONST.KICK_CLOSE) { gps.close(); gps = null; ring = null; ringAddr = 0; }
    return 1;
  };
  const { instance, module } = await WebAssembly.instantiate(binary, imports);
  ex = instance.exports;
  ctx.exports = ex;
  // This is the page shadow, which must never execute GPU readback. Its real
  // invalidate_code_range export remains the unchanged d3ec2640 bypass.
  const shadow = await WebAssembly.instantiate(module, {
    host: { ...imports.host, gpu_gl_call() { throw Error('shadow GPU execution'); },
      gpu_stream_kick() { shadowKicks++; throw Error('shadow GPU stream execution'); } },
    gdi: imports.gdi,
  });
  pageCtx.exports = shadow.exports;
  const surface = ex.file_surface(), dib = ex.file_dib() >>> 0, ga = ex.file_ga() >>> 0;
  const bytes = new Uint8Array(memory.buffer), view = new DataView(memory.buffer);
  // The GPU holds RED: RGB565 0xf800 in every pixel.
  const RED = 0xffff0000;
  const readbacks = () => ex.d3dim_gps_stat(2);
  const gpuBytes = Array.from({ length: 16 }, (_, i) => i % 2 ? 248 : 0);
  const payload = Uint8Array.from([11, 22, 33, 44, 55, 66, 77, 88]);
  vfs.files.set('c:\\input.bin', { data: payload, attrs: 0x20 });
  const open = () => vfs.createFile('c:\\input.bin', 0x80000000, 3);
  const arm = () => {
    bytes.fill(0xcc, dib, dib + 16);
    assert.strictEqual(ex.file_paint(surface, RED, 0, 8), 1, 'the producer takes the clear');
    ex.file_arm(surface);
  };
  const read = (kind, h, dst, n, out = ga + 64, off = 0, thread = 7) =>
    ex.file_read(kind, thread, h, dst, n, out, off);

  for (const kind of [0, 1, 2]) {
    const h = open();
    arm();
    const start = readbacks();
    assert.strictEqual(read(kind, h, ga + 2, 4, ga + 64, kind === 2 ? 2 : 0), kind === 1 ? 1 : 0);
    ex.file_flush();
    const expected = gpuBytes.slice();
    expected.splice(2, 4, ...payload.slice(kind === 2 ? 2 : 0, kind === 2 ? 6 : 4));
    assert.deepStrictEqual(Array.from(bytes.slice(dib, dib + 16)), expected,
      'host file bytes survive later GPU fence; untouched pixels reflect GPU');
    assert.strictEqual(readbacks(), start + 1);
    assert.strictEqual(view.getUint32(dib + 64, true), 4);
    assert.strictEqual(vfs.getOpenFile(h).pos, kind === 2 ? 0 : 4);
  }
  // Count output itself is a host write even for errors or no payload.
  for (const [h, n, error] of [[open(), 0, 0], [open(), -1, 0], [0xdead, 4, 6]]) {
    arm();
    assert.strictEqual(read(0, h, ga + 64, n, ga + 4), error);
    ex.file_flush();
    assert.strictEqual(view.getUint32(dib + 4, true), 0);
    assert.deepStrictEqual(Array.from(bytes.slice(dib, dib + 4)), gpuBytes.slice(0, 4));
  }
  arm();
  const outside = readbacks();
  assert.strictEqual(read(0, open(), ga + 64, 4), 0);
  assert.strictEqual(readbacks(), outside, 'nonoverlap leaves lazy range armed');
  ex.file_flush();
  arm();
  assert.strictEqual(read(0, open(), ga - 2, 4), 0);
  ex.file_flush();
  assert.deepStrictEqual(Array.from(bytes.slice(dib - 2, dib + 2)), [11, 22, 33, 44],
    'range starting outside armed surface still fences overlap');

  // Real provider/VFS partial-copy park and identical retry; no fake imports.
  let resident = false;
  const requests = [];
  const provider = { size: 8, chunkSize: 4, maxChunks: 2,
    tryRead(off, n) { requests.push([off, n]); return off >= 4 && !resident ? null : payload.slice(off, off + n); },
    async fill() { resident = true; },
  };
  vfs.setProviderFile('c:\\lazy.bin', { provider, length: 8 });
  const lazy = vfs.createFile('c:\\lazy.bin', 0x80000000, 3);
  arm();
  assert.strictEqual(read(0, lazy, ga, 8), 997);
  assert.strictEqual(vfs.getOpenFile(lazy).pos, 0);
  assert.strictEqual(view.getUint32(dib + 64, true), 0);
  assert(vfs.getPendingRead(7));
  assert.strictEqual(vfs.getPendingRead(1), null);
  assert.strictEqual(vfs.getIoState(7)._readProgress.bytesRead, 4);
  ex.file_flush();
  assert.deepStrictEqual(Array.from(bytes.slice(dib, dib + 4)), Array.from(payload.slice(0, 4)));
  assert.strictEqual(await vfs.fillPendingRead(vfs.getPendingRead(7)), true);
  // A subsequent GPU use that has consumed the CPU-written prefix: a clear
  // of pixels 2..7 uploads the DIB (prefix included) first. Its still-pending
  // readback must precede the retry suffix. This is not a demand to preserve
  // old CPU bytes against a legitimate different GPU draw.
  assert.strictEqual(ex.file_paint(surface, RED, 2, 6), 1);
  ex.file_arm(surface);
  const retryReadbacks = readbacks();
  const retryAt = requests.length;
  assert.strictEqual(read(0, lazy, ga, 8), 0);
  assert.strictEqual(readbacks(), retryReadbacks + 1, 'newly armed target materialized before retry suffix');
  ex.file_flush();
  assert.deepStrictEqual(requests.slice(retryAt), [[4, 4]], 'retry resumes after already copied prefix');
  assert.strictEqual(vfs.getOpenFile(lazy).pos, 8);
  assert.strictEqual(view.getUint32(dib + 64, true), 8);
  assert.deepStrictEqual(Array.from(bytes.slice(dib, dib + 8)), Array.from(payload));
  assert.strictEqual(read(2, open(), ga + 64, 2, ga + 80, 8), 38);
  const brokenProvider = { size: 4, tryRead() { return null; },
    async fill() { throw Error('expected unavailable range'); } };
  vfs.setProviderFile('c:\\broken.bin', { provider: brokenProvider, length: 4 });
  const broken = vfs.createFile('c:\\broken.bin', 0x80000000, 3);
  arm();
  assert.strictEqual(read(0, broken, ga, 4, ga + 8), 997);
  assert.strictEqual(await vfs.fillPendingRead(vfs.getPendingRead(7)), false);
  ex.file_arm(surface);
  assert.strictEqual(read(0, broken, ga, 4, ga + 8), 30);
  assert.strictEqual(view.getUint32(dib + 8, true), 0);
  assert.strictEqual(vfs.getOpenFile(broken).pos, 0);
  assert.strictEqual(vfs.getPendingRead(7), null);
  assert(forwarding.every(([, thread]) => thread === 7), 'owning thread reaches every actual import');

  // Pure fence interval cases: no enormous filesystem read or invented
  // successful invalid mapping. Existing uint32 wrap is exercised directly.
  arm();
  const wrapBefore = readbacks();
  ex.file_range(0xfffffff0, (ga + 32) >>> 0);
  assert.strictEqual(readbacks(), wrapBefore + 1, 'wrapped interval includes armed DIB range');
  arm();
  const windowBefore = readbacks();
  ex.file_range(ga - 4098, 4116);
  assert.strictEqual(readbacks(), windowBefore + 1, 'DIB-window entry is clipped before translating');
  arm();
  const zeroBefore = readbacks();
  ex.file_range(ga, 0);
  ex.file_range(ga - 16, 16);
  assert.strictEqual(readbacks(), zeroBefore, 'zero and touching ranges do not overlap');
  ex.file_flush();
  assert.deepStrictEqual(hostCalls, [], 'the WAT producer never calls the host gpu_gl_call');
  assert(kicks > 0, 'records went through the GPU stream consumer');
  assert.strictEqual(shadowKicks, 0, 'the page shadow never drives the GPU stream');
  console.log('PASS: actual owner/shadow filesystem reads, GPU pixels, count outputs, overlap/wrap, pending997 retry and thread/file-position contracts');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
