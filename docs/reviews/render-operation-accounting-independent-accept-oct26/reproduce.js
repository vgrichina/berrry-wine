'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const host=require.resolve('../../../lib/d3d9-host'),helper=require.resolve('../../../tools/d3d9-rgba-benchmark');
function read(p){const fd=fs.openSync(p,'r'),b=Buffer.alloc(65536),parts=[];let n,total=0;try{while((n=fs.readSync(fd,b,0,b.length,null))){total+=n;assert(total<=2097152);parts.push(Buffer.from(b.subarray(0,n)));}return Buffer.concat(parts).toString();}finally{fs.closeSync(fd);}}
const original=read(host),helperSource=read(helper),anchor='const src=new Uint8Array(memory,g2w(bits),byteLength);';
function load(prefix,code){
  const saved=[host,helper].map(p=>[p,require.cache[p]]);
  function compile(p,s){const m=new Module(p,module);m.filename=p;m.paths=Module._nodeModulePaths(path.dirname(p));require.cache[p]=m;m._compile(s,p);m.loaded=true;return m.exports;}
  try{assert.equal(original.split(anchor).length,2);compile(host,prefix+original.replace(anchor,anchor+code));return compile(helper,helperSource);}
  finally{for(const[p,m]of saved){if(m)require.cache[p]=m;else delete require.cache[p];}}
}
const probes=[
  {name:'scan',prefix:'',code:'let sum=0;for(let j=0;j<src.length;j++)sum=(sum+src[j])>>>0;this.probe=sum;',field:'indexedSourceReads',reason:/indexed source read/},
  {name:'lexical-copy',prefix:'const Captured=Uint8Array;\n',code:'this.probe=new Captured(src);',field:'sourceCopyBytes',reason:/private source copy/},
  {name:'backing',prefix:'',code:'this.probe=new Uint8Array(new ArrayBuffer(src.length));',field:'backingAllocationBytes',reason:/backing allocation/},
];
test('AST preserves ordinary constructor, receiver, key and argument evaluation order and exceptions',()=>{
  const {instrument}=require('../../../tools/d3d9-operation-observer');
  const source=`'use strict';const log=[];class Base{constructor(x){log.push(new.target.name);this.x=x;}}class Derived extends Base{};
    const obj={v:7,m(x){log.push(this===obj);return x;}};
    const key=()=>{log.push('key');return 'm';};const arg=()=>{log.push('arg');return 9;};
    const r=new Derived(obj[key()](arg()));let n=null;const skipped=n?.[arg()];
    try{new (null)(arg());}catch(e){log.push(e.name);}module.exports={log,x:r.x,derived:r instanceof Derived,skipped};`;
  function execute(s){const m={exports:{}};Function('module','__renderOperationObserver',s)(m,{read:(o,k)=>o[k],readOptional:(o,k)=>o==null?undefined:o[k()],construct:(t,a)=>Reflect.construct(t,a)});return m.exports;}
  assert.deepEqual(execute(instrument(source)),execute(source));
  assert.throws(()=>instrument('const a=b?.[c].d;'),/outside the observer grammar/);
});
for(const side of[16,32,64])for(const p of probes)test(`independent execution and measured rejection ${p.name} ${side}`,async()=>{
  const h=load(p.prefix,p.code),f=h.fixture(side);
  try{assert.equal(f.draw(),1);await f.drain();const c=h.measure(f);await f.drain();
    if(p.name==='scan')assert.equal(f.bridge.probe,f.source().reduce((a,b)=>(a+b)>>>0,0));
    if(p.name==='lexical-copy')assert.deepEqual(f.bridge.probe,f.source());
    if(p.name==='backing')assert.equal(f.bridge.probe.buffer.byteLength,f.bytes);
    assert.equal(c[p.field],f.bytes);assert.deepEqual(f.seen.at(-1).pixels,f.expected());
    assert.throws(()=>h.budget(c,f.bytes,f.bytes,true),p.reason);
    console.log(JSON.stringify({name:p.name,side,counts:c}));
  }finally{await f.close();}
});
for(const side of[16,32,64])test(`reject real full-source indexed scan through two subviews ${side}`,async()=>{
  const h=load('',`let sum=0;const halves=[src.subarray(0,src.length/2),src.subarray(src.length/2)];for(const half of halves)for(let j=0;j<half.length;j++)sum=(sum+half[j])>>>0;this.probe=sum;`),f=h.fixture(side);
  try{assert.equal(f.draw(),1);await f.drain();const c=h.measure(f);await f.drain();
    assert.equal(f.bridge.probe,f.source().reduce((a,b)=>(a+b)>>>0,0),'all source bytes actually consumed');
    assert.deepEqual(f.seen.at(-1).pixels,f.expected());
    console.log(JSON.stringify({name:'subview-scan',side,actualBytes:f.bytes,counts:c}));
    assert.throws(()=>h.budget(c,f.bytes,f.bytes,true),/indexed source read/,'real extra indexed scan must be rejected');
  }finally{await f.close();}
});
test('computed tagged-template receiver preserves actual native renderer behavior',async()=>{
  const h=load('',"const receiver={value:17,tag(){return this.value;}};this.probe=receiver['tag']``;"),native=h.fixture(16,{},false),observed=h.fixture(16);
  try{assert.equal(native.draw(),1);await native.drain();assert.equal(native.bridge.probe,17);
    assert.equal(observed.draw(),1,String(observed.bridge.lastError));await observed.drain();assert.equal(observed.bridge.probe,17);
  }finally{await native.close();await observed.close();}
});
