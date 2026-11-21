'use strict';
// Preinstalled task observer. All storage is private SAB, never guest memory.
// The last command is published before execution, so a blocked synchronous
// WASM call can be inspected without requesting work from the blocked worker.
const capacity=4096,width=10,header=8,blobBytes=1048592;
function workerBootstrap(){
  let c=null,current=null,serial=0;
  const patched=new WeakSet(),cache=new WeakMap();
  function enabled(){return c&&Atomics.load(c.control,0)!==0;}
  function event(kind,id=0,value=0){
    if(!enabled())return;
    const v=c.rows,s=Atomics.load(v,0)+1,a=8+((s-1)%4096)*10;
    const now=performance.timeOrigin+performance.now();
    const values=[s,now>>>0,Math.floor(now/4294967296),kind,current?.seq||0,id,value,current?.ring?.addr||0,c.identity,s];
    Atomics.store(v,a,0);for(let i=1;i<10;i++)v[a+i]=values[i]|0;
    Atomics.store(v,a,s);Atomics.store(v,0,s);
  }
  function publish(ex,rec){
    const v=new Int32Array(c.blob),stamp=++serial,slot=stamp%2;
    const span=(c.blob.byteLength-16)/2,base=16+slot*span;
    const h=new Int32Array(c.blob,base,4),bytes=new Uint8Array(c.blob,base+16,span-16);
    Atomics.store(v,3,rec.seq);Atomics.store(h,0,-stamp);
    let budget=65536;
    const copy=b=>{if(!b)return null;if(b.byteLength>budget)return {missing:'aggregate64KB bound',length:b.byteLength};budget-=b.byteLength;return Array.from(new Uint8Array(b.buffer,b.byteOffset,b.byteLength));};
    let data;
    try{
      const resources=[];
      for(const b of ex.bound)if(b?.texture){const r=ex.res.get(b.texture);if(r)resources.push({id:r.id,kind:r.kind,gen:r.gen,width:r.width,height:r.height,levels:r.levels?.map(l=>({width:l.width,height:l.height,pixels:copy(l.pixels)})),sampler:ex.samplers.get(b.sampler)});}
      const f=rec.fields;
      data={seq:rec.seq,ring:rec.ring?.addr,fields:f,raw:copy(rec.raw),refs:rec.refs.map(r=>({...r,bytes:r.len<=budget?copy(rec.arena(r.pos,r.len)):{missing:'aggregate64KB bound',length:r.len}})),resources,
        buffers:[f.vbuf,f.ibuf].filter(Boolean).map(id=>({id,bytes:copy(ex.res.get(id)?.bytes)})),
        target:ex.target,viewport:ex.viewport,raster:ex.raster,layout:ex.layouts.get(f.layout),
        shaders:[f.vs,f.ps].filter(Boolean).map(id=>({id,bytes:copy(ex.shaders.get(id)?.nativeBytes)})),
        consts:Array.from(ex.consts),vconsts:Array.from(ex.vconsts),clip:{mask:ex.clip.mask,planes:Array.from(ex.clip.planes)}};
    }catch(e){data={seq:rec.seq,missing:String(e)};}
    let encoded=new TextEncoder().encode(JSON.stringify(data));
    if(encoded.length>bytes.length)encoded=new TextEncoder().encode(JSON.stringify({seq:rec.seq,missing:'JSON bound exceeded'}));
    bytes.set(encoded);Atomics.store(h,1,encoded.length);Atomics.store(h,2,rec.seq);Atomics.store(h,0,stamp);Atomics.store(v,0,slot+1);
  }
  function wrap(proto,name,id){const fn=proto[name];if(typeof fn!=='function')return;proto[name]=function(...args){if(!current||!enabled())return Reflect.apply(fn,this,args);event(3,id);try{const r=Reflect.apply(fn,this,args);event(4,id);return r;}catch(e){event(5,id);throw e;}};}
  function patch(){
    const sw=globalThis.GpuStreamSoftware,n=globalThis.D3D9SoftwareBackend;
    if(n&&!patched.has(n)){
      patched.add(n);const proto=n.Device.prototype,exports=proto.exports;
      proto.exports=function(){const e=Reflect.apply(exports,this,arguments);if(!current||!enabled())return e;
        let facade=cache.get(e);if(!facade){facade={...e};let id=100;
          for(const name of Object.keys(e).sort())if(typeof e[name]==='function'&&/^(d3d_|heap_)/.test(name)){
            const index=id++;event(6,index);console.info('MDK2_STAGE_EXPORT',JSON.stringify({identity:c.identity,id:index,name}));
            facade[name]=function(...args){if(!current||!enabled())return Reflect.apply(e[name],e,args);event(3,index);try{const r=Reflect.apply(e[name],e,args);event(4,index,typeof r==='number'?r:0);return r;}catch(err){event(5,index);throw err;}};
          }cache.set(e,facade);
        }return facade;};
      for(const [name,id] of [['draw',10],['prepare',11],['prepareBatch',12],['step',13],['bindTexture',14]])wrap(proto,name,id);
    }
    if(sw&&!patched.has(sw)){
      patched.add(sw);const p=sw.Executor.prototype,execute=p.execute;
      p.execute=function(rec){if(rec.op!==21||!enabled())return Reflect.apply(execute,this,arguments);
        const old=current;current=rec;event(1);event(3,20);publish(this,rec);event(4,20);
        try{const result=Reflect.apply(execute,this,arguments);event(2);return result;}catch(e){event(5);throw e;}finally{current=old;}};
      for(const [name,id] of [['_vertices',1],['_expand',2],['_nativeState',3],['_drawVS',4]])wrap(p,name,id);
    }
  }
  const load=globalThis.importScripts;if(load)globalThis.importScripts=function(...args){const r=Reflect.apply(load,this,args);patch();return r;};
  addEventListener('message',({data})=>{const t=data?.mdk2StageTrace;if(t)c={...t,rows:new Int32Array(t.rows),control:new Int32Array(t.control)};patch();});
  globalThis.__mdk2Stage={configure(t){c={...t,rows:new Int32Array(t.rows),control:new Int32Array(t.control)};patch();}};
}
function read(buffer,after=0){const v=new Int32Array(buffer),end=Atomics.load(v,0),start=Math.max(after+1,end-capacity+1),rows=[];let through=after;
  for(let s=start;s<=end;s++){const a=header+((s-1)%capacity)*width;if(Atomics.load(v,a)!==s)break;const r=Array.from(v.subarray(a,a+width));if(r[9]!==s||Atomics.load(v,a)!==s)break;rows.push({stamp:s,at:(r[1]>>>0)+(r[2]>>>0)*4294967296,kind:r[3],seq:r[4]>>>0,id:r[5],value:r[6],ring:r[7]>>>0,identity:r[8]});through=s;}
  return {end,through,lost:Math.max(0,start-after-1),incomplete:through!==end,rows};}
