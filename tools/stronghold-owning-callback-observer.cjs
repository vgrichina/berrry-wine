'use strict';
// Offline composition only. This module never starts a browser or a game.
const fs=require('node:fs'),path=require('node:path');
const base=require('./stronghold-preset-driver-attachment.cjs');
const original=require('./stronghold-attached-original-preset-driver.cjs');
const EXE_SHA256=base.EXE_SHA256;
const PINS=Object.freeze([
 [0x430e10,'8b4424045383f8ff75106a006a29b95837d100e828d203005bc383f801751733dbb95837d100536a39891dbc37d100e80cd203005bc383f8020f85c60000005633db57536a14b95837d100891dd44bd100c70584f9750101000000891d7437d100e8dad10300e88582ffffb9000d6801891d542f6900e885780400b93202000033c0bfbce67501c7059014680101000000c7051813680163000000c7059c13680101000000f3ab53b9c0abdb00c705c037d1000300000066abe8729f03008bf883c9ff33c06a04f2aef7d12bf98bc18bf7bfb6e77501c1e902f3a58bc883e103f3a4b9000d6801891d74257601e80ee70400b909000000b801000000bf50f87501f3ab5f5e5bc3'],
 [0x46e050,'538b5c2408555683fb178bf17505bb290000008b44241457895e18894604ff15c84158008946088bc383e80c'],
 [0x429100,'5355b96811ba00e814820b00'],
 [0x5bd0ac,'100e4300'],
 // Only immutable descriptor fields: runtime flags/dimensions may change.
 [0x5bd13c,'a0010000c9000000'],[0x5bd150,'02000000'],[0x5bd158,'0f020000']
]);

