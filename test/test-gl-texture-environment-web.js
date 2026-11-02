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
   g.viewport(0,0,8,8);g.disable(g.DITHER);f.bindTexture(1);f.setEnabled(G.TEXTURE_2D,true);
   f.texParameter(G.TEXTURE_MIN_FILTER,G.NEAREST);f.texParameter(G.TEXTURE_MAG_FILTER,G.NEAREST);
   const upload=(internal,texel)=>f.texImage(0,internal,1,1,0,G.RGBA,G.UNSIGNED_BYTE,new Uint8Array(texel));
   upload(G.RGBA,[64,128,192,128]);
   const vertices=[];
   for(const[x,y]of[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]])vertices.push(x,y,0,128/255,64/255,32/255,192/255,.5,.5,0,0,1,.5,.5,1,0,1,0,1);
   function draw(label,want){
    f.enqueuePacked(G.TRIANGLES,new Float32Array(vertices));f.flushPendingDraw();
    const pixels=new Uint8Array(256);g.readPixels(0,0,8,8,g.RGBA,g.UNSIGNED_BYTE,pixels);
    const error=g.getError();if(error)throw Error(label+' GLerror '+error);
    for(let i=0;i<64;i++)for(let c=0;c<4;c++)if(Math.abs(pixels[4*i+c]-want[c])>1)throw Error(label+' pixel'+i+' '+[...pixels.slice(4*i,4*i+4)]+' expected'+want);
    results.push({version,label,expected:want,pixels:[...pixels]});
   }
   for(const [mode,want]of[[G.REPLACE,[64,128,192,128]],[G.MODULATE,[32,32,24,96]],[G.DECAL,[96,96,112,192]],[G.BLEND,[160,32,200,96]]]){
    f.setTextureEnv(G.TEXTURE_ENV,G.TEXTURE_ENV_COLOR,[1,0,1,1]);f.setTextureMode(mode);draw('RGBA mode'+mode,want);
   }
   upload(G.RGB,[64,128,192,255]);f.setTextureMode(G.REPLACE);draw('RGB preserves primary alpha',[64,128,192,192]);
   upload(G.RGBA,[255,255,255,255]);f.setTextureMode(G.BLEND);f.setTextureEnv(G.TEXTURE_ENV,G.TEXTURE_ENV_COLOR,[1,0,0,1]);
   f.enqueuePacked(G.TRIANGLES,new Float32Array(vertices));f.setTextureEnv(G.TEXTURE_ENV,G.TEXTURE_ENV_COLOR,[0,1,0,1]);
   const captured=new Uint8Array(4);g.readPixels(4,4,1,1,g.RGBA,g.UNSIGNED_BYTE,captured);if(captured[0]!==255||captured[1]!==0)throw Error('pending draw env snapshot');
   f.pushAttrib(0x40000);f.setTextureMode(G.REPLACE);f.setTextureEnv(G.TEXTURE_ENV,G.TEXTURE_ENV_COLOR,[0,0,1,1]);f.popAttrib();draw('attribute environment restore',[0,255,0,192]);
   f.setActiveTexture(0x84c1);f.bindTexture(2);f.setEnabled(G.TEXTURE_2D,true);f.texParameter(G.TEXTURE_MIN_FILTER,G.NEAREST);f.texParameter(G.TEXTURE_MAG_FILTER,G.NEAREST);upload(G.RGBA,[255,255,255,255]);f.setTextureMode(G.BLEND);f.setTextureEnv(G.TEXTURE_ENV,G.TEXTURE_ENV_COLOR,[0,0,1,1]);draw('unit1 environment',[0,0,255,192]);
   f.destroy();
  }
  return results;
 });
 fs.writeFileSync(path.join(out,'pixels.json'),JSON.stringify({passed:true,browser:await browser.version(),results},null,2));console.log('PASS texture environment WebGL',results.length);
}finally{if(browser)await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
