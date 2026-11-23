'use strict';
// Original CC0 EMF bytes authored from the documented fixed fields and EMRs.
// Header expectations are literal input bytes, never recorder/helper output.
function fixture(size){
 const words=[39,24,1,0,0xff,0,37,12,1,37,12,0x80000008,33,8,24,12,0x00010203,33,8,25,12,0x00040506,34,12,0xffffffff,34,12,0xffffffff,43,24,2,2,6,6,14,20,0,0,20];
 const tail=Buffer.alloc(words.length*4);words.forEach((v,i)=>tail.writeUInt32LE(v>>>0,i*4));
 const h=Buffer.alloc(size);[1,size,0,0,8,8,0,0,800,800,0x464d4520,0x10000,size+tail.length,12].forEach((v,i)=>h.writeUInt32LE(v,i*4));h.writeUInt16LE(2,56);
 [100,100,100,100].forEach((v,i)=>h.writeUInt32LE(v,72+i*4));
 if(size>=108){h.writeUInt32LE(100000,100);h.writeUInt32LE(100000,104);}
 if(size>108){h.writeUInt32LE((size-108)/2,60);h.writeUInt32LE(108,64);for(let i=108;i<size-4;i+=2)h.writeUInt16LE(65+((i-108)/2)%26,i);}
 return {header:h,bytes:Buffer.concat([h,tail])};
}

