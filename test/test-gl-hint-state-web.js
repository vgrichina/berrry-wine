'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),puppeteer=require('puppeteer');
const run=path.resolve('scratch/runs/20261103-gl-copy-context-transaction');
(async()=>{
 fs.mkdirSync(run,{recursive:true});
 const file=process.env.GL_HINT_CAPTURE||'hints-direct.json';
 if(!process.env.GL_HINT_CAPTURE)require('child_process').execFileSync(process.execPath,['test/test-gl-hint-state.js'],{stdio:'pipe',env:{...process.env,GL_HINT_RESULT:path.join(run,file)}});
 const native=JSON.parse(fs.readFileSync(path.join(run,file)));
 const browser=await puppeteer.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:[
  '--no-sandbox','--no-first-run','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();
  for(const name of ['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gl-compat'])await page.addScriptTag({path:path.resolve('lib',name+'.js')});
  const results=await page.evaluate(native=>{
   const results=[];
   for(const apiVersion of [1,2]){
    const memory=new ArrayBuffer(4096),bridge=new OpenGLCompat.OpenGLHostBridge({getMemory:()=>memory,exports:{guest_to_wasm:p=>p},apiVersion,
     renderer:{windows:{42:{hwnd:42,w:64,h:64,clientRect:{w:64,h:64}}},repaint(){}}});
    try{
     let batches=0,draws=0;
     for(const item of native.checkpoints){
      while(batches<item.captureEnd){const capture=native.captures[batches],bytes=Uint8Array.from(capture.bytes),batch=GLCommandStream.memoryBatch(bytes.buffer,0,bytes.length);
       GLCommandStream.replay(batch,op=>{if(op===GLCommandStream.PACKED_DRAW_OPCODE||op===GLCommandStream.EXACT_DRAW_OPCODE)draws++;return 0;});bridge.replay(batch,capture.owner);batches++;}
      const a=bridge.currentByOwner.get(1),ctx=bridge.contexts.get(a);if(!ctx)throw Error('source context missing');
      bridge._activateWebgl(ctx);ctx.frontend.flushPendingDraw();const gl=ctx.backend.gl,dv=new DataView(memory),queries=[];
      bridge._owner=1;
      for(const [name,width] of [['glGetIntegerv',4],['glGetFloatv',4],['glGetDoublev',8],['glGetBooleanv',1]]){
       const values=[];for(let i=0;i<5;i++){
        dv.setUint32(4,0xc50+i,true);dv.setUint32(8,128,true);new Uint8Array(memory,128,16).fill(0xa5);bridge.call(OpenGLCompat.CALL_INDEX[name],0,0);
        values.push(width===1?dv.getUint8(128):name==='glGetIntegerv'?dv.getInt32(128,true):width===4?dv.getFloat32(128,true):dv.getFloat64(128,true));
        if(dv.getUint8(128+width)!==0xa5)throw Error('hint query wrote beyond one '+name+' value');
       }queries.push({name,values,expected:name==='glGetBooleanv'?[1,1,1,1,1]:item.expectedHints});
      }
      // Validate the consumer's own hint path independently of native filtering.
      const before=Array.from(ctx.frontend.hints);dv.setUint32(4,0xc55,true);dv.setUint32(8,0x1102,true);bridge.call(OpenGLCompat.CALL_INDEX.glHint,0,0);
      const invalidError=bridge.call(OpenGLCompat.CALL_INDEX.glGetError,0,0),after=Array.from(ctx.frontend.hints);
      const pixels=ctx.backend.readPixels(0,0,64,64,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(64*64*4));
      results.push({name:item.name,apiVersion,actualVersion:ctx.backend.version,batches,draws,queries,before,after,invalidError,
       sourceCurrent:a,destinationCurrent:bridge.currentByOwner.get(2),actualPixel:Array.from(pixels.slice((32*64+32)*4,(32*64+32)*4+4)),expectedPixel:item.expectedPixel,error:gl.getError(),pixels:Array.from(pixels)});
     }
    }finally{bridge.destroy();}
   }return results;
  },native);
  const {PNG}=require('pngjs');
  for(const r of results){const png=new PNG({width:64,height:64});for(let y=0;y<64;y++)png.data.set(r.pixels.slice(y*64*4,(y+1)*64*4),(63-y)*64*4);
   fs.writeFileSync(path.join(run,`hints-${native.queued?'worker':'direct'}-webgl${r.apiVersion}-${r.name.replace(/[^a-z0-9]+/gi,'-')}.png`),PNG.sync.write(png));delete r.pixels;}
  fs.writeFileSync(path.join(run,`hints-web-${native.queued?'worker':'direct'}.json`),JSON.stringify({browser:await browser.version(),nativeModule:native.module,results},null,2)+'\n');
  for(const r of results){assert.strictEqual(r.actualVersion,r.apiVersion);assert.strictEqual(r.error,0);assert.strictEqual(r.invalidError,0x500);assert.deepStrictEqual(r.after,r.before);assert.deepStrictEqual(r.actualPixel,r.expectedPixel);assert.strictEqual(r.destinationCurrent,0);
   for(const q of r.queries)assert.deepStrictEqual(q.values,q.expected,r.name+' '+q.name+' WebGL'+r.apiVersion);}
  console.log('PASS actual WebGL1+2 hint queries and native capture replay',JSON.stringify(results));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
