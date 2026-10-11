'use strict';
const assert=require('assert/strict'),fs=require('fs');
const extraWat=String.raw`
(func (export "fore_meta") (param $obj i32) (result i32) (call $dx_surf_meta_ptr (call $dx_from_this (local.get $obj))))

(func (export "draw_alloc_dc") (param $h i32) (result i32) (call $gdi_dc_state_entry (local.get $h) (i32.const 1)))
(func (export "draw_free_dc") (param $h i32) (call $gdi_dc_state_release (local.get $h)))

(func (export "draw_dc_alive") (param $obj i32) (result i32) (call $gdi_dc_state_entry (i32.add (i32.const 0x200000) (call $dx_slot_of (call $dx_from_this (local.get $obj)))) (i32.const 0)))

(func (export "vb_key") (param $obj i32) (result i32) (load.field DxObject misc2 (call $dx_from_this (local.get $obj))))
(func (export "vb_flags") (param $obj i32) (result i32) (load.field DxObject flags (call $dx_from_this (local.get $obj))))
;; Test real shared native keyed consumer without pretending VB Blt supports
;; flags that its bounded front door still explicitly rejects.
(func (export "vb_native_key_copy") (param $dst i32) (param $src i32) (param $frame i32) (result i32)
 (local $esp i32) (local $eax i32) (local $hr i32)
 (local.set $esp (i32.load offset=16 (global.get $reg_base))) (local.set $eax (i32.load (global.get $reg_base)))
 (call $gs32 (i32.add (local.get $frame) (i32.const 24)) (i32.const 0))
 (i32.store offset=16 (global.get $reg_base) (local.get $frame))
 (call $handle_IDirectDrawSurface_Blt (local.get $dst) (i32.const 0) (local.get $src) (i32.const 0) (i32.const 0x8000) (i32.const 0))
 (local.set $hr (i32.load (global.get $reg_base)))
 (i32.store offset=16 (global.get $reg_base) (local.get $esp)) (i32.store (global.get $reg_base) (local.get $eax)) (local.get $hr))

;; This fixture's pixel checks are 16 bpp (2-byte pixels), and an unset depth
;; now reports the 32-bpp desktop, so the display depth is pinned to 16 for
;; the whole run. A nonzero size is a selected mode, as SetDisplayMode records
;; it: since 4ed42731f a windowed primary with no mode in effect is the
;; desktop (screen metrics). vb_mode(0,0) clears the size and the mode flag.
(func (export "vb_mode") (param $w i32) (param $h i32) (call $dx_display_w_set (local.get $w)) (call $dx_display_h_set (local.get $h))
 (call $dx_display_mode_set (i32.ne (local.get $w) (i32.const 0)))
 (call $dx_display_bpp_set (i32.const 16)))
(func (export "vb_clipper") (param $obj i32) (result i32) (call $dx_surface_clipper_get (call $dx_from_this (local.get $obj))))
(func (export "vb_factory") (param $out i32) (call $handle_IDirectX7_DirectDrawCreate (i32.const 0) (i32.const 0) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "vb_bits") (param $obj i32) (result i32) (load.field DxObject misc1 (call $dx_from_this (local.get $obj))))
(func (export "vb_pitch") (param $obj i32) (result i32) (load.field DxObject pitch (call $dx_from_this (local.get $obj))))
(func (export "vb_refs") (param $obj i32) (result i32) (load.field DxObject refcount (call $dx_from_this (local.get $obj))))
(func (export "vb_vidmem") (result i32) (global.get $dx_vidmem_used))
(func (export "vb_native") (param $owner i32) (param $desc i32) (param $out i32) (call $handle_IDirectDraw_CreateSurface (local.get $owner) (local.get $desc) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0)))
`;
const foreExtraWat="\n(func (export \"fore_state\") (param $obj i32) (result i32) (call $vbdd_draw_state_ptr (call $dx_from_this (local.get $obj))))\n(func (export \"fore_pen_live\") (param $pen i32) (result i32) (call $gdi_object_type (local.get $pen)))\n(func (export \"fore_alloc\") (result i32) (call $gdi_object_alloc (i32.const 1) (i32.const 0) (i32.const 1) (i32.const 0) (i32.const 0)))\n(func (export \"fore_delete\") (param $pen i32) (result i32) (call $gdi_object_delete_full (local.get $pen)))\n(func (export \"fore_load_wa\") (param $p i32) (result i32) (i32.load (local.get $p)))\n;; Independent native consumer of stored pen, not a fabricated VB DrawLine.\n;; A fresh DC is acquired/released each time so DC-local color cannot pass.\n(func (export \"fore_native_line\") (param $obj i32) (param $y i32) (result i32)\n (local $hdc i32) (local $state i32) (local $old i32) (local $ok i32)\n (local.set $state (call $vbdd_draw_state_ptr (call $dx_from_this (local.get $obj))))\n (local.set $hdc (i32.add (i32.const 0x200000) (i32.div_u (i32.sub (call $dx_from_this (local.get $obj)) (global.get $DX_OBJECTS)) (i32.const 32))))\n (if (i32.eqz (call $gdi_dx_dc_bind (local.get $hdc))) (then (return (i32.const 0))))\n (local.set $old (call $gdi_native_select_object (local.get $hdc) (i32.load offset=4 (local.get $state))))\n (drop (call $gdi_native_move_to (local.get $hdc) (i32.const 1) (local.get $y)))\n (local.set $ok (call $gdi_native_line_to (local.get $hdc) (i32.const 7) (local.get $y)))\n (drop (call $gdi_native_select_object (local.get $hdc) (local.get $old)))\n (call $gdi_dx_dc_release (local.get $hdc)) (local.get $ok))\n";
async function run(h,apis,notepad,fixture){
 const e=h.exports,u8=new Uint8Array(h.memory.buffer),v=new DataView(h.memory.buffer);u8.set(notepad,e.get_staging());assert(e.load_pe(notepad.length)>0);e.init_dx_com_thunks();
 const a=n=>e.guest_alloc(n)>>>0,w=(p,x)=>e.guest_write32(p,x),r=p=>e.guest_read32(p)>>>0,zero=(p,n)=>{for(let i=0;i<n;i++)e.guest_write8(p+i,0)};
 const stack=a(256),out=a(12),desc=a(240),status=a(12),rect=a(16);let cases=0;const check=(name,f)=>{f();cases++;console.log('PASS '+name)};
 const call=(o,slot,...args)=>{const thunk=r(r(o)+slot*4),api=apis[r(thunk+4)];assert.equal(r(thunk),0xcaca0010);assert.equal(api.nargs,args.length+1,api.name);w(stack,0);[o,...args].forEach((x,i)=>w(stack+4+i*4,x));const saved=Array.from({length:32},(_,i)=>r(stack+i*4));e.set_esp(stack);e.set_eip(thunk);e.run(1);assert.equal(e.get_eip(),0);assert.equal(e.get_esp()>>>0,stack+(api.nargs+1)*4,api.name+' cleanup');for(let i=0;i<32;i++)assert.equal(r(stack+i*4),saved[i],'original stack untouched');return e.get_eax()>>>0};
 e.vb_factory(out);const owner=r(out);assert(owner);
 const descriptor=(width=128,height=128)=>{zero(desc,240);w(desc,0xaabbccdd);w(desc+236,0xddccbbaa);const d=desc+4;w(d,124);w(d+4,7);w(d+8,height);w(d+12,width);w(d+200,0x840);return d};
 const d=descriptor();let dest;
 check('startup primary flags1/caps200 uses current native display dimensions',()=>{
  e.vb_mode(37,29);zero(d,232);w(d+4,1);w(d+200,0x200);
  assert.equal(call(owner,7,d,out),0,'startup primary request must remain supported');const primary=r(out);assert(primary);
  assert.equal(call(primary,40,d),0);assert.equal(r(d+12),37);assert.equal(r(d+8),29);assert.equal(r(d+104),16);
  assert.equal(call(owner,5,0,out),0);const clipper=r(out);assert.equal(e.vb_refs(clipper),1);
  assert.equal(call(primary,46,clipper),0);assert.equal(e.vb_clipper(primary)>>>0,clipper);assert.equal(e.vb_refs(clipper),2);
  assert.equal(call(primary,46,clipper),0);assert.equal(e.vb_refs(clipper),2);
  const fake=a(8);w(fake,r(clipper));w(fake+4,r(clipper+4));assert.equal(call(primary,46,fake),0x88760082);assert.equal(e.vb_clipper(primary)>>>0,clipper);assert.equal(e.vb_refs(clipper),2);
  assert.equal(call(primary,46,0),0);assert.equal(e.vb_refs(clipper),1);assert.equal(e.vb_clipper(primary),0);
  assert.equal(call(primary,46,clipper),0);assert.equal(call(primary,2),0);assert.equal(e.vb_refs(clipper),1);assert.equal(call(clipper,2),0);
  e.vb_mode(0,0);descriptor();
 });
 check('CreateSurface publishes exact 71-slot VB ABI, not native47 mix',()=>{assert.equal(call(owner,7,d,out),0);dest=r(out);assert(dest);for(let i=0;i<71;i++){const api=apis[r(r(r(dest)+i*4)+4)];assert(api);assert(api.name.startsWith('IVBImageSurface7_'),i+': '+api.name);}assert.equal(apis[r(r(r(dest)+24)+4)].name,'IVBImageSurface7_Blt');assert.equal(e.vb_refs(dest),1);assert.equal(r(desc),0xaabbccdd);assert.equal(r(desc+236),0xddccbbaa);assert.equal(r(d+200),0x840)});
 const table=r(dest),iid=a(16);[0x9f76fde8,0x11d18e92,0xc0000888,0x02c6c24f].forEach((x,i)=>w(iid+i*4,x));
 check('fresh created surface QI/GetSurfaceDesc/refcount share image identity',()=>{assert.equal(call(dest,0,iid,out),0);assert.equal(r(out),dest);assert.equal(e.vb_refs(dest),2);assert.equal(call(dest,2),1);assert.equal(call(dest,40,d),0);assert.equal(r(d+8),128);assert.equal(r(d+12),128);assert.equal(r(d+104),16);assert.equal(r(dest),table)});
 const text='C:\\blt.bmp',b=a(text.length*2+6);w(b,text.length*2);for(let i=0;i<text.length;i++)e.guest_write16(b+4+i*2,text.charCodeAt(i));e.guest_write16(b+4+text.length*2,0);h.hostCtx.vfs.files.set(text.toLowerCase(),{data:new Uint8Array(fixture),attrs:0x20});descriptor();w(d+4,0);assert.equal(call(owner,8,b+4,d,out),0);const src=r(out);assert.equal(r(src),table);const sb=e.vb_bits(src)>>>0,db=e.vb_bits(dest)>>>0,sp=e.vb_pitch(src),dp=e.vb_pitch(dest);
 const snapshot=p=>Buffer.from(u8.slice(p,p+128*256));
 check('actual image-to-created-surface full copy; COM result and drawing status separate',()=>{u8.fill(0,db,db+dp*128);w(status,0x12345678);w(status+4,0xdeadbeef);w(status+8,0x87654321);assert.equal(call(dest,6,0,src,0,0x01000000,status+4),0);assert.equal(r(status+4),0);for(let y=0;y<128;y++)assert.deepEqual(u8.slice(db+y*dp,db+y*dp+256),u8.slice(sb+y*sp,sb+y*sp+256));assert.equal(r(status),0x12345678);assert.equal(r(status+8),0x87654321)});
 check('zero RECT is full extent and nonzero RECT retains left/top/right/bottom',()=>{zero(rect,16);u8.fill(0,db,db+dp*128);assert.equal(call(dest,6,rect,src,rect,0,status+4),0);assert.equal(r(status+4),0);assert.equal(v.getUint16(db+47*dp+62,true),v.getUint16(sb+47*sp+62,true));[4,5,7,9].forEach((x,i)=>w(rect+i*4,x));u8.fill(0,db,db+dp*128);assert.equal(call(dest,6,rect,src,rect,0,status+4),0);assert.equal(r(status+4),0);for(let y=0;y<128;y++)for(let x=0;x<128;x++)assert.equal(v.getUint16(db+y*dp+x*2,true),x>=4&&x<7&&y>=5&&y<9?v.getUint16(sb+y*sp+x*2,true):0)});

 check('BltColorFill caller white and packed16 color: actual pixels/statusOut/ESP20',()=>{zero(rect,16);for(const color of[0xffffff,0x12345678]){w(status+4,0xdeadbeef);assert.equal(call(dest,7,rect,color,status+4),0,'BltColorFill must execute native fill');assert.equal(r(status+4),0);for(let y=0;y<128;y++)for(let x=0;x<128;x++)assert.equal(v.getUint16(db+y*dp+x*2,true),color&65535);}assert.equal(r(status),0x12345678);assert.equal(r(status+8),0x87654321)});
 check('BltColorFill null/full and sparse subrect affect only requested pixels',()=>{assert.equal(call(dest,7,0,0,status+4),0);assert.equal(r(status+4),0);const b=0x3a000000,n=b+0x10000;for(const p of[b,n,b+4096])e.test_virtual_map_commit(p,4096);assert.notEqual(e.guest_to_wasm(b)+4096,e.guest_to_wasm(b+4096));for(let i=0;i<128;i++)e.guest_write8(n+i,0xac);const q=b+4091;[3,4,6,8].forEach((x,i)=>w(q+i*4,x));assert.equal(call(dest,7,q,0xbeef,status+4),0);assert.equal(r(status+4),0);for(let y=0;y<128;y++)for(let x=0;x<128;x++)assert.equal(v.getUint16(db+y*dp+x*2,true),x>=3&&x<6&&y>=4&&y<8?0xbeef:0);assert.equal(call(dest,7,0,0x3456,b+4095),0);assert.equal(r(b+4095),0);for(let i=0;i<128;i++)assert.equal(e.guest_read8(n+i),0xac)});
 check('observed128x1 and1x123 offscreen strips fill all allocated rows',()=>{for(const[width,height]of[[128,1],[1,123]]){descriptor(width,height);assert.equal(call(owner,7,d,out),0);const o=r(out),bits=e.vb_bits(o)>>>0,pitch=e.vb_pitch(o);assert.equal(call(o,7,0,0xffffff,status+4),0);assert.equal(r(status+4),0);for(let y=0;y<height;y++)for(let x=0;x<width;x++)assert.equal(v.getUint16(bits+y*pitch+x*2,true),0xffff);assert.equal(call(o,2),0)}});
 check('BltColorFill invalid pointers/OOB/24bpp never fabricate fill',()=>{const before=snapshot(db);[0,0,129,128].forEach((x,i)=>w(rect+i*4,x));assert.equal(call(dest,7,rect,0,status+4),0);assert.equal(r(status+4),0x80004001);assert.deepEqual(snapshot(db),before);assert.equal(call(dest,7,1,0,status+4),0x80004003);assert.equal(call(dest,7,0,0,0),0x80004003);assert.deepEqual(snapshot(db),before);descriptor(9,7);w(d+4,0x1007);w(d+76,0x40);w(d+104,24);w(d+128,0xff0000);w(d+148,0xff00);w(d+164,0xff);assert.equal(call(owner,7,d,out),0);const rgb24=r(out),bits=e.vb_bits(rgb24)>>>0,pitch=e.vb_pitch(rgb24);u8.fill(0xa5,bits,bits+pitch*7);assert.equal(call(rgb24,7,0,0,status+4),0);assert.equal(r(status+4),0x80004001);assert(u8.slice(bits,bits+pitch*7).every(x=>x===0xa5));assert.equal(call(rgb24,2),0)});

 const key=a(16),nativeFrame=a(32);w(key,0xface1234);w(key+4,0x12345678);w(key+8,0xdeadbeef);w(key+12,0xcafeabcd);
 check('SetColorKey raw16 packed key and real native keyed pixels, NULL removes key',()=>{
  const oldFlags=e.vb_flags(src)>>>0;assert.equal(call(src,47,8,key+4),0,'SetColorKey must support source key');assert.equal(e.vb_key(src)>>>0,0x5678);assert.equal(e.vb_flags(src)>>>0,oldFlags|0x100);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){v.setUint16(sb+y*sp+x*2,(x+y)%2?0x7777:0x5678,true);v.setUint16(db+y*dp+x*2,0x4242,true)}
  assert.equal(e.vb_native_key_copy(dest,src,nativeFrame)>>>0,0);for(let y=0;y<128;y++)for(let x=0;x<128;x++)assert.equal(v.getUint16(db+y*dp+x*2,true),(x+y)%2?0x7777:0x4242);
  assert.equal(call(src,47,8,0),0);assert.equal(e.vb_flags(src)>>>0,oldFlags);assert.equal(e.vb_key(src),0);assert.equal(call(src,47,8,0),0);assert.equal(e.vb_native_key_copy(dest,src,nativeFrame)>>>0,0);for(let y=0;y<128;y++)assert.deepEqual(u8.slice(db+y*dp,db+y*dp+256),u8.slice(sb+y*sp,sb+y*sp+256));
  assert.equal(r(key),0xface1234);assert.equal(r(key+4),0x12345678);assert.equal(r(key+8),0xdeadbeef);assert.equal(r(key+12),0xcafeabcd);
 });
 check('SetColorKey primary and32bit surface identity/packed value preserved',()=>{
  e.vb_mode(37,29);zero(d,232);w(d+4,1);w(d+200,0x200);assert.equal(call(owner,7,d,out),0);let o=r(out),vt=r(o),flags=e.vb_flags(o)>>>0;assert.equal(call(o,47,8,key+4),0);assert.equal(e.vb_key(o)>>>0,0x5678);assert.equal(call(o,47,8,0),0);assert.equal(e.vb_flags(o)>>>0,flags);assert.equal(r(o),vt);assert.equal(call(o,2),0);e.vb_mode(0,0);
  descriptor(3,2);w(d+4,0x1007);w(d+76,0x40);w(d+104,32);w(d+128,0xff0000);w(d+148,0xff00);w(d+164,0xff);assert.equal(call(owner,7,d,out),0);o=r(out);assert.equal(call(o,47,8,key+4),0);assert.equal(e.vb_key(o)>>>0,0x12345678);assert.equal(call(o,47,8,0),0);assert.equal(e.vb_flags(o)&0x100,0);assert.equal(call(o,2),0);
 });
 check('SetColorKey sparse8byte input and bounds preserve adjacent backing',()=>{
  const b=0x3b000000,n=b+0x10000;for(const q of[b,n,b+4096])e.test_virtual_map_commit(q,4096);assert.notEqual(e.guest_to_wasm(b)+4096,e.guest_to_wasm(b+4096));for(let i=0;i<128;i++)e.guest_write8(n+i,0xa9);w(b+4093,0xbeef);w(b+4097,0x99999999);assert.equal(call(src,47,8,b+4093),0);assert.equal(e.vb_key(src)>>>0,0xbeef);for(let i=0;i<128;i++)assert.equal(e.guest_read8(n+i),0xa9);
  const beforeFlags=e.vb_flags(src)>>>0;for(const q of[1,0xfffffffc,b+8190])assert.equal(call(src,47,8,q),0x80004003);assert.equal(e.vb_key(src)>>>0,0xbeef);assert.equal(e.vb_flags(src)>>>0,beforeFlags);
 });
 check('SetColorKey unsupported range/destination flags and forged receiver never mutate key',()=>{
  const flags=e.vb_flags(src)>>>0;for(const f of[0,1,2,4,9,16,0xffffffff])assert.equal(call(src,47,f,key+4),0x80004001);const fake=a(8);w(fake,r(src));w(fake+4,r(src+4));assert.equal(call(fake,47,8,key+4),0x88760082);assert.equal(e.vb_key(src)>>>0,0xbeef);assert.equal(e.vb_flags(src)>>>0,flags);assert.equal(call(src,47,8,0),0);
 });

 check('BltFast actual full/offset/subrect pixels and COM-status/ESP32 split',()=>{
  zero(rect,16);u8.fill(0,db,db+dp*128);assert.equal(call(dest,8,0,0,src,rect,0x20,status+4),0,'BltFast must execute copy');assert.equal(r(status+4),0);for(let y=0;y<128;y++)assert.deepEqual(u8.slice(db+y*dp,db+y*dp+256),u8.slice(sb+y*sp,sb+y*sp+256));
  [1,2,5,6].forEach((x,i)=>w(rect+i*4,x));u8.fill(0,db,db+dp*128);assert.equal(call(dest,8,7,9,src,rect,0,status+4),0);assert.equal(r(status+4),0);for(let y=0;y<128;y++)for(let x=0;x<128;x++)assert.equal(v.getUint16(db+y*dp+x*2,true),x>=7&&x<11&&y>=9&&y<13?v.getUint16(sb+(y-9+2)*sp+(x-7+1)*2,true):0);assert.equal(r(status),0x12345678);assert.equal(r(status+8),0x87654321);
 });
 check('observed20x1 into2x2 returns COM_S_OK/INVALIDRECT with no partial writes',()=>{
  descriptor(20,1);assert.equal(call(owner,7,d,out),0);const s=r(out);descriptor(2,2);assert.equal(call(owner,7,d,out),0);const q=r(out),bits=e.vb_bits(q)>>>0,pitch=e.vb_pitch(q);u8.fill(0xa7,bits,bits+pitch*2);zero(rect,16);assert.equal(call(q,8,0,0,s,rect,0x20,status+4),0);assert.equal(r(status+4),0x88760096);assert(u8.slice(bits,bits+pitch*2).every(x=>x===0xa7));assert.equal(call(q,2),0);assert.equal(call(s,2),0);
  const before=snapshot(db);for(const[x,y]of[[1,0],[0,1],[-1,0],[0,-1],[0x7fffffff,0]]){assert.equal(call(dest,8,x,y,src,rect,0x20,status+4),0);assert.equal(r(status+4),0x88760096);assert.deepEqual(snapshot(db),before)}for(const rec of[[0,0,129,128],[4,3,2,1],[-1,0,1,1]]){rec.forEach((x,i)=>w(rect+i*4,x));assert.equal(call(dest,8,0,0,src,rect,0x20,status+4),0);assert.equal(r(status+4),0x88760096);assert.deepEqual(snapshot(db),before)}
 });
 check('BltFast source key uses real slot47 state; missing key stays explicit',()=>{
  zero(rect,16);assert.equal(call(src,47,8,key+4),0);for(const flags of[1,0x21]){for(let y=0;y<128;y++)for(let x=0;x<128;x++)v.setUint16(db+y*dp+x*2,0x4242,true);assert.equal(call(dest,8,0,0,src,rect,flags,status+4),0);assert.equal(r(status+4),0);for(let y=0;y<128;y++)for(let x=0;x<128;x++)assert.equal(v.getUint16(db+y*dp+x*2,true),(x+y)%2?0x7777:0x4242)}assert.equal(call(src,47,8,0),0);const before=snapshot(db);assert.equal(call(dest,8,0,0,src,rect,1,status+4),0);assert.equal(r(status+4),0x887600d7);assert.deepEqual(snapshot(db),before);assert.equal(call(dest,8,0,0,src,rect,0x20,status+4),0);assert.equal(r(status+4),0);
 });
 check('BltFast sparse RECT/statusOut preserve unrelated guest backing',()=>{
  const b=0x3c000000,n=b+0x10000;for(const q of[b,n,b+4096])e.test_virtual_map_commit(q,4096);assert.notEqual(e.guest_to_wasm(b)+4096,e.guest_to_wasm(b+4096));for(let i=0;i<128;i++)e.guest_write8(n+i,0x5a);const q=b+4093;[0,0,2,2].forEach((x,i)=>w(q+i*4,x));assert.equal(call(dest,8,4,4,src,q,0x20,status+4),0);assert.equal(r(status+4),0);zero(rect,16);assert.equal(call(dest,8,0,0,src,rect,0x20,b+4095),0);assert.equal(r(b+4095),0);for(let i=0;i<128;i++)assert.equal(e.guest_read8(n+i),0x5a);
 });
 check('BltFast32bit same-format actual pixels and raw keyed transparency',()=>{
  const make=()=>{descriptor(3,2);w(d+4,0x1007);w(d+76,0x40);w(d+104,32);w(d+128,0xff0000);w(d+148,0xff00);w(d+164,0xff);assert.equal(call(owner,7,d,out),0);return r(out)};const s=make(),q=make(),sb2=e.vb_bits(s)>>>0,db2=e.vb_bits(q)>>>0,sp2=e.vb_pitch(s),dp2=e.vb_pitch(q);for(let y=0;y<2;y++)for(let x=0;x<3;x++){v.setUint32(sb2+y*sp2+x*4,x===1?0x12345678:0x00112233,true);v.setUint32(db2+y*dp2+x*4,0x00445566,true)}assert.equal(call(s,47,8,key+4),0);zero(rect,16);assert.equal(call(q,8,0,0,s,rect,0x21,status+4),0);assert.equal(r(status+4),0);for(let y=0;y<2;y++)for(let x=0;x<3;x++)assert.equal(v.getUint32(db2+y*dp2+x*4,true),x===1?0x00445566:0x00112233);const before=Buffer.from(u8.slice(db2,db2+dp2*2));assert.equal(call(q,8,0,0,src,rect,0,status+4),0);assert.equal(r(status+4),0x80004001);assert.deepEqual(Buffer.from(u8.slice(db2,db2+dp2*2)),before);assert.equal(call(q,2),0);assert.equal(call(s,2),0);
 });
 check('BltFast null/invalid COM args versus unsupported flags/clipper drawing errors',()=>{
  zero(rect,16);const before=snapshot(db);w(status+4,0xfaceabcd);assert.equal(call(dest,8,0,0,src,0,0,status+4),0x80070057);assert.equal(r(status+4),0xfaceabcd);assert.equal(call(dest,8,0,0,0,rect,0,status+4),0x80070057);assert.equal(call(dest,8,0,0,src,1,0,status+4),0x80004003);assert.equal(call(dest,8,0,0,src,rect,0,0),0x80004003);for(const f of[2,4,0x40,0xffffffff]){assert.equal(call(dest,8,0,0,src,rect,f,status+4),0);assert.equal(r(status+4),0x80004001)}assert.equal(call(dest,8,0,0,dest,rect,0,status+4),0);assert.equal(r(status+4),0x80004001);assert.equal(call(owner,5,0,out),0);const cl=r(out);assert.equal(call(dest,46,cl),0);assert.equal(call(dest,8,0,0,src,rect,0,status+4),0);assert.equal(r(status+4),0x80004001);assert.equal(call(dest,46,0),0);assert.equal(call(cl,2),0);assert.deepEqual(snapshot(db),before);
 });
 check('unsupported FX flags do not dereference statusOut as FX or draw',()=>{const before=snapshot(db);assert.equal(call(dest,6,0,src,0,0x400,status+4),0);assert.equal(r(status+4),0x80004001);assert.deepEqual(snapshot(db),before);assert.equal(r(status+8),0x87654321)});
 check('invalid source and output return COM failure without drawing or status write',()=>{const before=snapshot(db);w(status+4,0xabcdef01);assert.equal(call(dest,6,0,0,0,0,status+4),0x80070057);assert.equal(r(status+4),0xabcdef01);assert.equal(call(dest,6,0,src,0,0,0),0x80004003);assert.deepEqual(snapshot(db),before)});
 const base=0x39000000,neighbor=base+0x10000;for(const p of [base,neighbor,base+4096])e.test_virtual_map_commit(p,4096);assert.notEqual(e.guest_to_wasm(base)+4096,e.guest_to_wasm(base+4096));for(let i=0;i<256;i++)e.guest_write8(neighbor+i,0xa7);const split=base+4091;
 check('sparse cross-page RECT and status preserve unrelated backing',()=>{[1,2,5,6].forEach((x,i)=>w(split+i*4,x));assert.equal(call(dest,6,split,src,split,0,status+4),0);assert.equal(r(status+4),0);assert.equal(call(dest,6,0,src,0,0,base+4095),0);assert.equal(r(base+4095),0);for(let i=0;i<256;i++)assert.equal(e.guest_read8(neighbor+i),0xa7)});
 check('sparse 232-byte creation descriptor returns same VB identity',()=>{descriptor(11,7);for(let i=0;i<232;i++)e.guest_write8(split+i,e.guest_read8(d+i));assert.equal(call(owner,7,split,out),0);const o=r(out);assert.equal(r(o),table);assert.equal(call(o,40,d),0);assert.equal(r(d+12),11);assert.equal(r(d+8),7);assert.equal(call(o,2),0);for(let i=0;i<256;i++)assert.equal(e.guest_read8(neighbor+i),0xa7)});
 check('unsupported CreateSurface chain/foreign bits never publishes',()=>{for(const [off,value] of [[200,8],[36,123],[4,15],[12,0],[8,0x80000000]]){descriptor();w(d+off,value);w(out,0xdeadbeef);const used=e.vb_vidmem();assert.equal(call(owner,7,d,out),0x80004001);assert.equal(r(out),0);assert.equal(e.vb_vidmem(),used)}});
 check('native surface remains unchanged and is not silently cast to VB source',()=>{const nd=a(124);zero(nd,124);w(nd,124);w(nd+4,7);w(nd+8,4);w(nd+12,4);w(nd+104,0x840);e.vb_native(owner,nd,out);const native=r(out),nt=r(native);assert.notEqual(nt,table);assert.equal(call(dest,6,0,native,0,0,status+4),0x80070057);assert.equal(r(native),nt);assert.equal(call(native,2),0)});
 check('other unimplemented VB methods retain real-thunk E_NOTIMPL/stack ABI',()=>{for(let i=0;i<71;i++){const api=apis[r(r(table+i*4)+4)];if(api.stub)assert.equal(call(dest,i,...Array(api.nargs-1).fill(0)),0x80004001,api.name)}});

 check('heap draw state uses only metadata owner word and preserves caps/parent/billed bytes',()=>{const p=e.fore_meta(dest),before=Buffer.from(u8.slice(p,p+12));assert.equal(call(dest,54,0x123456),0,'SetForeColor must persist real drawing state');assert.deepEqual(Buffer.from(u8.slice(p,p+12)),before);const guest=v.getUint32(p+12,true);assert(guest,'heap ownership pointer must be published');assert.equal(e.guest_to_wasm(guest)>>>0,e.fore_state(dest)>>>0)});
 check('SetForeColor actual slot54/ESP12 persistent raw color and pen replacement',()=>{
  assert.equal(call(dest,54,0x00123456),0,'SetForeColor must persist real drawing state');
  const p=e.fore_state(dest)>>>0,old=v.getUint32(p+4,true);assert(old);assert.equal(v.getUint32(p,true),0x00123456);assert.equal(e.fore_pen_live(old),1);
  assert.equal(call(dest,54,0x00ffffff),0);const pen=v.getUint32(p+4,true);assert.notEqual(pen,old);assert.equal(e.fore_pen_live(old),0);assert.equal(e.fore_pen_live(pen),1);assert.equal(v.getUint32(p,true),0x00ffffff);
 });
 check('persistent pen drives real16bit pixels across independent transient DCs',()=>{
  u8.fill(0,db,db+dp*128);assert.equal(call(dest,54,0x000000ff),0);assert.equal(e.fore_native_line(dest,3),1);for(let x=1;x<7;x++)assert.equal(v.getUint16(db+3*dp+x*2,true),0xf800);assert.equal(v.getUint16(db+3*dp,true),0);assert.equal(v.getUint16(db+3*dp+14,true),0);
  assert.equal(e.fore_native_line(dest,5),1);for(let x=1;x<7;x++)assert.equal(v.getUint16(db+5*dp+x*2,true),0xf800);
  assert.equal(call(src,54,0x0000ff00),0);assert.equal(e.fore_native_line(src,7),1);for(let x=1;x<7;x++)assert.equal(v.getUint16(sb+7*sp+x*2,true),0x07e0);assert.equal(v.getUint32(e.fore_state(dest),true),0xff);assert.equal(v.getUint32(e.fore_state(src),true),0xff00);
 });
 check('SetForeColor native allocation failure preserves old pen but retains requested color',()=>{
  const handles=[];let pen;while((pen=e.fore_alloc())!==0){handles.push(pen);assert(handles.length<65536)}
  const p=e.fore_state(dest),old=v.getUint32(p+4,true);try{assert.equal(call(dest,54,0xabcdef01),0x80070057);assert.equal(v.getUint32(p,true),0xabcdef01);assert.equal(v.getUint32(p+4,true),old);assert.equal(e.fore_pen_live(old),1)}finally{for(const h of handles)assert.equal(e.fore_delete(h),1)}
  assert.equal(call(dest,54,0xffffff),0);assert.equal(e.fore_pen_live(old),0);
 });
 check('SetForeColor forged receiver preserves live per-surface state',()=>{
  const fake=a(8);w(fake,r(dest));w(fake+4,r(dest+4));const p=e.fore_state(dest),before=Buffer.from(u8.slice(p,p+8));assert.equal(call(fake,54,0x999999),0x80070057);assert.deepEqual(Buffer.from(u8.slice(p,p+8)),before);
 });

 const bstr=(text,extra=0)=>{const q=a(text.length*2+8);w(q,text.length*2+extra);for(let i=0;i<text.length;i++)e.guest_write16(q+4+i*2,text.charCodeAt(i));e.guest_write16(q+4+text.length*2,0x5a5a);return q+4};
 const preview=bstr('Preview'),image16=()=>Buffer.from(u8.slice(db,db+dp*128));
 const clear=()=>u8.fill(0,db,db+dp*128),hasInk=()=>{let n=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(v.getUint16(db+y*dp+x*2,true))n++;return n};
 check('DrawText actual Preview BSTR/slot18/ESP24 produces native16bit glyph pixels',()=>{
  assert.equal(call(dest,54,0xffffff),0);clear();assert.equal(call(dest,18,9,7,preview,0),0,'DrawText must execute real counted text');assert(hasInk()>20);assert.equal(e.draw_dc_alive(dest),0);const white=image16();assert.equal(call(dest,54,0x000000ff),0);clear();assert.equal(call(dest,18,9,7,preview,0),0);let pixels=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++){const before=white.readUInt16LE(y*dp+x*2),after=v.getUint16(db+y*dp+x*2,true);assert.equal(after,before?0xf800:0);if(before)pixels++}assert(pixels>20);assert.equal(e.draw_dc_alive(dest),0);
 });
 check('DrawText counted Unicode/embeddedNUL/oddbyte floor never scans past BSTR',()=>{
  assert.equal(call(dest,54,0xffffff),0);clear();assert.equal(call(dest,18,2,2,bstr('A\u0000B'),0),0);const ab=image16();clear();assert.equal(call(dest,18,2,2,bstr('A\u0000C'),0),0);assert.notDeepEqual(image16(),ab,'characters following counted NUL must participate');clear();assert.equal(call(dest,18,2,2,bstr('Café'),0),0);const even=image16();assert(hasInk()>0);clear();assert.equal(call(dest,18,2,2,bstr('Café',1),0),0);assert.deepEqual(image16(),even);assert.equal(e.draw_dc_alive(dest),0);
 });
 check('DrawText sparse length/payload reads preserve guest backing and match contiguous glyphs',()=>{
  clear();assert.equal(call(dest,18,3,4,preview,0),0);const expected=image16(),b=0x3d000000,n=b+0x10000;for(const q of[b,n,b+4096])e.test_virtual_map_commit(q,4096);assert.notEqual(e.guest_to_wasm(b)+4096,e.guest_to_wasm(b+4096));for(let i=0;i<128;i++)e.guest_write8(n+i,0x6a);
  for(const q of[b+4093,b+4098]){w(q-4,14);for(let i=0;i<14;i++)e.guest_write8(q+i,e.guest_read8(preview+i));clear();assert.equal(call(dest,18,3,4,q,0),0);assert.deepEqual(image16(),expected);for(let i=0;i<128;i++)assert.equal(e.guest_read8(n+i),0x6a);assert.equal(e.draw_dc_alive(dest),0)}
 });
 check('DrawText invalid BSTR/span/oversized count do not create DC or alter pixels',()=>{
  const before=image16();for(const [q,hr]of[[0,0x80070057],[1,0x80004003],[0xffffffff,0x80004003]])assert.equal(call(dest,18,0,0,q,0),hr);const q=0x3e000000;e.test_virtual_map_commit(q,4096);w(q+4088,20);assert.equal(call(dest,18,0,0,q+4092,0),0x80004003);const big=bstr('');w(big-4,131074);assert.equal(call(dest,18,0,0,big,0),0x80004001);assert.deepEqual(image16(),before);assert.equal(e.draw_dc_alive(dest),0);assert.equal(call(dest,18,0,0,bstr(''),0),0);assert.deepEqual(image16(),before);
 });
 check('DrawText clips offedge coordinates and honors low16 update-current-position',()=>{
  clear();assert.equal(call(dest,18,0,0,preview,0),0);const origin=image16();clear();assert.equal(call(dest,18,37,41,preview,0xffff),0);assert.deepEqual(image16(),origin,'TA_UPDATECP uses fresh DC current origin');clear();assert.equal(call(dest,18,0,0,preview,0x10000),0);assert.deepEqual(image16(),origin,'only low16 VARIANT_BOOL participates');clear();assert.equal(call(dest,18,-3,-2,preview,0),0);assert(hasInk()>0);clear();assert.equal(call(dest,18,500,500,preview,0),0);assert.equal(hasInk(),0);assert.equal(e.draw_dc_alive(dest),0);
 });
 check('DrawText32bit uses native COLORREF conversion and isolated surface lifetime',()=>{
  descriptor(128,32);w(d+4,0x1007);w(d+76,0x40);w(d+104,32);w(d+128,0xff0000);w(d+148,0xff00);w(d+164,0xff);assert.equal(call(owner,7,d,out),0);const o=r(out),bits=e.vb_bits(o)>>>0,pitch=e.vb_pitch(o);u8.fill(0,bits,bits+pitch*32);assert.equal(call(o,54,0x00332211),0);assert.equal(call(o,18,1,1,preview,0),0);let ink=0;for(let y=0;y<32;y++)for(let x=0;x<128;x++){const color=v.getUint32(bits+y*pitch+x*4,true);if(color){assert.equal(color&0xffffff,0x112233);ink++}}assert(ink>20);assert.equal(e.draw_dc_alive(o),0);assert.equal(call(o,2),0);
 });
 assert.equal(call(dest,54,0xffffff),0);

 check('DrawText propagates actual GetDC exhaustion and frees gathered sparse input',()=>{
  const handles=[];for(let i=0;i<65536;i++){const hdc=0x500000+i;if(!e.draw_alloc_dc(hdc))break;handles.push(hdc)}assert(handles.length>0&&handles.length<65536);const before=image16();try{assert.equal(call(dest,18,0,0,0x3d001002,0),0x88760096);assert.deepEqual(image16(),before);assert.equal(e.draw_dc_alive(dest),0)}finally{for(const hdc of handles)e.draw_free_dc(hdc)}assert.equal(call(dest,18,0,0,preview,0),0);assert.equal(e.draw_dc_alive(dest),0);
 });
 const drawMeta=e.fore_meta(dest),sourceMeta=e.fore_meta(src),drawState=e.fore_state(dest),sourceState=e.fore_state(src),destPen=v.getUint32(drawState+4,true),srcPen=v.getUint32(sourceState+4,true);
 const aux=new WebAssembly.Instance(h.module,{host:h.host,gdi:h.gdi}).exports;
 check('shared draw state survives auxiliary instance construction without reinitialization',()=>{assert.equal(aux.fore_load_wa(drawState)>>>0,0xffffff);assert.equal(aux.fore_load_wa(drawState+4)>>>0,destPen);assert.equal(aux.fore_load_wa(sourceState)>>>0,0xff00)});
 check('created and image lifetime release independently to zero',()=>{assert.equal(e.vb_refs(src),1);assert.equal(e.vb_refs(dest),1);assert.equal(call(src,2),0);assert.equal(call(dest,2),0)});
 check('final release retires both pens and clears shared state; fresh surface defaults remain black',()=>{for(const p of[destPen,srcPen])assert.equal(e.fore_pen_live(p),0);for(const p of[drawMeta,sourceMeta])assert.equal(aux.fore_load_wa(p+12),0);descriptor(8,8);assert.equal(call(owner,7,d,out),0);const o=r(out),p=e.fore_state(o);assert.equal(p,0);assert.equal(v.getUint32(e.fore_meta(o)+12,true),0);assert.equal(call(o,2),0)});
 return {cases,limits:['no gameplay qualification','bounded offscreen same-format copy/WAIT only','no broad native DirectDraw or VB drawing support claim']};
}

