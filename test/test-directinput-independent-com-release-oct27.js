'use strict';
// Production COM Release and dx_free, including actual keyboard teardown.
// Synthetic object creation/reuse; private fixture allocator/no-op heap free.
require('./helpers/directinput-independent-release-oct27')(String.raw`
const property=0x23000,format=0x24000,objects=0x25000;
const pairs=r=>r.records.map(x=>x.slice(0,2));
function tap(vk){renderer.handleKeyDown(vk);renderer.handleKeyUp(vk);while(renderer.checkInput()){};publishBoundary();}
function setup(device,slot,dik,ofs){
 const entry=e.entry()+slot*32;
 wr(e.g2w(device)+4,slot);wr(entry,7);wr(entry+4,1);wr(entry+8,1);wr(entry+12,0);wr(entry+20,256);wr(entry+28,0);
 [20,16,0,0,3].forEach((v,i)=>wr(e.g2w(property)+i*4,v));e.setBufferSize(device,property);assert.equal(rd(e.reg()),0);
 [24,16,2,16,1,objects].forEach((v,i)=>wr(e.g2w(format)+i*4,v));
 [0,ofs,(dik<<8)|12,0].forEach((v,i)=>wr(e.g2w(objects)+i*4,v));
 e.setFormat(device,format);assert.equal(rd(e.reg()),0);e.acquire(device);assert.equal(rd(e.reg()),0);
 return entry;
}
e.unacquire(obj);
const a=setup(obj,0,57,7), other=obj+16,b=setup(other,1,30,3);
wr(a+4,2);tap(32);tap(32);tap(65);
e.release(obj);assert.equal(rd(e.reg()),1);assert.equal(rd(a),7);assert.equal(rd(a+4),1);
assert.equal(poll(1).hr,1,'nonfinal Release preserves queued overflow');
e.release(obj);assert.equal(rd(e.reg()),0);assert.equal(rd(a),0);assert.equal(rd(e.state()),0,'final Release drops installed format map');
assert.equal(host.di_keyboard_buffer(a,2,0),0);assert.equal(host.di_keyboard_buffer(a,7,0),0);
assert.deepEqual(pairs(poll(0,16,buf,other)),[[3,128],[3,0]],'release cannot reset disjoint device');
tap(32);assert.equal(host.di_keyboard_buffer(a,2,0),0,'released host FIFO stays absent');
setup(obj,0,28,11);tap(32);tap(13);
const reused=poll();assert.equal(reused.hr,0);assert.deepEqual(pairs(reused),[[11,128],[11,0]],'same synthetic slot has only new selection/cursor/overflow');
e.release(obj);e.release(other);
assert.equal(rd(a),0);assert.equal(rd(b),0);assert.equal(host.di_keyboard_buffer(a,2,0),0);assert.equal(host.di_keyboard_buffer(b,2,0),0);
console.log(JSON.stringify({group:'actual COM Release with nonfinal/final refs, pending overflow, disjoint device and synthetic slot reuse',reused,pass:true,
 limitations:['fragment only','synthetic COM wrapper/create/reuse','fixture heap_free is no-op; production map drop and host reset tested']}));
`);