function command(buffer){const v=new Int32Array(buffer),slot=Atomics.load(v,0)-1,activeSeq=Atomics.load(v,3)>>>0;if(slot<0||slot>1)return {stable:false,activeSeq};const span=(buffer.byteLength-16)/2,base=16+slot*span,h=new Int32Array(buffer,base,4),before=Atomics.load(h,0),len=Atomics.load(h,1);if(before<=0||len<0||len>span-16)return {stable:false,activeSeq};const bytes=new Uint8Array(buffer,base+16,len).slice();if(before!==Atomics.load(h,0))return {stable:false,activeSeq};return {stable:true,stamp:before,activeSeq,data:JSON.parse(new TextDecoder().decode(bytes))};}
function installPage(){
  const Native=window.Worker,post=Native.prototype.postMessage,map=new WeakMap(),workers=[],control=new Int32Array(new SharedArrayBuffer(4));control[0]=1;let serial=0,terminal=false;
  Native.prototype.postMessage=function(m,...rest){const row=map.get(this);if(row&&m?.t==='render-init')m={...m,mdk2StageTrace:{rows:row.rows,blob:row.blob,control:control.buffer,identity:row.identity}};return Reflect.apply(post,this,[m,...rest]);};
  window.Worker=new Proxy(Native,{construct(t,args,n){const original=new URL(String(args[0]),location.href);if(!original.href.includes('d3d-render-worker.js'))return Reflect.construct(t,args,n===window.Worker?t:n);const url=new URL(original);url.pathname='/lib/__mdk2_stage_bootstrap.js';url.searchParams.set('original',original.href);const w=Reflect.construct(t,[url.href,...args.slice(1)],n===window.Worker?t:n),row={identity:++serial,original:original.href,rows:new SharedArrayBuffer((8+4096*10)*4),blob:new SharedArrayBuffer(1048592),through:0,retired:false};workers.push(row);map.set(w,row);const term=w.terminate;w.terminate=function(){row.retired=true;return Reflect.apply(term,this,arguments);};return w;}});
  function capture(){return workers.map(row=>{
    const v=new Int32Array(row.rows),end=Atomics.load(v,0),rows=[];
    for(let s=Math.max(1,end-4095);s<=end;s++){const a=8+((s-1)%4096)*10;if(Atomics.load(v,a)!==s)continue;const r=Array.from(v.subarray(a,a+10));if(r[9]===s&&Atomics.load(v,a)===s)rows.push(r);}
    const b=new Int32Array(row.blob),slot=Atomics.load(b,0)-1,activeSeq=Atomics.load(b,3)>>>0;
    let command={stable:false,activeSeq};
    if(slot>=0&&slot<=1){
      const span=(row.blob.byteLength-16)/2,base=16+slot*span,h=new Int32Array(row.blob,base,4),before=Atomics.load(h,0),len=Atomics.load(h,1);
      if(before>0&&len>=0&&len<=span-16){const bytes=new Uint8Array(row.blob,base+16,len).slice();if(before===Atomics.load(h,0))command={stable:true,stamp:before,activeSeq,data:JSON.parse(new TextDecoder().decode(bytes))};}
    }
    return {identity:row.identity,original:row.original,retired:row.retired,end,rows,command};
  });}
  function flush(){if(terminal)return;for(const row of workers){const v=new Int32Array(row.rows),end=Atomics.load(v,0),start=Math.max(row.through+1,end-4095),rows=[];const lost=Math.max(0,start-row.through-1);for(let s=start;s<=end;s++){const a=8+((s-1)%4096)*10;if(Atomics.load(v,a)!==s)break;const r=Array.from(v.subarray(a,a+10));if(r[9]!==s||Atomics.load(v,a)!==s)break;rows.push(r);row.through=s;}if(rows.length||lost)console.info('MDK2_STAGE_ROWS',JSON.stringify({identity:row.identity,original:row.original,lost,rows}));}}
  window.__mdk2DrawStage={capture,flush,terminal(){flush();terminal=true;Atomics.store(control,0,0);}};setInterval(flush,20);
}
module.exports={workerBootstrap,installPage,read,command,capacity,width,header,blobBytes,bytes:(header+capacity*width)*4};
