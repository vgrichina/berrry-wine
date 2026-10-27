'use strict';
require('./helpers/directinput-independent-accept-oct27') (String.raw`
const property=0x23000,format=0x24000,objects=0x25000;
const checks=[];
function check(name,fn){fn();checks.push(name);console.log(JSON.stringify({group:name,pass:true}));}
function dispatch(){while(renderer.checkInput()){};publishBoundary();}
function tap(vk){renderer.handleKeyDown(vk);renderer.handleKeyUp(vk);dispatch();}
function setFormat(items,device=obj,size=16){
 [24,16,2,size,items.length,items.length?objects:0].forEach((v,i)=>wr(e.g2w(format)+i*4,v));
 items.forEach(([dik,ofs],i)=>[0,ofs,(dik<<8)|12,0].forEach((v,j)=>wr(e.g2w(objects)+i*16+j*4,v)));
 e.setFormat(device,format);return rd(e.reg());
}
function size(n,device=obj){[20,16,0,0,n].forEach((v,i)=>wr(e.g2w(property)+i*4,v));e.setBufferSize(device,property);assert.equal(rd(e.reg()),0);}
function acquire(device=obj){e.acquire(device);assert.equal(rd(e.reg()),0);}
function reset(items,n=9){e.unacquire(obj);size(n);assert.equal(setFormat(items),0);acquire();}
const pairs=r=>r.records.map(x=>x.slice(0,2));
check('selected-only overflow retains prefix and sticky peek; omitted saturation irrelevant',()=>{
 reset([[57,7]],3);tap(65);tap(32);renderer.handleKeyDown(32);dispatch();
 const a=poll(1);assert.equal(a.hr,1);assert.deepEqual(pairs(a),[[7,128],[7,0]]);
 assert.equal(poll(1).hr,1);assert.equal(poll().hr,1);assert.equal(poll().hr,0);
 renderer.handleKeyUp(32);dispatch();assert.deepEqual(pairs(poll()),[[7,0]]);
});
check('disjoint acquired formats isolate omission, overflow and consumption',()=>{
 reset([[57,7]],3);
 const other=obj+16,entry=e.entry()+32;wr(e.g2w(other)+4,1);
 wr(entry,7);wr(entry+8,1);wr(entry+12,3);wr(entry+20,16);wr(entry+28,0x100);
 assert.equal(setFormat([[30,3]],other),0);acquire(other);
 tap(65);tap(65);tap(32);
 const a=poll(),b=poll(0,16,buf,other);
 assert.equal(a.hr,0);assert.deepEqual(pairs(a),[[7,128],[7,0]]);
 assert.equal(b.hr,1);assert.deepEqual(pairs(b),[[3,128],[3,0]]);
 e.unacquire(other);tap(32);assert.equal(poll().count,2);
});
check('disjoint filtered host contexts preserve independent queues with same device ID',()=>{
 reset([[57,7]],3);const h=createWindowHost({renderer},{}).imports;
 assert.equal(h.di_keyboard_buffer(e.entry(),8,3),0);h.di_keyboard_buffer(e.entry(),9,65);
 tap(65);assert.equal(h.di_keyboard_buffer(e.entry(),2,0),0);
 assert.equal(h.di_keyboard_buffer(e.entry(),10,0),0);
 tap(65);tap(32);assert.deepEqual(pairs(poll()),[[7,128],[7,0]]);
 assert.equal(h.di_keyboard_buffer(e.entry(),2,0),2);assert.equal(h.di_keyboard_buffer(e.entry(),7,0),0);
 assert.equal(h.di_keyboard_buffer(e.entry(),3,0),65|256);h.di_keyboard_buffer(e.entry(),1,0);
});
check('unacquire/reacquire replaces filter and discards stale queue and overflow',()=>{
 reset([[57,7]],3);tap(32);tap(32);e.unacquire(obj);tap(32);
 assert.equal(setFormat([[30,3]]),0);acquire();tap(32);tap(65);
 const r=poll();assert.equal(r.hr,0);assert.deepEqual(pairs(r),[[3,128],[3,0]]);
});
check('acquired map immutable to caller descriptors and refused replacement; state remains live',()=>{
 reset([[57,7]],9);const map=rd(e.state());
 assert.equal(setFormat([[30,3]]),0x800700aa);assert.equal(rd(e.state()),map);
 renderer.handleKeyDown(32);dispatch();e.getState(obj,16,buf);
 assert.equal(rd(e.reg()),0);assert.equal(dv.getUint8(e.g2w(buf)+7),128);
 renderer.handleKeyUp(32);dispatch();assert.deepEqual(pairs(poll()),[[7,128],[7,0]]);
});
check('empty and zero-size accepted formats admit no events or false overflow',()=>{
 for(const length of [0,16]){e.unacquire(obj);size(3);assert.equal(setFormat([],obj,length),0);acquire();
 tap(32);tap(65);tap(16);const r=poll();assert.equal(r.hr,0);assert.equal(r.count,0);}
});
check('null and malformed descriptors fail transactionally preserving installed map',()=>{
 reset([[57,7]],9);e.unacquire(obj);const map=rd(e.state());
 e.setFormat(obj,0);assert.equal(rd(e.reg()),0x80070057);assert.equal(rd(e.state()),map);
 for(const [index,value] of [[0,23],[1,15],[3,3],[4,257],[5,0]]){
  [24,16,2,16,1,objects].forEach((v,i)=>wr(e.g2w(format)+i*4,v));
  [0,7,(57<<8)|12,0].forEach((v,i)=>wr(e.g2w(objects)+i*4,v));wr(e.g2w(format)+index*4,value);
  e.setFormat(obj,format);assert.equal(rd(e.reg()),0x80070057);assert.equal(rd(e.state()),map);
 }
 acquire();tap(32);assert.deepEqual(pairs(poll()),[[7,128],[7,0]]);
});
e.unacquire(obj);console.log(JSON.stringify({pass:true,checks,mode:process.argv.includes('--rpc')?'in-process synchronous RPC':'direct'}));
`);
