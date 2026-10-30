'use strict';
// Independent host-boundary acceptance of candidate 18f9f827. No decoder model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {createHash} = require('node:crypto');
const file = require.resolve('../tools/maelstrom-original-errno-adapter.cjs');
const source = fs.readFileSync(file, 'utf8');
assert.equal(createHash('sha256').update(source).digest('hex'),
  'cbe04fef7e98c1ff607251812225b8314fc0aaff2c289331b95839cfe2df2b49');
const guard = '((d.rejectModes >>> 2) & 1) !== s.rejectLatchedMode || ';
assert.equal(source.split(guard).length, 2);
const control = process.argv.find(x => x.startsWith('--control='))?.split('=')[1];
let adapter = require(file);
if (control) {
  const replacements = {remove:'', 'off-only':'s.rejectLatchedMode === 0 && ((d.rejectModes >>> 2) & 1) !== s.rejectLatchedMode || ',
    'on-only':'s.rejectLatchedMode === 1 && ((d.rejectModes >>> 2) & 1) !== s.rejectLatchedMode || '};
  assert.ok(Object.hasOwn(replacements,control));
  const sandbox = {require:createRequire(file),module:{exports:{}}};
  vm.runInNewContext(source.replace(guard,replacements[control]), sandbox,{filename:file});
  adapter = sandbox.module.exports;
}
const {FIELDS,DIAGNOSTIC_FIELDS:D,MODE_SWITCH_DIAGNOSTIC_FIELDS:S,SELECT_RETURN} =
  require('../tools/maelstrom-native-errno-latch.cjs');
const MSC = ['started','phase','token','entries','parks','completions','fault','capped',
  'active','thread','regs','pre','post','ret','result'];
