'use strict';
// Reuse the existing compiled production fixture, with explicit fixture allocation.
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

// Literal pair/offset/time/sequence oracles reused from the frozen validation.
const challenge=String.raw`
// Both buffer RPC and keyboard injection use the production synchronous broker.
// This is in-process transport coverage, not a real Worker/browser/game run.
let producer=host;
if(process.argv.includes('--rpc')){
 const RPC=require('../lib/guest-rpc'),sigs=require('../lib/host-import-sigs.generated.json').sigs;
 const selected={queue_keyboard_input:sigs.queue_keyboard_input};
 const broker=RPC.createMainBroker(memory,host,selected,{});
 producer=RPC.createWorkerImports(memory,selected,message=>broker.serveRpc(message.slot),{slot:2}).imports.host;
}

{
// Frozen independent contract: literal Windows DIK pairs and deliberately
// reversed custom offsets. Never derives expected values from production maps.
const report={mode:process.argv.includes('--rpc')?'RPC':'direct',rows:[],failures:[],assertions:0};
const A={};for(const k of ['equal','deepEqual','ok'])A[k]=(...args)=>{report.assertions++;return assert[k](...args);};
function check(name,fn){try{const detail=fn();report.rows.push({name,pass:true,detail});}catch(error){report.rows.push({name,pass:false});report.failures.push({name,message:error.message,actual:error.actual,expected:error.expected,stack:error.stack});}}
let tick=100;renderer._inputNowMs=()=>tick;
const property=0x23000,map=0x24000;
function configure(selected,size=16){
 e.unacquire(obj);A.equal(rd(e.reg()),0);
 [20,16,0,0,size].forEach((v,i)=>wr(e.g2w(property)+i*4,v));e.setBufferSize(obj,property);A.equal(rd(e.reg()),0);
 const format=0x24000,objects=0x25000;
 [24,16,2,64,selected.length,objects].forEach((v,i)=>wr(e.g2w(format)+i*4,v));
 selected.forEach(([dik,ofs],i)=>[0,ofs,(dik<<8)|12,0].forEach((v,j)=>wr(e.g2w(objects)+i*16+j*4,v)));
 e.setFormat(obj,format);A.equal(rd(e.reg()),0,'production SetDataFormat accepts format');
 const installed=rd(e.state());A.ok(installed);for(const [dik,ofs]of selected)A.equal(rd(e.g2w(installed)+dik*4),ofs);
 // Mutating caller memory must not change the accepted format/filter.
 if(selected.length)wr(e.g2w(objects)+4,63);
 renderer._diKeyboardSequence=0;e.acquire(obj);A.equal(rd(e.reg()),0);A.equal(poll().count,0);
}
function edge(vk,code,down,time){tick=time;renderer[down?'handleKeyDown':'handleKeyUp'](vk,{code,location:code==='NumpadEnter'?3:code.endsWith('Right')?2:code==='Enter'?0:1});}
function expect(expected,hr=0){
 const p=poll(1);A.equal(p.hr,hr);A.equal(p.count,expected.length);A.deepEqual(p.records,expected);
 A.equal(rd(e.reg()+16),0x30018,'compiled GetDeviceData stack cleanup');
 A.deepEqual(poll(1),p,'second PEEK is identical');
 if(expected.length){const partial=poll(0,1);A.equal(partial.hr,hr);A.deepEqual(partial.records,expected.slice(0,1));const remaining=poll();A.equal(remaining.hr,0);A.deepEqual(remaining.records,expected.slice(1));}
 else A.deepEqual(poll().records,[]);
 A.equal(poll().count,0);return p;
}
const vectors=[
 {name:'Enter',vk:13,codes:['Enter','NumpadEnter'],diks:[28,156]},
 {name:'Ctrl',vk:17,codes:['ControlLeft','ControlRight'],diks:[29,157]},
 {name:'Alt',vk:18,codes:['AltLeft','AltRight'],diks:[56,184]},
 {name:'Shift',vk:16,codes:['ShiftLeft','ShiftRight'],diks:[42,54]},
];
// This first behavior case must fail on the original native producer/consumer.
for(const v of vectors)check(v.name+' physical overlap, literal offsets/time/sequence',()=>{
 configure([[v.diks[1],7],[v.diks[0],11]]);
 edge(v.vk,v.codes[0],true,101);edge(v.vk,v.codes[1],true,109);edge(v.vk,v.codes[0],false,121);edge(v.vk,v.codes[1],false,130);
 return expect([[11,128,101,1],[7,128,109,2],[11,0,121,3],[7,0,130,4]]);
});
for(const v of vectors)for(const side of [0,1])check(v.name+' exact '+side+' prefilters omitted side before two-slot capacity',()=>{
 configure([[v.diks[side],7]],3);
 const omit=1-side;edge(v.vk,v.codes[omit],true,201);edge(v.vk,v.codes[omit],false,202);
 edge(v.vk,v.codes[side],true,211);edge(v.vk,v.codes[side],false,212);
 return expect([[7,128,211,3],[7,0,212,4]]);
});
for(const v of vectors)check(v.name+' numeric fallback lowest selected DIK',()=>{
 configure([[v.diks[1],7],[v.diks[0],11]]);
 tick=301;renderer.handleKeyDown(v.vk);tick=305;renderer.handleKeyUp(v.vk);
 return expect([[11,128,301,1],[11,0,305,2]]);
});
check('legacy op0 and op8 clients keep untagged aggregate semantics',()=>{
 configure([[28,11],[156,7]]);
 const clients=new Map();A.equal(renderer.directInputKeyboardBuffer(clients,91,0,8),0);
 A.equal(renderer.directInputKeyboardBuffer(clients,92,8,8),0);
 renderer.directInputKeyboardBuffer(clients,92,9,13);renderer.directInputKeyboardBuffer(clients,92,10,0);
 edge(13,'Enter',true,401);edge(13,'NumpadEnter',true,402);edge(13,'Enter',false,403);edge(13,'NumpadEnter',false,404);
 for(const id of [91,92]){A.equal(renderer.directInputKeyboardBuffer(clients,id,2,0),2);A.deepEqual([0,1].map(i=>[3,4,5].map(op=>renderer.directInputKeyboardBuffer(clients,id,op,i))),[[269,401,1],[13,404,4]]);renderer.directInputKeyboardBuffer(clients,id,1,0);}
});
check('compiled reacquire discards stale input and registers replacement format',()=>{
 configure([[28,11],[156,7]]);edge(13,'Enter',true,501);edge(13,'Enter',false,502);A.equal(poll(1).count,2);
 configure([[156,5]],3);edge(13,'Enter',true,511);edge(13,'Enter',false,512);edge(13,'NumpadEnter',true,521);edge(13,'NumpadEnter',false,522);
 return expect([[5,128,521,3],[5,0,522,4]]);
});
check('actual host scan producer crosses compiled tagged consumer',()=>{
 configure([[28,11],[156,7],[29,13],[157,3],[42,17],[54,19],[56,23],[184,29]],16);
 // Same production host import called by native clients; no copied scan mapping.
 tick=601;producer.queue_keyboard_input(13,28,0,0);tick=602;producer.queue_keyboard_input(13,28,1,0);tick=603;producer.queue_keyboard_input(13,28,2,0);tick=604;producer.queue_keyboard_input(13,28,3,0);
 return expect([[11,128,601,1],[7,128,602,2],[11,0,603,3],[7,0,604,4]]);
});
check('fault reset clears FIFO and ownership without synthetic edges',()=>{
 configure([[29,11],[157,7]]);edge(17,'ControlRight',true,701);
 const result=require('../lib/cli-fault-input.js').releaseFaultInput({renderer,inputQueue:[],scheduledInput:[],crossThreadMsgs:[]});A.equal(result.pendingInput,0);A.equal(poll().count,0);
 edge(17,'ControlRight',false,702);A.equal(poll().count,0);
 edge(17,'ControlRight',true,711);edge(17,'ControlRight',false,712);
 return expect([[7,128,711,2],[7,0,712,3]]);
});
check('native writes exact record width with adjacent memory guards',()=>{
 configure([[156,7]],3);edge(13,'NumpadEnter',true,801);edge(13,'NumpadEnter',false,802);
 for(const a of [e.g2w(buf)-4,e.g2w(buf)+32])wr(a,0xdecafbad);
 const p=poll(1);A.deepEqual(p.records,[[7,128,801,1],[7,0,802,2]]);A.equal(rd(e.g2w(buf)-4),0xdecafbad);A.equal(rd(e.g2w(buf)+32),0xdecafbad);poll();
});
e.unacquire(obj);
console.log(JSON.stringify(report));assert.equal(report.failures.length,0,JSON.stringify(report.failures));

}
{
const property=0x23000;
// Additional frozen concern: ordinary numeric legacy clients must retain
// identical keys/time/sequence on both original and candidate. Separate from
// the intentional physical sequence differences in the primary oracle.
const results={mode:process.argv.includes('--rpc')?'RPC':'direct',rows:[],failures:[],assertions:0};
const T={};for(const k of ['equal','deepEqual','ok'])T[k]=(...args)=>{results.assertions++;assert[k](...args);};
function check(name,f){try{results.rows.push({name,pass:true,detail:f()});}catch(error){results.rows.push({name,pass:false});results.failures.push({name,message:error.message,actual:error.actual,expected:error.expected,stack:error.stack});}}
let tick=900;renderer._inputNowMs=()=>tick;
function configure(selected,size=16){
 e.unacquire(obj);
 [20,16,0,0,size].forEach((v,i)=>wr(e.g2w(property)+i*4,v));e.setBufferSize(obj,property);T.equal(rd(e.reg()),0);
 const format=0x24000,objects=0x25000;
 [24,16,2,64,selected.length,objects].forEach((v,i)=>wr(e.g2w(format)+i*4,v));
 selected.forEach(([dik,ofs],i)=>[0,ofs,(dik<<8)|12,0].forEach((v,j)=>wr(e.g2w(objects)+i*16+j*4,v)));
 e.setFormat(obj,format);T.equal(rd(e.reg()),0,'production SetDataFormat accepts format');
 const installed=rd(e.state());T.ok(installed);for(const [dik,ofs]of selected)T.equal(rd(e.g2w(installed)+dik*4),ofs);
 // Mutating caller memory must not change the accepted format/filter.
 if(selected.length)wr(e.g2w(objects)+4,63);
 renderer._diKeyboardSequence=0;e.acquire(obj);T.equal(rd(e.reg()),0);T.equal(poll().count,0);
}
check('ordinary numeric legacy op0/op8 byte-identical metadata alongside compiled consumer',()=>{
 configure([[30,7]],3);const clients=new Map();renderer.directInputKeyboardBuffer(clients,91,0,3);renderer.directInputKeyboardBuffer(clients,92,8,3);renderer.directInputKeyboardBuffer(clients,92,9,65);renderer.directInputKeyboardBuffer(clients,92,10,0);
 tick=901;renderer.handleKeyDown(65);tick=905;renderer.handleKeyUp(65);
 for(const id of [91,92]){T.equal(renderer.directInputKeyboardBuffer(clients,id,2,0),2);T.deepEqual([0,1].map(i=>[3,4,5].map(op=>renderer.directInputKeyboardBuffer(clients,id,op,i))),[[321,901,1],[65,905,2]]);renderer.directInputKeyboardBuffer(clients,id,1,0);}
 const p=poll(1);T.deepEqual(p,{hr:0,count:2,records:[[7,128,901,1],[7,0,905,2]]});T.deepEqual(poll(),p);return p;
});
const vectors=[{name:'Ctrl',vk:17,scans:[29,29],flags:[0,1,2,3],diks:[29,157]},{name:'Alt',vk:18,scans:[56,56],flags:[0,1,2,3],diks:[56,184]},{name:'Shift',vk:16,scans:[42,54],flags:[0,0,2,2],diks:[42,54]}];
for(const v of vectors)check(v.name+' actual scan host to compiled consumer',()=>{
 configure([[v.diks[0],11],[v.diks[1],7]]);
 tick=911;producer.queue_keyboard_input(v.vk,v.scans[0],v.flags[0],0,0);tick=912;producer.queue_keyboard_input(v.vk,v.scans[1],v.flags[1],0,0);tick=913;producer.queue_keyboard_input(v.vk,v.scans[0],v.flags[2],0,0);tick=914;producer.queue_keyboard_input(v.vk,v.scans[1],v.flags[3],0,0);
 const p=poll(1);T.deepEqual(p,{hr:0,count:4,records:[[11,128,911,1],[7,128,912,2],[11,0,913,3],[7,0,914,4]]});T.deepEqual(poll(),p);return p;
});
check('native overflow remains sticky on PEEK and clears on consume',()=>{
 configure([[28,11],[156,7]],3);tick=921;renderer.handleKeyDown(13,{code:'Enter'});tick=922;renderer.handleKeyDown(13,{code:'NumpadEnter'});tick=923;renderer.handleKeyUp(13,{code:'Enter'});tick=924;renderer.handleKeyUp(13,{code:'NumpadEnter'});
 const p=poll(1);T.deepEqual(p,{hr:1,count:2,records:[[11,128,921,1],[7,128,922,2]]});T.deepEqual(poll(1),p);T.deepEqual(poll(),p);T.deepEqual(poll(),{hr:0,count:0,records:[]});return p;
});
e.unacquire(obj);console.log(JSON.stringify(results));assert.equal(results.failures.length,0,JSON.stringify(results.failures));

}
`;

console.log(JSON.stringify({fixtureSHA256:sha(source),setupSHA256:sha(setup),challengeSHA256:sha(challenge),boundary:'production SetDataFormat/Acquire/GetDeviceData + renderer/host + optional production in-process synchronous RPC; fixture object/memory/allocator; no full application or Windows claim'}));
const child=new Module(fixture,module);child.filename=fixture;child.paths=Module._nodeModulePaths(__dirname);child._compile(setup+challenge,fixture);
