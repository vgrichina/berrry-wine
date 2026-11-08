'use strict';
// Execute the production expression wrapper. Only CDP marker delivery is a
// local protocol fixture; no browser, game or GPU observation is supplied.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {install} = require('./q3-execution-boundary.cjs');
const bound = require('../scratch/runs/20261108-q3-gl-readiness-gameplay/bound-input.cjs');
class Socket extends EventTarget {
  send(data) { this.sent = JSON.parse(data); }
  receive(value) {
    const event = new Event('message'); event.data = JSON.stringify(value);
    this.dispatchEvent(event);
  }
}
function scenario(name, delivery) {
  const diagnostic = install({WebSocket:Socket, trace:{snapshot() {}}, write() {}});
  const socket = new diagnostic.WebSocket(), markers = [];
  let evaluations = 0, ticks = 40;
  const context = vm.createContext({crypto:require('node:crypto'),
    performance:{now:() => ++ticks}, crossOriginIsolated:true,
    document:{getElementById:() => null}, runningApps:{map() { evaluations++; return []; }},
    console:{debug(...values) {
      markers.push({method:'Runtime.consoleAPICalled', sessionId:'page',
        params:{executionContextId:17, timestamp:1234, args:values.map(value => ({value}))}});
    }}});
  socket.send(JSON.stringify({id:1, method:'Runtime.evaluate', sessionId:'page',
    params:{expression:bound.PAGE_READ, returnByValue:true}}));
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext(socket.sent.params.expression, context))), {isolated:true, apps:[]});
  assert.equal(evaluations, 1, 'genuine owner expression runs once');
  assert.equal(markers.length, 2, 'production wrapper emits entry and exit');
  for (const marker of delivery(markers)) socket.receive(marker);
  socket.receive({id:1, sessionId:'page', result:{result:{value:{isolated:true,apps:[]}}}});
  const row = diagnostic.snapshot(name).records[0];
  assert.equal(row.response, 'returned', 'CDP response stays independent');
  return row;
}
function setMs(marker, value) {
  const record = JSON.parse(marker.params.args[1].value);
  record.ms = value; marker.params.args[1].value = JSON.stringify(record);
}
const cases = [
  ['different execution contexts', markers => { markers[1].params.executionContextId=18; return markers; }],
  ['missing execution context', markers => { for(const m of markers) delete m.params.executionContextId; return markers; }],
  ['nonfinite marker clock', markers => { setMs(markers[1], null); return markers; }],
  ['string marker clock', markers => { setMs(markers[1], '42'); return markers; }],
  ['backwards marker clock', markers => { setMs(markers[1], 1); return markers; }],
  ['negative marker clock', markers => { setMs(markers[0], -1); return markers; }],
  ['duplicate entry', markers => [markers[0], markers[0], markers[1]]],
  ['duplicate exit', markers => [markers[0], markers[1], markers[1]]],
  ['exit before entry', markers => [...markers].reverse()]
];
const invalid = cases.map(([name, deliver]) => ({name, row:scenario(name,deliver)}));
console.log(JSON.stringify({protocolFixtureOnly:true, invalid}, null, 2));
for (const {name,row} of invalid) {
  assert.equal(row.synchronousJsMs, null, name+' cannot establish a same-context interval');
  assert(row.timingUnavailableReason, name+' retains a concrete timing limit');
}
const valid = scenario('same context', markers => markers);
assert.equal(valid.synchronousJsMs,1);
assert.equal(valid.timingUnavailableReason,null);
const zero = scenario('same clock tick', markers => { setMs(markers[1],41); return markers; });
assert.equal(zero.synchronousJsMs,0);
const missing = scenario('entry only', markers => [markers[0]]);
assert.equal(missing.execution,'entered; exit unavailable');
assert.equal(missing.synchronousJsMs,null);
console.log('PASS actual Q3 expression wrapper: independent response, same-context finite ordered interval only; malformed/mismatched/duplicate/reordered markers stay unavailable');
