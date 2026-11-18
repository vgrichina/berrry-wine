#!/usr/bin/env node
'use strict';

// USER-DRAKAN-WEBKIT-20261011, the renderer half. With Threads on, every key
// was queued for the guest Worker. A common modal (MessageBox, file dialogs)
// parks its API call in the Worker's CACA0006 pump, which never reads that
// queue -- it waits for the shared completion the page shadow's WAT dialog
// publishes. So Enter/Esc must go to the shadow's dialog, as a click on its
// buttons does; anything else, and any key with no modal up, still queues.

const assert = require('assert');
const { installInputHandlers } = require('../lib/renderer-input');

const P = {};
installInputHandlers({ prototype: P });

function renderer(modalHwnd) {
  const handled = [];
  const wasm = { exports: {
    modal_dialog_hwnd: () => modalHwnd,
    dialog_handle_key: (...args) => { handled.push(args); return 1; },
    modal_cancel_if_hwnd: () => {},
  } };
  const r = Object.create(P);
  r.wasm = wasm;
  r.windows = modalHwnd ? { [modalHwnd]: { hwnd: modalHwnd, visible: true, isAboutDialog: true } } : {};
  r.inputQueue = [];
  r._guestWorkerWasms = new Set([wasm]);
  r._asyncKeys = {};
  r._asyncPressedKeys = {};
  r._physicalKeys = {};
  r._wakeMessageWait = () => {};
  r.scheduleRepaint = () => {};
  r.repaint = () => {};
  return { r, handled };
}

for (const vk of [13, 27]) {
  const { r, handled } = renderer(0x10001);
  r.handleKeyDown(vk, { code: vk === 13 ? 'Enter' : 'Escape' });
  assert.deepStrictEqual(handled, [[0x10001, vk, 0]],
    `vk ${vk} answers the Worker's common modal through the shadow`);
  assert.deepStrictEqual(r.inputQueue, [], `vk ${vk} is not queued for the parked Worker`);
  r.handleKeyPress(vk);
  assert.deepStrictEqual(r.inputQueue, [], `vk ${vk}'s character is not delivered after the dialog took it`);
}

{
  const { r, handled } = renderer(0x10001);
  r.handleKeyDown(0x41, { code: 'KeyA' });
  assert.deepStrictEqual(handled, [], 'other keys are not the dialog\'s answer');
  assert.strictEqual(r.inputQueue.length, 1, 'and still go to the Worker');
}

{
  const { r, handled } = renderer(0);
  r.handleKeyDown(13, { code: 'Enter' });
  assert.deepStrictEqual(handled, [], 'no modal: nothing is answered on the shadow');
  assert.strictEqual(r.inputQueue.length, 1, 'Enter is queued for the guest as before');
}

console.log('PASS  Enter/Esc answer a Worker-parked common modal through the page shadow');

// Real native MessageBox frames now have an owning modal keyboard pump.
// Physical input must remain queued for its exact native return proof.
for (const vk of [13, 27, 9]) {
  const { r, handled } = renderer(0x10001);
  r.wasm.exports.ctrl_get_class = () => 16;
  r.handleKeyDown(vk);
  assert.deepStrictEqual(handled, [], 'native MessageBox never executes on a shadow');
  assert.strictEqual(r.inputQueue.length, 1);
  assert.strictEqual(r.inputQueue[0].wParam, vk);
}
console.log('PASS native MessageBox keys enqueue for the owning CPU pump');
