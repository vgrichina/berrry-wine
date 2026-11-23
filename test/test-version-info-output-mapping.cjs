#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.cwd();
const { bootRenderHarness } = require(path.join(root, 'test/render-helper'));
const apiTable = require(path.join(root, 'src/api_table.json'));
// Only the existing numeric prefix and the two existing NUL bytes are written.
// Structure size validation and the historical unsuffixed export are policy
// controls, not new Windows behavior inferred by this transport regression.
// https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-getversionexa
// https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-osversioninfoa
// https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-osversioninfow
const extraWat = String.raw`
 (func (export "vi_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "vi_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096) (local.get 1) (i32.const 4)))
 (func (export "vi_regs") (result i32) (global.get $reg_base))
 (func (export "vi_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "vi_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "vi_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "vi_error_seed") (global.set $last_error (i32.const 0x1234abcd)))
`;
// Literal expected bytes, deliberately not computed by decoding winver or by
// comparing A against W. Win98's 0x4000 build is existing emulator policy.
const versions = [
 {name:'Win98', value:0xc0000a04, fields:'040000000a00000000400000010000000000'},
 {name:'Win95', value:0x83b60004, fields:'0400000000000000b6030000010000000000'},
 {name:'NT4', value:0x05650004, fields:'040000000000000065050000020000000000'},
 {name:'Win2000', value:0x08930005, fields:'050000000000000093080000020000000000'},
 {name:'XP', value:0x0a280105, fields:'0500000001000000280a0000020000000000'},
];
const spellings = ['GetVersionExA', 'GetVersionExW', 'GetVersionEx'];
async function run() {
 const stats = {queries:0, comparisons:0, mappingFailures:0, controlFailures:0, examples:[]};
 function compare(actual, expected, label, mapping=false) {
  stats.comparisons++;
  if (Buffer.isBuffer(actual) ? actual.equals(expected) : actual === expected) return;
  stats[mapping ? 'mappingFailures' : 'controlFailures']++;
  if (stats.examples.length < 24) {
   let first = null;
   if (Buffer.isBuffer(actual)) for(let i=0;i<actual.length;i++) if(actual[i]!==expected[i]) {first=i;break;}
   stats.examples.push({label, first, actual:Buffer.isBuffer(actual)?actual.subarray(Math.max(0,first-4),first+24).toString('hex'):actual,
    expected:Buffer.isBuffer(expected)?expected.subarray(Math.max(0,first-4),first+24).toString('hex'):expected});
  }
 }
 const {exports:e, memory} = await bootRenderHarness({extraWat, fonts:'none', width:8, height:8});
 e.init_thread(1,0x400000,0,0,0,0,0); e.heap_init(0x800000); e.vi_init(); e.set_api_log(0);
 const mem = new Uint8Array(memory.buffer), view = new DataView(memory.buffer), regs = e.vi_regs()>>>0;
 const wa = p=>e.guest_to_wasm(p)>>>0;
 const alloc = n=>{const p=e.guest_alloc(n)>>>0; assert.ok(p); return p;};
 const put = (p,b)=>{for(let i=0;i<b.length;i++)e.guest_write8(p+i,b[i]);};
 const text = s=>{const b=Buffer.from(s+'\0'),p=alloc(b.length);put(p,b);return p;};
 const frame=alloc(256), stack=frame+64, direct=alloc(8192);
 view.setUint32(regs+16,stack,true);
 const module=e.vi_module(text('KERNEL32.DLL'))>>>0; assert.ok(module);
 const entries=new Map();
 for(const name of [...spellings,'GetVersion']) {
  view.setUint32(regs+16,stack,true);
  // A/W use real KERNEL32 PE export JMPs. The existing unsuffixed
  // compatibility export uses the main-image name fallback, as in the
  // original alias regression; do not expand KERNEL32's export policy.
  const legacy=name==='GetVersionEx';
  const stub=e.vi_resolve(legacy?e.get_image_base():module,text(name))>>>0, row=apiTable.find(r=>r.name===name);
  assert.ok(stub,name);
  if(!legacy)assert.equal(e.guest_read8(stub),0xe9,name+' public PE export JMP');
  const thunk=legacy?stub:(stub+5+(e.guest_read32(stub+1)|0))>>>0;
  assert.ok(thunk,name); assert.equal(row.convention,'stdcall');
  assert.equal(row.nargs,name==='GetVersion'?0:1);assert.equal(e.guest_read32(thunk+4),row.id);
  entries.set(name,{thunk,nargs:row.nargs});
 }
 function call(name,p) {
  const row=entries.get(name);
  mem.fill(0x5a,wa(frame),wa(frame)+256);e.guest_write32(stack,0x12345678);
  if(row.nargs)e.guest_write32(stack+4,p);
  const frameBefore=Buffer.from(mem.subarray(wa(frame),wa(frame)+256));
  const seed=[0x81234567,0x12345678,0x23456789,0x3456789a,stack,0x456789ab,0x56789abc,0x6789abcd];
  seed.forEach((x,i)=>view.setUint32(regs+i*4,x,true));
  e.vi_error_seed();e.vi_call(row.thunk);
  compare(e.get_esp()>>>0,stack+4+row.nargs*4,name+' ESP');
  compare(e.get_eip()>>>0,0x456789ab,name+' EIP');
  for(const i of [1,2,3,5,6,7])compare(view.getUint32(regs+i*4,true),seed[i],name+' register '+i);
  compare(Buffer.from(memory.buffer,wa(frame),256),frameBefore,name+' complete stack');
  compare(e.test_get_last_error()>>>0,0x1234abcd,name+' LastError');
  compare(e.guest_span_cursor_bytes(),0,name+' span cursor');
  compare(e.guest_span_overflow_count(),0,name+' span overflow');
  return e.get_eax()>>>0;
 }
 const fragmented=0x30000000, adjacent=0x31000000, aliased=0x32000000, decoys=[0x28000000,0x29000000];
 for(const p of [fragmented,decoys[0],fragmented+4096,decoys[1]])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(adjacent,8192)>>>0,adjacent);
 assert.equal(e.vi_alias(aliased,wa(fragmented)),1);assert.equal(e.vi_alias(aliased+4096,wa(fragmented)),1);
 assert.equal(wa(aliased),wa(aliased+4096));
 assert.equal(wa(decoys[0]),wa(fragmented)+4096);assert.equal(wa(decoys[1]),wa(fragmented+4096)+4096);
 assert.notEqual(wa(fragmented+4096),wa(fragmented)+4096);assert.equal(wa(adjacent+4096),wa(adjacent)+4096);
 const spans=[[wa(fragmented),4096],[wa(fragmented+4096),4096],...decoys.map(p=>[wa(p),4096]),[wa(adjacent),8192],[wa(direct),8192],[wa(0),32]];
 const actual=spans.map(([p,n])=>Buffer.from(memory.buffer,p,n)),expected=spans.map(([,n])=>Buffer.alloc(n));
 // The physical oracle uses the explicitly constructed two-page layout; it
 // never calls a guest reader, g2w, or the handler to obtain expected output.
 const layouts=[{name:'separate',base:fragmented,pages:[spans[0][0],spans[1][0]],mapping:true},
  {name:'adjacent',base:adjacent,pages:[spans[4][0],spans[4][0]+4096],mapping:false},
  {name:'aliased',base:aliased,pages:[spans[0][0],spans[0][0]],mapping:true},
  {name:'direct',base:direct,pages:[spans[5][0],spans[5][0]+4096],mapping:false}];
 function expectedByte(layout,offset,byte) {
  const physical=layout.pages[Math.floor(offset/4096)]+offset%4096;
  const i=spans.findIndex(([p,n])=>physical>=p&&physical<p+n);assert.ok(i>=0);
  expected[i][physical-spans[i][0]]=byte;
 }
 function query(layout,phase,name,version,poisons=[0x39,0xc7]) {
  const label=layout.name+'/'+phase+'/'+name+'/'+version.name+'/'+poisons.join(',');
  expected.forEach((b,i)=>b.fill(i===2?poisons[0]:i===3?poisons[1]:0x91+i));
  expected.forEach((b,i)=>actual[i].set(b));
  const size=name==='GetVersionExW'?276:148,p=layout.base+phase;
  const sizeBytes=Buffer.alloc(4);sizeBytes.writeUInt32LE(size);
  put(p,sizeBytes);sizeBytes.forEach((byte,i)=>expectedByte(layout,phase+i,byte));
  Buffer.from(version.fields,'hex').forEach((byte,i)=>expectedByte(layout,phase+4+i,byte));
  e.set_winver(version.value);
  compare(call(name,p),1,label+' BOOL');stats.queries++;
  actual.forEach((b,i)=>compare(b,expected[i],label+' full physical '+i,layout.mapping));
 }
 // Every spelling and version has its own literal contiguous controls.
 for(const version of versions) {
  e.set_winver(version.value);compare(call('GetVersion'),version.value,'raw GetVersion '+version.name);
  for(const name of spellings)for(let phase=0;phase<32;phase++)query(layouts[3],phase,name,version);
 }
 // Sweep every page phase, including cuts inside every written DWORD and
 // between the two NUL bytes. Mappings are reused for every query.
 for(let phase=0;phase<4096;phase++)for(const version of versions)for(const name of spellings)
  for(const layout of layouts.slice(0,3))query(layout,phase,name,version);
 // Each byte cut gets independent decoy poisons, followed by a contiguous
 // literal control; swapped decoys ensure neither physical successor is an oracle.
 for(const poisons of [[0,255],[255,0],[0xc7,0x39]])for(let cut=1;cut<=21;cut++)
  for(const version of versions)for(const name of spellings) {
   for(const layout of layouts.slice(0,3))query(layout,4096-cut,name,version,poisons);
   query(layouts[3],23,name,version,poisons);
  }
 console.log(JSON.stringify(stats));return stats;
}
module.exports={run};
if(require.main===module)run().then(s=>{assert.equal(s.controlFailures,0);assert.equal(s.mappingFailures,0);console.log('PASS version info output mapping and literal contiguous controls');}).catch(e=>{console.error(e);process.exitCode=1;});
