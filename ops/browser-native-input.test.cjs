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
