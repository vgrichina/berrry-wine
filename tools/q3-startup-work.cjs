'use strict';
// This function is serialized into the authenticated guest Worker installer.
// Count time inside original imports separately from completed slice time.
// No guest reads/writes, extra RPCs, timers, or replacement return values.
function install(host, {now=()=>performance.now(),emit=()=>{},intervalMs=500,maxReports=120}={}) {
 let active=true,reports=0,calls=0,importMs=0,slices=0,sliceMs=0,last=-Infinity;
 const started=now(),byName=new Map();
 function stop(){active=false;}
 for(const [name,fn] of Object.entries(host))if(typeof fn==='function'&&name!=='q3_menu_event'){
  host[name]=function(...args){
   if(!active)return Reflect.apply(fn,this,args);
   const at=now();
   try{return Reflect.apply(fn,this,args);}finally{
    const ms=Math.max(0,now()-at);calls++;importMs+=ms;
    let row=byName.get(name);if(!row){row={name,calls:0,ms:0,maxMs:0};byName.set(name,row);}
    row.calls++;row.ms+=ms;row.maxMs=Math.max(row.maxMs,ms);
   }
  };
 }
 function slice(message){
  if(!active||message?.t!=='sliceDone')return message;
  slices++;sliceMs+=Math.max(0,Number(message.ms)||0);
  const at=now();
  if(at-last<intervalMs)return message;
  last=at;
  const record={version:1,clock:'guest-worker.performance.now',report:++reports,
   elapsedMs:Math.max(0,at-started),calls,importMs,slices,sliceMs,
   seq:message.seq,eip:message.eip,yield:message.yield,
   top:[...byName.values()].sort((a,b)=>b.ms-a.ms).slice(0,12).map(r=>({...r}))};
  try{emit(record);}catch{stop();}
  if(reports>=maxReports||at-started>=60000)stop();
  return message;
 }
 return {slice,stop};
}
module.exports={install};
