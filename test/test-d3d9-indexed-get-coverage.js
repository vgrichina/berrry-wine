'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test');
const Module=require('node:module');
const {create,instrument}=require('../tools/d3d9-operation-observer');
let serial=0;
function fixture(code,strict=true) {
  const filename=__filename+'.loaded-'+serial++;
  const m=new Module(filename,module);m.filename=filename;m.paths=module.paths;
  m._compile((strict?"'use strict';":"")+`const src=new Uint8Array([0,2,7,9]),log=[];module.exports={source:src,run(){${code}}};`,filename);
  const observed=create(filename),counts={indexedSourceReads:0};
  const leave=observed.enter({counts,isSource:(o,i)=>o===observed.exports.source&&(i===undefined||i>=0&&i<4),allocation(){}});
  try {
    const native=m.exports.run(),actual=observed.exports.run();
    assert.deepEqual(actual,native);assert.deepEqual(observed.exports.source,m.exports.source);
    return {actual,counts};
  } finally {leave();}
}
for(const op of ['+=','-=','*=','/=','%=','**=','<<=','>>=','>>>=','|=','&=','^='])test(`compound ${op}: one Get, native return/store and conversions`,()=>{
  const {counts}=fixture(`const key={[Symbol.toPrimitive](hint){log.push(hint);return '2';}};const result=(src[key]${op}2);return {result,log};`);
  assert.equal(counts.indexedSourceReads,1);
});
for(const [op,index,expected]of[['&&=',0,0],['&&=',1,1],['||=',0,1],['||=',1,0],['??=',0,0],['??=',1,0]])test(`logical ${op} index ${index}: short circuit and one Get`,()=>{
  const {counts,actual}=fixture(`let calls=0;const result=(src[{toString(){log.push('key');return '${index}';}}]${op}(calls++,3));return {result,calls,log};`);
  assert.equal(counts.indexedSourceReads,1);assert.equal(actual.calls,expected);
});
test('write-only assignment and destructuring targets do not introduce Gets',()=>{
  const {counts}=fixture(`src[0]=4;({a:src[1]}={a:5});return Array.from(src);`);assert.equal(counts.indexedSourceReads,0);
});
test('update prefix/postfix Get once and native BigInt update semantics',()=>{
  const {counts}=fixture(`const result=[src[1]++,++src[2],src[3]--,--src[0]];const obj={n:3n};result.push(obj['n']++,++obj['n']);return {result,n:obj.n};`);assert.equal(counts.indexedSourceReads,4);
});
test('key expression once; native compound Get and Set coercions can select different keys',()=>{
  const {counts,actual}=fixture(`let expr=0,coercions=0;const key={toString(){log.push('key');return String(coercions++);}};const result=(src[(expr++,key)]+=3);return {expr,coercions,result,log};`);
  assert.equal(counts.indexedSourceReads,1);assert.equal(actual.expr,1);assert.equal(actual.coercions,2);
});
test('getters/proxy keep original receiver, evaluation order and changed base variable',()=>{
  fixture(`let base;const target={get x(){log.push(this===proxy?'receiver':'wrong');base={};return 2;},set x(v){log.push(this===proxy,v);}};const proxy=new Proxy(target,{get(t,k,r){log.push('get');return Reflect.get(t,k,r);},set(t,k,v,r){log.push('set');return Reflect.set(t,k,v,r);}});base=proxy;const result=(base[(log.push('key expression'),'x')]+=(log.push('rhs'),4));return {result,log};`);
});
for(const stage of ['key','get','rhs','set'])test(`compound throwing ${stage} preserves preceding effects`,()=>{
  fixture(`const step=s=>{log.push(s);if(s==='${stage}')throw Error(s);};const obj={get x(){step('get');return 2;},set x(v){step('set');}};const key={toString(){step('key');return 'x';}};let error;try{obj[key]+=(step('rhs'),3);}catch(e){error=e.message;}return {log,error};`);
});
test('null base fails before key coercion or RHS; getter failure does not write',()=>{
  fixture(`const key={toString(){log.push('coerce');return 'x';}};let error;try{null[key]+=(log.push('rhs'),1);}catch(e){error=e.name;}return {log,error};`);
});
for(const strict of [true,false])test(`failed compound stores retain ${strict?'strict':'sloppy'} semantics`,()=>{
  fixture(`const o=Object.freeze({x:1});let error,result;try{result=(o['x']+=1);}catch(e){error=e.name;}try{(3)['x']+=1;}catch(e){log.push(e.name);}return {result,error,log};`,strict);
});
test('destructuring computed key coercion once, duplicate keys, aliases and no double reads',()=>{
  const {counts,actual}=fixture(`let expressions=0,conversions=0;const key={toString(){log.push('key');conversions++;return '2';}};const {[(expressions++,key)]:alias,[key]:second}=src;return {alias,second,expressions,conversions,log};`);
  assert.equal(counts.indexedSourceReads,2);assert.equal(actual.expressions,1);assert.equal(actual.conversions,2);
});
test('nested/default object patterns retain bindings, default timing, alias identity and source reads',()=>{
  const {counts}=fixture(`const obj={a:src,alias:src};const {a:{[1]:first},missing:{[2]:second}=(log.push('default'),src),alias}=obj;return {first,second,same:alias===src,log};`);
  assert.equal(counts.indexedSourceReads,2);
});
test('destructuring assignment result is original RHS and target evaluation precedes Get',()=>{
  const {counts,actual}=fixture(`let x;const target={set x(v){log.push('set',v);}};const key=()=>{log.push('target');return 'x';};const result=({[(log.push('key'),1)]:target[key()],[2]:x}=src);return {same:result===src,x,log};`);
  assert.equal(counts.indexedSourceReads,2);assert(actual.same);
});
test('destructuring defaults and targets may suspend in original function scope',()=>{
  // The transform does not introduce a thunk around computed keys/defaults.
  assert.doesNotThrow(()=>Function(instrument('async function f(src){let x;({[await k()]:x=await d()}=src);}')));
  assert.doesNotThrow(()=>Function(instrument('function* f(src){const {[yield 1]:x=yield 2}=src;}')));
});
test('rest enumerates native own enumerable properties and counts their individual Gets',()=>{
  const {counts}=fixture(`const {[1]:first,...rest}=src;return {first,rest};`);assert.equal(counts.indexedSourceReads,4);
});
test('getter/proxy destructuring receiver and key/get/default order',()=>{
  fixture(`const sym=Symbol('key');let expected;const obj={get x(){log.push(this===expected);return undefined;},[sym]:src};const proxy=new Proxy(obj,{get(t,k,r){log.push(String(k));return Reflect.get(t,k,r);}});expected=proxy;const {[(log.push('key'),'x')]:value=(log.push('default'),3),[sym]:alias}=proxy;return {value,same:alias===src,log};`);
});
for(const stage of ['key','get','default','target'])test(`destructuring throwing ${stage} preserves evaluation order`,()=>{
  fixture(`const step=s=>{log.push(s);if(s==='${stage}')throw Error(s);};const obj={get x(){step('get');return undefined;}};const target={};const key={toString(){step('key');return 'x';}};let error;try{({[key]:target[(step('target'),'v')]=(step('default'),3)}=obj);}catch(e){error=e.message;}return {error,log,v:target.v};`);
});
test('null nested destructuring fails before nested key/default evaluation',()=>{
  fixture(`let error;try{const {a:{[(log.push('key'),1)]:v}}={a:null};}catch(e){error=e.name;}return {error,log};`);
});
test('unsupported indexed patterns fail closed in parameters, catch, iteration and nested array binding',()=>{
  for(const s of ['function f({[k]:v}){}','try{}catch({[k]:v}){}','for(const {[k]:v} of list){}','const [{[k]:v}]=list;','let v;([{[k]:v}]=list);'])assert.throws(()=>instrument(s),/outside the observer grammar/,s);
});

