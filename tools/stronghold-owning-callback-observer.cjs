'use strict';
// Offline composition only. This module never starts a browser or a game.
const fs=require('node:fs'),path=require('node:path');
const base=require('./stronghold-preset-driver-attachment.cjs');
const original=require('./stronghold-attached-original-preset-driver.cjs');
const preset=require('./stronghold-native-preset-observer.cjs');
const EXE_SHA256=base.EXE_SHA256;
const PINS=Object.freeze([
 ...[...preset.PINS,...preset.CONTROL_PINS].map(({pc,hex})=>[pc,hex]),
 [0x424bb0,'68c0924200'],
 [0x576b9a,'391d9446fb007510391db4e4ef007508391db038d1007408391da431a401740b8b0d8c975001e82b2af7ff'],
 [0x576c51,'a1c037d100891db038d10083f8040f842d010000'],
 [0x576db6,'e8c523f7ff'],[0x576dcf,'e82c26f7ff'],
 [0x576dd6,'e8c532f7ff'],[0x576ded,'e80e26f7ff'],[0x576e30,'e85b0defff'],
 [0x4293a0,'8b0d383369008bd62bd181fad00700007e10b9000d6801893538336900e8ee0b0500'],
 // Call argument construction and post-clock block.
 [0x42a1fd,'c70584d5db0001000000'],
 [0x429af3,'33eda100fa75013bc5740648a300fa7501b9000d6801e872f60500'],
 [0x467cfd,'8b86b0000000558d54242468000000018b08528b96b4000000528d5424205250ff5114'],
 [0x467d91,'8b86b0000000558d54242468000000018b08528b96b8000000528d5424205250ff5114'],
 [0x467e28,'8b86b0000000558d54242468000000018b08528b96b4000000528d5424205250ff5114'],
 [0x467f35,'8b86b0000000558d4c242468000000018b10518b8eb4000000518d4c24205150ff5214'],
 // Original draw arithmetic, clocks, final RET and conditional surface calls.
 [0x4292c0,'83ec6853555657ff15c84158008b2d7835ef008bf0a18406ba008b0d7435ef002bc533db992bc28974241cd1f850a18006ba002bc1b980d5db00992bc2d1f85053e83abf0200a1540e69003bc30f848d000000391dfcf975010f85810000003bc3c705b038d100010000008bce7d378b2db8216900b8999999992bcdf7e9c1fa048bc2c1e81f03d0a1182e690003c23bc3a3182e69007f48891d182e6900891d540e6900eb3a8b15b8216900b8676666662bcaf7e9a1182e6900c1fa048bcac1e91f03d103c283f820a3182e69007c10c705182e690020000000891d5c37d100'],
 [0x4297aa,'892dfcf97501'],
 // Intact alternate/refresh comparisons and immediate successors. A bypass
 // requires their executed same-frame history, never just a visited target.
 [0x42971b,'33ed392d30bddb000f85db030000'],
 [0x429729,'8b15441869008bc72bc23d307500007e30a190146801893d441869003bc574146a09b9000d6801892dd8366d01e8b55e0500eb0d392dc41269007505e8561e0000392dfcf975010f847f030000'],
 [0x429ad4,'8b54241c89154c46fb00c70568e67501ffffffffff15c8415800a3b821690033ed'],
 [0x429ae8,'ff15c8415800a3b821690033ed'],
 [0x42a207,'5f5e5d5b83c468c3'],
 [0x467b90,'8b44240481ecf00700005355565733ed33ff83f8648bf1bb800000007c0a83e8648984240408000039ae900000007405bf010000003bc57403896e60392e75175f5e5dc705f40f6700010000005b81c4f0070000c20400'],
 [0x467d1d,'ff5114'],
 [0x467db1,'ff5114'],
 [0x467e48,'ff5114'],
 [0x467f55,'ff5214'],
 [0x430e10,'8b4424045383f8ff75106a006a29b95837d100e828d203005bc383f801751733dbb95837d100536a39891dbc37d100e80cd203005bc383f8020f85c60000005633db57536a14b95837d100891dd44bd100c70584f9750101000000891d7437d100e8dad10300e88582ffffb9000d6801891d542f6900e885780400b93202000033c0bfbce67501c7059014680101000000c7051813680163000000c7059c13680101000000f3ab53b9c0abdb00c705c037d1000300000066abe8729f03008bf883c9ff33c06a04f2aef7d12bf98bc18bf7bfb6e77501c1e902f3a58bc883e103f3a4b9000d6801891d74257601e80ee70400b909000000b801000000bf50f87501f3ab5f5e5bc3'],
 [0x46e050,'538b5c2408555683fb178bf17505bb290000008b44241457895e18894604ff15c84158008946088bc383e80c'],
 [0x429100,'5355b96811ba00e814820b00'],
 [0x5bd0ac,'100e4300'],
 // Only immutable descriptor fields: runtime flags/dimensions may change.
 [0x5bd13c,'a0010000c9000000'],[0x5bd150,'02000000'],[0x5bd158,'0f020000']
]);

// Serialized verbatim into the pre-instantiation owning realm. Only getters,
// the pure JS translator and original import forwarding are used here.

