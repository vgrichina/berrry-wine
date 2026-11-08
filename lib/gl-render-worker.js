// OpenGL endpoint hosted by the process render Worker.
(function(root,factory){
  const node=typeof module!=='undefined'&&module.exports;
  const api=factory(node?require('./gl-compat'):root.OpenGLCompat,
    node?require('./gl-command-stream'):root.GLCommandStream);
  if(node)module.exports=api;else root.GLRenderWorker=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(GL,Stream){
  'use strict';
  // Private v1 shared ring ABI: 16 header words, 16 words/record. The host
  // reads committed slots without scheduling JS on this (possibly stuck) owner.
  // A negative stamp invalidates an in-progress overwrite. Numbers are tokens
  // from the real endpoint/batch/context; sequence is only a ring cursor.
  function recorder(config,endpointId){
    try{
      if(!config||!(config.buffer instanceof SharedArrayBuffer))return null;
      const words=new Int32Array(config.buffer),count=Atomics.load(words,1);
      if(Atomics.load(words,0)!==1||count<1||count>128||words.length!==16+count*16)return null;
      const times=new Float64Array(config.buffer);
      const increment=index=>{const n=Atomics.load(words,index);if(n<0x7fffffff)Atomics.store(words,index,n+1);};
      return {words,mark(kind,msg={},opcode=0,context=0,hwnd=0,aux=0,begin=null){
        try{
          const tokens=[endpointId||0,msg.frameToken||0,msg.owner||0,opcode,context,hwnd,msg.memoryOffset||0,msg.bytes||0,aux];
          // Refuse unrepresentable tokens rather than silently wrapping an
          // actual long-lived transport/frame identity into another owner.
          if(tokens.some((n,i)=>!Number.isInteger(n)||n< -0x80000000||n>(i===8?0xffffffff:0x7fffffff))){increment(4);increment(3);return null;}
          const old=Atomics.load(words,2);
          if(old>=0x7ffffffe){increment(3);return;}
          const seq=old+1,at=16+((seq-1)%count)*16,now=performance.now();
          Atomics.store(words,at,-seq);
          words[at+1]=kind;times[(at+2)/2]=now;
          tokens.forEach((token,index)=>{words[at+4+index]=token;});
          words[at+13]=begin?.sequence||0;times[(at+14)/2]=begin?now-begin.atMs:0;
          Atomics.store(words,at,seq);Atomics.store(words,2,seq);
          if(seq>count)increment(3);
          if([5,8,11,12,16].includes(kind))increment(6);
          return {sequence:seq,atMs:now};
        }catch(_){increment(4);}
      }};
    }catch(_){return null;}
  }
  function create({instance,memory,backend,apiVersion,sendFrame,endpointId,options}){
    const diagnostic=recorder(options?.glBatchDiagnostics,endpointId);
    let activeMessage=null;
    const mark=(kind,opcode=0,hwnd=0,aux=0,begin=null)=>{
      try{return diagnostic.mark(kind,activeMessage||{},opcode,bridge.currentByOwner?.get((activeMessage?.owner||0)|0)||0,hwnd,aux,begin);}catch(_){/* observation cannot affect rendering */}
    };
    const windows={},surfaces=new Map();let dirtySurfaces=[],softwareFront=0,frameToken=0;
    const emitFrame=frame=>{
      if(!diagnostic)return sendFrame({...frame,frameToken});
      const begin=mark(9,0,frame.hwnd);
      try{const value=sendFrame({...frame,frameToken});mark(10,0,frame.hwnd,0,begin);return value;}
      catch(error){mark(11,0,frame.hwnd,0,begin);throw error;}
    };
    // Geometry is authoritative at command admission, not at deferred replay.
    // Other exports still reference the shared process; only drawable size is
    // frozen with this batch so a later resize cannot resize an earlier frame.
    const renderExports={...instance.exports};
    for(const [name,edge] of [['get_client_rect_l',null],['get_client_rect_t',null],
      ['get_client_rect_r','w'],['get_client_rect_b','h']]){
      renderExports[name]=hwnd=>{
        const size=windows[hwnd]?.clientSize;
        return size?(edge?size[edge]:0):(instance.exports[name]?.(hwnd)||0);
      };
    }
    const renderer={windows,needsRepaint:false,repaint(){},
      mergeGpuLayerIntoBackCanvas(hwnd){
        const layer=windows[hwnd]?._gpuFrameLayer;
        if(!layer?.canvas)return;
        // The presentation snapshot is separate from persistent GL attachments.
        const canvas=layer.canvas;
        if(typeof canvas.transferToImageBitmap!=='function')throw new Error('GL presentation requires OffscreenCanvas');
        const begin=diagnostic?mark(6,0,hwnd):null;
        let bitmap;
        try{bitmap=canvas.transferToImageBitmap();if(diagnostic)mark(7,0,hwnd,0,begin);}
        catch(error){if(diagnostic)mark(8,0,hwnd,0,begin);throw error;}
        emitFrame({hwnd,bitmap,width:canvas.width,height:canvas.height});
      }};
    const bridge=new GL.OpenGLHostBridge({getMemory:()=>memory.buffer,exports:()=>renderExports,
      renderer,backend,apiVersion,softwareConsumer:true,createCanvas:(w,h)=>new OffscreenCanvas(w,h),getGdiSurface:id=>surfaces.get(id),
      onPresent(layer){
        if(backend!=='software'||!softwareFront)return;
        const context=[...bridge.contexts.values()].find(c=>c.layer===layer);
        if(!context?.hwnd)return;
        const begin=diagnostic?mark(6,0,context.hwnd):null;
        // The front belongs to the producing guest instance, not this
        // renderer instance's globals. It remains leased until this reply.
        let pixels,width,height;
        try{
        const v=new DataView(memory.buffer),p=softwareFront;
        width=v.getUint16(p+12,true);height=v.getUint16(p+14,true);
        const bpp=v.getUint16(p+16,true),pitch=v.getUint16(p+18,true),bits=v.getUint32(p+20,true);
        if(bpp!==32||!width||!height||bits+pitch*height>memory.buffer.byteLength)throw new Error('invalid GL software presentation surface');
        const raw=new Uint8Array(memory.buffer);pixels=new Uint8ClampedArray(width*height*4);
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){const s=bits+y*pitch+x*4,d=(y*width+x)*4;
          pixels[d]=raw[s+2];pixels[d+1]=raw[s+1];pixels[d+2]=raw[s];pixels[d+3]=255;}
        if(diagnostic)mark(7,0,context.hwnd,0,begin);
        }catch(error){if(diagnostic)mark(8,0,context.hwnd,0,begin);throw error;}
        emitFrame({hwnd:context.hwnd,width,height,pixels});
      }});
    // Install only when armed: the default path has no per-op observer call,
    // capture allocation, clock read or context lookup.
    if(diagnostic){
      const call=bridge.call;
      bridge.call=function(opcode,stack,aux,capture){
        const begin=mark(3,opcode,0,aux);
        try{const value=call.call(this,opcode,stack,aux,capture);mark(4,opcode,0,aux,begin);return value;}
        catch(error){mark(5,opcode,0,aux,begin);throw error;}
      };
    }
    function execute(msg){
        frameToken=msg.frameToken||0;
        softwareFront=msg.softwareFront>>>0;
        if(msg.windows){
          const live=new Set(msg.windows.map(win=>win.hwnd));
          for(const key of Object.keys(windows))if(!live.has(+key)){
            bridge.releaseDrawable(+key);delete windows[key];
          }
        }
        for(const win of msg.windows||[]){
          let old=windows[win.hwnd];
          if(old&&win.generation!==undefined&&old.generation!==win.generation){bridge.releaseDrawable(win.hwnd);old=null;}
          windows[win.hwnd]=Object.assign(old||{},win);
        }
        dirtySurfaces=[];
        for(const item of msg.surfaces||[]){
          const data=item.pixels;
          surfaces.set(item.id,{surface:{width:item.width,height:item.height,bpp:item.bpp,
            maskInfo:item.colorMasks?.map(mask=>({mask})),
            rgbaRect(x,y,w,h){
              const out=new Uint8ClampedArray(w*h*4);
              for(let row=0;row<h;row++)out.set(data.subarray(((y+row)*item.width+x)*4,((y+row)*item.width+x+w)*4),row*w*4);
              return out;
            },
            writeRgbaRect(x,y,w,h,pixels){
              for(let row=0;row<h;row++)data.set(pixels.subarray(row*w*4,(row+1)*w*4),((y+row)*item.width+x)*4);
              dirtySurfaces.push({id:item.id,x,y,width:w,height:h,pixels:new Uint8ClampedArray(pixels)});
            }
          }});
        }
        const batch=Stream.memoryBatch(msg.commandBuffer||memory.buffer,msg.memoryOffset,msg.bytes);
        let value;
        if(!diagnostic)value=bridge.replay(batch,msg.owner);
        else{
          const begin=mark(14);
          try{value=bridge.replay(batch,msg.owner);mark(15,0,0,0,begin);}
          catch(error){mark(16,0,0,0,begin);throw error;}
        }
        const handle=bridge.currentByOwner?.get(msg.owner||0)||0,current=bridge.contexts.get(handle);
        const size=current?.win?bridge._clientSize(current.win):current?.backend.canvas;
        const producerConfig=current?.software?[1,size?.w||size?.width||1,size?.h||size?.height||1,current.surfaceId||0]:[0,0,0,0];
        const activeWindows=[...(bridge.currentByOwner||[])].map(([owner,handle])=>
          [owner,bridge.contexts.get(handle)?.hwnd||0]);
        // Software's GL proxy supplies no-op functions for missing properties;
        // only WebGL contexts have version metadata that can cross postMessage.
        return {value,producerConfig,activeWindows,webglVersion:current?.software?undefined:current?.backend?.version,contexts:bridge.contexts.size,windows:[...bridge.contexts.values()].map(c=>c.hwnd).filter(Boolean),surfaces:dirtySurfaces};
    }
    return {
      execute:!diagnostic?execute:function(msg){
        activeMessage=msg;const begin=mark(1);
        try{const value=execute(msg);mark(2,0,0,0,begin);return value;}
        catch(error){mark(12,0,0,0,begin);throw error;}
        finally{activeMessage=null;}
      },
      destroy(){
        try{bridge.destroy();surfaces.clear();}
        finally{if(diagnostic){mark(13);try{Atomics.store(diagnostic.words,5,1);}catch(_){/* diagnostic only */}}}
      }
    };
  }
  return {create};
});
