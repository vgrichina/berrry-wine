'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=process.argv[2];
assert(out,'explicit evidence directory');fs.mkdirSync(out,{recursive:true});
let browser;
(async()=>{try{
 browser=await require(root+'/node_modules/puppeteer').launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();
 for(const f of ['gpu-backend.js','gl-command-stream.js','gl-compat.js'])await page.addScriptTag({path:root+'/lib/'+f});
 const results=await page.evaluate(()=>{
  const results=[];
  for(const version of [1,2]){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=8;document.body.appendChild(canvas);
   const backend=new GpuBackend.WebGLBackend(canvas,{apiVersion:version,preserveDrawingBuffer:true,antialias:false,alpha:true});
   const f=new OpenGLCompat.FixedFunctionGL(backend),G=OpenGLCompat.constants,g=backend.gl;
   g.viewport(0,0,8,8);g.disable(g.DITHER);f.bindTexture(1,G.TEXTURE_1D);f.setEnabled(G.TEXTURE_1D,true);
   f.texParameter(G.TEXTURE_MIN_FILTER,G.NEAREST,G.TEXTURE_1D);f.texParameter(G.TEXTURE_MAG_FILTER,G.NEAREST,G.TEXTURE_1D);
   f.setTextureMode(G.REPLACE);
   const red=[255,0,0,255],green=[0,255,0,255],blue=[0,0,255,255],white=[255,255,255,255];
   function draw(label,want,s0=0,s1=1,t0=-9,t1=17,tolerance=1){
    const vertices=[];
    for(const[x,y,s,t]of[[-1,-1,s0,t0],[1,-1,s1,t0],[1,1,s1,t1],[-1,-1,s0,t0],[1,1,s1,t1],[-1,1,s0,t1]])vertices.push(x,y,0,1,1,1,1,s,t,0,0,1,s,t,1,0,1,0,1);
    f.enqueuePacked(G.TRIANGLES,new Float32Array(vertices));f.flushPendingDraw();
    const pixels=new Uint8Array(256);g.readPixels(0,0,8,8,g.RGBA,g.UNSIGNED_BYTE,pixels);
    const error=g.getError();if(error)throw Error(label+' GLerror '+error);
    for(let y=0;y<8;y++)for(let x=0;x<8;x++)for(let c=0;c<4;c++)if(Math.abs(pixels[(y*8+x)*4+c]-want[x][c])>tolerance)throw Error(label+' pixel'+x+','+y+' '+[...pixels.slice((y*8+x)*4,(y*8+x)*4+4)]+' expected'+want[x]);
    results.push({version,label,expected:want,pixels:[...pixels]});
   }
   f.texImage1D(0,G.RGBA,4,0,new Uint8Array([...red,...green,...blue,...white]));
   draw('width4 ignores T',[red,red,green,green,blue,blue,white,white]);
   f.texSubImage1D(0,1,1,new Uint8Array(blue));draw('subimage owned pixels',[red,red,blue,blue,blue,blue,white,white]);
   draw('negative repeat',[blue,blue,white,white,red,red,blue,blue],-.5,.5);
   f.texParameter(G.TEXTURE_WRAP_S,G.MIRRORED_REPEAT,G.TEXTURE_1D);draw('mirrored repeat',[white,blue,blue,red,red,blue,blue,white],-1,1);
   f.texParameter(G.TEXTURE_WRAP_S,G.REPEAT,G.TEXTURE_1D);
   f.bindTexture(2,G.TEXTURE_1D);draw('undefined1d disabled',Array(8).fill(white));f.bindTexture(1,G.TEXTURE_1D);draw('binding restored',[red,red,blue,blue,blue,blue,white,white]);
   f.bindTexture(3);f.texImage(0,G.RGB,1,1,0,G.RGBA,G.UNSIGNED_BYTE,new Uint8Array([31,63,95,255]));f.texParameter(G.TEXTURE_MIN_FILTER,G.NEAREST);f.setEnabled(G.TEXTURE_2D,true);draw('2d target precedence',Array(8).fill([31,63,95,255]));f.setEnabled(G.TEXTURE_2D,false);draw('1d target restored',[red,red,blue,blue,blue,blue,white,white]);
   f.bindTexture(4,G.TEXTURE_1D);f.texParameter(G.TEXTURE_MIN_FILTER,G.NEAREST,G.TEXTURE_1D);f.texImage1D(0,G.LUMINANCE,1,0,new Uint8Array([64,128,192,96]));draw('distinct1d base format',Array(8).fill([64,64,64,255]));f.bindTexture(1,G.TEXTURE_1D);draw('binding restores RGBA base',[red,red,blue,blue,blue,blue,white,white]);
   f.setActiveTexture(0x84c1);f.bindTexture(5,G.TEXTURE_1D);f.texImage1D(0,G.RGBA,1,0,new Uint8Array([17,34,51,255]));f.texParameter(G.TEXTURE_MIN_FILTER,G.NEAREST,G.TEXTURE_1D);f.texParameter(G.TEXTURE_MAG_FILTER,G.NEAREST,G.TEXTURE_1D);f.setTextureMode(G.REPLACE);f.setEnabled(G.TEXTURE_1D,true);draw('unit1 independent image and parameters',Array(8).fill([17,34,51,255]));f.setEnabled(G.TEXTURE_1D,false);f.setActiveTexture(0x84c0);draw('unit0 survives unit1',[red,red,blue,blue,blue,blue,white,white]);
   f.texImage1D(0,G.RGBA,1,0,new Uint8Array(red));f.texParameter(G.TEXTURE_WRAP_S,G.CLAMP,G.TEXTURE_1D);f.texParameter(G.TEXTURE_MAG_FILTER,G.LINEAR,G.TEXTURE_1D);f.texBorderColor([0,0,1,1],G.TEXTURE_1D);draw('object border width1',[[143,0,112,255],[175,0,80,255],[207,0,48,255],[239,0,16,255],[239,0,16,255],[207,0,48,255],[175,0,80,255],[143,0,112,255]]);f.texParameter(G.TEXTURE_WRAP_S,G.REPEAT,G.TEXTURE_1D);f.texParameter(G.TEXTURE_MAG_FILTER,G.NEAREST,G.TEXTURE_1D);
   for(const [l,n,color]of[[0,8,red],[1,4,green],[2,2,blue],[3,1,white]])f.texImage1D(l,G.RGBA,n,0,new Uint8Array(Array.from({length:n},()=>color).flat()));
   f.texParameter(G.TEXTURE_MIN_FILTER,0x2700,G.TEXTURE_1D);
   draw('mip level1',Array(8).fill(green),0,2);draw('mip level2',Array(8).fill(blue),0,4);draw('mip level3',Array(8).fill(white),0,8);
   f.texParameter(G.TEXTURE_MIN_FILTER,0x2702,G.TEXTURE_1D);draw('trilinear',Array(8).fill([128,128,0,255]),0,Math.SQRT2);
   f.texParameter(G.TEXTURE_MIN_FILTER,G.NEAREST,G.TEXTURE_1D);f.texParameter(G.TEXTURE_MAG_FILTER,G.LINEAR,G.TEXTURE_1D);f.texParameter(G.TEXTURE_WRAP_S,G.CLAMP,G.TEXTURE_1D);
   f.texImage1D(0,G.RGBA,4,1,new Uint8Array([...blue,...red,...red,...green]));
   draw('supplied end texels',[[159,0,96,255],[223,0,32,255],red,red,red,red,[223,32,0,255],[159,96,0,255]]);
   f.destroy();
  }
  return results;
 });
 fs.writeFileSync(path.join(out,'pixels.json'),JSON.stringify({passed:true,browser:await browser.version(),results},null,2));console.log('PASS one dimensional textures WebGL',results.length);
}finally{if(browser)await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
