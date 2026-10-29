'use strict';
// Independent acceptance of 19eee921: hand-calculated oracles, real call/replay.
// No resize/conversion algorithm is copied into this test.
const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const filename = require.resolve('../lib/gl-compat');
let source = fs.readFileSync(filename, 'utf8');
assert.strictEqual(crypto.createHash('sha256').update(source).digest('hex'),
  '6593bc0ae954d750f1800513799005c1797cdefeb3e68c70a46e06f209ec41a2',
  'acceptance must start from exact candidate production bridge');
const control = process.argv[2] || 'candidate';
const changes = {
  math: ['Math.max(1, wi / wo) / 2', 'Math.max(1, wi / wo) / 4'],
};
if (control === 'math') {
  const [from, to] = changes.math;
  assert.strictEqual(source.split(from).length, 2, 'unique math mutation site');
  source = source.replace(from, to);
} else assert.strictEqual(control, 'candidate');
let gl;
if (control === 'candidate') gl = require(filename);
else {
  const Module = require('module'), m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths;
  m._compile(source, filename); gl = m.exports;
}
const stream = require('../lib/gl-command-stream');
assert.strictEqual(gl.CALL_INDEX.gluScaleImage, 141);
assert.strictEqual(stream.ARG_WORDS[141], 9);
assert(stream.BARRIERS.has(141));
console.log(JSON.stringify({control, loaded: true,
  sourceSHA256: crypto.createHash('sha256').update(source).digest('hex')}));
