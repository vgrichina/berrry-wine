'use strict';

// Public COM seek/Stop/Play on the page queue path. The sink acquires PCM
// on start and consumes all active sources, independently of reported cursors.
// Contract: https://learn.microsoft.com/en-us/previous-versions/windows/desktop/mt708935(v=vs.85)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {bootRenderHarness} = require('./render-helper');
const regions = require('../lib/region-map.generated');
const apis = require('../src/api_table.json');

class Node {
  connect(n) { this.connected = true; return n; }
  disconnect() { this.connected = false; }
}
class SinkContext {
  constructor() { this.currentTime = 4; this.state = 'running'; this.destination = new Node(); this.sources = []; }
  createGain() { const n = new Node(); n.gain = {value:1}; return n; }
  createStereoPanner() { const n = new Node(); n.pan = {value:0}; return n; }
  createBuffer(ch, length, sampleRate) {
    const data = Array.from({length:ch}, () => new Float32Array(length));
    return {numberOfChannels:ch, length, sampleRate, duration:length/sampleRate, getChannelData:i=>data[i]};
  }
  createBufferSource() {
    const n = new Node(); n.playbackRate = {value:1}; n.stopAt = Infinity;
    n.start = (at, offset=0) => {
      n.at = at; n.offset = offset;
      n.acquired = Array.from({length:n.buffer.numberOfChannels}, (_,i)=>n.buffer.getChannelData(i).slice());
      this.sources.push(n);
    };
    n.stop = (at=this.currentTime) => { n.stopAt = at; };
    return n;
  }
  consume(at, frames, rate) {
    const samples = [];
    for (let frame=0; frame<frames; frame++) {
      const t = at + (frame + 0.25)/rate;
      const active = [];
      for (const s of this.sources) {
        if (!s.connected || t<s.at || t>=s.stopAt) continue;
        let i = Math.floor(((t-s.at)*s.playbackRate.value+s.offset)*s.buffer.sampleRate);
        if (s.loop) i %= s.buffer.length;
        if (i<s.buffer.length) active.push(s.acquired.map(channel=>channel[i]));
      }
      samples.push(active);
    }
    return samples;
  }
}

