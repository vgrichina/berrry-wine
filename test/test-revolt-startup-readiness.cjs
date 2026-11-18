'use strict';
const assert = require('node:assert/strict');
const {classify, captureReady} = require('../tools/revolt-startup-readiness.cjs');
function snapshot(waiting = false) {
  return {withoutDataWait: {apps: [{outputVisible: true}]}, page: {isolated: true, apps: [{id: 'original', running: true, guestWorker: true,
    outputVisible: !waiting, outputVisibility: {reason: 'intersecting painted DOM box', element: {dataWait: true}}}]},
  dataWait: {visible: true, current: {state: 'waiting'}, dialog: {className: 'wa-launch wa-game-wait',
    role: 'dialog', marker: '1', visible: true, progressVisible: true, actionsVisible: false, autoContinue: true}}};
}
const sameOwner = (a, b) => assert.equal(a?.id, b?.id, 'startup owner replaced');
(async () => {
  assert.equal(classify(snapshot()), 'ready');
  assert.equal(classify(snapshot(true)), 'waiting');
  for (const change of [s => {s.dataWait.current.state = 'error';}, s => {s.dataWait.dialog.actionsVisible = true;},
    s => {s.page.apps[0].outputVisibility.element.dataWait = false;}, s => {s.dataWait.visible = false;},
    s => {s.dataWait.dialog.progressVisible = false;}, s => {s.dataWait.dialog.className += ' foreign';},
    s => {s.withoutDataWait.apps[0].outputVisible = false;}]) {
    const s = snapshot(true); change(s); assert.throws(() => classify(s), /unexpected startup obstruction/);
  }
  let at = 0, captures = 0;
  const states = [snapshot(true), snapshot(), snapshot(true), snapshot() ,snapshot()];
  const r = await captureReady({observe: async () => states.shift(), capture: async () => ++captures,
    sameOwner, deadline: 1000, now: () => at, sleep: async ms => {at += ms;}});
  assert.equal(r.candidate, 2, 'candidate obscured during capture is discarded');
  let pending = true;
  const retried = await captureReady({observe: async () => snapshot(),
    capture: async () => {if (pending) {pending = false; return null;} return 'unobscured';},
    sameOwner, deadline: 1000, now: () => at, sleep: async ms => {at += ms;}});
  assert.equal(retried.candidate, 'unobscured');
  await assert.rejects(captureReady({observe: async () => snapshot(),
    capture: async () => {throw Error('transport UNKNOWN');}, sameOwner,
    deadline: 1000, now: () => at}), /transport UNKNOWN/);
  await assert.rejects(captureReady({observe: async () => snapshot(true), capture: async () => assert.fail('no capture while waiting'),
    sameOwner, deadline: at + 50, now: () => at, sleep: async ms => {at += ms;}}), /deadline/);
  const replacement = snapshot(); replacement.page.apps[0].id = 'replacement';
  const sequence = [snapshot(), replacement];
  await assert.rejects(captureReady({observe: async () => sequence.shift(), capture: async () => 1,
    sameOwner, deadline: 1000, now: () => at}), /owner replaced/);
  console.log('PASS ReVolt startup data wait, mid-capture race discard, error/foreign obstruction, owner replacement, finite deadline');
})().catch(e => {console.error(e); process.exitCode = 1;});
