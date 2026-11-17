#!/usr/bin/env node
'use strict';
// Actual browser, production WAT and worker backends. No guest fixture or build.
const assert=require('assert');
const path=require('path');
const puppeteer=require('puppeteer');
const {startStaticServer,closeServer}=require('./static-server');
(async()=>{
  const root=path.join(__dirname,'..');
  const server=await startStaticServer({root,crossOriginIsolated:true,handleRequest(req,res){
    if(req.url!=='/shared-render-test')return false;
    res.writeHead(200,{'Content-Type':'text/html','Cross-Origin-Opener-Policy':'same-origin',
      'Cross-Origin-Embedder-Policy':'require-corp'});
    res.end('<!doctype html><title>Shared render worker integration</title>');return true;
  }});
  let browser;
  try{
    const args=['--no-first-run','--no-default-browser-check'];
    if(process.argv.includes('--no-sandbox'))args.push('--no-sandbox');
    if(process.argv.includes('--swiftshader'))args.push('--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader');
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args,protocolTimeout:120000});
    const page=await browser.newPage();
    page.on('pageerror',error=>console.error('pageerror:',error.message));
    page.on('console',message=>{if(message.type()==='error')console.error('browser console:',message.text());});
    await page.goto(`http://127.0.0.1:${server.address().port}/shared-render-test`);
    for(const file of ['region-map.generated','render-worker','d3d-command-stream','gl-command-stream','gpu-backend','mem-utils',
      'gpu-stream.generated','gpu-stream','gpu-stream-doorbell','gpu-stream-host'])
      await page.addScriptTag({url:`/lib/${file}.js`});
    // test/gpu-stream-fixture.js (CommonJS) writes the ring the WAT would.
    await page.addScriptTag({content:`(function(){var module={exports:{}};var require=function(){return globalThis.GpuStream;};\n${
      require('fs').readFileSync(path.join(__dirname,'gpu-stream-fixture.js'),'utf8')}\nglobalThis.GpsFixture=module.exports;})();`});
    const result=await page.evaluate(async()=>{
      if(!crossOriginIsolated)throw new Error('shared-memory test requires isolated document');
      const module=await WebAssembly.compile(await (await fetch('/build/wine-assembly.wasm')).arrayBuffer());
      const sigs=(await (await fetch('/lib/host-import-sigs.generated.json')).json()).sigs;
      const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),host={memory};
      for(const [name,sig] of Object.entries(sigs))host[name]=sig.results?.length?()=>0:()=>{};
      const e=(await WebAssembly.instantiate(module,{host})).exports;
      e.d3dim_worker_init(0x400000);
      let workers=0,terminations=0,adoptions=0;
      const manager=new RenderWorker.Manager({module,memory,sigs,imageBase:0x400000,sourceVersion:'shared-browser-test',
        workerFactory(){workers++;const worker=new Worker('/lib/d3d-render-worker.js');
          worker.addEventListener('error',event=>console.error('render worker error:',event.message,event.filename,event.lineno,event.colno));
          const terminate=worker.terminate.bind(worker);worker.terminate=()=>{terminations++;return terminate();};return worker;},
        reclaimHeap(head){adoptions++;return e.d3d_render_adopt_free_list(head);}});
      const bitmaps=[];
      const pixel=bitmap=>{
        const canvas=document.createElement('canvas');canvas.width=canvas.height=16;
        const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);
        return [...ctx.getImageData(2,2,1,1).data];
      };
      const same=(actual,expected,label)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(label+': '+JSON.stringify(actual));};
      // GPU stream v2: the page writes a GpsRing in the SHARED wasm memory (as
      // the WAT does) and kicks; the render Worker drains that same ring.
      async function glidePool(backend){
        const C=GpuStream.CONST,ringBytes=4096,arenaBytes=16384;
        const base=((e.guest_to_wasm(e.guest_alloc(ringBytes+arenaBytes+1024))>>>0)+63)&-64;
        const p=GpsFixture.makeProducer({buffer:memory.buffer,headerAddr:base,ringData:base+512,
          arenaData:base+512+ringBytes,ringBytes,arenaBytes});
        const kicks=[],presented=[];
        let readbacks=0;
        const renderer={windows:{7:{}},scheduleRepaint(){}};
        const bridge=new GpuStreamHost.Bridge({api:'glide',backend,getMemory:()=>memory,getExports:()=>e,renderer,
          createRenderEndpoint(options){
            const port=manager.createEndpoint(options),request=port.request.bind(port);
            port.request=async message=>{kicks.push(message);return request(message);};
            return port;
          },
          onPresent(layer){presented.push([...layer.canvas.getContext('2d').getImageData(2,2,1,1).data]);}});
        const clear=rgba=>p.emit('CLEAR',{mask:C.CLEAR_COLOR,colormask:15,rgba,z:1,left:0,top:0,right:16,bottom:16});
        const read=async expected=>{
          const dst=p.arenaAlloc(16*16*2);
          p.emit('READBACK',{rt:1,x:0,y:0,w:16,h:16,fmt:C.FMT_RGB565,dst,pitch:32,slot:0});
          same(await bridge.kick(base,C.KICK_SYNC),1,backend+' Glide sync kick');
          const v=p.arenaView(dst,16*16*2);readbacks++;
          same(v[(2*16+2)*2]|v[(2*16+2)*2+1]<<8,expected,backend+' Glide RGB565 readback');
        };
        const present=()=>{p.emit('PRESENT',{rt:1,gamma:0,x:0,y:0,w:16,h:16,surface:7});return bridge.kick(base,C.KICK_SYNC);};
        try{
          p.emit('CREATE',{id:1,kind:C.KIND_RT,fmt:C.FMT_A8B8G8R8,levels:1,width:16,height:16});
          p.emit('TARGETS',{color:1,depth:0});
          // ASYNC kicks ACK at once, before the Worker even exists; the
          // Worker handles kicks in order, so the SYNC read sees all three.
          for(const rgba of [0xff0000ff,0xff00ff00,0xffff0000]){clear(rgba);same(bridge.kick(base,C.KICK_ASYNC),1,'Glide async kick early ACK');}
          clear(0xffffffff);
          await read(0xffff);
          if(backend==='webgl'&&!bridge.device.glRenderer)throw new Error('Glide GPU unexpectedly fell back to software');
          await present();
          same(presented.at(-1),[255,255,255,255],backend+' Glide white presentation');
          // LFB write: top-down RGBA rows uploaded into the RT.
          const rows=new Uint8Array(16*16*4);for(let i=0;i<256;i++)rows.set([0,255,0,255],i*4);
          const src=p.arenaAlloc(rows.length);p.arenaView(src,rows.length).set(rows);
          p.emit('UPLOAD',{id:1,level:0,face:0,x:0,y:0,w:16,h:16,pitch:64,src,bytes:rows.length});
          same(bridge.kick(base,C.KICK_ASYNC),1,'Glide LFB upload early ACK');
          await read(0x07e0);
          await present();
          same(presented.at(-1),[0,255,0,255],backend+' Glide LFB green presentation');
          if(kicks.some(k=>k.t!=='gps-kick'||k.ring!==base))throw new Error('Glide kicks must name the one shared ring');
          same(await bridge.kick(base,C.KICK_CLOSE),1,backend+' Glide close kick');
          if(bridge.endpoint||renderer.windows[7]._gpuFrameLayer||adoptions||terminations)
            throw new Error('Glide close failed endpoint/window retirement or retired peer endpoints');
          // The upload's ASYNC kick came after the endpoint armed the ring's
          // doorbell: one Atomics.notify, no request message.
          return {backend,kicks:kicks.length,readbacks,presents:presented.length,doorbells:bridge.stats.doorbells};
        }finally{await bridge.close();}
      }
      try{
        await manager.ready;
        // The D3D9 neutral endpoints went with the old JS D3D9 path
        // (d3d9-retire S4); D3D8/9 now ride the same gps-kick endpoint Glide
        // exercises here.
        const glide=[await glidePool('webgl'),await glidePool('software')];
        if(adoptions!==0||terminations!==0)throw new Error('endpoint close retired the shared process');
        const stopped=await manager.stop();await manager.stop();
        if(workers!==1||terminations!==1||adoptions!==1)throw new Error('physical worker/heap lifecycle counts '+[workers,terminations,adoptions]);
        return {workers,terminations,adoptions,glide,heapHead:stopped.heapHead,heapAdopted:stopped.heapAdopted};
      }finally{for(const bitmap of bitmaps)bitmap?.close();await manager.stop();}
    });
    assert.strictEqual(result.workers,1);assert.strictEqual(result.adoptions,1);
    assert.deepStrictEqual(result.glide.map(run=>[run.backend,run.kicks,run.readbacks,run.presents,run.doorbells]),
      [['webgl',8,2,2,1],['software',8,2,2,1]]);
    console.log('PASS actual shared worker Glide WebGL/native software:',JSON.stringify(result));
  }finally{if(browser)await browser.close();await closeServer(server);}
})().catch(error=>{console.error(error);process.exitCode=1;});
