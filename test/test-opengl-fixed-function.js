#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { FixedFunctionGL, OpenGLHostBridge, CALL_INDEX, constants: GL } = require('../lib/gl-compat');

class FakeBackend {
  constructor() {
    this.gl = {
      ARRAY_BUFFER: 0x8892, STREAM_DRAW: 0x88E0, FLOAT: 0x1406,
      TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800,
      TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
      NEAREST_MIPMAP_LINEAR: 0x2702, LINEAR: 0x2601, REPEAT: 0x2901,
      RGB: 0x1907, RGBA: 0x1908, ALPHA: 0x1906, LUMINANCE: 0x1909,
      TRIANGLES: 4,
    };
    this.draws = []; this.uniforms = new Map(); this.uploads = [];
    this.parameters = [];
    this.depthRanges = [];
    this.polygonOffsets = [];
    this.mipmapTextures = [];
    this.capabilities = [];
    this.uniformCalls = 0;
  }
  createProgram() { return { attributes: {
    aPosition: 0, aColor: 1, aTexCoord: 2, aNormal: 3,
  }, uniforms: {} }; }
  createBuffer() { return {}; }
  updateBuffer(_buffer, _target, data) { this.vertices = Array.from(data); }
  useProgram() {}
  setUniform(_program, name, _kind, value) { this.uniformCalls++; this.uniforms.set(name, value); }
  bindTexture() {}
  draw(command) { this.draws.push(command); }
  createTexture() { return {}; }
  setTextureParameter(texture, pname, value) {
    assert(texture, 'texture parameters must never target WebGL null binding');
    this.parameters.push({ texture, pname, value });
  }
  uploadTexture2D(_texture, image) { this.uploads.push(image); }
  updateTexture2D(_texture, image) { this.uploads.push(image); }
  generateMipmaps(texture) { this.mipmapTextures.push(texture); }
  deleteTexture() {}
  destroy() {}
  setCapability(capability, enabled) { this.capabilities.push([capability, enabled]); }
  setDepthRange(nearValue, farValue) { this.depthRanges.push([nearValue, farValue]); }
  setPolygonOffset(factor, units) { this.polygonOffsets.push([factor, units]); }
}

const backend = new FakeBackend();
const gl = new FixedFunctionGL(backend);
const triangle = new Float32Array(3 * require('../lib/gl-command-stream').VERTEX_FLOATS);
for (const stack of Object.values(gl.matrices)) {
  stack.slice = () => { throw new Error('matrix-stack slice allocated'); };
}
gl.enqueuePacked(GL.TRIANGLES, triangle);
gl.flushPendingDraw();
assert.strictEqual(backend.draws.length, 1);
assert.strictEqual(backend.draws[0].mode, GL.TRIANGLES,
  'packed desktop geometry reaches the WebGL triangle backend');
assert.strictEqual(backend.draws[0].count, 3,
  'one packed triangle produces one complete WebGL triangle');

gl.matrixMode = GL.MODELVIEW;
gl._multMatrix(require('../lib/gl-compat').identity());
gl._multMatrix(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0,
  0, 0, 1, 0, 2, 3, 4, 1]));
assert.deepStrictEqual(Array.from(gl._matrix().slice(12, 15)), [2, 3, 4],
  'matrix frontend keeps OpenGL column-major post-multiply semantics');

gl.bindTexture(7);
gl.texImage(0, 4, 2, 2, 0, GL.RGBA, GL.UNSIGNED_BYTE,
  new Uint8Array(16));
assert.strictEqual(backend.uploads.length, 1);
assert.strictEqual(backend.uploads[0].alignment, 4,
  'guest texture rows begin with the desktop OpenGL default alignment');
gl.texImage(0, 4, 1, 1, 0, GL.BGRA, GL.UNSIGNED_BYTE,
  new Uint8Array([0x11, 0x22, 0x33, 0x44]));
assert.strictEqual(backend.uploads.at(-1).format, GL.RGBA,
  'desktop BGRA textures use the WebGL-compatible RGBA format');
assert.deepStrictEqual(Array.from(backend.uploads.at(-1).pixels), [0x33, 0x22, 0x11, 0x44],
  'desktop BGRA texture bytes are converted to RGBA without changing alpha');

