#!/usr/bin/env node
'use strict';
// Run from repository root. Adapted from the independent fa1f3097 endpoint
// review fixture; acceptance() below retains that review's oracle unchanged.
// This implementer's regression does not claim independent acceptance.
const cp = require('node:child_process'), vm = require('node:vm');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const candidate = process.env.SOURCE_REV || 'WORKTREE';
const seals = {}, checks = [];
function blob(rev, path) {
  let s = rev === 'WORKTREE' ? require('node:fs').readFileSync(path,'utf8')
    : cp.execFileSync('git', ['show', `${rev}:${path}`],
      {encoding:'utf8',maxBuffer:8e6,stdio:['ignore','pipe','pipe']});
  const m = process.env.MUTATION;
  if(path==='host.js') {
    if(m==='retain-child') s=s.replace('if (childWire) childWire.close();','');
    if(m==='close-caller') s=s.replace('if (childWire) childWire.close();','if (childWire) self.vlanWire.close();');
    if(m==='early-close') s=s.replace('rec.object.complete = onExit;','rec.object.complete = onExit; if (childWire) childWire.close();');
    if(m==='double-eof') s=s.replace('self.vlanWire.peerGone(ip);','{ self.vlanWire.peerGone(ip); self.vlanWire.peerGone(ip); }');
  }
  if(path==='lib/vlan-wire.js' && m==='retain-inbox') s=s.replace('this.inbox.length = 0;','');
  if(path==='lib/vlan-wire.js' && m==='mutable-broadcast') s=s.replace('this.endpoints.slice()', 'this.endpoints');
  seals[`${rev}:${path}`] = crypto.createHash('sha256').update(s).digest('hex');
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
  let last, launchMode;
  const window={VlanWire:Vlan,wineShell:{launchVfsExe:(file,parent,dir,args,opts)=>{
    last=opts;
    if(launchMode==='false') return false;
    if(launchMode==='throw') throw Error('synchronous launch failure');
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

function retired(f,wire) {
  acceptance(f,wire);
  assert.equal(wire.pending,0,'retired child releases queued frames');
  assert.equal(wire.segment,null,'retired child releases segment');
  assert.equal(wire.send(frame()),false,'retired sender cannot send');
  wire.deliver(frame());wire.peerGone(12);wire.close();
  assert.equal(wire.pending,0,'retired endpoint cannot receive');
}
async function run() {
  const f=fixture(),s=f.spawn(),alias=f.duplicate(s.handle);
  assert.equal(s.rec.object.pending,false);assert.equal(s.rec.object.exitCode,0);
  assert.equal(s.rec.object.wine,null);assert.equal(f.wait(alias),0);
  assert.equal(f.accepted.length,0);assert.equal(f.tasks.length,0);
  eof(f,s.ip);retired(f,s.opts.lanLink.wire);
  f.h.process_ctl(7,s.handle,0);f.h.process_ctl(7,alias,0);
  assert.equal(f.p._children.size,0);assert.equal(f.p._processAliases.size,0);
  checks.push('unchanged independent no-child oracle; aliases/wait/close and EOF once');
  for(let i=0;i<100;i++) {
    const n=f.spawn();eof(f,n.ip);retired(f,n.opts.lanLink.wire);
    f.h.process_ctl(7,n.handle,0);
  }
  assert.equal(f.p._childSegment.endpoints.length,1);
  for(let i=0;i<20001;i++)f.p.vlanWire.send(frame());
  assert.equal(f.p.vlanWire.pending,0);
  checks.push('101 skips retain only caller; 20001 subsequent DATA frames do not overflow');
  for(const code of [0,259,0xffffffff]) {
    const q=fixture();q.onSkip(()=>{
      const pid=[...q.p._children.keys()][0];
      assert.equal(q.h.process_ctl(5,0xe40000|pid,code),1);
    });
    const r=q.spawn();assert.equal(r.rec.object.exitCode,code);eof(q,r.ip);
    r.opts.onExit(null,'already-satisfied');r.opts.onExit(null);
    assert.equal(q.p.vlanWire.pending,0);retired(q,r.opts.lanLink.wire);
    checks.push('reentrant cancellation '+code+' authoritative, retired, EOF once');
  }
  for(const mode of ['normal','terminate','cancel-before','cancel-during','fail-no-child','fail-child']) {
    const q=fixture(),r=q.spawn('C:\\child.exe'),wire=r.opts.lanLink.wire;
    assert.equal(q.accepted.length,1);assert.equal(q.wait(r.handle),258);
    assert(q.p._childSegment.endpoints.includes(wire),'pending launch owns live endpoint');
    q.p.vlanWire.send(frame());assert.equal(wire.pending,1,'preboot data retained');
    if(mode==='fail-no-child') {q.fail(r.opts)(Error('boot'));assert.equal(r.rec.exitCode,1);}
    else {
      const c=q.make();c.joinVlan(wire,'10.0.0.2');q.bindStopped(c,r.opts);
      if(mode==='cancel-before') {
        q.h.process_ctl(5,r.handle,42);retired(q,wire);
        await assert.rejects(r.opts.beforeRun(c),/terminated before attachment/);
      } else if(mode==='cancel-during') {
        let release;c.callGuest=()=>new Promise(resolve=>{release=resolve;});
        const boot=r.opts.beforeRun(c);q.h.process_ctl(5,r.handle,42);
        retired(q,wire);release(1);
        await assert.rejects(boot,/terminated during attachment/);
      } else {
        await r.opts.beforeRun(c);
        assert.equal(wire.pending,1,'attachment preserves queued input');
        if(mode==='normal') {c._exitCode=17;c.stop();assert.equal(r.rec.exitCode,17);}
        else if(mode==='terminate') {assert.equal(q.h.process_ctl(5,r.handle,73),1);assert.equal(r.rec.exitCode,73);}
        else {q.fail(r.opts,c)(Error('boot'));assert.equal(r.rec.exitCode,1);}
      }
      if(mode.startsWith('cancel')) {q.fail(r.opts,c)(Error('cancelled'));assert.equal(r.rec.exitCode,42);}
      c.stop();c._releaseGuestMemory();assert.equal(c.memory,null);
    }
    assert.equal(q.wait(r.handle),0);eof(q,r.ip);retired(q,wire);
    r.opts.onExit(null);assert.equal(q.p.vlanWire.pending,0);
    checks.push('ordinary '+mode+': exact join/stop/fail/memory-release; queued input until completion; EOF once');
  }
  for(const mode of ['false','throw']) {
    const q=fixture();q.setLaunchMode(mode);
    if(mode==='false')assert.equal(q.spawn('C:\\child.exe').pid,0);
    else assert.throws(()=>q.spawn('C:\\child.exe'),/synchronous launch failure/);
    assert.equal(q.p._children.size,0);eof(q,0x0a000002);
    retired(q,q.getOpts().lanLink.wire);
    checks.push('synchronous shell '+mode+' cleans owned endpoint and process record');
  }
  const live=fixture(),lr=live.spawn('C:\\child.exe'),lc=live.make();
  lc.joinVlan(lr.opts.lanLink.wire,'10.0.0.2');live.bindStopped(lc,lr.opts);
  await lr.opts.beforeRun(lc);
  const skipped=live.spawn('C:\\DXSETUP.EXE',1,0x0a000003);eof(live,skipped.ip);
  retired(live,skipped.opts.lanLink.wire);
  live.h.process_ctl(7,skipped.handle,0);
  lc.vlanWire.send(frame());assert.equal(live.p.vlanWire.pending,1);live.p.vlanWire.commit();
  live.p.vlanWire.send(frame());assert.equal(lc.vlanWire.pending,1);lc.vlanWire.commit();
  // Closing the caller's child handle is not child termination either.
  live.h.process_ctl(7,lr.handle,0);
  assert.equal(live.p._childSegment.endpoints.length,2);
  live.p.stop(); // caller stop must not kill an independently owned live child
  assert.equal(live.p._childSegment.endpoints.length,2);
  lc.vlanWire.send(frame());assert.equal(live.p.vlanWire.pending,1);live.p.vlanWire.commit();
  lc.stop();eof(live,lr.ip);retired(live,lr.opts.lanLink.wire);
  checks.push('caller/sibling bidirectional traffic survives skip, process-handle close and caller stop');
  const np=fixture(),nr=np.spawn('C:\\DXSETUP.EXE',0);
  assert.equal(nr.rec.exitCode,0);assert.equal(np.p._childSegment,undefined);
  checks.push('no-pipe skip creates no segment');
  const module={exports:{}};
  vm.runInNewContext(blob(candidate,'lib/vlan-wire.js'),{module,exports:module.exports,require,console:quiet});
  const {LoopbackSegment}=module.exports;
  const seg=new LoopbackSegment(),a=seg.attach(),b=seg.attach(),c=seg.attach(),d=seg.attach();
  b.onFrame=()=>b.close();a.send(frame());
  assert.equal(c.pending,1,'self-retirement cannot skip next recipient');assert.equal(d.pending,1);
  c.commit();d.commit();
  const e=seg.attach();c.onFrame=()=>d.close();a.send(frame());
  assert.equal(d.pending,0);assert.equal(e.pending,1);
  b.close();assert.equal(b.send(frame()),false);
  assert(seg.endpoints.includes(a));
  checks.push('transport close is idempotent and reentrant broadcast preserves surviving recipients');
  const bounded=new LoopbackSegment(),sender=bounded.attach(),receiver=bounded.attach();
  for(let i=0;i<20000;i++)sender.send(frame());
  assert.throws(()=>sender.send(frame()),/inbox overflow/);
  receiver.close();assert.equal(receiver.pending,0);assert.equal(sender.send(frame()),true);
  checks.push('live receiver overflow remains explicit; close releases inbox and prevents future overflow');
  console.log(JSON.stringify({verdict:'implementer regression PASS; independent review pending',
    candidate,passed:checks.length,checks,seals,
    limits:'Production JS slices and full wire module; synthetic scheduling and traffic. No guest pipe reads, full VM, Worker IPC, browser, game or runtime qualification.'},null,2));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
