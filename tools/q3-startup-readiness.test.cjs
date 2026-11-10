'use strict';
// Retained original evidence + exact generated readiness caller, offline only.
// Controlled producer values are possibilities, never recovered CDP replies.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),prior=path.join(root,'scratch/runs/20261110-q3-repaired-initialization-arena-0250');
const out=process.argv[2];assert(out&&path.resolve(out).startsWith(root+'/scratch/runs/'));
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const current=require('./q3-current-module.cjs'),menu=require('./q3-menu-consumption.cjs');
const route=require('./q3-current-foreign-closure-v1.cjs');
const baseDir=path.join(root,'scratch/runs/20261108-q3-gl-readiness-gameplay');
const base=require(baseDir+'/bound-input.cjs'),producer=require(baseDir+'/producer-ready.cjs');
const config=JSON.parse(fs.readFileSync(prior+'/passive-menu.json'));
const manifest=JSON.parse(zlib.gunzipSync(fs.readFileSync(prior+'/prepared/runtime-pins.json.gz')));
const inputs=[];
function retained(prefix){
 const files=fs.readdirSync(prior+'/unique-recovered').filter(n=>n.startsWith(prefix));assert.equal(files.length,1);
 const file=prior+'/unique-recovered/'+files[0],outer=fs.readFileSync(file),original=zlib.gunzipSync(outer);
 assert.equal(sha(original),files[0].slice(0,-3),'retrieved original SHA');
 const data=zlib.gunzipSync(original);
 inputs.push({path:path.relative(root,file),outerSHA256:sha(outer),originalSHA256:sha(original),decodedBytes:data.length});
 return data.toString().trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));
}
function evidence(){
 const observations=retained('fa4f73'),slices=retained('48eb95'),trace=retained('af9c3'),consoleRows=retained('f9af8a');
 const requests=trace.filter(r=>r.event==='entry'&&r.name==='cdp.request');
 assert.equal(observations.length,39);assert.equal(slices.length,9);assert.equal(requests.length,280);
 assert.equal(slices.at(-1).slice.seq,1931);assert.equal(slices.at(-1).slice.eip,0x443898);
 assert(slices.every(r=>!r.slice.trapped));
 const prod=requests.filter(r=>r.expression?.kind==='renderer.producer');assert.equal(prod.length,22);
 const paths=prod.map(r=>{
  assert(trace.some(t=>t.id===r.id&&t.event==='exit'),'producer query actually settled');
  const next=requests[requests.indexOf(r)+1];assert.equal(next.expression?.kind,'page.owner');
  return {requestId:r.requestId,at:r.at,nextRequestId:next.requestId};
 });
 const attached=observations.find(r=>r.page.apps[0].renderEndpoint!=='none');assert(attached);
 assert.equal(requests.filter(r=>r.method==='Page.captureScreenshot'||r.method.startsWith('Input.')).length,0);
 const unique=new Map(),partials=[];
 for(const row of consoleRows)if(row.args?.[0]==='Q3_GL_PARTIAL'){
  const v=JSON.parse(row.args[1]);partials.push({at:row.at,snapshot:v});
  for(const record of v.render.records){
   if(unique.has(record.sequence))assert.deepEqual(unique.get(record.sequence),record);
   unique.set(record.sequence,record);
  }
 }
 const last=partials.at(-1),lastRender=last.snapshot.render;
 assert.equal(lastRender.sequence,828);assert.equal(lastRender.dropped,764);
 assert.equal(lastRender.errors,0);assert.equal(lastRender.boundaryErrors,0);
 const end=lastRender.records.at(-1);assert.equal(end.kind,'batch-exit');assert.equal(end.frameToken,122);
 assert.equal(last.snapshot.host.records.at(-1).kind,'request-exit');
 const ops={};for(const r of unique.values())if(r.kind==='opcode-enter')ops[r.opcode]=(ops[r.opcode]||0)+1;
 return {observations:observations.length,savedSliceSamples:slices.length,lastSlice:slices.at(-1).slice,
  cdpRequests:requests.length,completedProducerQueries:prod.length,producerQueryPaths:paths,
  firstAttachedAt:attached.at,lastObservationAt:observations.at(-1).at,
  lastRequest:requests.at(-1),lastRequestSettled:trace.some(t=>t.id===requests.at(-1).id&&t.event==='exit'),
  producerRepliesRetained:false,uniqueRenderRecords:unique.size,renderRecordGaps:828-unique.size,
  observedOpcodes:ops,lastRender,lastHost:last.snapshot.host,
  boundary:'readLiveImpl(startup): producer.select returned null before renderer module validation',
  unresolved:'Exact rejected producer field and guest work before first completed draw/presentation are not retained.'};
}
// Every production module used below must be byte-identical to the old sealed
// run. This checks source identity without copying any source into evidence.
const checked=['tools/q3-current-module.cjs','tools/q3-menu-consumption.cjs',
 'tools/q3-menu-pointer-control.cjs','tools/q3-native-input-cause-diagnostic.cjs','tools/q3-input-wire-observation.cjs','lib/gl-compat.js',
 'lib/gl-render-worker.js','lib/gl-command-stream.js',...['bound-input.cjs','producer-ready.cjs','worker-observe.js'].map(n=>path.relative(root,baseDir+'/'+n))];
