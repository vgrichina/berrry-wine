#!/usr/bin/env node
'use strict';
// Actual production dispatcher, WAT swap/page watches and canonical compositor.
// A completed writer before the swap must not destroy the new source lifetime.
// The actual native layer carries its own proof; no original/FPS claim.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = require('node:path').resolve(__dirname, '..');
const productionAPI = require('../lib/render-worker');
const {BASE} = require('../lib/region-map.generated');
const {Win98Renderer} = require('../lib/renderer');
const {createCanvas} = require('../lib/raster-canvas');
const {createHostImports} = require('../lib/host-imports');
const source = fs.readFileSync(root+'/lib/d3d-render-worker.js','utf8');
const binary = fs.readFileSync(root+'/build/wine-assembly.wasm');
const moduleBytes = new WebAssembly.Module(binary);
// Reconstruct the original stamp lifetime: before the awaited fence, rather
// than immediately before the synchronous WAT swap.
const fence = `      if (endpoints.size === 1 && adapter?.fenceFlip) await adapter.fenceFlip();
      else adapter?.fence();
`;
const start = source.indexOf('      if (producerObservation?.active && producerObservation.journal) {\n        // The new source lifetime');
const end = source.indexOf('      ex.d3dim_worker_flip(', start);
assert(start > 0 && end > start);
const stampBlock = source.slice(start, end);
const baselineSource = source.slice(0,start).replace(fence, stampBlock+fence)+source.slice(end);
assert.notEqual(baselineSource,source);
async function fixture(corrected,variant='fence-unrelated'){
 const API=productionAPI;
 const memory=new WebAssembly.Memory({initial:8192,maximum:32768,shared:true}),imports={host:{memory}};
 for(const i of WebAssembly.Module.imports(moduleBytes))if(i.kind==='function')imports[i.module][i.name]=()=>0;
 const native=new WebAssembly.Instance(moduleBytes,imports);native.exports.heap_init(0x3000000);
 const sent=[],c={performance,console,WebAssembly,ArrayBuffer,SharedArrayBuffer,Uint8Array,DataView,Map,Set,Atomics,Promise,require:name=>name==='worker_threads'?{parentPort:{on(){},postMessage:m=>sent.push(structuredClone(m))}}:name==='./render-worker'?API:require(root+'/lib/'+name.replace('./',''))};
 vm.createContext(c);vm.runInContext((corrected?source:baselineSource)+`\nglobalThis.install=(n,m)=>{instance=n;memory=m;sharedMode=true;initializedImage=0x400000;stateGuest=1;verticesGuest=2;descriptorGuest=3;};globalThis.dispatch=sharedMessage;globalThis.entry=id=>endpoints.get(id);`,c);let swapOverlap, swapped=false, sealChanged=false;
 const watchedNative={exports:{...native.exports,
   d3dim_worker_flip(...args){
     const result=native.exports.d3dim_worker_flip(...args);swapped=true;
     if(variant==='swap-epoch-change'){const ticket=epoch.begin();epoch.end(ticket);}
     if(variant==='swap-overlap')swapOverlap=epoch.begin();
     if(variant==='swap-poison')epoch.invalidate();
     if(variant==='missing-stamp' && overlap){epoch.end(overlap);overlap=null;}
     return result;
   },
   page_watch_acquire(...args){
     const result=native.exports.page_watch_acquire(...args);
     if(swapped && !sealChanged){
       sealChanged=true;
       if(variant==='seal-epoch-change'){const ticket=epoch.begin();epoch.end(ticket);}
       if(variant==='seal-host-version')epoch.invalidateVersions();
     }
     return result;
   }}};
 c.install(watchedNative,memory);
 const dispatch=m=>c.dispatch({t:'render-message',endpointId:1,message:m});
 await c.dispatch({t:'render-open',endpointId:1,options:{api:'legacy',backend:'software'}});
 const buffer=new SharedArrayBuffer(32),controlBuffer=new SharedArrayBuffer(64),control=new Int32Array(controlBuffer),view=new DataView(buffer);
 await dispatch({t:'init',control:controlBuffer,buffers:[buffer]});
 const epoch=new API.WriterEpoch(),journal=new API.SurfaceVersionJournal(new SharedArrayBuffer(8*65536));
 await dispatch({t:'legacy-producer-observation',action:'arm',options:{ownerGeneration:'clear-integration-fixture',maxRecords:8,writerEpochBuffer:epoch.buffer,surfaceVersionBuffer:journal.buffer}});
 const observation=c.entry(1).producerObservation;assert(observation.active);
 const renderer=new Win98Renderer(createCanvas(2,2));renderer.scheduleRepaint=()=>{};renderer.createWindow(0x77,0x90000000,0,0,2,2,'',0,native,memory);
 const join=new API.SurfacePublicationJoin({epoch,journal,memory,ownerScope:observation.owner.scope,workerSlot:3,endpointId:1,owner:observation.owner,observationGeneration:observation.generation,renderer});
 const {host,gdi}=createHostImports({getMemory:()=>memory.buffer,exports:{get_main_hwnd:()=>0x77,get_dx_exclusive_hwnd:()=>0x77,get_d3d9_windowed_hwnd:()=>variant==='windowed-device'?0x77:0,gamma_ramp_wa:()=>variant==='gamma'?BASE.DIB_BACKING_BASE+4096:0,gamma_ramp_gen:()=>0},renderer,d3dimPublicationJoin:join});
 const dv=new DataView(memory.buffer),bytes=new Uint8Array(memory.buffer),front=BASE.DX_OBJECTS+32*7,back=front+32,dibA=BASE.DIB_BACKING_BASE,dibB=dibA+64,descriptor=dibB+64,sid=0x200007;
 for(const [entry,dib,red]of [[front,dibA,17],[back,dibB,34]]){dv.setUint32(entry,2,true);for(const [o,v]of [[12,2],[14,2],[16,16],[18,4]])dv.setUint16(entry+o,v,true);dv.setUint32(entry+20,dib,true);dv.setUint32(entry+28,1,true);for(let i=0;i<8;i+=2)dv.setUint16(dib+i,red===34?0xf800:0x001f,true);}
 let seq=0,serial=0;
 async function produce(){serial++;for(const [o,v]of [[0,32],[4,front],[8,back],[12,descriptor],[16,serial],[20,0x44585031],[28,1]])view.setUint32(o,v,true);await dispatch({t:'batch',index:0,bytes:32,commands:1,seq:++seq,imageBase:0x400000});host.gdi_surface_create(sid,2,2,16,dv.getUint32(front+20,true),4,1,0,0);host.gdi_surface_attach(sid,0x77);host.gdi_surface_upload(sid,0,0,2,2,{slot:7,workerSlot:3,descriptor,serial});return journal.records().at(-1);}
 let overlap;
 c.entry(1).adapter={fenceFlip:async()=>{
   // The production dispatcher retains its own ticket across the actual
   // asynchronous barrier; a second writer completes before that barrier.
   const ticket=entryOverlap || epoch.begin();
   native.exports.guest_write32(0x50002000,0x12345678);
   if(variant==='fence-host-write')epoch.invalidateVersions();
   if(variant==='poison')epoch.invalidate();
   await Promise.resolve();
   if(['overlap','missing-stamp'].includes(variant))overlap=ticket;
   else epoch.end(ticket);
 },destroy(){}};
 const entryOverlap=variant==='fence-entry-overlap'?epoch.begin():null;
 const first = await produce();
 const dib = dv.getUint32(front+20,true);
 if(overlap)epoch.end(overlap);
 if(swapOverlap)epoch.end(swapOverlap);
 if(variant==='stale-request')gdi.surfacePresentations.get(sid).owedPresentRequest.serial++;
 if(variant==='wrong-owner')gdi.surfacePresentations.get(sid).owedPresentRequest.workerSlot++;
 if(variant==='host-version')epoch.invalidateVersions();
 if(variant==='page-dirty')native.exports.guest_write32(0x50000000+dib-BASE.DIB_BACKING_BASE,0x00330000);
 if(variant==='retired')join.retire('fixture-owner-retired');
 assert.equal(gdi.presentBestDxOffscreen(true),1,'actual native layer decoder runs');
 const layer=renderer.windows[0x77]._dxFrameLayer;
 assert(layer && layer.canvas !== renderer.windows[0x77]._backCanvas);
 if(variant==='host-after-decode')epoch.invalidateVersions();
 if(variant==='dirty-after-decode')native.exports.guest_write32(0x50000000+dib-BASE.DIB_BACKING_BASE,0x00330000);
 renderer.repaint();
 if(corrected && ['overlap','swap-overlap','swap-poison','missing-stamp','swap-epoch-change','seal-epoch-change','seal-host-version','poison'].includes(variant)){
   const expectedCause={overlap:'not-sole','swap-overlap':'not-sole','swap-poison':'poisoned','missing-stamp':'missing-stamp','swap-epoch-change':'epoch-changed','seal-epoch-change':'epoch-changed','seal-host-version':'host-version-changed',poison:'poisoned'}[variant];
   assert.equal(first.versionRejected,'source-writer-'+expectedCause);
   assert(first.sourceWriter.rejection.causes.includes(expectedCause));
   assert.equal(first.sourceWriter.rejection.stage,variant.startsWith('seal-')?'sealExit':'sealEntry');
 }
 const expected=corrected && ['fence-unrelated','fence-host-write','fence-entry-overlap'].includes(variant)?1:0;
 assert.equal(join.rows.length,expected,variant);
 if(expected){
   const row=join.rows[0];
   assert.equal(first.hostVersion,first.sourceWriter.beforeSwap.hostVersion);
   assert.equal(first.sourceWriter.sealEntry.active,1);
   assert.equal(first.sourceWriter.sealExit.active,1);
   assert.equal(first.sourceWriter.sealExit.epoch,first.sourceWriter.beforeSwap.epoch);
   assert.equal(row.sourceVersion,first.sourceVersion);
   assert.equal(row.consumedSurfaceVersion,first.sourceVersion);
   assert.equal(row.canvasCacheSerial,layer.canvas._waD3dimVersion.cacheSerial);
   const pixel=renderer.canvas.getContext('2d').getImageData(0,0,1,1).data;
   assert.deepEqual(Array.from(pixel),[255,0,0,255],'display contains the actual DX canonical RGB565 source');
   renderer.repaint();assert.equal(join.rows.length,1,'cached republish adds no source');
 }
 join.retire('fixture-finished');
 assert.equal(journal.records().length, join.rows.length+join.ledger.length);
 return {variant, corrected, raw:journal.records().length,qualified:join.rows.length,
   discarded:join.ledger.length,rows:join.rows,ledger:join.ledger};
}
(async()=>{
 const baseline = await fixture(false);
 assert.equal(baseline.ledger[0].record.versionRejected,'source-writer-epoch-changed');
 assert.deepEqual(baseline.ledger[0].record.sourceWriter.rejection.causes,['epoch-changed']);
 assert.equal(baseline.ledger[0].record.sourceWriter.sealEntry.active,1);
 if(process.env.SOURCE_LIFETIME_BASELINE)fs.writeFileSync(process.env.SOURCE_LIFETIME_BASELINE,JSON.stringify(baseline,null,2));
 const corrected = await fixture(true);
 const baselineMissing=await fixture(false,'fence-entry-overlap');
 assert.equal(baselineMissing.ledger[0].record.versionRejected,'source-writer-missing-stamp');
 const positive = [];
 for(const variant of ['fence-host-write','fence-entry-overlap'])positive.push(await fixture(true,variant));
 const negative = [];
 for (const variant of ['stale-request','wrong-owner','host-version','page-dirty','host-after-decode','dirty-after-decode','overlap','poison','retired','swap-overlap','swap-poison','missing-stamp','swap-epoch-change','seal-epoch-change','seal-host-version']) negative.push(await fixture(true,variant));
 const result = {passed:true,baseline,baselineMissing,corrected,positive,negative,
   moduleSha256:crypto.createHash('sha256').update(binary).digest('hex')};
 if(process.env.SOURCE_LIFETIME_RESULT) fs.writeFileSync(process.env.SOURCE_LIFETIME_RESULT,JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:true,baselineQualified:baseline.qualified,
   correctedQualified:corrected.qualified,positive:positive.map(x=>({variant:x.variant,qualified:x.qualified})),negative:negative.map(x=>({variant:x.variant,qualified:x.qualified,discarded:x.discarded}))}));
})().catch(e=>{console.error(e);process.exitCode=1;});
