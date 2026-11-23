#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const root=process.cwd(),{bootRenderHarness}=require(path.join(root,'test/render-helper'));
const apiTable=require(path.join(root,'src/api_table.json'));
// RECT is four signed LONGs in logical coordinates. These tests use MM_TEXT
// and positive integer scales without rotations or rounding ambiguity.
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-rectvisible
// https://learn.microsoft.com/en-us/windows/win32/api/windef/ns-windef-rect
const extraWat=String.raw`
 (func (export "rv_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "rv_regs") (result i32) (global.get $reg_base))
 (func (export "rv_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "rv_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "rv_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "rv_error_seed") (global.set $last_error (i32.const 0x1234abcd)))
`;
async function run(){
 const stats={calls:0,queries:0,comparisons:0,mappingFailures:0,controlFailures:0,examples:[]};
 function compare(a,b,label,mapping=false){stats.comparisons++;if(Buffer.isBuffer(a)?a.equals(b):a===b)return;stats[mapping?'mappingFailures':'controlFailures']++;if(stats.examples.length<24)stats.examples.push({label,actual:Buffer.isBuffer(a)?a.toString('hex').slice(0,64):a,expected:Buffer.isBuffer(b)?b.toString('hex').slice(0,64):b});}
 const{exports:e,memory}=await bootRenderHarness({extraWat,fonts:'none',width:64,height:64});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.rv_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),v=new DataView(memory.buffer),regs=e.rv_regs()>>>0;
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
 const put=(p,b)=>b.forEach((x,i)=>e.guest_write8(p+i,x));
 const read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));
 const text=s=>{const p=alloc(s.length+1);put(p,Buffer.from(s+'\0'));return p;};
 const frame=alloc(256),stack=frame+64,other=alloc(64),direct=alloc(128),bmi=alloc(40),out=alloc(4);
 v.setUint32(regs+16,stack,true);const module=e.rv_module(text('GDI32.DLL'))>>>0;assert.ok(module);
 const entries=new Map();
 for(const name of ['RectVisible','PtVisible','CreateCompatibleDC','DeleteDC','CreateDIBSection','SelectObject','DeleteObject','CreateRectRgn','CombineRgn','SelectClipRgn','IntersectClipRect','ExcludeClipRect','SaveDC','RestoreDC','SetMapMode','SetWindowExtEx','SetViewportExtEx','SetWindowOrgEx','SetViewportOrgEx']){
  v.setUint32(regs+16,stack,true);const thunk=e.rv_resolve(module,text(name))>>>0,row=apiTable.find(r=>r.name===name);assert.ok(thunk,name);assert.equal(row.convention,'stdcall');assert.equal(e.guest_read32(thunk+4),row.id);entries.set(name,{thunk,nargs:row.nargs});
 }
 function call(name,args){const entry=entries.get(name);assert.equal(args.length,entry.nargs);
  mem.fill(0x5a,wa(frame),wa(frame)+256);e.guest_write32(stack,0x12345678);args.forEach((x,i)=>e.guest_write32(stack+4+i*4,x));
  const before=read(frame,256),untouched=read(other,64),seed=[0xa0123456,0x11223344,0x22334455,0x33445566,stack,0x44556677,0x55667788,0x66778899];seed.forEach((x,i)=>v.setUint32(regs+i*4,x,true));
  e.rv_call(entry.thunk);stats.calls++;assert.equal(e.get_esp()>>>0,stack+4+args.length*4,name+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,name+' EIP');for(const i of [1,2,3,5,6,7])assert.equal(v.getUint32(regs+i*4,true),seed[i],name+' register '+i);assert.deepEqual(read(frame,256),before,name+' entire stack');assert.deepEqual(read(other,64),untouched);assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);return e.get_eax()>>>0;
 }
 const dc=call('CreateCompatibleDC',[0]),dc2=call('CreateCompatibleDC',[0]);assert.ok(dc&&dc2);
 // A real selected 64x64 DIB gives explicit target bounds for both DCs.
 put(bmi,Buffer.from('2800000040000000c0ffffff01002000000000000000000000000000000000000000000000000000','hex'));
 const bitmaps=[],oldBitmaps=[];
 for(const d of [dc,dc2]){const b=call('CreateDIBSection',[d,bmi,0,out,0,0]);assert.ok(b);bitmaps.push(b);oldBitmaps.push(call('SelectObject',[d,b]));}
 const region=call('CreateRectRgn',[10,10,30,30]);assert.ok(region);assert.equal(call('SelectClipRgn',[dc,region]),2);assert.equal(call('DeleteObject',[region]),1);
 const base=0x30000000,decoy=0x28000000,after=0x29000000,adjacent=0x31000000;
 for(const p of [base,decoy,base+4096,after])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(adjacent,8192)>>>0,adjacent);
 assert.equal(wa(decoy),wa(base)+4096);assert.equal(wa(after),wa(base+4096)+4096);assert.notEqual(wa(base+4096),wa(base)+4096);assert.equal(wa(adjacent+4096),wa(adjacent)+4096);
 const spans=[[wa(base),4096],[wa(decoy),4096],[wa(base+4096),4096],[wa(after),4096],[wa(adjacent),8192],[wa(direct),128],[wa(0),32]];
 const physical=spans.map(([p,n])=>Buffer.from(memory.buffer,p,n));
 function query(p,rect,want,label,target=dc,poison=0x7f){
  spans.forEach(([s,n],i)=>mem.fill(i===1||i===3?poison:0x91+i,s,s+n));const b=Buffer.alloc(16);rect.forEach((x,i)=>b.writeInt32LE(x,i*4));put(p,b);
  const before=physical.map(b=>Buffer.from(b)),mapping=p>=base&&p<base+8192;
  e.rv_error_seed();compare(call('RectVisible',[target,p]),want,label,mapping);compare(e.test_get_last_error()>>>0,0x1234abcd,label+' LastError');stats.queries++;
  physical.forEach((b,i)=>compare(b,before[i],label+' entire backing '+i));compare(read(p,16),b,label+' input unchanged');
 }
 const cases=[['visible',[12,13,18,19],1],['partial',[8,8,12,12],1],['outside',[31,32,38,39],0],['empty',[0,0,0,0],0],['touching',[30,12,35,18],0]];
 for(let phase=0;phase<4096;phase++)for(const [label,rect,want] of cases)for(const start of [adjacent,base])query(start+phase,rect,want,label+'/'+phase+'/'+start.toString(16));
 for(const poison of [0,0x7f])for(let cut=1;cut<16;cut++)for(const [label,rect,want] of cases){query(base+4096-cut,rect,want,label+'/cut'+cut+'/'+poison,dc,poison);query(direct+17,rect,want,label+'/direct');}
 // Per-DC isolation and nested SaveDC/RestoreDC keep their original policy.
 query(base+4091,[31,32,38,39],1,'independent DC',dc2);
 const saved=call('SaveDC',[dc]);assert.ok(saved);assert.equal(call('IntersectClipRect',[dc,15,15,25,25]),2);
 query(base+4093,[12,12,14,14],0,'intersection');query(base+4087,[14,14,16,16],1,'intersection partial');
 const nested=call('SaveDC',[dc]);assert.ok(nested);assert.equal(call('ExcludeClipRect',[dc,15,15,25,25]),1);query(base+4095,[16,16,18,18],0,'empty clip');
 assert.equal(call('RestoreDC',[dc,-1]),1);query(base+4094,[16,16,18,18],1,'nested restore');assert.equal(call('RestoreDC',[dc,saved]),1);query(base+4081,[12,12,14,14],1,'outer restore');
 // Literal two-band union, including its gap; avoid bounding-box oracles.
 const left=call('CreateRectRgn',[10,10,15,20]),right=call('CreateRectRgn',[25,10,30,20]),union=call('CreateRectRgn',[0,0,0,0]);assert.ok(left&&right&&union);
 assert.equal(call('CombineRgn',[union,left,right,2]),3);assert.equal(call('SelectClipRgn',[dc,union]),3);for(const r of [left,right,union])assert.equal(call('DeleteObject',[r]),1);
 for(let cut=1;cut<16;cut++){query(base+4096-cut,[17,12,23,18],0,'complex gap');query(base+4096-cut,[14,12,26,18],1,'complex bridge');}
 // Integer scaling plus origins: logical (3,4)..(5,6) -> device
 // (11,12)..(15,18). SelectClipRgn coordinates remain device coordinates.
 assert.equal(call('SetMapMode',[dc,8]),1);assert.equal(call('SetWindowExtEx',[dc,1,1,0]),1);assert.equal(call('SetViewportExtEx',[dc,2,3,0]),1);assert.equal(call('SetWindowOrgEx',[dc,1,2,0]),1);assert.equal(call('SetViewportOrgEx',[dc,7,6,0]),1);
 for(let cut=1;cut<16;cut++){query(base+4096-cut,[3,4,5,6],1,'scaled visible');query(base+4096-cut,[7,4,9,6],0,'scaled gap');}
 compare(call('PtVisible',[dc,3,4]),1,'public point control');compare(call('PtVisible',[dc,7,4]),0,'public point gap');
 for(let i=0;i<2;i++){call('SelectObject',[[dc,dc2][i],oldBitmaps[i]]);assert.equal(call('DeleteObject',[bitmaps[i]]),1);assert.equal(call('DeleteDC',[[dc,dc2][i]]),1);}
 console.log(JSON.stringify(stats));return stats;
}
module.exports={run};if(require.main===module)run().then(s=>{assert.equal(s.controlFailures,0);assert.equal(s.mappingFailures,0);console.log('PASS RectVisible input mapping and DC controls');}).catch(e=>{console.error(e);process.exitCode=1;});
