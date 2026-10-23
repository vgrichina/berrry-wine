'use strict';
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
const {Device}=require('../lib/d3d9-software-backend');
const fixtures=require('./fixtures/d3d9-triangle-edge-cases');
(async()=>{
 const {exports:e,memory}=await bootRenderHarness({fonts:'none',extraWat:`
  (func (export "reverse_pointer") (param i32) (result i32) (call $w2g (local.get 0)))
  (func (export "free_head") (result i32) (global.get $free_list))`});
 const word=p=>new DataView(memory.buffer).getUint32(p,true);
 let records=[],failAt=0,creates=0;
 const pending=new Map();
 function record(desc,p){
  const n=word(desc+36),count=word(desc+48);
  if(p){const emitted=word(p+48),point=!!(word(p+100)&8),capacity=Math.ceil(emitted/7),bytes=288+capacity*(point?1162:1134);
   assert.strictEqual(word(p+196),bytes,'minimal compatible capacity');
   assert.strictEqual(word(p+156),p+288+capacity*1120,'relocated indices');
   assert.strictEqual(word(p-4),(bytes+11)&~7,'actual heap block shrunk');
   assert(e.d3d_software_retained_bound(p)<=e.d3d_software_allocation_bound(n,count));
   records.push({p,bytes,count,emitted,point});
  }
 }
 const ex={...e,d3d_software_create(desc){
  if(++creates===failAt)return 0;
  const p=e.d3d_software_create(desc);record(desc,p);return p;
 },d3d_software_create_deferred(desc,typed){
  if(++creates===failAt)return 0;
  const p=e.d3d_software_create_deferred(desc,typed);if(p)pending.set(p,desc);return p;
 },d3d_software_prepare_step(p,packets,primitives){
  const status=e.d3d_software_prepare_step(p,packets,primitives);
  if(status===0&&pending.has(p)){record(pending.get(p),p);pending.delete(p);}
  return status;
 },d3d_software_free(p){pending.delete(p);e.d3d_software_free(p);
 }};
 const d=new Device({width:8,height:8,getExports:()=>ex,getMemory:()=>memory.buffer});
 let tests=0;
 const triangle=()=>fixtures.draw([[0,0],[8,0],[0,8]],8,8,true);
 for(const c of fixtures.clippingCases()){
  const snapshot=triangle();snapshot.vertices=new Uint8Array(new Float32Array(c.vertices.flat()).buffer);
  d.clear([0,0,0,1],1,1,null,null);const baseline=d.bytes,draw=d.prepare(snapshot);
  try{let status=1;while(status===1)status=d.step(draw);assert.strictEqual(status,0);d.completeDraw(draw);
   const expected=fixtures.polygonMask(c.polygon,8,8);
   // Read only after releasing active command below.
   draw.expected=expected;
  }finally{d.release(draw);}
  assert.deepStrictEqual(Array.from(d.readPixels()).filter((_,i)=>i%4===0).map(v=>v>127),draw.expected,c.name);
  assert.strictEqual(d.bytes,baseline);tests++;
 }
 // POINT oPts scalars live after indices, not in the vertex prefix.
 const point={primitive:4,primitiveCount:1,stride:36,
  vertices:new Uint8Array(new Float32Array([[1.4,1.4,.2],[5.4,1.4,1],[1.4,5.4,2]].flatMap(([x,y,size])=>[x/4-1,1-y/4,.5,1,size,1,0,0,1])).buffer),
  attributes:[{register:0,usage:0,usageIndex:0,type:3,offset:0},{register:4,usage:4,usageIndex:0,type:0,offset:16},{register:5,usage:10,usageIndex:0,type:3,offset:20}],
  vertexShader:new Uint32Array([0xfffe0101,1,0xc00f0000,0x90e40000,1,0xd00f0000,0x90e40005,1,0xc0010002,0x90000004,0xffff]),
  pixelShader:new Uint32Array([0xffff0101,1,0x800f0000,0x90e40000,0xffff]),textures:[],depthAttachment:null,
  state:{fillMode:1,cull:1,zenable:false,pointSize:0,pointSizeMin:0,pointSizeMax:1}};
 d.clear([0,0,0,1],1,1,null,null);const pd=d.prepare(point),pr=records.at(-1);
 assert(pr.point);const sidecar=pr.p+288+Math.ceil(pr.emitted/7)*1134;
 assert.deepStrictEqual(Array.from({length:3},(_,i)=>new DataView(memory.buffer).getFloat32(sidecar+i*4,true)).sort((a,b)=>a-b),[Math.fround(.2),1,2]);
 let ps=1;while(ps===1)ps=d.step(pd);assert.strictEqual(ps,0);d.completeDraw(pd);d.release(pd);
 assert.deepStrictEqual(Array.from(new Uint32Array(d.readPixels().buffer),(n,i)=>n===0xffff0000?i:-1).filter(i=>i>=0),[13,41]);tests++;
 const wire=triangle();wire.state.fillMode=2;
 wire.vertices=new Uint8Array(new Float32Array(fixtures.clippingCases()[0].vertices.flat()).buffer);
 const wd=d.prepare(wire),wr=records.at(-1),indices=new Uint16Array(memory.buffer,word(wr.p+156),wr.emitted);
 assert.strictEqual(wr.emitted,6);let edges=0;
 for(let i=0;i<indices.length;i+=3){const bits=indices[i]>>>13;edges+=(bits&1)+((bits>>>1)&1)+((bits>>>2)&1);}
 assert.strictEqual(edges,3,'only original wire edges survive; no clipping cap or fan diagonal');
 d.release(wd);tests++;
 // A live prepared context owns only the retained prefix. Its old tail is a
 // genuine allocator block and may be overwritten before raster execution.
 d.clear([0,0,0,1],1,1,null,null);const draw=d.prepare(triangle()),r=records.at(-1);
 const tailGuest=e.reverse_pointer(r.p)-4+word(r.p-4);let cursor=e.free_head()>>>0,tail=0;
 while(cursor){if(cursor===tailGuest){tail=word(e.guest_to_wasm(cursor));break;}cursor=word(e.guest_to_wasm(cursor)+4);}
 assert(tail>=16,'released clipping capacity is allocator-visible');
 // Claim the free tail through the allocator, never overwrite a free header.
 const allocations=[];let claimed=false;
 for(let i=0;i<128&&!claimed;i++){const p=e.guest_alloc(tail-4)>>>0;assert(p);allocations.push(p);
  if(p===tailGuest+4){new Uint8Array(memory.buffer,e.guest_to_wasm(p),tail-4).fill(0xa5);claimed=true;}}
 assert(claimed,'freed clipping tail reused while context live');
 let status=1;while(status===1)status=d.step(draw);assert.strictEqual(status,0);d.completeDraw(draw);d.release(draw);
 for(const p of allocations)e.guest_free(p);
 assert.strictEqual(d.lastDrawSamples,36n);tests++;
 // Multiple batches retain compact contexts but still reserve the next peak.
 const many=triangle(),count=800;many.primitiveCount=count;
 many.vertices=new Uint8Array(count*many.vertices.length);for(let i=0;i<count;i++)many.vertices.set(triangle().vertices,i*48);
 const baseline=d.bytes;records=[];d.draw(many);const expected=d.readPixels(),saved=records.slice();
 const oldSum=saved.reduce((sum,r)=>sum+e.d3d_software_allocation_bound(Math.min(256,r.count),r.count),0);
 const budget=d.budget;d.budget=oldSum-1;assert(d.budget>baseline);
 d.clear([0,0,0,1],1,1,null,null);d.draw(many);
 assert.deepStrictEqual(d.readPixels(),expected);assert.strictEqual(d.lastDrawSamples,BigInt(count)*36n);assert.strictEqual(d.bytes,baseline);tests++;
 d.clear([0,0,0,1],1,1,null,null);const before=d.readPixels(),samples=d.sampleCount();failAt=creates+3;
 assert.throws(()=>d.draw(many),/native raster validation rejected/);assert.deepStrictEqual(d.readPixels(),before);
 assert.strictEqual(d.sampleCount(),samples);assert.strictEqual(d.bytes,baseline);failAt=0;d.budget=budget;tests++;
 d.destroy();assert.strictEqual(d.bytes,0);
 console.log('Native prepared context compaction PASS '+tests+' cases');
})().catch(error=>{console.error(error);process.exitCode=1;});
