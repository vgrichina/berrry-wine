// Main-thread routing/presentation only. Rendering belongs to the shared Worker.
(function(root,factory){
  const node=typeof module!=='undefined'&&module.exports;
  const api=factory(node?require('./gl-compat'):root.OpenGLCompat,node?require('./gl-command-stream'):root.GLCommandStream);
  if(node)module.exports=api;else root.GLRenderHost=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(GL,Stream){
  'use strict';
  class Bridge {
    constructor(options){this.options=options;this.local=null;this.endpoint=null;this.surfaceIds=new Set();this.layers=new Map();this.closed=false;this.pending=new Set();}
    _renderer(){return typeof this.options.renderer==='function'?this.options.renderer():this.options.renderer;}
    _enabled(){return this.options.createRenderEndpoint&&(!this.options.shouldUseRenderWorker||this.options.shouldUseRenderWorker());}
    async _port(){
      if(this.closed)throw new Error('GL render bridge closed');
      if(!this.endpoint)this.endpoint=Promise.resolve(this.options.createRenderEndpoint({api:'gl',backend:this.options.backend||'webgl'})).then(async port=>{
        port.addEventListener('message',event=>{if(event.data?.t==='frame')this._present(event.data.frame||event.data);});
        await port.ready;return port;
      });
      return this.endpoint;
    }
    _present(frame){
      const renderer=this._renderer(),win=renderer?.windows?.[frame.hwnd];
      if(this.closed||!win){frame.bitmap?.close();return;}
      if(renderer.getWindowCanvas)renderer.getWindowCanvas(frame.hwnd);
      const old=this.layers.get(frame.hwnd);
      const canvas=old?.canvas||(this.options.createCanvas?this.options.createCanvas(frame.width,frame.height):document.createElement('canvas'));
      canvas.width=frame.width;canvas.height=frame.height;
      const ctx=canvas.getContext('2d');
      if(frame.bitmap){ctx.drawImage(frame.bitmap,0,0);frame.bitmap.close();}
      else {const image=ctx.createImageData(frame.width,frame.height);image.data.set(frame.pixels);ctx.putImageData(image,0,0);}
      const layer={kind:'gpu',canvas,writeSeq:renderer.nextSurfaceWriteSeq?renderer.nextSurfaceWriteSeq():(old?.writeSeq||0)+1};
      this.layers.set(frame.hwnd,layer);win._gpuFrameLayer=win._dxFrameLayer=layer;
      // Merge at the completion boundary, before the guest can draw GDI above it.
      const ex=typeof this.options.exports==='function'?this.options.exports():this.options.exports;
      const deferred=ex?.gl_window_readback_version?.()===1&&
        renderer.deferGpuWindowReadback?.(frame.hwnd);
      if(!deferred)renderer.mergeGpuLayerIntoBackCanvas?.(frame.hwnd);
      renderer.scheduleRepaint?.();this.options.onPresent?.(layer);
    }
    replay(batch,owner){
      if(this.closed)throw new Error('GL render bridge closed');
      if(!this.endpoint&&!this._enabled()){
        this.local ||= new GL.OpenGLHostBridge(this.options);
        return this.local.replay(batch,owner);
      }
      const result=this._replay(batch,owner);this.pending.add(result);
      result.then(()=>this.pending.delete(result),()=>this.pending.delete(result));
      return result;
    }
    async _replay(batch,owner){
      // The guest caller remains parked until consumption, protecting borrowed
      // pointers and query output memory for the entire asynchronous request.
      Stream.replay(batch,(op,aux)=>{if(op===GL.CALL_INDEX.wglCreateContext&&(aux>>>31))this.surfaceIds.add(aux&0x7fffffff);return 0;});
      const renderer=this._renderer();
      const windows=Object.values(renderer?.windows||{}).filter(Boolean).map(w=>({hwnd:w.hwnd,w:w.w,h:w.h,clientRect:w.clientRect}));
      const surfaces=[];
      for(const id of this.surfaceIds){const s=this.options.getGdiSurface?.(id)?.surface;
        if(s)surfaces.push({id,width:s.width,height:s.height,pixels:s.rgbaRect(0,0,s.width,s.height)});}
      const port=await this._port();
      const result=await port.request({t:'gl-batch',memoryOffset:batch.byteOffset||0,bytes:batch.bytes,softwareFront:batch.softwareFront||0,owner,windows,surfaces});
      if(this.closed)throw new Error('GL render bridge closed during request');
      // The parked producer applies its own instance globals after the broker
      // wakes it; the renderer must never initialize the producer's GL state.
      if(batch.softwareConfig&&result.producerConfig)batch.softwareConfig.set(result.producerConfig);
      for(const s of result.surfaces||[])this.options.getGdiSurface?.(s.id)?.surface.writeRgbaRect(s.x,s.y,s.width,s.height,s.pixels);
      if(result.windows)for(const hwnd of [...this.layers.keys()])if(!result.windows.includes(hwnd))this._detach(hwnd);
      this.options.onContextCountChange?.(result.contexts);
      return result.value|0;
    }
    flushFrontBuffer(){return this.local?.flushFrontBuffer()||0;}
    _detach(hwnd){
      const renderer=this._renderer();
      if(renderer?.resolveGpuWindowReadback&&!renderer.resolveGpuWindowReadback(hwnd))
        throw new Error('Unable to preserve OpenGL window pixels before detach');
      const layer=this.layers.get(hwnd),win=renderer?.windows?.[hwnd];
      if(win?._gpuFrameLayer===layer)win._gpuFrameLayer=null;
      if(win?._dxFrameLayer===layer)win._dxFrameLayer=null;
      layer?.canvas?.close?.();this.layers.delete(hwnd);renderer?.scheduleRepaint?.();
    }
    async close(){this.closed=true;
      try{await Promise.allSettled([...this.pending]);if(this.endpoint)await (await this.endpoint).terminate();}
      finally{
        if(this.local)for(const id of [...this.local.contexts.keys()])this.local.deleteContext(id);
        for(const hwnd of [...this.layers.keys()])this._detach(hwnd);
      }
    }
  }
  class D3DIMBridge {
    constructor(options){this.options=options;this.endpoint=null;this.closed=false;}
    call(opcode,wa,length=0){
      if(this.closed)throw new Error('D3DIM render bridge closed');
      this.endpoint ||= Promise.resolve(this.options.createRenderEndpoint({api:'d3dim',backend:this.options.backend||'software'}));
      return this.endpoint.then(async port=>{await port.ready;const result=await port.request({t:'d3dim-call',opcode,wa,length});
        if(result&&typeof result==='object'){this.stats=result.stats;this.glRenderer=result.glRenderer;return result.value|0;}return result|0;});
    }
    async close(){this.closed=true;if(this.endpoint)await (await this.endpoint).terminate();}
  }
  return {Bridge,D3DIMBridge};
});