'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),{bootRenderHarness}=require(path.join(root,'test/render-helper')),apiTable=require(path.join(root,'src/api_table.json'));
// Microsoft GetEnhMetaFileHeader/ENHMETAHEADER contracts. Existing emulator
// short-buffer, validation and LastError policies are regression controls.
const extraWat=String.raw`
 (func (export "emfh_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "emfh_regs") (result i32) (global.get $reg_base))
 (func (export "emfh_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "emfh_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "emfh_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "emfh_seed_error") (param i32) (global.set $last_error (local.get 0)))
 (func (export "emfh_error") (result i32) (global.get $last_error))
`;
async function run(){
 const stats={calls:0,queries:0,comparisons:0,mappingFailures:0,controlFailures:0,decoyCorruptions:0,pixelControls:0,examples:[]};
 function compare(actual,expected,label,mapping=false,decoy=false){stats.comparisons++;if(Buffer.isBuffer(actual)?actual.equals(expected):JSON.stringify(actual)===JSON.stringify(expected))return;stats[mapping?'mappingFailures':'controlFailures']++;if(decoy)stats.decoyCorruptions++;if(stats.examples.length<20){let first=0;if(Buffer.isBuffer(actual))while(first<actual.length&&actual[first]===expected[first])first++;stats.examples.push({label,first,actual:Buffer.isBuffer(actual)?actual.subarray(first,first+16).toString('hex'):actual,expected:Buffer.isBuffer(expected)?expected.subarray(first,first+16).toString('hex'):expected});}}
 const {exports:e,memory}=await bootRenderHarness({extraWat,fonts:'none',width:48,height:40});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.emfh_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),regs=e.emfh_regs()>>>0;
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
 const put=(p,b)=>{for(let i=0;i<b.length;){const n=Math.min(b.length-i,4096-((p+i)&4095));mem.set(b.subarray(i,i+n),wa(p+i));i+=n;}};
 const read=(p,n)=>{const b=Buffer.alloc(n);for(let i=0;i<n;){const k=Math.min(n-i,4096-((p+i)&4095));b.set(mem.subarray(wa(p+i),wa(p+i)+k),i);i+=k;}return b;};
 const text=s=>{const b=Buffer.from(s+'\0'),p=alloc(b.length);put(p,b);return p;};
 const frame=alloc(256),stack=frame+64,other=alloc(64),out=alloc(64),bmi=alloc(40),direct=alloc(32768),thunks=new Map();
 view.setUint32(regs+16,stack,true);const mod=e.emfh_module(text('GDI32.DLL'))>>>0;assert.ok(mod);
 const names=['GetEnhMetaFileHeader','SetEnhMetaFileBits','DeleteEnhMetaFile','SetMetaFileBitsEx','DeleteMetaFile','PlayEnhMetaFile','CreateCompatibleDC','DeleteDC','CreateDIBSection','SelectObject','DeleteObject','GetCurrentObject','GetStockObject','SaveDC','RestoreDC','SetTextColor','GetTextColor','SetBkColor','GetBkColor','SetBkMode','GetBkMode','GetMapMode','GetROP2','GetPolyFillMode','GetStretchBltMode','IntersectClipRect','GetClipBox'];
 for(const name of names){view.setUint32(regs+16,stack,true);const thunk=e.emfh_resolve(mod,text(name))>>>0,row=apiTable.find(r=>r.name===name);assert.ok(thunk,name);assert.equal(row.convention,'stdcall');assert.equal(e.guest_read32(thunk+4),row.id);thunks.set(name,{thunk,nargs:row.nargs});}
 function call(name,args){const entry=thunks.get(name);assert.equal(args.length,entry.nargs);mem.fill(0x5a,wa(frame),wa(frame)+256);e.guest_write32(stack,0x12345678);args.forEach((x,i)=>e.guest_write32(stack+4+4*i,x));const before=read(frame,256),unrelated=read(other,64),seed=[0xa0123456,0x11223344,0x22334455,0x33445566,stack,0x44556677,0x55667788,0x66778899];seed.forEach((x,i)=>view.setUint32(regs+i*4,x,true));e.emfh_call(entry.thunk);stats.calls++;assert.equal(e.get_esp()>>>0,stack+4+args.length*4,name+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,name+' EIP');for(const i of [1,2,3,5,6,7])assert.equal(view.getUint32(regs+i*4,true),seed[i],name+' register '+i);assert.deepEqual(read(frame,256),before,name+' stack immutable');assert.deepEqual(read(other,64),unrelated,name+' unrelated immutable');return e.get_eax()>>>0;}
 const fixtures=[88,108,20000].map(size=>{const f=fixture(size),p=alloc(f.bytes.length);put(p,f.bytes);const handle=call('SetEnhMetaFileBits',[f.bytes.length,p]);assert.ok(handle,'literal EMF '+size);return{...f,p,handle};});
 const base=0x30000000,adjacent=0x31000000,decoyA=0x28000000,decoyB=0x29000000,pages=12;
 const spans=[{p:wa(direct),n:32768,decoy:false}];
 for(let i=0;i<pages;i++)for(const [guest,decoy]of [[base+i*4096,false],[decoyA+i*4096,true],[decoyB+i*4096,true]]){assert.equal(e.test_virtual_map_commit(guest,4096)>>>0,guest);spans.push({p:wa(guest),n:4096,decoy});}
 assert.equal(e.test_virtual_map_commit(adjacent,pages*4096)>>>0,adjacent);spans.push({p:wa(adjacent),n:pages*4096,decoy:false});
 for(let i=0;i<pages;i++){assert.equal(wa(decoyA+i*4096),wa(base+i*4096)+4096);assert.equal(wa(decoyB+i*4096),wa(base+i*4096)+8192);if(i+1<pages){assert.notEqual(wa(base+(i+1)*4096),wa(base+i*4096)+4096);assert.equal(wa(adjacent+(i+1)*4096),wa(adjacent+i*4096)+4096);}}
 const buffers=spans.map(s=>Buffer.from(mem.buffer,s.p,s.n));
 function query(f,p,capacity,label,mapping=false,handle=f.handle){
  buffers.forEach((b,i)=>b.fill(0x81+i));const expected=buffers.map(b=>Buffer.from(b));
  const ok=handle===f.handle,ret=ok?(p?(capacity>=f.header.length?f.header.length:0):f.header.length):0;
  if(ret&&p){for(let i=0;i<f.header.length;){const at=wa(p+i),j=spans.findIndex(s=>at>=s.p&&at<s.p+s.n);assert.ok(j>=0);const n=Math.min(f.header.length-i,4096-((p+i)&4095));f.header.copy(expected[j],at-spans[j].p,i,i+n);i+=n;}}
  e.emfh_seed_error(0x13579bdf);compare(call('GetEnhMetaFileHeader',[handle,capacity,p]),ret,label+' return',mapping);stats.queries++;
  compare(e.emfh_error()>>>0,0x13579bdf,label+' LastError',mapping);
  buffers.forEach((b,i)=>compare(b,expected[i],label+' entire backing '+i,mapping,spans[i].decoy));
  fixtures.forEach(input=>compare(Buffer.from(mem.buffer,wa(input.p),input.bytes.length),input.bytes,label+' original stream '+input.header.length,mapping));
  assert.equal(e.guest_span_cursor_bytes(),0,label+' span cursor');assert.equal(e.guest_span_overflow_count(),0,label+' span overflow');
 }
 function target(){const dc=call('CreateCompatibleDC',[0]);assert.ok(dc);put(bmi,Buffer.alloc(40));e.guest_write32(bmi,40);e.guest_write32(bmi+4,48);e.guest_write32(bmi+8,-40);e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);const bitmap=call('CreateDIBSection',[dc,bmi,0,out,0,0]),bits=e.guest_read32(out)>>>0;assert.ok(bitmap&&bits);const old=call('SelectObject',[dc,bitmap]);return{dc,bitmap,bits,old};}
 const a=target(),b=target(),pixels=t=>Buffer.from(mem.buffer,wa(t.bits),48*40*4),white=Buffer.alloc(48*40*4,255),rect=alloc(16);
 [8,4,40,36].forEach((v,i)=>e.guest_write32(rect+4*i,v));
 function state(t){const s=['GetTextColor','GetBkColor','GetBkMode','GetMapMode','GetROP2','GetPolyFillMode','GetStretchBltMode'].map(n=>call(n,[t.dc]));for(const type of [1,2,7])s.push(call('GetCurrentObject',[t.dc,type]));s.push(call('GetClipBox',[t.dc,out]));s.push(read(out,16).toString('hex'));return s;}
 call('SetTextColor',[a.dc,0x00123456]);call('SetBkColor',[a.dc,0x00654321]);call('SetBkMode',[a.dc,1]);call('SetTextColor',[b.dc,0x00aabbcc]);
 const independent=state(b),initial=state(a);
 function play(f,t,label,clip=[0,0,48,40]){const before=state(t),other=t===a?b:a;pixels(a).fill(255);pixels(b).fill(255);const input=read(f.p,f.bytes.length),bounds=read(rect,16);assert.equal(call('PlayEnhMetaFile',[t.dc,f.handle,rect]),1);const expected=Buffer.from(white);for(let y=Math.max(12,clip[1]);y<Math.min(28,clip[3]);y++)for(let x=Math.max(16,clip[0]);x<Math.min(32,clip[2]);x++){const at=(y*48+x)*4;expected[at]=0;expected[at+1]=0;expected[at+2]=255;expected[at+3]=0;}compare(pixels(t),expected,label+' literal red rectangle pixels');compare(pixels(other),white,label+' independent DIB');compare(state(t),before,label+' state');compare(read(f.p,f.bytes.length),input,label+' immutable EMF');compare(read(rect,16),bounds,label+' immutable bounds');stats.pixelControls++;}
 for(const f of fixtures){play(f,a,'before '+f.header.length);for(let phase=0;phase<4;phase++)for(const cap of [0,1,f.header.length-1,f.header.length,f.header.length+37,0xffffffff])query(f,direct+32+phase,cap,'direct phase/capacity '+phase+'/'+cap);for(const cap of [0,1,f.header.length-1,f.header.length,0xffffffff])query(f,0,cap,'NULL/'+cap);
  for(let cut=1;cut<f.header.length;cut++)for(const start of [base,adjacent])query(f,start+6*4096-cut,f.header.length,'every header byte split '+f.header.length+'/'+cut+'/'+start,start===base);
  for(let phase=0;phase<4096;phase++)query(f,base+4096+phase,f.header.length+7,'all DWORD/page phases '+f.header.length+'/'+phase,true);
  for(let repeat=0;repeat<3;repeat++)for(const start of [base,adjacent])for(const cap of [0,f.header.length-1,f.header.length,f.header.length+37])query(f,start+4095,cap,'repeat/capacity '+repeat+'/'+start+'/'+cap,start===base);
  play(f,a,'after '+f.header.length);compare(state(a),initial,'header calls preserve DC');compare(state(b),independent,'header calls preserve independent DC');
 }
 const f=fixtures[0],dead=call('SetEnhMetaFileBits',[f.bytes.length,f.p]);assert.ok(dead);assert.equal(call('DeleteEnhMetaFile',[dead]),1);
 const wmfBytes=Buffer.from('0100090000030c0000000000030000000000030000000000','hex'),wmfInput=alloc(wmfBytes.length);put(wmfInput,wmfBytes);const wmf=call('SetMetaFileBitsEx',[wmfBytes.length,wmfInput]);assert.ok(wmf,'wrong-type WMF');
 for(const handle of [0,0xdeadbeef,dead,wmf,a.dc,call('GetStockObject',[0])])for(const p of [0,direct+17,base+4095])for(const cap of [0,1,88,20000])query(f,p,cap,'invalid/wrong/deleted '+handle+'/'+p+'/'+cap,p===base+4095,handle);
 assert.equal(call('SaveDC',[a.dc]),1);call('SetTextColor',[a.dc,0x000a0b0c]);assert.equal(call('IntersectClipRect',[a.dc,18,14,28,24]),2);const outer=state(a);assert.equal(call('SaveDC',[a.dc]),2);call('SetBkColor',[a.dc,0x00102030]);assert.equal(call('IntersectClipRect',[a.dc,20,16,26,22]),2);const inner=state(a);
 for(const [s,clip,label]of [[inner,[20,16,26,22],'inner'],[outer,[18,14,28,24],'outer']]){for(const f of fixtures){query(f,base+4095,f.header.length,'nested '+label,true);compare(state(a),s,'nested header state '+label);play(f,a,'nested playback '+label,clip);}assert.equal(call('RestoreDC',[a.dc,-1]),1);}
 compare(state(a),initial,'all caller saves restored');play(fixtures[1],b,'independent public playback');compare(state(b),independent,'independent DC unchanged');
 assert.equal(call('DeleteMetaFile',[wmf]),1);for(const f of fixtures)assert.equal(call('DeleteEnhMetaFile',[f.handle]),1);for(const t of [a,b]){call('SelectObject',[t.dc,t.old]);assert.equal(call('DeleteObject',[t.bitmap]),1);assert.equal(call('DeleteDC',[t.dc]),1);}
 stats.fixtureHashes=fixtures.map(f=>({size:f.header.length,sha256:crypto.createHash('sha256').update(f.bytes).digest('hex')}));console.log(JSON.stringify(stats));return stats;
}
module.exports={run};
if(require.main===module)run().then(s=>{assert.equal(s.controlFailures,0,'independent public controls');assert.equal(s.mappingFailures,0,'all header output mapping cases');console.log('PASS GetEnhMetaFileHeader mapping, literal headers, full backing/decoys, ABI, state and public EMF pixels');}).catch(e=>{console.error(e);process.exitCode=1;});
