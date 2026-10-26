'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { installInputHandlers } = require('../lib/renderer-input');

// Exercise the installed renderer methods, without loading an emulator or arena.
class Renderer {
  constructor(worker = false) {
    this.inputQueue = [];
    this.windows = {};
    this.wasm = null;
    this.mainWasm = null;
    if (worker) this._keyboardOwnerRunsInGuestWorker = () => true;
  }
}
installInputHandlers(Renderer);
const modifiers = [
  [16, 'Shift', 0x2a, 0x36, false],
  [17, 'Control', 0x1d, 0x1d, true],
  [18, 'Alt', 0x38, 0x38, true],
];
const info = code => ({ code, repeat: false });
const down = (r, vk, code, repeat = false) => r.handleKeyDown(vk, { code, repeat });
const up = (r, vk, code) => r.handleKeyUp(vk, info(code));
const held = (r, vk) => !!r.peekKeyDownState(vk);
const asyncHeld = (r, vk) => !!r.peekAsyncKeyState(vk);
const bits = e => ({ scan: (e.lParam >>> 16) & 255, extended: !!(e.lParam & 0x1000000),
  previous: !!(e.lParam & 0x40000000), up: !!(e.lParam & 0x80000000) });

for (const [vk, name, leftScan, rightScan, rightExtended] of modifiers) {
  for (const reverse of [false, true]) {
    for (const worker of [false, true]) {
      for (const buffered of [false, true]) {
        test(`${name} ${reverse ? 'right first' : 'left first'} worker=${worker} buffered=${buffered}`, () => {
          const r = new Renderer(worker);
          const sides = reverse ? ['Right', 'Left'] : ['Left', 'Right'];
          const expected = side => ({ scan: side === 'Left' ? leftScan : rightScan,
            extended: side === 'Right' && rightExtended, previous: false, up: false });
          const events = [];
          const take = () => { const e = r.takeInput(); assert(e); events.push(e); return e; };
          down(r, vk, name + sides[0]);
          if (!buffered) take();
          down(r, vk, name + sides[1]);
          if (!buffered) take();
          up(r, vk, name + sides[0]);
          assert.equal(held(r, vk), true, 'other physical side survives first release');
          if (!buffered) { take(); assert.equal(asyncHeld(r, vk), true); }
          up(r, vk, name + sides[1]);
          assert.equal(held(r, vk), false, 'last physical release clears immediately');
          if (buffered) {
            take(); take(); take();
            assert.equal(asyncHeld(r, vk), true, 'queued first release keeps opposite side down');
          }
          take();
          assert.equal(asyncHeld(r, vk), false, 'last queued release clears aggregate');
          assert.deepEqual(events.map(bits), [expected(sides[0]), expected(sides[1]),
            { ...expected(sides[0]), previous: true, up: true },
            { ...expected(sides[1]), previous: true, up: true }]);
          assert(events.every(e => e.wParam === vk), 'aggregate VK is preserved');
          assert.equal(r.takeInput(), null);
        });
      }
    }
  }
  test(`${name} autorepeat is owned once and unmatched release is harmless`, () => {
    const r = new Renderer();
    down(r, vk, name + 'Left');
    down(r, vk, name + 'Left', true);
    down(r, vk, name + 'Right');
    up(r, vk, name + 'Left');
    up(r, vk, name + 'Left');
    assert.equal(held(r, vk), true);
    up(r, vk, name + 'Right');
    const events = [];
    while (r.inputQueue.length) events.push(r.takeInput());
    assert.deepEqual(events.slice(0, 3).map(e => bits(e).previous), [false, true, false]);
    assert.equal(asyncHeld(r, vk), false);
    down(r, vk, name + 'Left');
    assert.equal(bits(r.takeInput()).previous, false, 'new press after release is fresh');
  });
  test(`${name} numeric lifecycle release clears both owners and permits fresh input`, () => {
    const r = new Renderer();
    down(r, vk, name + 'Left'); down(r, vk, name + 'Right');
    r.handleKeyUp(vk); // Existing numeric-only release/reset route.
    assert.equal(held(r, vk), false);
    while (r.inputQueue.length) r.takeInput();
    assert.equal(asyncHeld(r, vk), false);
    down(r, vk, name + 'Right');
    assert.equal(bits(r.takeInput()).previous, false);
    r.pokeKeyDownState(vk, false); // Existing direct device-state reset route.
    assert.equal(held(r, vk), false);
    down(r, vk, name + 'Right');
    assert.equal(bits(r.takeInput()).previous, false, 'reset retires physical ownership');
  });
  test(`${name} numeric-only CLI repeat/release and location-only ownership`, () => {
    const r = new Renderer();
    r.handleKeyDown(vk); r.handleKeyDown(vk); r.handleKeyUp(vk);
    assert.deepEqual([r.takeInput(), r.takeInput(), r.takeInput()].map(e => bits(e).previous),
      [false, true, true]);
    assert.equal(asyncHeld(r, vk), false);
    r.handleKeyDown(vk, { location: 1 }); r.handleKeyDown(vk, { location: 2 });
    r.handleKeyUp(vk, { location: 1 });
    assert.equal(held(r, vk), true);
    r.handleKeyUp(vk, { location: 2 });
    assert.equal(held(r, vk), false);
    const seeded = new Renderer();
    seeded.pokeAsyncKeyState(vk, true);
    seeded.handleKeyDown(vk);
    assert.equal(bits(seeded.takeInput()).previous, true,
      'bare VK retains previous-state fallback for legacy async-only injection');
  });
}

