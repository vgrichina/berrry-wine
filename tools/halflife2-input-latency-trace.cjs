'use strict';
// Passive host boundaries. Never runs guest instructions, consumes an event,
// changes a deadline, or turns a transport reply into a native receipt.
const fs=require('node:fs'),http=require('node:http');
const {AsyncLocalStorage}=require('node:async_hooks');
function install(file,{limit=4096}={}){
 const rows=[],context=new AsyncLocalStorage();let sequence=0,dropped=0,selfNs=0n;
 const mark=(phase,detail={})=>{
  const begin=process.hrtime.bigint();
  if(rows.length<limit)rows.push({phase,sequence:++sequence,at:Date.now(),monoNs:begin.toString(),request:context.getStore(),...detail});
  else dropped++;
  selfNs+=process.hrtime.bigint()-begin;
 };
 const ticket=t=>t&&({nonce:t.nonce,state:t.state,deadline:t.deadline,consumed:t.consumed,appliedAt:t.appliedAt,consumedAt:t.consumedAt});
 const key=Symbol.for('wine.hl2.inputLatency');
 if(globalThis[key])throw Error('duplicate input latency observer');
 globalThis[key]=mark;
 const measured=(name,fn,detail=()=>({}))=>function(...args){
  const start=process.hrtime.bigint(),cpu=process.cpuUsage();mark(name+'-enter',detail(args));
  try{return Reflect.apply(fn,this,args);}
  finally{mark(name+'-return',{...detail(args),elapsedNs:(process.hrtime.bigint()-start).toString(),cpu:process.cpuUsage(cpu)});}
 };
 const emit=http.Server.prototype.emit;
 http.Server.prototype.emit=function(event,...args){
  if(event!=='request'||args[0]?.url!=='/ctl')return Reflect.apply(emit,this,[event,...args]);
  const [req,res]=args,id=++sequence;
  return context.run(id,()=>{
   mark('http-request');let body='',truncated=false;
   req.on('data',b=>{if(body.length+b.length<=16384)body+=b;else truncated=true;});
   req.on('end',()=>{let command;try{command=JSON.parse(body);}catch{}
    mark('http-body-complete',{action:command?.action,nonce:command?.guard?.nonce,deadline:command?.guard?.deadline,truncated});});
   res.once('finish',()=>mark('http-finish',{status:res.statusCode}));
   return Reflect.apply(emit,this,[event,...args]);
  });
 };
 const module=require('../lib/cli-guarded-input'),create=module.createGuardedInput;
 module.createGuardedInput=function(options){
  const wrapped={...options};
  for(const name of ['snapshot','validateIntent','captureDelivery','validateDelivery','captureNativeControl','confirmNativeControl','cleanup'])
   if(typeof options[name]==='function')wrapped[name]=measured(name,options[name]);
  const guard=Reflect.apply(create,this,[wrapped]);
  for(const name of ['prepare','wait','consume','dequeued','delivered','nativeConsumed','nativeModal','release','status','close']){
   const fn=guard[name];if(typeof fn!=='function')continue;
   guard[name]=measured('guard-'+name,fn,args=>name==='prepare'?{nonce:args[0]?.nonce,deadline:args[0]?.deadline}:
    ['consume','wait'].includes(name)?ticket(args[0])||{}:{});
  }
  return guard;
 };
 let flushed=false;
 const flush=()=>{if(flushed)return;flushed=true;
  fs.writeFileSync(file,JSON.stringify({version:1,passive:true,pid:process.pid,rows,dropped,selfNs:selfNs.toString()},null,2)+'\n',{flag:'wx'});};
 process.once('exit',flush);
 return {flush,restore(){module.createGuardedInput=create;http.Server.prototype.emit=emit;delete globalThis[key];}};
}
module.exports={install};
if(process.env.WINE_HL2_INPUT_LATENCY_TRACE&&require('node:worker_threads').isMainThread)install(process.env.WINE_HL2_INPUT_LATENCY_TRACE);
