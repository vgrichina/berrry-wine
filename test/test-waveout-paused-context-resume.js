#!/usr/bin/env node
'use strict';
// Exercise WinMM thunks, the real gesture unlock and scheduled PCM consumption.
// AudioContext suspension is independent of a guest's waveOutPause ownership.
const assert = require('node:assert/strict');
const {bootRenderHarness} = require('./render-helper');
const {makeFixture, iat} = require('../tools/kernel32-native-fixture');

class AudioNode {
  connect(n) { return n; }
  disconnect() {}
}
class ConsumingContext {
  constructor() {
    this.currentTime = 8;
    this.state = 'running';
    this.destination = new AudioNode();
    this.started = [];
    this.consumed = [];
  }
  createGain() { const n = new AudioNode(); n.gain = {value:1}; return n; }
  createStereoPanner() { const n = new AudioNode(); n.pan = {value:0}; return n; }
  createDynamicsCompressor() { return new AudioNode(); }
  createBuffer(ch, length, sampleRate) {
    const data = Array.from({length:ch}, () => new Float32Array(length));
    return {length, sampleRate, duration:length/sampleRate, getChannelData:i=>data[i]};
  }
  createBufferSource() {
    const n = new AudioNode(); n.playbackRate = {value:1};
    n.start = (at, offset=0) => { n.at=at; n.offset=offset; this.started.push(n); };
    n.stop = () => { n.stopped=true; }; // onended may arrive late, separately
    return n;
  }
  suspend() { this.state='suspended'; return Promise.resolve(); }
  resume() { this.state='running'; return Promise.resolve(); }
  consume(frames) {
    if (this.state !== 'running') return;
    // An independent sink reads the sources actually scheduled, not getPos().
    for (let i=0; i<frames; i++) {
      const t=this.currentTime+i/8192;
      for (const s of this.started) {
        if (s.stopped || t<s.at) continue;
        const index=Math.floor(((t-s.at)*s.playbackRate.value+s.offset)*s.buffer.sampleRate);
        if (index<s.buffer.length) this.consumed.push(s.buffer.getChannelData(0)[index]);
      }
    }
    this.currentTime+=frames/8192;
  }
}

