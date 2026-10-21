#!/usr/bin/env node
'use strict';

// Actual guest CALL/RET through placement, show and DefWindowProc thunks.
// No game, synthetic posted WM_SIZE, or host resize intervention is involved.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const compiler = require('/home/user/hock-show-return-repair/repo/test/compile-src');
const compile = compiler.compileSrcWasm;
compiler.compileSrcWasm = (transform, options) => compile((file, source) => {
  const base = process.env.PLACEMENT_BASELINE;
  if (base && ['09a5b-handlers-window-late.wat', '09a5-handlers-window.wat', '09b-dispatch.wat', '13-exports.wat'].includes(file))
    source = fs.readFileSync(path.join(base, 'src', file), 'utf8');
  if (process.env.PLACEMENT_CONTROL === 'late-snapshot' && file === '09a5b-handlers-window-late.wat') {
    const read = '(local.set $show (i32.load offset=8 (local.get $wa)))';
    source = source.replace(read, '').replace(';; showCmd used to be read', read + '\n    ;; showCmd used to be read');
  }
  if (process.env.PLACEMENT_CONTROL === 'stale-startup' && file === '09b-dispatch.wat') {
    const start = source.indexOf(';; CACA0031:');
    const old = source;
    source = source.slice(0, start) + source.slice(start).replace(
      '(local.set $arg0 (call $client_rect_wh_packed (local.get $arg4)))',
      '(local.set $arg0 (global.get $pending_wm_size))');
    assert.notEqual(source, old, 'stale-startup control must change the payload');
  }
  return transform ? transform(file, source) : source;
}, options);
const { bootRenderHarness } = require('/home/user/hock-show-return-repair/repo/test/render-helper');
const apis = require('/home/user/hock-show-return-repair/repo/src/api_table.json');
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
const pack = (w, h) => ((w & 65535) | h << 16) >>> 0;
const extraWat = String.raw`
  (func (export "pn_thunk") (param $id i32) (result i32)
    (local $p i32)
    (global.set $thunk_guest_base (call $w2g (global.get $THUNK_BASE)))
    (local.set $p (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $p) (i32.const 0)) (i32.store offset=4 (local.get $p) (local.get $id))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end) (call $w2g (local.get $p)))
  (func (export "pn_window") (param $proc i32) (param $style i32) (result i32)
    (local $h i32) (local.set $h (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
    (call $wnd_table_set (local.get $h) (local.get $proc))
    (drop (call $wnd_set_style (local.get $h) (local.get $style))) (local.get $h))
  (func (export "pn_init") (param $h i32) (call $defwndproc_do_nccalcsize (local.get $h)))
  (func (export "pn_client") (param $h i32) (result i32) (call $client_rect_wh_packed (local.get $h)))
  (func (export "pn_live") (param $h i32) (result i32) (call $wnd_table_find (local.get $h)))
  (func (export "pn_depth") (result i32) (global.get $windowpos_depth))
  (func (export "pn_main") (param $h i32) (param $activated i32) (param $pending i32)
    (global.set $quit_flag (i32.const 0))
    (global.set $main_hwnd (local.get $h))
    (global.set $show_window_activated (local.get $activated))
    (global.set $pending_wm_size (local.get $pending)))
  (func (export "pn_send") (param $h i32) (result i32)
    (call $wnd_send_message (local.get $h) (i32.const 0x8001) (i32.const 0) (i32.const 0)))
  (func (export "pn_fetch") (param $msg i32) (param $peek i32)
    (local $esp i32) (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $post_queue_reset)
    (loop $drain (br_if $drain (call $shared_post_queue_read (local.get $msg) (i32.const 1))))
    (if (local.get $peek)
      (then (call $handle_PeekMessageA (local.get $msg) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
      (else (call $handle_GetMessageA (local.get $msg) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp)))
`;

