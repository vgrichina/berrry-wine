// Backend-neutral input packing only. Rasterization and shader math stay native.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.D3DGeometryBatches=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // The executor may need smaller internal batches (e.g. user-plane clipping
  // expands triangles). This never restricts the guest's total primitive count.
  function split(snapshot,maxBytes=64*1024*1024,maxTriangles=256){
    const fail=message=>{throw new Error(`D3D geometry batches: ${message}`);};
    const {primitive,primitiveCount,stride,vertices,indices}=snapshot;
    if(![1,4,5,6].includes(primitive)||!Number.isSafeInteger(primitiveCount)||primitiveCount<1)
      fail('invalid point/triangle topology/count');
    if(!Number.isSafeInteger(maxBytes)||maxBytes<1)fail('invalid byte budget');
    if(!Number.isInteger(maxTriangles)||maxTriangles<1||maxTriangles>256)fail('invalid triangle batch limit');
    if(!(vertices instanceof Uint8Array)||!Number.isInteger(stride)||stride<1||stride>255||vertices.length%stride)
      fail('invalid vertex bytes/stride');
    const points=primitive===1;
    const n=vertices.length/stride,consumed=points?primitiveCount:primitive===4?primitiveCount*3:primitiveCount+2;
    if(!Number.isSafeInteger(consumed)||consumed>Math.floor(maxBytes/2))fail('index byte budget exceeded');
    if(indices!==undefined&&indices!==null&&!(indices instanceof Uint16Array)&&!(indices instanceof Uint32Array))
      fail('invalid index array');
    if(indices?indices.length<consumed:n<consumed)fail('short source range');
    const source=i=>indices?indices[i]:i;
    // Check the whole source before returning any executable batch.
    for(let i=0;i<consumed;i++)if(source(i)>=n)fail('index outside vertex snapshot');
    const batches=[];let map=new Map(),sources=[],local=[],bytes=0;
    function flush(){
      if(!local.length)return;
      const output=new Uint8Array(sources.length*stride);
      for(let i=0;i<sources.length;i++)output.set(vertices.subarray(sources[i]*stride,(sources[i]+1)*stride),i*stride);
      batches.push({primitive:points?1:4,primitiveCount:local.length/(points?1:3),stride,vertices:output,indices:Uint16Array.from(local)});
      map=new Map();sources=[];local=[];
    }
    for(let triangle=0;triangle<primitiveCount;triangle++){
      const positions=points?[triangle]:primitive===4?[triangle*3,triangle*3+1,triangle*3+2]:primitive===6?
        [0,triangle+1,triangle+2]:[triangle+(triangle&1),triangle+1-(triangle&1),triangle+2];
      const ids=positions.map(source);
      const missing=()=>new Set(ids.filter(id=>!map.has(id))).size;
      if(local.length===maxTriangles*(points?1:3)||map.size+missing()>256)flush();
      const extra=missing()*stride+(points?2:6);
      if(bytes+extra>maxBytes)fail('packed byte budget exceeded');
      bytes+=extra;
      for(const id of ids){
        if(!map.has(id)){map.set(id,map.size);sources.push(id);}
        local.push(map.get(id));
      }
    }
    flush();
    return {batches,bytes};
  }
  return {split};
});
