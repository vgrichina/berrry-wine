'use strict';
// Manual browser controller. No gameplay selection, guest writes, or retries.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const HELPER='tools/quake3-browser-controller.cjs';
const {createInventory}=require('./cdp-source-inventory.cjs');
const binding = (() => {
'use strict';
// Native-CDP capture/admission chain. No guest memory, clocks or callbacks are written.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const wait = ms => new Promise(r => setTimeout(r, ms));
const FIELDS = ['processId', 'processObject', 'endpoint', 'endpointObject', 'workerObject',
  'workerTarget', 'workerInstance', 'moduleObject', 'moduleSha256', 'epoch',
  'renderEndpoint', 'renderEndpointObject', 'renderWorkerObject',
  'rendererTarget', 'rendererEpoch', 'rendererModuleSha256', 'pageRendererObject', 'canvasObject',
  'windowHwnd','windowObject','windowInstance','outputCanvasObject'];
const MAX_AGE_MS = 30000;
function same(a, b) {
  for (const field of FIELDS) {
    assert(a?.[field] !== undefined && a[field] !== null && a[field] !== '', 'missing identity ' + field);
    assert.equal(b?.[field], a[field], 'identity changed: ' + field);
  }
}
// Object tokens are scoped to this actual document. Replacing an owner with an
// equal-looking object, or reloading the page, cannot reuse a reviewed token.
const PAGE_READ = `(() => {
  const k = '__mcmPassiveIdentityV1';
  if (!globalThis[k]) Object.defineProperty(globalThis, k, {value:{
    epoch:crypto.randomUUID(), ids:new WeakMap(), next:0}});
  const state=globalThis[k], token=o=>{
    if (!o || !['object','function'].includes(typeof o)) return null;
    if (!state.ids.has(o)) state.ids.set(o, state.epoch+':'+(++state.next));
    return state.ids.get(o);
  };
  const visibility=c=>{
    const refuse=(reason,e)=>({visible:false,reason,element:e?{tag:e.tagName,id:e.id,box:e.getBoundingClientRect().toJSON()}:null});
    if(!c||!c.isConnected||document.visibilityState!=='visible')return refuse('output disconnected or document not visible');
    const b=c.getBoundingClientRect();
    if(!(b.width>0&&b.height>0&&b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight))return refuse('output outside viewport',c);
    for(let e=c;e;e=e.parentElement){
      const s=getComputedStyle(e),r=e.getBoundingClientRect();
      if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)!==1)return refuse('output ancestor hidden or translucent',e);
      if(e!==c&&((/(hidden|clip|scroll|auto)/.test(s.overflowX)&&(b.left<r.left||b.right>r.right))||(/(hidden|clip|scroll|auto)/.test(s.overflowY)&&(b.top<r.top||b.bottom>r.bottom))))return refuse('output ancestor clips canvas',e);
    }
    // Canvas readback cannot depict HTML siblings, including overlays with
    // pointer-events:none. Conservatively refuse every visible intersecting
    // painted light-DOM box, even if it might paint behind the opaque canvas.
    // A real fullscreen element is in the browser top layer: ordinary DOM
    // outside it cannot paint above it. Modal/popover top layers still can;
    // refuse those globally, including their potentially full-page backdrops.
    const fullscreen=document.fullscreenElement,fullscreenOutput=fullscreen?.contains(c);
    if(fullscreenOutput){const top=document.querySelector('dialog:modal, :popover-open');if(top)return refuse('modal/popover top layer over fullscreen',top);}
    for(const e of document.querySelectorAll('*')){
      if(e===c||e.contains(c))continue;
      if(fullscreenOutput&&!fullscreen.contains(e))continue;
      const r=e.getBoundingClientRect();
      if(!(r.width>0&&r.height>0&&r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top))continue;
      let paints=true;
      for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility!=='visible'||Number(s.opacity)===0){paints=false;break;}}
      if(paints){
        const s=getComputedStyle(e),transparent=v=>!v||v==='transparent'||v.replaceAll(' ','')==='rgba(0,0,0,0)';
        const ownText=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
        const replaced=/^(CANVAS|IMG|SVG|VIDEO|IFRAME|INPUT|TEXTAREA|SELECT|BUTTON|OBJECT|EMBED)$/.test(e.tagName)||e.namespaceURI==='http://www.w3.org/2000/svg';
        const decoration=!transparent(s.backgroundColor)||s.backgroundImage!=='none'||s.boxShadow!=='none'||s.backdropFilter!=='none'||
          ['Top','Right','Bottom','Left'].some(k=>parseFloat(s['border'+k+'Width'])>0&&!transparent(s['border'+k+'Color']))||
          (s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0&&!transparent(s.outlineColor));
        const pseudo=['::before','::after'].some(p=>{const x=getComputedStyle(e,p);return x.content!=='none'&&x.content!=='normal';});
        if(ownText||replaced||decoration||pseudo)return refuse('intersecting painted DOM box',e);
      }
    }
    return {visible:true,reason:null,element:null};
  };
  return {isolated:crossOriginIsolated, apps:(typeof runningApps==='undefined'?[]:runningApps).map(a=>{
    const w=a.wine, g=w?.guestWorker, l=g?.link;
    const ports=[...(w?._renderWorkerManager?.ports?.values()||[])].filter(p=>!p.closed);
    const owned=ports.filter(p=>p.options?.api==='gl');
    if(owned.length>1)throw Error('ambiguous actual GL endpoints');
    const p=owned.length===1?owned[0]:null;
    const windows=Object.values(w?.renderer?.windows||{}).filter(v=>v.visible&&!v.isChild&&v.w>0&&v.h>0&&v.processId===w.processId&&v.wasm===w.instance);
    const win=windows.length===1?windows[0]:null;
    const output=w?.renderer&&(!w.renderer.presentationFilter||w.renderer._directPresentation?w.renderer.canvas:w.renderer.presentationCanvas||w.renderer.canvas);
    const outputVisibility=visibility(output);
    return {name:a.name,running:!!w?.running,stopped:!!w?._stopped,guestWorker:!!g,
      windowHwnd:win?.hwnd,windowObject:token(win),windowInstance:token(win?.wasm),
      outputVisible:outputVisibility.visible,outputVisibility,
      outputCanvasObject:token(w?.renderer&&(!w.renderer.presentationFilter||w.renderer._directPresentation?w.renderer.canvas:w.renderer.presentationCanvas||w.renderer.canvas)),publication:w?.renderer?._immutablePublicationSequence||0,
      pageRendererObject:token(w?.renderer),canvasObject:token(document.getElementById('screen')),processId:w?.processId,processObject:token(w),endpoint:l?.endpointIdentity,endpointObject:token(l),
      renderEndpoint:p?.id??'none',renderEndpointObject:p?token(p):'none',
      renderWorkerObject:token(w?._renderWorkerManager?.worker)??'none',
      guestEndpoint:l?.endpointIdentity,slot:l?.slot,workerObject:token(l?.worker),
      moduleObject:token(l?.module),epoch:state.epoch,
      slice:w?._workerLastSlice??null,d3dStats:g?.d3dStats??null,
      physical:[1,17,32,37,38,39,40].map(key=>({key,state:w?.renderer?.peekKeyDownState(key)??null}))};
  })};
})()`;

// No ticket, pixel read, publication, repaint, hold release or guest command.
// Reuse the production receipt validator with an ephemeral request; its only
// write is selectedOwner on this local object. No renderer state is changed.
function readinessExpression(identity,selectOutput=false,allowPendingDamage=false) { return `(() => {
  const p=(${PAGE_READ}),a=p.apps[0],want=${JSON.stringify(identity)};
  if(!p.isolated||p.apps.length!==1||!a.running||a.stopped||!a.outputVisible)throw Error('startup owner/output not live and fully visible');
  for(const k of ${JSON.stringify(FIELDS.filter(k=>!['workerTarget','workerInstance','moduleSha256','rendererTarget','rendererEpoch','rendererModuleSha256',...(selectOutput?['outputCanvasObject']:[])].includes(k)))})if(a[k]!==want[k])throw Error('startup identity changed '+k);
  const w=runningApps[0].wine,r=w.renderer;
  const pending=[];
  if(w._dxDirty||w._dxLockDeferred||w._presentFrameDue)pending.push('host surface publication');
  if(r._workerPublicationHeld()||r._workerGdiPaintDepth>0||r._repainting)pending.push('held/in-flight paint');
  if(!${allowPendingDamage}&&(r._repaintScheduled||r._repaintPending||r._workerRepaintDeferred))pending.push('ordinary damage');
  if(!r._currentDisplayRecord)pending.push('no ordinary complete display');
  if(pending.length)return {ready:false,pending,at:Date.now(),publication:a.publication};
  const record=r._validateCurrentDisplayCapture({owner:{hwnd:a.windowHwnd,window:r.windows[a.windowHwnd],processId:w.processId,instance:w.instance}});
  return {ready:true,at:Date.now(),publication:a.publication,displayedAt:record.displayedAt,outputCanvasObject:a.outputCanvasObject};
})()`; }
function precondition(reason) {
  const error=Error('capture precondition refused: '+reason+'; no retry');
  error.code='CAPTURE_PRECONDITION_REFUSED';error.inputState='NOT_SENT';return error;
}
// Restricted queued-input gate. Unlike
// capture admission, queued input need not inspect current-display surfaces.
// This restricts the experiment to an ordinary Worker-owned game window.
function queuedKeyReadinessExpression(identity) { return `(() => {
  const p=(${PAGE_READ}),a=p.apps[0],want=${JSON.stringify(identity)};
  if(!p.isolated||p.apps.length!==1||!a.running||a.stopped||!a.outputVisible)throw Error('input owner/output not live and fully visible');
  for(const k of ${JSON.stringify(FIELDS.filter(k=>!['workerTarget','workerInstance','moduleSha256','rendererTarget','rendererEpoch','rendererModuleSha256'].includes(k)))})if(a[k]!==want[k])throw Error('input identity changed '+k);
  const w=runningApps[0].wine,r=w.renderer,win=r.windows[a.windowHwnd],e=w.instance.exports;
  if(r.wasm!==w.instance||!r._guestWorkerWasms?.has(w.instance))throw Error('input is not owned by actual guest Worker');
  if(Object.values(r.windows).some(v=>v.visible&&(v!==win||v.isDialog||v.isAboutDialog||v.isFindDialog)))throw Error('ordinary game window required');
  // Pure native UI getters, never the mutating _modalDialogHwnd helper.
  if(!e.modal_dialog_hwnd||!e.menu_open_hwnd||!e.wnd_next_child_slot)throw Error('native UI identity unavailable');
  if(e.modal_dialog_hwnd()||e.menu_open_hwnd()||e.wnd_next_child_slot(win.hwnd,0)!==-1)throw Error('modal/menu/child route is outside queued-key proof');
  if(r._menuMode||r._menuEscapeHeld||r._menuMouseCapture||r._dialogBtnDrag||r._draggingWin||r._resizingWin)throw Error('native input transaction active');
  return {ready:true,at:Date.now(),route:'ordinary-worker-key',paintHeld:r._workerPublicationHeld(),surfaceReads:0};
})()`; }
// Additional gate for the proved ordinary borderless client mouse route.
// Native control/capture/non-client handlers remain outside this proof.
function queuedClientReadinessExpression(identity,point) {return `(() => {
 const base=(${queuedKeyReadinessExpression(identity)}),w=runningApps[0].wine,r=w.renderer,e=w.instance.exports,win=r.windows[${JSON.stringify(identity.windowHwnd)}],p=${JSON.stringify(point)};
 if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('finite reviewed client point required');
 if(r._sysBtnDrag||r._nativeScrollbarDrag||r._lastDeepChild||r._directMouseDown||r._inputHooksByOwner?.size)throw Error('special pointer route outside client proof');
 if(!e.ctrl_get_class||!e.get_capture_hwnd||!e.wnd_get_style_export||!e.hittest_sync)throw Error('native pointer identity unavailable');
 const style=e.wnd_get_style_export(win.hwnd)>>>0,cap=e.get_capture_hwnd()>>>0;
 if((style&0x00f40000)||e.ctrl_get_class(win.hwnd)||(cap&&cap!==win.hwnd))throw Error('native control/caption/scroll/capture route outside client proof');
 const b=r.canvas.getBoundingClientRect();
 if(!(p.x>=b.left&&p.x<b.right&&p.y>=b.top&&p.y<b.bottom))throw Error('pointer outside actual canvas');
 let q=(document.pointerLockElement||document.webkitPointerLockElement)===r.canvas?{x:r._mouseX||0,y:r._mouseY||0}:r._mapExclusiveInputPoint(Math.floor((p.x-b.left)*r.canvas.width/b.width),Math.floor((p.y-b.top)*r.canvas.height/b.height));
 q=r._applyCursorClip(q.x,q.y);
 if(q.outside||e.hittest_sync(win.hwnd,q.x,q.y)!==1)throw Error('ordinary native client hit required');
 return {...base,route:'ordinary-worker-client-mouse',point:p,guestPoint:q,capture:cap,surfaceReads:0};
})()`;}
async function awaitStartupReady({evaluate,identity,deadline,now=Date.now,onObservation=()=>{},selectOutput=false}) {
  assert(Number.isFinite(deadline)&&deadline>now(),'bounded PREBIND startup deadline');
  for(;;){
    const state=await evaluate(readinessExpression(identity,selectOutput));onObservation(state);
    if(now()>=deadline)throw precondition('bounded PREBIND startup readiness expired');
    if(state.ready)return state;
    // Poll pacing is not readiness evidence. Only the ordinary receipt and
    // current owner/output/paint checks above can admit the first ticket.
    await wait(Math.min(25,deadline-now()));
  }
}

// Public current-display ticket: existing complete output, or ordinary pending
// damage publication. Request time measures observation age, never render age.
// Original publication/display timestamps remain separately attached to bytes.
async function captureScene({evaluate, identity, now=Date.now, precheckDeadline=null,onTicketObservation=()=>{}}) {
  const nonce=crypto.randomUUID(),key='__gltronCaptureTicketV1',at=now(),stages={};
  // One transaction deadline includes every passive pre-request observation.
  // Readiness never renews it, creates a ticket, or refreshes image age.
  const deadline=Math.min(at+3000,precheckDeadline??Infinity);
  let result,failure,armed=false,lastTicket={status:'UNKNOWN',at:now(),metadata:null};
  const observe=o=>{lastTicket={...o,...(o.metadata?{displayAgeMs:o.at-o.metadata.displayedAt,readbackAgeMs:o.at-o.metadata.readbackCompletedAt}: {})};onTicketObservation({nonce,...lastTicket});};
  try {
    let arm;
    for(;;){
    assert(now()<deadline,'capture passive readiness deadline; no request');
    arm=await evaluate(`(() => {
      const p=(${PAGE_READ}),a=p.apps[0],want=${JSON.stringify(identity)};
      if(!p.isolated||p.apps.length!==1||!a.running||a.stopped||!a.outputVisible)throw Error('capture owner/output not live and fully visible');
      for(const k of ['processId','processObject','pageRendererObject','canvasObject','windowHwnd','windowObject','windowInstance','outputCanvasObject'])if(a[k]!==want[k])throw Error('capture identity changed '+k);
      if(globalThis.${key})throw Error('capture already armed');
      const w=runningApps[0].wine,r=w.renderer;
      if(r._immutableCaptureRequest)throw Error('capture already pending; no retry');
      const readiness=(${readinessExpression(identity,false,true)});
      if(Date.now()>=${deadline})throw Error('capture transaction deadline before ticket');
      if(!readiness.ready)return {state:'NOT_READY',nonce:${JSON.stringify(nonce)},requestCalled:false,ticketCreated:false,inputDispatched:false,...readiness};
      const requestCallAt=Date.now(),t=w.requestCurrentDisplayCapture({hwnd:a.windowHwnd});
      const output=!r.presentationFilter||r._directPresentation?r.canvas:r.presentationCanvas||r.canvas;
      const h={nonce:${JSON.stringify(nonce)},ticket:t,requestCallAt,publication:a.publication,renderer:r,
        output,width:output.width,height:output.height,
        windows:Object.values(r.windows).filter(v=>v.visible&&!v.isChild&&v.w>0&&v.h>0).map(window=>({window,values:Object.fromEntries(['hwnd','processId','wasm','x','y','w','h','z','style','region'].map(k=>[k,window[k]]))}))};
      globalThis.${key}=Object.freeze(h);
      return {state:'ARMED',nonce:${JSON.stringify(nonce)},requestCalled:true,ticketCreated:true,at:Date.now(),requestCallAt,publication:a.publication,ticketStatus:t.status};
    })()`);
    if(arm.state==='NOT_READY'){
      assert.equal(arm.nonce,nonce,'precheck nonce changed');
      assert(arm.requestCalled===false&&arm.ticketCreated===false&&arm.inputDispatched===false,'passive precheck effects');
      assert(arm.ready===false&&Array.isArray(arm.pending)&&arm.pending.length,'known passive readiness refusal required');
      onTicketObservation({nonce,status:'NOT_REQUESTED',phase:'passive',at:now(),deadline,...arm});
      assert(now()<deadline,'capture passive readiness deadline; no request');
      await wait(Math.min(10,deadline-now()));
      continue;
    }
    break;
    }
    assert(arm.state==='ARMED'&&arm.nonce===nonce&&arm.requestCalled===true&&arm.ticketCreated===true,'ambiguous capture arm; no retry');
    armed=true;stages.armMs=now()-at;stages.arm=arm;
    observe({status:arm.ticketStatus??'UNKNOWN',at:arm.at,requestCallAt:arm.requestCallAt,metadata:null,phase:'arm'});
    while(now()<deadline) {
      result=await evaluate(`(() => {
        const h=globalThis.${key};if(!h||h.nonce!==${JSON.stringify(nonce)})throw Error('capture ticket replaced');
        const t=h.ticket,status=t.status,readStart=performance.now();
        // Complete is terminal in the production ticket closure: read() copies
        // retained arrays, never the live canvas. A newer ordinary paint cannot
        // invalidate these observed bytes or refresh their original timestamps.
        const r=status==='complete'?t.read():null,m=r?.metadata??null;
        const ticketObservation={status,at:Date.now(),requestCallAt:h.requestCallAt,metadata:m,phase:'poll',
          paint:{held:h.renderer._workerPublicationHeld(),gdiDepth:h.renderer._workerGdiPaintDepth??0,repainting:!!h.renderer._repainting}};
        try {
        if(status==='failed')return {refused:'capture ticket failed: '+t.error,code:'CAPTURE_TICKET_FAILED',ticketObservation};
        if(status==='cancelled')throw Error('capture cancelled; no replay');
        if(!['pending','complete'].includes(status))throw Error('UNKNOWN capture ticket status; no replay');
        if(status==='pending'){
          const readiness=(${readinessExpression(identity,false,true)});
          if(!readiness.ready)throw Error('post-ticket readiness changed while pending: '+readiness.pending.join(', ')+'; no retry');
          return {pending:true,ticketObservation};
        }
        if(!r||!m)throw Error('complete ticket has no immutable bytes');
        const p=(${PAGE_READ}),a=p.apps[0],want=${JSON.stringify(identity)};
        if(p.apps.length!==1||!a.running||a.stopped||!a.outputVisible)throw Error('capture owner/output hidden or clipped');
        for(const k of ['processId','processObject','pageRendererObject','canvasObject','windowHwnd','windowObject','windowInstance','outputCanvasObject'])if(a[k]!==want[k])throw Error('capture identity changed '+k);
        const liveWindows=Object.values(h.renderer.windows).filter(v=>v.visible&&!v.isChild&&v.w>0&&v.h>0);
        if(h.output.width!==h.width||h.output.height!==h.height||liveWindows.length!==h.windows.length||h.windows.some(pin=>!liveWindows.includes(pin.window)||Object.keys(pin.values).some(k=>pin.window[k]!==pin.values[k])))throw Error('capture output/owner geometry changed');
        if(m.observation!=='current-display'||m.publication<h.publication)throw Error('capture display/publication binding changed');
        if(!['displayedAt','requestedAt','readbackStartedAt','readbackCompletedAt'].every(k=>Number.isFinite(m[k]))||m.displayedAt>m.readbackStartedAt||m.requestedAt>m.readbackStartedAt||m.readbackStartedAt>m.readbackCompletedAt||m.readbackCompletedAt>Date.now())throw Error('capture display timing invalid');
        const c=document.createElement('canvas');c.width=m.output.width;c.height=m.output.height;
        const start=performance.now();c.getContext('2d').putImageData(new ImageData(r.outputRGBA,c.width,c.height),0,0);
        const data=c.toDataURL('image/png');
        return {metadata:m,data,ticketObservation,publishedAt:m.publicationAt,encodedAt:Date.now(),readAndCopyMs:start-readStart,encodeMs:performance.now()-start};
        }catch(e){return {refused:e.message,ticketObservation};}
      })()`);
      if(result?.ticketObservation)observe(result.ticketObservation);
      if(result?.refused){const e=Error(result.refused+'; no retry');e.code=result.code??'CAPTURE_TICKET_REFUSED';result=null;e.requestCalled=true;e.ticketCreated=true;throw e;}
      if(result?.pending)result=null;
      if(result)break;
      await wait(10);
    }
    assert(result,'current complete-scene capture deadline; no retry');
    assert(now()<deadline,'late complete-scene capture refused');
    const m=result.metadata;
    assert.equal(m.completion,'canvas2d-readback');
    assert.equal(m.observation,'current-display');
    assert(['already-displayed','ordinary-publication-after-request'].includes(m.content));
    assert.equal(m.captureOwner.hwnd,identity.windowHwnd);
    assert.equal(m.captureOwner.processId,identity.processId);
    assert(m.composition.windows.some(w=>w.hwnd===identity.windowHwnd&&w.processId===identity.processId));
    assert(/^data:image\/png;base64,/.test(result.data));
    stages.readAndEncodeMs=now()-at;stages.encodeMs=result.encodeMs;stages.readAndCopyMs=result.readAndCopyMs;stages.publishedAt=result.publishedAt;
    return {png:Buffer.from(result.data.split(',')[1],'base64'),metadata:m,at:new Date(at).toISOString(),stages,nonce};
  } catch(e) {
    if(/UNKNOWN/.test(e.message)&&!e.code)observe({status:'UNKNOWN',at:now(),metadata:null,phase:'transport',lastObserved:lastTicket});
    failure=e;e.ticketObservation=lastTicket;e.captureNonce=nonce;throw e;
  } finally {
    // A terminal transport refuses this cleanup too. In that case the whole
    // document is destroyed by host teardown, never reused or rebound.
    if(armed)try{
      const terminal=await evaluate(`(() => {const h=globalThis.${key};if(!h||h.nonce!==${JSON.stringify(nonce)})throw Error('capture cancellation identity changed');const status=h.ticket.status,metadata=status==='complete'?h.ticket.read().metadata:null;const cancelled=h.ticket.cancel();delete globalThis.${key};return {status,metadata,at:Date.now(),requestCallAt:h.requestCallAt,phase:'cleanup',cancelled,statusAfterCancel:h.ticket.status};})()`);
      if(terminal.phase==='cleanup')observe(terminal);
    }catch(e){
      if(!failure){e.ticketObservation=lastTicket;e.captureNonce=nonce;throw e;}
      failure.cleanupError=String(e);
    }
    if(failure)failure.ticketObservation=lastTicket;
    if(result)assert(now()<deadline,'late complete-scene capture cleanup refused');
  }
}
const WORKER_READ = `(() => {
  if (typeof endpointIdentity==='undefined'||typeof workerSlot==='undefined'||typeof instance==='undefined'||!instance) return null;
  if (!globalThis.__mcmPassiveInstanceV1) Object.defineProperty(globalThis,'__mcmPassiveInstanceV1',
    {value:{ids:new WeakMap(),epoch:crypto.randomUUID(),next:0}});
  const s=globalThis.__mcmPassiveInstanceV1;
  if(!s.ids.has(instance))s.ids.set(instance,s.epoch+':'+(++s.next));
  return {endpointIdentity,slot:workerSlot,instance:s.ids.get(instance)};
})()`;
const RENDER_READ = `(() => {
  if(typeof endpoints==='undefined')return [];
  if(!globalThis.__mcmPassiveRenderV1)Object.defineProperty(globalThis,'__mcmPassiveRenderV1',
    {value:{ids:new WeakMap(),epoch:crypto.randomUUID(),next:0}});
  const s=globalThis.__mcmPassiveRenderV1;
  return Array.from(endpoints,([id,e])=>{
    if(!s.ids.has(e))s.ids.set(e,s.epoch+':'+(++s.next));
    if(typeof instance==='undefined'||!instance)throw Error('renderer instance unavailable');
    if(!s.ids.has(instance))s.ids.set(instance,s.epoch+':'+(++s.next));
    return {id,epoch:s.ids.get(e)+'/'+s.ids.get(instance),failed:!!e.failed,
      control:e.control?{completed:Atomics.load(e.control,1),error:Atomics.load(e.control,2),commands:Atomics.load(e.control,5)}:null};
  });
})()`;

// Separate host UI observation. These browser pixels are never game admission.
const HOST_FIELDS=FIELDS.filter(k=>!['outputCanvasObject','workerTarget','workerInstance','moduleSha256','rendererTarget','rendererEpoch','rendererModuleSha256'].includes(k));
const HOST_READ=`(() => {
  const page=(${PAGE_READ}),s=globalThis.__mcmPassiveIdentityV1;
  const token=o=>{if(!o)return null;if(!s.ids.has(o))s.ids.set(o,s.epoch+':'+(++s.next));return s.ids.get(o);};
  const strip=document.getElementById('browser-fullscreen-consent'),buttons=strip?.querySelectorAll('button');
  const button=buttons?.length===1?buttons[0]:null,wrap=document.getElementById('screen-wrap');
  const r=button?.getBoundingClientRect(),box=r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
  const x=r?r.x+r.width/2:null,y=r?r.y+r.height/2:null;
  const visible=e=>{if(!e?.isConnected||document.visibilityState!=='visible')return false;const b=e.getBoundingClientRect();for(let p=e;p;p=p.parentElement){const c=getComputedStyle(p),r=p.getBoundingClientRect();if(c.display==='none'||c.visibility!=='visible'||Number(c.opacity)!==1)return false;if(p!==e&&((/(hidden|clip|scroll|auto)/.test(c.overflowX)&&(b.left<r.left||b.right>r.right))||(/(hidden|clip|scroll|auto)/.test(c.overflowY)&&(b.top<r.top||b.bottom>r.bottom))))return false;}return true;};
  return {at:Date.now(),page,fullscreen:token(document.fullscreenElement),wrap:token(wrap),
    viewport:{width:innerWidth,height:innerHeight,scale:devicePixelRatio},
    strip:{object:token(strip),text:strip?.textContent.trim(),visible:visible(strip)},
    button:{object:token(button),label:button?.textContent.trim(),box,x,y,
      enabled:!!button&&!button.disabled,visible:visible(button),
      hit:!!button&&document.elementFromPoint(x,y)===button,
      contained:!!r&&r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}};
})()`;
function sameHostOwner(want,observed){
  assert(observed.page.isolated&&observed.page.apps.length===1,'one isolated host owner');
  const a=observed.page.apps[0];assert(a.name==='quake3_demo'&&a.running&&!a.stopped&&a.guestWorker,'live host owner');
  for(const k of HOST_FIELDS){assert(want[k]!==undefined&&want[k]!==null,'missing host identity '+k);assert.equal(a[k],want[k],'host owner changed '+k);}
}
function consentButton(observed){
  assert(!observed.fullscreen,'already fullscreen; no consent click');
  assert(observed.wrap&&observed.strip.visible&&observed.strip.text.includes('App is using the full page'),'visible exact consent strip');
  const b=observed.button;
  assert(b.object&&b.label==='Use browser fullscreen'&&b.enabled&&b.visible&&b.hit&&b.contained,'visible complete enabled consent button');
}
function reviewHostBootstrap(scene,review,live,now=Date.now()){
  assert(review?.sha256===scene.sha256&&review.observation?.trim()&&review.hostOnly===true,'personal raw-browser host review required');
  assert(now-scene.at>=0&&now-scene.at<30000,'fresh host menu geometry review');
  sameHostOwner(scene.observation.page.apps[0],live);consentButton(scene.observation);consentButton(live);
  for(const k of ['object','label','x','y'])assert.equal(live.button[k],scene.observation.button[k],'consent button changed '+k);
  assert.deepEqual(live.button.box,scene.observation.button.box,'consent geometry changed');
  assert.equal(live.wrap,scene.observation.wrap);assert.equal(live.strip.object,scene.observation.strip.object);
  assert.deepEqual(live.viewport,scene.observation.viewport,'host viewport changed');
  return {x:live.button.x,y:live.button.y};
}

function createChain({evaluate, send, workers, pageSession, app = 'quake3_demo', expectedModules = null, now = Date.now,onTicketObservation=()=>{},onInputObservation=()=>{},inputReadiness=readinessExpression}) {
  let latest = null, pinnedIdentity = null, busy = false, closed = false, startup = null;
  const consumed = new Set();
  async function readLive() {
    assert(!closed,'closed chain');
    const page = await evaluate(PAGE_READ);
    assert(page.isolated && page.apps.length === 1, 'one isolated registered app required');
    const a = page.apps[0];
    assert(a.name === app && a.running && !a.stopped && a.guestWorker && a.outputVisible, 'live fully visible registered app required');
    const matches = [];
    for (const w of workers.values()) {
      if (w.closed || !w.url.includes('guest-worker')) continue;
      const live = await evaluate(WORKER_READ, w.sessionId);
      if (live?.endpointIdentity === a.guestEndpoint && live.slot === a.slot) matches.push({w, live});
    }
    assert.equal(matches.length, 1, 'unique actual guest Worker target required');
    const {w, live} = matches[0];
    const scripts = [...new Map(w.scripts.filter(s => s.bytecodeAvailable && s.sha256 && !s.error).map(s=>[s.scriptId,s])).values()];
    assert.equal(scripts.length, 1, 'unique recovered live Worker module required');
    const source = await send('Debugger.getScriptSource', {scriptId:scripts[0].scriptId}, w.sessionId);
    assert(source.bytecode, 'live module bytecode required');
    const moduleSha256 = sha(Buffer.from(source.bytecode, 'base64'));
    assert.equal(moduleSha256, scripts[0].sha256, 'live module bytes changed');if(expectedModules)assert(expectedModules.includes(moduleSha256),'immutable staged module required');
    let rendererTarget='none',rendererEpoch='none',rendererModuleSha256='none';
    if(a.renderEndpoint!=='none') {
      const owners=[];
      for(const r of workers.values())if(!r.closed&&r.url.includes('d3d-render-worker')) {
        const endpoints=await evaluate(RENDER_READ,r.sessionId);
        for(const endpoint of endpoints)if(endpoint.id===a.renderEndpoint)owners.push({r,endpoint});
      }
      assert.equal(owners.length,1,'unique actual owning renderer required');
      const {r,endpoint}=owners[0];assert(!endpoint.failed&&!endpoint.control?.error,'live renderer required');
      rendererTarget=r.targetId;rendererEpoch=endpoint.epoch;
      const modules=[...new Map(r.scripts.filter(s=>s.sha256&&s.bytecodeAvailable&&!s.error).map(s=>[s.scriptId,s])).values()];
      assert.equal(new Set(modules.map(s=>s.sha256)).size,1,'unique actual renderer module required');
      const bytes=await send('Debugger.getScriptSource',{scriptId:modules[0].scriptId},r.sessionId);
      assert(bytes.bytecode,'actual renderer module bytes required');
      rendererModuleSha256=sha(Buffer.from(bytes.bytecode,'base64'));
      assert.equal(rendererModuleSha256,modules[0].sha256);
    }
    const rendererIdentity={rendererTarget,rendererEpoch,rendererModuleSha256};
    const identity = {...a, workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity};
    same(identity, identity);
    if (pinnedIdentity) same(pinnedIdentity, identity);
    else pinnedIdentity = {...identity};
    // Module recovery awaits Chrome and can span ordinary producer work.
    // Recheck the actual instance as well as the page references afterward;
    // the final synchronous page arm separately checks paint/readiness.
    assert.deepEqual(await evaluate(WORKER_READ,w.sessionId),live,'Worker instance changed during module validation');
    if(rendererTarget!=='none'){
      const r=[...workers.values()].find(r=>r.targetId===rendererTarget&&!r.closed);
      assert(r,'renderer detached during module validation');
      const endpoints=await evaluate(RENDER_READ,r.sessionId);
      assert(endpoints.some(e=>e.id===a.renderEndpoint&&e.epoch===rendererEpoch&&!e.failed&&!e.control?.error),'renderer changed during module validation');
    }
    const after = await evaluate(PAGE_READ);
    assert(after.apps.length === 1 && after.apps[0].running && !after.apps[0].stopped &&
      after.apps[0].outputVisible, 'owner/output hidden or clipped during identity validation');
    same(identity, {...after.apps[0], workerTarget:w.targetId, workerInstance:live.instance, moduleSha256,...rendererIdentity});
    assert(!w.closed, 'Worker detached during identity read');
    return {identity, page:after, worker:{targetId:w.targetId, sessionId:w.sessionId, ...live}};
  }
  function fresh(capture, maxAgeMs=MAX_AGE_MS) {
    const age = now() - Date.parse(capture?.at);
    if (!(Number.isFinite(age) && age >= 0 && age < maxAgeMs)) {
      const e = Error('stale scene refused'); e.code = 'STALE_SCENE_BEFORE_DISPATCH'; throw e;
    }
    return age;
  }
  async function capture(label) {
    assert(!closed && !busy, 'closed or concurrent chain'); busy = true;
    const transactionDeadline=Math.min(now()+3000,startup?.deadline??Infinity);
    try {
      const before=await readLive();
      const shot=await captureScene({evaluate,identity:before.identity,now,precheckDeadline:transactionDeadline,onTicketObservation:o=>{
        onTicketObservation(o);if(o.status==='NOT_REQUESTED')startup?.onObservation(o);
      }});
      startup=null;
      // Validation after a screenshot can be slow on a busy renderer. It must
      // not make the reviewed pixels appear younger than their capture.
      const after = await readLive(); same(before.identity, after.identity);
      assert(now()<transactionDeadline,'capture transaction validation deadline; no retry');
      assert(shot.metadata.publication<=after.identity.publication,'publication regressed');
      const png = shot.png;
      latest = {label, at:shot.at, completedAt:new Date(now()).toISOString(), sha256:sha(png), identity:after.identity,metadata:shot.metadata,stages:shot.stages,nonce:shot.nonce};
      return {capture:structuredClone(latest), png, before, after};
    } catch(e) {closed=true;throw e;} finally { busy = false; }
  }
  async function admit(review, dispatch) {
    assert(!closed && !busy, 'closed or concurrent chain'); busy = true;
    let effects = false;
    try {
      assert(latest && review?.label === latest.label && review.sha256 === latest.sha256 && review.review?.trim(), 'current reviewed capture required');
      assert(!consumed.has(latest.nonce), 'capture nonce already consumed; no replay');
      const maxAgeMs=review.maxAgeMs??MAX_AGE_MS;
      assert([5000,30000].includes(maxAgeMs),'unchanged precision/menu freshness required');
      same(latest.identity, review.identity); fresh(latest,maxAgeMs);
      const live = await readLive(); same(latest.identity, live.identity); const ageMs = fresh(latest,maxAgeMs);
      // A completed observation does not grant input privilege by itself.
      // Revalidate owner, visibility and the selected input route independently.
      // Passive observation for this single personal intent. No prearm,
      // ticket, event, forced paint/end or scene-timestamp update occurs here.
      // Each probe has a fresh nonce; only natural producer readiness counts.
      const intentDeadline=Math.min(Date.parse(latest.at)+maxAgeMs,review.intentDeadlineMs??Infinity,now()+3000);
      for(;;){
        fresh(latest,maxAgeMs);
        if(now()>=intentDeadline){const e=Error('personal intent expired before dispatch');e.code='STALE_SCENE_BEFORE_DISPATCH';throw e;}
        const probeNonce=crypto.randomUUID(),ready=await evaluate(inputReadiness(latest.identity,false,true));
        onInputObservation({probeNonce,at:now(),sceneAt:latest.at,sceneNonce:latest.nonce,intentDeadline,ready,events:0,prearms:0,tickets:0});
        fresh(latest,maxAgeMs);
        if(now()>=intentDeadline){const e=Error('personal intent expired before dispatch');e.code='STALE_SCENE_BEFORE_DISPATCH';throw e;}
        if(ready.ready){
          // Full process/Worker/module validation after the passive interval.
          // The final synchronous gate remains, and is never polled after UP
          // prearm or after any physical/input request has been sent.
          same(latest.identity,(await readLive()).identity);fresh(latest,maxAgeMs);
          const final=await evaluate(inputReadiness(latest.identity,false,true));
          if(final.ready&&now()<intentDeadline)break;
        }
        await wait(Math.min(10,Math.max(1,intentDeadline-now())));
      }
      fresh(latest,maxAgeMs);
      consumed.add(latest.nonce);
      effects = true;
      return await dispatch({ageMs, capture:structuredClone(latest), live});
    } catch (e) {
      // Identity/partial/UNKNOWN failures close this chain. Only a provably
      // pre-effect stale refusal permits a new capture through the transport.
      if (e.code === 'STALE_SCENE_BEFORE_DISPATCH' && latest) consumed.add(latest.nonce);
      if (effects || e.code !== 'STALE_SCENE_BEFORE_DISPATCH') closed = true;
      throw e;
    } finally { busy = false; }
  }
  // Bounded passive reads only. These are execution observations, never a
  // logical frame/keyboard-poll or simulation-step assertion.
  async function progress(identity) {
    const page = await evaluate(PAGE_READ), a = page.apps[0];
    assert(page.apps.length === 1 && a?.running && !a.stopped);
    for (const f of ['processId','processObject','endpoint','endpointObject','workerObject','moduleObject','epoch','renderEndpoint','renderEndpointObject','renderWorkerObject'])
      assert.equal(a[f], identity[f], 'held identity changed: '+f);
    const w = [...workers.values()].find(w=>w.targetId===identity.workerTarget&&!w.closed);
    assert(w, 'held Worker retired');
    // Do not enqueue guest export commands: the existing page slice and
    // shared render controls are passive and remain observable while blocked.
    const render = [];
    for (const r of workers.values()) if (!r.closed && r.url.includes('d3d-render-worker')) {
      const endpoints=await evaluate(RENDER_READ,r.sessionId);
      if(r.targetId===identity.rendererTarget)assert(endpoints.some(e=>e.id===identity.renderEndpoint&&e.epoch===identity.rendererEpoch&&!e.failed&&!e.control?.error),'held renderer epoch changed');
      render.push({targetId:r.targetId,endpoints});
    }
    return {at:new Date(now()).toISOString(), slice:a.slice, d3dStats:a.d3dStats, physical:a.physical, render};
  }
  async function prepareStartup(deadline,onObservation) {
    assert(!closed&&!busy&&!latest,'PREBIND startup only');busy=true;
    try {
      assert(!startup,'startup deadline already fixed');
      assert(Number.isFinite(deadline)&&deadline>now(),'bounded PREBIND startup deadline');
      startup={deadline,onObservation:onObservation??(()=>{})};
      const live=await readLive();
      return await awaitStartupReady({evaluate,identity:live.identity,deadline,now,onObservation});
    }catch(e){closed=true;throw e;}finally{busy=false;}
  }
  return {capture, admit, readLive, progress, prepareStartup, get closed(){return closed;}};
}

return {createChain,captureScene,same,sha,FIELDS,MAX_AGE_MS,PAGE_READ,WORKER_READ,RENDER_READ,readinessExpression,queuedKeyReadinessExpression,queuedClientReadinessExpression,awaitStartupReady,HOST_READ,HOST_FIELDS,sameHostOwner,consentButton,reviewHostBootstrap};

})();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const KEYS={ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,Enter:13,Escape:27,Space:32,Tab:9,Pause:19,F1:112,w:87,a:65,s:83,d:68,y:89};
const keyCode=key=>key.length===1?'Key'+key.toUpperCase():key;

