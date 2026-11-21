'use strict';
// Task-only preinstalled observer. Separate single-writer SAB per physical
// Worker; never writes guest/ring memory or changes a scheduling deadline.
const fields = ['stamp','timeLow','timeHigh','kind','identity','role','ring',
  'write_pos','read_pos','submit_seq','done_seq','consumer','error_code',
  'op','bytes','seq','route','value','commit'];
const width=fields.length, capacity=4096, header=8;
function workerBootstrap() {
  let c=null, activeRing=0, GS=null, DB=null;
  const width=19, capacity=4096, header=8, patched=new WeakSet();
  const kinds={waitEntry:1,waitReturn:2,drainEntry:3,drainReturn:4,recordEntry:5,
    recordReturn:6,store:7,create:8,destroy:9,error:10,schedule:11,dispatch:12,dispatchReturn:13};
  function snapshot(kind,ring=activeRing,rec=null,route=0,value=0) {
    if(!c||!Atomics.load(c.control,0))return;
    const v=c.rows,s=Atomics.load(v,0)+1,a=header+((s-1)%capacity)*width;
    const now=performance.timeOrigin+performance.now(),values=[s,now>>>0,Math.floor(now/4294967296),kinds[kind],c.identity,c.role,ring];
    const g=globalThis.GpuStreamGenerated,mem=c.memory?.buffer;
    if(g&&mem&&ring&&ring+g.LAYOUTS.GpsRing.size<=mem.byteLength){
      const i32=new Int32Array(mem),off=n=>g.LAYOUTS.GpsRing.fields.find(f=>f.name===n).offset;
      const read=n=>Atomics.load(i32,(ring+off(n))>>>2)>>>0;
      values.push(...['write_pos','read_pos','submit_seq','done_seq','consumer','error_code'].map(read));
      const rp=read('read_pos'),wp=read('write_pos'),rb=read('ring_bytes'),rd=read('ring_data');
      const p=rd+(rp&(rb-1)),dv=new DataView(mem);
      // At record return read_pos still identifies that record. WRAP has
      // only eight bytes; never read a nonexistent sequence past its end.
      if(rec)values.push(rec.op,rec.bytes,rec.seq);
      else if(rp!==wp&&p+8<=mem.byteLength){const op=dv.getUint16(p,true),bytes=dv.getUint32(p+4,true);values.push(op,bytes,op===g.OP.WRAP?0:p+12<=mem.byteLength?dv.getUint32(p+8,true):0);}
      else values.push(0,0,0);
    } else values.push(0,0,0,0,0,0,0,0,0);
    values.push(route,value,s);
    Atomics.store(v,a,0);
    for(let i=1;i<width;i++)v[a+i]=values[i]|0;
    Atomics.store(v,a,s);Atomics.store(v,0,s);
  }
  function patch() {
    const db=globalThis.GpuStreamDoorbell,rw=globalThis.GpuStreamRenderWorker;
    let gs=globalThis.GpuStream;
    if(db&&!patched.has(db)){
      patched.add(db);DB=db;const wait=db.waitDrained;
      db.waitDrained=function(i32,ring,...rest){const old=activeRing;activeRing=ring;snapshot('waitEntry');try{const r=Reflect.apply(wait,this,[i32,ring,...rest]);snapshot('waitReturn',ring,null,0,r.drained?1:0);return r;}catch(e){snapshot('error');throw e;}finally{activeRing=old;}};
    }
    if(gs&&!patched.has(gs)){
      // The shipped module freezes its public object. Install the task facade
      // immediately after import, before the endpoint captures that object.
      if(Object.isFrozen(gs)){patched.add(gs);gs={...gs};globalThis.GpuStream=gs;}
      patched.add(gs);GS=gs;const drain=gs.drain,store=gs.Ring.prototype.store;
      gs.Ring.prototype.store=function(n,v){const r=Reflect.apply(store,this,arguments);if(['read_pos','done_seq','error_code'].includes(n))snapshot('store',this.addr,null,0,n==='read_pos'?1:n==='done_seq'?2:3);return r;};
      gs.drain=function(rings,executor,...rest){
        const old=activeRing;activeRing=rings[0]?.addr||0;
        const route=globalThis.GpuStreamWebGL&&executor instanceof GpuStreamWebGL.Executor?1:globalThis.GpuStreamSoftware&&executor instanceof GpuStreamSoftware.Executor?2:3;
        snapshot('drainEntry',activeRing,null,route);
        const proxy=new Proxy(executor,{get(t,k){if(k==='execute')return function(rec){const addr=rec.ring?.addr||activeRing;const fixed={op:rec.op,bytes:rec.size,seq:rec.seq};snapshot('recordEntry',addr,fixed,route);try{const r=Reflect.apply(t.execute,t,[rec]);snapshot('recordReturn',addr,fixed,route);return r;}catch(e){snapshot('error',addr,fixed,route);throw e;}};const v=Reflect.get(t,k,t);return typeof v==='function'?v.bind(t):v;}});
        try{const r=Reflect.apply(drain,this,[rings,proxy,...rest]);snapshot('drainReturn',activeRing,null,route,r.records);return r;}catch(e){snapshot('error');throw e;}finally{activeRing=old;}
      };
    }
    if(rw&&!patched.has(rw)){
      patched.add(rw);const create=rw.create;
      rw.create=function(options){
        const schedule=options.schedule;let lastRing=0;
        const o=schedule?{...options,schedule(fn){snapshot('schedule',lastRing);return schedule.call(options,()=>{snapshot('dispatch',lastRing);try{return fn();}finally{snapshot('dispatchReturn',lastRing);}});}}:options;
        const endpoint=Reflect.apply(create,this,[o]);snapshot('create',0,null,0,options.endpointId);const destroy=endpoint.destroy,execute=endpoint.execute;
        endpoint.execute=function(message){lastRing=message?.ring>>>0;return Reflect.apply(execute,this,arguments);};
        endpoint.destroy=function(){snapshot('destroy',endpoint.identity().ring);return Reflect.apply(destroy,this,arguments);};return endpoint;
      };
    }
  }
  addEventListener('message',event=>{const m=event.data;if(m?.mdk2GpuTrace){const t=m.mdk2GpuTrace;c={...t,rows:new Int32Array(t.rows),control:new Int32Array(t.control),memory:m.memory||t.memory};}patch();});
  const imports=globalThis.importScripts;
  if(imports)globalThis.importScripts=function(...args){const r=Reflect.apply(imports,this,args);patch();return r;};
  const wait=Atomics.wait;
  Atomics.wait=function(...args){if(activeRing)snapshot('waitEntry');try{const r=Reflect.apply(wait,this,args);if(activeRing)snapshot('waitReturn',activeRing,null,0,r==='timed-out'?1:r==='not-equal'?2:0);return r;}catch(e){if(activeRing)snapshot('error');throw e;}};
  globalThis.__mdk2GpuTrace={patch,configure(t){c={...t,rows:new Int32Array(t.rows),control:new Int32Array(t.control)};patch();}};
}
function read(buffer,after=0){
  const v=new Int32Array(buffer),end=Atomics.load(v,0),start=Math.max(after+1,end-capacity+1),rows=[];
  let through=after;
  for(let s=start;s<=end;s++){const at=header+((s-1)%capacity)*width;if(Atomics.load(v,at)!==s)break;const values=Array.from(v.subarray(at,at+width));if(values.at(-1)!==s||Atomics.load(v,at)!==s)break;const row=Object.fromEntries(fields.map((n,i)=>[n,values[i]]));row.at=(row.timeLow>>>0)+(row.timeHigh>>>0)*4294967296;for(const n of ['ring','write_pos','read_pos','submit_seq','done_seq','consumer','op','bytes','seq'])row[n]>>>=0;rows.push(row);through=s;}
  return {rows,through,end,lost:Math.max(0,start-after-1),incomplete:through!==end};
}
function validateIdentity(actual,expected){
  if(!actual||actual.retired||!actual.source||!actual.module||actual.source!==expected.source||actual.module!==expected.module||actual.identity!==expected.identity||actual.role!==expected.role)throw Error('worker source/module/lifecycle identity mismatch');
  return true;
}
function installPage() {
  const Native=window.Worker,post=Native.prototype.postMessage,workers=[],map=new WeakMap();
  const control=new Int32Array(new SharedArrayBuffer(4));control[0]=1;
  let serial=0,terminal=false;
  Native.prototype.postMessage=function(message,...rest){
    const row=map.get(this);
    if(row&&['init','render-init'].includes(message?.t)){
      row.slot=message.slot??null;row.endpoint=message.endpointIdentity??null;
      message={...message,mdk2GpuTrace:{rows:row.rows,control:control.buffer,identity:row.identity,role:row.role}};
    }
    return Reflect.apply(post,this,[message,...rest]);
  };
  window.Worker=new Proxy(Native,{construct(t,args,n){
    const original=new URL(String(args[0]),location.href),cpu=/\/(guest-worker|__mdk2_poll_bootstrap)\.js$/.test(original.pathname),render=original.pathname.endsWith('/d3d-render-worker.js');
    if(!cpu&&!render)return Reflect.construct(t,args,n===window.Worker?t:n);
    const url=new URL(original);url.pathname='/lib/__mdk2_gpu_bootstrap.js';url.searchParams.set('original',original.href);
    const worker=Reflect.construct(t,[url.href,...args.slice(1)],n===window.Worker?t:n);
    const row={identity:++serial,role:cpu?1:2,original:original.href,bootstrap:url.href,rows:new SharedArrayBuffer((8+4096*19)*4),through:0,slot:null,endpoint:null,retired:false};
    workers.push(row);map.set(worker,row);
    worker.addEventListener('error',e=>console.info('MDK2_GPU_LIFECYCLE',JSON.stringify({identity:row.identity,at:Date.now(),error:e.message})));
    const terminate=worker.terminate;worker.terminate=function(){row.retired=true;return Reflect.apply(terminate,this,arguments);};return worker;
  }});
  function flush(){
    if(terminal)return;
    for(const row of workers){const v=new Int32Array(row.rows),end=Atomics.load(v,0),start=Math.max(row.through+1,end-4096+1),rows=[];
      const lost=Math.max(0,start-row.through-1);
      for(let s=start;s<=end;s++){const at=8+((s-1)%4096)*19;if(Atomics.load(v,at)!==s)break;const values=Array.from(v.subarray(at,at+19));if(values[18]!==s||Atomics.load(v,at)!==s)break;rows.push(values);row.through=s;}
      if(rows.length||lost)console.info('MDK2_GPU_ROWS',JSON.stringify({identity:row.identity,role:row.role,slot:row.slot,endpoint:row.endpoint,original:row.original,bootstrap:row.bootstrap,retired:row.retired,lost,rows}));
    }
  }
  function capture(memory){
    const at=performance.timeOrigin+performance.now(),records=workers.map(row=>{
      const v=new Int32Array(row.rows),end=Atomics.load(v,0),rows=[];
      for(let s=Math.max(1,end-31);s<=end;s++){const a=8+((s-1)%4096)*19;if(Atomics.load(v,a)!==s)continue;const values=Array.from(v.subarray(a,a+19));if(values[18]===s&&Atomics.load(v,a)===s)rows.push(values);}
      return {identity:row.identity,role:row.role,original:row.original,retired:row.retired,end,rows};
    });
    const rings=[...new Set(records.flatMap(r=>r.rows.map(v=>v[6]>>>0)).filter(Boolean))],g=globalThis.GpuStreamGenerated;
    const headers=rings.map(ring=>{
      if(!memory||!g||ring+g.LAYOUTS.GpsRing.size>memory.buffer.byteLength)return {ring,error:'memory or layout unavailable'};
      const i32=new Int32Array(memory.buffer),dv=new DataView(memory.buffer),read=n=>Atomics.load(i32,(ring+g.LAYOUTS.GpsRing.fields.find(f=>f.name===n).offset)>>>2)>>>0;
      const names=['write_pos','read_pos','submit_seq','done_seq','consumer','error_code','ring_data','ring_bytes'];
      const before=Object.fromEntries(names.map(n=>[n,read(n)])),p=before.ring_data+(before.read_pos&(before.ring_bytes-1));
      const record=before.read_pos!==before.write_pos&&p+12<=memory.buffer.byteLength?{op:dv.getUint16(p,true),bytes:dv.getUint32(p+4,true),seq:dv.getUint16(p,true)===g.OP.WRAP?null:dv.getUint32(p+8,true)}:null;
      // Bound diagnostic copying independently of the guest command's size.
      // Retain unavailable bytes explicitly; never drain to obtain them.
      let command=null;
      if(record&&record.op!==g.OP.WRAP&&globalThis.GpuStream){
        try{
          const gs=globalThis.GpuStream,r=new gs.Ring(()=>memory.buffer,ring);
          if(record.bytes>65536)command={missing:'record exceeds64KB diagnostic bound'};
          else {
            const rec=gs.buildRecord(memory.buffer,p,(pos,len,seq)=>r.arena(pos,len,seq),r);
            let budget=65536;
            command={name:rec.name,fields:rec.fields,raw:Array.from(rec.raw),arena:rec.refs.map(ref=>{
              if(ref.len>budget)return {...ref,bytes:null,missing:'arena exceeds64KB aggregate diagnostic bound'};
              budget-=ref.len;return {...ref,bytes:Array.from(rec.arena(ref.pos,ref.len))};
            })};
          }
        }catch(e){command={missing:String(e)};}
      }
      const after=Object.fromEntries(names.map(n=>[n,read(n)]));return {ring,before,record,command,after,stable:names.every(n=>before[n]===after[n])};
    });
    return {at,records,headers};
  }
  window.__mdk2GpuTimeline={flush,capture,terminal(){flush();Atomics.store(control,0,0);terminal=true;},summary:()=>workers.map(({rows,...row})=>row)};
  setInterval(flush,20);
}
module.exports={workerBootstrap,installPage,read,validateIdentity,fields,width,capacity,header,bytes:(header+width*capacity)*4};
