#!/usr/bin/env node
'use strict';
// Real endpoint/transport/loader JS and resolver. A tiny Wasm fixture supplies
// the PE-mapping/interpreter exports; it does not implement the x86 VM.
const assert = require('assert');
const path = require('path');
const { compileWat } = require('../lib/compile-wat');
const { GuestThreadHost, WorkerLink } = require('../lib/guest-thread-host');
const { ThreadManager } = require('../lib/thread-manager');
const { prepareScopedLibrary } = require('../lib/process-boot');
const { args } = require('./test-thread-send-frame-ownership');

async function fixture(missingExport = '') {
  const fields = ['eip', 'esp', 'ebp', 'eax', 'ebx', 'ecx', 'edx', 'esi', 'edi',
    'handler_set_eip', 'steps', 'yield_reason', 'yield_flag', 'depth', 'dll_count',
    'num_thunks', 'thunk_end', 'mode', 'phase', 'initializations', 'map_fault', 'wait_handle', 'alloc_fail', 'last_run_halt', 'patches',
    'unload_kind', 'unload_module', 'unload_takes', 'inspection_write_fault', 'inspection_api_fault', 'inspection_free_fault'];
  let source = fields.map(n => `
    (global $${n} (mut i32) (i32.const ${n === 'esp' ? 16000 : 0}))
    (func (export "get_${n}") (result i32) (global.get $${n}))
    (func (export "set_${n}") (param $v i32) (global.set $${n} (local.get $v)))`).join('\n') + `
    (import "host" "memory" (memory 8192 8192 shared)) (export "memory" (memory 0))
    (data (i32.const 1024) "test.dll\\00")
    (func (export "get_loadlib_name") (result i32) (i32.const 1024))
    (func (export "get_com_dll_name") (result i32) (i32.const 1024))
    (func (export "get_fs_base") (result i32) (i32.const 0))
    (func (export "get_wait_timeout") (result i32) (i32.const 0))
    (func (export "get_wait_stack_bytes") (result i32) (i32.const 12))
    (func (export "get_send_target_tid") (result i32) (i32.const -2))
    (func (export "get_send_hwnd") (result i32) (i32.const 42))
    (func (export "get_send_msg") (result i32) (i32.const 8))
    (func (export "get_send_wparam") (result i32) (i32.const 0))
    (func (export "get_send_lparam") (result i32) (i32.const 0))
    (func (export "get_image_base") (result i32) (i32.const 4096))
    (func (export "get_sync_table") (result i32) (i32.const ${require('../lib/region-map.generated').BASE.SYNC_TABLE}))
    (func (export "guest_to_wasm") (param $p i32) (result i32) (local.get $p))
    (func (export "get_staging") (result i32) (i32.const 65536))
    (func (export "get_dll_table") (result i32) (i32.const 2048))
    (func (export "get_dll_callback_lock") (result i32) (i32.const 7800))
    (func (export "get_dll_callback_owner") (result i32) (i32.const 1))
    (func (export "take_dll_unload_kind") (result i32) (local $kind i32)
      (global.set $unload_takes (i32.add (global.get $unload_takes) (i32.const 1)))
      (local.set $kind (global.get $unload_kind)) (global.set $unload_kind (i32.const 0)) (local.get $kind))
    (func (export "get_dll_unload_module") (result i32) (global.get $unload_module))
    (func (export "get_dll_unload_exit_code") (result i32) (i32.const 73))
    (func (export "exit_thread_after_dll_unload") (param $code i32)
      (global.set $yield_reason (i32.const 2)) (global.set $eip (i32.const 0)))
    (func (export "get_current_thread_id") (result i32) (i32.const 1))
    (func (export "get_dll_lifecycle_table") (result i32) (i32.const 8192))
    (func (export "get_dll_lifecycle_stride") (result i32) (i32.const 64))
    (func (export "get_dll_index") (param $a i32) (result i32)
      (i32.div_u (i32.sub (local.get $a) (i32.const 131072)) (i32.const 65536)))
    (func (export "complete_dll_initialize") (param $i i32) (param $g i32) (param $s i32) (result i32)
      (local $row i32)
      (local.set $row (i32.add (i32.const 8192) (i32.mul (local.get $i) (i32.const 64))))
      (if (i32.ne (i32.load offset=4 (local.get $row)) (local.get $g)) (then (return (i32.const 0))))
      (i32.store (local.get $row) (if (result i32) (i32.or (i32.eq (local.get $s) (i32.const 1)) (i32.eq (local.get $s) (i32.const 3)))
        (then (i32.const 2)) (else (i32.const 4))))
      (i32.store offset=48 (local.get $row) (i32.eq (local.get $s) (i32.const 1))) (i32.const 1))
    (func (export "next_dll_unload_token_locked") (result i32) (i32.const 1))
    (func (export "finish_dll_unload_locked") (param $i i32) (param $g i32) (param $t i32) (result i32)
      (i32.store (i32.add (i32.const 8192) (i32.mul (local.get $i) (i32.const 64))) (i32.const 0)) (i32.const 1))
    (func (export "get_next_dll_addr") (result i32)
      (i32.add (i32.const 131072) (i32.mul (global.get $dll_count) (i32.const 65536))))
    (func (export "load_dll") (param $size i32) (param $base i32) (result i32)
      (local $row i32)
      (local.set $row (i32.add (i32.const 8192) (i32.mul (global.get $dll_count) (i32.const 64))))
      (i32.store (local.get $row) (i32.const 1))
      (i32.store offset=4 (local.get $row) (i32.add (global.get $dll_count) (i32.const 101)))
      (i32.store offset=8 (local.get $row) (i32.const 1))
      (i32.store offset=12 (local.get $row) (i32.const 1))
      (i32.store offset=24 (local.get $row) (i32.add (local.get $base) (i32.const 4096)))
      (i32.store (i32.add (i32.const 2048) (i32.mul (global.get $dll_count) (i32.const 32))) (local.get $base))
      (i32.store (i32.add (i32.const 2056) (i32.mul (global.get $dll_count) (i32.const 32))) (i32.load (i32.const 65720)))
      (memory.copy (local.get $base) (i32.const 65536) (local.get $size))
      (global.set $dll_count (i32.add (global.get $dll_count) (i32.const 1)))
      (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
      (global.set $thunk_end (i32.add (global.get $thunk_end) (i32.const 16)))
      (if (global.get $map_fault) (then unreachable))
      (i32.add (local.get $base) (i32.const 4096)))
    (func (export "sync_thunk_state") (param $e i32) (param $n i32)
      (global.set $thunk_end (local.get $e)) (global.set $num_thunks (local.get $n)))
    (func (export "patch_caller_iat") (param $base i32) (param $rva i32) (param $name i32) (param $target i32)
      (global.set $patches (i32.add (global.get $patches) (i32.const 1)))
      (i32.store (i32.const 31000) (local.get $base))
      (i32.store (i32.const 31004) (local.get $rva))
      (i32.store (i32.const 31008) (local.get $target)))
    (func (export "guest_read32") (param $p i32) (result i32) (i32.load (local.get $p)))
    (func (export "guest_write32") (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
    (func (export "guest_alloc") (param $size i32) (result i32)
      (i32.store (i32.const 7900) (i32.add (i32.load (i32.const 7900)) (i32.const 1)))
      (if (result i32) (global.get $alloc_fail) (then (i32.const 0)) (else (i32.const 3000))))
    (func (export "guest_write8") (param $p i32) (param $v i32)
      (if (global.get $inspection_write_fault) (then unreachable)) (i32.store8 (local.get $p) (local.get $v)))
    (func (export "guest_free") (param $p i32)
      (i32.store (i32.const 7904) (i32.add (i32.load (i32.const 7904)) (i32.const 1)))
      (if (global.get $inspection_free_fault) (then unreachable)))
    (func (export "api_name_known") (param $p i32) (result i32)
      (if (global.get $inspection_api_fault) (then unreachable)) (i32.const 0))
    (func (export "set_yield_state") (param $y i32) (param $f i32)
      (global.set $yield_reason (local.get $y)) (global.set $yield_flag (local.get $f)))
    (func (export "clear_yield") (global.set $yield_reason (i32.const 0)))
    (func (export "vlan_pump") (global.set $phase (i32.add (global.get $phase) (i32.const 1))))
    (func (export "thread_send_begin") (param $h i32) (param $m i32) (param $w i32) (param $l i32) (result i32)
      (global.set $depth (i32.add (global.get $depth) (i32.const 1)))
      (global.set $esp (i32.sub (global.get $esp) (i32.const 32)))
      (i32.store (global.get $esp) (i32.const 4096))
      (i32.store (i32.add (global.get $esp) (i32.const 20)) (i32.const 1500))
      (i32.store (i32.const 1500) (i32.const 123))
      (global.set $yield_reason (local.get $m))
      (global.set $eip (local.get $h)) (i32.const 1))
    (func (export "thread_send_end") (result i32)
      (global.set $depth (i32.sub (global.get $depth) (i32.const 1))) (global.get $eax))
    (func (export "complete_thread_send") (param $r i32)
      (global.set $eax (local.get $r)) (global.set $yield_reason (i32.const 0)))
    (func (export "run") (param $steps i32)
      (if (global.get $yield_reason) (then return))
      (if (i32.ge_u (global.get $eip) (i32.const 131072)) (then
        (if (i32.eq (global.get $mode) (i32.const 99)) (then unreachable))
        (if (i32.eq (global.get $mode) (i32.const 98)) (then
          (global.set $eax (i32.const 1)) (global.set $eip (i32.const 1)) unreachable))
        (if (i32.eq (global.get $mode) (i32.const 97)) (then
          (global.set $eax (i32.const 1)) (global.set $eip (i32.const 0)) unreachable))
        (if (i32.eq (global.get $mode) (i32.const 96)) (then
          (global.set $eax (i32.const 1)) (global.set $eip (i32.const 2)) (return)))
        (if (i32.and (i32.eqz (global.get $phase))
          (i32.and (i32.ne (global.get $mode) (i32.const 0)) (i32.lt_u (global.get $mode) (i32.const 90)))) (then
          (global.set $phase (i32.const 1))
          (if (i32.eq (global.get $mode) (i32.const 1)) (then
            (global.set $esp (i32.sub (global.get $esp) (i32.const 12)))
            (i32.store (global.get $esp) (global.get $eip))))
          (global.set $yield_reason (global.get $mode))
          (global.set $last_run_halt (i32.const 3)) (return)))
        (i32.store (i32.add (i32.const 30000) (i32.mul (global.get $initializations) (i32.const 4)))
          (i32.sub (global.get $eip) (i32.const 4096)))
        (global.set $initializations (i32.add (global.get $initializations) (i32.const 1)))
        (if (i32.ne (global.get $mode) (i32.const 95)) (then (global.set $eax (i32.const 1))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))))
      (global.set $last_run_halt (i32.const 2))
      (global.set $eip (i32.const 0)))`;
  if (missingExport) source = source.replace(`(export "${missingExport}")`, `(export "absent_${missingExport}")`);
  return WebAssembly.compile(await compileWat(async () => source,
    { files: ['scoped-loader-fixture.wat'], cacheKey: 'scoped-loader-fixture' + missingExport }));
}
async function context(kind, module) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const instance = await WebAssembly.instantiate(module, { host: { memory } });
  const host = new GuestThreadHost(kind === 'local' ? { localMainExports: () => instance.exports } : {});
  const link = kind === 'local' ? host._localLink : new WorkerLink({
    slot: 0, memory, module, sigs: {}, workerUrl: path.resolve(__dirname, '../lib/guest-worker.js'),
  });
  if (kind === 'Worker') { await link.start(); host.link = link; }
  const manager = new ThreadManager(module, memory, instance, null, { workerBackend: host });
  return { host, link, manager, instance, memory, close: () => host.stop() };
}
function image(dependency, exportName) {
  const bytes = new Uint8Array(1024), view = new DataView(bytes.buffer);
  view.setUint32(0x3c, 64, true); view.setUint32(64, 0x4550, true);
  if (exportName) {
    view.setUint32(184, 256, true); view.setUint32(268, 280, true);
    bytes.set(Buffer.from(exportName + '\0'), 280);
  }
  if (dependency) {
    view.setUint16(70, 1, true); view.setUint16(84, 224, true);
    view.setUint32(64 + 128, 512, true);
    for (const [offset, value] of [[320, 512], [324, 512], [328, 512], [332, 512],
      [512, 560], [524, 600], [528, 560], [560, 640]]) view.setUint32(offset, value, true);
    bytes.set(Buffer.from(dependency + '\0'), 600);
    bytes.set(Buffer.from('VendorMissing\0'), 642);
  }
  return bytes;
}
const state = link => Promise.all(['eip', 'esp', 'eax', 'yield_reason', 'depth'].map(n => link.callExport('get_' + n)));
const resolve = (c, r, state = {}) => c.manager.resolveThreadSendYield(c.link, r, state, new Set([c.link]));
async function basic(kind, module) {
  const c = await context(kind, module);
  try {
    const { link, manager, host } = c;
    manager._resolveThreadSendExternalYield = (_link, _r, captured) => prepareScopedLibrary(captured, async () => image());
    host.threadSendYieldResolver = (link, r, s, active) => manager.resolveThreadSendYield(link, r, s, active);
    assert.strictEqual(await host._dispatchThreadSendToLink(link, args(0, 5), 0, null, {}), 131072);
    assert.strictEqual(await link.callExport('get_initializations'), 1);
    assert.strictEqual(c.instance.exports.get_dll_count(), 1, 'owned loader publishes DLL count');
    assert.strictEqual(c.instance.exports.get_num_thunks(), 1, 'owned loader publishes thunk state');
    // DllMain yields to the real callback resolver and resumes its own stack.
    await link.callExport('set_mode', 8);
    assert.strictEqual(await host._dispatchThreadSendToLink(link, args(0, 5), 0, null, {}), 196608);
    assert.strictEqual(await link.callExport('get_initializations'), 2);
    // Reentrant LoadLibrary from DllMain stacks another loader transaction.
    await link.callExport('set_phase', 0); await link.callExport('set_mode', 5);
    assert.strictEqual(await host._dispatchThreadSendToLink(link, args(0, 5), 0, null, {}), 262144);
    assert.strictEqual(await link.callExport('get_initializations'), 4);
    assert.strictEqual(await link.callExport('get_depth'), 0);
    const event = manager.createEvent(false, true);
    await link.callExport('set_wait_handle', event);
    await link.callExport('set_phase', 0); await link.callExport('set_mode', 1);
    await host._dispatchThreadSendToLink(link, args(0, 5), 0, null, {});
    assert.strictEqual(await link.callExport('get_initializations'), 5, 'initializer resumes after real event consumption');
    await link.callExport('set_phase', 0); await link.callExport('set_mode', 10);
    let nested = 0;
    host.processSendResolver = async () => {
      const before = await state(link);
      await host._dispatchThreadSendToLink(link, args(0, 8), 1, null, {});
      assert.deepStrictEqual(await state(link), before, 'nested callback restores initializer registers');
      nested++; return 88;
    };
    await host._dispatchThreadSendToLink(link, args(0, 5), 0, null, {});
    assert.strictEqual(nested, 1);
    assert.strictEqual(await link.callExport('get_initializations'), 6);
  } finally { await c.close(); }
}
async function delayed(kind, module, stale = false) {
  const c = await context(kind, module);
  try {
    const { link, manager } = c;
    let release, entered, lookups = 0;
    const gate = new Promise(r => { release = r; });
    const ready = new Promise(r => { entered = r; });
    manager._resolveThreadSendExternalYield = (_link, _r, captured) => prepareScopedLibrary(captured, async () => {
      lookups++; entered(); await gate; return image();
    });
    const outer = await link.dispatchThreadSend(args(1, 1));
    const saved = await state(link);
    const r = await link.dispatchThreadSend(args(2, 5)), s = {};
    await assert.rejects(link.callExport('get_loadlib_name'), /fences export/);
    const work = resolve(c, r, s);
    await ready;
    if (stale) {
      assert(!(await link.abortThreadSendDispatch(true, 2)).aborted, 'lookup pin cannot be abandoned');
      assert((await link.scopedThreadSendLoader({ ...r, waitEpoch: r.waitEpoch + 1 })).ownershipMismatch);
    }
    const inner = await link.dispatchThreadSend(args(3, 8));
    const before = await state(link);
    release();
    assert.strictEqual(await work, 'pending');
    assert.deepStrictEqual(await state(link), before);
    await link.abortThreadSendDispatch(true, 3);
    {
      assert.strictEqual(await resolve(c, r, s), 'resume');
      assert.strictEqual(lookups, 1);
      assert((await link.scopedThreadSendLoader(r, { bytes: image() })).duplicate);
      assert((await link.scopedThreadSendLoader({ ...r, waitEpoch: r.waitEpoch + 1 })).ownershipMismatch);
      const publication = await link.resumeThreadSendDispatch(undefined, 2, r.waitEpoch);
      assert(publication.loaderPublication);
      assert.strictEqual(await resolve(c, publication, s), 'resume');
      assert((await link.resumeThreadSendDispatch(undefined, 2, publication.waitEpoch)).done);
    }
    assert.deepStrictEqual(await state(link), saved);
    await link.abortThreadSendDispatch(true, outer.frameToken);
  } finally { await c.close(); }
}
async function fault(kind, module, duringMap, mode = 99) {
  const c = await context(kind, module);
  try {
    const { link, manager } = c;
    await link.callExport(duringMap ? 'set_map_fault' : 'set_mode', duringMap ? 1 : mode);
    manager._resolveThreadSendExternalYield = (_link, _r, captured) => prepareScopedLibrary(captured, () => image());
    const r = await link.dispatchThreadSend(args(1, 5));
    const resolverState = {};
    {
      assert.strictEqual(await resolve(c, r, resolverState), 'resume');
      const result = await link.resumeThreadSendDispatch(undefined, 1, r.waitEpoch);
      if (mode === 95 && !duringMap) {
        assert(result.loaderPublication, 'FALSE is a completed failed attach');
        assert.equal(await resolve(c, result, resolverState), 'resume');
        assert.equal((await link.resumeThreadSendDispatch(undefined, 1, result.waitEpoch)).result, 0);
        return;
      }
      assert.match(result.trapped, /unreachable|initializer did not return/);
    }
    assert(!(await link.abortThreadSendDispatch(true, 1)).aborted);
    const life = new DataView(c.memory.buffer);
    assert.equal(life.getUint32(8192, true), duringMap ? 1 : 4, 'incomplete callback cannot become LIVE');
    assert.equal(life.getUint32(8204, true), 1, 'incomplete image retains its quarantine pin');
    await assert.rejects(link.callExport('clear_yield'), /fences export/);
  } finally { await c.close(); }
}
async function inspectionFault(kind, module, oom = false) {
  const c = await context(kind, module);
  try {
    if (oom) await c.link.callExport('set_alloc_fail', 1);
    c.manager._resolveThreadSendExternalYield = (_l, _r, captured, inspect) => prepareScopedLibrary(captured,
      () => image('notinstalled.dll'), null, inspect);
    const r = await c.link.dispatchThreadSend(args(1, 5));
    await assert.rejects(resolve(c, r), /inspection (exports unavailable|allocation failed)/);
    await assert.rejects(c.link.scopedThreadSendLoader(r), /retirement/);
    assert(!(await c.link.abortThreadSendDispatch(true, 1)).aborted);
  } finally { await c.close(); }
}
async function dependencies(kind, module, missing = false) {
  const c = await context(kind, module);
  try {
    const { host, link, manager } = c;
    const lookups = [];
    manager._resolveThreadSendExternalYield = (_l, _r, captured, inspect) => prepareScopedLibrary(captured, async name => {
      lookups.push(name);
      return name === 'test.dll' ? image(missing ? 'notinstalled.dll' : 'msvcrt.dll') : missing ? null : image(null, name);
    }, null, inspect);
    host.threadSendYieldResolver = (l, r, s, a) => manager.resolveThreadSendYield(l, r, s, a);
    const result = await host._dispatchThreadSendToLink(link, args(0, 5), 0, null, {});
    assert.deepStrictEqual(lookups, ['test.dll', missing ? 'notinstalled.dll' : 'msvcrt.dll']);
    assert.strictEqual(result, missing ? 0 : 196608);
    assert.strictEqual(await link.callExport('get_initializations'), missing ? 0 : 2);
    if (!missing) {
      assert.deepStrictEqual(Array.from(new Uint32Array(c.memory.buffer, 30000, 2)), [131072, 196608]);
      assert.strictEqual(await link.callExport('get_patches'), 1);
      assert.deepStrictEqual(Array.from(new Uint32Array(c.memory.buffer, 31000, 3)), [196608, 512, 0]);
    }
  } finally { await c.close(); }
}
async function acknowledgements(kind, module) {
  const c = await context(kind, module);
  try {
    const { link, manager } = c;
    let lookups = 0, publications = 0;
    manager._resolveThreadSendExternalYield = async (_l, _r, captured) => ({
      ...await prepareScopedLibrary(captured, () => { lookups++; return image(); }),
      publish: () => { publications++; },
    });
    const original = link.scopedThreadSendLoader.bind(link);
    let lose = true, losePublication = true;
    link.scopedThreadSendLoader = async (token, request) => {
      const result = await original(token, request);
      if (request?.bytes && lose) { lose = false; throw new Error('lost mapping acknowledgement'); }
      if (request?.publish && losePublication) { losePublication = false; throw new Error('lost publication acknowledgement'); }
      return result;
    };
    const r = await link.dispatchThreadSend(args(1, 5)), s = {};
    assert.strictEqual(await resolve(c, r, s), 'pending');
    assert.strictEqual(await resolve(c, r, s), 'resume');
    assert.strictEqual(await resolve(c, r, s), 'resume');
    assert.strictEqual(publications, 0, 'mapping alone must not publish an uninitialized module');
    const publication = await link.resumeThreadSendDispatch(undefined, 1, r.waitEpoch);
    assert(publication.loaderPublication);
    assert(!(await link.abortThreadSendDispatch(true, 1)).aborted);
    const nested = await link.dispatchThreadSend(args(2, 8));
    const before = await state(link);
    assert.strictEqual(await resolve(c, publication, s), 'pending');
    assert.deepStrictEqual(await state(link), before);
    await link.abortThreadSendDispatch(true, nested.frameToken);
    assert.strictEqual(await resolve(c, publication, s), 'pending', 'lost publication acknowledgement retries retained result');
    assert.strictEqual(await resolve(c, publication, s), 'resume');
    assert.strictEqual(await resolve(c, publication, s), 'resume');
    assert.strictEqual(publications, 1); assert.strictEqual(lookups, 1);
    assert.equal(s.callbackLoaders.size, 1);
    assert.equal([...s.callbackLoaders.values()][0].prepared, null, 'ack releases prepared byte buffers');
    assert.strictEqual((await link.resumeThreadSendDispatch(undefined, 1, publication.waitEpoch)).result, 131072);
    assert.strictEqual(await link.callExport('get_dll_count'), 1);
  } finally { await c.close(); }
}
async function retirement(kind, module) {
  const c = await context(kind, module);
  let release, entered;
  const gate = new Promise(r => { release = r; }), ready = new Promise(r => { entered = r; });
  c.manager._resolveThreadSendExternalYield = (_l, _r, captured) => prepareScopedLibrary(captured, async () => {
    entered(); await gate; return image();
  });
  const r = await c.link.dispatchThreadSend(args(1, 5));
  const work = resolve(c, r);
  await ready; await c.close(); release();
  assert.equal(new Int32Array(c.memory.buffer)[7800 / 4], 0, 'retirement releases captured lookup gate');
  await assert.rejects(work, /retired/);
}
async function com(kind, module, missing) {
  const c = await context(kind, module);
  try {
    const { host, link, manager } = c;
    manager._resolveThreadSendExternalYield = (_l, _r, captured) => prepareScopedLibrary(captured, () => missing ? null : image());
    host.threadSendYieldResolver = (l, r, s, a) => manager.resolveThreadSendYield(l, r, s, a);
    // This fixture has no CoCreateInstance retry handler: successful attach
    // restores the caller EAX (zero), rather than leaking DllMain's BOOL.
    assert.strictEqual(await host._dispatchThreadSendToLink(link, args(0, 3), 0, null, {}), missing ? 0x80040154 | 0 : 0);
    assert.strictEqual(new DataView(c.memory.buffer).getUint32(1500, true), missing ? 0 : 123);
    assert.strictEqual(await link.callExport('get_initializations'), missing ? 0 : 1);
  } finally { await c.close(); }
}
async function retirementAcknowledgements(module, scenario) {
  const c = await context('Worker', module), { link, host, manager } = c;
  const words = new Int32Array(c.memory.buffer);
  const original = link._onMessage.bind(link);
  link._loaderRetireTimeout = 25;
  let dropped = 0;
  try {
    manager._resolveThreadSendExternalYield = (_l, _r, captured) => prepareScopedLibrary(captured, () => image());
    host.threadSendYieldResolver = (l, r, s, active) => manager.resolveThreadSendYield(l, r, s, active);
    if (scenario === 'pin') await host._dispatchThreadSendToLink(link, args(0, 5), 0, null, {});
    const pending = await link.dispatchThreadSend(args(100, 5));
    assert((await link.scopedThreadSendLoader(pending)).ready);
    assert.equal(words[7800 / 4], 1);
    await assert.rejects(link._ask({ t: 'retireScopedLoaders', endpointIdentity: link.endpointIdentity + 1 }), /identity mismatch/);
    assert.equal(words[7800 / 4], 1, 'stale lifetime cannot release a gate');
    if (scenario === 'pin') {
      assert.equal(words[(8192 + 12) / 4], 1);
      words[(8192 + 4) / 4] = 999;
      await assert.rejects(c.close(), /generation pin/);
      assert(link.worker, 'failed pin cleanup retains its endpoint');
      assert.equal(words[7800 / 4], 1, 'failed cleanup retains its gate');
      words[(8192 + 4) / 4] = 101;
    } else {
      link._onMessage = msg => {
        if (msg.t === 'scopedLoadersRetired' && (scenario === 'timeout' || !dropped)) { dropped++; return; }
        original(msg);
      };
      if (scenario === 'timeout') {
        await assert.rejects(c.close(), /did not answer retireScopedLoaders/);
        assert.equal(dropped, 2); assert(link.worker, 'timeout cannot terminate an unacknowledged owner');
        assert.equal(words[7800 / 4], 0, 'cleanup committed despite lost replies');
      }
    }
    if (scenario !== 'lost') link._onMessage = original;
    await c.close();
    assert.equal(words[7800 / 4], 0);
    assert.equal(link.worker, null); assert(link._loaderRetirementReceipt.retired);
    if (scenario === 'lost') assert.equal(dropped, 1);
  } finally { link._onMessage = original; await c.close(); }
}
async function schedulerRetirement(module, scenario) {
  const c = await context('Worker', module), { link, host, manager } = c;
  const words = new Int32Array(c.memory.buffer);
  const original = link._onMessage.bind(link);
  link._loaderRetireTimeout = 25;
  // Model a scheduler-owned guest Worker rather than slot-zero shutdown.
  host.link = null;
  host.threadLinks.set(link.slot, link); host.slotTid.set(link.slot, 1);
  manager._maxWorkerThreads = 1; manager._log = () => {};
  let frees = 0, terminations = 0, releaseTermination;
  manager.mainInstance = { exports: { guest_map_free: stack => {
    assert.equal(stack, 1234); frees++;
  } } };
  const thread = { link, tid: 1, state: 'active', stackAlloc: 1234, startAddr: 4096 };
  manager.threads.set(100, thread);
  const worker = link.worker, terminate = worker.terminate.bind(worker);
  try {
    if (scenario === 'pin') {
      manager._resolveThreadSendExternalYield = (_l, _r, captured) => prepareScopedLibrary(captured, () => image());
      host.threadSendYieldResolver = (l, r, s, active) => manager.resolveThreadSendYield(l, r, s, active);
      await host._dispatchThreadSendToLink(link, args(0, 5), 0, null, {});
    }
    const pending = await link.dispatchThreadSend(args(100, 5));
    assert((await link.scopedThreadSendLoader(pending)).ready);
    assert.equal(words[7800 / 4], 1);
    if (scenario === 'pin') words[(8192 + 4) / 4] = 999;
    else link._onMessage = msg => { if (msg.t !== 'scopedLoadersRetired') original(msg); };
    // Inject only the transport failure that triggers the actual scheduler
    // exit/drop path; lookup, retirement, pin cleanup and replies are real.
    link.slice = async () => { throw new Error('scheduler slice transport failure'); };
    await manager._runWorkerThread(100, thread, 1, {});
    assert.equal(thread.state, 'exited');
    const failure = scenario === 'pin' ? /generation pin/ : /did not answer retireScopedLoaders/;
    await assert.rejects(link.stop(), failure);
    assert(host._retirementLinks?.has(link), 'scheduler drop retains failed owner');
    assert.equal(manager._allocWorkerSlot(), 0, 'unconfirmed owner reserves tid');
    assert.throws(() => manager._dropExitedSlotHandles(1), /still retiring/);
    assert.equal(frees, 0); assert.equal(thread.stackAlloc, 1234);
    // Shutdown must find the dropped owner, fail visibly, and retain retries.
    await assert.rejects(host.stop(), failure);
    await assert.rejects(host.stop(), failure);
    assert(host._retirementLinks.has(link)); assert.equal(link.worker, worker);
    if (scenario === 'pin') {
      assert.equal(words[7800 / 4], 1); assert.equal(words[(8192 + 12) / 4], 1);
      words[(8192 + 4) / 4] = 101;
    }
    link._onMessage = original;
    let terminationStarted;
    const started = new Promise(resolve => { terminationStarted = resolve; });
    worker.terminate = async () => {
      terminations++;
      await new Promise(resolve => { releaseTermination = resolve; terminationStarted(); });
      return terminate();
    };
    const stopping = host.stop();
    await started;
    assert(link._loaderRetirementReceipt.retired);
    assert.equal(manager._allocWorkerSlot(), 0, 'receipt alone cannot release tid');
    assert.throws(() => manager._dropExitedSlotHandles(1), /still retiring/);
    assert.equal(frees, 0); assert.equal(link.worker, worker);
    releaseTermination(); await stopping;
    assert.equal(words[7800 / 4], 0);
    if (scenario === 'pin') assert.equal(words[(8192 + 12) / 4], 0);
    assert.equal(link.worker, null); assert.equal(terminations, 1);
    assert.equal(manager._allocWorkerSlot(), 1);
    manager._dropExitedSlotHandles(1); manager._dropExitedSlotHandles(1);
    await host.stop(); await host.dropThread(link);
    assert.equal(frees, 1); assert.equal(terminations, 1);
  } finally {
    link._onMessage = original; words[(8192 + 4) / 4] = 101;
    if (releaseTermination) releaseTermination();
    worker.terminate = terminate;
    await host.dropThread(link); await host.stop();
  }
}
async function terminationRetry() {
  const link = new WorkerLink({ slot: 3 });
  const host = new GuestThreadHost({});
  let attempts = 0, receipts = 0;
  const worker = { terminate() { if (++attempts === 1) throw new Error('exit confirmation failed'); } };
  link.worker = worker; link._scopedLoaderUsed = true;
  link._ask = async () => { receipts++; return { retired: true, endpointIdentity: link.endpointIdentity }; };
  host.threadLinks.set(3, link); host.slotTid.set(3, 1);
  await assert.rejects(host.dropThread(link), /exit confirmation failed/);
  assert.equal(link.worker, worker); assert(!link._retirementComplete);
  assert(host._retirementLinks.has(link));
  // A stale completion cannot erase the replacement's map entries.
  const replacement = new WorkerLink({ slot: 3 });
  host.threadLinks.set(3, replacement); host.slotTid.set(3, 2);
  await host.dropThread(link);
  assert.equal(attempts, 2); assert.equal(receipts, 1);
  assert.equal(host.threadLinks.get(3), replacement); assert.equal(host.slotTid.get(3), 2);
  await host.stop();
}
async function failedSpawnOwnership(module) {
  const c = await context('local', module), { host, manager } = c;
  const start = WorkerLink.prototype.start, init = WorkerLink.prototype.initGuestThread;
  let allowExit = false, freed = 0;
  manager._maxWorkerThreads = 1; manager._log = () => {};
  manager._workerPeMeta = async () => ({});
  manager._workerWasmGlobals = () => ({});
  manager.mainInstance = { exports: { guest_map_free: () => { freed++; } } };
  WorkerLink.prototype.start = async function () {
    this.worker = { terminate() { if (!allowExit) throw new Error('bootstrap exit failed'); } };
  };
  WorkerLink.prototype.initGuestThread = async function () {
    this.stackMapped = 1234;
    throw new Error('bootstrap failed after allocation');
  };
  try {
    manager._pendingThreads.push({ tid: 1, handle: 100, startAddr: 4096 });
    await manager._spawnPendingWorkersPass();
    assert.equal(manager._pendingThreads.length, 0);
    const failed = manager.threads.get(100);
    assert(failed); assert.equal(failed.stackAlloc, 1234);
    assert(host._retirementLinks.has(failed.link));
    assert.equal(manager._allocWorkerSlot(), 0);
    await assert.rejects(host.stop(), /bootstrap exit failed/);
    allowExit = true; await host.stop();
    assert.equal(manager._allocWorkerSlot(), 1);
    manager._dropExitedSlotHandles(1); assert.equal(freed, 1);
  } finally {
    allowExit = true;
    WorkerLink.prototype.start = start; WorkerLink.prototype.initGuestThread = init;
    await host.stop();
  }
}
async function inspectionException(kind, module, field, cleanupFault) {
  const c = await context(kind, module);
  try {
    await c.link.callExport('set_' + field, 1);
    if (cleanupFault) await c.link.callExport('set_inspection_free_fault', 1);
    c.manager._resolveThreadSendExternalYield = (_l, _r, captured, inspect) =>
      prepareScopedLibrary(captured, () => image('notinstalled.dll'), null, inspect);
    const r = await c.link.dispatchThreadSend(args(1, 5));
    await assert.rejects(resolve(c, r), cleanupFault ? /unreachable; dependency inspection cleanup failed: unreachable/ : /unreachable/);
    const counters = new Uint32Array(c.memory.buffer, 7900, 2);
    assert.deepEqual([...counters], [1, 1], 'allocated inspection string freed exactly once on exception');
    await assert.rejects(c.link.scopedThreadSendLoader(r), /retirement/);
    assert.deepEqual([...counters], [1, 1], 'fault retry cannot allocate or free again');
  } finally { await c.close(); }
}
async function irreversibleCancellationFault(kind, module) {
  const c = await context(kind, module), { link, manager } = c;
  try {
    await link.callExport('set_mode', 1);
    manager._resolveThreadSendExternalYield = (_l, _r, captured) => prepareScopedLibrary(captured, () => image());
    const r = await link.dispatchThreadSend(args(100, 5));
    assert.equal(await resolve(c, r), 'resume');
    const blocked = await link.resumeThreadSendDispatch(undefined, 100, r.waitEpoch);
    assert.equal(blocked.yield, 1, 'initializer has an active continuation');
    const words = new Int32Array(c.memory.buffer);
    words[(8192 + 4) / 4] = 999;
    await assert.rejects(async () => c.close(), /rollback generation changed/);
    assert.equal(words[7800 / 4], 1);
    words[(8192 + 4) / 4] = 101;
    await assert.rejects(async () => c.close(), /rollback generation changed/,
      'closed failing generator must never turn a later stop into success');
    assert.equal(words[7800 / 4], 1, 'irreversible cancellation fault retains gate quarantine');
    if (kind === 'Worker') assert(link.worker);
  } finally {
    // Dispose this deliberately poisoned isolated fixture. Production stop()
    // must NOT do this: the test drops its whole private memory afterwards.
    if (link.worker) { await link.worker.terminate(); link.worker = null; }
  }
}
async function unloading(kind, module, unloadKind) {
  const c = await context(kind, module), { host, link, manager } = c;
  let lookups = 0, published;
  try {
    manager._resolveThreadSendExternalYield = async (_l, _r, captured) => ({
      ...await prepareScopedLibrary(captured, () => { lookups++; return image(); }),
      publish: result => { published = result; },
    });
    host.threadSendYieldResolver = (l, r, s, active) => manager.resolveThreadSendYield(l, r, s, active);
    await host._dispatchThreadSendToLink(link, args(0, 5), 0, null, {});
    assert.equal(new DataView(c.memory.buffer).getUint32(8192, true), 2, 'successful attach publishes LIVE');
    await link.callExport('set_unload_kind', unloadKind);
    await link.callExport('set_unload_module', 131072);
    if (unloadKind === 3) new DataView(c.memory.buffer).setUint32(8200, 0, true);
    const r = await link.dispatchThreadSend(args(100, 5)), s = {};
    assert.equal(await resolve(c, r, s), 'resume');
    assert.equal(await resolve(c, r, s), 'resume', 'retry does not consume unload intent twice');
    const receipt = await link.resumeThreadSendDispatch(undefined, 100, r.waitEpoch);
    assert(receipt.loaderPublication);
    assert.equal(await resolve(c, receipt, s), 'resume');
    assert.equal(published.retired[0].generation, 101);
    assert.equal(new DataView(c.memory.buffer).getUint32(8192, true), 0);
    const resumed = await link.resumeThreadSendDispatch(undefined, 100, receipt.waitEpoch);
    assert.equal(unloadKind === 2 ? resumed.yield : resumed.done, unloadKind === 2 ? 2 : true);
    assert.equal(lookups, 1, 'unload never resolves a load name');
    // Lifecycle inspection is direct fixture memory; ordinary exports remain
    // fenced on terminal callbacks until endpoint retirement.
    assert.equal(new Int32Array(c.memory.buffer)[7800 / 4], 0);
  } finally { await c.close(); }
}
async function main() {
  const module = await fixture();
  for (const kind of ['Worker', 'local']) {
    await basic(kind, module);
    await delayed(kind, module); await delayed(kind, module, true);
    await fault(kind, module, true); await fault(kind, module, false);
    for (const mode of [98, 97, 96, 95]) await fault(kind, module, false, mode);
    await inspectionFault(kind, module, true);
    for (const missing of ['api_name_known', 'guest_alloc', 'guest_write8', 'guest_free']) {
      await inspectionFault(kind, await fixture(missing));
    }
    for (const field of ['inspection_write_fault', 'inspection_api_fault']) {
      await inspectionException(kind, module, field, false);
      await inspectionException(kind, module, field, true);
    }
    await dependencies(kind, module); await dependencies(kind, module, true);
    await acknowledgements(kind, module);
    await com(kind, module, false); await com(kind, module, true);
    await retirement(kind, module);
    await irreversibleCancellationFault(kind, module);
    for (const unloadKind of [1, 2, 3]) await unloading(kind, module, unloadKind);
    console.log(`PASS ${kind} owned callback loaders: mapping/publication, DllMain yields/reentrancy, delayed nesting/stale epoch, fault retention`);
  }
  for (const scenario of ['lost', 'timeout', 'pin']) await retirementAcknowledgements(module, scenario);
  console.log('PASS actual Worker retirement: lost/duplicate replies, timeout retention/retry, generation-pin cleanup failure');
  for (const scenario of ['timeout', 'pin']) await schedulerRetirement(module, scenario);
  console.log('PASS scheduler drop: retryable retirement failures retain inventory, tid and stack through Worker exit');
  await terminationRetry();
  console.log('PASS termination failure retry and exact slot ownership');
  await failedSpawnOwnership(module);
  console.log('PASS failed bootstrap retains scheduler slot and stack ownership');
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { fixture, context, image };