const L = 0x1909, RGB = 0x1907, U8 = 0x1401, U16 = 0x1403, BIT = 0x1a00;
let checks = 0;
function fixture(mode) {
  const memory = new ArrayBuffer(131072), bytes = new Uint8Array(memory), dv = new DataView(memory);
  let translate = p => p;
  const bridge = new gl.OpenGLHostBridge({getMemory: () => memory,
    exports: {guest_to_wasm: p => translate(p)}});
  const backend = {gl: {}, createProgram: () => ({}), createBuffer: () => ({}),
    createTexture: () => ({}), getError: () => 0};
  const frontend = new gl.FixedFunctionGL(backend);
  bridge.current = 1; bridge.contexts.set(1, {frontend});
  function invoke(name, args) {
    if (mode === 'call') {
      dv.setUint32(256, 0x87654321, true);
      args.forEach((v,i) => dv.setUint32(260+i*4, v >>> 0, true));
      return bridge.call(gl.CALL_INDEX[name], 256, 0);
    }
    const size = 36 + args.length*4, buffer = new ArrayBuffer(size), d = new DataView(buffer);
    d.setUint32(0, size, true); d.setUint32(4, gl.CALL_INDEX[name], true);
    d.setUint32(12, 4+args.length*4, true); d.setUint32(32, 0x87654321, true);
    args.forEach((v,i) => d.setUint32(36+i*4,v >>> 0,true));
    return bridge.replay({buffer, bytes: size, commands: 1}, 0);
  }
  const store = (p,v) => invoke('glPixelStorei',[p,v]);
  store(0xcf5,1); store(0xd05,1);
  return {bytes, dv, bridge, invoke, store, frontend,
    map: fn => {translate=fn;}, at: p => translate(p),
    scale: args => invoke('gluScaleImage',args)};
}
function equal(actual, expected, label) {assert.deepStrictEqual(actual, expected, label); checks++;}
function resize(f, values, wi, hi, wo, ho, expected, label) {
  f.bytes.set(values,4096); f.bytes.fill(0xcd,16384,16448);
  equal(f.scale([L,wi,hi,U8,4096,wo,ho,U8,16384]),0,label+' status');
  equal(Array.from(f.bytes.slice(16384,16384+wo*ho)),expected,label);
  equal(f.bytes[16384+wo*ho],0xcd,label+' trailing canary');
}
for (const mode of ['call','replay']) {
  let f=fixture(mode);
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
  f=fixture(mode); f.store(0xcf0,1); f.store(0xcf2,4);
  f.store(0xcf3,1); f.store(0xcf4,1); f.store(0xd02,5);
  f.store(0xd03,1); f.store(0xd04,2); f.store(0xd05,4);
  f.bytes.fill(0xcd,16384,16480);
  [0xf800,0x07e0,0x001f,0xffff].forEach((v,i) => f.dv.setUint16(4096+10+Math.floor(i/2)*8+(i%2)*2,v,false));
  equal(f.scale([RGB,2,2,0x8363,4096,2,2,U8,16384]),0,mode+' packed offsets status');
  const want = new Array(96).fill(0xcd);
  want.splice(22,6,255,0,0,0,255,0); want.splice(38,6,0,0,255,255,255,255);
  equal(Array.from(f.bytes.slice(16384,16480)),want,mode+' packed offsets and padding');

  // Bitmap row crossing byte boundaries, opposite LSB modes and unrelated bits.
  f=fixture(mode); f.store(0xcf1,1); f.store(0xcf2,16); f.store(0xcf3,1); f.store(0xcf4,7);
  f.store(0xd02,24); f.store(0xd03,1); f.store(0xd04,5);
  f.bytes.set([0x80,0x02,0x00,0x02],4098); // [1,0,1], [0,0,1]
  f.bytes.fill(0xaa,16384,16400);
  equal(f.scale([L,3,2,BIT,4096,3,2,BIT,16384]),0,mode+' bitmap status');
  const bitmapWant=new Array(16).fill(0xaa); bitmapWant[3]=0xad; bitmapWant[6]=0xa9;
  equal(Array.from(f.bytes.slice(16384,16400)),bitmapWant,mode+' bitmap offsets and untouched bits');

  f=fixture(mode);
  [0,0.5,1].forEach((v,i)=>f.dv.setFloat32(4096+i*4,v,true));
  equal(f.scale([L,3,1,0x1406,4096,3,1,U16,16384]),0,mode+' float to ushort status');
  equal([0,1,2].map(i=>f.dv.getUint16(16384+i*2,true)),[0,32767,65535],
    mode+' float truncation into SGI unsigned intermediate');
  f.bytes.set([0,127,128,255],4096); f.bytes[16384]=0xa5; f.store(0xd04,2);
  equal(f.scale([L,4,1,U8,4096,4,1,BIT,16384]),0,mode+' scalar to bitmap status');
  equal(f.bytes[16384],0x8d,mode+' bitmap half-range threshold and preserved outside bits');

  // Scalar straddles discontiguous physical pages, with swapped input bytes;
  // overlapping guest output must snapshot every input before writing.
  f=fixture(mode);
  const base=0x10000000, pages=[65536,81920,73728];
  f.map(p => p>=base && p<base+12288 ? pages[(p-base)>>>12]+((p-base)&4095) : p);
  const input=base+4095;
  f.store(0xcf0,1);
  [0x12,0x34,0xab,0xcd,0x7f,0xff].forEach((v,i) => f.bytes[f.at(input+i)]=v);
  equal(f.scale([L,3,1,U16,input,3,1,U16,input+1]),0,mode+' overlap sparse scalar status');
  equal(Array.from({length:6},(_,i)=>f.bytes[f.at(input+1+i)]),
    [0x34,0x12,0xcd,0xab,0xff,0x7f],mode+' overlap sparse scalar bytes');

  // A later missing page must fail before *any* output, including the valid
  // prefix. Check both input and output failures through each real boundary.
  for (const invalidSide of ['input','output']) {
    f=fixture(mode); f.bytes.fill(0xcd,16384,32768); f.bytes.fill(39,4096,8192);
    f.map(p => p>=0x20000000 && p<0x20002000
      ? (p<0x20001000 ? 24576+(p&4095) : 0xf0) : p);
    const before=f.bytes.slice(16384,32768);
    equal(f.scale([L,4,1,U8,invalidSide==='input'?0x20000ffe:4096,
      4,1,U8,invalidSide==='output'?0x20000ffe:16384]),100901,mode+' malformed '+invalidSide+' status');
    equal(f.bytes.slice(16384,32768),before,mode+' malformed '+invalidSide+' whole-output atomicity');
  }
  f=fixture(mode); f.bytes.fill(0xcd,16384,16400);
  // SGI explicitly returns zero before checking negatives or enum validity.
  equal(f.scale([0xdead,0,-1,0xdead,0,1,1,0xdead,0]),0,mode+' zero-before-negative');
  equal(f.scale([L,-1,1,U8,4096,1,1,U8,16384]),100901,mode+' negative');
  equal(f.scale([L,1,1,0xdead,4096,1,1,U8,16384]),100900,mode+' enum');
  equal(f.scale([L,1,1,U8,4096,1,1,0x8363,16384]),100904,mode+' packed incompatibility');
  equal(f.scale([L,8388608,1,U8,4096,1,1,U8,16384]),100902,mode+' bounded scratch');
  equal(Array.from(f.bytes.slice(16384,16400)),new Array(16).fill(0xcd),mode+' errors preserve output');
  // Return from actual replay is the synchronous publication boundary.
  equal(f.bridge._capture,null,mode+' capture restored');
  console.log(mode+' independent challenges PASS');
}
console.log(JSON.stringify({control,checks,result:'PASS'}));
