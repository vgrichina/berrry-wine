#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { createAudioHost } = require('../lib/host-audio');

// A controlled Web Audio boundary lets us prove the real host graph's
// scheduling/cleanup without claiming audible browser or OS-device evidence.
function audioContext() {
 const ac = { state:'running', sampleRate:96000, currentTime:2, destination:{}, nodes:[] };
 ac.createGain=()=>({gain:{value:1},connect(to){this.to=to;},disconnect(){this.disconnected=true;}});
 ac.createOscillator=()=>{
  const n={frequency:{value:0},connect(to){this.to=to;},disconnect(){this.disconnected=true;},
   start(t){this.startAt=t;},stop(t){this.stops??=[];this.stops.push(t);}};
  ac.nodes.push(n); return n;
 };
 return ac;
}
function fixture(ac=audioContext(), sharedAudio={}) {
 const ctx={getMemory:()=>new ArrayBuffer(4096),sharedAudio};
 const host=createAudioHost(ctx,{}).imports;
 host.beep_process_begin(1,0);host.beep_thread_begin(1,2,0,1,0);
 const start=host.beep_start;
 host.beep_start=(f,d,tid=1,lo=2,hi=0)=>start(f,d,tid,lo,hi);
 ctx._voices._ensureCtx=()=>ac;
 return {ctx,host,ac,sharedAudio};
}
function cases() {
 const {ctx,host:h,ac,sharedAudio}=fixture();
 const id=h.beep_start(750,300),n=ac.nodes[0];assert(id>0);
 assert.equal(n.frequency.value,750);assert.equal(n.type,'sine');
 assert.equal(n.startAt,2);assert.equal(n.stops[0],2.3);
 assert(n.to.to,'oscillator connects through gain to actual output bus');
 assert.equal(h.beep_status(id,1),0,'release cannot orphan pending tone');
 ac.currentTime=2.299;assert.equal(h.beep_status(id,0),0);
 ac.currentTime=2.3;n.onended();assert.equal(h.beep_status(id,0),1);
 assert(n.disconnected&&n.to.disconnected);assert.equal(n.onended,null);
 assert.equal(h.beep_status(id,1),1);assert.equal(h.beep_status(id,0),-6);
 const next=h.beep_start(1000,10);assert(next>id);ac.currentTime+=0.01;
 assert.equal(h.beep_status(next,1),1,'clock completion does not depend on JS event delivery');
 const cancel=h.beep_start(500,100),late=ac.nodes.at(-1).onended;
 assert.equal(h.beep_cancel(cancel),-995);late();assert.equal(h.beep_status(cancel,1),-995);
 assert.equal(h.beep_cancel(cancel),-6);
 const interrupted=h.beep_start(500,100);ac.nodes.at(-1).onended();
 assert.equal(h.beep_status(interrupted,1),-995,'early ended is aborted, never success');
 const suspended=h.beep_start(500,100);ac.state='suspended';
 assert.equal(h.beep_status(suspended,1),-995);assert.equal(h.beep_start(500,100),-50);
 ac.state='running';const closed=h.beep_start(500,100);ac.state='closed';
 assert.equal(h.beep_status(closed,1),-995);ac.state='running';
 for(const f of [37,32767]){const bound=h.beep_start(f,60000);assert(bound>0);h.beep_cancel(bound);assert.equal(h.beep_status(bound,1),-995);}
 const before=ac.nodes.length;
 for(const f of [0,36,32768,-1])assert.equal(h.beep_start(f,100),-87);
 assert.equal(h.beep_start(500,0),-87);assert.equal(h.beep_start(500,60001),-50);
 assert.equal(h.beep_start(500,-1),-50);assert.equal(ac.nodes.length,before);
 ac.sampleRate=44100;assert.equal(h.beep_start(32767,100),-50);ac.sampleRate=96000;
 const sibling=fixture(ac,sharedAudio).host;
 const shared=h.beep_start(500,100);assert.equal(sibling.beep_status(shared,0),0);
 assert.equal(sibling.beep_cancel(shared),-995);assert.equal(h.beep_status(shared,1),-995);
 const ids=Array.from({length:64},()=>h.beep_start(500,100));assert(ids.every(x=>x>0));
 assert.equal(h.beep_start(500,100),-8);
 for(const token of ids){h.beep_cancel(token);assert.equal(h.beep_status(token,1),-995);}
 const stop=h.beep_start(500,100);ctx.stopAudio();assert.equal(h.beep_status(stop,1),-6);
 assert.equal(h.beep_start(500,100),-995);
 const unavailable=fixture(null);assert.equal(unavailable.host.beep_start(500,100),-50);
 unavailable.ctx.audioTap=()=>({active:true,pcm(){throw Error('recorder must not become output');}});
 assert.equal(unavailable.host.beep_start(500,100),-50,'recording never changes availability');
 const failed=fixture();failed.ac.createOscillator=()=>{throw Error('device failure');};
 assert.equal(failed.host.beep_start(500,100),-31);assert.equal(failed.sharedAudio.beepTones.size,0);
 const partial=fixture();partial.ac.createGain=()=>{throw Error('gain failure');};
 assert.equal(partial.host.beep_start(500,100),-31);assert(partial.ac.nodes[0].disconnected);
 assert.equal(partial.sharedAudio.beepTones.size,0);
 const exhausted=fixture();exhausted.sharedAudio.beepNext=0x80000000;
 assert.equal(exhausted.host.beep_start(500,100),-8);assert.equal(exhausted.ac.nodes.length,0);
}
function idleLeaseCases() {
 const fs=require('node:fs'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'..','host.js'),'utf8');
 const grab=name=>{
  const match=source.match(new RegExp(`\\n  ${name}\\(\\)\\s*\\{[\\s\\S]*?\\n  \\}`));
  assert(match,`actual host ${name} method exists`);return match[0].trim();
 };
 const threshold=source.match(/static AUDIO_IDLE_SUSPEND_MS = (\d+);/);
 assert(threshold,'actual host idle threshold exists');
 const idleMs=Number(threshold[1]);
 let tick,cleared;
 const document={hidden:false};
 const methods=new Function('WineAssembly','setInterval','clearInterval','document',`return {
  ${['_isAudioHot','_audioNeedsContext','_startAudioIdleWatch','_stopAudioIdleWatch','_maybePauseForHidden'].map(grab).join(',\n')}
 };`)({AUDIO_IDLE_SUSPEND_MS:idleMs},(fn,ms)=>{assert.equal(ms,2000);tick=fn;return 123;},id=>{cleared=id;},document);
 // Use production token creation and lifecycle, with a controlled output clock
 // and timer boundary. These are the real host methods, not a copied policy.
 const setup=()=>{
  const f=fixture();let now=1000;
  f.ac.suspends=0;f.ac.suspend=()=>{f.ac.suspends++;f.ac.state='suspended';};
  const shell={...methods,_sharedAudio:f.sharedAudio,_audioCtx:f.ac,
   hostCtx:f.ctx,_audioSchedulerNow:()=>now,_isNetworked:()=>false,
   _cancelDelayedStep(){this.canceledStep=true;},running:true};
  shell._startAudioIdleWatch();
  const fire=()=>tick();
  const advance=ms=>{now+=ms;shell._audioCtx.currentTime+=ms/1000;fire();};
  const expectIdle=label=>{
   assert.equal(shell._audioNeedsContext(),false,label+' releases predicate');
   fire();advance(idleMs-1);assert.equal(shell._audioCtx.state,'running',label+' gets idle grace');
   advance(1);assert.equal(shell._audioCtx.state,'suspended',label+' permits watcher suspension');
  };
  return {...f,shell,fire,advance,expectIdle};
 };
 {
  const f=setup(),{shell,host:h,ac,sharedAudio}=f;
  f.fire();assert(shell._audioIdleSince,'ordinary idle countdown starts');
  const id=h.beep_start(750,60000);assert(id>0);
  assert.equal(sharedAudio.beepTones.get(id).ac,shell._audioCtx);
  f.fire();assert.equal(shell._audioIdleSince,0,'accepted Beep clears a preceding idle countdown');
  for(let elapsed=2000;elapsed<60000;elapsed+=2000){
   f.advance(2000);
   assert.equal(shell._audioNeedsContext(),true,'long Beep retains context beyond idle threshold');
   assert.equal(shell._isAudioHot(),false,'Beep does not select PCM scheduling slices');
   assert.equal(h.beep_status(id,0),0,'watcher leaves accepted output pending');
   assert.equal(ac.suspends,0);
  }
  document.hidden=true;
  assert.equal(shell._maybePauseForHidden(),true,'Beep retains existing background-pause policy');
  assert(shell.canceledStep);document.hidden=false;
  f.advance(2000);
  assert.equal(ac.currentTime,sharedAudio.beepTones.get(id).end);
  assert.equal(sharedAudio.beepTones.get(id).status,0,'expiry test delays ended and status delivery');
  f.expectIdle('expired pending token');
  assert.equal(sharedAudio.beepTones.get(id).status,0,'lease predicate never completes a token');
 }
 for(const terminal of ['ended','canceled','retired','shutdown']){
  const f=setup(),id=f.host.beep_start(750,60000);assert(id>0);f.fire();
  if(terminal==='ended'){
   f.ac.currentTime=f.sharedAudio.beepTones.get(id).end;f.ac.nodes.at(-1).onended();
   assert.equal(f.sharedAudio.beepTones.get(id).status,1,'ended record retained until release');
  }else if(terminal==='canceled'){
   assert.equal(f.host.beep_cancel(id),-995);
   assert.equal(f.sharedAudio.beepTones.get(id).status,-995,'canceled record retained until release');
  }else if(terminal==='retired')f.host.beep_retire_thread(1,2,0);
  else f.host.beep_shutdown();
  f.expectIdle(terminal+' token');
 }
 {
  const f=setup(),old=f.host.beep_start(750,60000);assert(old>0);f.fire();
  const replacement=audioContext();replacement.suspend=()=>{replacement.state='suspended';};
  f.shell._audioCtx=replacement;f.ctx._voices._ensureCtx=()=>replacement;
  // Exercise the hostCtx shared-state fallback too; records come from real starts.
  delete f.shell._sharedAudio;
  assert.equal(f.shell._audioNeedsContext(),false,'old-context pending token cannot lease replacement');
  const current=f.host.beep_start(800,60000);assert(current>old);f.fire();
  f.advance(idleMs+2000);assert.equal(replacement.state,'running','current tone leases replacement');
  assert.equal(f.host.beep_cancel(current),-995);
  assert.equal(f.sharedAudio.beepTones.get(old).status,0,'old context still has pending output');
  f.expectIdle('replacement with only old pending and current canceled records');
 }
 {
  const f=setup(),first=f.host.beep_start(750,60000),second=f.host.beep_start(800,60000);
  assert(first>0&&second>first);f.fire();f.host.beep_cancel(first);
  f.advance(idleMs+2000);assert.equal(f.ac.state,'running','another pending tone retains lease');
  f.host.beep_cancel(second);f.expectIdle('last pending tone canceled');
 }
 {
  const f=setup(),id=f.host.beep_start(750,60000);assert(id>0);
  for(const state of ['suspended','closed']){
   f.ac.state=state;f.fire();assert.equal(f.shell._audioNeedsContext(),false,state+' context is not leased');
   assert.equal(f.shell._audioIdleSince,0);assert.equal(f.ac.suspends,0);
  }
  assert.equal(f.host.beep_status(id,0),-995,'external interruption still aborts output');
  f.ac.state='running';f.sharedAudio.waveOutHotUntilMs=100000;
  assert.equal(f.shell._isAudioHot(),true,'PCM still selects short scheduling slices');
  document.hidden=true;assert.equal(f.shell._maybePauseForHidden(),false,'PCM still prevents background pause');
  document.hidden=false;
  f.shell._stopAudioIdleWatch();assert.equal(cleared,123);assert.equal(f.shell._audioIdleTimer,0);
 }
 console.log('Beep actual host idle predicate/watcher, long lease, terminal/replacement controls and background/PCM policy: PASS');
}
if(require.main===module){cases();console.log('Beep output token scheduling, completion, cancellation and failure: PASS');idleLeaseCases();}
module.exports={audioContext,cases,idleLeaseCases};
