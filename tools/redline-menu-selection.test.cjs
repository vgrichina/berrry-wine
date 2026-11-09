'use strict';
const assert=require('node:assert/strict');
const {perform}=require('./redline-menu-selection.cjs');
const ordinaryMouse=require('../scratch/runs/20261108-redline-car-door-native/native-mouse.cjs');
(async()=>{
 const base={ordinaryMouse,pointerLocked:true,cdpPoint:{x:784.35,y:769.3},session:'offline',geometry:{left:0,top:34,width:945,height:855},command:{action:'click',point:[.51,.59],holdMs:150}};
 let calls=[];const send=async(m,p)=>{calls.push({m,...p});return {};};
 // This is the actual old helper, not a mirrored coordinate formula.
 await ordinaryMouse.perform({...base,send});assert.equal(calls[0].x,481.95);assert.equal(calls[0].y,538.45);
 assert.equal(Math.trunc(calls[0].x)-Math.trunc(base.cdpPoint.x),-303);
 assert.equal(Math.trunc(calls[0].y)-Math.trunc(base.cdpPoint.y),-231);
 calls=[];
 await assert.rejects(perform({...base,send}),/locked absolute/);assert.equal(calls.length,0);
 const fixed=await perform({...base,send,command:{...base.command,cursorOnly:true}});
 assert.deepEqual(calls.map(c=>c.type),['mouseMoved','mousePressed','mouseReleased']);
 assert(calls.every(c=>c.x===base.cdpPoint.x&&c.y===base.cdpPoint.y));assert(fixed.independentRelease);assert(fixed.cursorOnly);
 for(const change of [{pointerLocked:undefined},{cdpPoint:null},{command:{...base.command,cursorOnly:true,holdMs:700}}]){
  calls=[];await assert.rejects(perform({...base,...change,send,command:change.command??{...base.command,cursorOnly:true}}));assert.equal(calls.length,0);
 }
 calls=[];await assert.rejects(perform({...base,send,pointerLocked:false,command:{...base.command,cursorOnly:true}}));assert.equal(calls.length,0);
 // A failed down still triggers the original independent up, then propagates.
 calls=[];await assert.rejects(perform({...base,command:{...base.command,cursorOnly:true},send:async(m,p)=>{calls.push(p);if(p.type==='mousePressed')throw Error('first down failure');}}),/first down failure/);
 assert.deepEqual(calls.map(c=>c.type),['mouseMoved','mousePressed','mouseReleased']);
 console.log('PASS actual old helper target FAIL; cursorOnly zero-displacement PASS; locked absolute/missing state/bad hold refusals have zero effects; failed down releases and propagates');
})().catch(e=>{console.error(e);process.exitCode=1;});