const GL_OBSERVER = `(() => {
 if(globalThis.__gltronObserver)throw Error('observer already installed');
 const bridges=[],contexts=[],counts={draws:0,readbacks:0,transfers:0,creates:0,bindings:0,presents:0};
 const get=OffscreenCanvas.prototype.getContext,transfer=OffscreenCanvas.prototype.transferToImageBitmap;
 OffscreenCanvas.prototype.getContext=function(type,...args){
  const gl=get.call(this,type,...args);
  if(gl&&/^webgl/.test(type)&&!contexts.some(x=>x.gl===gl)){
   const ext=gl.getExtension('WEBGL_debug_renderer_info');
   contexts.push({gl,canvas:this,type,version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER)});
   for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced','readPixels']){
    const old=gl[method];if(typeof old==='function')gl[method]=function(...a){const v=old.apply(this,a);counts[method==='readPixels'?'readbacks':'draws']++;return v;};
   }
  }return gl;
 };
 OffscreenCanvas.prototype.transferToImageBitmap=function(...a){const v=transfer.apply(this,a);counts.transfers++;return v;};
 let compat;
 Object.defineProperty(globalThis,'OpenGLCompat',{configurable:true,get(){return compat;},set(v){
  compat=v;const p=v.OpenGLHostBridge.prototype;
  for(const [method,count] of [['createContext','creates'],['makeCurrent','bindings'],['present','presents']]){
   const old=p[method];p[method]=function(...a){const result=old.apply(this,a);if(!bridges.includes(this))bridges.push(this);counts[count]++;return result;};
  }
 }});
 globalThis.__gltronObserver={snapshot:()=>({...counts,frontendDraws:compat?.stats?.draws??null,frontendPresents:compat?.stats?.presents??null,devices:contexts.map(x=>({type:x.type,version:x.version,renderer:x.renderer,width:x.canvas.width,height:x.canvas.height})),
  contexts:bridges.flatMap(b=>[...b.contexts].map(([id,x])=>({id,hwnd:x.hwnd,software:x.software===true,current:[...b.currentByOwner].some(([o,h])=>h===id),owners:[...b.currentByOwner],backend:x.backend?.constructor?.name,deviceObserved:contexts.some(y=>y.gl===x.backend?.gl||y.gl===b._webglBackend?.gl)})))})};
 return true;
})()`;

