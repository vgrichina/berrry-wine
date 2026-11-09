'use strict';
const assert=require('node:assert/strict');
// Traces are diagnostics, not capture/admission proof. A busy guest may never
// service Runtime.evaluate while the owning renderer still proves an image.
// Keep one outstanding read per worker; late results cannot publish artifacts
// or schedule another protocol operation. The existing send/CDP guard owns it.
const inflight=new WeakMap(),LIMIT_MS=1000,RESERVE_MS=100;
async function snapshot({label,workEnd,workers,evaluate,save,terminal}){
 assert(!terminal(),'runtime terminal before trace');
 assert(Number.isFinite(workEnd)&&Date.now()<workEnd,'command work deadline before trace');
 let pending=inflight.get(workers);if(!pending){pending=new Map();inflight.set(workers,pending);}
 const rows=[];
 for(const w of workers.values())if(!w.closed){
  assert(!terminal(),'runtime terminal before trace dispatch');
  const row={targetId:w.targetId,sessionId:w.sessionId,status:'pending'};rows.push(row);
  if(pending.has(w.sessionId)){row.status='previous-read-pending';continue;}
  const task=Promise.resolve().then(()=>{
   assert(!terminal(),'runtime terminal before trace dispatch');
   return evaluate('globalThis.__inputConsumption?.snapshot()',w.sessionId);
  }).then(value=>({status:value?'complete':'observer-absent',value}),error=>({status:'error',error:String(error)}));
  pending.set(w.sessionId,task);
  task.then(()=>{if(pending.get(w.sessionId)===task)pending.delete(w.sessionId);});
  row.task=task;
 }
 let timer,accept=true;
 const tasks=rows.filter(r=>r.task).map(async row=>{
  const result=await row.task;if(accept)Object.assign(row,result);
 });
 const budgetMs=Math.max(0,Math.min(LIMIT_MS,workEnd-Date.now()-RESERVE_MS));
 try{await Promise.race([Promise.all(tasks),new Promise(resolve=>{timer=setTimeout(resolve,budgetMs);})]);}
 finally{accept=false;clearTimeout(timer);}
 assert(!terminal(),'runtime terminal; discard unsettled trace');
 assert(Date.now()<workEnd,'command work deadline after trace');
 for(const row of rows){
  delete row.task;
  if(row.status==='pending')row.status='bounded-wait-incomplete';
  if(row.status==='complete'){save(label+'-trace-'+row.targetId+'.json',row.value);delete row.value;}
 }
 const receipt={diagnosticOnly:true,budgetMs,complete:rows.every(r=>['complete','observer-absent'].includes(r.status)),workers:rows};
 save(label+'-trace-service.json',receipt);return receipt;
}
function integrate(source){
 const replace=(a,b)=>{assert.equal(source.split(a).length,2,'one command trace seam: '+a);source=source.replace(a,b);};
 const start=source.indexOf('async function traceSnapshot('),end=source.indexOf('\nasync function capture(',start);
 assert(start>=0&&end>start,'actual trace consumer');
 source=source.slice(0,start)+`async function traceSnapshot(label,workEnd){return require(root+'/tools/redline-command-trace.cjs').snapshot({label,workEnd,workers,evaluate,save,terminal:()=>closing});}`+source.slice(end);
 replace('async function capture(label){','async function capture(label,workEnd=deadline){');
 replace("assert(!closing,'runtime terminal; discard unsettled capture');","assert(!closing,'runtime terminal; discard unsettled capture');assert(Date.now()<workEnd,'command work deadline; discard late image');");
 replace('await traceSnapshot(label);','await traceSnapshot(label,workEnd);');
 replace('await wait(c.waitMs);await capture(c.label);',"const workEnd=c.timing?.workEnd??deadline;await wait(c.waitMs);await capture(c.label,workEnd);assert(!closing&&Date.now()<workEnd,'command work deadline; no ACK');");
 return source;
}
module.exports={snapshot,integrate,LIMIT_MS,RESERVE_MS};