(async () => {
  const saved = {AudioContext:globalThis.AudioContext, location:globalThis.location};
  globalThis.AudioContext = SinkContext;
  globalThis.location = {search:''}; // ordinary page default: short-ring queue
  try {
    const input = process.argv[2] ? fs.readFileSync(process.argv[2]) : require('./compile-src').compileSrcWasm();
    const bytes = input[0]===31 ? require('node:zlib').gunzipSync(input) : input;
    console.log('module SHA256='+crypto.createHash('sha256').update(bytes).digest('hex'));
    if (process.env.DS_SEEK_MODULE_OUT) fs.writeFileSync(process.env.DS_SEEK_MODULE_OUT,require('node:zlib').gzipSync(bytes));
    const {exports:e,memory,hostCtx:ctx} = await bootRenderHarness({fonts:'none',prebuiltModule:await WebAssembly.compile(bytes)});
    const pe = fs.readFileSync(require('node:path').join(__dirname,'binaries/calc.exe'));
    new Uint8Array(memory.buffer).set(pe,e.get_staging()); assert(e.load_pe(pe.length)); e.init_dx_com_thunks(); e.set_api_log(0);
    const alloc=n=>{const p=e.guest_alloc(n)>>>0;assert(p);return p;};
    const wr=(p,v)=>e.guest_write32(p,v>>>0), rd=p=>e.guest_read32(p)>>>0;
    const stack=alloc(8192)+4096;
    function invoke(args,obj,slot,target) {
      const code=[], word=v=>code.push(v&255,v>>>8&255,v>>>16&255,v>>>24);
      for (const a of args.slice().reverse()) {code.push(0x68);word(a);}
      if (obj) {assert(rd(rd(obj)+slot*4));code.push(0xb8);word(obj);code.push(0x8b,0,0xff,0x90);word(slot*4);}
      else {code.push(0xb8);word(target);code.push(0xff,0xd0);}
      const result=alloc(8);code.push(0xa3);word(result);code.push(0x89,0x25);word(result+4);code.push(0xc3);
      const pc=alloc(code.length);code.forEach((v,i)=>e.guest_write8(pc+i,v));
      e.set_esp(stack); e.call_func(pc,0,0,0,0);
      for (let i=0;i<100&&e.get_eip();i++) e.run(10000);
      assert.equal(e.get_eip(),0,'finite x86 return'); assert.equal(rd(result+4),stack-20,'stdcall cleanup');
      assert.equal(e.get_esp()>>>0,stack-16); return rd(result);
    }
    const com=(obj,slot,...args)=>{assert.equal(invoke([obj,...args],obj,slot),0,'COM slot '+slot);};
    const out=alloc(4), desc=alloc(20), fmt=alloc(20), cells=Array.from({length:4},()=>alloc(4));
    const dv=new DataView(memory.buffer), wa=regions.BASE.THUNK_BASE, old=dv.getUint32(wa+4,true);
    try {
      dv.setUint32(wa+4,apis.find(a=>a.name==='DirectSoundCreate').id,true);
      assert.equal(invoke([0,out,0],0,0,(wa-e.get_guest_base()+e.get_image_base())>>>0),0);
    } finally {dv.setUint32(wa+4,old,true);}
    const root=rd(out), failures=[];
    // Ordinary short-ring page queue, without AudioWorklet or recorder tap.
    // Whole-buffer initialization only; circular Unlock vectors live elsewhere.
    for (const [channels,bits] of [[1,8],[2,16]]) {
      const align=channels*bits/8, size=640*align;
      [1|(channels<<16),8000,8000*align,align|(bits<<16),0].forEach((v,i)=>wr(fmt+4*i,v));
      const packet=Array.from({length:640},(_,i)=>Array.from({length:channels},(_,c)=>
        bits===8 ? (32+i%160-128)/128 : (1000+i*31+c*997)/32768));
      for (const action of ['live-loop','live-one-shot','stop-seek-loop','stop-seek-one-shot']) {
        [20,0,size,0,fmt].forEach((v,i)=>wr(desc+4*i,v)); com(root,3,desc,out,0); const buf=rd(out);
        com(buf,11,0,size,...cells,0); const base=rd(cells[0]);
        for (let i=0;i<640;i++) for (let c=0;c<channels;c++) {
          const value=bits===8?32+i%160:1000+i*31+c*997;
          const p=base+i*align+c*bits/8;
          e.guest_write8(p,value&255); if(bits===16)e.guest_write8(p+1,value>>>8);
        }
        com(buf,19,...cells.map(rd)); com(buf,13,64*align); com(buf,12,0,0,1);
        // Queue two known spans: one currently playing, one still scheduled.
        for(const offset of [160,320]) {com(buf,11,offset*align,160*align,...cells,0);com(buf,19,...cells.map(rd));}
        const ac=ctx._voices._ac;
        ac.currentTime+=0.015;
        assert.deepEqual(ac.consume(ac.currentTime,8,8000),packet.slice(200,208).map(f=>[f]),'queue actually consumed before transition');
        if(action.startsWith('stop')) {
          com(buf,18);
          const silent=ac.consume(ac.currentTime,360,8000);
          if(silent.some(s=>s.length))failures.push({action,channels,bits,phase:'Stop silence',activeFrames:silent.filter(s=>s.length).length});
          com(buf,13,620*align); com(buf,12,0,0,action.endsWith('one-shot')?0:1);
        } else {
          if(action==='live-one-shot')com(buf,12,0,0,0);
          com(buf,13,620*align);
        }
        const wanted=Array.from({length:360},(_,i)=>action.endsWith('one-shot')&&i>=20?[]:[packet[(620+i)%640]]);
        const actual=ac.consume(ac.currentTime,360,8000);
        try{assert.deepEqual(actual,wanted);}catch{failures.push({action,channels,bits,phase:'seek PCM',firstMismatch:actual.findIndex((v,i)=>JSON.stringify(v)!==JSON.stringify(wanted[i])),actualFirst:actual.slice(0,3),wantedFirst:wanted.slice(0,3)});}
        console.log(JSON.stringify({action,channels,bits,frames:360,activeSourcesAtTransition:actual[0].length}));
        com(buf,18);com(buf,2);ac.currentTime+=0.100;
      }
    }
    com(root,2); assert.equal(Object.keys(ctx._voices._map).length,0);
    ctx.stopAudio();
    console.log(JSON.stringify({failures}));
    assert.equal(failures.length,0,'public seek consumes only selected PCM; Stop retires queued audio');
    console.log('PASS public COM queue seek/Stop/Play, 8 cases, 2880 post-seek frames');
  } finally {
    for (const [key,value] of Object.entries(saved)) {if (value===undefined) delete globalThis[key]; else globalThis[key]=value;}
  }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
