#!/usr/bin/env node
'use strict';
// Actual NE import relocation and KERNEL47 guest call. No copied API implementation.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {GUEST_BASE}=require('../lib/region-map.generated');
function neFixture(name='QUERYAPP'){
 const b=Buffer.alloc(0xa00),n=0x80,w=(o,v)=>b.writeUInt16LE(v,o);b.write('MZ');b.writeUInt32LE(n,60);b.write('NE',n);
 w(n+4,0x80);w(n+6,2);w(n+0xe,2);w(n+0x12,0x200);w(n+0x14,0);w(n+0x16,1);w(n+0x18,0xf00);w(n+0x1a,2);w(n+0x1c,2);w(n+0x1e,1);w(n+0x22,0x40);w(n+0x26,0x90);w(n+0x28,0xa0);w(n+0x2a,0xb0);w(n+0x32,4);
 w(n+0x40,0x40);w(n+0x42,0x80);w(n+0x44,0x100);w(n+0x46,0x1000);
 w(n+0x48,0x80);w(n+0x4a,0x200);w(n+0x4c,1);w(n+0x4e,0x1000);
 b[n+0x90]=name.length;b.write(name,n+0x91);b[n+0xb0]=6;b.write('KERNEL',n+0xb1);
 for(const start of [0,0x20]){b.set(start?[0x6a,0,0x6a,0]:[0x1e,0x68,0,1],0x400+start);b.set([0x9a,0xff,0xff,0,0,0xa3,0,2,0x90,0xeb,0xfe],0x404+start);}
 b.set([0x1e,0x68,0,1,0x6a,5,0x9a,0xff,0xff,0,0,0xa3,0,2,0x90,0xeb,0xfe],0x440);
 w(0x405,0x25);w(0x425,0xffff);w(0x480,2);b[0x482]=3;b[0x483]=1;w(0x484,5);w(0x486,1);w(0x488,47);b[0x48a]=3;b[0x48b]=1;w(0x48c,0x47);w(0x48e,1);w(0x490,166);
 return b;
}
async function main(){
 const mod=await WebAssembly.compile(fs.readFileSync(process.argv[2]||path.join(__dirname,'../build/wine-assembly.wasm')));
 // This fixture has no host startup-ticket service; -1 is the unsupported ABI.
 const hostCalls={process_ctl:()=>-1};
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};for(const x of WebAssembly.Module.imports(mod)){const a=imports[x.module]||={};a[x.name]=x.kind==='memory'?memory:(...args)=>hostCalls[x.name]?.(...args)||0;}
 const {exports:e}=await WebAssembly.instantiate(mod,imports),u=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),b=neFixture();u.set(b,e.get_staging());assert.ok(e.load_ne(b.length)>=0);
 const code=e.win16_seg_base(1),data=e.win16_seg_base(2)+GUEST_BASE,task=(e.win16_auto_data()<<3)|7;
 function query(name,x=e,c=code,d=data){const start=name===null?0x20:0;if(name!==null){u.fill(0,d+0x100,d+0x200);u.set(Buffer.from(name+'\0'),d+0x100);}x.clear_bp();x.set_eip(c+start);x.set_bp(c+start+13);x.run(1000);assert.equal(x.get_eip()>>>0,c+start+13,'actual guest returned from KERNEL47');return dv.getUint16(d+0x200,true);}
 const names=()=>Buffer.from(u.subarray(e.win16_dynamic_module_slot(0),e.win16_dynamic_module_slot(0)+24*16));
 const before=names();assert.equal(query('SETUPL.DLL'),0,'unloaded named module must not fabricate task instance');assert.deepEqual(names(),before,'query must not reserve unknown module slot');
 assert.equal(query(null),task,'preserved null/current-instance path');assert.equal(query('queryapp'),task,'actual task NE resident name');assert.equal(query('C:\\demo\\QUERYAPP.EXE'),task,'normalized task path');assert.equal(query('QUERYAPQ'),0,'different same-length name is unknown');
 const system=query('gDi');assert.ok(system>=0x100);assert.notEqual(system,task);assert.equal(query('GDI.DLL'),system,'emulated module identity stable');
 const slot=e.win16_dynamic_module_slot(0);u.set(Buffer.from([6,...Buffer.from('SETUPL')]),slot);assert.equal(query('SETUPL.DLL'),0,'registered but not loaded module remains absent');
 const dll=neFixture('SETUPL');u.set(dll,e.win16_dll_staging(13));assert.ok(e.load_ne_dll_sized(13,dll.length)>0,'real module loader accepts image');const handle=query('setupl.dll');assert.ok(handle>=0x100);assert.notEqual(handle,task);assert.equal(query('C:\\lang\\SETUPL.DLL'),handle,'actual loaded module handle stable');
 const after=names();for(let i=0;i<30;i++)assert.equal(query('MISSING'+i+'.DLL'),0);assert.deepEqual(names(),after,'repeated misses do not exhaust module registry');assert.equal(query('SETUPL'),handle);
 // Drive actual WinExec to create its own start record, then boot a separate
 // instance on shared memory, as the owning Worker does. No task globals copied.
 const child=neFixture('CHILDAPP'),launches=[];
 for(const x of WebAssembly.Module.imports(mod))if(x.kind==='function'){
  if(x.name==='win16_stage_module')hostCalls[x.name]=(name,id)=>{assert.equal(Buffer.from(u.subarray(name+1,name+1+u[name])).toString(),'CHILD.EXE');u.set(child,e.win16_dll_staging(id));return child.length;};
  if(x.name==='create_thread')hostCalls[x.name]=(...args)=>{launches.push(args);return 2;};
 }
 // Imports are bound at instantiate: use dispatch closures from the original
 // instance's import table, installed below before instantiation.
 u.fill(0,data+0x100,data+0x200);u.set(Buffer.from('CHILD.EXE\0'),data+0x100);
 e.clear_bp();e.set_eip(code+0x40);e.set_bp(code+0x4f);e.run(1000);assert.equal(launches.length,1,'actual WinExec starts child');
 const childInstance=(await WebAssembly.instantiate(mod,imports)).exports;
 childInstance.init_thread(1,0,0,0,0,0,0,0);
 const stack=childInstance.guest_stack_alloc(4096);assert.ok(stack);childInstance.guest_write32(stack+4092,launches[0][1]);childInstance.guest_write32(stack+4088,0);childInstance.set_esp(stack+4088);childInstance.set_eip(launches[0][0]);
 const childHandle=dv.getUint16(data+0x200,true),childCode=e.win16_seg_base((childHandle>>>3)-1),childData=e.win16_seg_base(childHandle>>>3)+GUEST_BASE;
 childInstance.set_bp(childCode);childInstance.run(1000);assert.equal(childInstance.get_eip()>>>0,childCode,'actual child task boot reaches own entry');assert.equal(childInstance.win16_sreg(3),childHandle);assert.notEqual(childHandle,task);
 assert.equal(query('CHILDAPP',childInstance,childCode,childData),childHandle,'child actual resident name resolves child instance');assert.equal(query(null,childInstance,childCode,childData),childHandle);assert.equal(query('NOCHILD',childInstance,childCode,childData),0);assert.equal(query('SETUPL',childInstance,childCode,childData),handle,'child sees actual shared loaded DLL');
 console.log('PASS actual Win16 KERNEL47: unknown/unloaded, no allocation, task/null, system, real-loaded and repeated-query controls');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={neFixture};
