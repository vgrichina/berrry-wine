'use strict';
// Authored x86 FAR calls use the production KERNEL import thunks and shared
// registry backend. Diagnostic exports only expose descriptor mutation slots.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {neLifecycleImage}=require('./helpers/ne-lifecycle-image');
const {identity}=require('./test-neverhood-qt-nested-load.cjs');
const {qtImages}=require('./test-neverhood-qt-thunk.cjs');
const {createHostImports}=require('../lib/host-imports');
const {createNeLifecycle}=require('../lib/ne-lifecycle');
const {serviceNeGuestYieldSync,retireNativeFtConnections}=require('../lib/ne-guest-bridge');
const word=n=>[n&255,n>>>8&255],dword=n=>[...word(n),...word(n>>>16)];
const counts=[4,3,3,2,1,5,2,8,4,6,6,1];
function caller(op,{qt=false,alias=false}={}){
 const code=[0x55,0x89,0xe5];
 // Prove preservation *inside* native execution before frame restoration.
 for(const [reg,value] of [[0xbb,0x12345678],[0xbe,0x23456789],[0xbf,0x3456789a]])code.push(0x66,reg,...dword(value));
 if(!qt)for(const [modrm,off] of [[0x1e,0x120],[0x06,0x122],[0x16,0x124]])code.push(0x8c,modrm,...word(off));
 if(qt){
  // Original PE scratch at BP-60 is within this real leased SS descriptor.
  // Copy the authored ANSI subkey onto it and pass its actual SS:offset.
  code.push(0x36,0x66,0xc7,0x46,0xc4,...dword(0x545c574e)); // NW\T
  code.push(0x36,0x66,0xc7,0x46,0xc8,...dword(0x00747365)); // est
  code.push(0x36,0xc6,0x46,0xcc,0);
  code.push(0x66,0x68,...dword(0x80000001),0x16,0x8d,0x46,0xc4,0x50);
  if(alias)code.push(0x16,0x8d,0x46,0xc0,0x50);else code.push(0x0e,0x68,...word(0x550));
 }else for(let i=0;i<counts[op-216];i++)code.push(0x66,0xff,0x36,...word(i*4));
 const reloc=code.length+1;code.push(0x9a,0xff,0xff,0,0);
 code.push(0x39,0xec,0x74,2,0x0f,0x0b); // SP == BP, exact callee pop
 for(const [modrm,value] of [[0xfb,0x12345678],[0xfe,0x23456789],[0xff,0x3456789a]])code.push(0x66,0x81,modrm,...dword(value),0x74,2,0x0f,0x0b);
 if(!qt)for(const [modrm,off] of [[0xd9,0x120],[0xc1,0x122],[0xd1,0x124]])code.push(0x8c,modrm,0x3b,0x0e,...word(off),0x74,2,0x0f,0x0b);
 code.push(0x5d,...(qt?[0xca,34,0]:[0xcb]));return {code,reloc};
}
function registryImage(op){
 const old=neLifecycleImage({importEntry:{module:'KERNEL',symbol:op},importInValue:true});
 const b=Buffer.alloc(0x1a00);b.set(old.subarray(0,0x200));b.set([0xb8,1,0,0xcb],0x200);b.set([0xb8,1,0,0xca,2,0],0x220);
 b.writeUInt16LE(0x600,0xc2);b.writeUInt16LE(0x600,0xc6);b.writeUInt16LE(0xa0,0xc8);b.writeUInt16LE(0x1000,0xca);b.writeUInt16LE(0x1000,0xce);
 b.writeUInt16LE(0x40,0xe6); // ordinal 2 VALUE offset
 const c=caller(op);b.set(c.code,0x240);b.writeUInt16LE(1,0x800);b.set([3,1,...word(0x40+c.reloc),1,0,...word(op)],0x802);
 return identity(b,'REGTEST');
}
function qtRegistryImage({alias=true,op=217}={}){
 const f=qtImages({index:0}),c=caller(op,{qt:true,alias});
 f.ne.set(c.code,0x380);f.ne.writeUInt16LE(2,0x800);f.ne.set([3,1,...word(0x180+c.reloc),1,0,...word(op)],0x80a);return f;
}
const extraWat=String.raw`
 (func (export "reg_test_descriptor") (param $sel i32) (result i32)
  (i32.add (global.get $WIN16_SEG_TABLE) (i32.shl (call $win16_sel_to_index (local.get $sel)) (i32.const 4))))
 (func (export "reg_test_frame") (result i32) (i32.wrap_i64 (global.get $win16_bridge_frame)))
 (func (export "reg_test_stack") (param $n i32) (result i32) (call $win16_reg_stack (local.get $n)))
 (func (export "reg_test_span") (param $far i32) (param $n i32) (param $w i32) (result i32)
  (call $win16_reg_span (local.get $far) (local.get $n) (local.get $w)))
`;
async function main(){
 assert(process.env.WA_TEST_WASM,'explicit compiled module required');
 const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM));
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),v=new DataView(memory.buffer);
 let e,ds=0,genuine=false;const records=[],calls=[];
 const imp=createHostImports({getMemory:()=>memory.buffer,get exports(){return e;},renderer:null,resourceJson:{}});imp.host.memory=memory;imp.host.log_i32=()=>{};
 for(const name of ['reg_open_key','reg_create_key','reg_close_key','reg_flush_key','reg_set_value','reg_query_value','reg_enum_key','reg_enum_value','reg_delete_key','reg_delete_value']){
  const original=imp.host[name];imp.host[name]=(...args)=>{
   const row={name,args};if(genuine&&name==='reg_open_key'){
    row.returnOffset=e.guest_read32(e.get_esp())&65535;row.ordinal=e.win16_last_ordinal();
    row.path=require('../lib/mem-utils').readStrA(memory.buffer,args[1],260);
   }calls.push(row);return original(...args);
  };
 }
 e=(await WebAssembly.instantiate(module,imp)).exports;
 const {neGuestCaller}=require('./helpers/ne-guest-caller'),f=neGuestCaller();new Uint8Array(memory.buffer).set(f.bytes,e.get_staging());e.load_pe(f.bytes.length);
 const snap=()=>['eip','esp','ebp','ebx','esi','edi','sreg_cs','sreg_ds','sreg_ss','sync_msg_depth'].map(k=>e['get_'+k]());
 const read=p=>e.guest_read32(p)>>>0,write=(p,n)=>e.guest_write32(p,n);
 const far=off=>(ds<<16|off)>>>0;
 const ptr=off=>(e.win16_seg_base(ds>>>3)+off)>>>0;
 const str=(off,s)=>{for(let i=0;i<=s.length;i++)e.guest_write8(ptr(off+i),i===s.length?0:s.charCodeAt(i));return far(off);};
 let mutation=null;
 const owner={...e,win16_bridge_invoke_begin(...a){ds=a[2];return e.win16_bridge_invoke_begin(...a);},run(n){mutation?.();mutation=null;return e.run(n);}};
 function test(op,args,check){
  const life=createNeLifecycle(owner,memory,[['REGTEST',registryImage(op)]],{maxBlocks:4096,sliceBlocks:1});const id=life.load('REGTEST');
  const before=snap();for(const [i,arg] of args().entries())write(ptr(i*4),arg);
  const result=life.call(id,'VALUE');assert.deepEqual(snap(),before);check(result);life.release(id);assert.equal(e.win16_ft_checkpoint(),0n);records.push({op,result,restored:true});return result;
 }
 let key;
 test(218,()=>[0x80000001,str(0x200,'Software\\Win16RegistryProof'),far(0x100)],r=>{assert.equal(r,0);key=read(ptr(0x100));assert(key);});
 test(217,()=>[0x80000001,str(0x200,'Software\\Win16RegistryProof'),far(0x100)],r=>{assert.equal(r,0);assert(read(ptr(0x100)));assert.equal(imp.host.reg_close_key(read(ptr(0x100))),0);});
 test(217,()=>[key,0,far(0x100)],r=>{assert.equal(r,0);assert.equal(read(ptr(0x100)),key);});
 test(217,()=>{write(ptr(0x100),0xabcdef);return [key,str(0x200,'Absent'),far(0x100)];},r=>{assert.equal(r,2);assert.equal(read(ptr(0x100)),0xabcdef);});
 test(217,()=>[0xbad,str(0x200,'Absent'),far(0x100)],r=>assert.equal(r,2));
 test(226,()=>{write(ptr(0x300),0xdeadbeef);return [key,str(0x200,'Number'),0,4,far(0x300),4];},r=>assert.equal(r,0));
 test(225,()=>{write(ptr(0x104),0);return [key,str(0x200,'Number'),0,far(0x100),0,far(0x104)];},r=>{assert.equal(r,0);assert.equal(read(ptr(0x104)),4);assert.equal(read(ptr(0x100)),4);});
 test(225,()=>[key,str(0x200,'Number'),0,far(0x100),0,0],r=>{assert.equal(r,0);assert.equal(read(ptr(0x100)),4);});
 test(225,()=>{write(ptr(0x104),2);write(ptr(0x300),0x1234);return [key,str(0x200,'Number'),0,far(0x100),far(0x300),far(0x104)];},r=>{assert.equal(r,234);assert.equal(read(ptr(0x104)),4);assert.equal(read(ptr(0x300)),0x1234);});
 test(225,()=>{write(ptr(0x104),4);return [key,str(0x200,'Number'),0,far(0x100),far(0x300),far(0x104)];},r=>{assert.equal(r,0);assert.equal(read(ptr(0x300)),0xdeadbeef);});
 test(226,()=>[key,str(0x200,'Ansi'),0,1,str(0x300,'caf\xe9'),5],r=>assert.equal(r,0));
 test(225,()=>{write(ptr(0x104),5);return [key,str(0x200,'Ansi'),0,far(0x100),far(0x300),far(0x104)];},r=>{assert.equal(r,0);assert.equal(read(ptr(0x300)),0xe9666163);assert.equal(e.guest_read8(ptr(0x304)),0);});
 test(226,()=>{write(ptr(0x300),0x00ff807f);return [key,str(0x200,'Binary'),0,3,far(0x300),4];},r=>assert.equal(r,0));
 test(225,()=>{write(ptr(0x104),4);return [key,str(0x200,'Binary'),0,far(0x100),far(0x300),far(0x104)];},r=>{assert.equal(r,0);assert.equal(read(ptr(0x300)),0x00ff807f);});
 test(226,()=>[key,str(0x200,'EmptyBinary'),0,3,0,0],r=>assert.equal(r,0));
 test(225,()=>{write(ptr(0x104),0xff);return [key,str(0x200,'EmptyBinary'),0,far(0x100),0,far(0x104)];},r=>{assert.equal(r,0);assert.equal(read(ptr(0x104)),0);assert.equal(read(ptr(0x100)),3);});
 test(226,()=>[key,str(0x200,'ZeroString'),0,1,str(0x300,'caf\xe9'),0],r=>assert.equal(r,0));
 test(225,()=>{write(ptr(0x104),5);return [key,str(0x200,'ZeroString'),0,far(0x100),far(0x300),far(0x104)];},r=>{assert.equal(r,0);assert.equal(read(ptr(0x300)),0xe9666163);assert.equal(read(ptr(0x104)),5);});
 test(221,()=>[key,str(0x200,'Child'),1,str(0x300,'default'),8],r=>assert.equal(r,0));
 test(224,()=>{write(ptr(0x104),32);return [key,str(0x200,'Child'),far(0x300),far(0x104)];},r=>{assert.equal(r,0);assert.equal(read(ptr(0x104)),8);assert.equal(read(ptr(0x300)),0x61666564);});
 test(216,()=>[key,0,far(0x300),32],r=>{assert.equal(r,0);assert.equal(read(ptr(0x300)),0x6c696843);});
 test(223,()=>{write(ptr(0x104),32);write(ptr(0x108),32);return [key,0,far(0x200),far(0x104),0,far(0x100),far(0x300),far(0x108)];},r=>assert.equal(r,0));
 test(227,()=>[key],r=>assert.equal(r,0));
 test(222,()=>[key,str(0x200,'Binary')],r=>assert.equal(r,0));
 test(219,()=>[key,str(0x200,'Child')],r=>assert.equal(r,0));
 // Invalid outputs must fail before lookup/creation/mutation, even on a miss.
 for(const op of [217,218])for(const kind of ['null','selector','wrap','readonly','code','unterminated']){
  let at,old,start;
  test(op,()=>{
   const name=str(0x200,'Software\\MustNotCreate'),out=kind==='null'?0:kind==='selector'?0xfff70000:kind==='wrap'?far(0xfffe):kind==='code'?((ds-8)<<16|0x100)>>>0:far(0x100);
   if(kind==='readonly'){at=e.reg_test_descriptor(ds)+8;old=v.getUint32(at,true);v.setUint32(at,old|0x80,true);}
   start=calls.length;
   if(kind==='unterminated'){const end=v.getUint32(e.reg_test_descriptor(ds)+4,true)-1;e.guest_write8(ptr(end),65);return [0x80000001,far(end),out];}
   return [0x80000001,name,out];
  },r=>{if(at)v.setUint32(at,old,true);assert.equal(r,87,kind);assert.equal(calls.length,start,kind+' no backend call');});
 }
 test(220,()=>[key],r=>assert.equal(r,0));test(227,()=>[key],r=>assert.equal(r,6));
 // A real Win32 x86 caller resolves ADVAPI32 through the production loader,
 // reads the Win16 DWORD, then overwrites it for the next Win16 native query.
 {
  const {makeFixture,iat}=require('../tools/kernel32-native-fixture'),b=makeFixture(),base=0x400000,raw=r=>r-0x1000+0x200;
  for(const [r,text] of [[0x2800,'advapi32.dll'],[0x2820,'RegOpenKeyExA'],[0x2840,'RegQueryValueExA'],[0x2860,'RegSetValueExA'],[0x2880,'Software\\Win16RegistryProof'],[0x28c0,'Number']])b.write(text+'\0',raw(r));
  const code=[],emit=(...a)=>code.push(...a),push=n=>emit(0x68,...dword(n));
  push(base+0x2800);emit(0xff,0x15,...dword(iat('LoadLibraryA')),0x89,0xc3);
  for(const [r,slot] of [[0x2820,0x2600],[0x2840,0x2604],[0x2860,0x2608]]){
   push(base+r);emit(0x53,0xff,0x15,...dword(iat('GetProcAddress')),0xa3,...dword(base+slot));
  }
  const invoke=(slot,args,index)=>{for(const n of [...args].reverse())typeof n==='object'?emit(0xff,0x35,...dword(base+0x2700)):push(n);emit(0xff,0x15,...dword(base+slot),0xa3,...dword(base+0x2710+index*4));};
  invoke(0x2600,[0x80000001,base+0x2880,0,0x20019,base+0x2700],0);
  invoke(0x2604,[{},base+0x28c0,0,base+0x2704,base+0x2708,base+0x270c],1);
  invoke(0x2608,[{},base+0x28c0,0,4,base+0x2720,4],2);emit(0xc3);
  b.set(code,raw(0x2000));b.writeUInt32LE(4,raw(0x270c));b.writeUInt32LE(0x1234abcd,raw(0x2720));
  new Uint8Array(memory.buffer).set(b,e.get_staging());e.load_pe(b.length);e.set_eip(base+0x2000);e.set_esp(0x7408000);write(e.get_esp(),0);
  for(let i=0;i<100&&e.get_eip();i++)e.run(256);
  assert.equal(e.get_eip(),0);for(let i=0;i<3;i++)assert.equal(read(base+0x2710+i*4),0);
  assert.equal(read(base+0x2708),0xdeadbeef);assert.equal(read(base+0x2704),4);assert.equal(read(base+0x270c),4);
  assert.equal(imp.host.reg_close_key(read(base+0x2700)),0);records.push({kind:'native-win32-read-write-shared-key',realX86:true});
 }
 test(217,()=>[0x80000001,str(0x200,'Software\\Win16RegistryProof'),far(0x100)],r=>{assert.equal(r,0);key=read(ptr(0x100));});
 test(225,()=>{write(ptr(0x104),4);return [key,str(0x200,'Number'),0,far(0x100),far(0x300),far(0x104)];},r=>{assert.equal(r,0);assert.equal(read(ptr(0x300)),0x1234abcd);});
 test(225,()=>{write(ptr(0x104),4);write(ptr(0x300),0xabcd);return [key,str(0x200,'Missing'),0,far(0x100),far(0x300),far(0x104)];},r=>{assert.equal(r,2);assert.equal(read(ptr(0x300)),0xabcd);});
 for(const op of [223,224,225,226]){
  let start;
  test(op,()=>{start=calls.length;return op===223?[key,0,far(0x200),0xfff70000,0,0,0,0]:op===224?[key,0,far(0x300),0xfff70000]:op===225?[key,0,0,0xfff70000,0,0]:[key,0,0,3,0xfff70000,4];},r=>{assert.equal(r,87);assert.equal(calls.length,start);});
 }
 test(220,()=>[key],r=>assert.equal(r,0));
 if(process.env.NEVERHOOD_GENUINE==='1'){
  const crypto=require('node:crypto'),file='scratch/runs/20261116-neverhood-original-install-after-setupx/inputs/setupx.dll',bytes=fs.readFileSync(file);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'6cd5c194743fdf676112c0808b724a78f8f8650a54059d046a15fe270f5f55f4');
  const life=createNeLifecycle(owner,memory,[['REGTEST',registryImage(217)],['SETUPX',bytes]],{maxBlocks:10000,sliceBlocks:1});
  const buffer=life.load('REGTEST'),bufferDS=ds,bufferBase=e.win16_seg_base(ds>>>3),id=life.load('SETUPX');
  for(const missing of [false,true]){
   const name='Software\\Win16RegistryProof'+(missing?'\\Absent':''),offset=0x200;
   for(let i=0;i<=name.length;i++)e.guest_write8(bufferBase+offset+i,i===name.length?0:name.charCodeAt(i));
   write(bufferBase+0x100,0xabcdf);const before=snap();genuine=true;const start=calls.length;
   let result;try{result=life.call(id,47,[0x100,bufferDS,offset,bufferDS,1,0x8000]);}finally{genuine=false;}
   assert.deepEqual(snap(),before);assert.equal(result,missing?2:0);
   const row=calls.slice(start).find(x=>x.name==='reg_open_key');assert(row);assert.equal(row.returnOffset,0x5880);assert.equal(row.ordinal,217);assert.equal(row.path,name);
   if(missing)assert.equal(read(bufferBase+0x100),0xabcdf);else assert.equal(imp.host.reg_close_key(read(bufferBase+0x100)),0);
   records.push({kind:'unchanged-genuine-setupx-export47',path:name,result,returnOffset:row.returnOffset,restored:true,originalPathStillUnknown:true});
  }
  life.release(id);life.release(buffer);
 }
 // Real packed QT SS alias, both alignments; readonly CS output is refused.
 for(const shift of [0,2])for(const kind of ['alias','code-output','actor','request-generation','process-generation','lease','descriptor','retired','cancel']){
  const alias=kind!=='code-output';
  const f=qtRegistryImage({alias,op:218}),ctx={exports:e,memoryBuffer:memory.buffer,findDllSync:()=>f.ne,neInvokeOptions:{maxBlocks:4096,sliceBlocks:1}};
  new Uint8Array(memory.buffer).set(f.bytes,e.get_staging());e.load_pe(f.bytes.length);e.invalidate_code_range(f.base,0x3000);e.set_eip(f.entry);e.set_esp(0x7408000);write(0x7408000,0);
  for(let n=0;n<100&&e.get_eip();n++){e.run(256);if(e.get_yield_reason()===18)serviceNeGuestYieldSync(ctx);}
  assert.equal(e.get_eip(),0);e.set_eip(f.invoke);e.set_esp(0x74fd494+shift);write(e.get_esp(),0);
  for(let n=0;n<100;n++){e.run(1);if(e.get_yield_reason()===18)break;}
  const before=snap(),ret=read(e.get_esp());let changed=null,stackFar=0,aborted=false,started=calls.length;
  const facade={...e,win16_bridge_qt_begin(...a){const ok=e.win16_bridge_qt_begin(...a);if(ok){
   const frame=e.reg_test_frame();stackFar=(e.get_sreg_ss()<<16|0x100)>>>0;
   let at=kind==='actor'?frame+8:kind==='request-generation'?frame+384:kind==='process-generation'?v.getUint32(frame+400,true)+56:kind==='lease'?e.qt_load_test_slot(8):kind==='descriptor'?e.qt_load_test_slot(3):0;
   if(at){changed={at,old:v.getUint32(at,true)};v.setUint32(at,changed.old^0x1000,true);}
   if(kind==='retired')e.win16_guest_request_cancel();
   if(kind==='cancel')aborted=true;
  }return ok;},win16_bridge_frame_end(...a){if(changed){v.setUint32(changed.at,changed.old,true);changed=null;}return e.win16_bridge_frame_end(...a);}};
  const options={...ctx,exports:facade,neInvokeOptions:{...ctx.neInvokeOptions,signal:{get aborted(){return aborted;}}}};
  if(['alias','code-output'].includes(kind)){
   serviceNeGuestYieldSync(options);assert.equal(e.get_eip(),f.body);assert.equal(e.get_eax(),alias?0:87);assert.equal(e.get_edx(),0);assert.equal(e.get_esp(),before[1]+38);
   if(alias){const made=calls.slice(started).find(x=>x.name==='reg_create_key');assert(made);const allocated=read(made.args[2]);assert.equal(imp.host.reg_close_key(allocated),0);}
  }else{
   assert.throws(()=>serviceNeGuestYieldSync(options));assert.equal(e.get_esp(),before[1]);assert.equal(e.get_ebp(),before[2]);assert.equal(read(e.get_esp()),ret);assert.equal(calls.length,started,'rejected owner never calls backend');
  }
  assert.equal(changed,null);assert.equal(e.reg_test_span(stackFar,4,1),0,'alias retired after teardown');
  retireNativeFtConnections(ctx);assert.equal(e.win16_ft_checkpoint(),0n);records.push({kind:'actual-qt-'+kind,shift,restored:true});
 }
 // The real CPUWorker enters the same far calls through its native QT lease.
 const {GuestThreadHost}=require('../lib/guest-thread-host');
 for(const shift of [0,2])for(const alias of [true,false]){
  const f=qtRegistryImage({alias,op:218}),host=new GuestThreadHost({memory,module,hostImports:imp.host,sigs:require('../lib/host-import-sigs.generated.json').sigs,
   workerUrl:path.resolve(__dirname,'../lib/guest-worker.js'),clockIntervalMs:0,findDll:async()=>f.ne,log:()=>{}});let link;
  const call=(n,...a)=>host.callExport(n,...a);
  const run=async(entry,sp)=>{await call('set_eip',entry);await call('set_esp',sp);await call('guest_write32',sp,0);for(let n=0;n<100;n++){const r=await host.link.slice(256);if(r.trapped||!await call('get_eip'))return r;}throw Error('Worker registry budget');};
  const start=calls.length;
  try{await host.start();link=host.link;await host.loadPe(f.bytes,'registry-qt.exe');assert(!(await run(f.entry,0x7408000)).trapped);
   assert(!(await run(f.invoke,0x74fd494+shift)).trapped);assert.equal(await call('get_eax'),alias?0:87);assert.equal(await call('get_esp'),0x74fd494+shift+40);
   for(const row of calls.slice(start).filter(x=>x.name==='reg_create_key'))assert.equal(imp.host.reg_close_key(read(row.args[2])),0);
  }finally{await host.stop();}
  assert(link._loaderRetirementReceipt?.retired);records.push({kind:'actual-cpu-worker-qt',shift,alias,joined:true});
 }
 // Ordinary NE executable: index-1 code selector, no PE invocation context.
 {
  const b=registryImage(217),n=0x80,c=caller(217);b.writeUInt16LE(1,n+12);b.writeUInt16LE(0x40,n+0x14);b.writeUInt16LE(1,n+0x16);b.writeUInt16LE(0xff0,n+0x18);b.writeUInt16LE(2,n+0x1a);
  b[0x240+c.code.length-1]=0xeb;b[0x240+c.code.length]=0xfe;
  new Uint8Array(memory.buffer).set(b,e.get_staging());const entry=e.load_pe(b.length);ds=e.get_sreg_ds();
  assert.equal(entry>>>16,15);const stop=e.get_eip()+c.code.length-1;e.clear_yield();for(const [i,arg] of [0x80000001,str(0x200,'Software\\Win16RegistryProof'),far(0x100)].entries())write(ptr(i*4),arg);
  for(let i=0;i<100&&e.get_eip()!==stop;i++)e.run(1);
  assert.equal(e.get_eip(),stop);assert.equal(e.get_eax(),0);assert.equal(e.get_edx(),0);assert.equal(imp.host.reg_close_key(read(ptr(0x100))),0);
  records.push({kind:'standalone-native-ne-index1',stoppedAtAuthoredLoop:true,realRegistryCall:true});
 }
 if(process.env.NEVERHOOD_REGISTRY_RESULT)fs.writeFileSync(process.env.NEVERHOOD_REGISTRY_RESULT,JSON.stringify({records,calls: calls.map(x=>x.name),originalExecuted:false},null,2)+'\n');
 console.log('PASS native Win16 registry ABI/shared-store/data/sizing/errors/outputs/QT alias',records.length);
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main,extraWat,registryImage,qtRegistryImage};
