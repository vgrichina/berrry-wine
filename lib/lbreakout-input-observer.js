'use strict';
// Optional diagnostic. Uses the existing block-entry trace import; never calls
// guest routines or writes guest memory. Addresses come from the loaded images.
(function(scope) {
const pins = {exe:'cc1fd5c3d229cc1d4f910e658f5abefa80ef8ebf4b5e47801648f0be0e1ca244',
  sdl:'0b5aeef9054872cce11992679ad05a5bc96e5a4cfb515da8983e2e1f2ecbbbd8'};
async function install(o={}) {
  if (!o.enabled) return null;
  const {exports:e,memory,exeBytes,sdlBytes,emit=()=>{},now=()=>Date.now(),limit=512,durationMs=1500}=o;
  if (!Number.isInteger(limit)||limit<8||limit>2048||!Number.isInteger(durationMs)||durationMs<1||durationMs>3000)
    throw Error('observer bounds');
  const digest=async b=>Array.from(new Uint8Array(await (typeof module==='object'&&module.exports
    ? require('node:crypto').webcrypto : scope.crypto).subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
  if (await digest(exeBytes)!==pins.exe || await digest(sdlBytes)!==pins.sdl) throw Error('authentic media required');
  const view=new DataView(memory.buffer),u32=p=>view.getUint32(e.guest_to_wasm(p>>>0)>>>0,true);
  const bytes=(p,n)=>new Uint8Array(memory.buffer,e.guest_to_wasm(p>>>0)>>>0,n);
  const hex=(p,n)=>Array.from(bytes(p,n),x=>x.toString(16).padStart(2,'0')).join('');
  const str=p=>{let s='';for(let i=0;i<64;i++){const v=bytes(p+i,1)[0];if(!v)return s;s+=String.fromCharCode(v);}throw Error('module name bound');};
  const exe=e.get_image_base()>>>0,table=e.get_dll_table()>>>0,count=e.get_dll_count()>>>0;
  if(count>e.get_dll_capacity())throw Error('DLL table bounds');
  const matches=[];
  for(let i=0;i<count;i++){
    const base=view.getUint32(table+i*32,true),rva=view.getUint32(table+i*32+8,true);
    if(base&&rva&&str(base+u32(base+rva+12)).toLowerCase()==='sdl.dll')matches.push({base,index:i});
  }
  if(matches.length!==1)throw Error('unique loaded SDL required');
  const {base:sdl,index}=matches[0],paddle=exe+0x5904,keys=u32(sdl+0x1981f);
  const life=e.get_dll_lifecycle_table()>>>0,stride=e.get_dll_lifecycle_stride()>>>0;
  const generation=view.getUint32(life+index*stride+4,true),mappingState=view.getUint32(life+index*stride,true);
  // Relocation-free original instruction anchors and the relocated key pointer.
  for(const [pc,h] of [[paddle,'5589e55383ec24'],[sdl+0x13070,'8b44240483ec1085c0'],
    [sdl+0x19810,'8b44240485c07406'],[sdl+0x19870,'83ec1433c0']])
    if(hex(pc,h.length/2)!==h)throw Error('loaded original instruction mismatch '+pc.toString(16));
  if(keys!==sdl+0x35388)throw Error('loaded SDL key pointer relocation');
  const binding={exe,sdl,index,keys,generation,mappingState,media:pins};
  let active=true,serial=0,seen=0,last=null,frames=[];
  const records=[],started=now(),deadline=started+durationMs;
  const keyState=()=>({right:bytes(keys+275,1)[0],left:bytes(keys+276,1)[0],space:bytes(keys+32,1)[0]});
  const state=p=>({pointer:p,x:view.getFloat32(e.guest_to_wasm(p+8)>>>0,true),integerX:u32(p+12),inhibit:u32(p+60),rightFire:u32(p+92)});
  function record(kind,data={}) {if(records.length>=limit){stop('record-limit');return;}const v={kind,sequence:++serial,at:now(),...data};records.push(v);emit(v);}
  function stop(reason='cancelled') {if(!active)return;active=false;e.set_trace_eip_range(0,0,0);emit({kind:'observer-stop',reason,at:now(),records:records.length,boundaries:seen,
    lastPC:e.get_eip()>>>0,esp:e.get_esp()>>>0,yieldReason:e.get_yield_reason(),keys:keyState()});}
  function boundary(pc=e.get_eip()>>>0) {
    if(!active)return;
    try {
      if(now()>=deadline)return stop('deadline');
      if(++seen>200000)return stop('boundary-limit');
      if(e.get_current_thread_id()!==1)return stop('foreign-thread');
      if(e.get_image_base()!==exe||view.getUint32(table+index*32,true)!==sdl||
        view.getUint32(life+index*stride+4,true)!==generation||view.getUint32(life+index*stride,true)!==mappingState)
        return stop('module-changed');
      const esp=e.get_esp()>>>0,tid=e.get_current_thread_id();
      if(last&&last.pc===pc&&last.esp===esp)return;last={pc,esp};
      while(frames.length&&frames[frames.length-1].ret===pc&&frames[frames.length-1].esp+4===esp){
        const f=frames.pop();record(f.kind+'-return',{invocation:f.id,pc,esp,tid,keys:keyState(),...(f.pointer?{paddle:state(f.pointer)}:{})});
      }
      const kinds=new Map([[paddle,'paddle'],[sdl+0x10a10,'windib'],[sdl+0x13070,'dx5'],[sdl+0x19870,'private-keyboard'],[sdl+0x19810,'get-key-state']]);
      const kind=kinds.get(pc);if(!kind)return;
      if(frames.length>=32)return stop('nesting-limit');
      const f={kind,ret:u32(esp),esp,id:serial+1};
      let data={pc,esp,tid,returnPC:f.ret,keys:keyState()};
      if(kind==='paddle'){f.pointer=u32(esp+4);data.paddle=state(f.pointer);data.elapsed=u32(esp+8);}
      if(kind==='private-keyboard'){const sym=u32(esp+8);data.down=bytes(esp+4,1)[0];data.symbol=u32(sym+4);}
      if(kind==='windib')data.arguments=Array.from({length:5},(_,i)=>u32(esp+4+i*4));
      if(kind==='dx5'){
        const n=u32(esp+4),p=u32(esp+8);if(n>64)return stop('DX5-record-bound');
        data.events=Array.from({length:n},(_,i)=>({scan:u32(p+i*16),data:u32(p+i*16+4),timestamp:u32(p+i*16+8),sequence:u32(p+i*16+12)}));
      }
      frames.push(f);record(kind+'-entry',{invocation:f.id,...data});
    } catch(error) {record('observer-error',{error:String(error)});stop('unobservable');}
  }
  const timer=setTimeout(()=>stop('deadline'),durationMs);if(timer.unref)timer.unref();
  record('observer-arm',{binding,deadline,limit,pc:e.get_eip()>>>0,esp:e.get_esp()>>>0,keys:keyState()});
  e.set_trace_eip_range(1,Math.min(exe,sdl),Math.max(exe+0x80000,sdl+0x40000));
  return {boundary,stop:reason=>{clearTimeout(timer);stop(reason);},snapshot:()=>({binding,active,records:[...records],boundaries:seen,deadline})};
}
const api={install,pins};if(typeof module==='object'&&module.exports)module.exports=api;else scope.LBreakoutInputObserver=api;
})(globalThis);
