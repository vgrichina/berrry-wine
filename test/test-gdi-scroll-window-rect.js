#!/usr/bin/env node

'use strict';

// ScrollWindowEx's rect handling: the scroll rect bounds what moves, the clip
// rect bounds what may be touched at all, and the strip the copy vacates is
// repainted in the window background -- inside the clip only.
//
// This used to drive host.gdi_scroll_window, a JS import removed in 78d7289
// when the GDI bridge was cut down to primitives; scrolling has rasterized
// inside WAT since. Rewritten against $gdi_scroll_window, which is where the
// rect arithmetic now lives. The plain "scroll the whole client" case is
// covered by test-wat-gdi-window-surface; what is only here is the
// scroll-rect/clip-rect intersection, and that chrome stays put.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('../lib/canvas-compat');
const { createHostImports } = require('../lib/host-imports');
const { Win98Renderer } = require('../lib/renderer');
const { compileSrcWasm } = require('./compile-src');
// $GUEST_BASE, from the map declared in src/00-regions.wat.
const RegionMap = require('../lib/region-map.generated.js');

const ROOT = path.join(__dirname, '..');
const HWND = 0x10001;
const WHITE = 0x00ffffff;
let moduleBytes;
function testedModule() {
  return moduleBytes || (moduleBytes = process.env.SCROLL_WINDOW_TEST_MODULE
    ? fs.readFileSync(process.env.SCROLL_WINDOW_TEST_MODULE) : compileSrcWasm());
}

async function boot(width, height) {
  const wasm = testedModule();
  const renderer = new Win98Renderer(createCanvas(640, 480));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer, resourceJson: {}, exports: null };
  const base = createHostImports(ctx);
  base.host.memory = memory;
  for (const name of ['create_thread', 'exit_thread', 'terminate_thread', 'create_event', 'set_event',
                      'reset_event', 'wait_single', 'wait_multiple']) {
    base.host[name] = () => 0;
  }
  base.host.com_create_instance = () => 0x80004002;
  const { instance } = await WebAssembly.instantiate(wasm, base);
  ctx.exports = instance.exports;
  const wat = instance.exports;
  renderer.windows[HWND] = {
    hwnd: HWND, x: 100, y: 50, w: width, h: height, zOrder: 1,
    style: 0x10000000, visible: true, isChild: false,
    clientRect: { x: 100, y: 50, w: width, h: height },
    wasm: instance, wasmMemory: memory,
  };
  wat.wnd_table_set(HWND, 0);
  wat.ctrl_set_geom(HWND, 100, 50, width, height);
  wat.wnd_set_style_export(HWND, 0x10000000);
  return { wat, renderer };
}

// The RECT pair ScrollWindowEx takes, at WASM addresses -- $gdi_scroll_window
// reads them directly rather than through g2w.
function putRect(wat, guestPtr, l, t, r, b) {
  wat.guest_write32(guestPtr, l);
  wat.guest_write32(guestPtr + 4, t);
  wat.guest_write32(guestPtr + 8, r);
  wat.guest_write32(guestPtr + 12, b);
  return RegionMap.g2w(guestPtr, wat.get_image_base());
}

function paintPattern(wat, hdc, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Distinct per pixel and never white, so "was cleared" and "was moved"
      // can never be confused.
      wat.test_call_SetPixel(hdc, x, y, ((x + 1) | ((y + 1) << 8) | (0x40 << 16)) >>> 0);
    }
  }
}

let passed = 0;
function check(label, fn) {
  fn();
  passed++;
  console.log(`  ok  ${label}`);
}