function cycleFactory({getExports,u32,emit,verify=()=>{},nativeEpoch=0}={}){
 let cycle=null,previous=null,reset=null,serial=0;
 const targets=new Map([
  [0x4e95f0,{name:'input-manager',caller:0x576bc5,cleanup:4}],
  [0x4e9180,{name:'scene-manager',caller:0x576dbb,cleanup:4}],
  [0x4ea0a0,{name:'post-widget',caller:0x576ddb,cleanup:4}],
  [0x467b90,{name:'presentation',caller:0x576e35,cleanup:8}],
 ]);
 function snapshot(outside=false){
  const e=getExports();
  if(!nativeEpoch||e?.pending_context_version?.()!==1||e.pending_context_callback_version?.()!==1||e.pending_context_profile?.()!==2||
   e.pending_context_image_base?.()!==0x400000||(e.pending_context_epoch?.()>>>0)!==(nativeEpoch>>>0)||
   (outside?e.pending_context_status(nativeEpoch):e.pending_context_coverage(nativeEpoch))!==1){
   const error=Error('Stronghold continuous profile/image/epoch coverage unavailable');
   error.nativeCoverage={expected:{profile:2,imageBase:0x400000,nativeEpoch:nativeEpoch>>>0,callbackVersion:1},
    actual:{profile:e?.pending_context_profile?.()??null,imageBase:e?.pending_context_image_base?.()??null,
     nativeEpoch:e?.pending_context_epoch?.()>>>0,callbackVersion:e?.pending_context_callback_version?.()??null,
     reason:e?.pending_context_reason?.()??null,depth:e?.pending_context_depth?.()??null},
    firstNativeFailure:e?.pending_context_first_failure_version?.()===1&&e.pending_context_first_failure(0)!==0?
     {version:1,words:Array.from({length:36},(_,i)=>e.pending_context_first_failure(i)>>>0)}:null};
   throw error;
  }
  const depth=e.pending_context_depth()>>>0;if(depth>64)throw Error('native depth bound');
  const entries=[];for(let i=0;i<depth;i++)entries.push({target:e.pending_context_entry(i,0)>>>0,
   caller:e.pending_context_entry(i,1)>>>0,esp:e.pending_context_entry(i,2)>>>0});
  return {profile:2,imageBase:0x400000,nativeEpoch:nativeEpoch>>>0,valid:1,
   reason:e.pending_context_reason()>>>0,callbackHistory:{version:1,entries:e.pending_context_callback_entries()>>>0,returns:e.pending_context_callback_returns()>>>0},entries,pc:e.get_eip()>>>0,esp:e.get_esp()>>>0};
 }
 function state(){return cycle?JSON.parse(JSON.stringify(cycle)):null;}
 function boundary(pc,esp){
  if(!nativeEpoch)return;
  const e=getExports(),native=snapshot(),zero=e.get_ebx()>>>0;
  if(pc===0x576b9a){
   verify();
   cycle={id:++serial,entryPC:pc,esp,gate:{operands:[0xfb4694,0xefe4b4,0xd138b0,0x1a431a4].map(u32),
    manager:u32(0x150978c),successors:[],admitted:null,returned:false},reset:false,
    sceneManager:null,widget0:null,postWidget:null,widget3:null,presentation:null,active:null,
    phase:'input-gate',complete:false,readinessGranted:false,pixelsAccepted:false};
   if(zero!==0)throw Error('gate EBX owner mismatch');
   cycle.gate.expected=cycle.gate.operands[0]!==0?0x576bb2:0x576ba2;
   emit('cycle-entry',{cycle:state(),native});
  }else if(cycle&&cycle.gate.expected===pc){
   if(zero!==0||esp!==cycle.esp)throw Error('gate successor owner mismatch');
   const g=cycle.gate;g.successors.push(pc);
   if(pc===0x576ba2)g.expected=g.operands[1]!==0?0x576bb2:0x576baa;
   else if(pc===0x576baa)g.expected=g.operands[2]===0?0x576bba:0x576bb2;
   else if(pc===0x576bb2)g.expected=g.operands[3]===0?0x576bc5:0x576bba;
   else if(pc===0x576bba){g.expected=null;g.admitted=true;}
   else if(pc===0x576bc5){g.expected=null;g.admitted=false;g.returned=true;cycle.phase='before-reset';}
   emit('input-gate-successor',{cycleId:cycle.id,successor:pc,gate:JSON.parse(JSON.stringify(g)),native});
  }
  if(!cycle){previous=pc;return;}
  // The reset store is inside the executed block beginning at 576c51.
  // Its comparison can branch to either successor; the address alone is
  // never treated as proof that the store executed.
  if(reset){
   if(![0x576c65,0x576d92].includes(pc)||esp!==reset.esp||zero!==0||u32(0xd138b0)!==0)
    throw Error('suppression reset successor missing');
   cycle.reset=true;cycle.resetReceipt={entry:reset.pc,successor:pc,esp,before:reset.before,after:0};
   reset=null;cycle.phase='after-reset';emit('cycle-reset',{cycleId:cycle.id,reset:cycle.resetReceipt,native});
  }
  if(pc===0x576c51||pc===0x576c56){
   if(!cycle.gate.returned||esp!==cycle.esp||zero!==0)throw Error('reset gate/frame history missing');
   reset={pc,esp,before:u32(0xd138b0)};
  }
  const active=cycle.active;
  if(active&&pc===active.caller){
   if(esp!==active.esp+active.cleanup||native.entries.some(f=>f.target===active.target&&f.esp===active.esp))
    throw Error('cycle native checked return missing');
   active.returned=true;active.returnPC=pc;active.returnESP=esp;
   emit('cycle-pass-return',{cycleId:cycle.id,pass:{...active},native});cycle.active=null;
   if(active.name==='input-manager'){cycle.gate.returned=true;cycle.phase='before-reset';}
   if(active.name==='presentation'){cycle.complete=true;cycle.phase='completed';}
  }
  let spec=targets.get(pc);
  if(pc===0x4e9400){const caller=u32(esp);spec=caller===0x576dd4?{name:'widget0',caller,cleanup:8}:
   caller===0x576df2?{name:'widget3',caller,cleanup:8}:null;}
  if(spec&&u32(esp)===spec.caller){
   verify();
   if(cycle.active)throw Error('cycle pass return missing');
   const top=native.entries.at(-1);
   if(!top||top.target!==pc||top.esp!==esp||top.caller!==spec.caller)throw Error('cycle native entry missing');
   const manager=e.get_ecx()>>>0;
   if(spec.name==='input-manager'){
    if(cycle.gate.admitted!==true||manager!==cycle.gate.manager)throw Error('input gate/manager missing');
   }else{
    if(!cycle.reset)throw Error('cycle reset missing');
    const checks={widget0:cycle.sceneManager?.returned, 'post-widget':cycle.widget0?.returned,
     widget3:cycle.postWidget?.returned,presentation:cycle.widget3?.returned};
    if(spec.name in checks&&!checks[spec.name])throw Error('cycle prior pass missing');
    if(['widget0','widget3','post-widget'].includes(spec.name)&&manager!==u32(0x150978c))
     throw Error('widget manager owner mismatch');
   }
   const pass={...spec,target:pc,entryPC:pc,esp,entryESP:esp,callerESP:esp+4,manager,sceneManagerHead:u32(0x995694),returned:false};cycle.active=pass;cycle.phase=spec.name;
   const key={'scene-manager':'sceneManager','post-widget':'postWidget','input-manager':'inputManager'}[spec.name]||spec.name;
   cycle[key]=pass;emit('cycle-pass-entry',{cycleId:cycle.id,pass:{...pass},native});
  }
  if(pc===0x4292c0&&cycle.active?.name==='scene-manager'){
   const top=native.entries.at(-1);
   if(!top||top.target!==pc||top.esp!==esp||top.caller!==u32(esp))throw Error('cycle native draw entry missing');
   cycle.draw={entryPC:pc,entryESP:esp,caller:u32(esp),callerESP:esp+4,returned:false};
   emit('cycle-draw-entry',{cycleId:cycle.id,draw:{...cycle.draw},native});
  }else if(cycle.draw&&!cycle.draw.returned&&pc===cycle.draw.caller){
   if(esp!==cycle.draw.entryESP+4||native.entries.some(f=>f.target===0x4292c0&&f.esp===cycle.draw.entryESP))throw Error('cycle draw return ESP mismatch');
   cycle.draw.returned=true;cycle.draw.returnESP=esp;cycle.draw.returnPC=pc;
   emit('cycle-draw-return',{cycleId:cycle.id,draw:{...cycle.draw},native});
  }
  previous=pc;
 }
 function receipt(){
  if(!nativeEpoch)return null;
  verify();
  const native=snapshot(true),c=state();
  // Complete provenance can describe an in-progress pass. A pending native
  // entry alone cannot do so: the independent gate/reset/scene history and
  // exact observed frame must also be present.
  const tracked=c?.active&&native.entries.some(f=>f.target===c.active.target&&f.caller===c.active.caller&&f.esp===c.active.esp);
  const inProgress=!!(c?.reset&&c.gate.returned&&c.sceneManager&&c.draw&&tracked&&
   ['scene-manager','widget0','post-widget','widget3','presentation'].includes(c.phase));
  return {native,cycle:c,status:inProgress?'owning-setup-in-progress':c?.complete?'cycle-completed':'unknown',
   readinessGranted:false,pixelsAccepted:false,gameplay:false};
 }
 return {boundary,snapshot,receipt,state};
}

