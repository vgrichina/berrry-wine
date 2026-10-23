'use strict';
const assert=require('assert');
const {boot}=require('../../../test/test-d3d9-shared-positiont-ir');
const {fixture}=require('../20261023-render-positiont-depth-repair/depth-controls');
const IR=require('../../../lib/d3d-shader-ir');
const {Device}=require('../../../lib/d3d9-software-backend');
(async()=>{const {e,memory}=await boot();const rows=[];
for(const rhw of [1,0,-1,1e-38,1e-39,1e-45,3e38,Infinity,NaN]){
 const row={rhw:String(rhw)};
 for(const mode of ['fallback','shared']){
 const s=fixture(.5,0,1),v=new DataView(s.vertices.buffer);for(let i=0;i<3;i++)v.setFloat32(i*40+12,rhw,true);
 const d=new Device({getExports:()=>e,getMemory:()=>memory.buffer,width:4,height:4,fixedCacheBytes:0,maxBytes:2*1024*1024});
 try{if(mode==='shared'){s.nativeFixed=IR.fixedPositionT(()=>e,()=>memory.buffer,s);row.admitted=!!s.nativeFixed;}
 d.clear([0,0,0,1],3,1);row[mode]={result:d.draw(s),pixels:Array.from(d.present().pixels)};}catch(err){row[mode]={error:err.message};}d.destroy();
 }rows.push(row);
}
console.log(JSON.stringify(rows,null,2));
for(const row of rows)assert.deepStrictEqual(row.shared,row.fallback,'RHW='+row.rhw);
})().catch(err=>{console.error(err.stack);process.exitCode=1;});
