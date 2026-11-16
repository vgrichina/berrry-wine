'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const prior=require('../tools/quake3-startup-latency-controller.cjs');
const task=require('../tools/quake3-startup-task-controller.cjs'),vm=require('node:vm');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function candidate(){
  return require('../tools/quake3-native-snapshot-latency.cjs');
}

// Independent latency oracles. The production analyzer must distinguish each
// interval even when all three controls have the same total response latency.
function fixture({queue=1,body=1,delivery=1,enqueue=0,native=null}={}) {
  const identity={connectionId:'fixture:1',targetId:'worker',sessionId:'session',contextUniqueId:'context'};
  const host={enqueue:1000,send:1000+enqueue,response:1000+enqueue+queue+body+delivery};
  const worker={entry:host.send+queue,bodyEntry:host.send+queue,bodyExit:host.send+queue+body,exit:host.send+queue+body};
  return {identity,requestId:17,ordinal:1,host,worker,native,
    expected:{helperMs:enqueue,preEntryMs:queue,bodyMs:body,deliveryMs:delivery}};
}

// Exercise the candidate itself; interval oracles below are independent.
const nativeInstrumentation=()=>candidate().instrumentation();
const nativeMetadata=raw=>candidate().metadata(raw);

test('native samples preserve only allowed scalar metadata and reject invented durations',()=>{
  const raw={kind:'gl-getShaderParameter',phase:'end',seq:20,ms:101,epochMs:10001,endpoint:null,owner:null,
    nativeStartMs:10,args:['SECRET'],result:'SECRET',driverText:'SECRET'};
  const row=nativeMetadata(raw);assert.equal(row.nativeStartMs,10);assert(!JSON.stringify(row).includes('SECRET'));
  for(const nativeStartMs of [undefined,NaN,Infinity,102])assert.throws(()=>nativeMetadata({...raw,nativeStartMs}));
});

test('native diagnostic remains bounded and overflow is explicit while ordinary returns continue',()=>{
  const rows=[];let calls=0;const gl={getError(){return ++calls;}};
  class Canvas {getContext(){return gl;}}
  const c=vm.createContext({performance,WebAssembly:{},OffscreenCanvas:Canvas,__gltronObserver:{snapshot:()=>null},[task.BINDING]:s=>rows.push(JSON.parse(s))});
  vm.runInContext(nativeInstrumentation(),c);new Canvas().getContext('webgl2');
  for(let i=1;i<=16000;i++)assert.equal(gl.getError(),i);
  assert.equal(rows.length,task.LIMIT);assert.equal(rows.filter(r=>r.phase==='overflow').length,1);
  assert(c.__q3Task.stats().dropped>0);assert.equal(c.__gltronObserver.snapshot(),null);
  assert.equal(rows.length,task.LIMIT,'no recovery query or unbounded sink growth');
});

// A separate reference interval calculation; no causal inference from receipt
// proximity, heartbeat return, or a historical run's native durations.
function intervals(f){
  const {host:h,worker:w}=f;
  for(const v of [...Object.values(h),...Object.values(w)])assert(Number.isFinite(v));
  assert(h.enqueue<=h.send&&h.send<=h.response);
  assert(w.entry<=w.bodyEntry&&w.bodyEntry<=w.bodyExit&&w.bodyExit<=w.exit);
  assert(w.entry>=h.send-2&&h.response>=w.exit-2);
  return {helperMs:h.send-h.enqueue,preEntryMs:w.entry-h.send,bodyMs:w.bodyExit-w.bodyEntry,deliveryMs:h.response-w.exit};
}

test('interval reference separates helper cost and refuses invalid clocks without clamping',()=>{
  for(const f of [fixture({queue:3400}),fixture({body:3400}),fixture({delivery:3400}),fixture({enqueue:50})])
    assert.deepEqual(intervals(f),f.expected);
  const tolerated=fixture();tolerated.worker.entry=tolerated.host.send-1;
  assert.equal(intervals(tolerated).preEntryMs,-1,'raw sampling uncertainty is retained');
  for(const patch of [{entry:-10},{bodyExit:1e6},{bodyEntry:NaN}]){
    const f=fixture();Object.assign(f.worker,patch);assert.throws(()=>intervals(f));
  }
});

