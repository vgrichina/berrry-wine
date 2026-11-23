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
  const apis={};for(const name of['waveInOpen','waveInAddBuffer','waveInReset','waveInClose','waveInStart','waveInStop']){
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
  put(fmt,Buffer.from('01000100401f0000401f0000010008000000','hex'));
  assert.equal(api('waveInOpen',[out,0xffffffff,fmt,0x1234,0x87654321,0x10000]),0);
  const handle=e.guest_read32(out)>>>0;assert.ok(handle);
  const posted=[],snapshots=[];
  ctx.exports={...e,post_message_q:(...a)=>{posted.push(a.map(x=>x>>>0));snapshots.push(a[1]===0x3c0?[e.guest_read32(a[3]+8)>>>0,e.guest_read32(a[3]+16)>>>0]:null);return 1;}};
  const flags=[[0,0x12,3],[3,0x12,3],[0x89abcdef,0x89abcdfe,0x89abcdef],[0xffffffff,0xfffffffe,0xffffffef],[0x80000000,0x80000012,0x80000003]];
  function inspect(expected,label,mapping){for(let i=0;i<views.length;i++)compare(views[i],expected[i],label+' full physical span/guards '+i,mapping);}
  const samples=new Float32Array([-1,0,1,0.5]);
  function query(p,v,label,mapping=false,mode='full',poison='data',invalid=null){
   assert.equal(api('waveInReset',[handle]),0);posted.length=0;snapshots.length=0;
   spans.forEach(([b,n],i)=>mem.fill(0x91+i,b,b+n));mem.fill(0x66,wa(data),wa(data)+32);mem.fill(0x77,wa(other),wa(other)+32);
   const header=Buffer.from('000000000400000078563412efcdab8900000000badcfefa6745230110325476','hex');header.writeUInt32LE(invalid==='null'?0:data);header.writeUInt32LE(invalid==='zero'?0:4,4);header.writeUInt32LE(v[0]>>>0,16);
   const decoy=Buffer.from(header);if(poison==='data')decoy.writeUInt32LE(other);if(poison==='length')decoy.writeUInt32LE(8,4);if(poison==='recorded')decoy.writeUInt32LE(0x76543210,8);if(poison==='flags')decoy.writeUInt32LE(0x76543210,16);
   for(const d of decoys)for(let i=0;i<32;i++)mem[wa(d)+((p+i)%4096)]=decoy[i];write(p,header);
   const expected=views.map(b=>Buffer.from(b));patch(expected,p+8,word(0));patch(expected,p+16,word(v[1]));
   stage='submit';compare(api('waveInAddBuffer',[invalid==='handle'?handle+999:handle,p,32]),invalid==='handle'||invalid==='zero'?11:0,label+' return',mapping);stats.queries++;
   inspect(expected,label+' submit',mapping);compare(posted,[],label+' async callback',mapping);
   // g2w(NULL) is the existing nonzero sentinel, so NULL lpData still queues.
   stage='done';
   if(!invalid){
    assert.equal(api('waveInStart',[handle]),0);
    host.wave_in_feed_pcm(handle,[mode==='partial'?samples.subarray(0,2):samples],8000);
    if(mode==='partial'){
     inspect(expected,label+' pending partial',mapping);compare(posted,[],label+' partial no callback',mapping);
     assert.equal(api('waveInStop',[handle]),0);
    }else if(mode==='reset'){assert.equal(api('waveInReset',[handle]),0);}
    patch(expected,p+8,word(mode==='partial'?2:4));patch(expected,p+16,word(v[2]));
    inspect(expected,label+' done',mapping);compare(posted,[[0x1234,0x3c0,handle,p>>>0]],label+' callback identity',mapping);
    compare(snapshots,[[mode==='partial'?2:4,v[2]>>>0]],label+' fields before callback',mapping);
    compare(Array.from(mem.subarray(wa(data),wa(data)+(mode==='partial'?2:4))),mode==='partial'?[0,128]:[0,128,255,191],label+' literal PCM',mapping);
    compare(Array.from(mem.subarray(wa(other),wa(other)+8)),Array(8).fill(0x77),label+' payload decoy untouched',mapping);
   }
   compare(e.guest_span_cursor_bytes(),0,label+' no transient retained',mapping);compare(e.guest_span_overflow_count(),0,label+' no span overflow',mapping);
  }
  for(const v of flags)for(const mode of['full','partial'])query(linear+64,v,'direct '+[v,mode],false,mode);
  for(let phase=0;phase<4096;phase++)for(const base of[adjacent,fragmented,alias])query(base+phase,flags[phase%5],'phase '+[base,phase],base!==adjacent,phase&1?'full':'partial',['data','length','recorded','flags'][phase%4]);
  for(const poison of['data','length','recorded','flags'])for(let cut=1;cut<32;cut++)for(const v of flags)query(fragmented+4096-cut,v,'cut '+[poison,cut,v],true,cut&1?'partial':'full',poison);
  for(let gen=0;gen<4;gen++){map(reuse,gen&1?second:first);map(reuse+4096,gen&1?first:second);for(let cut=1;cut<32;cut++)query(reuse+4096-cut,flags[gen],'reuse '+[gen,cut],true);}
  for(const bad of['handle','null','zero'])for(const base of[linear,fragmented])for(let cut=1;cut<32;cut++)query(base+4096-cut,flags[2],'invalid '+[bad,base,cut],base===fragmented,'full','flags',bad);

  // NULL header historically uses the physical NULL sentinel plus field
  // offsets, and still mutates it before host validation. Pin those bytes.
  for(const invalid of[false,true]){
   assert.equal(api('waveInReset',[handle]),0);posted.length=0;
   const p=wa(0),saved=Buffer.from(mem.subarray(p,p+64));mem.fill(0x5a,p,p+64);dv.setUint32(p,data,true);dv.setUint32(p+4,4,true);dv.setUint32(p+16,0x80000001,true);
   const expected=Buffer.from(mem.subarray(p,p+64));expected.writeUInt32LE(0,0);expected.writeUInt32LE(0,8);expected.writeUInt32LE(0x80000012,16);
   assert.equal(api('waveInAddBuffer',[invalid?handle+999:handle,0,0]),invalid?11:0);assert.deepEqual(Buffer.from(mem.subarray(p,p+64)),expected);assert.equal(api('waveInReset',[handle]),0);mem.set(saved,p);
  }
  if(!expectParent){
   const prime=p=>{write(p,Buffer.alloc(32));write(p,word(data));write(p+4,word(4));write(p+16,word(3));assert.equal(api('waveInAddBuffer',[handle,p,0]),0);};

   const normalExports=ctx.exports;
   for(const route of['exports','instance','renderer','translate']){
    ctx.exports=route==='exports'?normalExports:null;ctx.instance=route==='instance'?{exports:e}:null;
    if(route==='translate'){
     const g2w=require('../lib/mem-utils').g2w,imageBase=e.get_image_base()>>>0;ctx.g2w=p=>g2w(p,imageBase,memory.buffer);
     ctx.exports=new Proxy({}, {get(_t,k){if(k==='post_message_q')return normalExports.post_message_q;throw Error('RPC memory access '+String(k));}});
    }
    for(const field of[8,16])for(let cut=0;cut<=4;cut++)for(const mode of['full','partial','reset']){
     assert.equal(host.wave_in_reset(handle),0);posted.length=0;snapshots.length=0;
     const p=fragmented+4096-field-cut;spans.forEach(([b,n],i)=>mem.fill(0x91+i,b,b+n));write(p+8,word(0xdeadbeef));write(p+16,word(0x80000012));
     const expected=views.map(v=>Buffer.from(v)),n=mode==='full'?4:mode==='partial'?2:0;patch(expected,p+8,word(n));patch(expected,p+16,word(0x80000003));
     assert.equal(host.wave_in_add_buffer(handle,wa(p),p,wa(data),4),0);assert.equal(host.wave_in_start(handle),0);
     if(mode!=='reset')host.wave_in_feed_pcm(handle,[samples.subarray(0,n)],8000);
     if(mode==='partial')assert.equal(host.wave_in_stop(handle),0);if(mode==='reset')assert.equal(host.wave_in_reset(handle),0);
     inspect(expected,'isolated completion '+[route,field,cut,mode],true);
     if(route==='exports'||route==='translate')assert.deepEqual(posted,[[0x1234,0x3c0,handle,p]]);
    }
    ctx.exports=normalExports;ctx.instance=null;delete ctx.g2w;
   }
   const a=fragmented+4085,b=alias+4085;
   assert.equal(api('waveInReset',[handle]),0);posted.length=0;snapshots.length=0;
   prime(a);prime(b);assert.equal(api('waveInStart',[handle]),0);host.wave_in_feed_pcm(handle,[samples.subarray(0,2)],8000);
   assert.equal(api('waveInStop',[handle]),0);assert.deepEqual(posted,[[0x1234,0x3c0,handle,a]]);
   assert.equal(api('waveInReset',[handle]),0);assert.deepEqual(posted,[[0x1234,0x3c0,handle,a],[0x1234,0x3c0,handle,b]]);assert.deepEqual(snapshots,[[2,3],[0,3]]);
   // Resolve the retained guest identity against current page backing.
   posted.length=0;prime(a);map(fragmented,second);map(fragmented+4096,first);write(a+16,word(0x80000012));write(a+8,word(0xdeadbeef));
   const expected=views.map(v=>Buffer.from(v));patch(expected,a+8,word(0));patch(expected,a+16,word(0x80000003));assert.equal(api('waveInReset',[handle]),0);inspect(expected,'inflight remap',true);assert.deepEqual(posted,[[0x1234,0x3c0,handle,a]]);map(fragmented,first);map(fragmented+4096,second);
   // Actual callback FIFO, using a live HWND and the real post_message_q.
   const observed=ctx.exports;ctx.exports=e;e.test_wnd_table_set(0x1234,0xffff0001);e.set_post_queue_count(0);prime(a);assert.equal(api('waveInReset',[handle]),0);assert.equal(e.get_post_queue_count(),1);assert.deepEqual([0,1,2,3].map(i=>e.post_queue_peek(0,i)>>>0),[0x1234,0x3c0,handle,a]);ctx.exports=observed;

   // A sibling host must finish through the submitting memory authority,
   // even when the pumping context has no guest-access exports.
   posted.length=0;prime(a);ctx.voices=ctx._voices;
   const sibling={getMemory:()=>memory.buffer,sharedAudio:ctx,exports:{post_message_q:normalExports.post_message_q}};
   const siblingHost=createHostImports(sibling).host;
   assert.equal(siblingHost.wave_in_reset(handle),0);assert.equal(e.guest_read32(a+8),0);assert.equal(e.guest_read32(a+16),3);assert.deepEqual(posted,[[0x1234,0x3c0,handle,a]]);
   // Close returns every queued header, then posts CLOSE, then retires device.
   posted.length=0;snapshots.length=0;prime(a);prime(b);assert.equal(api('waveInClose',[handle]),0);assert.deepEqual(posted,[[0x1234,0x3c0,handle,a],[0x1234,0x3c0,handle,b],[0x1234,0x3bf,handle,0]]);assert.deepEqual(snapshots,[[0,3],[0,3],null]);assert.equal(host.wave_in_reset(handle),5);assert.equal(host.wave_in_feed_pcm(handle,[samples],8000),0);
  }else assert.equal(api('waveInClose',[handle]),0);
  standalone();console.log(JSON.stringify(stats));assert.equal(stats.controlFailures,0,'direct controls/ABI');
  if(expectParent){assert.ok(stats.submitFailures>0);assert.ok(stats.doneFailures>0);assert.ok(stats.mappingFailures>0);}else assert.equal(stats.mappingFailures,0,'mapped pipeline');return stats;
 } finally {if(oldAC===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=oldAC;}
}
function standalone(){
 const memory=new ArrayBuffer(512*1024),dv=new DataView(memory),posted=[];
 const ctx={getMemory:()=>memory,exports:{post_message_q:(...a)=>posted.push(a)}};
 const host=createHostImports(ctx).host,h=host.wave_in_open(8000,1,8,0x1234,0,1);

 const before=Buffer.from(new Uint8Array(memory));
 for(const args of[[h+999,0x2000,0x403000,0x3000,4],[h,0,0x403000,0x3000,4],[h,0x2000,0x403000,0,4],[h,0x2000,0x403000,0x3000,0],[h,0x2000,0x403000,0x3000,-1]])assert.equal(host.wave_in_add_buffer(...args),11);
 assert.deepEqual(Buffer.from(new Uint8Array(memory)),before);assert.equal(host.wave_in_start(h),0);assert.equal(host.wave_in_feed_pcm(h,[new Float32Array(4)],8000),0);assert.deepEqual(posted,[]);
 for(const op of['wave_in_stop','wave_in_reset','wave_in_close'])assert.equal(host[op](h+999),5);
 for(const [n,mode]of[[0,'full'],[1,'partial'],[2,'reset']]){
  const p=0x2000+n*64;dv.setUint32(p+16,0x80000012,true);dv.setUint32(p+8,0xdeadbeef,true);assert.equal(host.wave_in_add_buffer(h,p,0x403000+n*64,0x3000,4),0);assert.equal(host.wave_in_start(h),0);
  if(mode!=='reset')host.wave_in_feed_pcm(h,[new Float32Array(mode==='full'?4:2)],8000);
  if(mode==='partial')assert.equal(host.wave_in_stop(h),0);if(mode==='reset')assert.equal(host.wave_in_reset(h),0);
  assert.equal(dv.getUint32(p+8,true),mode==='full'?4:mode==='partial'?2:0);assert.equal(dv.getUint32(p+16,true),0x80000003);
 }
 assert.equal(host.wave_in_close(h),0);assert.deepEqual(posted,[[0x1234,0x3c0,h,0x403000],[0x1234,0x3c0,h,0x403040],[0x1234,0x3c0,h,0x403080],[0x1234,0x3bf,h,0]]);
}
module.exports={run,extraWat};
if(require.main===module)run({expectParent:process.argv.includes('--expect-parent')}).catch(e=>{console.error(e);process.exitCode=1;});
