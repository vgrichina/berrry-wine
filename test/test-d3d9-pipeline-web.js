#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { startStaticServer } = require('./static-server');
const path = require('path');
const puppeteer = require('puppeteer');
const { compileSrcWasm } = require('./compile-src');
(async () => {
  const methods = ['CreateVertexShader','CreatePixelShader','SetVertexShader','SetPixelShader',
    'SetVertexShaderConstantF','SetPixelShaderConstantF','SetFVF','SetRenderState','SetTexture',
    'CreateVertexDeclaration','SetVertexDeclaration','GetVertexDeclaration','GetFVF','GetDeviceCaps',
    'SetStreamSource','SetIndices','DrawPrimitive','DrawPrimitiveUP','Present','GetViewport','SetViewport',
    'SetTransform','SetTextureStageState'];
  const extra = `
    (func (export "clear_target") (param $d i32) (param $color i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0x3f800000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
      (call $handle_IDirect3DDevice9_Clear (local.get $d) (i32.const 0) (i32.const 0)
        (i32.const 1) (local.get $color) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "compressed_create") (param $d i32) (param $out i32) (param $format i32) (result i32)
      (call $d3d9_texture_create (local.get $d) (i32.const 4) (i32.const 4) (i32.const 1)
        (i32.const 0) (local.get $format) (i32.const 1) (local.get $out)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "cube_create") (param $d i32) (param $out i32) (result i32)
      (call $d3d9_texture_create_kind (local.get $d) (i32.const 2) (i32.const 2) (i32.const 0)
        (i32.const 0) (i32.const 21) (i32.const 1) (local.get $out) (i32.const 5)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "cube_lock") (param $t i32) (param $face i32) (param $level i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0))
      (call $handle_IDirect3DCubeTexture9_LockRect (local.get $t) (local.get $face) (local.get $level)
        (local.get $out) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "cube_unlock") (param $t i32) (param $face i32) (param $level i32) (result i32)
      (call $handle_IDirect3DCubeTexture9_UnlockRect (local.get $t) (local.get $face) (local.get $level)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "cube_lod") (param $t i32) (param $level i32) (result i32)
      (call $handle_IDirect3DCubeTexture9_SetLOD (local.get $t) (local.get $level) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "sampler_state") (param $d i32) (param $type i32) (param $value i32) (result i32)
      (call $handle_IDirect3DDevice9_SetSamplerState (local.get $d) (i32.const 0) (local.get $type)
        (local.get $value) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "event_query") (param $d i32) (param $out i32) (result i32)
      (local $q i32)
      (call $d3d9_query_create (local.get $d) (i32.const 8) (local.get $out))
      (if (i32.load offset=0 (global.get $reg_base)) (then (return (i32.load offset=0 (global.get $reg_base)))))
      (local.set $q (call $gl32 (local.get $out)))
      (call $handle_IDirect3DQuery9_Issue (local.get $q) (i32.const 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (if (i32.load offset=0 (global.get $reg_base)) (then (return (i32.load offset=0 (global.get $reg_base)))))
      (call $handle_IDirect3DQuery9_GetData (local.get $q) (local.get $out) (i32.const 4) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "buffer") (param $d i32) (param $out i32) (param $index i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
      (if (local.get $index) (then
        (call $handle_IDirect3DDevice9_CreateIndexBuffer (local.get $d) (i32.const 8) (i32.const 0)
          (i32.const 101) (i32.const 1) (i32.const 0)))
      (else
        (call $handle_IDirect3DDevice9_CreateVertexBuffer (local.get $d) (i32.const 96) (i32.const 0)
          (i32.const 0x4102) (i32.const 1) (i32.const 0)))) (i32.load offset=0 (global.get $reg_base)))
    (func (export "buffer_lock") (param $b i32) (param $out i32) (result i32)
      (call $handle_IDirect3DBuffer9_Lock (local.get $b) (i32.const 0) (i32.const 0)
        (local.get $out) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "buffer_unlock") (param $b i32) (result i32)
      (call $handle_IDirect3DBuffer9_Unlock (local.get $b) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "buffer_draw") (param $d i32) (param $base i32) (param $min i32)
      (param $num i32) (param $start i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $start))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 1))
      (call $handle_IDirect3DDevice9_DrawIndexedPrimitive (local.get $d) (i32.const 4)
        (local.get $base) (local.get $min) (local.get $num) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "indexed") (param $d i32) (param $v i32) (param $indices i32)
      (param $format i32) (param $min i32) (param $num i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $indices))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $format))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (local.get $v))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (i32.const 24))
      (call $handle_IDirect3DDevice9_DrawIndexedPrimitiveUP (local.get $d) (i32.const 4)
        (local.get $min) (local.get $num) (i32.const 1) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "create_texture") (param $d i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 21))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 1))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateTexture (local.get $d) (i32.const 1) (i32.const 1)
        (i32.const 1) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "create_bump_texture") (param $d i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 62))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 1))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateTexture (local.get $d) (i32.const 1) (i32.const 1)
        (i32.const 1) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "texture_desc") (param $t i32) (param $out i32) (result i32)
      (call $handle_IDirect3DTexture9_GetLevelDesc (local.get $t) (i32.const 0) (local.get $out)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "lock_texture") (param $t i32) (param $out i32) (result i32)
      (call $handle_IDirect3DTexture9_LockRect (local.get $t) (i32.const 0) (local.get $out)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "unlock_texture") (param $t i32) (result i32)
      (call $handle_IDirect3DTexture9_UnlockRect (local.get $t) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "create_device") (param $pp i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $pp))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $out))
      (call $handle_IDirect3D9_CreateDevice (i32.const 0) (i32.const 0) (i32.const 1)
        (i32.const 1) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "target_bits") (param $device i32) (result i32)
      (load.field DxObject misc1 (call $d3ddev_rt_entry (local.get $device))))
    ;; Present no longer copies the GL target into the DIB; this is the
    ;; readback LockRect and GetDC issue, so the test reads what a guest would.
    (func (export "sync_target") (param $device i32) (result i32)
      (call $d3d9_backbuffer_dc_sync (local.get $device) (i32.const 0)))
    ${methods.map(name => `(func (export "${name}") (param $a i32) (param $b i32) (param $c i32)
      (param $d i32) (param $f i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_IDirect3DDevice9_${name} (local.get $a) (local.get $b) (local.get $c)
        (local.get $d) (local.get $f) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))`).join('\n')}`;
  const bytes = compileSrcWasm((file, source) => file === '13-exports.wat' ? source+'\n'+extra : source);
  // This endpoint serves only an empty isolated test document, not repo files.
  const server = await startStaticServer({ root: path.join(__dirname, '..'), handleRequest(req,res) {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp' }); res.end('<!doctype html><title>D3D9 pipeline test</title>');
    return true;
  } });
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true,
      executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-first-run','--no-default-browser-check'] });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    for (const file of ['gpu-backend.js','d3d9-shader.js','d3d-shader-ir.js','d3d9-fixed.js','d3d9-texture.js','d3d9-backend.js','d3d-command-stream.js','d3d9-host.js'])
      await page.addScriptTag({ path: path.join(__dirname,'../lib',file) });
    const result = await page.evaluate(async base64 => {
      const bytes = Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
      const module = await WebAssembly.compile(bytes);
      const memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
      const host = {memory};
      for(const i of WebAssembly.Module.imports(module)) if(i.kind==='function') host[i.name]=()=>0;
      let backingRequests=0,repaintRequests=0;
      const renderer = {windows:{1:{w:16,h:16,clientRect:{w:16,h:16}}},
        getWindowCanvas(hwnd){if(hwnd!==1)throw new Error('wrong GPU window');backingRequests++;},
        scheduleRepaint(){repaintRequests++;}};
      let e, presents=0;
      const bridge = new D3D9Host.Bridge({getMemory:()=>memory.buffer,
        getExports:()=>e,
        enableProgrammable:true,guestToWasm:p=>e.guest_to_wasm(p)>>>0,renderer:()=>renderer,onPresent:()=>presents++});
      host.gpu_gl_call=(op,ptr,aux)=>op===0x30000 ? D3D9Shader.validateMemory(memory.buffer,ptr,aux)
        : (op>=0x30001&&op<=0x30006)||op===0x30016 ? bridge.call(op,ptr,aux) : 0;
      host.get_window_client_size=()=>16|(16<<16);
      e=(await WebAssembly.instantiate(module,{host})).exports;
      e.init_dx_com_thunks();
      const write=(p,words)=>words.forEach((v,i)=>e.guest_write32(p+i*4,v));
      const pp=0x00408000,out=pp+256,vsCode=pp+512,psCode=pp+1024,vptr=pp+2048,cptr=pp+4096;
      write(pp,[16,16,22,1,0,0,1,1,1,0,0,0,0,0x80000000]); // IMMEDIATE: synchronous pixel fixture
      const calls=[]; calls.push(e.create_device(pp,out)); const device=e.guest_read32(out)>>>0;
      calls.push(e.GetDeviceCaps(device,cptr));
      const caps=[152,156,188,192,196,200,204].map(offset=>e.guest_read32(cptr+offset)>>>0);
      write(vsCode,[0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0xa0e40000,0xffff]);
      write(psCode,[0xffff0101,5,0x800f0000,0x90e40000,0xa0e40000,0xffff]);
      calls.push(e.CreateVertexShader(device,vsCode,out)); const vs=e.guest_read32(out)>>>0;
      calls.push(e.CreatePixelShader(device,psCode,out)); const ps=e.guest_read32(out)>>>0;
      calls.push(e.SetVertexShader(device,vs),e.SetPixelShader(device,ps),e.SetFVF(device,0x4002));
      const floats=(p,values)=>write(p,Array.from(new Uint32Array(new Float32Array(values).buffer)));
      floats(vptr,[-1,-1,0.25,1,3,-1,0.25,1,-1,3,0.25,1]);
      floats(cptr,[0.8,0.4,0.2,1]); calls.push(e.SetVertexShaderConstantF(device,0,cptr,1));
      floats(cptr,[0.5,0.5,0.5,1]); calls.push(e.SetPixelShaderConstantF(device,0,cptr,1));
      calls.push(e.SetRenderState(device,22,1));
      calls.push(e.DrawPrimitiveUP(device,4,1,vptr,16));
      const beforePresent=!!renderer.windows[1]._gpuFrameLayer;
      const eventGpu=bridge.devices.get(device).device.gpu;
      const commandQueue=bridge.devices.get(device).queue;
      const initialQueue=commandQueue.snapshot(), queueOpcodes=[];
      let nativeIRDraws=0,bumpSnapshot=null,mipSnapshot=null;
      const originalExecute=commandQueue.consumer.execute;
      commandQueue.consumer.execute=command=>{
        if(command.version!==D3DCommandStream.VERSION || command.deviceId!==device)
          throw new Error('invalid neutral GPU command identity');
        queueOpcodes.push(command.opcode);
        if(command.opcode===D3DCommandStream.OPCODES.DRAW && command.payload.vertexShader?.irVersion===1)nativeIRDraws++;
        if(command.opcode===D3DCommandStream.OPCODES.DRAW && command.payload.textures?.[0]?.format===62)bumpSnapshot=command.payload;
        if(command.opcode===D3DCommandStream.OPCODES.DRAW && command.payload.textures?.[0]?.baseLOD===1)mipSnapshot=command.payload.textures[0];
        const finishesBefore=eventFinishes,result=originalExecute(command);
        commandFinishes.push([command.opcode,eventFinishes>finishesBefore,!!result?.value?.error]);
        return result;
      };
      const commandFinishes=[];
      let eventFinishes=0;const originalFinish=eventGpu.finish.bind(eventGpu);
      eventGpu.finish=()=>{eventFinishes++;originalFinish();};
      calls.push(e.event_query(device,out));const eventComplete=e.guest_read32(out);
      const queryFinishes=eventFinishes;
      calls.push(e.Present(device));
      const ptr=e.target_bits(device)>>>0;
      const px=index=>{
        if(e.sync_target(device)!==1)throw new Error('target readback did not complete synchronously');
        return Array.from(new Uint8Array(memory.buffer,ptr+index*4,4));
      };
      const pixel=px((8*16+8));
      calls.push(e.clear_target(device,0xff010203));
      write(vsCode,[0xfffe0101,31,0x80000000,0x900f0000,31,0x80000005,0x900f0001,
        1,0xc00f0000,0x90e40000,1,0xe00f0000,0x90e40001,1,0xd00f0000,0xa0e40000,0xffff]);
      write(psCode,[0xffff0101,66,0xb00f0000,5,0x800f0000,0xb0e40000,0x90e40000,0xffff]);
      calls.push(e.CreateVertexShader(device,vsCode,out));const texturedVS=e.guest_read32(out)>>>0;
      calls.push(e.CreatePixelShader(device,psCode,out));const texturedPS=e.guest_read32(out)>>>0;
      calls.push(e.SetVertexShader(device,texturedVS),e.SetPixelShader(device,texturedPS),e.SetFVF(device,0x4102));
      floats(vptr,[-1,-1,0.25,1,0.5,0.5,3,-1,0.25,1,0.5,0.5,-1,3,0.25,1,0.5,0.5]);
      floats(cptr,[0.5,0.25,1,1]);calls.push(e.SetVertexShaderConstantF(device,0,cptr,1));
      calls.push(e.create_texture(device,out));const texture=e.guest_read32(out)>>>0;
      calls.push(e.lock_texture(texture,out));const bits=e.guest_read32(out+4)>>>0;
      e.guest_write32(bits,0xffc8a050);
      calls.push(e.unlock_texture(texture),e.SetTexture(device,0,texture),e.DrawPrimitiveUP(device,4,1,vptr,24),e.Present(device));
      const texturedPixel=px((8*16+8));
      const iptr=cptr+256;
      // Prefix an unused vertex; index rebasing must preserve the three real UVs.
      floats(vptr,[0,0,0,0,0,0,-1,-1,0.25,1,0.5,0.5,3,-1,0.25,1,0.5,0.5,-1,3,0.25,1,0.5,0.5]);
      write(iptr,[0x00020001,3]);
      floats(cptr,[1,0.5,0.25,1]);calls.push(e.SetVertexShaderConstantF(device,0,cptr,1));
      calls.push(e.indexed(device,vptr,iptr,101,1,3),e.Present(device));
      const indexedPixel=px((8*16+8));
      // A real >65535 index checks that INDEX32 is not silently narrowed.
      const high=65536,highVertices=0x00800000;
      floats(highVertices+high*24,[-1,-1,0.25,1,0.5,0.5,3,-1,0.25,1,0.5,0.5,-1,3,0.25,1,0.5,0.5]);
      write(iptr,[high,high+1,high+2]);
      floats(cptr,[0.25,1,0.5,1]);calls.push(e.SetVertexShaderConstantF(device,0,cptr,1));
      calls.push(e.indexed(device,highVertices,iptr,102,high,3),e.Present(device));
      const indexed32Pixel=px((8*16+8));
      const invalid=e.indexed(device,highVertices,iptr,102,high+1,2)>>>0;
      const invalidMessage=bridge.lastError&&bridge.lastError.message;
      calls.push(e.buffer(device,out,0));const vb=e.guest_read32(out)>>>0;
      calls.push(e.buffer(device,out,1));const ib=e.guest_read32(out)>>>0;
      calls.push(e.buffer_lock(vb,out));const vbBits=e.guest_read32(out)>>>0;
      floats(vbBits,[0,0,0,0,0,0,-1,-1,0.25,1,0.5,0.5,3,-1,0.25,1,0.5,0.5,-1,3,0.25,1,0.5,0.5]);
      calls.push(e.buffer_unlock(vb),e.buffer_lock(ib,out));const ibBits=e.guest_read32(out)>>>0;
      write(ibBits,[0x00029999,0x00040003]); // unused prefix; indices 2,3,4
      calls.push(e.buffer_unlock(ib),e.SetStreamSource(device,0,vb,24,24),e.SetIndices(device,ib));
      floats(cptr,[1,1,1,1]);calls.push(e.SetVertexShaderConstantF(device,0,cptr,1));
      // Offset=24, base=-2 and min=2 jointly address the three real vertices.
      calls.push(e.buffer_draw(device,-2,2,3,1),e.Present(device));
      const bufferPixel=px((8*16+8));
      const badBufferRange=e.buffer_draw(device,-3,2,3,1)>>>0;
      const badIndexRange=e.buffer_draw(device,-2,2,3,2)>>>0;
      calls.push(e.buffer_lock(vb,out));const lockedDraw=e.buffer_draw(device,-2,2,3,1)>>>0;
      calls.push(e.buffer_unlock(vb));
      calls.push(e.SetStreamSource(device,0,vb,0,24),e.DrawPrimitive(device,4,1,1),e.Present(device));
      // Declare UV before position: the VS DCL semantics, not array order,
      // must bind the correct registers. Declaration owns an immutable copy.
      const declPtr=cptr+512;
      write(declPtr,[16<<16,0x00050001,0,3,255,17]);
      calls.push(e.CreateVertexDeclaration(device,declPtr,out));const declaration=e.guest_read32(out)>>>0;
      write(declPtr,[0,0,0,0,0,0]);
      calls.push(e.SetVertexDeclaration(device,declaration),e.GetVertexDeclaration(device,out));
      const declarationIdentity=(e.guest_read32(out)>>>0)===declaration;
      calls.push(e.GetFVF(device,out));const declarationFVF=e.guest_read32(out);
      floats(cptr,[0.5,0.5,0.5,1]);calls.push(e.SetVertexShaderConstantF(device,0,cptr,1));
      calls.push(e.DrawPrimitive(device,4,1,1),e.Present(device));
      const declarationPixel=px((8*16+8));
      // Same TEX instruction, specialized from the actual bound resource type.
      calls.push(e.cube_create(device,out));const cube=e.guest_read32(out)>>>0;
      const cubeColors=[0xffff0000,0xff00ff00,0xff0000ff,0xffffff00,0xffff00ff,0xff00ffff];
      for(let face=0;face<6;face++)for(let level=0;level<2;level++){
        calls.push(e.cube_lock(cube,face,level,out));const p=e.guest_read32(out+4)>>>0;
        for(let i=0;i<(level?1:4);i++)e.guest_write32(p+i*4,level?0xff804020:cubeColors[face]);
        calls.push(e.cube_unlock(cube,face,level));
      }
      calls.push(e.SetFVF(device,0x14102),e.SetTexture(device,0,cube)); // FLOAT3 texcoord
      floats(cptr,[1,1,1,1]);calls.push(e.SetVertexShaderConstantF(device,0,cptr,1));
      const cubePixels=[];
      const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      for(const direction of directions){
        floats(vptr,[-1,-1,0.25,1,...direction,3,-1,0.25,1,...direction,-1,3,0.25,1,...direction]);
        calls.push(e.DrawPrimitiveUP(device,4,1,vptr,28),e.Present(device));
        cubePixels.push(px((8*16+8)));
      }
      calls.push(e.cube_lod(cube,1),e.DrawPrimitiveUP(device,4,1,vptr,28),e.Present(device));
      const cubeMipPixel=px((8*16+8));
      calls.push(e.sampler_state(device,4,0xff123456),e.sampler_state(device,8,0xbf400000),e.sampler_state(device,9,1));
      const badMipBias=e.sampler_state(device,8,0x7fc00000)>>>0;
      const unsupportedMipState=e.DrawPrimitiveUP(device,4,1,vptr,28)>>>0;
      // Reset both guest resource/sampler state after submission: retained draw
      // metadata must still describe the earlier SetLOD and float-bit states.
      e.cube_lod(cube,0);
      calls.push(e.sampler_state(device,4,0),e.sampler_state(device,8,0),e.sampler_state(device,9,0));
      const capturedMip={originalWidth:mipSnapshot.originalWidth,originalHeight:mipSnapshot.originalHeight,
        baseLOD:mipSnapshot.baseLOD,width:mipSnapshot.width,height:mipSnapshot.height,levels:mipSnapshot.levels.length,
        borderColor:mipSnapshot.sampler.borderColor,lodBias:mipSnapshot.sampler.lodBias,maxMipLevel:mipSnapshot.sampler.maxMipLevel};
      calls.push(e.cube_lod(cube,1)); // preserve the later viewport fixture's residency
      calls.push(e.SetTexture(device,0,texture),e.SetFVF(device,0x4102));
      floats(vptr,[-1,-1,0.25,1,0.5,0.5,3,-1,0.25,1,0.5,0.5,-1,3,0.25,1,0.5,0.5]);
      calls.push(e.DrawPrimitiveUP(device,4,1,vptr,24),e.Present(device));
      const restored2DPixel=px((8*16+8));
      write(vsCode,[0xfffe0101,1,0xc00f0000,0x90e40000,
        1,0xe00f0000,0xa0e40000,1,0xe00f0001,0xa0e40001,0xffff]);
      write(psCode,[0xffff0101,66,0xb00f0000,66,0xb00f0001,
        5,0x800f0000,0xb0e40000,0xb0e40001,0xffff]);
      calls.push(e.CreateVertexShader(device,vsCode,out));const mixedVS=e.guest_read32(out)>>>0;
      calls.push(e.CreatePixelShader(device,psCode,out));const mixedPS=e.guest_read32(out)>>>0;
      calls.push(e.SetVertexShader(device,mixedVS),e.SetPixelShader(device,mixedPS));
      const mixedPixels=[];
      for(const reverse of [false,true]){
        calls.push(e.SetTexture(device,0,reverse?texture:cube),e.SetTexture(device,1,reverse?cube:texture));
        floats(cptr,reverse?[0.5,0.5,0,1,1,0,0,1]:[1,0,0,1,0.5,0.5,0,1]);
        calls.push(e.SetVertexShaderConstantF(device,0,cptr,2),e.DrawPrimitiveUP(device,4,1,vptr,24),e.Present(device));
        mixedPixels.push(px((8*16+8)));
      }
      const viewportPtr=cptr+800;
      e.guest_write32(viewportPtr+24,0x12345678);
      calls.push(e.GetViewport(device,viewportPtr));
      const initialViewport=Array.from({length:7},(_,i)=>e.guest_read32(viewportPtr+i*4)>>>0);
      write(viewportPtr,[4,2,6,4]);floats(viewportPtr+16,[0.2,0.8]);
      calls.push(e.SetViewport(device,viewportPtr));
      write(viewportPtr,[4,2,20,4]);
      const invalidViewport=e.SetViewport(device,viewportPtr)>>>0;
      calls.push(e.GetViewport(device,viewportPtr));
      const viewport=Array.from({length:6},(_,i)=>e.guest_read32(viewportPtr+i*4)>>>0);
      calls.push(e.SetVertexShader(device,texturedVS),e.SetPixelShader(device,texturedPS),
        e.SetTexture(device,0,texture),e.SetRenderState(device,7,0));
      floats(cptr,[1,0,0,1]);calls.push(e.SetVertexShaderConstantF(device,0,cptr,1));
      calls.push(e.DrawPrimitiveUP(device,4,1,vptr,24),e.Present(device));
      const viewportPixels=[px((3*16+6)),
        px((3*16+2))];
      // Null shaders select real fixed-function state, not replacement bytecode.
      write(viewportPtr,[0,0,16,16]);floats(viewportPtr+16,[0,1]);
      calls.push(e.SetViewport(device,viewportPtr),e.SetVertexShader(device,0),e.SetPixelShader(device,0),
        e.SetFVF(device,0x142),e.SetRenderState(device,137,0),e.SetRenderState(device,28,0),
        e.SetRenderState(device,29,0),e.SetRenderState(device,15,0),e.SetRenderState(device,27,0));
      for(const [stage,state,value] of [[0,1,4],[0,2,2],[0,3,0],[0,4,2],[0,5,0],
          [0,11,0],[0,24,0],[1,1,1]])calls.push(e.SetTextureStageState(device,stage,state,value));
      const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
      floats(cptr,identity);
      for(const transform of [2,3,256])calls.push(e.SetTransform(device,transform,cptr));
      // Translate deliberately offscreen vertices back into clip space.
      floats(cptr,[1,0,0,0,0,1,0,0,0,0,1,0,-10,0,0,1]);
      calls.push(e.SetTransform(device,256,cptr));
      for(const [i,x,y] of [[0,9,-1],[1,13,-1],[2,9,3]]){
        floats(vptr+i*24,[x,y,0.25]);e.guest_write32(vptr+i*24+12,0xff8040ff);
        floats(vptr+i*24+16,[0.5,0.5]);
      }
      calls.push(e.DrawPrimitiveUP(device,4,1,vptr,24),e.Present(device));
      const fixedPixel=px((8*16+8));
      // POSITIONT ignores those transforms and uses absolute viewport coordinates.
      calls.push(e.SetFVF(device,0x144),e.SetRenderState(device,22,3));
      for(const [i,x,y] of [[0,2,2],[1,14,2],[2,2,14]]){
        floats(vptr+i*28,[x,y,0.5,1]);e.guest_write32(vptr+i*28+16,0x8000ff00);
        floats(vptr+i*28+20,[0.5,0.5]);
      }
      calls.push(e.SetRenderState(device,15,1),e.SetRenderState(device,25,5),e.SetRenderState(device,24,200),
        e.DrawPrimitiveUP(device,4,1,vptr,28),e.Present(device));
      const alphaRejected=px((4*16+4));
      calls.push(e.SetRenderState(device,24,100),e.DrawPrimitiveUP(device,4,1,vptr,28),e.Present(device));
      const transformedPixel=px((4*16+4));
      const transformedOutside=px((14*16+14));
      calls.push(e.SetRenderState(device,22,2));
      for(let i=0;i<3;i++)e.guest_write32(vptr+i*28+16,0xff0000ff);
      calls.push(e.DrawPrimitiveUP(device,4,1,vptr,28),e.Present(device));
      const culledPixel=px((4*16+4));
      calls.push(e.SetRenderState(device,22,3));
      for(let i=0;i<3;i++)e.guest_write32(vptr+i*28+16,0x8000ff00);
      calls.push(e.SetTexture(device,0,0),e.DrawPrimitiveUP(device,4,1,vptr,28),e.Present(device));
      const untexturedPixel=px((4*16+4));
      // A 2x2 one-level texture with MIPFILTER enabled remains complete.
      const gpuDevice=bridge.devices.get(device).device;
      gpuDevice.uploadTexture(0,{width:2,height:2,pixels:new Uint8Array(16).fill(255),
        sampler:{mip:2}});
      const singleLevelFilter=gpuDevice.gpu.gl.getTexParameter(gpuDevice.gpu.gl.TEXTURE_2D,
        gpuDevice.gpu.gl.TEXTURE_MIN_FILTER);
      const compressedPixels=[];
      for(const format of [0x31545844,0x33545844,0x35545844]){
        calls.push(e.compressed_create(device,out,format));const t=e.guest_read32(out)>>>0;
        calls.push(e.lock_texture(t,out));const bits=e.guest_read32(out+4)>>>0;
        if(format===0x31545844)write(bits,[0x0000f800,0]);
        // DXT3's alpha is sixteen explicit nibbles, so 0x8 replicates to 0x88.
        else if(format===0x33545844)write(bits,[0x88888888,0x88888888,0x000007e0,0]);
        else write(bits,[128,0,0x000007e0,0]);
        calls.push(e.unlock_texture(t),e.SetTexture(device,0,t),e.SetTextureStageState(device,0,5,2));
        for(let i=0;i<3;i++)e.guest_write32(vptr+i*28+16,0xffffffff);
        calls.push(e.DrawPrimitiveUP(device,4,1,vptr,28),e.Present(device));
        compressedPixels.push(px((4*16+4)));
      }
      // The uncompressed widths B&W2's land asks for -- one byte (L8), two
      // (R5G6B5, A4R4G4B4) and three (R8G8B8) -- through the same real GPU path, so
      // each decode is covered end to end and not only as a unit conversion.
      // Every texture is uniform, so the sampled texel is the whole picture.
      const narrowPixels=[];
      for(const [format,words] of [[50,Array(4).fill(0x40404040)],
        [23,Array(8).fill(0x07e007e0)],
        [20,[0x00ff0000,0x0000ff00,0xff0000ff,0x00ff0000,0x0000ff00,0xff0000ff,
             0x00ff0000,0x0000ff00,0xff0000ff,0x00ff0000,0x0000ff00,0xff0000ff]],
        [26,Array(8).fill(0x8f408f40)]]){
        calls.push(e.compressed_create(device,out,format));const t=e.guest_read32(out)>>>0;
        calls.push(e.lock_texture(t,out));write(e.guest_read32(out+4)>>>0,words);
        calls.push(e.unlock_texture(t),e.SetTexture(device,0,t),e.SetTextureStageState(device,0,5,2));
        for(let i=0;i<3;i++)e.guest_write32(vptr+i*28+16,0xffffffff);
        calls.push(e.DrawPrimitiveUP(device,4,1,vptr,28),e.Present(device));
        narrowPixels.push(px((4*16+4)));
      }
      calls.push(e.SetRenderState(device,28,1));
      const fixedFog=e.DrawPrimitiveUP(device,4,1,vptr,28)>>>0;
      // Native CreateTexture/LockRect and TSS float-bit state through immutable
      // Bridge/command serialization, then real GPU TEXBEML and canonical BGRA.
      calls.push(e.SetRenderState(device,28,0),e.SetRenderState(device,7,0),e.SetRenderState(device,15,0),e.SetRenderState(device,22,1));
      write(vsCode,[0xfffe0101,1,0xc00f0000,0x90e40000,
        1,0xe00f0000,0xa0e40000,1,0xe00f0001,0xa0e40000,0xffff]);
      write(psCode,[0xffff0101,66,0xb00f0000,68,0xb00f0001,0xb0e40000,1,0x800f0000,0xb0e40001,0xffff]);
      calls.push(e.CreateVertexShader(device,vsCode,out));const bumpVS=e.guest_read32(out)>>>0;
      calls.push(e.CreatePixelShader(device,psCode,out));const bumpPS=e.guest_read32(out)>>>0;
      calls.push(e.SetVertexShader(device,bumpVS),e.SetPixelShader(device,bumpPS),e.SetFVF(device,0x4002));
      floats(vptr,[-1,-1,.25,1,3,-1,.25,1,-1,3,.25,1]);floats(cptr,[.5,.5,0,1]);
      calls.push(e.SetVertexShaderConstantF(device,0,cptr,1));
      calls.push(e.create_bump_texture(device,out));const bumpTexture=e.guest_read32(out)>>>0;
      calls.push(e.texture_desc(bumpTexture,out));const bumpFormat=e.guest_read32(out)>>>0;
      calls.push(e.lock_texture(bumpTexture,out));const bumpPitch=e.guest_read32(out)>>>0,bumpBits=e.guest_read32(out+4)>>>0;
      write(bumpBits,[0x55ff7f80]);calls.push(e.unlock_texture(bumpTexture));
      calls.push(e.lock_texture(texture,out));const colorBits=e.guest_read32(out+4)>>>0;
      write(colorBits,[0xffffffff]);calls.push(e.unlock_texture(texture),e.SetTexture(device,0,bumpTexture),e.SetTexture(device,1,texture));
      const bumpValues=[.125,.25,.375,.5,.25,.5],bumpIDs=[7,8,9,10,22,23];
      const floatBits=x=>new Uint32Array(new Float32Array([x]).buffer)[0];
      bumpIDs.forEach((id,i)=>calls.push(e.SetTextureStageState(device,1,id,floatBits(bumpValues[i]))));
      calls.push(e.DrawPrimitiveUP(device,4,1,vptr,16),e.Present(device));
      const bumpPixel=px((4*16+4));
      // Reusing guest storage after submission cannot mutate the owned payload.
      calls.push(e.lock_texture(bumpTexture,out));write(e.guest_read32(out+4),[0]);calls.push(e.unlock_texture(bumpTexture));
      bumpIDs.forEach(id=>calls.push(e.SetTextureStageState(device,1,id,0)));
      const bumpCaptured={format:bumpSnapshot.textures[0].format,pixels:Array.from(bumpSnapshot.textures[0].pixels),
        coefficients:Array.from(bumpSnapshot.bumpStates[1])};
      calls.push(e.SetTextureStageState(device,1,7,0x7fc00000));
      const badBump=e.DrawPrimitiveUP(device,4,1,vptr,16)>>>0;
      calls.push(e.SetTextureStageState(device,1,7,0));
      gpuDevice.clear([1,0,0,1],3,.25);
      gpuDevice.clear([0,0,1,1],3,.75,[[1,2,4,5],[10,11,12,14]]);
      const clearGL=eventGpu.gl,clearRGBA=eventGpu.readPixels(0,0,16,16,clearGL.RGBA,clearGL.UNSIGNED_BYTE,new Uint8Array(16*16*4));
      const clearSamples=[[1,2],[3,4],[10,13],[0,0],[4,5]].map(([x,y])=>Array.from(clearRGBA.slice(((15-y)*16+x)*4,((15-y)*16+x+1)*4)));
      const clearDepthValue=clearGL.getParameter(clearGL.DEPTH_CLEAR_VALUE);
      const layer=renderer.windows[1]._gpuFrameLayer;
      const result={calls,caps,pixel,texturedPixel,indexedPixel,indexed32Pixel,bufferPixel,invalid,backingRequests,repaintRequests,
        fixedPixel,alphaRejected,transformedPixel,transformedOutside,culledPixel,fixedFog,untexturedPixel,singleLevelFilter,compressedPixels,narrowPixels,
        cubePixels,cubeMipPixel,restored2DPixel,mixedPixels,initialViewport,viewport,invalidViewport,viewportPixels,
        declarationPixel,declarationIdentity,declarationFVF,badBufferRange,badIndexRange,lockedDraw,
        queryFinishes,eventComplete,beforePresent,presents,hasLayer:!!layer,lastError:invalidMessage,
        initialQueue,nativeIRDraws,bumpFormat,bumpPitch,bumpPixel,bumpCaptured,badBump,capturedMip,badMipBias,unsupportedMipState,clearSamples,clearDepthValue};
      bridge.call(0x30004,0,device);
      result.queue=commandQueue.snapshot();result.queueOpcodes=queueOpcodes;result.gpuFinishes=eventFinishes;result.commandFinishes=commandFinishes;
      return result;
    },bytes.toString('base64'));
    assert.deepStrictEqual(result.calls,result.calls.map(()=>0),JSON.stringify(result));
    assert.deepStrictEqual(result.clearSamples,[[0,0,255,255],[0,0,255,255],[0,0,255,255],[255,0,0,255],[255,0,0,255]],'WebGL rectangle clear top-left coordinates');
    assert.strictEqual(result.clearDepthValue,.75,'WebGL receives nondefault depth clear');
    assert.deepStrictEqual(result.caps,[4,0,1,255,0xfffe0101,96,0xffff0104]); // ps_1_4 since D3D9-PUBLIC-PS14
    assert.strictEqual(result.backingRequests,1,'GPU-only windows acquire their compositor backing');
    assert.strictEqual(result.repaintRequests,result.presents,'every completed present schedules composition');
    assert.strictEqual(result.beforePresent,false,'draw must not publish incomplete frame');
    assert.strictEqual(result.queryFinishes,1,'query executes the actual GPU completion barrier');
    assert.deepStrictEqual([result.initialQueue.submitted,result.initialQueue.consumed,result.initialQueue.completed],[2,2,2],
      'initial clear and draw execute through the neutral queue');
    assert.strictEqual(result.queue.submitted,result.queue.completed,'GPU completion, not only GL issue, advances queue');
    assert.strictEqual(result.queue.consumed,result.queue.completed);
    assert.strictEqual(result.queue.inflight,0);assert.strictEqual(result.queue.bytes,0);assert.strictEqual(result.queue.error,null);
    assert.strictEqual(result.queueOpcodes.filter(op=>op===12).length,result.presents,'every Present uses neutral commands');
    assert.strictEqual(result.queueOpcodes.filter(op=>op===11).length,1,'EVENT uses neutral fence');
    assert.strictEqual(result.queueOpcodes.filter(op=>op===6).length,1,'explicit Clear uses neutral command');
    assert.strictEqual(result.queueOpcodes.at(-1),3,'device destruction is an ordered resource release');
    // Only observation points drain the GPU: fences, readbacks, releases and
    // a command that failed part way. A draw or a Present is issued, not
    // waited for.
    const observed=([op,,failed])=>failed||op===3||op===10||op===11;
    assert.deepStrictEqual(result.commandFinishes.map(([op,finished])=>[op,finished]),
      result.commandFinishes.map(entry=>[entry[0],observed(entry)]),'executor finishes only where completion is observed');
    assert.ok(result.commandFinishes.some(([op,finished,failed])=>op===5&&!finished&&!failed),'draws were issued without a finish');
    assert.ok(result.nativeIRDraws>0,'queued draws retain the WAT-owned IR projection');
    assert.strictEqual(result.eventComplete,1);
    assert.strictEqual(result.presents,31); assert.ok(result.hasLayer);
    // RGBA render targets preserve DXT5 alpha; the opaque default canvas used
    // to replace this with255 during readback.
    assert.deepStrictEqual(result.compressedPixels,[[0,0,255,255],[0,255,0,136],[0,255,0,128]]);
    // L8 reads its one byte on all three channels; R5G6B5's all-ones green
    // field reaches 255, not 252; R8G8B8 is blue-first like every other xRGB;
    // A4R4G4B4 0x8f40 widens each nibble by 17 and keeps its alpha.
    assert.deepStrictEqual(result.narrowPixels,[[64,64,64,255],[0,255,0,255],[0,0,255,255],[0,68,255,136]]);
    assert.deepStrictEqual(result.culledPixel,result.transformedPixel);
    assert.deepStrictEqual(result.untexturedPixel,[0,255,0,128]);
    assert.strictEqual(result.singleLevelFilter,0x2600);
    assert.deepStrictEqual(result.fixedPixel,[80,40,100,255]);
    assert.deepStrictEqual(result.alphaRejected,result.fixedPixel);
    assert.deepStrictEqual(result.transformedOutside,result.fixedPixel);
    // Canonical RGBA/BGRA storage retains the POSITIONT diffuse alpha0x80.
    assert.deepStrictEqual(result.transformedPixel,[0,160,0,128]);
    assert.strictEqual(result.fixedFog,0,'implemented fixed vertex fog is accepted');
    assert.deepStrictEqual(result.initialViewport,[0,0,16,16,0,0x3f800000,0x12345678]);
    assert.strictEqual(result.invalidViewport,0x8876086c);
    assert.deepStrictEqual(result.viewport,[4,2,6,4,0x3e4ccccd,0x3f4ccccd]);
    assert.deepStrictEqual(result.viewportPixels[0],[0,0,200,255]);
    [10,40,100,255].forEach((v,i)=>assert.ok(Math.abs(result.viewportPixels[1][i]-v)<=1));
    for(const pixel of result.mixedPixels)
      [10,40,100,255].forEach((v,i)=>assert.ok(Math.abs(pixel[i]-v)<=1,JSON.stringify(result)));
    assert.deepStrictEqual(result.cubePixels,[[0,0,255,255],[0,255,0,255],[255,0,0,255],
      [0,255,255,255],[255,0,255,255],[255,255,0,255]]);
    assert.deepStrictEqual(result.cubeMipPixel,[32,64,128,255]);
    assert.deepStrictEqual(result.restored2DPixel,[80,160,200,255]);
    [26,51,102,255].forEach((v,i)=>assert.ok(Math.abs(result.pixel[i]-v)<=1,JSON.stringify(result)));
    [80,40,100,255].forEach((v,i)=>assert.ok(Math.abs(result.texturedPixel[i]-v)<=1,JSON.stringify(result)));
    [20,80,200,255].forEach((v,i)=>assert.ok(Math.abs(result.indexedPixel[i]-v)<=1,JSON.stringify(result)));
    [40,160,50,255].forEach((v,i)=>assert.ok(Math.abs(result.indexed32Pixel[i]-v)<=1,JSON.stringify(result)));
    [80,160,200,255].forEach((v,i)=>assert.ok(Math.abs(result.bufferPixel[i]-v)<=1,JSON.stringify(result)));
    [40,80,100,255].forEach((v,i)=>assert.ok(Math.abs(result.declarationPixel[i]-v)<=1,JSON.stringify(result)));
    assert.strictEqual(result.declarationFVF,0);assert.ok(result.declarationIdentity);
    assert.strictEqual(result.invalid,0x8876086c);
    for(const key of ['badBufferRange','badIndexRange','lockedDraw'])assert.strictEqual(result[key],0x8876086c,key);
    assert.match(result.lastError,/index outside declared vertex range/);
    assert.strictEqual(result.bumpFormat,62);assert.strictEqual(result.bumpPitch,4);
    assert.deepStrictEqual(result.bumpCaptured,{format:62,pixels:[128,127,255,85],coefficients:[.125,.25,.375,.5,.25,.5]});
    result.bumpPixel.forEach(v=>assert(Math.abs(v-191)<=1,`bump pixel ${result.bumpPixel}`));
    assert.strictEqual(result.badBump,0x8876086c,'nonfinite native bump state fails explicitly');
    assert.deepStrictEqual(result.capturedMip,{originalWidth:2,originalHeight:2,baseLOD:1,width:1,height:1,levels:1,
      borderColor:0xff123456,lodBias:-.75,maxMipLevel:1});
    assert.strictEqual(result.badMipBias,0x8876086c,'native sampler rejects nonfinite bias without replacing previous state');
    assert.strictEqual(result.unsupportedMipState,0x8876086c,'WebGL rejects unimplemented LOD state rather than ignoring it');
    console.log('PASS full WAT D3D9 shaders/textures + UP/buffer INDEX16/32 draw/present + native bump snapshot -> canonical BGRA pixels');
  } finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
