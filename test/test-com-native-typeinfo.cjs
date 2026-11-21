'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createHostImports}=require('../lib/host-imports'),{VirtualFS}=require('../lib/filesystem');
const {ComInterfaceRuntime,comRuntimeSourcePin}=require('../lib/com-interface-runtime');
const {OwnedComAuthority}=require('../lib/com-owned-channel'),{dispatchCom}=require('../lib/com-owned-transport');
const {HResult,HR}=require('../lib/com-standard-marshaler');
const {IID_INFO,IID_LIB,IID_DISPATCH}=require('../lib/com-automation-contracts');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const d32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
async function main(){
 const wasm=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||'build/wine-assembly.compat.wasm');
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const vfs=new VirtualFS();require('../lib/storage').clearStore();
 const resource=require('./test-sims-typelib-native.cjs').resource();vfs.files.set('c:\\sims.tlb',{data:resource.data,attrs:32});
 const ctx={getMemory:()=>memory.buffer,vfs,renderer:null,resourceJson:{}};
 const imports=createHostImports(ctx);imports.host.memory=memory;
 const e=new WebAssembly.Instance(new WebAssembly.Module(wasm),imports).exports;ctx.exports=e;
 const pe=require('../tools/kernel32-native-fixture').makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
 e.set_esp(0x074ff000);e.set_eip(0);e.set_yield_state(0,0);
 const authority=new OwnedComAuthority(),session=authority.connect('owned-native-typeinfo');let retired=false;
 const runtime=new ComInterfaceRuntime({getExports:()=>e,getMemory:()=>memory.buffer,getVfs:()=>vfs,
  desktop:{call:r=>dispatchCom(authority,session,r)},serviceYield:async()=>false,modulePin:sha(wasm),sourcePin:comRuntimeSourcePin(),isRetired:()=>retired});ctx.comInterfaces=runtime;
 const {c,m,automation:a,proxy,transport}=runtime.initialize(),v=a.contracts.v;
 const allocations=new Set(),allocate=m.allocate.bind(m),free=m.free.bind(m);
 m.allocate=n=>{const at=allocate(n);assert(!allocations.has(at));allocations.add(at);return at;};
 m.free=at=>{allocations.delete(at);free(at);};
 const apiTable=require('../src/api_table.json');
 const thunk=name=>{const table=e.com_bridge_vtable(apiTable.find(x=>x.name===name).id,1),p=c.word(table);e.guest_free(table);return p;};
 const invoke=(name,args)=>c.invoke(thunk(name),args),p=m.allocate(256),read=x=>c.word(x),put=(x,n)=>c.putWord(x,n);
 const pin=x=>m.write(p,Buffer.from(x,'hex'));
 const code=b=>{const q=m.allocate(b.length);m.write(q,Uint8Array.from(b));return q;};
 const snapshot=()=>({regs:['eax','ecx','edx','ebx','esp','ebp','esi','edi'].map(r=>e['get_'+r]()>>>0),eip:e.get_eip(),fs:e.get_fs_base(),thunk:e.com_callback_get_thunk(),ip:e.com_callback_get_ip(),yield:e.get_yield_reason(),flags:Array.from({length:6},(_,i)=>e.com_callback_get_flags(e.com_owner_token(),i))});
 const checked=async(object,slot,args)=>{const before=snapshot(),hr=await c.call(object,slot,args);assert.deepEqual(snapshot(),before);assert.equal(c.frames.length,0);return hr;};
 const original=a.string('c:\\sims.tlb',true);assert.equal(await invoke('LoadTypeLib',[original,p+16]),0);const lib=read(p+16);
 assert.equal(await invoke('RegisterTypeLib',[lib,original,0]),0);
 const derivedIID='c14e8191f0b5d21180b900104b1f6cea',mediaIID='bf4e8191f0b5d21180b900104b1f6cea';
 pin(derivedIID);assert.equal(await checked(lib,6,[p,p+16]),0);const ti=read(p+16);
 for(const [iid,clsid]of [[IID_INFO,'2204020000000000c000000000000046'],[IID_LIB,'2304020000000000c000000000000046'],[IID_DISPATCH,'2004020000000000c000000000000046']]){
  pin(iid);assert.equal(await invoke('CoGetPSClsid',[p,p+32]),0);assert.equal(m.guid(p+32),clsid);
  const factory=await m.factory(iid);assert(factory);pin('0000000000000000c000000000000046');
  assert.equal(await checked(factory,0,[p,p+48]),0);assert.equal(read(p+48),factory);await m.release(read(p+48));
  pin('ffffffffffffffffffffffffffffffff');put(p+48,123);assert.equal(await checked(factory,0,[p,p+48]),HR.NOINTERFACE);assert.equal(read(p+48),0);
  put(p+48,123);put(p+52,456);assert.equal(await checked(factory,3,[1,p,p+48,p+52]),HR.NOINTERFACE);assert.equal(read(p+48),0);assert.equal(read(p+52),0);
  put(p+48,123);assert.equal(await checked(factory,4,[p,0,p+48]),HR.NOINTERFACE);assert.equal(read(p+48),0);
  await m.release(factory);
 }
 async function remote(object,iid){pin(iid);const packet=await m.marshalReference(p,object);assert.equal(packet.hresult,0);assert(packet.reference);
  assert.equal(await proxy.unmarshalReference(packet.reference,p,p+48),0);const result=read(p+48);assert(result&&result!==object);return result;}
 const rt=await remote(ti,IID_INFO),rl=await remote(lib,IID_LIB);
 pin('0000000000000000c000000000000046');const rtRow=a.objects.get(rt).proxy;
 assert.equal(await checked(rt,0,[p,p+48]),0);assert.equal(read(p+48),rtRow.outer);await m.release(read(p+48));
 assert.equal(await checked(rtRow.address,0,[p,p+48]),0);assert.equal(read(p+48),rtRow.address);assert.notEqual(read(p+48),rtRow.outer);await m.release(read(p+48));
 assert.equal(await checked(rl,3,[]),await checked(lib,3,[]));
 assert.equal(await checked(rt,3,[p+48]),0);const attr=read(p+48);assert.equal(m.guid(attr),derivedIID);assert.equal(read(attr+40),3);
 // A graph owns its allocations and an outer reference independently of the
 // caller's interface reference. Release must match both owner and descriptor.
 const lease=a.contracts.leases.get(attr);assert(lease);assert.equal(await checked(rt,19,[attr]),0);
 assert.equal(await checked(rt,19,[attr]),HR.INVALID);
 assert.equal(await checked(rt,5,[7,p+48]),0);const fd=read(p+48);assert.equal(read(fd),7);assert.equal(v.half(fd+28),56);
 const params=read(fd+8);assert(params);assert.equal(v.half(params+4),26);assert(read(params));
 assert.equal(v.half(read(params)+4),8);assert.equal(await checked(rt,20,[fd]),0);
 assert.equal(await checked(rt,5,[0xffffffff,p+48]),0x8002802b);assert.equal(read(p+48),0,'true failed native descriptor output');
 assert.equal(await checked(rt,7,[7,p+64,4,p+96]),0);assert.equal(read(p+96),2);
 assert.equal(Buffer.from(m.read(read(p+64),read(read(p+64)-4))).toString('utf16le'),'File');
 for(let i=0;i<read(p+96);i++)await v.freeBstr(read(p+64+i*4));
 assert.equal(await checked(rt,8,[0,p+48]),0);const href=read(p+48);
 assert.equal(await checked(rt,14,[href,p+48]),0);const parent=read(p+48);assert(parent);
 assert.equal(await checked(parent,3,[p+48]),0);const parentAttr=read(p+48);assert.equal(m.guid(parentAttr),IID_DISPATCH);await checked(parent,19,[parentAttr]);await m.release(parent);
 assert.equal(await checked(rt,18,[p+48,p+52]),0);const containing=read(p+48);assert.equal(await checked(containing,3,[]),await checked(lib,3,[]));await m.release(containing);
 assert.equal(await checked(rl,7,[p+48]),0);const la=read(p+48);assert.equal(await checked(rl,12,[la]),0);
 // A malformed late output rejects the whole native response after BSTR
 // decoding, keeping all original caller slots and descriptor leases intact.
 const exchange=a.exchange.bind(a);a.exchange=async(...args)=>{const reply=await exchange(...args);reply[4][3]=-1;return reply;};
 for(const off of [112,116,120,124])put(p+off,0xdeadbeef);
 assert.equal(await checked(rt,12,[0xffffffff,p+112,p+116,p+120,p+124]),HR.INVALID);
 for(const off of [112,116,120,124])assert.equal(read(p+off),0xdeadbeef);
 a.exchange=exchange;
 const unsupportedBefore=authority.requests.size;assert.equal(await checked(rt,15,[0,0,0]),HR.NOTIMPL);assert.equal(authority.requests.size,unsupportedBefore,'local-only not sent');
 // ITypeInfo names are a counted array of terminated UTF-16 strings. Its
 // output is one DISPID per name, including native failure sentinels.
 for(const spelling of ['File','fIlE','NoSuchMember']){
  const q=a.string(spelling,true);put(p+64,q);put(p+100,0xdeadbeef);put(p+104,0xdeadbeef);
  try{
   const hr=await checked(ti,10,[p+64,1,p+104]);
   assert.equal(await checked(rt,10,[p+64,1,p+100]),hr,'native name lookup HRESULT');
   assert.equal(read(p+100),read(p+104),'native name lookup DISPID');
   if(spelling==='File')assert.equal(read(p+100),7);
  }finally{m.free(q);}
 }
 assert.equal(await checked(rt,7,[7,p+64,4,p+96]),0);assert.equal(read(p+96),2);
 assert.equal(await checked(rt,10,[p+64,2,p+100]),0);
 assert.equal(read(p+100),7);assert.equal(read(p+104),0,'native parameter ordinal');
 for(let i=0;i<2;i++)await v.freeBstr(read(p+64+i*4));
 // Validate every ID before publication, even after a valid first result.
 const namesBefore=allocations.size,namesExchange=a.exchange.bind(a),namePair=[a.string('File',true),a.string('File',true)];
 put(p+64,namePair[0]);put(p+68,namePair[1]);put(p+100,0xdeadbeef);put(p+104,0xdeadbeef);
 a.exchange=async(...args)=>{const reply=await namesExchange(...args);if(args[1]===10)reply[4][2]=[7,-1];return reply;};
 assert.equal(await checked(rt,10,[p+64,2,p+100]),HR.INVALID);
 assert.equal(read(p+100),0xdeadbeef);assert.equal(read(p+104),0xdeadbeef);a.exchange=namesExchange;
 for(const q of namePair)m.free(q);assert.equal(allocations.size,namesBefore);
 assert.equal(await checked(rt,10,[0,1,p+100]),HR.POINTER);
 assert.equal(await checked(rt,10,[p+64,16385,p+100]),HR.INVALID);
 // Malformed wire names cannot be interpreted as shorter native names.
 for(const value of [null,'410','410000004200',42]){
  const scope=v.scope();try{await assert.rejects(a.contracts.decodeInput({k:'names',n:1},[value],[0,1],scope),e=>e instanceof HResult&&e.value===HR.INVALID);}
  finally{await scope.close();}
 }
 // Malformed graphs cannot create a lease or survive failed reconstruction.
 for(const bad of [{vt:26,value:null},{vt:28,value:{bounds:'00000000',element:{vt:3,value:null}}},{vt:29,value:-1}]){
  const scope=v.scope();await assert.rejects(v.readDescriptor('typedesc',bad,scope));await scope.close();
 }
 const readDescriptor=v.readDescriptor.bind(v),beforeFault=allocations.size;
 v.readDescriptor=async(...args)=>{v.readDescriptor=readDescriptor;const alloc=m.allocate;let calls=0;
  m.allocate=n=>{if(++calls===2)throw new HResult(0x8007000e);return alloc(n);};
  try{return await readDescriptor(...args);}finally{m.allocate=alloc;}};
 put(p+48,0xdeadbeef);assert.equal(await checked(rt,5,[7,p+48]),0x8007000e);assert.equal(read(p+48),0xdeadbeef);
 await m.drain();assert.equal(allocations.size,beforeFault,'partial descriptor allocation rollback');
 // Real IDispatch-derived authored server with native metadata and WAT Invoke.
 const loaded=await a.info(derivedIID),meta=loaded.meta;await m.release(loaded.ti);for(const [s,method]of meta.methods)if(s>=3)a.validate(method);
 assert(meta.methods.get(4).contract);assert(meta.methods.get(6).contract);
 const server=m.allocate(16),table=m.allocate(80),codes=[];put(server,table);put(server+4,1);
 const addCode=b=>{const q=code(b);codes.push(q);return q;};
 put(table,addCode([0x8b,0x44,0x24,4,0x8b,0x54,0x24,8,0x8b,0x4c,0x24,12,0xc7,1,0,0,0,0,
  0x83,0x3a,3,0x74,10,0x89,1,0xff,0x40,4,0x31,0xc0,0xc2,12,0,0xb8,2,0x40,0,0x80,0xc2,12,0]));
 put(table+4,addCode([0x8b,0x4c,0x24,4,0xff,0x41,4,0x8b,0x41,4,0xc2,4,0]));
 put(table+8,addCode([0x8b,0x4c,0x24,4,0xff,0x49,4,0x8b,0x41,4,0xc2,4,0]));
 put(table+12,addCode([0x8b,0x44,0x24,8,0xc7,0,1,0,0,0,0x31,0xc0,0xc2,8,0]));
 put(table+16,addCode([0x68,...d32(ti),0xb8,...d32(c.method(ti,1)),0xff,0xd0,0x8b,0x44,0x24,16,0xc7,0,...d32(ti),0x31,0xc0,0xc2,16,0]));
 // IDispatch names forward to real native ITypeInfo; LCID is kept on the
 // actual original frame, not guessed by a host metadata substitute.
 put(table+20,addCode([0x8b,0xd4,0xff,0x72,24,0xff,0x72,16,0xff,0x72,12,0x68,...d32(ti),0xb8,...d32(c.method(ti,10)),0xff,0xd0,0xc2,24,0]));
 put(table+24,addCode([0x8b,0xd4,0xff,0x72,36,0xff,0x72,32,0xff,0x72,28,0xff,0x72,24,0xff,0x72,20,0xff,0x72,8,0x68,...d32(ti),0xff,0x72,4,0xb8,...d32(thunk('DispInvoke')),0xff,0xd0,0xc2,36,0]));
 // Native File retval allocates a real counted string through SysAllocString.
 const text=a.string('Owned\u0000Tail',true);
 put(table+56,addCode([0x68,...d32(10),0x68,...d32(text),0xb8,...d32(thunk('SysAllocStringLen')),0xff,0xd0,0x8b,0x54,0x24,8,0x89,2,0x31,0xc0,0xc2,8,0]));
 // A separate real x86 media object returns the IDispatch-derived face
 // through its actual typed OpenCAB signature and normal output marshaler.
 const media=m.allocate(16),mediaTable=m.allocate(20);put(media,mediaTable);put(media+4,1);
 for(let i=0;i<3;i++)put(mediaTable+i*4,read(table+i*4));
 put(mediaTable+16,addCode([0xff,0x05,...d32(server+4),0x8b,0x44,0x24,12,0xc7,0,...d32(server),0x31,0xc0,0xc2,12,0]));
 const mediaProxy=await remote(media,mediaIID),inputBstr=v.readBstr(Buffer.from('data1.hdr','utf16le').toString('hex'));
 assert.equal(await checked(mediaProxy,4,[inputBstr,p+48]),0);const derived=read(p+48);assert(derived&&derived!==server);
 await v.freeBstr(inputBstr);await m.release(mediaProxy);await m.drain();assert.equal(read(media+4),1);

 assert.equal(await checked(derived,3,[p+48]),0);assert.equal(read(p+48),1);
 assert.equal(await checked(derived,4,[0,1033,p+48]),0);const returnedInfo=read(p+48);assert(returnedInfo&&returnedInfo!==ti);
 assert.equal(await checked(returnedInfo,3,[p+48]),0);const returnedAttr=read(p+48);assert.equal(m.guid(returnedAttr),derivedIID);await checked(returnedInfo,19,[returnedAttr]);await m.release(returnedInfo);
 const name=a.string('File',true);put(p+64,name);m.write(p+80,new Uint8Array(16));
 assert.equal(await checked(derived,5,[p+80,p+64,1,1033,p+100]),0);assert.equal(read(p+100),7);
 assert.equal(await checked(derived,14,[p+104]),0);const bs=read(p+104);assert.equal(v.bstr(bs),Buffer.from('Owned\u0000Tail','utf16le').toString('hex'));await v.freeBstr(bs);
 const dp=m.allocate(16),result=m.allocate(16);
 assert.equal(await checked(derived,6,[7,p+80,1033,2,dp,result,0,0]),0);assert.equal(v.half(result),8);
 assert.equal(v.bstr(read(result+8)),Buffer.from('Owned\u0000Tail','utf16le').toString('hex'));await v.freeBstr(read(result+8));
 // An authored native Invoke control validates aliased BYREF storage on
 // the actual server frame, updates it and returns the real error HRESULT.
 const originalInvoke=read(table+24),deferred=addCode([0x8b,0x44,0x24,4,0xc7,0x40,28,5,0,2,128,0x31,0xc0,0xc2,4,0]);
 put(table+24,addCode([0x8b,0x44,0x24,24,0x8b,0x00,0x8b,0x48,8,0x3b,0x48,24,0x75,22,
  0xc7,1,0x21,0x43,0x65,0x87,0x8b,0x44,0x24,32,0xc7,0x40,24,...d32(deferred),0xb8,9,0,2,128,0xc2,36,0,
  0xb8,0x57,0,7,128,0xc2,36,0]));
 const inputScope=v.scope(),callParams=await v.readDispParams({values:[{vt:0x4003,ref:0,value:'78563412'},{vt:0x4003,ref:0}],named:[0xfffffffd]},inputScope);
 const excep=inputScope.alloc(32),argerr=inputScope.alloc(4);
 assert.equal(await checked(derived,6,[42,p+80,1033,1,callParams.p,0,excep,argerr]),0x80020009);
 assert.equal(read(read(read(callParams.p)+8)),0x87654321);assert.equal(read(excep+28),0x80020005);assert.equal(read(excep+24),0);
 await inputScope.close();put(table+24,originalInvoke);
 // Native BYREF BSTR replacement frees its original native input. The caller
 // independently owns its original string; callbacks during that cleanup must
 // observe every validated output already published, including later slots.
 put(table+24,addCode([0x8b,0x44,0x24,24,0x8b,0x00,0x8b,0x48,8,0x8b,1,0xa3,...d32(p+140),0x51,0xff,0x31,
  0xb8,...d32(thunk('SysFreeString')),0xff,0xd0,0x68,10,0,0,0,0x68,...d32(text),
  0xb8,...d32(thunk('SysAllocStringLen')),0xff,0xd0,0x59,0x89,1,
  0x8b,0x44,0x24,24,0x8b,0x00,0x8b,0x48,24,0xc7,1,42,0,0,0,0x31,0xc0,0xc2,36,0]));
 const bsScope=v.scope(),bsParams=await v.readDispParams({values:[{vt:0x4008,ref:0,value:'6f006c006400'},{vt:0x4003,ref:1,value:'01000000'}],named:[]},bsScope);
 const bsArgs=read(bsParams.p),bsSlot=read(bsArgs+8),oldBs=read(bsSlot),intSlot=read(bsArgs+24),freeBstr=v.freeBstr.bind(v);let replaced=0;
 v.freeBstr=async q=>{if(q===oldBs){replaced++;assert.equal(read(intSlot),42);assert.equal(v.bstr(read(bsSlot)),Buffer.from('Owned\u0000Tail','utf16le').toString('hex'));}return freeBstr(q);};
 assert.equal(await checked(derived,6,[43,p+80,1033,1,bsParams.p,0,0,0]),0);assert.equal(replaced,1);
 // SysFreeString above runs inside x86, bypassing the host allocation ledger.
 // Account for that observed native free, never for caller-owned storage.
 const nativeFreed=read(p+140);assert.notEqual(nativeFreed,oldBs);assert(allocations.delete(nativeFreed-4));
 v.freeBstr=freeBstr;await bsScope.close();put(table+24,originalInvoke);
 // The next real original boundary returned this collection from CAB slot7.
 // Its Item(VARIANT by value, ISetupComponent**) occupies six x86 words
 // including This; treating the value as a single pointer corrupts the ABI.
 const collectionIID='c54e8191f0b5d21180b900104b1f6cea',itemIID='c34e8191f0b5d21180b900104b1f6cea';
 const collection=m.allocate(16),collectionTable=m.allocate(40),item=m.allocate(16),itemTable=m.allocate(176);
 put(collection,collectionTable);put(collection+4,1);put(item,itemTable);put(item+4,1);
 for(let i=0;i<3;i++){put(collectionTable+i*4,read(table+i*4));put(itemTable+i*4,read(table+i*4));}
 for(let i=3;i<7;i++)put(collectionTable+i*4,read(table+i*4));
 put(collectionTable+32,addCode([0x8b,0x44,0x24,8,0xa3,...d32(p+144),0x8b,0x44,0x24,16,0xa3,...d32(p+148),
  0x83,0x7c,0x24,8,8,0x75,9,0x8b,0x50,0xfc,0x89,0x15,...d32(p+152),
  0x81,0x7c,0x24,8,3,0x40,0,0,0x75,6,0xc7,0,77,0,0,0,
  0xff,0x05,...d32(item+4),0x8b,0x4c,0x24,24,0xc7,1,...d32(item),0x31,0xc0,0xc2,24,0]));
 const collectionProxy=await remote(collection,collectionIID);
 for(const words of [[3,0,42,0],[8,0,0,0],[0x4003,0,p+156,0]]){
  let temporary=0;if(words[0]===8){temporary=v.readBstr(Buffer.from('index\u0000tail','utf16le').toString('hex'));words[2]=temporary;}
  put(p+156,1);assert.equal(await checked(collectionProxy,8,[...words,p+48]),0);const returnedItem=read(p+48);assert(returnedItem&&returnedItem!==item);
  assert.equal(read(p+144),words[0]);if(words[0]===3)assert.equal(read(p+148),42);
  if(words[0]===8){assert.notEqual(read(p+148),temporary);assert.equal(read(p+152),20);await v.freeBstr(temporary);}
  if(words[0]===0x4003)assert.equal(read(p+156),77);
  await m.release(returnedItem);await m.drain();assert.equal(read(item+4),1);
 }
 const variantExchange=a.exchange.bind(a);a.exchange=async(...args)=>{const reply=await variantExchange(...args);if(args[0].meta.iid===collectionIID)reply[4][0]={vt:8,value:'6100'};return reply;};
 put(p+48,0xdeadbeef);assert.equal(await checked(collectionProxy,8,[3,0,42,0,p+48]),HR.INVALID);assert.equal(read(p+48),0xdeadbeef);a.exchange=variantExchange;await m.drain();assert.equal(read(item+4),1);
 const itemMethod=read(collectionTable+32),itemFile='c:\\variant-native-io.bin';let itemFills=0;
 vfs.setProviderFile(itemFile,{attrs:32,provider:{size:4,readRange:async()=>{itemFills++;const request=[...authority.requests.values()].find(x=>x.state==='executing'&&x.method===8);assert(request);transport.cancelCall(request.ticket);return Uint8Array.of(1,2,3,4);}}});
 const itemHandle=vfs.createFile(itemFile,0x80000000,3);
 put(collectionTable+32,addCode([0x68,0,0,0,0,0x68,...d32(p+132),0x68,4,0,0,0,0x68,...d32(p+128),0x68,...d32(itemHandle),0xb8,...d32(thunk('ReadFile')),0xff,0xd0,0xb8,...d32(itemMethod),0xff,0xe0]));
 put(p+48,0xdeadbeef);assert.equal(await checked(collectionProxy,8,[3,0,42,0,p+48]),HR.DISCONNECTED);assert.equal(read(p+48),0xdeadbeef);assert.equal(itemFills,1);
 put(collectionTable+32,itemMethod);vfs.closeHandle(itemHandle);await m.drain();assert.equal(read(item+4),1);
 await m.release(collectionProxy);await m.drain();assert.equal(read(collection+4),1);
 // Codec control for two by-value parameters borrowing the same BYREF slot:
 // metadata arguments remain distinct while one call-wide alias survives.
 const aliasSource=v.scope(),aliasNative=v.scope(),aliasRefs=[];
 const aliasDP=await v.readDispParams({values:[{vt:0x4003,ref:0,value:'01000000'},{vt:0x4003,ref:0}],named:[]},aliasSource);
 const aliasArgs=read(aliasDP.p),valueSpec={k:'variantValue'};
 const aliasA=await a.contracts.encodeInput(valueSpec,aliasArgs,[],aliasRefs),aliasB=await a.contracts.encodeInput(valueSpec,aliasArgs+16,[],aliasRefs);
 assert.equal(aliasA.ref,aliasB.ref);assert(!Object.hasOwn(aliasB,'value'));
 const nativeA=await a.contracts.decodeInput(valueSpec,aliasA,[],aliasNative),nativeB=await a.contracts.decodeInput(valueSpec,aliasB,[],aliasNative);
 assert.equal(read(nativeA+8),read(nativeB+8));put(read(nativeA+8),77);
 const aliasReplyRefs=[],replyA=await a.contracts.encodeOutput(valueSpec,nativeA,[],aliasReplyRefs),replyB=await a.contracts.encodeOutput(valueSpec,nativeB,[],aliasReplyRefs),aliasStages=[];
 await a.contracts.stageByrefs({values:[replyA,replyB],named:[]},aliasDP.p,aliasSource,aliasStages);for(const publish of aliasStages)publish();
 assert.equal(read(read(aliasArgs+8)),77);assert.equal(read(aliasArgs+8),read(aliasArgs+24));await aliasNative.close();await aliasSource.close();
 // Cancellation/retirement while the native GetTypeInfo frame is parked
 // in actual ReadFile must retain the executing pin until unwind and retire
 // every newly marshaled type-interface packet without publishing outputs.
 const originalGetInfo=read(table+16);let serial=0;
 for(const mode of ['cancel','nested','retire','disconnect']){
  const file='c:\\typeinfo-io'+(++serial)+'.bin';let fills=0,savedChannel;
  vfs.setProviderFile(file,{attrs:32,provider:{size:4,readRange:async()=>{
   fills++;assert.equal(e.get_yield_reason(),12);
   if(mode==='cancel'){const request=[...authority.requests.values()].find(r=>r.state==='executing'&&r.method===4);assert(request);transport.cancelCall(request.ticket);assert.equal(request.entry.calls,1);}
   if(mode==='nested'){
    assert.equal(await c.call(ti,1,[]),await c.call(ti,2,[])+1);
    put(p+64,name);assert.equal(await c.call(rt,10,[p+64,1,p+100]),0);assert.equal(read(p+100),7);
   }
   if(mode==='retire')retired=true;
   if(mode==='disconnect'){const row=a.objects.get(derived).proxy;savedChannel=row.channel;await c.call(savedChannel,1);assert.equal(await c.call(row.address,4,[]),0);}
   return Uint8Array.of(1,2,3,4);
  }}});
  const handle=vfs.createFile(file,0x80000000,3);
  const waitCode=addCode([0x68,0,0,0,0,0x68,...d32(p+132),0x68,4,0,0,0,0x68,...d32(p+128),0x68,...d32(handle),0xb8,...d32(thunk('ReadFile')),0xff,0xd0,
   0x68,...d32(ti),0xb8,...d32(c.method(ti,1)),0xff,0xd0,0x8b,0x44,0x24,16,0xc7,0,...d32(ti),0x31,0xc0,0xc2,16,0]);
  put(table+16,waitCode);put(p+48,0xdeadbeef);const before=snapshot();
  if(mode==='retire'){await assert.rejects(c.call(derived,4,[0,1033,p+48]),/retiring/);retired=false;assert.equal(read(p+48),0xdeadbeef);}
  else {const hr=await checked(derived,4,[0,1033,p+48]);assert.equal(hr,mode==='cancel'?HR.DISCONNECTED:0);
   if(mode==='cancel')assert.equal(read(p+48),0xdeadbeef);else await m.release(read(p+48));}
  if(mode==='disconnect'){const row=a.objects.get(derived).proxy;assert.equal(await checked(derived,4,[0,1033,p+48]),HR.DISCONNECTED);assert.equal(await c.call(row.address,3,[savedChannel]),0);await m.release(savedChannel);}
  await m.drain();assert.deepEqual(snapshot(),before);assert.equal(fills,1);vfs.closeHandle(handle);put(table+16,originalGetInfo);
 }
 // A completed reply cancelled before poll must retire its transferred
 // interface lease. A forged reference cannot consume an unrelated packet.
 const complete=transport.complete.bind(transport);let cancelledReplies=0;
 // A real native lookup completed on its owner still cannot publish after
 // cancellation. It carries no interface attachments to mask request cleanup.
 transport.complete=(ticket,response)=>{const result=complete(ticket,response);transport.cancelCall(ticket);return result;};
 put(p+64,name);put(p+100,0xdeadbeef);
 assert.equal(await checked(rt,10,[p+64,1,p+100]),HR.DISCONNECTED);assert.equal(read(p+100),0xdeadbeef);
 transport.complete=complete;await m.drain();
 transport.complete=(ticket,response)=>{const result=complete(ticket,response);if(response?.attachments?.length){cancelledReplies++;transport.cancelCall(ticket);}return result;};
 put(p+48,0xdeadbeef);assert.equal(await checked(derived,4,[0,1033,p+48]),HR.DISCONNECTED);assert.equal(read(p+48),0xdeadbeef);assert.equal(cancelledReplies,1);
 transport.complete=complete;await m.drain();
 const savedExchange=a.exchange.bind(a);a.exchange=async(...args)=>{const reply=await savedExchange(...args);reply[4][2]={...reply[4][2],iid:'not-an-iid'};return reply;};
 put(p+48,0xdeadbeef);assert.equal(await checked(derived,4,[0,1033,p+48]),HR.INVALIDOBJREF);assert.equal(read(p+48),0xdeadbeef);a.exchange=savedExchange;await m.drain();
 // A second actual x86 instance has independent memory and displaced heap
 // addresses. Only the authenticated byte authority connects the two CPUs.
 const memory2=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),vfs2=new VirtualFS();
 vfs2.files.set('c:\\sims.tlb',{data:resource.data,attrs:32});
 const ctx2={getMemory:()=>memory2.buffer,vfs:vfs2,renderer:null,resourceJson:{}},imports2=createHostImports(ctx2);imports2.host.memory=memory2;
 const e2=new WebAssembly.Instance(new WebAssembly.Module(wasm),imports2).exports;ctx2.exports=e2;
 new Uint8Array(memory2.buffer).set(pe,e2.get_staging());assert(e2.load_pe(pe.length));e2.set_esp(0x074ff000);e2.set_eip(0);e2.set_yield_state(0,0);
 const displacement=e2.guest_alloc(100003),session2=authority.connect('independent-native-caller');let pumping,pumpError;
 const runtime2=new ComInterfaceRuntime({getExports:()=>e2,getMemory:()=>memory2.buffer,getVfs:()=>vfs2,
  desktop:{call:r=>{if(pumpError)throw pumpError;const value=dispatchCom(authority,session2,r);
   if(r.command==='poll'&&!value&&!pumping){pumping=m.drain().catch(error=>{pumpError=error;}).finally(()=>{pumping=null;});}return value;}},
  serviceYield:async()=>false,modulePin:sha(wasm),sourcePin:comRuntimeSourcePin()});ctx2.comInterfaces=runtime2;
 const {c:c2,m:m2,proxy:proxy2,automation:a2}=runtime2.initialize(),scratch2=m2.allocate(128);
 async function remote2(object,iid){pin(iid);const packet=await m.marshalReference(p,object);assert.equal(packet.hresult,0);
  m2.write(scratch2,Buffer.from(iid,'hex'));assert.equal(await proxy2.unmarshalReference(packet.reference,scratch2,scratch2+16),0);return c2.word(scratch2+16);}
 const ti2=await remote2(ti,IID_INFO);assert.notEqual(ti2,ti);
 const name2=a2.string('fIlE',true);c2.putWord(scratch2+64,name2);
 assert.equal(await c2.call(ti2,10,[scratch2+64,1,scratch2+72]),0);assert.equal(c2.word(scratch2+72),7);m2.free(name2);
 assert.equal(await c2.call(ti2,3,[scratch2+24]),0);const graph2=c2.word(scratch2+24);assert.equal(m2.guid(graph2),derivedIID);assert.notEqual(graph2,ti);
 assert.equal(await c2.call(ti2,19,[graph2]),0);
 assert.equal(await c2.call(ti2,18,[scratch2+24,scratch2+28]),0);const lib2=c2.word(scratch2+24);assert.equal(await c2.call(lib2,3,[]),await checked(lib,3,[]));await m2.release(lib2);
 const derived2=await remote2(server,derivedIID);assert.equal(await c2.call(derived2,4,[0,1033,scratch2+24]),0);const returned2=c2.word(scratch2+24);
 assert.equal(await c2.call(returned2,3,[scratch2+24]),0);const ra2=c2.word(scratch2+24);assert.equal(m2.guid(ra2),derivedIID);await c2.call(returned2,19,[ra2]);await m2.release(returned2);
 assert.equal(await c2.call(derived2,14,[scratch2+24]),0);const bs2=c2.word(scratch2+24);assert.equal(a2.contracts.v.bstr(bs2),Buffer.from('Owned\u0000Tail','utf16le').toString('hex'));await a2.contracts.v.freeBstr(bs2);
 const collection2=await remote2(collection,collectionIID);c2.putWord(scratch2+48,1);
 assert.equal(await c2.call(collection2,8,[0x4003,0,scratch2+48,0,scratch2+24]),0);assert.equal(c2.word(scratch2+48),77);assert.notEqual(read(p+148),scratch2+48);
 const item2=c2.word(scratch2+24);assert(item2&&item2!==item);await m2.release(item2);await m2.release(collection2);
 await m2.release(derived2);await m2.release(ti2);await m2.drain();if(pumping)await pumping;await m.drain();assert.ifError(pumpError);
 assert.equal(a2.objects.size,0);assert.equal(proxy2.objects.size,0);assert.equal(a2.contracts.leases.size,0);assert.equal(c2.frames.length,0);m2.free(scratch2);e2.guest_free(displacement);
 // Metadata leases keep their proxy alive after the external Release.
 assert.equal(await checked(rt,3,[p+48]),0);const held=read(p+48);await m.release(rt);assert(a.contracts.leases.has(held));await checked(rt,19,[held]);
 await m.release(derived);await m.release(rl);await m.drain();assert.equal(read(server+4),1);
 assert.equal(a.contracts.leases.size,0);assert.equal(authority.exports.size,0);assert.equal(authority.requests.size,0);assert.equal(a.objects.size,0);assert.equal(proxy.objects.size,0);assert.equal(runtime.pending.size,0);
 assert.equal(read(item+4),1);assert.equal(read(collection+4),1);
 await m.release(ti);await m.release(lib);for(const q of codes)m.free(q);for(const q of [p,original,table,server,text,name,dp,result,media,mediaTable,collection,collectionTable,item,itemTable])m.free(q);
 assert.equal(allocations.size,0,'all owned codec/factory/proxy/graph storage retired');
 console.log(JSON.stringify({status:'PASS',nativeTypeInfoNames:true,memberAndParameterIDs:true,malformedNameAndLateID:true,nestedNames:true,cancelledNamesReply:true,independentNativeOwners:true,nativeByValueVariant:true,nestedCollectionItem:true,cancelExecuting:true,cancelUnpolledReply:true,malformedReference:true,retirement:true,nestedNativeIO:true,finalOwnedAllocations:allocations.size,nativeFactories:true,nativeTypeInfoAndLibRoundtrip:true,ownedDescriptorGraphs:true,inheritedDispatch:true,nativeInvoke:true,customBstrMethod:true,frameRestore:true,resource:resource.metadata,moduleSHA256:sha(wasm),sourcePin:comRuntimeSourcePin()}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
