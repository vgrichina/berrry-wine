'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.cwd(),req=n=>require(root+'/'+n),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const {AutomationValues}=req('lib/com-automation-types'),{HResult,HR}=req('lib/com-standard-marshaler');
const d32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
(async()=>{
 const wasm=fs.readFileSync(root+'/build/wine-assembly.compat.wasm');
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const vfs=new (req('lib/filesystem').VirtualFS)();req('lib/storage').clearStore();
 const ctx={getMemory:()=>memory.buffer,vfs,renderer:null,resourceJson:{}};
 const imports=req('lib/host-imports').createHostImports(ctx);imports.host.memory=memory;
 const e=new WebAssembly.Instance(new WebAssembly.Module(wasm),imports).exports;ctx.exports=e;
 const pe=req('tools/kernel32-native-fixture').makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
 e.set_esp(0x074ff000);e.set_eip(0);e.set_yield_state(0,0);
 const {OwnedComAuthority}=req('lib/com-owned-channel'),{dispatchCom}=req('lib/com-owned-transport');
 const {ComInterfaceRuntime,comRuntimeSourcePin}=req('lib/com-interface-runtime');
 const authority=new OwnedComAuthority(),session=authority.connect('typed-values-boundary');let retired=false;
 const runtime=new ComInterfaceRuntime({getExports:()=>e,getMemory:()=>memory.buffer,getVfs:()=>vfs,
  desktop:{call:r=>dispatchCom(authority,session,r)},serviceYield:async()=>false,
  modulePin:sha(wasm),sourcePin:comRuntimeSourcePin(),isRetired:()=>retired});ctx.comInterfaces=runtime;
 const {c,m,automation:native}=runtime.initialize(),codec=new AutomationValues(native);
 const allocations=new Set(),alloc=m.allocate.bind(m),free=m.free.bind(m);
 m.allocate=n=>{const p=alloc(n);assert(!allocations.has(p));allocations.add(p);return p;};
 m.free=p=>{assert(allocations.delete(p),'one free per candidate allocation '+p.toString(16));free(p);};
 const apiTable=req('src/api_table.json');
 const thunk=name=>{const table=e.com_bridge_vtable(apiTable.find(x=>x.name===name).id,1),p=c.word(table);e.guest_free(table);return p;};
 const invoke=(name,args)=>c.invoke(thunk(name),args),scratch=m.allocate(128),file=native.string('c:\\windows\\system\\stdole2.tlb',true);
 assert.equal(await invoke('LoadTypeLib',[file,scratch]),0);const lib=c.word(scratch);
 m.write(scratch+16,Buffer.from('0004020000000000c000000000000046','hex'));
 assert.equal(await c.call(lib,6,[scratch+16,scratch+32]),0);const ti=c.word(scratch+32);
 const putCode=bytes=>{const p=m.allocate(bytes.length);m.write(p,Uint8Array.from(bytes));return p;};
 const tests=[];
 async function local(name,fn){const start=new Set(allocations),scope=codec.scope();try{await fn(scope);tests.push(name);}finally{await scope.close();assert.deepEqual(allocations,start,name+' cleanup');}}
 await local('counted BSTR embedded NUL and UTF16',async s=>{
  const p=s.alloc(4);await codec.storeValue(8,p,'4100000042003dd800de',s);
  assert.equal(codec.bstr(c.word(p)),'4100000042003dd800de');
  assert.notEqual(codec.bstr(c.word(p)),codec.wstring(c.word(p)));
 });
 await local('VARIANT scalar exact bytes and DECIMAL',async s=>{
  for(const [vt,value]of [[0,''],[1,''],[2,'ffff'],[3,'ffffffff'],[4,'0000803f'],[5,'000000000000f03f'],[6,'ffffffffffffffff'],[7,'0000000000000000'],[10,'04000280'],[11,'ffff'],[14,'0280010000000200000003000000'],[16,'ff'],[17,'ff'],[18,'ffff'],[19,'ffffffff'],[20,'ffffffffffffffff'],[21,'ffffffffffffffff'],[22,'ffffffff'],[23,'ffffffff']]){
   const p=s.alloc(16);await codec.readVariant({vt,value},p,s);assert.deepEqual(await codec.variant(p,[]),{vt,value});
  }
 });
 await local('VARIANT BYREF alias preserves local storage identity',async s=>{
  const dp={values:[{vt:0x4003,ref:0,value:'78563412'},{vt:0x4003,ref:0}],named:[0xfffffffd]};
  const decoded=await codec.readDispParams(dp,s),args=c.word(decoded.p);
  assert.equal(c.word(args+8),c.word(args+24));
  const x86=putCode([0x8b,0x44,0x24,4,0xc7,0,0x21,0x43,0x65,0x87,0x31,0xc0,0xc2,4,0]);
  try{assert.equal(await c.invoke(x86,[c.word(args+8)]),0);}finally{m.free(x86);}
  const encoded=await codec.dispParams(decoded.p,[]);assert.equal(encoded.values[0].value,'21436587');assert.equal(encoded.values[1].ref,0);assert.deepEqual(encoded.named,dp.named);
 });
 await local('actual interface VARIANT output owns and retires real reference',async s=>{
  const p=s.alloc(16),server=s.alloc(16),vt=s.alloc(12);c.putWord(server,vt);c.putWord(server+4,1);
  const qi=putCode([0x8b,0x44,0x24,4,0x8b,0x54,0x24,8,0x8b,0x4c,0x24,12,0xc7,1,0,0,0,0,
   0x83,0x3a,3,0x74,0x0a,0x89,1,0xff,0x40,4,0x31,0xc0,0xc2,12,0,0xb8,2,0x40,0,0x80,0xc2,12,0]);
  const add=putCode([0x8b,0x4c,0x24,4,0xff,0x41,4,0x8b,0x41,4,0xc2,4,0]),release=putCode([0x8b,0x4c,0x24,4,0xff,0x49,4,0x8b,0x41,4,0xc2,4,0]);
  c.putWord(vt,qi);c.putWord(vt+4,add);c.putWord(vt+8,release);
  const src=s.alloc(16);codec.putHalf(src,13);c.putWord(src+8,server);const refs=[];
  try{
   const value=await codec.variant(src,refs);assert.equal(value.vt,13);assert.equal(refs.length,1);assert.equal(c.word(server+4),2);
   const temporary=codec.scope();try{await codec.readVariant(value,p,temporary);assert(c.word(p+8)!==server);}
   finally{await temporary.close();}
   await native.releasePackets(refs);assert.equal(c.word(server+4),1);
  }finally{for(const address of [qi,add,release])m.free(address);}
 });
 await local('EXCEPINFO real deferred x86 fill and counted strings',async s=>{
  const p=s.alloc(32),callback=putCode([0x8b,0x44,0x24,4,0xc7,0x40,28,0x05,0x00,0x02,0x80,0x31,0xc0,0xc2,4,0]);
  try{c.putWord(p+24,callback);const value=await codec.excepInfo(p,[]);assert.equal(value.scode,0x80020005);assert.equal(c.word(p+24),0);
   const q=s.alloc(32);await codec.readExcepInfo({...value,source:'410000004200'},q,s);assert.equal(codec.bstr(c.word(q+4)),'410000004200');
  }finally{m.free(callback);}
 });
 let negatives=0;
 await local('malformed values rejected before any native server invocation',async s=>{
  const p=s.alloc(16);
  for(const value of [{vt:0x1003,value:'00000000'},{vt:8,value:'0'},{vt:8,value:'gggg'},{vt:14,value:'ff00000000000000000000000000'},
   {vt:0x4003,ref:1,value:'00000000'},{vt:0x4003,ref:0,value:'0000'},{vt:65536,value:''},null]){
   const scope=codec.scope();try{await assert.rejects(codec.readVariant(value,p,scope));negatives++;}finally{await scope.close();}
  }
  await assert.rejects(codec.readDispParams({values:[],named:[1]},s));negatives++;
  await assert.rejects(codec.readDispParams({values:new Array(16385),named:[]},s));negatives++;
  c.putWord(p,524290);assert.throws(()=>codec.bstr(p+4));negatives++;
 });
 await local('native TYPEATTR field graph re-encoded without borrowed pointers',async s=>{
  const out=s.alloc(4);assert.equal(await c.call(ti,3,[out]),0);const p=c.word(out);
  try{const value=await codec.descriptor('typeattr',p,[]),q=await codec.readDescriptor('typeattr',value,s);
   assert.deepEqual(await codec.descriptor('typeattr',q,[]),value);assert(q!==p);
  }finally{await c.call(ti,19,[p]);}
 });
 const rejectedScope=codec.scope(),rejectedSlot=rejectedScope.alloc(4);await codec.storeValue(8,rejectedSlot,'4100',rejectedScope);
 retired=true;await assert.rejects(codec.readVariant({vt:3,value:'00000000'},scratch,rejectedScope),/retiring/).catch(err=>{throw err;});
 await c.cleanup(()=>rejectedScope.close());retired=false;
 await m.release(ti);await m.release(lib);for(const p of [file,scratch])m.free(p);
 assert.equal(allocations.size,0);assert.equal(authority.exports.size,0);assert.equal(authority.requests.size,0);assert.equal(c.frames.length,0);
 console.log(JSON.stringify({status:'PASS',moduleSHA256:sha(wasm),codecControls:tests,negativeControls:negatives,finalTrackedAllocations:allocations.size,noEngineExecution:true}));
})().catch(err=>{console.error(err);process.exitCode=1;});