// Exercise fault cleanup through the real benchmark's descriptor and scope
// lifecycle, rather than only comparing isolated expression results.
const fs=require('node:fs'),path=require('node:path');
function boundedRead(file) {
  const fd=fs.openSync(file,'r'),chunk=Buffer.alloc(65536),parts=[];let size=0,n;
  try {while((n=fs.readSync(fd,chunk,0,chunk.length,null))){size+=n;assert(size<=2097152);parts.push(Buffer.from(chunk.subarray(0,n)));}return Buffer.concat(parts).toString();}
  finally {fs.closeSync(fd);}
}
function producer(code) {
  const host=require.resolve('../lib/d3d9-host'),helper=require.resolve('../tools/d3d9-rgba-benchmark');
  const source=boundedRead(host),anchor='const src=new Uint8Array(memory,g2w(bits),byteLength);';
  assert.equal(source.split(anchor).length,2);
  const saved=[host,helper].map(p=>[p,require.cache[p]]);
  function load(file,body){const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));require.cache[file]=m;m._compile(body,file);m.loaded=true;return m.exports;}
  try {load(host,source.replace(anchor,anchor+code));return load(helper,boundedRead(helper));}
  finally {for(const[p,m]of saved){if(m)require.cache[p]=m;else delete require.cache[p];}}
}
for(const kind of ['compound','destructuring'])test(`${kind} key throw restores actual producer hooks and observer scope`,async()=>{
  const operation=kind==='compound'?'src[key]+=0;':'const {[key]:value}=src;';
  const h=producer(`if(this.indexedFault){const key={toString(){throw Error('indexed key sentinel');}};${operation}}`),f=h.fixture(16);
  const Native=Uint8Array,global=Object.getOwnPropertyDescriptor(globalThis,'Uint8Array');
  const hooks=Object.fromEntries(['every','slice','set'].map(k=>[k,Object.getOwnPropertyDescriptor(Native.prototype,k)]));
  try {
    assert.equal(f.draw(),1);await f.drain();
    f.bridge.indexedFault=true;assert.throws(()=>h.measure(f),/indexed key sentinel/);
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'Uint8Array'),global);
    for(const[k,d]of Object.entries(hooks))assert.deepEqual(Object.getOwnPropertyDescriptor(Native.prototype,k),d);
    assert(!Object.hasOwn(f.bridge,'_residentLevel'));assert(!Object.hasOwn(f.bridge,'_rememberTexture'));
    f.bridge.indexedFault=false;
    const recovery=h.measure(f);await f.drain();
    assert.equal(recovery.backingAllocationBytes,4096);
    assert.throws(()=>h.budget(recovery,f.bytes,f.bytes,true),/backing allocation/);
    const warm=h.measure(f);await f.drain();h.budget(warm,f.bytes,f.bytes,true);
    assert.equal(warm.indexedSourceReads,0);assert.deepEqual(f.seen.at(-1).pixels,f.expected());
  } finally {await f.close();}
});
