'use strict';
// Literal full-pixel oracle for the authored native sequence. No observed
// image supplies the reference pixels, and no counter substitutes for pixels.
function classifyOwnershipPixels(bytes,width,height){
  if(width!==640||height!==480||bytes.length!==1228800)return {kind:'other',reason:'extent',width,height};
  const mismatch={blue:0,black:0,blueInteger:0,blackInteger:0,white:0,red:0,green:0};let firstOther=null;const samples=[];
  for(let y=0;y<480;y++)for(let x=0;x<640;x++){
    const at=(y*640+x)*4,r=bytes[at],g=bytes[at+1],b=bytes[at+2],a=bytes[at+3];
    if((x===20&&y===20)||(x===400&&y===300))samples.push({x,y,rgba:[r,g,b,a]});
    const rect=x<320&&y>=1&&y<=240;
    const blue=rect?r===0&&g===0&&b===255:r===255&&g===255&&b===255;
    const black=rect?r===0&&g===0&&b===0:r===255&&g===255&&b===255;
    const integerRect=x<320&&y<240;
    const blueInteger=integerRect?r===0&&g===0&&b===255:r===255&&g===255&&b===255;
    const blackInteger=integerRect?r===0&&g===0&&b===0:r===255&&g===255&&b===255;
    const red=r===255&&g===0&&b===0,green=r===0&&g===255&&b===0;
    if(!blue||a!==255)mismatch.blue++;if(!black||a!==255)mismatch.black++;
    if(!blueInteger||a!==255)mismatch.blueInteger++;if(!blackInteger||a!==255)mismatch.blackInteger++;
    if(r!==255||g!==255||b!==255||a!==255)mismatch.white++;
    if(!red||a!==255)mismatch.red++;if(!green||a!==255)mismatch.green++;
    if(!firstOther&&a!==255)firstOther={x,y,rgba:[r,g,b,a]};
  }
  const exact=Object.keys(mismatch).find(k=>!mismatch[k])||'other';
  return {kind:exact.replace('Integer',''),rasterConvention:exact.endsWith('Integer')?'integer':(['blue','black'].includes(exact)?'half-pixel':null),pixels:307200,mismatch,firstOther,samples};
}
// Appended only to the authored fixture's existing browser modules. Reads
// completed natural publications; does not request/flush/repaint or call guest.
function installOwnershipObserver(root,classify){
  const trace=root.__boidsOwnership||(root.__boidsOwnership={events:[],publications:[],errors:[],counts:{}});
  const ids=root.__boidsOwnershipIdentity||(root.__boidsOwnershipIdentity=new WeakMap());
  const id=o=>o&&(typeof o==='object'||typeof o==='function')?(ids.has(o)?ids.get(o):(ids.set(o,trace.nextId=(trace.nextId||0)+1),trace.nextId)):null;
  const order=()=>trace.ordinal=(trace.ordinal||0)+1;
  const keep=(rows,v,max)=>{if(rows.length===max)rows.shift();rows.push(v);};
  const pixels=c=>{if(!c)return null;return classify(c.getContext('2d').getImageData(0,0,c.width,c.height).data,c.width,c.height);};
  const canonical=c=>{const p=c?._waCanonicalPresentation;return p?{object:id(p),id:p.id,dibWa:p.surface?.dibWa,version:p.version,writeSeq:p.writeSeq,directDraw:p.directDraw,targetHwnd:p.targetHwnd}:null;};
  const state=(r,w)=>{const l=w._dxFrameLayer;return {window:id(w),hwnd:w.hwnd,processId:w.processId,wasm:id(w.wasm),backCanvas:id(w._backCanvas),canonical:canonical(w._backCanvas),gdiWriteSeq:w._gdiWriteSeq,layer:id(l),layerKind:l?.kind,layerAPI:l?.api,layerCanvas:id(l?.canvas),layerWriteSeq:l?.writeSeq,merged:l?.mergedIntoWindow,stale:l?.stale?.(),overlay:id(r._overlayFrameLayer(w))};};
  const pp=root.GpuStreamHost?.Presenter?.prototype;
  if(pp&&!pp.__boidsOwnership){pp.__boidsOwnership=true;const present=pp.present;
    pp.present=function(frame){const row={ordinal:order(),kind:'gpu-present',at:Date.now(),hwnd:frame.hwnd,stamp:frame.stamp,width:frame.width,height:frame.height,bitmap:id(frame.bitmap),surface:id(frame.surface),presentsBefore:this.presents};
      try{const ret=present.call(this,frame);row.presentsAfter=this.presents;row.bitmapWidthAfter=frame.bitmap?.width;const r=this._renderer();if(this.win)row.state=state(r,this.win);if(this.presents>row.presentsBefore){row.pixels=pixels(this.layer?.canvas);trace.lastGPU=row;}return ret;}
      catch(e){row.error=String(e);throw e;}finally{keep(trace.events,row,64);}
    };
  }
  const p=root.Win98Renderer?.prototype;
  if(!p||p.__boidsOwnership)return;p.__boidsOwnership=true;
  const write=p.nextSurfaceWriteSeq;
  p.nextSurfaceWriteSeq=function(){const ret=write.call(this);keep(trace.events,{ordinal:order(),kind:'write',at:Date.now(),writeSeq:ret,stack:new Error().stack.split('\n').slice(2,6)},96);return ret;};
  const attach=p.attachWindowSurface;
  p.attachWindowSurface=function(hwnd,c,direct){const ret=attach.call(this,hwnd,c,direct);keep(trace.events,{ordinal:order(),kind:'attach',at:Date.now(),hwnd,canvas:id(c),canonical:canonical(c),direct,accepted:ret},64);return ret;};
  const publish=p.observePresentationPublication;let previous='',selected=0;
  p.observePresentationPublication=function(display,sequence){
    const ret=publish.call(this,display,sequence);trace.counts.publications=(trace.counts.publications||0)+1;
    try{
      const w=Object.values(this.windows).find(w=>this._dxExclusiveHwnd(w)===(w.hwnd>>>0));if(!w)return ret;
      const s=state(this,w);
      // Every ownership transition is selected at its first completed natural
      // composition. Retain bounded rows, never a frame series.
      const key=JSON.stringify([s.window,s.backCanvas,s.layer,s.layerCanvas,s.canonical?.version,s.canonical?.writeSeq,s.gdiWriteSeq,s.layerWriteSeq,s.stale,s.merged]);
      if(key===previous||selected>=1024)return ret;previous=key;selected++;
      const row={ordinal:order(),kind:'natural-publication',at:Date.now(),publication:sequence,state:s,source:id(display.source),output:id(display.output),viewport:this._exclusivePresentationViewport?{...this._exclusivePresentationViewport}:null};
      row.sourcePixels=pixels(display.source);row.backPixels=pixels(w._backCanvas);row.layerPixels=pixels(w._dxFrameLayer?.canvas);
      row.layerProducer=trace.events.findLast(e=>e.kind==='write'&&e.writeSeq===s.layerWriteSeq);
      row.gdiProducer=trace.events.findLast(e=>e.kind==='write'&&e.writeSeq===s.gdiWriteSeq);
      row.lastGPUAtComposition=trace.lastGPU;
      // This fixture makes no CPU DirectDraw present or CPU render-target
      // write. A signature-polled DIB is not an authored new GPU/GDI write.
      const gpu=trace.lastGPU;
      const expected=!gpu||(s.gdiWriteSeq||0)>(gpu.state?.layerWriteSeq||0)?row.backPixels:gpu.pixels;
      row.expectedLatestWriter=expected?.kind;row.matchesLatestWriter=expected?.kind!=='other'&&expected?.kind===row.sourcePixels?.kind;
      if(['blue','black'].includes(row.sourcePixels?.kind)&&s.layerKind==='gpu')trace.seenAuthoredGPU=true;
      if(trace.seenAuthoredGPU&&!row.matchesLatestWriter&&!trace.firstUnexpectedPublication)trace.firstUnexpectedPublication=row;
      trace.outcomes||(trace.outcomes={});trace.outcomes[row.sourcePixels?.kind]=(trace.outcomes[row.sourcePixels?.kind]||0)+1;
      const last=trace.publications.at(-1);
      // Preserve first/last of each distinct pixel/ownership outcome. Adjacent
      // identical results accumulate a count instead of retaining a series.
      if(last&&last.sourcePixels.kind===row.sourcePixels.kind&&last.expectedLatestWriter===row.expectedLatestWriter&&last.state.stale===s.stale&&last.state.window===s.window){last.lastPublication=sequence;last.lastState=s;last.repeats=(last.repeats||0)+1;}
      else keep(trace.publications,row,32);
    }catch(e){keep(trace.errors,String(e),16);}return ret;
  };
}
function qualifyOwnershipSnapshot(snapshot){
  const assert=require('node:assert/strict'),m=snapshot.metadata,v=m.presentationViewport;
  const source=Buffer.from(snapshot.source,'base64'),reference=classifyOwnershipPixels(source,m.source.width,m.source.height);
  assert.notEqual(reference.kind,'other','source must match a complete literal reference');
  assert(v&&v.cropX===0&&v.cropY===0&&v.cropW===640&&v.cropH===480,'complete authored display');
  const b=Buffer.from(snapshot.output,'base64'),{width,height}=m.output;assert.equal(b.length,width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const inside=x>=v.dstX&&x<v.dstX+v.dstW&&y>=v.dstY&&y<v.dstY+v.dstH;
    const sx=Math.floor((x+.5-v.dstX)*640/v.dstW),sy=Math.floor((y+.5-v.dstY)*480/v.dstH);
    const rect=sx<320&&(reference.rasterConvention==='integer'?sy>=0&&sy<240:sy>=1&&sy<=240);
    const kind=reference.kind;
    const expected=!inside?[0,0,0,255]:kind==='red'?[255,0,0,255]:kind==='green'?[0,255,0,255]:kind==='white'||!rect?[255,255,255,255]:[0,0,kind==='blue'?255:0,255];
    const at=(y*width+x)*4;
    if(expected.some((n,i)=>b[at+i]!==n))throw Error(`literal complete output mismatch ${x},${y}: ${[...b.subarray(at,at+4)]}`);
  }
  return {passed:true,reference,sourcePixels:307200,outputPixels:width*height};
}
module.exports={classifyOwnershipPixels,installOwnershipObserver,qualifyOwnershipSnapshot};
