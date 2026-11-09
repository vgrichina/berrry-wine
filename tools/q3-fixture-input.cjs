'use strict';
const assert = require('node:assert/strict');
const KEYS = Object.freeze({Enter:13,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,
  Escape:27,Tab:9,Control:17,Space:32,w:87,p:80,a:65,',':188,'.':190});

// Runs in the generated document. Production renderer handlers own the only
// physical map; neither the command transport nor the sampler writes it.
function installFixtureInput({renderer, wine, link, scope = globalThis}) {
  class FixtureInput {}
  scope.installInputHandlers(FixtureInput);
  delete renderer.peekKeyDownState;
  Object.setPrototypeOf(renderer, FixtureInput.prototype);
  renderer.inputQueue = [];
  renderer.wasm = {exports:{}};
  renderer._guestWorkerWasms = new Set([renderer.wasm]);
  const worker = link.worker, module = link.module, endpoint = link.endpointIdentity;
  const check = () => {
    if (!wine.running || wine._stopped || wine.renderer !== renderer || wine.guestWorker.link !== link ||
        link._stopping || link.worker !== worker || link.module !== module ||
        link.endpointIdentity !== endpoint || link.slot !== 0)
      throw Error('Q3 fixture input owner changed');
  };
  for (const type of ['keydown','keyup']) scope.addEventListener(type, event => {
    if (!event.isTrusted) return;
    try {
      check();
      const info = {code:event.code || '',location:event.location | 0,repeat:!!event.repeat};
      renderer[type === 'keydown' ? 'handleKeyDown' : 'handleKeyUp'](event.keyCode, info);
      event.preventDefault();
    } catch (error) { scope.__generatedError = String(error); }
  });
}

function checkSample(value, keys, down, previous) {
  assert(value?.physicalSource?.kind === 'renderer-input.peekKeyDownState', 'fixture physical source missing');
  for (const name of ['renderer','endpoint','worker','module','reader'])
    assert(value.physicalSource[name], 'fixture physical source identity missing: '+name);
  if (previous) assert.deepEqual(value.physicalSource, previous, 'fixture physical source changed');
  for (const key of keys) {
    const rows = value.physical?.filter(row => row.key === KEYS[key]);
    assert(rows?.length === 1, 'commanded fixture key missing: '+key);
    assert.equal(rows[0].state, down ? 0x8000 : 0, 'commanded fixture key state: '+key);
  }
  return value;
}

async function hold(options) {
  if (!options.fixture) return require('./q3-input-delivery.cjs').hold(options);
  let identity, receipt;
  try {
    receipt = await require('./q3-input-delivery.cjs').hold({...options, sample:async () => {
      const value = checkSample(await options.sample(), options.keys, true, identity);
      identity = value.physicalSource;
      return value;
    }});
    assert(receipt.samples.some(s => s.whollyDuringHold), 'fixture wholly held sample missing');
    const began = Date.now();
    receipt.releaseSample = {phase:'released', started:began,
      ...checkSample(await options.sample(), options.keys, false, identity), finished:Date.now()};
    receipt.fixturePhysicalGate = 'PASS';
    options.saveReceipt?.(receipt);
    return receipt;
  } catch (error) {
    if (receipt) {
      receipt.fixturePhysicalGate = 'FAIL';receipt.fixtureError = String(error);
      error.fixtureReceipt = receipt;options.saveReceipt?.(receipt);
    }
    options.onFailure?.(error); throw error;
  }
}
module.exports = {KEYS, installFixtureInput, checkSample, hold};
