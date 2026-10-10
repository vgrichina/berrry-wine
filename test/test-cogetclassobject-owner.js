#!/usr/bin/env node
'use strict';
// Installed under test/. Compile normal production sources; no scratch dependency.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {compileSrcWasm}=require('./compile-src');
const {createStorageImports,setRegValue}=require('../lib/storage');
const {g2w}=require('../lib/mem-utils');
const api=require('../src/api_table.json');
const moduleBytes=compileSrcWasm(),moduleObject=new WebAssembly.Module(moduleBytes);
const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});let storage,hostCalls=0,missingOnce=false;
function instance(){const imports={};for(const i of WebAssembly.Module.imports(moduleObject)){imports[i.module]||={};imports[i.module][i.name]=i.kind==='memory'?memory:()=>0;}imports.host.com_create_instance=(...args)=>{hostCalls++;if(missingOnce){missingOnce=false;return 0x800401f0;}return storage.com_create_instance(...args);};return new WebAssembly.Instance(moduleObject,imports).exports;}
const owner=instance(),shadow=instance(),fixture=fs.readFileSync(path.join(__dirname,'binaries/notepad.exe'));
new Uint8Array(memory.buffer).set(fixture,owner.get_staging());assert(owner.load_pe(fixture.length));
shadow.set_host_shadow(1);shadow.init_thread(7,owner.get_image_base(),owner.get_code_start(),owner.get_code_end(),owner.get_thunk_base(),owner.get_thunk_end(),owner.get_num_thunks(),0);
shadow.set_esp(0);shadow.set_eip(0);const pageBefore=[shadow.get_esp(),shadow.get_eip(),shadow.get_eax()];let shadowRuns=0;
const sharedCom={classes:new Map(),cookies:new Map(),nextCookie:1};
storage=createStorageImports({getMemory:()=>memory.buffer,exports:{...shadow,run(){shadowRuns++;throw Error('Guest execution on shadow forbidden');}},sharedCom});
const put=(p,v)=>owner.guest_write32(p,v|0),get=p=>owner.guest_read32(p)>>>0;
const b=owner.get_image_base(),arena=owner.guest_alloc(0x5000),E=arena+0x4800,out=arena+0x3000,clsid=arena+0x3100,iid=arena+0x3120,innerClsid=arena+0x3140,innerOut=arena+0x3160,seen=arena+0x3200,factory=arena+0x3300,vt=arena+0x3340,object=arena+0x3380;
put(clsid,0x12345678);put(innerClsid,0x12345679);put(iid,0x11223344);put(iid+4,0x55667788);put(iid+8,0x99aabbcc);put(iid+12,0xddeeff00);
function text(p,s){for(let i=0;i<=s.length;i++)owner.guest_write8(p+i,i<s.length?s.charCodeAt(i):0);}
function bytes(p,a){for(let i=0;i<a.length;i++)owner.guest_write8(p+i,a[i]);owner.invalidate_code_range(p,a.length);}
const u=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
function thunk(name){const n=owner.get_num_thunks(),t=owner.get_thunk_base()+n*8;owner.sync_thunk_state(t+8,n+1);put(t,0);put(t+4,api.find(a=>a.name===name).id);return t;}
const coGet=thunk('CoGetClassObject'),coCreate=thunk('CoCreateInstance'),sleep=thunk('Sleep');
function dll(base,name,gco){const n=shadow.get_dll_count(),d=new DataView(memory.buffer),row=shadow.get_dll_table()+n*32;d.setUint32(row,base,true);d.setUint32(row+8,0x100,true);put(base+0x10c,0x200);put(base+0x118,1);put(base+0x11c,0x300);put(base+0x120,0x310);put(base+0x124,0x320);put(base+0x300,gco-base);put(base+0x310,0x220);put(base+0x320,0);text(base+0x200,name);text(base+0x220,'DllGetClassObject');shadow.set_dll_count(n+1);}
const dllBase=arena,gco=arena+0x400,innerGco=arena+0x1400;
dll(dllBase,'owner-test.dll',gco);dll(arena+0x1000,'inner-test.dll',innerGco);
setRegValue('HKCR\\CLSID\\{12345678-0000-0000-0000-000000000000}\\InprocServer32','','REG_SZ','C:\\owner-test.dll');
setRegValue('HKCR\\CLSID\\{12345679-0000-0000-0000-000000000000}\\InprocServer32','','REG_SZ','C:\\inner-test.dll');
function code(hr,pointer=factory,record=seen){return [0x89,0xe2,0x89,0x15,...u(record),0x8b,0x44,0x24,4,0xa3,...u(record+4),0x8b,0x44,0x24,8,0xa3,...u(record+8),0x8b,8,0x89,0x0d,...u(record+12),0x8b,0x44,0x24,12,0xc7,0,...u(pointer),0xb8,...u(hr),0xc2,12,0];}
function start(which=coGet,targetOut=out){owner.clear_yield();put(out,0xdeadbeef);put(E,0);const args=which===coGet?[clsid,3,0,iid,targetOut]:[clsid,0,3,iid,targetOut];args.forEach((v,i)=>put(E+4+i*4,v));owner.set_esp(E);owner.set_eip(which);}
function finish(hr,pointer){for(let i=0;i<8&&owner.get_eip();i++)owner.run(1000);assert.equal(owner.get_eip(),0);assert.equal(owner.get_esp(),E+24);assert.equal(owner.get_eax()>>>0,hr>>>0);assert.equal(get(out),pointer>>>0);assert.equal(shadowRuns,0);assert.deepEqual([shadow.get_esp(),shadow.get_eip(),shadow.get_eax()],pageBefore);}
for(const [hr,pointer,expectedHr,expectedOut]of [[0,factory,0,factory],[0x80004002,factory,0x80004002,0],[1,factory,1,0],[0,0,0x80004005,0]]){bytes(gco,code(hr,pointer));start();finish(expectedHr,expectedOut);assert.equal(get(seen),E-36,'GCO starts at original E minus20-byte frame and16-byte call');assert.equal(get(seen+4),clsid);assert.equal(get(seen+8),iid,'requested IID pointer preserved');}
bytes(gco,code(0));start(coGet,0);const beforeNull=hostCalls;finish(0x80004003,0xdeadbeef);assert.equal(hostCalls,beforeNull,'null ppv rejected before host');
missingOnce=true;start();owner.run(1000);assert.equal(owner.get_yield_reason(),3);assert.equal(owner.get_esp(),E,'async miss preserves original stdcall frame');assert.equal(owner.get_eip(),coGet,'retry remains at original thunk');owner.clear_yield();finish(0,factory);
// Yield inside real guest GCO; per-call mode/frame survives an ordinary slice.
bytes(gco,[0x6a,1,0xb8,...u(sleep),0xff,0xd0,...code(0)]);start();owner.run(1000);assert.equal(owner.get_sleep_yielded(),1);assert.notEqual(owner.get_eip(),0);assert.equal(owner.get_esp(),E-36);assert.equal(get(E-16),0,'factory-only tag at F+4 survives yield');owner.clear_yield();finish(0,factory);
// Nested real guest CoGetClassObject: outer F+4 mode survives inner activation.
bytes(innerGco,code(0,factory,seen+32));
const nested=[0x68,...u(innerOut),0x68,...u(iid),0x6a,0,0x6a,3,0x68,...u(innerClsid),0xb8,...u(coGet),0xff,0xd0,...code(0)];bytes(gco,nested);start();finish(0,factory);assert.equal(get(innerOut),factory);assert.equal(get(seen),E-36);assert.equal(get(seen+32),E-96,'inner frame is separate');
// Registered factory resolves directly; never call any page lifetime/guest code.
sharedCom.classes.set('{12345678-0000-0000-0000-000000000000}',{pUnkGA:factory});start();finish(0,factory);sharedCom.classes.clear();
bytes(gco,code(0,0));start(coCreate);finish(0x80004002,0);
// Existing CoCreateInstance still calls real GCO, CreateInstance and Release.
bytes(gco,code(0));put(factory,vt);const create=arena+0x1800,release=arena+0x1900;put(vt+12,create);put(vt+8,release);
bytes(create,[0x8b,0x44,0x24,12,0xa3,...u(seen+64),0x8b,0x44,0x24,16,0xc7,0,...u(object),0x31,0xc0,0xc2,16,0]);bytes(release,[0x31,0xc0,0xc2,4,0]);start(coCreate);finish(0,object);assert.equal(get(seen+64),iid);assert.equal(get(seen+12),1,'normal activation still supplies IID_IClassFactory');
// Resolver private flags are preserved; legacy class-only registered lookup remains direct.
assert.equal(storage.com_create_instance(g2w(clsid,b,memory.buffer),0,0x40000003,g2w(iid,b,memory.buffer),out),2);assert.equal(get(out),gco);
sharedCom.classes.set('{12345678-0000-0000-0000-000000000000}',{pUnkGA:factory});assert.equal(storage.com_create_instance(g2w(clsid,b,memory.buffer),0,0x80000003,g2w(iid,b,memory.buffer),out),0);assert.equal(get(out),factory);
// Registered factories must execute on the requesting CPU too. The page
// shadow has ESP=0; running its callback cannot construct this stdcall frame.
const addref=arena+0x1a00;
put(vt+4,addref);
bytes(addref,[0xff,0x05,...u(seen+80),0xb8,...u(0x80000001),0xc2,4,0]);
bytes(release,[0xff,0x05,...u(seen+84),0xb8,1,0,0,0,0xc2,4,0]);
const registeredCreate=[0x89,0xe2,0x89,0x15,...u(seen+88),0x8b,0x44,0x24,4,0xa3,...u(seen+92),0x8b,0x44,0x24,16,0xa3,...u(seen+96),0xc7,0,...u(object),0x31,0xc0,0xc2,16,0];
bytes(create,registeredCreate);start(coCreate);finish(0,object);
assert.equal(get(seen+80),1,'activation retains its borrowed registered factory');
assert.equal(get(seen+84),1,'activation releases exactly its own reference');
assert.equal(get(seen+88),E-40,'registered CreateInstance owns the real caller stack');
assert.equal(get(seen+92),factory);assert.equal(get(seen+96),out,'non-null ppv reaches the guest factory');
bytes(create,[0x6a,1,0xb8,...u(sleep),0xff,0xd0,...registeredCreate]);start(coCreate);owner.run(1000);
assert.equal(owner.get_sleep_yielded(),1,'registered constructors may yield through ordinary scheduling');
assert.equal(get(out),0,'a yielded constructor has not completed activation');owner.clear_yield();finish(0,object);
assert.equal(get(seen+80),2);assert.equal(get(seen+84),2);
bytes(create,[0x8b,0x44,0x24,16,0xc7,0,...u(object),0xb8,...u(0x80070057),0xc2,16,0]);start(coCreate);finish(0x80070057,0);
assert.equal(get(seen+80),3);assert.equal(get(seen+84),3,'failed constructor still releases the temporary factory reference');
// Real codec DLLs can share an unrelated export-directory name. Resolve
// their recorded filenames independently, including on the idle shadow.
sharedCom.classes.clear();
text(dllBase+0x200,'DEFFILE.dll');text(arena+0x1200,'DEFFILE.dll');
text(arena+0x3500,'C:\\Codecs\\OWNER-test.DLL');text(arena+0x3600,'C:/Codecs/inner-test.dll');
shadow.set_dll_path(0,arena+0x3500);shadow.set_dll_path(1,arena+0x3600);
for(const [cls,target]of [[clsid,gco],[innerClsid,innerGco]]){
  assert.equal(storage.com_create_instance(g2w(cls,b,memory.buffer),0,0x40000003,g2w(iid,b,memory.buffer),out),2,'recorded module path avoids another async load');
  assert.equal(get(out),target,'shared export name must not select the other codec');
}
setRegValue('HKCR\\CLSID\\{12345678-0000-0000-0000-000000000000}\\InprocServer32','','REG_SZ','DEFFILE.dll');
assert.equal(storage.com_create_instance(g2w(clsid,b,memory.buffer),0,0x40000003,g2w(iid,b,memory.buffer),out)>>>0,0x800401f0,'internal export label is not an alias for a named module');
assert.equal(shadowRuns,0);
console.log('PASS real owner/shadow instances: requested IID, failure/positive/null normalization, exact E/F frames, retry, nesting, registered factory and CoCreateInstance');
