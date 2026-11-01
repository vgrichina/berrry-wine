#!/usr/bin/env node
'use strict';
// Full production closure, with adapters only at the public draw/resource
// boundary. No extracted rasterizer, substituted sampler or forced LOD.
const assert=require('assert'),fs=require('fs'),path=require('path');
const {bootRenderHarness}=require('./render-helper');
const extraWat=String.raw`
(func (export "mip_seed")
 (global.set $DX_VTBL_DDRAW (i32.const 0x51000000))
 (global.set $DX_VTBL_DDSURF2 (i32.const 0x52000000)))
(func (export "mip_surface") (param $desc i32) (param $out i32) (result i32)
 (local $dd i32)
 (local.set $dd (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
 (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
 (call $handle_IDirectDraw_CreateSurface (local.get $dd) (local.get $desc) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))
 (i32.load (global.get $reg_base)))
(func (export "mip_device") (param $rt i32) (param $out i32) (result i32)
 (call $d3dim_create_device (i32.const 0) (local.get $rt) (local.get $out) (i32.const 0x53000000))
 (i32.load (global.get $reg_base)))
(export "mip_tss" (func $d3dim_set_tss))
(export "mip_rs" (func $d3dim_set_render_state))
(export "mip_bind" (func $d3dim_set_texture))
(export "mip_caps" (func $d3dim_fill_device_desc7))
(func (export "mip_active") (result i32) (global.get $d3dim_mip_on))
(func (export "mip_format") (param $s i32) (param $fmt i32)
 (call $dx_surf_fmt_set (call $dx_from_this (local.get $s)) (local.get $fmt)))
(func (export "mip_gpu") (param $on i32) (global.set $d3dim_gpu_on (local.get $on)))
(func (export "mip_entry") (param $s i32) (result i32) (call $dx_from_this (local.get $s)))
(func (export "mip_next") (param $s i32) (result i32)
 (load.field DxObject misc0 (call $dx_from_this (local.get $s))))
(func (export "mip_draw") (param $dev i32) (param $v i32)
 (call $d3dim_draw_primitive (local.get $dev) (i32.const 4) (i32.const 3) (local.get $v) (i32.const 3)))
`;
(async()=>{
 const h=await bootRenderHarness({extraWat,fonts:'none'}),e=h.exports,m=new DataView(h.memory.buffer);
 e.mip_seed();const desc=0x410000,out=0x410100,vertices=0x420000,caps=0x430000;
 const w32=(a,v)=>e.guest_write32(a,v),f32=(a,v)=>{const b=new DataView(new ArrayBuffer(4));b.setFloat32(0,v,true);w32(a,b.getUint32(0,true));};
 function surface(w,h,mip=true,count=0){
  for(let i=0;i<128;i+=4)w32(desc+i,0);
  for(const [off,v] of [[0,108],[4,0x1007|(count?0x20000:0)],[8,h],[12,w],[24,count],[72,32],[76,0x40],[84,32],[88,0xff0000],[92,0xff00],[96,0xff],[104,mip?0x401008:0x40]])w32(desc+off,v);
  assert.equal(e.mip_surface(desc,out)>>>0,0);return e.guest_read32(out)>>>0;
 }
 const rt=surface(32,32,false);assert.equal(e.mip_device(rt,out)>>>0,0);let dev=e.guest_read32(out)>>>0;
 const tex=surface(16,16),levels=[];for(let s=tex;s;s=e.mip_next(s)>>>0){levels.push(s);assert(levels.length<=5);}
 assert.equal(levels.length,5);
 const entry=s=>e.mip_entry(s)>>>0;
 const dib=s=>m.getUint32(entry(s)+20,true),pitch=s=>m.getUint16(entry(s)+18,true);
 const colors=[0xffff0000,0xff00ff00,0xff0000ff,0xffffffff,0xffffff00];
 function fill(s,c){let a=entry(s),w=m.getUint16(a+12,true),hh=m.getUint16(a+14,true);for(let y=0;y<hh;y++)for(let x=0;x<w;x++)m.setUint32(dib(s)+y*pitch(s)+4*x,c,true);}
 levels.forEach((s,i)=>fill(s,colors[i]));
 const tss=(t,v)=>e.mip_tss(dev,0,t,v),rs=(r,v)=>e.mip_rs(dev,r,v);
 e.mip_bind(dev,0,tex);rs(22,1);rs(7,0);rs(27,0);tss(1,2);tss(4,2);tss(13,1);tss(14,1);
 const evidence=[],frames=[];
 function stage(min=1,mag=1,mip=1){tss(17,min);tss(16,mag);tss(18,mip);}
 function draw(n,{q=[1,1,1],uv=null}={}){
  fill(rt,0xff111111);
  [[0,0],[32,0],[0,32]].forEach(([x,y],i)=>{let a=vertices+i*32;f32(a,x);f32(a+4,y);f32(a+8,.5);f32(a+12,q[i]);w32(a+16,0xffffffff);w32(a+20,0);f32(a+24,uv?uv[i][0]:i===1?n:0);f32(a+28,uv?uv[i][1]:i===2?n:0);});
  e.mip_draw(dev,vertices);
 }
 const pixel=(x=4,y=4)=>m.getUint32(dib(rt)+y*pitch(rt)+x*4,true)>>>0;
 function expect(label,c,x=4,y=4,tolerance=0){let got=pixel(x,y);for(let b=0;b<4;b++)assert(Math.abs((got>>>(b*8)&255)-(c>>>(b*8)&255))<=tolerance,`${label}: got ${got.toString(16)} expected ${c.toString(16)}`);evidence.push({label,x,y,pixel:got,expected:c});frames.push(Array.from({length:1024},(_,i)=>pixel(i%32,Math.floor(i/32))));}
 stage();for(const [n,l] of [[.5,0],[2,0],[4,1],[8,2],[16,3],[32,4],[65536,4]]){draw(n);expect(`nearest footprint ${n/2}`,colors[l]);}
 stage(1,1,0);draw(32);expect('MIP NONE minification stays level zero',colors[0]);
 stage(1,1,2);draw(2*Math.sqrt(8));expect('linear mip half green/blue',0xff008080,4,4,1);
 stage(2,2,2);draw(2*Math.sqrt(8));expect('trilinear half green/blue',0xff008080,4,4,1);
 // Perspective quotient derivative varies within one face. Independent
 // analytic reference: U=x/8, V=y/8, Q=1-3*x/128-3*y/128.
 stage();draw(16,{q:[1,.25,.25]});
 for(const [x,y] of [[1,1],[8,1],[14,1],[20,1],[27,1]]){
  let Q=1-3*(x+y)/128,U=x/8,V=y/8;
  let dux=(.125*Q+U*3/128)/Q**2,duy=U*3/128/Q**2;
  let dvx=V*3/128/Q**2,dvy=(.125*Q+V*3/128)/Q**2;
  let rho=16*Math.sqrt(Math.max(dux**2+dvx**2,duy**2+dvy**2));let l=Math.min(4,Math.max(0,Math.floor(Math.log2(rho)+.5)));
  expect(`perspective at ${x},${y} rho=${rho}`,colors[l],x,y);
 }
 // Anisotropic footprint must consider the y derivative even on a constant-U
 // scanline. A horizontal-only span heuristic wrongly returns level zero.
 stage();draw(0,{uv:[[.25,0],[.25,0],[.25,16]]});expect('vertical footprint',colors[3]);
 // Distinct within-level texels distinguish legacy filters 3/4 from 5/6.
 const greenWhite=levels[1];for(let y=0;y<8;y++)for(let x=0;x<8;x++)m.setUint32(dib(greenWhite)+y*pitch(greenWhite)+4*x,x%2?0xffffffff:0xff000000,true);
 function legacy(f){
  assert.equal(e.mip_device(rt,out)>>>0,0);dev=e.guest_read32(out)>>>0;
  e.mip_bind(dev,0,tex);rs(22,1);rs(7,0);rs(27,0);tss(1,2);tss(4,2);tss(13,1);tss(14,1);
  rs(17,1);rs(18,f);
 }
 for(const [f,c] of [[3,0xff000000],[4,0xff000000],[5,0xff7f7f7f],[6,0xff7f7f7f]]){legacy(f);draw(4);expect(`legacy filter ${f} exact mip1`,c,4,4,1);}
 levels.forEach((s,i)=>fill(s,colors[i]));
 for(const [f,c] of [[3,colors[2]],[4,0xff006699],[5,colors[2]],[6,0xff006699]]){legacy(f);draw(2*2**1.6);expect(`legacy filter ${f} fractional LOD`,c,4,4,1);}
 // Explicit NONE overrides legacy even with MIN unset (zero fallback).
 tss(18,0);draw(32);expect('explicit NONE with legacy MIN fallback',colors[0]);
 // Stage overrides select point texels / no mips despite legacy filter 6.
 stage(1,1,0);draw(32);expect('explicit stage NONE overrides legacy mip request',colors[0]);
 // Opposing min/mag filters must switch with footprint; the old priority
 // order selected MAG for every fragment.
 for(let y=0;y<16;y++)for(let x=0;x<16;x++)m.setUint32(dib(tex)+y*pitch(tex)+4*x,x%2?0xffffffff:0xff000000,true);
 stage(1,2,0);draw(.5,{uv:[[.25,.25],[.75,.25],[.25,.75]]});expect('magnification uses MAG linear',0xff7f7f7f,4,4,1);
 draw(4);expect('minification uses MIN point',0xff000000);
 stage(2,1,0);draw(.5,{uv:[[.25,.25],[.75,.25],[.25,.75]]});expect('magnification uses MAG point',0xffffffff);
 draw(4);expect('minification uses MIN linear',0xff7f7f7f,4,4,1);
 // Magnification with mip selection enabled must retain every level-zero
 // checker pixel, including the within-image bilinear path.
 for(const filter of [1,2]){stage(filter,filter,0);draw(.5);const before=Array.from({length:1024},(_,i)=>pixel(i%32,Math.floor(i/32)));stage(filter,filter,1);draw(.5);assert.deepStrictEqual(Array.from({length:1024},(_,i)=>pixel(i%32,Math.floor(i/32))),before,`unchanged level0 checker pixels for filter ${filter}`);}
 fill(tex,colors[0]);
 // Each level owns metadata. Bad/missing successors stop rather than follow
 // cycles, stale images, a zero DIB, or non-halved attachments.
 const a=entry(levels[1]),link=m.getUint32(a+8,true),size=m.getUint32(a+12,true);
 stage();m.setUint32(a+8,0,true);draw(32);expect('partial chain clamps to last uploaded level',colors[1]);m.setUint32(a+8,link,true);
 const b=entry(levels[2]),savedDib=m.getUint32(b+20,true);m.setUint32(b+20,0,true);draw(32);expect('missing DIB clamps to valid predecessor',colors[1]);m.setUint32(b+20,savedDib,true);
 m.setUint32(a+8,tex,true);draw(32);expect('cycle/nonhalved chain bounded',colors[1]);m.setUint32(a+8,link,true);
 m.setUint32(a+8,0xfffffff8,true);draw(32);expect('invalid successor wrapper bounded',colors[1]);m.setUint32(a+8,link,true);
 m.setUint32(a+12,0x00070007,true);draw(32);expect('malformed dimensions stop before level',colors[0]);m.setUint32(a+12,size,true);
 // A level can have its own row pitch/format; sample that metadata rather
 // than inheriting level zero's 32-bit tightly packed image layout.
 const levelEntry=entry(levels[1]),packed=m.getUint32(levelEntry+16,true);
 // Repack the existing level allocation as padded RGB565 (8*2 + 4 bytes).
 // Format access goes through the actual production metadata setter.
 e.mip_format(levels[1],1);m.setUint32(levelEntry+16,(20<<16)|16,true);
 for(let y=0;y<8;y++)for(let x=0;x<8;x++)m.setUint16(dib(levels[1])+y*20+x*2,0xf81f,true);
 stage();draw(4);expect('per-level padded pitch and RGB565 format',0xffff00ff);
 m.setUint32(levelEntry+16,packed,true);e.mip_format(levels[1],0);fill(levels[1],colors[1]);
 const short=surface(16,16,true,2);assert(e.mip_next(short));assert.equal(e.mip_next(e.mip_next(short)),0,'declared two-level chain');
 fill(short,colors[0]);fill(e.mip_next(short),colors[1]);e.mip_bind(dev,0,short);stage();draw(65536);expect('declared chain length clamps',colors[1]);e.mip_bind(dev,0,tex);
 // Native triangle caps only. HAL/RGB enumerate this same builder; the GPU
 // still has a single-image descriptor and must keep the mip bits absent.
 e.mip_caps(caps);assert.equal(e.guest_read32(caps+96)>>>0,0x030303ff);assert.equal(e.guest_read32(caps+40)>>>0,0x030003c3);
 e.mip_gpu(1);e.mip_caps(caps);assert.equal(e.guest_read32(caps+96)>>>0,0x030003c3);e.mip_gpu(0);
 // Native mode must never leak into the next level-zero draw.
 stage(1,1,0);draw(32);expect('level0 behavior after mip draw unchanged',colors[0]);
 if(process.env.WINE_MIP_EVIDENCE){const dir=process.env.WINE_MIP_EVIDENCE;fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'pixels.json'),JSON.stringify(evidence,null,2));const {PNG}=require('pngjs');const png=new PNG({width:256,height:32*Math.ceil(frames.length/8)});frames.forEach((frame,k)=>{for(let y=0;y<32;y++)for(let x=0;x<32;x++){let c=frame[y*32+x],o=((Math.floor(k/8)*32+y)*256+(k%8)*32+x)*4;png.data[o]=c>>>16&255;png.data[o+1]=c>>>8&255;png.data[o+2]=c&255;png.data[o+3]=255;}});fs.writeFileSync(path.join(dir,'pixels.png'),PNG.sync.write(png));}
 // Cross-level color-key coverage is intentionally unsupported. A request
 // must report the named production error instead of silently sampling level0.
 const flags=m.getUint32(entry(tex)+28,true);m.setUint32(entry(tex)+28,flags|0x100,true);rs(41,1);stage();
 assert.throws(()=>draw(4),/unimplemented|unreachable|D3DIM|crash/i,'keyed mip filtering fails explicitly');
 assert.equal(pixel(),0xff111111,'unsupported keyed mip draw writes no color');
 e.d3d_render_reset_transients();assert.equal(e.mip_active(),0,'endpoint reset clears native mip state after an unsupported draw');
 console.log(`PASS full production native D3D mip sampling: ${evidence.length} pixel observations, perspective/vertical gradients, filters, chain bounds and native/GPU caps`);
})().catch(err=>{console.error(err);process.exitCode=1;});
