'use strict';
// Real x86 imports, dynamic lookup, QI/Release and IStream serialization.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createHostImports}=require('../lib/host-imports'),{VirtualFS}=require('../lib/filesystem');
const {ComInterfaceRuntime,comRuntimeSourcePin}=require('../lib/com-interface-runtime');
const {OwnedComAuthority}=require('../lib/com-owned-channel'),{dispatchCom}=require('../lib/com-owned-transport');
const {decodeStandard}=require('../lib/com-objref');
function fixture(){
 const pe=require('../tools/kernel32-native-fixture').makeFixture(),raw=r=>r-0x1000+0x200;
 pe.writeUInt32LE(60,0x80+24+108);
 // A second genuine import descriptor, using spare room in the PE fixture.
 for(const [r,v]of [[0x1814,0x1980],[0x1820,0x18c0],[0x1824,0x1980],[0x1980,0x1c00]])pe.writeUInt32LE(v,raw(r));
 pe.write('ole32.dll\0',raw(0x18c0));pe.write('CoGetMarshalSizeMax\0',raw(0x1c02));
 return pe;
}
async function main(){
 const bytes=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||'build/wine-assembly.compat.wasm');
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer,vfs:new VirtualFS(),renderer:null,resourceJson:{}};
 const imports=createHostImports(ctx);imports.host.memory=memory;
 let manager;
 imports.host.com_initialize_thread=(reserved,flags,tid)=>manager.initializeComApartment(reserved,flags,tid);
 imports.host.com_uninitialize_thread=tid=>manager.uninitializeComApartment(tid);
 imports.host.com_is_initialized=tid=>manager.isComApartmentInitialized(tid);
 const e=new WebAssembly.Instance(new WebAssembly.Module(bytes),imports).exports;ctx.exports=e;
 const pe=fixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
 e.init_dx_com_thunks();
 const {ThreadManager}=require('../lib/thread-manager');
 manager=new ThreadManager(null,memory,{exports:e},()=>({host:{}}),{});manager._log=()=>{};
 e.set_esp(0x074ff000);e.set_eip(0);e.set_yield_state(0,0);
 const authority=new OwnedComAuthority(),session=authority.connect('marshal-size-native');
 const runtime=new ComInterfaceRuntime({getExports:()=>e,getMemory:()=>memory.buffer,getVfs:()=>ctx.vfs,
  desktop:{call:r=>dispatchCom(authority,session,r)},modulePin:crypto.createHash('sha256').update(bytes).digest('hex'),sourcePin:comRuntimeSourcePin()});ctx.comInterfaces=runtime;
 const {c,m,automation:a}=runtime.initialize(),table=require('../src/api_table.json');
 const live=new Set(),allocate=m.allocate.bind(m),free=m.free.bind(m);
 m.allocate=n=>{const p=allocate(n);assert(!live.has(p));live.add(p);return p;};
 m.free=p=>{assert(live.delete(p));free(p);};
 const alloc=n=>m.allocate(n),put=(p,v)=>c.putWord(p,v),read=p=>c.word(p);
 const code=b=>{const p=alloc(b.length);m.write(p,Uint8Array.from(b));return p;};
 const thunk=name=>{const t=e.com_bridge_vtable(table.find(x=>x.name===name).id,1),p=read(t);e.guest_free(t);return p;};
 const api=(name,args)=>c.invoke(thunk(name),args),scratch=alloc(256),server=alloc(32),vt=alloc(20);
 const imported=read(0x401980);assert(imported);
 const dll=a.string('ole32.dll',false),name=a.string('CoGetMarshalSizeMax',false);
 const module=await api('LoadLibraryA',[dll]),dynamic=await api('GetProcAddress',[module,name]);assert(dynamic);
 m.free(dll);m.free(name);
 const qi=code([0x8b,0x44,0x24,4,0x8b,0x54,0x24,8,0x8b,0x4c,0x24,12,0xc7,1,0,0,0,0,
  0x83,0x3a,3,0x74,0x0a,0x89,1,0xff,0x40,4,0x31,0xc0,0xc2,12,0,0xb8,2,0x40,0,0x80,0xc2,12,0]);
 const add=code([0x8b,0x4c,0x24,4,0xff,0x41,4,0x8b,0x41,4,0xc2,4,0]);
 const release=code([0x8b,0x4c,0x24,4,0xff,0x49,4,0x8b,0x41,4,0xc2,4,0]);
 put(server,vt);put(server+4,1);put(vt,qi);put(vt+4,add);put(vt+8,release);
 m.write(scratch,Buffer.from('0000000000000000c000000000000046','hex'));
 const snapshot=()=>({regs:['eax','ecx','edx','ebx','esp','ebp','esi','edi'].map(n=>e['get_'+n]()>>>0),eip:e.get_eip(),yield:e.get_yield_reason(),frames:c.frames.length});
 const size=async(args=[scratch+16,scratch,server,0,0,0],entry=dynamic)=>{
  const before=snapshot(),liveBefore=new Set(live);put(scratch+16,0xdeadbeef);
  const hr=await c.invoke(entry,args);assert.deepEqual(snapshot(),before);assert.deepEqual(live,liveBefore);assert.equal(read(server+4),1);
  assert.equal(m.exports.size,0);assert.equal(m.objects.size,0);assert.equal(authority.exports.size,0);return hr;
 };
 assert.equal(await size(),0x800401f0);assert.equal(read(scratch+16),0);
 assert.equal(await api('CoInitializeEx',[0,2]),0);
 for(const entry of [imported,dynamic]){
  assert.equal(await size(undefined,entry),0);const bound=read(scratch+16);assert(bound>0);
  for(const mode of [0,1]){
   assert.equal(await size([scratch+16,scratch,server,0,0,mode],entry),0);
   assert.equal(await api('CreateStreamOnHGlobal',[0,1,scratch+20]),0);const stream=read(scratch+20);
   assert.equal(await api('CoMarshalInterface',[stream,scratch,server,0,0,mode]),0);assert.equal(read(server+4),2);
   assert.equal(await c.call(stream,5,[0,0,1,scratch+32]),0);const actual=read(scratch+32);assert(actual<=bound);assert.equal(read(scratch+36),0);
   assert.equal(await c.call(stream,5,[0,0,0,0]),0);const packet=await m.transfer(stream,false,actual);assert.equal(decodeStandard(packet).reference.iid,m.guid(scratch));
   assert.equal(await c.call(stream,5,[0,0,0,0]),0);assert.equal(await api('CoReleaseMarshalData',[stream]),0);assert.equal(read(server+4),1);assert.equal(m.exports.size,0);
   await c.call(stream,2);
  }
 }
 for(const [args,expected]of [
  [[0,scratch,server,0,0,0],0x80004003],[[scratch+16,0,server,0,0,0],0x80004003],[[scratch+16,scratch,0,0,0,0],0x80004003],
  [[scratch+16,scratch,server,0,1,0],0x80070057],[[scratch+16,scratch,server,5,0,0],0x80070057],
  [[scratch+16,scratch,server,0,0,3],0x80070057],[[scratch+16,scratch,server,0,0,0xffffffff],0x80070057],
  ...[1,2,3,4].map(context=>[[scratch+16,scratch,server,context,0,0],0x80004001]),[[scratch+16,scratch,server,0,0,2],0x80004001]]){
  assert.equal(await size(args),expected);if(args[0])assert.equal(read(scratch+16),0);
 }
 const deny=code([0xb8,2,0x40,0,0x80,0xc2,12,0]);put(vt,deny);assert.equal(await size(),0x80004002);put(vt,qi);
 // An interface accepted by this server still needs a registered real
 // proxy/stub factory. A bound must not bypass that serialization failure.
 m.write(scratch,Buffer.from('12345678901234567890123456789012','hex'));
 assert.equal(await size(),0x80040155);assert.equal(read(scratch+16),0);
 m.write(scratch,new Uint8Array(16));assert.equal(await size(),0x80070057);
 m.write(scratch,Buffer.from('0000000000000000c000000000000046','hex'));
 // Partial and failed native IStream writes roll back the prepared export
 // and canonical reference. No success-shaped packet survives the failure.
 const badStream=alloc(16),badVt=alloc(20);put(badStream,badVt);
 for(const [result,expected]of [[0,0x8003001d],[0x80070005,0x80070005]]){
  const write=code([0xb8,result&255,result>>>8&255,result>>>16&255,result>>>24&255,0xc2,16,0]);put(badVt+16,write);
  const before=new Set(live);assert.equal(await api('CoMarshalInterface',[badStream,scratch,server,0,0,0]),expected);
  assert.deepEqual(live,before);assert.equal(read(server+4),1);assert.equal(m.exports.size,0);assert.equal(m.objects.size,0);assert.equal(authority.exports.size,0);
 }
 // Custom IMarshal is native code, with actual payload-bound and HRESULT.
 const customQI=code([0x8b,0x44,0x24,4,0x8b,0x4c,0x24,12,0x89,1,0xff,0x40,4,0x31,0xc0,0xc2,12,0]);
 const customSize=code([0x8b,0x54,0x24,4,0x8b,0x44,0x24,28,0x8b,0x4a,16,0x89,8,0xff,0x42,24,0x8b,0x42,20,0xc2,28,0]);
 put(vt,customQI);put(vt+16,customSize);put(server+16,123);put(server+20,0);
 assert.equal(await size([scratch+16,scratch,server,4,0,2]),0);assert.equal(read(scratch+16),171);assert.equal(read(server+24),1);
 put(server+20,0x80070005);assert.equal(await size(),0x80070005);assert.equal(read(scratch+16),0);
 put(server+20,0);put(server+16,0xffffffff);assert.equal(await size(),0x80070057);assert.equal(read(scratch+16),0);
 put(vt,qi);
 await api('CoUninitialize',[]);assert.equal(await size(),0x800401f0);
 for(const p of [...live])m.free(p);
 assert.equal(c.frames.length,0);assert.equal(authority.exports.size,0);
 console.log(JSON.stringify({status:'PASS',nativeImport:true,dynamicLookup:true,actualSerializedBound:true,normalAndTableStrong:true,customIMarshal:true,failuresAndCleanup:true,moduleSHA256:crypto.createHash('sha256').update(bytes).digest('hex')}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