const QUIT={'open-menu':'Escape','menu-up':'ArrowUp','menu-down':'ArrowDown','menu-left':'ArrowLeft','menu-right':'ArrowRight','select-quit':'Enter','confirm-quit':'y'};
function gameplayCutoff(launch){assert(Number.isFinite(launch.at)&&Number.isFinite(launch.deadline)&&launch.deadline-launch.at>180,'immutable launch/deadline required');return (launch.deadline-180)*1000;}
function policy(c,launch,phase,now=Date.now()) {
  assert(['play','menu','quit'].includes(c.mode));
  const mouse=!!c.mouse;assert(Array.isArray(c.keys)&&c.keys.length===(mouse?0:1));
  if(mouse){assert(c.mouse.button==='left'&&Number.isFinite(c.mouse.x)&&Number.isFinite(c.mouse.y),'finite left mouse point');assert(c.mode==='play'&&c.liveScene===true&&c.weapon?.trim()&&c.ammo?.trim()&&c.enemy?.trim(),'reviewed player/weapon/ammo/visible opponent required for Q3 Mouse1 attack');}
  assert(c.keys.every(k=>Object.hasOwn(KEYS,k)));
  assert(Number.isInteger(c.ms)&&c.ms>=50&&c.ms<=1500,'finite hold leaves independent UP margin');
  assert(now<launch.deadline*1000,'immutable deadline');
  assert(c.observation?.trim(),'personal scene review required');
  if(c.mode==='play'&&!mouse)assert(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter','Tab','Pause','F1'].includes(c.keys[0])&&c.liveScene===true,'personally reviewed live player scene required');
  if(c.mode!=='play')assert(c.keys.length===1&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','Escape',...(c.mode==='quit'?['y']:[])].includes(c.keys[0]));
  if(c.mode==='quit'){
    assert(Object.hasOwn(QUIT,c.route)&&c.keys.length===1&&(c.keys[0]===QUIT[c.route]||(c.route==='confirm-quit'&&c.keys[0]==='Enter'&&c.selectedYes==='Yes')),'reviewed native Quit route required');
    if(c.route==='confirm-quit')assert(c.confirmQuit===true,'personally reviewed native Quit confirmation required');
    if(c.route==='select-quit')assert(['Quit','Exit','EXIT','Exit Game','EXIT GAME'].includes(c.selectedQuit),'personally reviewed Quit selection required');
  }
  else assert(!phase&&now+3000<gameplayCutoff(launch),'irreversible 180 second gameplay cutoff');
  return c.mode==='play'?5000:30000;
}
function connection(url,observer=require('./quake3-startup-observer.cjs').fromEnvironment({PAGE_READ:binding.PAGE_READ,HOST_READ:binding.HOST_READ,GL_OBSERVER})) {
  const ws=new WebSocket(url),pending=new Map();let id=0,terminal=null;
  if(observer)Object.defineProperty(ws,'startupObserver',{value:observer});
  function fail(error,cause='transport-failure',trigger=null){
    terminal??=error;
    observer?.markTerminal(cause,trigger);
    for(const p of pending.values()){clearTimeout(p.timer);p.reject(terminal);}
    pending.clear();
  }
  const ready=new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  ws.addEventListener('open',()=>observer?.socketEvent('open'));
  ws.addEventListener('close',()=>{observer?.socketEvent('close');fail(Error('UNKNOWN CDP closed; never replay'),'socket-close');});
  ws.addEventListener('error',()=>{observer?.socketEvent('error');fail(Error('UNKNOWN CDP error; never replay'),'socket-error');});
  ws.onmessage=msg=>{observer?.received(msg.data);const v=JSON.parse(msg.data);if(v.id){const p=pending.get(v.id);if(p){
    if(v.sessionId!==p.sessionId){fail(Error('UNKNOWN CDP response session changed; never replay'),'session-mismatch',{id:v.id});return;}
    clearTimeout(p.timer);pending.delete(v.id);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);
  }}else api.event(v);};
  const api={ws,ready,event:()=>{},get closed(){return !!terminal;},abort(error){fail(error,'source-inventory-failure');},send(method,params={},sessionId){
    if(terminal)return Promise.reject(terminal);
    return new Promise((resolve,reject)=>{const n=++id,start=performance.now(),startedAt=Date.now(),timer=setTimeout(()=>fail(Error('UNKNOWN '+method+'; never replay'),'deadline',{id:n,method,sessionId:sessionId??null}),3000);pending.set(n,{resolve,reject,timer,sessionId});try{const wire=JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})});observer?.sent(wire,{start,startedAt,deadline:start+3000});ws.send(wire);}catch(e){fail(e,'send-failed',{id:n,method});}});
  }};
  return api;
}
function save(out,n,v){const p=path.join(out,n);assert(!fs.existsSync(p),n);fs.writeFileSync(p+'.pending',JSON.stringify(v,null,2)+'\n',{flag:'wx'});fs.renameSync(p+'.pending',p);}
async function release(out,file) {
  const cfg=JSON.parse(fs.readFileSync(file));
  const s=fs.readFileSync('/proc/'+cfg.pid+'/stat','utf8');assert.equal(s.slice(s.lastIndexOf(')')+2).split(' ')[19],cfg.startToken);
  const c=connection(cfg.url);try {await c.ready;
  const session=(await c.send('Target.attachToTarget',{targetId:cfg.targetId,flatten:true})).sessionId;
  async function checkOwner(){if(cfg.owner){
    const live=await c.send('Runtime.evaluate',{expression:binding.PAGE_READ,returnByValue:true},session);
    assert(!live.exceptionDetails);const apps=live.result.value.apps;assert.equal(apps.length,1);assert.equal(apps[0].name,'quake3_demo');
    for(const key of ['processId','processObject','endpoint','endpointObject','workerObject','moduleObject','epoch','renderEndpoint','renderEndpointObject','renderWorkerObject','pageRendererObject','canvasObject','windowHwnd','windowObject','windowInstance','outputCanvasObject'])assert.equal(apps[0][key],cfg.owner[key],'independent release owner mismatch '+key);
  }}
  async function checkHost(){if(cfg.hostOwner){
    const stat=fs.readFileSync('/proc/'+cfg.pid+'/stat','utf8');assert.equal(stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],cfg.startToken);
    const live=await c.send('Runtime.evaluate',{expression:binding.HOST_READ,returnByValue:true},session);
    assert(!live.exceptionDetails);binding.sameHostOwner(cfg.hostOwner,live.result.value);
  }}
  await checkOwner();
  await checkHost();
  const armed=Date.now(),fallback=armed+1750;let due=fallback,pending='';
  process.stdin.on('data',b=>{pending+=b;let i;while((i=pending.indexOf('\n'))>=0){const v=JSON.parse(pending.slice(0,i));pending=pending.slice(i+1);assert(v.at>=armed&&v.at<=fallback);due=Math.min(due,v.at);}});
  process.stdout.write(JSON.stringify({armed:true,at:armed,fallback,session,pid:process.pid})+'\n');
  while(Date.now()<due)await wait(Math.min(5,due-Date.now()));
  await checkOwner();
  await checkHost();
  const fired=Date.now(),receipts=[];
  if(cfg.mouse){assert.equal(cfg.mouse.button,'left');receipts.push(await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,x:cfg.mouse.x,y:cfg.mouse.y,clickCount:1},session));}
  else for(const key of [...cfg.keys].reverse())receipts.push(await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:key==='Space'?' ':key,code:keyCode(key),windowsVirtualKeyCode:KEYS[key]},session));
  const ack=Date.now();save(out,cfg.name+'-up.json',{armed,fallback,due,fired,ack,receipts,state:'ACK',independent:true});
  await c.send('Target.detachFromTarget',{sessionId:session});
  } finally {c.ws.close();process.stdin.destroy();}
}
async function hostBootstrap({out,evaluate,send,session,owner,browserIdentity,deadline}){
  const record=(n,v)=>save(out,n,v);
  const checkBrowser=()=>{const s=fs.readFileSync('/proc/'+browserIdentity.pid+'/stat','utf8');assert.equal(s.slice(s.lastIndexOf(')')+2).split(' ')[19],browserIdentity.startToken,'host browser process replaced');};
  assert(!fs.existsSync(out+'/host-bootstrap-attempt.json'),'one host bootstrap; never replay');
  record('host-bootstrap-attempt.json',{at:Date.now(),hostOnly:true,noReplay:true});
  const at=Date.now(),captureDeadline=at+3000;
  await evaluate(`(() => {if(globalThis.__gltronHostUIEvents)throw Error('host observer already installed');const events=[];Object.defineProperty(globalThis,'__gltronHostUIEvents',{value:events});for(const type of ['mousedown','mouseup','click'])document.addEventListener(type,e=>events.push({type,trusted:e.isTrusted,at:Date.now(),consent:e.target===document.querySelector('#browser-fullscreen-consent button'),canvas:e.target?.tagName==='CANVAS',target:e.target?.id||e.target?.tagName}),true);return true;})()`);
  checkBrowser();const before=await evaluate(binding.HOST_READ);binding.sameHostOwner(owner,before);binding.consentButton(before);
  assert(Date.now()<captureDeadline,'host capture passive precheck deadline; no screenshot requested');
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session),png=Buffer.from(shot.data,'base64');
  assert(Date.now()<captureDeadline,'host screenshot deadline');
  const scene={at,sha256:sha(png),nonce:crypto.randomUUID(),observation:before,browser:browserIdentity,hostOnly:true,gameAdmission:false};
  binding.reviewHostBootstrap(scene,{sha256:scene.sha256,observation:'geometry consistency only; personal review still required',hostOnly:true},await evaluate(binding.HOST_READ));
  assert(Date.now()<captureDeadline,'host capture transaction validation deadline; no retry');
  fs.writeFileSync(out+'/host-bootstrap.png',png,{flag:'wx'});record('host-bootstrap.json',scene);
  const reviewFile=out+'/host-review.json';
  while(!fs.existsSync(reviewFile)){assert(Date.now()<Math.min(deadline,at+30000),'bounded personal host review expired');await wait(10);}
  const review=JSON.parse(fs.readFileSync(reviewFile));assert(!review.cancelled,'host review cancelled; permanently closed');assert.equal(review.nonce,scene.nonce,'current host nonce');
  assert.equal(sha(fs.readFileSync(out+'/host-bootstrap.png')),scene.sha256);
  checkBrowser();const point=binding.reviewHostBootstrap(scene,review,await evaluate(binding.HOST_READ));
  record('host-bootstrap-used.json',{nonce:scene.nonce,at:Date.now(),noReplay:true,guestClickAuthorized:false,review});
  const config={...browserIdentity,name:'host-consent',mouse:{...point,button:'left'},hostOwner:owner};record('host-release-config.json',config);
  const child=cp.spawn(process.execPath,[__filename,'release',out,out+'/host-release-config.json'],{stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',error,down;
  child.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
  try{
    const armed=await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('host independent release arm timeout')),1000);child.stdout.on('data',b=>{stdout+=b;if(stdout.includes('\n')){clearTimeout(timer);r(JSON.parse(stdout.split('\n')[0]));}});child.once('exit',code=>{if(!stdout){clearTimeout(timer);j(Error('host release child exit '+code));}});});assert(armed.armed);
    checkBrowser();binding.reviewHostBootstrap(scene,review,await evaluate(binding.HOST_READ));
    assert(Date.now()<deadline&&Date.now()<armed.fallback-250,'finite host DOWN window');
    down=Date.now();await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,x:point.x,y:point.y,clickCount:1},session);
    child.stdin.write(JSON.stringify({at:Math.min(armed.fallback,down+120)})+'\n');
  }catch(e){error=e;}
  finally{child.stdin.end();const result=await joined;record('host-release-wait.json',{...result,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr});if(result.code!==0)error??=Error('independent host UP failed');}
  record('host-down.json',{at:down??null,error:error?String(error):null,hostOnly:true});if(error)throw error;
  const up=JSON.parse(fs.readFileSync(out+'/host-consent-up.json'));assert(up.ack-down<=2000,'bounded independent host UP');
  const events=await evaluate('__gltronHostUIEvents');record('host-events.json',{events,canvasMouseEventObserved:events.some(e=>e.canvas)});
  assert.deepEqual(events.map(e=>e.type),['mousedown','mouseup','click'],'one ordinary host click');assert(events.every(e=>e.trusted&&e.consent&&!e.canvas),'trusted host button edges only');
  for(;;){
    checkBrowser();const live=await evaluate(binding.HOST_READ);binding.sameHostOwner(owner,live);
    assert.equal(live.wrap,scene.observation.wrap,'fullscreen target replaced');
    recordObservation(live);
    if(live.fullscreen===live.wrap&&!live.strip.visible&&live.page.apps[0].outputVisible){record('host-fullscreen.json',{at:Date.now(),observation:live,hostOnly:true,gameAdmission:false});return live;}
    assert(Date.now()<Math.min(deadline,up.ack+5000),'trusted consent did not produce visible complete fullscreen scene');await wait(25);
  }
  function recordObservation(v){fs.appendFileSync(out+'/host-fullscreen-observations.jsonl',JSON.stringify(v)+'\n');}
}
function assertOriginalQualification(pins){
 const q=pins.qualification;assert(q,'original requires frozen causal Chrome qualification');
 const read=p=>{assert(typeof p.path==='string'&&['scratch/runs/20261114-quake3-browser-current-frag/','scratch/runs/20261115-quake3-startup-operation-cause/'].some(root=>p.path.startsWith(root))&&!p.path.includes('..'));const b=fs.readFileSync(ROOT+'/'+p.path);assert.equal(sha(b),p.sha256,'qualification bytes changed');return JSON.parse(b);};
 const report=read(q.report),source=read(q.pins),native=report.queuedNative;
 assert(report.passed&&report.originalLaunched===false&&report.chromeUnknown?.helperTerminal&&report.chromeWait?.actualWait&&report.chromeWait.stdoutEOF&&report.chromeWait.stderrEOF,'complete causal Chrome controls required');
 assert(report.passiveInput?.length===3&&report.passiveInputRed?.dispatches===0&&report.passiveInputLateACK?.chainClosed,'production baseline and terminal input controls required');
 assert(native&&!native.baseline.ready&&native.candidate.paintHeld&&native.candidate.surfaceReads===0&&native.during.held,'actual Worker-held causal proof required');
 assert.equal(native.retained.sha256,native.during.sha256);assert.deepEqual(native.retained.metadata,native.during.metadata);
 for(const [proof,down,up,key] of [[native.consumed,256,257,40],[native.mouse?.consumed,513,514,null]]){
  assert(proof?.receipts.some(r=>r.words[1]===down&&(key===null||r.words[2]===key))&&proof.receipts.some(r=>r.words[1]===up&&(key===null||r.words[2]===key)),'native queued DOWN/UP consumption required');assert.equal(proof.shadowEntries.length,0);
 }
 assert(native.mouse.actualTrustedPointerLock&&native.release.actualWait&&native.mouse.actualWait,'trusted finite input and independent actual release required');
 for(const p of ['tools/quake3-browser-controller.cjs','test/quake3-browser-controller.test.cjs','build/wine-assembly.wasm']){
  const tested=source.files.find(f=>f.path===p),live=pins.files.find(f=>f.path===p);assert(tested&&live);assert.equal(live.sha256,tested.sha256,'qualified source/module drift');assert.equal(sha(fs.readFileSync(ROOT+'/'+p)),tested.sha256);
 }
 assert(source.modules.includes(native.identity.moduleSha256),'actual consumed module must match frozen production module');
 return {report:q.report,pins:q.pins,identity:native.identity,qualified:true};
}
async function browser(out,backend) {
  assert(['webgl','controls'].includes(backend));
  const launch=JSON.parse(fs.readFileSync(out+'/launch.json'));
  const pins=JSON.parse(fs.readFileSync(out+'/pins.json'));
  const qualification=backend==='controls'?null:assertOriginalQualification(pins);
  for(const p of pins.files)assert.equal(sha(fs.readFileSync(ROOT+'/'+p.path)),p.sha256,p.path);
  let server,browser,chromeWait,c,session,chain,latest,bound,cutoffTimer,pendingInput=null,closing=false,phase=false,sourceInventory,sourceError;
  const workers=new Map(),tasks=[];
  const record=(n,v)=>save(out,n,v),log=(n,v)=>fs.appendFileSync(out+'/'+n,JSON.stringify(v)+'\n');
  async function evaluate(expression,s=session){if(sourceError)throw sourceError;sourceInventory?.noteEvaluation(s,expression);const v=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},s);if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));return v.result.value;}
  async function state(){
    const page=await evaluate(`({at:Date.now(),apps:runningApps.map(a=>({name:a.name,running:a.wine?.running,stopped:a.wine?._stopped,processId:a.wine?.processId,slice:a.wine?._workerLastSlice,d3dStats:a.wine?.guestWorker?.d3dStats,exitCode:a.wine?._exitCode})),retiredOwner:globalThis.__gltronPassiveOwner?{processId:__gltronPassiveOwner.processId,running:__gltronPassiveOwner.running,stopped:__gltronPassiveOwner._stopped,nativeExitCode:__gltronPassiveOwner._exitCode??null,processExited:__gltronPassiveOwner._processObject?.exited,processExitCode:__gltronPassiveOwner._processObject?.exitCode}:null,log:document.getElementById('log')?.textContent?.slice(-12000)})`);
    const owners=[];
    for(const w of workers.values())if(!w.closed&&w.url.includes('d3d-render-worker'))owners.push({targetId:w.targetId,sessionId:w.sessionId,value:await evaluate(`Array.from(endpoints,([id,e])=>({id,options:e.options,failed:e.failed?String(e.failed):null,evidence:e.evidence,adapterPresent:!!e.adapter,glObservation:globalThis.__gltronObserver?.snapshot?.()??null,control:e.control?Array.from(e.control):null}))`,w.sessionId)});
    const producers=[];
    for(const w of workers.values())if(!w.closed&&w.url.includes('guest-worker'))producers.push({targetId:w.targetId,value:await evaluate(`typeof instance==='undefined'||!instance?null:({glSwEnabled:instance.exports.gl_sw_enabled?.()??null})`,w.sessionId)});
    const scheduling=await evaluate(`runningApps.map(a=>({name:a.name,stepsPerSlice:a.wine?.stepsPerSlice,frozen:a.wine?.frozen??null,hostSteps:a.wine?._debugStepCount??null}))`);
    return {...page,owners,producers,scheduling,workers:[...workers.values()]};
  }
  async function capture(name){
    assert(/^[a-z0-9-]+$/.test(name));assert(!fs.existsSync(out+'/'+name+'.png'));
    const captured=await chain.capture(name);fs.writeFileSync(out+'/'+name+'.png',captured.png,{flag:'wx'});
    latest=captured.capture;record(name+'.json',{...captured,png:undefined});const observed=await state();record(name+'-state.json',observed);
    if(latest.identity.renderEndpoint!=='none'){
      const owners=observed.owners.flatMap(w=>w.value.filter(e=>e.id===latest.identity.renderEndpoint&&w.targetId===latest.identity.rendererTarget));
      assert.equal(owners.length,1,'unique actual owning backend');assert.equal(owners[0].options.api,'gl');assert.equal(owners[0].options.backend,backend,'actual backend differs from selected arm');assert(!owners[0].failed);
    }
    return latest;
  }
  async function close(reason){
    if(closing)return;closing=true;clearTimeout(cutoffTimer);record('close-reason.json',{reason,at:Date.now(),hostOnly:true});
    if(c&&!c.closed)try{await c.send('Browser.close');}catch(e){record('browser-close-error.json',{error:String(e)});}
    if(browser){let timer;try{await Promise.race([chromeWait,new Promise((_,j)=>{timer=setTimeout(()=>j(Error('browser close timeout')),5000);})]);}catch(e){browser.kill('SIGTERM');await chromeWait;}finally{clearTimeout(timer);}}
    c?.ws.close();sourceInventory?.close();server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));fs.rmSync(out+'/profile',{recursive:true,force:true});record('closed.json',{at:Date.now(),nativeQuitClaim:false});
  }
  try {
    if(backend!=='controls')cutoffTimer=setTimeout(()=>{phase=true;if(!fs.existsSync(out+'/quit-phase.json'))record('quit-phase.json',{at:Date.now(),cutoff:gameplayCutoff(launch),irreversible:true,reason:'mechanical 180s Quit reserve; no automatic input'});},Math.max(0,gameplayCutoff(launch)-Date.now()));
    server=await require(ROOT+'/test/static-server.js').startStaticServer({root:ROOT,crossOriginIsolated:true,rewritePath:p=>p.startsWith('/binaries/')?'/test'+p:p});
    server.prependListener('request',(req,res)=>{const h=crypto.createHash('sha256');let size=0;const add=b=>{if(b){b=Buffer.isBuffer(b)?b:Buffer.from(b);size+=b.length;h.update(b);}},wr=res.write,en=res.end;res.write=function(b){add(b);return wr.apply(this,arguments);};res.end=function(b){add(b);return en.apply(this,arguments);};res.once('finish',()=>log('http.jsonl',{url:req.url,status:res.statusCode,size,sha256:h.digest('hex')}));});
    const port=server.address().port;
    for(const p of pins.http){const r=await fetch('http://127.0.0.1:'+port+p.url);assert.equal(r.status,200);const body=Buffer.from(await r.arrayBuffer());assert.equal(body.length,p.size);assert.equal(sha(body),p.sha256);}
    record('http-dependency-check.json',{passed:true,pins:pins.http});
    browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--window-size=1024,900','--remote-debugging-port=0','--user-data-dir='+out+'/profile','about:blank'],{stdio:['ignore','pipe','pipe']});
    const stdout=fs.createWriteStream(out+'/chrome.stdout',{flags:'wx'}),stderr=fs.createWriteStream(out+'/chrome.stderr',{flags:'wx'});browser.stdout.pipe(stdout);browser.stderr.pipe(stderr);
    chromeWait=new Promise(r=>browser.once('close',(code,signal)=>{record('chrome-wait.json',{pid:browser.pid,code,signal,actualWait:true,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded,at:Date.now()});r();}));
    const stat=fs.readFileSync('/proc/'+browser.pid+'/stat','utf8'),startToken=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
    record('browser-pid.json',{pid:browser.pid,startToken,port,at:Date.now()});
    const active=out+'/profile/DevToolsActivePort';for(let n=0;n<100&&(!fs.existsSync(active)||!/^\d+\n\/devtools\/browser\/[0-9a-f-]{36}\s*$/i.test(fs.readFileSync(active,'utf8')));n++){assert(browser.exitCode===null);await wait(100);}
    const [dp,wp]=fs.readFileSync(active,'utf8').trim().split('\n'),url='ws://127.0.0.1:'+dp+wp;c=connection(url);await c.ready;
    record('endpoint.json',{url,pid:browser.pid,startToken});
    sourceInventory=createInventory({send:c.send,terminal:()=>c.closed});
    c.event=v=>{
      if(v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker'){
        const {sessionId,targetInfo}=v.params,w={sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[],closed:false};workers.set(sessionId,w);
        sourceInventory.attach(sessionId,targetInfo.targetId);
        const task=(async()=>{await c.send('Runtime.enable',{},sessionId);sourceInventory.noteEvaluation(sessionId,GL_OBSERVER);await c.send('Runtime.evaluate',{expression:GL_OBSERVER},sessionId);await c.send('Debugger.enable',{},sessionId);await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},sessionId);})();tasks.push(task);task.catch(e=>log('worker-errors.jsonl',{error:String(e)}));
      } else if(v.method==='Target.detachedFromTarget'){const w=workers.get(v.params.sessionId);if(w)w.closed=true;sourceInventory.detach(v.params.sessionId);}
      else if(v.method==='Runtime.executionContextCreated')sourceInventory.contextCreated(v.sessionId,v.params.context);
      else if(v.method==='Runtime.executionContextsCleared')sourceInventory.contextsCleared(v.sessionId);
      else if(v.method==='Runtime.executionContextDestroyed')sourceInventory.contextsCleared(v.sessionId,v.params.executionContextId);
      else if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)){
        const w=workers.get(v.sessionId),p=v.params,row={url:p.url,scriptId:p.scriptId,sessionId:v.sessionId,targetId:w.targetId,executionContextId:p.executionContextId,contentHash:p.hash??null,scriptLanguage:p.scriptLanguage??null};w.scripts.push(row);
        const task=sourceInventory.inspect(v.sessionId,p).then(identity=>{Object.assign(row,identity);log('source-inventory.jsonl',row);});tasks.push(task);task.catch(e=>{row.error=String(e);sourceError??=e;c.abort(sourceError);log('source-inventory-errors.jsonl',row);});
      } else if(['Runtime.consoleAPICalled','Runtime.exceptionThrown'].includes(v.method))log('console.jsonl',v);
    };
    record('browser-version.json',await c.send('Browser.getVersion'));record('system-info.json',await c.send('SystemInfo.getInfo'));
    const tabs=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(tabs.length,1);
    const targetId=tabs[0].targetId;session=(await c.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
    await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);await c.send('Page.enable',{},session);await c.send('Runtime.enable',{},session);
    chain=binding.createChain({evaluate,send:c.send,workers,pageSession:session,app:'quake3_demo',expectedModules:pins.modules,onTicketObservation:o=>log('capture-ticket-observations.jsonl',o),onInputObservation:o=>log('input-preflight-observations.jsonl',o),inputReadiness:i=>pendingInput?.mouse?binding.queuedClientReadinessExpression(i,pendingInput.mouse):binding.queuedKeyReadinessExpression(i)});
    if(qualification)record('causal-qualification.json',qualification);
    record('page-target.json',{targetId,session});
    if(backend==='controls'){
      await evaluate(`globalThis.keyProof=[];for(const type of ['keydown','keyup'])addEventListener(type,e=>keyProof.push({type,key:e.key,trusted:e.isTrusted,at:Date.now()}));`);
      const cases=[...Object.keys(KEYS).map(key=>({key,ms:120})),{key:'a',ms:1500},{key:'s',ms:null}];
      for(const [i,{key,ms}] of cases.entries()){
        const name='control-'+i,config={url,pid:browser.pid,startToken,targetId,keys:[key],name};record(name+'-release-config.json',config);
        const child=cp.spawn(process.execPath,[__filename,'release',out,out+'/'+name+'-release-config.json'],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
        const armed=await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('native release arm timeout')),1500);child.stdout.on('data',b=>{stdout+=b;if(stdout.includes('\n')){clearTimeout(t);r(JSON.parse(stdout.trim()));}});});assert(armed.armed);
        const before=Date.now();await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:key==='Space'?' ':key,code:keyCode(key),windowsVirtualKeyCode:KEYS[key]},session);child.stdin.end(ms===null?'':JSON.stringify({at:before+ms})+'\n');
        const result=await joined;record(name+'-wait.json',{...result,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr});assert.equal(result.code,0,stderr);
      }
      const proof=await evaluate('keyProof');assert.equal(proof.length,cases.length*2);assert(proof.every(e=>e.trusted));for(let i=0;i<proof.length;i+=2){assert.equal(proof[i].type,'keydown');assert.equal(proof[i+1].type,'keyup');assert.equal(proof[i].key,proof[i+1].key);assert(proof[i+1].at-proof[i].at<=2000);}
      await evaluate(`globalThis.mouseProof=[];for(const type of ['mousedown','mouseup'])addEventListener(type,e=>mouseProof.push({type,trusted:e.isTrusted,at:Date.now()}));`);
      for(const [i,ms] of [1500,null].entries()){
        const name='mouse-control-'+i,config={url,pid:browser.pid,startToken,targetId,mouse:{button:'left',x:20,y:20},name};record(name+'-release-config.json',config);
        const child=cp.spawn(process.execPath,[__filename,'release',out,out+'/'+name+'-release-config.json'],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stderr.on('data',b=>stderr+=b);const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));
        const armed=await new Promise((r,j)=>{const t=setTimeout(()=>j(Error('native mouse release arm timeout')),1500);child.stdout.on('data',b=>{stdout+=b;if(stdout.includes('\n')){clearTimeout(t);r(JSON.parse(stdout.trim()));}});});assert(armed.armed);
        const before=Date.now();await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,x:20,y:20,clickCount:1},session);child.stdin.end(ms===null?'':JSON.stringify({at:before+ms})+'\n');
        const result=await joined;record(name+'-wait.json',{...result,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout,stderr});assert.equal(result.code,0,stderr);
      }
      const mouseProof=await evaluate('mouseProof');assert.equal(mouseProof.length,4);assert(mouseProof.every(e=>e.trusted));for(let i=0;i<4;i+=2){assert.equal(mouseProof[i].type,'mousedown');assert.equal(mouseProof[i+1].type,'mouseup');assert(mouseProof[i+1].at-mouseProof[i].at<=2000);}
      record('native-controls.json',{passed:true,proof,mouseProof,originalLaunched:false});await close('blank-page native input controls complete');return;
    }
    // Registered cooperative 10000 scheduling is unchanged.
    await c.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/index.html?debug&threads&gl-renderer=webgl&app=quake3_demo'},session);
    const startupEnd=gameplayCutoff(launch);
    for(;;){
      const ready=await evaluate(`typeof runningApps==='undefined'?null:runningApps.map(a=>({name:a.name,running:a.wine?.running,stopped:a.wine?._stopped,worker:!!a.wine?.guestWorker,slice:!!a.wine?._workerLastSlice,glPorts:[...(a.wine?._renderWorkerManager?.ports?.values()||[])].filter(p=>!p.closed&&p.options?.api==='gl').length}))`);
      if(ready?.length===1&&ready[0].running&&ready[0].worker&&ready[0].slice&&ready[0].glPorts===1)break;
      assert(!ready?.some(a=>a.stopped),'original stopped during startup');assert(Date.now()<startupEnd,'bounded original startup readiness');await wait(250);
    }
    await Promise.all(tasks);
    // Pin the first identifiable owner before waiting for scene production.
    // It cannot be replaced with a similar-looking initialized owner later.
    const startupOwner=(await evaluate(binding.PAGE_READ)).apps[0];
    const startupFields=binding.FIELDS.filter(k=>!['outputCanvasObject','workerTarget','workerInstance','moduleSha256','rendererTarget','rendererEpoch','rendererModuleSha256'].includes(k));
    record('startup-owner-observation.json',{identity:startupOwner,outputSelected:false,permanentBound:false});
    for(;;){
      const live=(await evaluate(binding.PAGE_READ)).apps;
      assert(live.length===1&&live[0].running&&!live[0].stopped,'startup owner stopped');
      for(const k of startupFields){assert(startupOwner[k]!==undefined&&startupOwner[k]!==null,'missing startup identity '+k);assert.equal(live[0][k],startupOwner[k],'startup identity changed '+k);}
      const renderers=[...workers.values()].filter(w=>!w.closed&&w.url.includes('d3d-render-worker'));
      const observations=await Promise.all(renderers.map(w=>evaluate('globalThis.__gltronObserver?.snapshot?.()??null',w.sessionId)));
      log('startup-gl-observations.jsonl',{at:Date.now(),observations});
      // A context/first clear/present is not an initialized game scene.
      // These are necessary producer observations only; personal review of
      // the subsequent complete display still precedes permanent binding.
      assert(Date.now()<startupEnd,'bounded original startup readiness');
      if(observations.length===1&&observations[0]?.frontendDraws>0&&observations[0]?.frontendPresents>0&&observations[0]?.draws>0&&observations[0]?.transfers>0)break;
      await wait(25);
    }
    // Output choice is unknown before the first ordinary valid display (the
    // normal compositor can select direct or filtered presentation). Select
    // it exactly once from that receipt; all subsequent reads pin it.
    await hostBootstrap({out,evaluate,send:c.send,session,owner:startupOwner,browserIdentity:{url,pid:browser.pid,startToken,targetId},deadline:startupEnd});
    const selected=await binding.awaitStartupReady({evaluate,identity:startupOwner,deadline:startupEnd,selectOutput:true,onObservation:s=>log('startup-initial-display.jsonl',s)});
    const selectedOwner=await chain.readLive();assert.equal(selectedOwner.identity.outputCanvasObject,selected.outputCanvasObject,'selected startup output replaced');
    const startupReadiness=await chain.prepareStartup(startupEnd,s=>log('startup-readiness.jsonl',s));
    // This is a passive observation, not a promise that paint stays idle
    // across the asynchronous module reads preceding the final arm.
    record('startup-prebind-ready.json',{...startupReadiness,passiveOnly:true,captureRequested:false,permanentBound:false,inputDowns:0,startupDeadline:startupEnd});
    await capture('startup');
    // Permanent binding waits for personally reviewed nonblack submitted WebGL scene.
    record('startup-ready.json',{at:Date.now(),backend,permanentBound:false});
    await evaluate(`(()=>{if(Object.hasOwn(globalThis,'__gltronPassiveOwner'))throw Error('owner reference already bound');Object.defineProperty(globalThis,'__gltronPassiveOwner',{value:runningApps[0].wine});return true;})()`);
    record('ready.json',{at:Date.now(),backend});
    for(let n=0;!closing;n++) {
      const file=out+'/command-'+n+'.json';while(!fs.existsSync(file)&&Date.now()<launch.deadline*1000){if(sourceError)throw sourceError;await wait(25);}
      assert(Date.now()<launch.deadline*1000,'fixed deadline');const cmd=JSON.parse(fs.readFileSync(file));assert(!fs.existsSync(out+'/receipt-'+n+'.json'));
      if(cmd.action==='close'){record('terminal-state.json',await state());await close('reviewed host teardown');record('receipt-'+n+'.json',{state:'ACK',hostOnly:true});break;}
      if(cmd.action==='terminal'){
        assert(phase,'reviewed irreversible Quit phase required');const terminal=await state();assert(terminal.retiredOwner?.processExited===true,'actual original owner has not exited');
        const at=Date.now(),shot=await c.send('Page.captureScreenshot',{format:'png'},session),png=Buffer.from(shot.data,'base64');assert(/^[a-z0-9-]+$/.test(cmd.name));fs.writeFileSync(out+'/'+cmd.name+'.png',png,{flag:'wx'});record(cmd.name+'.json',{at,terminal,pngSHA256:sha(png),nativeQuitClaim:false});record('receipt-'+n+'.json',{state:'ACK',at:Date.now()});continue;
      }
      if(cmd.action==='capture'){await capture(cmd.name);record('receipt-'+n+'.json',{state:'ACK',capture:latest});continue;}
      if(cmd.action==='outcome'){
        assert(bound&&cmd.review===latest.label&&cmd.observation?.trim()&&Date.now()-Date.parse(latest.at)<30000);
        phase=true;if(!fs.existsSync(out+'/quit-phase.json'))record('quit-phase.json',{at:Date.now(),irreversible:true,reason:'personally reviewed native outcome',observation:cmd.observation});
        record('receipt-'+n+'.json',{state:'ACK',at:Date.now()});continue;
      }
      if(cmd.action==='bind'){
        assert(!bound&&cmd.review===latest.label&&cmd.observation?.trim());
        assert(Date.now()-Date.parse(latest.at)<30000,'fresh reviewed initialized scene');
        const observed=await state(),owned=observed.owners.flatMap(w=>w.value.filter(e=>e.id===latest.identity.renderEndpoint&&w.targetId===latest.identity.rendererTarget));
        assert.equal(owned.length,1);const g=owned[0].glObservation;
        assert(g&&g.frontendDraws>0&&g.frontendPresents>0&&g.draws>0&&g.transfers>0&&g.contexts.some(x=>!x.software&&x.hwnd&&x.current&&x.deviceObserved),'actual initialized submitted WebGL required');
        assert(observed.scheduling.every(x=>x.stepsPerSlice===10000),'registered cooperative 10000 block browser budget');
        const producer=observed.producers.find(x=>x.targetId===latest.identity.workerTarget);assert.equal(producer?.value?.glSwEnabled,0,'actual owning producer must not select SoftwareGL');
        bound=latest.identity;record('permanent-owner.json',{identity:bound,browser:{pid:browser.pid,startToken,targetId},backend,noReplay:true,review:cmd.observation,scene:latest,actualGL:g});
        record('receipt-'+n+'.json',{state:'ACK',at:Date.now()});continue;
      }
      assert(bound,'permanent reviewed owner required');assert.equal(cmd.action,'pulse');const maxAge=policy(cmd,launch,phase);
      if(cmd.mode==='quit'){phase=true;if(!fs.existsSync(out+'/quit-phase.json'))record('quit-phase.json',{at:Date.now(),cutoff:gameplayCutoff(launch),irreversible:true,route:cmd.route});}
      assert.equal(cmd.review,latest.label);assert(!fs.existsSync(out+'/'+latest.label+'-used.json'),'fresh full scene before each gesture');const review={...latest,review:cmd.observation};record(cmd.name+'-review.json',{...review,mode:cmd.mode,route:cmd.route});
      assert.equal(sha(fs.readFileSync(out+'/'+latest.label+'.png')),latest.sha256,'reviewed fullscene bytes changed');
      binding.same(bound,latest.identity);
      if(Date.now()-Date.parse(latest.at)>=maxAge){record('receipt-'+n+'.json',{state:'NOT_SENT',effects:0,reason:'fresh scene expired',newIntentOnly:true});continue;}
      record(latest.label+'-used.json',{intent:cmd.name,at:Date.now()});let attempted=false;
      try { assert.equal(pendingInput,null);pendingInput=cmd;await chain.admit({...review,maxAgeMs:maxAge,intentDeadlineMs:cmd.mode==='quit'?launch.deadline*1000:gameplayCutoff(launch)-3000},async admission=>{
        binding.same(bound,admission.live.identity);policy(cmd,launch,phase&&cmd.mode!=='quit');
        const config={...JSON.parse(fs.readFileSync(out+'/endpoint.json')),name:cmd.name,targetId,keys:cmd.keys,mouse:cmd.mouse,owner:bound};record(cmd.name+'-release-config.json',config);
        const child=cp.spawn(process.execPath,[__filename,'release',out,out+'/'+cmd.name+'-release-config.json'],{stdio:['pipe','pipe','pipe']});
        let output='',errors='';const joined=new Promise(r=>child.once('close',(code,signal)=>r({code,signal})));child.stderr.on('data',b=>errors+=b);
        const events=[];let error,armed;
        try {
          armed=await new Promise((r,j)=>{let timer=setTimeout(()=>j(Error('release prearm timeout')),1000);child.stdout.on('data',b=>{output+=b;if(output.includes('\n')){clearTimeout(timer);r(JSON.parse(output.split('\n')[0]));}});child.once('exit',code=>{if(!output){clearTimeout(timer);j(Error('release child exit '+code));}});});assert(armed.armed);
          const ready=await evaluate(cmd.mouse?binding.queuedClientReadinessExpression(bound,cmd.mouse):binding.queuedKeyReadinessExpression(bound));
          assert(ready.ready,'input current display not ready after prearm: '+ready.pending?.join(', '));
          if(Date.now()-Date.parse(latest.at)>=maxAge){record(cmd.name+'-unsent.json',{downEffects:0,state:'CLOSED_BEFORE_DOWN',reason:'expired after prearm; independent UP remains armed'});throw Error('expired after release prearm; permanently close input');}
          if(cmd.mouse){assert(Date.now()<armed.fallback-250);attempted=true;const before=Date.now();await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,x:cmd.mouse.x,y:cmd.mouse.y,clickCount:1},session);events.push({mouse:cmd.mouse,before,ack:Date.now()});}
          for(const key of cmd.keys){assert(Date.now()<armed.fallback-250);attempted=true;const before=Date.now();await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:key==='Space'?' ':key,code:keyCode(key),windowsVirtualKeyCode:KEYS[key]},session);events.push({key,before,ack:Date.now()});}
          child.stdin.write(JSON.stringify({at:Math.min(armed.fallback,events[0].before+cmd.ms)})+'\n');
        }catch(e){error=e;}
        finally {child.stdin.end();const joinedValue=await joined;record(cmd.name+'-release-wait.json',{...joinedValue,actualWait:true,stdoutEOF:child.stdout.readableEnded,stderrEOF:child.stderr.readableEnded,stdout:output,stderr:errors});assert.equal(joinedValue.code,0);}
        record(cmd.name+'-delivery.json',{events,admission,attempted,error:error?String(error):null});if(error)throw error;
        const up=JSON.parse(fs.readFileSync(out+'/'+cmd.name+'-up.json'));assert(events.every(e=>up.ack-e.before<=2000),'UP acknowledgement exceeded maximum hold');
        const physical=await evaluate(`runningApps.map(a=>({name:a.name,mouseButtons:a.wine?.renderer?._mouseButtonsMask??0,keys:${JSON.stringify(cmd.keys.map(k=>KEYS[k]))}.map(k=>({key:k,down:a.wine?.renderer?.peekKeyDownState(k)}))}))`);record(cmd.name+'-physical.json',{physical,at:Date.now()});assert(!cmd.mouse||physical.every(a=>a.mouseButtons===0),'released physical mouse state');assert(physical.every(a=>a.keys.every(k=>k.down===false||k.down===0)),'released physical key state');
      });
      } catch(e) {if(e.code!=='STALE_SCENE_BEFORE_DISPATCH'||attempted||fs.existsSync(out+'/'+cmd.name+'-release-config.json'))throw e;record('receipt-'+n+'.json',{state:'NOT_SENT',effects:0,newIntentOnly:true,reason:String(e),at:Date.now()});continue;}finally{pendingInput=null;}
      record('receipt-'+n+'.json',{state:attempted?'ACK':'NOT_SENT',effects:attempted?(cmd.mouse?1:cmd.keys.length):0,noReplay:true,at:Date.now()});
    }
  }catch(e){
    record('failure.json',{error:e.stack,code:e.code??null,inputState:e.inputState??null,ticketObservation:e.ticketObservation??null,captureNonce:e.captureNonce??null,noReplay:true,at:Date.now()});process.exitCode=1;
    if(c&&!c.closed&&session)try{const shot=await c.send('Page.captureScreenshot',{format:'png'},session);fs.writeFileSync(out+'/first-failure.png',Buffer.from(shot.data,'base64'),{flag:'wx'});record('first-failure-state.json',await state());}catch(captureError){record('failure-capture-error.json',{error:String(captureError)});}
    await close('first causal failure');
  }
}
if(require.main===module){const [mode,out,arg]=process.argv.slice(2);(mode==='release'?release(out,arg):browser(out,arg)).catch(e=>{console.error(e);process.exitCode=1;});}
module.exports={...binding,policy,gameplayCutoff,KEYS,HELPER,sha,assertOriginalQualification,connection,release,GL_OBSERVER,hostBootstrap};
