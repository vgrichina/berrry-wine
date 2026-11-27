#!/usr/bin/env node
'use strict';
// Public USER32 dispatch on a real executing Worker, with production host
// imports and renderer bound to a different, idle instance over shared memory.
const assert = require('node:assert/strict');
const path = require('node:path');
const { bootRenderHarness } = require('./render-helper');
const { extraWat } = require('./test-clipcursor-immediate-confinement.cjs');
const { GuestThreadHost } = require('../lib/guest-thread-host');
const { PublicationQueue } = require('../lib/render-worker');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;

const clipNames = ['clip_cursor_active', 'clip_cursor_left', 'clip_cursor_top',
  'clip_cursor_right', 'clip_cursor_bottom'];
const tuple = e => clipNames.map(n => e[n]());

// Two ordinary public dispatches in one Worker turn leave SetCursorPos queued
// ahead of ClipCursor, testing FIFO flush at the synchronous publication.
const fifoWat = String.raw`
  (func (export "publication_fifo") (param $set i32) (param $clip i32)
    (param $stack i32) (param $rect i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (i32.add (local.get $stack) (i32.const 4)) (i32.const 150))
    (call $gs32 (i32.add (local.get $stack) (i32.const 8)) (i32.const 110))
    (call $win32_dispatch
      (i32.shr_u (i32.sub (local.get $set) (global.get $thunk_guest_base)) (i32.const 3)))
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (i32.add (local.get $stack) (i32.const 4)) (local.get $rect))
    (call $win32_dispatch
      (i32.shr_u (i32.sub (local.get $clip) (global.get $thunk_guest_base)) (i32.const 3))))
`;

