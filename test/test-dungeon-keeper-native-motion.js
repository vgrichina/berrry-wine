'use strict';
const assert = require('node:assert/strict');
const {motion, validate} = require('../tools/dungeon-keeper-native-motion.cjs');
async function main() {
  for (const [steps, interval] of [[[],40], [[[9,0]],40], [[[0,0]],40], [[[1.5,0]],40], [[[1,0]],19], [Array(32).fill([1,0]),100]])
    assert.throws(() => validate(steps, interval));
  const identity = {processId:1000}, review = {sha256:'reviewed'};
  let closed = false, failAt = 0, effects = [], reads = 0, locked = true, automatic = true, relative = false;
  const pointer = {x:150,y:150};
  const chain = {
    async admit(r, fn) {
      assert(!closed); assert.equal(r, review);
      try { return await fn({live:{identity}}); } catch (e) { closed = true; throw e; }
    },
    async progress(id) { assert.equal(id, identity); }
  };
  const options = {chain, review, pointer, steps:[[2,0],[2,0]], intervalMs:40,
    deadline:Date.now()+10000, pageSession:'page', wait:async()=>{},
    evaluate:async()=>({locked:++reads === failAt ? !locked : locked, automatic, relative, processId:1000, buttons:0,
      rect:{left:0,top:0,width:500,height:500},x:pointer.x,y:pointer.y}),
    send:async(method, params, session)=>{
      assert.equal(method,'Input.dispatchMouseEvent'); assert.equal(session,'page');
      effects.push(params); Object.assign(pointer,{x:params.x,y:params.y});
    }};
  await motion(options); await motion(options);
  assert.deepEqual(effects.map(e=>e.x),[152,154,156,158], 'successive commands retain physical position despite frozen DOM coordinates');
  assert(effects.every(e=>e.type==='mouseMoved'&&e.buttons===0));
  effects=[]; reads=0; failAt=3;
  await assert.rejects(()=>motion(options), /owner\/lock changed/);
  assert.equal(effects.length,1, 'lock loss prevents remaining steps'); assert(closed);
  await assert.rejects(()=>motion(options)); assert.equal(effects.length,1);
  closed=false; failAt=0; locked=false; effects=[];
  const unlocked=await motion(options);
  assert.equal(unlocked.mode,'unlocked-absolute-css-pixels');
  assert.equal(effects.length,2);
  for (const state of [{automatic:true,relative:true},{automatic:false,relative:false}]) {
    closed=false; effects=[]; ({automatic,relative}=state);
    await assert.rejects(()=>motion(options), /no capture intent/);
    assert(closed); assert.equal(effects.length,0);
  }
  closed=false; automatic=true; relative=false; reads=0; failAt=3; effects=[];
  await assert.rejects(()=>motion(options), /owner\/lock changed/);
  assert.equal(effects.length,1,'unlocked-to-locked transition stops remaining motion');
  const read=options.evaluate;
  for (const [change, message, expected] of [
    [r=>({...r,relative:true}), /capture intent/, 1],
    [r=>({...r,rect:{...r.rect,canvasWidth:999}}), /geometry changed/, 1],
    [r=>({...r,x:r.x+1}), /native anchor changed/, 1]
  ]) {
    closed=false; failAt=0; reads=0; effects=[];
    options.evaluate=async()=>{const r=await read();return reads===3?change(r):r;};
    await assert.rejects(()=>motion(options),message);
    assert.equal(effects.length,expected,'changed input semantics stops remaining motion');
    assert(closed);
  }
  console.log('PASS bounded locked/automatic-unlocked native motion, physical continuity and terminal mode changes');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
