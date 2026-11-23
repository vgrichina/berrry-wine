#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),{bootRenderHarness}=require(path.join(root,'test/render-helper'));
const apiTable=require(path.join(root,'src/api_table.json'));
// Win32: GLYPHMETRICS is 20 bytes, MAT2 is four 16.16 FIXED values.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getglyphoutlinea
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-glyphmetrics
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-mat2
const extraWat=String.raw`
 (func (export "gm_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
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
const identity=Buffer.from('00000100000000000000000000000100','hex');
const metrics=Buffer.from('0600000007000000010000000800000008000000','hex');
const bitmap=Buffer.from('300000004800000084000000fc000000840000008400000084000000','hex');
async function run(options={}){
 const stats={calls:0,queries:0,comparisons:0,mappingFailures:0,controlFailures:0,pixelControls:0,examples:[],compatibility:[]};
 function compare(a,b,label,mapping=false){stats.comparisons++;if(Buffer.isBuffer(a)?a.equals(b):JSON.stringify(a)===JSON.stringify(b))return;stats[mapping?'mappingFailures':'controlFailures']++;if(stats.examples.length<24){let first=0;if(Buffer.isBuffer(a))while(first<a.length&&a[first]===b[first])first++;stats.examples.push({label,first,actual:Buffer.isBuffer(a)?a.subarray(first,first+20).toString('hex'):a,expected:Buffer.isBuffer(b)?b.subarray(first,first+20).toString('hex'):b});}}
 const{exports:e,memory,hostCtx}=await bootRenderHarness({extraWat,width:32,height:32});
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
 function query(name,gm,mat,mode=0,size=0,bp=buffer,want={result:0,gm:metrics,buffer:null},target=dc,matrix=identity){
  spans.forEach(([p,n],i)=>mem.fill(0x91+i,p,p+n));if(gm)put(gm,Buffer.alloc(20,0xa7));if(mat)put(mat,matrix);actual.forEach((b,i)=>b.copy(expected[i]));
  if(gm&&want.gm)expectedPut(gm,want.gm);if(bp&&want.buffer)expectedPut(bp,want.buffer);
  const mapped=(gm>=base&&gm<base+16384)||(mat>=base&&mat<base+16384);
  e.gm_seed_error();compare(call(name,[target,65,mode,gm,size,bp,mat]),want.result,name+' mode '+mode+' return',mapped);compare(e.test_get_last_error()>>>0,0x1234abcd,name+' last error');stats.queries++;
  for(let i=0;i<actual.length;i++)compare(actual[i],expected[i],name+' '+mode+' GM '+gm.toString(16)+' MAT '+mat.toString(16)+' entire backing '+i,mapped);
 }
 for(const name of ['GetGlyphOutlineA','GetGlyphOutlineW']){
  query(name,direct+17,direct+128);query(name,direct+17,0);query(name,0,direct+128,0,0,buffer,{result:0xffffffff,gm:null,buffer:null});
  query(name,direct+17,direct+128,0,0xffffffff);query(name,direct+17,direct+128,0,0xffffffff,0);
  for(let repeat=0;repeat<2;repeat++)for(let phase=0;phase<4096;phase++)for(const start of [adjacent,base]){
   query(name,start+phase,direct+128);query(name,direct+17,start+phase);
   if(phase>=4076)query(name,start+phase,start+8192+phase);
  }
  // Every byte/DWORD cut for metrics and MAT2, plus repeated bitmap output.
  for(let cut=1;cut<20;cut++)for(const start of [adjacent,base]){
   query(name,start+4096-cut,start+12280,1,96,buffer,{result:28,gm:metrics,buffer:bitmap});
   query(name,start+4096-cut,start+12280,1,27,buffer,{result:0xffffffff,gm:metrics,buffer:null});
  }
  const transform=Buffer.from(identity);transform.writeUInt32LE(0x20000,0);
  for(let cut=1;cut<16;cut++)for(const start of [adjacent,base])query(name,start+4087,start+12288-cut,0,96,buffer,{result:0xffffffff,gm:null,buffer:null},dc,transform);
  for(const mode of [1,2,3,4,5,6,7,128,129,256,257,512,0xffffffff]){
   // The contiguous current implementation is a compatibility control only;
   // GGO_METRICS above always uses the independent literal oracle.
   spans.forEach(([p,n],i)=>mem.fill(0x91+i,p,p+n));put(direct+17,Buffer.alloc(20,0xa7));put(direct+128,identity);
   const result=call(name,[dc,65,mode,direct+17,96,buffer,direct+128]);
   const control={result,gm:read(direct+17,20),buffer:read(buffer,96)};
   stats.compatibility.push({name,mode,result,gm:control.gm.toString('hex'),buffer:control.buffer.toString('hex')});
   for(const start of [adjacent,base])query(name,start+4087,start+12281,mode,96,buffer,control);
  }
 }
 // Public TextOut on a fresh DIB, checked pixel by pixel against literal rows.
 put(bmi,Buffer.alloc(40));e.guest_write32(bmi,40);e.guest_write32(bmi+4,32);e.guest_write32(bmi+8,-32);e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);
 const dib=call('CreateDIBSection',[dc,bmi,0,out,0,0]);assert.ok(dib);const bits=e.guest_read32(out)>>>0,oldBitmap=call('SelectObject',[dc,dib]);call('SetBkMode',[dc,1]);call('SetTextColor',[dc,0]);
 const text=str('A'),wideText=str('A',true),literal=Buffer.alloc(4096,255),rows=[0x18,0x24,0x42,0x7e,0x42,0x42,0x42,0];
 for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(rows[y]&(128>>x))literal.fill(0,((y+3)*32+x+2)*4,((y+3)*32+x+2)*4+3);
 function draw(label){for(const wide of [false,true]){mem.fill(255,wa(bits),wa(bits)+4096);assert.equal(call(wide?'TextOutW':'TextOutA',[dc,2,3,wide?wideText:text,1]),1);const pixels=Buffer.from(mem.subarray(wa(bits),wa(bits)+4096));for(let i=3;i<pixels.length;i+=4)pixels[i]=255;compare(pixels,literal,label+' literal pixels');stats.pixelControls++;if(options.capture)options.capture(label+(wide?'-W':'-A'),pixels,32,32);}}
 draw('fresh');assert.equal(call('GetTextMetricsA',[dc,metric]),1);compare(e.guest_read32(metric),8,'literal font height');compare(e.guest_read32(metric+4),8,'literal font ascent');compare(e.guest_read32(metric+20),8,'literal average width');
 const independent=call('GetCurrentObject',[dc2,6]),s1=call('SaveDC',[dc]),s2=call('SaveDC',[dc]);assert.ok(s1&&s2);call('SelectObject',[dc,independent]);assert.equal(call('RestoreDC',[dc,-1]),1);compare(call('GetCurrentObject',[dc,6]),font,'nested restored font');draw('nested');assert.equal(call('RestoreDC',[dc,s1]),1);draw('outer');compare(call('GetCurrentObject',[dc2,6]),independent,'independent DC font');
 // Existing scalable glyph modes use their own contiguous baseline. Preserve
 // every metrics/payload byte for sizing, short buffers and full buffers,
 // including transformed, indexed, gray, native and unsupported formats.
 const ttfont=call('CreateFontW',[-12,0,0,0,400,0,0,0,0,0,0,0,0,str('Arial',true)]);assert.ok(ttfont);assert.equal(call('SelectObject',[dc,ttfont]),font);
 const shear=Buffer.from(identity);shear.writeUInt32LE(0x4000,8);
 for(const name of ['GetGlyphOutlineA','GetGlyphOutlineW'])for(const matrix of [identity,shear])for(const mode of [0,1,2,3,4,5,6,128,129,130,256,257,258,512])for(const size of [0,1,4096]){
  spans.forEach(([p,n],i)=>mem.fill(0x91+i,p,p+n));put(direct+17,Buffer.alloc(20,0xa7));put(direct+128,matrix);
  const result=call(name,[dc,65,mode,direct+17,size,buffer,direct+128]),control={result,gm:read(direct+17,20),buffer:read(buffer,4096)};
  stats.compatibility.push({font:'Arial',name,mode,size,matrix:matrix.toString('hex'),result,gm:control.gm.toString('hex'),bufferSHA256:crypto.createHash('sha256').update(control.buffer).digest('hex')});
  for(const start of [adjacent,base])query(name,start+4087,start+12279,mode,size,buffer,control,dc,matrix);
 }
 assert.equal(call('SelectObject',[dc,font]),ttfont);assert.equal(call('DeleteObject',[ttfont]),1);
 call('SelectObject',[dc,oldBitmap]);call('SelectObject',[dc,old]);assert.equal(call('DeleteObject',[dib]),1);assert.equal(call('DeleteObject',[font]),1);assert.equal(call('DeleteDC',[dc]),1);assert.equal(call('DeleteDC',[dc2]),1);
 console.log(JSON.stringify(stats));return stats;
}
module.exports={run};if(require.main===module)run().then(s=>{assert.equal(s.controlFailures,0);assert.equal(s.mappingFailures,0);console.log('PASS GetGlyphOutline A/W fixed structure mapping');}).catch(e=>{console.error(e);process.exitCode=1;});
