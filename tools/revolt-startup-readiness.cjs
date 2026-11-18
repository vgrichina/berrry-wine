'use strict';
// Startup observation only. This never admits input or changes a dialog.
const assert = require('node:assert/strict');
const admission = require('./revolt-display-admission.cjs');
const pageRead = admission.PAGE_READ.replace(
  'tag:e.tagName,id:e.id,box:e.getBoundingClientRect().toJSON()',
  'tag:e.tagName,id:e.id,dataWait:e.closest(".wa-game-wait")===document.querySelector(".wa-game-wait"),box:e.getBoundingClientRect().toJSON()');
assert.notEqual(pageRead, admission.PAGE_READ, 'startup obstruction reader must be installed');
const DATA_WAIT_READ = `(() => {
  const w=runningApps[0]?.wine,wait=w?._gameWait;
  const nodes=[...document.querySelectorAll('.wa-game-wait')];
  const e=nodes.length===1?nodes[0]:null;
  const visible=n=>!!n&&!n.hidden&&n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0&&getComputedStyle(n).visibility!=='hidden';
  return {visible:!!wait?.visible,current:wait?.current??null,
    dialog:e?{className:e.className,role:e.getAttribute('role'),marker:e.dataset.winePageDialog,
      visible:visible(e),progressVisible:visible(e.querySelector('[role=progressbar]')),
      actionsVisible:[...e.querySelectorAll('button')].some(visible),
      autoContinue:e.querySelector('.wa-game-wait-note')?.textContent==='Loading will continue automatically.'}:null};
})()`;
const READ = `({page:(${pageRead}),dataWait:(${DATA_WAIT_READ})})`;

function classify(snapshot) {
  const {page, dataWait} = snapshot;
  assert(page?.isolated && page.apps?.length === 1, 'one isolated startup owner required');
  const app = page.apps[0];
  assert(app.running && !app.stopped && app.guestWorker, 'live startup owner required');
  if (app.outputVisible) return 'ready';
  const d = dataWait?.dialog;
  assert(app.outputVisibility?.reason === 'intersecting painted DOM box' &&
    app.outputVisibility.element?.dataWait === true && dataWait?.visible &&
    dataWait.current?.state === 'waiting' && d?.visible &&
    d.className === 'wa-launch wa-game-wait' && d.role === 'dialog' && d.marker === '1' &&
    d.progressVisible && !d.actionsVisible && d.autoContinue,
  'unexpected startup obstruction');
  return 'waiting';
}

// capture returns an unadmitted candidate. A normal data wait may appear
// between its two snapshots. Discard that candidate and observe naturally;
// no action scene exists until both ends pass the unchanged visible predicate.
async function captureReady({observe, capture, sameOwner, deadline,
  now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)), onObservation = () => {}}) {
  assert(Number.isFinite(deadline), 'finite startup deadline required');
  let owner;
  for (;;) {
    assert(now() < deadline, 'finite startup readiness deadline');
    const before = await observe();
    const app = before.page?.apps?.[0];
    if (owner) sameOwner(owner, app); else owner = app;
    const state = classify(before);
    onObservation({stage: 'before', state, snapshot: before});
    if (state === 'waiting') { await sleep(50); continue; }
    const candidate = await capture(before);
    if (candidate === null) { await sleep(50); continue; }
    const after = await observe();
    sameOwner(owner, after.page?.apps?.[0]);
    const finalState = classify(after);
    onObservation({stage: 'after', state: finalState, snapshot: after, discarded: finalState !== 'ready'});
    assert(now() < deadline, 'finite startup readiness deadline');
    if (finalState === 'ready') return {candidate, before, after};
    await sleep(50);
  }
}
module.exports = {READ, DATA_WAIT_READ, classify, captureReady};
