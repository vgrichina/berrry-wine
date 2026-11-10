'use strict';
// Execute original surface_gray and stk_surface_blit, never the P handler.
// LB_COST_BASELINE compares whole surface bytes from a separately built control.
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),vm=require('node:vm'),crypto=require('node:crypto');
const root=require('node:path').resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=cp.execFileSync('python3',['-c',"import importlib.util;s=importlib.util.spec_from_file_location('h','tools/lbreakout-case-inspection.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h);print(h.level_start_driver_source())"],{cwd:root,encoding:'utf8'});
const context={};vm.createContext(context);vm.runInContext(source+';globalThis.create=createLevelStartDriver',context);
(async()=>{
 const wasm=fs.readFileSync(process.env.LB_COST_MODULE||root+'/build/wine-assembly.wasm'),module=await WebAssembly.compile(wasm);
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer,renderer:null,resourceJson:{}};
 const imports=require(root+'/lib/host-imports').createHostImports(ctx);imports.host.memory=memory;
 let hits=0;imports.host.log_eip=()=>hits++;
 for(const x of WebAssembly.Module.imports(module))if(x.kind==='function'&&!imports.host[x.name])imports.host[x.name]=()=>{throw Error('unexpected import '+x.name)};
 const e=(await WebAssembly.instantiate(module,imports)).exports;ctx.exports=e;
 const b=new Uint8Array(memory.buffer),v=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0,w=(p,n)=>v.setUint32(wa(p),n>>>0,true),r=p=>v.getUint32(wa(p),true);
 const pe=fs.readFileSync(root+'/test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/lbreakout2.exe');
 assert.equal(sha(pe),'cc1fd5c3d229cc1d4f910e658f5abefa80ef8ebf4b5e47801648f0be0e1ca244');
 b.set(pe,e.get_staging());assert(e.load_pe(pe.length));
 const loader=require(root+'/lib/dll-loader');
 const dlls=['SDL.dll','msvcrt.dll'].map(name=>({name,bytes:fs.readFileSync(root+(name==='SDL.dll'?'/test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/SDL.dll':'/test/binaries/dlls/msvcrt.dll'))}));
 const loaded=loader.loadDlls(e,memory.buffer,pe,dlls,()=>{}),sdl=loaded[0].loadAddr,crt=loaded[1].loadAddr;
 const realCopy=loader._test.findDllExport(e,memory.buffer,crt,'memcpy'),boundCopy=r(0x480508);
 const nativeCopy=boundCopy!==realCopy;
 if(process.env.LB_COST_EXPECT_NATIVE)assert.equal(nativeCopy,process.env.LB_COST_EXPECT_NATIVE==='1','production EXE import binding');
 const stack=e.guest_alloc(65536)+65000;
 const call=(driver,pc,args=[])=>{
  e.set_esp(stack);e.call_func(pc,...Array.from({length:4},(_,i)=>args[i]||0));const esp=e.get_esp()>>>0;
  for(let i=4;i<args.length;i++)w(esp+4+i*4,args[i]);
  let rounds=0,total=0;
  while(e.get_eip()){
   driver.run(10000);total+=driver.get_last_run_blocks();
   assert.equal(e.get_yield_reason(),0,'no substituted services or yields');assert(++rounds<10000,'bounded original return');
  }
  assert.equal(e.get_esp()>>>0,esp+4,'cdecl pops only return address');return {eax:e.get_eax()>>>0,blocks:total};
 };
 // Verify the actual EXE-bound copy against its authentic CRT export, with
 // complete source/destination/canary comparison and callee-saved registers.
 const arena=e.guest_alloc(0x5000),initial=Buffer.alloc(0x5000);
 for(let i=0;i<initial.length;i++)initial[i]=(i*73+(i>>>4))&255;
 let copyCases=0;
 for(const size of [0,1,2,3,4,7,15,16,31,64,255,4097])for(const offset of [0,1,3,4094]){
  const dst=arena+offset,src=arena+0x2800;
  const arms=[realCopy,boundCopy].map(pc=>{
   b.set(initial,wa(arena));
   const saved=[e.get_ebx(),e.get_esi(),e.get_edi(),e.get_ebp()];
   const result=call(e,pc,[dst,src,size]);assert.equal(result.eax,dst);
   assert.deepEqual([e.get_ebx(),e.get_esi(),e.get_edi(),e.get_ebp()],saved);
   return Buffer.from(b.slice(wa(arena),wa(arena)+initial.length));
  });
  assert(arms[0].equals(arms[1]),'CRT/native copy incl canaries '+size+'/'+offset);copyCases++;
 }
 const create=loader._test.findDllExport(e,memory.buffer,sdl,'SDL_CreateRGBSurface');
 const setAlpha=loader._test.findDllExport(e,memory.buffer,sdl,'SDL_SetAlpha');
 const surface=(width,height,depth)=>{
  const masks=depth===16?[0xf800,0x7e0,0x1f,0]:[0xff0000,0xff00,0xff,depth===32?0xff000000:0];
  const p=call(e,create,[0,width,height,depth,...masks]).eax;assert(p);assert.equal(call(e,setAlpha,[p,0,255]).eax,0);return p;
 };
 const pixels=p=>Buffer.from(memory.buffer,wa(r(p+20)),v.getUint16(wa(p+16),true)*r(p+12));
 let retained=null;
 if(process.env.LB_COST_RETAINED){
  const data=fs.readFileSync(process.env.LB_COST_RETAINED),png=require('pngjs').PNG.sync.read(data);
  const rect=(process.env.LB_COST_RECT||'0,0,640,480').split(',').map(Number),[x,y,width,height]=rect;
  assert.equal(width,640);assert.equal(height,480);assert(x>=0&&y>=0&&x+width<=png.width&&y+height<=png.height);
  const rgba=Buffer.alloc(width*height*4);
  for(let row=0;row<height;row++)png.data.copy(rgba,row*width*4,((y+row)*png.width+x)*4,((y+row)*png.width+x+width)*4);
  retained={sha256:sha(data),rgba,path:process.env.LB_COST_RETAINED,rect};
 }
 const fixtures=[];
 for(const depth of [16,24,32]){
  const board=surface(640,480,depth),backing=surface(640,480,depth),input=Buffer.alloc(pixels(board).length);
  for(let i=0;i<input.length;i++)input[i]=(i*73+(i>>>7))&255;
  if(retained){
   for(let i=0;i<640*480;i++){
    const [red,green,blue]=retained.rgba.subarray(i*4,i*4+3);
    if(depth===16)input.writeUInt16LE((red>>>3)<<11|(green>>>2)<<5|(blue>>>3),i*2);
    else {input[i*(depth/8)]=blue;input[i*(depth/8)+1]=green;input[i*(depth/8)+2]=red;if(depth===32)input[i*4+3]=255;}
   }
  }
  fixtures.push({depth,board,backing,input});
 }
 const records=[];
 // Reset only fixture input buffers between arms. Original SDL format, blit
 // selection and MapRGB execute normally. Width/height -1 and darkening 2
 // match display_text's actual call at 0x407a53.
 for(const tier of [0,1]){
  e.set_uop(tier);e.set_uop_trace_heads(tier);
  for(let pair=0;pair<3;pair++)for(const mode of (pair%2?['target','trace','off']:['off','trace','target']))for(const f of fixtures){
   pixels(f.board).set(f.input);pixels(f.backing).fill(0xcd);
   const points=[];const d=context.create(e,pc=>{points.push(pc);d.trace(0,0,0);});
   assert.equal(d.exports.run,e.run,'unarmed native identity');
   if(mode==='target')d.trace(1,0x426dd1,0x426dd2);
   if(mode==='trace')e.set_trace_eip_range(1,0x41e406,0x41e878);
   const api=e.get_api_calls(),callbacks=hits,tierGuard=e.get_dbg_tier_guard(),start=performance.now();
   const gray=call(mode==='target'?d.exports:e,0x426bb0,[f.board,0,0,-1,-1,2]);
   const grayMs=performance.now()-start;
   // The game's own retained surface wrapper -> original SDL software blit.
   const blit=call(e,0x426886,[f.board,0,0,-1,-1,f.backing,0,0]);
   const ms=performance.now()-start;e.set_trace_eip_range(0,0,0);
   assert(pixels(f.board).equals(pixels(f.backing)),'original retained software blit pixel identity');
   if(mode==='target')assert.deepEqual(points,[0x426dd1]);
   assert.equal(tierGuard,mode==='trace'?1:0);
   assert.equal(e.get_bp_addr(),0);assert.equal(e.get_dbg_tier_guard(),0);
   const rec={tier,pair,mode,depth:f.depth,grayMs,ms,grayBlocks:gray.blocks,blitBlocks:blit.blocks,apiCalls:e.get_api_calls()-api,traceCallbacks:hits-callbacks,output:sha(pixels(f.backing))};
   if(nativeCopy)assert(rec.apiCalls>=640*480*2,'every original pixel copy reaches existing native provider');
   records.push(rec);
  }
 }
 // Input identity includes every byte, not a single solid-color sample.
 for(const f of fixtures){const hashes=records.filter(r=>r.depth===f.depth).map(r=>r.output);assert.equal(new Set(hashes).size,1,'tier/observer pixel identity');}
 const medians={};for(const tier of [0,1])for(const mode of ['off','target','trace'])for(const depth of [16,24,32]){
  const rs=records.filter(r=>r.tier===tier&&r.mode===mode&&r.depth===depth);
  medians[[tier,mode,depth].join('/')]=rs.map(r=>r.ms).sort((a,b)=>a-b)[1];
 }
 // Optional causal crossover in this isolated fixture only: compare the
 // authentic CRT export and the production-bound copy in alternating order.
 // This is not installed by any preload and never touches a running game.
 const paired=[];
 if(nativeCopy&&process.env.LB_COST_PAIRED){
  const f=fixtures.find(f=>f.depth===32);e.set_uop(1);e.set_uop_trace_heads(1);
  try{
   for(let pair=0;pair<5;pair++)for(const mode of ['off','target'])for(const arm of (pair%2?['native','original']:['original','native'])){
    w(0x480508,arm==='native'?boundCopy:realCopy);pixels(f.board).set(f.input);pixels(f.backing).fill(0xcd);
    const d=context.create(e,()=>d.trace(0,0,0));if(mode==='target')d.trace(1,0x426dd1,0x426dd2);
    const api=e.get_api_calls(),start=performance.now();
    const gray=call(mode==='target'?d.exports:e,0x426bb0,[f.board,0,0,-1,-1,2]);
    call(e,0x426886,[f.board,0,0,-1,-1,f.backing,0,0]);
    paired.push({pair,mode,arm,ms:performance.now()-start,blocks:gray.blocks,apiCalls:e.get_api_calls()-api,output:sha(pixels(f.backing))});
    assert(pixels(f.board).equals(pixels(f.backing)));
   }
  }finally{w(0x480508,boundCopy);}
  assert.equal(new Set(paired.map(r=>r.output)).size,1,'crossover complete pixel identity');
 }
 const result={passed:true,module:sha(wasm),exe:sha(pe),sdl:sha(dlls[0].bytes),crt:sha(dlls[1].bytes),engine:process.version,arch:process.arch,nativeCopy,copyCases,retained:retained&&{path:retained.path,sha256:retained.sha256,rect:retained.rect},medians,records,paired,scope:'isolated original display_text grayscale arguments + retained stk_surface_blit/original SDL software; screenshot crop is representative input, not a guest snapshot; no P handler, browser scheduling or presentation claim'};
 if(process.env.LB_COST_BASELINE){
  const base=JSON.parse(fs.readFileSync(process.env.LB_COST_BASELINE));assert.equal(base.nativeCopy,false);assert.equal(nativeCopy,true);
  for(const key of ['exe','sdl','crt'])assert.equal(result[key],base[key]);
  assert.deepEqual(result.retained,base.retained);
  assert.equal(records.length,base.records.length);
  records.forEach((r,i)=>assert.equal(r.output,base.records[i].output,'before/after full pixels '+i));
  result.speedup={};for(const key of Object.keys(medians))result.speedup[key]=base.medians[key]/medians[key];
 }
 if(process.env.LB_COST_OUTPUT)fs.writeFileSync(process.env.LB_COST_OUTPUT,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
