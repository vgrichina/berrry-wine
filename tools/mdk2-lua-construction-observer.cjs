'use strict';
(() => {

// Passive owning-main import observer. The caller supplies existing block tracing;
// this module never arms tracing, executes exports, or changes guest state.
const EXE_SHA256='b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1';
const SCRIPT_SHA256='cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8';
const PINS=[
  [0x4522d0,'6a0ae8e9f2ffffa1d0874b0083c404c3'],
  [0x4515c0,'8b4424046a0150ff1570c04800c3'],
  [0x44fb7e,'51e84c270000'],
  [0x44fbd4,'8b15147d4b00c6421e02a1147d4b0050e8b7f8ffff83c404891d147d4b00'],
  [0x44f4a0,'568b7424080fbe461c4883f80b7766ff248518f54400'],
  [0x44f515,'5ec3'],[0x44f53c,'15f54400'],
  [0x41fce5,'56e855ff02008b0683c40485c0741a'],
  [0x41fcf9,'8b46088b0e575051e87a520200'],
  [0x402187,'e8e40e040083c404'],[0x443070,'51a1e47c4b00538b98f0000000'],
  [0x443080,'e8bb010000'],[0x443240,'6820334400e856180000'],
  [0x444ae0,'51ffd583c404'],[0x443344,'8b490451e813010000'],
  [0x4434a0,'8b470c4583c3183be87cd6'],
  [0x46d0bf,'e8acddfbff83c404c7462401000000'],
  [0x42ae70,'e85b7f0100833d20714b00ff'],
  [0x41e9ad,'e86ee1040083c41c5e59c3'],
  [0x46cb20,'d94424088b442404d998a0000000c3'],
  [0x46b62a,'d987a0000000'],
  [0x46b66f,'e85c60feffd8afa0000000d997a0000000d81d28c24800dfe0f6c441740957e82dfafbff83c404'],
  [0x42b0c0,'568b7424086a0756e86329feff'],
  [0x42b0d4,'e8f77c010068484f4900e8ed8801005056e8d68a0100'],
  [0x42b0f5,'e8267d01005ec3'],
  [0x40daf0,'8b4424048b80840000008b4c24088b54884452e88853030050e86248030083c408c3'],
  [0x4391a0,'a178e05c006a00506a01e891b00000'],
  [0x43922f,'505756e8a929ffff83c4305f5ec3'],
  [0x42bbe0,'568b742408578b7c24106aff'],
  [0x42bc25,'5756e85410000083c4085f5ec3'],
  [0x42cc80,'8b4424048b4c2408a32c714b00890d94744b00c705a07b4b00ffffffffc70548cb5c0001000000c3'],
  [0x4019d2,'391d48cb5c00'],[0x401a28,'e863af0200891d48cb5c00'],
  [0x42c990,'a1a07b4b008b0d2c714b008b155c714b00'],
  [0x42cc1e,'687c614a00e8385a010050e842570100']
].map(([pc,hex])=>Object.freeze({pc,hex}));
const CUTS={poll:0x4522d0,pollRead:0x4522d7,consume:0x44fbd4,finalize:0x44f4a0,
  finalizeType10:0x44f515,loadCall:0x41fce5,loadReturned:0x41fceb,
  bufferCall:0x41fcf9,buffer:0x444f80};
const owners=new WeakSet();
// Decode an already frozen, independently read file-Worker sidecar. This is
// evidence interpretation, never a request to execute or modify that Worker.
function decodeFileSnapshot(main,file){
  if(main?.realm!=='actual-main-worker'||main.values?.get_current_thread_id!==1||
    file?.handle!==921600||file.values?.get_current_thread_id!==2||!file.available)throw Error('wrong main/file ownership');
  for(const key of ['steps','ticks','guestMs'])if(main.frozen?.[key]!==file.frozen?.[key])throw Error('uncorrelated frozen history');
  if(!main.frozen?.frozen||!file.frozen?.frozen||main.frozen.hosts!==1||file.frozen.hosts!==1)throw Error('unfrozen/foreign host');
  const w=file.stack,esp=file.values.get_esp;
  if(file.values.get_eip!==0x4515cd||!Array.isArray(w)||w.length>64||w[1]!==0)throw Error('not a supported callback Sleep boundary');
  if(w[0]===0x451f62)return {kind:'idle-file-poll',decode:null};
  const output=w[0]===0x45774a,input=w[0]===0x457708;
  if(!output&&!input)throw Error('unknown file return branch');
  const ptr=w[output?8:6],index=(ptr-esp)/4;
  if(!Number.isInteger(index)||index<0||index+6>w.length)throw Error('decode state absent from bounded stack');
  const [stream,compressedSize,compressedRead,outputSize,outputCopied,destination]=w.slice(index,index+6);
  if(outputSize!==main.rawRequestWords?.[2]||destination!==main.rawRequestWords?.[0]||compressedRead>compressedSize||outputCopied>outputSize)throw Error('wrong request/decode cursors');
  return {kind:output?'archive-output-callback':'archive-input-callback',decode:{state:ptr,stream,compressedSize,compressedRead,outputSize,outputCopied,destination,remaining:outputSize-outputCopied}};
}
function attach({host,getExports,getSlice=()=>null,getEpoch=()=>null,workerSlot,exeSha256,wasmSha256,deadline,now=()=>performance.now(),maxRecords=512,maxBoundaries=50000000,maxRecordBytes=8192}={}) {
  if(workerSlot!==0||exeSha256!==EXE_SHA256||!(/^[a-f0-9]{64}$/).test(wasmSha256||''))throw Error('wrong Worker/media/module pin');
  if(typeof host?.log_block!=='function'||typeof getExports!=='function'||owners.has(host))throw Error('missing or occupied owning import');
  if(!Number.isFinite(deadline)||deadline<=now()||deadline>now()+360000||!Number.isInteger(maxRecords)||maxRecords<1||maxRecords>512||!Number.isInteger(maxBoundaries)||maxBoundaries<1||maxBoundaries>50000000)throw Error('invalid observation bound');
  if(!Number.isInteger(maxRecordBytes)||maxRecordBytes<1||maxRecordBytes>8192)throw Error('invalid record byte bound');
  const epoch=getEpoch(),frames={},original=host.log_block;let ex=null,poll=null,finalizer=null,load=null,buffer=null,previousLevel=null,suffix=null,decoder=null,lastOrdinal=0,timer=null;
  const report={version:1,status:'running',workerSlot,exeSha256,wasmSha256,records:[],blocks:0,
    history:'Before attachment unknown; native completion is not Lua execution or gameplay',
    moduleBinding:'Caller must bind hashed module bytes to the actual owning Worker init Module'};
  function finish(reason='stopped'){if(report.status==='running'){report.status=reason;report.pending={poll,finalizer,load,buffer,decoder,unobservedPollPrefix:suffix,...frames};if(host.log_block===wrapped)host.log_block=original;owners.delete(host);}return report;}
  function read(a,n=4){
    if(!Number.isSafeInteger(a)||a<0x400000||a+n>0x80000000||n<1||n>256)throw Error('invalid native read');
    const b=new Uint8Array(ex.memory.buffer),v=[];
    for(let i=0;i<n;i++){const w=ex.guest_to_wasm(a+i)>>>0;if(w===0xf0||w>=b.length)throw Error('unmapped native read');v.push(b[w]);}return v;
  }
  const u=a=>{const b=read(a);return (b[0]+b[1]*256+b[2]*65536+b[3]*16777216)>>>0;};
  function identity(){const e=getExports();if(!e||ex&&e!==ex)throw Error('foreign instance');ex=e;
    if(host.log_block!==wrapped)throw Error('owning import replaced');
    if(getEpoch()!==epoch)throw Error('foreign observation epoch');
    const slice=getSlice();if(slice){if(!Number.isSafeInteger(slice.ordinal)||slice.ordinal<1||slice.ordinal<lastOrdinal)throw Error('stale native slice');lastOrdinal=slice.ordinal;}
    if(ex.get_current_thread_id()!==1||ex.get_image_base()!==0x400000)throw Error('wrong thread/loader');
    if(u(0x400000)!==0x00905a4d||u(0x400000+u(0x40003c))!==0x4550)throw Error('wrong PE loader');
    for(const {pc,hex}of PINS)if(read(pc,hex.length/2).map(v=>v.toString(16).padStart(2,'0')).join('')!==hex)throw Error('original bytes changed');
  }
  const requestEntry=request=>({buffer:u(request),size:u(request+8),type:read(request+28,1)[0],status:read(request+30,1)[0],name:String.fromCharCode(...read(request+12,16)).split('\0')[0]});
  const resource=()=>{const request=u(0x4b87d4),active=u(0x4b7d14);return {request,active,pending:u(0x4b87cc),completion:u(0x4b87d0),completedBytes:u(0x5ce08c),
    entry:request?requestEntry(request):null};};
  function level(){
    const state=u(0x4b7ce4);if(!state)return {available:false,reason:'Lua not initialized'};
    const bucket=u(state+0xd4)+('L'.charCodeAt(0)%61)*12,n=u(bucket),list=u(bucket+8);
    if(n>65536)throw Error('Lua bucket bound');let found=null;
    for(let k=0;k<n;k++){const p=u(list+4*k);if(!p||p===0x4aff08||(u(p+12)|0)<0)continue;
      if(u(p+28)!==5||String.fromCharCode(...read(p+32,5))!=='Level')continue;
      if(found)throw Error('duplicate Level');const tag=u(p+16)|0;if(![-6,-3].includes(tag))throw Error('wrong Level tag');
      found={available:true,tag,table:tag===-3?u(p+20):null};
    }return found||{available:false,reason:'Level not interned'};
  }
  const deferred=()=>{const loadFlag=u(0x5ccb48);if(loadFlag>1)throw Error('deferred flag bound');return {requestedLevel:u(0x4b712c),checkpoint:u(0x4b7494),loadFlag};};
  function emit(kind,extra={}){if(report.status!=='running')return;if(report.records.length>=maxRecords){finish('record-limit');return;}
    const row={kind,block:report.blocks,pc:ex.get_eip()>>>0,esp:ex.get_esp()>>>0,resource:resource(),deferred:deferred(),...extra};
    // JSON is ASCII for native records (including escaped resource names).
    const bytes=JSON.stringify(row).replace(/[^\x00-\x7f]/g,'xxxxxx').length;
    if(bytes>maxRecordBytes){finish('record-byte-limit');return;}report.records.push(row);}
  function enter(name,esp,caller,extra={}){
    if(frames[name])throw Error(name+' frame already pending');
    if(u(esp)!==caller)throw Error(name+' caller mismatch');
    frames[name]={esp,caller,...extra};emit(name+'-entry',{frame:{...frames[name]}});
  }
  function timerValue(object){const bits=u(object+0xa0),b=new ArrayBuffer(4),v=new DataView(b);v.setUint32(0,bits,true);const remaining=v.getFloat32(0,true);
    if(!Number.isFinite(remaining))throw Error('timer value bound');
    return {object,bits,remaining,absoluteDeadline:null,identity:'native gob pointer; startscreen association requires independent Lua identity',basis:'captured countdown; static subtraction contract, no inferred wall deadline'};}
  function progression(pc,esp){
    const returns={gc:0x40218c,dispatch:0x46d0c4,timerSet:0x41e9b2,timerHandler:0x46b693,timerCallback:0x42b0f2,timerLua:0x40db0e,deferredStore:0x42bc2c,newGame:0x439237,loader:0x401a2d};
    for(const [name,caller]of Object.entries(returns))if(pc===caller){
      if(name==='timerLua'&&!frames.timerCallback&&!frames.timerLua)continue; // Shared by other gob events.
      const f=frames[name];if(!f)throw Error(name+' return history missing');
      if(esp!==f.esp+4)throw Error(name+' return stack mismatch');
      if(name==='deferredStore'){const d=deferred();if(d.requestedLevel!==f.level||d.checkpoint!==f.checkpoint||d.loadFlag!==1)throw Error('deferred store globals mismatch');}
      if(name==='timerSet'){const value=timerValue(f.object);if(value.bits!==f.bits)throw Error('timer store mismatch');timer={object:f.object,armedAt:report.blocks};emit('timer-armed',{timer:value});}
      emit(name+'-return',{frame:{...f},...(name==='timerHandler'?{timer:timerValue(f.object),meaning:'native timer dispatcher returned; does not imply an installed Lua handler'}:{})});delete frames[name];
      if(name==='loader')frames.loadClear={esp};
    }
    if(pc===0x443070&&u(esp)===0x40218c)enter('gc',esp,0x40218c);
    if(pc===0x42ae70&&u(esp)===0x46d0c4){
      const index=u(esp+4),command=ex.get_esi()>>>0;
      if(index!==62||u(command+12)!==2||u(command+36)!==0)throw Error('release dispatch context mismatch');
      enter('dispatch',esp,0x46d0c4,{index,command,meaning:'release command 62; Medium requires correlated selector evidence'});
    }
    if(pc===0x46cb20&&u(esp)===0x41e9b2)enter('timerSet',esp,0x41e9b2,{object:u(esp+4),bits:u(esp+8)});
    if(pc===0x42b0c0&&u(esp)===0x46b693){const object=u(esp+4),value=timerValue(object);
      if(value.remaining>0)throw Error('timer firing before countdown expiry');
      enter('timerHandler',esp,0x46b693,{object,armObserved:timer?.object===object});emit('timer-firing',{timer:value,armObserved:timer?.object===object});}
    if(pc===0x40daf0&&u(esp)===0x42b0f2){
      if(!frames.timerHandler||u(esp+4)!==frames.timerHandler.object||u(esp+8)!==7)throw Error('timer callback owning frame mismatch');
      enter('timerCallback',esp,0x42b0f2,{object:u(esp+4),event:7});}
    if(pc===0x442370&&u(esp)===0x40db0e&&frames.timerCallback){
      enter('timerLua',esp,0x40db0e,{functionValue:u(esp+4),meaning:'captured Lua-call argument; success/result unknown'});}
    if(pc===0x4391a0)emit('new-game-lua-wrapper',{history:'entry only; Lua caller and startscreen association unknown'});
    if(pc===0x42bbe0&&u(esp)===0x439237)enter('newGame',esp,0x439237,{level:u(esp+4),checkpoint:u(esp+8)});
    if(pc===0x42cc80&&u(esp)===0x42bc2c)enter('deferredStore',esp,0x42bc2c,{level:u(esp+4),checkpoint:u(esp+8)});
    if(pc===0x4019d2)emit('deferred-load-check');
    if(pc===0x42c990&&u(esp)===0x401a2d){if(deferred().loadFlag!==1)throw Error('loader flag mismatch');enter('loader',esp,0x401a2d);}
    if(pc===0x401a33&&frames.loadClear){if(esp!==frames.loadClear.esp||deferred().loadFlag!==0)throw Error('load consumption clear mismatch');emit('deferred-load-consumed');delete frames.loadClear;}
    if(pc===0x42cc1e)emit('level-lua-dispatch',{history:'native level lookup/call path; Lua execution result unknown'});
  }
  // 47d980's SUB ESP,8 + four pushes places return/args at +24/+28.
  // Capture bytes only from actual registers and that checked frame. The
  // object fields are established by 47cea0/47cf60/47da00, not live addresses.
  function decoderContext(phase,object,frame) {
    const registers=Object.fromEntries(['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi',
      'flag_op','flag_a','flag_b','flag_res','flag_sign_shift','yield_reason'].map(n=>[n,ex['get_'+n]()>>>0]));
    const words=Array.from({length:21},(_,i)=>u(object+i*4));
    const stack=Array.from({length:16},(_,i)=>u(registers.esp+i*4));
    const fields={readCallback:words[0],callbackArgument:words[1],inputBuffer:words[2],inputCapacity:words[3],
      inputCursor:words[4],inputRemaining:words[5]|0,bitReservoir:words[6],bitCount:words[7],
      sampleShift:words[8],channels:words[9],transformRows:words[10],blockWords:words[11],
      transformBuffer:words[13],remainingWords:words[18],decodedCursor:words[19],decodedWords:words[20]};
    const active=phase==='output'||phase==='output-sample';
    const cursors=active?{source:registers.esi,destination:registers.ebp,words:registers.edi,
      producedBytes:stack[4],requestedBytes:stack[9],shift:stack[5]}:null;
    const window=(address,bytes)=>bytes>0?{address,bytes:read(address,Math.min(16,bytes))}:null;
    const input=window(fields.inputCursor,fields.inputRemaining);
    const decoded=window(active?registers.esi:fields.decodedCursor,(active?registers.edi:fields.decodedWords)*4);
    const output=active?window(registers.ebp,Math.max(0,stack[9]-stack[4])):null;
    const capturedBytes=64+84+[input,decoded,output].reduce((n,w)=>n+(w?.bytes.length||0),0);
    if(capturedBytes>256)throw Error('decoder context byte bound');
    const slice=getSlice();
    return {phase,object,frame,registers,stack,objectWords:words,fields,cursors,capturedBytes,input,decoded,output,
      slice:slice?{budget:slice.budget,ordinal:slice.ordinal,completed:slice.completed}:null,
      history:'Bounded windows only; external callback/media and earlier execution are not reconstructed'};
  }
  function outputContext(phase) {
    const code='83ec0853568b5c241457c744240c00000000558b43208b734c8b7b508b6c242089442414837c242400743f85ff7519837b4800743553e84500000083c40485c074288b734c8b7b508b068a4c241483c60483c502d3f88344241002668945fe4f8b4424103b44242472c18b44241089734c5d897b505f5e5b83c408c3';
    if(read(0x47d980,code.length/2).map(v=>v.toString(16).padStart(2,'0')).join('')!==code)throw Error('original decoder bytes changed');
    const esp=ex.get_esp()>>>0,object=ex.get_ebx()>>>0;
    if(u(esp+28)!==object)throw Error('decoder frame/object mismatch');
    const frame={esp,caller:u(esp+24),object,destination:u(esp+32),requestedBytes:u(esp+36)};
    if(decoder&&(decoder.esp!==esp||decoder.object!==object||decoder.caller!==frame.caller))throw Error('decoder frame replaced');
    decoder=frame;return decoderContext(phase,object,frame);
  }
  function sample(){if(report.status!=='running')return report;try{if(now()>=deadline)return finish('deadline');identity();const current=level();
    if(!report.records.length&&!report.blocks&&(ex.get_eip()>>>0)===0x4434a0){
      const esp=ex.get_esp()>>>0;
      for(const [offset,ret]of [[16,0x44334d],[24,0x444ae3],[48,0x44324a],[56,0x443085],[80,0x40218c]])
        if(u(esp+offset)!==ret)throw Error('GC suffix frame mismatch');
      if(u(esp+20)!==(ex.get_edi()>>>0))throw Error('GC suffix table argument mismatch');
      frames.gc={esp:esp+80,caller:0x40218c,prefixUnknown:true};emit('gc-prefix-unobserved',{frame:{...frames.gc},history:'exact retained stack suffix; collection entry and graph unknown'});
    }
    // A frozen attachment can be inside an already issued SleepEx. This is
    // evidence of its remaining suffix, never evidence of a poll entry/return.
    // Authorize only the exact original call chain seen in the retained run.
    if(!report.records.length&&!report.blocks&&ex.get_eip()>>>0===0x4515cd){
      const esp=ex.get_esp()>>>0,r=resource();
      if(r.request&&r.active===r.request&&r.entry?.type===10&&
        u(esp)===CUTS.pollRead&&u(esp+4)===10&&u(esp+8)===0x44fb84&&u(esp+12)===r.request){
        suffix={esp,request:r.request,phase:'sleep-return'};
        emit('poll-prefix-unobserved',{observedFrom:0x4515cd,stack:[u(esp),u(esp+4),u(esp+8),u(esp+12)],history:'poll entry and SleepEx call unobserved'});
      }
    }
    emit('sample',{level:current,levelCreatedSincePreviousSample:previousLevel?.tag===-6&&current.tag===-3,
      ...(ex.get_eip()>>>0===0x47d9c8?{decoder:outputContext('output-sample')}:{})});previousLevel=current;
  }catch(e){report.error=e.message;finish('unsupported-or-unobservable');}return report;}
  function boundary(pc,esp){
    if(report.status!=='running')return;if(now()>=deadline){finish('deadline');return;}
    if(++report.blocks>maxBoundaries){finish('boundary-limit');return;}
    identity();pc>>>=0;esp>>>=0;if(pc!==(ex.get_eip()>>>0)||esp!==(ex.get_esp()>>>0))throw Error('wrong boundary registers');
    const r=resource();
    progression(pc,esp);if(report.status!=='running')return;
    if(pc===0x47d9c8&&!decoder)emit('decoder-output',{decoder:outputContext('output')});
    if(decoder&&pc===decoder.caller){
      if(esp!==decoder.esp+28)throw Error('decoder return stack mismatch');
      emit('decoder-return',{decoder:decoderContext('return',decoder.object,decoder)});decoder=null;
    }
    if(suffix){
      if(r.request!==suffix.request||r.active!==suffix.request||r.entry?.type!==10)throw Error('unobserved poll suffix request changed');
      if(suffix.phase==='sleep-return'){
        if(pc!==0x4515cd||esp!==suffix.esp||u(esp)!==CUTS.pollRead||u(esp+4)!==10||u(esp+8)!==0x44fb84||u(esp+12)!==suffix.request)throw Error('unobserved poll suffix initial boundary mismatch');
        suffix.phase='completion-read';return;
      }
      if(suffix.phase==='completion-read'){
        if(pc!==CUTS.pollRead||esp!==suffix.esp+4||u(esp)!==10||u(esp+4)!==0x44fb84||u(esp+8)!==suffix.request)throw Error('unobserved poll suffix read mismatch');
        suffix.phase='caller';emit('poll-suffix-read',{history:'poll prefix unknown; no poll-return claim'});return;
      }
      if(pc!==0x44fb84||esp!==suffix.esp+12||u(esp)!==suffix.request||ex.get_eax()>>>0!==r.completion)throw Error('unobserved poll suffix caller mismatch');
      emit('poll-suffix-end',{history:'poll prefix remains unknown'});suffix=null;
    }
    if(poll&&pc===poll.caller){if(esp!==poll.esp+4||ex.get_eax()>>>0!==r.completion)throw Error('poll return mismatch');emit('poll-return');poll=null;}
    if(pc===CUTS.poll)poll={esp,caller:u(esp)};
    if(pc===CUTS.pollRead&&!poll)throw Error('poll history missing');
    if(pc===CUTS.consume){if(r.completion!==1||!r.active||r.active!==r.request||r.entry?.type!==10)throw Error('wrong completion branch/request');emit('completion-consume');}
    if(pc===CUTS.finalize){if(r.entry?.type!==10||u(esp+4)!==r.request||r.entry.status!==2)throw Error('wrong type10 finalizer');finalizer={esp,caller:u(esp),request:r.request};emit('completion-finalizer-entry');}
    if(pc===CUTS.finalizeType10&&!finalizer)throw Error('finalizer history missing');
    if(finalizer&&pc===finalizer.caller){if(esp!==finalizer.esp+4||r.request!==finalizer.request)throw Error('finalizer return mismatch');emit('completion-finalizer-return');finalizer=null;}
    if(pc===CUTS.loadCall){
      // PUSH ESI / CALL precedes the callee that may publish the file request.
      // Read the actual argument now; an empty global cannot supply its identity.
      const request=ex.get_esi()>>>0,entry=request?requestEntry(request):null;
      if(!request||(r.request&&request!==r.request)||(r.active&&request!==r.active)||
        entry?.type!==10||entry.size!==192320||entry.name!=='level1')throw Error('wrong demand request');
      load={esp,request};emit('demand-call',{argument:{request,entry}});
    }
    if(pc===CUTS.loadReturned){if(!load||esp!==load.esp-4||r.request!==load.request||r.active||r.completion!==1)throw Error('demand return history/completion missing');emit('demand-return');load=null;}
    if(pc===CUTS.bufferCall){if(ex.get_esi()>>>0!==r.request||r.completion!==1||r.entry?.type!==10||r.active)throw Error('buffer request incomplete');buffer={esp,request:r.request};emit('script-buffer-call');}
    if(pc===CUTS.buffer){if(!buffer||u(esp)!==0x41fd06||u(esp+4)!==r.entry.buffer||u(esp+8)!==r.entry.size)throw Error('buffer call history/arguments missing');emit('script-buffer-entry');buffer=null;}
  }
  function wrapped(pc,esp,...rest){try{boundary(pc,esp);}catch(e){report.error=e.message;finish('unsupported-or-unobservable');}return Reflect.apply(original,this,[pc,esp,...rest]);}
  host.log_block=wrapped;owners.add(host);
  return {report,sample,finish,check(){if(report.status==='running'&&now()>=deadline)return finish('deadline');if(report.status==='running'&&!report.blocks){report.error='mandatory native boundaries missing';finish('unsupported-or-unobservable');}return report;}};
}
const api={EXE_SHA256,SCRIPT_SHA256,PINS,CUTS,attach,decodeFileSnapshot};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else globalThis.Mdk2LuaConstructionObserver=api;
})();
