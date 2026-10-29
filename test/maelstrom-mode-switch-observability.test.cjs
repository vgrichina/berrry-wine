'use strict';
// Source-only: compile the production scalar latch and the exact pinned set_uop
// boundary through the installed compiler. No game, full build, or guest execution.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {parse} = require('./maelstrom-select-hook-model.cjs');
const hook = require('../tools/maelstrom-native-errno-latch.cjs');
const select = require('../tools/maelstrom-select-completion-hook.cjs');
const {decodeRejection, createAdapter} = require('../tools/maelstrom-original-errno-adapter.cjs');
const {compile} = require(process.env.MNE_WATX || '../tools/watx.js');
const source = fs.readFileSync(path.join(process.env.MNE_SOURCE_ROOT || path.join(__dirname,'..'), 'src/07d-uop-engine.wat'),'utf8');
const sha = s => createHash('sha256').update(s).digest('hex');
assert.equal(sha(source), hook.PINS['src/07d-uop-engine.wat'], 'production set_uop source pin');
const a = {selectRet:hook.SELECT_RETURN, successor:0x7a3366, frame:0x124,
  crtEntryRva:0xc430, crtTailRva:0xc435, crtRetRva:0xc438};
const serialize = n => Array.isArray(n) ? '('+n.map(serialize).join(' ')+')' : n;
const instrumented = hook.instrumentUopSwitch(source);
const setUop = serialize(parse(instrumented.slice(instrumented.indexOf('(func (export "set_uop")')))[0]);
const productionStorage = hook.storage(a,0x522000,true);
let compiled = 0, groups = 0;
const context = {eip:0xf1234567,current_thread_id:7,reg_base:0x100};
function build(storage = productionStorage, boundary = setUop) {
  // Only the irrelevant memory-map operator is replaced; rejection is scalar-only.
  storage = storage.replace('(region.end $DIRECT_WINDOW)','(i32.const 0x8000000)');
  const names = new Set([...storage.matchAll(/\(global\.(?:get|set) \$([\w]+)/g)].map(m=>m[1]));
  const declared = new Set([...storage.matchAll(/\(global \$([\w]+)/g)].map(m=>m[1]));
  ['uop_enabled','flushes','refreshes',...select.FIELDS.map(k=>'msc_'+k)].forEach(n=>names.add(n));
  const globals = [...names].filter(n=>!declared.has(n)).map(n=>
    `(global $${n} (mut i32) (i32.const ${context[n] || 0}))`).join('\n');
  const all = new Set([...names,...declared]);
  const exports = [...all].map(n=>`(export "g_${n}" (global $${n}))`).join('\n') +
    select.FIELDS.map(n=>`(func (export "msc_${n}") (result i32) (global.get $msc_${n}))`).join('\n');
  const support = `(memory 1)
    (func $msc_begin_for_mne (global.set $msc_started (i32.const 1)))
    (func $uop_flush (global.set $flushes (i32.add (global.get $flushes) (i32.const 1))))
    (func $bx_hot_gate_refresh (global.set $refreshes (i32.add (global.get $refreshes) (i32.const 1))))
    (func (export "complete") (call $mne_complete))
    (func (export "call") (call $mne_call (i32.const 0) (i32.const 0) (i32.const 0)))
    (func (export "return") (call $mne_return (i32.const 0)))`;
  const text = globals+'\n'+support+'\n'+storage+'\n'+boundary+'\n'+exports;
  const result = compile(text,new Map(),{mode:'production'});
  assert(result.wasmBinary?.length < 32768,'minimal compiled fixture size');
  const bytes = Buffer.from(result.wasmBinary);
  const module = new WebAssembly.Module(bytes); compiled++;
  return {module, textSHA256:sha(text), wasmSHA256:sha(bytes)};
}
const fixture = build();
function instance(compiledFixture=fixture) {return new WebAssembly.Instance(compiledFixture.module);}
function put(e,n,v) {e['g_'+n].value=v;}
function native(e) {return Object.fromEntries(hook.FIELDS.map(k=>[k,e['mne_'+k]()>>>0]));}
function diagnostic(e) {return Object.fromEntries(hook.DIAGNOSTIC_FIELDS.map(k=>[k,e['mne_'+k]()>>>0]));}
function mode(e) {return Object.fromEntries(hook.MODE_SWITCH_DIAGNOSTIC_FIELDS.map(k=>[k,e['mne_'+k]()>>>0]));}
function expected(from,status) {return {rejectRequestedMode:1-from,rejectLatchedMode:from,
  rejectPC:context.eip,rejectThread:context.current_thread_id,rejectRegs:context.reg_base,rejectStatus:status};}
function reject(e,from,status=1) {
  put(e,'uop_enabled',from); e.mne_start();
  if(status!==1) {put(e,'mne_status',status);put(e,'mne_event',status-1);}
  e.set_uop(1-from);
  assert.equal(e.mne_status(),5,'actual mode switch must reject');
  assert.equal(e.mne_rejectReason(),15,'actual mode switch rejection reason');
  assert.deepEqual(mode(e),expected(from,status),'exact requested mode and rejecting context');
  const decoded=decodeRejection(native(e),diagnostic(e),mode(e));
  assert.equal(decoded.modeSwitch.boundaryPC,context.eip);
  assert.equal(decoded.modeSwitch.requestedMode,1-from);
}
function test(name,body) {body();groups++;console.log('PASS '+name);}
// Earliest production boundary first: real start, unchanged off->on reproducer.
test('production set_uop awaiting-select reproducer records off->on before assignment',()=>{
  const e=instance().exports; reject(e,0);
  assert.equal(e.mne_rejectModes(),0);assert.equal(e.g_uop_enabled.value,1);
  assert.equal(e.mne_event(),0);assert.equal(e.mne_errno(),0);assert.equal(e.mne_caller(),0);
});
test('both requested modes, all active states, first rejection survives every later entry',()=>{
  for(const from of [0,1])for(const status of [1,2,3]) {
    const e=instance().exports;reject(e,from,status);
    const before={...native(e),...diagnostic(e),...mode(e)};
    for(const value of [from,1-from,0,2,-1]) {
      put(e,'eip',123);put(e,'current_thread_id',12);put(e,'reg_base',512);
      e.set_uop(value);e.mne_start();e.complete();e.call();e.return();
      assert.deepEqual({...native(e),...diagnostic(e),...mode(e)},before,'first failure immutable');
    }
  }
});
test('unchanged-mode and inactive-state controls do not reject; setter semantics preserved',()=>{
  for(const from of [0,1])for(const status of [0,1,2,3,4,5]) {
    const e=instance().exports;put(e,'uop_enabled',from);
    if(status) {e.mne_start();put(e,'mne_status',status);put(e,'mne_event',Math.min(status-1,3));}
    const before={...native(e),...diagnostic(e),...mode(e)};
    for(const raw of from ? [1,2,-1] : [0])e.set_uop(raw);
    if([0,4,5].includes(status))e.set_uop(1-from);
    assert.deepEqual({...native(e),...diagnostic(e),...mode(e)},before);
    assert(e.g_refreshes.value>0);assert.equal(e.g_flushes.value,from===0||[0,4,5].includes(status)?1:0);
  }
});
test('adapter persists immutable boundary context and closes at rejection',()=>{
  for(const from of [0,1]) {
    const i=instance(),e=i.exports,rows=[];put(e,'uop_enabled',from);
    const adapter=createAdapter(i,{persist:r=>rows.push(r),readLive:()=>({eip:999})});
    adapter.start();e.set_uop(1-from);
    assert.throws(()=>adapter.observe(0),/native latch status rejection/);
    assert.equal(rows.at(-1).historicalNativeRejection.modeSwitch.boundaryPC,context.eip);
    assert.equal(rows.at(-1).historicalNativeRejection.modeSwitch.requestedMode,1-from);
    assert.equal(adapter.observe(1),null);
  }
});
test('legacy snapshots remain readable; partial and inconsistent new diagnostics fail closed',()=>{
  const i=instance(),e=i.exports;reject(e,0);
  assert.equal(decodeRejection(native(e),diagnostic(e)).modeSwitch,undefined);
  const s=mode(e);
  for(const key of hook.MODE_SWITCH_DIAGNOSTIC_FIELDS) {
    const partial={...s};delete partial[key];assert.throws(()=>decodeRejection(native(e),diagnostic(e),partial),new RegExp(key));
    const exports={...e};delete exports['mne_'+key];
    assert.throws(()=>createAdapter({exports},{persist(){},readLive(){}}),new RegExp(key));
  }
  for(const patch of [{rejectRequestedMode:0},{rejectLatchedMode:1},{rejectStatus:0},{rejectStatus:2}])
    assert.throws(()=>decodeRejection(native(e),diagnostic(e),{...s,...patch}),/guard context/);
  const pristine=instance().exports;
  assert.throws(()=>decodeRejection(native(pristine),diagnostic(pristine),s),/nonzero without switch/);
});
test('each diagnostic omission and misrecording mutation fails the exact behavioral oracle',()=>{
  for(const [field,value] of [
    ['rejectRequestedMode','(local.get $on)'],['rejectLatchedMode','(global.get $mne_uopMode)'],
    ['rejectPC','(global.get $eip)'],['rejectThread','(global.get $current_thread_id)'],
    ['rejectRegs','(global.get $reg_base)'],['rejectStatus','(global.get $mne_status)']]) {
    const anchor=`(global.set $mne_${field} ${value})`;
    for(const replacement of ['',`(global.set $mne_${field} (i32.const 99))`]) {
      const mutant=hook.once(productionStorage,anchor,replacement), f=build(mutant);
      // from=1 makes an omitted latched-mode write observable; otherwise from=0.
      const from=field==='rejectLatchedMode'?1:0;
      assert.throws(()=>reject(instance(f).exports,from),/exact requested mode and rejecting context/,
        field+' mutation must fail recording, not compilation or unrelated checks');
    }
  }
  const omitted=build(productionStorage,hook.once(setUop,
    '(call $mne_uop_switch (i32.ne (local.get $on) (i32.const 0)))',''));
  assert.throws(()=>reject(instance(omitted).exports,0),/actual mode switch must reject/);
});
console.log(JSON.stringify({schema:'maelstrom-mode-switch-source-acceptance/v1',groups,compiled,
  productionEngineSHA256:sha(source),productionStorageSHA256:sha(productionStorage),
  boundarySHA256:sha(setUop),fixture,guestExecuted:false},(k,v)=>k==='module'?undefined:v));
