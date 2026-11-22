#!/usr/bin/env node
'use strict';
// Contract: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-tounicodeex
// x86 ABI: https://learn.microsoft.com/en-us/cpp/cpp/stdcall
// Literal US columns/CAPLOK attributes, independent of emulator translation:
// https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/kbdus/kbdus.c
// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
// Ctrl A..Z literal control values:
// https://learn.microsoft.com/en-us/cpp/windows/accelerator-editor
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const letters = [
 [0x41,'a','A',1],[0x42,'b','B',2],[0x43,'c','C',3],[0x44,'d','D',4],
 [0x45,'e','E',5],[0x46,'f','F',6],[0x47,'g','G',7],[0x48,'h','H',8],
 [0x49,'i','I',9],[0x4a,'j','J',10],[0x4b,'k','K',11],[0x4c,'l','L',12],
 [0x4d,'m','M',13],[0x4e,'n','N',14],[0x4f,'o','O',15],[0x50,'p','P',16],
 [0x51,'q','Q',17],[0x52,'r','R',18],[0x53,'s','S',19],[0x54,'t','T',20],
 [0x55,'u','U',21],[0x56,'v','V',22],[0x57,'w','W',23],[0x58,'x','X',24],
 [0x59,'y','Y',25],[0x5a,'z','Z',26],
];
const other = [
 [0x30,'0',')'],[0x31,'1','!'],[0x32,'2','@'],[0x33,'3','#'],
 [0x34,'4','$'],[0x35,'5','%'],[0x36,'6','^'],[0x37,'7','&'],
 [0x38,'8','*'],[0x39,'9','('],
 [0xba,';',':'],[0xbb,'=','+'],[0xbc,',','<'],[0xbd,'-','_'],
 [0xbe,'.','>'],[0xbf,'/','?'],[0xc0,'`','~'],[0xdb,'[','{'],
 [0xdc,'\\','|'],[0xdd,']','}'],[0xde,"'",'"'],
 [0x20,' ',' '],[0x08,'\b','\b'],[0x09,'\t','\t'],[0x0d,'\r','\r'],[0x1b,'\x1b','\x1b'],
 [0x6a,'*','*'],[0x6b,'+','+'],[0x6d,'-','-'],[0x6f,'/','/'],
];
const cases = [];
for (const shift of [0,0x80]) for (const caps of [0,1]) {
 for (const [vk,lower,upper,ctrl] of letters) {
  cases.push({vk,shift,caps,ctrl:0,want:(!!shift !== !!caps ? upper : lower).charCodeAt(0),kind:'documented-US'});
  cases.push({vk,shift,caps,ctrl:0x80,want:ctrl,kind:shift||caps?'existing-Ctrl-compatibility':'documented-control'});
 }
 for (const [vk,lower,upper] of other)
  cases.push({vk,shift,caps,ctrl:0,want:(shift ? upper : lower).charCodeAt(0),kind:'documented-US'});
 // Function/modifier keys have no character columns in the US sample.
 for (const vk of [0x10,0x11,0x14,0x70]) cases.push({vk,shift,caps,ctrl:0,want:null,kind:'no-character'});
}
cases.push({vk:0x41,shift:1,caps:0x80,ctrl:1,want:0x61,kind:'documented-state-bits'});
// The existing translator accepts these no-output cases. These are
// compatibility checks only; no claim about undocumented Windows calls.
const noOutput = [
 {outNull:true,capacity:1},{outNull:true,capacity:0},{outNull:true,capacity:-1},
 {outNull:false,capacity:0},{outNull:false,capacity:-1},{outNull:false,capacity:-2147483648},
];
const extraWat = String.raw`
 (func (export "tue_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "tue_lookup") (param $ex i32) (result i32)
  (if (result i32) (local.get $ex)
   (then (call $lookup_api_id "ToUnicodeEx"))
   (else (call $lookup_api_id "ToUnicode"))))
 (func (export "tue_module") (param $name i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "tue_resolve") (param $module i32) (param $name i32) (result i32)
  (call $handle_GetProcAddress (local.get $module) (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "tue_reg") (param $i i32) (result i32)
  (i32.load (i32.add (global.get $reg_base) (i32.shl (local.get $i) (i32.const 2)))))
 (func (export "tue_seed") (param $i i32) (param $v i32)
  (i32.store (i32.add (global.get $reg_base) (i32.shl (local.get $i) (i32.const 2))) (local.get $v)))
 (func (export "tue_call") (param $thunk i32)
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get $thunk) (global.get $thunk_guest_base)) (i32.const 3))))
`;
async function main() {
 const {exports:e}=await bootRenderHarness({extraWat,fonts:'none',width:32,height:32});
 e.init_thread(1,0x400000,0,0,0,0,0);
 e.heap_init(0x800000);
 e.tue_init();
 const stack=(e.guest_alloc(256)>>>0)+64;
 const state=e.guest_alloc(256)>>>0, buffer=e.guest_alloc(32)>>>0;
 const unrelated=e.guest_alloc(32)>>>0;
 const text=s=>{const p=e.guest_alloc(s.length+1)>>>0;Array.from(s+'\0').forEach((c,i)=>e.guest_write8(p+i,c.charCodeAt(0)));return p;};
 e.tue_seed(4,stack);
 const module=e.tue_module(text('USER32.DLL'))>>>0;
 assert.notEqual(module,0,'USER32 module');
 const names=['ToUnicode','ToUnicodeEx'];
 const ids=names.map((_,i)=>e.tue_lookup(i)>>>0);
 const thunks=names.map(n=>{e.tue_seed(4,stack);return e.tue_resolve(module,text(n))>>>0;});
 console.log(JSON.stringify({publicResolution:{ids,thunks}}));
 assert.notEqual(ids[0],0xffff,'existing public lookup');
 assert.notEqual(thunks[0],0,'existing public resolver');
 let calls=0;
 function check(ex,c,opts={}) {
  const esp=stack+(opts.skew||0), out=opts.outNull?0:buffer+4;
  const capacity=opts.capacity===undefined?1:opts.capacity;
  const saved=Array.from({length:8},(_,i)=>0x12340000+i);saved[4]=esp;
  saved.forEach((v,i)=>e.tue_seed(i,v));
  for(let i=0;i<256;i++)e.guest_write8(state+i,0);
  e.guest_write8(state+0x10,c.shift);e.guest_write8(state+0x14,c.caps);e.guest_write8(state+0x11,c.ctrl);
  for(let i=0;i<32;i++){e.guest_write8(buffer+i,0xa5);e.guest_write8(unrelated+i,0x5a);}
  for(let i=-16;i<64;i+=4)e.guest_write32(esp+i,0x56780000+i);
  const args=[c.vk,0,state,out,capacity,0,0x04090409];
  args.slice(0,ex?7:6).forEach((v,i)=>e.guest_write32(esp+4+i*4,v));
  const read=(p,n)=>Array.from({length:n},(_,i)=>e.guest_read8(p+i));
  const beforeStack=read(esp-16,80),beforeState=read(state,256),beforeOther=read(unrelated,32),beforeOut=read(buffer,32);
  const eip=e.get_eip();
  e.tue_call(thunks[ex]);
  const written=out!==0&&capacity>0&&c.want!==null;
  const expectedOut=beforeOut.slice();if(written){expectedOut[4]=c.want&255;expectedOut[5]=c.want>>>8;}
  const label=names[ex]+' '+JSON.stringify({c,opts});
  assert.equal(e.tue_reg(0)>>>0,written?1:0,label+' EAX');
  assert.equal(e.tue_reg(4)>>>0,esp+(ex?32:28),label+' stdcall');
  for(const i of [1,2,3,5,6,7])assert.equal(e.tue_reg(i)>>>0,saved[i],label+' register '+i);
  assert.equal(e.get_eip(),eip,label+' EIP');
  assert.deepEqual(read(buffer,32),expectedOut,label+' UTF16/count and output bounds');
  assert.deepEqual(read(state,256),beforeState,label+' unchanged state');
  assert.deepEqual(read(esp-16,80),beforeStack,label+' stack arguments/bounds');
  assert.deepEqual(read(unrelated,32),beforeOther,label+' unrelated bounds');calls++;
 }
 const run=ex=>{for(const c of cases)check(ex,c);for(const opts of noOutput)check(ex,cases[0],opts);};
 // Parent must compile and instantiate successfully, then demonstrate actual
 // existing public thunk behavior before the missing public resolver check.
 run(0);
 console.log(JSON.stringify({ids,thunks,existingPublicCalls:calls}));
 assert.notEqual(ids[1],0xffff,'missing public ToUnicodeEx lookup');
 assert.notEqual(thunks[1],0,'missing public USER32 ToUnicodeEx resolver');
 assert.equal(require('../src/api_table.json').find(r=>r.name==='ToUnicodeEx').nargs,7);
 run(1);
 for(const opts of [{capacity:4},{skew:4},{outNull:true,capacity:0,skew:4}])check(1,cases[0],opts);
 console.log('PASS ToUnicodeEx public thunk, independent literal US characters, ABI and bounds '+calls);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={letters,other,cases,noOutput,extraWat};
