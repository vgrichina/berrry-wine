'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {install} = require('./q3-execution-boundary.cjs');
const retained = path.resolve(__dirname, '../scratch/runs/20261108-q3-gl-readiness-gameplay');
const bound = require(retained+'/bound-input.cjs');
class Socket extends EventTarget {
  send(data) { this.sent = JSON.parse(data); }
  receive(value) { const event = new Event('message'); event.data = JSON.stringify(value); this.dispatchEvent(event); }
}
const written = [], calls = [];
const trace = {snapshot:reason => calls.push(reason)};
const d = install({WebSocket:Socket, trace, write:row => written.push(row), capacity:3});
const ws = new d.WebSocket();
let consumerMessages = 0;
ws.addEventListener('message', () => consumerMessages++);
function request(id, expression = bound.PAGE_READ) {
  ws.send(JSON.stringify({id, method:'Runtime.evaluate', sessionId:'page', params:{expression,awaitPromise:true,returnByValue:true}}));
  return ws.sent.params.expression;
}
const registry = {epoch:'document-token', ids:new WeakMap(), next:0};
let getCount = 0, ticks = 0;
const context = vm.createContext({crypto:require('node:crypto'),performance:{now:()=>++ticks},
  crossOriginIsolated:true, document:{getElementById:()=>null}, runningApps:[],
  __mcmPassiveIdentityV1:registry,
  console:{debug:(...values)=>ws.receive({method:'Runtime.consoleAPICalled',sessionId:'page',params:{executionContextId:17,timestamp:1234,args:values.map(value=>({value}))}})}});
