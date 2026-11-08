'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=require('node:path').resolve(__dirname,'..');
const API=require(root+'/lib/render-worker'),{BASE}=require(root+'/lib/region-map.generated'),{Win98Renderer}=require(root+'/lib/renderer'),{createCanvas}=require(root+'/lib/raster-canvas'),{createHostImports}=require(root+'/lib/host-imports');
const source=fs.readFileSync(root+'/lib/d3d-render-worker.js','utf8'),binary=fs.readFileSync(root+'/build/wine-assembly.wasm');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const moduleBytes=new WebAssembly.Module(binary);
const baselineSource=source.replace("message.t === 'legacy-call' && message.opcode !== 0x20004 && entry.producerObservation?.active","message.t === 'legacy-call' && entry.producerObservation?.active");
assert.notEqual(baselineSource,source,'production must contain scoped clear compatibility');
async function fixture(patched,variant='clear'){
 const memory=new WebAssembly.Memory({initial:8192,maximum:32768,shared:true}),imports={host:{memory}};
 for(const i of WebAssembly.Module.imports(moduleBytes))if(i.kind==='function')imports[i.module][i.name]=()=>0;
 const native=new WebAssembly.Instance(moduleBytes,imports);native.exports.heap_init(0x3000000);
 const sent=[],c={performance,console,WebAssembly,ArrayBuffer,SharedArrayBuffer,Uint8Array,DataView,Map,Set,Atomics,Promise,require:name=>name==='worker_threads'?{parentPort:{on(){},postMessage:m=>sent.push(structuredClone(m))}}:require(root+'/lib/'+name.replace('./',''))};
 vm.createContext(c);vm.runInContext((patched?source:baselineSource)+`\nglobalThis.install=(n,m)=>{instance=n;memory=m;sharedMode=true;initializedImage=0x400000;stateGuest=1;verticesGuest=2;descriptorGuest=3;};globalThis.dispatch=sharedMessage;globalThis.entry=id=>endpoints.get(id);`,c);c.install(native,memory);
 const dispatch=m=>c.dispatch({t:'render-message',endpointId:1,message:m});
 await c.dispatch({t:'render-open',endpointId:1,options:{api:'legacy',backend:'software'}});
 const buffer=new SharedArrayBuffer(32),controlBuffer=new SharedArrayBuffer(64),control=new Int32Array(controlBuffer),view=new DataView(buffer);
 await dispatch({t:'init',control:controlBuffer,buffers:[buffer]});
 const epoch=new API.WriterEpoch(),journal=new API.SurfaceVersionJournal(new SharedArrayBuffer(8*65536));
 await dispatch({t:'legacy-producer-observation',action:'arm',options:{ownerGeneration:'clear-integration-fixture',maxRecords:8,writerEpochBuffer:epoch.buffer,surfaceVersionBuffer:journal.buffer}});
 const observation=c.entry(1).producerObservation;assert(observation.active);
 const renderer=new Win98Renderer(createCanvas(2,2));renderer.scheduleRepaint=()=>{};renderer.createWindow(0x77,0x90000000,0,0,2,2,'',0);
 const join=new API.SurfacePublicationJoin({epoch,journal,memory,ownerScope:observation.owner.scope,workerSlot:3,endpointId:1,owner:observation.owner,observationGeneration:observation.generation,renderer});
 const {host,gdi}=createHostImports({getMemory:()=>memory.buffer,exports:{},renderer,d3dimPublicationJoin:join});
 const dv=new DataView(memory.buffer),bytes=new Uint8Array(memory.buffer),front=BASE.DX_OBJECTS+32*7,back=front+32,dibA=BASE.DIB_BACKING_BASE,dibB=dibA+64,descriptor=dibB+64,sid=0x200007;
 for(const [entry,dib,red]of [[front,dibA,17],[back,dibB,34]]){dv.setUint32(entry,2,true);for(const [o,v]of [[12,2],[14,2],[16,32],[18,8]])dv.setUint16(entry+o,v,true);dv.setUint32(entry+20,dib,true);for(let i=0;i<16;i+=4)bytes.set([0,0,red,255],dib+i);}
 let seq=0,serial=0;
 async function produce(){serial++;for(const [o,v]of [[0,32],[4,front],[8,back],[12,descriptor],[16,serial],[20,0x44585031],[28,1]])view.setUint32(o,v,true);await dispatch({t:'batch',index:0,bytes:32,commands:1,seq:++seq,imageBase:0x400000});host.gdi_surface_create(sid,2,2,32,dv.getUint32(front+20,true),8,1,0,0);host.gdi_surface_attach(sid,0x77);host.gdi_surface_upload(sid,0,0,2,2,{slot:7,workerSlot:3,descriptor,serial});return journal.records().at(-1);}
 const first=await produce();assert(first&&!first.versionRejected,JSON.stringify(first));
 const before=epoch.snapshot();let calls=0,release;
 c.entry(1).adapter={execute:operation=>{calls++;assert.equal(epoch.snapshot(),null,'clear executes inside writer exclusion');assert.equal(operation.opcode,variant==='unsupported'?0x20003:0x20004);if(variant==='throw')throw Error('controlled adapter failure');return new Promise(resolve=>{release=()=>{const dib=dv.getUint32(front+20,true);bytes[dib+2]=99;resolve({value:7});};});},destroy(){},fence(){}};
 const clear=dispatch({t:'legacy-call',opcode:variant==='unsupported'?0x20003:0x20004,wa:descriptor,seq:++seq});
 if(variant==='throw'){await assert.rejects(clear,/controlled adapter failure/);assert.equal(epoch.snapshot(),null);return {variant,adapterFailurePoisons:true,calls};}
 assert.equal(epoch.snapshot(),null,'async clear excludes canonical readers throughout');assert.equal(Atomics.load(control,1),1,'ACK waits for adapter');
 renderer.repaint();assert.equal(join.rows.length,0,'no canonical qualification during clear');release();await clear;
 assert.equal(calls,1);assert.equal(Atomics.load(control,11),7,'exact adapter result preserved');assert.equal(Atomics.load(control,1),seq,'exact completion sequence');
 assert.equal(epoch.unchanged(before),false,'old source version invalidated before clear');
 if(!patched||variant==='unsupported'){assert.equal(observation.active,false);assert.equal(observation.reason,'unsupported-synchronous-legacy-call');assert.equal(epoch.snapshot(),null);return {variant,originalRetirement:true,calls};}
 assert(observation.active);assert(epoch.snapshot());assert.equal(observation.records.length,1,'clear fabricates no completion');
 renderer.repaint();assert.equal(join.rows.length,0,'clear cannot restore the prior source version');assert(join.ledger.some(x=>x.disposition==='source-version-overwritten'||x.disposition==='uncovered-publication-writer'));
 const second=await produce();assert(second&&!second.versionRejected,JSON.stringify(second));renderer.repaint();assert.equal(join.rows.length,1,JSON.stringify({records:journal.records(),rows:join.rows,ledger:join.ledger,request:gdi.surfacePresentations.get(sid).owedPresentRequest}));
 assert.equal(join.rows[0].sourceVersion,second.sourceVersion);assert.equal(join.rows[0].request.serial,2);assert.equal(join.rows[0].consumedSurfaceVersion,second.sourceVersion);assert(join.rows[0].canonicalRead&&join.rows[0].transfers.length&&join.rows[0].pagePublication);assert.equal(join.rows[0].qualified,true);
 renderer.repaint();assert.equal(join.rows.length,1,'cached republish adds no source');join.retire('fixture-finished');
 assert.equal(journal.records().length,join.rows.length+join.ledger.length);
 return {variant,passed:true,raw:journal.records().length,qualified:join.rows.length,discarded:join.ledger.length,calls,asyncWriterExclusion:true,oldVersionRefused:true,rows:join.rows,ledger:join.ledger};
}
(async()=>{const baseline=await fixture(false),corrected=await fixture(true),unsupported=await fixture(true,'unsupported'),failure=await fixture(true,'throw');const result={passed:true,baseline,corrected,unsupported,failure,workerSourceSha256:sha(source),correctedSourceSha256:sha(source),moduleSha256:sha(binary),scope:'New synchronous-clear integration fixture: accepted production dispatcher, real WAT swap/page watches, real canonical decode/composition and shared writer/journal; controlled async adapter, no original or GPU throughput claim'};if(process.env.CLEAR_OBSERVATION_RESULT)fs.writeFileSync(process.env.CLEAR_OBSERVATION_RESULT,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,baselineRetires:baseline.originalRetirement,correctedRaw:corrected.raw,correctedQualified:corrected.qualified,correctedDiscarded:corrected.discarded,unsupportedRetires:unsupported.originalRetirement,adapterFailurePoisons:failure.adapterFailurePoisons}));})().catch(e=>{console.error(e);process.exitCode=1;});