function procedure(obs, placement, def, destroy, p, opts) {
  const code = [], labels = new Map(), fixups = [];
  const emit = (...bytes) => code.push(...bytes);
  const label = name => labels.set(name, code.length);
  const branch = (op, name) => { emit(...op); fixups.push([code.length, name]); emit(0, 0, 0, 0); };
  const call = addr => emit(0xb8, ...u32(addr), 0xff, 0xd0);
  const place = ptr => { emit(0x68, ...u32(ptr), 0xff, 0x75, 0x08); call(placement); };
  emit(0x55, 0x89, 0xe5); // push ebp; mov ebp,esp
  emit(0x81, 0x7d, 0x0c, ...u32(0x8001)); branch([0x0f, 0x85], 'message');
  if (opts.show) { emit(0xff, 0x35, ...u32(p + 8), 0xff, 0x75, 0x08); call(opts.show); } else place(p); emit(0xa3, ...u32(obs + 4)); branch([0xe9], 'done');
  label('message');
  emit(0x8b, 0x15, ...u32(obs), 0xc1, 0xe2, 0x04); // edx=count*16
  for (const [src, dst] of [[12, 0], [16, 4], [20, 8]])
    emit(0x8b, 0x45, src, 0x89, 0x82, ...u32(obs + 64 + dst));
  emit(0xff, 0x05, ...u32(obs)); // increment BEFORE nested callbacks
  if (opts.trigger) {
    emit(0x81, 0x7d, 0x0c, ...u32(opts.trigger)); branch([0x0f, 0x85], 'default');
    emit(0x83, 0x3d, ...u32(obs + 8), 0); branch([0x0f, 0x85], 'default');
    emit(0xc7, 0x05, ...u32(obs + 8), ...u32(1));
    if (opts.mutate) emit(0xc7, 0x05, ...u32(p + 8), ...u32(2));
    if (opts.nested) place(opts.nested);
    if (opts.destroy) { emit(0xff, 0x75, 0x08); call(destroy); branch([0xe9], 'done'); }
  }
  label('default');
  // Consuming CHANGED must suppress legacy geometry messages. Never chain
  // CHANGING here: this fixture is testing placement, not min-track limits.
  if (!opts.consume) {
    emit(0x83, 0x7d, 0x0c, 0x47); branch([0x0f, 0x85], 'done');
    emit(0xff, 0x75, 0x14, 0xff, 0x75, 0x10, 0xff, 0x75, 0x0c, 0xff, 0x75, 0x08); call(def);
  }
  label('done'); emit(0x31, 0xc0, 0x89, 0xec, 0x5d, 0xc2, 0x10, 0);
  for (const [at, name] of fixups) code.splice(at, 4, ...u32(labels.get(name) - at - 4));
  return code;
}

