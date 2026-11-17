'use strict';

// Capture only renderer-owned public presentation/input geometry. Callers may
// select a retained image, but cannot provide a replacement transform.
function captureMapping(renderer) {
  if (!renderer?.canvas || !renderer._mapExclusiveInputPoint || !renderer._applyCursorClip)
    throw Error('native pointer mapping unavailable');
  renderer.refreshInputPresentation?.();
  const pick=(value,keys)=>value?Object.fromEntries(keys.map(k=>[k,value[k]])):null;
  const e=renderer.wasm?.exports;
  const active=!!e?.clip_cursor_active?.();
  const clip=active?{left:e.clip_cursor_left?.(),top:e.clip_cursor_top?.(),
    right:e.clip_cursor_right?.(),bottom:e.clip_cursor_bottom?.()}:null;
  const mapping={canvas:{w:renderer.canvas.width,h:renderer.canvas.height},
    sourceHwnd:renderer._exclusiveTransform?.hwnd??null,
    presentationOutput:renderer.presentationCanvas?{w:renderer.presentationCanvas.width,h:renderer.presentationCanvas.height,
      filter:!!renderer.presentationFilter}:null,
    transform:pick(renderer._exclusiveTransform,['srcX','srcY','srcW','srcH','dstX','dstY','dstW','dstH']),
    viewport:pick(renderer._exclusivePresentationViewport,['outputW','outputH','dstX','dstY','dstW','dstH',
      'nativeX','nativeY','nativeW','nativeH','cropX','cropY','cropW','cropH']),clip};
  validate(mapping);
  return mapping;
}
function validate(m) {
  const finite=o=>o&&Object.values(o).every(Number.isFinite);
  if(!finite(m?.canvas)||m.canvas.w<=0||m.canvas.h<=0)throw Error('invalid pointer canvas');
  const rect=(r,x,y,w,h)=>[x,y,w,h].every(k=>Number.isFinite(r[k]))&&r[w]>0&&r[h]>0;
  if(m.transform&&(!finite(m.transform)||!rect(m.transform,'srcX','srcY','srcW','srcH')||
      !rect(m.transform,'dstX','dstY','dstW','dstH')))throw Error('invalid pointer transform');
  const v=m.viewport;
  if(v&&(!m.transform||!rect(v,'nativeX','nativeY','nativeW','nativeH')||
      !rect(v,'dstX','dstY','dstW','dstH')||![v.outputW,v.outputH].every(Number.isFinite)||
      !(v.outputW>0&&v.outputH>0)))throw Error('invalid pointer viewport');
  if(m.clip&&!finite(m.clip))throw Error('invalid pointer clip');
}
function nativePoint(m,x,y) {
  validate(m);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=m.canvas.w||y>=m.canvas.h)
    throw Error('pointer outside reviewed canvas');
  let nx=x,ny=y;
  if(m.transform){
    const v=m.viewport,t=m.transform;
    const px=v?x*v.outputW/Math.max(1,m.canvas.w):x;
    const py=v?y*v.outputH/Math.max(1,m.canvas.h):y;
    const r=v?{x:v.nativeX,y:v.nativeY,w:v.nativeW,h:v.nativeH,dx:v.dstX,dy:v.dstY,dw:v.dstW,dh:v.dstH}:
      {x:t.srcX,y:t.srcY,w:t.srcW,h:t.srcH,dx:t.dstX,dy:t.dstY,dw:t.dstW,dh:t.dstH};
    // A bar is not reviewed native content, even though ordinary drag/release
    // input deliberately clamps it to the nearest source edge.
    if(px<r.dx||py<r.dy||px>=r.dx+r.dw||py>=r.dy+r.dh)throw Error('pointer outside reviewed presentation');
    nx=Math.min(Math.max(Math.floor(r.x+(px-r.dx)*r.w/Math.max(1,r.dw)),r.x),r.x+r.w-1);
    ny=Math.min(Math.max(Math.floor(r.y+(py-r.dy)*r.h/Math.max(1,r.dh)),r.y),r.y+r.h-1);
  }
  const c=m.clip;
  if(c&&c.right>c.left&&c.bottom>c.top){
    const cx=Math.min(Math.max(nx|0,c.left),c.right-1),cy=Math.min(Math.max(ny|0,c.top),c.bottom-1);
    if(cx!==nx||cy!==ny)throw Error('pointer displaced by native cursor clip');
  }
  return {x:nx,y:ny};
}
function containsPointer(snapshot,target,event) {
  const p=nativePoint(snapshot.pointerMapping,event.x,event.y);
  const rects=[target];
  let row=target;const seen=new Set();
  while(row.isChild){
    if(seen.has(row.hwnd))throw Error('cyclic pointer target hierarchy');
    seen.add(row.hwnd);row=snapshot.windows.find(w=>w.hwnd===row.parent);
    if(!row?.live||!row.visible)throw Error('pointer ancestor unavailable');
    if(!row.nativeClientRect)throw Error('native ancestor client geometry unavailable');
    rects.push(row.nativeClientRect);
  }
  for(const r of rects){
    if(![r.screenX,r.screenY,r.w,r.h].every(Number.isFinite)||r.w<=0||r.h<=0)
      throw Error('native target geometry unavailable');
    if(p.x<r.screenX||p.y<r.screenY||p.x>=r.screenX+r.w||p.y>=r.screenY+r.h)
      throw Error('pointer outside reviewed target');
  }
  return p;
}
function encodeReviewedCanvas(renderer,encode){
  // The hidden staging canvas is not the displayed image when the viewport
  // filter owns presentation. Read the actual complete output, including its
  // bars, normalized to the logical canvas units accepted by public input.
  const display=renderer._presentDisplayCanvas();
  if(renderer._exclusivePresentationViewport&&(!renderer.presentationFilter||
      display.output!==renderer.presentationCanvas))throw Error('reviewed presentation output unavailable');
  const output=display.output;
  if(!output||output.width<=0||output.height<=0)throw Error('reviewed display unavailable');
  if(output.width===renderer.canvas.width&&output.height===renderer.canvas.height)return encode(output);
  const complete=renderer._createOffscreen(renderer.canvas.width,renderer.canvas.height);
  const ctx=complete.getContext('2d');ctx.imageSmoothingEnabled=false;
  ctx.drawImage(output,0,0,output.width,output.height,0,0,complete.width,complete.height);
  return encode(complete);
}
module.exports={captureMapping,nativePoint,containsPointer,encodeReviewedCanvas};
