#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const root=process.cwd(),{bootRenderHarness}=require(path.join(root,'test/render-helper'));
const apiTable=require(path.join(root,'src/api_table.json'));
// LOGFONTA/W are 60/92 bytes. Expected output below is built from literal
// fields, never by copying GetObject or a private font helper's result.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-logfonta
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-logfontw
const extraWat=String.raw`
 (func (export "fi_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "fi_seed_error") (param i32) (global.set $last_error (local.get 0)))
 (func (export "fi_heap_alloc") (param i32) (result i32) (call $heap_alloc (local.get 0)))
 (func (export "fi_heap_free") (param i32) (result i32) (call $heap_free (local.get 0)) (i32.const 1))
 (func (export "fi_regs") (result i32) (global.get $reg_base))
 (func (export "fi_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "fi_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "fi_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
`;
const requests=[
 {face:'Terminal',height:-12,width:0,weight:400,italic:0,charset:255,pitch:0x31},
 {face:'Fixedsys',height:15,width:0,weight:400,italic:0,charset:0,pitch:0x31},
 {face:'Arial',height:-19,width:7,weight:700,italic:1,charset:2,pitch:0x22},
 {face:'1234567890123456789012345678901',height:-12,width:0,weight:400,italic:0,charset:0,pitch:0x21},
 {face:'',height:17,width:6,weight:600,italic:2,charset:1,pitch:0x42},
 {face:'NoSuchFont-0123456789-abcdefghij',height:-14,width:3,weight:500,italic:3,charset:128,pitch:0x12},
 // Existing CC0 fixture's independent name table has a localized Unicode
 // family plus the canonical ANSI family. This requires tt_wide_family to
 // see the real WCHARs; ANSI fallback of this localized name is different.
 {face:'測試甲',outputFace:'Fixture Bitmap',onlyWide:true,height:-12,width:0,weight:400,italic:0,charset:136,pitch:0x31},
];
function input(f,wide){
 const b=Buffer.alloc(wide?92:60,0x6b);
 [f.height,f.width,123,321,f.weight].forEach((x,i)=>b.writeInt32LE(x,i*4));
 b.set([f.italic,1,1,f.charset,7,6,5,f.pitch],20);
 b.fill(0x71,28);Buffer.from(f.face+'\0',wide?'utf16le':'latin1').copy(b,28);return b;
}
function expected(f,wide){
 const b=Buffer.alloc(wide?92:60);b.writeInt32LE(f.height,0);b.writeInt32LE(f.width,4);b.writeInt32LE(f.weight,16);
 b[20]=f.italic&1;b[23]=f.charset;b[27]=f.pitch;
 Buffer.from((f.outputFace||f.face).slice(0,31)+'\0',wide?'utf16le':'latin1').copy(b,28);return b;
}
async function run(options={}){
 const stats={calls:0,queries:0,comparisons:0,mappingFailures:0,controlFailures:0,pixelControls:0,examples:[]};
 function compare(a,b,label,mapping=false){stats.comparisons++;if(Buffer.isBuffer(a)?a.equals(b):JSON.stringify(a)===JSON.stringify(b))return;stats[mapping?'mappingFailures':'controlFailures']++;if(stats.examples.length<24){let first=0;if(Buffer.isBuffer(a))while(first<a.length&&a[first]===b[first])first++;stats.examples.push({label,first,actual:Buffer.isBuffer(a)?a.subarray(first,first+16).toString('hex'):a,expected:Buffer.isBuffer(b)?b.subarray(first,first+16).toString('hex'):b});}}
 const{exports:e,memory,hostCtx}=await bootRenderHarness({extraWat,width:32,height:32});
 const fixture=fs.readFileSync(path.join(root,'test/fixtures/ttc-ebdt/bitmap.ttf'));assert.equal(crypto.createHash('sha256').update(fixture).digest('hex'),'d3592211c34594d3bb37e72c987dd05cd01f2c47210f508639ad43d4f1ebc81d');
 hostCtx.vfs.files.set('c:\\windows\\fonts\\fi-bitmap.ttf',{data:new Uint8Array(fixture),attrs:0x20});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.fi_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),v=new DataView(memory.buffer),regs=e.fi_regs()>>>0;
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
 const put=(p,b)=>b.forEach((x,i)=>e.guest_write8(p+i,x));
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));
 const str=(s,wide=false)=>{const b=Buffer.from(s+'\0',wide?'utf16le':'latin1'),p=alloc(b.length);put(p,b);return p;};
 const frame=alloc(256),stack=frame+64,other=alloc(64),direct=alloc(8192),control=alloc(128),out=alloc(192),metric=alloc(80),bmi=alloc(40);
 v.setUint32(regs+16,stack,true);const module=e.fi_module(str('GDI32.DLL'))>>>0;assert.ok(module);
 const entries=new Map();
 for(const name of ['CreateFontIndirectA','CreateFontIndirectW','CreateFontA','CreateFontW','GetObjectA','GetObjectW','GetObjectType','GetTextMetricsA','GetTextMetricsW','GetTextFaceA','GetTextFaceW','GetTextCharset','GetTextExtentPoint32A','CreateCompatibleDC','DeleteDC','SelectObject','DeleteObject','SaveDC','RestoreDC','GetCurrentObject','CreateDIBSection','TextOutA','SetBkMode','GetBkMode','SetTextColor','GetTextColor','IntersectClipRect','GetClipBox']){
  v.setUint32(regs+16,stack,true);const thunk=e.fi_resolve(module,str(name))>>>0,row=apiTable.find(r=>r.name===name);assert.ok(thunk,name);assert.equal(row.convention,'stdcall');assert.equal(e.guest_read32(thunk+4),row.id);entries.set(name,{thunk,nargs:row.nargs});
 }
 function call(name,args){const row=entries.get(name);assert.equal(args.length,row.nargs,name+' arity');mem.fill(0x6d,wa(frame),wa(frame)+256);e.guest_write32(stack,0x12345678);args.forEach((x,i)=>e.guest_write32(stack+4+i*4,x));const before=read(frame,256),unrelated=read(other,64),seed=[0x81234567,0x12345678,0x23456789,0x3456789a,stack,0x456789ab,0x56789abc,0x6789abcd];seed.forEach((x,i)=>v.setUint32(regs+i*4,x,true));e.fi_call(row.thunk);stats.calls++;assert.equal(e.get_esp()>>>0,stack+4+args.length*4,name+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,name+' EIP');for(const i of[1,2,3,5,6,7])assert.equal(v.getUint32(regs+i*4,true),seed[i],name+' register '+i);assert.deepEqual(read(frame,256),before,name+' whole stack');assert.deepEqual(read(other,64),unrelated);return e.get_eax()>>>0;}
 const dc=call('CreateCompatibleDC',[0]);assert.ok(dc);const sample=str('MWi!');
 function observe(font){assert.ok(font);const data={};assert.equal(call('GetObjectType',[font]),6);
  for(const wide of[false,true]){put(out,Buffer.alloc(192,0xac));const n=wide?92:60;assert.equal(call(wide?'GetObjectW':'GetObjectA',[font,n,out+4]),n);data[wide?'W':'A']=read(out+4,n).toString('hex');assert.deepEqual(read(out,4),Buffer.alloc(4,0xac));assert.deepEqual(read(out+4+n,188-n),Buffer.alloc(188-n,0xac));}
  const old=call('SelectObject',[dc,font]);
  for(const wide of[false,true]){put(metric,Buffer.alloc(80,0xac));const n=wide?60:56;assert.equal(call(wide?'GetTextMetricsW':'GetTextMetricsA',[dc,metric+4]),1);data[wide?'metricsW':'metricsA']=read(metric+4,n).toString('hex');assert.deepEqual(read(metric,4),Buffer.alloc(4,0xac));assert.deepEqual(read(metric+4+n,76-n),Buffer.alloc(76-n,0xac));put(out,Buffer.alloc(192,0));const count=call(wide?'GetTextFaceW':'GetTextFaceA',[dc,32,out]);data[wide?'faceW':'faceA']=[count,read(out,wide?64:32).toString('hex')];}
  data.charset=call('GetTextCharset',[dc]);assert.equal(call('GetTextExtentPoint32A',[dc,sample,4,out]),1);data.extent=read(out,8).toString('hex');call('SelectObject',[dc,old]);return data;
 }
 // Controls are assembled separately with guest field stores and a standalone
 // face pointer for CreateFontA/W; they never reuse the packed test input.
 const controls=new Map();
 stats.nullBaseline=[];
 for(const wide of[false,true]){const sentinel=Buffer.from(memory.buffer,wa(0),128),saved=Buffer.from(sentinel),h=call(wide?'CreateFontIndirectW':'CreateFontIndirectA',[0]);stats.nullBaseline.push({wide,success:!!h,value:h?observe(h):null});if(h)assert.equal(call('DeleteObject',[h]),1);compare(sentinel,saved,'NULL physical sentinel unchanged '+wide);assert.equal(e.guest_span_cursor_bytes(),0);}
 for(const wide of[false,true])for(const[findex,f]of requests.entries()){
  if(f.onlyWide&&!wide)continue;
  put(control,Buffer.alloc(128));for(const[offset,value]of[[0,f.height],[4,f.width],[8,123],[12,321],[16,f.weight]])e.guest_write32(control+offset,value);
  for(const[offset,value]of[[20,f.italic],[21,1],[22,1],[23,f.charset],[24,7],[25,6],[26,5],[27,f.pitch]])e.guest_write8(control+offset,value);
  for(let i=0;i<f.face.length;i++)if(wide)e.guest_write16(control+28+i*2,f.face.charCodeAt(i));else e.guest_write8(control+28+i,f.face.charCodeAt(i));
  const h=call(wide?'CreateFontIndirectW':'CreateFontIndirectA',[control]),a=observe(h);for(const w of[false,true])compare(a[w?'W':'A'],expected(f,w).toString('hex'),'contiguous literal '+wide+'/'+findex+'/'+w);assert.equal(call('DeleteObject',[h]),1);
  const face=str(f.face,wide),explicit=call(wide?'CreateFontW':'CreateFontA',[f.height,f.width,123,321,f.weight,f.italic,1,1,f.charset,7,6,5,f.pitch,face]);const b=observe(explicit);compare(a,b,'independent CreateFont control '+wide+'/'+findex);assert.equal(call('DeleteObject',[explicit]),1);controls.set(wide+'/'+findex,a);
 }
 const fragmented=0x30000000,adjacent=0x31000000,decoys=[0x28000000,0x29000000];
 for(const p of[fragmented,...decoys,fragmented+4096])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);assert.equal(e.test_virtual_map_commit(adjacent,8192)>>>0,adjacent);
 assert.equal(wa(decoys[0]),wa(fragmented)+4096);assert.equal(wa(decoys[1]),wa(fragmented)+8192);assert.notEqual(wa(fragmented+4096),wa(fragmented)+4096);assert.equal(wa(adjacent+4096),wa(adjacent)+4096);
 const spans=[[wa(direct),8192],[wa(fragmented),4096],[wa(fragmented+4096),4096],...decoys.map(p=>[wa(p),4096]),[wa(adjacent),8192]];
 const backing=spans.map(([p,n])=>Buffer.from(memory.buffer,p,n)),before=backing.map(b=>Buffer.alloc(b.length));
 function query(wide,index,p,label,mapping=false,keep=false){
  const f=requests[index],b=input(f,wide);stats.queries++;backing.forEach((a,i)=>a.fill(0x91+i));
  // Both immediately following physical pages belong to unrelated mappings.
  // Their false continuation is another well-formed, small font request.
  const decoy=input({...f,face:'Courier',height:f.height<0?-13:16,width:2,weight:300,italic:0,charset:0,pitch:0x11},wide),cut=4096-(p&4095);
  if(mapping&&cut<b.length)mem.set(decoy.subarray(cut),wa(p)+cut);
  put(p,b);backing.forEach((a,i)=>a.copy(before[i]));
  const error=(0xa0010000+stats.queries)>>>0;e.fi_seed_error(error);const h=call(wide?'CreateFontIndirectW':'CreateFontIndirectA',[p]);compare(e.test_get_last_error()>>>0,error,label+' last error');const actual=observe(h);
  for(const w of[false,true])compare(actual[w?'W':'A'],expected(f,w).toString('hex'),label+' literal '+w,mapping);
  compare(actual,controls.get(wide+'/'+index),label+' contiguous/CreateFont metrics',mapping);
  backing.forEach((a,i)=>compare(a,before[i],label+' source/full backing/decoy '+i));
  assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);
  if(!keep)assert.equal(call('DeleteObject',[h]),1);return h;
 }
 for(const wide of[false,true])for(let i=0;i<requests.length;i++){
  if(requests[i].onlyWide&&!wide)continue;
  const n=wide?92:60;for(let phase=0;phase<4;phase++)query(wide,i,direct+33+phase,'direct '+wide+'/'+i+'/'+phase);
  for(let cut=1;cut<n;cut++)for(const base of[adjacent,fragmented])query(wide,i,base+4096-cut,'every byte cut '+wide+'/'+i+'/'+cut+'/'+base,base===fragmented);
  for(const base of[adjacent,fragmented])for(const offset of[0,4096-n,4096,8192-n])query(wide,i,base+offset,'exact bounds '+wide+'/'+i+'/'+offset+'/'+base);
  for(let repeat=0;repeat<3;repeat++)query(wide,i,fragmented+4095,'repeat '+wide+'/'+i+'/'+repeat,true);
 }
 stats.allocationBalance=[];
 for(const wide of[false,true])for(const base of[direct,adjacent,fragmented]){
  const p=base===direct?direct+33:base+4093;put(p,input(requests[0],wide));
  const before=e.heap_stat(0)-e.heap_stat(1);
  for(let i=0;i<64;i++){const h=call(wide?'CreateFontIndirectW':'CreateFontIndirectA',[p]);assert.ok(h);assert.equal(call('DeleteObject',[h]),1);assert.equal(e.guest_span_cursor_bytes(),0);}
  const net=Number(e.heap_stat(0)-e.heap_stat(1)-before);stats.allocationBalance.push({wide,base,net});compare(net,0,'repeated create/delete heap allocation balance '+wide+'/'+base);
 }
 // A private test DC above is restored after each metric query. Two further
 // public DIB DCs exercise persistent selections and nested Save/Restore.
 function target(){const dc=call('CreateCompatibleDC',[0]);put(bmi,Buffer.alloc(40));e.guest_write32(bmi,40);e.guest_write32(bmi+4,32);e.guest_write32(bmi+8,-32);e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);const bitmap=call('CreateDIBSection',[dc,bmi,0,out,0,0]),bits=e.guest_read32(out)>>>0;assert.ok(bitmap&&bits);return{dc,bitmap,bits,oldBitmap:call('SelectObject',[dc,bitmap])};}
 const a=target(),b=target(),terminal=query(false,0,fragmented+4093,'drawing ANSI Terminal',true,true),terminalW=query(true,0,fragmented+4091,'drawing Unicode Terminal',true,true),bar=str('\xb3');
 a.oldFont=call('SelectObject',[a.dc,terminal]);b.oldFont=call('SelectObject',[b.dc,terminalW]);for(const t of[a,b]){call('SetBkMode',[t.dc,1]);call('SetTextColor',[t.dc,0]);}
 const pixels=t=>Buffer.from(memory.buffer,wa(t.bits),4096);
 function state(t){return[call('GetCurrentObject',[t.dc,6]),call('GetTextCharset',[t.dc]),call('GetTextColor',[t.dc]),call('GetBkMode',[t.dc]),call('GetClipBox',[t.dc,out]),read(out,16).toString('hex')];}
 const independent=state(b);
 function draw(label,clip,color){const saved=state(a);pixels(a).fill(255);pixels(b).fill(255);assert.equal(call('TextOutA',[a.dc,3,4,bar,1]),1);const literal=Buffer.alloc(4096,255);
  // Bundled Terminal CP437 U+2502: 8x12, column4 ink on each row.
  for(let y=Math.max(4,clip[1]);y<Math.min(16,clip[3]);y++)if(7>=clip[0]&&7<clip[2]){const j=(y*32+7)*4;literal[j]=color>>>16&255;literal[j+1]=color>>>8&255;literal[j+2]=color&255;literal[j+3]=0;}
  compare(pixels(a),literal,label+' literal fixedfont DIB',true);compare(pixels(b),Buffer.alloc(4096,255),label+' independent DIB');compare(state(a),saved,label+' font state');compare(state(b),independent,label+' independent DC');stats.pixelControls++;if(options.capture)options.capture(label,Buffer.from(pixels(a)),32,32);
 }
 const original=state(a);draw('initial',[0,0,32,32],0);assert.equal(call('SaveDC',[a.dc]),1);call('SetTextColor',[a.dc,0x00336699]);assert.equal(call('IntersectClipRect',[a.dc,5,6,10,14]),2);const outer=state(a);assert.equal(call('SaveDC',[a.dc]),2);call('SelectObject',[a.dc,terminalW]);call('SetTextColor',[a.dc,0x00663399]);assert.equal(call('IntersectClipRect',[a.dc,6,8,9,12]),2);const inner=state(a);
 for(const[saved,clip,color,label]of[[inner,[6,8,9,12],0x00663399,'inner'],[outer,[5,6,10,14],0x00336699,'outer']]){query(true,2,fragmented+4095,label+' unrelated font creation',true);compare(state(a),saved,label+' creation preserves DC');draw(label,clip,color);assert.equal(call('RestoreDC',[a.dc,-1]),1);}
 compare(state(a),original,'nested saves restored');draw('restored',[0,0,32,32],0);
 for(const t of[a,b]){call('SelectObject',[t.dc,t.oldFont]);call('SelectObject',[t.dc,t.oldBitmap]);assert.equal(call('DeleteObject',[t.bitmap]),1);assert.equal(call('DeleteDC',[t.dc]),1);}for(const h of[terminal,terminalW])assert.equal(call('DeleteObject',[h]),1);assert.equal(call('DeleteDC',[dc]),1);
 const liveFonts=[],objectNet=e.heap_stat(0)-e.heap_stat(1);put(control,input(requests[0],false));
 try{let h;while((h=call('CreateFontIndirectA',[control]))){liveFonts.push(h);assert.ok(liveFonts.length<2048,'finite object table');}
  const net=e.heap_stat(0)-e.heap_stat(1);for(const wide of[false,true]){put(fragmented+4093,input(requests[0],wide));for(let i=0;i<3;i++){compare(call(wide?'CreateFontIndirectW':'CreateFontIndirectA',[fragmented+4093]),0,'object table exhaustion '+wide);assert.equal(e.guest_span_cursor_bytes(),0);}}compare(Number(e.heap_stat(0)-e.heap_stat(1)-net),0,'object allocation failure cleanup');stats.objectExhaustion={liveFonts:liveFonts.length,failedCalls:6};
 }finally{for(const h of liveFonts)assert.equal(call('DeleteObject',[h]),1);}compare(Number(e.heap_stat(0)-e.heap_stat(1)-objectNet),0,'object pressure released');
 // Exercise the real allocator's failures after the render/cache controls
 // are warm. Fixture allocator pressure owns every block and frees all of it;
 // all font observations still use the public resolver and thunk.
 // A retained 64-byte hole permits W's conversion allocation, then forces
 // its owned font-face allocation to fail; repeated calls must free it.
 console.log('PREPRESSURE '+JSON.stringify(stats));const pressure=[],hole=e.fi_heap_alloc(64)>>>0;assert.ok(hole);
 try{
  for(const size of[8*1024*1024,65536,4096,64,32]){let count=0,p;while((p=(e.fi_heap_alloc(size)>>>0))){pressure.push(p);assert.ok(++count<1000000,'finite pressure '+size);}}
  console.log('PRESSURE reached '+pressure.length);stats.allocationFailures=[];
  for(const wide of[false,true]){put(fragmented+4093,input(requests[0],wide));backing.forEach((a,i)=>a.copy(before[i]));const net=e.heap_stat(0)-e.heap_stat(1);for(let i=0;i<3;i++){compare(call(wide?'CreateFontIndirectW':'CreateFontIndirectA',[fragmented+4093]),0,'real heap exhaustion '+wide);assert.equal(e.guest_span_cursor_bytes(),0);}compare(Number(e.heap_stat(0)-e.heap_stat(1)-net),0,'heap failure leak '+wide);backing.forEach((a,i)=>compare(a,before[i],'heap failure input immutable '+wide+'/'+i));stats.allocationFailures.push({wide,stage:'initial allocation',repeats:3});}
  assert.equal(e.fi_heap_free(hole),1);
  put(fragmented+4093,input(requests[0],true));const net=e.heap_stat(0)-e.heap_stat(1),allocs=e.heap_stat(0),frees=e.heap_stat(1);
  for(let i=0;i<3;i++){compare(call('CreateFontIndirectW',[fragmented+4093]),0,'W owned-face allocation fails after conversion allocation');assert.equal(e.guest_span_cursor_bytes(),0);}
  compare(Number(e.heap_stat(0)-allocs),3,'W conversion allocation actually succeeded three times');compare(Number(e.heap_stat(1)-frees),3,'W conversion allocation actually freed three times');compare(Number(e.heap_stat(0)-e.heap_stat(1)-net),0,'W partial allocation cleanup');stats.allocationFailures.push({wide:true,stage:'owned face after conversion allocation',repeats:3});
 }finally{for(const p of pressure)assert.equal(e.fi_heap_free(p),1);}
 console.log(JSON.stringify(stats));return stats;
}
module.exports={run,input,expected,requests};
if(require.main===module)run().then(s=>{assert.equal(s.controlFailures,0);assert.equal(s.mappingFailures,0);console.log('PASS CreateFontIndirectA/W bounded LOGFONT guest mapping and preserved public font/DC ABI');}).catch(e=>{console.error(e);process.exitCode=1;});
