'use strict';
// Authored USER/CPUWorker fixture. No original game is launched by this tool.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),net=require('node:net');
const {once}=require('node:events'),{startControlSession}=require('../test/control-session');
const http=require('node:http');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function native(out,{delay=0,trace=false,cancel=false,hoverFixture=null,callbackFixture=null}={}) {
 fs.mkdirSync(out,{recursive:true});
 const save=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 const callback=callbackFixture?require('../test/test-disciples2-native-callback-readiness.cjs'):null;
 const bytes=callbackFixture?callback.fixture(callbackFixture):hoverFixture
  ?require('../test/test-disciples2-native-hover-pump.cjs').fixture(hoverFixture)
  :require('../test/test-cli-native-button-delivery.cjs').fixture(delay);
 const image=path.join(out,'public-pump.exe');fs.writeFileSync(image,bytes,{flag:'wx'});
 save('inputs.json',{delay,trace,cancel,hoverFixture,callbackFixture,head:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  fixtureSHA256:hash(bytes),moduleSHA256:hash(fs.readFileSync('build/wine-assembly.wasm')),node:process.version});
 const wd=cp.spawn(process.execPath,['-e',`let p;const t=setTimeout(()=>{console.log('FIRED');if(p)try{process.kill(-p,'SIGTERM')}catch{}},35000);console.log('ARMED');process.stdin.on('data',b=>p=+b);process.stdin.on('end',()=>clearTimeout(t));`]);
 let wo='',we='';wd.stdout.on('data',b=>wo+=b);wd.stderr.on('data',b=>we+=b);const ww=once(wd,'close');
 while(!wo.includes('ARMED'))await pause(2);save('watchdog-armed.json',{pid:wd.pid,beforeNative:true,deadline:Date.now()+35000});
 const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));
 const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const env={...process.env};delete env.WINE_PUBLIC_INPUT_TRACE;
 if(trace)env.WINE_PUBLIC_INPUT_TRACE=path.join(out,'public-input.jsonl');
 const s=startControlSession(['test/run.js','--exe='+image,'--no-build','--threads','--real-ticks','--screen=1024x712',
  '--control-stdin','--control='+port,'--max-seconds=30','--max-batches=10000000','--stuck-after=0','--trace-thread','--quiet-api','--quiet-blocks','--no-close'],
  {spawnOptions:{detached:true,env}});
 wd.stdin.write(String(s.child.pid));let release,releaseWait;
 try {
  let snap;const startup=Date.now()+15000;
  do {snap=await s.send({action:'snapshot'});if(snap.focusWindow?.live&&snap.windows.length>=2)break;
   assert(Date.now()<startup,'native startup');await pause(20);} while(true);
  if(hoverFixture||callbackFixture){
   const due=Date.now()+5000;
   while(!await s.send({action:'eval',code:'!!renderer.windows[instance.exports.get_main_hwnd()]?._nativeInputPumpCompletion'})){
    assert(Date.now()<due,'owner must establish an actual unfiltered idle before filtered transition');await pause(10);
   }
   assert.equal(await s.send({action:'eval',code:'instance.exports.post_message_q(instance.exports.get_main_hwnd(),0x8000,0,0)'}),1);
   await pause(100);
  }
  const callbackBefore=callbackFixture?await s.send({action:'eval',code:callback.observationCode()}):null;
  const owner=await s.send({action:'guarded-bind'}),nonce=crypto.randomUUID();
  const url='http://127.0.0.1:'+port+'/ctl',fallback=Date.now()+1500;
  release=cp.spawn(process.execPath,['-e',`const http=require('node:http');let due=${fallback};console.log('ARMED');process.stdin.on('data',b=>due=Math.min(due,+b));const t=setInterval(()=>{if(Date.now()<due)return;clearInterval(t);const sent=Date.now(),r=http.request(${JSON.stringify(url)},{method:'POST'},res=>{let b='';res.on('data',v=>b+=v);res.on('end',()=>{console.log(JSON.stringify({sent,at:Date.now(),status:res.statusCode,reply:JSON.parse(b)}));process.stdin.destroy()})});r.on('error',e=>{console.error(e);process.exitCode=1;process.stdin.destroy()});r.setTimeout(250,()=>r.destroy(Error('independent UP timeout')));r.end(JSON.stringify({action:'guarded-release',owner:${JSON.stringify(owner.owner)}}))},2);`]);
  let ro='',re='';release.stdout.on('data',b=>ro+=b);release.stderr.on('data',b=>re+=b);releaseWait=once(release,'close');
  while(!ro.includes('ARMED'))await pause(2);save('release-armed.json',{pid:release.pid,fallback,beforeDown:true});
  const sent=Date.now(),guard={...owner,nonce,reviewed:true,deadline:sent+1500};let receipt,error;
  const callbackSamples=[];let sampling=true;
  const sampleWait=callbackFixture?(async()=>{
   for(let i=0;i<20&&sampling&&Date.now()<sent+450;i++){
    const value=await s.send({action:'eval',code:callback.observationCode()});
    callbackSamples.push({at:Date.now(),value});await pause(20);
   }
  })():Promise.resolve();
  try {
   const body=await new Promise((resolve,reject)=>{
    const r=http.request(url,{method:'POST'},res=>{let b='';res.on('data',v=>b+=v);res.on('end',()=>{clearTimeout(timer);try{resolve(JSON.parse(b));}catch(e){reject(e);}});});
    const timer=setTimeout(()=>r.destroy(Error('500ms confirmation timeout')),500);
    r.on('error',e=>{clearTimeout(timer);reject(e);});
    r.end(JSON.stringify({action:'guarded-input',cmd:'mousedown:500:220',guard}));
   });
   assert(body.ok);receipt=body.value;
  } catch(e) {error=String(e);}
  const returnedAt=Date.now();save('confirmation.json',{sent,returnedAt,elapsedMs:returnedAt-sent,receipt,error});
  sampling=false;await sampleWait;
  if(receipt?.consumed)release.stdin.write(String(receipt.consumedAt+100));
  const [exit,signal]=await releaseWait;
  save('release-wait.json',{pid:release.pid,exit,signal,actualWait:true,stdoutEOF:release.stdout.readableEnded,stderrEOF:release.stderr.readableEnded,stdout:ro,stderr:re});assert.equal(exit,0);
  // Fixtures may query terminal status to test cancellation; original UNKNOWN
  // sessions permanently close and must never use this diagnostic query.
  const callbackAfter=callbackFixture?await s.send({action:'eval',code:callback.observationCode()}):null;
  if(callbackFixture){
   save('callback-return.json',{before:callbackBefore,samples:callbackSamples,after:callbackAfter});
   assert.equal(callbackAfter.badStack,0,'actual Dispatch caller stack restored');
   for(const key of ['owner','generation','hwnd'])assert.equal(callbackAfter[key],callbackBefore[key],key+' retained');
   assert(callbackBefore.sameMemory&&callbackAfter.sameMemory&&callbackBefore.visible&&callbackAfter.visible);
   assert(!callbackBefore.retired&&!callbackAfter.retired);
   assert(callbackAfter.siblingPeeks>callbackBefore.siblingPeeks,'actual sibling CPUWorker continued');
   for(const msg of [0x200,0x84,0x20])assert(callbackAfter.returns[msg]>callbackBefore.returns[msg],
    'actual x86 caller continuation after callback '+msg.toString(16));
   if(callbackFixture.nonempty!==false){
    assert(callbackSamples.some(({at,value:v})=>at<=sent+500&&[0x200,0x84,0x20].every(m=>v.returns[m]>callbackBefore.returns[m])&&
     v.hover?.pending&&!v.hover.polled&&v.empty===callbackBefore.empty&&v.consumerSamples===callbackBefore.consumerSamples),
     'actual callback returns observed before confirmation deadline while exact hover remains pending');
    assert(callbackAfter.returns[0x113]>callbackBefore.returns[0x113],'real timer callbacks returned');
    assert.equal(callbackAfter.empty,callbackBefore.empty,'owner queries remained nonempty');
    assert.equal(callbackAfter.consumerSamples,callbackBefore.consumerSamples,'actual consumer has not sampled hover');
    assert(!callbackAfter.hover.polled,'callback completion alone does not complete owner pump');
   }else assert(callbackAfter.consumerSamples>callbackBefore.consumerSamples,'actual drained consumer sampled cursor');
  }
  await pause(delay*4+150);const terminal=await s.send({action:'guarded-status',nonce});
  snap=await s.send({action:'snapshot'});save('terminal.json',{receipt:terminal,snapshot:snap});
  const title=snap.windows.find(w=>w.hwnd===snap.mainHwnd)?.title;
  if(cancel){assert(error,'500ms transport must time out');assert.equal(terminal.state,'UNKNOWN');assert(!terminal.consumed);assert.equal(title,'UP WITHOUT DOWN');}
  else{assert(!error,error);assert(receipt.consumed);assert.equal(receipt.receiptBoundary,'native-input-return');assert.equal(receipt.nativeMessage.msg,0x201);assert.equal(title,'UP after DOWN');assert(returnedAt-sent<=500);}
  assert(s.output().includes('spawned WORKER thread'),'real CPUWorker helper');
  await s.send({cmd:'keydown:27'});await pause(40);await s.send({cmd:'keyup:27'});
  s.child.stdin.end();assert.equal(await s.exited,0);
  if(trace){
   const values=fs.readFileSync(path.join(out,'public-input.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
   const chunks=values.filter(v=>v.kind==='public-input-pump'),rows=chunks.flatMap(v=>v.rows);
   assert(chunks.length>0&&chunks.every(v=>v.rows.length<=512),'bounded trace must actually persist');
   assert(rows.some(v=>v.phase==='delivery-pending'&&v.edges.some(e=>e.msg===513)),'actual pending DOWN identity');
   assert(rows.some(v=>v.phase==='renderer-poll-return'&&v.event?.msg===514),'independent UP must be observed');
   if(cancel){assert(rows.some(v=>v.phase==='cancel'&&v.state==='UNKNOWN'));assert(!rows.some(v=>v.phase==='native-input-return-candidate'&&v.event?.msg===513));}
   else assert(rows.some(v=>v.phase==='native-input-return-candidate'&&v.event?.msg===513));
   if(hoverFixture){
    const nativeRows=rows.filter(v=>v.phase==='native-user-consumer');
    const tid=snap.focusWindow.threadId,target=parseInt(snap.mainHwnd,16);
    assert(nativeRows.some(v=>v.publicAPI.kind===2&&v.publicAPI.threadId===tid),'actual owner PeekMessage identity');
    assert(nativeRows.some(v=>v.publicAPI.dispatchMsg===0x200),'actual MOVE DispatchMessage entry');
    assert(nativeRows.every(v=>v.callbackReturn==='unmeasured'),'no invented callback return');
    if(hoverFixture.filter==='window')assert(nativeRows.some(v=>v.publicAPI.hwndFilter===target));
    if(cancel)assert(nativeRows.some(v=>v.publicAPI.disposition===1&&v.publicAPI.result===0),
      'native completed empty query observed separately from sibling idle');
   }
   const cost=values.find(v=>v.kind==='public-input-trace-cost');assert(cost&&!cost.failed);assert(cost.maxFlushMs<50,'bounded flush overhead');
   save('trace-assertions.json',{pass:true,rows:rows.length,chunks:chunks.length,cost});
  }
  save('assertions.json',{pass:true,title,actualWorker:true,cancel,nativeDown:!cancel,lateDownAfterUp:false});
 } finally {
  if(s.child.exitCode===null&&s.child.signalCode===null)process.kill(-s.child.pid,'SIGTERM');
  await s.exited;
  if(release&&release.exitCode===null){release.kill('SIGTERM');await releaseWait;}
  save('native-wait.json',{pid:s.child.pid,exit:s.child.exitCode,signal:s.child.signalCode,actualWait:true,stdoutEOF:s.child.stdout.readableEnded,stderrEOF:s.child.stderr.readableEnded});
  fs.writeFileSync(path.join(out,'native.log'),s.output(),{flag:'wx'});
  wd.stdin.end();const [exit,signal]=await ww;
  save('watchdog-wait.json',{pid:wd.pid,exit,signal,actualWait:true,stdoutEOF:wd.stdout.readableEnded,stderrEOF:wd.stderr.readableEnded,stdout:wo,stderr:we});assert.equal(exit,0);
 }
}
function units(traceModule='../lib/cli-public-input-trace') {
 const {createPublicInputTrace}=require(traceModule);let ms=0,writes=[];
 const r={inputQueue:[],_pointerMoves:{1:{generation:1n}},takeInput(){return this.inputQueue.shift()||null;},nativeInputPumpIdle(){return 17;}};
 const t={nonce:'one',state:'QUEUED',deadline:1000,binding:{refs:{renderer:r}}};
 const trace=createPublicInputTrace({write:v=>writes.push(v),monotonic:()=>ms,wall:()=>1000,ticketLimit:1,rowLimit:16});
 trace.attach(t.binding.refs);trace.mark('prepare',t);
 const edge={msg:513,hwnd:1,wParam:1,lParam:3};r.inputQueue.push(edge);
 assert.equal(r.takeInput(),edge);assert.equal(r.nativeInputPumpIdle(null,1),17);
 for(let i=0;i<1000;i++){ms+=.001;assert.equal(r.takeInput(),null);}
 trace.mark('cancel',t,{reason:'authored test'});trace.flush();assert.doesNotThrow(()=>JSON.stringify(writes));
 const last=writes.at(-1);assert.equal(last.rows.length,16);assert(last.overwritten>0);
 assert.equal(last.rows[0].phase,'prepare');assert.equal(last.rows.at(-1).phase,'cancel');
 assert(last.rows.some(v=>v.event?.msg===513),'first-quarter prefix retains input identity');
 trace.mark('prepare',{...t,nonce:'two'});const before=writes.length;r.takeInput();trace.flush();assert.equal(writes.length,before);
 assert.throws(()=>createPublicInputTrace({write:()=>{},rowLimit:513}));
 // An unavailable/retired native diagnostic export must never alter dequeue,
 // synthesize acknowledgement, or propagate its failure into the input path.
 for(const fault of ['setter','getter','property']){
  const r={inputQueue:[edge],takeInput(){return this.inputQueue.shift()||null;}},writes=[];
  const ex={set_user_pump_observation(){if(fault==='setter')throw Error('retired setter');},
   get_user_pump_observation(){throw Error('unavailable native observation');}};
  if(fault==='property')Object.defineProperty(ex,'set_user_pump_observation',{get(){throw Error('retired export property');}});
  const trace=createPublicInputTrace({write:v=>writes.push(v)}),refs={renderer:r,exports:ex};
  trace.attach(refs);trace.mark('prepare',{nonce:fault,state:'QUEUED',deadline:Date.now()+1000,binding:{refs}});
  assert.equal(r.takeInput(),edge);assert.equal(r.takeInput(),null);trace.flush();
  assert(writes.flatMap(v=>v.rows).some(v=>v.phase==='native-user-observation-unavailable'));
 }
 const guardCases=[];
 for(const mode of ['delivered','focus','owner','deadline','transport','throw','no-edge']) {
  const outcomes=[];
  for(const enabled of [false,true]) {
   let clock=1000,healthy=true,context=1,effects=0,ups=0;const rows=[];
   const renderer={inputQueue:[],takeInput(){return this.inputQueue.shift()||null;}};
   const refs={renderer,queue:renderer.inputQueue};
   const diagnostic=enabled?createPublicInputTrace({write:v=>rows.push(v),monotonic:()=>clock,wall:()=>clock}):null;
   const g=require('../lib/cli-guarded-input').createGuardedInput({diagnostic,nativeDelivery:true,
    now:()=>clock,monotonic:()=>clock,snapshot:()=>({healthy,refs}),captureDelivery:()=>context,
    validateDelivery:v=>v===context,cleanup:()=>{ups++;renderer.inputQueue.push({msg:514,hwnd:1});}});
   const owner=g.bind(),ticket=g.prepare({...owner,nonce:mode,reviewed:true,deadline:2000},{action:'mousedown'});
   const down={msg:513,hwnd:1,wParam:1,lParam:1};
   g.consume(ticket,()=>{effects++;if(mode!=='no-edge')renderer.inputQueue.push(down);if(mode==='throw')throw Error('authored effect failure');});
   if(mode==='focus')context++;
   if(mode==='owner')healthy=false;
   if(mode==='deadline')clock=2000;
   if(mode==='transport')g.wait(ticket).cancel('transport disconnected UNKNOWN');
   g.sweep();
   let event;while((event=renderer.takeInput()))g.delivered(event);
   const result=g.status(mode);g.release(owner.owner);diagnostic?.flush();g.close();
   assert.equal(effects,1);assert.equal(ups,1);assert.equal(result.consumed,mode==='delivered');
   if(enabled)assert(rows.some(v=>v.rows.some(x=>x.phase==='prepare')));
   outcomes.push({state:result.state,consumed:result.consumed,reason:result.reason,effects,ups});
  }
  assert.deepEqual(outcomes[0],outcomes[1],'trace must preserve guard semantics: '+mode);guardCases.push({mode,...outcomes[0]});
 }
 // Paired inactive and active overhead at the actual wrapped queue boundary.
 function measure(active) {
  const q={inputQueue:[],takeInput(){return null;},nativeInputPumpIdle(){}};
  const p=createPublicInputTrace({write:()=>{}});if(active){p.attach({renderer:q});p.mark('prepare',{...t,deadline:Date.now()+5000,binding:{refs:{renderer:q}}});}
  for(let i=0;i<10000;i++)q.takeInput();
  const start=performance.now();for(let i=0;i<100000;i++)q.takeInput();return (performance.now()-start)*1000/100000;
 }
 const samples=Array.from({length:5},()=>({offUs:measure(false),onUs:measure(true)}));
 assert(samples.every(s=>s.onUs<50),'trace overhead must stay below50us per empty queue poll');
 return {pass:true,bounds:{tickets:1,rows:16,observations:1000},guardCases,samples,thresholdUs:50};
}
module.exports={native,units};
if(require.main===module){
 if(process.argv[2]==='--unit')console.log(JSON.stringify(units(process.argv[3]),null,2));
 else native(path.resolve(process.argv[2]),JSON.parse(process.argv[3]||'{}')).catch(e=>{console.error(e);process.exitCode=1;});
}
