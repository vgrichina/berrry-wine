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
const menuBaselineModule = new Module(root+'/lib/render-worker.js', module);
menuBaselineModule.paths = module.paths;
menuBaselineModule._compile(apiSource.replace("name === 'menu_bar_count'", "name === 'menu_bar_count_disabled_fixture'"), root+'/lib/render-worker.js');
const fullBaselineModule = new Module(root+'/lib/render-worker.js', module);
fullBaselineModule.paths = module.paths;
// Restore the preceding source-lifetime rule, without changing rendering or
// the export facade, for an in-process baseline/fixed comparison.
assert(apiSource.includes('this.compositionReads?.get(version)'));
fullBaselineModule._compile(apiSource.replace('this.compositionReads?.get(version)', 'null'),root+'/lib/render-worker.js');
async function fixture(corrected,variant='actual-layer',observed=false){
 const API=observed==='full-baseline'?fullBaselineModule.exports:observed==='menu-baseline'?menuBaselineModule.exports:corrected?productionAPI:baselineAPI;
 const memory=new WebAssembly.Memory({initial:8192,maximum:32768,shared:true}),imports={host:{memory}};
 let windowHost, callbackEpoch, callbackRenderer, callbackNative, compositorTicket;
 let injected=false, entryTicket;
 const hostCallbacks=[];
 for(const i of WebAssembly.Module.imports(moduleBytes))if(i.kind==='function')imports[i.module][i.name]=(...args)=>{
   if(i.name!=='get_window_rect' || !windowHost)return 0;
   return API.observeHostWrite(callbackEpoch,function(){
     assert(Atomics.load(callbackEpoch.words,0)>0,'host scratch writer remains excluded');
     const result=windowHost.get_window_rect(...args);
     hostCallbacks.push({name:i.name,args,rect:Array.from(new Int32Array(memory.buffer,args[1],4))});
     if(variant==='entry-overlap-released' && entryTicket){callbackEpoch.end(entryTicket);entryTicket=null;}
     if(!injected && variant.startsWith('compositor-')) {
       injected=true;
       const win=callbackRenderer.windows[0x77],layer=win._dxFrameLayer;
       if(variant==='compositor-poison')callbackEpoch.invalidate();
       if(variant==='compositor-overlap')compositorTicket=callbackEpoch.begin();
       if(variant==='compositor-owner')win.wasmMemory=null;
       if(variant==='compositor-page')callbackNative.exports.guest_write32(0x50000000,0x001f001f);
       if(variant==='compositor-token')delete layer.canvas._waD3dimVersion;
       if(variant==='compositor-size')layer.canvas.width=3;
     }
     return result;
   },undefined,[]);
 };
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
 // Include the actual production export facade: direct export stubs hid the
 // presenter's own getter transitions and host-version invalidations.
 const decoderExports={...native.exports,get_main_hwnd:()=>0x77,
   get_dx_present_hwnd:()=>0x77,get_dx_exclusive_hwnd:()=>0x77,
   get_d3d9_windowed_hwnd:()=>variant==='windowed-device'?0x77:0,
   gamma_ramp_wa:variant==='gamma'?()=>BASE.DIB_BACKING_BASE+4096:native.exports.gamma_ramp_wa,
   gamma_ramp_gen:native.exports.gamma_ramp_gen};
 const exportCalls=[];
 const facade=API.observeInstance({exports:decoderExports},()=>epoch);
 if(typeof observed==='string' && observed.startsWith('full')) {
   const exports={};
   for(const [name,value] of Object.entries(facade.exports)) exports[name]=typeof value==='function'?function(...args){
     const before=Atomics.load(epoch.words,3),result=value(...args);
     exportCalls.push({name,before,after:Atomics.load(epoch.words,3)});
     return result;
   }:value;
   Object.assign(facade.exports,exports);
   renderer.wasm=facade;renderer.windows[0x77].wasm=facade;
   assert.equal(renderer.windows[0x77].wasm.exports,facade.exports);
 }
 if(typeof observed==='string' && observed.startsWith('menu-')) {
   // Isolate the FIRST failing compositor branch. Other scene exports keep
   // their prior fixture behavior; this does not certify the entire facade.
   const exports={...decoderExports,menu_bar_count(...args){
     const before=Atomics.load(epoch.words,3),result=facade.exports.menu_bar_count(...args);
     exportCalls.push({name:'menu_bar_count',before,after:Atomics.load(epoch.words,3)});
     return result;
   }};
   renderer.wasm={exports};renderer.windows[0x77].wasm=renderer.wasm;
 }
 const {host,gdi}=createHostImports({getMemory:()=>memory.buffer,
   exports:observed?facade.exports:decoderExports,
   renderer,d3dimPublicationJoin:join});
 windowHost=host;callbackEpoch=epoch;callbackRenderer=renderer;callbackNative=native;
 const dv=new DataView(memory.buffer),bytes=new Uint8Array(memory.buffer),front=BASE.DX_OBJECTS+32*7,back=front+32,dibA=BASE.DIB_BACKING_BASE,dibB=dibA+64,descriptor=dibB+64,sid=0x200007;
 for(const [entry,dib,red]of [[front,dibA,17],[back,dibB,34]]){dv.setUint32(entry,2,true);for(const [o,v]of [[12,2],[14,2],[16,16],[18,4]])dv.setUint16(entry+o,v,true);dv.setUint32(entry+20,dib,true);dv.setUint32(entry+28,1,true);for(let i=0;i<8;i+=2)dv.setUint16(dib+i,red===34?0xf800:0x001f,true);}
 let seq=0,serial=0;
 async function produce(){serial++;for(const [o,v]of [[0,32],[4,front],[8,back],[12,descriptor],[16,serial],[20,0x44585031],[28,1]])view.setUint32(o,v,true);await dispatch({t:'batch',index:0,bytes:32,commands:1,seq:++seq,imageBase:0x400000});host.gdi_surface_create(sid,2,2,16,dv.getUint32(front+20,true),4,1,0,0);host.gdi_surface_attach(sid,0x77);host.gdi_surface_upload(sid,0,0,2,2,{slot:7,workerSlot:3,descriptor,serial});return journal.records().at(-1);}
 if(variant==='wrong-format')dv.setUint32(BASE.DX_SURF_FMT+7*4,2,true);
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
 if(variant==='owner-after-decode')renderer.windows[0x77].wasmMemory=null;
 if(variant==='resized-after-decode')layer.canvas.width=3;
 if(variant==='dirty-after-decode')native.exports.guest_write32(0x50000000+dib-BASE.DIB_BACKING_BASE,0x00330000);
 if(variant==='host-after-decode')epoch.invalidateVersions();
 if(variant==='forged-cache-token')layer.canvas._waD3dimVersion={...layer.canvas._waD3dimVersion};
 if(variant==='missing-cache-token')delete layer.canvas._waD3dimVersion;
 if(variant==='entry-overlap-released')entryTicket=epoch.begin();
 renderer.repaint();
 if(compositorTicket)epoch.end(compositorTicket);
 if(variant.startsWith('compositor-'))assert(injected,'negative ran inside actual WAT host callback');
 const expected=corrected && observed!=='full-baseline' && observed!=='menu-baseline' && variant==='actual-layer'?1:0;
 if(typeof observed==='string' && observed.startsWith('full') && process.env.FULL_FACADE_DIAGNOSTIC) console.log(JSON.stringify({variant,exportCalls,hostCallbacks,hostVersion:Atomics.load(epoch.words,3),qualified:join.rows.length,ledger:join.ledger}));
 assert.equal(join.rows.length,expected,variant);
 if(expected){
   const row=join.rows[0];
   if(observed==='full') {
     assert(row.canonicalRead.compositionAdmission,'source admitted before compositor exports');
     assert.equal(row.canonicalRead.compositionAdmission.hostVersion,first.hostVersion);
     assert(Atomics.load(epoch.words,3)>first.hostVersion,'scratch writes still invalidate host versions');
     assert.equal(hostCallbacks.length,2,'real X/Y host callbacks write rectangle scratch');
     assert(hostCallbacks.every(c=>c.rect.join(',')==='0,0,2,2'));
   }
   assert.equal(row.sourceVersion,first.sourceVersion);
   assert.equal(row.consumedSurfaceVersion,first.sourceVersion);
   assert.equal(row.canvasCacheSerial,layer.canvas._waD3dimVersion.cacheSerial);
   const pixel=renderer.canvas.getContext('2d').getImageData(0,0,1,1).data;
   assert.deepEqual(Array.from(pixel),[255,0,0,255],'display contains the actual DX canonical RGB565 source');
   renderer.repaint();assert.equal(join.rows.length,1,'cached republish adds no source');
 }
 join.retire('fixture-finished');
 assert.equal(journal.records().length, join.rows.length+join.ledger.length);
 return {variant, corrected, observed, exportCalls, hostCallbacks, raw:journal.records().length,qualified:join.rows.length,
   discarded:join.ledger.length,rows:join.rows,ledger:join.ledger};
}
// Getter classification never removes its writer ticket. In particular, only
// the actual zero-ramp branch avoids the process host-mutation clock; nonzero
// address translation and arbitrary host exports retain invalidation.
function getterExclusion(){
 const epoch=new productionAPI.WriterEpoch();
 let result=0,fail=false;
 const ex=productionAPI.observeInstance({exports:{
   gamma_ramp_wa(){assert.equal(Atomics.load(epoch.words,0),1);assert.equal(epoch.snapshot(),null);if(fail)throw Error('getter-failure');return result;},
   dx_surface_window_clipped(){assert.equal(Atomics.load(epoch.words,0),1);return 0;},
   host_mutation(){assert.equal(Atomics.load(epoch.words,0),1);assert.equal(Atomics.load(epoch.words,3),2);}
 }},()=>epoch).exports;
 const stamp=epoch.snapshot();
 assert.equal(ex.gamma_ramp_wa(),0);assert.equal(Atomics.load(epoch.words,3),0);
 assert(!epoch.unchanged(stamp),'getter entry/exit still invalidates an older read stamp');
 ex.dx_surface_window_clipped();assert.equal(Atomics.load(epoch.words,3),0);
 result=123;assert.equal(ex.gamma_ramp_wa(),123);assert.equal(Atomics.load(epoch.words,3),1);
 ex.host_mutation();assert.equal(Atomics.load(epoch.words,3),2);
 fail=true;assert.throws(()=>ex.gamma_ramp_wa(),/getter-failure/);
 assert.equal(Atomics.load(epoch.words,0),0);assert.equal(Atomics.load(epoch.words,2),1);
 return {passed:true,writerExclusion:true,nonzeroInvalidation:true,arbitraryMutationInvalidation:true,errorPoison:true};
}
function menuBranchGuards(){
 const memory=new WebAssembly.Memory({initial:8192,maximum:32768,shared:true}),imports={host:{memory}};
 for(const i of WebAssembly.Module.imports(moduleBytes))if(i.kind==='function')imports[i.module][i.name]=()=>0;
 const native=new WebAssembly.Instance(moduleBytes,imports),epoch=new productionAPI.WriterEpoch();
 native.exports.test_wnd_table_set(0x77,0);
 const ex=productionAPI.observeInstance(native,()=>epoch).exports;
 const stamp=epoch.snapshot();
 assert.equal(ex.menu_bar_count(0x77),0);
 assert.equal(ex.menu_bar_count(0x78),0);
 assert.equal(Atomics.load(epoch.words,3),0,'valid no-menu and absent window do not translate a blob');
 assert(!epoch.unchanged(stamp),'the no-menu branch retains writer entry/exit');
 const dv=new DataView(memory.buffer),guest=native.exports.get_image_base()+4096;
 dv.setUint32(BASE.MENU_DATA_TABLE,guest,true);
 dv.setUint32(BASE.GUEST_BASE+4096,0,true);
 assert.equal(ex.get_menu_bar_blob_guest(0x77),guest);
 assert.equal(ex.menu_bar_count(0x77),0);
 assert.equal(Atomics.load(epoch.words,3),1,'an empty allocated blob still invalidates');
 dv.setUint32(BASE.GUEST_BASE+4096,3,true);
 assert.equal(ex.menu_bar_count(0x77),3);
 assert.equal(Atomics.load(epoch.words,3),2);
 const legacy=new productionAPI.WriterEpoch();
 productionAPI.observeInstance({exports:{menu_bar_count:()=>0}},()=>legacy).exports.menu_bar_count(0x77);
 assert.equal(Atomics.load(legacy.words,3),1,'an older module without branch proof stays conservative');
 for(const failAt of ['metadata','count']){
   const e=new productionAPI.WriterEpoch();
   const f=productionAPI.observeInstance({exports:{
     get_menu_bar_blob_guest(){assert.equal(Atomics.load(e.words,0),1);assert.equal(e.snapshot(),null);if(failAt==='metadata')throw Error('metadata');return 1;},
     menu_bar_count(){assert.equal(Atomics.load(e.words,0),1);assert.equal(Atomics.load(e.words,3),1);throw Error('count');}
   }},()=>e).exports;
   assert.throws(()=>f.menu_bar_count(0x77),new RegExp(failAt));
   assert.equal(Atomics.load(e.words,0),0);assert.equal(Atomics.load(e.words,2),1);
 }
 return {passed:true,nativeValidAndAbsentWindow:true,nonzeroEmptyAndPopulatedBlobInvalidation:true,legacyConservative:true,exclusionAndPoison:true};
}
(async()=>{
 if(process.env.FULL_FACADE_ONLY){console.log(JSON.stringify(await fixture(true,'actual-layer','full')));return;}
 if(process.env.MENU_EXPORTS_ONLY){console.log(JSON.stringify({baseline:await fixture(true,'actual-layer','menu-baseline'),corrected:await fixture(true,'actual-layer','menu-query')}));return;}
 if(process.env.OBSERVED_EXPORTS_ONLY){console.log(JSON.stringify(await fixture(true,'actual-layer',true)));return;}
 const getterGuards=getterExclusion();
 const menuGuards=menuBranchGuards();
 const baseline = await fixture(false);
 const corrected = await fixture(true);
 const negative = [];
 for (const variant of ['wrong-window-owner','wrong-layer','wrong-owner','stale-request','covered-gdi','page-dirty','dirty-after-decode','host-version','host-after-decode','overlap','poison','menu','caret','overlay','cache-blocked','owner-after-decode','resized-after-decode','windowed-device','gamma','wrong-format']) negative.push(await fixture(true,variant));
 const observed = await fixture(true,'actual-layer',true);
 const menuBaseline=await fixture(true,'actual-layer','menu-baseline');
 const menuCorrected=await fixture(true,'actual-layer','menu-query');
 const observedNegative=[];
 for(const variant of negative.map(x=>x.variant))observedNegative.push(await fixture(true,variant,true));
 const menuNegative=[];
 for(const variant of negative.map(x=>x.variant))menuNegative.push(await fixture(true,variant,'menu-query'));
 const fullBaseline=await fixture(true,'actual-layer','full-baseline');
 const fullCorrected=await fixture(true,'actual-layer','full');
 const fullNegative=[];
 for(const variant of [...negative.map(x=>x.variant),'compositor-poison','compositor-overlap','compositor-owner','compositor-page','compositor-token','compositor-size','forged-cache-token','missing-cache-token','entry-overlap-released'])fullNegative.push(await fixture(true,variant,'full'));
 const result = {passed:true,fullBaseline,fullCorrected,fullNegative,baseline,corrected,negative,observed,observedNegative,getterGuards,
   menuBaseline,menuCorrected,menuNegative,menuGuards,
   moduleSha256:crypto.createHash('sha256').update(binary).digest('hex')};
 if(process.env.DIRECTX_LAYER_RESULT) fs.writeFileSync(process.env.DIRECTX_LAYER_RESULT,JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:true,fullBaselineQualified:fullBaseline.qualified,fullCorrectedQualified:fullCorrected.qualified,fullNegative:fullNegative.map(x=>({variant:x.variant,qualified:x.qualified})),baselineQualified:baseline.qualified,
   correctedQualified:corrected.qualified,observedQualified:observed.qualified,observedNegative:observedNegative.length,getterGuards,menuGuards,menuBaselineQualified:menuBaseline.qualified,menuCorrectedQualified:menuCorrected.qualified,menuNegative:menuNegative.length,negative:negative.map(x=>({variant:x.variant,qualified:x.qualified,discarded:x.discarded}))}));
})().catch(e=>{console.error(e);process.exitCode=1;});
