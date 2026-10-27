'use strict';
// Source-only acceptance: exact production bytes; no module or guest initialization.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const repo=process.cwd(), ops=__dirname;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(path.join(repo,'test/run.js'),'utf8');
assert.equal(hash(source),'f81747fefe987ff85bbe1e34d37d7ba86649e0930a788c401a534331f99208c4');
const {createInputConsumptionTrace}=require(path.join(repo,'test/input-consumption-trace'));
const {inputEventHwnd}=require(path.join(repo,'lib/host-window'));
assert(source.includes("const { createInputConsumptionTrace } = require('./input-consumption-trace');"));
const excerpts=[];
function part(s,a,b,label){const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i,label);const text=s.slice(i,j);excerpts.push({label,startByte:Buffer.byteLength(s.slice(0,i)),endByte:Buffer.byteLength(s.slice(0,j)),bytes:Buffer.byteLength(text),sha256:hash(text)});return text;}
const init=part(source,'  const inputConsumptionTrace =','  // Every OTHER import table','init');
const input=part(source,'  let lastInputEvent = null;','  let lastMouseTracePos =','host-input');
const control=part(source,'  const controlSafeValue =','  const control = (CONTROL || CONTROL_STDIN)','request-handler');
const hasFlag=part(source,'const hasFlag =','// Was `--name=','flag-parser');
const flag=part(source,"const TRACE_INPUT_DISPATCH = hasFlag('trace-input-dispatch');",'\n','flag-declaration');
const startup=JSON.parse(fs.readFileSync(path.join(ops,'node-startup-fixed.stdout')));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>k!=='PALETTE_BROWSER_SUPERVISED').sort(([a],[b])=>a.localeCompare(b)));
assert.equal(hash(JSON.stringify(env)),startup.environmentSHA256);
assert.equal(process.execPath,startup.node);assert.deepEqual(process.execArgv,startup.flags);
assert.equal(fs.readFileSync('/proc/self/limits','utf8'),startup.limits);
const responses=[],controls=[];
function fixture({enabled=true,code=control, factory=createInputConsumptionTrace}={}){
 const calls={ticks:0,publish:0,guest:0,poll:0,scheduler:0,worker:0};
 const forbidden=k=>(()=>{calls[k]++;throw Error('FORBIDDEN '+k);});
 const e={get_eip:()=>0x55995b,get_yield_reason:()=>1,get_wait_handle:()=>0xe0005,get_wait_timeout:()=>100,get_focus_hwnd:()=>0x10001,get_main_hwnd:()=>0x10001,run:forbidden('guest'),post_message_q:forbidden('guest'),get_sleep_yielded:forbidden('guest')};
 const renderer={windows:{},canvas:{width:800,height:600},inputQueue:[],_physicalKeys:{32:false},_asyncKeys:{32:true},_asyncPressedKeys:{32:true},checkInput:forbidden('poll'),getAsyncKeyState:forbidden('poll')};
 const c=vm.createContext({Map,createInputConsumptionTrace:factory,inputEventHwnd,logs:[],h:{},args:enabled?['--trace-input-dispatch']:[],renderer,instance:{exports:e},threadManager:{backend:'cooperative',threads:new Map(),_mainThreadState:{state:'active',suspendCount:0},_mainSleepUntil:150,runSlice:forbidden('scheduler'),pollMainWait:forbidden('scheduler')},inputEvent:null,crossThreadMsgs:[],inputQueue:[],installingFiles:false,scheduledInput:[],tickState:{batch:5003},controlFrozen:true,controlRunCredits:0,videoRecorder:null,batchClock:{getTickMsPerBatch:()=>5},guestClock:{ticks:forbidden('ticks'),publish:()=>{calls.publish++;return 15;}},TRACE_API:false,TRACE_API_PAUSED:false,liveOutstanding:new Map(),parseInputEntries:()=>[{action:'keydown',wParam:32,batch:5003}],Date:{now:forbidden('scheduler')}});
 vm.runInContext(hasFlag+flag+'\n'+init+input+code,c);
 const send=q=>{c.request=q;const result=vm.runInContext('handleControlCommand(request)',c);const clean=JSON.parse(JSON.stringify(result));responses.push({request:q,response:clean});return clean;};
 const state=()=>JSON.stringify({renderer:c.renderer,scheduled:c.scheduledInput,pending:c.inputEvent,cross:c.crossThreadMsgs,buttons:c.inputQueue,threads:c.threadManager&&[...c.threadManager.threads],main:c.threadManager&&c.threadManager._mainThreadState,sleep:c.threadManager&&c.threadManager._mainSleepUntil,batch:c.tickState,frozen:c.controlFrozen,credits:c.controlRunCredits,logs:c.logs,calls});
 return {c,e,renderer,calls,send,state,trace:vm.runInContext('inputConsumptionTrace',c)};
}
const request={action:'input-state',id:'independent-5003-A'};
function rejectControl(name,f){f();controls.push(name);console.log('PASS rejecting control '+name);}
// Controls are first behavioral work at production request dispatch.
if(process.argv.includes('--controls-only')) {
const base=fs.readFileSync(path.join(ops,'base-runner.stdout'),'utf8');
const oldControl=part(base,'  const controlSafeValue =','  const control = (CONTROL || CONTROL_STDIN)','base-request-handler');
rejectControl('exact-base-omits-observer',()=>{const f=fixture({code:oldControl});assert.throws(()=>f.send(request));assert(!('queues' in f.send({action:'snapshot',id:'base'})));});
const detached=control.replace("if (cmd.action === 'input-state')","if (cmd.action === 'detached-input-state')");assert.notEqual(detached,control);
rejectControl('detached-production-handler',()=>assert.throws(()=>fixture({code:detached}).send(request)));
const probing=control.replace('() => ({ scheduledInput','() => (guestClock.ticks(), { scheduledInput');assert.notEqual(probing,control);
rejectControl('clock-probe',()=>assert.throws(()=>fixture({code:probing}).send(request),/FORBIDDEN ticks/));
const draining=control.replace('() => ({ scheduledInput,','() => ({ scheduledInput: scheduledInput.splice(0),');assert.notEqual(draining,control);
rejectControl('queue-drain',()=>{const f=fixture({code:draining});f.c.scheduledInput.push({batch:5003});const before=f.state();f.send(request);assert.notEqual(f.state(),before);});
if(process.argv.includes('--controls-only')){
 fs.writeFileSync(path.join(ops,'controls-receipt.json'),JSON.stringify({candidate:'229f420238644feb368d8b2cc4975a790af0534a',excerpts,controls,stubs:'Guest instance exports are scalar-returning JS stubs; run/post_message_q/clock/poll/scheduler throw. Real helper, inputEventHwnd, production CLI parser/init/input/request handler. No guest initializer/module invoked.'},null,2)+'\n');
 process.exit(0);
}
}
if(process.argv.includes('--validation')) {
 const completed=[];
 try {
  const on=fixture(),off=fixture({enabled:false});
  assert.deepEqual(off.send({action:'snapshot',id:'legacy'}),on.send({action:'snapshot',id:'legacy'}));
  assert.throws(()=>off.send(request),/needs --trace-input-dispatch/);
  assert.equal(off.calls.publish,0);assert.equal(off.calls.ticks,0);assert.equal(off.c.logs.length,0);
  completed.push('actual CLI parser/default disabled/legacy snapshot equivalence');
  const before=on.state();const a=on.send(request),b=on.send({...request,id:'independent-5003-B'});
  assert.equal(a.requestId,request.id);assert.equal(a.batch,5003);
  assert.deepEqual({...a,requestId:b.requestId},b);assert.equal(on.state(),before);
  assert.deepEqual(on.calls,{ticks:0,publish:0,guest:0,poll:0,scheduler:0,worker:0});
  completed.push('real handler valid read, current request IDs/batch, repeat stability and zero work');
  for(const [frozen,credits] of [[false,0],[1,0],[true,1],[true,-1],[true,NaN],[true,Infinity],[true,'0'],[true,null],[true,undefined]]) {
   on.c.controlFrozen=frozen;on.c.controlRunCredits=credits;
   assert.throws(()=>on.send(request),/frozen mode with zero credits/);
  }
  on.c.controlFrozen=true;on.c.controlRunCredits=0;
  completed.push('strict frozen true and numeric zero-credit gating');
  for(const id of ['',3,'x'.repeat(129),'x y','x\ny','\t','é'])
   assert.throws(()=>on.send({action:'input-state',id}),/printable id/);
  assert.throws(()=>on.send({...request,n:1}),/needs only/);
  completed.push('ordinary invalid IDs/extra fields rejected');
  const malformed={action:'input-state',id:'printable-prefix\n'};
  const state=on.state();let observed,thrown;
  try { observed=on.send(malformed); } catch(e) {thrown=e.message;}
  fs.writeFileSync(path.join(ops,'malformed-id-actual.json'),JSON.stringify({request:malformed,requestIdBytes:[...Buffer.from(malformed.id)],response:observed??null,error:thrown??null,stateUnchanged:on.state()===state,calls:on.calls},null,2)+'\n');
  console.log('Actual production response to terminal-LF ID: '+JSON.stringify(observed));
  assert(thrown,'REJECT candidate: production input-state accepts a non-printable terminal LF in request ID');
  completed.push('terminal LF rejected');
 } finally {
  fs.writeFileSync(path.join(ops,'validation-checkpoint.json'),JSON.stringify({candidate:'229f420238644feb368d8b2cc4975a790af0534a',completed,excerpts,responses,remaining:'On correctness rejection, stop all broader acceptance and publish smallest production-boundary reproducer. No candidate repair.'},null,2)+'\n');
 }
} else if(process.argv.includes('--remaining')) {
 const completed=process.argv.includes('--resume-bounds')?JSON.parse(fs.readFileSync(path.join(ops,'remaining-thread-passing-checkpoint.json'))).completed:process.argv.includes('--resume-thread')?JSON.parse(fs.readFileSync(path.join(ops,'remaining-fixture-failure-checkpoint.json'))).completed:[];
 const stable=(f,id='stable')=>{const before=f.state();const callBefore=JSON.stringify(f.calls);const a=f.send({action:'input-state',id}),b=f.send({action:'input-state',id});assert.deepEqual(a,b);assert.equal(f.state(),before);assert.equal(JSON.stringify(f.calls),callBefore);return a;};
 try {
  const f=fixture();
  let s;
  const evt=Object.freeze({action:'keydown',batch:5003,hwnd:0,msg:0x100,wParam:32,lParam:0});
  if(!process.argv.includes('--resume-thread')) {
  // Frozen queue objects make accidental writes throw. These are host JS queues.
  for(const name of ['scheduledInput','crossThreadMsgs','inputQueue']) f.c[name]=Object.freeze([evt]);
  f.renderer.inputQueue=Object.freeze([evt]); f.c.inputEvent=evt;
  s=stable(f);
  for(const q of ['scheduled','pending','crossThread','buttons','renderer'])assert.equal(s.queues[q].count,1);
  assert.equal(s.queues.guestPostQueue,'unknown');assert.equal(s.sdlConsumption,'unknown');
  assert.equal(s.threads.main.sleepActive,'unknown');
  assert.deepEqual(s.counters,{scheduled:0,enqueued:0,dequeued:0,routed:0,dispatched:0});
  completed.push('five frozen populated queues: zero mutation, execution, poll, clock probes, log writes');
  for(const name of ['scheduledInput','crossThreadMsgs','inputQueue'])f.c[name]=[];
  f.c.inputEvent=null;f.renderer.inputQueue=[];
  const ack=f.send({id:'enqueue-ack',cmd:'keydown:32'});
  assert.equal(ack.queued,true);assert.equal(ack.batch,5003);
  assert.equal(stable(f).counters.enqueued,0);assert.equal(stable(f).queues.scheduled.count,1);
  // Run byte-exact production renderer/pending enqueue branches. Adapter only
  // supplies the enclosing loop and previous branch; no guest actions run.
  const enqueue=part(source,'      } else if (renderer) {\n        renderer.inputQueue.push(inputConsumptionTrace.enqueue(','\n    if (control) settleLiveInput();','enqueue-branches');
  const wrapped='for (const ev of injected) { if (false) {'+enqueue;
  f.c.batch=5003; f.c.injected=[{batch:5003,msg:0x100,wParam:32,lParam:0}];
  vm.runInContext(wrapped,f.c);
  s=stable(f); assert.equal(s.counters.enqueued,1);assert.equal(s.counters.dequeued,0);
  f.renderer.checkInput=()=>f.renderer.inputQueue.shift();
  assert.equal(f.c.h.check_input(),(32<<16)|0x100);
  s=stable(f);assert.equal(s.counters.dequeued,1);assert.equal(s.last.dequeue.source,'renderer');assert.equal(s.last.dequeue.enqueueId,1);assert.equal(s.counters.routed,0);
  assert.equal(f.c.h.check_input_hwnd(0x10001),0x10001);
  s=stable(f);assert.equal(s.counters.routed,1);assert.equal(s.counters.dispatched,0);
  assert.equal(s.last.route.dequeueId,s.last.dequeue.id);
  const dispatch=part(source,"    if (TRACE_INPUT_DISPATCH && (t === 'DispatchMessageA'",'    for (const spec of TRACE_API_MEM)','dispatch-hook');
  f.c.memory={buffer:new ArrayBuffer(128)}; const dv=new DataView(f.c.memory.buffer);
  dv.setUint32(4,32,true);[0x10001,0x100,32,0].forEach((v,i)=>dv.setUint32(32+i*4,v,true));
  f.e.get_esp=()=>0;f.e.get_image_base=()=>0;f.c.translateGuest=n=>n;f.c.t='DispatchMessageA';
  vm.runInContext(dispatch,f.c);
  s=stable(f);assert.equal(s.counters.dispatched,1);assert.equal(s.last.dispatch.correlation,'unavailable');assert.equal(s.sdlConsumption,'unknown');
  // Pending/cross-thread/button queues also go through the real polling hook.
  f.c.renderer=null;vm.runInContext(wrapped,f.c);
  assert.equal(stable(f).queues.pending.count,1);f.c.h.check_input();
  assert.equal(stable(f).last.dequeue.source,'pending');
  f.c.crossThreadMsgs.push({...evt});f.c.h.check_input();assert.equal(stable(f).last.dequeue.source,'cross-thread');
  f.c.inputQueue.push(123);f.c.installingFiles=true;assert.equal(f.c.h.check_input(),0);assert.equal(stable(f).queues.buttons.count,1);
  f.c.installingFiles=false;f.c.h.check_input();assert.equal(stable(f).last.dequeue.source,'button-queue');
  const counts=stable(f).counters;assert.equal(f.c.h.check_input(),0);assert.deepEqual(stable(f).counters,counts);
  completed.push('actual enqueue/ACK, renderer/pending/cross-thread/button dequeue, route and DispatchMessage distinguish stages; SDL unknown');
  }
  if(!process.argv.includes('--resume-bounds')) {
  // Cooperative exports are safe getters; property and function failures unknown.
  Object.defineProperty(f.e,'get_wait_handle',{configurable:true,get(){throw Error('absent export getter');}});
  f.e.get_wait_timeout=()=>{throw Error('export call throws');};delete f.e.get_yield_reason;
  s=stable(f);for(const k of ['yieldReason','waitHandle','waitTimeout'])assert.equal(s.threads.main[k],'unknown');
  f.c.threadManager.threads=new Map([[9,{tid:9,state:'active',suspendCount:0,sleepUntil:200,instance:{exports:{get_eip:()=>99,get_yield_reason:()=>1,get_wait_handle:()=>8,get_wait_timeout:()=>15}}}]]);
  assert.equal(stable(f).threads.head[0].eip,99);
  // Worker-owned exports must not be examined, even when a stale instance exists.
  f.c.threadManager.backend='worker';
  f.c.threadManager.threads=new Map([[10,{tid:10,link:{callExport:()=>{throw Error('worker round trip');}},state:'active',suspendCount:0,sleepUntil:200,instance:new Proxy({}, {get(_target,key){if(key==='exports'){f.calls.worker++;throw Error('worker instance read');}return undefined;}})}]]);
  s=stable(f);for(const k of ['eip','yieldReason','waitHandle','waitTimeout'])assert.equal(s.threads.head[0][k],'unknown');assert.equal(f.calls.worker,0);
  f.c.threadManager=null;f.c.renderer=null;s=stable(f);
  assert.equal(s.threads.count,'unknown');assert.equal(s.keys[32]._physicalKeys,'unknown');assert.equal(s.queues.renderer.count,'unknown');
  completed.push('unavailable/throwing exports unknown; worker exports untouched, host scheduler metadata only; absent renderer/maps unknown');
  }
  // Bound count/head/string sizes and detach response objects from source state.
  const bounded=fixture();const hostile='\u0000'.repeat(4096);
  const item=Object.fromEntries(['action','batch','hwnd','msg','wParam','lParam'].map(k=>[k,hostile]));
  for(const name of ['scheduledInput','crossThreadMsgs','inputQueue'])bounded.c[name]=Array(1000).fill(item);
  bounded.renderer.inputQueue=Array(1000).fill(item);bounded.c.inputEvent=item;
  bounded.c.threadManager.threads=new Map(Array.from({length:32},(_,i)=>[i,{tid:hostile,state:hostile,suspendCount:0,sleepUntil:0,link:{}}]));
  s=bounded.send(request);for(const q of ['scheduled','crossThread','buttons','renderer']) {assert.equal(s.queues[q].count,1000);assert.equal(s.queues[q].head.length,16);assert.equal(s.queues[q].truncated,true);}
  assert.equal(s.threads.count,32);assert.equal(s.threads.head.length,16);assert.equal(s.threads.truncated,true);
  assert.equal(s.queues.scheduled.head[0].action.length,64);assert.equal(s.threads.head[0].tid.length,64);
  const bytes=Buffer.byteLength(JSON.stringify(s));assert(bytes<256*1024);
  s.queues.scheduled.head[0].action='modified';assert.equal(bounded.send(request).queues.scheduled.head[0].action.length,64);
  completed.push('queue/thread heads16, strings64, hostile JSON response '+bytes+' bytes, detached responses');
  // Counter cap is a dependency injection for finite saturation, not CLI wiring.
  const cap=fixture({factory:opts=>createInputConsumptionTrace({...opts,counterLimit:2,limit:2})});
  const trace=cap.trace;
  for(let i=0;i<20;i++){trace.schedule({batch:5003});trace.enqueue(evt,{batch:5003});trace.dequeue(evt,'pending');trace.route(1,1);trace.dispatch('DispatchMessageA',1,0x100,32,0);}
  s=stable(cap);assert.deepEqual(s.counters,{scheduled:2,enqueued:2,dequeued:2,routed:2,dispatched:2});assert.equal(s.saturated,true);assert.equal(s.last.dequeue.id,'unavailable');assert.equal(s.last.dequeue.enqueueId,'unavailable');assert.equal(cap.c.logs.length,3);
  const off=fixture({enabled:false});for(const [fn,args] of [['schedule',[{batch:1}]],['enqueue',[evt,{batch:1}]],['dequeue',[evt,'renderer']],['route',[1,1]],['dispatch',['DispatchMessageA',1,0x100,32,0]]])off.trace[fn](...args);
  assert.equal(off.c.logs.length,0);assert.equal(off.calls.publish,0);assert.equal(off.calls.ticks,0);
  completed.push('saturating counters/IDs independent of textual log cap; disabled hooks produce no clock/log output');
 } finally {
  fs.writeFileSync(path.join(ops,'remaining-checkpoint.json'),JSON.stringify({candidate:'229f420238644feb368d8b2cc4975a790af0534a',completed,excerpts,responses,remaining:['integration on reconciled current main','fresh independently admitted runtime assignment'],qualification:'JS guest getters/MSG ArrayBuffer and worker links are stubs; no module instantiation, compiler, browser or guest; real production hook bytes/helper/host routing'},null,2)+'\n');
 }
 console.log('PASS '+completed.join('\nPASS '));
}
else if(process.argv.includes('--edges')) {
 const f=fixture(),completed=[];
 const before=f.state();
 for(const q of [null,[],true,17,'',{}, {id:'x'}, {action:'INPUT-STATE',id:'x'}, {action:'input-state'}, {action:'input-state',id:false}, {action:'input-state',id:'x',cmd:'step 1'}, JSON.parse('{"action":"input-state","id":"x","__proto__":{}}'), {action:'input-state',id:'x\r'}, {action:'input-state',id:'x\u2028'}, {action:'input-state',id:'\u007f'}]) assert.throws(()=>f.send(q));
 assert.equal(f.state(),before);
 const valid=f.send({action:'input-state',id:'!'.repeat(128)});
 assert.equal(valid.requestId.length,128);
 assert.deepEqual(Object.keys(valid).sort(),['requestId','batch','frozen','credits','counters','counterLimit','saturated','last','queues','keys','threads','sdlConsumption'].sort());
 assert.deepEqual(Object.keys(valid.counters).sort(),['scheduled','enqueued','dequeued','routed','dispatched']);
 f.c.tickState.batch=6004;const current=f.send({action:'input-state',id:'new-batch'});
 assert.equal(current.batch,6004);assert.equal(current.requestId,'new-batch');assert.equal(valid.batch,5003);
 f.c.inputEvent={msg:0x100,wParam:32,lParam:0,hwnd:0};f.c.h.check_input();
 const observed=f.send(request);assert.equal(observed.last.dequeue.enqueueId,'unavailable');
 observed.last.dequeue.id=-1;observed.counters.dequeued=-1;
 const clean=f.send(request);assert.equal(clean.last.dequeue.id,1);assert.equal(clean.counters.dequeued,1);
 const inputCalls=JSON.stringify(f.calls);
 f.c.instance.exports=null;const missing=f.send(request);
 for(const k of ['eip','yieldReason','waitHandle','waitTimeout'])assert.equal(missing.threads.main[k],'unknown');
 assert.equal(JSON.stringify(f.calls),inputCalls);
 completed.push('malformed primitive/array/action/ID/extra/prototype-field requests rejected without work');
 completed.push('128 printable characters accepted; exact response/counter shape; request IDs and batch fresh');
 completed.push('counter/last responses detached; unknown enqueue provenance; absent instance exports unknown');
 fs.writeFileSync(path.join(ops,'edges-checkpoint.json'),JSON.stringify({candidate:'229f420238644feb368d8b2cc4975a790af0534a',completed,excerpts,responses},null,2)+'\n');
 console.log('PASS '+completed.join('\nPASS '));
}
 else throw Error('Select explicit group; no unchanged control rerun');