test('a pending native entry and a returned heartbeat cannot identify a completed driver interval',()=>{
  const f=fixture({queue:3400,native:{method:'getShaderParameter',entry:990,exit:null}});
  const heartbeat={responded:true,at:f.host.send+2,targetId:'other-worker'};
  assert(heartbeat.responded);assert.equal(f.native.exit,null);
  assert.equal(f.native.exit===null?null:f.native.exit-f.native.entry,null);
  // Once a completion with the same identity is retained, occupancy can be
  // computed. The binding-send interval remains outside the native interval.
  const announced=990,nativeStart=995,nativeExit=4300;
  assert.equal(nativeExit-nativeStart,3305);assert.equal(nativeStart-announced,5);
});

test('new native-entry design survives a call that has not returned, beyond old first-sixteen sampling',()=>{
  const rows=[],calls=[];let clock=0;
  const gl={getShaderParameter(...args){
    assert.equal(this,gl);calls.push(args);
    const entry=rows.at(-1);assert.equal(entry.kind,'gl-getShaderParameter');assert.equal(entry.phase,'begin');
    assert(!rows.some(r=>r.seq===entry.seq&&r.phase==='end'),'entry must already be durable while native is pending');
    clock+=3200;return 71;
  }};
  class Canvas {getContext(){return gl;}}
  const c=vm.createContext({performance:{timeOrigin:10000,now:()=>++clock},WebAssembly:{},OffscreenCanvas:Canvas,
    __gltronObserver:{snapshot:()=>null},[task.BINDING]:s=>rows.push(JSON.parse(s))});
  vm.runInContext(nativeInstrumentation(),c);const canvas=new Canvas();canvas.getContext('webgl2');
  for(let i=0;i<20;i++)assert.equal(gl.getShaderParameter(i,3),71);
  assert.equal(calls.length,20);assert.equal(rows.filter(r=>r.kind==='gl-getShaderParameter'&&r.phase==='begin').length,20);
  for(const end of rows.filter(r=>r.kind==='gl-getShaderParameter'&&r.phase==='end')){
    const start=rows.find(r=>r.seq===end.seq&&r.phase==='begin');assert(start.ms<end.nativeStartMs);
    assert.equal(end.ms-end.nativeStartMs,3201,'binding cost stays outside actual native duration');
  }
  assert.equal(rows.filter(r=>r.kind==='gl-getShaderParameter'&&r.phase==='end').length,20);
});

test('native-entry design adds no GL queries and preserves exact exception and result with a broken sink',()=>{
  let queries=0;const value={secret:'not logged'},error=Error('not logged');
  const gl={getShaderParameter(){queries++;return value;},getProgramParameter(){queries++;throw error;}};
  class Canvas {getContext(){return gl;}}
  const c=vm.createContext({performance,WebAssembly:{},OffscreenCanvas:Canvas,__gltronObserver:{snapshot:()=>value},
    [task.BINDING]:()=>{throw Error('sink failure');}});
  vm.runInContext(nativeInstrumentation(),c);assert.equal(queries,0);new Canvas().getContext('webgl2');assert.equal(queries,0);
  assert.equal(gl.getShaderParameter(),value);assert.throws(()=>gl.getProgramParameter(),e=>e===error);assert.equal(queries,2);
  assert.equal(c.__gltronObserver.snapshot(),value);assert.equal(queries,2);
});

test('independent oracles have equal totals and different queue/body/delivery causes',()=>{
  const cases=[fixture({queue:3400}),fixture({body:3400}),fixture({delivery:3400})];
  assert(cases.every(x=>x.host.response-x.host.send===3402));
  assert.deepEqual(cases.map(x=>Object.values(x.expected)),[[0,3400,1,1],[0,1,3400,1],[0,1,1,3400]]);
  const queued=fixture({enqueue:21,queue:3400,native:{method:'getShaderParameter',entry:990,exit:4400}});
  assert.equal(queued.expected.helperMs,21);
  assert(queued.native.entry<queued.host.send&&queued.native.exit<=queued.worker.entry);
});

