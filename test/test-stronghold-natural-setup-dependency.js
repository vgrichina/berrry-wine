'use strict';
// Diagnostic dependency contract: no application, browser or live route run.
async function inputGate(){
'use strict';
// Bounded native instruction fragments, synthetic data and callee only.
// No original process/main-loop/game/browser execution.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=require('node:path').resolve(__dirname,'..'),{bootRenderHarness}=require(ROOT+'/test/render-helper'),{g2w}=require(ROOT+'/lib/mem-utils');
const EXE='test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe',exe=fs.readFileSync(EXE);
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),le=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255];
assert.equal(hash(exe),'9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f');
const results=[];for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm']){
 const bytes=fs.readFileSync('build/'+variant),h=await bootRenderHarness({prebuiltModule:await WebAssembly.compile(bytes),fonts:'none',width:8,height:8}),e=h.exports,b=new Uint8Array(h.memory.buffer),dv=new DataView(b.buffer),wa=a=>g2w(a,0x400000,h.memory),put=(a,v)=>b.set(v,wa(a)),u=(a,v)=>dv.setUint32(wa(a),v>>>0,true),get=a=>dv.getUint32(wa(a),true);
 b.set(exe,e.get_staging());assert(e.load_pe(exe.length));e.set_api_log(0);e.set_stack_fusion(0);e.set_uop(0);
 const gate=Buffer.from(b.subarray(wa(0x576b9a),wa(0x576bc5))),reset=Buffer.from(b.subarray(wa(0x576c51),wa(0x576c5c))),counter=0x580000,owner=counter+4;
 assert.equal(gate.toString('hex'),'391d9446fb007510391db4e4ef007508391db038d1007408391da431a401740b8b0d8c975001e82b2af7ff');
 assert.equal(reset.toString('hex'),'a1c037d100891db038d100');
 // Only the dependency's body and successors are synthetic. Both tested
 // original windows remain byte-identical throughout all cases.
 put(0x4e95f0,[0xff,0x05,...le(counter),0x89,0x0d,...le(owner),0xc3]);put(0x576bc5,[0xeb,0xfe]);put(0x576c5c,[0xeb,0xfe]);e.invalidate_code_range(0x400000,0x180000);
 // Current v1 ledger has a fixed MDK2 target profile. A real Stronghold
 // manager CALL remains outside it; depth zero cannot certify this pass.
 assert.equal(e.pending_context_version(),1);
 for(const a of [0xfb4694,0xefe4b4,0xd138b0,0x1a431a4])u(a,0);u(0x150978c,0x692f48);
 put(0x4e95f0,[0xeb,0xfe]);e.invalidate_code_range(0x4e95f0,16);
 e.set_ebx(0);e.set_esp(0x7408000);e.set_eip(0x576b9a);assert.equal(e.pending_context_arm(17),1);e.run(32);
 assert.equal(e.get_eip()>>>0,0x4e95f0);assert.equal(e.pending_context_status(17),1);assert.equal(e.pending_context_depth(),0);
 const missingManagerCoverage={pc:e.get_eip()>>>0,valid:e.pending_context_status(17),depth:e.pending_context_depth(),meaning:'Actual Stronghold manager CALL active but outside MDK2 target set; never Stronghold absence proof'};
 put(0x4e95f0,[0xff,0x05,...le(counter),0x89,0x0d,...le(owner),0xc3]);e.invalidate_code_range(0x4e95f0,16);
 const cases=[];
 for(let bits=0;bits<16;bits++)for(const fade of [0,32]){
  const [first,second,suppress,alternate]=[0,1,2,3].map(k=>bits>>>k&1);
  for(const [a,v]of [[0xfb4694,first],[0xefe4b4,second],[0xd138b0,suppress],[0x1a431a4,alternate],[0x692e18,fade],[0x150978c,0x692f48],[counter,0],[owner,0]])u(a,v);
  e.set_ebx(0);e.set_ecx(0);e.set_esp(0x7408000);e.set_eip(0x576b9a);e.run(32);assert.equal(e.get_eip()>>>0,0x576bc5);
  const expected=(!first&&!second&&!suppress)||!!alternate;
  assert.equal(get(counter),Number(expected));assert.equal(get(owner),expected?0x692f48:0);assert.equal(get(0xd138b0),suppress);assert.equal(get(0x692e18),fade);
  cases.push({first,second,suppress,alternate,fade,calls:get(counter),manager:get(owner)});
 }
 // Original reset is a separate executed operation; fade-zero by itself did
 // not admit the preceding suppressed gate case.
 u(0xd138b0,1);u(0xd137c0,20);e.set_ebx(0);e.set_eip(0x576c51);e.run(4);assert.equal(e.get_eip()>>>0,0x576c5c);assert.equal(get(0xd138b0),0);
 assert.deepEqual(Buffer.from(b.subarray(wa(0x576b9a),wa(0x576bc5))),gate);assert.deepEqual(Buffer.from(b.subarray(wa(0x576c51),wa(0x576c5c))),reset);
 results.push({variant,wasmSHA256:hash(bytes),gateSHA256:hash(gate),resetSHA256:hash(reset),missingManagerCoverage,cases,resetExecuted:true});console.log('PASS intact original input gate 32 discriminating cases and separate suppression reset',variant);
 }return {passed:true,synthetic:true,originalExecution:false,exe:{path:EXE,sha256:hash(exe)},results};

}

