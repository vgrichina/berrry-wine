#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

// Retained original CC0 artwork: read the original SFNT/EBLC/EBDT bytes in
// JavaScript. No WAT metric helper or queried result supplies expected ABCs.
const original = fs.readFileSync(path.join(__dirname,'fixtures/ttc-ebdt/bitmap.ttf'));
assert.equal(crypto.createHash('sha256').update(original).digest('hex'),'d3592211c34594d3bb37e72c987dd05cd01f2c47210f508639ad43d4f1ebc81d');
const tables = new Map();
for(let i=0;i<original.readUInt16BE(4);i++){
 const row=12+16*i,start=original.readUInt32BE(row+8),length=original.readUInt32BE(row+12);
 assert.ok(start+length<=original.length);
 tables.set(original.toString('ascii',row,row+4),original.subarray(start,start+length));
}
function originalBitmapMetrics(glyph){
 const location=tables.get('EBLC'),data=tables.get('EBDT');
 assert.equal(location.readUInt32BE(4),1);assert.equal(location[8+44],12);assert.equal(location[8+45],12);
 const array=location.readUInt32BE(8),count=location.readUInt32BE(16);
 for(let i=0;i<count;i++){
  const row=array+8*i,first=location.readUInt16BE(row),last=location.readUInt16BE(row+2);
  if(glyph<first||glyph>last)continue;
  const sub=array+location.readUInt32BE(row+4),index=location.readUInt16BE(sub),image=location.readUInt16BE(sub+2);
  let metrics;
  if(index===2){assert.equal(image,5);metrics=location.subarray(sub+12,sub+20);}
  else{
   assert.ok(index===1||index===3);assert.ok(image===1||image===2||image===6||image===7);
   const offset= index===1 ? location.readUInt32BE(sub+8+4*(glyph-first)) : location.readUInt16BE(sub+8+2*(glyph-first));
   const start=location.readUInt32BE(sub+4)+offset;metrics=data.subarray(start,start+8);
  }
  const a=metrics.readInt8(2),b=metrics[1],advance=metrics[4];return {a,b,c:advance-a-b,advance};
 }
 throw Error('missing original bitmap glyph '+glyph);
}
function originalGlyph(code){
 const cmap=tables.get('cmap');let offset;
 for(let i=0;i<cmap.readUInt16BE(2);i++){const row=4+8*i,p=cmap.readUInt32BE(row+4);if(cmap.readUInt16BE(p)===4){offset=p;break;}}
 assert.ok(offset!==undefined);const map=cmap.subarray(offset),segments=map.readUInt16BE(6)/2;
 for(let i=0;i<segments;i++){
  const end=map.readUInt16BE(14+2*i),start=map.readUInt16BE(16+2*segments+2*i);
  if(code<start||code>end)continue;
  const delta=map.readInt16BE(16+4*segments+2*i),rangeAt=16+6*segments+2*i,range=map.readUInt16BE(rangeAt);
  if(!range)return(code+delta)&65535;
  const glyph=map.readUInt16BE(rangeAt+range+2*(code-start));return glyph?(glyph+delta)&65535:0;
 }
 return 0;
}
const originalABC=[65,66,67].map(c=>originalBitmapMetrics(originalGlyph(c)));
assert.equal(originalGlyph(0x4e46),originalGlyph(65),'original wide cmap alias');
assert.deepEqual(originalABC.map(m=>[m.a,m.b,m.c]),[[-1,5,5],[-1,5,5],[-1,5,5]]);

