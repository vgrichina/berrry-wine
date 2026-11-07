'use strict';
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const root=require('path').resolve(__dirname,'..');
const {createHostImports}=require(root+'/lib/host-imports');
const {processSharedCtx}=require(root+'/lib/worker-imports');
const memory=new ArrayBuffer(65536);let ticks=0;
const ctx={getMemory:()=>memory,pitNowMs:()=>ticks ? (ticks+0.25)*1000/1193182 : 0,wallNowMs:()=>0,guestNowMs:()=>0};
const main=createHostImports(ctx).host;
const workerCtx={...processSharedCtx(ctx),getMemory:()=>memory},worker=createHostImports(workerCtx).host;
const w=(p,v,h=main)=>h.pit_io(p,v,1,1),r=(p,h=main)=>h.pit_io(p,0,0,1),count=(p=0x42,h=main)=>r(p,h)|r(p,h)<<8;
const time=t=>{ticks=t;};
// Mode2 count transfer is on the next clock, not on the write; gate-low
// inhibits decrement but does not inhibit initial loading.
w(0x61,0);w(0x43,0xb4);w(0x42,0x34);w(0x43,0xe8);
assert.equal(r(0x42)&0x40,0x40,'partial write remains null');
w(0x42,0x12);w(0x43,0xe8);assert.equal(r(0x42)&64,64,'CR is not CE until a clock');
time(1);assert.equal(count(),0x1234);
w(0x43,0xe8);assert.equal(r(0x42),0xb4,'loaded mode2 status with gate-low OUT high');
time(200);assert.equal(count(),0x1234,'gate-low freezes the counting element');
w(0x61,3);time(201);assert.equal(count(),0x1234,'rising gate reloads on next clock');
time(205);w(0x61,2);assert.equal(count(),0x1230,'falling gate retains elapsed count');
time(400);assert.equal(count(),0x1230,'reads and elapsed time cannot decrement with gate low');
for(let i=0;i<100;i++)assert.equal(count(),0x1230,'poll count is not time');
// Latch retains FIRST sample until both bytes consumed; status reads have
// priority without consuming count bytes. Other contexts share both phases.
w(0x61,1);time(401);time(405);w(0x43,0x80);
const low=r(0x42);assert.equal(low,0x30);time(410);w(0x43,0x80);w(0x43,0xe8);
assert.equal(r(0x42,worker)&63,0x34);assert.equal(r(0x42,worker),0x12,'re-latch and status leave first high byte intact');
assert.equal(count(),0x122b,'latch releases after both bytes');
// Interleaved read/write phases must stay independent; deferred reload does
// not change current CE until the period boundary or a gate trigger.
w(0x43,0x80);const savedLow=r(0x42);w(0x42,0x78,worker);w(0x43,0xe8);assert.equal(r(0x42)&64,0,'first write byte cannot set NULL COUNT');assert.equal(r(0x42),0x12);w(0x42,0x56);
assert.equal(savedLow,0x2b);assert.equal(count(),0x122b);w(0x61,0);w(0x61,1);time(411);assert.equal(count(),0x5678);
// Counter isolation, access formats, aliases and programmed zero=65536.
w(0x43,0x54);w(0x41,7);w(0x43,0xa4);w(0x42,2);time(412);assert.equal(r(0x41),7);assert.equal(r(0x42),2);
w(0x43,0xbc);w(0x42,0);w(0x42,0);time(413);assert.equal(count(),0);time(414);assert.equal(count(),65535);
// Mode2 output pulse, deferred pending reload and gate cancellation.
w(0x43,0x94);w(0x42,4);time(415);assert.equal(r(0x61)&32,32);time(418);assert.equal(r(0x42),1);assert.equal(r(0x61)&32,0);
w(0x42,6);assert.equal(r(0x42),1);w(0x43,0xe8);time(419);w(0x43,0xe8);assert.equal(r(0x42)&64,64,'first status latch persists across pending-count transfer');assert.equal(r(0x42),6);w(0x43,0xe8);assert.equal(r(0x42)&64,0);assert.equal(r(0x61)&32,32);
time(424);assert.equal(r(0x61)&32,0);w(0x61,0xfe);assert.equal(r(0x61),46,'high status bits are read-only and gate-low forces OUT high');
// Independent latch state on multiple channels via read-back; status-first.
w(0x43,0xd6);const c0=count(0x40),c1=r(0x41);assert.equal(r(0x42),1);assert.equal(c0,(-424)&65535);assert.equal(c1,7-((424-412)%7));
// Unsupported modes, BCD, widths fail loudly before accepting a fake result.
for(const control of [0xb0,0xb2,0xb6,0xb8,0xba,0xb5])assert.throws(()=>w(0x43,control),/only binary mode 2/);
for(const width of [2,4])assert.throws(()=>main.pit_io(0x42,0,0,width),/only byte/);
assert.throws(()=>createHostImports({getMemory:()=>memory,pitNowMs:()=>NaN}),/non-finite/);assert.throws(()=>w(0x43,0xc1),/reserved/);
w(0x43,0x94);assert.throws(()=>w(0x42,1),/illegal/);
// New machine and repeated import construction; calendar and guest clocks
// must never influence the monotonic device. Backwards inputs cannot rewind.
assert.strictEqual(ctx.pitTimer,workerCtx.pitTimer);
const otherCtx={getMemory:()=>memory,pitNowMs:()=>ticks ? (ticks+0.25)*1000/1193182 : 0};
const other=createHostImports(otherCtx).host;
assert.equal(r(0x61,other)&1,0);assert.notStrictEqual(otherCtx.pitTimer,ctx.pitTimer);
const same=createHostImports(ctx).host;assert.equal(r(0x61,same),46);
// Actual synchronous RPC path preserves count-write ordering/state.
const RPC=require(root+'/lib/guest-rpc'),sigs={pit_io:require(root+'/lib/host-import-sigs.generated.json').sigs.pit_io};
assert.deepEqual(sigs.pit_io,{params:['i32','i32','i32','i32'],results:['i32']});
const m={buffer:new SharedArrayBuffer(8192*65536)},broker=RPC.createMainBroker(m,main,sigs);
const rpc=RPC.createWorkerImports(m,sigs,msg=>broker.serveRpc(msg.slot),{slot:3});
w(0x43,0xb4);w(0x42,0x66,rpc.imports.host);w(0x42,0x55);time(425);assert.equal(count(),0x5566);
ctx.wallNowMs=()=>1e15;ctx.guestNowMs=()=>1e15;ctx.calendarClock.offsetMs=1e15;assert.equal(count(),0x5566,'calendar and guest clocks cannot change PIT');
w(0x61,1);time(426);assert.equal(count(),0x5566);time(430);assert.equal(count(),0x5562);time(427);assert.equal(count(),0x5562,'backward input cannot rewind CE');time(450);assert.equal(count(),0x554e);
assert.equal(rpc.stats.sync,1);assert.equal(rpc.stats.local,0);assert.equal(rpc.stats.async,0);
// Production browser adapter shares the device and the injected clock.
const browser={createHostImports,console,performance};vm.runInNewContext(fs.readFileSync(root+'/host.js','utf8')+'\n;globalThis.Host=WineAssembly;',browser);
const wine=new browser.Host();wine.memory={buffer:memory};
const bmain=wine.getImports({pitNowMs:()=>ticks ? (ticks+0.25)*1000/1193182 : 0}).host;
const bworker=wine.getImports({...processSharedCtx(wine.hostCtx),detached:true}).host;
w(0x43,0xb4,bmain);w(0x42,0x88,bworker);w(0x42,0x77,bmain);time(500);assert.equal(count(0x42,bworker),0x7788);
console.log('PASS PIT mode2 clock/load/gate/output, latch/readback/access phases, counter/machine/worker isolation, synchronous RPC and browser adapter');