for(const name of checked){const p=manifest.files.find(p=>p.path===name);assert(p,name);assert.equal(sha(fs.readFileSync(root+'/'+name)),p.sha256,name);}
process.env.Q3_BOUND_INPUT_OBSERVATION='1';process.env.Q3_MENU_CONSUMPTION_CONFIG=prior+'/passive-menu.json';
let generated=route.composition(route.version,prior+'/prepared',prior+'/original/prepared/runtime').compose().source;
generated=require('./q3-menu-pointer-control.cjs').integrate(generated);
generated=require('./q3-native-input-cause-diagnostic.cjs').consumerSource(generated);
generated=require('./q3-input-wire-observation.cjs').integrate(generated);
delete process.env.Q3_BOUND_INPUT_OBSERVATION;delete process.env.Q3_MENU_CONSUMPTION_CONFIG;
const initialize=generated.split('\n').find(s=>s.includes('chain=bound.createChain('));
const readyLine=generated.split('\n').find(s=>s.includes("save('renderer-readiness.json',await chain.establishReady("));
assert(initialize&&readyLine);
// The real original GL adapter, command stream and bridge, with a software
// canvas-free consumer, reproduce setup-without-presentation. No guest runs.
function originalRenderer(){
 const GL=require('../lib/gl-compat'),Stream=require('../lib/gl-command-stream');
 const memory={buffer:new SharedArrayBuffer(4096)};
 const scope={OpenGLCompat:{...GL},GLCommandStream:Stream,crypto:crypto.webcrypto,
  OffscreenCanvas:class{getContext(){return null;}},console,Uint8ClampedArray};
 scope.importScripts=()=>{};vm.createContext(scope);
 vm.runInContext(fs.readFileSync(baseDir+'/worker-observe.js','utf8'),scope);
 vm.runInContext(fs.readFileSync(root+'/lib/gl-render-worker.js','utf8'),scope);
 scope.importScripts();
 const adapter=scope.GLRenderWorker.create({instance:{exports:{}},memory,backend:'software',sendFrame:()=>assert.fail('no pre-present frame')});
 const execute=(name,args=[],aux=0)=>{
  const v=new DataView(memory.buffer),bytes=36+args.length*4;new Uint8Array(memory.buffer).fill(0);
  v.setUint32(0,bytes,true);v.setUint32(4,GL.CALL_INDEX[name],true);v.setUint32(8,aux,true);v.setUint32(12,4+args.length*4,true);
  args.forEach((a,i)=>v.setUint32(36+i*4,a,true));
  return adapter.execute({memoryOffset:0,bytes,owner:0,windows:[{hwnd:65543,w:16,h:16,clientSize:{w:16,h:16}}]});
 };
 try{
  assert.equal(execute('wglCreateContext',[],65543).value,1);
  assert.equal(execute('wglMakeCurrent',[0,1],65543).value,1);
  execute('glBindTexture',[0xde1,1]);execute('glGetError');
  scope.endpoints=new Map([[1,{options:{api:'gl',backend:'software'},adapter}]]);
  const read=JSON.parse(JSON.stringify(vm.runInContext(producer.READ,scope)));
  const owner=read[0].gl.owners[0];assert.equal(owner.hwnd,65543);assert.equal(owner.completed,4);assert.equal(owner.presented,0);
  assert.equal(producer.select({a:{slot:0,renderEndpoint:1},endpoints:read,target:'render',backend:'software'}),null);
  return {realAdapter:true,realBridge:true,realCommandStream:true,actualWorkerObserver:true,setupCompleted:owner.completed,presented:owner.presented,readiness:null};
 }finally{adapter.destroy();}
}
async function readinessControl(mode){
 const canonical=current.SELECTED.sha256,bytes=fs.readFileSync(prior+'/passive-menu.wasm');
 assert.equal(sha(bytes),config.sha256);
 const app={name:'quake3_demo',running:true,stopped:false,guestWorker:true,processId:1000,endpoint:1,guestEndpoint:1,slot:0,renderEndpoint:1};
 for(const key of ['processObject','endpointObject','workerObject','moduleObject','epoch','pageRendererObject','canvasObject','renderEndpointObject','renderWorkerObject'])app[key]='test-'+key;
 const page={isolated:true,apps:[app]},workers=new Map([
  ['guest',{sessionId:'guest',targetId:'guest-target',url:'/guest-worker.js',scripts:[
   {scriptId:'canonical',sha256:canonical,bytecodeAvailable:true},{scriptId:'observation',sha256:config.sha256,bytecodeAvailable:true}]}],
  ['render',{sessionId:'render',targetId:'render-target',url:'/d3d-render-worker.js',scripts:[{scriptId:'render-module',sha256:canonical,bytecodeAvailable:true}]}]
 ]);
 let producerReads=0,terminal=0,renderModuleReads=0,waits=0;const wire=[],saved={};
 const endpoint=()=>[{id:1,options:{api:'gl',backend:'webgl'},gl:{adapter:'adapter',bridge:'bridge',owners:[{
  owner:mode==='wrong-owner'?1:0,context:'context',hwnd:65543,software:false,webgl:true,
  completed:10+producerReads,presented:mode==='no-presentation'?0:producerReads,
  writeSeq:mode==='no-write'?0:producerReads,draws:mode==='no-draw'?0:producerReads,vertices:producerReads*3}]} }];
 const evaluate=async(expression,session)=>{
  wire.push(expression===base.PAGE_READ?'page':expression===base.WORKER_READ?'guest':expression===base.RENDER_READ?'renderer':expression===producer.READ?'producer':'installed');
  if(expression===base.PAGE_READ)return structuredClone(page);
  if(expression===base.WORKER_READ)return {endpointIdentity:1,slot:0,instance:'installed-instance'};
  if(expression==='globalThis.__q3MenuConsumption.moduleIdentity()')return {sha256:config.sha256,bytes:config.size};
  assert.equal(session,'render');
  if(expression===base.RENDER_READ)return [{id:1,options:{api:'gl',backend:'webgl'},contexts:['context'],epoch:'render-epoch',failed:false}];
  assert.equal(expression,producer.READ);producerReads++;return endpoint();
 };
 const send=async(method,params,session)=>{
  assert.equal(method,'Debugger.getScriptSource');
  if(session==='render'){renderModuleReads++;return {bytecode:fs.readFileSync(root+'/build/wine-assembly.wasm').toString('base64')};}
  assert.equal(params.scriptId,'observation');return {bytecode:bytes.toString('base64')};
 };
 const scope={assert,bound:menu.boundAdapter(base,config,()=>terminal++),evaluate,send,workers,pageSession:'page',
  fs:{existsSync:()=>false},run:'/offline',process:{env:{}},pins:manifest,save:(n,v)=>saved[n]=v,
  log(){},wait:async()=>{waits++;if(waits===2&&mode!=='complete')throw Error('offline stop after two pending samples');}};
 vm.createContext(scope);
 const oldBackend=process.env.RENDER_BACKEND;process.env.RENDER_BACKEND='webgl';
 try{vm.runInContext(initialize,scope);}finally{
  if(oldBackend===undefined)delete process.env.RENDER_BACKEND;else process.env.RENDER_BACKEND=oldBackend;
 }
 const command=vm.runInContext('(async()=>{'+readyLine+'})()',scope);
 if(mode==='complete'){
  await command;assert(saved['renderer-readiness.json'].ready);assert.equal(renderModuleReads,2);
 }else{
  await assert.rejects(command,/offline stop/);assert.equal(saved['renderer-readiness.json'],undefined);assert.equal(renderModuleReads,0);
  assert.deepEqual(wire,['page','guest','installed','renderer','producer','page','page','guest','installed','renderer','producer','page']);
 }
 assert.equal(terminal,0);
 return {mode,producerReads,renderModuleReads,ready:!!saved['renderer-readiness.json'],wire};
}
(async()=>{
 const result={passed:true,offlineOnly:true,generatedSHA256:sha(Buffer.from(generated)),verifiedOriginalProviders:checked,
  evidence:evidence(),originalRenderer:originalRenderer(),controls:[]};
 for(const mode of ['no-presentation','no-write','no-draw','wrong-owner','complete'])result.controls.push(await readinessControl(mode));
 result.nonIdentifiability='Four distinct missing producer conditions reproduce the same retained request branch; original response values are absent.';
 result.inputs=inputs;
 fs.writeFileSync(path.join(out,'diagnosis.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify({passed:true,boundary:result.evidence.boundary,controls:result.controls.map(c=>({mode:c.mode,ready:c.ready})),originalRenderer:result.originalRenderer}));
})().catch(error=>{console.error(error);process.exitCode=1;});
