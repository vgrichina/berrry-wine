'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const {createRequire} = require('node:module');
const {PNG} = require('pngjs');
const {NativeStartDriver,classifyPNG,assertReady,assertGeometry,assertAck,projectNative,sha256,PATCHES,pageAdapter,guardNativeCommands} =
  require('./stronghold-native-start-boundary-20261104.cjs');
const ROOT = path.resolve(__dirname,'../..');
const BASE = '1188e9bf57ef35bd3363fb88b7ca0da442ce696d';
const clone = o => structuredClone(o);
const opaqueBlank = () => {
  const p = new PNG({width:1200,height:900});
  for(let i=3;i<p.data.length;i+=4) p.data[i]=255;
  return PNG.sync.write(p);
};
const runs = name => path.join(ROOT,'scratch/runs/20261104-stronghold-'+name);
const prior = runs('browser-dependency-combat'), failed = runs('stable-recovery-combat');
const json = file => JSON.parse(fs.readFileSync(file));
const read = (root,name) => ({png:fs.readFileSync(path.join(root,'review',name+'.png')),
  ...json(path.join(root,'review',name+'.json'))});
const scenario = read(prior,'scenario-confirmed'), world = read(prior,'launch-drained');
const inputs = [];
function pinned(root,name,expected) {
  const cap = read(root,name);
  assert.equal(sha256(cap.png),cap.sha256,'retained PNG/receipt mismatch');
  assert.equal(classifyPNG(cap.png).scene,expected,name);
  inputs.push({path:path.relative(ROOT,path.join(root,'review',name+'.png')),sha256:cap.sha256,scene:expected});
  return cap;
}

// Read actual historical source directly from Git; no source snapshot in evidence.
const source = name => execFileSync('git',['show',BASE+':'+name],{cwd:ROOT,encoding:'utf8'});
function method(text,name) {
  const start = text.indexOf('  '+name+'('), end = text.indexOf('\n  }',start);
  assert(start >= 0 && end > start); return text.slice(start,end+4);
}
const rendererSource = source('lib/renderer.js');
const Geometry = vm.runInNewContext('(class {'+
  method(rendererSource,'_computeExclusiveTransform')+
  method(rendererSource,'_computeExclusivePresentationViewport')+'})');
const geomRenderer = new Geometry();
Object.assign(geomRenderer,{canvas:{width:800,height:600},presentationCanvas:{width:860,height:668},
  presentationScaleMode:'nearest'});
const transform = geomRenderer._computeExclusiveTransform(scenario.state.main.windows[0]);
const viewport = geomRenderer._computeExclusivePresentationViewport(transform,false,0,false,false);
const geometry = {rect:scenario.state.main.canvases.find(c=>c.id==='screen').rect,
  width:800,height:600,viewport:JSON.parse(JSON.stringify(viewport)),scaleMode:'nearest',dpr:1};

// Install the real historical input implementation on a minimal test renderer.
// This exercises its mapping and empty-poll/30ms hold, without a guest/browser.
const context = {module:{exports:{}},require:createRequire(path.join(ROOT,'lib/renderer-input.js')),
  performance:{now:()=>1000},setTimeout:()=>1,clearTimeout:()=>{}};
vm.runInNewContext(source('lib/renderer-input.js'),context);
class Input {}
context.module.exports.installInputHandlers(Input);
function renderer() {
  const r = new Input();
  Object.assign(r,{canvas:geometry,_exclusiveTransform:transform,_exclusivePresentationViewport:viewport,
    inputQueue:[],_mouseButtonsMask:0,_activeInputEvent:null,
    _publishInputQueueDepth:()=>{},_applyModifierSides:()=>{}});
  return r;
}

