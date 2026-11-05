'use strict';
// Synthetic fragments/data only. No original application/browser execution.
// This fixture deliberately uses the actual native module and production
// observer factory, WineAssembly, imports, renderer, screenshot and route seams.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),{Worker,isMainThread,workerData,parentPort}=require('node:worker_threads');
const ROOT=path.resolve(__dirname,'..'),api=require('../tools/stronghold-owning-callback-observer.cjs');
const runtime=require('../tools/stronghold-local-runtime.cjs'),base=require('../tools/stronghold-preset-driver-attachment.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const EXE=base.MEDIA,epoch='synthetic-copy/fixture',nativeEpoch=0xc3746a23;
async function nativeFixture(variant){
 const {bootRenderHarness}=require('./render-helper'),{g2w}=require('../lib/mem-utils');
 const bytes=fs.readFileSync('build/'+variant),module=await WebAssembly.compile(bytes);let cycle,e,blocks=0;
 const rows=[],h=await bootRenderHarness({prebuiltModule:module,width:32,height:24,fonts:'none',
  extraHostOverrides:{log_block(pc,esp){blocks++;cycle?.boundary(pc>>>0,esp>>>0);}}});
 e=h.exports;const raw=new Uint8Array(h.memory.buffer),dv=new DataView(h.memory.buffer),wa=a=>g2w(a,0x400000,h.memory),
  put=(a,v)=>raw.set(v,wa(a)),u=(a,v)=>dv.setUint32(wa(a),v>>>0,true),u32=a=>dv.getUint32(wa(a),true),
  le=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255],jmp=(at,to)=>put(at,[0xe9,...le(to-at-5)]),
  call=(at,to)=>put(at,[0xe8,...le(to-at-5)]);
 const exe=fs.readFileSync(EXE);assert.equal(hash(exe),api.EXE_SHA256);raw.set(exe,e.get_staging());assert(e.load_pe(exe.length));
 e.set_api_log(0);e.set_uop(0);e.set_stack_fusion(0);e.set_trace_esp(1,0,0);
 const gate=Buffer.from(raw.subarray(wa(0x576b9a),wa(0x576bc5))),reset=Buffer.from(raw.subarray(wa(0x576c51),wa(0x576c65)));
 for(const [a,v]of [[0xfb4694,0],[0xefe4b4,0],[0xd138b0,1],[0x1a431a4,1],[0xd137c0,20],
  [0xd13764,20],[0xd13770,20],[0x150978c,0x692f48],[0x995694,0x5bd0ac]])u(a,v);
 // Original gate, reset, scene-manager CALL, two widget CALLs and post-widget
 // CALL retained. Only callee bodies and unrelated helpers are synthetic.
 put(0x4e95f0,[0xc3]);jmp(0x576bc5,0x576c51);jmp(0x576c65,0x576db6);
 call(0x4e9180,0x4292c0);put(0x4e9185,[0xc3]);put(0x4292c0,[0xc3]);
 put(0x576dbb,Array(11).fill(0x90));put(0x4e9400,[0xc2,4,0]);
 call(0x4ea0a0,0x44fd63);put(0x4ea0a5,[0xc3]);
 // Park during real native work below the post-widget frame. The frame
 // survives the already observed draw/scene-manager/first-widget returns.
 put(0x44fd63,[0xeb,0xfe]);e.invalidate_code_range(0x400000,0x180000);
 e.set_ebx(0);e.set_ebp(0);e.set_esp(0x7408000);e.set_eip(0x576b9a);
 assert.equal(e.pending_context_arm_profile(nativeEpoch,2,0x400000),1);
 assert.equal(e.pending_context_profile(),2);assert.equal(e.pending_context_epoch()>>>0,nativeEpoch);
 assert.equal(e.pending_context_depth(),0);assert.equal(e.pending_context_status(nativeEpoch),1);
 assert.throws(()=>require('../tools/mdk2-lua-construction-observer.cjs').pendingAbsence(e,nativeEpoch),/incomplete/,'Stronghold valid depth0 is not MDK proof');
 cycle=api.cycleFactory({getExports:()=>e,u32,nativeEpoch,emit(kind,data){rows.push({kind,epoch,sequence:rows.length+1,block:blocks,...data});}});
 e.run(1000);assert.equal(e.get_eip()>>>0,0x44fd63);
 const receipt=cycle.receipt();assert.equal(receipt.status,'owning-setup-in-progress');
 assert(receipt.cycle.sceneManager.returned);assert(receipt.cycle.draw.returned);assert(receipt.cycle.widget0.returned);
 assert.equal(receipt.cycle.active.target,0x4ea0a0);assert.equal(receipt.cycle.active.caller,0x576ddb);
 assert.equal(receipt.cycle.active.entryESP,receipt.cycle.active.esp);assert.equal(receipt.cycle.active.callerESP,receipt.cycle.active.entryESP+4);
 assert.equal(receipt.cycle.gate.manager,0x692f48);assert.equal(receipt.cycle.gate.admitted,true);
 assert.equal(receipt.cycle.resetReceipt.before,1);assert.equal(receipt.cycle.resetReceipt.after,0);
 assert.equal(receipt.readinessGranted,false);assert.equal(receipt.pixelsAccepted,false);
 assert.deepEqual(Buffer.from(raw.subarray(wa(0x576b9a),wa(0x576bc5))),gate);
 assert.deepEqual(Buffer.from(raw.subarray(wa(0x576c51),wa(0x576c65))),reset);
 const profile2Reject=()=>require('../tools/mdk2-lua-construction-observer.cjs').pendingAbsence(e,nativeEpoch);
 // The MDK consumer's public helper name is checked at implementation review;
 // if not public, its existing driver fixture must exercise this rejection.
 if(require('../tools/mdk2-lua-construction-observer.cjs').pendingAbsence)assert.throws(profile2Reject,/incomplete|profile/);
 assert.equal(e.pending_context_status(nativeEpoch),1);assert(e.pending_context_depth()>0);
 assert.equal(e.pending_context_status(nativeEpoch+1),0);assert.equal(e.pending_context_status(nativeEpoch),0);
 assert.throws(()=>cycle.receipt(),/coverage/);
 return {variant,moduleSHA256:hash(bytes),exe:{path:EXE,sha256:hash(exe)},receipt,blocks,rows,
  synthetic:true,applicationEntryExecuted:false,readinessGranted:false,pixelsAccepted:false};
}

