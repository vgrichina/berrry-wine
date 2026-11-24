'use strict';
// Proposed focused host-state checks only. Native/DOM/RPC checks are separate.
const test = require('node:test');
const assert = require('node:assert/strict');
assert.ok(!process.env.WINE_REGION_MAP, 'run against the checked-in region map');
const { installInputHandlers } = require('../lib/renderer-input');
const { releaseFaultInput } = require('../lib/cli-fault-input');
class InputState {}
installInputHandlers(InputState);
function fixture() {
  const r = new InputState();
  r.windows = {};
  r._inputNowMs = () => 123;
  const devices = new Map();
  const op = (id, code, value = 0) => r.directInputKeyboardBuffer(devices, id, code, value);
  const stage = (id, mode, vk, diks, size = 16) => {
    assert.equal(op(id, mode, size), 0);
    if (mode !== 0) {
      op(id, 9, vk);
      for (const dik of diks) op(id, 13, dik);
      assert.equal(op(id, 10), 0);
    }
  };
  const words = id => Array.from({length: op(id, 2)}, (_, i) => op(id, 3, i));
  return {r, devices, op, stage, words};
}
const pairs = [
  [13, 'Enter', 'NumpadEnter', 0x1c, 0x9c],
  [16, 'ShiftLeft', 'ShiftRight', 0x2a, 0x36],
  [17, 'ControlLeft', 'ControlRight', 0x1d, 0x9d],
  [18, 'AltLeft', 'AltRight', 0x38, 0xb8],
];
const word = (vk, dik, down) => 0x20000 | (dik << 9) | (down ? 0x100 : 0) | vk;
for (const [vk, left, right, ld, rd] of pairs) {
  for (const reverse of [false, true]) test('overlap/repeat/release VK ' + vk + ' reverse ' + reverse, () => {
    const {r, op, stage, words} = fixture();
    stage(1, 12, vk, [ld, rd]);
    stage(2, 8, vk, []);
    stage(3, 0, vk, []);
    const order = reverse ? [[right, rd], [left, ld]] : [[left, ld], [right, rd]];
    for (const [code] of order) r.pokeKeyDownState(vk, true, {code});
    r.pokeKeyDownState(vk, true, {code: order[0][0], repeat: true});
    r.pokeKeyDownState(vk, false, {code: order[0][0]});
    assert.equal(r.getAsyncKeyState(vk) & 0x8000, 0x8000);
    r.pokeKeyDownState(vk, false, {code: order[1][0]});
    r.pokeKeyDownState(vk, false, {code: order[1][0]});
    assert.equal(r.getAsyncKeyState(vk) & 0x8000, 0);
    const expected = [...order.map(([,d]) => word(vk,d,true)), ...order.map(([,d]) => word(vk,d,false))];
    assert.deepEqual(words(1), expected);
    assert.deepEqual(words(2), [vk | 0x100, vk]);
    assert.deepEqual(words(3), [vk | 0x100, vk]);
    const peek = words(1);
    assert.deepEqual(words(1), peek);
    assert.equal(op(1,4,0), 123);
    for (let i=1; i<4; i++) assert.equal(op(1,5,i), op(1,5,i-1)+1);
    op(1,6,2);
    assert.deepEqual(words(1), expected.slice(2));
  });
  test('prefilter/numeric/reset VK ' + vk, () => {
    const {r, op, stage, words} = fixture();
    stage(1,12,vk,[rd],2); // One usable slot.
    r.pokeKeyDownState(vk,true,{code:left});
    r.pokeKeyDownState(vk,false,{code:left});
    assert.deepEqual(words(1), []);
    assert.equal(op(1,7),0);
    r.pokeKeyDownState(vk,true,{code:right});
    r.pokeKeyDownState(vk,false,{code:right});
    assert.deepEqual(words(1),[word(vk,rd,true)]);
    assert.equal(op(1,7),1);
    op(1,6,1);
    assert.equal(op(1,7),0);
    r.pokeKeyDownState(vk,true);
    r.pokeKeyDownState(vk,false);
    assert.deepEqual(words(1),[vk | 0x100]); // Untagged fallback, same capacity rule.
    op(1,6,1);
    stage(1,12,vk,[ld,rd]);
    r.pokeKeyDownState(vk,true); // Unknown owns the aggregate.
    r.pokeKeyDownState(vk,true,{code:right});
    r.pokeKeyDownState(vk,false,{code:right});
    assert.equal(r.getAsyncKeyState(vk) & 0x8000,0x8000);
    r.pokeKeyDownState(vk,true,{code:left});
    r.pokeKeyDownState(vk,true,{code:right});
    op(1,6,op(1,2));
    r.pokeKeyDownState(vk,false); // Known releases only; no extra numeric up.
    assert.deepEqual(words(1),[word(vk,ld,false),word(vk,rd,false)]);
    assert.equal(r.getAsyncKeyState(vk) & 0x8000,0);
    releaseFaultInput({renderer:r, inputQueue:[], scheduledInput:[], crossThreadMsgs:[]});
    assert.deepEqual(words(1),[]);
    r.pokeKeyDownState(vk,true,{code:left});
    assert.deepEqual(words(1),[word(vk,ld,true)]);
    r._physicalKeys = Object.create(null);
    r.pokeKeyDownState(vk,true,{code:left});
    assert.deepEqual(words(1),[word(vk,ld,true),word(vk,ld,true)]);
  });
}
