#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');
// Transport regression for the emulator's existing profile model. This literal
// is independently specified, not decoded from handler stores or queried output.
// It is not a claim about the filename on every Windows installation.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-geticmprofilea
// Windows documents TRUE for a NULL filename query and insufficient-buffer
// errors. The current emulator returns FALSE for NULL and leaves last error
// unchanged; this narrow transport fix deliberately preserves those policies.
const DEFAULT = Buffer.from('sRGB Color Space Profile.icm\0', 'ascii');
assert.equal(DEFAULT.length,29);
const extraWat = String.raw`
 (func (export "icm_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "icm_regs") (result i32) (global.get $reg_base))
 (func (export "icm_module") (param $p i32) (result i32)
  (call $handle_GetModuleHandleA (local.get $p) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "icm_resolve") (param $m i32) (param $p i32) (result i32)
  (call $handle_GetProcAddress (local.get $m) (local.get $p) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "icm_call") (param $p i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get $p) (global.get $thunk_guest_base)) (i32.const 3))))

`;

async function main() {
 const {exports:e,memory}=await bootRenderHarness({extraWat,width:8,height:8,fonts:'bitmap'});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.icm_init();e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), view = new DataView(memory.buffer), regs = e.icm_regs() >>> 0;
 const wa = p => e.guest_to_wasm(p) >>> 0, alloc = n => e.guest_alloc(n) >>> 0;
 const read = (p, n) => {const b=Buffer.alloc(n);for(let i=0;i<n;){const count=Math.min(n-i,4096-((p+i)&4095)),physical=wa(p+i);b.set(mem.subarray(physical,physical+count),i);i+=count;}return b;};
 const put = (p, b) => b.forEach((v, i) => e.guest_write8(p + i, v));
 const text = s => { const p = alloc(s.length + 1); put(p, Buffer.from(s + '\0')); return p; };
 const stackArea = alloc(256), stack = stackArea + 64, direct = alloc(128), unrelated = alloc(128), queryOut = alloc(16);
 const thunks = new Map();
 for (const [dll, names] of [['GDI32.DLL', ['CreateCompatibleDC','DeleteDC','GetICMProfileA','SetICMProfileA','SetICMMode','SaveDC','RestoreDC','CreateDIBSection','SelectObject','DeleteObject','CreateSolidBrush','PatBlt','SetBkColor','GetBkColor']]]) {
  view.setUint32(regs + 16, stack, true); const module = e.icm_module(text(dll)) >>> 0; assert.ok(module);
  for (const name of names) {
   view.setUint32(regs + 16, stack, true); const thunk = e.icm_resolve(module, text(name)) >>> 0;
   assert.ok(thunk, name + ' public resolver'); const row = apiTable.find(r => r.name === name);
   assert.equal(row.convention, 'stdcall'); assert.equal(view.getUint32(wa(thunk) + 4, true), row.id);
   thunks.set(name, { thunk, nargs: row.nargs });
  }
 }
 let calls = 0, queries = 0, controls = 0, rendered = 0; const failures = [], captures = [];
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
  seed.forEach((v, i) => view.setUint32(regs + i * 4, v, true)); e.icm_call(entry.thunk); calls++;
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
  assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
  for (const i of [1, 2, 3, 5, 6, 7]) assert.equal(view.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(stackArea, 256), before, name + ' complete stack frame');
  assert.deepEqual(read(unrelated, 128), other, name + ' unrelated bytes');
  return e.get_eax();
 }
 const ok = (name, args, expected) => { const r = invoke(name, args); if (expected === undefined) assert.ok(r, name); else assert.equal(r, expected, name); return r >>> 0; };
 const a=ok('CreateCompatibleDC',[0]), b=ok('CreateCompatibleDC',[0]);
 const base=0x30000000, decoy=0x28000000, after=0x29000000, adjacent=0x31000000;
 const lengthBase=0x32000000, lengthDecoy=0x2a000000, lengthAfter=0x2b000000, lengthAdjacent=0x33000000;
 for(const p of [base,decoy,base+4096,after,base+8192,base+12288,base+16384,lengthBase,lengthDecoy,lengthBase+4096,lengthAfter])
  assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(adjacent,20480)>>>0,adjacent);
 assert.equal(e.test_virtual_map_commit(lengthAdjacent,8192)>>>0,lengthAdjacent);
 for(const [p,d,q] of [[base,decoy,after],[lengthBase,lengthDecoy,lengthAfter]]){
  assert.equal(wa(d),wa(p)+4096);assert.notEqual(wa(p+4096),wa(p)+4096);assert.equal(wa(q),wa(p+4096)+4096);
 }
 assert.equal(wa(adjacent+4096),wa(adjacent)+4096);
 assert.equal(wa(lengthAdjacent+4096),wa(lengthAdjacent)+4096);
 const spans=[[wa(direct),128],[wa(queryOut),16],[wa(0),32],...[base,decoy,base+4096,after,base+8192,base+12288,base+16384,lengthBase,lengthDecoy,lengthBase+4096,lengthAfter].map(p=>[wa(p),4096]),[wa(adjacent),20480],[wa(lengthAdjacent),8192]];
 const snapshot=()=>spans.map(([p,n])=>Buffer.from(mem.subarray(p,p+n)));
 function expectedWrite(expected,p,bytes){
  for(let i=0;i<bytes.length;){const count=Math.min(bytes.length-i,4096-((p+i)&4095)),physical=wa(p+i);
   const j=spans.findIndex(([s,n])=>physical>=s&&physical+count<=s+n);assert.ok(j>=0,'oracle backing exists');
   bytes.copy(expected[j],physical-spans[j][0],i,i+count);i+=count;}
 }
 // Error setup/readback use the existing generated wrappers. KERNEL32 exports
 // belong to its native image rather than the GDI named-thunk record format.
 const profiles=new Map([[a,DEFAULT],[b,DEFAULT]]);
 function query(dc,p,l,capacity,label,mapping=false){
  spans.forEach(([s,n],i)=>mem.fill(0x80+i,s,s+n));
  if(l)e.guest_write32(l,capacity);
  const expected=snapshot(),profile=profiles.get(dc),valid=!!profile&&!!l,success=valid&&!!p&&(capacity>>>0)>=profile.length;
  if(valid){const size=Buffer.alloc(4);size.writeUInt32LE(profile.length);expectedWrite(expected,l,size);}
  if(success)expectedWrite(expected,p,profile);
  e.test_call_SetLastError(0x13579bdf);
  const r=invoke('GetICMProfileA',[dc,l,p]);queries++;
  compare(r,success?1:0,label+' BOOL');compare(e.test_call_GetLastError()>>>0,0x13579bdf,label+' last error');
  const kind=mapping?'mapping':'control';
  if(success)compare(read(p,profile.length),profile,label+' independent literal profile',kind);
  snapshot().forEach((v,i)=>compare(v,expected[i],label+' full backing '+i,kind));
  assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);
 }
 // All 28 interior default-string cuts crossed with every DWORD split, both
 // physical layouts and repeated calls. Capacity/NULL paths use the same guards.
 for(let repeat=0;repeat<2;repeat++)for(const [out,len,name] of [[base,lengthBase,'nonadjacent'],[adjacent,lengthAdjacent,'adjacent']]){
  for(let cut=1;cut<DEFAULT.length;cut++)for(let lc=0;lc<4;lc++){
   const p=out+4096-cut,l=lc?len+4096-lc:queryOut;
   for(const cap of [0,1,28,29,30,0xffffffff])query(a,p,l,cap,`${name}/${repeat}/${cut}/${lc}/${cap}`,name==='nonadjacent');
   query(a,0,l,29,`${name} NULL filename/${cut}/${lc}`);
   query(a,p,0,29,`${name} NULL length/${cut}/${lc}`);
  }
  // Every page phase, including page-edge NUL and interior DWORD stores.
  for(let phase=0;phase<4096;phase++)query(a,out+phase,len+4093+(phase%4),29,`${name} phase/${repeat}/${phase}`,name==='nonadjacent');
 }
 for(const dc of [0,0x7ffffffe])for(const l of [0,queryOut,lengthBase+4093])for(const p of [0,direct+7,base+4095])query(dc,p,l,29,'invalid DC');
 for(const cap of [0,28,29,64])query(a,direct+7,queryOut,cap,'direct '+cap);
 function set(dc,s){const bytes=Buffer.from(s+'\0','ascii'),p=text(s);ok('SetICMProfileA',[dc,p],1);profiles.set(dc,bytes);return p;}
 const custom='profiles/independent-custom.icm';
 const input=set(a,custom);put(input,Buffer.alloc(custom.length,0x58));
 query(a,base+4095,lengthBase+4093,128,'custom owned copy',true);
 query(b,base+4090,lengthBase+4094,128,'independent default',true);
 ok('SetICMProfileA',[a,0],0);ok('SetICMProfileA',[a,text('')],0);
 query(a,direct+1,queryOut,128,'failed setters preserve profile');
 // Unique ASCII input spans several pages; expected bytes are entirely literal.
 const long='profiles/'+Array.from({length:8201},(_,i)=>String.fromCharCode(65+(i%26))).join('')+'.icm';
 set(a,long);
 for(const [out,len,name] of [[base,lengthBase,'nonadjacent'],[adjacent,lengthAdjacent,'adjacent']])
  for(const phase of [0,1,2,3,4093,4094,4095])for(let lc=1;lc<4;lc++)for(const cap of [0,long.length,long.length+1,long.length+99])
   query(a,out+phase,len+4096-lc,cap,`long ${name}/${phase}/${lc}/${cap}`,name==='nonadjacent');
 // Public DIB/PatBlt controls make selection and nested SaveDC state visible.
 // The current profile metadata is independent of brush/background restoration.
 const bmi=alloc(40),bitsOut=alloc(4);put(bmi,Buffer.alloc(40));
 e.guest_write32(bmi,40);e.guest_write32(bmi+4,8);e.guest_write32(bmi+8,-8);e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);
 const red=ok('CreateSolidBrush',[0x0000ff]),green=ok('CreateSolidBrush',[0x00ff00]);
 const surfaces=[a,b].map(dc=>{const bitmap=ok('CreateDIBSection',[dc,bmi,0,bitsOut,0,0]),bits=e.guest_read32(bitsOut)>>>0;
  const old=ok('SelectObject',[dc,bitmap]);return {dc,bitmap,bits,old};});
 const oldBrushA=ok('SelectObject',[a,red]),oldBrushB=ok('SelectObject',[b,green]);
 function render(surface,color,label){const p=wa(surface.bits),before=Buffer.from(mem.subarray(p-16,p)),after=Buffer.from(mem.subarray(p+256,p+272));
  mem.fill(0xcc,p,p+256);ok('PatBlt',[surface.dc,0,0,8,8,0x00f00021],1);
  const actual=Buffer.from(mem.subarray(p,p+256));
  for(let i=0;i<256;i+=4)assert.deepEqual([...actual.subarray(i,i+3)],color,label+' literal BGR pixel');
  assert.deepEqual(Buffer.from(mem.subarray(p-16,p)),before);assert.deepEqual(Buffer.from(mem.subarray(p+256,p+272)),after);
  rendered++;if(captures.length<4)captures.push({label,width:8,height:8,bgrx:actual.toString('hex')});return actual;}
 set(a,'profiles/state-a.icm');set(b,'profiles/state-b.icm');
 const surfaceA=surfaces[0],surfaceB=surfaces[1];
 const beforeA=render(surfaceA,[0,0,255],'initial A'),beforeB=render(surfaceB,[0,255,0],'initial B');
 ok('SetBkColor',[a,0x112233]);ok('SetBkColor',[b,0x445566]);
 const save1=ok('SaveDC',[a]);ok('SelectObject',[a,green]);ok('SetBkColor',[a,0xabcdef]);
 const save2=ok('SaveDC',[a]);assert.equal(save2,save1+1);ok('SelectObject',[a,red]);ok('SetBkColor',[a,0x123456]);
 for(let repeat=0;repeat<2;repeat++){
  query(a,base+4091,lengthBase+4093,128,'nested A '+repeat,true);
  query(b,adjacent+4090,lengthAdjacent+4095,128,'nested B '+repeat);
 }
 ok('RestoreDC',[a,-1],1);assert.equal(invoke('GetBkColor',[a])>>>0,0xabcdef);
 assert.deepEqual(render(surfaceA,[0,255,0],'inner restored A'),beforeB);
 query(a,base+4095,lengthBase+4095,128,'inner restored profile',true);
 ok('RestoreDC',[a,save1],1);assert.equal(invoke('GetBkColor',[a])>>>0,0x112233);
 assert.deepEqual(render(surfaceA,[0,0,255],'outer restored A'),beforeA);
 assert.deepEqual(render(surfaceB,[0,255,0],'independent B'),beforeB);assert.equal(invoke('GetBkColor',[b])>>>0,0x445566);
 query(a,base+4095,lengthBase+4095,128,'outer restored profile',true);
 for(const mode of [1,2]){invoke('SetICMMode',[a,mode]);query(a,base+4092,lengthBase+4094,128,'ICM mode '+mode,true);}
 ok('SelectObject',[a,oldBrushA]);ok('SelectObject',[b,oldBrushB]);
 for(const s of surfaces){ok('SelectObject',[s.dc,s.old]);ok('DeleteObject',[s.bitmap],1);}
 ok('DeleteObject',[red],1);ok('DeleteObject',[green],1);
 ok('DeleteDC',[a],1);profiles.delete(a);query(a,base+4095,lengthBase+4093,128,'deleted DC',true);ok('DeleteDC',[b],1);
 const controlFailures=failures.filter(f=>f.kind!=='mapping').length;
 console.log(JSON.stringify({calls,queries,controls,rendered,failureCount:failures.length,controlFailures,failures:failures.slice(0,40),captures}));
 assert.equal(failures.length,0,'profile output, full backing, controls');
 console.log('PASS GetICMProfileA mapped default/custom profile transport and current policies');
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
