#!/usr/bin/env node
'use strict';
// Run from the repository root. No full build, browser, worker or guest runtime.
// Exact source methods and exact process-only API prefixes run against explicit
// small state fixtures. Unselected WAT branches trap, never silently succeed.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const BASE = 'a54049d11955307d06309e146e85c1aca3196657';
const seals = {}, results = [], binaries = [];
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
function read(p) { const s=fs.readFileSync(p,'utf8'); seals[p]=hash(s); return s; }
function blob(p) { return execFileSync('git',['show',`${BASE}:${p}`],{encoding:'utf8',maxBuffer:8e6}); }
function between(s,a,b) {
  const i=s.indexOf(a),j=s.indexOf(b,i+a.length);
  assert(i>=0 && j>i,a); return s.slice(i,j);
}
function method(s,n) {
  const i=s.indexOf(`  ${n}(`),j=s.indexOf('\n  }',i);
  assert(i>=0 && j>i,n); return s.slice(i,j+4);
}
function watFunc(s,n) {
  const start=s.indexOf('(func $'+n+' '); assert(start>=0,n);
  let depth=0;
  for(let i=start;i<s.length;i++) {
    if(s[i]===';' && s[i+1]===';') {i=s.indexOf('\n',i);continue;}
    if(s[i]==='(')depth++;
    if(s[i]===')' && --depth===0)return s.slice(start,i+1);
  }
  throw Error(n);
}
function test(n,f) {f();results.push(n);}
const host=read('host.js'),tm=read('lib/thread-manager.js'),cli=read('test/run.js');
const ctl=between(host,'    h.process_ctl = (op, pid, arg) => {','    self._processCtl =');
const retire=between(host,'    if (!this._processObject.exited) {','    if (this._processSendEndpoint');
const restart=between(host,'    if (this._processObject.exited) {','    const compileEl');
const methods=method(host,'_processHandleEntry')+'\n'+method(host,'_duplicateProcessHandle');
function makeFactory(mutation) {
  let body=methods, c=ctl, r=retire;
  if(mutation==='null-output')body=body.replace('      const access =','      if (!frame.getUint32(16, true)) return -87;\n      const access =');
  if(mutation==='close-only')body=body.replace('&& (options & 1)) return 1;','&& (options & 1)) return -6;');
  if(mutation==='source-close')body=body.replace('sourceHost._processAliases.delete(sourceHandle);','void sourceHandle;');
  if(mutation==='exit-code')c=c.replace('object.exited ? 0 : 0x102','object.exitCode !== 259 ? 0 : 0x102');
  if(mutation==='close-e4')c=c.replace('self._children.delete(pid & 0xFFFF);','void pid;');
  if(mutation==='retain-host')r=r.replace('this._processObject.wine = null;','void this;');
  const C=vm.runInNewContext(`(class {${body}\nstop(){${r}}\nrestart(){${restart}}})`);
  return pid => {
    const p=new C();
    p.processId=pid; p.memory=new WebAssembly.Memory({initial:1});
    p._processObject={wine:p,exited:false,exitCode:259};
    p._children=new Map(); p._processAliases=new Map(); p._nextProcessAlias=1;
    p.ctl=vm.runInNewContext(`(self=>{const h={};${c};return h.process_ctl;})`)(p);
    return p;
  };
}
function child(a,b,pid=4) {
  const rec={object:b._processObject,exited:false,exitCode:259,ip:123};
  a._children.set(pid,rec);return 0xe40000|pid;
}
function dup(p,src,h,dst,{out=128,access=0,inherit=0,options=2}={}) {
  const d=new DataView(p.memory.buffer);
  [src,h,dst,out,access,inherit,options].forEach((v,i)=>d.setUint32(260+i*4,v,true));
  return p.ctl(3,256,0);
}
const make=makeFactory();
const T=vm.runInNewContext(`(class {${['_getSyncIdx','_resolveThreadHandle','waitSingle','waitMultiple'].map(n=>method(tm,n)).join('\n')}})`);
function waits(p) {
  const t=new T();t.memory=p.memory;t.processCtl=p.ctl;
  t._syncHandleToIdx=new Map([[0x100,0]]);t._syncCurrentHandles=[0x100];
  t.syncView=new Int32Array(new SharedArrayBuffer(16));
  t.syncView.set([0,1,1,0]); // a real auto-reset event
  t.threads=new Map();t._pendingThreads=[];t._threadHandleAliases=new Map();
  t.multiple=(handles,all,timeout=0)=>{
    new Uint32Array(p.memory.buffer,512,handles.length).set(handles);
    return t.waitMultiple(handles.length,512,all,timeout);
  };
  return t;
}
test('target-owned identities, same numeric values, rights and inheritance',()=>{
  const a=make(1),b=make(2),e4=child(a,b);
  const h=dup(a,-1,-1,e4),local=dup(a,-1,-1,-1);
  assert.equal(h,0xe60001);assert.equal(local,h);
  assert.equal(b._processAliases.get(h).object,a._processObject);
  assert.equal(a._processAliases.get(local).object,a._processObject);
  const q=dup(b,-1,h,-1,{access:0x400,inherit:1,options:0});
  assert.equal(b._processAliases.get(q).inherit,true);
  assert.equal(b.ctl(6,q,0x400),1);assert.equal(b.ctl(5,q,0),-5);
  assert.equal(b.ctl(8,q,0),-1);
  assert.equal(dup(b,-1,q,-1,{access:1,options:0}),-5);
  assert.equal(dup(b,q,h,-1),-5,'source owner requires DUP_HANDLE');
  assert.equal(dup(b,-1,h,q),-5,'target owner requires DUP_HANDLE');
});
function nullShapes(factory) {
  const a=factory(1),b=factory(2),h=child(a,b);
  assert(dup(a,-1,h,-1,{out:0})>0);
  assert.equal(a._processAliases.size,1);
  assert.equal(dup(a,-1,h,0,{out:0,options:1}),1);
  assert.equal(a._children.has(4),false);
  assert.equal(b._processObject.exited,false);
}
test('D1 NULL output allocates; NULL target CLOSE_SOURCE succeeds',()=>nullShapes(make));
function closeChecks(factory) {
  const a=factory(1),b=factory(2),e4=child(a,b),h=dup(a,-1,e4,-1);
  assert.equal(a.ctl(7,e4,0),1);assert.equal(a.ctl(7,e4,0),-6);
  assert.equal(dup(a,-1,e4,-1),-6);
  assert.equal(a.ctl(8,h,0),0x102);assert.equal(b._processObject.exited,false);
  assert.equal(a.ctl(7,h,0),1);assert.equal(a.ctl(7,h,0),-6);
  assert.equal(b._processObject.exited,false);
  const e42=child(a,b,8),h2=dup(a,-1,e42,-1);
  assert.equal(a.ctl(7,h2,0),1);assert.equal(a.ctl(8,e42,0),0x102);
}
test('D2 E4/E6 independent close; repeated close/query/dup reject stale handle',()=>closeChecks(make));
function exitedChecks(factory) {
  for(const code of [0,1,259,0x7fffffff,0x80000000,0xfffffffe,0xffffffff]) {
    const a=factory(1),b=factory(2),e4=child(a,b),h=dup(a,-1,e4,-1),t=waits(a);
    assert.equal(t.waitSingle(e4,0),0x102);assert.equal(t.waitSingle(h,1),0xffff);
    b._exitCode=code;b.stop();
    for(const handle of [e4,h]) {
      assert.equal(a.ctl(6,handle,0x400),1);assert.equal(a.ctl(4,handle,0),code);
      assert.equal(t.waitSingle(handle,0),0);
      assert.equal(a.ctl(5,handle,12),-5);
    }
    assert.equal(a.ctl(0,4,0),code);assert.equal(a.ctl(2,4,0),1);
    assert.equal(t.multiple([e4,h],true),0);
    assert.equal(t.multiple([e4,h],false),0);
    assert.equal(b._processObject.exitCode,code);
  }
}
test('D3 E4/E6 exit-bit agreement across full DWORD boundary values',()=>exitedChecks(make));
test('wait-all and wait-any reject invalid process handles before consuming events',()=>{
  const a=make(1),b=make(2),e4=child(a,b),h=dup(a,-1,e4,-1),t=waits(a);
  for(const process of [e4,h]) {
    t.syncView[2]=1;
    assert.equal(t.multiple([0x100,process],true),0x102);
    assert.equal(t.syncView[2],1);
    assert.equal(t.multiple([process],true,1),0xffff);
    a.ctl(7,process,0);
    for(const all of [true,false]) {
      assert.equal(t.multiple([0x100,process],all),0xffffffff);
      assert.equal(t.syncView[2],1);
    }
    assert.equal(t.waitSingle(process,0),0xffffffff);
  }
});
function failureClose(factory) {
  const a=factory(1),h=dup(a,-1,-1,-1);
  assert.equal(dup(a,-1,h,0x12345,{options:3}),-6);
  assert.equal(a._processAliases.has(h),false);
}
test('CLOSE_SOURCE on target/access/options/exhaustion failures and no stale reuse',()=>{
  failureClose(make);
  for(const mode of ['access','options','exhaustion']) {
    const a=make(1),h=dup(a,-1,-1,-1);
    const opts={options:1};
    if(mode==='access')opts.access=0x80000000;
    if(mode==='options')opts.options=5;
    if(mode==='exhaustion')a._nextProcessAlias=0x10000;
    assert(dup(a,-1,h,-1,opts)<0);assert.equal(a._processAliases.has(h),false);
  }
  const a=make(1),h=dup(a,-1,-1,-1);a.ctl(7,h,0);
  assert(dup(a,-1,-1,-1)>h);
});
function releaseCheck(factory) {
  const a=factory(1),b=factory(2),e4=child(a,b),h=dup(a,-1,e4,-1);
  const rec=a._children.get(4),old=b._processObject;
  b._exitCode=259;b.stop();
  assert.equal(old.wine,null);assert.equal(rec.wine,undefined);
  assert.equal(rec.object,old);assert.equal(a._processAliases.get(h).object,old);
  b.restart();assert.notEqual(b._processObject,old);
  assert.equal(a.ctl(8,h,0),0);
}
test('exit drops host references; restart retains old object identity',()=>releaseCheck(make));
test('owner teardown clears its tables but leaves child live and recipient aliases valid',()=>{
  const a=make(1),b=make(2),e4=child(a,b),h=dup(a,-1,-1,e4);
  dup(a,-1,-1,-1);a._exitCode=0xffffffff;a.stop();
  assert.equal(a._children.size,0);assert.equal(a._processAliases.size,0);
  assert.equal(b._processObject.exited,false);
  assert.equal(b.ctl(4,h,0),0xffffffff);assert.equal(b.ctl(8,h,0),0);
  const copy=dup(b,-1,h,-1);assert(copy>0);
  assert.equal(dup(b,h,h,-1),-6,'exited owner cannot resurrect its table');
});
test('actual onExit callback merges once including exit259; close does not own callback',()=>{
  // Extract the complete callback, ending before its ownership assignment.
  // Launch declaration/try syntax is outside this function's boundary.
  const callback=between(host,'      const onExit = (child, outcome) => {','      rec.object.complete = onExit;');
  assert(callback.endsWith('      };\n'),'complete onExit declaration');
  const wireModule={exports:{}};
  vm.runInNewContext(read('lib/vlan-wire.js'),{module:wireModule,exports:wireModule.exports,require});
  const segment=new wireModule.exports.LoopbackSegment();
  const callerWire=segment.attach(),childWire=segment.attach(),sibling=segment.attach();
  childWire.deliver(new Uint8Array([9]));
  childWire.onFrame=()=>assert.fail('retired callback invoked');
  childWire.onDeliver=()=>assert.fail('retired delivery invoked');
  const a=make(1),b=make(2),e4=child(a,b),rec=a._children.get(4),calls=[];
  const vfs={mergeChildFrom(before,childVfs) {
    assert.equal(before,'snapshot');assert.equal(childVfs,'child-vfs');
    calls.push('merge');return {written:1,deleted:0};
  }};
  b._helpCtx={vfs:'child-vfs'};
  const peerGone=callerWire.peerGone.bind(callerWire);
  callerWire.peerGone=ip=>{assert.equal(ip,123);calls.push('eof');peerGone(ip);};
  const cb=vm.runInNewContext(`((rec,vfs,self,childWire)=>{const before='snapshot',pipes=true,ip=123,file='fixture';${callback};return onExit;})`,{console:{log(){}}})(rec,vfs,{vlanWire:callerWire},childWire);
  a.ctl(7,e4,0);b._exitCode=259;b.stop();cb(b);cb(b);
  assert.deepEqual(calls,['merge','eof']);assert.equal(rec.exited,true);assert.equal(rec.exitCode,259);
  assert.equal(segment.endpoints.length,2,'callback retires only child endpoint');
  assert.equal(segment.endpoints[0],callerWire);assert.equal(segment.endpoints[1],sibling);
  assert.equal(childWire.segment,null);assert.equal(childWire.pending,0);
  assert.equal(childWire.onFrame,null);assert.equal(childWire.onDeliver,null);
  assert.equal(callerWire.pending,1,'one real EOF frame');
  const gone=callerWire.peek(),view=new DataView(gone.buffer,gone.byteOffset,gone.byteLength);
  assert.equal(view.getUint32(4,true),7);assert.equal(view.getUint32(8,true),123);
  callerWire.commit();
  const frame=new Uint8Array([1,2,3]);
  assert.equal(callerWire.send(frame),true);assert.equal(sibling.peek(),frame);
  assert.equal(childWire.pending,0);assert.equal(childWire.send(frame),false);
});
test('negative controls reject D1, D2, D3, source-close and host-retention regressions',()=>{
  for(const [mutation,check] of [
    ['null-output',nullShapes],['close-only',nullShapes],['close-e4',closeChecks],
    ['exit-code',exitedChecks],['source-close',failureClose],['retain-host',releaseCheck],
  ]) assert.throws(()=>check(makeFactory(mutation)),assert.AssertionError,mutation);
});
// Compile only the unchanged process branch text from each complete handler.
// The remainder is an explicit trap, allowing no silent unrelated host stubs.
const compiler=vm.createContext({console:{log(){},warn(){},error(){}},TextEncoder,TextDecoder,Float32Array,Float64Array,
  Uint8Array,ArrayBuffer,Map,Set,RegExp,Array,Object,String,Number,Math,Promise,Date,
  setTimeout,clearTimeout,setImmediate,parseInt,parseFloat,isNaN});
