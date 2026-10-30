// Main-thread routing/presentation only. Rendering belongs to the shared Worker.
(function(root,factory){
  const node=typeof module!=='undefined'&&module.exports;
  const api=factory(node?require('./gl-compat'):root.OpenGLCompat,node?require('./gl-command-stream'):root.GLCommandStream,
    node?require('./render-worker'):root.RenderWorker);
  if(node)module.exports=api;else root.GLRenderHost=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(GL,Stream,Transport){
  'use strict';
  // Only commands whose complete inputs live in the record may outlive the
  // producer's stream buffer. Unknown operations remain synchronous.
  const queuedScalarNames=[
    'glAlphaFunc','glBlendFunc','glClear','glClearColor','glCullFace','glDepthFunc',
    'glDepthMask','glDepthRange','glDisable','glDrawBuffer','glEnable','glPointSize',
    'glPolygonMode','glScissor','glViewport','glFrustum','glLoadIdentity','glMatrixMode',
    'glOrtho','glPopMatrix','glPushMatrix','glRotatef','glScalef','glTranslatef',
    'glBindTexture','glTexEnvf','glTexParameterf','glPolygonOffset','gluPerspective',
    'gluLookAt','gluOrtho2D','glColorMaterial','glLightModeli','glMaterialf','glLightf',
    'glPixelStorei','glHint','glPushAttrib','glPopAttrib','glFogf','glFogi','glFrontFace',
    'glTexEnvi','glTexGeni','glTexGenf','glRotated','glMateriali','glLineWidth',
    'glTexParameteri','glReadBuffer','glActiveTextureARB','glClearDepth',
    'glStencilMask','glStencilFunc','glStencilOp','glClearStencil','glColorMask',
    'gpuPresent','glFlush',
  ];
  const queuedScalars=new Set(queuedScalarNames.map(name=>GL.CALL_INDEX[name]));
  // Match the pointer argument and number of floats read by OpenGLHostBridge,
  // not merely the presence of some copied bytes in the command record.
  const queuedVectors=new Map([
    [GL.CALL_INDEX.glLoadMatrixf,{arg:0,bytes:()=>64}],
    [GL.CALL_INDEX.glMultMatrixf,{arg:0,bytes:()=>64}],
    [GL.CALL_INDEX.glLightfv,{arg:2,bytes:()=>16}],
    [GL.CALL_INDEX.glMaterialfv,{arg:2,bytes:read=>read(1)===GL.constants.SHININESS?4:16}],
    [GL.CALL_INDEX.glLightModelfv,{arg:1,bytes:()=>16}],
    [GL.CALL_INDEX.glFogfv,{arg:1,bytes:read=>read(0)===GL.constants.FOG_COLOR?16:4}],
  ]);
  function queuedResult(batch){
    let safe=true,last=0;
    Stream.replay(batch,(op,aux,capture)=>{
      last=op;
      if(capture.pointerBorrowed){safe=false;return 0;}
      if(op===Stream.PACKED_DRAW_OPCODE){
        if(!capture.pointerOffset||capture.pointerLength%(Stream.VERTEX_FLOATS*4))safe=false;
      }else if(queuedVectors.has(op)){
        const vector=queuedVectors.get(op);
        if(capture.stackBytes!==(Stream.ARG_WORDS[op]+1)*4){safe=false;return 0;}
        const view=new DataView(capture.buffer),read=arg=>view.getUint32(capture.stackOffset+4+arg*4,true);
        if(!capture.pointerOffset||capture.pointerOffset<capture.stackOffset+capture.stackBytes
          ||capture.pointerLength!==vector.bytes(read)||read(vector.arg)!==capture.pointerGuest)safe=false;
      }else if(op===GL.CALL_INDEX.glTexSubImage2D){
        if(capture.stackBytes!==40){safe=false;return 0;}
        const view=new DataView(capture.buffer),read=arg=>view.getUint32(capture.stackOffset+4+arg*4,true);
        const w=read(4),h=read(5),format=read(6),bytes=w*h*4;
        if(read(0)!==0x0DE1||read(7)!==0x1401||(format!==0x1908&&format!==0x80E1)
          ||!w||!h||bytes>65536||((w&1)&&h!==1)||!read(8)
          ||!capture.pointerOffset||capture.pointerOffset<capture.stackOffset+capture.stackBytes
          ||capture.pointerLength!==bytes||capture.pointerGuest!==read(8))safe=false;
      }else if(!queuedScalars.has(op)||capture.pointerLength)safe=false;
      return 0;
    });
    return safe?(last===GL.CALL_INDEX.gpuPresent||last===GL.CALL_INDEX.glFlush?1:0):null;
  }
  class Bridge {
    constructor(options){this.options=options;this.local=null;this.endpoint=null;this.surfaceIds=new Set();this.layers=new Map();this.closed=false;
      this.submissions=new Transport.SubmissionQueue(2);this.activeWindows=new Map();
      this.frameSequence=0;this.frameOwners=new Map();
      this.packetPool=Transport?new Transport.SharedPacketPool():null;
      this.packetStats={leasedBatches:0,copiedBatches:0,copiedBytes:0};}
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
      if(this.closed||!win||(frame.frameToken&&this.frameOwners.get(frame.frameToken)?.get(frame.hwnd)!==win)){
        frame.bitmap?.close();return;}
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
      if(this.closed||this.closing)throw new Error('GL render bridge closed');
      if(!this.endpoint&&!this._enabled()){
        this.local ||= new GL.OpenGLHostBridge(this.options);
        return this.local.replay(batch,owner);
      }
      // Admission is ordered across owners too: a producer waiting for queue
      // space must not be overtaken by a later query or context switch.
      return this.submissions.ordered(()=>this.submissions.admit(()=>this._admit(batch,owner)));
    }
    _queue(batch,owner){
      return this.submissions.execute(()=>this._replay(batch,owner));
    }
    _admit(batch,owner){
      if(this.closed)throw new Error('GL render bridge closed');
      // Two owned buffers, at most 2 MiB each. The next submission keeps its
      // producer parked until the oldest is consumed, rather than building
      // an unbounded frame queue and adding input latency.
      const hwnd=this.activeWindows.get(owner||0),renderer=this._renderer();
      const win=renderer?.windows?.[hwnd];
      const ex=typeof this.options.exports==='function'?this.options.exports():this.options.exports;
      const value=this.options.asyncBatches!==false&&(this.options.backend||'webgl')==='webgl'
        &&!this.surfaceIds.size&&win&&!win.isChild&&batch.bytes<=Stream.DEFAULT_BYTES
        &&ex?.gl_window_readback_version?.()===1?queuedResult(batch):null;
      if(value!==null&&ex.gl_window_set_gpu_owned?.(hwnd,1)){
        let done;
        // Mark the canonical window BEFORE releasing the producer. Any GDI
        // access now enters the pre-GDI fence, even before a frame arrives.
        const windowSnapshot=this._snapshotWindows();
        if(this.options.sharedPackets!==false&&this.packetPool&&batch.pool){
          // Three producer slots, at most two published packets: admission
          // must retire the oldest BEFORE acknowledging publication of the
          // third, so the WAT writer may rotate back to that oldest slot.
          if(batch.pool.version!==1||batch.pool.capacity!==Stream.DEFAULT_BYTES||batch.pool.offsets?.length!==3)
            throw new Error('invalid GL shared packet pool');
          // A retired guest Worker slot can later host a fresh WASM instance.
          // Its allocation identifies the new pool without rebinding any old
          // leases; allocations remain live until process retirement.
          const poolOwner=`${owner||0}:${batch.pool.offsets[0]}`;
          this.packetPool.register(poolOwner,batch.buffer,batch.pool.offsets,batch.pool.capacity);
          const lease=this.packetPool.claim(poolOwner,batch.byteOffset||0,batch.bytes);
          this.packetStats.leasedBatches++;
          done=this._queue({...batch,...lease,owned:true,windowSnapshot,packetLease:lease},owner);
        }else{
          const buffer=new Uint8Array(batch.buffer,batch.byteOffset||0,batch.bytes).slice().buffer;
          this.packetStats.copiedBatches++;this.packetStats.copiedBytes+=batch.bytes;
          done=this._queue({...batch,buffer,byteOffset:0,owned:true,windowSnapshot},owner);
        }
        return {value,done};
      }
      const done=this._queue(batch,owner);return {value:done,done};
    }
    synchronize(action){
      if(this.closed||this.closing)return Promise.reject(new Error('GL render bridge closed'));
      const result=this.submissions.ordered(()=>this.submissions.execute(action));
      // Keep the readback and ownership-clear inside ordered admission.
      // A later producer must mark ownership after this fence, not before it.
      return result;
    }
    drain(){return this.synchronize(()=>{});}
    _snapshotWindows(){
      const ex=typeof this.options.exports==='function'?this.options.exports():this.options.exports;
      return Object.values(this._renderer()?.windows||{}).filter(Boolean).map(win=>{
        const descriptor={hwnd:win.hwnd,w:win.w,h:win.h,clientRect:win.clientRect?{...win.clientRect}:win.clientRect};
        if(ex?.get_client_rect_r&&ex.get_client_rect_l&&ex.get_client_rect_b&&ex.get_client_rect_t){
          const w=ex.get_client_rect_r(win.hwnd)-ex.get_client_rect_l(win.hwnd);
          const h=ex.get_client_rect_b(win.hwnd)-ex.get_client_rect_t(win.hwnd);
          descriptor.clientSize={w,h};
        }
        return {win,descriptor};
      });
    }
    async _replay(batch,owner){
      // Borrowed/query batches keep the caller parked. Owned batches were
      // classified at admission and cannot contain context operations.
      if(!batch.owned)Stream.replay(batch,(op,aux)=>{if(op===GL.CALL_INDEX.wglCreateContext&&(aux>>>31))this.surfaceIds.add(aux&0x7fffffff);return 0;});
      const snapshot=batch.windowSnapshot||this._snapshotWindows(),windows=snapshot.map(item=>item.descriptor);
      const surfaces=[];
      for(const id of this.surfaceIds){const s=this.options.getGdiSurface?.(id)?.surface;
        if(s)surfaces.push({id,width:s.width,height:s.height,pixels:s.rgbaRect(0,0,s.width,s.height)});}
      const port=await this._port();
      const frameToken=++this.frameSequence;
      this.frameOwners.set(frameToken,new Map(snapshot.map(item=>[item.descriptor.hwnd,item.win])));
      let result;
      try{
        result=await port.request({t:'gl-batch',memoryOffset:batch.byteOffset||0,bytes:batch.bytes,
          // The render owner already has this process memory. Send only its
          // leased range, never the entire 512 MiB SAB as a packet payload.
          commandBuffer:batch.owned&&!batch.packetLease?batch.buffer:undefined,
          softwareFront:batch.softwareFront||0,owner,windows,surfaces,frameToken});
        // Replay flushes pending geometry before replying; this is payload
        // release, not an implicit GPU finish.
        // Failed requests leave the lease quarantined: worker failure alone
        // is not proof that every reader has stopped using this storage.
        if(batch.packetLease)this.packetPool.release(batch.packetLease);
      }finally{
        this.frameOwners.delete(frameToken);
      }
      if(this.closed)throw new Error('GL render bridge closed during request');
      // The parked producer applies its own instance globals after the broker
      // wakes it; the renderer must never initialize the producer's GL state.
      if(batch.softwareConfig&&result.producerConfig)batch.softwareConfig.set(result.producerConfig);
      for(const s of result.surfaces||[])this.options.getGdiSurface?.(s.id)?.surface.writeRgbaRect(s.x,s.y,s.width,s.height,s.pixels);
      if(result.windows)for(const hwnd of [...this.layers.keys()])if(!result.windows.includes(hwnd))this._detach(hwnd);
      // Context deletion can release a context current on another owner.
      // Replace the complete authoritative map, never retain stale owners.
      this.activeWindows=new Map(result.activeWindows||[]);
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
    close(){
      if(this.closePromise)return this.closePromise;
      this.closing=true;
      return this.closePromise=(async()=>{
        try{await this.submissions.admission;await this.submissions.close();await this.submissions.tail;
          if(this.submissions.error)throw this.submissions.error;}
        finally{
          this.closed=true;
          try{if(this.endpoint)await (await this.endpoint).terminate();}
          finally{
            if(this.local)for(const id of [...this.local.contexts.keys()])this.local.deleteContext(id);
            for(const hwnd of [...this.layers.keys()])this._detach(hwnd);
          }
        }
      })();
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
