'use strict';
// Use the exact existing production compiler/renderer/host/RPC fixture setup.
// Neither this challenge nor the fixture implements a keyboard FIFO.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Module = require('module');
const fixture = path.join(__dirname, 'test-directinput-buffered-keyboard.js');
const source = fs.readFileSync(fixture, 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
if (sha(source) !== 'ea5c710903a5ef181df4c516b36bd3a66d919ad5127c8e667b91927853a3b98a')
  throw Error('production fixture identity changed');
const marker = 'const events=[];';
if (source.split(marker).length !== 2) throw Error('ambiguous setup boundary');
const setup = source.slice(0, source.indexOf(marker));
const challenge = String.raw`
const checks=[];
function check(name,fn){fn();checks.push(name);}
const property=0x23000,map=0x24000;
const pairs=r=>r.records.map(x=>x.slice(0,2));
function dispatch(){while(renderer.checkInput()){};publishBoundary();}
function edge(vk,down){renderer[down?'handleKeyDown':'handleKeyUp'](vk);}
function tap(vk){edge(vk,true);edge(vk,false);}
function configure(keys,size=3){
 e.unacquire(obj);
 [20,16,0,0,size].forEach((v,i)=>wr(e.g2w(property)+i*4,v));
 e.setBufferSize(obj,property);assert.equal(rd(e.reg()),0);
 for(let i=0;i<256;i++)wr(e.g2w(map)+i*4,0xffffffff);
 for(const [dik,ofs] of keys)wr(e.g2w(map)+dik*4,ofs);
 wr(e.state(),map);e.acquire(obj);assert.equal(rd(e.reg()),0);dispatch();
}
function clean(result,expected){assert.equal(result.hr,0);assert.deepEqual(pairs(result),expected);}
check('omitted keys before, between and after selected edges preserve metadata and peek/consume',()=>{
 configure([[57,7]]);let tick=10;renderer._inputNowMs=()=>tick;
 tap(65);tick=20;edge(32,true);tick=30;tap(66);tick=40;edge(32,false);tick=50;tap(67);dispatch();
 const p=poll(1);clean(p,[[7,128],[7,0]]);
 assert.deepEqual(p.records.map(x=>x[2]),[20,40]);
 assert.equal((p.records[1][3]-p.records[0][3])>>>0,3,'omitted physical transitions keep global sequence gaps');
 assert.deepEqual(poll(1),p);clean(poll(0,1),[[7,128]]);clean(poll(),[[7,0]]);clean(poll(),[]);
 delete renderer._inputNowMs;
});
check('only selected edges cause overflow; omitted edges do not clear it',()=>{
 configure([[57,7]]);tap(32);tap(32);tap(65);dispatch();
 const p=poll(1);assert.equal(p.hr,1);assert.deepEqual(pairs(p),[[7,128],[7,0]]);
 assert.deepEqual(poll(1),p);assert.equal(poll(0,1).hr,1);clean(poll(),[[7,0]]);clean(poll(),[]);
});
check('zero-capacity device ignores omitted edges but overflows for a selected edge',()=>{
 configure([[57,7]],1);tap(65);dispatch();clean(poll(1),[]);
 tap(32);dispatch();assert.equal(poll(1).hr,1);assert.equal(poll(1).count,0);
});
check('empty and unsupported-only formats do not overflow',()=>{
 configure([]);tap(65);tap(32);dispatch();clean(poll(),[]);
 // These DIKs have no strict VK or are skipped duplicate mappings.
 configure([[0x00,1],[0x80,2],[0x36,3],[0x9c,4],[0x9d,5],[0xb8,6]]);
 tap(128);tap(16);tap(13);tap(17);tap(18);dispatch();clean(poll(),[]);
});
check('strict mapping rejects VK-shaped aliases before capacity admission',()=>{
 configure([[0x28,9]]);tap(40);tap(222);dispatch();clean(poll(),[[9,128],[9,0]]);
});
check('different acquired devices filter independently before their own capacities',()=>{
 configure([[57,7]]);
 const other=obj+16,entry=e.entry()+32,otherMap=map+0x1000;
 wr(e.g2w(other)+4,1);wr(entry,7);wr(entry+8,1);wr(entry+12,3);wr(entry+20,256);wr(entry+28,0x100);
 for(let i=0;i<256;i++)wr(e.g2w(otherMap)+i*4,0xffffffff);
 wr(e.g2w(otherMap)+30*4,11);wr(e.state()+32,otherMap);
 e.acquire(other);assert.equal(rd(e.reg()),0);
 tap(65);tap(32);dispatch();clean(poll(),[[7,128],[7,0]]);
 clean(poll(0,16,buf,other),[[11,128],[11,0]]);e.unacquire(other);
});
check('host contexts with identical device ids retain independent filters and reset',()=>{
 configure([[57,7]]);const otherHost=createWindowHost({renderer},{}).imports;
 assert.equal(otherHost.di_keyboard_buffer(e.entry(),8,3),0);
 otherHost.di_keyboard_buffer(e.entry(),9,65);tap(32);tap(65);dispatch();
 clean(poll(),[[7,128],[7,0]]);assert.equal(otherHost.di_keyboard_buffer(e.entry(),7,0),0);
 assert.equal(otherHost.di_keyboard_buffer(e.entry(),2,0),2);
 assert.equal(otherHost.di_keyboard_buffer(e.entry(),3,0),65|256);
 assert.equal(otherHost.di_keyboard_buffer(e.entry(),3,1),65);
 otherHost.di_keyboard_buffer(e.entry(),1,0);tap(65);dispatch();
 assert.equal(otherHost.di_keyboard_buffer(e.entry(),2,0),0);clean(poll(),[]);
});
check('reacquire replaces eligibility and discards stale records and overflow',()=>{
 configure([[57,7]]);tap(32);tap(32);dispatch();assert.equal(poll(1).hr,1);
 configure([[30,11]]);tap(32);tap(65);dispatch();clean(poll(),[[11,128],[11,0]]);
 configure([[57,7]]);tap(65);tap(32);dispatch();clean(poll(),[[7,128],[7,0]]);
});
check('omitted buffered objects still contribute to host physical state',()=>{
 configure([[57,7]]);edge(65,true);edge(32,true);dispatch();
 assert.equal(renderer.peekKeyDownState(65),0x8000);
 assert.equal(imports.host.get_key_down_state(65),0x8000);
 clean(poll(),[[7,128]]);edge(65,false);edge(32,false);dispatch();clean(poll(),[[7,0]]);
});
e.unacquire(obj);
console.log(JSON.stringify({pass:checks.length,checks,mode:process.argv.includes('--rpc')?'production GuestRpc synchronous broker in-process':'direct production host',noGameplayClaim:true}));
`;
console.log(JSON.stringify({fixtureSHA256:sha(source),setupSHA256:sha(setup),challengeSHA256:sha(challenge),
  transformation:'exact fixture prefix before const events=[]; + format admission challenge'}));
const child = new Module(fixture, module);
child.filename = fixture;
child.paths = Module._nodeModulePaths(__dirname);
child._compile(setup + challenge, fixture);
