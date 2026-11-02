'use strict';
// Actual WebGL1/2 texture storage, framebuffer copies, packing and rendering.
function runTextureCopyTests() {
  const results=[];
  for(const apiVersion of [1,2]) {
    const memory=new ArrayBuffer(65536),dv=new DataView(memory);
    const windows={42:{hwnd:42,w:8,h:8,clientRect:{w:8,h:8}}};
    const bridge=new OpenGLCompat.OpenGLHostBridge({apiVersion,getMemory:()=>memory,
      exports:{guest_to_wasm:p=>p},renderer:{windows,repaint(){},mergeGpuLayerIntoBackCanvas(){}},
      createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;}});
    let checks=0;
    const check=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(`v${apiVersion} ${label}: ${JSON.stringify(a)} expected ${JSON.stringify(b)}`);checks++;};
    const f=x=>{dv.setFloat32(65000,x,true);return dv.getUint32(65000,true);};
    const call=(name,args=[])=>{args.forEach((v,i)=>dv.setUint32(4+4*i,v>>>0,true));return bridge.call(OpenGLCompat.CALL_INDEX[name],0,0);};
    const error=()=>call('glGetError');
    const a=bridge.createContext(42);check(bridge.makeCurrent(a,42),1,'current');
    const clear=(mode,c)=>{call('glDrawBuffer',[mode]);call('glClearColor',c.map(f));call('glClear',[0x4000]);};
    const get=(target,level,n,format=0x1908,type=0x1401)=>{new Uint8Array(memory,4096,1024).fill(0xa5);call('glGetTexImage',[target,level,format,type,4096]);check(error(),0,'get error');return Array.from(new Uint8Array(memory,4096,n));};
    call('glPixelStorei',[0xd05,1]);call('glPixelStorei',[0xcf5,1]);
    clear(0x404,[1,0,0,1]);clear(0x405,[0,0,1,1]);
    call('glEnable',[0xc11]);call('glScissor',[2,3,1,1]);clear(0x405,[0,1,0,1]);
    call('glScissor',[3,3,1,1]);clear(0x405,[1,1,0,1]);call('glDisable',[0xc11]);
    call('glBindTexture',[0xde1,11]);call('glReadBuffer',[0x405]);
    call('glCopyTexImage2D',[0xde1,0,0x1908,2,3,2,1,0]);check(error(),0,'copy back');
    check(get(0xde1,0,8),[0,255,0,255,255,255,0,255],'nonuniform back actual pixels');
    call('glReadBuffer',[0x404]);call('glCopyTexSubImage2D',[0xde1,0,1,0,4,5,1,1]);
    check(get(0xde1,0,8),[0,255,0,255,255,0,0,255],'front subcopy offset');
    call('glCopyTexImage2D',[0xde1,2,0x1907,1,1,1,1,0]);
    check(get(0xde1,2,4),[255,0,0,255],'separate mip internal format');
    call('glBindTexture',[0xde0,12]);call('glReadBuffer',[0x405]);
    call('glCopyTexImage1D',[0xde0,1,0x1908,2,3,2,0]);
    check(get(0xde0,1,8),[0,255,0,255,255,255,0,255],'1D copy selected row');
    call('glReadBuffer',[0x404]);call('glCopyTexSubImage1D',[0xde0,1,1,1,1,1]);
    check(get(0xde0,1,8),[0,255,0,255,255,0,0,255],'1D subcopy offset');
    // Render copied nonuniform texture data, then consume that produced
    // framebuffer in a copy before the producer is otherwise flushed.
    const frontend=bridge.contexts.get(a).frontend,gl=frontend.backend.gl;
    gl.disable(gl.DITHER);call('glViewport',[0,0,8,8]);
    call('glDrawBuffer',[0x405]);call('glReadBuffer',[0x405]);
    call('glBindTexture',[0xde1,11]);
    for(const p of [0x2800,0x2801])call('glTexParameteri',[0xde1,p,0x2600]);
    call('glEnable',[0xde1]);call('glTexEnvi',[0x2300,0x2200,0x1e01]);
    const quad=(u,v)=>{
      const vertices=[];for(const[x,y]of[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]])vertices.push(x,y,0,1,1,1,1,u,v,0,0,1,u,v,1,0,1,0,1);
      frontend.enqueuePacked(4,new Float32Array(vertices));
    };
    call('glEnable',[0xc11]);
    for(const[x,u]of[[0,.25],[4,.75]]){call('glScissor',[x,0,4,8]);quad(u,.5);}
    call('glDisable',[0xc11]);
    call('glBindTexture',[0xde0,13]);call('glCopyTexImage1D',[0xde0,0,0x1908,3,1,2,0]);
    check(get(0xde0,0,8),[0,255,0,255,255,0,0,255],'copy consumes actual pending textured producer');
    const rendered=new Uint8Array(256);frontend.backend.readPixels(0,0,8,8,0x1908,0x1401,rendered);
    check([...rendered],Array.from({length:64},(_,i)=>i%8<4?[0,255,0,255]:[255,0,0,255]).flat(),'rendered copied 2D columns');
    call('glDisable',[0xde1]);call('glEnable',[0xde0]);for(const p of [0x2800,0x2801])call('glTexParameteri',[0xde0,p,0x2600]);
    call('glEnable',[0xc11]);for(const[x,u]of[[0,.25],[4,.75]]){call('glScissor',[x,0,4,8]);quad(u,37);}call('glDisable',[0xc11]);frontend.flushPendingDraw();
    frontend.backend.readPixels(0,0,8,8,0x1908,0x1401,rendered);
    check([...rendered],Array.from({length:64},(_,i)=>i%8<4?[0,255,0,255]:[255,0,0,255]).flat(),'rendered copied 1D columns');
    call('_glReadTexturePixels',[3,1,2,1,2048]);
    check(Array.from({length:8},(_,i)=>dv.getFloat32(2048+i*4,true)),[0,1,0,1,1,0,0,1],'private native read barrier actual floats');
    call('glDisable',[0xde0]);call('glBindTexture',[0xde1,14]);
    call('glCopyTexImage2D',[0xde1,0,0x1908,2,1,4,4,1]);
    const bordered=Array.from({length:16},(_,i)=>i%4<2?[0,255,0,255]:[255,0,0,255]).flat();
    check(get(0xde1,0,64),bordered,'2D framebuffer copy with supplied borders');
    call('glReadBuffer',[0x404]);call('glCopyTexSubImage2D',[0xde1,0,-1,-1,1,1,1,1]);bordered.splice(0,4,255,0,0,255);
    check(get(0xde1,0,64),bordered,'negative destination edits copied border');
    for(const p of [0x2800,0x2801])call('glTexParameteri',[0xde1,p,0x2600]);
    call('glEnable',[0xde1]);call('glReadBuffer',[0x405]);quad(.25,.25);frontend.flushPendingDraw();
    frontend.backend.readPixels(0,0,8,8,0x1908,0x1401,rendered);
    check([...rendered],Array(64).fill([0,255,0,255]).flat(),'bordered copy uses interior normalized coordinates');
    call('glTexParameteri',[0xde1,0x2800,0x2601]);call('glTexParameteri',[0xde1,0x2801,0x2601]);call('glTexParameteri',[0xde1,0x2802,0x2900]);call('glTexParameteri',[0xde1,0x2803,0x2900]);
    quad(0,0);frontend.flushPendingDraw();frontend.backend.readPixels(0,0,8,8,0x1908,0x1401,rendered);
    check([...rendered],Array(64).fill([64,191,0,255]).flat(),'linear border footprint consumes edited corner');
    call('glDisable',[0xde1]);call('glBindTexture',[0xde0,12]);call('glReadBuffer',[0x404]);
    call('glPixelTransferf',[0xd14,f(.5)]);call('glPixelTransferf',[0xd19,f(.25)]);
    call('glCopyTexImage1D',[0xde0,0,0x1908,1,1,1,0]);
    check(get(0xde0,0,4),[128,64,0,255],'copy transfer applied once');
    call('glPixelTransferf',[0xd14,f(1)]);call('glPixelTransferf',[0xd19,f(0)]);
    // Source floats must survive capture until transfer, before clamping.
    [-1,2,.5,.25].forEach((v,i)=>dv.setFloat32(2048+i*4,v,true));
    call('glPixelTransferf',[0xd15,f(1)]);call('glPixelTransferf',[0xd18,f(.25)]);
    call('glPixelTransferf',[0xd1a,f(2)]);call('glPixelTransferf',[0xd1c,f(2)]);
    call('glTexImage1D',[0xde0,0,0x1908,1,0,0x1908,0x1406,2048]);
    check(get(0xde0,0,4),[0,128,255,128],'upload transfer before clamp');
    call('glBindTexture',[0xde1,11]);check(get(0xde1,0,8),[0,255,0,255,255,0,0,255],'target isolation');
    const b=bridge.createContext(42);check(bridge.makeCurrent(b,42),1,'second context');
    call('glBindTexture',[0xde1,11]);new Uint8Array(memory,2048,4).set([17,29,43,71]);
    call('glTexImage2D',[0xde1,0,0x1908,1,1,0,0x1908,0x1401,2048]);
    check(get(0xde1,0,4),[17,29,43,71],'same name separate context');
    check(bridge.makeCurrent(a,42),1,'restore first');check(get(0xde1,0,8),[0,255,0,255,255,0,0,255],'first context retained');
    bridge.deleteContext(b);bridge.deleteContext(a);results.push({apiVersion,checks});
  }
  return results;
}
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=process.argv[2];
assert(out,'explicit evidence directory');fs.mkdirSync(out,{recursive:true});
let browser;
(async()=>{try{
 browser=await require(root+'/node_modules/puppeteer').launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();
 for(const f of ['region-map.generated.js','mem-utils.js','gpu-backend.js','gl-command-stream.js','gl-compat.js'])await page.addScriptTag({path:root+'/lib/'+f});
 const results=await page.evaluate(runTextureCopyTests);
 fs.writeFileSync(path.join(out,'pixels.json'),JSON.stringify({passed:true,browser:await browser.version(),results},null,2));console.log('PASS texture copy/readback WebGL',JSON.stringify(results));
}finally{if(browser)await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