function observerFactory(EXE_SHA256,PINS,controlFactory=preset.controlFactory,makeCycle=cycleFactory){
 const occupied=new WeakSet();
 // Fixed continuous limits; isolated render cost never proves full-draw
 // completion or remaining headroom. Blocks are counted, not stored.
 function attach({host,getExports,translate,memory,workerSlot,endpointIdentity,epoch,
   exeSha256,wasmSha256,workerURL,expectedWorkerURL,deadline,now=()=>performance.now(),
   nativeEpoch=0,maxMs=360000,maxRecords=2048,maxBytes=1048576,maxBoundaries=50000000}={}){
  if(workerSlot!==0||endpointIdentity!==1||exeSha256!==EXE_SHA256||!(/^[a-f0-9]{64}$/).test(wasmSha256||'')||
    !workerURL||workerURL!==expectedWorkerURL||typeof epoch!=='string'||!epoch||epoch.length>256)
   throw Error('wrong binding/epoch');
  if(typeof host?.log_block!=='function'||typeof getExports!=='function'||typeof translate!=='function'||
    !memory?.buffer||occupied.has(host))throw Error('missing/occupied owning imports or memory');
  for(const [key,value,cap]of [['maxMs',maxMs,360000],['maxRecords',maxRecords,4096],['maxBytes',maxBytes,2097152],['maxBoundaries',maxBoundaries,50000000]])
   if(!Number.isSafeInteger(value)||value<1||value>cap)throw Error('invalid '+key);
  if(!Number.isFinite(deadline)||deadline<=now())throw Error('original deadline');
  const prior=host.log_block,frames=[],rows=[],restores=[];let ex=null,buffer=memory.buffer,active=false,timer,end=deadline;
  let command=null,event=null,lastAck=null,custom=null,draw=null,surface=null,lastDraw=null,previousPC=null;
  const report={version:1,status:'installed',epoch,nativeEpoch,workerSlot,endpointIdentity,exeSha256,wasmSha256,workerURL,
   records:rows,bytes:0,sequence:0,blocks:0,lastNativePC:null,fault:null,pending:[],
   limits:{maxMs,maxRecords,maxBytes,maxBoundaries},
   presentation:{status:'pending',hostRelation:null,readinessGranted:false},
   evidence:'Owning WASM block entries and saved-return intervals. Draw and conditional surface observations never certify host presentation or pixels. Input annotations are host receipts, not guest dispatch proof.'};
  function finish(reason='explicit-stop'){
   if(!['installed','running'].includes(report.status))return report;
   active=false;clearTimeout(timer);report.status=reason;report.pending=[...frames.map(f=>({...f})),...(draw?[{name:'draw',...draw}]:[]),...(surface?[{name:'surface',...surface}]:[]),...controls.pending()];
   if(host.log_block===wrapped)host.log_block=prior;for(const restore of restores)restore();occupied.delete(host);return report;
  }
  function fail(error){if(!report.fault){report.fault=String(error.message||error);if(error.nativeCoverage)report.coverageFailure=error.nativeCoverage;}return finish('unsupported-or-unobservable');}
  function read(a,n=4){
   if(!Number.isSafeInteger(a)||a<=0||!Number.isSafeInteger(n)||n<1||n>512||a+n>0x100000000)throw Error('invalid native read');
   const bytes=new Uint8Array(buffer),out=[];
   for(let i=0;i<n;i++){const p=translate(a+i,0x400000,memory)>>>0;
    if(p===0xf0||p>=bytes.length)throw Error('unmapped native read');out.push(bytes[p]);}
   return out;
  }
  const u32=a=>{const b=read(a);return(b[0]+b[1]*256+b[2]*65536+b[3]*16777216)>>>0;};
  const surfaceReturns={0x467cfd:0x467d20,0x467d91:0x467db4,0x467e28:0x467e4b,0x467f35:0x467f58};
  const drawPhases=[0x4292cd,0x429306,0x4293c2,0x429aee,0x429b0e];
  function identity(){
   const e=getExports();if(!e||ex&&e!==ex||e.memory!==memory||memory.buffer!==buffer)throw Error('foreign instance/memory');ex=e;
   if(e.get_current_thread_id()!==1||e.get_image_base()!==0x400000)throw Error('foreign thread/loader');
   if(u32(0x40003c)!==0x118||u32(0x400118)!==0x4550||u32(0x40014c)!==0x400000||u32(0x400168)!==0x199e000)throw Error('original header mismatch');
  }
  function signatures(){for(const [pc,hex]of PINS)if(read(pc,hex.length/2).map(v=>v.toString(16).padStart(2,'0')).join('')!==hex)throw Error('original bytes mismatch');}
  const state=()=>({currentScene:u32(0xd13764),requestedScene:u32(0xd13770),manager4:u32(0xd1375c),manager8:u32(0xd13760),mode:u32(0x1681318),saved:u32(0x690f7c),
   fade692e18:u32(0x692e18),direction690e54:u32(0x690e54)|0,timestamp6921b8:u32(0x6921b8),refresh175f9fc:u32(0x175f9fc),inputSuppressiond138b0:u32(0xd138b0),...controls.state()});
  function emit(kind,extra={}){
   const row={kind,sequence:report.sequence+1,block:report.blocks,epoch,command,pc:ex.get_eip()>>>0,esp:ex.get_esp()>>>0,state:state(),...extra};
   // UTF-8 byte accounting, including non-ASCII annotations.
   const size=new TextEncoder().encode(JSON.stringify(row)).length;
   if(rows.length>=maxRecords||report.bytes+size>maxBytes)throw Error('record/byte overflow');
   rows.push(row);report.bytes+=size;report.sequence++;
  }
  const controls=controlFactory({read,u32,getExports:()=>ex,emit,sequence:()=>report.sequence,signatures});
  const cycle=makeCycle({getExports:()=>ex,u32,emit,verify:signatures,nativeEpoch});
  function live(){if(!active)return false;if(now()>=end)throw Error('original observer deadline');identity();if(host.log_block!==wrapped)throw Error('import owner replaced');return true;}
  function drawFrame(esp){
   if(esp!==draw.esp-120||u32(draw.esp)!==draw.caller)throw Error('draw frame stack/caller mismatch');
   if(u32(0xd13764)!==20||u32(0xd13770)!==20)throw Error('foreign draw scene owner');
  }
  function drawing(pc,esp,entryEvidence='block-entry'){
   if(pc===0x4292c0){
    signatures();if(draw||surface)throw Error('missing draw/surface return');
    const s=state();if(s.currentScene!==20||s.requestedScene!==20)throw Error('foreign draw scene owner');
    const caller=u32(esp);if(!caller)throw Error('draw saved return missing');
    emit('draw-entry',{caller});draw={caller,esp,entrySequence:report.sequence,phase:0,entryTimestamp:s.timestamp6921b8,clockTarget:u32(0x5841c8)};lastDraw=null;
   }
   if(draw){
    if(draw.branch){
     const branch=draw.branch;drawFrame(esp);signatures();
     if(pc!==branch.target||u32(branch.operand)!==branch.value||(ex.get_ebp()>>>0)!==0)throw Error('draw branch provenance mismatch');
     emit('draw-branch',{entrySequence:draw.entrySequence,...branch});draw.branch=null;
     if(branch.source===0x42976a||pc===0x429b04){draw.clockPath=branch.path;
      if(branch.path!=='late'){draw.bypass=branch;emit('draw-clock-bypass',{entrySequence:draw.entrySequence,...branch});}}
     else draw.alternatePassed=true;
    }
    if(pc===0x42971b||pc===0x42971d||pc===0x42976a){
     drawFrame(esp);signatures();if(draw.phase!==3||draw.clockPath||pc===0x42976a&&!draw.alternatePassed||pc!==0x42971b&&(ex.get_ebp()>>>0)!==0)throw Error('draw branch history missing');
     const refresh=pc===0x42976a,operand=refresh?0x175f9fc:0xdbbd30,value=u32(operand);
     const target=refresh?(value===0?0x429af5:0x429776):(value===0?0x429729:0x429b04);
     draw.branch={source:pc,target,operand,value,path:refresh?(value===0?'refresh-zero':'late'):(value===0?'alternate-not-taken':'alternate')};
    }
    if(pc===0x429729&&!draw.alternatePassed||pc===0x429776&&draw.clockPath!=='late'||
      pc===0x429af5&&draw.clockPath!=='refresh-zero'&&draw.phase!==4||pc===0x429b04&&!draw.bypass&&draw.phase!==4)throw Error('draw branch provenance missing');
    // Native API thunks dispatch before log_block. For those, the preceding
    // pinned CALL block is the witness. A normal x86 target additionally owns
    // its saved return/stack across any number of queued slices and blocks.
    if(pc===draw.clockTarget&&(draw.phase===0||draw.phase===3&&draw.clockPath==='late')){
     const ret=u32(esp),expected=draw.phase===0?0x4292cd:0x429aee;
     if(ret===expected){
      const sources=draw.phase===0?[0x4292c0]:[0x429ad4,0x429ade,0x429ae8];
      if(esp!==draw.esp-124||!sources.includes(previousPC))throw Error('draw clock CALL history missing');
      signatures();draw.clockCall={ret,esp};
     }
    }
    const index=drawPhases.indexOf(pc);
    if(index>=0){
     drawFrame(esp);
     const bypass=index===4&&draw.phase===3&&draw.bypass;
     if(index!==draw.phase&&!bypass)throw Error('draw clock/update/return history missing at '+pc.toString(16)+' phase '+draw.phase);
     if(index===0||index===3){
      signatures();const sources=index===0?[0x4292c0]:[0x429ad4,0x429ade,0x429ae8];
      if((index===3&&draw.clockPath!=='late')||(draw.clockCall?draw.clockCall.ret!==pc||esp!==draw.clockCall.esp+4:!sources.includes(previousPC)))throw Error('draw clock CALL/return history missing');
      draw.clockCall=null;
     }
     if(index===0){draw.entryTime=ex.get_eax()>>>0;}
     if(index===3){draw.lateTime=ex.get_eax()>>>0;}
     if(index===4&&u32(0x6921b8)!==(bypass?draw.entryTimestamp:draw.lateTime))throw Error('draw '+(bypass?'preserved':'late')+' timestamp mismatch');
     emit(bypass?'draw-timestamp-preserved':['draw-entry-clock','draw-update-before','draw-update-after','draw-late-clock','draw-timestamp-stored'][index],
      {entrySequence:draw.entrySequence,entryTime:draw.entryTime,lateTime:draw.lateTime,clockPath:draw.clockPath});draw.phase=index+1;
    }
    if(pc===0x42a1fd||pc===0x42a207){
     drawFrame(esp);signatures();if(draw.phase!==5||draw.branch||draw.clockCall)throw Error('draw epilogue stack/history mismatch');
     draw.epilogue=true;emit('draw-return-block',{entrySequence:draw.entrySequence,retPC:0x42a20e});
    }
    if(pc===0x4297b0)emit('draw-refresh-cleared',{entrySequence:draw.entrySequence});
    if(pc===draw.caller){
     if(draw.phase!==5||!draw.epilogue||esp!==draw.esp+4)throw Error('draw return history missing');
     emit('draw-return',{entrySequence:draw.entrySequence,entryTime:draw.entryTime,lateTime:draw.lateTime,clockPath:draw.clockPath});
     lastDraw=report.sequence;draw=null;
    }
   }else if(drawPhases.includes(pc)||[0x42971b,0x42971d,0x429729,0x42976a,0x429776,0x429af5,0x429b04,0x42a1fd,0x42a207].includes(pc))throw Error('draw entry history missing');
   // These are candidate native operations after a completed draw. No claim
   // ties their surfaces to the host canvas, ACK or captured pixels.
   if(surface){
    if(pc===surface.caller){
     if(esp!==surface.esp+28)throw Error('surface return stack mismatch');
     emit('surface-return',{...surface,result:ex.get_eax()>>>0,hresultZero:(ex.get_eax()>>>0)===0});surface=null;
    }
   }
   const surfaceReturn=surfaceReturns[previousPC];
   if(surfaceReturn){
    signatures();if(surface||draw)throw Error('surface nesting/draw incomplete');
    const caller=u32(esp);if(caller!==surfaceReturn)throw Error('surface saved return missing');
    const callPC=caller-3,vtable=(callPC===0x467f55?ex.get_edx():ex.get_ecx())>>>0,object=u32(esp+4),target=u32(vtable+0x14);
    if(!object||u32(object)!==vtable||pc!==target)throw Error('surface identity missing '+JSON.stringify({pc,target,vtable,object,objectVtable:object?u32(object):null}));
    surface={callPC,caller,esp,target,vtable,object,source:u32(esp+12),manager:ex.get_esi()>>>0,
     precedingDrawReturn:lastDraw};emit('surface-target-entry',{...surface,entryEvidence});
    surface.entrySequence=report.sequence;
   }
   previousPC=pc;
  }
  function boundary(pc,esp){
   if(!live())return;pc>>>=0;esp>>>=0;
   if(++report.blocks>maxBoundaries)throw Error('boundary overflow');
   report.lastNativePC=pc;
   if(pc!==(ex.get_eip()>>>0)||esp!==(ex.get_esp()>>>0))throw Error('wrong block registers');
   controls.boundary(pc,esp);
   drawing(pc,esp);
   cycle.boundary(pc,esp);
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
   // An import exception unwinds the enclosing native run immediately. Merely
   // recording the fault would execute an unobserved remainder of that run.
   catch(error){fail(error);throw error;}
   try{return Reflect.apply(prior,this,[pc,esp,...rest]);}catch(error){fail(error);throw error;}
  }
  host.log_block=wrapped;occupied.add(host);
  // Installed before instantiation/startup, and independent of block tracing.
  // Native captures the immutable words before its first reason store; this
  // synchronous import adds the actual Wasm caller/offset and host UTC. It
  // grants no coverage/readiness and never changes ordinary execution.
  const priorI32=host.log_i32;
  if(typeof priorI32==='function'){
   function firstFailure(value,...rest){
    if((value>>>0)===0x504e4631&&!report.firstNativeFailure){
     try{
      const e=getExports();
      if(e?.pending_context_first_failure_version?.()===1&&e.pending_context_first_failure(0)!==0)
       report.firstNativeFailure={version:1,at:new Date().toISOString(),
        stack:String(new Error('first native coverage invalidation').stack),
        words:Array.from({length:36},(_,i)=>e.pending_context_first_failure(i)>>>0)};
     }catch(error){report.firstNativeFailureCaptureError=String(error);}
    }
    return Reflect.apply(priorI32,this,[value,...rest]);
   }
   host.log_i32=firstFailure;restores.push(()=>{if(host.log_i32===firstFailure)host.log_i32=priorI32;});
  }
  // Observe the actual owning import call, before RPC filtering/coalescing.
  // RPC upload's synthetic 1 is only a queued request, never host completion.
  for(const name of ['dx_trace','gdi_surface_attach','gdi_surface_upload']){
   const fn=host[name];if(typeof fn!=='function')continue;
   function hook(...args){
    // API thunks are dispatched before log_block in $run. The first actual
    // import still exposes the current dispatch thunk and saved CALL. EIP
    // may still name the CALL block on the cached fast path. Do
    // not fabricate a block entry or increment the boundary counter.
    if(active&&!surface&&surfaceReturns[previousPC])try{
     if(live()){
      const thunk=ex.com_callback_get_thunk?.()>>>0;
      const target=thunk&&(ex.thunk_word?.(thunk,0)>>>0)===0xcaca0010&&ex.thunk_word(thunk,1)===1006?thunk:ex.get_eip()>>>0;
      drawing(target,ex.get_esp()>>>0,'owning-import-entry');
     }
    }catch(error){fail(error);}
    const current=active&&surface?{...surface}:null;
    let result;try{result=Reflect.apply(fn,this,args);}catch(error){throw error;}
    if(current)try{
     if(!live())return result;
     const slot=u32(current.object+4),sourceSlot=current.source?u32(current.source+4):null;
     emit('surface-import-request',{entrySequence:current.entrySequence,name,args:args.slice(0,5),slot,sourceSlot,
      result:typeof result==='number'?result:null,completion:'unknown; original import may enqueue RPC'});
    }catch(error){fail(error);}
    return result;
   }
   host[name]=hook;restores.push(()=>{if(host[name]===hook)host[name]=fn;});
  }
  return {report,finish,
   nativeReceipt(){try{if(!live())return null;const value=cycle.receipt();report.nativeObservation=value;return value;}catch(error){fail(error);return null;}},
   start(){if(report.status!=='installed')throw Error('observer terminal');try{identity();signatures();end=Math.min(deadline,now()+maxMs);active=true;report.status='running';emit('baseline');
    timer=setTimeout(()=>fail(Error('original observer deadline')),Math.max(1,end-now()));timer.unref?.();}catch(error){fail(error);}return report;},
   check(){try{if(live()&&!report.blocks)throw Error('missing trace records');}catch(error){fail(error);}return report;},
   assertLive(){try{live();}catch(error){fail(error);}return report;},
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
    const nativeReceipt=['ACK','capture'].includes(row.kind)?cycle.receipt():null;
    if(nativeReceipt)report.nativeObservation=nativeReceipt;
    emit('host-annotation',{annotation:row,nativeReceipt,...(row.kind==='ACK'?{lastNativePC:report.lastNativePC,
     nativeFrames:[...frames.map(f=>({...f})),...(draw?[{name:'draw',...draw}]:[]),...(surface?[{name:'surface',...surface}]:[]),...controls.pending()]}:{})});if(row.kind==='failed')finish('command-failed');
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
   try{const result=await Reflect.apply(instantiate,this,[module,imports,...rest]);instance=result.instance||result;
    const e=instance.exports;
    if(e.pending_context_callback_version?.()!==1||!Number.isInteger(options.nativeEpoch)||options.nativeEpoch<=0||options.nativeEpoch>0xffffffff||
     e.pending_context_arm_profile?.(options.nativeEpoch,2,0x400000)!==1)
     throw Error('pre-execution Stronghold native profile arm failed');
    return result;}
   catch(error){entry.observer?.finish('instantiation-failed');throw error;}
  }
  WebAssembly.instantiate=wrapped;
  return {entries,start(){if(closed||entries.length!==1||!entries[0].observer||entries[0].error)throw Error('single owning instance missing');return entries[0].observer.start();},
   finish(reason){closed=true;for(const e of entries)e.observer?.finish(reason);if(WebAssembly.instantiate===wrapped)WebAssembly.instantiate=instantiate;}};
 }
 return {attach,installPreload};
}
const native=observerFactory(EXE_SHA256,PINS);
// Serialized into the page only after exact owning Worker discovery. This
// observes normal calls; it never schedules a present, flush or readback.
function hostPresentationFactory(){
 const occupied=new WeakSet();
 function attach({getHost,epoch,nativeBinding=null,deadline,now=()=>performance.now(),maxRecords=2048,maxBytes=1048576}={}){
  if(typeof getHost!=='function'||typeof epoch!=='string'||!epoch||epoch.length>256||
   !Number.isFinite(deadline)||deadline<=now()||!Number.isSafeInteger(maxRecords)||maxRecords<1||maxRecords>2048||
   !Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1048576)throw Error('host presentation binding/limits');
  deadline=Math.min(deadline,now()+360000);
  const owner=getHost(),memory=owner?.memory,renderer=owner?.renderer,gdi=owner?.hostCtx?.sharedGdi,
   imports=owner?._hostImports,broker=owner?.guestWorker?.broker;
  if(!memory?.buffer||!renderer?.ctx||!gdi?.surfacePresentations||!imports||!broker||occupied.has(owner))throw Error('host presentation unavailable/occupied');
  const hostContext=owner.hostCtx,instance=owner.instance,processId=owner.processId,rendererContext=renderer.ctx;
  const guest=owner.guestWorker,link=guest?.link,worker=link?.worker,module=guest?.module;
  const strictBinding=()=>!!nativeBinding&&Number.isInteger(nativeBinding.nativeEpoch)&&nativeBinding.nativeEpoch>0&&
   nativeBinding.nativeEpoch<=0xffffffff&&/^[a-f0-9]{64}$/.test(nativeBinding.exeSha256)&&/^[a-f0-9]{64}$/.test(nativeBinding.wasmSha256)&&
   new URL(link.workerUrl,globalThis.location?.href||nativeBinding.workerURL).href===nativeBinding.workerURL&&
   nativeBinding.workerSlot===0&&nativeBinding.endpointIdentity===1&&link?.slot===0&&link.endpointIdentity===1&&
   guest.memory===memory&&link.memory===memory&&link.module===module&&module instanceof WebAssembly.Module&&
   !!worker&&!guest._stopped&&!guest._stopping&&!link._stopped&&!link._stopping;
  if(nativeBinding&&!strictBinding())throw Error('host native binding unavailable');
  const buffer=memory.buffer,restores=[],guards=[],accessorGuards=[],ids=new WeakMap();let nextId=0,slot=null,frame=null,timer;
  const id=o=>o&&typeof o==='object'?(ids.has(o)?ids.get(o):(ids.set(o,++nextId),nextId)):null;
  const ownsWindow=win=>!!win&&!!owner.instance&&win.wasm===owner.instance&&win.wasmMemory===memory&&
   Number.isSafeInteger(owner.processId)&&owner.processId>0&&win.processId===owner.processId;
  const report={epoch,nativeBinding,bindingValid:strictBinding(),limits:{maxRecords,maxBytes},status:'running',records:[],bytes:0,sequence:0,frame:0,pending:0,fault:null,
   readinessGranted:false,pixelsAccepted:false,operationRelation:null};
  function finish(reason='terminal'){
   if(report.status!=='running')return report;report.status=reason;clearTimeout(timer);
   for(const restore of restores.reverse())restore();occupied.delete(owner);return report;
  }
  function fault(e){report.fault=String(e.message||e);finish('unsupported-or-unobservable');}
  function live(){if(report.status!=='running')return false;
   if(now()>=deadline)throw Error('host presentation deadline');
   if(getHost()!==owner||owner.memory!==memory||memory.buffer!==buffer||owner.renderer!==renderer||
    owner.hostCtx.sharedGdi!==gdi||owner._hostImports!==imports||owner.guestWorker?.broker!==broker||
    guards.some(([o,k,f])=>o[k]!==f)||accessorGuards.some(([o,k,g,s])=>{const d=Object.getOwnPropertyDescriptor(o,k);return d?.get!==g||d?.set!==s;})||owner.hostCtx!==hostContext||owner.instance!==instance||owner.processId!==processId||renderer.ctx!==rendererContext||nativeBinding&&(!strictBinding()||owner.guestWorker!==guest||guest.link!==link||link.worker!==worker||guest.module!==module))throw Error('host presentation owner replaced');
   return true;
  }

  const fallback=gdi.fallbackObservation;
  const selected=new Map(),mutations=new WeakMap(),filters=new WeakMap();let published=null;
  const dimensions=c=>c?[c.width,c.height]:null;
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function currentCopy(c){
   if(!fallback||owner.hostCtx.sharedGdi.fallbackObservation!==fallback||!c||
    c.memory!==buffer||!Number.isSafeInteger(c.surface.bytes)||c.surface.bytes<1||c.surface.dibWa+c.surface.bytes>buffer.byteLength||!ownsWindow(c.window)||renderer.windows[c.hwnd]!==c.window||
    !c.window.visible||!same(dimensions(c.destination),c.dimensions)||
    (mutations.get(c.destination)?.generation??0)!==c.destinationGeneration||
    (c.layer?c.window._dxFrameLayer!==c.layer||c.layer.canvas!==c.destination:c.window._backCanvas!==c.destination))return false;
   const s=fallback.current(c.surface.slot);
   return !!s&&s.memory===buffer&&s.allocationGeneration===c.allocationGeneration&&
    ['slot','w','h','bpp','pitch','dibWa','flags'].every(k=>s[k]===c.surface[k])&&c.allocationGeneration>0;
  }
  function selectedRow(c){return {copyGeneration:c.copyGeneration,allocationGeneration:c.allocationGeneration,
   slot:c.surface.slot,storageOffset:c.surface.dibWa,bytes:c.surface.bytes,width:c.surface.w,height:c.surface.h,
   pitch:c.surface.pitch,bpp:c.surface.bpp,hwnd:c.hwnd,window:id(c.window),layer:id(c.layer),
   primary:!!(c.surface.flags&1),flags:c.surface.flags,explicitPrimarySlot:c.explicitPrimarySlot,
   destinationCanvas:id(c.destination),destinationGeneration:c.destinationGeneration,destinationDimensions:c.dimensions,clipped:c.clipped,clip:c.clip,
   frozenSteps:c.policy?.frozenSteps??null,policy:c.policy,owningMemory:c.memory===buffer,
   owningWindow:ownsWindow(c.window),partialWritePossible:!!(c.policy?.localLocks||c.policy?.sharedLocks),
   current:currentCopy(c)};}
  function captureCopy(){
   if(!published||published.frame!==report.frame||!currentCopy(published.copy))return null;
   if((renderer._immutablePublicationSequence||0)!==published.frame||
    published.output!==((published.backend==='logical-canvas'||published.backend==='direct-canvas')?renderer.canvas:renderer.presentationCanvas)||
    !same(published.dimensions,dimensions(published.output))||
    published.filter!==renderer.presentationFilter||published.scaleMode!==renderer.presentationScaleMode||
    (published.outputGeneration!==null&&(mutations.get(published.output)?.generation??0)!==published.outputGeneration)||
    (published.filterGeneration!==null&&(filters.get(published.filter)?.generation??0)!==published.filterGeneration))return null;
   return published.copy;
  }
  function watchDestination(canvas){
   if(mutations.has(canvas))return mutations.get(canvas);
   const context=canvas.getContext?.('2d');if(!context)throw Error('selected destination is unobservable');
   const state={generation:0};mutations.set(canvas,state);
   // Setting width/height to the SAME value clears a canvas too. A dimensions
   // comparison alone misses that lifetime change; forward the exact setter.
   for(const key of ['width','height']){
    const own=Object.getOwnPropertyDescriptor(canvas,key);let p=canvas,descriptor;
    while(p&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(p,key);p=Object.getPrototypeOf(p);}
    if(!descriptor?.get||!descriptor.set||own?.configurable===false)throw Error('canvas resize is unobservable');
    const get=function(){return Reflect.apply(descriptor.get,this,[]);};
    const set=function(value){const result=Reflect.apply(descriptor.set,this,[value]);state.generation++;return result;};
    Object.defineProperty(canvas,key,{get,set,configurable:true,enumerable:descriptor.enumerable});accessorGuards.push([canvas,key,get,set]);
    restores.push(()=>{const current=Object.getOwnPropertyDescriptor(canvas,key);if(current?.get===get&&current?.set===set){if(own)Object.defineProperty(canvas,key,own);else delete canvas[key];}});
   }
   for(const key of ['putImageData','drawImage','fillRect','clearRect','strokeRect','fill','stroke','fillText','strokeText','reset']){
    if(typeof context[key]==='function')hook(context,key,null,()=>{state.generation++;});
   }
   return state;
  }
  function emit(kind,data={}){
   if(!live())return;const row={kind,epoch,sequence:report.sequence+1,...data};
   const bytes=new TextEncoder().encode(JSON.stringify(row)).length;
   if(report.records.length>=maxRecords||report.bytes+bytes>maxBytes)throw Error('host presentation record/byte overflow');
   report.records.push(row);report.bytes+=bytes;report.sequence++;
  }
  function observe(fn){try{if(live())return fn();}catch(e){fault(e);}}
  function hook(object,key,before,after){
   const original=object[key];if(typeof original!=='function')return;
   function wrapped(...args){
    const context=observe(()=>before?.(args));let value;
    try{value=Reflect.apply(original,this,args);}catch(error){if(key==='repaint')frame=null;observe(()=>emit('call-failed',{method:key}));throw error;}
    if(report.status!=='running')return value;
    // Return the very same Promise/result. Completion observers never replace
    // the original rejection, result or receiver, including after uninstall.
    if(value instanceof Promise){if(report.pending>=16){fault(Error('host async pending bound'));return value;}report.pending++;
     value.then(v=>{report.pending--;observe(()=>after?.(args,v,context));},()=>{report.pending--;if(key==='repaint')frame=null;observe(()=>emit('call-failed',{method:key}));});
    }else observe(()=>after?.(args,value,context));
    return value;
   }
   for(let i=guards.length-1;i>=0;i--)if(guards[i][0]===object&&guards[i][1]===key)guards.splice(i,1);
   object[key]=wrapped;guards.push([object,key,wrapped]);restores.push(()=>{if(object[key]===wrapped)object[key]=original;});
  }
  // The broker supplies the actual endpoint slot. A batch can contain calls
  // from only its stated slot; imports outside a broker call retain null.
  for(const key of ['serveCall','serveCalls','serveRpc']){
   const original=broker[key];if(typeof original!=='function')continue;
   function wrapped(...args){const previous=slot;slot=key==='serveRpc'?args[0]:args[0]?.slot;
    try{return Reflect.apply(original,this,args);}finally{slot=previous;}}
   broker[key]=wrapped;guards.push([broker,key,wrapped]);restores.push(()=>{if(broker[key]===wrapped)broker[key]=original;});
  }
  hook(imports,'gdi_surface_upload',args=>({slot,id:args[0]>>>0,rect:args.slice(1,5)}),(args,result,c)=>{
   const p=gdi.surfacePresentations.get(c.id),s=p?.surface,win=renderer.windows?.[p?.targetHwnd];
   emit('host-upload-completed',{...c,result:typeof result==='number'?result:null,
    presentation:id(p),canvas:id(p?.canvas),window:id(win),hwnd:p?.targetHwnd??null,
    version:p?.version??null,storageOffset:s?.storageOffset??null,
    owningMemory:s?.storage?.buffer===buffer,owningWindow:ownsWindow(win),directDraw:p?.directDraw===true,
    attached:!!win&&win._backCanvas===p?.canvas});
  });

  if(fallback){
   const original=fallback.copy;
   function copy(c){
    if(typeof original==='function')Reflect.apply(original,this,[c]);
    observe(()=>{
     if(!c||c.source!=='selected-fallback'||c.copied!==true||!c.destination||!c.surface)return;
     if(selected.size>=16&&!selected.has(c.destination))throw Error('selected copy bound');
     c={...c,dimensions:dimensions(c.destination),destinationGeneration:watchDestination(c.destination).generation};selected.set(c.destination,c);
     emit('selected-fallback-copy',selectedRow(c));
    });
   }
   fallback.copy=copy;guards.push([fallback,'copy',copy]);
   restores.push(()=>{if(fallback.copy===copy)fallback.copy=original;});
   hook(renderer,'observePresentationTransfer',args=>({source:args[0],destination:args[1],geometry:args[2]}),(_args,_result,c)=>{
    if(!frame||!c.source||!c.destination)return;
    if(frame.edges.length>=128)throw Error('presentation transfer bound');
    let origins=frame.lineage.get(c.source);
    if(!origins){const selectedCopy=selected.get(c.source);if(selectedCopy&&currentCopy(selectedCopy))origins=[selectedCopy];}
    if(!origins?.length)return;
    const edge={source:id(c.source),destination:id(c.destination),geometry:c.geometry,
     copyGenerations:origins.map(x=>x.copyGeneration)};
    frame.edges.push(edge);
    const union=[...new Set([...(frame.lineage.get(c.destination)||[]),...origins])];
    if(union.length>16)throw Error('presentation lineage bound');frame.lineage.set(c.destination,union);
   });
   hook(renderer,'observePresentationPublication',args=>({display:args[0],sequence:args[1]}),(_args,_result,c)=>{
    if(!frame)return;const d=c.display,logical=['logical-canvas','direct-canvas'].includes(d?.backend);
    const actual=logical?renderer.canvas:d?.source;
    let copies=frame.lineage.get(actual);
    if(!copies){const direct=selected.get(actual);if(direct&&currentCopy(direct))copies=[direct];}
    // Filter success is the renderer's explicit source/output publication
    // after present returns. Unknown filter output and unsupported paths do
    // not gain membership by a same-sized or visually matching canvas.
    if(!d||!copies?.length||d.output!==(logical?renderer.canvas:renderer.presentationCanvas))return;
    if(copies.length!==1)return;const copy=copies[0];if(!currentCopy(copy))return;
    let filterGeneration=null,outputGeneration=null;
    outputGeneration=watchDestination(d.output).generation;
    if(!logical){
     const filter=renderer.presentationFilter;if(!filter||typeof filter.present!=='function')return;
     if(!filters.has(filter)){
      const state={generation:0};filters.set(filter,state);hook(filter,'present',null,()=>{state.generation++;});
     }
     filterGeneration=filters.get(filter).generation;
    }
    published={frame:c.sequence,copy,output:d.output,dimensions:dimensions(d.output),backend:d.backend,
     filter:renderer.presentationFilter,scaleMode:renderer.presentationScaleMode,outputGeneration,filterGeneration};
    emit('fallback-publication',{...selectedRow(copy),frame:c.sequence,sourceCanvas:id(actual),
     outputCanvas:id(d.output),outputDimensions:dimensions(d.output),backend:d.backend,edges:frame.edges});
   });
  }
  hook(owner,'_presentNow',null,(_args,result)=>emit('host-present-completed',{
   result:typeof result==='number'?result:null,frame:report.frame,surfaceRelation:null}));
  hook(gdi,'presentBestDxOffscreen',null,(_args,result)=>emit('fallback-present-completed',{
   result:typeof result==='number'?result:null,surfaceRelation:null}));
  hook(renderer,'repaint',()=>{const current={draws:[],edges:[],lineage:new Map(),previous:frame,nested:!!renderer._repainting,before:renderer._immutablePublicationSequence||0};if(!current.nested){frame=current;published=null;}return current;},(_args,_value,c)=>{
   if(c.nested)return;frame=c.previous;const sequence=renderer._immutablePublicationSequence||0;
   if(sequence>c.before){report.frame=sequence;emit('renderer-completed',{frame:sequence,draws:c.draws,
    displayCanvas:id(renderer.canvas),publication:'normal repaint return'});}
  });
  hook(renderer.ctx,'drawImage',args=>({source:args[0],frame}),(_args,_value,c)=>{
   if(!c?.frame||frame!==c.frame)return;
   // Store only exact canvas members actually passed to the normal drawing
   // call. Intermediates, WebGL, layers and shared-window blits stay unknown.
   for(const [surfaceId,p]of gdi.surfacePresentations){
    if(p.canvas!==c.source)continue;
    if(c.frame.draws.length>=16)throw Error('host frame member bound');
    const win=renderer.windows?.[p.targetHwnd];
    c.frame.draws.push({id:surfaceId,presentation:id(p),canvas:id(p.canvas),window:id(win),hwnd:p.targetHwnd,
     version:p.version,storageOffset:p.surface?.storageOffset,owningMemory:p.surface?.storage?.buffer===buffer,owningWindow:ownsWindow(win),
     attached:!!win&&win._backCanvas===p.canvas,destinationCanvas:id(renderer.ctx.canvas)});
   }
  });
  occupied.add(owner);timer=setTimeout(()=>finish('deadline'),Math.max(1,deadline-now()));timer.unref?.();
  return {report,finish,check(){observe(()=>{});return report;},
   token(){observe(()=>{});const copy=captureCopy();return {epoch,status:report.status,sequence:report.sequence,frame:report.frame,pending:report.pending,copyGeneration:copy?.copyGeneration??null};},
   capture(before,sha256,name){observe(()=>{
    if(!before||before.epoch!==epoch||before.status!=='running'||before.sequence!==report.sequence||before.frame!==report.frame||
     before.pending||report.pending||!report.frame||!(/^[a-f0-9]{64}$/).test(sha256||'')||typeof name!=='string'||name.length>256)
     throw Error('stale/unknown host capture');
    const copy=captureCopy();if(before.copyGeneration!==(copy?.copyGeneration??null))throw Error('replaced capture copy');
    emit('capture-bracket',{frame:report.frame,sha256,name,copyCurrent:!!copy,copyGeneration:copy?.copyGeneration??null,screenPixels:'unknown; external screenshot identity only'});
   });return report;}};
 }
 return {attach};
}
function workerSource({observeSource,options}){
 const epoch=options.targetId+'/'+options.sessionId;
 // Bind a nonzero native owner epoch to the full authenticated realm identity.
 let nativeEpoch=2166136261;for(const c of epoch)nativeEpoch=Math.imul(nativeEpoch^c.charCodeAt(0),16777619)>>>0;
 nativeEpoch=nativeEpoch||1;
 let install=base.installWorker.toString();
 install=base.replaceOnce(install,'thread:entry?.getExports()?.get_current_thread_id(),',
  'thread:(entry||preload.entries[0])?.getExports?.()?.get_current_thread_id?.(),slot:preload.entries[0]?.slot,endpointIdentity:preload.entries[0]?.endpointIdentity,');
 install=base.replaceOnce(install,"{command,kind:'begin'}","{command,kind:'begin',epoch:options.epoch}");
 install=base.replaceOnce(install,'{...row,command}','{...row,command,epoch:options.epoch}');
 install=base.replaceOnce(install,"if(action==='check'){", "if(action==='assert-live'){entry.observer.assertLive();running();}\n     else if(action==='check'){");
 return observeSource+'\n;globalThis.StrongholdNativePresetObserver=('+observerFactory.toString()+')('+JSON.stringify(EXE_SHA256)+','+JSON.stringify(PINS)+',('+preset.controlFactory.toString()+'),('+cycleFactory.toString()+'));\n;('+install+')('+JSON.stringify({...options,epoch,nativeEpoch})+');';
}
// Reuse the exact tested compile/send and target/session guards. The command
// scope now spans the one Custom Game gesture and its input-free observations.
function selectOwningWorker(inspected){
 const owners=[];
 for(const candidate of inspected){
  const {id,entry,report:r}=candidate;
  if(!r||r.targetId!==id||r.sessionId!==entry.sessionId||r.workerURL!==entry.info.url||
   !Array.isArray(r.events)||r.entries!==1||r.terminal)throw Error('foreign/replaced Worker discovery report');
  const received=r.events.filter(e=>e.kind==='received-module'),instantiated=r.events.filter(e=>e.kind==='instantiated');
  const slot=received[0]?.slot;
  if(received.length!==1||instantiated.length!==1||received[0].type!=='init'||
   !Number.isInteger(slot)||slot<0||slot>15||instantiated[0].incoming?.slot!==slot||
   instantiated[0].incoming?.type!=='init')throw Error('ambiguous Worker init discovery');
  if(slot===0){
   if(!r.installedBeforeInstantiation||r.entryError||r.slot!==0||r.endpointIdentity!==1||r.thread!==1)
    throw Error('owning slot0/endpoint1/thread1 prerequisite');
   owners.push(candidate);
  }
 }
 if(owners.length!==1)throw Error('single exact owning Worker target/session prerequisite');
 return owners[0];
}
function createAttachment(options){
 let source=base.createAttachment.toString();
 source=base.replaceOnce(source,'command=i;balanced=false;await rpc(\'start\',{command});active=true;',
  "command=i;balanced=false;await hostPresentation?.start(owner.id+'/'+owner.sessionId,{nativeEpoch:r.report.nativeEpoch,exeSha256:r.report.exeSha256,wasmSha256:r.report.wasmSha256,workerURL:r.report.workerURL,workerSlot:0,endpointIdentity:1});await rpc('start',{command});active=true;");
 source=base.replaceOnce(source,'terminal=true;active=false;\n   try{if(owner)',
  "terminal=true;active=false;try{await hostPresentation?.finish(reason);}catch(e){persist({reason,error:String(e),hostPresentation:'unknown'});}\n   try{if(owner)");
 source=base.replaceOnce(source,"persist({reason:'owning-session-detached',history:'unknown; retain last native frames'});",
  "persist({reason:'owning-session-detached',history:'unknown; retain last native frames'});hostPresentation?.finish('owning-session-detached').catch(e=>persist({hostPresentation:'unknown',error:String(e)}));");
 source=base.replaceOnce(source,"async capture(name,digest,state){await annotate({kind:'capture',name,sha256:digest,steps:state.main.tick.steps});}",
  "async capture(name,digest,state,hostCapture){await annotate({kind:'capture',name,sha256:digest,steps:state.main.tick.steps});if(active&&hostPresentation)return hostPresentation.link((await rpc('report')).report,{name,sha256:digest,steps:state.main.tick.steps,hostCapture});return null;}");
 source=base.replaceOnce(source,"if(c.action!=='route-press-preset')return;","if(c.action!=='route-gesture')return;");
 source=base.replaceOnce(source,
  "     if(candidates.length!==1)throw Error('single exact preloaded Worker target/session prerequisite');\n     const [id,entry]=candidates[0];owner={id,entry,sessionId:entry.sessionId,session:entry.session,url:entry.info.url};\n     const r=await rpc('report');",
  "     const inspected=[];\n     for(const [id,entry]of candidates){owner={id,entry,sessionId:entry.sessionId,session:entry.session,url:entry.info.url};inspected.push({id,entry,report:await rpc('report')});}\n     const {id,entry,report:r}=selectOwningWorker(inspected);owner={id,entry,sessionId:entry.sessionId,session:entry.session,url:entry.info.url};");
 source=base.replaceOnce(source,"e.kind==='sent-module'&&e.workerURL===entry.info.url",
  "e.kind==='sent-module'&&e.workerURL===entry.info.url&&e.slot===0");
 source=base.replaceOnce(source,'get active(){return active;},begin,failed,finish,assertLive()',
  "get active(){return active;},begin,failed,finish,async beforeStep(){if(active)await rpc('assert-live');},assertLive()");
 source=base.replaceOnce(source,
  "await annotate({kind:'ACK',requested,before,steps:result.steps,guests:result.guests});await rpc('check');",
  "const s=await pageState(),m=s.main;if(m?.tick?.steps!==result.steps)throw Error('stale ACK input snapshot');await annotate({kind:'ACK',requested,before,steps:result.steps,guests:result.guests,input:m.inputQueue,activeInput:m.activeInput,lastInput:m.lastInput,mask:m.mouseButtonsMask,inputTelemetry:m.inputTelemetry});await rpc('check');");
 const start=source.indexOf('   async success(c){'),end=source.indexOf('   retire(event)',start);
 if(start<0||end<0)throw Error('attachment success seam');
 source=source.slice(0,start)+'   async success(){},\n'+source.slice(end);
 const factory=new Function('ROOT','require','path','selectOwningWorker','hostPresentation','return ('+source+')')(path.resolve(__dirname,'..'),require,path,selectOwningWorker,options.hostPresentation);
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
 p.source=base.replaceOnce(p.source,'const observerBefore=stepping&&presetAttachment.active?',
  'if(stepping)await presetAttachment.beforeStep();const observerBefore=stepping&&presetAttachment.active?');
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
 p.evidence.callbackObserver.observationBudget={maxBoundaries:50000000,maxMs:360000,maxRecords:2048,maxBytes:1048576,
  measuredRenderBoundaries:1441804,measuredBoundariesPer64StepACK:64000,fullRenderCapacity:34,continuous:true,perBlockStorage:false};
 p.evidence.callbackObserver.passiveDraw={entry:0x4292c0,returnInstruction:0x42a20e,
  returnEvidence:'byte-pinned epilogue block plus saved caller/ESP return; block-level hook',
  sameHistory:true,presentation:'pending',hostRelation:null,readinessGranted:false,pixelsAccepted:false};
 p.evidence.callbackObserver.passiveControls={history:'native boundaries only; pre-start history unknown',
  hover:'description only',activation:'entry/queue distinct from application',application:'saved caller/ESP interval only',
  widget:'exact scene20 manager/descriptor and numbered child identity; visibility/disabled samples only',
  presentation:'unknown',readinessGranted:false,pixelsAccepted:false};
 p.evidence.successor.routeCompositionUnchanged=false;
 p.evidence.successor.scope='Pre-first-script owning callback diagnostic composition; no runtime qualification or preset/Start grant';
 p.evidence.compositionSHA256=base.hash(p.source);p.evidence.routeCompositionSHA256=base.hash(p.route);
 return p;
}
// A storage/endpoint join is useful evidence, but cannot identify which
// asynchronous RPC upload came from a particular original call. Keep that
// missing transport identity explicit rather than pairing nearby records.

