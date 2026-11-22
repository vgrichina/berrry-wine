#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Literal VK_CANCEL row in Microsoft's US aVkToWch3 is attributes=0,
// plain 0003, Shift 0003, Ctrl 0003. CharModifiers selects columns 0/1/2
// for no modifier/Shift/unshifted Ctrl. Caps does not affect this row.
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-toascii
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-toasciiex
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-tounicode
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-tounicodeex
// Shift+Ctrl and Alt-down CANCEL cases preserve existing no-output behavior;
// their outputs are compatibility checks, without a Windows behavior claim.
const cases = [];
for (const ctrl of [0, 1, 0x7F, 0x80, 0x81, 0xFF])
  for (const shift of [0, 1, 0x7F, 0x80, 0x81])
    for (const alt of [0, 1, 0x7F, 0x80, 0x81])
      for (const caps of [0, 1, 0x80, 0x81])
        for (const toggles of [0, 1]) {
          const control = !!(ctrl & 0x80), shifted = !!(shift & 0x80);
          const compatibility = !!(alt & 0x80) || (control && shifted);
          cases.push({vk:0x03, ctrl, shift, alt, caps, toggles,
            want: compatibility ? null : 0x0003,
            kind: compatibility ? 'existing-ShiftCtrl-or-Alt-compatibility' : 'documented-US-CANCEL'});
        }

// Ordinary cases retain literal expectations already exercised by focused fixtures.
// They cover neighboring translations while CANCEL is added.
for (const caps of [0, 1, 0x80, 0x81]) for (const toggles of [0, 1]) {
  const upper = !!(caps & 1);
  for (const [vk,ctrl,shift,alt,want] of [
    [0x41,0,0,0,upper?0x41:0x61], [0x41,0,0x80,0,upper?0x61:0x41],
    [0x41,0x80,0,0,1], [0x41,0x80,0x80,0,1],
    [0x0D,0,0,0,0x0D], [0x0D,0x80,0,0,0x0A],
    [0x0D,0x80,0x80,0,0x0D], [0x0D,0x80,0,0x80,0x0D],
    [0x08,0,0,0,8], [0x08,0x80,0,0,0x7F],
    [0xE2,0,0x80,0,0x7C], [0xE2,0x80,0,0,0x1C]
  ]) cases.push({vk,ctrl,shift,alt,caps,toggles,want,kind:'existing-ordinary-compatibility'});
}

const names = ['ToAscii', 'ToAsciiEx', 'ToUnicode', 'ToUnicodeEx'];
const nargs = [5, 6, 6, 7];
const extraWat = String.raw`
 (func (export "cancel_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "cancel_module") (param $name i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "cancel_resolve") (param $module i32) (param $name i32) (result i32)
  (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "cancel_reg") (param $i i32) (result i32)
  (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $i) (i32.const 2)))))
 (func (export "cancel_seed") (param $i i32) (param $v i32)
  (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $i) (i32.const 2))) (local.get $v)))
 (func (export "cancel_call") (param $thunk i32)
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 3))))
`;

async function main() {
  const {exports:e} = await bootRenderHarness({extraWat,fonts:'none',width:32,height:32});
  e.init_thread(1,0x400000,0,0,0,0,0);
  e.heap_init(0x800000);
  e.cancel_init();
  const stack=(e.guest_alloc(256)>>>0)+64;
  const state=e.guest_alloc(256)>>>0, output=e.guest_alloc(32)>>>0, unrelated=e.guest_alloc(32)>>>0;
  const text=s=>{const p=e.guest_alloc(s.length+1)>>>0;Array.from(s+'\0').forEach((c,i)=>e.guest_write8(p+i,c.charCodeAt(0)));return p;};
  e.cancel_seed(4,stack);
  const module=e.cancel_module(text('USER32.DLL'))>>>0;
  assert.notEqual(module,0,'USER32 module');
  const thunks=names.map(name=>{e.cancel_seed(4,stack);const thunk=e.cancel_resolve(module,text(name))>>>0;assert.notEqual(thunk,0,name+' public resolver');return thunk;});
  console.log(JSON.stringify({publicResolution:{names,thunks}}));
  const read=(p,n)=>Array.from({length:n},(_,i)=>e.guest_read8(p+i));
  const failures=[];
  let calls=0;
  for(let api=0;api<names.length;api++) for(const skew of [0,4]) for(const c of cases) {
    const esp=stack+skew;
    const regs=[0xA0123456,0x11223344,0x22334455,0x33445566,esp,0x44556677,0x55667788,0x66778899];
    regs.forEach((v,i)=>e.cancel_seed(i,v));
    for(let i=0;i<256;i++)e.guest_write8(state+i,0);
    e.guest_write8(state+0x01,0xA5);e.guest_write8(state+0x87,0x5A);
    e.guest_write8(state+0x10,c.shift);e.guest_write8(state+0x11,c.ctrl);
    e.guest_write8(state+0x12,c.alt);e.guest_write8(state+0x14,c.caps);
    e.guest_write8(state+0x90,c.toggles);e.guest_write8(state+0x91,c.toggles);
    for(let i=0;i<32;i++){e.guest_write8(output+i,0xA5);e.guest_write8(unrelated+i,0x5A);}
    for(let i=-16;i<64;i+=4)e.guest_write32(esp+i,0x56780000+i);
    const args=api<2?[c.vk,0,state,output+4,0,0x04090409]:[c.vk,0,state,output+4,1,0,0x04090409];
    args.slice(0,nargs[api]).forEach((v,i)=>e.guest_write32(esp+4+i*4,v));
    const beforeStack=read(esp-16,80),beforeState=read(state,256),beforeOther=read(unrelated,32);
    const expectedOut=read(output,32);if(c.want!==null){expectedOut[4]=c.want;expectedOut[5]=0;}
    const eip=e.get_eip();
    e.cancel_call(thunks[api]);
    const label=names[api]+' '+JSON.stringify({c,skew});
    const actual=e.guest_read8(output+4)|(e.guest_read8(output+5)<<8);
    if((e.cancel_reg(0)>>>0)!==(c.want===null?0:1)||actual!==(c.want===null?0xA5A5:c.want))failures.push({api:names[api],...c,skew,returned:e.cancel_reg(0)>>>0,actual});
    assert.equal(e.cancel_reg(4)>>>0,esp+4+nargs[api]*4,label+' stdcall');
    for(const i of [1,2,3,5,6,7])assert.equal(e.cancel_reg(i)>>>0,regs[i],label+' register '+i);
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
  assert.equal(failures.length,0,'literal US CANCEL public translations');
  console.log('PASS '+calls+' public ToAscii/Ex and ToUnicode/Ex literal CANCEL/compatibility/ABI cases');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={cases,extraWat};

