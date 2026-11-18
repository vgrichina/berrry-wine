'use strict';
// Passive host-import observations. No guest calls, private game-state reads,
// readiness writes, clocks, acknowledgements, or input scheduling changes.
const Module=require('node:module'),fs=require('node:fs');
function decorate(base,ctx,write,{limit=512,now=Date.now}={}) {
 const watched=new Set(['get_mouse_position','set_cursor','dx_trace','check_input','input_pump_idle']);
 const ids=new WeakMap(),observedMoves=new WeakSet(),spans=[];
 let rows=[],counts={},serial=0,seen=0,cursor=128,until=0,depth=0,failed=null,overBudget=0,moveId=null;
 const id=o=>{if(!o||typeof o!=='object')return null;if(!ids.has(o))ids.set(o,++serial);return ids.get(o);};
 const snapshot=()=>({moveId,until,limit,budget:4096,overBudget,seen,
  missing:Math.max(0,seen-rows.length),counts,rows:rows.slice().sort((a,b)=>a.sequence-b.sequence)});
 function record(name,args,result){
  if(name==='dx_trace'&&![5,6].includes(args[0]))return;
  const r=ctx.renderer,e=ctx.exports;
  const moves=Object.entries(r?._pointerMoves||{}).filter(([,m])=>m?.event);
  const fresh=moves.find(([,m])=>m.pending&&!observedMoves.has(m.event));
  if(fresh&&spans.length<63){
   if(until)spans.push(snapshot());
   observedMoves.add(fresh[1].event);moveId=id(fresh[1].event);
   rows=[];counts={};seen=0;cursor=128;overBudget=0;until=now()+2250;
  }
  if(!until||now()>until)return;
  if(seen>=4096){overBudget++;return;}
  counts[name]=(counts[name]||0)+1;
  const api=e?.get_user_pump_observation;
  const callDepth=e?.get_callstack_depth?.()??0;
  // Exactly one public call-frame return word, only at the existing position
  // import. This is caller provenance, never an invented callback return.
  const sp=e?.get_esp?.();
  const positionCaller=name==='get_mouse_position'&&ctx.g2w&&sp
   ?new DataView(ctx.getMemory()).getUint32(ctx.g2w(sp),true):null;
  const row={sequence:++seen,at:now(),name,args:args.slice(0,5),result,
   threadId:e?.get_current_thread_id?.(),eip:e?.get_eip?.(),sp,positionCaller,
   callDepth,publicCallReturns:Array.from({length:Math.min(16,callDepth)},(_,i)=>e.get_callstack_entry(i)>>>0),
   publicPump:api?Array.from({length:21},(_,i)=>api(i)>>>0):null,
   callbackReturn:'unmeasured',
   moves:moves.slice(0,8).map(([h,m])=>{const w=r.windows?.[h],we=(w?.wasm||r.wasm)?.exports;
    return {hwnd:Number(h),moveId:id(m.event),pending:!!m.pending,polled:!!m.polled,x:m.x,y:m.y,
     generation:String(m.generation??''),currentGeneration:String(we?.wnd_lookup_generation?.(+h)??''),
     owner:we?.get_window_thread?.(+h),sameWindow:w===m.window,
     sameMemory:(w?.wasmMemory||r.wasmMemory)?.buffer===ctx.getMemory(),visible:!!w?.visible,retired:!!w?._lookupProcess?.exited};}),
   queue:(r?.inputQueue||[]).slice(0,8).map(v=>({id:id(v),hwnd:v.hwnd,msg:v.msg,wParam:v.wParam,lParam:v.lParam}))};
  if(rows.length<limit)rows.push(row);else{rows[cursor]=row;cursor=cursor+1===limit?128:cursor+1;}
 }
 function wrap(name,fn){if(!watched.has(name)||typeof fn!=='function')return fn;
  return function(...args){depth++;let result;try{return result=Reflect.apply(fn,this,args);}
   finally{if(--depth===0&&!failed)try{record(name,args,result);}catch(error){failed=String(error);}}};}
 const host=base.host;
 for(const name of watched)if(typeof host[name]==='function')host[name]=wrap(name,host[name]);
 base.host=new Proxy(host,{set(o,k,v){o[k]=wrap(k,v);return true;}});
 return {flush(){for(const [spanIndex,span]of [...spans,snapshot()].entries())write({version:1,
  pid:process.pid,workerThread:require('node:worker_threads').threadId,spanIndex,spanLimit:64,failed,...span});}};
}
function install(destination=process.env.DISCIPLES2_PUBLIC_CONSUMER_TRACE){
 if(!destination)return;
 const load=Module._load,wrapped=new WeakSet();
 Module._load=function(request,parent,...rest){
  const value=load.call(this,request,parent,...rest);
  if(value&&Object.hasOwn(value,'createHostImports')&&typeof value.createHostImports==='function'&&!wrapped.has(value)){
   wrapped.add(value);const original=value.createHostImports;
   value.createHostImports=function(ctx){const base=original(ctx);
    const observer=decorate(base,ctx,v=>fs.appendFileSync(destination+'.'+process.pid+'.'+require('node:worker_threads').threadId+'.jsonl',JSON.stringify(v)+'\n'));
    process.once('exit',()=>observer.flush());return base;};
  }
  return value;
 };
}
module.exports={decorate,install};
install();
