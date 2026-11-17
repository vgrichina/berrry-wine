'use strict';
const assert=require('node:assert/strict');
const native=require('../lib/cli-native-user-windows');
const {createGuardedInput}=require('../lib/cli-guarded-input');
let row=[0n,3n,65537n,1000n,1n,18n,38n,1n],live=1,generation=3n,pid=1000,tid=1,open=0;
const target={hwnd:'0x10001',generation:'3',processId:1000,threadId:1,parent:'0x0',live:true,visible:true,isChild:false,style:0x10000000};
const e={get_process_id:()=>pid,get_window_thread:()=>tid,wnd_lookup_live:()=>live,wnd_lookup_generation:()=>generation,
 native_menu_pointer_receipt:i=>row[i],menu_open_hwnd:()=>open,menu_bar_screen_x:()=>0,menu_bar_screen_y:()=>30,
 menu_hittest_bar:(h,x,y,sx,sy)=>sx>=0&&sx<60&&sy>=30&&sy<48?0:-1};
const instance={exports:e},event={action:'mousedown',x:18,y:38};
const snapshot={windows:[target],pointerMapping:{canvas:{w:800,h:600},transform:null,viewport:null,clip:null}};
const capture=(ev=event,intent=null,snap=snapshot,manager=null)=>native.captureNativeButton(ev,intent,snap,instance,manager);
const confirm=f=>native.confirmNativeButton(f,event);
let fence=capture();assert(fence);assert.equal(confirm(fence),null,'historical native return is not delivery');
row[0]++;assert.equal(confirm(fence).receiptBoundary,'native-menu-pointer-return');
for(const [i,v]of [[0,2n],[1,4n],[2,65538n],[3,1001n],[4,2n],[5,19n],[6,39n],[7,2n]]){
 const saved=row[i];row[i]=v;assert.equal(confirm(fence),null,'wrong sequence/generation/window/process/thread/point/route');row[i]=saved;
}
for(const mutate of [()=>live=0,()=>generation=4n,()=>pid=1001,()=>tid=2]){
 mutate();assert.equal(confirm(fence),null,'native identity must survive the call');live=1;generation=3n;pid=1000;tid=1;
}
assert.equal(capture(event,null,snapshot,{threads:new Map([[2,{state:'active',instance:{exports:e}}]])}),null,'ambiguous actor');
assert.equal(capture(event,{review:{targetHwnd:'0x10002'}}),null,'foreign reviewed target');
assert.equal(capture({...event,x:200}),null,'client click is not menu delivery');
assert.equal(capture({...event,action:'mouseup'}),null,'UP cannot acknowledge DOWN');
open=65537;assert.equal(capture(),null,'open-menu selection is outside the bar-return contract');open=0;
assert.equal(capture(event,null,{...snapshot,windows:[{...target,style:0x18000000}]}),null,'disabled');
assert.equal(capture(event,null,{...snapshot,windows:[{...target,generation:'4'}]}),null,'stale generation');
let now=1000,ups=0,refs={queue:[]};
const guard=createGuardedInput({snapshot:()=>({healthy:true,refs}),cleanup:()=>ups++,nativeDelivery:true,
 captureNativeControl:()=>capture(),confirmNativeControl:native.confirmNativeButton,now:()=>now,monotonic:()=>now});
const owner=guard.bind(),prepare=nonce=>guard.prepare({...owner,nonce,reviewed:true,deadline:now+500},event);
let t=prepare('real-return'),r=guard.consume(t,()=>row[0]++);assert(r.consumed);assert.equal(r.receiptBoundary,'native-menu-pointer-return');
assert.equal(r.nativeMessage.msg,undefined,'a menu return does not fabricate a guest mouse message');guard.release(owner.owner);
t=prepare('host-only');r=guard.consume(t,()=>{});assert.equal(r.state,'UNKNOWN');assert(!r.consumed);
assert.equal(guard.consume(t,()=>row[0]++).state,'UNKNOWN','no replay');
t=prepare('late-return');r=guard.consume(t,()=>{row[0]++;now+=501;});assert.equal(r.state,'UNKNOWN');assert(!r.consumed);
t=prepare('queue-replaced');refs={queue:[]};r=guard.consume(t,()=>row[0]++);assert.equal(r.state,'CANCELLED');assert(!r.consumed);
assert(ups>=3);guard.close();console.log('PASS menu native-return proof, identity/sequence/point/route/queue/deadline/UNKNOWN negatives');

