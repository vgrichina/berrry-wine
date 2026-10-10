#!/usr/bin/env node
'use strict';
const assert = require('node:assert');
const path = require('node:path');
const puppeteer = require('puppeteer');
const {bootRenderHarness} = require('./render-helper');
const NativeIR = require('../lib/d3d-shader-ir');

(async () => {
  const {exports: e, memory} = await bootRenderHarness({fonts: 'none', extraWat: `
    (func (export "ps8_device") (result i32)
      (local $device i32)
      (local.set $device (call $dx_create_com_obj (i32.const 20) (global.get $DX_VTBL_D3DDEV8)))
      (store.field DxObject misc1 (call $dx_from_this (local.get $device)) (call $d3d9_program_alloc))
      (local.get $device))
    (func (export "ps8_create_bind") (param $device i32) (param $code i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_IDirect3DDevice8_CreatePixelShader (local.get $device) (local.get $code) (local.get $out)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (if (i32.ne (i32.load offset=0 (global.get $reg_base)) (i32.const 0)) (then (return (i32.const 0))))
      (call $handle_IDirect3DDevice8_SetPixelShader (local.get $device) (call $gl32 (local.get $out))
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (call $gl32 (i32.add (call $d3d9_program_state (local.get $device)) (i32.const 4))))
    (func (export "ps8_constant") (param $device i32) (param $in i32) (param $out i32) (result i32)
      (call $handle_IDirect3DDevice9_SetPixelShaderConstantF (local.get $device) (i32.const 0) (local.get $in)
        (i32.const 1) (i32.const 0) (i32.const 0))
      (call $handle_IDirect3DDevice9_GetPixelShaderConstantF (local.get $device) (i32.const 0) (local.get $out)
        (i32.const 1) (i32.const 0) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))
  `});
  e.init_dx_com_thunks();
  const device = e.ps8_device(), code = 0x00408000, out = code + 256;
  const compiler = new NativeIR.Compiler({getMemory: () => memory.buffer, getExports: () => e});
  const shaders = [];
  for (let minor = 1; minor <= 4; minor++) {
    const words = [0xffff0100 + minor, 1, 0x800f0000, 0xa0e40000, 0xffff];
    words.forEach((v, i) => e.guest_write32(code + i * 4, v));
    const object = e.ps8_create_bind(device, code, out) >>> 0;
    assert(object, 'Create/SetPixelShader ps_1_' + minor);
    const shader = compiler.retained((e.guest_to_wasm(object) >>> 0) + 24 + words.length * 4, words.length);
    assert.equal(shader.version, words[0]);
    shaders.push({...shader, nativeBytes: Array.from(shader.nativeBytes)});
  }
  const colors = [[.25, .5, .75, 1], [.75, .25, .5, 1]];
  const constants = colors.map(color => {
    const values = new Float32Array(color), bytes = new Uint32Array(values.buffer);
    bytes.forEach((v, i) => e.guest_write32(code + i * 4, v));
    assert.equal(e.ps8_constant(device, code, out), 0);
    return Array.from(new Float32Array(memory.buffer, e.guest_to_wasm(out) >>> 0, 4));
  });
  const browser = await puppeteer.launch({headless: true,
    executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox']});
  try {
    const page = await browser.newPage();
    for (const file of ['gpu-backend.js', 'd3d-shader-ir.js', 'd3d9-shader.js', 'd3d9-fixed.js', 'd3d9-backend.js'])
      await page.addScriptTag({path: path.join(__dirname, '../lib', file)});
    const results = await page.evaluate(({shaders, constants}) => {
      const results = [];
      for (const webglVersion of [1, 2]) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 8;
        const device = new D3D9Backend.Device(canvas, {webglVersion}), gl = device.gpu.gl;
        const vertices = new Float32Array([-1,-1,.5,1, 3,-1,.5,1, -1,3,.5,1]);
        for (const shader of shaders) for (const color of constants) {
          device.clear([0,0,0,1], 1);
          device.draw({primitive: 4, primitiveCount: 1, stride: 16, vertices: new Uint8Array(vertices.buffer),
            attributes: [{register: 0, usage: 0, usageIndex: 0, type: 3, offset: 0}],
            vertexShader: new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,0xffff]),
            pixelShader: {...shader, nativeBytes: Uint8Array.from(shader.nativeBytes)},
            pixelConstants: new Float32Array(color), state: {zenable: false, cull: 1}, textures: []});
          const pixel = new Uint8Array(4); gl.readPixels(4,4,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
          results.push({webglVersion, version: shader.version, pixel: Array.from(pixel), color});
        }
        device.destroy();
      }
      return results;
    }, {shaders, constants});
    assert.equal(results.length, 16);
    for (const r of results) r.color.forEach((v, i) =>
      assert(Math.abs(r.pixel[i] - Math.round(v * 255)) <= 1, JSON.stringify(r)));
    console.log('PASS D3D8-created/bound ps_1_1..1_4 retained IR and constants render 16 WebGL1/2 frames');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
