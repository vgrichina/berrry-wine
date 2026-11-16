'use strict';
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();
  for(const file of['lib/gpu-backend.js','lib/d3d9-shader.js','lib/render-clear.js','lib/d3d9-backend.js','test/fixtures/d3d9-scissor-cases.js'])await page.addScriptTag({path:path.join(__dirname,'..',file)});
  const result=await page.evaluate(()=>{
   let checked=0;for(const version of[1,2]){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=8;const d=new D3D9Backend.Device(canvas,{webglVersion:version}),g=d.gpu,gl=g.gl;
    const read=()=>g.readPixels(0,0,8,8,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(256));
    try{for(const mode of version===1?[3]:[1,2,3]){
     const draw=D3D9ScissorCases.draw(mode);d.clear([0,0,0,1],1);d.draw(draw);const baseline=read();
     if(!baseline.some((v,i)=>i%4===0&&v))throw Error('empty baseline');
     for(const scissor of D3D9ScissorCases.cases()){
      draw.scissor=scissor;d.clear([0,0,0,1],1);d.draw(draw);const actual=read();
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){
       const inside=!scissor.enabled||(x>=scissor.left&&x<scissor.right&&y>=scissor.top&&y<scissor.bottom),p=((7-y)*8+x)*4;
       if(actual[p]!== (inside?baseline[p]:0))throw Error(`GL${version} mode${mode} at${x},${y}`);
      }if(g.getError())throw Error('GL error');checked++;
     }
    }}finally{d.destroy();}
   }return checked;
  });assert.strictEqual(result,20);console.log('PASS WebGL scissor '+result+' cases across GL1/2 solid and GL2 point/wire');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