function joinCaptureTransaction(nativeReport,hostReport,capture){
 const unknown={status:'unknown',readinessGranted:false,pixelsAccepted:false,gameplay:false};
 try{
 const bounded=(r,native)=>r&&Number.isSafeInteger(r.bytes)&&r.bytes>=0&&
  Number.isSafeInteger(r.limits?.maxRecords)&&r.limits.maxRecords>0&&r.limits.maxRecords<=2048&&
  Number.isSafeInteger(r.limits?.maxBytes)&&r.limits.maxBytes>0&&r.limits.maxBytes<=1048576&&
  (!native||Number.isSafeInteger(r.blocks)&&r.blocks>=0&&Number.isSafeInteger(r.limits.maxBoundaries)&&
   r.limits.maxBoundaries>0&&r.limits.maxBoundaries<=50000000);
 if(!capture||!nativeReport||!hostReport||nativeReport.status!=='running'||hostReport.status!=='running'||
  !bounded(nativeReport,true)||!bounded(hostReport,false)||
  typeof nativeReport.epoch!=='string'||!nativeReport.epoch||nativeReport.exeSha256!==EXE_SHA256||
  !/^[a-f0-9]{64}$/.test(nativeReport.wasmSha256)||!nativeReport.workerURL||
  !Number.isInteger(nativeReport.nativeEpoch)||nativeReport.nativeEpoch<=0||nativeReport.nativeEpoch>0xffffffff||
  !Number.isSafeInteger(capture.steps)||capture.steps<0||!capture.name||!(/^[a-f0-9]{64}$/).test(capture.sha256)||
  nativeReport.fault||hostReport.fault||nativeReport.epoch!==hostReport.epoch||
  !hostReport.nativeBinding||!hostReport.bindingValid||hostReport.nativeBinding.nativeEpoch!==nativeReport.nativeEpoch||
  hostReport.nativeBinding.workerSlot!==0||hostReport.nativeBinding.endpointIdentity!==1||
  hostReport.nativeBinding.exeSha256!==nativeReport.exeSha256||hostReport.nativeBinding.wasmSha256!==nativeReport.wasmSha256||
  hostReport.nativeBinding.workerURL!==nativeReport.workerURL||nativeReport.workerSlot!==0||nativeReport.endpointIdentity!==1||
  !Array.isArray(nativeReport.records)||!Array.isArray(hostReport.records)||
  nativeReport.records.length>2048||hostReport.records.length>2048||
  !nativeReport.limits||nativeReport.blocks>=nativeReport.limits.maxBoundaries||
  nativeReport.records.length>=nativeReport.limits.maxRecords||nativeReport.bytes>=nativeReport.limits.maxBytes||
  !hostReport.limits||hostReport.records.length>=hostReport.limits.maxRecords||hostReport.bytes>=hostReport.limits.maxBytes||
  nativeReport.sequence!==nativeReport.records.length||hostReport.sequence!==hostReport.records.length||
  nativeReport.records.some((r,i)=>r.sequence!==i+1)||hostReport.records.some((r,i)=>r.sequence!==i+1)||
  nativeReport.records.some(r=>r.epoch!==nativeReport.epoch)||hostReport.records.some(r=>r.epoch!==hostReport.epoch))return unknown;
 const annotations=nativeReport.records.filter(r=>r.kind==='host-annotation');
 const ack=annotations.filter(r=>r.annotation.kind==='ACK').at(-1),shot=annotations.at(-1),receipt=shot?.nativeReceipt;
 const hostShot=hostReport.records.at(-1),publication=hostReport.records.filter(r=>r.kind==='fallback-publication').at(-1);
 if(!ack||shot?.annotation.kind!=='capture'||shot.annotation.name!==capture.name||shot.annotation.sha256!==capture.sha256||
  ack.annotation.requested!==64||!Number.isSafeInteger(ack.annotation.before)||ack.annotation.before<0||ack.annotation.before+64!==capture.steps||
  ack.annotation.guests?.length!==1||ack.annotation.guests.some(g=>g.requested!==64||g.ran!==64||g.steps!==capture.steps||!g.running||!g.frozen||g.tickMs!==16||g.error||g.timedOut)||
  !Number.isSafeInteger(shot.command)||shot.command<0||shot.annotation.command!==shot.command||ack.annotation.command!==ack.command||
  ack.annotation.steps!==capture.steps||shot.annotation.steps!==capture.steps||ack.command!==shot.command||
  ack.block!==shot.block||shot.block!==nativeReport.blocks||
  receipt?.status!=='owning-setup-in-progress'||!receipt.cycle?.reset||!receipt.cycle.draw||
  receipt.native?.profile!==2||receipt.native.valid!==1||receipt.native.reason!==0||
  receipt.native.nativeEpoch!==nativeReport.nativeEpoch||
  JSON.stringify(ack.nativeReceipt)!==JSON.stringify(receipt)||
  hostShot?.kind!=='capture-bracket'||hostShot.name!==capture.name||hostShot.sha256!==capture.sha256||
  !publication||publication.frame!==hostShot.frame||publication.sequence>=hostShot.sequence||
  publication.frozenSteps!==capture.steps||!publication.primary||!publication.owningMemory||!publication.owningWindow||
  !publication.allocationGeneration||!publication.copyGeneration||!publication.current||
  !hostShot.copyCurrent||hostShot.copyGeneration!==publication.copyGeneration||hostReport.pending||
  JSON.stringify(nativeReport.nativeObservation)!==JSON.stringify(receipt)||
  hostReport.frame!==hostShot.frame||shot.state.currentScene!==20||shot.state.requestedScene!==20)return unknown;
 const copied=hostReport.records.find(r=>r.kind==='selected-fallback-copy'&&r.copyGeneration===publication.copyGeneration);
 if(!copied||copied.sequence>=publication.sequence||!copied.current||!copied.primary||
  ['allocationGeneration','slot','storageOffset','bytes','width','height','pitch','bpp','hwnd','window','layer','destinationCanvas','destinationGeneration','frozenSteps','flags']
   .some(k=>copied[k]!==publication[k])||
  !Array.isArray(publication.edges)||publication.edges.length<1||publication.edges.length>128)return unknown;
 const reached=new Set([copied.destinationCanvas]);
 for(const edge of publication.edges){if(!Array.isArray(edge.copyGenerations)||!edge.copyGenerations.includes(copied.copyGeneration))continue;
  if(reached.has(edge.source))reached.add(edge.destination);}
 if(!reached.has(publication.sourceCanvas)||!publication.outputCanvas||!publication.backend)return unknown;
 const c=receipt.cycle,a=c.active,g=c.gate;
 if(!c.resetReceipt||c.resetReceipt.after!==0||!g?.returned||!Array.isArray(g.successors)||!g.successors.length||
  !c.sceneManager||!a||!receipt.native.entries.some(f=>f.target===a.target&&f.caller===a.caller&&f.esp===a.esp)||
  !['scene-manager','widget0','post-widget','widget3','presentation'].includes(c.phase)||
  !nativeReport.records.some(r=>r.kind==='cycle-entry'&&r.cycle.id===c.id)||
  !nativeReport.records.some(r=>r.kind==='cycle-reset'&&r.cycleId===c.id&&r.reset.successor===c.resetReceipt.successor)||
  !nativeReport.records.some(r=>r.kind==='cycle-pass-entry'&&r.cycleId===c.id&&r.pass.target===a.target&&r.pass.esp===a.esp)||
  !nativeReport.records.some(r=>r.kind==='cycle-draw-entry'&&r.cycleId===c.id&&r.draw.entryESP===c.draw.entryESP))return unknown;
 const history=nativeReport.records.filter(r=>r.cycleId===c.id),entry=nativeReport.records.find(r=>r.kind==='cycle-entry'&&r.cycle.id===c.id);
 const covered=n=>n?.profile===2&&n.imageBase===0x400000&&n.nativeEpoch===nativeReport.nativeEpoch&&n.valid===1&&n.reason===0&&Array.isArray(n.entries)&&n.entries.length<=64;
 if(!covered(receipt.native)||!covered(entry.native)||entry.cycle.entryPC!==0x576b9a||entry.cycle.esp!==c.esp||
  JSON.stringify(entry.cycle.gate.operands)!==JSON.stringify(g.operands)||entry.cycle.gate.manager!==g.manager)return unknown;
 const successors=history.filter(r=>r.kind==='input-gate-successor');
 if(JSON.stringify(successors.map(r=>r.successor))!==JSON.stringify(g.successors)||successors.some(r=>!covered(r.native)))return unknown;
 const [op0,op1,op2,op3]=g.operands,expected=[];let next=op0!==0?0x576bb2:0x576ba2;
 while(next){expected.push(next);next=next===0x576ba2?(op1!==0?0x576bb2:0x576baa):
  next===0x576baa?(op2===0?0x576bba:0x576bb2):next===0x576bb2?(op3===0?0x576bc5:0x576bba):null;}
 if(JSON.stringify(expected)!==JSON.stringify(g.successors)||g.admitted!==(expected.at(-1)===0x576bba))return unknown;
 let last=entry.sequence;
 for(const r of successors){if(r.sequence<=last)return unknown;last=r.sequence;}
 const checkedPass=(pass,returned)=>{
  if(!pass||pass.entryPC!==pass.target||pass.entryESP!==pass.esp||pass.callerESP!==pass.esp+4)return false;
  const row=history.find(r=>r.kind==='cycle-pass-entry'&&r.pass.name===pass?.name&&r.pass.esp===pass.esp&&r.pass.caller===pass.caller&&r.pass.target===pass.target);
  if(!row||row.sequence<=last||!covered(row.native)||!row.native.entries.some(f=>f.target===pass.target&&f.caller===pass.caller&&f.esp===pass.esp))return false;
  last=row.sequence;
  if(returned){
   const ret=history.find(r=>r.kind==='cycle-pass-return'&&r.pass.name===pass.name&&r.pass.esp===pass.esp&&r.pass.caller===pass.caller&&r.pass.target===pass.target);
   if(!ret||ret.sequence<=last||!covered(ret.native)||ret.pass.returnPC!==pass.caller||ret.pass.returnESP!==pass.esp+pass.cleanup||
    ret.native.entries.some(f=>f.target===pass.target&&f.esp===pass.esp)||pass.returned!==true)return false;
   last=ret.sequence;
  }else if(pass.returned!==false)return false;
  return true;
 };
 if(g.admitted===true){if(!checkedPass(c.inputManager,true)||c.inputManager.manager!==g.manager)return unknown;}
 else if(g.admitted!==false||g.successors.at(-1)!==0x576bc5)return unknown;
 const reset=history.find(r=>r.kind==='cycle-reset');
 if(!reset||reset.sequence<=last||!covered(reset.native)||reset.reset.esp!==c.esp||
  ![0x576c51,0x576c56].includes(reset.reset.entry)||![0x576c65,0x576d92].includes(reset.reset.successor)||reset.reset.after!==0)return unknown;
 last=reset.sequence;
 const passes=[c.sceneManager,c.widget0,c.postWidget,c.widget3,c.presentation],names=['scene-manager','widget0','post-widget','widget3','presentation'];
 const activeIndex=names.indexOf(c.phase);
 for(let i=0;i<=activeIndex;i++)if(!passes[i]||!checkedPass(passes[i],i<activeIndex))return unknown;
 const drawEntry=history.find(r=>r.kind==='cycle-draw-entry'&&r.draw.entryESP===c.draw.entryESP&&r.draw.caller===c.draw.caller);
 const managerEntry=history.find(r=>r.kind==='cycle-pass-entry'&&r.pass.name==='scene-manager'),managerReturn=history.find(r=>r.kind==='cycle-pass-return'&&r.pass.name==='scene-manager');
 if(!drawEntry||drawEntry.sequence<=managerEntry.sequence||managerReturn&&drawEntry.sequence>=managerReturn.sequence||!covered(drawEntry.native)||!drawEntry.native.entries.some(f=>f.target===0x4292c0&&f.esp===c.draw.entryESP&&f.caller===c.draw.caller))return unknown;
 if(c.draw.returned){const ret=history.find(r=>r.kind==='cycle-draw-return'&&r.draw.entryESP===c.draw.entryESP&&r.draw.returnESP===c.draw.entryESP+4);
  if(!ret||!covered(ret.native)||ret.sequence<=drawEntry.sequence)return unknown;
 }else if(activeIndex>0)return unknown;
 // A retained-pointer copy may include an incomplete frame. It can describe
 // observed progress but never supplies pixel acceptance or input readiness.
 return {...unknown,status:'proved-setup-in-progress',epoch:nativeReport.epoch,sha256:capture.sha256,
  name:capture.name,steps:capture.steps,command:shot.command,native:receipt,
  publication,partialWritePossible:publication.partialWritePossible===true,
  proof:{nativeReport,hostReport,capture:{name:capture.name,sha256:capture.sha256,steps:capture.steps}}};
 }catch(_){return unknown;}
}

