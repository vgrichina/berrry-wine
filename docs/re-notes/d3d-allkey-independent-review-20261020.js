'use strict';
// Run from exact candidate repository root; output directory must contain
// footprint.wasm from the candidate regression. No source files are modified.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert/strict');
const {createRequire} = require('module');
const out = path.resolve(process.argv[2]);
const file = path.resolve('docs/re-notes/d3d-allkey-decode-20261020.js');
const context = {
  require: createRequire(file), process: {argv: [], version: process.version},
  console: {log() {}}, WebAssembly,
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(file, 'utf8') +
  '\nglobalThis.fixture={run,fixed,old,removed,sentinel};', context);
const {run,fixed,old,removed,sentinel} = context.fixture;
const trace = new WebAssembly.Instance(new WebAssembly.Module(
  fs.readFileSync(path.join(out,'footprint.wasm')))).exports;
const view = new DataView(trace.memory.buffer);
const coords = [-1.25,-0.01,0,0.1,0.5,0.9,1.01,1.25];
let cases=0, allKey=0, mixed=0, nonKey=0, offFootprint=0;
for (const [w,h] of [[3,5],[1,4],[5,1]]) {
  for (const au of [0,1,2,3]) for (const av of [0,1,2,3]) {
    for (const u of coords) for (const v of coords) {
      const pitch=w+4, dib=1024, key=7, other=8;
      trace.reset();
      trace.sample(w,h,8,pitch,dib,1,0,0,u,v,au,av,1);
      const indices=Array.from({length:4},(_,i)=>{
        const offset=view.getUint32(i*4,true)-dib;
        const x=offset%pitch, y=Math.floor(offset/pitch);
        assert(x>=0 && x<w && y>=0 && y<h);
        return y*w+x;
      });
      // All fetched keys in a NONuniform texture, then one fetched nonkey,
      // then no keys. Off-footprint texels distinguish local vs whole-texture.
      for(const variant of [0,1,2]) {
        const taps=Array(w*h).fill(other);
        if(variant!==2) for(const i of indices) taps[i]=key;
        if(variant===1) taps[indices[0]]=other;
        const mask=indices.reduce((m,i,bit)=>m|((taps[i]===key?1:0)<<bit),0);
        const c={w,h,au,av,u,v,key,taps,colors:Array(256).fill(0x12ab34)};
        const a=run(fixed,c), b=run(old,c), r=run(removed,c);
        assert.deepEqual(r,b);
        if(mask===15) {
          assert.equal(a.pixel,sentinel); assert.equal(a.depth,1);
          assert.equal(b.pixel,0xff12ab34); assert.equal(b.depth,.25);
          allKey++;
          if(taps.includes(other)) offFootprint++;
        } else {
          assert.deepEqual(a,b);
          assert.equal(a.pixel,0xff12ab34); assert.equal(a.depth,.25);
          if(mask===0) nonKey++; else mixed++;
        }
        cases++;
      }
    }
  }
}
console.log(JSON.stringify({status:'PASS',cases,allKey,mixed,nonKey,offFootprint,
  method:'Actual sampler fetch trace predicts mask; independently populated nonuniform textures exercise actual span, baseline and removed fix. Mixed assertions are preservation only.',
  limits:'Metadata adapters; no native mixed/default/zero-weight semantics inferred.'},null,2));
