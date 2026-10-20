#!/usr/bin/env node
'use strict';
// Run from repository root. Exact git blobs, no working production overlays.
// --accept is the independent acceptance oracle (expected to fail candidate).
const cp = require('node:child_process'), vm = require('node:vm');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const candidate = 'ee129daaf02d3398442c34d42e8aa67fb618771e';
const base = '978018d85f28b76f04e9b67b7f1009904391b632';
const seals = {}, checks = [], observations = [];
function blob(rev, path) {
  const s = cp.execFileSync('git', ['show', `${rev}:${path}`],
    {encoding:'utf8',maxBuffer:8e6,stdio:['ignore','pipe','pipe']});
  seals[`${rev}:${path}`] = crypto.createHash('sha256').update(s).digest('hex');
  return s;
}
function cut(s,a,b) {
  const i=s.indexOf(a),j=s.indexOf(b,i+a.length);
  assert(i>=0&&j>i,a);return s.slice(i,j);
}
function method(s,n) {return cut(s,`  ${n}(`,'\n  }')+'\n  }';}
const quiet={log(){},warn(){},error(){}};
function fixture(rev=candidate, mutation='') {
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
  let last;
  const window={VlanWire:Vlan,wineShell:{launchVfsExe:(file,parent,dir,args,opts)=>{
    last=opts;
    // Oracle sensitivity only: remove the unused child endpoint or wrong caller.
    // Neither mutation is written into production or proposed as a repair.
    if(mutation) {
      const exit=opts.onExit;
      opts.onExit=(...a)=>{
        const wire=mutation==='detach-child'?opts.lanLink?.wire:p.vlanWire;
        const i=p._childSegment?.endpoints.indexOf(wire);
        if(i>=0)p._childSegment.endpoints.splice(i,1);
        return exit(...a);
      };
    }
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
    onSkip:f=>{preSkip=f;}};
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
async function run() {
  const f=fixture(), s=f.spawn(), alias=f.duplicate(s.handle);
  assert.equal(s.rec.object.pending,false);assert.equal(s.rec.object.exitCode,0);
  assert.equal(s.rec.object.wine,null);assert.equal(f.wait(alias),0);
  assert.equal(f.accepted.length,0);assert.equal(f.tasks.length,0);
  eof(f,s.ip);
  if(process.argv.includes('--accept'))acceptance(f,s.opts.lanLink.wire);
  assert.throws(()=>acceptance(f,s.opts.lanLink.wire),/unused endpoint/);
  f.h.process_ctl(7,s.handle,0);f.h.process_ctl(7,alias,0);
  assert.equal(f.p._children.size,0);assert.equal(f.p._processAliases.size,0);
  assert(f.p._childSegment.endpoints.includes(s.opts.lanLink.wire));
  f.p.vlanWire.send(frame());
  assert.equal(s.opts.lanLink.wire.pending,1);
  checks.push('real no-child completion, wait, aliases, close and GONE; endpoint still receives data');
  observations.push({case:'no-child',afterHandleClose:f.p._childSegment.endpoints.length,
    unusedEndpointPending:s.opts.lanLink.wire.pending});
  // Drop test-owned launch references: the production segment remains the root.
  s.opts=null;
  for(let i=0;i<4;i++) {
    const n=f.spawn('C:\\DXSETUP.EXE',1,s.ip);eof(f,s.ip);
    f.h.process_ctl(7,n.handle,0);
  }
  assert.equal(f.p._childSegment.endpoints.length,6);
  checks.push('five skipped launches retain five child endpoints after handle close');
  const stalled=f.p._childSegment.endpoints[1];
  while(stalled.pending<20000)f.p.vlanWire.send(frame());
  assert.throws(()=>f.p.vlanWire.send(frame()),/inbox overflow/);
  observations.push({case:'later stream traffic',retainedEndpoints:6,pending:stalled.pending,
    error:'vlan-wire: inbox overflow (20000 frames undelivered)'});
  checks.push('retained unread endpoint reaches production stream overflow under bounded synthetic traffic');
  for(const mutation of ['detach-child','detach-caller']) {
    const q=fixture(candidate,mutation),r=q.spawn();
    if(mutation==='detach-child')acceptance(q,r.opts.lanLink.wire);
    else assert.throws(()=>acceptance(q,r.opts.lanLink.wire),/caller pipe endpoint/);
    checks.push(`oracle sensitivity ${mutation}`);
  }
  for(const code of [0,259,0xffffffff]) {
    const q=fixture();
    q.onSkip(()=>{const pid=[...q.p._children.keys()][0];
      assert.equal(q.h.process_ctl(5,0xe40000|pid,code),1);});
    const r=q.spawn();assert.equal(r.rec.object.exitCode,code);eof(q,r.ip);
    r.opts.onExit(null,'already-satisfied');r.opts.onExit(null);
    assert.equal(q.p.vlanWire.pending,0);
    assert.throws(()=>acceptance(q,r.opts.lanLink.wire),/unused endpoint/);
    checks.push(`reentrant pending cancellation ${code}: authoritative status, one EOF, retained endpoint`);
  }
  for(const mode of ['normal','cancel-before','cancel-during','fail-no-child','fail-child']) {
    const q=fixture(),r=q.spawn('C:\\child.exe');
    assert.equal(q.accepted.length,1);assert.equal(q.wait(r.handle),258);
    if(mode==='fail-no-child') {q.fail(r.opts)(Error('boot'));assert.equal(r.rec.exitCode,1);}
    else {
      const c=q.make();c.joinVlan(r.opts.lanLink.wire,'10.0.0.2');
      q.bindStopped(c,r.opts);
      if(mode==='cancel-before') {
        q.h.process_ctl(5,r.handle,42);
        await assert.rejects(r.opts.beforeRun(c),/terminated before attachment/);
      } else if(mode==='cancel-during') {
        let release;c.callGuest=()=>new Promise(resolve=>{release=resolve;});
        const boot=r.opts.beforeRun(c);q.h.process_ctl(5,r.handle,42);
        release(1);await assert.rejects(boot,/terminated during attachment/);
      } else {
        await r.opts.beforeRun(c);
        if(mode==='normal'){c._exitCode=17;c.stop();assert.equal(r.rec.exitCode,17);}
        else {q.fail(r.opts,c)(Error('boot'));assert.equal(r.rec.exitCode,1);}
      }
      if(mode.startsWith('cancel'))q.fail(r.opts,c)(Error('cancelled'));
      c.stop();
      c._releaseGuestMemory();
      assert.equal(c.memory,null);
      assert(q.p._childSegment.endpoints.includes(r.opts.lanLink.wire));
    }
    assert.equal(q.wait(r.handle),0);eof(q,r.ip);
    r.opts.onExit(null);assert.equal(q.p.vlanWire.pending,0);
    assert.throws(()=>acceptance(q,r.opts.lanLink.wire),/unused endpoint/);
    checks.push(`ordinary ${mode}: real joinVlan/stop/fail ownership, one GONE, same retention`);
  }
  const live=fixture(), lr=live.spawn('C:\\child.exe'), lc=live.make();
  lc.joinVlan(lr.opts.lanLink.wire,'10.0.0.2');live.bindStopped(lc,lr.opts);
  await lr.opts.beforeRun(lc);
  const skipped=live.spawn('C:\\DXSETUP.EXE',1,0x0a000003);
  eof(live,skipped.ip);
  assert.equal(live.h.process_ctl(7,skipped.handle,0),1);
  lc.vlanWire.send(frame());
  assert.equal(live.p.vlanWire.pending,1);
  live.p.vlanWire.commit();
  assert.equal(skipped.opts.lanLink.wire.pending,1);
  assert.equal(live.wait(lr.handle),258);
  checks.push('live sibling still needs caller endpoint; completed skipped endpoint also receives sibling traffic');
  const np=fixture(),nr=np.spawn('C:\\DXSETUP.EXE',0);
  assert.equal(nr.rec.exitCode,0);assert.equal(np.p._childSegment,undefined);
  checks.push('no redirected handles allocates no segment');
  const old=fixture(base),os=old.spawn();
  assert.equal(os.rec.object.pending,true);assert.equal(old.wait(os.handle),258);
  assert.equal(old.p.vlanWire.pending,0);assert.equal(old.p._childSegment.endpoints.length,2);
  old.p.vlanWire.send(frame());assert.equal(os.opts.lanLink.wire.pending,1);
  checks.push('exact parent already retains endpoint; candidate fixes completion but not retention');
  console.log(JSON.stringify({verdict:'REJECT lifecycle acceptance; retained endpoint proven',
    candidate,base,passed:checks.length,checks,observations,seals,
    limits:'Exact-source JS functions and complete production wire; synthetic launch environment and traffic. No guest pipe read, GC/heap, full VM, browser, Worker IPC, game or runtime qualification.'},null,2));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
