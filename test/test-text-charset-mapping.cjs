#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

// Non-TrueType fonts receive zeros: four USB DWORDs + two CSB DWORDs.
// This literal oracle is independent of the implementation and its helpers.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-gettextcharsetinfo
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-fontsignature
const extraWat = String.raw`
 (func (export "charset_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "charset_regs") (result i32) (global.get $reg_base))
 (func (export "charset_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "charset_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "charset_call") (param $p i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "charset_window") (result i32)
  (local $h i32)
  (local.set $h (global.get $next_hwnd))
  (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
  (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE))
  (local.get $h))
`;

async function main() {
 const { exports: e, memory } = await bootRenderHarness({ extraWat, width: 128, height: 48 });
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.charset_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), view = new DataView(memory.buffer), regs = e.charset_regs() >>> 0;
 const wa = p => e.guest_to_wasm(p) >>> 0, alloc = n => e.guest_alloc(n) >>> 0;
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => e.guest_read8(p + i)));
 const put = (p, b) => b.forEach((v, i) => e.guest_write8(p + i, v));
 const text = s => { const p = alloc(s.length + 1); put(p, Buffer.from(s + '\0')); return p; };
 const stackArea = alloc(256), stack = stackArea + 64, direct = alloc(128), unrelated = alloc(128), queryOut = alloc(16);
 const thunks = new Map();
 for (const [dll, names] of [['GDI32.DLL', ['CreateCompatibleDC','DeleteDC','CreateFontA','CreateFontW','GetStockObject','SelectObject','DeleteObject','GetTextCharsetInfo','GetTextCharset','GetCurrentObject','GetObjectA','GetObjectW','SaveDC','RestoreDC','CreateDIBSection','TextOutA','TextOutW','SetBkMode','SetTextColor']]]) {
  view.setUint32(regs + 16, stack, true); const module = e.charset_module(text(dll)) >>> 0; assert.ok(module);
  for (const name of names) {
   view.setUint32(regs + 16, stack, true); const thunk = e.charset_resolve(module, text(name)) >>> 0;
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
  seed.forEach((v, i) => view.setUint32(regs + i * 4, v, true)); e.charset_call(entry.thunk); calls++;
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
 for (const p of [base, decoy, base + 4096, decoyAfter]) assert.equal(e.test_virtual_map_commit(p, 4096) >>> 0, p);
 assert.equal(e.test_virtual_map_commit(adjacent, 8192) >>> 0, adjacent);
 assert.equal(wa(decoy), wa(base) + 4096); assert.notEqual(wa(base + 4096), wa(base) + 4096);
 assert.equal(wa(decoyAfter), wa(base + 4096) + 4096);
 assert.equal(wa(adjacent + 4096), wa(adjacent) + 4096);
 const nullPhysical = wa(0);
 const spans = [[wa(direct), 128], [wa(base), 4096], [wa(decoy), 4096], [wa(base + 4096), 4096], [wa(decoyAfter), 4096], [wa(adjacent), 8192], [nullPhysical, 32]];
 const snapshot = () => spans.map(([p, n]) => Buffer.from(mem.subarray(p, p + n)));
 // Literal raster signatures are six zero DWORDs, independent of queried data.
 const zeros=Buffer.from('000000000000000000000000000000000000000000000000','hex');
 assert.equal(zeros.length,24);
 const specs=[
  {stock:10,name:'Terminal',charset:255},
  {stock:11,name:'Courier',charset:0},
  {stock:16,name:'Fixedsys',charset:0},
  {api:'CreateFontA',name:'Fixedsys',requested:0,charset:0},
  {api:'CreateFontW',name:'Fixedsys',requested:1,charset:0},
  {api:'CreateFontA',name:'Fixedsys',requested:1,charset:0},
  {api:'CreateFontW',name:'Fixedsys',requested:0,charset:0},
 ];
 const object=alloc(128);
 const fonts=specs.map(s=>{
  const p=alloc(64);put(p,Buffer.from(s.name+'\0',s.api==='CreateFontW'?'utf16le':'latin1'));
  const handle=s.stock===undefined?ok(s.api,[-16,0,0,0,400,0,0,0,s.requested,0,0,0,0,p]):ok('GetStockObject',[s.stock]);
  if(s.api)for(const api of ['GetObjectA','GetObjectW']){
   mem.fill(0xa5,wa(object),wa(object)+128);ok(api,[handle,api.endsWith('W')?92:60,object],api.endsWith('W')?92:60);
   assert.equal(e.guest_read8(object+23),s.requested,api+' preserves requested charset');
  }
  return {...s,handle};
 });
 const current=new Map();
 const originalA=ok('SelectObject',[a,fonts[0].handle]);current.set(a,fonts[0]);
 const originalB=ok('SelectObject',[b,fonts[1].handle]);current.set(b,fonts[1]);
 function state(dc,label){
  compare(invoke('GetCurrentObject',[dc,6])>>>0,current.get(dc).handle,label+' selected font handle');
  compare(invoke('GetTextCharset',[dc]),current.get(dc).charset,label+' selected charset');
 }
 function select(dc,font){ok('SelectObject',[dc,font.handle]);current.set(dc,font);state(dc,'selection');}
 function query(dc,p,flags,label,mapping=false){
  state(dc,label+' before');
  spans.forEach(([s,n],i)=>mem.fill(0x91+i,s,s+n));
  const expected=snapshot();
  if(p)for(let i=0;i<24;i++){
   const physical=wa(p+i),j=spans.findIndex(([s,n])=>physical>=s&&physical<s+n);
   assert.ok(j>=0);expected[j][physical-spans[j][0]]=zeros[i];
  }
  const result=invoke('GetTextCharsetInfo',[dc,p,flags]);queries++;
  compare(result,current.get(dc).charset,label+' charset return');
  const kind=mapping?'mapping':'control';
  if(p)compare(read(p,24),zeros,label+' literal 24 zeros',kind);
  const actual=snapshot();actual.forEach((v,i)=>compare(v,expected[i],label+' entire backing '+i,kind));
  if(mapping)observations.push({label,flags,pointer:p,font:current.get(dc).name,charset:current.get(dc).charset,expected:zeros.toString('hex'),actual:read(p,24).toString('hex'),decoyChanged:!actual[2].equals(expected[2])});
  state(dc,label+' after');state(dc===a?b:a,label+' independent');
  assert.equal(e.guest_span_cursor_bytes(),0,label+' span arena');
  assert.equal(e.guest_span_overflow_count(),0,label+' no span overflow');
 }
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
  if(['before 0','after 0','before 2','after 2'].includes(label))captures.push({label,width:128,height:48,bgrx:actual.toString('hex')});
  rendered++;return actual;
 }
 const renderedFonts=[];
 for(const [index,font] of fonts.entries()){
  select(a,font);select(b,fonts[(index+1)%fonts.length]);
  const before=draw(surfaces[0],'before '+index),independent=draw(surfaces[1],'independent before '+index);
  renderedFonts.push(require('node:crypto').createHash('sha256').update(before).digest('hex'));
  compare(draw(surfaces[0],'wide before '+index,true),before,'A/W rendered equivalence '+index);
  // Nonzero flags preserve existing reserved-parameter behavior, not a native contract.
  for(let repeat=0;repeat<2;repeat++)for(const flags of [0,1,0xffffffff]){
   const label=index+'/'+repeat+'/'+flags;
   query(a,0,flags,'NULL '+label);
   query(a,direct+17,flags,'direct '+label);
   for(let cut=1;cut<24;cut++){
    query(a,adjacent+4096-cut,flags,'adjacent '+label+'/'+cut);
    query(a,base+4096-cut,flags,'nonadjacent '+label+'/'+cut,true);
   }
  }
  compare(draw(surfaces[0],'after '+index),before,'queries preserve rendered '+index);
  compare(draw(surfaces[0],'wide after '+index,true),before,'queries preserve wide rendered '+index);
  compare(draw(surfaces[1],'independent after '+index),independent,'independent rendered preserved '+index);
  query(b,direct+21,0,'independent '+index);
  ok('SaveDC',[a],1);select(a,fonts[(index+2)%fonts.length]);
  const replacement=draw(surfaces[0],'saved replacement '+index);
  query(a,base+4095,0,'saved queried '+index,true);
  compare(draw(surfaces[0],'saved after query '+index),replacement,'saved font preserved '+index);
  ok('RestoreDC',[a,-1],1);current.set(a,font);
  query(a,base+4093,0,'restored queried '+index,true);
  compare(draw(surfaces[0],'restored '+index),before,'RestoreDC rendered font '+index);
 }
 assert.ok(new Set(renderedFonts).size>=2,'selected stock fonts distinguish actual rendered glyphs');
 // An invalid DC keeps the existing DEFAULT_CHARSET return and NULL semantics.
 assert.equal(invoke('GetTextCharsetInfo',[0,0,0]),1);
 ok('SelectObject',[a,originalA]);ok('SelectObject',[b,originalB]);
 for(const t of surfaces){ok('SelectObject',[t.dc,t.old]);ok('DeleteObject',[t.bitmap],1);}
 for(const font of fonts)if(font.api)ok('DeleteObject',[font.handle],1);
 for(const dc of [a,b])ok('DeleteDC',[dc],1);
 const controlFailures=failures.filter(f=>f.kind==='control');
 console.log(JSON.stringify({calls,queries,controls,rendered,renderedFonts,failureCount:failures.length,controlFailures:controlFailures.length,failures,observations,captures,all23ByteSplits:true,fullBackingTwoDecoys:true,independentLiteral24Zeros:true,ABI:true}));
 assert.equal(controlFailures.length,0,'adjacent/direct/NULL/charset/font selection/SaveRestore/render controls');
 assert.equal(failures.length,0,'literal raster signature and entire backing including two decoys');
 console.log('PASS public GetTextCharsetInfo mapped signature, literal 24 zeros, A/W font creation, selected charset, SaveDC/RestoreDC, public TextOut DIB and ABI');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