async function main() {
  await publicFlags();
  {
    const { wat } = await boot(18, 12);
    // Client area inset from the window: 2,3 .. 14,9.
    wat.test_gdi_client_rect_set(HWND, 2, 3, 14, 9);
    const whole = wat.test_call_GetWindowDC(HWND) >>> 0;
    const client = wat.test_call_GetDC(HWND) >>> 0;
    assert(whole && client, 'both DCs must allocate');
    paintPattern(wat, whole, 18, 12);
    const chromeBefore = wat.test_call_GetPixel(whole, 1, 1) >>> 0;
    const clientTopBefore = wat.test_call_GetPixel(client, 3, 0) >>> 0;

    assert.strictEqual(wat.test_gdi_scroll_window(HWND, 0, 1, 0, 0), 1);

    check('a default scroll leaves the non-client chrome alone', () => {
      assert.strictEqual(wat.test_call_GetPixel(whole, 1, 1) >>> 0, chromeBefore);
    });
    check('client content moves by dy', () => {
      assert.strictEqual(wat.test_call_GetPixel(client, 3, 1) >>> 0, clientTopBefore);
    });
    check('the row the scroll vacated is cleared', () => {
      assert.strictEqual(wat.test_call_GetPixel(client, 3, 0) >>> 0, WHITE);
    });
  }

  {
    const { wat } = await boot(20, 10);
    wat.test_gdi_client_rect_set(HWND, 0, 0, 20, 10);
    const client = wat.test_call_GetDC(HWND) >>> 0;
    paintPattern(wat, client, 20, 10);
    const before = (x, y) => wat.test_call_GetPixel(client, x, y) >>> 0;
    const at33 = before(3, 3), at43 = before(4, 3), at76 = before(7, 6), at103 = before(10, 3);

    const scratch = wat.guest_alloc(64) >>> 0;
    const scrollRect = putRect(wat, scratch, 2, 2, 12, 7);
    const clipRect = putRect(wat, scratch + 16, 4, 2, 10, 7);
    assert.strictEqual(wat.test_gdi_scroll_window(HWND, 2, 0, scrollRect, clipRect), 1);

    check('pixels left of the clip rect are untouched', () => {
      assert.strictEqual(before(3, 3), at33);
    });
    check('the exposed strip is cleared only inside the clip', () => {
      assert.strictEqual(before(4, 3), WHITE);
    });
    check('the copy source is the clipped rect, not the scroll rect', () => {
      assert.strictEqual(before(6, 3), at43);
    });
    check('the clipped copy keeps its bottom-right corner', () => {
      assert.strictEqual(before(9, 6), at76);
    });
    check('pixels right of the clip rect are untouched', () => {
      assert.strictEqual(before(10, 3), at103);
    });
  }

  console.log(`PASS test-gdi-scroll-window-rect (${passed} checks)`);
}

