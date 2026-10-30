#!/usr/bin/env node
'use strict';
// Qualification of exact production slices, not a full interpreter/build.
// Reuse only the accepted extraction harness, not its acceptance scenarios.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const filename = path.join(root, 'test/test-mm-timer-release-review.js');
let harness = fs.readFileSync(filename, 'utf8').split('let cases = 0;')[0];
assert(harness.includes('const {setup} = m.exports;'));
// Mutation exists only in compiled test text; production files are unchanged.
if (process.env.TIMER_THREAD_CONTROL === 'remove-check') {
  harness = harness.replace('m._compile(fixture, filename);',
    `m._compile(fixture.replace("let joined = bodies.join('\\\\n');",
      "let joined = bodies.join('\\\\n').replaceAll('(call $mm_timer_thread_check)', '');"), filename);`);
}
harness += '\nmodule.exports = {setup};\n';
const m = new Module(filename, module);
m.filename = filename; m.paths = module.paths;
m._compile(harness, filename);
const {setup} = m.exports;
const rows = [];
function start() {
  const x = setup(), e = x.e;
  e.thunk_guest_base.value = 0x500000;
  x.put(0xb208, 0x500100); x.put(0xb400, 0xcaca003b);
  e.eip.value = 0x500100;
  // Initial thread entry goes through the same actual routing/dispatch arm.
  e.routeReturn();
  assert.equal(e.eip.value, 0x402000);
  assert.equal(x.sp(), 0x18000 - 24);
  assert.deepEqual(Array.from({length:6}, (_,i)=>x.get(x.sp()+i*4)),
    [0x500100,7,0,33,0,0]);
  assert.equal(x.get(0xb100), 0, 'one-shot consumed');
  return x;
}
function finish(x) { x.e.ret20(20); x.e.routeReturn(); }
function idle(x) {
  assert.equal(x.sp(), 0x18000); assert.equal(x.e.eip.value, 0x500100);
  assert.equal(x.e.sleep_timeout.value, 50); assert.equal(x.e.sleep_yielded.value, 1);
}
{
  const x=start(), identity=x.e.invocation_current(); finish(x); idle(x);
  assert.equal(x.e.invocation_current(),identity);
  rows.push({case:'normal actual RET20 / route / dispatcher / CACA003B',result:'PASS'});
}
// Rejection snapshots start after guest RET20; it legitimately pops 24 bytes.
for (const mode of ['root','epoch','thread-id','slot-reuse','process-restart']) {
  const x=start(); x.e.ret20(20);
  if(mode==='root') x.dv.setBigUint64(16,999n,true);
  if(mode==='epoch') x.dv.setBigUint64(8,999n,true);
  if(mode==='thread-id') x.e.current_thread_id.value=2;
  if(mode==='slot-reuse') setup(x.e.memory,false).e.invocation_thread_begin(0);
  if(mode==='process-restart') setup(x.e.memory,false).e.invocation_process_begin();
  x.reject(()=>x.e.fullDispatch(32), 'stale '+mode);
  rows.push({case:'stale '+mode,result:'REJECT before dispatcher effects'});
}
{
  const x=start(), e=x.e;
  e.fire_wave_out_callback_bound(11,22,0x402000,33);
  x.reject(()=>e.fullDispatch(32),'CACA003B collision with CACA000A');
  x.put(0xb400,0xcaca000a); finish(x);
  assert.equal(x.sp(),0x18000-24); assert.equal(e.eip.value,0x402000);
  x.put(0xb400,0xcaca003b); finish(x); idle(x);
  rows.push({case:'CACA000A collision then legitimate audio and thread returns',result:'PASS'});
}
{
  const x=start(); x.put(0xb400,0xcaca000a); x.e.ret20(20);
  x.reject(()=>x.e.fullDispatch(32),'wrong continuation family');
  rows.push({case:'return claiming CACA000A without its retained frame',result:'REJECT'});
}
// A convention mismatch is intentionally normalized by the pinned loop ESP.
for (const pop of [0,16,24]) {
  const x=start(); x.e.ret20(pop); x.e.routeReturn(); idle(x);
  rows.push({case:'RET '+pop+' stack mismatch',result:'ACCEPT and pin ESP (documented policy)'});
}
// Table reuse is legitimate: the old call's arguments live on its stack, and
// its return may immediately admit the new due timer occupying the same slot.
{
  const x=start();
  [8,10,0x403000,44,0,1].forEach((v,i)=>x.put(0xb100+i*4,v));
  finish(x);
  assert.equal(x.e.eip.value,0x403000);
  assert.deepEqual(Array.from({length:6},(_,i)=>x.get(x.sp()+i*4)),
    [0x500100,8,0,44,0,0]);
  finish(x); idle(x);
  rows.push({case:'timer-table slot reuse while first callback is live',result:'PASS two distinct argument frames'});
}
// Valid current identities are not evidence of the callback's retained identity.
for (const mode of ['unrelated-child','same-depth-child-reuse','rebound-thread-root']) {
  const x=setup(), e=x.e;
  e.thunk_guest_base.value=0x500000; x.put(0xb208,0x500100); x.put(0xb400,0xcaca003b);
  e.eip.value=0x500100;
  let old;
  if(mode==='same-depth-child-reuse') old=e.invocation_enter();
  e.routeReturn();
  const admitted=e.invocation_current();
  if(mode==='unrelated-child') e.invocation_enter();
  if(mode==='same-depth-child-reuse') {e.invocation_leave(old); e.invocation_enter();}
  if(mode==='rebound-thread-root') e.invocation_thread_begin(0);
  const replacement=e.invocation_current(); assert.notEqual(replacement,admitted);
  e.ret20(20);
  if(process.argv.includes('--require-safe')) {
    x.reject(()=>e.fullDispatch(32),'retained CACA003B '+mode);
  } else {
    e.routeReturn(); idle(x); assert.equal(e.invocation_current(),replacement);
    rows.push({case:mode,result:'FAIL: accepted stale callback under replacement identity',
      admitted:String(admitted),replacement:String(replacement)});
  }
}
console.log(JSON.stringify({verdict:'FAIL retained CACA003B lifetime',rows},null,2));
if(process.argv.includes('--controls')) {
  const r=cp.spawnSync(process.execPath,[__filename],{
    env:{...process.env,TIMER_THREAD_CONTROL:'remove-check'},encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/Missing expected exception.*stale root/s);
  console.log('DETECTED rejecting control: removing actual thread checks makes stale-root assertion fail');
}