function protocolFixture(f){
  const q={kind:'helper-send',connectionId:'c',requestId:17,ordinal:1,sessionId:'s',targetId:'w',contextUniqueId:'unique',enqueueMs:f.host.enqueue,beforeSendMs:f.host.send,beforeSendEpochMs:10000+f.host.send,afterSendMs:f.host.send+0.1,exactSnapshot:true};
  const request={connectionId:'c',type:'request',sequence:1,id:17,sessionId:'s',targetId:'w',startedAt:10000+f.host.send,expression:{sha256:hash(prior.SNAPSHOT)}};
  const response={connectionId:'c',type:'response',sequence:10,id:17,sessionId:'s',targetId:'w',sessionMatches:true,expressionException:false,protocolErrorCode:null,resultType:'object',at:10000+f.host.response,elapsedMs:f.host.response-f.host.send,afterTerminal:f.host.response-f.host.send>=3000};
  const e=(phase,ms)=>({kind:'worker',connectionId:'c',sessionId:'s',targetId:'w',contextUniqueId:'unique',sample:{kind:'snapshot',seq:9,phase,ms,epochMs:10000+ms}});
  return {operations:[request,response],rows:[q,e('entry',f.worker.entry),e('body-entry',f.worker.bodyEntry),e('body-complete',f.worker.bodyExit),e('begin',f.worker.entry),e('end',f.worker.exit)]};
}
test('causal analyzer accepts the complete snapshot records emitted by the actual instrumentation',()=>{
  const d=candidate(),samples=[];let clock=1000;
  const c=vm.createContext({performance:{timeOrigin:10000,now:()=>++clock},WebAssembly:{},
    __gltronObserver:{snapshot:()=>({})},[task.BINDING]:s=>samples.push(d.metadata(JSON.parse(s)))});
  vm.runInContext(d.instrumentation(),c);c.__gltronObserver.snapshot();
  const p=protocolFixture(fixture({delivery:100})),identity=p.rows[1];
  p.rows=[p.rows[0],...samples.filter(v=>v.kind==='snapshot').map(sample=>({...identity,sample}))];
  const r=d.attribute(p.operations,p.rows)[0];
  assert.equal(r.bodyMs,1);assert.equal(r.nativeOccupiedMs,0);
  assert.equal(r.inspectorDispatchMs,null);
});
test('candidate causal analyzer agrees with independent equal-total interval oracles',()=>{
  const d=candidate();
  for(const f of [fixture({queue:3400}),fixture({body:3400}),fixture({delivery:3400}),fixture({enqueue:21})]){
    const p=protocolFixture(f),r=d.attribute(p.operations,p.rows)[0];
    assert.equal(r.helperMs,f.expected.helperMs);assert.equal(r.preEntryMs,f.expected.preEntryMs);
    assert.equal(r.bodyMs,f.expected.bodyMs);assert.equal(r.deliveryMs,f.expected.deliveryMs);
    assert.equal(r.inspectorDispatchMs,null);
  }
});
test('candidate refuses context replacement, overlapping/ambiguous requests, lost body and lifecycle invalidation',()=>{
  const d=candidate();
  for(const kind of ['context','overlap','ordinal','entry','body','lifecycle','response','overflow']){
    const p=protocolFixture(fixture({queue:3400}));
    if(kind==='context')p.rows[0].contextUniqueId='replaced';
    if(kind==='overlap')p.rows[0].overlap=true;
    if(kind==='ordinal')p.rows[0].ordinal=2;
    if(kind==='entry')p.rows.push(p.rows[1]);
    if(kind==='body')p.rows.splice(3,1);
    if(kind==='lifecycle')p.operations.push({type:'lifecycle',connectionId:'c',sequence:5,sessionId:'s',method:'Runtime.executionContextsCleared'});
    if(kind==='response')p.operations[1].sessionId='replaced';
    if(kind==='overflow')p.rows.push({...p.rows[1],sample:{kind:'limit',phase:'overflow'}});
    const r=d.attribute(p.operations,p.rows)[0];assert.equal(r.bodyMs,null,kind);assert.equal(r.preEntryMs,null,kind);
  }
});
test('candidate reports open native work without a response and measures returned same-context GL occupancy',()=>{
  const d=candidate(),p=protocolFixture(fixture({queue:3400}));
  const e=(phase,ms)=>({...p.rows[1],sample:{kind:'gl-getShaderParameter',phase,seq:2,ms,epochMs:10000+ms,nativeStartMs:995}});
  p.rows.push(e('begin',990));
  assert.equal(d.attribute(p.operations.slice(0,1),p.rows)[0].pendingNative[0].nativeDurationMs,null);
  p.rows.push(e('end',4400));const r=d.attribute(p.operations,p.rows)[0];
  assert.equal(r.nativeOccupiedMs,3400);assert.equal(r.nativeSpans[0].nativeDurationMs,3405);assert.equal(r.nativeSpans[0].entryEmissionMs,5);
  assert.equal(r.bodyMs,1);assert.equal(r.inspectorDispatchMs,null);
});
for(const kind of ['snapshot','native'])test(`candidate refuses reordered ${kind} records instead of reconstructing causal order`,()=>{
  const d=candidate();
    const p=protocolFixture(fixture({queue:3400}));
    if(kind==='snapshot'){
      [p.rows[2],p.rows[3]]=[p.rows[3],p.rows[2]];
    }else{
      const e=(phase,ms)=>({...p.rows[1],sample:{kind:'gl-getShaderParameter',phase,seq:20,ms,epochMs:10000+ms,nativeStartMs:995}});
      p.rows.push(e('end',4400),e('begin',990));
    }
    const r=d.attribute(p.operations,p.rows)[0];
    assert.equal(r.bodyMs,null,kind);assert.equal(r.nativeOccupiedMs,null,kind);
});
test('native occupancy uses interval union and rejects invalid pairs instead of inventing driver time',()=>{
  const d=candidate(),p=protocolFixture(fixture({queue:3400}));
  const span=(seq,start,end)=>[
    {...p.rows[1],sample:{kind:'gl-getShaderParameter',phase:'begin',seq,ms:start-5,epochMs:10000+start-5}},
    {...p.rows[1],sample:{kind:'gl-getShaderParameter',phase:'end',seq,ms:end,epochMs:10000+end,nativeStartMs:start}}
  ];
  p.rows.push(...span(20,995,2700),...span(21,2500,4400));
  const r=d.attribute(p.operations,p.rows)[0];
  assert.equal(r.nativeOccupiedMs,3400,'overlapping observed intervals are counted once');
  assert(r.nativeSpans[0].definitelyEnclosesSend);assert(!r.nativeSpans[1].definitelyEnclosesSend);
  for(const damage of ['duplicate','orphan','negative','clock']){
    const bad=structuredClone(p);
    if(damage==='duplicate')bad.rows.push(bad.rows.at(-1));
    if(damage==='orphan')bad.rows.splice(-2,1);
    if(damage==='negative')bad.rows.at(-1).sample.nativeStartMs=4401;
    if(damage==='clock')bad.rows.at(-1).sample.epochMs+=4;
    const result=d.attribute(bad.operations,bad.rows)[0];assert.equal(result.nativeOccupiedMs,null,damage);
    assert.equal(result.bodyMs,null,damage);
  }
});
test('composed current helper keeps exact snapshot expression, verified source inventory and fixed policy',()=>{
  const d=candidate(),source=fs.readFileSync('tools/quake3-browser-controller.cjs','utf8'),s=d.compose(source);
  new vm.Script(s);
  for(const phrase of [prior.SNAPSHOT,'sourceInventory.noteEvaluation','sourceInventory.inspect','3000','5000','30000','1750','_validateCurrentDisplayCapture','irreversible 180 second gameplay cutoff'])assert(s.includes(phrase),phrase);
  assert.throws(()=>d.compose(source.replace("c=connection(url);await c.ready;",'c=null;')),/anchor/);
  const q=d.qualificationSource(fs.readFileSync('test/quake3-browser-controller.test.cjs','utf8'));new vm.Script(q);
  const original=d.visibility().original.toString();
  for(const phrase of ['assertPublicQualification(pins)','assertCausalQualification(pins)','original cannot replay','fixed 1800/1820 transaction','materiallyChangedCausalDiagnostics:true'])assert(original.includes(phrase),phrase);
});
test('passive helper stages preserve exact wire bytes and broken evidence sink cannot send or reopen',async()=>{
  const d=candidate(),saved=globalThis.WebSocket,wire=[],operations=[];
  class Socket extends EventTarget {
    constructor(){super();queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
    set onopen(fn){if(this.open)this.removeEventListener('open',this.open);this.open=fn;if(fn)this.addEventListener('open',fn);}
    set onmessage(fn){if(this.message)this.removeEventListener('message',this.message);this.message=fn;if(fn)this.addEventListener('message',fn);}
    get onmessage(){return this.message;}
    send(data){wire.push(data);const v=JSON.parse(data);queueMicrotask(()=>this.receive({id:v.id,sessionId:v.sessionId,result:{result:{type:'object',value:{}}}}));}
    receive(v){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(v)}));}
    close(){this.dispatchEvent(new Event('close'));}
  }
  globalThis.WebSocket=Socket;let c;
  try{
    const observer=require('../tools/quake3-startup-observer.cjs').createObserver({emit:v=>operations.push(v)});
    c=d.connection('ws://offline.invalid','scratch/runs/20261115-quake3-native-snapshot-latency/absent-sink',observer);await c.ready;
    c.ws.receive({method:'Target.attachedToTarget',params:{sessionId:'s',targetInfo:{targetId:'w',type:'worker'}}});
    c.ws.receive({method:'Runtime.executionContextCreated',sessionId:'s',params:{context:{id:1,uniqueId:'unique'}}});
    await c.send('Runtime.evaluate',{expression:prior.SNAPSHOT,returnByValue:true},'s');
    assert.deepEqual(wire,[JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:prior.SNAPSHOT,returnByValue:true},sessionId:'s'})]);
    const q=c.latencyRows.find(v=>v.kind==='helper-send'),r=c.latencyRows.find(v=>v.kind==='wire-response');
    assert.equal(q.contextUniqueId,'unique');assert.equal(q.targetId,'w');assert.equal(q.ordinal,1);assert.equal(q.overlap,false);
    assert(q.enqueueMs<=q.beforeSendMs&&q.beforeSendMs<=q.afterSendMs);
    assert(r.receivedMs<=operations.find(v=>v.type==='response').monotonicMs,'ingress measured before helper dispatch');
    c.abort(Error('UNKNOWN fixture closed'));await assert.rejects(c.send('Runtime.evaluate',{expression:prior.SNAPSHOT},'s'),/UNKNOWN/);assert.equal(wire.length,1);
    c.ws.close();c=d.connection('ws://offline.invalid','scratch/runs/20261115-quake3-native-snapshot-latency/absent-sink',observer);await c.ready;
    c.ws.receive({method:'Target.attachedToTarget',params:{sessionId:'s',targetInfo:{targetId:'w',type:'worker'}}});
    c.ws.receive({method:'Runtime.executionContextCreated',sessionId:'s',params:{context:{id:1,uniqueId:'unique'}}});
    const handle=c.ws.onmessage;c.ws.onmessage=function(event){setTimeout(()=>handle.call(this,event),20);};
    const first=c.send('Runtime.evaluate',{expression:prior.SNAPSHOT},'s');
    await new Promise(r=>setImmediate(r));assert(c.latencyRows.some(r=>r.kind==='wire-response'));
    const second=c.send('Runtime.evaluate',{expression:prior.SNAPSHOT},'s');
    const sent=c.latencyRows.filter(r=>r.kind==='helper-send');assert.equal(sent[1].overlap,true);
    assert.equal(sent[1].correlationUnsafe,true,'raw arrival does not complete helper handling');
    await Promise.all([first,second]);
  }finally{c?.ws.close();globalThis.WebSocket=saved;}
});

