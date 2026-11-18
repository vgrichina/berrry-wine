'use strict';

// Diagnostic only. Samples getters on the actual instance at EXISTING calls;
// it never invokes a pump, resumes a wait, publishes readiness or changes input.
function createAttribution({intervalMs=100,capacity=512,now=Date.now,
  mono=()=>performance.now(),origin=()=>performance.timeOrigin}={}) {
  if(intervalMs<100||!Number.isInteger(capacity)||capacity<1||capacity>4096)throw Error('bounds');
  const actors=[],errors=[];
  function prepare(imports){
    const h=imports.host;if(!h?.memory)return i=>i;
    let e;
    const state={id:actors.length+1,calls:{},rows:[],overwritten:0,last:{},observerMs:0};actors.push(state);
    const scene=()=>{
      if(!e?.get_main_hwnd)return null;
      const main=e.get_main_hwnd()>>>0,focus=e.get_focus_hwnd()>>>0;
      const a=BigInt(e.wnd_lookup_generation(main)),b=BigInt(e.wnd_lookup_generation(focus));
      return {values:[e.get_current_thread_id(),e.get_process_id(),main,focus,
        e.modal_dialog_hwnd(),e.get_capture_hwnd(),Number(a&0xffffffffn),Number(a>>32n),
        Number(b&0xffffffffn),Number(b>>32n)],windowThread:e.get_window_thread(main),
        pc:e.get_eip()>>>0,yield:e.get_yield_reason()};
    };
    function sample(name,extra,force=false){
      const start=mono();if(!force&&start-(state.last[name]??-Infinity)<intervalMs)return;
      state.last[name]=start;
      try{
        const row={phase:name,wall:now(),mono:start,timeOrigin:origin(),scene:scene(),...extra};
        if(state.rows.length===capacity){state.rows.shift();state.overwritten++;}state.rows.push(row);
      }catch(error){if(errors.length<16)errors.push(String(error));}
      state.observerMs+=mono()-start;
    }
    function wrap(name,original){return function(...args){
      const a=state.calls[name]||={count:0,ms:0,maxMs:0,lastStart:null,lastEnd:null};a.count++;
      const start=mono();a.lastStart={wall:now(),mono:start};
      if(name==='gpu_stream_kick')sample(name+'-enter',{args},true);
      const result=Reflect.apply(original,this,args),end=mono();
      a.ms+=end-start;a.maxMs=Math.max(a.maxMs,end-start);a.lastEnd={wall:now(),mono:end};
      sample(name,{args:name==='check_input'||name==='input_validate'||name==='gpu_stream_kick'?args:[],
        result,elapsedMs:end-start},name==='check_input'||name==='input_validate'||name==='gpu_stream_kick');
      return result;
    };}
    for(const name of ['check_input','input_validate','get_ticks','gpu_stream_kick'])
      if(typeof h[name]==='function')h[name]=wrap(name,h[name]);
    return instance=>{
      e=instance.exports;const facade={...e};
      for(const name of ['run','has_pending_message','resume_message_wait'])
        if(typeof e[name]==='function')facade[name]=wrap(name,e[name]);
      return new Proxy(instance,{get(target,key){return key==='exports'?facade:Reflect.get(target,key,target);}});
    };
  }
  return {prepare,report:()=>({contract:'nfs3-native-scene-attribution-v1',intervalMs,capacity,
    extraGuestPolls:0,guestWrites:0,debugChanges:0,readinessWrites:0,
    clock:'wall=Date.now; mono=performance.now; timeOrigin=performance.timeOrigin; no guest clock conversion',
    actors,errors})};
}
function bootstrap(){
  const {install}=require('./nfs3-consumer-scheduling-observer.cjs');
  return `;(function(){${createAttribution.toString()}\n${install.toString()}\nconst a=createAttribution();install(a);globalThis.nfs3SceneAttribution=()=>a.report();})();\n`;
}
module.exports={createAttribution,bootstrap};
