#!/usr/bin/env node
'use strict';
const assert=require('assert');
const {split}=require('../lib/d3d-geometry-batches');
function fixture(primitive,count,indexed=false){
  const consumed=primitive===4?count*3:count+2,n=indexed?311:consumed;
  const vertices=new Uint8Array(n*4),view=new DataView(vertices.buffer);
  for(let i=0;i<n;i++)view.setUint32(i*4,i,true);
  return {primitive,primitiveCount:count,stride:4,vertices,
    ...(indexed?{indices:Uint32Array.from({length:consumed},(_,i)=>i%311)}:{})};
}
function triangles(s){
  const view=new DataView(s.vertices.buffer,s.vertices.byteOffset,s.vertices.byteLength);
  const value=i=>view.getUint32((s.indices?s.indices[i]:i)*s.stride,true),out=[];
  for(let i=0;i<s.primitiveCount;i++){
    const ids=s.primitive===4?[3*i,3*i+1,3*i+2]:s.primitive===6?[0,i+1,i+2]:[i+(i&1),i+1-(i&1),i+2];
    out.push(ids.map(value));
  }
  return out;
}
for(const primitive of [4,5,6])for(const indexed of [false,true]){
  const source=fixture(primitive,2950,indexed);
  if(indexed){source.indices[253]=source.indices[254];source.indices[255]=source.indices[254];}
  const expected=triangles(source),{batches,bytes}=split(source);
  assert(batches.length>1);
  assert.deepStrictEqual(batches.flatMap(triangles),expected,'global strip parity, fan hub and degenerates retained');
  for(const b of batches){assert(b.vertices.length/4<=256);assert(b.primitiveCount<=256);assert(b.indices instanceof Uint16Array);}
  assert.strictEqual(bytes,batches.reduce((n,b)=>n+b.vertices.byteLength+b.indices.byteLength,0));
  assert.strictEqual(split(source,bytes).bytes,bytes,'exact budget accepted');
  assert.throws(()=>split(source,bytes-1),/budget/);
  source.vertices.fill(0);if(source.indices)source.indices.fill(0);
  assert.deepStrictEqual(batches.flatMap(triangles),expected,'packed input remains immutable after guest reuse');
}
const bad=fixture(4,300,true);bad.indices[bad.indices.length-1]=999;
for(const primitive of [4,5,6])for(const limit of [1,17,210,256]){
 const source=fixture(primitive,513,true),expected=triangles(source);
 const {batches,bytes}=split(source,64*1024*1024,limit);
 assert(batches.every(batch=>batch.primitiveCount<=limit),'caller-selected internal triangle limit');
 assert.deepStrictEqual(batches.flatMap(triangles),expected,'splitting never limits guest draw size or changes winding');
 assert.strictEqual(split(source,bytes,limit).bytes,bytes);
 assert.throws(()=>split(source,bytes-1,limit),/budget/);
}
for(const limit of [0,-1,1.5,257,NaN,Infinity])
 assert.throws(()=>split(fixture(4,1),1024,limit),/triangle batch limit/);
assert.throws(()=>split(bad),/outside/,'late invalid index fails before any batch is returned');
{
  const vertices=new Uint8Array(65539*4),view=new DataView(vertices.buffer);
  [65536,65537,65538].forEach(i=>view.setUint32(i*4,i,true));
  const source={primitive:4,primitiveCount:1,stride:4,vertices,indices:new Uint32Array([65536,65537,65538])};
  assert.deepStrictEqual(split(source).batches.flatMap(triangles),[[65536,65537,65538]],
    'INDEX32 source values are remapped, not truncated to16 bits');
}
for(const count of [1,2,32,257,2950]) {
  const source=fixture(4,count);source.primitive=1;source.primitiveCount=count;
  const {batches,bytes}=split(source);
  const values=batches.flatMap(b=>{
    assert.strictEqual(b.primitive,1);assert(b.primitiveCount<=256);
    const v=new DataView(b.vertices.buffer,b.vertices.byteOffset,b.vertices.byteLength);
    return [...b.indices].map(i=>v.getUint32(i*b.stride,true));
  });
  assert.deepStrictEqual(values,Array.from({length:count},(_,i)=>i),'point order survives batching');
  assert.strictEqual(bytes,count*6,'points charge one packed vertex and index each');
  assert.throws(()=>split(source,bytes-1),/budget/);
}
for(const patch of [{primitive:2},{primitiveCount:-1},{stride:0},{indices:new Int16Array(900)},
  {primitiveCount:Number.MAX_SAFE_INTEGER},{vertices:new Uint8Array(3)}])
  assert.throws(()=>split({...fixture(4,300),...patch}),/D3D geometry batches/);
console.log('PASS geometry batches: 2950 triangles, all topologies, parity/degenerates, INDEX32 remap, immutable bytes and exact budgets');
