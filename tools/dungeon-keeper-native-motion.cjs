'use strict';
// Ordinary Chromium movement only. The browser's production input bridge owns
// Pointer Lock and conversion to guest counts; never call renderer handlers.
const assert = require('node:assert/strict');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function validate(steps, intervalMs) {
  assert(Array.isArray(steps) && steps.length > 0 && steps.length <= 32, '1..32 motion steps');
  assert(Number.isInteger(intervalMs) && intervalMs >= 20 && intervalMs <= 100, '20..100ms interval');
  assert(steps.length * intervalMs <= 3000, 'bounded motion duration');
  for (const step of steps) assert(Array.isArray(step) && step.length === 2 &&
    step.every(n => Number.isInteger(n) && Math.abs(n) <= 8) && step.some(n => n !== 0), 'bounded integer mouse counts');
}
async function motion({chain, review, steps, intervalMs = 40, deadline,
  evaluate, send, pageSession, pointer, save = () => {}, wait = pause}) {
  validate(steps, intervalMs);
  assert(Number.isFinite(deadline) && Date.now() + steps.length * intervalMs + 1000 < deadline, 'motion deadline');
  return chain.admit(review, async admission => {
    const receipt = {admission, steps: [], started: Date.now(), input: 'trusted CDP mouseMoved'};
    const stopAt = Math.min(deadline, receipt.started + 5000);
    // Freeze the physical anchor for this command. No button is held by motion.
    const read = () => evaluate(`(() => {const w=runningApps[0].wine,c=document.getElementById('screen'),r=c.getBoundingClientRect();return {locked:document.pointerLockElement===c,processId:w.processId,buttons:w.renderer._mouseButtonsMask,rect:{left:r.left,top:r.top,width:r.width,height:r.height},x:globalThis.__nativeEvidence?.filter(e=>e.type==='mousemove').at(-1)?.x,y:globalThis.__nativeEvidence?.filter(e=>e.type==='mousemove').at(-1)?.y}})()`);
    const anchor = await read();
    assert(anchor.locked && anchor.buttons === 0 && anchor.processId === admission.live.identity.processId, 'own released Pointer Lock required');
    // Locked DOM client coordinates stay frozen. The retained CDP driver
    // tracks every physical coordinate it sent, including earlier commands.
    let x = pointer?.x, y = pointer?.y;
    assert(Number.isFinite(x) && Number.isFinite(y), 'observed physical mouse anchor required');
    for (const [dx, dy] of steps) {
      assert(Date.now() < stopAt, 'immutable motion deadline');
      await chain.progress(admission.live.identity);
      const current = await read();
      assert(current.locked && current.buttons === 0 && current.processId === anchor.processId, 'motion owner/lock changed');
      assert.deepEqual(current.rect, anchor.rect, 'motion geometry changed');
      assert(Date.now() < stopAt, 'immutable motion deadline');
      x += dx; y += dy;
      assert(x > anchor.rect.left && y > anchor.rect.top && x < anchor.rect.left + anchor.rect.width && y < anchor.rect.top + anchor.rect.height, 'physical step outside canvas');
      const row = {x, y, dx, dy, attemptedAt: Date.now()}; receipt.steps.push(row); save(receipt);
      await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y, button: 'none', buttons: 0}, pageSession);
      row.ackAt = Date.now(); save(receipt);
      await wait(intervalMs);
    }
    receipt.completedAt = Date.now(); save(receipt); return receipt;
  });
}
module.exports = {validate, motion};
