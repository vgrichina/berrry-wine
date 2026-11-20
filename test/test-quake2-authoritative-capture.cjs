'use strict';
// Guard-path controls. Exports/physical trust are modeled here; actual API
// publication and native lifecycle controls are retained separately.
const assert=require('node:assert/strict'),cp=require('node:child_process'),Module=require('node:module');
const {createBrowserNativeInput}=require('../lib/browser-native-input.js');
const {createQuake2Session}=require('../tools/quake2-native-consumption-input.cjs');
function fixture(factory=createBrowserNativeInput){
  const scene=[1,1000,65537,65537,0,65537,7,0,7,0],words=[2,65537,7,0,1,1000];
  let live=true,generation=7n,thread=1,event;
  const instance={exports:{capture_publication_word:i=>words[i],get_authoritative_capture_hwnd:()=>live?words[1]:0,
    wnd_lookup_live:()=>+live,wnd_lookup_generation:()=>generation,get_window_thread:()=>thread}};
  const r={canvas:{},inputQueue:[],windows:{},buttons:0,
    handleMouseDown(x,y){this.buttons=1;this.inputQueue.push({hwnd:65537,msg:513,wParam:1,lParam:y<<16|x});},
    handleMouseUp(){this.buttons=0;},handleKeyDown(){},handleKeyUp(){},peekKeyDownState(){return this.buttons;}};
  const wine={instance,processId:1000,running:true,_requireAuthoritativeCapture:true,_processObject:{},_wasmModule:{},memory:{buffer:new ArrayBuffer(64)},
    renderer:r,hostCtx:{getGlGpsBridge:()=>gps},guestWorker:{link:{slot:0,worker:{},endpointIdentity:1}}};
  const gps={endpoint:{},presenter:{layer:{canvas:{}}}};
  r.windows[65537]={visible:true,processId:1000,wasm:instance};
  const guard=factory(wine,{trusted:()=>true});wine._browserNativeInput=guard;
  const observe=()=>guard.withActor(0,'check_input',()=>{guard.observe(scene);guard.sweep();});
  observe();
  const bind=()=>guard.bind();
  const prepare=owner=>guard.prepare({owner,reviewed:true,reviewedAt:Date.now(),imageSHA256:'a'.repeat(64),nonce:'one',kind:'mouse',code:1,button:0});
  const down=()=>{r.handleMouseDown(3,4,0);event=r.inputQueue.shift();return event;};
  const consume=()=>guard.withActor(0,'check_input',()=>{
    const token=guard.dequeued(event);[65537,513,1,4<<16|3].forEach((n,i)=>new DataView(wine.memory.buffer).setUint32(i*4,n,true));
    return guard.withActor(0,'input_consumed',()=>guard.consumed(token,1,0,2,1,[...scene,0]));
  });
  return {wine,scene,words,guard,r,observe,bind,prepare,down,consume,dead:()=>live=false,
    reuse:()=>generation++,thread:v=>thread=v};
}
const old=new Module(__filename,module);
old._compile(cp.execFileSync('git',['show','7df3bc954f0b898aeed7e062bb10acf89e40f5c8:lib/browser-native-input.js'],{encoding:'utf8'}),__filename);
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
test('old zero-capture guard refuses valid captured owner; current authoritative guard binds',()=>{
  const legacy=new Module(__filename,module);
  legacy._compile(cp.execFileSync('git',['show','f6962ba5b1cf2829a66f5cc4d80b293c30719b37:lib/browser-native-input.js'],{encoding:'utf8'}),__filename);
  const before=fixture(legacy.exports.createBrowserNativeInput);assert(!before.guard.snapshot().ready);
  const after=fixture();assert(after.guard.snapshot().ready);assert(after.bind().owner);
});
test('old fail/new pass: same HWND with foreign actor must not bind',()=>{
  const before=fixture(old.exports.createBrowserNativeInput);before.words[4]=2;
  assert(before.guard.snapshot().ready,'pre-repair guard admits same-HWND wrong actor');
  const after=fixture();after.words[4]=2;assert(!after.guard.snapshot().ready);assert.throws(after.bind,/unavailable/);
});
test('valid shared captured owner reaches exact native MSG consumption',()=>{
  const f=fixture(),b=f.bind();assert.equal(f.prepare(b.owner).state,'PREPARED');
  assert(f.down());assert.equal(f.consume(),1);assert(f.guard.status('one').consumed);
  f.r.handleMouseUp();assert.equal(f.r.buttons,0);
});
for(const fault of ['foreign','wrong-tid','wrong-pid','old-generation','destroyed','reused','wrong-thread','odd','unknown','focus'])
test('refuse '+fault+' before binding',()=>{
  const f=fixture();
  if(fault==='foreign')f.words[1]++;
  if(fault==='wrong-tid')f.words[4]++;
  if(fault==='wrong-pid')f.words[5]++;
  if(fault==='old-generation')f.words[2]++;
  if(fault==='destroyed')f.dead();
  if(fault==='reused')f.reuse();
  if(fault==='wrong-thread')f.thread(2);
  if(fault==='odd')f.words[0]++;
  if(fault==='unknown')delete f.wine.instance.exports.capture_publication_word;
  if(fault==='focus'){f.scene[3]++;f.observe();}
  assert(!f.guard.snapshot().ready);assert.throws(f.bind,/unavailable/);
});
for(const fault of ['release','transfer-return','reuse','actor','unknown'])test('pending ticket permanently fences '+fault+'; UP survives',()=>{
  const f=fixture(),b=f.bind();f.prepare(b.owner);assert(f.down());
  if(fault==='release')f.words.splice(0,6,4,0,0,0,0,0);
  if(fault==='transfer-return')f.words[0]+=4;
  if(fault==='reuse')f.reuse();
  if(fault==='actor')f.wine.guestWorker.link.endpointIdentity++;
  if(fault==='unknown')delete f.wine.instance.exports.capture_publication_word;
  assert.equal(f.consume(),0);assert.equal(f.guard.status('one').state,'CANCELLED');
  f.words.splice(0,6,2,65537,7,0,1,1000);f.observe();assert(!f.guard.snapshot().ready);
  f.r.handleMouseUp();assert.equal(f.r.buttons,0);
});
test('zero actor-local GetCapture cannot hide foreign shared capture',()=>{
  const f=fixture();f.scene[5]=0;f.words[1]++;f.observe();assert(!f.guard.snapshot().ready);
});
test('no capture does not permit stale main HWND generation or destruction',()=>{
  for(const fault of ['reused','destroyed']){
    const f=fixture();f.scene[5]=0;f.words.splice(0,6,4,0,0,0,0,0);f.observe();assert(f.guard.snapshot().ready);
    if(fault==='reused')f.reuse();else f.dead();assert(!f.guard.snapshot().ready);assert.throws(f.bind,/unavailable/);
  }
});
test('incoherent publication serial refuses instead of retrying or guessing zero',()=>{
  const f=fixture();let serial=2;
  f.wine.instance.exports.capture_publication_word=i=>i===0?(serial+=2):f.words[i];
  assert(!f.guard.snapshot().ready);assert.throws(f.bind,/unavailable/);
});
test('Quake II session refuses absent authoritative exports before any helper',()=>{
  const f=fixture();delete f.wine.instance.exports.capture_publication_word;
  const session=createQuake2Session({},f.wine,{inspectNativeRoute:()=>{throw Error('must not inspect');}});
  assert.throws(()=>session.observe(),/authoritative capture exports/);
  assert.throws(()=>session.observe(),/permanently closed/);
});
console.log(JSON.stringify({passed,scope:'JS guard controls; no native or combat claim'}));
