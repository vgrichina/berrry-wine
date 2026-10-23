'use strict';
const assert=require('assert');
const {boot}=require('../../../test/test-d3d9-shared-positiont-ir');
const {fixture}=require('../20261023-render-positiont-depth-repair/depth-controls');
const IR=require('../../../lib/d3d-shader-ir');
const {Device}=require('../../../lib/d3d9-software-backend');
(async()=>{
 const {e,memory}=await boot();let allocations=0,compiles=0;
 const ex={...e,guest_alloc(n){allocations++;return e.guest_alloc(n);},d3d_fixed_compile_positiont(p){compiles++;return e.d3d_fixed_compile_positiont(p);}};
 const native=s=>IR.fixedPositionT(()=>ex,()=>memory.buffer,s),rows=[];
 const reject=(name,edit)=>{const s=fixture(.5,0,1);edit(s);const before=[allocations,compiles];assert.strictEqual(native(s),null,name);assert.deepStrictEqual([allocations,compiles],before);rows.push(name);};
 for(const z of [-Infinity,-.1,1.1,Infinity,NaN])reject('z '+z,s=>new DataView(s.vertices.buffer).setFloat32(88,z,true));
 for(const [minZ,maxZ] of [[NaN,1],[0,NaN],[-Infinity,1],[0,Infinity],[.2,.8],[.5,.5]])reject('viewport '+minZ+','+maxZ,s=>Object.assign(s.viewport,{minZ,maxZ}));
 for(const stride of [0,15,39,NaN,40.5])reject('stride '+stride,s=>s.stride=stride);
 for(const offset of [-1,25,NaN,.5])reject('offset '+offset,s=>s.attributes[0].offset=offset);
 reject('partial last vertex',s=>s.vertices=s.vertices.subarray(0,119));
 reject('indexed unused invalid depth conservatively falls back',s=>{const b=new Uint8Array(160);b.set(s.vertices);s.vertices=b;s.indices=Uint16Array.of(0,1,2);new DataView(b.buffer).setFloat32(128,NaN,true);});
 // The scan must use the view's byte offset and the attribute offset, even
 // when they are unaligned. Junk outside that view is not a vertex.
 const shifted=fixture(.5,0,1),backing=new Uint8Array(165).fill(255),v=backing.subarray(3,135);
 for(let i=0;i<3;i++)v.set(shifted.vertices.subarray(i*40,i*40+40),i*44+4);
 shifted.vertices=v;shifted.stride=44;for(const a of shifted.attributes)a.offset+=4;
 assert(native(shifted));new DataView(backing.buffer).setFloat32(3+2*44+4+8,NaN,true);
 const before=[allocations,compiles];assert.strictEqual(native(shifted),null);assert.deepStrictEqual([allocations,compiles],before);
 // Native range rejection uses actual compiler, including NaN/infinity.
 const p=e.guest_alloc(288),w=new Uint32Array(memory.buffer,p,72),f=new Float32Array(memory.buffer,p,72);
 w.set([0x44465831,1,15,0,1,2,4,2,0,4,2,0,0xffffffff,0xffffffff,1,0,0,0,0,4,4]);
 for(const [min,max] of [[NaN,1],[0,NaN],[-Infinity,1],[0,Infinity],[.5,.5]]){f[21]=min;f[22]=max;assert.strictEqual(e.d3d_fixed_compile_positiont(p),0);}
 // Minimal finite-input regression plus matching ordinary-RHW control.
 const repro=[];
 for(const rhw of [1,1e-39]){
  const row={rhw,storedRHW:Math.fround(rhw),z:.5,minZ:0,maxZ:1};
  for(const mode of ['fallback','shared']){
   const s=fixture(.5,0,1),data=new DataView(s.vertices.buffer);
   for(let i=0;i<3;i++)data.setFloat32(i*40+12,rhw,true);
   if(mode==='shared'){s.nativeFixed=native(s);assert(s.nativeFixed);}
   const d=new Device({getExports:()=>e,getMemory:()=>memory.buffer,width:4,height:4,fixedCacheBytes:0,maxBytes:2*1024*1024});
   d.clear([0,0,0,1],3,1);assert.strictEqual(d.draw(s),1);
   const pixels=Array.from(d.present().pixels);row[mode]={pixel:pixels.slice(20,24),redPixels:pixels.filter((x,i)=>i%4===2&&x===255).length};d.destroy();
  }
  assert.deepStrictEqual(row.fallback.pixel,[0,0,255,255]);assert.strictEqual(row.fallback.redPixels,10);
  assert.deepStrictEqual(row.shared.pixel,rhw===1?[0,0,255,255]:[0,0,0,255]);assert.strictEqual(row.shared.redPixels,rhw===1?10:0);repro.push(row);
 }
 console.log(JSON.stringify({rejectedBeforeAllocation:rows,shiftedViewAndAttribute:true,nativeNonfiniteRejects:5,repro},null,2));
 console.log('PASS independent admission controls; CONFIRMED admitted finite RHW regression (REQUEST CHANGES)');
})().catch(err=>{console.error(err.stack);process.exitCode=1;});
