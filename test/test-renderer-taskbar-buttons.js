#!/usr/bin/env node
// TASKBAR-RESTORE-INPUT. updateTaskbar runs on every repaint. It used to empty
// #task-buttons and build fresh buttons each time, so a repaint between a
// held click's mousedown and mouseup detached the pressed button: the browser
// then delivers the click to the common ancestor (the container) and the
// button's onclick -- the SC_RESTORE for a minimized window -- never runs.
// A button must survive repaints, follow its window's state, and leave the
// DOM only with its window.

const assert = require('assert');
const { Win98Renderer } = require('../lib/renderer');

// Just enough DOM for updateTaskbar: element children with sibling links.
class El {
  constructor(tag) { this.tagName = tag; this.children = []; this.parentNode = null; this.className = ''; this.textContent = ''; }
  get firstChild() { return this.children[0] || null; }
  get nextSibling() {
    const p = this.parentNode; if (!p) return null;
    return p.children[p.children.indexOf(this) + 1] || null;
  }
  removeChild(c) {
    const i = this.children.indexOf(c); assert(i >= 0, 'removeChild of a non-child');
    this.children.splice(i, 1); c.parentNode = null; return c;
  }
  insertBefore(c, ref) {
    if (c.parentNode) c.parentNode.removeChild(c);
    const i = ref ? this.children.indexOf(ref) : this.children.length;
    assert(i >= 0, 'insertBefore with a foreign reference node');
    this.children.splice(i, 0, c); c.parentNode = this; return c;
  }
  appendChild(c) { return this.insertBefore(c, null); }
  set innerHTML(v) { assert.strictEqual(v, ''); for (const c of this.children) c.parentNode = null; this.children = []; }
}
const container = new El('div');
global.document = {
  getElementById: (id) => (id === 'task-buttons' ? container : null),
  createElement: (tag) => new El(tag),
};

const ctx = { imageSmoothingEnabled: true, clearRect() {}, fillRect() {}, drawImage() {}, save() {}, restore() {} };
const r = new Win98Renderer({ width: 640, height: 480, getContext: () => ctx });
r.updateNotificationArea = () => {};
r._wakeMessageWait = () => {};
r.repaint = () => {};
r.inputQueue = [];

const win = (hwnd, title, extra) => Object.assign({ hwnd, title, hasCaption: true, isChild: false, visible: true }, extra);
r.windows = { 1: win(1, 'Tetris', { visible: false, _minimized: true }) };
r.updateTaskbar();
assert.strictEqual(container.children.length, 1);
const pressed = container.children[0];
assert.strictEqual(pressed.textContent, 'Tetris');
assert.strictEqual(pressed.className, 'task-btn', 'a minimized window is not the active button');

// mousedown on the button, a repaint, then mouseup: the browser clicks the
// button only if it is still the same connected node.
r.updateTaskbar();
r.updateTaskbar();
assert.strictEqual(container.children[0], pressed, 'a repaint replaced the pressed task button');
assert.strictEqual(pressed.parentNode, container, 'a repaint detached the pressed task button');
pressed.onclick();
assert.deepStrictEqual(r.inputQueue, [{ type: 'command', hwnd: 1, msg: 0x0112, wParam: 0xF120, lParam: 0 }],
  'the held click did not queue SC_RESTORE');
console.log('PASS  a task button survives repaints during a held click, and its click queues SC_RESTORE');

// The kept button follows its window: restored state, a new title, and the
// window object the renderer holds now (its click reads the current one).
r.inputQueue.length = 0;
r.windows = { 1: win(1, 'Tetris - Level 2') };
r._isForegroundWindow = (w) => w === r.windows[1];
r.updateTaskbar();
assert.strictEqual(container.children[0], pressed);
assert.strictEqual(pressed.className, 'task-btn active');
assert.strictEqual(pressed.textContent, 'Tetris - Level 2');
pressed.onclick();
assert.deepStrictEqual(r.inputQueue, [{ type: 'command', hwnd: 1, msg: 0x0112, wParam: 0xF020, lParam: 0 }],
  'the foreground window\'s button did not queue SC_MINIMIZE');
console.log('PASS  a kept button follows its window\'s state, title and current object');

// Windows come and go: new buttons in window order, old ones stay put, a
// closed window's button leaves.
r.windows = { 1: r.windows[1], 2: win(2, 'Notepad'), 3: win(3, 'Calc') };
r.updateTaskbar();
assert.deepStrictEqual(container.children.map((b) => b.textContent), ['Tetris - Level 2', 'Notepad', 'Calc']);
assert.strictEqual(container.children[0], pressed);
const calc = container.children[2];
r.windows = { 1: r.windows[1], 3: r.windows[3] };
r.updateTaskbar();
assert.deepStrictEqual(container.children.map((b) => b.textContent), ['Tetris - Level 2', 'Calc']);
assert.strictEqual(container.children[1], calc, 'removing a window rebuilt the others\' buttons');
r.windows = { 3: r.windows[3], 1: r.windows[1] };
r.updateTaskbar();
assert.deepStrictEqual(container.children.map((b) => b.textContent), ['Tetris - Level 2', 'Calc'],
  'integer-keyed windows enumerate in hwnd order');
r.windows = {};
r.updateTaskbar();
assert.strictEqual(container.children.length, 0);
assert.strictEqual(pressed.parentNode, null);
console.log('PASS  buttons are added, kept and removed with their windows');
