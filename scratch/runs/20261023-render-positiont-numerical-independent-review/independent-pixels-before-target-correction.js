'use strict';
// One group/process: actual production VM/compiler/projector/raster, 8 MiB.
const assert=require('assert'),crypto=require('crypto');
const {boot}=require('../../../test/test-d3d9-shared-positiont-ir');
const {fixture}=require('../20261023-render-positiont-depth-repair/depth-controls');
const IR=require('../../../lib/d3d-shader-ir');
const {Device}=require('../../../lib/d3d9-software-backend');
function input(points,rhws=[1,.5,.25],zs=[0,.5,1]){
 const s=fixture(.5,0,1);
 s.vertices=new Uint8Array(Float32Array.from(points.flatMap(([x,y],i)=>
  [x,y,zs[i%zs.length],rhws[i%rhws.length],1,0,0,1,0,0])).buffer);
 return s;
}
const triangle=[[0,0],[4,0],[0,4]];
const pixel=(frame,x,y)=>Array.from(frame.slice((y*8+x)*4,(y*8+x)*4+4));
const near=(a,b)=>assert(a.every((v,i)=>Math.abs(v-b[i])<=1),`${a} != ${b}`);
(async()=>{
 const {e,memory}=await boot();let allocations=0,compiles=0;
 const ex={...e,guest_alloc(n){allocations++;return e.guest_alloc(n);},
  d3d_fixed_compile_positiont(p){compiles++;return e.d3d_fixed_compile_positiont(p);}};
 const options={getExports:()=>e,getMemory:()=>memory.buffer,width:8,height:8,fixedCacheBytes:0,maxBytes:2*1024*1024};
 const d=new Device(options),old=new Device(options),fixed=d.fixedPrograms;
 function run(id,s,expected,clearDepth=1){
  const before=[allocations,compiles];s.nativeFixed=IR.fixedPositionT(()=>ex,()=>memory.buffer,s);
  assert(s.nativeFixed,id+' must use shared route');
  assert.deepStrictEqual([allocations,compiles],before.map(n=>n+1));
  d.fixedPrograms=()=>{throw Error('shared draw fell back');};
  d.clear([0,0,0,1],3,clearDepth);old.clear([0,0,0,1],3,clearDepth);
  assert.strictEqual(d.draw(s),1,id);d.fixedPrograms=fixed;
  const legacy={...s};delete legacy.nativeFixed;assert.strictEqual(old.draw(legacy),1,id);
  const a=d.present().pixels,b=old.present().pixels;
  assert.deepStrictEqual(a,b,id+' entire 8x8 framebuffer');expected(a);
  console.log(JSON.stringify({id,admitted:true,fullFrameEqual:true,sha256:crypto.createHash('sha256').update(a).digest('hex')}));
 }
 const coverage=(inside,color=[0,0,255,255])=>frame=>{
  let count=0;for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const covered=inside(x,y);assert.deepStrictEqual(pixel(frame,x,y),covered?color:[0,0,0,255],`coverage ${x},${y}`);count+=Number(covered);
  }assert(count>0,'positive expected coverage');
 };
 const group=process.argv[2];
 if(group==='geometry'){
  for(const [id,pts,inside]of [
   ['fractional half',[[.5,.5],[3.5,.5],[.5,3.5]],(x,y)=>x>=.5&&y>=.5&&x+y<4],
   ['fractional quarter',[[.25,.25],[3.75,.25],[.25,3.75]],(x,y)=>x>=.25&&y>=.25&&x+y<4],
   ['thin fractional',[[0,0],[4,0],[0,.5]],(x,y)=>y===0&&x<4],
   ['reversed winding',[[0,4],[4,0],[0,0]],(x,y)=>x+y<4],
   ['degenerate',[[0,0],[2,2],[4,4]],()=>false]
  ])run(id,input(pts,[1,.5,.25],[.5]),id==='degenerate'?a=>assert(a.every((v,i)=>v===(i%4===3?255:0))):coverage(inside));
  const moved=input([[2,2],[6,2],[2,6]],[1,.5,.25],[.5]);Object.assign(moved.viewport,{x:2,y:2,width:4,height:4});
  run('moved viewport pixel oracle',moved,coverage((x,y)=>x>=2&&y>=2&&x+y<8));
 }else if(group==='interpolation'){
  for(const [id,rhws]of [['unequal ordinary',[1,.5,.25]],['unequal extremes',[2**-16,1,2**16]],['reversed extremes',[2**16,1,2**-16]]]){
   const s=input(triangle,rhws);const f=new Float32Array(s.vertices.buffer);f.set([0,1,0,1],14);f.set([0,0,1,1],24);
   const weights=[.5*rhws[0],.25*rhws[1],.25*rhws[2]],sum=weights.reduce((a,b)=>a+b);
   run(id,s,a=>near(pixel(a,1,1),[weights[2]/sum*255,weights[1]/sum*255,weights[0]/sum*255,255]));
  }
  for(const [id,zs,clear,red]of [['sloping depth passes',[0,.5,1],.4,true],['sloping depth fails',[0,.5,1],.3,false],['subnormal depth exact',[2**-149,2**-149,2**-149],1,true],['far plane equality',[1,1,1],1,false],['near plane equality',[0,0,0],0,false]]){
   const s=input(triangle,[2**-16,1,2**16],zs);
   // Subnormal depth with large RHW loses bits: use the exact lower scaling.
   if(id==='subnormal depth exact')for(let i=0;i<3;i++)new DataView(s.vertices.buffer).setFloat32(i*40+12,2**-16,true);
   run(id,s,a=>assert.deepStrictEqual(pixel(a,1,1),red?[0,0,255,255]:[0,0,0,255]),clear);
  }
 }else if(group==='layout'){
  for(const primitive of [4,5,6]){
   const pts=primitive===4?[...triangle,[4,0],[4,4],[0,4]]:primitive===5?[[0,0],[4,0],[0,4],[4,4]]:[[0,0],[4,0],[4,4],[0,4]];
   const s=input(pts);s.primitive=primitive;s.primitiveCount=2;
   // Alpha at shared diagonal would expose double coverage/top-left mismatch.
   const f=new Float32Array(s.vertices.buffer);for(let i=0;i<pts.length;i++)f[i*10+7]=.5;
   Object.assign(s.state,{zenable:false,blend:true,srcblend:5,dstblend:6,blendop:1});
   run('shared diagonal topology '+primitive,s,coverage((x,y)=>x<4&&y<4,[0,0,128,191]));
  }
  // Frontend-normalized consumer ABI is INDEX16 (backend line650).
  for(const indexType of [Uint16Array]){
   const s=input([[4,4],...triangle]);s.indices=indexType.of(1,2,3);
   const b=new Uint8Array(3+4*44+7).fill(255),view=b.subarray(3,3+4*44);
   for(let i=0;i<4;i++)view.set(s.vertices.subarray(i*40,i*40+40),i*44+4);
   s.vertices=view;s.stride=44;s.attributes.forEach(a=>a.offset+=4);
   run('unaligned backing/attribute indexed '+indexType.name,s,coverage((x,y)=>x+y<4));
   // A fourth, unreferenced declared vertex is still conservatively scanned.
   new DataView(view.buffer).setFloat32(view.byteOffset+4+12,1e-39,true);
   const before=[allocations,compiles];assert.strictEqual(IR.fixedPositionT(()=>ex,()=>memory.buffer,s),null);
   assert.deepStrictEqual([allocations,compiles],before);
  }
 }else if(group==='texture'){
  for(const rhws of [[1,1,1],[2**-16,1,2**16],[2**16,1,2**-16]]){
   const s=input(triangle,rhws,[.5]);const f=new Float32Array(s.vertices.buffer);
   f[18]=1;f[29]=1;
   s.textures[0].width=2;s.textures[0].height=2;
   s.textures[0].pixels=Uint8Array.from([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
   // At (1,1): ordinary u=v=.25 -> first texel. Extreme
   // reciprocal weights push u or v close to one, testing sampling.
   const weights=[.5*rhws[0],.25*rhws[1],.25*rhws[2]],sum=weights.reduce((a,b)=>a+b);
   const u=weights[1]/sum,v=weights[2]/sum;
   const texel=(Math.min(1,Math.floor(v*2))*2+Math.min(1,Math.floor(u*2)))*4;
   const rgba=Array.from(s.textures[0].pixels.slice(texel,texel+4));
   run('perspective texture '+rhws.join(','),s,a=>assert.deepStrictEqual(pixel(a,1,1),[0,0,rgba[0],255]));
  }
  // Non-power-of-two viewport dimensions still admit exact coordinates;
  // endpoint plane checks and real projection must preserve coverage.
  for(const width of [1,3,2048]){
   const s=input([[0,0],[width,0],[0,4]],[2**-16,1,2**16],[.5]);s.viewport.width=width;
   run('viewport width '+width,s,coverage((x,y)=>y<4&&x>=0&&x/width+y/4<1));
  }
 }else throw Error('unknown group');
 d.destroy();old.destroy();console.log('PASS independent '+group);
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
