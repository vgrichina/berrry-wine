'use strict';
// Scalar source-AST fixture ONLY: no compiler, WebAssembly, guest or native capture.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const hook = require('../tools/maelstrom-native-errno-latch.cjs');
const select = require('../tools/maelstrom-select-completion-hook.cjs');
const { Model, parse, func, walk } = require('./maelstrom-select-hook-model.cjs');
const { decodeRejection, createAdapter } = require('../tools/maelstrom-original-errno-adapter.cjs');
const a = {selectRet:0x7a3362, successor:0x7a3366, frame:0x124, crtEntryRva:0xc430, crtTailRva:0xc435};
const storage = hook.storage(a, 0x522000);
const inputs = Object.fromEntries(Object.keys(hook.PINS).map(p => [p,fs.readFileSync(path.join(process.env.MNE_SOURCE_ROOT,p),'utf8')]));
const output = hook.transform(inputs,{enabled:true,crtLoadedBase:0x522000,binaries:{
  net:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'SDL_net.dll')),
  exe:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'Maelstrom.exe')),
  crt:fs.readFileSync(process.env.MNE_CRT)}});
const source = output['src/09d-winsock.wat'];
assert(source.endsWith(storage),'actual transformed fragment contains the tested scalar storage');
class Scalars extends Model {
  eval(n, l) {
    if(n[0] === 'i32.shl') return (this.eval(n[1], l) << this.eval(n[2], l)) >>> 0;
    if(n[0] === 'i32.lt_u') return +((this.eval(n[1],l)>>>0) < (this.eval(n[2],l)>>>0));
    if(n[0].includes('load') || n[0].includes('store') || n[0] === 'memory.size') throw Error('forbidden memory access');
    return super.eval(n, l);
  }
}
const model = new Scalars(source, 0, 0, false);
const start = parse(storage).find(n => n[0]==='func' && Array.isArray(n[1]) && n[1][1]==='"mne_start"');
model.functions.set('$start', ['func','$start',...start.slice(2)]);
const pristine = {...model.g, $code16:0, $block_exec_enabled:0, $uop_enabled:0};
const snapshot = () => Object.fromEntries(hook.DIAGNOSTIC_FIELDS.map(k => [k,model.g['$mne_'+k]]));
const native = () => Object.fromEntries(hook.FIELDS.map(k => [k,model.g['$mne_'+k]]));
const mutations = [['$code16',2],['$block_exec_enabled',0x80000000],['$uop_enabled',4],
  ['$msc_ret',a.selectRet+4],['$msc_phase',2],['$msc_completions',2],['$msc_fault',2],['$msc_active',2],['$msc_capped',2]];
