#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

// GetTextFace counts bytes for A and UTF-16 code units for W.
// Literal recognized mapper names below are independent of the queried output.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-gettextfacea
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-gettextfacew
// Count zero with non-NULL output is an existing compatibility control only;
// negative counts and undocumented invalid-handle cases are outside this test.
const extraWat = String.raw`
 (func (export "face_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "face_regs") (result i32) (global.get $reg_base))
 (func (export "face_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "face_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "face_call") (param $p i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "face_window") (result i32)
  (local $h i32)
  (local.set $h (global.get $next_hwnd))
  (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
  (call $wnd_table_set (local.get $h) (global.get $WNDPROC_CTRL_NATIVE))
  (local.get $h))
`;

async function main() {
 const { exports: e, memory } = await bootRenderHarness({ extraWat, width: 128, height: 48 });
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.face_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), view = new DataView(memory.buffer), regs = e.face_regs() >>> 0;
 const wa = p => e.guest_to_wasm(p) >>> 0, alloc = n => e.guest_alloc(n) >>> 0;
 const read = (p, n) => Buffer.from(Array.from({ length: n }, (_, i) => e.guest_read8(p + i)));
 const put = (p, b) => b.forEach((v, i) => e.guest_write8(p + i, v));
 const text = s => { const p = alloc(s.length + 1); put(p, Buffer.from(s + '\0')); return p; };
 const stackArea = alloc(256), stack = stackArea + 64, direct = alloc(128), unrelated = alloc(128), queryOut = alloc(16);
 const thunks = new Map();
 for (const [dll, names] of [['GDI32.DLL', ['CreateCompatibleDC','DeleteDC','CreateFontA','CreateFontW','GetStockObject','SelectObject','DeleteObject','GetTextFaceA','GetTextFaceW','SaveDC','RestoreDC','CreateDIBSection','TextOutA','TextOutW','SetBkMode','SetTextColor']]]) {
  view.setUint32(regs + 16, stack, true); const module = e.face_module(text(dll)) >>> 0; assert.ok(module);
  for (const name of names) {
   view.setUint32(regs + 16, stack, true); const thunk = e.face_resolve(module, text(name)) >>> 0;
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
  seed.forEach((v, i) => view.setUint32(regs + i * 4, v, true)); e.face_call(entry.thunk); calls++;
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
 // Each oracle is a literal recognized Win32 mapper face, never a prior query.
 const specs = [
  { api: 'CreateFontA', name: 'Arial', hex: '417269616c00' },
  { api: 'CreateFontW', name: 'Times New Roman', hex: '54696d6573204e657720526f6d616e00' },
  { api: 'CreateFontA', name: 'Courier New', hex: '436f7572696572204e657700' },
  { stock: 13, name: 'System', hex: '53797374656d00' },
  { stock: 16, name: 'Fixedsys', hex: '466978656473797300' },
 ];
 const fonts = specs.map(spec => {
  let handle;
  if (spec.stock !== undefined) handle = ok('GetStockObject', [spec.stock]);
  else {
   const p = alloc(64), wide = spec.api.endsWith('W');
   put(p, Buffer.from(spec.name+'\0', wide?'utf16le':'latin1'));
   handle = ok(spec.api, [-16,0,0,0,400,0,0,0,0,0,0,0,0,p]);
  }
  return {...spec,handle};
 });
 const current = new Map();
 const originalA = ok('SelectObject', [a, fonts[0].handle]); current.set(a, fonts[0]);
 const originalB = ok('SelectObject', [b, fonts[1].handle]); current.set(b, fonts[1]);
 function select(dc, font) { ok('SelectObject',[dc,font.handle]);current.set(dc,font); }
 function query(dc, wide, count, p, label, mapping = false) {
  spans.forEach(([s,n],i)=>mem.fill(0x91+i,s,s+n));
  const expected=snapshot(), spec=current.get(dc), literal=Buffer.from(spec.hex,'hex');
  assert.equal(literal.toString('latin1'),spec.name+'\0');
  const sizing = !p || !count, copied = sizing?spec.name.length+1:Math.min(spec.name.length,count-1);
  const output = sizing?Buffer.alloc(0):Buffer.from(spec.name.slice(0,copied)+'\0',wide?'utf16le':'latin1');
  for(let i=0;i<output.length;i++){
   const physical=wa(p+i),j=spans.findIndex(([s,n])=>physical>=s&&physical<s+n);
   assert.ok(j>=0);expected[j][physical-spans[j][0]]=output[i];
  }
  const result=invoke(wide?'GetTextFaceW':'GetTextFaceA',[dc,count,p]);queries++;
  compare(result,copied,label+' return');
  const kind=mapping?'mapping':'control';
  if(output.length) compare(read(p,output.length),output,label+' literal output',kind);
  const actual=snapshot();actual.forEach((v,i)=>compare(v,expected[i],label+' entire backing '+i,kind));
  if(mapping)observations.push({label,wide,count,pointer:p,name:spec.name,expected:output.toString('hex'),actual:read(p,output.length).toString('hex'),decoyChanged:!actual[2].equals(expected[2])});
  assert.equal(e.guest_span_cursor_bytes(),0,label+' span arena');
  assert.equal(e.guest_span_overflow_count(),0,label+' no span overflow');
 }
 // Real public DIB selection and TextOut exercise the selected font before and
 // after mapped queries. Pixel equality is a state control, not a Windows glyph oracle.
 const bmi=alloc(40),out=alloc(4),sample=text('Wi! ABC 123'),sampleW=alloc(24);
 put(sampleW,Buffer.from('Wi! ABC 123\0','utf16le'));
 mem.fill(0,wa(bmi),wa(bmi)+40);
 e.guest_write32(bmi,40);e.guest_write32(bmi+4,128);e.guest_write32(bmi+8,-48);
 e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);
 const surfaces=[a,b].map(dc=>{
  const bitmap=ok('CreateDIBSection',[dc,bmi,0,out,0,0]),bits=e.guest_read32(out)>>>0;
  const old=ok('SelectObject',[dc,bitmap]);ok('SetBkMode',[dc,1]);invoke('SetTextColor',[dc,0]);
  return{dc,bitmap,bits,old};
 });
 function draw(t,label,wide=false){
  const physical=wa(t.bits),n=128*48*4;
  const pre=Buffer.from(mem.subarray(physical-16,physical)),post=Buffer.from(mem.subarray(physical+n,physical+n+16));
  mem.fill(0xff,physical,physical+n);
  ok(wide?'TextOutW':'TextOutA',[t.dc,3,3,wide?sampleW:sample,11],1);
  const actual=Buffer.from(mem.subarray(physical,physical+n));
  assert.ok(actual.some(v=>v!==255),label+' visible ink');
  assert.deepEqual(Buffer.from(mem.subarray(physical-16,physical)),pre);
  assert.deepEqual(Buffer.from(mem.subarray(physical+n,physical+n+16)),post);
  captures.push({label,width:128,height:48,bgrx:actual.toString('hex')});rendered++;return actual;
 }
 const renderedFaces=[];
 for(const [index,font] of fonts.entries()){
  select(a,font);select(b,fonts[(index+1)%fonts.length]);
  const before=draw(surfaces[0],'before '+font.name),independent=draw(surfaces[1],'independent before '+font.name);
  renderedFaces.push(require('node:crypto').createHash('sha256').update(before).digest('hex'));
  compare(draw(surfaces[0],'before wide '+font.name,true),before,'public A/W rendering '+font.name);
  for(let repeat=0;repeat<2;repeat++)for(const wide of [false,true]){
   for(const count of [0,1,2,4,font.name.length,font.name.length+1,32]){
    query(a,wide,count,0,'NULL '+index+'/'+repeat+'/'+wide+'/'+count);
    query(a,wide,count,direct+17,'direct '+index+'/'+repeat+'/'+wide+'/'+count);
    if(!count)continue;
    const size=(Math.min(font.name.length,count-1)+1)*(wide?2:1);
    for(let cut=1;cut<size;cut++){
     query(a,wide,count,adjacent+4096-cut,'adjacent '+index+'/'+repeat+'/'+wide+'/'+count+'/'+cut);
     query(a,wide,count,base+4096-cut,'nonadjacent '+index+'/'+repeat+'/'+wide+'/'+count+'/'+cut,true);
    }
   }
  }
  compare(draw(surfaces[0],'after '+font.name),before,'queries preserve rendered '+font.name);
  compare(draw(surfaces[0],'after wide '+font.name,true),before,'queries preserve wide rendered '+font.name);
  compare(draw(surfaces[1],'independent after '+font.name),independent,'queries preserve independent '+font.name);
  query(b,false,32,direct+21,'independent literal '+index);
  ok('SaveDC',[a],1);select(a,fonts[(index+2)%fonts.length]);
  const replacement=draw(surfaces[0],'saved replacement '+font.name);
  query(a,true,32,base+4095,'saved queried '+index,true);
  compare(draw(surfaces[0],'saved after query '+font.name),replacement,'saved font preserved '+index);
  ok('RestoreDC',[a,-1],1);current.set(a,font);
  query(a,false,32,base+4093,'restored queried '+index,true);
  compare(draw(surfaces[0],'restored '+font.name),before,'RestoreDC rendered font '+index);
 }
 assert.ok(new Set(renderedFaces).size>=3,'font selection controls distinguish rendered faces');
 ok('SelectObject',[a,originalA]);ok('SelectObject',[b,originalB]);
 for(const t of surfaces){ok('SelectObject',[t.dc,t.old]);ok('DeleteObject',[t.bitmap],1);}
 for(const font of fonts)if(font.api)ok('DeleteObject',[font.handle],1);
 for(const dc of [a,b])ok('DeleteDC',[dc],1);

 const controlFailures = failures.filter(f => f.kind === 'control');
 console.log(JSON.stringify({ calls, queries, controls, rendered, failureCount: failures.length, controlFailures: controlFailures.length,
  failures, observations, captures, allOutputByteBoundaries: true, fullBackingCanaries: true, independentLiteralNames: true, ABI: true }));
 assert.equal(controlFailures.length, 0, 'contiguous, adjacent, NULL sizing, independent DC and rendered controls');
 assert.equal(failures.length, 0, 'literal face strings and entire backing pages including decoys');
 console.log('PASS public GetTextFaceA/W mapped output, literal names, independent DCs, SaveDC/RestoreDC, text rendering and ABI');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
