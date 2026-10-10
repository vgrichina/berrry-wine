#!/usr/bin/env node
// Compare D3D8 sparse-register output through the host decoder on software and WebGL.
'use strict';
const assert = require('assert');
const path=require('node:path'),puppeteer=require('puppeteer');
const { bootRenderHarness } = require('./render-helper');
const { Bridge } = require('../lib/d3d9-host');

const DEVICE_CALLS = ['CreateVertexDeclaration', 'SetVertexDeclaration', 'SetStreamSource',
  'GetStreamSource', 'DrawPrimitive', 'Present', 'SetRenderState', 'CreateVertexShader',
  'CreatePixelShader', 'SetVertexShader', 'SetPixelShader'];

// POSITION as FLOAT3 and COLOR as D3DCOLOR, each element naming its stream.
// D3DVERTEXELEMENT9 is {u16 stream, u16 offset, u8 type, u8 method, u8 usage,
// u8 usageIndex}, and D3DDECL_END is {0xff,0,UNUSED(17),0,0,0}.
const declarationBytes = (colorStream, colorOffset, positionStream = 0) => {
  const bytes = new Uint8Array(24), view = new DataView(bytes.buffer);
  view.setUint16(0, positionStream, true); view.setUint16(2, 0, true);
  bytes.set([2, 0, 0, 0], 4);                       // FLOAT3 DEFAULT POSITION0
  view.setUint16(8, colorStream, true); view.setUint16(10, colorOffset, true);
  bytes.set([4, 0, 10, 0], 12);                     // D3DCOLOR DEFAULT COLOR0
  view.setUint16(16, 0xff, true); bytes.set([17, 0, 0, 0], 20);
  return bytes;
};

