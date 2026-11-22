#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {bootRenderHarness}=require('./render-helper');
const table=require('../src/api_table.json');
// Independent Microsoft type2 contract: unshifted character value.
// US aVkToWch2 first column: TAB '\t'; aVkToWch3 first column:
// BACK '\b', RETURN '\r', ESCAPE 0x001b, each with attributes 0.
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeya
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyw
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyexa
// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mapvirtualkeyexw
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
// No ToAscii or NumLock/Shift-dependent translation is used as an oracle.
const controls=[[0x08,2,0x08],[0x09,2,0x09],[0x0D,2,0x0D],[0x1B,2,0x1B]];
const keypadCompatibility=[
 [0x60,2,0x30],[0x61,2,0x31],[0x62,2,0x32],[0x63,2,0x33],[0x64,2,0x34],
 [0x65,2,0x35],[0x66,2,0x36],[0x67,2,0x37],[0x68,2,0x38],[0x69,2,0x39],
 [0x6A,2,0x2A],[0x6B,2,0x2B],[0x6D,2,0x2D],[0x6E,2,0x2E],[0x6F,2,0x2F],
];
// Published compatibility controls; no new Windows claims about these cases.
const compatibility=[
 ...keypadCompatibility,
 [0x08,0,0x0E],[0x09,0,0x0F],[0x0D,0,0x1C],[0x1B,0,0x01],
 [0x08,4,0x0E],[0x09,4,0x0F],[0x0D,4,0x1C],[0x1B,4,0x01],
 [0x07,2,0],[0x0A,2,0],[0x0C,2,0],[0x0E,2,0],[0x1A,2,0],[0x1C,2,0],
 [0x108,2,0],[0x109,2,0],[0x10D,2,0],[0x11B,2,0],
 [0x08,5,0],[0x1B,0xFFFFFFFF,0],
 [0x41,2,0x41],[0x5A,2,0x5A],[0x30,2,0x30],[0x39,2,0x39],[0x20,2,0x20],
 [0xBA,2,0x3B],[0xBB,2,0x3D],[0xBC,2,0x2C],[0xBD,2,0x2D],[0xBE,2,0x2E],
 [0xBF,2,0x2F],[0xC0,2,0x60],[0xDB,2,0x5B],[0xDC,2,0x5C],[0xDD,2,0x5D],
 [0xDE,2,0x27],[0xE2,2,0x5C],
 [0x60,0,0x52],[0x61,0,0x4F],[0x62,0,0x50],[0x63,0,0x51],[0x64,0,0x4B],
 [0x65,0,0x4C],[0x66,0,0x4D],[0x67,0,0x47],[0x68,0,0x48],[0x69,0,0x49],
 [0x6A,0,0x37],[0x6B,0,0x4E],[0x6D,0,0x4A],[0x6E,0,0x53],[0x6F,0,0],
 [0x60,4,0x52],[0x61,4,0x4F],[0x62,4,0x50],[0x63,4,0x51],[0x64,4,0x4B],
 [0x65,4,0x4C],[0x66,4,0x4D],[0x67,4,0x47],[0x68,4,0x48],[0x69,4,0x49],
 [0x6A,4,0x37],[0x6B,4,0x4E],[0x6D,4,0x4A],[0x6E,4,0x53],[0x6F,4,0xE035],
 [0x41,0,0x1E],[0x41,4,0x1E],[0xBF,0,0x35],[0xBF,4,0x35],
 [0xE2,0,0x56],[0xE2,4,0x56],[0x56,1,0xE2],[0x56,3,0xE2],
 [0x10,0,0x2A],[0xA3,4,0xE01D],[0x26,4,0xE048],[0x2C,4,0xE037],
 [0,2,0],[0x5F,2,0],[0x6C,2,0],[0x70,2,0],[0xFF,2,0],[0x100,2,0],
 [0x160,2,0],[0x16F,2,0],[0xFFFFFFFF,2,0],[0x60,5,0],[0x6F,0xFFFFFFFF,0],
];
const extraWat=String.raw`
 (func (export "controls2_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "controls2_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "controls2_id") (param $p i32) (result i32) (call $lookup_api_id (call $g2w (local.get $p))))
 (func (export "controls2_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "controls2_regs") (result i32) (global.get $reg_base))
 (func (export "controls2_call") (param $p i32)
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
`;
async function main(){
 const state=new Uint8Array(256);let hostReads=0,hostWrites=0;
 const {exports:e,memory}=await bootRenderHarness({extraWat,fonts:'none',width:32,height:32,extraHostOverrides:{
  get_key_down_state:vk=>{hostReads++;return state[vk]||0;},
  get_key_state:vk=>{hostReads++;return state[vk]||0;},
  set_key_down_state:(vk,value)=>{hostWrites++;state[vk]=value;},
 }});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.controls2_init();
 const view=new DataView(memory.buffer),regs=e.controls2_regs()>>>0,wa=p=>e.guest_to_wasm(p)>>>0;
 const stackArea=e.guest_alloc(256)>>>0,stack=stackArea+64;
 const output=e.guest_alloc(64)>>>0,guestState=e.guest_alloc(256)>>>0;
 const bytes=(p,n)=>new Uint8Array(memory.buffer,wa(p),n);
 const text=s=>{const p=e.guest_alloc(s.length+1)>>>0;bytes(p,s.length+1).set(Buffer.from(s+'\0'));return p;};
 view.setUint32(regs+16,stack,true);
 const module=e.controls2_module(text('USER32.DLL'))>>>0;assert.ok(module,'public USER32');
 const names=['MapVirtualKeyA','MapVirtualKeyW','MapVirtualKeyExA','MapVirtualKeyExW','GetKeyboardLayout'];
 const entries=new Map();
 for(const name of names){const p=text(name),row=table.find(r=>r.name===name),id=e.controls2_id(p)>>>0;assert.ok(row,name+' registration');assert.equal(id,row.id,name+' hash lookup');view.setUint32(regs+16,stack,true);const thunk=e.controls2_resolve(module,p)>>>0;assert.ok(thunk,name+' public resolver');assert.equal(view.getUint32(wa(thunk)+4,true),id,name+' thunk');entries.set(name,{thunk,nargs:row.nargs});}
 const failures=[];let calls=0;
 function invoke(name,args,want,label,skew=0){const {thunk,nargs}=entries.get(name);assert.equal(args.length,nargs);const esp=stack+skew;
  bytes(stackArea,256).fill(0xA5);bytes(output,64).fill(0x6B);bytes(guestState,256).set(state);
  for(let i=0;i<8;i++)view.setUint32(regs+i*4,0x41320000+i,true);view.setUint32(regs+16,esp,true);
  view.setUint32(wa(esp),0x12345678,true);args.forEach((v,i)=>view.setUint32(wa(esp)+4+i*4,v,true));
  const savedStack=Buffer.from(bytes(stackArea,256)),savedOutput=Buffer.from(bytes(output,64)),savedState=Buffer.from(state),savedGuestState=Buffer.from(bytes(guestState,256)),reads=hostReads,writes=hostWrites,eip=e.get_eip();
  e.controls2_call(thunk);const actual=view.getUint32(regs,true);
  if(actual!==want)failures.push({name,args,want,actual,label,skew,modifiers:[state[0x10],state[0x11],state[0x12],state[0x14]]});
  assert.equal(view.getUint32(regs+16,true),esp+4+nargs*4,label+' ESP');
  for(const i of [1,2,3,5,6,7])assert.equal(view.getUint32(regs+i*4,true),0x41320000+i,label+' register '+i);
  assert.equal(e.get_eip(),eip,label+' EIP');assert.deepEqual(Buffer.from(bytes(stackArea,256)),savedStack,label+' stack');
  assert.deepEqual(Buffer.from(bytes(output,64)),savedOutput,label+' output');assert.deepEqual(Buffer.from(bytes(guestState,256)),savedGuestState,label+' guest state');assert.deepEqual(Buffer.from(state),savedState,label+' host state');assert.equal(hostReads,reads,label+' no modifier reads');assert.equal(hostWrites,writes,label+' no state writes');calls++;return actual;
 }
 const hkl=invoke('GetKeyboardLayout',[0],0x04090409,'current US layout');
 for(const shift of [0,1,0x80,0x81])for(const ctrl of [0,0x80])for(const alt of [0,0x80])for(const caps of [0,1])for(const num of [0,1,0x80,0x81]){
  state.fill(0);state[0x10]=shift;state[0x11]=ctrl;state[0x12]=alt;state[0x14]=caps;state[0x90]=num;
  for(const name of names.slice(0,4))for(const skew of [0,4])for(const [code,type,want]of [...controls,...compatibility])invoke(name,name.includes('Ex')?[code,type,hkl]:[code,type],want,name+' literal/compatibility '+code+':'+type,skew);
 }
 console.log(JSON.stringify({calls,controlChecks:128*4*2*controls.length,failures}));assert.equal(failures.length,0,'independent literal US control type2 mappings');console.log('PASS '+calls+' public MapVirtualKey control type2, modifier independence, compatibility, ABI and canaries');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={controls,compatibility,extraWat};
