#!/usr/bin/env node
'use strict';
// Current desktop dimensions must not overwrite the retained last explicit mode.
const assert=require('assert/strict');
const {bootRenderHarness}=require('./render-helper');
const extraWat=String.raw`
  (func (export "test_dx_backbuffer_seed") (param $ddraw_vtbl i32) (param $surface_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl))
    (global.set $DX_VTBL_DDSURF2 (local.get $surface_vtbl)))
  (func (export "test_dx_backbuffer_create") (param $desc i32) (param $out i32) (result i32)
    (local $ddraw i32)
    (local.set $ddraw (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface
      (local.get $ddraw) (local.get $desc) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dx_backbuffer_desc") (param $surface i32) (param $desc i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_GetSurfaceDesc
      (local.get $surface) (local.get $desc) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dx_backbuffer_get") (param $surface i32) (param $caps i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_GetAttachedSurface
      (local.get $surface) (local.get $caps) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dx_surface_dib_wa") (param $surface i32) (result i32)
    (i32.load offset=20 (call $dx_from_this (local.get $surface))))
  (func (export "test_dx_surface_lock") (param $surface i32) (param $rect i32) (param $desc i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_Lock
      (local.get $surface) (local.get $rect) (local.get $desc) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_dx_surface_release") (param $surface i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_Release
      (local.get $surface) (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

(func (export "test_select_mode") (param $w i32) (param $h i32)
 (local $obj i32)
 (call $wnd_table_set (i32.const 0x10001) (global.get $WNDPROC_BUILTIN))
 (call $dx_coop_hwnd_set (i32.const 0x10001))
 (local.set $obj (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDraw_SetDisplayMode (local.get $obj) (local.get $w) (local.get $h) (i32.const 16) (i32.const 0) (i32.const 0)))
(func (export "test_unlock") (param $surface i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDrawSurface_Unlock (local.get $surface) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "test_current_mode") (param $out i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDraw_GetDisplayMode (i32.const 0) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "test_restore_mode")
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDraw_RestoreDisplayMode (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "test_copy") (param $dst i32) (param $rect i32) (param $src i32) (result i32)
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDrawSurface_Blt (local.get $dst) (local.get $rect) (local.get $src) (i32.const 0) (i32.const 0x01000000) (i32.const 0))
 (i32.load offset=0 (global.get $reg_base)))
`;
(async()=>{
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});let hostW=1024,hostH=740,reads=0;
 const opts={extraWat,memory,fonts:'none',extraHostOverrides:{get_screen_size:()=>{reads++;return hostW|(hostH<<16);},move_window:()=>{},get_window_rect:(hwnd,p)=>{const d=new DataView(memory.buffer);[0,0,800,600].forEach((v,i)=>d.setInt32(p+i*4,v,true));}}};
 const owner=await bootRenderHarness(opts),other=await bootRenderHarness(opts);const e=owner.exports,f=other.exports;
 for(const ex of[e,f])ex.test_dx_backbuffer_seed(0x51000000,0x52000000);
 const desc=0x410000,out=0x410100,query=0x410200,rect=0x410300;
 function dimensions(ex,surface){ex.test_dx_backbuffer_desc(surface,query);return[ex.guest_read32(query+12),ex.guest_read32(query+8)];}
 function mode(ex){const n=reads;ex.test_current_mode(query);const result=[ex.guest_read32(query+12),ex.guest_read32(query+8)];if(!ex.get_display_mode_active())assert.equal(reads-n,1,'one coherent desktop read');return result;}
 function create(ex,caps,w=0,h=0){const active=ex.get_display_mode_active(),readBefore=reads;for(let n=0;n<108;n+=4)ex.guest_write32(desc+n,0);ex.guest_write32(desc,108);ex.guest_write32(desc+4,w?7:1);ex.guest_write32(desc+8,h);ex.guest_write32(desc+12,w);ex.guest_write32(desc+104,caps);assert.equal(ex.test_dx_backbuffer_create(desc,out),0);if(caps&0x200)assert.equal(reads-readBefore,active?0:1,"primary allocation reads one coherent desktop size only without explicit mode");return ex.guest_read32(out);}
 e.test_dx_set_process_state(0,0,0,0,0,0,0);
 const primary=create(e,0x200);assert.deepEqual(dimensions(e,primary),[1024,740]);assert.deepEqual(mode(f),[1024,740]);
 const source=create(e,0x40,794,548);assert.deepEqual(dimensions(e,source),[794,548]);
 e.test_dx_surface_lock(source,0,query);const pixels=e.guest_read32(query+36),pitch=e.guest_read32(query+16);
 const points=[[0,0,0x1234],[793,0,0x2345],[0,547,0x3456],[793,547,0x4567]];
 for(const[x,y,value]of points){e.guest_write8(pixels+y*pitch+x*2,value&255);e.guest_write8(pixels+y*pitch+x*2+1,value>>>8);}
 e.test_unlock(source);
 [23,43,817,591].forEach((n,i)=>e.guest_write32(rect+i*4,n));assert.equal(e.test_copy(primary,rect,source),0);
 e.test_dx_surface_lock(primary,0,query);const dst=e.guest_read32(query+36),dstPitch=e.guest_read32(query+16);
 for(const[x,y,value]of points)assert.equal(e.guest_read8(dst+(y+43)*dstPitch+(x+23)*2)|(e.guest_read8(dst+(y+43)*dstPitch+(x+23)*2+1)<<8),value,'exact source corner survives nonzero-offset copy');
 e.test_unlock(primary);
 // Actual LF2 diagnostic uses a550-row source and a548-row destination.
 // Production nearest-neighbor sampling is sy=floor(dy*sh/dh), so the
 // final destination row547 samples source548, not last source row549.
 const scaled=create(e,0x40,794,550);assert.deepEqual(dimensions(e,scaled),[794,550]);
 e.test_dx_surface_lock(scaled,0,query);const scaledPixels=e.guest_read32(query+36),scaledPitch=e.guest_read32(query+16);
 const sampleRows=[0,1,273,274,547];
 for(const dy of sampleRows){const sy=Math.floor(dy*550/548);for(const x of[0,793]){const value=0x1000+sy*32+(x?7:3),p=scaledPixels+sy*scaledPitch+x*2;e.guest_write8(p,value&255);e.guest_write8(p+1,value>>>8);}}
 for(const x of[0,793]){const p=scaledPixels+549*scaledPitch+x*2;e.guest_write8(p,255);e.guest_write8(p+1,255);}
 e.test_unlock(scaled);assert.equal(e.test_copy(primary,rect,scaled),0);
 e.test_dx_surface_lock(primary,0,query);const scaledDst=e.guest_read32(query+36),scaledDstPitch=e.guest_read32(query+16);
 for(const dy of sampleRows)for(const x of[0,793]){const sy=Math.floor(dy*550/548),p=scaledDst+(dy+43)*scaledDstPitch+(x+23)*2;assert.equal(e.guest_read8(p)|(e.guest_read8(p+1)<<8),0x1000+sy*32+(x?7:3),'scaled full-source nearest-neighbor edge survives primary bounds');}
 e.test_unlock(primary);
 for(const[w,h]of[[800,600],[1023,739]]){hostW=w;hostH=h;assert.deepEqual(mode(e),[w,h]);const p=create(f,0x200);assert.deepEqual(dimensions(f,p),[w,h]);}
 for(const[w,h,expectedW,expectedH]of[[0,0,640,480],[0,739,640,739],[1023,0,1023,480]]){hostW=w;hostH=h;assert.deepEqual(mode(e),[expectedW,expectedH]);const p=create(f,0x200);assert.deepEqual(dimensions(f,p),[expectedW,expectedH]);}
 hostW=1023;hostH=739;
 for(const[w,h]of[[640,480],[800,600]]){e.test_dx_set_process_state(w,h,16,1,0,1,0);const n=reads;assert.deepEqual(mode(f),[w,h]);const p=create(f,0x200);assert.deepEqual(dimensions(f,p),[w,h]);assert.equal(reads,n,'explicit mode never overridden by desktop');e.test_restore_mode();assert.equal(f.get_display_mode_active(),0);assert.deepEqual([f.test_dx_get_process_state(0),f.test_dx_get_process_state(1)],[w,h],'retained last mode remains intact');assert.deepEqual(mode(f),[hostW,hostH]);assert.deepEqual(dimensions(e,p),[w,h],'restore leaves allocated surface geometry intact');}
 assert.deepEqual(dimensions(e,source),[794,548]);
 e.test_dx_set_process_state(640,480,16,1,0,1,0);e.set_post_queue_count(0);
 e.test_select_mode(800,600);assert.equal(e.get_post_queue_count(),3,'changed mode posts DISPLAYCHANGE/MOVE/SIZE');
 e.set_post_queue_count(0);e.test_restore_mode();assert.deepEqual(mode(f),[hostW,hostH]);
 e.test_select_mode(800,600);assert.equal(e.get_post_queue_count(),0,'same retained mode after restore must not restart RCT notification loop');
 console.log('PASS current desktop primary/GetDisplayMode, exact offscreen/copy corners, odd sizes, explicit modes, restore+last-mode retention, two-instance agreement');
})().catch(e=>{console.error(e);process.exitCode=1;});
