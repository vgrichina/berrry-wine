'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),puppeteer=require('puppeteer');
const run=path.resolve('scratch/runs/20261103-gl-copy-context-ready');
(async()=>{
 assert(process.env.GL_COPY_CAPTURE,'explicit native capture required');
 const native=JSON.parse(fs.readFileSync(path.join(run,process.env.GL_COPY_CAPTURE)));
 const browser=await puppeteer.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:[
  '--no-sandbox','--no-first-run','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();
  for(const name of ['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gl-compat'])await page.addScriptTag({path:path.resolve('lib',name+'.js')});
  const results=await page.evaluate(native=>{
   const results=[];
   for(const apiVersion of [1,2]){
    const memory=new ArrayBuffer(512*1024*1024),bridge=new OpenGLCompat.OpenGLHostBridge({getMemory:()=>memory,exports:{guest_to_wasm:p=>(p-0x400000+RegionMap.REGIONS.GUEST_BASE.base)>>>0},apiVersion,
     renderer:{windows:Object.fromEntries([42,43].map(hwnd=>[hwnd,{hwnd,w:64,h:64,clientRect:{w:64,h:64}}])),repaint(){}}});
    try{
     let copying=false,commits=0;
     const activate=bridge._activateWebgl;
     bridge._activateWebgl=function(ctx){if(copying)throw Error('copy activated a context');return activate.call(this,ctx);};
     for(const name of ['_prepareContextCopy','_commitContextCopy']) {
      const original=bridge[name];bridge[name]=function(...args){
       const bindings=JSON.stringify([...this.currentByOwner]),active=this._activeWebglContext;
       copying=true;let result;try{result=original.apply(this,args);}finally{copying=false;}
       if(JSON.stringify([...this.currentByOwner])!==bindings||this._activeWebglContext!==active)throw Error('copy changed context or drawable binding');
       if(name==='_commitContextCopy')commits++;return result;
      };
     }
     let batches=0,draws=0;
     for(const item of native.checkpoints){
      while(batches<item.captureEnd){const capture=native.captures[batches],bytes=Uint8Array.from(capture.bytes),batch=GLCommandStream.memoryBatch(bytes.buffer,0,bytes.length);
       GLCommandStream.replay(batch,op=>{if(op===GLCommandStream.PACKED_DRAW_OPCODE||op===GLCommandStream.EXACT_DRAW_OPCODE)draws++;return 0;});bridge.replay(batch,capture.owner);batches++;}
      const current=bridge.currentByOwner.get(item.owner),ctx=bridge.contexts.get(current);
      if(current!==item.current||!ctx)throw Error('destination context missing or rebound');
      bridge._activateWebgl(ctx);ctx.frontend.flushPendingDraw();const gl=ctx.backend.gl;
      const pixels=ctx.backend.readPixels(0,0,64,64,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(64*64*4));
      const state=ctx.backend.copyStateValues();
      const retained={currentColor:Array.from(ctx.frontend.currentColor),clearColor:ctx.frontend.clearColor,viewport:state.get('setViewport').args,scissor:state.get('setScissor').args,depthFunc:state.get('setDepthFunc').args,depthMask:state.get('setDepthMask').args,polygonOffset:ctx.frontend.polygonOffset,binding:ctx.frontend.boundTextureNames[0]};
      results.push({retained,name:item.name,apiVersion,actualVersion:ctx.backend.version,batches,draws,current,commits,depthBits:gl.getParameter(gl.DEPTH_BITS),
       probes:item.pixels.map(p=>({...p,actual:Array.from(pixels.slice((p.y*64+p.x)*4,(p.y*64+p.x)*4+4))})),error:gl.getError(),pixels:Array.from(pixels)});
     }
    }finally{bridge.destroy();}
   }return results;
  },native);
  const {PNG}=require('pngjs');
  for(const r of results){const png=new PNG({width:64,height:64});for(let y=0;y<64;y++)png.data.set(r.pixels.slice(y*64*4,(y+1)*64*4),(63-y)*64*4);
   fs.writeFileSync(path.join(run,`transaction-${native.publicRoute?'public-':''}${native.queued?'worker':'direct'}-webgl${r.apiVersion}-${r.name.replace(/[^a-z0-9]+/gi,'-')}.png`),PNG.sync.write(png));delete r.pixels;}
  fs.writeFileSync(path.join(run,`transaction-web-${native.publicRoute?'public-':''}${native.queued?'worker':'direct'}.json`),JSON.stringify({browser:await browser.version(),nativeModule:native.module,results},null,2)+'\n');
  for(const r of results){
   if(r.name==='copied server state draw'){assert.deepStrictEqual(r.retained.currentColor,[0,0,1,1]);assert.deepStrictEqual(r.retained.clearColor,[0,1,0,1]);assert.deepStrictEqual(r.retained.viewport,[8,8,48,48]);assert.deepStrictEqual(r.retained.scissor,[16,16,32,32]);}
   if(r.name==='texture namespace isolation')assert.strictEqual(r.retained.binding,7);
   if(r.name==='polygon offset depth threshold'||r.name==='copied depth write isolation'){assert.deepStrictEqual(r.retained.polygonOffset,[32,0]);assert.deepStrictEqual(r.retained.depthFunc,[0x204]);assert.deepStrictEqual(r.retained.depthMask,[0]);}
   assert.strictEqual(r.actualVersion,r.apiVersion);assert.strictEqual(r.error,0);assert(r.draws>0);assert(r.commits>0);for(const p of r.probes)assert.deepStrictEqual(p.actual,p.rgba,r.name+' WebGL'+r.apiVersion);}
  console.log('PASS actual WebGL1+2 native transaction capture replay',JSON.stringify(results));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
