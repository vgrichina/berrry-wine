#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {bootRenderHarness}=require('./render-helper');
const table=require('../src/api_table.json');
// Independent literals from Microsoft MapVirtualKey A/W/ExA/ExW contracts:
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeya
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyw
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyexa
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyexw
// Actual US sample selects KBD_TYPE 4; T56's fourth column is OEM_102.
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.h
// https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/kbd.h
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
const forward=[[0xE2,0,0x56],[0xE2,4,0x56],[0xE2,2,0x5C]];
const compatibility=[
 [0xDC,0,0x2B],[0xDC,4,0x2B],[0xDC,2,0x5C],
 [0x41,0,0x1E],[0x41,4,0x1E],[0x41,2,0x41],
 [0xBF,0,0x35],[0xBF,4,0x35],[0xBF,2,0x2F],
 [0x10,0,0x2A],[0xA3,4,0xE01D],[0x26,4,0xE048],
 [0x60,0,0x52],[0x6F,4,0xE035],[0x2C,4,0xE037],
 [0x2B,1,0xDC],[0x2B,3,0xDC],
 [0,0,0],[0,2,0],[0,4,0],[0xE1,0,0],[0xE3,0,0],
];
const extraWat=String.raw`
 (func (export "oem102_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "oem102_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "oem102_id") (param $p i32) (result i32) (call $lookup_api_id (call $g2w (local.get $p))))
 (func (export "oem102_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "oem102_regs") (result i32) (global.get $reg_base))
 (func (export "oem102_call") (param $p i32)
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
`;
async function main(){
 const state=new Uint8Array(256);let hostReads=0,hostWrites=0;
 const {exports:e,memory}=await bootRenderHarness({extraWat,fonts:'none',width:32,height:32,extraHostOverrides:{
  get_key_down_state:vk=>{hostReads++;return state[vk]||0;},
  get_key_state:vk=>{hostReads++;return state[vk]||0;},
  set_key_down_state:(vk,value)=>{hostWrites++;state[vk]=value;},
 }});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.oem102_init();
 const view=new DataView(memory.buffer),regs=e.oem102_regs()>>>0,wa=p=>e.guest_to_wasm(p)>>>0;
 const stackArea=e.guest_alloc(256)>>>0,stack=stackArea+64;
 const output=e.guest_alloc(64)>>>0,guestState=e.guest_alloc(256)>>>0;
 const bytes=(p,n)=>new Uint8Array(memory.buffer,wa(p),n);
 const text=s=>{const p=e.guest_alloc(s.length+1)>>>0;bytes(p,s.length+1).set(Buffer.from(s+'\0'));return p;};
 view.setUint32(regs+16,stack,true);
 const module=e.oem102_module(text('USER32.DLL'))>>>0;assert.ok(module,'public USER32');
 const names=['MapVirtualKeyA','MapVirtualKeyW','MapVirtualKeyExA','MapVirtualKeyExW','GetKeyboardLayout'];
 const entries=new Map();
 for(const name of names){const p=text(name),row=table.find(r=>r.name===name),id=e.oem102_id(p)>>>0;assert.ok(row,name+' registration');assert.equal(id,row.id,name+' hash lookup');view.setUint32(regs+16,stack,true);const thunk=e.oem102_resolve(module,p)>>>0;assert.ok(thunk,name+' public resolver');assert.equal(view.getUint32(wa(thunk)+4,true),id,name+' thunk');entries.set(name,{thunk,nargs:row.nargs});}
 const failures=[];let calls=0;
 function invoke(name,args,want,label,skew=0){const {thunk,nargs}=entries.get(name);assert.equal(args.length,nargs);const esp=stack+skew;
  bytes(stackArea,256).fill(0xA5);bytes(output,64).fill(0x6B);bytes(guestState,256).set(state);
  for(let i=0;i<8;i++)view.setUint32(regs+i*4,0x41320000+i,true);view.setUint32(regs+16,esp,true);
  view.setUint32(wa(esp),0x12345678,true);args.forEach((v,i)=>view.setUint32(wa(esp)+4+i*4,v,true));
  const savedStack=Buffer.from(bytes(stackArea,256)),savedOutput=Buffer.from(bytes(output,64)),savedState=Buffer.from(state),savedGuestState=Buffer.from(bytes(guestState,256)),reads=hostReads,writes=hostWrites,eip=e.get_eip();
  e.oem102_call(thunk);const actual=view.getUint32(regs,true);
  if(actual!==want)failures.push({name,args,want,actual,label,skew,modifiers:[state[0x10],state[0x11],state[0x12],state[0x14]]});
  assert.equal(view.getUint32(regs+16,true),esp+4+nargs*4,label+' ESP');
  for(const i of [1,2,3,5,6,7])assert.equal(view.getUint32(regs+i*4,true),0x41320000+i,label+' register '+i);
  assert.equal(e.get_eip(),eip,label+' EIP');assert.deepEqual(Buffer.from(bytes(stackArea,256)),savedStack,label+' stack');
  assert.deepEqual(Buffer.from(bytes(output,64)),savedOutput,label+' output');assert.deepEqual(Buffer.from(bytes(guestState,256)),savedGuestState,label+' guest state');assert.deepEqual(Buffer.from(state),savedState,label+' host state');assert.equal(hostReads,reads,label+' no modifier reads');assert.equal(hostWrites,writes,label+' no state writes');calls++;return actual;
 }
 const hkl=invoke('GetKeyboardLayout',[0],0x04090409,'current US layout');
 for(const shift of [0,1,0x80,0x81])for(const ctrl of [0,0x80])for(const alt of [0,0x80])for(const caps of [0,1]){
  state.fill(0);state[0x10]=shift;state[0x11]=ctrl;state[0x12]=alt;state[0x14]=caps;
  for(const name of names.slice(0,4))for(const skew of [0,4])for(const [code,type,want]of [...forward,...compatibility])invoke(name,name.includes('Ex')?[code,type,hkl]:[code,type],want,name+' literal/compatibility '+code+':'+type,skew);
 }
 console.log(JSON.stringify({calls,failures}));assert.equal(failures.length,0,'independent literal OEM102 forward mappings');console.log('PASS '+calls+' public MapVirtualKey OEM102, modifier independence, compatibility, ABI and canaries');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={forward,compatibility,extraWat};
