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

 const frame=()=>({regs:['eax','ecx','edx','ebx','esp','ebp','esi','edi'].map(x=>e['get_'+x]()>>>0),eip:e.get_eip(),yield:e.get_yield_reason(),flags:Array.from({length:6},(_,i)=>e.com_callback_get_flags(e.com_owner_token(),i))});
 const call=async(name,args)=>{const before=frame(),v=await api(name,args);assert.deepEqual(frame(),before);assert.equal(c.frames.length,0);return v;};
 const create=async(dims)=>{dims.forEach(([n,lo],i)=>{put(p+80+i*8,n);put(p+84+i*8,lo);});return call('SafeArrayCreate',[8,dims.length,p+80]);};
 assert.equal(await call('SafeArrayCreate',[8,0,p+80]),0);
 assert.equal(await call('SafeArrayCreate',[8,1,0]),0);
 put(p+80,0x10000001);assert.equal(await call('SafeArrayCreate',[8,1,p+80]),0);
 const zero=await create([[0,-9]]);assert(zero);assert.equal(word(zero+12),0);assert.equal(await call('SafeArrayDestroy',[zero]),0);
 const exercise=async()=>{
  const array=await create([[2,-3],[3,7]]);assert(array);
  assert.equal(dv.getUint16(address(array),true),2);assert.equal(dv.getUint16(address(array+2),true),0x180);
  assert.equal(word(array-4),8);assert.equal(word(array+4),4);assert.equal(word(array+16),3);assert.equal(word(array+20),7);assert.equal(word(array+24),2);assert.equal(word(array+28),0xfffffffd);
  assert.equal(await call('SafeArrayAccessData',[array,p+64]),0);const data=word(p+64);
  assert.deepEqual(m.read(data,24),new Uint8Array(24));
  const strs=[];for(const [i,text]of [[0,'one\0tail'],[2,''],[5,'last']]){const bs=await str(text);strs.push(bs);put(data+i*4,bs);}
  variant(p,0x2008,array);const original=m.read(p,16),descriptor=m.read(array-4,40);
  assert.equal(await call('SafeArrayDestroy',[array]),0x8002000d);assert.deepEqual(m.read(array-4,40),descriptor);
  assert.equal(await call('VariantClear',[p]),0x8002000d);assert.deepEqual(m.read(p,16),original);assert.equal(readString(strs[0]),'one\0tail');
  assert.equal(await call('SafeArrayUnaccessData',[array]),0);assert.equal(await call('SafeArrayUnaccessData',[array]),0x8000ffff);
  // A borrowed SAFEARRAY pointer clears only its wrapper.
  variant(p+16,0x6008,p+48);put(p+48,array);assert.equal(await call('VariantClear',[p+16]),0);assert.equal(word(p+48),array);assert.equal(readString(strs[2]),'last');
  assert.equal(await call('VariantClear',[p]),0);assert.deepEqual(m.read(p,16),new Uint8Array(16));
 };
 for(let i=0;i<4;i++)await exercise();const heap=e.get_heap_ptr();for(let i=0;i<128;i++)await exercise();assert.equal(e.get_heap_ptr(),heap,'all owned element strings, data and descriptors reclaimed');
 assert.equal(await call('SafeArrayAccessData',[0,p+64]),0x80070057);assert.equal(await call('SafeArrayDestroy',[0]),0);

 // Both resolver paths expose the same real three-argument native ABI.
 const dll=a.string('oleaut32.dll',false),name=a.string('SafeArrayGetElement',false),module=await api('LoadLibraryA',[dll]);assert(module);
 const named=await api('GetProcAddress',[module,name]),ordinal=await api('GetProcAddress',[module,25]);assert(named&&ordinal);m.free(dll);m.free(name);
 const get=async(array,indices,out=p+72)=>{indices.forEach((v,i)=>put(p+128+i*4,v));return call('SafeArrayGetElement',[array,p+128,out]);};
 const getCycle=async()=>{
  const array=await create([[2,-3],[3,7]]);assert.equal(await call('SafeArrayAccessData',[array,p+64]),0);const data=word(p+64),source=await str('own\0tail');put(data+20,source);
  // Rightmost dimension index first; non-square sizes and unequal/negative
  // lower bounds ensure a transposed or one-based implementation fails.
  assert.equal(await get(array,[-2,9]),0);const clone=word(p+72);assert.notEqual(clone,source);assert.equal(readString(clone),'own\0tail');assert.equal(word(array+8),1);
  put(p+72,0x12345678);assert.equal(await get(array,[-4,9]),0x8002000b);assert.equal(word(p+72),0x12345678);
  assert.equal(await get(array,[-2,10]),0x8002000b);assert.equal(word(p+72),0x12345678);
  assert.equal(await get(array,[-3,7]),0);assert.equal(word(p+72),0,'null BSTR stays null');
  put(p+128,-2);put(p+132,9);assert.equal(await c.invoke(ordinal,[array,p+128,p+72]),0);const second=word(p+72);assert(second&&second!==clone&&second!==source);
  assert.equal(await call('SafeArrayUnaccessData',[array]),0);assert.equal(await call('SafeArrayDestroy',[array]),0);
  assert.equal(readString(clone),'own\0tail');assert.equal(readString(second),'own\0tail');await call('SysFreeString',[clone]);await call('SysFreeString',[second]);
 };
 for(let i=0;i<4;i++)await getCycle();const getHeap=e.get_heap_ptr();for(let i=0;i<128;i++)await getCycle();assert.equal(e.get_heap_ptr(),getHeap,'retrieved owners reclaimed independently');
 put(p+80,3);put(p+84,-1);const ints=await call('SafeArrayCreate',[3,1,p+80]);assert(ints);const intData=word(ints+12);put(intData,100);put(intData+4,200);put(intData+8,300);
 assert.equal(await get(ints,[0]),0);assert.equal(word(p+72),200);
 put(ints+8,0xffffffff);put(p+72,0x11223344);assert.equal(await get(ints,[0]),0x8000ffff);assert.equal(word(p+72),0x11223344);assert.equal(word(ints+8),0xffffffff);put(ints+8,0);
 put(ints+4,8);assert.equal(await get(ints,[0]),0x80070057);assert.equal(word(p+72),0x11223344);put(ints+4,4);assert.equal(await call('SafeArrayDestroy',[ints]),0);
 assert.equal(await get(0,[0]),0x80070057);assert.equal(await get(0,[0],0),0x80070057);

 const putName=a.string('SafeArrayPutElement',false),putNamed=await api('GetProcAddress',[module,putName]),putOrdinal=await api('GetProcAddress',[module,26]);assert(putNamed&&putOrdinal);m.free(putName);
 const assign=async(array,indices,value)=>{indices.forEach((v,i)=>put(p+128+i*4,v));return call('SafeArrayPutElement',[array,p+128,value]);};
 const putCycle=async()=>{
  const array=await create([[2,-3],[3,7]]),data=word(array+12),incoming=await str('new\0owner');
  assert.equal(await assign(array,[-2,9],incoming),0);const owned=word(data+20);assert(owned&&owned!==incoming);assert.equal(readString(owned),'new\0owner');
  await call('SysFreeString',[incoming]);assert.equal(readString(owned),'new\0owner');
  assert.equal(await assign(array,[-2,9],owned),0);const replacement=word(data+20);assert(replacement&&replacement!==owned);assert.equal(readString(replacement),'new\0owner');
  const before=m.read(data,24);assert.equal(await assign(array,[-2,10],replacement),0x8002000b);assert.deepEqual(m.read(data,24),before);assert.equal(word(array+8),0);
  // The API automatically adds/removes its own lock, preserving the caller's.
  assert.equal(await call('SafeArrayAccessData',[array,p+64]),0);assert.equal(await assign(array,[-2,9],0),0);assert.equal(word(data+20),0);assert.equal(word(array+8),1);
  put(p+128,-3);put(p+132,7);const next=await str('ordinal');assert.equal(await c.invoke(putOrdinal,[array,p+128,next]),0);await call('SysFreeString',[next]);assert.equal(readString(word(data)),'ordinal');
  put(array+8,0xffffffff);const unchanged=word(data);assert.equal(await assign(array,[-3,7],0),0x8000ffff);assert.equal(word(data),unchanged);put(array+8,1);
  assert.equal(await call('SafeArrayUnaccessData',[array]),0);assert.equal(await call('SafeArrayDestroy',[array]),0);
 };
 for(let i=0;i<4;i++)await putCycle();const putHeap=e.get_heap_ptr();for(let i=0;i<128;i++)await putCycle();assert.equal(e.get_heap_ptr(),putHeap,'put replacements and caller strings have distinct reclaimed ownership');
 put(p+80,3);put(p+84,-1);const numbers=await call('SafeArrayCreate',[3,1,p+80]);put(p+160,0x88776655);assert.equal(await assign(numbers,[0],p+160),0);assert.equal(await get(numbers,[0]),0);assert.equal(word(p+72),0x88776655);
 assert.equal(await assign(numbers,[0],0),0x80070057);assert.equal(await get(numbers,[0]),0);assert.equal(word(p+72),0x88776655);assert.equal(await call('SafeArrayDestroy',[numbers]),0);
 assert.equal(await assign(0,[0],0),0x80070057);
 m.free(p);await m.drain();assert.equal(c.frames.length,0);
 console.log(JSON.stringify({ok:true,moduleSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),nativeBSTRArray:true,nativeGetElementOrdinal25:true,nativePutElementOrdinal26:true,aliasedReplacement:true,independentCopies:true,boundsErrors:true,dimensions:2,countedStrings:true,lockedClearAtomic:true,borrowedOwner:true,exactFrame:true,ownershipCycles:128,heapStable:true}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
