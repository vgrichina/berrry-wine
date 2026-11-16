'use strict';
// Bounded source-excerpt controls. Real shell blocks/renderer methods; modeled
// DOM, downloads and canvases. No guest, WebAssembly compilation or browser.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),shell=fs.readFileSync(root+'/lib/browser-shell.js','utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const slice=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert(i>=0&&j>i);return s.slice(i,j);};
const manifest=slice(shell,'      let dynamicExeBytes = null;','      // From here until the DLL graph');
const mounts=slice(shell,'          const verifiedObjectUrls = [];','          log.textContent += `Data files mounted:');
let cases=0,mutations=0;
async function checkManifest(source,stage){
 const original=[],app={localFileManifest:'manifest.json',localManifestIntegrity:{},files:original,_localFilesResolved:true},ctx={abort:new AbortController(),cancelled:false};
 const files=[{bytes:Uint8Array.of(7),loadMode:'required'}],exe=Uint8Array.of(9),byUrl=new Map();let initialized=0,validated=0;
 const cancel=where=>{if(stage===where)ctx.cancelled=true;};
 const fetch=async (_url,opts)=>{assert.equal(opts.signal,ctx.abort.signal);cancel('fetch');return {ok:true,json:async()=>{cancel('json');return {schemaVersion:1,files:[]};}};};
 const W={fetchAssetBytes(){throw Error('unneeded fetch');}},window={crypto:{subtle:{}},appFiles:{validateLocalManifestAsync:async()=>{validated++;cancel('validate');if(stage==='invalid')throw Error('invalid identity');return {files,exeBytes:exe,byUrl};}}};
 const doc={getElementById:()=>({})},wine={init:async()=>{initialized++;}},checkpoint=c=>{if(c.cancelled)throw Object.assign(Error('cancelled'),{name:'AbortError'});};
 const fn=new AsyncFunction('app','ctx','document','URL','location','fetch','window','WineAssembly','wine','canvas','sel','throwIfCancelled',source+'return dynamicExeBytes;');
 let error,result;try{result=await fn(app,ctx,doc,URL,{href:'http://local/'},fetch,window,W,wine,{},'fixture',checkpoint);}catch(e){error=e;}
 if(['fetch','json','validate','invalid'].includes(stage)){assert(error);assert.equal(initialized,0);assert.equal(app.files,original);assert.equal(app._verifiedLocalBytes,undefined);}
 else {assert.ifError(error);assert.equal(initialized,1);assert.equal(validated,1,'pinned launches revalidate');assert.equal(app.files,files);assert.equal(result,exe);assert.equal(app._verifiedLocalBytes,byUrl);}
 cases++;
}
async function checkMount(source,mode){
 const created=[],revoked=[],app={localManifestIntegrity:true,requiredFiles:true},ctx={transfer:{owner:true}},files=[{bytes:Uint8Array.of(1)},{bytes:Uint8Array.of(2)}];let loading=false;
 const url={createObjectURL(blob){assert(blob instanceof Blob);if(mode==='partial'&&created.length===1)throw Error('partial');const value='blob:'+created.length;created.push(value);return value;},revokeObjectURL(value){assert(!loading);revoked.push(value);}};
 const wine={async loadFiles(mountFiles,opts){loading=true;try{assert.deepEqual(mountFiles.map(f=>f.url),created);assert.equal(opts.transfer,ctx.transfer);assert.equal(opts.required,true);await Promise.resolve();if(mode==='load-fail')throw Error('load-fail');opts.onProgress({loaded:2,failed:0,total:2});}finally{loading=false;}}};
 const fn=new AsyncFunction('app','ctx','files','URL','Blob','wine','document','log','progressStride','failLaunch','throwIfCancelled',source);
 let error;try{await fn(app,ctx,files,url,Blob,wine,{getElementById(){if(mode==='callback')throw Error('progress failed');return {};}},{textContent:''},1,()=>{},()=>{if(mode==='cancel')throw Error('cancelled');});}catch(e){error=e;}
 assert.deepEqual(revoked,created,'every successfully created object URL is revoked after awaited consumer');
 assert.equal(!!error,mode!=='success');cases++;
}
function renderer(source){const context={module:{exports:{}},console};vm.runInNewContext(source,context);return context.module.exports.Win98Renderer;}
const rendererSource=fs.readFileSync(root+'/lib/renderer.js','utf8');
function checkRendererRestore(source){
 const R=renderer(source),r=Object.create(R.prototype),oldWasm={},oldMemory={},child={hwnd:2,isChild:true,visible:true,parentHwnd:1,wasm:{},wasmMemory:{}};
 Object.assign(r,{wasm:oldWasm,wasmMemory:oldMemory,windows:{2:child},_usesOwnWindowSurface:()=>true,_clipRectForChildSurface:()=>null,drawWindow(){throw Error('draw failure');}});
 assert.throws(()=>r._compositeChildSurfaces({hwnd:1}),/draw failure/);assert.equal(r.wasm,oldWasm);assert.equal(r.wasmMemory,oldMemory);cases++;
 // Execute actual single-source child loop including canvas finally, with an
 // injected draw failure after save. Assert both draw and overlay failures.
 const block=slice(source,'    for (const child of layers) {','    return canvas;');
 for(const overlay of [false,true]){
  let depth=0;const boom=Error('canvas failure'),ctx={save(){depth++;},restore(){depth--;},beginPath(){},rect(){},clip(){},drawImage(){if(!overlay)throw boom;}},host={_flushCanonicalCanvas(){},_windowOriginForComposite:()=>({x:0,y:0}),_clipRectForChildSurface:()=>({x:0,y:0,w:2,h:2}),_overlayFrameLayer(){throw boom;}};
  const fn=new Function('layers','topPos','ctx',block);assert.throws(()=>fn.call(host,[{_backCanvas:{}}],{x:0,y:0},ctx),e=>e===boom);assert.equal(depth,0,'exception must restore canvas clip');cases++;
 }
}
function checkWorkerImports(){
 const worker=fs.readFileSync(root+'/lib/guest-worker.js','utf8');
 const block=slice(worker,'  self.loadD3D9BackendScripts = () => {','\n} else {');
 const self={},calls=[],boom=Error('import failure');let reject=false;
 new Function('self','importScripts','versionedWorkerUrl',block)(self,(...urls)=>{calls.push(urls);if(reject)throw boom;self.D3D9Backend={};},name=>name+'?v=exact');
 assert.equal(self.loadD3D9BackendScripts(),true);assert(calls[0].indexOf('render-clear.js?v=exact')<calls[0].indexOf('d3d9-backend.js?v=exact'));assert(calls[0].includes('render-clear.js?v=exact'));cases++;
 self.loadD3D9BackendScripts();assert.equal(calls.length,1,'already-loaded fast path');cases++;
 delete self.D3D9Backend;reject=true;assert.throws(()=>self.loadD3D9BackendScripts(),e=>e===boom);assert.equal(self.D3D9Backend,undefined);cases++;
}
(async()=>{
 for(const stage of ['fetch','json','validate','invalid','success'])await checkManifest(manifest,stage);
 for(const mode of ['success','partial','load-fail','callback','cancel'])await checkMount(mounts,mode);
 checkRendererRestore(rendererSource);
 checkWorkerImports();
 const primaryCases=cases;
 await assert.rejects(()=>checkManifest(manifest.replaceAll('throwIfCancelled(ctx);',''),'validate'),e=>e.code==='ERR_ASSERTION');mutations++;
 await assert.rejects(()=>checkMount(mounts.replace('URL.revokeObjectURL(url);','void url;'),'success'),e=>e.code==='ERR_ASSERTION');mutations++;
 assert.throws(()=>checkRendererRestore(rendererSource.replace('ctx.restore();\n      }\n    }\n    return canvas;','void ctx;\n      }\n    }\n    return canvas;')),e=>e.code==='ERR_ASSERTION');mutations++;
 console.log(`PASS independent host lifetime controls: ${primaryCases} primary cases; ${mutations} rejecting cleanup/cancellation mutations; modeled host boundaries only`);
})().catch(e=>{console.error(e);process.exitCode=1;});
