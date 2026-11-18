'use strict';

// Consumer for the native constructor/zero/destructor/free filter. The native
// watch publishes the actual constructor pointer in diagnostic shared memory;
// late guest Workers need no evidence-file polling or guest-memory handoff.
const TAGS = new Map([[-16,'constructor'],[-17,'primary-invalidation'],
  [-18,'refcount-zero'],[-19,'zero-release-branch'],[-20,'destructor'],
  [-21,'object-free-entry'],[-22,'UNKNOWN:native-watch'],[-23,'live']]);

function create({emit, deadline, now=Date.now, maxRows=128,control=false}={}) {
  if(typeof emit!=='function'||!Number.isFinite(deadline)||deadline<=now()||
    deadline>now()+660000||!Number.isInteger(maxRows)||maxRows<2||maxRows>256)
    throw Error('selective watch bounds');
  let active=true, rows=0, callbacks=0, moduleBoundaries=0;
  const contexts=[];
  const record=(kind,data={})=>{if(rows>=maxRows)throw Error('row bound');
    emit({kind,sequence:++rows,at:now(),...data});};
  function stop(reason) {
    if(!active)return; active=false;
    // Disarm only at the caller's JS boundary (stop is never called by a store
    // callback). A failing callback throws; it does not resume a failed scope.
    for(const c of contexts)if(c.armed)c.e.set_selective_watch(0,0,0,0,0);
    emit({kind:'stop',at:now(),reason,rows,callbacks,moduleBoundaries});
  }
  function fail(error) {
    active=false;
    emit({kind:'stop',at:now(),reason:'UNKNOWN:observation-error',error:String(error),rows,callbacks,moduleBoundaries});
    throw error;
  }
  function wrapImports(imports) {
    if(!imports?.host?.memory)return instance=>instance;
    if(contexts.length>=32)throw Error('instance bound');
    const h=imports.host,c={id:contexts.length+1,e:null,armed:false};contexts.push(c);
    const memory=h.memory,view=new DataView(memory.buffer);
    const read=p=>{const wa=c.e.guest_to_wasm(p>>>0)>>>0;
      if(wa===0xf0||wa+4>memory.buffer.byteLength)throw Error('unmapped observation');
      return view.getUint32(wa,true);};
    function modules() {
      const e=c.e,count=e.get_dll_count()>>>0,n=e.get_dll_capacity()>>>0,base=e.get_dll_table()>>>0;
      if(count>n||n>64)throw Error('module bound');
      // The frozen native predecessor keeps a per-instance count. Late CPU
      // instances still share the actual bounded DLL rows; scan occupied rows
      // so they arm before their first guest instruction or host import.
      const result=[];
      for(let i=0;i<n;i++){
        const row=Array.from({length:8},(_,j)=>view.getUint32(base+i*32+j*4,true));
        if(!row[0]||!row[2])continue;
        const p=row[0]+read(row[0]+row[2]+12);let name='';
        for(let j=0;j<128;j++){
          const wa=e.guest_to_wasm((p+j)>>>0)>>>0;if(wa===0xf0)throw Error('unmapped module name');
          const byte=view.getUint8(wa);if(!byte)break;name+=String.fromCharCode(byte);
          if(j===127)throw Error('module name bound');
        }
        result.push({name,base:row[0],row});
      }
      return result;
    }
    function arm() {
      if(!active||!c.e||c.armed)return;
      if(control){c.e.set_selective_watch(1,2,3,4,5);c.armed=true;
        record('armed-control',{instance:c.id,thread:c.e.get_current_thread_id()>>>0});return;}
      const configured=Atomics.load(new Int32Array(memory.buffer),c.e.selective_watch_base()/4+1)>>>0;
      // Prior native instances publish module-derived configuration before
      // late Workers exist. Their guest mapping globals are initialized only
      // by init_thread; do not wait for a host import to arm such an instance.
      const mods=configured?[]:modules(),rt=mods.find(m=>m.name.toLowerCase()==='imrt25.dll');
      if(!configured&&!rt)return;
      const b=configured?configured-0x30f8:rt.base;
      c.e.set_selective_watch(b+0x1792,b+0x1777,b+0x17f9,b+0x2d2c,b+0x30f8);
      c.armed=true;
      record('armed',{instance:c.id,modules:mods,thread:c.e.get_current_thread_id()>>>0,
        sharedBase:c.e.selective_watch_base()>>>0,
        strategy:'native block and post-write observation; chaining/uops disabled; no instruction stepping'});
    }
    function witness(tag) {
      if(!active||!c.e||!TAGS.has(tag))return;
      ++callbacks;
      if(now()>=deadline)throw Error('deadline');
      const e=c.e,base=e.selective_watch_base()>>>0,
        shared=Array.from({length:7},(_,i)=>Atomics.load(new Int32Array(memory.buffer),base/4+i)>>>0),
        fields=Array.from({length:6},(_,i)=>e.selective_watch_field(i)>>>0),regs={};
      for(const r of ['eax','ebx','ecx','edx','esi','edi','esp','ebp'])regs[r]=e['get_'+r]()>>>0;
      record(TAGS.get(tag),{instance:c.id,thread:e.get_current_thread_id()>>>0,
        pc:e.get_eip()>>>0,previous:e.get_dbg_prev2_eip()>>>0,block:e.get_dbg_prev_eip()>>>0,
        regs,stack:Array.from({length:12},(_,i)=>{try{return read(regs.esp+i*4);}catch{return null;}}),
        shared,fields,object:shared[0]&&tag!==-22?{pointer:shared[0],header:read(shared[0]-4),
          words:Array.from({length:16},(_,i)=>read(shared[0]+i*4))}:null,modules:tag===-22?[]:modules(),
        attribution:'observation boundary and actual observing thread/stack; concurrent writer and exact writing instruction UNKNOWN'});
      if(tag===-22||shared[5])throw Error('native observation loss');
    }
    const logEip=h.log_eip;
    h.log_eip=function(pc,...args){
      try{witness(pc|0);}catch(error){fail(error);}
      if(typeof logEip==='function')return Reflect.apply(logEip,this,[pc,...args]);
    };
    return instance=>{try{c.e=instance.exports;
      if(!c.e.set_selective_watch)throw Error('selective native module required');
      record('instance',{instance:c.id});arm();
      // Guest mappings do not exist at instantiate time. load_dll returns
      // after publishing actual DLL rows, before the loader invokes DllMain;
      // init_thread initializes a late CPU's guest mapping. Neither requires
      // a host log. Preserve the original return, exception and receiver.
      const exports=Object.create(null);
      for(const name of Object.keys(c.e)){
        const original=c.e[name];let value=original;
        if(['load_dll','init_thread'].includes(name)&&typeof original==='function')
          value=function(...args){const result=Reflect.apply(original,c.e,args);
            ++moduleBoundaries;try{arm();}catch(error){fail(error);}return result;};
        Object.defineProperty(exports,name,{value,enumerable:true});
      }
      return new Proxy(instance,{get(target,key){return key==='exports'?exports:Reflect.get(target,key,target);}});
    }catch(error){fail(error);}};
  }
  return {wrapImports,stop,summary:()=>({active,rows,callbacks,moduleBoundaries,instances:contexts.length})};
}
function install(observer,wasm=WebAssembly) {
  const Original=wasm.Instance,instantiate=wasm.instantiate;
  wasm.Instance=new Proxy(Original,{construct(target,args,newTarget){
    const bind=observer.wrapImports(args[1]),instance=Reflect.construct(target,args,newTarget===wasm.Instance?target:newTarget);
    return bind(instance);}});
  wasm.instantiate=async function(source,imports){const bind=observer.wrapImports(imports),
    result=await Reflect.apply(instantiate,this,[source,imports]);
    return result.instance?{...result,instance:bind(result.instance)}:bind(result);};
  return ()=>{wasm.Instance=Original;wasm.instantiate=instantiate;};
}
module.exports={create,install,TAGS};
if(process.env.BLOOD2_SELECTIVE_DIR) {
  const fs=require('node:fs'),path=require('node:path'),{threadId}=require('node:worker_threads'),dir=process.env.BLOOD2_SELECTIVE_DIR;
  if(!path.isAbsolute(dir))throw Error('absolute output required');
  const fd=fs.openSync(path.join(dir,`selective-${process.pid}-${threadId}.jsonl`),'wx');
  const deadline=Number(process.env.BLOOD2_SELECTIVE_DEADLINE),observer=create({deadline,
    control:process.env.BLOOD2_SELECTIVE_CONTROL==='1',
    emit:row=>{fs.writeSync(fd,JSON.stringify({pid:process.pid,hostThread:threadId,...row})+'\n');
      if(row.kind==='stop'&&row.reason.startsWith('UNKNOWN')&&process.env.BLOOD2_SELECTIVE_CANCEL)
        fs.writeFileSync(process.env.BLOOD2_SELECTIVE_CANCEL,JSON.stringify(row));}});
  install(observer);
  const timer=setTimeout(()=>observer.stop('UNKNOWN:deadline'),Math.max(1,deadline-Date.now()));timer.unref();
  process.once('exit',()=>{observer.stop('exit');fs.closeSync(fd);});
}
