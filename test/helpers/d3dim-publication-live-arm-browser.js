globalThis.qualifyActualJoin=async function(){
 const report=globalThis.fixtureEvidence={startedAt:new Date().toISOString(),attempts:[],events:[],scope:'live scheduled observation admission; actual browser guest/render Workers, pending native command, installed scheduler; fixture exports, no original game'};
 const check=(v,s)=>{if(!v)throw Error(s);};
 const module=await WebAssembly.compile(await(await fetch('/qualify-fixture.wasm')).arrayBuffer());
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const sigs=(await(await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
 const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;document.body.append(canvas);
 const renderer=new Win98Renderer(canvas);renderer.scheduleRepaint=()=>{};
 renderer.createWindow(0x77,0x90000000,0,0,2,2,'',0);
 const wine=Object.create(WineAssembly.prototype);
 const ctx={getMemory:()=>memory.buffer,exports:{},renderer,get d3dimPublicationJoin(){return wine._d3dimPublicationJoin;}};
 const {host,gdi}=createHostImports(ctx);
 const broker=GuestRpc.createMainBroker(memory,host,sigs,{onError:(name,error)=>report.events.push({name,error:String(error)})});broker.publish({tickMs:0});
 const imports={host:{memory}};for(const x of WebAssembly.Module.imports(module))if(x.kind==='function')imports[x.module][x.name]=()=>0;
 const main=RenderWorker.observeInstance(new WebAssembly.Instance(module,imports),()=>wine._d3dimWriterObservation);
 const tm=new ThreadManager(module,memory,main,()=>imports,{});
 const gh=new GuestThreadHost({memory});
 let link,manager;
 try{
  manager=new RenderWorker.Manager({module,memory,sigs,imageBase:0x400000,sourceVersion:WINE_SOURCE_VERSION,workerUrl:WineAssembly.versionedUrl('lib/d3d-render-worker.js'),reclaimHeap:head=>link.callExport('d3d_render_adopt_free_list',head)});await manager.ready;
  link=new GuestWorkerLink({slot:0,module,memory,sigs,broker,sharedRenderWorker:true,d3dimGpu:true,workerUrl:WineAssembly.versionedUrl('lib/guest-worker.js'),createRenderEndpoint:async options=>{const p=manager.createEndpoint(options);await p.ready;return p;},log:s=>report.events.push({log:s})});
  await link.start();gh.link=link;
  Object.assign(wine,{instance:main,memory,guestWorker:gh,renderer,threadManager:tm,processId:8181});
  await link.callExport('q_init');
  const front=RegionMap.BASE.DX_OBJECTS+32*7,back=front+32,a=RegionMap.BASE.DIB_BACKING_BASE,b=a+64,d=b+64;
  const dv=new DataView(memory.buffer),bytes=new Uint8Array(memory.buffer);
  for(const [entry,dib]of [[front,a],[back,b]]){
   dv.setUint32(entry,2,true);for(const [o,v]of [[12,2],[14,2],[16,32],[18,8]])dv.setUint16(entry+o,v,true);dv.setUint32(entry+20,dib,true);
   for(let i=0;i<16;i+=4)bytes.set([0,0,entry===front?17:34,255],dib+i);
  }
  await link.callExport('q_together',front,back,d);await link._renderLegacyChain;
  const endpoint=link._renderLegacyEndpoint;check(endpoint,'actual render endpoint');
  report.endpoint={id:endpoint.id,options:endpoint.options};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const until=async(fn,label)=>{const end=performance.now()+5000;while(!fn()){check(performance.now()<end,label);await wait(1);}};
  const holdCommand=async()=>{
   const forward=link._forwardRenderLegacy.bind(link),held=[];
   link._forwardRenderLegacy=m=>held.push(m);
   const command=link.callExport('q_together',front,back,d);
   await until(()=>held.length,'native fence did not reach transport');
   check(link._pending.size===1,'real guest command remains outstanding');
   return async()=>{link._forwardRenderLegacy=forward;for(const m of held)forward(m);await command;await link._renderLegacyChain;};
  };
  wine.running=true;
  let release=await holdCommand();
  try{
   report.waitingError=await wine.armD3dimPublicationObservation({maxRecords:16,boundaryTimeoutMs:60}).then(()=>null,e=>String(e));
   check(report.waitingError?.includes('idle boundary timed out'),'live pending arm waits for a bounded natural boundary: '+report.waitingError);
   check(link._pending.size===1&&!link.writerObservation&&!wine._d3dimWriterObservation&&!wine._d3dimPublicationArming&&!wine._d3dimPublicationArmBoundary,'timeout never attaches retroactively or releases outstanding command');
  }finally{await release();}
  report.timeoutPreservedCommand=true;
  const clone=()=>Object.assign(Object.create(WineAssembly.prototype),wine);
  const probes=[];
  try{
   report.replacedErrors=[];
   for(const field of ['guestWorker','memory','processId']){
    const replaced=clone();probes.push(replaced);
    const pending=replaced.armD3dimPublicationObservation({maxRecords:16});
    replaced[field]=field==='guestWorker'?Object.create(gh):field==='memory'?{}:8182;
    let resumed=0;replaced._scheduleStep(()=>resumed++,0);
    const error=await pending.then(()=>null,e=>String(e));report.replacedErrors.push({field,error});
    await wait(20);
    check(error?.includes('owner changed before')&&!link.writerObservation&&resumed===0,'replaced '+field+' refuses attachment and obsolete continuation');
   }
   const stopped=clone();probes.push(stopped);
   const stopping=stopped.armD3dimPublicationObservation({maxRecords:16});stopped._stopped=true;
   let ranStopped=0;stopped._scheduleStep(()=>ranStopped++,0);
   report.stoppedError=await stopping.then(()=>null,e=>String(e));await wait(20);
   check(report.stoppedError?.includes('owner changed before')&&ranStopped===0&&!link.writerObservation,'stopped process never resumes or attaches');
  }finally{for(const p of probes){p._stepPort?.close();p._stepListenPort?.close();}}
  release=await holdCommand();
  let allowAck,ackHeld=false;const ackGate=new Promise(r=>allowAck=r),producer=endpoint.producerObservation.bind(endpoint);
  endpoint.producerObservation=async(action,options)=>{const r=await producer(action,options);if(action==='arm'){ackHeld=true;await ackGate;}return r;};
  let publishedResolve,publishedReject;const published=new Promise((r,j)=>{publishedResolve=r;publishedReject=j;});
  let resumed=0;
  const nextStep=async()=>{resumed++;try{
   await link.callExport('q_together',front,back,d);await link._renderLegacyChain;
   await producer('read');
   await until(()=>wine._d3dimPublicationJoin.epoch.snapshot(),'diagnostic writer did not finish before composition');
   renderer.repaint();publishedResolve();
  }catch(e){publishedReject(e);}};
  const ticks=wine._stepTicks||0;
  let join;
  try{
   const arming=wine.armD3dimPublicationObservation({maxRecords:16});
   check(wine._d3dimPublicationArming&&!link.writerObservation,'reservation precedes boundary without attaching to old command');
   await release();release=null;
   wine._scheduleStep(nextStep,0);
   await until(()=>ackHeld,'actual renderer arm acknowledgement not reached');
   check(resumed===0&&(wine._stepTicks||0)===ticks,'next slice held through render acknowledgement without extra step count');
   // A duplicate wake is coalesced while the same scheduler continuation waits.
   wine._scheduleStep(nextStep,0);
   allowAck();join=await arming;await published;
   check(resumed===1&&wine._stepTicks===ticks+1&&!wine._d3dimPublicationArmBoundary&&!wine._d3dimPublicationArming,'exactly one ordinary continuation resumes');
   const records=join.journal.records(),row=join.rows[0];
   report.final={rows:join.rows,ledger:join.ledger,records,epoch:[...join.epoch.words]};
   check(records.length===1&&join.rows.length===1&&join.ledger.length===0,'first post-admission native flip has one exact source disposition');
   check(row.qualified&&join.key(row)===join.key(records[0])&&row.consumedSurfaceVersion===records[0].sourceVersion&&row.request.serial===records[0].request.serial&&row.request.descriptor===records[0].request.descriptor&&row.transfers.length&&row.canonicalRead.layout.dib===records[0].layout.dib&&row.pagePublication.atMs>=0,'complete unchanged source/canonical/display gates');
   report.pixels=[...canvas.getContext('2d').getImageData(0,0,2,2).data];
   check(report.pixels.every((v,n)=>v===[17,0,0,255][n%4]),'all ordinary pixels survive live admission');
   report.liveArm=true;report.continuations=resumed;
  }finally{
   allowAck();if(release)await release();wine.running=false;endpoint.producerObservation=producer;
   if(join){
    join.retire('live-arm-fixture-complete');
    report.retiredDispositions={rows:join.rows,ledger:join.ledger,records:join.journal.records()};
    await producer('stop');
   }
   wine._stepPort?.close();wine._stepListenPort?.close();
  }
 }finally{
  try{if(manager)report.retirement=await manager.stop();}finally{if(link)await link.stop();}
  report.guestRetired=link?._stopped;
  report.finishedAt=new Date().toISOString();
 }
 return report;
};
