'use strict';

// Diagnostic reader of existing native block/import boundaries. No guest calls,
// memory writes, input, run(), breakpoint, or store-observer reconfiguration.
// The trace setter disables optimized dispatch; on/off controls are required.
const rtPoints = new Set([0x1696,0x16dd,0x16ff,0x1713,0x1735,0x1745,
  0x175a,0x1768,0x1777,0x1782,0x178b,0x1792,0x17f9,0x1817,0x1888,
  0x2b20,0x2b32,0x2b41,0x2b48,0x2b4f,0x2b51,0x2b5c,0x2b63,
  0x2b6f,0x2b7a,0x2b85,0x2b8c,0x2b95,0x2cfd,0x2d13,0x2d28,0x2d2c,0x2d41]);
const musicPoints = new Set([0x1c61,0x1c81,0x270c,0x2c72,0x31f6,0x37db]);
function readPointerFiles(directory){
  const fs=require('node:fs'),path=require('node:path');
  // Evidence data is not executable/JSON source. Keep the sealed runtime's
  // JS/JSON admission policy unchanged, including in late-started Workers.
  return fs.readdirSync(directory).filter(n=>/^object-pointer-\d+-\d+-\d+\.dat$/.test(n))
    .map(n=>JSON.parse(fs.readFileSync(path.join(directory,n),'utf8')).object.pointer);
}
function createObserver({emit, deadline, now=Date.now, maxRows=16000,
  maxBoundaries=20000000, controlRange=null, knownPointers=()=>[]}={}) {
  if(typeof emit!=='function'||!Number.isFinite(deadline)||deadline<=now()||
    deadline>now()+660000||!Number.isInteger(maxRows)||maxRows<1||maxRows>20000||
    !Number.isInteger(maxBoundaries)||maxBoundaries<1||maxBoundaries>20000000)
    throw Error('observer bounds');
  let rows=0, boundaries=0, active=true, sequence=0;
  const contexts=[];
  function stop(reason){if(!active)return;active=false;
    for(const c of contexts)if(c.e)c.e.set_trace_eip_range(0,0,0);
    emit({kind:'stop',at:now(),reason,rows,boundaries});}
  function record(kind,data){if(!active)return;
    if(rows>=maxRows)return stop('UNKNOWN:row-bound');
    emit({kind,at:now(),sequence:++rows,...data});}
  function wrapImports(imports){
    const h=imports?.host;if(!h?.memory)return ()=>{};
    const c={id:++sequence,e:null,count:-1,modules:[],objects:new Map(),lastPC:0,controlRows:0,seeded:false};contexts.push(c);
    const memory=h.memory,view=new DataView(memory.buffer);
    const bytes=(p,n)=>{
      const a=c.e.guest_to_wasm(p>>>0)>>>0;
      if(a===0xf0||a+n>memory.buffer.byteLength)throw Error('unmapped observation');
      return Array.from(new Uint8Array(memory.buffer,a,n));};
    const u=p=>{const b=bytes(p,4);return(b[0]|b[1]<<8|b[2]<<16|b[3]<<24)>>>0;};
    const str=p=>{let s='';for(let i=0;i<128;i++){const b=bytes(p+i,1)[0];if(!b)return s;s+=String.fromCharCode(b);}throw Error('name bound');};
    function modules(){
      const n=c.e.get_dll_count()>>>0;if(n===c.count)return;
      if(n>c.e.get_dll_capacity())throw Error('module count');
      const table=c.e.get_dll_table()>>>0,mods=[];
      for(let i=0;i<n;i++){
        const row=Array.from({length:8},(_,j)=>view.getUint32(table+i*32+j*4,true));
        if(!row[0])continue;
        const name=row[2]?str(row[0]+u(row[0]+row[2]+12)):'';
        mods.push({index:i,base:row[0],name,row});
      }
      c.count=n;c.modules=mods;c.rt=mods.find(m=>m.name.toLowerCase()==='imrt25.dll');
      c.music=mods.find(m=>m.name.toLowerCase()==='imusic25.dll');
      record('modules',{instance:c.id,modules:mods});
      if(!controlRange&&c.rt&&c.music)c.e.set_trace_eip_range(1,
        Math.min(c.rt.base,c.music.base),Math.max(c.rt.base+0x3000,c.music.base+0x1d000));
    }
    function context(){const e=c.e,regs={};
      for(const r of ['eax','ebx','ecx','edx','esi','edi','esp','ebp'])regs[r]=e['get_'+r]()>>>0;
      return {instance:c.id,thread:e.get_current_thread_id()>>>0,pc:e.get_eip()>>>0,
        previous:e.get_dbg_prev2_eip?e.get_dbg_prev2_eip()>>>0:null,regs,
        stack:Array.from({length:12},(_,i)=>{try{return u(regs.esp+i*4);}catch{return null;}})};}
    const state=p=>({pointer:p,header:u(p-4),words:Array.from({length:16},(_,i)=>u(p+i*4))});
    function inspect(boundary){
      for(const [p,prior] of c.objects){const next=state(p);
        if(JSON.stringify(prior)!==JSON.stringify(next)){
          record('object-change',{...context(),boundary,lastObservedPC:c.lastPC,before:prior,after:next,
            attribution:'interval only; concurrent writers and untraced blocks are not attributed'});
          c.objects.set(p,next);
        }
      }
    }
    function observe(pc,boundary,args){
      if(!active||!c.e)return;
      try{
        if(now()>=deadline)return stop('deadline');
        if(++boundaries>maxBoundaries)return stop('UNKNOWN:boundary-bound');
        modules();
        if(!c.seeded&&c.rt){c.seeded=true;for(const p of knownPointers()){
          if(c.objects.size>=16)throw Error('known object bound');
          c.objects.set(p,state(p));record('inherited-constructor-pointer',{...context(),object:state(p)});
        }}
        inspect(boundary);
        if(boundary==='block'){
          const r=c.rt?pc-c.rt.base:-1,m=c.music?pc-c.music.base:-1;
          if(r===0x1792){const p=c.e.get_ecx()>>>0;
            if(!c.objects.has(p)&&c.objects.size>=16)throw Error('object bound');
            const reusedNumericPointer=c.objects.has(p);
            c.objects.set(p,state(p));record('constructor-pointer',{...context(),object:state(p),reusedNumericPointer});
          }
          if(r===0x175a||r===0x1768){const p=u((c.e.get_esp()>>>0)+4);
            if(!c.objects.has(p)&&u(p+4)===c.rt.base+0x30e0&&u(p+8)===c.rt.base+0x30b8){
              if(c.objects.size>=16)throw Error('object bound');
              c.objects.set(p,state(p));record('interface-entry-pointer',{...context(),object:state(p)});
            }
          }
          if(rtPoints.has(r)||musicPoints.has(m)||(controlRange&&c.controlRows++<32)){
            const row=context();record('execution',{...row,module:rtPoints.has(r)?'IMRT25':musicPoints.has(m)?'IMUSIC25':'control',
              rva:rtPoints.has(r)?r:m,objects:[...c.objects.values()]});
          }
          c.lastPC=pc;
        }else if(args&&c.objects.size&&/free|alloc|log_api/i.test(boundary))
          record('import',{...context(),name:boundary,args:args.map(x=>typeof x==='number'?x:String(x))});
      }catch(error){record('error',{instance:c.id,error:String(error)});stop('UNKNOWN:unobservable');}
    }
    for(const name of Object.keys(h))if(typeof h[name]==='function'){
      const original=h[name];
      h[name]=function(...args){
        observe(name==='log_eip'?args[0]>>>0:0,name==='log_eip'?'block':name+':entry',args);
        const result=Reflect.apply(original,this,args);
        if(name!=='log_eip')observe(0,name+':return',args);
        return result;
      };
    }
    return instance=>{c.e=instance.exports;
      record('instance',{instance:c.id,traceChangesDispatchStrategy:true});
      const [lo,hi]=controlRange||[1,0xffffffff];c.e.set_trace_eip_range(1,lo,hi);
    };
  }
  return {wrapImports,stop,summary:()=>({active,rows,boundaries,instances:contexts.length})};
}
function install(observer,wasm=WebAssembly){
  const Original=wasm.Instance,instantiate=wasm.instantiate;
  wasm.Instance=new Proxy(Original,{construct(target,args,newTarget){
    const bind=observer.wrapImports(args[1]);const instance=Reflect.construct(target,args,newTarget===wasm.Instance?target:newTarget);bind(instance);return instance;}});
  wasm.instantiate=async function(source,imports){const bind=observer.wrapImports(imports);
    const result=await Reflect.apply(instantiate,this,[source,imports]);bind(result.instance||result);return result;};
  return ()=>{wasm.Instance=Original;wasm.instantiate=instantiate;};
}
module.exports={createObserver,install,readPointerFiles};
if(process.env.BLOOD2_LIFETIME_DIR){
  const fs=require('node:fs'),path=require('node:path'),{threadId}=require('node:worker_threads');
  const dir=process.env.BLOOD2_LIFETIME_DIR;
  if(!path.isAbsolute(dir))throw Error('absolute output required');
  const fd=fs.openSync(path.join(dir,`lifetime-${process.pid}-${threadId}.jsonl`),'wx');
  const observer=createObserver({deadline:Number(process.env.BLOOD2_LIFETIME_DEADLINE),
    knownPointers:()=>readPointerFiles(dir),
    ...(process.env.BLOOD2_LIFETIME_CONTROL?{controlRange:[0x400000,0x410000]}:{}),
    emit:row=>{fs.writeSync(fd,JSON.stringify({pid:process.pid,hostThread:threadId,...row})+'\n');
      if(row.kind==='constructor-pointer')fs.writeFileSync(path.join(dir,
        `object-pointer-${process.pid}-${threadId}-${row.object.pointer}.dat`),JSON.stringify(row));
      if(row.kind==='stop'&&row.reason.startsWith('UNKNOWN')&&process.env.BLOOD2_LIFETIME_CANCEL)
        fs.writeFileSync(process.env.BLOOD2_LIFETIME_CANCEL,JSON.stringify(row));}});
  install(observer);
  const timer=setTimeout(()=>observer.stop('deadline'),Math.max(1,Number(process.env.BLOOD2_LIFETIME_DEADLINE)-Date.now()));timer.unref();
  process.once('exit',()=>{observer.stop('exit');fs.closeSync(fd);});
}
