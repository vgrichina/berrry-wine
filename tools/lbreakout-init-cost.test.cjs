'use strict';
// Isolated original board-background work, through original SDL and CRT.
// No browser, copied implementation, substituted blitter, or altered module.
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),vm=require('node:vm'),crypto=require('node:crypto');
const root=require('node:path').resolve(__dirname,'..');
const source=cp.execFileSync('python3',['-c',"import importlib.util;s=importlib.util.spec_from_file_location('h','tools/lbreakout-case-inspection.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h);print(h.level_start_driver_source())"],{cwd:root,encoding:'utf8'});
const context={setTimeout,clearTimeout,Date,DataView};vm.createContext(context);vm.runInContext(source+';globalThis.create=createLevelStartDriver',context);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const wasm=fs.readFileSync(root+'/build/wine-assembly.wasm'),module=await WebAssembly.compile(wasm);
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer,renderer:null,resourceJson:{}};
 const imports=require(root+'/lib/host-imports').createHostImports(ctx);imports.host.memory=memory;
 let hits=0;imports.host.log_eip=()=>hits++;
 for(const x of WebAssembly.Module.imports(module))if(x.kind==='function'&&!imports.host[x.name])imports.host[x.name]=()=>{throw Error('unexpected import '+x.name)};
 const e=(await WebAssembly.instantiate(module,imports)).exports;ctx.exports=e;
 const b=new Uint8Array(memory.buffer),v=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0,w=(p,n)=>v.setUint32(wa(p),n>>>0,true);
 const pe=fs.readFileSync(root+'/test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/lbreakout2.exe');
 assert.equal(sha(pe),'cc1fd5c3d229cc1d4f910e658f5abefa80ef8ebf4b5e47801648f0be0e1ca244');
 b.set(pe,e.get_staging());assert(e.load_pe(pe.length));
 const loader=require(root+'/lib/dll-loader');
 const dlls=['SDL.dll','msvcrt.dll'].map(name=>({name,bytes:fs.readFileSync(root+(name==='SDL.dll'?'/test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/SDL.dll':'/test/binaries/dlls/msvcrt.dll'))}));
 const loaded=loader.loadDlls(e,memory.buffer,pe,dlls,()=>{}),sdl=loaded[0].loadAddr;
 const levelBytes=fs.readFileSync(root+'/test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/levels/LBreakout2');
 ctx.vfs.files.set('c:\\levels\\lbreakout2',{data:new Uint8Array(levelBytes),attrs:0x20});
 const stack=e.guest_alloc(65536)+65000;
 const call=(driver,pc,args=[])=>{
  e.set_esp(stack);e.call_func(pc,...Array.from({length:4},(_,i)=>args[i]||0));const esp=e.get_esp()>>>0;
  for(let i=4;i<args.length;i++)w(esp+4+i*4,args[i]);
  let rounds=0,total=0;
  while(e.get_eip()){
   driver.run(10000);total+=driver.get_last_run_blocks();
   assert.equal(e.get_yield_reason(),0,'no substituted services or yields');assert(++rounds<10000,'bounded original return');
  }
  assert.equal(e.get_esp()>>>0,esp+4,'original cdecl return');return {result:e.get_eax()>>>0,blocks:total};
 };
 const create=loader._test.findDllExport(e,memory.buffer,sdl,'SDL_CreateRGBSurface');assert(create);
 const surface=(width,height)=>{const p=call(e,create,[0,width,height,32,0xff0000,0xff00,0xff,0xff000000]).result;assert(p);return p;};
 const tile=surface(32,32),board=surface(640,480),backing=surface(640,480),tiles=e.guest_alloc(4);
 const setAlpha=loader._test.findDllExport(e,memory.buffer,sdl,'SDL_SetAlpha');
 for(const p of [tile,board,backing])assert.equal(call(e,setAlpha,[p,0,255]).result,0);
 w(tiles,tile);w(0x4522d0,tiles);w(0x4522d4,1);w(0x4523c4,backing);
 const tilePixels=v.getUint32(wa(tile+20),true),boardPixels=v.getUint32(wa(board+20),true),backingPixels=v.getUint32(wa(backing+20),true);
 new Uint32Array(memory.buffer,wa(tilePixels),32*32).fill(0xff125a9c);
 const records=[];let observed=[];
 const driver=context.create(e,pc=>{observed.push({pc,esp:e.get_esp()>>>0});driver.trace(0,0,0);});
 assert.equal(driver.exports.run,e.run,'unarmed run is exactly the native function');
 assert.equal(driver.exports.get_last_run_blocks,e.get_last_run_blocks,'unarmed metrics are native');
 // First run primes SDL's real blit map. Timings below compare the same
 // original bkgnd_draw -> stk_surface_blit -> SDL_UpperBlit -> software blit.
 call(e,0x406990,[board,0]);
 for(let pair=0;pair<5;pair++)for(const mode of (pair%2?['target','trace','off']:['off','trace','target'])){
  new Uint32Array(memory.buffer,wa(boardPixels),640*480).fill(0);
  new Uint32Array(memory.buffer,wa(backingPixels),640*480).fill(0);
  const before=hits;
  if(mode==='trace')e.set_trace_eip_range(1,0x41f2ac,0x41f2ad);
  if(mode==='target')driver.trace(1,0x406a38,0x406a39);
  const tier=e.get_dbg_tier_guard(),start=performance.now();
  let result;
  for(let repeat=0;repeat<25;repeat++){
   if(mode==='target'&&repeat)driver.trace(1,0x406a38,0x406a39);
   result=call(mode==='target'?driver.exports:e,0x406990,[board,0]);
  }
  const elapsed=performance.now()-start;e.set_trace_eip_range(0,0,0);
  const pixels=new Uint32Array(memory.buffer,wa(backingPixels),640*480);
  assert(pixels.every(p=>(p&0xffffff)===0x125a9c),'all original tiles and final backing blit agree: '+Array.from(new Set(pixels)).slice(0,8).map(x=>x.toString(16)));
  assert.equal(e.get_bp_addr(),0);assert.equal(e.get_dbg_tier_guard(),0);
  records.push({pair,mode,ms:elapsed,tierGuard:tier,traceCallbacks:hits-before,blocks:result.blocks,output:sha(Buffer.from(pixels.buffer,pixels.byteOffset,pixels.byteLength))});
 }
 assert.equal(observed.length,125,'every target observed exactly once');
 // Moving targets must not lose the next hit to the old skip-once flag.
 const expected=[0x406990,0x406a1b,0x406a38,0x406a52],actual=[];
 const moving=context.create(e,pc=>{actual.push(pc);const next=expected[actual.length];moving.trace(next?1:0,next||0,next?next+1:0);});
 moving.trace(1,expected[0],expected[0]+1);call(moving.exports,0x406990,[board,0]);
 assert.deepEqual(actual,expected);assert.equal(e.get_bp_addr(),0);assert.equal(e.get_dbg_tier_guard(),0);
 call(moving.exports,0x406990,[board,0]);
 assert.equal(moving.exports.run,e.run,'ordinary execution restores the inert path');
 e.set_bp(0x406990);assert.throws(()=>moving.trace(1,0x406990,0x406991),/debugger conflict/);e.clear_bp();
 // Pause's actual full-screen surface_gray is outside every trace callback
 // range, but range tracing still disables fast tiers throughout its work.
 // Compare complete output and natural entry/return through original code.
 const grayRecords=[];
 for(let pair=0;pair<3;pair++)for(const mode of (pair%2?['target','trace','off']:['off','trace','target'])){
  new Uint32Array(memory.buffer,wa(boardPixels),640*480).fill(0xff125a9c);
  const points=[];
  const d=context.create(e,pc=>{points.push(pc);const next=points.length===1?0x426dd1:0;d.trace(next?1:0,next,next?next+1:0);});
  const before=hits;
  if(mode==='trace')e.set_trace_eip_range(1,0x41e406,0x41e878);
  if(mode==='target')d.trace(1,0x426bb0,0x426bb1);
  const tierGuard=e.get_dbg_tier_guard(),start=performance.now();
  const r=call(mode==='target'?d.exports:e,0x426bb0,[board,0,0,-1,-1,0]);
  const ms=performance.now()-start;e.set_trace_eip_range(0,0,0);
  const pixels=new Uint32Array(memory.buffer,wa(boardPixels),640*480);
  assert(pixels.every(p=>(p&0xffffff)===0x585858),'every original grayscale pixel');
  if(mode==='target')assert.deepEqual(points,[0x426bb0,0x426dd1]);
  assert.equal(tierGuard,mode==='trace'?1:0);
  assert.equal(e.get_bp_addr(),0);assert.equal(e.get_dbg_tier_guard(),0);
  grayRecords.push({pair,mode,ms,tierGuard,traceCallbacks:hits-before,blocks:r.blocks,output:sha(Buffer.from(pixels.buffer,pixels.byteOffset,pixels.byteLength))});
 }
 // The other substantial local-init task parses the complete original set
 // through original fopen/fgets/CRT, with the bytes already mounted in VFS as
 // they are in the registered app. Never replace file reads with a parser.
 const name=e.guest_alloc(32);b.set(Buffer.from('LBreakout2\0'),wa(name));
 const levelRecords=[];
 for(let pair=0;pair<3;pair++)for(const mode of (pair%2?['target','trace','off']:['off','trace','target'])){
  if(mode==='trace')e.set_trace_eip_range(1,0x41f2ac,0x41f2ad);
  const points=[];
  const d=context.create(e,pc=>{points.push(pc);d.trace(0,0,0);});
  if(mode==='target')d.trace(1,0x4381d1,0x4381d2);
  const start=performance.now(),parsed=call(mode==='target'?d.exports:e,0x438192,[name]);
  const ms=performance.now()-start;e.set_trace_eip_range(0,0,0);
  assert(parsed.result,'original levelset parsed');
  const count=v.getUint32(wa(parsed.result+20),true);assert.equal(count,25,'all original levels');
  if(mode==='target')assert.deepEqual(points,[0x4381d1]);
  levelRecords.push({pair,mode,ms,count,blocks:parsed.blocks});
 }
 // Execute the entire generated preload and its authentic media/loaded-image
 // validator against the same compiled instance, then disarm without input.
 const preload=cp.execFileSync('python3',['-c',"import importlib.util;s=importlib.util.spec_from_file_location('h','tools/lbreakout-case-inspection.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h);print(h.pause_completion_preload_source())"],{cwd:root,encoding:'utf8'});
 context.WebAssembly={instantiate:async()=>({instance:{exports:e},module})};
 context.LBreakoutInputObserver=require(root+'/lib/lbreakout-input-observer');
 context.fetch=async url=>({arrayBuffer:async()=>url.endsWith('SDL.dll')?dlls[0].bytes:pe});
 context.console={log(){}};
 vm.runInContext(preload,context);
 const wrapped=await context.WebAssembly.instantiate(module,imports);
 assert.equal(wrapped.instance.exports.run,e.run);
 const arm=await context.__lbArm({phase:'level-start',token:'offline-real-module',expected:8});
 assert(arm.armed&&arm.active);assert.equal(e.get_bp_addr(),0x41f2ac);assert.equal(e.get_dbg_tier_guard(),0);
 context.__lbObserver.stop('offline-validated');assert.equal(e.get_bp_addr(),0);
 assert.equal(wrapped.instance.exports.run,e.run);
 for(const expected of [20,8]){
  const pause=await context.__lbArm({phase:'pause',token:'offline-pause-'+expected,expected});
  assert(pause.armed&&pause.active);assert.equal(e.get_bp_addr(),sdl+0x19870);
  assert.equal(e.get_dbg_tier_guard(),0,'pause arm preserves fast execution');
  context.__lbObserver.stop('offline-validated');assert.equal(e.get_bp_addr(),0);
  assert.equal(wrapped.instance.exports.run,e.run);
 }
 const median=mode=>records.filter(r=>r.mode===mode).map(r=>r.ms).sort((a,b)=>a-b)[2];
 const result={passed:true,module:sha(wasm),exe:sha(pe),sdl:sha(dlls[0].bytes),crt:sha(dlls[1].bytes),levelset:sha(levelBytes),engine:process.version,scope:'25 actual original board-background calls per sample + original SDL/CRT, isolated surfaces; actual complete original levelset load; full-screen original pause grayscale; excludes other init and browser RPC',records,medianMs:{off:median('off'),trace:median('trace'),target:median('target')},grayRecords,levelRecords,targets:observed.length,movingTargets:actual};
 if(process.env.LB_COST_OUTPUT)fs.writeFileSync(process.env.LB_COST_OUTPUT,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
