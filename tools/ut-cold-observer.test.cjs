'use strict';
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const {createObserver} = require('./ut-passive-observer.cjs');
const {fencePage, finalize, verifyWorkers} = require('./ut-observer-scope.cjs');

(async () => {
  const memory = new WebAssembly.Memory({initial:1}), view = new DataView(memory.buffer);
  // A shared DLL registry can already exist while this instance is still cold.
  view.setUint32(1024, 0x10a80000, true);
  view.setUint32(1032, 0x2000, true);
  let mapped = false, reads = 0, traces = 0;
  const rows = [], o = createObserver({emit:r => rows.push(r), deadline:Date.now()+10000});
  const host = {memory, log_eip() {}};
  const native = {exports:{
    guest_to_wasm(p) { reads++; assert(mapped); return p-0x10a80000+2048; },
    get_dll_table:() => 1024, get_dll_count:() => 1,
    set_trace_eip_range() { traces++; },
    init_thread() { mapped = true; }, load_pe:() => 0, load_dll() {},
  }};
  const wrapped = o.wrapImports({host})(native);
  host.log_eip(0x10a8964f);
  wrapped.exports.load_dll();
  wrapped.exports.load_pe(); // failed PE load does not authorize guest reads
  assert.equal(reads, 0);
  assert.equal(traces, 0);
  wrapped.exports.init_thread();
  assert(reads > 0);
  assert(o.summary().contexts[0].initialized);
  o.retire(wrapped);
  const retiredReads = reads;
  host.log_eip(0x10a8964f);
  wrapped.exports.load_dll();
  assert.equal(reads, retiredReads);
  assert(o.summary().contexts[0].retired);
  assert.deepEqual(rows, []);

  const failure = createObserver({emit:r => rows.push(r), deadline:Date.now()+10000});
  const bad = failure.wrapImports({host:{memory,log_eip(){}}})({exports:{...native.exports,
    guest_to_wasm() { return 0xf0; },
  }});
  bad.exports.init_thread();
  assert.equal(rows.at(-1).error, 'Error: unmapped 10a8200c');
  assert.equal(rows.at(-1).reason, 'UNKNOWN:setup');

  const good = [{source:[{match:true}], modules:[{match:true}]}];
  assert(verifyWorkers(good));
  for (const row of [[], [{source:[],modules:[{match:true}]}],
    [{source:[{match:false}],modules:[{match:true}]}],
    [{source:[{match:true}],modules:[{match:false}]}],
    [{...good[0],error:'exact retained error'}]]) assert.throws(() => verifyWorkers(row));

  let terminal = false, endpointCalls = 0;
  const actual = new EventEmitter();
  actual.evaluate = () => { endpointCalls++; return Promise.resolve(1); };
  const page = fencePage(actual, () => terminal, () => { terminal = true; });
  const listener = () => {};
  page.on('console', listener);
  await page.evaluate();
  terminal = true;
  page.off('console', listener);
  assert.equal(actual.listenerCount('console'), 0);
  assert.throws(() => page.evaluate(), /ZERO later endpoints/);
  assert.equal(endpointCalls, 1);
  const reached = [];
  const final = await finalize([
    ['cancel', () => { page.off('console', listener); throw Error('authored cancellation failure'); }],
    ['browser wait', () => reached.push('browser')],
    ['display wait', () => reached.push('display')],
    ['OS cleanup', () => reached.push('cleanup')],
  ]);
  assert.equal(final[0].status, 'rejected');
  assert.deepEqual(reached, ['browser','display','cleanup']);
  console.log('PASS cold, failed-PE, initialized, retired, exact row.error, every-worker identity, terminal listener and cleanup negatives');
})().catch(e => { console.error(e); process.exitCode = 1; });
