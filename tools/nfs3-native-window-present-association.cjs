'use strict';

// Read-only witness. Region addresses must come from the tested module's map.
function snapshot(e, buffer, regions, hwnd, rt=0) {
  const v=new DataView(buffer), u=a=>v.getUint32(a,true);
  const base=n=>regions[n].base;
  const pb=u(base('D3DIM_GPS')+8), owners=[];
  if(pb)for(let i=0;i<32;i++){
    const a=pb+23360+i*32, window=u(a);if(!window)continue;
    const entry=u(a+4);
    const slot=(entry-base('DX_OBJECTS'))/32;
    owners.push({index:i,hwnd:window,entry,dib:u(a+8),rt:u(a+12),seq:u(a+16),creator:u(a+20),
      currentCreator:u(base('DX_SURF_CREATOR')+slot*4),
      currentWords:Array.from({length:8},(_,j)=>u(entry+j*4))});
  }
  return {at:Date.now(),thread:e.get_current_thread_id(),process:e.get_process_id(),
    main:e.get_main_hwnd(),hwnd,rt,pb,owners,
    cooperativeWindow:u(base('DX_PROCESS_STATE')+16),
    cpuSeq:e.get_d3dim_cpu_present_seq(),windowPresent:e.d3dim_gps_window_present(hwnd,0),
    rtPresent:e.d3dim_gps_window_present(hwnd,rt)};
}
function createObserver(regions, read=snapshot) {
  const actors=[],errors=[];
  function prepare(imports){
    const h=imports.host;if(!h?.memory)return i=>i;
    let e;const state={kicks:0,rows:[],overwritten:0};actors.push(state);
    const original=h.gpu_stream_kick;
    if(typeof original==='function')h.gpu_stream_kick=function(...args){
      state.kicks++;
      function take(phase){try{
        if(!e||args[1]!==1)return;
        const v=new DataView(h.memory.buffer),pb=v.getUint32(regions.D3DIM_GPS.base+8,true);
        if(!pb)return;
        for(let i=0;i<32;i++){
          const a=pb+23360+i*32,hwnd=v.getUint32(a,true);if(!hwnd)continue;
          const row={phase,args,...read(e,h.memory.buffer,regions,hwnd,v.getUint32(a+12,true))};
          if(state.rows.length===128){state.rows.shift();state.overwritten++;}state.rows.push(row);
        }
      }catch(error){if(errors.length<8)errors.push(String(error));}}
      take('sync-enter');try{return Reflect.apply(original,this,args);}finally{take('sync-exit');}
    };
    return instance=>{e=instance.exports;return instance;};
  }
  return {prepare,report:()=>({actors,errors,extraGuestPolls:0,guestWrites:0})};
}
function bootstrap(regions){
  const {install}=require('./nfs3-consumer-scheduling-observer.cjs');
  return `;(function(){${snapshot.toString()}\n${createObserver.toString()}\n${install.toString()}\nconst o=createObserver(${JSON.stringify(regions)});install(o);globalThis.nfs3AssociationReport=()=>o.report();})();\n`;
}
module.exports={snapshot,createObserver,bootstrap};
