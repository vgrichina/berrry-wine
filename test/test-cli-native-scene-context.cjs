'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
function fixture(){
  const b=require('./test-sims-null-owner-modal-native.cjs').image(false),raw=r=>r-0x1000+0x200;
  const at=b.indexOf(Buffer.from([0x83,0xf8,2,0x0f,0x95,0xc0]));assert(at>raw(0x2000));
  const next=Buffer.from([0x68,0x10,0,0,0,0x68,0x40,0x25,0x40,0,0x68,0x80,0x25,0x40,0,0x6a,0,0xff,0x15,0x4c,0x19,0x40,0]);
  b.copy(b,at+next.length,at,raw(0x2500)-next.length);next.copy(b,at);b[at+next.length+2]=1;
  const first=b.indexOf(Buffer.from([0x68,1,0,0,0,0x68,0x40,0x25,0x40,0]));assert(first>=0);b.writeUInt32LE(0x10,first+1);
  b.fill(0,raw(0x2580),raw(0x2600));b.write('Generated native context transition. OK opens the next box.\0',raw(0x2580));
  return b;
}
module.exports={fixture};
if(require.main===module&&process.argv[2]==='--prepare')fs.writeFileSync(process.argv[3],fixture(),{flag:'wx'});
if(require.main===module&&process.argv[2]==='--unit'){
 const {matches}=require('../lib/cli-native-scene'),{createGuardedInput}=require('../lib/cli-guarded-input');
 const main={hwnd:'0x1',generation:'1',processId:1,threadId:1,visible:true,live:true,isChild:false,title:'',owner:'0x0',parent:'0x0'};
 const box={...main,hwnd:'0x2',generation:'2',title:'Dialog'};
 const s={mainHwnd:'0x1',windows:[main,box],modalHwnd:'0x2',focus:'0x2',focusTopLevel:'0x2',focusWindow:{...box},capture:'0x0',physicalUp:true,nativeProcess:{pid:123,executable:'fixture.exe'},nativeMessageBox:{hwnd:'0x2',generation:'2',processId:1,threadId:1,controlClass:16},screen:{w:800,h:600},eip:'0x402000',quit:false};
 assert(matches(s,s));
 for(const change of [v=>v.capture='0x2',v=>v.physicalUp=false,v=>v.focusWindow.threadId++,v=>v.focusWindow.processId++,v=>v.focusWindow.generation='3',v=>v.windows[1].generation='3',v=>v.nativeProcess.pid++,v=>v.focusTopLevel='0x1',v=>v.nativeMessageBox=null,v=>v.quit=true]){
  const current=structuredClone(s);change(current);assert(!matches(current,s));
 }
 const noModal=structuredClone(s);noModal.windows=[noModal.windows[0]];noModal.modalHwnd='0x0';noModal.focus=noModal.focusTopLevel='0x1';noModal.focusWindow={...main};noModal.nativeMessageBox=null;
 assert(matches(noModal,noModal),'untitled genuine native main needs no title heuristic');
 const refs={queue:[]};let scene=structuredClone(s),effects=0,ups=0;
 const g=createGuardedInput({snapshot:()=>({healthy:true,refs}),cleanup:()=>ups++,validateIntent:intent=>matches(scene,intent)}),owner=g.bind();
 const prepare=(nonce,intent)=>g.prepare({...owner,nonce,reviewed:true,deadline:Date.now()+10000,intent},{action:'mousedown',x:10,y:10});
 const intent=structuredClone(s),ticket=prepare('changed-focus',intent);intent.focusWindow.threadId=999;
 scene.focusWindow.generation='changed';assert.equal(g.consume(ticket,()=>effects++).state,'CANCELLED');assert.equal(effects,0);
 scene=structuredClone(s);const first=prepare('first',scene);g.consume(first,()=>{effects++;scene.focus='changed-by-native-effect';scene.physicalUp=false;});g.release(owner.owner);assert.equal(ups,1,'changed native focus never prevents original physical release');
 scene=structuredClone(noModal);const next=prepare('next-native-dialog',scene);assert.equal(g.consume(next,()=>effects++).state,'CONSUMED');g.release(owner.owner);
 assert.equal(effects,2);assert.throws(()=>prepare('first',scene),/already used/);g.close();
 const clean=createGuardedInput({snapshot:()=>({healthy:true,refs}),cleanup:()=>{},validateIntent:intent=>matches(s,intent)}),b=clean.bind(),operand=structuredClone(s);
 const copied=clean.prepare({...b,nonce:'immutable-copy',reviewed:true,deadline:Date.now()+1000,intent:operand},{action:'mousemove'});
 operand.focusWindow.generation='mutated-after-prepare';assert.equal(clean.consume(copied,()=>{}).state,'CONSUMED');clean.close();
 console.log('PASS native main/modal/process/thread/generation/focus/capture context and consume-time validation with independent UP');
}