// Public API regression: a real HWND, DLL exports resolved through the loader,
// x86 stdcall calls and an application window procedure. No private damage or
// window-table state is used to decide whether scrolling invalidated a window.
async function publicFlags() {
  const { bootRenderHarness } = require('./render-helper');
  const { makeFixture, iat } = require('../tools/kernel32-native-fixture');
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none',
    prebuiltModule: new WebAssembly.Module(testedModule()) });
  const pe = makeFixture();
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length)); e.set_api_log(0);
  const alloc = n => e.guest_alloc(n) >>> 0;
  const w = (p, v) => e.guest_write32(p, v);
  const r = p => e.guest_read32(p) >>> 0;
  const str = s => { const p = alloc(s.length + 1);
    Buffer.from(s + '\0').forEach((v, i) => e.guest_write8(p + i, v)); return p; };
  const stack = alloc(4096) + 2048;
  function call(entry, args) {
    w(stack, 0); args.forEach((v, i) => w(stack + 4 + i * 4, v));
    e.set_esp(stack); e.clear_yield(); e.set_eip(entry);
    for (let i = 0; i < 64 && e.get_eip(); i++) e.run(64);
    assert.strictEqual(e.get_eip(), 0, 'guest returned');
    assert.strictEqual(e.get_esp() >>> 0, stack + 4 + args.length * 4, 'stdcall ESP');
    return e.get_eax() >>> 0;
  }
  const dlls = {}, entries = {};
  function api(name, ...args) {
    if (!entries[name]) {
      const dll = /^(CreateRectRgn|DeleteObject)$/.test(name) ? 'gdi32.dll' : 'user32.dll';
      dlls[dll] ||= call(r(iat('LoadLibraryA')), [str(dll)]);
      entries[name] = call(r(iat('GetProcAddress')), [dlls[dll], str(name)]);
      assert(entries[name], name);
    }
    return call(entries[name], args);
  }
  const hwnd = api('CreateWindowExA', 0, str('STATIC'), str('Scroll flags'),
    0x90000000, 20, 30, 100, 80, 0, 0, 0x400000, 0);
  assert(hwnd);
  const child = api('CreateWindowExA', 0, str('STATIC'), str('Child scene'),
    0x50000000, 0, 0, 90, 70, hwnd, 101, 0x400000, 0);
  assert(child);
  const rect = alloc(16), scroll = alloc(16), count = alloc(4), proc = alloc(32);
  [10, 10, 70, 60].forEach((v, i) => w(scroll + i * 4, v));
  // cmp [esp+8],WM_PAINT; jne done; inc [count]; done: xor eax,eax; ret 16
  const code = [0x83, 0x7c, 0x24, 8, 15, 0x75, 6, 0xff, 5,
    count & 255, count >>> 8 & 255, count >>> 16 & 255, count >>> 24,
    0x31, 0xc0, 0xc2, 16, 0];
  code.forEach((v, i) => e.guest_write8(proc + i, v));
  assert(api('SetWindowLongA', hwnd, -4, proc));
  assert(api('SetWindowLongA', child, -4, proc));
  const region = api('CreateRectRgn', 0, 0, 0, 0); assert(region);
  const failures = [];
  for (const target of [hwnd, child]) for (const flags of [0, 2]) {
    api('ValidateRect', target, 0); w(count, 0);
    assert.strictEqual(api('GetUpdateRect', target, rect, 0), 0, 'clean setup');
    assert(api('GetWindowRect', target, rect));
    const geometry = [0, 4, 8, 12].map(o => r(rect + o));
    const complexity = api('ScrollWindowEx', target, 4, 0, scroll, 0, 0, 0, flags);
    assert(complexity >= 1 && complexity <= 3, 'ScrollWindowEx succeeds');
    const updateRect = api('GetUpdateRect', target, rect, 0);
    const updateRgn = api('GetUpdateRgn', target, region, 0);
    api('UpdateWindow', target);
    const paints = r(count);
    const pass = flags === 0 ? updateRect === 0 && updateRgn === 1 && paints === 0
      : updateRect === 1 && updateRgn > 1 && paints === 1;
    console.log(JSON.stringify({ target, flags, updateRect, updateRgn, paints, pass }));
    if (!pass) failures.push(flags);
    assert(api('GetWindowRect', target, rect));
    assert.deepStrictEqual([0, 4, 8, 12].map(o => r(rect + o)), geometry);
  }
  // Existing damage outside the scrolled rectangle survives a flags=0 copy.
  api('ValidateRect', hwnd, 0);
  [1, 1, 3, 3].forEach((v, i) => w(rect + i * 4, v));
  api('InvalidateRect', hwnd, rect, 0);
  api('ScrollWindowEx', hwnd, 4, 0, scroll, 0, 0, 0, 0);
  assert.strictEqual(api('GetUpdateRect', hwnd, rect, 0), 1);
  assert.deepStrictEqual([0, 4, 8, 12].map(o => r(rect + o)), [1, 1, 3, 3],
    'flags=0 must preserve existing unrelated damage without expanding it');
  // The older API still has unconditional invalidation semantics.
  api('ValidateRect', hwnd, 0); w(count, 0);
  assert(api('ScrollWindow', hwnd, 4, 0, scroll, 0));
  assert.strictEqual(api('GetUpdateRect', hwnd, rect, 0), 1);
  api('UpdateWindow', hwnd);
  assert.strictEqual(r(count), 1, 'ScrollWindow still requests paint');
  api('ValidateRect', hwnd, 0);
  api('DeleteObject', region); api('DestroyWindow', hwnd);
  assert.deepStrictEqual(failures, [], 'flags=0 stays valid; SW_INVALIDATE queues public damage and WM_PAINT');
  console.log('PASS public ScrollWindowEx flags, update queries and WM_PAINT callback');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
