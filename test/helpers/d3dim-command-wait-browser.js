globalThis.qualifyActualJoin=async function(){
 const report=globalThis.fixtureEvidence={startedAt:new Date().toISOString(),attempts:[],events:[],scope:'browser WebGL actual guest/render Workers and installed WineAssembly arm; fixture exports, no original game'};
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
  // Matched actual command round trips, before installing the source observer.
  report.commandCost=[];
  for(let group=0;group<9;group++)for(const armed of group%2?[true,false]:[false,true]){
   const epoch=armed?new RenderWorker.WriterEpoch():null;link.setWriterObservation(epoch);
   for(let j=0;j<10;j++)await link.readExports(['get_image_base']);
   const start=performance.now(),iterations=100;
   for(let j=0;j<iterations;j++)await link.readExports(['get_image_base']);
   report.commandCost.push({group,armed,iterations,elapsedMs:performance.now()-start});
   link.setWriterObservation(null);
  }
  const join=await wine.armD3dimPublicationObservation({maxRecords:16});report.installedArm=true;
  endpoint.addEventListener('message',e=>{if(e.data.t==='legacy-producer-completed')report.events.push(e.data);});
  const idle=async()=>{const deadline=performance.now()+5000;while(!join.epoch.snapshot()){
   check(!join.epoch.words[2]&&performance.now()<deadline,'observation did not become idle');await new Promise(r=>setTimeout(r,1));}};
  for(let i=0;i<4;i++){
   await link.callExport('q_together',front,back,d);await link._renderLegacyChain;
   const observation=await endpoint.producerObservation('read');await idle();renderer.repaint();
   report.attempts.push({kind:'same guest entry queues flip and fences',observation,epoch:[...join.epoch.words],rows:structuredClone(join.rows),ledger:structuredClone(join.ledger),canonical:[...gdi.surfacePresentations.values()].map(p=>({id:p.id,owed:p.owedPresentRequest,version:!!p.canvas._waD3dimVersion})),pixel:[...canvas.getContext('2d').getImageData(0,0,1,1).data],fullPixels:[...canvas.getContext('2d').getImageData(0,0,2,2).data]});
  }
  check(join.rows.length===4&&join.ledger.length===0,'four exact native fence publications');
  for(let i=0;i<4;i++){
   const attempt=report.attempts[i],row=attempt.rows[i],raw=attempt.observation.records[i],canonical=attempt.canonical[0];
   check(row.qualified&&row.consumedSurfaceVersion===raw.sourceVersion&&join.key(row)===join.key(raw),'exact source identity');
   check(row.request.serial===canonical.owed.serial&&row.request.descriptor===canonical.owed.descriptor&&row.front===canonical.owed.front,'exact owed canonical request');
   check(row.canonicalRead.layout.dib===row.layout.dib&&row.transfers.length&&row.pagePublication.atMs>=0,'canonical display identity');
   check(attempt.fullPixels.every((v,n)=>v===[i%2?34:17,0,0,255][n%4]),'all ordinary pixels unchanged');
  }
  const positives=join.rows.map(r=>join.key(r));
  // A second live writer must not be parked by the native command's handoff.
  const extra=join.epoch.begin();
  await link.callExport('q_together',front,back,d);await link._renderLegacyChain;
  await endpoint.producerObservation('read');renderer.repaint();join.epoch.end(extra);await idle();
  check(join.rows.length===4&&join.ledger.length===1,'overlapping writer rejected');
  report.overlap={record:join.ledger.at(-1),epoch:[...join.epoch.words]};
  // A command with unavailable handoff coverage retains the whole parent
  // ticket. Ordinary rendering continues; absence cannot certify a source.
  const post=link.worker.postMessage.bind(link.worker);
  link.worker.postMessage=(message,...args)=>{const m={...message};delete m.commandWriterHandoff;return post(m,...args);};
  try{await link.callExport('q_together',front,back,d);}finally{link.worker.postMessage=post;}
  await link._renderLegacyChain;await endpoint.producerObservation('read');await idle();renderer.repaint();
  check(join.rows.length===4&&join.ledger.length===2,'unavailable handoff rejected');
  report.unavailable={record:join.ledger.at(-1),epoch:[...join.epoch.words]};
  // Resume native execution, store, and stop before its page-watch notice.
  const pause=new Int32Array(memory.buffer,a+8192,2);pause.fill(0);
  await link.callExport('q_pause_at',a+8192);
  const writing=link.callExport('q_together_store',front,back,d);
  try{
   const deadline=performance.now()+5000;
   while(!Atomics.load(pause,1)&&performance.now()<deadline)await new Promise(r=>setTimeout(r,1));
   check(Atomics.load(pause,1)===1,'actual resumed guest reached poststore/prewatch');
   await link._renderLegacyChain;await endpoint.producerObservation('read');
   const record=join.journal.records().at(-1);check(!record.versionRejected,'source sealed while guest truly parked');
   const pagesUnchanged=join.journal.unchanged(memory,record);
   check(pagesUnchanged&&!join.epoch.snapshot(),'resumed writer covered before notification');
   const p=[...gdi.surfacePresentations.values()][0];p.surface.markDirty(0,0,2,2);renderer.repaint();
   check(join.rows.length===4&&join.ledger.length===3,'resumed poststore writer rejected');
   report.resumed={record,discard:join.ledger.at(-1),pagesUnchanged,epoch:[...join.epoch.words],pixels:[...canvas.getContext('2d').getImageData(0,0,2,2).data]};
  }finally{Atomics.store(pause,0,1);Atomics.notify(pause,0);await writing;}
  await link.callExport('q_pause_at',0);await idle();
  check(positives.every((k,i)=>join.key(join.rows[i])===k),'positive identities immutable');
  const records=join.journal.records(),accounted=[...join.rows,...join.ledger.map(d=>d.record)].map(r=>join.key(r));
  check(records.length===7&&accounted.length===7&&new Set(accounted).size===7&&records.every(r=>accounted.includes(join.key(r))),'complete one-to-one source accounting');
  check(report.resumed.pixels[0]===68,'composition observes actual poststore/prewatch source pixel');
  // Real timeout while the guest is parked in Encoder._waitFor. Hold only
  // the fixture's transport delivery, then allow the original batch to finish.
  let posted,lateResolve;const lateReply=new Promise(r=>lateResolve=r),held=[];
  const forward=link._forwardRenderLegacy.bind(link),postTimeout=link.worker.postMessage.bind(link.worker);
  const reply=e=>{if(e.data.seq===posted?.seq&&e.data.t==='exportResult')lateResolve(e.data);};
  link.worker.addEventListener('message',reply);
  link.worker.postMessage=(m,...args)=>{if(m.commandWriterHandoff)posted=m;return postTimeout(m,...args);};
  link._forwardRenderLegacy=m=>held.push(m);
  try{
   const timingOut=link._ask({t:'callExport',name:'q_together',args:[front,back,d]},500).then(()=>{throw Error('unexpected timeout success');},e=>String(e));
   const state=new Int32Array(posted.commandWriterHandoff.buffer),deadline=performance.now()+400;
   while(Atomics.load(state,0)!==2&&performance.now()<deadline)await new Promise(r=>setTimeout(r,1));
   check(Atomics.load(state,0)===2,'real guest parked before timeout');
   const error=await timingOut;check(error.includes('did not answer')&&join.epoch.words[2]===1&&!join.epoch.snapshot(),'parked timeout poisons coverage');
   link._forwardRenderLegacy=forward;link.worker.postMessage=postTimeout;
   while(held.length)forward(held.shift());
   const late=await lateReply;await link._renderLegacyChain;await endpoint.producerObservation('read');renderer.repaint();
   check(Atomics.load(state,0)===1&&join.epoch.words[0]>=1&&join.rows.length===4,'late reply cannot release ambiguous resumed writer');
   report.timeout={error,late,state:[...state],epoch:[...join.epoch.words]};
  }finally{link._forwardRenderLegacy=forward;link.worker.postMessage=postTimeout;while(held.length)forward(held.shift());link.worker.removeEventListener('message',reply);}
  const all=join.journal.records(),keys=[...join.rows,...join.ledger.map(d=>d.record)].map(r=>join.key(r));
  check(all.length===8&&keys.length===8&&new Set(keys).size===8&&all.every(r=>keys.includes(join.key(r))),'timeout source accounted exactly once');
  report.final={rows:join.rows,ledger:join.ledger,records:join.journal.records(),failure:join.failure??null,epoch:[...join.epoch.words]};
  join.retire('fixture-complete');await endpoint.producerObservation('stop');
 }finally{
  try{if(manager)report.retirement=await manager.stop();}finally{if(link)await link.stop();}
  report.finishedAt=new Date().toISOString();
 }
 return report;
};
