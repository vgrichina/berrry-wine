// Legacy D3D and software-GL rasterization on the process render owner.
(function(root,factory){
  const node=typeof module!=='undefined'&&module.exports;
  const api=factory(node?require('./d3dim-gpu'):root.D3DIMGpu);
  if(node)module.exports=api;else root.D3DIMRenderWorker=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(GPU){
  'use strict';
  function create({instance,memory,backend,options={},sendFrame}){
    const e=instance.exports;
    // Renderer identity is context-constant. Avoid a synchronous GL query on
    // every presentation, while allowing a replacement target/context to report
    // its own identity and a not-yet-created context to be retried later.
    const rendererNames=new WeakMap();
    let d3dimSoftwareDrawCallsCompleted=0;
    const gpu=backend==='webgl'?new GPU.D3DIMGpu({webglVersion:options.webglVersion,exactNative16:options.exactNative16===true,getExports:()=>e,getMemory:()=>memory.buffer,
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
        // Only the native fallback reads these argument words. GPU calls
        // consume the packet directly and need no temporary view/closure.
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
      get diagnosticActive(){return !!gpu?.drawObserver?.active;},
      setDiagnosticContext(value){if(gpu?.drawObserver?.active)gpu.commandContext=value;},
      diagnosticRoute(kind,detail){gpu?.drawObserver?.route?.(kind,detail);},
      execute(message){
        if (gpu?.drawObserver?.active) gpu.commandContext = message.diagnosticContext || null;
        const value=run(message);
        if(gpu&&message.opcode===0x20001){
          const target=gpu.targets.values().next().value,gl=target?.device.gpu.gl;
          if(gl&&!rendererNames.has(gl)){
            const ext=gl.getExtension('WEBGL_debug_renderer_info');
            rendererNames.set(gl,{
              renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),
              version:gl.getParameter(gl.VERSION),
            });
          }
          const identity=gl?rendererNames.get(gl):null;
          return {value,stats:gpu.snapshot(),glRenderer:identity?.renderer??null,
            glVersion:identity?.version??null};
        }
        return value;
      },
      diagnostic(action, options, factory) {
        if (!gpu) throw new Error('ground diagnostic requires actual WebGL adapter');
        if (action === 'arm') {
          if (gpu.drawObserver?.active) throw new Error('ground diagnostic already armed');
          gpu.drawObserver?.dispose?.();
          gpu.drawObserver = options.producers ? factory.createProducer(options).attach(gpu) : factory.createGround(options);
        } else if (action === 'stop') gpu.drawObserver?.stop('requested');
        else if (action === 'drain') return gpu.drawObserver?.drain?.() || gpu.drawObserver?.receipt() || null;
        else if (action !== 'read') throw new Error('unknown ground diagnostic action');
        return gpu.drawObserver?.receipt() || null;
      },
      // GPU present record (docs/d3dim-gpu-present.md). The guest already
      // returned from its Blt, so this cannot decline: when the executor
      // cannot show the frame, copy the rect into the primary's DIB here and
      // ask the page to present that DIB instead.
      present(wa){
        const frame=gpu&&!gpu.unavailable?gpu.present(wa):null;
        if(frame){
          const canvas=frame.canvas;delete frame.canvas;
          frame.bitmap=canvas.transferToImageBitmap();
          sendFrame?.({kind:'d3dim',...frame});
          return 1;
        }
        if(gpu)gpu.fence();
        const d=new DataView(memory.buffer),u=o=>d.getUint32(wa+o,true);
        const dst=u(4),src=u(8),bps=d.getUint16(dst+16,true)>>3,w=u(20),h=u(24);
        const dstDib=d.getUint32(dst+20,true),srcDib=d.getUint32(src+20,true);
        const dstPitch=d.getUint16(dst+18,true),srcPitch=d.getUint16(src+18,true);
        const bytes=new Uint8Array(memory.buffer);
        for(let y=0;y<h;y++){
          const s=srcDib+(u(32)+y)*srcPitch+u(28)*bps,o=dstDib+(u(16)+y)*dstPitch+u(12)*bps;
          bytes.copyWithin(o,s,s+w*bps);
        }
        e.page_watch_write?.(dstDib+u(16)*dstPitch,h*dstPitch);
        sendFrame?.({kind:'d3dim',cpu:true,dst,hwnd:u(36),dx:u(12),dy:u(16),width:w,height:h,cpuSeq:u(40),exclusive:u(44)!==0});
        return 0;
      },
      fence(){return gpu ? gpu.fence() : 1;},
      fenceFlip(){return gpu ? gpu.fenceFlip() : 1;},
      destroy(){gpu?.drawObserver?.stop('endpoint-closed');gpu?.drawObserver?.dispose?.();gpu?.stop();}
    };
  }
  return {create};
});
