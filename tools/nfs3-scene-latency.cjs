'use strict';
// Harness diagnostics only: producer clocks remain authoritative. No polls,
// guest writes, input, readiness publication or clock conversion.
function installWorker() {
  const post=globalThis.postMessage;
  globalThis.postMessage=function(message,...rest){
    if(message?.t==='calls'&&message.list?.some((a,i)=>i%2===1&&Array.isArray(a)&&a.length===14&&a[0]===-1))
      message={...message,__nfsLatencySend:{wall:Date.now(),mono:performance.timeOrigin+performance.now()}};
    return Reflect.apply(post,this,[message,...rest]);
  };
}
function installPage() {
  const Native=globalThis.Worker,rows=[],tasks=[];let serial=0;
  const put=(list,row)=>{if(list.length===512)list.shift();list.push(row);};
  globalThis.Worker=class extends Native {
    constructor(...args){super(...args);const id=++serial;
      this.addEventListener('message',event=>{
        const m=event.data;if(!m?.__nfsLatencySend)return;
        for(let i=1;i<m.list.length;i+=2){const a=m.list[i];
          if(!Array.isArray(a)||a.length!==14||a[0]!==-1)continue;
          put(rows,{worker:id,slot:m.slot,endpoint:a[13],scene:a.slice(1,11),
            producerWall:a[11],producerMono:a[12],sent:m.__nfsLatencySend,
            receiptWall:Date.now(),receiptMono:performance.timeOrigin+performance.now()});
        }
      });
    }
  };
  const observer=new PerformanceObserver(list=>{
    for(const e of list.getEntries())put(tasks,{start:performance.timeOrigin+e.startTime,duration:e.duration});
  });
  observer.observe({type:'longtask',buffered:true});
  globalThis.nfs3LatencyReport=()=>({rows:rows.slice(),longTasks:tasks.slice(),extraGuestPolls:0,guestWrites:0});
}
function analyze(report) {
  const values=report.rows.map(r=>({...r,queueMs:r.sent.mono-r.producerMono,
    transportMs:r.receiptMono-r.sent.mono,producerAgeMs:r.receiptMono-r.producerMono,
    overlappingLongTasks:report.longTasks.filter(t=>t.start<r.receiptMono&&t.start+t.duration>r.sent.mono)}));
  return {values,maxQueueMs:Math.max(0,...values.map(r=>r.queueMs)),
    maxTransportMs:Math.max(0,...values.map(r=>r.transportMs)),
    lateReceipts:values.filter(r=>r.producerAgeMs>250).length};
}
// Preparation, before requesting a screenshot or binding input. Waiting only
// observes the existing guard; it never asks an actor to run or poll. The
// screenshot and its personal review retain their own original timestamps.
async function prepareCapture(wine,{budgetMs=3000}={}) {
  if(!Number.isInteger(budgetMs)||budgetMs<1||budgetMs>3000)throw Error('capture preparation budget');
  const start=Date.now(),mono=performance.now(),guard=wine?._browserNativeInput;
  if(!guard)throw Error('native guard missing');
  const first=guard.snapshot(),scene=first.scene;
  if(!Array.isArray(scene)||scene.length!==10||!first.healthy||first.terminal)throw Error('native scene unavailable');
  const pin=()=>{
    const backend=wine.guestWorker,bridge=wine.hostCtx?.d3dimBridge;
    const actor=first.slot===backend?.link?.slot?backend.link:backend?.threadLinks?.get(first.slot);
    return [wine.renderer,wine.memory,wine.memory?.buffer,wine.instance,wine._wasmModule,
      wine._processObject,backend,backend?.link,actor,actor?.worker,actor?.endpointIdentity,
      wine.renderer?.windows?.[scene[2]],bridge,bridge?.endpoint,bridge?.endpoint?.manager,
      wine._renderWorkerManager,wine._renderWorkerManager?.worker,bridge?.presenter?.layer,
      actor?._stopped,actor?._stopping,actor?._retirementComplete,bridge?.endpoint?.closed,
      bridge?.workerClosing,bridge?.workerAsyncError];
  };
  const refs=pin();let samples=0,last;
  for(;;){
    last=guard.snapshot();samples++;
    const current=pin();
    if(refs.some((r,i)=>r!==current[i])||!last.healthy||last.terminal||last.slot!==first.slot||last.scene?.length!==scene.length||
      !last.scene?.every((v,i)=>v===scene[i]))throw Error('native capture owner/generation changed');
    if(Date.now()-start>=budgetMs||performance.now()-mono>=budgetMs)
      throw Error('native capture preparation expired');
    if(last.ready)return {startedAt:start,completedAt:Date.now(),samples,first,last};
    await new Promise(resolve=>setTimeout(resolve,20));
  }
}
module.exports={installWorker,installPage,analyze,prepareCapture,workerBootstrap:()=>`;(${installWorker.toString()})();\n`};
