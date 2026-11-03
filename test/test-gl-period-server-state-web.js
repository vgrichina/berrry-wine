'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),puppeteer=require('puppeteer');
const run=path.resolve('scratch/runs/20261103-gl-polygon-color-material-repair');
(async()=>{
 fs.mkdirSync(run,{recursive:true});
 if(!process.env.GL_PERIOD_CAPTURE)require('child_process').execFileSync(process.execPath,['test/test-gl-period-server-state.js'],{stdio:'pipe',env:{...process.env,GL_PERIOD_RESULT:path.join(run,'period-direct.json')}});
 const native=JSON.parse(fs.readFileSync(path.join(run,process.env.GL_PERIOD_CAPTURE||'period-direct.json')));
 const browser=await puppeteer.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:[
  '--no-sandbox','--no-first-run','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();
  for(const name of ['region-map.generated','gpu-backend','gl-command-stream','mem-utils','gl-compat'])
   await page.addScriptTag({path:path.resolve('lib',name+'.js')});
  const results=await page.evaluate(native=>{
   const results=[];
   for(const apiVersion of [1,2]){
    const memory=new ArrayBuffer(1024),bridge=new OpenGLCompat.OpenGLHostBridge({
     getMemory:()=>memory,exports:{guest_to_wasm:p=>p},apiVersion,
     renderer:{windows:{42:{hwnd:42,w:64,h:64,clientRect:{w:64,h:64}}},repaint(){}}});
    try{
     let batches=0,draws=0;
     for(const item of native.cases){
      while(batches<item.captureEnd){
       const capture=native.captures[batches],bytes=Uint8Array.from(capture.bytes);
       const batch=GLCommandStream.memoryBatch(bytes.buffer,0,bytes.length);
       GLCommandStream.replay(batch,op=>{if(op===GLCommandStream.PACKED_DRAW_OPCODE||op===GLCommandStream.EXACT_DRAW_OPCODE)draws++;return 0;});
       bridge.replay(batch,capture.owner);batches++;
      }
      const a=bridge.currentByOwner.get(1),ctx=bridge.contexts.get(a);if(!ctx)throw Error('source context missing');
      bridge._activateWebgl(ctx);ctx.frontend.flushPendingDraw();const gl=ctx.backend.gl;
      const pixels=ctx.backend.readPixels(0,0,64,64,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(64*64*4));
      let colored=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]||pixels[i+1]||pixels[i+2])colored++;
      const index=(32*64+32)*4,actual=pixels[index+2]|(pixels[index+1]<<8)|(pixels[index]<<16);
      results.push({name:item.name,apiVersion,actualVersion:ctx.backend.version,batches,draws,sourceCurrent:a,
       destinationCurrent:bridge.currentByOwner.get(2),actual,expected:item.expected,colored,nativeColored:item.colored,samples:(item.samples||[]).map(s=>{const i=(s.y*64+s.x)*4;return {...s,actual:pixels[i+2]|(pixels[i+1]<<8)|(pixels[i]<<16)};}),error:gl.getError(),pixels:Array.from(pixels)});
     }
    }finally{bridge.destroy();}
   }
   return results;
  },native);
  for(const version of [1,2]){const stippled=results.filter(r=>r.apiVersion===version&&r.name.startsWith('stipple '));assert.strictEqual(stippled.length,3);for(const r of stippled.slice(1))assert.deepStrictEqual(r.pixels,stippled[0].pixels,r.name+' independent line-loop raster WebGL'+version);}
  const {PNG}=require('pngjs');
  for(const r of results){const png=new PNG({width:64,height:64});
   for(let y=0;y<64;y++)png.data.set(r.pixels.slice(y*64*4,(y+1)*64*4),(63-y)*64*4);
   fs.writeFileSync(path.join(run,`webgl${r.apiVersion}-${r.name.replace(/[^a-z0-9]+/gi,'-')}.png`),PNG.sync.write(png));delete r.pixels;}
  fs.writeFileSync(path.join(run,'webgl-period-state.json'),JSON.stringify({browser:await browser.version(),nativeModule:native.module,results},null,2)+'\n');
  console.log(JSON.stringify(results));
  for(const r of results){
   for(const sample of r.samples)assert.strictEqual(sample.actual,sample.expected,r.name+' sample '+sample.x+','+sample.y);
   assert.strictEqual(r.error,0,r.name);assert.strictEqual(r.actual,r.expected,r.name+' WebGL'+r.apiVersion);
   if(r.name.includes('culled'))assert.strictEqual(r.colored,0,r.name);
   else if(r.name.includes('point'))assert(r.colored>0&&r.colored<64,r.name+' point footprint');
   else if(r.nativeColored>30)assert(r.colored>30,r.name+' visible boundary/filled footprint');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
