'use strict';
// Actual owning x86 COM-thunk contract for the bounded DX7VB BMP image path.
// Allocation faults are test-only wrappers around the real allocator.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const extraWat=String.raw`
;; The image checks below are 16 bpp; an unset depth now reports the 32-bpp
;; desktop, and a surface loaded without a pixel format takes the display's.
(func (export "vb_display16") (call $dx_display_bpp_set (i32.const 16)))
(func (export "vb_factory") (param $out i32)
 (call $handle_IDirectX7_DirectDrawCreate (i32.const 0) (i32.const 0) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "vb_sync") (result i32)
 (global.set $DX_VTBL_VBIMAGE7 (i32.const 0)) (call $dx_sync_thread_vtables) (global.get $DX_VTBL_VBIMAGE7))
(func (export "vb_refs") (param $obj i32) (result i32)
 (load.field DxObject refcount (call $dx_from_this (local.get $obj))))
(func (export "vb_registry") (result i32) (global.get $DX_VTBL_REGISTRY))
(func (export "vb_registry_size") (result i32) (global.get $DX_VTBL_REGISTRY_SIZE))
(func (export "vb_registry_count") (result i32) (global.get $DX_VTBL_REGISTRY_COUNT))
(func (export "vb_registry_append") (param $v i32) (call $dx_vtable_registry_append (local.get $v)))
(func (export "vb_vidmem") (result i32) (global.get $dx_vidmem_used))
(func (export "vb_bits") (param $obj i32) (result i32) (load.field DxObject misc1 (call $dx_from_this (local.get $obj))))
(func (export "vb_pitch") (param $obj i32) (result i32) (load.field DxObject pitch (call $dx_from_this (local.get $obj))))
(func (export "vb_bpp") (param $obj i32) (result i32) (load.field DxObject bpp (call $dx_from_this (local.get $obj))))
`;
async function run(h,apis){
 const e=h.exports,write=(p,v)=>e.guest_write32(p,v),read=p=>e.guest_read32(p)>>>0,alloc=n=>e.guest_alloc(n)>>>0;
 const bytes=new Uint8Array(h.memory.buffer);let cases=0;
 const check=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
 const exe=fs.readFileSync(path.join(__dirname,'binaries/notepad.exe'));bytes.set(exe,e.get_staging());assert(e.load_pe(exe.length)>0);e.init_dx_com_thunks();
 const out=alloc(4),desc=alloc(240),stack=alloc(256);e.vb_display16();e.vb_factory(out);const owner=read(out);assert(owner);
 const call=(object,slot,...args)=>{const thunk=read(read(object)+slot*4),api=apis[read(thunk+4)];assert(api,'known actual API');assert.equal(read(thunk),0xcaca0010);assert.equal(api.nargs,args.length+1,api.name+' nargs');write(stack,0);[object,...args].forEach((v,i)=>write(stack+4+i*4,v));e.set_esp(stack);e.set_eip(thunk);e.run(1);assert.equal(e.get_eip(),0);assert.equal(e.get_esp()>>>0,stack+(api.nargs+1)*4,api.name+' cleanup');return e.get_eax()>>>0;};
 const bstr=text=>{const p=alloc(6+text.length*2);write(p,text.length*2);for(let i=0;i<text.length;i++)e.guest_write16(p+4+i*2,text.charCodeAt(i));e.guest_write16(p+4+text.length*2,0);return p+4;};
 const reset=()=>{for(let i=0;i<240;i++)e.guest_write8(desc+i,0);write(desc,0xabcdef01);write(desc+236,0xabcdef02);write(out,0xcccccccc);};
 const input=bstr('C:\\图.bmp');h.hostCtx.vfs.files.set('c:\\图.bmp',{data:new Uint8Array(fs.readFileSync(path.join(__dirname,'fixtures/vbdd-image-helpers/asymmetric.bmp'))),attrs:0x20});
 reset();check('real owner image thunk produces owned VB image and ESP20',()=>{assert.equal(call(owner,8,input,desc+4,out),0);assert(read(out));assert.equal(read(desc+4+8),128);assert.equal(read(desc+4+12),128);assert.equal(read(desc),0xabcdef01);assert.equal(read(desc+236),0xabcdef02);});
 const image=read(out),table=read(image);assert.equal(e.vb_refs(image),1);
 check('COM image output contains actual fixture pixels, not a blank placeholder',()=>{
  const fixture=fs.readFileSync(path.join(__dirname,'fixtures/vbdd-image-helpers/asymmetric.bmp')),bits=e.vb_bits(image)>>>0,pitch=e.vb_pitch(image)>>>0,bpp=e.vb_bpp(image),v=new DataView(h.memory.buffer);assert.equal(bpp,16);
  for(const [x,y] of [[0,0],[127,0],[0,127],[127,127],[31,47]]){const s=54+(127-y)*384+x*3,pack=(c,n)=>Math.floor((c*n+127)/255);assert.equal(v.getUint16(bits+y*pitch+x*2,true),(pack(fixture[s+2],31)<<11)|(pack(fixture[s+1],63)<<5)|pack(fixture[s],31));}
 });
 check('complete 71-slot exact ABI and shared-table synchronization',()=>{for(let i=0;i<71;i++){const thunk=read(table+i*4),api=apis[read(thunk+4)];assert.equal(read(thunk),0xcaca0010);assert.equal(api.name.split('_')[0],'IVBImageSurface7');}assert.equal(e.vb_sync()>>>0,table);});
 const iid=alloc(16),iidBad=alloc(16),iidU=alloc(16);[0x9f76fde8,0x11d18e92,0xc0000888,0x02c6c24f].forEach((v,i)=>{write(iid+i*4,v);write(iidBad+i*4,v);});write(iidBad+12,0);[0,0,0xc0,0x46000000].forEach((v,i)=>write(iidU+i*4,v));
 check('IUnknown/VB full GUID identity with paired reference ownership',()=>{for(const p of [iid,iidU]){assert.equal(call(image,0,p,out),0);assert.equal(read(out),image);assert.equal(read(image),table);assert.equal(e.vb_refs(image),2);assert.equal(call(image,2),1);}assert.equal(call(image,0,iidBad,out),0x80004002);assert.equal(read(out),0);assert.equal(e.vb_refs(image),1);});
 const base=0x38000000,neighbor=base+0x10000;for(const p of [base,neighbor,base+4096])e.test_virtual_map_commit(p,4096);assert.notEqual(e.guest_to_wasm(base+4096),e.guest_to_wasm(base)+4096);for(let i=0;i<256;i++)e.guest_write8(neighbor+i,0xa7);
 check('sparse-cross-page GetSurfaceDesc232 and GUID do not touch adjacent backing',()=>{const split=base+4091;for(let i=0;i<16;i++)e.guest_write8(split+i,e.guest_read8(iid+i));assert.equal(call(image,0,split,out),0);assert.equal(read(out),image);assert.equal(call(image,2),1);assert.equal(call(image,40,split),0);assert.equal(read(split+8),128);assert.equal(read(split+12),128);for(let i=0;i<256;i++)assert.equal(e.guest_read8(neighbor+i),0xa7);});
 check('unsupported surface slots fail with exact real-thunk stdcall cleanup',()=>{for(let i=0;i<71;i++){const api=apis[read(read(table+i*4)+4)];if(api.stub)assert.equal(call(image,i,...Array(api.nargs-1).fill(0)),0x80004001,api.name);}});
 check('frontdoor failure never publishes image, keeps canaries and cleanup20',()=>{for(const [name,s,d,o,want] of [['empty',0,desc+4,out,0x800a0035],['bad-prefix',1,desc+4,out,0x80004003],['descriptor',input,0,out,0x80004003],['output',input,desc+4,0,0x80004003],['missing',bstr('C:\\missing.bmp'),desc+4,out,0x80004005]]){reset();assert.equal(call(owner,8,s,d,o),want,name);if(o)assert.equal(read(out),0);assert.equal(read(desc),0xabcdef01);assert.equal(read(desc+236),0xabcdef02);}});
 check('failure at each owned heap/DIB allocation publishes nothing and releases resources',()=>{
  assert.equal(typeof e.vb_fault_arm,'function','driver must include test-only allocator wrapper transform');
  for(const [heap,dib] of [...Array.from({length:6},(_,i)=>[i+1,0]),[0,1],[0,2]]){
   reset();const used=e.vb_vidmem();e.vb_fault_arm(heap,dib);
   try{assert.notEqual(call(owner,8,input,desc+4,out),0,`heap${heap}/DIB${dib}`);assert.equal(read(out),0);assert.equal(e.vb_heap_balance(),0);assert.equal(e.vb_dib_balance(),0);assert.equal(e.vb_vidmem(),used);}
   finally{e.vb_fault_disarm();}
  }
 });
 const peer=(await WebAssembly.instantiate(h.module,{host:h.host})).exports;
 // Match the shipping Worker's initGuestThread path, including the executable
 // thunk interval; zero thunk bounds cannot execute a real COM thunk.
 peer.init_thread(1,e.get_image_base(),e.get_code_start(),e.get_code_end(),e.get_thunk_base(),e.get_thunk_end(),e.get_num_thunks());
 check('actual auxiliary instance restores dedicated shared vtable and reads image descriptor',()=>{
  assert.equal(peer.vb_sync()>>>0,table);const peerStack=alloc(128),thunk=read(table+40*4);write(peerStack,0);write(peerStack+4,image);write(peerStack+8,desc+4);peer.set_esp(peerStack);peer.set_eip(thunk);peer.run(1);assert.equal(peer.get_eip(),0);assert.equal(peer.get_eax(),0);assert.equal(peer.get_esp()>>>0,peerStack+12);assert.equal(read(desc+12),128);assert.equal(read(desc+16),128);assert.equal(read(image),table);
 });
 check('registry owning extent exactly covers appended pointer and never overruns',()=>{assert.equal(e.vb_registry_size(),(e.vb_registry_count()+1)*4);const end=e.vb_registry()+e.vb_registry_size(),prior=bytes.slice(end,end+8);bytes.fill(0xa5,end,end+8);e.vb_registry_append(0x1234);assert(bytes.slice(end,end+8).every(x=>x===0xa5));bytes.set(prior,end);});
 check('final owned surface release reaches zero',()=>assert.equal(call(image,2),0));
 return {cases,limits:['no image draw/gameplay claim','auxiliary serialized descriptor access only; no parallel refcount stress claim']};
}
const faults=require('./fixtures/vbdd-image-helpers/allocation-fault-hooks');
const compiler=require('./compile-src'),originalCompile=compiler.compileSrcWasm;
compiler.compileSrcWasm=(transform,options)=>originalCompile((file,source)=>faults.transform(file,transform?transform(file,source):source),options);
const {bootRenderHarness}=require('./render-helper');
(async()=>{const h=await bootRenderHarness({extraWat:extraWat+'\n'+faults.extraWat,fonts:'none'});const result=await run(h,require('../src/api_table.json'));console.log(JSON.stringify({status:'PASS',...result}));})().catch(error=>{console.error(error);process.exitCode=1;});
