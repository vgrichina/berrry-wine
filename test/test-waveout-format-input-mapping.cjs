#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const root=process.cwd(),{bootRenderHarness}=require(path.join(root,'test/render-helper'));
const apiTable=require(path.join(root,'src/api_table.json'));
// Public waveOutOpen transport regression. The expected numbers and PCM
// samples below are literals, independent of the guest memory helpers.
// https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-waveoutopen
// https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/ns-mmeapi-waveformatex
const extraWat=String.raw`
 (func (export "wf_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "wf_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096) (local.get 1) (i32.const 4)))
 (func (export "wf_regs") (result i32) (global.get $reg_base))
 (func (export "wf_shared") (result i32) (region.addr $WAVE_OUT_SHARED 0))
 (func (export "wf_handle") (result i32) (global.get $wave_out_handle))
 (func (export "wf_local_handle") (param i32) (global.set $wave_out_handle (local.get 0)))
 (func (export "wf_posts") (result i32) (call $shared_post_queue_total_count))
 (func (export "wf_post_field") (param i32) (result i32)
  (call $shared_post_queue_peek_field_tid (global.get $current_thread_id) (i32.const 0) (local.get 0)))
 (func (export "wf_clear_posts") (call $shared_post_queue_reset_tid (global.get $current_thread_id)))
 (func (export "wf_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "wf_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "wf_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
`;
const formats=[
 {name:'mono8',rate:11025,ch:1,bits:8,bytes:'01000100112b0000112b0000010008000000'},
 {name:'stereo16',rate:22050,ch:2,bits:16,bytes:'010002002256000088580100040010000000'},
 {name:'mono16',rate:44100,ch:1,bits:16,bytes:'0100010044ac000088580100020010000000'},
 {name:'stereo8',rate:8000,ch:2,bits:8,bytes:'01000200401f0000803e0000020008000000'},
];
const fields={rate:[4,4],ch:[2,2],bits:[14,2]};
function setup(h,stats){
 const {exports:e,memory}=h;e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.wf_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),regs=e.wf_regs()>>>0;
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
 const put=(p,b)=>{for(let i=0;i<b.length;i++)e.guest_write8(p+i,b[i]);};
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));
 const str=s=>{const b=Buffer.from(s+'\0'),p=alloc(b.length);put(p,b);return p;};
 const stack=alloc(256)+64,entries=new Map();dv.setUint32(regs+16,stack,true);const mod=e.wf_module(str('WINMM.DLL'))>>>0;assert.ok(mod);
 for(const name of['waveOutOpen','waveOutClose','waveOutGetID','waveOutPrepareHeader','waveOutWrite','waveOutReset']){dv.setUint32(regs+16,stack,true);const thunk=e.wf_resolve(mod,str(name))>>>0,row=apiTable.find(r=>r.name===name);assert.ok(thunk);assert.equal(row.convention,'stdcall');assert.equal(e.guest_read32(thunk+4),row.id);entries.set(name,{thunk,nargs:row.nargs});}
 function call(name,args){const row=entries.get(name);assert.equal(args.length,row.nargs);e.guest_write32(stack,0x12345678);args.forEach((v,i)=>e.guest_write32(stack+4+i*4,v));const frame=read(stack,4+args.length*4),seed=[0x81234567,0x12345678,0x23456789,0x3456789a,stack,0x456789ab,0x56789abc,0x6789abcd];seed.forEach((v,i)=>dv.setUint32(regs+i*4,v,true));e.wf_call(row.thunk);stats.calls++;assert.equal(e.get_esp()>>>0,stack+frame.length,name+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,name+' EIP');for(const i of[1,2,3,5,6,7])assert.equal(dv.getUint32(regs+i*4,true),seed[i],name+' register '+i);assert.deepEqual(read(stack,frame.length),frame,name+' complete stdcall frame');return e.get_eax()>>>0;}
 return{...h,e,mem,dv,wa,alloc,put,read,call};
}
async function run(options={}){
 const stats={calls:0,queries:0,comparisons:0,mappingFailures:0,controlFailures:0,fieldFailures:{rate:0,ch:0,bits:0},pcmControls:0,examples:[]};
 function compare(a,b,label,mapping=false){stats.comparisons++;if(Buffer.isBuffer(a)?a.equals(b):JSON.stringify(a)===JSON.stringify(b))return;stats[mapping?'mappingFailures':'controlFailures']++;if(stats.examples.length<24)stats.examples.push({label,actual:Buffer.isBuffer(a)?a.toString('hex'):a,expected:Buffer.isBuffer(b)?b.toString('hex'):b});}
 let opened=[],handle=0x123456;
 const h=setup(await bootRenderHarness({extraWat,fonts:'none',width:8,height:8,extraHostOverrides:{wave_out_open:(...args)=>{opened.push(args);return handle;}}}),stats);
 const {e,mem,dv,wa,alloc,put,read,call}=h,output=alloc(96)+32,direct=alloc(8192),shared=e.wf_shared()>>>0;
 const fragmented=0x30000000,adjacent=0x31000000,repeated=0x32000000,decoys=[0x28000000,0x29000000];
 for(const p of[fragmented,decoys[0],fragmented+4096,decoys[1]])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(adjacent,8192)>>>0,adjacent);
 assert.equal(e.wf_alias(repeated,wa(fragmented)),1);assert.equal(e.wf_alias(repeated+4096,wa(fragmented)),1);
 assert.equal(wa(repeated),wa(repeated+4096));assert.equal(wa(decoys[0]),wa(fragmented)+4096);assert.equal(wa(decoys[1]),wa(fragmented+4096)+4096);assert.notEqual(wa(fragmented+4096),wa(fragmented)+4096);assert.equal(wa(adjacent+4096),wa(adjacent)+4096);
 const spans=[[wa(direct),8192],[wa(fragmented),4096],[wa(fragmented+4096),4096],...decoys.map(p=>[wa(p),4096]),[wa(adjacent),8192]],views=spans.map(([p,n])=>Buffer.from(h.memory.buffer,p,n)),saved=views.map(b=>Buffer.alloc(b.length));
 const callback=0x00401230,instance=0x87654321;
 function query(f,p,label,mapping=false,poison='rate',flags=0,device=0xffffffff,nullOutput=false){
  const start=stats.mappingFailures;spans.forEach(([p,n],i)=>mem.fill(0x91+i,p,p+n));
  const fmt=Buffer.from(f.bytes,'hex');assert.equal(fmt.length,18);
  // Physical fall-through bytes agree on the other two fields. Poison only
  // one field per sweep, so a broken read of each is independently observed.
  const decoy=Buffer.from(fmt),[offset,width]=fields[poison];decoy.fill(0x7e,offset,offset+width);
  for(const d of decoys)for(let i=0;i<18;i++)mem[wa(d)+((p+i)&4095)]=decoy[i];
  put(p,fmt);views.forEach((v,i)=>v.copy(saved[i]));
  mem.fill(0xa5,wa(output)-16,wa(output)+32);const outputBefore=read(output-16,48),sharedBefore=Buffer.from(mem.subarray(shared,shared+16)),handleBefore=e.wf_handle()>>>0;
  e.wf_clear_posts();opened=[];
  // HWND zero routes MM_WOM_OPEN to the current thread's canonical queue;
  // function/thread/event modes retain a distinctive nonzero callback value.
  const type=(flags>>>16)&7,isQuery=!!(flags&1),cb=type===1?0:callback;
  const result=call('waveOutOpen',[nullOutput?0:output,device,p,cb,instance,flags]);stats.queries++;
  compare(result,0,label+' literal MMSYSERR_NOERROR',mapping);
  compare(opened,isQuery?[]:[[f.rate|0,f.ch,f.bits,type,cb,instance|0]],label+' literal six host-open arguments',mapping);
  const outputExpected=Buffer.from(outputBefore);if(!isQuery&&!nullOutput)outputExpected.writeUInt32LE(handle>>>0,16);
  compare(read(output-16,48),outputExpected,label+' output and guards',mapping);
  compare(Array.from(new Uint32Array(h.memory.buffer,shared,4)),isQuery?Array.from(new Uint32Array(sharedBefore.buffer,sharedBefore.byteOffset,4)):[handle>>>0,cb,instance,type],label+' shared callback record',mapping);
  compare(e.wf_handle()>>>0,isQuery?handleBefore:handle>>>0,label+' mutable handle',mapping);
  compare(e.wf_posts(),!isQuery&&type===1?1:0,label+' window notification count',mapping);
  if(!isQuery&&type===1)compare([0,1,2,3].map(i=>e.wf_post_field(i)>>>0),[cb,0x3bb,handle>>>0,0],label+' literal MM_WOM_OPEN message',mapping);
  for(let i=0;i<views.length;i++)compare(views[i],saved[i],label+' complete input/decoy physical span '+i,mapping);
  compare(read(p,18),fmt,label+' logical format unchanged',mapping);
  stats.fieldFailures[poison]+=stats.mappingFailures-start;
  assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);
 }
 for(const f of formats)for(const type of[0,1,2,3,5,7])for(const flags of[type<<16,(type<<16)|1])query(f,direct+128,'direct '+[f.name,flags],false,'rate',flags);
 // Every page phase includes field-local reads, boundaries between fields,
 // every byte cut within all three fields, and the format's leading bytes.
 for(const poison of Object.keys(fields))for(let phase=0;phase<4096;phase++)for(const base of[adjacent,fragmented,repeated])for(const f of[formats[0],formats[1]])query(f,base+phase,'phase '+[poison,phase,base,f.name],base!==adjacent,poison);
 for(const [poison,[offset,width]]of Object.entries(fields))for(let cut=0;cut<=width;cut++)for(const base of[adjacent,fragmented,repeated])for(const f of formats)for(const flags of[0,1,0x10000,0x20000,0x30000,0x50000,0x70000,0x80000001])query(f,base+4096-offset-cut,'cut '+[poison,cut,base,f.name,flags],base!==adjacent,poison,flags);
 for(let phase=0;phase<4096;phase++)query(formats[phase&3],fragmented+phase,'query phase '+phase,true,'bits',0x30001);
 // Existing device/format policy is intentionally observed, not expanded:
 // the handler forwards three fields, ignores the device ID and other fields,
 // returns success even for a host zero handle, and permits NULL phwo.
 for(const device of[0,1,0x12345678,0xffffffff])for(const nullOutput of[false,true])for(const flags of[0,1,0x30000,0x30001])query(formats[2],fragmented+4091,'device/null control',true,'rate',flags,device,nullOutput);
 handle=0;query(formats[0],fragmented+4093,'zero host handle',true);handle=0x123456;
 const ignored={...formats[1],bytes:'7777020022560000efbeaddeffff1000ffff'};query(ignored,direct+64,'ignored fields preserved policy');query(ignored,fragmented+4091,'ignored fields mapped',true);
 const opaque={name:'raw widths',rate:0x89abcdef,ch:0x9234,bits:0x8765,bytes:'eeee3492efcdab891234567856346587ffff'};
 query(opaque,direct+64,'unvalidated widths policy');for(let cut=1;cut<16;cut++)query(opaque,fragmented+4096-cut,'unvalidated widths cut '+cut,true);
 // A worker instance's local handle need not match the shared open record.
 // GetID must still accept that record, reject stale/NULL handles and leave
 // its output untouched on failure; a query must preserve both handle stores.
 const deviceOut=alloc(16);e.wf_local_handle(0xdeadbeef);
 assert.equal(call('waveOutGetID',[handle,deviceOut]),0);assert.equal(e.guest_read32(deviceOut),0);
 e.guest_write32(deviceOut,0xa5a5a5a5);assert.equal(call('waveOutGetID',[handle+1,deviceOut]),5);assert.equal(e.guest_read32(deviceOut)>>>0,0xa5a5a5a5);
 assert.equal(call('waveOutGetID',[0,deviceOut]),5);assert.equal(call('waveOutGetID',[handle,0]),11);
 query(formats[0],fragmented+4093,'query shared/local handle preservation',true,'rate',1);
 await pcmControls(stats,options.expectParent);
 if(options.report)options.report(stats);console.log(JSON.stringify(stats));
 assert.equal(stats.controlFailures,0,'controls');if(options.expectParent){for(const field of Object.keys(fields))assert.ok(stats.fieldFailures[field]>0,field+' independently fails on parent');}else assert.equal(stats.mappingFailures,0,'mapping');return stats;
}
// Real host decoder, driven through the same public winmm thunks, with
// literal unsigned 8-bit and signed little-endian 16-bit PCM expectations.
async function pcmControls(stats,parent){
 class Node{connect(n){return n;}disconnect(){}}
 class AC{constructor(){this.currentTime=20;this.state='running';this.sampleRate=44100;this.destination=new Node();this.started=[];}createGain(){const n=new Node();n.gain={value:1};return n;}createStereoPanner(){const n=new Node();n.pan={value:0};return n;}createDynamicsCompressor(){return new Node();}createBuffer(ch,n,rate){const rows=Array.from({length:ch},()=>new Float32Array(n));return{length:n,sampleRate:rate,duration:n/rate,getChannelData:i=>rows[i]};}createBufferSource(){const n=new Node();n.playbackRate={value:1};n.start=()=>this.started.push(n);n.stop=()=>{};return n;}resume(){return Promise.resolve();}}
 const old=globalThis.AudioContext;globalThis.AudioContext=AC;
 try{
  const h=setup(await bootRenderHarness({extraWat,fonts:'none',width:8,height:8}),stats),{e,wa,alloc,put,read,call}=h;
  const fmt=alloc(32),out=alloc(8),hdr=alloc(32),data=alloc(64),id=alloc(8);
  const vectors=[{f:formats[0],pcm:'0080ffc0',rows:[[-1,0,127/128,0.5]]},{f:formats[1],pcm:'0080ff7f0000004000c00020ff7f0080',rows:[[-1,0,-0.5,32767/32768],[32767/32768,0.5,0.25,-1]]}];
  for(const v of vectors)for(const mapped of[false,true]){
   const p=mapped?0x33000ffb:fmt;if(mapped){assert.equal(e.test_virtual_map_commit(0x33000000,4096)>>>0,0x33000000);assert.equal(e.test_virtual_map_commit(0x34000000,4096)>>>0,0x34000000);assert.equal(e.test_virtual_map_commit(0x33001000,4096)>>>0,0x33001000);}
   // A parent PCM failure is already proved by literal host arguments above;
   // its independently decoded contiguous controls must still pass unchanged.
   if(parent&&mapped)continue;
   put(p,Buffer.from(v.f.bytes,'hex'));assert.equal(call('waveOutOpen',[out,0xffffffff,p,0,0,0]),0);const handle=e.guest_read32(out)>>>0;assert.ok(handle);
   assert.equal(call('waveOutGetID',[handle,id]),0);assert.equal(e.guest_read32(id),0);
   const bytes=Buffer.from(v.pcm,'hex');put(data,bytes);put(hdr,Buffer.alloc(32));e.guest_write32(hdr,data);e.guest_write32(hdr+4,bytes.length);assert.equal(call('waveOutPrepareHeader',[handle,hdr,32]),0);assert.equal(call('waveOutWrite',[handle,hdr,32]),0);
   const voice=h.hostCtx._voices._map[handle],buffer=h.hostCtx._voices._ac.started.at(-1).buffer;
   assert.equal(voice.rate,v.f.rate);assert.equal(voice.channels,v.f.ch);assert.equal(voice.bits,v.f.bits);assert.equal(buffer.sampleRate,v.f.rate);assert.equal(buffer.length,4);for(let c=0;c<v.rows.length;c++)assert.deepEqual(Array.from(buffer.getChannelData(c)),v.rows[c]);assert.deepEqual(read(data,bytes.length),bytes);
   assert.equal(call('waveOutReset',[handle]),0);assert.equal(call('waveOutClose',[handle]),0);assert.equal(call('waveOutGetID',[handle,id]),5);stats.pcmControls++;
  }
 }finally{if(old===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=old;}
}
if(require.main===module)run({expectParent:process.argv.includes('--expect-parent')}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run,extraWat};
