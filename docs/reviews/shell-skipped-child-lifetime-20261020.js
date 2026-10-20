#!/usr/bin/env node
'use strict';
// Complete launchVfsExe and actual host process/alias/wait functions. No browser,
// guest runtime or full build. Run from repository root.
const fs = require('node:fs'), cp = require('node:child_process');
const vm = require('node:vm'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const BASE = '978018d85f28b76f04e9b67b7f1009904391b632';
const seals = {};
function read(p, old = false) {
  const s = !old && fs.existsSync(p) ? fs.readFileSync(p, 'utf8')
    : cp.execFileSync('git', ['show', `${BASE}:${p}`], {encoding:'utf8', maxBuffer:8e6});
  seals[`${old ? BASE : 'tested'}:${p}`] = crypto.createHash('sha256').update(s).digest('hex');
  return s;
}
const helper = read('docs/reviews/process-alias-boundary-fix-20261020.js', true);
const prefix = helper.slice(0, helper.indexOf('function blob('))
  + 'function blob(p) { return readSource(p); }\n'
  + helper.slice(helper.indexOf('function cut('), helper.indexOf('\n(async()=>'));
function fixture(old = false) {
  const ctx = {require, readSource:p=>read(p, old && p === 'lib/browser-shell.js'), process:{env:{}},
    WebAssembly, SharedArrayBuffer, TextEncoder, TextDecoder, setTimeout, clearTimeout};
  vm.createContext(ctx);
  vm.runInContext(prefix + '\nglobalThis.f={make,spawn,dup,waits,failLaunch,cut,shell};', ctx);
  return ctx.f;
}
function shellFor(f, {log = ()=>{}, inFlight = false, single = false} = {}) {
  const tasks = [], launches = [], queued = [], snapshots = [], entries = [];
  const src = f.cut(f.shell, '    function launchVfsExe(', '\n    // A program that lives only');
  const ctx = {
    Map, String, appendDebugLog:log, queueMicrotask:fn=>tasks.push(fn),
    lastExitedVfs:null, lastExitedRunSliceAppKey:null, apps:{},
    snapshotVfs:v=>{snapshots.push(v);return v;},
    installedAppEntry:(...a)=>{entries.push(a);return a;},
    launchInFlight:inFlight, SINGLE_APP:()=>single, runningApps:single?[{}]:[],
    setTimeout:fn=>tasks.push(fn), queuePendingLaunch:(...a)=>queued.push(a),
    api:{launchApp:(...a)=>launches.push(a)},
  };
  const launch = vm.runInNewContext(src+'\nlaunchVfsExe;', ctx);
  return {launch, tasks, launches, queued, snapshots, entries, ctx};
}
function vfsFor(p) {
  const v=p._helpCtx.vfs;
  // The shell and caller normally share a realm. The extraction fixture's
  // nested VM creates its own Map; normalize only this environmental file map.
  v.files=new Map(v.files);
  v._normPath = x=>x.toLowerCase().replace(/\//g,'\\');
  v._resolvePath = v._normPath;
  return v;
}
async function suite(old=false) {
  const f=fixture(old), outcomes=[];
  // make() retains actual process_spawn; its command parser is an environmental
  // fixture. Only the selected path is substituted at the launcher boundary.
  for(const pipes of [0,1])for(const cancel of [null,0,259,0xffffffff]) {
    let p, observed, callbacks=0, eof=0, merges=0, beforeRuns=0;
    let a,b,object;
    const sh=shellFor(f,{log:()=>{
      if(object)return;
      const [pid,rec]=[...p._children][0];const h=0xe40000|pid;
      object=rec.object;
      assert.equal(p.ctl(4,h,0),259);assert.equal(f.waits(p).waitSingle(h,0),258);
      a=f.dup(p,h);b=f.dup(p,a);
      assert(a>0&&b>0);
      assert.equal(p._processAliases.get(a).object,object);
      if(cancel!==null) {
        assert.equal(p.ctl(7,h,0),1);
        assert.equal(p.ctl(5,a,cancel),1);
      }
    }});
    p=f.make({launcher:(_file,parent,dir,args,opts)=>{
      observed=opts;
      const exit=opts.onExit, before=opts.beforeRun;
      opts.onExit=(...a)=>{callbacks++;return exit(...a);};
      opts.beforeRun=(...a)=>{beforeRuns++;return before(...a);};
      if(pipes)p.vlanWire.peerGone=()=>eof++;
      return sh.launch('C:\\REDIST\\DXSETUP.EXE',parent,dir,args,opts);
    }});
    p._helpCtx.vfs.mergeChildFrom=()=>{merges++;throw Error('unexecuted child merge');};
    const s=f.spawn(p,pipes), expected=cancel===null?0:cancel;
    assert(s.pid>0);
    assert.equal(object.exited,true,'existing already-satisfied launch must complete');
    assert.equal(object.pending,false);assert.equal(object.wine,null);
    assert.equal(object.complete,undefined);
    assert.equal(callbacks,1);assert.equal(beforeRuns,0);
    assert.equal(p.ctl(4,a,0),expected);assert.equal(p.ctl(4,b,0),expected);
    assert.equal(f.waits(p).waitSingle(a,0),0);
    assert.equal(await f.waits(p).waitSingleCooperative(b,0),0);
    const view=new DataView(p.memory.buffer);
    view.setUint32(512,a,true);view.setUint32(516,b,true);
    for(const all of [false,true])assert.equal(f.waits(p).waitMultiple(2,512,all,0),0);
    assert.equal(p.ctl(5,a,42),-5);
    if(cancel===null) {
      assert.equal(p.ctl(4,s.handle,0),0);assert.equal(f.waits(p).waitSingle(s.handle,0),0);
      assert.equal(s.rec.exitCode,0);assert.equal(s.rec.exited,true);
      const late=f.dup(p,s.handle);assert(late>0);
      assert.equal(p.ctl(4,late,0),0);assert.equal(p.ctl(7,late,0),1);
      assert.equal(p.ctl(7,s.handle,0),1);
    }
    // Duplicate failure/exit notifications cannot overwrite completion or merge.
    observed.onExit(null);observed.onExit({_exitCode:88,_helpCtx:{vfs:{}}});
    observed.onExit(null,'already-satisfied');
    assert.equal(p.ctl(4,b,0),expected);
    assert.equal(eof,pipes?1:0);assert.equal(merges,0);
    assert.equal(sh.launches.length,0);assert.equal(sh.snapshots.length,0);
    assert.equal(p.ctl(7,a,0),1);assert.equal(p.ctl(8,a,0),-1);
    assert.equal(p.ctl(4,b,0),expected);assert.equal(p.ctl(7,b,0),1);
    assert.equal(p._children.size,0);assert.equal(p._processAliases.size,0);
    outcomes.push(`actual DXSETUP pipes=${pipes} cancellation=${cancel}`);
  }
  // Existing handoff remains a separate microtask with no inherited tracked
  // child callbacks/options. The installed entry is not claimed to have run.
  const sh=shellFor(f),p=f.make(),v=vfsFor(p);
  const game='c:\\program files\\warwind\\ww.exe';v.files.set(game,{});
  let done=0;
  assert.equal(sh.launch('dxsetup.exe',p,'','',{onExit:(child,outcome)=>{
    assert.equal(child,null);assert.equal(outcome,'already-satisfied');done++;
  },beforeRun:()=>assert.fail('no child')}),true);
  assert.equal(done,1);assert.equal(sh.tasks.length,1);assert.equal(sh.launches.length,0);
  sh.tasks.shift()();
  assert.equal(sh.launches.length,1);assert.equal(sh.launches[0].length,1);
  assert.equal(sh.entries[0][0],game);assert.equal(sh.entries[0][4],p);
  assert.equal(done,1);
  outcomes.push('War Wind separate deferred handoff preserves caller VFS and options boundary');
  // Ordinary launches preserve the exact options identity and boot deferral.
  for(const busy of [false,true]) {
    const sh=shellFor(f,{inFlight:busy}),p=f.make(),v=vfsFor(p);
    v.files.set('c:\\app.exe',{});
    const opts={beforeRun(){},onExit(){assert.fail('not completed at acceptance');},
      show:7,hidden:true,bypassSingleApp:true};
    assert.equal(sh.launch('app.exe',p,'C:\\','/x',opts),true);
    if(busy){assert.equal(sh.launches.length,0);sh.ctx.launchInFlight=false;sh.tasks.shift()();}
    assert.equal(sh.launches[0][1],opts);assert.equal(sh.entries[0][3],'/x');
    assert.equal(sh.launch('missing.exe',p,'C:\\','',opts),false);
    outcomes.push(`ordinary launch options and missing-file failure busy=${busy}`);
  }
  for(const file of ['other-setup.exe','mydxsetup.exe','dxsetup.exe.bak']) {
    assert.equal(shellFor(f).launch(file,null,'','',{onExit:()=>assert.fail('expanded skip')}),false);
  }
  const untracked=shellFor(f);
  assert.equal(untracked.launch('DXSETUP.EXE',null,'',''),true);
  assert.equal(untracked.launches.length,0);
  outcomes.push('unchanged exact redistributable policy and untracked success');
  for(const childPresent of [false,true]) {
    const p=f.make(),s=f.spawn(p),a=f.dup(p,s.handle);
    const c=childPresent?f.make({fullStop:true}):null;
    if(c){await s.opts.beforeRun(c);c.onStopped=s.opts.onExit;}
    const fail=f.failLaunch(s.opts,c);fail(Error('boot failure'));fail(Error('repeat'));
    assert.equal(p.ctl(4,a,0),1);assert.equal(f.waits(p).waitSingle(a,0),0);
    outcomes.push(`ordinary boot failure childPresent=${childPresent}`);
  }
  for(const code of [0,259,0xffffffff]) {
    const p=f.make(),s=f.spawn(p),a=f.dup(p,s.handle),c=f.make({fullStop:true});
    let merges=0;
    p._helpCtx.vfs.mergeChildFrom=()=>{merges++;return {written:1,deleted:0};};
    await s.opts.beforeRun(c);c.onStopped=s.opts.onExit;
    assert.equal(f.waits(p).waitSingle(a,0),258);
    c._exitCode=code;c.stop();s.opts.onExit(c);c.stop();
    assert.equal(p.ctl(4,a,0),code);assert.equal(f.waits(p).waitSingle(a,0),0);
    assert.equal(merges,1);
    outcomes.push(`ordinary asynchronous child exit=${code}`);
  }
  return outcomes;
}
(async()=>{
  if(process.argv.includes('--regression')) {
    // Adapt only the historical test's textual extraction anchor to the new
    // callback signature; all assertions and executable production stay intact.
    let source=helper.slice(0,helper.indexOf('function blob('))
      +'function blob(p,rev){return readSource(p,rev);}\n'
      +helper.slice(helper.indexOf('function cut('));
    // That suite deliberately asserts the formerly known DXSETUP defect.
    // Replace only that obsolete observation with this file's acceptance suite.
    const start=source.indexOf("  await check('Actual launchVfsExe dxsetup success");
    const end=source.indexOf("  await check('Stop publishes",start);
    assert(start>=0&&end>start);
    source=source.slice(0,start)+source.slice(end);
    const proc={env:{},exitCode:0};
    await vm.runInNewContext(source,{require,process:proc,console,
      readSource:(p,rev)=>{
        let s=rev?cp.execFileSync('git',['show',`${rev}:${p}`],{encoding:'utf8',maxBuffer:8e6}):read(p);
        if(p==='docs/re-notes/process-alias-correct-port-20261020.js')
          s=s.replace("between(host,'      const onExit = (child) => {'",
            "between(host,'      const onExit = (child, outcome) => {'");
        return s;
      },WebAssembly,SharedArrayBuffer,TextEncoder,TextDecoder,setTimeout,clearTimeout,setImmediate});
    assert.equal(proc.exitCode,0,'existing compiled process regression suite');
    return;
  }
  if(process.argv.includes('--baseline')) {await suite(true);throw Error('old pending behavior accepted');}
  const outcomes=await suite();
  await assert.rejects(suite(true),/existing already-satisfied launch must complete/);
  console.log(JSON.stringify({passed:outcomes.length,outcomes,
    negativeControl:'exact main old launchVfsExe with new host rejected: pending handle',seals},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
