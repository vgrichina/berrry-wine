#!/usr/bin/env node
'use strict';

// Exclusive DirectDraw owns the top-level presentation, but native child
// controls paint into a separate shared GDI surface.  The latter must not
// replace the primary (that regresses the DX SDK samples), and it must not be
// discarded either (that hides AoE I/II's subclassed player-name EDIT).

const assert = require('assert');
const { createCanvas } = require('../lib/canvas-compat');
const { Win98Renderer } = require('../lib/renderer');
const { createHostImports } = require('../lib/host-imports');

const hwnd = 0x10010;
const childHwnd = 0x10013;
const screen = createCanvas(8, 8);
const renderer = new Win98Renderer(screen);
const wasm = { exports: {
  get_dx_exclusive_hwnd: () => hwnd,
  wnd_window_screen_x: target => target === childHwnd ? 2 : target === 0x10014 ? 5 : target === 0x10020 ? 4 : 0,
  wnd_window_screen_y: target => target === childHwnd || target === 0x10014 ? 3 : target === 0x10020 ? 5 : 0,
} };
const top = renderer.windows[hwnd] = {
  hwnd, x: 0, y: 0, w: 8, h: 8, visible: true, isChild: false, wasm,
};

const dx = createCanvas(8, 8);
dx.getContext('2d').fillStyle = '#ff0000';
dx.getContext('2d').fillRect(0, 0, 8, 8);
const gdi = createCanvas(8, 8);
gdi.getContext('2d').fillStyle = '#0000ff';
gdi.getContext('2d').fillRect(0, 0, 8, 8);
gdi.getContext('2d').fillStyle = '#00ff00';
gdi.getContext('2d').fillRect(2, 3, 3, 2);

assert.strictEqual(renderer.attachWindowSurface(hwnd, dx, true), true);
assert.strictEqual(renderer.attachWindowSurface(hwnd, gdi, false), true);
assert.strictEqual(top._backCanvas, dx,
  'ordinary GDI must not displace an exclusive DirectDraw primary');
assert.strictEqual(top._exclusiveGdiChildCanvas, gdi,
  'the shared GDI surface must survive before a native child exists');

// Real guest workers can attach the process GDI surface before their later
// CreateWindow(EDIT) host call reaches the renderer. The child deliberately
// appears after both surfaces so that ordering cannot hide its pixels.
const child = renderer.windows[childHwnd] = {
  hwnd: childHwnd, x: 2, y: 3, w: 3, h: 2, visible: true,
  isChild: true, parentHwnd: hwnd, wasm,
};

renderer._drawPresentedCanvas(dx, 0, 0, 8, 8);
renderer._compositeExclusiveSharedChildren(top, null);
const pixel = (x, y) => Array.from(screen.getContext('2d').getImageData(x, y, 1, 1).data);
assert.deepStrictEqual(pixel(0, 0), [255, 0, 0, 255],
  'top-level GDI background outside the child must not cover DirectDraw');
assert.deepStrictEqual(pixel(3, 3), [0, 255, 0, 255],
  'native child pixels must composite over DirectDraw inside its window rect');

// The guest can later replace the whole primary with a custom-painted menu.
// Retaining the shared canvas must not keep its old child background on top.
// A lazy flush can update the window's stamp without receiving a new upload.
gdi._waCanonicalPresentation = { writeSeq: 1 };
top._gdiWriteSeq = 99;
renderer._drawPresentedCanvas(dx, 0, 0, 8, 8);
renderer._compositeExclusiveSharedChildren(top, null, 2);
assert.deepStrictEqual(pixel(3, 3), [255, 0, 0, 255],
  'a newer primary must cover old shared GDI child pixels despite a later flush');
top._dxFrameLayer = { canvas: dx, writeSeq: 2 };
for (const stack of [[top], null]) {
  const source = renderer._buildExclusivePresentationSource(top, stack, 2);
  assert.deepStrictEqual(Array.from(source.getContext('2d').getImageData(3, 3, 1, 1).data),
    [255, 0, 0, 255], 'post-processing must also omit overwritten shared child pixels');
}
gdi._waCanonicalPresentation.writeSeq = 3;
renderer._drawPresentedCanvas(dx, 0, 0, 8, 8);
renderer._compositeExclusiveSharedChildren(top, null, 2);
assert.deepStrictEqual(pixel(3, 3), [0, 255, 0, 255],
  'a native control repaint after the primary must remain visible');
for (const stack of [[top], null]) {
  const source = renderer._buildExclusivePresentationSource(top, stack, 2);
  assert.deepStrictEqual(Array.from(source.getContext('2d').getImageData(3, 3, 1, 1).data),
    [0, 255, 0, 255], 'post-processing must retain newer native control pixels');
}
// A present through a clipper bound to the window (SetHWnd) is clipped to the
// window's visible region and never paints over its child controls. Age of
// Empires presents its name screen continuously that way: the frame layer is
// newer than the EDIT's last paint, but its coverSeq stays at the last
// unclipped present, so the field must stay on top.
gdi._waCanonicalPresentation.writeSeq = 1;
top._dxFrameLayer = { canvas: dx, writeSeq: 5, coverSeq: 0 };
for (const stack of [[top], null]) {
  const source = renderer._buildExclusivePresentationSource(top, stack, 5, 0);
  assert.deepStrictEqual(Array.from(source.getContext('2d').getImageData(3, 3, 1, 1).data),
    [0, 255, 0, 255], 'a clipped present must not cover the window\'s child controls');
}
renderer._drawPresentedCanvas(dx, 0, 0, 8, 8);
renderer._compositeExclusiveSharedChildren(top, null, 0);
assert.deepStrictEqual(pixel(3, 3), [0, 255, 0, 255],
  'clipped presents leave shared child pixels composited');
