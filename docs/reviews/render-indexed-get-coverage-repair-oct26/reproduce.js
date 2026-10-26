'use strict';
// Independent acceptance oracle. Keep these rejecting expectations unchanged.
// Run from repository root: node --test --test-concurrency=1 docs/reviews/render-subview-tagged-independent-integrate-oct26/reproduce.js
const assert=require('node:assert/strict'),{test}=require('node:test');
const fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const host=require.resolve('../../../lib/d3d9-host'),helper=require.resolve('../../../tools/d3d9-rgba-benchmark');
function read(file){const fd=fs.openSync(file,'r'),chunk=Buffer.alloc(65536),parts=[];let n,total=0;try{while((n=fs.readSync(fd,chunk,0,chunk.length,null))){total+=n;assert(total<=2097152);parts.push(Buffer.from(chunk.subarray(0,n)));}return Buffer.concat(parts).toString();}finally{fs.closeSync(fd);}}
const original=read(host),helperSource=read(helper),anchor='const src=new Uint8Array(memory,g2w(bits),byteLength);';
function load(code){
  const saved=[host,helper].map(p=>[p,require.cache[p]]);
  function compile(file,source){const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));require.cache[file]=m;m._compile(source,file);m.loaded=true;return m.exports;}
  try{assert.equal(original.split(anchor).length,2);compile(host,original.replace(anchor,anchor+code));return compile(helper,helperSource);}
  finally{for(const[p,m]of saved){if(m)require.cache[p]=m;else delete require.cache[p];}}
}

// These consume every byte via ordinary JavaScript Uint8Array indexed Get
// operations. +=0 preserves every byte. Destructuring is an indexed Get with
// no store. Both execute inside the exact synchronously loaded renderer script.
const gaps=[
  {name:'compound assignment',code:'let sum=0;const alias=src.subarray(0).subarray(0);for(let j=0;j<alias.length;j++)sum+=(alias[j]+=0);this.independentProbe=sum;'},
  {name:'computed destructuring',code:'let sum=0;const alias=src.subarray(0).subarray(0);for(let j=0;j<alias.length;j++){const {[j]:value}=alias;sum+=value;}this.independentProbe=sum;'},
];
for(const p of gaps)for(const side of[16,32,64])test(`reject complete source scan via ${p.name} ${side}`,async()=>{
  const h=load(p.code),native=h.fixture(side,{},false),observed=h.fixture(side);
  try{
    assert.equal(native.draw(),1);await native.drain();
    assert.equal(observed.draw(),1);await observed.drain();
    const before=observed.source().slice(),expected=before.reduce((a,b)=>a+b,0);
    const c=h.measure(observed);await observed.drain();
    assert.equal(native.bridge.independentProbe,expected,'native producer consumed all bytes');
    assert.equal(observed.bridge.independentProbe,expected,'observed producer consumed all bytes');
    assert.deepEqual(observed.source(),before,'source remains unchanged');
    assert.deepEqual(observed.seen.at(-1).pixels,native.seen.at(-1).pixels,'native and observed RGBA agree');
    let accepted=true;try{h.budget(c,observed.bytes,observed.bytes,true);}catch{accepted=false;}
    console.log(JSON.stringify({probe:p.name,side,bytes:observed.bytes,sum:expected,counts:c,budgetAccepted:accepted}));
    assert.equal(c.indexedSourceReads,observed.bytes,'all executed indexed Gets must be observed');
    assert.throws(()=>h.budget(c,observed.bytes,observed.bytes,true),/indexed source read/);
  }finally{await native.close();await observed.close();}
});

