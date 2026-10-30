"use strict";
const assert=require('assert');
const {boot}=require('../../../test/test-d3d9-shared-positiont-ir');
const IR=require('../../../lib/d3d-shader-ir');
const {fixture}=require('./depth-controls');
(async()=>{
 const {e,memory}=await boot(),s=fixture(.5,0,1),results=[];
 const run=(mode)=>{
  let descriptorFrees=0,bundleFrees=0,ptrs=[],reads=0;
  const ex={...e,guest_free(p){descriptorFrees++;e.guest_free(p);},d3d_fixed_free(p){bundleFrees++;e.d3d_fixed_free(p);},
   d3d_fixed_compile_positiont(p){
    if(mode==='native-zero')return 0;
    const bundle=e.d3d_fixed_compile_positiont(p);assert(bundle);
    const words=new Uint32Array(memory.buffer,bundle,8);ptrs=[words[1],words[2]];
    if(mode==='bad-bundle')words[0]=0;
    return bundle;
   }};
  if(mode==='alloc-zero')ex.guest_alloc=()=>0;
  const execute=()=>IR.fixedPositionT(()=>ex,()=>{if(mode==='read-error'&&++reads===2)throw Error('injected read error');return memory.buffer;},s);
  if(mode==='success'){
   const n=execute(),old=n.vertex.nativeBytes.slice();
   new Uint8Array(memory.buffer,ptrs[0],old.length).fill(0xa5);
   assert.deepStrictEqual(n.vertex.nativeBytes,old,'overwrite actual released native IR allocation');
  }else assert.throws(execute,mode==='alloc-zero'?/allocation failed/:mode==='native-zero'?/lowering rejected/:mode==='bad-bundle'?/profile mismatch/:/injected read error/);
  assert.strictEqual(descriptorFrees,mode==='alloc-zero'?0:1);
  assert.strictEqual(bundleFrees,['alloc-zero','native-zero'].includes(mode)?0:1);
  results.push({mode,descriptorFrees,bundleFrees});
 };
 for(const mode of ['success','alloc-zero','native-zero','bad-bundle','read-error'])run(mode);
 console.log(JSON.stringify(results,null,2));console.log('PASS independent JS ownership/free/fault controls and actual native IR overwrite');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
