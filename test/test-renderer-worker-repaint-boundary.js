#!/usr/bin/env node
'use strict';

// Brokered Worker imports yield to the browser between GDI primitives. A
// repaint requested by the erase at the start of WM_PAINT must wait until the
// guest slice has also drawn its text/content, matching cooperative execution.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Win98Renderer } = require('../lib/renderer');
const { readWatSourceClosure } = require('./wat-source-closure');

const ROOT = path.resolve(__dirname, '..');
const watSource = readWatSourceClosure();
const hostImports = fs.readFileSync(path.join(ROOT, 'lib/host-imports.js'), 'utf8');
const browserHost = fs.readFileSync(path.join(ROOT, 'host.js'), 'utf8');
const guestRpc = fs.readFileSync(path.join(ROOT, 'lib/guest-rpc.js'), 'utf8');
assert(watSource.includes('(call $host_paint_begin (local.get $arg0))'),
  'BeginPaint must notify the host of its paint lifetime');
assert(watSource.includes('(call $host_paint_end (local.get $arg0))'),
  'EndPaint must notify the host of its paint completion');
assert(watSource.includes('(call $host_paint_begin (local.get $hwnd))') &&
  watSource.includes('(call $host_paint_end (local.get $hwnd))'),
  'WAT-native EDIT paint must report its fill/text lifetime');