for(const name of ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js']) {
  const s=blob('tools/watx-src/'+name);seals['compiler/'+name]=hash(s);vm.runInContext(s,compiler);
}
const branchDefs=[
  ['CloseHandle','src/09a0-handlers-base.wat','    (local.set $console_result (call $toolhelp_close'],
  ['TerminateProcess','src/09a0-handlers-base.wat','    (call $host_exit'],
  ['GetExitCodeProcess','src/09a0b-handlers-base-late.wat','    (if (local.get $arg1)\n'],
  ['DuplicateHandle','src/09a7d-handlers-shell-file.wat','    ;; An anonymous pipe'],
];
function compiled(mutation) {
  let body=branchDefs.map(([name,p,end])=>{
    const f=watFunc(read(p),'handle_'+name),i=f.indexOf(end);assert(i>=0,name);
    return f.slice(0,i)+'    (unreachable))\n(export "'+name+'" (func $handle_'+name+'))';
  }).join('\n');
  if(mutation==='null-store')body=body.replace('(i32.ne (local.get $arg3) (i32.const 0))','(i32.const 1)');
  if(mutation==='sentinel')body=body.replace('(call $host_process_ctl (i32.const 6) (local.get $arg0) (i32.const 0x400))',
    '(if (result i32) (i32.eq (call $host_process_ctl (i32.const 4) (local.get $arg0) (i32.const 0)) (i32.const -1)) (then (i32.const -6)) (else (i32.const 1)))');
  const pipes=blob('src/09d7-pipes.wat');
  const wat=`
    (import "h" "memory" (memory 1))
    (import "h" "ctl" (func $host_process_ctl (param i32 i32 i32) (result i32)))
    (global $reg_base i32 (i32.const 32))
    (global $last_error (mut i32) (i32.const 0))
    (export "error" (global $last_error))
    ;; Fixture has a one-page identity guest mapping; all output stores observed.
    (func $g2w (param $p i32) (result i32) (local.get $p))
    (func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
    ${watFunc(pipes,'pipe_ret')}
    ${watFunc(pipes,'pipe_child_pid')}
    ${body}`;
  const r=compiler.compile(wat,new Map(),{standardWat:true,runtimeBuiltins:false});
  assert(r.success,JSON.stringify(r.diagnostics));
  const bytes=r.wasmBinary;assert(WebAssembly.validate(bytes));
  binaries.push({mutation:mutation||null,bytes:bytes.length,sha256:hash(bytes)});
  const module=new WebAssembly.Module(bytes);
  return p=>{
    const i=new WebAssembly.Instance(module,{h:{memory:p.memory,ctl:p.ctl}}),dv=new DataView(p.memory.buffer);
    return (name,args)=>{
      dv.setUint32(48,256,true); // fixture register ESP
      args.forEach((v,j)=>dv.setUint32(260+j*4,v>>>0,true));
      dv.setUint32(0,0xaabbccdd,true);
      i.exports[name](...args.slice(0,5),...Array(Math.max(0,6-Math.min(args.length,5))).fill(0));
      return {ok:dv.getUint32(32,true),error:i.exports.error.value>>>0,
        esp:dv.getUint32(48,true),zero:dv.getUint32(0,true),output:dv.getUint32(128,true)};
    };
  };
}
function apiChecks(build) {
  const a=make(1),b=make(2),e4=child(a,b),call=build(a);
  let r=call('DuplicateHandle',[-1,e4,-1,0,0,0,2]);
  assert.equal(r.ok,1);assert.equal(r.zero,0xaabbccdd);assert.equal(r.esp,288);
  r=call('DuplicateHandle',[-1,e4,-1,128,0,0,2]);
  const h=r.output;assert.equal(r.ok,1);assert(h>=0xe60001);
  r=call('DuplicateHandle',[-1,e4,0,128,0,0,1]);
  assert.equal(r.ok,1);assert.equal(r.output,h,'close-only ignores output');
  assert.equal(call('CloseHandle',[e4]).error,6);
  r=call('GetExitCodeProcess',[h,128]);assert.equal(r.ok,1);assert.equal(r.output,259);assert.equal(r.esp,268);
  assert.equal(call('GetExitCodeProcess',[h,0]).error,87);
  b._exitCode=0xffffffff;b.stop();
  for(const handle of [h,child(a,b,8)]) {
    r=call('GetExitCodeProcess',[handle,128]);
    assert.equal(r.ok,1);assert.equal(r.output,0xffffffff);
    r=call('TerminateProcess',[handle,12]);assert.equal(r.ok,0);assert.equal(r.error,5);assert.equal(r.esp,268);
    r=call('CloseHandle',[handle]);assert.equal(r.ok,1);assert.equal(r.esp,264);
    r=call('GetExitCodeProcess',[handle,128]);assert.equal(r.ok,0);assert.equal(r.error,6);
  }
  const c=make(3),e42=child(a,c,12);
  r=call('TerminateProcess',[e42,259]);assert.equal(r.ok,1);assert.equal(c._processObject.exited,true);
  assert.equal(c._processObject.exitCode,259);
}
test('compiled actual WAT process branches: D1-D3, errors, stores and stdcall cleanup',()=>apiChecks(compiled()));
test('compiled two-memory transfer, E6 termination DWORD, rights and failed CLOSE_SOURCE',()=>{
  const build=compiled(),a=make(1),b=make(2),e4=child(a,b),ca=build(a),cb=build(b);
  let r=ca('DuplicateHandle',[-1,-1,e4,128,0,0,2]);const h=r.output;
  assert.equal(r.ok,1);assert.equal(a._processAliases.size,0);
  assert.equal(b._processAliases.get(h).object,a._processObject);
  assert.equal(new DataView(b.memory.buffer).getUint32(128,true),0,'output belongs to caller memory');
  r=cb('DuplicateHandle',[-1,h,-1,128,0x400,1,0]);const query=r.output;
  assert.equal(cb('TerminateProcess',[query,0]).error,5);
  assert.equal(cb('GetExitCodeProcess',[query,128]).output,259);
  assert.equal(cb('TerminateProcess',[h,0xffffffff]).ok,1);
  assert.equal(cb('GetExitCodeProcess',[query,128]).output,0xffffffff);
  r=cb('DuplicateHandle',[-1,query,0x1234,128,0,0,3]);
  assert.equal(r.ok,0);assert.equal(r.error,6);
  assert.equal(cb('CloseHandle',[query]).error,6);
  r=cb('DuplicateHandle',[-1,h,0,0,0,0,1]);
  assert.equal(r.ok,1);assert.equal(r.zero,0xaabbccdd);
  assert.equal(cb('CloseHandle',[h]).error,6);
});
test('compiled negative controls reject NULL store and full32 sentinel collisions',()=>{
  assert.throws(()=>apiChecks(compiled('null-store')),assert.AssertionError);
  assert.throws(()=>apiChecks(compiled('sentinel')),assert.AssertionError);
});
test('actual CLI ctl has explicit unsupported alias result and E4 full32 close/wait',()=>{
  const body=between(cli,'  const processCtl = (op, pid, arg) => {','  h.process_ctl = processCtl;');
  const records=new Map(),calls=[];
  const ctl=vm.runInNewContext(`(pipeChildByPid=>{${body};return processCtl;})`)(records);
  assert.equal(ctl(3,0,0),-50);assert.equal(ctl(8,0xe60001,0),-1);
  for(const code of [259,0xffffffff]) {
    const r={child:{kill(){calls.push('kill');}},exited:false,exitCode:259};records.set(4,r);
    assert.equal(ctl(8,0xe40004,0),0x102);
    assert.equal(ctl(5,0xe40004,code),1);assert.equal(ctl(4,0xe40004,0),code);
    assert.equal(ctl(8,0xe40004,0),0);assert.equal(ctl(5,0xe40004,0),-5);
    assert.equal(ctl(7,0xe40004,0),1);assert.equal(ctl(7,0xe40004,0),-6);
  }
  assert.equal(calls.length,2);
  const r={child:{kill(){throw Error('close terminated child');}},exited:false,exitCode:259};
  records.set(4,r);assert.equal(ctl(7,0xe40004,0),1);assert.equal(r.exited,false);
});
test('actual CLI pipe exit callbacks do not overwrite code259 or full32 and retire once',()=>{
  const callbacks=between(cli.slice(cli.indexOf('    ctx.vlanWire.addChild(child, ip);')),
    "    child.on('message', msg => {",'    if (pipeChildren.length === 1)');
  const {EventEmitter}=require('node:events');
  for(const code of [259,0xffffffff]) {
    const child=new EventEmitter(),rec={child,exited:false,exitCode:259};
    const live=new Set([rec]);
    vm.runInNewContext(`((child,rec,livePipeChildren)=>{${callbacks}})`)(child,rec,live);
    child.emit('message',{t:'child-exit',code});
    child.emit('exit',0);child.emit('exit',1);
    assert.equal(rec.exitCode,code);assert.equal(rec.exited,true);assert.equal(live.size,0);
  }
});
test('existing full-VM regression fixture agrees with actual host for E4 operations',()=>{
  const source=read('test/test-child-process-object.js');
  const body=between(source,'  const processCtl = (op, pid, arg) => {','  const harness =');
  for(const code of [7,259,0xffffffff]) {
    const a=make(1),b=make(2),h=child(a,b,0x4004);
    const records=new Map([[0x4004,{exited:false,exitCode:259}]]);
    const fixture=vm.runInNewContext(`(children=>{const ctlCalls=[];${body};return processCtl;})`)(records);
    for(const [op,arg] of [[6,0x400],[4,0],[8,0],[5,code],[4,0],[8,0],[5,0],[7,0],[8,0],[6,0x400]])
      assert.equal(fixture(op,h,arg),a.ctl(op,h,arg),`op${op}/code${code}`);
  }
});
test('callback/send ownership and monotonic allocation remain explicit in actual source',()=>{
  const original=blob('host.js');
  for(const n of ['_installProcessSendBroker','_stopGuestRuntime','_releaseGuestMemory'])
    assert.equal(method(host,n),method(original,n),n);
  assert.equal(between(host,'    if (this._processSendEndpoint &&','    // Closing the owner'),
    between(original,'    if (this._processSendEndpoint &&','    // Child processes'));
  assert.equal(between(host,'    if (this._manifestAssetAbort)','  _stopGuestRuntime()'),
    between(original,'    if (this._manifestAssetAbort)','  _stopGuestRuntime()'));
  assert.match(host,/const pid = self\._nextChildPid \|\| 0x4004;\n      if \(pid > 0xFFFF\) return 0;\n      self\._nextChildPid = pid \+ 4;/);
  assert.doesNotMatch(host,/_stopChildren|rec\.wine/);
  const fallback=read('lib/host-imports.js').match(/process_ctl: ([^\n]+),/)[1];
  const fn=vm.runInNewContext('('+fallback+')');
  assert.equal(fn(3,0,0),-50);assert.equal(fn(6,0xe40004,0),-6);
});
console.log(JSON.stringify({base:BASE,passed:results.length,checks:results,binaries,seals,
  limits:'Exact JS extraction and process-only WAT slices; identity guest-memory fixture. No full host/VM, Worker RPC, browser, IPC or gameplay qualification.'},null,2));
