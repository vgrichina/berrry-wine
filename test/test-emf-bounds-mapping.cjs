'use strict';
// Original CC0 EMF, authored as explicit documented EMR fields. No runtime,
// recorder, renderer, candidate helper, imported image or Windows/Wine input.
function fixture(){
 const record=(type,words=[])=>{const b=Buffer.alloc(8+4*words.length);b.writeUInt32LE(type);b.writeUInt32LE(b.length,4);words.forEach((v,i)=>b.writeUInt32LE(v>>>0,8+4*i));return b;};
 const records=[record(39,[1,0,0x000000ff,0]),record(37,[1]),record(37,[0x80000008]),
  record(33),record(24,[0x00010203]),record(33),record(25,[0x00040506]),record(34,[-1]),record(34,[-1]),
  record(43,[2,2,6,6]),record(14,[0,0,20])];
 const header=Buffer.alloc(88),total=88+records.reduce((n,b)=>n+b.length,0);
 header.writeUInt32LE(1);header.writeUInt32LE(88,4);
 [0,0,8,8].forEach((v,i)=>header.writeInt32LE(v,8+4*i));
 [0,0,800,800].forEach((v,i)=>header.writeInt32LE(v,24+4*i));
 header.writeUInt32LE(0x464d4520,40);header.writeUInt32LE(0x10000,44);
 header.writeUInt32LE(total,48);header.writeUInt32LE(records.length+1,52);header.writeUInt16LE(2,56);
 header.writeInt32LE(100,72);header.writeInt32LE(100,76);header.writeInt32LE(100,80);header.writeInt32LE(100,84);
 return Buffer.concat([header,...records]);
}
// Literal geometry for the single red [2,2,6,6] primitive in an 8x8 frame.
// Preserve existing emulator RECT geometry; NULL/zero/reversed are controls,
// not newly asserted undocumented Windows behavior.
const cases=[
 {name:'placed-scaled',rect:[8,4,40,36],paint:[16,12,32,28],ok:1},
 {name:'identity',rect:[0,0,8,8],paint:[2,2,6,6],ok:1},
 {name:'offset',rect:[24,12,40,28],paint:[28,16,36,24],ok:1},
 {name:'negative-origin',rect:[-8,-8,24,24],paint:[0,0,16,16],ok:1},
 {name:'reverse-x',rect:[40,4,8,36],paint:[16,12,32,28],ok:1},
 {name:'reverse-y',rect:[8,36,40,4],paint:[16,12,32,28],ok:1},
 {name:'reverse-both',rect:[40,36,8,4],paint:[16,12,32,28],ok:1},
 {name:'zero-width',rect:[8,4,8,36],paint:null,ok:0},
 {name:'zero-height',rect:[8,4,40,4],paint:null,ok:0},
 {name:'zero-both',rect:[8,4,8,4],paint:null,ok:0},
 {name:'NULL',rect:null,paint:[2,2,6,6],ok:1},
];
function pixels(paint,clip=[0,0,48,40]){
 const b=Buffer.alloc(48*40*4,255);
 if(paint)for(let y=Math.max(0,paint[1],clip[1]);y<Math.min(40,paint[3],clip[3]);y++)for(let x=Math.max(0,paint[0],clip[0]);x<Math.min(48,paint[2],clip[2]);x++){const o=(y*48+x)*4;b[o]=0;b[o+1]=0;b[o+2]=255;b[o+3]=0;}
 return b;
}
const path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.cwd(),{bootRenderHarness}=require(path.join(root,'test/render-helper'));
const apiTable=require(path.join(root,'src/api_table.json'));
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-playenhmetafile
// Exercise only the public guest RECT boundary. Internal physical callers retain
// their ABI. Literal pixels preserve existing geometry and record semantics.
const extraWat=String.raw`
 (func (export "emfb_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "emfb_regs") (result i32) (global.get $reg_base))
 (func (export "emfb_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "emfb_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "emfb_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "emfb_seed_error") (param i32) (global.set $last_error (local.get 0)))
 (func (export "emfb_error") (result i32) (global.get $last_error))
`;
const stats={calls:0,queries:0,pixelChecks:0,comparisons:0,mappingFailures:0,controlFailures:0,controlHashes:[],examples:[]};
function compare(actual,expected,label,mapping=false){
 stats.comparisons++;if(Buffer.isBuffer(actual)?actual.equals(expected):JSON.stringify(actual)===JSON.stringify(expected))return;
 stats[mapping?'mappingFailures':'controlFailures']++;
 if(stats.examples.length<24){let first=0;if(Buffer.isBuffer(actual))while(first<actual.length&&actual[first]===expected[first])first++;
  stats.examples.push({label,mapping,first,actual:Buffer.isBuffer(actual)?actual.subarray(first,first+20).toString('hex'):actual,expected:Buffer.isBuffer(expected)?expected.subarray(first,first+20).toString('hex'):expected});}
}
async function main(){
 const {exports:e,memory}=await bootRenderHarness({extraWat,fonts:'none',width:48,height:40});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.emfb_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),regs=e.emfb_regs()>>>0;
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
 const put=(p,b)=>b.forEach((v,i)=>e.guest_write8(p+i,v)),read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));
 const text=s=>{const b=Buffer.from(s+'\0'),p=alloc(b.length);put(p,b);return p;};
 const frame=alloc(256),stack=frame+64,unrelated=alloc(64),out=alloc(64),bmi=alloc(40),direct=alloc(8192);
 const thunks=new Map(),names=['CreateCompatibleDC','DeleteDC','SetEnhMetaFileBits','PlayEnhMetaFile','DeleteEnhMetaFile','CreateDIBSection','SelectObject','DeleteObject','GetCurrentObject','GetStockObject','SaveDC','RestoreDC','SetTextColor','GetTextColor','SetBkColor','GetBkColor','SetBkMode','GetBkMode','GetMapMode','GetROP2','GetPolyFillMode','GetStretchBltMode','IntersectClipRect','GetClipBox'];
 view.setUint32(regs+16,stack,true);const module=e.emfb_module(text('GDI32.DLL'))>>>0;assert.ok(module);
 for(const name of names){view.setUint32(regs+16,stack,true);const thunk=e.emfb_resolve(module,text(name))>>>0,row=apiTable.find(r=>r.name===name);assert.ok(thunk,name);assert.equal(row.convention,'stdcall');assert.equal(e.guest_read32(thunk+4),row.id);thunks.set(name,{thunk,nargs:row.nargs});}
 function call(name,args){
  const entry=thunks.get(name);assert.equal(args.length,entry.nargs);mem.fill(0x5a,wa(frame),wa(frame)+256);e.guest_write32(stack,0x12345678);args.forEach((x,i)=>e.guest_write32(stack+4+4*i,x));
  const before=read(frame,256),other=read(unrelated,64),seed=[0xa0123456,0x11223344,0x22334455,0x33445566,stack,0x44556677,0x55667788,0x66778899];seed.forEach((x,i)=>view.setUint32(regs+i*4,x,true));e.emfb_call(entry.thunk);stats.calls++;
  assert.equal(e.get_esp()>>>0,stack+4+args.length*4,name+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,name+' EIP');for(const i of [1,2,3,5,6,7])assert.equal(view.getUint32(regs+i*4,true),seed[i],name+' register '+i);
  assert.deepEqual(read(frame,256),before,name+' stack input');assert.deepEqual(read(unrelated,64),other);return e.get_eax()>>>0;
 }
 const original=fixture(),stream=alloc(original.length);put(stream,original);const emf=call('SetEnhMetaFileBits',[original.length,stream]);assert.ok(emf,'original EMF accepted');
 const base=0x30000000,adjacent=0x31000000,decoys=[0x28000000,0x29000000];
 for(const p of [base,decoys[0],base+4096,decoys[1]])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(adjacent,8192)>>>0,adjacent);assert.equal(wa(decoys[0]),wa(base)+4096);assert.equal(wa(decoys[1]),wa(base+4096)+4096);assert.notEqual(wa(base+4096),wa(base)+4096);assert.equal(wa(adjacent+4096),wa(adjacent)+4096);
 const spans=[[wa(direct),8192],[wa(base),4096],[wa(base+4096),4096],...decoys.map(p=>[wa(p),4096]),[wa(adjacent),8192]];
 const buffers=spans.map(([p,n])=>Buffer.from(mem.buffer,p,n));
 function target(){
  const dc=call('CreateCompatibleDC',[0]);assert.ok(dc);mem.fill(0,wa(bmi),wa(bmi)+40);e.guest_write32(bmi,40);e.guest_write32(bmi+4,48);e.guest_write32(bmi+8,-40);e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);
  const bitmap=call('CreateDIBSection',[dc,bmi,0,out,0,0]),bits=e.guest_read32(out)>>>0;assert.ok(bitmap);const oldBitmap=call('SelectObject',[dc,bitmap]);return{dc,bitmap,bits,oldBitmap};
 }
 const a=target(),b=target(),bits=t=>Buffer.from(mem.buffer,wa(t.bits),48*40*4),white=Buffer.alloc(48*40*4,255);
 const pixelGuards=[a,b].map(t=>[Buffer.from(mem.subarray(wa(t.bits)-16,wa(t.bits))),Buffer.from(mem.subarray(wa(t.bits)+white.length,wa(t.bits)+white.length+16))]);
 bits(b).fill(255);
 function state(t){const values=['GetTextColor','GetBkColor','GetBkMode','GetMapMode','GetROP2','GetPolyFillMode','GetStretchBltMode'].map(n=>call(n,[t.dc]));for(const type of [1,2,7])values.push(call('GetCurrentObject',[t.dc,type]));values.push(call('GetClipBox',[t.dc,out]));values.push(read(out,16).toString('hex'));return values;}
 call('SetTextColor',[a.dc,0x00123456]);call('SetBkColor',[a.dc,0x00654321]);call('SetBkMode',[a.dc,1]);call('SetTextColor',[b.dc,0x00aabbcc]);call('SetBkColor',[b.dc,0x00ccbbaa]);
 const bState=state(b);
 function query(c,p,label,mapping=false,clip=[0,0,48,40],dc=a,handle=emf){
  spans.forEach(([p,n],i)=>mem.fill(i===3?0:i===4?1:0x90+i,p,p+n));
  if(c.rect&&p){
   const input=Buffer.alloc(16);c.rect.forEach((x,i)=>input.writeInt32LE(x,4*i));put(p,input);
   // Deliberately plausible physical decoy coordinates keep a broken parent
   // bounded while detecting reads of the physical continuation. In particular
   // negative DWORD high bytes never turn into a multi-million-row rectangle.
   const cut=4096-(p&4095);
   if(cut<16&&wa(p+cut)!==wa(p)+cut){const alternate=Buffer.alloc(16);c.rect.forEach((x,i)=>alternate.writeInt32LE(x<0?x-4:x+4,4*i));mem.set(alternate.subarray(cut),wa(p)+cut);}
  }
  const before=buffers.map(b=>Buffer.from(b)),beforeState=state(dc),expected=pixels(handle===emf&&dc.dc!==0?c.paint:null,clip);
  bits(a).fill(255);bits(b).fill(255);e.emfb_seed_error(0x13579bdf);
  compare(call('PlayEnhMetaFile',[dc.dc,handle,p]),handle===emf&&dc.dc?c.ok:0,label+' BOOL',mapping);stats.queries++;
  compare(e.emfb_error()>>>0,0x13579bdf,label+' LastError',mapping);
  compare(bits(dc),expected,label+' literal full DIB pixels',mapping);stats.pixelChecks+=48*40;
  const other=dc===a?b:a;compare(bits(other),white,label+' independent DC pixels',mapping);
  buffers.forEach((buffer,i)=>compare(buffer,before[i],label+' full input/decoy backing '+i,mapping));
  compare(read(stream,original.length),original,label+' EMF immutable',mapping);
  compare(state(dc),beforeState,label+' caller DC state',mapping);compare(state(b),bState,label+' independent DC state',mapping);
  assert.equal(e.guest_span_cursor_bytes(),0,label+' span released');assert.equal(e.guest_span_overflow_count(),0,label+' no overflow');
  [a,b].forEach((t,i)=>{assert.deepEqual(Buffer.from(mem.subarray(wa(t.bits)-16,wa(t.bits))),pixelGuards[i][0]);assert.deepEqual(Buffer.from(mem.subarray(wa(t.bits)+white.length,wa(t.bits)+white.length+16)),pixelGuards[i][1]);});
  if(!mapping)stats.controlHashes.push({label,sha256:crypto.createHash('sha256').update(bits(dc)).digest('hex')});
 }
 for(const c of cases){
  if(!c.rect){for(let repeat=0;repeat<3;repeat++)query(c,0,c.name+'/'+repeat);continue;}
  for(let repeat=0;repeat<2;repeat++){
   for(let phase=0;phase<4;phase++)query(c,direct+32+phase,c.name+'/contiguous/'+repeat+'/'+phase);
   for(let cut=1;cut<16;cut++)for(const start of [adjacent,base])query(c,start+4096-cut,c.name+'/'+repeat+'/'+cut+'/'+start,start===base);
  }
 }
 // Independent DC playback and caller nesting exercise clipping after the EMF's
 // own two nested saves/restores. Every selected object and mode is checked.
 query(cases[0],base+4095,'independent playback',true,[0,0,48,40],b);
 assert.equal(call('SaveDC',[a.dc]),1);call('SetTextColor',[a.dc,0x000a0b0c]);assert.equal(call('IntersectClipRect',[a.dc,18,14,28,24]),2);
 assert.equal(call('SaveDC',[a.dc]),2);call('SetBkColor',[a.dc,0x00102030]);assert.equal(call('IntersectClipRect',[a.dc,20,16,26,22]),2);
 for(const [clip,label] of [[[20,16,26,22],'inner'],[[18,14,28,24],'outer']]){
  query(cases[0],direct+17,label+' contiguous clip',false,clip);
  for(let cut=1;cut<16;cut++)query(cases[0],base+4096-cut,label+' mapped clip '+cut,true,clip);
  assert.equal(call('RestoreDC',[a.dc,-1]),1);
 }
 query(cases[0],base+4095,'all caller levels restored',true);
 // Existing invalid-handle/DC outcomes remain controls; no invalid-page policy
 // or new Windows NULL/reversed-RECT policy is introduced by this transport fix.
 query(cases[0],direct+17,'invalid EMF',false,[0,0,48,40],a,0);
 for(const invalid of [0,0xdeadbeef]){
  const input=Buffer.alloc(16);cases[0].rect.forEach((x,i)=>input.writeInt32LE(x,4*i));put(direct+17,input);
  const backing=buffers.map(b=>Buffer.from(b)),states=[state(a),state(b)];bits(a).fill(255);bits(b).fill(255);e.emfb_seed_error(0x13579bdf);
  compare(call('PlayEnhMetaFile',[invalid,emf,direct+17]),0,'invalid DC BOOL '+invalid);compare(e.emfb_error()>>>0,0x13579bdf,'invalid DC LastError '+invalid);
  [a,b].forEach((t,i)=>{compare(bits(t),white,'invalid DC pixels '+i);compare(state(t),states[i],'invalid DC state '+i);});buffers.forEach((b,i)=>compare(b,backing[i],'invalid DC backing '+i));assert.equal(e.guest_span_cursor_bytes(),0);
 }
 for(const t of [a,b]){call('SelectObject',[t.dc,t.oldBitmap]);assert.equal(call('DeleteObject',[t.bitmap]),1);assert.equal(call('DeleteDC',[t.dc]),1);}assert.equal(call('DeleteEnhMetaFile',[emf]),1);
 console.log(JSON.stringify(stats));assert.equal(stats.controlFailures,0,'literal geometry/state/ABI controls');assert.equal(stats.mappingFailures,0,'all mapped RECT input cuts and pixels');console.log('PASS PlayEnhMetaFile public RECT mapping, literal pixels, full backing/decoys, immutability, independent DCs, nested SaveRestore/clip/state and stdcall');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