async function profileFixture(variant){
 const {bootRenderHarness}=require('./render-helper'),{g2w}=require('../lib/mem-utils');
 const bytes=fs.readFileSync('build/'+variant),module=await WebAssembly.compile(bytes),targets=[0x4e95f0,0x4e9180,0x4e9400,0x4292c0,0x4ea0a0,0x467b90];
 let e,receive,entries=[];const workerURL='http://fixture/lib/guest-worker.js?v=profile';
 const preload=api.installPreload({realmURL:workerURL,expectedWorkerURL:workerURL,epoch,exeSha256:api.EXE_SHA256,
  wasmSha256:hash(bytes),nativeEpoch,deadlineEpochMs:Date.now()+30000,translate:g2w,listen(fn){receive=fn;}});
 const h=await bootRenderHarness({prebuiltModule:module,fonts:'none',beforeInstantiate(ctx,host){receive({data:{t:'init',module,memory:host.memory,slot:0,endpointIdentity:1}});},extraHostOverrides:{log_block(pc,esp){
  if(targets.includes(pc>>>0))entries.push({target:pc>>>0,esp:esp>>>0,coverage:e.pending_context_coverage(nativeEpoch),
   depth:e.pending_context_depth(),frame:[0,1,2].map(i=>e.pending_context_entry(0,i)>>>0)});
 }}});e=h.exports;const raw=new Uint8Array(h.memory.buffer),dv=new DataView(h.memory.buffer),wa=a=>g2w(a,0x400000,h.memory),le=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255];
 const exe=fs.readFileSync(EXE);raw.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);e.set_uop(0);e.set_stack_fusion(0);
 let at=0x580000;for(const target of targets){raw.set([0xe8,...le(target-at-5)],wa(at));raw.set([0xc3],wa(target));at+=5;}
 raw.set([0x83,0x3d,...le(0x580900),0,0x74,0xf7,0xe9,...le(0x580600-at-14)],wa(at));
 raw.set([0xe8,...le(0x4e95f0-0x580605),0xeb,0xfe],wa(0x580600));raw.set([0xeb,0xfe],wa(0x580700));
 dv.setUint32(wa(0x580900),0,true);e.invalidate_code_range(0x400000,0x181000);e.set_eip(0x580000);e.set_esp(0x7408000);e.set_trace_esp(1,0,0);
 assert.equal(preload.entries.length,1);assert(preload.entries[0].installedBeforeInstantiation);assert.equal(preload.entries[0].error,undefined);
 assert.equal(e.pending_context_profile(),2);assert.equal(e.pending_context_epoch()>>>0,nativeEpoch);e.run(64);
 assert.equal(e.get_eip()>>>0,at);assert.equal(e.pending_context_status(nativeEpoch),1);assert.equal(e.pending_context_depth(),0);
 assert.equal(entries.length,targets.length);for(const [i,row]of entries.entries()){
  assert.equal(row.coverage,1);assert.equal(row.depth,1);assert.deepEqual(row.frame,[targets[i],0x580005+i*5,0x7407ffc]);assert.equal(row.esp,row.frame[2]);
 }
 const cycle=api.cycleFactory({getExports:()=>e,nativeEpoch,u32:a=>dv.getUint32(wa(a),true),emit(){}});
 assert.equal(cycle.receipt().status,'unknown','Stronghold depth0 without whole-cycle history is unknown');
 assert.throws(()=>require('../tools/mdk2-lua-construction-observer.cjs').pendingAbsence(e,nativeEpoch),/incomplete/);
 const completeEntries=entries.slice();dv.setUint32(wa(0x580900),1,true);
 for(let i=0;i<8&&(e.get_eip()>>>0)!==0x4e95f0;i++)e.run(1);
 assert.equal(e.pending_context_depth(),1);assert.equal(e.get_eip()>>>0,0x4e95f0);
 dv.setUint32(wa(e.get_esp()>>>0),0x580700,true);e.run(1);
 const firstWrongReturnReason=e.pending_context_reason();assert.equal(firstWrongReturnReason,4);assert.equal(e.pending_context_status(nativeEpoch),0);
 assert.throws(()=>cycle.receipt(),/coverage/);
 assert.equal(e.pending_context_arm_profile(nativeEpoch,2,0x400000),0);assert.equal(e.pending_context_status(nativeEpoch),0);
 preload.finish('fixture-complete');
 return {variant,preInstantiationBinding:true,profileTargets:completeEntries,depth0WithoutCycle:'unknown',firstWrongReturnReason,rearmRejected:true};
}

async function composedFixture(variant){
 // Reuse the retained production-composition dependency fixture by sealed
 // in-memory source transformations. Nothing is copied into the run tree.
 const file=path.join(ROOT,'test/test-stronghold-natural-setup-dependency.js'),src=fs.readFileSync(file,'utf8');
 const begin=src.indexOf('async function composedFallback(){'),end=src.indexOf('\n(async()=>{',begin);
 assert(begin>0&&end>begin);let body=src.slice(begin,end);
 const replace=(before,after)=>{assert.equal(body.split(before).length,2,before);body=body.replace(before,after);};
 replace(" const observation=observe?api.hostPresentationFactory().attach", " host.dx_trace(21,slot,2);\n const observation=observe?api.hostPresentationFactory().attach");
 replace("const win=renderer.windows[hwnd],captures=[];", "const win=renderer.windows[hwnd],captures=[];wine._frozenSteps=64;");
 replace("  assert.equal(observation.report.operationRelation,null);",`
  const copies=observation.report.records.filter(r=>r.kind==='selected-fallback-copy');
  const publications=observation.report.records.filter(r=>r.kind==='fallback-publication');
  assert.equal(copies.length,3);assert(publications.length>=3);
  assert(copies.every(r=>r.allocationGeneration>0&&r.owningMemory&&r.owningWindow&&r.current));
  assert.equal(new Set(copies.map(r=>r.copyGeneration)).size,3);
  assert(copies[1].partialWritePossible);assert.equal(copies[1].policy.heldChecks,3);
  assert.equal(copies[2].partialWritePossible,false);
  assert(publications.every(r=>r.frame>0&&r.copyGeneration>0&&r.edges.length>0));
  const token=observation.token();observation.capture(token,'a'.repeat(64),'selected-fallback');
  assert.equal(observation.report.records.at(-1).copyCurrent,true);
  assert.equal(observation.report.records.at(-1).copyGeneration,copies.at(-1).copyGeneration);
  // Same slot/address/geometry reallocation must invalidate the old receipt.
  const beforeReallocation=observation.token();host.dx_trace(22,slot);host.dx_trace(21,slot,2);
  observation.capture(beforeReallocation,'b'.repeat(64),'stale-reallocation');
  assert.match(observation.report.fault,/replaced capture copy/);
  assert.equal(observation.report.readinessGranted,false);
  assert.equal(observation.report.operationRelation,null);`);
 // The intentional terminal lifetime negative is asserted above, after every
 // existing no-fault/pixel/transparency assertion, and before ordinary finish.
 replace("['wine-assembly.wasm','wine-assembly.compat.wasm']",JSON.stringify([variant]));
 const result=await vm.runInThisContext('(async function(require,__dirname){'+body+';return composedFallback();})', {filename:file})(require('node:module').createRequire(file),path.dirname(file));
 return {fixtureSource:{path:path.relative(ROOT,file),sha256:hash(Buffer.from(src))},result};
}

