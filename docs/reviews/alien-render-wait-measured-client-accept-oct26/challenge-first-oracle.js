'use strict';
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto'),path=require('path');
const base='/tmp/alien-render-wait-measured-client-accept-oct26',src=base+'/source';
const read=p=>fs.readFileSync(p,'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const runner=read(src+'/test/run.js'),bridgeSource=read(src+'/lib/d3d9-host.js'),imports=read(src+'/lib/host-imports.js');
function cut(s,a,b){assert.equal(s.split(a).length,2,a);let i=s.indexOf(a),j=s.indexOf(b,i);assert(j>i,b);return s.slice(i,j);}
const pieces={hooks:cut(runner,'  const renderWaitAttribution = createRenderWaitAttribution();','  let lastSchedSig = null;'),
 result:cut(bridgeSource,'    _result(entry, value,','    _poll(token)'),
 issue:cut(bridgeSource,'    _issue(entry, opcode,','    // Present is pipelined'),
 wait:cut(bridgeSource,'    wait(token) {','    _presentBoundary(entry)'),
 wrapper:cut(imports,'  ctx.waitD3DRender = token => {','  ctx.closeD3DRender ='),
 terminal:cut(runner,"  renderWaitAttribution.close(deadlineMs && Date.now() > deadlineMs ? 'deadline' : 'stopped');",'  if (PRESENT_CAP &&'),
 dispatch:cut(runner,'      await awaitMainRenderPark();','    } catch (e) {\n      flushLogs();\n      console.log(`\\n*** CRASH at batch')};
const baseline=JSON.parse(read(src+'/test/fixtures/render-park-control.json'));
const original=read('/tmp/civ2-win16-ordinary-gameplay-oct26/source/test/run.js');
assert.equal(sha(original),baseline.runnerSHA256);
assert.equal(cut(original,'  let mainRenderWait = null;','  let lastSchedSig = null;'),baseline.hooks);
const originalBridge=read('/tmp/civ2-win16-ordinary-gameplay-oct26/source/lib/d3d9-host.js');
const originalImports=read('/tmp/civ2-win16-ordinary-gameplay-oct26/source/lib/host-imports.js');
assert.equal(imports,originalImports);
// Byte equality outside the exact hook replacements covers DLL initializers,
// guest clock, batch accounting, exception handlers, and pre-main execution.
let uninstrumented=runner.replace("const { createRenderWaitAttribution } = require('../lib/render-wait-attribution');\n",'').replace(pieces.hooks,baseline.hooks).replace(pieces.terminal,'');
assert.equal(uninstrumented,original);
const {createRenderWaitAttribution}=require(src+'/lib/render-wait-attribution');
const micro=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function make({old=false,mutate=x=>x,disabled=false,bridgeMutate=x=>x}={}){
 const clock={t:0},timers=[],trace=[],requests=[];let token=-2,yr=16;
 const date={now:()=>clock.t};
 const bs=old?originalBridge:bridgeSource;
 const methods=cut(bs,'    _result(entry, value,','    _poll(token)')+cut(bs,'    _issue(entry, opcode,','    // Present is pipelined')+cut(bs,'    wait(token) {','    _presentBoundary(entry)');
 const Bridge=vm.runInNewContext(`class B {constructor(){this.requests=new Map();this.nextRequest=-2;this.closed=false;}
 ${bridgeMutate(methods)}
 _deferrable(){return false;} _submit(){return this.value;}}; B`,{Date:date,Stream:{OPCODES:{DRAW:17,CLEAR:19}}});
 const bridge=new Bridge(),ctx={d3d9Bridge:bridge},tickState={batch:7,pausedMs:0};
 const instance={exports:{get_yield_reason:()=>yr,get_d3d_render_token:()=>token,clear_yield:()=>{yr=0;trace.push('clear');},run:n=>{trace.push(['run',n]);return 123;}}};
 const threadManager={isMainNamedEventWaiting:()=>false,_renderSendTargets:new Set(),noteMainSleep:()=>trace.push('sleepCheck'),isMainSleeping:()=>false,isMainThreadSuspended:()=>false};
 const s={ctx,instance,threadManager,tickState,Date:date,Promise,createRenderWaitAttribution,_d3d9Bridge:bridge,REAL_TICK_SLEEPS:true,
 hasFlag:n=>disabled&&n==='no-render-park-wait',setTimeout:(fn,ms)=>{timers.push({fn,ms});trace.push(['timer',ms]);},console:{log:x=>{},error:()=>trace.push('error')},flushLogs:()=>trace.push('flush'),BATCH_SIZE:123};
 vm.createContext(s);vm.runInContext(`let stopped=false,deadlineMs=0;${pieces.wrapper}${mutate(old?baseline.hooks:pieces.hooks)}
 globalThis.api={check:mainExecutionSuspended,park:awaitMainRenderPark,dispatch:async()=>{${pieces.dispatch}},wait:()=>mainRenderWait,
 stop:()=>stopped=true,deadline:n=>deadlineMs=n,terminal:()=>{${old?'':pieces.terminal}},stats:renderParkStats};`,s);
 return {...s.api,clock,ctx,bridge,timers,trace,tickState,instance,
 token:n=>{token=n;yr=16;},request:(op='DRAW',immediate=false)=>{
 let resolve,reject;const promise=immediate?42:new Promise((a,b)=>{resolve=a;reject=b;});bridge.value=promise;
 const entry={queue:{generation:2}};const id=op==='DRAW'?bridge._issue(entry,17,{},x=>x):bridge._result(entry,promise,x=>x,false,op);
 token=id;yr=16;const r={id,resolve,reject,record:bridge.requests.get(id)};requests.push(r);return r;},
 fire:async(t)=>{clock.t=t;const q=timers.shift();assert.equal(q.ms,100);q.fn();await micro();}};
}
function conservation(s){assert.equal(s.parkMs,s.bridgePendingMs+s.readyToResumeMs+s.unknownMs);assert.equal(s.requests,s.pending+s.completed+s.rejected+s.deadline+s.stopped+s.superseded);assert.equal(s.requests-s.pending,s.latencyBuckets.reduce((a,b)=>a+b,0));assert.equal(s.slowest.reduce((a,b)=>a+b.parkMs,0)+s.droppedMs,s.parkMs);}
function checkpoint(group,data,remaining){let p=base+'/ops/checkpoint.json';let old=fs.existsSync(p)?JSON.parse(read(p)):{candidate:'864733e0ca72eaac61d4de1aaad8d080362ea63e',completed:[],extractions:Object.fromEntries(Object.entries(pieces).map(([k,v])=>[k,{bytes:Buffer.byteLength(v),sha256:sha(v)}]))};old.completed.push({group,data});old.remaining=remaining;fs.writeFileSync(p+'.tmp',JSON.stringify(old,null,2)+'\n');fs.renameSync(p+'.tmp',p);}
async function boundary(mutate=x=>x,bridgeMutate=x=>x){
 const h=make({mutate,bridgeMutate}),r=h.request();assert(h.check());let w=h.wait();assert(h.check());assert.equal(h.wait(),w);
 const p=h.dispatch();await micro();assert.equal(h.ctx.renderWaitAttribution.pending,1);assert(!h.trace.some(x=>Array.isArray(x)&&x[0]==='run'));
 h.clock.t=23;r.resolve(55);r.record.ready.then(()=>{assert.equal(h.ctx.renderWaitAttribution.completed,0);h.clock.t=41;});await p;
 const s=h.ctx.renderWaitAttribution;assert.equal(r.record.renderWaitReadyAt,23);assert.equal(s.completed,1);assert.equal(s.parkMs,41);assert.equal(s.bridgePendingMs,23);assert.equal(s.readyToResumeMs,18);
 assert.equal(s.slowest[0].operation,'DRAW');assert.equal(h.stats.waits,1);assert.equal(h.stats.wallMs,41);assert.equal(h.stats.skippedBatches,0);assert.deepEqual(h.trace.filter(x=>Array.isArray(x)&&x[0]==='run'),[['run',123]]);
 h.clock.t=90;h.instance.exports.run(123);assert.equal(s.readyToResumeMs,18);conservation(s);return s;
}
async function main(){
 if(!process.argv.includes('--remaining')){const s=await boundary();checkpoint('production-boundary-first',s,['schedule matrix','counterexamples','negative controls','baseline noninterference']);console.log('PASS exact CLI suspend/await/dispatch + bridge _issue/_result/wait + host wrapper; readiness23 resume41 excludes subsequent guest time');}
 if(process.argv.includes('--boundary-only'))return;
 // Independent timeout schedule includes equality with deadline, followed by
 // expiry, stop before deadline, and terminal-only actual deadline detection.
 for(const mode of ['deadline','stop','terminal-stop','terminal-deadline']){
  const h=make(),r=h.request();h.deadline(100);
  if(mode.startsWith('terminal')){h.check();await micro();h.clock.t=mode==='terminal-stop'?99:101;h.terminal();}
  else {const p=h.park();await micro();await h.fire(100);assert.equal(h.ctx.renderWaitAttribution.pending,1);assert.equal(h.stats.waits,0);
   if(mode==='stop'){h.stop();await h.fire(100);}else await h.fire(101);await p;}
  const s=h.ctx.renderWaitAttribution;assert.equal(s[mode.includes('deadline')?'deadline':'stopped'],1);
  const frozen=JSON.stringify(s);h.clock.t=210;r.resolve(5);await micro();assert.equal(s.lateSettlements,1);assert.equal(JSON.stringify({...s,lateSettlements:0}),frozen);conservation(s);
 }
 checkpoint('actual-deadline-stop-late',{},['promise/token matrix','negative controls','baseline noninterference']);console.log('PASS100ms race, deadline equality/expiry, stop and terminal distinctions; late settlement cannot rewrite totals');
 // Distinct durations exercise every histogram edge and dropped time totals.
 const h=make();let sum=0;
 for(const duration of [0,1,2,5,6,20,21,100,101,1000,1001,9,3]){
  const r=h.request('CLEAR'),p=h.park();await micro();h.clock.t+=duration;sum+=duration;r.resolve(7);await p;h.check();h.timers.length=0;
 }
 assert.equal(h.ctx.renderWaitAttribution.parkMs,sum);assert.deepEqual(Array.from(h.ctx.renderWaitAttribution.latencyBuckets),[1,1,3,3,2,2,1]);assert.equal(h.ctx.renderWaitAttribution.dropped,5);conservation(h.ctx.renderWaitAttribution);
 checkpoint('histogram-conservation',h.ctx.renderWaitAttribution,['promise/token matrix','negative controls','baseline noninterference']);console.log('PASS independent nonuniform histogram edges/slowest/dropped time conservation');
 for(const mode of ['ready-before-check','reject-before-check','reject-wait','missing-record','missing-ready','token-change','disabled']){
  const h=make({disabled:mode==='disabled'});let r=h.request();
  if(mode==='ready-before-check'||mode==='reject-before-check'){h.clock.t=8;if(mode==='ready-before-check')r.resolve(3);else r.reject(Error('expected'));await micro();}
  if(mode==='reject-wait')h.ctx.waitD3DRender=()=>Promise.reject(Error('wait wrapper rejection'));
  if(mode==='missing-record'){h.bridge.requests.delete(r.id);h.ctx.waitD3DRender=()=>new Promise(resolve=>{r.resolve=resolve;});}
  if(mode==='token-change'){
   h.check();await micro();h.clock.t=5;const prior=r;r=h.request('CLEAR');h.check();assert.equal(h.ctx.renderWaitAttribution.superseded,1);
   prior.resolve(1);await micro();assert.equal(h.ctx.renderWaitAttribution.lateSettlements,1);
  }
  const p=h.park();await micro();
  if(mode==='disabled'){assert.equal(h.stats.waits,0);r.resolve(1);await micro();await p;continue;}
  h.clock.t=16;
  if(mode==='missing-ready')r.record.ready.then(()=>{delete r.record.renderWaitReadyAt;});
  r.resolve(9);await p;h.check();const s=h.ctx.renderWaitAttribution;
  if(mode==='reject-before-check'||mode==='reject-wait')assert.equal(s.rejected,1);else assert.equal(s.completed,1);
  if(mode.startsWith('missing-')){assert.equal(s.unknownMs,16);assert.equal(s.bridgePendingMs,0);assert.equal(s.readyToResumeMs,0);}
  if(mode.endsWith('before-check')){assert.equal(s.parkMs,0);assert.equal(h.stats.waits,0);}
  conservation(s);
 }
 checkpoint('promise-token-unknown-matrix',{},['negative controls','baseline noninterference']);console.log('PASS pre-ready/pre-rejected, wrapper rejection, repeated/token-changing waits, unknown record/timestamp, disabled park');
 const controls=[
  ['begin',x=>x.replace('renderWaitAttribution.begin(wait, ctx.d3d9Bridge?.requests.get(token));','')],
  ['start',x=>x.replace('renderWaitAttribution.parkStart(wait, started);','')],
  ['end',x=>x.replace(/renderWaitAttribution\.parkEnd\(wait, renderParkEnded,[\s\S]*?'pending'\)\);/,'')],
  ['settle',x=>x.replace('renderWaitAttribution.settle(wait);','')],
 ];
 for(const [name,transform]of controls){await assert.rejects(()=>boundary(transform),assert.AssertionError);console.log('PASS rejects omitted '+name);}
 for(const [name,transform]of [
  ['bridge-ready',x=>x.replace('record.renderWaitReadyAt = Date.now();','')],
  ['issue-operation',x=>x.replaceAll('Object.keys(Stream.OPCODES).find(name => Stream.OPCODES[name] === opcode)',"'unknown'")]
 ]){await assert.rejects(()=>boundary(x=>x,transform),assert.AssertionError);console.log('PASS rejects omitted '+name);}
 // Terminal and reject omissions have separate relevant schedules.
 for(const name of ['terminal','reject']){
  const check=async()=>{const h=make({mutate:x=>name==='reject'?x.replace('renderWaitAttribution.reject(wait);',''):x});
   const r=h.request();if(name==='terminal'){h.check();await micro();h.clock.t=10;/* omitted terminal call */assert.equal(h.ctx.renderWaitAttribution.stopped,1);}
   else {h.ctx.waitD3DRender=()=>Promise.reject(Error('expected'));await h.park();assert.equal(h.ctx.renderWaitAttribution.rejected,1);}
   r.resolve(1);};
  await assert.rejects(check,assert.AssertionError);console.log('PASS rejects omitted '+name);
 }
 checkpoint('negative-controls',controls.map(x=>x[0]).concat(['bridge-ready','issue-operation','terminal','reject']),['baseline noninterference']);
 const traces=[];
 for(const old of [false,true]){
  const matrix=[];
  for(const mode of ['delayed','reject','timeout','stop','ready','disabled','token-change','run-exception']){
   const h=make({old,disabled:mode==='disabled'});let r=h.request();
   if(mode==='ready'){r.resolve(3);await micro();}
   if(mode==='token-change'){h.check();await micro();const prior=r;r=h.request('CLEAR');h.check();prior.resolve(2);await micro();}
   if(mode==='timeout')h.deadline(100);
   if(mode==='run-exception')h.instance.exports.run=()=>{h.trace.push('throw');throw Error('guest-run-sentinel');};
   const p=h.dispatch();let thrown=null;p.catch(()=>{});await micro();
   if(mode==='timeout'||mode==='stop'){if(mode==='stop')h.stop();await h.fire(101);}
   else {h.clock.t=31;if(mode==='reject')r.reject(Error('sentinel'));else r.resolve(7);}
   try{await p;}catch(e){thrown=e.message;}
   matrix.push({mode,stats:{...h.stats},trace:h.trace,tick:{...h.tickState},done:r.record.done,error:!!r.record.error,thrown,yield:h.instance.exports.get_yield_reason()});
   r.resolve(1);await micro();
  }traces.push(matrix);
 }
 assert.deepEqual(traces[0],traces[1]);
 checkpoint('baseline-noninterference',traces[0],[]);console.log('PASS exact original bridge/runner/import baseline:8 schedules counters/order/100ms/yields/batches/clock/results/errors; initializer and all non-hook runner bytes identical');
}
main().catch(e=>{fs.writeFileSync(base+'/ops/challenge-first-failure.json',JSON.stringify({name:e.name,message:e.message,stack:e.stack},null,2)+'\n');console.error(e);process.exitCode=1;});