const modalPump = watSource.match(/\(func \$modal_pump_step[\s\S]*?\n  \)/);
assert(modalPump && /\(drop \(call \$wat_wndproc_dispatch[\s\S]*?\n\s*\(call \$host_invalidate \(local\.get \$hwnd\)\)/
  .test(modalPump[0]),
  'modal native-control paint completion must request a canonical composite');
assert(hostImports.includes('paint_begin: (hwnd) =>') &&
  hostImports.includes('paint_end: (hwnd) =>'),
  'host imports must forward paint notifications to the renderer');
assert(browserHost.includes("WineAssembly.versionedUrl('lib/host-import-sigs.generated.json')"),
  'Worker launch must centrally version the signature table containing paint brackets');
assert(guestRpc.includes("'paint_begin',") && guestRpc.includes("'paint_end',"),
  'value-only paint brackets must not add two blocking RPCs per control paint');
const uncoverBody = watSource.match(/\(func \$wnd_uncover_parent[\s\S]*?\n  \)/);
assert(uncoverBody && uncoverBody[0].includes('(call $update_invalidate_rect (local.get $parent)'),
  'hiding a child invalidates only its exposed parent rectangle');

const callbacks = [];
const oldRaf = global.requestAnimationFrame;
global.requestAnimationFrame = callback => {
  callbacks.push(callback);
  return callbacks.length;
};

try {
  const ctx = { imageSmoothingEnabled: true };
  const canvas = { width: 8, height: 8, getContext: () => ctx };
  const renderer = new Win98Renderer(canvas);
  renderer._isNode = false;
  let repaints = 0;
  renderer.repaint = () => { repaints++; };

  // A display DC is not an implicit double buffer. WordZap draws a splash and
  // polls time before EndPaint: the already drawn pixels must become visible.
  renderer.beginWorkerGdiPaint(0x10001);
  renderer.scheduleRepaint();
  assert.strictEqual(callbacks.length, 1,
    'cooperative BeginPaint must not lock publication');
  callbacks.shift()();
  assert.strictEqual(repaints, 1,
    'drawn pixels publish before EndPaint');
  renderer.endWorkerGdiPaint(0x10001);
  repaints = 0;

  // A synchronous modal loop can begin inside its owner's WM_PAINT and wait
  // there indefinitely for user input. Neither display DC lifetime may lock
  // publication; this requires no special-case exception for modal dialogs.
  const ownerCanvas = { _waFlushCanonicalSurface: () => { ownerCanvas.flushes++; }, flushes: 0 };
  const dialogCanvas = { _waFlushCanonicalSurface: () => { dialogCanvas.flushes++; }, flushes: 0 };
  const owner = { hwnd: 0x10020, visible: true, isChild: false,
    _backCanvas: ownerCanvas };
  const dialog = { hwnd: 0x10021, visible: true, isDialog: true,
    isChild: false, ownerHwnd: owner.hwnd, clientPainted: true,
    _backCanvas: dialogCanvas };
  renderer.windows[owner.hwnd] = owner;
  renderer.windows[dialog.hwnd] = dialog;
  renderer.beginWorkerGdiPaint(owner.hwnd);
  assert.strictEqual(renderer._workerPublicationHeld(), false,
    'a painted modal dialog must not wait forever for its owner EndPaint');
  renderer._flushCanonicalCanvas(ownerCanvas);
  renderer._flushCanonicalCanvas(dialogCanvas);
  assert.strictEqual(ownerCanvas.flushes, 1,
    'a nested modal loop must publish what its owner already drew');
  assert.strictEqual(dialogCanvas.flushes, 1,
    'the completed modal surface may publish independently');
  renderer.beginWorkerGdiPaint(dialog.hwnd);
  assert.strictEqual(renderer._workerPublicationHeld(), false,
    'a dialog inside its own BeginPaint may also display drawn pixels');
  renderer.endWorkerGdiPaint(dialog.hwnd);
  renderer.endWorkerGdiPaint(owner.hwnd);
  delete renderer.windows[dialog.hwnd];
  delete renderer.windows[owner.hwnd];

  // A saved parent snapshot already repairs the pixels exposed by hiding a
  // child. WAT queues the clipped repaint; JS must not widen it to the entire
  // top-level tree and erase unrelated menu controls.
  const parent = { hwnd: 0x10010, visible: true, isChild: false, zOrder: 1 };
  const child = { hwnd: 0x10011, visible: true, isChild: true,
    parentHwnd: parent.hwnd, zOrder: 2 };
  renderer.windows[parent.hwnd] = parent;
  renderer.windows[child.hwnd] = child;
  let fullTreeInvalidations = 0;
  renderer.restoreParentUnderChild = () => true;
  renderer.invalidateVisibleTree = () => { fullTreeInvalidations++; };
  renderer.showWindow(child.hwnd, 0);
  assert.strictEqual(fullTreeInvalidations, 0,
    'snapshot-backed child hide must preserve unrelated parent pixels');
  callbacks.length = 0;
  renderer._repaintScheduled = false;
  renderer._repaintRaf = null;

  renderer.beginWorkerGuestSlice();
  renderer.scheduleRepaint();
  assert.strictEqual(callbacks.length, 0,
    'mid-slice GDI erase must not queue a browser frame');
  assert.strictEqual(renderer._workerRepaintDeferred, true);

  // ShowWindow, SetWindowPos, and several input paths request an immediate
  // repaint instead of going through scheduleRepaint. Half-Life repeatedly
  // toggles its launcher children while painting the menu, so a direct call
  // must obey the same complete-slice publication boundary.
  Win98Renderer.prototype.repaint.call(renderer);
  assert.strictEqual(repaints, 0,
    'direct repaint during a Worker slice must not expose partial menu pixels');
  assert.strictEqual(renderer._repaintScheduled, true,
    'blocked direct repaint remains scheduled for the safe slice boundary');

  renderer.beginWorkerGdiPaint(0x10002);
  renderer.endWorkerGuestSlice();
  renderer._workerLastCompositeAt = performance.now();
  renderer.flushRepaint(true);
  assert.strictEqual(callbacks.length, 1,
    'completed slice may publish before EndPaint');
  callbacks.shift()();
  assert.strictEqual(repaints, 1);

  // A second slice can draw more through the same DC. EndPaint releases the
  // DC; it does not commit a frame or validate subsequent damage.
  renderer.beginWorkerGuestSlice();
  renderer.scheduleRepaint();
  renderer.endWorkerGuestSlice();
  renderer.flushRepaint(true);
  assert.strictEqual(callbacks.length, 1,
    'a spanning WM_PAINT must not starve successive frames');
  callbacks.shift()();
  assert.strictEqual(repaints, 2);
  renderer.scheduleRepaint();

  renderer.beginWorkerGuestSlice();
  renderer.endWorkerGdiPaint(0x10002);
  renderer.endWorkerGuestSlice();
  renderer.flushRepaint(true);
  assert.strictEqual(callbacks.length, 1,
    'EndPaint boundary should publish one coalesced browser frame');
  callbacks.shift()();
  assert.strictEqual(repaints, 3,
    'pending drawing also publishes after EndPaint');
  assert.strictEqual(renderer._repaintScheduled, false);
  assert.strictEqual(renderer._workerGdiPaintDepth, 0);

  // A frame queued before the next slice can become due while the Worker is
  // active. Its callback must defer rather than expose another partial paint.
  renderer.scheduleRepaint();
  assert.strictEqual(callbacks.length, 1);
  renderer.beginWorkerGuestSlice();
  callbacks.shift()();
  assert.strictEqual(repaints, 3,
    'rAF becoming due during a Worker slice must not repaint');
  renderer.endWorkerGuestSlice();
  renderer.flushRepaint(true);
  assert.strictEqual(callbacks.length, 1);
  callbacks.shift()();
  assert.strictEqual(repaints, 4);

  // If the browser's queued rAF repeatedly loses the race to the next Worker
  // slice, a due frame must still publish at the safe boundary. Rate limiting
  // keeps this from becoming one full composite per guest slice.
  renderer.beginWorkerGuestSlice();
  renderer.scheduleRepaint();
  renderer.endWorkerGuestSlice();
  renderer._workerLastCompositeAt = performance.now() - 20;
  renderer.flushRepaint(true);
  assert.strictEqual(repaints, 5,
    'a due frame must publish synchronously at the completed slice boundary');
} finally {
  if (oldRaf === undefined) delete global.requestAnimationFrame;
  else global.requestAnimationFrame = oldRaf;
}

console.log('PASS Worker GDI repaint publishes only at completed slice boundaries');

// A real render-Worker bridge publishes into the page renderer. The page's
// idle WASM instance has no D3D9 ring: its active getter must not hide the
// frame that the CPU Worker's different instance just presented.
(async () => {
  const { createHostImports } = require('../lib/host-imports');
  const { createCanvas } = require('../lib/raster-canvas');
  const G = require('../lib/gpu-stream.generated');
  const memory = new SharedArrayBuffer(4096);
  const apiOffset = G.LAYOUTS.GpsRing.fields.find(f => f.name === 'api').offset;
  new DataView(memory).setUint32(256 + apiOffset, 4, true);
  const renderer = new Win98Renderer(createCanvas(8, 8));
  const win = { hwnd: 0x10001, w: 8, h: 8, visible: true, _backCanvas: createCanvas(8, 8) };
  renderer.windows[win.hwnd] = win;
  const endpoints = [];
  let idleActive = 0, getterCalls = 0;
  const ctx = { getMemory: () => memory, renderer, createCanvas,
    exports: { d3d9_gps_active: () => { getterCalls++; return idleActive; } },
    sharedRenderWorkerEnabled: true,
    createRenderEndpoint: async () => {
      const listeners = [];
      const endpoint = { id: endpoints.length + 1, ready: Promise.resolve(), closed: false,
        addEventListener: (_, listener) => listeners.push(listener),
        request: async () => ({ result: 1, stats: {} }),
        terminate: async () => { endpoint.closed = true; },
        frame: () => listeners.forEach(listener => listener({ data: { t: 'frame', frame: {
          hwnd: win.hwnd, width: 8, height: 8, stamp: 1,
          pixels: new Uint8Array(8 * 8 * 4).fill(255),
        } } })),
      };
      endpoints.push(endpoint);return endpoint;
    },
  };
  const { host } = createHostImports(ctx);
  await host.gpu_stream_kick(256, 1);
  const bridge = ctx.getD3d9GpsBridge();
  endpoints[0].frame();
  const first = bridge.layer;
  assert.strictEqual(renderer._overlayFrameLayer(win), first,
    'an accepted Worker frame remains visible when the idle page ring is inactive');
  assert.strictEqual(getterCalls, 0, 'Worker publication must not query the idle page ring');
  bridge.workerAsyncError = new Error('render failure');
  assert.strictEqual(renderer._overlayFrameLayer(win), null, 'failed endpoint is stale');
  bridge.workerAsyncError = null;
  endpoints[0].closed = true;
  assert.strictEqual(renderer._overlayFrameLayer(win), null, 'closed endpoint is stale');
  endpoints[0].closed = false;
  await bridge.close();
  assert.strictEqual(win._dxFrameLayer, null, 'retirement detaches the frame');
  assert.strictEqual(first.stale(), true, 'retired frame never adopts a replacement');
  await host.gpu_stream_kick(256, 1);
  endpoints[1].frame();
  assert.notStrictEqual(bridge.layer, first);
  assert.strictEqual(renderer._overlayFrameLayer(win), bridge.layer, 'replacement endpoint can display');
  assert.strictEqual(first.stale(), true, 'old endpoint identity remains retired');
  await bridge.close();
  const local = { canvas: createCanvas(8, 8) };
  bridge.options.onPresent(local);
  assert.strictEqual(local.stale(), true, 'local route still rejects an inactive native ring');
  idleActive = 1;
  assert.strictEqual(local.stale(), false, 'local route keeps its active native ring');
  console.log('PASS D3D9 Worker frame visibility, failure, close, retirement and replacement');
})().catch(error => { console.error(error); process.exitCode = 1; });
