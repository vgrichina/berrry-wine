#!/usr/bin/env node
'use strict';
// Test owned working-file overlays with exact parent blobs for other paths.
// ALIAS_BASELINE=1 selects the rejected parent; ALIAS_FILTER selects an oracle.
// Run from the isolated repository; never invoke a full guest/browser.
const fs = require('node:fs'), vm = require('node:vm');
const assert = require('node:assert/strict'), cp = require('node:child_process');
const crypto = require('node:crypto');
const CANDIDATE = '659a2c6d6974c447a21dd2905cd7a2c2c1e23382';
const BASE = 'a54049d11955307d06309e146e85c1aca3196657';
const checks = [], controls = [], observations = {}, seals = {};
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
function blob(p, rev) {
  if (!rev && !process.env.ALIAS_BASELINE && fs.existsSync(p)) {
    const s=fs.readFileSync(p,'utf8'); seals[`worktree:${p}`]=sha(s); return s;
  }
  rev ||= CANDIDATE;
  const s = cp.execFileSync('git', ['show', `${rev}:${p}`], {encoding:'utf8',maxBuffer:8e6});
  seals[`${rev}:${p}`] = sha(s); return s;
}
function cut(s, a, b) {
  const i=s.indexOf(a), j=s.indexOf(b,i+a.length);
  assert(i>=0 && j>i,a); return s.slice(i,j);
}
function method(s,n) { return cut(s,`  ${n}(`,'\n  }')+'\n  }'; }
const host=blob('host.js'), shell=blob('lib/browser-shell.js'), tm=blob('lib/thread-manager.js');
const quiet={log(){},error(){},warn(){}};
// Endpoint ownership is part of process_spawn's contract. Use the complete
// production transport, including observable retirement and queue cleanup.
const wireModule={exports:{}};
vm.runInNewContext(blob('lib/vlan-wire.js'),{
  module:wireModule,exports:wireModule.exports,require,console:quiet,
});
const methods=method(host,'_processHandleEntry')+'\n'+method(host,'_duplicateProcessHandle');
const spawnCtl=cut(host,'    h.process_spawn =','    h.shell_execute =');
const retire=cut(host,'    if (!this._processObject.exited) {','    if (this._processSendEndpoint');
const fail=cut(shell,'      const notifyLaunchExit =','      pendingLaunchFail = failLaunch;');
const restart=cut(host,'    if (this._processObject.exited) {','    const compileEl');
let serial=1;
function make({mutation, launcher, fullStop=false}={}) {
  let body=methods, state=retire;
  if(mutation==='null-output') body=body.replace('      const access =','      if (!frame.getUint32(16,true)) return -87;\n      const access =');
  if(mutation==='retain-host') state=state.replace('this._processObject.wine = null;','void this;');
  if(mutation==='close-alias') body=body.replace('sourceHost._processAliases.delete(sourceHandle);','void sourceHandle;');
  const stop=fullStop?method(host,'stop'):`stop(){${state}\nthis.onStopped?.(this);}`;
  const C=vm.runInNewContext(`(class {${body}\n${stop}\nrestart(){${restart}}})`);
  const p=new C(); Object.assign(p,{
    processId:serial++,memory:new WebAssembly.Memory({initial:1}),
    _processAliases:new Map(),_nextProcessAlias:1,spawnProcesses:true,
    _helpCtx:{vfs:{files:new Map(),getCurrentDirectory:()=>'',mergeChildFrom:()=>({written:0,deleted:0})}},
    readString:()=> 'child.exe',threadManager:{},callGuest:async()=>1,
  });
  p._processObject={wine:p,exited:false,exitCode:259};
  // Full stop orchestration executes, but no renderer, timers, audio or workers
  // are created. Those environmental cleanup dependencies are explicit no-ops.
  if(fullStop)for(const n of ['_cancelPresentFrame','_cancelDelayedStep','_cancelVblankWait',
    '_frozenUnregister','_removeVisibilityPause','_removeInputWake','_stopAudioIdleWatch',
    '_stopGuestRuntime','_stopPerfCounterPoll','_cleanupAudio'])p[n]=()=>{};
  const launches=[];
  const window={wineShell:{launchVfsExe:launcher || ((...args)=>{launches.push(args);return true;})},
    VlanWire:wireModule.exports};
  const h=vm.runInNewContext(`(self=>{const h={};${spawnCtl}return h;})`,{
    window,console:quiet,Map,DataView,
    WineAssembly:{},parseShellLaunchCommand:()=>({file:'child.exe',params:''}),
    resolveShellLaunchPath:s=>s,
  })(p);
  p.h=h;p.ctl=h.process_ctl;p.launches=launches;return p;
}
function spawn(p,pipes=0) {
  const pid=p.h.process_spawn(0,0,123,0,pipes);
  return {handle:0xe40000|pid, pid, rec:p._children.get(pid),opts:p.launches.at(-1)?.[4]};
}
function dup(p,handle,{src=-1,dst=-1,out=128,access=0,inherit=0,options=2}={}) {
  const v=new DataView(p.memory.buffer);
  [src,handle,dst,out,access,inherit,options].forEach((x,i)=>v.setUint32(260+i*4,x,true));
  return p.ctl(3,256,0);
}
function failLaunch(opts,child) {
  return vm.runInNewContext(`((launchOpts,createdWine)=>{
    let launchFailed=false,pendingLaunchFail=null;
    const sel='fixture',ctx={retained:new Set()},bootDone=()=>{},showCrashReport=()=>{};
    ${fail} return failLaunch;
  })`,{document:{getElementById:()=>({textContent:''})},console:quiet})(opts,child);
}
const T=vm.runInNewContext(`(class {${['_getSyncIdx','_resolveThreadHandle','waitSingle','waitSingleCooperative','waitMultiple'].map(n=>method(tm,n)).join('\n')}})`);
function waits(p) {
  const t=new T();
  Object.assign(t,{processCtl:p.ctl,memory:p.memory,threads:new Map(),_pendingThreads:[],
    _threadHandleAliases:new Map(),_syncHandleToIdx:new Map([[256,0]]),
    _syncCurrentHandles:[256],syncView:new Int32Array(new SharedArrayBuffer(16))});
  t.syncView.set([0,1,1,0]);
  return t;
}
async function check(name,f){
  if(process.env.ALIAS_FILTER && !name.includes(process.env.ALIAS_FILTER))return;
  await f();checks.push(name);
}
function rejects(name,f){assert.throws(f,assert.AssertionError,name);controls.push(name);}

