#!/usr/bin/env node
'use strict';
// Source/API review only. No full build, emulator, Worker, game or browser.
// Read immutable Git blobs; execute the exact alias methods/ctl and the exact
// lifetime prefixes. Fixtures supply state, not successful host-service stubs.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {execFileSync, spawnSync} = require('node:child_process');
const crypto = require('node:crypto');
const BASE = '2c58e9dc5d42ecc170b7c86c5b9011a1b265b62b';
const ALIAS = 'eeef32f9091b1bff7ad64d163f09a8822c0914bd';
const SEND = 'db7a1a57e';
const seals = {};
function read(ref, path) {
  const s = execFileSync('git', ['show', `${ref}:${path}`], {encoding:'utf8', maxBuffer:8*1024*1024});
  seals[`${ref}:${path}`] = crypto.createHash('sha256').update(s).digest('hex');
  return s;
}
function between(s, a, b) {
  const i=s.indexOf(a), j=s.indexOf(b,i+a.length);
  assert.ok(i>=0 && j>i, `unique boundaries ${a}`);
  assert.equal(s.indexOf(a,i+1),-1);
  return s.slice(i,j);
}
function method(s, name) {
  const i=s.indexOf(`  ${name}(`); assert.ok(i>=0,name);
  const j=s.indexOf('\n  }',i); assert.ok(j>i);
  return s.slice(i,j+4);
}
const host=read(ALIAS,'host.js');
const methods=method(host,'_processHandleEntry')+'\n'+method(host,'_duplicateProcessHandle');
const ctl=between(host,'    h.process_ctl = (op, pid, arg) => {','    self._processCtl = h.process_ctl;');
const lifetime=between(host,'    if (!this._processObject.exited) {','    // Windows child processes outlive');
const restart=between(host,'    if (this._processObject.exited) {','    const compileEl');
function factory(mutation) {
  let body=methods;
  if (mutation==='close') body=body.replace('sourceHost._processAliases.delete(sourceHandle);','void sourceHandle;');
  const C=vm.runInNewContext(`(class Review {${body}\nretire(){${lifetime}}\nrestart(){${restart}}})`);
  function make(pid) {
    const p=new C();
    p.processId=pid;
    p.memory={buffer:new ArrayBuffer(128)};
    p._processObject={wine:p,exited:false,exitCode:259};
    p._processAliases=new Map(); p._nextProcessAlias=1; p._children=new Map();
    p.ctl=vm.runInNewContext(`(self=>{const h={};${ctl};return h.process_ctl;})`)(p);
    return p;
  }
  return make;
}
function dup(p, src, h, dst, {out=64,access=0,inherit=0,options=2}={}) {
  const f=new DataView(p.memory.buffer);
  [src,h,dst,out,access,inherit,options].forEach((v,i)=>f.setUint32(4+i*4,v,true));
  return p._duplicateProcessHandle(0);
}
const results=[];
function test(name,fn) { fn(); results.push(name); }
test('E6 target ownership, independent aliases, rights, close and stale lookup',()=>{
  const make=factory(), a=make(1), b=make(2);
  a._children.set(0x4004,{wine:b,object:b._processObject,exitCode:259});
  const h=dup(a,-1,-1,0xe44004);
  assert.equal(h,0xe60001); assert.equal(a._processAliases.size,0);
  assert.equal(b._processHandleEntry(h).object,a._processObject);
  assert.equal(b.ctl(8,h,0),0x102);
  const q=dup(b,-1,h,-1,{access:0x400,inherit:1,options:0});
  assert.equal(b._processAliases.get(q).inherit,true);
  assert.equal(b.ctl(6,q,0x400),1);
  assert.equal(b.ctl(6,q,1),-5);
  assert.equal(b.ctl(8,q,0),-1);
  assert.equal(b.ctl(7,h,0),1);
  assert.equal(b.ctl(7,h,0),-6);
  assert.equal(b.ctl(8,h,0),-1);
  assert.equal(b.ctl(6,q,0x400),1);
  assert.equal(a._processObject.exited,false,'close does not terminate object');
  const local=dup(a,-1,-1,-1);
  assert.equal(local,h,'numeric E6 values can coincide in different tables');
  assert.equal(a.ctl(8,local,0),0x102);
  assert.equal(b.ctl(8,local,0),-1,'closed recipient entry stays closed');
});
test('E6 exit 259/full DWORD, owner teardown, restart preserves old object identity',()=>{
  for (const code of [259,0xffffffff]) {
    const make=factory(), a=make(1), b=make(2);
    a._children.set(4,{wine:b,object:b._processObject,exitCode:259});
    const h=dup(a,-1,-1,0xe40004);
    const own=dup(a,-1,-1,-1);
    const old=a._processObject;
    a._exitCode=code; a.retire();
    assert.equal(old.wine,null); assert.equal(old.exited,true);
    assert.equal(a._processAliases.size,0);
    assert.equal(a.ctl(8,own,0),-1);
    assert.equal(b.ctl(8,h,0),0);
    assert.equal(b.ctl(4,h,0),code);
    const copy=dup(b,-1,h,-1);
    assert.ok(copy>0);
    assert.equal(b._processAliases.get(copy).object,old);
    a.restart();
    assert.notEqual(a._processObject,old);
    assert.equal(b._processAliases.get(h).object,old);
    assert.equal(a._processObject.exited,false);
  }
});
function closeFailure(make) {
  const a=make(1), h=dup(a,-1,-1,-1);
  assert.equal(dup(a,-1,h,0x123456,{options:3}),-6);
  assert.equal(a._processAliases.has(h),false,'CLOSE_SOURCE on failure');
}
test('CLOSE_SOURCE failure and rejecting deletion-removal negative control',()=>{
  closeFailure(factory());
  assert.throws(()=>closeFailure(factory('close')),/CLOSE_SOURCE on failure/);
});
test('lifetime-bit negative control rejects exit-code-only wait',()=>{
  const a=factory()(1), h=dup(a,-1,-1,-1), entry=a._processAliases.get(h);
  entry.object.exited=true; entry.object.exitCode=259;
  assert.equal(a.ctl(8,h,0),0);
  const changed=ctl.replace('object.exited ? 0 : 0x102','object.exitCode !== 259 ? 0 : 0x102');
  assert.notEqual(changed,ctl);
  const bad=vm.runInNewContext(`(self=>{const h={};${changed};return h.process_ctl;})`)(a);
  assert.throws(()=>assert.equal(bad(8,h,0),0),assert.AssertionError);
});
test('documented gap: NULL output rejected without allocating alias',()=>{
  const a=factory()(1);
  assert.equal(dup(a,-1,-1,-1,{out:0}),-87);
  assert.equal(a._processAliases.size,0);
});
test('documented gap: NULL target close-only deletes source but returns invalid handle',()=>{
  const a=factory()(1), h=dup(a,-1,-1,-1);
  assert.equal(dup(a,-1,h,0,{out:0,options:1}),-6);
  assert.equal(a._processAliases.has(h),false);
});
test('E4 alias disagreement after exit 259; legacy record retains host',()=>{
  const make=factory(), a=make(1), b=make(2);
  const record={wine:b,object:b._processObject,exitCode:259};
  a._children.set(4,record);
  const h=dup(a,-1,0xe40004,-1);
  b._exitCode=259; b.retire();
  assert.equal(a.ctl(8,h,0),0);
  assert.equal(a.ctl(0,4,0),259);
  assert.equal(record.wine,b);
  const tm=read(ALIAS,'lib/thread-manager.js');
  assert.match(tm,/if \(code !== 259\) return 0;/);
  assert.match(tm,/return timeout === 0 \? 0x102 : 0xFFFF;/);
});
test('monotonic alias allocation, exhaustion, source close survives exhaustion',()=>{
  const a=factory()(1), h=dup(a,-1,-1,-1);
  a.ctl(7,h,0);
  const next=dup(a,-1,-1,-1);
  assert.ok(next>h);
  a._nextProcessAlias=0x10000;
  assert.equal(dup(a,-1,next,-1,{options:3}),-4);
  assert.equal(a._processAliases.has(next),false);
});
const main=read(BASE,'host.js');
test('main lacks aliases and db7 snapshot does not contain eeef aliases either',()=>{
  for(const s of [main,read(SEND,'host.js')]) {
    assert.doesNotMatch(s,/_duplicateProcessHandle|_processObject|_processAliases/);
  }
  for(const ref of [ALIAS,SEND]) {
    assert.equal(spawnSync('git',['merge-base','--is-ancestor',ref,BASE]).status,1);
  }
  assert.equal(spawnSync('git',['merge-base','--is-ancestor','8cad41987',BASE]).status,0);
});
test('main retains send wiring, E4 fallback and no E6 API regression',()=>{
  assert.match(main,/_installProcessSendBroker\(worker\)/);
  assert.match(main,/backend\.processSendResolver =/);
  assert.match(main,/\.retire\(this\._processSendEndpoint\)/);
  assert.match(main,/notifyReady\(self\._processSendEndpoint\)/);
  const sw=read(BASE,'src/09a5-handlers-window.wat');
  const old=read(SEND,'src/09a5-handlers-window.wat');
  const start="    ;; A foreign application's scalar message";
  const end='    ;; HWND_BROADCAST';
  assert.equal(between(sw,start,end),between(old,start,end));
  const dupWat=read(BASE,'src/09a7d-handlers-shell-file.wat');
  assert.doesNotMatch(dupWat,/0x00E60000/);
  assert.match(dupWat,/\(then \(local.set \$duplicate \(local.get \$arg1\)\)\)/);
  const fs=read(BASE,'lib/filesystem.js');
  assert.match(fs,/if \(!source\) return handle >= 0x70000000 && handle <= 0x7fffffff \? -6 : 0;/);
  assert.match(read(BASE,'lib/host-imports.js'),/process_ctl: \(op, pid, arg\) => -1/);
  assert.doesNotMatch(read(BASE,'test/test-child-process-object.js'),/t_DuplicateHandle|_processAliases/);
  for(const path of ['src/09a0-handlers-base.wat','src/09a0b-handlers-base-late.wat','lib/thread-manager.js'])
    assert.doesNotMatch(read(BASE,path),/0x00E60000/);
});
test('retained E4 CloseHandle has no child-record close path',()=>{
  const wat=read(ALIAS,'src/09a0-handlers-base.wat');
  const close=between(wat,'  (func $handle_CloseHandle','  ;; OpenThreadToken');
  assert.match(close,/0x00E60000/);
  assert.doesNotMatch(close,/0x00E40000|pipe_child_pid/);
  assert.match(close,/\$host_fs_close_handle/);
  const fs=read(ALIAS,'lib/filesystem.js');
  const m=method(fs,'closeHandle');
  const C=vm.runInNewContext(`(class {${m}})`);
  const v=new C(); v.handles=new Map(); v.findHandles=new Map();
  assert.equal(v.closeHandle(0xe44004),true);
  assert.equal(v.closeHandle(0xe44004),true);
});
console.log(JSON.stringify({base:BASE,alias:ALIAS,send:SEND,
  scope:'exact extracted JS alias methods/ctl/lifetime prefixes plus source reconciliation; no full API/WASM/game execution',
  passed:results.length,checks:results,seals},null,2));
