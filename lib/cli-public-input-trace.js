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
 let serial=0,current=null,total=0,scheduled=false,failed=null,flushes=0,totalFlushMs=0,maxFlushMs=0;
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
  if(current.rows.length<rowLimit)current.rows.push(row);
  else {current.overwritten++;current.rows[current.cursor]=row;current.cursor++;
   if(current.cursor===rowLimit)current.cursor=Math.floor(rowLimit/4);}
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
 return {
  attach(refs) {
   const r=refs.renderer;if(!r||attached.has(r))return;attached.add(r);
   const take=r.takeInput,idle=r.nativeInputPumpIdle;
   if(typeof take==='function')r.takeInput=function(...args){
    if(!current||monotonic()>current.until)return Reflect.apply(take,this,args);
    push('renderer-poll-enter',{queue:queue(this)});
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
    current={nonce:t.nonce,rows:[],seen:0,overwritten:0,cursor:Math.floor(rowLimit/4),
     until:monotonic()+Math.min(2147483647,Math.max(0,t.deadline-wall()))+1750};
   }
   if(!current||current.nonce!==t.nonce)return;
   push(phase,{state:t.state,consumed:!!t.consumed,deadline:t.deadline,
    queue:queue(t.binding.refs.renderer),...detail});
   if(['settle','cancel','release','close'].includes(phase))later();
  },
  flush,
  edge,
  cost:()=>({flushes,totalFlushMs,maxFlushMs,failed}),
 };
}

function fromEnvironment() {
 const name=process.env.WINE_PUBLIC_INPUT_TRACE;if(!name)return null;
 const fs=require('node:fs'),fd=fs.openSync(name,'wx');
 const trace=createPublicInputTrace({write:value=>fs.writeSync(fd,JSON.stringify(value)+'\n')});
 process.once('exit',()=>{trace.flush();fs.writeSync(fd,JSON.stringify({kind:'public-input-trace-cost',...trace.cost()})+'\n');fs.closeSync(fd);});return trace;
}
module.exports={createPublicInputTrace,fromEnvironment};
