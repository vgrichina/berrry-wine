#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');

// Independent literal US aVkToWch4 column 3 (Shift+Ctrl), attributes=0.
// WCH_NONE is 0xF000; U+0000 here is a successful character, distinct from null below.
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/kbd.h
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-toascii
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-toasciiex
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-tounicode
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-tounicodeex
// Current unshifted Ctrl and Alt-down outputs are compatibility checks only.
const symbols = [[0x32,0x32,0x40,0x0000],[0x36,0x36,0x5E,0x001E],[0xBD,0x2D,0x5F,0x001F]];
const cases = [];
for(const [vk,plain,shifted,controlShift] of symbols)
 for(const ctrl of [0,1,0x7F,0x80,0x81,0xFF])
  for(const shift of [0,1,0x7F,0x80,0x81])
   for(const alt of [0,1,0x7F,0x80,0x81])
    for(const caps of [0,1,0x80,0x81])
     for(const toggles of [0,1]) {
      const target=!!(ctrl&0x80)&&!!(shift&0x80)&&!(alt&0x80);
      cases.push({vk,ctrl,shift,alt,caps,toggles,
       want:target?controlShift:(shift&0x80)?shifted:plain,
       kind:target?'documented-US-CtrlShift':(ctrl&0x80)||(alt&0x80)?'existing-compatibility':'documented-US-ordinary'});
     }
// Explicit absent translations: null means no output, while numeric 0 means NUL success.
for(const vk of [0x10,0x11,0x14,0x70])
 for(const ctrl of [0,0x80])for(const shift of [0,0x80])
  cases.push({vk,ctrl,shift,alt:0,caps:1,toggles:1,want:null,kind:'no-character'});

const names = ['ToAscii', 'ToAsciiEx', 'ToUnicode', 'ToUnicodeEx'];
const nargs = [5, 6, 6, 7];
const extraWat = String.raw`
 (func (export "symbols_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "symbols_module") (param $name i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "symbols_resolve") (param $module i32) (param $name i32) (result i32)
  (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "symbols_reg") (param $i i32) (result i32)
  (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $i) (i32.const 2)))))
 (func (export "symbols_seed") (param $i i32) (param $v i32)
  (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $i) (i32.const 2))) (local.get $v)))
 (func (export "symbols_call") (param $thunk i32)
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 3))))
`;

async function main() {
  const {exports:e} = await bootRenderHarness({extraWat,fonts:'none',width:32,height:32});
  e.init_thread(1,0x400000,0,0,0,0,0);
  e.heap_init(0x800000);
  e.symbols_init();
  const stack=(e.guest_alloc(256)>>>0)+64;
  const state=e.guest_alloc(256)>>>0, output=e.guest_alloc(32)>>>0, unrelated=e.guest_alloc(32)>>>0;
  const text=s=>{const p=e.guest_alloc(s.length+1)>>>0;Array.from(s+'\0').forEach((c,i)=>e.guest_write8(p+i,c.charCodeAt(0)));return p;};
  e.symbols_seed(4,stack);
  const module=e.symbols_module(text('USER32.DLL'))>>>0;
  assert.notEqual(module,0,'USER32 module');
  const thunks=names.map(name=>{e.symbols_seed(4,stack);const thunk=e.symbols_resolve(module,text(name))>>>0;assert.notEqual(thunk,0,name+' public resolver');return thunk;});
  console.log(JSON.stringify({publicResolution:{names,thunks}}));
  const read=(p,n)=>Array.from({length:n},(_,i)=>e.guest_read8(p+i));
  const failures=[];
  let calls=0;
  for(let api=0;api<names.length;api++) for(const skew of [0,4]) for(const c of cases) {
    const esp=stack+skew;
    const regs=[0xA0123456,0x11223344,0x22334455,0x33445566,esp,0x44556677,0x55667788,0x66778899];
    regs.forEach((v,i)=>e.symbols_seed(i,v));
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
    e.symbols_call(thunks[api]);
    const label=names[api]+' '+JSON.stringify({c,skew});
    const actual=e.guest_read8(output+4)|(e.guest_read8(output+5)<<8);
    if((e.symbols_reg(0)>>>0)!==(c.want===null?0:1)||actual!==(c.want===null?0xA5A5:c.want))failures.push({api:names[api],...c,skew,returned:e.symbols_reg(0)>>>0,actual});
    assert.equal(e.symbols_reg(4)>>>0,esp+4+nargs[api]*4,label+' stdcall');
    for(const i of [1,2,3,5,6,7])assert.equal(e.symbols_reg(i)>>>0,regs[i],label+' register '+i);
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
  assert.equal(failures.length,0,'literal US CtrlShift symbols public translations');
  console.log('PASS '+calls+' public ToAscii/Ex and ToUnicode/Ex literal CtrlShift symbols/NUL/no-character/compatibility/ABI cases');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={cases,extraWat};

