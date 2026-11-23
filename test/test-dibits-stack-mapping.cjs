#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const root=process.cwd(),{bootRenderHarness}=require(path.join(root,'test/render-helper'));
const apiTable=require(path.join(root,'src/api_table.json'));
// GetDIBits has seven stdcall arguments. The public dispatcher transports the
// first five; this regression independently exercises both remaining DWORDs.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getdibits
const extraWat=String.raw`
 (func (export "ds_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base)
   (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "ds_alias") (param i32 i32) (result i32)
  (call $guest_page_publish_range (local.get 0) (i32.const 4096) (local.get 1) (i32.const 4)))
 (func (export "ds_regs") (result i32) (global.get $reg_base))
 (func (export "ds_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "ds_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0)
   (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "ds_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u
   (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
`;
function info(height,bpp=32){const b=Buffer.alloc(64,0xa5);b.fill(0,0,40);b.writeUInt32LE(40,0);b.writeInt32LE(2,4);b.writeInt32LE(height,8);b.writeUInt16LE(1,12);b.writeUInt16LE(bpp,14);return b;}
// Source pixels, top row first, are black/white, white/black, white/white.
// They are independent of the renderer and every internal bitmap helper.
const sourcePixels=Buffer.from('00000000ffffff00ffffff0000000000ffffff00ffffff00','hex');
const rows32=[sourcePixels.subarray(0,8),sourcePixels.subarray(8,16),sourcePixels.subarray(16,24)];
const cases=[
 {name:'top',height:-3,start:0,count:3,rows:[0,1,2]},
 {name:'bottom',height:3,start:0,count:3,rows:[2,1,0]},
 {name:'top middle band',height:-3,start:1,count:1,rows:[1]},
 {name:'bottom middle band',height:3,start:1,count:1,rows:[1]},
 {name:'query',height:0,query:true,start:0,count:0},
 {name:'RGB mono',height:-3,bpp:1,start:0,count:3,rows:[0,1,2]},
 {name:'PAL mono',height:3,bpp:1,use:1,start:0,count:3,rows:[2,1,0]},
 ...[2,0x100,0x10000,0x1000000,0xffffffff].map(use=>({name:'unsupported usage '+use,height:-3,start:0,count:3,use,fail:true})),
 {name:'invalid bitmap',height:-3,start:0,count:3,invalid:true,fail:true},
 {name:'NULL BITMAPINFO',height:-3,start:0,count:3,nullInfo:true,fail:true},
 {name:'zero lines',height:-3,start:0,count:0,fail:true,headerOnly:true},
 {name:'past last line',height:3,start:3,count:1,fail:true,headerOnly:true},
];
async function run(options={}){
 const stats={calls:0,queries:0,comparisons:0,mappingFailures:0,controlFailures:0,argumentFailures:{bmi:0,usage:0,both:0},examples:[]};
 function compare(actual,expected,label,mapping=false){stats.comparisons++;if(Buffer.isBuffer(actual)?actual.equals(expected):JSON.stringify(actual)===JSON.stringify(expected))return;stats[mapping?'mappingFailures':'controlFailures']++;if(stats.examples.length<24)stats.examples.push({label,actual:Buffer.isBuffer(actual)?actual.toString('hex'):actual,expected:Buffer.isBuffer(expected)?expected.toString('hex'):expected});}
 const{exports:e,memory}=await bootRenderHarness({extraWat,width:8,height:8});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.ds_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),regs=e.ds_regs()>>>0;
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
 const put=(p,b)=>{for(let i=0;i<b.length;i++)e.guest_write8(p+i,b[i]);};
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));
 const text=s=>{const b=Buffer.from(s+'\0'),p=alloc(b.length);put(p,b);return p;};
 const ordinary=alloc(256)+64,out=alloc(320)+32,sourceInfo=alloc(96)+16,object=alloc(128),palData=alloc(12);
 const entries=new Map();dv.setUint32(regs+16,ordinary,true);const module=e.ds_module(text('GDI32.DLL'))>>>0;assert.ok(module);
 for(const name of['CreateCompatibleDC','CreateDIBSection','SelectObject','GetObjectA','GetPixel','GetDIBits','DeleteObject','DeleteDC','CreatePalette','SelectPalette']){
  dv.setUint32(regs+16,ordinary,true);const thunk=e.ds_resolve(module,text(name))>>>0,row=apiTable.find(r=>r.name===name);assert.ok(thunk);assert.equal(row.convention,'stdcall');assert.equal(e.guest_read32(thunk+4),row.id);entries.set(name,{thunk,nargs:row.nargs});
 }
 function call(name,args,stack=ordinary){const row=entries.get(name);assert.equal(args.length,row.nargs);e.guest_write32(stack,0x12345678);args.forEach((x,i)=>e.guest_write32(stack+4+i*4,x));const frame=read(stack,4+args.length*4),seed=[0x81234567,0x12345678,0x23456789,0x3456789a,stack,0x456789ab,0x56789abc,0x6789abcd];seed.forEach((x,i)=>dv.setUint32(regs+i*4,x,true));e.ds_call(row.thunk);stats.calls++;assert.equal(e.get_esp()>>>0,stack+4+args.length*4,name+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,name+' EIP');for(const i of[1,2,3,5,6,7])assert.equal(dv.getUint32(regs+i*4,true),seed[i],name+' register '+i);assert.deepEqual(read(stack,frame.length),frame,name+' complete frame');return e.get_eax()>>>0;}
 const dc=call('CreateCompatibleDC',[0]);assert.ok(dc);put(sourceInfo,info(-3));const bitmap=call('CreateDIBSection',[dc,sourceInfo,0,out,0,0]),bits=e.guest_read32(out)>>>0;assert.ok(bitmap&&bits);put(bits,sourcePixels);
 // Explicit reversed logical palette makes RGB and PAL BITMAPINFO tables
 // observably different. The source bitmap is unselected during GetDIBits.
 put(palData,Buffer.from('00030200ffffff0000000000','hex'));const palette=call('CreatePalette',[palData]);assert.ok(palette);const oldPalette=call('SelectPalette',[dc,palette,0]);
 put(object,Buffer.alloc(128,0x5d));assert.equal(call('GetObjectA',[bitmap,84,object]),24);const metadata=read(object,128),sourceGuard=read(bits-16,56);
 const oldBitmap=call('SelectObject',[dc,bitmap]);for(const[y,row]of[[0,[0,0xffffff]],[1,[0xffffff,0]],[2,[0xffffff,0xffffff]]])for(let x=0;x<2;x++)assert.equal(call('GetPixel',[dc,x,y]),row[x]);call('SelectObject',[dc,oldBitmap]);
 const fragmented=0x30000000,adjacent=0x31000000,repeated=0x32000000,decoys=[0x28000000,0x29000000];
 for(const p of[fragmented,decoys[0],fragmented+4096,decoys[1]])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(adjacent,8192)>>>0,adjacent);
 // Valid packed PTE aliases exercise two guest stack pages sharing one
 // physical backing page, in addition to repeated calls on each layout.
 assert.equal(e.ds_alias(repeated,wa(fragmented)),1);assert.equal(e.ds_alias(repeated+4096,wa(fragmented)),1);assert.equal(wa(repeated),wa(repeated+4096));
 assert.equal(wa(decoys[0]),wa(fragmented)+4096);assert.equal(wa(decoys[1]),wa(fragmented+4096)+4096);assert.notEqual(wa(fragmented+4096),wa(fragmented)+4096);assert.equal(wa(adjacent+4096),wa(adjacent)+4096);
 const direct=alloc(8192),stackSpans=[[wa(direct),8192],[wa(fragmented),4096],[wa(fragmented+4096),4096],...decoys.map(p=>[wa(p),4096]),[wa(adjacent),8192]];
 // Every mixed lpbmi value from the two physical-stack decoys points into a
 // dedicated, zero-sized BITMAPINFO in the direct window, never an accidental
 // invalid guest pointer. Only the actual argument points to the real header.
 const bmi=0x024262a0,decoyBmi=0x03537310,infoPointers=[];
 const a=Buffer.alloc(4),b=Buffer.alloc(4);a.writeUInt32LE(bmi);b.writeUInt32LE(decoyBmi);
 for(let mask=0;mask<16;mask++){const p=Buffer.from(a);for(let j=0;j<4;j++)if(mask>>j&1)p[j]=b[j];const v=p.readUInt32LE();if(!infoPointers.includes(v))infoPointers.push(v);}
 const infoPages=[...new Set(infoPointers.map(p=>p&~4095))];
 const observedSpans=[...stackSpans,...infoPages.map(p=>[wa(p),4096]),[wa(out)-16,288],[wa(bits)-16,56],[wa(sourceInfo)-16,96]];
 const observed=observedSpans.map(([p,n])=>Buffer.from(memory.buffer,p,n)),saved=observed.map(b=>Buffer.alloc(b.length));
 const controls=new Map();
 function query(c,stack,label,mapping=false,poison='both'){
  const failuresBefore=stats.mappingFailures;
  for(let i=0;i<stackSpans.length;i++){const[p,n]=stackSpans[i];mem.fill(0x91+i,p,p+n);}
  for(const p of infoPages)mem.fill(0xa5,wa(p),wa(p)+4096);
  for(const p of infoPointers)mem.fill(0,wa(p),wa(p)+64);
  const initial=info(c.height,c.query?0:(c.bpp||32));put(bmi,initial);mem.fill(0xa5,wa(out)-16,wa(out)+272);
  // The old handler's affine read lands on these serialized argument bytes
  // once it crosses the first physical page. Both decoys are independent.
  const decoyArg6=poison==='usage'?a:b,decoyArg7=Buffer.alloc(4,0x7e);if(poison==='bmi')decoyArg7.writeUInt32LE(c.use||0);
  for(const p of decoys){const w=wa(p);for(let at=24;at<32;at++){const offset=(stack+at)&4095;mem[w+offset]=at<28?decoyArg6[at-24]:decoyArg7[at-28];}}
  const args=[dc,c.invalid?0x7fffffff:bitmap,c.start,c.count,c.query?0:out,c.nullInfo?0:bmi,c.use||0];
  e.guest_write32(stack,0x12345678);args.forEach((x,i)=>e.guest_write32(stack+4+i*4,x));observed.forEach((v,i)=>v.copy(saved[i]));
  const result=call('GetDIBits',args,stack);stats.queries++;
  const expectedInfo=Buffer.from(initial),expectedOutput=Buffer.alloc(256,0xa5);
  let expectedResult=c.fail?0:c.query?3:c.count;
  if(c.query){expectedInfo.writeInt32LE(2,4);expectedInfo.writeInt32LE(3,8);expectedInfo.writeUInt16LE(32,14);}
  if(!c.fail&&!c.query){expectedInfo.writeUInt32LE(c.bpp===1?12:24,20);if(c.bpp===1){expectedInfo.writeUInt32LE(2,32);if(c.use===1){expectedInfo.writeUInt16LE(1,40);expectedInfo.writeUInt16LE(0,42);}else{expectedInfo.writeUInt32LE(0,40);expectedInfo.writeUInt32LE(0xffffff,44);}}
   c.rows.forEach((row,j)=>{if(c.bpp===1)expectedOutput[j*4]=[0x65,0xa5,0xe5][row];else rows32[row].copy(expectedOutput,j*8);});
  }
  compare(result,expectedResult,label+' literal return',mapping);compare(read(bmi,64),expectedInfo,label+' literal BITMAPINFO',mapping);compare(read(out,256),expectedOutput,label+' literal scanlines/padding/tail',mapping);
  // Only the real output and header may change. All physical stack pages,
  // decoys, alternate headers, source data and outer guards stay identical.
  for(let i=0;i<observed.length;i++){const expected=Buffer.from(saved[i]);if(i===stackSpans.length+infoPages.indexOf(bmi&~4095)&&!c.nullInfo)expectedInfo.copy(expected,bmi&4095);if(i===stackSpans.length+infoPages.length)expectedOutput.copy(expected,16);compare(observed[i],expected,label+' complete physical span '+i,mapping);}
  stats.argumentFailures[poison]+=stats.mappingFailures-failuresBefore;
  const actual={result,info:read(bmi,64).toString('hex'),output:read(out,256).toString('hex')};if(controls.has(c.name))compare(actual,controls.get(c.name),label+' original contiguous behavior',mapping);else controls.set(c.name,actual);
  assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);
 }
 for(const c of cases)query(c,direct+128,'direct '+c.name);
 // All stack phases include both every-byte cuts at ESP+24 and ESP+28,
 // boundaries before the arguments, and fully page-local controls. Repeat
 // reuse catches stale translations and accidental dependence on old bytes.
 // The two sweeps poison lpbmi and uUsage separately, so neither broken
 // argument can conceal the other one behind an early helper failure.
 for(let repeat=0;repeat<2;repeat++)for(let phase=0;phase<4096;phase++)for(const base of[adjacent,fragmented,repeated])for(const c of[cases[repeat?6:0],cases[1]])query(c,base+phase,'phase '+[repeat,phase,base,c.name],base!==adjacent,repeat?'usage':'bmi');
 for(const c of cases)for(let arg=24;arg<=28;arg+=4)for(let cut=0;cut<=4;cut++)for(const base of[adjacent,fragmented,repeated])query(c,base+4096-arg-cut,'cut '+[c.name,arg,cut,base],base!==adjacent);
 put(object,Buffer.alloc(128,0x5d));assert.equal(call('GetObjectA',[bitmap,84,object]),24);compare(read(object,128),metadata,'unchanged bitmap metadata');compare(read(bits-16,56),sourceGuard,'unchanged bitmap pixels and guards');
 call('SelectPalette',[dc,oldPalette,0]);assert.equal(call('DeleteObject',[palette]),1);assert.equal(call('DeleteObject',[bitmap]),1);assert.equal(call('DeleteDC',[dc]),1);
 if(options.report)options.report(stats);console.log(JSON.stringify(stats));
 if(options.expectParent){assert.ok(stats.argumentFailures.bmi>0,'sixth argument independently fails');assert.ok(stats.argumentFailures.usage>0,'seventh argument independently fails');assert.ok(stats.mappingFailures>0,'fresh parent must fail mapping');assert.equal(stats.controlFailures,0,'parent controls');}else{assert.equal(stats.mappingFailures,0,'mapping');assert.equal(stats.controlFailures,0,'controls');}
 return stats;
}
if(require.main===module)run({expectParent:process.argv.includes('--expect-parent')}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run,extraWat};