request(1); // Queued/unexecuted: do not fabricate entry from send or response.
trace.snapshot('outer deadline');
assert.equal(written[0].records[0].execution,'entry unavailable');
assert.equal(written[0].records[0].synchronousJsMs,null);
assert.equal(written[0].queueResidenceMs,null);
assert.deepEqual(calls,['outer deadline']);
const expression = request(2);
assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext(expression,context))), {isolated:true,apps:[]});
const completed = d.snapshot('completed').records[1];
assert.equal(completed.execution,'exited');
assert.equal(completed.entry.executionContextId,17);
assert.equal(completed.synchronousJsMs,1);
assert.equal(consumerMessages,0,'marker delivery stays out of ordinary consumer logs');
// Exact PAGE_READ executes once, including a throwing production-access boundary.
context.runningApps={map(){getCount++;throw Error('owner getter failed');}};
assert.throws(()=>vm.runInContext(request(3),context),/owner getter failed/);
assert.equal(getCount,1);
assert.equal(d.snapshot('error').records[2].jsResult,'error');
request(4);
const ring = d.snapshot('ring');
assert.equal(ring.dropped,1); assert.equal(ring.records.length,3);
ws.receive({id:4,sessionId:'page',result:{result:{value:{}}}});
assert.equal(d.snapshot('response without marker').records[2].execution,'entry unavailable');
ws.send(JSON.stringify({id:9,method:'Input.dispatchKeyEvent',params:{type:'keyUp'}}));
assert.equal(ws.sent.method,'Input.dispatchKeyEvent');
assert.equal(ws.sent.params.type,'keyUp');
vm.runInContext('runningApps={map(){while(true){}}}',context);
assert.throws(()=>vm.runInContext(request(5),context,{timeout:10}),/timed out/);
const partial=d.snapshot('execution interrupted').records.at(-1);
assert.equal(partial.execution,'entered; exit unavailable');
assert.equal(partial.synchronousJsMs,null);
assert.equal(partial.entry.executionContextId,17);
// The other genuine owner expressions retain their actual return/token shape.
for (const [source,setup,type] of [
  [bound.WORKER_READ,"endpointIdentity='cpu-owner';workerSlot=4;instance={}",'guest.instance'],
  [bound.RENDER_READ,"instance={};endpoints=new Map([['render-owner',{options:{api:'gl'},failed:false}]])",'renderer.owner']
]) {
  const local=install({WebSocket:Socket,trace:{snapshot(){}},write(){}}), socket=new local.WebSocket();
  const scope=vm.createContext({crypto:require('node:crypto'),performance:{now:()=>++ticks},
    console:{debug:(...values)=>socket.receive({method:'Runtime.consoleAPICalled',sessionId:'worker',params:{executionContextId:27,args:values.map(value=>({value}))}})}});
  vm.runInContext(setup,scope);
  socket.send(JSON.stringify({id:11,sessionId:'worker',method:'Runtime.evaluate',params:{expression:source}}));
  const value=vm.runInContext(socket.sent.params.expression,scope);
  const record=local.snapshot('worker').records[0];
  assert.equal(record.kind,type);assert.equal(record.execution,'exited');
  assert.equal(record.entry.executionContextId,27);
  if(type==='guest.instance')assert.equal(record.ownerTokens.instance,value.instance);
  else assert.equal(record.ownerTokens[0].epoch,value[0].epoch);
}
// Exercise the genuine retained transport's deadline/late/error closure using
// an in-memory filesystem, with no browser, game, input or on-disk log fixture.
const files = new Map();
const out='/memory';
const memoryFs={existsSync:p=>files.has(p),readFileSync:p=>{if(!files.has(p))throw Error('ENOENT '+p);return files.get(p);},writeFileSync:(p,v,options)=>{if(options?.flag==='wx'&&files.has(p))throw Error('EEXIST');files.set(p,v);}};
const base={writeJson:(p,v)=>files.set(p,JSON.stringify(v))};
const transportModule={exports:{}};
vm.runInNewContext(`(function(require,module,exports){${fs.readFileSync(retained+'/transport.cjs','utf8')}\n})`,{setTimeout,clearTimeout,Date})(name=>name==='node:fs'?memoryFs:name==='./ack-client.cjs'?base:name==='./trace.cjs'?trace:require(name),transportModule,transportModule.exports);
const transport=transportModule.exports;
async function transportCase(mode) {
  files.clear();const runEnd=Date.now()+90000;
  files.set(out+'/execution-window.json',JSON.stringify({browserStop:new Date(runEnd).toISOString()}));
  files.set(out+'/commands/0.json',JSON.stringify({id:'one',timing:{runEnd,workEnd:Date.now()+30,ackEnd:Date.now()+2031}}));
  let finish, dispatches=0;
  await assert.rejects(transport.consume(out,0,async(c,mark)=>{mark();dispatches++;if(mode==='error')throw Error('CDP UNKNOWN');await new Promise(resolve=>{finish=resolve;});}),/UNKNOWN|deadline/);
  assert(files.has(out+'/first-failure.json'));
  finish?.();await Promise.resolve();await Promise.resolve();
  assert(!files.has(out+'/reply-0.json'),'late resolution cannot publish successful ACK');
  await assert.rejects(transport.consume(out,0,async()=>{dispatches++;}),/duplicate|sticky/);
  assert.equal(dispatches,1);
}
(async()=>{
  await transportCase('late');await transportCase('error');
  // Genuine hold release runs before a pending passive evaluation settles.
  let finishSample, released=false;
  const holding=bound.hold({send:async(method,p)=>{if(p.type==='keyUp')released=true;},session:'page',keys:['Enter'],holdMs:50,
    sample:()=>new Promise(resolve=>{finishSample=resolve;})});
  await new Promise(resolve=>setTimeout(resolve,75));
  assert(released,'independent release must not await passive evaluate');
  finishSample({});await holding;
  const chain=bound.createChain({evaluate:async()=>{throw Error('CDP UNKNOWN');},send:async()=>{},workers:new Map(),pageSession:'page'});
  await assert.rejects(chain.admit({},()=>{})); assert(chain.closed);
  await assert.rejects(chain.admit({},()=>{}),/closed/);
  for(let n=0;n<20;n++)d.snapshot('bounded');assert.equal(written.length,8);
  console.log('PASS actual retained PAGE_READ, transport deadline/late/error/no replay, closed chain, independent hold release; bounded markers and unavailable no-entry');
})().catch(error=>{console.error(error);process.exitCode=1;});
