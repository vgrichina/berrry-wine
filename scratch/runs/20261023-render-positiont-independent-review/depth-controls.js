"use strict";
const assert=require('assert');
const {boot}=require('../../../test/test-d3d9-shared-positiont-ir');
const IR=require('../../../lib/d3d-shader-ir');
const {Device}=require('../../../lib/d3d9-software-backend');
function fixture(z,minZ,maxZ) {
 const data=Float32Array.from([[0,0],[4,0],[0,4]].flatMap(([x,y])=>[x,y,z,1,1,0,0,1,0,0]));
 return {primitive:4,primitiveCount:1,stride:40,vertices:new Uint8Array(data.buffer),
 attributes:[{register:0,usage:9,usageIndex:0,type:3,offset:0},{register:1,usage:10,usageIndex:0,type:3,offset:16},{register:2,usage:5,usageIndex:0,type:1,offset:32}],
 viewport:{x:0,y:0,width:4,height:4,minZ,maxZ},textures:[{width:1,height:1,pixels:Uint8Array.from([255,255,255,255]),sampler:{addressU:3,addressV:3,min:1,mag:1,mip:0}}],
 state:{zenable:true,zwrite:true,zfunc:2,blend:false,cull:1,fillMode:3,colorWriteMask:15},
 fixedFunction:{lighting:false,fog:false,specular:false,alphaTest:false,colorKey:false,textureFactor:0xffffffff,stages:[{colorOp:4,colorArg1:2,colorArg2:0,alphaOp:4,alphaArg1:2,alphaArg2:0,constant:0xffffffff,transformFlags:0,texCoordIndex:0,resultArg:1},{colorOp:1}]}};
}
module.exports={fixture};
if(require.main===module)(async()=>{
 const {e,memory}=await boot(),rows=[];
 for (const [z,minZ,maxZ,clearDepth] of [[.5,0,1,1],[.1,.2,.8,1],[.9,.2,.8,1],[.25,.5,.5,.4],[.75,.5,.5,.6]]) {
  const row={z,minZ,maxZ,clearDepth};
  for(const mode of ['fallback','shared']) {
   const d=new Device({getExports:()=>e,getMemory:()=>memory.buffer,width:4,height:4,fixedCacheBytes:0,maxBytes:2*1024*1024});
   const s=fixture(z,minZ,maxZ);if(mode==='shared'){s.nativeFixed=IR.fixedPositionT(()=>e,()=>memory.buffer,s);assert(s.nativeFixed);}
   d.clear([0,0,0,1],3,clearDepth);d.draw(s);
   row[mode]=Array.from(d.present().pixels.slice(20,24));d.destroy();
  }
  rows.push(row);
 }
 assert.deepStrictEqual(rows[0].shared,rows[0].fallback,'default viewport positive control');
 for(const row of rows.slice(1))assert.notDeepStrictEqual(row.shared,row.fallback,'candidate regression must reproduce');
 console.log(JSON.stringify(rows,null,2));
 console.log('REPRODUCED: shared clip-space migration changes supported POSITIONT depth/clipping versus native screen-space fallback');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
