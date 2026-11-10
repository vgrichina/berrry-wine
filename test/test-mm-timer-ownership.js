#!/usr/bin/env node
'use strict';
// Production source slices, real token allocator and continuation. Identity
// guest addressing and modeled RET 20; no full VM, browser or guest runtime.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const {compileClosure} = require('../tools/watx-closure');
const root = path.resolve(__dirname, '..');
const ref = process.env.MM_OWNER_REF;
const read = p => ref || !fs.existsSync(path.join(root, p))
  ? cp.execFileSync('git', ['show', `${ref || 'HEAD'}:${p}`], {cwd: root, encoding: 'utf8'})
  : fs.readFileSync(path.join(root, p), 'utf8');
function form(text, marker) {
  text = text.replace(/;;[^\n]*/g, '');
  const start = text.indexOf(marker); assert(start >= 0, marker);
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')' && --depth === 0) return text.slice(start, i + 1);
  }
  throw Error(marker);
}
const cache = read('src/04-cache.wat'), handlers = read('src/09a-handlers.wat');
const ex = read('src/13-exports.wat'), regs = read('src/03-registers.wat');
let ownership = cache.slice(cache.indexOf(';; BEGIN CALLBACK INVOCATION OWNERSHIP'),
  cache.indexOf(';; END CALLBACK INVOCATION OWNERSHIP'));
const bodies = [];
// Include the actual default-off private queue as well as its context hooks.
// This source-closure test models RET; the production Worker probe separately
// executes the shipped CPU's original-media RET 20.
if(ex.includes(';; Bounded callback-context observations')) {
  bodies.push(ex.slice(ex.indexOf(';; Bounded callback-context observations'),
    ex.indexOf(';; Opt-in, per-instance, fixed-size observation only.')));
  bodies.push('(export "callbackFeedRet" (func $callback_feed_ret))');
}
for (const n of ['save_caller_regs','restore_caller_regs','set_flags_inc','get_cf'])
  bodies.push(form(regs, `(func $${n}`));
for (const n of ['fire_mm_timer','fire_audio_callback_bound','fire_wave_out_callback_bound',
  'fire_midi_out_callback_bound','wave_callback_restore_wait']) bodies.push(form(ex, `(func $${n}`));
for (const n of ['mm_timer_slot','mm_timer_due_slot','mm_timer_consume_slot',
  'mm_timer_consume_due_tick','mm_timer_thread_owned','mm_timer_ms_until_due','mm_timer_thread_step'])
  bodies.push(form(handlers, `(func $${n}`));
if (handlers.includes(';; BEGIN MM CALLBACK OWNERSHIP')) bodies.push(handlers.slice(
  handlers.indexOf(';; BEGIN MM CALLBACK OWNERSHIP'), handlers.indexOf(';; END MM CALLBACK OWNERSHIP')));
