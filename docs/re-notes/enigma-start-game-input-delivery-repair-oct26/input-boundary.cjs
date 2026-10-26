'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const H=path.resolve(__dirname,'..'), O=__dirname;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pins=JSON.parse(fs.readFileSync(path.join(O,'pins.json')));
for(const x of pins) assert.equal(sha(fs.readFileSync(x.path)),x.sha256);
const ctl=require(pins[1].path), src=fs.readFileSync(pins[0].path,'utf8'), wired=ctl.wireRunner(src);
assert.equal(sha(wired),'a9625e1d102883c27b1bd2de0bab560a44ab3bc7eb589b18e7a736100eb2a0da');
const closure=JSON.parse(fs.readFileSync(path.join(O,'exact-related-source.json')));
for(const x of closure.files)assert.equal(sha(fs.readFileSync(x.path)),x.sha256);
const donor='/tmp/civ2-win16-ordinary-gameplay-oct26/source';
const {Win98Renderer}=require(donor+'/lib/renderer');
const {inputEventHwnd}=require(donor+'/lib/host-window');
const {createInputConsumptionTrace}=require(donor+'/test/input-consumption-trace');
const excerpts=[];
function cut(label,source,start,end){
 const a=source.indexOf(start);assert(a>=0,label+' start');assert.equal(source.indexOf(start,a+1),-1,label+' unique');
 const b=source.indexOf(end,a+start.length);assert(b>a,label+' end');
 const text=source.slice(a,b);excerpts.push({label,startLine:source.slice(0,a).split('\n').length,endLine:source.slice(0,b).split('\n').length,bytes:Buffer.byteLength(text),sha256:sha(text)});return text;
}
const parser=cut('canonical input parser',wired,'  const parseInputEntries = (entries) => {','  if (INPUT_SPEC) {');
const handler=cut('whole transformed handleControlCommand',wired,'  const handleControlCommand = (cmdIn) => {','  const control = (CONTROL || CONTROL_STDIN)');
const branch=cut('ordinary click dispatch',wired,"      } else if (ev.action === 'click' && renderer && renderer.handleMouseDown) {","      } else if (ev.action === 'mousedown'");
// Only remove the surrounding else-if delimiters. The statements and condition are unchanged.
const click='if'+branch.slice(branch.indexOf(' ('))+'}';
const host=cut('runner input poll/routing imports',wired,'  let lastInputEvent = null;','  let lastMouseTracePos = -1;');
const mouse=cut('runner mouse imports',wired,'  h.get_mouse_position = () =>\n    (renderer && renderer.getMousePosition','  if (TRACE_MOUSE_STATE) {');
const config=cut('runner hold configuration',wired,'  if (renderer) renderer._buttonHoldFloorMs = -1;','  // --wall-clock-ms');
const make=new Function('renderer','inputEventHwnd','createInputConsumptionTrace',`
 const h={},logs=[],scheduledInput=[],tickState={batch:120833};let controlFrozen=true,controlRunCredits=0,videoRecorder=null;
 let inputEvent=null,inputQueue=null,installingFiles=false;const crossThreadMsgs=[];
 const inputConsumptionTrace=createInputConsumptionTrace({enabled:true,logs,snapshot:()=>({batch:tickState.batch,guestMs:0,clock:'fixture',lastGuestTick:'unavailable'})});
 ${parser}\n${handler}\n${host}\n${mouse}\n${config}
 return {h,logs,scheduledInput,tickState,handleControlCommand,dispatch(ev){const batch=tickState.batch;${click}},setCredits(n){controlRunCredits=n}};
`);
// Real production renderer and exported input methods. The canvas is a non-painting
// surface adapter; no renderer input/queue/routing method is replaced. No guest is run.
function renderer(){
 const canvas={width:640,height:480,getContext:()=>({})};
 const r=new Win98Renderer(canvas);r.lazyPresentation=true;
 const wasm={exports:{}};r.wasm=wasm;
 r.windows[0x10001]={hwnd:0x10001,x:20,y:20,w:646,h:507,style:0xca0000,visible:true,isChild:false,title:'Enigma - Main Menu',wasm};
 return r;
}
function witness(r,key){
 const k=Symbol.for(key),original=r.repaint,s={original,count:1,batch:120833,prepared:true};
 s.wrapper=function(...a){return original.apply(this,a)};Object.defineProperty(s.wrapper,k,{value:s});r.repaint=s.wrapper;globalThis[k]=s;
}
const r=renderer(), h=make(r,inputEventHwnd,createInputConsumptionTrace), key='wine.enigma.fixture.boundary';witness(r,key);
const response=h.handleControlCommand({action:ctl.ATOMIC_ACTION,key,batch:120833});
assert.deepEqual(response,{queued:true,batch:120833});assert.equal(r.inputQueue.length,0,'ACK is schedule only');
assert.deepEqual(h.scheduledInput,[{batch:120833,action:'click',x:344,y:212}]);
assert.throws(()=>h.handleControlCommand({action:ctl.ATOMIC_ACTION,key,batch:120833}),/invalidated/);
assert.equal(h.scheduledInput.length,1);
h.dispatch(h.scheduledInput.shift());
const queued=r.inputQueue.map(e=>({...e}));
assert.deepEqual(queued.map(e=>e.msg),[0x84,0x201,0x202]);
assert.deepEqual(queued.map(e=>e.hwnd),[0x10001,0x10001,0x10001]);
assert.deepEqual(queued.map(e=>e.lParam>>>0),[0xd40158,0xa90141,0xa90141]);
assert.deepEqual(queued.map(e=>[e.mouseX,e.mouseY,e.mouseButtons]),[[344,212,1],[344,212,1],[344,212,0]]);
const polled=[];
for(let packed; (packed=h.h.check_input())!==0;){
 polled.push({packed:packed>>>0,hwnd:h.h.check_input_hwnd(0x10001),lParam:h.h.check_input_lparam()>>>0,wParam:h.h.check_input_wparam(),position:h.h.get_mouse_position()>>>0,buttons:h.h.get_mouse_buttons()});
}
assert.deepEqual(polled.map(e=>e.packed),[0x84,0x10201,0x202]);
assert.deepEqual(polled.map(e=>e.buttons),[1,1,0]);
assert(polled.every(e=>e.position===0xd40158));assert.equal(r.inputQueue.length,0);
// Poll-state discriminant: while a DOWN event is active the production getter
// exposes DOWN; after UP in the same pump it exposes released. This is a fact
// about this fixture, NOT proof that Enigma requires a held state or hover.
assert.equal(h.h.get_mouse_buttons(),0);
// Explicit press/release separated by a poll preserves state until UP.
const r2=renderer(), h2=make(r2,inputEventHwnd,createInputConsumptionTrace);
r2.handleMouseDown(344,212,1);while(h2.h.check_input()){};
assert.equal(h2.h.get_mouse_buttons(),1);r2.handleMouseUp(344,212,1);assert.equal(h2.h.check_input(),0x202);assert.equal(h2.h.get_mouse_buttons(),0);
// Affected rejection controls: stale batch and live credits must not enqueue.
const rejected=[];
for(const mode of ['stale-batch','credits']){
 const rr=renderer(), hh=make(rr,inputEventHwnd,createInputConsumptionTrace), k='wine.enigma.fixture.'+mode;witness(rr,k);
 if(mode==='credits')hh.setCredits(1);
 assert.throws(()=>hh.handleControlCommand({action:ctl.ATOMIC_ACTION,key:k,batch:mode==='stale-batch'?120832:120833}),/invalidated/);
 assert.equal(hh.scheduledInput.length,0);assert.equal(rr.inputQueue.length,0);assert.equal(globalThis[Symbol.for(k)],undefined);rejected.push(mode);
}
// Exact saved trace, not a fixture-only delivery assertion.
const prior='/tmp/enigma-capture-budget-gameplay-oct26/ops/retained', log=fs.readFileSync(prior+'/output.log','utf8');
const actual=log.split('\n').filter(l=>/^\[(input|check_input|check_input_hwnd)\]/.test(l));
assert.deepEqual(actual,[
 '[input] click 344,212 at batch 120833',
 '[check_input] msg=0x84 wParam=0x0 lParam=0xd40158 packed=0x84',
 '[check_input_hwnd] explicit hwnd=0x10001',
 '[check_input] msg=0x201 wParam=0x1 lParam=0xa90141 packed=0x10201',
 '[check_input_hwnd] explicit hwnd=0x10001',
 '[check_input] msg=0x202 wParam=0x0 lParam=0xa90141 packed=0x202',
 '[check_input_hwnd] explicit hwnd=0x10001']);
for(const file of ['qualification.png','before.png','after-gameplay.png']) assert.equal(sha(fs.readFileSync(prior+'/'+file)),ctl.MENU.pngSHA256);
const result={source:sha(src),transformed:sha(wired),fixtureSHA256:sha(fs.readFileSync(__filename)),excerpts,queued,polled,actualTrace:actual,rejected,verdict:'host imports consumed matching mouse sequence; no deterministic Enigma defect proven; guest MSG/SDL handling and frame-state sampling unobserved',limits:'no guest executed; window from snapshot, style from original CreateWindow log; empty guest export surface uses production geometry fallback'};
fs.writeFileSync(path.join(O,'boundary-results.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pass:true,groups:['exact-production-atomic-to-renderer-to-host-poll','split-press-state-discriminant','stale-batch-and-credits-rejections','actual-saved-input-and-frame-identity'],polled,verdict:result.verdict}));
