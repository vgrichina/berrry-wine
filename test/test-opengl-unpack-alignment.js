#!/usr/bin/env node
'use strict';

// glTexImage2D / glTexSubImage2D / gluBuild2DMipmaps read the client image the
// way GL does: rows of width*components bytes padded to GL_UNPACK_ALIGNMENT
// (default 4), the last row unpadded. The bridge used to slice
// width*height*components, which is short whenever a row is not a multiple of
// the alignment, and WebGL refused those uploads with "ArrayBufferView not big
// enough for request": Anachronox's ref_gl (RGB and LUMINANCE mip levels down
// to 2x2, alignment left at 4) drew a black page on the WebGL renderer.

const assert = require('assert');
const { FixedFunctionGL, OpenGLHostBridge, CALL_INDEX, constants: GL } = require('../lib/gl-compat');

const memory = new ArrayBuffer(8192);
const view = new DataView(memory);
const stack = 0x100;
const image = 0x400;
new Uint8Array(memory, image, 64).forEach((_, i, a) => { a[i] = i; });

const uploads = [];
const frontend = {
  unpackAlignment: 4,
  pixelStore: { 0x0CF5: 4 },
  texImage(level, internal, width, height, border, format, type, pixels) {
    uploads.push({ kind: 'image', width, height, format, alignment: this.unpackAlignment, pixels });
  },
  texSubImage(level, x, y, width, height, format, type, pixels) {
    uploads.push({ kind: 'sub', width, height, format, alignment: this.unpackAlignment, pixels });
  },
  build2DMipmaps(internal, width, height, format, type, pixels) {
    uploads.push({ kind: 'mipmaps', width, height, format, alignment: this.unpackAlignment, pixels });
  },
};
const bridge = new OpenGLHostBridge({
  getMemory: () => memory,
  exports: { guest_to_wasm: pointer => pointer },
});
bridge.current = 1;
bridge.contexts.set(1, { frontend, backend: { present() {} }, layer: { writeSeq: 0 } });

const args = (...words) => words.forEach((w, i) => view.setUint32(stack + 4 + i * 4, w >>> 0, true));
const texImage = (w, h, format) => {
  args(GL.TEXTURE_2D, 0, 3, w, h, 0, format, GL.UNSIGNED_BYTE, image);
  bridge.call(CALL_INDEX.glTexImage2D, stack, 0);
  return uploads.pop();
};
const pixelStore = (value) => { args(0x0CF5, value); bridge.call(CALL_INDEX.glPixelStorei, stack, 0); };

// Default alignment 4.
let u = texImage(2, 2, GL.RGB);
assert.strictEqual(u.pixels.length, 8 + 6, 'RGB 2x2: one padded 8-byte row plus a 6-byte last row');
assert.strictEqual(u.alignment, 4);
assert.strictEqual(u.pixels[8], 8, 'second row starts at the padded stride');
u = texImage(2, 2, GL.LUMINANCE);
assert.strictEqual(u.pixels.length, 4 + 2, 'LUMINANCE 2x2: padded row of 4, last row of 2');
u = texImage(1, 1, GL.RGB);
assert.strictEqual(u.pixels.length, 3, 'a single row is never padded');
u = texImage(4, 4, GL.RGBA);
assert.strictEqual(u.pixels.length, 64, 'RGBA rows are already 4-aligned');
u = texImage(3, 2, GL.RGB);
assert.strictEqual(u.pixels.length, 12 + 9, 'RGB 3-wide rows pad 9 -> 12');

// glPixelStorei(GL_UNPACK_ALIGNMENT, 1) means tight rows.
pixelStore(1);
u = texImage(2, 2, GL.RGB);
assert.strictEqual(u.pixels.length, 12, 'alignment 1: tight 2x2 RGB');
assert.strictEqual(u.alignment, 1);
pixelStore(8);
u = texImage(2, 2, GL.RGB);
assert.strictEqual(u.pixels.length, 8 + 6, 'alignment 8 pads the 6-byte row to 8');
pixelStore(4);

// glTexSubImage2D(target, level, x, y, w, h, format, type, pixels)
args(GL.TEXTURE_2D, 0, 0, 0, 2, 2, GL.LUMINANCE, GL.UNSIGNED_BYTE, image);
bridge.call(CALL_INDEX.glTexSubImage2D, stack, 0);
u = uploads.pop();
assert.strictEqual(u.kind, 'sub');
assert.strictEqual(u.pixels.length, 6, 'sub-image rows follow the same alignment');

