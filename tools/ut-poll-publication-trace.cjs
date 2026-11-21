'use strict';
// Pure reads only. In particular, guest_to_wasm may run a fault callback.
// Returning bytes is not a disassembly or a claim that ESP names a stack.
function captureBoundary(ex, memory, map) {
  const get=n=>typeof ex[n]==='function'?Number(ex[n]())>>>0:null;
  const words=new Int32Array(memory.buffer),dv=new DataView(memory.buffer);
  function bytes(p,n) {
    if(!map||!Number.isInteger(p)||p<0||p+n>0x100000000)return null;
    const out=[];
    for(let i=0;i<n;i++){
      const q=p+i,direct=map.g2w(q,get('get_image_base'));let a=null;
      if(direct>=0&&direct<map.BASE.VIRTUAL_BACKING_BASE)a=direct;
      else {const cell=map.BASE.GUEST_PAGE_TABLE+((q>>>10)&0x3ffffc);
        if(cell+4>memory.buffer.byteLength)return null;
        const pte=Atomics.load(words,cell>>>2);if(pte&0x800)a=((pte&0xfffff000)|(q&4095))>>>0;}
      if(a===null||a===0xf0||a>=memory.buffer.byteLength)return null;
      out.push(dv.getUint8(a));
    }return out;
  }
  const registers=Object.fromEntries(['eip','esp','ebp','eax','ebx','ecx','edx','esi','edi'].map(n=>[n,get('get_'+n)]));
  const pc=registers.eip,base=get('get_dll_table'),count=get('get_dll_count'),life=get('get_dll_lifecycle_table'),stride=get('get_dll_lifecycle_stride');
  let module=null,inventoryComplete=count!==null&&count<=128,ambiguous=false;
  if(base!==null&&inventoryComplete&&base+count*32<=memory.buffer.byteLength){
    for(let i=0;i<count;i++){
      const row=base+i*32,l=life===null?null:life+i*stride;
      if(l!==null&&(stride!==64||l+64>memory.buffer.byteLength)){inventoryComplete=false;break;}
      const state=l===null?null:Atomics.load(words,l>>>2),generation=l===null?null:Atomics.load(words,(l+4)>>>2)>>>0;
      const b=Atomics.load(words,row>>>2)>>>0,size=Atomics.load(words,(row+4)>>>2)>>>0;
      if(!b||!size||pc<b||pc-b>=size)continue;
      let path=null;const paths=get('get_dll_path_table');
      if(paths!==null&&paths+i*4+4<=memory.buffer.byteLength){const p=dv.getUint32(paths+i*4,true),v=p?bytes(p,128):null;if(v&&v.includes(0))path=String.fromCharCode(...v.slice(0,v.indexOf(0)));}
      const stable=l!==null&&state!==0&&state===Atomics.load(words,l>>>2)&&generation===(Atomics.load(words,(l+4)>>>2)>>>0)&&b===(Atomics.load(words,row>>>2)>>>0)&&size===(Atomics.load(words,(row+4)>>>2)>>>0);
      if(module)ambiguous=true;
      module={index:i,base:b,size,generation,state,path,stable};
    }
  }else inventoryComplete=false;
  const main=get('get_image_base');let mainSize=get('get_exe_size_of_image'),mainSizeSource='export';
  // Execution Workers may inherit image_base without the loader instance's
  // local exe_size_of_image global. Read only bounded mapped PE headers.
  if(main!==null&&!mainSize){
    const dos=bytes(main,64);
    if(dos?.[0]===0x4d&&dos[1]===0x5a){const off=new DataView(Uint8Array.from(dos).buffer).getUint32(60,true);
      if(off<=4096&&main+off+88<=0x100000000){const pe=bytes(main+off,88);
        if(pe?.[0]===0x50&&pe[1]===0x45&&pe[2]===0&&pe[3]===0){mainSize=new DataView(Uint8Array.from(pe).buffer).getUint32(80,true);mainSizeSource='mapped PE header';}}
    }
  }
  if(main!==null&&mainSize&&pc>=main&&pc-main<mainSize){if(module)ambiguous=true;module={index:-1,base:main,size:mainSize,stable:true};}
  const code=pc===null?null:bytes(pc,64);
  // A code read must finish in the same mapping generation as its metadata.
  if(module?.index>=0){const l=life+module.index*stride,row=base+module.index*32;
    module.stable=module.stable&&module.state===Atomics.load(words,l>>>2)&&module.generation===(Atomics.load(words,(l+4)>>>2)>>>0)&&module.base===(Atomics.load(words,row>>>2)>>>0)&&module.size===(Atomics.load(words,(row+4)>>>2)>>>0);}
  return {registers,module,code,inventoryComplete,ambiguous,imageBase:main,mainSize,mainSizeSource,codeInModule:!!module&&pc-module.base+64<=module.size,
    registerSemantics:'exported active register bank; boundary-specific, no stack inference'};
}
// Hash the exact staged file consumed by the existing loader. The copy is
// bounded, private and discarded after SHA-256; no guest mapping is touched.
function moduleHashesBootstrap() {
  const instantiate=WebAssembly.instantiate,Instance=WebAssembly.Instance;
  const pending=new Set(),records=[];
  globalThis.__utImages={records,pending};
  function bind(instance,imports) {
    const ex=instance.exports,memory=imports?.host?.memory;
    if(!memory)return instance;
    const facade=Object.create(null);
    for(const [name,fn]of Object.entries(ex)){
      let value=fn;
      if(['load_pe','load_dll'].includes(name))value=function(...args){
        if(globalThis.__utObserverEnabled===false)return Reflect.apply(fn,ex,args);
        if(records.length>=128){globalThis.__utImages.overflow=true;return Reflect.apply(fn,ex,args);}
        const n=args[0]>>>0,p=ex.get_staging()>>>0;
        const raw=n&&n<=16*1024*1024&&p+n<=memory.buffer.byteLength?Uint8Array.from(new Uint8Array(memory.buffer,p,n)):null;
        const result=Reflect.apply(fn,ex,args);
        const index=name==='load_pe'?-1:ex.get_last_loaded_dll_index?.();
        const dv=new DataView(memory.buffer),row=index>=0?(ex.get_dll_table()>>>0)+index*32:null;
        const record={kind:'loaded-file',loader:name,index,result,bytes:n,
          base:index===-1?ex.get_image_base()>>>0:row===null?null:dv.getUint32(row,true),
          size:index===-1?ex.get_exe_size_of_image()>>>0:row===null?null:dv.getUint32(row+4,true),
          generation:index>=0?ex.get_dll_generation?.(index)>>>0:null,at:Date.now(),producer:globalThis.__utObserverIdentity||null};
        records.push(record);
        if(raw){const promise=crypto.subtle.digest('SHA-256',raw).then(hash=>{
          record.sha256=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
          console.info('UT_IMAGE',JSON.stringify(record));
          if(typeof document==='undefined')globalThis.postMessage({t:'utLoadedFile',record});
        }).catch(e=>{record.error=String(e);}).finally(()=>pending.delete(promise));pending.add(promise);}
        else record.error='staged image outside capture bound';
        return result;
      };
      Object.defineProperty(facade,name,{enumerable:true,value});
    }
    return new Proxy(instance,{get(t,k){return k==='exports'?facade:Reflect.get(t,k,t);}});
  }
  WebAssembly.instantiate=async function(source,imports){const r=await Reflect.apply(instantiate,this,arguments);return r.instance?{...r,instance:bind(r.instance,imports)}:bind(r,imports);};
  WebAssembly.Instance=new Proxy(Instance,{construct(t,args,n){return bind(Reflect.construct(t,args,n===WebAssembly.Instance?t:n),args[1]);}});
}
// UT task observer, derived from the published MDK2 poll timeline.
// Optional task observer. Only the separate diagnostic SAB is written. The
// original Worker URL, imports, module, arguments, results and clocks survive.
function workerBootstrap() {
  let config=null, exports=null, memory=null, names=[], current=0, depth=0;
  const width=48, header=8, capacity=8192;
  const clock=()=>performance.timeOrigin+performance.now();
  function record(kind,id=0,a=0,b=0,result=0) {
    if(!config||!Atomics.load(config.control,0))return;
    const v=config.rows, seq=Atomics.load(v,0)+1, at=header+((seq-1)%capacity)*width;
    // A single owning Worker writes this ring. Readers verify both stamps.
    Atomics.store(v,at,0);
    const read=n=>typeof exports?.[n]==='function'?Number(exports[n]()):0;
    const time=clock(), stack=[], sp=read('get_esp')>>>0;let mask=0;
    // Mirror only direct and present sparse-page translations with JS reads.
    // guest_to_wasm can invoke a fault handler on a miss, so never call it.
    const map=globalThis.RegionMap;
    for(let i=0;i<16;i++){let value=0;try{
      const p=(sp+i*4)>>>0,direct=map?.g2w(p,read('get_image_base'));
      let a=null;
      if(map&&sp&&p>=sp&&(p&4095)<=4092){
        if(direct+4<=map.BASE.VIRTUAL_BACKING_BASE)a=direct;
        else {const cell=map.BASE.GUEST_PAGE_TABLE+((p>>>10)&0x3ffffc),pte=Atomics.load(new Int32Array(memory.buffer),cell>>>2);if(pte&0x800)a=((pte&0xfffff000)|(p&4095))>>>0;}
      }
      if(a!==null&&a!==0xf0&&a+4<=memory.buffer.byteLength){value=new DataView(memory.buffer).getInt32(a,true);mask|=1<<i;}
    }catch{}stack.push(value);}
    const values=[seq,time>>>0,Math.floor(time/4294967296),kind,id,a,b,result,
      config.slot,config.endpoint,read('get_current_thread_id'),read('get_eip'),
      read('get_yield_reason'),read('get_sleep_timeout'),read('get_esp'),
      read('get_eax'),current,depth,read('get_main_hwnd'),read('get_focus_hwnd'),
      read('modal_dialog_hwnd'),read('get_capture_hwnd'),
      // RPC and GPU waits are read from the actual owning slot.
      config.rpc?Atomics.load(config.rpc,0):0,
      config.rpc?Atomics.load(config.rpc,1):0,
      config.rpc?Atomics.load(config.rpc,57):0,
      config.pub?Atomics.load(config.pub,8):0,
      config.pub?Atomics.load(config.pub,7):0,
      read('get_ebp'),mask,...stack,read('get_dll_callback_owner'),
      read('get_dll_callback_lock')];
    for(let i=1;i<values.length;i++)v[at+i]=values[i]|0;
    if(config.details&&exports&&globalThis.__utCaptureBoundary){
      const d=config.details,bank=(seq&1)*8192+8;
      Atomics.store(d,1,seq);
      Atomics.store(d,bank,0);
      try{const payload=JSON.stringify({sequence:seq,at:time,kind,slot:config.slot,endpoint:config.endpoint,...globalThis.__utCaptureBoundary(exports,memory,globalThis.RegionMap)});
        if(payload.length>8188)throw Error('bounded snapshot overflow');
        d[bank+1]=payload.length;for(let i=0;i<payload.length;i++)d[bank+2+i]=payload.charCodeAt(i);
        Atomics.store(d,bank+8191,seq);Atomics.store(d,bank,seq);Atomics.store(d,0,seq);
      }catch{Atomics.store(d,0,-seq);}
    }
    Atomics.store(v,at+width-1,seq);Atomics.store(v,at,seq);Atomics.store(v,0,seq);
  }
  addEventListener('message',event=>{
    const m=event.data;
    if(m?.t==='init'&&m.utPollPublication){
      const c=m.utPollPublication;
      config={control:new Int32Array(c.control),rows:new Int32Array(c.rows),details:c.details?new Int32Array(c.details):null,slot:m.slot||0,endpoint:m.endpointIdentity};
      globalThis.__utObserverEnabled=!!Atomics.load(config.control,0);
      globalThis.__utObserverIdentity={slot:config.slot,endpoint:config.endpoint};
    }
    if(m?.t==='slice')record(1,0,m.steps||0,m.localSleep?.preWaitMs||0);
  });
  const originalPost=globalThis.postMessage;
  globalThis.postMessage=function(m,...rest){
    if(m?.t==='sliceDone'||m?.t==='error')record(2,0,m.yield||0,m.sleepMs||m.sleepLeftMs||0,m.blocks||0);
    return Reflect.apply(originalPost,this,[m,...rest]);
  };
  const wait=Atomics.wait;
  Atomics.wait=function(array,index,value,timeout){
    record(7,current,index,Number.isFinite(timeout)?Math.ceil(timeout):-1);
    try{const r=Reflect.apply(wait,this,arguments);record(8,current,index,0,r==='timed-out'?1:r==='not-equal'?2:0);return r;}
    catch(e){record(9,current);throw e;}
  };
  function importsWrapped(imports) {
    if(!imports?.host?.memory)return {imports,bind:x=>x};
    memory=imports.host.memory;const host={...imports.host};names=Object.keys(host).filter(n=>typeof host[n]==='function').sort();
    const identities=['check_input','input_validate','input_consumed','di_mouse_receipt'];
    for(let i=0;i<names.length;i++){
      const name=names[i],fn=host[name],id=i+1;
      host[name]=function(...args){
        const prior=current;current=id;depth++;
        if(identities.includes(name)||/^(gpu_|log$|log_api_exit$|log_wndproc)/.test(name))record(3,id,args[0]||0,args[3]||0,args[4]||0);
        try{const r=Reflect.apply(fn,this,args);if(identities.includes(name)||/^(gpu_|log$|log_api_exit$|log_wndproc)/.test(name))record(4,id,args[0]||0,args[3]||0,r);return r;}
        catch(e){record(9,id);throw e;}finally{current=prior;depth--;}
      };
    }
    if(config&&globalThis.GuestRpc){const v=GuestRpc.views(host.memory,config.slot);config.rpc=v.i32;config.pub=v.pub;}
    if(config)originalPost.call(globalThis,{t:'utPollNames',names,slot:config.slot,endpoint:config.endpoint});
    return {imports:{...imports,host},bind(instance){
      exports=instance.exports;
      const facade=Object.create(null);
      for(const [name,fn]of Object.entries(exports))Object.defineProperty(facade,name,{enumerable:true,value:name==='run'?function(...args){record(5,0,args[0]||0);try{const r=Reflect.apply(fn,exports,args);record(6,0,0,0,r);return r;}catch(e){record(9,0);throw e;}}:fn});
      return new Proxy(instance,{get(t,k){return k==='exports'?facade:Reflect.get(t,k,t);}});
    }};
  }
  const instantiate=WebAssembly.instantiate,Instance=WebAssembly.Instance;
  WebAssembly.instantiate=async function(source,imports){const b=importsWrapped(imports),r=await Reflect.apply(instantiate,this,[source,b.imports]);return r.instance?{...r,instance:b.bind(r.instance)}:b.bind(r);};
  WebAssembly.Instance=new Proxy(Instance,{construct(t,args,n){const b=importsWrapped(args[1]);return b.bind(Reflect.construct(t,[args[0],b.imports],n===WebAssembly.Instance?t:n));}});
}

