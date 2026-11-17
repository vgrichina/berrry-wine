'use strict';
const assert=require('assert');
const {compileSrcWasm}=require('./compile-src');
const {createHostImports}=require('../lib/host-imports');
const apis=require('../src/api_table.json');
const extraWat=String.raw`
 (global $vp_fail_alloc (mut i32) (i32.const 0))
 (func (export "fail_alloc") (param $v i32) (global.set $vp_fail_alloc (local.get $v)))
 (func $vp_test_alloc (param $n i32) (result i32)
   (if (global.get $vp_fail_alloc) (then (return (i32.const 0))))
   (call $heap_alloc (local.get $n)))
 (func (export "create") (param $v i32) (result i32)
   (if (i32.eq (local.get $v) (i32.const 1)) (then (return (call $dx_create_com_obj (i32.const 23) (global.get $DX_VTBL_D3DVP1)))))
   (if (i32.eq (local.get $v) (i32.const 2)) (then (return (call $dx_create_com_obj (i32.const 23) (global.get $DX_VTBL_D3DVP2)))))
   (call $dx_create_com_obj (i32.const 23) (global.get $DX_VTBL_D3DVP3)))
 (func (export "invoke") (param $id i32) (param $sp i32) (param $p i32) (param $iid i32) (param $out i32) (result i32)
   (i32.store offset=16 (global.get $reg_base) (local.get $sp))
   (i32.store (global.get $reg_base) (i32.const 0xdeadbeef))
   (call $dispatch_api_table (local.get $id) (local.get $p) (local.get $iid) (local.get $out)
     (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
 (func (export "refs") (param $p i32) (result i32) (load.field DxObject refcount (call $dx_from_this (local.get $p))))
 (func (export "release") (param $p i32) (result i32)
   (call $handle_IDirect3DViewport_Release (local.get $p) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
   (i32.load (global.get $reg_base)))
 (func (export "device") (result i32)
   (local $p i32) (local $s i32)
   (local.set $p (call $dx_create_com_obj (i32.const 20) (global.get $DX_VTBL_D3DDEV3)))
   (local.set $s (call $heap_alloc (i32.const 4096)))
   (call $d3ddev_init_state (local.get $s))
   (i32.store offset=16 (call $dx_from_this (local.get $p)) (local.get $s))
   (local.get $p))
 (export "attach" (func $d3dim_device_add_viewport))
 (export "detach" (func $d3dim_device_delete_viewport))
 (export "release_device" (func $d3dim_device_release))
 (export "select_viewport" (func $d3dim_device_set_current_viewport))
 (export "device_state" (func $d3ddev_state))
 (func (export "factory") (param $version i32) (param $out i32) (result i32)
   (local $surface i32) (local $vt i32)
   (local.set $surface (call $dx_create_com_obj (i32.const 2) (global.get $DX_VTBL_DDSURF)))
   (store.field DxObject width (call $dx_from_this (local.get $surface)) (i32.const 80))
   (store.field DxObject height (call $dx_from_this (local.get $surface)) (i32.const 60))
   (local.set $vt (global.get $DX_VTBL_D3DDEV1))
   (if (i32.eq (local.get $version) (i32.const 2)) (then (local.set $vt (global.get $DX_VTBL_D3DDEV2))))
   (if (i32.eq (local.get $version) (i32.const 3)) (then (local.set $vt (global.get $DX_VTBL_D3DDEV3))))
   (call $d3dim_create_device (i32.const 0) (local.get $surface) (local.get $out) (local.get $vt))
   (i32.load (global.get $reg_base)))
 (func (export "device_alias") (param $device i32) (param $version i32) (result i32)
   (call $dx_get_wrapper_for_vtbl (call $dx_slot_of (call $dx_from_this (local.get $device)))
     (if (result i32) (i32.eq (local.get $version) (i32.const 1))
       (then (global.get $DX_VTBL_D3DDEV1)) (else (global.get $DX_VTBL_D3DDEV3)))))
 (func (export "max_slots") (result i32) (global.get $DX_MAX))
 (func (export "slot") (param $p i32) (result i32) (call $dx_slot_of (call $dx_from_this (local.get $p))))
 (func (export "data_slots") (result i32) (i32.div_u (global.get $D3DIM_VIEWPORT_DATA_SIZE) (i32.const 4)))
 (func (export "light_slots") (result i32) (i32.div_u (global.get $D3DIM_VIEWPORT_LIGHT_HEAD_SIZE) (i32.const 4)))
 (func (export "data") (param $p i32) (result i32)
   (i32.load (call $d3dim_viewport_data_addr (call $dx_from_this (local.get $p)))))
 (func (export "live_heap") (result i32)
   (i32.sub (global.get $heap_stat_allocs) (global.get $heap_stat_frees)))
 (func (export "span_cursor") (result i32) (global.get $guest_span_cursor))
`;
(async()=>{
 let patched=0;
 const wasm=compileSrcWasm((file,source)=>{
   if(file==='09ab-handlers-d3dim-core.wat') {
     const start=source.indexOf('  (func $d3dim_viewport_set_data '),end=source.indexOf('  (func $d3dim_viewport_get ',start);
     assert(start>=0&&end>start);
     const body=source.slice(start,end),site='(call $heap_alloc (i32.const 44))';
     assert.strictEqual(body.split(site).length,2);patched++;
     return source.slice(0,start)+body.replace(site,'(call $vp_test_alloc (i32.const 44))')+source.slice(end);
   }
   return file==='13-exports.wat'?source+'\n'+extraWat:source;
 });
 assert.strictEqual(patched,1);
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer},imports=createHostImports(ctx);imports.host.memory=memory;
 const {instance}=await WebAssembly.instantiate(wasm,imports),e=instance.exports;ctx.exports=e;
 e.init_dx_com_thunks();
 const sp=e.guest_alloc(128),iid=e.guest_alloc(16),out=e.guest_alloc(4);
 const versions=[1,2,3], guids=[
   [0x4417c146,0x11cf33ad,0x00006f81,0x6e1520c0],
   [0x93281500,0x11d08cf8,0xa000ab89,0x294105c9],
   [0xb0ab3b61,0x11d133d7,0xc00081a9,0x74b1d74f],
 ], unknown=[0,0,0xc0,0x46000000],ddraw=[0x6c14db80,0x11cea733,0x200021a5,0x60e50baf];
 const write=(p,words)=>words.forEach((n,i)=>e.guest_write32(p+i*4,n));
 let abiCalls=0;
 const invoke=(v,method,p,a=0,b=0,pop=12)=>{
   const name='IDirect3DViewport'+(v===1?'':v)+'_'+method;
   e.guest_write32(sp+pop,0x12345678);
   const hr=e.invoke(apis.find(a=>a.name===name).id,sp,p,a,b)>>>0;
   assert.strictEqual(e.get_esp(),sp+pop,name+' stdcall');
   assert.strictEqual(e.guest_read32(sp+pop),0x12345678,name+' stack guard');
   abiCalls++;
   return hr;
 };
 const query=(v,p,g=iid,o=out)=>{
   e.guest_write32(sp+16,0xdeadbeef);
   const name='IDirect3DViewport'+(v===1?'':v)+'_QueryInterface';
   const hr=e.invoke(apis.find(a=>a.name===name).id,sp,p,g,o)>>>0;
   assert.strictEqual(e.get_esp(),sp+16);assert.strictEqual(e.guest_read32(sp+16)>>>0,0xdeadbeef);
   return hr;
 };
 const vtables=versions.map(v=>{const p=e.create(v),vt=e.guest_read32(p);e.release(p);return vt;});
 const vp=e.guest_alloc(52),valid=e.guest_alloc(4);
 const device=e.device();assert(device);
 const bits=f=>{const b=Buffer.alloc(4);b.writeFloatLE(f);return b.readUInt32LE();};
 const words=p=>Array.from({length:11},(_,n)=>e.guest_read32(p+n*4)>>>0);
 const sparseBase=0x33000000;
 for(const p of [sparseBase,sparseBase+0x10000,sparseBase+4096])e.test_virtual_map_commit(p,4096);
 assert.notStrictEqual(e.guest_to_wasm(sparseBase+4096),e.guest_to_wasm(sparseBase)+4096);
 const sparseVp=sparseBase+4090;
 // The first Clear opens the GPS producer's process-lifetime state (its
 // block, layouts, ring and the target entry); later Clears allocate nothing.
 let producerHeap=null;
 for(const v of versions) {
   const p=e.create(v),original=e.guest_read32(p);
   let heap=e.live_heap();
   write(vp,[44,...Array(10).fill(0x12345678)]);
   for(const method of ['GetViewport','SetViewport']) {
     assert.strictEqual(invoke(v,method,0,0),0x88760082,'object error precedes descriptor error');
     assert.strictEqual(invoke(v,method,device,vp),0x88760082,'wrong object family rejected');
   }
   if(v!==1) {
     assert.strictEqual(invoke(v,'GetViewport2',p,vp),0x88760305,'uninitialized viewport');
     assert.deepStrictEqual(words(vp),[44,...Array(10).fill(0x12345678)]);
   }
   assert.strictEqual(invoke(v,'SetViewport',p,vp),0x88760306,'detached viewport');
   assert.strictEqual(e.data(p),0);assert.strictEqual(e.live_heap(),heap);
   assert.strictEqual(e.attach(device,p),0);
   // Failure must not publish a descriptor or alter the rectangle. A retry
   // then succeeds, and future setters reuse that same owned allocation.
   write(vp,[44,0,0,80,60,...[40,30,1,1,0,1].map(bits)]);
   e.fail_alloc(1);
   assert.strictEqual(invoke(v,'SetViewport',p,vp),0x8007000e);
   assert.strictEqual(e.data(p),0);assert.strictEqual(e.live_heap(),heap+1);
   e.fail_alloc(0);
   assert.strictEqual(invoke(v,'SetViewport',p,vp),0);
   const owned=e.data(p);assert(owned);
   e.fail_alloc(1);
   // Clear has the same four-argument ABI on all three interfaces. A no-op
   // clear must still write its HRESULT, not return the incoming EAX poison.
   const preClear=e.live_heap();
   assert.strictEqual(invoke(v,'Clear',p,0,0,20),0,'Clear HRESULT');
   if(producerHeap===null){producerHeap=e.live_heap()-preClear;heap+=producerHeap;}
   else assert.strictEqual(e.live_heap(),preClear,'a later Clear allocates nothing');
   for(const suffix of v===1?['']:['','2']) for(const buffer of [vp,sparseVp,sparseBase+4094]) {
     const rectangle=[3+v,5+v,91+v,73+v];
     const tail=suffix==='2'?[-0.25,0.75,2,1.5,0.125,0.875]:[23,19,99,98,0.25,0.75];
     write(buffer,[44,...rectangle,...tail.map(bits)]);
     e.guest_write32(buffer+44,0x24681357);
     assert.strictEqual(invoke(v,'SetViewport'+suffix,p,buffer),0,'SetViewport HRESULT');
     write(buffer,[44,0,0,0,0,...Array(6).fill(0)]);
     assert.strictEqual(invoke(v,'GetViewport'+suffix,p,buffer),0,'GetViewport HRESULT');
     assert.deepStrictEqual([4,8,12,16].map(n=>e.guest_read32(buffer+n)),rectangle);
     const cw=Math.fround(rectangle[2]/23),ch=Math.fround(rectangle[3]/19);
     const expectedTail=suffix==='2'?tail.map(bits):
       [Math.fround(rectangle[2]/cw),Math.fround(rectangle[3]/ch),cw/2,ch/2,0,1].map(bits);
     assert.deepStrictEqual(words(buffer).slice(5),expectedTail,'complete converted descriptor');
     if(v!==1) {
       assert.strictEqual(invoke(v,suffix==='2'?'GetViewport':'GetViewport2',p,buffer),0);
       const cross=suffix==='2'?[rectangle[2]/2,rectangle[3]/1.5,1.75,0.75,0,1]:[-cw/2,ch/2,cw,ch,0,1];
       assert.deepStrictEqual(words(buffer),[44,...rectangle,...cross.map(bits)],'cross-layout conversion');
     }
     assert.strictEqual(e.data(p),owned,'setters reuse one descriptor');
     assert.strictEqual(e.guest_read32(buffer+44),0x24681357,'viewport output guard');
     for(const size of [0,20,40,43,45,80,0xffffffff]) {
       const rejected=[size,101,102,103,104,...Array(6).fill(0x3f800000)];
       write(buffer,rejected);
       assert.strictEqual(invoke(v,'SetViewport'+suffix,p,buffer),0x80070057,'invalid setter size');
       assert.strictEqual(invoke(v,'GetViewport'+suffix,p,buffer),0x80070057,'invalid getter size');
       assert.deepStrictEqual(Array.from({length:11},(_,n)=>e.guest_read32(buffer+n*4)>>>0),rejected,
         'rejected descriptor remains untouched');
       assert.strictEqual(e.guest_read32(buffer+44),0x24681357,'rejected output guard');
       e.guest_write32(buffer,44);
       assert.strictEqual(invoke(v,'GetViewport'+suffix,p,buffer),0,'read after rejected setter');
       assert.deepStrictEqual([4,8,12,16].map(n=>e.guest_read32(buffer+n)),rectangle,
         'rejected setter preserves viewport');
     }
     assert.strictEqual(invoke(v,'SetViewport'+suffix,p,0),0x80070057,'null setter');
     assert.strictEqual(invoke(v,'GetViewport'+suffix,p,0),0x80070057,'null getter');
     assert.strictEqual(invoke(v,'GetViewport'+suffix,p,buffer),0,'read after null setter');
     assert.deepStrictEqual([4,8,12,16].map(n=>e.guest_read32(buffer+n)),rectangle);
   }
   e.fail_alloc(0);
   assert.strictEqual(e.detach(device,p),0);
   assert.strictEqual(e.live_heap(),heap+1,'one retained descriptor, no attachment node');
   assert.strictEqual(invoke(v,'SetBackground',p,0),0,'SetBackground HRESULT');
   write(out,[0xdeadbeef]);write(valid,[0xdeadbeef]);
   assert.strictEqual(invoke(v,'GetBackground',p,out,valid,16),0,'GetBackground HRESULT');
   assert.strictEqual(e.guest_read32(out),0,'no background material');
   assert.strictEqual(e.guest_read32(valid),0,'background validity');
   write(iid,ddraw);e.guest_write32(out,0xdeadbeef);
   assert.strictEqual(query(v,p),0x80004002,'complete unrelated interface rejected');
   assert.strictEqual(e.guest_read32(out),0);assert.strictEqual(e.refs(p),1);
   write(iid,[0x4417c144,0x11cf33ad,0x00006f81,0x6e1520c0]);
   assert.strictEqual(query(v,p),0x80004002,'material IID cannot cross the shared child-family core');
   assert.strictEqual(e.guest_read32(out),0);assert.strictEqual(e.refs(p),1);
   for(const words of [...guids,unknown,ddraw]) for(let word=0;word<4;word++) {
     const forged=words.slice();forged[word]^=0x01000000;write(iid,forged);
     e.guest_write32(out,0xdeadbeef);
     assert.strictEqual(query(v,p),0x80004002,'reject full-GUID mismatch');
     assert.strictEqual(e.guest_read32(out),0);assert.strictEqual(e.refs(p),1);
   }
   assert.strictEqual(query(v,p,iid,0),0x80004003);
   e.guest_write32(out,0xdeadbeef);assert.strictEqual(query(v,p,0),0x80004003);
   assert.strictEqual(e.guest_read32(out),0);assert.strictEqual(e.refs(p),1);
   for(let target=0;target<versions.length;target++) {
     write(iid,guids[target]);assert.strictEqual(query(v,p),0);
     const view=e.guest_read32(out);assert.strictEqual(e.refs(p),2);
     assert.strictEqual(e.guest_read32(view),vtables[target],'requested viewport ABI');
     assert.strictEqual(e.data(view),e.data(p),'one descriptor owner across interface views');
     assert.strictEqual(e.guest_read32(p),original,'upgrades do not mutate original vtable');
     write(iid,unknown);assert.strictEqual(query(versions[target],view),0);
     assert.strictEqual(e.guest_read32(out),p,'one controlling viewport IUnknown');
     assert.strictEqual(e.release(p),2);assert.strictEqual(e.release(view),1);
   }
   assert.strictEqual(e.release(p),0);
   assert.strictEqual(e.data(p),0,'final release clears descriptor owner');
   assert.strictEqual(e.live_heap(),heap,'final release frees descriptor');
 }
 // Deliberately interleave sparse backing so a crossing IID is not affine.
 const base=0x32000000;
 for(const p of [base,base+0x10000,base+4096])e.test_virtual_map_commit(p,4096);
 assert.notStrictEqual(e.guest_to_wasm(base+4096),e.guest_to_wasm(base)+4096);
 const sparseIid=base+4090,sparseOut=base+4094,p=e.create(3),cursor=e.span_cursor();
 for(let n=0;n<64;n++) {
   write(sparseIid,guids[1]);
   assert.strictEqual(query(3,p,sparseIid,out),0);assert.strictEqual(e.release(e.guest_read32(out)),1);
   assert.strictEqual(e.span_cursor(),cursor,'temporary GUID span released');
   write(iid,unknown);assert.strictEqual(query(3,p,iid,sparseOut),0);
   assert.strictEqual(e.guest_read32(sparseOut),p);assert.strictEqual(e.release(p),1);
 }
 assert.strictEqual(e.release(p),0);
 // Two descriptors survive interleaved selection independently. Drop the
 // application's references and let device teardown own their final release.
 const heapBefore=e.live_heap(),a=e.create(3),b=e.create(3);
 const descA=[44,1,2,80,60,...[-1,1,2,2,0,1].map(bits)];
 const descB=[44,3,4,20,30,...[-0.5,0.25,1,0.5,0.2,0.8].map(bits)];
 for(const [obj,desc] of [[a,descA],[b,descB]]) {
   assert.strictEqual(e.attach(device,obj),0);write(vp,desc);
   assert.strictEqual(invoke(3,'SetViewport2',obj,vp),0);
 }
 assert.notStrictEqual(e.data(a),e.data(b));
 for(const obj of [a,b,a])assert.strictEqual(e.select_viewport(device,obj),0);
 for(const [obj,desc] of [[a,descA],[b,descB]]) {
   write(vp,[44,...Array(10).fill(0)]);
   assert.strictEqual(invoke(3,'GetViewport2',obj,vp),0);
   assert.deepStrictEqual(words(vp),desc);
 }
 // MS Device3 SetCurrentViewport explicitly accepts an unset descriptor:
 // 5666fd12 tests initialized, then jumps over activation to the ref transfer.
 // An unset selection must not manufacture data or replace transform cache.
 const deviceCall=(revision,method,arg)=>{
   const name=`IDirect3DDevice${revision}_${method}`;
   e.guest_write32(sp+12,0x12345678);
   const hr=e.invoke(apis.find(a=>a.name===name).id,sp,device,arg,0)>>>0;
   assert.strictEqual(e.get_esp(),sp+12,name+' stdcall');
   assert.strictEqual(e.guest_read32(sp+12),0x12345678,name+' stack guard');
   abiCalls++;return hr;
 };
 const state=e.device_state(device);
 const transformCache=()=>[
   ...Array.from({length:10},(_,i)=>e.guest_read32(state+3088+i*4)),
   ...Array.from({length:7},(_,i)=>e.guest_read32(state+3904+i*4)),
 ];
 for(const revision of [2,3]) {
   const unset=e.create(revision),heap=e.live_heap();
   const cached=transformCache(),oldRefs=e.refs(a);
   assert.strictEqual(e.attach(device,unset),0);
   for(let repeat=0;repeat<2;repeat++) {
     assert.strictEqual(deviceCall(revision,'SetCurrentViewport',unset),0);
     assert.strictEqual(e.refs(unset),3,'list and selection each own a reference');
     assert.strictEqual(e.refs(a),oldRefs-1,'old selection reference released only once');
     assert.strictEqual(e.data(unset),0,'selection does not initialize descriptor');
     assert.strictEqual(e.live_heap(),heap+1,'only the attachment node was allocated');
     assert.deepStrictEqual(transformCache(),cached,'unset selection preserves transform cache');
   }
   assert.strictEqual(deviceCall(revision,'GetCurrentViewport',out),0);
   assert.strictEqual(e.guest_read32(out),unset);
   assert.strictEqual(e.release(unset),3);
   write(vp,[44,...Array(10).fill(0x12345678)]);
   assert.strictEqual(invoke(revision,'GetViewport2',unset,vp),0x88760305);
   assert.deepStrictEqual(words(vp),[44,...Array(10).fill(0x12345678)]);
   write(vp,descB);
   assert.strictEqual(invoke(revision,'SetViewport2',unset,vp),0);
   assert.deepStrictEqual(Array.from({length:4},(_,i)=>e.guest_read32(state+3088+i*4)),descB.slice(1,5),
     'initializing the selected viewport activates its rectangle');
   assert.notDeepStrictEqual(transformCache(),cached,'late initialization activates clip coefficients');
   assert.strictEqual(e.select_viewport(device,a),0);
   assert.deepStrictEqual(transformCache(),cached,'previous initialized viewport can be restored');
   assert.strictEqual(e.detach(device,unset),0);
   assert.strictEqual(e.release(unset),0);
   assert.strictEqual(e.live_heap(),heap,'late descriptor and attachment allocation freed');
 }
 // Factory-origin validation is independent of aliases and viewport versions.
 for(const creation of [1,2,3]) {
   assert.strictEqual(e.factory(creation,out),0);
   const dev=e.guest_read32(out),s=e.device_state(dev);
   assert.strictEqual(e.guest_read32(s+3932),creation);
   const alias=e.device_alias(dev,creation===1?3:1);
   write(iid,creation===1?[0xb0ab3b60,0x11d133d7,0xc00081a9,0x74b1d74f]:
     [0x64108800,0x11d0957d,0xa000ab89,0x294105c9]);
   const qiName=`IDirect3DDevice${creation===1?'':creation}_QueryInterface`;
   e.guest_write32(sp+16,0x12345678);
   assert.strictEqual(e.invoke(apis.find(a=>a.name===qiName).id,sp,dev,iid,out),0);
   assert.strictEqual(e.get_esp(),sp+16);assert.strictEqual(e.guest_read32(sp+16),0x12345678);
   abiCalls++;
   assert.strictEqual(e.guest_read32(out),alias,'public QueryInterface returns the same alias');
   assert.strictEqual(e.device_state(alias),s);
   assert.strictEqual(e.guest_read32(s+3932),creation,'aliases preserve creation policy');
   for(const viewportVersion of [1,2,3]) {
     const obj=e.create(viewportVersion);
     assert.strictEqual(e.attach(alias,obj),0);
     const canonical=[44,0,0,80,60,...[-1,1,2,2,0,1].map(bits)];
     const legacy=[44,0,0,80,60,...[40,30,1,1,0,1].map(bits)];
     assert.strictEqual(e.select_viewport(alias,obj),0);
     const cache=()=>[...Array.from({length:10},(_,i)=>e.guest_read32(s+3088+i*4)),
       ...Array.from({length:7},(_,i)=>e.guest_read32(s+3904+i*4))];
     if(creation!==1) {
       const heap=e.live_heap(),before=cache(),bad=legacy.slice();bad[5]=0;
       write(vp,bad);e.fail_alloc(1);
       assert.strictEqual(invoke(viewportVersion,'SetViewport',obj,vp),0x80070057,
         'range error precedes allocation failure');
       e.fail_alloc(0);
       assert.strictEqual(e.data(obj),0);assert.strictEqual(e.live_heap(),heap);
       assert.deepStrictEqual(cache(),before);
     }
     const ignoredDepth=legacy.slice();ignoredDepth[9]=bits(NaN);ignoredDepth[10]=bits(NaN);
     write(vp,ignoredDepth);
     assert.strictEqual(invoke(viewportVersion,'SetViewport',obj,vp),0,
       'legacy conversion normalizes ignored depth before range validation');
     assert.deepStrictEqual(words(e.data(obj)).slice(9),[0,bits(1)]);
     for(const buffer of [vp,sparseVp,sparseBase+4094]) {
       for(const [method,base,cases] of [
         ['SetViewport',legacy,[[20,0],[24,0],[20,bits(NaN)],[12,81],[16,61]]],
         ...(viewportVersion===1?[]:[['SetViewport2',canonical,
           [[28,0],[32,0],[28,bits(NaN)],[32,bits(NaN)],[36,bits(NaN)],[40,bits(NaN)],
            [40,0],[4,81],[8,61],[12,81],[16,61]]]]),
       ]) {
         for(const [offset,value] of cases) {
           write(buffer,base);assert.strictEqual(invoke(viewportVersion,method,obj,buffer),0);
           const ptr=e.data(obj),saved=words(ptr),heap=e.live_heap(),cached=cache();
           const bad=base.slice();bad[offset/4]=value;write(buffer,bad);
           assert.strictEqual(invoke(viewportVersion,method,obj,buffer),creation===1?0:0x80070057,
             `creation${creation} viewport${viewportVersion} ${method} field${offset}`);
           assert.deepStrictEqual(words(buffer),bad.map(n=>n>>>0),'input is not rewritten');
           assert.strictEqual(e.data(obj),ptr);assert.strictEqual(e.live_heap(),heap);
           if(creation!==1) {
             assert.deepStrictEqual(words(ptr),saved,'rejection preserves canonical data');
             assert.deepStrictEqual(cache(),cached,'rejection preserves active transform cache');
           }
         }
       }
       if(viewportVersion!==1) {
         for(const accepted of [
           [44,80,60,0,0,...[-1,1,2,2,0,1].map(bits)],
           [44,0,0,80,60,...[-1,1,-2,-2,2,-1].map(bits)],
           [44,1,1,0xffffffff,0xffffffff,...[-1,1,2,2,0,1].map(bits)],
         ]) {
           write(buffer,accepted);
           assert.strictEqual(invoke(viewportVersion,'SetViewport2',obj,buffer),0,
             'native accepts zero screen extent, negative clip/reversed depth, and wrapping sums');
           assert.deepStrictEqual(words(e.data(obj)),accepted.map(n=>n>>>0));
         }
       }
     }
     assert.strictEqual(e.detach(dev,obj),0);assert.strictEqual(e.release(obj),0);
   }
   assert.strictEqual(e.release_device(alias),1);
   assert.strictEqual(e.release_device(dev),0);
 }
 // Exercise the actual highest DX slot, not just a small-slot happy path.
 assert(e.data_slots()>=e.max_slots());assert(e.light_slots()>=e.max_slots());
 let last=0,created=0,next;
 while((next=e.create(3))!==0){if(e.slot(next)===e.max_slots()-1)last=next;assert(++created<=e.max_slots());}
 assert(last);assert.strictEqual(e.slot(last),e.max_slots()-1);
 assert.strictEqual(e.attach(device,last),0);write(vp,descB);
 assert.strictEqual(invoke(3,'SetViewport2',last,vp),0);
 assert.strictEqual(e.detach(device,last),0);assert.strictEqual(e.release(last),0);
 assert.strictEqual(e.data(last),0);
 write(vp,[44,...Array(10).fill(0)]);assert.strictEqual(invoke(3,'GetViewport2',a,vp),0);
 assert.deepStrictEqual(words(vp),descA,'high-slot cleanup preserves another owner');
 assert.strictEqual(e.release(a),2);assert.strictEqual(e.release(b),1);
 assert.strictEqual(e.release_device(device),0);
 assert.strictEqual(e.data(a),0);assert.strictEqual(e.data(b),0);
 assert.strictEqual(e.live_heap(),heapBefore-1,'device state, list nodes and descriptors freed');
 console.log(`PASS D3D viewport: ${abiCalls} poisoned-EAX calls with ABI guards, direct/sparse rectangles, full GUIDs, 9 identity upgrades, nulls and balanced refs/spans`);
})().catch(error=>{console.error(error);process.exitCode=1;});