async function run() {
  const saved={AudioContext:globalThis.AudioContext, window:globalThis.window,
    setTimeout:globalThis.setTimeout, clearTimeout:globalThis.clearTimeout};
  const listeners=new Map(), timers=new Map(); let nextTimer=1;
  globalThis.AudioContext=ConsumingContext;
  globalThis.window={
    addEventListener:(name, fn)=>listeners.set(name, fn),
    removeEventListener:(name, fn)=>{ if (listeners.get(name)===fn) listeners.delete(name); },
  };
  try {
    const {exports:e, memory, hostCtx:ctx}=await bootRenderHarness({fonts:'none', width:8, height:8});
    globalThis.setTimeout=fn=>{ const id=nextTimer++; timers.set(id,fn); return id; };
    globalThis.clearTimeout=id=>timers.delete(id);
    const mem=new Uint8Array(memory.buffer), dv=new DataView(memory.buffer);
    const fixture=makeFixture(); mem.set(fixture,e.get_staging()); assert.ok(e.load_pe(fixture.length)); e.set_api_log(0);
    const wa=p=>e.guest_to_wasm(p)>>>0;
    const alloc=n=>{ const p=e.guest_alloc(n)>>>0; assert.ok(p); return p; };
    const text=s=>{ const b=Buffer.from(s+'\0'), p=alloc(b.length); mem.set(b,wa(p)); return p; };
    const stack=alloc(65536)+65520;
    function call(p,args) {
      e.set_esp(stack); e.call_func(p,...Array.from({length:4},(_,i)=>args[i]||0));
      const sp=e.get_esp()>>>0;
      for (let i=4;i<args.length;i++) dv.setUint32(wa(sp+4*(i+1)),args[i]>>>0,true);
      for (let n=0;n<1000&&e.get_eip();n++) { e.run(100); assert.equal(e.get_yield_reason(),0); }
      assert.equal(e.get_eip(),0); assert.equal(e.get_esp()>>>0,sp+4*(args.length+1));
      return e.get_eax()>>>0;
    }
    const winmm=call(dv.getUint32(wa(iat('LoadLibraryA')),true),[text('winmm.dll')]);
    const apis={};
    for (const name of ['waveOutOpen','waveOutPrepareHeader','waveOutWrite','waveOutPause',
      'waveOutRestart','waveOutReset','waveOutGetPosition','waveOutClose']) {
      apis[name]=call(dv.getUint32(wa(iat('GetProcAddress')),true),[winmm,text(name)]);
      assert.ok(apis[name],name);
    }
    const api=(name,args)=>{ assert.equal(call(apis[name],args),0,name); };
    const fmt=alloc(32), out=alloc(8), info=alloc(16), pcm=alloc(768);
    mem.set(Buffer.from('010001000020000000200000010008000000','hex'),wa(fmt));
    for (let i=0;i<768;i++) mem[wa(pcm)+i]=64+Math.floor(i/256)*64+(i%64);
    const headers=[alloc(32),alloc(32),alloc(32)];
    e.test_wnd_table_set(0x1234,0xffff0001);
    const messages=()=>Array.from({length:e.get_post_queue_count()},(_,i)=>
      [0,1,2,3].map(j=>e.post_queue_peek(i,j)>>>0));
    const pump=()=>{
      const pending=Array.from(timers.entries()); timers.clear();
      for (const [,fn] of pending) fn();
      ctx.pumpAudioCompletions();
    };
    const observations=[];
    for (const played of [64,0]) {
      api('waveOutOpen',[out,0xffffffff,fmt,0x1234,0x76543210,0x10000]);
      const handle=e.guest_read32(out)>>>0, ac=ctx._voices._ac;
      ctx.audioClockMs=()=>ac.currentTime*1000;
      const position=()=>{ api('waveOutGetPosition',[handle,info,12]); return e.guest_read32(info+4)>>>0; };
      function submit(i) {
        const p=headers[i]; mem.fill(0,wa(p),wa(p)+32);
        dv.setUint32(wa(p),pcm+i*256,true); dv.setUint32(wa(p)+4,256,true);
        api('waveOutPrepareHeader',[handle,p,32]); api('waveOutWrite',[handle,p,32]);
      }
      e.set_post_queue_count(0); ac.consumed.length=0;
      submit(0); submit(1); ac.consume(played);
      assert.equal(position(),played);
      api('waveOutPause',[handle]); submit(2);
      const oldSources=ac.started.slice();
      assert.equal(position(),played);
      await ac.suspend();
      // This is the registered production unlock handler, not a private resync call.
      listeners.get('pointerdown')(); await Promise.resolve();
      ac.consume(256); pump();
      assert.equal(position(),played); assert.deepEqual(messages(),[]);
      api('waveOutPause',[handle]); api('waveOutRestart',[handle]);
      assert.equal(position(),played);
      ac.consume(256-played); pump();
      const expected=Array.from(mem.subarray(wa(pcm),wa(pcm)+256),x=>(x-128)/128);
      assert.deepEqual(ac.consumed,expected,'resumed PCM must include the retained partial header tail');
      assert.equal(position(),256);
      assert.deepEqual(messages(),[[0x1234,0x3bd,handle,headers[0]]]);
      // Late source retirement cannot remove the resumed source or repeat DONE.
      for (const s of oldSources) if (s.onended) s.onended();
      ac.consume(128); api('waveOutPause',[handle]);
      assert.equal(position(),384);
      assert.deepEqual(ac.consumed,
        Array.from(mem.subarray(wa(pcm),wa(pcm)+384),x=>(x-128)/128),
        'consumption reaches the next queued header without replaying the old one');
      const consumedBeforeReset=ac.consumed.length;
      api('waveOutReset',[handle]);
      assert.equal(position(),0);
      assert.deepEqual(messages(),headers.map(p=>[0x1234,0x3bd,handle,p]));
      for (const p of headers) assert.equal(e.guest_read32(p+16),3);
      ac.consume(1024); pump(); assert.equal(ac.consumed.length,consumedBeforeReset);
      assert.equal(messages().length,3);
      // Reuse the same header after Reset; old completions must not finish it.
      e.set_post_queue_count(0); submit(0); pump(); assert.deepEqual(messages(),[]);
      ac.consume(128); pump(); assert.deepEqual(messages(),[]);
      ac.consume(128); pump(); assert.deepEqual(messages(),[[0x1234,0x3bd,handle,headers[0]]]);
      submit(1); const registration=ctx.waveRegistrations.get(handle);
      const staleTimers=Array.from(timers.values());
      api('waveOutClose',[handle]); assert.equal(registration.retired,true);
      assert.equal(ctx.waveRegistrations.has(handle),false);
      assert.deepEqual(messages(),[[0x1234,0x3bd,handle,headers[0]],[0x1234,0x3bc,handle,0]]);
      const afterClose=messages();
      ac.consume(1024); for (const fn of staleTimers) fn(); pump();
      assert.deepEqual(messages(),afterClose); assert.equal(ctx.waveScheduledHeaders.has(handle),false);
      assert.equal(timers.size,0);
      observations.push({pausedAt:played,firstHeaderPcmSamples:expected.length,resetPosition:0,retired:true});
    }
    console.log(JSON.stringify({passed:true,observations}));
  } finally {
    Object.assign(globalThis,saved);
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