// Explicit model of asynchronous consumption, NOT a new game run or guest state.
// Pixels and baseline state are retained actual captures. Only the test model's
// queue, clock and transition trigger are synthetic; actual takeInput owns drain.
function fixture({unchanged=false,badAck=false,wrongPoint=false,initial=scenario.state,blank=false} = {}) {
  const r = renderer(); let tick = clone(initial.main.tick), clock = 1000, picture = scenario.png;
  const destination = blank ? opaqueBlank() : world.png;
  let upSeen = false, afterUp = 0; const events = [], consumed = [];
  r._inputNowMs = () => clock;
  const state = async () => {
    const s = clone(initial); s.main.tick = clone(tick);
    Object.assign(s.main,{inputQueue:clone(r.inputQueue),mouseButtonsMask:r._mouseButtonsMask,
      activeInput:r._activeInputEvent,lastInput:null});
    return s;
  };
  const queue = (msg,p,mask) => {
    const cx = Math.floor((p.x-geometry.rect.x)*geometry.width/geometry.rect.width);
    const cy = Math.floor((p.y-geometry.rect.y)*geometry.height/geometry.rect.height);
    const n = r._mapExclusiveInputPoint(cx,cy);
    r._mouseButtonsMask = mask;
    r.inputQueue.push({type:'mouse',hwnd:65537,msg,wParam:mask,
      mouseX:n.x+(wrongPoint?1:0),mouseY:n.y,mouseButtons:mask,lParam:(n.y<<16)|n.x});
  };
  let point;
  const io = {
    controls:()=>({keys:[],buttons:[]}),state,
    capture:async()=>({png:picture,state:await state(),geometry:clone(geometry)}),
    step:async n => {
      events.push('step');
      for(let i=0;i<n;i++) {
        clock += 16;
        const e = r.takeInput();
        if(e) {consumed.push(e.msg); if(e.msg===0x202) upSeen=true;}
        if(upSeen && ++afterUp>96 && !unchanged) picture = destination;
      }
      tick.steps += n; tick.ticks += n; tick.guestMs += n*16;
      return {...clone(tick),requested:n,ran:n,guests:[{...clone(tick),running:true,frozen:true,requested:n,ran:badAck?n-1:n}]};
    },
    move:async p=>{events.push('move');point=p;queue(0x200,p,0);},
    down:async p=>{events.push('down');assert(consumed.includes(0x200));queue(0x201,p,1);},
    up:async()=>{events.push('up');queue(0x202,point,0);},
  };
  return {io,r,events,consumed,setPNG:p=>{picture=p;}};
}
const review = async cap => ({sha256:cap.sha256,scene:cap.scene});
const driver = (f,options={}) => new NativeStartDriver(f.io,{maxSteps:1024,review,...options});
function repaint(bytes,fn) {const p=PNG.sync.read(bytes);fn(p);return PNG.sync.write(p);}