async function routeFixture(variant,observe=true){
 const {bootRenderHarness}=require('./render-helper'),{g2w}=require('../lib/mem-utils'),regions=require('../lib/region-map.generated');
 const bytes=fs.readFileSync('build/'+variant),module=await WebAssembly.compile(bytes),wasmSha256=hash(bytes);
 const workerURL='http://fixture/lib/guest-worker.js?v=copy',targetId='synthetic-copy',sessionId='fixture';
 const nativeOptions={workerSlot:0,endpointIdentity:1,epoch,exeSha256:api.EXE_SHA256,wasmSha256,workerURL,
  expectedWorkerURL:workerURL,nativeEpoch,deadline:performance.now()+30000};
 let e,native;
 const h=await bootRenderHarness({prebuiltModule:module,width:32,height:24,fonts:'none',beforeInstantiate(ctx,host){
  if(observe)native=api.attach({...nativeOptions,host,getExports:()=>e,memory:host.memory,translate:g2w});
  else{native={report:{...nativeOptions,status:'running',blocks:0,fault:null},start(){},annotate(){},check(){},assertLive(){},finish(){}};
   const prior=host.log_block;host.log_block=function(...args){native.report.blocks++;return Reflect.apply(prior,this,args);};}
 }});
 e=h.exports;const {memory,renderer,instance}=h,b=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),wa=a=>g2w(a,0x400000,memory);
 const put=(a,v)=>b.set(v,wa(a)),u=(a,v)=>dv.setUint32(wa(a),v>>>0,true),le=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255],
  jump=(a,z)=>put(a,[0xe9,...le(z-a-5)]),call=(a,z)=>put(a,[0xe8,...le(z-a-5)]);
 const exe=fs.readFileSync(EXE);b.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);e.set_uop(0);e.set_stack_fusion(0);
 for(const [a,v]of [[0xfb4694,0],[0xefe4b4,0],[0xd138b0,1],[0x1a431a4,1],[0xd137c0,20],
  [0xd13764,20],[0xd13770,20],[0x150978c,0x692f48],[0x995694,0x5bd0ac],[0x1681318,99],
  [0x692e18,32],[0x690e54,0],[0x175f9fc,1],[0x6921b8,1000],[0xdbbd30,0],[0x692f48,0]])u(a,v);
 put(0x4e95f0,[0xc3]);jump(0x576bc5,0x576c51);jump(0x576c65,0x576db6);
 call(0x4e9180,0x4292c0);put(0x4e9185,[0xc3]);put(0x4094a0,[0xc2,4,0]);put(0x4e9400,[0xc2,4,0]);
 for(const [a,v]of [[0x455240,[0xc2,12,0]],[0x489180,[0xc3]],[0x479fb0,[0xc3]],[0x47a000,[0xc3]],[0x449780,[0xc3]]])put(a,v);
 jump(0x4293c2,0x42971b);jump(0x4297b0,0x429ad4);jump(0x429b0e,0x42a207);
 put(0x580070,[0xa1,...le(0x580100),0x83,0x05,...le(0x580100),100,0xc3]);u(0x5841c8,0x580070);u(0x580100,1100);
 const hwnd=65537,slot=6,sid=0x200006,w=32,hh=24,pitch=64,guestBits=0x1800000,bits=wa(guestBits);
 // Continuous real x86 writes below the owning post-widget CALL. The only
 // changing input is a synthetic paint command; no EIP/ESP setter after arm.
 call(0x4ea0a0,0x580200);put(0x4ea0a5,[0xc3]);
 jump(0x576df2,0x576e2f);put(0x576e2f,[0x55]);put(0x576e35,[0xeb,0xfe]);
 const program=[0x83,0x3d,...le(0x580400),0,0x74,0xf7, // cmp command,0; je entry
  0x83,0x3d,...le(0x580400),2,0x74,0];
 const exitDisplacement=program.length-1;
 program.push(
  0xa1,...le(0x580404),0x8b,0x3d,...le(0x580408),0x8b,0x0d,...le(0x58040c),0xf3,0x66,0xab,
  0xc7,0x05,...le(0x580400),0,0,0,0,0xe9);
 program.push(...le(0x580200-(0x580200+program.length+4)));
 program[exitDisplacement]=program.length-exitDisplacement-1;program.push(0xc3);put(0x580200,program);u(0x580400,0);
 e.invalidate_code_range(0x400000,0x180000);e.set_ebx(0);e.set_ebp(0);e.set_esp(0x7408000);e.set_eip(0x576b9a);
 assert.equal(e.pending_context_arm_profile(nativeEpoch,2,0x400000),1);
 const source=fs.readFileSync('host.js','utf8'),context={console,performance,setTimeout,clearTimeout,URLSearchParams,
  require:require('node:module').createRequire(ROOT+'/host.js'),createHostImports:require('../lib/host-imports').createHostImports};
 vm.runInNewContext(source+';globalThis.WineAssembly=WineAssembly;',context);
 const wine=new context.WineAssembly(),facade={...e,get_main_hwnd:()=>hwnd,get_dx_present_hwnd:()=>hwnd,get_dx_scroll_hold_slot:()=>-1};
 Object.assign(wine,{memory,renderer,instance,processId:7,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}}});
 const {host,gdi}=wine.getImports({exports:facade,instance});host.memory=memory;wine._hostImports=host;renderer.wasm={exports:facade};
 renderer.windows[hwnd]={hwnd,x:0,y:0,w,h:hh,visible:true,zOrder:1,style:0x90000000,exStyle:0,title:'synthetic transaction',wasm:instance,wasmMemory:memory,processId:7};
 renderer.getWindowCanvas(hwnd);
 const entry=regions.BASE.DX_OBJECTS+slot*32;
 dv.setUint32(entry,2,true);dv.setUint16(entry+12,w,true);dv.setUint16(entry+14,hh,true);dv.setUint16(entry+16,16,true);dv.setUint16(entry+18,pitch,true);dv.setUint32(entry+20,bits,true);dv.setUint32(entry+28,1,true);
 for(const [off,value]of [[0,w],[4,hh],[8,16],[12,1],[16,hwnd],[20,0]])dv.setUint32(regions.BASE.DX_PROCESS_STATE+off,value,true);
 const broker={serveCall(msg){return host[msg.name](...msg.args);}},worker={},link={slot:0,endpointIdentity:1,memory,module,worker,workerUrl:workerURL};
 wine.guestWorker={memory,module,broker,link};
 let executeDuringScreenshot=false;
 const saved=[],pageRealm=vm.createContext({wine,WebAssembly,URL,performance,setTimeout,clearTimeout,TextEncoder}),page={
  async evaluate(code){return structuredClone(vm.runInContext(code,pageRealm));},async screenshot(){if(executeDuringScreenshot)e.run(1);return (renderer.presentationCanvas||renderer.canvas).toBuffer('image/png');}};
 const controller=observe?runtime.createHostPresentationController({page:()=>page,save:(name,data)=>saved.push({name,data:structuredClone(data)}),deadline:()=>Date.now()+30000}):
  {async start(){},async captureToken(){return null;},async capture(){},async link(){return null;},async finish(){}};
 const wrapper=()=>({targetId,sessionId,workerURL,events:[{kind:'received-module',type:'init',slot:0},{kind:'instantiated',incoming:{type:'init',slot:0}}],
  entries:1,installedBeforeInstantiation:true,slot:0,endpointIdentity:1,thread:1,report:native.report});
 const invoke=(action,row)=>{
  if(action==='start'){native.start();e.set_trace_esp(1,0,0);native.annotate({epoch,command:row.command,kind:'begin'});}
  else if(action==='annotate')native.annotate({...row,epoch,command:1});
  else if(action==='check')native.check();else if(action==='assert-live')native.assertLive();else if(action==='finish')native.finish(row.reason);
  else assert.equal(action,'report');
  if(native.report.fault)throw Error(native.report.fault);return wrapper();
 };
 const workerRealm=vm.createContext({__strongholdPresetAttachment:{invoke}}),session={async send(method,args){assert.equal(method,'Runtime.evaluate');return {result:{value:vm.runInContext(args.expression,workerRealm)}};}};
 const sessions=new Map([[targetId,{session,sessionId,info:{url:workerURL},expectedWorkerURL:workerURL,preloadVerified:true}]]);
 let steps=0;const state=async()=>({main:{href:'http://fixture/',tick:{steps},inputQueue:[],activeInput:null,lastInput:null,mouseButtonsMask:0,
  observation:{events:[{kind:'compiled',sha256:wasmSha256},{kind:'sent-module',sha256:wasmSha256,workerURL,slot:0,type:'init'}]}}});
 const attachment=api.createAttachment({sessions,pageState:state,wasmSha256,hostPresentation:controller,save:(name,data)=>saved.push({name,data:structuredClone(data)}),log(){},validateAck(){}});
 await attachment.begin({action:'route-gesture'},1);assert.equal(native.report.status,'running');
 host.dx_trace(21,slot,2);
 async function paint(value,count=w*hh,offset=0){u(0x580404,value);u(0x580408,guestBits+offset*2);u(0x58040c,count);u(0x580400,1);
  const before=steps,blocks=native.report.blocks;e.run(64);assert.equal(native.report.blocks-blocks,64);steps+=64;wine._frozenSteps=steps;
  assert.equal(native.report.fault,null);assert.equal(dv.getUint32(wa(0x580400),true),0);
  return {before,steps,guests:[{requested:64,ran:64,steps,running:true,frozen:true,tickMs:16}]};}
 const pins=path.resolve(process.env.STRONGHOLD_COPY_RUN||'scratch/runs/20261105-stronghold-native-copy-publication','fixture-pins-'+variant+'.json');
 fs.writeFileSync(pins,JSON.stringify({files:[{path:'build/wine-assembly.wasm',sha256:hash(fs.readFileSync('build/wine-assembly.wasm'))},{path:'build/wine-assembly.compat.wasm',sha256:hash(fs.readFileSync('build/wine-assembly.compat.wasm'))}]}));
 const composed=runtime.prepare({run:path.join(path.dirname(pins),'offline-route-'+variant),pins,wasmSha256});
 const start=composed.source.indexOf('async function freshShot(name){'),end=composed.source.indexOf('\nfunction operatorLive()',start);assert(start>=0&&end>start);
 const shot=vm.runInNewContext(composed.source.slice(start,end)+';freshShot',{Buffer,OUT:path.dirname(pins),path,sha:hash,hostPresentation:controller,
  fs:{existsSync:()=>false,writeFileSync(){},renameSync(){}},save(){},state,presetAttachment:attachment,page});
 const results=[];
 for(const mode of ['windowed','exclusive','intermediate']){
  dv.setUint32(regions.BASE.DX_PROCESS_STATE+20,mode==='windowed'?0:1,true);
  if(mode==='intermediate'){
   const {createCanvas}=require('../lib/canvas-compat'),{PresentationFilter}=require('../lib/presentation-filter');
   renderer.presentationCanvas=createCanvas(w*2,hh*2);
   renderer.presentationFilter=new PresentationFilter(renderer.presentationCanvas,{createCanvas:()=>createCanvas(w,hh)});
   renderer.presentationScaleMode='integer';
  }
  for(const partial of [false,true]){
   const ack=await paint(partial?0x001f:0xf800,partial?w*hh/2:w*hh);
   if(!gdi.surfacePresentations.has(sid)){
    assert.equal(host.gdi_surface_create(sid,w,hh,16,bits,pitch,1,0,0,0xf800,0x07e0,0x001f),1);
    assert.equal(host.gdi_surface_attach(sid,hwnd),1);assert.equal(host.gdi_surface_upload(sid,0,0,w,hh),1);
   }
   if(partial)host.dx_trace(1,slot);host.dx_trace(5,slot);
   if(partial){assert.equal(wine._presentNow(),0);assert.equal(wine._presentNow(),0);}
   assert.equal(wine._presentNow(),1);await attachment.ack(ack,64,ack.before);
   const capture=await shot(mode+(partial?'-partial':'-complete'));
   if(observe){
   assert.equal(capture.nativeObservation.status,'proved-setup-in-progress',JSON.stringify(capture.nativeObservation));
   assert.equal(capture.nativeObservation.partialWritePossible,partial);
   if(mode==='intermediate'){
    assert.notEqual(capture.nativeObservation.publication.backend,'logical-canvas');
    assert.equal(capture.nativeObservation.publication.sourceCanvas, capture.nativeObservation.publication.edges.at(-1).destination);
    assert.notEqual(capture.nativeObservation.publication.sourceCanvas,capture.nativeObservation.publication.outputCanvas);
   }
   assert.equal(runtime.diagnosticScene(capture.png,'unknown',capture.nativeObservation),'setup-transition-observation');
   const a=composed.route.indexOf(' const capture=async()=>{'),z=composed.route.indexOf(' const sample=',a);assert(a>=0&&z>a);
   const routed=await vm.runInNewContext(composed.route.slice(a,z)+'capture()',{
    require,physical:{capture:async()=>capture},sha256:hash,scene:()=> 'unknown',fail(message){throw Error(message);}});
   assert.equal(routed.scene,'setup-transition-observation');
   }
   results.push({mode,partial,sha256:hash(capture.png),publication:renderer._immutablePublicationSequence,
    registers:Object.fromEntries(['eip','esp','eax','ebx','ecx','edx','esi','edi','ebp','flag_op','flag_a','flag_b','flag_res'].map(n=>[n,e['get_'+n]()>>>0])),
    observation:capture.nativeObservation});
   if(partial)host.dx_trace(2,slot);
  }
 }
 const finalMemorySHA256=hash(b),blocks=native.report.blocks;
 if(!observe)return {variant,results,finalMemorySHA256,blocks,control:true};
 const proof=results.at(-1).observation.proof,negatives=[];
 const drop=(p,side,kind)=>{const report=p[side];report.records=report.records.filter(r=>r.kind!==kind);report.records.forEach((r,i)=>r.sequence=i+1);report.sequence=report.records.length;};
 const receipts=(p,mutate)=>{for(const r of p.nativeReport.records)if(r.nativeReceipt)mutate(r.nativeReceipt);mutate(p.nativeReport.nativeObservation);};
 for(const [name,mutate]of [
  ['missing-gate',p=>delete p.nativeReport.records.at(-1).nativeReceipt.cycle.gate],
  ['missing-reset',p=>p.nativeReport.records.at(-1).nativeReceipt.cycle.reset=false],
  ['missing-draw',p=>delete p.nativeReport.records.at(-1).nativeReceipt.cycle.draw],
  ['foreign-profile',p=>p.nativeReport.records.at(-1).nativeReceipt.native.profile=1],
  ['foreign-epoch',p=>p.hostReport.epoch='foreign'],['foreign-module',p=>p.hostReport.nativeBinding.wasmSha256='0'.repeat(64)],
  ['missing-allocation',p=>p.hostReport.records.findLast(r=>r.kind==='fallback-publication').allocationGeneration=0],
  ['stale-step',p=>p.capture.steps--],['wrong-hash',p=>p.capture.sha256='0'.repeat(64)],
  ['native-executed',p=>p.nativeReport.blocks++],['terminal',p=>p.hostReport.status='terminal'],
  ['pending',p=>p.hostReport.pending=1],['cap',p=>p.nativeReport.limits.maxBoundaries=p.nativeReport.blocks],
  ['missing-limits',p=>delete p.hostReport.limits],['malformed',p=>p.nativeReport.records.push(null)],
  ['missing-pass-returns',p=>drop(p,'nativeReport','cycle-pass-return')],
  ['missing-draw-return',p=>drop(p,'nativeReport','cycle-draw-return')],
  ['missing-gate-successors',p=>drop(p,'nativeReport','input-gate-successor')],
  ['missing-copy-record',p=>drop(p,'hostReport','selected-fallback-copy')],
  ['missing-edges',p=>p.hostReport.records.findLast(r=>r.kind==='fallback-publication').edges=[]],
  ['wrong-publication-canvas',p=>p.hostReport.records.findLast(r=>r.kind==='fallback-publication').sourceCanvas=9999],
  ['partial-ACK',p=>p.nativeReport.records.findLast(r=>r.annotation?.kind==='ACK').annotation.guests[0].ran=1],
  ['foreign-ACK-command',p=>p.nativeReport.records.findLast(r=>r.annotation?.kind==='ACK').annotation.command++],
  ['native-depth0-without-owner',p=>receipts(p,r=>r.native.entries=[])],
  ['missing-independent-gate',p=>receipts(p,r=>delete r.cycle.gate)],
  ['missing-independent-reset',p=>receipts(p,r=>r.cycle.reset=false)],
  ['wrong-caller-ESP',p=>receipts(p,r=>r.cycle.postWidget.callerESP=0)]]){
  const p=structuredClone(proof);mutate(p);assert.equal(api.joinCaptureTransaction(p.nativeReport,p.hostReport,p.capture).status,'unknown',name);negatives.push(name);
 }
 assert.equal(runtime.diagnosticScene(Buffer.from('wrong pixels'),'unknown',results.at(-1).observation),'unknown');
 const foreignPNG=Buffer.from('different capture with a copied proof');
 assert.equal(runtime.diagnosticScene(foreignPNG,'unknown',{...results.at(-1).observation,sha256:hash(foreignPNG)}),'unknown','outer digest cannot rebind an old proof');
 assert.equal(runtime.diagnosticScene(await page.screenshot(),'unknown',{...results.at(-1).observation,name:'foreign'}),'unknown');
 const stopped={pc:e.get_eip()>>>0,esp:e.get_esp()>>>0};executeDuringScreenshot=true;
 const concurrent=await shot('native-executed-during-capture');executeDuringScreenshot=false;
 assert.deepEqual({pc:e.get_eip()>>>0,esp:e.get_esp()>>>0},stopped,'same PC/ESP does not prove no execution');
 assert.equal(concurrent.nativeObservation.status,'unknown');
 assert.equal(runtime.diagnosticScene(concurrent.png,'unknown',concurrent.nativeObservation),'unknown');negatives.push('actual-native-execution-during-PNG-with-same-PC-ESP');
 // Leave the in-progress pass through its actual RETs and the pinned second
 // widget/presentation CALLs. Completion alone still grants no readiness.
 u(0x580400,2);e.run(64);assert.equal(e.get_eip()>>>0,0x576e35);
 const completed=native.nativeReceipt();assert.equal(completed.status,'cycle-completed');
 assert(completed.cycle.widget3.returned);assert(completed.cycle.presentation.returned);
 assert.equal(completed.native.entries.length,0);assert.equal(completed.readinessGranted,false);assert.equal(completed.pixelsAccepted,false);
 // The actual lifetime check, beyond offline record mutations.
 const token=await controller.captureToken();host.dx_trace(22,slot);host.dx_trace(21,slot,2);
 await assert.rejects(controller.capture(token,'a'.repeat(64),'reallocated'),/replaced capture copy/);
 await controller.finish('fixture-complete');await attachment.finish('fixture-complete');
 const lifetimeNegatives=[];
 const nativeBinding={nativeEpoch,exeSha256:api.EXE_SHA256,wasmSha256,workerURL,workerSlot:0,endpointIdentity:1};
 function lifetime(name,mutate){
  const observation=api.hostPresentationFactory().attach({getHost:()=>wine,epoch,nativeBinding,deadline:performance.now()+10000});
  host.dx_trace(5,slot);assert.equal(wine._presentNow(),1);
  const before=observation.token();assert(before.copyGeneration,name+' has a prior actual publication');
  const restore=mutate();observation.capture(before,'b'.repeat(64),name);
  assert(observation.report.status!=='running'||observation.report.records.at(-1).copyCurrent!==true,name+' rejected');
  const first=observation.report.fault;restore?.();observation.check();assert.equal(observation.report.fault,first,'no revival after restoration');
  lifetimeNegatives.push({name,status:observation.report.status,fault:first});observation.finish('negative-complete');
 }
 const replace=(object,key,value)=>{const prior=object[key];object[key]=value;return()=>object[key]=prior;};
 lifetime('same-sized-layer',()=>replace(renderer.windows[hwnd],'_dxFrameLayer',{...renderer.windows[hwnd]._dxFrameLayer}));
 lifetime('window-replaced',()=>replace(renderer.windows,hwnd,{...renderer.windows[hwnd]}));
 lifetime('window-hidden',()=>replace(renderer.windows[hwnd],'visible',false));
 lifetime('instance-replaced',()=>replace(wine,'instance',{}));
 lifetime('process-replaced',()=>replace(wine,'processId',8));
 lifetime('memory-replaced',()=>replace(wine,'memory',{buffer:memory.buffer}));
 lifetime('broker-replaced',()=>replace(wine.guestWorker,'broker',{}));
 lifetime('guest-replaced',()=>replace(wine,'guestWorker',{...wine.guestWorker}));
 lifetime('link-replaced',()=>replace(wine.guestWorker,'link',{...link}));
 lifetime('worker-replaced',()=>replace(link,'worker',{}));
 lifetime('module-replaced',()=>replace(wine.guestWorker,'module',{}));
 lifetime('endpoint-replaced',()=>replace(link,'endpointIdentity',2));
 lifetime('foreign-worker-url',()=>replace(link,'workerUrl','http://foreign/lib/guest-worker.js'));
 lifetime('destination-written',()=>{renderer.windows[hwnd]._dxFrameLayer.canvas.getContext('2d').fillRect(0,0,1,1);});
 lifetime('same-width-canvas-reset',()=>{const c=renderer.windows[hwnd]._dxFrameLayer.canvas;c.width=c.width;});
 lifetime('output-written',()=>{renderer.presentationCanvas.getContext('2d').fillRect(0,0,1,1);});
 lifetime('output-reset',()=>{renderer.presentationCanvas.width=renderer.presentationCanvas.width;});
 lifetime('filter-replaced',()=>replace(renderer,'presentationFilter',Object.create(renderer.presentationFilter)));
 lifetime('source-storage-replaced',()=>{dv.setUint32(entry+20,bits+2,true);return()=>dv.setUint32(entry+20,bits,true);});
 lifetime('primary-role-replaced',()=>{dv.setUint32(entry+28,4,true);return()=>dv.setUint32(entry+28,1,true);});
 lifetime('source-reallocated',()=>{host.dx_trace(22,slot);host.dx_trace(21,slot,2);});
 lifetime('new-copy-after-token',()=>{host.dx_trace(5,slot);wine._presentNow();});
 lifetime('repaint-method-replaced',()=>replace(renderer,'repaint',()=>{}));
 lifetime('failed-publication',()=>{
  const filter=renderer.presentationFilter,original=filter.present;filter.present=()=>false;
  try{renderer.repaint();}catch(error){assert.match(error.message,/returned false/);}
  return()=>filter.present=original;
 });
 const stale=api.hostPresentationFactory().attach({getHost:()=>wine,epoch,nativeBinding,deadline:performance.now()+10000});
 renderer.repaint();const staleToken=stale.token();assert.equal(staleToken.copyGeneration,null,'unobserved earlier layer is not a new copy');
 stale.capture(staleToken,'c'.repeat(64),'old-canonical-only');assert.equal(stale.report.records.at(-1).copyCurrent,false);stale.finish();
 for(const [name,limits]of [['record-cap',{maxRecords:1}],['byte-cap',{maxBytes:1}]]){
  const capped=api.hostPresentationFactory().attach({getHost:()=>wine,epoch,nativeBinding,deadline:performance.now()+10000,...limits});
  host.dx_trace(5,slot);wine._presentNow();assert.equal(capped.report.status,'unsupported-or-unobservable');assert.match(capped.report.fault,/overflow/);
  lifetimeNegatives.push({name,status:capped.report.status,fault:capped.report.fault});capped.finish();
 }
 return {variant,moduleSHA256:wasmSha256,results,finalMemorySHA256,blocks,completed,negatives,lifetimeNegatives,savedReports:saved.length,originalExecution:false,browserExecution:false};
}