(async()=>{
  // Reproduce the submitted evidence in RAM; no materialization of its paths.
  let replay;
  const old=blob('docs/re-notes/process-alias-correct-port-20261020.js');
  const replayContext={
    require:n=>n==='node:fs'?{readFileSync:p=>blob(p)}:require(n),
    console:{log:s=>{replay=JSON.parse(s);}},
    WebAssembly,SharedArrayBuffer,TextEncoder,TextDecoder,Float32Array,Float64Array,
    Uint8Array,ArrayBuffer,Map,Set,RegExp,Array,Object,String,Number,Math,Promise,Date,
    setTimeout,clearTimeout,setImmediate,parseInt,parseFloat,isNaN,
  };
  vm.runInNewContext(old+'\nglobalThis.processApiBuild=compiled();',replayContext);
  assert.equal(replay.passed,17);
  observations.submittedReplay={groups:replay.passed,negativeControls:8,binaries:replay.binaries};
  const apiBuild=replayContext.processApiBuild;

  await check('A2 compiled pending duplicate/close/terminate lifecycle matrix',async()=>{
    for(const code of [0,17,259,0xffffffff])for(const closeFirst of [false,true]){
      const p=make(),s=spawn(p,1),child=make({fullStop:true}),call=apiBuild(p);
      let eof=0,merges=0;
      p.vlanWire.peerGone=()=>eof++;
      p._helpCtx.vfs.mergeChildFrom=()=>{merges++;return {written:0,deleted:0};};
      const r=call('DuplicateHandle',[-1,s.handle,-1,128,0,0,2]);
      assert.equal(r.ok,1);const alias=r.output;
      const object=p._processAliases.get(alias).object;
      if(closeFirst)assert.equal(call('CloseHandle',[s.handle]).ok,1);
      assert.equal(call('TerminateProcess',[alias,code]).ok,1);
      assert.equal(object.exited,true);assert.equal(object.exitCode,code);
      assert.equal(object.wine,null);assert.equal(object.complete,undefined);
      assert.equal(waits(p).waitSingle(alias,0),0);
      assert.equal(call('GetExitCodeProcess',[alias,128]).output,code);
      assert.equal(call('TerminateProcess',[alias,12]).error,5);
      child.onStopped=s.opts.onExit;
      const ownedAlias=dup(child,-1);assert(ownedAlias>0);
      await assert.rejects(s.opts.beforeRun(child),/terminated before attachment/);
      const f=failLaunch(s.opts,child);f(Error('cancelled'));f(Error('second catch'));
      assert.equal(child._processObject,object);
      assert.equal(child._processAliases.size,0);
      assert.equal(p.ctl(4,alias,0),code);
      assert.equal(s.rec.exitCode,code);
      assert.equal(eof,1);assert.equal(merges,0);
      if(closeFirst)assert.equal(p._children.has(s.pid),false);
    }
  });

  await check('A2 published E4 duplicates before attachment and retains identity',async()=>{
    const p=make(), s=spawn(p);
    assert.equal(s.handle,0xe44004);assert(s.rec.object);
    assert.equal(p.ctl(6,s.handle,0x400),1);assert.equal(p.ctl(4,s.handle,0),259);
    assert.equal(waits(p).waitSingle(s.handle,0),258);
    const alias=dup(p,s.handle);assert(alias>0);
    const object=p._processAliases.get(alias).object;
    const child=make();await s.opts.beforeRun(child);
    assert.equal(child._processObject,object);
    assert(dup(p,s.handle)>0);assert.equal(p.ctl(5,s.handle,17),1);
    assert.equal(p.ctl(4,alias,0),17);
    observations.pending={query:259,wait:258,duplicate:'allocated before attachment',identity:'preserved'};
  });
  await check('A2 termination during awaited pipe attachment prevents successful boot continuation',async()=>{
    const p=make(),s=spawn(p,1),child=make({fullStop:true});
    let resolve,calls=0,eof=0;
    p.vlanWire.peerGone=()=>eof++;
    child.onStopped=s.opts.onExit;
    child.callGuest=()=>{calls++;return new Promise(r=>resolve=r);};
    const alias=dup(p,s.handle),boot=s.opts.beforeRun(child);
    assert.equal(calls,1);
    assert.equal(p.ctl(5,alias,259),1);
    resolve(1);await assert.rejects(boot,/terminated during attachment/);
    failLaunch(s.opts,child)(Error('cancelled'));
    assert.equal(p.ctl(4,alias,0),259);assert.equal(p.ctl(8,alias,0),0);
    assert.equal(calls,1);assert.equal(eof,1);
  });
  await check('A2 pending E4 NULL target CLOSE_SOURCE succeeds',()=>{
    const p=make(),s=spawn(p);
    const result=dup(p,s.handle,{dst:0,out:0,options:1});
    assert.equal(result,1);assert.equal(p._children.has(s.pid),false);
  });
  await check('Actual shell failLaunch before attachment reports failure1, signaled once',()=>{
    const p=make(),s=spawn(p),child=make({fullStop:true}); child.onStopped=s.opts.onExit;
    const alias=dup(p,s.handle);assert(alias>0);
    const f=failLaunch(s.opts,child);f(Error('load'));f(Error('duplicate catch'));
    assert.equal(p.ctl(4,s.handle,0),1);assert.equal(p.ctl(8,s.handle,0),0);
    assert.equal(s.rec.exited,true);assert.equal(child._processObject.wine,null);
    assert.equal(p.ctl(4,alias,0),1);assert.equal(s.rec.object.complete,undefined);
  });
  await check('A1 actual beforeRun pipe rejection + shell failLaunch preserves failure1 after stop',async()=>{
    const p=make(),s=spawn(p,1),child=make({fullStop:true});
    let eof=0;p.vlanWire.peerGone=()=>eof++;
    child.callGuest=async()=>{throw Error('std attachment failure');};
    child.onStopped=s.opts.onExit;
    await assert.rejects(s.opts.beforeRun(child),/std attachment failure/);
    const preAlias=dup(p,s.handle);assert(preAlias>0);
    assert.equal(s.rec.object,child._processObject);
    const f=failLaunch(s.opts,child);f(Error('std attachment failure'));
    f(Error('second catch'));s.opts.onExit(child);
    assert.equal(s.rec.exitCode,1);assert.equal(s.rec.object.exitCode,1);
    assert.equal(p.ctl(4,s.handle,0),1);
    const alias=dup(p,s.handle);assert(alias>0);
    assert.equal(p.ctl(4,alias,0),1);assert.equal(p.ctl(8,alias,0),0);
    assert.equal(p.ctl(4,preAlias,0),1);assert.equal(eof,1);
    assert.equal(s.rec.object.complete,undefined);assert.equal(s.rec.object.wine,null);
    observations.attachedLaunchFailure={recordCode:s.rec.exitCode,objectCode:s.rec.object.exitCode,guestQuery:p.ctl(4,s.handle,0)};
  });
  await check('Independent close-before-attachment retains callback ownership without reintroducing handle',async()=>{
    const p=make(),s=spawn(p),child=make();let merges=0;
    p._helpCtx.vfs.mergeChildFrom=()=>{merges++;return {written:0,deleted:0};};
    assert.equal(p.ctl(7,s.handle,0),1);
    await s.opts.beforeRun(child);child.onStopped=s.opts.onExit;
    child._exitCode=0xffffffff;child.stop();s.opts.onExit(child);
    assert.equal(merges,1);assert.equal(p._children.has(s.pid),false);
    assert.equal(p.ctl(8,s.handle,0),-1);assert.equal(s.rec.exitCode,0xffffffff);
  });
  await check('NULL output / NULL target matrix on attached E4 and E6 with ignored access and inheritance',async()=>{
    for(const alias of [false,true])for(const out of [0,128]) {
      const p=make(),s=spawn(p),c=make();await s.opts.beforeRun(c);
      const h=alias?dup(p,s.handle):s.handle;
      const before=p._processAliases.size;
      assert(dup(p,h,{out,options:2})>0);assert.equal(p._processAliases.size,before+1);
      assert.equal(dup(p,h,{dst:0,out,access:0xffffffff,inherit:1,options:1}),1);
      assert.equal(p.ctl(8,h,0),-1);assert.equal(c._processObject.exited,false);
    }
    const p=make({mutation:'null-output'}),s=spawn(p),c=make();await s.opts.beforeRun(c);
    rejects('NULL output allocation mutation',()=>assert(dup(p,s.handle,{out:0})>0));
  });
  await check('Cross-owner failed CLOSE_SOURCE deletes source-table entry only, not equal numeric caller alias',async()=>{
    const p=make(),s=spawn(p),c=make();await s.opts.beforeRun(c);
    const own=dup(p,-1),foreign=dup(c,-1);
    assert.equal(own,foreign);
    assert.equal(dup(p,foreign,{src:s.handle,dst:0x1234,options:3}),-6);
    assert.equal(c._processAliases.has(foreign),false);assert.equal(p._processAliases.has(own),true);
    const mutated=make({mutation:'close-alias'}),a=dup(mutated,-1);
    dup(mutated,a,{dst:0x1234,options:3});
    rejects('Source-table cleanup mutation',()=>assert.equal(mutated._processAliases.has(a),false));
  });
  await check('Independent E4/E6 close plus full DWORD query/wait on real spawn callback lifecycle',async()=>{
    for(const code of [259,0xffffffff,0x80000000,0])for(const first of ['e4','e6']) {
      const p=make(),s=spawn(p),c=make();await s.opts.beforeRun(c);c.onStopped=s.opts.onExit;
      const alias=dup(p,s.handle),closed=first==='e4'?s.handle:alias,live=first==='e4'?alias:s.handle;
      assert.equal(p.ctl(7,closed,0),1);assert.equal(c._processObject.exited,false);
      c._exitCode=code;c.stop();
      assert.equal(p.ctl(4,live,0),code);assert.equal(waits(p).waitSingle(live,0),0);
      assert.equal(p.ctl(6,closed,0x400),-6);assert.equal(p.ctl(7,closed,0),-6);
      assert.equal(s.rec.exitCode,code);assert.equal(s.rec.object.wine,null);
      const old=s.rec.object;c.restart();assert.notEqual(c._processObject,old);
      assert.equal(p.ctl(4,live,0),code);
    }
    const p=make({mutation:'retain-host'});p.stop();
    rejects('Host-reference retention mutation',()=>assert.equal(p._processObject.wine,null));
  });
  await check('Wait-any/all validate stale or no-SYNCHRONIZE aliases before auto-reset event consumption',async()=>{
    const p=make(),s=spawn(p),c=make();await s.opts.beforeRun(c);
    const h=dup(p,s.handle,{options:0,access:0x400}),t=waits(p);
    new Uint32Array(p.memory.buffer,512,2).set([256,h]);
    for(const all of [false,true]) {assert.equal(t.waitMultiple(2,512,all,0),0xffffffff);assert.equal(t.syncView[2],1);}
    assert.equal(p.ctl(7,h,0),1);
    for(const all of [false,true]) {assert.equal(t.waitMultiple(2,512,all,0),0xffffffff);assert.equal(t.syncView[2],1);}
  });
  await check('Actual launchVfsExe dxsetup success has no beforeRun/onExit: returned child remains pending (pre-existing)',()=>{
    const fn=cut(shell,'    function launchVfsExe(','    // A program that lives only');
    const launch=vm.runInNewContext(`(${fn.trim()})`,{appendDebugLog(){},Map});
    const p=make({launcher:(file,caller,dir,args,opts)=>launch('dxsetup.exe',caller,dir,args,opts)}),s=spawn(p);
    assert(s.pid>0);assert.equal(s.rec.object.pending,true);assert.equal(s.rec.exited,false);
    assert.equal(p.ctl(8,s.handle,0),258);
    assert.equal(fn,cut(blob('lib/browser-shell.js',BASE),'    function launchVfsExe(','    // A program that lives only'));
    observations.skippedExecutable={pid:s.pid,wait:258,classification:'pre-existing caller/consumer mismatch'};
  });
  await check('Stop publishes process exit before onStopped merge; complete stop order and send ownership remain byte-preserved',()=>{
    const original=blob('host.js',BASE);
    for(const n of ['_installProcessSendBroker','_stopGuestRuntime','_releaseGuestMemory'])
      assert.equal(method(host,n),method(original,n),n);
    assert.equal(cut(host,'    if (this._manifestAssetAbort)','  _stopGuestRuntime()'),
      cut(original,'    if (this._manifestAssetAbort)','  _stopGuestRuntime()'));
    const stop=method(host,'stop');
    assert(stop.indexOf('this._processObject.exited = true')<stop.indexOf('this.onStopped(this)'));
    assert(stop.indexOf('this._stopGuestRuntime()')<stop.indexOf('this.onStopped(this)'));
    const p=make();let observed;
    p.onStopped=()=>{observed={exited:p._processObject.exited,code:p._processObject.exitCode};};p.stop();
    assert.deepEqual(observed,{exited:true,code:0});
    observations.mergeOrdering='Exit visible before shell onStopped/onExit merge; no concurrent Worker qualification claimed.';
  });
  // Inspect complete guest wait boundary (not just a host result). Compile the
  // two exact functions, with explicit import and global fixtures.
  await check('A3 complete actual WaitForSingleObject/Ex map invalid handle and access denied',()=>{
    const src=blob('src/09a0-handlers-base.wat');
    function wat(name){
      const start=src.indexOf('(func $'+name+' ');assert(start>=0);
      let depth=0;
      for(let i=start;i<src.length;i++){
        if(src[i]===';'&&src[i+1]===';'){i=src.indexOf('\n',i);continue;}
        if(src[i]==='(')depth++;
        if(src[i]===')'&&--depth===0)return src.slice(start,i+1);
      }throw Error(name);
    }
    const ctx=vm.createContext({console:quiet,TextEncoder,TextDecoder,setTimeout,clearTimeout});
    for(const n of ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js'])
      vm.runInContext(blob('tools/watx-src/'+n,BASE),ctx);
    const names=['handle_WaitForSingleObject','handle_WaitForSingleObjectEx'];
    const code=`(memory 1) (export "memory" (memory 0))
      (import "h" "wait" (func $host_wait_single (param i32 i32) (result i32)))
      (import "h" "ctl" (func $host_process_ctl (param i32 i32 i32) (result i32)))
      (global $reg_base i32 (i32.const 32))
      ${['yield_reason','wait_handle','wait_timeout','wait_stack_bytes','steps','wait_alertable'].map(n=>`(global $${n} (mut i32) (i32.const 0))`).join('\n')}
      (global $last_error (mut i32) (i32.const 1234))
      (export "lastError" (global $last_error))
      (func $io_apc_start (param i32) (result i32) (unreachable))
      ${names.map(n=>wat(n)+`(export "${n}" (func $${n}))`).join('\n')}`;
    const r=ctx.compile(code,new Map(),{standardWat:true,runtimeBuiltins:false});
    assert(r.success,JSON.stringify(r.diagnostics));
    const p=make(),s=spawn(p);p.ctl(7,s.handle,0);const t=waits(p);
    // Execute the actual host wait adapter as well as the actual manager.
    const adapter=cut(host,'    h.wait_single =','    h.wait_multiple =');
    let nested=false;
    const h=vm.runInNewContext(`(self=>{const h={};${adapter}return h;})`,
      {nestedSyncMessage:()=>nested,win32ThreadId:()=>1})({threadManager:t});
    const m=new WebAssembly.Instance(new WebAssembly.Module(r.wasmBinary),{h:{wait:h.wait_single,ctl:p.ctl}});
    const view=new DataView(m.exports.memory.buffer);
    for(const mode of [false,true])for(const n of names){
      nested=mode;
      view.setUint32(48,256,true);m.exports[n](s.handle,0,0,0,0,0);
      assert.equal(view.getUint32(32,true),0xffffffff);
      assert.equal(view.getUint32(48,true),268+(n.endsWith('Ex')?4:0));
      assert.equal(m.exports.lastError.value,6);
    }
    const live=spawn(p), denied=dup(p,live.handle,{access:0x400,options:0});
    assert(denied>0);
    for(const mode of [false,true])for(const n of names){
      nested=mode;
      view.setUint32(48,256,true);m.exports[n](denied,0,0,0,0,0);
      assert.equal(view.getUint32(32,true),0xffffffff);
      assert.equal(m.exports.lastError.value,5);
      // Timeout, event success and the historical unknown-handle fallback
      // do not change last error.
      for(const [handle,expected] of [[live.handle,258],[256,0],[0x123456,0]]){
        t.syncView[2]=1;
        view.setUint32(48,256,true);m.exports[n](handle,0,0,0,0,0);
        assert.equal(view.getUint32(32,true),expected);
        assert.equal(m.exports.lastError.value,5);
      }
      // A valid process cannot be pumped by the nested cooperative adapter;
      // preserve that pre-existing failure without inventing invalid handle.
      if(nested){
        view.setUint32(48,256,true);m.exports[n](live.handle,-1,0,0,0,0);
        assert.equal(view.getUint32(32,true),0xffffffff);
        assert.equal(m.exports.lastError.value,5);
      }
    }
    observations.waitBoundary={invalid:6,denied:5,bytes:r.wasmBinary.length,sha256:sha(r.wasmBinary)};
  });
  console.log(JSON.stringify({candidate:CANDIDATE,base:BASE,passed:checks.length,checks,
    rejectingControls:controls,observations,seals,
    limits:'Actual-source JS and tiny compiled wait APIs. Explicit fixtures replace DOM/VM/launch resources. No full host, guest, browser, Worker, IPC, heap or gameplay execution.'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