// ...while an unclipped present after them still covers the child.
top._dxFrameLayer = { canvas: dx, writeSeq: 6, coverSeq: 6 };
const covered = renderer._buildExclusivePresentationSource(top, [top], 6, 6);
assert.deepStrictEqual(Array.from(covered.getContext('2d').getImageData(3, 3, 1, 1).data),
  [255, 0, 0, 255], 'an unclipped present still covers older child pixels');
delete top._dxFrameLayer;
delete gdi._waCanonicalPresentation;


child.visible = false;
renderer._drawPresentedCanvas(dx, 0, 0, 8, 8);
renderer._compositeExclusiveSharedChildren(top, null);
assert.deepStrictEqual(pixel(3, 3), [255, 0, 0, 255],
  'hiding the child must stop compositing its stale shared pixels');

assert.strictEqual(renderer.detachWindowSurface(hwnd, gdi), true);
assert.strictEqual(top._exclusiveGdiChildCanvas, null,
  'deleting the GDI surface must release the saved child overlay');

child.visible = true;
// A partial repaint of A must not revive the old shared background of B.
// Exercise the real upload contract, including overlapping rectangle updates.
const memory = new ArrayBuffer(65536), bytes = new Uint8Array(memory), bits = 0x1000;
const paintBytes = (x, y, w, h, color) => {
  for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
    bytes.set([...color, 255], bits + row * 32 + col * 4);
  }
};
renderer.scheduleRepaint = () => {};
const { host, gdi: state } = createHostImports({ getMemory: () => memory, exports: {}, renderer });
assert.strictEqual(host.gdi_surface_create(0x610001, 8, 8, 32, bits, 32, 1, 0, 0), 1);
assert.strictEqual(host.gdi_surface_attach(0x610001, hwnd), 1);
paintBytes(0, 0, 8, 8, [192, 192, 192]);
assert.strictEqual(host.gdi_surface_upload(0x610001, 0, 0, 8, 8), 1);
const primarySeq = renderer.nextSurfaceWriteSeq();
top._dxFrameLayer = { canvas: dx, writeSeq: primarySeq };
renderer.windows[0x10014] = { hwnd: 0x10014, x: 5, y: 3, w: 2, h: 2,
  visible: true, isChild: true, parentHwnd: hwnd, wasm };
paintBytes(2, 3, 3, 2, [0, 255, 0]);
assert.strictEqual(host.gdi_surface_upload(0x610001, 2, 3, 5, 5), 1);
state.surfacePresentations.get(0x610001).flush();
renderer._drawPresentedCanvas(dx, 0, 0, 8, 8);
renderer._compositeExclusiveSharedChildren(top, null, primarySeq);
assert.deepStrictEqual(pixel(3, 3), [0, 255, 0, 255], 'new child A upload must show');
assert.deepStrictEqual(pixel(6, 3), [255, 0, 0, 255], 'old child B background must stay covered');
for (const stack of [[top], null]) {
  const source = renderer._buildExclusivePresentationSource(top, stack, primarySeq);
  const read = (x, y) => Array.from(source.getContext('2d').getImageData(x, y, 1, 1).data);
  assert.deepStrictEqual(read(3, 3), [0, 255, 0, 255], 'source retains new A pixels');
  assert.deepStrictEqual(read(6, 3), [255, 0, 0, 255], 'source must not revive old B pixels');
}
const shared = state.surfacePresentations.get(0x610001);
for (let frame = 0; frame < 32; frame++) {
  const coveredAt = renderer.nextSurfaceWriteSeq();
  renderer._compositeExclusiveSharedChildren(top, null, coveredAt);
  assert.strictEqual(shared.writeRegions.length, 0,
    'a primary presentation must release obsolete upload coverage');
  for (let i = 0; i < 16; i++) {
    const x = i % 8, y = Math.floor(i / 8);
    assert.strictEqual(host.gdi_surface_upload(0x610001, x, y, x + 1, y + 1), 1);
  }
  assert.strictEqual(shared.writeRegions.length, 16,
    'fragmented uploads must retain only coverage since the latest primary');
}
delete renderer.windows[0x10014];
delete top._dxFrameLayer;
assert.strictEqual(host.gdi_surface_delete(0x610001), 1);
child.visible = false;

// A post-processing source must retain the whole exclusive screen when a
// smaller popup sits at a nonzero origin (Diablo's Replay Intro notice).
const popupCanvas = createCanvas(3, 2);
popupCanvas.getContext('2d').fillStyle = '#00ff00';
popupCanvas.getContext('2d').fillRect(0, 0, 3, 2);
const popup = renderer.windows[0x10020] = {
  hwnd: 0x10020, x: 4, y: 5, w: 3, h: 2, visible: true,
  isChild: false, wasm, _backCanvas: popupCanvas, _gdiWriteSeq: 2,
};
top._gdiWriteSeq = 2;
const composed = renderer._buildExclusivePresentationSource(popup, [top, popup], 1);
assert.strictEqual(composed.width, 8, 'popup must not shrink the full-screen source');
assert.strictEqual(composed.height, 8, 'popup must not crop the full-screen source');
const composedPixel = (x, y) => Array.from(composed.getContext('2d').getImageData(x, y, 1, 1).data);
assert.deepStrictEqual(composedPixel(0, 0), [255, 0, 0, 255],
  'the game must remain visible above the offset popup');
assert.deepStrictEqual(composedPixel(5, 6), [0, 255, 0, 255],
  'popup art must stay at its guest screen coordinates');
assert.deepStrictEqual(composedPixel(5, 7), [255, 0, 0, 255],
  'the popup must not stretch into the rest of the display');

console.log('PASS  native child GDI pixels overlay exclusive DirectDraw by child rect');
