#!/usr/bin/env node
'use strict';
// Full production D3D7 resource/state/draw closure, through D3DIMGpu and its
// owning WebGL renderer. Imports are inert platform services except gpu_gl_call;
// no sampler replacement, fixed LOD, or software rasterizer supplies pixels.
const assert=require('assert'),fs=require('fs'),path=require('path');
const puppeteer=require('puppeteer');
const {compileSrcWasm}=require('./compile-src');
const {startStaticServer,closeServer}=require('./static-server');
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
(func (export "mip_flags") (param $s i32) (param $caps i32)
 (i32.store (call $dx_surf_meta_ptr (call $dx_from_this (local.get $s))) (local.get $caps)))
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
 const evidenceDir=process.env.WINE_MIP_EVIDENCE;
 const wasm=compileSrcWasm((name,source)=>name==='13-exports.wat'?source+'\n'+extraWat:source);
 if(evidenceDir){fs.mkdirSync(evidenceDir,{recursive:true});fs.writeFileSync(path.join(evidenceDir,'fixture.wasm'),wasm);}
 const server=await startStaticServer({root:path.join(__dirname,'..'),crossOriginIsolated:true,
  handleRequest(req,res){if(req.url==='/mip-fixture.wasm'){res.writeHead(200,{'Content-Type':'application/wasm'});res.end(wasm);return true;}return false;}});
 let browser;
 const evidence={moduleSha256:require('crypto').createHash('sha256').update(wasm).digest('hex'),versions:[]};
 try{
  browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',
   args:['--no-sandbox','--no-first-run','--no-default-browser-check','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const version of [1,2]){
   const page=await browser.newPage();
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   for(const name of ['gpu-backend','d3d9-shader','d3d9-fixed','render-clear','d3d9-backend','d3dim-gpu'])
    await page.addScriptTag({path:name==='d3dim-gpu'&&process.env.WINE_MIP_ADAPTER||path.join(__dirname,'../lib',name+'.js')});
   const result=await page.evaluate(async version=>{
    const module=await WebAssembly.compile(await (await fetch('/mip-fixture.wasm')).arrayBuffer());
    const memory=new WebAssembly.Memory({initial:8192,maximum:32768,shared:true});
    let gpu,e;
    const host={memory};
    for(const imp of WebAssembly.Module.imports(module))if(imp.kind==='function')host[imp.name]=()=>0;
    host.gpu_gl_call=(op,wa,length)=>gpu.call(op,wa,length);
    e=(await WebAssembly.instantiate(module,{host})).exports;
    const errors=[];
    gpu=new D3DIMGpu.D3DIMGpu({getMemory:()=>memory.buffer,getExports:()=>e,
     createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;
      const get=c.getContext.bind(c);c.getContext=(type,...args)=>version===1&&type==='webgl2'?null:get(type,...args);return c;},
     onError:error=>errors.push(error)});
    e.mip_seed();e.mip_gpu(1);
    const m=new DataView(memory.buffer),desc=0x410000,out=0x410100,vertices=0x420000;
    const w32=(a,v)=>e.guest_write32(a,v),f32=(a,v)=>{const b=new DataView(new ArrayBuffer(4));b.setFloat32(0,v,true);w32(a,b.getUint32(0,true));};
    const check=(condition,message)=>{if(!condition)throw new Error(message+'; '+errors.join('; '));};
    function surface(w,h,mip=true,count=0){
     for(let i=0;i<128;i+=4)w32(desc+i,0);
     for(const [off,v] of [[0,108],[4,0x1007|(count?0x20000:0)],[8,h],[12,w],[24,count],[72,32],[76,0x40],[84,32],[88,0xff0000],[92,0xff00],[96,0xff],[104,mip?0x401008:0x40]])w32(desc+off,v);
     check((e.mip_surface(desc,out)>>>0)===0,'surface creation');return e.guest_read32(out)>>>0;
    }
    const rt=surface(32,32,false);check((e.mip_device(rt,out)>>>0)===0,'device creation');let dev=e.guest_read32(out)>>>0;
    const tex=surface(16,16),levels=[];for(let s=tex;s;s=e.mip_next(s)>>>0){levels.push(s);check(levels.length<=5,'bounded creation');}
    check(levels.length===5,'five levels');
    const entry=s=>e.mip_entry(s)>>>0,dib=s=>m.getUint32(entry(s)+20,true),pitch=s=>m.getUint16(entry(s)+18,true);
    const colors=[0xffff0000,0xff00ff00,0xff0000ff,0xffffffff,0xffffff00];
    function fill(s,c){const a=entry(s),w=m.getUint16(a+12,true),hh=m.getUint16(a+14,true);for(let y=0;y<hh;y++)for(let x=0;x<w;x++)m.setUint32(dib(s)+y*pitch(s)+4*x,c,true);e.page_watch_write(dib(s),pitch(s)*hh);}
    levels.forEach((s,i)=>fill(s,colors[i]));
    const tss=(t,v)=>e.mip_tss(dev,0,t,v),rs=(r,v)=>e.mip_rs(dev,r,v);
    const bind=()=>{e.mip_bind(dev,0,tex);rs(22,1);rs(7,0);rs(27,0);tss(1,2);tss(2,2);tss(4,2);tss(5,2);tss(13,1);tss(14,1);};bind();
    const observations=[],frames=[];
    const MIP_NONE=1,MIP_POINT=2,MIP_LINEAR=3; // DirectX 7 d3dtypes.h, not D3DTEXF.
    function stage(min=1,mag=1,mip=MIP_POINT){tss(17,min);tss(16,mag);tss(18,mip);}
    function draw(n,{q=[1,1,1],uv=null}={}){
     gpu.fence();fill(rt,0xff111111);
     [[0,0],[32,0],[0,32]].forEach(([x,y],i)=>{const a=vertices+i*32;f32(a,x);f32(a+4,y);f32(a+8,.5);f32(a+12,q[i]);w32(a+16,0xffffffff);w32(a+20,0);f32(a+24,uv?uv[i][0]:i===1?n:0);f32(a+28,uv?uv[i][1]:i===2?n:0);});
     const accepted=gpu.snapshot().drawCalls;e.mip_draw(dev,vertices);gpu.fence();
     check(gpu.snapshot().drawCalls>accepted,'draw reached owning WebGL executor');check(errors.length===0,'no executor errors');
    }
    const pixel=(x=4,y=4)=>m.getUint32(dib(rt)+y*pitch(rt)+x*4,true)>>>0;
    function expect(label,c,x=4,y=4,tol=2){const got=pixel(x,y);for(let b=0;b<3;b++)check(Math.abs((got>>>(8*b)&255)-(c>>>(8*b)&255))<=tol,`${label} pixel ${got.toString(16)} expected ${c.toString(16)}`);observations.push({label,x,y,got,expected:c,tolerance:tol});frames.push(Array.from({length:1024},(_,i)=>pixel(i%32,Math.floor(i/32))));}
    stage();for(const [n,l] of [[.5,0],[2,0],[4,1],[8,2],[16,3],[32,4],[65536,4]]){draw(n);expect('nearest footprint '+n/2,colors[l]);}
    stage(1,1,MIP_NONE);draw(32);expect('MIP NONE stays level zero',colors[0]);
    stage(1,1,MIP_LINEAR);draw(2*Math.sqrt(8));expect('linear mip green/blue blend',0xff008080);
    stage(2,2,MIP_LINEAR);draw(2*Math.sqrt(8));expect('trilinear green/blue blend',0xff008080);
    stage();draw(16,{q:[1,.25,.25]});
    // Independent quotient-rule footprint at D3D integer pixel centres. GPU
    // derivatives differ over 2x2 quads: compare points away from LOD borders.
    for(const [x,y] of [[1,1],[8,1],[14,1],[20,1],[27,1]]){
     const Q=1-3*(x+y)/128,U=x/8,V=y/8,dux=(.125*Q+U*3/128)/Q**2,duy=U*3/128/Q**2,dvx=V*3/128/Q**2,dvy=(.125*Q+V*3/128)/Q**2;
     const rho=16*Math.sqrt(Math.max(dux**2+dvx**2,duy**2+dvy**2)),l=Math.min(4,Math.max(0,Math.floor(Math.log2(rho)+.5)));
     expect('perspective rho '+rho,colors[l],x,y);
    }
    stage();draw(0,{uv:[[.25,0],[.25,0],[.25,16]]});expect('vertical minification',colors[3]);
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)m.setUint32(dib(tex)+y*pitch(tex)+4*x,x%2?0xffffffff:0xff000000,true);
    // POSITIONT uses the owning renderer's 1/16 coverage offset: at (4,4)
    // the bilinear weights here are .515625 (MAG) and .375 (MIN).
    e.page_watch_write(dib(tex),pitch(tex)*16);
    stage(1,2,MIP_NONE);draw(.5,{uv:[[.25,.25],[.75,.25],[.25,.75]]});expect('MAG linear',0xff838383);draw(4);expect('MIN point',0xff000000);
    stage(2,1,MIP_NONE);draw(.5,{uv:[[.25,.25],[.75,.25],[.25,.75]]});expect('MAG point',0xffffffff);draw(4);expect('MIN linear',0xff606060);
    levels.forEach((s,i)=>fill(s,colors[i]));
    const a=entry(levels[1]),link=m.getUint32(a+8,true),size=m.getUint32(a+12,true),b=entry(levels[2]),savedDib=m.getUint32(b+20,true);
    stage();m.setUint32(a+8,0,true);draw(32);expect('partial chain clamps',colors[1]);m.setUint32(a+8,link,true);
    m.setUint32(b+20,0,true);draw(32);expect('missing DIB clamps',colors[1]);m.setUint32(b+20,savedDib,true);
    m.setUint32(a+8,tex,true);draw(32);expect('cycle bounded',colors[1]);m.setUint32(a+8,link,true);
    m.setUint32(a+8,0xfffffff8,true);draw(32);expect('invalid wrapper bounded',colors[1]);m.setUint32(a+8,link,true);
    m.setUint32(a+12,0x00070007,true);draw(32);expect('malformed dimensions bounded',colors[0]);m.setUint32(a+12,size,true);
    e.mip_flags(levels[2],0x20000);draw(32);expect('depth attachment is not a mip',colors[1]);e.mip_flags(levels[2],0x401008);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)m.setUint32(dib(levels[1])+y*pitch(levels[1])+4*x,x%2?0xffffffff:0xff000000,true);
    e.page_watch_write(dib(levels[1]),pitch(levels[1])*8);
    stage(1,2,MIP_POINT);draw(4);expect('mip1 uses MIN point',0xff000000);
    stage(2,1,MIP_POINT);draw(4);expect('mip1 uses MIN linear',0xff707070);fill(levels[1],colors[1]);stage();
    const packed=m.getUint32(a+16,true);e.mip_format(levels[1],1);m.setUint32(a+16,(20<<16)|16,true);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)m.setUint16(dib(levels[1])+y*20+x*2,0xf81f,true);
    e.page_watch_write(dib(levels[1]),20*8);
    draw(4);expect('per-level RGB565 padded pitch',0xffff00ff);m.setUint32(a+16,packed,true);e.mip_format(levels[1],0);fill(levels[1],colors[1]);
    const short=surface(16,16,true,2);fill(short,colors[0]);fill(e.mip_next(short),colors[1]);e.mip_bind(dev,0,short);draw(65536);expect('declared two levels clamp',colors[1]);e.mip_bind(dev,0,tex);
    // A lower-level byte change must invalidate its upload independently.
    fill(levels[2],0xffff00ff);draw(8);expect('changed mip2 uploaded',0xffff00ff);fill(levels[2],colors[2]);draw(8);expect('restored mip2 uploaded',colors[2]);
    // Legacy combined filters, plus an explicit stage NONE override.
    for(const [f,c] of [[3,colors[2]],[4,0xff006699],[5,colors[2]],[6,0xff006699]]){
     check((e.mip_device(rt,out)>>>0)===0,'legacy device');dev=e.guest_read32(out)>>>0;bind();rs(17,1);rs(18,f);draw(2*2**1.6);expect('legacy filter '+f,c);
    }
    tss(18,MIP_NONE);draw(32);expect('explicit NONE overrides legacy',colors[0]);
    const target=gpu.targets.get(entry(rt)),gl=target.device.gpu.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
    const identity={version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
    check(identity.version.includes('WebGL '+version+'.0'),'actual requested WebGL version');check(gl.getError()===0,'no GL error');
    e.mip_caps(0x430000);check((e.guest_read32(0x430000+96)>>>0)===0x030303ff,'implemented triangle mip caps');
    check((e.guest_read32(0x430000+40)>>>0)===0x030003c3,'line caps unchanged');
    const stats=gpu.snapshot();gpu.stop();return {version,identity,observations,frames,stats,errors};
   },version);
   assert.deepStrictEqual(result.errors,[]);assert(result.stats.draws>0);assert.equal(result.stats.fallbacks,0);
   if(evidenceDir){
    const {PNG}=require('pngjs'),png=new PNG({width:256,height:32*Math.ceil(result.frames.length/8)});
    result.frames.forEach((frame,k)=>frame.forEach((c,i)=>{const x=i%32,y=Math.floor(i/32),o=((Math.floor(k/8)*32+y)*256+(k%8)*32+x)*4;png.data[o]=c>>>16&255;png.data[o+1]=c>>>8&255;png.data[o+2]=c&255;png.data[o+3]=255;}));
    fs.writeFileSync(path.join(evidenceDir,`webgl${version}.png`),PNG.sync.write(png));
   }
   delete result.frames;evidence.versions.push(result);await page.close();
   if(evidenceDir)fs.writeFileSync(path.join(evidenceDir,'pixels.json'),JSON.stringify(evidence,null,2)+'\n');
   console.log(`PASS owning WebGL${version} D3D7 mip-chain sampling: ${result.observations.length} pixel checks; ${result.identity.renderer}`);
  }
 }finally{if(browser)await browser.close();await closeServer(server);}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
