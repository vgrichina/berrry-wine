'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createFocusOrder,reviewHost}=require('../tools/hexen2-native-host-focus.cjs');
const good=()=>({focused:true,visibility:'visible',fullscreen:true,event:{type:'click',trusted:true,target:'BUTTON',at:100}});
test('inherited prepare-before-host-click is refused before native bind',()=>{
  const gate=createFocusOrder();let binds=0;
  assert.throws(()=>{gate.beforeBind();binds++;},/must precede/);assert.equal(binds,0);
  gate.complete(good(),99);gate.beforeBind();binds++;assert.equal(binds,1);
});
for(const [name,change] of Object.entries({addressbar:o=>o.focused=false,hidden:o=>o.visibility='hidden',noFullscreen:o=>o.fullscreen=false,
  synthetic:o=>o.event.trusted=false,guestClick:o=>o.event.target='CANVAS',oldEvent:o=>o.event.at=98})){
  test(name+' closes before bind with zero DOWN',()=>{
    const gate=createFocusOrder(),o=good();change(o);let downs=0;
    assert.throws(()=>gate.complete(o,99));assert.throws(()=>{gate.beforeBind();downs++;});
    assert.equal(downs,0);assert.throws(()=>gate.complete(good(),99),/cannot restart/);
  });
}
test('caller cannot mutate retained completion and completion cannot replay',()=>{
  const gate=createFocusOrder(),o=good();gate.complete(o,99);o.focused=false;
  assert.equal(gate.beforeBind().focused,true);assert.throws(()=>gate.complete(good(),99),/cannot restart/);
});
test('host review retains exact app, native focus, owner and geometry checks',()=>{
  const a={name:'live_input_fixture',running:true,stopped:false,guestWorker:true,windowHwnd:1,processId:2,guestEndpoint:3,endpoint:3,slot:0,slice:{focusHwnd:1},owner:'same'};
  const live={page:{isolated:true,apps:[a]},button:{object:'button',label:'Use browser fullscreen',x:10,y:20,box:{width:4}},wrap:'wrap',strip:{object:'strip'},viewport:{width:100}};
  const binding={HOST_FIELDS:['owner'],consentButton:o=>assert.equal(o.button.object,'button')};
  const scene={sha256:'hash',at:100,observation:structuredClone(live)},review={sha256:'hash',observation:'complete host image',hostOnly:true};
  reviewHost(scene,review,live,binding,'live_input_fixture',101);
  for(const mutate of [o=>o.page.apps[0].slice.focusHwnd=0,o=>o.page.apps[0].owner='changed',o=>o.button.x++,o=>o.page.apps[0].name='other']){
    const changed=structuredClone(live);mutate(changed);assert.throws(()=>reviewHost(scene,review,changed,binding,'live_input_fixture',101));
  }
});
