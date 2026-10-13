#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const { Win98Renderer } = require('../lib/renderer');
const r = Object.create(Win98Renderer.prototype);
const calls = [], wakes = [];
function owner(name, child) {
  return { exports: {
    track_mouse_client_hit(hwnd, x, y) {
      calls.push(['hit', name, hwnd, x, y]);
      return y < 20 ? 0 : child;
    },
    track_mouse_observe(hwnd) { calls.push(['observe', name, hwnd]); return hwnd === 0; },
    send_message() { throw new Error('page instance must never call guest WndProc'); },
    dialog_route_mouse_screen() { throw new Error('tracking is not direct mouse routing'); },
  } };
}
const a = owner('a', 11), b = owner('b', 22);
r.wasm = a;
r.windows = {
  1: { hwnd: 1, wasm: a, x: 0, y: 0, w: 100, h: 100, visible: true, zOrder: 1 },
  2: { hwnd: 2, wasm: b, x: 50, y: 0, w: 100, h: 100, visible: true, zOrder: 2 },
};
r._windowRectScreen = w => w;
r._wakeMessageWait = wake => wakes.push(wake);
r._mousePointPublishers = new Set();
const observations = () => calls.filter(c => c[0] === 'observe');
function move(x, y) { calls.length = 0; r._setMousePoint(x, y); }
move(25, 30);
assert.deepEqual(observations(), [['observe', 'a', 11], ['observe', 'b', 0]]);
// Capture in a cannot steal the physical hit in topmost overlapping process b.
r._mouseCapture = { hwnd: 1, wasm: a };
move(75, 30);
assert.deepEqual(observations(), [['observe', 'a', 0], ['observe', 'b', 22]]);
assert.deepEqual(calls.filter(c => c[0] === 'hit'), [['hit', 'b', 2, 75, 30]]);
r.windows[1].className = 'Progman'; r.windows[1].zOrder = 999;
move(75, 30);
assert.deepEqual(observations(), [['observe', 'a', 0], ['observe', 'b', 22]], 'compositor desktop ordering wins over numeric z');
delete r.windows[1].className; r.windows[1].zOrder = 1;
move(75, 10);
assert.deepEqual(observations(), [['observe', 'a', 0], ['observe', 'b', 0]], 'nonclient hit leaves client tracker');
move(75, 30);
r.windows[2].visible = false;
calls.length = 0; r._publishMouseTracking();
assert.deepEqual(observations(), [['observe', 'a', 11], ['observe', 'b', 0]], 'stationary geometry/visibility refresh');
calls.length = 0; r.handleMouseLeave();
assert.deepEqual(observations(), [['observe', 'a', 0], ['observe', 'b', 0]]);
calls.length = 0; r._publishMouseTracking();
assert.deepEqual(observations(), [['observe', 'a', 0], ['observe', 'b', 0]], 'repaint must not reenter after canvas leave');
move(25, 30);
assert.deepEqual(observations(), [['observe', 'a', 11], ['observe', 'b', 0]], 'actual motion reenters');
assert(wakes.length && wakes.every(Boolean), 'queued leave wakes owning guest drive loop');
// Production integration points are as important as testing the pure helper.
assert.match(fs.readFileSync('lib/renderer.js', 'utf8'), /repaint\(\)\s*\{[\s\S]{0,350}_publishMouseTracking/);
assert.match(fs.readFileSync('lib/browser-input.js', 'utf8'), /canvas\.onmouseleave[\s\S]{0,160}renderer\.handleMouseLeave/);
console.log('PASS renderer tracking: physical owner/child/client region, capture, overlap, stationary geometry, canvas leave, queued wake');
