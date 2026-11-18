'use strict';

// Samples existing native execution boundaries. Never arms debug dispatch,
// polls a guest API, consumes read-and-clear flags, or changes a clock.
const fields = [0x6fb3b0,0x6fb4f4,0x6fb50c,0x7a02e4,0x55e81c,
  0x7d3714,0x7d3718,0x7d371c,0x7d3738,0x7d373c,0x7d3740,
  0x79a4ac,0x7d1688,0x79a338,0x79a4a8,0x7d16f0];
function createObserver({capacity=4096, intervalMs=100, game=false,
  translate, addresses=fields, now=Date.now, mono=()=>performance.now()}={}) {
  if (!Number.isInteger(capacity)||capacity<1||capacity>16384) throw Error('capacity');
  if (!Number.isFinite(intervalMs)||intervalMs<10) throw Error('interval');
  if (addresses.length>64 || (game && typeof translate!=='function')) throw Error('reader');
  const rows=new Array(capacity), hosts=[], errors=[]; let count=0, observerMs=0;
  const fail=e=>{if(errors.length<16)errors.push(String(e));};
  const put=row=>{rows[count++%capacity]=row;};
  function prepare(imports) {
    const h=imports.host; if(!h?.memory) return instance=>instance;
    let e, lastSample=-Infinity, lastEnd=null;
    const state={id:hosts.length+1,runs:0,nativeMs:0,maxRunMs:0,maxBetweenRunsMs:0,
      blocks:0,yields:{},imports:{}}; hosts.push(state);
    const read=p=>{
      const a=translate(p,e.get_image_base(),h.memory.buffer);
      if(!Number.isInteger(a)||a<0||a+4>h.memory.buffer.byteLength)throw Error('mapping');
      return new DataView(h.memory.buffer,a,4).getUint32(0,true);
    };
    function sample(phase, extra={}) {
      const t=mono(); if(t-lastSample<intervalMs)return;
      lastSample=t;
      try {
        const row={phase,at:now(),mono:t,instance:state.id,
          thread:e.get_current_thread_id(),pc:e.get_eip()>>>0,
          yield:e.get_yield_reason(),...extra};
        if(game)row.fields=addresses.map(p=>[p,read(p)]);
        put(row);
      }catch(error){fail(error);}
      observerMs+=mono()-t;
    }
    for(const name of ['get_ticks','gpu_stream_kick']) {
      const original=h[name];if(typeof original!=='function')continue;
      h[name]=function(...args){
        const begin=mono();
        const result=Reflect.apply(original,this,args);
        const end=mono(), a=state.imports[name]||={calls:0,ms:0,maxMs:0,first:null,last:null};
        a.calls++;a.ms+=end-begin;a.maxMs=Math.max(a.maxMs,end-begin);
        if(name==='get_ticks'){
          const point={at:now(),mono:end,tick:result};
          if(!a.first)a.first=point;a.last=point;
        }
        if(e)sample(name,{returned:result,hostMs:end-begin});
        return result;
      };
    }
    return instance=>{
      e=instance.exports;if(typeof e.run!=='function')return instance;
      const facade={...e};
      facade.run=function(...args){
        const start=mono();state.runs++;
        if(lastEnd!==null)state.maxBetweenRunsMs=Math.max(state.maxBetweenRunsMs,start-lastEnd);
        sample('run-enter');
        try{return Reflect.apply(e.run,e,args);}finally{
          const end=mono(),ms=end-start;state.nativeMs+=ms;state.maxRunMs=Math.max(state.maxRunMs,ms);
          const y=e.get_yield_reason();state.yields[y]=(state.yields[y]||0)+1;
          state.blocks+=e.get_last_run_blocks?.()>>>0;
          sample('run-exit',{nativeMs:ms,blocks:e.get_last_run_blocks?.()>>>0});lastEnd=mono();
        }
      };
      return new Proxy(instance,{get(target,key){return key==='exports'?facade:Reflect.get(target,key,target);}});
    };
  }
  return {prepare,report(){const start=Math.max(0,count-capacity);return {
    debugStrategyChanged:false,extraGuestPolls:0,guestWrites:0,intervalMs,capacity,
    count,overwritten:start,observerMs,hosts,errors,
    rows:Array.from({length:Math.min(count,capacity)},(_,i)=>rows[(start+i)%capacity])};}};
}
function install(observer,wasm=WebAssembly){
  const Instance=wasm.Instance,instantiate=wasm.instantiate;
  wasm.Instance=new Proxy(Instance,{construct(target,args){const bind=observer.prepare(args[1]||{});
    return bind(Reflect.construct(target,args));}});
  wasm.instantiate=async function(module,imports,...rest){const bind=observer.prepare(imports||{});
    const r=await Reflect.apply(instantiate,this,[module,imports,...rest]);
    return r.instance?{...r,instance:bind(r.instance)}:bind(r);};
  return ()=>{wasm.Instance=Instance;wasm.instantiate=instantiate;};
}
module.exports={createObserver,install,fields};
if(process.env.NFS_SCHEDULING_TRACE){
  const o=createObserver({game:process.env.NFS_SCHEDULING_GAME==='1',
    translate:require('../lib/mem-utils').g2w});install(o);
  globalThis.nfs3SchedulingReport=()=>o.report();
  process.once('exit',()=>require('node:fs').writeFileSync(
    `${process.env.NFS_SCHEDULING_TRACE}.${process.pid}-${require('node:worker_threads').threadId}.json`,JSON.stringify(o.report())));
}