(async () => {
  const h = await bootRenderHarness({ extraWat, fonts: 'none' });
  const { exports: e, renderer, memory, instance } = h;
  // A PE is loaded only to initialize guest/thunk memory; none of its code
  // runs. Remote asset-minimal checkouts may name an already-preserved PE.
  const pe = fs.readFileSync(process.env.PLACEMENT_FIXTURE || path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging()); assert(e.load_pe(pe.length)); e.init_dx_com_thunks();
  const thunk = name => e.pn_thunk(apis.find(a => a.name === name).id) >>> 0;
  const placement = thunk('SetWindowPlacement'), def = thunk('DefWindowProcA'), destroy = thunk('DestroyWindow');
  const put = (p, v) => e.guest_write32(p, v), get = p => e.guest_read32(p) >>> 0;
  const placementData = (p, w = 300, height = 220, show = 1) =>
    [44, 0, show, 0, 0, 0, 0, 31, 47, 31 + w, 47 + height].forEach((v, i) => put(p + i * 4, v));
  function make(opts = {}) {
    const obs = e.guest_alloc(4096) >>> 0, proc = e.guest_alloc(1024) >>> 0, p = e.guest_alloc(44) >>> 0;
    placementData(p);
    procedure(obs, placement, def, destroy, p, opts).forEach((v, i) => e.guest_write8(proc + i, v));
    const style = opts.hidden ? 0x00cf0000 : 0x10cf0000;
    const hwnd = e.pn_window(proc, style) >>> 0;
    renderer.createWindow(hwnd, style, 11, 17, 400, 300, 'placement notifications', 0, instance, memory);
    e.pn_init(hwnd);
    return { hwnd, obs, p, opts };
  }
  const sentinel = make(); e.pn_main(sentinel.hwnd, 1, 0);
  const messages = f => {
    assert(get(f.obs) < 240, 'bounded callback count');
    return Array.from({ length: get(f.obs) }, (_, i) => [0, 4, 8].map(o => get(f.obs + 64 + i * 16 + o)));
  };
  const run = f => {
    put(f.obs, 0); put(f.obs + 4, 0xdeadbeef);
    const esp = e.get_esp(); e.set_ebx(0x12345678); e.set_esi(0x23456789); e.set_edi(0x3456789a);
    e.pn_send(f.hwnd);
    assert.equal(e.get_esp(), esp, 'outer guest stack restored');
    assert.equal(e.get_ebx() >>> 0, 0x12345678); assert.equal(e.get_esi() >>> 0, 0x23456789); assert.equal(e.get_edi() >>> 0, 0x3456789a);
    assert.equal(e.pn_depth(), 0, 'all nested WINDOWPOS slots released');
    return messages(f);
  };
  const show = thunk('ShowWindow');
  for (const hidden of [true, false]) {
    for (const activated of [0, 1]) {
      const f = make({hidden, show});
      e.pn_main(f.hwnd, activated, pack(392,273));
      const ms = run(f);
      assert.equal(get(f.obs+4), hidden ? 0 : 1, 'ShowWindow returns entry visibility');
      console.log('PASS ShowWindow visibility/ESP', {hidden,activated,result:get(f.obs+4),messages:ms});
    }
  }
  const failures=[];
  for (const trigger of [0x1c,6,7]) {
    const f = make({hidden:true,show,trigger,destroy:true});
    e.pn_main(f.hwnd,0,pack(392,273));
    placementData(f.p,300,220,4); // SW_SHOWNOACTIVATE: visible but no activation yet
    run(f);
    assert.equal(get(f.obs+4),0,'initial hidden show returns false');
    assert(renderer.windows[f.hwnd].visible,'first call really made target visible');
    assert.equal(get(f.obs+8),0,'no activation callback on first call');
    placementData(f.p,300,220,1); // SW_SHOWNORMAL, now starts activation
    const ms=run(f);
    console.log('OBS destroyed previously visible ShowWindow', {trigger,live:e.pn_live(f.hwnd),result:get(f.obs+4),messages:ms});
    assert.equal(e.pn_live(f.hwnd),-1);
    if(get(f.obs+4)!==1) failures.push({trigger,actual:get(f.obs+4),expected:1});
  }
  assert.deepEqual(failures,[],'ShowWindow must retain entry visibility when activation callback destroys its target');
  const group = process.env.PLACEMENT_GROUP || 'all';
  if (['all', 'ordinary'].includes(group)) {
    for (const hidden of [false, true]) {
      const f = make({ hidden }), ms = run(f), ids = ms.map(m => m[0]);
      assert.deepEqual(ids.slice(0, 4), [0x46, 0x47, 3, 5], 'changing -> changed -> move -> size before return');
      assert.equal(get(f.obs + 4), 1, 'placement BOOL');
      assert.equal(ms.find(m => m[0] === 5)[2], e.pn_client(f.hwnd) >>> 0, 'WM_SIZE uses committed client');
      assert(renderer.windows[f.hwnd].visible, 'normal placement shows window');
      assert.deepEqual(run(f).map(m => m[0]), [0x46, 0x47], 'unchanged size/position derives neither MOVE nor SIZE');
    }
    const consuming = make({ consume: true });
    assert.deepEqual(run(consuming).map(m => m[0]), [0x46, 0x47], 'consumed CHANGED suppresses derived messages');
    console.log('PASS ordinary hidden/visible/latest-client/unchanged/consuming controls');
  }
  if (['all', 'snapshot'].includes(group)) {
    const f = make({ trigger: 0x46, mutate: true }); run(f);
    assert.equal(get(f.p + 8), 2, 'guest really overwrote caller-owned showCmd');
    assert.equal(!!renderer.windows[f.hwnd]._minimized, false, 'outer invocation must retain its normal showCmd');
    console.log('PASS invocation-owned placement snapshot');
  }
  if (['all', 'nested'].includes(group)) {
    for (const trigger of [0x46, 0x47, 3, 5]) {
      const nested = e.guest_alloc(44) >>> 0; placementData(nested, 280, 200);
      const f = make({ trigger, nested }), ms = run(f);
      assert.equal(get(f.obs + 8), 1, 'nested placement entered');
      const win = renderer.windows[f.hwnd];
      assert.equal(win.w, trigger === 0x46 ? 300 : 280, 'later commit wins');
      assert.equal(ms.filter(m => m[0] === 5).at(-1)[2], e.pn_client(f.hwnd) >>> 0, 'last size describes latest client');
      assert.equal(get(f.obs + 4), 1);
    }
    for (const trigger of [0x46, 0x47, 3, 5]) {
      const f = make({ trigger, destroy: true }); run(f);
      assert.equal(get(f.obs + 8), 1); assert.equal(e.pn_live(f.hwnd), -1);
      assert.equal(get(f.obs + 4), 0, 'destroyed placement fails without showing target');
    }
    console.log('PASS nested placement and destruction at CHANGING/CHANGED/MOVE/SIZE');
  }
  if (['all', 'startup'].includes(group)) {
    const nested = e.guest_alloc(44) >>> 0; placementData(nested, 260, 190);
    const f = make({ hidden: true, trigger: 7, nested });
    e.pn_main(f.hwnd, 0, pack(392, 273));
    const ms = run(f), sizes = ms.filter(m => m[0] === 5);
    assert.equal(get(f.obs + 8), 1, 'startup SETFOCUS callback placed again');
    assert.equal(sizes.at(-1)[2], e.pn_client(f.hwnd) >>> 0, 'startup size is latest client after nested placement');
    assert.notEqual(sizes.at(-1)[2], pack(392, 273), 'creation-time dimensions rejected');
    assert.equal(get(f.obs + 4), 1, 'first-show placement BOOL survives startup continuation');
    e.pn_main(sentinel.hwnd, 1, 0);
    for (const trigger of [0x1c, 6, 7]) {
      const destroyed = make({ hidden: true, trigger, destroy: true });
      e.pn_main(destroyed.hwnd, 0, pack(392, 273));
      const delivered = run(destroyed);
      assert.equal(e.pn_live(destroyed.hwnd), -1);
      assert.equal(get(destroyed.obs + 4), 0, 'startup destruction returns through its own frame');
      const after = delivered.slice(delivered.findIndex(m => m[0] === trigger) + 1);
      assert(!after.some(m => [6, 7, 3, 5].includes(m[0])), 'no startup callbacks after target destruction');
      e.pn_main(sentinel.hwnd, 1, 0);
    }
    console.log('PASS startup latest-client after activation callback');
  }
  if (['all', 'queued'].includes(group)) {
    const f = make(), msg = e.guest_alloc(32) >>> 0; run(f);
    for (const peek of [1, 0]) {
      e.pn_main(f.hwnd, 1, pack(392, 273));
      renderer.inputQueue.length = 0;
      e.pn_fetch(msg, peek);
      assert.equal(get(msg + 4), 5, 'pending main WM_SIZE selected');
      assert.equal(get(msg + 12), e.pn_client(f.hwnd) >>> 0, 'queued startup reads latest client');
    }
    e.pn_main(sentinel.hwnd, 1, 0);
    console.log('PASS PeekMessage/GetMessage startup current-client payload');
  }
  if (['all', 'state'].includes(group)) {
    const f = make();
    for (const [cmd, minimized, maximized] of [[3, false, true], [2, true, true], [9, false, true], [1, false, false]]) {
      placementData(f.p, 300, 220, cmd); run(f);
      const win = renderer.windows[f.hwnd];
      assert.equal(!!win._minimized, minimized, 'showCmd ' + cmd);
      assert.equal(!!win._maximized, maximized, 'showCmd ' + cmd);
      if (!minimized) assert.equal(e.pn_client(f.hwnd) >>> 0, pack(win.clientRect.w, win.clientRect.h), 'state transition keeps client mirror current');
    }
    console.log('PASS placement maximize/minimize/restore/normal state controls');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