test('retained 808 has no measured body or native occupancy; late receipt stays terminal',()=>{
  const file='scratch/runs/20261115-quake3-source-inventory/original/operations.jsonl';
  if(!fs.existsSync(file))return;
  const bytes=fs.readFileSync(file);
  assert.equal(hash(bytes),'054638201db54bd9bd09128bbe0666295a51f1ed7871ebc1417939a12389462d');
  const rows=bytes.toString().trim().split('\n').map(JSON.parse),r=prior.historical(rows,808);
  assert.equal(r.request.expression.sha256,hash(prior.SNAPSHOT));
  assert.equal(r.request.deadlineMs,3000);assert.equal(r.requestsAfterTerminal,0);
  assert(Math.abs(r.elapsedFromSendMs-3605.703374)<1e-6);
  assert.equal(r.queueMs,null);assert.equal(r.bodyMs,null);assert.equal(r.attribution,'unproved');
  assert(r.response.afterTerminal);assert.equal(r.response.sessionId,'BDEFD4E4853FC05D978F3EC0E6786BB7');
});

test('current snapshot body is counter/maps/dimensions only; no direct synchronous GL query',()=>{
  const source=fs.readFileSync('tools/quake3-browser-controller.cjs','utf8');
  const start=source.indexOf('globalThis.__gltronObserver={snapshot:()=>'),end=source.indexOf('\n return true;',start);
  assert(start>0&&end>start);const body=source.slice(start,end);
  assert(!/getShaderParameter|getProgramParameter|getParameter|readPixels|finish\(|flush\(/.test(body));
  assert(body.includes('contexts.map')&&body.includes('currentByOwner')&&body.includes('canvas.width'));
});

module.exports={fixture,nativeInstrumentation,nativeMetadata};
