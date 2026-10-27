'use strict';
// Compile the actual production DirectInput path, with trap-only out-of-scope
// dependencies. The fixture implements no keyboard buffering algorithm.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function forms(source) {
 const out=[];let start=-1,depth=0,string=false,line=false,block=0;
 for(let i=0;i<source.length;i++) {let c=source[i],n=source[i+1];
  if(line){if(c==='\n')line=false;continue;}
  if(block){if(c==='('&&n===';'){block++;i++;}else if(c===';'&&n===')'){block--;i++;}continue;}
  if(string){if(c==='\\'){i++;continue;}if(c==='"')string=false;continue;}
  if(c===';'&&n===';'){line=true;i++;continue;}if(c==='('&&n===';'){block++;i++;continue;}
  if(c==='"'){string=true;continue;}
  if(c==='('){if(!depth)start=i;depth++;}else if(c===')'){if(!--depth)out.push(source.slice(start,i+1));}
 }
 assert.equal(depth,0);return out;
}
const files=['09a8-handlers-directx.wat','01-header.wat','03-registers.wat','03a-page-watch.wat','10-helpers.wat'];
const controlSource=process.argv.find(x=>x.startsWith('--control-source='));
const sources=files.map((f,i)=>fs.readFileSync(i===0&&controlSource?controlSource.slice('--control-source='.length):path.join(ROOT,'src',f),'utf8'));
if(process.argv.includes('--baseline'))assert.equal(sha(sources[0]),'d5fb8b951707ffef055ba46eddcabc812b2b4ea8660956122c1e6da34cf2ef4e');
const all=sources.flatMap(forms), byName=new Map();
for(const f of all){let m=f.match(/^\((?:func|global)\s+(\$[\w-]+)/)||f.match(/^\(defmacro\s+\(([^\s)]+)/);if(m)byName.set(m[1],f);}
const funcs=new Set(['$handle_IDirectInputDevice_GetDeviceData','$handle_IDirectInputDevice_Acquire','$handle_IDirectInputDevice_Unacquire','$dx_from_this','$dx_slot_of','$dx_surf_state_ptr','$di_device_is_acquired','$di_format_offset','$di_format_map','$di_format_map_get','$di_object_offset','$g2w','$gl32','$gs32']);
for(const name of byName.keys())if(/^\$di_(kbd_|dik_to_vk)/.test(name))funcs.add(name);
const picked=new Map(),stubs=new Map();
funcs.add('$page_watch_write_one');
funcs.add('$page_watch_cell');
for(const name of ['$handle_IDirectInputDevice_GetDeviceState','$g2w_affine_span','$zero_memory','$page_watch_write','$page_watch_valid','$handle_IDirectInputDevice_SetProperty','$handle_IDirectInputDevice_GetProperty','$di_valid_device_dword_property'])funcs.add(name);
byName.set('$uwc_on','(global $uwc_on (mut i32) (i32.const 0))');
byName.set('$fault_sync_epoch','(global $fault_sync_epoch (mut i32) (i32.const 0))');
const stubSigs={ '$code_write_hit':'(param i32 i32)', '$page_watch_write_one':'(param i32)', '$invalidate_code_write':'(param i32 i32)', '$page_watch_write_span':'(param i32 i32)' };
stubSigs.$page_watch_write='(param i32 i32)';
stubSigs.$d3dim_lazy_access='(param i32 i32)';
stubSigs.$uwc_bulk_note='(param i32 i32)';
function stub(name){
 let f=byName.get(name),sig;
 if(f) {sig=[];for(const decl of forms(f.slice(f.indexOf(name)+name.length,-1))){if(/^\((param|result)\b/.test(decl))sig.push(decl);else if(!decl.startsWith('(export '))break;}sig=sig.join(' ');}
 else sig=stubSigs[name];
 if(sig===undefined)throw Error('missing external signature '+name);
 stubs.set(name,`(func ${name} ${sig} (unreachable))`);
}
function visit(name){if(picked.has(name)||stubs.has(name))return;let f=byName.get(name);if(!f)throw Error('missing definition '+name);picked.set(name,f);
 for(const m of f.matchAll(/\((call|global.get|global.set)\s+(\$[\w-]+)/g)){
  const dep=m[2];if(m[1]==='call'&&!funcs.has(dep)){if(dep.startsWith('$host_')){const imp=all.find(x=>x.startsWith('(import ')&&x.includes('(func '+dep+'\n'))||all.find(x=>x.startsWith('(import ')&&x.includes('(func '+dep+' '));if(!imp)throw Error('missing import '+dep);picked.set(dep,imp);}else stub(dep);}else visit(dep);
 }
 if(f.includes('(g2w-fast '))visit('g2w-fast');
}
for(const name of funcs)visit(name);
const layouts=all.filter(f=>f.startsWith('(layout DxObject'));
const table=all.find(f=>f.startsWith('(data (region.addr $DI_DIK_VK_TABLE'));
const regionSource=fs.readFileSync(path.join(ROOT,'src/00-regions.wat'),'utf8');
const regionNames=new Set([...([...picked.values()].join('\n')+table).matchAll(/\(region\.(?:addr|size|end)\s+(\$[\w-]+)/g)].map(m=>m[1]));
const regions=forms(regionSource).filter(f=>{const m=f.match(/^\(region\.(?:declare(?:-fixed|-span|-derived)?|alias)\s+(\$[\w-]+)/);return m&&regionNames.has(m[1]);}).join('\n');
for(const m of regions.matchAll(/\((?:count|stride)\s+(\$[\w-]+)/g))visit(m[1]);
const extra=`
(func (export "entry") (result i32) (global.get $DX_OBJECTS))
(func (export "reg") (result i32) (global.get $reg_base))
(func (export "state") (result i32) (global.get $DX_SURF_STATE))
(func (export "g2w") (param i32) (result i32) (call $g2w (local.get 0)))
(func (export "getData") (param i32 i32 i32 i32 i32)
(call $handle_IDirectInputDevice_GetDeviceData (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4) (i32.const 0)))
(func (export "getState") (param i32 i32 i32)
(call $handle_IDirectInputDevice_GetDeviceState (local.get 0) (local.get 1) (local.get 2) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "setBufferSize") (param i32 i32)
(call $handle_IDirectInputDevice_SetProperty (local.get 0) (i32.const 1) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "getBufferSize") (param i32 i32)
(call $handle_IDirectInputDevice_GetProperty (local.get 0) (i32.const 1) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "acquire") (param i32) (call $handle_IDirectInputDevice_Acquire (local.get 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "unacquire") (param i32) (call $handle_IDirectInputDevice_Unacquire (local.get 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))`;
const wat=`(import "host" "memory" (memory 8192 8192 shared))\n${regions}\n${layouts.join('\n')}\n${[...picked.values()].join('\n')}\n${[...stubs.values()].join('\n')}\n${table}\n${extra}`;
const {compile}=require('../tools/watx');
const compiled=compile(wat,new Map(),{runtimeBuiltins:false,standardWat:true,tailCalls:true});
if(!compiled.wasmBinary)throw Error(JSON.stringify(compiled.errors||compiled));
const {Win98Renderer}=require('../lib/renderer');
// No canvas or UI processing occurs: real prototype, worker owner and empty HWND set.
const renderer=Object.create(Win98Renderer.prototype);
Object.assign(renderer,{inputQueue:[],windows:{},_stepWakeHooks:new Set(),wasm:{exports:{},_runsInGuestWorker:true}});
// Match actual ownership query, using a genuine registered worker capability.
renderer.wasm._guestWorker=true;
renderer._guestWorkerWasms=new WeakSet([renderer.wasm]);
const {createWindowHost}=require('../lib/host-window');
const ctx={renderer}; const host=createWindowHost(ctx,{}).imports;
const runner=fs.readFileSync(path.join(ROOT,'test/run.js'),'utf8');
assert.equal(sha(runner),'a8187d18402d223e1f411008620bf13b611c3e703739594a9b7abb80749942c7');
const wiring=runner.match(/  h\.get_key_down_state = \(vKey\) =>\n[^;]+;/)[0];
require('vm').runInNewContext(wiring,{h:host,renderer});
const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
const imports={host:{memory,...host,get_ticks:()=>100,log_i32:()=>{throw Error('wild COM slot');}}};
if(process.argv.includes('--control-missing-bridge'))delete imports.host.di_keyboard_buffer;
let publishBoundary=()=>{};
if(process.argv.includes('--rpc')) {
 const RPC=require('../lib/guest-rpc');
 const sigs=require('../lib/host-import-sigs.generated.json').sigs;
 const selected=Object.fromEntries(WebAssembly.Module.imports(new WebAssembly.Module(compiled.wasmBinary)).filter(x=>x.kind==='function').map(x=>[x.name,sigs[x.name]]));
 const broker=RPC.createMainBroker(memory,imports.host,selected,{});
 publishBoundary=()=>broker.publish({}); // real publication advances GEN; no invented key bitmap
 const worker=RPC.createWorkerImports(memory,selected,message=>broker.serveRpc(message.slot),{slot:1});
 imports.host={memory,...worker.imports.host};
}
const module_=new WebAssembly.Module(compiled.wasmBinary);
for(const imp of WebAssembly.Module.imports(module_))if(!(imp.name in imports.host))throw Error('unbound import '+imp.name);
const e=new WebAssembly.Instance(module_,imports).exports;
const dv=new DataView(memory.buffer),wr=(a,v)=>dv.setUint32(a,v>>>0,true),rd=a=>dv.getUint32(a,true);
const obj=0x20000,buf=0x21000,count=0x22000;
wr(e.g2w(obj)+4,0);wr(e.entry(),7);wr(e.entry()+8,1);wr(e.entry()+12,16);wr(e.entry()+20,256);wr(e.entry()+28,0x100);
e.acquire(obj);assert.equal(rd(e.reg()),0);
function poll(flags=0,max=16,buffer=buf,device=obj){wr(e.g2w(count),max);wr(e.reg()+16,0x30000);e.getData(device,16,buffer,count,flags);const n=rd(e.g2w(count)),records=[];if(buffer)for(let i=0;i<n&&i<1024;i++)records.push(Array.from({length:4},(_,j)=>rd(e.g2w(buffer)+i*16+j*4)));return {hr:rd(e.reg()),count:n,records};}
console.log(JSON.stringify({pins:files.map((f,i)=>({file:f,sha256:sha(sources[i])})),focusedWasm:sha(compiled.wasmBinary),functions:[...picked].map(([name,s])=>({name,sha256:sha(s)})),trapOnlyStubs:[...stubs.keys()],boundary:'production WAT GetDeviceData, production renderer prototype and createWindowHost get_key_down_state; fixture memory/object and ticks; no original-game execution'}));
const events=[];
function key(down){renderer[down?'handleKeyDown':'handleKeyUp'](32);events.push({down,physical:renderer.peekKeyDownState(32),queued:renderer.inputQueue.map(x=>({msg:x.msg,wParam:x.wParam}))});}
assert.equal(poll().count,0);key(true);key(false);
const delivered=[renderer.checkInput(),renderer.checkInput()];
const rapid=poll();console.log(JSON.stringify({test:'rapid down/up dispatched before poll',runnerSHA:sha(runner),wiring,wiringSHA:sha(wiring),events,delivered,result:rapid,expected:[[57,128],[57,0]],contractPass:rapid.count===2}));
key(true);renderer.checkInput();const held=poll();const duplicate=poll();key(false);renderer.checkInput();const released=poll();console.log(JSON.stringify({test:'slow positive control',held,duplicate,released}));
assert.equal(held.count,1);assert.equal(held.records[0][0],57);assert.equal(held.records[0][1],128);assert.equal(duplicate.count,0);assert.equal(released.count,1);assert.equal(released.records[0][1],0);
assert.equal(rapid.count,2,'buffered rapid press/release must both survive between polls');

const checks=[];
function check(name,fn){fn();checks.push(name);}
function dispatch(){while(renderer.checkInput()){};publishBoundary();}
function edge(vk,down){renderer[down?'handleKeyDown':'handleKeyUp'](vk);}
function tap(vk=32){edge(vk,true);edge(vk,false);dispatch();}
const property=0x23000;
function setSize(size,device=obj){[20,16,0,0,size].forEach((v,i)=>wr(e.g2w(property)+i*4,v));e.setBufferSize(device,property);return rd(e.reg());}
function reset(size=16){e.unacquire(obj);assert.equal(setSize(size),0);e.acquire(obj);assert.equal(rd(e.reg()),0);dispatch();}
const pairs=r=>r.records.map(x=>x.slice(0,2));
check('held key and typematic do not duplicate buffered transitions',()=>{
 reset();edge(32,true);edge(32,true);dispatch();assert.deepEqual(pairs(poll()),[[57,128]]);
 assert.equal(poll().count,0);edge(32,false);dispatch();assert.deepEqual(pairs(poll()),[[57,0]]);
});
check('peek identity, null count query, partial consume, null flush',()=>{
 reset();tap();const peek=poll(1),again=poll(1);assert.deepEqual(peek,again);
 assert.equal(poll(1,0xffffffff,0).count,2);assert.deepEqual(poll(1),peek);
 assert.deepEqual(pairs(poll(0,1)),[[57,128]]);assert.deepEqual(pairs(poll(1)),[[57,0]]);
 assert.equal(poll(0,0xffffffff,0).count,1);assert.equal(poll().count,0);
});
check('arrival timestamps, sequences and cross-key order survive peeks',()=>{
 reset();let tick=101;renderer._inputNowMs=()=>tick;
 edge(65,true);tick=109;edge(32,true);tick=121;edge(65,false);tick=130;edge(32,false);dispatch();
 const p=poll(1);assert.deepEqual(pairs(p),[[30,128],[57,128],[30,0],[57,0]]);
 assert.deepEqual(p.records.map(x=>x[2]),[101,109,121,130]);
 assert.deepEqual(p.records.map(x=>x[3]-p.records[0][3]),[0,1,2,3]);assert.deepEqual(poll(),p);
 delete renderer._inputNowMs;
});
check('capacity minus one, overflow sticky on peek, consume clears overflow',()=>{
 reset(3);tap();tap();const p=poll(1,100);assert.equal(p.hr,1);assert.equal(p.count,2);
 assert.deepEqual(pairs(p),[[57,128],[57,0]]);assert.deepEqual(poll(1,100),p);
 assert.equal(poll(0,0).hr,1);assert.equal(poll(1).hr,0);assert.equal(poll().count,2);
 assert.equal(poll().count,0);tap();assert.equal(poll().count,2);
 reset(1);tap();assert.equal(poll(1).hr,1);assert.equal(poll(1).count,0);
});
check('acquire is not reference counted; reset discards stale edges',()=>{
 reset();tap();e.acquire(obj);assert.equal(rd(e.reg()),1);assert.equal(poll(1).count,2);
 assert.equal(setSize(5),0x800700aa);assert.equal(poll(1).count,2);
 e.unacquire(obj);assert.equal(rd(e.reg()),0);assert.equal(poll().hr,0x8007000c);
 tap();e.acquire(obj);assert.equal(rd(e.reg()),0);assert.equal(poll().count,0);
 edge(32,true);dispatch();e.unacquire(obj);e.acquire(obj);assert.equal(poll().count,0);
 edge(32,false);dispatch();assert.deepEqual(pairs(poll()),[[57,0]]);
});
check('buffer disabled preserves immediate state; oversized size clamps to supported maximum',()=>{
 reset(0);assert.equal(poll().hr,0x80040207);
 edge(32,true);dispatch();e.getState(obj,256,buf);assert.equal(rd(e.reg()),0);
 assert.equal(dv.getUint8(e.g2w(buf)+57),128);
 edge(32,false);dispatch();e.getState(obj,256,buf);assert.equal(dv.getUint8(e.g2w(buf)+57),0);
 e.unacquire(obj);assert.equal(setSize(4097),0);assert.equal(rd(e.entry()+12),4096);
 wr(e.g2w(property)+16,0);e.getBufferSize(obj,property);assert.equal(rd(e.reg()),0);assert.equal(rd(e.g2w(property)+16),4096);
 e.acquire(obj);assert.equal(rd(e.reg()),0);tap();assert.equal(poll().count,2);
});
check('two acquired keyboard devices have independent read cursors',()=>{
 reset();const other=obj+16;wr(e.g2w(other)+4,1);const entry=e.entry()+32;
 wr(entry,7);wr(entry+8,1);wr(entry+12,16);wr(entry+20,256);wr(entry+28,0x100);
 e.acquire(other);assert.equal(rd(e.reg()),0);tap();
 assert.equal(poll().count,2);assert.equal(poll(0,16,buf,other).count,2);assert.equal(poll().count,0);
 e.unacquire(other);
});
check('host contexts sharing a renderer retain separate device buffers',()=>{
 reset();const otherHost=createWindowHost({renderer},{}).imports;
 assert.equal(otherHost.di_keyboard_buffer(e.entry(),0,16),0);tap();
 assert.equal(poll().count,2);assert.equal(otherHost.di_keyboard_buffer(e.entry(),2,0),2);
 assert.equal(otherHost.di_keyboard_buffer(e.entry(),1,0),0);
});
check('aggregate storage admission rejects and recovers without consuming another device',()=>{
 reset(4096);const devices=[];
 for(let slot=1;slot<=16;slot++) {
  const device=0x28000+slot*16,entry=e.entry()+slot*32;wr(e.g2w(device)+4,slot);
  wr(entry,7);wr(entry+8,1);wr(entry+12,4096);wr(entry+20,256);wr(entry+28,0x100);
  e.acquire(device);assert.equal(rd(e.reg()),slot===16?0x8007000e:0);devices.push(device);
 }
 tap();assert.equal(poll(1).count,2);e.unacquire(devices[0]);
 e.acquire(devices[15]);assert.equal(rd(e.reg()),0);assert.equal(poll().count,2);
 for(const device of devices)e.unacquire(device);
});
check('unchanged strict DIK mapping avoids aliases and modifier duplicates',()=>{
 reset();tap(40);tap(222);tap(16);
 assert.deepEqual(pairs(poll()),[[208,128],[208,0],[40,128],[40,0],[42,128],[42,0]]);
});
check('custom buffered format offset and omitted-key filtering',()=>{
 reset();const map=0x24000;for(let i=0;i<256;i++)wr(e.g2w(map)+i*4,0xffffffff);
 wr(e.g2w(map)+57*4,7);wr(e.state(),map);tap(65);tap(32);
 assert.deepEqual(pairs(poll(1)),[[7,128],[7,0]]);assert.deepEqual(pairs(poll()),[[7,128],[7,0]]);
 assert.equal(poll().count,0);wr(e.state(),0);
});
check('immediate state is independent from queued peek and consume',()=>{
 reset();edge(32,true);dispatch();const p=poll(1);assert.equal(p.count,1);
 e.getState(obj,256,buf+0x100);assert.equal(rd(e.reg()),0);assert.equal(dv.getUint8(e.g2w(buf+0x100)+57),128);
 assert.deepEqual(poll(),p);e.getState(obj,256,buf+0x100);assert.equal(dv.getUint8(e.g2w(buf+0x100)+57),128);
 edge(32,false);dispatch();assert.deepEqual(pairs(poll()),[[57,0]]);
});
check('invalid record size and null count are still rejected',()=>{
 reset();wr(e.g2w(count),16);e.getData(obj,15,buf,count,0);assert.equal(rd(e.reg()),0x80070057);
 e.getData(obj,16,buf,0,0);assert.equal(rd(e.reg()),0x80070057);
});
check('fixture rejects out-of-scope memory and mouse dependencies',()=>{
 assert.throws(()=>e.g2w(0x90000000),WebAssembly.RuntimeError);
 wr(e.entry()+8,2);assert.throws(()=>poll(),WebAssembly.RuntimeError);wr(e.entry()+8,1);
});
e.unacquire(obj);
console.log(JSON.stringify({pass:checks.length,checks,mode:process.argv.includes('--rpc')?'production GuestRpc synchronous broker':'direct production host',noGameplayClaim:true}));
