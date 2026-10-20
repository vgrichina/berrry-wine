#!/usr/bin/env node
'use strict';
// Run from repository root. Exact git blobs, no working production overlays.
// Fixture extraction adapted from fa1f3097; scenarios and oracles below independently authored.
const cp = require('node:child_process'), vm = require('node:vm');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const candidate = process.env.SOURCE_REV || '3bfe91664271230863c7cb586eb2ae0a003af31f';
const base = 'ee129daaf02d3398442c34d42e8aa67fb618771e';
const seals = {}, checks = [], observations = [];
function blob(rev, path) {
  let s = cp.execFileSync('git', ['show', `${rev}:${path}`],
    {encoding:'utf8',maxBuffer:8e6,stdio:['ignore','pipe','pipe']});
  seals[`${rev}:${path}`] = crypto.createHash('sha256').update(s).digest('hex');
  if(process.env.MUTATION === "mutable-broadcast") s=s.replace("this.endpoints.slice()", "this.endpoints");
  if(process.env.MUTATION === "close-caller") s=s.replace("if (childWire) childWire.close();", "if (childWire) self.vlanWire.close();");
  if(process.env.MUTATION === "retain-child") s=s.replace("if (childWire) childWire.close();", "");
  return s;
}
function cut(s,a,b) {
  const i=s.indexOf(a),j=s.indexOf(b,i+a.length);
  assert(i>=0&&j>i,a);return s.slice(i,j);
}
function method(s,n) {return cut(s,`  ${n}(`,'\n  }')+'\n  }';}
const quiet={log(){},warn(){},error(){}};
function fixture(rev=candidate) {
  const host=blob(rev,'host.js'), shell=blob(rev,'lib/browser-shell.js');
  const vlan=blob(rev,'lib/vlan-wire.js'), tm=blob(rev,'lib/thread-manager.js');
  // The complete production wire module, including real queue limits.
  const module={exports:{}};
  vm.runInNewContext(vlan,{module,exports:module.exports,require,console:quiet});
  const Vlan=module.exports;
  const C=vm.runInNewContext(`(class {
    ${['_processHandleEntry','_duplicateProcessHandle','stop','joinVlan',
      '_releaseGuestMemory','_deleteOwnSurfacePresentations'].map(n=>method(host,n)).join('\n')}
  })`,{WineAssembly:{parseRoomAddress:s=>s.split('.').reduce((n,b)=>(n*256+Number(b))>>>0,0)}});
  const T=vm.runInNewContext(`(class {
    ${['_getSyncIdx','_resolveThreadHandle','waitSingle'].map(n=>method(tm,n)).join('\n')}
  })`);
  function make() {
    const p=new C();
    Object.assign(p,{processId:1,memory:new WebAssembly.Memory({initial:1}),
      _processAliases:new Map(),_nextProcessAlias:1,spawnProcesses:true,
      threadManager:{},readString:()=> 'C:\\DXSETUP.EXE',callGuest:async()=>1,
      _helpCtx:{vfs:{files:new Map([['c:\\child.exe',{}]]),getCurrentDirectory:()=> 'C:\\',
        _normPath:s=>s.toLowerCase(),_resolvePath:s=>s.toLowerCase(),
        mergeChildFrom:()=>{throw Error('pipe launch must not merge');}}}});
    p._processObject={wine:p,exited:false,exitCode:259};
    // Only unrelated renderer/audio/timer/worker cleanup is replaced.
    for(const n of ['_cancelPresentFrame','_cancelDelayedStep','_cancelVblankWait',
      '_frozenUnregister','_removeVisibilityPause','_removeInputWake',
      '_stopAudioIdleWatch','_stopGuestRuntime','_stopPerfCounterPoll','_cleanupAudio'])
      p[n]=()=>{};
    return p;
  }
  const p=make(), accepted=[], tasks=[];
  let preSkip=()=>{};
  const env={Map,String,appendDebugLog:()=>preSkip(),queueMicrotask:f=>tasks.push(f),
    lastExitedVfs:null,lastExitedRunSliceAppKey:null,apps:{},
    snapshotVfs:v=>v,installedAppEntry:(...a)=>a,launchInFlight:false,
    SINGLE_APP:()=>false,runningApps:[],setTimeout:f=>tasks.push(f),
    queuePendingLaunch:()=>assert.fail('unexpected queue'),
    api:{launchApp:(entry,opts)=>accepted.push(opts)}};
  const launch=vm.runInNewContext(cut(shell,'    function launchVfsExe(',
    '\n    // A program that lives only')+'\nlaunchVfsExe;',env);
  let last,launchMode;
  const window={VlanWire:Vlan,wineShell:{launchVfsExe:(file,parent,dir,args,opts)=>{
    last=opts;
    if(launchMode==="false") return false;
    if(launchMode==="throw") throw Error("launch throws");
    return launch(file,parent,dir,args,opts);
  }}};
  const h=vm.runInNewContext(`(self=>{const h={};
    ${cut(host,'    h.process_spawn =','    h.shell_execute =')}
    return h;})`,{window,console:quiet,Map,DataView,WineAssembly:{},
    parseShellLaunchCommand:s=>({file:s,params:''}),resolveShellLaunchPath:s=>s})(p);
  function spawn(file='C:\\DXSETUP.EXE',pipes=1,ip=0x0a000002) {
    p.readString=()=>file;
    const pid=h.process_spawn(1,0,ip,0,pipes);
    return {pid,handle:0xe40000|pid,rec:p._children.get(pid),opts:last,ip};
  }
  function duplicate(handle) {
    const v=new DataView(p.memory.buffer);
    [-1,handle,-1,128,0,0,2].forEach((x,i)=>v.setUint32(260+4*i,x,true));
    return h.process_ctl(3,256,0);
  }
  function wait(handle) {
    const t=new T();
    Object.assign(t,{processCtl:h.process_ctl,memory:p.memory,threads:new Map(),
      _pendingThreads:[],_threadHandleAliases:new Map(),_syncHandleToIdx:new Map()});
    return t.waitSingle(handle,0);
  }
  function fail(opts,child=null) {
    const source=cut(shell,'      const notifyLaunchExit =','      pendingLaunchFail = failLaunch;');
    return vm.runInNewContext(`((launchOpts,createdWine)=>{
      let launchFailed=false,pendingLaunchFail=null;
      const sel='fixture',ctx={retained:new Set()},bootDone=()=>{},showCrashReport=()=>{};
      ${source}return failLaunch;
    })`,{document:{getElementById:()=>({textContent:''})},console:quiet})(opts,child);
  }
  function bindStopped(wine,launchOpts) {
    vm.runInNewContext(cut(shell,'      wine.onStopped = stoppedWine => {',
      '\n      wine.onFatal ='),{wine,launchOpts,sel:'fixture',
      clearAppUrl(){},clearRoomUrl(){},clearLanNotices(){},clearInterval(){},
      stopBrowserOverlay(){},unregisterRunningApp(){},
      document:{querySelector:()=>null}});
  }
  return {p,h,spawn,duplicate,wait,make,fail,bindStopped,accepted,tasks,
    onSkip:f=>{preSkip=f;}, setLaunchMode:m=>{launchMode=m;}, getOpts:()=>last};
}
function frame() {
  const b=new Uint8Array(28),d=new DataView(b.buffer);
  d.setUint32(0,0x314e4c56,true);d.setUint32(4,3,true);
  d.setUint32(8,0x0a000001,true);d.setUint32(16,0x0a000003,true);
  return b;
}
function eof(f,ip,count=1) {
  assert.equal(f.p.vlanWire.pending,count);
  for(let i=0;i<count;i++){
    const bytes=f.p.vlanWire.peek(),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    assert.equal(v.getUint32(4,true),7);assert.equal(v.getUint32(8,true),ip);
    f.p.vlanWire.commit();
  }
}
function acceptance(f,childWire) {
  const seg=f.p._childSegment;
  assert(seg.endpoints.includes(f.p.vlanWire),'caller pipe endpoint must remain attached');
  assert(!seg.endpoints.includes(childWire),'completed no-child launch must release its unused endpoint');
}
const failures=[];
async function group(name,fn){try{await fn();checks.push(name);}catch(e){failures.push({name,error:e.stack});}}
async function live(f,ip){const r=f.spawn('C:\\child.exe',1,ip),c=f.make();c.joinVlan(r.opts.lanLink.wire,'10.0.0.'+(ip&255));f.bindStopped(c,r.opts);await r.opts.beforeRun(c);return {r,c,w:c.vlanWire};}
function drain(w){const out=[];while(w.pending){out.push(w.peek());w.commit();}return out;}
function data(n,src=0x0a000001,dst=0x0a000003){const b=new Uint8Array(32),d=new DataView(b.buffer);b.set(frame());d.setUint32(8,src,true);d.setUint32(16,dst,true);d.setUint32(28,n,true);return b;}
function checkData(w,n){const b=drain(w);assert.equal(b.length,1,'one broadcast delivery to live recipient');assert.equal(new DataView(b[0].buffer).getUint32(28,true),n);}
function retired(f,w){acceptance(f,w);assert.equal(w.pending,0);assert.equal(w.segment,null);assert.equal(w.onFrame,null);assert.equal(w.onDeliver,null);assert.equal(w.send(data(0)),false);w.deliver(data(0));w.peerGone(1);w.close();assert.equal(w.pending,0);}
async function run(){
for(const mode of ['skip','fail-before','fail-child','cancel-before','cancel-during','normal','terminate','false','throw'])await group('repeated '+mode+' with two live siblings',async()=>{
 const f=fixture(),a=await live(f,0x0a000003),b=await live(f,0x0a000004),dead=[];
 const seg=f.p._childSegment;
 for(let i=0;i<24;i++){
  const ip=0x0a000010+i;
  if(mode==='false'||mode==='throw') f.setLaunchMode(mode);
  let r;
  if(mode==='throw'){assert.throws(()=>f.spawn('C:\\child.exe',1,ip),/launch throws/);r={opts:f.getOpts()};}
  else r=f.spawn(mode==='skip'?'C:\\DXSETUP.EXE':'C:\\child.exe',1,ip);
  const w=r.opts.lanLink.wire;dead.push(w);let c;
  if(!['skip','false','throw'].includes(mode)){
   assert(seg.endpoints.includes(w),'pending child must stay attached');
   f.p.vlanWire.send(data(i));checkData(a.w,i);checkData(b.w,i);assert.equal(w.pending,1);
   w.onDeliver=()=>{};
   if(mode==='fail-before'){const fail=f.fail(r.opts);fail(Error('boot'));fail(Error('boot repeated'));}
   else if(mode==='cancel-before') {const alias=f.duplicate(r.handle);f.h.process_ctl(7,r.handle,0);assert.equal(f.h.process_ctl(5,alias,77),1);c=f.make();c.joinVlan(w,'10.0.0.16');f.bindStopped(c,r.opts);await assert.rejects(r.opts.beforeRun(c),/before attachment/);f.fail(r.opts,c)(Error('cancel'));f.h.process_ctl(7,alias,0);}
   else {c=f.make();c.joinVlan(w,'10.0.0.16');f.bindStopped(c,r.opts);
    if(mode==='cancel-during'){let resolve;c.callGuest=()=>new Promise(r=>{resolve=r;});const boot=r.opts.beforeRun(c);assert.equal(f.h.process_ctl(5,r.handle,78),1);resolve(1);await assert.rejects(boot,/during attachment/);f.fail(r.opts,c)(Error('cancel'));}
    else {await r.opts.beforeRun(c);if(mode==='normal'){c._exitCode=19;c.stop();}else if(mode==='terminate'){assert.equal(f.h.process_ctl(5,r.handle,20),1);}else {const fail=f.fail(r.opts,c);fail(Error('boot'));fail(Error('again'));}}
   }
  }
  eof(f,ip);retired(f,w);r.opts.onExit(c||null);if(c){c.stop();c._releaseGuestMemory();assert.equal(c.memory,null);}assert.equal(f.p.vlanWire.pending,0,'EOF remains once after all duplicate cleanups');
  if(r.rec){assert.equal(r.rec.object.pending,false);assert.equal(r.rec.object.exited,true);assert.equal(r.rec.object.wine,null);assert.equal(r.rec.object.complete,undefined);assert.equal(r.rec.exitCode,({skip:0,'fail-before':1,'fail-child':1,'cancel-before':77,'cancel-during':78,normal:19,terminate:20})[mode]);f.h.process_ctl(7,r.handle,0);}
  f.setLaunchMode(null);assert.deepEqual(Array.from(seg.endpoints),[f.p.vlanWire,a.w,b.w]);
 }
 // Wires use their real inbox. Every live receiver drains on each turn, as a
 // running guest would; no onFrame shortcut hides a dead recipient's overflow.
 for(let i=0;i<20001;i++){const sender=i%2?a.w:f.p.vlanWire;sender.send(data(i));for(const w of [f.p.vlanWire,a.w,b.w])if(w!==sender)checkData(w,i);}
 for(const w of dead)assert.equal(w.pending,0);
 f.h.process_ctl(7,a.r.handle,0);f.p.stop();assert.deepEqual(Array.from(seg.endpoints),[f.p.vlanWire,a.w,b.w]);
 b.w.send(data(42));checkData(f.p.vlanWire,42);checkData(a.w,42);
 a.c.stop();eof(f,a.r.ip);b.c.stop();eof(f,b.r.ip);assert.deepEqual(Array.from(seg.endpoints),[f.p.vlanWire]);
 observations.push({mode,retired:dead.length,laterFrames:20001,liveRecipients:3});
});
await group('production exit reentrant inside recipient delivery preserves later sibling',async()=>{
 const f=fixture(),a=await live(f,0x0a000003),b=await live(f,0x0a000004);
 a.w.onDeliver=()=>a.c.stop();f.p.vlanWire.send(data(57));checkData(b.w,57);eof(f,a.r.ip);retired(f,a.w);
 // Both callback reference and queued frame are gone; repeated stop cannot EOF twice.
 a.c.stop();assert.equal(f.p.vlanWire.pending,0);b.c.stop();eof(f,b.r.ip);
});
await group('transport reentrant deletion permutations and nested broadcasts',async()=>{
 const module={exports:{}};vm.runInNewContext(blob(candidate,'lib/vlan-wire.js'),{module,exports:module.exports,require,console:quiet});const {LoopbackSegment}=module.exports;
 for(const target of ['self','previous','next','sender','all'])for(const hook of ['onFrame','onDeliver']){
  const seg=new LoopbackSegment(),[a,b,c,d]=[0,1,2,3].map(()=>seg.attach());const wires={self:c,previous:b,next:d,sender:a};
  c[hook]=()=>{if(target==='all')for(const w of [a,b,c,d])w.close();else wires[target].close();};
  a.send(data(9));for(const w of [a,b,c,d]){if(!w.segment){assert.equal(w.pending,0);w.close();assert.equal(w.send(data(1)),false);}}
  if(target!=='all'&&target!=='next')checkData(d,9);
  if(target!=='all'&&target!=='previous')checkData(b,9);
 }
 const seg=new LoopbackSegment(),a=seg.attach(),b=seg.attach(),c=seg.attach();let d;
 b.onDeliver=()=>{b.close();d=seg.attach();c.send(data(2));};a.send(data(1));
 checkData(c,1);checkData(d,2);checkData(a,2);assert.equal(b.pending,0);
});
await group('live unread receiver still overflows; retiring it clears queue',async()=>{
 const f=fixture(),a=await live(f,0x0a000003);for(let i=0;i<20000;i++)f.p.vlanWire.send(data(i));assert.throws(()=>f.p.vlanWire.send(data(20000)),/inbox overflow/);a.c.stop();eof(f,a.r.ip);retired(f,a.w);assert.equal(f.p.vlanWire.send(data(20001)),true);
});
await group('no-pipe launch makes no transport',async()=>{const f=fixture(),r=f.spawn('C:\\DXSETUP.EXE',0);assert.equal(f.p._childSegment,undefined);assert.equal(r.rec.exitCode,0);});
console.log(JSON.stringify({verdict:failures.length?'REJECT':'ACCEPT_SOURCE_SLICES',candidate,base,mutation:process.env.MUTATION||null,passed:checks.length,checks,failures,observations,seals,limits:'Exact production JS slices; synthetic VFS, scheduling, callGuest and traffic; full wire queues and production stop/exit. No guest pipe reads, Worker, fullVM, browser, games, heap or runtime qualification.'},null,2));if(failures.length)process.exitCode=1;
}
run().catch(e=>{console.error(e);process.exitCode=1;});
