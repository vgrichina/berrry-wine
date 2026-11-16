'use strict';
const path=require('path'),puppeteer=require('puppeteer');
(async()=>{const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-first-run','--no-default-browser-check']});
 try{const page=await browser.newPage();for(const file of['lib/gpu-backend.js','lib/d3d9-shader.js','lib/render-clear.js','lib/d3d9-backend.js','test/fixtures/d3d9-color-alias-cases.js'])await page.addScriptTag({path:path.join(__dirname,'..',file)});
  console.log(await page.evaluate(async()=>{const results=[];for(const version of[1,2]){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=8;const d=new D3D9Backend.Device(canvas,{webglVersion:version});
   let copies=0;const copy=d.gpu.copyColorToTexture.bind(d.gpu);d.gpu.copyColorToTexture=(...args)=>{copies++;return copy(...args);};
   try{results.push(await D3D9ColorAliasCases.run({copies:()=>copies,create:r=>d.createColor(r),update:(...a)=>d.updateColor(...a),clear:(...a)=>d.clear(...a),read:r=>d.readColor(r),release:id=>d.releaseColor(id),
    draw:r=>{const gl=d.gpu.gl,read=gl.readPixels;gl.readPixels=()=>{throw Error('alias draw attempted CPU readback');};try{return d.draw(r);}finally{gl.readPixels=read;}}}));
    if(d.resourceSamples.size)throw Error('released resources retained sampling cache');
    const r={id:901,width:1,height:1,format:21};d.createColor(r);d.draw(D3D9ColorAliasCases.draw({...D3D9ColorAliasCases.level(r),sampler:{addressU:3,addressV:3,min:1,mag:1}}));
    if(!d.resourceSamples.size)throw Error('missing sampling cache');d.reset({width:8,height:8,depthAttachment:null});
    if(d.resourceSamples.size||d.colorTargets.size)throw Error('Reset retained alias storage/cache');if(d.gpu.getError())throw Error('GL error');
   }finally{d.destroy();}
  }return 'WebGL aliases PASS '+results.join('/');}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
