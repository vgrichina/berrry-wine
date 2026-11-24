'use strict';
// Compile byte-exact production DirectInput forms using the pinned existing fixture.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Module = require('module');
const fixture = path.join(__dirname, 'test-directinput-buffered-keyboard.js');
const source = fs.readFileSync(fixture, 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
if (sha(source) !== 'ace1d7e70cf0dc9533a49a5a8cfb57aee4486f91e1eb433a95efb867ca9017ca')
  throw Error('production fixture identity changed');
const marker = 'const events=[];';
if (source.split(marker).length !== 2) throw Error('ambiguous setup boundary');
let setup = source.slice(0, source.indexOf(marker));
const additions=['$handle_IDirectInputDevice_SetDataFormat','$di_standard_data_format_size','$di_custom_data_format',
 '$di_format_map_drop','$di_format_map_install','$di_format_map_set','$di_object_type','$di_object_exists',
 '$di_object_guid_matches','$di_object_guid_data1','$heap_alloc','$heap_free','$di_custom_device_state'];
setup=setup.replace('const picked=new Map(),stubs=new Map();',
 `for(const name of ${JSON.stringify(additions)})funcs.add(name);
 // Allocation is fixture-owned; all DirectInput production forms are byte-exact.
 byName.set('$heap_alloc','(func $heap_alloc (param $size i32) (result i32) (i32.const 0x28000))');
 byName.set('$heap_free','(func $heap_free (param i32))');
 const picked=new Map(),stubs=new Map();`);
setup=setup.replace('const extra=`','const extra=`(func (export "setFormat") (param i32 i32) (call $handle_IDirectInputDevice_SetDataFormat (local.get 0) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))');

// Keep the actual createWindowHost public state import: the CLI override reads async state.
const cliWire="require('vm').runInNewContext(wiring,{h:host,renderer});";
if(setup.split(cliWire).length!==2)throw Error('ambiguous CLI wiring');
setup=setup.replace(cliWire,'');
// Replace the older fixture's trap/tick JS imports with production modules.
// Memory/object allocation remains fixture-owned; no input import is fabricated.
const fixtureImports="const imports={host:{memory,...host,shared_heap:()=>{throw Error('out-of-scope shared heap access');},get_ticks:()=>100,log_i32:()=>{throw Error('wild COM slot');}}};";
if(setup.split(fixtureImports).length!==2)throw Error('ambiguous fixture imports');
setup=setup.replace(fixtureImports,
 "const base=require('../lib/host-imports').createHostImports({...ctx,getMemory:()=>memory.buffer});\n"+
 "const imports={host:{...base.host,...host,memory}};");

const challenge=String.raw`
const report={mode:process.argv.includes('--rpc')?'RPC':'direct',assertions:0,rows:[],failures:[]};
const A={};for(const name of ['equal','deepEqual','ok'])A[name]=(...args)=>{report.assertions++;assert[name](...args);};
function check(name,fn){try{fn();report.rows.push({name,pass:true});}catch(error){report.rows.push({name,pass:false});report.failures.push({name,message:error.message,actual:error.actual,expected:error.expected});}}
const pairs=[
 {vk:13,codes:['Enter','NumpadEnter'],diks:[28,156],scans:[28,28],flags:[0,1]},
 {vk:17,codes:['ControlLeft','ControlRight'],diks:[29,157],scans:[29,29],flags:[0,1]},
 {vk:18,codes:['AltLeft','AltRight'],diks:[56,184],scans:[56,56],flags:[0,1]},
 {vk:16,codes:['ShiftLeft','ShiftRight'],diks:[42,54],scans:[42,54],flags:[0,0]},
];
let producer=host;
if(process.argv.includes('--rpc')){
 const RPC=require('../lib/guest-rpc'),sigs=require('../lib/host-import-sigs.generated.json').sigs;
 const selected={queue_keyboard_input:sigs.queue_keyboard_input};
 const broker=RPC.createMainBroker(memory,host,selected,{});
 producer=RPC.createWorkerImports(memory,selected,m=>broker.serveRpc(m.slot),{slot:2}).imports.host;
}
function reset(){
 for(const p of pairs)renderer.pokeKeyDownState(p.vk,false);
 while(renderer.checkInput()){};
 renderer._physicalKeys=Object.create(null);renderer._asyncKeys=Object.create(null);
}
function configure(p,custom){
 reset();e.unacquire(obj);
 const format=0x24000,objects=0x25000;
 const selected=custom?[[p.diks[0],11],[p.diks[1],7]]:Array.from({length:256},(_,i)=>[i,i]);
 [24,16,2,custom?64:256,selected.length,objects].forEach((v,i)=>wr(e.g2w(format)+i*4,v));
 selected.forEach(([dik,ofs],i)=>[0,ofs,(dik<<8)|12,0].forEach((v,j)=>wr(e.g2w(objects)+i*16+j*4,v)));
 e.setFormat(obj,format);A.equal(rd(e.reg()),0,'production SetDataFormat');
 A.equal(!!rd(e.state()),custom,'production standard/custom format selection');
 e.acquire(obj);A.equal(rd(e.reg()),0);
 return {size:custom?64:256,offsets:custom?[11,7]:p.diks,custom};
}
function state(f){
 const wa=e.g2w(buf);new Uint8Array(memory.buffer,wa-4,f.size+8).fill(0xa5);
 wr(e.reg()+16,0x30000);publishBoundary();e.getState(obj,f.size,buf);
 A.equal(rd(e.reg()),0,'GetDeviceState HRESULT');A.equal(rd(e.reg()+16),0x30010,'GetDeviceState stack cleanup');
 A.equal(rd(wa-4),0xa5a5a5a5);A.equal(rd(wa+f.size),0xa5a5a5a5);
 const bytes=Array.from(new Uint8Array(memory.buffer,wa,f.size));
 return f.custom || f.full ? bytes : f.offsets.map(ofs=>bytes[ofs]);
}
function expected(f,values){if(!f.custom && !f.full)return values;const bytes=Array(f.size).fill(0);f.offsets.forEach((ofs,i)=>bytes[ofs]=values[i]);return bytes;}
function edge(p,side,down,scan){
 if(scan)A.equal(producer.queue_keyboard_input(p.vk,p.scans[side],p.flags[side]|(down?0:2),0,0),1);
 else renderer[down?'handleKeyDown':'handleKeyUp'](p.vk,{code:p.codes[side]});
}
for(const p of pairs)for(const custom of [false,true])for(const scan of [false,true])for(const reverse of [false,true])check(p.codes[0]+' custom='+custom+' scan='+scan+' reverse='+reverse,()=>{
 const f=configure(p,custom);A.deepEqual(state(f),expected(f,[0,0]));
 const first=reverse?1:0,second=1-first;
 edge(p,first,true,scan);A.deepEqual(state(f),expected(f,reverse?[0,128]:[128,0]),'one physical side only');
 edge(p,second,true,scan);A.deepEqual(state(f),expected(f,[128,128]),'both physical sides');
 edge(p,first,false,scan);A.deepEqual(state(f),expected(f,reverse?[128,0]:[0,128]),'release one retains other');
 A.equal(renderer.peekKeyDownState(p.vk),32768,'aggregate physical VK remains held');
 edge(p,second,false,scan);A.deepEqual(state(f),expected(f,[0,0]),'both released');
 // Drain the actual queued WM state snapshots; aggregate VK must remain set
 // through the first release and GetAsyncKeyState must retain its low latch.
 const snapshots=renderer.inputQueue.filter(x=>x.keyStateSnapshot).map(x=>(x.keyStateSnapshot[p.vk>>>5]>>>(p.vk&31))&1);
 if(scan)A.deepEqual(snapshots,[1,1,1,0],'legacy WM aggregate snapshot');
 while(renderer.checkInput()){};
 A.equal(host.get_async_key_state(p.vk),1);A.equal(host.get_async_key_state(p.vk),0);
});
for(const p of pairs)for(const custom of [false,true])check(p.codes[0]+' numeric fallback '+custom,()=>{
 const f=configure(p,custom);renderer.handleKeyDown(p.vk);A.deepEqual(state(f),expected(f,[128,128]),'unknown numeric keeps legacy alias bytes');
 renderer.handleKeyUp(p.vk);A.deepEqual(state(f),expected(f,[0,0]));
});
check('ordinary DIK and raw unmapped numeric byte fallback',()=>{
 const f=configure(pairs[0],false);f.full=true;renderer.handleKeyDown(65);renderer.handleKeyDown(0x59);
 const bytes=Array(256).fill(0);bytes[30]=128;bytes[21]=128;bytes[0x59]=128;A.deepEqual(state(f),bytes);
 renderer.handleKeyUp(65);renderer.handleKeyUp(0x59);
});
for(const p of pairs)check(p.codes[0]+' physical map fault reset',()=>{
 const f=configure(p,true);edge(p,1,true,false);A.deepEqual(state(f),expected(f,[0,128]));
 require('../lib/cli-fault-input').releaseFaultInput({renderer,inputQueue:[],scheduledInput:[],crossThreadMsgs:[]});
 A.deepEqual(state(f),expected(f,[0,0]));edge(p,1,false,false);A.deepEqual(state(f),expected(f,[0,0]));
});
check('immediate reads preserve buffered physical edges',()=>{
 const p=pairs[0],f=configure(p,true);
 edge(p,0,true,false);edge(p,1,true,false);
 const before=poll(1);A.deepEqual(before.records.map(r=>r.slice(0,2)),[[11,128],[7,128]]);
 A.deepEqual(state(f),expected(f,[128,128]));A.deepEqual(poll(1),before);
 edge(p,0,false,false);A.deepEqual(state(f),expected(f,[0,128]));
 A.deepEqual(poll().records.map(r=>r.slice(0,2)),[[11,128],[7,128],[11,0]]);
 edge(p,1,false,false);
});
check('physical immediate state without any buffered subscription',()=>{
 e.unacquire(obj);const property=0x23000;
 [20,16,0,0,0].forEach((v,i)=>wr(e.g2w(property)+i*4,v));
 e.setBufferSize(obj,property);A.equal(rd(e.reg()),0);
 const p=pairs[2],f=configure(p,true);
 edge(p,1,true,true);A.deepEqual(state(f),expected(f,[0,128]));
 edge(p,1,false,true);A.deepEqual(state(f),expected(f,[0,0]));
});
e.unacquire(obj);console.log(JSON.stringify(report));assert.equal(report.failures.length,0,JSON.stringify(report.failures));
`;
console.log(JSON.stringify({oracle:"literal DIKs and custom offsets frozen before original",challengeSHA256:sha(challenge)}));
const child=new Module(fixture,module);child.filename=fixture;child.paths=Module._nodeModulePaths(path.dirname(fixture));child._compile(setup+challenge,fixture);
