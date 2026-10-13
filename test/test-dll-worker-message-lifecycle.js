'use strict';
// Execute the shipped browser Worker message handler with a real WebAssembly
// instance and real PE APIs. The VM is only the message transport; DLL mapping,
// DllMain, nested COM callbacks and their saved guest frames are genuine.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHostImports } = require('../lib/host-imports');
const loader = require('../lib/dll-loader');
const boot = require('../lib/process-boot');
const { X86, pe, u32, API, BASE, DATA } = require('./test-dll-lifecycle-real-pe');
if (!API.includes('CoCreateInstance')) API.push('CoCreateInstance');
const ret = [0xb8, 1, 0, 0, 0, 0xc2, 12, 0];
function activation(a, dll = false) {
  return a.push(DATA + 0x180).push(DATA + 0x190).push(1).push(0).push(DATA + 0x1a0).api('CoCreateInstance', dll);
}
function server(id) {
  const a = new X86().emit(0x8b, 0x44, 0x24, 8, 0xff, 0x04, 0x85, u32(DATA + id * 16), ...ret);
  const dgc = new X86().emit(0xff, 0x05, u32(DATA + 0x100 + id * 4), 0xb8, u32(0x80004002), 0xc2, 12, 0).finish();
  const b = pe([[0x1000, a.finish()], [0x1200, dgc]], true), o = 0x80 + 24;
  const raw = r => r - 0x1000 + 0x200;
  b.writeUInt32LE(0x1e00, o + 96); b.writeUInt32LE(0xb0, o + 100);
  for (const [off,value] of [[12,0x1e60],[16,1],[20,1],[24,1],[28,0x1e40],[32,0x1e44],[36,0x1e48]]) b.writeUInt32LE(value,raw(0x1e00+off));
  b.writeUInt32LE(0x1200,raw(0x1e40)); b.writeUInt32LE(0x1e80,raw(0x1e44));
  b.write('DEFFILE.dll\0',raw(0x1e60)); b.write('DllGetClassObject\0',raw(0x1e80));
  if (id === 3) {
    // A mapped PE with an invalid bitmap-directory suboffset. The DLL code
    // is valid; optional host bitmap extraction must not retain old resources.
    const section = o + 0xe0 + 40;
    b.writeUInt16LE(2, 0x80 + 6); b.write('.rsrc', section);
    for (const [offset,value] of [[8,0x100],[12,0x2f00],[16,0x100],[20,0x2100],[36,0x40000040]]) b.writeUInt32LE(value, section+offset);
    b.writeUInt32LE(0x2f00,o+112); b.writeUInt32LE(0x100,o+116);
    b.writeUInt16LE(1,0x210e); b.writeUInt32LE(2,0x2110); b.writeUInt32LE(0xfffffff0,0x2114);
  }
  return b;
}
function outer() {
  const a = new X86().emit(0x53,0x8b,0x5c,0x24,8,0x83,0x7c,0x24,12,1).branch([0x0f,0x85],'done');
  activation(a,true).eaxTo(0x174);
  a.label('done').emit(0x5b,...ret);
  return pe([[0x1000,a.finish()]],true);
}
async function run() {
  const wasm = await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM || path.join(__dirname,'../build/wine-assembly.wasm')));
  const memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const ctx = {getMemory:()=>memory.buffer,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}},onExit(){}};
  const imports = createHostImports(ctx); imports.host.memory=memory; imports.host.has_dll_file=()=>1;
  const mapped = new Map(), lookups=[]; let pendingName='WMADMOD.DLL';
  imports.host.com_get_pending_dll=(wa,capacity)=>{
    assert(pendingName.length+1<=capacity); const bytes=new Uint8Array(memory.buffer,wa,capacity); bytes.fill(0); bytes.set(Buffer.from(pendingName)); return wa;
  };
  imports.host.com_create_instance=(_clsid,_outer,_flags,_iid,ppv)=>{
    const module=mapped.get(pendingName.toLowerCase());
    if(!module)return 0x800401f0;
    ctx.exports.guest_write32(ppv,module.loadAddr+0x1200); return 2; // resolve actual guest DllGetClassObject
  };
  const instance=await WebAssembly.instantiate(wasm,imports); const e=ctx.exports=instance.exports;
  const direct=activation(new X86()).eaxTo(0x170).emit(0xc3).finish();
  const release=new X86().emit(0x50).api('FreeLibrary').eaxTo(0x17c).emit(0xc3).finish();
  const load=new X86().push(BASE+0x1600).api('LoadLibraryA').eaxTo(0x178).emit(0xc3).finish();
  const exe=pe([[0x2000,direct],[0x2200,load],[0x2400,release],[0x1600,'outer.dll\0'],[0x15a0,u32(0x13572468)]]);
  new Uint8Array(memory.buffer,e.get_staging(),exe.length).set(exe);e.load_pe(exe.length);
  const files={'wmadmod.dll':server(0),'wmvdmod.dll':server(1),'nested-com.dll':server(2),'wmad2.dll':server(3),'outer.dll':outer()};
  const replies=[]; let sandbox;
  const resourceHost={registered:new Map(),registerModule(name,base,generation){this.registered.set(base,{name,generation});}};
  const send=reply=>{
    replies.push(reply);
    if(reply.t==='dllMapped'){
      mapped.set(reply.record.fileName.toLowerCase(),reply.record.result);
      boot.registerMappedDll(resourceHost,e,memory.buffer,reply.record);
    }
    if(reply.t==='dllRetired'){
      const row=reply.record;
      for(const[name,value]of mapped)if(value.index===row.index&&value.generation===row.generation)mapped.delete(name);
      const entry=resourceHost.registered.get(row.loadAddr);
      if(entry&&entry.generation===row.generation)resourceHost.registered.delete(row.loadAddr);
      if(resourceHost.dllResources&&resourceHost.dllResources[row.loadAddr]&&resourceHost.dllResources[row.loadAddr].generation===row.generation)delete resourceHost.dllResources[row.loadAddr];
    }
    if(reply.t==='dllLookup'){
      lookups.push(reply);
      queueMicrotask(()=>sandbox.onmessage({data:{t:'dllLookupResult',lookup:reply.lookup,bytes:files[String(reply.fileName).toLowerCase()]||null}}));
    }
  };
  sandbox={URL,importScripts(){},location:{href:'https://example.invalid/lib/guest-worker.js?v=fixture'},
    postMessage:send,DllLoader:loader,processBoot:boot,fixtureInstance:instance,fixtureMemory:memory,setTimeout,clearTimeout,performance};
  sandbox.self=sandbox;
  const context=vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require.resolve('../lib/guest-worker'),'utf8'),context);
  vm.runInContext('instance=fixtureInstance; memory=fixtureMemory;',context);
  const stack=e.guest_alloc(0x10000)+0xfff0;
  function begin(rva,arg=0){e.set_eax(arg);e.guest_write32(stack,0);e.set_esp(stack);e.set_eip(BASE+rva);e.clear_yield();e.run(10000);}
  function finish(){for(let i=0;i<100&&e.get_eip();i++){assert.equal(e.get_yield_reason(),0);e.run(10000);}assert.equal(e.get_eip(),0);assert.equal(e.get_esp(),stack+4);}
  const read=o=>e.guest_read32(DATA+o)>>>0;
  for(const [seq,fileName]of['WMADMOD.DLL','WMVDMOD.DLL'].entries()){
    pendingName=fileName; begin(0x2000);assert.equal(e.get_yield_reason(),3,'real CoCreateInstance must park');
    await sandbox.onmessage({data:{t:'comLoadDll',seq,fileName,bytes:files[fileName.toLowerCase()]}});
    const reply=replies.find(r=>r.t==='comDllLoaded'&&r.seq===seq);assert(reply&&reply.loadAddr&&!reply.error);
    finish();assert.equal(read(0x170),0x80004002,'actual guest class factory export returns E_NOINTERFACE');
    assert.equal(read(4+seq*16),1,'real DllMain ran exactly once');assert.equal(read(0x100+seq*4),1,'real DllGetClassObject executed');
  }
  assert.notEqual(mapped.get('wmadmod.dll').loadAddr,mapped.get('wmvdmod.dll').loadAddr,'identical internal export names preserve distinct files');
  pendingName='missing.dll';begin(0x2000);assert.equal(e.get_yield_reason(),3);e.guest_write32(DATA+0x180,0xdeadbeef);
  await sandbox.onmessage({data:{t:'comLoadDll',seq:7,fileName:pendingName,bytes:null}});
  finish();assert.equal(read(0x170),0x80040154);assert.equal(read(0x180),0,'missing server clears ppv and returns through real guest frame');
  const oldRecord=replies.find(r=>r.t==='dllMapped'&&r.record.fileName.toLowerCase()==='wmadmod.dll').record;
  begin(0x2400,oldRecord.result.loadAddr);assert.equal(e.get_yield_reason(),5);
  await sandbox.onmessage({data:{t:'serviceDllYield',seq:9}});finish();assert.equal(read(0x17c),1);
  pendingName='WMAD2.DLL';begin(0x2000);assert.equal(e.get_yield_reason(),3);
  await sandbox.onmessage({data:{t:'comLoadDll',seq:10,fileName:pendingName,bytes:files['wmad2.dll']}});finish();
  const currentRecord=replies.find(r=>r.t==='dllMapped'&&r.record.fileName.toLowerCase()==='wmad2.dll').record;
  assert.equal(currentRecord.result.loadAddr,oldRecord.result.loadAddr);assert(currentRecord.result.generation>oldRecord.result.generation);
  if(process.env.WA_DLL_STALE_MAP_CONTROL==='1')loader.isCurrentDllMapping=()=>true;
  const accepted=boot.registerMappedDll(resourceHost,e,memory.buffer,oldRecord);
  assert.equal(resourceHost.dllResources[currentRecord.result.loadAddr].generation,currentRecord.result.generation,
    'delayed old DLL mapping overwrote current resource generation');
  assert.equal(resourceHost.registered.get(currentRecord.result.loadAddr).name.toLowerCase(),'wmad2.dll');
  assert.equal(accepted,false,'old map event is rejected after actual PE unload/reload');
  send({t:'dllRetired',record:oldRecord.result});
  assert.equal(resourceHost.dllResources[currentRecord.result.loadAddr].generation,currentRecord.result.generation,'old retirement cannot delete current resources');
  pendingName='nested-com.dll';begin(0x2200);assert.equal(e.get_yield_reason(),5);
  await sandbox.onmessage({data:{t:'loadLibrary',seq:8,fileName:'outer.dll',bytes:files['outer.dll']}});
  const result=replies.find(r=>r.t==='libLoaded'&&r.seq===8);assert(result&&result.loadAddr);
  finish();assert.equal(read(0x174),0x80004002,'nested COM activation returned to owning DllMain');
  assert.equal(read(0x178),result.loadAddr);assert.equal(read(0x24),1);assert.equal(read(0x108),1);
  assert(lookups.some(x=>String(x.fileName).toLowerCase()==='nested-com.dll'),'nested resolver must cross actual message queue');
  assert(!replies.some(x=>x.t==='error'),JSON.stringify(replies.filter(x=>x.t==='error')));
  console.log('PASS real PE COM Worker messages, distinct server paths, missing-server frame cleanup and nested DllMain COM lookup');
}
module.exports=run;
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