async function coverageFixture(variant,negative='valid'){
 const {bootRenderHarness}=require('./render-helper'),{g2w}=require('../lib/mem-utils');
 const loader=require('../lib/dll-loader'),{pe,BASE}=require('./test-dll-lifecycle-real-pe');
 const bytes=fs.readFileSync('build/'+variant),module=await WebAssembly.compile(bytes),wasmSha256=hash(bytes);
 const workerURL='http://fixture/lib/guest-worker.js?v=coverage',targetId='coverage',sessionId='fixture';
 const instantiate=WebAssembly.instantiate,listeners=[];
 globalThis.location={href:workerURL};globalThis.memUtils={g2w};
 globalThis.__mdk2Observe={events:[]};globalThis.addEventListener=(name,fn)=>{assert.equal(name,'message');listeners.push(fn);};
 const source=api.workerSource({observeSource:'',options:{targetId,sessionId,expectedWorkerURL:workerURL,
  exeSha256:api.EXE_SHA256,wasmSha256,deadlineEpochMs:Date.now()+30000}});
 // No seam replacement or nativeEpoch disabling: execute the actual serialized
 // owning-worker installer used by the selected composed runtime.
 vm.runInThisContext(source);
 const h=await bootRenderHarness({prebuiltModule:module,fonts:'none',beforeInstantiate(ctx,host){
  globalThis.__mdk2Observe.events.push({kind:'received-module',type:'init',slot:0});
  for(const fn of listeners)fn({data:{t:'init',module,memory:host.memory,slot:0,endpointIdentity:1}});
 }});
 globalThis.__mdk2Observe.events.push({kind:'instantiated',incoming:{type:'init',slot:0}});
 const installed=globalThis.__strongholdPresetAttachment,initial=installed.report();
 assert(initial.installedBeforeInstantiation);assert.equal(initial.entryError,null);
 const nativeEpoch=initial.report.nativeEpoch;assert(nativeEpoch);
 const e=h.exports,b=new Uint8Array(h.memory.buffer),d=new DataView(h.memory.buffer),wa=a=>g2w(a,BASE,h.memory);
 const exe=fs.readFileSync(EXE);assert.equal(hash(exe),api.EXE_SHA256);b.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);
 // Synthetic caller and WndProc use the actual original's native import slots.
 // Every original observer pin remains unchanged; original entry is never run.
 const wc=Buffer.alloc(40);wc.writeUInt32LE(0x580800,4);wc.writeUInt32LE(0x580b00,36);b.set(wc,wa(0x580a00));b.set(Buffer.from('coverage-window\0'),wa(0x580b00));
 b.set([0xb8,1,0,0,0,0xc2,16,0],wa(0x580800));
 const code=[0x68,...u32bytes(0x580a00),0xff,0x15,...u32bytes(0x584160)];
 for(const n of [0,BASE,0,0,100,100,0,0,0,0x580b00,0x580b00,0])code.push(0x68,...u32bytes(n));
 code.push(0xff,0x15,...u32bytes(0x58415c),0xeb,0xfe);b.set(code,wa(0x580000));
 e.invalidate_code_range(0x580000,0x1000);e.set_eip(0x580000);e.set_esp(0x7408000);
 loader.loadDll(e,h.memory.buffer,pe([[0x1000,[0xb8,1,0,0,0,0xc2,12,0]]],true),'coverage-decoy.dll');
 const mapped=loader.loadDll(e,h.memory.buffer,pe([[0x1000,[0xb8,1,0,0,0,0xc2,12,0]]],true),'coverage-fixture.dll');
 assert(mapped.index>0,'exercise exact nonzero DLL row identity');
 const saved={pc:e.get_eip()>>>0,esp:e.get_esp()>>>0};let setupSetters=0;
 const facade={...e,set_eip(...a){setupSetters++;return e.set_eip(...a);},set_esp(...a){setupSetters++;return e.set_esp(...a);}};
 if(negative==='legacy-loader')facade.pending_context_callback_version=undefined;
 const outcome=loader.callDllMain(facade,mapped.loadAddr,mapped.dllMain,null,{requireCompletion:true,strictReturn:true});
 assert(outcome.completed);assert.equal(setupSetters,negative==='legacy-loader'?4:0,'only old loader wiring uses EIP/ESP setters');
 assert.equal(e.get_eip()>>>0,saved.pc);assert.equal(e.get_esp()>>>0,saved.esp);
 assert.equal(e.pending_context_status(nativeEpoch),negative==='legacy-loader'?0:1);assert.equal(e.pending_context_depth(),0);
 assert.equal(e.pending_context_callback_entries(),negative==='legacy-loader'?0:1);assert.equal(e.pending_context_callback_returns(),negative==='legacy-loader'?0:1);
 if(negative==='legacy-loader'){assert.equal(e.pending_context_reason(),5);}
 else if(['wrong-token','generation','unfinished','token-replay'].includes(negative)){
  const token=e.pending_context_loader_begin(nativeEpoch,mapped.loadAddr,mapped.dllMain,1,0);assert(token);
  if(negative==='generation')d.setUint32(e.get_dll_lifecycle_table()+mapped.index*e.get_dll_lifecycle_stride()+4,mapped.generation+1,true);
  if(negative==='token-replay'){
   e.run(32);assert.equal(e.pending_context_loader_finish(token,1),1);assert.equal(e.pending_context_status(nativeEpoch),1);
  }
  const result=e.pending_context_loader_finish(negative==='wrong-token'?token+1n:token,negative==='unfinished'?1:0);
  assert.equal(result,negative==='unfinished'?1:0);assert.equal(e.pending_context_status(nativeEpoch),0);
 }else{
  // Trace only to corrupt a generated fixture callback for the wrong-RET
  // negative. Normal setup uses the same production native dispatcher.
  if(negative==='wrong-return'){
   e.set_bp(0x580800);e.run(256);assert.equal(e.get_eip()>>>0,0x580800);
   d.setUint32(wa(e.get_esp()>>>0),0x580000,true);e.clear_bp();e.run(1);
   assert.equal(e.pending_context_reason(),4);
  }else{
   if(negative==='valid'){
    e.set_bp(0x580800);e.run(256);assert.equal(e.get_eip()>>>0,0x580800);
    assert.equal(e.pending_context_status(nativeEpoch),1);assert.equal(e.pending_context_depth(),1);
    assert.equal(e.pending_context_entry(0,0)>>>0,0x580800);assert.equal(e.pending_context_entry(0,2)>>>0,e.get_esp()>>>0);
    assert.equal(e.pending_context_callback_entries(),2);assert.equal(e.pending_context_callback_returns(),1);e.clear_bp();
   }
   e.run(256);assert.equal(e.get_eax()>>>0,65537);assert.equal(e.pending_context_status(nativeEpoch),1);
  }
 }
 let exports=e;
 if(negative==='wrong-profile')exports={...e,pending_context_profile:()=>1};
 if(negative==='wrong-image')exports={...e,pending_context_image_base:()=>0x500000};
 if(negative==='wrong-epoch')exports={...e,pending_context_epoch:()=>nativeEpoch+1};
 if(negative==='absence')exports={...e,pending_context_callback_version:undefined};
 if(negative==='lifetime'){const token=e.com_callback_enter();e.com_callback_leave(token);assert.equal(e.pending_context_status(nativeEpoch),0);}
 if(['process','root'].includes(negative)){
  const ctx={getMemory:()=>h.memory.buffer},imports=require('../lib/host-imports').createHostImports(ctx);imports.host.memory=h.memory;
  const other=await Reflect.apply(instantiate,WebAssembly,[module,imports]);ctx.exports=other.exports;
  if(negative==='root')other.exports.init_thread(0,e.get_image_base(),0,0,0,0,0,0);
  else{b.set(exe,other.exports.get_staging());other.exports.load_pe(exe.length);}
  assert.equal(e.get_current_thread_id(),1);assert.equal(e.pending_context_status(nativeEpoch),0);assert.equal(e.pending_context_reason(),2);
 }
 if(negative==='native-epoch')assert.equal(e.pending_context_status(nativeEpoch+1),0);
 if(negative==='rearm')assert.equal(e.pending_context_arm_profile(nativeEpoch,2,BASE),0);
 const cycle=api.cycleFactory({getExports:()=>exports,u32:a=>d.getUint32(wa(a),true),nativeEpoch,emit(){}});
 const native=installed.report().report;
 const session={async send(method,args){assert.equal(method,'Runtime.evaluate');
  return {result:{value:vm.runInThisContext(args.expression)}};
 }};
 const sessions=new Map([[targetId,{session,sessionId,info:{url:workerURL},expectedWorkerURL:workerURL,preloadVerified:true}]]);
 const attachment=api.createAttachment({sessions,wasmSha256,pageState:async()=>({main:{href:'http://fixture/',observation:{events:[{kind:'compiled',sha256:wasmSha256},{kind:'sent-module',sha256:wasmSha256,workerURL,slot:0,type:'init'}]}}}),save(){},log(){},validateAck(){}});
 let receipt;
 if(negative==='valid'){
  receipt=cycle.snapshot(true);assert.equal(receipt.callbackHistory.entries,3);assert.equal(receipt.callbackHistory.returns,3);assert.equal(receipt.entries.length,0);
  await attachment.begin({action:'route-gesture'},11);assert(attachment.active);
  await attachment.capture('offline-before-DOWN',hash(Buffer.from('offline identity only')),{main:{tick:{steps:0}}});
  assert.equal(native.status,'running');
  assert.equal(cycle.receipt().status,'unknown','startup coverage never grants whole-cycle readiness');
  await attachment.finish('offline-prerequisite-complete');
 }else{
  assert.throws(()=>cycle.snapshot(true),/coverage/);
  // Native-invalid cases must also fail the actual selected begin boundary.
  if(!['wrong-profile','wrong-image','wrong-epoch','absence'].includes(negative)){
   await attachment.begin({action:'route-gesture'},11);
   await assert.rejects(attachment.capture('offline-before-DOWN',hash(Buffer.from('offline identity only')),{main:{tick:{steps:0}}}),/coverage|terminal/);
   const first=native.fault;assert(first);assert.equal(native.coverageFailure.actual.reason,e.pending_context_reason());
   const failure=structuredClone(native.coverageFailure);assert.throws(()=>installed.invoke('check',{}),/terminal/);assert.equal(native.fault,first);assert.deepEqual(native.coverageFailure,failure);
  }
 }
 const reason=e.pending_context_reason();
 if(reason){assert.equal(e.pending_context_arm_profile(nativeEpoch,2,BASE),0);assert.equal(e.pending_context_status(nativeEpoch+1),0);assert.equal(e.pending_context_reason(),reason,'first native failure survives rearm and foreign epoch query');}
 installed.invoke('finish',{reason:'offline-fixture-complete'});
 return {variant,coveragePrerequisite:true,negative,reason,receipt,moduleSHA256:wasmSha256,exe:{path:EXE,sha256:hash(exe)},
  loaderCompleted:outcome.completed,setupSetters,unmodifiedWorkerSourceSHA256:hash(source),preInstantiationBinding:true,originalEntryExecuted:false,readinessGranted:false,pixelsAccepted:false,gameplay:false};
}
function u32bytes(n){return [n&255,n>>>8&255,n>>>16&255,n>>>24&255];}

