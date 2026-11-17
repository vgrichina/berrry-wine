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
 // Exact iKernel 40e921/40e924/40e92a caller bytes: push [ebp+8],
 // call [46c290], cmp eax,1. Observe EAX and ESP before restoring the
 // caller frame, so continuation restoration cannot hide wrong ret 8.
 const exactDll=a.string('oleaut32.dll',false),exactModule=await api('LoadLibraryA',[exactDll]);m.free(exactDll);
 const exactOrdinal=await api('GetProcAddress',[exactModule,17]);assert(exactOrdinal);
 const exactRows=[];
 for(const dimensions of [1,2,3]){
  const array=await create(Array.from({length:dimensions},()=>[1,0])),out=p+192,canary=p+224;
  put(canary,0x13579bdf);put(canary+4,0x2468ace0);put(out+16,0xabcdef12);
  put(0x46c290,exactOrdinal);
  // prologue ends at 40e921. Store observations after CMP, then restore
  // from EBP and RET 4, even in the intentionally wrong-map control.
  const code=Buffer.from('5589e5ff7508ff1590c2460083f801a3000000008925000000000f940500000000892d0000000089ec5dc20400','hex');
  code.writeUInt32LE(out,16);code.writeUInt32LE(out+4,22);code.writeUInt32LE(out+8,29);code.writeUInt32LE(out+12,35);
  m.write(0x40e91e,code);
  const savedEbp=e.get_ebp();e.set_ebp(canary);
  try{await c.invoke(0x40e91e,[array]);}finally{e.set_ebp(savedEbp);}
  const row={dimensions,eax:word(out),esp:word(out+4),expectedESP:word(out+12),equalOne:m.read(out+8,1)[0],canaries:[word(canary),word(canary+4),word(out+16)]};
  row.pass=row.eax===dimensions&&row.esp===row.expectedESP&&row.equalOne===(dimensions===1?1:0)&&row.canaries[0]===0x13579bdf&&row.canaries[1]===0x2468ace0&&row.canaries[2]===0xabcdef12;
  exactRows.push(row);
  if(process.env.SAFEARRAY_OLD_MAPPING_CONTROL){const clone=word(canary);if(clone&&clone!==0x13579bdf)await call('SafeArrayDestroy',[clone]);}
  await call('SafeArrayDestroy',[array]);
 }
 console.log(JSON.stringify({exactIKernelCaller:true,rows:exactRows}));
 if(process.env.SAFEARRAY_OLD_MAPPING_CONTROL){assert(exactRows.every(x=>!x.pass),'old ordinal17 Copy must fail exact one-arg caller');m.free(p);await m.drain();return;}
 assert(exactRows.every(x=>x.pass),'ordinal17 must return dimensions, ret4, and preserve canaries');
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

 const copyName=a.string('SafeArrayCopy',false),copyNamed=await api('GetProcAddress',[module,copyName]),copyOrdinal=await api('GetProcAddress',[module,27]);assert(copyNamed&&copyOrdinal);m.free(copyName);
 const copyCall=async args=>{const before=frame(),v=await c.invoke(copyOrdinal,args);assert.deepEqual(frame(),before);assert.equal(c.frames.length,0);return v;};
 assert.equal(await c.invoke(copyNamed,[0,p+72]),0);assert.equal(word(p+72),0);
 assert.equal(await copyCall([0,0]),0x80070057);put(p+72,0x12345678);assert.equal(await copyCall([0,p+72]),0);assert.equal(word(p+72),0);
 const copyCycle=async()=>{
  const array=await create([[2,-3],[3,7]]),data=word(array+12);
  for(const [i,text]of [[0,'first\0tail'],[2,''],[5,'last']])put(data+4*i,await str(text));
  assert.equal(await call('SafeArrayAccessData',[array,p+64]),0);
  assert.equal(await copyCall([array,p+72]),0);const copied=word(p+72),copiedData=word(copied+12);assert(copied!==array&&copiedData!==data);
  assert.equal(word(array+8),1);assert.equal(word(copied+8),0);assert.deepEqual(m.read(copied+16,16),m.read(array+16,16));
  for(let i=0;i<6;i++){const old=word(data+4*i),cloned=word(copiedData+4*i);if(old){assert(cloned&&old!==cloned);assert.equal(readString(cloned),readString(old));}else assert.equal(cloned,0);}
  // Fail after one BSTR was cloned. The oversized counted prefix is an
  // authored allocation-refusal fixture; restore it before freeing source.
  const failing=word(data+8),length=word(failing-4);put(failing-4,0x7ffffff0);put(p+72,0x12345678);
  try{assert.equal(await copyCall([array,p+72]),0x8007000e);assert.equal(word(p+72),0);assert.equal(word(array+8),1);}finally{put(failing-4,length);}
  assert.equal(await call('SafeArrayUnaccessData',[array]),0);assert.equal(await call('SafeArrayDestroy',[array]),0);
  assert.equal(readString(word(copiedData)),'first\0tail');assert.equal(readString(word(copiedData+20)),'last');
  assert.equal(await call('SafeArrayDestroy',[copied]),0);
 };
 for(let i=0;i<4;i++)await copyCycle();const copyHeap=e.get_heap_ptr();for(let i=0;i<128;i++)await copyCycle();assert.equal(e.get_heap_ptr(),copyHeap,'copied owners and partially staged failure owners reclaimed');
 const emptyCopy=await create([[0,-7],[2,5]]);assert.equal(await c.invoke(copyOrdinal,[emptyCopy,p+72]),0);const emptyClone=word(p+72);assert(emptyClone&&emptyClone!==emptyCopy);assert.equal(word(emptyClone+12),0);assert.equal(await call('SafeArrayDestroy',[emptyCopy]),0);assert.equal(await call('SafeArrayDestroy',[emptyClone]),0);
 put(p+80,2);put(p+84,-2);const values=await call('SafeArrayCreate',[5,1,p+80]);const valueData=word(values+12);m.write(valueData,Uint8Array.from({length:16},(_,i)=>i*13));assert.equal(await copyCall([values,p+72]),0);const scalarClone=word(p+72);assert.deepEqual(m.read(word(scalarClone+12),16),m.read(valueData,16));assert.equal(await call('SafeArrayDestroy',[scalarClone]),0);
 put(values+8,0xffffffff);assert.equal(await copyCall([values,p+72]),0x8000ffff);assert.equal(word(p+72),0);put(values+8,0);
 put(values+4,4);assert.equal(await copyCall([values,p+72]),0x80070057);assert.equal(word(p+72),0);put(values+4,8);
 // Descriptor/data allocation failure must not publish or free source data.
 put(values+16,0x10000000);assert.equal(await copyCall([values,p+72]),0x8007000e);assert.equal(word(p+72),0);assert.equal(word(values+12),valueData);put(values+16,2);
 assert.equal(await call('SafeArrayDestroy',[values]),0);

 const ptrName=a.string('SafeArrayPtrOfIndex',false),ptrNamed=await api('GetProcAddress',[module,ptrName]),ptrOrdinal=await api('GetProcAddress',[module,148]);assert(ptrNamed&&ptrOrdinal);m.free(ptrName);
 const ptrArray=await create([[2,-2],[3,7],[4,-9]]),ptrData=word(ptrArray+12);assert.equal(await call('SafeArrayAccessData',[ptrArray,p+64]),0);
 const pointer=async(array,indices,out=p+72)=>{indices.forEach((v,i)=>put(p+128+i*4,v));return call('SafeArrayPtrOfIndex',[array,p+128,out]);};
 assert.equal(await pointer(ptrArray,[-1,9,-6]),0);assert.equal(word(p+72),ptrData+23*4);assert.equal(word(ptrArray+8),1);
 const borrowed=word(p+72),borrowedString=await str('borrowed\0element');put(borrowed,borrowedString);assert.equal(await get(ptrArray,[-1,9,-6]),0);const retrieved=word(p+72);assert(retrieved!==borrowedString);assert.equal(readString(retrieved),'borrowed\0element');await call('SysFreeString',[retrieved]);
 for(const indices of [[-3,9,-6],[-1,10,-6],[-1,9,-5],[0x7fffffff,9,-6],[-0x80000000,9,-6]]){put(p+72,0x11223344);assert.equal(await pointer(ptrArray,indices),0x8002000b);assert.equal(word(p+72),0x11223344);assert.equal(word(ptrArray+8),1);}
 put(p+128,-2);put(p+132,7);put(p+136,-9);assert.equal(await c.invoke(ptrOrdinal,[ptrArray,p+128,p+72]),0);assert.equal(word(p+72),ptrData);
 assert.equal(await pointer(ptrArray,[-2,7,-9],0),0x80070057);assert.equal(await pointer(0,[0]),0x80070057);assert.equal(await call('SafeArrayPtrOfIndex',[ptrArray,0,p+72]),0x80070057);
 assert.equal(await call('SafeArrayUnaccessData',[ptrArray]),0);assert.equal(await call('SafeArrayDestroy',[ptrArray]),0);
 // Pointer lookup is layout-based and also works for valid descriptors with
 // no VARTYPE prefix, including fixed-size records with caller-owned data.
 const record=m.allocate(24),recordData=m.allocate(32);m.write(record,new Uint8Array(24));dv.setUint16(address(record),1,true);dv.setUint16(address(record+2),2,true);put(record+4,16);put(record+8,1);put(record+12,recordData);put(record+16,2);put(record+20,-5);
 assert.equal(await pointer(record,[-4]),0);assert.equal(word(p+72),recordData+16);assert.equal(word(record+8),1);
 put(record+4,0);put(p+72,0x11223344);assert.equal(await pointer(record,[-4]),0x80070057);assert.equal(word(p+72),0x11223344);put(record+4,16);put(record+16,0);assert.equal(await pointer(record,[-5]),0x8002000b);m.free(recordData);m.free(record);
 const dimName=a.string('SafeArrayGetDim',false),dimNamed=await api('GetProcAddress',[module,dimName]),dimOrdinal=await api('GetProcAddress',[module,17]);assert(dimNamed&&dimOrdinal);m.free(dimName);
 assert.equal(await api('GetProcAddress',[module,202]),0,'CreateErrorInfo must never resolve to a SAFEARRAY function');
 ctx.apiTable=table;const hostDll=a.string('OLEAUT32.DLL',false);
 for(const [ord,n]of [[17,'SafeArrayGetDim'],[27,'SafeArrayCopy'],[148,'SafeArrayPtrOfIndex']])assert.equal(imports.host.resolve_ordinal(address(hostDll),ord),table.find(x=>x.name===n).id);
 assert.equal(imports.host.resolve_ordinal(address(hostDll),202),-1);m.free(hostDll);
 assert.equal(await call('SafeArrayGetDim',[0]),0);
 for(const dims of [[[1,0]],[[2,-3],[3,7]],[[2,-2],[3,7],[4,-9]]]){const array=await create(dims),before=m.read(array-4,20+dims.length*8);assert.equal(await call('SafeArrayGetDim',[array]),dims.length);const frameBefore=frame();assert.equal(await c.invoke(dimOrdinal,[array]),dims.length);assert.deepEqual(frame(),frameBefore);assert.deepEqual(m.read(array-4,20+dims.length*8),before);assert.equal(await call('SafeArrayDestroy',[array]),0);}
 // Public native bounds queries use one-based dimensions and reversed
 // descriptor order, including empty and extreme signed lower bounds.
 const boundThunks={};
 for(const [ordinal,name]of [[20,'SafeArrayGetLBound'],[19,'SafeArrayGetUBound']]){
  const text=a.string(name,false),named=await api('GetProcAddress',[module,text]),ord=await api('GetProcAddress',[module,ordinal]);m.free(text);assert(named&&ord);boundThunks[name]=ord;
  const dll=a.string('OLEAUT32.DLL',false);assert.equal(imports.host.resolve_ordinal(address(dll),ordinal),table.find(x=>x.name===name).id);m.free(dll);
 }
 const bound=async(name,array,dim,out=p+72)=>{const before=frame(),hr=await c.invoke(boundThunks[name],[array,dim,out]);assert.deepEqual(frame(),before);assert.equal(c.frames.length,0);return hr;};
 for(const dims of [[[2,-3],[3,7],[4,-9]],[[0,-7],[2,5]],[[1,-2147483648]],[[1,2147483647]]]){
  const array=await create(dims),descriptor=m.read(array-4,20+dims.length*8),data=word(array+12);
  for(let i=0;i<dims.length;i++){
   assert.equal(await bound('SafeArrayGetLBound',array,i+1),0);assert.equal(word(p+72),dims[i][1]>>>0);
   assert.equal(await bound('SafeArrayGetUBound',array,i+1),0);assert.equal(word(p+72),(dims[i][1]+dims[i][0]-1)>>>0);
  }
  for(const name of Object.keys(boundThunks)){
   for(const dim of [0,dims.length+1,0xffffffff]){put(p+72,0x12345678);assert.equal(await bound(name,array,dim),0x8002000b);assert.equal(word(p+72),0x12345678);}
   assert.equal(await bound(name,array,1,0),0x80070057);put(p+72,0x12345678);assert.equal(await bound(name,0,1),0x80070057);assert.equal(word(p+72),0x12345678);
  }
  assert.deepEqual(m.read(array-4,20+dims.length*8),descriptor);assert.equal(word(array+12),data);assert.equal(await call('SafeArrayDestroy',[array]),0);
 }
 const boundDescriptor=m.allocate(24);m.write(boundDescriptor,new Uint8Array(24));dv.setUint16(address(boundDescriptor),1,true);put(boundDescriptor+16,2);put(boundDescriptor+20,0x7fffffff);put(p+72,0x11223344);
 assert.equal(await bound('SafeArrayGetUBound',boundDescriptor,1),0x8002000a);assert.equal(word(p+72),0x11223344);
 put(boundDescriptor+16,0);put(boundDescriptor+20,0x80000000);assert.equal(await bound('SafeArrayGetUBound',boundDescriptor,1),0x8002000a);assert.equal(word(p+72),0x11223344);
 // Metadata does not require VARTYPE, element data, or a new array lock.
 dv.setUint16(address(boundDescriptor),65,true);put(boundDescriptor+20,-42);put(boundDescriptor+8,9);assert.equal(await bound('SafeArrayGetLBound',boundDescriptor,65),0);assert.equal(word(p+72),(-42)>>>0);assert.equal(word(boundDescriptor+8),9);m.free(boundDescriptor);
 m.free(p);await m.drain();assert.equal(c.frames.length,0);
 console.log(JSON.stringify({ok:true,moduleSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),nativeLBoundOrdinal20:true,nativeUBoundOrdinal19:true,boundOverflowAtomic:true,nativeBSTRArray:true,nativeGetDimOrdinal17:true,ordinal202Closed:true,nativeGetElementOrdinal25:true,nativePutElementOrdinal26:true,nativeCopyOrdinal27:true,nativePtrOfIndexOrdinal148:true,borrowedAddress:true,partialCopyRollback:true,aliasedReplacement:true,independentCopies:true,boundsErrors:true,dimensions:2,countedStrings:true,lockedClearAtomic:true,borrowedOwner:true,exactFrame:true,ownershipCycles:128,heapStable:true}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
