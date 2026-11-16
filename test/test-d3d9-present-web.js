'use strict';
const assert=require('assert'),path=require('path'),puppeteer=require('puppeteer');
(async()=>{
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();
  for(const f of ['gpu-backend.js','d3d9-shader.js','render-clear.js','d3d9-backend.js','d3d-command-stream.js','d3d9-host.js'])await page.addScriptTag({path:path.join(__dirname,'../lib',f)});
  const result=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
   const bridge=new D3D9Host.Bridge({backend:'webgl'}),entry={kind:'webgl',device:new D3D9Backend.Device(canvas)};
   const op=D3DCommandStream.OPCODES;
   entry.queue=new D3DCommandStream.CommandQueue({deviceId:1,consumer:{execute:c=>bridge._consume(entry,c,x=>bridge._execute(entry,x))}});
   bridge._submit(entry,op.CLEAR,{color:[1,0,0,1],flags:1});
   // Present carries no pixels on WebGL; a READBACK queued right behind each
   // one reads the target as it stood at that present, before the next Clear.
   const first=bridge._submit(entry,op.PRESENT,{width:4,height:4,interval:0});
   const firstPixels=bridge._submit(entry,op.READBACK,{});
   const before=entry.queue.completed;
   const clear=bridge._submit(entry,op.CLEAR,{color:[0,0,1,1],flags:1});
   const second=bridge._submit(entry,op.PRESENT,{width:4,height:4,interval:1});
   const secondPixels=bridge._submit(entry,op.READBACK,{});
   const presentCarriesPixels=Object.prototype.hasOwnProperty.call(await first,'pixels');
   const red=Array.from((await firstPixels).pixels.slice(0,4));await clear;
   const blue=Array.from((await secondPixels).pixels.slice(0,4));
   const immediate=bridge._submit(entry,op.PRESENT,{width:4,height:4,interval:0x80000000});
   const sync=typeof immediate.then!=='function',completed=entry.queue.completed;
   bridge._submit(entry,op.RESOURCE_RELEASE,{kind:'device'});await bridge.close();
   return {before,red,blue,sync,completed,presentCarriesPixels};
  });
  assert.deepStrictEqual(result,{before:1,red:[0,0,255,255],blue:[255,0,0,255],sync:true,completed:7,presentCarriesPixels:false});
  console.log('PASS real WebGL RAF presentation: delayed red/blue pixels, ordered Clear, genuine completion and synchronous IMMEDIATE');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
