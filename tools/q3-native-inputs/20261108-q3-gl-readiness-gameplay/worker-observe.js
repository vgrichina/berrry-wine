// Passive owner-side observations. Original imports, contexts and methods run once.
globalThis.__simgolfGL=[];globalThis.__simgolfBridges=[];
{
 const get=OffscreenCanvas.prototype.getContext;
 OffscreenCanvas.prototype.getContext=function(type,...args){
  const result=Reflect.apply(get,this,[type,...args]);
  if(result&&/^webgl/.test(type)){
   const ext=result.getExtension('WEBGL_debug_renderer_info');
   __simgolfGL.push({canvas:this,context:result,type,version:result.getParameter(result.VERSION),renderer:result.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:result.RENDERER),vendor:result.getParameter(ext?ext.UNMASKED_VENDOR_WEBGL:result.VENDOR)});
  }return result;
 };
 const imports=globalThis.importScripts;
 globalThis.importScripts=function(...args){
  const result=Reflect.apply(imports,this,args);
 if(globalThis.GLRenderWorker&&!GLRenderWorker.__q3Observed){
  const create=GLRenderWorker.create;globalThis.__q3Calls={batches:0,softwareBatches:0};
  GLRenderWorker.create=function(options){
   const before=__simgolfBridges.length,owners=new Map();let bridge,active=null;
   const adapter=create.call(this,{...options,sendFrame:frame=>{
    const value=options.sendFrame(frame);
    if(active){const c=bridge.contexts.get(bridge.currentByOwner.get(active.owner));if(c?.hwnd===frame.hwnd)active.presented++;}
    return value;
   }});
   if(__simgolfBridges.length!==before+1)throw Error('unique observed GL bridge required');
   bridge=__simgolfBridges[before];adapter.__q3Producer={bridge,owners};
   const execute=adapter.execute;
   adapter.execute=function(msg){
    const owner=msg.owner||0;let v=owners.get(owner);
    if(!v){v={owner,completed:0,softwareCompleted:0,presented:0};owners.set(owner,v);}
    active=v;
    try{
     const value=execute.call(this,msg);
     v.completed++;if(msg.softwareFront)v.softwareCompleted++;
     __q3Calls.batches++;if(msg.softwareFront)__q3Calls.softwareBatches++;
     for(const c of bridge.contexts.values())if(!c.software&&c.backend?.gl&&!c.__q3DrawObserved){
      const draw=c.backend.draw;c.__q3DrawObserved=true;
      c.backend.draw=function(operation){const value=draw.call(this,operation);if(operation.count>0){c.__q3CompletedDraws=(c.__q3CompletedDraws||0)+1;c.__q3CompletedVertices=(c.__q3CompletedVertices||0)+operation.count;}return value;};
     }
     return value;
    }finally{active=null;}
   };
   return adapter;
  };GLRenderWorker.__q3Observed=true;
 }
  if(globalThis.OpenGLCompat&&!OpenGLCompat.__simgolfObserved){
   const Base=OpenGLCompat.OpenGLHostBridge;
   OpenGLCompat.OpenGLHostBridge=class extends Base{constructor(...args){super(...args);__simgolfBridges.push(this);}};
   OpenGLCompat.__simgolfObserved=true;
  }return result;
 };
}
