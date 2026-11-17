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
      'gpu-stream.generated','gpu-stream','gpu-stream-doorbell','gpu-stream-host','glide-host'])
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
      const OP=D3DCommandStream.OPCODES;
      async function neutral(backend){
        const port=manager.createEndpoint({api:'neutral',backend});await port.ready;
        const consumer=new D3DCommandStream.WorkerConsumer(port);
        const queue=new D3DCommandStream.CommandQueue({deviceId:7,generation:1,consumer});
        const issue=async(opcode,payload={})=>{const r=queue.submit(opcode,payload);await queue.fence(r.sequence,r.generation);return await r.value;};
        await issue(OP.RESOURCE_CREATE,{kind:'device',backend,width:16,height:16,quadBudget:1});
        return {port,queue,issue};
      }
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
        const bridge=new GlideHost.Bridge({backend,getMemory:()=>memory,getExports:()=>e,renderer,
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
        const gpu=await neutral('webgl'),software=await neutral('software');
        await gpu.issue(OP.CLEAR,{color:[0,1,0,1],flags:1});
        const gpuFrame=await gpu.issue(OP.PRESENT);bitmaps.push(gpuFrame.bitmap);
        if(!(gpuFrame.bitmap instanceof ImageBitmap)||gpuFrame.pixels)throw new Error('GPU present did not transfer bitmap exclusively');
        same(pixel(gpuFrame.bitmap),[0,255,0,255],'D3D9 green frame');
        // Exercise the production DRAW payload, shader compiler and texture
        // upload through the worker transport. The PS multiplies sampled RGBA
        // by (.5,.25,1,1); neither CLEAR nor an untextured draw can satisfy it.
        const texture={width:2,height:1,key:'shared-browser-texture-v1',
          pixels:new Uint8Array([200,160,80,255,40,80,120,255]),
          sampler:{addressU:3,addressV:3,min:1,mag:1}};
        const gpuDraw={primitive:4,primitiveCount:1,stride:16,
          vertices:new Uint8Array(new Float32Array([-1,-1,.25,1,3,-1,.25,1,-1,3,.25,1]).buffer),
          indices:new Uint16Array([0,1,2]),attributes:[{register:0,type:3,offset:0}],
          vertexShader:new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,
            1,0xe00f0000,0xa0e40000,0xffff]),
          pixelShader:new Uint32Array([0xffff0101,66,0xb00f0000,
            5,0x800f0000,0xb0e40000,0xa0e40000,0xffff]),
          vertexConstants:new Float32Array([.25,.5,0,1]),
          pixelConstants:new Float32Array([.5,.25,1,1]),textures:[texture],
          state:{cull:1,zenable:false,blend:false}};
        const near=(actual,expected,label)=>{
          if(actual.length!==expected.length||actual.some((v,i)=>Math.abs(v-expected[i])>1))
            throw new Error(label+': '+JSON.stringify(actual));
        };
        async function texturedFrame(expected,label){
          const read=await gpu.issue(OP.READBACK);
          same([read.width,read.height,read.pitch],[16,16,64],label+' readback dimensions');
          near([...read.pixels.slice((2*16+2)*4,(2*16+2)*4+4)],
            [expected[2],expected[1],expected[0],expected[3]],label+' BGRA readback');
          const frame=await gpu.issue(OP.PRESENT);bitmaps.push(frame.bitmap);
          if(!(frame.bitmap instanceof ImageBitmap)||frame.pixels)throw new Error(label+' must transfer bitmap exclusively');
          near(pixel(frame.bitmap),expected,label+' bitmap');return frame;
        }
        await gpu.issue(OP.CLEAR,{color:[0,0,0,1],flags:1});
        await gpu.issue(OP.DRAW,gpuDraw);
        const textured=await texturedFrame([100,40,80,255],'uploaded first texel');
        // A key-only second submission must find the resident texture in this
        // endpoint. Change the UV and clear first so a stale frame cannot pass.
        texture.pixels.fill(0);
        gpuDraw.textures=[{width:2,height:1,key:texture.key,sampler:texture.sampler}];
        gpuDraw.vertexConstants=new Float32Array([.75,.5,0,1]);
        await gpu.issue(OP.CLEAR,{color:[1,0,1,1],flags:1});
        await gpu.issue(OP.DRAW,gpuDraw);
        await texturedFrame([20,20,120,255],'resident second texel');
        near(pixel(textured.bitmap),[100,40,80,255],'old textured bitmap remains immutable');
        await software.issue(OP.CLEAR,{color:[0,0,0,1],flags:3});
        const vertices=new Float32Array([-1,1,.5,1,1,0,0,1,0,0,0,1,
          1,1,.5,1,1,0,0,1,1,0,0,1,-1,-1,.5,1,1,0,0,1,0,1,0,1]);
        const drawing=software.issue(OP.DRAW,{primitive:4,primitiveCount:1,stride:48,vertices:new Uint8Array(vertices.buffer),
          attributes:[{register:0,usage:0,usageIndex:0,type:3,offset:0},{register:1,usage:10,usageIndex:0,type:3,offset:16},
            {register:2,usage:5,usageIndex:0,type:3,offset:32}],
          vertexShader:new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40001,1,0xe00f0000,0x90e40002,0xffff]),
          pixelShader:new Uint32Array([0xffff0101,1,0x800f0000,0xa0e40000,0xffff]),
          vertexConstants:new Float32Array(384),pixelConstants:new Float32Array([.25,.5,.75,1]),
          state:{zenable:true,zwrite:true,zfunc:4,blend:false,cull:1},textures:[]});
        // The second API submits while the native software job is still live.
        const other=gpu.issue(OP.CLEAR,{color:[0,0,1,1],flags:1});
        await Promise.all([drawing,other]);
        const swFrame=await software.issue(OP.PRESENT);
        same([...swFrame.pixels.slice((2*16+2)*4,(2*16+2)*4+4)],[191,128,64,255],'native D3D9 shader pixel');
        same(pixel(gpuFrame.bitmap),[0,255,0,255],'independent GPU bitmap remains immutable');
        await gpu.port.terminate();
        if(adoptions!==0||terminations!==0)throw new Error('endpoint close retired the shared process');
        const glide=[await glidePool('webgl'),await glidePool('software')];
        await software.issue(OP.CLEAR,{color:[1,0,1,1],flags:1});
        const survivor=await software.issue(OP.PRESENT);same([...survivor.pixels.slice(0,4)],[255,0,255,255],'surviving software device');
        await software.port.terminate();
        const stopped=await manager.stop();await manager.stop();
        if(workers!==1||terminations!==1||adoptions!==1)throw new Error('physical worker/heap lifecycle counts '+[workers,terminations,adoptions]);
        return {workers,terminations,adoptions,gpuTexturedDraws:2,
          glide,heapHead:stopped.heapHead,heapAdopted:stopped.heapAdopted};
      }finally{for(const bitmap of bitmaps)bitmap?.close();await manager.stop();}
    });
    assert.strictEqual(result.workers,1);assert.strictEqual(result.adoptions,1);
    assert.strictEqual(result.gpuTexturedDraws,2);
    assert.deepStrictEqual(result.glide.map(run=>[run.backend,run.kicks,run.readbacks,run.presents,run.doorbells]),
      [['webgl',8,2,2,1],['software',8,2,2,1]]);
    console.log('PASS actual shared worker D3D9 + Glide WebGL/native software:',JSON.stringify(result));
  }finally{if(browser)await browser.close();await closeServer(server);}
})().catch(error=>{console.error(error);process.exitCode=1;});
