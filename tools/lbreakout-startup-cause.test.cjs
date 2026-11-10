'use strict';
// Offline causal controls: actual original SDL fill and EXE display caller.
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),vm=require('node:vm'),crypto=require('node:crypto');
const root=require('node:path').resolve(__dirname,'..'),run=process.argv[2];assert(run);
const source=cp.execFileSync('python3',['-c',"import importlib.util;s=importlib.util.spec_from_file_location('h','tools/lbreakout-case-inspection.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h);print(h.level_start_driver_source());print(h.startup_completion_observer_source())"],{cwd:root,encoding:'utf8'});
const scope={setTimeout,clearTimeout,Date,DataView};vm.createContext(scope);vm.runInContext(source+';globalThis.create=createLevelStartDriver;globalThis.install=installStartupCompletion;',scope);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const bytes=fs.readFileSync(root+'/build/wine-assembly.wasm'),module=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer,renderer:null,resourceJson:{}},imports=require('../lib/host-imports').createHostImports(ctx);imports.host.memory=memory;
 for(const x of WebAssembly.Module.imports(module))if(x.kind==='function'&&!imports.host[x.name])imports.host[x.name]=()=>{throw Error('unexpected import '+x.name)};
 const native=(await WebAssembly.instantiate(module,imports)).exports;ctx.exports=native;
 const b=new Uint8Array(memory.buffer),v=new DataView(memory.buffer),wa=p=>native.guest_to_wasm(p)>>>0,w=(p,n)=>v.setUint32(wa(p),n>>>0,true),u=p=>v.getUint32(wa(p),true);
 const media=root+'/test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/',pe=fs.readFileSync(media+'lbreakout2.exe'),sdlBytes=fs.readFileSync(media+'SDL.dll');
 assert.equal(hash(pe),'cc1fd5c3d229cc1d4f910e658f5abefa80ef8ebf4b5e47801648f0be0e1ca244');assert.equal(hash(sdlBytes),'0b5aeef9054872cce11992679ad05a5bc96e5a4cfb515da8983e2e1f2ecbbbd8');
 b.set(pe,native.get_staging());assert(native.load_pe(pe.length));
 const loader=require('../lib/dll-loader'),loaded=loader.loadDlls(native,memory.buffer,pe,[{name:'SDL.dll',bytes:sdlBytes},{name:'msvcrt.dll',bytes:fs.readFileSync(root+'/test/binaries/dlls/msvcrt.dll')}],()=>{}),sdl=loaded[0].loadAddr;
 const stack=native.guest_alloc(65536)+65000;
 const start=(pc,args=[])=>{native.set_esp(stack);native.call_func(pc,...Array.from({length:4},(_,i)=>args[i]||0));const esp=native.get_esp()>>>0;for(let i=4;i<args.length;i++)w(esp+4+i*4,args[i]);return esp;};
 const call=(pc,args=[])=>{const esp=start(pc,args);for(let i=0;native.get_eip();i++){assert(i<20000);native.run(100);assert.equal(native.get_yield_reason(),0);}assert.equal(native.get_esp()>>>0,esp+4);return native.get_eax()>>>0;};
 const addr=name=>loader._test.findDllExport(native,memory.buffer,sdl,name);
 const screen=call(addr('SDL_CreateRGBSurface'),[0,640,480,32,0xff0000,0xff00,0xff,0]);assert(screen);w(0x452464,screen);
 const validator=await require('../lib/lbreakout-input-observer').install({enabled:true,validateOnly:true,exports:native,memory,exeBytes:pe,sdlBytes});const binding=validator.snapshot().binding;
 let observer,routePoints=null;const samples=[];
 const driver=scope.create(native,pc=>{
  if(pc===sdl+0x208fa){samples.push(observer.snapshot().lastSample);if(samples.length===2)driver.trace(0,0,0);}
  else {observer.boundary(pc);if(routePoints){routePoints.push(pc);driver.trace(0,0,0);}}
 });
 const e={...driver.exports,set_trace_eip_range:driver.trace};
 observer=await scope.install({e,memory,binding,token:'finite-fill',expected:0});
 const pixels=u(screen+20),length=v.getUint16(wa(screen+16),true)*480;b.fill(0xcd,wa(pixels),wa(pixels)+length);
 driver.trace(1,sdl+0x208fa,sdl+0x208fb);const entry=start(addr('SDL_FillRect'),[screen,0,0]);
 for(let i=0;native.get_eip();i++){assert(i<50000);driver.exports.run(100);assert.equal(native.get_yield_reason(),0);}
 assert.equal(native.get_esp()>>>0,entry+4);assert.equal(samples.length,2);
 fs.writeFileSync(run+'/fill-samples.json',JSON.stringify(samples,null,2));
 assert.equal(samples[0].pc,sdl+0x208fa);assert.equal(samples[0].fillSurface.width,640);assert.equal(samples[0].fillRect.height,480);assert.equal(samples[0].stack.words.length,24);
 assert(samples[1].registers.ebx<samples[0].registers.ebx,'original finite inner counter decreases');assert(samples[1].registers.eax>samples[0].registers.eax,'original destination advances');
 assert(b.subarray(wa(pixels),wa(pixels)+length).every(x=>x===0),'complete original fill output');
 observer.stop('offline control');const frozen=JSON.stringify(observer.snapshot());native.set_eip(0x401000);assert.equal(JSON.stringify(observer.snapshot()),frozen,'terminal sample remains frozen');
 const menu=native.guest_alloc(64),item=native.guest_alloc(128),target=native.guest_alloc(64);w(0x477150,menu);w(menu+28,item);w(item+4,6);w(item+72,target);
 w(0x47f0e0,0);w(0x47f0e4,(480<<16)|640);
 const routes=[];
 // This is the original manager's push 1/call wrapper suffix, not a generated
 // guest routine or substituted SDL function. No claim of native pixels.
 for(const count of [200,1,0]){
  w(0x452468,count);observer=await scope.install({e,memory,binding,token:'route-'+count,expected:0});
  routePoints=count===200?null:[];
  if(routePoints)driver.trace(1,0x42602b,0x42602c);
  start(0x41083f);let reached=false;
  for(let i=0;i<2000;i++){
   driver.exports.run(1);
   if(observer.snapshot().reason==='complete'||routePoints?.length===1){reached=true;break;}
  }
  assert(reached,'bounded original manager suffix '+JSON.stringify({count,pc:native.get_eip()>>>0,yield:native.get_yield_reason(),points:routePoints,bp:native.get_bp_addr()}));
  const result=observer.snapshot();assert.equal(result.reason,count===200?'complete':null);
  assert.equal(result.phase,count===200?'manager-display-return':'sdl-display-return');
  if(routePoints)assert.deepEqual(routePoints,[0x42602b],'original partial branch selects the other SDL call');
  routes.push({count,result,points:routePoints});observer.stop('offline route');native.clear_yield();
  driver.exports.run(1);native.clear_yield();
 }
 fs.writeFileSync(run+'/original-controls.json',JSON.stringify({module:hash(bytes),exe:hash(pe),sdl:hash(sdlBytes),samples,routes,scope:'isolated original SDL fill and original menu display suffix; native cause unknown'},null,2));
 console.log('PASS original SDL finite fill at retained PC, decreasing counter, advancing pointer, full pixel output, frozen bounded sample; original manager full completion and partial/empty branch selection (no partial display claim)');
})().catch(e=>{console.error(e);process.exitCode=1;});
