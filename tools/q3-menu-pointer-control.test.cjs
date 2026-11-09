'use strict';
// Offline: retained command body + native mouse + actual DOM bridge, renderer,
// and host mouse reader. Only browser scheduling/window exports are inert.
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const assert=require('node:assert/strict'), z=require('node:zlib'), crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'), helper=require('./q3-menu-pointer-control.cjs');
const composition=require('./q3-native-driver-composition.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const prior=path.join(root,'scratch/runs/20261109-q3-repaired-native-world-progress-1345');
const json=f=>JSON.parse(z.gunzipSync(fs.readFileSync(f)));
const inventory=json(prior+'/prepared/original-inventory-final.json.gz');
const retrieval=json(prior+'/prepared/original-retrieval.json.gz');
const references=[];
const pins=json(prior+'/runtime-pins.json.gz');
for(const file of ['host.js','lib/browser-input.js','lib/renderer-input.js','lib/renderer.js',
  'lib/host-window.js','lib/guest-rpc.js','scratch/runs/20261108-q3-gl-readiness-gameplay/native-mouse.cjs']){
  const pin=pins.files.find(p=>p.path===file);assert(pin,'original source pin '+file);
  const bytes=fs.readFileSync(path.join(root,file));assert.equal(sha(bytes),pin.sha256,file);assert.equal(bytes.length,pin.size);
  references.push(pin);
}
function retained(name) {
  const matches=inventory.files.filter(r=>path.basename(r.logicalPath||r.path)===name);
  assert.equal(matches.length,1,name);
  const stored=retrieval.records.find(r=>r.storedSha256===matches[0].storedSha256);
  const b=fs.readFileSync(path.join(prior,stored.local));
  assert.equal(sha(b),stored.storedSha256);assert.equal(b.length,stored.storedSize);
  const raw=z.gunzipSync(b);assert.equal(sha(raw),stored.originalSha256);assert.equal(raw.length,stored.originalSize);
  references.push({name,path:stored.local,...stored});return JSON.parse(raw);
}
const original=retained('3.json'), mouse=retained('input-server-next-mouse.json');
const state=retained('server-next-state.json');
assert.deepEqual(original.point,[.9,.86]);assert.equal(original.holdMs,150);
assert.deepEqual(mouse.rows[0].position,{x:850.5,y:769.3});
assert.deepEqual(state.canvas,{width:640,height:480,rect:{left:0,top:34,width:945,height:855}});
const source=composition.compose().source;
const {Win98Renderer}=require('../lib/renderer');
const {createCanvas}=require('../lib/canvas-compat');
const {createWindowHost,inputEventHwnd}=require('../lib/host-window');
const map=require('../lib/region-map.generated');
const RPC=require('../lib/guest-rpc');

function page(locked=true) {
  const canvas=createCanvas(640,480), listeners=new Map(), intervals=[];
  const add=(k,f)=>listeners.set(k,f);
  Object.assign(canvas,{style:{},classList:{toggle(){}},focus(){},setAttribute(){},
    getBoundingClientRect:()=>state.canvas.rect,addEventListener:add,removeEventListener(){},requestPointerLock(){}});
  const document={pointerLockElement:locked?canvas:null,body:{},documentElement:{},activeElement:canvas,
    visibilityState:'visible',getElementById:()=>null,querySelectorAll:()=>[],addEventListener:add,elementFromPoint:()=>null};
  const r=new Win98Renderer(canvas);
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const wasm={exports:{clip_cursor_active:()=>0,wnd_mouse_msg_origin_x:()=>0,wnd_mouse_msg_origin_y:()=>0,
    post_message_q:()=>1,get_focus_hwnd:()=>65543}};
  r.wasm=wasm;r.wasmMemory=memory;
  r.windows[65543]={hwnd:65543,visible:true,isChild:false,x:0,y:0,w:640,h:480,
    clientRect:{x:0,y:0,w:640,h:480},zOrder:1,wasm,wasmMemory:memory};
  r._exclusiveTransform={hwnd:65543,srcX:0,srcY:0,srcW:640,srcH:480,dstX:0,dstY:0,dstW:640,dstH:480};
  r._exclusivePresentationViewport={outputW:945,outputH:855,nativeX:0,nativeY:0,nativeW:640,nativeH:480,
    dstX:0,dstY:73.125,dstW:945,dstH:708.75};
  // Presentation/window exports are inert. Input methods remain production.
  r.refreshInputPresentation=()=>{}; r.scheduleRepaint=()=>{};r.repaint=()=>{};
  r.setMousePosition(320,240);
  const runningApps=[{name:'quake3_demo',relativeMouse:true,wine:{running:true,renderer:r}}];
  const scope={console,document,window:{addEventListener:add,removeEventListener(){},MobileKeyboard:null},
    runningApps,setInterval:f=>intervals.push(f),clearInterval(){},setTimeout,clearTimeout};
  vm.createContext(scope);
  vm.runInContext(fs.readFileSync(root+'/lib/browser-input.js','utf8'),scope);
  scope.window.browserInput.wireCanvasInput(canvas,r,{runningApps});
  document.getElementById=id=>id==='screen'?canvas:null;
  const words=new Int32Array(memory.buffer), index=map.BASE.DI_MOUSE_INPUT_STATE>>>2;
  const events=[];let anchor={...mouse.rows[0].position};
  const send=async(method,p,session)=>{
    assert.equal(method,'Input.dispatchMouseEvent');assert.equal(session,'page');events.push({...p});
    const event={clientX:p.x,clientY:p.y,movementX:Math.round(p.x-anchor.x),movementY:Math.round(p.y-anchor.y),
      button:0,buttons:p.buttons,preventDefault(){},stopPropagation(){}};
    if(p.type==='mouseMoved'){canvas.onmousemove(event);anchor={x:p.x,y:p.y};}
    if(p.type==='mousePressed')canvas.onmousedown(event);
    if(p.type==='mouseReleased')(listeners.get('mouseup')||canvas.onmouseup)(event);
    return {};
  };
  const evaluate=async expression=>vm.runInContext(expression,scope);
  const host=createWindowHost({renderer:r},{}).imports;
  const broker=RPC.createMainBroker(memory,{}, {},{});
  const hostSource=fs.readFileSync(root+'/host.js','utf8');
  const publisherStart=hostSource.indexOf('    if (self.renderer && self.guestWorker && self.guestWorker.broker &&\n        !self._rendererMousePublisher)');
  const publisherEnd=hostSource.indexOf('    if (self.renderer && self.guestWorker && !self._rendererFocusPublisher)',publisherStart);
  assert(publisherStart>=0&&publisherEnd>publisherStart);
  vm.runInNewContext(hostSource.slice(publisherStart,publisherEnd),{self:{renderer:r,guestWorker:{broker}}});
  const worker=RPC.createWorkerImports(memory,{get_mouse_position:{params:[],results:['i32']}},
    ()=>{throw Error('published pointer must not need an inert RPC answer');},{slot:0});
  return {r,scope,canvas,document,words,index,events,send,evaluate,host,worker};
}
function body(text,context) {
  const begin=text.indexOf('async function executeImpl('),end=text.indexOf('\nasync function execute(',begin);
  assert(begin>=0&&end>begin);
  vm.createContext(context);vm.runInContext(text.slice(begin,end)+';globalThis.run=executeImpl',context);
  return context.run;
}
async function run(corrected,command=original,locked=true,failDown=false) {
  const p=page(locked),saved={},terminal=[];let marked=0,captured=0;
  const latest={label:command.reviewRef,sha256:'original-capture'};
  const context={assert,root,deadline:Date.now()+60000,latest,out:'/inert-reviewed',pageSession:'page',
    checkTerminal(){if(terminal.length)throw terminal[0];},observeTerminal:e=>{if(!terminal.length)terminal.push(e);},
    fs:{readFileSync:f=>f.endsWith('-review.json')?JSON.stringify({sha256:latest.sha256,review:'personally reviewed retained PNG'}):'original-capture'},
    sha:()=>latest.sha256,save:(n,v)=>saved[n]=v,send:async(...args)=>{
      const result=await p.send(...args);
      if(failDown&&args[1].type==='mousePressed')throw Error('FIRST DOWN failure');
      return result;
    },evaluate:p.evaluate,
    wait:async()=>{},capture:async()=>captured++,trace:{span:(_,fn)=>fn()},
    chain:{admit:async(_,dispatch)=>dispatch({live:{identity:{}}})},require:n=>
      n==='./native-mouse.cjs'?require('../scratch/runs/20261108-q3-gl-readiness-gameplay/native-mouse.cjs'):require(n)};
  const execute=body(corrected?helper.integrate(source):source,context);
  await execute({...command,waitMs:0},()=>marked++);
  assert.equal(marked,1);assert.equal(captured,1);
  assert.equal(p.r._mouseButtonsMask,0);
  for(const event of p.r.inputQueue)assert.equal(inputEventHwnd(event,p.r.wasm.exports),65543);
  const hostPoint=p.host.get_mouse_position()>>>0;
  assert.equal(hostPoint,p.r.getMousePosition()>>>0,'actual host reads production renderer point');
  assert.equal(p.worker.imports.host.get_mouse_position()>>>0,hostPoint,'actual host publisher and Worker import retain the same point');
  return {counts:[p.words[p.index],p.words[p.index+1]],events:p.events,
    queue:p.r.inputQueue.map(e=>({msg:e.msg,hwnd:e.hwnd,lParam:e.lParam>>>0})),hostPoint,saved};
}

(async()=>{
  const old=await run(false);
  assert.deepEqual(old.counts,[0,0],'old repeated native coordinate supplies no relative displacement');
  assert.equal(old.events[0].type,'mouseMoved');
  const fixed=await run(true,{...original,relativeCounts:[198,2]});
  assert.deepEqual(fixed.counts,[198,2],'explicit counts reach real process-shared DirectInput');
  assert.deepEqual(fixed.events.map(e=>e.type),['mousePressed','mouseReleased'],'no absolute pre-move');
  assert(fixed.queue.some(e=>e.msg===0x200),'real relative input also reaches Win32 queue');
  assert(fixed.queue.some(e=>e.msg===0x201)&&fixed.queue.some(e=>e.msg===0x202),'real down and up reach guest queue');
  const untouched=await run(true);
  assert.deepEqual(untouched.events,old.events,'ordinary caller events unchanged');
  assert.deepEqual((await run(false,original,false)).counts,[0,0],'pending relative capture suppresses absolute motion');
  const absolute=page(false);
  absolute.scope.runningApps[0].relativeMouse=false;
  await absolute.send('Input.dispatchMouseEvent',{type:'mouseMoved',...mouse.rows[0].position,buttons:0},'page');
  assert.deepEqual([absolute.r._mouseX,absolute.r._mouseY],[576,447],'CSS floor then presentation mapping stays inside NEXT in absolute mode');
  await assert.rejects(run(true,{...original,relativeCounts:[198,2]},false),/existing canvas Pointer Lock/);
  for(const relativeCounts of [[641,0],[0,481],[NaN,1],[0,0],[1.5,2]])
    await assert.rejects(run(true,{...original,relativeCounts}),/bounded explicit relative counts/);
  const p=page();let failures=0;
  const stalled=[];
  await assert.rejects(helper.perform({command:{...original,relativeCounts:[1,1],holdMs:100},
    geometry:state.canvas.rect,evaluate:p.evaluate,session:'page',onFailure:()=>failures++,
    send:async(method,params)=>{stalled.push(params.type);if(params.type==='mousePressed')return new Promise(()=>{});return {};}}),/hold bound/);
  assert.deepEqual(stalled,['mousePressed','mouseReleased']);assert.equal(failures,1);
  // Real numbered transport makes this input failure sticky; subsequent input
  // and capture cannot be admitted. No invented successful ACK on failure.
  const directory=process.argv[2]&&path.dirname(path.resolve(process.argv[2]));
  if(directory){
    const out=fs.mkdtempSync(directory+'/terminal-');fs.mkdirSync(out+'/commands');
    const runEnd=Date.now()+120000,command={...original,relativeCounts:[1,1],waitMs:0,
      timing:{workEnd:Date.now()+20000,ackEnd:Date.now()+24000,runEnd}};
    fs.writeFileSync(out+'/execution-window.json',JSON.stringify({browserStop:new Date(runEnd).toISOString()}));
    fs.writeFileSync(out+'/commands/0.json',JSON.stringify(command));
    const transport=require('../scratch/runs/20261108-q3-gl-readiness-gameplay/transport.cjs');
    await assert.rejects(transport.consume(out,0,()=>run(true,command,true,true)),/FIRST DOWN failure/);
    const first=fs.readFileSync(out+'/first-failure.json');
    for(const action of ['click','capture'])await assert.rejects(transport.request(out,'later-'+action,
      {...command,action},1),/sticky/);
    assert.deepEqual(fs.readFileSync(out+'/first-failure.json'),first);
    assert(!fs.existsSync(out+'/reply-0.json'));
  }
  // Original QVM is inspected in memory only; never extract/copy the module.
  const report={passed:true,scope:'actual caller/DOM/renderer/host offline; guest selection UNKNOWN',
    oldFAIL:old.counts,newPASS:fixed.counts,old,fixed,references,
    historicalPointerLock:'UNKNOWN: not recorded by actual1345',
    correction:'explicit relative counts, then native buttons; review before selecting further counts'};
  if(process.argv[2])fs.writeFileSync(process.argv[2],z.gzipSync(JSON.stringify(report,null,2)),{flag:'wx'});
  console.log('PASS retained actual1345 repeat oldFAIL zero motion; corrected caller newPASS [198,2]; real DOM/renderer/shared DI/Win32/host; bounds, unlocked refusal, independent stalled-DOWN UP');
})().catch(error=>{console.error(error);process.exitCode=1;});
