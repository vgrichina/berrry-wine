// Run after the candidate regression: node this-file.js ABSOLUTE_EVIDENCE_DIR
'use strict';
const fs = require('fs'), assert = require('assert/strict'), crypto = require('crypto');
const {compile} = require('../../tools/watx');
const dir = process.argv[2];
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const original = fs.readFileSync(dir+'/fixed.wat','utf8');
function form(s, start) {
  let depth=0;
  for(let i=start;i<s.length;i++) {
    if(s[i]==='(') depth++;
    if(s[i]===')' && --depth===0) return s.slice(start,i+1);
  }
  throw Error('unbalanced');
}
// Instrument only the fetch boundary: production sampler float32 math and
// address helper remain byte-identical. Capture all four requests, even
// zero-weight taps, independently of the membership helper's arithmetic.
const start=original.indexOf('(func $d3dim_texture_fetch_keyed\n');
assert(start>=0);
const fetch=form(original,start);
const signature=fetch.slice(0,fetch.indexOf('(local $c'));
const logged=signature+`
 (i32.store (global.get $trace)
   (i32.add (local.get $dib) (i32.add
     (i32.mul (local.get $y) (local.get $pitch)) (local.get $x))))
 (global.set $trace (i32.add (global.get $trace) (i32.const 4)))
 (i32.const 0))`;
const wat='(global $trace (mut i32) (i32.const 0))\n'+
  original.replace(fetch,logged)+'\n(func (export "reset") (global.set $trace (i32.const 0)))';
const compiled=compile(wat,new Map(),{mode:'production'});
assert(compiled.success,compiled.error);
fs.writeFileSync(dir+'/footprint.wat',wat);
fs.writeFileSync(dir+'/footprint.wasm',compiled.wasmBinary);
const e=new WebAssembly.Instance(new WebAssembly.Module(compiled.wasmBinary)).exports;
const bytes=new Uint8Array(e.memory.buffer), view=new DataView(e.memory.buffer);
const coords=[-Infinity,-3.4028234663852886e38,-1.5,-0.5,-0,0,
  1/6-2**-26,1/6,1/6+2**-26,.25,.5,.75,1,1.5,
  2147483648,3.4028234663852886e38,Infinity,NaN];
let footprints=0, memberships=0;
for(const [w,h] of [[3,5],[4,2],[1,1]]) {
  const pitch=w+7,dib=1024;
  for(const au of [0,1,2,3]) for(const av of [0,1,2,3])
    for(const u of coords) for(const v of coords) {
      e.reset();
      e.sample(w,h,8,pitch,dib,1,0,0,u,v,au,av,1);
      const actual=Array.from({length:4},(_,i)=>view.getUint32(i*4,true));
      for(const at of actual)
        assert(at>=dib && at<dib+h*pitch && (at-dib)%pitch<w);
      // A single native key at every texel distinguishes wrong addressing,
      // row-stride errors, and omitted zero-weight neighbours.
      for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
        bytes.fill(1,dib,dib+h*pitch);
        const keyAt=dib+y*pitch+x;
        bytes[keyAt]=0;
        assert.equal(e.membership(w,h,pitch,dib,u,v,au,av,0),+actual.includes(keyAt));
        memberships++;
      }
      footprints++;
    }
}
// A rejected alpha test must still reject after the new key guard restores
// eligibility. TRUE + alpha palette must retain the existing explicit trap.
const modules=['fixed','baseline'].map(name=>new WebAssembly.Instance(
  new WebAssembly.Module(fs.readFileSync(dir+'/'+name+'.wasm'))).exports);
function span(e,alpha,enable,palAlpha) {
  const b=new Uint8Array(e.memory.buffer),v=new DataView(e.memory.buffer);
  b.fill(0);
  const set=(p,n)=>v.setUint32(p,n>>>0,true);
  set(76,0x10001);set(80,32|(4<<16));set(84,4096);
  set(140,0x20002);set(144,8|(6<<16));set(148,1024);
  set(156,0x100);set(160,1);set(164,2048);set(168,palAlpha);
  for(const at of [1024,1025,1030,1031]) b[at]=1;
  set(2048,0xff000000);set(2052,0xff000000);
  set(4096,0x12345678);v.setFloat32(8192,1,true);
  e.span(64,128,0,1,1,1,1,1,2,2,enable,alpha,0,0,0,
    0,.5,.5,1,-1,.25,0,.5,.5,1,-1,.25,8192,8,1);
  return [v.getUint32(4096,true),v.getFloat32(8192,true)];
}
for(const e of modules) {
  assert.deepEqual(span(e,1,1,0),[0x12345678,1]); // NEVER
  assert.throws(()=>span(e,0,2,1),WebAssembly.RuntimeError);
}
console.log(JSON.stringify({footprints,memberships,alphaChecks:4,
  traceWAT:sha(wat),traceWasm:sha(compiled.wasmBinary),
  fixedWAT:sha(original),status:'PASS'},null,2));