gl.bindTexture(0);
gl.texParameter(GL.TEXTURE_MIN_FILTER, GL.LINEAR);
assert(gl.defaultTexture,
  'desktop GL texture zero has a mutable WebGL backing object');
assert.strictEqual(backend.parameters.at(-1).texture, gl.defaultTexture,
  'texture-zero parameters target the owned default texture');

const mergedBackend = new FakeBackend();
const merged = new FixedFunctionGL(mergedBackend);
merged.enqueuePacked(GL.TRIANGLES, triangle);
merged.enqueuePacked(GL.TRIANGLES, triangle);
assert.strictEqual(mergedBackend.draws.length, 0, 'compatible packed draws remain deferred');
merged.flushPendingDraw();
assert.strictEqual(mergedBackend.draws.length, 1, 'adjacent compatible draws merge into one WebGL draw');
assert.strictEqual(mergedBackend.draws[0].count, 6, 'merged draw contains both triangles');
assert.strictEqual(mergedBackend.vertices.length,
  6 * require('../lib/gl-command-stream').VERTEX_FLOATS,
  'merged interleaved upload is contiguous');
const initialUniformCalls = mergedBackend.uniformCalls;
merged.enqueuePacked(GL.TRIANGLES, triangle);
merged.flushPendingDraw();
assert.strictEqual(mergedBackend.uniformCalls, initialUniformCalls,
  'unchanged fixed-function uniforms are not reissued on later draws');

const depthBackend = new FakeBackend();
const depthFrontend = new FixedFunctionGL(depthBackend);
depthFrontend.setDepthRange(1, 0);
assert.deepStrictEqual(depthBackend.depthRanges, [[0, 1]],
  'desktop reversed depth range is submitted to WebGL in legal order');
depthFrontend.enqueuePacked(GL.TRIANGLES, triangle);
depthFrontend.flushPendingDraw();
assert.strictEqual(depthBackend.uniforms.get('uProjection')[10], -1,
  'reversed depth range negates clip-space Z to preserve desktop GL mapping');
depthFrontend.setDepthRange(0, 1);
depthFrontend.enqueuePacked(GL.TRIANGLES, triangle);
depthFrontend.flushPendingDraw();
assert.strictEqual(depthBackend.uniforms.get('uProjection')[10], 1,
  'restoring forward depth range restores the original projection');

const bridgeMemory = new ArrayBuffer(4096);
const bridgeView = new DataView(bridgeMemory);
const stack = 0x100;
let guestPresents = 0;
const bridge = new OpenGLHostBridge({
  getMemory: () => bridgeMemory,
  exports: { guest_to_wasm: pointer => pointer },
  onPresent: () => { guestPresents++; },
});
bridge.current = 1;
bridge.contexts.set(1, { frontend: {
  backend,
}, backend: { present() {} }, layer: { writeSeq: 0 } });
assert.throws(() => bridge.call(CALL_INDEX.glVertex3fv, stack, 0),
  /must be compiled by the native WAT GL encoder/,
  'raw immediate vertices cannot bypass the mandatory buffered state layer');
bridgeView.setFloat32(stack + 4, -1, true);
bridgeView.setFloat32(stack + 8, -2, true);
bridge.call(CALL_INDEX.glPolygonOffset, stack, 0);
assert.deepStrictEqual(backend.polygonOffsets, [[-1, -2]],
  'GoldSrc polygon offset reaches the WebGL backend with both float arguments');

const matrixFrontend = new FixedFunctionGL(new FakeBackend());
matrixFrontend.matrixMode = GL.PROJECTION;
bridge.contexts.set(1, {
  frontend: matrixFrontend,
  backend: { present() {} },
  layer: { writeSeq: 0 },
});
for (const [index, value] of [60, 4 / 3, 1, 101].entries()) {
  bridgeView.setFloat64(stack + 4 + index * 8, value, true);
}
bridge.call(CALL_INDEX.gluPerspective, stack, 0);
const projection = matrixFrontend._matrix();
assert(Math.abs(projection[0] - 1.299038) < 1e-5 &&
  Math.abs(projection[5] - 1.732051) < 1e-5 &&
  Math.abs(projection[10] + 1.02) < 1e-5,
  'gluPerspective applies the documented GLdouble projection matrix');

