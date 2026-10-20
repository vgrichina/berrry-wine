#!/usr/bin/env node
'use strict';
// Bounded actual-source routing closure. Metadata and wndproc delivery are
// adapters; selection, WS_CHILD ancestry, coordinate conversion, recursive
// control hit testing and dialog DOWN/UP capture run production code.
// No WM_COMMAND is injected and no installer completion is asserted.
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { compile } = require('../tools/watx');
// Win32 window-style bit 27: an input-state flag, not a linear-memory address.
const WS_DISABLED = 1 << 27;
const root = path.resolve(__dirname, '..');
function source(p) {
  return fs.existsSync(path.join(root, p)) ? fs.readFileSync(path.join(root, p), 'utf8')
    : cp.execFileSync('git', ['show', `HEAD:${p}`], { cwd: root, encoding: 'utf8', maxBuffer: 4e6 });
}
function form(s, start) {
  let depth = 0, quote = false, line = false, block = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) {
      if (c === '(' && n === ';') { block++; i++; }
      else if (c === ';' && n === ')') { block--; i++; }
      continue;
    }
    if (quote) { if (c === '\\') i++; else if (c === '"') quote = false; continue; }
    if (c === ';' && n === ';') { line = true; i++; continue; }
    if (c === '(' && n === ';') { block++; i++; continue; }
    if (c === '"') { quote = true; continue; }
    if (c === '(') depth++;
    if (c === ')' && --depth === 0) return s.slice(start, i + 1);
  }
  throw Error('Unclosed production form');
}
const functions = new Map();
for (const p of ['src/10-helpers.wat', 'src/09c3a-dialog-runtime.wat', 'src/09c3-controls.wat']) {
  const s = source(p);
  for (const m of s.matchAll(/\(func\s+\$([\w.-]+)/g)) functions.set(m[1], form(s, m.index));
}
const names = ['wnd_top_level', 'dialog_route_mouse', 'dialog_route_mouse_screen', 'ctrl_style_disabled'];
let native = names.map(n => { assert(functions.has(n), n); return functions.get(n); }).join('\n');
if (process.argv.includes('--mutate-owner-as-parent')) {
  const guard = '(br_if $done (i32.eqz (i32.and (call $wnd_get_style (local.get $cur)) (i32.const 0x40000000))))';
  assert(native.includes(guard));
  native = native.replace(guard, '');
}
const signatures = {
  wnd_get_style: [1, 1], wnd_get_parent: [1, 1],
  wnd_next_child_slot: [2, 1], wnd_slot_hwnd: [1, 1],
  ctrl_table_get_class: [1, 1], wnd_is_effectively_visible: [1, 1],
  ctrl_get_xy_packed: [1, 1], ctrl_get_wh_packed: [1, 1],
  combobox_hit_h: [2, 1], combobox_close_dropdown: [2, 0],
  wnd_send_message: [4, 1], wnd_client_screen_x: [1, 1], wnd_client_screen_y: [1, 1],
};
const imports = Object.entries(signatures).map(([n, [argc, result]]) =>
  `(import "f" "${n}" (func $${n} (param ${'i32 '.repeat(argc)}) ${result ? '(result i32)' : ''}))`).join('\n');
const text = `${imports}
  (global $dialog_button_capture_parent (mut i32) (i32.const 0))
  (global $dialog_button_capture_hwnd (mut i32) (i32.const 0))
  (global $combo_open_hwnd (mut i32) (i32.const 0))
  ${native}
  (export "wnd_top_level" (func $wnd_top_level))
  (export "dialog_route_mouse_screen" (func $dialog_route_mouse_screen))`;
const compiled = compile(text, new Map(), { standardWat: true, runtimeBuiltins: false });
assert(compiled.success, compiled.error);
console.log(`production routing closure ${compiled.wasmBinary.length} bytes sha256 ${
  createHash('sha256').update(compiled.wasmBinary).digest('hex')}`);

// Load the actual renderer input module; --baseline uses the pre-fix Git blob.
const baseline = process.argv.includes('--baseline');
let input = baseline ? cp.execFileSync('git', ['show', 'aaf8599291b278b5cf1b9e53c654b5bb8cd5dfe6:lib/renderer-input.js'],
  { cwd: root, encoding: 'utf8' }) : source('lib/renderer-input.js');
if (process.argv.includes('--mutate-reverse-z')) {
  assert(input.includes('this._compareTopLevelZ(bTop, aTop)'));
  input = input.replace('this._compareTopLevelZ(bTop, aTop)', 'this._compareTopLevelZ(aTop, bTop)');
}
const moduleContext = { module: { exports: {} }, console, performance, Date, setTimeout, clearTimeout };
moduleContext.require = name => {
  assert(['./region-map.generated', './mem-utils'].includes(name));
  const context = { module: { exports: {} }, require: moduleContext.require };
  vm.runInNewContext(source(`lib/${name.slice(2)}.js`), context);
  return context.module.exports;
};
vm.runInNewContext(input, moduleContext, { filename: 'lib/renderer-input.js' });
class Renderer {}
moduleContext.module.exports.installInputHandlers(Renderer);
// These small renderer methods are also evaluated verbatim, not reimplemented.
const rendererSource = source('lib/renderer.js');
for (const name of ['_isWindowClass', '_compareTopLevelZ']) {
  const start = rendererSource.indexOf(`  ${name}(`);
  const end = rendererSource.indexOf('\n  }\n', start) + 5;
  const object = vm.runInNewContext(`({${rendererSource.slice(start, end)}})`);
  Renderer.prototype[name] = object[name];
}
const pack = (x, y) => ((y & 65535) << 16) | (x & 65535);
function run(label, configure, expected, point = [415, 395], options = {}) {
  const delivered = [], selected = [];
  // stop-command snapshot x/y for progress are parent-client relative.
  // Outer client (3,23) makes its screen rect (158,327), client (161,350).
  const records = [
    { hwnd: 0x10001, x: 0, y: 0, w: 640, h: 480, zOrder: 1, style: 0x10c00000 },
    { hwnd: 0x1000f, x: 155, y: 304, sx: 158, sy: 327, w: 323, h: 139,
      zOrder: 2, style: 0x50c000c0, parentHwnd: 0x10001, isChild: true, isDialog: true },
    { hwnd: 0x1006b, x: 80, y: 59, w: 480, h: 362, zOrder: 3,
      style: 0x90c800c0, parentHwnd: 0x10001, ownerHwnd: 0x10001, isDialog: true },
    { hwnd: 0x10077, x: 295, y: 301, w: 75, h: 23, style: 0x50000001,
      parentHwnd: 0x1006b, cls: 1, control: true },
  ];
  configure(records);
  const get = h => records.find(r => r.hwnd === h);
  const origin = h => { const r = get(h); return { x: (r.sx ?? r.x) + 3, y: (r.sy ?? r.y) + 23 }; };
  const f = {
    wnd_get_style: h => get(h)?.style || 0, wnd_get_parent: h => get(h)?.parentHwnd || 0,
    wnd_next_child_slot: (h, slot) => records.findIndex((r, i) => i >= slot && r.control && r.parentHwnd === h),
    wnd_slot_hwnd: slot => records[slot].hwnd, ctrl_table_get_class: h => get(h)?.cls || 0,
    wnd_is_effectively_visible: h => get(h)?.visible === false ? 0 : 1,
    ctrl_get_xy_packed: h => pack(get(h).x, get(h).y),
    ctrl_get_wh_packed: h => pack(get(h).w, get(h).h),
    combobox_hit_h: () => { throw Error('unexpected combo'); },
    combobox_close_dropdown: () => { throw Error('unexpected combo'); },
    wnd_send_message: (hwnd, msg, wParam, lParam) => { delivered.push({ hwnd, msg, wParam, lParam }); return 0; },
    wnd_client_screen_x: h => origin(h).x, wnd_client_screen_y: h => origin(h).y,
  };
  const instance = new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary), { f });
  const wasm = { exports: { ...instance.exports, wnd_get_style_export: f.wnd_get_style,
    wnd_client_screen_x: f.wnd_client_screen_x, wnd_client_screen_y: f.wnd_client_screen_y } };
  const r = new Renderer();
  r.wasm = wasm; r.windows = {}; r.inputQueue = [];
  for (const rec of records.filter(r => !r.control)) r.windows[rec.hwnd] = { visible: true, ...rec, wasm };
  r._mapExclusiveInputPoint = (x, y) => ({ x, y });
  r._applyCursorClip = (x, y) => ({ x, y });
  r._computeClientRect = w => { w.clientRect = { ...origin(w.hwnd), w: w.w - 6, h: w.h - 26 }; };
  r._raiseWindowGroup = w => selected.push(w.hwnd);
  r._setKeyboardInputOwner = () => {};
  for (const name of ['_queueDirectInputMouseButton', '_signalDirectInputDevice',
    '_wakeMessageWait', 'scheduleRepaint', 'repaint']) r[name] = () => {};
  r._setMousePoint = (x, y) => { r._mouseX = x; r._mouseY = y; };
  r._openMenuContext = () => null;
  r._hasCaption = () => true;
  r._hasMenuBar = () => false;
  r._modalDialogHwnd = () => options.modal || 0;
  r._handleNativeScrollbarUp = () => false;
  // Stop only after the production sorter has chosen the wrong surface, before
  // the unrelated generic guest-message pump (not part of this bounded slice).
  const rootRoute = r._dialogMouseRouteRoot;
  r._dialogMouseRouteRoot = function(w) {
    assert.equal(w.hwnd, expected, `${label}: real DOWN chose wrong dialog`);
    return rootRoute.call(this, w);
  };
  r.handleMouseDown(...point, 1);
  r.handleMouseUp(...point, 1);
  if (options.blocked) {
    assert.deepEqual(selected, [], label + ': no activation');
    assert.deepEqual(delivered, [], label + ': no control delivery');
    console.log(`PASS ${label}: blocked before activation or control delivery`);
    return;
  }
  if (options.modal) assert.deepEqual(selected, [], label + ': modal route bypasses activation');
  else assert.equal(selected[0], expected, label);
  assert.deepEqual(delivered.map(m => [m.hwnd, m.msg]), [[0x10077, 0x201], [0x10077, 0x202]], label);
  assert.equal(delivered[0].lParam, pack(point[0] - origin(expected).x - get(0x10077).x,
    point[1] - origin(expected).y - get(0x10077).y), label + ': child coordinates');
  assert(!delivered.some(m => m.msg === 0x111), 'no command injection');
  console.log(`PASS ${label}: ordinary renderer DOWN/UP -> compiled child routing`);
}
run('captured Components over smaller progress', () => {}, 0x1006b);
run('progress area made larger does not change popup target', a => { a[1].w = 600; a[1].h = 400; }, 0x1006b);
run('hidden progress', a => { a[1].visible = false; }, 0x1006b);
run('embedded wizard page still precedes its frame', a => {
  a[2].style = 0x50c800c0; a[2].isChild = true; a[2].ownerHwnd = 0;
  a[1].visible = false;
  // Make the frame a dialog, as with embedded InstallShield/NSIS pages.
  a[0].isDialog = true;
}, 0x1006b);
run('other popup on top wins regardless of area', a => {
  a[1].isChild = false; a[1].ownerHwnd = 0x10001; a[1].style = 0x90c800c0;
  a[1].zOrder = 4; a[1].x = 158; a[1].y = 327;
  a[3].parentHwnd = 0x1000f; a[3].x = 220; a[3].y = 30;
}, 0x1000f);
run('child z-order cannot escape its lower top-level tree', a => {
  a[1].zOrder = 999;
}, 0x1006b);
run('raised owner tree wins over lower owned popup', a => {
  // Keep this bounded control adapter rooted at the selected dialog.
  a[0].isDialog = true;
  a[0].zOrder = 9;
  a[3].parentHwnd = 0x1000f; a[3].x = 220; a[3].y = 30;
}, 0x1000f);
run('nested child ancestry reaches the original top-level tree', a => {
  a.push({ hwnd: 0x10090, parentHwnd: 0x10001, style: 0x50000000,
    isChild: true, x: 0, y: 0, w: 640, h: 480, zOrder: 999 });
  a[1].parentHwnd = 0x10090;
}, 0x1006b);
run('same-tree smaller page precedes larger sibling despite sibling z', a => {
  a[0].isDialog = true;
  a[2].style = 0x50c800c0; a[2].isChild = true; a[2].ownerHwnd = 0;
  a[1].w = 500; a[1].h = 400; a[1].zOrder = 999;
}, 0x1006b);
run('active modal bypasses conflicting candidate z-order', a => {
  a[0].zOrder = 99;
}, 0x1006b, [415, 395], { modal: 0x1006b });
run('outside active modal blocks underlying surface', () => {},
  0x1006b, [600, 450], { modal: 0x1006b, blocked: true });
run('disabled top dialog does not activate lower surface', a => {
  a[2].style |= WS_DISABLED;
}, 0x1006b, [415, 395], { blocked: true });