const extraWat = String.raw`
 (func (export "gcp_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "gcp_regs") (result i32) (global.get $reg_base))
 (func (export "gcp_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "gcp_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "gcp_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
`;
// CC0 derivative: add a single explicit legacy A/B kern pair to the original
// artwork. The glyph geometry/EBLC advances remain original. Rebuild SFNT
// offsets/checksums independently; -167/1000 em at 12ppem rounds to -2px.
function kernFixture() {
 const kern=Buffer.alloc(24);kern.writeUInt16BE(1,2);kern.writeUInt16BE(20,6);kern.writeUInt16BE(1,8);kern.writeUInt16BE(1,10);kern.writeUInt16BE(6,12);
 kern.writeUInt16BE(originalGlyph(65),18);kern.writeUInt16BE(originalGlyph(66),20);kern.writeInt16BE(-167,22);
 const entries=[...tables].map(([tag,b])=>[tag,Buffer.from(b)]).concat([['kern',kern]]).sort(([a],[b])=>a.localeCompare(b));
 const n=entries.length,power=2**Math.floor(Math.log2(n));let size=12+16*n;
 for(const [,b]of entries)size+=(b.length+3)&~3;
 const b=Buffer.alloc(size);b.writeUInt32BE(0x10000);b.writeUInt16BE(n,4);b.writeUInt16BE(power*16,6);b.writeUInt16BE(Math.log2(power),8);b.writeUInt16BE(n*16-power*16,10);
 const sum=s=>{let v=0;for(let i=0;i<s.length;i+=4)v=(v+s.readUInt32BE(i))>>>0;return v;};let cursor=12+16*n,head;
 entries.forEach(([tag,t],i)=>{const row=12+16*i;b.write(tag,row,'ascii');if(tag==='head'){t.writeUInt32BE(0,8);head=cursor;}t.copy(b,cursor);b.writeUInt32BE(sum(b.subarray(cursor,cursor+((t.length+3)&~3))),row+4);b.writeUInt32BE(cursor,row+8);b.writeUInt32BE(t.length,row+12);cursor+=(t.length+3)&~3;});
 b.writeUInt32BE((0xb1b0afba-sum(b))>>>0,head+8);assert.equal(sum(b),0xb1b0afba);return b;
}
const fontInput=kernFixture();
const stats={calls:0,queries:0,comparisons:0,renders:0,failures:0,mappingFailures:0,controlFailures:0,decoyCorruptions:0,examples:[]};
function compare(actual,expected,label,mapping=false){stats.comparisons++;const equal=Buffer.isBuffer(actual)?actual.equals(expected):actual===expected;if(!equal){stats.failures++;stats[mapping?'mappingFailures':'controlFailures']++;if(stats.examples.length<20){let first=0;if(Buffer.isBuffer(actual))while(first<actual.length&&actual[first]===expected[first])first++;stats.examples.push({label,first,actual:Buffer.isBuffer(actual)?actual.subarray(first,first+16).toString('hex'):actual,expected:Buffer.isBuffer(expected)?expected.subarray(first,first+16).toString('hex'):expected});}}}
async function main(){
 const {exports:e,memory,hostCtx}=await bootRenderHarness({extraWat,width:96,height:48});
 for(const key of hostCtx.vfs.files.keys())if(/\.(ttf|ttc|otf)$/i.test(key))hostCtx.vfs.files.delete(key);
 hostCtx.vfs.files.set('c:\\windows\\fonts\\gcp-fixture.ttf',{data:new Uint8Array(fontInput),attrs:0x20});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.gcp_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),regs=e.gcp_regs()>>>0;
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
 const put=(p,b)=>b.forEach((x,i)=>e.guest_write8(p+i,x));
 const read=(p,n)=>{const b=Buffer.alloc(n);for(let i=0;i<n;){const k=Math.min(n-i,4096-((p+i)&4095));b.set(mem.subarray(wa(p+i),wa(p+i)+k),i);i+=k;}return b;};
 const str=(s,w=false)=>{const b=Buffer.from(s+'\0',w?'utf16le':'latin1'),p=alloc(b.length);put(p,b);return p;};
 const frame=alloc(256),stack=frame+64,unrelated=alloc(64),thunks=new Map();
 view.setUint32(regs+16,stack,true);const mod=e.gcp_module(str('GDI32.DLL'))>>>0;assert.ok(mod);
 for(const name of ['GetCharacterPlacementA','GetCharacterPlacementW','CreateCompatibleDC','DeleteDC','CreateFontW','SelectObject','GetCurrentObject','GetStockObject','DeleteObject','SaveDC','RestoreDC','CreateDIBSection','TextOutA','TextOutW','SetBkMode','SetTextColor']){
  view.setUint32(regs+16,stack,true);const thunk=e.gcp_resolve(mod,str(name))>>>0,row=apiTable.find(r=>r.name===name);assert.ok(thunk,name);assert.equal(row.convention,'stdcall');assert.equal(e.guest_read32(thunk+4),row.id);thunks.set(name,{thunk,nargs:row.nargs});
 }
 function invoke(name,args){const entry=thunks.get(name);assert.equal(args.length,entry.nargs);mem.fill(0x5a,wa(frame),wa(frame)+256);e.guest_write32(stack,0x12345678);args.forEach((x,i)=>e.guest_write32(stack+4+4*i,x));const before=read(frame,256),other=read(unrelated,64),seed=[0xa0123456,0x11223344,0x22334455,0x33445566,stack,0x44556677,0x55667788,0x66778899];seed.forEach((x,i)=>view.setUint32(regs+4*i,x,true));e.gcp_call(entry.thunk);stats.calls++;assert.equal(e.get_esp()>>>0,stack+4+4*args.length,name+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,name+' EIP');for(const i of [1,2,3,5,6,7])assert.equal(view.getUint32(regs+4*i,true),seed[i],name+' preserved register '+i);assert.deepEqual(read(frame,256),before,name+' entire stack');assert.deepEqual(read(unrelated,64),other);return e.get_eax()>>>0;}
 const dc=invoke('CreateCompatibleDC',[0]),otherDc=invoke('CreateCompatibleDC',[0]);assert.ok(dc&&otherDc);
 const base=0x30000000,adjacent=0x31000000,decoys=[0x28000000,0x29000000];
 // A single guest span crosses both decoys and four nonadjacent backing pages.
 for(const p of [base,decoys[0],base+4096,decoys[1],base+8192,base+12288,...Array.from({length:8},(_,i)=>base+(i+4)*4096)])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(adjacent,49152)>>>0,adjacent);assert.equal(wa(decoys[0]),wa(base)+4096);assert.equal(wa(decoys[1]),wa(base+4096)+4096);assert.notEqual(wa(base+4096),wa(base)+4096);assert.equal(wa(adjacent+12288),wa(adjacent)+12288);
 const direct=alloc(300000),spans=[[wa(direct),300000],...Array.from({length:12},(_,i)=>i).map(i=>[wa(base+i*4096),4096]),...decoys.map(p=>[wa(p),4096]),[wa(adjacent),49152],[wa(0),64]];
 const actual=spans.map(([p,n])=>Buffer.from(mem.buffer,p,n));
 const stock={handle:invoke('GetStockObject',[16]),height:15,width:()=>8,kern:()=>0};
 const terminal={handle:invoke('GetStockObject',[10]),height:12,width:()=>8,kern:()=>0};
 const fixture={handle:invoke('CreateFontW',[-12,0,0,0,400,0,0,0,0,0,0,0,0,str('Fixture Bitmap',true)]),height:12,width:c=>originalBitmapMetrics(originalGlyph(c)).advance,kern:(a,b)=>a===65&&b===66?-2:0};assert.ok(fixture.handle);
 let selected=stock;const old=invoke('SelectObject',[dc,stock.handle]),otherOld=invoke('SelectObject',[otherDc,terminal.handle]);
 const defaults={input:direct+64,result:direct+40000,arrays:[direct+42000,direct+80000,direct+118000,direct+156000,direct+194000,direct+232000]};
 function query(wide,options={}){
  const o={codes:[65,66,67],count:undefined,capacity:3,flags:0,max:1000,size:36,mask:63,...defaults,...options},count=o.count===undefined?o.codes.length:o.count,mapping=!!o.mapping,label=o.label||'placement',expectedFont=o.font||selected;
  spans.forEach(([p,n],i)=>mem.fill(0x91+i,p,p+n));
  const input=wide?Buffer.from(o.codes.map(c=>String.fromCharCode(c)).join(''),'utf16le'):Buffer.from(o.codes);
  if(o.input)put(o.input,input);
  const result=Buffer.alloc(36);result.writeUInt32LE(o.size);o.arrays.forEach((p,i)=>result.writeUInt32LE(o.mask&(1<<i)?p:0,4+i*4));result.writeUInt32LE(o.capacity,28);result.writeUInt32LE(0x77665544,32);if(o.result)put(o.result,result);
  if(o.arrays[4]&&(o.mask&16))put(o.arrays[4],Buffer.from(o.codes.map((_,i)=>i%2?0:7)));
  const expected=actual.map(b=>Buffer.from(b));
  function expect(p,b){for(let i=0;i<b.length;){const physical=wa(p+i),k=Math.min(b.length-i,4096-((p+i)&4095)),j=spans.findIndex(([s,n])=>physical>=s&&physical+k<=s+n);assert.ok(j>=0,label+' expected backing');b.copy(expected[j],physical-spans[j][0],i,i+k);i+=k;}}
  const valid=!!o.result&&count>=0&&count<=65536&&(!count||!!o.input)&&o.size>=36;let included=0,extent=0;const widths=[],carets=[];
  if(valid){const limit=Math.min(count,o.capacity);for(let i=0;i<limit;i++){let width=expectedFont.width(o.codes[i]);if((o.flags&8)&&i+1<limit)width+=expectedFont.kern(o.codes[i],o.codes[i+1]);if((o.flags&0x100000)&&extent+width>o.max)break;carets.push(extent);widths.push(width);extent+=width;included++;}
   if((o.flags&0x110000)===0x110000&&(o.mask&4)&&included&&o.max>extent){const extra=o.max-extent,share=Math.floor(extra/included),rem=extra%included;for(let i=0;i<included;i++)widths[i]+=share+(i<rem?1:0);extent=o.max;}
   for(let j=0;j<6;j++)if(o.mask&(1<<j)){const size=[wide?2:1,4,4,4,1,2][j],b=Buffer.alloc(included*size);for(let i=0;i<included;i++){const value=[o.codes[i],i,widths[i],carets[i],(o.flags&0x80000)&&!(i%2)?7:1,o.codes[i]][j];if(size===1)b[i]=value;else if(size===2)b.writeUInt16LE(value,i*size);else b.writeInt32LE(value,i*size);}expect(o.arrays[j],b);}
   const b=Buffer.alloc(8);b.writeUInt32LE(included);b.writeUInt32LE(included,4);expect(o.result+28,b);
  }
  const answer=invoke(wide?'GetCharacterPlacementW':'GetCharacterPlacementA',[o.targetDc||dc,o.input,count,o.max,o.result,o.flags]);stats.queries++;
  compare(answer,valid?((expectedFont.height<<16)|(extent&65535))>>>0:0,label+' return',mapping);
  actual.forEach((b,i)=>{compare(b,expected[i],label+' entire backing '+i,mapping);if((i===13||i===14)&&!b.equals(expected[i]))stats.decoyCorruptions++;});
  assert.equal(e.guest_span_cursor_bytes(),0,label+' span arena');assert.equal(e.guest_span_overflow_count(),0,label+' span overflow');
 }
 function matrix(allPhases){
  if(allPhases)for(const wide of [false,true])query(wide,{codes:[0,0x80,0xe9,0xff],capacity:4,input:base+4095,label:'counted SBCS bytes and embedded NULL',mapping:true});
  for(const wide of [false,true]){
   query(wide,{label:'direct baseline'});
   for(const start of [base,adjacent]){
    const mapping=start===base;
    for(let repeat=0;repeat<2;repeat++){
     for(let cut=0;cut<=36;cut++)query(wide,{result:start+4096-cut,label:'result every byte '+cut,mapping});
     for(let cut=1;cut<(wide?6:3);cut++)query(wide,{input:start+4096-cut,label:'input every byte '+cut,mapping});
     for(let j=0;j<6;j++){const size=[wide?2:1,4,4,4,1,2][j];for(let cut=1;cut<3*size;cut++){const arrays=[...defaults.arrays];arrays[j]=start+4096-cut;query(wide,{arrays,label:'array '+j+' every byte '+cut,mapping});}}
    }
   }
   for(const capacity of [0,1,2,3,6])for(const flags of [0,8,0x100000,0x110000,0x80000,0x80008])for(const max of [0,8,17,40]){query(wide,{capacity,flags,max,label:'capacity/flags/max'});const arrays=[...defaults.arrays];arrays[2]=base+12287;arrays[4]=base+16383;query(wide,{capacity,flags,max,arrays,result:base+4095,label:'sparse capacity/flags/max',mapping:true});}
   for(const mask of [0,1,2,4,8,16,32,63])query(wide,{mask,label:'nullable arrays'});
   // Keep ANSI invalid-size capacity zero: its historical adapter copies the
   // unmodified capacity even on failure. This task preserves that policy.
   for(const invalid of [{input:0},{result:0},{count:-1},{count:65537},{count:65536,capacity:0,mask:0},{size:35,capacity:0},{count:0,input:0,capacity:0}])query(wide,{...invalid,label:'NULL/count/size policy'});
   for(const start of [base,adjacent]){
    const codes=Array.from({length:8201},(_,i)=>65+i%3),capacity=codes.length;
    query(wide,{codes,capacity,input:start+4095,mask:0,label:'multipage input',mapping:start===base});
    for(let j=0;j<6;j++){const arrays=[...defaults.arrays];arrays[j]=start+4095;query(wide,{codes,capacity,arrays,mask:1<<j,label:'multipage nested '+j,mapping:start===base});}
    // All 4096 alignments of DWORD output exercise page and record phases.
    const phaseCodes=codes.slice(0,2053);
    for(let phase=0;phase<(allPhases?4096:4);phase++){const arrays=[...defaults.arrays];arrays[2]=start+phase;query(wide,{codes:phaseCodes,capacity:phaseCodes.length,arrays,mask:4,label:'multipage DWORD phase '+phase,mapping:start===base});}
   }
  }
 }
 const bmi=alloc(40),out=alloc(4);mem.fill(0,wa(bmi),wa(bmi)+40);e.guest_write32(bmi,40);e.guest_write32(bmi+4,96);e.guest_write32(bmi+8,-48);e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);const bitmap=invoke('CreateDIBSection',[dc,bmi,0,out,0,0]),bits=e.guest_read32(out)>>>0;assert.ok(bitmap);const oldBitmap=invoke('SelectObject',[dc,bitmap]);invoke('SetBkMode',[dc,1]);invoke('SetTextColor',[dc,0]);const sample=str('ABC'),sampleW=str('ABC',true);
 function draw(w){const p=wa(bits),n=96*48*4,pre=Buffer.from(mem.subarray(p-16,p)),post=Buffer.from(mem.subarray(p+n,p+n+16));mem.fill(255,p,p+n);assert.equal(invoke(w?'TextOutW':'TextOutA',[dc,3,3,w?sampleW:sample,3]),1);const b=Buffer.from(mem.subarray(p,p+n));assert.ok(b.some(x=>x!==255),'public TextOut ink');assert.deepEqual(Buffer.from(mem.subarray(p-16,p)),pre);assert.deepEqual(Buffer.from(mem.subarray(p+n,p+n+16)),post);stats.renders++;return b;}
 for(const font of [stock,terminal,fixture]){
  invoke('SelectObject',[dc,font.handle]);selected=font;const before=[draw(false),draw(true)];assert.deepEqual(before[0],before[1],'A/W public TextOut');matrix(font===stock);assert.deepEqual(draw(false),before[0]);assert.deepEqual(draw(true),before[1]);compare(invoke('GetCurrentObject',[dc,6]),font.handle,'DC font unchanged');compare(invoke('GetCurrentObject',[otherDc,6]),terminal.handle,'independent DC unchanged');
  const level=invoke('SaveDC',[dc]);invoke('SelectObject',[dc,terminal.handle]);const inner=invoke('SaveDC',[dc]);invoke('SelectObject',[dc,stock.handle]);assert.equal(invoke('RestoreDC',[dc,inner]),1);selected=terminal;query(true,{label:'inner RestoreDC'});assert.equal(invoke('RestoreDC',[dc,level]),1);selected=font;query(false,{label:'outer RestoreDC'});assert.deepEqual(draw(true),before[1]);
 }
 const otherLevel=invoke('SaveDC',[otherDc]);invoke('SelectObject',[otherDc,stock.handle]);query(true,{targetDc:otherDc,font:stock,label:'independent other DC'});assert.equal(invoke('RestoreDC',[otherDc,otherLevel]),1);query(false,{targetDc:otherDc,font:terminal,result:base+4095,label:'independent other DC restored',mapping:true});compare(invoke('GetCurrentObject',[dc,6]),fixture.handle,'primary DC unaffected');
 // Wide cmap alias must remain a full WORD rather than low-byte F.
 invoke('SelectObject',[dc,fixture.handle]);selected=fixture;for(const cut of [1,2,3,4,5])query(true,{codes:[0x4e46,66,67],input:base+4096-cut,label:'wide cmap alias',mapping:true});
 invoke('SelectObject',[dc,oldBitmap]);invoke('SelectObject',[dc,old]);invoke('SelectObject',[otherDc,otherOld]);assert.equal(invoke('DeleteObject',[bitmap]),1);assert.equal(invoke('DeleteObject',[fixture.handle]),1);assert.equal(invoke('DeleteDC',[dc]),1);assert.equal(invoke('DeleteDC',[otherDc]),1);
 console.log(JSON.stringify({...stats,originalCC0SFNT:true,kernInputSHA256:crypto.createHash('sha256').update(fontInput).digest('hex'),publicResolverThunk:true,allByteCuts:true,fullBackingTwoDecoys:true,ABI:true}));
 assert.equal(stats.failures,0,'character placement independent oracle');
}
if(process.env.GCP_ORACLE_ONLY==='1')console.log(JSON.stringify({oracleOnly:true,originalABC,kernInputSHA256:crypto.createHash('sha256').update(fontInput).digest('hex')}));else main().catch(e=>{console.error(e);process.exitCode=1;});
