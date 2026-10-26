'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs'), Module = require('node:module'), path = require('node:path');
const host = require.resolve('../lib/d3d9-host'), helper = require.resolve('../tools/d3d9-rgba-benchmark');
function read(filename) {
  const fd=fs.openSync(filename,'r'), chunk=Buffer.alloc(65536), parts=[];
  try {
    let n,total=0;
    while ((n=fs.readSync(fd,chunk,0,chunk.length,null))) {
      total+=n; assert(total<=2097152); parts.push(Buffer.from(chunk.subarray(0,n)));
    }
    return Buffer.concat(parts).toString();
  } finally { fs.closeSync(fd); }
}
const original=read(host), helperSource=read(helper);
const anchor='const src=new Uint8Array(memory,g2w(bits),byteLength);';
function load(prefix='',code='') {
  const saved=[host,helper].map(p=>[p,require.cache[p]]);
  function compile(filename,source) {
    const m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
    require.cache[filename]=m;m._compile(source,filename);m.loaded=true;return m.exports;
  }
  try {
    assert.equal(original.split(anchor).length,2);
    compile(host,prefix+original.replace(anchor,anchor+code));
    return compile(helper,helperSource);
  } finally {for(const [p,m] of saved) {if(m)require.cache[p]=m;else delete require.cache[p];}}
}

const probes=[
  {name:'indexed reads',prefix:'',code:'let total=0;for(let k=0;k<src.length;k++)total+=src[k];this.extraOperation=total;',
    check(c,n){assert.equal(c.indexedSourceReads,n);}, reason:/indexed source read/},
  {name:'lexically captured copy',prefix:'const ArbitraryByteClass=Uint8Array;\n',
    code:'this.extraOperation=new ArbitraryByteClass(src);',
    check(c,n){assert.equal(c.sourceCopyBytes,n);assert.equal(c.constructorCopyBytes,n);assert.equal(c.allocationBytes,5632+n);},reason:/private source copy/},
  {name:'backing store through captured constructors',prefix:'const BackingStore=ArrayBuffer,ByteView=Uint8Array;\n',
    code:'this.extraOperation=new ByteView(new BackingStore(src.length));',
    check(c,n){assert.equal(c.backingAllocationBytes,n);},reason:/backing allocation/},
];
for (const side of [16,32,64]) for (const p of probes) test(`${p.name}, actual warm exported producer ${side}`,async()=>{
  const h=load(p.prefix,p.code),f=h.fixture(side);
  try {
    assert.equal(f.draw(),1);await f.drain();
    const c=h.measure(f);await f.drain();p.check(c,f.bytes);
    assert.throws(()=>h.budget(c,f.bytes,f.bytes,true),p.reason);
    assert.deepEqual(f.seen.at(-1).pixels,f.expected());
  } finally {await f.close();}
});

for(const throwing of [false,true]) test(`entry accessors and own descriptors restored (${throwing?'throw':'normal'})`,async()=>{
  const h=load(),f=h.fixture(16),Native=Uint8Array;
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'Uint8Array');
  const before=Object.fromEntries(['every','slice','set'].map(k=>[k,Object.getOwnPropertyDescriptor(Native.prototype,k)]));
  let calls=0;
  const entry=new Proxy(Native,{construct(t,a){calls++;return Reflect.construct(t,a);}});
  try {
    assert.equal(f.draw(),1);await f.drain();
    Object.defineProperty(globalThis,'Uint8Array',{get:()=>entry,enumerable:true,configurable:true});
    const globalEntry=Object.getOwnPropertyDescriptor(globalThis,'Uint8Array');
    for (const key of ['every','slice','set']) {
      const fn=Native.prototype[key];
      Object.defineProperty(Native.prototype,key,{value:function(...args){return fn.apply(this,args);},writable:false,enumerable:true,configurable:true});
    }
    const hooks=Object.fromEntries(['every','slice','set'].map(k=>[k,Object.getOwnPropertyDescriptor(Native.prototype,k)]));
    const resident=f.bridge._residentLevel;
    Object.defineProperty(f.bridge,'_residentLevel',{value:resident,writable:false,enumerable:true,configurable:true});
    const own=Object.getOwnPropertyDescriptor(f.bridge,'_residentLevel');
    const snap=f.bridge._textureSnapshots.get(f.records[0]+64),source=snap.source;
    if(throwing) assert.throws(()=>h.measure(f,()=>{throw Error('restoration sentinel');}),/sentinel/);
    else {h.budget(h.measure(f),f.bytes,f.bytes,true);assert(calls>0);await f.drain();}
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'Uint8Array'),globalEntry);
    for(const k of Object.keys(hooks)) assert.deepEqual(Object.getOwnPropertyDescriptor(Native.prototype,k),hooks[k]);
    assert.deepEqual(Object.getOwnPropertyDescriptor(f.bridge,'_residentLevel'),own);
    assert.equal(snap.source,source);
    assert(!Object.hasOwn(f.bridge,'_rememberTexture'));
  } finally {
    Object.defineProperty(globalThis,'Uint8Array',descriptor);
    for(const [k,d] of Object.entries(before)) {if(d)Object.defineProperty(Native.prototype,k,d);else delete Native.prototype[k];}
    await f.close();
  }
});