// Small authored guest for a real top-level menu command followed by its normal
// timer-based shutdown. The timer lets the physical UP finish before exit.
function menuQuitFixture(){
 const b=require('../tools/kernel32-native-fixture').makeFixture(),raw=r=>r-0x1000+0x200,u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 b.fill(0,raw(0x1800),raw(0x1bff));
 b.writeUInt32LE(60,0x80+24+108);
 for(const [r,n]of [[0x1800,0x1900],[0x180c,0x1880],[0x1810,0x1900],[0x1814,0x1940],[0x1820,0x18a0],[0x1824,0x1940]])b.writeUInt32LE(n,raw(r));
 b.write('kernel32.dll\0',raw(0x1880));b.write('user32.dll\0',raw(0x18a0));b.writeUInt32LE(0x1a00,raw(0x1900));b.write('ExitProcess\0',raw(0x1a02));
 const names=['RegisterClassA','DefWindowProcA','CreateWindowExA','CreateMenu','AppendMenuA','SetMenu','GetMessageA','TranslateMessage','DispatchMessageA','PostQuitMessage','SetTimer','KillTimer'];
 let cursor=0x1b00;for(const [i,name]of names.entries()){b.writeUInt32LE(cursor,raw(0x1940+i*4));b.write(name+'\0',raw(cursor+2));cursor+=name.length+3;}
 function asm(r,body){const a=[],labels={},fix=[];const emit=(...v)=>a.push(...v),push=n=>emit(0x68,...u32(n)),call=i=>emit(0xff,0x15,...u32(0x401940+4*i));
  const label=n=>labels[n]=a.length,jump=(op,n)=>{emit(...op,0,0,0,0);fix.push([a.length-4,n]);};body({emit,push,call,label,jump});
  for(const [at,n]of fix){const v=Buffer.alloc(4);v.writeInt32LE(labels[n]-at-4);for(let j=0;j<4;j++)a[at+j]=v[j];}b.set(a,raw(r));}
 b.write('MenuReceiptFixture\0',raw(0x2500));b.write('Native menu Quit fixture\0',raw(0x2540));b.write('&Quit\0',raw(0x2580));
 b.fill(0,raw(0x2600),raw(0x2800));b.writeUInt32LE(0x402300,raw(0x2604));b.writeUInt32LE(0x400000,raw(0x2610));b.writeUInt32LE(0x402500,raw(0x2624));
 asm(0x2000,({emit,push,call,label,jump})=>{
  push(0x402600);call(0);for(const n of [0,0x400000,0,0,400,640,20,20,0x10cf0000,0x402540,0x402500,0])push(n);call(2);emit(0x89,0xc6);
  call(3);emit(0x89,0xc7);push(0x402580);push(100);push(0);emit(0x57);call(4);emit(0x57,0x56);call(5);
  label('loop');push(0);push(0);push(0);push(0x402700);call(6);emit(0x85,0xc0);jump([0x0f,0x84],'exit');
  push(0x402700);call(7);push(0x402700);call(8);jump([0xe9],'loop');label('exit');push(0);emit(0xff,0x15,...u32(0x401900),0xcc);
 });
 asm(0x2300,({emit,push,call,label,jump})=>{
  emit(0x81,0x7c,0x24,8,...u32(0x111));jump([0x0f,0x85],'timer');
  emit(0x83,0x7c,0x24,12,100);jump([0x0f,0x85],'default');push(0);push(400);push(1);emit(0xff,0x74,0x24,16);call(10);jump([0xe9],'zero');
  label('timer');emit(0x81,0x7c,0x24,8,...u32(0x113));jump([0x0f,0x85],'default');push(1);emit(0xff,0x74,0x24,8);call(11);push(0);call(9);
  label('zero');emit(0x31,0xc0,0xc2,16,0);label('default');for(let i=0;i<4;i++)emit(0xff,0x74,0x24,16);call(1);emit(0xc2,16,0);
 });return b;
}
module.exports={menuQuitFixture};
if(process.argv[2]==='--make-fixture')require('node:fs').writeFileSync(process.argv[3],menuQuitFixture());