function installPage(bootstrapSource,{enabled=true}={}) {
  const rings=[],events=[],imageRecords=[],control=new Int32Array(new SharedArrayBuffer(8));
  const images=()=>[...(globalThis.__utImages?.records||[]),...imageRecords];
  control[0]=enabled?1:0;
  const NativeWorker=window.Worker,post=NativeWorker.prototype.postMessage;
  let next=0,active=null,serial=0,publication=0,terminal=false;
  const record=(kind,data)=>{if(terminal)return;if(!active&&events.length>=128)events.shift();events.push({kind,at:Date.now(),mono:performance.timeOrigin+performance.now(),serial:++serial,...data});};
  const detail=ring=>{
    const d=new Int32Array(ring.details),s=Atomics.load(d,0),a=(s&1)*8192+8;
    if(s<=0)return {complete:false,sequence:s};
    const n=Atomics.load(d,a+1);if(n<0||n>8188||Atomics.load(d,a)!==s)return {complete:false,sequence:s};
    const body=String.fromCharCode(...d.subarray(a+2,a+2+n));
    if(Atomics.load(d,a)!==s||Atomics.load(d,a+8191)!==s)return {complete:false,sequence:s};
    try{return {complete:true,activeSequence:Atomics.load(d,1),...JSON.parse(body)};}catch{return {complete:false,sequence:s};}
  };
  const pull=()=>{
    if(!active)return;
    for(const ring of rings){
      const v=new Int32Array(ring.rows),end=Atomics.load(v,0),start=Math.max(ring.read+1,end-8192+1);
      if(start>ring.read+1)record('LOST',{slot:ring.slot,from:ring.read+1,to:start-1});
      const rows=[];
      for(let s=start;s<=end;s++){const at=8+((s-1)%8192)*48;if(Atomics.load(v,at)!==s){record('TORN',{slot:ring.slot,sequence:s});break;}const row=Array.from(v.subarray(at,at+48));if(Atomics.load(v,at)!==s||row[47]!==s){record('TORN',{slot:ring.slot,sequence:s});break;}rows.push(row);ring.read=s;}
      if(rows.length)console.info('UT_POLL',JSON.stringify({nonce:active,slot:ring.slot,endpoint:ring.endpoint,names:ring.names,detail:detail(ring),rows}));
    }
    if(events.length)console.info('UT_POLL_PAGE',JSON.stringify({nonce:active,events:events.splice(0)}));
  };
  window.Worker=new Proxy(NativeWorker,{construct(t,args,n){
    const url=new URL(String(args[0]),location.href),selected=url.pathname.endsWith('/lib/guest-worker.js');
    if(!selected||!enabled)return Reflect.construct(t,args,n===window.Worker?t:n);
    // A classic Worker needs the original /lib/ base and version query for
    // its ordinary relative importScripts/fetch/child Worker resolutions.
    // The task server exposes this one separate bootstrap; immutable source
    // bytes continue to load from the original URL and are independently hashed.
    const observerURL=new URL(url);observerURL.pathname='/lib/__ut_poll_bootstrap.js';
    observerURL.searchParams.set('original',url.href);
    const worker=Reflect.construct(t,[observerURL.href,...args.slice(1)],n===window.Worker?t:n);
    const ring={worker,rows:new SharedArrayBuffer((8+8192*48)*4),details:new SharedArrayBuffer((8+8192*2)*4),read:0,slot:null,endpoint:null,names:null};rings.push(ring);
    worker.postMessage=function(message,...rest){
      if(message?.t==='init'){ring.slot=message.slot||0;ring.endpoint=message.endpointIdentity;return Reflect.apply(post,this,[{...message,utPollPublication:{rows:ring.rows,details:ring.details,control:control.buffer}},...rest]);}
      return Reflect.apply(post,this,[message,...rest]);
    };
    worker.addEventListener('message',e=>{
      if(e.data?.t==='utPollNames')ring.names=e.data.names;
      if(e.data?.t==='utLoadedFile'){
        const r=e.data.record,identityMatch=r.producer?.slot===ring.slot&&r.producer?.endpoint===ring.endpoint;
        if(imageRecords.length>=512){record('image-overflow',{});return;}
        imageRecords.push({...r,slot:ring.slot,endpoint:ring.endpoint,identityMatch});
        record('loaded-file',{image:imageRecords.at(-1)});
      }
    });
    worker.addEventListener('error',e=>record('worker-error',{message:e.message,slot:ring.slot}));
    return worker;
  }});
  // Observe the actual producer and status calls; no new guest poll is made.
  Object.defineProperty(window,'createBrowserNativeInput',{configurable:true,set(factory){
    Object.defineProperty(window,'createBrowserNativeInput',{configurable:true,writable:true,value:function(...args){
      const g=Reflect.apply(factory,this,args),observe=g.observe,status=g.status,validate=g.validate;
      g.observe=function(values){const r=Reflect.apply(observe,this,arguments);record('scene-publication',{accepted:r,counter:r?++publication:publication,values:Array.from(values),snapshot:g.snapshot()});return r;};
      g.validate=function(token,values){const r=Reflect.apply(validate,this,arguments);if(token===-1)record('native-message-wait-publication',{values:Array.from(values),snapshot:g.snapshot()});return r;};
      g.status=function(nonce){const r=Reflect.apply(status,this,arguments);if(active)record('status',{nonce,state:r.state,appliedAt:r.appliedAt,consumedAt:r.consumedAt,fence:r.fence});if(['CANCELLED','UNKNOWN'].includes(r.state)){record('terminal',{state:r.state,boundaries:rings.map(detail),images:images()});pull();Atomics.store(control,0,0);active=null;terminal=true;}return r;};
      return g;
    }});
  }});
  window.__utPoll={snapshot(){pull();return {at:Date.now(),mono:performance.timeOrigin+performance.now(),publication,serial,images:images(),rings:rings.map(r=>{
    const v=new Int32Array(r.rows),end=Atomics.load(v,0),tail=[];let complete=true;
    for(let s=Math.max(1,end-63);s<=end;s++){const a=8+((s-1)%8192)*48,row=Array.from(v.subarray(a,a+48));if(row[0]!==s||row[47]!==s||Atomics.load(v,a)!==s){complete=false;break;}tail.push(row);}
    return {slot:r.slot,endpoint:r.endpoint,names:r.names,read:r.read,end,complete,tail,detail:detail(r)};})};},arm(nonce){if(terminal||active)throw Error('timeline terminal/active');active=nonce;for(const r of rings)r.read=Math.max(0,Atomics.load(new Int32Array(r.rows),0)-2048);Atomics.store(control,0,enabled?1:0);record('armed',{nonce,prehistory:'at most2048 CPU rows and128 page events; completeness begins here',workers:rings.map(r=>({slot:r.slot,endpoint:r.endpoint,names:r.names})),enabled});pull();},flush:pull,finish(){pull();active=null;},summary:()=>({enabled,rings:rings.length,terminal})};
  setInterval(pull,20);
}
function source(){return 'function(){globalThis.__utCaptureBoundary='+captureBoundary.toString()+';('+moduleHashesBootstrap.toString()+')();('+workerBootstrap.toString()+')();}';}
const fields=['sequence','timeLow','timeHigh','kind','importId','arg0','arg3','result','slot','endpoint','thread','eip','yield','sleepTimeout','esp','eax','activeImport','depth','main','focus','modal','capture','rpcStatus','rpcImportId','renderWait','inputPending','generation','ebp','stackMask',...Array.from({length:16},(_,i)=>'stack'+i),'lockIdentity','dllCallbackLockAddress','commit'];
const kinds={1:'slice-entry',2:'slice-return',3:'import-entry',4:'import-return',5:'run-entry',6:'run-return',7:'wait-entry',8:'wait-return',9:'error'};
function decode(row,names){const r=Object.fromEntries(fields.map((n,i)=>[n,row[i]]));r.at=(row[1]>>>0)+(row[2]>>>0)*4294967296;r.kind=kinds[row[3]]||row[3];r.import=names?.[row[4]-1]||null;r.activeImport=names?.[row[16]-1]||null;r.eip>>>=0;return r;}

