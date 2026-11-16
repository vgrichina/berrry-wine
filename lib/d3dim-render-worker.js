// D3DIM and software-GL rasterization on the process render owner, in WAT.
// D3DIM on the GPU is the WAT producer (src/09abg-d3dim-gps.wat) writing GPU
// stream v2; it never sends this owner an 0x2000x record. What arrives here is
// the software path: the guest's GPU switch is off, or a software-GL draw.
(function(root,factory){
  const node=typeof module!=='undefined'&&module.exports;
  const api=factory();
  if(node)module.exports=api;else root.D3DIMRenderWorker=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // `backend` is accepted and ignored: a guest whose D3DIM is on the GPU still
  // sends its software-GL draws here.
  function create({instance,memory}){
    const e=instance.exports;
    let d3dimSoftwareDrawCallsCompleted=0;
    function run({opcode,wa}){
        const d=new DataView(memory.buffer),u=offset=>d.getUint32((wa>>>0)+offset,true);
        if(opcode===0x20002||opcode===0x20001)return 1;
        if(opcode===0x20000){e.d3dim_worker_draw(u(0),u(4),u(8),u(12),u(16),u(20));d3dimSoftwareDrawCallsCompleted++;return 1;}
        if(opcode===0x20003){e.d3dim_worker_flip(u(0),u(4));return 1;}
        if(opcode===0x20004)return 0; // WAT clear has no raster loop and stays guest-local.
        if(opcode===0x20005)return e.gl_sw_worker_draw(u(0),u(8))|0;
        if(opcode===0x20006){e.gl_sw_worker_tex_copy(u(0),u(8),u(12),u(16),u(20),u(24));return 1;}
        throw new Error('unknown shared D3DIM operation '+opcode);
    }
    return {
      get d3dimSoftwareDrawCallsCompleted(){return d3dimSoftwareDrawCallsCompleted;},
      get diagnosticActive(){return false;},
      setDiagnosticContext(){},
      diagnosticRoute(){},
      execute(message){return run(message);},
      diagnostic(){
        throw new Error('ground diagnostic requires the WebGL D3DIM executor, which GPU stream v2 replaced');
      },
      fence(){return 1;},
      destroy(){}
    };
  }
  return {create};
});
