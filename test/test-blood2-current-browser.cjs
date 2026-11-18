'use strict';
const assert = require('node:assert/strict');
const {keyEvent,binding}=require('../tools/blood2-current-browser.cjs');
const {mediaRoutes}=require('../tools/blood2-current-browser.cjs');
const manifest='test/binaries/win98-games-a-d/Blood2-demoD3D/Game/.wine-assembly-browser.json';
assert.deepEqual(mediaRoutes(manifest),[manifest,manifest.slice(5)]);
assert.throws(()=>mediaRoutes('test/binaries/../elsewhere'));
const {CORE_FIELDS,sameCore}=require('../tools/blood2-current-browser.cjs');
const menu=Object.fromEntries(CORE_FIELDS.map((k,i)=>[k,i+1]));
Object.assign(menu,{renderEndpoint:'none',renderApi:'none',outputCanvasObject:'menu-output'});
const world={...menu,renderEndpoint:1,renderApi:'d3dim-gps',outputCanvasObject:'world-output'};
sameCore(menu,world);
assert.throws(()=>sameCore(menu,{...world,moduleObject:'replacement'}),/moduleObject/);
assert.throws(()=>sameCore(menu,{...world,windowObject:'other-window'}),/windowObject/);
assert.throws(()=>sameCore({...menu,endpoint:null},world),/missing core/);
assert.throws(()=>assert.equal(menu.renderEndpoint,world.renderEndpoint));
console.log('DirectDraw-menu to actual 3D backend with same process/module/window PASS; old renderer-birth gate rejects');
for(const key of ['a','s','Space','Control','Enter','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']) {
  const down=keyEvent(key,'keyDown'),up=keyEvent(key,'keyUp');
  assert.deepEqual({...down,type:'keyUp'},up);
}
assert.equal(keyEvent('a','keyUp').code,'KeyA');
assert.equal(keyEvent('s','keyUp').code,'KeyS');
assert.equal(keyEvent('Control','keyDown').code,'ControlLeft');
assert.throws(()=>keyEvent('UNKNOWN','keyDown'));
assert(binding.PAGE_READ.includes("'d3dim-gps'"));
console.log('Blood II exact ordinary key/code pairs PASS');
const {deliver}=require('../tools/blood2-current-browser.cjs');
(async()=>{
  let clock=0,finished=0,downs=0;
  const result=await deliver({now:()=>clock,holdMs:120,
    validate:async()=>{clock=2100;},
    arm:async()=>{clock+=1600;return {fallback:clock+5000,
      schedule:at=>assert.equal(at,3820),finish:async()=>++finished};},
    down:async()=>{downs++;}});
  assert.equal(result.downAt,3700);assert.equal(downs,1);assert.equal(finished,1);
  // The historical 1000ms prearm allowance rejects this valid 1600ms setup.
  assert(1600>1000);
  await assert.rejects(deliver({now:()=>clock,holdMs:120,validate:async()=>{},
    arm:async()=>({fallback:clock+100,schedule:()=>assert.fail('not sent'),finish:async()=>++finished}),
    down:async()=>assert.fail('expired lease must not send DOWN')}),/NOT_SENT/);
  assert.equal(finished,2);
  console.log('Delayed prearm before finite release lease and expired lease closure PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
