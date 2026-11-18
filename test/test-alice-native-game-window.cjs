'use strict';
const assert=require('node:assert/strict'),scene=require('../lib/cli-native-scene');
const row=(h,g)=>({hwnd:h,generation:g,processId:1,threadId:1,visible:true,live:true,isChild:false,
  owner:'0x0',parent:'0x0',style:0x90000000,controlClass:0,nativeTextAvailable:true,title:'Authored',
  x:0,y:0,screenX:0,screenY:0,w:480,h:360});
function snapshot(){const console=row('0x10001','1'),game=row('0x10007','7');console.visible=false;
  return {mainHwnd:console.hwnd,windows:[console,game],focus:game.hwnd,focusTopLevel:game.hwnd,
    focusWindow:{...game},modalHwnd:'0x0',capture:game.hwnd,physicalUp:true,nativeProcess:{pid:123,executable:'authored.exe'},
    eip:'0x402000',quit:false,screen:{w:480,h:360},pointerMapping:{canvas:{w:480,h:360},sourceHwnd:null}};}
const s=snapshot();assert.deepEqual(scene.contextFailures(s,s),[]);
const actorExports={get_process_id:()=>1,get_current_thread_id:()=>1,get_quit_flag:()=>0,get_eip:()=>0x402000,
  get_window_thread:()=>1,wnd_lookup_live:()=>1,wnd_lookup_generation:()=>7};
const instance={exports:actorExports},win={visible:true,wasm:instance};
const base={healthy:false,refs:{renderer:{windows:{[0x10007]:win}}}};
assert(scene.startupReadiness(s,base,instance).ready,'hidden first console cannot select the permanent input actor');
const lease=scene.context(s);
const selectedOwner=scene.reviewedRuntimeOwner(base,lease,instance);
assert(selectedOwner.healthy);assert.equal(selectedOwner.refs.selectedWindow,win);
actorExports.wnd_lookup_generation=()=>8;
assert(!scene.reviewedRuntimeOwner(base,lease,instance).healthy,'reused shared window must fail creator generation');
actorExports.wnd_lookup_generation=()=>7;
win.wasm={exports:{...actorExports,get_process_id:()=>2}};
assert(!scene.reviewedRuntimeOwner(base,lease,instance).healthy,'foreign creator must fail');win.wasm=instance;
const manager={threads:new Map([[1,{state:'active',instance:{exports:actorExports}}]])};
assert(!scene.reviewedRuntimeOwner(base,lease,instance,manager).healthy,'duplicate actor must fail');
const visible=snapshot();visible.windows[0].visible=true;assert(scene.matches(visible,visible));
const topology=require('../tools/alice-native-game-window.cjs');
for(const capture of ['0x0',s.focus]){
  const v=snapshot();v.capture=capture;
  assert(topology.gameWindowReady({contract:'native-startup-readiness-v1',ready:true,failures:[],snapshot:v}),
    'a selected live game can present before acquiring capture');
}
const startupConsole=snapshot();startupConsole.windows[0].visible=true;startupConsole.focus=startupConsole.focusTopLevel=startupConsole.mainHwnd;
startupConsole.focusWindow={...startupConsole.windows[0]};startupConsole.capture='0x0';
assert(!topology.gameWindowReady({contract:'native-startup-readiness-v1',ready:true,failures:[],snapshot:startupConsole}));
for(const [name,change]of Object.entries({foreignCapture:v=>v.capture='0x10001',staleCapture:v=>v.windows[1].live=false,
  generation:v=>v.windows[1].generation='0',foreignThread:v=>{v.windows[1].threadId=2;v.focusWindow.threadId=2;},
  mismatchedFocusGeneration:v=>v.focusWindow.generation='8',
  foreignProcess:v=>{v.windows[1].processId=2;v.focusWindow.processId=2;},child:v=>v.windows[1].isChild=true,
  hidden:v=>v.windows[1].visible=false,modal:v=>v.modalHwnd='0x10001',presentation:v=>v.pointerMapping.sourceHwnd=0x10001,
  held:v=>v.physicalUp=false,quit:v=>v.quit=true})){
  const v=snapshot();change(v);assert(!scene.matches(v,v),name);
}
for(const change of [v=>v.windows[1].generation='8',v=>v.nativeProcess.pid++,v=>{
  const other=row('0x10008','8');v.windows.push(other);v.focus=v.focusTopLevel=other.hwnd;v.focusWindow={...other};v.capture=other.hwnd;}]){
  const v=snapshot();change(v);assert(!scene.matches(v,s),'reviewed context must refuse changed unrelated/reused target');
}
let clock=1000;
const registry=scene.createReviewedContexts({now:()=>clock,monotonic:()=>clock});
const record=registry.capture(snapshot,()=>Buffer.from('authored retained image'),()=>{});
const review={...record,reviewed:true,reviewedAt:clock,scope:'game',targetHwnd:s.focus};
assert(registry.verify(s,review,{action:'keydown',code:87},'key'));
assert.throws(()=>registry.verify(s,{...review,targetHwnd:s.mainHwnd},{action:'keydown',code:87},'key'),/target unavailable|attestation changed/);
const registry2=scene.createReviewedContexts({now:()=>clock,monotonic:()=>clock});
const record2=registry2.capture(snapshot,()=>Buffer.from('mouse retained image'),()=>{});
assert(registry2.verify(s,{...record2,reviewed:true,reviewedAt:clock,scope:'game',targetHwnd:s.focus},
  {action:'mousemove',x:120,y:120},'mouse'));
const exe=require('../tools/alice-native-game-window.cjs').fixture();assert(exe.includes(Buffer.from('SetCapture\0')));
console.log('PASS selected live top-level, retained review, keyboard versus mouse capture, actor/modal/generation/presentation negatives');
