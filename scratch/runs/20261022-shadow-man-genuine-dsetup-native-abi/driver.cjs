'use strict';
// Scratch-only caller. All DLL binding/lifecycle is production process-boot.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=process.cwd(),E=__dirname;
const {createHostImports}=require(path.join(ROOT,'lib/host-imports'));
const boot=require(path.join(ROOT,'lib/process-boot')),loader=require(path.join(ROOT,'lib/dll-loader'));
const storage=require(path.join(ROOT,'lib/storage'));
const {X86,pe,BASE,DATA}=require(path.join(ROOT,'test/test-dll-lifecycle-real-pe'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const result={canonicalInstances:0,canonicalCompiles:0,events:[],registry:[],calls:[],installedRegistry:'UNKNOWN',game:'NOT RUN'};
let ex,memory,phase='pins';
function save(){fs.writeFileSync(path.join(E,'execution.json'),JSON.stringify(result,null,2)+'\n');}
async function main(){
 const bytes=fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm'));
 assert.equal(sha(bytes),'ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553');
 result.module={bytes:bytes.length,sha256:sha(bytes)};
 const dll=fs.readFileSync(path.join(E,'originals/dsetup.dll'));
 assert.equal(sha(dll),'5112c736fa664cfd658c465fad781fe7ffd2753470cbcf7019b5a6ab08c4800f');assert.equal(dll.length,135680);
 result.original={bytes:dll.length,sha256:sha(dll)};result.imports=loader.importsByDll(dll);
 storage.clearStore();result.registryBefore=storage.exportStore();
 assert(!Object.keys(result.registryBefore).some(k=>/directx/i.test(k)),'pristine DirectX registry');
 memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}},availableDllFiles:new Set(['dsetup.dll']),trace:new Set(['reg']),onExit(code){result.exit=code;}};
 const imports=createHostImports(ctx);imports.host.memory=memory;
 const read=(wa,wide=0)=>{let s='';const v=new DataView(memory.buffer);for(let i=0;i<1024;i++){const c=wide?v.getUint16(wa+i*2,true):v.getUint8(wa+i);if(!c)break;s+=String.fromCharCode(c);}return s;};
 for(const name of ['reg_open_key','reg_query_value','reg_close_key']){
  const original=imports.host[name];imports.host[name]=(...args)=>{const row={phase,name,args:[...args]};if(name!=='reg_close_key')row.text=read(args[1]>>>0,name==='reg_open_key'?args[2]:args[5]);const out=original(...args);row.result=out;result.registry.push(row);return out;};
 }
 phase='canonical instantiate';const mod=await WebAssembly.compile(bytes);result.canonicalCompiles++;
 ex=(await WebAssembly.instantiate(mod,imports)).exports;result.canonicalInstances++;ctx.exports=ex;
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 const caller=(p1,p2)=>new X86().push(p2).push(p1).emit(0x89,0x25,u32(DATA+0x80)).eaxFrom(0).emit(0xff,0xd0,0x89,0x25,u32(DATA+0x84)).eaxTo(0x88).emit(0xc3).finish();
 const parts=[[0x1500,'dsetup.dll\0'],[0x2000,new X86().push(BASE+0x1500).api('LoadLibraryA').emit(0xc3).finish()],[0x2100,new X86().push(11).emit(0x50).api('GetProcAddress').emit(0xc3).finish()]];
 // A deliberately safe page-boundary control: writable DWORD spans two mapped pages.
 const boundaryBase=0x402000; // caller fixture .text starts here, so allocate later instead.
 const exe=pe(parts);new Uint8Array(memory.buffer,ex.get_staging(),exe.length).set(exe);ex.load_pe(exe.length);
 const view=new DataView(memory.buffer),gw=a=>ex.guest_to_wasm(a)>>>0;
 const known=name=>{const p=ex.guest_alloc(name.length+1);assert(p);for(let i=0;i<=name.length;i++)ex.guest_write8(p+i,i<name.length?name.charCodeAt(i):0);const k=!!ex.api_name_known(p);ex.guest_free(p);return k;};
 phase='import binding preflight';result.importBindings=result.imports.map(i=>({...i,unknown:(i.names||[]).filter(n=>!known(n))}));save();
 const missing=result.importBindings.flatMap(i=>i.unknown.map(name=>({dll:i.dll,name})));
 assert.equal(missing.length,0,'missing API name binding: '+JSON.stringify(missing));
 async function invoke(entry,arg=0){
  const stack=ex.guest_alloc(0x10000),sp=stack+0xfff0;assert(stack);view.setUint32(gw(sp),0,true);ex.set_esp(sp);ex.set_eip(BASE+entry);ex.set_eax(arg);ex.clear_yield();let tx=null;
  try{for(let turn=0;turn<2000;turn++){
   if(tx){const done=tx.advance(1000);if(done.done){result.events.push(done);tx=null;}}
   else ex.run(1000);
   if(ex.get_yield_reason()===5){assert.equal(tx,null,'nested lifecycle yield');tx=boot.beginScopedLibraryYield({exports:ex,memoryBuffer:memory.buffer,log:s=>console.log(s)});assert(tx);result.events.push({request:tx.request});if(!tx.request.unload){const prepared=await boot.prepareScopedLibrary(tx.request,async(file)=>String(file).toLowerCase()==='dsetup.dll'?dll:null,exe,async names=>Object.fromEntries(names.map(n=>[n,known(n)])));result.events.push({prepared:{bytes:prepared.bytes?.length,deps:prepared.deps}});tx.prepare(prepared);}}
   else if(!tx&&!ex.get_eip())return ex.get_eax()>>>0;
   else if(!tx&&ex.get_yield_reason())throw new Error('unexpected yield '+ex.get_yield_reason());
  }throw new Error('bounded invocation exceeded 2000x1000 quantum');}
  finally{tx?.cancel();ex.guest_free(stack);save();}
 }
 phase='LoadLibraryA genuine original';result.handle=await invoke(0x2000);assert(result.handle,'LoadLibraryA failed');
 result.dllIndex=ex.get_dll_index(result.handle);assert(result.dllIndex>=0);
 const life=ex.get_dll_lifecycle_table()+result.dllIndex*ex.get_dll_lifecycle_stride();result.lifecycle={state:view.getUint32(life,true),pin:view.getUint32(life+12,true)};assert.equal(result.lifecycle.state,2);
 phase='GetProcAddress ordinal 11';result.proc=await invoke(0x2100,result.handle);assert.equal(result.proc>>>0,(result.handle+0x18b0)>>>0,'must resolve actual PE export');
 result.loadedPrimitive=Buffer.from(memory.buffer,gw(result.proc),0x47).toString('hex');
 assert.equal(result.loadedPrimitive,dll.subarray(0xcb0,0xcb0+0x47).toString('hex'),'unmodified primitive code');
 view.setUint32(gw(DATA),result.proc,true);
 const buffer=ex.guest_alloc(0x3000);assert(buffer);const p1=buffer+16,p2=buffer+48,boundary=((buffer+0x1000)&~0xfff)+0xffe;
 const cases=[['both',p1,p2],['firstNULL',0,p2],['secondNULL',p1,0],['bothNULL',0,0],['safe-cross-page',boundary,p2]];
 for(let i=0;i<cases.length;i++){
  const [name,a,b]=cases[i];phase='ordinal11 '+name;
  const zones=[a||p1,b||p2].map(p=>({p,start:p-8,size:20}));for(const z of zones)new Uint8Array(memory.buffer,gw(z.start),z.size).fill(0xa5);
  const snapshots=()=>zones.map(z=>({pointer:z.p,start:z.start,hex:Buffer.from(memory.buffer,gw(z.start),z.size).toString('hex')}));const before=snapshots();
  const code=caller(a,b),entry=0x2300+i*0x100;new Uint8Array(memory.buffer,gw(BASE+entry),code.length).set(code);
  const eax=await invoke(entry);const after=snapshots();const pre=view.getUint32(gw(DATA+0x80),true),post=view.getUint32(gw(DATA+0x84),true);
  const row={name,args:[a,b],before,after,eax,entryESP:pre-4,returnESP:post,delta:post-(pre-4),outputs:[a?view.getUint32(gw(a),true):null,b?view.getUint32(gw(b),true):null]};result.calls.push(row);save();
  assert.equal(eax,1);assert.equal(row.delta,12);
  zones.forEach((z,j)=>{const want=Buffer.from(before[j].hex,'hex');if((j===0?a:b))want.fill(0,8,12);assert.equal(after[j].hex,want.toString('hex'),'exact DWORD write with guards');});
 }
 ex.guest_free(buffer);result.registryAfter=storage.exportStore();assert.deepEqual(result.registryAfter,result.registryBefore);result.verdict='PASS genuine ordinal primitive; pristine candidate registry only';save();
}
main().catch(error=>{result.verdict='FIRST_CONCRETE_BLOCKER';result.blocker={phase,error:String(error),stack:error.stack,eip:ex?.get_eip()>>>0,esp:ex?.get_esp?.()>>>0,eax:ex?.get_eax()>>>0,yield:ex?.get_yield_reason()};save();console.error(error);process.exitCode=1;});