(async () => {
  let bridge;
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none',
    extraHostOverrides: { gpu_gl_call: (op, p, a) => bridge.call(op, p, a) },
    extraWat: `
    (global $vs8_test_stack (mut i32) (i32.const 0))
    (func (export "set_test_stack") (param $p i32) (global.set $vs8_test_stack (local.get $p)))
    (func (export "stream_token") (result i32) (global.get $D3D8_DECL_TOKEN_STREAM))
    (func (export "create_vs8") (param $device i32) (param $decl i32) (param $fn i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (global.get $vs8_test_stack))
      (call $handle_IDirect3DDevice8_CreateVertexShader (local.get $device) (local.get $decl) (local.get $fn) (local.get $out) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "bind_vs8") (param $device i32) (param $handle i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (global.get $vs8_test_stack))
      (call $handle_IDirect3DDevice8_SetVertexShader (local.get $device) (local.get $handle) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "create_device") (param $pp i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (global.get $vs8_test_stack))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $pp))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $out))
      (call $handle_IDirect3D9_CreateDevice (i32.const 0) (i32.const 0) (i32.const 1)
        (i32.const 1) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "target_bits") (param $d i32) (result i32)
      (load.field DxObject misc1 (call $d3ddev_rt_entry (local.get $d))))
    (func (export "create_buffer") (param $d i32) (param $length i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (global.get $vs8_test_stack))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateVertexBuffer (local.get $d) (local.get $length)
        (i32.const 0) (i32.const 0x42) (i32.const 1) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "clear_target") (param $d i32) (param $color i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (global.get $vs8_test_stack))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
      (call $handle_IDirect3DDevice9_Clear (local.get $d) (i32.const 0) (i32.const 0)
        (i32.const 1) (local.get $color) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    ${[['Buffer9', 'Lock'], ['Buffer9', 'Unlock']].map(([type, n]) => `
      (func (export "${type}_${n}") (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $f i32) (result i32)
        (i32.store offset=16 (global.get $reg_base) (global.get $vs8_test_stack))
        (call $handle_IDirect3D${type}_${n} (local.get $a) (local.get $b) (local.get $c) (local.get $d) (local.get $f) (i32.const 0))
        (i32.load offset=0 (global.get $reg_base)))`).join('\n')}
    ${DEVICE_CALLS.map(n => `(func (export "${n}") (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $f i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (global.get $vs8_test_stack))
      (call $handle_IDirect3DDevice9_${n} (local.get $a) (local.get $b) (local.get $c) (local.get $d) (local.get $f) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))`).join('\n')}
  ` });
  bridge = new Bridge({ backend: 'software', enableProgrammable: true,
    getExports: () => e, getMemory: () => memory.buffer,
    guestToWasm: p => e.guest_to_wasm(p) >>> 0 });
  e.init_dx_com_thunks();
  e.set_test_stack(e.guest_alloc(64));

  const view = new DataView(memory.buffer);
  const wa = guest => e.guest_to_wasm(guest) >>> 0;
  const alloc = bytes => e.guest_alloc(bytes) >>> 0;
  const ok = (result, what) => assert.strictEqual(result >>> 0, 0,
    `${what} (0x${(result >>> 0).toString(16)})${bridge.lastError ? ' ' + bridge.lastError : ''}`);
  const out = alloc(4);

  // An 8x8 A8R8G8B8 windowed device with a real automatic D24X8 attachment,
  // and D3DPRESENT_INTERVAL_IMMEDIATE so the pixels are readable synchronously.
  const parameters = alloc(64);
  new Uint8Array(memory.buffer, wa(parameters), 64).fill(0);
  [8, 8, 21, 1, 0, 0, 1, 1, 1].forEach((v, i) => e.guest_write32(parameters + i * 4, v));
  e.guest_write32(parameters + 36, 1);
  e.guest_write32(parameters + 40, 77);
  e.guest_write32(parameters + 52, 0x80000000);
  ok(e.create_device(parameters, out), 'CreateDevice');
  const device = e.guest_read32(out) >>> 0;

  const shader = (tokens, pixel) => {
    const guest = alloc(tokens.length * 4);
    new Uint32Array(memory.buffer, wa(guest), tokens.length).set(tokens);
    ok(e[pixel ? 'CreatePixelShader' : 'CreateVertexShader'](device, guest, out, 0, 0),
      `Create${pixel ? 'Pixel' : 'Vertex'}Shader`);
    ok(e[pixel ? 'SetPixelShader' : 'SetVertexShader'](device, e.guest_read32(out) >>> 0, 0, 0, 0),
      `Set${pixel ? 'Pixel' : 'Vertex'}Shader`);
  };
  // Position straight through, colour straight through: the picture is the
  // vertex colour, so a colour fetched from the wrong place shows up as pixels.
  shader([0xfffe0101, 1, 0xc00f0000, 0x90e40000, 1, 0xd00f0000, 0x90e40001, 0xffff], false);
  shader([0xffff0101, 1, 0x800f0000, 0x90e40000, 0xffff], true);
  ok(e.SetRenderState(device, 22, 1, 0, 0), 'disable culling'); // D3DRS_CULLMODE = NONE
  ok(e.SetRenderState(device, 7, 0, 0, 0), 'disable z'); // D3DRS_ZENABLE

  const CORNERS = [[-1, 1, 0.25], [1, 1, 0.25], [-1, -1, 0.25]];
  const COLOR = 0xff2040c0;
  // One buffer holding position+colour interleaved, and two holding the same
  // data split across a pair of streams. The split pair uses a deliberately
  // DIFFERENT stride from the interleaved buffer (12 and 4 against 16), so a
  // renderer that reused stream 0's stride for stream 1 reads the wrong bytes.
  const fill = (length, write) => {
    ok(e.create_buffer(device, length, out), `CreateVertexBuffer(${length})`);
    const buffer = e.guest_read32(out) >>> 0;
    ok(e.Buffer9_Lock(buffer, 0, 0, out, 0), 'Lock');
    write(wa(e.guest_read32(out) >>> 0));
    ok(e.Buffer9_Unlock(buffer, 0, 0, 0, 0), 'Unlock');
    return buffer;
  };
  const interleaved = fill(48, at => CORNERS.forEach((corner, i) => {
    corner.forEach((c, j) => view.setFloat32(at + i * 16 + j * 4, c, true));
    view.setUint32(at + i * 16 + 12, COLOR, true);
  }));
  const positions = fill(36, at => CORNERS.forEach((corner, i) =>
    corner.forEach((c, j) => view.setFloat32(at + i * 12 + j * 4, c, true))));
  const colors = fill(12, at => CORNERS.forEach((_, i) => view.setUint32(at + i * 4, COLOR, true)));

  // Interleaved, the colour follows the position in the same vertex; split, it
  // starts its own buffer.
  const declare = (colorStream, colorOffset, positionStream = 0) => {
    const bytes = declarationBytes(colorStream, colorOffset, positionStream), guest = alloc(bytes.length);
    new Uint8Array(memory.buffer, wa(guest), bytes.length).set(bytes);
    const result = e.CreateVertexDeclaration(device, guest, out, 0, 0) >>> 0;
    return { result, declaration: e.guest_read32(out) >>> 0 };
  };

  const render = () => {
    ok(e.clear_target(device, 0xff000000), 'Clear');
    ok(e.DrawPrimitive(device, 4, 0, 1, 0), 'DrawPrimitive');
    ok(e.Present(device, 0, 0, 0, 0), 'Present');
    return new Uint32Array(memory.buffer, e.target_bits(device) >>> 0, 64)[9];
  };


  const single=declare(0,12);ok(single.result,'D3D9 control declaration');
  ok(e.SetVertexDeclaration(device,single.declaration,0,0,0),'bind control');
  ok(e.SetStreamSource(device,0,interleaved,0,16),'bind vertices');
  assert.equal(render(),COLOR,'D3D9 control paints colour');
  const declarations=[e.stream_token()>>>0,0x40020000,0x40040007,0xffffffff];
  const program=[process.env.D3D8_VS10 ? 0xfffe0100 : 0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40007,0xffff];
  if(process.env.D3D8_MATRIX){
    assert(process.env.D3D8_VS10,'legacy matrix arm requires VS1.0');
    program.splice(1,program.length-1,
      81,0xa00f0000,0x3f800000,0,0,0,
      81,0xa00f0001,0,0x3f800000,0,0,
      81,0xa00f0002,0,0,0x3f800000,0,
      1,0x800f0000,0x90e40000,
      23,0x800f0000,0x90e40000,0xa0e40000,
      1,0xc00f0000,0x80e40000,
      1,0xd00f0000,0x90e40007,0xffff);
  }
  const decl8=alloc(declarations.length*4),program8=alloc(program.length*4);
  declarations.forEach((v,i)=>e.guest_write32(decl8+i*4,v));
  program.forEach((v,i)=>e.guest_write32(program8+i*4,v));
  ok(e.create_vs8(device,decl8,program8,out),'CreateVertexShader D3D8');
  ok(e.bind_vs8(device,e.guest_read32(out)>>>0),'SetVertexShader D3D8');
  const entry=[...bridge.devices.values()][0],draw=entry.device.draw.bind(entry.device);let snapshot;
  entry.device.draw=p=>{snapshot=p;return draw(p)};
  assert.equal(render(),COLOR,'D3D8 sparse v7 colour equals D3D9 control');
  assert.deepEqual(snapshot.attributes.map(a=>a.register),[0,7],'actual host decoder preserves register map');
  const payload={...snapshot,vertices:Array.from(snapshot.vertices),vertexConstants:Array.from(snapshot.vertexConstants||[]),pixelConstants:Array.from(snapshot.pixelConstants||[]),
    vertexIntegerConstants:Array.from(snapshot.vertexIntegerConstants),vertexBooleanConstants:Array.from(snapshot.vertexBooleanConstants),
    pixelIntegerConstants:Array.from(snapshot.pixelIntegerConstants),pixelBooleanConstants:Array.from(snapshot.pixelBooleanConstants),
    vertexShader:{...snapshot.vertexShader,nativeBytes:Array.from(snapshot.vertexShader.nativeBytes)},
    pixelShader:{...snapshot.pixelShader,nativeBytes:Array.from(snapshot.pixelShader.nativeBytes)}};
  const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try{const page=await browser.newPage();
    for(const file of ['gpu-backend.js','d3d-shader-ir.js','d3d9-shader.js','d3d9-fixed.js','d3d9-backend.js'])await page.addScriptTag({path:path.join(__dirname,'../lib',file)});
    const results=await page.evaluate(payload=>{const results=[];for(const webglVersion of [1,2]){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=8;
      const device=new D3D9Backend.Device(canvas,{webglVersion}),gl=device.gpu.gl;
      device.clear([0,0,0,1],1);
      device.draw({...payload,vertices:Uint8Array.from(payload.vertices),vertexConstants:Float32Array.from(payload.vertexConstants),pixelConstants:Float32Array.from(payload.pixelConstants),
        vertexIntegerConstants:Int32Array.from(payload.vertexIntegerConstants),vertexBooleanConstants:Uint32Array.from(payload.vertexBooleanConstants),
        pixelIntegerConstants:Int32Array.from(payload.pixelIntegerConstants),pixelBooleanConstants:Uint32Array.from(payload.pixelBooleanConstants),
        vertexShader:{...payload.vertexShader,nativeBytes:Uint8Array.from(payload.vertexShader.nativeBytes)},pixelShader:{...payload.pixelShader,nativeBytes:Uint8Array.from(payload.pixelShader.nativeBytes)}});
      const pixel=new Uint8Array(4);gl.readPixels(1,6,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);results.push({webglVersion,pixel:Array.from(pixel)});device.destroy();
    }return results;},payload);
    for(const r of results)[32,64,192,255].forEach((v,i)=>assert(Math.abs(r.pixel[i]-v)<=1,JSON.stringify(r)));
    console.log('PASS D3D8 sparse v7 host decode + software/WebGL1/WebGL2 pixels '+JSON.stringify(results));
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
