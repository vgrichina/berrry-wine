#!/usr/bin/env node
'use strict';
const assert=require('assert');
const path=require('path');
const puppeteer=require('puppeteer');
(async()=>{
  const browser=await puppeteer.launch({headless:true,
    executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args:['--no-first-run','--no-default-browser-check']});
  try{
    const page=await browser.newPage();
    for(const name of ['gpu-backend','d3d9-shader','d3d9-fixed','render-clear','d3d9-backend','d3dim-gpu'])
      await page.addScriptTag({path:path.join(__dirname,'../lib',name+'.js')});
    const results=await page.evaluate(()=>{
      function run(batchDraws){
        const memory=new ArrayBuffer(65536),dv=new DataView(memory),u8=new Uint8Array(memory);
        const desc=4096,vertices=8192,call=12288,rt=16384,dib=32768,clear=20480,tex=24576,texels=28672;
        const set=(i,v)=>dv.setUint32(desc+i*4,v,true);
        [rt,8,8,32,32,dib,1].forEach((v,i)=>set(i,v));
        set(17,8);set(19,1);set(20,5);set(21,6);set(27,1);set(28,2);
        [8,8,32,32].forEach((v,i)=>dv.setUint16(rt+12+i*2,v,true));
        dv.setUint32(rt+20,dib,true);
        [1,4,3,vertices,3].forEach((v,i)=>dv.setUint32(call+i*4,v,true));
        const errors=[];
        const gpu=new D3DIMGpu.D3DIMGpu({batchDraws,getMemory:()=>memory,
          getExports:()=>({d3dim_gpu_describe:()=>desc,guest_to_wasm:a=>a,
            d3dim_gpu_surface_fmt:()=>1,d3dim_gpu_decode_texture:()=>texels}),
          createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},
          onError:e=>errors.push(e)});
        const check=value=>{if(value!==1)throw new Error('GPU command rejected: '+errors.join(';'));};
        const draw=(color,points=[[-1,-1],[20,-1],[-1,20]])=>{
          points.forEach(([x,y],i)=>{
            const p=vertices+i*32;
            [x,y,.5,1].forEach((v,j)=>dv.setFloat32(p+j*4,v,true));
            dv.setUint32(p+16,color,true);
            dv.setFloat32(p+24,.5,true);dv.setFloat32(p+28,.5,true);
          });
          check(gpu.call(D3DIMGpu.OPCODES.DRAW,call));
        };
        const snapshots=[];
        const snapshot=()=>{check(gpu.fence());snapshots.push(Array.from(u8.slice(dib,dib+256)));};
        const clearBlack=()=>{
          [rt,3,0xff000000].forEach((v,i)=>dv.setUint32(clear+i*4,v,true));
          dv.setFloat32(clear+12,1,true);
          [0,0,8,8].forEach((v,i)=>dv.setInt32(clear+16+i*4,v,true));
          check(gpu.call(D3DIMGpu.OPCODES.CLEAR,clear));
        };
        // Alpha compositing is order-dependent: blue over green over red.
        draw(0x80ff0000);draw(0x8000ff00);draw(0x800000ff);snapshot();
        // A state transition must flush pending transparent work first.
        draw(0x80ff0000);draw(0x8000ff00);
        set(19,0);draw(0xffffff00);set(19,1);draw(0x800000ff);snapshot();
        // Clear cannot overtake deferred geometry.
        draw(0x80ff0000);draw(0x8000ff00);clearBlack();snapshot();
        // Reusing the same texture address with new bytes must preserve old
        // queued triangles. Two halves make both generations observable.
        set(19,0);set(7,tex);set(8,1);set(9,1);set(10,32);set(11,4);set(12,texels);
        set(22,2);set(23,2);set(24,3);set(25,3);
        set(41,2);set(43,2); // SELECTARG1 reads TEXTURE, not default DIFFUSE.
        const half=(left,right)=>{
          draw(0xffffffff,[[left,-.5],[right,-.5],[left,7.5]]);
          draw(0xffffffff,[[right,-.5],[right,7.5],[left,7.5]]);
        };
        u8.set([255,0,0,255],texels);half(-.5,3.5);half(-.5,3.5);
        u8.set([0,255,0,255],texels);half(3.5,7.5);snapshot();
        const stats=gpu.snapshot();gpu.stop();return {snapshots,stats,errors};
      }
      return [run(false),run(true)];
    });
    const [off,on]=results;
    assert.deepStrictEqual(on.errors,[]);assert.deepStrictEqual(off.errors,[]);
    assert.deepStrictEqual(on.snapshots,off.snapshots,'batching preserves every framebuffer byte at each fence');
    const pixel=(frame,x=2,y=2)=>{const p=(y*8+x)*4,b=on.snapshots[frame];return [b[p+2],b[p+1],b[p]];};
    const near=(actual,expected)=>assert(actual.every((v,i)=>Math.abs(v-expected[i])<=2),`${actual} != ${expected}`);
    near(pixel(0),[32,64,128]);near(pixel(1),[127,127,128]);
    assert.deepStrictEqual(pixel(2),[0,0,0],'clear follows queued geometry');
    assert.deepStrictEqual(pixel(3,1,3),[255,0,0],'old texture generation retained on left');
    assert.deepStrictEqual(pixel(3,6,3),[0,255,0],'replacement texture visible on right');
    assert(on.stats.mergedDraws>0,'fixture exercises actual merging');
    assert(on.stats.draws<off.stats.draws,'batching reduces real backend submissions');
    console.log('PASS D3DIM WebGL batching: exact A/B pixels, expected alpha order, state/clear/fence and texture replacement');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