async function runMissingFonts(h,apis,notepad){
 const e=h.exports,u8=new Uint8Array(h.memory.buffer);u8.set(notepad,e.get_staging());assert(e.load_pe(notepad.length)>0);e.init_dx_com_thunks();
 const a=n=>e.guest_alloc(n)>>>0,w=(p,x)=>e.guest_write32(p,x),r=p=>e.guest_read32(p)>>>0,stack=a(64),out=a(4),d=a(232),text=a(20);for(let i=0;i<232;i++)e.guest_write8(d+i,0);w(d+4,7);w(d+8,32);w(d+12,128);w(d+200,0x840);w(text,14);for(let i=0;i<7;i++)e.guest_write16(text+4+i*2,'Preview'.charCodeAt(i));
 const call=(o,slot,...args)=>{const thunk=r(r(o)+slot*4),api=apis[r(thunk+4)];assert.equal(api.nargs,args.length+1);w(stack,0);[o,...args].forEach((x,i)=>w(stack+4+i*4,x));e.set_esp(stack);e.set_eip(thunk);e.run(1);assert.equal(e.get_eip(),0);assert.equal(e.get_esp()>>>0,stack+(api.nargs+1)*4);return e.get_eax()>>>0};
 e.vb_factory(out);const owner=r(out);assert.equal(call(owner,7,d,out),0);const obj=r(out),bits=e.vb_bits(obj)>>>0,n=e.vb_pitch(obj)*32;u8.fill(0,bits,bits+n);assert.equal(call(obj,54,0xffffff),0);assert.equal(call(obj,18,0,0,text+4,0),0);assert(u8.slice(bits,bits+n).every(x=>x===0),'missing real fonts cannot fabricate pixels');assert.equal(e.draw_dc_alive(obj),0);assert.equal(call(obj,2),0);console.log('PASS native ignored raster BOOL with missing font is not pixel qualification');return {cases:1,missingFontsPixels:false};
}

const {bootRenderHarness}=require('./render-helper');
(async()=>{const apis=require('../src/api_table.json'),notepad=fs.readFileSync(__dirname+'/binaries/notepad.exe'),fixture=fs.readFileSync(__dirname+'/fixtures/vbdd-image-helpers/asymmetric.bmp');const h=await bootRenderHarness({extraWat:extraWat+foreExtraWat,fonts:'bitmap'});const main=await run(h,apis,notepad,fixture);const empty=await bootRenderHarness({extraWat:extraWat+foreExtraWat,fonts:'none'});const negative=await runMissingFonts(empty,apis,notepad);console.log(JSON.stringify({status:'PASS',cases:main.cases+negative.cases,main,negative}));})().catch(e=>{console.error(e);process.exitCode=1;});
