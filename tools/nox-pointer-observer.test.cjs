'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Win98Renderer}=require('../lib/renderer'),{createCanvas}=require('../lib/canvas-compat');
const {bootRenderHarness}=require('../test/render-helper');
const {install}=require('../lib/nox-pointer-observer');
const RegionMap=require('../lib/region-map.generated');
const root=process.cwd(),out=process.argv[2];
assert(out&&out.startsWith(root+'/scratch/runs/'));
const base=RegionMap.BASE.DI_MOUSE_INPUT_STATE;
const save=(name,v)=>fs.writeFileSync(out+'/'+name,JSON.stringify(v,null,2)+'\n');
const extraWat='(func (export "nox_observer_control_take") (result i32) (call $di_mouse_event_take))';
async function main(){
 assert.equal(install({enabled:false,get memory(){throw Error('disabled reads dependency');}}),null);
 const h=await bootRenderHarness({extraWat,fonts:'none'}),results=[];
 const native=require(process.argv[3]+'/native-mouse.cjs');
 for(const mode of ['absolute','pending','locked','anchored']){
  const memory=h.memory,words=new Int32Array(memory.buffer),index=base>>>2;
  // Test setup only, before installing observations. The live observer never stores.
  words.fill(0,index,index+72);
  const canvas=createCanvas(640,480),windowListeners=new Map(),docListeners=new Map();
  const add=(map,t,f)=>{if(!map.has(t))map.set(t,[]);map.get(t).push(f);};
  Object.assign(canvas,{style:{},classList:{toggle(){}},getBoundingClientRect:()=>({left:0,top:34,width:945,height:855}),
    addEventListener(){},removeEventListener(){},setAttribute(){},focus(){}});
  const document={pointerLockElement:mode==='locked'?canvas:null,body:{},documentElement:{},activeElement:canvas,visibilityState:'visible',
   getElementById:()=>null,querySelectorAll:()=>[],elementFromPoint:()=>null,
   addEventListener:(t,f)=>add(docListeners,t,f),removeEventListener:(t,f)=>docListeners.set(t,(docListeners.get(t)||[]).filter(x=>x!==f))};
  const r=new Win98Renderer(canvas);r.wasmMemory=memory;
  const e={clip_cursor_active:()=>0,post_message_q:()=>1,wnd_mouse_msg_origin_x:()=>0,wnd_mouse_msg_origin_y:()=>0};
  r.wasm={exports:e};r.windows[7]={hwnd:7,visible:true,isChild:false,x:0,y:0,w:640,h:480,
   clientRect:{x:0,y:0,w:640,h:480},zOrder:1,wasm:r.wasm,wasmMemory:memory};
  r._exclusiveTransform={hwnd:7,srcX:0,srcY:0,srcW:640,srcH:480,dstX:0,dstY:0,dstW:640,dstH:480};
  r.wantsRelativeMouse=()=>!['absolute','anchored'].includes(mode);r.setMousePosition(420,300);
  const ctx={module:{exports:{}},console,performance,document,setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout};
  ctx.window={addEventListener:(t,f)=>add(windowListeners,t,f),removeEventListener:(t,f)=>windowListeners.set(t,(windowListeners.get(t)||[]).filter(x=>x!==f)),MobileKeyboard:null};
  vm.runInNewContext(fs.readFileSync(root+'/lib/browser-input.js','utf8'),ctx);
  ctx.module.exports.wireCanvasInput(canvas,r,{runningApps:[{name:'nox_demo',wine:{running:true}}]});
  const before=Object.getOwnPropertyDescriptor(r,'handleMouseMove'),listenerCount=[...docListeners.values()].flat().length,emitted=[];let tick,clock=10;
  const observer=install({enabled:true,canvas,renderer:r,memory,diBase:base,document,
   emit:v=>emitted.push(v),now:()=>clock,interval:f=>{tick=f;return 1;},clear(){},durationMs:1000});
  const previous={label:'before',sha256:'a'.repeat(64),identity:{owner:'actual-control'}};
  observer.begin({id:mode,label:mode+'-image',previous});
  const protocol=[];
  const send=async(method,p)=>{
    protocol.push({method,...p});const type=p.type==='mouseMoved'?'mousemove':p.type==='mousePressed'?'mousedown':'mouseup';
    const event={type,clientX:p.x,clientY:p.y,movementX:mode==='locked'?7:0,movementY:mode==='locked'?-3:0,
     isTrusted:false,button:0,buttons:p.buttons,preventDefault(){},stopPropagation(){}};
    for(const f of docListeners.get(type)||[])f(event);
    if(type==='mouseup'){for(const f of windowListeners.get(type)||[])f(event);}else canvas['on'+type](event);
  };
  if(mode==='anchored'){
   const command={action:'move',point:[.5/640,.5/480],anchorOriginalCursor:{x:0,y:0}};
   require('./nox-passive-consumption.cjs').anchorPoint(command,observer.snapshot().state,{x:0,y:0});
   await native.perform({session:'offline',geometry:canvas.getBoundingClientRect(),command,send});
   assert.equal(words[index+3],0,'anchor emits no relative axes or buttons');
   assert.deepEqual(observer.snapshot().state.reference,{x:0,y:0});
   observer.image(previous); // Separate image boundary before dependent input.
   observer.begin({id:mode,label:mode+'-image',previous});
  }
  await native.perform({session:'offline',geometry:canvas.getBoundingClientRect(),command:{action:'click',point:[.5,.794],holdMs:150},send});
  const queued=words[index+3]>>>0,consumed=[];
  while((words[index+2]>>>0)!==queued)consumed.push(h.exports.nox_observer_control_take()>>>0);
  tick();
  const capture={label:mode+'-image',sha256:'b'.repeat(64),identity:previous.identity};observer.image(capture);
  const snapshot=observer.snapshot(),rows=snapshot.records;
  assert.equal(rows.filter(v=>v.kind==='dom').length,mode==='anchored'?4:3);
  assert(rows.filter(v=>v.kind!=='observer-arm').every(v=>v.binding.id===mode));
  const moves=rows.filter(v=>v.kind==='renderer-entry'&&v.method==='handleMouseMove');
  const relative=rows.filter(v=>v.kind==='renderer-entry'&&v.method==='handleRelativeMouseMove');
  if(mode==='absolute'){
   assert.equal(moves.length,1);assert.equal(moves[0].args.x,320);assert.equal(moves[0].args.y,381);
   // Reproduce the original Nox nonresponse: an unprimed absolute move
   // establishes the reference without returning any relative axis records.
   assert.equal(moves[0].state.reference,null);
   assert.deepEqual(consumed.map(word=>word>>>28),[1,2],'buttons only, no X/Y records');
   assert.equal(snapshot.state.di.dx,0);assert.equal(snapshot.state.di.dy,0);
   assert.deepEqual(snapshot.state.reference,{x:320,y:381});
  }
  if(mode==='pending'){assert.equal(moves.length,0);assert.equal(relative.length,0);}
  if(mode==='anchored'){
   assert.equal(moves.length,2);assert.deepEqual(consumed.map(word=>word>>>28),[5,6,1,2]);
   assert.equal(snapshot.state.di.dx,320);assert.equal(snapshot.state.di.dy,381);
  }
  if(mode==='locked'){assert.equal(relative.length,1);assert.equal(relative[0].args.x,7);assert.equal(relative[0].args.y,-3);}
  assert(queued>0,'actual production DI event delivery');
  assert.equal(consumed.length,queued);
  assert.equal(rows.filter(v=>v.kind==='guest-drain').reduce((n,v)=>n+v.count,0),queued);
  assert.equal(rows.at(-1).kind,'image-bound');assert.equal(rows.at(-1).capture.sha256,capture.sha256);
  const bytesBefore=Buffer.from(memory.buffer,base,288).toString('hex');
  observer.snapshot();assert.equal(Buffer.from(memory.buffer,base,288).toString('hex'),bytesBefore);
  observer.stop('control-complete');assert.deepEqual(Object.getOwnPropertyDescriptor(r,'handleMouseMove'),before);
  assert.equal([...docListeners.values()].flat().length,listenerCount);
  // Exhaustion restores the production methods/listeners and cannot extend
  // the observation window or write the shared guest input state.
  const bounded=install({enabled:true,canvas,renderer:r,memory,diBase:base,document,
   now:()=>clock,interval:()=>1,clear(){},limit:8,durationMs:1000});
  assert.throws(()=>bounded.begin({id:'unbound',label:'image'}),/prior image binding/);
  for(let n=0;n<8;n++)bounded.image(capture);
  assert.equal(bounded.snapshot().active,false);assert.equal(bounded.snapshot().records.length,8);
  assert.throws(()=>bounded.begin({id:'late',label:'late',previous}),/stopped/);
  assert.deepEqual(Object.getOwnPropertyDescriptor(r,'handleMouseMove'),before);
  assert.equal([...docListeners.values()].flat().length,listenerCount);
  const timed=install({enabled:true,canvas,renderer:r,memory,diBase:base,document,
   now:()=>clock,interval:()=>1,clear(){},durationMs:1});
  clock+=1;assert.equal(timed.snapshot().active,false);
  assert.equal(timed.snapshot().records.length,1);
  assert.equal(Buffer.from(memory.buffer,base,288).toString('hex'),bytesBefore);
  assert.deepEqual(Object.getOwnPropertyDescriptor(r,'handleMouseMove'),before);
  assert.equal([...docListeners.values()].flat().length,listenerCount);
  results.push({mode,queued,consumed,protocol,observations:snapshot,passed:true,actualProductionRenderer:true,
   actualProductionBridge:true,actualCompiledProductionDrain:true,syntheticDOM:true,nativeGuest:false});
 }
 save('observer-controls.json',{passed:true,results});console.log(JSON.stringify({passed:true,controls:results.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
