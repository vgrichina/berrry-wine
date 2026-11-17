'use strict';

// Opt-in CLI diagnostics of host input objects and public native USER pump
// notifications. Never reads guest memory or invokes an additional guest API.
// Timestamps use the host monotonic clock; event IDs are observation identities,
// never delivery acknowledgements. Defaults keep at most 64 tickets, 512 rows
// per ticket, eight queue entries per snapshot, and a 1750ms terminal tail.
function createPublicInputTrace({write, monotonic=()=>performance.now(), wall=Date.now,
  ticketLimit=64, rowLimit=512}={}) {
 if(typeof write!=='function')throw Error('public input trace needs a sink');
 if(!Number.isInteger(ticketLimit)||ticketLimit<1||ticketLimit>64||
    !Number.isInteger(rowLimit)||rowLimit<8||rowLimit>512)throw Error('invalid public input trace bounds');
 const originMono=monotonic(),originWall=wall(),ids=new WeakMap(),attached=new WeakSet();
 const nativeSources=[];
 let serial=0,current=null,total=0,scheduled=false,failed=null,flushes=0,totalFlushMs=0,maxFlushMs=0;
 let nativeSamples=0,nativeSampleTotalMs=0,nativeSampleMaxMs=0;
 const id=e=>{if(!e||typeof e!=='object')return null;if(!ids.has(e))ids.set(e,++serial);return ids.get(e);};
 const edge=e=>e?{id:id(e),hwnd:e.hwnd>>>0,msg:e.msg>>>0,wParam:e.wParam>>>0,lParam:e.lParam>>>0}:null;
 function queue(r) {
  const q=r?.inputQueue||[],head=q[0],move=r?._pointerMoves?.[head?.hwnd||0];
  return {count:q.length,truncated:q.length>8,head:q.slice(0,8).map(edge),
   hover:move?{nativePump:!!move.nativePump,polled:!!move.polled,pending:!!move.pending,
    x:move.x,y:move.y,generation:move.generation==null?null:String(move.generation),at:move.at}:null};
 }
 function push(phase,detail) {
  if(!current||failed)return;
  const ms=monotonic();if(ms>current.until)return;
  const row={sequence:++current.seen,ms,at:originWall+ms-originMono,phase,...detail};
  const prefix=Math.floor(rowLimit/4),critical=(phase==='renderer-poll-return'&&!!detail.event)||
   ['delivery-pending','native-input-return-candidate','settle','purge-before','purge-after','cancel','release','close'].includes(phase);
  let index=current.rows.length;
  if(index>=rowLimit){
   current.overwritten++;index=current.cursor;
   while(current.pinned.has(index))index=index+1===rowLimit?prefix:index+1;
   current.rows[index]=row;current.cursor=index+1===rowLimit?prefix:index+1;
  }else current.rows.push(row);
  // Preserve a bounded set of exact input/lifecycle identities through a long
  // idle tail. This reserves at most another quarter; native samples stay in
  // the rotating tail. Total retained rows and native work limits are unchanged.
  if(critical&&index>=prefix&&current.pinned.size<prefix)current.pinned.add(index);
  current.dirty=true;
 }
 function flush() {
  scheduled=false;if(!current?.dirty||failed)return;
  const rows=current.rows.slice().sort((a,b)=>a.sequence-b.sequence);
  const started=monotonic();
  try {write({version:1,kind:'public-input-pump',nonce:current.nonce,
   originMono,originWall,seen:current.seen,overwritten:current.overwritten,
   rowLimit,ticketLimit,rows});current.dirty=false;
   const duration=monotonic()-started;flushes++;totalFlushMs+=duration;maxFlushMs=Math.max(maxFlushMs,duration);}
  catch(e){failed=String(e);process.stderr.write('[public-input-trace] sink failed: '+failed+'\n');}
 }
 function later(){if(!scheduled){scheduled=true;setImmediate(flush);}}
 // Read only the bounded observations the native consumer explicitly exports.
 // They describe public API arguments/results; a handler redirect never proves
 // that the guest callback returned. Sampling does not finish any input phase.
 function sampleNative() {
  if(!current||failed||monotonic()>current.until)return;
  for(const source of nativeSources) {
   if(source.failed)continue;
   const started=monotonic();
   try {
   const ex=source.exports;
   const sequence=ex.get_user_pump_observation(0)>>>0;
   const done=ex.get_user_pump_observation(10)>>>0;
   const key=sequence+':'+done;
   if(key===source.last)continue;source.last=key;
   const values=Array.from({length:21},(_,i)=>i===0?sequence:i===10?done:ex.get_user_pump_observation(i)>>>0);
   const refs=current.refs,win=refs.window;
   const names=['sequence','kind','threadId','msgPtr','hwndFilter','min','max','remove','sp','returnAddress',
    'doneSequence','doneKind','disposition','result','yieldReason','hwnd','msg','doneSp',
    'dispatchHwnd','dispatchMsg','dispatchSequence'];
   source.latest={source:source.role,publicAPI:Object.fromEntries(names.map((n,i)=>[n,values[i]])),
    identity:{threadId:ex.get_current_thread_id?.(),targetHwnd:refs.hwnd,
     targetOwnerThread:refs.exports?.get_window_thread?.(refs.hwnd),
     targetGeneration:String(refs.exports?.wnd_lookup_generation?.(refs.hwnd)??''),
     sameWindow:refs.renderer?.windows?.[refs.hwnd]===win,
     sameMemory:(win?.wasmMemory||refs.renderer?.wasmMemory)?.buffer===refs.buffer,
     retired:!!win?._lookupProcess?.exited,visible:!!win?.visible},
    callbackReturn:'unmeasured'};
   push('native-user-consumer',source.latest);
   }catch(error){source.failed=true;push('native-user-observation-unavailable',{source:source.role,reason:String(error)});}
   finally{const elapsed=monotonic()-started;nativeSamples++;nativeSampleTotalMs+=elapsed;nativeSampleMaxMs=Math.max(nativeSampleMaxMs,elapsed);}
  }
 }
 function armNative(refs) {
  for(const source of nativeSources)try{source.exports.set_user_pump_observation(0);}catch{}
  nativeSources.length=0;
  const seen=new Set();
  for(const [role,ex]of [['actor',refs.actorExports],['main',refs.exports]]) {
   try{
   if(!ex||seen.has(ex)||typeof ex.set_user_pump_observation!=='function'||
       typeof ex.get_user_pump_observation!=='function')continue;
   seen.add(ex);
   ex.set_user_pump_observation(4096);nativeSources.push({role,exports:ex,last:null});}
   catch(error){push('native-user-observation-unavailable',{source:role,reason:String(error)});}
  }
 }
 return {
  attach(refs) {
   const r=refs.renderer;if(!r||attached.has(r))return;attached.add(r);
   const take=r.takeInput,idle=r.nativeInputPumpIdle;
   if(typeof take==='function')r.takeInput=function(...args){
    if(!current||monotonic()>current.until)return Reflect.apply(take,this,args);
    push('renderer-poll-enter',{queue:queue(this)});
    sampleNative();
    const event=Reflect.apply(take,this,args);
    push('renderer-poll-return',{event:edge(event),queue:queue(this)});return event;
   };
   if(typeof idle==='function')r.nativeInputPumpIdle=function(buffer,threadId){
    if(!current||monotonic()>current.until)return Reflect.apply(idle,this,[buffer,threadId]);
    push('native-pump-idle-enter',{threadId:threadId>>>0,queue:queue(this)});
    const value=Reflect.apply(idle,this,[buffer,threadId]);
    push('native-pump-idle-return',{threadId:threadId>>>0,queue:queue(this)});return value;
   };
  },
  mark(phase,t,detail={}) {
   if(phase==='prepare') {
    flush();if(total++>=ticketLimit){current=null;return;}
    current={nonce:t.nonce,refs:t.binding.refs,rows:[],pinned:new Set(),seen:0,overwritten:0,cursor:Math.floor(rowLimit/4),
     until:monotonic()+Math.min(2147483647,Math.max(0,t.deadline-wall()))+1750};
    armNative(t.binding.refs);
   }
   if(!current||current.nonce!==t.nonce)return;
   sampleNative();
   push(phase,{state:t.state,consumed:!!t.consumed,deadline:t.deadline,
    queue:queue(t.binding.refs.renderer),nativeConsumers:nativeSources.map(s=>s.latest).filter(Boolean),...detail});
   if(['settle','cancel','release','close'].includes(phase))later();
  },
  flush,
  edge,
  cost:()=>({flushes,totalFlushMs,maxFlushMs,nativeSamples,nativeSampleTotalMs,nativeSampleMaxMs,failed}),
 };
}

function fromEnvironment() {
 const name=process.env.WINE_PUBLIC_INPUT_TRACE;if(!name)return null;
 const fs=require('node:fs'),fd=fs.openSync(name,'wx');
 const trace=createPublicInputTrace({write:value=>fs.writeSync(fd,JSON.stringify(value)+'\n')});
 process.once('exit',()=>{trace.flush();fs.writeSync(fd,JSON.stringify({kind:'public-input-trace-cost',...trace.cost()})+'\n');fs.closeSync(fd);});return trace;
}
module.exports={createPublicInputTrace,fromEnvironment};