async function composedFallback(){
'use strict';
// Synthetic host pixels/surface/window; actual shipped module, host imports,
// renderer, canvas and production observer. No game/browser/guest EXE run.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const ROOT=require('node:path').resolve(__dirname,'..'),api=require(ROOT+'/tools/stronghold-owning-callback-observer.cjs');
const {bootRenderHarness}=require(ROOT+'/test/render-helper'),regions=require(ROOT+'/lib/region-map.generated');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),epoch='synthetic-fallback/fixture-session';
async function arm(variant,observe,backend){
 const bytes=fs.readFileSync(ROOT+'/build/'+variant),module=await WebAssembly.compile(bytes);
 const h=await bootRenderHarness({prebuiltModule:module,width:32,height:24,fonts:'none'}),{memory,renderer,instance}=h;let {host,gdi,hostCtx}=h;
 const native=instance.exports,raw=new Uint8Array(memory.buffer),fixturePE=fs.readFileSync(ROOT+'/test/binaries/notepad.exe');
 raw.set(fixturePE,native.get_staging());assert(native.load_pe(fixturePE.length));native.set_api_log(0);
 const hwnd=65537,slot=6,sid=0x200000+slot,guestBits=0x1800000,bits=native.guest_to_wasm(guestBits)>>>0,w=32,hh=24,pitch=w*2;
 // Synthetic fixture window/primary state; no application entry is executed.
 const real=instance.exports,facade={...real,get_main_hwnd:()=>hwnd,get_dx_present_hwnd:()=>hwnd,get_dx_scroll_hold_slot:()=>-1};
 const fixtureState=new DataView(memory.buffer);for(const [off,value]of [[0,w],[4,hh],[8,16],[12,1],[16,hwnd],[20,0]])fixtureState.setUint32(regions.BASE.DX_PROCESS_STATE+off,value,true);
 const vm=require('node:vm'),hostSource=fs.readFileSync(ROOT+'/host.js','utf8');
 const context={console,performance,setTimeout,clearTimeout,URLSearchParams,require:require('node:module').createRequire(ROOT+'/host.js'),createHostImports:require(ROOT+'/lib/host-imports').createHostImports};
 vm.runInNewContext(hostSource+'\n;globalThis.WineAssembly=WineAssembly;',context);
 const wine=new context.WineAssembly();Object.assign(wine,{memory,renderer,instance,processId:7,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}}});
 ({host,gdi}=wine.getImports({exports:facade,instance}));hostCtx=wine.hostCtx;host.memory=memory;wine._hostImports=host;
 renderer.wasm={exports:facade};
 renderer.windows[hwnd]={hwnd,x:0,y:0,w,h:hh,visible:true,zOrder:1,style:0x90000000,exStyle:0,title:'synthetic retained primary',wasm:instance,wasmMemory:memory,processId:7};
 renderer.getWindowCanvas(hwnd);
 const dv=new DataView(memory.buffer),b=new Uint8Array(memory.buffer),entry=regions.BASE.DX_OBJECTS+slot*32;
 dv.setUint32(entry,2,true);dv.setUint16(entry+12,w,true);dv.setUint16(entry+14,hh,true);dv.setUint16(entry+16,16,true);dv.setUint16(entry+18,pitch,true);dv.setUint32(entry+20,bits,true);dv.setUint32(entry+28,1,true);
 const le=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255],codePC=0x580000,paintPrograms=[];
 function paint(value,count=w*hh,offset=0){
  // Synthetic REP STOSW executes in the actual shipped native core, then
  // parks at its own stop. No application entry point is executed.
  const program=Buffer.from([0x66,0xb8,value&255,value>>>8,0xbf,...le(guestBits+offset*2),0xb9,...le(count),0xf3,0x66,0xab,0xeb,0xfe]);
  b.set(program,native.guest_to_wasm(codePC)>>>0);native.invalidate_code_range(codePC,program.length);
  native.set_esp(0x7408000);native.set_eip(codePC);native.run(4096);
  assert.equal(native.get_eip()>>>0,codePC+program.length-2);assert.equal(native.get_ecx()>>>0,0);
  paintPrograms.push({value,count,offset,sha256:hash(program)});
 }
 const broker={serveCall(msg){return host[msg.name](...msg.args);}};
 const owner=wine;wine.guestWorker={broker};
 const observation=observe?api.hostPresentationFactory().attach({getHost:()=>owner,epoch,deadline:performance.now()+10000}):null;
 const win=renderer.windows[hwnd],captures=[];
 function snapshot(label){const p=win._dxFrameLayer;return {label,canonicalVersion:gdi.surfacePresentations.get(sid)?.version,canonical:p?.canvas===gdi.surfacePresentations.get(sid)?.canvas,layerRGBA:p?Array.from(p.canvas.getContext('2d').getImageData(0,0,1,1).data):null,layerLastRGBA:p?Array.from(p.canvas.getContext('2d').getImageData(w-1,hh-1,1,1).data):null,layerPixels:p?hash(p.canvas.getContext('2d').getImageData(0,0,w,hh).data):null,screenPixels:hash(renderer.canvas.getContext('2d').getImageData(0,0,w,hh).data),publication:renderer._immutablePublicationSequence??0};}
 // Canonical surface is explicitly created/attached as a separate real path.
 paint(0xf800);assert.equal(broker.serveCall({slot:0,name:'gdi_surface_create',args:[sid,w,hh,16,bits,pitch,1,0,0,0xf800,0x07e0,0x001f]}),1);
 assert.equal(broker.serveCall({slot:0,name:'gdi_surface_attach',args:[sid,hwnd]}),1);
 assert.equal(broker.serveCall({slot:0,name:'gdi_surface_upload',args:[sid,0,0,w,hh]}),1);
 renderer.repaint();
 const canonicalMembers=observation?.report.records.filter(r=>r.kind==='renderer-completed').flatMap(r=>r.draws).length??null;
 if(observation)assert(canonicalMembers>0,'independent canonical positive through production CanvasSurface/renderer');
 const fallbackStart=observation?.report.sequence??0;fixtureState.setUint32(regions.BASE.DX_PROCESS_STATE+20,backend==='exclusive'?1:0,true);
 assert.equal(native.get_dx_exclusive_hwnd()>>>0,backend==='exclusive'?hwnd:0);
 host.dx_trace(5,slot);
 assert.equal(wine._presentNow(),1);captures.push(snapshot('red-primary'));
 host.dx_trace(1,slot);paint(0x001f,w*hh/2);host.dx_trace(5,slot);
 assert.equal(wine._presentNow(),0);assert.equal(wine._presentNow(),0);assert.equal(wine._presentNow(),1);assert.equal(wine._dxLockHeld,3);captures.push(snapshot('partial-native-write-after-real-retained-lock-policy'));
 paint(0x001f,w*hh/2,w*hh/2);host.dx_trace(2,slot);assert.equal(wine._presentNow(),1);captures.push(snapshot('blue-retained-write'));
 assert.deepEqual(captures[0].layerRGBA,[255,0,0,255]);assert.deepEqual(captures[1].layerRGBA,[0,0,255,255]);assert.deepEqual(captures[1].layerLastRGBA,[255,0,0,255]);assert.deepEqual(captures[2].layerLastRGBA,[0,0,255,255]);
 assert.notEqual(captures[1].layerPixels,captures[2].layerPixels);assert.notEqual(captures[1].screenPixels,captures[2].screenPixels);
 assert.notEqual(captures[0].layerPixels,captures[1].layerPixels,'actual fallback copies retained writes without a guest Blt');
 assert.notEqual(captures[0].screenPixels,captures[1].screenPixels,'normal renderer publishes changed fallback pixels');
 assert(captures.every(c=>c.canonicalVersion===captures[0].canonicalVersion),'fallback changes displayed native memory without advancing canonical upload version');
 assert(captures.every(c=>c.canonical===false),'fallback destination differs from canonical presentation canvas');
 if(observation){assert.equal(observation.report.fault,null,JSON.stringify(observation.report));
  const uploads=observation.report.records.filter(r=>r.kind==='host-upload-completed');assert.equal(uploads.length,1);assert(uploads.every(r=>r.owningMemory&&r.owningWindow&&r.attached&&r.directDraw));
  assert(observation.report.records.filter(r=>r.kind==='fallback-present-completed').length>=2);
  assert(observation.report.records.filter(r=>r.kind==='renderer-completed').length>=2);
  const fallbackRenders=observation.report.records.filter(r=>r.kind==='renderer-completed'&&r.sequence>fallbackStart);
  if(backend==='exclusive')assert(fallbackRenders.every(r=>r.draws.length===0),'exclusive fallback layer has no identified canonical members');
  else assert(fallbackRenders.some(r=>r.draws.length>0),'windowed canonical backing remains an independent positive');
  assert(fallbackRenders.flatMap(r=>r.draws).every(r=>r.canvas===uploads[0].canvas&&r.version===uploads[0].version),'any identified members name the old canonical upload, not the actual fallback layer');
  assert(observation.report.records.filter(r=>r.kind==='fallback-present-completed').every(r=>r.surfaceRelation===null));
  assert.equal(observation.report.operationRelation,null);assert.equal(observation.report.pixelsAccepted,false);assert.equal(observation.report.readinessGranted,false);observation.finish('synthetic-dependency-inspected');}
 return {variant,backend,canonicalMembers,wasmSHA256:hash(bytes),hostSourceSHA256:hash(hostSource),actualWineAssemblyPresentNow:true,actualRetainedLockPolicy:true,fixturePE:{path:'test/binaries/notepad.exe',sha256:hash(fixturePE),applicationEntryExecuted:false},paintPrograms,captures,host:observation?.report??null,substitutions:'Synthetic surface table, native REP STOSW paint program, window, presentation-HWND getter facade and DirectDraw process/surface state; actual module/WineAssembly.getImports/_presentNow/dirty-lock-policy/host-imports/renderer/observer; synthetic broker, PE loaded for address mapping, no application/game/browser execution'};
}
const results=[];for(const variant of ['wine-assembly.wasm','wine-assembly.compat.wasm'])for(const backend of ['windowed','exclusive']){const control=await arm(variant,false,backend),observed=await arm(variant,true,backend);assert.deepEqual(control.captures,observed.captures,'observer preserves actual composed results');results.push({variant,backend,control,observed});console.log('PASS actual native writes and composed host fallback; layer relation absent, observer transparent',variant,backend);}return {passed:true,synthetic:true,originalExecution:false,browserExecution:false,results};

}

(async()=>{const result={inputGate:await inputGate(),composedFallback:await composedFallback()};if(process.env.STRONGHOLD_DEPENDENCY_RESULT)require('node:fs').writeFileSync(process.env.STRONGHOLD_DEPENDENCY_RESULT,JSON.stringify(result,null,2)+'\n');})().catch(error=>{console.error(error.stack);process.exitCode=1;});
