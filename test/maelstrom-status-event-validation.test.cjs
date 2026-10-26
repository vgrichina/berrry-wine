'use strict';
// JS export-boundary controls. No Wasm compilation/instantiation or guest.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const h = require('../tools/maelstrom-native-errno-latch.cjs');
const {createAdapter} = require('../tools/maelstrom-original-errno-adapter.cjs');
const {parse, func, walk} = require('./maelstrom-select-hook-model.cjs');
const SELECT = ['started','phase','token','entries','parks','completions','fault','capped','active','thread','regs','pre','post','ret','result'];
let passed=0, cases=0;
function test(name, fn) { fn(); passed++; console.log('PASS '+name); }
function fixture(legacy=false) {
  const n=Object.fromEntries(h.FIELDS.map(k=>[k,0])), effects=[], reads=[];
  const exports={mne_start(){effects.push('start');n.status=1;}};
  for(const k of h.FIELDS)exports['mne_'+k]=()=>{reads.push(k);return n[k];};
  for(const k of SELECT)exports['msc_'+k]=()=>{reads.push('msc_'+k);return 0;};
  if(!legacy)for(const k of h.DIAGNOSTIC_FIELDS)exports['mne_'+k]=()=>{reads.push(k);return 0;};
  const a=createAdapter({exports},{readLive(){effects.push('live');return {};},persist(r){effects.push(r);}});
  return {n,a,exports,effects,reads};
}
function invalid(f, op) {
  const effects=f.effects.length;
  assert.throws(op,/invalid native|nonpristine/);
  assert.equal(f.effects.length,effects,'callbacks must not run');
  const reads=f.reads.length;
  assert.equal(f.a.observe(99),null);
  assert.equal(f.reads.length,reads,'closed adapter must not read exports');
  cases++;
}
const pairs=[[0,0],[1,0],[2,1],[3,2],[4,3],[5,0],[5,1],[5,2]];
const key=([s,e])=>s+'/'+e;
test('state table is bound to exact generated start/complete/CALL/RET and rejection writes',()=>{
  const sources=Object.fromEntries(Object.keys(h.PINS).map(p=>[p,fs.readFileSync(path.join(process.env.MNE_SOURCE_ROOT,p),'utf8')]));
  const binaries={net:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'SDL_net.dll')),
    exe:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'Maelstrom.exe')),crt:fs.readFileSync(process.env.MNE_CRT)};
  const w=h.transform(sources,{enabled:true,binaries,crtLoadedBase:0x522000})['src/09d-winsock.wat'];
  const ast=parse(w.split(';; Opt-in native errno successor latch.')[1]);
  const start=ast.find(n=>n[0]==='func'&&Array.isArray(n[1])&&n[1][0]==='export'&&n[1][1]==='"mne_start"');
  const states=[];
  for(const [body,status,event] of [[start,1,null],[func(w,'mne_complete'),2,1],
      [func(w,'mne_call'),3,2],[func(w,'mne_return'),4,3]]){
    const writes=[];walk(body,n=>{if(n[0]==='global.set'&&['$mne_status','$mne_event'].includes(n[1]))writes.push([n[1],n[2]]);});
    assert(writes.some(([k,v])=>k==='$mne_status'&&v[0]==='i32.const'&&Number(v[1])===status));
    const events=writes.filter(([k])=>k==='$mne_event').map(([,v])=>Number(v[1]));
    assert.deepEqual(events,event===null?[]:[event]);
    for(const [k,v]of writes)if(k==='$mne_status')assert([status,5].includes(Number(v[1])));
    states.push([status,event??0]);cases++;
  }
  // Rejection is status-only at all three stages; no reset or event3 rejection.
  assert.deepEqual(pairs,[[0,0],...states,[5,0],[5,1],[5,2]]);
});
test('status/event cross product accepts exactly reachable states after start, including legacy',()=>{
  const values=[-0x80000000,-1,0,1,2,3,4,5,6,99,0x7fffffff,0x80000000,0xffffffff];
  const legal=new Set(pairs.slice(1).map(key));
  for(const legacy of [false,true])for(const status of values)for(const event of values){
    const f=fixture(legacy);f.a.start();Object.assign(f.n,{status,event});
    if(!legal.has(key([status,event])))invalid(f,()=>f.a.observe(1));
    else {
      if(status===5)assert.throws(()=>f.a.observe(1),/status rejection/);
      else assert.equal(f.a.observe(1).kind,status===4?'captured':'pending');
      cases++;
    }
  }
});
test('all observed temporal edges allow skipped native steps and reject backwards events/states',()=>{
  for(const legacy of [false,true])for(const from of [[1,0],[2,1],[3,2]])for(const to of pairs){
    const f=fixture(legacy);f.a.start();Object.assign(f.n,{status:from[0],event:from[1]});f.a.observe(0);
    Object.assign(f.n,{status:to[0],event:to[1]});
    const legal=to[0]>=from[0]&&to[1]>=from[1];
    if(!legal)invalid(f,()=>f.a.observe(1));
    else {if(to[0]===5)assert.throws(()=>f.a.observe(1),/status rejection/);else f.a.observe(1);cases++;}
  }
});
test('pristine start and synchronous start output are validated before callbacks',()=>{
  for(const legacy of [false,true])for(const [status,event]of pairs){
    const f=fixture(legacy);Object.assign(f.n,{status,event});
    if(status===0){f.a.start();cases++;}else invalid(f,()=>f.a.start());
  }
  for(const [status,event]of [[0,0],[1,1],[2,1],[3,2],[4,3],[5,1],[5,2],[99,0]]){
    const f=fixture();f.exports.mne_start=()=>Object.assign(f.n,{status,event});invalid(f,()=>f.a.start());
  }
  // Native start may reject mode/previous-select state; preserve legacy record order.
  for(const legacy of [false,true]){
    const f=fixture(legacy);f.exports.mne_start=()=>{f.n.status=5;};
    assert.throws(()=>f.a.start(),/start rejected/);assert.equal(f.effects[0],'live');
    assert.equal(f.effects[1].historicalNativeLatch.status,5);assert.equal(f.a.observe(1),null);cases++;
  }
});
test('raw status/event rejected before normalization, diagnostics, select reads or callbacks',()=>{
  for(const field of ['status','event'])for(const raw of [NaN,undefined,1.5,'1',-1,-0x80000000,0x100000000]){
    const f=fixture();f.a.start();f.reads.length=0;f.n[field]=raw;
    invalid(f,()=>f.a.observe(1));
    assert(!f.reads.some(k=>k.startsWith('msc_')||h.DIAGNOSTIC_FIELDS.includes(k)));
  }
});
test('signed i32 and unsigned endpoints still preserve unconstrained native and select scalars',()=>{
  const values=[-0x80000000,-1,0,1,0x7fffffff,0x80000000,0xffffffff];
  for(const legacy of [false,true])for(const field of h.FIELDS.filter(k=>!['status','event'].includes(k)))for(const value of values){
    const f=fixture(legacy);f.a.start();Object.assign(f.n,{status:4,event:3,[field]:value});
    const r=f.a.observe(1);assert.equal(r.historicalNativeLatch[field],value>>>0);cases++;
  }
  for(const legacy of [false,true])for(const field of SELECT)for(const value of values){
    const f=fixture(legacy);f.a.start();f.exports['msc_'+field]=()=>value;
    const r=f.a.observe(1);assert.equal(r.historicalSelectLatch[field],value>>>0);cases++;
  }
});
test('capture and each legal rejection event remain immutable and close without resampling',()=>{
  for(const legacy of [false,true])for(const errno of [0,0x12345678])for(const via of [[],[[2,1]],[[2,1],[3,2]]]){
    const f=fixture(legacy);f.a.start();
    for(const [status,event]of via){Object.assign(f.n,{status,event});f.a.observe(0);}
    Object.assign(f.n,{status:4,event:3,errno});const r=f.a.observe(1), reads=f.reads.length, effects=f.effects.length;
    Object.assign(f.n,{status:99,event:99,errno:99});assert.equal(f.a.observe(2),null);
    assert.equal(r.historicalNativeLatch.errno,errno);assert.equal(f.reads.length,reads);assert.equal(f.effects.length,effects);cases++;
  }
  for(const legacy of [false,true])for(const event of [0,1,2]){
    const f=fixture(legacy);f.a.start();Object.assign(f.n,{status:5,event});
    assert.throws(()=>f.a.observe(1),/status rejection/);const r=f.effects.at(-1),reads=f.reads.length;
    f.n.event=3;assert.equal(f.a.observe(2),null);assert.equal(r.historicalNativeLatch.event,event);assert.equal(f.reads.length,reads);cases++;
  }
});
console.log(JSON.stringify({passed,cases,syntheticBoundaryOnly:true,authenticBatch36170Cause:'UNKNOWN'}));
