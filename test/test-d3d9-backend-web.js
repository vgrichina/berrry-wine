#!/usr/bin/env node
'use strict';
const assert = require('assert');
const path = require('path');
// Pure JS validation arm: exercise the production draw validator with a GPU
// boundary double. No browser, WASM, or pixels are needed for rejection detail.
const { Device } = require('../lib/d3d9-backend');
const vertexShader = new Uint32Array([0xfffe0101, 1, 0xc00f0000, 0x90e40000, 0xffff]);
const pixelShader = new Uint32Array([0xffff0101, 1, 0x800f0000, 0xa0e40000, 0xffff]);
for (const [type, offset] of [[5, 0], [9, 0], [10, 0], [0, 2], [1, 2], [2, 2], [4, 2], [3, 2], [3, -4], [3, 0.5], [6, 1], [7, 3], [6, -2], [7, 0.5]]) {
  const draw = { vertexShader, pixelShader, primitive: 4, primitiveCount: 1,
    stride: 16, vertices: new Uint8Array(48),
    attributes: [{ register: 0, usage: 0, usageIndex: 2, type, offset }] };
  const before = JSON.stringify(draw.attributes);
  const gpu = { canvas: {width: 16, height: 16}, gl: {}, createProgram: () => ({}),
    draw() { throw Error('invalid declaration reached GPU draw'); } };
  assert.throws(() => Device.prototype.draw.call({gpu, programs: new Map(), bindDepth() {}}, draw), error => {
    const prefix = 'D3D9 draw: unsupported vertex declaration element: ';
    assert(error.message.startsWith(prefix));
    assert.deepStrictEqual(JSON.parse(error.message.slice(prefix.length)),
      {register: 0, type, offset, usage: 0, usageIndex: 2, stride: 16});
    return true;
  });
  assert.strictEqual(JSON.stringify(draw.attributes), before, 'diagnostic must not mutate declaration');
}
// Accepted declarations must reach the GPU boundary with the correct numeric
// conversion, without replacing or rewriting the original vertex bytes.
{
  let command, uploaded;
  const gl = new Proxy({FLOAT: 5126, SHORT: 5122, UNSIGNED_BYTE: 5121, colorMask() {}},
    {get: (target, name) => target[name] ?? 1});
  const gpu = new Proxy({gl, canvas: {width: 16, height: 16}, renderHeight: 16,
    createProgram: () => ({}), updateBuffer: (_b, _t, bytes) => {uploaded = bytes;},
    draw: value => {command = value;}}, {get: (target, name) => target[name] ?? (() => {})});
  const device = {gpu, programs: new Map(), bindDepth() {}, stencilState() {}, touchColor() {}};
  const submit = (type, offset, stride, length = stride * 3) => {
    const vertices = new Uint8Array(length);
    Device.prototype.draw.call(device, {vertexShader, pixelShader, primitive: 4, primitiveCount: 1,
      stride, vertices, pixelConstants: new Float32Array(4), attributes: [{register: 0, type, offset}]});
    assert.strictEqual(uploaded, vertices);
    return command.attributes[0];
  };
  for (const [type, size, offset, stride] of [[0,1,0,4], [1,2,0,8], [2,3,0,12], [3,4,0,16],
    [4,4,0,4], [6,2,20,32], [7,4,12,32], [6,2,2,6], [7,4,2,10]]) {
    const a = submit(type, offset, stride);
    assert.deepStrictEqual({size:a.size, offset:a.offset, type:a.type, normalized:a.normalized},
      {size, offset, type:type===4?gl.UNSIGNED_BYTE:type>=6?gl.SHORT:gl.FLOAT, normalized:type===4});
  }
  for (const type of [6,7]) {
    assert.throws(() => submit(type, 0, 17), /unsupported vertex declaration/);
    assert.throws(() => submit(type, 14, 16), /outside buffer/);
    assert.throws(() => submit(type, 0, 16, 33), /outside buffer/);
  }
}
// The first-failure probe must preserve the actual draw result/error and all
// guest bytes. A synthetic original table tests bounded direct-image reads.
{
  const {install, originalDeclarations} = require('../tools/page-probes/arm-kkrieger-declaration');
  const buffer = new ArrayBuffer(1024), view = new DataView(buffer);
  for (let index = 12; index < 84; index += 12) view.setUint32(0xe0 + index + 4, 0x821200, true);
  view.setUint8(512 + 4, 10); view.setUint8(512 + 6, 3);
  view.setUint16(520, 255, true); view.setUint8(524, 17);
  const root = {RegionMap: {REGIONS: {GUEST_BASE: {base: 0, end: 1024}}},
    wineShell: {currentWine: {memory: {buffer}, instance: {exports: {get_image_base: () => 0x821000}}}}};
  const before = Buffer.from(buffer).toString('hex');
  const declaration = originalDeclarations(root);
  assert.strictEqual(declaration.rows.length, 6);
  assert.strictEqual(declaration.rows[0].elements[0].type, 10);
  assert.strictEqual(declaration.rows[0].elements[0].usage, 3);
  assert.strictEqual(declaration.rows[0].terminated, true);
  const error = Error('D3D9 draw: unsupported vertex declaration element: synthetic');
  const other = Error('another validation error'), captured = [], context = {token: 17};
  const api = {Device: function () {}};
  api.Device.prototype.draw = function (draw) {
    assert.strictEqual(this, context);
    if (draw.error) throw draw.error;
    return draw.value;
  };
  install(api, root, packet => captured.push(packet));
  assert.strictEqual(api.Device.prototype.draw.call(context, {value: 42}), 42);
  assert.throws(() => api.Device.prototype.draw.call(context, {error: other}), e => e === other);
  assert.strictEqual(captured.length, 0);
  const draw = Object.freeze({error, stride: 16, vertices: new Uint8Array(48),
    attributes: Object.freeze([Object.freeze({type: 10, offset: 0, usage: 3, usageIndex: 0})])});
  for (let i = 0; i < 2; i++) assert.throws(() => api.Device.prototype.draw.call(context, draw), e => e === error);
  assert.strictEqual(captured.length, 1, 'only first matching rejection captured');
  assert.strictEqual(captured[0].attributes[0].type, 10);
  assert.strictEqual(Buffer.from(buffer).toString('hex'), before, 'no guest writes');
  view.setUint32(0xe0 + 16, 0xdeadbeef, true);
  assert.match(originalDeclarations(root).rows[0].error, /outside direct image region/);
  const failureApi = {Device: function () {}};
  failureApi.Device.prototype.draw = () => {throw error;};
  install(failureApi, {}, () => {throw Error('diagnostic sink failure');});
  assert.throws(() => failureApi.Device.prototype.draw(draw), e => e === error);
  const contextRoot = {...root, console: {log() {}}};
  require('vm').runInNewContext(require('fs').readFileSync(
    path.join(__dirname, '../tools/page-probes/arm-kkrieger-declaration.js'), 'utf8'), contextRoot);
  const delayedApi = {Device: function () {}};
  delayedApi.Device.prototype.draw = () => {throw error;};
  contextRoot.D3D9Backend = delayedApi;
  assert.strictEqual(Object.getOwnPropertyDescriptor(contextRoot, 'D3D9Backend').writable, true);
  assert.throws(() => delayedApi.Device.prototype.draw(draw), e => e === error);
  assert.strictEqual(contextRoot.__kkriegerDeclaration.attributes[0].type, 10);
}
if (process.argv.includes('--validation-only')) {
  console.log('PASS D3D9 declaration mapping, signed SHORT2/4 bounds/alignment, rejection detail and read-only probe');
  process.exit(0);
}
const puppeteer = require('puppeteer');
const versionArg = process.argv.find(arg => arg.startsWith('--webgl='));
const webglVersion = versionArg ? Number(versionArg.slice('--webgl='.length)) : 'auto';
if (versionArg && ![1, 2].includes(webglVersion)) throw new Error('--webgl must be 1 or 2');
(async () => {
  const browser = await puppeteer.launch({ headless: true,
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-first-run', '--no-default-browser-check'] });
  try {
    const page = await browser.newPage();
    for (const file of ['gpu-backend.js', 'd3d9-shader.js', 'render-clear.js','d3d9-backend.js'])
      await page.addScriptTag({ path: path.join(__dirname, '../lib', file) });
    const result = await page.evaluate(webglVersion => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
      const device = new D3D9Backend.Device(canvas, {webglVersion}), gl = device.gpu.gl;
      const vertexShader = new Uint32Array([0xfffe0101,
        1, 0xc00f0000, 0x90e40000, // oPos = v0
        1, 0xd00f0000, 0xa0e40000, // oD0 = VS c0
        0xffff]);
      const pixelShader = new Uint32Array([0xffff0101,
        5, 0x800f0000, 0x90e40000, 0xa0e40000, // r0 = v0 * PS c0
        0xffff]);
      const floats = new Float32Array([-1,-1,0.25,1, 3,-1,0.25,1, -1,3,0.25,1]);
      const draw = { vertexShader, pixelShader, primitive: 4, primitiveCount: 1,
        vertices: new Uint8Array(floats.buffer), stride: 16,
        indices: new Uint16Array([0,1,2]), attributes: [{ register: 0, type: 3, offset: 0 }],
        vertexConstants: new Float32Array([0.8, 0.4, 0.2, 1]),
        pixelConstants: new Float32Array([0.5, 0.5, 0.5, 1]), state: { cull: 1 } };
      const read = () => Array.from(device.gpu.readPixels(8,8,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4)));
      device.clear([0,0,0,1], 3); device.draw(draw); const initial = read();
      const farther = floats.slice(); for (let i=2;i<farther.length;i+=4) farther[i] = 0.75;
      device.draw({ ...draw, vertices: new Uint8Array(farther.buffer),
        vertexConstants: new Float32Array([1,0,0,1]) });
      const depthRejected = read();
      device.draw({ ...draw, vertices: new Uint8Array(farther.buffer),
        vertexConstants: new Float32Array([1,0,0,1]),
        pixelConstants: new Float32Array([1,1,1,0.5]),
        state: { cull: 1, zenable: false, blend: true, srcblend: 5, dstblend: 6 } });
      const blended = read();
      let bounded = false;
      try { device.draw({ ...draw, indices: new Uint16Array([0,1,20]) }); }
      catch (e) { bounded = /outside buffer/.test(e.message); }
      const relativeVS=new Uint32Array([0xfffe0101,1,0xb0010000,0xa0000000,
        1,0xc00f0000,0x90e40000,1,0xd00f0000,0xa0e42002,0xffff]);
      const constants=new Float32Array(384);constants[0]=1.75;
      constants.set([0.2,0.4,0.6,1],12);
      const relativeDraw={...draw,vertexShader:relativeVS,vertexConstants:constants,
        pixelConstants:new Float32Array([1,1,1,1]),state:{cull:1,zenable:false}};
      device.draw(relativeDraw);const relativePixel=read();
      constants[0]=-2.25;device.draw(relativeDraw);const relativeOutside=read();
      // Signed extremes distinguish SHORT from normalized or unsigned inputs.
      // Scale and bias in the shader before pixel clamping can hide mistakes.
      const shortPixels = [];
      for (const type of [6,7]) {
        const render = asFloat => {
          const stride = 32, bytes = new Uint8Array(stride * 3), view = new DataView(bytes.buffer);
          for (let i=0;i<3;i++) {
            for (let c=0;c<4;c++) view.setFloat32(i*stride+c*4, floats[i*4+c], true);
            const values = type===6?[-32768,32767,0,1]:[-32768,32767,-12345,16384];
            values.slice(0,asFloat?4:type===6?2:4).forEach((v,c) => asFloat?view.setFloat32(i*stride+16+c*4,v,true):view.setInt16(i*stride+16+c*2,v,true));
          }
          const vs = new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,
            5,0x800f0000,0x90e40001,0xa0e40000,
            2,0xd00f0000,0x80e40000,0xa0e40001,0xffff]); // mul/add: VS1 permits one constant read per instruction
          device.clear([0,0,0,1],3);
          device.draw({...draw, vertices:bytes, stride, vertexShader:vs,
            attributes:[{register:0,type:3,offset:0},{register:1,type:asFloat?3:type,offset:16}],
            // SHORT2's z/w are observed directly, so inheriting z=1 cannot
            // hide behind the tiny signed-value scale or a shared FLOAT2 bug.
            vertexConstants:new Float32Array(type===6
              ? [1/65536,1/65536,1,1,0.5,0.5,0,0]
              : [1/65536,1/65536,1/65536,1/65536,0.5,0.5,0.5,0.5]),
            pixelConstants:new Float32Array([1,1,1,1]),state:{cull:1,zenable:false}});
          return read();
        };
        shortPixels.push({type, actual:render(false), expected:render(true)});
      }
      const error = device.gpu.getError(), version = device.gpu.version;
      const renderer = gl.getParameter(gl.RENDERER);
      device.destroy();
      return { version, renderer, shortPixels, initial, depthRejected, blended, relativePixel, relativeOutside, bounded, error,
        probe:D3D9Backend.probe(document.createElement('canvas')) };
    }, webglVersion);
    console.log(JSON.stringify({requestedVersion:webglVersion, ...result}));
    if (versionArg) assert.strictEqual(result.version, webglVersion, 'requested real WebGL context');
    for (const sample of result.shortPixels) {
      assert.deepStrictEqual(sample.actual, sample.expected, "signed SHORT"+sample.type+" float equivalence");
      assert.strictEqual(sample.actual[0],0); assert.strictEqual(sample.actual[1],255);
    }
    assert.strictEqual(result.error, 0); assert.ok(result.bounded);
    assert.ok(result.probe,'programmable profile requires a real textured/indexed pixel probe');
    const near = (actual, expected) => expected.forEach((v,i) =>
      assert.ok(Math.abs(actual[i] - v) <= 1, `pixel ${actual} expected ${expected}`));
    near(result.initial, [102,51,26,255]);
    assert.deepStrictEqual(result.depthRejected, result.initial);
    near(result.blended.slice(0,3), [179,26,13]);
    near(result.relativePixel,[51,102,153,255]);
    near(result.relativeOutside.slice(0,3),[0,0,0]); // opaque default back buffer
    console.log('PASS D3D9 indexed draw, independent VS/PS constants, depth rejection, alpha blending, vertex bounds');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