async function parent(){
 const results=[];
 for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm'])for(const mode of ['native','profile','composed','route-control','route',...['valid','legacy-loader','wrong-profile','wrong-image','wrong-epoch','absence','lifetime','process','root','native-epoch','rearm','wrong-return','wrong-token','generation','unfinished','token-replay'].map(n=>'coverage:'+n)]){
  results.push(await new Promise((resolve,reject)=>{const w=new Worker(__filename,{workerData:{variant,mode}});let result;
   w.on('message',m=>result=m);w.on('error',reject);w.on('exit',code=>code===0&&result?resolve(result):reject(Error('fixture exit '+code)));
  }));console.log('PASS',variant,mode);
 }
 for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
  const control=results.find(r=>r.variant===variant&&r.control),observed=results.find(r=>r.variant===variant&&r.savedReports);
  const snapshots=r=>r.results.map(({observation,...snapshot})=>snapshot);
  assert.deepEqual(snapshots(observed),snapshots(control),'complete route observer preserves native registers, pixels and ordinary publications');
  assert.equal(observed.finalMemorySHA256,control.finalMemorySHA256,'full native memory parity');assert.equal(observed.blocks,control.blocks);
 }
 const run=process.env.STRONGHOLD_COPY_RUN;
 if(run)fs.writeFileSync(path.join(run,'focused-result.json'),JSON.stringify({results,originalExecution:false,browserExecution:false,readinessGranted:false,pixelsAccepted:false},null,2)+'\n');
}
if(isMainThread)parent().catch(e=>{console.error(e.stack);process.exitCode=1;});
else (async()=>parentPort.postMessage(workerData.mode.startsWith('coverage:')?await coverageFixture(workerData.variant,workerData.mode.slice(9)):workerData.mode==='native'?await nativeFixture(workerData.variant):workerData.mode==='profile'?await profileFixture(workerData.variant):workerData.mode.startsWith('route')?await routeFixture(workerData.variant,workerData.mode==='route'):await composedFixture(workerData.variant)))().catch(e=>{console.error(e.stack);process.exitCode=1;});
