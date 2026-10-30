'use strict';
// Independent oracle over the exact pinned production-fragment loader. Only
// fixture page placement changes; production instruction text stays unchanged.
const assert=require('assert'),fs=require('fs'),path=require('path'),crypto=require('crypto'),Module=require('module');
const root=path.resolve(__dirname,'../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const harnessPath=path.join(root,'test/test-gl-vertex2dv-dispatch.js');
const harness=fs.readFileSync(harnessPath,'utf8');
assert.strictEqual(sha(harness),'46cc6da88817f23effa278edd4726bfc274bbbc28c4c842962a9e1e855e58918');
const cutoff=harness.indexOf('const h=boot();acceptance(h);');assert(cutoff>0);
let loader=harness.slice(0,cutoff);
const oldTranslation=`const translate = p => p >= 0x50000000 ?
    0x8000 + (((p-0x50000000)>>>12)*0x2000) + (p&4095) : p-0x400000+4096;`;
assert(loader.includes(oldTranslation));
// Deliberately reversed/nonlinear placements; no copied predecessor formula.
const pages=[0x380000,0x310000,0x3b0000,0x350000];
loader=loader.replace(oldTranslation,`const pages=[0x380000,0x310000,0x3b0000,0x350000];
  const translate=p=>p>=0x68000000 && p<0x68004000 ?
    pages[(p-0x68000000)>>>12]+(p&4095):p-0x400000+4096;`);
// Evaluate under the loader's actual filename so its original source/compiler
// resolution stays unchanged. The inherited acceptance function is not called.
const m=new Module(harnessPath,module);m.filename=harnessPath;m.paths=Module._nodeModulePaths(path.dirname(harnessPath));
m._compile(loader+'\nmodule.exports={boot,originals,fragments,traps,id};',harnessPath);
const {boot,originals,fragments,traps,id}=m.exports;
assert.strictEqual(id,4448);assert(traps.has('$handle_fallback'));assert(traps.has('$handle_gl_unimplemented'));
const api=JSON.parse(fs.readFileSync(path.join(root,'src/api_table.json')));
assert.deepStrictEqual([api[id].handler,api[id].nargs,api[id].convention],['glVertex2dv',1,'stdcall']);
const cases=[
 [0x68000ff9,-19.625,123.0625],
 [0x68001ff1,1+2**-24,1+3*2**-24],
 [0x68002ffd,-(2**-149),2**-150],
 [0x68000fff,-0,Number.MIN_VALUE],
 [0x68001ffb,-Math.PI,16777217.5],
 [0x68002ff8,-123456.789012345,2**80+2**30],
 [0x402007,2**-126,-(2**-150)],
 [0x40eff9,0.125,-0.875],
];
const h=boot(),e=h.e,v=h.view;e.attributes();e.mode(4);
let offsets=[];
for(const [p,x,y] of cases){
 const bytes=Buffer.alloc(16);bytes.writeDoubleLE(x);bytes.writeDoubleLE(y,8);
 for(let i=0;i<16;i++)v.setUint8(h.translate(p+i),bytes[i]);
 const beforeInput=Buffer.from(bytes);
 const esp=0x402801; // unaligned guest stack is legal and remains byte stable
 for(let i=0;i<40;i++)v.setUint8(h.translate(esp-8+i),(i*17+9)&255);
 v.setUint32(256,0xa1b2c3d4,true);v.setUint32(272,esp,true);
 const stack=Buffer.from(new Uint8Array(e.memory.buffer,h.translate(esp-8),40));
 const regs=Buffer.from(new Uint8Array(e.memory.buffer,256,64));
 const n=e.count();e.invoke(p);assert.strictEqual(e.count(),n+19);
 assert.strictEqual(v.getUint32(272,true),esp+8);assert.strictEqual(v.getUint32(256,true),0);
 const afterRegs=Buffer.from(new Uint8Array(e.memory.buffer,256,64));
 for(let i=0;i<64;i++)if(i>=4 && (i<16||i>=20))assert.strictEqual(afterRegs[i],regs[i],'neighbor register byte '+i);
 assert.deepStrictEqual(Buffer.from(new Uint8Array(e.memory.buffer,h.translate(esp-8),40)),stack);
 for(let i=0;i<16;i++)assert.strictEqual(v.getUint8(h.translate(p+i)),beforeInput[i]);
 const a=Array.from(new Float32Array(e.memory.buffer,e.vertices()+n*4,19));
 assert(Object.is(a[0],Math.fround(x)),'x double path');assert(Object.is(a[1],Math.fround(y)),'y double path');
 assert.deepStrictEqual(a.slice(2),[0,0.25,0.5,0.75,0.125,0.375,0,-0.5,0,1,0,-0.625,1,0,1,0,1]);
 offsets.push(n);
}
// Adjacent entry calls cannot mutate the successful vertex stream or stack.
const stream=Buffer.from(new Uint8Array(e.memory.buffer,e.vertices(),e.count()*4));
const registers=Buffer.from(new Uint8Array(e.memory.buffer,256,64));
for(const other of [id-1,id+1,-1,api.length+256]){
 assert.strictEqual(e.available(other),0);assert.throws(()=>e.other(other),WebAssembly.RuntimeError);
 assert.deepStrictEqual(Buffer.from(new Uint8Array(e.memory.buffer,e.vertices(),e.count()*4)),stream);
 assert.deepStrictEqual(Buffer.from(new Uint8Array(e.memory.buffer,256,64)),registers);
}
// Existing three/four-coordinate helpers still share the exact packed pipeline.
const n=e.count();e.adjacent3(-2.25,0.375,7.5);e.adjacent4(9,8,7,0.5);
const neighbor=new Float32Array(e.memory.buffer,e.vertices()+n*4,38);
assert.deepStrictEqual([neighbor[0],neighbor[1],neighbor[2],neighbor[14]],[-2.25,0.375,7.5,1]);
assert.deepStrictEqual([neighbor[19],neighbor[20],neighbor[21],neighbor[33]],[9,8,7,0.5]);
// Restoring the precise old route must trap before any pipeline/ABI changes.
const broken=boot(true);broken.e.mode(4);broken.view.setUint32(272,0x402800,true);
assert.throws(()=>broken.e.invoke(0x402000),WebAssembly.RuntimeError);
assert.strictEqual(broken.e.count(),0);assert.strictEqual(broken.view.getUint32(272,true),0x402800);
const failed=boot(false,true);failed.e.mode(4);failed.view.setUint32(272,0x402800,true);
assert.throws(()=>failed.e.invoke(0x402000),WebAssembly.RuntimeError);
assert.strictEqual(failed.e.count(),0);assert.strictEqual(failed.view.getUint32(272,true),0x402800);
console.log(JSON.stringify({PASS:true,cases:cases.length,pages,offsets,mutationRejected:true,allocationTrap:true,neighborAndFallbackTraps:true,moduleSHA:h.moduleSHA,sourceSHA:originals.map(sha),transformSHA:fragments.map(sha),fixtureLoaderSHA:sha(loader),harnessSHA:sha(harness)}));
