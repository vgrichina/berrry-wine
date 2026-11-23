#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),{bootRenderHarness}=require(path.join(root,'test/render-helper'));
const apiTable=require(path.join(root,'src/api_table.json'));
// Literal LOGFONT fields independently describe the existing CreateFont
// contract. No expected face or pixels come from the implementation's helpers.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-createfonta
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-createfontw
const extraWat=String.raw`
 (func (export "ff_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "ff_regs") (result i32) (global.get $reg_base))
 (func (export "ff_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "ff_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "ff_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "ff_hold_span") (param i32 i32) (result i32)
  (call $guest_span_in (local.get 0) (local.get 1)))
 (func (export "ff_drop_span") (param i32 i32)
  (call $guest_span_release (local.get 0) (local.get 1)))
`;
const specs=[
 {face:'Terminal',height:-12,width:0,weight:400,italic:0,charset:255,pitch:0x31},
 {face:'Arial',height:-19,width:7,weight:700,italic:1,charset:2,pitch:0x22},
 {face:'Fixedsys',height:15,width:0,weight:400,italic:0,charset:0,pitch:0x31},
 {face:'',height:17,width:6,weight:600,italic:2,charset:1,pitch:0x42},
 {face:'NoSuchFont-0123456789-abcdefghij',height:-14,width:3,weight:500,italic:3,charset:128,pitch:0x12},
 {face:'測試甲',outputFace:'Fixture Bitmap',onlyWide:true,height:-12,width:0,weight:400,italic:0,charset:136,pitch:0x31},
];
const bytes=(f,wide)=>Buffer.from(f.face+'\0',wide?'utf16le':'latin1');
function expected(f,wide){const b=Buffer.alloc(wide?92:60);b.writeInt32LE(f.height,0);b.writeInt32LE(f.width,4);b.writeInt32LE(f.weight,16);b[20]=f.italic&1;b[23]=f.charset;b[27]=f.pitch;Buffer.from((f.outputFace??f.face).slice(0,31)+'\0',wide?'utf16le':'latin1').copy(b,28);return b;}
const longAliases=[40,63,64,8193].map(n=>'測'+'X'.repeat(n-1));
// Add original family-name records to the pinned CC0 artwork. A fresh sfnt
// encoder keeps offsets, table checksums and checksumAdjustment correct.
// These >31-character aliases preserve historical behavior; they are not
// claims about Windows accepting names beyond its documented face capacity.
function extendedFixture(original){
 const tables=[];for(let i=0;i<original.readUInt16BE(4);i++){const r=12+16*i,tag=original.toString('ascii',r,r+4),off=original.readUInt32BE(r+8),len=original.readUInt32BE(r+12);tables.push({tag,data:Buffer.from(original.subarray(off,off+len))});}
 const entry=tables.find(t=>t.tag==='name'),old=entry.data,records=[],strings=[];let offset=0;
 function add(row,b){const r=Buffer.from(row);r.writeUInt16BE(b.length,8);r.writeUInt16BE(offset,10);records.push(r);strings.push(b);offset+=b.length;}
 for(let i=0;i<old.readUInt16BE(2);i++){const r=old.subarray(6+12*i,18+12*i),off=old.readUInt16BE(4)+r.readUInt16BE(10);add(r,old.subarray(off,off+r.readUInt16BE(8)));}
 for(const alias of longAliases){const r=Buffer.alloc(12);r.writeUInt16BE(3,0);r.writeUInt16BE(1,2);r.writeUInt16BE(0x404,4);r.writeUInt16BE(1,6);add(r,Buffer.from(alias,'utf16le').swap16());}
 const header=Buffer.alloc(6);header.writeUInt16BE(records.length,2);header.writeUInt16BE(6+12*records.length,4);entry.data=Buffer.concat([header,...records,...strings]);
 const head=tables.find(t=>t.tag==='head');head.data.writeUInt32BE(0,8);
 const align=n=>(n+3)&~3;let cursor=12+16*tables.length;const total=cursor+tables.reduce((n,t)=>n+align(t.data.length),0),out=Buffer.alloc(total);original.copy(out,0,0,12);
 const checksum=b=>{let s=0;for(let i=0;i<b.length;i+=4){let word=0;for(let j=0;j<4;j++)word=(word<<8)|(b[i+j]||0);s=(s+(word>>>0))>>>0;}return s;};
 tables.forEach((t,i)=>{const r=12+16*i;out.write(t.tag,r,'ascii');out.writeUInt32BE(checksum(t.data),r+4);out.writeUInt32BE(cursor,r+8);out.writeUInt32BE(t.data.length,r+12);t.data.copy(out,cursor);t.offset=cursor;cursor+=align(t.data.length);});
 out.writeUInt32BE((0xb1b0afba-checksum(out))>>>0,head.offset+8);assert.equal(checksum(out),0xb1b0afba);return out;
}
async function run(options={}){
 const stats={calls:0,queries:0,comparisons:0,mappingFailures:0,controlFailures:0,pixelControls:0,examples:[],controlExamples:[]};
 function compare(a,b,label,mapping=false){stats.comparisons++;if(Buffer.isBuffer(a)?a.equals(b):JSON.stringify(a)===JSON.stringify(b))return;stats[mapping?'mappingFailures':'controlFailures']++;if(!mapping&&stats.controlExamples.length<24)stats.controlExamples.push({label,actual:a,expected:b});if(stats.examples.length<24){let first=0;if(Buffer.isBuffer(a))while(first<a.length&&a[first]===b[first])first++;stats.examples.push({label,first,actual:Buffer.isBuffer(a)?a.subarray(first,first+16).toString('hex'):a,expected:Buffer.isBuffer(b)?b.subarray(first,first+16).toString('hex'):b});}}
 const fixture=fs.readFileSync(path.join(root,'test/fixtures/ttc-ebdt/bitmap.ttf'));assert.equal(crypto.createHash('sha256').update(fixture).digest('hex'),'d3592211c34594d3bb37e72c987dd05cd01f2c47210f508639ad43d4f1ebc81d');
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'fonts/Terminal.fon'))).digest('hex'),'dccca736742e4c1bf0b6a98393417c07f6e46ef0ecb2030cec0ebddb2369d4e1');
 const{exports:e,memory,hostCtx}=await bootRenderHarness({extraWat,width:32,height:32});
 const sfnt=extendedFixture(fixture);if(options.input)options.input('extended-cc0-font.ttf',sfnt);
 hostCtx.vfs.files.set('c:\\windows\\fonts\\ff-bitmap.ttf',{data:new Uint8Array(sfnt),attrs:0x20});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.ff_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),regs=e.ff_regs()>>>0;
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
 const put=(p,b)=>{for(let i=0;i<b.length;i++)e.guest_write8(p+i,b[i]);};
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));
 const str=(s,w=false)=>{const b=Buffer.from(s+'\0',w?'utf16le':'latin1'),p=alloc(b.length);put(p,b);return p;};
 const frame=alloc(256),stack=frame+64,unrelated=alloc(64),out=alloc(192),packed=alloc(92),bmi=alloc(40),direct=alloc(32768),fontDataOut=alloc(sfnt.length);
 const entries=new Map();
 for(const[dll,names]of[
  ['GDI32.DLL',['CreateFontA','CreateFontW','CreateFontIndirectA','CreateFontIndirectW','GetObjectA','GetObjectW','GetObjectType','CreateCompatibleDC','DeleteDC','SelectObject','DeleteObject','GetCurrentObject','GetTextFaceA','GetTextFaceW','GetTextMetricsA','GetTextExtentPoint32A','GetTextCharset','GetFontData','SaveDC','RestoreDC','CreateDIBSection','TextOutA','TextOutW','SetBkMode','GetBkMode','SetTextColor','GetTextColor','IntersectClipRect','GetClipBox']],
  ['KERNEL32.DLL',['GetProcessHeap','HeapAlloc','HeapFree','SetLastError','GetLastError']]]){
  view.setUint32(regs+16,stack,true);const module=e.ff_module(str(dll))>>>0;assert.ok(module,dll);
  for(const name of names){view.setUint32(regs+16,stack,true);const resolved=e.ff_resolve(module,str(name))>>>0,row=apiTable.find(r=>r.name===name);let thunk=resolved;if(dll==='KERNEL32.DLL'){assert.equal(e.guest_read8(resolved),0xe9,name+' native export JMP');thunk=(resolved+5+e.guest_read32(resolved+1))>>>0;}assert.ok(thunk,name+' public resolver');assert.equal(row.convention,'stdcall');assert.equal(e.guest_read32(thunk+4),row.id,name+" resolved thunk id");entries.set(name,{thunk,nargs:row.nargs});}
 }
 function call(name,args){const row=entries.get(name);assert.equal(args.length,row.nargs,name+' arity');mem.fill(0x6d,wa(frame),wa(frame)+256);e.guest_write32(stack,0x12345678);args.forEach((x,i)=>e.guest_write32(stack+4+i*4,x));const before=read(frame,256),other=read(unrelated,64),seed=[0x81234567,0x12345678,0x23456789,0x3456789a,stack,0x456789ab,0x56789abc,0x6789abcd];seed.forEach((x,i)=>view.setUint32(regs+i*4,x,true));e.ff_call(row.thunk);stats.calls++;assert.equal(e.get_esp()>>>0,stack+4+args.length*4,name+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,name+' EIP');for(const i of[1,2,3,5,6,7])assert.equal(view.getUint32(regs+i*4,true),seed[i],name+' register '+i);assert.deepEqual(read(frame,256),before,name+' complete stack');assert.deepEqual(read(unrelated,64),other,name+' unrelated bytes');return e.get_eax()>>>0;}
 function create(f,w,p){return call(w?'CreateFontW':'CreateFontA',[f.height,f.width,123,321,f.weight,f.italic,1,1,f.charset,7,6,5,f.pitch,p]);}
 const dc=call('CreateCompatibleDC',[0]);assert.ok(dc);const sample=str('A');
 function observe(h){assert.ok(h,'created font');assert.equal(call('GetObjectType',[h]),6);const data={};
  for(const w of[false,true]){put(out,Buffer.alloc(192,0xac));const n=w?92:60;assert.equal(call(w?'GetObjectW':'GetObjectA',[h,n,out+4]),n);data[w?'W':'A']=read(out+4,n).toString('hex');assert.deepEqual(read(out,4),Buffer.alloc(4,0xac));assert.deepEqual(read(out+4+n,188-n),Buffer.alloc(188-n,0xac));}
  const old=call('SelectObject',[dc,h]);put(out,Buffer.alloc(192));assert.equal(call('GetTextMetricsA',[dc,out]),1);data.metrics=read(out,56).toString('hex');assert.equal(call('GetTextExtentPoint32A',[dc,sample,1,out]),1);data.extent=read(out,8).toString('hex');
  for(const w of[false,true]){put(out,Buffer.alloc(192));const count=call(w?'GetTextFaceW':'GetTextFaceA',[dc,32,out]);data[w?'faceW':'faceA']=[count,read(out,w?64:32).toString('hex')];}data.charset=call('GetTextCharset',[dc]);call('SelectObject',[dc,old]);return data;
 }
 const controls=new Map();
 function independentFont(f,w){
  put(packed,Buffer.alloc(92));[f.height,f.width,123,321,f.weight].forEach((x,j)=>e.guest_write32(packed+j*4,x));[f.italic,1,1,f.charset,7,6,5,f.pitch].forEach((x,j)=>e.guest_write8(packed+20+j,x));for(let j=0;j<f.face.length;j++)if(w)e.guest_write16(packed+28+j*2,f.face.charCodeAt(j));else e.guest_write8(packed+28+j,f.face.charCodeAt(j));
  return call(w?'CreateFontIndirectW':'CreateFontIndirectA',[packed]);
 }
 for(const w of[false,true])for(const[i,f]of specs.entries()){
  if(f.onlyWide&&!w)continue;
  // Assemble control LOGFONT with scalar field stores, separately from the
  // standalone face input being tested, and use the public indirect API.
  const h=independentFont(f,w),a=observe(h);for(const q of[false,true])compare(a[q?'W':'A'],expected(f,q).toString('hex'),'literal independent control '+w+'/'+i+'/'+q);controls.set(w+'/'+i,a);assert.equal(call('DeleteObject',[h]),1);
 }
 const fragmented=0x30000000,adjacent=0x31000000,decoys=[0x28000000,0x29000000];
 for(const p of[fragmented,decoys[0],fragmented+4096,decoys[1],...Array.from({length:6},(_,i)=>fragmented+(i+2)*4096)])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(adjacent,32768)>>>0,adjacent);
 assert.equal(wa(decoys[0]),wa(fragmented)+4096);assert.equal(wa(decoys[1]),wa(fragmented+4096)+4096);assert.notEqual(wa(fragmented+4096),wa(fragmented)+4096);assert.equal(wa(adjacent+4096),wa(adjacent)+4096);
 const spans=[[wa(direct),32768],...Array.from({length:8},(_,i)=>[wa(fragmented+4096*i),4096]),...decoys.map(p=>[wa(p),4096]),[wa(adjacent),32768],[wa(0),128]];
 const backing=spans.map(([p,n])=>Buffer.from(memory.buffer,p,n)),before=backing.map(b=>Buffer.alloc(b.length));
 function query(w,index,p,label,mapping=false,retain=false,f=specs[index],oracle=controls.get(w+'/'+index)){
  spans.forEach(([s,n],i)=>mem.fill(i===spans.length-1?0:0x91+i,s,s+n));if(p)put(p,bytes(f,w));backing.forEach((b,i)=>b.copy(before[i]));
  const h=create(f,w,p);stats.queries++;const actual=observe(h);for(const q of[false,true])compare(actual[q?'W':'A'],expected(f,q).toString('hex'),label+' literal '+q,mapping);if(oracle)compare(actual,oracle,label+' independent public control',mapping);
  if(f.outputFace){const old=call('SelectObject',[dc,h]);compare(call('GetFontData',[dc,0,0,fontDataOut,sfnt.length]),sfnt.length,label+' selected CC0 sfnt length',mapping);compare(read(fontDataOut,sfnt.length),sfnt,label+' selected CC0 sfnt bytes',mapping);call('SelectObject',[dc,old]);}
  backing.forEach((b,i)=>compare(b,before[i],label+' entire physical backing '+i,mapping));assert.equal(e.guest_span_cursor_bytes(),0,label+' scratch released');assert.equal(e.guest_span_overflow_count(),0);
  if(!retain)assert.equal(call('DeleteObject',[h]),1);return h;
 }
 // Every valid ANSI byte and UTF16 byte split, including either terminator
 // byte, is independently exercised twice in each mapping mode.
 for(const w of[false,true])for(const[i,f]of specs.entries()){
  if(f.onlyWide&&!w)continue;
  query(w,i,direct+17,'direct '+w+'/'+i);
  for(let repeat=0;repeat<2;repeat++)for(let cut=1;cut<=bytes(f,w).length;cut++)for(const base of[adjacent,fragmented])query(w,i,base+4096-cut,'cut '+[w,i,repeat,cut,base],base===fragmented);
 }
 // All 4096 phases include aligned and byte-misaligned WCHARs. Localized
 // sfnt lookup covers the wide consumer before the already-safe fallback.
 for(const[w,index]of[[false,0],[true,0],[true,5]])for(let repeat=0;repeat<2;repeat++)for(let phase=0;phase<4096;phase++)for(const base of[adjacent,fragmented])query(w,index,base+phase,'phase '+[w,index,repeat,phase,base],base===fragmented);
 // Existing long-name truncation, ANSI conversion capacity, empty/NULL and
 // terminator-at-boundary behavior are preservation controls.
 for(const w of[false,true]){
  for(const length of[30,31,32,62,63,64,127,4096]){const f={...specs[1],face:'Z'.repeat(length)};for(const base of[direct,adjacent,fragmented])query(w,1,base+4093,'capacity '+[w,length,base],base===fragmented,false,f,null);}
  const f={...specs[3],face:''};for(const base of[direct,adjacent,fragmented])query(w,3,base+4095,'empty terminator '+[w,base],base===fragmented,false,f);
  // g2w(0)'s NULL sentinel has historically been an empty face. Restore it
  // after input-pattern sweeps, then require literal empty LOGFONT output.
  put(0,Buffer.alloc(4));const nullBefore=read(0,128),h=create(f,w,0),o=observe(h);for(const q of[false,true])compare(o[q?'W':'A'],expected(f,q).toString('hex'),'NULL face literal '+w+'/'+q);compare(read(0,128),nullBefore,'NULL sentinel unchanged '+w);assert.equal(call('DeleteObject',[h]),1);
  const net=e.heap_stat(0)-e.heap_stat(1);put(fragmented+4093,bytes(specs[0],w));for(let i=0;i<64;i++){const h=create(specs[0],w,fragmented+4093);assert.ok(h);assert.equal(call('DeleteObject',[h]),1);assert.equal(e.guest_span_cursor_bytes(),0);}compare(Number(e.heap_stat(0)-e.heap_stat(1)-net),0,'repeated create/delete balance '+w);
 }
 // Exercise actual long-name family matches, including a string larger than
 // the 16 KiB span arena. Truncating a gather to 32/64 WCHARs loses these.
 for(const face of longAliases){const f={...specs[5],face};for(let repeat=0;repeat<2;repeat++)for(const base of[direct,adjacent,fragmented])query(true,5,base+4093,'long alias '+[face.length,repeat,base],base===fragmented,false,f,null);}
 // A caller may already own a span. A valid face must not acquire an arena
 // overflow trap or consume/release that earlier lease. Inputs and its bytes
 // remain borrowed only for their original lifetime.
 for(const w of[false,true]){put(fragmented+4093,bytes(specs[0],w));const lease=e.ff_hold_span(fragmented+4093,16380)>>>0;assert.equal(e.guest_span_cursor_bytes(),16380);const held=Buffer.from(mem.subarray(lease,lease+16380));let h;
  try{h=create(specs[0],w,fragmented+4093);const o=observe(h);for(const q of[false,true])compare(o[q?'W':'A'],expected(specs[0],q).toString('hex'),'occupied arena literal '+w+'/'+q,true);assert.equal(e.guest_span_cursor_bytes(),16380);assert.deepEqual(Buffer.from(mem.subarray(lease,lease+16380)),held);assert.equal(e.guest_span_overflow_count(),0);}finally{if(h)assert.equal(call('DeleteObject',[h]),1);e.ff_drop_span(lease,16380);}assert.equal(e.guest_span_cursor_bytes(),0);
 }
 function target(){const dc=call('CreateCompatibleDC',[0]);put(bmi,Buffer.alloc(40));e.guest_write32(bmi,40);e.guest_write32(bmi+4,32);e.guest_write32(bmi+8,-32);e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);const bitmap=call('CreateDIBSection',[dc,bmi,0,out,0,0]),bits=e.guest_read32(out)>>>0;assert.ok(bitmap&&bits);return{dc,bitmap,bits,oldBitmap:call('SelectObject',[dc,bitmap])};}
 const a=target(),b=target(),terminal=query(false,0,fragmented+4093,'draw ANSI',true,true),terminalW=query(true,0,fragmented+4091,'draw wide',true,true),bar=str('\xb3');
 a.oldFont=call('SelectObject',[a.dc,terminal]);b.oldFont=call('SelectObject',[b.dc,terminalW]);for(const t of[a,b]){call('SetBkMode',[t.dc,1]);call('SetTextColor',[t.dc,0]);}
 const pixels=t=>Buffer.from(memory.buffer,wa(t.bits),4096);
 function state(t){return[call('GetCurrentObject',[t.dc,6]),call('GetTextCharset',[t.dc]),call('GetTextColor',[t.dc]),call('GetBkMode',[t.dc]),call('GetClipBox',[t.dc,out]),read(out,16).toString('hex')];}
 const independent=state(b);
 function draw(label,clip,color,mapping=true){const saved=state(a);pixels(a).fill(255);pixels(b).fill(255);const pre=Buffer.from(memory.buffer,wa(a.bits)-16,16),preCopy=Buffer.from(pre),post=Buffer.from(memory.buffer,wa(a.bits)+4096,16),postCopy=Buffer.from(post);assert.equal(call('TextOutA',[a.dc,3,4,bar,1]),1);const literal=Buffer.alloc(4096,255);
  // Pinned ANAKRON Terminal CP437 box-drawing vertical: column4 of an 8x12
  // cell. This literal oracle detects a different selected bitmap family.
  for(let y=Math.max(4,clip[1]);y<Math.min(16,clip[3]);y++)if(7>=clip[0]&&7<clip[2]){const j=(y*32+7)*4;literal[j]=color>>>16&255;literal[j+1]=color>>>8&255;literal[j+2]=color&255;literal[j+3]=0;}
  compare(pixels(a),literal,label+' literal DIB',mapping);compare(pixels(b),Buffer.alloc(4096,255),label+' independent DIB');compare(state(a),saved,label+' state');compare(state(b),independent,label+' independent DC');assert.deepEqual(pre,preCopy);assert.deepEqual(post,postCopy);stats.pixelControls++;if(options.capture)options.capture(label,Buffer.from(pixels(a)),32,32);
 }
 const controlTerminal=independentFont(specs[0],false);call('SelectObject',[a.dc,controlTerminal]);draw('independent Terminal',[0,0,32,32],0,false);call('SelectObject',[a.dc,terminal]);assert.equal(call('DeleteObject',[controlTerminal]),1);
 const original=state(a);draw('initial',[0,0,32,32],0);assert.equal(call('SaveDC',[a.dc]),1);call('SetTextColor',[a.dc,0x00336699]);assert.equal(call('IntersectClipRect',[a.dc,5,6,10,14]),2);const outer=state(a);assert.equal(call('SaveDC',[a.dc]),2);call('SelectObject',[a.dc,terminalW]);call('SetTextColor',[a.dc,0x00663399]);assert.equal(call('IntersectClipRect',[a.dc,6,8,9,12]),2);const inner=state(a);
 for(const[saved,clip,color,label]of[[inner,[6,8,9,12],0x00663399,'inner'],[outer,[5,6,10,14],0x00336699,'outer']]){query(true,1,fragmented+4095,label+' unrelated creation',true);compare(state(a),saved,label+' creation preserves selected font');draw(label,clip,color);assert.equal(call('RestoreDC',[a.dc,-1]),1);}compare(state(a),original,'nested restored');draw('restored',[0,0,32,32],0);
 const sampleW=str('A',true),checker=['10101','01010','11111','01010','10101'];
 for(const face of[null,specs[5].face,...longAliases]){
  const f={...specs[5],face:face||specs[5].face},font=face===null?independentFont(specs[5],true):query(true,5,fragmented+4093,'CC0 DIB family '+face.length,true,true,f,null);call('SelectObject',[a.dc,font]);
  for(const w of[false,true]){pixels(a).fill(255);pixels(b).fill(255);const literal=Buffer.alloc(4096,255);assert.equal(call(w?'TextOutW':'TextOutA',[a.dc,8,4,w?sampleW:sample,1]),1);
   // Original CC0 A has bearingX=-1, bearingY=7, 5x5 pixels, advance9.
   // At 12ppem the literal hhea ascent800/upem1000 maps to10 pixels.
   checker.forEach((row,y)=>[...row].forEach((bit,x)=>{if(bit==='1')literal.fill(0,((7+y)*32+7+x)*4,((7+y)*32+7+x)*4+4);}));
   compare(pixels(a),literal,'CC0 literal TextOut '+w+'/'+(face===null?'independent':face.length),face!==null);compare(pixels(b),Buffer.alloc(4096,255),'CC0 independent DC pixels');compare(state(b),independent,'CC0 independent DC state');stats.pixelControls++;if(options.capture)options.capture('CC0-'+w+'-'+(face===null?'independent':face.length),Buffer.from(pixels(a)),32,32);
  }
  call('SelectObject',[a.dc,terminal]);assert.equal(call('DeleteObject',[font]),1);
 }
 for(const t of[a,b]){call('SelectObject',[t.dc,t.oldFont]);call('SelectObject',[t.dc,t.oldBitmap]);assert.equal(call('DeleteObject',[t.bitmap]),1);assert.equal(call('DeleteDC',[t.dc]),1);}for(const h of[terminal,terminalW])assert.equal(call('DeleteObject',[h]),1);assert.equal(call('DeleteDC',[dc]),1);
 // Real object table exhaustion and real heap pressure verify every cleanup
 // path without replacing heap_alloc or font policy with test stubs.
 const live=[],face=str('Terminal'),objectNet=e.heap_stat(0)-e.heap_stat(1);
 try{let h;while((h=create(specs[0],false,face))){live.push(h);assert.ok(live.length<2048);}const net=e.heap_stat(0)-e.heap_stat(1);for(const w of[false,true]){put(fragmented+4093,bytes(specs[0],w));for(let i=0;i<3;i++){compare(create(specs[0],w,fragmented+4093),0,'object pressure '+w);assert.equal(e.guest_span_cursor_bytes(),0);}}compare(Number(e.heap_stat(0)-e.heap_stat(1)-net),0,'object failure cleanup');stats.objectExhaustion=live.length;}finally{for(const h of live)assert.equal(call('DeleteObject',[h]),1);}compare(Number(e.heap_stat(0)-e.heap_stat(1)-objectNet),0,'object pressure released');
 const pressure=[],hole=e.guest_alloc(64)>>>0;assert.ok(hole);
 try{for(const size of[8*1024*1024,65536,4096,1024,256,64,32]){let n=0,p;while((p=e.guest_alloc(size)>>>0)){pressure.push(p);assert.ok(++n<2000000,'finite real allocator pressure '+size);
}console.log('pressure size='+size+' blocks='+n);}
  for(const w of[false,true]){put(fragmented+4093,bytes(specs[0],w));backing.forEach((b,i)=>b.copy(before[i]));const net=e.heap_stat(0)-e.heap_stat(1);for(let i=0;i<3;i++){compare(create(specs[0],w,fragmented+4093),0,'heap pressure '+w);assert.equal(e.guest_span_cursor_bytes(),0);}compare(Number(e.heap_stat(0)-e.heap_stat(1)-net),0,'heap failure cleanup '+w);backing.forEach((b,i)=>compare(b,before[i],'failure input unchanged '+w+'/'+i));}
  e.guest_free(hole);put(fragmented+4093,bytes(specs[0],true));const allocs=e.heap_stat(0),frees=e.heap_stat(1);for(let i=0;i<3;i++)compare(create(specs[0],true,fragmented+4093),0,'wide owned-face failure after conversion allocation');compare(Number(e.heap_stat(0)-allocs),3,'real conversion allocations');compare(Number(e.heap_stat(1)-frees),3,'conversion allocations freed');
  // The same real 64-byte hole permits conversion but cannot hold the long
  // lookup input; every such failure must return that conversion allocation.
  put(fragmented+4093,bytes({...specs[5],face:longAliases.at(-1)},true));const longAllocs=e.heap_stat(0),longFrees=e.heap_stat(1);for(let i=0;i<3;i++){compare(create(specs[5],true,fragmented+4093),0,'long gather failure frees conversion');assert.equal(e.guest_span_cursor_bytes(),0);}compare(Number(e.heap_stat(0)-longAllocs),3,'long failure conversion allocations');compare(Number(e.heap_stat(1)-longFrees),3,'long failure conversion frees');
 }finally{for(const p of pressure)e.guest_free(p);}
 console.log(JSON.stringify(stats));return stats;
}
module.exports={run,specs,expected,bytes,extendedFixture,longAliases};
if(require.main===module)run().then(s=>{assert.equal(s.controlFailures,0);assert.equal(s.mappingFailures,0);console.log('PASS CreateFontA/W face input mapping and public ABI');}).catch(e=>{console.error(e);process.exitCode=1;});