bodies.push(form(read('src/09a7d-handlers-shell-file.wat'), '(func $io_apc_push'));
const window = read('src/09a5-handlers-window.wat');
const timerArm = form(window.slice(window.indexOf(';; MM_TIMER (0x7FF0):')), '(if (i32.and');
bodies.push(`(func (export "dispatchTimer") (param $arg0 i32) (local $tmp i32) ${timerArm})`);
let finish = form(read('src/09b-dispatch.wat'), '(if (i32.eq (local.get $name_rva) (i32.const 0xCACA000A))');
bodies.push(`(func (export "finish") (param $name_rva i32) ${finish})`);
// Actual outer-dispatch preflight, before its first effectful operation. The
// unrelated dispatcher body is excluded; finish above is its real return arm.
const dispatcher = read('src/09b-dispatch.wat');
if (dispatcher.includes(';; Reject an unauthenticated CACA000A')) {
  const preflight = form(dispatcher.slice(dispatcher.indexOf(';; Reject an unauthenticated CACA000A')), '(if ');
  const wrapper = form(dispatcher, '(func $win32_dispatch ');
  const prior=wrapper.slice(0,wrapper.indexOf(preflight));
  // The REP debugger rejection was added before this callback preflight.
  // It is also effect-free; neither guard may follow a dispatch mutation.
  assert(!/\((?:global\.set|i32\.store|call \$(?!mm_callback_check|mm_timer_thread_check))/.test(prior),
    'preflight precedes dispatch effects');
  bodies.push(`(func (export "preflight") (param $thunk_idx i32) ${preflight})`);
}
let joined = bodies.join('\n');
if (process.env.MM_OWNER_MUTATION === 'skip-check') {
  const check = '(if (i64.ne (i64.load (local.get $frame)) (call $invocation_current)) (then (unreachable)))';
  assert(joined.includes(check)); joined=joined.replace(check,'');
  const from = '(call $invocation_leave (i64.load (local.get $frame)))';
  assert(joined.includes(from), 'mutation site');
  const start = joined.indexOf('(func $mm_callback_finish');
  joined = joined.slice(0,start) + joined.slice(start).replace(from, '(call $invocation_leave (call $invocation_current))');
}
const declared = new Set([...(`${ownership}\n${joined}`).matchAll(/\(global \$(\w+)/g)].map(m => m[1]));
const globals = [...new Set([...(`${ownership}\n${joined}`).matchAll(/\(global\.(?:get|set) \$(\w+)/g)].map(m => m[1]))];
const source = `(memory 2 2 shared) (export "memory" (memory 0))
  (region.declare-fixed $CALLBACK_OWNERSHIP (base 0) (size 0x2110) (align 16))
  (region.declare-fixed $MM_CALLBACK_CONTEXTS (base 0x2200) (size 0x8000) (align 16))
  ${globals.filter(g => !declared.has(g)).map(g => `(global $${g} (mut i32) (i32.const 0))`).join('\n')}
  ${ownership}
  (func $host_beep_process_begin (param i32 i32) (result i32) (i32.const 1))
  (func $host_beep_thread_begin (param i32 i32 i32 i32 i32) (result i32) (i32.const 1))
  (func $host_get_ticks (result i32) (i32.const 1000))
  (func $host_set_event (param i32) (result i32) (i32.const 1))
  (func $host_reset_event (param i32) (result i32) (i32.const 1))
  ;; The separate pending-context diagnostic is unarmed in this closure.
  (func $pending_gap)
  (func $gl32 (param $p i32) (result i32) (i32.load (local.get $p)))
  (func $gs32 (param $p i32) (param $v i32) (i32.store (local.get $p) (local.get $v)))
  (func $thunk_metadata_addr (param i32) (result i32) (i32.const 0xb400))
  ${joined}
  ${globals.filter(g=>!['callback_feed_count','callback_feed_invalid'].includes(g)).map(g => `(export "${g}" (global $${g}))`).join('\n')}
  ${['invocation_process_begin','invocation_thread_begin','invocation_enter','invocation_leave',
    'invocation_current','mm_timer_thread_step','set_flags_inc','get_cf'].map(n => `(export "${n}" (func $${n}))`).join('\n')}`;
const compiled = compileClosure({source, vfs: new Map()}, {tailCalls: false});
assert(compiled.success, compiled.error);
const module_ = new WebAssembly.Module(compiled.wasmBinary);
function setup() {
  const e = new WebAssembly.Instance(module_).exports, mem = new Uint8Array(e.memory.buffer);
  const dv = new DataView(e.memory.buffer);
  const put = (p,v) => dv.setUint32(p,v >>> 0,true), get = p => dv.getUint32(p,true);
  e.current_thread_id.value = 1; e.invocation_process_begin();
  const set = (n,v) => {e[n].value = v;};
  set('reg_base',0xb000); set('MM_TIMER_TABLE',0xb100); set('MM_TIMER_ENTRY',24);
  set('MM_TIMER_MAX',2); set('MM_TIMER_THREAD',0xb200);
  put(0xb010,0x18000); set('eip',0x401234); set('mm_timer_ret_thunk',0x500000);
  set('flag_op',9); set('flag_a',1); e.set_flags_inc(5,6);
  [0xb000,0xb004,0xb008].forEach((p,i)=>put(p,0x11110000+i));
  const slot = (flags=1) => { [7,10,0x402000,33,0,flags].forEach((v,i)=>put(0xb100+i*4,v)); };
  slot();
  const sp = () => get(0xb010), ret = () => put(0xb010,sp()+24);
  const snap = () => ({mem: Buffer.from(mem), globals: globals.map(g=>[g,typeof e[g]==='function'?e[g]():e[g].value])});
  put(0xb400,0xcaca000a);
  const reject = (fn,label) => { const before=snap(); assert.throws(fn,WebAssembly.RuntimeError,label); assert.deepEqual(snap(),before,label+' unchanged'); };
  const dispatch = () => {const p=0xb300; [33,0x7ff0,7,0x402000].forEach((v,i)=>put(p+i*4,v)); put(sp(),0x405555); e.dispatchTimer(p);};
  return {e,mem,dv,put,get,set,slot,sp,ret,snap,reject,dispatch};
}
// Baseline is a concrete wrong-current-child continuation, not a census label.
if (process.argv.includes('--baseline')) {
  const x=setup(); assert.equal(x.e.fire_mm_timer(),1); x.ret();
  x.e.invocation_enter(); const before=x.snap(); x.e.finish(0xcaca000a);
  assert.notDeepEqual(x.snap(),before); assert.equal(x.e.mm_timer_in_cb.value,0);
  console.log('REPRODUCED baseline: CACA000A accepted unrelated child, cleared guard and restored caller');
  process.exit(0);
}
let cases=0;
for (const route of ['timer','dispatch','wave','midi']) {
  const x=setup(), {e}=x;
  const enter = () => route==='timer' ? e.fire_mm_timer() : route==='dispatch' ? x.dispatch()
    : route==='wave' ? e.fire_wave_out_callback_bound(11,22,0x402000,33)
    : e.fire_midi_out_callback_bound(11,22,0x402000,33,0x3c9);
  const original=e.invocation_current(); enter(); assert.notEqual(e.invocation_current(),original);
  assert.deepEqual(Array.from({length:6},(_,i)=>x.get(x.sp()+4*i)),
    route==='timer'||route==='dispatch' ? [0x500000,7,0,33,0,0]
      : [0x500000,11,route==='wave'?0x3bd:0x3c9,33,22,0]);
  const busy=x.snap(); assert.equal(e.fire_mm_timer(),0); assert.deepEqual(x.snap(),busy);
  assert.equal(e.get_cf(),1); x.ret();
  const child=e.invocation_enter(); x.reject(()=>e.finish(0xcaca000a),route+' mismatched child');
  x.reject(()=>e.preflight(0),route+' dispatcher preflight');
  e.invocation_leave(child);
  x.put(0xb010,x.sp()+4); x.reject(()=>e.finish(0xcaca000a),route+' malformed ESP'); x.put(0xb010,x.sp()-4);
  e.flag_a.value=0; e.set_flags_inc(8,9); e.finish(0xcaca000a);
  assert.equal(e.invocation_current(),original); assert.equal(e.get_cf(),1);
  assert.equal(x.sp(),route==='dispatch'?0x18008:0x18000);
  assert.equal(e.eip.value,route==='dispatch'?0x405555:0x401234);
  assert.equal(e.mm_timer_in_cb.value,0); x.reject(()=>e.finish(0xcaca000a),route+' duplicate');
  cases++;
  for (const failure of ['depth','serial','tid','root','epoch','records','uninitialized']) {
    const y=setup();
    if(failure==='depth') for(let i=0;i<63;i++) y.e.invocation_enter();
    if(failure==='serial') y.dv.setBigUint64(0,0xffffffffffffffffn,true);
    if(failure==='tid') y.e.current_thread_id.value=2;
    if(failure==='root') y.dv.setBigUint64(16,999n,true);
    if(failure==='epoch') y.dv.setBigUint64(8,999n,true);
    if(failure==='records') {y.e.mm_callback_owner.value=y.e.invocation_root.value; y.e.mm_callback_depth.value=64;}
    if(failure==='uninitialized') y.e.invocation_root.value=0n;
    // Prepare DispatchMessage's inputs before the snapshot.
    const p=0xb300; [33,0x7ff0,7,0x402000].forEach((v,i)=>y.put(p+i*4,v)); y.put(y.sp(),0x405555);
    const f=()=>route==='timer'?y.e.fire_mm_timer():route==='dispatch'?y.e.dispatchTimer(p)
      :route==='wave'?y.e.fire_wave_out_callback_bound(11,22,0x402000,33):y.e.fire_midi_out_callback_bound(11,22,0x402000,33,0x3c9);
    y.reject(f,route+' admission '+failure);cases++;
  }
  for (const failure of ['root','epoch','tid','child-reused']) {
    const y=setup();
    if(route==='timer') y.e.fire_mm_timer();
    else if(route==='dispatch') y.dispatch();
    else if(route==='wave') y.e.fire_wave_out_callback_bound(11,22,0x402000,33);
    else y.e.fire_midi_out_callback_bound(11,22,0x402000,33,0x3c9);
    y.ret();
    if(failure==='root') y.dv.setBigUint64(16,999n,true);
    if(failure==='epoch') y.dv.setBigUint64(8,999n,true);
    if(failure==='tid') y.e.current_thread_id.value=2;
    if(failure==='child-reused') {y.e.invocation_leave(y.e.invocation_current()); y.e.invocation_enter();}
    y.reject(()=>y.e.finish(0xcaca000a),'return '+failure);cases++;
    y.reject(()=>y.e.preflight(0),'preflight '+failure);
  }
}
// Nested DispatchMessage callback inside either outer timer or audio owner.
for(const audio of [false,true]) {
  const x=setup(),{e}=x; e.yield_reason.value=1; e.yield_flag.value=1; e.wait_handle.value=42;
  if(audio) e.fire_wave_out_callback_bound(11,22,0x402000,33); else e.fire_mm_timer();
  const outer=e.invocation_current(), outerSP=x.sp();
  x.put(0xb010,outerSP-8); x.dispatch(); x.ret(); e.finish(0xcaca000a);
  assert.equal(x.sp(),outerSP); assert.equal(e.invocation_current(),outer);
  assert.equal(e.mm_timer_in_cb.value,1); assert.equal(e.yield_reason.value,0);
  assert.equal(e.wave_callback_saved.value,audio?1:0);
  x.ret(); e.finish(0xcaca000a); assert.equal(e.yield_reason.value,1);
  assert.equal(e.mm_timer_in_cb.value,0); assert.equal(e.wait_handle.value,42);cases++;
}
// CACA003B has no CACA000A save frame. Never accept it as that continuation.
{
  const x=setup(),{e}=x; x.put(0xb208,0x500100); e.mm_timer_thread_step();
  const threadSP=x.sp(),threadEIP=e.eip.value;
  e.fire_wave_out_callback_bound(11,22,0x402000,33);
  x.reject(()=>e.mm_timer_thread_step(),'CACA003B cannot discard live audio frame');
  x.put(0xb400,0xcaca003b); x.reject(()=>e.preflight(0),'CACA003B dispatcher preflight'); x.put(0xb400,0xcaca000a);
  x.ret(); e.finish(0xcaca000a);
  assert.equal(x.sp(),threadSP); assert.equal(e.eip.value,threadEIP);
  x.ret(); x.reject(()=>e.finish(0xcaca000a),'thread callback wrong continuation');
  e.mm_timer_thread_step(); assert.equal(e.eip.value,0x500100); cases++;
}
// Polling without a due function releases its provisional child; one-shots
// retire once, while periodic timers retain their original interval phase.
for(const mode of ['none','not-due','periodic','event']) {
  const x=setup(),{e}=x, parent=e.invocation_current();
  if(mode==='none') x.put(0xb100,0);
  if(mode==='not-due') x.put(0xb110,1000);
  if(mode==='periodic') {x.slot(0); x.put(0xb110,3);}
  if(mode==='event') x.slot(0x11);
  const fired=e.fire_mm_timer();
  if(mode==='periodic') {assert.equal(fired,1); assert.equal(x.get(0xb110),993); x.ret(); e.finish(0xcaca000a);}
  else {assert.equal(fired,0); assert.equal(x.sp(),0x18000); assert.equal(e.mm_timer_in_cb.value,0);}
  assert.equal(e.invocation_current(),parent); assert.equal(e.mm_callback_depth.value,0);cases++;
}
// Observe two actual nested production callback frames, draining at explicit
// boundaries. No callback instruction bytes are generated or patched here.
if(ex.includes(';; Bounded callback-context observations')) {
  const api=require('../tools/gltron-native-decode-ring.cjs');
  const x=setup(),{e}=x,records=[],session={session:1,endpointIdentity:1520,slot:0};
  assert.equal(e.callback_feed_arm(1),1);
  const drain=()=>{
    assert.equal(e.callback_feed_invalid(),0);
    for(let i=0;i<e.callback_feed_count();i++){
      const v=Array.from({length:15},(_,j)=>e.callback_feed_get(i,j)>>>0);
      records.push({...session,sequence:v[1],kind:['','suspend','admit','ret','restore','cancel','dispatch-suspend'][v[0]],
        context:[v[2],v[3]],root:[v[12],v[13]],depth:v[11],
        cpu:Object.fromEntries(['pc','esp','ebp','eax','ecx','edx','saved'].map((k,j)=>[k,v[j+4]]))});
    }
    e.callback_feed_drain();
  };
  e.fire_wave_out_callback_bound(11,22,0x402000,33);drain();
  const outerSP=x.sp();x.put(0xb010,outerSP-8);x.dispatch();drain();
  x.ret();e.eip.value=0x500000;e.callbackFeedRet(0x500000);drain();e.finish(0xcaca000a);drain();
  x.ret();e.eip.value=0x500000;e.callbackFeedRet(0x500000);drain();e.finish(0xcaca000a);drain();
  assert.deepEqual(records.map(r=>r.kind),['suspend','admit','dispatch-suspend','admit','ret','restore','ret','restore']);
  const make=()=>api.createValidator({owner:{},epoch:{},lifetime:{},verify:()=>true,callbackSession:session});
  const observation={...session,sequence:records.length,invalid:null};
  const v=make();for(const r of records)assert.notEqual(v.transition(r,observation).status,'INVALID');
  assert.notEqual(v.finish(observation).status,'INVALID');
  const bad=make();for(const r of records.filter((_,i)=>i!==5))bad.transition(r,observation);
  assert.equal(bad.finish(observation).status,'INVALID');
  // CPU queue loss cannot be hidden by draining or by a later valid restore.
  const y=setup();assert.equal(y.e.callback_feed_arm(1),1);
  for(let i=0;i<3;i++){y.e.fire_wave_out_callback_bound(11,22,0x402000,33);y.ret();y.e.finish(0xcaca000a);}
  assert.equal(y.e.callback_feed_invalid(),1);y.e.callback_feed_drain();assert.equal(y.e.callback_feed_invalid(),1);
  cases+=3;
}
console.log(`PASS mm timer ownership: ${cases} production-slice cases`);
if(process.argv.includes('--controls')) {
  const r=cp.spawnSync(process.execPath,[__filename],{env:{...process.env,MM_OWNER_MUTATION:'skip-check'},encoding:'utf8'});
  assert.notEqual(r.status,0); assert.match(r.stderr,/Missing expected exception.*timer mismatched child/s);
  console.log('DETECTED negative control: replaced retained expected identity with current child');
}
