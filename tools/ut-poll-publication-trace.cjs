'use strict';
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
    Atomics.store(v,at+width-1,seq);Atomics.store(v,at,seq);Atomics.store(v,0,seq);
  }
  addEventListener('message',event=>{
    const m=event.data;
    if(m?.t==='init'&&m.utPollPublication){
      const c=m.utPollPublication;
      config={control:new Int32Array(c.control),rows:new Int32Array(c.rows),slot:m.slot||0,endpoint:m.endpointIdentity};
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
  const rings=[],events=[],control=new Int32Array(new SharedArrayBuffer(8));
  control[0]=enabled?1:0;
  const NativeWorker=window.Worker,post=NativeWorker.prototype.postMessage;
  let next=0,active=null,serial=0,publication=0,terminal=false;
  const record=(kind,data)=>{if(terminal)return;if(!active&&events.length>=128)events.shift();events.push({kind,at:Date.now(),mono:performance.timeOrigin+performance.now(),serial:++serial,...data});};
  const pull=()=>{
    if(!active)return;
    for(const ring of rings){
      const v=new Int32Array(ring.rows),end=Atomics.load(v,0),start=Math.max(ring.read+1,end-8192+1);
      if(start>ring.read+1)record('LOST',{slot:ring.slot,from:ring.read+1,to:start-1});
      const rows=[];
      for(let s=start;s<=end;s++){const at=8+((s-1)%8192)*48;if(Atomics.load(v,at)!==s){record('TORN',{slot:ring.slot,sequence:s});break;}const row=Array.from(v.subarray(at,at+48));if(Atomics.load(v,at)!==s||row[47]!==s){record('TORN',{slot:ring.slot,sequence:s});break;}rows.push(row);ring.read=s;}
      if(rows.length)console.info('UT_POLL',JSON.stringify({nonce:active,slot:ring.slot,endpoint:ring.endpoint,names:ring.names,rows}));
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
    const ring={worker,rows:new SharedArrayBuffer((8+8192*48)*4),read:0,slot:null,endpoint:null,names:null};rings.push(ring);
    worker.postMessage=function(message,...rest){
      if(message?.t==='init'){ring.slot=message.slot||0;ring.endpoint=message.endpointIdentity;return Reflect.apply(post,this,[{...message,utPollPublication:{rows:ring.rows,control:control.buffer}},...rest]);}
      return Reflect.apply(post,this,[message,...rest]);
    };
    worker.addEventListener('message',e=>{if(e.data?.t==='utPollNames')ring.names=e.data.names;});
    worker.addEventListener('error',e=>record('worker-error',{message:e.message,slot:ring.slot}));
    return worker;
  }});
  // Observe the actual producer and status calls; no new guest poll is made.
  Object.defineProperty(window,'createBrowserNativeInput',{configurable:true,set(factory){
    Object.defineProperty(window,'createBrowserNativeInput',{configurable:true,writable:true,value:function(...args){
      const g=Reflect.apply(factory,this,args),observe=g.observe,status=g.status;
      g.observe=function(values){const r=Reflect.apply(observe,this,arguments);record('scene-publication',{accepted:r,counter:r?++publication:publication,values:Array.from(values),snapshot:g.snapshot()});return r;};
      g.status=function(nonce){const r=Reflect.apply(status,this,arguments);if(active)record('status',{nonce,state:r.state,appliedAt:r.appliedAt,consumedAt:r.consumedAt,fence:r.fence});if(['CANCELLED','UNKNOWN'].includes(r.state)){record('terminal',{state:r.state});pull();Atomics.store(control,0,0);active=null;terminal=true;}return r;};
      return g;
    }});
  }});
  window.__utPoll={snapshot(){pull();return {at:Date.now(),mono:performance.timeOrigin+performance.now(),publication,serial,rings:rings.map(r=>{
    const v=new Int32Array(r.rows),end=Atomics.load(v,0),tail=[];let complete=true;
    for(let s=Math.max(1,end-63);s<=end;s++){const a=8+((s-1)%8192)*48,row=Array.from(v.subarray(a,a+48));if(row[0]!==s||row[47]!==s||Atomics.load(v,a)!==s){complete=false;break;}tail.push(row);}
    return {slot:r.slot,endpoint:r.endpoint,names:r.names,read:r.read,end,complete,tail};})};},arm(nonce){if(terminal||active)throw Error('timeline terminal/active');active=nonce;for(const r of rings)r.read=Math.max(0,Atomics.load(new Int32Array(r.rows),0)-2048);Atomics.store(control,0,enabled?1:0);record('armed',{nonce,prehistory:'at most2048 CPU rows and128 page events; completeness begins here',workers:rings.map(r=>({slot:r.slot,endpoint:r.endpoint,names:r.names})),enabled});pull();},flush:pull,finish(){pull();active=null;},summary:()=>({enabled,rings:rings.length,terminal})};
  setInterval(pull,20);
}
function source(){return workerBootstrap.toString();}
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
module.exports={workerBootstrap,installPage,source,decode,fields,kinds,verifyTrace};