function linkPresentation(nativeReport,hostReport){
 const result={epoch:nativeReport?.epoch??null,status:'unknown',relations:[],operationCompletion:null,
  freshPixels:null,readinessGranted:false};
 if(!nativeReport||!hostReport||nativeReport.epoch!==hostReport.epoch||nativeReport.fault||hostReport.fault||
  nativeReport.status!=='running'||hostReport.status!=='running'||hostReport.pending)return result;
 if(!Array.isArray(nativeReport.records)||!Array.isArray(hostReport.records)||nativeReport.records.length>2048||hostReport.records.length>2048)return result;
 if(nativeReport.records.some(r=>r.epoch!==nativeReport.epoch)||hostReport.records.some(r=>r.epoch!==hostReport.epoch))return result;
 let comparisons=0;const bounded=()=>{if(++comparisons<=8192)return true;result.scanTruncated=true;return false;};
 for(const request of nativeReport.records.filter(r=>r.kind==='surface-import-request'&&r.name==='gdi_surface_upload')){
  if(!bounded())return result;
  const entry=nativeReport.records.find(r=>r.kind==='surface-target-entry'&&r.sequence===request.entrySequence);
  const returned=nativeReport.records.find(r=>r.kind==='surface-return'&&r.entrySequence===request.entrySequence);
  const trace=nativeReport.records.find(r=>r.kind==='surface-import-request'&&r.name==='dx_trace'&&
   r.entrySequence===request.entrySequence&&r.args[0]===12&&r.args[1]===request.slot&&r.args[2]===request.sourceSlot);
  const present=nativeReport.records.find(r=>r.kind==='surface-import-request'&&r.name==='dx_trace'&&
   r.entrySequence===request.entrySequence&&r.args[0]===5&&r.args[1]===request.slot);
  const attach=nativeReport.records.find(r=>r.kind==='surface-import-request'&&r.name==='gdi_surface_attach'&&
   r.entrySequence===request.entrySequence&&r.args[0]===request.args[0]&&r.args[1]>0);
  if(!entry||!returned||!returned.hresultZero||returned.result!==0||!trace||!present||!attach||!Number.isInteger(request.slot)||request.slot<0||request.slot>=16384||request.args[0]!==0x200000+request.slot)continue;
  for(const upload of hostReport.records.filter(r=>r.kind==='host-upload-completed'&&r.id===request.args[0]&&r.slot===0&&
   r.result===1&&r.owningMemory&&r.owningWindow&&r.directDraw&&r.attached&&r.hwnd===attach.args[1]&&r.storageOffset===present.args[3])){
   if(!bounded())return result;
   for(const completion of hostReport.records.filter(r=>r.kind==='renderer-completed'&&r.sequence>upload.sequence)){
    if(!bounded())return result;
    const member=completion.draws.find(d=>d.id===upload.id&&d.presentation===upload.presentation&&d.canvas===upload.canvas&&
     d.window===upload.window&&d.hwnd===upload.hwnd&&d.version===upload.version&&d.storageOffset===upload.storageOffset&&
     d.owningMemory&&d.owningWindow&&d.attached&&d.destinationCanvas===completion.displayCanvas);
    if(!member)continue;
    if(result.relations.length>=16)return result;
    result.relations.push({nativeEntry:entry.sequence,nativeReturn:returned.sequence,object:entry.object,source:entry.source,
     target:entry.target,hresult:returned.result,slot:request.slot,upload:upload.sequence,frame:completion.frame,
     hwnd:member.hwnd,window:member.window,canvas:member.canvas,storageOffset:member.storageOffset,
     relation:'matching canonical slot/storage address; page upload and exact canvas draw completed; allocation generation unknown',
     operationToUpload:'unknown; no unique cross-realm RPC operation identity',capture:hostReport.records.find(r=>
      r.kind==='capture-bracket'&&r.sequence>completion.sequence&&r.frame===completion.frame)??null});
   }
  }
 }
 if(result.relations.length)result.status='structural-candidates-only';return result;
}
module.exports={EXE_SHA256,PINS,...native,cycleFactory,observerFactory,hostPresentationFactory,linkPresentation,joinCaptureTransaction,workerSource,selectOwningWorker,createAttachment,assertHistoricalShell,prepare};
