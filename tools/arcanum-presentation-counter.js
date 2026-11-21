'use strict';

// Passive observer for the reviewed plain-nearest Arcanum route. Counts a
// selected upload only after an actual copy chain reaches a visible sink.
function installArcanumPresentationCounter(renderer, hwnd, width=640, height=480) {
  const win=renderer.windows[hwnd],overlay=win?._dxFrameLayer;
  const canonical=!overlay&&win?._dxOwnerCanvas?._waCanonicalPresentation;
  const layer=overlay||canonical,canvas=canonical?win._dxOwnerCanvas:layer?.canvas;
  if(!win?.visible||!canvas||canvas.width!==width||canvas.height!==height||!Number.isInteger(layer.writeSeq))
    throw Error('reviewed DirectDraw presentation geometry required');
  const prototypes=[...new Set([renderer.ctx,canvas.getContext('2d'),renderer.presentationFilter?.ctx].filter(Boolean).map(c=>Object.getPrototypeOf(c)))];
  const drawWrappers=[];
  const present=renderer._presentDisplayCanvas,filter=renderer.presentationFilter;
  const filterPresent=filter?.present,build=renderer._buildExclusivePresentationSource;
  if(prototypes.some(p=>typeof p.drawImage!=='function'))throw Error('actual Canvas2D copy seam required');
  let active=true,last=layer.writeSeq,count=0,building=false,buildCopies=[],filtering=false,sinkCopy=null;
  const copies=new WeakMap(),events=[],samples=[],errors=[];
  function valid(){return renderer.windows[hwnd]===win&&win.visible&&!win.minimized&&
    (canonical?win._dxOwnerCanvas===canvas&&canvas._waCanonicalPresentation===layer:win._dxFrameLayer===layer)&&
    canvas.width===width&&canvas.height===height;}
  function visible(sink){
    if(!sink?.isConnected||document.visibilityState!=='visible')return null;
    const style=getComputedStyle(sink),rect=sink.getBoundingClientRect();
    if(style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0||
       rect.width<=0||rect.height<=0||rect.right<=0||rect.bottom<=0||rect.left>=innerWidth||rect.top>=innerHeight)return null;
    return {id:sink.id,display:style.display,visibility:style.visibility,opacity:style.opacity,
      rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},documentVisibility:document.visibilityState};
  }
  function accept(copy,kind,sink){
    const proof=visible(sink);if(!copy||!proof||!valid()||copy.seq===last)return;
    last=copy.seq;count++;
    if(events.length<4096)events.push({...copy,kind,submittedAt:performance.now(),count,sink:proof});
    else errors.push('event cap');
  }
  function wrapDraw(draw){return function(...args){
    const result=draw.apply(this,args);
    if(active&&args[0]===canvas&&valid()){
      const row={seq:layer.writeSeq,copiedAt:performance.now(),drawArgs:args.slice(1)};
      copies.set(this.canvas,row);if(building)buildCopies.push({dest:this.canvas,row});
    }
    if(active&&filtering&&this.canvas===filter.canvas)sinkCopy={source:args[0],args:args.slice(1),at:performance.now()};
    return result;
  };}
  function buildWrapper(...args){
    building=true;buildCopies=[];
    try{const source=build.apply(this,args);const copy=buildCopies.find(c=>c.dest===source);
      if(copy)copies.set(source,copy.row);return source;
    }finally{building=false;buildCopies=[];}
  }
  function filterWrapper(source,mode,effects,options){
    filtering=true;sinkCopy=null;
    try{const result=filterPresent.call(this,source,mode,effects,options);
      if(result===true&&mode==='nearest'&&!(effects?.scanlines||effects?.mask||effects?.glow)&&
          sinkCopy?.source===source){
        const copy=copies.get(source);if(copy)accept({...copy,sinkDrawArgs:sinkCopy.args},'completed visible filter.present',filter.canvas);
      }
      return result;
    }finally{filtering=false;sinkCopy=null;}
  }
  function presentWrapper(...args){
    const result=present.apply(this,args);
    if(active&&renderer._directPresentation===true&&!renderer._exclusivePresentationSource)
      accept(copies.get(renderer.canvas),'visible direct logical canvas',renderer.canvas);
    return result;
  }
  for(const proto of prototypes){const draw=proto.drawImage,wrapper=wrapDraw(draw);drawWrappers.push([proto,'drawImage',wrapper,draw]);proto.drawImage=wrapper;}
  renderer._presentDisplayCanvas=presentWrapper;
  if(build)renderer._buildExclusivePresentationSource=buildWrapper;
  if(filterPresent)filter.present=filterWrapper;
  function sample(){const row={t:performance.now(),count,writeSeq:layer.writeSeq,valid:valid(),
    direct:renderer._directPresentation===true,sink:visible(renderer._directPresentation?renderer.canvas:renderer.presentationCanvas)};samples.push(row);return row;}
  sample();
  return {sample,stop(){sample();active=false;
    for(const [object,key,wrapper,original]of [...drawWrappers,[renderer,'_presentDisplayCanvas',presentWrapper,present],
      ...(build?[[renderer,'_buildExclusivePresentationSource',buildWrapper,build]]:[]),...(filterPresent?[[filter,'present',filterWrapper,filterPresent]]:[])]){
      if(object[key]!==wrapper)errors.push('observer wrapper replaced: '+key);else object[key]=original;
    }
    const first=samples[0],end=samples.at(-1),seconds=(end.t-first.t)/1000,frames=end.count-first.count;
    if(!frames&&end.writeSeq!==first.writeSeq)errors.push('new target uploads without attributable sink copies');
    return {meaning:'new selected game layer copied through the renderer and into a verified visible display sink; excludes overwritten uploads, repeats, hidden desktop composites, no-op presentation, Flip/API calls and page RAF',
      hwnd,width,height,layerKind:canonical?'canonical DirectDraw primary':'DirectDraw overlay',samples,events,errors,seconds,frames,
      fps:errors.length||samples.some(s=>!s.valid||!s.sink)||seconds<=0?null:frames/seconds,
      limitation:'instrumented compositor submission rate; physical scanout and unique pixel content are not measured'};
  }};
}
if(typeof module!=='undefined')module.exports={installArcanumPresentationCounter};
