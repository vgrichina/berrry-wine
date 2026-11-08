globalThis.qualifyActualJoin=async function(){
 const report=globalThis.fixtureEvidence={startedAt:new Date().toISOString(),attempts:[],events:[],scope:'installed arm admission, unarm and retirement; actual browser guest/render Workers; fixture exports, no original game'};
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
  report.armResults=[];
  const first=wine.armD3dimPublicationObservation({maxRecords:16});
  const second=wine.armD3dimPublicationObservation({maxRecords:16});
  const results=await Promise.allSettled([first,second]);
  report.armResults=results.map(r=>({status:r.status,error:r.reason?String(r.reason):null,epoch:r.value?[...r.value.epoch.words]:null}));
  check(results[0].status==='fulfilled','first idle installed arm must succeed');
  check(results[1].status==='rejected','concurrent installed arm must reject without replacing first epoch');
  const join=results[0].value;
  check(join.epoch.snapshot(),'concurrent refusal must preserve first epoch');
  check(link.writerObservation===join.epoch&&tm.writerObservation===join.epoch,'same owning epoch installed throughout');
  check(wine._d3dimPublicationArming===false,'arm admission released after acknowledgement');
  report.installedArm=true;
  await link.callExport('q_together',front,back,d);await link._renderLegacyChain;
  await endpoint.producerObservation('read');renderer.repaint();
  check(join.rows.length===1&&join.ledger.length===0,'subsequent actual native publication qualifies');
  const record=join.journal.records()[0],row=join.rows[0];
  check(join.journal.records().length===1&&row.qualified&&join.key(row)===join.key(record)&&
   row.consumedSurfaceVersion===record.sourceVersion&&row.transfers.length&&
   row.request.serial===record.request.serial&&row.request.descriptor===record.request.descriptor&&
   row.canonicalRead.layout.dib===record.layout.dib&&row.pagePublication.atMs>=0,
   'exact single source/request/canonical/display identity and complete accounting');
  report.final={rows:join.rows,ledger:join.ledger,records:join.journal.records(),epoch:[...join.epoch.words]};
  // Use the existing retirement route: stop producing before detaching coverage.
  await endpoint.producerObservation('stop');join.retire('local-unarm');
  gh.setWriterObservation(null);tm.setWriterObservation(null);wine._d3dimWriterObservation=null;
  check(!join.live&&!join.epoch.snapshot(),'retirement revokes old authority');
  await link.callExport('q_together',front,back,d);await link._renderLegacyChain;renderer.repaint();
  report.unarmed={rows:join.rows.length,ledger:join.ledger.length,observation:await endpoint.producerObservation('read'),pixels:[...canvas.getContext('2d').getImageData(0,0,2,2).data]};
  check(join.rows.length===1&&report.unarmed.observation.records.length===1,'unarmed ordinary execution adds no observation');
  check(report.unarmed.pixels.every((v,n)=>v===[34,0,0,255][n%4]),'ordinary pixels survive unarm');
  const retiredArm=await wine.armD3dimPublicationObservation({maxRecords:16}).then(()=>null,e=>String(e));
  check(retiredArm&&wine._d3dimPublicationJoin===join,'retired Join cannot silently rearm');
  report.retiredArm=retiredArm;

 }finally{
  try{if(manager)report.retirement=await manager.stop();}finally{if(link)await link.stop();}
  check(!wine._d3dimPublicationJoin?.live,'actual owning Worker retirement cannot revive authority');
  report.guestRetired=link?._stopped;
  report.finishedAt=new Date().toISOString();
 }
 return report;
};
