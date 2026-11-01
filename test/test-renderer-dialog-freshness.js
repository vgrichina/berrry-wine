#!/usr/bin/env node
'use strict';
// Exercise the actual lazy exclusive compositor and its post-processing source.
// Backings are completed native paints; only guest window painting is omitted.
const assert = require('node:assert/strict');
const { createCanvas } = require('../lib/canvas-compat');
const { Win98Renderer } = require('../lib/renderer');
const { PNG } = require('pngjs');
const canvas = (w, h, color) => {
  const c = createCanvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); return c;
};
const r = new Win98Renderer(createCanvas(64, 48));
r.singleAppMode = true;
r.lazyPresentation = true;
r.drawWindow = () => {}; // Fixture supplies already painted window backings.
r.updateTaskbar = () => {};
const wasm = { exports: {
  get_dx_exclusive_hwnd: () => 1,
  dialogbox_hwnd: () => 2,
  modal_dialog_hwnd: () => 0,
  wnd_window_screen_x: hwnd => r.windows[hwnd].x,
  wnd_window_screen_y: hwnd => r.windows[hwnd].y,
}};
r.wasm = wasm;
const game = r.windows[1] = {
  hwnd: 1, x: 0, y: 0, w: 64, h: 48, visible: true, isChild: false,
  zOrder: 1, wasm, style: 0x90000000,
  _backCanvas: canvas(64, 48, '#000000'), _gdiWriteSeq: 10,
  _dxFrameLayer: { canvas: canvas(64, 48, '#aa0000'), writeSeq: 21, coverSeq: 0 },
};
const dialog = r.windows[2] = {
  hwnd: 2, x: 8, y: 6, w: 40, h: 30, visible: true, isChild: false,
  isDialog: true, ownerHwnd: 1, zOrder: 2, wasm, style: 0x90000000,
  _backCanvas: canvas(40, 30, '#00bb00'), _gdiWriteSeq: 20,
};
const child = r.windows[3] = {
  hwnd: 3, x: 12, y: 10, w: 8, h: 6, visible: true, isChild: true,
  parentHwnd: 2, zOrder: 3, wasm, style: 0x50000000,
  _canonicalOwnSurface: true,
  _backCanvas: canvas(8, 6, '#00cccc'), _gdiWriteSeq: 20,
};
function rgb(c, x, y) {
  return [...c.getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3);
}
function frame(message, expected, childExpected = expected) {
  r.repaint();
  for (const [name, c] of [['capture', r.canvas], ['post-process', r._exclusivePresentationSource]]) {
    assert(c, name + ' source exists');
    assert.deepEqual(rgb(c, 2, 2), [170, 0, 0], message + ': game placement ' + name);
    assert.deepEqual(rgb(c, 30, 25), expected, message + ': dialog ' + name);
    assert.deepEqual(rgb(c, 14, 12), childExpected, message + ': child ' + name);
  }
  const png = PNG.sync.read(r.canvas.toBuffer('image/png'));
  assert.deepEqual([...png.data.slice((25 * png.width + 30) * 4, (25 * png.width + 30) * 4 + 3)], expected,
    message + ': ordinary PNG serialization');
}
assert.equal(r.getActiveModalWindow(), dialog);
frame('a newer clipped present leaves active native dialog visible', [0, 187, 0], [0, 204, 204]);
game._dxFrameLayer.writeSeq = 22;
game._dxFrameLayer.coverSeq = 22;
frame('a newer real covering present rejects older dialog and child', [170, 0, 0]);
game._dxFrameLayer.writeSeq = 23;
frame('a later clipped present does not revive previously covered backings', [170, 0, 0]);
dialog._gdiWriteSeq = child._gdiWriteSeq = 24;
frame('a real native repaint restores dialog and child', [0, 187, 0], [0, 204, 204]);
child.visible = false;
frame('hidden child backing stays absent', [0, 187, 0]);
child.visible = true;
dialog.visible = false;
frame('hidden dialog and its child stay absent', [170, 0, 0]);
dialog.visible = true;
// A modeless owned popup uses the same visible-region/coverage rule, not a
// game-specific or modal-only exemption from ordering.
dialog.isDialog = false;
game._dxFrameLayer.writeSeq = 25;
frame('clipped present also preserves a visible modeless owned popup', [0, 187, 0], [0, 204, 204]);
game._dxFrameLayer.coverSeq = 25;
frame('covered stale modeless backing stays rejected', [170, 0, 0]);
// A later-painted overlapping window wins in the existing z order.
const front = r.windows[4] = { ...dialog, hwnd: 4, ownerHwnd: 2, zOrder: 4,
  _gdiWriteSeq: 26, _backCanvas: canvas(40, 30, '#1111dd') };
frame('later front window preserves coverage and stack order', [17, 17, 221]);
front.visible = false;
frame('hiding front window does not revive the covered dialog', [170, 0, 0]);
console.log('PASS exclusive dialog freshness: capture PNG, post-process, covering/clipped order, hidden and stale windows');
