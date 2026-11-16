'use strict';
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();
  for(const file of['lib/gpu-backend.js','lib/d3d9-shader.js','lib/render-clear.js','lib/d3d9-backend.js','test/fixtures/d3d9-lighting-cases.js'])await page.addScriptTag({path:path.join(__dirname,'..',file)});
  const results=await page.evaluate(()=>{
   const out=[];for(const version of[1,2]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
    const d=new D3D9Backend.Device(canvas,{webglVersion:version});
    try{const cases=D3D9LightingCases.cases();
    const mixed=D3D9LightingCases.draw();mixed.pixelShader=new Uint32Array([0xffff0101,1,0x800f0000,0x90e40000,0xffff]);
    mixed.fixedFunction.material.diffuse=new Float32Array([.25,.5,.75,.5]);
    cases.push({name:'mixed programmed PS v0 reads lit material, not vertex COLOR1',draw:mixed,expected:[64,128,191,128]});
    for(const type of[1,2]){
      const local=D3D9LightingCases.draw(),f=a=>new Float32Array(a);
      local.fixedFunction.lights=[{type,diffuse:f([1,1,1,0]),ambient:f([0,0,0,0]),
        position:f([0,0,2]),direction:f([0,0,-1]),range:100,falloff:1,
        attenuation0:1,attenuation1:0,attenuation2:0,theta:Math.PI,phi:Math.PI}];
      cases.push({name:type===1?'point light':'spot light',draw:local,expected:null});
    }
     for(const c of cases){
     d.clear([0,0,0,1],1);d.draw(c.draw);const g=d.gpu,gl=g.gl;
     out.push({version,name:c.name,expected:c.expected,pixel:Array.from(g.readPixels(1,2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4))),error:g.getError()});
    }
     mixed.pixelShader=new Uint32Array([0xffff0101,1,0x800f0000,0x90e40001,0xffff]);
     let rejected=false;try{d.draw(mixed);}catch(e){rejected=/secondary-color linkage/.test(e.message);}
     if(!rejected)throw new Error('lit v1 must reject pending secondary-color conformance');
    }finally{d.destroy();}
   }return out;
  });
  for(const r of results){assert.strictEqual(r.error,0,JSON.stringify(r));
    if(r.expected)r.pixel.forEach((v,i)=>assert(Math.abs(v-r.expected[i])<=1,JSON.stringify(r)));
    else assert(r.pixel.slice(0,3).some(v=>v>0),JSON.stringify(r));}
  console.log('WebGL directional/point/spot lighting PASS '+results.length+' pixel cases');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
