'use strict';
const assert = require('node:assert/strict');
const {record} = require('../tools/dungeon-keeper-driver-pointer.cjs');
const {motion} = require('../tools/dungeon-keeper-native-motion.cjs');
const {same, FIELDS} = require('../tools/dungeon-keeper-canvas-binding.cjs');
async function main() {
  const identity=Object.fromEntries(FIELDS.map(f=>[f,'actual-'+f]));
  same(identity,identity);
  for(const field of FIELDS) {
    assert.throws(()=>same(identity,{...identity,[field]:'replacement'}),/identity changed/);
    assert.throws(()=>same({...identity,[field]:null},identity),/missing identity/);
  }
  const pointer = {};
  for (const [x,y,cx,cy] of [[352,246.8,352,246],[352.9,246.1,352,246],[-0.9,-0.1,-1,-1],[351.999999,246.999999,352,247]]) {
    for (const type of ['mouseMoved','mousePressed','mouseReleased']) {
      const params = {type,x,y}; record(pointer,'Input.dispatchMouseEvent',params);
      assert.deepEqual(pointer,{x:cx,y:cy,sentX:x,sentY:y});
      assert.deepEqual(params,{type,x,y},'submitted CDP doubles unchanged');
    }
  }
  record(pointer,'Input.dispatchMouseEvent',{x:352,y:246.8});
  const native={x:352,y:246}; let effects=0,closed=false;
  const chain={admit:async(_,fn)=>{assert(!closed);try{return await fn({live:{identity:{processId:1000}}});}catch(e){closed=true;throw e;}},progress:async()=>{}};
  const options={chain,review:{},pointer,steps:[[1,0],[1,0],[1,0]],intervalMs:40,deadline:Date.now()+10000,wait:async()=>{},
    evaluate:async()=>({locked:false,automatic:true,relative:false,processId:1000,buttons:0,x:native.x,y:native.y,
      rect:{left:32.5,top:194,width:640,height:240,canvasWidth:320,canvasHeight:480}}),
    send:async(method,params)=>{effects++;record(pointer,method,params);native.x=Math.floor(Math.fround(params.x));native.y=Math.floor(Math.fround(params.y));}};
  await motion(options);await motion(options);
  assert.equal(effects,6);assert.equal(pointer.x,358);assert.equal(pointer.y,246);
  native.y=247;effects=0;
  await assert.rejects(()=>motion(options),/native anchor changed/);assert.equal(effects,0);assert(closed);
  await assert.rejects(()=>motion(options));assert.equal(effects,0);
  native.y=pointer.y;
  const read=options.evaluate;
  for(const state of [{locked:false,automatic:true,relative:true},{locked:false,automatic:false,relative:false}]) {
    closed=false;effects=0;options.evaluate=async()=>({...await read(),...state});
    await assert.rejects(()=>motion(options),/no capture intent/);assert.equal(effects,0);assert(closed);
  }
  closed=false;options.evaluate=async()=>({...await read(),locked:true,relative:true});
  await motion(options);assert.equal(effects,3,'capture intent requires and accepts actual lock');
  console.log('PASS fractional CDP bookkeeping, native integer anchor, repeated small motion, wrong-anchor zero effects and terminal closure');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
