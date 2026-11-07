'use strict';
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {test} = require('node:test');
const {captureWorkerCensus} = require('../tools/capture-worker-census');

function fixture(order = ['aux', 'owner']) {
  const page = new EventEmitter();
  const owner = {targetId: 'owner-target', sessionId: 'owner-session'};
  const aux = {targetId: 'aux-target', sessionId: 'aux-session'};
  let live = order.map(k => ({owner, aux})[k]);
  page.workers = () => [...live];
  const retire = w => { live = live.filter(x => x !== w); page.emit('workerdestroyed', w); };
  const row = w => ({...w, slot: w === owner ? 0 : 2, endpoint: w === owner ? 1 : 3,
    modules: [{sha256: 'actual-bytecode'}], errors: []});
  const options = {identify: w => ({...w}), requiredOwners: [{slot: 0, sha256: 'actual-bytecode'}]};
  return {page, owner, aux, retire, row, options};
}
for (const order of [['aux', 'owner'], ['owner', 'aux']]) {
  test('auxiliary retirement preserves verified owner: ' + order, async () => {
    const f = fixture(order);
    const result = await captureWorkerCensus(f.page, {...f.options, read: async w => {
      if (w === f.aux) { f.retire(w); throw Error('Execution context is not available in detached frame or worker'); }
      return f.row(w);
    }});
    assert.equal(result.workers.length, 1);
    assert.equal(result.workers[0].targetId, 'owner-target');
    assert.deepEqual(result.retirements.map(r => [r.targetId, r.slot, r.endpoint]), [['aux-target', null, null]]);
    assert.equal(f.page.listenerCount('workerdestroyed'), 0);
  });
}
test('owning worker retirement during its read fails closed', async () => {
  const f = fixture();
  await assert.rejects(captureWorkerCensus(f.page, {...f.options, read: async w => {
    if (w === f.owner) { f.retire(w); throw Error('Execution context was destroyed'); }
    return f.row(w);
  }}), e => e.message.includes('owning-worker observation unavailable') && e.observation.retirements[0].slot === null);
});
test('owner loss after successful read while auxiliary retires fails closed', async () => {
  const f = fixture(['owner', 'aux']);
  await assert.rejects(captureWorkerCensus(f.page, {...f.options, read: async w => {
    if (w === f.aux) { f.retire(f.owner); f.retire(w); throw Error('Target closed'); }
    return f.row(w);
  }}), /owning worker lost/);
});
test('owner revalidation failure fails closed', async () => {
  const f = fixture(); let reads = 0;
  await assert.rejects(captureWorkerCensus(f.page, {...f.options, read: async w => {
    if (w === f.owner && ++reads === 2) throw Error('Target closed');
    return f.row(w);
  }}), /revalidation failed/);
});
test('unproven detach and arbitrary evaluation errors are not suppressed', async () => {
  for (const message of ['Target closed', 'bad expression']) {
    const f = fixture();
    await assert.rejects(captureWorkerCensus(f.page, {...f.options, read: async () => { throw Error(message); }}), new RegExp(message));
  }
});
test('missing owner, wrong module, changed endpoint, and missing policy fail closed', async () => {
  for (const variant of ['missing', 'module', 'endpoint', 'policy']) {
    const f = fixture(variant === 'missing' ? ['aux'] : ['owner']); let reads = 0;
    const options = {...f.options, read: async w => {
      const row = f.row(w);
      if (variant === 'module') row.modules = [];
      if (variant === 'endpoint' && ++reads === 2) row.endpoint++;
      return row;
    }};
    if (variant === 'policy') delete options.requiredOwners;
    await assert.rejects(captureWorkerCensus(f.page, options));
  }
});
