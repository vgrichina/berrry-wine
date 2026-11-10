'use strict';
// Nox-only observation closure. No production source/provider is modified.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),version='nox-passive-consumption-v1';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sites={0x481340:'mouse-poll',0x481290:'mouse-record-consumer',0x42b2c0:'mouse-batch-consumer',0x42b980:'cursor-update',0x42b970:'cursor-get',0x479a80:'gui-mouse-dispatch',0x4798f0:'gui-hit-test',0x479800:'gui-event-dispatch'};
function compile(){
 const {watxSourceClosure,compileClosure}=require('./watx-closure.js'),c=watxSourceClosure();
 function edit(name,a,b){const s=c.vfs.get(name);assert.equal(s.split(a).length,2,name+' unique passive seam');const v=s.replace(a,b);for(const key of [name,'src/'+name,'./'+name])c.vfs.set(key,v);}
 edit('01-header.wat','(import "host" "log_eip"',`(import "host" "nox_consumption" (func $nox_consumption (param i32 i32 i32 i32)))
 (global $nox_consumption_on (mut i32) (i32.const 0))
 (func (export "nox_consumption_arm") (param $on i32) (global.set $nox_consumption_on (local.get $on)))
 (import "host" "log_eip"`);
 const asm=require('node:child_process').execFileSync('objdump',['-d','-Mintel',root+'/test/binaries/candidates/nox-demo/game/nox.exe'],{maxBuffer:64*1024*1024}).toString();
 const returns=[];for(const m of asm.matchAll(/^\s*([a-f0-9]+):\s+((?:[a-f0-9]{2} )+)\s*call\s+0x([a-f0-9]+)/gm))if(sites[parseInt(m[3],16)])returns.push(parseInt(m[1],16)+m[2].trim().split(/\s+/).length);
 assert(returns.length>10,'original Nox direct caller sites');
 const oneOf=(value,values)=>values.map(v=>`(i32.eq ${value} (i32.const ${v}))`).reduce((a,b)=>`(i32.or ${a} ${b})`);
 const call=(k,a,b,d)=>{const selected=k===1||k===3?Object.keys(sites).map(Number):k===2?returns:[1093,1094];return `(if (i32.and (global.get $nox_consumption_on) ${oneOf(a,selected)}) (then (call $nox_consumption (i32.const ${k}) ${a} ${b} ${d})))`;};
 edit('05-alu.wat','(func $pending_push (param $target i32) (param $ret i32) (param $esp i32)',
  '(func $pending_push (param $target i32) (param $ret i32) (param $esp i32)\n'+call(1,'(local.get $target)','(local.get $ret)','(local.get $esp)'));
 edit('05-alu.wat','(func $pending_pop (param $ret i32) (param $esp i32)\n    (local $p i32) (local $entry i32)',
  '(func $pending_pop (param $ret i32) (param $esp i32)\n    (local $p i32) (local $entry i32)\n'+call(2,'(local.get $ret)','(i32.const 0)','(local.get $esp)'));
 edit('05-alu.wat','(func $pending_entry (param $pc i32) (param $esp i32)\n    (local $p i32)',
  '(func $pending_entry (param $pc i32) (param $esp i32)\n    (local $p i32)\n'+call(3,'(local.get $pc)','(i32.const 0)','(local.get $esp)'));
 const seam='(call $dispatch_api_table (local.get $api_id) (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))';
 const apiCall=k=>call(k,'(local.get $api_id)','(local.get $arg0)','(i32.load offset=16 (global.get $reg_base))');
 edit('09b-dispatch.wat',seam,apiCall(4)+'\n'+seam+'\n'+apiCall(5));
 const r=compileClosure(c,{tailCalls:true});assert(r.success&&r.wasmBinary,JSON.stringify(r.errors));return Buffer.from(r.wasmBinary);
}
// Self-contained: emitted Worker and compiled controls use this same recorder.
// Direct-window reads only, never translation/fault helpers or guest setters.
function recorder({getExports,getMemory,bases,sites,api,now=()=>performance.now(),emit=()=>{},limit=12000,eventLimit=2000000,durationMs=1440000}){
 const fields='processId processObject endpoint endpointObject workerObject workerTarget workerInstance moduleObject moduleSha256 epoch renderEndpoint renderEndpointObject renderWorkerObject rendererTarget rendererEpoch rendererModuleSha256 pageRendererObject canvasObject'.split(' ');
 const clone=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>fields.every(k=>a?.[k]!==undefined&&a[k]!==null&&a[k]!==''&&a[k]===b?.[k]);
 let owner=null,binding=null,terminal=null,deadline=null,sequence=0,events=0,pendingApi=null;const rows=[],frames=[];
 function stop(reason){if(!terminal)terminal=reason;try{getExports()?.nox_consumption_arm(0);}catch{}}
 function readW(p,n){const m=getMemory();if(!Number.isInteger(p)||p<0||!Number.isInteger(n)||n<0||n>1024||p+n>m.byteLength)throw Error('read bounds');return new Uint8Array(m,p,n);}
 function u32(p){const a=readW(p,4);return new DataView(a.buffer,a.byteOffset,4).getUint32(0,true);}
 function wa(p,n=4){p>>>=0;const a=p-0x400000+0x12000;if(a<0x12000||a+n>0x8000000)throw Error('direct read bounds');readW(a,n);return a;}
 const read=p=>u32(wa(p)),bytes=(p,n)=>Array.from(readW(wa(p,n),n));
 const fifo=()=>({head:u32(bases.DI_MOUSE_INPUT_STATE+8),tail:u32(bases.DI_MOUSE_INPUT_STATE+12)});
 const cursor=()=>({x:read(0x624768)|0,y:read(0x62476c)|0,buttons:bytes(0x62477c,36),bounds:[read(0x6247d8)|0,read(0x556264)|0,read(0x6247dc)|0,read(0x556268)|0]});
 function row(kind,data){if(!binding||terminal)return;if(now()>=deadline){stop('deadline');return;}if(rows.length>=limit){stop('record-limit');return;}const r={kind,sequence:++sequence,at:now(),binding:clone(binding),fifo:fifo(),...data};rows.push(r);try{emit(r);}catch{stop('sink');}}
 function device(pointer){const slot=read(pointer+4);if(slot>=16384)throw Error('device slot');const p=bases.DX_OBJECTS+slot*32,flags=u32(p+28),map=u32(bases.DX_SURF_STATE+slot*32);
  return {pointer,slot,kind:u32(p+8),flags,acquired:!!(flags&0x400),formatSet:!!(flags&0x100),axisMode:flags&0x800?'absolute':'relative',dataSize:u32(p+20),capacity:u32(p+12),map,
   offsets:map?Array.from({length:6},(_,i)=>read(map+4*i)|0):[0,4,8,12,13,14]};}
 function event(kind,a,b,esp){
  if(!binding||terminal)return;
  try{
   if(now()>=deadline){stop('deadline');return;}if(++events>eventLimit){stop('event-limit');return;}a>>>=0;b>>>=0;esp>>>=0;
   if(kind===4&&api[a]){
    const args=Array.from({length:5},(_,i)=>read(esp+4+i*4)),d=device(args[0]);if(d.kind!==2)return;
    if(pendingApi)throw Error('nested mouse API');pendingApi={api:api[a],apiId:a,esp,ret:read(esp),args,device:d,requested:api[a]==='GetDeviceData'&&args[3]?read(args[3]):args[1]};row('di-entry',pendingApi);
   }else if(kind===5&&pendingApi?.apiId===a){
    const f=pendingApi;pendingApi=null;const hr=getExports().get_eax()>>>0,count=f.api==='GetDeviceData'&&f.args[3]?read(f.args[3]):null;
    const n=hr&0x80000000?0:f.api==='GetDeviceData'?(f.args[2]?Math.min(count,f.requested,32)*Math.min(f.args[1],32):0):Math.min(f.args[1],256);
    row('di-return',{...f,hresult:hr,returnEsp:esp,returnedCount:count,returnedBytes:n?bytes(f.args[2],n):[],truncated:f.api==='GetDeviceData'&&count>32,deviceAfter:device(f.args[0])});
   }else if(kind===1&&sites[a]){
    if(frames.length>=32)throw Error('frame limit');const args=Array.from({length:4},(_,i)=>read(esp+4+i*4));
    const f={target:a,site:sites[a],ret:b,esp,args};frames.push(f);row('guest-call',{...f,cursor:cursor(),payload:a===0x481290?bytes(args[1],16):null});
   }else if(kind===3){const f=frames.at(-1);if(f&&!f.entered&&a===f.target&&esp===f.esp){f.entered=true;row('guest-entry',{...f,cursor:cursor()});}}
   else if(kind===2){const f=frames.at(-1);if(f&&a===f.ret&&esp===f.esp){frames.pop();row('guest-return',{...f,result:getExports().get_eax()>>>0,returnEsp:getExports().get_esp()>>>0,cursor:cursor(),payload:f.target===0x481340?bytes(f.args[0],56):null});}}
  }catch(e){stop('observation-error: '+e.message);}
 }
 return {event,stop,position:cursor,begin(b,identity){
  if(terminal)throw Error('Nox consumption terminal: '+terminal);
  if(!b?.id||!b.label||!/^[a-f0-9]{64}$/.test(b.previous?.sha256??'')||!same(b.previous.identity,identity)||owner&&!same(owner,identity)){stop('binding');throw Error('Nox consumption owner/image binding');}
  if(frames.length||pendingApi){stop('incomplete');throw Error('Nox consumption incomplete prior call');}
  owner=clone(identity);binding=clone(b);if(deadline===null)deadline=now()+durationMs;getExports().nox_consumption_arm(1);const position=cursor();row('command-begin',{cursor:position});return {active:!terminal,cursor:position};
 },finish(identity){if(frames.length||pendingApi)stop('incomplete');getExports()?.nox_consumption_arm(0);binding=null;return this.snapshot(identity);},snapshot(identity){if(owner&&!same(owner,identity))stop('owner');if(deadline!==null&&now()>=deadline)stop('deadline');return {version:1,status:terminal?'UNKNOWN':'PASSIVE',reason:terminal,deadline,events,pendingApi:clone(pendingApi),frames:clone(frames),records:clone(rows)};}};
}
function workerInstall(config,makeRecorder){
 const original=WebAssembly.instantiate;let installed=false;
 WebAssembly.instantiate=async function(module,imports,...rest){
  if(installed||!imports?.host?.check_input)return Reflect.apply(original,this,[module,imports,...rest]);installed=true;
  const response=await fetch(config.url),bytes=new Uint8Array(await response.arrayBuffer());const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  if(!response.ok||digest!==config.sha256||bytes.length!==config.size)throw Error('Nox observation module integrity');
  let exports;const o=makeRecorder({getExports:()=>exports,getMemory:()=>imports.host.memory.buffer,bases:config.bases,sites:config.sites,api:config.api,emit:r=>console.debug('NOX_CONSUMPTION '+JSON.stringify(r))});imports.host.nox_consumption=o.event;
  const result=await Reflect.apply(original,this,[await WebAssembly.compile(bytes),imports,...rest]),observed=result.instance??result;exports=observed.exports;globalThis.__noxConsumption=o;
  o.owner=()=>{if(instance!==observed)throw Error('Nox instantiated Worker owner changed');return {sha256:config.sha256,size:config.size,endpointIdentity,slot:workerSlot,workerInstance:globalThis.__mcmPassiveInstanceV1?.ids.get(instance)};};
  const begin=o.begin;o.begin=(b,identity)=>{if(identity.moduleSha256!==config.sha256||identity.endpoint!==endpointIdentity||workerSlot!==0||globalThis.__mcmPassiveInstanceV1?.ids.get(instance)!==identity.workerInstance){o.stop('live Worker owner');throw Error('Nox consumption live Worker owner');}return begin(b,identity);};return result;
 };
}
const workerSource=config=>'('+workerInstall.toString()+')('+JSON.stringify(config)+','+recorder.toString()+');';
function boundSource(source,config){
 const seam='    const scripts = [...new Map(w.scripts.filter(s => s.bytecodeAvailable && s.sha256 && !s.error).map(s=>[s.scriptId,s])).values()];';
 assert.equal(source.split(seam).length,2,'Nox instantiated-module admission seam');
 return source.replace(seam,`    const observation=await evaluate('globalThis.__noxConsumption.owner()',w.sessionId);
    assert.equal(observation.sha256,${JSON.stringify(config.sha256)},'Nox instantiated observation SHA');
    assert.equal(observation.size,${config.size},'Nox instantiated observation size');
    assert.equal(observation.endpointIdentity,live.endpointIdentity,'Nox observation endpoint');
    assert.equal(observation.slot,live.slot,'Nox observation slot');
    assert.equal(observation.workerInstance,live.instance,'Nox observation instance');
    const recovered=[...new Map(w.scripts.filter(s=>s.bytecodeAvailable&&s.sha256&&!s.error).map(s=>[s.scriptId,s])).values()];
    assert(expectedModules&&recovered.every(s=>expectedModules.includes(s.sha256)),'Nox foreign compiled module');
    const scripts=recovered.filter(s=>s.sha256===observation.sha256);`);
}
function configuration(bytes,url){const table=JSON.parse(fs.readFileSync(root+'/src/api_table.json'));return {version,url,size:bytes.length,sha256:sha(bytes),bases:require('../lib/region-map.generated').BASE,sites,api:Object.fromEntries(['GetDeviceData','GetDeviceState'].map(n=>[table.findIndex(r=>r.name==='IDirectInputDevice_'+n),n]))};}
// Pure admission calculation over observations. Never calls renderer helpers
// (some refresh presentation) or moves the pointer on the caller's behalf.
function anchorPoint(c,p,cursor){
 assert.equal(c.action,'move','cursor anchor is an ordinary move-only command');
 assert(!c.to&&!c.button&&!c.captureHeld&&c.holdMs===undefined,'anchor has no button or held effects');
 assert(c.anchorOriginalCursor&&c.anchorOriginalCursor.x===cursor.x&&c.anchorOriginalCursor.y===cursor.y,'anchor must name observed original cursor');
 assert(Number.isInteger(cursor.x)&&Number.isInteger(cursor.y)&&!p.locked,'unlocked observed cursor required');
 assert(!p.reference||p.reference.x===cursor.x&&p.reference.y===cursor.y,'anchor refuses mismatched existing reference');
 assert(c.point?.length===2&&c.point.every(v=>Number.isFinite(v)&&v>0&&v<1),'explicit normalized anchor point');
 const canvas=p.canvas;let x=Math.floor(c.point[0]*canvas.width),y=Math.floor(c.point[1]*canvas.height);
 const t=p.transform,v=p.viewport;
 if(t){
  if(v&&v.outputW>0&&v.outputH>0&&v.dstW>0&&v.dstH>0&&v.nativeW>0&&v.nativeH>0){
   x=Math.min(Math.max(Math.floor(v.nativeX+(x*v.outputW/canvas.width-v.dstX)*v.nativeW/v.dstW),v.nativeX),v.nativeX+v.nativeW-1);
   y=Math.min(Math.max(Math.floor(v.nativeY+(y*v.outputH/canvas.height-v.dstY)*v.nativeH/v.dstH),v.nativeY),v.nativeY+v.nativeH-1);
  }else{
   x=Math.min(Math.max(Math.floor(t.srcX+(x-t.dstX)*t.srcW/Math.max(1,t.dstW)),t.srcX),t.srcX+t.srcW-1);
   y=Math.min(Math.max(Math.floor(t.srcY+(y-t.dstY)*t.srcH/Math.max(1,t.dstH)),t.srcY),t.srcY+t.srcH-1);
  }
 }
 assert.equal(x,cursor.x,'physical anchor X must map to original cursor');assert.equal(y,cursor.y,'physical anchor Y must map to original cursor');
 return {x,y};
}
function compose(source,config){
 if(!config)return source;
 const once=(a,b)=>{assert.equal(source.split(a).length,2,'Nox consumption generated seam '+a);source=source.replace(a,b);};
 const start=source.indexOf(' // Generated native CDP keyboard preflight before the original app is selected.'),end=source.indexOf(' const selectedApp=',start);
 assert(start>0&&end>start,'accepted unchanged preflight reuse');
 source=source.slice(0,start)+" save('accepted-controls-reused.json',{fixtureCommit:'682f77655',readinessCommit:'bce2b316f',unchangedFixtureRetried:false});\n"+source.slice(end);
 // Pause newborn Workers only to install observation imports before instantiate.
 source=source.replaceAll('waitForDebuggerOnStart:false','waitForDebuggerOnStart:true');
 once("const task=Promise.all([send('Debugger.enable',{},sessionId),send('Runtime.enable',{},sessionId)]);",`const task=(async()=>{await Promise.all([send('Debugger.enable',{},sessionId),send('Runtime.enable',{},sessionId)]);if(targetInfo.url.includes('guest-worker'))await evaluate(${JSON.stringify(workerSource(config))},sessionId);await send('Runtime.runIfWaitingForDebugger',{},sessionId);})();`);
 once(".map(p=>p.sha256)});",`.map(p=>p.sha256).concat(${JSON.stringify(config.sha256)})});`);
 once('async function execute(c,markDispatch){','let noxAnchor=null;\nasync function execute(c,markDispatch){');
 once(' markDispatch();',` const cw=[...workers.values()].find(w=>w.targetId===latest.identity.workerTarget&&!w.closed);assert(cw,'Nox consumption owning Worker');
 const armed=await evaluate('globalThis.__noxConsumption.begin('+JSON.stringify({id:c.id,label:c.label,previous:latest})+','+JSON.stringify(latest.identity)+')',cw.sessionId);assert.equal(armed?.active,true,'Nox consumption arm');
 if(c.anchorOriginalCursor!==undefined){
  const pointer=await evaluate('window.noxPointerObserver.snapshot().state');
  const mapped=(${anchorPoint.toString()})(c,pointer,armed.cursor);
  noxAnchor={id:c.id,label:c.label,previous:latest,cursor:armed.cursor,mapped,point:c.point};
  save('input-'+c.id+'-anchor-admission.json',noxAnchor);
 }else if(c.action==='move'){
  const pointer=await evaluate('window.noxPointerObserver.snapshot().state');
  assert(pointer?.reference,'first move requires explicit observed original cursor anchoring');
 }
 if(['click','doubleclick','drag'].includes(c.action)){
  const pointer=await evaluate('window.noxPointerObserver.snapshot().state');
  assert(pointer?.reference&&Number.isInteger(armed.cursor?.x)&&Number.isInteger(armed.cursor?.y)&&pointer.reference.x===armed.cursor.x&&pointer.reference.y===armed.cursor.y,'Nox relative pointer reference must match original cursor before button input');
 }
 markDispatch();`);
 once("console.log('CAPTURE '+label);",`const cw=[...workers.values()].find(w=>w.targetId===latest.identity.workerTarget&&!w.closed);assert(cw,'Nox consumption capture Worker');const consumption=await evaluate('globalThis.__noxConsumption.finish('+JSON.stringify(latest.identity)+')',cw.sessionId);save(label+'-consumption.json',consumption);assert.equal(consumption.reason,null,'Nox consumption observation incomplete');
 if(noxAnchor){
  assert.equal(label,noxAnchor.label,'anchor returns its own image');
  const pointer=await evaluate('window.noxPointerObserver.snapshot().state');
  const position=await evaluate('globalThis.__noxConsumption.position()',cw.sessionId);
  assert.equal(position.x,noxAnchor.cursor.x,'anchor leaves original X unchanged');assert.equal(position.y,noxAnchor.cursor.y,'anchor leaves original Y unchanged');
  assert(pointer.reference&&pointer.reference.x===position.x&&pointer.reference.y===position.y,'physical anchor established synchronized reference');
  save(label+'-anchor.json',{...noxAnchor,capture:latest,position,reference:pointer.reference,requiresModelReviewBeforeNextInput:true});noxAnchor=null;
 }
 console.log('CAPTURE '+label);`);
 return source;
}
module.exports={version,sites,compile,configuration,recorder,workerSource,boundSource,compose,anchorPoint,sha};
