#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),{bootRenderHarness}=require(path.join(root,'test/render-helper'));
const apiTable=require(path.join(root,'src/api_table.json'));
// Glyph output is DWORD-aligned by row; fixed metrics and MAT2 are controls.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getglyphoutlinea
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-glyphmetrics
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-mat2
const extraWat=String.raw`
 (func (export "gm_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "gb_heap_alloc") (param i32) (result i32) (call $heap_alloc (local.get 0)))
 (func (export "gb_heap_free") (param i32) (call $heap_free (local.get 0)))
 (func (export "gm_regs") (result i32) (global.get $reg_base))
 (func (export "gm_seed_error") (global.set $last_error (i32.const 0x1234abcd)))
 (func (export "gm_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "gm_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "gm_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
`;
// Independent original FNT 2.0: one 8x8 cell, ascent 8. The literal A has
// black box (1,0)..(6,6), giving 6x7, origin (1,8), advance (8,0).
function fixture(){
 const b=Buffer.alloc(146);b.writeUInt16LE(0x200);b.writeUInt32LE(b.length,2);
 b.writeUInt16LE(8,74);b.writeUInt16LE(400,83);b.writeUInt16LE(8,88);
 b.writeUInt16LE(8,91);b.writeUInt16LE(8,93);b[95]=65;b[96]=65;
 b.writeUInt32LE(134,105);b.writeUInt16LE(8,118);b.writeUInt16LE(126,120);b.writeUInt16LE(134,124);
 b.set([0x18,0x24,0x42,0x7e,0x42,0x42,0x42,0],126);b.write('GlyphPinned\0',134,'latin1');return b;
}
// Original native 1024x256 FNT, stored in FNT byte-column order. Its literal
// A has a 768x224 black box, x origin128, ascent256 and advance1024.
function largeFixture(){
 const end=126+128*256,b=Buffer.alloc(end+11);fixture().subarray(0,126).copy(b);
 b.writeUInt32LE(b.length,2);for(const p of [74,88])b.writeUInt16LE(256,p);for(const p of [91,93,118])b.writeUInt16LE(1024,p);
 b.writeUInt32LE(end,105);b.writeUInt16LE(end,124);b.write('GlyphLarge\0',end,'latin1');
 for(let x=0;x<1024;x++)for(let y=0;y<256;y++)if([0x18,0x24,0x42,0x7e,0x42,0x42,0x42,0][y>>5]&(128>>(x>>7)))b[126+(x>>3)*256+y]|=128>>(x&7);return b;
}
const identity=Buffer.from('00000100000000000000000000000100','hex');
const metrics=Buffer.from('0600000007000000010000000800000008000000','hex');
const bitmap=Buffer.from('300000004800000084000000fc000000840000008400000084000000','hex');
async function run(options={}){
 const stats={calls:0,queries:0,comparisons:0,mappingFailures:0,controlFailures:0,pixelControls:0,examples:[],controlExamples:[],failureLabels:{},compatibility:[]};
 function compare(a,b,label,mapping=false){stats.comparisons++;if(Buffer.isBuffer(a)?a.equals(b):JSON.stringify(a)===JSON.stringify(b))return;stats[mapping?'mappingFailures':'controlFailures']++;stats.failureLabels[(mapping?'mapping:':'control:')+label]=(stats.failureLabels[(mapping?'mapping:':'control:')+label]||0)+1;if((mapping?stats.examples:stats.controlExamples).length<24){let first=0;if(Buffer.isBuffer(a))while(first<a.length&&a[first]===b[first])first++;(mapping?stats.examples:stats.controlExamples).push({label,first,actual:Buffer.isBuffer(a)?a.subarray(first,first+20).toString('hex'):a,expected:Buffer.isBuffer(b)?b.subarray(first,first+20).toString('hex'):b});}}
 const{exports:e,memory,hostCtx}=await bootRenderHarness({extraWat,width:32,height:32});
 const ttfile=fs.readFileSync(path.join(root,'test/fixtures/ttc-ebdt/bitmap.ttf'));assert.equal(crypto.createHash('sha256').update(ttfile).digest('hex'),'d3592211c34594d3bb37e72c987dd05cd01f2c47210f508639ad43d4f1ebc81d');hostCtx.vfs.files.set('c:\\windows\\fonts\\gb-fixture.ttf',{data:new Uint8Array(ttfile),attrs:0x20});
 const fnt=fixture();assert.equal(crypto.createHash('sha256').update(fnt).digest('hex'),'6699e8edb470e30c5bf39ffc711f5ebaae45eb27f7d3206362d0bb30242d9cb6');hostCtx.vfs.files.set('c:\\glyphpinned.fon',{data:new Uint8Array(fnt),attrs:0x20});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.gm_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),v=new DataView(memory.buffer),regs=e.gm_regs()>>>0;
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
 const put=(p,b)=>b.forEach((x,i)=>e.guest_write8(p+i,x));
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));
 const str=(s,wide=false)=>{const b=Buffer.from(s+'\0',wide?'utf16le':'latin1'),p=alloc(b.length);put(p,b);return p;};
 const frame=alloc(256),stack=frame+64,other=alloc(64),direct=alloc(8192),buffer=alloc(4096),bmi=alloc(40),out=alloc(4),metric=alloc(64);
 v.setUint32(regs+16,stack,true);const module=e.gm_module(str('GDI32.DLL'))>>>0;assert.ok(module);
 const entries=new Map();
 for(const name of ['GetGlyphOutlineA','GetGlyphOutlineW','CreateFontA','CreateFontW','AddFontResourceA','CreateCompatibleDC','DeleteDC','SelectObject','DeleteObject','SaveDC','RestoreDC','GetCurrentObject','CreateDIBSection','TextOutA','TextOutW','SetBkMode','SetTextColor','GetTextMetricsA']){
  v.setUint32(regs+16,stack,true);const thunk=e.gm_resolve(module,str(name))>>>0,row=apiTable.find(r=>r.name===name);assert.ok(thunk,name);assert.equal(row.convention,'stdcall');assert.equal(e.guest_read32(thunk+4),row.id);entries.set(name,{thunk,nargs:row.nargs});
 }
 function call(name,args){
  const entry=entries.get(name);assert.equal(args.length,entry.nargs);mem.fill(0x5a,wa(frame),wa(frame)+256);e.guest_write32(stack,0x12345678);args.forEach((x,i)=>e.guest_write32(stack+4+i*4,x));
  const before=read(frame,256),untouched=read(other,64),seed=[0xa0123456,0x11223344,0x22334455,0x33445566,stack,0x44556677,0x55667788,0x66778899];seed.forEach((x,i)=>v.setUint32(regs+i*4,x,true));
  e.gm_call(entry.thunk);stats.calls++;assert.equal(e.get_esp()>>>0,stack+4+args.length*4,name+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,name+' EIP');for(const i of [1,2,3,5,6,7])assert.equal(v.getUint32(regs+i*4,true),seed[i],name+' register '+i);assert.deepEqual(read(frame,256),before,name+' entire stack');assert.deepEqual(read(other,64),untouched);assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);return e.get_eax()>>>0;
 }
 assert.equal(call('AddFontResourceA',[str('C:\\GLYPHPINNED.FON')]),1);
 const font=call('CreateFontA',[-8,0,0,0,400,0,0,0,0,0,0,0,0,str('GlyphPinned')]);assert.ok(font);
 const dc=call('CreateCompatibleDC',[0]),dc2=call('CreateCompatibleDC',[0]);assert.ok(dc&&dc2);const old=call('SelectObject',[dc,font]);
 const base=0x30000000,adjacent=0x31000000,decoys=[0x28000000,0x29000000];
 for(const p of [base,decoys[0],base+4096,base+8192,decoys[1],base+12288])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(adjacent,16384)>>>0,adjacent);assert.equal(wa(decoys[0]),wa(base)+4096);assert.equal(wa(decoys[1]),wa(base+8192)+4096);assert.notEqual(wa(base+4096),wa(base)+4096);assert.notEqual(wa(base+12288),wa(base+8192)+4096);
 const spans=[[wa(direct),8192],...[0,1,2,3].map(i=>[wa(base+i*4096),4096]),...decoys.map(p=>[wa(p),4096]),[wa(adjacent),16384],[wa(buffer),4096],[wa(0),64]];
 const actual=spans.map(([p,n])=>Buffer.from(mem.buffer,p,n)),expected=spans.map(([,n])=>Buffer.alloc(n));
 function expectedPut(p,b){for(let j=0;j<b.length;j++){const a=wa(p+j),i=spans.findIndex(([s,n])=>a>=s&&a<s+n);assert.ok(i>=0);expected[i][a-spans[i][0]]=b[j];}}
 function query(name,gm,mat,mode=0,size=0,bp=buffer,want={result:0,gm:metrics,buffer:null},target=dc,matrix=identity,character=65){
  spans.forEach(([p,n],i)=>mem.fill(0x91+i,p,p+n));
  // g2w misses clear the emulator's private four-byte NULL sentinel, including
  // allocator pressure diagnostics. Start that private scratch in its normal
  // zero state; all guest backing pages and both decoys remain fully checked.
  mem.fill(0,spans[9][0],spans[9][0]+4);
  if(gm)put(gm,Buffer.alloc(20,0xa7));if(mat)put(mat,matrix);if(bp)put(bp,Buffer.alloc(128,0xad));actual.forEach((b,i)=>b.copy(expected[i]));
  if(gm&&want.gm)expectedPut(gm,want.gm);if(bp&&want.buffer)expectedPut(bp,want.buffer);
  const mapped=(bp>=base&&bp<base+16384)||(gm>=base&&gm<base+16384)||(mat>=base&&mat<base+16384);
  e.gm_seed_error();compare(call(name,[target,character,mode,gm,size,bp,mat]),want.result,name+' mode '+mode+' return',mapped);compare(e.test_get_last_error()>>>0,0x1234abcd,name+' last error');stats.queries++;
  for(let i=0;i<actual.length;i++)compare(actual[i],expected[i],name+' '+mode+' GM '+gm.toString(16)+' MAT '+mat.toString(16)+' entire backing '+i,mapped);
 }

 // Literal bitmap payload, checked against every backing byte including two
 // unrelated physical continuations. No call result supplies this oracle.
 for(const name of ['GetGlyphOutlineA','GetGlyphOutlineW']){
  for(let repeat=0;repeat<2;repeat++)for(let phase=0;phase<4096;phase++)for(const start of [adjacent,base])
   query(name,direct+17,direct+128,1,28,start+phase,{result:28,gm:metrics,buffer:bitmap});
  for(let cut=1;cut<bitmap.length;cut++)for(const start of [adjacent,base])for(const size of [0,1,27,28,29,0x7fffffff,0xffffffff])
   query(name,start+8209,start+12312,1,size,start+4096-cut,{result:size===0?28:size<28?0xffffffff:28,gm:metrics,buffer:size>=28?bitmap:null});
  for(const size of [0,1,27,28,0xffffffff])query(name,direct+17,direct+128,1,size,0,{result:28,gm:metrics,buffer:null});
  query(name,direct+17,0,1,28,base+4091,{result:28,gm:metrics,buffer:bitmap});
  for(const start of [adjacent,base])for(let cut=1;cut<20;cut++)query(name,start+8192+4096-cut,direct+128,1,28,start+4090,{result:28,gm:metrics,buffer:bitmap});
  for(const start of [adjacent,base])for(let cut=1;cut<16;cut++)query(name,direct+17,start+12288-cut,1,28,start+4091,{result:28,gm:metrics,buffer:bitmap});
  for(const mode of [0,2,3,4,5,6,7,128,129,256,257,512,0xffffffff]){
   const success=mode===0||mode===256,mono=mode===257;
   query(name,direct+17,direct+128,mode,0xffffffff,base+4091,{result:success?0:mono?28:0xffffffff,gm:success||mono?metrics:null,buffer:mono?bitmap:null});
  }
  query(name,0,direct+128,1,0xffffffff,base+4091,{result:0xffffffff,gm:null,buffer:null});
  const transform=Buffer.from(identity);transform.writeUInt32LE(0x20000,0);
  query(name,direct+17,direct+128,1,28,base+4091,{result:0xffffffff,gm:null,buffer:null},dc,transform);
 }
 // Public TextOut on a fresh DIB, checked pixel by pixel against literal rows.
 put(bmi,Buffer.alloc(40));e.guest_write32(bmi,40);e.guest_write32(bmi+4,32);e.guest_write32(bmi+8,-32);e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);
 const dib=call('CreateDIBSection',[dc,bmi,0,out,0,0]);assert.ok(dib);const bits=e.guest_read32(out)>>>0,oldBitmap=call('SelectObject',[dc,dib]);call('SetBkMode',[dc,1]);call('SetTextColor',[dc,0]);
 const text=str('A'),wideText=str('A',true),literal=Buffer.alloc(4096,255),rows=[0x18,0x24,0x42,0x7e,0x42,0x42,0x42,0];
 for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(rows[y]&(128>>x))literal.fill(0,((y+3)*32+x+2)*4,((y+3)*32+x+2)*4+3);
 function draw(label){for(const wide of [false,true]){mem.fill(255,wa(bits),wa(bits)+4096);assert.equal(call(wide?'TextOutW':'TextOutA',[dc,2,3,wide?wideText:text,1]),1);const pixels=Buffer.from(mem.subarray(wa(bits),wa(bits)+4096));for(let i=3;i<pixels.length;i+=4)pixels[i]=255;compare(pixels,literal,label+' literal pixels');stats.pixelControls++;if(options.capture)options.capture(label+(wide?'-W':'-A'),pixels,32,32);}}
 draw('fresh');assert.equal(call('GetTextMetricsA',[dc,metric]),1);compare(e.guest_read32(metric),8,'literal font height');compare(e.guest_read32(metric+4),8,'literal font ascent');compare(e.guest_read32(metric+20),8,'literal average width');
 const independent=call('GetCurrentObject',[dc2,6]),s1=call('SaveDC',[dc]),s2=call('SaveDC',[dc]);assert.ok(s1&&s2);call('SelectObject',[dc,independent]);assert.equal(call('RestoreDC',[dc,-1]),1);compare(call('GetCurrentObject',[dc,6]),font,'nested restored font');draw('nested');assert.equal(call('RestoreDC',[dc,s1]),1);draw('outer');compare(call('GetCurrentObject',[dc2,6]),independent,'independent DC font');


 // A second independently owned surface retains its own font, pixels and
 // nested save stack while the first DC changes and restores its font.
 const dib2=call('CreateDIBSection',[dc2,bmi,0,out,0,0]);assert.ok(dib2);const bits2=e.guest_read32(out)>>>0,oldBitmap2=call('SelectObject',[dc2,dib2]),oldFont2=call('SelectObject',[dc2,font]);assert.notEqual(bits2,bits);call('SetBkMode',[dc2,1]);call('SetTextColor',[dc2,0]);
 const keepDC1=read(bits,4096),save1=call('SaveDC',[dc]),save2=call('SaveDC',[dc2]),save2nested=call('SaveDC',[dc2]);assert.ok(save1&&save2&&save2nested);call('SelectObject',[dc,independent]);
 for(const wide of [false,true]){mem.fill(255,wa(bits2),wa(bits2)+4096);assert.equal(call(wide?'TextOutW':'TextOutA',[dc2,2,3,wide?wideText:text,1]),1);const pixels=read(bits2,4096);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;compare(pixels,literal,'second independent DC literal '+wide);compare(read(bits,4096),keepDC1,'second DC leaves first pixels intact');stats.pixelControls++;}
 assert.equal(call('RestoreDC',[dc2,-1]),1);compare(call('GetCurrentObject',[dc,6]),independent,'second restore leaves first selected font');assert.equal(call('RestoreDC',[dc,save1]),1);compare(call('GetCurrentObject',[dc2,6]),font,'first restore leaves second font');assert.equal(call('RestoreDC',[dc2,save2]),1);call('SelectObject',[dc2,oldFont2]);call('SelectObject',[dc2,oldBitmap2]);assert.equal(call('DeleteObject',[dib2]),1);
 // The committed CC0 fixture has an unhinted rectangle (100,0)..(400,700)
 // at 1000 units/em. 10ppem puts every edge on a pixel: 3x7, advance6.
 // Native output is the literal closed contour, in the existing pixel FIXED
 // format; gray rows have three fully covered samples and one padding byte.
 const ttfont=call('CreateFontA',[-10,0,0,0,400,0,0,0,0,0,0,0,0,str('Fixture Bitmap')]);assert.ok(ttfont);assert.equal(call('SelectObject',[dc,ttfont]),font);
 const ttmetrics=Buffer.from('0300000007000000010000000700000006000000','hex');
 const native=Buffer.alloc(64);native.writeUInt32LE(64);native.writeUInt32LE(24,4);native.writeInt32LE(1<<16,8);
 [[4,0],[4,7],[1,7],[1,0]].forEach(([x,y],i)=>{const p=16+i*12;native.writeUInt16LE(1,p);native.writeUInt16LE(1,p+2);native.writeInt32LE(x<<16,p+4);native.writeInt32LE(y<<16,p+8);});
 const ttmono=Buffer.from('e0000000'.repeat(7),'hex');
 for(const [mode,payload]of [[1,ttmono],[2,native],...[4,5,6].map(mode=>{const b=Buffer.alloc(28),max={4:4,5:16,6:64}[mode];for(let y=0;y<7;y++)b.fill(max,y*4,y*4+3);return[mode,b];})]){
  for(const name of ['GetGlyphOutlineA','GetGlyphOutlineW']){
   const modeMetrics=Buffer.from(ttmetrics);
   // The unchanged ANSI mono fallback crops the cached strike to x=0.
   // Indexed W mono and outline/gray backends keep geometric origin x=1.
   if(mode===1&&name==='GetGlyphOutlineA')modeMetrics.writeInt32LE(0,8);
   // The whole payload, including native headers/POINTFX and gray padding,
   // comes from literal geometry, never from a contiguous helper result.
   query(name,direct+17,direct+128,mode,payload.length,direct+512,{result:payload.length,gm:modeMetrics,buffer:payload});
   for(let phase=0;phase<4096;phase++)for(const start of [adjacent,base])query(name,direct+17,direct+128,mode,payload.length,start+phase,{result:payload.length,gm:modeMetrics,buffer:payload});
   for(let cut=1;cut<payload.length;cut++)for(const start of [adjacent,base])for(const size of [0,payload.length-1,payload.length,0xffffffff])query(name,direct+17,direct+128,mode,size,start+4096-cut,{result:!size?payload.length:size<payload.length?0xffffffff:payload.length,gm:modeMetrics,buffer:size>=payload.length?payload:null});
  }
 }
 // Captured contiguous compatibility cases supplement the literal oracles.
 // Save every byte as hex so parent and candidate compare partial writes too.
 const shear=Buffer.from(identity);shear.writeUInt32LE(0x4000,8);
 for(const name of ['GetGlyphOutlineA','GetGlyphOutlineW'])for(const character of [65,32,0xffff])for(const matrix of [identity,shear])for(const mode of [0,1,2,3,4,5,6,7,128,129,130,256,257,258,512,0xffffffff])for(const size of [0,1,64,0xffffffff]){
  spans.forEach(([p,n],i)=>mem.fill(0x91+i,p,p+n));put(direct+17,Buffer.alloc(20,0xa7));put(direct+128,matrix);put(buffer,Buffer.alloc(128,0xad));
  const result=call(name,[dc,character,mode,direct+17,size,buffer,direct+128]),control={result,gm:read(direct+17,20),buffer:read(buffer,128)};
  stats.compatibility.push({name,character,matrix:matrix.toString('hex'),mode,size,result,gm:control.gm.toString('hex'),buffer:control.buffer.toString('hex')});
  for(const start of [adjacent,base])query(name,direct+17,direct+128,mode,size,start+4091,control,dc,matrix,character);
 }

 // A real payload larger than the 16KiB struct arena. Huge capacities still
 // mean exactly the helper's 21,504-byte bitmap; no caller-size allocation.
 assert.equal(call('SelectObject',[dc,font]),ttfont);
 for(const name of ['GetGlyphOutlineA','GetGlyphOutlineW']){const net=e.heap_stat(0)-e.heap_stat(1);for(let i=0;i<64;i++)query(name,direct+17,direct+128,1,28,base+4091,{result:28,gm:metrics,buffer:bitmap});compare(Number(e.heap_stat(0)-e.heap_stat(1)-net),0,'repeated mapped output allocations all freed '+name);}
 const largeFnt=largeFixture();hostCtx.vfs.files.set('c:\\glyphlarge.fon',{data:new Uint8Array(largeFnt),attrs:0x20});assert.equal(call('AddFontResourceA',[str('C:\\GLYPHLARGE.FON')]),1);
 const largeFont=call('CreateFontA',[-256,0,0,0,400,0,0,0,0,0,0,0,0,str('GlyphLarge')]);assert.ok(largeFont);assert.equal(call('SelectObject',[dc,largeFont]),font);
 const big=0x33000000,guards=[0x2a000000,0x2b000000];
 for(const p of [big,...guards,...Array.from({length:7},(_,i)=>big+(i+1)*4096)])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(wa(guards[0]),wa(big)+4096);assert.equal(wa(guards[1]),wa(big)+8192);
 const bigSpans=[...Array.from({length:8},(_,i)=>[wa(big+i*4096),4096]),...guards.map(p=>[wa(p),4096]),[wa(direct),8192]],bigActual=bigSpans.map(([p,n])=>Buffer.from(mem.buffer,p,n)),bigExpect=bigSpans.map(([,n])=>Buffer.alloc(n));
 const largeMetrics=Buffer.alloc(20);[768,224,128,256].forEach((x,i)=>largeMetrics.writeInt32LE(x,i*4));largeMetrics.writeUInt16LE(1024,16);
 const largeBitmap=Buffer.alloc(21504);for(let y=0;y<224;y++)for(let x=0;x<768;x++)if([0x18,0x24,0x42,0x7e,0x42,0x42,0x42][y>>5]&(128>>((x>>7)+1)))largeBitmap[y*96+(x>>3)]|=128>>(x&7);
 function bigPut(p,b){for(let j=0;j<b.length;j++){const a=wa(p+j),i=bigSpans.findIndex(([s,n])=>a>=s&&a<s+n);assert.ok(i>=0);bigExpect[i][a-bigSpans[i][0]]=b[j];}}
 for(const name of ['GetGlyphOutlineA','GetGlyphOutlineW']){const contiguous=alloc(21504);put(direct+17,Buffer.alloc(20,0xa7));put(direct+128,identity);put(contiguous,Buffer.alloc(21504,0xad));compare(call(name,[dc,65,1,direct+17,21504,contiguous,direct+128]),21504,'large literal contiguous size');compare(read(direct+17,20),largeMetrics,'large literal contiguous metrics');compare(read(contiguous,21504),largeBitmap,'large literal contiguous pixels');}
 for(const name of ['GetGlyphOutlineA','GetGlyphOutlineW'])for(let repeat=0;repeat<2;repeat++)for(const cut of [1,17,4095])for(const size of [0,21503,21504,0xffffffff]){
  bigActual.forEach((b,i)=>b.fill(0xb0+i));put(direct+17,Buffer.alloc(20,0xa7));put(direct+128,identity);bigActual.forEach((b,i)=>b.copy(bigExpect[i]));bigPut(direct+17,largeMetrics);if(size>=21504)bigPut(big+4096-cut,largeBitmap);
  const net=e.heap_stat(0)-e.heap_stat(1);compare(call(name,[dc,65,1,direct+17,size,big+4096-cut,direct+128]),!size?21504:size<21504?0xffffffff:21504,'large literal return',true);compare(Number(e.heap_stat(0)-e.heap_stat(1)-net),0,'large owned allocation freed');bigActual.forEach((b,i)=>compare(b,bigExpect[i],'large whole backing/two decoys '+i,true));stats.queries++;
 }
 assert.equal(call('SelectObject',[dc,font]),largeFont);assert.equal(call('DeleteObject',[largeFont]),1);
 // Legacy invalid and wrapping pointers retain their raw linear write/failure
 // behavior. The complete physical sentinel region is compared across parent
 // and candidate, rather than inferring undocumented Windows invalid writes.
 stats.invalidBaseline=[];
 for(const name of ['GetGlyphOutlineA','GetGlyphOutlineW'])for(const bp of [0,0x35000000,0xfffffff8,base+16384-5])for(const size of [0,1,27,28,0xffffffff]){
  const sentinel=Buffer.from(mem.buffer,wa(bp),128),saved=Buffer.from(sentinel);sentinel.fill(0xad);put(direct+17,Buffer.alloc(20,0xa7));put(direct+128,identity);
  try{const result=call(name,[dc,65,1,direct+17,size,bp,direct+128]);stats.invalidBaseline.push({name,bp,size,result,metrics:read(direct+17,20).toString('hex'),physical:sentinel.toString('hex')});}finally{saved.copy(sentinel);}
 }
 // Real allocator exhaustion. Every owned pressure block is released; the
 // original contiguous bitmap path needs no transport allocation and remains
 // usable. Mapped output fails without touching either guest page or decoy.
 const pressure=[],hole=e.gb_heap_alloc(28)>>>0;assert.ok(hole);
 try{
  for(const size of [8*1024*1024,65536,4096,64,32,16,1]){let count=0,p;while((p=e.gb_heap_alloc(size)>>>0)){pressure.push(p);assert.ok(++count<1000000,'finite real allocator pressure');}}
  for(const name of ['GetGlyphOutlineA','GetGlyphOutlineW'])for(let i=0;i<3;i++){
   const net=e.heap_stat(0)-e.heap_stat(1);query(name,direct+17,direct+128,1,28,base+4091,{result:0xffffffff,gm:metrics,buffer:null});compare(Number(e.heap_stat(0)-e.heap_stat(1)-net),0,'real allocation failure cleanup');
   query(name,direct+17,direct+128,1,28,buffer,{result:28,gm:metrics,buffer:bitmap});
  }
  e.gb_heap_free(hole);
  // One real output allocation can succeed, then a TrueType mono helper's
  // intermediate allocation fails. The output copy is still freed.
  assert.equal(call('SelectObject',[dc,ttfont]),font);const net=e.heap_stat(0)-e.heap_stat(1),allocs=e.heap_stat(0),frees=e.heap_stat(1);
  for(let i=0;i<3;i++)query('GetGlyphOutlineW',direct+17,direct+128,1,28,base+4091,{result:0xffffffff,gm:ttmetrics,buffer:null});
  compare(Number(e.heap_stat(0)-e.heap_stat(1)-net),0,'helper failure after owned output allocation cleanup');stats.helperFailureAllocations=Number(e.heap_stat(0)-allocs);stats.helperFailureFrees=Number(e.heap_stat(1)-frees);compare(stats.helperFailureAllocations,3,'three real allocations before helper failure');compare(stats.helperFailureFrees,3,'three real cleanup frees');
  assert.equal(call('SelectObject',[dc,font]),ttfont);
 }finally{for(const p of pressure)e.gb_heap_free(p);}
 stats.pressureBlocks=pressure.length;
 assert.equal(call('DeleteObject',[ttfont]),1);

 call('SelectObject',[dc,oldBitmap]);call('SelectObject',[dc,old]);assert.equal(call('DeleteObject',[dib]),1);assert.equal(call('DeleteObject',[font]),1);assert.equal(call('DeleteDC',[dc]),1);assert.equal(call('DeleteDC',[dc2]),1);
 console.log(JSON.stringify(stats));return stats;
}
module.exports={run};if(require.main===module)run().then(s=>{assert.equal(s.controlFailures,0);assert.equal(s.mappingFailures,0);console.log('PASS GetGlyphOutline A/W variable buffer mapping');}).catch(e=>{console.error(e);process.exitCode=1;});
