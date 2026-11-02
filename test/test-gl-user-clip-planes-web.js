'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=process.argv[2];assert(out,'evidence directory');fs.mkdirSync(out,{recursive:true});let browser;
(async()=>{try{
 browser=await require(root+'/node_modules/puppeteer').launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();for(const f of ['gpu-backend.js','gl-command-stream.js','gl-compat.js'])await page.addScriptTag({path:root+'/lib/'+f});
 const results=await page.evaluate(()=>{
  const results=[];
  for(const version of [1,2]){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=8;document.body.appendChild(canvas);
   const backend=new GpuBackend.WebGLBackend(canvas,{apiVersion:version,preserveDrawingBuffer:true,antialias:false,alpha:true});
   const f=new OpenGLCompat.FixedFunctionGL(backend),G=OpenGLCompat.constants,g=backend.gl;g.viewport(0,0,8,8);g.disable(g.DITHER);
   const packed=points=>new Float32Array(points.flatMap(([x,y,z=0,w=1])=>[x,y,z,1,1,1,1,0,0,0,0,1,0,0,w,0,1,0,1]));
   const quad=[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]];
   const clear=()=>{g.clearColor(0,0,0,1);g.clear(g.COLOR_BUFFER_BIT);};
   const pixel=(x,y,want,label)=>{const p=new Uint8Array(4);g.readPixels(x,y,1,1,g.RGBA,g.UNSIGNED_BYTE,p);if([...p].some((v,i)=>v!==want[i]))throw Error(version+' '+label+' '+[...p]+' expected '+want);results.push({version,label,pixel:[...p]});};
   const white=[255,255,255,255],black=[0,0,0,255];
   function draw(mode,points){f.enqueuePacked(mode,packed(points));f.flushPendingDraw();if(g.getError())throw Error('GLerror');}
   f.setClipPlane(0x3000,[1,0,0,0]);f.setEnabled(0x3000,true);
   for(const [mode,points]of[[G.TRIANGLES,quad],[G.LINES,[[-1,.125],[1,.125]]],[G.POINTS,[[-.625,.125],[.625,.125]]]]){
    clear();draw(mode,points);pixel(6,4,white,'crossing '+mode);pixel(2,4,black,'rejected '+mode);
   }
   f.setPointSize(3);clear();draw(G.POINTS,[[-.125,.125]]);pixel(4,4,black,'wide point center rejected');clear();draw(G.POINTS,[[.125,.125]]);pixel(3,4,white,'accepted point footprint');f.setPointSize(1);
   f.setClipPlane(0x3005,[0,1,0,0]);f.setEnabled(0x3005,true);clear();draw(G.TRIANGLES,quad);pixel(6,6,white,'intersection');pixel(6,1,black,'last legal plane');pixel(1,6,black,'first plane');f.setEnabled(0x3005,false);
   f.matrixMode=G.MODELVIEW;f._replaceMatrix(new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,.5,0,0,1]));f.matrixMode=G.PROJECTION;
   f.setClipPlane(0x3000,[1,0,0,0]);if(f.clipPlanes[0][3]!==-.5)throw Error('setter-time transform');f.matrixMode=G.MODELVIEW;f._replaceMatrix(new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));
   clear();draw(G.TRIANGLES,quad);pixel(7,4,white,'translated accepted');pixel(5,4,black,'retained eye equation');
   f.pushAttrib(0x1000);f.setClipPlane(0x3000,[-1,0,0,0]);f.setEnabled(0x3000,false);f.popAttrib();clear();draw(G.TRIANGLES,quad);pixel(7,4,white,'attribute accepted');pixel(5,4,black,'attribute restored');
   f.setClipPlane(0x3000,[1,0,0,0]);clear();f.enqueuePacked(G.TRIANGLES,packed(quad));f.setClipPlane(0x3000,[-1,0,0,0]);pixel(6,4,white,'setter flushes pending');pixel(1,4,black,'pending earlier plane');
   clear();draw(G.TRIANGLES,[[.1,-.9],[.9,-.9],[.9,.9]]);pixel(6,4,black,'fully rejected triangle');
   // Lighting belongs to the original vertices, before clipping. Re-lighting
   // a cut vertex with an interpolated, normalized normal gives white here.
   f.setClipPlane(0x3000,[1,0,0,0]);f.setLightModel(G.LIGHT_MODEL_AMBIENT,[0,0,0,1]);
   f.setMaterial(G.AMBIENT,[0,0,0,1]);f.setMaterial(G.DIFFUSE,[1,1,1,1]);
   f.setEnabled(G.LIGHTING,true);f.setEnabled(G.LIGHT0,true);f.setEnabled(G.NORMALIZE,true);
   for(const [mode,points,x,y,value]of[[G.TRIANGLES,[[-1,-1],[1,-1],[0,1]],4,3,199],[G.LINES,[[-1,.125],[1,.125]],4,4,143]]){
    const vertices=packed(points);vertices[11]=-1;clear();f.enqueuePacked(mode,vertices);f.flushPendingDraw();
    pixel(x,y,[value,value,value,255],'clip interpolates original lit colors '+mode);
   }
   f.destroy();
  }return results;
 });fs.writeFileSync(path.join(out,'pixels.json'),JSON.stringify({passed:true,browser:await browser.version(),results},null,2));console.log('PASS user clipping WebGL1/2',results.length);
}finally{if(browser)await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
