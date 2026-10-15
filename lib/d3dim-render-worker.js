// Legacy D3D and software-GL rasterization on the process render owner.
(function(root,factory){
  const node=typeof module!=='undefined'&&module.exports;
  const api=factory(node?require('./d3dim-gpu'):root.D3DIMGpu);
  if(node)module.exports=api;else root.D3DIMRenderWorker=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(GPU){
  'use strict';
  function create({instance,memory,backend}){
    const e=instance.exports;
    let d3dimSoftwareDrawCallsCompleted=0;
    const gpu=backend==='webgl'?new GPU.D3DIMGpu({getExports:()=>e,getMemory:()=>memory.buffer,
      createCanvas:(w,h)=>new OffscreenCanvas(w,h),onError:message=>{
        // Lazy context creation explicitly declines to the native rasterizer.
        // Other failures still poison this endpoint; unavailable is not a
        // blanket permission to suppress errors from an existing GPU target.
        if(gpu.unavailable && message.startsWith('[d3dim-gpu] WebGL unavailable:')){
          console.warn(message);return;
        }
        throw new Error(message);
      }}):null;
    function run({opcode,wa,stateGuest,length=0}){
        const d=new DataView(memory.buffer),u=offset=>d.getUint32((wa>>>0)+offset,true);
        if(gpu&&opcode<=0x20004){
          let result;
          if (stateGuest) {
            if (typeof e.d3dim_gpu_state_override !== 'function') throw new Error('D3DIM snapshot override export missing');
            e.d3dim_gpu_state_override(stateGuest);
            try { result=gpu.call(opcode,wa,length); }
            finally { e.d3dim_gpu_state_override(0); }
          } else result=gpu.call(opcode,wa,length);
          if(result||opcode!==0x20000)return result;
          // Unsupported GPU primitives still rasterize on this owner, after
          // materializing previous GPU draws into the shared surface.
          gpu.fence();
        }
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
      execute(message){
        const value=run(message);
        if(gpu&&message.opcode===0x20001){
          const target=gpu.targets.values().next().value,gl=target?.device.gpu.gl;
          const ext=gl?.getExtension('WEBGL_debug_renderer_info');
          return {value,stats:gpu.snapshot(),glRenderer:gl?gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER):null};
        }
        return value;
      },
      fence(){return gpu ? gpu.fence() : 1;},
      destroy(){gpu?.stop();}
    };
  }
  return {create};
});
