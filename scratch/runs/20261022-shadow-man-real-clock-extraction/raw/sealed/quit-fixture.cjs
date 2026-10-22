'use strict';
// Exact new read-only primitives, synthetic state controls; no guest acceptance.
const assert=require('assert/strict'),{quitProbe,bindHostInput}=require('./quit-probe.cjs');
let quit=0,main=0x10001,tick=100,queue=[],rows=[],mem=new Map(),calls=0;
const e={get_quit_flag:()=>quit,get_main_hwnd:()=>main,get_tick_count:()=>tick,get_post_queue_count:()=>queue.length,post_queue_peek:(i,j)=>queue[i][j],wnd_get_proc_export:h=>h===main?0x401000:0};
const p=quitProbe({exports:e,read:a=>mem.get(a)||0,emit:r=>rows.push(r),now:()=> 'fixture'});
p.sample('initial');assert.equal(rows.at(-1).quit,0);const n=rows.length;p.pc(0x400100,()=>[]);assert.equal(rows.length,n);
// Normal timer dispatch records actual MSG and callback identity, without quit.
[main,0x113,1001,0,100,0,0].forEach((x,i)=>mem.set(0x200+i*4,x));p.api('DispatchMessageA',[0x200],0x406356,'entry');assert.deepEqual(rows.at(-1).message,[main,0x113,1001,0,100,0,0]);assert.equal(rows.at(-1).wndproc,0x401000);
p.pc(0x401000,()=>[0x406356,main,0x113,1001,0]);assert.equal(rows.at(-1).kind,'window-callback');assert.equal(rows.at(-1).stack[2],0x113);
// A real explicit quit control is observable, never suppressed or rewritten.
p.api('PostQuitMessage',[7],0x401123,'entry');assert.equal(rows.at(-1).caller,0x401123);quit=2;p.api('PostQuitMessage',[7],0x401123,'return');assert.equal(rows.at(-1).quit,2);assert(rows.some(r=>r.kind==='quit-transition'&&r.quit===2));
quit=0;p.sample('consumed');main=0;quit=1;p.sample('teardown');assert.equal(rows.at(-1).quit,1);main=0x10008;quit=0;p.sample('recreated');assert.equal(rows.at(-1).main,0x10008);
queue.push([main,0x12,9,0]);p.sample('posted-quit');assert.deepEqual(rows.at(-1).queue,queue);queue=[];p.sample('removed');assert.deepEqual(rows.at(-1).queue,[]);
const h={token:42,check_input(){calls++;assert.equal(this.token,42);return calls===1?0:18;},check_input_hwnd:x=>x,check_input_lparam:()=>0};
bindHostInput(h,()=>e,r=>rows.push(r));let count=rows.length;assert.equal(h.check_input(),0);assert.equal(rows.length,count);assert.equal(h.check_input(),18);assert.equal(rows.at(-1).result,18);assert.equal(rows.at(-1).kind,'host-input');assert.equal(h.check_input_hwnd(main),main);assert.deepEqual(rows.at(-1).args,[main]);assert.equal(h.check_input_lparam(),0);assert.equal(rows.at(-1).result,0);assert.equal(calls,2);
assert.equal(quit,0);assert.equal(main,0x10008);assert.equal(tick,100);assert.deepEqual(queue,[]);
// Exercise the actual observer entry/exit/PC integration, not just a parallel logger.
const {makeObserver}=require('./observer.cjs'),memory={buffer:new ArrayBuffer(8*1024**2)},dv=new DataView(memory.buffer);
e.get_image_base=()=>0x400000;e.get_esp=()=>0x200;e.get_eax=()=>1;e.get_eip=()=>0x401000;e.get_ebp=()=>0;
dv.setUint32(0x200,0x401123,true);dv.setUint32(0x204,7,true);
const integrated=makeObserver({memory,exports:e,translate:a=>a,emit:r=>rows.push(r),stop:()=>assert.fail('observer fault'),findFile:()=>null});
integrated.entry('PostQuitMessage');quit=2;integrated.exit();assert(rows.some(r=>r.kind==='entry'&&r.name==='PostQuitMessage'&&r.caller===0x401123&&r.args[0]===7));assert(rows.some(r=>r.kind==='return'&&r.name==='PostQuitMessage'));assert.equal(rows.at(-2).quit,2);assert.equal(integrated.errors().length,0);
quit=0;integrated.pc(0x401234);assert.equal(rows.at(-1).quit,0);assert.equal(rows.at(-1).kind,'quit-transition');
console.log(JSON.stringify({pass:true,scope:'exact observation primitives with synthetic explicit-quit/normal-timer/teardown/recreation/queue/input controls; no WASM or guest',events:rows.length}));
