'use strict';
// Read-only capture diagnostics. Every synchronous read has its own clock;
// queued native metadata may be delivered before the final fresh guard read.
// This never publishes a scene, asks a Worker to poll, or changes a deadline.
async function inspectCapture(wine,{budgetMs=3000}={}) {
  if(!Number.isInteger(budgetMs)||budgetMs<1||budgetMs>3000)throw Error('capture budget');
  const clock=()=>({wall:Date.now(),mono:performance.timeOrigin+performance.now()});
  const start=clock(),until=start.mono+budgetMs,rows=[];
  const read=(name,fn)=>{const before=clock();try{const value=fn();rows.push({name,before,after:clock(),value});return value;}
    catch(error){rows.push({name,before,after:clock(),error:String(error)});throw error;}};
  try {
  const guard=wine._browserNativeInput,first=read('guard-before',()=>guard.snapshot());
  if(!first.healthy||first.terminal||!first.scene)throw Error('native scene unavailable');
  const renderer=wine.renderer,win=renderer.windows[first.scene[2]],bridge=wine.hostCtx?.d3dimBridge;
  const pin=()=>{const backend=wine.guestWorker,actor=first.slot===backend?.link?.slot?backend.link:backend?.threadLinks?.get(first.slot);
    return [wine.renderer,wine.memory,wine.memory?.buffer,wine.instance,wine._wasmModule,wine._processObject,
      backend,backend?.link,actor,actor?.worker,actor?.endpointIdentity,actor?._stopped,actor?._stopping,actor?._retirementComplete,
      renderer.windows[first.scene[2]],win?.wasm,win?.processId,win?.visible,
      wine.hostCtx?.d3dimBridge,bridge?.endpoint,bridge?.endpoint?.closed,bridge?.workerClosing,bridge?.workerAsyncError,
      wine._renderWorkerManager,wine._renderWorkerManager?.worker,bridge?.presenter?.win,bridge?.presenter?.layer,
      bridge?.presenter?.layer?.canvas,renderer.canvas,renderer.presentationCanvas,
      renderer._exclusivePresentationSource];};
  const refs=pin();
  const selected=()=>{const visible=Object.values(renderer.windows).filter(w=>w.visible&&!w.isChild&&w.w>0&&w.h>0);
    const stack=renderer._presentationStack(visible);return {selected:stack.sorted.includes(win)&&stack.top===win,top:stack.top?.hwnd,
      exclusive:stack.exclusive,windows:stack.sorted.map(w=>({hwnd:w.hwnd,processId:w.processId,sameInstance:w.wasm===wine.instance})),
      layerSelected:renderer._overlayFrameLayer(win)===bridge?.presenter?.layer};};
  read('selected-before',selected);
  read('publication',()=>{const record=renderer._currentDisplayRecord,display=record?.display;
    return {direct:renderer._directPresentation??null,backend:display?.backend??null,
      filterBackend:renderer.presentationFilter?.lastBackend??null,
      sourceIsLogical:display?.source===renderer.canvas,sourceIsExclusive:display?.source===renderer._exclusivePresentationSource,
      outputIsLogical:display?.output===renderer.canvas,outputIsPresentation:display?.output===renderer.presentationCanvas,
      ownerWindowIsPresenter:win===bridge?.presenter?.win,ownerInstanceMatches:win?.wasm===wine.instance,
      ownerProcess:win?.processId,layerRT:bridge?.presenter?.layer?.d3dimRT,
      layerSeq:bridge?.presenter?.layer?.d3dimPresentSeq,presents:bridge?.presenter?.presents,
      publication:renderer._immutablePublicationSequence??null,
      workerDepth:renderer._workerGuestSliceDepth??null,gdiDepth:renderer._workerGdiPaintDepth??null,
      repaintScheduled:renderer._repaintScheduled??null,repaintPending:renderer._repaintPending??null,
      repaintDeferred:renderer._workerRepaintDeferred??null,
      recordWindows:record?.windows?.map(p=>({hwnd:p.hwnd,processId:p.processId}))??null};});
  const canvases=[['connected',renderer.canvas],['presentation',renderer.presentationCanvas],
    ['source',renderer._exclusivePresentationSource],['backing',win?._backCanvas],['retained',bridge?.presenter?.layer?.canvas]];
  for(const [name,canvas]of canvases){if(!canvas)continue;
    read(name+'-metadata',()=>{const rect=canvas.getBoundingClientRect?.(),style=canvas.isConnected?getComputedStyle(canvas):null;
      return {width:canvas.width,height:canvas.height,connected:canvas.isConnected??false,id:canvas.id??null,
        rect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,
        style:style?{display:style.display,opacity:style.opacity,visibility:style.visibility}:null};});
    read(name+'-pixels',()=>{const data=canvas.getContext('2d')?.getImageData(0,0,canvas.width,canvas.height).data;
      if(!data)return null;let white=0,opaque=0,nonwhite=0,hash=2166136261;
      for(let i=0;i<data.length;i+=4){if(data[i+3]===255)opaque++;
        if(data[i]===255&&data[i+1]===255&&data[i+2]===255&&data[i+3]===255)white++;
        else if(data[i+3])nonwhite++;
        for(let c=0;c<4;c++)hash=Math.imul(hash^data[i+c],16777619)>>>0;}
      return {pixels:data.length/4,white,opaque,nonwhite,hash};});
  }
  read('guard-after-sync-reads',()=>guard.snapshot());
  // A normal timer turn only: producers continue independently. The fixed
  // operation budget and original producer timestamps remain authoritative.
  await new Promise(resolve=>setTimeout(resolve,0));
  let final;
  do {
    if(clock().mono>=until||Date.now()-start.wall>=budgetMs)throw Error('capture operation expired');
    if(refs.some((v,i)=>v!==pin()[i]))throw Error('capture owner/target changed');
    final=read('guard-after-delivery',()=>guard.snapshot());
    if(!final.healthy||final.terminal||final.slot!==first.slot||final.scene?.length!==first.scene.length||!final.scene?.every((v,i)=>v===first.scene[i]))
      throw Error('capture scene generation changed');
    if(final.ready)break;
    await new Promise(resolve=>setTimeout(resolve,10));
  }while(true);
  const target=read('selected-after',selected);
  if(!target.selected||!target.layerSelected)throw Error('capture target not selected');
  if(clock().mono>=until||Date.now()-start.wall>=budgetMs)throw Error('capture operation expired');
  return {start,completed:clock(),budgetMs,rows,final,extraGuestPolls:0,guestWrites:0};
  } catch(error) {
    error.captureReport={start,completed:clock(),budgetMs,rows,extraGuestPolls:0,guestWrites:0};
    throw error;
  }
}
module.exports={inspectCapture};
