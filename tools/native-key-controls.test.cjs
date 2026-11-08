'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const controls=require('./native-key-controls.cjs');
test('Alt has the same native encoding at admission and execution',()=>{
  controls.validate('Alt',1500);controls.validateHold(['Alt'],1500);
  assert.deepEqual(controls.eventForKey('Alt'),{key:'Alt',code:'AltLeft',windowsVirtualKeyCode:18});
});
test('every admitted ordinary key has an executor event',()=>{
  for(const key of ['Backspace','0','ArrowLeft','ArrowUp','ArrowRight','ArrowDown','Alt','Control','Space','Escape','Enter','Tab','a','p',',','.']){
    controls.validate(key,50);controls.validateHold([key],2000);
    const e=controls.eventForKey(key);assert(Number.isInteger(e.windowsVirtualKeyCode));assert(e.code);
  }
  assert.equal(controls.eventForKey('Space').key,' ');
});
test('duration and key negatives remain closed before dispatch',()=>{
  for(const ms of [0,49,2001,3500,-1,NaN,100.5,Infinity,undefined])assert.throws(()=>controls.validateHold(['Alt'],ms));
  for(const key of ['Shift','F5','__proto__','constructor','toString','',null,undefined]){
    assert.throws(()=>controls.validate(key,100));assert.throws(()=>controls.eventForKey(key));
  }
});
test('only the established two-key combinations are admitted',()=>{
  for(const keys of [['a','Control'],['a','Space']])controls.validateHold(keys,500);
  for(const keys of [[],['Alt','ArrowUp'],['a','Alt'],['a','a'],['a','Space','Control'],null])assert.throws(()=>controls.validateHold(keys,500));
});
test('returned event objects cannot corrupt future key mapping',()=>{
 const e=controls.eventForKey('Alt');e.windowsVirtualKeyCode=1;assert.equal(controls.eventForKey('Alt').windowsVirtualKeyCode,18);
});
