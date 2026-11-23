#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const {bootRenderHarness} = require('./render-helper');
const {makeFixture, iat} = require('../tools/kernel32-native-fixture');
const {createHostImports} = require('../lib/host-imports');
const apiTable = require('../src/api_table.json');
// Independent byte oracle for the existing emulator policy. PCM stays
// contiguous. Only WAVEHDR fields and completion addresses are fragmented.
const extraWat = String.raw`
 (func (export "hp_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096) (local.get 1) (i32.const 4)))
 (func (export "hp_regs") (result i32) (global.get $reg_base))
`;
class AudioNode {connect(n){return n;} disconnect(){}}
class AC {
 constructor(){this.currentTime=20;this.state='running';this.sampleRate=8000;this.destination=new AudioNode();this.started=[];}
 createGain(){const n=new AudioNode();n.gain={value:1};return n;}
 createStereoPanner(){const n=new AudioNode();n.pan={value:0};return n;}
 createDynamicsCompressor(){return new AudioNode();}
 createBuffer(ch,n,rate){const rows=Array.from({length:ch},()=>new Float32Array(n));return {length:n,sampleRate:rate,duration:n/rate,getChannelData:i=>rows[i]};}
 createBufferSource(){const n=new AudioNode();n.playbackRate={value:1};n.start=()=>this.started.push(n);n.stop=()=>{};return n;}
 resume(){return Promise.resolve();}
}
async function run({expectParent=false,prebuiltModule=null}={}) {
 const oldAC=globalThis.AudioContext;globalThis.AudioContext=AC;
 try {
  const h=await bootRenderHarness({extraWat:prebuiltModule?'':extraWat,prebuiltModule,fonts:'none',width:8,height:8});
  const {exports:e,memory,hostCtx:ctx,host}=h,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
  const fixture=makeFixture();mem.set(fixture,e.get_staging());assert.ok(e.load_pe(fixture.length));e.set_api_log(0);
  const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
  const put=(p,b)=>b.forEach((x,i)=>mem[wa(p+i)]=x),text=s=>{const b=Buffer.from(s+'\0'),p=alloc(b.length);put(p,b);return p;};
  const stack=alloc(65536)+65520,regs=e.hp_regs()>>>0;
  const stats={calls:0,queries:0,comparisons:0,mappingFailures:0,controlFailures:0,submitFailures:0,doneFailures:0,examples:[]};
  function call(address,args){
   e.set_esp(stack);e.call_func(address,...Array.from({length:4},(_,i)=>args[i]||0));const sp=e.get_esp()>>>0;
   for(let i=4;i<args.length;i++)dv.setUint32(wa(sp+4*(i+1)),args[i]>>>0,true);
   const frame=Buffer.from(mem.subarray(wa(sp),wa(sp)+4*(args.length+1)));
   const seed=[0x12345678,0x23456789,0x3456789a,0,0x456789ab,0x56789abc,0x6789abcd];
   for(const i of[1,2,3,5,6,7])dv.setUint32(regs+4*i,seed[i-1],true);
   for(let n=0;n<1000&&e.get_eip();n++){e.run(100);assert.equal(e.get_yield_reason(),0);}
   assert.equal(e.get_eip(),0);assert.equal(e.get_esp()>>>0,sp+frame.length);
   for(const i of[1,2,3,5,6,7])assert.equal(dv.getUint32(regs+4*i,true),seed[i-1],'callee register '+i);
   assert.deepEqual(Buffer.from(mem.subarray(wa(sp),wa(sp)+frame.length)),frame);stats.calls++;return e.get_eax()>>>0;
  }
  const kernel=call(dv.getUint32(wa(iat('GetModuleHandleA')),true),[text('kernel32.dll')]);assert.ok(kernel);
  const winmm=call(dv.getUint32(wa(iat('LoadLibraryA')),true),[text('winmm.dll')]);assert.ok(winmm);
  const resolve=(mod,name)=>{const p=call(dv.getUint32(wa(iat('GetProcAddress')),true),[mod,text(name)]);assert.ok(p,name);return p;};
  const apis={};for(const name of['waveOutOpen','waveOutWrite','waveOutReset','waveOutClose','waveOutPause','waveOutRestart']){
   const p=resolve(winmm,name),row=apiTable.find(r=>r.name===name);assert.equal(e.guest_read32(p+4),row.id);apis[name]=p;
  }
  const api=(name,args)=>call(apis[name],args),va=resolve(kernel,'VirtualAlloc');
  const fragmented=0x30000000,adjacent=0x31000000,alias=0x32000000,reuse=0x33000000,decoys=[0x28000000,0x29000000];
  for(const p of[fragmented,decoys[0],fragmented+4096,decoys[1]])assert.equal(call(va,[p,4096,0x3000,4]),p);
  assert.equal(call(va,[adjacent,8192,0x3000,4]),adjacent);
  const first=wa(fragmented),second=wa(fragmented+4096),linear=alloc(8192),linearWA=wa(linear),contiguous=wa(adjacent);
  assert.equal(wa(decoys[0]),first+4096);assert.equal(wa(decoys[1]),second+4096);assert.notEqual(second,first+4096);assert.equal(wa(adjacent+4096),contiguous+4096);
  const pages=new Map([[fragmented,first],[fragmented+4096,second],[adjacent,contiguous],[adjacent+4096,contiguous+4096]]);
  const map=(g,w)=>{assert.equal(e.hp_alias(g,w),1);pages.set(g,w);assert.equal(wa(g),w);};map(alias,first);map(alias+4096,first);
  const spans=[[linearWA,8192],[first,4096],[second,4096],...decoys.map(p=>[wa(p),4096]),[contiguous,8192]];
  const views=spans.map(([p,n])=>Buffer.from(memory.buffer,p,n));
  function physical(p){if(p>=linear&&p<linear+8192)return linearWA+p-linear;const page=p-p%4096;assert.ok(pages.has(page));return pages.get(page)+p%4096;}
  function patch(buffers,p,bytes){bytes.forEach((x,j)=>{const at=physical(p+j),i=spans.findIndex(([b,n])=>at>=b&&at<b+n);assert.ok(i>=0);buffers[i][at-spans[i][0]]=x;});}
  const write=(p,b)=>b.forEach((x,i)=>mem[physical(p+i)]=x),word=x=>{const b=Buffer.alloc(4);b.writeUInt32LE(x>>>0);return b;};
  let stage='submit';function compare(a,b,label,mapping){stats.comparisons++;if(Buffer.isBuffer(a)?a.equals(b):JSON.stringify(a)===JSON.stringify(b))return;stats[mapping?'mappingFailures':'controlFailures']++;stats[stage+'Failures']++;if(stats.examples.length<20)stats.examples.push({label,actual:Buffer.isBuffer(a)?a.toString('hex').slice(0,100):a,expected:Buffer.isBuffer(b)?b.toString('hex').slice(0,100):b});}
  const fmt=alloc(32),out=alloc(8),data=alloc(32),other=alloc(32);
  put(fmt,Buffer.from('01000100401f0000401f0000010008000000','hex'));put(data,Buffer.from('0080ffc0','hex'));put(other,Buffer.from('ffffffff00000000','hex'));
  assert.equal(api('waveOutOpen',[out,0xffffffff,fmt,0x1234,0x87654321,0x10000]),0);const handle=e.guest_read32(out)>>>0;assert.ok(handle);
  const ac=ctx._voices._ac;ctx.audioClockMs=()=>ac.currentTime*1000;
  // Observe real production callbacks without replacing the audio imports.
  const posted=[];ctx.exports={...e,post_message_q:(...args)=>{posted.push(args.map(x=>x>>>0));return 1;}};
  const flags=[[0,0x10,1],[3,0x12,3],[0x89abcdef,0x89abcdfe,0x89abcdef],[0xffffffff,0xfffffffe,0xffffffef],[0x80000000,0x80000010,0x80000001]];
  function inspect(expected,label,mapping){for(let i=0;i<views.length;i++)compare(views[i],expected[i],label+' physical full span/guards '+i,mapping);}
  function query(p,v,label,mapping=false,mode='done',poison='data'){
   assert.equal(api('waveOutReset',[handle]),0);posted.length=0;
   spans.forEach(([b,n],i)=>mem.fill(0x91+i,b,b+n));
   const header=Buffer.from('000000000400000078563412efcdab8900000000badcfefa6745230110325476','hex');header.writeUInt32LE(data);header.writeUInt32LE(v[0]>>>0,16);
   // Valid alternative PCM pointer/short length make each bad field read
   // independently visible without unsafe or unbounded payload reads.
   const decoy=Buffer.from(header);if(poison==='data')decoy.writeUInt32LE(other);if(poison==='length')decoy.writeUInt32LE(8,4);if(poison==='flags')decoy.writeUInt32LE(0x76543210,16);
   for(const d of decoys)for(let i=0;i<32;i++)mem[wa(d)+((p+i)%4096)]=decoy[i];write(p,header);
   const expected=views.map(b=>Buffer.from(b));patch(expected,p+16,word(v[1]));
   stage='submit';const before=ctx._voices._map[handle].bytesWritten;
   compare(api('waveOutWrite',[handle,p,32]),0,label+' return',mapping);stats.queries++;
   compare(ctx._voices._map[handle].bytesWritten-before,4,label+' submitted literal length',mapping);
   const buffer=ac.started.at(-1)?.buffer;
   compare(buffer?Array.from(buffer.getChannelData(0)):null,[-1,0,127/128,0.5],label+' literal PCM',mapping);
   inspect(expected,label+' submit',mapping);compare(posted,[],label+' async callback',mapping);
   compare(ctx.waveScheduledHeaders.get(handle)?.size,1,label+' tracked once',mapping);
   stage='done';
   if(mode==='reset')compare(api('waveOutReset',[handle]),0,label+' reset return',mapping);
   else {ac.currentTime+=1;ctx.pumpAudioCompletions();}
   patch(expected,p+16,word(v[2]));inspect(expected,label+' done',mapping);
   compare(posted,[[0x1234,0x3bd,handle,p>>>0]],label+' callback identity',mapping);
   compare(ctx.waveScheduledHeaders.has(handle),false,label+' retired submission',mapping);
   compare(e.guest_span_cursor_bytes(),0,label+' no transient retained',mapping);compare(e.guest_span_overflow_count(),0,label+' no span overflow',mapping);
  }
  for(const v of flags)for(const mode of['done','reset'])query(linear+64,v,'direct '+[v,mode],false,mode);
  // Every phase covers every byte cut in lpData, length and flags, gaps,
  // nonadjacent backing and physical aliasing. Independent poison sweeps.
  for(let phase=0;phase<4096;phase++)for(const base of[adjacent,fragmented,alias])query(base+phase,flags[phase%flags.length],'phase '+[base,phase],base!==adjacent,phase&1?'done':'reset',['data','length','flags'][phase%3]);
  for(const field of['data','length','flags'])for(let cut=1;cut<32;cut++)for(const v of flags)for(const mode of['done','reset'])query(fragmented+4096-cut,v,'cut '+[field,cut,v,mode],true,mode,field);
  for(let gen=0;gen<4;gen++){map(reuse,gen&1?second:first);map(reuse+4096,gen&1?first:second);for(let cut=1;cut<32;cut++)query(reuse+4096-cut,flags[gen],'reuse '+[gen,cut],true);}
  // Candidate-only lifecycle cases depend on successful mapped submission;
  // parent failure evidence above is collected without replaying any lane.
  if(!expectParent){
   // Also deliver through the actual exported post_message_q and inspect
   // the production canonical FIFO, including a live HWND owner.
   const observedExports=ctx.exports;ctx.exports=e;e.test_wnd_table_set(0x1234,0xffff0001);
   for(const cut of[1,2,3])for(const mode of['done','reset']){
    assert.equal(api('waveOutReset',[handle]),0);e.set_post_queue_count(0);
    const p=fragmented+4096-16-cut;write(p,Buffer.alloc(32));write(p,word(data));write(p+4,word(4));write(p+16,word(3));
    assert.equal(api('waveOutWrite',[handle,p,32]),0);assert.equal(e.get_post_queue_count(),0);
    if(mode==='reset')assert.equal(api('waveOutReset',[handle]),0);else{ac.currentTime+=1;ctx.pumpAudioCompletions();}
    assert.equal(e.get_post_queue_count(),1);assert.deepEqual([0,1,2,3].map(i=>e.post_queue_peek(0,i)>>>0),[0x1234,0x3bd,handle,p]);
   }
   e.set_post_queue_count(0);ctx.exports=observedExports;
   // Isolate completion from the WAT submission stores: prime the literal
   // queued flags ourselves, then call the actual host ABI. Sweep every
   // flags byte cut through each supported production context route.
   const normalExports=ctx.exports;
   for(const route of['exports','instance','renderer','translate']){
    ctx.exports=route==='exports'?normalExports:null;ctx.instance=route==='instance'?{exports:e}:null;
    if(route==='translate'){
     const g2w=require('../lib/mem-utils').g2w,imageBase=e.get_image_base()>>>0;
     ctx.g2w=p=>g2w(p,imageBase,memory.buffer);
     ctx.exports=new Proxy({}, {get(_t,k){if(k==='post_message_q')return normalExports.post_message_q;throw Error('memory access through RPC proxy '+String(k));}});
    }
    for(const cut of[0,1,2,3,4])for(const v of flags)for(const mode of['done','reset']){
     assert.equal(api('waveOutReset',[handle]),0);posted.length=0;
     const p=fragmented+4096-16-cut;spans.forEach(([b,n],i)=>mem.fill(0x91+i,b,b+n));write(p+16,word(v[1]));const expected=views.map(b=>Buffer.from(b));patch(expected,p+16,word(v[2]));
     host.wave_out_write(handle,wa(data),4);host.wave_out_schedule_done(handle,wa(p),p,4);
     if(mode==='reset')assert.equal(api('waveOutReset',[handle]),0);else{ac.currentTime+=1;ctx.pumpAudioCompletions();}
     inspect(expected,'isolated '+[route,cut,v,mode],true);
     // instance/renderer callbacks go through the renderer's actual queue;
     // exports/translate are observed at the host post_message_q boundary.
     if(route==='exports'||route==='translate')assert.deepEqual(posted,[[0x1234,0x3bd,handle,p]]);
    }
    ctx.exports=normalExports;ctx.instance=null;delete ctx.g2w;
   }
   const p=fragmented+4078;
   assert.equal(api('waveOutReset',[handle]),0);posted.length=0;write(p,Buffer.alloc(32));write(p,word(data));write(p+4,word(4));write(p+16,word(3));
   assert.equal(api('waveOutWrite',[handle,p,32]),0);
   // Remap both pages after submit. Completion must read the current guest
   // flags, not a saved physical flag address or transient gather buffer.
   map(fragmented,second);map(fragmented+4096,first);write(p+16,word(0x80000012));
   const expected=views.map(b=>Buffer.from(b));patch(expected,p+16,word(0x80000003));ac.currentTime+=1;ctx.pumpAudioCompletions();inspect(expected,'inflight remap',true);assert.deepEqual(posted,[[0x1234,0x3bd,handle,p]]);
   map(fragmented,first);map(fragmented+4096,second);
   // Two guest headers whose bases alias must remain separate queue entries.
   const a=alias+4088,b=fragmented+4088;posted.length=0;
   for(const p of[a,b]){write(p,Buffer.alloc(32));write(p,word(data));write(p+4,word(4));write(p+16,word(3));assert.equal(api('waveOutWrite',[handle,p,32]),0);}
   assert.equal(ctx.waveScheduledHeaders.get(handle).size,2);assert.equal(api('waveOutReset',[handle]),0);assert.deepEqual(posted,[[0x1234,0x3bd,handle,a],[0x1234,0x3bd,handle,b]]);
   // Natural clock completion preserves queue order; pause freezes it.
   posted.length=0;
   for(const p of[a,b]){write(p+16,word(3));assert.equal(api('waveOutWrite',[handle,p,0]),0);}
   assert.equal(api('waveOutPause',[handle]),0);ac.currentTime+=1;ctx.pumpAudioCompletions();assert.deepEqual(posted,[]);
   assert.equal(api('waveOutRestart',[handle]),0);ac.currentTime+=0.0006;ctx.pumpAudioCompletions();assert.deepEqual(posted,[[0x1234,0x3bd,handle,a]]);
   ac.currentTime+=0.0006;ctx.pumpAudioCompletions();assert.deepEqual(posted,[[0x1234,0x3bd,handle,a],[0x1234,0x3bd,handle,b]]);
   // Reset through a separate host context still uses the submitting memory
   // authority, even when the pumping context has unusable exports.
   posted.length=0;write(a+16,word(3));assert.equal(api('waveOutWrite',[handle,a,32]),0);
   ctx.voices=ctx._voices;
   const sibling={getMemory:()=>memory.buffer,sharedAudio:ctx,exports:{post_message_q:normalExports.post_message_q}};
   const siblingHost=createHostImports(sibling).host;assert.equal(sibling._voices,ctx._voices);
   assert.equal(siblingHost.wave_out_reset(handle),0);assert.deepEqual(posted,[[0x1234,0x3bd,handle,a]]);
   // Reuse has a fresh serial: a late first completion cannot finish the
   // second submission early. Closing retires the registration and queue.
   posted.length=0;for(let i=0;i<2;i++){write(a+16,word(3));assert.equal(api('waveOutWrite',[handle,a,32]),0);}
   ac.currentTime+=0.0006;ctx.pumpAudioCompletions();assert.deepEqual(posted,[]);assert.equal(ctx.waveScheduledHeaders.get(handle).size,1);
   ac.currentTime+=0.0006;ctx.pumpAudioCompletions();assert.deepEqual(posted,[[0x1234,0x3bd,handle,a]]);
  }
  // Existing NULL data / zero length no-submit policy, including cbWaveHdr.
  for(const [ptr,len]of[[0,4],[data,0],[0,0]])for(const size of[0,1,32,0xffffffff]){
   assert.equal(api('waveOutReset',[handle]),0);posted.length=0;const p=linear+64;
   const header=Buffer.alloc(32,0x5a);header.writeUInt32LE(ptr);header.writeUInt32LE(len,4);header.writeUInt32LE(3,16);write(p,header);const before=Buffer.from(views[0]);
   assert.equal(api('waveOutWrite',[handle,p,size]),0);assert.deepEqual(views[0],before);assert.equal(ctx.waveScheduledHeaders.has(handle),false);assert.deepEqual(posted,[]);
  }
  assert.equal(api('waveOutReset',[handle+1000]),5);assert.equal(api('waveOutClose',[handle+1000]),5);
  // Close while a header is live must suppress DONE, retain its bytes and
  // retire queued callback registration rather than completing it.
  posted.length=0;const closeHdr=linear+64;write(closeHdr,Buffer.alloc(32));write(closeHdr,word(data));write(closeHdr+4,word(4));write(closeHdr+16,word(3));assert.equal(api('waveOutWrite',[handle,closeHdr,32]),0);
  const closeBefore=Buffer.from(views[0]),registration=ctx.waveRegistrations.get(handle);
  assert.equal(api('waveOutClose',[handle]),0);assert.equal(registration.retired,true);assert.equal(ctx.waveRegistrations.has(handle),false);assert.equal(ctx.waveScheduledHeaders.has(handle),false);ac.currentTime+=10;ctx.pumpAudioCompletions();assert.deepEqual(views[0],closeBefore);assert.deepEqual(posted,[]);
  standalone();console.log(JSON.stringify(stats));assert.equal(stats.controlFailures,0,'direct controls/ABI');
  if(expectParent){assert.ok(stats.submitFailures>0);assert.ok(stats.doneFailures>0);assert.ok(stats.mappingFailures>0);}else assert.equal(stats.mappingFailures,0,'mapped pipeline');return stats;
 } finally {if(oldAC===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=oldAC;}
}
function standalone(){
 // Legacy direct callers pass physical WAVEHDRs, with either 3 or 4 args;
 // no guest access exports exist in these production host contexts.
 for(const legacy of[false,true]){
  const memory=new ArrayBuffer(512*1024),dv=new DataView(memory),posted=[];
  const ctx={getMemory:()=>memory,exports:{post_message_q:(...a)=>posted.push(a)},audioClockMs:()=>0};
  const host=createHostImports(ctx).host,h=host.wave_out_open(8000,1,8,1,0x1234,0);
  dv.setUint32(0x2010,0x80000012,true);host.wave_out_write(h,0x1000,4);
  if(legacy)host.wave_out_schedule_done(h,0x2000,4);else host.wave_out_schedule_done(h,0x2000,0x403000,4);
  assert.equal(dv.getUint32(0x2010,true),0x80000012);assert.equal(host.wave_out_reset(h),0);assert.equal(dv.getUint32(0x2010,true),0x80000003);
  assert.deepEqual(posted,[[0x1234,0x3bd,h,legacy?0:0x403000]]);assert.equal(host.wave_out_close(h),0);
 }
}
module.exports={run,extraWat};
if(require.main===module)run({expectParent:process.argv.includes('--expect-parent')}).catch(e=>{console.error(e);process.exitCode=1;});
