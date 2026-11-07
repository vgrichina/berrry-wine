'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {Win98Renderer} = require('../lib/renderer');
const packed = (x,y) => ((y << 16) | x) | 0;
function renderer(){
  const r=new Win98Renderer({width:800,height:600,getContext:()=>({})});
  r._buttonHoldFloorMs=-1;
  r._setMousePoint(400,300);
  return r;
}
for(const enqueue of ['browser','guest'])for(const order of ['poll-first','message-first']){
  test(`${enqueue} move: ${order} accumulates once across cursor recenter`,()=>{
    const r=renderer(),ui=[397,300];
    if(enqueue==='browser'){
      r._setMousePoint(402,155);
      r._dispatchMouseEvent(null,{type:'mouse',hwnd:1,msg:0x200,wParam:0,lParam:packed(402,155)});
    }else r.queueMouseInput(1,2,-145,0,0);
    const sample=()=>{const p=r.getMousePosition();ui[0]+=(p<<16>>16)-400;ui[1]+=(p>>16)-300;r.setMousePosition(400,300);};
    if(order==='poll-first')sample();
    const event=r.takeInput(null);
    assert.equal(event.msg,0x200);
    assert.equal(event.lParam,packed(402,155),'message position remains historical');
    sample();
    assert.deepEqual(ui,[399,155],'queued event must not resurrect the consumed delta');
    r.takeInput(null);sample();assert.deepEqual(ui,[399,155]);
    for(const msg of [0x201,0x202]){
      r._dispatchMouseEvent(null,{type:'mouse',hwnd:1,msg,wParam:msg===0x201?1:0,lParam:packed(400,300)});
      assert.equal(r.takeInput(null).msg,msg);sample();assert.deepEqual(ui,[399,155]);
    }
  });
}
test('unwarped queued positions and button snapshots remain ordered',()=>{
  const r=renderer();
  r._setMousePoint(410,165);r._mouseButtonsMask=1;
  r._dispatchMouseEvent(null,{type:'mouse',hwnd:1,msg:0x201,lParam:packed(410,165)});
  r._setMousePoint(420,175);r._mouseButtonsMask=0;
  r._dispatchMouseEvent(null,{type:'mouse',hwnd:1,msg:0x202,lParam:packed(420,175)});
  const down=r.takeInput(null);
  assert.equal(r.getMousePosition(),packed(410,165));assert.equal(r.getMouseButtons(),1);
  r.setMousePosition(400,300);
  // Simulate another Worker restoring its saved active-event context.
  r._activeInputEvent=down;
  assert.equal(r.getMousePosition(),packed(400,300));assert.equal(r.getMouseButtons(),1);
  const up=r.takeInput(null);assert.equal(up.lParam,packed(420,175));
  assert.equal(r.getMousePosition(),packed(400,300));assert.equal(r.getMouseButtons(),0);
  r._setMousePoint(430,185);r._dispatchMouseEvent(null,{type:'mouse',hwnd:1,msg:0x200,lParam:packed(430,185)});
  r.takeInput(null);assert.equal(r.getMousePosition(),packed(430,185),'post-warp fresh input accepted');
});

test('tiny native PE cannot resurrect a queued pre-warp cursor snapshot (both modules)',()=>{
 const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
 const out=path.resolve(process.env.ARANNA_INPUT_TEST_OUT||'scratch/aranna-control-input-test');fs.mkdirSync(out,{recursive:true});
const {pe}=require('../test/test-dll-lifecycle-real-pe');
const U=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24],b=[],fix=[];
const e=(...a)=>b.push(...a.flat()),p=n=>e(0x68,U(n));
const names=['SetCursorPos','mouse_event','GetCursorPos','PeekMessageA','ExitProcess'];
const api=n=>e(0xff,0x15,U(0x401900+names.indexOf(n)*4));
function check(addr,n){e(0xa1,U(addr),0x3d,U(n),0x0f,0x85);fix.push(b.length);e(0,0,0,0);}
p(300);p(400);api('SetCursorPos');
// Real guest-generated motion queues exactly one event and updates the cursor.
for(const n of [0,0,-145,2,1])p(n);api('mouse_event');
p(0x401400);api('GetCursorPos');check(0x401400,402);check(0x401404,155);
p(300);p(400);api('SetCursorPos');
// Remove the pending move AFTER its displacement was read and recentred.
for(const n of [1,0x200,0x200,0,0x401420])p(n);api('PeekMessageA');
check(0x401424,0x200);check(0x40142c,(155<<16)|402);
p(0x401400);api('GetCursorPos');check(0x401400,400);check(0x401404,300);
p(0);api('ExitProcess');
for(const [i,at] of fix.entries()){const dest=b.length;p(101+i);api('ExitProcess');b.splice(at,4,...U(dest-at-4));}
const image=pe([[0x2000,b]]),raw=r=>r-0x1000+0x200;
image.fill(0,raw(0x1900),raw(0x1e00));let cursor=0x1a00;
for(const [i,n]of names.entries()){image.writeUInt32LE(cursor,raw(0x1900+i*4));image.write(n+'\0',raw(cursor+2));cursor+=n.length+3;}

 const exe=path.join(out,'native-queue-control.exe');fs.writeFileSync(exe,image);
 for(const mode of ['standard','compat']){
  const wasm=path.resolve('build/wine-assembly'+(mode==='standard'?'':'.compat')+'.wasm');
  const r=cp.spawnSync(process.execPath,['test/run.js','--exe='+exe,'--no-build','--wasm='+wasm,'--quiet-api','--quiet-blocks','--max-seconds=20'],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  const output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(out,mode+'.log'),output);
  assert.equal(r.status,0,output.slice(-3000));assert.match(output,/\[Exit\] code=0\b/);
 }
});