function reset(mask=0) {
  model.g={...pristine};model.trace=[];
  Object.assign(model.g, {$mne_status:1,$msc_ret:a.selectRet,$msc_phase:3,$msc_completions:1,
    $msc_token:7,$msc_thread:1,$msc_regs:100,$msc_pre:1000,$msc_post:1024,$msc_parks:6,$msc_result:0});
  mutations.forEach(([k,v],i)=>{if(mask & (1<<i))model.g[k]=v;});
}
let groups=0;function test(name,f){f();groups++;console.log('PASS rejection fixture: '+name);}
test('stable reason ABI and diagnostic fields are separate from capture fields',()=>{
  assert.deepEqual(Object.values(hook.REJECTION_REASONS),['code16','block-exec','uop','select-return','phase','completions','fault','active','capped']);
  assert.equal(hook.DIAGNOSTIC_FIELDS.length,9);
  assert(hook.DIAGNOSTIC_FIELDS.every(k=>!hook.FIELDS.includes(k)));
});
test('all 511 nonempty failure combinations preserve guard truth and first-predicate order',()=>{
  for(let mask=1;mask<512;mask++){
    reset(mask);const memory=[...model.mem], other={...model.g};
    model.run('$mne_complete');
    const first=mutations.findIndex((_,i)=>mask & (1<<i))+1, n=native(), d=snapshot();
    assert.equal(n.status,5);assert.equal(n.event,0);assert.equal(d.rejectReason,first);
    assert.equal(d.rejectModes,mask&7);assert.equal(d.rejectExpectedRet,a.selectRet);
    assert.equal(d.rejectObservedRet,model.g.$msc_ret);
    assert(hook.FIELDS.every(k=>k==='status'||n[k]===0),'no errno/caller or completion capture on rejection');
    for(const [k,v]of Object.entries(other))if(!k.startsWith('$mne_'))assert.equal(model.g[k],v,k);
    assert.deepEqual([...model.mem],memory);
    assert(model.trace.every(t=>t[0]==='global.set'&&t[1].startsWith('$mne_')));
    assert.equal(decodeRejection(n,d).reason,first);
  }
});
test('first rejection metadata and status/event stay immutable after all later hooks',()=>{
  reset(1<<3);model.run('$mne_complete');const before={...model.g};
  Object.assign(model.g,{$msc_ret:123,$msc_phase:7,$msc_fault:1,$code16:1});
  const frozen={...native(),...snapshot()};
  for(const [name,args]of [['$mne_complete',[]],['$mne_call',[0,0,0]],['$mne_return',[0]],['$start',[]]]){
    model.run(name,args);assert.deepEqual({...native(),...snapshot()},frozen,name);
  }
  assert.equal(before.$mne_rejectObservedRet,a.selectRet+4);
});
test('legitimate zero-result completion keeps existing copy, event and status transitions',()=>{
  reset();model.run('$mne_complete');
  assert.equal(model.g.$mne_status,2);assert.equal(model.g.$mne_event,1);
  for(const k of ['token','thread','regs','pre','post','parks','result'])assert.equal(model.g['$mne_'+k],model.g['$msc_'+k]);
  assert.equal(model.g.$mne_selectRet,a.selectRet);
  assert(hook.DIAGNOSTIC_FIELDS.every(k=>snapshot()[k]===0));
  const once=native();model.g.$msc_fault=1;model.run('$mne_complete');assert.deepEqual(native(),once);
});
test('inert status and disabled transform do not inspect inputs or create diagnostics',()=>{
  for(const status of [0,2,3,4,5]){reset(511);model.g.$mne_status=status;const before={...model.g};model.run('$mne_complete');assert.deepEqual(model.g,before);}
  const unused=new Proxy({}, {get(){throw Error('input read');},ownKeys(){throw Error('input enumeration');}});
  assert.equal(hook.transform(unused,{enabled:false}),unused);
});
test('start and later rejection sites remain unclassified completion diagnostics',()=>{
  model.g={...pristine,$code16:2};model.run('$start');assert.equal(model.g.$mne_status,5);
  assert.equal(decodeRejection(native(),snapshot()),null);
  reset();model.run('$mne_complete');model.g.$mne_status=3;model.g.$mne_event=2;
  model.run('$mne_call',[0,0,0]);assert.equal(model.g.$mne_status,5);
  assert.equal(decodeRejection(native(),snapshot()),null);
});
test('completion AST only reads globals and writes mne scalars, and preserves ordered guards',()=>{
  const f=func(storage,'mne_complete');
  assert.equal(walk(f,n=>['call','call_indirect','i32.load','i32.store','memory.size'].includes(n[0])).length,0);
  const sets=walk(f,n=>n[0]==='global.set');assert(sets.every(n=>n[1].startsWith('$mne_')));
  const guards=f.slice(2).filter(n=>n[0]==='if');assert.equal(guards.length,10);
  assert.deepEqual(guards.slice(1).map(n=>walk(n,x=>x[0]==='global.set'&&x[1]==='$mne_rejectReason')[0][2][1]),['1','2','3','4','5','6','7','8','9']);
});
test('decoder rejects unknown, contradictory, malformed and impossible-context diagnostics',()=>{
  reset(1<<3);model.run('$mne_complete');const n=native(),d=snapshot();
  for(const k of hook.DIAGNOSTIC_FIELDS)for(const v of [-1,0x100000000,1.5,NaN,undefined,'1'])assert.throws(()=>decodeRejection(n,{...d,[k]:v}),/invalid native rejection/);
  for(const patch of [{rejectReason:10},{rejectReason:0},{rejectReason:5},{rejectModes:8},{rejectModes:1},{rejectExpectedRet:0},{rejectObservedRet:a.selectRet}])assert.throws(()=>decodeRejection(n,{...d,...patch}),/invalid native rejection/);
  for(const patch of [{status:4},{event:1},{errno:4},{caller:123},{token:7}])assert.throws(()=>decodeRejection({...n,...patch},d),/invalid native rejection/);
});
function adapterFixture(){
  const n=Object.fromEntries(hook.FIELDS.map(k=>[k,0])),d=Object.fromEntries(hook.DIAGNOSTIC_FIELDS.map(k=>[k,0])),rows=[];
  let starts=0,live=0;
  const exports={mne_start(){starts++;n.status=1;}};
  for(const k of hook.FIELDS)exports['mne_'+k]=()=>n[k];
  for(const k of hook.DIAGNOSTIC_FIELDS)exports['mne_'+k]=()=>d[k];
  for(const k of select.FIELDS)exports['msc_'+k]=()=>0;
  const instance={exports};return {n,d,rows,exports,starts:()=>starts,live:()=>live,
    make:()=>createAdapter(instance,{persist:r=>rows.push(r),readLive(){live++;return {eax:999};}})};
}
test('adapter decodes rejection, persists once and closes without errno/caller attribution',()=>{
  const f=adapterFixture(),adapter=f.make();adapter.start();reset(1<<3);model.run('$mne_complete');
  Object.assign(f.n,native());Object.assign(f.d,snapshot());assert.throws(()=>adapter.observe(36170),/status rejection/);
  const row=f.rows.at(-1);assert.equal(row.historicalNativeRejection.predicate,'select-return');
  assert.equal(row.historicalNativeRejection.observedReturn,a.selectRet+4);assert.equal(row.historicalNativeLatch.event,0);
  f.d.rejectReason=1;assert.equal(adapter.observe(36171),null);assert.equal(f.rows.length,2);
});
test('new diagnostic exports stay zero on legitimate accepted capture and decode signed i32 metadata',()=>{
  const f=adapterFixture(),adapter=f.make();adapter.start();
  Object.assign(f.n,{status:4,event:3,errno:0,eax:123,caller:456});
  const row=adapter.observe(8);assert.equal(row.historicalNativeRejection,null);
  assert.equal(row.historicalNativeLatch.errno,0);assert.equal(row.historicalNativeLatch.caller,456);
  assert.equal(adapter.observe(9),null);
  const signed=adapterFixture(),reader=signed.make();reader.start();reset(1<<3);model.run('$mne_complete');
  Object.assign(signed.n,native());Object.assign(signed.d,snapshot(),{rejectObservedRet:-1});
  assert.throws(()=>reader.observe(1),/status rejection/);
  assert.equal(signed.rows.at(-1).historicalNativeRejection.observedReturn,0xffffffff);
});
test('invalid adapter diagnostics close before persistence/live callbacks; partial exports reject',()=>{
  const partial=adapterFixture();delete partial.exports.mne_rejectModes;assert.throws(partial.make,/missing mne_rejectModes/);
  for(const value of [undefined,NaN,1.5,'4',0x100000000,-0x80000001,10]){
    const f=adapterFixture(),adapter=f.make();adapter.start();f.n.status=5;f.d.rejectReason=value;
    assert.throws(()=>adapter.observe(1),/invalid native rejection/);assert.equal(f.rows.length,1);assert.equal(f.live(),1);assert.equal(adapter.observe(2),null);
  }
  const f=adapterFixture();f.d.rejectModes=1;assert.throws(()=>f.make().start(),/invalid native rejection/);assert.equal(f.starts(),0);
});
test('fixture using published frozen observations stays explicitly synthetic and inconclusive about modes',()=>{
  // Published batch36170 select values; mode bits were NOT captured. Vary them.
  // This is diagnostic-fixture coverage, never authentic runtime evidence.
  for(const modes of [0,1,2,4,7]){
    reset();Object.assign(model.g,{$msc_ret:0x7a3362,$msc_phase:3,$msc_token:7,$msc_completions:1,
      $msc_fault:0,$msc_active:0,$msc_capped:0,$msc_result:0,$msc_parks:6,
      $code16:modes&1,$block_exec_enabled:modes&2,$uop_enabled:modes&4});
    model.run('$mne_complete');assert.equal(model.g.$mne_status,modes?5:2);
  }
});
console.log(JSON.stringify({passed:groups,failureCombinations:511,sourceASTOnly:true,authenticRejectionCause:'UNKNOWN',nativeQualification:false}));
