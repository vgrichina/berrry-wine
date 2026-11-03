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
    for(const file of ['region-map.generated','render-worker','d3d-command-stream','gl-command-stream','gpu-backend','mem-utils','gl-compat',
      'glide-backend','glide-software','glide-host'])
      await page.addScriptTag({url:`/lib/${file}.js`});
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
      async function glidePool(backend){
        const pointer=e.guest_to_wasm(e.guest_alloc(4096))>>>0;
        const view=new DataView(memory.buffer,pointer,4096),packets=[],presented=[];
        let readbacks=0;
        const renderer={windows:{7:{}},scheduleRepaint(){}};
        const bridge=new GlideHost.Bridge({backend,getMemory:()=>memory,getExports:()=>e,renderer,
          createRenderEndpoint(options){
            const port=manager.createEndpoint(options),request=port.request.bind(port);
            port.request=async message=>{
              if(message.bytes?.buffer instanceof SharedArrayBuffer)
                packets.push({buffer:message.bytes.buffer,offset:message.bytes.byteOffset,op:message.op});
              const reply=await request(message);
              if(message.op===9){
                if(!(reply.bytes?.buffer instanceof SharedArrayBuffer))throw new Error('Glide readback lost shared packet');
                readbacks++;
              }
              return reply;
            };
            return port;
          },
          onPresent(layer){presented.push([...layer.canvas.getContext('2d').getImageData(2,2,1,1).data]);}});
        const words=values=>values.forEach((value,i)=>view.setUint32(i*4,value,true));
        const barrier=()=>bridge.submit(19,pointer,0);
        const read=async expected=>{
          words([0,0,0,16,16]);await bridge.submit(9,pointer,20+16*16*2);
          same(view.getUint16(20+(2*16+2)*2,true),expected,backend+' Glide RGB565 readback');
        };
        try{
          words([7,16,16,0,0,1]);same(await bridge.submit(1,pointer,24),1,backend+' Glide open');
          if(backend==='webgl'&&!bridge.device.glRenderer)throw new Error('Glide GPU unexpectedly fell back to software');
          // No await between three early ACKs: all slots must stay leased even
          // before the first actual worker request starts. Poison reused input.
          for(const color of [0xff0000,0x00ff00,0x0000ff]){
            words([3,12,color,255,65535]);same(bridge.submit(0,pointer,20),1,'Glide snapshot early ACK');
            words([0xffffffff,0xffffffff,0,0,0]);
          }
          words([3,12,0xffffff,255,65535]);
          const blocked=bridge.submit(0,pointer,20);
          if(!(blocked instanceof Promise)||bridge.workerSubmissions.waiters.length!==1)
            throw new Error('Glide fourth packet did not wait for bounded pool credit');
          await blocked;words([0xffffffff,0xffffffff,0,0,0]);await barrier();
          await read(0xffff);
          await bridge.submit(4,pointer,0);await barrier();
          same(presented.at(-1),[255,255,255,255],backend+' Glide white presentation');
          words([0,0,0,16,16]);
          for(let i=0;i<16*16;i++)view.setUint16(20+i*2,0x07e0,true);
          same(bridge.submit(10,pointer,20+16*16*2),1,'Glide LFB write early ACK');
          new Uint8Array(memory.buffer,pointer+20,16*16*2).fill(0);
          await barrier();await read(0x07e0);
          await bridge.submit(4,pointer,0);await barrier();
          same(presented.at(-1),[0,255,0,255],backend+' Glide copied green LFB presentation');
          const offsets=new Set(packets.map(packet=>packet.offset));
          if(offsets.size!==3||packets.length<=3||packets.some(packet=>packet.buffer!==packets[0].buffer))
            throw new Error('Glide packets did not wrap one canonical three-slot SAB');
          await bridge.close();
          if(bridge.workerPacketPool||renderer.windows[7]._gpuFrameLayer||adoptions||terminations)
            throw new Error('Glide close failed pool/window retirement or retired peer endpoints');
          return {backend,packets:packets.length,slots:offsets.size,readbacks,presents:presented.length};
        }finally{await bridge.close();}
      }
      try{
        await manager.ready;
        const gl=manager.createEndpoint({api:'gl',backend:'webgl'});await gl.ready;
        const frames=[];
        gl.addEventListener('message',event=>{if(event.data.t==='frame'){
          const frame=event.data.frame||event.data;frames.push(frame);bitmaps.push(frame.bitmap);
        }});
        const bufferGuest=e.guest_alloc(2048)>>>0,buffer=e.guest_to_wasm(bufferGuest)>>>0;
        const query=e.guest_alloc(4)>>>0;
        const float=value=>{const b=new ArrayBuffer(4);new DataView(b).setFloat32(0,value,true);return new Uint32Array(b)[0];};
        async function glBatch(records,port=gl,extra={}){
          let offset=0;const v=new DataView(memory.buffer);
          for(const {name,args=[],aux=0} of records){
            const stackBytes=(args.length+1)*4,bytes=32+stackBytes,at=buffer+offset;
            new Uint8Array(memory.buffer,at,bytes).fill(0);
            v.setUint32(at,bytes,true);v.setUint32(at+4,OpenGLCompat.CALL_INDEX[name],true);
            v.setUint32(at+8,aux,true);v.setUint32(at+12,stackBytes,true);
            args.forEach((value,i)=>v.setUint32(at+36+i*4,value,true));offset+=bytes;
          }
          return port.request({t:'gl-batch',memoryOffset:buffer,bytes:offset,owner:0,
            windows:[{hwnd:1,w:16,h:16,clientRect:{w:16,h:16}}],surfaces:[],...extra});
        }
        const created=await glBatch([{name:'wglCreateContext',aux:1}]);
        if(!created.value)throw new Error('real worker WGL creation failed');
        // Native WGL records carry the resolved drawable in aux, apart from HDC.
        await glBatch([{name:'wglMakeCurrent',aux:1,args:[1,created.value]},
          {name:'glViewport',args:[0,0,16,16]},
          {name:'glClearColor',args:[float(1),0,0,float(1)]},
          {name:'glClear',args:[0x4000]},{name:'gpuPresent'}]);
        if(frames.length!==1)throw new Error('GL did not publish one transferred frame');
        same(pixel(frames[0].bitmap),[255,0,0,255],'GL red frame');
        await glBatch([{name:'glGetIntegerv',args:[0x0d33,query]}]);
        const maxTexture=e.guest_read32(query)>>>0;
        if(maxTexture<16)throw new Error('GL query output did not reach shared guest memory');
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
        const other=glBatch([{name:'glClearColor',args:[0,0,float(1),float(1)]},
          {name:'glClear',args:[0x4000]},{name:'gpuPresent'}]);
        await Promise.all([drawing,other]);
        const swFrame=await software.issue(OP.PRESENT);
        same([...swFrame.pixels.slice((2*16+2)*4,(2*16+2)*4+4)],[191,128,64,255],'native D3D9 shader pixel');
        same(pixel(frames.at(-1).bitmap),[0,0,255,255],'GL blue frame after mixed work');
        same(pixel(frames[0].bitmap),[255,0,0,255],'old GL bitmap remains immutable');
        same(pixel(gpuFrame.bitmap),[0,255,0,255],'independent GPU bitmap remains immutable');
        await gpu.port.terminate();
        if(adoptions!==0||terminations!==0)throw new Error('endpoint close retired the shared process');
        const glSoftware=manager.createEndpoint({api:'gl',backend:'software'});await glSoftware.ready;
        const softwareFrames=[];
        glSoftware.addEventListener('message',event=>{if(event.data.t==='frame')softwareFrames.push(event.data.frame||event.data);});
        const guestState=new Uint8Array(memory.buffer,RegionMap.BASE.GL_SW_STATE,RegionMap.SIZE.GL_SW_STATE);
        const savedGuestState=guestState.slice();guestState.fill(0xa7);
        const checkGuestState=label=>{if(!guestState.every(value=>value===0xa7))throw new Error(label+' mutated producer GL state');};
        const swContext=await glBatch([{name:'wglCreateContext',aux:1}],glSoftware);
        if(!swContext.value)throw new Error('real software WGL creation failed');
        checkGuestState('software window-context creation');
        const bitmapContext=await glBatch([{name:'wglCreateContext',aux:0x80000005}],glSoftware,
          {surfaces:[{id:5,width:2,height:2,pixels:new Uint8ClampedArray(16)}]});
        if(!bitmapContext.value)throw new Error('software bitmap consumer context creation failed');
        checkGuestState('software bitmap-context creation');
        // A producing guest instance owns gl_sw_front. Pass the actual shared
        // descriptor explicitly rather than consulting renderer-instance globals.
        const front=e.guest_to_wasm(e.guest_alloc(32))>>>0,bits=e.guest_to_wasm(e.guest_alloc(24))>>>0;
        const frontView=new DataView(memory.buffer),raw=new Uint8Array(memory.buffer,bits,24);
        new Uint8Array(memory.buffer,front,32).fill(0);
        frontView.setUint16(front+12,2,true);frontView.setUint16(front+14,2,true);
        frontView.setUint16(front+16,32,true);frontView.setUint16(front+18,12,true); // padded rows
        frontView.setUint32(front+20,bits,true);
        raw.set([3,5,7,0,11,13,17,0,99,99,99,99,19,23,29,0,31,37,41,0,88,88,88,88]);
        await glBatch([{name:'wglMakeCurrent',aux:1,args:[1,swContext.value]},{name:'gpuPresent'}],glSoftware,{softwareFront:front});
        if(softwareFrames.length!==1)throw new Error('software GL did not publish its guest front');
        const expectedSoftware=[7,5,3,255,17,13,11,255,29,23,19,255,41,37,31,255];
        same([softwareFrames[0].width,softwareFrames[0].height],[2,2],'guest front dimensions');
        same([...softwareFrames[0].pixels],expectedSoftware,'software GL BGRA stride and opaque presentation');
        raw.fill(0); // lease has ended; prior publication must own a snapshot
        await glBatch([{name:'gpuPresent'}],glSoftware,{softwareFront:front});
        same([...softwareFrames[0].pixels],expectedSoftware,'software GL published pixels survive guest reuse');
        same([...softwareFrames[1].pixels],Array.from({length:16},(_,i)=>i%4===3?255:0),'software GL reads next leased front');
        checkGuestState('software presentation');
        await glSoftware.terminate();
        checkGuestState('software endpoint retirement');guestState.set(savedGuestState);
        if(adoptions!==0||terminations!==0)throw new Error('software GL close retired its peers');
        const glide=[await glidePool('webgl'),await glidePool('software')];
        await software.issue(OP.CLEAR,{color:[1,0,1,1],flags:1});
        const survivor=await software.issue(OP.PRESENT);same([...survivor.pixels.slice(0,4)],[255,0,255,255],'surviving software device');
        await glBatch([{name:'glGetIntegerv',args:[0x0d33,query]}]);
        await software.port.terminate();await gl.terminate();
        const stopped=await manager.stop();await manager.stop();
        if(workers!==1||terminations!==1||adoptions!==1)throw new Error('physical worker/heap lifecycle counts '+[workers,terminations,adoptions]);
        return {workers,terminations,adoptions,maxTexture,frames:frames.length,softwareGlFrames:softwareFrames.length,gpuTexturedDraws:2,
          glide,heapHead:stopped.heapHead,heapAdopted:stopped.heapAdopted};
      }finally{for(const bitmap of bitmaps)bitmap?.close();await manager.stop();}
    });
    assert.strictEqual(result.workers,1);assert.strictEqual(result.adoptions,1);assert.strictEqual(result.frames,2);
    assert.strictEqual(result.softwareGlFrames,2);
    assert.strictEqual(result.gpuTexturedDraws,2);
    assert.deepStrictEqual(result.glide.map(run=>[run.backend,run.slots,run.readbacks]),[['webgl',3,2],['software',3,2]]);
    console.log('PASS actual shared worker GL + D3D9 + Glide WebGL/native software:',JSON.stringify(result));
  }finally{if(browser)await browser.close();await closeServer(server);}
})().catch(error=>{console.error(error);process.exitCode=1;});
