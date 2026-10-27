'use strict';
// Extend the unchanged independent oracle's pinned production fixture setup.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),Module=require('module');
const oracle=path.join(__dirname,'test-directinput-independent-modifier-format.js');
const source=fs.readFileSync(oracle,'utf8');
if(crypto.createHash('sha256').update(source).digest('hex')!=='69a3a1c4c958b534b9de71fcbad826eb6559cab9b4c9cb6dac7331650c903661')throw Error('independent oracle identity changed');
const boundary='const challenge = String.raw`';
if(source.split(boundary).length!==2)throw Error('ambiguous independent setup');
// Include the exact production custom immediate-state form; mouse branches remain trap-only.
const prefix=source.slice(0,source.indexOf(boundary)).replace("'$heap_alloc','$heap_free'","'$heap_alloc','$heap_free','$di_custom_device_state'");
const challenge=String.raw`const property=0x23000,format=0x24000,objects=0x25000;
const results=[];
function dispatch(){while(renderer.checkInput()){};publishBoundary();}
function configure(selected,size=3){
 e.unacquire(obj);
 [20,16,0,0,size].forEach((v,i)=>wr(e.g2w(property)+i*4,v));
 e.setBufferSize(obj,property);assert.equal(rd(e.reg()),0);
 [24,16,2,16,selected.length,objects].forEach((v,i)=>wr(e.g2w(format)+i*4,v));
 selected.forEach(([dik,ofs],i)=>[0,ofs,(dik<<8)|12,0].forEach((v,j)=>wr(e.g2w(objects)+i*16+j*4,v)));
 e.setFormat(obj,format);assert.equal(rd(e.reg()),0,'production SetDataFormat accepts selection');
 const installed=rd(e.state());
 selected.forEach(([dik,ofs])=>assert.equal(rd(e.g2w(installed)+dik*4),ofs));
 e.acquire(obj);assert.equal(rd(e.reg()),0);dispatch();assert.equal(poll().count,0);
}
const pairs=r=>r.records.map(x=>x.slice(0,2));
function expect(result,want,hr=0){assert.equal(result.hr,hr);assert.equal(result.count,want.length);assert.deepEqual(pairs(result),want);}
const positive={hr:0,count:2,records:[[7,128,100,1],[7,0,101,2]]};
const oracleControls=[
 ['duplicate amplification',{...positive,count:4,records:[...positive.records,...positive.records]},0],
 ['wrong representative offset',{...positive,records:[[11,128,100,1],[11,0,101,2]]},0],
 ['reordered edges',{...positive,records:[...positive.records].reverse()},0],
 ['suppressed overflow',positive,1],
];
expect(positive,[[7,128],[7,0]]);
for(const [,result,hr] of oracleControls)assert.throws(()=>expect(result,[[7,128],[7,0]],hr),assert.AssertionError);
const aliases=[
 {name:'Shift',vk:16,left:0x2a,right:0x36,codes:['ShiftLeft','ShiftRight']},
 {name:'Ctrl',vk:17,left:0x1d,right:0x9d,codes:['ControlLeft','ControlRight']},
 {name:'Alt',vk:18,left:0x38,right:0xb8,codes:['AltLeft','AltRight']},
 {name:'Return',vk:13,left:0x1c,right:0x9c,codes:['Enter','NumpadEnter']},
];
function edge(a,side,down){renderer[down?'handleKeyDown':'handleKeyUp'](a.vk,{code:a.codes[side],location:side?2:1});}
function tap(a,side){edge(a,side,true);edge(a,side,false);dispatch();}
function space(){renderer.handleKeyDown(32);renderer.handleKeyUp(32);dispatch();}
for(const a of aliases)for(const selection of ['left','right','both','omitted']){
 const selected=[[57,3]];
 // Reverse caller order and offset order: representative is lowest requested DIK.
 if(selection==='right'||selection==='both')selected.push([a.right,7]);
 if(selection==='left'||selection==='both')selected.push([a.left,11]);
 configure(selected);
 const expected=selection==='omitted'?[]:[[selection==='right'?7:11,128],[selection==='right'?7:11,0]];
 // Observe the host registration set directly, including absence of unsupported VKs.
 const buffers=[...renderer._diKeyboardClients].flatMap(ref=>[...(ref.deref()?.values()||[])]);
 assert.equal(buffers.length,1);const buffer=buffers[0];assert.equal(buffer.capacity,2);
 assert.deepEqual([...buffer.selected].sort((x,y)=>x-y),selection==='omitted'?[32]:[a.vk,32].sort((x,y)=>x-y));
 for(const side of [0,1]){
  tap(a,side);assert.equal(buffer.length,expected.length);
  const p=poll(1);expect(p,expected);assert.deepEqual(poll(1),p);
  if(expected.length){expect(poll(0,1),expected.slice(0,1));expect(poll(),expected.slice(1));}
  else expect(poll(),[]);
  expect(poll(),[]);
 }
 // Omitted noise cannot steal capacity; shared aliases must consume just two slots.
 renderer.handleKeyDown(65);renderer.handleKeyUp(65);tap(a,1);
 if(selection==='omitted'){space();expect(poll(),[[3,128],[3,0]]);}
 else expect(poll(),expected);
 // Preserve real bounded overflow instead of silently increasing buffer capacity.
 if(selection!=='omitted'){
  tap(a,0);tap(a,1);const p=poll(1);expect(p,expected,1);assert.deepEqual(poll(1),p);
  expect(poll(),expected,1);expect(poll(),[]);assert.equal(buffer.capacity,2);
  // Cross-key order and record metadata with a larger explicitly requested format.
  configure(selected,5);edge(a,1,true);renderer.handleKeyDown(32);edge(a,1,false);renderer.handleKeyUp(32);dispatch();
  const ordered=poll();const ofs=selection==='right'?7:11;
  expect(ordered,[[ofs,128],[3,128],[ofs,0],[3,0]]);
  assert.deepEqual(ordered.records.map(x=>x[3]-ordered.records[0][3]),[0,1,2,3]);
  // Immediate state retains the existing shared VK semantics, independently of buffered reads.
  edge(a,1,true);dispatch();e.getState(obj,16,buf);assert.equal(rd(e.reg()),0);
  selected.filter(([dik])=>dik!==57).forEach(([,ofs])=>assert.equal(dv.getUint8(e.g2w(buf)+ofs),128));
  edge(a,1,false);dispatch();poll();e.getState(obj,16,buf);
  selected.filter(([dik])=>dik!==57).forEach(([,ofs])=>assert.equal(dv.getUint8(e.g2w(buf)+ofs),0));
 }
 results.push({alias:a.name,selection,registeredVKs:selection==='omitted'?[32]:[a.vk,32],expected,capacity:2,pass:true});
}
// Side owners aggregate before the buffering contract: releasing only one held side
// cannot invent an up event, nor can a second side invent a second down event.
for(const a of aliases.slice(0,3)){
 configure([[a.right,7]]);edge(a,0,true);edge(a,1,true);edge(a,0,false);dispatch();
 expect(poll(),[[7,128]]);edge(a,1,false);dispatch();expect(poll(),[[7,0]]);
}
e.unacquire(obj);
console.log(JSON.stringify({group:'acquired-format shared-VK representative selection',results,overlappingModifierOwners:3,rejectedOracleControls:oracleControls.map(x=>x[0]),
 semantics:'one FIFO record per aggregate VK edge at the lowest requested DIK; no physical-side fidelity in the buffered host contract',
 boundary:'exact pinned production WAT SetDataFormat/Acquire/GetDeviceData and renderer/host; optional in-process production sync RPC, not OS Worker'}));
`;

const footer=`
const child=new Module(fixture,module);child.filename=fixture;child.paths=Module._nodeModulePaths(__dirname);child._compile(setup+challenge,fixture);`;
const child=new Module(__filename,module);child.filename=__filename;child.paths=Module._nodeModulePaths(__dirname);
child._compile(prefix+'const challenge='+JSON.stringify(challenge)+';'+footer,__filename);
