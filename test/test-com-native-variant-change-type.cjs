'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createHostImports}=require('../lib/host-imports'),{VirtualFS}=require('../lib/filesystem');
const {ComInterfaceRuntime,comRuntimeSourcePin}=require('../lib/com-interface-runtime');
const {OwnedComAuthority}=require('../lib/com-owned-channel'),{dispatchCom}=require('../lib/com-owned-transport');
async function main(){
 const bytes=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||'build/wine-assembly.compat.wasm');
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer,vfs:new VirtualFS(),renderer:null,resourceJson:{}};
 const imports=createHostImports(ctx);imports.host.memory=memory;
 const e=new WebAssembly.Instance(new WebAssembly.Module(bytes),imports).exports;ctx.exports=e;
 const pe=require('../tools/kernel32-native-fixture').makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
 e.set_esp(0x074ff000);e.set_eip(0);e.set_yield_state(0,0);
 const authority=new OwnedComAuthority(),session=authority.connect('native-coercion');
 const runtime=new ComInterfaceRuntime({getExports:()=>e,getMemory:()=>memory.buffer,getVfs:()=>ctx.vfs,
  desktop:{call:r=>dispatchCom(authority,session,r)},modulePin:crypto.createHash('sha256').update(bytes).digest('hex'),sourcePin:comRuntimeSourcePin()});ctx.comInterfaces=runtime;
 const {c,m,automation:a}=runtime.initialize(),table=require('../src/api_table.json');
 const thunk=name=>{const t=e.com_bridge_vtable(table.find(x=>x.name===name).id,1),p=c.word(t);e.guest_free(t);return p;};
 const api=(name,args)=>c.invoke(thunk(name),args),p=m.allocate(256),word=x=>c.word(x),put=(x,n)=>c.putWord(x,n);
 const dv=new DataView(memory.buffer),address=x=>c.view(x,1).byteOffset;
 const variant=(at,vt,n=0n)=>{m.write(at,new Uint8Array(16));dv.setUint16(address(at),vt,true);dv.setBigUint64(address(at+8),BigInt.asUintN(64,BigInt(n)),true);};
 const vt=at=>dv.getUint16(address(at),true),int=at=>dv.getInt32(address(at+8),true);
 const str=async text=>{const chars=a.string(text,true),out=await api('SysAllocStringLen',[chars,text.length]);m.free(chars);assert(out);return out;};
 const readString=bs=>Buffer.from(m.read(bs,word(bs-4))).toString('utf16le');
 const release=async at=>{if(vt(at)===8&&word(at+8))await api('SysFreeString',[word(at+8)]);variant(at,0);};
 const snap=()=>({regs:['eax','ecx','edx','ebx','esp','ebp','esi','edi'].map(x=>e['get_'+x]()>>>0),eip:e.get_eip(),yield:e.get_yield_reason(),flags:Array.from({length:6},(_,i)=>e.com_callback_get_flags(e.com_owner_token(),i))});
 const change=async(dst,src,target,flags=0)=>{const before=snap(),hr=await api('VariantChangeType',[dst,src,flags,target]);assert.deepEqual(snap(),before);assert.equal(c.frames.length,0);return hr;};
 // Both public native name/ordinal lookups resolve the same implemented API.
 const dll=a.string('oleaut32.dll',false),name=a.string('VariantChangeType',false),module=await api('LoadLibraryA',[dll]);assert(module);
 const named=await api('GetProcAddress',[module,name]),ordinal=await api('GetProcAddress',[module,12]);assert(named&&ordinal);m.free(dll);m.free(name);
 variant(p,3,123);variant(p+16,0);
 assert.equal(await c.invoke(ordinal,[p+16,p,0xdead0000,0xbeef0008]),0);assert.equal(vt(p+16),8);assert.equal(readString(word(p+24)),'123');await release(p+16);
 // Same counted BSTR type copies every character, including embedded NUL,
 // and supports pvargDest == pvarSrc without releasing the source early.
 const source=await str('own\0tail');variant(p,8,source);variant(p+16,0);
 assert.equal(await c.invoke(named,[p+16,p,0,8]),0);assert.notEqual(word(p+24),source);assert.equal(readString(word(p+24)),'own\0tail');await release(p+16);
 assert.equal(await change(p,p,8),0);assert.notEqual(word(p+8),source);assert.equal(readString(word(p+8)),'own\0tail');await release(p);
 // Counted BSTR-to-LONG coercion, in addition to the engine's BSTR-to-BSTR
 // normalization covered above.
 for(const [text,value]of [['  +42\t',42],['-2147483648',-2147483648],['2.5',2],['3.5',4]]){
  variant(p,8,await str(text));variant(p+16,0);assert.equal(await change(p+16,p,3),0);assert.equal(int(p+16),value);await release(p);
 }
 for(const [text,hr]of [['2147483648',0x8002000a],['abc',0x80020005],['1\0junk',0x80020005]]){
  variant(p,8,await str(text));variant(p+16,3,0x12345678);const old=m.read(p+16,16);
  assert.equal(await change(p+16,p,3),hr);assert.deepEqual(m.read(p+16,16),old);await release(p);
 }
 // Borrowed BYREF scalar/BSTR owners are never released or republished.
 put(p+80,0xffffffd6);variant(p,0x4003,p+80);variant(p+16,0);assert.equal(await change(p+16,p,8),0);assert.equal(readString(word(p+24)),'-42');assert.equal(word(p+80),0xffffffd6);await release(p+16);
 const borrowed=await str('Borrowed');put(p+80,borrowed);variant(p,0x4008,p+80);variant(p+16,0);
 assert.equal(await change(p+16,p,8),0);assert.notEqual(word(p+24),borrowed);await release(p+16);assert.equal(readString(borrowed),'Borrowed');await api('SysFreeString',[borrowed]);
 variant(p,0x400c,p);variant(p+16,3,789);assert.equal(await change(p+16,p,3),0x80070057);assert.equal(int(p+16),789);
 variant(p,21,0xffffffffffffffffn);variant(p+16,0);assert.equal(await change(p+16,p,8),0);assert.equal(readString(word(p+24)),'18446744073709551615');await release(p+16);
 variant(p,20,-9223372036854775808n);assert.equal(await change(p+16,p,8),0);assert.equal(readString(word(p+24)),'-9223372036854775808');await release(p+16);
 for(const [from,n,to,hr]of [[3,-1,17,0x8002000a],[19,0xffffffff,3,0x8002000a],[3,128,16,0x8002000a],[2,-32768,3,0],[3,255,17,0],[3,1,11,0]]){
  variant(p,from,n);variant(p+16,0);assert.equal(await change(p+16,p,to),hr);if(!hr)assert.equal(vt(p+16),to);
 }
 // Failed conversions preserve an existing destination BSTR and source.
 variant(p,5,0);variant(p+16,8,await str('still owned'));const owned=word(p+24),old=m.read(p+16,16);
 assert.equal(await change(p+16,p,3),0x80004001);assert.deepEqual(m.read(p+16,16),old);assert.equal(readString(owned),'still owned');
 variant(p,0);assert.equal(await change(p+16,p,0x1234),0x80020008);assert.equal(await change(p+16,p,3,0x8000),0x80004001);assert.equal(await change(0,p,3),0x80070057);await release(p+16);
 // Malformed counted BSTR and reserved header fields cannot be accepted.
 const malformed=await str('12');variant(p,8,malformed);put(malformed-4,3);assert.equal(await change(p+16,p,3),0x80070057);put(malformed-4,4);await release(p);
 variant(p,3,4);put(p+4,1);assert.equal(await change(p+16,p,3),0x80070057);
 // Repeated in-place native allocate/coerce/free exercises owner replacement.
 const replace=async i=>{variant(p,3,i);assert.equal(await change(p,p,8),0);assert.equal(await change(p,p,3),0);assert.equal(int(p),i);};
 for(let i=0;i<4;i++)await replace(i);const heapAt=e.get_heap_ptr();
 for(let i=0;i<128;i++)await replace(i);assert.equal(e.get_heap_ptr(),heapAt,'native replacements do not grow the warmed heap');
 m.free(p);await m.drain();
 console.log(JSON.stringify({ok:true,moduleSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),nativeOrdinal:12,countedBSTR:true,inPlace:true,borrowedByref:true,exactFrame:true,malformedAtomic:true,unsupportedExplicit:true,replacements:128}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
