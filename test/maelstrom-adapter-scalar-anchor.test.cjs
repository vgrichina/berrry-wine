'use strict';
// Synthetic JS export boundary tests only: no Wasm/compiler/runtime execution.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const h = require('../tools/maelstrom-native-errno-latch.cjs');
const {createAdapter, decodeRejection, verifyLoaded} = require('../tools/maelstrom-original-errno-adapter.cjs');
const SELECT = ['started','phase','token','entries','parks','completions','fault','capped','active','thread','regs','pre','post','ret','result'];
const BAD = [undefined, NaN, Infinity, -Infinity, 0x100000000, -0x80000001, 1.5, '0', null, false, {}, 0n];
const ENDPOINTS = [-0x80000000, -1, 0, 1, 0x7fffffff, 0x80000000, 0xffffffff];
let passed=0, cases=0;
function test(name, fn) { fn(); passed++; console.log('PASS '+name); }
function fixture(legacy=false) {
  const n=Object.fromEntries(h.FIELDS.map(k=>[k,0]));
  const d=Object.fromEntries(h.DIAGNOSTIC_FIELDS.map(k=>[k,0]));
  const s=Object.fromEntries(SELECT.map(k=>[k,0])), effects=[], reads={};
  const exports={mne_start(){effects.push('start');n.status=1;}};
  for(const [prefix,fields,state] of [['mne_',h.FIELDS,n],['msc_',SELECT,s],...legacy?[]:[['mne_',h.DIAGNOSTIC_FIELDS,d]]])
    for(const k of fields) exports[prefix+k]=()=>{reads[prefix+k]=(reads[prefix+k]||0)+1;return state[k];};
  const instance={exports};
  return {n,d,s,effects,reads,exports,make:()=>createAdapter(instance,{
    readLive(){effects.push('live');return {eax:99};},
    persist(row){effects.push(['persist',row]);}
  })};
}
function reject(f, reason=1) {
  Object.assign(f.n,{status:5,event:0});
  Object.assign(f.d,{rejectReason:reason,rejectModes:reason<=3?1<<(reason-1):0,
    rejectExpectedRet:h.SELECT_RETURN,rejectObservedRet:h.SELECT_RETURN,
    rejectPhase:3,rejectCompletions:1,rejectFault:0,rejectActive:0,rejectCapped:0});
  if(reason===4)f.d.rejectObservedRet++;
  if(reason===5)f.d.rejectPhase=0;
  if(reason===6)f.d.rejectCompletions=0;
  if(reason>=7)f.d[['rejectFault','rejectActive','rejectCapped'][reason-7]]=1;
}
function inert(f, adapter, op) {
  const before=f.effects.length;
  assert.throws(op,/invalid native/);
  assert.equal(f.effects.length,before);
  const reads={...f.reads};
  assert.equal(adapter.observe(100),null);
  assert.deepEqual(f.reads,reads);
  assert.equal(f.effects.length,before); cases++;
}
test('every raw native scalar rejects malformed inputs before start and callbacks, including legacy',()=>{
  for(const legacy of [false,true])for(const k of h.FIELDS)for(const bad of BAD){
    const f=fixture(legacy),a=f.make();f.n[k]=bad;
    inert(f,a,()=>a.start());assert.equal(f.effects.length,0);
  }
});
test('every raw native scalar rejects before callbacks in pending, capture and rejection contexts',()=>{
  for(const state of ['pending','capture','rejection','legacy'])for(const k of h.FIELDS)for(const bad of BAD){
    const f=fixture(state==='legacy'),a=f.make();a.start();a.observe(0);
    if(state==='capture'||state==='legacy')Object.assign(f.n,{status:4,event:3});
    if(state==='rejection')reject(f);
    f.n[k]=bad;inert(f,a,()=>a.observe(1));
  }
});
test('every select scalar rejects before start or callbacks, also with unchanged native snapshot',()=>{
  for(const state of ['start','unchanged','capture','rejection'])for(const k of SELECT)for(const bad of BAD){
    const f=fixture(),a=f.make();
    if(state!=='start'){a.start();a.observe(0);}
    if(state==='capture')Object.assign(f.n,{status:4,event:3});
    if(state==='rejection')reject(f);
    f.s[k]=bad;inert(f,a,()=>state==='start'?a.start():a.observe(1));
  }
});
test('every diagnostic scalar rejects before start and on capture, unchanged or rejection snapshots',()=>{
  for(const state of ['start','unchanged','capture','rejection'])for(const k of h.DIAGNOSTIC_FIELDS)for(const bad of BAD){
    const f=fixture(),a=f.make();
    if(state!=='start'){a.start();a.observe(0);}
    if(state==='capture')Object.assign(f.n,{status:4,event:3});
    if(state==='rejection')reject(f);
    f.d[k]=bad;inert(f,a,()=>state==='start'?a.start():a.observe(1));
  }
});
test('missing and nonfunction native/select/partial diagnostic exports reject construction inertly',()=>{
  for(const [prefix,fields]of [['mne_',['start',...h.FIELDS]],['msc_',SELECT],['mne_',h.DIAGNOSTIC_FIELDS]])
    for(const k of fields)for(const bad of [undefined,0,{},null]){
      const f=fixture();if(bad===undefined)delete f.exports[prefix+k];else f.exports[prefix+k]=bad;
      assert.throws(f.make,/missing/);assert.equal(f.effects.length,0);cases++;
    }
});
test('unrestricted scalar endpoints normalize; finite native enums enforce legal state pairs',()=>{
  // storage() writes only 0/0 -> 1/0 -> 2/1 -> 3/2 -> 4/3. Rejection
  // sets status=5 without changing event (0, 1 or 2). Status/event are enums,
  // not unrestricted payloads; retain every original endpoint for other fields.
  const payload=h.FIELDS.filter(k=>k!=='status'&&k!=='event');
  for(const [fields,key]of [[payload,'n'],[SELECT,'s']])for(const k of fields)for(const value of ENDPOINTS){
    const f=fixture(),a=f.make();a.start();f[key][k]=value;
    const r=a.observe(1);
    assert.equal(r[key==='n'?'historicalNativeLatch':'historicalSelectLatch'][k],value>>>0);cases++;
  }
  const legal=[[1,0],[2,1],[3,2],[4,3],[5,0],[5,1],[5,2]];
  for(const legacy of [false,true]){
    for(const [status,event]of legal){
      const f=fixture(legacy),a=f.make();a.start();Object.assign(f.n,{status,event});
      let row;
      if(status===5){assert.throws(()=>a.observe(1),/status rejection/);row=f.effects.at(-1)[1];}
      else row=a.observe(1);
      assert.equal(row.historicalNativeLatch.status,status);
      assert.equal(row.historicalNativeLatch.event,event);cases++;
    }
    // Preserve endpoint coverage on enums as rejection checks, and exhaust the
    // small enum cross product. All failures precede readLive and persist.
    const enums=[...new Set([...ENDPOINTS,2,3,4,5,6])];
    for(const status of enums)for(const event of enums){
      if(legal.some(([s,e])=>s===status&&e===event))continue;
      const f=fixture(legacy),a=f.make();a.start();Object.assign(f.n,{status,event});
      inert(f,a,()=>a.observe(1));
    }
  }
});
test('signed diagnostic endpoints normalize only valid first-failure records',()=>{
  for(const reason of [7,8,9])for(const value of ENDPOINTS.filter(v=>v!==0)){
    const f=fixture(),a=f.make();a.start();reject(f,reason);
    const k=['rejectFault','rejectActive','rejectCapped'][reason-7];f.d[k]=value;
    assert.throws(()=>a.observe(1),/status rejection/);
    const row=f.effects.at(-1)[1];
    assert.equal(row.historicalNativeRejection[['fault','active','capped'][reason-7]],value>>>0);
    assert.equal(a.observe(2),null);cases++;
  }
});
test('errno zero/nonzero and distinct caller remain captured once with exact callback order',()=>{
  for(const legacy of [false,true])for(const errno of [0,4,-1,-0x80000000]){
    const f=fixture(legacy),a=f.make();a.start();Object.assign(f.n,{status:4,event:3,errno,caller:0x2468ace1,eax:-1});
    const r=a.observe(1);assert.equal(r.historicalNativeLatch.errno,errno>>>0);
    assert.equal(r.historicalNativeLatch.caller,0x2468ace1);assert.equal(r.historicalNativeLatch.eax,0xffffffff);
    if(legacy)assert(!Object.hasOwn(r,'historicalNativeRejection'));else assert.equal(r.historicalNativeRejection,null);
    assert.deepEqual(f.effects.map(x=>Array.isArray(x)?x[0]:x),['start','live','persist','live','persist']);
    assert.equal(a.observe(2),null);assert.equal(f.effects.length,5);cases++;
  }
});
test('zero/wrong/forged return anchors reject every reason before callbacks; all authentic reasons persist',()=>{
  for(let reason=1;reason<=9;reason++){
    for(const wrong of [0,1,h.SELECT_RETURN+4,0xffffffff]){
      const f=fixture(),a=f.make();a.start();reject(f,reason);f.d.rejectExpectedRet=wrong;
      // In particular reason4 claims failure although observed is the authentic return.
      if(reason===4)f.d.rejectObservedRet=h.SELECT_RETURN;
      inert(f,a,()=>a.observe(1));
    }
    const f=fixture(),a=f.make();a.start();reject(f,reason);
    assert.throws(()=>a.observe(1),/status rejection/);
    assert.equal(f.effects.at(-1)[1].historicalNativeRejection.reason,reason);
    assert.equal(f.effects.at(-1)[1].historicalNativeRejection.expectedReturn,h.SELECT_RETURN);cases++;
  }
});
test('direct decoder rejects malformed contextual scalars even without a diagnostic reason',()=>{
  for(const k of h.FIELDS)for(const bad of BAD){
    const f=fixture();f.n[k]=bad;
    assert.throws(()=>decodeRejection(f.n,f.d),/invalid native rejection/);cases++;
  }
});
test('snapshot export reads happen once per observation and never resample across callback publication',()=>{
  const f=fixture(),a=f.make();a.start();Object.assign(f.n,{status:4,event:3,errno:4});
  const before={...f.reads};
  // A second sample would fabricate zero instead of preserving this capture.
  let reads=0;f.exports.mne_errno=()=>++reads===1?4:NaN;
  const r=a.observe(1);assert.equal(reads,1);assert.equal(r.historicalNativeLatch.errno,4);
  for(const k of Object.keys(f.reads).filter(k=>k!=='mne_errno'))assert.equal(f.reads[k]-before[k],1,k);
  assert.equal(a.observe(2),null);assert.equal(reads,1);cases++;
});
test('malformed exports produced by start close before live/persist',()=>{
  for(const [prefix,fields,state] of [['mne_',h.FIELDS,'n'],['msc_',SELECT,'s'],['mne_',h.DIAGNOSTIC_FIELDS,'d']])
    for(const k of fields){const f=fixture();f.exports.mne_start=()=>{f.n.status=1;f[state][k]=NaN;};const a=f.make();inert(f,a,()=>a.start());}
});
test('trusted return anchor agrees with authentic binary verification and relocated loaded bytes',()=>{
  const anchors=h.verifyBinaries({net:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'SDL_net.dll')),
    exe:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'Maelstrom.exe')),crt:fs.readFileSync(process.env.MNE_CRT)});
  assert.equal(h.SELECT_RETURN,0x7a3362);assert.equal(anchors.selectRet,h.SELECT_RETURN);
  assert.equal(h.NET_ANCHORS[h.NET_LAYOUT.selectReturnVA],'8be8ffd783380474a2');
  const b=new ArrayBuffer(0x500000),u=new Uint8Array(b),dv=new DataView(b),at=va=>va-0x400000+0x12000;
  const put=(va,hex)=>u.set(Buffer.from(hex,'hex'),at(va));
  put(0x52e430,'e82274ffff83c008c3');for(const [va,hex]of Object.entries(h.NET_ANCHORS))put(h.NET_LAYOUT.loadedBase+Number(va)-h.NET_LAYOUT.preferredBase,hex);
  put(0x7a32f2,'8b3d10407a00');put(0x40e125,'e8c253000083c40885c0756e');dv.setUint32(at(0x7a4010),0x52e430,true);
  const e={get_image_base:()=>0x400000},bases={msvcrt:{loadAddr:0x522000},sdl_net:{loadAddr:h.NET_LAYOUT.loadedBase}};
  assert.equal(verifyLoaded(e,b,bases).selectReturn,anchors.selectRet);
  u[at(h.SELECT_RETURN)]^=1;assert.throws(()=>verifyLoaded(e,b,bases),/authentic loaded bytes/);u[at(h.SELECT_RETURN)]^=1;
  put(0x7a32f2,'8b3d10200010');assert.throws(()=>verifyLoaded(e,b,bases),/authentic loaded bytes/);
  assert.throws(()=>verifyLoaded(e,b,{...bases,sdl_net:{loadAddr:0x900000}}),/bases/);
  assert(Object.isFrozen(h.NET_LAYOUT));cases+=5;
});
console.log(JSON.stringify({passed,cases,syntheticBoundaryOnly:true,guestInvoked:false}));
