#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { WebGLBackend } = require('../lib/gpu-backend');

let next = 1;
const calls = [];
const gl = {
  VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
  ARRAY_BUFFER: 5, ELEMENT_ARRAY_BUFFER: 6, STREAM_DRAW: 7,
  TEXTURE_2D: 8, TEXTURE0: 100, UNPACK_ALIGNMENT: 9,
  FLOAT: 10, UNSIGNED_SHORT: 11,
  createShader: () => ({ id: next++ }), shaderSource() {}, compileShader() {},
  getShaderParameter: () => true, getShaderInfoLog: () => '', deleteShader() {},
  createProgram: () => ({ id: next++ }), attachShader() {}, linkProgram() {},
  getProgramParameter: () => true, getProgramInfoLog: () => '', deleteProgram() {},
  getAttribLocation: (_p, n) => n === 'a' ? 0 : 1,
  getUniformLocation: (_p, n) => ({ n }), useProgram: (...a) => calls.push(['useProgram', ...a]),
  createBuffer: () => ({ id: next++ }), bindBuffer: (...a) => calls.push(['bindBuffer', ...a]),
  bufferData: (...a) => calls.push(['bufferData', ...a]), deleteBuffer() {},
  createTexture: () => ({ id: next++ }), activeTexture() {}, bindTexture() {},
  pixelStorei() {}, texImage2D: (...a) => calls.push(['texImage2D', ...a]),
  texSubImage2D() {}, texParameteri: (...a) => calls.push(['texParameteri', ...a]), deleteTexture() {},
  enableVertexAttribArray: (...a) => calls.push(['enableVertexAttribArray', ...a]),
  disableVertexAttribArray: (...a) => calls.push(['disableVertexAttribArray', ...a]),
  vertexAttribPointer: (...a) => calls.push(['vertexAttribPointer', ...a]),
  drawArrays: (...a) => calls.push(['drawArrays', ...a]),
  drawElements() {}, uniformMatrix4fv: (...a) => calls.push(['uniformMatrix4fv', ...a]),
  uniform1i: (...a) => calls.push(['uniform1i', ...a]), uniform1f() {}, uniform4fv() {},
  uniform4iv: (location, value) => calls.push(['uniform4iv', location, Array.from(value)]),
  enable() {}, disable() {}, viewport() {}, scissor() {}, depthFunc() {}, depthMask() {},
  depthRange() {}, blendFunc() {}, cullFace() {}, frontFace() {}, lineWidth() {},
  clearColor() {}, clear() {}, readPixels() {}, finish() {}, flush() {}, getParameter: () => 4096,
  getError: () => 0,
};
const canvas = { getContext: name => name === 'webgl' ? gl : null };
const gpu = new WebGLBackend(canvas);
const buffer = gpu.createBuffer();
gpu.updateBuffer(buffer, gl.ARRAY_BUFFER, new Float32Array([1, 2, 3]), gl.STREAM_DRAW);
assert(calls.some(call => call[0] === 'bufferData'), 'backend uploads normalized buffer data');
const texture = gpu.createTexture();
gpu.uploadTexture2D(texture, {
  internalFormat: 0x1908, width: 1, height: 1, format: 0x1908,
  type: 0x1401, pixels: new Uint8Array([1, 2, 3, 4]),
});
assert(calls.some(call => call[0] === 'texImage2D'), 'backend owns texture upload');
// D3D9 re-states sampler parameters on every draw of a reused texture: a
// repeat is skipped per texture, a change or another texture still reaches GL.
const texParams = () => calls.filter(call => call[0] === 'texParameteri').map(call => call.slice(2));
gpu.setTextureParameter(texture, 0x2801, 0x2600);
gpu.setTextureParameter(texture, 0x2801, 0x2600);
gpu.setTextureParameter(texture, 0x2801, 0x2601);
gpu.setTextureParameter(gpu.createTexture(), 0x2801, 0x2601);
gpu.setTextureParameter(null, 0x2801, 0x2601);
gpu.setTextureParameter(null, 0x2801, 0x2601);
assert.deepStrictEqual(texParams(), [[0x2801, 0x2600], [0x2801, 0x2601], [0x2801, 0x2601],
  [0x2801, 0x2601], [0x2801, 0x2601]], 'texture parameter cache is per texture and never caches the default object');
const program = gpu.createProgram('vertex', 'fragment', ['a'], ['u']);
gpu.setUniform(program, 'u', '1i', 7);
gpu.setUniform(program, 'u', '1i', 7);
const command = {
  program, vertexBuffer: buffer, mode: 4, count: 3, stride: 12,
  attributes: [{ name: 'a', size: 3, offset: 0 }],
};
gpu.draw(command);
gpu.draw(command);
assert.strictEqual(calls.filter(call => call[0] === 'useProgram').length, 1,
  'backend caches the active WebGL program');
