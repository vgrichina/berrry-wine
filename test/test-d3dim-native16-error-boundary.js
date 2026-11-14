#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const { D3DIMGpu } = require('../lib/d3dim-gpu');
// Keep every primitive conversion ordered, but query sticky GL errors once
// before a submitted draw can succeed. Exercise real storage with a tiny
// recording GPU, including an error produced before the final conversion.
for (const [primitive, count, blend] of [[1,7,true],[2,5,true],[4,9,true],[4,67,false]]) {
  for (const errorAt of [0, 1, 2]) {
    let stores=0, checks=0, error=0, draws=0;
    const events=[], state=new Map();
    const gl={ NO_ERROR:0, DITHER:7, SCISSOR_TEST:8, TRIANGLE_STRIP:9,
      getError(){ checks++; const e=error; error=0; return e; },
      copyTexSubImage2D(){ stores++; events.push('store'); if (stores===errorAt) error=0x500; } };
    const g={gl,renderHeight:48,_stateValues:state,bindImplicitTarget(){},bindTexture(){},
      setScissor(){},setCapability(){},setColorMask(){},setViewport(){},setUniform(){},draw(){}};
    const errors=[];
    const executor=new D3DIMGpu({exactNative16:true,getExports:()=>({}),getMemory:()=>new ArrayBuffer(0),onError:e=>errors.push(e)});
    const target={bpp:16,width:64,height:48,format:1,nativeStorage:{texture:{},program:{},buffer:{}},
      device:{gpu:g,draw(){draws++;events.push('draw');}}};
    executor._markColorDirty=()=>events.push('success');
    const per=primitive===4?3:primitive===2?2:1;
    const vertices=new Uint8Array(count*per*32),dv=new DataView(vertices.buffer);
    for(let i=0;i<count*per;i++)dv.setFloat32(i*32+12,1,true);
    const result=executor._submitImmediate(target,{primitive,primitiveCount:count,stride:32,vertices,state:{blend}});
    const expected=blend?count:Math.ceil(count/32);
    assert.equal(stores,expected);assert.equal(draws,expected);assert.equal(checks,1);
    assert.deepEqual(events.slice(0,expected*2),Array.from({length:expected},()=>['draw','store']).flat());
    assert.equal(result,errorAt?0:1);assert.equal(errors.length,errorAt?1:0);
    assert.equal(events.includes('success'),!errorAt);
    // Standalone storage still checks by default.
    const before=checks;executor._storeNative16(target);assert.equal(checks,before+1);
    gl.copyTexSubImage2D=()=>{error=0x500};
    assert.throws(()=>executor._storeNative16(target),/Native16 GPU storage failed/);
  }
}
console.log('PASS native16 ordered conversion and submission error boundary (12 cases)');