const zero = keys => Object.fromEntries(keys.map(k => [k,0]));
function context(from=0,status=1,other=0,contradiction=false) {
  const n = {...zero(FIELDS),status:5,event:status-1};
  const d = {...zero(D),rejectReason:15,rejectModes:((contradiction?1-from:from)<<2)|other,
    rejectExpectedRet:SELECT_RETURN};
  const s = {rejectRequestedMode:1-from,rejectLatchedMode:from,rejectPC:0xf1234567,
    rejectThread:7,rejectRegs:0x80000000,rejectStatus:status};
  return {n,d,s};
}
// Only scalar export inputs are synthetic. Both tested functions are production code.
function instance({mode=true,diagnostic=true}={}) {
  let n=zero(FIELDS),d=zero(D),s=zero(S);
  const e={mne_start:()=>{n.status=1;}};
  for(const k of FIELDS)e['mne_'+k]=()=>n[k];
  if(diagnostic)for(const k of D)e['mne_'+k]=()=>d[k];
  if(mode)for(const k of S)e['mne_'+k]=()=>s[k];
  for(const k of MSC)e['msc_'+k]=()=>0;
  return {exports:e,load(c){n={...c.n};d={...c.d};s={...c.s};}};
}
function started(options) {
  const i=instance(options),rows=[];
  const a=adapter.createAdapter(i,{persist:r=>rows.push(r),readLive:()=>({boundary:'host-only'})});
  a.start();
  assert.equal(rows.length,1);
  return {i,a,rows};
}
const guardError = /invalid native mode-switch diagnostic: guard context/;
// FIRST behavioral checkpoint: exact published contradictory OFF-latch input at
// actual createAdapter observation boundary. Malformed data must not be persisted.
{
  const {i,a,rows}=started();
  i.load(context(0,1,0,true));
  assert.throws(()=>a.observe(0),guardError,
    'production adapter rejects contradictory UOP bit with OFF latch');
  assert.equal(rows.length,1,'invalid diagnostic cannot reach persist');
  assert.equal(a.observe(1),null,'invalid snapshot seals owner');
}
let valid=0,contradictions=0,adapterValid=0,adapterContradictions=1;
for(const from of [0,1])for(const status of [1,2,3])for(const other of [0,1,2,3]) {
  const good=context(from,status,other),bad=context(from,status,other,true);
  for(const x of Object.values(good))Object.freeze(x);
  const r=adapter.decodeRejection(good.n,good.d,good.s);
  assert.equal(r.reason,15);
  assert.equal(r.modeBits,(from<<2)|other);
  assert.equal(r.modeSwitch.latchedMode,from);
  assert.equal(r.modeSwitch.requestedMode,1-from);
  assert.equal(r.modeSwitch.statusBeforeRejection,status);
  assert.equal(r.modeSwitch.boundaryPC,0xf1234567);
  assert.equal(r.modeSwitch.regs,0x80000000);
  valid++;
  assert.throws(()=>adapter.decodeRejection(bad.n,bad.d,bad.s),guardError,
    'decoder rejects contradiction from='+from+' status='+status+' other='+other);
  contradictions++;
  for(const [c,invalid] of [[good,false],[bad,true]]) {
    const {i,a,rows}=started();i.load(c);
    assert.throws(()=>a.observe(7),invalid?guardError:/^Error: native latch status rejection$/,
      'adapter contradiction from='+from+' status='+status+' other='+other);
    assert.equal(rows.length,invalid?1:2);
    if(!invalid) {
      const saved=rows[1].historicalNativeRejection;
      assert.equal(rows[1].kind,'rejected');
      assert.deepEqual(JSON.parse(JSON.stringify(saved)),JSON.parse(JSON.stringify(r)));
      adapterValid++;
    } else adapterContradictions++;
    assert.equal(a.observe(8),null);
  }
}
let partial=0,legacy=0,range=0;
const c=context();
for(const key of S) {
  const s={...c.s};delete s[key];
  assert.throws(()=>adapter.decodeRejection(c.n,c.d,s),
    new RegExp('invalid native mode-switch diagnostic: '+key));partial++;
  const i=instance();delete i.exports['mne_'+key];
  assert.throws(()=>adapter.createAdapter(i,{persist:()=>{},readLive:()=>({})}),
    new RegExp('missing mne_'+key));partial++;
}
for(const key of D) {
  const d={...c.d};delete d[key];
  assert.throws(()=>adapter.decodeRejection(c.n,d,c.s),
    new RegExp('invalid native rejection diagnostic: '+key));partial++;
  const i=instance();delete i.exports['mne_'+key];
  assert.throws(()=>adapter.createAdapter(i,{persist:()=>{},readLive:()=>({})}),
    new RegExp('missing mne_'+key));partial++;
}
{
  const i=instance({diagnostic:false});
  assert.throws(()=>adapter.createAdapter(i,{persist:()=>{},readLive:()=>({})}),
    /missing native rejection diagnostic/);partial++;
}
// Absent/null refers to optional decoder context and absent export families;
// null-valued export members are incomplete diagnostics and must fail construction.
for(const key of S) {
  const i=instance();i.exports['mne_'+key]=null;
  assert.throws(()=>adapter.createAdapter(i,{persist:()=>{},readLive:()=>({})}),
    new RegExp('missing mne_'+key));partial++;
}
for(const from of [0,1])for(const status of [1,2,3]) {
  const x=context(from,status,3,true);
  for(const arg of [undefined,null]) {
    const r=adapter.decodeRejection(x.n,x.d,arg);
    assert.equal(r.reason,15);assert.equal(r.modeSwitch,undefined);legacy++;
  }
  for(const diagnostic of [true,false]) {
    const {i,a,rows}=started({mode:false,diagnostic});i.load(x);
    assert.throws(()=>a.observe(9),/^Error: native latch status rejection$/);
    assert.equal(rows.length,2);
    assert.equal(rows[1].historicalNativeRejection?.modeSwitch,undefined);
    assert.equal(Object.hasOwn(rows[1],'historicalNativeRejection'),diagnostic);legacy++;
  }
}
for(const value of [8,0xffffffff]) {
  assert.throws(()=>adapter.decodeRejection(c.n,{...c.d,rejectModes:value},context((value >>> 2) & 1).s),
    /invalid native rejection diagnostic: guard context/);range++;
}
for(const status of [0,4,0xffffffff]) {
  assert.throws(()=>adapter.decodeRejection(c.n,c.d,{...c.s,rejectStatus:status}),guardError);range++;
}
for(const event of [1,2]) {
  assert.throws(()=>adapter.decodeRejection({...c.n,event},c.d,c.s),guardError);range++;
}
console.log(JSON.stringify({passed:true,candidate:'18f9f827f5a83885b90c8eb1489356ccf389a3d3',
  decoderSHA256:createHash('sha256').update(source).digest('hex'),valid,contradictions,
  adapterValid,adapterContradictions,partial,legacy,range,control:control||null,
  reused:'canonical focused native fixture regression; not replayed',
  fullTransformQualified:false,fullBuildQualified:false,guestExecuted:false,
  gameplayQualified:false,originalCausalInstruction:'UNKNOWN'}));
