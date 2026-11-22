#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Independent literal US columns from Microsoft's keyboard driver sample:
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// Contracts (pressed high bit, Caps toggle, count and output unit):
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-toascii
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-toasciiex
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-tounicode
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-tounicodeex
// Ctrl+Shift keeps existing output, as a compatibility check only. Microsoft's
// three-column OEM table provides no exact Ctrl+Shift oracle; defer that case.
const oem = [[0xDB, 0x5B, 0x7B, 0x1B], [0xDC, 0x5C, 0x7C, 0x1C], [0xDD, 0x5D, 0x7D, 0x1D]];
const cases = [];
for (const [vk, plain, shifted, control] of oem) {
  for (const ctrl of [0, 1, 0x7F, 0x80, 0x81])
    for (const shift of [0, 1, 0x80, 0x81])
      for (const alt of [0, 1, 0x7F, 0x80, 0x81])
        for (const caps of [0, 1, 0x80, 0x81]) {
          const compatibility = !!(alt & 0x80) || !!((ctrl & 0x80) && (shift & 0x80));
          cases.push({vk, ctrl, shift, alt, caps,
            want: (ctrl & 0x80) && !(shift & 0x80) && !(alt & 0x80) ? control : (shift & 0x80) ? shifted : plain,
            kind: compatibility ? 'existing-ShiftCtrl-or-Alt-compatibility' : 'documented-US'});
        }
}
// Literal controls outside the change: their existing behavior must survive.
const controls = [[0x41, 0x61, 0x41, 0x01], [0x5A, 0x7A, 0x5A, 0x1A],
  [0x31, 0x31, 0x21, 0x31], [0xBA, 0x3B, 0x3A, 0x3B],
  [0xDE, 0x27, 0x22, 0x27], [0x6A, 0x2A, 0x2A, 0x2A],
  [0x6B, 0x2B, 0x2B, 0x2B], [0x6D, 0x2D, 0x2D, 0x2D], [0x6F, 0x2F, 0x2F, 0x2F]];
for (const [vk, plain, shifted, control] of controls)
  for (const ctrl of [0, 0x80]) for (const shift of [0, 0x80])
    cases.push({vk, ctrl, shift, alt:0, caps:0,
      want: ctrl && vk >= 0x41 && vk <= 0x5A ? control : shift ? shifted : plain,
      kind: ctrl ? 'existing-control-compatibility' : 'documented-US'});

const names = ['ToAscii', 'ToAsciiEx', 'ToUnicode', 'ToUnicodeEx'];
const nargs = [5, 6, 6, 7];
const extraWat = String.raw`
 (func (export "oem_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "oem_module") (param $name i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "oem_resolve") (param $module i32) (param $name i32) (result i32)
  (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "oem_reg") (param $i i32) (result i32)
  (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $i) (i32.const 2)))))
 (func (export "oem_seed") (param $i i32) (param $v i32)
  (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $i) (i32.const 2))) (local.get $v)))
 (func (export "oem_call") (param $thunk i32)
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 3))))
`;

async function main() {
  const {exports:e} = await bootRenderHarness({extraWat,fonts:'none',width:32,height:32});
  e.init_thread(1,0x400000,0,0,0,0,0);
  e.heap_init(0x800000);
  e.oem_init();
  const stack=(e.guest_alloc(256)>>>0)+64;
  const state=e.guest_alloc(256)>>>0, output=e.guest_alloc(32)>>>0, unrelated=e.guest_alloc(32)>>>0;
  const text=s=>{const p=e.guest_alloc(s.length+1)>>>0;Array.from(s+'\0').forEach((c,i)=>e.guest_write8(p+i,c.charCodeAt(0)));return p;};
  e.oem_seed(4,stack);
  const module=e.oem_module(text('USER32.DLL'))>>>0;
  assert.notEqual(module,0,'USER32 module');
  const thunks=names.map(name=>{e.oem_seed(4,stack);const thunk=e.oem_resolve(module,text(name))>>>0;assert.notEqual(thunk,0,name+' public resolver');return thunk;});
  console.log(JSON.stringify({publicResolution:{names,thunks}}));
  const read=(p,n)=>Array.from({length:n},(_,i)=>e.guest_read8(p+i));
  const failures=[];
  let calls=0;
  for(let api=0;api<names.length;api++) for(const skew of [0,4]) for(const c of cases) {
    const esp=stack+skew;
    const regs=[0xA0123456,0x11223344,0x22334455,0x33445566,esp,0x44556677,0x55667788,0x66778899];
    regs.forEach((v,i)=>e.oem_seed(i,v));
    for(let i=0;i<256;i++)e.guest_write8(state+i,0);
    e.guest_write8(state+0x10,c.shift);e.guest_write8(state+0x11,c.ctrl);
    e.guest_write8(state+0x12,c.alt);e.guest_write8(state+0x14,c.caps);
    for(let i=0;i<32;i++){e.guest_write8(output+i,0xA5);e.guest_write8(unrelated+i,0x5A);}
    for(let i=-16;i<64;i+=4)e.guest_write32(esp+i,0x56780000+i);
    const args=api<2?[c.vk,0,state,output+4,0,0x04090409]:[c.vk,0,state,output+4,1,0,0x04090409];
    args.slice(0,nargs[api]).forEach((v,i)=>e.guest_write32(esp+4+i*4,v));
    const beforeStack=read(esp-16,80),beforeState=read(state,256),beforeOther=read(unrelated,32);
    const expectedOut=read(output,32);expectedOut[4]=c.want;expectedOut[5]=0;
    const eip=e.get_eip();
    e.oem_call(thunks[api]);
    const label=names[api]+' '+JSON.stringify({c,skew});
    const actual=e.guest_read8(output+4)|(e.guest_read8(output+5)<<8);
    if((e.oem_reg(0)>>>0)!==1||actual!==c.want)failures.push({api:names[api],...c,skew,returned:e.oem_reg(0)>>>0,actual});
    assert.equal(e.oem_reg(4)>>>0,esp+4+nargs[api]*4,label+' stdcall');
    for(const i of [1,2,3,5,6,7])assert.equal(e.oem_reg(i)>>>0,regs[i],label+' register '+i);
    assert.equal(e.get_eip(),eip,label+' EIP');
    // Preserve evidence of translation failures while still checking all bounds.
    const actualOut=read(output,32);actualOut[4]=expectedOut[4];actualOut[5]=expectedOut[5];
    assert.deepEqual(actualOut,expectedOut,label+' output bounds');
    assert.deepEqual(read(state,256),beforeState,label+' unchanged state');
    assert.deepEqual(read(esp-16,80),beforeStack,label+' stack bounds');
    assert.deepEqual(read(unrelated,32),beforeOther,label+' unrelated bounds');
    calls++;
  }
  console.log(JSON.stringify({calls,failed:failures.length,failures}));
  assert.equal(failures.length,0,'literal US Ctrl OEM public translations');
  console.log('PASS '+calls+' public ToAscii/Ex and ToUnicode/Ex literal OEM/control/ABI cases');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={oem,cases,controls,extraWat};
