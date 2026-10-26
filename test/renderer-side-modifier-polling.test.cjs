'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { installInputHandlers } = require('../lib/renderer-input');
class Input {
  constructor() { this.inputQueue = []; this.windows = {}; this.wasm = null; this.mainWasm = null; }
}
installInputHandlers(Input);
const families = [[16, 'Shift', 160, 161], [17, 'Control', 162, 163], [18, 'Alt', 164, 165]];
const drain = r => {
  for (let n = 0; n < 100; n++) if (!r.takeInput()) return;
  throw Error('queue did not drain');
};
const physical = (r, ...keys) => keys.map(k => r.peekKeyDownState(k));
const asyncState = (r, ...keys) => keys.map(k => r.peekAsyncKeyState(k));
for (const [vk, name, left, right] of families) {
  for (const first of ['Left', 'Right']) for (const release of ['Left', 'Right']) {
    test(`${name} side ownership public ${first} down / ${release} up first`, () => {
      const r = new Input();
      const other = first === 'Left' ? 'Right' : 'Left';
      const firstVK = first === 'Left' ? left : right;
      const otherVK = first === 'Left' ? right : left;
      const releaseVK = release === 'Left' ? left : right;
      const heldVK = release === 'Left' ? right : left;
      r.handleKeyDown(vk, {code: name + first});
      assert.deepEqual(physical(r, vk, firstVK, otherVK), [32768,32768,0]);
      assert.equal(r.getAsyncKeyState(firstVK), 0x8001);
      assert.equal(r.getAsyncKeyState(firstVK), 0x8000);
      assert.equal(r.getAsyncKeyState(otherVK), 0);
      r.takeInput();
      assert.equal(r.getAsyncKeyState(firstVK), 0x8000, 'delivery cannot rearm side press');
      r.handleKeyDown(vk, {code: name + other}); r.takeInput();
      assert.equal(r.getAsyncKeyState(otherVK), 0x8001);
      assert.equal(r.getAsyncKeyState(firstVK), 0x8000, 'opposite press cannot rearm held side');
      r.handleKeyUp(vk, {code: name + release}); r.takeInput();
      assert.deepEqual(physical(r, vk, heldVK, releaseVK), [32768,32768,0]);
      assert.deepEqual(asyncState(r, vk, heldVK, releaseVK), [32768,32768,0]);
      assert.equal(r.getAsyncKeyState(releaseVK), 0);
      r.handleKeyUp(vk, {code: name + (release === 'Left' ? 'Right' : 'Left')}); drain(r);
      assert.deepEqual(physical(r, vk, left, right), [0,0,0]);
      assert.deepEqual(asyncState(r, vk, left, right), [0,0,0]);
      assert.equal(r.getAsyncKeyState(heldVK), 0);
    });
  }
  test(`${name} peek, repeated query, repeat and fresh repress latches`, () => {
    const r = new Input();
    r.handleKeyDown(vk, {code: name + 'Right'});
    assert.equal(r.peekAsyncKeyState(right), 0x8000);
    assert.equal(r.peekAsyncKeyState(right), 0x8000);
    assert.equal(r.getAsyncKeyState(vk) & 1, 1, 'aggregate query is independent');
    assert.equal(r.getAsyncKeyState(right), 0x8001);
    assert.equal(r.getAsyncKeyState(right), 0x8000);
    r.takeInput();
    assert.equal(r.getAsyncKeyState(right), 0x8000);
    for (const repeat of [false, true]) {
      r.handleKeyDown(vk, {code: name + 'Right', repeat}); r.takeInput();
      assert.equal(r.getAsyncKeyState(right), 0x8000, 'held repeat is not a new press');
      assert.equal(r.getAsyncKeyState(left), 0);
    }
    r.handleKeyUp(vk, {code: name + 'Right'}); drain(r);
    assert.equal(r.getAsyncKeyState(right), 0);
    r.handleKeyDown(vk, {code: name + 'Right'}); r.handleKeyUp(vk, {code: name + 'Right'}); drain(r);
    assert.equal(r.peekAsyncKeyState(right), 0);
    assert.equal(r.getAsyncKeyState(right), 1, 'released tap retains unconsumed press');
    assert.equal(r.getAsyncKeyState(right), 0);
  });
  test(`${name} buffered side release follows message timeline, physical is immediate`, () => {
    const r = new Input();
    r.handleKeyDown(vk, {code: name + 'Left'});
    r.handleKeyDown(vk, {code: name + 'Right'});
    r.handleKeyUp(vk, {code: name + 'Left'});
    r.handleKeyDown(65, {code: 'KeyA'});
    r.handleKeyUp(vk, {code: name + 'Right'});
    assert.deepEqual(physical(r, vk, left, right), [0,0,0]);
    assert.equal(r.peekAsyncKeyState(left), 0x8000, 'queued release must not retract earlier chord');
    const expected = [[32768,32768,0],[32768,32768,32768],[32768,0,32768],
      [32768,0,32768],[0,0,0]];
    for (const state of expected) {
      assert.ok(r.takeInput());
      assert.deepEqual(asyncState(r, vk, left, right), state);
    }
    assert.equal(r.getAsyncKeyState(left), 1);
    assert.equal(r.getAsyncKeyState(right), 1);
    assert.equal(r.getAsyncKeyState(left), 0);
    assert.equal(r.getAsyncKeyState(right), 0);
  });
  test(`${name} generic numeric owner never invents side identity`, () => {
    const r = new Input();
    r.handleKeyDown(vk); r.takeInput();
    assert.deepEqual(physical(r, vk, left, right), [32768,0,0]);
    assert.deepEqual(asyncState(r, vk, left, right), [32768,0,0]);
    assert.equal(r.getAsyncKeyState(left), 0); assert.equal(r.getAsyncKeyState(right), 0);
    r.handleKeyDown(vk, {code: name + 'Right'}); r.takeInput();
    r.handleKeyUp(vk, {code: name + 'Right'}); r.takeInput();
    assert.deepEqual(physical(r, vk, left, right), [32768,0,0]);
    assert.deepEqual(asyncState(r, vk, left, right), [32768,0,0]);
    assert.equal(r.getAsyncKeyState(right), 1);
    r.handleKeyUp(vk); drain(r);
    assert.deepEqual(asyncState(r, vk, left, right), [0,0,0]);
  });
  test(`${name} public numeric focus release resets queued sides and allows fresh press`, () => {
    const r = new Input();
    r.handleKeyDown(vk, {location: 1}); r.handleKeyDown(vk, {location: 2});
    r.handleKeyUp(vk);
    assert.deepEqual(physical(r, vk, left, right), [0,0,0]);
    drain(r);
    assert.deepEqual(asyncState(r, vk, left, right), [0,0,0]);
    assert.equal(r.getAsyncKeyState(left), 1); assert.equal(r.getAsyncKeyState(right), 1);
    r.handleKeyDown(vk, {code: name + 'Right', location: 1}); r.takeInput();
    assert.deepEqual(physical(r, vk, left, right), [32768,0,32768]);
    assert.equal(r.getAsyncKeyState(right), 0x8001);
    assert.equal(r.getAsyncKeyState(left), 0);
    r.handleKeyUp(vk); drain(r);
    assert.equal(r.getAsyncKeyState(right), 0);
  });
  test(`${name} device reset and async override retain separate ownership`, () => {
    const r = new Input();
    r.handleKeyDown(vk, {code: name + 'Left'}); r.takeInput();
    r.getAsyncKeyState(left);
    r.pokeAsyncKeyState(left, false);
    assert.equal(r.peekKeyDownState(left), 0x8000);
    assert.equal(r.getAsyncKeyState(left), 0);
    r.pokeKeyDownState(vk, false);
    assert.deepEqual(physical(r, vk, left, right), [0,0,0]);
    r.handleKeyDown(vk, {code: name + 'Right'}); r.takeInput();
    assert.equal(r.getAsyncKeyState(left), 0);
    assert.equal(r.getAsyncKeyState(right), 0x8001);
    r.handleKeyUp(vk, {code: name + 'Left'}); r.takeInput();
    assert.equal(r.getAsyncKeyState(right), 0x8000, 'unmatched release preserves opposite side');
    r.handleKeyUp(vk); drain(r);
    assert.equal(r.getAsyncKeyState(right), 0);
  });
}
test('nonmodifier physical and async polling retain numeric key and latch', () => {
  const r = new Input();
  for (const [vk, code] of [[65,'KeyA'],[97,'Numpad1'],[39,'ArrowRight']]) {
    r.handleKeyDown(vk, {code}); r.takeInput();
    assert.equal(r.peekKeyDownState(vk), 0x8000);
    assert.equal(r.getAsyncKeyState(vk), 0x8001);
    assert.equal(r.getAsyncKeyState(vk), 0x8000);
    r.handleKeyUp(vk, {code}); drain(r);
    assert.equal(r.getAsyncKeyState(vk), 0);
    assert.equal(r.peekKeyDownState(vk), 0);
  }
});
