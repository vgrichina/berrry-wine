'use strict';

// Public x86 COM calls, then an independent sink consumes acquired Web Audio
// samples. The expected stream comes from the caller's packets, never from
// the returned regions, host queue descriptors, or the reported play cursor.
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
    if (process.env.DS_CIRC_MODULE_OUT) fs.writeFileSync(process.env.DS_CIRC_MODULE_OUT,require('node:zlib').gzipSync(bytes));
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
    for (const sparse of [false,true]) {
      if (sparse) {
        let p;
        for (const [count,size] of [[2048,65536],[300000,256],[300000,8]]) {
          for (let i=0;i<count;i++) {p=alloc(size);if ((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE) break;}
        }
        assert((e.guest_to_wasm(p)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE,'small heap exhausted');
      }
    for (const [channels,bits] of [[1,8],[2,16]]) {
      const align=channels*bits/8, size=640*align;
      [1|(channels<<16),8000,8000*align,align|(bits<<16),0].forEach((v,i)=>wr(fmt+4*i,v));
      [20,0,size,0,fmt].forEach((v,i)=>wr(desc+4*i,v)); com(root,3,desc,out,0); const buf=rd(out);
      const lock=(offset,count)=>{com(buf,11,offset,count,...cells,0);return cells.map(rd);};
      const unlock=parts=>com(buf,19,...parts);
      let parts=lock(0,size), base=parts[0];
      assert.equal((e.guest_to_wasm(base)>>>0)>=regions.BASE.VIRTUAL_BACKING_BASE,sparse,'actual direct/sparse PCM ring');
      for (let i=0;i<size;i++) e.guest_write8(base+i,bits===8?128:0);
      unlock(parts); com(buf,13,600*align); com(buf,12,0,0,1);
      // A zero-sized refresh initializes the legacy queue without new PCM.
      if (bits===8) unlock(lock(0,0)); // stereo also tests the first real refresh
      const expected=[];
      for (const [offset,kind] of [[628,0],[12,1],[36,1]]) {
        const packet=[];
        for (let i=0;i<24;i++) {
          const frame=[];
          for (let c=0;c<channels;c++) frame.push(kind ? 0 : (bits===8 ? (33+i-128)/128 : (1000+i*101+c*997)/32768));
          expected.push([frame]);
          if (bits===8) packet.push(33+i);
          else for (let c=0;c<channels;c++) {const value=kind?0:1000+i*101+c*997;packet.push(value&255,value>>>8);}
        }
        // The repeated zero packets are real writes despite unchanged bytes.
        if (kind && bits===8) packet.fill(128);
        parts=lock(offset*align,24*align);
        const literal=[base+offset*align,Math.min(24,640-offset)*align,offset+24>640?base:0,Math.max(0,offset+24-640)*align];
        assert.deepEqual(parts,literal,'exact returned tail/head regions');
        let cursor=0;
        for (const k of [0,2]) for (let j=0;j<parts[k+1];j++) e.guest_write8(parts[k]+j,packet[cursor++]);
        assert.equal(cursor,packet.length); unlock(parts);
      }
      const ac=ctx._voices._ac;
      const actual=ac.consume(ac.currentTime+0.010,80,8000);
      const wanted=expected.concat(Array.from({length:8},()=>[]));
      try {assert.deepEqual(actual,wanted,'exact caller packets, once each, no stale padding or missing identical writes');}
      catch {failures.push({sparse,channels,bits,actual,wanted});}
      console.log(JSON.stringify({sparse,channels,bits,regions:'tail 12 frames + head 12 frames',expectedFrames:72,actualFrames:actual.filter(x=>x.length).length,sources:ac.sources.filter(s=>s.connected&&s.at>=ac.currentTime).map(s=>({length:s.buffer.length,start:s.at,offset:s.offset}))}));
      ac.currentTime += 0.050; // the next format never rewinds this device clock
      com(buf,18); com(buf,2);
    }
    }
    com(root,2); assert.equal(Object.keys(ctx._voices._map).length,0);
    if (failures.length) console.log(JSON.stringify({failures}));
    assert.equal(failures.length,0,'public circular PCM consumption');
    console.log('PASS public COM exact wrap regions and 288 consumed direct/sparse mono/stereo frames, including unchanged writes');
  } finally {
    for (const [key,value] of Object.entries(saved)) {if (value===undefined) delete globalThis[key]; else globalThis[key]=value;}
  }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
