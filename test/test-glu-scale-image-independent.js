'use strict';
// Independent acceptance of gluScaleImage: hand-calculated oracles through the
// public opengl32/glu32 dispatch into the WAT implementation
// (src/09a8cw-gl-wgl.wat "gluScaleImage"). No resize/conversion algorithm is
// copied into this test. (The JS host implementation this once accepted, in
// lib/gl-compat.js, is retired; its sparse-page cases needed a synthetic
// guest->wasm map only that harness could supply.)
const assert = require('assert');
const { bootGlGps } = require('./helpers/gl-gps-context');
const stream = require('../lib/gl-command-stream');
assert.strictEqual(stream.CALL_INDEX.gluScaleImage, 141);
assert.strictEqual(stream.ARG_WORDS[141], 9);
assert(stream.BARRIERS.has(141));
const L = 0x1909, RGB = 0x1907, U8 = 0x1401, U16 = 0x1403, BIT = 0x1a00;
let checks = 0;
(async () => {
const G = await bootGlGps({ gps: 0 });
const base = G.e.guest_alloc(131072) >>> 0;
function fixture() {
  const bytes = new Uint8Array(G.memory.buffer, G.wa(base), 131072);
  const dv = new DataView(G.memory.buffer, G.wa(base), 131072);
  bytes.fill(0);
  const store = (p,v) => G.call('glPixelStorei',[p,v]);
  for (const p of [0xcf0,0xcf1,0xcf2,0xcf3,0xcf4,0xd00,0xd01,0xd02,0xd03,0xd04]) store(p,0);
  store(0xcf5,1); store(0xd05,1);
  // Buffer offsets are guest offsets from `base`.
  const ptr = o => o === 0 ? 0 : (base + o) >>> 0;
  return {bytes, dv, store,
    scale: a => G.call('gluScaleImage',[a[0],a[1],a[2],a[3],ptr(a[4]),a[5],a[6],a[7],ptr(a[8])]) | 0};
}
function equal(actual, expected, label) {assert.deepStrictEqual(actual, expected, label); checks++;}
function resize(f, values, wi, hi, wo, ho, expected, label) {
  f.bytes.set(values,4096); f.bytes.fill(0xcd,16384,16448);
  equal(f.scale([L,wi,hi,U8,4096,wo,ho,U8,16384]),0,label+' status');
  equal(Array.from(f.bytes.slice(16384,16384+wo*ho)),expected,label);
  equal(f.bytes[16384+wo*ho],0xcd,label+' trailing canary');
}
for (const mode of ['owned']) {
  let f=fixture();
  // Preflight: unchanged load and useful one-pixel behavior precede mutation kill.
  resize(f,[73],1,1,1,1,[73],mode+' preflight identity');
  console.log(mode+' preflight identity PASS');
  // Horizontally each row reduces to [20,100] / [140,220]. Vertical
  // enlargement uses 3/4+1/4 periodic weights, including both edges.
  resize(f,[0,60,120,120,180,240],3,2,2,4,
    [50,130,50,130,110,190,110,190],mode+' mixed 3x2 -> 2x4');
  // Each output averages six samples, not a nearest row or a square footprint.
  resize(f,[0,20,120,140,40,60,160,180,80,100,200,220],4,3,2,1,
    [50,170],mode+' non-square 4x3 -> 2x1');
  resize(f,[0,100,200],3,1,5,1,[40,40,100,160,160],mode+' periodic 3 -> 5');

  // Packed 565 input with byte swap, skipped rows/pixels and independent PACK
  // row state. Endpoints are exact primary colors; padding must remain intact.
  f=fixture(); f.store(0xcf0,1); f.store(0xcf2,4);
  f.store(0xcf3,1); f.store(0xcf4,1); f.store(0xd02,5);
  f.store(0xd03,1); f.store(0xd04,2); f.store(0xd05,4);
  f.bytes.fill(0xcd,16384,16480);
  [0xf800,0x07e0,0x001f,0xffff].forEach((v,i) => f.dv.setUint16(4096+10+Math.floor(i/2)*8+(i%2)*2,v,false));
  equal(f.scale([RGB,2,2,0x8363,4096,2,2,U8,16384]),0,mode+' packed offsets status');
  const want = new Array(96).fill(0xcd);
  want.splice(22,6,255,0,0,0,255,0); want.splice(38,6,0,0,255,255,255,255);
  equal(Array.from(f.bytes.slice(16384,16480)),want,mode+' packed offsets and padding');

  // Bitmap row crossing byte boundaries, opposite LSB modes and unrelated bits.
  f=fixture(); f.store(0xcf1,1); f.store(0xcf2,16); f.store(0xcf3,1); f.store(0xcf4,7);
  f.store(0xd02,24); f.store(0xd03,1); f.store(0xd04,5);
  f.bytes.set([0x80,0x02,0x00,0x02],4098); // [1,0,1], [0,0,1]
  f.bytes.fill(0xaa,16384,16400);
  equal(f.scale([L,3,2,BIT,4096,3,2,BIT,16384]),0,mode+' bitmap status');
  const bitmapWant=new Array(16).fill(0xaa); bitmapWant[3]=0xad; bitmapWant[6]=0xa9;
  equal(Array.from(f.bytes.slice(16384,16400)),bitmapWant,mode+' bitmap offsets and untouched bits');

  f=fixture();
  [0,0.5,1].forEach((v,i)=>f.dv.setFloat32(4096+i*4,v,true));
  equal(f.scale([L,3,1,0x1406,4096,3,1,U16,16384]),0,mode+' float to ushort status');
  equal([0,1,2].map(i=>f.dv.getUint16(16384+i*2,true)),[0,32767,65535],
    mode+' float truncation into SGI unsigned intermediate');
  f.bytes.set([0,127,128,255],4096); f.bytes[16384]=0xa5; f.store(0xd04,2);
  equal(f.scale([L,4,1,U8,4096,4,1,BIT,16384]),0,mode+' scalar to bitmap status');
  equal(f.bytes[16384],0x8d,mode+' bitmap half-range threshold and preserved outside bits');

  f=fixture(); f.bytes.fill(0xcd,16384,16400);
  // SGI explicitly returns zero before checking negatives or enum validity.
  equal(f.scale([0xdead,0,-1,0xdead,0,1,1,0xdead,0]),0,mode+' zero-before-negative');
  equal(f.scale([L,-1,1,U8,4096,1,1,U8,16384]),100901,mode+' negative');
  equal(f.scale([L,1,1,0xdead,4096,1,1,U8,16384]),100900,mode+' enum');
  equal(f.scale([L,1,1,U8,4096,1,1,0x8363,16384]),100904,mode+' packed incompatibility');
  equal(f.scale([L,8388608,1,U8,4096,1,1,U8,16384]),100902,mode+' bounded scratch');
  equal(Array.from(f.bytes.slice(16384,16400)),new Array(16).fill(0xcd),mode+' errors preserve output');
  console.log(mode+' independent challenges PASS');
}
console.log(JSON.stringify({checks,result:'PASS'}));
})().catch(e => { console.error(e); process.exitCode = 1; });