matrixFrontend.matrixMode = GL.MODELVIEW;
const lookAtValues = [0, 0, 5, 0, 0, 0, 0, 1, 0];
lookAtValues.forEach((value, index) => bridgeView.setFloat64(stack + 4 + index * 8, value, true));
bridge.call(CALL_INDEX.gluLookAt, stack, 0);
assert.deepStrictEqual(Array.from(matrixFrontend._matrix().slice(12, 16)), [0, 0, -5, 1],
  'gluLookAt applies orientation and eye translation in OpenGL column-major order');
bridgeView.setUint32(stack + 4, GL.TEXTURE_2D, true);
bridgeView.setInt32(stack + 8, 3, true);
bridgeView.setInt32(stack + 12, 2, true);
bridgeView.setInt32(stack + 16, 2, true);
bridgeView.setUint32(stack + 20, GL.RGB, true);
bridgeView.setUint32(stack + 24, GL.UNSIGNED_BYTE, true);
bridgeView.setUint32(stack + 28, 0x200, true);
new Uint8Array(bridgeMemory, 0x200, 12).fill(0x7f);
assert.strictEqual(bridge.call(CALL_INDEX.gluBuild2DMipmaps, stack, 0), 0,
  'gluBuild2DMipmaps returns GLU_NO_ERROR');
assert.strictEqual(matrixFrontend.backend.uploads.at(-1).level, 0,
  'gluBuild2DMipmaps uploads the source image as level zero');
assert.strictEqual(matrixFrontend.backend.mipmapTextures.length, 1,
  'gluBuild2DMipmaps asks the GPU backend to derive the mip chain');
matrixFrontend.matrixMode = GL.PROJECTION;
matrixFrontend._replaceMatrix(require('../lib/gl-compat').identity());
[0, 640, 0, 480].forEach((value, index) =>
  bridgeView.setFloat64(stack + 4 + index * 8, value, true));
bridge.call(CALL_INDEX.gluOrtho2D, stack, 0);
assert(Math.abs(matrixFrontend._matrix()[0] - 2 / 640) < 1e-8 &&
  Math.abs(matrixFrontend._matrix()[5] - 2 / 480) < 1e-8,
  'gluOrtho2D applies the two-dimensional GLU orthographic projection');
gl.setEnabled(GL.POLYGON_OFFSET_FILL, true);
assert.deepStrictEqual(backend.capabilities.at(-1), [GL.POLYGON_OFFSET_FILL, true],
  'polygon-offset fill follows desktop GL enable state');
const savedRaf = global.requestAnimationFrame;
delete global.requestAnimationFrame;
bridge.call(CALL_INDEX.glFlush, stack, 0);
assert.strictEqual(guestPresents, 1,
  'a single-buffer glFlush publishes exactly one guest frame');
assert.strictEqual(bridge.contexts.get(1).layer.writeSeq, 1,
  'a single-buffer glFlush advances its compositor sequence');
const animationFrames = [];
global.requestAnimationFrame = callback => { animationFrames.push(callback); return animationFrames.length; };
bridge.call(CALL_INDEX.glFlush, stack, 0);
bridge.call(CALL_INDEX.glFlush, stack, 0);
// The publication itself is synchronous with the guest's flush: a
// single-buffered context shares the window device context, and the GDI the
// app draws on its next instructions has to land on top of this frame, not
// under a copy made later in the animation frame.
assert.strictEqual(guestPresents, 3,
  'each glFlush publishes its front buffer synchronously');
assert.strictEqual(bridge.contexts.get(1).layer.writeSeq, 3,
  'each glFlush advances its compositor sequence');
// Only the screen repaint is coalesced, which is what keeps intermediate
// terrain passes from reaching the display as flicker.
assert.strictEqual(animationFrames.length, 1,
  'browser glFlush repaints are coalesced to one per animation frame');
animationFrames.shift()();
assert.strictEqual(guestPresents, 3,
  'the animation-frame callback repaints and does not re-publish');
if (savedRaf === undefined) delete global.requestAnimationFrame;
else global.requestAnimationFrame = savedRaf;
bridge.call(CALL_INDEX.gpuPresent, stack, 0);
assert.strictEqual(guestPresents, 4,
  'generic GPU presentation contributes its guest FPS sample');
assert.strictEqual(bridge.contexts.get(1).layer.writeSeq, 4,
  'generic GPU presentation advances its compositor sequence');

