'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {installInputHandlers} = require('../lib/renderer-input');
class Device { constructor() { this.inputQueue=[]; this.windows={}; this.wasm=null; this.mainWasm=null; } }
installInputHandlers(Device);
const families=[[16,'Shift',160,161],[17,'Control',162,163],[18,'Alt',164,165]];
const H=0x8000;
const drain=d=>{for(let i=0;i<64;i++)if(!d.takeInput())return;throw Error('undrained queue');};
const values=(d,method,keys)=>keys.map(k=>d[method](k));
for(const [aggregate,name,left,right] of families) for(const start of [0,1]) {
 const keys=[aggregate,left,right], sides=[left,right], codes=[name+'Left',name+'Right'];
 const press=(d,s,extra={})=>d.handleKeyDown(aggregate,{code:codes[s],...extra});
 const release=(d,s)=>d.handleKeyUp(aggregate,{code:codes[s]});
 test(`${name}/${start}: every overlapping release/repress pair preserves owner and per-query latch`,()=>{
  // Both release orders, both query orders, and repeated cycles use a separate external oracle.
  for(const released of [0,1]) for(const queryOrder of [[aggregate,left,right],[right,left,aggregate]]) {
   const d=new Device(), owners=new Set(), pending=new Set();
   const step=(s,down)=>{
    const was=owners.has(s);
    if(down){owners.add(s);if(!was)pending.add(sides[s]);pending.add(aggregate);press(d,s);}
    else{owners.delete(s);release(d,s);}
    drain(d);
    const high=k=>k===aggregate?(owners.size?H:0):(owners.has(sides.indexOf(k))?H:0);
    assert.deepEqual(values(d,'peekKeyDownState',keys),keys.map(high));
    assert.deepEqual(values(d,'peekAsyncKeyState',keys),keys.map(high));
    for(const k of queryOrder){assert.equal(d.getAsyncKeyState(k),high(k)|(pending.has(k)?1:0));pending.delete(k);assert.equal(d.getAsyncKeyState(k),high(k));}
   };
   step(start,true);step(1-start,true);step(start,true);
   for(let n=0;n<3;n++){step(released,false);step(released,true);step(1-released,true);}
   step(released,false);step(1-released,false);
  }
 });
 test(`${name}/${start}: buffered overlap release/repress consumes each latch once without dispatch rearming`,()=>{
  const d=new Device();
  press(d,start);press(d,1-start);release(d,start);press(d,start);release(d,1-start);release(d,start);
  assert.deepEqual(values(d,'peekKeyDownState',keys),[0,0,0]);
  // All physical presses have arrived; low bits belong independently to each VK.
  // Legacy aggregate dispatch rearms its low bit; side dispatch must not.
  for(const k of [sides[start],aggregate,sides[1-start]]){assert.equal(d.getAsyncKeyState(k)&1,1);assert.equal(d.getAsyncKeyState(k)&1,0);}
  const states=[];let mask=0;
  for(const [s,down] of [[start,true],[1-start,true],[start,false],[start,true],[1-start,false],[start,false]]) {
   mask=down?(mask|(1<<s)):(mask&~(1<<s));
   states.push([mask?H:0,mask&1?H:0,mask&2?H:0]);
  }
  for(const expected of states){assert.ok(d.takeInput());assert.deepEqual(values(d,'peekAsyncKeyState',keys),expected);const legacyAggregate=[...expected]; if(expected===states[0] || expected===states[1] || expected===states[3])legacyAggregate[0]|=1; assert.deepEqual(values(d,'getAsyncKeyState',keys),legacyAggregate);assert.deepEqual(values(d,'getAsyncKeyState',keys),expected);assert.deepEqual(values(d,'peekKeyDownState',keys),[0,0,0]);}
  assert.equal(d.takeInput(),null);
 });
 test(`${name}/${start}: numeric reset during overlap leaves pending press bits consumable then admits a fresh side`,()=>{
  const d=new Device();press(d,start);press(d,1-start);d.handleKeyUp(aggregate);
  assert.deepEqual(values(d,'peekKeyDownState',keys),[0,0,0]);drain(d);
  assert.deepEqual(values(d,'peekAsyncKeyState',keys),[0,0,0]);
  assert.deepEqual(values(d,'getAsyncKeyState',keys),[1,1,1]);
  assert.deepEqual(values(d,'getAsyncKeyState',keys),[0,0,0]);
  press(d,start,{location:start===0?2:1});drain(d);
  const expected=[H,start===0?H:0,start===1?H:0];
  assert.deepEqual(values(d,'peekKeyDownState',keys),expected);
  release(d,1-start);drain(d);assert.deepEqual(values(d,'peekAsyncKeyState',keys),expected);
  assert.equal(d.getAsyncKeyState(sides[1-start]),0);
  assert.equal(d.getAsyncKeyState(sides[start]),H|1);assert.equal(d.getAsyncKeyState(aggregate),H|1);
  release(d,start);drain(d);assert.deepEqual(values(d,'getAsyncKeyState',keys),[0,0,0]);
 });
 test(`${name}/${start}: direct physical reset and async override remain separate across both owners`,()=>{
  const d=new Device();press(d,start);press(d,1-start);drain(d);
  values(d,'getAsyncKeyState',keys);
  d.pokeAsyncKeyState(sides[start],false);
  assert.deepEqual(values(d,'peekKeyDownState',keys),[H,H,H]);
  assert.equal(d.getAsyncKeyState(sides[start]),0);assert.equal(d.getAsyncKeyState(sides[1-start]),H);
  d.pokeKeyDownState(aggregate,false);
  assert.deepEqual(values(d,'peekKeyDownState',keys),[0,0,0]);
  // Reset is physical only; public key-up also advances the async timeline.
  d.handleKeyUp(aggregate);drain(d);assert.deepEqual(values(d,'getAsyncKeyState',keys),[0,0,0]);
  press(d,1-start);drain(d);assert.equal(d.getAsyncKeyState(sides[1-start]),H|1);
  assert.equal(d.getAsyncKeyState(sides[start]),0);release(d,1-start);drain(d);
 });
}
test('three overlapping modifier families retain independent physical owners, snapshots and query consumption',()=>{
 const d=new Device();
 for(const [vk,name] of families){d.handleKeyDown(vk,{code:name+'Left'});d.handleKeyDown(vk,{code:name+'Right'});}
 drain(d);
 for(const [vk,name,left,right] of families){
  d.handleKeyUp(vk,{code:name+'Left'});drain(d);
  assert.deepEqual(values(d,'peekKeyDownState',[vk,left,right]),[H,0,H]);
  assert.equal(d.getAsyncKeyState(left),1);assert.equal(d.getAsyncKeyState(left),0);
 }
 for(const [vk,name,left,right] of families){
  assert.equal(d.getAsyncKeyState(right),H|1);assert.equal(d.getAsyncKeyState(vk),H|1);
  d.handleKeyUp(vk,{code:name+'Right'});drain(d);
  assert.deepEqual(values(d,'getAsyncKeyState',[vk,left,right]),[0,0,0]);
 }
});
