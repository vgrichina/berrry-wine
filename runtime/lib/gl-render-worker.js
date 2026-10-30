// OpenGL endpoint hosted by the process render Worker.
(function(root,factory){
  const node=typeof module!=='undefined'&&module.exports;
  const api=factory(node?require('./gl-compat'):root.OpenGLCompat,
    node?require('./gl-command-stream'):root.GLCommandStream);
  if(node)module.exports=api;else root.GLRenderWorker=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(GL,Stream){
  'use strict';
  function create({instance,memory,backend,sendFrame}){
    const windows={},surfaces=new Map();let dirtySurfaces=[],softwareFront=0;
    const renderer={windows,needsRepaint:false,repaint(){},
      mergeGpuLayerIntoBackCanvas(hwnd){
        const layer=windows[hwnd]?._gpuFrameLayer;
        if(!layer?.canvas)return;
        // The presentation snapshot is separate from persistent GL attachments.
        const canvas=layer.canvas;
        if(typeof canvas.transferToImageBitmap!=='function')throw new Error('GL presentation requires OffscreenCanvas');
        sendFrame({hwnd,bitmap:canvas.transferToImageBitmap(),width:canvas.width,height:canvas.height});
      }};
    const bridge=new GL.OpenGLHostBridge({getMemory:()=>memory.buffer,exports:()=>instance.exports,
      renderer,backend,softwareConsumer:true,createCanvas:(w,h)=>new OffscreenCanvas(w,h),getGdiSurface:id=>surfaces.get(id),
      onPresent(layer){
        if(backend!=='software'||!softwareFront)return;
        const context=[...bridge.contexts.values()].find(c=>c.layer===layer);
        if(!context?.hwnd)return;
        // The front belongs to the producing guest instance, not this
        // renderer instance's globals. It remains leased until this reply.
        const v=new DataView(memory.buffer),p=softwareFront;
        const width=v.getUint16(p+12,true),height=v.getUint16(p+14,true),bpp=v.getUint16(p+16,true),pitch=v.getUint16(p+18,true),bits=v.getUint32(p+20,true);
        if(bpp!==32||!width||!height||bits+pitch*height>memory.buffer.byteLength)throw new Error('invalid GL software presentation surface');
        const raw=new Uint8Array(memory.buffer),pixels=new Uint8ClampedArray(width*height*4);
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){const s=bits+y*pitch+x*4,d=(y*width+x)*4;
          pixels[d]=raw[s+2];pixels[d+1]=raw[s+1];pixels[d+2]=raw[s];pixels[d+3]=255;}
        sendFrame({hwnd:context.hwnd,width,height,pixels});
      }});
    return {
      execute(msg){
        softwareFront=msg.softwareFront>>>0;
        for(const win of msg.windows||[]){
          const old=windows[win.hwnd];windows[win.hwnd]=Object.assign(old||{},win);
        }
        dirtySurfaces=[];
        for(const item of msg.surfaces||[]){
          const data=item.pixels;
          surfaces.set(item.id,{surface:{width:item.width,height:item.height,
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
        const value=bridge.replay(Stream.memoryBatch(memory.buffer,msg.memoryOffset,msg.bytes),msg.owner);
        const handle=bridge.currentByOwner?.get(msg.owner||0)||0,current=bridge.contexts.get(handle);
        const size=current?.win?bridge._clientSize(current.win):current?.backend.canvas;
        const producerConfig=current?.software?[1,size?.w||size?.width||1,size?.h||size?.height||1,current.surfaceId||0]:[0,0,0,0];
        return {value,producerConfig,contexts:bridge.contexts.size,windows:[...bridge.contexts.values()].map(c=>c.hwnd).filter(Boolean),surfaces:dirtySurfaces};
      },
      destroy(){for(const id of [...bridge.contexts.keys()])bridge.deleteContext(id);surfaces.clear();}
    };
  }
  return {create};
});
