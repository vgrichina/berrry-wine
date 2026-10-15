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
    'num_thunks', 'thunk_end', 'mode', 'phase', 'initializations', 'map_fault', 'wait_handle', 'alloc_fail', 'last_run_halt', 'patches'];
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
    (func (export "get_next_dll_addr") (result i32)
      (i32.add (i32.const 131072) (i32.mul (global.get $dll_count) (i32.const 65536))))
    (func (export "load_dll") (param $size i32) (param $base i32) (result i32)
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
      (if (result i32) (global.get $alloc_fail) (then (i32.const 0)) (else (i32.const 3000))))
    (func (export "guest_write8") (param $p i32) (param $v i32) (i32.store8 (local.get $p) (local.get $v)))
    (func (export "guest_free") (param $p i32))
    (func (export "api_name_known") (param $p i32) (result i32) (i32.const 0))
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
          (global.set $yield_reason (global.get $mode)) (return)))
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
    if (stale) assert((await link.abortThreadSendDispatch(true, 2)).aborted);
    const inner = await link.dispatchThreadSend(args(3, 8));
    const before = await state(link);
    release();
    if (stale) await assert.rejects(work, /ownership mismatch/);
    else assert.strictEqual(await work, 'pending');
    assert.deepStrictEqual(await state(link), before);
    await link.abortThreadSendDispatch(true, 3);
    if (!stale) {
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
    if (duringMap) {
      assert.strictEqual(await resolve(c, r), 'pending');
      await assert.rejects(resolve(c, r), /retirement/);
      await assert.rejects(link.scopedThreadSendLoader(r, { bytes: image() }), /retirement/);
    } else {
      assert.strictEqual(await resolve(c, r), 'resume');
      const result = await link.resumeThreadSendDispatch(undefined, 1, r.waitEpoch);
      assert.match(result.trapped, /unreachable|invalid return address|returned FALSE/);
    }
    assert(!(await link.abortThreadSendDispatch(true, 1)).aborted);
    assert((await link.resumeThreadSendDispatch(undefined, 1, r.waitEpoch)).waitPending || !duringMap);
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
  await assert.rejects(work, /retired/);
}
async function com(kind, module, missing) {
  const c = await context(kind, module);
  try {
    const { host, link, manager } = c;
    manager._resolveThreadSendExternalYield = (_l, _r, captured) => prepareScopedLibrary(captured, () => missing ? null : image());
    host.threadSendYieldResolver = (l, r, s, a) => manager.resolveThreadSendYield(l, r, s, a);
    assert.strictEqual(await host._dispatchThreadSendToLink(link, args(0, 3), 0, null, {}), missing ? 0x80040154 | 0 : 1);
    assert.strictEqual(new DataView(c.memory.buffer).getUint32(1500, true), missing ? 0 : 123);
    assert.strictEqual(await link.callExport('get_initializations'), missing ? 0 : 1);
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
    for (const missing of ['api_name_known', 'guest_alloc', 'guest_write8']) {
      await inspectionFault(kind, await fixture(missing));
    }
    await dependencies(kind, module); await dependencies(kind, module, true);
    await acknowledgements(kind, module);
    await com(kind, module, false); await com(kind, module, true);
    await retirement(kind, module);
    console.log(`PASS ${kind} owned callback loaders: mapping/publication, DllMain yields/reentrancy, delayed nesting/stale epoch, fault retention`);
  }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { fixture, context, image };
