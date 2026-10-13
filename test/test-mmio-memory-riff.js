'use strict';
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
const apis=require('../src/api_table.json');
const extraWat=`(func (export "riff_call") (param $id i32) (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $sp i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (local.get $sp))
 (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b) (local.get $c) (local.get $d) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))`;
const four=s=>Buffer.from(s).readUInt32LE();
function chunk(id,data){const h=Buffer.alloc(8);h.write(id);h.writeUInt32LE(data.length,4);return Buffer.concat([h,data,Buffer.alloc(data.length&1)]);}
(async()=>{
 let e,filePos=0,hostCalls=0;
 const wave=chunk('RIFF',Buffer.concat([Buffer.from('WAVE'),chunk('JUNK',Buffer.from('abc')),chunk('fmt ',Buffer.alloc(16,7)),chunk('data',Buffer.from('12345')),chunk('LIST',Buffer.concat([Buffer.from('INFO'),chunk('INAM',Buffer.from('xyz'))]))]));
 const bytes=Buffer.concat([wave,chunk('XTRA',Buffer.from('outside'))]);
 const {exports}=await bootRenderHarness({extraWat,fonts:'none',extraHostOverrides:{
  fs_set_file_pointer(h,n,origin){assert.strictEqual(h,0x70000131,'memory streams never call host seek');hostCalls++;filePos=origin===1?filePos+n:n;return filePos;},
  fs_read_file(h,p,n,out){assert.strictEqual(h,0x70000131,'memory streams never call host read');hostCalls++;const count=Math.min(n,bytes.length-filePos);for(let i=0;i<count;i++)e.guest_write8(p+i,bytes[filePos+i]);filePos+=count;e.guest_write32(out,count);return 1;}
 }});e=exports;
 const stack=e.guest_alloc(64),info=e.guest_alloc(72),out=e.guest_alloc(64);
 const fill=(p,n,v=0)=>{for(let i=0;i<n;i++)e.guest_write8(p+i,v);};
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));
 function call(name,a,b=0,c=0,d=0){const api=apis.find(x=>x.name===name);const result=e.riff_call(api.id,a,b,c,d,stack);assert.strictEqual(e.get_esp(),stack+4*(api.nargs+1),name+' stdcall');return result;}
 function open(data,p=e.guest_alloc(data.length)){for(let i=0;i<data.length;i++)e.guest_write8(p+i,data[i]);fill(info,72);e.guest_write32(info+4,four('MEM '));e.guest_write32(info+20,data.length);e.guest_write32(info+24,p);const h=call('mmioOpenA',0,info);assert(h);return h;}
 function ck(p,id='',type=''){fill(p,20);if(id)e.guest_write32(p,four(id));if(type)e.guest_write32(p+8,four(type));return p;}
 const pos=h=>call('mmioSeek',h,0,1);
 const direct=e.guest_alloc(80);
 // Three separately backed page pairs split the stream, output and parent fields.
 const bases=[0x38000000,0x39000000,0x3a000000];
 for(const p of bases){for(const q of [p,p+0x10000,p+4096])e.test_virtual_map_commit(q,4096);assert.notStrictEqual(e.guest_to_wasm(p+4096),e.guest_to_wasm(p)+4096);fill(p+0x10000,64,0xa7);}
 for(const sparse of [false,true]){
  const parent=sparse?bases[1]+4094:direct,child=sparse?bases[2]+4090:direct+24;
  const h=open(bytes,sparse?bases[0]+4092:undefined);
  ck(parent,'','WAVE');assert.strictEqual(call('mmioDescend',h,parent,0,0x20),0);
  assert.strictEqual(e.guest_read32(parent),four('RIFF'));assert.strictEqual(e.guest_read32(parent+4),wave.length-8);assert.strictEqual(e.guest_read32(parent+12),8);assert.strictEqual(pos(h),12);
  ck(child,'fmt ','NOPE');assert.strictEqual(call('mmioDescend',h,child,parent,0x10),0);assert.strictEqual(e.guest_read32(child+8),0,'plain chunk clears type');assert.strictEqual(e.guest_read32(child+12),32);assert.strictEqual(pos(h),32);
  assert.strictEqual(call('mmioRead',h,out,16),16);assert.deepStrictEqual(read(out,16),Buffer.alloc(16,7));assert.strictEqual(call('mmioAscend',h,child),0);assert.strictEqual(pos(h),48);
  ck(child,'data');assert.strictEqual(call('mmioDescend',h,child,parent,0x10),0);assert.strictEqual(call('mmioRead',h,out,5),5);assert.strictEqual(read(out,5).toString(),'12345');assert.strictEqual(call('mmioAscend',h,child),0);assert.strictEqual(pos(h),62,'odd chunk pad skipped');
  ck(child,'','INFO');assert.strictEqual(call('mmioDescend',h,child,parent,0x40),0);assert.strictEqual(pos(h),74);assert.strictEqual(e.guest_read32(child+12),70);
  const nested=e.guest_alloc(20);ck(nested,'INAM');assert.strictEqual(call('mmioDescend',h,nested,child,0x10),0);assert.strictEqual(call('mmioRead',h,out,3),3);assert.strictEqual(read(out,3).toString(),'xyz');assert.strictEqual(call('mmioAscend',h,nested),0);
  ck(child,'XTRA');assert.strictEqual(call('mmioDescend',h,child,parent,0x10),265,'does not search beyond parent');assert.strictEqual(call('mmioAscend',h,parent),0);assert.strictEqual(pos(h),wave.length);assert.strictEqual(call('mmioDescend',h,child,0,0x10),0,'outside chunk is independently readable');
  const old=pos(h);e.guest_write32(child+12,0xfffffff0);e.guest_write32(child+4,0x40);assert.strictEqual(call('mmioAscend',h,child),263);assert.strictEqual(pos(h),old,'failed seek preserves position');call('mmioClose',h);
 }
 for(const malformed of [Buffer.from('RIFF'),Buffer.from('RIFF\x02\0\0\0xx','binary'),Buffer.from('JUNK\xff\xff\xff\xff','binary'),Buffer.from('data\x04\0\0\0x','binary')]){const h=open(malformed);ck(direct);assert.strictEqual(call('mmioDescend',h,direct),265,'bounded malformed chunk rejection');call('mmioClose',h);}
 const h=open(bytes);ck(direct);e.guest_write32(direct+12,0xfffffff0);e.guest_write32(direct+4,0x40);ck(direct+24);assert.strictEqual(call('mmioDescend',h,direct+24,direct),265,'overflowing parent rejected');call('mmioClose',h);
 // A valid chunk before the parent range must not be returned.
 const bounded=open(bytes);ck(direct);e.guest_write32(direct+12,12);e.guest_write32(direct+4,bytes.length-12);ck(direct+24);assert.strictEqual(call('mmioDescend',bounded,direct+24,direct),265);assert.strictEqual(pos(bounded),0);call('mmioClose',bounded);
 // Chunk payload padding is relative to its size, not absolute file offset.
 for(const data of [Buffer.from('a'),Buffer.from('ab')]){const odd=open(Buffer.concat([Buffer.from([0]),chunk('data',data)]));call('mmioSeek',odd,1,0);ck(direct);assert.strictEqual(call('mmioDescend',odd,direct),0);assert.strictEqual(e.guest_read32(direct+12),9);assert.strictEqual(call('mmioAscend',odd,direct),0);assert.strictEqual(pos(odd),11);call('mmioClose',odd);}
 assert.strictEqual(hostCalls,0);
 ck(direct,'','WAVE');assert.strictEqual(call('mmioDescend',0x70000131,direct,0,0x20),0);assert.strictEqual(filePos,12);ck(direct+24,'fmt ');assert.strictEqual(call('mmioDescend',0x70000131,direct+24,direct,0x10),0);assert.strictEqual(filePos,32,'file search retains odd-sized chunk skip');assert.strictEqual(call('mmioAscend',0x70000131,direct),0);assert.strictEqual(filePos,wave.length);assert(hostCalls>0,'file path retains host IO');
 for(const p of bases)assert.deepStrictEqual(read(p+0x10000,64),Buffer.alloc(64,0xa7),'unrelated sparse backing untouched');
 console.log('PASS memory RIFF/LIST traversal, odd padding, parent bounds, malformed chunks, sparse buffers/structures, ABI and file delegation');
})().catch(error=>{console.error(error);process.exitCode=1;});
