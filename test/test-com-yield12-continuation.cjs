'use strict';
// Actual x86 ReadFile -> lazy VFS -> native Automation -> owned channel/stub.
// Metadata is authored; unchanged real typelib parsing is qualified separately.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {createHostImports}=require('../lib/host-imports');
const {VirtualFS}=require('../lib/filesystem');
const {ComInterfaceRuntime,comRuntimeSourcePin}=require('../lib/com-interface-runtime');
const {OwnedComAuthority}=require('../lib/com-owned-channel');
const {dispatchCom}=require('../lib/com-owned-transport');
const {HResult,HR}=require('../lib/com-standard-marshaler');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const REGS=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
const d32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
function authorityControls(){
 const a=new OwnedComAuthority(),s=a.connect('exporter'),c=a.connect('caller'),f=a.connect('foreign');
 const owner={thread:1,generation:'1',source:'11'.repeat(32),module:'22'.repeat(32)};
 for(const session of [s,c,f])a.registerOwner(session,owner);
 const ref=a.prepareExport(s,owner,'12345678901234567890123456789012',0,'abcdef12345678901234567890123456');a.commitExport(s,owner,ref);
 const lease=a.consume(c,owner,ref),call=()=>a.submit(c,owner,ref,lease.token,{method:3,representation:0,flags:0,bytes:new Uint8Array()});
 const entry=a.exports.get(ref.ipid),queued=call();assert.equal(entry.calls,1);
 assert.throws(()=>a.failCall(s,owner,queued),/ESTALE/);assert.equal(entry.calls,1);
 a.cancelCall(c,owner,queued);assert.equal(entry.calls,0);
 const ticket=call();a.take(s,owner);
 for(const session of [c,f])assert.throws(()=>a.failCall(session,owner,ticket),/ESTALE/);
 assert.throws(()=>a.failCall(s,{...owner,generation:'2'},ticket),/ESTALE/);
 assert.equal(entry.calls,1,'foreign failure cannot drop executing pin');
 a.cancelCall(c,owner,ticket);assert.equal(entry.calls,1,'cancel keeps actual running pin');
 a.failCall(s,owner,ticket);assert.equal(entry.calls,0);assert(!a.requests.has(ticket));
 assert.throws(()=>a.failCall(s,owner,ticket),/ESTALE/);
 const failed=call();a.take(s,owner);a.failCall(s,owner,failed);
 assert.throws(()=>a.poll(c,owner,failed),/EDISCONNECTED/);assert.equal(entry.calls,0);
 const result=call();a.take(s,owner);a.complete(s,owner,result,{hresult:0x80070005,status:7,bytes:Uint8Array.of(8)});
 const reply=a.poll(c,owner,result);assert.equal(reply.hresult,0x80070005);assert.equal(reply.status,7);assert.deepEqual(reply.bytes,Uint8Array.of(8));
 a.releaseProxy(c,owner,ref,lease.token);const retire=a.take(s,owner);assert.equal(retire.kind,'retire');a.complete(s,owner,retire.ticket);
 assert.equal(a.exports.size,0);assert.equal(a.requests.size,0);
 return {cancelQueued:true,cancelExecutingWaitsForActualUnwind:true,foreignOwnerRefused:true,staleAndDuplicateRefused:true,realHResultPreserved:true};
}
async function main(){
 const controls=authorityControls();
 const modulePath=process.env.WINE_ASSEMBLY_WASM||'build/wine-assembly.compat.wasm';
 const bytes=fs.readFileSync(modulePath),mod=new WebAssembly.Module(bytes);
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const vfs=new VirtualFS(),ctx={getMemory:()=>memory.buffer,renderer:null,vfs,resourceJson:{}};
 const imports=createHostImports(ctx);imports.host.memory=memory;
 const e=new WebAssembly.Instance(mod,imports).exports;ctx.exports=e;
 const image=fs.readFileSync(require.resolve('./binaries/calc.exe'));
 new Uint8Array(memory.buffer).set(image,e.get_staging());assert(e.load_pe(image.length));
 e.set_esp(0x074ff000);e.set_eip(0);e.set_yield_state(0,0);
 const authority=new OwnedComAuthority(),session=authority.connect('yield12-native');
 let retired=false;
 const runtime=new ComInterfaceRuntime({getExports:()=>e,getMemory:()=>memory.buffer,getVfs:()=>vfs,
  desktop:{call:r=>dispatchCom(authority,session,r)},serviceYield:async()=>false,
  modulePin:sha(bytes),sourcePin:comRuntimeSourcePin(),isRetired:()=>retired});ctx.comInterfaces=runtime;
 const {c,m,proxy,transport,automation}=runtime.initialize();
 const live=new Set(),allocate=m.allocate.bind(m),free=m.free.bind(m);
 m.allocate=n=>{const p=allocate(n);assert(!live.has(p));live.add(p);return p;};
 m.free=p=>{assert(live.delete(p),'allocation freed once');free(p);};
 const alloc=n=>m.allocate(n),put=(p,v)=>c.putWord(p,v),read=p=>c.word(p);
 const code=b=>{const p=alloc(b.length);m.write(p,Uint8Array.from(b));return p;};
 const thunk=name=>{const id=require('../src/api_table.json').find(r=>r.name===name).id;
  const t=e.com_bridge_vtable(id,1)>>>0,p=read(t);e.guest_free(t);return p;};
 const readFile=thunk('ReadFile'),getError=thunk('GetLastError');
 const server=alloc(16),table=alloc(16),data=alloc(8);put(server,table);put(server+4,1);
 // QI retains the real authored server; AddRef/Release expose lifetime counts.
 put(table,code([0x8b,0x44,0x24,4,0x8b,0x54,0x24,8,0x8b,0x4c,0x24,12,0xc7,1,0,0,0,0,
  0x83,0x3a,3,0x74,0x0a,0x89,1,0xff,0x40,4,0x31,0xc0,0xc2,12,0,0xb8,2,0x40,0,0x80,0xc2,12,0]));
 put(table+4,code([0x8b,0x4c,0x24,4,0xff,0x41,4,0x8b,0x41,4,0xc2,4,0]));
 put(table+8,code([0x8b,0x4c,0x24,4,0xff,0x49,4,0x8b,0x41,4,0xc2,4,0]));
 const iid='0100000000000000c000000000000046';
 const method={slot:3,result:{kind:'scalar',vt:25,size:4},params:[{flags:2,type:{kind:'pointer',child:{kind:'scalar',vt:19,size:4}}}]};
 const meta={iid,slots:4,methods:new Map([[3,method]])};
 const stub=automation.object(3,[3,1,1,2,1,3,2,1,2,2],{meta,server:0});
 assert.equal(await automation.connectStub(stub,server),0);assert.equal(read(server+4),2);
 const reference=transport.prepare(iid,0,'12345678901234567890123456789012');transport.commit(reference);
 const objectKey={identity:'12345678901234567890123456789012',exports:1};
 // Canonical export pin is the same real AddRef retained by normal marshaling.
 await c.call(server,1);m.exports.set(reference.ipid,{reference,canonical:server,stub:stub.address,objectKey});m.objects.set(server,objectKey);
 const lease=transport.consume(reference),channel=proxy.object('channel',{reference,lease,buffers:new Map(),server:false});
 const row=automation.object(2,[3,1,1,2,1],{meta,channel:0});
 assert.equal(await c.call(row.address,3,[channel.address]),0);
 const typed=automation.object(4,[3,1,1,2],{proxy:row});row.typed=typed;
 const out=alloc(4),results=[];
 const snapshot=()=>({regs:REGS.map(r=>e['get_'+r]()>>>0),eip:e.get_eip(),ip:e.com_callback_get_ip(),
  thunk:e.com_callback_get_thunk(),handler:e.get_handler_set_eip(),steps:e.get_steps(),
  reason:e.get_yield_reason(),flag:e.get_yield_flag(),fs:e.get_fs_base(),
  seh:e.get_fs_base()?read(e.get_fs_base()>>>0):0,
  flags:Array.from({length:6},(_,i)=>e.com_callback_get_flags(e.com_owner_token(),i)),
  stack:Array.from(m.read(e.get_esp()>>>0,64)),depth:e.get_sync_msg_depth()});
 let serial=0;
 async function run(name,{fault=false,nested=false,reject=false,cancel=false,cancelRpc=false,retire=false,trap=false,trapAfter=false,disconnect=false,output='scalar',hr=0}={}){
  const path='C:\\yield'+(++serial)+'.dat';let value=0x12345000+serial,serverBstr;
  const method=row.meta.methods.get(3);
  if(output==='bstr'){
   serverBstr=m.allocate(12);put(serverBstr,6);m.write(serverBstr+4,Buffer.from('410000004200','hex'));value=serverBstr+4;
  }
  if(output==='interface')value=server;
  if(output!=='scalar')row.meta.methods.set(3,{...method,params:[{flags:2,type:{kind:'pointer',child:output==='bstr'?{kind:'bstr'}:{kind:'interface',iid:'0000000000000000c000000000000046'}}}]});
  let fills=0,nestedCalls=0,parked=false,retiringTicket;
  const callback=code([0xb8,...d32(0x76543210),0xc3]);
  vfs.setProviderFile(path,{provider:{size:4,readRange:async(off,n)=>{
   fills++;assert.equal(e.get_yield_reason(),12);assert(c.frames.length>=3);parked=true;
   await new Promise(r=>setTimeout(r,5));
   if(nested){nestedCalls++;assert.equal(await c.invoke(callback,[]),0x76543210);assert.equal(e.get_yield_reason(),12);}
   if(cancelRpc){
    const executing=[...authority.requests.values()].find(r=>r.state==='executing'&&!r.kind);
    assert(executing);transport.cancelCall(executing.ticket);
    assert.equal(executing.entry.calls,1,'actual native call remains pinned during cancellation');
   }
   if(retire){
    retiringTicket=transport.submit(reference,lease,{method:3,representation:0x57410101,flags:0,
     bytes:Buffer.from(JSON.stringify(['WA_AUTOMATION_1',meta.iid,3,[null]]))});
    retired=true;
   }
   if(cancel)throw new Error('provider cancelled');
   if(fault)throw new Error('actual provider read fault');
   const b=Buffer.alloc(4);b.writeUInt32LE(value);return Uint8Array.from(b.subarray(off,off+n));
  }},attrs:0x20});
  const h=vfs.createFile(path,0x80000000,3);assert(h>0);
  // Native HRESULT_FROM_WIN32(GetLastError()) after a failed actual ReadFile.
  const success=[0x8b,0x4c,0x24,8,0xa1,...d32(data),0x89,1,
   ...(trapAfter?[0x0f,0x0b]:[]),0xb8,...d32(hr),0xc2,8,0];
  const b=[0x68,...d32(0),0x68,...d32(data+4),0x68,...d32(4),0x68,...d32(data),0x68,...d32(h),
   0xb8,...d32(readFile),0xff,0xd0,0x85,0xc0,0x74,success.length,...success,
   0xb8,...d32(getError),0xff,0xd0,0x0d,...d32(0x80070000),0xc2,8,0];
  if(trap)b.splice(0,0,0x0f,0x0b);
  if(output==='interface'){
   // The native server returns one real owned interface reference.
   b.splice(0,0,0xff,0x05,...d32(server+4));
  }
  const methodCode=code(b);put(table+12,methodCode);put(out,0xdeadbeef);
  const before=snapshot(),allocated=new Set(live),oldFill=vfs.fillPendingRead.bind(vfs);
  if(reject)vfs.fillPendingRead=async()=>{throw new Error('fill service rejected');};
  if(disconnect)await c.call(row.address,4);
  let result,error;
  try{result=await c.call(typed.address,3,[out]);}catch(e){error=e;}
  retired=false;vfs.fillPendingRead=oldFill;
  if(retiringTicket)assert.throws(()=>transport.poll(retiringTicket),e=>e instanceof HResult&&e.value===HR.DISCONNECTED);
  if(output==='bstr'){
   if(!trapAfter){assert.ifError(error);assert.equal(result,0);const p=read(out);assert(p);
    assert.equal(await automation.encode({kind:'bstr'},p),'410000004200');m.free(p-4);}
   allocated.delete(serverBstr);
  }
  if(output==='interface'&&!trapAfter){
   assert.ifError(error);assert.equal(result,0);const p=read(out);assert(p&&p!==server);
   await c.call(p,2);await m.drain();
  }
  assert.deepEqual(snapshot(),before,name+' restores saved CPU');assert.equal(c.frames.length,0);
  assert.deepEqual(live,allocated,name+' retires all temporary stub/channel/output allocations');
  assert.equal(runtime.pending.size,0,name+' no pending nested COM frames');
  if(reject||retire||trap||trapAfter){assert(error,name+' must reject');assert.equal(read(out),0xdeadbeef);}
  else {assert.ifError(error);assert.equal(result,disconnect||cancelRpc?HR.DISCONNECTED:(fault||cancel)?0x8007001e:hr);}
  if(cancelRpc)assert.equal(read(out),0xdeadbeef,'cancelled RPC publishes no outputs');
  if(!reject&&!retire&&!trap&&!disconnect){assert(parked);assert.equal(fills,1);if(!fault&&!cancel&&!cancelRpc&&!trapAfter&&output==='scalar')assert.equal(read(out),value);}
  if(nested)assert.equal(nestedCalls,1);
  if(disconnect)assert.equal(await c.call(row.address,3,[channel.address]),0);
  vfs.closeHandle(h);m.free(methodCode);m.free(callback);
  row.meta.methods.set(3,method);
  results.push({name,result,error:error?.message,fills,nestedCalls,restored:true,temporaryAllocationsRetired:true});
 }
 await run('async native read');await run('nested native callback',{nested:true});
 await run('native server HRESULT',{hr:0x80070005});await run('provider error',{fault:true});
 await run('provider cancellation',{cancel:true});await run('unexpected service rejection',{reject:true});
 await run('cancel executing RPC during real I/O',{cancelRpc:true});
 await run('disconnected proxy',{disconnect:true});await run('owner retirement',{retire:true});
 await run('native trap',{trap:true});
 await run('BSTR output after lazy read',{output:'bstr'});
 await run('interface output after lazy read',{output:'interface'});
 await run('BSTR output before native trap',{output:'bstr',trapAfter:true});
 await run('interface output before native trap',{output:'interface',trapAfter:true});
 // Actual native token retirement/replacement is separately exercised by the
 // unchanged owner-boundary fixtures; it must never restore a replacement.
 await c.call(row.address,2);await proxy.releaseChannel(channel);transport.releaseProxy(lease);await m.drain();
 assert.equal(read(server+4),1);assert.equal(authority.exports.size,0);assert.equal(automation.objects.size,0);
 assert.equal(proxy.objects.size,0);assert.equal(c.frames.length,0);
 assert.equal(authority.requests.size,0,'failed/cancelled requests retire their tickets');
 const token=e.com_callback_enter(),flags=Array.from({length:6},(_,i)=>e.com_callback_get_flags(token,i));
 e.com_callback_leave(token);const stable=snapshot();
 assert.throws(()=>e.com_callback_get_flags(token,0),WebAssembly.RuntimeError);
 assert.throws(()=>e.com_callback_set_flags(token,...flags),WebAssembly.RuntimeError);
 assert.deepEqual(snapshot(),stable,'stale flag access cannot mutate parent CPU');
 // Retiring the actual native process epoch during an awaited read refuses
 // restoration. The replacement CPU must remain byte-for-byte observable as
 // the loader left it, rather than receiving an old saved stack/register set.
 const replacementData=allocRaw(8),replacementPath='C:\\replacement.dat';let replacement;
 function allocRaw(n){return e.guest_alloc(n)>>>0;}
 vfs.setProviderFile(replacementPath,{attrs:0x20,provider:{size:4,readRange:async()=>{
  new Uint8Array(memory.buffer).set(image,e.get_staging());assert(e.load_pe(image.length));
  replacement=snapshot();return Uint8Array.from([1,2,3,4]);
 }}});
 const replacementHandle=vfs.createFile(replacementPath,0x80000000,3);
 const replacementCode=code([0x68,...d32(0),0x68,...d32(replacementData+4),0x68,...d32(4),
  0x68,...d32(replacementData),0x68,...d32(replacementHandle),0xb8,...d32(readFile),0xff,0xd0,0xc3]);
 await assert.rejects(c.invoke(replacementCode,[]),/replaced owner|owner replaced/);
 assert(replacement);assert.deepEqual(snapshot(),replacement,'never restore into replacement epoch');
 assert.throws(()=>e.com_callback_check(c.frames.at(-1).token),WebAssembly.RuntimeError,'new epoch invalidates old child token');
 transport.retire();
 console.log(JSON.stringify({status:'PASS',modulePath,moduleSHA256:sha(bytes),sourcePin:comRuntimeSourcePin(),controls,results,
  finalServerRefs:1,exports:authority.exports.size,nativeObjects:automation.objects.size,
  staleFlagsRefused:true,replacementEpochUntouched:true}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