function verifyTrace(batches,events,{armed=false}={}) {
  if(!armed)throw Error('trace not prearmed');
  if(events.some(e=>['LOST','TORN','worker-error'].includes(e.kind)))throw Error('incomplete trace');
  const seen=new Map();let count=0;
  for(const b of batches){
    if(!Number.isInteger(b.slot)||!b.endpoint||!Array.isArray(b.names))throw Error('trace identity missing');
    const key=b.slot+':'+b.endpoint;
    for(const row of b.rows){
      if(row.length!==48||row[0]!==row[47]||row[8]!==b.slot||row[9]!==b.endpoint)throw Error('torn or foreign trace');
      const prior=seen.get(key);
      if(prior!==undefined&&row[0]!==prior+1)throw Error('dropped trace');
      seen.set(key,row[0]);count++;
    }
  }
  if(!count)throw Error('empty trace');
  return {complete:true,count,workers:seen.size};
}
function verifyCodeIdentity(boundary,image,expected,{slot,endpoint,sha256}={}) {
  if(!boundary?.complete||!Number.isInteger(boundary.sequence)||boundary.sequence<=0||boundary.slot!==slot||boundary.endpoint!==endpoint)throw Error('torn or foreign boundary');
  const m=boundary.module;
  if(!boundary.inventoryComplete||boundary.ambiguous||!m?.stable||!boundary.codeInModule||!boundary.code||boundary.code.length!==64)throw Error('unmapped or unstable code identity');
  if(!image?.sha256||image.error||image.loader!==(m.index===-1?'load_pe':'load_dll')||image.sha256!==sha256||image.base!==m.base||image.size!==m.size||image.index!==m.index||(m.index>=0&&image.generation!==m.generation))throw Error('loaded file identity mismatch');
  if(!expected||expected.length!==64||boundary.code.some((v,i)=>v!==expected[i]))throw Error('code bytes mismatch');
  return {verified:true,rva:boundary.registers.eip-m.base,sha256:image.sha256};
}
module.exports={captureBoundary,moduleHashesBootstrap,workerBootstrap,installPage,source,decode,fields,kinds,verifyTrace,verifyCodeIdentity};