// Serialized verbatim into the pre-instantiation owning realm. Only getters,
// the pure JS translator and original import forwarding are used here.
function observerFactory(EXE_SHA256,PINS){
 const occupied=new WeakSet();
 function attach({host,getExports,translate,memory,workerSlot,endpointIdentity,epoch,
   exeSha256,wasmSha256,workerURL,expectedWorkerURL,deadline,now=()=>performance.now(),
   maxMs=360000,maxRecords=2048,maxBytes=1048576,maxBoundaries=1000000}={}){
  if(workerSlot!==0||endpointIdentity!==1||exeSha256!==EXE_SHA256||!(/^[a-f0-9]{64}$/).test(wasmSha256||'')||
    !workerURL||workerURL!==expectedWorkerURL||typeof epoch!=='string'||!epoch||epoch.length>256)
   throw Error('wrong binding/epoch');
  if(typeof host?.log_block!=='function'||typeof getExports!=='function'||typeof translate!=='function'||
    !memory?.buffer||occupied.has(host))throw Error('missing/occupied owning imports or memory');
  for(const [key,value,cap]of [['maxMs',maxMs,360000],['maxRecords',maxRecords,4096],['maxBytes',maxBytes,2097152],['maxBoundaries',maxBoundaries,2000000]])
   if(!Number.isSafeInteger(value)||value<1||value>cap)throw Error('invalid '+key);
  if(!Number.isFinite(deadline)||deadline<=now())throw Error('original deadline');
  const prior=host.log_block,frames=[],rows=[];let ex=null,buffer=memory.buffer,active=false,timer,end=deadline;
  let command=null,event=null,lastAck=null,custom=null;
  const report={version:1,status:'installed',epoch,workerSlot,endpointIdentity,exeSha256,wasmSha256,workerURL,
   records:rows,bytes:0,sequence:0,blocks:0,fault:null,pending:[],
   limits:{maxMs,maxRecords,maxBytes,maxBoundaries},
   evidence:'Owning WASM block entries and saved-return intervals; not instruction-level CALL/RET certification. Input annotations are host receipts, not guest dispatch proof.'};
  function finish(reason='explicit-stop'){
   if(!['installed','running'].includes(report.status))return report;
   active=false;clearTimeout(timer);report.status=reason;report.pending=frames.map(f=>({...f}));
   if(host.log_block===wrapped)host.log_block=prior;occupied.delete(host);return report;
  }
  function fail(error){if(!report.fault)report.fault=String(error.message||error);return finish('unsupported-or-unobservable');}
  function read(a,n=4){
   if(!Number.isSafeInteger(a)||a<=0||!Number.isSafeInteger(n)||n<1||n>512||a+n>0x100000000)throw Error('invalid native read');
   const bytes=new Uint8Array(buffer),out=[];
   for(let i=0;i<n;i++){const p=translate(a+i,0x400000,memory)>>>0;
    if(p===0xf0||p>=bytes.length)throw Error('unmapped native read');out.push(bytes[p]);}
   return out;
  }
  const u32=a=>{const b=read(a);return(b[0]+b[1]*256+b[2]*65536+b[3]*16777216)>>>0;};
  function identity(){
   const e=getExports();if(!e||ex&&e!==ex||e.memory!==memory||memory.buffer!==buffer)throw Error('foreign instance/memory');ex=e;
   if(e.get_current_thread_id()!==1||e.get_image_base()!==0x400000)throw Error('foreign thread/loader');
   if(u32(0x40003c)!==0x118||u32(0x400118)!==0x4550||u32(0x40014c)!==0x400000||u32(0x400168)!==0x199e000)throw Error('original header mismatch');
  }
  function signatures(){for(const [pc,hex]of PINS)if(read(pc,hex.length/2).map(v=>v.toString(16).padStart(2,'0')).join('')!==hex)throw Error('original bytes mismatch');}
  const state=()=>({currentScene:u32(0xd13764),requestedScene:u32(0xd13770),manager4:u32(0xd1375c),manager8:u32(0xd13760),mode:u32(0x1681318),saved:u32(0x690f7c)});
  function emit(kind,extra={}){
   const row={kind,sequence:report.sequence+1,block:report.blocks,epoch,command,pc:ex.get_eip()>>>0,esp:ex.get_esp()>>>0,state:state(),...extra};
   // UTF-8 byte accounting, including non-ASCII annotations.
   const size=new TextEncoder().encode(JSON.stringify(row)).length;
   if(rows.length>=maxRecords||report.bytes+size>maxBytes)throw Error('record/byte overflow');
   rows.push(row);report.bytes+=size;report.sequence++;
  }
  function live(){if(!active)return false;if(now()>=end)throw Error('original observer deadline');identity();if(host.log_block!==wrapped)throw Error('import owner replaced');return true;}
  function boundary(pc,esp){
   if(!live())return;pc>>>=0;esp>>>=0;
   if(++report.blocks>maxBoundaries)throw Error('boundary overflow');
   if(pc!==(ex.get_eip()>>>0)||esp!==(ex.get_esp()>>>0))throw Error('wrong block registers');
   let f=frames.at(-1);
   if(f&&pc===f.caller){
    if(esp!==f.esp+f.cleanup)throw Error('return stack/history mismatch');
    emit(f.name+'-return',{entrySequence:f.sequence,eax:ex.get_eax()>>>0});frames.pop();
    if(f.name==='setup')custom.setupDone=true;
    if(f.name==='callback'&&f.argument===2){if(!custom?.setupDone)throw Error('missing setup completion');emit('custom-path-completed');}
   }
   if(![0x430e10,0x430e2f,0x430e4f,0x46e050,0x429100].includes(pc))return;
   signatures();f=frames.at(-1);
   if(pc===0x430e2f||pc===0x430e4f){
    const arg=pc===0x430e4f?2:1;if(f?.name!=='callback'||f.argument!==arg)throw Error('missing callback/branch history');
    if(arg===2)custom={setupDone:false,managerDone:false};emit('callback-branch',{argument:arg});return;
   }
   const name=pc===0x430e10?'callback':pc===0x46e050?'scene-request':'setup';
   const caller=u32(esp),argument=name==='setup'?null:u32(esp+4);
   if(!caller||frames.length>=8)throw Error('saved return/nesting missing');
   if(name==='callback'&&frames.length)throw Error('nested callback unsupported');
   if(name==='scene-request'){
    if((ex.get_ecx()>>>0)!==0xd13758)throw Error('foreign scene manager');
    if(f?.name==='callback'){
     const expected=f.argument===2?[20,0x430e76]:f.argument===1?[57,0x430e44]:f.argument===0xffffffff?[41,0x430e28]:null;
     if(!expected||argument!==expected[0]||caller!==expected[1]||f.argument===2&&!custom)throw Error('scene request/branch mismatch');
    }
   }
   if(name==='setup'&&(f?.name!=='callback'||f.argument!==2||!custom?.managerDone||caller!==0x430e7b))throw Error('missing scene return/setup history');
   emit(name+'-entry',{argument,caller,ecx:ex.get_ecx()>>>0});
   frames.push({name,caller,argument,esp,cleanup:name==='scene-request'?12:4,sequence:report.sequence});
  }
  function wrapped(pc,esp,...rest){
   try{const f=frames.at(-1);boundary(pc,esp);if(f?.name==='scene-request'&&pc===f.caller&&custom)custom.managerDone=true;}
   catch(error){fail(error);}
   try{return Reflect.apply(prior,this,[pc,esp,...rest]);}catch(error){fail(error);throw error;}
  }
  host.log_block=wrapped;occupied.add(host);
  return {report,finish,
   start(){if(report.status!=='installed')throw Error('observer terminal');try{identity();signatures();end=Math.min(deadline,now()+maxMs);active=true;report.status='running';emit('baseline');
    timer=setTimeout(()=>fail(Error('original observer deadline')),Math.max(1,end-now()));timer.unref?.();}catch(error){fail(error);}return report;},
   check(){try{if(live()&&!report.blocks)throw Error('missing trace records');}catch(error){fail(error);}return report;},
   annotate(row){try{
    if(!live())return report;
    if(!row||row.epoch!==epoch)throw Error('foreign annotation epoch');
    if(JSON.stringify(row).length>8192)throw Error('annotation byte bound');
    if(!Number.isSafeInteger(row.command)||row.command<0)throw Error('command missing');
    if(row.kind==='begin'){if(command!==null)throw Error('duplicate gesture');command=row.command;}
    else if(row.command!==command)throw Error('foreign command');
    const order=['DOWN-enqueued','DOWN-consumed','UP-enqueued','UP-consumed'];
    if(order.includes(row.kind)){
     if(order.indexOf(row.kind)!==(event===null?0:order.indexOf(event)+1))throw Error('input order');
     if(!Number.isSafeInteger(row.steps)||lastAck!==null&&row.steps!==lastAck)throw Error('stale input state');
     const down=row.kind.startsWith('DOWN'),queued=row.kind.endsWith('enqueued');
     if(row.mask!==(down?1:0)||!Array.isArray(row.input))throw Error('input mask/receipt');
     if(queued){const msgs=down?[132,513]:[514];
      if(JSON.stringify(row.input.map(q=>q.msg))!==JSON.stringify(msgs)||row.input.some(q=>q.hwnd!==65537||q.mouseX!==543||q.mouseY!==292||q.lParam!==19137055||q.mouseButtons!==(down?1:0)||q.wParam!==(q.msg===132?0:down?1:0)))throw Error('wrong native input receipt');
     }else if(row.input.length||row.activeInput!==null||row.lastInput!==null)throw Error('undrained input');
     event=row.kind;
    }else if(row.kind==='ACK'){
     if(row.requested!==64||!Number.isSafeInteger(row.before)||row.steps!==row.before+64||lastAck!==null&&row.before!==lastAck||row.guests?.length!==1||
      row.guests.some(g=>g.requested!==64||g.ran!==64||g.steps!==row.steps||!g.running||!g.frozen||g.tickMs!==16||g.error||g.timedOut))throw Error('bad/nonconsecutive ACK');
     lastAck=row.steps;
    }else if(row.kind==='capture'){
     if(!/^[a-f0-9]{64}$/.test(row.sha256||'')||lastAck!==null&&row.steps!==lastAck)throw Error('stale capture state');
    }else if(!['begin','failed','success'].includes(row.kind))throw Error('unsupported annotation');
    emit('host-annotation',{annotation:row});if(row.kind==='failed')finish('command-failed');
   }catch(error){fail(error);}return report;}
  };
 }
 function installPreload(options={}){
  if(typeof document!=='undefined')throw Error('owning Worker only');
  const realmURL=options.realmURL||globalThis.location?.href;
  if(realmURL!==options.expectedWorkerURL)throw Error('wrong Worker realm');
  const instantiate=WebAssembly.instantiate,entries=[];let incoming=null,closed=false;
  (options.listen||(fn=>addEventListener('message',fn)))(event=>{
   const m=event.data;if(m?.t!=='init')return;
   if(incoming||entries.length){closed=true;for(const e of entries)e.observer?.finish('module-replaced');}
   incoming=m;
  });
  async function wrapped(module,imports,...rest){
   if(closed||!incoming||!(module instanceof WebAssembly.Module)||incoming.module!==module||incoming.memory!==imports.host.memory||incoming.slot!==0||incoming.endpointIdentity!==1){
    entries.push({error:'wrong original Module/memory/slot/endpoint binding'});return Reflect.apply(instantiate,this,[module,imports,...rest]);
   }
   let instance;const entry={installedBeforeInstantiation:true,slot:0,endpointIdentity:1,getExports:()=>instance?.exports};entries.push(entry);
   try{entry.observer=attach({...options,host:imports.host,getExports:entry.getExports,memory:incoming.memory,
    translate:options.translate||globalThis.memUtils?.g2w,workerSlot:0,endpointIdentity:1,workerURL:realmURL,
    deadline:performance.now()+options.deadlineEpochMs-Date.now()});}catch(error){entry.error=String(error);}
   try{const result=await Reflect.apply(instantiate,this,[module,imports,...rest]);instance=result.instance||result;return result;}
   catch(error){entry.observer?.finish('instantiation-failed');throw error;}
  }
  WebAssembly.instantiate=wrapped;
  return {entries,start(){if(closed||entries.length!==1||!entries[0].observer||entries[0].error)throw Error('single owning instance missing');return entries[0].observer.start();},
   finish(reason){closed=true;for(const e of entries)e.observer?.finish(reason);if(WebAssembly.instantiate===wrapped)WebAssembly.instantiate=instantiate;}};
 }
 return {attach,installPreload};
}
const native=observerFactory(EXE_SHA256,PINS);
function workerSource({observeSource,options}){
 const epoch=options.targetId+'/'+options.sessionId;
 let install=base.installWorker.toString();
 install=base.replaceOnce(install,"{command,kind:'begin'}","{command,kind:'begin',epoch:options.epoch}");
 install=base.replaceOnce(install,'{...row,command}','{...row,command,epoch:options.epoch}');
 return observeSource+'\n;globalThis.StrongholdNativePresetObserver=('+observerFactory.toString()+')('+JSON.stringify(EXE_SHA256)+','+JSON.stringify(PINS)+');\n;('+install+')('+JSON.stringify({...options,epoch})+');';
}
// Reuse the exact tested compile/send and target/session guards. The command
// scope now spans the one Custom Game gesture and its input-free observations.
function createAttachment(options){
 let source=base.createAttachment.toString();
 source=base.replaceOnce(source,"if(c.action!=='route-press-preset')return;","if(c.action!=='route-gesture')return;");
 const start=source.indexOf('   async success(c){'),end=source.indexOf('   retire(event)',start);
 if(start<0||end<0)throw Error('attachment success seam');
 source=source.slice(0,start)+'   async success(){},\n'+source.slice(end);
 const factory=new Function('ROOT','require','path','return ('+source+')')(path.resolve(__dirname,'..'),require,path);
 // The resolved constructor URL fix remains in force.
 const pageState=options.pageState;
 return factory({...options,pageState:async()=>{
  const s=await pageState(),m=s.main;if(!Array.isArray(m?.observation?.events))return s;
  const href=new URL(m.href);if(!['http:','https:'].includes(href.protocol))throw Error('owning page URL');
  return {...s,main:{...m,observation:{...m.observation,events:m.observation.events.map(e=>{
   if(e.kind!=='sent-module')return e;if(typeof e.workerURL!=='string'||!e.workerURL)throw Error('Worker URL missing');
   return {...e,workerURL:new URL(e.workerURL,href).href};
  })}}};
 }});
}
function assertHistoricalShell(png){
 const audit=require('./stronghold-unavailable-scene.cjs');
 if(audit.sha(audit.gamePixels(png))!==audit.SHELL)throw Error('unknown shell pixels');
}
function prepare(options){
 if(options.enabled===false)throw Error('callback observer mandatory');
 const p=original.prepare(options),q=JSON.stringify;
 p.source=base.replaceOnce(p.source,`const attachmentAPI=require(${q(require.resolve('./stronghold-preset-driver-attachment.cjs'))});`,`const attachmentAPI=require(${q(__filename)});`);
 p.source=base.replaceOnce(p.source,`const presetAttachment=require(${q(require.resolve('./stronghold-attached-original-preset-driver.cjs'))}).createAttachment(`,`const presetAttachment=attachmentAPI.createAttachment(`);
 p.source=base.replaceOnce(p.source,`observerSource:fs.readFileSync(${q(require.resolve('./stronghold-native-preset-observer.cjs'))},'utf8'),`,'');
 // No command past arrival can authorize another gesture.
 p.source=base.replaceOnce(p.source,"if(['install-native','gesture'].includes(c.action))", "if(['install-native','gesture','route-next','route-review','route-stability','route-review-preset-hover','route-press-preset','route-handoff'].includes(c.action))");
 // Retain the first shell and at most three further 256-step samples. This
 // separate terminal diagnostic branch never enters preset readiness.
 p.route=base.replaceOnce(p.route,"let continuation='choose-review'", "let shellSamples=0;let continuation='choose-review'");
 p.route=base.replaceOnce(p.route,"if(cap.scene==='actual-scene20-observation')continuation='stability';", "if(arrival===3072)fail('arrival diagnostic cap');\n   if(cap.scene==='actual-scene20-observation')fail('diagnostic scene20 observed; no readiness grant');");
 p.route=base.replaceOnce(p.route,"else if(!['choose-type-custom-hover'", `else if(cap.scene==='demo-selection-unavailable'){require(${q(__filename)}).assertHistoricalShell(cap.png);if(++shellSamples>=4)fail('bounded historical shell diagnostic complete');continuation='arrival';}\n   else if(!['choose-type-custom-hover'`);
 p.route=base.replaceOnce(p.route,"if(continuation!=='arrival'||arrival+256>3072)","if(continuation!=='arrival'||shellSamples>=4||arrival+256>3072)");
 p.evidence.callbackObserver={path:__filename,sha256:base.hash(fs.readFileSync(__filename)),offlineOnly:true,epoch:'exact target/session plus original init endpoint1',
  caps:{arrival:3072,route:4096,navigation:16384,shellSamples:4,perACK:64},runtimeQualified:false};
 p.evidence.successor.routeCompositionUnchanged=false;
 p.evidence.successor.scope='Pre-first-script owning callback diagnostic composition; no runtime qualification or preset/Start grant';
 p.evidence.compositionSHA256=base.hash(p.source);p.evidence.routeCompositionSHA256=base.hash(p.route);
 return p;
}
module.exports={EXE_SHA256,PINS,...native,observerFactory,workerSource,createAttachment,assertHistoricalShell,prepare};