async function scenario(module, workerMode) {
  const h = await bootRenderHarness({ fonts: 'none', prebuiltModule: module });
  const e = h.exports, r = h.renderer;
  e.init_thread(1, 0x400000, 0, 0, 0, 0, 0);
  e.set_host_shadow(workerMode ? 1 : 0);
  const remote = workerMode ? new GuestThreadHost({ module: h.module, memory: h.memory,
    hostImports: h.host, sigs, clockIntervalMs: 0, countCalls: true,
    workerUrl: path.resolve(__dirname, '../lib/guest-worker.js'), log: console.log }) : null;
  // Exercise the existing RPC admission queue independently of a graphics
  // backend. No D3D/GL encoder or executor is started by this CPU fixture.
  if (remote) remote.renderPublication = new SharedArrayBuffer(64 + 256);
  const rows = [];
  try {
    if (remote) await remote.start();
    const call = (n, ...a) => remote ? remote.callExport(n, ...a) : Promise.resolve(e[n](...a));
    if (remote) {
      // Same renderer publication hook host.js installs after Worker startup.
      r._mousePointPublishers = new Set([(x, y) => remote.broker.publish({ mouseX: x, mouseY: y })]);
      remote.broker.publish({ mouseX: r._mouseX || 0, mouseY: r._mouseY || 0 });
    }
    await call('init_thread', 1, 0x400000, 0, 0, 0, 0, 0);
    await call('heap_init', 0x800000);
    await call('confinement_init'); await call('set_api_log', 0);
    const regs = await call('confinement_regs');
    const storage = await call('guest_alloc', 256), stackArea = await call('guest_alloc', 256);
    const rect = storage + 32, stack = stackArea + 64;
    const view = new DataView(h.memory.buffer), mem = new Uint8Array(h.memory.buffer);
    const wa = p => e.guest_to_wasm(p) >>> 0;
    const bytes = (p, n) => mem.subarray(wa(p), wa(p) + n);
    async function text(s) {
      const p = await call('guest_alloc', s.length + 1);
      bytes(p, s.length + 1).set(Buffer.from(s + '\0')); return p;
    }
    view.setUint32(regs + 16, stack, true);
    const user32 = await call('confinement_module', await text('USER32.DLL'));
    assert(user32, 'real USER32 module');
    const entries = {};
    for (const name of ['ClipCursor', 'GetClipCursor', 'SetCursorPos']) {
      view.setUint32(regs + 16, stack, true);
      entries[name] = await call('confinement_resolve', user32, await text(name));
      assert(entries[name], name + ' public thunk');
    }
    const stateNames = ['get_eip', 'get_handler_set_eip', 'test_get_last_error',
      'get_flag_op', 'get_flag_a', 'get_flag_b', 'get_flag_res', 'get_flag_sign_shift',
      'get_capture_hwnd', 'get_cursor', 'get_cursor_display_count'];
    const state = () => remote ? remote.readExports(stateNames)
      : Promise.resolve(Object.fromEntries(stateNames.map(n => [n, e[n]() >>> 0])));
    async function invoke(name, args) {
      bytes(stackArea, 256).fill(0xcc);
      for (let i = 0; i < 8; i++) view.setUint32(regs + i * 4, 0x41320000 + i, true);
      view.setUint32(regs + 16, stack, true);
      view.setUint32(wa(stack), 0x12345678, true);
      args.forEach((v, i) => view.setInt32(wa(stack) + 4 + i * 4, v, true));
      const before = Buffer.from(bytes(stackArea, 256));
      const saved = await state();
      await call('confinement_call', entries[name]);
      assert.equal(view.getUint32(regs, true), 1, name + ' BOOL');
      assert.equal(view.getUint32(regs + 16, true), stack + 4 * (args.length + 1), name + ' stdcall');
      for (const i of [1, 2, 3, 5, 6, 7])
        assert.equal(view.getUint32(regs + i * 4, true), 0x41320000 + i, name + ' register');
      assert.deepEqual(Buffer.from(bytes(stackArea, 256)), before, name + ' stack guards');
      assert.deepEqual(await state(), saved, name + ' flags, last error, instruction, capture/cursor guards');
    }
    // A live native HWND, normal production host window, and nonzero client
    // origin. Both renderer and window stay bound to the idle page instance.
    const hwnd = 65;
    await call('wnd_table_set', hwnd, 0x401000);
    await call('wnd_set_style_export', hwnd, 0x90000000);
    h.host.create_window(hwnd, 0x90000000, 10, 20, 600, 440, 0, 0);
    assert.equal(r.windows[hwnd].wasm, h.instance);
    assert.equal(e.wnd_lookup_live(hwnd), 1);
    const origin = [e.wnd_mouse_msg_origin_x(hwnd), e.wnd_mouse_msg_origin_y(hwnd)];
    assert.deepEqual(origin, [10, 20], 'actual native client origin');
    const count = name => remote ? remote.broker.stats().calls
      .filter(c => c.name === name || c.name === name + '~async').reduce((n, c) => n + c.count, 0) : 0;
    function input(inputPoint, expected, messages = true) {
      r.inputQueue.length = 0;
      r.handleMouseMove(...inputPoint);
      r.handleMouseDown(...inputPoint, 1);
      r.handleMouseUp(...inputPoint, 1);
      assert.deepEqual([r._mouseX, r._mouseY], expected, 'next real input point');
      if (messages) for (const msg of [0x200, 0x201, 0x202]) {
        const events = r.inputQueue.filter(v => v.msg === msg);
        assert(events.length, 'queued native mouse message ' + msg);
        for (const v of events) {
          assert.equal(v.hwnd, hwnd);
          assert.deepEqual([(v.lParam << 16) >> 16, v.lParam >> 16],
            [expected[0] - origin[0], expected[1] - origin[1]], 'client lParam');
        }
      }
      rows.push({ input: inputPoint, point: expected, messages });
    }
    async function clip(bounds, expectedActive = 1) {
      if (bounds) bounds.forEach((v, i) => view.setInt32(wa(rect) + 4 * i, v, true));
      const before = Buffer.from(bytes(storage, 256));
      const point = [r._mouseX, r._mouseY], warps = count('set_mouse_position');
      await invoke('ClipCursor', [bounds ? rect : 0]);
      const observed = tuple(e); // before another Worker export/input/query
      assert.deepEqual(Buffer.from(bytes(storage, 256)), before, 'RECT and guards unchanged');
      assert.equal(r.wasm, h.instance, 'renderer retains idle page instance');
      assert.deepEqual(observed, [expectedActive, ...(bounds || retained)], 'public return publishes complete tuple');
      assert.deepEqual([r._mouseX, r._mouseY], point, 'inside/release has no warp');
      assert.equal(count('set_mouse_position'), warps, 'no cursor warp import');
      if (bounds) retained = bounds;
      rows.push({ clip: observed, point });
    }
    let retained = [0, 0, 0, 0];
    async function query(expected) {
      const output = storage + 128;
      const before = Buffer.from(bytes(storage, 256));
      await invoke('GetClipCursor', [output]);
      assert.deepEqual([0, 4, 8, 12].map(i => view.getInt32(wa(output) + i, true)), expected);
      const after = Buffer.from(bytes(storage, 256));
      after.copy(before, 128, 128, 144);
      assert.deepEqual(after, before, 'GetClipCursor RECT output guards');
    }
    await invoke('SetCursorPos', [150, 110]);
    assert.deepEqual([r._mouseX, r._mouseY], [150, 110]);
    const A = [100, 80, 200, 140], B = [120, 90, 180, 130];
    await clip(A); input([240, 160], [199, 139]);
    await query(A);
    input([150, 110], [150, 110]);
    await clip(B); input([240, 160], [179, 129]);
    await query(B);
    await clip(null, 0); input([240, 160], [240, 160]);
    await query([0, 0, 640, 480]);
    await clip(null, 0);
    input([150, 110], [150, 110]); await clip(A);
    await clip(null, 0);
    input([0, 0], [0, 0], false);
    await clip([-20, -15, 30, 25]);
    input([60, 50], [29, 24]); input([-30, -20], [-20, -15], false);
    await clip(null, 0);
    input([150, 110], [150, 110]);
    // Pending rendering does not admit a USER publication. Hold a real queue
    // admission with no GL/context; its descriptor is never executed by GPU.
    let q, release, drain;
    if (remote) {
      q = new PublicationQueue(remote.renderPublication);
      const gate = new Promise(resolve => { release = resolve; });
      q.publish(1, 0, new Uint8Array([7]), () => {});
      drain = q.drain(async () => { await gate; });
    }
    try {
      await clip(A);
      if (q) assert.notEqual(Atomics.load(q.control, 1), Atomics.load(q.control, 2), 'render still pending');
    } finally { release?.(); await drain; }
    await clip(null, 0);
    input([300, 220], [300, 220]);
    A.forEach((v, i) => view.setInt32(wa(rect) + 4 * i, v, true));
    const warps = count('set_mouse_position');
    await call('publication_fifo', entries.SetCursorPos, entries.ClipCursor, stack, rect);
    assert.deepEqual(tuple(e), [1, ...A]);
    assert.deepEqual([r._mouseX, r._mouseY], [150, 110], 'preceding queued public warp flushed first');
    if (remote) assert.equal(count('set_mouse_position'), warps + 1, 'FIFO has no corrective second warp');
    // Host ownership is independent of renderer selection. A real third
    // compiled instance is the decoy; public ClipCursor must update ctx.exports.
    const decoy = new WebAssembly.Instance(module, { host: h.host });
    const decoyBefore = tuple(decoy.exports);
    r.wasm = decoy;
    await invoke('ClipCursor', [0]);
    assert.deepEqual(tuple(e), [0, ...A]);
    assert.deepEqual(tuple(decoy.exports), decoyBefore, 'renderer-selected decoy untouched');
    r.wasm = h.instance;
    h.hostCtx.exports = null;
    h.hostCtx.instance = h.instance;
    await clip(B);
    h.hostCtx.exports = e;
    delete h.hostCtx.instance;
    await clip(null, 0);
    if (remote) assert.equal(count('publish_clip_cursor~async'), 0, 'publication is never async batched');
    // Explicit transport failure must reject the public API, without posting a
    // publication or acknowledging success. No further runtime on that actor.
    if (remote) {
      const beforeCalls = count('publish_clip_cursor');
      q.fail();
      await assert.rejects(invoke('ClipCursor', [rect]), /publication queue closed or failed/);
      assert.equal(count('publish_clip_cursor'), beforeCalls);
      assert.deepEqual(tuple(e), [0, ...B], 'failed publication leaves page inactive');
    }
    return rows;
  } finally { if (remote) await remote.stop(); }
}

async function exercise() {
  const timeout = setTimeout(() => { console.error('ClipCursor test deadline'); process.exit(1); }, 45000);
  try {
    assert.deepEqual(sigs.publish_clip_cursor, { params: ['i32', 'i32', 'i32', 'i32', 'i32'], results: [] });
    const h = await bootRenderHarness({ extraWat: extraWat + fifoWat, fonts: 'none' });
    const cooperative = await scenario(h.module, false);
    const worker = await scenario(h.module, true);
    assert.deepEqual(worker, cooperative, 'Worker and cooperative public behavior agree');
    console.log(JSON.stringify({ cases: worker.length, worker, cooperative: 'identical' }));
    console.log('PASS ClipCursor public Worker/page publication, signed input/messages, ABI, FIFO, owner binding, pending/failed render transport');
  } finally { clearTimeout(timeout); }
}
if (require.main === module) exercise().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { exercise };