// gluBuild2DMipmaps(target, components, w, h, format, type, data)
args(GL.TEXTURE_2D, 3, 2, 2, GL.RGB, GL.UNSIGNED_BYTE, image);
assert.strictEqual(bridge.call(CALL_INDEX.gluBuild2DMipmaps, stack, 0), 0);
u = uploads.pop();
assert.strictEqual(u.kind, 'mipmaps');
assert.strictEqual(u.pixels.length, 14, 'GLU reads its source with the unpack alignment too');

// Exercise the production decoder's owned RGBA path and the transfer fallback.
const decoder=Object.create(FixedFunctionGL.prototype);
decoder.pixelStore={0xcf0:0,0xcf2:0,0xcf3:0,0xcf4:0,0xcf5:8};
decoder.pixelTransfer=new Float32Array(14);
for(const i of [4,8,10,12])decoder.pixelTransfer[i]=1;
const padded=new Uint8Array([99,99,10,20,30,40,99,99,99,99,50,60,70,80,99]);
const input=padded.subarray(2,14);
const decoded=decoder._decodeTexture(input,1,2,GL.RGBA,GL.UNSIGNED_BYTE);
assert.deepStrictEqual(Array.from(decoded),[10,20,30,40,50,60,70,80]);
input.fill(0);assert.deepStrictEqual(Array.from(decoded),[10,20,30,40,50,60,70,80], 'decoded bytes own their storage');
decoder.pixelStore[0xcf2]=3;decoder.pixelStore[0xcf3]=1;decoder.pixelStore[0xcf4]=1;
const skipped=new Uint8Array(40);skipped.set([1,2,3,4],20);skipped.set([5,6,7,8],36);
assert.deepStrictEqual(Array.from(decoder._decodeTexture(skipped,1,2,GL.RGBA,GL.UNSIGNED_BYTE)),[1,2,3,4,5,6,7,8]);
const tight=new Uint8Array([20,40,60,80,100,120,140,160]);
assert.deepStrictEqual(decoder._decodeTexture(tight,1,2,GL.RGBA,GL.UNSIGNED_BYTE,true),tight,'canonical input ignores unpack state');
decoder.pixelTransfer[4]=0.5;
assert.deepStrictEqual(Array.from(decoder._decodeTexture(tight,1,2,GL.RGBA,GL.UNSIGNED_BYTE,true)),[10,40,60,80,50,120,140,160]);
decoder.pixelTransfer[4]=1;decoder.pixelTransfer[0]=1;
decoder.pixelMaps=Array.from({length:10},()=>new Float32Array([0,1]));
assert.deepStrictEqual(Array.from(decoder._decodeTexture(tight,1,2,GL.RGBA,GL.UNSIGNED_BYTE,true)),[0,0,0,0,0,0,255,255],'enabled maps retain component conversion');
decoder.pixelTransfer[0]=0;
assert.throws(()=>decoder._decodeTexture(tight.subarray(0,7),1,2,GL.RGBA,GL.UNSIGNED_BYTE,true),RangeError,'short input is not silently padded');
const floats=new Float32Array([-1,0,0.5,1,2,NaN,Infinity,-Infinity]);
assert.deepStrictEqual(Array.from(decoder._decodeTexture(floats,1,2,GL.RGBA,GL.FLOAT,true)),[0,0,128,255,255,0,255,0],'native canonical float upload clamps and rounds');
decoder.pixelStore={0xcf0:1,0xcf2:0,0xcf3:0,0xcf4:0,0xcf5:4};
const swapped=new Uint8Array(16),swappedView=new DataView(swapped.buffer);
[0,0.5,1,2].forEach((v,i)=>swappedView.setFloat32(i*4,v,false));
assert.deepStrictEqual(Array.from(decoder._decodeTexture(swapped,1,1,GL.RGBA,GL.FLOAT)),[0,128,255,255],'float byte swapping');
decoder.pixelTransfer[12]=0.5;
assert.deepStrictEqual(Array.from(decoder._decodeTexture(floats,1,1,GL.RGBA,GL.FLOAT,true)),[0,0,128,128],'float alpha transfer retains generic conversion');
console.log('PASS OpenGL unpack alignment, owned RGBA decoding, canonical rows and transfer fallback');
