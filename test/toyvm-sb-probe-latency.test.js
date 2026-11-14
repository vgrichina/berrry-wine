'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const {Machine}=require('../tools/toyvm/dos');
const {runDos}=require('../tools/toyvm/run-dos');

function rig() {
  const m=new Machine(new Uint8Array(0x100000),{autoKey:false});
  let now=10000;
  m.audioNow=()=>now;
  m.mem.set([0,1,0,2],0x0f*4); // actual hooked IRQ7
  m.audio.dma.masked &= ~2;
  return {m,at:n=>{now=n;}};
}

test('one DMA sample takes its sample period, not the command instruction',()=>{
  const {m,at}=rig();m.sbRun(0x40,[100]);m.sbRun(0x14,[0,0]);
  assert.equal(m.sbIrq(),0,'no IRQ at DSP command completion');
  assert.equal(m.sb.left,1);
  // A coarse render covering time BEFORE the command cannot consume this probe.
  m.audioAdvance(.01,0,10000);assert.equal(m.sb.left,1);assert.equal(m.sbIrq(),0);
  const end=m.sbProbeDeadline(1e-7);
  assert.equal(end,10000+Math.ceil(1/m.sb.rate/1e-7));
  m.completeSbProbe(end-1,1e-7);assert.equal(m.sbIrq(),0);
  at(end);m.completeSbProbe(end,1e-7);
  assert.equal(m.sbIrq(),0x0f);assert.equal(m.sb.left,0);assert.equal(m.sb.pending,false);
  assert.equal(m.sbIrq(),0,'one transfer, one interrupt');
});

test('masked DMA cannot complete; its sample clock starts on unmask, including 16-bit channel',()=>{
  for(const wide of [false,true]) {
    const {m,at}=rig();m.audio.dma.masked=255;
    m.audio.dma.recent8=1;m.audio.dma.recent16=5;
    m.sbRun(wide?0xb0:0x14,wide?[0,0,0]:[0,0]);
    m.audioAdvance(1,0,1e7);assert.equal(m.sbIrq(),0);assert.equal(m.sb.left,1);
    at(200000);m.audio.dma.masked &= ~(1<<(wide?5:1));m.sbDmaWritten();
    assert.equal(m.sbIrq(),0,'unmask is not completion');
    assert.equal(m.sbProbeDeadline(1e-7),200000+Math.ceil(1/m.sb.rate/1e-7));
    m.completeSbProbe(300000,1e-7);assert.equal(m.sbIrq(),0x0f);
    assert.equal(m.sb.irqLatched,wide?2:1);
  }
});

test('pause/reset and replacement do not leave a stale probe IRQ',()=>{
  const {m,at}=rig();m.sbRun(0x14,[1,0]);m.sbRun(0xd0,[]);
  m.completeSbProbe(1e9,1e-7);assert.equal(m.sbIrq(),0);
  at(30000);m.sbRun(0xd4,[]);assert(m.sbProbeDeadline(1e-7)>30000);
  m.portOut(0x226,1,8);m.portOut(0x226,0,8);
  m.completeSbProbe(1e9,1e-7);assert.equal(m.sbIrq(),0);
  m.sbRun(0x14,[0,0]);m.sbRun(0x14,[255,15]);
  assert.equal(m.sbProbeDeadline(1e-7),Infinity);assert.equal(m.sbIrq(),0);
});

test('pause and DMA masking exclude precisely the stopped time from the deadline',()=>{
  const {m,at}=rig();m.sbRun(0x14,[9,0]);
  const end=m.sbProbeDeadline(1e-7);
  at(10100);m.sbRun(0xd0,[]);at(15100);m.sbRun(0xd4,[]);
  assert.equal(m.sbProbeDeadline(1e-7),end+5000);
  at(15200);m.audio.dma.masked|=2;m.sbDmaWritten();
  m.completeSbProbe(1e8,1e-7);assert.equal(m.sbIrq(),0);
  at(17200);m.audio.dma.masked&=~2;m.sbDmaWritten();
  assert.equal(m.sbProbeDeadline(1e-7),end+7000);
  m.completeSbProbe(end+6999,1e-7);assert.equal(m.sbIrq(),0);
  m.completeSbProbe(end+7000,1e-7);assert.equal(m.sbIrq(),15);
  m.audio.dma.masked=255;m.sbRun(0x14,[9,0]);
  m.portOut(0x226,1,8);m.portOut(0x226,0,8);
  m.audio.dma.masked&=~2;m.sbDmaWritten();m.completeSbProbe(1e9,1e-7);
  assert.equal(m.sbIrq(),0,'reset also cancels a still-masked probe');
});

test('explicit F2/F3 IRQ commands remain immediate and unrelated long transfers stay sampled',()=>{
  for(const cmd of [0xf2,0xf3]){const {m}=rig();m.sbRun(cmd,[]);assert.equal(m.sbIrq(),15);assert.equal(m.sbIrq(),0);}
  const {m}=rig();m.sbRun(0x14,[255,15]);assert.equal(m.sbIrq(),0);
  assert.equal(m.sbSecondsLeft(),4096/8000);m.audioAdvance(.6,0,6e6);assert.equal(m.sbIrq(),15);
});

// Generated COM uses the real DOS loader, CPU, port writes, interrupt frame and
// IRET. Its ISR runs early under the old host shortcut, then the guest's flag
// initialization loses the event. No guest memory is patched by this test.
function probeCom() {
  const b=[],labels={},fix=[];
  const emit=(...v)=>b.push(...v),label=n=>labels[n]=b.length+0x100;
  const addr=n=>{fix.push({at:b.length,n});emit(0,0);};
  emit(0x0e,0x1f,0xba);addr('isr');emit(0xb8,0x0f,0x25,0xcd,0x21);
  emit(0xb0,1,0xe6,0x0a,0xba,0x2c,2);
  for(const x of [0x40,100,0x14,0])emit(0xb0,x,0xee);
  emit(0xb0,0,0x0e,0xe8);const callAt=b.length;emit(0,0);
  emit(0xc6,0x06);addr('flag');emit(0,0xb9,0,0x40);
  label('loop');emit(0x80,0x3e);addr('flag');emit(0,0x75,9,0xe2,0xf7);
  emit(0xb8,1,0x4c,0xcd,0x21,0x90,0x90);emit(0xb8,0,0x4c,0xcd,0x21);
  label('isr');emit(0x50,0x2e,0xc6,0x06);addr('flag');emit(1,0xb0,0x20,0xe6,0x20,0x58,0xcf);
  label('flag');emit(0);
  label('send');emit(0xee,0xcb);
  const rel=labels.send-(callAt+0x102);b[callAt]=rel&255;b[callAt+1]=(rel>>8)&255;
  for(const f of fix){b[f.at]=labels[f.n]&255;b[f.at+1]=labels[f.n]>>8;}
  return Buffer.from(b);
}
test('actual generated guest observes completion after initializing its wait flag',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wine-sb-probe-'));
  try {
    const exe=path.join(dir,'probe.com');fs.writeFileSync(exe,probeCom());
    for(const opts of [{slice:10000},{slice:10000,noCache:true},{slice:5000,irqSchedule:false}]) {
      const r=await runDos({exe,budget:200000,seconds:5,autoKey:false,keys:[],...opts});
      assert.equal(r.machine.exited,true);assert.equal(r.machine.exitCode,0,JSON.stringify(opts));
      assert.equal(r.machine.sb.irqs,1);assert.equal(r.badSelector,null);assert.deepEqual([...r.unimplemented],[]);
    }
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
