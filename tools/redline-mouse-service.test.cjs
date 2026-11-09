'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const service=require('./redline-mouse-service.cjs'),publication=require('./redline-current-publication.cjs');
const source=publication.prebrowserSource(require('./redline-current-startup.cjs').integrate(require('./redline-startup-boundary.cjs').integrate()),{mouseService:true});
new vm.Script(source);
const slice=(a,b)=>{const start=source.indexOf(a);assert(start>=0);const end=source.indexOf(b,start);assert(end>start);return source.slice(start,end);};
const send=slice('function send(','\nasync function evaluate(');
const execute=slice('async function execute(','\n(async()=>{');
const receive=slice('ws.onmessage=msg=>{const receivedAt=nativeTrace.monotonic();const v=JSON.parse(msg.data);mouseService.receive','\n ');
const root=path.resolve(__dirname,'..'),run=root+'/scratch/runs/20261109-redline-distinct-label-training-1235';
const transport=require(run+'/transport.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function lane(mode){
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'redline-mouse-service-'));
 fs.mkdirSync(out+'/commands');fs.writeFileSync(out+'/execution-window.json',JSON.stringify({browserStop:new Date(Date.now()+120000).toISOString()}));
 const pixels=Buffer.from('offline synthetic current reviewed image'),sha=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
 const latest={label:'current',sha256:sha(pixels),pointerLocked:false};fs.writeFileSync(out+'/current.png',pixels);fs.writeFileSync(out+'/current-review.json',JSON.stringify({...latest,review:'Offline control only'}));
 const writes=[],requests=[],timers=[];let captures=0;
 const observer=service.create({write:(id,value)=>writes.push({id,value})});
 const scope={assert,fs,root,run,out,require,Date,JSON,performance,setTimeout,clearTimeout,console:{log(){}},
  deadline:Date.now()+60000,latest,closing:false,fixture:null,pageSession:'page',cdpMousePoint:null,id:0,pending:new Map(),mouseService:observer,
  nativeTrace:{monotonic:()=>performance.now()},inputWire:{send:(meta,frame,invoke)=>invoke(),receive(){}},
  sha,save:(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v)),wait:delay,event:async()=>{},log(){},
  evaluate:async e=>{if(e.includes('__redlineMouseMarker'))return performance.timeOrigin+performance.now();if(e.includes('getBoundingClientRect'))return {left:137,top:83,width:640,height:480};return false;},
  capture:async()=>{assert(!scope.closing,'runtime terminal; no further capture');captures++;},
  chain:{admit:async(review,dispatch)=>dispatch({live:{identity:{}},ageMs:0})},
  ws:{send:frame=>{
   const request=JSON.parse(frame);requests.push({...request,at:performance.now()});
   const type=request.params.type;
   const latency=mode==='delayed-press'&&type==='mousePressed'?210:mode==='delayed-release'&&type==='mouseReleased'?300:1;
   if(mode==='terminal'&&type==='mousePressed')timers.push(setTimeout(()=>terminal('injected terminal'),20));
   timers.push(setTimeout(()=>{
    // The browser handling marker is a synthetic control, not native evidence.
    if(!scope.closing)scope.ws.onmessage({data:JSON.stringify({method:'Runtime.bindingCalled',sessionId:'page',params:{name:service.bindingName,payload:JSON.stringify({id:'click',type:({mouseMoved:'mousemove',mousePressed:'mousedown',mouseReleased:'mouseup'})[type],phase:'capture',at:performance.timeOrigin+performance.now(),trusted:true})}})});
    scope.ws.onmessage({data:JSON.stringify({id:request.id,sessionId:'page',result:{}})});
   },latency));
  }}
 };
 function terminal(reason){scope.closing=true;observer.terminal(reason);for(const p of scope.pending.values()){clearTimeout(p.timer);p.reject(Error(reason));}scope.pending.clear();}
 vm.createContext(scope);vm.runInContext(send+'\n'+receive+'\n'+execute,scope);
 const command={id:'click',action:'click',point:[.5,.5],holdMs:150,waitMs:0,reviewRef:'current',label:'next'};
 command.timing=transport.budget(out,command);if(mode==='delayed-release')command.timing.workEnd=Date.now()+230;
 fs.writeFileSync(out+'/commands/0.json',JSON.stringify(command));
 try{
  const execution=transport.consume(out,0,scope.execute);
  if(mode==='success'){
   await execution;assert(fs.existsSync(out+'/reply-0.json'));assert.equal(captures,1);
   assert.deepEqual(requests.map(r=>r.params.type),['mouseMoved','mousePressed','mouseReleased']);
   assert(requests.every(r=>r.params.x===457&&r.params.y===323),'saved current geometry');
  }else{
   await assert.rejects(execution,mode==='delayed-press'?/mouse delivery exceeded hold bound/:mode==='delayed-release'?/command work deadline/:/injected terminal|runtime terminal/);
   terminal('first terminal failure');assert(!fs.existsSync(out+'/reply-0.json'));assert.equal(captures,0);
   const count=requests.length;fs.writeFileSync(out+'/commands/1.json',JSON.stringify({...command,id:'later',action:'capture'}));
   await assert.rejects(transport.consume(out,1,scope.execute),/sticky/);await delay(360);assert.equal(requests.length,count,'no later protocol, input or capture');assert.equal(captures,0);
  }
  assert.equal(writes.length,1,'one bounded seal even after late reply');
  const rows=writes[0].value.rows;
  assert(rows.some(r=>r.kind==='clock-bracket'));assert(rows.some(r=>r.kind==='raw-reply'));
  if(mode==='delayed-press'){
   const press=rows.find(r=>r.kind==='socket-send-entry'&&r.type==='mousePressed'),up=rows.find(r=>r.kind==='socket-send-entry'&&r.type==='mouseReleased'),reply=rows.find(r=>r.kind==='raw-reply'&&r.requestId===press.requestId);
   assert(up.at-press.at>=130&&up.at-press.at<200,'unchanged independent release');assert(reply.at>=up.at,'delayed press remains refusal');assert(rows.some(r=>r.kind==='helper-failed'));
  }
  if(mode==='terminal')assert(!requests.some(r=>r.params.type==='mouseReleased'),'terminal forbids later release protocol');
 }finally{terminal('test cleanup');for(const timer of timers)clearTimeout(timer);fs.rmSync(out,{recursive:true,force:true});}
}
(async()=>{
 for(const mode of ['success','delayed-press','delayed-release','terminal'])await lane(mode);
 // Bounded DOM and request pressure cannot evict earlier causal records.
 let sealed;const o=service.create({write:(id,value)=>sealed=value,now:()=>1,origin:0});o.begin({id:'bounded'},'s');
 for(let n=0;n<1000;n++)o.send({requestId:n,method:'Input.dispatchMouseEvent',sessionId:'s'},{type:'mouseMoved'},()=>{});
 o.terminal('done');assert.equal(sealed.rows.length,128);assert(sealed.dropped>0);assert.equal(sealed.rows[0].kind,'begin');
 let sinkErrors=0;const broken=service.create({write:()=>{throw Error('injected sink failure');},onWriteError:()=>sinkErrors++});broken.begin({id:'sink'},'s');broken.terminal('original terminal');broken.terminal('later');assert.equal(sinkErrors,1);assert.match(broken.status().writeError,/injected sink failure/);
 let installed=[];const page={addEventListener:(...args)=>installed.push(args),globalThis:{},performance:{timeOrigin:100,now:()=>2}};
 page.globalThis[service.bindingName]=payload=>installed.push(JSON.parse(payload));vm.runInNewContext(service.install,page);
 assert.equal(installed.length,6);page.globalThis.__redlineMouseMarker={id:'bounded',left:1};const listener=installed[1][1];listener({isTrusted:true,type:'mousedown'});listener({isTrusted:true,type:'mousedown'});assert.equal(installed.length,7,'page binding emissions bounded');
 console.log('PASS actual composed execute/send/receive + deployed mouse/menu helper + numbered transport: success, delayed press, delayed release deadline, terminal, sticky no later protocol/capture, bounded dedicated records');
})().catch(e=>{console.error(e);process.exitCode=1;});