(async()=>{
  pinned(prior,'scenario-confirmed','scenario');
  pinned(prior,'opening-world','scenario');
  pinned(prior,'launch-transition','scenario');
  pinned(failed,'scenario-confirmed','scenario');
  pinned(failed,'launch-transition','scenario');
  const unchanged = pinned(failed,'world-drained','scenario');
  pinned(prior,'launch-drained','world');
  pinned(prior,'granary-panel','world');
  pinned(prior,'recruited-three','world');
  // Counterexamples: global image/toolbar change, black/loading, one world
  // region on a menu, a corrupt HUD and a fabricated scene label never unlock.
  const toolbar = repaint(scenario.png,p=>p.data.fill(40,0,1200*150*4));
  assert.equal(classifyPNG(toolbar).scene,'scenario');
  const blank = opaqueBlank();
  assert.equal(classifyPNG(blank).scene,'unknown');
  for(const spec of PATCHES.filter(p=>p.world)) {
    const partial = repaint(scenario.png,p=>{
      const w=PNG.sync.read(world.png),[x,y,width,height]=spec.box;
      for(let j=y;j<y+height;j++) for(let i=x;i<x+width;i++)
        w.data.copy(p.data,(j*p.width+i)*4,(j*w.width+i)*4,(j*w.width+i)*4+4);
    });
    assert.notEqual(classifyPNG(partial).scene,'world');
    const corrupt = repaint(world.png,p=>{const [x,y]=spec.box;p.data[(y*p.width+x)*4]^=1;});
    assert.notEqual(classifyPNG(corrupt).scene,'world');
  }
  assertReady(unchanged.state); // Drained really IS drained, but still a menu.
  for(const mutate of [s=>s.main.running=false,s=>s.main.guestWorker=false,
      s=>s.main.isolated=false,s=>s.main.tick.hosts=2,s=>s.main.tick.frozen=false,
      s=>s.main.tick.steps=0,s=>s.main.tick.tickMs=5]) {
    const bad=clone(world.state);mutate(bad);assert.throws(()=>assertReady(bad),/guest not ready/);
  }
  for(const boot of [json(path.join(prior,'recovered/browser/ready.json')),
      json(path.join(failed,'recovered/live-a/ready.json'))]) assert.throws(()=>assertReady(boot),/not ready/);
  assert.throws(()=>assertReady(read(prior,'launch-transition').state),/not drained/);
  assertGeometry(geometry);
  const p = projectNative(geometry,718,569), r = renderer();
  assert.equal(Math.round(p.x),782); assert.equal(Math.round(p.y),818);
  const native = client => r._mapExclusiveInputPoint(Math.floor((client.x-10)*800/860),Math.floor((client.y-194)*600/668));
  assert.equal(JSON.stringify(native(p)),JSON.stringify({x:718,y:569}));
  assert.equal(JSON.stringify(native({x:782,y:818})),JSON.stringify({x:718,y:569}));
  assert.equal(JSON.stringify(native({x:777,y:748})),JSON.stringify({x:713,y:504}));
  const commandLog = root=>fs.readFileSync(root,'utf8').trim().split('\n').map(JSON.parse);
  const originalCommands=commandLog(path.join(prior,'recovered/browser/commands.jsonl'));
  const failedCommands=commandLog(path.join(failed,'recovered/closed/commands.jsonl'));
  assert.deepEqual([originalCommands[195].x,originalCommands[195].y],[782,818]);
  assert.deepEqual([failedCommands[195].x,failedCommands[195].y],[777,748]);
  const originalDown=json(path.join(prior,'recovered/browser/input-198.json')).main.inputQueue.find(e=>e.msg===0x201);
  const failedDown=json(path.join(failed,'recovered/closed/input-198.json')).main.inputQueue.find(e=>e.msg===0x201);
  assert.deepEqual([originalDown.mouseX,originalDown.mouseY],[718,569]);
  assert.deepEqual([failedDown.mouseX,failedDown.mouseY],[713,504]);
  assert.throws(()=>assertGeometry({...geometry,dpr:2}),/unsupported/);
  assert.throws(()=>projectNative(geometry,900,569),/viewport/);
  assert.throws(()=>pageAdapter({},()=>{},()=>{}),/census/);
  const ack = json(path.join(prior,'recovered/browser/step-199.json'));
  assertAck(ack,10624,64);
  for(const mutate of [a=>a.ran--,a=>a.timedOut=true,a=>a.guests[0].ran--,
      a=>a.guests[0].running=false,a=>a.guests.push(clone(a.guests[0])),a=>a.steps++]) {
    const bad=clone(ack);mutate(bad);assert.throws(()=>assertAck(bad,10624,64),/ACK/);
  }
  const good = fixture(), d = driver(good);
  await assert.rejects(d.requireWorld(),/locked/);
  const success = await d.start();
  assert.equal(success.scene,'world'); assert.equal(d.phase,'world-ready');
  assert.deepEqual(good.events.filter(e=>e!=='step'),['move','down','up']);
  assert.deepEqual(good.consumed,[0x200,0x201,0x202]);
  assertReady((await d.requireWorld()).state);
  await assert.rejects(d.start(),/already attempted/);
  good.setPNG(unchanged.png);await assert.rejects(d.requireWorld(),/world entry absent/);
  for(const options of [{unchanged:true},{blank:true},{badAck:true},{wrongPoint:true}]) {
    const f=fixture(options), g=driver(f);
    await assert.rejects(g.start(),/budget|ACK|coordinates/);
    assert.equal(g.phase,'failed'); await assert.rejects(g.requireWorld(),/locked/);
    assert(f.events.filter(e=>e==='down').length<=1);
    assert.equal(f.r._mouseButtonsMask,0);
  }
  const premature=fixture({initial:json(path.join(prior,'recovered/browser/ready.json'))});
  await assert.rejects(driver(premature).start(),/not ready/);assert.deepEqual(premature.events,[]);
  const held=fixture();held.io.controls=()=>({keys:['Enter'],buttons:[]});
  await assert.rejects(driver(held).start(),/foreign held/);assert.deepEqual(held.events,[]);
  const mismatch=fixture();await assert.rejects(driver(mismatch,{review:async()=>({sha256:'wrong',scene:'world'})}).start(),/review mismatch/);
  assert.deepEqual(mismatch.events,[]);
  const stale=fixture();await assert.rejects(driver(stale,{review:async cap=>{
    stale.setPNG(toolbar);return review(cap);
  }}).start(),/changed during review/);assert.deepEqual(stale.events,[]);
  const crossed=fixture(), originalCapture=crossed.io.capture;
  crossed.io.capture=async()=>{const cap=await originalCapture();cap.state.main.tick.steps++;return cap;};
  await assert.rejects(driver(crossed).start(),/crossed execution/);assert.deepEqual(crossed.events,[]);
  const duringPress=fixture(), originalStep=duringPress.io.step;let calls=0;
  duringPress.io.step=async n=>{const a=await originalStep(n);if(++calls===2)a.timedOut=true;return a;};
  await assert.rejects(driver(duringPress).start(),/ACK/);
  assert.deepEqual(duringPress.events,['move','step','down','step','up']);
  assert.equal(duringPress.r._mouseButtonsMask,0); // cleanup balances, no more execution.
  // Wire the actual durable page adapter to a modeled page. Its evaluate body,
  // pointer target check and shot/state contract run unchanged, without CDP.
  const adapted=fixture();let lastPoint,occluded=false;
  const page = {
    evaluate:async(fn,arg)=>vm.runInNewContext('('+fn.toString()+')(arg)',{
      arg,sharedRenderer:{canvas:{width:800,height:600,getBoundingClientRect:()=>({toJSON:()=>geometry.rect})},
        _exclusivePresentationViewport:viewport,presentationScaleMode:'nearest'},devicePixelRatio:1,
      document:{elementFromPoint:()=>({id:occluded?'overlay':'screen'})},WineFrozen:{step:adapted.io.step}}),
    mouse:{move:async(x,y)=>{lastPoint={x,y};await adapted.io.move(lastPoint);},
      down:()=>adapted.io.down(lastPoint),up:()=>adapted.io.up()},
  };
  const adapter=pageAdapter(page,adapted.io.state,async()=>adapted.io.capture(),adapted.io.controls);
  const wired=new NativeStartDriver(adapter,{review,maxSteps:1024});
  assert.equal((await wired.start()).scene,'world');
  occluded=true;await assert.rejects(adapter.move(projectNative(geometry,718,569)),/occluded/);
  const guardedFixture=fixture();let forwarded=0;
  const guardedDriver=driver(guardedFixture),dispatch=guardNativeCommands(guardedDriver,async()=>++forwarded);
  await assert.rejects(dispatch({action:'click'}),/locked/);assert.equal(forwarded,0);
  assert.equal((await dispatch({action:'native-start'})).scene,'world');
  await dispatch({action:'mousemove'});assert.equal(forwarded,1);
  guardedFixture.setPNG(unchanged.png);await assert.rejects(dispatch({action:'mousedown'}),/world entry absent/);
  await assert.rejects(dispatch({action:'step',n:64}),/first native/);
  await dispatch({action:'state'});assert.equal(forwarded,2);
  let release,entered;
  const waiting=new Promise(r=>{entered=r;}); const gate=new Promise(r=>{release=r;});
  const pending=fixture(), concurrent=driver(pending,{review:async cap=>{entered();await gate;return review(cap);}});
  const active=concurrent.start();await waiting;
  assert.deepEqual(pending.events,[]);await assert.rejects(concurrent.start(),/already attempted/);
  await assert.rejects(concurrent.requireWorld(),/locked/);release();await active;
  console.log(JSON.stringify({pass:true,sourceGitSHA:BASE,retainedCaptures:inputs,
    originalHandNative:{x:718,y:569},computedClient:p,
    modeledNativeTransition:success,negativeCases:['premature-ready','unchanged-scene','tooltip-and-toolbar',
      'partial-world','corrupt-world','blank-loading','incomplete-ACK','wrong-coordinates',
      'foreign-held-key','unreviewed','stale-review','capture-crossed-execution','held-failure-cleanup',
      'occluded-canvas','concurrent-start','world-controls-before-entry'],
    runtimeExecuted:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
