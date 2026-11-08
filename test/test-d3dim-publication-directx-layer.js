#!/usr/bin/env node
'use strict';
// Actual production dispatcher, WAT swap/page watches and canonical compositor.
// The real native layer decode must carry its own immutable source proof. No original game or GPU throughput is measured.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');
const root = require('node:path').resolve(__dirname, '..');
const productionAPI = require('../lib/render-worker');
const {BASE} = require('../lib/region-map.generated');
const {Win98Renderer} = require('../lib/renderer');
const {createCanvas} = require('../lib/raster-canvas');
const {createHostImports} = require('../lib/host-imports');
const source = fs.readFileSync(root+'/lib/d3d-render-worker.js','utf8');
const binary = fs.readFileSync(root+'/build/wine-assembly.wasm');
const moduleBytes = new WebAssembly.Module(binary);
const apiSource = fs.readFileSync(root+'/lib/render-worker.js','utf8');
const fixed = '(layer && !coveredLayer)';
assert.equal(apiSource.split(fixed).length, 2);
const baselineModule = new Module(root+'/lib/render-worker.js', module);
baselineModule.paths = module.paths;
baselineModule._compile(apiSource.replace(fixed, 'layer'), root+'/lib/render-worker.js');
const baselineAPI = baselineModule.exports;
async function fixture(corrected,variant='actual-layer'){
 const API=corrected?productionAPI:baselineAPI;
 const memory=new WebAssembly.Memory({initial:8192,maximum:32768,shared:true}),imports={host:{memory}};
 for(const i of WebAssembly.Module.imports(moduleBytes))if(i.kind==='function')imports[i.module][i.name]=()=>0;
 const native=new WebAssembly.Instance(moduleBytes,imports);native.exports.heap_init(0x3000000);
 const sent=[],c={performance,console,WebAssembly,ArrayBuffer,SharedArrayBuffer,Uint8Array,DataView,Map,Set,Atomics,Promise,require:name=>name==='worker_threads'?{parentPort:{on(){},postMessage:m=>sent.push(structuredClone(m))}}:name==='./render-worker'?API:require(root+'/lib/'+name.replace('./',''))};
 vm.createContext(c);vm.runInContext(source+`\nglobalThis.install=(n,m)=>{instance=n;memory=m;sharedMode=true;initializedImage=0x400000;stateGuest=1;verticesGuest=2;descriptorGuest=3;};globalThis.dispatch=sharedMessage;globalThis.entry=id=>endpoints.get(id);`,c);c.install(native,memory);
 const dispatch=m=>c.dispatch({t:'render-message',endpointId:1,message:m});
 await c.dispatch({t:'render-open',endpointId:1,options:{api:'legacy',backend:'software'}});
 const buffer=new SharedArrayBuffer(32),controlBuffer=new SharedArrayBuffer(64),control=new Int32Array(controlBuffer),view=new DataView(buffer);
 await dispatch({t:'init',control:controlBuffer,buffers:[buffer]});
 const epoch=new API.WriterEpoch(),journal=new API.SurfaceVersionJournal(new SharedArrayBuffer(8*65536));
 await dispatch({t:'legacy-producer-observation',action:'arm',options:{ownerGeneration:'clear-integration-fixture',maxRecords:8,writerEpochBuffer:epoch.buffer,surfaceVersionBuffer:journal.buffer}});
 const observation=c.entry(1).producerObservation;assert(observation.active);
 const renderer=new Win98Renderer(createCanvas(2,2));renderer.scheduleRepaint=()=>{};renderer.createWindow(0x77,0x90000000,0,0,2,2,'',0,native,memory);
 const join=new API.SurfacePublicationJoin({epoch,journal,memory,ownerScope:observation.owner.scope,workerSlot:3,endpointId:1,owner:observation.owner,observationGeneration:observation.generation,renderer});
 const {host,gdi}=createHostImports({getMemory:()=>memory.buffer,exports:{get_main_hwnd:()=>0x77,get_dx_exclusive_hwnd:()=>0x77},renderer,d3dimPublicationJoin:join});
 const dv=new DataView(memory.buffer),bytes=new Uint8Array(memory.buffer),front=BASE.DX_OBJECTS+32*7,back=front+32,dibA=BASE.DIB_BACKING_BASE,dibB=dibA+64,descriptor=dibB+64,sid=0x200007;
 for(const [entry,dib,red]of [[front,dibA,17],[back,dibB,34]]){dv.setUint32(entry,2,true);for(const [o,v]of [[12,2],[14,2],[16,16],[18,4]])dv.setUint16(entry+o,v,true);dv.setUint32(entry+20,dib,true);dv.setUint32(entry+28,1,true);for(let i=0;i<8;i+=2)dv.setUint16(dib+i,red===34?0xf800:0x001f,true);}
 let seq=0,serial=0;
 async function produce(){serial++;for(const [o,v]of [[0,32],[4,front],[8,back],[12,descriptor],[16,serial],[20,0x44585031],[28,1]])view.setUint32(o,v,true);await dispatch({t:'batch',index:0,bytes:32,commands:1,seq:++seq,imageBase:0x400000});host.gdi_surface_create(sid,2,2,16,dv.getUint32(front+20,true),4,1,0,0);host.gdi_surface_attach(sid,0x77);host.gdi_surface_upload(sid,0,0,2,2,{slot:7,workerSlot:3,descriptor,serial});return journal.records().at(-1);}
 const first = await produce();
 assert(first && !first.versionRejected, 'real WAT source proof must seal');
 const dib = dv.getUint32(front+20,true);
 if(variant==='wrong-window-owner')renderer.windows[0x77].wasmMemory=null;
 if(variant==='wrong-owner')gdi.surfacePresentations.get(sid).owedPresentRequest.workerSlot++;
 if(variant==='stale-request')gdi.surfacePresentations.get(sid).owedPresentRequest.serial++;
 if(variant==='host-version')epoch.invalidateVersions();
 if(variant==='page-dirty')native.exports.guest_write32(0x50000000+dib-BASE.DIB_BACKING_BASE,0x00330000);
 if(variant==='poison')epoch.invalidate();
 const ticket=variant==='overlap'?epoch.begin():null;
 assert.equal(gdi.presentBestDxOffscreen(true),1,'actual native layer decoder runs');
 const layer=renderer.windows[0x77]._dxFrameLayer;
 assert(layer && layer.canvas !== renderer.windows[0x77]._backCanvas);
 if(ticket)epoch.end(ticket);
 if(variant==='wrong-layer') {const canvas=createCanvas(2,2);canvas._waD3dimVersion=layer.canvas._waD3dimVersion;renderer.windows[0x77]._dxFrameLayer={...layer,canvas};}
 if(variant==='menu'){renderer._openMenuGeometry=()=>({x:0,y:0,w:1,h:1});renderer._menuPaintDropdown=()=>{};}
 if(variant==='caret')renderer.observePresentationPublication=()=>{renderer._caretBlinkActiveStates=new Set([1]);};
 if(variant==='overlay')renderer.observePresentationPublication=()=>{renderer._animatedRect={x:0,y:0,w:1,h:1};};
 if(variant==='cache-blocked'){renderer._resizeOutline={x:0,y:0,w:1,h:1};renderer.repaint();renderer._resizeOutline=null;}
 if(variant==='covered-gdi') {
   delete layer.canvas._waD3dimVersion;
   gdi.flushSurfacePresentation(sid);
 }
 if(variant==='dirty-after-decode')native.exports.guest_write32(0x50000000+dib-BASE.DIB_BACKING_BASE,0x00330000);
 if(variant==='host-after-decode')epoch.invalidateVersions();
 renderer.repaint();
 const expected=corrected && variant==='actual-layer'?1:0;
 assert.equal(join.rows.length,expected,variant);
 if(expected){
   const row=join.rows[0];
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
 const corrected = await fixture(true);
 const negative = [];
 for (const variant of ['wrong-window-owner','wrong-layer','wrong-owner','stale-request','covered-gdi','page-dirty','dirty-after-decode','host-version','host-after-decode','overlap','poison','menu','caret','overlay','cache-blocked']) negative.push(await fixture(true,variant));
 const result = {passed:true,baseline,corrected,negative,
   moduleSha256:crypto.createHash('sha256').update(binary).digest('hex')};
 if(process.env.DIRECTX_LAYER_RESULT) fs.writeFileSync(process.env.DIRECTX_LAYER_RESULT,JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:true,baselineQualified:baseline.qualified,
   correctedQualified:corrected.qualified,negative:negative.map(x=>({variant:x.variant,qualified:x.qualified,discarded:x.discarded}))}));
})().catch(e=>{console.error(e);process.exitCode=1;});