const contextCounts = [];
const lifecycleBridge = new OpenGLHostBridge({
  getMemory: () => bridgeMemory,
  exports: {},
  onContextCountChange: count => contextCounts.push(count),
});
const lifecycleWin = {};
const lifecycleLayer = {};
lifecycleWin._gpuFrameLayer = lifecycleLayer;
lifecycleWin._dxFrameLayer = lifecycleLayer;
lifecycleBridge.current = 7;
lifecycleBridge.contexts.set(7, {
  frontend: { destroy() {} }, win: lifecycleWin, layer: lifecycleLayer,
});
assert.strictEqual(lifecycleBridge.makeCurrent(7), 1);
assert.strictEqual(lifecycleBridge.makeCurrent(0), 1);
assert.deepStrictEqual(contextCounts, [1, 0],
  'releasing a current context reports the software-renderer transition');
assert.strictEqual(lifecycleBridge.deleteContext(7), 1,
  'live OpenGL context can be deleted during renderer replacement');
assert.deepStrictEqual(contextCounts, [1, 0, 0],
  'deleting the last context reports the software-renderer transition');
assert.strictEqual(lifecycleWin._gpuFrameLayer, null,
  'renderer replacement detaches the old GPU presentation layer');

{
  const b = new FakeBackend(), f = new FixedFunctionGL(b);
  b.getError=()=>0;
  assert.deepStrictEqual(Array.from(f.getTexParameter(GL.TEXTURE_BORDER_COLOR)), [0, 0, 0, 0]);
  f.bindTexture(12);
  assert(f.texBorderColor([-1, 0.25, 2, 0.5]));
  assert.deepStrictEqual(Array.from(f.getTexParameter(GL.TEXTURE_BORDER_COLOR)), [0, 0.25, 1, 0.5]);
  const detached = f.getTexParameter(GL.TEXTURE_BORDER_COLOR);
  detached[1] = 1;
  assert.strictEqual(f.getTexParameter(GL.TEXTURE_BORDER_COLOR)[1], 0.25,
    'query result cannot mutate texture state');
  f.setActiveTexture(0x84C1);
  f.bindTexture(13);
  assert.deepStrictEqual(Array.from(f.getTexParameter(GL.TEXTURE_BORDER_COLOR)), [0, 0, 0, 0]);
  f.texBorderColor([1, 0, 0, 1]);
  f.setActiveTexture(0x84C0);
  assert.deepStrictEqual(Array.from(f.getTexParameter(GL.TEXTURE_BORDER_COLOR)), [0, 0.25, 1, 0.5]);
  assert(f.texParameter(GL.TEXTURE_WRAP_S, GL.CLAMP));
  assert.deepStrictEqual(f.getTexParameter(GL.TEXTURE_WRAP_S), [GL.CLAMP],
    'query preserves desktop enum rather than hardware CLAMP_TO_EDGE alias');
  const count = b.parameters.length;
  assert.strictEqual(f.texParameter(GL.TEXTURE_MAG_FILTER, 0x2703), false);
  assert.strictEqual(f.lastError, GL.INVALID_ENUM);
  assert.strictEqual(b.parameters.length, count, 'invalid filter cannot touch hardware');
  assert.deepStrictEqual(f.getTexParameter(GL.TEXTURE_MAG_FILTER), [GL.LINEAR]);
  f.lastError = 0;
  assert.strictEqual(f.texBorderColor([0, 0, 0, 0], 0xDE0), false);
  assert.strictEqual(f.lastError, GL.INVALID_ENUM);
  assert.deepStrictEqual(Array.from(f.getTexParameter(GL.TEXTURE_BORDER_COLOR)), [0, 0.25, 1, 0.5]);
  f.lastError = 0;
  f.deleteTextures([12]);
  f.bindTexture(12);
  assert.deepStrictEqual(Array.from(f.getTexParameter(GL.TEXTURE_BORDER_COLOR)), [0, 0, 0, 0],
    'deleted texture name starts with a fresh default border');
  f.enqueuePacked(GL.TRIANGLES, triangle);
  const before = b.draws.length;
  f.texBorderColor([0, 1, 0, 1]);
  assert.strictEqual(b.draws.length, before + 1, 'pending geometry is flushed before changing border');
  const memory=new ArrayBuffer(1024),dv=new DataView(memory);
  const host=new OpenGLHostBridge({getMemory:()=>memory,exports:{guest_to_wasm:p=>p}});
  host.current=1;host.contexts.set(1,{frontend:f});
  const call=(name,...args)=>{
    args.forEach((v,i)=>dv.setUint32(4+i*4,v>>>0,true));
    return host.call(CALL_INDEX[name],0,0);
  };
  [0.125,0.25,0.5,1].forEach((v,i)=>dv.setFloat32(256+i*4,v,true));
  call('glTexParameterfv',GL.TEXTURE_2D,GL.TEXTURE_BORDER_COLOR,256);
  call('glGetTexParameterfv',GL.TEXTURE_2D,GL.TEXTURE_BORDER_COLOR,320);
  assert.deepStrictEqual(Array.from(new Float32Array(memory,320,4)),[0.125,0.25,0.5,1]);
  dv.setFloat32(256,0.375,true);
  call('glTexParameterfv',GL.TEXTURE_2D,GL.TEXTURE_PRIORITY,256);
  call('glGetTexParameterfv',GL.TEXTURE_2D,GL.TEXTURE_PRIORITY,320);
  assert.strictEqual(dv.getFloat32(320,true),0.375);
  call('glTexParameterfv',0xDE0,GL.TEXTURE_BORDER_COLOR,0xFFFFFFF0);
  assert.strictEqual(call('glGetError'),GL.INVALID_ENUM);
  assert.strictEqual(call('glGetError'),0,'frontend error is cleared when consumed');
  dv.setUint32(320,0xDEADBEEF,true);
  call('glGetTexParameterfv',GL.TEXTURE_2D,0xDEADBEEF,320);
  assert.strictEqual(dv.getUint32(320,true),0xDEADBEEF,'invalid query must not write output');
  assert.strictEqual(call('glGetError'),GL.INVALID_ENUM);
  // glGetTexLevelParameter: Serious Sam's Engine specifies a 1x1 GL_RGBA8
  // image and enables 32-bit textures only if GL_TEXTURE_GREEN_SIZE is 8.
  f.texImage(0,0x8058,1,1,0,GL.RGBA,0x1401,new Uint8Array(4));
  const level=(pname,lv=0,fv=false)=>{
    dv.setUint32(336,0xDEADBEEF,true);
    call(fv?'glGetTexLevelParameterfv':'glGetTexLevelParameteriv',GL.TEXTURE_2D,lv,pname,336);
    return fv?dv.getFloat32(336,true):dv.getInt32(336,true);
  };
  assert.strictEqual(level(0x805D),8,'RGBA8 green size');
  assert.strictEqual(level(0x805F),8,'RGBA8 alpha size');
  assert.strictEqual(level(0x8060),0,'RGBA8 has no luminance');
  assert.strictEqual(level(0x1000),1,'level 0 width');
  assert.strictEqual(level(0x1003),0x8058,'internal format as specified');
  assert.strictEqual(level(0x1001,0,true),1,'fv form answers in float');
  assert.strictEqual(level(0x1000,3),0,'an unspecified level has width 0');
  assert.strictEqual(level(0x1003,3),1,'and internal format 1');
  f.texImage(0,GL.ALPHA,1,1,0,GL.ALPHA,0x1401,new Uint8Array(1));
  assert.deepStrictEqual([level(0x805C),level(0x805F)],[0,8],'alpha-only image');
  assert.strictEqual(call('glGetError'),0);
  dv.setUint32(336,0xDEADBEEF,true);
  call('glGetTexLevelParameteriv',GL.TEXTURE_2D,0,0xDEADBEEF,336);
  assert.strictEqual(dv.getUint32(336,true),0xDEADBEEF,'invalid level query must not write output');
  assert.strictEqual(call('glGetError'),GL.INVALID_ENUM);
  dv.setUint32(4,GL.TEXTURE_2D,true);dv.setUint32(8,GL.TEXTURE_BORDER_COLOR,true);dv.setUint32(12,256,true);
  host.call(CALL_INDEX.glTexParameterfv,0,0x505);
  assert.strictEqual(call('glGetError'),0x505,'native allocation failure reaches guest error query');
}

console.log('PASS OpenGL packed fixed-function rendering (state, matrix, texture)');