test('generic AST observation preserves evaluation order, constructors, lvalues and method receivers',()=>{
  const {instrument}=require('../tools/d3d9-operation-observer');
  const source=`const log=[];const a=[4];const key=()=>{log.push('key');return 0;};
    class T {constructor(x){log.push(x);this.x=x;}}
    const o={m(x){log.push(this===o);return x;}};
    const r=new T(o['m'](a[key()]));a[key()]+=2;a[key()]++;
    module.exports={log,a,x:r.x,s:'new X(a[0])'};`;
  const execute=code=>{
    const m={exports:{}};let reads=0,allocations=0;
    const observer={read(o,k){reads++;return o[k];},construct(t,a){allocations++;return Reflect.construct(t,a);}};
    Function('module','__renderOperationObserver',code)(m,observer);return {value:m.exports,reads,allocations};
  };
  const plain=execute(source),observed=execute(instrument(source));
  assert.deepEqual(observed.value,plain.value);assert.equal(observed.reads,1);assert.equal(observed.allocations,1);
  assert.throws(()=>instrument('const a=b?.[c].d;'),/outside the observer grammar/);
});

test('object-valued source indices are observed with one native key conversion',async()=>{
  const h=load('',`let total=0,coercions=0;
    for(let j=0;j<src.length;j++)total+=src[{[Symbol.toPrimitive](){coercions++;return String(j);}}];
    this.extraOperation={total,coercions};`),f=h.fixture(16);
  try {
    assert.equal(f.draw(),1);await f.drain();
    const c=h.measure(f);await f.drain();
    assert.equal(f.bridge.extraOperation.coercions,f.bytes);
    assert.equal(f.bridge.extraOperation.total,f.source().reduce((a,b)=>a+b,0));
    assert.equal(c.indexedSourceReads,f.bytes);
    assert.throws(()=>h.budget(c,f.bytes,f.bytes,true),/indexed source read/);
  } finally {await f.close();}
});

for(const side of [16,32,64]) test(`observed and native producer outputs remain equivalent ${side}`,async()=>{
  const h=load(),a=h.fixture(side),b=h.fixture(side,{},false);
  try {
    for(const change of [f=>{},f=>{},f=>{f.source()[40]^=1;},f=>{f.source()[f.bytes-1]^=1;},f=>f.replaceBuffer()]) {
      change(a);change(b);assert.equal(a.draw(),b.draw());await a.drain();await b.drain();
      assert.deepEqual(a.seen.at(-1).pixels,b.seen.at(-1).pixels);
      assert.equal(a.wire.at(-1).pixels===undefined,b.wire.at(-1).pixels===undefined);
      assert.equal(a.bridge._textureSnapshotBytes,b.bridge._textureSnapshotBytes);
      assert.equal(a.bridge.devices.get(7).residentBytes,b.bridge.devices.get(7).residentBytes);
    }
  } finally {await a.close();await b.close();}
});
