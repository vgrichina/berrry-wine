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

// Inclusive ABC arrays in logical units; literal 8px and 16px cells are
// established independently by test-wat-gdi-fixed-stock-font.js.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getcharabcwidthsa
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getcharabcwidthsw
const extraWat = String.raw`
 (func (export "abc_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "abc_regs") (result i32) (global.get $reg_base))
 (func (export "abc_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "abc_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "abc_call") (param $p i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "abc_window") (result i32)
  (local $h i32)
  (local.set $h (global.get $next_hwnd))
  (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
  (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE))
  (local.get $h))
`;

async function main() {
 const { exports: e, memory, hostCtx } = await bootRenderHarness({ extraWat, width: 128, height: 48 });
 for(const key of hostCtx.vfs.files.keys())if(/\.(ttf|ttc|otf)$/i.test(key))hostCtx.vfs.files.delete(key);
 hostCtx.vfs.files.set('c:\\windows\\fonts\\abc-fixture.ttf',{data:new Uint8Array(original),attrs:0x20});
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.abc_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), view = new DataView(memory.buffer), regs = e.abc_regs() >>> 0;
 const wa = p => e.guest_to_wasm(p) >>> 0, alloc = n => e.guest_alloc(n) >>> 0;
 const read = (p, n) => {const b=Buffer.alloc(n);for(let i=0;i<n;){const count=Math.min(n-i,4096-((p+i)&4095)),physical=wa(p+i);b.set(mem.subarray(physical,physical+count),i);i+=count;}return b;};
 const put = (p, b) => b.forEach((v, i) => e.guest_write8(p + i, v));
 const text = s => { const p = alloc(s.length + 1); put(p, Buffer.from(s + '\0')); return p; };
 const stackArea = alloc(256), stack = stackArea + 64, direct = alloc(128), unrelated = alloc(128), queryOut = alloc(16);
 const thunks = new Map();
 for (const [dll, names] of [['GDI32.DLL', ['CreateCompatibleDC','DeleteDC','CreateFontA','CreateFontW','GetStockObject','SelectObject','DeleteObject','GetCharABCWidthsA','GetCharABCWidthsW','SaveDC','RestoreDC','CreateDIBSection','TextOutA','TextOutW','SetBkMode','SetTextColor','SetMapMode','SetWindowExtEx','SetViewportExtEx']]]) {
  view.setUint32(regs + 16, stack, true); const module = e.abc_module(text(dll)) >>> 0; assert.ok(module);
  for (const name of names) {
   view.setUint32(regs + 16, stack, true); const thunk = e.abc_resolve(module, text(name)) >>> 0;
   assert.ok(thunk, name + ' public resolver'); const row = apiTable.find(r => r.name === name);
   assert.equal(row.convention, 'stdcall'); assert.equal(view.getUint32(wa(thunk) + 4, true), row.id);
   thunks.set(name, { thunk, nargs: row.nargs });
  }
 }
 let calls = 0, queries = 0, controls = 0, rendered = 0; const failures = [], observations = [], captures = [];
 function compare(actual, expected, label, kind = 'control') {
  if (Buffer.isBuffer(actual)) {
   if (actual.equals(expected)) { controls++; return; }
   let first = 0; while (first < actual.length && actual[first] === expected[first]) first++;
   failures.push({ label, kind, first, bytes: actual.length, actual: actual.subarray(first, first + 16).toString('hex'), expected: expected.subarray(first, first + 16).toString('hex') });
  } else if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, kind, actual, expected });
  else controls++;
 }
 function invoke(name, args) {
  const entry = thunks.get(name); assert.equal(args.length, entry.nargs, name + ' arity');
  mem.fill(0x5a, wa(stackArea), wa(stackArea) + 256);
  e.guest_write32(stack, 0x12345678); args.forEach((v, i) => e.guest_write32(stack + 4 + i * 4, v));
  const before = read(stackArea, 256), other = read(unrelated, 128);
  const seed = [0xa0123456, 0x11223344, 0x22334455, 0x33445566, stack, 0x44556677, 0x55667788, 0x66778899];
  seed.forEach((v, i) => view.setUint32(regs + i * 4, v, true)); e.abc_call(entry.thunk); calls++;
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
  assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(view.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(stackArea, 256), before, name + ' complete stack frame');
  assert.deepEqual(read(unrelated, 128), other, name + ' unrelated bytes');
  return e.get_eax();
 }
 const ok = (name, args, expected) => { const r = invoke(name, args); if (expected === undefined) assert.ok(r, name); else assert.equal(r, expected, name); return r >>> 0; };
 const a = ok('CreateCompatibleDC', [0]), b = ok('CreateCompatibleDC', [0]);
 const base = 0x30000000, decoy = 0x28000000, adjacent = 0x31000000, decoyAfter = 0x29000000;
 for (const p of [base, decoy, base + 4096, decoyAfter,base+8192,base+12288,base+16384]) assert.equal(e.test_virtual_map_commit(p, 4096) >>> 0, p);
 assert.equal(e.test_virtual_map_commit(adjacent, 20480) >>> 0, adjacent);
 assert.equal(wa(decoy), wa(base) + 4096); assert.notEqual(wa(base + 4096), wa(base) + 4096);
 assert.equal(wa(decoyAfter), wa(base + 4096) + 4096);
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 const nullPhysical = wa(0);
 const spans = [[wa(direct), 128], [wa(base), 4096], [wa(decoy), 4096], [wa(base + 4096), 4096], [wa(decoyAfter), 4096], [wa(adjacent), 20480], [nullPhysical, 32],...[2,3,4].map(i=>[wa(base+4096*i),4096])];
 const snapshot = () => spans.map(([p, n]) => Buffer.from(mem.subarray(p, p + n)));
 // Independent retained contract: test-wat-gdi-fixed-stock-font.js asserts
 // four Terminal/Courier/Fixedsys cells = 32px and scaled Fixedsys = 64px.
 // No queried width, private helper or candidate implementation supplies an oracle.
 const specs = [
  {stock:10,name:'Terminal',width:8},
  {stock:11,name:'Courier',width:8},
  {stock:16,name:'Fixedsys',width:8},
  {stock:10,name:'Terminal',width:16,mapped:true},
  {stock:11,name:'Courier',width:16,mapped:true},
  {stock:16,name:'Fixedsys',width:16,mapped:true},
  {api:'CreateFontW',name:'Fixedsys',height:-24,width:16},
  {api:'CreateFontW',name:'Fixture Bitmap',height:-12,width:9,fixture:true},
 ];
 const fonts=specs.map(s=>{
  const p=alloc(64);put(p,Buffer.from(s.name+'\0','utf16le'));
  const handle=s.stock===undefined?ok(s.api,[s.height,0,0,0,400,0,0,0,0,0,0,0,0,p]):ok('GetStockObject',[s.stock]);
  return {...s,handle};
 });
 const current=new Map();
 const originalA=ok('SelectObject',[a,fonts[0].handle]);current.set(a,fonts[0]);
 const originalB=ok('SelectObject',[b,fonts[3].handle]);current.set(b,fonts[3]);
 function select(dc,font){ok('SelectObject',[dc,font.handle]);current.set(dc,font);ok('SetMapMode',[dc,font.mapped?8:1]);ok('SetWindowExtEx',[dc,1,1,0]);ok('SetViewportExtEx',[dc,font.mapped?2:1,font.mapped?2:1,0]);}
 function query(dc,api,first,last,p,label,mapping=false,dcValid=true){
  spans.forEach(([s,n],i)=>mem.fill(0x91+i,s,s+n));
  const expected=snapshot(),valid=!!p&&first<=last&&(api.endsWith('W')?dcValid&&last<=65535:last-first<=255);
  const output=Buffer.alloc(valid?(last-first+1)*12:0);
  const font=current.get(dc);
  for(let i=0;i<output.length;i+=12){
   const m=font.fixture?(api.endsWith('W')?originalABC[0]:{a:0,b:9,c:0}):{a:0,b:font.width,c:0};
   output.writeInt32LE(m.a,i);output.writeUInt32LE(m.b,i+4);output.writeInt32LE(m.c,i+8);
  }
  for(let i=0;i<output.length;){
   const count=Math.min(output.length-i,4096-((p+i)&4095)),physical=wa(p+i),j=spans.findIndex(([s,n])=>physical>=s&&physical+count<=s+n);
   assert.ok(j>=0);output.copy(expected[j],physical-spans[j][0],i,i+count);i+=count;
  }
  const result=invoke(api,[dc,first,last,p]);queries++;
  compare(result,valid?1:0,label+' BOOL');
  const kind=mapping?'mapping':'control';
  if(output.length)compare(read(p,output.length),output,label+' literal ABC array',kind);
  const actual=snapshot();actual.forEach((v,i)=>compare(v,expected[i],label+' entire backing '+i,kind));
  if(mapping&&observations.length<24)observations.push({label,api,first,last,pointer:p,width:current.get(dc).width,expected:output.toString('hex'),actual:read(p,output.length).toString('hex'),decoyChanged:!actual[2].equals(expected[2])});
  assert.equal(e.guest_span_cursor_bytes(),0,label+' span arena');
  assert.equal(e.guest_span_overflow_count(),0,label+' no span overflow');
 }
 // Public rendered TextOutA/W controls use the selected DC font and DIB.
 const bmi=alloc(40),out=alloc(4),sample=text('MWii'),sampleW=alloc(10);
 put(sampleW,Buffer.from('MWii\0','utf16le'));mem.fill(0,wa(bmi),wa(bmi)+40);
 e.guest_write32(bmi,40);e.guest_write32(bmi+4,128);e.guest_write32(bmi+8,-48);
 e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);
 const surfaces=[a,b].map(dc=>{
  const bitmap=ok('CreateDIBSection',[dc,bmi,0,out,0,0]),bits=e.guest_read32(out)>>>0;
  const old=ok('SelectObject',[dc,bitmap]);ok('SetBkMode',[dc,1]);invoke('SetTextColor',[dc,0]);return {dc,bitmap,bits,old};
 });
 function draw(t,label,wide=false){
  const physical=wa(t.bits),n=128*48*4,pre=Buffer.from(mem.subarray(physical-16,physical)),post=Buffer.from(mem.subarray(physical+n,physical+n+16));
  mem.fill(255,physical,physical+n);ok(wide?'TextOutW':'TextOutA',[t.dc,3,3,wide?sampleW:sample,4],1);
  const actual=Buffer.from(mem.subarray(physical,physical+n));assert.ok(actual.some(v=>v!==255),label+' visible ink');
  assert.deepEqual(Buffer.from(mem.subarray(physical-16,physical)),pre);assert.deepEqual(Buffer.from(mem.subarray(physical+n,physical+n+16)),post);
  if(['before Terminal 8','after Terminal 8','before Fixedsys 16','after Fixedsys 16'].includes(label))captures.push({label,width:128,height:48,bgrx:actual.toString('hex')});rendered++;return actual;
 }
 const renderedFonts=[];
 for(const [index,font] of fonts.entries()){
  select(a,font);select(b,fonts[(index+1)%fonts.length]);
  const before=draw(surfaces[0],'before '+font.name+' '+font.width),independent=draw(surfaces[1],'independent before '+index);
  renderedFonts.push(require('node:crypto').createHash('sha256').update(before).digest('hex'));
  compare(draw(surfaces[0],'wide before '+index,true),before,'A/W rendered equivalence '+index);
  for(let repeat=0;repeat<2;repeat++)for(const api of ['GetCharABCWidthsA','GetCharABCWidthsW']){
   for(const [first,last] of (font.fixture?[[65,65],[65,67]]:[[32,32],[65,68],[73,80],[109,113]])){
    const label=index+'/'+repeat+'/'+api+'/'+first+'-'+last;
    query(a,api,first,last,0,'NULL '+label);
    query(a,api,first,last,direct+17,'direct '+label);
    const size=(last-first+1)*12;
    // Every cut includes bytes 1/2/3 within every INT and element boundaries.
    for(let cut=1;cut<size;cut++){
     query(a,api,first,last,adjacent+4096-cut,'adjacent '+label+'/'+cut);
     query(a,api,first,last,base+4096-cut,'nonadjacent '+label+'/'+cut,true);
    }
   }
   if(!font.fixture)query(a,api,0xffffffff,0xffffffff,base+4095,'signextended '+index+'/'+repeat+'/'+api,api.endsWith('A'));
   query(a,api,0,255,0,'ANSI max NULL '+index+'/'+repeat+'/'+api);
   for(const p of [0,direct+17,base+4095]){
    query(a,api,80,65,p,'reversed '+index+'/'+repeat+'/'+api+'/'+p);
    query(a,api,0,api.endsWith('W')?65536:256,p,'oversize '+index+'/'+repeat+'/'+api+'/'+p);
   }
   query(a,api,0,65535,0,'max accepted count with NULL '+index+'/'+repeat+'/'+api);
  }
  compare(draw(surfaces[0],'after '+font.name+' '+font.width),before,'queries preserve rendered '+index);
  compare(draw(surfaces[0],'wide after '+index,true),before,'queries preserve wide rendered '+index);
  compare(draw(surfaces[1],'independent after '+index),independent,'independent rendered preserved '+index);
  query(b,'GetCharABCWidthsW',65,67,direct+21,'independent literal '+index);
  ok('SaveDC',[a],1);select(a,fonts[(index+2)%fonts.length]);
  const replacement=draw(surfaces[0],'saved replacement '+index);
  query(a,'GetCharABCWidthsW',65,67,base+4095,'saved queried '+index,true);
  compare(draw(surfaces[0],'saved after query '+index),replacement,'saved font preserved '+index);
  ok('SaveDC',[a],2);select(a,fonts[(index+3)%fonts.length]);
  query(a,'GetCharABCWidthsA',65,67,base+4093,'inner selected '+index,true);
  ok('RestoreDC',[a,-1],1);current.set(a,fonts[(index+2)%fonts.length]);
  query(a,'GetCharABCWidthsW',65,67,base+4093,'inner restored '+index,true);
  ok('RestoreDC',[a,-1],1);current.set(a,font);
  query(a,'GetCharABCWidthsA',65,67,base+4093,'restored queried '+index,true);
  compare(draw(surfaces[0],'restored '+index),before,'RestoreDC rendered font '+index);
 }
 assert.ok(new Set(renderedFonts).size>=3,'selected fonts distinguish actual rendered glyphs');
 // Four-page wide output with every page phase and complete backing guards.
 select(a,fonts[2]);
 for(let repeat=0;repeat<2;repeat++)for(const start of [base,adjacent]){
  for(let cut=1;cut<=4096;cut++)query(a,'GetCharABCWidthsW',0,1024,start+4096-cut,'multi-page '+repeat+'/'+start+'/'+cut,start===base);
  query(a,'GetCharABCWidthsA',0,255,start+4095,'ANSI 256 '+repeat+'/'+start,start===base);
  query(a,'GetCharABCWidthsW',65535,65535,start+4095,'wide last '+repeat+'/'+start,start===base);
 }
 // Largest wide range: compare all 65536 ABC records and both endpoint guards.
 const maximum=alloc(65536*12+32),writeGuest=(p,b)=>{for(let i=0;i<b.length;){const n=Math.min(b.length-i,4096-((p+i)&4095));mem.set(b.subarray(i,i+n),wa(p+i));i+=n;}};
 const maxExpected=Buffer.alloc(65536*12+32,0xa7);
 for(let i=0;i<65536;i++){maxExpected.writeInt32LE(0,16+i*12);maxExpected.writeUInt32LE(8,20+i*12);maxExpected.writeInt32LE(0,24+i*12);}
 writeGuest(maximum,Buffer.alloc(maxExpected.length,0xa7));ok('GetCharABCWidthsW',[a,0,65535,maximum+16],1);
 const maxActual=Buffer.alloc(maxExpected.length);for(let i=0;i<maxActual.length;){const n=Math.min(maxActual.length-i,4096-((maximum+i)&4095));maxActual.set(mem.subarray(wa(maximum+i),wa(maximum+i)+n),i);i+=n;}
 compare(maxActual,maxExpected,'all 65536 wide ABCs and guards');
 select(a,fonts.at(-1));for(const start of [base,adjacent])for(let cut=1;cut<12;cut++)query(a,'GetCharABCWidthsW',0x4e46,0x4e46,start+4096-cut,'wide cmap alias '+start+'/'+cut,start===base);
 // Retained A/W policy: missing DC has zero ANSI measurement; W has no strike.
 const deleted=ok('CreateCompatibleDC',[0]);ok('DeleteDC',[deleted],1);
 for(const dc of [0,0xdeadbeef,deleted]){
  current.set(dc,{width:0});
  for(const api of ['GetCharABCWidthsA','GetCharABCWidthsW'])for(const p of [0,direct+17,adjacent+4095,base+4095])query(dc,api,65,67,p,'missing DC '+dc+'/'+api+'/'+p,p===base+4095,false);
 }
 ok('SelectObject',[a,originalA]);ok('SelectObject',[b,originalB]);
 for(const t of surfaces){ok('SelectObject',[t.dc,t.old]);ok('DeleteObject',[t.bitmap],1);}
 for(const font of fonts)if(font.api)ok('DeleteObject',[font.handle],1);
 for(const dc of [a,b])ok('DeleteDC',[dc],1);
 const controlFailures=failures.filter(f=>f.kind==='control');
 console.log(JSON.stringify({calls,queries,controls,rendered,failureCount:failures.length,controlFailures:controlFailures.length,controlExamples:controlFailures.slice(0,24),failures:failures.slice(0,24),observations:observations.slice(0,12),captures,allABCByteAndRecordBoundaries:true,fullBackingCanaries:true,independentLiteralABC:true,ABI:true}));
 assert.equal(controlFailures.length,0,'contiguous/adjacent/NULL/range/ABI/independent DC/render controls');
 assert.equal(failures.length,0,'literal widths and entire backing including decoys');
 console.log('PASS public GetCharABCWidthsA/W mapped ABC arrays, literal fixed and original signed ABCs, font selection, nested SaveDC/RestoreDC, TextOut and ABI');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
