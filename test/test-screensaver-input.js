#!/usr/bin/env node
'use strict';
// Small production closure, not a full VM/browser test. Window metadata, heap,
// GDI and shell are bounded adapters. Native creation, dispatch, selection,
// press/release/cancel, notification and mouse activation are compiled source.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const vm = require('node:vm'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { compile } = require('../tools/watx');
const root = path.resolve(__dirname, '..');
function read(p) {
  return fs.existsSync(path.join(root, p)) ? fs.readFileSync(path.join(root, p), 'utf8')
    : cp.execFileSync('git', ['show', `HEAD:${p}`], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
}
// Balanced source forms: comments and strings must not affect nesting.
function formAt(s, start) {
  let depth = 0, quoted = false, line = false, block = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '(' && n === ';') { block++; i++; } else if (c === ';' && n === ')') { block--; i++; } continue; }
    if (quoted) { if (c === '\\') i++; else if (c === '"') quoted = false; continue; }
    if (c === ';' && n === ';') { line = true; i++; continue; }
    if (c === '(' && n === ';') { block++; i++; continue; }
    if (c === '"') { quoted = true; continue; }
    if (c === '(') depth++; else if (c === ')' && --depth === 0) return s.slice(start, i + 1);
  }
  throw Error('Unclosed form');
}
const files = cp.execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', 'src'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(p => p.endsWith('.wat'));
const funcs = new Map(), globals = new Map(), layouts = new Map();
for (const p of files) {
  const s = read(p);
  for (const m of s.matchAll(/\((func|global|layout)\s+(\$?[\w.-]+)/g)) {
    const map = m[1] === 'func' ? funcs : m[1] === 'global' ? globals : layouts;
    if (!map.has(m[2].replace(/^\$/, ''))) map.set(m[2].replace(/^\$/, ''), formAt(s, m.index));
  }
}
const strip = s => s.replace(/;;[^\n]*/g, '');
const calls = s => [...strip(s).matchAll(/\(call\s+\$([\w.-]+)/g)].map(m => m[1]);
const wanted = new Set([
  'ctrl_create_child', 'wnd_send_message', 'wnd_send_message_inner', 'wat_wndproc_dispatch',
  'control_wndproc_dispatch', 'ctrl_notify_parent', 'button_wndproc', 'button_activate',
  'button_cancel_press', 'listbox_wndproc', 'static_wndproc', 'ctrl_text_dup',
  'message_mouse_activate32', 'mouse_message_is_down', 'mouse_activate_query_lparam',
  'mouse_target_is_active', 'mouse_answer_activates', 'mouse_answer_eats',
  'mouse_activate_default', 'mouse_activate_parent', 'mouse_activate_defproc',
  'msg_store_input_tail', 'lb_append_unsorted', 'lb_row_height',
  'listbox_vscroll_visible', 'listbox_visible_rows', 'listbox_scroll_to',
  'capture_replace', 'capture_live',
  'set_focus', 'focus_target_allowed', 'focus_notify_transfer', 'focus_publish',
  'focus_transfer_current', 'ctrl_style_disabled', 'active_window_transition_reason',
  'active_window_publish',
]);
// Include the production state accessors, including layout.field instructions.
for (const [name, body] of funcs) if (/^(btn_|lb_|static_)/.test(name) && !calls(body).length) wanted.add(name);
const applet = read('src/09ca-screensavers.wat');
async function fixture({ baseline = false, mutation = null } = {}) {
  let app = baseline ? cp.execFileSync('git', ['show', '4c98907328917f5917a59445bb4d5ce3e2caca09:src/09ca-screensavers.wat'], { cwd: root, encoding: 'utf8' }) : applet;
  if (mutation === 'no-input') app = app.replace('(call $host_check_input)', '(i32.const 0)');
  if (mutation === 'wrong-target') app = app.replace('(local.set $target (call $host_check_input_hwnd (global.get $focus_hwnd)))', '(local.set $target (global.get $scrsave_hwnd))');
  if (mutation === 'no-activation') app = app.replace('(call $message_mouse_activate32 (global.get $scrsave_msg))', '(i32.const 0)');
  let native = [...wanted].map(n => { assert.ok(funcs.has(n), n); return funcs.get(n); }).join('\n');
  if (mutation === 'no-notification') native = native.replace('(call $ctrl_notify_parent\n              (local.get $parent)', '(call $ctrl_notify_parent\n              (i32.const 0)');
  const own = new Set([...wanted, ...[...app.matchAll(/\(func\s+\$([\w.-]+)/g)].map(m => m[1])]);
  const deps = [...new Set(calls(native + app))].filter(n => !own.has(n));
  function signature(n) {
    const f = strip(funcs.get(n) || '');
    assert.ok(f, `Missing signature ${n}`);
    let s = f.slice(f.indexOf(n) + n.length), out = '';
    while (true) {
      s = s.trimStart(); const m = s.match(/^\((param|result|export)\b/); if (!m) break;
      const v = formAt(s, 0); if (m[1] !== 'export') out += v.replace(/ptr<[^>]+>/g, 'i32') + ' ';
      s = s.slice(v.length);
    }
    return out;
  }
  const imports = deps.map(n => `(import "f" "${n}" (func $${n} ${signature(n)}))`).join('\n');
  const globalNames = [...new Set([...strip(native + app).matchAll(/\(global\.(?:get|set)\s+\$([\w.-]+)/g)].map(m => m[1]))]
    .filter(n => !new RegExp(`\\(global \\$${n}\\b`).test(app));
  const globalText = globalNames.map(n => {
    const original = globals.get(n) || ''; const c = original.match(/\((i32|i64|f32|f64)\.const\s+([^\s)]+)\)/);
    const type = c?.[1] || 'i32', value = n === 'next_hwnd' ? 100 : c?.[2] || 0;
    return `(global $${n} (mut ${type}) (${type}.const ${value}))`;
  }).join('\n');
  const layoutNames = new Set([...strip(native).matchAll(/(?:ptr<|\(load\.field(?:\.memarg)?\s+|\(store\.field(?:\.memarg)?\s+|\(layout\.size\s+)([\w]+)/g)].map(m => m[1]));
  const layoutText = [...layoutNames].map(n => { assert.ok(layouts.has(n), n); return layouts.get(n); }).join('\n');
  const text = `${imports}\n(memory 16) (export "memory" (memory 0))
    (region.declare-fixed $SCRSAVE_TEXT (base 0x1000) (size 4096) (align 16))
    ${layoutText}\n${globalText}\n${app}\n${native}
    (func (export "send") (param i32 i32 i32 i32) (result i32) (call $wnd_send_message (local.get 0) (local.get 1) (local.get 2) (local.get 3)))
    (func (export "focus") (param i32) (global.set $focus_hwnd (local.get 0)))
    (func (export "active") (result i32) (global.get $active_hwnd))
    (func (export "capture") (result i32) (global.get $capture_hwnd))
    (func (export "posts") (param i32) (global.set $post_queue_count (local.get 0)))
  `;
  const result = compile(text, new Map(), { standardWat: true, runtimeBuiltins: false, tailCalls: true });
  assert.ok(result.success, result.error);
  const wasmHash = createHash('sha256').update(result.wasmBinary).digest('hex');
  console.log(`closure ${baseline ? 'candidate-baseline' : mutation || 'fixed'} ${result.wasmBinary.length} bytes sha256 ${wasmHash}`);
  let e, heap = 0x10000, now = 0, foreground = 0;
  const windows = new Map(), freed = [], launches = [], notifications = [], activation = [];
  const mem = () => new DataView(e.memory.buffer);
  const str = p => { const b = new Uint8Array(e.memory.buffer); let end = p; while (b[end]) end++; return Buffer.from(b.slice(p, end)).toString('latin1'); };
  const get = h => windows.get(h);
  const alloc = n => { const p = heap; heap += (n + 7) & ~7; assert.ok(heap < 1048576); return p; };
  const f = Object.fromEntries(deps.map(n => [n, () => { throw Error(`Unexpected peripheral call ${n}`); }]));
  let r;
  Object.assign(f, {
    g2w: p => p, w2g: p => p, gl32: p => { assert.ok(!freed.includes(p), 'read freed scratch'); return mem().getInt32(p, true); },
    gs32: (p, v) => { assert.ok(!freed.includes(p), 'write freed scratch'); mem().setInt32(p, v, true); },
    heap_alloc: alloc, heap_free: p => { if (p) freed.push(p); }, strlen: p => str(p).length,
    memcpy: (d, s, n) => new Uint8Array(e.memory.buffer).copyWithin(d, s, s + n),
    memset: (p, v, n) => new Uint8Array(e.memory.buffer).fill(v, p, p + n),
    wat_str_to_heap: (p, n) => { const d = alloc(n + 1); new Uint8Array(e.memory.buffer).copyWithin(d, p, p + n); return d; },
    wnd_table_set: (h, proc) => windows.set(h, { h, proc, parent: 0, state: 0, style: 0, cls: 0, id: 0 }),
    wnd_table_get: h => get(h)?.proc || 0, wnd_table_find: h => get(h) ? h : -1,
    wnd_set_style: (h, v) => { get(h).style = v; return 1; }, wnd_get_style: h => get(h)?.style || 0,
    wnd_set_parent: (h, p) => { get(h).parent = p; }, wnd_get_parent: h => get(h)?.parent || 0,
    wnd_get_owner: () => 0, wnd_get_state_ptr: h => get(h)?.state || 0,
    wnd_set_state_ptr: (h, p) => { get(h).state = p; },
    ctrl_table_set: (h, cls, id) => Object.assign(get(h), { cls, id }),
    ctrl_table_get_class: h => get(h)?.cls || 0, ctrl_table_get_id: h => get(h)?.id || 0,
    ctrl_geom_set: (h, x, y, w, height) => Object.assign(get(h), { x, y, w, height }),
    ctrl_get_wh_packed: h => (get(h).height << 16) | get(h).w,
    ctrl_get_h: h => get(h).height, ctrl_get_w: h => get(h).w,
    ctrl_is_subclassed: () => 0, tab_native_is: () => 0, statusbar_native_is: () => 0,
    dialog_proc_get: () => 0, wnd_is_effectively_visible: () => 0,
    host_create_window: (h, style, x, y, w, height) => { Object.assign(get(h), { x, y, w, height }); return 1; },
    title_table_set() {}, nc_flags_set() {}, defwndproc_do_nccalcsize() {}, defwndproc_do_ncpaint() {}, dlg_fill_bkgnd() {},
    gdi_dc_set_field: () => 1, host_erase_background: () => 1,
    paint_scratch_mark: () => 0, paint_scratch_reset() {}, paint_flag_set_inv() {},
    ctrl_paint_trace_emit() {}, invalidate_hwnd() {}, paint_drain_native_control_paints: () => 0,
    paint_select_next_dirty: () => 0, paint_flag_clear_hwnd() {}, paint_seed_child_paints: () => 0, update_validate_rect: () => 1,
    wnd_get_thread: () => 0, wnd_min_get: () => 0,
    wnd_z_raise_owner_group() {}, wnd_note_active_popup() {}, host_invalidate_frame() {},
    btn_clear_sibling_default() {}, btn_restore_real_default() {},
    wnd_top_level: h => { while (get(h)?.parent) h = get(h).parent; return h; },
    win16_is_far_proc: () => 0, host_foreground_window: () => foreground,
    host_activate_window: h => { activation.push(h); foreground = h; return h; },
    wnd_mouse_msg_origin_x: h => get(h)?.x || 0, wnd_mouse_msg_origin_y: h => get(h)?.y || 0,
    host_get_ticks: () => now,
    host_shell_execute: (h, op, p) => { launches.push(str(p)); return 33; },
    wnd_destroy_tree: h => { for (const [k, w] of windows) if (k === h || w.parent === h) windows.delete(k); },
    host_destroy_window() {},
    post_queue_base: () => 0x8000, shared_post_queue_read: () => 0,
    post_queue_push: (h, msg, wp, lp) => {
      notifications.push([h, msg, wp, lp]);
      [h, msg, wp, lp].forEach((v, i) => mem().setInt32(0x8000 + (notifications.length - 1) * 16 + i * 4, v, true));
      e.posts(notifications.length); return 1;
    },
  });
  // Execute the browser's actual owned dequeue imports, not a test queue consumer.
  const hostSource = read('host.js');
  const inputBlock = hostSource.slice(hostSource.indexOf('    h.check_input = () => {'), hostSource.indexOf('    // Wire thread/event imports'));
  const routing = require('../lib/host-window');
  const self = { renderer: null, processId: 7, _hwndBase: 100, _multiApp: true, logToUI() {} };
  const ctx = {};
  const h = {};
  vm.runInNewContext(inputBlock, { h, self, ctx, inputEventHwnd: routing.inputEventHwnd, Object });
  for (const name of ['check_input', 'check_input_hwnd', 'check_input_wparam', 'check_input_lparam']) f['host_' + name] = h[name];
  ({ exports: e } = await WebAssembly.instantiate(new WebAssembly.Module(result.wasmBinary), { f }));
  const sandbox = { module: { exports: {} }, console, require: n => n === './region-map.generated' ? require('../lib/region-map.generated') : {} };
  vm.runInNewContext(read('lib/renderer-input.js'), sandbox);
  class Renderer {} sandbox.module.exports.installInputHandlers(Renderer); r = new Renderer();
  const wasm = { exports: { ...e, ctrl_get_class: h => get(h)?.cls || 0,
    get_capture_hwnd: () => e.capture(), send_message: e.send,
    wnd_top_level: f.wnd_top_level, wnd_mouse_msg_origin_x: () => 100,
    wnd_mouse_msg_origin_y: () => 100 } };
  ctx.instance = wasm; self.instance = wasm; self.renderer = r;
  Object.assign(r, { wasm, windows: {}, inputQueue: [], _inputNowMs: () => now,
    _mapExclusiveInputPoint: (x, y) => ({ x, y }), _applyCursorClip: (x, y) => ({ x, y }),
    _mouseMaskForButton: () => 1, _queueDirectInputMouseButton() {}, _signalDirectInputDevice() {}, _setMousePoint() {},
    _modalDialogHwnd: () => 0, _openMenuContext: () => null, _windowRectScreen: w => w,
    _isMouseInputDisabled: () => false, _hasCaption: () => true, _hasMenuBar: () => false,
    _mouseMsgOriginScreen: () => ({ x: 68, y: 71 }), _applyPointerInputHooks: (w, x, y) => ({ x, y, snapped: false }),
    _nativeScrollbarHit: () => null, _wakeMessageWait() {}, _traceInput() {}, scheduleRepaint() {}, repaint() {},
  });
  const hwnd = e.scrsave_open(); assert.ok(hwnd);
  const win = { hwnd, style: 0x10cf0000, x: 64, y: 48, w: 468, h: 322, visible: true, wasm, processId: 7 };
  for (const [h, w] of windows) r.windows[h] = { ...win, hwnd: h, isChild: h !== hwnd };
  r._inputWindowAtPoint = () => win;
  let target;
  r._hitTestDeepChild = () => ({ hwnd: target, sx: 100, sy: 100 });
  function down(h, y = 8) { target = h; r.handleMouseDown(108, 100 + y, 1); }
  function up(h, x = 8, y = 8) { target = h; r.handleMouseUp(100 + x, 100 + y, 1); }
  function pump() { now += 50; const v = e.wat_app_pump(); notifications.length = 0; return v; }
  return { e, r, windows, freed, launches, activation, hwnd, down, up, pump, str, mem, wasmHash, wasmBytes: result.wasmBinary.length, funcs: wanted.size };
}
async function exercise(options) {
  const f = await fixture(options), { e } = f;
  const byId = id => [...f.windows.values()].find(w => w.id === id).h;
  const list = byId(0x500), preview = byId(1), close = byId(2);
  assert.equal(e.send(list, 0x18b, 0, 0), 19, 'real listbox inserted catalog');
  // A foreign process event ahead of ours must remain available to its owner.
  const foreign = { type: 'mouse', hwnd: 9999, msg: 0x201, wParam: 1, lParam: 8 };
  f.r.windows[9999] = { processId: 8 }; f.r.inputQueue.push(foreign);
  f.down(list, 36); f.pump();
  assert.equal(e.send(list, 0x188, 0, 0), 2, 'renderer DOWN selects real listbox row 2');
  const text = [...f.windows.values()].filter(w => w.cls === 3 && w.state)
    .map(w => f.str(f.mem().getUint32(w.state, true)));
  assert.ok(text.includes('ARCHITEC.SCR'), 'real native list notification updates real STATIC text');
  assert.ok(f.activation.length, 'USER mouse activation ran');
  assert.equal(e.active(), f.hwnd, 'production USER transition published active window');
  assert.ok(f.r.inputQueue.includes(foreign), 'foreign input retained');
  f.up(list); f.pump(); f.pump();
  f.down(preview); f.pump();
  assert.equal(f.launches.length, 0, 'DOWN does not synthesize BN_CLICKED');
  f.up(preview); f.pump(); f.pump();
  assert.deepEqual(f.launches, ['ARCHITEC.SCR'], 'native button notification previews selected saver');
  f.down(preview); f.pump(); f.up(preview, -1); f.pump(); f.pump();
  assert.equal(f.launches.length, 1, 'captured release outside cancels');
  f.down(preview); f.pump();
  f.r._dispatchMouseEvent(f.r.windows[f.hwnd], { hwnd: preview, msg: 0x1f, wParam: 0, lParam: 0 });
  f.pump(); f.up(preview); f.pump(); f.pump();
  assert.equal(f.launches.length, 1, 'WM_CANCELMODE prevents activation');
  // More than a tick's quota remains queued, including foreign-owner input.
  for (let i = 0; i < 65; i++) f.r._dispatchMouseEvent(f.r.windows[f.hwnd],
    { hwnd: list, msg: 0x84, wParam: 0, lParam: 0 });
  f.pump();
  assert.equal(f.r.inputQueue.filter(v => v !== foreign).length, 1, '64-input bound retains remainder');
  f.pump();
  f.down(close); f.pump(); f.up(close);
  const afterClose = { hwnd: preview, msg: 0x84, wParam: 0, lParam: 0 };
  f.r._dispatchMouseEvent(f.r.windows[f.hwnd], afterClose);
  f.pump(); f.pump();
  assert.equal(e.scrsave_window(), 0, 'native Close notification destroys applet');
  assert.equal(f.windows.size, 0); assert.equal(f.freed.filter(p => p === 0x10000).length, 1, 'MSG freed once');
  assert.equal(f.pump(), 0); assert.ok(f.r.inputQueue.includes(foreign));
  assert.ok(f.r.inputQueue.includes(afterClose), 'Close stops before consuming another queued event');
  return { wasmBytes: f.wasmBytes, wasmSha256: f.wasmHash, productionFunctions: f.funcs, launches: f.launches };
}
(async () => {
  const result = await exercise({});
  await assert.rejects(() => exercise({ baseline: true }), /renderer DOWN selects real listbox row 2/);
  console.log('PASS baseline rejected at renderer DOWN -> real listbox selection');
  for (const [mutation, oracle] of [
    ['no-input', /renderer DOWN selects real listbox row 2/],
    ['wrong-target', /renderer DOWN selects real listbox row 2/],
    ['no-activation', /USER mouse activation ran/],
    ['no-notification', /native button notification previews selected saver/],
  ]) {
    await assert.rejects(() => exercise({ mutation }), oracle, mutation);
    console.log(`PASS mutation ${mutation} rejected at ${oracle.source}`);
  }
  console.log('PASS renderer -> owned host input -> compiled native listbox/button -> selection/Preview/Close; baseline FAIL, four mutations rejected', result);
})().catch(e => { console.error(e); process.exitCode = 1; });
