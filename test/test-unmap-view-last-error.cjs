#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { bootRenderHarness } = require('./render-helper');
const { makeFixture } = require('../tools/kernel32-native-fixture');
const apiTable = require('../src/api_table.json');

// Observation/resolution only; all target APIs execute their real PE entry,
// resolved thunk, win32_dispatch and production filesystem/allocator paths.
const extraWat = String.raw`
 (func (export "unmap_regs") (result i32) (global.get $reg_base))
 (func (export "unmap_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "unmap_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "unmap_backed") (result i32)
  (local $i i32) (local $sum i32)
  (block $done (loop $scan
   (br_if $done (i32.ge_u (local.get $i) (i32.load (global.get $VIRTUAL_MAP_STATE))))
   (local.set $sum (i32.add (local.get $sum)
    (i32.load offset=4 (i32.add (global.get $VIRTUAL_MAP_TABLE)
     (i32.shl (local.get $i) (i32.const 4))))))
   (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $scan)))
  (local.get $sum))
`;

async function run({ moduleBytes = null } = {}) {
 const prebuiltModule = moduleBytes ? await WebAssembly.compile(moduleBytes) : null;
 const { exports: e, memory, hostCtx } = await bootRenderHarness({
  extraWat: prebuiltModule ? '' : extraWat, prebuiltModule, fonts: 'none' });
 const fixture = makeFixture(); new Uint8Array(memory.buffer).set(fixture, e.get_staging());
 assert.ok(e.load_pe(fixture.length)); e.set_api_log(0);
 const regs = e.unmap_regs(), dv = new DataView(memory.buffer), mem = new Uint8Array(memory.buffer);
 const wa = p => e.guest_to_wasm(p) >>> 0;
 const alloc = n => { const p = e.guest_alloc(n) >>> 0; assert.ok(p); return p; };
 const str = s => { const p = alloc(s.length + 1); Buffer.from(s + '\0').forEach((v,i) => e.guest_write8(p+i,v)); return p; };
 const stackBase = alloc(256), stack = stackBase + 64, entries = new Map();
 dv.setUint32(regs+16, stack, true);
 const kernel = e.unmap_module(str('KERNEL32.DLL')) >>> 0; assert.ok(kernel);
 for (const name of ['SetLastError','UnmapViewOfFile','GetLastError','CreateFileMappingA','MapViewOfFile','CloseHandle']) {
  dv.setUint32(regs+16, stack, true);
  const entry = e.unmap_resolve(kernel, str(name)) >>> 0, row = apiTable.find(r => r.name === name);
  assert.ok(entry); assert.equal(row.convention, 'stdcall');
  const thunk = e.guest_read8(entry) === 0xe9 ? (entry+5+(e.guest_read32(entry+1)|0)) >>> 0 : entry;
  assert.equal(e.guest_read32(thunk+4), row.id, name+' actual resolved thunk ID');
  entries.set(name, {entry, nargs: row.nargs});
 }
 let calls = 0;
 function call(name,args) {
  const {entry,nargs} = entries.get(name); assert.equal(args.length,nargs);
  mem.fill(0x6d,wa(stackBase),wa(stackBase)+256);
  e.guest_write32(stack,0); args.forEach((v,i) => e.guest_write32(stack+4+i*4,v));
  const frame = Buffer.from(mem.subarray(wa(stackBase),wa(stackBase)+256));
  const seed = [0x81234567,0x12345678,0x23456789,0x3456789a,stack,0x456789ab,0x56789abc,0x6789abcd];
  seed.forEach((v,i) => dv.setUint32(regs+i*4,v,true));
  e.clear_yield(); e.set_eip(entry);
  for (let i=0;i<16 && e.get_eip();i++) e.run(32);
  // Capture EAX and ESP before any subsequent guest API, especially GetLastError.
  const captured = {eax:e.get_eax()>>>0,esp:e.get_esp()>>>0,eip:e.get_eip()>>>0}; calls++;
  assert.equal(captured.eip,0,name+' return');
  assert.equal(captured.esp,stack+4+nargs*4,name+' stdcall cleanup');
  for(const i of [3,5,6,7]) assert.equal(dv.getUint32(regs+i*4,true),seed[i],name+' nonvolatile '+i);
  assert.deepEqual(mem.subarray(wa(stackBase),wa(stackBase)+256),new Uint8Array(frame),name+' stack/argument guards');
  return captured;
 }
 const data = Uint8Array.from({length:131072},(_,i)=>(i*37+23)&255);
 hostCtx.vfs.files.set('c:\\unmap-ranges.bin',{data,attrs:0x20});
 const file = hostCtx.vfs.createFile('c:\\unmap-ranges.bin',0xc0000000,3); assert.ok(file);
 const initial = e.unmap_backed();
 const section = call('CreateFileMappingA',[file,0,4,0,131072,0]).eax; assert.ok(section);
 const small = call('MapViewOfFile',[section,4,0,0,16]).eax; assert.ok(small);
 const large = call('MapViewOfFile',[section,2,0,0,131072]).eax;
 const tail = call('MapViewOfFile',[section,2,0,65536,16]).eax;
 assert.equal(large,small); assert.equal(tail,small+65536);
 e.guest_write8(large+65536,e.guest_read8(large+65536)^0x5a);
 assert.equal(e.guest_read8(tail),data[65536]^0x5a,'range alias');
 const expected = Buffer.from(data); expected[65536]^=0x5a;
 const neighbor = e.guest_map_alloc(4096)>>>0; assert.ok(neighbor);
 const neighborBytes = Buffer.from(memory.buffer,wa(neighbor),4096); neighborBytes.fill(0xa7);
 const neighborExpected = Buffer.from(neighborBytes);
 const liveBacking = e.unmap_backed(); assert.equal(liveBacking,initial+131072+4096);
 assert.equal(call('CloseHandle',[section]).eax,1,'close section before unmapping');
 const native = fs.readFileSync(path.join(__dirname,'fixtures/win98-file-mapping/native.serial.txt'),'utf8');
 const labels = ['UNMAP_SMALL','UNMAP_LARGE','UNMAP_TAIL','UNMAP_STALE'];
 const rows = [];
 for (const [i,address] of [small,large,tail,tail].entries()) {
  call('SetLastError',[0x1234]);
  const unmap = call('UnmapViewOfFile',[address]);
  const error = call('GetLastError',[]).eax;
  assert.equal(unmap.esp,stack+8,'Unmap immediate ESP+8');
  assert.equal(unmap.eax,i<3?1:0,'counted view BOOL');
  assert.deepEqual(neighborBytes,neighborExpected,'unrelated live allocation bytes');
  const backed = e.unmap_backed();
  assert.equal(backed,i<2?liveBacking:initial+4096,'backing survives until final closed-handle token');
  if(i===0) assert.deepEqual(Buffer.from(memory.buffer,wa(large),131072),expected,'base survives first counted unmap');
  if(i===1) assert.deepEqual(Buffer.from(memory.buffer,wa(tail),16),expected.subarray(65536,65552),'tail survives base retirement');
  const match = native.match(new RegExp('^'+labels[i]+' ok=(\\d+) error=(\\d+)$','m')); assert.ok(match);
  rows.push({label:labels[i],...unmap,error,backed,expectedError:Number(match[2])});
  assert.equal(unmap.eax,Number(match[1]),'retained native BOOL');
 }
 assert.equal(e.guest_map_free(neighbor),1); assert.equal(e.unmap_backed(),initial);
 assert.equal(call('CloseHandle',[file]).eax,1);
 console.log(JSON.stringify({calls,small,large,tail,initial,liveBacking,rows}));
 for(const row of rows) assert.equal(row.error,row.expectedError,row.label+' retained Win98 last error');
 return rows;
}
if(require.main===module) run().catch(err=>{console.error(err);process.exitCode=1;});
module.exports={run,extraWat};