test('Alt ownership preserves system-key context and Ctrl+Alt suppression', () => {
  const r = new Renderer();
  down(r, 18, 'AltLeft'); down(r, 18, 'AltRight');
  up(r, 18, 'AltLeft');
  down(r, 83, 'KeyS');
  let e = r.inputQueue.at(-1);
  assert.equal(e.msg, 0x104); assert(e.lParam & (1 << 29));
  down(r, 17, 'ControlLeft'); down(r, 17, 'ControlRight'); up(r, 17, 'ControlLeft');
  down(r, 76, 'KeyL');
  e = r.inputQueue.at(-1);
  assert.equal(e.msg, 0x100); assert.equal(e.lParam & (1 << 29), 0);
  up(r, 18, 'AltRight');
  assert.equal(r.inputQueue.at(-1).msg, 0x101, 'chord cancels Alt tap');
  assert.equal(!!r._menuMode, false);
});

test('Alt alone toggles menu once on last release; F10 family is unchanged', () => {
  const r = new Renderer();
  down(r, 18, 'AltLeft'); down(r, 18, 'AltRight');
  up(r, 18, 'AltLeft');
  assert.equal(!!r._menuMode, false);
  up(r, 18, 'AltRight');
  assert.equal(r._menuMode, true);
  assert.equal(r.inputQueue.at(-1).msg, 0x105);
  assert.equal(r.inputQueue.at(-1).lParam & (1 << 29), 0);
  const f = new Renderer();
  down(f, 121, 'F10'); up(f, 121, 'F10');
  assert.deepEqual(f.inputQueue.map(e => e.msg), [0x104, 0x105]);
});

test('resetting the physical map retires ownership without changing SetKeyboardState', () => {
  const r = new Renderer();
  down(r, 16, 'ShiftLeft'); down(r, 16, 'ShiftRight');
  while (r.inputQueue.length) r.takeInput();
  r.pokeAsyncKeyState(16, false);
  assert.equal(held(r, 16), true, 'guest async override does not release the physical keyboard');
  r._physicalKeys = Object.create(null);
  down(r, 16, 'ShiftRight');
  assert.equal(bits(r.takeInput()).previous, false);
  up(r, 16, 'ShiftRight');
  assert.equal(held(r, 16), false, 'old left owner cannot survive map reset');
  r.takeInput();
  assert.equal(asyncHeld(r, 16), false);
});

test('press latch, ordinary repeat and release ordering remain intact', () => {
  const r = new Renderer();
  down(r, 16, 'ShiftLeft');
  assert.equal(r.getAsyncKeyState(16), 0x8001);
  assert.equal(r.getAsyncKeyState(16), 0x8000);
  r.takeInput(); // Dispatch also publishes the press latch, as before.
  assert.equal(r.getAsyncKeyState(16), 0x8001);
  down(r, 16, 'ShiftRight'); r.takeInput();
  up(r, 16, 'ShiftLeft'); r.takeInput();
  assert.equal(r._shiftDown, true);
  down(r, 90, 'KeyZ');
  up(r, 16, 'ShiftRight');
  assert.equal(asyncHeld(r, 16), true, 'modifier remains visible ahead of queued Z');
  assert.equal(r.takeInput().wParam, 90);
  assert.equal(asyncHeld(r, 16), true);
  r.takeInput();
  assert.equal(asyncHeld(r, 16), false);
  down(r, 90, 'KeyZ');
  assert.equal(bits(r.takeInput()).previous, true, 'ordinary held key retains previous bit');
  up(r, 90, 'KeyZ'); r.takeInput();
  assert.equal(held(r, 90), false);
});
