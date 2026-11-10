'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {attach} = require('./mw3-live-mouse-observation.cjs');
test('opt-in import wrapper preserves receiver, arguments, return and thrown identity', () => {
  const fault = Error('original');
  const table = {value: 17, get_mouse_buttons_live(v) { assert.equal(this, table); if (v) throw fault; return this.value; }};
  const original = table.get_mouse_buttons_live;
  const o = attach(table);
  assert.equal(table.get_mouse_buttons_live(0), 17);
  assert.throws(() => table.get_mouse_buttons_live(1), e => e === fault);
  const v = o.stop(); assert.equal(table.get_mouse_buttons_live, original);
  assert.deepEqual(v.records.map(r => r.value), [17, null]);
  assert(v.records.every(r => r.begin <= r.end)); assert.equal(v.drops, 0);
});
test('capacity and expiry restore the original; replacement ownership is preserved', async () => {
  const table = {get_mouse_buttons_live: () => 3}, original = table.get_mouse_buttons_live;
  let o = attach(table, {capacity: 1}); table.get_mouse_buttons_live(); table.get_mouse_buttons_live();
  assert.equal(o.snapshot().drops, 1); assert.equal(table.get_mouse_buttons_live, original);
  o = attach(table, {durationMs: 1}); await new Promise(r => setTimeout(r, 5)); table.get_mouse_buttons_live();
  assert.equal(o.stop().records.length, 0); assert.equal(table.get_mouse_buttons_live, original);
  o = attach(table); const newer = () => 7; table.get_mouse_buttons_live = newer;
  assert(o.stop().restoreConflict); assert.equal(table.get_mouse_buttons_live, newer);
});
