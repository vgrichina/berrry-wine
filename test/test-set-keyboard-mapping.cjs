#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setkeyboardstate
// Exactly 256 input bytes. Preserve the emulator's highbit-only host model;
// toggles and thread/async separation are deliberately outside this fixture.
const extraWat = String.raw`
 (func (export "sk_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "sk_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "sk_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "sk_regs") (result i32) (global.get $reg_base))
 (func (export "sk_state") (param $i i32) (result i32)
  (select (global.get $current_thread_id)
   (select (global.get $yield_reason)
    (select (global.get $last_error) (global.get $guest_span_cursor)
     (i32.eq (local.get $i) (i32.const 2)))
    (i32.eq (local.get $i) (i32.const 1)))
   (i32.eqz (local.get $i))))
 (func (export "sk_call") (param $thunk i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 3))))
` + ['flag_op','flag_a','flag_b','flag_res','flag_sign_shift','capture_hwnd'].map(name =>
  `(func (export "sk_${name}") (result i32) (global.get $${name}))`).join('\n');

async function main() {
  let trace = [], reads = 0;
  const harness = await bootRenderHarness({extraWat,fonts:'none',width:32,height:32,
    beforeInstantiate(ctx, host) {
      const setter = host.set_key_down_state;
      host.set_key_down_state = (key,value) => { trace.push([key,value]); return setter(key,value); };
      host.get_keyboard_state = host.get_key_down_state = host.get_async_key_state = () => {
        reads++; throw Error('SetKeyboardState must only set keys');
      };
    }});
  const e=harness.exports, memory=new Uint8Array(harness.memory.buffer), view=new DataView(harness.memory.buffer);
  e.init_thread(1,0x400000,0,0,0,0,0); e.heap_init(0x800000); e.sk_init();
  const regs=e.sk_regs()>>>0, alloc=n=>e.guest_alloc(n)>>>0, wa=p=>e.guest_to_wasm(p)>>>0;
  const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));
  const text=s=>{const p=alloc(s.length+1);Buffer.from(s+'\0').forEach((v,i)=>e.guest_write8(p+i,v));return p;};
  const stackArea=alloc(256), stack=stackArea+64, unrelated=alloc(256), direct=alloc(12288);
  memory.fill(0x6b,wa(unrelated),wa(unrelated)+256);
  view.setUint32(regs+16,stack,true); const module=e.sk_module(text('USER32.DLL'))>>>0;
  assert.ok(module,'public USER32 module');
  view.setUint32(regs+16,stack,true); const thunk=e.sk_resolve(module,text('SetKeyboardState'))>>>0;
  assert.ok(thunk,'public GetProcAddress SetKeyboardState');
  const api=apiTable.find(a=>a.name==='SetKeyboardState');
  assert.ok(api);assert.equal(api.nargs,1);assert.equal(api.convention,'stdcall');
  assert.equal(view.getUint32(wa(thunk)+4,true),api.id,'public thunk identity');
  const page=0x30000000,spacer=0x28000000;
  for(const p of [page,spacer,page+4096])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
  const mappings=[page,spacer,page+4096].map(wa);
  assert.notEqual(mappings[2],mappings[0]+4096,'adjacent guest pages separately backed');
  assert.equal(mappings[1],mappings[0]+4096,'decoy after first backing');
  const patterns=[
    {name:'all byte values',input:Buffer.from(Array.from({length:256},(_,i)=>i)),expected:Buffer.from('00'.repeat(128)+'80'.repeat(128),'hex')},
    {name:'reverse byte values',input:Buffer.from(Array.from({length:256},(_,i)=>255-i)),expected:Buffer.from('80'.repeat(128)+'00'.repeat(128),'hex')},
    {name:'toggle only',input:Buffer.alloc(256,1),expected:Buffer.alloc(256)},
    {name:'all low bits',input:Buffer.alloc(256,127),expected:Buffer.alloc(256)},
    {name:'all bits',input:Buffer.alloc(256,255),expected:Buffer.alloc(256,128)},
    {name:'alternating high and toggle',input:Buffer.from('8001'.repeat(128),'hex'),expected:Buffer.from('8000'.repeat(128),'hex')},
    {name:'alternating toggle and high',input:Buffer.from('0180'.repeat(128),'hex'),expected:Buffer.from('0080'.repeat(128),'hex')},
    {name:'all clear',input:Buffer.alloc(256),expected:Buffer.alloc(256)},
  ];
  let calls=0,crossCalls=0,controls=0,nullCalls=0;const failures=[];
  function invoke(p,pattern,label,regions) {
    if(p){
      regions.forEach(([start,n],i)=>memory.fill(0xa5+i,start,start+n));
      pattern.input.forEach((v,i)=>e.guest_write8(p+i,v));
    }
    const backing=regions.map(([start,n])=>Buffer.from(memory.subarray(start,start+n)));
    const esp=stack+(calls%2)*4;
    memory.fill(0x5a,wa(stackArea),wa(stackArea)+256);
    e.guest_write32(esp,0x12345678);e.guest_write32(esp+4,p);
    const stackBefore=read(stackArea,256),otherBefore=read(unrelated,256);
    const seed=[0xa0123456,0x11223344,0x22334455,0x33445566,esp,0x44556677,0x55667788,0x66778899];
    seed.forEach((v,i)=>view.setUint32(regs+i*4,v,true));
    const state=Array.from({length:4},(_,i)=>e.sk_state(i));
    const flags=['flag_op','flag_a','flag_b','flag_res','flag_sign_shift','capture_hwnd'];
    const flagBefore=flags.map(n=>e['sk_'+n]());
    const hostBefore=Array.from({length:256},(_,i)=>!!harness.renderer._asyncKeys?.[i]);
    trace=[];e.sk_call(thunk);
    const result=view.getUint32(regs,true),wanted=p?1:0;
    if(result!==wanted)failures.push({label,BOOL:result,expected:wanted});
    const expectedTrace=p?Array.from(pattern.expected,(value,key)=>[key,value]):[];
    if(JSON.stringify(trace)!==JSON.stringify(expectedTrace))failures.push({label,setters:trace.length,expected:expectedTrace.length,first:trace.slice(0,3)});
    for(let i=0;i<256;i++){
      const expected=p?!!pattern.expected[i]:hostBefore[i];
      if(!!harness.renderer._asyncKeys?.[i]!==expected){failures.push({label,hostKey:i,expected});break;}
    }
    assert.equal(e.get_esp()>>>0,esp+8,label+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,label+' EIP');
    for(const i of [1,2,3,5,6,7])assert.equal(view.getUint32(regs+i*4,true),seed[i],label+' register '+i);
    assert.deepEqual(read(stackArea,256),stackBefore,label+' full stack');
    assert.deepEqual(read(unrelated,256),otherBefore,label+' unrelated memory');
    assert.deepEqual(Array.from({length:4},(_,i)=>e.sk_state(i)),state,label+' thread/yield/error/span state');
    assert.deepEqual(flags.map(n=>e['sk_'+n]()),flagBefore,label+' flags/capture');
    assert.equal(reads,0,label+' no host reads');
    if(p)assert.deepEqual(read(p,256),pattern.input,label+' complete input unchanged');
    regions.forEach(([start,n],i)=>assert.deepEqual(Buffer.from(memory.subarray(start,start+n)),backing[i],label+' backing '+i));
    calls++;
  }
  const directRegions=[[wa(direct),12288]], sparseRegions=mappings.map(p=>[p,4096]);
  for(let repeat=0;repeat<2;repeat++)for(const pattern of patterns){
    for(const skew of [0,1,127,255,256,3839,3840,3841,4095]){
      invoke(direct+skew,pattern,'contiguous '+pattern.name+' '+skew+' '+repeat,directRegions);controls++;
    }
    for(let split=0;split<=256;split++){
      invoke(page+4096-split,pattern,'split '+split+' '+pattern.name+' '+repeat,sparseRegions);
      if(split>0&&split<256)crossCalls++;else controls++;
    }
    invoke(0,pattern,'NULL '+pattern.name+' '+repeat,sparseRegions);nullCalls++;
  }
  console.log(JSON.stringify({publicAPI:'USER32.SetKeyboardState',module,thunk,apiId:api.id,mappings,calls,crossCalls,controls,nullCalls,
    failures:failures.length,firstFailures:failures.slice(0,8),all256Bytes:true,allByteValues:true,exactSetterValuesOrderCount:true,backingCanaries:true,ABI:true}));
  assert.equal(failures.length,0,'public SetKeyboardState consumes complete valid nonaffine tables');
  console.log('PASS SetKeyboardState all256 bytes, all splits, highbit patterns, repeated calls, contiguous controls, NULL no writes, full input/backing canaries and ABI');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
