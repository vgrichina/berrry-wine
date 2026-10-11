'use strict';
const assert=require('node:assert/strict');
const extraWat=String.raw`
;; A 16-bpp mode, as SetDisplayMode(w, h, 16) records it. The pitch and pixel
;; checks below are 2 bytes per pixel, and an unset depth now reports the
;; 32-bpp desktop; a mode in effect also keeps 4ed42731f's desktop-sized
;; windowed primary out of the picture.
(func (export "vb_mode") (param $w i32) (param $h i32) (call $dx_display_w_set (local.get $w)) (call $dx_display_h_set (local.get $h))
 (call $dx_display_mode_set (i32.ne (local.get $w) (i32.const 0)))
 (call $dx_display_bpp_set (i32.const 16)))
(func (export "vb_factory") (param $out i32) (call $handle_IDirectX7_DirectDrawCreate (i32.const 0) (i32.const 0) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0)))
(func (export "vb_bits") (param $obj i32) (result i32) (load.field DxObject misc1 (call $dx_from_this (local.get $obj))))
(func (export "vb_pitch") (param $obj i32) (result i32) (load.field DxObject pitch (call $dx_from_this (local.get $obj))))

(func (export "clip_native") (param $dst i32) (param $dr i32) (param $src i32) (param $sr i32) (param $flags i32) (param $frame i32) (result i32)
 (local $esp i32) (local $eax i32) (local $hr i32)
 (local.set $esp (i32.load offset=16 (global.get $reg_base))) (local.set $eax (i32.load (global.get $reg_base)))
 (call $gs32 (i32.add (local.get $frame) (i32.const 24)) (i32.const 0))
 (i32.store offset=16 (global.get $reg_base) (local.get $frame))
 (call $handle_IDirectDrawSurface_Blt (local.get $dst) (local.get $dr) (local.get $src) (local.get $sr) (local.get $flags) (i32.const 0))
 (local.set $hr (i32.load (global.get $reg_base)))
 (i32.store offset=16 (global.get $reg_base) (local.get $esp)) (i32.store (global.get $reg_base) (local.get $eax)) (local.get $hr))
`;
async function run(h,apis,pe){
 const e=h.exports,u8=new Uint8Array(h.memory.buffer),v=new DataView(h.memory.buffer);u8.set(pe,e.get_staging());assert(e.load_pe(pe.length)>0);e.init_dx_com_thunks();
 const a=n=>e.guest_alloc(n)>>>0,w=(p,x)=>e.guest_write32(p,x),r=p=>e.guest_read32(p)>>>0,zero=(p,n)=>{for(let i=0;i<n;i++)e.guest_write8(p+i,0)};
 const stack=a(256),out=a(4),desc=a(232),status=a(12),dr=a(16),sr=a(16),frame=a(32);let cases=0;const check=(name,f)=>{f();cases++;console.log('PASS '+name)};
 const call=(o,slot,...args)=>{const thunk=r(r(o)+slot*4),api=apis[r(thunk+4)];assert.equal(r(thunk),0xcaca0010);assert.equal(api.nargs,args.length+1);w(stack,0);[o,...args].forEach((x,i)=>w(stack+4+i*4,x));const saved=Array.from({length:32},(_,i)=>r(stack+i*4));e.set_esp(stack);e.set_eip(thunk);e.run(1);assert.equal(e.get_eip(),0);assert.equal(e.get_esp()>>>0,stack+(api.nargs+1)*4);for(let i=0;i<32;i++)assert.equal(r(stack+i*4),saved[i]);return e.get_eax()>>>0};
 e.vb_factory(out);const owner=r(out);e.vb_mode(640,480);zero(desc,232);w(desc+4,1);w(desc+200,0x200);assert.equal(call(owner,7,desc,out),0);const dst=r(out);
 zero(desc,232);w(desc+4,7);w(desc+8,694);w(desc+12,1016);w(desc+200,0x840);assert.equal(call(owner,7,desc,out),0);const src=r(out);
 const db=e.vb_bits(dst)>>>0,sb=e.vb_bits(src)>>>0,dp=e.vb_pitch(dst),sp=e.vb_pitch(src);assert.equal(dp,1280);assert.equal(sp,2032);
 const color=(x,y)=>((x*3+y*37)%65534)+1;for(let y=0;y<694;y++)for(let x=0;x<1016;x++)v.setUint16(sb+y*sp+x*2,color(x,y),true);
 const rect=(p,values)=>values.forEach((x,i)=>w(p+i*4,x)),reset=()=>{u8.fill(0xa5,db,db+dp*480);w(status,0x11223344);w(status+4,0xdeadbeef);w(status+8,0x55667788)},shot=()=>Buffer.from(u8.slice(db,db+dp*480));
 const invoke=(d,s,flags=0x1000000)=>{assert.equal(call(dst,6,d,src,s,flags,status+4),0);assert.equal(r(status),0x11223344);assert.equal(r(status+8),0x55667788);return r(status+4)};
 const pixels=(ox,oy,sw=1016,sh=694)=>{for(let y=0;y<480;y++)for(let x=0;x<640;x++){const sx=x-ox,sy=y-oy;assert.equal(v.getUint16(db+y*dp+x*2,true),sx>=0&&sy>=0&&sx<sw&&sy<sh?color(sx,sy):0xa5a5,`${x},${y}`)}};
 check('captured primary Blt clips real pixels instead of adapter E_NOTIMPL',()=>{reset();rect(dr,[4,42,1020,736]);zero(sr,16);assert.equal(invoke(dr,sr),0,'captured primary Blt must reach native clipping');pixels(4,42);const actual=shot();reset();assert.equal(e.clip_native(dst,dr,src,0,0x1000000,frame)>>>0,0);assert.deepEqual(shot(),actual);assert.equal(call(dst,40,desc),0);assert.equal(r(desc+12),640);assert.equal(r(desc+8),480)});
 check('negative destination clips paired source origin without row wrap',()=>{reset();rect(dr,[-13,-9,1003,685]);zero(sr,16);assert.equal(invoke(dr,sr),0);pixels(-13,-9);const actual=shot();reset();assert.equal(e.clip_native(dst,dr,src,0,0x1000000,frame)>>>0,0);assert.deepEqual(shot(),actual)});
 check('sparse cross-page destination RECT and statusOut preserve unrelated page',()=>{const b=0x3b000000,n=b+0x10000;for(const p of[b,n,b+4096])e.test_virtual_map_commit(p,4096);assert.notEqual(e.guest_to_wasm(b)+4096,e.guest_to_wasm(b+4096));for(let i=0;i<128;i++)e.guest_write8(n+i,0x6d);const q=b+4091;rect(q,[4,42,1020,736]);reset();zero(sr,16);assert.equal(invoke(q,sr),0);pixels(4,42);rect(dr,[4,42,1020,736]);assert.equal(call(dst,6,dr,src,0,0x1000000,b+4095),0);assert.equal(r(b+4095),0);for(let i=0;i<128;i++)assert.equal(e.guest_read8(n+i),0x6d)});
 check('NULL and zero source RECT are identical full source native inputs',()=>{reset();rect(dr,[4,42,1020,736]);assert.equal(invoke(dr,0),0);const actual=shot();reset();zero(sr,16);assert.equal(invoke(dr,sr),0);assert.deepEqual(shot(),actual);reset();assert.equal(invoke(0,0),0);const nullBoth=shot();reset();zero(dr,16);assert.equal(invoke(dr,sr),0);assert.deepEqual(shot(),nullBoth)});
 check('invalid source bounds and inverted destination retain explicit failure and pixels',()=>{for(const values of[[-1,0,1015,694],[0,0,1017,694],[0,0,1016,695]]){reset();rect(dr,[4,42,1020,736]);rect(sr,values);const before=shot();assert.equal(invoke(dr,sr),0x80004001);assert.deepEqual(shot(),before)}reset();rect(dr,[12,42,4,736]);zero(sr,16);const before=shot();assert.equal(invoke(dr,sr),0x80004001);assert.deepEqual(shot(),before)});
 check('fully off-target equal-size copy is native clipped no-op',()=>{reset();rect(dr,[700,500,1716,1194]);zero(sr,16);const before=shot();assert.equal(invoke(dr,sr),0);assert.deepEqual(shot(),before);assert.equal(e.clip_native(dst,dr,src,0,0x1000000,frame)>>>0,0);assert.deepEqual(shot(),before)});
 check('out-of-bounds stretch and unsupported flag remain explicit no-write',()=>{reset();rect(dr,[4,42,1021,736]);zero(sr,16);const before=shot();assert.equal(invoke(dr,sr),0x80004001);assert.deepEqual(shot(),before);rect(dr,[4,42,1020,736]);assert.equal(invoke(dr,sr,0x20),0x80004001);assert.deepEqual(shot(),before)});
 check('unmapped RECT and statusOut reject before native drawing',()=>{reset();const before=shot();assert.equal(call(dst,6,1,src,0,0x1000000,status+4),0x80004003);assert.equal(call(dst,6,0,src,1,0x1000000,status+4),0x80004003);assert.equal(call(dst,6,0,src,0,0x1000000,0),0x80004003);assert.deepEqual(shot(),before);assert.equal(call(src,2),0);assert.equal(call(dst,2),0);e.vb_mode(0,0)});
 return {cases,kind:'actual-vb-com-clipped-pixels'};
}
module.exports={extraWat,run};

if(require.main===module){const fs=require('fs'),{bootRenderHarness}=require('./render-helper');(async()=>{const h=await bootRenderHarness({extraWat,fonts:'none'});console.log(JSON.stringify(await run(h,require('../src/api_table.json'),fs.readFileSync(__dirname+'/binaries/notepad.exe'))));})().catch(e=>{console.error(e);process.exitCode=1;});}
