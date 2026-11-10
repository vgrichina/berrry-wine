'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const input=require('./browser-native-input.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('required Nox vocabulary and CDP descriptors are exact',()=>{
  assert.deepEqual(input.assertRequired(['KeyI','Home','Space']),[
    {key:'i',code:'KeyI',windowsVirtualKeyCode:73},
    {key:'Home',code:'Home',windowsVirtualKeyCode:36},
    {key:' ',code:'Space',windowsVirtualKeyCode:32}]);
  assert.throws(()=>input.assertRequired(['KeyZ']));
});
test('slow diagnostic and persistence do not postpone either release path',async()=>{
  for(const button of [null,'left','right']) {
    const events=[];let sampleFinished=false;
    const options={send:async(method,p)=>events.push({method,...p,at:Date.now(),sampleFinished}),session:'test',holdMs:50,
      sample:async()=>{await wait(180);sampleFinished=true;return {};},saveSample:async()=>wait(10)};
    const receipt=button?await input.mouse({...options,button,x:10,y:20}):await input.hold({...options,keys:['KeyI']});
    assert.equal(events.length,2);assert.equal(events[1].sampleFinished,false);
    assert(receipt.samples.every(s=>!s.whollyDuringHold));
  }
});
test('partial down delivery releases all attempted keys in reverse order',async()=>{
  const events=[];
  await assert.rejects(()=>input.hold({keys:['ArrowUp','ArrowLeft'],holdMs:100,send:async(m,p)=>{events.push(p);if(events.length===2)throw Error('partial');}}),/partial/);
  assert.deepEqual(events.map(e=>[e.type,e.code]),[['keyDown','ArrowUp'],['keyDown','ArrowLeft'],['keyUp','ArrowLeft'],['keyUp','ArrowUp']]);
});
const state=pressed=>Array.from({length:16},(_,i)=>i===12&&pressed?128:0);
const reading=(requestAt,at,pressed=false,eax=0)=>({requestAt,at,eax,state:state(pressed)});
const pulse={downAttemptedAt:100,upAttemptedAt:200,down:{ack:true,at:230},up:{ack:true,at:240}};
const edges=(a,z)=>[{type:'mousedown',button:0,trusted:true,at:a},{type:'mouseup',button:0,trusted:true,at:z}];
test('late DOWN ACK does not invert the trusted guest observation interval',()=>{
 const v=input.correlateMousePulse({pulse,events:edges(210,225),records:[reading(212,214,true),reading(226,227)]});
 assert(v.ackIntervalInverted);assert(v.actualPress);assert(v.actualRelease);
 assert.equal(v.trustedHoldMs,15);assert.equal(v.pressed[0].at,214);
});
test('ACKs and overlapping or failed reads cannot prove guest consumption',()=>{
 const v=input.correlateMousePulse({pulse,events:edges(210,225),records:[reading(90,95),reading(209,214,true),reading(215,216,true,1),reading(226,227)]});
 assert(!v.actualPress);assert.equal(v.allPressed.length,1);assert(v.actualRelease);
 assert.throws(()=>input.correlateMousePulse({pulse,events:[],records:[]}),/one observed/);
 assert.throws(()=>input.correlateMousePulse({pulse,events:edges(210,225).map(e=>({...e,trusted:false})),records:[]}),/trusted/);
 assert.throws(()=>input.correlateMousePulse({pulse:{...pulse,down:{unknown:true}},events:edges(210,225),records:[]}),/acknowledgements/);
});
test('historical 16ms pulse between guest polls remains a measured miss',()=>{
 const p={downAttemptedAt:1794311285764,upAttemptedAt:1794311285865,down:{ack:true,at:1794311285883},up:{ack:true,at:1794311285884}};
 const v=input.correlateMousePulse({pulse:p,events:edges(1794311285866,1794311285882),records:[reading(1794311285745,1794311285749),reading(1794311285905,1794311285906)]});
 assert.equal(v.trustedHoldMs,16);assert.equal(v.downDeliveryDelayMs,102);assert(v.ackIntervalInverted);
 assert(!v.actualPress);assert.equal(v.readsWhollyDuringTrustedHold.length,0);
});
