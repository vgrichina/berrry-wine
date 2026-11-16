'use strict';
const path=require('path'),puppeteer=require('puppeteer');
(async()=>{const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-first-run','--no-default-browser-check']});
 try{const page=await browser.newPage();for(const file of['lib/gpu-backend.js','lib/d3d9-shader.js','lib/render-clear.js','lib/d3d9-backend.js','test/fixtures/d3d9-triangle-edge-cases.js'])await page.addScriptTag({path:path.join(__dirname,'..',file)});
  const result=await page.evaluate(()=>{const results=[];for(const version of[1,2])for(const clip of[false,true])for(const [name,points,width,height,viewport]of D3D9TriangleEdges.cases){
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const d=new D3D9Backend.Device(canvas,{webglVersion:version});
   try{d.clear([0,0,0,1],1,1,null,null);d.draw(D3D9TriangleEdges.draw(points,width,height,clip,viewport));const bytes=d.readColor(null).pixels,actual=Array.from({length:width*height},(_,i)=>bytes[i*4]>127),expected=D3D9TriangleEdges.mask(points,width,height);
    const different=actual.reduce((n,v,i)=>n+(v!==expected[i]),0);results.push({version,clip,name,different,actual:actual.map(v=>v?'#':'.').join(''),expected:expected.map(v=>v?'#':'.').join('')});
    if(d.gpu.getError())throw Error('GL error');
   }finally{d.destroy();}
  }
  for(const version of[1,2])for(const clip of[false,true]){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=8;const d=new D3D9Backend.Device(canvas,{webglVersion:version});
   try{let index=0;for(const {viewport,points}of D3D9TriangleEdges.viewportSequence()){
    d.clear([0,0,0,1],1,1,null,null);d.draw(D3D9TriangleEdges.draw(points,8,8,clip,viewport));
    const bytes=d.readColor(null).pixels,actual=Array.from({length:64},(_,i)=>bytes[i*4]>127),expected=D3D9TriangleEdges.mask(points,8,8);
    const different=actual.reduce((n,v,i)=>n+(v!==expected[i]),0);
    if(different)throw Error('same-device viewport refresh '+version+'/'+clip+'/'+index);
    if(d.programs.size!==1)throw Error('viewport constants caused shader recompilation');
    results.push({version,clip,name:'cached-viewport-'+index++,different,actual:actual.map(v=>v?'#':'.').join(''),expected:expected.map(v=>v?'#':'.').join('')});
   }}finally{d.destroy();}
  }return results;});
  for(const r of result)console.log(JSON.stringify(r));
  for(const r of result.filter(r=>r.clip)){
   const fixed=result.find(f=>f.version===r.version&&!f.clip&&f.name===r.name);
   if(r.actual!==fixed.actual)throw Error('programmed/fixed pixel-center mismatch '+r.name+'/'+r.version);
  }
  for(const version of[1,2])for(const clip of[false,true]){
   const a=result.find(r=>r.version===version&&r.clip===clip&&r.name==='shared-diagonal-first');
   const b=result.find(r=>r.version===version&&r.clip===clip&&r.name==='shared-diagonal-second');
   for(let i=0;i<a.actual.length;i++){
    const owners=Number(a.actual[i]==='#')+Number(b.actual[i]==='#');
    if(owners>1)throw Error('shared diagonal double coverage');
    if(i%8<5&&Math.floor(i/8)>0&&Math.floor(i/8)<5&&owners!==1)throw Error('shared diagonal hole');
   }
  }
  console.log('Programmed/fixed viewport pixel-center equivalence PASS '+result.length/2);
  if(process.argv.includes('--require-parity')&&result.some(r=>r.different))throw Error('hardware triangle edge parity not implemented');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