assert.strictEqual(calls.filter(call => call[0] === 'uniform1i').length, 1,
  'backend skips unchanged uniform values');
assert.strictEqual(calls.filter(call => call[0] === 'enableVertexAttribArray').length, 1,
  'backend enables a stable attribute layout once');
assert.strictEqual(calls.filter(call => call[0] === 'vertexAttribPointer').length, 1,
  'backend reuses unchanged vertex attribute pointers');
gpu.setUniform(program, 'u', '1i', 8);
assert.strictEqual(calls.filter(call => call[0] === 'uniform1i').length, 2,
  'changed uniform values still reach WebGL');
const secondBuffer = gpu.createBuffer();
const matrix = new Float32Array(16);
matrix[0] = NaN;
gpu.setUniform(program, 'u', 'matrix4', matrix);
gpu.setUniform(program, 'u', 'matrix4', matrix);
assert.strictEqual(calls.filter(c => c[0] === 'uniformMatrix4fv').length, 1,
  'unchanged NaN lanes compare equal');
matrix[1] = -0;
gpu.setUniform(program, 'u', 'matrix4', matrix);
matrix[15] = 2;
gpu.setUniform(program, 'u', 'matrix4', matrix);
assert.strictEqual(calls.filter(c => c[0] === 'uniformMatrix4fv').length, 3,
  'signed zero and in-place changes are detected against an owned snapshot');
const integers = new Int32Array([-2147483648, 7, 2147483647, -1]);
gpu.setUniform(program, 'u', '4i', integers);
gpu.setUniform(program, 'u', '4i', integers);
assert.strictEqual(calls.filter(c => c[0] === 'uniform4iv').length, 1);
integers[1] = 8;
gpu.setUniform(program, 'u', '4i', integers);
assert.deepStrictEqual(calls.filter(c => c[0] === 'uniform4iv').map(c => c[2]),
  [[-2147483648, 7, 2147483647, -1], [-2147483648, 8, 2147483647, -1]],
  'integer cache snapshots every lane and preserves signed words');
gpu.draw({ ...command, vertexBuffer: secondBuffer });
assert.strictEqual(calls.filter(call => call[0] === 'vertexAttribPointer').length, 2,
  'changing the source buffer invalidates the cached attribute pointer');
console.log('PASS generic WebGL/GLES backend resource contract');

// Allocation/compile/link failures must retire every successfully created
// object, including the vertex shader when fragment compilation fails.
for (const failure of ['vertex-allocation','fragment-allocation','vertex-compile',
    'fragment-compile','program-allocation','link','feedback','location',null]) {
  const createdShaders=[],deletedShaders=[],createdPrograms=[],deletedPrograms=[];
  const faultGL={...gl,
    createShader(type) {
      if(failure===`${type===gl.VERTEX_SHADER?'vertex':'fragment'}-allocation`)return null;
      const shader={type};createdShaders.push(shader);return shader;
    },
    getShaderParameter(shader) {return failure!==`${shader.type===gl.VERTEX_SHADER?'vertex':'fragment'}-compile`;},
    deleteShader(shader) {deletedShaders.push(shader);},
    createProgram() {if(failure==='program-allocation')return null;const p={};createdPrograms.push(p);return p;},
    getProgramParameter() {return failure!=='link';},
    deleteProgram(p) {deletedPrograms.push(p);},
    transformFeedbackVaryings() {if(failure==='feedback')throw new Error('feedback setup failed');},
    getAttribLocation() {if(failure==='location')throw new Error('location lookup failed');return 0;},
  };
  const backend=new WebGLBackend({getContext:()=>faultGL},{apiVersion:2});
  const create=()=>backend.createProgram('void main(){}','void main(){}',['a'],[],{transformFeedbackVaryings:['result']});
  if(failure)assert.throws(create,Error,failure);else create();
  assert.deepStrictEqual(new Set(deletedShaders),new Set(createdShaders),`${failure}: shader retirement`);
  assert.strictEqual(deletedShaders.length,createdShaders.length,`${failure}: exactly once`);
  assert.strictEqual(backend._programs.size,failure?0:1,`${failure}: publish only complete programs`);
  if(failure)assert.deepStrictEqual(deletedPrograms,createdPrograms,`${failure}: program retirement`);
  else {assert.strictEqual(deletedPrograms.length,0);backend.destroy();assert.deepStrictEqual(deletedPrograms,createdPrograms);}
}
console.log('PASS shader/program allocation and compile/link failure retirement');
