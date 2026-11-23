#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

// Original committed CC0 fixtures are the oracle. Parse their on-disk, big
// endian directories here; never ask a WAT font helper for expected bytes.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getfontdata
function original(name, sha256) {
 const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/ttc-ebdt', name));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), sha256);
 const collection = bytes.toString('ascii', 0, 4) === 'ttcf';
 const offsets = collection ? Array.from({length: bytes.readUInt32BE(8)}, (_, i) => bytes.readUInt32BE(12 + i * 4)) : [0];
 const members = offsets.map(offset => {
  assert.equal(bytes.readUInt32BE(offset), 0x10000);
  const tables = new Map();
  for (let i = 0; i < bytes.readUInt16BE(offset + 4); i++) {
   const row = offset + 12 + i * 16, tag = bytes.toString('ascii', row, row + 4);
   const start = bytes.readUInt32BE(row + 8), length = bytes.readUInt32BE(row + 12);
   assert.ok(start > 0 && length > 0 && start + length <= bytes.length);
   tables.set(tag, bytes.subarray(start, start + length));
  }
  const names = tables.get('name'), stringOffset = names.readUInt16BE(4);
  let family;
  for (let i = 0; i < names.readUInt16BE(2); i++) {
   const row = 6 + 12 * i;
   if (names.readUInt16BE(row) === 3 && names.readUInt16BE(row + 4) === 0x409 && names.readUInt16BE(row + 6) === 1) {
    const s = names.subarray(stringOffset + names.readUInt16BE(row + 10), stringOffset + names.readUInt16BE(row + 10) + names.readUInt16BE(row + 8));
    family = Array.from({length: s.length / 2}, (_, j) => String.fromCharCode(s.readUInt16BE(j * 2))).join('');
   }
  }
  assert.ok(family);
  return {family, offset, tables, file: bytes.subarray(offset)};
 });
 return {name, bytes, collection, members};
}
const fixtures = {
 ttc: original('faces.ttc', '72f4c72ec3b3283eb8c086ce0041169dfd2c879d6251b8752465e2201a9504ca'),
 bitmap: original('bitmap.ttf', 'd3592211c34594d3bb37e72c987dd05cd01f2c47210f508639ad43d4f1ebc81d'),
 complex: original('complex.ttf', '719404b7ccf42626db10cd2fb7939f0536a8ddb279619e564f776c70ae7409e7'),
};
const extraWat = String.raw`
 (func (export "fd_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "fd_regs") (result i32) (global.get $reg_base))
 (func (export "fd_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "fd_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "fd_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
`;
const stats = {calls: 0, queries: 0, comparisons: 0, renders: 0, payloadBytes: 0, failures: 0, mappingFailures: 0, controlFailures: 0, decoyCorruptions: 0, examples: []};
function compare(actual, expected, label, mapping = false) {
 stats.comparisons++;
 const equal = Buffer.isBuffer(actual) ? actual.equals(expected) : actual === expected;
 if (!equal) {
  stats.failures++; stats[mapping ? 'mappingFailures' : 'controlFailures']++;
  if (stats.examples.length < 16) {
   let first = 0;
   if (Buffer.isBuffer(actual)) while (first < actual.length && actual[first] === expected[first]) first++;
   stats.examples.push({label, mapping, first, actual: Buffer.isBuffer(actual) ? actual.subarray(first, first + 16).toString('hex') : actual, expected: Buffer.isBuffer(expected) ? expected.subarray(first, first + 16).toString('hex') : expected});
  }
 }
}
async function profile(files) {
 const {exports: e, memory, hostCtx} = await bootRenderHarness({extraWat, width: 96, height: 48});
 // Mount inputs before any public font discovery; leave bundled raster fonts.
 for (const key of hostCtx.vfs.files.keys()) if (/\.(ttf|ttc|otf)$/i.test(key)) hostCtx.vfs.files.delete(key);
 for (const f of files) hostCtx.vfs.files.set('c:\\windows\\fonts\\' + f.name, {data: new Uint8Array(f.bytes), attrs: 0x20});
 e.init_thread(1, 0x400000, 0, 0, 0, 0, 0); e.heap_init(0x800000); e.fd_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), v = new DataView(memory.buffer), regs = e.fd_regs() >>> 0;
 const wa = p => e.guest_to_wasm(p) >>> 0, alloc = n => {const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p;};
 const put = (p, b) => b.forEach((x, i) => e.guest_write8(p + i, x));
 const read = (p, n) => Buffer.from(Array.from({length: n}, (_, i) => e.guest_read8(p + i)));
 const str = (s, wide = false) => {const b = Buffer.from(s + '\0', wide ? 'utf16le' : 'latin1'), p = alloc(b.length); put(p, b); return p;};
 const frame = alloc(256), stack = frame + 64, unrelated = alloc(64);
 const thunks = new Map();
 v.setUint32(regs + 16, stack, true); const module = e.fd_module(str('GDI32.DLL')) >>> 0; assert.ok(module);
 for (const name of ['GetFontData','CreateCompatibleDC','DeleteDC','CreateFontA','CreateFontW','SelectObject','GetCurrentObject','GetStockObject','DeleteObject','SaveDC','RestoreDC','CreateDIBSection','TextOutA','TextOutW','SetBkMode','SetTextColor']) {
  v.setUint32(regs + 16, stack, true); const thunk = e.fd_resolve(module, str(name)) >>> 0;
  const row = apiTable.find(r => r.name === name); assert.ok(thunk, name); assert.equal(row.convention, 'stdcall');
  assert.equal(e.guest_read32(thunk + 4), row.id); thunks.set(name, {thunk, nargs: row.nargs});
 }
 function invoke(name, args) {
  const entry = thunks.get(name); assert.equal(args.length, entry.nargs);
  mem.fill(0x5a, wa(frame), wa(frame) + 256); e.guest_write32(stack, 0x12345678);
  args.forEach((x, i) => e.guest_write32(stack + 4 + 4 * i, x));
  const before = read(frame, 256), other = read(unrelated, 64);
  const seed = [0xa0123456,0x11223344,0x22334455,0x33445566,stack,0x44556677,0x55667788,0x66778899];
  seed.forEach((x, i) => v.setUint32(regs + i * 4, x, true)); e.fd_call(entry.thunk); stats.calls++;
  assert.equal(e.get_esp() >>> 0, stack + 4 + args.length * 4, name + ' ESP');
  assert.equal(e.get_eip() >>> 0, 0x456789ab, name + ' EIP');
  for (const i of [1,2,3,5,6,7]) assert.equal(v.getUint32(regs + i * 4, true), seed[i], name + ' register ' + i);
  assert.deepEqual(read(frame, 256), before, name + ' whole stack'); assert.deepEqual(read(unrelated, 64), other);
  return e.get_eax() >>> 0;
 }
 const dc = invoke('CreateCompatibleDC', [0]), otherDc = invoke('CreateCompatibleDC', [0]); assert.ok(dc && otherDc);
 const base = 0x30000000, adjacent = 0x31000000, decoys = [0x28000000,0x29000000];
 for (const p of [base,decoys[0],base + 4096,decoys[1],base + 8192,base + 12288]) assert.equal(e.test_virtual_map_commit(p,4096) >>> 0,p);
 assert.equal(e.test_virtual_map_commit(adjacent,16384) >>> 0,adjacent);
 assert.equal(wa(decoys[0]),wa(base)+4096); assert.equal(wa(decoys[1]),wa(base+4096)+4096);
 assert.notEqual(wa(base+4096),wa(base)+4096); assert.equal(wa(adjacent+12288),wa(adjacent)+12288);
 const direct = alloc(16384), spans = [[wa(direct),16384],...Array.from({length:4},(_,i)=>[wa(base+4096*i),4096]),...decoys.map(p=>[wa(p),4096]),[wa(adjacent),16384],[wa(0),64]];
 const before = spans.map(([,n])=>Buffer.alloc(n)), expected = spans.map(([,n])=>Buffer.alloc(n));
 const actual = spans.map(([p,n])=>Buffer.from(mem.buffer,p,n));
 // Cache independent guest page -> backing locations, never a font helper.
 function query(font, tag, offset, pointer, count, source, label, mapping = false, error = false, targetDc = dc) {
  spans.forEach(([p,n],i)=>{mem.fill(0x91+i,p,p+n);actual[i].copy(before[i]);before[i].copy(expected[i]);});
  const available = error || offset > source.length ? 0xffffffff : source.length - offset;
  const result = available === 0xffffffff ? available : pointer ? Math.min(count,available) : available;
  if (result !== 0xffffffff && pointer && result) {
   for (let j = 0; j < result;) {
    const p = pointer + j, physical = wa(p), n = Math.min(result-j,4096-(p&4095));
    const i = spans.findIndex(([s,len])=>physical>=s && physical+n<=s+len); assert.ok(i>=0);
    source.copy(expected[i],physical-spans[i][0],offset+j,offset+j+n);j+=n;
   }
  }
  compare(invoke('GetCurrentObject',[dc,6]),font,label+' selected before');
  compare(invoke('GetFontData',[targetDc,tag,offset,pointer,count]),result,label+' return');stats.queries++;
  if(pointer && result!==0xffffffff) {
   const payload=Buffer.alloc(result);
   for(let j=0;j<result;) {
    const p=pointer+j,n=Math.min(result-j,4096-(p&4095));
    payload.set(mem.subarray(wa(p),wa(p)+n),j);j+=n;
   }
   compare(payload,source.subarray(offset,offset+result),label+' every guest payload byte',mapping);
   stats.payloadBytes+=result;
  }
  for (let i=0;i<actual.length;i++) {
   compare(actual[i],expected[i],label+' full backing '+i,mapping);
   if ((i===5||i===6) && !actual[i].equals(expected[i])) stats.decoyCorruptions++;
  }
  compare(invoke('GetCurrentObject',[dc,6]),font,label+' selected after');
  assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);
 }
 const bmi=alloc(40), out=alloc(4);mem.fill(0,wa(bmi),wa(bmi)+40);
 e.guest_write32(bmi,40);e.guest_write32(bmi+4,96);e.guest_write32(bmi+8,-48);e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);
 const bitmap=invoke('CreateDIBSection',[dc,bmi,0,out,0,0]), bits=e.guest_read32(out)>>>0;
 assert.ok(bitmap);const oldBitmap=invoke('SelectObject',[dc,bitmap]);invoke('SetBkMode',[dc,1]);invoke('SetTextColor',[dc,0]);
 const sample=str('AHI'),sampleW=str('AHI',true);
 function draw(wide) {
  const p=wa(bits),n=96*48*4,pre=Buffer.from(mem.subarray(p-16,p)),post=Buffer.from(mem.subarray(p+n,p+n+16));
  mem.fill(255,p,p+n);assert.equal(invoke(wide?'TextOutW':'TextOutA',[dc,3,3,wide?sampleW:sample,3]),1);
  const b=Buffer.from(mem.subarray(p,p+n));assert.ok(b.some(x=>x!==255),'public TextOut emits ink');
  assert.deepEqual(Buffer.from(mem.subarray(p-16,p)),pre);assert.deepEqual(Buffer.from(mem.subarray(p+n,p+n+16)),post);stats.renders++;return b;
 }
 const fonts=[];
 for(const file of files)for(const member of file.members)for(const wide of [false,true]) {
  const font=invoke(wide?'CreateFontW':'CreateFontA',[-12,0,0,0,400,0,0,0,0,0,0,0,0,str(member.family,wide)]);assert.ok(font);
  fonts.push({file,member,font,wide});
 }
 const oldFont=invoke('SelectObject',[dc,fonts[0].font]);const otherFont=invoke('SelectObject',[otherDc,fonts[fonts.length-1].font]);
 for(const {file,member,font,wide} of fonts) {
  invoke('SelectObject',[dc,font]);const rendered=draw(false);compare(draw(true),rendered,'A/W render');
  const modes=[...member.tables].map(([tag,b])=>[Buffer.from(tag).readUInt32LE(0),b,tag]);
  modes.push([0,member.file,'member']);modes.push([0x66637474,file.bytes,'ttcf']);
  for(const [tag,source,label] of modes) {
   const invalid=(tag===0x66637474&&!file.collection)||(member.truncated && member.truncated.has(label));
   for(const offset of [0,1,Math.max(0,source.length-1),source.length,source.length+1,0xffffffff]) {
    query(font,tag,offset,0,0,source,label+' NULL',false,invalid);
    query(font,tag,offset,0,0xffffffff,source,label+' NULL long',false,invalid);
    for(const n of [0,1,17,source.length,source.length+19,0xffffffff]) for(const p of [direct+13,adjacent+4093,base+4093])
     query(font,tag,offset,p,n,source,label+' count/offset',p===base+4093,invalid);
   }
   if(invalid)continue;
   // Both A/W selections get identical matrices. Every possible split for
   // short data; every page phase for multipage tables/files, twice.
   const cuts=source.length>4096?4096:source.length;
   for(let repeat=0;repeat<2;repeat++)for(let cut=0;cut<cuts;cut++)for(const start of [adjacent,base])
    query(font,tag,0,start+4096-cut,source.length,source,label+'/'+wide+'/'+repeat+'/'+cut,start===base);
  }
  query(font,0x7a7a7a7a,0,base+4095,32,Buffer.alloc(0),'missing tag',false,true);
  query(font,0,0,base+4095,32,member.file,'invalid DC',false,true,0);
  query(font,0,0,base+4095,32,member.file,'invalid handle',false,true,0xdeadbeef);
  compare(draw(false),rendered,'query preserves TextOutA');compare(draw(true),rendered,'query preserves TextOutW');
  assert.equal(invoke('GetCurrentObject',[otherDc,6]),fonts[fonts.length-1].font,'independent selected DC');
  const independent=fonts[fonts.length-1];
  query(font,0,3,base+4095,31,independent.member.file,'independent DC',true,false,otherDc);
  assert.equal(invoke('SaveDC',[dc]),1);
  const next=fonts[(fonts.findIndex(f=>f.font===font)+1)%fonts.length];invoke('SelectObject',[dc,next.font]);
  query(next.font,0,3,base+4095,31,next.member.file,'nested selected',true);
  const nested=invoke('GetCurrentObject',[dc,6]);assert.equal(invoke('SaveDC',[dc]),2);
  invoke('SelectObject',[dc,invoke('GetStockObject',[10])]);const raster=invoke('GetCurrentObject',[dc,6]);
  query(raster,0,0,base+4095,32,Buffer.alloc(0),'raster',false,true);
  assert.equal(invoke('RestoreDC',[dc,-1]),1);assert.equal(invoke('GetCurrentObject',[dc,6]),nested);
  query(nested,0,3,base+4095,31,next.member.file,'nested restored inner',true);
  assert.equal(invoke('RestoreDC',[dc,-1]),1);assert.equal(invoke('GetCurrentObject',[dc,6]),font);
  query(font,0,3,base+4095,31,member.file,'nested restored',true);compare(draw(false),rendered,'restored render');
 }
 invoke('SelectObject',[dc,oldFont]);invoke('SelectObject',[otherDc,otherFont]);invoke('SelectObject',[dc,oldBitmap]);
 assert.equal(invoke('DeleteObject',[bitmap]),1);for(const {font} of fonts)assert.equal(invoke('DeleteObject',[font]),1);
 assert.equal(invoke('DeleteDC',[dc]),1);assert.equal(invoke('DeleteDC',[otherDc]),1);
}
(async()=>{
 await profile([fixtures.ttc,fixtures.complex]);await profile([fixtures.bitmap]);
 // Truncate the last byte of the retained original, without rewriting its
 // directory. Whole-file reads remain bounded; the incomplete EBLC table
 // must be rejected, while all complete tables retain their original bytes.
 const f=fixtures.bitmap, cut=f.bytes.length-1;
 const truncated={...f,bytes:f.bytes.subarray(0,cut),members:f.members.map(m=>({...m,
  file:m.file.subarray(0,cut),
  truncated:new Set([...m.tables].filter(([,b])=>b.byteOffset+b.length>f.bytes.byteOffset+cut).map(([tag])=>tag))}))};
 assert.deepEqual([...truncated.members[0].truncated],['EBLC']);
 await profile([truncated]);
 console.log(JSON.stringify({...stats,independentOriginalSFNT:true,allBytePageCuts:true,fullBackingTwoDecoys:true,publicResolverThunk:true,ABI:true}));
 assert.equal(stats.controlFailures,0,'font/return/ABI/render controls');
 assert.equal(stats.failures,0,'all payload bytes and full backing guards');
 console.log('PASS GetFontData public mapped destinations, original sfnt/TTC tables, offsets, selection, nested SaveDC/RestoreDC, TextOut DIB and ABI');
})().catch(e=>{console.error(e);process.exitCode=1;});