test('overlapping, nested, partial and outside aliases use address-union accounting',async()=>{
  const h=load(`const whole=new Uint8Array(src.buffer,src.byteOffset-9,src.length+18);
    const views=[whole,whole.subarray(3,-2).subarray(4),src.subarray(7,-13),new Uint8Array(src.buffer,512,9)];
    let sum=0;for(const v of views)for(let i=0;i<v.length;i++)sum+=v[i];this.independentProbe=sum;`),f=h.fixture(16);
  try{
    // Deliberate overlapping metadata; only record zero is drawn. The
    // independent expected count is an address Set, not interval arithmetic.
    f.bits[1]=f.bits[0]+5;f.bits[2]=f.bits[0]+11;
    assert.equal(f.draw(),1);await f.drain();const c=h.measure(f);await f.drain();
    const addresses=new Set();for(const start of f.bits)for(let i=0;i<f.bytes;i++)addresses.add(start+i);
    const ranges=[[f.bits[0]-9,f.bytes+18],[f.bits[0]-2,f.bytes+9],[f.bits[0]+7,f.bytes-20],[512,9]];
    let reads=0,sum=0;for(const[start,size]of ranges){const v=new Uint8Array(f.source().buffer,start,size);for(let i=0;i<size;i++){sum+=v[i];if(addresses.has(start+i))reads++;}}
    assert.equal(f.bridge.independentProbe,sum);assert.equal(c.indexedSourceReads,reads);
    assert.throws(()=>h.budget(c,f.bytes,f.bytes,true),/indexed source read/);
    assert.deepEqual(f.seen.at(-1).pixels,f.expected());
  }finally{await f.close();}
});

test('canonical index keys, coercion hint, OOB and throwing key restoration',async()=>{
  const h=load(`const keys=[-0,0n,'0','-0','00','1e0',NaN,Infinity,-1,src.length,Symbol('x')];
    const values=[];for(const key of keys)values.push(src[key]);let hints=[];
    values.push(src[{[Symbol.toPrimitive](hint){hints.push(hint);return 1n;}}]);
    if(this.throwKey)src[{[Symbol.toPrimitive](){throw Error('independent key sentinel');}}];
    this.independentProbe={values,hints};`),f=h.fixture(16);
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'Uint8Array');
  try{
    assert.equal(f.draw(),1);await f.drain();const c=h.measure(f);await f.drain();
    const src=f.source();assert.deepEqual(f.bridge.independentProbe,{values:[src[0],src[0],src[0],undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,src[1]],hints:['string']});
    assert.equal(c.indexedSourceReads,4);
    f.bridge.throwKey=true;assert.throws(()=>h.measure(f),/independent key sentinel/);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'Uint8Array'),descriptor);
    f.bridge.throwKey=false;h.measure(f);await f.drain();
    assert.deepEqual(f.seen.at(-1).pixels,f.expected());
  }finally{await f.close();}
});

function execute(source){const module={exports:{}};Function('module','__renderOperationObserver',source)(module,{read:(o,k)=>o[k],readOptional:(o,k)=>o==null?undefined:o[k()],construct:(t,a)=>Reflect.construct(t,a)});return module.exports;}
test('computed tag retains original receiver when key/getter/substitution mutate its variable',()=>{
  const {instrument}=require('../../../tools/d3d9-operation-observer');
  const source="'use strict';const log=[],templates=[];let receiver;const original={get tag(){log.push('getter');receiver={};return function(t,v){log.push(this===original,v);templates.push(t);return v;};}};function run(){receiver=original;return receiver[{toString(){log.push('key');return 'tag';}}]`a${(log.push('sub'),receiver={},7)}b`;}run();run();const other=original['tag']`a${7}b`;module.exports={log,same:templates[0]===templates[1],different:templates[0]!==templates[2],raw:templates[0].raw,frozen:Object.isFrozen(templates[0])&&Object.isFrozen(templates[0].raw)};";
  const plain=execute(source);assert(plain.same&&plain.different&&plain.frozen);
  assert.deepEqual(execute(instrument(source)),plain);
});
test('computed tag optional references and suspending keys reject before evaluation',()=>{
  const {instrument}=require('../../../tools/d3d9-operation-observer');
  for(const source of ['(obj?.[key])`x`;','obj?.[key]?.();','delete obj?.[key];','async function f(){return obj?.[await x];}','function* f(){return obj?.[yield x];}'])assert.throws(()=>instrument(source),/outside the observer grammar/,source);
});
