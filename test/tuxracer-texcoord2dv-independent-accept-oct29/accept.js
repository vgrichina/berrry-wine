'use strict';
// Reuse only the published fragment runner declarations, not its eight-case
// acceptance group. The runner compiles actual generated dispatch + handler +
// scalar loads + packed vertex encoder. No historical supervisor is executed.
const fs=require('fs'), path=require('path'), assert=require('assert');
const vm=require('vm'), crypto=require('crypto'), {createRequire}=require('module');
const root=path.resolve(__dirname,'../..');
const fixture=path.join(root,'test/test-gl-texcoord2dv-dispatch.js');
const source=fs.readFileSync(fixture,'utf8');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.strictEqual(sha(source),'43a95e5f9ba938f7cb4888370207bd1b7d27857cb82a1ebe4036bcf71494d3df');
const prefix=source.slice(0,source.indexOf('function acceptance(h) {'));
assert(prefix.endsWith('\n'));
const ctx={require:createRequire(fixture),__dirname:path.dirname(fixture),Buffer,console,WebAssembly};
vm.createContext(ctx);
vm.runInContext(prefix+'\nthis.api={boot,originals,fragments,id,hash};',ctx,{filename:fixture});
const {boot,originals,fragments,id}=ctx.api;
const write=(h,p,s,t)=>{const b=Buffer.alloc(16);b.writeDoubleLE(s);b.writeDoubleLE(t,8);for(let i=0;i<16;i++)h.view.setUint8(h.translate(p+i),b[i]);};
function regs(h){h.view.setUint32(256,0xded00bad,true);h.view.setUint32(272,0x402800,true);}
const bits=x=>{const b=Buffer.alloc(4);b.writeFloatLE(x);return b.readUInt32LE();};
function vector(h,n){return new Float32Array(h.e.memory.buffer,h.e.vertices()+n*4,19);}
function invokeAndPack(h,p,s,t,append4=false){
 write(h,p,s,t);regs(h);const n=h.e.count();h.e.invoke(p);
 assert.strictEqual(h.e.count(),n,'coordinate update emits no vertex');
 assert.strictEqual(h.view.getUint32(256,true),0,'EAX convention');
 assert.strictEqual(h.view.getUint32(272,true),0x402808,'one pointer stdcall');
 assert.strictEqual(h.e.available(id),1,'actual availability');
 if(append4)h.e.adjacent4(3,5,7,-2);else h.e.adjacent3(3,5,7);
 const a=vector(h,n);
 for(const [i,x] of [[7,s],[8,t]]) {
  if(Number.isNaN(x))assert(Number.isNaN(a[i]),'NaN class preserved');
  else assert.strictEqual(h.view.getUint32(h.e.vertices()+(n+i)*4,true),bits(Math.fround(x)),'IEEE packed coordinate bits');
 }
 assert.deepStrictEqual(Array.from(a.slice(0,7)),[3,5,7,.25,.5,.75,.125]);
 assert.deepStrictEqual([a[9],a[13],a[14],a[15],a[16],a[17],a[18]],[-.5,-.625,append4?-2:1,0,1,-2,3]);
 assert.strictEqual(h.e.count(),n+19);return Buffer.from(new Uint8Array(h.e.memory.buffer,h.e.vertices()+n*4,76));
}
// FIRST behavioral check: unchanged published runner/production route and the
// first published pointer/value reproducer, once, not its historical suite.
const first=boot();first.e.attributes();first.e.mode(4);
invokeAndPack(first,0x402003,-1.25,2.75);
const baseline={PASS:true,route:'actual dispatch_api_table -> page17 -> handle_glTexCoord2dv',fixtureSHA:sha(source),runnerPrefixSHA:sha(prefix),moduleSHA:first.moduleSHA};
fs.writeFileSync(path.join(__dirname,'boundary-checkpoint.json'),JSON.stringify(baseline,null,2)+'\n');
// New IEEE classes absent from the eight published cases: ties at zero and
// subnormal boundaries, finite overflow, infinities and NaNs. All 16 possible
// vector-start offsets next to a page boundary are covered on non-affine pages.
const ieee=[
 [2**-150,-(2**-150)], [3*2**-150,-3*2**-150],
 [2**-149,-(2**-149)], [2**-126-2**-150,-(2**-126-2**-150)],
 [Number.MIN_VALUE,-Number.MIN_VALUE], [Number.MAX_VALUE,-Number.MAX_VALUE],
 [Infinity,-Infinity], [NaN,1.25], [-4.25,NaN],
 [0,-0], [-0,0], [16777217,-16777219],
 [1+2**-24,1+3*2**-24], [-1-2**-24,-1-3*2**-24],
 [3.4028234663852886e38,-3.4028234663852886e38], [1e-300,-1e-300]
];
const h=boot();h.e.attributes();h.e.mode(4);
const immutable=[];
for(let i=0;i<ieee.length;i++) {
 const p=0x50000000+(i+1)*0x1000+4080+i;
 const n=h.e.count();const a=invokeAndPack(h,p,...ieee[i],!!(i&1));
 immutable.push({n,bytes:a});
 for(const prior of immutable)assert.deepStrictEqual(Buffer.from(new Uint8Array(h.e.memory.buffer,h.e.vertices()+prior.n*4,76)),prior.bytes,'later current-state updates preserve earlier vertex records');
}
// Distinct error boundary: first double succeeds, second page is unavailable.
// Seed a valid existing record first; contract excludes initializer allocation
// state, but requires caller registers/current attributes/old record unchanged.
const f=boot(false,false,true);f.e.attributes();f.e.mode(4);
const old=invokeAndPack(f,0x402010,6.5,-7.25);regs(f);
const before=Buffer.from(new Uint8Array(f.e.memory.buffer,256,32));const count=f.e.count();
assert.throws(()=>f.e.invoke(0x50000ff8),WebAssembly.RuntimeError);
assert.deepStrictEqual(Buffer.from(new Uint8Array(f.e.memory.buffer,256,32)),before);
assert.strictEqual(f.e.count(),count);
assert.deepStrictEqual(Buffer.from(new Uint8Array(f.e.memory.buffer,f.e.vertices(),76)),old);
f.e.adjacent3(3,5,7);const preserved=vector(f,count);
assert.strictEqual(preserved[7],6.5);assert.strictEqual(preserved[8],-7.25);
// Guard unsigned end-of-address-space vectors before translation/load; no
// success epilogue or partial texture update is permitted after either trap.
for(const p of [0xfffffff1,0xffffffff]) {
 regs(h);const oldregs=Buffer.from(new Uint8Array(h.e.memory.buffer,256,32));const n=h.e.count();
 assert.throws(()=>h.e.invoke(p),WebAssembly.RuntimeError);
 assert.deepStrictEqual(Buffer.from(new Uint8Array(h.e.memory.buffer,256,32)),oldregs);
 assert.strictEqual(h.e.count(),n);
}
// A fresh state update outside Begin is retained for the next Begin, rather
// than being ignored or generating a phantom vertex.
h.e.mode(-1);write(h,0x402100,-(2**-149),Infinity);regs(h);const n=h.e.count();h.e.invoke(0x402100);h.e.adjacent3(3,5,7);assert.strictEqual(h.e.count(),n);
h.e.mode(4);h.e.adjacent3(3,5,7);const outside=vector(h,n);assert.strictEqual(bits(outside[7]),bits(-(2**-149)));assert.strictEqual(outside[8],Infinity);
// Rejecting mutation of actual handler instructions in TEST LOCAL fragments.
// This wrong-coordinate mutation still routes successfully and cleans ESP,
// so detecting only an unimplemented-route trap would not satisfy the oracle.
const originalHandler=fragments[1];
assert(originalHandler.includes('(global.set $gl_tex_s (local.get $s))'));
fragments[1]=originalHandler.replace('(global.set $gl_tex_s (local.get $s))','(global.set $gl_tex_s (local.get $t))');
const bad=boot();bad.e.attributes();bad.e.mode(4);
assert.throws(()=>invokeAndPack(bad,0x50000ffb,2**-149,-Infinity),/IEEE packed coordinate bits/);
fragments[1]=originalHandler;
const wrongRoute=boot(true);wrongRoute.e.attributes();wrongRoute.e.mode(4);
assert.throws(()=>invokeAndPack(wrongRoute,0x402003,1,2),WebAssembly.RuntimeError);
const result={PASS:true,newIEEEBoundaryCases:16,allPageOffsets:Array.from({length:16},(_,i)=>4080+i),lateTranslationAtomicity:1,unsignedOverflowGuards:2,outsideBeginState:1,priorRecordImmutabilityComparisons:136,mutations:{wrongCoordinate:'REJECTED assertion',wrongRoute:'REJECTED trap'},baseline,fixtureSHA:sha(source),runnerPrefixSHA:sha(prefix),extraction:'byte prefix through but excluding function acceptance(h); published boot unchanged; only region.end DIRECT_WINDOW replacement inherited',originalForms:originals.map(x=>({bytes:Buffer.byteLength(x),sha256:sha(x)})),transformedForms:fragments.map(x=>({bytes:Buffer.byteLength(x),sha256:sha(x)})),moduleSHA:h.moduleSHA,mutationModuleSHA:bad.moduleSHA,qualification:'production fragments only; translation and allocation fixture seams; no full module/game/browser/runtime'};
fs.writeFileSync(path.join(__dirname,'behavior-checkpoint.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({PASS:true,newCases:20,mutations:result.mutations,moduleSHA:h.moduleSHA}));
