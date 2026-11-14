'use strict';
// Browser Worker prelude. Observe the exact production getContext return value;
// never create a canvas/context or replace any executor/GL method.
function installContextLossControl(){
 const original=OffscreenCanvas.prototype.getContext,records=[];
 OffscreenCanvas.prototype.getContext=function(...args){
  const gl=Reflect.apply(original,this,args);
  if(gl&&/^webgl/.test(args[0])&&!records.some(r=>r.gl===gl)){
   const record={gl,canvas:this,stack:new Error().stack,lost:0,restored:0};
   records.push(record);
   this.addEventListener('webglcontextlost',event=>{event.preventDefault();record.lossEvent={cancelable:event.cancelable,defaultPrevented:event.defaultPrevented};record.lost++;});
   this.addEventListener('webglcontextrestored',()=>{record.restored++;});
  }
  return gl;
 };
 const production=()=>records.filter(r=>/d3d9-backend\.js/.test(r.stack));
 const wait=async predicate=>{const end=Date.now()+8000;while(!predicate()){
  if(Date.now()>end)throw Error('actual WebGL event timeout');await new Promise(r=>setTimeout(r,10));
 }};
 self.__d3d9Loss={
  inventory:()=>production().map((r,index)=>{
   const gl=r.gl,debug=gl.getExtension('WEBGL_debug_renderer_info');
   return {index,width:r.canvas.width,height:r.canvas.height,lost:r.lost,restored:r.restored,stack:r.stack,
    vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),
    shadingLanguageVersion:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    unmaskedVendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,
    unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null};
  }),
  async lose(index,restore){
   const r=production()[index];if(!r)throw Error('missing production D3D9 context');
   const ext=r.gl.getExtension('WEBGL_lose_context');if(!ext)throw Error('WEBGL_lose_context unavailable');
   r.lossExtension=ext;
   const lost=r.lost,restored=r.restored;ext.loseContext();
   await wait(()=>r.lost===lost+1&&r.gl.isContextLost());
   const atLoss={lost:r.lost,restored:r.restored,isContextLost:r.gl.isContextLost(),event:r.lossEvent};
   if(restore){await new Promise(resolve=>setTimeout(resolve,0));ext.restoreContext();
    await wait(()=>r.restored===restored+1&&!r.gl.isContextLost());}
   return {atLoss,lost:r.lost,restored:r.restored,isContextLost:r.gl.isContextLost()};
  },
  async restore(index){const r=production()[index];if(!r)throw Error('missing production context');
   if(r.gl.isContextLost()){const n=r.restored;r.lossExtension.restoreContext();await wait(()=>r.restored===n+1&&!r.gl.isContextLost());}
   return {lost:r.lost,restored:r.restored,error:r.gl.getError()};
  },
  error:index=>production()[index].gl.getError()
 };
}
module.exports={installContextLossControl};
